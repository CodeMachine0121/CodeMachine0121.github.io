---
title: "Day 04：均線到底在均什麼？MA 與 SMA 的向量化實作與三個常見算錯的地方"
datetime: "2026-09-18"
description: "SMA 只有一行 rolling().mean()，但算錯的方式有三種：暖身期的 NaN 被填掉、資料缺漏讓視窗悄悄變長、以及用當根收盤價假設當根開盤成交。這篇把三個都拆開講，附 for loop 與向量化差 3000 倍的實測、跟 pandas-ta 的誤差對照，以及會標出交叉點的 Plotly 圖。"
image: ""
parent: "2026 ithome-鐵人賽: 工程師的量化交易入門：從 K 線到可組合的交易策略引擎 系列"
draft: false
---

## 資料有了，接下來要從裡面算出東西

昨天 Day 03 把回補管線寫好了：`BackfillCandlesApplication` 會決定哪段走 `data.binance.vision` 的批次 zip、哪段走 REST 補洞，中斷了還能重跑，最後交出一個 `CandleSeries`。今天開始用它產出的資料。以下所有範例都吃同一張表：BTC/USDT **現貨**、1 小時 K 線，來源是 Day 03 存下來的 parquet，索引是 UTC 的 `DatetimeIndex`，值是 `open_time`（每根 K 線的開盤時間，這是 Day 02 定下來的慣例，等一下會很重要）。

把這張表畫成圖，看到的是價格上上下下。第一個想問的問題大概是「現在是往上還是往下」，而這個問題沒辦法直接從 `close` 那一欄看出來，因為每一根都在跳。移動平均就是回答這個問題最基本的工具，也是接下來三天（Day 04 的 SMA、Day 05 的 EMA、Day 06 的 RSI）裡最單純的一個。

單純到什麼程度？核心是一行 pandas。`rolling(20)` 開一個滑動視窗，每前進一根就往回取最近 20 根，`.mean()` 對視窗裡的值取平均：

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

所以視窗長度不是「調得越大越準」的參數，它是一個取捨：n 越大越平滑、雜訊越少，但看到轉折的時間也越晚。SMA(200) 在 1 小時線上大約落後 100 小時，也就是四天。

那該選幾？20、60、200 是慣例，來源是股市的月、季、年交易日數的近似，跟加密貨幣 24/7 的節奏其實對不太起來。它們之所以還是被廣泛使用，很大一部分原因是很多人在看同樣的線。實際挑長度的依據應該是兩件事：想濾掉多長的雜訊，以及能忍受多少延遲。

這裡先擋一個念頭：現在**不要**去掃 5 到 200 每個長度都試一遍，挑歷史表現最好的那個。那樣做為什麼會出事、以及正確的做法是什麼，Day 21 整篇在講。今天先選 20 跟 60，因為要示範兩條線的交叉。

### 趨勢，以及黃金交叉與死亡交叉

**趨勢**在這個系列裡就是一個可觀察的量：價格在一段時間內是不是持續往同一個方向移動。均線把這件事變成可比較的數字，最常見的用法是拿兩條不同長度的均線比大小。

- 快線（短週期，例如 SMA(20)）反映近期，慢線（長週期，例如 SMA(60)）反映更長一段時間。
- 快線**由下往上**穿過慢線，交易圈叫**黃金交叉**（golden cross）。
- 快線**由上往下**穿過慢線，叫**死亡交叉**（death cross）。

名字取得很戲劇化，但它描述的事情很平淡：最近這段時間的平均價，剛剛超過（或跌破）更長一段時間的平均價。就這樣。

有件事要講清楚，而且會在這個系列裡重複很多次：**指標是描述，不是預測。** 黃金交叉不代表接下來會漲，它只是陳述「短期均價剛剛越過長期均價」這個事實已經發生。由於均線本身就落後，交叉發生時價格通常已經動過一段了。在來回震盪的行情裡，兩條線會反覆交叉，產生一連串很快就反向的訊號。這不是指標壞掉，這就是低通濾波器在震盪訊號上該有的行為。

## 訊號什麼時候才存在：未來函數

前面講的落後是低通濾波器的性質，換什麼參數都躲不掉。接下來這件事不一樣，它是我們自己寫出來的錯誤。

回頭看前面那條 SMA 的公式，最後一項是 `close[t]`，也就是第 t 根**自己的收盤價**。這件事本身完全正確，SMA 的定義就是含當根。問題不在數值，在於**這個數值什麼時候才存在**：第 t 根的收盤價要等這根 K 線走完才會確定，所以 `sma[t]` 這個數字，最早也是在第 t 根結束的那一瞬間才成立。

然後看算完之後的表。第 t 列上有 `open`、`high`、`low`、`close`、`sma_20`，它們並排在同一列。人的直覺會把「同一列」讀成「同一個時間點」，但一根 K 線是**一段時間區間**，區間有開頭也有結尾。更明確的線索在索引上：Day 02 定的慣例是索引存 `open_time`，也就是說**這一列的索引寫的是開盤時間，欄位裡裝的卻是收盤才知道的價格**。

於是很容易寫出這樣的東西：在第 t 列判斷「這裡有黃金交叉」，然後假設用第 t 列的 `open` 成交。這就是**未來函數**（look-ahead bias）：用了第 t 根結束才知道的資訊，去做第 t 根開始時的決定。中間隔了一整根 K 線的漲跌。

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

交叉發生在 07:00 那一根，但要等 07:00 收完（也就是 08:00 整）才算得出 `SMA(3) = 104.67 > SMA(5) = 103.20`。這時 07:00 那根的開盤機會早就過去了，它的開盤價大約是 06:00 的收盤價 104。實際最快能成交的地方是 08:00 那根的開盤，大約 109。

在這個例子裡，把成交點從 08:00 挪到 07:00 的開盤，等於憑空多賺 5 塊，接近 5%。一筆單 5%，而它不會噴任何錯誤、不會有警告、圖畫出來也很正常。它唯一的症狀就是**歷史驗證結果變得很好看**。而且錯得越嚴重，看起來越漂亮，所以它幾乎不可能靠「結果怪怪的」被發現。

還有一個同源的錯誤，是 Day 02 提過的：**最後一根 K 線通常還沒收完**。在 14:37 抓下來的 1 小時資料，最後一根是 14:00 的，它的 `close` 只是「目前為止」的價格，下一分鐘就會變。拿它算出來的均線是一個會自己改變的數字。做歷史驗證時要把它丟掉，實盤時要等收線確認才處理。

工程上的解法很直接：**訊號一律往後位移一根**，代表最快只能在下一根成交。等一下實作的 `CrossoverSignals` 會用兩個屬性把這件事做進型別裡，讀哪一個屬性就決定了拿到的是「事件發生的那一根」還是「能下單的那一根」。到了 Day 16，這個位移會被寫進策略引擎，變成引擎的行為而不是靠每個策略自己記得，因為積木化之後策略數量會變多，靠人記得一定會漏。而 Day 19 我們會把引擎的位移**故意關掉**跑一次，看報酬會誇張到什麼程度。

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

**邊界條件要自己處理，而且很容易錯。** 上面那個迴圈裡的 `i - period + 1`、`i + 1`、`i < period - 1` 三個地方，每一個都是 off-by-one 的機會。`rolling` 把它們處理掉了。

**for loop 讓未來函數變得太容易發生。** 手上有一個 `i` 可以自由運算時，`df.iloc[i + 1]` 跟 `df.iloc[i - 1]` 打起來一樣順手，而前者就是直接讀未來。向量化的寫法沒有這個入口：`shift()` 的正負號是明確宣告的，`rolling()` 永遠只往回看。少一個能寫錯的地方，就少一種不會噴錯的錯誤。

所以這個系列的規則是：**不用 for loop 遍歷 K 線**。真的遇到不能向量化的情況（Day 05 的 EMA 就是第一個），會明確講清楚為什麼，並且給出正確的做法。

### 指標住在 domain

指標是純計算：它不碰網路、不讀檔、不知道資料是從批次檔還是 REST 來的。所以它屬於 domain，跟 Day 03 的值物件與 service 同一層。

```
quantbot/domain/indicators/
├── indicator.py                 Indicator（抽象基底）
├── irregular_index_error.py     IrregularIndexError
├── sma.py                       SMA
└── crossover_signals.py         CrossoverSignals
```

先訂契約。Day 03 的對外相依用的是 `Protocol`，這裡不一樣——指標是**一個家族**，它們有共用的骨架要給子類別，所以用 `abc.ABC`：

```python
# quantbot/domain/indicators/indicator.py
from __future__ import annotations

from abc import ABC, abstractmethod

import pandas as pd

from quantbot.domain.entities.candle_series import CandleSeries


class Indicator(ABC):
    """所有指標的共同基底。

    這裡用 ABC 而不是 Protocol，因為它有共用實作要給子類別：契約的前四條由
    compute() 擔保，子類別只實作 name 與 _compute 兩件事。對外相依才用 Protocol。
    """

    def __init__(self, period: int, *, column: str = "close") -> None:
        if period < 1:
            raise ValueError(f"period 必須 >= 1，收到 {period}")
        self.period = period
        self.column = column

    @property
    @abstractmethod
    def name(self) -> str:
        """輸出 Series 的名字，慣例是 {indicator}_{period}。"""

    @abstractmethod
    def _compute(self, values: pd.Series) -> pd.Series:
        """真正的計算。拿到的是已經轉好型別的單欄序列。"""

    @property
    def warmup_bar_count(self) -> int:
        """暖機期幾根。SMA 覆寫成 period - 1，EMA 與 RSI 用這個預設值。"""
        return self.period

    def compute(self, series: CandleSeries) -> pd.Series:
        """算出指標，回傳與輸入等長、index 完全相同的 Series。

        這裡不檢查「index 有沒有排序」：CandleSeries 建構時就排好了，
        不變式一旦放進型別，下游的防禦性檢查就是死碼。
        """
        candles = series.frame
        if self.column not in candles.columns:
            raise KeyError(f"沒有 {self.column!r} 欄：{list(candles.columns)}")

        # astype 會複製，所以 _compute 怎麼寫都動不到呼叫端的資料
        values = candles[self.column].astype("float64")
        return self._compute(values).reindex(candles.index).rename(self.name)
```

契約有六條，前四條現在是程式碼而不是註解：

1. **吃 `CandleSeries`，不吃裸 DataFrame。** 今天只用到收盤價一欄，看起來吃 Series 更精簡。但第二階段的特徵有的要 high、low、close、volume 四欄一起算，有的要吃掛單簿的欄位。介面今天訂死，那時候才不用回頭改十幾個呼叫點。取哪一欄由建構參數 `column` 決定。
2. **回傳 Series，index 與輸入完全相同。** `compute()` 最後那句 `reindex(candles.index)` 就是這條。子類別在 `_compute` 裡不小心 `dropna()` 了也救得回來，因為缺掉的位置會補成 NaN 而不是讓序列變短。
3. **暖機期一律 NaN，長度可預測。** `warmup_bar_count` 是屬性，SMA 覆寫成 `period - 1`，之後的 EMA 與 RSI 用預設的 `period`。Day 15 的 pipeline 靠它算整條特徵管線的 warm-up。
4. **命名慣例 `{indicator}_{period}`。** `name` 是抽象屬性，不實作就建不出子類別；`compute()` 最後一定會把它貼上去，不會有指標忘記命名。
5. **NEVER 修改輸入。** `astype("float64")` 會複製一份，所以 `_compute` 裡怎麼改都影響不到呼叫端。
6. **NEVER 用到第 t 根之後的資料。** 前面講的未來函數，在這幾個指標裡靠 `rolling()`、`ewm()`、`diff()` 的預設語意自然成立，但每加一個新指標都要重新確認一次。這一條沒辦法交給基底類別擔保，只能靠 review 與測試。

`Protocol` 與 `ABC` 的分工，到這裡就完整了：**對外相依用 Protocol（實作不 import 抽象），同一家族的共用骨架用 ABC（子類別繼承它）。** 兩者 NEVER 混用。

然後是今天的主角：

```python
from __future__ import annotations

from quantbot.domain.indicators.indicator import Indicator
from quantbot.domain.indicators.irregular_index_error import IrregularIndexError

import pandas as pd


# quantbot/domain/indicators/irregular_index_error.py
class IrregularIndexError(ValueError):
    """索引不是等間隔的完整時間網格，rolling 的視窗會涵蓋比預期更長的時間。"""


# quantbot/domain/indicators/sma.py
class SMA(Indicator):
    """簡單移動平均。

    一個實例代表一條特定的均線：視窗長度與索引檢查在建構時就固定。
    視窗長度的單位是「幾根 K 線」，不是時間——這個區別是第二個常見錯誤的來源。
    """

    def __init__(
        self,
        period: int,
        *,
        column: str = "close",
        expected_timeframe: Timeframe | None = None,
    ) -> None:
        super().__init__(period, column=column)
        # 給定時會檢查索引是不是完整的等間隔網格，避免視窗悄悄涵蓋更長的時間
        self.expected_timeframe = expected_timeframe

    @property
    def name(self) -> str:
        return f"sma_{self.period}"

    @property
    def warmup_bar_count(self) -> int:
        return self.period - 1   # 只有 SMA 是 n-1

    def _compute(self, values: pd.Series) -> pd.Series:
        self._check_grid(values)
        return values.rolling(window=self.period, min_periods=self.period).mean()

    def _check_grid(self, values: pd.Series) -> None:
        """宣告了 expected_timeframe 就確認網格完整，有洞直接失敗。

        指標算不出正確結果時應該拒絕回傳，而不是回傳一個看起來正常的錯數字。
        """
        if self.expected_timeframe is None or values.empty:
            return
        if not isinstance(values.index, pd.DatetimeIndex):
            raise TypeError("expected_timeframe 需要 DatetimeIndex")

        expected = pd.date_range(
            start=values.index[0],
            end=values.index[-1],
            freq=self.expected_timeframe.pandas_frequency,
            tz=values.index.tz,
        )
        missing = expected.difference(values.index)
        if len(missing) > 0:
            raise IrregularIndexError(
                f"{self.expected_timeframe} 的網格缺了 {len(missing)} 根，"
                f"第一個缺漏在 {missing[0]}"
            )
```

`expected_timeframe` 是**建構參數**而不是每次呼叫傳一次的引數：一條均線該不該檢查網格，是這條均線的性質，不該由每個呼叫端各自決定。指標算不出正確結果時應該拒絕回傳，而不是回傳一個看起來正常的錯數字。Day 08 的管線會保證入庫的資料沒有缺漏，這個檢查到那時候就變成安全網。

交叉事件是另一件事，所以是另一個類別。注意它**不是** `Indicator` 的子類別——它吃的是兩條算好的線，不是 K 線：

```python
# quantbot/domain/indicators/crossover_signals.py
from __future__ import annotations

import pandas as pd


class CrossoverSignals:
    """兩條均線的交叉事件，以及最快能成交的那一根。

    建構時就把事件算完，golden 與 death 是屬性。位移也放在這裡，因為
    「訊號怎麼算出來」與「訊號什麼時候才能用」是同一件事的兩面，拆開放
    就會有人只記得前者。

    它不是 Indicator：它吃的是兩條算好的線，不是 K 線，所以沒有繼承那個基底。
    """

    def __init__(self, fast: pd.Series, slow: pd.Series) -> None:
        ready = fast.notna() & slow.notna()
        above = (fast > slow) & ready
        previously_above = above.shift(1, fill_value=False)
        previously_ready = ready.shift(1, fill_value=False)

        # 只有狀態翻轉的那一根是 True，暖機期一律 False
        self.golden = (above & ~previously_above & previously_ready).rename("golden")
        self.death = (~above & previously_above & ready).rename("death")

    @property
    def table(self) -> pd.DataFrame:
        """兩個訊號並排，方便印出來核對或落地。"""
        return pd.concat([self.golden, self.death], axis=1)

    @property
    def entry(self) -> pd.Series:
        """黃金交叉延後一根：最快只能在下一根成交。"""
        return self.delay_to_next_bar(self.golden)

    @property
    def exit(self) -> pd.Series:
        """死亡交叉延後一根。"""
        return self.delay_to_next_bar(self.death)

    @staticmethod
    def delay_to_next_bar(signal: pd.Series) -> pd.Series:
        """把「第 t 根收盤後才知道」的訊號延後一根，代表最快在 t+1 成交。"""
        return signal.shift(1, fill_value=False).astype(bool)
```

三個地方值得說明。

`CrossoverSignals` 用 `above & ~previously_above` 來抓交叉，只有**狀態翻轉的那一根**是 True，而不是「快線在上面」的整段期間都是 True。這兩者的差別在寫進場條件時是關鍵：前者是事件，一次交叉觸發一次；後者是狀態，會讓每一根都想進場。

`previously_ready` 那個條件在擋暖身期。慢線在前 59 根是 NaN，第 60 根第一次有值，如果那一根剛好快線在上面，不加這個條件就會誤判成一次交叉，但實際上沒有任何東西「穿過」了什麼。這種假訊號永遠出現在資料的最開頭，很容易被忽略。

`entry` 與 `exit` 是今天對未來函數的處理。把位移做成類別的屬性、而不是散在呼叫端的一行 `shift`，是為了讓「什麼時候位移了」在程式碼裡看得見：讀 `crosses.golden` 拿到的是原始事件，讀 `crosses.entry` 拿到的是能下單的時間點，名字就把差別講完了。Day 16 會把這個位移收進策略引擎。

用起來像這樣：

```python
import pandas as pd

from quantbot.domain.entities.candle_series import CandleSeries
from quantbot.domain.indicators.crossover_signals import CrossoverSignals
from quantbot.domain.indicators.sma import SMA
from quantbot.domain.values.instrument import Instrument
from quantbot.domain.values.market import Market
from quantbot.domain.values.timeframe import Timeframe

instrument = Instrument(
    symbol="BTC/USDT", market=Market.SPOT, timeframe=Timeframe("1h")
)
# Day 03 的產出。之後 Day 07 入庫後，這一行會換成 CandleRepository.read()
series = CandleSeries(
    instrument, pd.read_parquet("data/klines/spot_BTCUSDT_1h.parquet")
)

fast = SMA(20, expected_timeframe=instrument.timeframe)
slow = SMA(60, expected_timeframe=instrument.timeframe)
crosses = CrossoverSignals(fast.compute(series), slow.compute(series))

entry_bars = crosses.entry   # 這幾根可以進場
exit_bars = crosses.exit     # 這幾根可以出場
```

那句 `CandleSeries(instrument, pd.read_parquet(...))` 現在看起來多包了一層，Day 07 之後它會換成 `await repository.read(instrument, period)`，而下面的四行完全不用改——這就是把「一段 K 線」做成型別的回報。

## 三個常見算錯的地方

### 一、前 n-1 根的 NaN

`rolling(20)` 的前 19 個位置是 NaN，因為視窗還沒填滿。這個 NaN 是正確的，它表達的是「這裡沒有值可以算」。

最常見的處理方式是把它填掉，而三種填法各有各的問題：

```python
sma_wrong_1 = close.rolling(20, min_periods=1).mean()  # 用手上有的算
sma_wrong_2 = close.rolling(20).mean().bfill()          # 用後面的值往前補
sma_wrong_3 = close.rolling(20).mean().fillna(close)    # 用價格本身補
```

第一種是最容易發生的，因為它看起來最合理，而且 `min_periods=1` 這個參數就長得像是為了解決這個問題而存在。它算出來的第 1 根是 SMA(1)、第 2 根是 SMA(2)，一路到第 20 根才真的是 SMA(20)。**欄位名字寫 sma_20，但前 19 個值不是 SMA(20)。** 後面拿去比大小、算交叉時，比的到底是什麼就講不清楚了。

第二種更糟，`bfill()` 是直接把未來的值搬到前面來，這是最粗暴的未來函數。

第三種讓均線在開頭那段完全貼著價格，於是快線慢線在第一根就相等，`CrossoverSignals` 那個 `previously_ready` 的保護也失效。

正確做法是**留著 NaN，然後在下游明確處理它**：

- 指標回傳原樣的 NaN，不做任何填補。這是 `Indicator.compute()` 的契約第三條。
- 需要訊號的地方用布林運算把 NaN 自然吃掉，`NaN > 5` 會得到 `False`，這正是要的結果（`CrossoverSignals` 裡的 `ready` 就是在做這件事）。
- 真的要拿去做統計時，明確把暖身期切掉：`result.loc[result.notna().idxmax():]`。

推論一下就知道暖身期要多長：用 SMA(60) 的策略，前 59 根不能用；如果同時還用了 Day 06 的 RSI(14)，暖身期取兩者的最大值。這件事在 Day 16 會由條件樹自動算出來，今天先知道它存在。

### 二、資料有缺漏，視窗就不是帳面上的長度

這是 Day 02 到 Day 03 的資料品質問題的延伸，也是三個裡面最安靜的一個。

`rolling(24)` 數的是**列數**，不是時間。如果 1 小時資料中間掉了 3 根（交易所維護、下載時漏了一段、或者回補管線有洞），那 24 列涵蓋的實際時間就變成 26 小時，而 pandas 不會有任何意見：

```python
full_index = pd.date_range("2026-03-01", periods=30, freq="1h", tz="UTC")
close = pd.Series(np.arange(100, 130, dtype=float), index=full_index)

with_gap = close.drop(full_index[10:13])       # 拿掉 3 根

print(close.rolling(24).mean().iloc[-1])        # 117.5
print(with_gap.rolling(24).mean().iloc[-1])     # 116.625
print(with_gap.index[-1] - with_gap.index[-24]) # 1 days 02:00:00
```

宣稱 24 小時的視窗，實際涵蓋 26 小時，末值差了 0.875。在這個線性的假資料上差異看起來很小，但真實的行情裡，缺漏往往發生在**行情最劇烈的時候**，因為那正是交易所最容易出狀況的時候。也就是說，缺掉的那幾根通常不是無關緊要的幾根。

更麻煩的是這個錯誤會傳染。均線算錯了，交叉的位置就跟著偏，訊號的時間點就跟著偏，而全程不會收到任何錯誤訊息。Day 08 那句「一根缺漏的 K 線可能讓均線算錯十天」講的就是這件事。

有三種處理方式，按推薦順序：

**一、在指標裡驗證索引，有洞就直接失敗。** 這是 `SMA` 的 `expected_timeframe` 參數在做的事，而它是建構參數而不是每次呼叫傳一次的引數：一條均線該不該檢查網格，是這條均線的性質，不該由每個呼叫端各自決定。指標算不出正確結果時應該拒絕回傳，而不是回傳一個看起來正常的錯數字。Day 08 的管線會保證入庫的資料沒有缺漏，這個檢查到那時候就變成安全網。

**二、先把索引補成完整網格，缺的那幾根留 NaN。**

```python
complete = with_gap.reindex(full_index)   # 缺的位置變成 NaN
result = complete.rolling(24, min_periods=24).mean()
```

這樣視窗涵蓋的時間就對了，而且缺漏的位置會讓對應的 24 個視窗全部變成 NaN，等於明確標示「這段期間的均線不可信」。不要在這裡對價格做插值補值，補出來的價格是自己編的，它會讓下游以為那段時間有資料。

**三、改用時間視窗。**

```python
result = close.rolling("24h").mean()
```

`rolling` 傳字串時數的是時間而不是列數，所以缺漏不會讓視窗變長。代價是每個視窗裡的樣本數不固定，缺了 3 根的那些視窗是用 21 個值算平均，權重就跟其他視窗不一樣了。這個選項適合資料本來就不等間隔的場合（Day 09 的逐筆成交就是），拿來處理應該等間隔卻有洞的 K 線，是把問題蓋掉而不是解決。

### 三、未來函數

原理前面講完了，這裡收一下工程上的檢查清單。這四條之後每次寫訊號都適用：

1. **訊號到成交之間至少隔一根。** 讀 `crosses.entry` 而不是 `crosses.golden`，或等 Day 16 之後交給引擎。
2. **只要出現 `shift(-1)`、`bfill()`、`interpolate(method="time", limit_direction="both")`，先停下來想一遍。** 這三個都會把後面的值搬到前面。真的需要（例如算「未來 N 根的報酬」來檢驗特徵有沒有預測力，Day 10 會做）時，那個欄位一定只能當標籤用，NEVER 進到訊號裡。
3. **標準化與統計量只能用滾動視窗，不能用整段資料。** `(close - close.mean()) / close.std()` 用到了整段歷史的平均與標準差，包含未來。要用 `close.rolling(n).mean()` 這種只往回看的版本。Day 12 做活躍度 z-score 時會再提一次。
4. **丟掉最後一根還沒收完的 K 線。**

第 2 條可以做成 lint 規則，第 1 條和第 4 條可以寫成測試。第 3 條目前只能靠 review，因為 `mean()` 本身沒有錯，錯的是套用範圍。

## 怎麼證明算出來的是對的

自己實作的每一個指標都要有對照組。這是這個系列跟其他指標教學最大的差別，也是唯一能確認「算出來的東西是不是 SMA」的方法。

### 跟 pandas-ta 對數字，以及對照組的一個陷阱

```python
import pandas_ta as ta

from quantbot.domain.indicators.sma import SMA

reference = ta.sma(series.frame["close"], length=20)
mine = SMA(20).compute(series)

diff = (mine - reference).abs()
rel = (diff / reference.abs()).max()
print(f"max abs diff: {diff.max():.3e}")
print(f"max rel diff: {rel:.3e}")
assert mine.isna().equals(reference.isna())   # NaN 的位置也要一致
```

跑出來誤差是 `0.000e+00`，完全相同。

而這個結果其實暴露了一件事：**`pandas-ta` 的 `sma()` 在沒有 TA-Lib 的環境下，底層就是 `close.rolling(length, min_periods=length).mean()`，跟 `SMA.compute` 裡那一行一樣。** 誤差為 0 是因為兩邊在跑同一段程式碼，這個對照只驗證了「參數有沒有傳錯」，沒有驗證演算法。

要讓對照組真的有意義，得讓它走一條**獨立實作**的路徑。`pandas-ta` 在偵測到 TA-Lib 時會預設改用 TA-Lib 的實作，而 TA-Lib 的 SMA 是增量式的 running sum（加新的、減舊的），跟 pandas 用的補償求和不是同一套演算法。這時候誤差就不會是 0 了。在一年份 1 分鐘、價格量級 6 萬的 BTC/USDT 現貨資料上，兩者的差距是：

| 對照對象 | 最大絕對誤差 | 最大相對誤差 |
|---|---|---|
| pandas-ta 純 pandas 路徑（`talib=False`） | 0 | 0 |
| TA-Lib 的增量 running sum | 1.1e-06 | 1.6e-11 |

1.1e-06 看起來比 0 差，但那是浮點累加誤差，不是演算法錯誤。相對誤差 1.6e-11 遠低於任何有意義的價格精度（BTC 的最小報價單位是 0.01，比它大五個數量級）。

所以驗收門檻要訂在相對誤差上，不是絕對誤差：

```python
def test_matches_reference_implementation(series):
    reference = ta.sma(series.frame["close"], length=20)
    mine = SMA(20).compute(series)
    pd.testing.assert_series_equal(
        mine, reference, check_names=False, rtol=1e-9, atol=0
    )
```

`rtol=1e-9`，`atol=0`。用相對容差是因為 BTC 在 6 萬跟某個小幣在 0.0001 的合理絕對誤差差了八個數量級，訂絕對值會兩邊都不對。

這個「對照組其實跑同一段程式碼」的情況，在 SMA 上只是浪費一個測試，但到了 Day 06 的 RSI 就會變成實質問題：`pandas-ta` 有些指標的純 pandas 實作跟 TA-Lib 版本**數值本來就不一樣**（Wilder 平滑的初始值取法不同），那時候得先決定要對齊哪一邊。所以現在就養成習慣：**用對照組之前，先確認它跟自己的實作不是同一份程式碼。**

### 邊界測試

對照組驗證「一般情況算得對」，單元測試驗證「不一般的情況不會安靜地給出錯的答案」。測試放 `tests/`，目錄鏡射 `quantbot/`，而且一律是黑箱：import 公開 API、只測公開行為。

```python
# tests/domain/indicators/test_sma.py
import pandas as pd
import pytest

from quantbot.domain.entities.candle_series import CandleSeries
from quantbot.domain.indicators.crossover_signals import CrossoverSignals
from quantbot.domain.indicators.irregular_index_error import IrregularIndexError
from quantbot.domain.indicators.sma import SMA
from quantbot.domain.values.instrument import Instrument
from quantbot.domain.values.market import Market
from quantbot.domain.values.timeframe import Timeframe

HOURLY = Timeframe("1h")
INSTRUMENT = Instrument(symbol="BTC/USDT", market=Market.SPOT, timeframe=HOURLY)


def make_series(closes: list[float]) -> CandleSeries:
    """建一段測試用的 K 線。只有 close 有意義，其他欄位補得過得去就好。"""
    index = pd.date_range(
        "2026-01-01", periods=len(closes), freq="1h", tz="UTC", name="open_time"
    )
    return CandleSeries(
        INSTRUMENT,
        pd.DataFrame(
            {
                "open": closes,
                "high": closes,
                "low": closes,
                "close": closes,
                "volume": 1.0,
            },
            index=index,
        ),
    )


def test_matches_hand_computed_values():
    result = SMA(3).compute(make_series([1, 2, 3, 4, 5]))
    assert result.iloc[:2].isna().all()
    assert result.iloc[2] == pytest.approx(2.0)
    assert result.iloc[4] == pytest.approx(4.0)


def test_output_name_and_warmup_come_from_the_instance():
    indicator = SMA(20)
    assert indicator.name == "sma_20"
    assert indicator.warmup_bar_count == 19  # 只有 SMA 是 n-1
    assert indicator.compute(make_series([1.0] * 25)).name == "sma_20"


def test_index_is_never_changed():
    series = make_series([float(i) for i in range(30)])
    assert SMA(5).compute(series).index.equals(series.frame.index)


def test_warmup_stays_nan_and_is_not_filled():
    assert SMA(3).compute(make_series([10, 20, 30, 40])).isna().sum() == 2


def test_insufficient_data_returns_all_nan():
    """資料比視窗短：回傳等長的全 NaN，不是丟例外，也不是回傳短序列。"""
    result = SMA(20).compute(make_series([100, 101, 102]))
    assert len(result) == 3
    assert result.isna().all()


def test_single_bar():
    assert SMA(20).compute(make_series([42.0])).isna().all()
    assert SMA(1).compute(make_series([42.0])).iloc[0] == pytest.approx(42.0)


def test_empty_series():
    assert SMA(20).compute(make_series([])).empty


def test_missing_bars_raise_when_the_timeframe_is_declared():
    series = make_series([1, 2, 3, 4, 5])
    gapped = CandleSeries(INSTRUMENT, series.frame.drop(index=series.open_times[2]))

    with pytest.raises(IrregularIndexError):
        SMA(3, expected_timeframe=HOURLY).compute(gapped)


def test_missing_bars_silently_widen_the_window_without_the_check():
    """沒宣告 expected_timeframe 時，缺漏會安靜地讓視窗變長。這個測試把行為釘住。"""
    series = make_series([1, 2, 3, 4, 5])
    gapped = CandleSeries(INSTRUMENT, series.frame.drop(index=series.open_times[2]))

    assert SMA(3).compute(gapped).iloc[2] == pytest.approx((1 + 2 + 4) / 3)


def test_invalid_period_is_rejected_at_construction():
    """視窗長度是建構參數，所以錯的值在建物件時就擋掉，不必等到算完。"""
    with pytest.raises(ValueError):
        SMA(0)


def test_candle_series_sorts_so_the_indicator_can_trust_the_order():
    """指標裡沒有「index 有沒有排序」的檢查，因為 CandleSeries 保證了它。

    把不變式放進型別，下游就不必各自防禦——而這條保證要有測試盯著。
    """
    series = make_series([1, 2, 3])
    reversed_series = CandleSeries(INSTRUMENT, series.frame.iloc[::-1])

    assert reversed_series.open_times.is_monotonic_increasing
    assert SMA(2).compute(reversed_series).iloc[-1] == pytest.approx(2.5)


def test_crossover_fires_once_on_the_crossing_bar():
    fast = pd.Series([1, 2, 3, 4, 3, 2], dtype="float64")
    slow = pd.Series([3, 3, 3, 3, 3, 3], dtype="float64")
    crosses = CrossoverSignals(fast, slow)

    assert crosses.golden.tolist() == [False, False, False, True, False, False]
    assert crosses.death.tolist() == [False, False, False, False, True, False]
    assert list(crosses.table.columns) == ["golden", "death"]


def test_crossover_ignores_the_first_bar_that_has_values():
    """慢線第一次有值的那一根，即使快線在上面也不算交叉。"""
    fast = pd.Series([float("nan"), float("nan"), 5.0, 6.0])
    slow = pd.Series([float("nan"), float("nan"), 4.0, 4.0])
    assert not CrossoverSignals(fast, slow).golden.iloc[2]


def test_entry_is_the_golden_cross_shifted_by_one_bar():
    fast = pd.Series([1, 2, 3, 4, 3, 2], dtype="float64")
    slow = pd.Series([3, 3, 3, 3, 3, 3], dtype="float64")
    crosses = CrossoverSignals(fast, slow)

    assert crosses.golden.tolist() == [False, False, False, True, False, False]
    assert crosses.entry.tolist() == [False, False, False, False, True, False]
```

`test_missing_bars_silently_widen_the_window_without_the_check` 那一條值得多說一句。它測的是一個**不理想的行為**，但把它釘進測試裡是有價值的：這個行為是 pandas 的預設語意，改不掉，所以要嘛顯式宣告 `expected_timeframe` 讓它報錯，要嘛就是接受它。測試寫在這裡，未來有人以為「rolling 應該會自動處理缺漏」時，一跑測試就知道不會。

`test_candle_series_sorts_so_the_indicator_can_trust_the_order` 是分層帶來的一個小紅利。`Indicator.compute` 裡沒有「index 有沒有排序」的檢查，因為 `CandleSeries` 建構時就排好了——**不變式放進型別之後，下游的防禦性檢查就是死碼**。但那條保證要有測試盯著，否則哪天有人把 `conform` 裡的 `sort_index()` 拿掉，錯誤會出現在離它很遠的地方。

最後兩條測試是同一組資料的兩種讀法：`golden` 在第 4 根，`entry` 在第 5 根。把它們寫在一起，是因為這個差一根的關係就是今天講的未來函數，而它值得有一條測試盯著。

## 視覺化：把交叉標在圖上

數字對了不代表邏輯對了。交叉點標在圖上肉眼掃一遍，能抓到單元測試抓不到的東西，例如訊號整段偏移一根、或者暖身期冒出了不該有的標記。

圖表是 infrastructure：**domain 不知道 plotly 存在**。這條線的實際好處是，指標與訊號的程式碼不會被畫圖的細節污染，而換成 matplotlib 或前端畫圖時，要動的只有這個檔案。

```python
# quantbot/infrastructure/charting/plotly_crossover_chart_renderer.py
from __future__ import annotations

from typing import ClassVar

import pandas as pd
import plotly.graph_objects as go

from quantbot.domain.entities.candle_series import CandleSeries
from quantbot.domain.indicators.crossover_signals import CrossoverSignals
from quantbot.domain.indicators.sma import SMA


class PlotlyCrossoverChartRenderer:
    """K 線疊兩條 SMA，並把交叉標在快線上。

    圖表在 infrastructure：domain 不知道 plotly 存在，所以換成 matplotlib
    或前端畫圖時，指標與訊號一行都不用改。配色是類別常數，整個系列共用一組。
    """

    CANDLE_UP: ClassVar[str] = "#26a69a"
    CANDLE_DOWN: ClassVar[str] = "#ef5350"
    FAST_LINE: ClassVar[str] = "#f4a261"
    SLOW_LINE: ClassVar[str] = "#4c6ef5"
    MARKERS: ClassVar[tuple[tuple[str, str, str, str], ...]] = (
        ("golden", "黃金交叉", "triangle-up", "#2f9e44"),
        ("death", "死亡交叉", "triangle-down", "#c92a2a"),
    )

    def __init__(self, *, fast_period: int = 20, slow_period: int = 60) -> None:
        self._fast = SMA(fast_period)
        self._slow = SMA(slow_period)

    def render(self, series: CandleSeries) -> go.Figure:
        fast = self._fast.compute(series)
        slow = self._slow.compute(series)
        crosses = CrossoverSignals(fast, slow)

        figure = go.Figure()
        figure.add_trace(self._candles(series))
        figure.add_trace(self._line(fast, self._fast.period, self.FAST_LINE))
        figure.add_trace(self._line(slow, self._slow.period, self.SLOW_LINE))
        for attribute, label, symbol, color in self.MARKERS:
            figure.add_trace(
                self._markers(fast, getattr(crosses, attribute), label, symbol, color)
            )
        figure.update_layout(**self._layout(series))
        return figure

    def _candles(self, series: CandleSeries) -> go.Candlestick:
        candles = series.frame
        return go.Candlestick(
            x=candles.index,
            open=candles["open"],
            high=candles["high"],
            low=candles["low"],
            close=candles["close"],
            name=series.instrument.storage_key,
            increasing_line_color=self.CANDLE_UP,
            decreasing_line_color=self.CANDLE_DOWN,
        )

    @staticmethod
    def _line(values: pd.Series, period: int, color: str) -> go.Scatter:
        return go.Scatter(
            x=values.index,
            y=values,
            name=f"SMA({period})",
            mode="lines",
            line={"width": 1.6, "color": color},
        )

    @staticmethod
    def _markers(
        fast: pd.Series, hit: pd.Series, label: str, symbol: str, color: str
    ) -> go.Scatter:
        # 標記畫在快線上：交叉是兩條線的事件，位置才對得起來
        return go.Scatter(
            x=fast.index[hit],
            y=fast[hit],
            name=label,
            mode="markers",
            marker={
                "symbol": symbol,
                "size": 12,
                "color": color,
                "line": {"width": 1, "color": "white"},
            },
        )

    def _layout(self, series: CandleSeries) -> dict[str, object]:
        instrument = series.instrument
        return {
            "title": (
                f"{instrument.symbol} {instrument.market} {instrument.timeframe}："
                f"SMA({self._fast.period}) 與 SMA({self._slow.period}) 交叉"
            ),
            "xaxis_title": "時間（UTC）",
            "yaxis_title": "價格（USDT）",
            "xaxis_rangeslider_visible": False,
            "height": 620,
            "hovermode": "x unified",
        }
```

幾個刻意的選擇：

- 標記畫在**快線上**而不是價格上。交叉是兩條線的事件，標在快線上位置才對得起來；標在 K 線的高低點會讓人以為訊號跟那根 K 線的極值有關。
- 配色與標記樣式是類別常數。這張圖之後還會長出 EMA 版、RSI 副圖，共用同一組顏色才不會每篇的綠紅都不一樣。
- `xaxis_rangeslider_visible=False`。Plotly 的 K 線圖預設帶一條範圍滑桿，會佔掉三分之一的高度，而圖上直接拉方框就能縮放。
- 標題與軸標題從 `instrument` 長出來，不是手寫字串。時區與市場不寫出來，三個月後自己也會懷疑。

### 組起來，跑一次

到目前為止每個類別都能單獨用，但沒有任何一個地方把它們接在一起。那個地方是 `entrypoints/`：全專案唯一知道所有具體型別的一層。指標、訊號、圖表三者只在這一支檔案裡碰面，上面的 domain 誰也不認識誰。

```python
# quantbot/entrypoints/crossover_chart_command.py
"""讀回補好的 parquet，算兩條 SMA、找出交叉，印出訊號並輸出互動圖。

    uv run python -m quantbot.entrypoints.crossover_chart_command \
        --symbol BTC/USDT --market spot --timeframe 1h --fast 20 --slow 60
"""

from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd

from quantbot.domain.entities.candle_series import CandleSeries
from quantbot.domain.indicators.crossover_signals import CrossoverSignals
from quantbot.domain.indicators.sma import SMA
from quantbot.domain.values.instrument import Instrument
from quantbot.domain.values.market import Market
from quantbot.domain.values.timeframe import Timeframe
from quantbot.infrastructure.charting.plotly_crossover_chart_renderer import (
    PlotlyCrossoverChartRenderer,
)


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--symbol", default="BTC/USDT")
    parser.add_argument("--market", default="spot", choices=[m.value for m in Market])
    parser.add_argument("--timeframe", default="1h")
    parser.add_argument("--fast", type=int, default=20)
    parser.add_argument("--slow", type=int, default=60)
    parser.add_argument("--source", type=Path, default=Path("data/klines"))
    parser.add_argument("--out", type=Path, default=Path("notebooks"))
    return parser.parse_args()


def main() -> int:
    arguments = parse_arguments()
    instrument = Instrument(
        symbol=arguments.symbol,
        market=Market(arguments.market),
        timeframe=Timeframe(arguments.timeframe),
    )
    series = CandleSeries(
        instrument,
        pd.read_parquet(arguments.source / f"{instrument.storage_key}.parquet"),
    )

    # 這裡是組裝根：指標、訊號、圖表三個具體型別只在這一支檔案裡碰面
    fast = SMA(arguments.fast, expected_timeframe=instrument.timeframe)
    slow = SMA(arguments.slow, expected_timeframe=instrument.timeframe)
    crosses = CrossoverSignals(fast.compute(series), slow.compute(series))

    # 事件那一根與最快能成交的那一根並排，差的那一根就是位移
    events = pd.DataFrame(
        {
            "golden": crosses.golden,
            "entry": crosses.entry,
            "death": crosses.death,
            "exit": crosses.exit,
        }
    )
    fired = events.loc[events.any(axis=1)]

    print(f"{len(series)} 根 K 線：{series.open_times[0]} → {series.open_times[-1]}")
    print(
        f"黃金交叉 {int(crosses.golden.sum())} 次，"
        f"死亡交叉 {int(crosses.death.sum())} 次"
    )
    print(fired.head(10))

    arguments.out.mkdir(parents=True, exist_ok=True)
    chart_path = arguments.out / f"day04-{instrument.storage_key}-crossover.html"
    PlotlyCrossoverChartRenderer(
        fast_period=arguments.fast, slow_period=arguments.slow
    ).render(series).write_html(chart_path)
    print(f"圖：{chart_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

這支指令是**讀** parquet，不是抓資料，所以要先有那個檔。Day 03 的範例抓的是 1 分鐘線，今天用的是 1 小時線，所以先用同一支回補指令補一份 1h 下來——同一條管線，只換 `--timeframe`：

```bash
uv run python -m quantbot.entrypoints.backfill_command \
    --symbol BTC/USDT --market spot --timeframe 1h \
    --start 2025-01-01 --end 2026-08-02 --out data/klines
```

```
13872 根，缺 0 根，覆蓋率 100.0000%
```

1 小時線一年半只有一萬多根，比 Day 03 那份 1 分鐘的八十幾萬根小兩個數量級，批次檔幾秒就下載完。缺漏 0 根這件事等一下有用：`SMA` 建構時傳了 `expected_timeframe`，網格只要有洞就會丟 `IrregularIndexError`，整支指令會直接停在那裡。

檔案就位之後：

```bash
uv run python -m quantbot.entrypoints.crossover_chart_command \
    --symbol BTC/USDT --market spot --timeframe 1h --fast 20 --slow 60
```

```
13872 根 K 線：2025-01-01 00:00:00+00:00 → 2026-08-01 23:00:00+00:00
黃金交叉 126 次，死亡交叉 127 次
                           golden  entry  death   exit
open_time
2025-01-06 01:00:00+00:00   False  False   True  False
2025-01-06 02:00:00+00:00   False  False  False   True
2025-01-06 04:00:00+00:00    True  False  False  False
2025-01-06 05:00:00+00:00   False   True  False  False
2025-01-07 22:00:00+00:00   False  False   True  False
2025-01-07 23:00:00+00:00   False  False  False   True
2025-01-10 18:00:00+00:00    True  False  False  False
2025-01-10 19:00:00+00:00   False   True  False  False
2025-01-13 09:00:00+00:00   False  False   True  False
2025-01-13 10:00:00+00:00   False  False  False   True
```

這份輸出把今天講的兩件事都攤在同一張表上。第一件是位移：每個 `golden` 或 `death` 的下一列，才是對應的 `entry` 或 `exit`，兩者永遠不會落在同一根。第二件是交叉的密度——13,872 根裡有 253 次交叉，平均每 55 根一次，而且 01-06 那組黃金交叉距離前一次死亡交叉只有 3 根。SMA(20) 與 SMA(60) 在 1 小時線上就是這麼常翻面，這也是為什麼交叉本身不能直接當策略用，後面幾天會一直回到這件事。

最後一行印出 `notebooks/day04-spot_BTCUSDT_1h-crossover.html`，用瀏覽器打開它。用互動縮放做三件檢查：

1. **拉到資料最開頭。** 前 59 根應該只有 K 線、沒有慢線，而且**不應該有任何交叉標記**。有的話就是 `previously_ready` 那個保護沒生效。
2. **隨便挑一個標記放大。** 確認標記那一根的前一根，快慢線的上下關係確實是反過來的。這是驗證「事件」而不是「狀態」。
3. **看震盪的那幾段。** 標記會密集地成對出現，一個黃金交叉後面很快跟一個死亡交叉。這是均線交叉在震盪行情裡本來就會有的行為，圖上沒有這個特徵反而要回去查。

## 今日交付物

```
quantbot/
├── domain/indicators/
│   ├── indicator.py                 Indicator（ABC，六條契約）
│   ├── irregular_index_error.py
│   ├── sma.py                       SMA
│   └── crossover_signals.py         CrossoverSignals
├── infrastructure/charting/
│   └── plotly_crossover_chart_renderer.py
├── entrypoints/
│   └── crossover_chart_command.py   組裝根：把上面三者接起來
└── tests/domain/indicators/
    └── test_sma.py
```

驗收標準，六項全過才算完成：

1. `uv run pytest tests/domain/indicators/test_sma.py` 全綠，且包含這四個邊界案例：資料少於視窗長度、只有一根 K 線、空序列、索引有缺漏。
2. 跟 `pandas-ta` 的對照測試通過，`rtol=1e-9`、`atol=0`，並且 NaN 的位置完全一致。如果環境裡沒有 TA-Lib，在測試裡加一句註解說明這個對照走的是同一條 pandas 路徑，等 Day 06 再補上真正獨立的對照。
3. `SMA(20, expected_timeframe=Timeframe("1h")).compute(series)` 餵一份缺了幾根的資料會丟 `IrregularIndexError`，而不是回傳一個看起來正常的數字。
4. 先用 Day 03 的 `backfill_command` 補一份 `--timeframe 1h` 的 parquet（缺漏要是 0 根），再跑 `uv run python -m quantbot.entrypoints.crossover_chart_command --symbol BTC/USDT --market spot --timeframe 1h --fast 20 --slow 60`，不噴錯並產出 `notebooks/day04-spot_BTCUSDT_1h-crossover.html`。打開它，前 59 根沒有任何交叉標記，且每個標記的前一根快慢線關係確實相反。
5. 同一支指令印出來的訊號表裡，每個 `golden` 的下一列才是 `entry`、每個 `death` 的下一列才是 `exit`，沒有任何一列同時為真。這一項現在看起來像多餘的檢查，Day 19 會用到它。
6. `uv run mypy quantbot` 與 `uv run lint-imports` 全過。後者會擋掉一件事：`domain/indicators/` 底下 NEVER 出現 `import plotly`。今天新增了一個圖表類別，正是最容易把畫圖的東西順手寫進指標模組的時候。

順帶記一件事在 README 或註解裡：**今天所有的數字都來自 Day 03 回補的 BTC/USDT 現貨 1 小時 parquet，源頭是 `data.binance.vision` 的批次檔加上 REST 補的最後幾天。** 這個系列到最後會有三條擷取路徑跟兩個對照組，等到某天發現一個數字不合理時，「這張表是誰給的」是第一個要問的問題。

本系列為程式與資料工程的技術分享，所有策略與數字皆為教學範例，不構成投資建議；加密貨幣波動劇烈，實際交易請自行評估風險。

## 明天

SMA 給每一根同樣的權重，所以三十天前的價格跟昨天的價格對今天的均線影響一樣大。這件事在急跌的時候特別明顯：價格已經跌了 5%，SMA(20) 還在慢慢往下彎，因為它有 19 根舊資料在拉住它。前面算過，那個延遲大約是 `(n-1)/2` 根。

明天 Day 05 我們換上 EMA，讓近期的資料有更高的權重。同時會遇到這個系列第一個**不能直接向量化**的指標：EMA 的第 t 個值依賴第 t-1 個值，是遞迴的。我們會先看 `ewm()` 怎麼一行解決，再拆開講 `adjust=True` 跟 `adjust=False` 算出來的數字為什麼不一樣、交易上該用哪一個，以及 EMA 為什麼沒有真正的起始點。順帶留一個效能上的尾巴，Day 26 用 Numba 來收。
