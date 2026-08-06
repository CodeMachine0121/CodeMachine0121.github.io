---
title: "Day 15：第二階段總結：把指標從散落的函式收斂成可重用的 feature 模組"
datetime: "2026-09-29"
description: "十個特徵，形狀全都不一樣：有的只吃 K 線、有的要三種資料；有兩個算不出精確的暖機期；有一個是事件；有一個根本不是時間序列。這篇把它們收成一份 YAML 就能跑的管線，並讓三種設定錯誤（缺資料、參數拼錯、參數值不合法）在載入時就失敗——實測 13,848 根 1 小時 K 線、13 個特徵、切掉 169 根暖機期。"
image: ""
parent: "2026 ithome-鐵人賽: 工程師的量化交易入門：從 K 線到可組合的交易策略引擎 系列"
draft: true
---

## 十個東西，十種形狀

第二階段到今天結束。手上的東西攤開來看：

| 來自 | 特徵 | 需要的原料 | 形狀 |
|---|---|---|---|
| Day 04–06 | SMA、EMA、RSI | K 線 | 連續值 |
| Day 10 | OBI | K 線 ＋ 掛單簿 | 連續值，中間有洞 |
| Day 11 | VWAP、偏離度 | K 線 | 連續值 |
| Day 12 | 活躍度、ATR | K 線 | 連續值 |
| Day 13 | 前高、突破 | K 線 | 事件（0 與 1） |
| Day 13 | 流動性擺盪 | K 線 ＋ 成交 ＋ 掛單簿 | 連續值 |
| Day 14 | Volume Profile | K 線或成交 | **不是時間序列** |
| Day 14 | 距離 POC | K 線 | 連續值 |

每一個都能用，但要一起用得自己動手串。而它們的差異比表格看起來更麻煩：

- **原料不同。** 一份只有 EMA 與 RSI 的設定不需要七十幾萬列的逐筆成交，但如果程式一律先把三種資料都撈出來，就得等那幾秒。
- **暖機期算不出來。** Day 12 的鐘點基準與 Day 14 的距離 POC 都只答得出一個下限，因為真正的暖機期取決於「一天幾根」，而那是 timeframe 的事。
- **NaN 有兩種意思。** 暖機期是 NaN，掛單簿沒錄到那幾段也是 NaN。前者可以整段切掉，後者不行——OBI 只有 45 分鐘有資料，照 NaN 切會把整年的資料切光。
- **有一個根本不能進管線**（Volume Profile 的 index 是價格）。

今天要做的事就是處理這些差異，讓一份 YAML 能算出所有東西。而這一天有一個很硬的期限：**明天 Day 16 的策略積木會用字串去這張註冊表取特徵**，所以介面要在今天訂死。

## 交易概念補課：特徵工程在量化裡的位置

今天沒有新的交易術語，但有一件關於工作分配的事值得講。

一個策略的邏輯常常只有十行：「快線在慢線之上、RSI 沒有超買、活躍度夠高，就做多」。而支撐那十行的東西是這十四天做的所有事——把資料抓乾淨、把每個指標算對、驗證每個特徵值不值得用、把未來函數一個一個擋掉。

比例大概就是這樣：**策略邏輯佔一兩成，其餘都在特徵與資料。** 這件事對從軟體工程進來的人算是好消息，因為那八成正好是工程能力直接派上用場的部分；反過來說，一個「策略想法很多但資料處理很隨便」的組合，八成的力氣花在錯的地方。

今天這條管線就是那八成的收尾。它不產生任何新的訊號，但它決定了後面十五天寫策略時要不要一直回頭處理同樣的雜事。

## 工程實作

### 註冊表：Day 06 那張表的完整版

Day 06 已經有一張註冊表，三行就寫完了：

```python
INDICATORS: Mapping[str, type[Indicator]] = MappingProxyType(
    {"sma": SMA, "ema": EMA, "rsi": RSI}
)
```

它放的是**類別**，取出來 `cls(period)` 就能用。那樣寫得通，因為三個指標的參數形狀完全一樣。

今天有十種特徵，參數從 `period` 一個，到 `side ＋ window ＋ bucket_count` 三個都有。同樣的做法會變成 `cls(**parameters)`，而那是這個系列禁止的反射式分派——型別檢查器完全看不到裡面發生什麼事，參數名一改就在執行期才炸，而且錯誤訊息會是 `TypeError: unexpected keyword argument`，不會告訴使用者合法的參數是什麼。

所以中間多一層：

```python
# quantbot/domain/interfaces/feature_builder.py
class FeatureBuilder(Protocol):
    """把一組設定檔參數變成一個特徵物件。

    為什麼需要這一層，而不是讓註冊表直接放類別然後 `cls(**parameters)`：那個寫法
    是反射式分派，型別檢查器完全看不到裡面發生什麼事，而且參數名稱一改就在執行期
    才炸。這個系列禁用反射式分派，理由就是它把錯誤從編譯期推到執行期。

    有了 builder，「obi 這個字串需要 depth_level 與 aggregation 兩個參數、
    後者只能是 mean 或 last」這件事變成一段有型別的普通程式碼，mypy 檢查得到，
    而且參數不合法時的錯誤訊息可以說清楚合法值是什麼。
    """

    @property
    def kind(self) -> str:
        """設定檔裡用的字串。它是這個 builder 在註冊表裡的鍵。"""
        ...

    def build(self, parameters: FeatureParameters) -> Feature: ...
```

每個 builder 跟它的特徵住同一個檔案，因為它只為那個特徵存在——跟 Day 06 的 `WilderSmoother` 一開始跟 RSI 同住是同一個判斷。長相都很像這樣：

```python
# quantbot/domain/features/order_book_imbalance.py
class OrderBookImbalanceBuilder:
    """設定檔的 obi。深度只能是錄過的那幾檔，聚合只能是 mean 或 last。"""

    @property
    def kind(self) -> str:
        return "obi"

    def build(self, parameters: FeatureParameters) -> OrderBookImbalance:
        aggregation = parameters.text("aggregation", DepthAggregation.MEAN.value)
        if aggregation not in tuple(DepthAggregation):
            raise ValueError(
                f"aggregation 只能是 {[value.value for value in DepthAggregation]}，"
                f"實得 {aggregation!r}"
            )
        return OrderBookImbalance(
            parameters.integer("depth_level", DepthColumns.LEVELS[0]),
            aggregation=DepthAggregation(aggregation),
        )
```

那個「列出合法值」的錯誤訊息是 builder 這一層最直接的回報。反射式分派給不出這種訊息，因為它不知道 `aggregation` 是一個列舉。

註冊表本身則刻意不手寫字串：

```python
# quantbot/domain/features/feature_registry.py
def _by_kind(*builders: FeatureBuilder) -> Mapping[str, FeatureBuilder]:
    """用每個 builder 自己宣告的 kind 當鍵，而不是在這裡手寫字串。

    手寫的話會有兩份真相：builder 裡的 kind 與這張表的鍵。它們一旦不一致，
    錯誤訊息會指向一個註冊表裡不存在的名字。
    """
    registered: dict[str, FeatureBuilder] = {}
    for builder in builders:
        if builder.kind in registered:
            raise ValueError(f"重複註冊的 kind：{builder.kind}")
        registered[builder.kind] = builder
    return MappingProxyType(registered)
```

三個指標共用一個 builder，因為它們的參數形狀真的一樣：

```python
# quantbot/domain/features/candle_indicator_feature.py
class CandleIndicatorBuilder:
    """sma、ema、rsi 三個 kind 共用這一個 builder。

    它們的參數形狀完全一樣（period ＋ column），差別只在註冊表裡取到哪個類別，
    所以寫三個一模一樣的 builder 沒有意義。kind 由建構參數決定，而 INDICATORS
    那張表是 Day 06 就存在的——這裡沒有新增任何指標知識。
    """
```

### 參數驗證：抓拼錯的欄名

設定檔的值是弱型別的。YAML 的 `period: 14` 是 int，`period: "14"` 是 str，而 `perid: 14` 是一個完全合法的 YAML。三種都不該讓程式跑到一半才炸。

前兩種靠取值時轉型；第三種需要另一個機制：

```python
# quantbot/domain/values/feature_parameters.py
@dataclass(frozen=True)
class FeatureParameters:
    """從設定檔讀進來的一組特徵參數，帶型別檢查與未使用檢查。

    設定檔的值是弱型別的：YAML 的 `period: 14` 是 int，`period: "14"` 是 str，
    而 `perid: 14`（拼錯）是一個完全合法的 YAML。三種都不該讓程式跑到一半才炸。

    所以取值一律走 integer()／number()／text()，它們負責轉型與報錯；而 ensure_used()
    負責抓拼錯的欄名——**那是這個類別存在最重要的理由**。少了它，一個拼錯的參數
    會被安靜忽略，於是使用者以為自己在跑 period=50，實際上跑的是預設值 14。
    """
```

`ensure_used()` 的做法很簡單：記下哪些鍵被取用過，收工時比對：

```python
# quantbot/domain/values/feature_parameters.py
    def ensure_used(self) -> None:
        """所有給進來的參數都被取用過了嗎。

        沒被取用的參數幾乎一定是拼錯的欄名，所以這裡丟例外而不是警告。
        Day 17 的設定檔載入器會在載入時呼叫它，讓錯誤在啟動時就出現，
        NEVER 等到跑完一輪回測才發現參數沒生效。
        """
        unused = set(self.values) - self._consumed
        if unused:
            raise ValueError(f"沒有被使用的參數：{sorted(unused)}")
```

這裡選「丟例外」而不是「印警告」，理由是警告在有十幾個特徵的輸出裡會被滑過去，而這個錯誤的後果是**跑了一整輪回測、結果建立在錯誤的參數上**。那種錯誤越早失敗越好。

型別轉換還有一個容易漏的地方：

```python
def test_parameters_reject_a_boolean_pretending_to_be_a_number():
    """Python 的 bool 是 int 的子類別，所以 True 會安靜地變成 1。"""
    parameters = FeatureParameters(values={"period": True})

    with pytest.raises(ValueError):
        parameters.integer("period")
```

Day 09 解析 WebSocket 的 JSON 時處理過同一件事。`isinstance(True, int)` 是 `True`，所以任何「檢查是不是整數」的程式碼都要額外擋 bool，否則 YAML 的 `period: true` 會變成 `period=1`。

### 轉接器：不動已經訂好的介面

Day 04–06 的三個指標繼承 `Indicator`，簽章是 `compute(CandleSeries)`；Day 10 訂的 `Feature` 要的是 `compute(MarketView)`。兩者差一個參數型別。

三種處理方式，選第三種：

```python
# quantbot/domain/features/candle_indicator_feature.py
class CandleIndicatorFeature:
    """把 Day 04 的 Indicator 接進 Feature 協定。實作 domain 的 Feature。

    Day 04–06 的三個指標（SMA、EMA、RSI）繼承的是 `Indicator` ABC，簽章是
    `compute(CandleSeries) -> Series`；Day 10 訂的 `Feature` 協定要的是
    `compute(MarketView) -> Series`。兩者差一個參數型別。

    處理方式有三種，這裡選第三種：

    1. 改 Indicator 的簽章讓它吃 MarketView。那會讓三個已經發佈的指標、它們的
       測試、以及 Day 04–06 的每個範例一起改，而且會讓「只吃 K 線一個欄位」這個
       很有價值的窄契約消失。
    2. 讓 Indicator 同時繼承兩個介面。ABC 加 Protocol 混用，而簽章還是衝突。
    3. **一個轉接器。** 二十行，不動任何既有的東西，而且它把「指標是特徵的一個
       特例」這件事寫成了程式碼。

    這是 Day 06 說「介面要在早期訂死」的兌現方式：早期訂的那個介面不必是萬能的，
    它只要在自己的範圍內正確，而範圍之外用轉接器接上去。
    """
```

第一個選項值得多想一下，因為它看起來是「把事情做對」。把 `Indicator` 改成吃 `MarketView` 之後，三個指標就是特徵，不需要轉接器，程式碼更少。

代價是那個窄契約消失了。`Indicator` 現在的契約是「吃 K 線的一個欄位、回一條序列」，而它的 `compute()` 因此可以統一處理欄位檢查、型別轉換、命名——那是它作為 ABC 存在的全部理由。改成吃 `MarketView` 之後，每個指標都得自己從 view 裡挖出 K 線再挖出欄位，共用實作就沒了。

換句話說：**介面窄不是缺點，是它能提供共用實作的前提。** 需要更寬的地方用轉接器接，二十行換一個不必動任何既有程式碼的結果。

轉接器唯一需要保證的事有測試守著：

```python
def test_the_indicator_adapter_produces_the_same_numbers_as_the_indicator():
    """轉接器 NEVER 改變數值，它只換一個參數型別。"""
    view = make_view()
    indicator = RSI(14)

    adapted = CandleIndicatorFeature(indicator).compute(view)

    assert adapted.equals(indicator.compute(view.candles))
    assert adapted.name == indicator.name
```

### 管線：四件之前散在各處的事

```python
# quantbot/domain/features/feature_pipeline.py
class FeaturePipeline:
    """一組特徵，一次算完，交出一張對齊好的表。

    它負責四件事，而這四件事之前散在每個 notebook 與 entrypoint 裡各寫一次：

    1. **檢查原料**：算之前就確認每個特徵要的資料都在。缺了就報錯，NEVER 算出一整
       欄 NaN——那會跟暖機期混在一起，而兩者的處理方式完全不同。
    2. **算完 concat**：每個特徵回傳一條與 K 線同 index 的序列，所以橫向併起來就是
       一張特徵表。
    3. **暖機期**：切掉前面不能用的那幾根。這一步比看起來麻煩，見下面。
    4. **快取**：同一份資料、同一個特徵不重算。

    它是 domain service 的形狀（純計算、無 I/O），但它住在 features/ 而不是
    services/，因為它是特徵家族的一部分——要拿它去算東西的人會先找到 features/。
    """
```

### 暖機期：宣告值只是下限

這是今天最需要小心的一段。

直覺的做法是 `table.iloc[declared_warmup_bar_count:]`——問所有特徵誰的暖機期最長，切掉那麼多根。這個做法在 Day 04–06 的三個指標上完全正確，因為它們答得出精確的根數。

到今天為止有兩個答不出來的：

```python
# quantbot/domain/features/feature_pipeline.py
    @property
    def declared_warmup_bar_count(self) -> int:
        """所有特徵宣告的暖機期裡最長的那一個。

        它是**宣告值**，不是實際值。Day 12 的鐘點基準與 Day 14 的距離 POC 都答不出
        精確的根數（它們的暖機期取決於一天幾根，而那是 timeframe 的事），所以它們
        回的是下限。真正的暖機期由 NaN 決定，見 trimmed()。
        """
        return max(feature.warmup_bar_count for feature in self._features)
```

那就改成「照 NaN 切」——把有 NaN 的列全部丟掉？也不對，因為 NaN 有兩種意思。OBI 只有錄製那 45 分鐘有資料，其餘全是 NaN；照 NaN 切會把整年的資料切光。

所以是第三種做法：

```python
# quantbot/domain/features/feature_pipeline.py
    def trimmed(self, view: MarketView) -> pd.DataFrame:
        """算完之後切掉暖機期。

        切法是「丟掉第一個所有欄位都有值的位置之前的所有列」，而不是
        `iloc[declared_warmup_bar_count:]`。兩個理由：

        - 宣告值只是下限（見 declared_warmup_bar_count），照它切會留下 NaN。
        - 有些特徵的 NaN 不在開頭。掛單簿只有錄製的那幾段有資料，所以 OBI 中間
          就是 NaN，而那不是暖機期——照 NaN 切會把整段資料切光。

        所以它用 first_valid_index 找那個位置，而中間的 NaN 保持原樣交給呼叫端。
        「哪些列可以用」是策略的決定（有些條件容忍缺值），不是管線的。
        """
        table = self.compute(view)
        start = table.dropna().first_valid_index()
        if start is None:
            return table.iloc[0:0]
        return table.loc[start:]
```

最後那句是這個設計的關鍵：**中間的 NaN 不處理，交給呼叫端。** 管線不知道策略容不容忍缺值——一個「OBI 有資料時才進場」的條件跟一個「OBI 缺值就當中性」的條件都合理，而那是 Day 16 的積木要決定的事。管線只負責把開頭那段確定不能用的切掉。

兩種情況各有一個測試：

```python
def test_trimming_uses_the_first_fully_valid_row_not_the_declared_warmup():
    """宣告的暖機期只是下限，照它切會留下 NaN。"""
    view = make_view()
    pipeline = build(
        FeatureSpecification("ema", {"period": 12}),
        FeatureSpecification("activity", {"window": 60}),
    )

    trimmed = pipeline.trimmed(view)

    assert trimmed.notna().all().all()
    assert len(trimmed) < len(view.candles)
    assert len(trimmed) >= len(view.candles) - pipeline.declared_warmup_bar_count * 2


def test_trimming_keeps_holes_that_are_not_warmup():
    """掛單簿中間的空白不是暖機期，照 NaN 切會把整段資料切光。"""
    view = make_view(bar_count=10, with_depth=True)
    depth = view.require_depth()
    # 把中間三小時的深度挖掉，模擬錄製中斷
    kept = depth.frame.loc[
        (depth.captured_times < pd.Timestamp("2026-07-01T04:00", tz="UTC"))
        | (depth.captured_times >= pd.Timestamp("2026-07-01T07:00", tz="UTC"))
    ]
    holed = MarketView(candles=view.candles, depth=DepthSeries(LISTING, kept))
    pipeline = build(FeatureSpecification("obi", {"depth_level": 5}))

    trimmed = pipeline.trimmed(holed)

    assert len(trimmed) == 10  # 沒有被切光
    assert trimmed["obi_5_mean"].isna().sum() == 3  # 中間那三根還是 NaN
```

順帶一個寫測試時撞到的事：第一版的測試資料把深度的索引建成 tz-naive（`pd.date_range` 沒給 `tz`），而 K 線是 tz-aware 的。結果不是例外，是**一整欄 NaN**——`reindex` 對不上，pandas 安靜地填了 NaN。這正是 Day 02 訂「時間一律 tz-aware UTC」那條規矩要防的東西，而它連在測試資料裡都會咬人：

```python
        moments = pd.DatetimeIndex(
            # tz 一定要給：K 線是 tz-aware 的，兩邊時區不一致的話 reindex 對不上，
            # 而結果是一整欄 NaN 而不是例外
            pd.date_range("2026-07-01", periods=bar_count * 60, freq="1min", tz="UTC"),
            name=DepthColumns.CAPTURED_AT,
        )
```

### 快取：用 id 而不是雜湊內容

```python
# quantbot/domain/features/feature_pipeline.py
    def _compute_one(self, feature: Feature, view: MarketView) -> pd.Series:
        """快取的鍵是「這份 view 的身分」加「特徵的名字」。

        用 id(view) 而不是雜湊整張 DataFrame：後者要走過每一個值，對幾十萬列的資料
        來說比重算特徵還慢。代價是快取只在同一個 view 物件上有效——而那正是要的
        效果，因為 MarketView 是 frozen 的，同一個物件的內容不會變。
        """
        key = (id(view), feature.name)
        if key not in self._cache:
            self._cache[key] = feature.compute(view)
        return self._cache[key]
```

「用 id 當快取鍵」通常是不好的做法，因為物件被回收之後 id 會被重用。這裡可以接受，理由是這個快取的生命週期跟 pipeline 物件一樣，而 pipeline 是每次分析建一個新的——它不是跨請求的長壽快取。

要注意的是這個快取解決的是哪個問題：不是「同一個特徵被兩個地方用到」，是 `trimmed()` 內部會呼叫 `compute()`，而報告與圖表常常兩個都要。沒有快取的話 Day 14 那個逐根重算分布的特徵會被算兩次，而它是這批裡面最慢的。

### 同名的特徵要在建構時擋掉

```python
# quantbot/domain/features/feature_pipeline.py
    @staticmethod
    def _duplicated_names(features: tuple[Feature, ...]) -> list[str]:
        """同名的特徵會在 concat 之後互相蓋掉，所以建構時就擋。

        這件事很容易發生：兩個 `ema` 都用 period=12 就會同名，而使用者以為自己
        設了兩個不同的東西。
        """
```

這是「特徵的名字帶參數」那個決定（Day 10 開始的慣例）的直接後果：名字帶參數 → 同參數就同名 → 表上互相蓋掉。與其讓使用者在一張少一欄的表上找原因，不如在建構時就說「這裡設了兩個一樣的東西」。

### 設定檔：淺到不需要說明

```yaml
# quantbot/infrastructure/configuration/features.yaml
features:
  - kind: sma
    period: 20
  - kind: ema
    period: 12
  - kind: rsi
    period: 14
  - kind: vwap
    mode: session
  - kind: activity
    measure: trade_count
    baseline: rolling
    window: 168
  - kind: breakout
    side: high
    window: 20
  - kind: distance_to_poc
    window_days: 5
```

參數跟 `kind` 平放在同一層，不另外包一層 `parameters`：

```python
# quantbot/infrastructure/configuration/yaml_feature_specification_loader.py
class YamlFeatureSpecificationLoader:
    """讀一份 YAML，變成一串 FeatureSpecification。

    格式刻意很淺——一個 features 清單，每項一個 kind 加上參數：

        features:
          - kind: ema
            period: 12
          - kind: rsi
            period: 14
          - kind: activity
            measure: trade_count
            window: 168

    參數跟 kind 平放在同一層，不另外包一層 parameters。理由是使用者要寫的東西越少
    越好，而 kind 是保留字這件事只要講一次。代價是「kind」不能當參數名，而那不是
    任何特徵需要的參數名。

    這個類別只負責「YAML 長得對不對」，NEVER 驗證參數的值——那是 builder 的事。
    分開的好處是錯誤訊息不會混在一起：格式錯誤說「第 3 項少了 kind」，
    參數錯誤說「aggregation 只能是 mean 或 last」。
    """
```

專案內附的那份設定檔本身要有測試，因為它同時是文件：

```python
def test_the_shipped_configuration_loads_and_builds():
    """專案內附的那份設定檔必須真的建得起來。

    它是文件也是範例，而一份跑不起來的範例比沒有範例更糟。
    """
    specifications = LOADER.load(SHIPPED_CONFIGURATION)
    features = FeatureRegistry().build_all(specifications)

    assert len(features) == len(specifications)
    assert len({feature.name for feature in features}) == len(features)
```

### 先建管線，再讀資料

```python
# quantbot/application/compute_features_application.py
class ComputeFeaturesApplication:
    """一份設定 ＋ 一段時間 → 一張特徵表。

    它做的第一件事是**先建管線、再讀資料**。順序反過來（先把三種資料都撈出來）
    也能跑，但那會讀進根本不會用到的東西：一份只有 ema 與 rsi 的設定不需要
    七十幾萬列的逐筆成交，而讀那些要花好幾秒。

    管線建好之後 required_inputs 就問得出來，所以要讀什麼是算得出來的。
    這是 Day 10 把 required_inputs 放進 Feature 協定的實際回報。
    """
```

Day 10 訂介面時把 `required_inputs` 放進去，當時給的理由是「讓管線能在載入設定時就擋掉跑不起來的組合」。今天它多了第二個用途：決定要讀哪些資料。一個介面上的欄位有兩個獨立的用途，通常表示它訂對了。

## 實際跑一次

```bash
uv run python -m quantbot.entrypoints.features_command \
    --symbol BTC/USDT --market spot --timeframe 1h \
    --start 2025-01-01 --end 2026-08-01
```

```
設定檔 quantbot/infrastructure/configuration/features.yaml
  13 個特徵，需要原料：candles
  宣告的暖機期 168 根

算完 13 欄 × 13,848 列
切掉暖機期之後剩 13,679 列（丟掉 169 根）

每一欄的可用比例與最後一個值
  sma_20                             可用  99.86%  最後    63,423.3875
  ema_12                             可用  99.92%  最後    63,132.5395
  ema_26                             可用  99.82%  最後    63,510.0870
  rsi_14                             可用  99.90%  最後        32.5531
  vwap_session                       可用 100.00%  最後    63,589.3512
  vwap_session_deviation             可用  96.26%  最後        -0.9790
  activity_trade_count_rolling_168   可用  98.61%  最後        -0.2376
  activity_absolute_return_rolling_168 可用  98.78%  最後        -0.5006
  atr_14                             可用  99.90%  最後       293.0471
  prior_high_20                      可用  99.86%  最後    64,496.6400
  breakout_high_20                   可用 100.00%  最後         0.0000
  breakout_low_20                    可用 100.00%  最後         0.0000
  distance_to_poc_5d                 可用  99.99%  最後        -0.0177

落地：data/features/spot_BTCUSDT_1h_features.parquet
```

幾件事可以讀。

**「需要原料：candles」是算出來的。** 這份設定沒有 OBI 與流動性擺盪，所以逐筆成交與掛單簿完全沒被讀進來。加一行 `kind: obi` 進去，這一行就會變成 `candles, depth`，而讀取的行為跟著變。

**丟掉 169 根，而宣告的暖機期是 168。** 兩個數字差 1，那個 1 來自活躍度的 `shift(1)`。這正是「宣告值只是下限」的實際樣子：照 168 切會留下一列 NaN。

**`vwap_session_deviation` 只有 96.26% 可用。** 缺的那 3.74% 不在開頭——是每天開頭那幾根。日內 VWAP 在一天的第一根只累積了一根 K 線，加權標準差是 0，偏離度因此沒有定義（Day 11 那個「NEVER 回 inf」的處理）。一年半有 578 天，每天缺一根就是 578 根，佔 4.17%，跟實測的 3.74% 對得上（有些天的第一根之後標準差還是 0）。

**兩個 breakout 的可用比例是 100%。** 事件式特徵在暖機期是 0 而不是 NaN（Day 13 訂的），所以它們永遠「有值」。這也是為什麼暖機期不能只看有沒有 NaN——一個全 0 的欄位跟一個算好的欄位在 NaN 上看不出差別。

### 三種設定錯誤，都在跑之前失敗

管線的價值不只在成功的時候。三種最常見的設定錯誤：

**一、缺原料。** 設定檔要 OBI，但那段時間沒有錄掛單簿：

```
ValueError: 缺少原料：depth。需要它們的特徵：{'obi_5_mean': ['depth']}
```

它指名了是哪個特徵在要那份資料。少了這個訊息，使用者看到的會是一整欄 NaN，而那跟「暖機期特別長」長得一樣。

**二、參數拼錯。**

```yaml
features:
  - kind: rsi
    period: 14
    windo: 5
```

```
ValueError: rsi(period=14, windo=5)：沒有被使用的參數：['windo']
```

錯誤訊息前面那段 `rsi(period=14, windo=5)` 是 `FeatureSpecification.describe()` 產生的，它讓「哪一行有問題」不必去數行號。

**三、參數值不合法。**

```yaml
features:
  - kind: obi
    depth_level: 7
```

```
ValueError: obi(depth_level=7)：沒有錄前 7 檔。錄下來的深度是 (5, 10, 20)，
而這是 schema 的一部分——換一個深度要重新錄，不是重算
```

這個訊息是 Day 09 那個「不可逆的決定」一路傳到設定層的樣子。使用者在 YAML 裡寫了一個看起來很合理的數字，而回答不只是「不合法」，還說明了為什麼——以及要付什麼代價才能改。

三種都在讀資料之前失敗。這件事的價值在一年半的 1 小時線上還不明顯（讀資料一兩秒），到了 1 分鐘線與逐筆成交就是幾十秒對零秒的差別。

## 第二階段回顧

七天下來，這一階段做的事可以收成三句話。

**第一，這一階段的特徵都不是看盤軟體上有的東西。** 第一階段的 MA、EMA、RSI 任何平台都有；OBI 要自己錄掛單簿、流動性擺盪要把成交跟掛單簿對起來、Volume Profile 的精算版要處理七十幾萬列 tick。這是「自己寫」相對於「用現成工具」的實際差別，而它換到的不只是特徵本身——是知道那些特徵怎麼算出來的、以及它們什麼時候不可靠。

**第二，這一階段量出來的東西，一半是限制而不是能力。** 攤開來看：

| 發現 | 數字 |
|---|---|
| OBI 在秒級有資訊 | 秩相關 0.43（t = 23.8） |
| 它比手續費小 | 0.37 bp 對 20 bp，54 倍 |
| 深度變化主要是撤單不是成交 | 75.83% |
| 假突破的比例（在本文的定義下） | 90.78% |
| K 線近似 Volume Profile 在分鐘級夠用 | 價值區間重疊 97.79% |
| 同一個近似在小時級不夠用 | 重疊只剩 52.74% |
| 時段節奏的振幅 | 最熱與最冷差 2.71 倍 |

七項裡有四項是「這件事沒有想像中好用」。這不是壞消息——**沒量過的特徵看起來永遠比實際上有用**，而第三階段要用這些東西組策略，先知道每一個有多大，比多知道三個特徵有價值。

**第三，這一階段擋掉了五個不會報錯的錯誤。** 一個一個列：

| 錯誤 | 症狀 |
|---|---|
| 先算比例再平均，順序寫反（Day 10） | 數字照樣落在 −1 到 +1 |
| 加權變異數不平移（Day 11） | 有效位數少一半，值看起來正常 |
| 當根算進自己的基準（Day 12） | 暴量的 z-score 被系統性低估 |
| 鐘點基準用整段樣本（Day 12） | 100 倍暴量被壓成 5 以下 |
| `rolling().max()` 含當根（Day 13） | 突破訊號完全消失 |

五個都不會噴例外。它們的共同點是**只有並排對數字才看得出來**，而那就是為什麼這一階段每一天都有一個對照組：迴圈版對向量化版、精算對近似、正確寫法對一行寫法。

## 今日交付物

```
quantbot/
├── domain/
│   ├── values/
│   │   ├── feature_parameters.py               今天：型別檢查 ＋ 抓拼錯
│   │   └── feature_specification.py            今天：設定檔的一行
│   ├── interfaces/feature_builder.py           今天：取代反射式分派
│   └── features/
│       ├── candle_indicator_feature.py         今天：Indicator 的轉接器
│       ├── feature_registry.py                 今天：字串 → 特徵
│       ├── feature_pipeline.py                 今天：原料檢查、暖機、快取
│       └── *.py                                各日的特徵，今天各加一個 builder
├── application/compute_features_application.py 今天：先建管線再讀資料
├── infrastructure/configuration/
│   ├── features.yaml                           今天：13 個特徵的設定範例
│   └── yaml_feature_specification_loader.py    今天
├── entrypoints/features_command.py             今天
└── tests/
    ├── domain/features/test_feature_pipeline.py                     今天
    ├── domain/features/test_feature_registry.py                     今天
    └── infrastructure/configuration/test_yaml_feature_specification_loader.py  今天
```

### 驗收標準

八項全過才算完成：

1. `uv run pytest` 全綠。
2. `uv run pytest tests/domain/features/test_feature_registry.py` 裡那個「走過整張註冊表把每個 kind 都建一次」的測試要過。它抓的是「新增 builder 但忘記給參數預設值」。
3. **參數拼錯要丟例外**，而且錯誤訊息要指名是哪一個參數沒被使用。
4. 內附的 `features.yaml` 必須載得起來並建得出所有特徵——它是文件，跑不起來的文件比沒有文件糟。
5. `uv run python -m quantbot.entrypoints.features_command --symbol BTC/USDT --market spot --timeframe 1h --start 2025-01-01 --end 2026-08-01` 印出 13 欄、需要的原料只有 `candles`、並落地一份 parquet。
6. 在設定檔加一行 `kind: obi`，同一段時間再跑一次：要在讀資料之後、算特徵之前失敗，訊息指名 `obi_5_mean` 需要 `depth`。
7. 切掉暖機期之後的表要**完全沒有 NaN**（在沒有掛單簿特徵的設定下）。有 NaN 表示 `trimmed()` 的邏輯壞了。
8. `uv run mypy quantbot` 與 `uv run lint-imports` 全過。特別確認 `domain/features/` 沒有 import 到 `yaml`——設定檔的格式是 infrastructure 的事，domain 只認得 `FeatureSpecification`。

第 3 項與第 6 項是今天的重點。它們守的是同一件事：**設定錯誤要在啟動時失敗，而不是產生一張看起來合理的錯誤結果。**

> 免責聲明：本文為程式與資料工程的技術分享，所有數字皆為教學範例，不構成投資建議。

## 明天

第二階段結束，手上有一條「一份設定 → 一張特徵表」的管線。而那張表現在還沒有任何用途——它只是十三欄數字。

明天開始第三階段，而第一天就是整個 `quantbot` 最關鍵的一天。

問題是這樣：如果每個策略都寫成一個獨立的 class，三個策略就有三份重複的「算特徵、判斷條件、決定部位」邏輯，而且想試「這個策略的進場條件配那個策略的出場條件」時完全沒辦法。所以策略不會是 class，會是**一組可以互相組合的積木**：一個策略等於三組條件（進場、出場、過濾）加上組合運算。

那些條件會用字串去今天這張註冊表取特徵，所以使用者寫設定檔時不必碰 Python——這是今天要把介面訂死的理由。

Day 16 也會處理一件跟未來函數有關的事，而且處理方式跟前面幾天不同：**把「用第 t 根的資訊、第 t+1 根成交」做成引擎的行為**，而不是靠每個策略自己記得。積木化之後策略數量會暴增，靠人記得一定會漏。

## Reference

- [`Protocol` 是結構型的，實作不需要繼承也不需要 import 它 — Python documentation, `typing.Protocol`](https://docs.python.org/3/library/typing.html#typing.Protocol)
- [`DataFrame.first_valid_index` 與 `dropna` 的組合，用來找第一個完整的列 — pandas documentation, `DataFrame.first_valid_index`](https://pandas.pydata.org/docs/reference/api/pandas.DataFrame.first_valid_index.html)
- [`reindex` 在時區不一致時會產生 NaN 而不是報錯 — pandas documentation, Time zone handling](https://pandas.pydata.org/docs/user_guide/timeseries.html#time-zone-handling)
- [`bool` 是 `int` 的子類別，所以 `isinstance(True, int)` 為真 — Python documentation, Boolean Values](https://docs.python.org/3/library/stdtypes.html#boolean-values)
