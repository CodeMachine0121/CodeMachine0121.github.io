---
title: "Day 25：機器人在雲端跑，怎麼知道它還活著？用 Telegram 建立回報與告警"
datetime: "2026-10-09"
description: "無人值守系統的第一原則是沒有消息不等於好消息。這篇把通知分成心跳、事件、告警三級，用兩層壓制對付告警疲勞（去重的 key 要描述問題而不是時刻），並把 Telegram Bot 做成雙向的人為閘門——而那道閘門只改狀態，NEVER 自己下單。"
image: ""
parent: "2026 ithome-鐵人賽: 工程師的量化交易入門：從 K 線到可組合的交易策略引擎 系列"
draft: true
---

## 它現在會做的事，跟我們知道的事

到昨天為止，機器人會算訊號、會決定下多少、送單會自己重試、啟動會跟交易所對帳。這些能力有一個共同點：**它們全部發生在沒有人看的地方。**

放到雲端之後，觀察它的方式只剩下一個——登入那台機器看日誌。而那件事有兩個問題：它需要人主動去看，而且人不會在半夜三點主動去看。

今天要解決的不是「怎麼推訊息到手機」，那部分只有幾十行。要解決的是**推什麼、什麼時候推、以及推太多的時候會發生什麼**。

## 交易概念補課：哪些事真的需要把人叫起來

這一節列的不是技術，是判斷。

**不需要叫人的：單筆停損出場。** 停損被觸發的時候帳上在虧錢，感覺像壞事，但它是**策略照著規則執行的證據**——那個規則是我們自己在冷靜的時候訂的。把它做成告警的話，一個正常運作的策略每週會叫人起來好幾次。

**不需要叫人的：一筆重試三次才成功的下單。** 它值得留下紀錄，但它是通道品質的一個觀察值而不是一次事故。連續幾天都這樣才是要處理的事，而那件事在日誌裡看得出來。

**需要叫人的：部位與交易所不一致。** Day 23 講過為什麼——狀態不明的時候，每一個後續決定都是用錯的前提做的。

**需要叫人的：交易被停止。** 斷路器跳開或重試次數用完，機器人已經不下單了。它自己停下來是對的，但它停在那裡不會有人知道。

**需要叫人的：單日虧損超過風險預算。** Day 24 的 `daily_loss_halt_fraction` 被吃完了。

分界線不是「賺錢還是虧錢」，是**「規則有沒有被執行」**。按規則虧錢是設計的一部分；規則沒被執行、或者狀態不明，才是需要人的時刻。

## 三個層級，差別在它期待什麼反應

```python
# quantbot/domain/values/notification_level.py
class NotificationLevel(StrEnum):
    """一則通知屬於哪一級。三級的差別不是「重要程度」，是**它期待什麼反應**。

    - HEARTBEAT：「我還活著」。期待的反應是**沒有反應**——它存在的唯一理由是
      讓「沒有收到」變成一個訊號。無人值守系統的第一原則是沒有消息不等於好消息，
      而心跳是把那句話反過來用：有消息才等於好消息。
    - EVENT：發生了一件該留下紀錄的事（成交、部位變化、每日結算）。期待的反應是
      「有空的時候看一下」。
    - ALERT：出事了，需要人介入。期待的反應是**現在就處理**。
    """
```

心跳那一段是這三級裡最容易被省略的一個，而它是唯一一個能偵測「整個程式死掉」的機制。一個掛掉的程式不會發告警——它什麼都不會發。所以偵測它的方式只能是「**該來的東西沒有來**」。

分級的實際用途是決定壓制策略，而每一級的冷卻時間不同：

```python
# quantbot/domain/values/notification_level.py
    @property
    def repeat_cooldown_seconds(self) -> float:
        """同一個 dedupe_key 隔多久才准再講一次。

        心跳一天一則、事件五分鐘、告警十五分鐘。告警的冷卻比事件**長**而不是短，
        因為告警的重複最傷——重複的告警會訓練人忽略告警。
        """
```

「告警的冷卻比事件長」在直覺上是反的：越重要的事不是該講越多次嗎。不是。重複的告警**降低**後續告警被看見的機率，所以講得多不等於傳達得多。

## 去重的鍵要描述問題，不是時刻

```python
# quantbot/domain/values/notification.py
@dataclass(frozen=True)
class Notification:
    """一則要送出去的通知。

    dedupe_key 是這個值最重要的欄位，而它**必填**：一則通知如果說不出「它跟哪些
    通知算是同一件事」，那就沒有辦法去重，而不能去重的告警系統最後一定會被關掉。

    key 要描述**問題**而不是**時刻**。「reconciliation_mismatch:BTC/USDT」是對的，
    因為同一個交易對的對帳不符連續發生二十次是同一件事；把時間戳放進 key 是最常見
    的寫錯方式，那會讓每一則通知都是獨一無二的，於是去重永遠不會生效。
    """
```

「把時間戳放進 key」值得多講一句，因為它寫起來非常自然——`f"mismatch:{now.isoformat()}"` 看起來像一個很合理的唯一鍵，而它讓整個去重機制變成裝飾。而且它不會有任何錯誤訊息：通知照樣送出去，只是全部都送。

`dedupe_key` 是必填的（沒有預設值），所以**建不出一則說不出自己跟誰算同一件事的通知**。這跟 Day 19 的 `trial_count`、Day 23 的 `FailureKind` 是同一種設計：把「一定要想清楚」的東西做成型別的要求。

## 兩層壓制，擋的是兩種不同的失效

```python
# quantbot/domain/entities/notification_ledger.py
class NotificationLedger:
    """記得講過什麼、講了幾次，然後決定這一則要不要送。

    壓制策略有兩層，兩層擋的是不同的失效：

    1. **去重（冷卻）。** 同一個 dedupe_key 在冷卻期內只講一次。這一層擋的是
       「同一個問題每十分鐘講一次」——那是最有效的訓練人忽略告警的方式。
    2. **預算（時窗內的則數上限）。** 不同的問題也算在同一個預算裡。這一層擋的是
       「系統在噴東西」，而那時候多送幾十則不會讓人更快解決問題，只會讓人更快
       關掉通知。

    預算用固定時窗內的滑動計數（deque 存時間戳，過期的丟掉），而不是「每分鐘
    重設一次計數器」。後者會在時窗邊界讓兩倍的量一次通過，而那個邊界剛好是
    「事情正在惡化」的時候。
    """
```

滑動時窗那一段是實作上唯一有點技巧的地方，而它有一條測試守著：

```python
# tests/domain/entities/test_notification_ledger.py
def test_the_budget_slides_instead_of_resetting_on_the_hour():
    """固定時窗重設會在邊界讓兩倍的量一次通過，而那個邊界剛好是事情正在惡化的時候。"""
    ledger = NotificationLedger(budget_window_seconds=60.0, maximum_per_window=2)

    ledger.decide(event("a"), at(0))
    ledger.decide(event("b"), at(30))
    assert ledger.decide(event("c"), at(40)).action is DeliveryAction.SUPPRESSED_BUDGET
    # 第一則在 61 秒時出窗，於是剛好放行一則
    assert ledger.decide(event("c"), at(61)).action is DeliveryAction.SEND
    assert ledger.decide(event("d"), at(62)).action is DeliveryAction.SUPPRESSED_BUDGET
```

兩種壓制在型別上是分開的（`SUPPRESSED_DUPLICATE` 與 `SUPPRESSED_BUDGET`），因為它們指向不同的問題：前者很多代表某個狀況持續著（正常，冷卻在做它該做的事），後者很多代表**系統在噴東西**，而那本身就是一個要處理的問題。一個一小時想送出四十則不同告警的機器人，該修的不是通知模組。

還有一個小決定：**被壓掉的通知不佔用預算。** 它沒有真的送出去，所以不該擠掉別的通知。

判定與記錄在同一次呼叫裡完成，而那是刻意的：

```python
# quantbot/domain/entities/notification_ledger.py
    def decide(
        self, notification: Notification, now: pd.Timestamp
    ) -> DeliveryDecision:
        """要不要送。**這個方法會改狀態**：判定為送出時就記錄下來。

        判定與記錄放在一起是刻意的。分成 `decide()` 加 `record()` 兩步的話，
        呼叫端有機會只做前一步——而漏掉記錄的下場是所有壓制策略同時失效，
        並且沒有任何錯誤訊息。
        """
```

跟 Day 23 的斷路器一樣，每個方法都收一個 `now`。冷卻是 15 分鐘，而測試不必等 15 分鐘。

## 分級的判斷集中在一個地方

```python
# quantbot/domain/services/alert_routing_service.py
class AlertRoutingService:
    """把系統裡發生的事變成一則通知，並且決定它是哪一級。

    這個 service 存在的理由就是那句「哪些事真的需要半夜叫人起來」。把分級的判斷
    集中在一個地方，它才有可能被討論、被列表、被測試；散在每個呼叫端的話，
    分級會隨著寫那行程式碼的人當天的心情變化，而結果是每件事都變成告警。
    """
```

分級表寫在它的 docstring 裡，每一列附理由。最容易寫錯的那一列有一條測試：

```python
# tests/domain/services/test_alert_routing_service.py
def test_a_stop_loss_is_an_event_not_an_alert():
    """停損被觸發時帳上在虧錢，但它是策略照規則執行的證據。

    做成告警的話，一個正常運作的策略每週會叫人起來好幾次。
    """
    notification = ROUTING.position_closed(
        symbol="BTC/USDT", net_return=-0.021, reason="stop_loss"
    )
    assert notification.level is NotificationLevel.EVENT
    assert not notification.level.wakes_people
```

對帳報告的分級直接接 Day 23 的三種結論，而它們的對應剛好就是那三級的定義：一致與已自動接手是事件（**發生了、處理完了**），無法自動處理是告警（**狀態不明**）。

有一個取捨寫在程式碼裡而不是藏起來：

```python
# quantbot/domain/services/alert_routing_service.py
    """單日虧損。超過上限是告警，沒超過是事件。

    兩者共用同一個 dedupe_key，所以一天之內只會收到一則——而如果它先送出了
    「還在範圍內」那一則，惡化成告警的那一則會被冷卻壓掉。這是這一版刻意
    接受的取捨：dedupe_key 分開的話，一天內虧損反覆逼近上限會送出好幾則。
    真正需要「惡化就再講一次」的話，正確的做法是讓 key 帶上級別，
    而那要等到有人真的被這個行為咬到再改。
    """
```

寫下已知的取捨而不是假裝它不存在，是因為半年後看到這段行為的人（很可能是自己）需要知道它是選擇還是疏漏。

## 雙向：從手機下得動的四個指令

推訊息出去只是一半。另一半是把指令收進來，而那是這套系統唯一的人為閘門。

```python
# quantbot/domain/values/control_command.py
class ControlCommand(StrEnum):
    """從手機下得動的四個指令。這是整套系統唯一的人為閘門。

    PAUSE 與 FLATTEN 的差別是這四個裡最需要講清楚的。PAUSE 是「別再進場」，
    FLATTEN 是「現在出場」。半夜看到不對勁的時候，多數情況要的是 PAUSE——
    它讓策略照原本的規則收尾，而 FLATTEN 是用市價單在一個我們正在慌的時刻
    強制出場，那是 Day 29 會談的「極端行情下最好的策略常常是什麼都不做」的反面。

    只有四個而不是「一個通用的指令介面」，是刻意的。可以從手機下的指令越多，
    在最不該即興決策的時刻能做的即興決策就越多。
    """
```

最後那句是這個設計的整個立場。一個能從手機改參數、改策略、改上限的機器人，會在最糟的時刻被改成最糟的樣子。四個指令裡有三個是「少做一點」，沒有一個是「多做一點」。

指令解析不猜：

```python
# quantbot/domain/values/control_command.py
    @classmethod
    def parse(cls, raw: str) -> ControlCommand:
        """把 /pause 這種寫法轉成指令。認不出來就丟例外，NEVER 猜。

        「猜」在這裡特別危險：把打錯的 /flaten 猜成 /flatten 會平掉整個部位。
        """
```

## 指令只改狀態，NEVER 自己下單

這是今天最重要的結構決定，而它直接接續 Day 23 的結論。

```python
# quantbot/domain/values/trading_mode.py
class TradingMode(StrEnum):
    """交易迴圈現在被允許做什麼。

    FLATTENING 是一個過渡狀態而不是一個動作，這是今天最容易做錯的地方。
    收到 /flatten 的時候直接在那裡送出平倉單，會讓部位狀態同時有兩個寫入者
    （交易迴圈與指令處理），而那正是 Day 23 整天在避免的「狀態不一致」。
    所以指令只改狀態，真的平倉由交易迴圈的下一輪執行——**單一寫入者**。
    """
```

指令處理是一個獨立的行程，它隨時可能收到一則訊息。如果它自己送平倉單，那麼「現在有沒有部位」這件事會有兩個地方在寫，而它們之間沒有任何同步。改成「只改狀態」之後，下單的地方仍然只有一個。

平完之後停在 `PAUSED` 而不是 `RUNNING`：

```python
# quantbot/domain/entities/trading_control.py
    def acknowledge_flat(self) -> TradingMode:
        """交易迴圈平完之後回報一次，狀態從 FLATTENING 轉成 PAUSED。

        它由交易迴圈呼叫而不是由指令處理呼叫，因為只有迴圈知道平倉真的完成了。
        平完之後停在 PAUSED 而不是 RUNNING：會下 /flatten 的人不會希望它自己
        再開始交易。
        """
```

還有一條測試守著一個很實際的性質：

```python
# tests/domain/entities/test_trading_control.py
def test_repeating_a_command_is_safe():
    """手機上的按鈕會被按兩次，而一個「重複按會出錯」的緊急開關等於沒有。"""
```

## 授權：token 管的不是「誰能下指令」

```python
# quantbot/domain/values/control_request.py
@dataclass(frozen=True)
class ControlRequest:
    """一個進來的指令，帶著它是誰下的。

    requester 是必填的，因為授權是這條路徑唯一的安全機制。Telegram 的 bot token
    只要洩漏，任何人都能對這個 bot 送訊息——**token 保護的是「能不能送」，
    不是「誰能送」。** 所以「這個 chat id 在不在白名單裡」這件事一定要在應用層
    自己檢查，NEVER 假設能送到訊息的人就是主人。

    最壞的情況很具體：一個能下 /flatten 的陌生人，可以在任何時刻把部位平掉。
    """
```

未授權的指令不是靜靜丟掉，而是產生一則**告警**——因為它代表 token 可能已經洩漏，而那是一件需要人知道的事。白名單為空的話用例在建構時就失敗，所以「忘記設定授權」不會變成「所有人都有權限」。

`requester` 取的是 chat id 而不是使用者名稱：名稱可以改，chat id 不會。

## 回覆不走通知帳本

```python
# quantbot/application/serve_control_commands_application.py
    """**回覆不走通知帳本。** 指令的回覆是對話，不是告警：一個人按了 /status 卻因為
    「這個 key 在冷卻中」而沒有收到回覆，會直接以為機器人死了。所以回覆直接進
    sink，去重與預算只管系統自己發起的通知。
    """
```

這件事在結構上有一個乾淨的表達方式：這個用例**根本沒有 `NotificationLedger` 這個依賴**。它拿不到帳本，所以它不可能不小心去問。測試守的也是這件事：

```python
# tests/application/test_serve_control_commands_application.py
@pytest.mark.asyncio
async def test_replies_do_not_go_through_the_notification_ledger():
    """一個人按了 /status 卻因為冷卻而沒收到回覆，會直接以為機器人死了。

    這條測試守的是結構：這個用例根本沒有 NotificationLedger 這個依賴。
    """
    ...
    await application.run()
    assert sink.publish.await_count == 4
```

`/status` 還有一個決定值得說：**它問交易所，不問本地快取。**

```python
# quantbot/application/serve_control_commands_application.py
    async def _status_text(self) -> str:
        """狀態查詢問的是**交易所**，不是本地快取。

        理由跟 Day 23 的對帳一樣：本地狀態只是上一輪的記憶，而按下 /status 的人
        想知道的是現在真的有什麼。多一次 API 呼叫換一個不會騙人的答案。
        """
```

## 兩個 Telegram 專屬的細節

**長輪詢，不是 webhook。** webhook 需要一個有公開 IP 與憑證的 HTTPS 端點，而這台機器人跑在一個只對外連線的 VPS 上（Day 27 會部署它）。長輪詢只需要出站連線。

長輪詢有一個語意選擇要做：

```python
# quantbot/infrastructure/telegram/telegram_command_source.py
    """**offset 是這個類別唯一的狀態，而它是「已確認處理完」的游標。** Telegram 只在
    收到 offset 大於某則 update 的請求之後才把它刪掉，所以 offset 推進的時機決定
    了語意：在產出 request **之前**推進是 at-most-once（處理中掉了就永遠不會再
    看到那則指令），之後推進是 at-least-once（可能重複處理）。

    這裡選的是**之前**推進，也就是可能漏掉。理由是重複比漏掉危險：漏掉一則
    /pause，人會發現沒生效然後再按一次；重複處理一則 /flatten，在最壞的情況下
    會在剛平完之後又送一次平倉單。
    """
```

**token 不能出現在錯誤訊息裡。** 這一點很容易漏掉，因為 token 在程式碼裡只出現一次：

```python
# quantbot/infrastructure/telegram/telegram_notification_sink.py
        except httpx.HTTPError as failure:
            # NEVER 把原始例外往上丟：它的字串裡有完整 URL，而 URL 裡有 token。
            raise RuntimeError(
                f"Telegram 送不出通知（{type(failure).__name__}）："
                f"{notification.title}"
            ) from None
```

Telegram 的 API 把 token 放在**路徑**裡（`/bot<token>/sendMessage`），而 httpx 的例外訊息包含完整 URL。所以一個 `raise_for_status()` 加上一份寄到別處的日誌，等於把 token 印出來。`from None` 也是刻意的——保留原始例外的鏈會把那條 URL 一起帶著。

還有一個 guard，理由跟 Day 09 的快照限流一樣：

```python
# quantbot/infrastructure/telegram/telegram_rate_guard.py
    """限制對同一個 chat 送訊息的頻率。

    Telegram 的限制有兩層：整個 bot 每秒約 30 則，**同一個 chat 每秒 1 則**。
    後者比前者容易撞到——一個人一個 chat，而告警是成群出現的。撞到之後 API 回
    429 並附上 retry_after，而在那之後繼續送會讓等待時間變長。

    這個 guard 因此不是效能優化，是正確性：被限流丟掉的那一則可能正是最重要的
    那一則。
    """
```

## 今日交付物

```
quantbot/
├── domain/
│   ├── values/            NotificationLevel, Notification, DeliveryAction,
│   │                      DeliveryDecision, ControlCommand, ControlRequest,
│   │                      TradingMode
│   ├── entities/          notification_ledger.py（去重＋預算）
│   │                      trading_control.py（四指令三狀態）
│   ├── interfaces/        NotificationSink, ControlCommandSource
│   └── services/          alert_routing_service.py（分級表就在它的 docstring）
├── application/
│   ├── publish_notifications_application.py       今天
│   └── serve_control_commands_application.py      今天
├── infrastructure/telegram/
│   ├── telegram_notification_sink.py              今天
│   ├── telegram_command_source.py                 今天
│   ├── telegram_message_parser.py                 今天
│   └── telegram_rate_guard.py                     今天
├── entrypoints/
│   ├── notify_command.py                          今天
│   └── control_bot_command.py                     今天
└── tests/                 6 個新測試檔案，共 46 條
```

### 建 bot 與拿 chat id

跟 `@BotFather` 對話建一個 bot，它會給一組 token。然後對自己的 bot 說一句話，用 token 讀一次 `getUpdates`，回應裡的 `message.chat.id` 就是 chat id：

```bash
uv sync
curl -s "https://api.telegram.org/bot<TOKEN>/getUpdates" | python3 -m json.tool
```

兩個值寫進 `.env`，它在 `.gitignore` 裡：

```
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
```

順帶把資料補到最新，因為接下來的心跳會報告權益：

```bash
docker compose -f docker/docker-compose.yml up -d
uv run python -m quantbot.entrypoints.ingest_pipeline_command
```

### 跑起來

壓制邏輯不需要 token 就看得到——沒設定的話出口會換成終端：

```bash
uv run python -m quantbot.entrypoints.notify_command --level alert --demonstrate-suppression
```

```
出口：終端（沒設定 TELEGRAM_BOT_TOKEN／TELEGRAM_CHAT_ID）
  → 送出：[告警] quantbot 測試通知
這是一則測試。
第 1 次：send——alert 通知
第 2 次：suppressed_duplicate——manual:alert 在冷卻中，還有 900 秒（同一件事只講一次）
第 3 次：suppressed_duplicate——manual:alert 在冷卻中，還有 900 秒（同一件事只講一次）
時窗內已送 1/12 則，追蹤 1 個 key
```

有 token 之後跑控制迴圈，然後從手機下指令：

```bash
uv run python -m quantbot.entrypoints.control_bot_command
```

`/status` 會回目前模式與**交易所那邊**的部位，`/pause` 之後 `/status` 會顯示 `paused`。用另一個 Telegram 帳號下 `/pause` 的話，主帳號會收到一則告警。

### 驗收標準

八項全過才算完成：

1. `uv run pytest` 全綠（593 passed）。
2. **同一個問題在冷卻期內只講一次**，而告警的冷卻比事件長，有測試釘住。
3. **預算是滑動的**，時窗邊界不會放兩倍的量過去，有測試釘住。
4. **被壓掉的通知不佔用預算**，有測試釘住。
5. **一則沒有 dedupe_key 的通知建不出來。**
6. **停損是事件不是告警**，有測試釘住——這一條是分界線的實例。
7. **未授權的指令不執行、而且會告警**，有測試釘住；白名單為空時建構就失敗。
8. `uv run mypy quantbot` 與 `uv run lint-imports` 全過（296 檔，3 條契約）。

第 6 與第 7 項是今天最值得留著的兩條。前者決定這套通知半年後還有沒有人在看，後者決定一個拿到 token 的陌生人能不能平掉我們的部位。

> 免責聲明：本文為程式與資料工程的技術分享，所有程式碼與數字皆為教學範例，不構成投資建議。實單前一律先在 testnet 驗過。

## 明天

通知與控制都接好之後，回頭處理一個從 Day 05 就留在那裡的尾巴：**遞迴指標算不快。**

EMA 與 RSI 的 Wilder 平滑沒辦法向量化，因為每一根都依賴前一根的結果。Day 05 用 `ewm()` 繞過去了，但 Day 14 那個 Volume Profile 的距離特徵沒有這種好運——它每一根都要重算一次分布，是目前唯一不能向量化的特徵。

明天先量測再優化：用 `cProfile` 找出真正的熱點，而通常會發現想像中的熱點不是熱點。然後用 Numba 把那幾個迴圈編譯掉，並且驗**數值完全一致**——一個快但答案不一樣的指標比慢的那個糟得多。

## Reference

- [`sendMessage` 的參數，以及 `disable_notification` 怎麼讓非緊急訊息不震動手機 — Telegram Bot API, sendMessage](https://core.telegram.org/bots/api#sendmessage)
- [`getUpdates` 的 offset 語意：只有收到更大的 offset 才會確認並刪除更早的 update — Telegram Bot API, getUpdates](https://core.telegram.org/bots/api#getupdates)
- [同一個 chat 每秒約 1 則、整個 bot 每秒約 30 則的限制 — Telegram Bot API, Broadcasting to Users](https://core.telegram.org/bots/faq#broadcasting-to-users)
- [`raise ... from None` 會切斷例外鏈，這裡用來避免把含 token 的 URL 一起帶上去 — Python documentation, The raise statement](https://docs.python.org/3/reference/simple_stmts.html#the-raise-statement)
- [`collections.deque` 從左端 popleft 是 O(1)，滑動時窗計數靠它 — Python documentation, `collections`](https://docs.python.org/3/library/collections.html#collections.deque)
