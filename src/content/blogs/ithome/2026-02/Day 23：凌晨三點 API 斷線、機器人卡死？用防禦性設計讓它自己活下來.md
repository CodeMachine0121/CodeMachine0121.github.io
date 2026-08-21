---
title: "Day 23：凌晨三點 API 斷線、機器人卡死？用防禦性設計讓它自己活下來"
datetime: "2026-10-07"
description: "交易程式的失敗不是一種，是四種，而每一種對應的處理方式都不同。這篇把失敗分類做成型別，示範為什麼「送出去了但不知道結果」是唯一不能重送的失敗，並用一組實跑的軌跡對照七種處境。順帶記錄一條測試抓到的缺陷：號稱上限 4 秒的退避實測最大 4.998 秒。"
image: ""
parent: "2026 ithome-鐵人賽: 工程師的量化交易入門：從 K 線到可組合的交易策略引擎 系列"
draft: true
---

## 第四階段的第一個問題不是策略

第三階段結束時手上有一套能表達策略、驗證策略、並且判斷驗證結果可不可信的工具。它到目前為止只做過一件事：讀歷史資料，算出一條權益曲線。

把同一套東西掛上去連著真的交易所跑，第一個遇到的問題跟策略無關。它長這樣：凌晨三點，機器人送出一張市價單，請求逾時。程式醒著，行情還在進來，那張單的結果不知道。

這時候有兩個選項，而選錯的代價不對稱。重送一次：如果原本那張其實成交了，現在部位變兩倍。不重送：如果原本那張沒成交，訊號就這樣漏掉了。

今天整天在處理這一類的選擇。它們的共同形狀是：**平常跑不到，所以永遠沒有被檢查過。**

## 交易概念補課：狀態不一致比停機更糟

一般的服務掛掉，最壞的情況是使用者看到 500。交易程式掛掉，最壞的情況不是掛掉本身。

停機的時候我們知道自己什麼都沒做，手上的部位就是停機前的那個部位，重開之後照著處理。這個處境很清楚。

**狀態不一致沒有這個好處。** 以為空手所以又進場一次，結果部位變兩倍；以為有部位所以送出平倉單，結果開了一個反向的新部位。這兩種錯誤都不會有任何錯誤訊息，帳戶會照著錯的前提繼續運作，而發現的時機通常是幾天後看報表覺得數字怪。

所以這一天所有設計指向同一個結論：**不確定的時候停手，並且讓人知道。** 一個停在那裡吵著要人看的機器人，比一個自己猜完繼續跑的機器人安全得多。

## 失敗不是一種，是四種

`except Exception: pass` 的問題不是它太寬。它的問題是把四種完全不同的處境壓成同一種，於是最危險的那一種變成看不見的。

```python
# quantbot/domain/values/failure_kind.py
class FailureKind(StrEnum):
    """一次失敗屬於哪一類。分類決定處理方式，所以它必須先於處理存在。

    - TRANSIENT：網路抖一下、交易所回 5xx。重送就好，退避一下再送。
    - RATE_LIMITED：被限流。也可以重送，但退避要長得多，而且**再密集重試會讓
      封鎖時間變長**，所以它跟 TRANSIENT 不能共用同一組退避參數。
    - PERMANENT：餘額不足、數量小於最小下單量、簽章錯誤。重送一百次也是同樣的
      結果，唯一該做的是停下來告警。把它當 TRANSIENT 處理的下場是打爆對方的 API。
    - AMBIGUOUS：送出去了，但不知道結果（逾時、連線在回應前斷掉）。**它 NEVER
      能靠重送解決**——重送在「其實已經成交」的那一半機率裡會建出第二個部位。
      唯一正確的動作是用同一個 client_order_id 去查單。
    """
```

分類本身是 infrastructure 的工作，因為只有它認識 ccxt 的例外型別；分類的**結果**屬於 domain，因為「哪一種失敗該重送」是領域規則。這條線劃對了，用例層才能在完全不 import ccxt 的情況下處理失敗。

負責換這個形狀的是一個 Parser：

```python
# quantbot/infrastructure/binance/binance_failure_parser.py
    def classify(self, failure: BaseException) -> FailureKind:
        import ccxt.async_support as ccxt

        if isinstance(failure, ccxt.RequestTimeout):
            return FailureKind.AMBIGUOUS
        if isinstance(failure, ccxt.DDoSProtection | ccxt.RateLimitExceeded):
            return FailureKind.RATE_LIMITED
        if isinstance(failure, ccxt.OnMaintenance | ccxt.ExchangeNotAvailable):
            return FailureKind.TRANSIENT
        if isinstance(failure, ccxt.NetworkError):
            # 連不上（DNS、TCP 被拒）代表請求沒有送出去，所以重送是安全的。
            return FailureKind.TRANSIENT
        if isinstance(failure, ccxt.ExchangeError):
            return FailureKind.PERMANENT
        return FailureKind.AMBIGUOUS
```

三個判斷的順序不能換，而每一個都對應一個具體的錯誤：

**逾時是 AMBIGUOUS，不是 TRANSIENT。** ccxt 的 `RequestTimeout` 繼承 `NetworkError`，所以先比對 `NetworkError` 的寫法會把逾時歸成「重送就好」。那正是重複下單最常見的來源。逾時的語意是「請求送出去了，回應沒回來」——那張單可能已經在交易所的簿子上。

**限流要單獨一類。** `DDoSProtection` 與 `RateLimitExceeded` 也繼承 `NetworkError`，但它們的退避參數要長得多。被限流之後繼續密集重試會讓封鎖時間變長，所以拿 5xx 的那組參數去處理它是在延長自己的封鎖。

**未知的例外歸 AMBIGUOUS，不是 PERMANENT。** 這一條是最後那個 `return`，也就是預設值，而預設值要選安全的那一邊。不知道發生什麼事的時候，「先去查單」最壞只是白查一次；「重送」與「當作失敗就算了」都可能造成部位錯誤。

## 冪等性：同一個 id 送兩次不會有兩張單

重送之所以能是一個安全的動作，靠的是交易所提供的去重機制。Binance 用 `newClientOrderId` 去重：同一個 id 送兩次，第二次不會建出第二張單。

```python
# quantbot/domain/values/order_intent.py
@dataclass(frozen=True)
class OrderIntent:
    """要送出去的一張市價單。

    **client_order_id 是必填的，而它就是冪等性。** 交易所用它去重：同一個 id
    送兩次，第二次不會建出第二張單。所以「重送」在有 id 的情況下是安全的動作，
    而在沒有 id 的情況下是災難——後者只能靠「猜前一次到底送到了沒」，而那個猜
    在網路逾時的情況下有一半機率是錯的。

    id 由呼叫端給而不是這裡生成（沒有 `uuid4()` 預設值），因為預設值會讓每次
    建構都得到一個新 id，於是重試時建出來的第二個 intent 帶著不同的 id——
    冪等性就這樣安靜地失效了。要生成 id 的地方是 entrypoint，只有一次。
    """

    client_order_id: str
    listing: Listing
    side: OrderSide
    quantity: Decimal
```

「不給 `uuid4()` 當預設值」這個決定值得停一下。`client_order_id: str = field(default_factory=lambda: uuid4().hex)` 讀起來很順，也省掉呼叫端一行程式碼，而它會讓整套重試設計失效——重試迴圈每一圈重建一次 intent 的話，每一圈都是一個新 id，交易所看到的是三張不同的單。

這種錯誤在測試以外的地方看不出來，因為交易所會照樣收單，只是收三張。所以測試裡有一條斷言專門釘它：

```python
# tests/application/test_place_order_application.py
    report = await build_application(gateway, sleeper=sleeper).run(INTENT)

    assert report.attempt_count == 3
    submitted = [call.args[0].client_order_id for call in gateway.place.await_args_list]
    assert submitted == [INTENT.client_order_id] * 3
```

## 退避與抖動，以及一條測試抓到的缺陷

退避要指數成長，理由不是禮貌而是同步化。固定間隔的重試會讓所有失敗的請求在同一個時刻一起回來，於是剛恢復的服務被打回去，下一輪又是一樣的節奏。指數成長把重試拉開，抖動把「一起回來」這件事打散。

```python
# quantbot/domain/values/retry_policy.py
    def delay_for(
        self, kind: FailureKind, attempt: int, *, jitter_fraction: float
    ) -> float:
        ...
        base = (
            self.rate_limited_base_delay_seconds
            if kind is FailureKind.RATE_LIMITED
            else self.base_delay_seconds
        )
        # 先成長、再夾上限、最後才往下抖動。抖動只往下扣，所以夾完的上限
        # 之後不會被推翻——「最多等 30 秒」是真的最多 30 秒。
        grown = min(base * 2.0 ** (attempt - 1), self.maximum_delay_seconds)
        return grown * (1.0 - self.jitter_ratio * jitter_fraction)
```

這裡有兩個決定。

**隨機數是參數，不是在裡面取的。** `delay_for()` 收一個 `[0, 1)` 的 `jitter_fraction`，所以退避時間是一個可以用一張表測完的純函式。時間是注入的能力這條規矩從 Day 03 就定了，隨機性是同一條規矩的另一半。抖動如果在裡面取隨機數，這個方法就只能用區間斷言測，而區間斷言測不出「上限有沒有生效」這種真正會錯的地方。

**抖動只往下扣。** 這一條是寫測試的時候改的。原本的版本是「乘上 1 ± jitter_ratio」，看起來對稱又合理，而這條斷言直接把它打掉：

```python
# tests/domain/values/test_retry_policy.py
def test_jitter_never_pushes_the_delay_past_the_ceiling():
    """抖動只往下扣，所以上限是真的上限。

    原本寫成「乘上 1 ± 0.25」，這條斷言實測最大值 4.998 秒——於是「上限 4 秒」
    只是一個大概的說法。改成只往下扣之後它才成立。
    """
```

號稱上限 4 秒、實測 4.998 秒。差 25% 在退避上沒什麼影響，但這個欄位叫 `maximum_delay_seconds`，而一個名字叫 maximum 的東西擋不住 25% 的超額就是壞的。往上抖動本來也沒有用途：抖動的目的是把重試打散，不是等更久。

## 決定與執行分開

重試邏輯之所以會寫錯，不是因為 `try` 難寫，是因為那段判斷平常跑不到。把它抽成一個吃兩個列舉、回一個決定的純函式之後，它就能被列完並測完：

```python
# quantbot/domain/services/execution_retry_service.py
    def decide(
        self,
        kind: FailureKind,
        attempt: int,
        policy: RetryPolicy,
        *,
        jitter_fraction: float = 0.5,
    ) -> RetryDecision:
        if kind.needs_confirmation:
            # 這一條先於次數判斷，而順序是刻意的：回報遺失 NEVER 靠重送解決，
            # 所以「還有兩次機會」在這裡完全不相關。
            return RetryDecision(
                action=RetryAction.CONFIRM,
                delay_seconds=0.0,
                reason=(
                    "送出去了但不知道結果："
                    "用同一個 client_order_id 查單，NEVER 重送"
                ),
            )
        ...
```

它不 sleep、不重送、不知道 gateway 存在。等待與重送是用例的事，這裡只負責決定。於是十種情況一張表就測完了——四種分類乘上「還有沒有次數」，一個都跑不掉：

| 失敗分類 | 還有次數 | 決定 |
|---|---|---|
| TRANSIENT | 有 | 退避後重送 |
| TRANSIENT | 沒有 | 停手告警 |
| RATE_LIMITED | 有 | 退避（起點長得多）後重送 |
| RATE_LIMITED | 沒有 | 停手告警 |
| PERMANENT | 有 | 停手告警（不浪費次數） |
| PERMANENT | 沒有 | 停手告警 |
| AMBIGUOUS | 有 | 查單 |
| AMBIGUOUS | 沒有 | 查單（次數在這裡不相關） |

最後一列是這張表最重要的一列。回報遺失的時候「還剩幾次機會」完全不相關，因為重送這個動作本身就是錯的，做幾次都一樣。

`RetryDecision` 順手把一件事寫進型別裡：只有 `RETRY` 可以帶等待時間。一個帶著 2 秒延遲的 `GIVE_UP` 是語意矛盾，而它在建構時就會失敗。

## 回報遺失是唯一不能重送的失敗

這是整個用例最重要的十幾行：

```python
# quantbot/application/place_order_application.py
                if decision.action is RetryAction.CONFIRM:
                    confirmed = await self._gateway.fetch_order(
                        intent.listing, intent.client_order_id
                    )
                    if confirmed is not None:
                        # 查到了：那張單存在，結果就是這個。**NEVER 再送一次。**
                        self._breaker.record_success()
                        notes.append("查單查到了，用查到的結果，沒有重送")
                        return OrderPlacementReportDto(...)
                    # 查不到就是交易所沒收到，這時候重送才是安全的。查單的價值就在
                    # 這裡：它把一個「不知道」變成一個確定的答案，而確定之後才有
                    # 正確的下一步。
                    notes.append("查單查不到：交易所沒收到，可以重送")
```

查單要用 `client_order_id` 而不是交易所的 order id，理由很直接：**逾時的時候我們根本沒拿到交易所的 id。** 自己給的那個 id 是唯一一個在所有狀態下都存在的鍵，所以下單與查單都以它為鍵。

這也是為什麼「查不到」是回傳 `None` 而不是丟例外。查不到是一個有意義的答案：交易所沒收到那張單，於是重送是安全的。把它做成例外會讓呼叫端在 `except` 區塊裡臨場決定要怎麼辦，而那正是凌晨三點會做錯的決定。

## 實測：七種處境的軌跡

用腳本化的失敗序列跑同一個用例（不連交易所，失敗分類直接餵進去），把七種處境各跑一次。退避的隨機種子固定，所以等待秒數可以重現：

| 處境 | 送出次數 | 查單次數 | 等待秒數 | 結果 |
|---|---|---|---|---|
| 兩次 5xx 之後成功 | 3 | 0 | 0.471, 0.793 | filled |
| 被限流一次之後成功 | 2 | 0 | 4.714 | filled |
| 回報遺失，查單查到了 | **1** | 1 | —— | filled（由查單確認） |
| 回報遺失，查單查不到 | 2 | 1 | —— | filled |
| 餘額不足 | **1** | 0 | —— | 停止交易 |
| 一直失敗，次數用完 | 4 | 0 | 0.471, 0.793, 1.962 | 停止交易 |
| 一直失敗，斷路器先跳開 | **2** | 0 | 0.471 | 停止交易 |

七列裡有四個數字值得指出來。

**限流那一列等了 4.714 秒，5xx 那一列等 0.471 秒，差十倍。** 這就是兩者不共用退避參數的實際效果。

**回報遺失那一列送出次數是 1。** 這是整天的重點：那張單只被送出去一次，結果是靠查單問出來的。原始輸出裡的那兩行說明了經過：

```
  送出次數  1（累計等待 0.00 秒）
  結果由查單確認，而不是由送單的回應確認
  · 第 1 次：scripted ambiguous → 送出去了但不知道結果：用同一個 client_order_id 查單，NEVER 重送
  · 查單查到了，用查到的結果，沒有重送
```

**餘額不足那一列也是 1。** `PERMANENT` 沒有浪費任何一次重試機會。設定的上限是四次，如果它被當成 TRANSIENT 處理，這裡會是四次徒勞的請求，而餘額在那四次之間不會變多。

**斷路器那一列只送了 2 次，比次數上限 4 還少。** 那是下一節的主題。

七種處境裡，送出去的 `client_order_id` 全部只有一個值。

## 斷路器：一連串失敗跟一次失敗不是同一件事

重試處理的是**一次**動作的失敗，斷路器處理的是**一連串**動作都在失敗。兩者的正確反應相反：前者是等一下再試，後者是停手。

```python
# quantbot/domain/entities/circuit_breaker.py
class CircuitBreaker:
    """連續失敗到一定次數就停止交易，冷卻之後放一張單試水溫。

    它是 OrderBook 之後第二個**有狀態**的 entity，而狀態就是兩個欄位：連續失敗
    次數與跳開的時刻。狀態本身（CLOSED／OPEN／HALF_OPEN）是**推導**出來的而不是
    存下來的，因為它隨時間變化——冷卻時間到了就該是 HALF_OPEN，而沒有人會在那個
    時刻剛好呼叫一次「更新狀態」。存一個會過期的欄位，就得有人負責讓它不過期。

    **最重要的一點：它管的是「送不送單」，不是「程式要不要活著」。** 跳開之後
    程式繼續跑、繼續收行情、繼續告警，只是不下單。整個程式掛掉會讓手上的部位
    沒有人看管，而那比停止交易糟得多。
    """
```

連續三次失敗會跳開，而那個「連續」有一條測試在守：中間成功過一次就要歸零。累積三次總失敗就停手的機器人，跑一個月一定會停在某個沒事的下午。

冷卻結束之後進 `HALF_OPEN`，放一張單過去試水溫。成功回 `CLOSED`，失敗**立刻**回 `OPEN`：

```python
# quantbot/domain/entities/circuit_breaker.py
    def record_failure(self, now: pd.Timestamp) -> CircuitState:
        """記一次失敗，回傳記完之後的狀態。

        HALF_OPEN 時失敗要**立刻**回到 OPEN，而不是再累積到門檻——試水溫的那一張
        單就是為了回答「好了沒」，它失敗了就是還沒好。從頭累積門檻的寫法會讓
        一個持續故障的交易所每隔 recovery_seconds 就被打 failure_threshold 次。
        """
```

為什麼要有 `HALF_OPEN` 這個中間狀態，而不是冷卻結束就直接回 `CLOSED`：交易所大規模故障恢復的那一刻，直接回 `CLOSED` 會讓所有排隊的動作一次全送出去。那是壓垮剛恢復的服務、也是把自己的 IP 送進封鎖名單最快的方法。

三個狀態的每一次轉換都收一個 `now` 參數，所以冷卻 60 秒的行為在測試裡不用等 60 秒。時間是注入的能力這條規矩，在這裡換到的東西很具體。

## 啟動時對帳，以交易所為準

本地狀態在對帳完成之前只是**上一次程式活著時的記憶**。而那段記憶跟現在之間可能發生過任何事：程式被 SIGKILL 砍掉、機器重開、有人手動下了單、或者某一次重送其實成功了兩次。

「以交易所為準」是對的，但它不等於「無條件自動接手」：

```python
# quantbot/domain/services/position_reconciliation_service.py
    """啟動時比對本地記的部位與交易所實際的部位，並決定能不能開始交易。

    - 一致（差在容差內）→ MATCHED。
    - 本地有、交易所沒有 → ADOPTED。我們的紀錄過期了，而正確的狀態是空手；
      接受它是安全的，因為空手不需要管理。
    - 兩邊都有、交易所比較少 → ADOPTED。這是部分成交或部分平倉的正常結果。
    - 交易所比本地多（含「本地空手但交易所有部位」）→ HALTED。多出來的那個部位
      是一段我們不知道的歷史：上一輪跑到一半被砍掉、有人手動下單、或者某一次
      重送其實成功了兩次。自動接手它等於替一個我們不理解的處境做決定，而它的
      停損規則、進場理由、預期持有期我們一個都不知道。停下來問人才是對的。
    """
```

差異的正負號是「交易所減本地」，所以它讀起來就是「多了還是少了」，而多出來的那一邊才是危險的。方向相反（本地做多、交易所做空）也是 `HALTED`，那是最不該自己處理的一種。

兩個實作細節：

**容差不能是零。** 交易所的最小交易單位、以及手續費用幣別扣抵，都會讓餘額留下尾數。用「完全相等」判斷的話每次啟動都會對不上。容差是參數而不是常數，因為不同交易對的最小單位差幾個數量級。

**整份報告取最保守的那一列。** 對帳不是投票——只要有一個交易對停不下來的問題，整台機器人就不該開始交易。

還有一件屬於現貨的事要講清楚：**現貨沒有「部位」這個欄位可以查，它只有餘額。** 帳戶裡有 0.002 顆 BTC 就是 0.002 的多頭部位，而那個數字裡也包含手動買的幣與空投拿到的幣。這件事寫在型別的說明裡而不是留在某個實作的註解裡，因為它會影響對帳的判讀。

## 第八種角色後綴

這個專案原本只有七種角色後綴：`Service`、`Application`、`Repository`、`Source`、`Parser`、`Renderer`、`Guard`。下單這件事七種都放不進去。

`Source` 是把外部資料拉進來，`Repository` 是存進自己的資料庫，`Parser` 是換一個形狀，`Renderer` 是輸出，`Guard` 是保護——五個都是唯讀或本地的動作。下單不是：它**改變外部世界的狀態**，而且改完之後沒有 undo。

```python
# quantbot/domain/interfaces/order_gateway.py
class OrderGateway(Protocol):
    """對交易所的下單與查詢通道。

    三個方法對應三件不同的事，而它們的失敗處理完全不同：

    - place：唯一會改變狀態的方法。失敗時丟 GatewayError，分類決定要重送、
      要查單、還是要停手。
    - fetch_order：**回報遺失時唯一安全的動作。** 用 client_order_id 查，
      所以它在「送出去了但不知道結果」的狀態下也問得到答案。
    - fetch_positions：對帳用。交易所是部位的唯一事實來源，本地狀態只是快取。
    """
```

例外型別也住在 `domain/interfaces/`，而那不是隨手放的：**例外型別是介面契約的一部分。** 呼叫端要處理失敗，就得知道失敗長什麼樣子。如果通道丟的是 ccxt 的例外，那麼用例層就得 import ccxt 才寫得出 `except`——依賴方向當場反了。

## float 與 Decimal 的界線第一次真的落地

Day 19 的成本模型用 `float64`，理由是權益曲線是統計量不是帳本。今天是這條界線第一次跨過去：

```python
# quantbot/infrastructure/binance/binance_order_gateway.py
    @staticmethod
    def _to_decimal(value: object) -> Decimal:
        """交易所回來的數字一律先變字串再進 Decimal。

        Decimal(0.1) 會得到 0.1000000000000000055511151231257827021181583404541015625，
        因為那是 float 0.1 的真值。Decimal("0.1") 才是 0.1。這一行是 float 與
        Decimal 界線上最容易漏掉的地方，而漏掉之後帳會慢慢對不起來。
        """
        return Decimal(str(value if value is not None else 0))
```

轉換只發生在這一個邊界，而且是單向的：送出去的數量轉成 `float`（ccxt 的介面收 float），收回來的一律用 `str` 轉回 `Decimal`。下單數量差一個最小單位會被交易所以精度錯誤退回，而那是 `PERMANENT` 失敗——退避重試一百次也是同樣的結果。

## 順帶回收 Day 09 的一個伏筆

失敗清單裡有一項還沒提：**WebSocket 靜默斷線**，也就是沒有錯誤、但也沒有資料。

這一項在 Day 09 就處理掉了，而處理方式是「不自己處理」：

```python
# quantbot/infrastructure/binance/binance_websocket_message_source.py
    """一條會自己重連的 WebSocket 連線，吐出原始的文字訊息。

    心跳不必自己處理：websockets 這個套件預設每 20 秒送一次 ping，對方沒回就
    主動關閉連線，而關閉會讓下面的 async for 結束、外層迴圈重連。自己實作 ping
    只會多一份要維護的計時器。
    """
```

靜默斷線之所以危險，是因為它在應用層完全看不出來——`async for` 只是不再產出東西，而沒有任何例外會被丟出來。要偵測它只有兩條路：自己記「最後一筆資料是什麼時候來的」，或者依賴傳輸層的心跳。後者已經在套件裡而且是預設開的，所以正確的做法是知道它在那裡，而不是再寫一個。

## 今日交付物

```
quantbot/
├── domain/
│   ├── values/            OrderSide, OrderState, OrderIntent, OrderReceipt,
│   │                      FailureKind, RetryPolicy, RetryAction, RetryDecision,
│   │                      CircuitState, PositionState, PositionDifference,
│   │                      ReconciliationVerdict
│   ├── entities/circuit_breaker.py          今天：第二個有狀態的 entity
│   ├── interfaces/        OrderGateway（第八種角色後綴）, Sleeper, GatewayError
│   ├── services/          execution_retry_service.py
│   │                      position_reconciliation_service.py
│   └── dto/               order_placement_report.py, reconciliation_report.py
├── application/
│   ├── place_order_application.py           今天
│   ├── reconcile_positions_application.py   今天
│   └── execution_halted_error.py            今天
├── infrastructure/
│   ├── binance/binance_order_gateway.py     今天
│   ├── binance/binance_failure_parser.py    今天
│   ├── asyncio_sleeper.py                   今天
│   └── reporting/text_reconciliation_report_renderer.py   今天
├── entrypoints/place_order_command.py       今天
└── tests/                 7 個新測試檔案，共 72 條
```

### 先把環境與資料備好

下單指令不需要行情資料，但接下來幾天的風控與監控都要，所以照慣例先把管線補到最新：

```bash
uv sync
docker compose -f docker/docker-compose.yml up -d
uv run python -m quantbot.entrypoints.ingest_pipeline_command
```

`.env` 需要 testnet 的金鑰。權限只開「讀取 ＋ 現貨交易」，**NEVER 開提幣**，並且綁 IP 白名單：

```
BINANCE_API_KEY=...
BINANCE_API_SECRET=...
BINANCE_TESTNET=true
```

### 跑起來

預設是乾跑：印出要送什麼、對帳結果、斷路器狀態，一張單都不送。

```bash
uv run python -m quantbot.entrypoints.place_order_command \
    --symbol BTC/USDT --side buy --quantity 0.0002
```

沒設金鑰的時候會看到這個，而它剛好示範了分類的作用：

```
環境：testnet
要送：BUY 0.0002 BTC/USDT（spot，id=quantbot-4bcdfeae9e624c968e28）

對帳失敗（permanent）：查部位失敗：binance requires "apiKey" credential
```

缺金鑰被歸成 `PERMANENT`，所以它不會退避重試四次才放棄，而是立刻停下來。對帳連不上交易所也算「不能交易」——沒有驗證過的本地狀態不該拿來下單。

真的要在 testnet 送單加 `--send`。想看對帳的四種結論，用 `--local-quantity` 假裝本地記了一個不同的數字：

```bash
uv run python -m quantbot.entrypoints.place_order_command --local-quantity 0.5 --send
```

### 驗收標準

八項全過才算完成：

1. `uv run pytest` 全綠（492 passed）。
2. **重試時送出去的 client_order_id 完全相同**，有測試釘住。這是整套設計的地基。
3. **回報遺失時 place 只被呼叫一次、fetch_order 被呼叫一次**，有測試釘住。
4. **查單查不到之後才重送**，有測試釘住——那時候重送是安全的。
5. **PERMANENT 不消耗任何重試次數**，有測試釘住。
6. **抖動之後的等待時間 NEVER 超過設定的上限。** 這一條抓到過一個 4.998 秒。
7. **斷路器在 HALF_OPEN 失敗時立刻回 OPEN**，不是重新累積門檻。
8. `uv run mypy quantbot` 與 `uv run lint-imports` 全過（253 檔，3 條契約）。

第 3 與第 4 項是今天最值得留著的兩條，因為它們守的錯誤在正式環境會直接變成一個多出來的部位。

> 免責聲明：本文為程式與資料工程的技術分享，所有程式碼與數字皆為教學範例，不構成投資建議。實單前一律先在 testnet 驗過，加密貨幣波動劇烈，實際交易請自行評估風險。

## 明天

今天處理的是「這張單送不送得出去」。明天處理的是它前面那個問題：**這張單該下多少錢。**

策略決定買不買，風控決定買多少，而後者對長期結果的影響往往更大。從固定金額到固定比例，到用 ATR 決定停損距離再反推部位（這裡會回收 Day 12 的 ATR），最後是凱利公式——以及它那個致命的假設：**它需要知道真實的勝率與賠率，而那正是我們不知道的東西。**

部位計算會做成跟 Day 16 的條件同樣形式的可插拔積木，因為只有這樣才能公平比較「同一個訊號配不同的下注方式」。

## Reference

- [`newClientOrderId` 是下單去重的鍵，長度上限 36 字元 — Binance Spot API Documentation, New order (TRADE)](https://developers.binance.com/docs/binance-spot-api-docs/rest-api/trading-endpoints)
- [用 `origClientOrderId` 查單，逾時沒拿到交易所 order id 時唯一可用的鍵 — Binance Spot API Documentation, Query order (USER_DATA)](https://developers.binance.com/docs/binance-spot-api-docs/rest-api/trading-endpoints)
- [ccxt 的例外階層，`RequestTimeout` 與 `DDoSProtection` 都繼承 `NetworkError` — ccxt Manual, Error Handling](https://docs.ccxt.com/#/README?id=error-handling)
- [指數退避為什麼要配抖動，以及「一起回來」的同步化問題 — AWS Architecture Blog, Exponential Backoff And Jitter](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/)
- [斷路器的三個狀態與 half-open 試探的用途 — Martin Fowler, CircuitBreaker](https://martinfowler.com/bliki/CircuitBreaker.html)
- [`websockets` 預設每 20 秒送一次 ping，逾時就關閉連線 — websockets documentation, Keepalive and latency](https://websockets.readthedocs.io/en/stable/topics/keepalive.html)
- [`Decimal` 從 float 建構會帶入二進位誤差，從字串才是精確值 — Python documentation, `decimal`](https://docs.python.org/3/library/decimal.html)
