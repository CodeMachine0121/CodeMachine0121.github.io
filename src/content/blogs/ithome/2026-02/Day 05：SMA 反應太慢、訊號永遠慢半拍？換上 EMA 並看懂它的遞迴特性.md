---
title: "Day 05：SMA 反應太慢、訊號永遠慢半拍？換上 EMA 並看懂它的遞迴特性"
datetime: "2026-09-19"
description: "EMA 把權重按指數往回衰減，反應比 SMA 快，代價是雜訊也跟著放大。這篇講清楚平滑係數 α 與週期 n 的關係、EMA 為什麼沒有真正的起始點，以及它作為本系列第一個不能直接向量化的指標，該用 ewm 怎麼寫、adjust 參數該選哪一個，最後跟 pandas-ta 對到 1e-9 以內。"
image: ""
parent: "2026 ithome-鐵人賽: 工程師的量化交易入門：從 K 線到可組合的交易策略引擎 系列"
draft: true
---

## 昨天那條線，永遠晚幾根才轉彎

昨天你把 SMA 寫完了，也順手畫了 SMA(20) 與 SMA(60) 的疊圖。如果你把圖拉到某一段跌得比較急的位置，會看到一件有點礙眼的事：價格已經連跌五六根，那條 20 期均線還在慢慢往下彎，等它真的轉頭向下，最猛的那一段已經跌完了。

這不是你寫錯。SMA 的定義就決定了它會這樣：它把視窗內的 20 根 K 線一視同仁，每一根權重都是 5%。最新那根收盤價暴跌 8%，在均線上也只佔 5% 的份量，剩下 95% 還是由前面 19 根（其中大部分是暴跌前的價格）撐著。均線是**過去 20 根的重心**，而重心落在視窗的中間，不是右緣。

今天要做的事很直接：把「一視同仁」換成「越近的資料越重要」，也就是 EMA。它會讓那條線早幾根低頭。同時也要老實講清楚代價：早幾根低頭的另一面，是每一次無關緊要的跳動也會早幾根反映在線上。

順帶一提，EMA 是這個系列第一個**不能直接向量化**的指標。全系列的規範是「NEVER 用 for loop 遍歷 K 線」，而 EMA 剛好是那個合法例外。它為什麼是例外、pandas 又是怎麼把這件事處理掉的，是今天工程實作的重點。

本篇用到的資料跟昨天同一份：Day 03 用 `data.binance.vision` 批次回補、存成 parquet 的 BTC/USDT **現貨** 1 小時 K 線。

## 交易概念補課：平滑、延遲、遞迴指標

三個詞，都不是金融概念，是訊號處理概念。

**平滑（smoothing）** 就是把序列裡的高頻抖動壓掉，留下比較慢的成分。價格序列裡混了兩種東西：一種是真的有方向的移動，另一種是每根之間隨機的來回。平滑的目的是讓後者不要蓋過前者。SMA 是平滑，EMA 也是平滑，差別只在權重怎麼分配。

**延遲（lag）** 是平滑一定要付的代價。任何只用過去資料算出來的平滑值，都不可能比原始序列早反映變化，因為早反映就代表你用到了還沒發生的資料，那是昨天講過的未來函數。所以問題從來不是「有沒有延遲」，而是「延遲幾根、換到多少雜訊抑制」。

延遲可以量。SMA(n) 的權重平均落在視窗中央，平均延遲大約是 `(n-1)/2` 根，n=20 就是 9.5 根。這個數字解釋了你在圖上看到的現象：均線要等到跌勢過了大約十根，重心才真的移下來。

**遞迴指標（recursive indicator）** 是這樣一類指標：它第 i 根的值，用「第 i 根的輸入」加上「第 i-1 根的輸出」算出來，而不是用「第 i 根往前數 n 根的輸入」算出來。SMA 是後者，每一格只看固定長度的一段原始資料，格子之間互不相干。EMA 是前者，每一格都建在前一格上。

這個差別在數學上只是換個寫法，在工程上卻決定了三件事：能不能平行計算（Day 26 會用到）、資料缺漏時錯誤會不會傳染（今天的驗證會遇到）、以及有沒有一個明確的「第一格該填什麼」（今天的核心）。

## EMA 在算什麼：權重按指數往回衰減

EMA 的遞迴定義只有一行：

```
ema[i] = α * close[i] + (1 - α) * ema[i-1]
```

`α`（alpha）叫平滑係數，介於 0 到 1 之間。α 越大，新資料的話語權越大，線越貼著價格跑；α 越小，線越平。

把這條式子往回展開，會看到它真正的樣子：

```
ema[i] = α * close[i]
       + α(1-α) * close[i-1]
       + α(1-α)² * close[i-2]
       + α(1-α)³ * close[i-3]
       + ...
```

每往回一根，權重就乘一次 `(1-α)`，是一條等比衰減的曲線。所有權重加起來剛好是 1（等比級數 `α / (1-(1-α))`），所以它確實是一個加權平均，只是這個平均**涵蓋所有歷史資料**，只是越舊的權重越接近 0。

### α 與週期 n 的關係

實務上沒有人直接指定 α，大家講的是「EMA(20)」「EMA(12)」這種週期。兩者的換算是：

```
α = 2 / (n + 1)
```

這個 2/(n+1) 不是隨便定的。前面提過 SMA(n) 的權重重心落在 `(n-1)/2` 根之前；指數權重的重心則是 `(1-α)/α`。把兩者設成相等：

```
(1 - α) / α = (n - 1) / 2   →   α = 2 / (n + 1)
```

換句話說，EMA(20) 之所以叫「20 期」，是因為它的權重重心跟 SMA(20) 一樣落在 9.5 根前。這個定義讓兩者可以並排比較：同樣的 n，兩條線的「平均延遲」在設計上是對齊的，差別在權重分布的形狀。

形狀差在哪裡，看數字最清楚。以 n=20（α ≈ 0.0952）為例：

| 涵蓋範圍 | SMA(20) 的權重合計 | EMA(20) 的權重合計 |
|---|---|---|
| 最近 1 根 | 5.0% | 9.5% |
| 最近 5 根 | 25.0% | 39.4% |
| 最近 10 根 | 50.0% | 63.2% |
| 最近 20 根 | 100.0% | 86.5% |
| 最近 40 根 | 100.0% | 98.2% |
| 更早的資料 | 0% | 1.8% |

兩件事值得注意。第一，EMA 給最新那根的權重接近 SMA 的兩倍，這就是它反應比較快的來源。第二，EMA 的權重不會歸零，40 根以前的資料還留著 1.8%，只是小到不影響結果。順著這個看，EMA(20) 的半衰期是 `ln(0.5) / ln(1-α) ≈ 6.9` 根，大約七根之後，一筆資料的影響力就只剩一半。

### 為什麼 EMA 沒有真正的起始點

上面那條展開式有個前提：資料要往回延伸到無限遠。但你手上的 parquet 只有幾千根，第一根之前什麼都沒有，`ema[-1]` 不存在。

這代表 EMA 的第一格必須由你（或你用的套件）**憑空指定**，而不同的指定方式會算出不同的數字。常見的兩種：

- **用第一根收盤價當種子**：`ema[0] = close[0]`，簡單，第一根就有值。
- **用前 n 根的 SMA 當種子**：把 `ema[n-1]` 設成前 n 根的算術平均，前 n-1 根留 NaN。這是 TA-Lib 的慣例，`pandas-ta` 預設也跟著這樣做。

種子不同造成的差異會隨時間衰減，但衰減得比你想的慢。以 n=20 為例，兩種種子在第 20 根還差好幾百美元，第 100 根差幾分錢，要到接近 300 根之後才收斂到 1e-9 以內。也就是說，**如果你想跟現成套件對數字，前面幾百根對不起來是正常的，除非你用同一種種子**。這件事在等一下的驗證環節會直接踩到。

## 工程實作

### 這裡為什麼不能向量化

先把「向量化」這件事的前提講清楚。`rolling(20).mean()` 之所以能一次算完整條序列，是因為第 i 格的答案只依賴 `close[i-19:i+1]` 這段固定的原始輸入。每一格要什麼資料，在開始算之前就全部知道，格子與格子之間沒有先後關係，底層要平行、要用累積和的技巧、要 SIMD 都可以。

EMA 破壞的就是這個前提。`ema[i]` 需要 `ema[i-1]`，而 `ema[i-1]` 需要 `ema[i-2]`，一路串到第一根。這條依賴鏈的長度等於資料筆數，中間沒有任何一段可以先算。這是演算法本身的性質，不是 pandas 的功能缺陷。

嚴格說起來還有一條路：把遞迴展開成上面那條等比加權和，它其實是一個卷積，理論上可以用 FFT 一次算完。但實務上沒人這麼做。`(1-α)^i` 衰減很快，資料一長就會在浮點數下溢；而且處理種子與缺漏值的邏輯，寫成卷積會比寫成迴圈更難寫對。用一個難驗證的實作換一點速度，對指標這種「後面每一天都會直接引用」的東西不划算。

所以結論是：EMA 就是要走遞迴。全系列「NEVER 用 for loop 遍歷 K 線」的規範在這裡有例外，但例外要有條件：**迴圈不能寫在 Python 層**。

### 用 ewm 一行算完 EMA

pandas 早就把這條迴圈放進 C 實作裡了，介面是 `ewm()`：

```python
ema20 = klines["close"].ewm(span=20, adjust=False).mean()
```

`span=20` 就是週期 n，pandas 內部換算成 `α = 2/(n+1)`。另外三種指定方式也都支援：`com`（重心）、`halflife`（半衰期）、`alpha`（直接給）。Day 06 的 RSI 會用到 `alpha=1/n` 這條路，先記著。

速度上這條路完全夠用。拿一年份的 1 分鐘 K 線（525,600 根）實測：

| 寫法 | 耗時 |
|---|---|
| `close.ewm(span=20, adjust=False).mean()` | 約 2 ms |
| `close.rolling(20).mean()`（昨天的 SMA，對照用） | 約 2 ms |
| 同樣邏輯用 Python 迴圈手寫 | 約 64 ms |

`ewm` 跟真正向量化的 `rolling` 幾乎同一個量級，Python 迴圈慢 30 倍以上。這個 30 倍現在還無關緊要，64 ms 你根本感覺不到。它會在什麼時候變成問題，等一下講。

### adjust 參數：兩種算法，兩個數字

`ewm()` 有一個叫 `adjust` 的參數，預設是 `True`，而上面那行程式碼刻意寫了 `adjust=False`。這不是風格偏好，兩者算出來的是不同的數字。

`adjust=False` 就是前面那條遞迴定義，一根一根往下滾：

```
ema[0] = close[0]
ema[i] = α * close[i] + (1-α) * ema[i-1]
```

`adjust=True` 則是換一個定義。它承認資料只有 t+1 根，於是把有限筆的權重**重新正規化**，讓它們加總為 1：

```
              α·close[t] + α(1-α)·close[t-1] + ... + α(1-α)^t·close[0]
ema[t]  =    ───────────────────────────────────────────────────────
                        α + α(1-α) + ... + α(1-α)^t
```

分母是 `1 - (1-α)^(t+1)`。t 很大時分母趨近 1，兩個定義收斂；t 很小時分母遠小於 1，等於把權重放大，算出來的值會明顯不同。

差多少？以 span=20 為例，同一段資料跑兩次：

| 第幾根 | 兩者差距（相對於當時價格） |
|---|---|
| 第 5 根 | 1% 以上 |
| 第 20 根 | 0.1% 量級 |
| 第 100 根 | 萬分之一以下 |
| 第 300 根 | 進入 1e-9 以內 |

前面一百根的差距大到會改變任何以「這條線在價格之上還是之下」為條件的判斷。

**交易上該用哪一個：`adjust=False`。** 理由跟數學好壞無關，跟你上線之後的處境有關。系統跑起來之後，K 線是一根一根進來的，你手上有的東西只有「這根的收盤價」和「上一根算出來的 EMA」，你能做的計算就是 `α * 新收盤 + (1-α) * 上一根 EMA`，這正是 `adjust=False` 的定義。

`adjust=True` 沒辦法這樣更新，它每來一根都要回頭對整段歷史重新加權。這件事本身還可以忍（大不了重算），真正的問題是：你在歷史資料上算出來的數字，跟你上線後即時算出來的數字會對不起來。研究時看到的那條線，跟真實下單當下看到的那條線不是同一條，而這種不一致不會噴任何錯誤，只會讓你之後查半天。

所以 `quantbot` 的指標一律 `adjust=False`，這條規則從今天起適用到系列結束。

### 給 Day 26 留的尾巴

`ewm` 幫你把迴圈藏進 C 裡，但它只覆蓋 pandas 想得到的那些遞迴形式。你遲早會遇到湊不出來的變體：係數會隨波動率變動的自適應版本、遞迴裡帶條件分支的版本、或是需要同時維護兩三個狀態變數的版本。到那時候只剩下自己寫迴圈這條路，而前面那個 64 ms 就會直接變成你的計算成本。乘上幾十個交易對、幾組參數、每次調整都要重算一遍，感覺就出來了。

Day 26 會回來收這條尾巴：用 `cProfile` 確認熱點真的在這裡，再用 Numba 的 `@njit` 把迴圈編譯掉，並驗證加速後的數值跟今天這版完全一致。在那之前，先把手寫遞迴的版本留著，它今天就有用途，是驗證環節的對照組之一。

### quantbot/indicators/ema.py

```python
# quantbot/indicators/ema.py
"""指數移動平均（EMA）。

簽章與 Day 04 的 sma() 一致：吃 DataFrame、回傳 Series，
index 沿用輸入的 UTC DatetimeIndex。Day 06 會把三個指標收進同一組介面。
"""

from __future__ import annotations

from typing import Literal

import numpy as np
import pandas as pd

WarmupMode = Literal["sma", "first"]


def ema(
    df: pd.DataFrame,
    period: int,
    column: str = "close",
    warmup: WarmupMode = "sma",
) -> pd.Series:
    """計算指數移動平均。

    採 adjust=False 的遞迴定義，也就是 ema[i] = a * x[i] + (1-a) * ema[i-1]，
    a = 2 / (period + 1)。這個定義與上線後逐根更新的算法完全一致。

    Args:
        df: 至少含 `column` 欄的 K 線資料，index 為 UTC DatetimeIndex。
        period: 週期 n。
        column: 取哪一欄計算，預設收盤價。
        warmup: 起始值怎麼決定。
            "sma"   用前 n 根的算術平均當種子，放在第 n 根，前 n-1 根為 NaN。
                    這是 TA-Lib 與 pandas-ta 的慣例，要對照數字就用這個。
            "first" 直接用第一根當種子，第一根起就有值，但前面幾百根會偏離。

    Returns:
        與 df 等長、index 相同的 Series，名稱為 "ema_{period}"。

    Raises:
        ValueError: period 小於 1、column 不存在、或 warmup 不是合法值。
    """
    if period < 1:
        raise ValueError(f"period must be >= 1, got {period}")
    if column not in df.columns:
        raise ValueError(f"column {column!r} not found in df")
    if warmup not in ("sma", "first"):
        raise ValueError(f"unknown warmup mode: {warmup!r}")

    close = df[column].astype("float64")
    name = f"ema_{period}"

    if warmup == "first":
        return close.ewm(span=period, adjust=False).mean().rename(name)

    if len(close) < period:
        # 資料不足以生出種子。NEVER 拿半個視窗硬算出一個看起來合理的值，
        # 那種值不會噴錯，只會安靜地汙染後面所有計算。
        return pd.Series(np.nan, index=close.index, dtype="float64", name=name)

    seeded = close.copy()
    seeded.iloc[: period - 1] = np.nan
    seeded.iloc[period - 1] = close.iloc[:period].mean()
    return seeded.ewm(span=period, adjust=False).mean().rename(name)
```

另外寫一支照定義展開的參考實作，只給測試用。它慢，但它是唯一一份「直接從數學式翻過來、沒有經過任何套件」的程式碼，用來確認 `ewm` 的參數確實被設成你以為的樣子：

```python
# tests/reference.py
"""照定義手寫的遞迴參考實作，只在測試裡當對照組使用。

刻意用 Python 迴圈寫，不追求效能，它的價值在於好讀、好對照數學式。
Day 26 會把同一條迴圈交給 Numba 編譯，並用這裡的數字當正確性基準。
"""

from __future__ import annotations

import numpy as np


def ema_reference(values: np.ndarray, period: int, warmup: str = "sma") -> np.ndarray:
    """一根一根滾出 EMA，回傳與輸入等長的 float64 陣列。"""
    alpha = 2.0 / (period + 1)
    out = np.full(values.shape, np.nan, dtype="float64")

    if warmup == "sma":
        if values.size < period:
            return out
        start = period - 1
        previous = float(values[:period].mean())
    else:
        if values.size == 0:
            return out
        start = 0
        previous = float(values[0])

    out[start] = previous
    for i in range(start + 1, values.size):
        previous = alpha * float(values[i]) + (1 - alpha) * previous
        out[i] = previous
    return out
```

## 陷阱與驗證

### 兩個對照組，各驗一件事

跟 `pandas-ta` 對數字是這個系列的固定動作，但今天要多做一步，原因值得說明。

`pandas-ta` 的 `ema()` 底層也是呼叫 `ewm()`。如果你的實作也走 `ewm()`，兩邊拿到的會是同一份 C 程式碼算出來的結果，誤差會是漂亮的 `0.0`。但這個 0 只證明了一件事：**你的參數與種子慣例跟它一致**。它完全抓不出「你以為 α 是 2/(n+1)、實際上寫成 1/n」這類公式錯誤，因為兩邊會一起錯。

所以要兩個對照組，分工不同：

| 對照組 | 驗什麼 | 預期誤差 |
|---|---|---|
| `pandas-ta` 的 `ema()` | 參數、種子慣例、輸出對齊方式跟業界一致 | 0.0（同一份底層實作） |
| `ema_reference()` 手寫遞迴 | 數學公式本身正確 | 1e-11 量級（float64 累積） |

第二個的誤差不會是 0，因為 pandas 的 C 實作與 Python 迴圈的浮點運算順序不完全相同，每一步差在最後一位，遞迴又會把這些差一路帶下去。在幾千根、價格四萬美元量級的資料上，實測最大絕對誤差大約 `2.9e-11`，遠低於 1e-9 的門檻。這不是邏輯差異，是 float64 的正常表現。

```python
# scripts/verify_ema.py
import pandas as pd
import pandas_ta as ta

from quantbot.indicators.ema import ema
from tests.reference import ema_reference

# Day 03 用 data.binance.vision 批次回補的 BTC/USDT 現貨 1 小時 K 線
klines = pd.read_parquet("data/BTCUSDT_spot_1h.parquet")
period = 20

mine = ema(klines, period=period, warmup="sma")

# pandas-ta 預設 adjust=False 且用前 n 根 SMA 當種子，跟 warmup="sma" 對齊
theirs = ta.ema(klines["close"], length=period)

reference = pd.Series(
    ema_reference(klines["close"].to_numpy(), period=period, warmup="sma"),
    index=klines.index,
)

for label, other in (("pandas-ta", theirs), ("reference", reference)):
    diff = (mine - other).abs()
    print(f"{label:>10}  max|diff| = {diff.max():.3e}  "
          f"共同有效根數 = {int(diff.notna().sum())}")
    assert diff.max() < 1e-9, f"{label} 對不起來"
```

輸出大致長這樣：

```
 pandas-ta  max|diff| = 0.000e+00  共同有效根數 = 8741
 reference  max|diff| = 2.910e-11  共同有效根數 = 8741
```

如果第一行不是 0，先檢查三件事：`adjust` 有沒有設成 `False`、種子是不是同一種、以及你的 `pandas-ta` 版本的 `ema()` 預設值有沒有變（它可以用 `sma=False` 關掉 SMA 種子）。

### 種子不同會拖多久

前面說種子影響「前幾十根」，實際跑一次會發現更久。同一段資料，一邊用 `warmup="first"`、一邊用 `warmup="sma"`：

| 第幾根 | 兩者絕對差（價格約四萬美元） |
|---|---|
| 第 20 根 | 231 美元 |
| 第 50 根 | 11.5 美元 |
| 第 100 根 | 0.077 美元 |
| 第 200 根 | 3.5e-06 |
| 第 282 根 | 首次進入 1e-9 以內 |

這件事的實際後果有兩層。研究的時候，如果你在一段資料的開頭就開始取用 EMA，拿到的值取決於你從哪一天開始載資料，換個起始日，同一根 K 線上的 EMA 會不一樣。上線之後更麻煩：程式重啟時如果只讀最近 50 根就開始算，算出來的線跟一直跑著沒重啟的那條會有肉眼可見的落差。

處理方式很單純：**每次計算都預留足夠的 warm-up 資料，並且明確定義預留多少**。經驗上取 `5 * period` 根起跳，要求嚴一點就取 `10 * period`。這個「warm-up 期」的概念之後會一直用到，Day 15 收斂特徵介面時會把它變成每個特徵都要宣告的欄位，由 pipeline 自動算出整條鏈需要多少暖機資料。

### 缺漏資料：EMA 比 SMA 危險的地方

昨天講過 SMA 遇到缺漏會怎樣：`rolling` 的視窗涵蓋的實際時間變長了，但它至少會在資料不足時給你 NaN。EMA 有一個更安靜的行為。

```python
import numpy as np
import pandas as pd

close = pd.Series([100.0, 101.0, np.nan, 103.0, 104.0, 105.0])
print(close.rolling(3).mean().round(4).tolist())
print(close.ewm(span=3, adjust=False).mean().round(4).tolist())
```

```
[nan, nan, nan, nan, nan, 104.0]
[100.0, 100.5, 100.5, 102.1667, 103.0833, 104.0417]
```

`rolling` 遇到 NaN 整個視窗都回 NaN，很吵，但你會發現。`ewm` 在缺漏那一格直接沿用前一根的值（100.5），不報錯、不留 NaN、圖上看起來就是短短一段平的線。如果你的資料裡有零星缺漏而你沒發現，EMA 會安靜地繼續往下算。

還有一個細節值得知道。上面第 4 格算出來是 102.1667，而不是把缺漏那根當不存在的 101.75。這是 `ewm` 的 `ignore_na` 參數在起作用，預設 `False` 表示「缺漏那一格雖然沒有資料，但時間確實過去了」，所以舊值會多衰減一次，新資料的相對權重變大。對交易資料來說這個預設是對的，時間不會因為交易所沒回資料就停下來。所以不要去改它，但要知道它在做什麼。

真正的解法在資料層而不是指標層：Day 08 的管線會把時間軸補齊、把缺漏區間標記出來並寫進完整性報告。指標這一層要做的只有一件事，就是**不要把缺漏悄悄吃掉**。所以 `ema()` 不做任何 `fillna`，缺漏就讓它以缺漏的形式往下傳。

### 邊界測試

```python
# tests/test_ema.py
import numpy as np
import pandas as pd
import pytest

from quantbot.indicators.ema import ema
from tests.reference import ema_reference


def make_klines(closes: list[float]) -> pd.DataFrame:
    index = pd.date_range("2026-01-01", periods=len(closes), freq="h", tz="UTC")
    return pd.DataFrame({"close": closes}, index=index)


def test_matches_reference_implementation():
    rng = np.random.default_rng(20260919)
    closes = 62000 * np.exp(np.cumsum(rng.normal(0, 0.01, 500)))
    klines = make_klines(closes.tolist())

    result = ema(klines, period=20)
    expected = ema_reference(closes, period=20)

    assert np.nanmax(np.abs(result.to_numpy() - expected)) < 1e-9


def test_constant_series_equals_the_constant():
    """輸入是常數時，EMA 必須等於那個常數，這是加權平均的基本性質。"""
    klines = make_klines([100.0] * 50)
    result = ema(klines, period=20).dropna()
    assert np.allclose(result.to_numpy(), 100.0)


def test_sma_warmup_leaves_leading_nan():
    klines = make_klines([float(i) for i in range(30)])
    result = ema(klines, period=20)

    assert result.iloc[: 20 - 1].isna().all()
    # 第 20 根就是前 20 根的算術平均
    assert result.iloc[19] == pytest.approx(np.mean(range(20)))


def test_insufficient_data_returns_all_nan():
    """只有 10 根卻要算 EMA(20)：全部回 NaN，NEVER 硬擠一個值出來。"""
    klines = make_klines([float(i) for i in range(10)])
    result = ema(klines, period=20)

    assert len(result) == 10
    assert result.isna().all()


def test_single_bar():
    klines = make_klines([42000.0])
    assert ema(klines, period=20).isna().all()
    # warmup="first" 時，唯一那根就是它自己
    assert ema(klines, period=20, warmup="first").iloc[0] == 42000.0


def test_gap_is_carried_not_filled():
    """缺漏那一格沿用前值是 ewm 的行為，用測試把它釘住，
    免得哪天有人加了 fillna 卻沒人發現。"""
    klines = make_klines([100.0, 101.0, np.nan, 103.0])
    result = ema(klines, period=3, warmup="first")

    assert result.iloc[2] == pytest.approx(result.iloc[1])
    assert result.iloc[3] == pytest.approx(102.166667, abs=1e-6)


def test_invalid_arguments():
    klines = make_klines([1.0, 2.0, 3.0])

    with pytest.raises(ValueError):
        ema(klines, period=0)
    with pytest.raises(ValueError):
        ema(klines, period=5, column="typical_price")
    with pytest.raises(ValueError):
        ema(klines, period=5, warmup="exponential")
```

`test_constant_series_equals_the_constant` 看起來像廢話，但它是最便宜的公式檢查：只要權重沒有正確加總為 1，這個測試就會紅。

## 視覺化：同一段急跌，兩條線誰先低頭

論證的核心是這張圖。上半是 K 線疊上 SMA(20) 與 EMA(20)，下半是兩條線的差值，差值往上代表 SMA 高於 EMA，也就是 EMA 已經先往下走了。

```python
# notebooks/day05_sma_vs_ema.py
import pandas as pd
import plotly.graph_objects as go
from plotly.subplots import make_subplots

from quantbot.indicators.ema import ema

# Day 03 回補的 BTC/USDT 現貨 1 小時 K 線
klines = pd.read_parquet("data/BTCUSDT_spot_1h.parquet")

# 找出樣本裡跌得最急的一段：以 6 小時報酬最低的位置為中心
window = 6
returns = klines["close"].pct_change(window)
center = returns.idxmin()
segment = klines.loc[center - pd.Timedelta(hours=120): center + pd.Timedelta(hours=120)]

# 指標要在完整資料上算完再切片，NEVER 先切片再算，
# 否則切出來的那一小段前面沒有暖機資料，EMA 的起始值會失真
period = 20
sma_line = klines["close"].rolling(period).mean().loc[segment.index]
ema_line = ema(klines, period=period).loc[segment.index]

fig = make_subplots(
    rows=2, cols=1, shared_xaxes=True,
    row_heights=[0.72, 0.28], vertical_spacing=0.04,
    subplot_titles=(
        f"BTC/USDT 現貨 1h：SMA({period}) vs EMA({period})",
        "SMA − EMA（正值代表 EMA 已經先往下）",
    ),
)

fig.add_trace(
    go.Candlestick(
        x=segment.index,
        open=segment["open"], high=segment["high"],
        low=segment["low"], close=segment["close"],
        name="K 線", increasing_line_color="#26a69a", decreasing_line_color="#ef5350",
    ),
    row=1, col=1,
)
fig.add_trace(
    go.Scatter(x=sma_line.index, y=sma_line, name=f"SMA({period})",
               line=dict(color="#1f77b4", width=2)),
    row=1, col=1,
)
fig.add_trace(
    go.Scatter(x=ema_line.index, y=ema_line, name=f"EMA({period})",
               line=dict(color="#ff7f0e", width=2)),
    row=1, col=1,
)
fig.add_trace(
    go.Bar(x=segment.index, y=sma_line - ema_line, name="SMA − EMA",
           marker_color="#9467bd"),
    row=2, col=1,
)
fig.add_hline(y=0, line_width=1, line_color="#888", row=2, col=1)

fig.update_layout(
    height=760, xaxis_rangeslider_visible=False,
    legend=dict(orientation="h", yanchor="bottom", y=1.04),
    margin=dict(l=60, r=30, t=90, b=40),
)
fig.update_yaxes(title_text="價格（USDT）", row=1, col=1)
fig.update_yaxes(title_text="價差（USDT）", row=2, col=1)
fig.update_xaxes(title_text="時間（UTC）", row=2, col=1)
fig.show()
```

圖上會看到三件事。

**急跌開始的頭幾根，兩條線幾乎重疊。** 下半的長條圖還貼著 0。這時候一根大黑 K 對兩者的影響都還小。

**跌到第三、四根，兩條線分開。** EMA 開始明顯低於 SMA，長條圖往上竄。原因就是權重表上那一行：最新那根在 EMA 裡佔 9.5%，在 SMA 裡只佔 5%。

**價格止跌之後，換 EMA 先回頭。** 快，是雙向的。

量化一下這個「快」：從跌勢起點算起，EMA 通常會比 SMA 早兩到三根跌破同一個門檻。以 1 小時 K 線來說就是早兩三個小時。

### 代價：雜訊也跟著放大

同一段程式碼再跑一個統計，看兩條線各自「換方向」幾次：

```python
import numpy as np


def direction_flips(line: pd.Series) -> int:
    """線的一階差分變號幾次，越多代表這條線越常來回擺動。"""
    slope = np.diff(line.dropna().to_numpy())
    return int(np.sum(np.sign(slope[1:]) != np.sign(slope[:-1])))


full_sma = klines["close"].rolling(period).mean()
full_ema = ema(klines, period=period)
print("SMA 方向翻轉次數：", direction_flips(full_sma))
print("EMA 方向翻轉次數：", direction_flips(full_ema))
```

在同一段樣本上，EMA 的翻轉次數大約是 SMA 的 1.5 到 2 倍。這個數字跟前面「早兩三根反應」是同一件事的兩面：EMA 對最新資料更敏感，所以真的有事發生時它先動，沒事只是隨機晃動時它也先動。

所以 EMA **不是** SMA 的升級版，兩者是在同一條軸上取不同的位置：

| | SMA | EMA |
|---|---|---|
| 對最新資料的權重 | 平均分配 | 指數加權，最新那根最重 |
| 反應速度 | 慢 | 快兩到三根 |
| 線的平穩程度 | 較平穩 | 擺動較多 |
| 起始值 | 明確（前 n 根平均） | 需要指定，且影響延續數百根 |
| 缺漏資料 | 給 NaN，很明顯 | 沿用前值，很安靜 |
| 計算方式 | 可向量化 | 遞迴 |

哪一種比較合適，取決於你要用它做什麼判斷、以及你願意接受多少次無效的來回。今天不下這個結論。要回答這種問題必須拿歷史資料實際比較，而那需要一整套驗證流程，Day 19 之後才會有。在那之前，**兩個都留著，都要能算得對**。

## 今日交付物

`quantbot/indicators/ema.py` 完成，並跟兩個對照組都對得起來。

專案長出這幾個檔案：

```
quantbot/
├── quantbot/
│   └── indicators/
│       ├── ma.py            # Day 04
│       └── ema.py           # 今天
├── tests/
│   ├── reference.py         # 今天：手寫遞迴參考實作
│   ├── test_ma.py           # Day 04
│   └── test_ema.py          # 今天
├── scripts/
│   └── verify_ema.py        # 今天：跟 pandas-ta 與參考實作對數字
└── notebooks/
    └── day05_sma_vs_ema.py  # 今天：急跌段的反應速度對照圖
```

驗收標準，六項全過才算完成：

1. `uv run pytest tests/test_ema.py` 全數通過，包含資料不足、只有一根、有缺漏這三個邊界。
2. `uv run python scripts/verify_ema.py` 跑完不觸發 assert，且印出的兩個 `max|diff|` 都小於 `1e-9`。跟 `pandas-ta` 那一行預期是 `0.000e+00`。
3. `ema()` 的簽章跟 Day 04 的 `sma()` 一致（吃 DataFrame、回傳 Series、回傳值有名字），Day 06 要把三個指標接進同一組介面。
4. 程式碼裡沒有任何 Python 層的 `for` 迴圈遍歷 K 線，唯一的迴圈在 `tests/reference.py`，而它只在測試裡跑。
5. 圖畫得出來，而且在急跌那一段能明確看到 EMA 比 SMA 早兩到三根往下。
6. 你能回答這個問題：如果只讀最近 50 根 K 線就開始算 EMA(20)，算出來的值可以信嗎？（不行，warm-up 不足，前面幾百根還沒收斂。）

第六項不是刁難。它是這一天真正要留下的東西：遞迴指標的值取決於你從哪裡開始算，而這件事在研究環境裡幾乎不會出事，會在上線重啟的那一刻出事。

本系列為程式與資料工程的技術分享，所有策略與數字皆為教學範例，不構成投資建議，實際交易請自行評估風險。

## 明天

明天 Day 06，我們處理第三個、也是第一階段最後一個指標：RSI。前面兩天做的是「價格的平均在哪裡」，RSI 換一個問題：**現在的漲跌力道相對於自己最近的表現算強還是算弱**，並把答案壓縮成一個 0 到 100 的數字。

它的計算裡藏著自己實作最常算錯的一處：Wilder 平滑用的是 `α = 1/n`，不是今天的 `2/(n+1)`。寫錯了它照樣輸出 0 到 100 的數字，圖也畫得出來，只有跟對照組對數字才看得出差別。明天會把兩種寫法都算一遍，看它們差多少。

## Reference

- `ewm()` 的 `adjust`、`ignore_na` 與各種週期指定方式的完整定義 — pandas User Guide, "Exponentially weighted windows"：https://pandas.pydata.org/docs/user_guide/window.html#exponentially-weighted-window
- `ewm()` 各參數的行為說明 — pandas API Reference, `DataFrame.ewm`：https://pandas.pydata.org/docs/reference/api/pandas.DataFrame.ewm.html
- 對照組使用的 `ema()` 實作與預設值（含 `sma` 種子開關） — pandas-ta：https://github.com/twopirllc/pandas-ta
- Numba 對遞迴迴圈的加速方式與限制（Day 26 會用到） — Numba Documentation, "Compiling Python code with @jit"：https://numba.readthedocs.io/en/stable/user/jit.html
