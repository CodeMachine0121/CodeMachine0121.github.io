---
title: "Day 17：第一個組合：先用 Python 寫出趨勢跟隨的邏輯，再把它拆成積木"
datetime: "2026-10-01"
description: "組合式是結論，不是起點。這篇先用最直白的 Python 寫出「EMA 交叉進出、RSI 擋掉追高」，把每個條件在防什麼問題講清楚，再拆成 Day 16 的積木、最後寫成 YAML。三種寫法在 13,823 根真實 1 小時 K 線上逐根完全相同，0 個不一致；另外處理一個安靜到不會報錯的設定檔錯誤：把 ema_12 寫成 ema12。"
image: ""
parent: "2026 ithome-鐵人賽: 工程師的量化交易入門：從 K 線到可組合的交易策略引擎 系列"
draft: false
---

## 先寫死，再抽象

昨天做完積木庫，但三個策略都是在 Python 裡手動用 `&` 組出來的。今天要走完整條路徑，走到「使用者改一份 YAML 就能換策略」。

不過中間有一步不能跳過。

先用最直白的方式把邏輯寫出來，看清楚每個判斷在防什麼問題，**之後**才拆成積木。順序反過來的話——直接丟一份 YAML 說「照這個格式填」——填格子的人不會知道自己在填什麼，也就沒有能力判斷組出來的東西合不合理。而第三階段最後會給一個能跑幾百種組合的工具，那個工具在沒有判斷力的手上是危險的。

所以今天的順序是：寫死的 Python → 積木 → YAML → 證明三者相同。

## 交易概念補課：趨勢跟隨長什麼樣子

**趨勢跟隨（trend following）**是最古老的一類系統化策略，邏輯只有一句話：等趨勢出現才進場，趨勢還在就抱著，趨勢轉向就走。

它的績效形狀有一個特徵值得先知道，因為它會影響怎麼評估它：**勝率低，但賠率高。** 大部分交易是小賠——訊號出現、進場、趨勢沒續下去、停損出場，虧一點點。真正賺錢的是少數幾筆抱到大段行情的交易。

這件事的直接後果是：**NEVER 用勝率評估趨勢跟隨策略。** 一個勝率 35% 的趨勢策略可能長期賺錢，而一個勝率 70% 的策略可能是賠的——只要那 30% 的虧損單每筆都比賺的大。Day 22 會把「勝率與賠率要一起看」做成報表的一部分，今天先把這個預期建立起來，免得等一下看到數字時判斷錯方向。

## 最直白的寫法

不用任何抽象，把邏輯一次寫完。這段程式碼吃的是昨天那張表（K 線欄位 ＋ 特徵），回傳每一根的部位：

```python
# tests/reference/reference_trend_following.py
class ReferenceTrendFollowing:
    """EMA 快慢線交叉進出、RSI 擋掉追高，一根一根跑完。"""

    def positions(self, table: pd.DataFrame) -> pd.Series:
        """回傳每一根的部位（1.0 持有、0.0 空手）。"""
        fast = table[self.fast]
        slow = table[self.slow]
        ready = fast.notna() & slow.notna()
        above = (fast > slow) & ready

        # 交叉＝狀態翻轉，而且前一根也必須是有效值
        golden = (
            above & ~above.shift(1, fill_value=False) & ready.shift(1, fill_value=False)
        )
        death = ~above & above.shift(1, fill_value=False) & ready

        # 追高的過濾：交叉當下 RSI 已經超買就不進
        overheated = table[self.momentum] > self.overbought
        entry = (golden & ~overheated).shift(1, fill_value=False)
        leave = death.shift(1, fill_value=False)

        # 交叉條件要看前一根，加上位移一根，所以最快在第 2 根才能持有
        first_allowed_bar = 2

        held: list[float] = []
        holding = False
        for position, moment in enumerate(table.index):
            if holding and bool(leave[moment]):
                holding = bool(entry[moment])
            elif not holding and position >= first_allowed_bar and bool(entry[moment]):
                holding = True
            held.append(1.0 if holding else 0.0)

        return pd.Series(held, index=table.index, dtype="float64")
```

它住在 `tests/reference/`，跟 Day 05 的 `ReferenceEMA`、Day 06 的 `ReferenceRSI` 同一個位置與同一個用途：**照定義手寫、只在測試裡當對照組、NEVER 進正式路徑。** 等一下它的工作就是跟積木版本對數字。

十幾行程式碼，但裡面有四個決定，每一個都在防一件具體的事。

### 一、為什麼用交叉，不用「站在上面」

`golden` 那三個條件在做的事是「狀態翻轉」：前一根還在下面、這一根到了上面。

如果換成 `fast > slow`（快線站在慢線之上），一段趨勢裡的**每一根**都會成立。昨天量過這個差別：同一段 BTC/USDT 現貨 1 小時 K 線上，交叉 240 次，而「站在上面」有 7,001 根。

差 29 倍不只是數字問題。用後者當進場條件，程式會在同一波趨勢裡反覆送出進場訊號，而一個沒有處理重複進場的回測會把每一次都算成一筆新交易——於是那條權益曲線會漂亮到不合理。昨天的引擎在狀態機層面擋掉了重複進場，但條件本身寫錯的話，語意還是錯的：`fast > slow` 描述的是狀態，不是事件。

### 二、為什麼前一根也必須是有效值

暖機期結束的第一根，前一根是 NaN。而 NaN 比什麼都不是——`NaN > slow` 是 False，所以 `~above.shift(1)` 在那一根是 True，看起來就像剛剛翻上去。

少了這個條件，**每一個交叉條件都會在暖機期結束的那一根送出一次假訊號**。這種錯誤不會報錯、圖上也看不出來（只有一根），但它在回測裡是一筆真的交易。

### 三、為什麼要 RSI 過濾

交叉本身有一個結構性的缺點：它一定是**落後**的。快線要穿過慢線，價格得先漲一段。所以交叉發生時，這一波已經走掉一部分了。

`~overheated` 擋的就是那些「交叉時已經漲太多」的訊號。它是過濾條件而不是進場條件，所以只否決進場，不會讓手上的部位離場——一個進場時 RSI 是 55、後來漲到 85 的部位，照原本的出場規則走。

要注意 `~` 對缺值的行為（昨天講過）：`rsi_14 > 70` 在暖機期是 False，取反變 True，所以這個過濾條件在資料不夠時全部放行。它只是過濾，所以還可以接受；而引擎會把暖機期那幾根壓成不持有，那是最後一道防線。

### 四、為什麼位移要出現兩次

`entry` 與 `leave` 各位移一根，代表「第 t 根收盤算出來的訊號，最快在第 t+1 根持有」。

這裡故意寫成兩行，是為了讓後面那個對照更清楚：**在積木版本裡，這兩行不存在。** 位移是引擎的行為，寫在 `_delayed()` 一個地方，所以策略作者根本沒有機會忘記它。

寫死的版本有兩個 `shift(1)`；如果專案裡有三個這樣的策略，就有六個 `shift(1)`，而其中任何一個漏掉都不會報錯，只會讓那個策略的回測結果變好看。

## 拆成積木

同一個邏輯，用昨天的積木寫：

```python
entry = Crossover("ema_12", CrossDirection.UP, "ema_26")
exit_ = Crossover("ema_12", CrossDirection.DOWN, "ema_26")
strategy = Strategy(
    name="trend_ema_rsi",
    entry=entry,
    exit=exit_,
    filters=~Threshold("rsi_14", Comparison.ABOVE, 70.0),
)
```

四行，而且沒有一個 `shift`、沒有一個 `notna`、沒有那個迴圈。三件事被搬走了：

| 寫死的版本自己處理 | 積木版本由誰負責 |
|---|---|
| `ready.shift(1)` 那個暖機期判斷 | `Crossover` 內部重用 Day 04 的 `CrossoverSignals` |
| 兩個 `shift(1)` | 引擎的 `_delayed()` |
| 狀態機的迴圈 | 引擎的 `_resolve_holdings()` |

搬走的都是「每個策略都一樣、但每個策略都可能寫錯」的部分。留下來的是這個策略**獨有**的東西：哪兩條線、哪個方向、哪個閾值。

## 寫成設定檔

最後一步：讓這件事不需要 Python。

```yaml
# quantbot/infrastructure/configuration/strategies/trend_ema_rsi.yaml
name: trend_ema_rsi

# 條件樹引用的每一個欄名都必須出自這裡，或是 K 線本來就有的欄位。
# 對不起來的話 StrategyAssemblyService 會在組裝時就報錯。
features:
  - kind: ema
    period: 12
  - kind: ema
    period: 26
  - kind: rsi
    period: 14

# 快線向上穿過慢線的**那一根**。不是「快線在慢線之上」——後者在一段趨勢裡
# 每一根都成立，會一直重複進場。
entry:
  kind: crossover
  fast: ema_12
  direction: up
  slow: ema_26

exit:
  kind: crossover
  fast: ema_12
  direction: down
  slow: ema_26

# 過濾只否決進場：交叉發生時 RSI 已經超過 70 就不追。
# 注意 not 會讓暖機期的缺值變成「成立」，所以它不能單獨當進場依據——
# 這裡它只是過濾，而引擎會把暖機期那幾根壓成不持有。
filters:
  kind: not
  of:
    - kind: threshold
      feature: rsi_14
      comparison: above
      value: 70
```

格式沿用 Day 15 的兩個決定：參數跟 `kind` 平放在同一層，而 `kind` 是保留字。條件多了一個保留字 `of`，用來放子節點——條件比特徵多的東西就只有這個，因為特徵是一個平的清單，條件是一棵樹。

`features` 那一段值得解釋一下。條件引用的是**特徵的名字**（`ema_12`），而名字是特徵算出來之後才有的，所以設定檔必須同時說「要算哪些特徵」與「條件怎麼用它們」。看起來像是重複宣告，其實不是——它們是兩件事，而且兩者**對不對得起來**是可以檢查的，等一下就用它擋掉一個很安靜的錯誤。

### 為什麼驗證不用 pydantic

專案裡有 `pydantic-settings` 讀環境變數，所以拿 `pydantic` 來驗設定檔看起來很順。這裡沒有這樣做，理由是 Day 15 已經有一套手寫的 YAML 載入器與一套參數驗證（`FeatureParameters`），再引入第二套機制的話，同一類錯誤會有兩種訊息格式與兩個修改點。

驗證因此分成三層，每一層只回答一件事：

| 層 | 誰做 | 回答什麼 | 錯誤訊息長什麼樣 |
|---|---|---|---|
| 格式 | `YamlStrategySpecificationLoader` | 該有的鍵在不在、該是清單的是不是清單 | `entry 少了 kind` |
| 參數 | 各條件的 builder ＋ `FeatureParameters` | 這個值合不合法、有沒有多給不認識的參數 | `comparison 只能是 ['above', 'below', 'at_least', 'at_most']` |
| 對帳 | `StrategyAssemblyService` | 條件引用的欄位這份設定產不產得出來 | `條件引用了沒有宣告的欄位：['ema12']` |

分層的好處是訊息指得出位置。三層混在一個 schema 驗證器裡的話，「拼錯的參數名」與「不合法的列舉值」會長得一樣。

`FeatureParameters` 被條件重用了，而它的名字講的是它的出身。它實際做的事是「處理設定檔的一組弱型別參數」：轉型、預設值、以及 `ensure_used()` 抓拼錯的欄名。條件面對的是同一個問題，所以沿用它比複製一份好——驗證邏輯有兩份的時候，修好其中一份的下場是另一份繼續錯。

### 遞迴，以及為什麼要有深度上限

註冊表把設定樹建成條件樹，作法是遞迴：

```python
# quantbot/domain/strategies/condition_registry.py
    def _build(self, specification: ConditionSpecification, *, depth: int) -> Condition:
        if depth > self.MAXIMUM_DEPTH:
            raise ValueError(
                f"條件樹太深（超過 {self.MAXIMUM_DEPTH} 層）：{specification.kind}"
            )
        if specification.kind not in self.BUILDERS:
            raise ValueError(
                f"未知的條件 {specification.kind!r}（可用：{list(self.kinds())}）"
            )

        children = tuple(
            self._build(child, depth=depth + 1) for child in specification.children
        )
        parameters = specification.to_parameters()
        try:
            condition = self.BUILDERS[specification.kind].build(parameters, children)
            parameters.ensure_used()
        except ValueError as error:
            raise ValueError(f"{specification.describe()}：{error}") from error
        return condition
```

遞迴放在註冊表而不是每個 builder 裡，因為「子節點怎麼來」是註冊表的知識，builder 只該處理自己這一層。

深度上限看起來多餘——手寫的 YAML 不會巢到十二層。但 Day 21 的組合搜尋會**用程式產生設定檔**，而程式產生的東西什麼形狀都有。到那時候 Python 的 `RecursionError` 會是唯一的線索，而那個訊息說不出是哪一份設定有問題。

## 一個安靜到不會報錯的設定檔錯誤

把 `ema_12` 寫成 `ema12`，會發生什麼事？

沒有語法錯誤：`ema12` 是一個合法的字串。沒有執行期錯誤：條件會去表裡找 `ema12` 這一欄……

好，其實昨天的 `Condition.evaluate()` 會丟 `KeyError`，因為那一欄不在表裡。但要等到**算完所有特徵、讀完幾萬列資料之後**才丟，而如果那個拼錯出現在一份跑一百個組合的搜尋設定裡，跑到第七十個才炸掉的體驗很差。

更糟的版本是這樣：如果那份設定同時宣告了一個叫 `ema12` 的特徵（比方說使用者兩邊都拼錯），條件就找得到欄位，一切正常跑完，而算出來的東西不是原意。

所以組裝時就對帳：

```python
# quantbot/domain/services/strategy_assembly_service.py
    def available_columns(self, specification: StrategySpecification) -> frozenset[str]:
        """這份設定跑起來之後，特徵表會有哪些欄名。

        兩個來源：宣告的特徵各自的 name，加上 K 線本來的欄位。後者不是特徵——
        它是原料，而條件要拿收盤價跟 VWAP 比大小，所以它必須在表裡。
        """
        built = self._features.build_all(specification.features)
        return frozenset(feature.name for feature in built) | frozenset(
            CandleColumns.all_columns()
        )

    def _ensure_features_declared(
        self, specification: StrategySpecification, strategy: Strategy
    ) -> None:
        available = self.available_columns(specification)
        missing = sorted(strategy.required_features - available)
        if missing:
            raise ValueError(
                f"策略 {specification.name} 的條件引用了沒有宣告的欄位：{missing}"
                f"（這份設定會產出：{sorted(available)}）"
            )
```

這裡有兩件事值得指出。

**它不需要資料。** `build_all()` 只是把特徵物件建出來問它們的 `name`，沒有讀任何 K 線。所以這個檢查在讀資料之前就跑完了——`signals_command` 的第一件事就是組裝，設定檔有錯的話，程式在連資料庫之前就結束。

**它是 domain service，因為它跨兩個註冊表。** 要知道特徵會產出什麼名字（`FeatureRegistry`），也要知道條件要讀什麼名字（`ConditionRegistry`），而這兩邊都不該認識對方。這是 Day 16 那句「`required_features` 是整個第三階段最重要的一個屬性」的兌現：條件自己說得出它要什麼，這個檢查才寫得出來。

## 三種寫法，逐根相同

現在有三個版本的同一個策略。它們必須產生完全一樣的部位序列，而這件事有測試釘住：

```python
# tests/domain/strategies/test_three_ways_agree.py
def test_plain_python_and_blocks_agree_bar_by_bar():
    table = make_table()
    engine = StrategyEngine()

    reference = ReferenceTrendFollowing().positions(table)
    blocks = engine.positions(blocks_strategy(), table)

    assert reference.tolist() == blocks.tolist()
    # 這段資料真的有交易，不是兩邊都全空手所以「相同」
    assert blocks.sum() > 0
```

最後那個斷言是這種等價測試最容易漏掉的一條。兩個都不做任何交易的實作也會「完全相同」，所以要順便確認這段資料上真的有部位。同一份測試裡還有一個相對的檢查：過濾條件在這段資料上必須真的擋掉至少一次進場，否則「YAML 讀進來了」這件事也證明不了——一個被忽略的 `filters` 區塊會產生一樣的結果。

測試用的是合成資料（`make_table()` 用固定 seed 產生的走勢），所以不依賴資料庫。而合成資料的參數是挑過的：那段走勢有 21 次向上交叉，其中 2 次剛好發生在 RSI 已經超過 70 的時候。

真實資料上也對過一次，用的是 BTC/USDT 現貨 1 小時 K 線（2025-01 至 2026-08，來自 Day 07 的 TimescaleDB）：

```
列數 13823
純 Python vs 積木  相同： True
積木 vs YAML      相同： True
三者不一致的根數： 0
持有根數 6693 6693 6693
```

13,823 根、三種寫法、0 個不一致。

## 實測：一份設定檔跑出來的樣子

```bash
uv run python -m quantbot.entrypoints.signals_command \
    --strategy trend_ema_rsi --timeframe 1h \
    --start 2025-01-01 --end 2026-08-01
```

```
設定檔 trend_ema_rsi.yaml 載入成功

策略 trend_ema_rsi（long）
  進場  ema_12 ↑ cross ema_26
  出場  ema_12 ↓ cross ema_26
  過濾  NOT rsi_14 > 70
  持有  無時間限制
  需要特徵  ['ema_12', 'ema_26', 'rsi_14']

  K 線 13,823 根
  進場訊號    240 根
  出場訊號    241 根
  被過濾否決    8 根
  實際交易    232 筆
  持有 6,693 根（曝險 48.42%）
```

第一行印的是**讀進來之後重新組出來的策略全文**，不是設定檔的內容。這個習慣值得養：它證明載入器理解的跟寫下的是同一件事，而 `需要特徵` 那一行是推導出來的，所以它也順便確認了條件真的接上了那三欄。

三個數字之間的關係是這份報告的重點：

- **240 個進場訊號 → 8 個被否決 → 232 筆交易。** 三個數字都要印出來，因為只看最後一個的話，「過濾條件擋掉 8 次」與「過濾條件根本沒被讀進來」看起來一模一樣。
- **240 個進場訊號但只有 232 筆交易**，而被否決的剛好是 8 個。這裡的相等是巧合而不是必然：被否決的訊號如果發生在已經持有部位的時候，本來就不會產生新交易，所以兩個數字沒有一定要對得上。
- **曝險 48.42%。** 這個策略有一半的時間在場外，而 BuyAndHold 是 99.99%。這件事會在明天之後一路影響所有比較：曝險不同的兩個策略，總報酬率不能直接比。

## 今日交付物

```
quantbot/
├── domain/
│   ├── values/
│   │   ├── condition_specification.py     今天：設定樹的一個節點
│   │   ├── strategy_specification.py      今天：一份策略設定
│   │   └── strategy_signals.py            今天：三棵樹的原始判斷 ＋ 部位
│   ├── interfaces/condition_builder.py    今天（Protocol）
│   ├── strategies/condition_registry.py   今天：字串 → 條件，遞迴 ＋ 深度上限
│   └── services/strategy_assembly_service.py  今天：組裝 ＋ 特徵對帳
├── application/generate_signals_application.py  今天
├── infrastructure/configuration/
│   ├── yaml_strategy_specification_loader.py   今天
│   └── strategies/trend_ema_rsi.yaml           今天：第一份策略設定
├── entrypoints/signals_command.py              今天
└── tests/
    ├── reference/reference_trend_following.py            今天：純 Python 對照組
    ├── domain/strategies/test_three_ways_agree.py        今天：三種寫法等價
    ├── domain/strategies/test_condition_registry.py      今天
    ├── domain/services/test_strategy_assembly_service.py 今天
    └── infrastructure/configuration/test_yaml_strategy_specification_loader.py  今天
```

### 先把資料補到最新

```bash
docker compose -f docker/docker-compose.yml up -d
uv sync
uv run python -m quantbot.entrypoints.ingest_pipeline_command
```

上面那份訊號報告用的是 2025-01 到 2026-08 這段。要跑到今天為止就把 `--end` 改成今天的日期，但記得先讓管線補完——缺一段 K 線不會讓程式報錯，只會讓 EMA 在那個位置算錯，而那不會有任何訊息。

### 驗收標準

七項全過才算完成：

1. `uv run pytest` 全綠。
2. **三種寫法逐根相同**，而且那個測試裡有「這段資料真的有交易」與「過濾條件真的擋掉東西」兩個相對檢查。少了它們，兩個都不動作的實作也會通過。
3. 內附的 `trend_ema_rsi.yaml` 有測試載得起來。跑不起來的文件比沒有文件糟。
4. 把設定檔裡的 `ema_12` 改成 `ema12`，**在連資料庫之前**就要失敗，訊息指名那個欄名並列出這份設定實際會產出什麼。
5. 把 `comparison: above` 改成 `abvoe`，錯誤訊息要列出四個合法值。
6. 在 `threshold` 節點上加一個 `of:`，要被當成格式錯誤擋下來——葉條件不能有子節點。
7. `uv run mypy quantbot` 與 `uv run lint-imports` 全過。特別確認 `domain/` 沒有 import 到 `yaml`：YAML 的格式知識屬於 infrastructure，domain 只認得 `StrategySpecification`。

第 4 項是今天最值得留著的一條。它擋的錯誤不會讓程式壞掉，只會讓結果安靜地變成另一件事。

> 免責聲明：本文為程式與資料工程的技術分享，所有數字皆為歷史資料上的觀察與教學範例，不構成投資建議。

## 明天

現在新增一個策略的成本是一份 YAML。但這句話還沒被驗證過——只有一個策略的時候，任何抽象看起來都夠用。

明天用兩個哲學截然相反的策略來檢驗它：**均值回歸**（價格顯著偏離 VWAP 就反向進場）與**動能爆發**（活躍度爆量、而且不是假突破才進場）。重點不在這兩個策略本身，在於同一組積木能不能表達完全不同的交易哲學。如果不能，就表示 Day 16 的抽象切錯了，要回頭改。

而它們會逼出兩個新積木，昨天已經先把契約留好了：**最大持有時間**（等不到回歸就認錯出場）與**冷卻期**（避免同一波行情重複進場）。判斷抽象有沒有做對的方式很具體——這兩條規則應該進積木庫，還是寫死在那兩個策略裡？

## Reference

- [`ewm` 的 `adjust` 參數決定前幾十根的數字，交易上該用哪一個 — pandas documentation, `Series.ewm`](https://pandas.pydata.org/docs/reference/api/pandas.Series.ewm.html)
- [`yaml.safe_load` 不會建構任意 Python 物件，讀外部設定一律用它 — PyYAML documentation](https://pyyaml.org/wiki/PyYAMLDocumentation)
- [`dataclasses.field` 的 `default_factory`，用來避免可變的類別層級預設值 — Python documentation, `dataclasses`](https://docs.python.org/3/library/dataclasses.html#dataclasses.field)
- [遞迴深度上限與 `RecursionError` 的來源 — Python documentation, `sys.setrecursionlimit`](https://docs.python.org/3/library/sys.html#sys.setrecursionlimit)
