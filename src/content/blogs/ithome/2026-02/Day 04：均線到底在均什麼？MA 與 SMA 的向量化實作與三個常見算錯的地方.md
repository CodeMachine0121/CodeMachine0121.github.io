---
title: "Day 04：均線到底在均什麼？MA 與 SMA 的向量化實作與三個常見算錯的地方"
datetime: "2026-09-18"
description: "SMA 只有一行 rolling().mean()，但算錯的方式有三種：暖身期的 NaN 被填掉、資料缺漏讓視窗悄悄變長、以及用當根收盤價假設當根開盤成交。這篇把三個都拆開講，附 for loop 與向量化差 3000 倍的實測、跟 pandas-ta 的誤差對照，以及會標出交叉點的 Plotly 圖。"
image: ""
parent: "2026 ithome-鐵人賽: 工程師的量化交易入門：從 K 線到可組合的交易策略引擎 系列"
draft: true
---

## 資料有了，接下來要從裡面算出東西

昨天 Day 03 你把回補管線寫好了，`ingest/binance.py` 能決定哪段走 `data.binance.vision` 的批次 zip、哪段走 REST 補洞，中斷了還能重跑。今天開始用它產出的資料。以下所有範例都吃同一張表：BTC/USDT **現貨**、1 小時 K 線，來源是 Day 03 存下來的 parquet，索引是 UTC 的 `DatetimeIndex`，值是 `open_time`（每根 K 線的開盤時間，這是 Day 02 定下來的慣例，等一下會很重要）。

把這張表畫成圖，你會看到價格上上下下。你想問的第一個問題大概是「現在是往上還是往下」，而這個問題沒辦法直接從 `close` 那一欄看出來，因為每一根都在跳。移動平均就是回答這個問題最基本的工具，也是接下來三天（Day 04 的 SMA、Day 05 的 EMA、Day 06 的 RSI）裡最單純的一個。

單純到什麼程度？核心是一行：

```python
df["close"].rolling(20).mean()
```

問題是這一行有三種算錯的方式，而且三種都不會噴錯。這篇大部分的篇幅在講那三種。

## 交易概念補課：均線、趨勢、交叉

### 均線在均什麼

移動平均（Moving Average，MA）就是**在每一個時間點，回頭取最近 n 根 K 線的收盤價，算它們的平均**。取算術平均、每根權重相同的版本叫簡單移動平均（Simple Moving Average，SMA）：

```
SMA(n)[t] = (close[t-n+1] + close[t-n+2] + ... + close[t]) / n
```

從訊號處理的角度，這是一個長度 n 的等權移動視窗低通濾波器。它做的事情是把高頻的抖動壓掉，留下低頻的走向。

低通濾波一定有代價，就是**延遲**。等權平均的重心落在視窗的中點，所以在一段穩定的趨勢裡，SMA(n) 會落後價格大約 `(n-1)/2` 根。這不是估計值，在完全線性的價格序列上可以驗證得剛剛好：

```python
import numpy as np
import pandas as pd

index = pd.date_range("2026-01-01", periods=200, freq="1h", tz="UTC")
linear = pd.Series(np.arange(200, dtype=float) * 10 + 60000, index=index)

for period in (20, 60, 200):
    lag_in_bars = (linear.iloc[-1] - linear.rolling(period).mean().iloc[-1]) / 10
    print(period, lag_in_bars, (period - 1) / 2)
```

```
20 9.5 9.5
60 29.5 29.5
200 99.5 99.5
```

所以視窗長度不是「調得越大越準」的參數，它是一個取捨：n 越大越平滑、雜訊越少，但你看到轉折的時間也越晚。SMA(200) 在 1 小時線上大約落後 100 小時，也就是四天。

那該選幾？20、60、200 是慣例，來源是股市的月、季、年交易日數的近似，跟加密貨幣 24/7 的節奏其實對不太起來。它們之所以還是被廣泛使用，很大一部分原因是很多人在看同樣的線。實際挑長度的依據應該是兩件事：你想濾掉多長的雜訊，以及你能忍受多少延遲。

這裡先擋一個念頭：現在**不要**去掃 5 到 200 每個長度都試一遍，挑歷史表現最好的那個。那樣做為什麼會出事、以及正確的做法是什麼，Day 21 整篇在講。今天先選 20 跟 60，因為要示範兩條線的交叉。

### 趨勢，以及黃金交叉與死亡交叉

**趨勢**在這個系列裡就是一個可觀察的量：價格在一段時間內是不是持續往同一個方向移動。均線把這件事變成可比較的數字，最常見的用法是拿兩條不同長度的均線比大小。

- 快線（短週期，例如 SMA(20)）反映近期，慢線（長週期，例如 SMA(60)）反映更長一段時間。
- 快線**由下往上**穿過慢線，交易圈叫**黃金交叉**（golden cross）。
- 快線**由上往下**穿過慢線，叫**死亡交叉**（death cross）。

名字取得很戲劇化，但它描述的事情很平淡：最近這段時間的平均價，剛剛超過（或跌破）更長一段時間的平均價。就這樣。

有件事要講清楚，而且會在這個系列裡重複很多次：**指標是描述，不是預測。** 黃金交叉不代表接下來會漲，它只是告訴你「短期均價剛剛越過長期均價」這個事實已經發生。由於均線本身就落後，交叉發生時價格通常已經動過一段了。在來回震盪的行情裡，兩條線會反覆交叉，產生一連串很快就反向的訊號。這不是指標壞掉，這就是低通濾波器在震盪訊號上該有的行為。

### 未來函數：本系列第一次正式警告

現在講今天最重要的一段。

`rolling(20).mean()` 在第 t 根算出來的值，**包含第 t 根的收盤價**。這件事本身完全正確，SMA 的定義就是含當根。問題不在數值，在於**這個數值什麼時候才存在**。

第 t 根的收盤價，要等這根 K 線走完才會確定。所以 `sma[t]` 這個數字，最早也是在第 t 根結束的那一瞬間才成立。

然後看你的 DataFrame。第 t 列上有 `open`、`high`、`low`、`close`、`sma_20`，它們並排在同一列。人的直覺會把「同一列」讀成「同一個時間點」，但一根 K 線是**一段時間區間**，區間有開頭也有結尾。更明確的線索在索引上：Day 02 定的慣例是索引存 `open_time`，也就是說**這一列的索引寫的是開盤時間，欄位裡裝的卻是收盤才知道的價格**。

於是很容易寫出這樣的東西：在第 t 列判斷「這裡有黃金交叉」，然後假設用第 t 列的 `open` 成交。這就是**未來函數**（look-ahead bias）：你用了第 t 根結束才知道的資訊，去做第 t 根開始時的決定。中間隔了一整根 K 線的漲跌。

用實際的數字看。下面是一段十根的 1 小時資料（為了看清楚交叉，用短一點的 SMA(3) 與 SMA(5)）：

| 時間（UTC） | close | SMA(3) | SMA(5) | golden | 最快能成交的那根 |
|---|---|---|---|---|---|
| 03:00 | 102.0 | 105.00 | NaN | False | |
| 04:00 | 100.0 | 102.33 | 105.00 | False | |
| 05:00 | 101.0 | 101.00 | 103.20 | False | |
| 06:00 | 104.0 | 101.67 | 102.40 | False | |
| 07:00 | 109.0 | 104.67 | 103.20 | **True** | |
| 08:00 | 112.0 | 108.33 | 105.20 | False | **這根** |
| 09:00 | 113.0 | 111.33 | 107.80 | False | |

交叉發生在 07:00 那一根，但你要等 07:00 收完（也就是 08:00 整）才算得出 `SMA(3) = 104.67 > SMA(5) = 103.20`。這時 07:00 那根的開盤機會早就過去了，它的開盤價大約是 06:00 的收盤價 104。你實際最快能成交的地方是 08:00 那根的開盤，大約 109。

在這個例子裡，把成交點從 08:00 挪到 07:00 的開盤，等於憑空多賺 5 塊，接近 5%。一筆單 5%，而它不會噴任何錯誤、不會有警告、圖畫出來也很正常。它唯一的症狀就是**你的歷史驗證結果變得很好看**。而且錯得越嚴重，看起來越漂亮，所以它幾乎不可能靠「結果怪怪的」被發現。

還有一個同源的錯誤，是 Day 02 提過的：**最後一根 K 線通常還沒收完**。你在 14:37 抓下來的 1 小時資料，最後一根是 14:00 的，它的 `close` 只是「目前為止」的價格，下一分鐘就會變。拿它算出來的均線是一個會自己改變的數字。做歷史驗證時要把它丟掉，實盤時要等收線確認才處理。

工程上的解法很直接：**訊號一律往後位移一根**，代表最快只能在下一根成交。等一下的實作會做這件事。到了 Day 16，這個位移會被寫進策略引擎，變成引擎的行為而不是靠每個策略自己記得，因為積木化之後策略數量會變多，靠人記得一定會漏。而 Day 19 我們會把引擎的位移**故意關掉**跑一次，讓你親眼看到報酬會誇張到什麼程度。

## 用 pandas 算 SMA

### 為什麼不要寫 for loop

先寫一個大部分人第一次會寫出來的版本：

```python
def sma_loop(df: pd.DataFrame, period: int) -> pd.Series:
    """不要這樣寫。這裡放它只是為了當對照組。"""
    values = []
    for i in range(len(df)):
        if i < period - 1:
            values.append(np.nan)
        else:
            values.append(df["close"].iloc[i - period + 1 : i + 1].mean())
    return pd.Series(values, index=df.index)
```

邏輯沒錯，跟 `rolling` 算出來的數字一致（誤差在 1e-11 以內，純粹是浮點累加順序不同）。問題是速度。拿一年份的 1 分鐘 K 線來測，也就是 525,600 根：

```python
%timeit sma_loop(df, 20)
%timeit df["close"].rolling(20).mean()
```

```
7.11 s ± 0.05 s per loop (mean ± std. dev. of 3 runs, 1 loop each)
2.18 ms ± 7 µs per loop (mean ± std. dev. of 7 runs, 100 loops each)
```

差 3200 倍。`rolling().mean()` 走的是 C 層實作的滑動視窗，只維護一個 running sum，每前進一根就加一個、減一個，總共 O(n) 次浮點運算；for loop 版本每一根都重新切一個 pandas Series 再算平均，光是建物件的成本就把時間吃光了。

3200 倍在單一指標上只是「等 7 秒還是等 2 毫秒」，還可以忍。但這個系列到 Day 21 會一次跑幾百組參數組合，那時候差別是「跑幾分鐘」跟「跑好幾個小時」。

不過速度只是第一個理由，另外兩個更重要：

**邊界條件要自己處理，而且很容易錯。** 上面那個迴圈裡的 `i - period + 1`、`i + 1`、`i < period - 1` 三個地方，每一個都是 off-by-one 的機會。`rolling` 幫你處理掉了。

**for loop 讓未來函數變得太容易發生。** 當你手上有一個 `i` 可以自由運算時，`df.iloc[i + 1]` 跟 `df.iloc[i - 1]` 打起來一樣順手，而前者就是直接讀未來。向量化的寫法沒有這個入口：`shift()` 的正負號是明確宣告的，`rolling()` 永遠只往回看。少一個能寫錯的地方，就少一種不會噴錯的錯誤。

所以這個系列的規則是：**不用 for loop 遍歷 K 線**。真的遇到不能向量化的情況（Day 05 的 EMA 就是第一個），會明確講清楚為什麼，並且給出正確的做法。

### 完整模組

`quantbot/indicators/ma.py`。這是純函式模組，不碰 I/O、不讀檔、不連資料庫，所以測試起來很單純：

```python
"""移動平均指標。純函式，不碰 I/O，方便測試與重用。"""

from __future__ import annotations

import pandas as pd

__all__ = ["IrregularIndexError", "sma", "cross_signals", "delay_to_next_bar"]


class IrregularIndexError(ValueError):
    """索引不是等間隔的完整時間網格，rolling 的視窗會涵蓋比預期更長的時間。"""


def _validate(close: pd.Series, period: int, expected_freq: str | None) -> None:
    if period < 1:
        raise ValueError(f"period must be >= 1, got {period}")
    if not isinstance(close.index, pd.DatetimeIndex):
        raise TypeError("close.index must be a DatetimeIndex")
    if not close.index.is_monotonic_increasing:
        raise ValueError("close.index must be sorted ascending")
    if expected_freq is None or len(close) == 0:
        return
    expected = pd.date_range(
        start=close.index[0], end=close.index[-1], freq=expected_freq, tz=close.index.tz
    )
    missing = expected.difference(close.index)
    if len(missing) > 0:
        raise IrregularIndexError(
            f"index has {len(missing)} missing bar(s) at {expected_freq}, "
            f"first missing: {missing[0]}"
        )


def sma(close: pd.Series, period: int, *, expected_freq: str | None = None) -> pd.Series:
    """簡單移動平均。

    Args:
        close: 收盤價序列，index 必須是排序過的 DatetimeIndex（一律 UTC）。
        period: 視窗長度，單位是「幾根 K 線」，不是時間。
        expected_freq: 給定時（例如 "1h"）會檢查索引是不是完整的等間隔網格，
            有缺漏就丟 IrregularIndexError，避免視窗悄悄涵蓋更長的時間。

    Returns:
        與 close 等長同 index 的 Series，前 period-1 個位置是 NaN。
    """
    _validate(close, period, expected_freq)
    return (
        close.rolling(window=period, min_periods=period)
        .mean()
        .rename(f"sma_{period}")
    )


def cross_signals(fast: pd.Series, slow: pd.Series) -> pd.DataFrame:
    """由兩條均線算出交叉事件。

    Returns:
        DataFrame，欄位 golden（快線由下往上穿過慢線）與 death（由上往下）。
        只有交叉發生的那一根為 True，兩邊都還是 NaN 的暖身期一律 False。
    """
    ready = fast.notna() & slow.notna()
    above = (fast > slow) & ready
    prev_above = above.shift(1, fill_value=False)
    prev_ready = ready.shift(1, fill_value=False)
    return pd.DataFrame(
        {
            "golden": above & ~prev_above & prev_ready,
            "death": ~above & prev_above & ready,
        },
        index=fast.index,
    )


def delay_to_next_bar(signal: pd.Series) -> pd.Series:
    """把「第 t 根收盤後才知道」的訊號延後一根，代表最快只能在 t+1 成交。"""
    return signal.shift(1, fill_value=False).astype(bool)
```

三個地方值得說明。

`cross_signals` 用 `above & ~prev_above` 來抓交叉，只有**狀態翻轉的那一根**是 True，而不是「快線在上面」的整段期間都是 True。這兩者的差別在寫進場條件時是關鍵：前者是事件，一次交叉觸發一次；後者是狀態，會讓你每一根都想進場。

`prev_ready` 那個條件在擋暖身期。慢線在前 59 根是 NaN，第 60 根第一次有值，如果那一根剛好快線在上面，不加這個條件就會誤判成一次交叉，但實際上沒有任何東西「穿過」了什麼。這種假訊號永遠出現在資料的最開頭，很容易被忽略。

`delay_to_next_bar` 是今天對未來函數的處理。它單獨抽成一個函式而不是散在呼叫端，是為了讓「什麼時候位移了」這件事在程式碼裡看得見。Day 16 會把它收進策略引擎。

用起來像這樣：

```python
from quantbot.indicators.ma import sma, cross_signals, delay_to_next_bar

ohlcv = pd.read_parquet("data/BTCUSDT-spot-1h.parquet")  # Day 03 的產出

fast = sma(ohlcv["close"], 20, expected_freq="1h")
slow = sma(ohlcv["close"], 60, expected_freq="1h")
crosses = cross_signals(fast, slow)

entry = delay_to_next_bar(crosses["golden"])   # 這一根可以進場
exit_ = delay_to_next_bar(crosses["death"])    # 這一根可以出場
```

（今天的簽章是 Series 進、Series 出。Day 06 寫完 RSI 之後會把三個指標的簽章統一，Day 15 再收進一套 `Feature` 介面，那時候策略引擎才能用字串把它們組起來。）

## 三個常見算錯的地方

### 一、前 n-1 根的 NaN

`rolling(20)` 的前 19 個位置是 NaN，因為視窗還沒填滿。這個 NaN 是正確的，它表達的是「這裡沒有值可以算」。

最常見的處理方式是把它填掉，而三種填法各有各的問題：

```python
sma_wrong_1 = close.rolling(20, min_periods=1).mean()  # 用手上有的算
sma_wrong_2 = close.rolling(20).mean().bfill()          # 用後面的值往前補
sma_wrong_3 = close.rolling(20).mean().fillna(close)    # 用價格本身補
```

第一種是最容易發生的，因為它看起來最合理，而且 `min_periods=1` 這個參數就長得像是為了解決這個問題而存在。它算出來的第 1 根是 SMA(1)、第 2 根是 SMA(2)，一路到第 20 根才真的是 SMA(20)。**欄位名字寫 sma_20，但前 19 個值不是 SMA(20)。** 後面拿去比大小、算交叉時，你不會知道自己在比什麼。

第二種更糟，`bfill()` 是直接把未來的值搬到前面來，這是最粗暴的未來函數。

第三種讓均線在開頭那段完全貼著價格，於是快線慢線在第一根就相等，`cross_signals` 那個 `prev_ready` 的保護也失效。

正確做法是**留著 NaN，然後在下游明確處理它**：

- 指標函式回傳原樣的 NaN，不做任何填補。這是 `sma()` 的行為。
- 需要訊號的地方用布林運算把 NaN 自然吃掉，`NaN > 5` 會得到 `False`，這正是你要的（`cross_signals` 裡的 `ready` 就是在做這件事）。
- 真的要拿去做統計時，明確把暖身期切掉：`result.loc[result.notna().idxmax():]`。

推論一下就知道暖身期要多長：用 SMA(60) 的策略，前 59 根不能用；如果同時還用了 Day 06 的 RSI(14)，暖身期取兩者的最大值。這件事在 Day 16 會由條件樹自動算出來，今天先知道它存在。

### 二、資料有缺漏，視窗就不是你以為的長度

這是 Day 02 到 Day 03 的資料品質問題的延伸，也是三個裡面最安靜的一個。

`rolling(24)` 數的是**列數**，不是時間。如果你的 1 小時資料中間掉了 3 根（交易所維護、下載時漏了一段、或者回補管線有洞），那 24 列涵蓋的實際時間就變成 26 小時，而 pandas 不會有任何意見：

```python
full_index = pd.date_range("2026-03-01", periods=30, freq="1h", tz="UTC")
close = pd.Series(np.arange(100, 130, dtype=float), index=full_index)

with_gap = close.drop(full_index[10:13])       # 拿掉 3 根

print(close.rolling(24).mean().iloc[-1])        # 117.5
print(with_gap.rolling(24).mean().iloc[-1])     # 116.625
print(with_gap.index[-1] - with_gap.index[-24]) # 1 days 02:00:00
```

宣稱 24 小時的視窗，實際涵蓋 26 小時，末值差了 0.875。在這個線性的假資料上差異看起來很小，但真實的行情裡，缺漏往往發生在**行情最劇烈的時候**，因為那正是交易所最容易出狀況的時候。也就是說，缺掉的那幾根通常不是無關緊要的幾根。

更麻煩的是這個錯誤會傳染。均線算錯了，交叉的位置就跟著偏，訊號的時間點就跟著偏，而你從頭到尾不會收到任何錯誤訊息。Day 08 那句「一根缺漏的 K 線可能讓你的均線算錯十天」講的就是這件事。

有三種處理方式，按推薦順序：

**一、在指標裡驗證索引，有洞就直接失敗。** 這是 `sma()` 的 `expected_freq` 參數在做的事。指標算不出正確結果時應該拒絕回傳，而不是回傳一個看起來正常的錯數字。Day 08 的管線會保證入庫的資料沒有缺漏，這個檢查到那時候就變成安全網。

**二、先把索引補成完整網格，缺的那幾根留 NaN。**

```python
complete = with_gap.reindex(full_index)   # 缺的位置變成 NaN
result = complete.rolling(24, min_periods=24).mean()
```

這樣視窗涵蓋的時間就對了，而且缺漏的位置會讓對應的 24 個視窗全部變成 NaN，等於明確告訴你「這段期間的均線不可信」。不要在這裡對價格做插值補值，補出來的價格是你自己編的，它會讓下游以為那段時間有資料。

**三、改用時間視窗。**

```python
result = close.rolling("24h").mean()
```

`rolling` 傳字串時數的是時間而不是列數，所以缺漏不會讓視窗變長。代價是每個視窗裡的樣本數不固定，缺了 3 根的那些視窗是用 21 個值算平均，權重就跟其他視窗不一樣了。這個選項適合資料本來就不等間隔的場合（Day 09 的逐筆成交就是），拿來處理應該等間隔卻有洞的 K 線，是把問題蓋掉而不是解決。

### 三、未來函數

原理前面講完了，這裡收一下工程上的檢查清單。這四條之後每次寫訊號都適用：

1. **訊號到成交之間至少隔一根。** 用 `delay_to_next_bar()`，或等 Day 16 之後交給引擎。
2. **只要出現 `shift(-1)`、`bfill()`、`interpolate(method="time", limit_direction="both")`，先停下來想一遍。** 這三個都會把後面的值搬到前面。真的需要（例如算「未來 N 根的報酬」來檢驗特徵有沒有預測力，Day 10 會做）時，那個欄位一定只能當標籤用，NEVER 進到訊號裡。
3. **標準化與統計量只能用滾動視窗，不能用整段資料。** `(close - close.mean()) / close.std()` 用到了整段歷史的平均與標準差，包含未來。要用 `close.rolling(n).mean()` 這種只往回看的版本。Day 12 做活躍度 z-score 時會再提一次。
4. **丟掉最後一根還沒收完的 K 線。**

第 2 條可以做成 lint 規則，第 1 條和第 4 條可以寫成測試。第 3 條目前只能靠 review，因為 `mean()` 本身沒有錯，錯的是套用範圍。

## 怎麼證明你算的是對的

自己實作的每一個指標都要有對照組。這是這個系列跟其他指標教學最大的差別，也是唯一能確認「算出來的東西是不是 SMA」的方法。

### 跟 pandas-ta 對數字，以及對照組的一個陷阱

```python
import pandas_ta as ta

from quantbot.indicators.ma import sma

reference = ta.sma(ohlcv["close"], length=20)
mine = sma(ohlcv["close"], 20)

diff = (mine - reference).abs()
rel = (diff / reference.abs()).max()
print(f"max abs diff: {diff.max():.3e}")
print(f"max rel diff: {rel:.3e}")
assert mine.isna().equals(reference.isna())   # NaN 的位置也要一致
```

跑出來你會看到誤差是 `0.000e+00`，完全相同。

先別高興。這個結果其實暴露了一件事：**`pandas-ta` 的 `sma()` 在沒有 TA-Lib 的環境下，底層就是 `close.rolling(length, min_periods=length).mean()`，跟你寫的是同一行。** 誤差為 0 是因為你們在跑同一段程式碼，這個對照只驗證了「你有沒有把參數傳錯」，沒有驗證演算法。

要讓對照組真的有意義，得讓它走一條**獨立實作**的路徑。`pandas-ta` 在偵測到 TA-Lib 時會預設改用 TA-Lib 的實作，而 TA-Lib 的 SMA 是增量式的 running sum（加新的、減舊的），跟 pandas 用的補償求和不是同一套演算法。這時候誤差就不會是 0 了。在一年份 1 分鐘、價格量級 6 萬的 BTC/USDT 現貨資料上，兩者的差距是：

| 對照對象 | 最大絕對誤差 | 最大相對誤差 |
|---|---|---|
| pandas-ta 純 pandas 路徑（`talib=False`） | 0 | 0 |
| TA-Lib 的增量 running sum | 1.1e-06 | 1.6e-11 |

1.1e-06 看起來比 0 差，但那是浮點累加誤差，不是演算法錯誤。相對誤差 1.6e-11 遠低於任何有意義的價格精度（BTC 的最小報價單位是 0.01，比它大五個數量級）。

所以驗收門檻要訂在相對誤差上，不是絕對誤差：

```python
def test_sma_matches_reference_implementation(ohlcv):
    reference = ta.sma(ohlcv["close"], length=20)
    mine = sma(ohlcv["close"], 20)
    pd.testing.assert_series_equal(
        mine, reference, check_names=False, rtol=1e-9, atol=0
    )
```

`rtol=1e-9`，`atol=0`。用相對容差是因為 BTC 在 6 萬跟某個小幣在 0.0001 的合理絕對誤差差了八個數量級，訂絕對值會兩邊都不對。

這個「對照組其實跟你跑同一段程式碼」的情況，在 SMA 上只是浪費一個測試，但到了 Day 06 的 RSI 就會變成實質問題：`pandas-ta` 有些指標的純 pandas 實作跟 TA-Lib 版本**數值本來就不一樣**（Wilder 平滑的初始值取法不同），那時候你得先決定自己要對齊哪一邊。所以現在就養成習慣：**用對照組之前，先確認它跟你不是同一份程式碼。**

### 邊界測試

對照組驗證「一般情況算得對」，單元測試驗證「不一般的情況不會安靜地給出錯的答案」。`tests/test_ma.py`：

```python
import numpy as np
import pandas as pd
import pytest

from quantbot.indicators.ma import (
    IrregularIndexError,
    cross_signals,
    delay_to_next_bar,
    sma,
)


def make_series(values: list[float], freq: str = "1h") -> pd.Series:
    index = pd.date_range("2026-01-01", periods=len(values), freq=freq, tz="UTC")
    return pd.Series(values, index=index, name="close")


def test_sma_matches_hand_computed_values():
    close = make_series([1, 2, 3, 4, 5])
    result = sma(close, period=3)
    assert result.iloc[:2].isna().all()
    assert result.iloc[2] == pytest.approx(2.0)
    assert result.iloc[4] == pytest.approx(4.0)


def test_warmup_stays_nan_and_is_not_filled():
    close = make_series([10, 20, 30, 40])
    assert sma(close, period=3).isna().sum() == 2


def test_insufficient_data_returns_all_nan():
    """資料比視窗短：回傳等長的全 NaN，不是丟例外，也不是回傳短序列。"""
    close = make_series([100, 101, 102])
    result = sma(close, period=20)
    assert len(result) == 3
    assert result.isna().all()


def test_single_bar():
    close = make_series([42.0])
    assert sma(close, period=20).isna().all()
    assert sma(close, period=1).iloc[0] == pytest.approx(42.0)


def test_empty_series():
    assert sma(make_series([]), period=20).empty


def test_missing_bars_raise_when_freq_declared():
    close = make_series([1, 2, 3, 4, 5])
    with_gap = close.drop(close.index[2])
    with pytest.raises(IrregularIndexError):
        sma(with_gap, period=3, expected_freq="1h")


def test_missing_bars_silently_widen_window_without_check():
    """沒宣告 expected_freq 時，缺漏會安靜地讓視窗變長。這個測試把行為釘住。"""
    close = make_series([1, 2, 3, 4, 5])
    with_gap = close.drop(close.index[2])
    assert sma(with_gap, period=3).iloc[2] == pytest.approx((1 + 2 + 4) / 3)


def test_invalid_period():
    with pytest.raises(ValueError):
        sma(make_series([1, 2, 3]), period=0)


def test_unsorted_index_rejected():
    close = make_series([1, 2, 3])
    with pytest.raises(ValueError):
        sma(close.iloc[::-1], period=2)


def test_cross_signals_fire_once_on_the_crossing_bar():
    fast = make_series([1, 2, 3, 4, 3, 2])
    slow = make_series([3, 3, 3, 3, 3, 3])
    crosses = cross_signals(fast, slow)
    assert crosses["golden"].tolist() == [False, False, False, True, False, False]
    assert crosses["death"].tolist() == [False, False, False, False, True, False]


def test_cross_signals_ignore_warmup_nan():
    """慢線第一次有值的那一根，即使快線在上面也不算交叉。"""
    fast = make_series([np.nan, np.nan, 5, 6])
    slow = make_series([np.nan, np.nan, 4, 4])
    assert not cross_signals(fast, slow)["golden"].iloc[2]


def test_delay_to_next_bar_shifts_by_one():
    signal = make_series([0, 1, 0, 1]).astype(bool)
    assert delay_to_next_bar(signal).tolist() == [False, False, True, False]
```

`test_missing_bars_silently_widen_window_without_check` 那一條值得多說一句。它測的是一個**不理想的行為**，但把它釘進測試裡是有價值的：這個行為是 pandas 的預設語意，改不掉，所以要嘛你顯式宣告 `expected_freq` 讓它報錯，要嘛你就是接受它。測試寫在這裡，未來有人以為「rolling 應該會自動處理缺漏」時，一跑測試就知道不會。

## 視覺化：把交叉標在圖上

數字對了不代表邏輯對了。交叉點標在圖上肉眼掃一遍，能抓到單元測試抓不到的東西，例如訊號整段偏移一根、或者暖身期冒出了不該有的標記。

```python
from __future__ import annotations

import pandas as pd
import plotly.graph_objects as go

from quantbot.indicators.ma import cross_signals, sma


def plot_sma_crosses(
    ohlcv: pd.DataFrame, fast_period: int = 20, slow_period: int = 60
) -> go.Figure:
    """K 線疊上兩條 SMA，並把黃金交叉與死亡交叉標在快線上。"""
    fast = sma(ohlcv["close"], fast_period)
    slow = sma(ohlcv["close"], slow_period)
    crosses = cross_signals(fast, slow)

    fig = go.Figure()
    fig.add_trace(
        go.Candlestick(
            x=ohlcv.index,
            open=ohlcv["open"],
            high=ohlcv["high"],
            low=ohlcv["low"],
            close=ohlcv["close"],
            name="BTC/USDT 現貨 1h",
            increasing_line_color="#26a69a",
            decreasing_line_color="#ef5350",
        )
    )

    for series, name, color in (
        (fast, f"SMA({fast_period})", "#f4a261"),
        (slow, f"SMA({slow_period})", "#4c6ef5"),
    ):
        fig.add_trace(
            go.Scatter(
                x=series.index, y=series, name=name,
                mode="lines", line=dict(width=1.6, color=color),
            )
        )

    for flag, name, symbol, color in (
        ("golden", "黃金交叉", "triangle-up", "#2f9e44"),
        ("death", "死亡交叉", "triangle-down", "#c92a2a"),
    ):
        hit = crosses[flag]
        fig.add_trace(
            go.Scatter(
                x=fast.index[hit], y=fast[hit], name=name, mode="markers",
                marker=dict(
                    symbol=symbol, size=12, color=color,
                    line=dict(width=1, color="white"),
                ),
            )
        )

    fig.update_layout(
        title=f"BTC/USDT 現貨 1h：SMA({fast_period}) 與 SMA({slow_period}) 交叉",
        xaxis_title="時間（UTC）",
        yaxis_title="價格（USDT）",
        xaxis_rangeslider_visible=False,
        height=620,
        hovermode="x unified",
    )
    return fig


fig = plot_sma_crosses(ohlcv)
fig.write_html("notebooks/day04_sma_crosses.html")
```

幾個刻意的選擇：

- 標記畫在**快線上**而不是價格上。交叉是兩條線的事件，標在快線上位置才對得起來；標在 K 線的高低點會讓人以為訊號跟那根 K 線的極值有關。
- `xaxis_rangeslider_visible=False`。Plotly 的 K 線圖預設帶一條範圍滑桿，會佔掉三分之一的高度，而你可以直接在圖上拉方框縮放。
- 軸標題寫清楚「時間（UTC）」跟「價格（USDT）」。時區不寫出來，你自己三個月後也會懷疑。

畫出來之後，用互動縮放做三件檢查：

1. **拉到資料最開頭。** 前 59 根應該只有 K 線、沒有慢線，而且**不應該有任何交叉標記**。有的話就是 `prev_ready` 那個保護沒生效。
2. **隨便挑一個標記放大。** 確認標記那一根的前一根，快慢線的上下關係確實是反過來的。這是驗證「事件」而不是「狀態」。
3. **看震盪的那幾段。** 你會看到標記密集地成對出現，一個黃金交叉後面很快跟一個死亡交叉。這是均線交叉在震盪行情裡本來就會有的行為，看到它才表示你的圖是對的。

## 今日交付物

`quantbot/indicators/ma.py` 與 `tests/test_ma.py`，再加上一份畫出交叉圖的 notebook。

驗收標準，五項全過才算完成：

1. `uv run pytest tests/test_ma.py -q` 全綠，且包含這四個邊界案例：資料少於視窗長度、只有一根 K 線、空序列、索引有缺漏。
2. 跟 `pandas-ta` 的對照測試通過，`rtol=1e-9`、`atol=0`，並且 NaN 的位置完全一致。如果你的環境沒有 TA-Lib，在測試裡加一句註解說明這個對照走的是同一條 pandas 路徑，等 Day 06 再補上真正獨立的對照。
3. `sma(close, 20, expected_freq="1h")` 餵一份缺了幾根的資料會丟 `IrregularIndexError`，而不是回傳一個看起來正常的數字。
4. `notebooks/day04_sma.ipynb` 產出的圖，前 59 根沒有任何交叉標記，且每個標記的前一根快慢線關係確實相反。
5. 把 `delay_to_next_bar()` 前後的訊號序列並排印出來，確認整條往後位移了剛好一根。這一項現在看起來像多餘的檢查，Day 19 你會很慶幸自己做過。

順帶記一件事在 README 或註解裡：**今天所有的數字都來自 Day 03 存下來的 BTC/USDT 現貨 1 小時 parquet，源頭是 `data.binance.vision` 的批次檔加上 REST 補的最後幾天。** 這個系列到最後會有三條擷取路徑跟兩個對照組，等到某天發現一個數字不合理時，「這張表是誰給的」是你要問的第一個問題。

本系列為程式與資料工程的技術分享，所有策略與數字皆為教學範例，不構成投資建議；加密貨幣波動劇烈，實際交易請自行評估風險。

## 明天

SMA 給每一根同樣的權重，所以三十天前的價格跟昨天的價格對今天的均線影響一樣大。這件事在急跌的時候特別明顯：價格已經跌了 5%，SMA(20) 還在慢慢往下彎，因為它有 19 根舊資料在拉住它。前面算過，那個延遲大約是 `(n-1)/2` 根。

明天 Day 05 我們換上 EMA，讓近期的資料有更高的權重。同時會遇到這個系列第一個**不能直接向量化**的指標：EMA 的第 t 個值依賴第 t-1 個值，是遞迴的。我們會先看 `ewm()` 怎麼一行解決，再拆開講 `adjust=True` 跟 `adjust=False` 算出來的數字為什麼不一樣、交易上該用哪一個，以及 EMA 為什麼沒有真正的起始點。順帶留一個效能上的尾巴，Day 26 用 Numba 來收。
