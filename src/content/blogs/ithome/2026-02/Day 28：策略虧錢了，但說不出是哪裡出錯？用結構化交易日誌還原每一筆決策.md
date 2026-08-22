---
title: "Day 28：策略虧錢了，但說不出是哪裡出錯？用結構化交易日誌還原每一筆決策"
datetime: "2026-10-12"
description: "交易系統的日誌要能回答「三天前那筆單為什麼會下」，而那需要記下當下的完整脈絡，不只是下了什麼單。積木化讓這件事變得可行：條件樹是資料，所以整棵樹連同每個節點的真假值可以一起存下來。實跑的一筆紀錄顯示 RSI 71.46 擋掉了一次黃金交叉，而「哪一個節點在擋」這個問題在取反之下會翻過來——第一版就是這樣印出一個空字串的。"
image: ""
parent: "2026 ithome-鐵人賽: 工程師的量化交易入門：從 K 線到可組合的交易策略引擎 系列"
draft: true
---

## 一份答不出問題的日誌

機器人在雲端跑了幾天，日誌長這樣：

```
回補完成：寫入 24 列
送單成功：BUY 0.0002 BTC/USDT
回補完成：寫入 24 列
```

它看起來很正常，而它答不出一個問題——而那是策略虧錢時唯一想問的問題：**三天前那筆單為什麼會下？**

「下了什麼單」交易所那邊也有一份，比我們的完整。日誌要記的是交易所沒有、而且事後重建不回來的東西：**做那個決定的時候，我們看到了什麼。**

## 交易概念補課：兩種交易日誌

人工交易的交易日誌是一個**紀律工具**。記的是進場理由、當時的情緒、事後回顧覺得哪裡判斷錯了。它的讀者是自己，用途是修正行為。

自動交易的交易日誌是一個**除錯工具**。程式沒有情緒，也不會「這次破例一下」——它會嚴格執行我們寫下的規則。所以要記的不是「當時在想什麼」，是**那一刻程式看到的每一個數字**。

兩者要記的東西幾乎不重疊。而混淆它們的後果是記了一堆「訊號觸發」「風控通過」這種沒有數值的句子，事後看得懂在做什麼、但重建不出為什麼。

## 積木化讓這件事變得可行

Day 16 把策略拆成條件樹的時候，有一句伏筆：

```python
# quantbot/domain/strategies/condition.py
    def describe(self) -> str:
        """條件樹的可讀形式。組合條件會遞迴展開，所以整棵樹印得出來。

        它不只是給人看的：Day 28 的交易日誌要記下「哪幾個節點成立」，而那份
        紀錄必須認得出節點。名字就是識別，所以它從今天開始就要穩定。
        """
```

今天收這筆。差別在於：一個手寫的 `if ema_12 > ema_26 and rsi_14 < 70:` 在事後只留下「進了」或「沒進」，中間哪一半不成立不會有紀錄。而條件樹**是一份資料**，所以它可以連同每個節點的當下真假值一起存下來。

```python
# quantbot/domain/values/condition_trace.py
@dataclass(frozen=True)
class ConditionTrace:
    """一棵條件樹在**某一根**上的真假值。整棵樹，不只是根節點。

    這是宣告式策略換到的東西，而手寫策略做不到：一個 `if ema_12 > ema_26 and
    rsi_14 < 70:` 在事後只留下「進了」或「沒進」，中間哪一半不成立不會有紀錄。
    條件樹是一份資料，所以它可以連同每個節點的當下真假值一起存下來。

    children 為空就是葉節點。組合節點（all／any／not）的 children 是它的子樹，
    所以整棵樹的形狀跟設定檔的形狀一模一樣——讀日誌的人不必在腦中重建結構。
    """
```

取得它的方式是在 `Condition` 這個 ABC 上加一個 template method，而三個組合條件只覆寫「子節點怎麼來」那一半：

```python
# quantbot/domain/strategies/condition.py
    def trace(self, table: pd.DataFrame, position: int) -> ConditionTrace:
        """這一根上，整棵樹每一個節點的真假值。Day 28 的決策日誌用它。

        它是 template method：這裡負責節點自己的部分，子節點由 _traced_children()
        提供，而只有三個組合條件需要覆寫那一個。葉條件什麼都不用做。

        成本要說清楚：它會把這棵樹在**整段資料上**算一遍，只為了取第 position 根的
        值。條件需要前後文（交叉要看前一根、持續要看前 n 根），所以切一行下來算是
        錯的。這代表 trace() 屬於「每根一次」或「事後查」的路徑，NEVER 放進
        Day 21 的組合搜尋迴圈裡——那裡跑的是幾百個策略乘上幾萬根。
        """
```

那段成本說明是必要的。整棵樹在整段資料上重算一遍，在「一根一筆」的正式路徑上完全可以接受（一次幾毫秒），而放進 Day 21 的搜尋迴圈會讓它慢幾百倍。同一個方法在兩條路徑上的合理性完全不同，所以那件事寫在契約裡。

## 「哪一個節點在擋」在取反之下會翻過來

這是今天實跑抓到的缺陷，而它值得完整寫出來，因為它是一個**答案錯了但沒有任何錯誤**的缺陷。

日誌裡最有價值的一種紀錄是「進場條件成立，但被過濾條件否決」。第一次跑起來的輸出是這樣：

```
進場條件
  + ema_12 ↑ cross ema_26

過濾條件
  - NOT rsi_14 > 70
    + rsi_14 > 70

結論       trend_ema_rsi 被過濾否決
被否決的原因
```

「被否決的原因」後面是空的。

第一版的 `blocking_leaves()` 邏輯是「整棵樹不成立時，列出所有不成立的葉節點」。而在 `NOT rsi_14 > 70` 這棵樹上，唯一的葉節點是 `rsi_14 > 70`，而它**是成立的**——它就是擋住進場的那一個。於是那個「列出不成立的葉節點」的規則找不到任何東西。

修法是把**期待值**帶著往下走，而遇到 NOT 就翻過來：

```python
# quantbot/domain/values/condition_trace.py
    def blocking_leaves(self, *, expected: bool = True) -> tuple[ConditionTrace, ...]:
        """整棵樹沒有給出期待的答案時，哪幾個葉節點要負責。

        遞迴時要帶著**期待值**，因為它在 NOT 底下會翻過來：一個不成立的
        `NOT rsi_14 > 70`，擋住進場的是那個成立的 `rsi_14 > 70`。第一版沒有處理
        這件事，於是實測時「被否決的原因」印出一個空字串——而那正是最需要它的
        那一種紀錄（進場訊號被過濾條件否決）。

        AND 之下有幾個不成立就列幾個，OR 之下整組都算在擋（所有替代方案都失敗了），
        兩者都是準確的答案而不是近似。
        """
        if self.satisfied is expected:
            return ()
        if self.is_leaf:
            return (self,)
        return tuple(
            leaf
            for child in self.children
            for leaf in child.blocking_leaves(
                expected=not expected if child.inverted else expected
            )
        )
```

而「這個子節點在 NOT 底下」這個資訊要從哪裡來？不能從節點的名字猜：

```python
# quantbot/domain/values/condition_trace.py
    inverted: bool = False
    """我的父節點是不是 NOT。

    這一個布林值存在的理由，是「哪一個節點在擋」這個問題在取反之下會翻過來：
    一個不成立的 `NOT rsi_14 > 70`，擋住進場的是那個**成立**的 `rsi_14 > 70`。
    沒有這個旗標的話，走訪整棵樹的程式就得從節點的名字猜它是不是 not(...)，
    而那是字串嗅探——條件的名字一改就壞，而且不會有測試發現。
    """
```

標記的地方是建樹的人：

```python
# quantbot/domain/strategies/condition.py
    def _traced_children(
        self, table: pd.DataFrame, position: int
    ) -> tuple[ConditionTrace, ...]:
        """子節點帶上 inverted 旗標。

        「哪一個節點在擋」在取反之下會翻過來，而走訪那棵樹的程式不該從名字猜出
        自己在 NOT 底下——所以這個資訊由建樹的人標記。
        """
        return (
            replace(self._condition.trace(table, position), inverted=True),
        )
```

這個缺陷有一個共同的形狀，而它在這個系列裡出現過好幾次：`Not` 那個類別本身在 Day 16 就寫了一段警語（取反會讓暖機期的缺值變成「成立」），而**同一個「取反會翻過來」的性質在另一個地方又咬了一次**。取反的東西不多，但每一個用到它的地方都要單獨想一次。

## 一筆紀錄該有哪些欄位

欄位是照著「三天後想問的問題」排的：

```python
# quantbot/domain/values/decision_record.py
@dataclass(frozen=True)
class DecisionRecord:
    """一次決策的完整脈絡。日誌要記的不是「下了什麼單」，是「為什麼」。

    - 哪一根（bar_open_time）與什麼時候決定的（decided_at）。兩個時間都要有：
      前者是策略看的那根 K 線，後者是我們實際做決定的時刻，而它們**不相等**——
      決策發生在那根收盤之後。差太多代表管線延遲了。
    - 那一刻每個特徵的值（feature_values）。只記這個策略要的那幾欄，不是整張表：
      一份含 13 欄的紀錄乘上一年的每小時，是可以查但沒有人會查的東西。
    - 三棵條件樹的每個節點成不成立（entry／exit／filters）。這是手寫策略拿不到的。
    - 部位計算要了多少、上限給了多少（requested_weight／applied_weight）。
      Day 24 的那個差距在這裡留下紀錄。
    - correlation_id 串起「訊號 → 風控 → 下單 → 成交」。它是必填的。

    client_order_id 可以是 None：多數決策的結論是「什麼都不做」，而那種決策一樣
    值得記。**只記下有下單的那些決策，會讓「為什麼那天沒進場」變成一個查不到的
    問題**，而那個問題跟「為什麼那天進場了」一樣常出現。
    """
```

最後那一段是這份設計最容易被省掉的一條。一個只記下單的日誌，在「策略整個月沒有進場」的時候完全沒有東西可看，而那正是最需要查的情況之一。

**只記策略讀的那幾欄**也是一個取捨。整張表有 13 欄，而 `trend_ema_rsi` 只讀三欄。記全部會讓日誌大四倍，而多出來的那些欄位跟這個決策無關。

## correlation_id：串起四段，而且是冪等的

```python
# quantbot/application/record_decisions_application.py
    @staticmethod
    def correlation_id_for(strategy_name: str, bar_open_time: pd.Timestamp) -> str:
        """一根 K 線只會決策一次，所以「策略 ＋ 那根的時間」天然唯一。"""
        return f"{strategy_name}-{bar_open_time.strftime('%Y%m%dT%H%M%SZ')}"
```

用推導出來的 id 而不是 UUID，換到的是**冪等**：補記三百根決策的過程中斷之後重跑，會覆蓋同樣的三百列而不是產生六百列。這跟 Day 23 的 `client_order_id` 是同一個想法的另一種形狀——那裡靠一個生成一次的 id 讓重送安全，這裡靠一個推導出來的 id 讓重跑安全。

寫入因此用 `ON CONFLICT DO UPDATE`，而那跟前面四張表相反：

```python
# quantbot/infrastructure/persistence/timescale_decision_journal_repository.py
    """寫入用 ON CONFLICT DO UPDATE 而不是 DO NOTHING。這是跟前面四張表相反的選擇，
    理由是主鍵的語意不同：K 線的主鍵是「這一根」，同一根重寫應該是同一份事實；
    決策的主鍵是 correlation_id，而同一個 id 重寫代表那一段流程又跑了一次
    （重試、補記成交結果），後來的那份才是完整的。
    """
```

## 寫進資料庫，不只是檔案

```python
# quantbot/domain/interfaces/decision_journal_repository.py
class DecisionJournalRepository(Protocol):
    """決策日誌的持久化。

    寫進資料庫而不只是檔案，理由是**查得動**。一份 JSON 檔案能回答「那天發生什麼」，
    但回答不了「所有被過濾條件否決的進場，集中在哪幾個時段」——那需要一句 SQL。
    而決策日誌真正的價值出現在第二種問題上：單一筆的脈絡靠 correlation_id 就查得到，
    模式要靠聚合才看得出來。

    read 用 correlation_id 而不是時間，因為那是從一筆異常成交回推的入口：
    先從交易所的成交紀錄拿到 client_order_id，再用它找到 correlation_id，
    然後撈出整個脈絡。
    """
```

而這張表**刻意不是 hypertable**：

```sql
-- quantbot/infrastructure/persistence/migrations/005_decision_journal.sql
-- 決策日誌。它刻意**不是** hypertable，而那個決定值得寫下來：
-- 這張表一天幾十列（一小時一根 K 線，一根一筆決策），一年不到兩萬列。
-- hypertable 解決的是「一張表幾億列，查詢要能只掃一個時間分區」，
-- 而這裡的查詢模式是「用 correlation_id 撈一筆」與「一段時間內的聚合」。
-- 對兩萬列做分區只是多一層東西要維護。
--
-- 前面四個 migration 的表都是 hypertable，因為它們是行情資料——
-- agg_trades 一天七十幾萬列。同一個資料庫裡兩種表共存是對的，
-- 「因為裝了 TimescaleDB 所以每張表都要是 hypertable」不是。
```

條件樹存成 `JSONB`，而它有一個 asyncpg 的細節會咬人：

```python
# quantbot/infrastructure/persistence/timescale_decision_journal_repository.py
    """JSONB 的欄位用 `$n::jsonb` 明確轉型，值是 `json.dumps()` 出來的字串。
    asyncpg 不會幫 dict 自動轉成 JSONB——不轉型的話它會把字串存成 TEXT，
    而那張表的欄位是 JSONB，於是報錯。這是好事：安靜地存成字串會讓之後所有
    JSON 查詢（`entry_trace -> 'satisfied'`）永遠回空。
    """
```

## 為什麼沒有用 structlog

原本的計畫是用 `structlog` 輸出 JSON。寫到那一步的時候發現不需要：

```python
# quantbot/infrastructure/reporting/json_decision_log_renderer.py
    """一筆決策 → 一行 JSON。給 stdout（也就是 docker logs）用。

    **為什麼不用 structlog。** 那個套件最有價值的功能是 context binding
    （把 correlation_id 綁進一個 logger，之後每一行自動帶上），而這個專案的
    context 已經整份收在 DecisionRecord 裡了——它就是那個 context。剩下的需求是
    「把一個 dataclass 變成一行 JSON」，而那是 `json.dumps` 一行。多一個依賴
    換到的是一個我們不需要的功能。

    兩個決定：

    - **一行一筆，NEVER 縮排。** docker logs 與多數日誌收集器是逐行處理的，
      一筆跨十行的 JSON 會被切成十筆讀不懂的紀錄。
    - **`ensure_ascii=False`。** 條件的 describe() 是中文，escape 成 \\uXXXX 之後
      人就讀不了了，而讀日誌的第一個讀者是人。
    """
```

`ensure_ascii=False` 那一條在中文的專案裡是必要的。預設的輸出會把 `ema_12 ↑ cross ema_26` 變成一串 `\u` 編碼，技術上正確、而人在終端上看不懂。

## 實測：一筆被否決的進場

跑 2,000 根的決策紀錄，然後撈出其中一筆：

```bash
uv run python -m quantbot.entrypoints.journal_command \
    --strategy trend_ema_rsi --timeframe 1h \
    --start 2025-01-01 --end 2026-08-01 --bars 2000
```

```
=== 決策 trend_ema_rsi-20260714T120000Z ===
K 線       2026-07-14T12:00:00+00:00
決定於     2026-08-21T23:54:26+00:00（延遲 3326066 秒）
標的       spot_BTCUSDT_1h
策略       trend_ema_rsi（long）

特徵值
  close                                    63,960.000000
  ema_12                                   62,850.220397
  ema_26                                   62,785.418614
  rsi_14                                       71.464114

進場條件
  + ema_12 ↑ cross ema_26

過濾條件
  - NOT rsi_14 > 70
    + rsi_14 > 70

出場條件
  - ema_12 ↓ cross ema_26

部位       要求 0.00%／實際 0.00%
結論       2026-07-14T12:00:00+00:00 trend_ema_rsi 被過濾否決（權重要求 0.00%、實際 0.00%）
下單       （沒有下單）
被否決的原因   rsi_14 > 70
```

這一頁回答的就是「為什麼那天沒進場」：**黃金交叉真的發生了，而 RSI 已經到 71.46，過濾條件擋掉了它。** 這個答案在只記下單的日誌裡不存在，因為那天什麼單都沒下。

那個 332 萬秒的延遲值得解釋：這批紀錄是**事後補記**的，`decided_at` 是執行那個指令的時刻。它看起來很怪，而它是對的——一份謊稱「這個決策發生在 2026-07-14」的日誌會更糟。上線之後這個數字會是幾秒，而它一旦變成幾百秒就代表管線延遲了。

## 一句 SQL 撈出模式

單筆的脈絡靠 `correlation_id`，而模式要靠聚合：

```sql
SELECT count(*) AS 決策數,
       count(*) FILTER (WHERE (entry_trace->>'satisfied')::boolean) AS 進場訊號,
       count(*) FILTER (WHERE (entry_trace->>'satisfied')::boolean
                          AND NOT (filter_trace->>'satisfied')::boolean) AS 被否決
FROM decision_journal;
```

```
 決策數 | 進場訊號 | 被否決
--------+----------+--------
   2000 |       28 |      2
```

2,000 根裡有 28 次進場訊號，其中 2 次被過濾條件否決。這兩個數字在 Day 16 的 `StrategySignals` 上也算得出來，而差別是**這裡的每一筆都查得到細節**。

再往下一層：

```sql
SELECT extract(hour from bar_open_time) AS 小時, count(*) AS 被否決次數
FROM decision_journal
WHERE (entry_trace->>'satisfied')::boolean
  AND NOT (filter_trace->>'satisfied')::boolean
GROUP BY 1 ORDER BY 2 DESC;
```

```
 小時 | 被否決次數
------+------------
   21 |          1
   12 |          1
```

兩次，分散在不同時段——樣本太小，看不出模式。而這正是這種查詢該有的用法：它回答的是「有沒有模式」，而答案可以是「沒有」。如果 2,000 根裡有 40 次否決集中在 UTC 14:00（Day 12 量到最熱鬧的那個小時），那就是一個要追下去的線索。

整棵樹也存得完整，所以事後可以直接讀：

```
$ psql -c "SELECT jsonb_pretty(filter_trace) FROM decision_journal
           WHERE correlation_id='trend_ema_rsi-20260714T120000Z';"
{
    "name": "not(rsi_14_above_70)",
    "children": [
        {
            "name": "rsi_14_above_70",
            "children": [],
            "inverted": true,
            "satisfied": true,
            "description": "rsi_14 > 70"
        }
    ],
    "inverted": false,
    "satisfied": false,
    "description": "NOT rsi_14 > 70"
}
```

## 日誌記的必須是「策略真的用的那些數字」

這一點在實作上有一個具體的落地方式：

```python
# quantbot/application/record_decisions_application.py
    """它做的事跟 Day 24 的比較一樣（讀表、算訊號、算部位），只多最後一步：
    把每一根的完整脈絡存下來。**重用同一條路徑是刻意的**——日誌記的必須是
    「策略真的用來做決定的那些數字」，而不是「日誌自己重算一次的數字」。
    後者會在兩邊算法漂移的時候給出一份看起來很合理但沒有發生過的紀錄。
    """
```

「一份看起來很合理但沒有發生過的紀錄」是這類系統最糟的一種輸出，因為它會讓除錯往完全錯的方向走。有測試釘住這件事——紀錄裡的 `requested_weight` 與 `applied_weight` 必須是 `PositionSizingService` 真的算出來的那兩個值。

## 今日交付物

```
quantbot/
├── domain/
│   ├── values/
│   │   ├── condition_trace.py        今天：整棵樹 ＋ inverted 旗標
│   │   └── decision_record.py        今天
│   ├── strategies/condition.py       加上 trace()（template method）
│   ├── services/decision_snapshot_service.py   今天
│   └── interfaces/decision_journal_repository.py  今天
├── application/
│   ├── record_decisions_application.py    今天
│   └── inspect_decision_application.py    今天
├── infrastructure/
│   ├── persistence/migrations/005_decision_journal.sql   今天（不是 hypertable）
│   ├── persistence/timescale_decision_journal_repository.py   今天
│   └── reporting/json_decision_log_renderer.py ＋ text_decision_record_renderer.py
├── entrypoints/journal_command.py    今天
└── tests/                            3 個新測試檔案，共 21 條
```

### 先把 schema 與資料補到最新

這一天新增了一張表，所以 migration 一定要跑：

```bash
uv sync
docker compose -f docker/docker-compose.yml up -d timescaledb
uv run python -m quantbot.infrastructure.persistence.migrate
uv run python -m quantbot.entrypoints.ingest_pipeline_command
```

```
套用 005_decision_journal.sql
```

### 跑起來

```bash
# 記最後 2000 根的決策脈絡
uv run python -m quantbot.entrypoints.journal_command \
    --strategy trend_ema_rsi --timeframe 1h \
    --start 2025-01-01 --end 2026-08-01 --bars 2000

# 用 correlation_id 撈一筆（--json 印那一行 JSON）
uv run python -m quantbot.entrypoints.journal_command \
    --inspect trend_ema_rsi-20260714T120000Z

# 從一筆單反查（實務上真正的入口）
uv run python -m quantbot.entrypoints.journal_command \
    --inspect-order quantbot-abc123
```

再跑一次同一段：紀錄數不會變多，因為 `correlation_id` 是推導出來的。

### 驗收標準

八項全過才算完成：

1. `uv run pytest` 全綠（634 passed）。
2. **整棵樹都有 trace，不只根節點**，有測試釘住子節點的真假值。
3. **取反之下「哪一個節點在擋」會翻過來**，有測試釘住。這一條是實跑抓到的。
4. **整棵樹（含 inverted）能在 JSON 之間來回而不失真**，有測試釘住。
5. **只記策略讀的那幾欄特徵，而收盤價一定在裡面**，有測試釘住。
6. **NaN 權重記成 0.0**，因為 NaN 不是合法的 JSON。
7. **同一根重跑會覆蓋同一列**，有測試釘住 correlation_id 的冪等。
8. `uv run mypy quantbot` 與 `uv run lint-imports` 全過（313 檔，3 條契約）。

第 3 項是今天最值得留著的一條，因為它是一個「答案錯了但沒有任何錯誤」的缺陷——`blocking_leaves()` 回一個空 tuple，而空 tuple 是一個完全合法的回傳值。

> 免責聲明：本文為程式與資料工程的技術分享，所有數字皆為歷史資料上的觀察與教學範例，不構成投資建議。

## 明天

日誌能還原每一筆決策了，而它記下的都是**正常行情**下的決策。

明天處理不正常的：價格瞬間跳 20%、成交量歸零、交易所維護、掛單簿只剩一邊、下單被拒（餘額不足或超過限額）、部分成交、系統時間跳動。每一項都寫成測試，而測試的方式是**故障注入**——用替身讓交易所回傳異常，看整套系統的反應。

還有一個要補上的東西：熔斷。Day 23 的斷路器管的是「通道連續失敗」，而明天要處理的是「市況本身不對」——偵測到異常行情就自動暫停交易並告警。順帶回答一個反直覺的問題：極端行情下最好的策略常常是**什麼都不做**，而停損單在閃崩時可能以離譜的價位成交。

## Reference

- [`jsonb` 的 `->>` 與 `->` 運算子，以及它們回傳型別的差別 — PostgreSQL documentation, JSON Functions and Operators](https://www.postgresql.org/docs/current/functions-json.html)
- [`count(*) FILTER (WHERE ...)` 比 `sum(case when ...)` 好讀，而且是標準 SQL — PostgreSQL documentation, Aggregate Expressions](https://www.postgresql.org/docs/current/sql-expressions.html#SYNTAX-AGGREGATES)
- [asyncpg 對 `jsonb` 參數不做自動轉換，需要明確轉型或設定 codec — asyncpg documentation, Type Conversion](https://magicstack.github.io/asyncpg/current/usage.html#type-conversion)
- [`json.dumps` 的 `ensure_ascii=False` 保留非 ASCII 字元 — Python documentation, `json`](https://docs.python.org/3/library/json.html#json.dumps)
- [部分索引（partial index）只收錄符合條件的列 — PostgreSQL documentation, Partial Indexes](https://www.postgresql.org/docs/current/indexes-partial.html)
