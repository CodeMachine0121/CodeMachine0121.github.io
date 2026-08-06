---
title: "Day 12：同樣的價格，有時候很危險有時候沒事：用交易活躍度定義市場的節奏"
datetime: "2026-09-26"
description: "同樣漲 1%，在冷清時段和活躍時段不是同一件事。這篇把活躍度做成 z-score，並處理兩個都不會報錯的錯誤：把當根算進自己的基準會讓暴量低估自己，而用整段樣本算鐘點基準是未來函數——實測它會把一次真實的 100 倍暴量壓成 5 以下的分數。順帶補上 ATR，以及它為什麼在這個專案裡不是 Indicator。"
image: ""
parent: "2026 ithome-鐵人賽: 工程師的量化交易入門：從 K 線到可組合的交易策略引擎 系列"
draft: true
---

## 12 顆 BTC 是多還是少

Day 09 那兩根 K 線，到今天第三次出場，因為它們正好卡在今天要問的問題上：

| 開盤時間（UTC） | 成交量（BTC） | 成交額（USDT） | 成交筆數 |
|---|---|---|---|
| 2026-07-15 20:39 | 12.755 | 829,187 | 581 |
| 2026-07-15 07:46 | 12.883 | 832,009 | 2,426 |

成交量差 1%，成交筆數差 4.2 倍。

現在把問題往前推一步：**12.755 顆 BTC 這個數字本身，算多還是算少？**

它顯然不能單獨回答。同一天的最冷清那一分鐘成交 0.257 顆，最熱鬧那一分鐘成交 204.6 顆——12.755 落在中間偏低。但如果換成某個小幣，一分鐘成交 12 顆可能是它一整天的量。而就算還是 BTC，凌晨五點的 12 顆跟下午兩點的 12 顆也不是同一件事。

所以「活躍度」這種特徵不能輸出絕對值，要輸出**相對於自己平常的程度**。標準做法是 z-score：

```
z = (現在 − 平常) / 平常的標準差
```

聽起來很簡單，一行 pandas 就寫完了。但這一行有兩個地方寫錯不會報錯，而且兩個都會讓回測看起來比實際好。今天大半篇在處理那兩個地方。

另外今天還要補一個 Day 24 會用到的東西：**ATR**。它跟活躍度是同一件事的另一面——活躍度量「多熱」，ATR 量「價格實際走了多少」，而它是決定停損距離的依據。

## 交易概念補課

### 波動率：價格實際走了多少

波動率（volatility）量的是價格變動的幅度，不是方向。

最常見的算法是**已實現波動率**：把一段期間內每根 K 線的對數報酬取平方、加起來、開根號。用對數報酬而不是百分比報酬，因為對數報酬可加——連續兩根的對數報酬相加正好等於兩根合起來的對數報酬，換粒度時不會累積複利的偏差。

波動率跟成交量是兩個不同的東西，而它們會分家。兩種分家的方式都很常見：

- **大量成交但價格不動**：有人在某個價位持續吃貨或出貨，兩邊力道相當。成交量高、波動率低。
- **少量成交但價格亂跳**：沒有流動性，一張小單就把價格推走。成交量低、波動率高。

第二種比第一種危險得多，而只看成交量完全看不出來。

### ATR：帶跳空的波動幅度

ATR（Average True Range，平均真實區間）是另一種波動率，用價格單位表示而不是百分比。

它的核心是「真實區間」：

```
TR = max(高 − 低, |高 − 前收|, |低 − 前收|)
```

第一項是這根 K 線自己的範圍。後兩項處理的是**跳空**：如果這一根整根跳到前一根之上，「高 − 低」可能很小，但實際的價格移動很大。

加密貨幣 24/7 不休市，所以跳空比股市少得多——沒有隔夜、沒有週末休市。但快速行情裡一分鐘跳 1% 的事還是會發生，那時候只看「高 − 低」會低估波動。

ATR 之所以今天就要建起來，是因為 Day 24 決定停損距離時要用它：「停損放在 2 個 ATR 之外」是一個會隨市場波動自動伸縮的規則，而「停損放在 200 USDT 之外」不是。

### 為什麼 24/7 的市場還是有時段節奏

加密貨幣沒有開盤收盤，理論上任何時間都一樣。實際上完全不是。

實測 2025-01-01 到 2026-07-31 的 13,848 根 1 小時 K 線，把成交筆數按 UTC 鐘點分組、除以整體平均：

- 最冷清：**05:00 UTC，0.69 倍**
- 最熱鬧：**14:00 UTC，1.88 倍**
- 兩者相差 **2.71 倍**

14:00 UTC 是美國股市開盤前後（美東早上 9 到 10 點），05:00 UTC 是亞洲的清晨、歐洲的深夜。也就是說即使市場不休息，**人會休息**，而且參與者的地理分布留下了明顯的痕跡。

這件事對「活躍度」的定義有直接影響：凌晨五點的成交筆數比平常多 50%，跟下午兩點的成交筆數比平常多 50%，不是同一種訊號。所以基準怎麼取，是今天的核心問題。

## 工程實作

### 三個角度，各自量不同的東西

「活躍」不是一個量，是三個：

```python
# quantbot/domain/values/activity_measure.py
class ActivityMeasure(StrEnum):
    """用什麼量「這段時間市場有多熱」。三個角度，答案不一樣。

    - TRADE_COUNT：成交筆數。它衡量**參與者的數量與急迫程度**，跟金額無關；
      一筆 100 BTC 的大單只算一筆。
    - VOLUME：成交量。它衡量**換手的規模**，少數幾張大單就能讓它很高。
    - ABSOLUTE_RETURN：這一根的對數報酬取絕對值。它衡量**價格實際走了多少**，
      跟成交多少無關——大量成交但價格不動（有人在特定價位默默吃貨）與少量成交
      但價格亂跳（沒有流動性）都會發生，前兩個量分不出這兩件事。

    三個一起看才完整。Day 09 那兩根 K 線就是例子：成交量幾乎一樣，成交筆數差 4.2 倍。

    用對數報酬而不是百分比報酬：它可加（連續兩根的對數報酬相加等於兩根合起來的
    對數報酬），所以換粒度時不會累積複利的偏差。
    """

    TRADE_COUNT = "trade_count"
    VOLUME = "volume"
    ABSOLUTE_RETURN = "absolute_return"
```

把「用哪個量」做成一個值而不是三個特徵類別，是因為它們的計算流程完全相同（都是取一欄、算 z-score），差別只在取哪一欄。Day 11 的 `PriceSource` 是同一個模式。

`TRADE_COUNT` 那一欄有一個型別上的小麻煩要處理：

```python
# quantbot/domain/values/activity_measure.py
    def of(self, candles: pd.DataFrame) -> pd.Series:
        """從 K 線取出（或算出）這個量。轉換只寫在這裡一份。"""
        if self is ActivityMeasure.TRADE_COUNT:
            # trade_count 是可空的 Int64（Day 02 訂的），算 z-score 前要先變 float
            return (candles["trade_count"].astype("Float64").astype("float64")).rename(
                str(self)
            )
        if self is ActivityMeasure.VOLUME:
            return candles["volume"].astype("float64").rename(str(self))
        return self._absolute_log_return(candles["close"]).rename(str(self))
```

Day 02 把 `trade_count` 訂成可空的 `Int64`，理由是 REST 那條路徑不提供這一欄。可空整數不能直接參與浮點運算，所以要先過 `Float64` 再到 `float64`——兩段轉換，中間那一步是為了讓 NA 變成 NaN 而不是丟例外。

### 陷阱一：當根不能算進自己的基準

z-score 的分子是「現在 − 平常」。「平常」怎麼算？

直覺的寫法是這樣：

```python
history = values.rolling(window)
z = (values - history.mean()) / history.std()
```

這一行有一個安靜的錯誤：`rolling(window)` **包含當根**。也就是說一根暴量的 K 線會被算進自己的「平常」裡，把平均與標準差都拉高，於是它自己的 z-score 被系統性低估。

正確的寫法是先 `shift(1)`：

```python
# quantbot/domain/features/trading_activity.py
    def _rolling_z_score(self, values: pd.Series) -> pd.Series:
        """跟最近 window 根比。

        **視窗要排除當根**：shift(1) 之後再 rolling。不排除的話，當根自己會被算進
        「平常」的平均與標準差裡，於是一根暴量的 K 線會自己把基準拉高，z-score
        因此被系統性低估。這是未來函數的近親——不是偷看未來，是把當下混進歷史。
        """
        history = values.shift(1).rolling(self.window)
        deviation = history.std()
        return (values - history.mean()) / deviation.where(deviation > 0)
```

「未來函數的近親」這個說法值得展開。Day 04 講的未來函數是「用了還沒發生的資料」；這裡不是——當根的成交筆數在收盤時確實已經知道了。問題在於它被放進了「歷史基準」這個角色，而基準的定義應該是「在這根之前，正常的樣子」。混進當根之後，那個基準就不再是一個獨立的參考點。

差多少？用一段平穩的資料加最後一根三倍暴量來測：

```python
def test_the_rolling_window_excludes_the_current_bar():
    """當根被算進基準的話，暴量的 K 線會自己把基準拉高，z-score 被系統性低估。

    這裡用一段完全平穩的資料加上最後一根暴量：如果視窗含當根，最後一根的
    標準差會被自己撐大，z-score 就縮小了。
    """
    counts = np.append(jittered(30), 3_000)
    view = make_view(trade_counts=counts)
    values = view.candles.frame["trade_count"].astype("Float64").astype("float64")

    excluding = TradingActivity(window=10).compute(view).iloc[-1]

    including_history = values.rolling(10)
    including = ((values - including_history.mean()) / including_history.std()).iloc[-1]

    assert excluding > including * 2
```

排除當根的分數是含當根的兩倍以上。這個差距的方向永遠一致（含當根一定低估），所以它不是雜訊，是偏差。

順帶提一件測試資料的事。第一版的測試資料用的是完全固定的序列（`[1000] * 30`），結果全部失敗——標準差是 0，z-score 沒有定義。所以測試資料要有一點自然的起伏：

```python
def jittered(count: int, *, centre: int = 1_000, seed: int = 20260926) -> np.ndarray:
    """有一點自然起伏的基準序列。

    完全固定的序列標準差是 0，z-score 沒有定義——測試資料不能比真實資料更乾淨，
    否則測到的是一個不存在的情況。
    """
    generator = np.random.default_rng(seed)
    return generator.normal(centre, centre * 0.05, count).round().astype(int)
```

「測試資料不能比真實資料更乾淨」這件事在這裡是實際踩到的：一個完美平穩的市場不存在，而拿它當測試資料，測到的是一個永遠不會發生的情況。

### 陷阱二：鐘點基準寫成一行就是未來函數

前面量到時段節奏差 2.71 倍，所以「跟同一個鐘點比」是必要的。

這件事寫成一行非常誘人：

```python
z = (values - values.groupby(hour).transform("mean")) / values.groupby(hour).transform("std")
```

它是錯的，而且錯得很嚴重：`transform("mean")` 用的是**整段樣本**的同鐘點平均。也就是說在 2026-03-01 那一天，鐘點 3 的基準裡含著 2026-08 的資料。

這是標準的未來函數。而它在回測上特別會騙人，因為它讓活躍度過濾條件看起來特別靈——它知道後面會發生什麼。

正確的寫法是每個鐘點各自往前累積自己的歷史：

```python
# quantbot/domain/features/trading_activity.py
    def _hour_of_day_z_score(self, values: pd.Series) -> pd.Series:
        """跟同一個鐘點的歷史比，而且只用**過去**的同鐘點資料。

        直覺的寫法是 values.groupby(hour).transform("mean")，一行就好。但那個平均
        用了整段樣本，包含未來——在 2026-03-01 那天，基準裡含著 2026-08 的資料。
        回測時這種寫法會讓活躍度過濾條件看起來特別靈，因為它知道後面會發生什麼。

        正確的寫法是 shift(1) 之後 expanding()：每個鐘點各自往前累積自己的歷史。
        代價是前面幾天沒有值（每個鐘點都要先看過至少兩次），這是應該付的代價。
        """
        hour = pd.Series(pd.DatetimeIndex(values.index).hour, index=values.index)
        grouped = values.groupby(hour)
        history = grouped.shift(1)
        mean = history.groupby(hour).expanding().mean().reset_index(level=0, drop=True)
        deviation = (
            history.groupby(hour).expanding().std().reset_index(level=0, drop=True)
        )
        return (values - mean) / deviation.where(deviation > 0)
```

`groupby(hour).shift(1)` 是在**每個鐘點的組內**往後挪一格，所以鐘點 3 的第 n 天看到的是鐘點 3 的第 n−1 天，而不是前一個小時。`expanding()` 再往前累積全部歷史。最後的 `reset_index(level=0, drop=True)` 是為了把 `groupby().expanding()` 多加出來的那一層索引拿掉，讓結果對得回原本的時間索引。

錯誤的版本會錯多少？做一個極端但乾淨的實驗：20 天的每小時資料，鐘點 3 一直很冷清（100 筆上下），最後一天的鐘點 3 突然暴量到 10,000。

```python
def test_hour_of_day_baseline_only_uses_the_past():
    """整段樣本算鐘點平均是未來函數。這裡證明實作用的是逐步展開的基準。

    資料是 20 天的每小時，鐘點 3 一直很冷清（100 筆），最後一天的鐘點 3 突然
    暴量到 10,000。如果基準用了整段樣本，那個 10,000 會被算進鐘點 3 的平均與
    標準差裡，把自己的 z-score 壓下來。
    """
    ...
    assert expanding_score > 100  # 對過去的鐘點 3 來說這是天文數字
    assert naive < 5  # 用了未來資料的版本把自己攤平了
```

- 正確版本：z-score **超過 100**。對「過去 19 天的鐘點 3 都在 100 筆上下」來說，10,000 筆是天文數字，這個分數是對的。
- 一行版本：z-score **小於 5**。因為那個 10,000 自己被算進了鐘點 3 的標準差裡，把分母撐得非常大。

一個真實發生的 100 倍暴量，被壓成「有點不尋常」。而這個錯誤在整段樣本上是自我掩蓋的：越極端的事件被壓得越厲害，所以看圖的時候會覺得「這個特徵蠻穩定的」。

### 暖機期沒辦法用一個數字表達

`Feature` 協定要求每個特徵回答 `warmup_bar_count`。滾動基準很好答（一個視窗）；鐘點基準答不出來：

```python
# quantbot/domain/features/trading_activity.py
    @property
    def warmup_bar_count(self) -> int:
        """滾動基準要滿一個視窗。

        鐘點基準要的更多：每個鐘點各自需要 window 個樣本，而一天只出現一次某個
        鐘點，所以真正的暖機是 window 天。以根數表達的話是 window × 一天幾根，
        而「一天幾根」取決於 timeframe，這個類別不知道。所以這裡回一個誠實的
        下限，實際的暖機由第一個非 NaN 決定——這也是為什麼管線要靠 NaN 而不是
        只靠這個數字來切暖機期。
        """
        return self.window
```

這是介面設計上的一個真實限制，值得誠實寫出來而不是硬湊一個數字。`warmup_bar_count` 回的是下限，真正的暖機期由「第一個非 NaN 出現在哪裡」決定。Day 15 的管線因此不能只信這個數字——它要同時用 NaN 來切。

實測 5 天的每小時資料：鐘點基準的前 48 根（前兩天）全是 NaN，因為每個鐘點都要先出現至少兩次才有標準差。

### ATR：它為什麼不是 Indicator

Day 04 訂的 `Indicator` 是一個 ABC，`compute()` 會先把 `self.column` 那一欄取出來、轉成 `float64`，再交給子類別的 `_compute()`。SMA、EMA、RSI 三個都只吃一欄（收盤價），所以那個契約很合身。

ATR 吃三欄。硬要塞進 `Indicator` 只有兩條路：破壞它的契約（讓 `_compute` 收整張表），或在 ATR 裡繞過基底類別自己去拿資料。前者會影響三個已經寫好的指標，後者讓繼承變成裝飾。

所以它是 `Feature`：

```python
# quantbot/domain/features/average_true_range.py
class ATR:
    """平均真實區間。實作 domain 的 Feature，**不是** Day 04 的 Indicator。

    為什麼不是 Indicator：那個 ABC 的契約是「吃一個欄位、回一條序列」，`compute()`
    會先把 `self.column` 取出來轉成 float64 再交給子類別。ATR 需要高、低、收三欄，
    契約裝不下它。這不是分類學上的爭論——真的寫下去就會發現要嘛破壞 Indicator 的
    契約，要嘛在 ATR 裡繞過基底類別，兩種都比「它是另一種東西」糟。

    真實區間取三者的最大值，第三項是它跟「高減低」的差別所在：

        TR = max(高 − 低, |高 − 前收|, |低 − 前收|)

    後兩項處理的是**跳空**：如果這一根整根跳到前一根之上，「高 − 低」可能很小，
    但實際的價格移動很大。加密貨幣 24/7 不休市，跳空比股市少得多，但快速行情裡
    一分鐘跳 1% 的事還是會發生，那時候只看「高 − 低」會低估波動。

    ATR 是 Day 24 決定停損距離的依據，所以它算出來的單位很重要：它是**價格單位**，
    不是百分比。跨交易對比較時要自己除以價格。
    """
```

這個判斷的依據不是「哪個分類比較漂亮」，而是「哪一個不用改已經寫好的東西」。Day 10 訂 `Feature` 的時候特別提過 `Indicator` 是 ABC（有共用實作）而 `Feature` 是 Protocol（沒有），今天就是那個區分第一次派上用場：ATR 跟 OBI 之間沒有一行共用實作，所以 Protocol 是對的。

它重用 `WilderSmoother`——Day 06 為 RSI 寫的那個平滑：

```python
# quantbot/domain/features/average_true_range.py
from quantbot.domain.indicators.rsi import WilderSmoother
```

Wilder 在同一篇文章裡提出 RSI 與 ATR，兩者用的是同一種平滑（α = 1/n），所以這裡直接用那個類別而不是再寫一份 `ewm(alpha=1/period, adjust=False)`。Day 06 花了一整節說明那一行有多容易寫錯（α 寫成 `2/(n+1)` 的話中位數差 4.94 個 RSI 點），複製它等於把那個陷阱複製一份。

### 真實區間的第一筆是 NaN，不是「高 − 低」

```python
# quantbot/domain/features/average_true_range.py
    @staticmethod
    def true_range(candles: pd.DataFrame) -> pd.Series:
        """三個候選取最大值，全部向量化。

        第 0 筆是 NaN 而不是「高 − 低」：沒有前一根的收盤價，所以那兩個跳空項
        沒有定義。填成「高 − 低」會讓第一根的 TR 系統性偏小，而那個偏差會被
        Wilder 平滑一路帶進暖機期。WilderSmoother 的輸入慣例正是第 0 筆為 NaN。
        """
        previous_close = candles["close"].shift(1)
        candidates = pd.concat(
            {
                "high_low": candles["high"] - candles["low"],
                "high_close": (candles["high"] - previous_close).abs(),
                "low_close": (candles["low"] - previous_close).abs(),
            },
            axis=1,
        )
        # skipna=False 是必要的：第 0 筆只有 high_low 有值，用預設的 skipna=True
        # 會挑出那個值，於是第 0 筆變成「高 − 低」而不是 NaN
        return candidates.max(axis=1, skipna=False).rename("true_range")
```

`skipna=False` 那一行是這段最容易漏的地方。`max(axis=1)` 預設會跳過 NaN，所以第 0 筆會挑出唯一有值的 `high_low`，於是第一筆 TR 變成「高 − 低」——一個系統性偏小的值，而它會被 Wilder 平滑一路帶進整個暖機期。

不少現成的 ATR 實作就是這樣寫的，所以跨實作對數字時暖機期會對不上。這跟 Day 06 發現 `pandas-ta` 的 RSI 在暖機期跟教科書定義不一致是同一類問題：**遞迴指標的起始值選擇會影響前面幾百根**。

跟迴圈版對數字（照 Wilder 的定義逐根寫）：

```python
def reference_atr(highs, lows, closes, period: int = PERIOD) -> np.ndarray:
    """照 Wilder 的定義寫的迴圈版對照組。只在測試裡用，NEVER 進正式路徑。"""
    count = len(closes)
    true_range = np.full(count, np.nan)
    for index in range(1, count):
        previous_close = closes[index - 1]
        true_range[index] = max(
            highs[index] - lows[index],
            abs(highs[index] - previous_close),
            abs(lows[index] - previous_close),
        )
    average = np.full(count, np.nan)
    average[period] = np.mean(true_range[1 : period + 1])
    for index in range(period + 1, count):
        average[index] = (
            average[index - 1] * (period - 1) + true_range[index]
        ) / period
    return average
```

600 根隨機序列上，向量化版本與迴圈版的誤差在 `1e-9` 以內。這是 Day 05、Day 06 建立的習慣：每個自己實作的東西都要有一份照定義寫的慢版本當對照組。

### ATR 的單位是價格，不是百分比

這件事寫成測試比寫成註解有用，因為 Day 24 要靠它：

```python
def test_atr_is_in_price_units_not_percent():
    """兩段形狀相同、價位差一千倍的資料，ATR 也差一千倍。

    這是 Day 24 用它決定停損距離時必須知道的事：它不能直接跨交易對比較。
    """
    closes = np.full(60, 100.0)
    small = make_view(highs=closes + 1, lows=closes - 1, closes=closes)
    large = make_view(
        highs=closes * 1_000 + 1_000, lows=closes * 1_000 - 1_000, closes=closes * 1_000
    )

    ratio = ATR(PERIOD).compute(large).iloc[-1] / ATR(PERIOD).compute(small).iloc[-1]

    assert ratio == pytest.approx(1_000.0)
```

所以「停損放在 2 個 ATR 之外」是一個可以跨交易對用的規則，而「ATR 大於 300 就不進場」不是——後者在 BTC 上是一個門檻，在 ETH 上是一道永遠不會被觸發的牆。

## 實際跑一次

```bash
uv run python -m quantbot.entrypoints.activity_command \
    --symbol BTC/USDT --market spot --timeframe 1h \
    --start 2025-01-01 --end 2026-08-01
```

```
13,848 根 K 線：2025-01-01 00:00:00+00:00 → 2026-07-31 23:00:00+00:00

成交筆數的時段節奏（相對於整體平均）
  最冷清：05:00 UTC，0.69 倍
  最熱鬧：14:00 UTC，1.88 倍
  最熱與最冷相差 2.71 倍

同一個絕對值在不同基準下的分數（最後一根）
  rolling：-0.24（可用 13,656 根，超過 +2 的有 5.86%）
  hour_of_day：-0.37（可用 13,776 根，超過 +2 的有 4.59%）

ATR(14)：293.05 USDT（收盤價的 0.47%）
```

幾件事值得讀。

**時段節奏是真的，而且不小。** 2.71 倍不是統計上的細微差異——凌晨五點的正常成交筆數，在下午兩點會被當成極度冷清。任何用絕對門檻寫的活躍度條件（「成交筆數超過 5,000 才進場」）在這種結構下等於一個時段過濾器，而寫的人可能沒有意識到。

**兩種基準給出不同的答案。** 最後一根在滾動基準下是 −0.24，在鐘點基準下是 −0.37。兩個都對，它們回答的是不同的問題：滾動基準說「比最近一週稍微冷」，鐘點基準說「比同一個鐘點的歷史更冷一些」。

**觸發頻率也不同**：超過 +2 的比例是 5.86% 對 4.59%。如果偏離是常態分布，超過 +2 應該是 2.28%——兩個都明顯偏高，說明活躍度的分布有厚尾（暴量比常態分布預期的頻繁得多）。這件事對「用 z-score > 2 當條件」有直接影響：它不是「百分之二的罕見事件」，實測是百分之五到六。

**ATR 是收盤價的 0.47%。** 1 小時線上，BTC 的平均真實區間大約是價格的半個百分點。這個數字在 Day 24 會直接變成停損距離：2 個 ATR 大約是 1%。

## 視覺化：星期 × 鐘點的熱力圖

時段節奏有兩個週期疊在一起——一天之內的鐘點節奏，一週之內的星期節奏。折線圖只能表達一個，另一個會被攤平，所以用熱力圖：

```python
# quantbot/infrastructure/charting/plotly_activity_heatmap_renderer.py
class PlotlyActivityHeatmapRenderer:
    """星期 × 鐘點的活躍度熱力圖。

    用熱力圖而不是折線圖，因為要看的是**兩個週期疊在一起**的結構：一天之內的
    時段節奏，以及一週之內的星期節奏。折線圖只能表達一個週期，另一個會被攤平。

    格子裡放的是「該時段的平均值除以整體平均」，也就是倍數。用倍數而不是原始值，
    圖的色階才不會被幣價或交易對的量級綁住，換一個交易對還是同一張圖看得懂。
    """
```

格子裡放倍數而不是原始值，是為了讓這張圖換一個交易對還能用。原始值的色階會被幣價綁住，而倍數是無單位的。

那張表本身是一個可以單獨取用的方法，不是埋在畫圖流程裡的中間變數：

```python
# quantbot/infrastructure/charting/plotly_activity_heatmap_renderer.py
    def multiples(self, view: MarketView) -> pd.DataFrame:
        """每個（星期, 鐘點）格子的平均值 ÷ 整體平均。

        這張表本身就是結論，所以它是一個可以被單獨取用、單獨測試的方法，
        而不是埋在畫圖流程裡的中間變數。
        """
        values = self._measure.of(view.candles.frame)
        times = pd.DatetimeIndex(values.index)
        tabular = pd.DataFrame(
            {
                "weekday": times.dayofweek,
                "hour": times.hour,
                "value": values.to_numpy(),
            }
        )
        grid = tabular.pivot_table(
            index="weekday", columns="hour", values="value", aggfunc="mean"
        )
        return grid / float(values.mean())
```

前面那支指令印出的「最冷清 05:00、最熱鬧 14:00」就是從這張表算的——圖與數字用的是同一份計算，不會出現「圖上看起來是這樣、文字寫的是那樣」的落差。

打開產出的 html，會看到週末整片偏冷、平日下午整片偏熱，而 14:00 那一欄從週一到週五都是最深的紅色。這張圖沒有交易訊號，它的用途是**讓「時段節奏」從一句話變成一個看得到的結構**，之後把它寫進過濾條件時才知道自己在濾什麼。

## 今日交付物

```
quantbot/
├── domain/
│   ├── values/
│   │   ├── activity_measure.py                 今天：三個角度
│   │   └── activity_baseline.py                今天：ROLLING / HOUR_OF_DAY
│   └── features/
│       ├── trading_activity.py                 今天：z-score
│       └── average_true_range.py               今天：ATR（是 Feature 不是 Indicator）
├── infrastructure/charting/
│   └── plotly_activity_heatmap_renderer.py     今天
├── entrypoints/activity_command.py             今天
└── tests/domain/features/
    ├── test_trading_activity.py                今天
    └── test_average_true_range.py              今天
```

### 驗收標準

七項全過才算完成：

1. `uv run pytest tests/domain/features/test_trading_activity.py` 全綠，包含「排除當根」與「鐘點基準只用過去」兩個測試。這兩個是今天的重點，它們守的都是不會報錯的錯誤。
2. 鐘點基準那個測試要看到具體的落差：正確版本的 z-score 超過 100，一行 `transform("mean")` 版本小於 5。
3. `uv run pytest tests/domain/features/test_average_true_range.py` 全綠，含真實區間第一筆是 NaN、跳空被算進去、與迴圈版對照組誤差小於 `1e-9`、ATR 是價格單位四項。
4. `uv run python -m quantbot.entrypoints.activity_command --symbol BTC/USDT --market spot --timeframe 1h --start 2025-01-01 --end 2026-08-01` 印出時段節奏（最冷清與最熱鬧相差 2.7 倍上下）、兩種基準的分數與觸發比例、以及 ATR。
5. 兩種基準的「超過 +2 的比例」都明顯高於常態分布的 2.28%。這是活躍度厚尾的證據，不是計算錯誤。
6. 打開 `notebooks/day12-spot_BTCUSDT_1h-activity.html`：週末整片偏冷、平日 14:00 那一欄最深，色階以 1.0 為中心。
7. `uv run mypy quantbot` 與 `uv run lint-imports` 全過。

第 2 項是今天最有價值的一項。那兩個數字（100 對 5）是同一份資料、同一個問題、兩種寫法，而錯的那種寫法只有一行、看起來更乾淨。

> 免責聲明：本文為程式與資料工程的技術分享，所有數字皆為教學範例，不構成投資建議；活躍度與 ATR 都是對已發生行情的描述，不預測後續走勢。

## 明天

到今天為止的五個東西（三個指標、OBI、VWAP、活躍度、ATR）都是**時間序列特徵**：每一根 K 線都有一個值，值的意義是連續的。

明天要做的是不一樣的形狀：**事件**。

假突破是新手最常虧錢的地方之一——價格衝破前高，看起來要走了，然後馬上被打回來。「衝破前高」不是一個連續的量，它是一個在某幾根 K 線上發生、其餘時候不發生的事件。而事件式特徵有一個時間序列特徵沒有的陷阱：**「前高」這個東西非常容易在計算時把當根算進去**，而那正是 Day 04 警告過的未來函數，只是這次它藏在 `rolling().max()` 裡。

Day 13 會定義一個真假突破的判斷，並用歷史資料統計兩者的比例與特徵分布。也會示範事件式特徵怎麼跟時間序列特徵接在同一張表上——那是 Day 15 的管線要處理的最後一種形狀。

## Reference

- [官方 K 線的 `trade_count` 與 `taker_buy_base_volume` 欄位定義 — Binance Spot API Documentation, Market Data Endpoints](https://developers.binance.com/docs/binance-spot-api-docs/rest-api/market-data-endpoints)
- [`groupby(...).expanding()` 的語意與它多出來的那一層索引 — pandas documentation, Windowing operations](https://pandas.pydata.org/docs/user_guide/window.html#expanding-window-functions)
- [`DataFrame.max` 的 `skipna` 預設為 True，這是真實區間第一筆會被填成「高減低」的原因 — pandas documentation, `DataFrame.max`](https://pandas.pydata.org/docs/reference/api/pandas.DataFrame.max.html)
- [`pivot_table` 做二維聚合 — pandas documentation, `pivot_table`](https://pandas.pydata.org/docs/reference/api/pandas.pivot_table.html)
