---
title: "Day 29：遇到閃崩、交易所停機、資料斷檔怎麼辦？把極端行情當成邊緣案例來測"
datetime: "2026-10-13"
description: "先掃真實資料再決定怎麼測：830,879 根 1 分鐘 K 線裡最大的單分鐘跳動是 4.290%，門檻是 5%，一個異常都沒有。真實資料乾淨得測不出這些路徑，所以極端案例只能靠故障注入。這篇補上第二個熔斷器（管市況，不是管通道），而它的恢復條件是冷卻加上一根乾淨的資料——時間到了只代表我們等過了。故障注入也抓到第二個分類錯誤：ccxt 把「時間對不上」放在可重試那一類。"
image: ""
parent: "2026 ithome-鐵人賽: 工程師的量化交易入門：從 K 線到可組合的交易策略引擎 系列"
draft: true
---

## 先問一個問題：這些事在資料裡發生過嗎

今天的清單是這些：價格瞬間跳 20%、成交量歸零、交易所維護、掛單簿只剩一邊、下單被拒、部分成交、系統時間跳動。

在寫任何測試之前，先掃一遍手上的真實資料，看這些事發生過幾次：

```bash
uv run python -m quantbot.entrypoints.sanity_command --scan \
    --timeframe 1m --start 2025-01-01 --end 2026-08-01
```

```
=== quantbot market sanity ===
checked_at : 2026-07-31T23:59:00+00:00
結論       : 830,880 根都正常
```

零。換 1 小時 K 線也是零（13,848 根）。用 SQL 獨立對一次，看最大的單分鐘跳動到底多大：

```sql
WITH r AS (
  SELECT close, lag(close) OVER (ORDER BY open_time) AS prev
  FROM candles
  WHERE symbol='BTC/USDT' AND market='spot' AND timeframe='1m'
    AND open_time >= '2025-01-01' AND open_time < '2026-08-01'
)
SELECT count(*) AS 根數,
       round(max(abs(close/prev-1))::numeric, 5) AS 最大單分鐘跳動,
       count(*) FILTER (WHERE abs(close/prev-1) > 0.05) AS 超過門檻,
       count(*) FILTER (WHERE abs(close/prev-1) > 0.02) AS 超過2pct
FROM r WHERE prev IS NOT NULL;
```

```
  根數  | 最大單分鐘跳動 | 超過門檻 | 超過2pct
--------+----------------+----------+----------
 830879 |        0.04290 |        0 |        6
```

**最大 4.290%，門檻 5%。** 一年七個月的 BTC/USDT 現貨資料，一次都沒碰到那條線。

這個結果決定了今天的做法，而它也順便說明了兩件事。

**第一，門檻沒有被驗證過。** 5% 是 Day 08 訂的，而資料裡最接近的一次是 4.29%。那條線可能設得剛好，也可能設得太寬——資料回答不了這個問題，而**知道自己不知道**比假設它是對的好。

**第二，極端案例只能靠故障注入。** 等真實資料出現一次 20% 的跳動再看程式的反應，是等一個平均幾年才發生一次的事件，而它發生的時候我們在睡覺。所以今天的產出主要是一份測試檔案。

順帶一個實作上的小教訓：上面那句 SQL 第一次寫的時候漏了 `timeframe='1m'`，而 `candles` 這張表同時放 1 分鐘（2,776,330 列）與 1 小時（69,408 列）的資料。`lag()` 因此在兩種粒度之間跳，算出一個假的「5.171% 單分鐘跳動」。**臨時的 SQL 少一個 WHERE 就會產生一個不存在的異常**，而程式碼那一側因為 `Instrument` 帶著 timeframe，這種錯誤寫不出來。

## 交易概念補課：閃崩與流動性枯竭

**閃崩（flash crash）** 是價格在極短時間內大幅下跌又快速反彈。原因通常不是有人真的想賣那麼便宜，而是連鎖的強制平倉加上掛單簿被吃穿：賣壓吃掉買方的第一檔、第二檔、第十檔，而每一檔的價格越來越差。

**流動性枯竭（liquidity crunch）** 是那個過程的另一面。Day 20 量過 BTC/USDT 現貨前五檔買方的名目金額中位數是 229,406 USDT，而閃崩的那幾秒它可能掉到幾千。這時候簿子上還有價格，只是深度不夠。

這兩件事合起來解釋了一個反直覺的結論：**停損單在閃崩時可能以離譜的價位成交。** 停損是一個「跌破某個價位就用市價賣出」的指令，而市價單的成交價由簿子決定——簿子被吃空的時候，那張單會一路成交到很深的地方。

所以極端行情下最好的策略常常是**什麼都不做**。不是因為不動比較勇敢，是因為那時候的成交價幾乎不可能是我們算過的那個價。而「什麼都不做」在自動交易裡不是一個心態，是一段程式碼——今天寫的就是那段程式碼。

## 第二個熔斷器，管的是市況

Day 23 有一個斷路器，管的是「對外通道連續失敗」。今天的這個管的是「市場本身不對」，而它們是兩個獨立的閘門：

```python
# quantbot/domain/entities/market_circuit_breaker.py
class MarketCircuitBreaker:
    """市況不對就停手，而且**要看到一根乾淨的資料才恢復**。

    它跟 Day 23 的 CircuitBreaker 是兩個獨立的閘門，而分開是刻意的：
    那一個管「對外通道連續失敗」，這一個管「市場本身不對」。兩者的原因、
    恢復條件、以及該告警的內容都不同，混成一個之後「為什麼停了」就答不出來。

    交易迴圈要兩個閘門都放行才送單，再加上 Day 25 那個人為閘門（TradingControl）。
    三個閘門是 AND 起來的：**任何一個說不行就不行**，而它們互相不知道對方存在。
    """
```

「三個閘門 AND 起來」有一條測試釘住，而它同時是一份設計文件：

```python
# tests/edge_cases/test_execution_edge_cases.py
def test_the_three_gates_are_and_ed_together():
    """人為閘門、通道斷路器、市況熔斷是三個獨立的閘門。

    任何一個說不行就不行，而它們互相不知道對方存在——所以「為什麼不能交易」
    有三個各自說得清楚的答案，而不是一個混在一起的布林值。
    """
```

「三個各自說得清楚的答案」是分開的價值。一個把三種原因合成 `can_trade: bool` 的設計，在停止交易的時候只能回答「不行」，而半夜要問的問題是「為什麼」。

## 恢復條件：冷卻，加上一根乾淨的資料

這是今天最重要的一個判斷，而它跟 Day 23 那個斷路器不同。

```python
# quantbot/domain/entities/market_circuit_breaker.py
    """恢復條件有兩個，兩個都要滿足：

    1. 冷卻時間到了。
    2. **之後至少看到一根乾淨的資料**（record_clean）。

    第二個條件是這個類別跟 Day 23 那個斷路器最大的差別。時間到了就恢復是錯的：
    閃崩之後五分鐘，市場可能還在崩。「時間到了」只說明我們等過了，不說明情況好了。
    """
```

而 `HALF_OPEN` 在這裡的意思也不同：

```python
# quantbot/domain/entities/market_circuit_breaker.py
    def allows_trading(self, now: pd.Timestamp) -> bool:
        """HALF_OPEN 一樣不准交易。

        這裡跟 Day 23 的斷路器不同：那邊 HALF_OPEN 要放一張單過去試水溫，
        因為「通道好了沒」只有送一次才知道。市況好了沒不必用一張單去試——
        下一根資料進來就知道了，而那個測試是免費的。
        """
```

同一個狀態名稱在兩個類別裡有不同的行為，這件事本來會讓人困惑，而它有一個清楚的理由：**探測的成本不同。** 通道的狀態只有送一次請求才知道，市況的狀態下一根資料進來就知道。免費的測試不必省。

還有一個容易寫錯的地方：

```python
# quantbot/domain/entities/market_circuit_breaker.py
    def trip(self, anomalies: tuple[MarketAnomaly, ...], now: pd.Timestamp) -> CircuitState:
        """偵測到異常。已經跳開的話**重新計時**。

        重新計時而不是保留原本的計時器，理由是異常還在發生：一個閃崩持續二十分鐘，
        冷卻十五分鐘從第一次偵測算起會讓機器人在還在崩的時候恢復。
        """
```

以及對稱的那一半：

```python
# quantbot/domain/entities/market_circuit_breaker.py
    def record_clean(self, now: pd.Timestamp) -> CircuitState:
        """看到一根乾淨的資料。冷卻也過了的話就恢復。

        冷卻還沒過就什麼都不做——不是「重設計時器」。乾淨的資料不會讓冷卻縮短，
        它只是恢復的第二個條件。
        """
```

## 六種異常，一個共同點

```python
# quantbot/domain/values/anomaly_kind.py
class AnomalyKind(StrEnum):
    """市況不對的六種形狀。

    Day 08 的清洗也在標記其中幾個，而**用途完全不同**：那裡問的是「這列資料能不能
    入庫」，這裡問的是「現在該不該交易」。同一個 price_jump 在入庫時是一個標籤
    （留著、進報告、由人看），在交易時是一個停手的理由。

    每一種都停手，沒有「只是警告」那一級。理由是這六種的共同點是**我們拿到的
    資訊不可靠**，而在資訊不可靠的時候交易，跟策略好不好無關。
    """
```

其中最安靜的一種是 `STALE_FEED`：所有計算都跑得動，只是算的是舊資料。它在今天的實跑裡剛好出現了——因為本機的回補管線已經停了三小時：

```
=== quantbot market sanity ===
checked_at : 2026-08-22T00:08:39+00:00
結論       : 3 根裡有 1 個異常（stale_feed×1）

  2026-08-21T20:00:00+00:00  stale_feed  最後一根 2026-08-21T20:00:00+00:00，落後 3 根（門檻 2）

停止交易   : 是
市況熔斷 open（還要 900 秒）：stale_feed
```

這一段沒有經過任何注入。它是真的：資料落後三根、門檻兩根，所以熔斷跳開、指令的 exit code 是 1。而在這個狀態下，一個沒有這道檢查的機器人會照樣用三小時前的價格算訊號、照樣下單。

## 重用，而不是再寫一份門檻

價格跳動的門檻**不放在今天的設定值裡**：

```python
# quantbot/domain/values/sanity_thresholds.py
    """價格跳動的門檻**不在這裡**，它在 Day 08 的 CandleSanitationService 上，
    因為那張表跟 timeframe 綁定（1 分鐘跳 5% 跟日線跳 5% 是完全不同的事件）。
    在這裡再放一份會有兩份真相，而它們一旦不一致，入庫時被標記的那一根在交易時
    可能不被標記——一個「資料庫裡有異常標記、但機器人照樣進場」的組合。
    """
```

所以 `MarketSanityService` 吃兩個既有的 domain service：

```python
# quantbot/domain/services/market_sanity_service.py
class MarketSanityService:
    """現在的市況正常嗎。不正常就停手，而「不正常」有六種形狀。

    它**重用** Day 08 的清洗與 Day 27 的新鮮度檢查，而不是各寫一份：

    - 價格跳動、成交量為零、結構不可能，都是 CandleSanitationService 已經在算的
      旗標。跳動的門檻跟 timeframe 綁定，而那張表在那個 service 上。
    - 資料是不是停在過去，是 DataFreshnessService 已經在算的東西。

    它是 domain service：不吃 Protocol、不做 I/O，兩個被重用的 service 都是具體
    實例。所以它可以用純資料測完，包含閃崩、成交量歸零、簿子只剩一邊那幾種
    情況——**極端行情的測試不需要極端行情的資料**。
    """
```

最後那句是這一整天在做的事。domain service 不吃 I/O 這條規矩（Day 03 定的）在這裡換到的東西很具體：閃崩的測試是三行合成的 K 線，不需要任何替身、不需要連線、跑起來 0.5 秒。

`inspect()` 與 `scan()` 分成兩個方法，因為它們問的問題相反：

```python
# quantbot/domain/services/market_sanity_service.py
    def scan(self, series: CandleSeries) -> MarketSanityReportDto:
        """整段歷史掃一遍。給「這段資料裡有幾個異常」用，不給熔斷用。

        它跟 inspect() 分開是因為問題不同：inspect 問「現在能不能交易」，
        scan 問「這份資料乾不乾淨」。共用一個方法的話，那個方法就得同時回答
        兩個問題，而它們對「最近」的定義相反。
        """
```

有測試把這件事釘住：一次一年前的閃崩會出現在 `scan()` 裡、不會讓 `inspect()` 停手。

## 故障注入抓到的第二個分類錯誤

Day 23 的失敗分類有六個分支，而它們的正確性只有在真的遇到那些例外時才驗得出來。故障注入就是「真的遇到」的便宜版本：

```python
# tests/edge_cases/test_execution_edge_cases.py
def test_a_clock_that_drifted_is_a_permanent_failure():
    """簽章帶 timestamp，而伺服器會拒絕偏離太多的請求。

    重送不會讓時間變對，所以它必須是 PERMANENT——分類錯的話機器人會在時鐘漂移的
    整段時間裡不停重試。
    """
    import ccxt.async_support as ccxt

    failure = ccxt.InvalidNonce("Timestamp for this request is outside of recvWindow")
    assert BinanceFailureParser().classify(failure) is FailureKind.PERMANENT
```

這條測試第一次跑就失敗了：實得 `TRANSIENT`。

原因跟 Day 23 那個逾時的問題一模一樣——ccxt 的 `InvalidNonce` 也繼承 `NetworkError`：

```
InvalidNonce -> ['NetworkError', 'OperationFailed', 'BaseError']
RequestTimeout -> ['NetworkError', 'OperationFailed', 'BaseError']
DDoSProtection -> ['NetworkError', 'OperationFailed', 'BaseError']
```

於是「本機時鐘漂了」被歸成「網路問題，重送就好」。後果很具體：VPS 沒有對時的話（Day 27 講過那一步），機器人會在整段漂移期間不停重試，而每一次都被拒絕。

修法是在 `NetworkError` 那一條之前多攔一次：

```python
# quantbot/infrastructure/binance/binance_failure_parser.py
        if isinstance(failure, ccxt.InvalidNonce):
            # 「timestamp 超出 recvWindow」：本機時鐘漂了，要做的是對時而不是重送。
            return FailureKind.PERMANENT
```

同一個形狀的錯誤在同一個檔案裡出現兩次，所以那段 docstring 現在有四條規則而不是三條。**繼承階層跟語意階層不一致**是這類 SDK 的常態，而處理方式是把每一個要用到的例外型別都單獨查一次，不要靠父類別推論。

## 邊緣案例清單，以及它們各自守什麼

```python
# tests/edge_cases/test_market_anomalies.py
"""極端行情的邊緣案例。

實跑的結論是這一份檔案存在的理由：830,879 根 1 分鐘 K 線裡，最大的單分鐘跳動是
4.290%，而門檻是 5%——**一個異常都沒有**。真實資料乾淨得測不出這些路徑，
所以極端案例只能用故障注入來測。
"""
```

23 條測試，分兩個檔案。市況那一邊：

| 案例 | 它守的東西 |
|---|---|
| 1 小時跳 24% | 熔斷跳開，而 detail 帶著門檻的數字 |
| 1 小時跳 18% | **不**跳開——門檻的兩側行為必須不同，否則門檻只是裝飾 |
| 成交量為 0 | BTC 的一小時沒有成交，代表拿到的不是市場資料 |
| 最高價低於最低價 | 結構上不可能為真 |
| 資料落後 8 根 | 每一根都正常，而算的是舊資料 |
| 一年前的閃崩 | 出現在 scan()、不讓 inspect() 停手 |
| 簿子只剩一邊 | 流動性枯竭，而 detail 要說是哪一邊 |
| 簿子很薄 | 只在設了名目門檻時才算異常 |
| 完全沒有簿子 | **不**算異常——拿不到資料不等於異常 |
| 冷卻過了但沒有乾淨的資料 | 一樣不准交易 |
| 冷卻期間出現乾淨的資料 | 不會讓冷卻縮短 |
| 異常持續發生 | 每次都重新計時 |

下單那一邊：

| 案例 | 它守的東西 |
|---|---|
| 餘額不足／低於最小下單量／超過限額 | 一次就停手，不浪費重試次數 |
| 部分成交 | 剩下多少算得出來 |
| 交易所維護 | 重試，而次數用完要停手 |
| 被限流 | 退避明顯更久 |
| 時鐘漂移 | PERMANENT（這一條抓到了缺陷） |
| 逾時之後查單查不到 | 允許重送一次，而且只有一次 |
| 三個閘門 | AND 起來，而且各自說得出理由 |

「拿不到簿子不算異常」那一條值得單獨講：

```python
# quantbot/domain/values/sanity_thresholds.py
    """minimum_notional_per_side 的預設值 0 代表不檢查深度。理由是深度資料只有自己
    錄的那幾段（Day 09 講過現貨沒有掛單簿的歷史批次檔），所以多數時候手上沒有
    這個數字，而一個「拿不到資料就當成異常」的檢查會讓機器人永遠停著。
    """
```

一個「保守到永遠不交易」的熔斷器不是安全，是壞掉。而它壞掉的方式很難發現，因為它的行為看起來像「很謹慎」。

## 恢復也要講

```python
# quantbot/domain/services/alert_routing_service.py
    def market_resumed(self, *, halted_kinds: tuple[str, ...]) -> Notification:
        """恢復是事件不是告警：它已經處理完了，不需要人做任何事。

        它仍然要送出去，因為「停了」有告警而「好了」沒有的話，人會不知道現在
        是什麼狀態——而那會讓人自己上去看，也就是我們想避免的那件事。
        """
```

而沒事的時候不講話，這一條也有測試（`test_a_calm_market_publishes_nothing`）——那是 Day 25 那整套壓制策略的延伸：一個每五分鐘報告「市況正常」的機器人，會讓真正的告警埋在噪音裡。

## 今日交付物

```
quantbot/
├── domain/
│   ├── values/            AnomalyKind, MarketAnomaly, SanityThresholds
│   ├── dto/market_sanity_report.py                今天
│   ├── entities/market_circuit_breaker.py         今天：第二個熔斷器
│   └── services/market_sanity_service.py          今天（重用 Day 08 ＋ Day 27）
├── application/inspect_market_sanity_application.py   今天
├── infrastructure/
│   ├── binance/binance_failure_parser.py          修正 InvalidNonce 的分類
│   └── reporting/text_market_sanity_report_renderer.py  今天
├── entrypoints/sanity_command.py                  今天
└── tests/
    ├── edge_cases/test_market_anomalies.py        今天，14 條
    ├── edge_cases/test_execution_edge_cases.py    今天，9 條
    └── application/test_inspect_market_sanity_application.py   今天，3 條
```

### 先把資料補到最新

這一天的兩條路徑都吃真實資料，而其中一條就是「資料夠不夠新」，所以不補的話會看到熔斷跳開（而那也算跑對了）：

```bash
uv sync
docker compose -f docker/docker-compose.yml up -d timescaledb
uv run python -m quantbot.entrypoints.ingest_pipeline_command
```

### 跑起來

```bash
# 掃一整段：這份資料乾不乾淨
uv run python -m quantbot.entrypoints.sanity_command --scan \
    --timeframe 1m --start 2025-01-01 --end 2026-08-01

# 檢查現在：能不能交易（exit code 1 代表不能）
uv run python -m quantbot.entrypoints.sanity_command --timeframe 1h
echo $?
```

故意把資料放舊一點（或把 `--stale-after-bars` 設成 1）就看得到熔斷跳開的樣子。

### 驗收標準

八項全過才算完成：

1. `uv run pytest` 全綠（661 passed）。
2. **門檻的兩側行為不同**：跳 24% 停手、跳 18% 不停。有測試釘住。
3. **恢復需要冷卻加上一根乾淨的資料**，兩個條件都有測試。
4. **異常持續發生時每次都重新計時**，有測試釘住。
5. **一年前的閃崩不會讓今天停手**，但出現在 `--scan` 的結果裡。
6. **拿不到掛單簿不算異常**，有測試釘住——保守到永遠不交易的熔斷器是壞掉的。
7. **時鐘漂移歸類為 PERMANENT**，有測試釘住。這一條抓到了一個缺陷。
8. `uv run mypy quantbot` 與 `uv run lint-imports` 全過（322 檔，3 條契約）。

第 6 項是今天最容易被忽略的一條，因為它守的錯誤看起來像美德。

> 免責聲明：本文為程式與資料工程的技術分享，所有數字皆為歷史資料上的觀察與教學範例，不構成投資建議。文中的熔斷機制降低的是「在資訊不可靠時交易」的風險，它不會讓策略變好，也不保證任何結果。

## 明天

最後一天。

前半段回答一個問題：**自動化到底贏在哪。** 不是演算法聰明——這 30 天沒有一個策略賺錢。贏在它會嚴格執行我們冷靜時訂下的規則，而人不會。反過來說，這也意味著規則寫錯時它會忠實地一路錯到底，所以前面 29 天在測試與監控上花的功夫才是真正的護欄。

後半段回顧這 30 天蓋出來的東西，並且把積木庫的故事收完：手上不是三個策略，是一套能表達策略的語言——而語言的價值取決於有沒有能力判斷自己說出來的話是不是廢話。然後給出演化路徑，每一個方向都講清楚前置條件是什麼。

也要誠實收尾：這套系統能不能賺錢取決於策略，而策略是持續研究的產物。這 30 天給的是做研究的基礎設施。

## Reference

- [`lag()` 這類 window function 在沒有 PARTITION BY 時會跨越所有列 — PostgreSQL documentation, Window Functions](https://www.postgresql.org/docs/current/tutorial-window.html)
- [ccxt 的例外階層：`InvalidNonce` 與 `RequestTimeout` 同樣繼承 `NetworkError` — ccxt Manual, Error Handling](https://docs.ccxt.com/#/README?id=error-handling)
- [`recvWindow` 與伺服器時間的容許範圍，以及為什麼要對時 — Binance Spot API Documentation, Timing security](https://developers.binance.com/docs/binance-spot-api-docs/rest-api/general-api-information)
- [市價單在薄簿上的成交價由深度決定，這是停損以離譜價位成交的機制 — Binance Academy, Order Book](https://academy.binance.com/en/glossary/order-book)
- [故障注入（fault injection）作為測試手法的定義與範圍 — Wikipedia, Fault injection](https://en.wikipedia.org/wiki/Fault_injection)
