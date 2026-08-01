---
title: "Day 08：第一階段總結：把擷取、清洗、入庫串成一條每天自己跑的 Pipeline"
datetime: "2026-09-22"
description: "前六天的零件都在，但還是靠你手動接。這篇把盤點、路由、回補、清洗、入庫、複驗串成一條 cron 叫得動的管線，重點放在冪等與可觀測：跑兩次結果一樣，出錯知道是哪一段，最後吐出一份資料完整性報告。"
image: ""
parent: "2026 ithome-鐵人賽: 工程師的量化交易入門：從 K 線到可組合的交易策略引擎 系列"
draft: true
---

## 零件都齊了，但它們之間還是你

昨天你把 TimescaleDB 的 schema 建好、寫入做成冪等的了。要驗證它能用，你大概是這樣做的：手動跑一次 Day 03 的擷取腳本、把回傳的 DataFrame 看一眼、再手動呼叫 `storage` 寫進去。一個交易對、一次性回補，這樣做完全沒問題。

問題是這條路你不會只走一次。明天早上你會想看昨天的資料，下週你會想把 ETH/USDT 加進來，某天你在畫圖的時候會發現三個禮拜前有一段沒抓到。每次都手動跑一遍，遲早會有一次漏掉，或是同一段跑了兩次。

今天要做的事就是把這些手動步驟接成一條管線，讓 cron 叫得動它，而且叫幾次都不會出事。整條管線只有兩個設計目標：

- **冪等**：同一條指令跑一次跟跑五次，資料庫的狀態一模一樣。
- **可觀測**：跑完你要知道補了哪幾段、哪幾段沒補到、哪幾根資料看起來不對勁。管線不能只回傳「成功」。

## 交易概念補課：一根缺漏的 K 線會讓你的均線錯十天

今天沒有新的交易術語。但有一件事必須先講清楚，否則後面那些工程細節看起來都像過度設計。

假設你在抓 BTC/USDT 現貨的 1 分鐘 K 線。某天 02:13 到 02:17 這五根沒抓到，可能是 REST 翻頁時 off-by-one，也可能是那次請求逾時之後你的重試邏輯跳過了它。一天有 1440 根 K 線，缺 5 根是 0.35%，把圖畫出來你肉眼絕對看不出來。

現在你在這段資料上算 20 週期均線：

```python
df["ma20"] = df["close"].rolling(20).mean()
```

`rolling(20)` 取的是「這張表往前數 20 列」，不是「往前數 20 分鐘」。缺口之後的第一根 K 線，它的 MA20 用到的 20 列實際橫跨了 25 分鐘。第二根也是，第三根也是，一直到缺口被推出視窗為止，總共 20 根 K 線的均線都是「過去 25 分鐘的平均」，而你以為它是 20 分鐘。

Day 05 的 EMA 與 Day 06 的 RSI 更麻煩一點。遞迴指標的每個值都依賴前一個值，缺漏的影響不會在 20 根之後乾淨地消失，只會隨著平滑係數慢慢衰減。

整件事最麻煩的地方在於：**沒有任何錯誤訊息**。`rolling` 不會抱怨，`pandas-ta` 對照組也不會，因為它拿到的是同一張有缺漏的表，兩邊會漂亮地算出同一個錯誤答案。Day 04 到 Day 06 建立的對照組習慣，防的是「你的公式寫錯」，防不了「你的資料少了幾列」。

有人會想到改用時間基準的視窗，`rolling("20min")`。這確實讓視窗涵蓋的時間變正確了，但視窗裡的樣本數變少，算出來的均線一樣不是你以為的那個東西，只是錯得比較溫和。真正的處理方式是讓缺漏成為一件你知道的事：管線每次跑完都要能回答「這段時間該有幾根、實際有幾根、差的那幾根在哪裡」。

## 資料來源：今天不引入新來源，只是把三條路徑接起來

今天沒有新的 provider。用的還是 Day 03 那三條路徑，加上 Day 01 就講好的對照組：

| 用途 | 來源 | 這條管線裡負責哪一段 |
|---|---|---|
| 大量歷史回補 | data.binance.vision 批次 zip | 缺口在兩天以前、而且夠長的那些 |
| 近期缺口回補 | Binance REST（透過 ccxt） | 批次檔還沒上傳的那幾天，以及零星的小缺口 |
| 即時串流 | Binance WebSocket | 今天還沒接，Day 09 才進來 |
| 對照驗證 | CoinGecko、CryptoDataDownload | 管線最後一步的抽樣比對 |

要注意批次檔有上傳延遲：daily zip 是隔日上傳，monthly 要等次月初。所以「昨天 00:00 UTC」之後的資料，不管缺口多長都只能走 REST。這個邊界會直接寫進路由邏輯。

## 管線長什麼樣子

六個步驟，順序不能換：

```
cron（每小時第 5 分鐘）
 │
 ├─ 讀設定檔：要顧哪些 symbol / timeframe / market / 從哪天開始
 │
 ▼
[1] 盤點   查 DB 現有的 open_time，跟預期的時間軸做 diff → 缺口清單
 │
 ▼
[2] 路由   每個缺口切成（批次段, REST 段），依長度與批次檔上傳延遲決定
 │
 ▼
[3] 取得   批次段 → data.binance.vision zip；REST 段 → ccxt 翻頁
 │
 ▼
[4] 清洗   時區統一 → 去重 → OHLC 邏輯檢查 → 異常標記
 │
 ▼
[5] 入庫   COPY 進 staging，ON CONFLICT DO NOTHING（Day 07）
 │
 ▼
[6] 複驗   再跑一次 [1]，缺口應為空；抽樣跟對照組比
 │
 ▼
資料完整性報告 + exit code
```

步驟 [6] 值得多說一句。它不是額外的檢查，它就是步驟 [1] 再跑一次。管線自己驗自己補完了沒有，比你事後開 notebook 查快得多，也不會忘記做。

冪等來自三個地方：步驟 [1] 每次都重新讀資料庫的實際狀態，不依賴上一輪跑到哪裡；步驟 [4] 是純函式；步驟 [5] 有複合主鍵擋重複。所以就算你在步驟 [3] 中斷、隔天重跑，管線會自己算出還缺哪些，不會從頭重來，也不會漏。

還有一個容易忽略的冪等前提，是 Day 02 講過的：**最後一根還沒收完的 K 線一律不入庫**。如果你把它寫進去，五分鐘後再跑一次，同一個 `open_time` 會有兩組不同的 OHLCV，而 `ON CONFLICT DO NOTHING` 會保留先寫進去的那一組，也就是不完整的那一組。這既破壞冪等，也是一個很難察覺的未來函數來源。所以整條管線的時間軸右端一律用開區間。

## 工程實作

### 設定檔

管線要顧哪些東西，寫在設定檔裡，不寫在程式碼裡：

```yaml
# quantbot/ingest/pipeline.yaml
defaults:
  market: spot            # 現貨。永續合約的資料 NEVER 跟現貨混在同一張表
  start: "2024-01-01"
  max_concurrency: 4

symbols:
  - symbol: BTC/USDT
    timeframes: ["1m", "1h"]
  - symbol: ETH/USDT
    timeframes: ["1m", "1h"]
  - symbol: SOL/USDT
    timeframes: ["1h"]

crosscheck:
  provider: coingecko
  sample_days: 5
  tolerance: 0.01         # 相對差超過 1% 就在報告裡標出來
```

### 缺漏偵測

核心就是一句 `difference`：拿預期的時間軸跟資料庫裡實際存在的 `open_time` 做集合差，再把連續的缺漏合併成區間。

```python
# quantbot/ingest/gaps.py
from __future__ import annotations

from dataclasses import dataclass

import pandas as pd

TIMEFRAME_TO_FREQ: dict[str, str] = {
    "1m": "1min",
    "5m": "5min",
    "15m": "15min",
    "1h": "1h",
    "4h": "4h",
    "1d": "1D",
}


@dataclass(frozen=True)
class Gap:
    """一段連續缺漏的 K 線。start 與 end 都是 open_time，兩端皆含。"""

    start: pd.Timestamp
    end: pd.Timestamp
    bars: int

    @property
    def span(self) -> pd.Timedelta:
        return self.end - self.start


def expected_index(
    start: pd.Timestamp, end: pd.Timestamp, timeframe: str
) -> pd.DatetimeIndex:
    """產生 [start, end) 之間所有應該存在的 open_time，一律 UTC。

    end 用開區間，是為了排除「還沒收完」的那一根 K 線（Day 02）。
    """
    freq = TIMEFRAME_TO_FREQ[timeframe]
    return pd.date_range(
        start=start.ceil(freq), end=end, freq=freq, tz="UTC", inclusive="left"
    )


def find_gaps(
    actual: pd.DatetimeIndex,
    start: pd.Timestamp,
    end: pd.Timestamp,
    timeframe: str,
) -> list[Gap]:
    """比對預期時間軸與實際資料，回傳合併後的缺口清單。"""
    if actual.tz is None:
        raise ValueError("actual 必須是 tz-aware 的 DatetimeIndex，時區在入庫前就要統一")

    missing = expected_index(start, end, timeframe).difference(actual.tz_convert("UTC"))
    if missing.empty:
        return []

    step = pd.Timedelta(TIMEFRAME_TO_FREQ[timeframe])
    missing_series = missing.to_series()
    # 與前一筆的間距不等於一個 timeframe，就是新的一段缺口。
    # 第一筆的 diff 是 NaT，比較結果為 True，剛好當成第一段的開頭。
    block_id = (missing_series.diff() != step).cumsum()

    return [
        Gap(start=block.iloc[0], end=block.iloc[-1], bars=len(block))
        for _, block in missing_series.groupby(block_id)
    ]
```

沒有迴圈遍歷時間軸，全部交給 `date_range`、`difference` 與 `cumsum`。一年份的 1 分鐘 K 線是 52 萬列，這樣算是毫秒級的事。

### 路由：這段缺口走批次還是 REST

Day 03 設計了雙軌擷取，但那時候是你自己決定哪段走哪條。現在把這個判斷寫成程式碼。

判斷依據有兩個。第一個是批次檔的上傳延遲，昨天以後的資料只有 REST 有。第二個是成本：REST 抓 1 分鐘 K 線一次上限 1000 根，一天 1440 根就是兩次請求、4 weight，而每分鐘的預算是 2400 weight。回補三個月的 1 分鐘資料大約 130 次請求，勉強跑得完但很慢；同樣的量走批次是 90 個 HTTP GET，不吃 weight，而且可以併發。反過來說，缺口只有幾十根的時候，下載整包 zip 再解壓縮反而是繞遠路。

所以門檻設在兩天，可調：

```python
# quantbot/ingest/routing.py
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

import pandas as pd

from quantbot.ingest.gaps import Gap

Source = Literal["batch", "rest"]

BATCH_MIN_SPAN = pd.Timedelta(days=2)


@dataclass(frozen=True)
class FetchTask:
    symbol: str
    timeframe: str
    market: str
    start: pd.Timestamp
    end: pd.Timestamp
    source: Source


def batch_available_until(now: pd.Timestamp) -> pd.Timestamp:
    """daily zip 隔日才上傳，所以這個時間點之後的資料只能走 REST。"""
    return now.normalize() - pd.Timedelta(days=1)


def plan_fetch(
    gap: Gap, *, symbol: str, timeframe: str, market: str, now: pd.Timestamp
) -> list[FetchTask]:
    """把一段缺口切成一到兩個取得任務。"""
    cutoff = batch_available_until(now)

    def task(start: pd.Timestamp, end: pd.Timestamp, source: Source) -> FetchTask:
        return FetchTask(symbol, timeframe, market, start, end, source)

    if gap.start >= cutoff or gap.span < BATCH_MIN_SPAN:
        return [task(gap.start, gap.end, "rest")]

    batch_end = min(gap.end, cutoff)
    tasks = [task(gap.start, batch_end, "batch")]
    if gap.end > cutoff:
        tasks.append(task(cutoff, gap.end, "rest"))
    return tasks
```

一段從三個月前一路缺到今天的缺口，會被切成兩個任務：三個月前到昨天走批次，昨天到現在走 REST。這是最常見的情況，也是第一次跑管線時會發生的情況。

### 清洗與異常值

資料拿回來之後，入庫之前，過一次清洗。這裡要先訂一條政策：**什麼該丟、什麼該標記**。

結構上不可能是真的資料才丟，例如 high 比 low 小、或出現負數的價格與成交量。這種列留著只會讓後面的計算產生沒人看得懂的結果。其他看起來不對勁但可能是真的，一律保留並標記，因為市場上真的會出現看起來不合理的資料。你要做的是讓它出現在報告裡，由你決定要不要處理，而不是讓管線悄悄替你決定。

```python
# quantbot/ingest/clean.py
from __future__ import annotations

import pandas as pd

OHLCV = ["open", "high", "low", "close", "volume"]

# 單根 K 線的合理跳動上限，跟 timeframe 綁在一起。
# 1 分鐘跳 5% 跟日線跳 5% 是完全不同的事件，用同一個數字沒有意義。
MAX_RETURN: dict[str, float] = {
    "1m": 0.05,
    "5m": 0.08,
    "15m": 0.12,
    "1h": 0.20,
    "4h": 0.30,
    "1d": 0.50,
}


def clean_klines(df: pd.DataFrame, timeframe: str) -> tuple[pd.DataFrame, pd.DataFrame]:
    """整理成可入庫的形狀，並回傳被標記的異常列。

    回傳 (clean_df, anomalies)。clean_df 已排除結構上不可能為真的列；
    anomalies 包含所有被標記的列（含仍留在 clean_df 裡的那些）。
    """
    out = df.copy()

    # 1. 時區統一。上游若給 naive 時間戳，一律當作 UTC（Day 02 的規則）。
    out.index = (
        out.index.tz_localize("UTC") if out.index.tz is None else out.index.tz_convert("UTC")
    )
    out = out.sort_index()

    # 2. 去重。同一個 open_time 只留最後寫入的那筆（批次與 REST 的重疊區間）。
    out = out[~out.index.duplicated(keep="last")]

    # 3. 向量化的異常標記
    body_high = out[["open", "close"]].max(axis=1)
    body_low = out[["open", "close"]].min(axis=1)

    flags = pd.DataFrame(index=out.index)
    flags["ohlc_invalid"] = (
        (out["high"] < out["low"]) | (out["high"] < body_high) | (out["low"] > body_low)
    )
    flags["negative_value"] = (out[OHLCV] < 0).any(axis=1)
    flags["zero_volume"] = out["volume"].eq(0)
    flags["price_jump"] = out["close"].pct_change().abs() > MAX_RETURN[timeframe]

    fatal = flags["ohlc_invalid"] | flags["negative_value"]
    anomalies = out.join(flags).loc[flags.any(axis=1)]

    return out.loc[~fatal], anomalies
```

四個標記各自在抓什麼：

| 標記 | 通常代表什麼 | 處理 |
|---|---|---|
| `ohlc_invalid` | 欄位順序對映錯了。官方 CSV 沒有標頭，Day 03 是靠文件排欄位的，排錯就會出現 high 比 low 小 | 丟棄並記錄 |
| `negative_value` | 型別轉換出問題，或讀到了非 OHLCV 的欄位 | 丟棄並記錄 |
| `zero_volume` | 冷門交易對真的沒人成交（此時 OHLC 四個數字會相同），或你抓錯了成交量欄位 | 保留並標記 |
| `price_jump` | 真的有一波急跌急漲，或是資料源給了髒資料 | 保留並標記 |

`ohlc_invalid` 那條特別值得跑一次。欄位對映錯誤是這個階段最常見的錯誤，而且它不會噴例外，只會讓你之後每一張圖都長得怪怪的。

### 併發回補多個交易對

每個交易對的回補彼此獨立，是標準的 I/O bound 工作，用 `asyncio` 加一個 `Semaphore` 控住併發數就好。這裡有兩個細節：`return_exceptions=True` 讓單一交易對失敗不會拖垮整批，以及所有結果都要進報告，包含失敗的那些。

```python
# quantbot/ingest/pipeline.py
from __future__ import annotations

import asyncio
import sys

import aiohttp
import asyncpg
import pandas as pd

from quantbot.config import settings
from quantbot.ingest import binance          # Day 03
from quantbot.ingest.clean import clean_klines
from quantbot.ingest.crosscheck import run_crosscheck
from quantbot.ingest.gaps import find_gaps
from quantbot.ingest.report import PipelineReport, SymbolReport, load_specs, render
from quantbot.ingest.routing import plan_fetch
from quantbot.storage import klines as store  # Day 07


async def sync_one(
    spec, *, pool: asyncpg.Pool, session: aiohttp.ClientSession,
    sem: asyncio.Semaphore, now: pd.Timestamp,
) -> SymbolReport:
    """把單一 symbol + timeframe 補到 now，回傳這一段的報告。"""
    async with sem:
        report = SymbolReport.new(spec, start=spec.start, end=now)

        # [1] 盤點
        existing = await store.existing_open_times(pool, spec.symbol, spec.timeframe, spec.market)
        gaps = find_gaps(existing, spec.start, now, spec.timeframe)
        report.gaps_before = gaps

        # [2][3] 路由並取得
        for gap in gaps:
            for task in plan_fetch(gap, symbol=spec.symbol, timeframe=spec.timeframe,
                                   market=spec.market, now=now):
                raw = await binance.fetch(task, session=session)

                # [4] 清洗
                clean, anomalies = clean_klines(raw, spec.timeframe)
                report.add_anomalies(anomalies)

                # [5] 入庫（複合主鍵 + ON CONFLICT DO NOTHING，重跑不會產生重複列）
                written = await store.upsert(pool, clean, spec.symbol, spec.timeframe, spec.market)
                report.add_written(task.source, written)

        # [6] 複驗：同一套盤點邏輯再跑一次，缺口應該是空的
        existing = await store.existing_open_times(pool, spec.symbol, spec.timeframe, spec.market)
        report.gaps_after = find_gaps(existing, spec.start, now, spec.timeframe)
        report.crosscheck = await run_crosscheck(session, pool, spec, now=now)
        return report


async def main() -> int:
    specs, options = load_specs("quantbot/ingest/pipeline.yaml")
    sem = asyncio.Semaphore(options.max_concurrency)

    # 右端一律往下取整到整根 K 線，排除還沒收完的那一根（Day 02）
    now = pd.Timestamp.now(tz="UTC").floor(specs[0].freq)

    async with (
        asyncpg.create_pool(settings.postgres_dsn) as pool,
        aiohttp.ClientSession() as session,
    ):
        results = await asyncio.gather(
            *(sync_one(s, pool=pool, session=session, sem=sem, now=now) for s in specs),
            return_exceptions=True,
        )

    report = PipelineReport(run_at=now, results=results)
    print(render(report))
    return 0 if report.ok else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
```

注意最後那個 exit code。管線不是「跑完就算成功」，而是「回補後還有缺口、有致命異常、或對照組沒過，就回傳非 0」。cron 抓得到 exit code，Day 25 接上 Telegram 告警時，這一行就是觸發條件。

### 排程

先用 cron，機器時區設 UTC：

```
# crontab -e
5 * * * * cd /srv/quantbot && flock -n /tmp/quantbot-ingest.lock \
    /usr/local/bin/uv run python -m quantbot.ingest.pipeline \
    >> /var/log/quantbot/ingest.log 2>&1
```

每小時第 5 分鐘跑，避開整點那一根 K 線剛收完、交易所還在寫入的那幾十秒。`flock -n` 是防止上一輪還沒跑完就啟動下一輪；管線本身雖然冪等，但兩個行程同時對同一段做回補只是白白消耗 rate limit 額度。

Day 27 部署時這段會換成容器內的排程，跟其他服務一起用 Docker Compose 管，屆時 log 也會改成結構化輸出。今天先用 cron，因為它現在就能動。

## 驗證：管線的最後一步是對照組

Day 01 訂的六條選型原則裡，第五條是「每個主來源都要有對照組」。Day 03 你手動抽樣比對過一次批次資料的欄位對映，今天把它變成管線的固定步驟。

兩個對照組的用途不一樣，要分清楚：

- **CryptoDataDownload** 提供的就是 Binance 自己的資料，只是已經整理成 CSV。所以你的資料跟它應該幾乎完全相同，差異只可能來自時間戳定義。它適合抓欄位對映與時間戳偏移這類結構性錯誤，容許值可以設得很緊。
- **CoinGecko** 是跨交易所的參考價，跟單一交易所本來就有天然差異，加上 USDT 對美元也不是嚴格 1:1。它抓不出小數點後的問題，但抓得出「整段價格量級不對」「時間軸整體位移」「不小心抓成了永續合約」這種等級的錯。

管線裡用 CoinGecko，容許值 1%。設 1% 不是因為你期待對到 1%，是因為超過 1% 通常代表出了上面那類錯誤：

```python
# quantbot/ingest/crosscheck.py
from __future__ import annotations

import aiohttp
import pandas as pd

COINGECKO_IDS: dict[str, str] = {
    "BTC/USDT": "bitcoin",
    "ETH/USDT": "ethereum",
    "SOL/USDT": "solana",
}


async def fetch_reference_daily(
    session: aiohttp.ClientSession, symbol: str, start: pd.Timestamp, end: pd.Timestamp
) -> pd.Series:
    """取得 CoinGecko 的日收盤參考價，index 為 UTC 日期。"""
    coin_id = COINGECKO_IDS[symbol]
    url = f"https://api.coingecko.com/api/v3/coins/{coin_id}/market_chart/range"
    params = {
        "vs_currency": "usd",
        "from": int(start.timestamp()),
        "to": int(end.timestamp()),
    }
    async with session.get(url, params=params, timeout=aiohttp.ClientTimeout(total=30)) as resp:
        resp.raise_for_status()
        payload = await resp.json()

    prices = pd.DataFrame(payload["prices"], columns=["ts_ms", "price"])
    index = pd.to_datetime(prices["ts_ms"], unit="ms", utc=True)
    return pd.Series(prices["price"].to_numpy(), index=index).resample("1D").last()


def compare_daily(
    ours: pd.Series, theirs: pd.Series, *, tolerance: float
) -> pd.DataFrame:
    """並排比對兩個來源的日收盤，回傳含相對差與是否通過的表。"""
    joined = pd.concat({"ours": ours, "theirs": theirs}, axis=1).dropna()
    joined["rel_diff"] = (joined["ours"] - joined["theirs"]).abs() / joined["theirs"]
    joined["passed"] = joined["rel_diff"] <= tolerance
    return joined
```

抽樣不用比對全部歷史，每次跑抽最近幾天就夠，額度也省。CoinGecko 免費層每月 10,000 credits，一天抽五天、三個交易對，一個月大約 450 次呼叫，離上限還很遠。

比對沒過的時候，管線不會自動修正，只會在報告裡標出來並讓 exit code 變成非 0。這是刻意的：對不上的原因可能是你的資料錯了，也可能是那天兩個來源真的有落差，這個判斷需要你來做。

## 今日交付物

一支 `python -m quantbot.ingest.pipeline`，能把設定檔裡所有交易對補到最新，並輸出一份資料完整性報告。

報告長這樣：

```
=== quantbot data integrity report ===
run_at : 2026-09-22T04:00:00Z
window : 2024-01-01T00:00:00Z .. 2026-09-22T04:00:00Z  (UTC, 右端開區間)

BTC/USDT  spot  1m
  預期 / 實際      1,401,120 / 1,401,120   (100.00%)
  回補前缺口       2 段, 共 47 根
    2026-09-18T02:13Z .. 2026-09-18T02:54Z    42 根  → rest
    2026-09-20T11:07Z .. 2026-09-20T11:11Z     5 根  → rest
  本次寫入         batch 0 / rest 47
  回補後缺口       0 段
  異常標記         zero_volume 31 / ohlc_invalid 0 / price_jump 1
    price_jump   2026-09-19T13:44Z  close 63,102.4 → 61,870.0  (-1.95%)
  對照組 coingecko（抽 5 日, 容許 1.00%）
    最大相對差     0.06%  於 2026-09-17                    PASS

ETH/USDT  spot  1m
  預期 / 實際      1,401,120 / 1,401,120   (100.00%)
  回補前缺口       0 段
  本次寫入         batch 0 / rest 0
  回補後缺口       0 段
  異常標記         zero_volume 12 / ohlc_invalid 0 / price_jump 0
  對照組 coingecko（抽 5 日, 容許 1.00%）
    最大相對差     4.11%  於 2026-09-19                    FAIL  需人工確認

SOL/USDT  spot  1h
  ...

result : FAIL (1 個對照組未通過, 0 段缺口未補)
exit   : 1
```

「本次寫入 batch 0 / rest 0」這一行是冪等的直接證據。第一次跑完之後，只要沒有新的缺口，之後每次跑這兩個數字都應該是 0 或接近 0。

驗收標準，五項全過才算完成：

1. 空資料庫跑第一次，跑完報告顯示每個交易對的「回補後缺口」都是 0 段。
2. 立刻再跑一次。`SELECT count(*)` 的結果跟第一次跑完之後完全相同，報告的「本次寫入」全是 0。這是冪等。
3. 手動 `DELETE` 掉中間一段（例如三個月前的一整天，以及昨天的十分鐘），再跑一次。兩段都補回來了，而且報告裡標出前者走 batch、後者走 rest。這是路由邏輯。
4. 故意把清洗步驟前的某幾列 `high` 與 `low` 對調，確認那幾列出現在報告的 `ohlc_invalid` 裡而且沒有進資料庫。
5. 對照組全數 PASS，exit code 為 0；或者有 FAIL 但報告明確指出是哪一天、差多少，exit code 為 1。

第三項是這五項裡最值得認真跑的。它同時驗到了盤點、路由與入庫三段，而且刪一段再補回來這個動作，你之後每次懷疑資料有問題時都會用到。

## 第一階段回顧：你現在手上有什麼

七天下來，`quantbot` 從一個空專案長成了一條會自己跑的資料管線。

| Day | 建了什麼 | 現在手上有 |
|---|---|---|
| 02 | K 線的資料結構與時間戳規則 | 一張 UTC `DatetimeIndex` 的 DataFrame，知道時間戳是開盤時間、知道最後一根不能用 |
| 03 | `ingest/binance.py` 雙軌擷取 | 批次下載加 REST 補洞，會退避重試、看 weight 標頭讓路 |
| 04 | `indicators/ma.py` | SMA，含資料不足與有缺漏的邊界測試，以及未來函數的第一次警告 |
| 05 | `indicators/ema.py` | EMA，遞迴指標的正確寫法，與對照組誤差在 1e-9 以內 |
| 06 | `indicators/rsi.py` | RSI，Wilder 平滑；三個指標統一成同樣的函式簽章 |
| 07 | `storage/` 與 migration | TimescaleDB hypertable、冪等寫入、1m 自動聚合出 5m 與 1h、壓縮政策 |
| 08 | `ingest/pipeline.py` | 一條 cron 叫得動的管線，跑完給你一份完整性報告與 exit code |

把它整理成三件事：

- **一份查得快、不會重複、缺漏可查的歷史資料**，存在 TimescaleDB 裡，會自己每小時往前補。
- **三個自己實作、跟現成套件對過數字的指標**，簽章統一，Day 15 會直接搬進特徵模組。
- **一組會跟著你到最後的習慣**：每個主來源配一個對照組、每個計算配一個測試、每次跑完都有東西可以看。

第三件事沒有程式碼交付，但它是後面三個階段的前提。Day 19 之後你會開始看回測數字，那時候唯一能讓你相信數字的，就是這條管線每天都在告訴你資料是完整的。

## 免責聲明

本系列為程式與資料工程的技術分享，所有策略與數字皆為教學範例，不構成投資建議；加密貨幣波動劇烈，實際交易請自行評估風險。

## 明天

第一階段到今天結束，明天進入第二階段。

Day 02 講 K 線的時候留了一個伏筆：一根 1 分鐘 K 線把這一分鐘內所有成交壓成五個數字，開高低收加成交量。壓縮一定有損失，那一分鐘裡可能發生了 3 筆成交，也可能發生了 3000 筆；可能是一路緩慢上漲，也可能是先急殺再拉回，收在同一個價位。這五個數字看不出任何差別，而你這七天算的所有指標都建在這五個數字上。

明天 Day 09 我們往下挖一層，去拿回被丟掉的那些資訊：**Tick**（每一筆成交的原始紀錄，不做任何壓縮）與 **L2 掛單簿**（此刻市場上還沒成交、正在等著的買賣單）。這兩種資料的量級跟 K 線完全不同，一天的資料就比一年的日線大好幾個數量級，所以「要存什麼」本身就是個需要先想清楚的問題。

第二階段（Day 09 到 Day 15）要做的東西，跟第一階段有一個明確的差別：MA、EMA、RSI 這三個指標，任何看盤軟體上都有現成的。接下來要做的特徵，別人的看盤軟體上沒有，因為那些都得自己從 Tick 與掛單簿算出來。
