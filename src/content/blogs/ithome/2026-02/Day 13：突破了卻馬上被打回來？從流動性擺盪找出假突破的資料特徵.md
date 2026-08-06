---
title: "Day 13：突破了卻馬上被打回來？從流動性擺盪找出假突破的資料特徵"
datetime: "2026-09-27"
description: "「前 20 根最高價」寫成 rolling(20).max() 的話，突破訊號會完全消失而程式不會報錯。這篇處理事件式特徵的第一個陷阱，然後在 1,356 次實際突破上比較守住與被打回來兩組：守住的那些突破幅度是 1.43 個 ATR、被打回來的只有 0.38。最後用 45 分鐘的掛單簿實測回答 Day 10 留下的問題——深度變薄，有 75.83% 是撤單而不是成交。"
image: ""
parent: "2026 ithome-鐵人賽: 工程師的量化交易入門：從 K 線到可組合的交易策略引擎 系列"
draft: true
---

## 一個會讓訊號完全消失的寫法

前面四天的特徵都是連續的：每一根 K 線都有一個值，RSI 是 43.2、OBI 是 −0.17、偏離度是 1.4。今天的東西不一樣——它絕大多數時候是 0，偶爾是 1。

先看要做什麼。「突破前高」聽起來是最好寫的條件之一：

```python
prior_high = candles["high"].rolling(20).max()
breakout = candles["high"] > prior_high
```

兩行，看起來沒有任何問題。跑下去，`breakout.sum()` 是 **0**。

原因是 `rolling(20).max()` **包含當根**。當根的高點本身就是那 20 個候選值之一，所以它最多只能等於那個最大值，不可能大於。這個條件永遠不成立。

這種錯誤的形狀很值得注意：它不是「數字算錯了」，是**事件完全消失**。一個回傳空訊號的策略在回測上看起來只是「這段行情沒有機會」，而那句話聽起來完全合理。Day 04 講未來函數的時候處理的是「訊號變得太好」；這裡是反過來，訊號直接不存在。

所以今天有一個類別的存在理由就是那個 `shift(1)`，其他什麼都不做。

之後是今天真正要回答的問題：**假突破有多常見，而它跟真突破在突破當下有什麼看得出來的差別。**

## 交易概念補課

### 突破與假突破

「突破」指的是價格越過某個之前守住的價位，最常見的定義就是前 N 根的最高價。它背後的想法是：那個價位之前擋住了價格，現在擋不住了，所以擋它的力量消失了。

「假突破」是價格越過之後很快又回到原來的區間裡。對照著看：真突破之後價格繼續往上，跟進的人賺錢；假突破之後價格掉回來，剛進場的人套在最高點。

這裡有一個要先講清楚的事：**「真」與「假」是回頭看才知道的。** 突破的那一刻，兩者長得一模一樣——都是價格越過了前高。這句話決定了今天整段程式碼的結構，等一下會展開。

### 停損獵殺：為什麼前高前低特別容易發生這種事

假突破之所以特別集中在前高前低附近，有一個結構性的原因。

前高是一個很多人會關注的價位，所以：做多的人常把停損掛在前低之下，等突破的人常把買單掛在前高之上。也就是說**前高前低附近堆著一大群條件單**。

價格一旦碰到那個價位，那些單子會集中成交，於是產生一波看起來很有力的成交量。這一波成交把價格推得更遠，吸引更多人跟進——然後如果原本沒有真實的買盤在後面撐著，價格就掉回來。

這個現象常被叫做「停損獵殺」（stop hunting）。要注意的是它不必是誰刻意做的：光是「條件單集中在同一個價位」這個結構本身就足以產生這種形狀。把它當成陰謀會導致錯誤的結論；把它當成一個**可觀察的市場結構**才能寫成程式。

## 工程實作

### 一個只做 shift 的類別

```python
# quantbot/domain/features/prior_extreme.py
class PriorExtreme:
    """過去 N 根的最高價（或最低價），**保證不含當根**。實作 domain 的 Feature。

    這是全系列第二次正式處理未來函數，而它的形狀跟 Day 04 那次不一樣。Day 04 的
    問題是「用當根收盤價的訊號假設能用當根開盤價成交」；這裡的問題更隱蔽：

        candles["high"].rolling(20).max()

    這一行算出來的「前 20 根最高價」**包含當根自己**。於是「當根的高點突破前高」
    這個條件永遠不會成立——因為當根的高點本來就是那個最大值的候選之一，
    它最多只能等於前高，不可能大於。

    症狀不是「訊號變少」，是**訊號完全消失**，而程式不會有任何異常。這種錯誤比
    算錯數字更難察覺，因為輸出是一個空的訊號序列，看起來像「這段行情沒有突破」。

    所以 shift(1) 寫在這個類別裡，而且它是這個類別存在的唯一理由。任何要用「前高」
    的地方 MUST 走這裡，NEVER 自己寫 rolling().max()。
    """
```

「一個類別只為了一行 `shift(1)`」看起來很誇張。但這個決定的依據不是那行程式碼有多長，是**它被寫錯的機率有多高、以及寫錯的後果有多難發現**。同樣的判斷 Day 06 已經做過一次：`WilderSmoother` 也只有一個 `ewm(alpha=...)`，而它存在的理由是 α 很容易寫成 `2/(n+1)`。

把它釘成測試：

```python
def test_prior_extreme_excludes_the_current_bar():
    """這是今天最重要的一個測試。

    含當根的話，「當根高點大於前高」永遠不成立——當根的高點本來就是那個最大值的
    候選之一。症狀不是訊號變少，是訊號完全消失，而程式不會有任何異常。
    """
    view = make_view(highs=[10.0, 11.0, 12.0, 20.0])
    feature = PriorExtreme(side=ExtremeSide.HIGH, window=3)

    prior = feature.compute(view)

    assert pd.isna(prior.iloc[2])  # 前面只有兩根，視窗還沒滿
    assert prior.iloc[3] == pytest.approx(12.0)  # 前三根的最高是 12，不是 20
    # 含當根的寫法會得到 20，於是「20 > 前高」不成立
    including = view.candles.frame["high"].rolling(3).max()
    assert including.iloc[3] == pytest.approx(20.0)
```

還有一個測試專門示範錯誤的**形狀**，因為那比示範錯誤的數字有用：

```python
def test_the_naive_rolling_version_finds_nothing_at_all():
    """把 shift 寫掉的版本，在一段一路創新高的資料上找不到任何突破。

    這個測試的價值在於它示範了錯誤的**形狀**：不是數字錯，是事件消失。
    一個回傳空訊號的策略在回測上看起來只是「這段行情沒有機會」。
    """
    highs = np.arange(10.0, 40.0)  # 每一根都比前一根高
    view = make_view(highs=highs)

    correct = Breakout(side=ExtremeSide.HIGH, window=5).events(view)
    naive = view.candles.frame["high"] > view.candles.frame["high"].rolling(5).max()

    assert correct.sum() == len(highs) - 5  # 視窗滿了之後每一根都是突破
    assert naive.sum() == 0
```

一段每根都創新高的資料，正確的版本找到 25 次突破，錯誤的版本找到 0 次。

### 前高與前低不是「同一件事換個方向」

上下兩側的差別有三處，而它們必須一起翻：欄位（`high` 對 `low`）、聚合（`max` 對 `min`）、比較方向（`>` 對 `<`）。少翻任何一個，算出來還是一個合理的布林序列。

所以它們收在一個值裡：

```python
# quantbot/domain/values/extreme_side.py
class ExtremeSide(StrEnum):
    """要看前高還是前低。

    兩者不是「同一件事換個方向」——它們用的欄位不同（high 對 low）、比較方向不同
    （突破是大於前高，跌破是小於前低），而且 rolling 的聚合函式也不同。把它們寫成
    一個帶 bool 參數的函式，會讓每個呼叫端都要自己記得三件事要一起翻。
    """

    HIGH = "high"
    LOW = "low"

    def rolling_extreme(self, values: pd.Series, window: int) -> pd.Series:
        """過去 window 根的極值。**呼叫端負責先 shift**，這裡不做。

        不在這裡 shift 是刻意的：要不要含當根，是使用這個值的人才知道的事
        （畫圖時想含、判斷突破時 NEVER 含），寫死在這裡會讓其中一種用法
        必須繞過它。PriorExtreme 那個特徵才是「保證不含當根」的那一層。
        """
        window_view = values.rolling(window)
        return window_view.max() if self is ExtremeSide.HIGH else window_view.min()

    def breaks(self, values: pd.Series, threshold: pd.Series) -> pd.Series:
        """突破的方向。前高要「大於」，前低要「小於」。"""
        return values > threshold if self is ExtremeSide.HIGH else values < threshold
```

`rolling_extreme` 刻意不做 `shift`。這看起來跟前一節矛盾（不是說 shift 很重要嗎），但它們是兩層不同的東西：這個值提供的是「極值怎麼算」，而「要不要含當根」是使用者的決定。保證不含當根的那一層是 `PriorExtreme`。把 shift 塞進底層，畫圖那種需要含當根的用法就得繞過它，而繞過去的程式碼就是下一個 bug 的位置。

### 事件不是另一種型別

```python
# quantbot/domain/features/breakout.py
class Breakout:
    """突破事件：這一根的高點有沒有超過前高（或低點跌破前低）。實作 domain 的 Feature。

    它是這個系列第一個**事件式**特徵，跟前面所有特徵的形狀不同。前面那些每一根都
    有一個連續的值（RSI 是 43.2、OBI 是 −0.17）；這一個絕大多數時候是 0，偶爾是 1。

    這個差別會一路影響到後面：

    - 統計上：事件稀疏，所以樣本數少得多。一年的 1 小時線有 8,760 根，其中突破
      可能只有幾百次。Day 21 會處理「樣本數少讓回測的統計意義變薄」這件事。
    - 介面上：它照樣回傳一條與 K 線等長、index 相同的序列（只是值是 0 與 1），
      所以它不需要特別的介面。**事件不是另一種型別，是另一種取值。**

    輸出用 float64 的 0.0／1.0 而不是 bool：Day 15 的管線會把所有特徵 concat 成
    一張表，混入 bool 欄位會讓那張表的 dtype 變成 object，而 object 欄位的算術
    運算會慢一個數量級，也不再支援 NaN 表達暖機期。
    """
```

Day 10 訂 `Feature` 協定的時候沒有為事件留任何特別的位置，而今天證明了不需要——事件照樣是「一條與 K 線等長、index 相同的序列」。這是介面訂得夠窄的好處：它沒有預先為想像中的需求開洞。

`float64` 而不是 `bool` 那個決定值得一個測試，因為它的後果要到 Day 15 才會顯現：

```python
def test_output_is_float_not_bool():
    """Day 15 的管線會把所有特徵 concat 成一張表，bool 欄位會讓 dtype 變成 object。"""
    view = make_view(highs=np.arange(10.0, 30.0))
    values = Breakout(side=ExtremeSide.HIGH, window=5).compute(view)

    assert values.dtype == np.dtype("float64")
    assert set(values.dropna().unique()) <= {0.0, 1.0}
```

### 突破了「多少」也是資訊

`events()` 把「勉強擦過去 0.5 USDT」與「大幅突破 300 USDT」當成同一件事。那顯然丟掉了東西：

```python
# quantbot/domain/features/breakout.py
    def excess(self, view: MarketView) -> pd.Series:
        """突破了多少，以價格單位表示。沒突破的那幾根是 0。

        「突破 0.3 USDT」與「突破 300 USDT」是完全不同的事件，而 events() 把它們
        當成同一件事。這個量在 Day 13 的統計裡用來檢驗「勉強擦過去的突破是不是
        比較容易失敗」。
        """
```

它是價格單位，所以要跨時間比較必須先除以某個尺度。今天用的尺度是 Day 12 的 ATR——那正是 ATR 存在的用途之一。

### 標籤與特徵：今天最重要的界線

要統計「假突破多不多」，就得先給每次突破貼上真或假。而那件事**一定要看未來**：突破的那一刻，真假是不存在的資訊。

這個界線在程式碼裡必須是硬的，所以標籤不是特徵：

```python
# quantbot/domain/values/breakout_label.py
class BreakoutLabel(StrEnum):
    """一次突破後來守住了沒有。

    這是**標籤**，不是特徵。差別很重要，而且它是今天最需要講清楚的一件事：

    - 特徵是突破當下觀察得到的東西（突破了多少、成交量多不多、掛單簿哪一側薄）。
      它可以進策略，因為在做決定的那一刻它就在手上。
    - 標籤要看**後來**發生什麼，所以它一定用到未來資料。它只能用在分析與統計，
      NEVER 進策略——把標籤當條件用就是未來函數，而且是最嚴重的那一種：
      回測會近乎完美，實盤完全不能動。

    這個型別故意只有兩個值。真實的突破結果是連續的（守住多久、走了多遠），
    但要回答「假突破多不多」這個問題，二分法就夠，而且它不需要挑門檻的參數。
    """

    HELD = "held"
    FAILED = "failed"
```

界線在程式碼裡的具體表現是三件事：貼標籤的東西是一個 `Service` 而不是 `Feature`、它不實作 `Feature` 協定、它不會進 Day 15 的特徵註冊表。也就是說**策略引擎根本拿不到它**——這比寫一行「請不要拿去當條件」的註解可靠得多。

```python
# quantbot/domain/services/breakout_labelling_service.py
class BreakoutLabellingService:
    """給每次突破貼上「守住了」或「被打回來」。

    **這個 service 一定會用到未來資料，而那是它的工作。** 它產出的是標籤，不是特徵，
    所以它 NEVER 出現在策略路徑上——只出現在分析與統計裡。這個界線在程式碼裡的
    表現方式是：它回傳的東西不叫 feature、不實作 Feature 協定，也不進特徵註冊表。

    定義只有一句：突破之後 horizon 根之內，價格有沒有跌回**被突破的那個價位**。

    「被突破的價位」是前高（前低），不是突破那根 K 線自己的高點。這個選擇很重要：
    用那根 K 線的高點當基準的話，只要之後沒有繼續往上就算失敗，那個定義太嚴，
    也不對應任何人的實際處境——在前高掛突破單的人，成本是前高。

    刻意用這個最粗的定義，理由是它不需要挑任何門檻參數。「走了多遠算真突破」需要
    一個數字（幾個 ATR？幾個百分點？），而那個數字一挑，統計結果就開始取決於它。
    先用不需要參數的定義得到一個基準數字，再談要不要細分。
    """
```

「不需要挑參數的定義」這一點值得多說一句。「守住」可以有很多定義：走了 2 個 ATR 算守住？漲了 1% 算守住？收盤價站上去算守住？每一種都合理，而每一種都會給出不同的統計數字。先用一個沒有自由度的定義得到基準，之後要細分才知道細分改變了什麼。這也是 Day 21 那個「多重比較」問題的預演——定義的自由度跟參數的自由度一樣會製造假發現。

### 往未來看的視窗，最容易差一格

```python
# quantbot/domain/services/breakout_labelling_service.py
    def _forward_extreme(self, values: pd.Series, side: ExtremeSide) -> pd.Series:
        """接下來 horizon 根的極值，**不含當根**。

        寫法是「反轉序列、往前 rolling、再反轉回來」。直覺的寫法是
        rolling(horizon).max().shift(-horizon)，但那個 shift 的格數很容易差一格，
        而差一格的症狀是標籤系統性偏向某一邊——那種偏差在統計結果上看不出來。
        """
        reversed_values = values.astype("float64").iloc[::-1]
        extreme = side.rolling_extreme(reversed_values.shift(1), self._horizon)
        return extreme.iloc[::-1]
```

「反轉、shift、rolling、反轉回來」比 `shift(-horizon)` 繞，但它跟 `PriorExtreme` 用的是**完全同一個模式**（先 shift 再 rolling），所以兩邊要嘛都對、要嘛都錯，不會出現一邊含當根一邊不含的情況。

為什麼「不含當根」在這裡特別重要：突破那一根自己的低點幾乎一定在突破價位之下（它就是那根 K 線的下緣），把它算進「後來有沒有跌回來」的話，**每一次突破都會被標成失敗**。

```python
def test_the_forward_window_excludes_the_breakout_bar_itself():
    """突破那一根自己的低點不算「跌回來」。

    這一根的低點幾乎一定在突破價位之下（它就是那根 K 線的下緣），所以把它算進去
    的話每一次突破都會被標成失敗。這是這個 service 最容易寫錯的一格。
    """
    highs = [10.0, 11.0, 12.0, 20.0, 21.0, 22.0, 23.0]
    lows = [9.0, 10.0, 11.0, 5.0, 20.5, 21.5, 22.5]  # 突破那根自己有很長的下影線
    view = make_view(highs, lows)

    labels = BreakoutLabellingService(horizon=3).label(
        view, Breakout(side=ExtremeSide.HIGH, window=3)
    )

    assert labels[BreakoutLabellingService.LABEL_COLUMN].iloc[0] == (
        BreakoutLabel.HELD.value
    )
```

還有一個邊界：最後幾根還沒有未來，所以它們不能有標籤。丟掉它們而不是給一個猜的值：

```python
def test_events_without_a_complete_forward_window_are_dropped():
    """最後幾根還沒有未來，不能給它們標籤。"""
    ...
    assert labels.empty
```

### 只用當下觀察得到的量去對照

統計服務的價值全在於它吃什麼。標籤來自未來，但拿來對照的每一個量都必須是突破當下就在手上的：

```python
# quantbot/domain/services/breakout_statistics_service.py
class BreakoutStatisticsService:
    """比較「守住」與「被打回來」兩組突破，在突破當下有什麼可觀察的差異。

    這個 service 的價值全在於它只吃**突破當下觀察得到**的量。標籤來自未來（那是
    BreakoutLabellingService 的工作），但拿來對照的每一個量都必須是當下就在手上的，
    否則這張表會變成一個華麗的同義反覆：用未來解釋未來。

    它不碰 I/O、不知道特徵怎麼算出來的，只吃兩張已經對齊好的表。
    """
```

用例負責選那三個量，而它們全部來自前面幾天：

```python
# quantbot/application/analyze_breakouts_application.py
    def _observations(
        self, view: MarketView, breakout: Breakout
    ) -> dict[str, pd.Series]:
        average_true_range = ATR(self._atr_period).compute(view)
        return {
            "excess_over_atr": breakout.excess(view) / average_true_range,
            "trade_count_z": TradingActivity(
                measure=ActivityMeasure.TRADE_COUNT, window=self._activity_window
            ).compute(view),
            "absolute_return_z": TradingActivity(
                measure=ActivityMeasure.ABSOLUTE_RETURN, window=self._activity_window
            ).compute(view),
        }
```

三個量對應三個常見的說法：「勉強擦過去的突破容易失敗」（除以 ATR 的突破幅度）、「沒人跟進的突破容易失敗」（成交筆數的 z-score）、「突破那一根本身要夠猛」（絕對報酬的 z-score）。這些說法很常聽到，今天要做的是給它們一個數字。

用中位數而不是平均：

```python
# quantbot/domain/dto/breakout_statistics_report.py
@dataclass(frozen=True)
class ObservationContrastDto:
    """一個「突破當下就觀察得到」的量，在守住與被打回來兩組之間差多少。

    用中位數而不是平均：突破當下的成交量分布右尾很長（少數幾次暴量可以是平常的
    幾十倍），平均會被那幾次主導，而我們要問的是「一般情況下有沒有差」。
    """
```

## 實際跑一次

```bash
uv run python -m quantbot.entrypoints.breakout_command \
    --symbol BTC/USDT --market spot --timeframe 1h \
    --start 2025-01-01 --end 2026-08-01 --window 20 --horizon 10
```

```
spot_BTCUSDT，前 20 根極值

[突破前高]
  突破事件 1,356 次，觀察窗 10 根
  守住 125 次（9.22%）、被打回來 1,231 次

  期間幅度中位數（價格單位）
    守住：順行 2,084.00、逆行 0.00
    打回：順行 651.67、逆行 857.98

  突破當下就觀察得到的量（中位數）
    量                           守住        打回         差
    excess_over_atr          1.433     0.377     1.056
    trade_count_z            1.577     0.247     1.330
    absolute_return_z        2.214     0.033     2.181

[跌破前低]
  突破事件 1,346 次，觀察窗 10 根
  守住 151 次（11.22%）、被打回來 1,195 次

  突破當下就觀察得到的量（中位數）
    量                           守住        打回         差
    excess_over_atr          1.204     0.402     0.802
    trade_count_z            1.743     0.757     0.986
    absolute_return_z        2.079     0.181     1.898
```

一年半的 1 小時線上有 1,356 次向上突破。四件事要讀。

### 一、那個 9.22% 不能被讀成「只有 9% 的突破有效」

這是今天最容易誤讀的數字，所以先處理它。

9.22% 是**在這個定義下**的比例，而這個定義很嚴：突破之後 10 根之內，價格的低點一次都不能回到前高之下。前高只是過去 20 根的最高價，而 BTC 的 1 小時線在 10 小時內回到 20 小時的價格區間裡，是相當普通的事。

換一個寬鬆一點的定義（例如「收盤價站在前高之上」而不是「低點一次都不許跌破」），這個數字會明顯上升。所以它不是「假突破率 90.8%」這種可以拿去引用的常數，它是**一個特定定義下的基準值**。

那什麼是穩的？下面那個對照。它在兩側、在三個量上方向都一致，而那種一致性不容易是定義造成的。

### 二、守住的突破，在突破當下就長得不一樣

三個量全部朝同一個方向：

| 量 | 守住 | 被打回來 | 倍數 |
|---|---|---|---|
| 突破幅度 ÷ ATR | 1.433 | 0.377 | 3.8 |
| 成交筆數 z-score | 1.577 | 0.247 | 6.4 |
| 絕對報酬 z-score | 2.214 | 0.033 | — |

**守住的那些突破，幅度是被打回來那些的 3.8 倍**（以 ATR 為單位），而且成交筆數明顯更熱（z-score 1.58 對 0.25）。

也就是說那兩句常聽到的話在這份資料上成立：勉強擦過去的突破容易失敗、沒人跟進的突破容易失敗。而「勉強」與「沒人跟進」現在有數字了——0.38 個 ATR、z-score 0.25。

跌破前低那一側的三個量方向完全一樣（1.204 對 0.402、1.743 對 0.757、2.079 對 0.181）。這是一個有用的穩健性檢查：如果只有一側成立，比較可能的解釋是那段行情剛好偏多或偏空，而不是這個現象真的存在。

### 三、守住組的「逆行 0.00」是定義的結果，不是發現

守住組的逆行幅度中位數是 0.00。這看起來像一個很漂亮的結果，但它是**定義推出來的**：守住的定義就是「沒有跌回前高之下」，而逆行幅度是從前高往下量的，所以它必然是 0。

這種數字要主動標出來，不然報告會看起來比實際上有資訊。真正有內容的是另外三個：

| | 順行 | 逆行 |
|---|---|---|
| 守住（125 次） | 2,084.00 | 0.00 |
| 被打回來（1,231 次） | 651.67 | 857.98 |

被打回來的那 1,231 次，順行中位數 651.67、逆行中位數 857.98——也就是**先給一點甜頭，然後往回走更多**。這正是假突破在帳面上的樣子。

### 四、還不能算期望值

看到「9.22% 的機率賺 2,084、90.78% 的機率賠 858」很容易想直接算期望值。這裡不算，理由有兩個：

1. **中位數不能相加。** 期望值要用平均，而這幾個分布都嚴重偏斜，平均與中位數差很多。
2. **這些幅度不是損益。** 損益要看實際的進出場價位——出場規則是什麼（碰到逆行多少就走？固定持有 10 根？）、進場滑價多少、手續費多少。這三件事一個都還沒定。

所以今天的產出是**兩組突破在突破當下的可觀察差異**，不是一個策略的評價。後者需要 Day 19 的回測框架與 Day 20 的成本模型。這條界線要守住——把「守住 9.22%」講成「勝率 9%」，或把幅度中位數當成損益，都是把描述講成結論。

## 回答 Day 10 留下的問題：深度是被吃掉還是被撤走

Day 10 提過一個沒辦法靠算法解決的限制：**掛單可以撤，所以 OBI 量到的是「簿子上長什麼樣」，不是「有多少人真的想成交」。** 今天有工具可以量那個限制到底有多大。

方法是把兩種資料對起來：

```python
# quantbot/domain/features/liquidity_swing.py
class LiquiditySwing:
    """被突破那一側的流動性減少了，是**被吃掉**還是**被撤走**。實作 domain 的 Feature。

    這是今天唯一需要三種原料的特徵（K 線、逐筆成交、掛單簿），而它問的問題是
    Day 10 那個限制的正面回答：掛單可以撤，所以光看掛單簿少了多少不知道發生什麼事。
    把它跟成交量對起來就分得出來：

        吃掉的比例 = 同期間該方向的 taker 成交量 / 該側深度的減少量

    - 接近 1：掛單是被真的成交吃掉的。有人用真錢把它買走了。
    - 接近 0：掛單消失了但沒有成交。它被撤單了。

    兩者在價格圖上長得一樣（深度都變薄、價格都往上），但意義相反。被吃掉代表有
    真實的買盤；被撤走代表掛單的人只是把單子拿走，那個「上漲」沒有任何人付錢。

    值域不封閉在 0 到 1：同一段時間裡可能有人一邊吃、一邊有新單補上，於是分母
    （淨減少量）比分子（成交量）小很多，比例會大於 1。那不是錯誤，那是「掛單補得
    比吃得快」，本身就是資訊，所以 NEVER 把它 clip 到 1。
    """
```

它是第一個需要三種原料的特徵，而 Day 10 訂的 `required_inputs` 在這裡第一次真的派上用場——缺哪一種資料，在算之前就問得出來。

### 一個只有真實資料才會出現的錯誤

第一版把成交那側的累積量對齊到掛單簿的時間點時，用的是最直覺的寫法：

```python
volume.reindex(depth.captured_times, method="ffill")
```

在合成的測試資料上完全正常。跑真實資料時它丟出 `ValueError: cannot reindex on an axis with duplicate labels`。

原因是**成交的時間戳不是唯一的**。Day 09 就量過了：`aggTrades` 每分鐘的列數中位數是 368，同一個毫秒裡有幾十筆成交是常態。而 `reindex` 在有重複索引的軸上直接拒絕工作。

正確的工具是 `merge_asof`：

```python
# quantbot/domain/features/liquidity_swing.py
    @staticmethod
    def _sampled_at(values: pd.Series, moments: pd.DatetimeIndex) -> pd.Series:
        """把成交那一側的累積量取樣到掛單簿的時間點上。

        這裡 NEVER 用 reindex(method="ffill")：**成交的時間戳不是唯一的**（同一個
        毫秒裡有幾十筆成交是常態，Day 09 量過每分鐘中位數 368 列），而 reindex 在
        有重複索引的軸上會直接丟 ValueError。

        merge_asof 才是「取此刻或之前最近的那一個值」這件事的工具，而且它接受
        重複的鍵。它要求兩邊都已排序，這由 TradeSeries 與 DepthSeries 的建構保證。
        """
        left = pd.DataFrame({"moment": moments})
        right = pd.DataFrame(
            {"moment": pd.DatetimeIndex(values.index), "value": values.to_numpy()}
        )
        merged = pd.merge_asof(left, right, on="moment", direction="backward")
        return pd.Series(
            merged["value"].to_numpy(), index=moments, name=str(values.name)
        )
```

這個錯誤值得記錄下來，因為它是那種「合成測試資料永遠測不到」的類型：測試裡每秒一筆，真實資料一秒幾十筆。所以它變成一個測試：

```python
def test_duplicate_trade_timestamps_do_not_break_the_alignment():
    """成交的時間戳不是唯一的，而 reindex 在重複索引上會直接丟 ValueError。

    這是實跑撞到的：同一個毫秒裡有幾十筆成交是常態。這個測試把它釘住，
    因為那個例外只在真實資料上才出現，合成的「每秒一筆」測不到。
    """
    depth = make_depth(ask_quantities=[10.0, 4.0], bid_quantities=[10.0, 10.0])
    # 六筆成交全部落在同一個時間點
    trades = make_trades([1.0] * 6, [1.0] * 6, [False] * 6)
    view = MarketView(candles=make_candles(), trades=trades, depth=depth)

    ratio = LiquiditySwing(side=ExtremeSide.HIGH).consumed_ratio(view)

    assert ratio.iloc[1] == pytest.approx(1.0)  # 6 BTC 的買，吃掉 6 BTC 的深度
```

Day 12 那個「測試資料不能比真實資料更乾淨」的教訓，在這裡換了一種形狀又出現一次。

### 實測結果

```bash
uv run python -m quantbot.entrypoints.liquidity_swing_command \
    --symbol BTC/USDT --market spot --timeframe 1m \
    --start 2026-08-04T17:20 --end 2026-08-04T18:05
```

```
spot_BTCUSDT：K 線 45 根、成交 19,295 筆、深度取樣 2,508 筆

[high] liquidity_swing_high_5s
  可用樣本 1,924 筆
  中位數 0.081、四分位 0.012 / 0.460
  以成交吃掉為主（> 0.5）：465 筆（24.17%）
  以撤單為主：1,459 筆（75.83%）

[low] liquidity_swing_low_5s
  可用樣本 1,941 筆
  中位數 0.056、四分位 0.006 / 0.393
  以成交吃掉為主（> 0.5）：431 筆（22.21%）
  以撤單為主：1,510 筆（77.79%）
```

**賣方深度變薄的樣本裡，有 75.83% 主要是撤單而不是成交。** 中位數 0.081 的意思是：典型情況下，深度減少的量裡只有 8% 是被真的成交吃掉的，其餘 92% 是掛單自己消失的。買方那側幾乎一樣（77.79%、中位數 0.056）。

這個數字把 Day 10 那個口頭上的警告變成了一個量。「掛單可以撤」不是一個理論上的可能性——在這 45 分鐘的資料上，撤單是深度變化的**主要來源**。所以：

- OBI 那個 0.43 的秩相關並不因此變成假的，但它的意義更窄了：它反映的是「簿子現在的形狀」，而那個形狀有四分之三的變化來自沒有人付錢的動作。
- 一個「賣方掛量突然變薄就跟著買」的規則，四分之三的時候跟到的是撤單。
- 這也解釋了假突破為什麼那麼常見：價格衝過前高的時候，前面的賣單可能只是被撤走了，而撤單不代表有人想買。

要誠實標註限制：這是**45 分鐘、單一交易對**的樣本。時段（美股盤中）、幣別、市場狀態都可能改變這個比例。它的價值不在那個 75.83% 有多精確，而在於數量級——這件事不是邊緣情況，是主要情況。

## 視覺化：用眼睛檢查標記邏輯

這張圖的用途不是找訊號：

```python
# quantbot/infrastructure/charting/plotly_breakout_chart_renderer.py
class PlotlyBreakoutChartRenderer:
    """K 線 ＋ 前高線 ＋ 把突破依標籤標成兩種顏色的標記。

    這張圖的用途不是找訊號，是**用眼睛確認標記邏輯正確**。統計數字沒辦法告訴我們
    「突破」這個判斷有沒有寫錯——一個把 shift 寫掉的版本會產生 0 個事件（統計上
    看起來像「這段行情很平靜」），一個把方向寫反的版本會把每個低點標成突破。
    這兩種錯誤在圖上一秒就看得出來。

    所以它刻意把兩種標籤畫成不同顏色：守住的往上三角、被打回來的往下三角。
    肉眼掃過去，被打回來的那些應該落在圖形的相對高點附近。
    """
```

前高那條線用階梯狀畫，不用斜線：

```python
# quantbot/infrastructure/charting/plotly_breakout_chart_renderer.py
        # 前高線用階梯狀（hv）而不是直線：它在被突破之前是一個常數，
        # 用斜線連起來會讓人以為那個門檻在中間慢慢移動
        figure.add_trace(
            go.Scatter(
                x=prior_level.index,
                y=prior_level,
                name=f"前 {self._breakout.window} 根極值",
                line={"width": 1.0, "color": "#8e44ad", "shape": "hv"},
            )
        )
```

而那條線用的是判斷用的同一份計算，這件事由 `Breakout` 自己保證：

```python
# quantbot/domain/features/breakout.py
    def prior_level(self, view: MarketView) -> pd.Series:
        """突破判斷用的門檻本身。

        圖表要畫這條線，而它 MUST 跟判斷用的是同一份計算——各算一次的話，
        圖上的線與標記的位置會在某些邊界上對不起來，而那種不一致最難查。
        """
        return self._prior.compute(view)
```

打開產出的 html，把時間軸拉到 2025 年的任一段：往下的紅色三角應該密密麻麻地出現在每個小波段的頂部附近，往上的綠色三角稀疏得多。那個視覺上的密度差，就是 1,231 對 125 的樣子。

## 今日交付物

```
quantbot/
├── domain/
│   ├── values/
│   │   ├── extreme_side.py                     今天：HIGH / LOW ＋ 三件事一起翻
│   │   └── breakout_label.py                   今天：標籤，不是特徵
│   ├── features/
│   │   ├── prior_extreme.py                    今天：這個類別只為了 shift(1)
│   │   ├── breakout.py                         今天：第一個事件式特徵
│   │   └── liquidity_swing.py                  今天：吃掉還是撤走
│   ├── services/
│   │   ├── breakout_labelling_service.py       今天：刻意看未來
│   │   └── breakout_statistics_service.py      今天：只吃當下觀察得到的量
│   └── dto/breakout_statistics_report.py       今天
├── application/analyze_breakouts_application.py 今天
├── infrastructure/
│   ├── charting/plotly_breakout_chart_renderer.py               今天
│   └── reporting/text_breakout_statistics_report_renderer.py    今天
├── entrypoints/
│   ├── breakout_command.py                     今天
│   └── liquidity_swing_command.py              今天
└── tests/
    ├── domain/features/test_breakout.py                    今天
    ├── domain/features/test_liquidity_swing.py             今天
    └── domain/services/test_breakout_labelling_service.py  今天
```

### 驗收標準

七項全過才算完成：

1. `uv run pytest tests/domain/features/test_breakout.py` 全綠。**最重要的兩個**：前高不含當根，以及「把 shift 寫掉的版本在一段一路創新高的資料上找到 0 個事件」。
2. `uv run pytest tests/domain/services/test_breakout_labelling_service.py` 全綠，含「往未來的視窗不含突破那一根」與「窗口不完整的尾巴要被丟掉」。
3. `uv run pytest tests/domain/features/test_liquidity_swing.py` 全綠，含重複時間戳那個回歸測試——它守的是一個只在真實資料上出現的例外。
4. `uv run python -m quantbot.entrypoints.breakout_command --symbol BTC/USDT --market spot --timeframe 1h --start 2025-01-01 --end 2026-08-01 --window 20 --horizon 10` 印出兩側的統計。**兩側的三個對照量方向要一致**（守住組的幅度、成交筆數、絕對報酬都比較高）。只有一側成立的話，先懷疑那段行情偏多或偏空。
5. 手上有 Day 09 錄的資料之後，`uv run python -m quantbot.entrypoints.liquidity_swing_command`（區間換成自己錄的那段）印出「以撤單為主」的比例明顯過半。
6. 打開 `notebooks/day13-spot_BTCUSDT_1h-breakout.html`：紅色往下三角密集出現在小波段頂部、綠色往上三角稀疏，而前高那條線是階梯狀的。
7. `uv run mypy quantbot` 與 `uv run lint-imports` 全過。

第 1 項與第 4 項是今天的重點。第 1 項守的是一個會讓訊號完全消失的錯誤，第 4 項守的是「結論要在兩側都成立」。

> 免責聲明：本文為程式與資料工程的技術分享，所有數字皆為教學範例，不構成投資建議；文中的守住比例取決於本文採用的定義，NEVER 可當成通用的假突破率，幅度中位數也 NEVER 等於損益。

## 明天

今天用的是「前 20 根最高價」——時間軸上的極值。明天換一個維度。

Volume Profile 不看時間軸上的成交量，看**價格軸上的成交量分布**：在 64,000 這個價位總共成交了多少、在 65,000 又是多少。成交量堆積最多的那個價格是多數人的成本區，那裡自然形成支撐或壓力，而它不需要手畫線。

Day 09 那條逐筆成交的路徑明天會第一次真的被用來算特徵——而且會有一個具體的數字回答「用 K 線近似跟用 tick 精算差多少」。Day 11 提過官方 K 線的 `quote_volume / volume` 就是那一根真正的 VWAP，明天就是拿它當對照組的時候。

## Reference

- [`rolling` 視窗預設包含當根，以及 `closed` 參數的語意 — pandas documentation, Windowing operations](https://pandas.pydata.org/docs/user_guide/window.html)
- [`merge_asof` 做「取此刻或之前最近的值」的對齊，允許重複的鍵 — pandas documentation, `merge_asof`](https://pandas.pydata.org/docs/reference/api/pandas.merge_asof.html)
- [`reindex` 在有重複標籤的軸上會丟 `ValueError` — pandas documentation, `DataFrame.reindex`](https://pandas.pydata.org/docs/reference/api/pandas.DataFrame.reindex.html)
- [aggTrades 的欄位定義（本文的「同一毫秒有幾十筆成交」由它的 `transact_time` 而來） — Binance Public Data](https://github.com/binance/binance-public-data)
