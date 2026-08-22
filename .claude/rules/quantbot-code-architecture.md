# 量化交易系列的程式碼架構規範

適用範圍：iThome 2026 量化交易系列（`src/content/blogs/ithome/2026-02/**`）文章裡的所有 Python 程式碼。

## 0. 唯一真相來源是實作專案

這個系列的程式碼有一個真實的實作專案：

**`/Users/james/workspace/SideProjects/quantbot`**（架構與命名規範見該專案的 `CLAUDE.md`）

- 撰寫或修改文章裡的程式碼前，**MUST** 先讀該專案的 `CLAUDE.md`，並視情況讀相關實作檔。
- **文章的類別名、模組路徑、依賴方向、命名 MUST 與該專案一致。** 一邊改了另一邊要跟著改，NEVER 讓文章與實作漂移。
- 文章需要新的類別時，命名與擺放位置照該專案的分層決定，不要在文章裡自創一套。
- 技術選型也以該專案為準（目前：Python 3.14、uv、pandas 3.x、**httpx**（NEVER aiohttp）、ccxt、asyncpg、plotly、numba、pytest ＋ pytest-asyncio、ruff）。**NEVER 引入 structlog**——Day 28 評估過，一行 JSON 用 `json.dumps` 就夠，而它最有價值的 context binding 在這個專案裡已經由 `DecisionRecord` 承擔。

以下是文章撰寫時最常踩到的部分，完整規範仍以該專案的 `CLAUDE.md` 為準。

## 1. 分層與依賴方向

```
Entrypoint ───▶ Application ───▶ Domain ◀─── Infrastructure
(CLI/組裝根)     (use cases)      (核心)      (Source/Repository/Parser/Renderer)
                                    ▲
                    quantbot/domain/interfaces/ 一檔一 Protocol
```

- **依賴方向一律指向 domain。** domain **NEVER** import 其他層，也不認識 httpx、ccxt、asyncpg、plotly。
- 文章裡的程式碼區塊 **MUST 在開頭用註解標出檔案路徑**（例：`# quantbot/domain/services/backfill_planning_service.py`），讀者才看得出這段屬於哪一層。
- **Application 只認介面**，具體實作在 `entrypoints/` 組裝。文章 NEVER 出現「orchestrator 自己 `new` 一個 infrastructure 類別」的寫法——那是這個系列前一版的主要缺陷。
- **Domain Service 不吃 I/O 介面**：它只吃手上的資料、回傳值，所以測試不需要任何替身。要 I/O 的編排屬於 application。

## 2. 介面：Protocol 與 ABC 的分工

| 機制 | 用在哪 |
| :--- | :--- |
| `typing.Protocol`（結構型，等同 Go 的隱式介面） | **所有對外相依**：`CandleSource`、`CandleRepository`、`CandleParser`、`ReferencePriceSource`、`Clock`、`Sleeper`、`OrderGateway`、`NotificationSink`、`ControlCommandSource`、`Feature`、`PositionSizer`、`DecisionJournalRepository` |
| `abc.ABC` ＋ `@abstractmethod`（名義型，可帶共用實作） | 同一家族共用骨架：`Indicator` 與 `Condition`（本系列的兩個 ABC 家族） |

- 對外介面 **MUST** 是 `Protocol`，住在 `domain/interfaces/`，一檔一個。
- **NEVER** 用 `@runtime_checkable` ＋ `isinstance` 驗介面（只比對方法名，是假的安全感）；相容性交給 `mypy`。
- 文章要說明 Protocol 的重點：**實作不 import 介面**，所以依賴箭頭真的是向內的。

## 3. 命名

- **介面用能力名、不加 `I` 前綴**（Python 慣例是 `Iterable` 不是 `IIterable`）；**實作帶技術／來源前綴**：`CandleSource` → `BinanceArchiveCandleSource`、`BinanceRestCandleSource`。
- 角色後綴只有八種：`Service`（domain）、`Application`（用例）、`Repository`、`Source`、`Parser`、`Renderer`、`Guard`、`Gateway`。**NEVER** 出現 `Manager` / `Handler` / `Helper` / `Utils` / `Processor`。
  - `Gateway` 是 Day 23 加進來的第八種：**會改變外部世界狀態的雙向通道**（下單、查單、對帳）。前七種都是唯讀或本地的動作，而下單改完之後沒有 undo。目前只有 `BinanceOrderGateway`（實作 `OrderGateway`）。
- **禁止英文單字的縮寫**：`specification` 不寫 `spec`、`candles` 不寫 `df`、`relative_difference` 不寫 `rel_diff`、`configuration` 不寫 `cfg`、`directory` 不寫 `dir`、`semaphore` 不寫 `sem`。
- **領域縮寫與業界標準縮寫保留**（它們是正式用語，不是省字）：`OHLCV`、`SMA`、`EMA`、`RSI`、`UTC`、`CSV`、`URL`、`REST`、`API`、`SQL`、`DTO`、`DSN`、`HTTP`。可以直接當類別名（`SMA`、`RSI`）。
- 檔名 snake_case 且對齊主要型別：`timescale_candle_repository.py`。

## 4. 資料形狀

- `values/`：frozen dataclass 或 StrEnum，不可變、無 I/O。
- `entities/`：充血類別（`CandleSeries` 包住 `DataFrame`，行為掛它自己的方法上）。
- `dto/`：**只有報告類**用 `Dto` 後綴。行情資料 NEVER 轉 DTO——它以 `CandleSeries` 跨層。
- 行情與指標路徑用 `float64`；**帳務與下單數量（Day 23 之後）用 `Decimal`**，DB 對應 `NUMERIC`。轉換只在 infrastructure 的邊界發生，而且收回來的數字一律 `Decimal(str(value))`——`Decimal(0.1)` 會把 float 的二進位誤差一起帶進帳裡。
- 時間一律 tz-aware UTC，語意固定是**開盤時間**。
- **「現在幾點」是注入的能力**：需要當下時間就收 `Clock` 或 `now` 參數，domain／application 內 NEVER 直接呼叫 `pd.Timestamp.now()`。

## 5. 行為擺放（沿用原第 12 節）

- 交付物級別的程式碼一律收進類別，**NEVER** 攤成一串模組層級函式加模組層級常數。
- 計算行為掛在物件的方法上；跨多個物件的運算放 Domain Service。
- 例外只有四種：`entrypoints/` 的 `main()`、pytest 測試與其 helper、刻意示範錯誤寫法的對照程式碼（如 Day 04 的 `sma_loop`）、以及 `@njit` 的核心（Numba 編譯不了 `self`，見 Day 26）。第四種的界線是它必須是私有的，唯一入口是包住它的那個類別。
- 共用常數用 `ClassVar` ＋ 不可變型別；禁止可變預設參數；禁止先宣告後賦值。

## 6. 撰寫時的自我驗證

寫完該篇的程式碼後 **MUST** 自己驗一次，不要只靠讀：

1. 把文章裡的 python 區塊抽出來拼成模組，`py_compile` 全過（`>>>` doctest 與刻意的片段除外）。
2. 對關鍵轉換跑小型 smoke test：欄位對映、時間戳單位、去重、缺漏偵測、路由切段、清洗旗標。
3. 有測試區塊的篇章，把測試實際跑起來（外部套件用替身模組跳過）。
4. 檢查依賴方向：domain 的區塊裡不應該出現 httpx／ccxt／asyncpg／plotly 的 import。
5. 檢查跨篇一致性：同一個概念在各篇 MUST 是同一個類別名（例：缺漏偵測只有 `DataIntegrityService`，NEVER 一篇 `GapReport` 一篇 `GapFinder`）。
