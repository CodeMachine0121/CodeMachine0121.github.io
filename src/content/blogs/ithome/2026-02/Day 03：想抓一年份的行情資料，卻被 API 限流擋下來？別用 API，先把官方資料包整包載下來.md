---
title: "Day 03：想抓一年份的行情資料，卻被 API 限流擋下來？別用 API，先把官方資料包整包載下來"
datetime: "2026-09-17"
description: "大量歷史行情不該用 REST 翻頁抓。這篇先把翻頁次數算給你看，再把 data.binance.vision 的批次下載、checksum 驗證、欄位對映與缺口回補寫成一支可重跑的模組，並用 CoinGecko 對照驗證欄位沒接錯。"
image: ""
parent: "2026 ithome-鐵人賽: 工程師的量化交易入門：從 K 線到可組合的交易策略引擎 系列"
draft: true
---

## 一個月不夠用，你想要三年

昨天你手上多了一張 DataFrame：BTC/USDT 現貨的日線，一個月，存成 parquet，還畫了第一張 K 線圖。那份資料是手動來的——點一個連結、下載一個 zip、解壓、讀進 pandas。看結構夠了，做事不夠。

真正要做的事情規模不一樣。後面幾天要算指標、要驗證特徵有沒有預測力，需要的是**好幾年、分鐘等級**的資料，而且不只一個交易對。這時候多數人的第一個念頭是：那就去打 API 吧，寫個迴圈翻頁，睡一覺起來就抓完了。

這個念頭是今天要處理的第一件事。它不會完全失敗，但它會慢好幾個數量級、會在中途被擋下來、而且會吃掉你之後查帳戶跟下單要用的配額。先把數字算一次，你自己就會決定不走那條路。

## 先算一次：REST 翻頁到底要打幾次

要算之前，得先知道三個限制。這三個是 2026 年中的狀態，這類數字每年都會調整，動工前自己去官方文件確認一次。

**第一，單次上限 1000 根。** Binance 的 K 線端點一次最多回 1000 根，不管你要的是 1 分鐘還是 1 天。所以「要幾根」直接決定「要打幾次」。

**第二，每次請求 2 weight。** Binance 不是用「幾次請求」計費，是用 weight。不同端點的 weight 不同，K 線端點是 2。

**第三，每個 IP 每分鐘 2400 weight。** 這是整個 IP 共用的預算，不是每支程式各有一份。超過會收到 429；反覆忽略 429 會升級成 418，也就是 IP 被暫時封鎖，時間從幾分鐘到幾天都有可能。

現在來算。一年的 1 分鐘 K 線是 365 × 1440 = 525,600 根。

| 要抓的東西 | REST 翻頁 | data.binance.vision 批次 |
|---|---|---|
| BTCUSDT 現貨 1 分鐘，一年 | 525,600 ÷ 1000 = 526 次請求、1,052 weight，序列跑約 2 分鐘 | 12 個月檔（＋12 個 checksum），併發下載十幾秒 |
| 同一年，改成 1 秒 K 線 | 31,536,000 根 = 31,536 次請求、63,072 weight。光是 weight 配額就要 26 分鐘，序列實跑 2 小時起跳 | 一樣 12 個月檔，只是每個檔案大一點 |
| 20 個交易對 × 3 年 1 分鐘 | 31,560 次請求、63,120 weight，同樣是 26 分鐘配額、2 小時實跑 | 720 個檔案，併發 8 條約 3 分鐘 |
| 中途失敗了 | 要自己記錄翻到第幾頁，沒記就整段重來 | 重下那一個檔案，其他不受影響 |
| 對其他功能的影響 | weight 整個 IP 共用，你的帳戶查詢與下單跟它搶同一份 | 完全不吃 weight |

第一列看起來還好，526 次請求兩分鐘就跑完，這也是為什麼很多人真的就這樣做了。問題在第二、第三列：只要把粒度往下調一格、或者交易對從 1 個變成 20 個，成本就直接跳兩個數量級。而 1 秒 K 線正是 Day 01 挑 Binance 的三個理由之一，你遲早會用到。

最後一列常被忽略，但它是實際運作時最麻煩的地方。weight 是 IP 層級的共用預算，你的回補程式把配額吃光時，同一台機器上查帳戶餘額、查訂單的呼叫也會一起被擋。抓資料把下單流程拖垮，這種因果關係在事後很難查。

### 那 zip 那條路便宜在哪

Binance 有一個官方的公開資料下載站 `data.binance.vision`，把歷史行情預先打包成 zip 放著。它不經過 API 閘道，所以：

- 不計 weight，也沒有每分鐘的請求配額。
- 檔案是壓縮過的 CSV，同樣一個月的 1 分鐘 K 線，壓縮後只有幾 MB；走 REST 拿到的是 JSON 陣列，傳輸量大好幾倍。
- 每個檔案旁邊都有一份官方 SHA-256 checksum，你可以驗證下載完整，不必猜是不是傳輸壞掉。
- 檔案是定稿，不會今天抓跟明天抓不一樣。

代價只有一個：**它有延遲**。當日的資料隔天才上傳，月檔要到次月初才會出現。所以最近幾天的資料它沒有。

這就決定了整個設計。

### 三條路徑，各管一段

| 路徑 | 負責的時間範圍 | 拿什麼 | 代價 |
|---|---|---|---|
| data.binance.vision 批次 | 從很久以前到前天 | 大量歷史 K 線 | 有上傳延遲 |
| Binance REST（透過 ccxt） | 最後那幾天的缺口 | 批次還沒上傳的部分 | 吃 weight，要處理翻頁與退避 |
| Binance WebSocket | 從現在起往後 | 即時串流 | 要自己處理心跳與重連，Day 09 才接 |

今天做前兩條。第三條是 Day 09 的事，但現在就知道它存在，你才不會想用 REST 去輪詢即時價格——那是三條路徑裡最貴也最不準的做法。

這條「批次為主、REST 補洞」的分工，也是 Day 01 六條選型原則裡的第四條：歷史批次與即時串流是兩條路徑，分開設計。今天是它第一次真的落地。

## 交易概念補課

今天有四個新名詞。都是工程層面的東西，不需要交易背景。

### 交易對（symbol）

`BTC/USDT` 讀作「用 USDT 買賣 BTC」。斜線左邊是**基礎貨幣**（base），你實際在買賣的東西；右邊是**計價貨幣**（quote），你用來標價與結算的東西。所以「BTC/USDT 現在 68,000」的意思是一顆 BTC 值 68,000 USDT。

同一顆 BTC 可以有很多交易對：`BTC/USDT`、`BTC/USDC`、`BTC/EUR`。它們的價格接近但不相同，成交量差很多。挑計價貨幣的原則跟挑資料源一樣——挑成交量最大的那個，因為成交越密集，資料越完整。加密貨幣現貨這邊，USDT 交易對通常是量最大的。

寫程式時有一個小地方要注意：**同一個交易對有兩種寫法**。交易所原生的格式沒有斜線，是 `BTCUSDT`，批次檔的網址與檔名用的是這種；ccxt 為了跨交易所統一，用的是有斜線的 `BTC/USDT`。兩邊要轉換，而且轉換要放在同一個地方，不要每支程式各寫一次。

### 現貨與永續合約

這兩個是不同的市場，賣的東西不一樣。

**現貨（spot）** 是一手交錢一手交幣。你花 68,000 USDT 買一顆 BTC，那顆 BTC 就真的進到你的帳戶裡，你可以提出去、可以放著不動、可以明年再賣。沒有到期日，沒有槓桿，也不會有人來清算你。

**永續合約（perpetual futures）** 你買賣的不是幣，是一張「跟著 BTC 價格走」的合約。它沒有到期日（所以叫永續），可以開槓桿，可以直接做空。因為手上沒有真的幣，交易所要靠一個叫**資金費率**的機制，定期在多空雙方之間收付一筆錢，把合約價格拉回現貨附近。

對寫程式的人來說，關鍵差別在於：

| | 現貨 | 永續合約 |
|---|---|---|
| 價格 | 就是成交價 | 貼近現貨但有基差，會偏離 |
| 成交量 | 實際換手的幣量 | 合約張數，跟現貨不可比 |
| 費用 | 手續費 | 手續費＋每 8 小時的資金費率 |
| 資料網址 | `data/spot/...` | `data/futures/um/...` |

Day 01 的第三條選型原則說過：**兩者的資料 NEVER 混用**。今天要補的是它為什麼難發現。你把兩邊的收盤價畫在同一張圖上，肉眼幾乎分不出差別，因為永續會被套利拉回現貨附近。差異藏在成交量、藏在極端行情那幾根、藏在資金費率造成的長期偏移，而這些都不是你會盯著看的東西。

防守方式只有一個，而且要從第一行程式碼就開始：**market 是一個必填參數，不是預設值**。網址前綴不同、檔案分開存、DataFrame 帶一欄 `market`。今天寫的模組會強制這件事。

本系列主線是現貨，所以除非特別標註，出現的都是現貨。

### 限流（rate limit）

前面算過了，這裡補兩個實作上的細節。

Binance 在每個回應的標頭裡告訴你目前用掉多少：`X-MBX-USED-WEIGHT-1M` 是這一分鐘的累計 weight。這個標頭很有用，因為它讓你**不必猜**。你不用在請求之間硬塞 `sleep(0.5)` 賭它夠慢，而是讀標頭、逼近上限就主動退讓。

另外要區分兩種等待。收到 429 之後的等待是**被動的**，那時候已經超了；讀標頭主動放慢是**預防性的**。兩個都要有，但只靠前者的程式，實際跑起來會一直在 429 邊緣震盪。

### testnet

Binance 提供一個叫 testnet 的環境，網址與正式環境不同、帳戶是假的、錢是假的，但 API 介面一模一樣。你可以在上面下單、成交、查帳戶餘額，流程跟正式環境沒有差別。

它的定位要講清楚，不然很容易誤用：

- **歷史行情不從 testnet 拿。** testnet 的成交是測試用戶自己打出來的，深度與價格都不真實。所有市場資料一律來自正式環境的公開端點與批次檔。
- **testnet 是用來練下單流程的。** 簽章對不對、參數格式對不對、被拒單時回什麼錯誤，這些在 testnet 上弄清楚，成本是零。
- **testnet 的 key 跟正式環境的 key 完全分開申請**，互不通用。

順帶一提，今天寫的這支程式**一把 API key 都不需要**。批次檔是公開下載，K 線端點是公開端點，兩者都不用驗證。key 是 Day 23 之後下單才要的。但既然今天第一次提到，安全設定就一次講完，因為那是設定的時候要做對的事，不是事後補得回來的。

## 工程實作

### 為什麼用 asyncio 不用 threading

這件事的本質很單純：這支程式絕大部分時間在等網路回應，不是在算東西。720 個檔案的下載，CPU 使用率大概只有個位數百分比。

threading 也能做 I/O 併發，但在這個場景下 asyncio 比較適合：

- 併發數要開到幾十上百時，thread 的建立成本與切換成本不划算，而 coroutine 是普通物件。
- 控併發量的 `asyncio.Semaphore` 跑在單一事件迴圈裡，不需要處理跨執行緒的鎖與競態；共用狀態（例如「目前累計的 weight」）直接讀寫就好。
- ccxt 有原生的 async 版本（`ccxt.async_support`），跟 `aiohttp` 是同一套生態。

但有一個地方要小心：**解壓與 pandas 解析是 CPU 密集的**，把它們直接寫在 coroutine 裡會阻塞整個事件迴圈，讓其他下載也跟著停住。這段要用 `asyncio.to_thread` 丟出去。後面的程式碼會標出來。

### 批次檔的網址結構

規則很固定：

```
https://data.binance.vision/data/{market}/{period}/klines/{SYMBOL}/{INTERVAL}/{SYMBOL}-{INTERVAL}-{DATE}.zip
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

注意現貨與永續在網址上就分開了。這其實是好事——你不會不小心「順手」抓錯，除非你自己去改那個前綴。

先把這幾件事寫成常數與函式，放進 `quantbot/ingest/binance.py`：

```python
# quantbot/ingest/binance.py
from __future__ import annotations

import asyncio
import hashlib
import io
import random
import zipfile
from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path

import aiohttp
import pandas as pd

BULK_BASE = "https://data.binance.vision/data"

# 現貨與永續的網址前綴不同，這裡就把它們隔開，避免任何地方「順手」共用
MARKET_PREFIX: dict[str, str] = {
    "spot": "spot",
    "usdm": "futures/um",
}

# 官方 CSV 沒有標頭，欄位順序只能查文件。順序錯了不會報錯，只會安靜地把
# 成交筆數當成價格用，所以這個對映表是整支程式最不能寫錯的地方。
KLINE_COLUMNS: list[str] = [
    "open_time",
    "open",
    "high",
    "low",
    "close",
    "volume",
    "close_time",
    "quote_volume",
    "trades",
    "taker_buy_base",
    "taker_buy_quote",
    "ignore",
]

PRICE_COLUMNS = ["open", "high", "low", "close", "volume", "quote_volume",
                 "taker_buy_base", "taker_buy_quote"]


def to_native_symbol(symbol: str) -> str:
    """把 ccxt 的 BTC/USDT 轉成交易所原生的 BTCUSDT。轉換只寫在這裡一份。"""
    return symbol.replace("/", "").upper()


def monthly_url(symbol: str, interval: str, month: date, market: str) -> str:
    """組出某個月份 K 線 zip 的下載網址。"""
    native = to_native_symbol(symbol)
    prefix = MARKET_PREFIX[market]
    filename = f"{native}-{interval}-{month:%Y-%m}.zip"
    return f"{BULK_BASE}/{prefix}/monthly/klines/{native}/{interval}/{filename}"


def daily_url(symbol: str, interval: str, day: date, market: str) -> str:
    """組出某一天 K 線 zip 的下載網址。用來補月檔還沒出來的那幾天。"""
    native = to_native_symbol(symbol)
    prefix = MARKET_PREFIX[market]
    filename = f"{native}-{interval}-{day:%Y-%m-%d}.zip"
    return f"{BULK_BASE}/{prefix}/daily/klines/{native}/{interval}/{filename}"
```

### 併發下載並驗證 checksum

下載這一段要處理四件事：控併發、驗 checksum、快取到本機、以及「檔案還沒上傳」的 404 不是錯誤。

最後一項是重跑能力的關鍵。當月的月檔本來就不存在，昨天的日檔可能還沒上傳完，這些都會回 404。如果把 404 當例外往上丟，程式每次跑到最新那幾天都會炸。正確的處理是回 `None`，讓上層知道「這段批次沒有，交給 REST」。

```python
async def fetch_archive(
    session: aiohttp.ClientSession,
    url: str,
    cache_dir: Path,
    semaphore: asyncio.Semaphore,
) -> bytes | None:
    """下載一個批次 zip 並用官方 checksum 驗證。

    回傳 zip 的位元組內容；檔案不存在（尚未上傳）時回傳 None。
    本機已經有驗證過的檔案就直接讀，所以中斷後重跑不會重下。
    """
    cache_dir.mkdir(parents=True, exist_ok=True)
    cached = cache_dir / url.rsplit("/", 1)[-1]
    if cached.exists():
        return cached.read_bytes()

    async with semaphore:
        expected = await _fetch_checksum(session, f"{url}.CHECKSUM")
        if expected is None:
            return None  # 連 checksum 都沒有，代表這個檔案還沒上傳

        async with session.get(url) as response:
            if response.status == 404:
                return None
            response.raise_for_status()
            payload = await response.read()

    actual = hashlib.sha256(payload).hexdigest()
    if actual != expected:
        raise ValueError(f"checksum 不符：{url}（預期 {expected}，實得 {actual}）")

    # 驗過才落地。半途中斷留下的檔案不會被下次執行當成有效快取。
    tmp = cached.with_suffix(cached.suffix + ".part")
    tmp.write_bytes(payload)
    tmp.rename(cached)
    return payload


async def _fetch_checksum(session: aiohttp.ClientSession, url: str) -> str | None:
    """讀取官方的 .CHECKSUM 檔，格式是「<sha256>  <檔名>」。"""
    async with session.get(url) as response:
        if response.status == 404:
            return None
        response.raise_for_status()
        text = await response.text()
    return text.split()[0]
```

驗 checksum 不是形式主義。這些檔案動輒幾 MB，下載中斷留下半截檔案是很常見的事，而半截的 zip 解壓後可能還是有幾萬列看起來正常的資料，只是尾巴斷了。斷在哪裡你不會知道，直到後面某個計算結果不對，你才回頭花一個下午找。

寫入採「先寫 `.part` 再改名」，是為了讓快取只有兩種狀態：完整可用，或不存在。中斷不會留下第三種狀態。

### 解壓與欄位對映

官方 CSV 有幾個要注意的地方，一次講完。

**沒有標頭，欄位順序要查文件。** 12 欄，順序就是上面 `KLINE_COLUMNS` 那份。最後一欄 `ignore` 官方保留不用，但它佔一個位置，少算一欄後面全錯。第 9 到 11 欄（成交筆數、主動買進量）現在用不到，但先照樣存下來，第二階段會用到。

**檔案格式改過。** 2025 年之後的檔案開頭多了一行標頭，時間戳的單位也從毫秒改成微秒（這是 2026 年中的狀態，以官方 repo 的說明為準）。與其在程式裡寫死年份判斷，用偵測的比較穩：讀第一格能不能轉成數字，決定有沒有標頭；看時間戳的量級，決定單位是毫秒還是微秒。這樣未來格式再改，也不用改判斷邏輯。

**時間戳是開盤時間。** 這點 Day 02 講過，這裡再確認一次：`open_time` 是這根 K 線的開始，不是結束。全部轉成 UTC 的 `DatetimeIndex`。

```python
def parse_archive(payload: bytes) -> pd.DataFrame:
    """把批次 zip 解壓成一張 DataFrame，索引是 UTC 的開盤時間。

    這個函式是 CPU 密集的，呼叫端要用 asyncio.to_thread 丟出事件迴圈。
    """
    with zipfile.ZipFile(io.BytesIO(payload)) as archive:
        name = archive.namelist()[0]
        raw = archive.read(name)

    # 2025 年起的檔案多了一行標頭。用「第一格是不是數字」偵測，不寫死年份。
    first_cell = raw[: raw.find(b",")].decode("utf-8", errors="ignore").strip()
    has_header = not first_cell.lstrip("-").isdigit()

    frame = pd.read_csv(
        io.BytesIO(raw),
        header=0 if has_header else None,
        names=KLINE_COLUMNS,
        skiprows=1 if has_header else 0,
    )

    # 毫秒是 13 位數（約 1.7e12），微秒是 16 位數（約 1.7e15），量級差三個數量級。
    unit = "us" if frame["open_time"].iloc[0] > 1e14 else "ms"
    frame["open_time"] = pd.to_datetime(frame["open_time"], unit=unit, utc=True)

    frame[PRICE_COLUMNS] = frame[PRICE_COLUMNS].astype("float64")
    frame["trades"] = frame["trades"].astype("int64")

    return (
        frame.drop(columns=["close_time", "ignore"])
        .set_index("open_time")
        .sort_index()
    )
```

價格欄一律轉 `float64`。CSV 讀進來如果某一欄混了非數值，pandas 會給你 `object` 型別，之後所有計算都會安靜地變慢或變錯。明確轉型是為了讓錯誤在這一行就爆出來。

### 決定哪段走批次、哪段走 REST

有了上傳延遲這個已知條件，路由邏輯就寫得出來：**距今 N 天以內的一律當成批次沒有，交給 REST；再往前，能用月檔就用月檔，月檔蓋不到的零頭用日檔。**

N 給 2 天是保守的取法。當日資料隔日上傳，但上傳有時間，抓一個緩衝比較安全。多抓一天的 REST 成本很低（1440 根 = 2 次請求），少抓一天造成的缺漏卻要之後才會發現。

```python
@dataclass(frozen=True)
class BackfillPlan:
    """一次回補要走哪幾條路徑。"""

    months: list[date]      # 走月檔
    days: list[date]        # 走日檔（月檔蓋不到的零頭）
    rest_from: pd.Timestamp  # 從這個時間點之後只能走 REST


def plan_backfill(
    start: pd.Timestamp,
    end: pd.Timestamp,
    *,
    bulk_lag_days: int = 2,
) -> BackfillPlan:
    """依官方的上傳節奏切出三段。

    當日資料隔日上傳、月檔次月初才會出現，所以最後 bulk_lag_days 天
    一律當成批次還沒有，直接交給 REST。
    """
    cutoff = (end - pd.Timedelta(days=bulk_lag_days)).normalize()

    months: list[date] = []
    cursor = pd.Timestamp(start).normalize().replace(day=1)
    while cursor <= cutoff:
        month_end = cursor + pd.offsets.MonthEnd(0)
        if cursor >= start.normalize() and month_end <= cutoff:
            months.append(cursor.date())
        cursor = cursor + pd.offsets.MonthBegin(1)

    covered = {
        d.date()
        for m in months
        for d in pd.date_range(pd.Timestamp(m), pd.Timestamp(m) + pd.offsets.MonthEnd(0))
    }
    days = [
        d.date()
        for d in pd.date_range(start.normalize(), cutoff, freq="D")
        if d.date() not in covered
    ]

    return BackfillPlan(months=months, days=days, rest_from=cutoff + pd.Timedelta(days=1))
```

### 用 ccxt 補最後幾天

REST 這段只負責幾天的資料，但翻頁邏輯還是要寫對，因為 Day 08 會拿同一支函式去補任意長度的缺漏。

翻頁最容易錯的是游標怎麼推進。`fetch_ohlcv(symbol, timeframe, since=t)` 的 `since` 是**包含**的：回傳的第一根就是 `t` 那一根。所以下一頁的游標有三種寫法，只有一種對：

| 下一頁的 since | 結果 |
|---|---|
| `last_open` | 重複拿到最後一根 |
| `last_open + 2 * step` | 漏掉一根 |
| `last_open + step` | 正確 |

還有一個要處理的：**最後一根 K 線還沒收完**。Day 02 提過這件事，這裡要在程式碼裡真的擋住它。交易所會把當下這根還在跳動的 K 線一起回給你，它的收盤價每秒都在變，存進資料庫就會變成一筆「看起來是歷史、其實是即時」的髒資料。

```python
def last_closed_open_time(exchange, timeframe: str) -> int:
    """回傳最後一根**已經收盤**的 K 線開盤時間（毫秒）。

    (now // step) * step 是當下這根還沒收完的 K 線，所以要再退一格。
    """
    step_ms = exchange.parse_timeframe(timeframe) * 1000
    now_ms = exchange.milliseconds()
    return (now_ms // step_ms) * step_ms - step_ms


async def fetch_rest_range(
    exchange,
    symbol: str,
    timeframe: str,
    since_ms: int,
    until_ms: int,
    *,
    limit: int = 1000,
    weight_ceiling: int = 1200,
) -> pd.DataFrame:
    """用 REST 翻頁補一段區間，只回傳已收盤的 K 線。

    weight_ceiling 是主動退讓的門檻，取每分鐘上限（2400）的一半，
    留一半給帳戶查詢與下單用。
    """
    step_ms = exchange.parse_timeframe(timeframe) * 1000
    rows: list[list[float]] = []
    cursor = since_ms

    while cursor <= until_ms:
        batch = await with_retry(
            lambda: exchange.fetch_ohlcv(symbol, timeframe, since=cursor, limit=limit)
        )
        if not batch:
            break

        rows.extend(batch)
        next_cursor = batch[-1][0] + step_ms   # since 是含頭的，所以要 +1 個間隔
        if next_cursor <= cursor:
            break  # 交易所回了同一頁，再翻下去會是無窮迴圈
        cursor = next_cursor

        await yield_if_heavy(exchange, weight_ceiling)

    frame = pd.DataFrame(rows, columns=["open_time", "open", "high", "low", "close", "volume"])
    frame["open_time"] = pd.to_datetime(frame["open_time"], unit="ms", utc=True)
    frame = frame.set_index("open_time").sort_index()
    frame = frame[~frame.index.duplicated(keep="last")]

    # 只留下已收盤而且在要求範圍內的
    return frame.loc[: pd.Timestamp(until_ms, unit="ms", tz="UTC")]
```

那個 `if next_cursor <= cursor: break` 看起來多餘，但它擋的是一整類問題。交易所偶爾會在某些邊界回一個不推進的結果，沒有這行，程式會安靜地跑一整晚打幾十萬次請求，然後被 418 擋下來。任何 while 迴圈只要游標由外部回傳的資料決定，就該有這道保險。

### 主動退讓與指數退避

兩件不同的事，分開寫。

```python
def _header(exchange, name: str) -> str | None:
    """從 ccxt 的最後一次回應標頭取值。標頭大小寫不保證，統一轉小寫比對。"""
    headers = {k.lower(): v for k, v in (exchange.last_response_headers or {}).items()}
    return headers.get(name.lower())


async def yield_if_heavy(exchange, ceiling: int) -> None:
    """讀 X-MBX-USED-WEIGHT-1M，逼近門檻就主動睡到下一分鐘。

    這是預防性的等待。只靠 429 之後才退避的程式，會一直在上限邊緣震盪。
    """
    used = _header(exchange, "x-mbx-used-weight-1m")
    if used is not None and int(used) > ceiling:
        await asyncio.sleep(60 - pd.Timestamp.utcnow().second)


async def with_retry(factory, *, attempts: int = 5, base: float = 1.0):
    """指數退避重試。只重試暫時性錯誤，參數錯誤之類的直接往上丟。"""
    import ccxt.async_support as ccxt

    transient = (ccxt.RateLimitExceeded, ccxt.NetworkError, ccxt.ExchangeNotAvailable)
    for attempt in range(attempts):
        try:
            return await factory()
        except transient:
            if attempt == attempts - 1:
                raise
            # 加上抖動，避免多個併發任務同時醒來再撞一次
            delay = base * (2**attempt) + random.uniform(0, 0.5)
            await asyncio.sleep(delay)
```

退避要加抖動的理由：如果八條併發任務同時撞到 429、同時退避 1 秒、同時醒來，一秒後會再撞一次，退避 2 秒，再一起醒來。沒有抖動的退避，退的是同一群人。

只重試暫時性錯誤也是刻意的。`ccxt.BadRequest`（參數寫錯）重試五次還是錯，只是把一個 5 秒就能發現的問題拖成 30 秒，而且錯誤訊息會被淹沒在重試日誌裡。

### 串起來

```python
async def backfill(
    symbol: str,
    interval: str,
    start: pd.Timestamp,
    end: pd.Timestamp,
    *,
    market: str = "spot",
    cache_dir: Path = Path("data/raw"),
    concurrency: int = 8,
) -> pd.DataFrame:
    """回補一個交易對、一段時間範圍的 K 線。

    自動決定哪段走批次、哪段走 REST；中斷後重跑不會重複下載也不會產生重複列。
    market 沒有預設值以外的魔法：現貨與永續分開存，NEVER 混在同一張表。
    """
    import ccxt.async_support as ccxt

    if market not in MARKET_PREFIX:
        raise ValueError(f"未知的 market：{market}")

    plan = plan_backfill(start, end)
    semaphore = asyncio.Semaphore(concurrency)
    frames: list[pd.DataFrame] = []

    async with aiohttp.ClientSession() as session:
        urls = (
            [monthly_url(symbol, interval, m, market) for m in plan.months]
            + [daily_url(symbol, interval, d, market) for d in plan.days]
        )
        payloads = await asyncio.gather(
            *(fetch_archive(session, url, cache_dir, semaphore) for url in urls)
        )
        # 解壓與解析是 CPU 密集的，丟到執行緒池，不要阻塞事件迴圈
        parsed = await asyncio.gather(
            *(asyncio.to_thread(parse_archive, p) for p in payloads if p is not None)
        )
        frames.extend(parsed)

    exchange = ccxt.binance({"enableRateLimit": True})
    try:
        until_ms = min(
            last_closed_open_time(exchange, interval),
            int(end.timestamp() * 1000),
        )
        since_ms = int(plan.rest_from.timestamp() * 1000)
        if since_ms <= until_ms:
            frames.append(
                await fetch_rest_range(exchange, symbol, interval, since_ms, until_ms)
            )
    finally:
        await exchange.close()

    combined = pd.concat(frames).sort_index()
    # 批次檔是定稿、REST 是暫時的，重疊時以先放進來的批次為準
    combined = combined[~combined.index.duplicated(keep="first")]
    combined["symbol"] = symbol
    combined["market"] = market
    return combined.loc[start:end]
```

冪等性來自三個地方，缺一不可：檔案快取（已驗證的 zip 不重下）、`duplicated` 去重（重疊區間不會變成兩列）、以及 `.part` 暫存檔（中斷不會留下半截的有效快取）。

### 缺漏偵測

回補完不代表資料是完整的。交易所會停機維護、某些冷門交易對某幾分鐘真的沒有成交，這些都會留下缺口。先把缺口列出來，你才有機會判斷它是不是問題。

```python
_INTERVAL_TO_FREQ = {"1s": "1s", "1m": "1min", "5m": "5min", "1h": "1h", "1d": "1D"}


def find_gaps(frame: pd.DataFrame, interval: str) -> pd.DataFrame:
    """列出實際資料相對於完整時間序列缺了哪幾段。"""
    step = pd.Timedelta(_INTERVAL_TO_FREQ[interval])
    expected = pd.date_range(frame.index.min(), frame.index.max(), freq=step)
    missing = expected.difference(frame.index)
    if missing.empty:
        return pd.DataFrame(columns=["gap_start", "gap_end", "missing_bars"])

    # 與前一個缺漏點的距離不等於一個 step，就是新的一段
    series = missing.to_series()
    block = (series.diff() != step).cumsum()
    grouped = series.groupby(block)
    return pd.DataFrame(
        {
            "gap_start": grouped.min().to_numpy(),
            "gap_end": grouped.max().to_numpy(),
            "missing_bars": grouped.size().to_numpy(),
        }
    )
```

這裡用 `difference` 與 `groupby` 做，沒有迴圈。缺漏偵測要在幾百萬列上跑，寫成逐根比對會慢到你不想跑它，而一個你不想跑的檢查等於沒有這個檢查。

## 驗證：跟 CoinGecko 對一遍

Day 01 的第五條選型原則：每個主來源都要有對照組。今天是第一次真的執行。

要先講清楚**這個對照在驗什麼、不驗什麼**。CoinGecko 給的是跨交易所的 USD 加權參考價，Binance 給的是這個交易所的 USDT 成交價。兩者本來就不會一樣，USDT 對 USD 也有微小的偏離。所以不要期待數字相等。

它能抓到的是**量級錯誤**，而那正是欄位對映最常見的出錯方式：欄位順序錯一格，你會拿成交量當收盤價，數字差幾千倍；時間戳單位搞錯，整條序列會平移到 1970 年或 55000 年；價格欄型別沒轉好，你會拿到字串比較的結果。這些錯誤全部都是「差很多」，用一個 1% 的相對誤差門檻就攔得下來。

```python
async def fetch_coingecko_daily(
    session: aiohttp.ClientSession,
    coin_id: str = "bitcoin",
    days: int = 30,
    api_key: str = "",
) -> pd.DataFrame:
    """從 CoinGecko 取一段 OHLC 當對照組，聚合成日線。

    Demo 方案的 /ohlc 端點會依 days 自動決定粒度（days=30 時是 4 小時），
    所以這裡要自己 resample 成日線再比。額度與粒度規則是 2026 年中的狀態。
    """
    url = f"https://api.coingecko.com/api/v3/coins/{coin_id}/ohlc"
    headers = {"x-cg-demo-api-key": api_key} if api_key else {}
    async with session.get(
        url, params={"vs_currency": "usd", "days": str(days)}, headers=headers
    ) as response:
        response.raise_for_status()
        payload = await response.json()

    frame = pd.DataFrame(payload, columns=["ts", "open", "high", "low", "close"])
    frame["ts"] = pd.to_datetime(frame["ts"], unit="ms", utc=True)
    return (
        frame.set_index("ts")
        .resample("1D")
        .agg({"open": "first", "high": "max", "low": "min", "close": "last"})
        .dropna()
    )


def compare_sources(
    primary: pd.DataFrame,
    reference: pd.DataFrame,
    *,
    tolerance: float = 0.01,
) -> pd.DataFrame:
    """比對主來源與對照組的日線收盤價，標出相對誤差超過門檻的日子。"""
    merged = (
        primary[["close"]]
        .resample("1D")
        .last()
        .join(reference[["close"]], lsuffix="_binance", rsuffix="_coingecko", how="inner")
        .dropna()
    )
    merged["rel_diff"] = (
        (merged["close_binance"] - merged["close_coingecko"]).abs()
        / merged["close_coingecko"]
    )
    merged["flagged"] = merged["rel_diff"] > tolerance
    return merged
```

正常情況下 `rel_diff` 的最大值會落在千分之幾。看到百分之幾就要查是哪一天、是不是那天有極端行情；看到幾十倍幾千倍，回去看欄位對映與時間戳單位，八成錯在那兩個地方。

比對結果要輸出成報告的一部分，不要只在終端機印一次就算了。Day 08 把這一段接進管線時，這份報告會變成每天自動產出的東西。

## API key 的安全設定

今天用不到 key，但既然講到了 REST，就把設定講完。這幾件事都是「申請的時候要做對」，事後補的效果差很多。

**權限只開需要的兩項。** 建立 key 時勾選讀取與現貨交易，**NEVER 勾提幣（Enable Withdrawals）**。這一條沒有折衷空間。你的程式從頭到尾不需要把幣轉出去，開了提幣權限只是給洩漏的後果加上一個上限——從「有人可以亂下單」變成「有人可以把錢拿走」。

**綁 IP 白名單。** 填你的 VPS 或家用固定 IP。這樣即使 key 洩漏，別人在別的地方也用不了。順帶一提，Binance 對沒有綁 IP 的 key 有額外限制，閒置一段時間會自動停用（2026 年中的規則是 90 天，以官方公告為準），所以綁白名單同時也省掉每隔幾個月重新申請的麻煩。

**key 一律從 .env 讀。** Day 01 的 `Settings` 已經有欄位了，今天把對照組的 key 也加進去：

```python
# quantbot/config.py（在 Day 01 的 Settings 上補兩個欄位）
class Settings(BaseSettings):
    ...
    coingecko_api_key: str = ""       # 對照組用，可留空走匿名額度
    raw_data_dir: Path = Path("data/raw")
```

`.env` 早就在 `.gitignore` 裡了。今天再多加一件事：**把 `data/` 也加進去**。批次 zip 跟 parquet 動輒幾百 MB，不小心 commit 進去，之後要清乾淨很花時間。Day 01 的 `.gitignore` 已經有這兩行，確認一下還在。

**實單前一律先用 testnet。** ccxt 切換只要一行：

```python
exchange = ccxt.binance({
    "apiKey": settings.binance_api_key,
    "secret": settings.binance_api_secret,
    "enableRateLimit": True,
})
if settings.binance_testnet:
    exchange.set_sandbox_mode(True)
```

`binance_testnet` 在 Day 01 就預設 `True`，這個預設值今天開始有意義。今天的資料回補走公開端點，不受它影響；Day 23 之後下單時，它是你跟真錢之間的那道閘。

## 今日交付物

`quantbot/ingest/binance.py`，一支能回補任意交易對、任意時間範圍 K 線的模組。加上一個 CLI 進入點：

```bash
python -m quantbot.ingest.binance \
    --symbol BTC/USDT --market spot --interval 1m \
    --start 2025-01-01 --end 2026-09-16 \
    --out data/klines --verify
```

跑完會產出三樣東西：

1. `data/klines/spot_BTCUSDT_1m.parquet`——回補好的 K 線，索引是 UTC 開盤時間，帶 `symbol` 與 `market` 欄。
2. 一份缺漏報告——`find_gaps` 的輸出，列出每一段缺口的起訖與根數。
3. 一份對照報告——`compare_sources` 的輸出，含最大相對誤差與被標記的日子。

### 驗收標準

六項全過才算完成。

1. **第一次跑完**，parquet 的列數等於「期望根數減掉缺漏報告裡的總根數」。這兩個數字對不起來，代表去重或範圍切割有問題。
2. **立刻再跑一次**，日誌顯示所有批次檔都命中快取沒有重下，parquet 的列數與第一次完全相同，且 `frame.index.is_unique` 為 `True`。
3. **中途 Ctrl-C 再重跑**，最終結果與一次跑完相同。`data/raw/` 底下沒有任何 `.part` 檔殘留。
4. **對照報告的最大相對誤差小於 1%**，`flagged` 沒有任何一列為 `True`。有的話先查那幾天，不要往下做。
5. **缺漏報告裡的每一段都解釋得出來**——對得上交易所公告的停機時間，或者那個 interval 真的沒有成交。解釋不出來的缺口是明天的問題，不要當它不存在。
6. **全程沒有出現 429**，日誌裡的 used weight 峰值不超過 1200。

第五項最容易被跳過。缺漏報告印出來有二十段、你看一眼覺得「應該還好」就往下走，這是後面所有數字不對的起點——一段缺漏的 K 線會讓滾動計算的視窗實際涵蓋更長的時間，而它不會噴任何錯誤。Day 04 會遇到第一個這樣的例子。

補充一句：`--market usdm` 會寫到 `spot_` 換成 `usdm_` 的另一個檔案。這是刻意的。兩個市場的資料從檔名開始就分開，你不會有機會混用。

本系列為程式與資料工程的技術分享，所有數字皆為教學範例，不構成投資建議；加密貨幣波動劇烈，實際交易請自行評估風險。

## 明天

明天 Day 04，資料有了，來算第一個指標：移動平均。這是最基本的降噪工具，也是最容易算錯的東西之一——`rolling()` 的視窗預設包含當根、前 n-1 根是 NaN、資料有缺漏時視窗實際涵蓋的時間會超過你以為的長度。三個地方都會安靜地給你數字，不會給你錯誤。

我們會把它寫成向量化的版本，用 `%timeit` 對照為什麼不要寫 for loop，並且第一次正式討論**未來函數**：什麼樣的寫法會讓你在計算第 t 根的訊號時，不小心用到第 t 根之後才知道的資訊。這是整個系列最重要的警告，之後每個會遇到的地方都會再提一次。

## Reference

- [批次檔的目錄結構、檔案格式與 checksum 說明 — Binance Public Data](https://github.com/binance/binance-public-data)
- [K 線端點的單次上限、weight 與 IP 層級限流規則 — Binance Spot API Documentation](https://developers.binance.com/docs/binance-spot-api-docs)
- [現貨 testnet 的申請與端點 — Binance Spot Testnet](https://testnet.binance.vision/)
- [統一介面、`fetch_ohlcv` 的參數語意與 async 用法 — ccxt Manual](https://docs.ccxt.com/)
- [Demo 方案的額度與 `/coins/{id}/ohlc` 的粒度規則 — CoinGecko API Documentation](https://docs.coingecko.com/)
