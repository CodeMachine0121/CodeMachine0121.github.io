---
title: "Day 16：每寫一個策略就複製貼上一份程式？把策略拆成可以互相組合的積木"
datetime: "2026-09-30"
description: "策略如果是一個 class，三個策略就有三份重複的算特徵與判斷邏輯，而且想交換其中一段時完全沒有縫可以下手。這篇把策略拆成兩層抽象——條件與組合方式——用一個 ABC ＋ 三個運算子把它們接起來，並把訊號位移收進引擎，讓未來函數不再是每個策略自己要記得的事。實測 13,823 根 1 小時 K 線：交叉 240 次，而「站在上面」有 7,001 根。"
image: ""
parent: "2026 ithome-鐵人賽: 工程師的量化交易入門：從 K 線到可組合的交易策略引擎 系列"
draft: false
---

## 昨天那張表還沒有任何用途

第二階段結束時手上有一條管線：一份 YAML 進去，一張特徵表出來。十三欄數字，每一欄都驗證過、都知道它在講什麼。

但它還不能做任何決定。今天要處理的就是這件事，而處理方式決定了後面十四天的形狀，所以值得先把問題看清楚再動手。

最直覺的做法是這樣：

```python
class TrendFollowingStrategy:
    def signals(self, candles):
        features = compute_features(candles)
        entry = crossover(features["ema_12"], features["ema_26"])
        entry = entry & (features["rsi_14"] < 70)
        exit = crossover_down(features["ema_12"], features["ema_26"])
        return build_positions(entry.shift(1), exit.shift(1))
```

一個策略一個類別，看起來很正常。問題在第二個策略出現的時候。

均值回歸策略也要算特徵、也要判斷條件、也要把訊號變成部位、也要記得那個 `shift(1)`。於是這四件事在專案裡有了第二份。寫到第三個策略時是第三份，而其中一份忘了 `shift(1)` 這件事不會有任何錯誤訊息——它只會讓那個策略的回測結果特別好看。

還有一個更難處理的問題。假設想試「趨勢策略的進場條件，配均值回歸策略的出場條件」，在上面那個寫法裡完全沒辦法：那段邏輯埋在 `signals()` 的中段，既沒有名字也沒有邊界，唯一的取出方式是複製貼上。

所以這個系列的策略不是類別，是**一組可以互相組合的積木**。

## 交易概念補課：訊號、三種角色、部位

今天有幾個新詞，先各給一句話。

**訊號（signal）**是「現在該做什麼」的一個布林判斷。它不是預測，也不含金額，就是成立或不成立。

**部位（position）**是手上實際持有多少。這個系列把它表達成一個權重：+1 是滿倉做多，0 是空手，-1 是滿倉做空。現貨借不到幣所以做不了空，-1 在主線上不會出現，但引擎對它一視同仁，走到合約時不必改引擎。

**「一次該下多少錢」不在今天的範圍。** 那是部位大小的問題，Day 24 會做成另一組積木。把方向與大小分開的理由很實際：同一個訊號配不同的下單金額會得到完全不同的權益曲線，而如果兩件事混在一份程式碼裡，就沒辦法公平比較「同一個訊號配不同 sizing」。

然後是今天最重要的一組區別。條件有三種角色，而它們**不能互換**：

| 角色         | 它說什麼      | 它 NEVER 做什麼      |
|------------|-----------|------------------|
| 進場（entry）  | 可以開一個新部位了 | 不管手上已經有的部位       |
| 出場（exit）   | 手上的部位該離場了 | 不會讓我們進場          |
| 過濾（filter） | 別進        | 不會讓我們進場，也不會讓我們出場 |

過濾條件最容易被誤解，所以多講一句。「只在活躍時段交易」如果寫成進場條件的一部分，那麼一個在活躍時段進場、抱到冷清時段的部位，會因為「活躍度掉下來了」而被算成不該持有——但那不是原意。原意是不要在冷清時段開新倉，手上的倉照原本的出場規則走。

**過濾管的是新部位，不是手上的部位。手上的部位只有出場條件管得到。**

## 兩層抽象：條件，以及組合條件的方式

把上面那個類別拆開，會發現裡面只有兩種東西。

第一種是「一個判斷」：`ema_12` 剛剛穿過 `ema_26`、`rsi_14` 低於 70、突破發生了。它們的形狀完全一樣——吃一張特徵表，回一條與表同 index 的布林序列。

第二種是「把判斷接起來的方式」：而且成立、或是成立、不成立。

窄契約是這裡的關鍵。因為每個條件都回同一種形狀，所以兩個條件才接得起來；而接完的結果**還是同一種形狀**，所以可以繼續接下去。這就是能自由組合的全部原因，不是什麼設計技巧。

```python
# quantbot/domain/strategies/condition.py
class Condition(ABC):
    """一個條件：吃一張特徵表，回一條與它同 index 的布林序列。

    這是第三階段的基本單位。契約只有一條線那麼窄——一張表進去、一條布林序列
    出來——而那個窄契約正是條件能互相組合的前提：兩個回傳同一種形狀的東西，
    才有辦法用 and / or / not 接起來，接完的結果又還是同一種形狀。

    它用 ABC 而不是 Protocol，理由跟 Day 04 的 Indicator 一樣：這個家族有共用
    實作要給子類別。而且這裡的共用實作比 Indicator 更多——除了 evaluate() 擔保的
    三件事（欄位檢查、布林化、貼名字）之外，三個運算子與 describe() 也是所有
    子類別共用的。對外相依才用 Protocol，那是 Day 10 的 Feature。

    子類別只需要實作四件事：name、required_features、warmup_bar_count、_evaluate。
    """

    @property
    @abstractmethod
    def required_features(self) -> frozenset[str]:
        """這個條件要讀特徵表的哪幾欄。

        它是整個第三階段最重要的一個屬性。使用者在設定檔裡寫的是條件，而條件
        需要哪些特徵是**推導得出來的**，NEVER 要使用者自己再宣告一次——宣告兩次
        就會有兩份真相，而漏掉一個的下場是整欄 NaN 配上一個永遠不成立的條件。
        """

    def evaluate(self, table: pd.DataFrame) -> pd.Series:
        """對外的入口。契約的三件事在這裡一次擔保。

        欄位檢查放在這裡而不是各子類別，是因為錯誤訊息要一致：缺欄位時要說清楚
        缺哪一欄、有哪些可用，否則使用者拼錯一個特徵名之後看到的會是 KeyError
        加一個裸欄名，得自己回頭去對設定檔。
        """
        available = frozenset(str(column) for column in table.columns)
        missing = sorted(self.required_features - available)
        if missing:
            raise KeyError(
                f"{self.name} 需要的欄位不在表裡：{missing}"
                f"（表裡有：{sorted(available)}）"
            )
        return self._evaluate(table).astype(bool).rename(self.name)

    def __and__(self, other: Condition) -> Condition:
        """兩個都成立。組合的結果還是一個 Condition，所以可以繼續組合。"""
        return AllOf(self, other)

    def __or__(self, other: Condition) -> Condition:
        return AnyOf(self, other)

    def __invert__(self) -> Condition:
        return Not(self)
```

上面是節錄，`name`、`warmup_bar_count`、`_evaluate` 三個抽象成員與 `describe()` 省略了。

這裡的 ABC 是本專案第二個 ABC 家族，第一個是 Day 04 的 `Indicator`。判準跟當時一樣：**有共用實作要給子類別就用 ABC，對外相依才用 Protocol。** 而這一家的共用實作比指標那家更多——欄位檢查、布林化、貼名字、三個運算子、`describe()`，全部只寫一份。

`required_features` 那一段值得停一下。它讓「這個策略需要哪些特徵」變成推導得出來的東西：

```python
strategy.required_features
# frozenset({'ema_12', 'ema_26', 'rsi_14'})
```

使用者寫的是條件，特徵清單是算出來的。如果反過來要求使用者自己宣告一次，就會有兩份真相，而漏掉其中一個的後果是安靜的：那一欄沒被算出來，用到它的條件永遠不成立，而策略只是「沒有訊號」——不會有任何錯誤訊息。

## 六種基礎條件

目前的積木庫有六種葉條件。每一種存在都要有理由，不是為了展示彈性。

| 條件                  | 它問什麼         | 存在的理由                       |
|---------------------|--------------|-----------------------------|
| `Threshold`         | 一欄跟一個常數比大小   | 最常用的過濾形式（RSI 低於 70）         |
| `FeatureComparison` | 兩欄互相比大小      | 跟常數比要知道價位，跟另一欄比不用，換交易對不必重調  |
| `Crossover`         | 兩條線在這一根交叉    | 交叉是事件，跟「站在上面」是兩件事           |
| `Range`             | 一欄落在區間內      | 等於兩個 Threshold，但上下界寫反時會直接報錯 |
| `Event`             | 事件型特徵在這一根發生了 | Day 13 的突破是 0 與 1，不該用閾值假裝   |
| `Always` / `Never`  | 恆真、恆假        | 過濾條件的預設值，以及 BuyAndHold 的兩棵樹 |

清單裡刻意**沒有**排名條件（「在所有交易對裡漲幅前三名」）。那個條件需要橫跨多個交易對的資料，而本系列的回測是單一交易對，所以它現在沒有用途。多交易對是 Day 30 演化路徑的方向，等真的要做時再加——**會被第二個策略用到才抽象化，不是先蓋好再找用途。**

六種裡面最容易寫錯的是交叉，所以它直接重用 Day 04 已經驗證過的東西：

```python
# quantbot/domain/strategies/crossover_condition.py
class Crossover(Condition):
    """兩條線交叉的那一根。

    它直接重用 Day 04 的 CrossoverSignals，而不是在這裡重寫一次狀態翻轉的判斷。
    那個類別當初就把三件事處理掉了：只有翻轉的那一根為 True、暖機期一律 False、
    以及「前一根也必須是有效值」——少了最後那一條，暖機期結束的第一根會被算成
    一次交叉，因為它的前一根是 NaN 而 NaN 比什麼都不是。

    這裡只取 golden 與 death，NEVER 取那個類別的 entry 與 exit。後兩者已經位移過
    一根，而位移是引擎的職責（見 StrategyEngine）。條件回報的一律是「第 t 根
    的事實」，位移只做一次，做在唯一的地方。
    """

    def _evaluate(self, table: pd.DataFrame) -> pd.Series:
        signals = CrossoverSignals(table[self._fast], table[self._slow])
        return signals.golden if self._direction is CrossDirection.UP else signals.death
```

最後那段註解是今天的一個設計決定，等一下講引擎時會回到它。

### 交叉與「站在上面」差多少

「快線在慢線之上」跟「快線剛剛穿過慢線」是新手最常混淆的一組，而混淆的代價可以直接量。同一段 BTC/USDT 現貨 1 小時 K 線（2025-01 至 2026-08，13,823 根）：

| 條件 | 成立幾根 |
|---|---|
| `ema_12` 向上穿過 `ema_26` | 240 |
| `ema_12` 站在 `ema_26` 之上 | 7,001 |

差 29 倍。把後者當進場條件，趨勢裡的每一根都會觸發一次進場——如果引擎沒有處理重複進場，回測就會產生一條漂亮到不合理的權益曲線。

## 三個運算子

有了窄契約，組合就是三個 dunder method 的事：

```python
entry = Crossover("ema_12", CrossDirection.UP, "ema_26") & ~Threshold(
    "rsi_14", Comparison.ABOVE, 70.0
)
entry.describe()
# '(ema_12 ↑ cross ema_26 AND NOT rsi_14 > 70)'
```

`&` 建出來的是 `AllOf`，而同一個運算子會**攤平**：`(a & b) & c` 與 `a & (b & c)` 都變成一個三元的 `AllOf`。這不是省效能，是為了讓同一個邏輯只有一種印法——不然兩份寫法不同、括號不同的設定檔會產生兩份長得不一樣的日誌，而使用者無法解釋為什麼。

### 取反的那個陷阱

`~` 有一個很安靜的行為值得記住：**原本因為缺值而不成立的地方，取反之後會變成成立。**

`rsi_14 > 70` 在暖機期是 NaN 比 70，pandas 回 False。取反就變 True，於是「RSI 沒有超買」這個過濾條件在資料還不夠的時候**全部放行**。

這件事在 `Not` 的 docstring 裡寫著，而引擎會幫上一半——它會把暖機期那幾根一律壓成不持有。但那只是最後一道防線，寫條件時還是要知道 NaN 取反會變成什麼。

## 一個策略就是三棵樹加兩條規則

```python
# quantbot/domain/strategies/strategy.py
@dataclass(frozen=True)
class Strategy:
    """一個策略：三組條件加上兩條時間規則，沒有別的。

    三組條件的角色**不能互換**，這是今天最重要的一個界線：

    - entry 說「可以進場了」。
    - exit 說「該離場了」。
    - filters 說「別進」——它只否決進場，NEVER 促成進場，也 NEVER 促成出場。

    把過濾條件跟進場條件混成一組會壞在什麼地方：「只在活躍時段交易」寫成進場條件
    的一部分，那麼一個在活躍時段進場、在冷清時段還抱著的部位，會因為「活躍度掉了」
    而被算成不該持有。過濾管的是新部位，不是手上的部位。exit 才管手上的部位。

    為什麼策略是一份資料而不是一個 class：一個策略如果是一個類別，三個策略就有
    三份重複的「算特徵、判斷條件、決定部位」邏輯，而且想試「這個策略的進場條件
    配那個策略的出場條件」時完全沒辦法——那要求兩個類別內部的一段邏輯可以拆出來
    交換，而類別沒有留下那個縫。條件樹有。
    """

    name: str
    entry: Condition
    exit: Condition
    filters: Condition = field(default_factory=Always)
    holding: HoldingRules = field(default_factory=HoldingRules.unbounded)
    direction: PositionDirection = PositionDirection.LONG

    @classmethod
    def buy_and_hold(cls, name: str = "buy_and_hold") -> Strategy:
        """基準策略：第一根就進場，然後什麼都不做。

        它值得是每一份報告的第一列。任何組合出來的策略如果贏不過它，那些條件
        就只是在製造手續費——而這件事在只看「總報酬率 +38%」的時候看不出來。
        """
        return cls(name=name, entry=Always(), exit=Never())
```

`buy_and_hold()` 那個 classmethod 是這套抽象的一次檢驗。基準策略在引擎裡**沒有任何特例**——它就是一個進場恆真、出場恆假的普通策略。如果連「什麼都不做，抱著就好」都得在引擎裡開一個 if，那就表示條件這一層切得太窄了。

## 引擎：把位移收進來，只寫一次

引擎只有一個對外方法，而它擔保三件事。

```python
# quantbot/domain/strategies/strategy_engine.py
    def positions(self, strategy: Strategy, table: pd.DataFrame) -> pd.Series:
        """回傳每一根的部位權重，index 與輸入的表完全相同。

        1.0 代表這一根**整根都持有**（在前一根收盤時成交），0.0 代表空手。
        回測因此可以直接把它乘上「這一根的報酬」，兩邊的時間語意是對齊的。
        """
        entries = self._delayed(
            strategy.entry.evaluate(table) & strategy.filters.evaluate(table)
        )
        exits = self._delayed(strategy.exit.evaluate(table))
        blocked_until = strategy.warmup_bar_count + self._signal_delay_bars

        held = self._resolve_holdings(
            entries.to_numpy(dtype=bool),
            exits.to_numpy(dtype=bool),
            strategy.holding,
            first_allowed_bar=blocked_until,
        )
        return pd.Series(
            held * strategy.direction.weight,
            index=table.index,
            dtype="float64",
            name=f"position_{strategy.name}",
        )

    def _delayed(self, signal: pd.Series) -> pd.Series:
        """位移只發生在這裡，整個專案沒有第二個地方會做這件事。"""
        if self._signal_delay_bars == 0:
            return signal
        return signal.shift(self._signal_delay_bars, fill_value=False)
```

第一行就是過濾條件的實作：`entry & filters`。過濾**只跟進場相乘**，出場那行完全不看它——這一行程式碼就是前面那張角色表的全部。

### 為什麼位移要放在引擎裡

Day 04 第一次講未來函數時，處理方式是「記得 `shift(1)`」。Day 04 的 `CrossoverSignals` 甚至把位移過的版本做成 `entry` 與 `exit` 兩個屬性，就是為了讓人不容易忘。

那個做法在只有一個策略時可行。積木化之後不行了，因為策略的數量會從三個變成幾百個（Day 21 會真的跑幾百個），而**靠每個策略自己記得一件事，就等於保證有一部分策略會漏掉它**。漏掉的那些不會壞掉、不會報錯，只會得到比較好的回測結果，然後被挑出來上線。

所以位移變成引擎的行為，寫在 `_delayed()` 一個地方。條件從此只回報「第 t 根的事實」，這也是為什麼 `Crossover` 用 `CrossoverSignals.golden` 而不是那個類別已經位移過的 `entry`——同一件事做兩次，就會延後兩根。

`signal_delay_bars` 是建構參數而不是寫死的 1，唯一的理由是 Day 19 要用 0 來示範未來函數會讓報酬離譜到什麼程度。實際用途一律是 1。

### 部位序列的時間語意

`positions()` 回傳的 1.0 代表「這一根整根都持有」，成交發生在**前一根的收盤**。所以回測可以直接算：

```
這一根的策略報酬 = position[t] × (close[t] / close[t-1] − 1)
```

兩邊講的是同一段時間，不必再對齊一次。這個定義要在今天釘死，因為 Day 19 到 Day 22 所有數字都建在它上面，而它錯一格的後果就是全部的績效數字都不能用。

## 唯一的迴圈，以及它為什麼合法

這個系列從 Day 04 就有一條規矩：NEVER 用 for loop 遍歷 K 線。而狀態機這裡有一個迴圈，所以要說清楚。

```python
# quantbot/domain/strategies/strategy_engine.py
    @staticmethod
    def _resolve_holdings(
        entries: np.ndarray,
        exits: np.ndarray,
        holding: HoldingRules,
        *,
        first_allowed_bar: int,
    ) -> np.ndarray:
        """把進出場訊號解成「哪幾根在持有」。

        這是全系列唯一一個帶迴圈的計算路徑，所以要說清楚為什麼：**這裡的狀態
        依賴自己的輸出。** 「這根能不能進場」取決於手上有沒有部位，而那取決於
        前面哪一根進場、又在哪一根出場——一個純粹的欄位運算算不出依賴自身結果的
        東西。加上最大持有根數與冷卻期之後更是如此。

        但迴圈的長度不是 K 線數，是**交易筆數**。searchsorted 每次直接跳到下一個
        合法的進場位置，所以 13,848 根 K 線上跑一個交易幾十次的策略，這個迴圈就
        轉幾十次。Day 04 那條「NEVER 用 for loop 遍歷 K 線」的規矩沒有被打破。

        同一根同時出現進場與出場訊號時，**進場勝出，出場最快在下一根**。這個決定
        讓每一筆交易至少持有一根，也讓這個迴圈一定會前進。
        """
        held = np.zeros(entries.size, dtype=bool)
        if entries.size == 0:
            return held

        entry_bars = np.flatnonzero(entries)
        exit_bars = np.flatnonzero(exits)
        cooldown = holding.cooldown_bars or 0
        cursor = first_allowed_bar

        while True:
            candidate = int(np.searchsorted(entry_bars, cursor, side="left"))
            if candidate >= entry_bars.size:
                return held

            opened_at = int(entry_bars[candidate])
            closed_at = StrategyEngine._closing_bar(
                exit_bars, opened_at, holding.maximum_holding_bars, entries.size
            )
            held[opened_at:closed_at] = True
            cursor = closed_at + cooldown
```

重點在 `searchsorted`：它不是一根一根往前走，是直接跳到下一個合法的進場位置。所以迴圈次數等於交易筆數——上面那個趨勢組合在 13,823 根上跑了 240 筆，迴圈就轉 240 次，而不是 13,823 次。

還有一個容易漏掉的細節在 `_closing_bar()` 裡：結束持有的那一根取三個候選的最小值——出場條件成立的第一根、抱滿最大根數的那一根、以及**資料的盡頭**。最後一個代表回測結束時還開著的部位。它一定要被算進去，否則最後一筆交易會憑空消失，而那一筆常常是最大的一筆。

## 為什麼「最多抱 48 根」不是一個條件

引擎的第三個擔保是兩條時間規則，而它們刻意不是條件：

```python
# quantbot/domain/values/holding_rules.py
@dataclass(frozen=True)
class HoldingRules:
    """出場與再進場的兩條時間規則。

    為什麼它們不是條件：條件吃的是特徵表，而特徵表裡沒有「這個部位已經抱了幾根」
    這一欄，也不可能有——那個數字取決於哪一根進場，而那是引擎解出來的結果。
    一個吃特徵表的函式算不出依賴自身輸出的東西，所以這兩條規則只能是引擎的行為。

    界線就畫在這裡：**條件負責看市場，這個值負責看部位。** 兩者混在一起的話，
    條件的契約（吃一張表、回一條布林序列）就守不住了。

    - maximum_holding_bars：抱超過這麼多根還沒等到出場條件就認錯離場。
    - cooldown_bars：出場之後這麼多根之內不准再進場。

    None 代表沒有這條限制。兩個都是 None 就是 unbounded()，也是 Day 16 的預設——
    今天的策略只靠條件出場，Day 18 的兩個策略才會把它們填起來。
    """

    maximum_holding_bars: int | None = None
    cooldown_bars: int | None = None
```

這是今天唯一一個「先訂契約、明天才用」的決定，跟 Day 10 把 `Feature` 的介面在第一個特徵那天就訂死是同一個判斷：引擎的解算契約在引擎誕生的那天定案，中途改的成本是所有策略、所有測試、所有結果一起重跑。今天兩個欄位都是 `None`（也就是 `unbounded()`），Day 18 的兩個策略會把它們填起來。

## 實測：同一組積木，三種組合

把三個特徵算出來，跟 K 線的欄位併成一張表，然後手動組三個策略。資料是 BTC/USDT **現貨** 1 小時 K 線，來自 Day 07 建的 TimescaleDB（原始來源是 `data.binance.vision` 批次檔，Day 03 抓下來的）。

```python
table = pd.concat([candles, features], axis=1)   # 12 欄 × 13,823 列
```

K 線的欄位直接放進同一張表，所以條件可以用 `close` 這個名字。價格不是特徵——它是原料，沒必要為它發明一個假特徵。

| 策略 | 持有根數 | 曝險比例 | 交易筆數 |
|---|---|---|---|
| 交叉進出，無過濾 | 6,919 | 50.05% | 240 |
| 交叉進出 ＋ RSI 過濾 | 6,693 | 48.42% | 232 |
| BuyAndHold | 13,822 | 99.99% | 1 |

三個觀察。

**過濾條件擋掉 8 筆交易**（240 → 232），而它擋掉的是「交叉發生時 RSI 已經超過 70」的那幾次，也就是追高的那幾次。這個數字對不對，Day 19 有回測才知道；今天只確認過濾條件真的在動，而且動的方向是對的。

**BuyAndHold 只有 1 筆交易、曝險 99.99%。** 少掉的那一根是第一根——訊號位移之後，最快也只能從第二根開始持有。一個回測工具如果讓 BuyAndHold 從第一根就滿倉，那它某個地方沒有位移。

**同一根同時觸發進場與出場的次數是 0。** 這一段資料剛好沒有踩到那個邊界，但引擎的處理方式已經釘在測試裡：進場勝出，出場最快下一根。

## 陷阱與驗證

今天的產出會被後面每一天引用，所以驗收要嚴一點。四件事寫進測試：

**一、交叉只在翻轉那一根成立。** 測試給一段「上、上、下、下、下」的資料，斷言只有第三根為 True，而「站在上面」的第四根不算。前面量到的 240 對 7,001 就是這件事的代價。

**二、暖機期結束的第一根不算交叉。** 前一根是 NaN 時不成立。少了這條，每一個交叉條件都會在暖機期結束時送出一次假訊號。

**三、取反會讓缺值變成成立。** 這條專門寫了一個測試釘住，因為它是設計的一部分而不是缺陷——知道它存在，才有辦法在寫條件時處理。

**四、位移的方向與根數。** 第 1 根給訊號 → 第 2 根才持有；第 3 根給出場 → 第 4 根空手。這個測試看起來很無聊，但它守的是全系列所有績效數字的正確性。

## 今日交付物

```
quantbot/
├── domain/
│   ├── strategies/                        今天：第八個 domain 資料夾
│   │   ├── condition.py                   Condition（ABC）＋ AllOf／AnyOf／Not
│   │   ├── threshold_condition.py         一欄對常數
│   │   ├── feature_comparison_condition.py 兩欄相比
│   │   ├── crossover_condition.py         重用 Day 04 的 CrossoverSignals
│   │   ├── range_condition.py             區間
│   │   ├── event_condition.py             事件型特徵
│   │   ├── constant_condition.py          Always／Never
│   │   ├── strategy.py                    三棵樹 ＋ 兩條規則 ＋ BuyAndHold
│   │   └── strategy_engine.py             位移、暖機、狀態機
│   └── values/
│       ├── comparison.py                  四種比較
│       ├── cross_direction.py             UP／DOWN
│       ├── holding_rules.py               最大持有與冷卻期
│       └── position_direction.py          LONG／FLAT／SHORT 與權重
└── tests/domain/strategies/
    ├── test_condition.py                  運算子、缺值、缺欄位
    ├── test_strategy.py                   推導出的特徵清單與暖機期
    └── test_strategy_engine.py            位移、狀態機、時間規則
```

### 先把資料補到最新

今天的測試不需要資料庫，但要重現上面那張表就需要。開工前先把 K 線補到最新：

```bash
docker compose -f docker/docker-compose.yml up -d      # TimescaleDB
uv sync
uv run python -m quantbot.entrypoints.ingest_pipeline_command
```

管線會自己判斷缺哪一段、該走批次還是 REST（Day 08 的路由邏輯），跑完會印一份資料完整性報告。接著確認特徵算得出來：

```bash
uv run python -m quantbot.entrypoints.features_command \
    --symbol BTC/USDT --market spot --timeframe 1h \
    --start 2025-01-01 --end 2026-08-01
```

明天的訊號指令會吃同一批資料，所以這一步值得先確認過。

### 驗收標準

六項全過才算完成：

1. `uv run pytest tests/domain/strategies` 全綠。
2. `a & b & c` 攤平成一個三元的 `AllOf`，而不是巢狀兩層。同一個邏輯只能有一種印法。
3. **位移的測試要精確到根**：訊號在第 1 根 → 部位從第 2 根開始。差一根就是全部績效數字都錯。
4. `Strategy.buy_and_hold()` 的曝險是「總根數減一」，不是全部。從第一根就滿倉表示位移沒生效。
5. 最大持有根數與冷卻期各有一個測試，而且**冷卻期是從離場那一根起算**。
6. `uv run mypy quantbot` 與 `uv run lint-imports` 全過。特別確認 `domain/strategies/` 沒有 import 任何外部技術——條件與引擎只認得 pandas 與 numpy。

第 3 項與第 4 項是今天真正的重點。它們守的是同一件事：**未來函數已經不是策略作者要記得的事了，它是引擎的行為，而引擎的行為有測試釘著。**

> 免責聲明：本文為程式與資料工程的技術分享，所有數字皆為歷史資料上的觀察與教學範例，不構成投資建議。

## 明天

積木庫有了，但今天的三個策略都是在 Python 裡手動 `&` 出來的。

明天走完整條路徑：先用最直白的 Python 寫出「EMA 快慢線交叉、RSI 過濾掉追高」的判斷，把每個條件在防什麼問題講清楚——**這一步不能跳過**，不然填設定檔的人不會知道自己在填什麼，也就沒有能力判斷組出來的東西合不合理。邏輯確認正確之後，才把它拆成今天的積木，最後寫成 YAML 並加上載入器。

明天也會給引擎一個很硬的測試：同一個策略用三種寫法——純 Python、積木運算子、YAML——產生**逐根完全相同**的訊號序列。如果三者有任何一根不一樣，那就表示載入器或運算子其中一個理解錯了。

## Reference

- [`abc.ABC` 與 `@abstractmethod`：子類別沒實作抽象成員就無法實例化 — Python documentation, `abc`](https://docs.python.org/3/library/abc.html)
- [`__and__`、`__or__`、`__invert__` 是可以覆寫的運算子協定 — Python documentation, Emulating numeric types](https://docs.python.org/3/reference/datamodel.html#emulating-numeric-types)
- [`Series.shift` 的 `fill_value` 決定位移後補進來的值，預設是 NaN 而不是 False — pandas documentation, `Series.shift`](https://pandas.pydata.org/docs/reference/api/pandas.Series.shift.html)
- [比較運算對 NaN 一律回 False，這是「答不出來就不成立」的來源 — pandas documentation, Missing data](https://pandas.pydata.org/docs/user_guide/missing_data.html)
- [`numpy.searchsorted` 在已排序陣列上做二分搜尋，用來跳到下一個合法進場位置 — NumPy documentation, `numpy.searchsorted`](https://numpy.org/doc/stable/reference/generated/numpy.searchsorted.html)
