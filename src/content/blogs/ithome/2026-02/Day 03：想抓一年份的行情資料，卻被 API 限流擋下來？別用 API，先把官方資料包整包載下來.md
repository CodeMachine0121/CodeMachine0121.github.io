---
title: "Day 03：想抓一年份的行情資料，卻被 API 限流擋下來？別用 API，先把官方資料包整包載下來"
datetime: "2026-09-17"
description: "大量歷史行情不該用 REST 翻頁抓。這篇先把翻頁次數算一次，再把 data.binance.vision 的批次下載、checksum 驗證、欄位對映與缺口回補寫成一支可重跑的模組，並用 CoinGecko 對照驗證欄位沒接錯。"
image: ""
parent: "2026 ithome-鐵人賽: 工程師的量化交易入門：從 K 線到可組合的交易策略引擎 系列"
draft: false
---

## 一個月不夠用，要的是三年

昨天我們手上多了一張 DataFrame：BTC/USDT 現貨的日線，一個月，存成 parquet，還畫了第一張 K 線圖。那份資料是手動來的——點一個連結、下載一個 zip、解壓、讀進 pandas。看結構夠了，做事不夠。

真正要做的事情規模不一樣。後面幾天要算指標、要驗證特徵有沒有預測力，需要的是**好幾年、分鐘等級**的資料，而且不只一個交易對。這時候多數人的第一個念頭是：那就去打 API 吧，寫個迴圈翻頁，睡一覺起來就抓完了。

這個念頭是今天要處理的第一件事。它不會完全失敗，但它會慢好幾個數量級、會在中途被擋下來、而且會吃掉之後查帳戶跟下單要用的配額。先把數字算一次，要走哪條路的答案就出來了。

## 先算一次：REST 翻頁到底要打幾次

要算之前，得先知道三個限制。這三個是 2026 年中的狀態，這類數字每年都會調整，動工前自己去官方文件確認一次。

**第一，單次上限 1000 根。** Binance 的 K 線端點一次最多回 1000 根，不管要的是 1 分鐘還是 1 天。所以「要幾根」直接決定「要打幾次」。

**第二，每次請求 2 weight。** Binance 不是用「幾次請求」計費，是用 weight。不同端點的 weight 不同，K 線端點是 2。

**第三，每個 IP 每分鐘 2400 weight。** 這是整個 IP 共用的預算，不是每支程式各有一份。超過會收到 429；反覆忽略 429 會升級成 418，也就是 IP 被暫時封鎖，時間從幾分鐘到幾天都有可能。

現在來算。一年的 1 分鐘 K 線是 365 × 1440 = 525,600 根。

| 要抓的東西              | REST 翻頁                                                                  | data.binance.vision 批次         |
|--------------------|--------------------------------------------------------------------------|--------------------------------|
| BTCUSDT 現貨 1 分鐘，一年 | 525,600 ÷ 1000 = 526 次請求、1,052 weight，序列跑約 2 分鐘                          | 12 個月檔（＋12 個 checksum），併發下載十幾秒 |
| 同一年，改成 1 秒 K 線     | 31,536,000 根 = 31,536 次請求、63,072 weight。光是 weight 配額就要 26 分鐘，序列實跑 2 小時起跳 | 一樣 12 個月檔，只是每個檔案大一點            |
| 20 個交易對 × 3 年 1 分鐘 | 31,560 次請求、63,120 weight，同樣是 26 分鐘配額、2 小時實跑                              | 720 個檔案，併發 8 條約 3 分鐘           |
| 中途失敗了              | 要自己記錄翻到第幾頁，沒記就整段重來                                                       | 重下那一個檔案，其他不受影響                 |
| 對其他功能的影響           | weight 整個 IP 共用，帳戶查詢與下單跟它搶同一份                                          | 完全不吃 weight                    |

第一列看起來還好，526 次請求兩分鐘就跑完，這也是為什麼很多人真的就這樣做了。問題在第二、第三列：只要把粒度往下調一格、或者交易對從 1 個變成 20 個，成本就直接跳兩個數量級。而 1 秒 K 線正是 Day 01 挑 Binance 的三個理由之一，遲早會用到。

最後一列常被忽略，但它是實際運作時最麻煩的地方。weight 是 IP 層級的共用預算，回補程式把配額吃光時，同一台機器上查帳戶餘額、查訂單的呼叫也會一起被擋。抓資料把下單流程拖垮，這種因果關係在事後很難查。

### 那 zip 那條路便宜在哪

Binance 有一個官方的公開資料下載站 `data.binance.vision`，把歷史行情預先打包成 zip 放著。它不經過 API 閘道，所以：

- 不計 weight，也沒有每分鐘的請求配額。
- 檔案是壓縮過的 CSV，同樣一個月的 1 分鐘 K 線，壓縮後只有幾 MB；走 REST 拿到的是 JSON 陣列，傳輸量大好幾倍。
- 每個檔案旁邊都有一份官方 SHA-256 checksum，可以驗證下載完整，不必猜是不是傳輸壞掉。
- 檔案是定稿，不會今天抓跟明天抓不一樣。

代價只有一個：**它有延遲**。當日的資料隔天才上傳，月檔要到次月初才會出現。所以最近幾天的資料它沒有。

這就決定了整個設計。

### 三條路徑，各管一段

| 路徑                     | 負責的時間範圍  | 拿什麼       | 代價                   |
|------------------------|----------|-----------|----------------------|
| data.binance.vision 批次 | 從很久以前到前天 | 大量歷史 K 線  | 有上傳延遲                |
| Binance REST（透過 ccxt）  | 最後那幾天的缺口 | 批次還沒上傳的部分 | 吃 weight，要處理翻頁與退避    |
| Binance WebSocket      | 從現在起往後   | 即時串流      | 要自己處理心跳與重連，Day 09 才接 |

今天做前兩條。第三條是 Day 09 的事，但現在就知道它存在，才不會想用 REST 去輪詢即時價格——那是三條路徑裡最貴也最不準的做法。

這條「批次為主、REST 補洞」的分工，也是 Day 01 六條選型原則裡的第四條：歷史批次與即時串流是兩條路徑，分開設計。今天是它第一次真的落地。

## 交易概念補課

今天有四個新名詞。都是工程層面的東西，不需要交易背景。

### 交易對（symbol）

`BTC/USDT` 讀作「用 USDT 買賣 BTC」。斜線左邊是**基礎貨幣**（base），實際在買賣的東西；右邊是**計價貨幣**（quote），用來標價與結算的東西。所以「BTC/USDT 現在 68,000」的意思是一顆 BTC 值 68,000 USDT。

同一顆 BTC 可以有很多交易對：`BTC/USDT`、`BTC/USDC`、`BTC/EUR`。它們的價格接近但不相同，成交量差很多。挑計價貨幣的原則跟挑資料源一樣——挑成交量最大的那個，因為成交越密集，資料越完整。加密貨幣現貨這邊，USDT 交易對通常是量最大的。

寫程式時有一個小地方要注意：**同一個交易對有兩種寫法**。交易所原生的格式沒有斜線，是 `BTCUSDT`，批次檔的網址與檔名用的是這種；ccxt 為了跨交易所統一，用的是有斜線的 `BTC/USDT`。兩邊要轉換，而且轉換要放在同一個地方，不要每支程式各寫一次。

### 現貨與永續合約

這兩個是不同的市場，賣的東西不一樣。

**現貨（spot）** 是一手交錢一手交幣。花 68,000 USDT 買一顆 BTC，那顆 BTC 就真的進到帳戶裡，可以提出去、可以放著不動、可以明年再賣。沒有到期日，沒有槓桿，也不會有人來清算。

**永續合約（perpetual futures）** 買賣的不是幣，是一張「跟著 BTC 價格走」的合約。它沒有到期日（所以叫永續），可以開槓桿，可以直接做空。因為手上沒有真的幣，交易所要靠一個叫**資金費率**的機制，定期在多空雙方之間收付一筆錢，把合約價格拉回現貨附近。

對寫程式的人來說，關鍵差別在於：

|      | 現貨              | 永續合約                  |
|------|-----------------|-----------------------|
| 價格   | 就是成交價           | 貼近現貨但有基差，會偏離          |
| 成交量  | 實際換手的幣量         | 合約張數，跟現貨不可比           |
| 費用   | 手續費             | 手續費＋每 8 小時的資金費率       |
| 資料網址 | `data/spot/...` | `data/futures/um/...` |

Day 01 的第三條選型原則說過：**兩者的資料 NEVER 混用**。今天要補的是它為什麼難發現。把兩邊的收盤價畫在同一張圖上，肉眼幾乎分不出差別，因為永續會被套利拉回現貨附近。差異藏在成交量、藏在極端行情那幾根、藏在資金費率造成的長期偏移，而這些都不是平常會盯著看的東西。

防守方式只有一個，而且要從第一行程式碼就開始：**market 是一個必填參數，不是預設值**。網址前綴不同、檔案分開存、DataFrame 帶一欄 `market`。今天寫的模組會強制這件事。

本系列主線是現貨，所以除非特別標註，出現的都是現貨。

### 限流（rate limit）

前面算過了，這裡補兩個實作上的細節。

Binance 在每個回應的標頭裡附上目前用掉多少：`X-MBX-USED-WEIGHT-1M` 是這一分鐘的累計 weight。這個標頭很有用，因為它讓我們**不必猜**。不用在請求之間硬塞 `sleep(0.5)` 賭它夠慢，而是讀標頭、逼近上限就主動退讓。

另外要區分兩種等待。收到 429 之後的等待是**被動的**，那時候已經超了；讀標頭主動放慢是**預防性的**。兩個都要有，但只靠前者的程式，實際跑起來會一直在 429 邊緣震盪。

### testnet

Binance 提供一個叫 testnet 的環境，網址與正式環境不同、帳戶是假的、錢是假的，但 API 介面一模一樣。可以在上面下單、成交、查帳戶餘額，流程跟正式環境沒有差別。

它的定位要講清楚，不然很容易誤用：

- **歷史行情不從 testnet 拿。** testnet 的成交是測試用戶自己打出來的，深度與價格都不真實。所有市場資料一律來自正式環境的公開端點與批次檔。
- **testnet 是用來練下單流程的。** 簽章對不對、參數格式對不對、被拒單時回什麼錯誤，這些在 testnet 上弄清楚，成本是零。
- **testnet 的 key 跟正式環境的 key 完全分開申請**，互不通用。

順帶一提，今天寫的這支程式**一把 API key 都不需要**。批次檔是公開下載，K 線端點是公開端點，兩者都不用驗證。key 是 Day 23 之後下單才要的。但既然今天第一次提到，安全設定就一次講完，因為那是設定的時候要做對的事，不是事後補得回來的。

## 工程實作

### 今天會長出哪些東西

Day 01 訂的分層與依賴方向今天要真的用上，先看一眼今天會往每一層放什麼：

| 層 | 今天新增 | Day 02 已經有的 |
|---|---|---|
| `domain/values/` | `SourceKind`、`FetchInstruction` | `Market`、`Timeframe`、`TimeRange`、`Instrument`、`CandleColumns` |
| `domain/entities/` | 無 | `CandleSeries` |
| `domain/services/` | `SourceRoutingService`、`DataIntegrityService`、`PriceCrossCheckService` | 無 |
| `domain/interfaces/` | `CandleSource`、`CandleParser`、`ReferencePriceSource`、`Clock` | 無 |
| `infrastructure/binance/` | 網址、下載、限流、REST 翻頁，共五個類別 | `BinanceCandleCsvParser` |
| `application/` | `BackfillCandlesApplication` | 無 |
| `entrypoints/` | `backfill_command.py` | `fetch_candles_command.py` |

昨天寫的東西今天一個字都不用改，這不是巧合：`Timeframe`、`Instrument`、`CandleSeries` 描述的是「K 線是什麼」，而今天處理的是「怎麼把它們弄到手」。兩者本來就該分開，昨天把線劃在那裡，今天就免費得到這個結果。

有三個好處今天就會兌現。**第一**，`market` 是 `Instrument` 的必填列舉欄位，不合法的組合連物件都建不出來。**第二**，「這段時間該有幾根、實際有幾根」全專案只有一份答案（`DataIntegrityService`），Day 08 的管線會拿同一個 service 去盤點資料庫。**第三**，`application` 裡不會出現 Binance 這個字——它只認介面，所以 Day 09 要接 WebSocket、之後要換交易所，改的是 `infrastructure/` 與組裝根那幾行。

### 第一個介面

Day 01 講過對外相依一律用 `typing.Protocol`。今天是第一次真的需要它——因為今天開始有**兩條**取得資料的路徑，而呼叫端不該知道自己拿到的是哪一條：

```python
# quantbot/domain/interfaces/candle_source.py
from typing import Protocol

from quantbot.domain.entities.candle_series import CandleSeries
from quantbot.domain.values.instrument import Instrument
from quantbot.domain.values.time_range import TimeRange


class CandleSource(Protocol):
    """一條行情來源：給我一段區間，還我那段 K 線。

    這是 Protocol 而不是 ABC，所以**實作不需要、也不應該 import 這個檔案**。
    相容性由型別檢查器在組裝的那一點驗證，依賴箭頭因此真的是向內的：
    infrastructure 認識 domain 的形狀，domain 完全不知道 infrastructure 存在。
    """

    async def load(self, instrument: Instrument, period: TimeRange) -> CandleSeries: ...
```

`Protocol` 這個選擇是有後果的，值得再確認一次：**實作不需要 import 這個檔案**。等一下的 `BinanceArchiveCandleSource` 從頭到尾不會提到 `CandleSource`，它只是剛好有一個簽章相容的 `load`。相容性由 `mypy` 在組裝根那一行檢查，那裡是唯一同時看得到介面與實作的地方。

順帶回答一個很自然的疑問：昨天下載月檔就寫在 entrypoint 裡，為什麼今天要抽介面？因為昨天只有一條路徑。**抽象要在第二個實作出現的時候引入，不是在第一個。** 今天有批次與 REST 兩條，而且明天還會有第三條（WebSocket），這時候介面才是省事而不是額外工。

今天還會用到另外三個介面，長相都一樣簡單：`CandleParser`（昨天的 CSV parser 實作的就是它）、`ReferencePriceSource`（對照組）、`Clock`（現在幾點）。最後那個特別值得說一句——Day 01 訂過「現在幾點是注入的能力」，而今天是第一個真的需要它的地方：路由要判斷「哪一段太新、批次檔還沒上傳」，而這個判斷如果偷讀系統時間，就再也寫不出可靠的測試。

### 兩個新的值：路由的產出

```python
# quantbot/domain/values/source_kind.py
from dataclasses import dataclass
from enum import StrEnum

from quantbot.domain.values.time_range import TimeRange


class SourceKind(StrEnum):
    """行情來源的種類。domain 只知道有這幾種，不知道它們各自怎麼實作。"""

    ARCHIVE = "archive"  # 官方預先打包的批次檔
    REST = "rest"  # 交易所的 REST 端點


@dataclass(frozen=True)
class FetchInstruction:
    """「這一段用這條來源取」。路由的產出，取得端的輸入。"""

    source_kind: SourceKind
    period: TimeRange
```

`SourceKind` 是列舉而不是字串，理由跟昨天的 `Market` 一樣：拼錯的來源名稱在建立的那一刻就會失敗。而 `FetchInstruction` 是路由的產出、取得端的輸入——把「哪一段用哪條來源」變成一個值，路由與執行就可以分開測。

### 為什麼用 asyncio 不用 threading

這件事的本質很單純：這支程式絕大部分時間在等網路回應，不是在算東西。720 個檔案的下載，CPU 使用率大概只有個位數百分比。

threading 也能做 I/O 併發，但在這個場景下 asyncio 比較適合：

- 併發數要開到幾十上百時，thread 的建立成本與切換成本不划算，而 coroutine 是普通物件。
- 控併發量的 `asyncio.Semaphore` 跑在單一事件迴圈裡，不需要處理跨執行緒的鎖與競態。
- HTTP 用 `httpx`，同一套 API 同時支援同步與非同步（Day 02 用的 `httpx.get` 就是同步版），而 ccxt 有原生的 async 版本（`ccxt.async_support`）。兩邊都不必為了非同步再學一套新東西。

但有一個地方要小心：**解壓與 pandas 解析是 CPU 使用密集的**，把它們直接寫在 coroutine 裡會阻塞整個事件迴圈，讓其他下載也跟著停住。這段要用 `asyncio.to_thread` 丟出去，後面的程式碼會標出來。

### 批次檔的網址結構

規則很固定：

```
https://data.binance.vision/data/<market>/<period>/klines/<SYMBOL>/<INTERVAL>/<SYMBOL>-<INTERVAL>-<DATE>.zip
```

- `market`：現貨是 `spot`，USDT 保證金永續是 `futures/um`。
- `period`：`monthly` 或 `daily`。
- `SYMBOL`：交易所原生寫法，`BTCUSDT`，沒有斜線。
- `DATE`：月檔是 `2026-05`，日檔是 `2026-05-14`。

實際的例子：

```
https://data.binance.vision/data/spot/monthly/klines/BTCUSDT/1m/BTCUSDT-1m-2026-05.zip
https://data.binance.vision/data/spot/daily/klines/BTCUSDT/1m/BTCUSDT-1m-2026-09-14.zip
```

每個 zip 旁邊都有一個同名加 `.CHECKSUM` 的檔案，內容是一行 SHA-256 加檔名。

注意現貨與永續在網址上就分開了。這其實是好事——不會不小心「順手」抓錯，除非自己去改那個前綴。這些規則全部屬於 Binance，所以它們住在 infrastructure：

```python
# quantbot/infrastructure/binance/binance_archive_url_builder.py
from __future__ import annotations

from collections.abc import Mapping
from datetime import date
from types import MappingProxyType
from typing import ClassVar

from quantbot.domain.values.instrument import Instrument
from quantbot.domain.values.market import Market


class BinanceArchiveUrlBuilder:
    """data.binance.vision 的網址規則。

    現貨與永續的前綴不同，這裡就把它們隔開。這是 Binance 的細節，
    NEVER 出現在 domain——換一家交易所時，要改的只有這個檔案與它的鄰居。
    """

    BASE_URL: ClassVar[str] = "https://data.binance.vision/data"
    MARKET_PREFIXES: ClassVar[Mapping[Market, str]] = MappingProxyType(
        {
            Market.SPOT: "spot",
            Market.USD_MARGINED_PERPETUAL: "futures/um",
        }
    )

    def monthly(self, instrument: Instrument, month: date) -> str:
        return self._archive_url(instrument, "monthly", f"{month:%Y-%m}")

    def daily(self, instrument: Instrument, day: date) -> str:
        """月檔還沒出來的那幾天用日檔補。"""
        return self._archive_url(instrument, "daily", f"{day:%Y-%m-%d}")

    @staticmethod
    def checksum(archive_url: str) -> str:
        """每個 zip 旁邊都有一份同名加 .CHECKSUM 的官方雜湊。"""
        return f"{archive_url}.CHECKSUM"

    def _archive_url(self, instrument: Instrument, period: str, stamp: str) -> str:
        prefix = self.MARKET_PREFIXES[instrument.market]
        symbol = instrument.native_symbol
        timeframe = instrument.timeframe
        filename = f"{symbol}-{timeframe}-{stamp}.zip"
        return (
            f"{self.BASE_URL}/{prefix}/{period}/klines/{symbol}/{timeframe}/{filename}"
        )
```

### 下載並驗證 checksum

下載這一段要處理四件事：控併發、驗 checksum、快取到本機、以及「檔案還沒上傳」的 404 不是錯誤。

最後一項是重跑能力的關鍵。當月的月檔本來就不存在，昨天的日檔可能還沒上傳完，這些都會回 404。如果把 404 當例外往上丟，程式每次跑到最新那幾天都會炸。

```python
# quantbot/infrastructure/binance/binance_archive_downloader.py
from __future__ import annotations

import asyncio
import hashlib
from pathlib import Path

import httpx

from quantbot.infrastructure.binance.binance_archive_url_builder import (
    BinanceArchiveUrlBuilder,
)


class BinanceArchiveDownloader:
    """把批次 zip 的位元組拿到手並確認完整：控併發、驗 checksum、快取到本機。

    只負責位元組。不解讀內容（那是 parser 的事），也不知道要抓哪幾個月
    （那是 candle source 的事）。httpx 的 client 由組裝根建立並注入，
    一個行程共用一個連線池。
    """

    def __init__(
        self,
        client: httpx.AsyncClient,
        url_builder: BinanceArchiveUrlBuilder,
        *,
        cache_directory: Path,
        concurrency: int = 8,
    ) -> None:
        self._client = client
        self._url_builder = url_builder
        self._cache_directory = cache_directory
        self._semaphore = asyncio.Semaphore(concurrency)

    async def download(self, archive_url: str) -> bytes | None:
        """下載一個 zip 並用官方 checksum 驗證。

        回傳 zip 的位元組；**檔案不存在（尚未上傳）時回傳 None**，因為當月的
        月檔本來就不存在、昨天的日檔可能還沒上傳完。把 404 當例外往上丟的話，
        程式每次跑到最新那幾天都會炸。

        本機已經有驗證過的檔案就直接讀，所以中斷後重跑不會重下。
        """
        cached = self._cache_directory / archive_url.rsplit("/", 1)[-1]
        if cached.exists():
            return cached.read_bytes()

        async with self._semaphore:
            expected = await self._read_checksum(archive_url)
            if expected is None:
                return None  # 連 checksum 都沒有，代表這個檔案還沒上傳
            payload = await self._read_bytes(archive_url)

        if payload is None:
            return None

        actual = hashlib.sha256(payload).hexdigest()
        if actual != expected:
            raise ValueError(
                f"checksum 不符：{archive_url}（預期 {expected}，實得 {actual}）"
            )

        self._write_verified(cached, payload)
        return payload

    async def _read_bytes(self, url: str) -> bytes | None:
        response = await self._client.get(url)
        if response.status_code == httpx.codes.NOT_FOUND:
            return None
        response.raise_for_status()
        return response.content

    async def _read_checksum(self, archive_url: str) -> str | None:
        """官方 .CHECKSUM 檔的格式是「<sha256>  <檔名>」。"""
        payload = await self._read_bytes(self._url_builder.checksum(archive_url))
        return None if payload is None else payload.decode().split()[0]

    def _write_verified(self, target: Path, payload: bytes) -> None:
        """先寫 .part 再改名，讓快取只有兩種狀態：完整可用，或不存在。"""
        self._cache_directory.mkdir(parents=True, exist_ok=True)
        temporary = target.with_suffix(target.suffix + ".part")
        temporary.write_bytes(payload)
        temporary.rename(target)
```

驗 checksum 不是形式主義。這些檔案動輒幾 MB，下載中斷留下半截檔案是很常見的事，而半截的 zip 解壓後可能還是有幾萬列看起來正常的資料，只是尾巴斷了。斷在哪裡不會有人告訴我們，直到後面某個計算結果不對，才回頭花一個下午找。

`_write_verified` 的「先寫 `.part` 再改名」是為了讓快取只有兩種狀態：完整可用，或不存在。中斷不會留下第三種狀態，而 `download` 開頭那句 `if cached.exists()` 才敢無條件相信本機檔案。

`httpx.AsyncClient` 是**注入**的而不是自己建的。理由是連線池：一個行程共用一個 client，TCP 連線與 TLS handshake 才會被重用，而它的生命週期由組裝根用 `async with` 管。自己在類別裡建一個，就會變成每個下載器各開一組連線池。

### 解析：昨天已經寫好了

zip 解開之後怎麼變成一張表，昨天的 `BinanceCandleCsvParser` 已經處理完了：偵測有沒有標頭、判斷 epoch 單位、對映十二個欄位、轉型別。今天只要把它接上去。

它實作的是 domain 的 `CandleParser`——而它從來沒有 import 過那個 Protocol。哪天要支援別家交易所的 CSV，寫一個 `BybitCandleCsvParser` 換進去就好，`domain` 與 `application` 都不用動。

### 接成一條來源

`BinanceArchiveCandleSource` 把網址、下載器、以及昨天的 parser 組起來，是第一個實作 `CandleSource` 的東西。「月檔還是日檔」完全是它的內務：domain 只說「這段走批次」，要下載哪幾個檔、怎麼併發、哪些檔還不存在，由這裡決定。

```python
# quantbot/infrastructure/binance/binance_archive_candle_source.py
from __future__ import annotations

import asyncio
from datetime import date

import pandas as pd

from quantbot.domain.entities.candle_series import CandleSeries
from quantbot.domain.interfaces.candle_parser import CandleParser
from quantbot.domain.values.instrument import Instrument
from quantbot.domain.values.time_range import TimeRange
from quantbot.infrastructure.binance.binance_archive_downloader import (
    BinanceArchiveDownloader,
)
from quantbot.infrastructure.binance.binance_archive_url_builder import (
    BinanceArchiveUrlBuilder,
)


class BinanceArchiveCandleSource:
    """data.binance.vision 這條來源。實作 domain 的 CandleSource。

    「月檔還是日檔」完全是這個類別的內務：domain 只說「這段走批次」，
    要下載哪幾個檔、怎麼併發、哪些檔還不存在，由這裡決定。
    """

    def __init__(
        self,
        downloader: BinanceArchiveDownloader,
        url_builder: BinanceArchiveUrlBuilder,
        parser: CandleParser,
    ) -> None:
        self._downloader = downloader
        self._url_builder = url_builder
        self._parser = parser

    async def load(self, instrument: Instrument, period: TimeRange) -> CandleSeries:
        urls = self._archive_urls(instrument, period)
        payloads = await asyncio.gather(
            *(self._downloader.download(url) for url in urls)
        )

        # 解壓與解析是 CPU 使用密集的，丟到執行緒池，不要阻塞事件迴圈
        frames = await asyncio.gather(
            *(
                asyncio.to_thread(self._parser.parse, payload)
                for payload in payloads
                if payload is not None
            )
        )
        if not frames:
            return CandleSeries.empty(instrument)

        combined = pd.concat(frames).sort_index()
        series = CandleSeries(
            instrument, combined[~combined.index.duplicated(keep="first")]
        )
        return series.restricted_to(period)

    def _archive_urls(self, instrument: Instrument, period: TimeRange) -> list[str]:
        """先用完整月份的月檔，月檔蓋不到的零頭用日檔補。"""
        months = self._complete_months(period)
        covered = {
            day.date()
            for month in months
            for day in pd.date_range(
                pd.Timestamp(month), pd.Timestamp(month) + pd.offsets.MonthEnd(0)
            )
        }
        leftover_days = [
            day.date()
            for day in pd.date_range(
                period.start.normalize(), period.end, inclusive="left", freq="D"
            )
            if day.date() not in covered
        ]

        return [self._url_builder.monthly(instrument, month) for month in months] + [
            self._url_builder.daily(instrument, day) for day in leftover_days
        ]

    @staticmethod
    def _complete_months(period: TimeRange) -> list[date]:
        """完整落在區間內的月份。半個月的月檔會多帶到區間外的資料，所以不用。"""
        months: list[date] = []
        cursor = period.start.normalize().replace(day=1)
        while cursor < period.end:
            month_end = cursor + pd.offsets.MonthEnd(0)
            if cursor >= period.start.normalize() and month_end < period.end:
                months.append(cursor.date())
            cursor = cursor + pd.offsets.MonthBegin(1)
        return months
```

`_complete_months` 只取完整落在區間內的月份，剩下的零頭用日檔補。不用半個月的月檔，因為那會多帶進區間外的資料，之後還要再切一次。

### 路由：這段走批次還是 REST

有了上傳延遲這個已知條件，路由邏輯就寫得出來。判斷依據只有兩個：**批次檔的上傳延遲**（太新的資料只有 REST 有），以及**成本**（缺口只有幾十根的時候，下載整包 zip 再解壓反而是繞遠路）。

兩個依據都跟交易所的實作無關，所以它是 domain service：

```python
# quantbot/domain/services/source_routing_service.py
from __future__ import annotations

from typing import ClassVar

import pandas as pd

from quantbot.domain.values.source_kind import FetchInstruction, SourceKind
from quantbot.domain.values.time_range import TimeRange


class SourceRoutingService:
    """一段區間該走哪條來源。

    判斷依據只有兩個，而且都跟交易所的實作無關，所以它屬於 domain：
    一是批次檔的上傳延遲（太新的資料只有 REST 有），二是成本（缺口太短的話，
    下載整包 zip 再解壓反而是繞遠路）。

    這個 service 不碰網路、不吃任何介面，所以測試不需要任何替身。
    """

    DEFAULT_UPLOAD_LAG_DAYS: ClassVar[int] = 2
    DEFAULT_MINIMUM_ARCHIVE_SPAN: ClassVar[pd.Timedelta] = pd.Timedelta(days=2)

    def __init__(
        self,
        *,
        upload_lag_days: int = DEFAULT_UPLOAD_LAG_DAYS,
        minimum_archive_span: pd.Timedelta = DEFAULT_MINIMUM_ARCHIVE_SPAN,
    ) -> None:
        self._upload_lag_days = upload_lag_days
        self._minimum_archive_span = minimum_archive_span

    def archive_available_until(self, now: pd.Timestamp) -> pd.Timestamp:
        """這個時間點之後的資料只有 REST 有。

        當日資料隔日上傳、月檔次月初才出現，所以取一個保守的緩衝：
        多抓一天 REST 的成本是兩次請求，少抓一天造成的缺漏要之後才會發現。
        """
        return (now - pd.Timedelta(days=self._upload_lag_days)).normalize()

    def route(
        self, period: TimeRange, *, now: pd.Timestamp
    ) -> tuple[FetchInstruction, ...]:
        """把一段區間切成一到兩個取得指令。"""
        if period.is_empty():
            return ()

        cutoff = self.archive_available_until(now)
        too_new = period.start >= cutoff
        too_short = period.duration < self._minimum_archive_span
        if too_new or too_short:
            return (FetchInstruction(SourceKind.REST, period),)

        archive_period = period.clamp_end(cutoff)
        instructions = [FetchInstruction(SourceKind.ARCHIVE, archive_period)]
        if period.end > cutoff:
            instructions.append(
                FetchInstruction(SourceKind.REST, TimeRange(cutoff, period.end))
            )
        return tuple(instructions)
```

上傳延遲取兩天是保守的。當日資料隔日上傳，但上傳有時間，抓一個緩衝比較安全：多抓一天 REST 的成本很低（1440 根 = 2 次請求），少抓一天造成的缺漏卻要之後才會發現。

這個 service 一行 I/O 都沒有，也不吃任何介面，所以它的測試就是餵幾個 `TimeRange` 進去、斷言切出來的段數與邊界，不需要任何替身，也不必跑起網路。Day 08 的管線會拿同一個 service 去處理每一段缺口。

### 先擋住限流

限流有兩種等待，是兩件不同的事，但它們都是「怎麼跟 Binance 相處」，所以放在同一個類別裡：

```python
# quantbot/infrastructure/binance/binance_rate_limit_guard.py
from __future__ import annotations

import asyncio
import random
from collections.abc import Callable, Coroutine
from typing import Any, ClassVar

import pandas as pd


class BinanceRateLimitGuard:
    """限流的兩種等待。

    yield_if_heavy 是預防性的：讀回應標頭，逼近門檻就主動睡到下一分鐘。
    call 是被動的：撞到暫時性錯誤才退避重試。只有後者的程式會一直在上限
    邊緣震盪，兩個都要有。

    門檻與退避參數是 Binance 的細節，所以這個類別住在 infrastructure。
    """

    WEIGHT_HEADER: ClassVar[str] = "x-mbx-used-weight-1m"
    # 每分鐘上限 2400 的一半，另一半留給帳戶查詢與下單
    DEFAULT_WEIGHT_CEILING: ClassVar[int] = 1200

    def __init__(
        self,
        *,
        weight_ceiling: int = DEFAULT_WEIGHT_CEILING,
        attempt_limit: int = 5,
        base_delay_seconds: float = 1.0,
    ) -> None:
        self._weight_ceiling = weight_ceiling
        self._attempt_limit = attempt_limit
        self._base_delay_seconds = base_delay_seconds

    async def call(self, operation: Callable[[], Coroutine[Any, Any, Any]]) -> Any:
        """指數退避重試。只重試暫時性錯誤，參數錯誤之類的直接往上丟。"""
        import ccxt.async_support as ccxt

        transient = (
            ccxt.RateLimitExceeded,
            ccxt.NetworkError,
            ccxt.ExchangeNotAvailable,
        )
        for attempt in range(self._attempt_limit):
            try:
                return await operation()
            except transient:
                if attempt == self._attempt_limit - 1:
                    raise
                # 加上抖動，避免多個併發任務同時醒來再撞一次
                delay = self._base_delay_seconds * 2**attempt + random.uniform(0, 0.5)
                await asyncio.sleep(delay)

    async def yield_if_heavy(self, exchange: Any) -> None:
        """讀 X-MBX-USED-WEIGHT-1M，逼近門檻就主動睡到下一分鐘。"""
        used_weight = self._read_header(exchange, self.WEIGHT_HEADER)
        if used_weight is not None and int(used_weight) > self._weight_ceiling:
            await asyncio.sleep(60 - pd.Timestamp.now(tz="UTC").second)

    @staticmethod
    def _read_header(exchange: Any, name: str) -> str | None:
        """標頭大小寫不保證，統一轉小寫比對。"""
        headers = {
            key.lower(): value
            for key, value in (exchange.last_response_headers or {}).items()
        }
        return headers.get(name)
```

退避要加抖動的理由：如果八條併發任務同時撞到 429、同時退避 1 秒、同時醒來，一秒後會再撞一次，退避 2 秒，再一起醒來。沒有抖動的退避，退的是同一群人。

只重試暫時性錯誤也是刻意的。`ccxt.BadRequest`（參數寫錯）重試五次還是錯，只是把一個 5 秒就能發現的問題拖成 30 秒，而且錯誤訊息會被淹沒在重試日誌裡。

### 用 ccxt 補最後幾天

REST 這段只負責幾天的資料，但翻頁邏輯還是要寫對，因為 Day 08 會拿同一個類別去補任意長度的缺漏。

翻頁最容易錯的是游標怎麼推進。`fetch_ohlcv(symbol, timeframe, since=t)` 的 `since` 是**包含**的：回傳的第一根就是 `t` 那一根。所以下一頁的游標有三種寫法，只有一種對：

| 下一頁的 since | 結果 |
|---|---|
| `last_open_time` | 重複拿到最後一根 |
| `last_open_time + 2 * step` | 漏掉一根 |
| `last_open_time + step` | 正確 |

```python
# quantbot/infrastructure/binance/binance_rest_candle_source.py
from __future__ import annotations

from collections.abc import Mapping
from functools import partial
from types import MappingProxyType
from typing import Any, ClassVar

import pandas as pd

from quantbot.domain.entities.candle_series import CandleSeries
from quantbot.domain.values.candle_columns import CandleColumns
from quantbot.domain.values.instrument import Instrument
from quantbot.domain.values.market import Market
from quantbot.domain.values.time_range import TimeRange
from quantbot.infrastructure.binance.binance_rate_limit_guard import (
    BinanceRateLimitGuard,
)


class BinanceRestCandleSource:
    """Binance REST 這條來源。實作 domain 的 CandleSource。

    翻頁邏輯與「只回已收盤的 K 線」都在這裡；區間由呼叫端決定，
    限流交給 BinanceRateLimitGuard。
    """

    REST_COLUMNS: ClassVar[tuple[str, ...]] = (
        "open_time",
        "open",
        "high",
        "low",
        "close",
        "volume",
    )
    CCXT_MARKET_TYPES: ClassVar[Mapping[Market, str]] = MappingProxyType(
        {
            Market.SPOT: "spot",
            Market.USD_MARGINED_PERPETUAL: "future",
        }
    )

    def __init__(
        self,
        exchange: Any,
        guard: BinanceRateLimitGuard,
        *,
        page_size: int = 1000,
    ) -> None:
        self._exchange = exchange
        self._guard = guard
        self._page_size = page_size

    async def load(self, instrument: Instrument, period: TimeRange) -> CandleSeries:
        step_milliseconds = int(instrument.timeframe.step.total_seconds() * 1000)
        cursor = int(period.start.timestamp() * 1000)
        until = int(period.end.timestamp() * 1000)
        rows: list[list[float]] = []

        while cursor < until:
            # 用 partial 把這一輪的 cursor 綁進去。寫成 lambda 也能跑，
            # 但閉包抓的是變數而不是值，重試時很容易抓到已經被推進過的游標。
            page = await self._guard.call(
                partial(
                    self._exchange.fetch_ohlcv,
                    instrument.symbol,
                    instrument.timeframe.value,
                    since=cursor,
                    limit=self._page_size,
                )
            )
            if not page:
                break

            rows.extend(page)
            # since 是含頭的，所以下一頁要 +1 個間隔
            next_cursor = page[-1][0] + step_milliseconds
            if next_cursor <= cursor:
                break  # 交易所回了同一頁，再翻下去會是無窮迴圈
            cursor = next_cursor

            await self._guard.yield_if_heavy(self._exchange)

        return self._to_series(instrument, rows).restricted_to(period)

    def _to_series(
        self, instrument: Instrument, rows: list[list[float]]
    ) -> CandleSeries:
        candles = pd.DataFrame(rows, columns=list(self.REST_COLUMNS))
        open_times = CandleColumns.to_utc(candles["open_time"])
        open_times.name = CandleColumns.OPEN_TIME
        candles = candles.set_index(open_times)
        return CandleSeries(instrument, candles[~candles.index.duplicated(keep="last")])
```

那個 `if next_cursor <= cursor: break` 看起來多餘，但它擋的是一整類問題。交易所偶爾會在某些邊界回一個不推進的結果，沒有這行，程式會安靜地跑一整晚打幾十萬次請求，然後被 418 擋下來。任何 while 迴圈只要游標由外部回傳的資料決定，就該有這道保險。

至於「最後一根還沒收完」，這裡不必再處理一次——`load` 最後那句 `restricted_to(period)` 會把它切掉，而區間的右端由 application 用 `Timeframe.floor(now)` 決定。這就是把規則放進值物件的好處：擋住進行式 K 線這件事，全專案只寫了一次。

### 缺漏偵測

回補完不代表資料是完整的。交易所會停機維護、某些冷門交易對某幾分鐘真的沒有成交，這些都會留下缺口。先把缺口列出來，才有機會判斷它是不是問題。

```python
# quantbot/domain/services/data_integrity_service.py
from __future__ import annotations

import pandas as pd

from quantbot.domain.dto.data_integrity_report import DataIntegrityReportDto
from quantbot.domain.values.gap import Gap
from quantbot.domain.values.time_range import TimeRange
from quantbot.domain.values.timeframe import Timeframe


class DataIntegrityService:
    """實際資料相對於完整時間軸缺了哪幾段。

    這是全專案唯一的缺漏偵測。Day 03 拿它產回補報告、Day 08 拿它盤點資料庫，
    兩邊問的是同一個問題，所以 NEVER 各寫一份。
    """

    def inspect(
        self,
        open_times: pd.DatetimeIndex,
        *,
        period: TimeRange,
        timeframe: Timeframe,
    ) -> DataIntegrityReportDto:
        if len(open_times) and open_times.tz is None:
            raise ValueError("open_times 必須是 tz-aware，時區在入庫前就要統一")

        expected = timeframe.expected_open_times(period)
        actual = open_times.tz_convert("UTC") if len(open_times) else open_times
        missing = expected.difference(actual)

        return DataIntegrityReportDto(
            expected_bar_count=len(expected),
            actual_bar_count=len(expected.intersection(actual)),
            gaps=self._group_into_gaps(missing, timeframe.step),
        )

    @staticmethod
    def _group_into_gaps(
        missing: pd.DatetimeIndex, step: pd.Timedelta
    ) -> tuple[Gap, ...]:
        """把連續的缺漏點合併成區間。沒有迴圈遍歷時間軸。"""
        if missing.empty:
            return ()

        moments = missing.to_series()
        # 與前一筆的距離不等於一個 step，就是新的一段。
        # 第一筆的 diff 是 NaT，比較結果為 True，剛好當成第一段的開頭。
        block_identifiers = (moments.diff() != step).cumsum()
        return tuple(
            Gap(start=block.iloc[0], end=block.iloc[-1], bar_count=len(block))
            for _, block in moments.groupby(block_identifiers)
        )
```

`_group_into_gaps` 用 `difference` 與 `cumsum` 做，沒有迴圈。缺漏偵測要在幾百萬列上跑，寫成逐根比對會慢到沒有人想跑它，而一個沒有人想跑的檢查等於沒有這個檢查。

回傳的 `DataIntegrityReportDto` 是一個 frozen dataclass（`domain/dto/data_integrity_report.py`），欄位是預期根數、實際根數與缺口清單，另外提供 `missing_bar_count`、`coverage_ratio`、`is_complete` 三個推導屬性與一個 `to_frame()`。算一次、傳下去，報告階段只是讀值。

### 串起來：application 只認介面

前面那些類別各自只知道一件事，總得有人決定順序。這是 application 的工作，而它的方法短到可以一眼看完——因為該做的事都已經有主人了：

```python
# quantbot/application/backfill_candles_application.py
from __future__ import annotations

from collections.abc import Mapping

from quantbot.domain.dto.data_integrity_report import DataIntegrityReportDto
from quantbot.domain.entities.candle_series import CandleSeries
from quantbot.domain.interfaces.candle_source import CandleSource
from quantbot.domain.interfaces.clock import Clock
from quantbot.domain.services.data_integrity_service import DataIntegrityService
from quantbot.domain.services.source_routing_service import SourceRoutingService
from quantbot.domain.values.instrument import Instrument
from quantbot.domain.values.source_kind import SourceKind
from quantbot.domain.values.time_range import TimeRange


class BackfillCandlesApplication:
    """回補一段 K 線：路由 → 依路由向各來源取得 → 合併 → 檢查完整性。

    它只認 CandleSource 這個介面。哪一條是批次 zip、哪一條是 REST，是組裝根
    的決定；這裡連 Binance 這個字都不會出現，換交易所不必改這個檔案。
    """

    def __init__(
        self,
        *,
        sources: Mapping[SourceKind, CandleSource],
        routing: SourceRoutingService,
        integrity: DataIntegrityService,
        clock: Clock,
    ) -> None:
        self._sources = sources
        self._routing = routing
        self._integrity = integrity
        self._clock = clock

    async def run(self, instrument: Instrument, period: TimeRange) -> CandleSeries:
        now = self._clock.now()
        # 右端收到最後一根已收盤的 K 線。TimeRange 是半開區間，
        # 所以拿當下那根還在跳動的 K 線的開盤時間當 end 剛好排除它。
        bounded = period.clamp_end(instrument.timeframe.floor(now))

        series = CandleSeries.empty(instrument)
        for instruction in self._routing.route(bounded, now=now):
            fetched = await self._sources[instruction.source_kind].load(
                instrument, instruction.period
            )
            # 批次檔是定稿、REST 是暫時的。route() 保證批次段先來，
            # 而 merge 以呼叫者為準，所以重疊時批次勝出。
            series = series.merge(fetched)

        return series.restricted_to(bounded)

    async def inspect(
        self, series: CandleSeries, period: TimeRange
    ) -> DataIntegrityReportDto:
        """回補完的完整性報告。用的是全專案同一個缺漏偵測。"""
        return self._integrity.inspect(
            series.open_times, period=period, timeframe=series.instrument.timeframe
        )
```

這個檔案裡沒有 `httpx`、沒有 `ccxt`、沒有 Binance 這幾個字。它拿到的是一個 `Mapping[SourceKind, CandleSource]`，誰是 zip、誰是 REST 由組裝根決定。要驗證它的行為，只要用 `create_autospec(CandleSource, spec_set=True)` 做兩個替身，斷言「短缺口不該碰批次」「重疊時批次勝出」「進行式 K 線不會被回傳」，一行網路都不用打。

冪等性來自三個地方，缺一不可：檔案快取（已驗證的 zip 不重下）、`CandleSeries.merge` 的去重（重疊區間不會變成兩列）、以及 `.part` 暫存檔（中斷不會留下半截的有效快取）。三者分別由 `BinanceArchiveDownloader.download`、`CandleSeries.merge`、`BinanceArchiveDownloader._write_verified` 擔保，重跑出問題的時候要查的地方只有這三個。

### 組裝根

最後一個檔案是唯一知道所有具體型別的地方：

```python
# quantbot/entrypoints/backfill_command.py
"""回補一段 K 線並存成 parquet。

    uv run python -m quantbot.entrypoints.backfill_command \
        --symbol BTC/USDT --market spot --timeframe 1m \
        --start 2025-01-01 --end 2026-09-16 --out data/klines
"""

from __future__ import annotations

import argparse
import asyncio
from pathlib import Path

# 省略 import：ccxt、httpx、pandas，以及上面每一個類別

def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--symbol", default="BTC/USDT")
    parser.add_argument("--market", default="spot", choices=[m.value for m in Market])
    parser.add_argument("--timeframe", default="1m")
    parser.add_argument("--start", required=True)
    parser.add_argument("--end", required=True)
    parser.add_argument("--out", type=Path, default=Path("data/klines"))
    return parser.parse_args()


async def main() -> int:
    arguments = parse_arguments()
    instrument = Instrument(
        symbol=arguments.symbol,
        market=Market(arguments.market),
        timeframe=Timeframe(arguments.timeframe),
    )
    period = TimeRange(
        pd.Timestamp(arguments.start, tz="UTC"), pd.Timestamp(arguments.end, tz="UTC")
    )

    # 這裡是組裝根：全專案唯一知道所有具體型別的地方。
    # 上面的 application 只認 CandleSource，所以要換掉任何一條來源，改的是這幾行。
    url_builder = BinanceArchiveUrlBuilder()
    exchange = ccxt.binance({"enableRateLimit": True})
    async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
        try:
            application = BackfillCandlesApplication(
                sources={
                    SourceKind.ARCHIVE: BinanceArchiveCandleSource(
                        BinanceArchiveDownloader(
                            client,
                            url_builder,
                            cache_directory=settings.raw_data_directory,
                        ),
                        url_builder,
                        BinanceCandleCsvParser(),
                    ),
                    SourceKind.REST: BinanceRestCandleSource(
                        exchange, BinanceRateLimitGuard()
                    ),
                },
                routing=SourceRoutingService(),
                integrity=DataIntegrityService(),
                clock=SystemClock(),
            )
            series = await application.run(instrument, period)
            integrity = await application.inspect(series, period)
        finally:
            await exchange.close()

    arguments.out.mkdir(parents=True, exist_ok=True)
    series.with_identity_columns().to_parquet(
        arguments.out / f"{instrument.storage_key}.parquet"
    )
    integrity.to_frame().to_csv(
        arguments.out / f"{instrument.storage_key}_gaps.csv", index=False
    )

    print(
        f"{len(series)} 根，缺 {integrity.missing_bar_count} 根，"
        f"覆蓋率 {integrity.coverage_ratio:.4%}"
    )
    return 0 if integrity.is_complete else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
```

這幾行就是依賴反轉實際的樣子。`BackfillCandlesApplication` 的建構參數全部是介面或 domain service，所以要把批次來源換成別家交易所、要把 REST 換成 WebSocket、要在測試裡換成替身，動的都是這個 `main()`，而不是用例本身。

## 驗證：跟 CoinGecko 對一遍

Day 01 的第五條選型原則：每個主來源都要有對照組。今天是第一次真的執行。

要先講清楚**這個對照在驗什麼、不驗什麼**。CoinGecko 給的是跨交易所的 USD 加權參考價，Binance 給的是這個交易所的 USDT 成交價。兩者本來就不會一樣，USDT 對 USD 也有微小的偏離。所以不要期待數字相等。

它能抓到的是**量級錯誤**，而那正是欄位對映最常見的出錯方式：欄位順序錯一格，會拿成交量當收盤價，數字差幾千倍；時間戳單位搞錯，整條序列會平移到 1970 年或 55000 年；價格欄型別沒轉好，拿到的會是字串比較的結果。這些錯誤全部都是「差很多」，用一個 1% 的相對誤差門檻就攔得下來。

這件事要拆成兩半：**去哪裡拿對照資料**是 infrastructure，**怎麼比**是 domain。先看介面：

```python
# quantbot/domain/interfaces/reference_price_source.py
from typing import Protocol

import pandas as pd

from quantbot.domain.values.time_range import TimeRange


class ReferencePriceSource(Protocol):
    """對照組：一個獨立於主來源的價格來源。

    Day 01 的第五條選型原則（每個主來源都要有對照組）在程式碼裡就是這個介面。
    """

    @property
    def name(self) -> str:
        """報告裡要標出對照組是誰，所以名字是介面的一部分。"""
        ...

    def supports(self, symbol: str) -> bool:
        """沒有對照來源的交易對要在報告裡標成 SKIP，NEVER 默默當成通過。"""
        ...

    async def daily_close(self, symbol: str, period: TimeRange) -> pd.Series: ...
```

`supports` 是介面的一部分，因為「沒有對照來源」跟「對照通過」是兩件不同的事。少了它，冷門交易對會安靜地被當成通過，而那正是對照組最該講話的時候。

實作端只負責把資料拿回來：

```python
# quantbot/infrastructure/coingecko/coingecko_reference_price_source.py
from __future__ import annotations

from collections.abc import Mapping
from types import MappingProxyType
from typing import ClassVar

import httpx
import pandas as pd

from quantbot.domain.values.time_range import TimeRange


class CoinGeckoReferencePriceSource:
    """CoinGecko 這個對照組。實作 domain 的 ReferencePriceSource。

    它給的是跨交易所的 USD 參考價，跟單一交易所的 USDT 成交價本來就不會相等，
    所以它抓的是量級錯誤——欄位對映錯一格、時間戳單位搞錯、抓成永續合約。
    比對邏輯不在這裡，在 domain 的 PriceCrossCheckService。
    """

    BASE_URL: ClassVar[str] = "https://api.coingecko.com/api/v3"
    COIN_IDENTIFIERS: ClassVar[Mapping[str, str]] = MappingProxyType(
        {
            "BTC/USDT": "bitcoin",
            "ETH/USDT": "ethereum",
            "SOL/USDT": "solana",
        }
    )

    def __init__(self, client: httpx.AsyncClient, *, api_key: str = "") -> None:
        self._client = client
        self._api_key = api_key

    @property
    def name(self) -> str:
        return "coingecko"

    def supports(self, symbol: str) -> bool:
        return symbol in self.COIN_IDENTIFIERS

    async def daily_close(self, symbol: str, period: TimeRange) -> pd.Series:
        """取日收盤參考價，index 是 UTC 日期。"""
        coin_identifier = self.COIN_IDENTIFIERS[symbol]
        response = await self._client.get(
            f"{self.BASE_URL}/coins/{coin_identifier}/market_chart/range",
            params={
                "vs_currency": "usd",
                "from": int(period.start.timestamp()),
                "to": int(period.end.timestamp()),
            },
            headers={"x-cg-demo-api-key": self._api_key} if self._api_key else {},
        )
        response.raise_for_status()

        prices = pd.DataFrame(
            response.json()["prices"], columns=["epoch_milliseconds", "price"]
        )
        moments = pd.to_datetime(prices["epoch_milliseconds"], unit="ms", utc=True)
        return (
            pd.Series(prices["price"].to_numpy(), index=moments)
            .resample("1D")
            .last()
            .rename("theirs")
        )
```

比對邏輯留在 domain：

```python
# quantbot/domain/services/price_cross_check_service.py
from __future__ import annotations

import pandas as pd

from quantbot.domain.dto.price_cross_check_report import PriceCrossCheckReportDto


class PriceCrossCheckService:
    """跟對照組比日收盤價。

    它驗的是**量級**，不是小數點。跨交易所參考價跟單一交易所的成交價本來就不會
    相等，所以 tolerance 存在的目的是攔「欄位對映錯一格」「時間戳單位搞錯」
    這類差很多的錯誤。

    這個 service 不碰網路：資料誰去拿是 application 的事，比對邏輯留在 domain，
    所以測試只要餵兩張手寫的小 Series。
    """

    def __init__(self, *, tolerance: float = 0.01) -> None:
        self._tolerance = tolerance

    @property
    def tolerance(self) -> float:
        return self._tolerance

    def compare(
        self, ours: pd.Series, theirs: pd.Series, *, reference_name: str
    ) -> PriceCrossCheckReportDto:
        comparison = (
            pd.concat({"ours": ours, "theirs": theirs}, axis=1).dropna().sort_index()
        )
        comparison["relative_difference"] = (
            comparison["ours"] - comparison["theirs"]
        ).abs() / comparison["theirs"]
        comparison["passed"] = comparison["relative_difference"] <= self._tolerance

        return PriceCrossCheckReportDto(
            comparison=comparison,
            tolerance=self._tolerance,
            reference_name=reference_name,
        )
```

```python
# quantbot/domain/dto/price_cross_check_report.py
from dataclasses import dataclass

import pandas as pd


@dataclass(frozen=True)
class PriceCrossCheckReportDto:
    """跟對照組比對的結果。"""

    comparison: pd.DataFrame  # 逐日的兩邊收盤價、相對差、是否通過
    tolerance: float
    reference_name: str

    @property
    def maximum_relative_difference(self) -> float:
        if self.comparison.empty:
            return 0.0
        return float(self.comparison["relative_difference"].max())

    @property
    def passed(self) -> bool:
        return bool(self.comparison["passed"].all())

    @property
    def flagged_days(self) -> pd.DataFrame:
        return self.comparison.loc[~self.comparison["passed"]]
```

這樣拆的好處在測試上最明顯：驗證比對邏輯只要餵兩張手寫的小 Series 給 `PriceCrossCheckService.compare`，不需要打 CoinGecko、也不需要 mock HTTP。而 `CoinGeckoReferencePriceSource` 要測的只剩「有沒有正確解讀那份 JSON」，那是一個可以用固定回應驗的問題。

正常情況下 `maximum_relative_difference` 會落在千分之幾。看到百分之幾就要查是哪一天、是不是那天有極端行情；看到幾十倍幾千倍，回去看欄位對映與時間戳單位，八成錯在那兩個地方。

比對結果要輸出成報告的一部分，不要只在終端機印一次就算了。Day 08 把這一段接進管線時，這份報告會變成每天自動產出的東西——而且用的是同一個 `PriceCrossCheckService`，門檻也還是那個 1%。

## API key 的安全設定

今天用不到 key，但既然講到了 REST，就把設定講完。這幾件事都是「申請的時候要做對」，事後補的效果差很多。

**權限只開需要的兩項。** 建立 key 時勾選讀取與現貨交易，**NEVER 勾提幣（Enable Withdrawals）**。這一條沒有折衷空間。程式從頭到尾不需要把幣轉出去，開了提幣權限只是給洩漏的後果加上一個上限——從「有人可以亂下單」變成「有人可以把錢拿走」。

**綁 IP 白名單。** 填 VPS 或家用固定 IP。這樣即使 key 洩漏，別人在別的地方也用不了。順帶一提，Binance 對沒有綁 IP 的 key 有額外限制，閒置一段時間會自動停用（2026 年中的規則是 90 天，以官方公告為準），所以綁白名單同時也省掉每隔幾個月重新申請的麻煩。

**key 一律從 .env 讀。** Day 01 的 `Settings` 已經有欄位了，今天把對照組的 key 也加進去：

```python
# quantbot/config.py（在 Day 01 的 Settings 上補兩個欄位）
class Settings(BaseSettings):
    ...
    coingecko_api_key: str = ""                          # 對照組用，可留空走匿名額度
    raw_data_directory: Path = Path("data/raw")
```

`Settings` 是唯一讀 `.env` 的地方，而且它只被 `entrypoints/` 與 `infrastructure/` 用到。domain 與 application 都不認識它——設定是外部世界的東西，跟時鐘、跟資料庫是同一類。

`.env` 早就在 `.gitignore` 裡了。今天再多加一件事：**把 `data/` 也加進去**。批次 zip 跟 parquet 動輒幾百 MB，不小心 commit 進去，之後要清乾淨很花時間。Day 01 的 `.gitignore` 已經有這兩行，確認一下還在。

**實單前一律先用 testnet。** ccxt 切換只要一行：

```python
# quantbot/entrypoints/backfill_command.py（組裝根，Day 23 之後才會用到 key）
exchange = ccxt.binance(
    {
        "apiKey": settings.binance_api_key,
        "secret": settings.binance_api_secret,
        "enableRateLimit": True,
    }
)
if settings.binance_testnet:
    exchange.set_sandbox_mode(True)
```

這幾行放在組裝根，不放在 `BinanceRestCandleSource` 裡面——那個類別收的是一個已經建好的 exchange，所以要換成 testnet、要換成別的帳號、要在測試裡換成替身，它都不用改。

`binance_testnet` 在 Day 01 就預設 `True`，這個預設值今天開始有意義。今天的資料回補走公開端點，不受它影響；Day 23 之後下單時，它是我們跟真錢之間的那道閘。

## 今日交付物

一支 `quantbot.entrypoints.backfill_command`，能回補任意交易對、任意時間範圍的 K 線。專案長出這些檔案：

```
quantbot/
├── domain/
│   ├── values/        source_kind.py                        ← 今天
│   ├── services/      source_routing_service.py             ← 今天
│   │                  data_integrity_service.py             ← 今天
│   │                  price_cross_check_service.py          ← 今天
│   ├── dto/           data_integrity_report.py              ← 今天
│   │                  price_cross_check_report.py           ← 今天
│   └── interfaces/    candle_source.py, candle_parser.py,   ← 今天
│                      reference_price_source.py, clock.py
├── application/       backfill_candles_application.py       ← 今天
├── infrastructure/
│   ├── binance/       binance_archive_url_builder.py        ← 今天
│   │                  binance_archive_downloader.py         ← 今天
│   │                  binance_archive_candle_source.py      ← 今天
│   │                  binance_rate_limit_guard.py           ← 今天
│   │                  binance_rest_candle_source.py         ← 今天
│   ├── coingecko/     coingecko_reference_price_source.py   ← 今天
│   └── system_clock.py                                      ← 今天
└── entrypoints/       backfill_command.py                   ← 今天
```

昨天的 `domain/values/`（五個值）、`domain/entities/candle_series.py`、`infrastructure/binance/binance_candle_csv_parser.py` 一個字都沒改，直接被今天的東西用。

檔案數量看起來多，但每一個都短，而且每一個都只有一件事。判斷有沒有切對的方法很簡單：**隨便指一個檔案，說得出它「不知道什麼」。** `binance_archive_url_builder.py` 不知道下載怎麼做；`source_routing_service.py` 不知道 Binance 存在；`backfill_candles_application.py` 不知道有 zip 這種東西。

跑起來是這樣：

```bash
uv run python -m quantbot.entrypoints.backfill_command \
    --symbol BTC/USDT --market spot --timeframe 1m \
    --start 2025-01-01 --end 2026-09-16 --out data/klines
```

跑完會產出三樣東西：

1. `data/klines/spot_BTCUSDT_1m.parquet`——回補好的 K 線，索引是 UTC 開盤時間，帶 `symbol` 與 `market` 欄。檔名來自 `Instrument.storage_key`。
2. `spot_BTCUSDT_1m_gaps.csv`——`DataIntegrityReportDto.to_frame()`，列出每一段缺口的起訖與根數。
3. 對照報告——`PriceCrossCheckReportDto.comparison`，含逐日相對誤差與被標記的日子。

### 驗收標準

七項全過才算完成。

1. **第一次跑完**，parquet 的列數等於 `expected_bar_count - missing_bar_count`。這兩個數字對不起來，代表去重或範圍切割有問題。
2. **立刻再跑一次**，日誌顯示所有批次檔都命中快取沒有重下，列數與第一次完全相同，且索引唯一。
3. **中途 Ctrl-C 再重跑**，最終結果與一次跑完相同。`data/raw/` 底下沒有任何 `.part` 檔殘留。
4. **對照報告的最大相對誤差小於 1%**，`passed` 沒有任何一列是 `False`。有的話先查那幾天，不要往下做。
5. **缺漏報告裡的每一段都解釋得出來**——對得上交易所公告的停機時間，或者那個 timeframe 真的沒有成交。解釋不出來的缺口是明天的問題，不要當它不存在。
6. **全程沒有出現 429**，日誌裡的 used weight 峰值不超過 1200。
7. **`uv run mypy quantbot` 全過。** 這一項是新的，而且它才是分層真正的把關者：`BinanceArchiveCandleSource` 有沒有真的滿足 `CandleSource`，只有型別檢查器驗得出來。順手把 `uv run lint-imports` 也加進去，它會擋掉「domain 不小心 import 了 infrastructure」這種倒著長的依賴。

第五項最容易被跳過。缺漏報告印出來有二十段、看一眼覺得「應該還好」就往下走，這是後面所有數字不對的起點——一段缺漏的 K 線會讓滾動計算的視窗實際涵蓋更長的時間，而它不會噴任何錯誤。Day 04 會遇到第一個這樣的例子。

補充一句：`--market usdm` 會寫到 `spot_` 換成 `usdm_` 的另一個檔案。這是刻意的，也不是靠自律維持的——檔名由 `Instrument.storage_key` 產生，而 `market` 是它的必填列舉欄位，所以沒有一條路徑能寫出不帶市場的檔名。

本系列為程式與資料工程的技術分享，所有數字皆為教學範例，不構成投資建議；加密貨幣波動劇烈，實際交易請自行評估風險。

## 明天

明天 Day 04，資料有了，來算第一個指標：移動平均。這是最基本的降噪工具，也是最容易算錯的東西之一——`rolling()` 的視窗預設包含當根、前 n-1 根是 NaN、資料有缺漏時視窗實際涵蓋的時間會超過帳面上的長度。三個地方都會安靜地給出數字，不會給出錯誤。

我們會把它寫成向量化的版本，用 `%timeit` 對照為什麼不要寫 for loop，並且第一次正式討論**未來函數**：什麼樣的寫法會讓我們在計算第 t 根的訊號時，不小心用到第 t 根之後才知道的資訊。這是整個系列最重要的警告，之後每個會遇到的地方都會再提一次。

## Reference

- [批次檔的目錄結構、檔案格式與 checksum 說明 — Binance Public Data](https://github.com/binance/binance-public-data)
- [K 線端點的單次上限、weight 與 IP 層級限流規則 — Binance Spot API Documentation](https://developers.binance.com/docs/binance-spot-api-docs)
- [現貨 testnet 的申請與端點 — Binance Spot Testnet](https://testnet.binance.vision/)
- [統一介面、`fetch_ohlcv` 的參數語意與 async 用法 — ccxt Manual](https://docs.ccxt.com/)
- [Demo 方案的額度與 `/coins/{id}/ohlc` 的粒度規則 — CoinGecko API Documentation](https://docs.coingecko.com/)
