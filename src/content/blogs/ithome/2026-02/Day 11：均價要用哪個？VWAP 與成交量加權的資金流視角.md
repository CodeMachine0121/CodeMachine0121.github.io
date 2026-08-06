---
title: "Day 11：均價要用哪個？VWAP 與成交量加權的資金流視角"
datetime: "2026-09-25"
description: "算術平均把成交 1 顆 BTC 跟成交 100 顆當成一樣重要。這篇實作 VWAP 的兩種累積方式（日內重置與滾動視窗），實測同一根 K 線上兩者相差 164 USDT、而「偏離超過一個標準差」的比例從 28.70% 變成 53.29%；並處理一個看起來只是實作細節的地方——加權變異數照課本那條恆等式直接寫，在 BTC 的價位上會吃掉 float64 一半的有效位數。"
image: ""
parent: "2026 ithome-鐵人賽: 工程師的量化交易入門：從 K 線到可組合的交易策略引擎 系列"
draft: true
---

## 有人買在 65,000，有人買在 64,500，那「現在」是賺還是賠

Day 10 的 OBI 有一個很硬的限制：現貨的掛單簿歷史在免費資料源裡不存在，所以它只有我們自己錄的那 45 分鐘。今天換到另一邊——成交資料。掛單可以撤，成交撤不掉，而且 Day 09 那條 aggTrades 路徑要幾天有幾天。

先看一個具體的問題。2026-07-15 那天的 BTC/USDT 現貨，1 分鐘 K 線的收盤價從 65,200 附近走到 64,750 附近。「那天的平均價」是多少？

最直覺的算法是把 1,440 根 K 線的收盤價加起來除以 1,440。但這個算法有一個很明顯的問題：那 1,440 分鐘裡，有些分鐘成交了 200 顆 BTC，有些分鐘成交了 0.25 顆（Day 09 找到的最冷清那一分鐘）。算術平均把它們當成一樣重要。

用工程的話講：算術平均假設每個樣本的權重相同，而市場資料的樣本權重顯然不同。**正確的權重是成交量。** 這就是 VWAP（Volume Weighted Average Price，成交量加權平均價）：

```
VWAP = Σ(價格 × 成交量) / Σ成交量
```

一行公式，但它換掉的問題比看起來多。均線問的是「價格往哪走」，VWAP 問的是**「現在的價格，對已經進場的人來說是賺還是賠」**——因為 VWAP 就是那些人的平均成本。

今天要處理三件事：兩種累積方式（它們是兩個不同的工具，不是同一個工具的兩種設定）、一個會吃掉數值精度的實作陷阱，以及把 VWAP 變成策略真正能用的形狀。

## 交易概念補課

### VWAP 為什麼是機構的參考基準

一個要買進 500 顆 BTC 的機構不可能一次下單——那會把價格推上去。實際做法是拆成幾百張小單，在一段時間裡慢慢買。

買完之後怎麼評估執行得好不好？跟收盤價比沒有意義（收盤價只是最後一個瞬間），跟最高最低比也沒有意義。合理的基準是**同一段時間裡市場的平均成本**，也就是 VWAP。買在 VWAP 之下代表買得比市場平均便宜。

所以 VWAP 有一個其他指標沒有的性質：**它是很多人真的在拿來當標準的數字。** 均線的參數（20 還是 60）是各人自選的，VWAP 的定義只有一種。這讓「價格在 VWAP 之上或之下」多了一層自我實現的成分——不是因為它有什麼神秘的預測力，而是因為有一群人的決策確實掛在它上面。

### 價格在 VWAP 之上或之下的意義

VWAP 是平均成本，所以：

- 價格在 VWAP **之上**：這段期間進場的人平均是獲利的。
- 價格在 VWAP **之下**：這段期間進場的人平均是虧損的，而套在上面的人有回本就賣的動機。

第二種情況是「壓力」這個詞在資料上的樣子。它不保證價格會往下，但它描述了一群人的處境，而那個處境會影響他們的行為。

實測 2026-07-15 那天：價格在日內 VWAP 之上的時間佔 **45.14%**。也就是說那天多數時間裡，當天進場的人平均是虧的。

### 資金流：把方向加進成交量

成交量本身沒有方向——一顆 BTC 換手，同時有人買也有人賣。要讓成交量帶方向，得靠 Day 09 講的 taker 概念：主動吃單的那一方是誰。

Day 09 已經把 `taker_buy_base_volume` 存進 `candles` 了（官方 K 線的 12 欄之一），所以「這一分鐘的主動買佔多少」是查得到的。Day 09 那兩根 K 線就是這麼比出來的：一根 80.6%、一根 4.7%。

今天的 VWAP 不區分方向（它是所有成交的加權平均），但「資金流」這個概念今天要先建立，因為 Day 13 判斷真假突破時會用到它。

## 工程實作

### 兩種累積方式，兩個工具

`Σ(價格 × 成交量) / Σ成交量` 這個式子有一個沒說的地方：**Σ 從哪裡加到哪裡。**

兩種常見的答案：

```python
# quantbot/domain/values/vwap_mode.py
class VWAPMode(StrEnum):
    """VWAP 的累積範圍：每天重置，還是固定視窗往前滾。

    兩者是不同的工具，不是同一個工具的兩種設定：

    - SESSION：從當日開盤累積到現在。它是**當天所有參與者的平均成本**，所以
      「價格在 VWAP 之上」對今天進場的人有意義。代價是它在一天剛開始時只用了
      幾根 K 線，很不穩，而且跨日會跳。
    - ROLLING：固定往前看 N 根。它不認識「一天」這個概念，所以在 24/7 的加密貨幣
      市場上比較自然，也不會有跨日跳動；代價是它不對應任何一群人的實際成本。

    加密貨幣沒有收盤，所謂「當日」是人為切的 UTC 午夜。這件事要講清楚——
    它是一個約定，不是市場的性質。
    """

    SESSION = "session"
    ROLLING = "rolling"
```

「加密貨幣沒有收盤」這件事值得停一下。股市的日內 VWAP 有明確的物理意義：開盤到收盤是一個完整的交易時段，收盤之後所有人都停下來。加密貨幣 24/7 不休市，所謂「當日」是我們自己在 UTC 午夜切一刀。切在 UTC 午夜、紐約午夜還是台北午夜，會得到三條不同的線，而沒有哪一條比較「正確」。

這不代表日內 VWAP 在加密貨幣上沒用——很多人確實看 UTC 日界，所以它有那層自我實現的成分。但它是一個**約定**，寫程式的人要知道自己選了什麼。

### 用哪個價格代表一根 K 線

第二個沒說的地方：`價格` 是哪個價格。

```python
# quantbot/domain/values/price_source.py
class PriceSource(StrEnum):
    """一根 K 線要用哪個價格代表它。

    CLOSE 是預設的直覺選擇，但它只採樣一個瞬間——一根長影線的 K 線，收盤價完全
    看不出那一分鐘走過的範圍。TYPICAL 取 (高 + 低 + 收) / 3，把區間也算進去。

    成交量加權的計算慣例用 TYPICAL：VWAP 要回答的是「這段期間市場的平均成本」，
    而成交是散落在整根 K 線的價格區間裡的，不是全部發生在收盤價上。

    這是一個值而不是一個布林參數，因為之後還會有第三種（開高低收的平均）。
    """

    CLOSE = "close"
    TYPICAL = "typical"

    def of(self, candles: pd.DataFrame) -> pd.Series:
        """取出這根 K 線的代表價。轉換只寫在這裡一份。"""
        if self is PriceSource.CLOSE:
            return candles["close"].astype("float64")
        return (
            candles[["high", "low", "close"]].astype("float64").sum(axis=1) / 3.0
        ).rename("typical_price")
```

典型價 `(高 + 低 + 收) / 3` 是慣例，不是定理。它的邏輯是：一根 K 線裡的成交散落在整個價格區間，用收盤價代表整根會忽略那個區間。真正精確的做法是拿逐筆成交去算（Day 09 那條路徑有那份資料），而那正是 Day 14 要做的事——用 tick 精算跟用 K 線近似的差別，那天會有數字。

順帶一句：官方 K 線的 12 欄裡有 `quote_volume`（以報價幣計的成交額），而 `quote_volume / volume` 就是那一根**真正的** VWAP，不需要近似。這是一個很划算的檢查，Day 14 會用到它。

### 加權平均：兩種累積只差一個方法

```python
# quantbot/domain/features/volume_weighted_average_price.py
    def _weighted_mean(self, values: pd.Series, volume: pd.Series) -> pd.Series:
        """加權平均。兩種累積方式只差 cumsum 與 rolling().sum()。

        分母是成交量的累積和，所以完全沒有成交的那幾根會讓分母是 0。那時候回 NaN
        而不是 0——「沒有人成交」時平均成本沒有定義，填 0 會在圖上畫出一條掉到
        原點的線，而那條線會被下游當成真的價格。
        """
        weighted = values * volume
        if self.mode is VWAPMode.SESSION:
            session = self._session_of(values.index)
            numerator = weighted.groupby(session).cumsum()
            denominator = volume.groupby(session).cumsum()
        else:
            numerator = weighted.rolling(self.window).sum()
            denominator = volume.rolling(self.window).sum()
        return (numerator / denominator).where(denominator > 0)
```

全部向量化，沒有一行在遍歷 K 線。日內模式用 `groupby(...).cumsum()`：分組之後各自累積，跨日自然重置。

分日的方式有一個小陷阱：

```python
# quantbot/domain/features/volume_weighted_average_price.py
    @staticmethod
    def _session_of(index: pd.Index) -> pd.Series:
        """哪一天。加密貨幣沒有收盤，所以「一天」是人為切的 UTC 午夜。

        用 normalize() 而不是 index.date：後者會產生 object 型別的 Python date，
        groupby 會慢好幾倍，而且時區資訊在那一步就掉了。
        """
        times = pd.DatetimeIndex(index)
        return pd.Series(times.normalize(), index=index, name="session")
```

`index.date` 看起來更直覺，但它把 `DatetimeIndex` 轉成一整欄 Python `date` 物件（`object` dtype），`groupby` 因此慢好幾倍，而且時區資訊在那一步就掉了。`normalize()` 保留型別與時區，只把時間部分歸零。

### 加權標準差：那條恆等式在 BTC 的價位上會出事

VWAP 只是第一階的統計量。要回答「現在偏離得多不多」，還需要第二階：加權標準差。

課本上的算法是那條著名的恆等式——變異數等於「平方的平均」減「平均的平方」：

```
Var = E[p²] − (E[p])²
```

它的好處是可以完全向量化，兩個加權平均各算一次就好，不需要先算平均再回頭掃第二遍。

問題是它在 BTC 的價位上會出事。代進實際數字：價格 65,000，`E[p²]` 大約是 4.225 × 10⁹；而一天之內的加權變異數可能只有 25（標準差 5 USDT）。也就是說要用兩個約 4.2 × 10⁹ 的數字相減，得到一個 25 的結果。

`float64` 有大約 16 位十進位有效位數。兩個相差八個數量級的數相減，答案的有效位數只剩下大約 7 位。這種誤差不會噴例外，也不會產生 NaN——它產生一個看起來很正常、但小數點後幾位是垃圾的數字。

解法是**先把價格平移到 0 附近**。變異數有平移不變性（把每個值都減去同一個常數，變異數不變），所以這不是近似，是等價變換：

```python
# quantbot/domain/features/volume_weighted_average_price.py
    def standard_deviation(self, view: MarketView) -> pd.Series:
        """加權標準差，用來畫通道、也用來標準化偏離程度。

        算法是「加權平方的平均 − 加權平均的平方」，但**先把價格平移到 0 附近**。
        直接對 BTC 的價格用那條恆等式會出事：價格 65,000 的平方是 4.2e9，而
        變異數可能只有 25，兩個相差八個數量級的數相減會把有效位數吃掉大半
        （float64 只有約 16 位十進位有效位數）。平移之後兩邊的量級就接近了。

        平移不改變變異數——這是變異數的平移不變性，所以這不是近似，是等價變換。
        """
        candles = view.candles.frame
        price = self.price_source.of(candles)
        volume = candles["volume"].astype("float64")

        centre = float(price.mean())
        shifted = price - centre
        mean = self._weighted_mean(shifted, volume)
        mean_of_squares = self._weighted_mean(shifted**2, volume)
        # 浮點誤差可能讓變異數變成 -1e-12 這種值，開根號會得到 NaN
        variance = (mean_of_squares - mean**2).clip(lower=0.0)
        # 用 Series.pow 而不是 np.sqrt：後者的回傳型別在 pandas-stubs 下退化成 Any，
        # 於是 mypy --strict 再也看不出這個函式回傳的是 Series
        return variance.pow(0.5).rename(f"{self.name}_standard_deviation")
```

`clip(lower=0.0)` 那一行不是防禦性的裝飾。即使平移過，浮點誤差還是可能讓變異數變成 `-1e-12` 這種值（數學上不可能為負），而 `sqrt(-1e-12)` 會得到 NaN——一個突然出現的 NaN 會讓下游的偏離度整段消失，而原因非常難查。

平移到底救回多少？這件事可以測：

```python
def test_centring_keeps_the_precision_that_the_naive_identity_loses():
    """不平移的話，65,000 的平方跟變異數差八個數量級，有效位數會被吃掉。

    這裡把兩種寫法並排：平移過的版本跟直接展開的結果幾乎完全相同，
    沒平移的版本誤差大好幾個數量級。兩者都跑得出一個看起來合理的數字。
    """
    generator = np.random.default_rng(4)
    closes = 65_000 + generator.normal(0, 5, 500)  # 變異數小、價格大，最糟的情況
    volumes = generator.uniform(0.1, 5.0, 500)
    view = make_view(closes=closes, volumes=volumes, freq="1min")
    feature = VWAP(mode=VWAPMode.SESSION, price_source=PriceSource.CLOSE)

    average = weighted_mean(closes, volumes)
    direct = np.sqrt((volumes * (closes - average) ** 2).sum() / volumes.sum())

    centred_error = abs(feature.standard_deviation(view).iloc[-1] - direct)
    naive_variance = (
        weighted_mean(closes**2, volumes) - weighted_mean(closes, volumes) ** 2
    )
    naive_error = abs(np.sqrt(max(naive_variance, 0.0)) - direct)

    assert centred_error < 1e-9
    assert naive_error > centred_error * 100
```

對照組是「直接展開」的定義式 `Σv(p − p̄)² / Σv`——它精度最好但要掃兩遍資料。測試斷言的是：平移過的向量化版本跟它的誤差小於 `1e-9`，而沒平移的版本誤差至少大一百倍。

這個測試的形狀值得注意：它不是斷言「我的版本是對的」，而是斷言**「我的版本比那個看起來一樣的寫法準確得多」**。沒有這個對照，兩種寫法都會通過任何「數值範圍合理」的檢查。

### 偏離度：策略真正會用到的那個數字

VWAP 本身不能直接進策略，因為它的單位是價格。「價格比 VWAP 高 120 USDT」在 BTC 上是小事，在 ETH 上是大事，同一個門檻 NEVER 能同時適用於兩個交易對。

所以要標準化：

```python
# quantbot/domain/features/vwap_deviation.py
class VWAPDeviation:
    """價格偏離 VWAP 幾個加權標準差。實作 domain 的 Feature。

        偏離 = (價格 − VWAP) / 加權標準差

    這是策略真正會用到的那個數字，而不是 VWAP 本身。理由是 VWAP 的單位是價格：
    「價格比 VWAP 高 120 USDT」在 BTC 上是小事，在 ETH 上是大事，而同一個門檻
    NEVER 能同時適用於兩個交易對。除以標準差之後它變成無單位的，跨交易對、
    跨時段才可比。

    這也是 Day 18 均值回歸策略裡「價格顯著偏離 VWAP」那句話的實際定義——
    「顯著」是幾個標準差，是一個要被寫下來的數字，不是一種感覺。
    """

    def __init__(self, vwap: VWAP) -> None:
        self._vwap = vwap

    def compute(self, view: MarketView) -> pd.Series:
        price = self._vwap.price_source.of(view.candles.frame)
        centre = self._vwap.compute(view)
        spread = self._vwap.standard_deviation(view)
        # 標準差為 0 的時候（整段只有一個成交價）偏離沒有定義，回 NaN 而不是 inf
        return ((price - centre) / spread.where(spread > 0)).rename(self.name)
```

它用組合而不是繼承：`VWAPDeviation` 收一個 `VWAP` 進來。這讓「哪一種累積、哪一個價格」只需要決定一次，而且兩者都是 `Feature`，Day 15 的管線可以把它們當成兩個獨立的特徵各自註冊。

## 陷阱與驗證

### 加權真的有差嗎

先驗最基本的那件事——加權平均不等於算術平均：

```python
def test_volume_weighting_is_not_the_arithmetic_mean():
    """一顆與一百顆的成交不該一樣重要，這是 VWAP 存在的全部理由。"""
    view = make_view(closes=[100.0, 200.0], volumes=[1.0, 99.0])

    line = VWAP(price_source=PriceSource.CLOSE).compute(view)

    assert line.iloc[-1] == pytest.approx(199.0)  # 不是 150
    assert line.iloc[-1] == pytest.approx(weighted_mean([100, 200], [1, 99]))
```

兩根 K 線，價格 100 與 200，成交量 1 與 99。算術平均是 150，VWAP 是 199。這個測試看起來很淺，但它守的是一個真的會出錯的地方：忘記乘權重、或者把權重乘在錯的地方，算出來還是一個落在 100 與 200 之間的合理數字。

### 跨日要重置

```python
def test_session_mode_resets_at_utc_midnight():
    """跨日要重置。不重置的話第二天的 VWAP 會被前一天的成交拖住。"""
    view = make_view(
        closes=[100.0] * 24 + [200.0] * 24,
        volumes=[1.0] * 48,
        start="2026-07-15",
        freq="1h",
    )

    line = VWAP(mode=VWAPMode.SESSION, price_source=PriceSource.CLOSE).compute(view)

    assert line.iloc[23] == pytest.approx(100.0)  # 第一天結束
    assert line.iloc[24] == pytest.approx(200.0)  # 第二天第一根，重新開始
    assert line.iloc[-1] == pytest.approx(200.0)  # 第二天結束，沒被前一天拉低
```

第 24 根（第二天的第一根）必須正好等於 200，不能是 100 與 200 之間的任何值。忘記分組的話那裡會是 150 附近，而 150 看起來完全像一個合理的 VWAP。

### 沒有成交的那幾根

```python
def test_zero_volume_bars_are_nan_not_zero():
    """完全沒成交時平均成本沒有定義。填 0 會在圖上畫出一條掉到原點的線。"""
    view = make_view(closes=[100.0, 100.0], volumes=[0.0, 0.0])

    assert VWAP(mode=VWAPMode.SESSION).compute(view).isna().all()
```

分母是成交量的累積和，完全沒成交時它是 0。回 NaN 而不是 0，理由跟 Day 10 的「兩側都空」一樣：0 是一個有意義的值（「平均成本是零元」顯然不對），NaN 才是「這裡沒有定義」。

實務上這會發生在冷門交易對與交易所維護期間。BTC/USDT 不會，但寫特徵的時候不能假設只有 BTC。

### 偏離度為 0 的退化情況

整段只有一個成交價時標準差是 0，除法會得到 `inf`：

```python
def test_deviation_is_nan_when_there_is_only_one_price():
    """整段只有一個成交價時標準差是 0，偏離沒有定義。NEVER 回 inf。"""
    view = make_view(closes=[100.0] * 10, volumes=[1.0] * 10)

    deviation = VWAPDeviation(VWAP(mode=VWAPMode.SESSION)).compute(view)

    assert deviation.isna().all()
```

`inf` 比 NaN 危險，因為它會通過 `notna()` 檢查，然後在下游的比較運算裡永遠成立——一個「偏離超過 2 個標準差就進場」的條件會在這裡無條件觸發。

### 兩種累積差多少：實際跑一次

前面說「日內」與「滾動」是兩個不同的工具。這句話用同一天的資料就能量出來。

```bash
uv run python -m quantbot.entrypoints.vwap_command \
    --symbol BTC/USDT --market spot --timeframe 1m \
    --start 2026-07-15 --end 2026-07-16 --mode session
```

```
1,440 根 K 線：2026-07-15 00:00:00+00:00 → 2026-07-15 23:59:00+00:00
vwap_session：最後一根 64,974.38，價格 64,756.83
價格在 VWAP 之上的比例：45.14%
偏離超過 1 個標準差：413 根（28.70%）
偏離超過 2 個標準差：72 根（5.00%）
```

換成滾動 60 根（也就是過去一小時）：

```
1,440 根 K 線：2026-07-15 00:00:00+00:00 → 2026-07-15 23:59:00+00:00
vwap_rolling_60：最後一根 64,810.65，價格 64,756.83
價格在 VWAP 之上的比例：48.89%
偏離超過 1 個標準差：736 根（53.29%）
偏離超過 2 個標準差：180 根（13.03%）
```

並排看：

| | 日內重置 | 滾動 60 根 |
|---|---|---|
| 最後一根的 VWAP | 64,974.38 | 64,810.65 |
| 價格在 VWAP 之上 | 45.14% | 48.89% |
| 偏離超過 1 個標準差 | 28.70% | 53.29% |
| 偏離超過 2 個標準差 | 5.00% | 13.03% |

**同一天、同一根 K 線，兩條線相差 164 USDT。** 而「偏離超過一個標準差」的比例從 28.70% 變成 53.29%——差了將近一倍。

差距的來源不是價格，是標準差。日內 VWAP 的標準差累積了整天的價格範圍，通道很寬；滾動 60 根只用最近一小時，通道窄得多，於是價格待在通道外的時間自然多得多。

這件事的實務結論很直接：**「價格偏離 VWAP 兩個標準差」在沒有講清楚哪一種累積之前，不是一個定義。** 兩個人照同一句話寫程式，會得到兩個觸發頻率差一倍的策略。所以那個累積方式進了特徵的名字（`vwap_session` 與 `vwap_rolling_60`），設定檔上看得見。

順帶一個統計上的觀察：如果偏離度是常態分布，超過 1 個標準差應該是 31.7%、超過 2 個是 4.55%。日內模式實測 28.70% 與 5.00%，跟常態相當接近；滾動 60 根是 53.29% 與 13.03%，遠遠超出。後者的意思是短視窗的偏離度有明顯的厚尾——同一個「2 個標準差」的門檻，在兩種模式下代表的稀有程度完全不同。

拉長到一年半的 1 小時線，滾動 168 根（一週）：

```
13,848 根 K 線：2025-01-01 00:00:00+00:00 → 2026-07-31 23:00:00+00:00
vwap_rolling_168：最後一根 64,164.76，價格 62,920.68
價格在 VWAP 之上的比例：49.05%
偏離超過 1 個標準差：45.87% ／ 超過 2 個標準差：7.85%
```

「價格在 VWAP 之上」在三組設定裡都落在 45% 到 49%——這個數字本身沒有交易資訊（它接近 50% 是應該的），但它是一個有用的健康檢查：如果它跑到 70% 或 30%，那八成是計算或對齊出了問題，不是市場的性質。

## 視覺化

通道疊在 K 線上，偏離度放在下面：

```python
# quantbot/infrastructure/charting/plotly_vwap_chart_renderer.py
class PlotlyVWAPChartRenderer:
    """上格 K 線 ＋ VWAP ＋ 標準差通道，下格偏離度。

    通道用同一張圖疊上去而不是分兩張：要看的是「價格現在在通道的哪裡」，
    那是一個相對位置，拆成兩張圖就得靠眼睛在兩邊來回對時間軸。

    下格的偏離度是無單位的，所以它有固定的水平線可以標（±1、±2）。上格的通道
    寬度會隨行情變化，下格的門檻不會——這正是標準化的用處。
    """

    BAND_MULTIPLIERS: ClassVar[tuple[float, ...]] = (1.0, 2.0)
    BAND_COLORS: ClassVar[tuple[str, ...]] = ("#7f8c8d", "#c0392b")
```

上下兩格的分工正是標準化的價值：上格的通道會隨行情呼吸（波動大的時候變寬），所以「離通道多遠」在圖上不好比較；下格的單位是標準差，±2 那條線一整天都在同一個高度。策略要用的是下格那種形狀。

畫完之後有一件事值得用眼睛確認：把日內 VWAP 那張圖拉到 UTC 午夜的位置，會看到那條線在那一根**斷開重來**，而通道在每天開頭幾根特別窄（只累積了幾根 K 線）。那個窄通道會讓偏離度在每天開頭特別容易破 2——這是日內模式的已知性質，不是 bug，但拿它當進場條件的人要知道有這件事。

## 今日交付物

```
quantbot/
├── domain/
│   ├── values/
│   │   ├── price_source.py                     今天：CLOSE / TYPICAL
│   │   └── vwap_mode.py                        今天：SESSION / ROLLING
│   └── features/
│       ├── volume_weighted_average_price.py    今天：VWAP ＋ 加權標準差
│       └── vwap_deviation.py                   今天：策略要用的無單位版本
├── infrastructure/charting/
│   └── plotly_vwap_chart_renderer.py           今天
├── entrypoints/vwap_command.py                 今天
└── tests/domain/features/
    └── test_volume_weighted_average_price.py   今天
```

### 驗收標準

六項全過才算完成：

1. `uv run pytest tests/domain/features/test_volume_weighted_average_price.py` 全綠，包含跨日重置、滾動視窗不認識日界、零成交量回 NaN、標準差為 0 時偏離回 NaN 四種邊界。
2. **精度那個測試要過**：平移過的加權標準差與定義式的誤差小於 `1e-9`，而沒平移的版本誤差至少大一百倍。這一項是今天最容易被當成裝飾而跳過的，但它守的是一個不會報錯的錯誤。
3. `uv run python -m quantbot.entrypoints.vwap_command --symbol BTC/USDT --market spot --timeframe 1m --start 2026-07-15 --end 2026-07-16 --mode session` 印出 1,440 根、價格在 VWAP 之上約 45%，並產出 `notebooks/day11-spot_BTCUSDT_1m-vwap_session.html`。
4. 換成 `--mode rolling --window 60` 再跑一次，兩者的「偏離超過 1 個標準差」比例要明顯不同（實測 28.70% 對 53.29%）。這個差異是預期的結果，不是哪一邊算錯。
5. 打開產出的 html：日內模式的 VWAP 線在 UTC 午夜斷開重來，通道在每天開頭幾根明顯偏窄；滾動模式的線連續不斷。
6. `uv run mypy quantbot` 與 `uv run lint-imports` 全過。

第 4 項是今天真正的重點。兩個數字都對，而它們差一倍——這說明「偏離 VWAP 兩個標準差」這句話在沒有指定累積方式之前不構成一個定義。

> 免責聲明：本文為程式與資料工程的技術分享，所有數字皆為教學範例，不構成投資建議；VWAP 是對已發生成交的描述，不預測後續走勢。

## 明天

今天的兩個特徵都在回答「價格在哪裡」——相對於平均成本的位置。明天問一個不一樣的問題：**這段時間市場有多熱。**

Day 09 那兩根 K 線又要再出場一次。它們的開高低收與成交量幾乎一樣，成交筆數差 4.2 倍。所以「熱不熱」至少有三個角度（成交筆數、成交量、價格實際走了多少），而它們的答案會不一致。

明天 Day 12 會把這三個角度都做成標準化的分數，並且處理一個很容易寫成未來函數的地方：加密貨幣 24/7 不休市，但它有很明顯的時段節奏（實測最冷清與最熱鬧的鐘點差 2.71 倍）。要問「現在真的不尋常嗎」，就得跟**同一個鐘點的歷史**比，而那個比較只要寫成一行 `groupby("hour").transform("mean")`，就會把未來的資料算進基準裡。

也會補上 ATR——它是 Day 24 決定停損距離的依據，而它在這個專案裡不是 `Indicator` 而是 `Feature`，理由是 Day 04 那個基底類別的契約真的裝不下它。

## Reference

- [官方 K 線的 12 個欄位，含 `quote_volume` 與 `taker_buy_base_volume`（`quote_volume / volume` 就是那一根真正的 VWAP） — Binance Spot API Documentation, Market Data Endpoints](https://developers.binance.com/docs/binance-spot-api-docs/rest-api/market-data-endpoints)
- [`DatetimeIndex.normalize()` 保留型別與時區、只把時間部分歸零，而 `.date` 會退化成 object dtype — pandas documentation, `DatetimeIndex.normalize`](https://pandas.pydata.org/docs/reference/api/pandas.DatetimeIndex.normalize.html)
- [`Series.rolling` 與 `groupby(...).cumsum()` 的向量化累積寫法 — pandas documentation, Windowing operations](https://pandas.pydata.org/docs/user_guide/window.html)
- [變異數的平移不變性，以及「平方的平均減平均的平方」在大數值上的精度問題 — Wikipedia, Algorithms for calculating variance](https://en.wikipedia.org/wiki/Algorithms_for_calculating_variance)
