---
title: "Day 07：行情資料越存越多、查詢越來越慢？為什麼時序資料庫（TimescaleDB）才是對的容器"
datetime: "2026-09-21"
description: "市場資料只增不改、幾乎都用時間範圍查、量隨時間線性成長，這三個特性剛好是 hypertable 的最佳場景。這篇把 quantbot 的 schema 建起來，講清楚為什麼不是 parquet、不是純 PostgreSQL、也不是 InfluxDB，並用複合主鍵、COPY 批次寫入、continuous aggregate 與壓縮政策做出一條重跑不會產生重複列的入庫路徑。"
image: ""
parent: "2026 ithome-鐵人賽: 工程師的量化交易入門：從 K 線到可組合的交易策略引擎 系列"
draft: true
---

## 六天過去，你的資料還躺在檔案系統裡

Day 03 把 `data.binance.vision` 的月檔載下來、解壓、對映欄位，輸出成 parquet。Day 04 到 Day 06 寫了 MA、EMA、RSI，每支腳本開頭都是同一段：找到檔案、讀進來、`pd.concat`、排序、去重。

一開始只有一個交易對、幾個月的日線，這樣完全沒問題。等到你把 BTC/USDT、ETH/USDT、SOL/USDT 三個交易對的 1 分鐘 K 線各補三年，情況會變成這樣：

```
data/
└── binance/spot/klines/
    ├── BTCUSDT/1m/BTCUSDT-1m-2023-01.parquet
    ├── BTCUSDT/1m/BTCUSDT-1m-2023-02.parquet
    │   ... 每個交易對每個 timeframe 各 36 個檔
    └── SOLUSDT/1d/SOLUSDT-1d-2025-12.parquet
```

然後你想回答一個很平常的問題：「BTC/USDT 現貨的 1 分鐘資料，2024-03-11 到 2024-05-02 這段，最高價出現在哪一分鐘。」你要先算出跨了哪三個月檔、讀進來、切掉頭尾多出來的部分、確認三個檔在邊界處沒有重複那一根、再算。這段程式碼你會寫在某支腳本裡，然後在下一支腳本裡再寫一次。

明天 Day 08 要把擷取到入庫接成一條每天自己跑的管線，而管線的第一個硬性要求是**跑兩次結果要一樣**。用檔案做這件事不是不行，但「不要有重複列」這件事會變成你自己每次都要記得處理的邏輯，而不是儲存層本來就會擋住的事。今天要做的，就是把這件事交給資料庫。

## 市場資料的三個特性

在挑容器之前，先把要存的東西看清楚。K 線資料有三個特性，而且三個都很極端：

**一、只增不改。** 2024-03-11 09:47 那一根 1 分鐘 K 線收完之後就定案了，交易所不會回頭改它。整個系統裡幾乎沒有 UPDATE，只有 INSERT，而且 INSERT 的時間戳基本上是遞增的。一般業務系統會擔心的並行更新、交易衝突、鎖競爭，在這裡幾乎不存在。

**二、幾乎都用時間範圍查。** 回想一下你這六天寫過的查詢，沒有一個是「找出收盤價等於 68321.5 的那一根」。全部都是「某個交易對、某個 timeframe、某段時間，按時間排序全部給我」。之後也一樣，Day 19 的回測要連續掃一整段，Day 22 的報表要按月切開，Day 28 的日誌查詢要撈某個時間點前後幾分鐘。查詢條件永遠是三個等值加一個時間區間。

**三、量隨時間線性成長，而且不會停。** 一個交易對的 1 分鐘 K 線，一年是 525,600 根。三個交易對三年就是 473 萬列，而這還只是 Day 09 之後那些更細的資料的零頭。重點是它沒有上限，只要機器人還在跑，資料就一直長。

這三個特性合起來指向一個很具體的需求：**按時間切開存、按時間範圍查、舊資料要能被壓掉。** hypertable 做的就是這件事。

## 為什麼不是 parquet、不是純 PostgreSQL、不是 InfluxDB

這三個都是合理的選項，也都有人拿去做同一件事，所以值得逐一講清楚它們在哪裡停下來。

### 為什麼不繼續堆 parquet

parquet 是好格式，這點沒有爭議：欄式儲存、壓縮率高、pandas 跟 DuckDB 讀起來都很快。Day 02 到 Day 06 用它完全沒問題。

麻煩的地方在寫入，不在讀取。parquet 檔是不可變的，你沒有辦法「把這一列更新掉」。這帶來三個後果：

第一，**重跑會產生重複列，而且擋不住。** 你重補 2024-03 的資料，得到的不是「同一批資料被覆蓋」，而是硬碟上多了一個內容重疊的檔案。要避免這件事，你得在讀取端每次都做 `drop_duplicates`，或者在寫入端自己實作「先讀舊檔、合併、寫暫存檔、原子換檔」。這段邏輯寫對不難，但它是你的責任，而不是儲存層的保證。用資料庫的話，這件事叫做一個複合主鍵。

第二，**最近幾天的資料會被更好的來源取代。** Day 03 的雙軌設計裡，官方月檔還沒上傳的那幾天是用 REST 補的；等月檔上傳之後，你會想用月檔覆蓋掉那幾天。檔案版本的做法是重寫整個月檔；資料庫版本是一個 `INSERT ... ON CONFLICT DO UPDATE`。

第三，**「我手上最新的那一根是什麼時候」這個問題很貴。** 明天的管線每次啟動都要問這個問題，對每個交易對、每個 timeframe 各問一次。檔案版本要掃目錄、找出最後一個檔、讀進來、看最後一列。資料庫版本是一句帶索引的 SQL。

所以結論不是「parquet 不好」，而是 parquet 適合當落地區與封存格式，不適合當唯一真相來源。Day 03 下載下來的原始檔繼續留著（重建時不用重抓），但從今天開始，「我有哪些資料」這個問題的答案在資料庫裡。

### 為什麼不是純 PostgreSQL

先講公平話：純 PostgreSQL 撐得比你想的久。一張 `candles` 表加上 `(symbol, timeframe, open_time)` 的 btree 索引，幾百萬列的查詢在筆電上都是毫秒級。你不會在第一週遇到問題。

它停下來的地方有四個：

**分區要自己管。** PostgreSQL 有原生的宣告式分區，你可以按月切。但分區得自己建，這代表你要寫一支「每個月月初建下個月分區」的維護工作，還要處理它沒跑到的那天。hypertable 是寫入時自動建 chunk，不需要這支工作，也不會有忘記的那天。

**沒有壓縮。** row store 的資料就是那麼大。實測一列 K 線含索引大約 130 到 150 bytes，一個交易對三年的 1 分鐘資料是 200 MB 出頭。多幾個交易對、加上 Day 09 之後更細的資料，硬碟會長得比你預期快很多。TimescaleDB 的壓縮在這份資料上大約是 10 倍，等一下會給實際數字。

**沒有增量聚合。** 你想從 1m 算出 5m 跟 1h，用純 PostgreSQL 的話有兩條路：每次查詢都現場 `GROUP BY`（資料一多就慢），或者自己維護一張物化表加上一個水位標記，寫一支排程去補新的部分。後者就是 continuous aggregate 做的事，而你不會想自己維護那個水位標記。

**索引隨資料線性長大。** 單一大表的 btree 索引最後會塞不進快取。hypertable 的索引是每個 chunk 各一份，查詢時只會碰到落在時間範圍內的那幾個 chunk 的索引。

最關鍵的是最後一點：**TimescaleDB 就是 PostgreSQL 的一個 extension。** 選它的代價是一句 `CREATE EXTENSION`，你的 psql、pg_dump、asyncpg、pandas 的 `read_sql` 全部照用，Postgres 的知識一點都不浪費。所以這個取捨不是「Postgres 還是 Timescale」，而是「Postgres，還是 Postgres 加上四個你本來要自己寫的功能」。

### 為什麼不是 InfluxDB

InfluxDB 是專門的時序資料庫，處理這種資料也很稱職，這裡不打算把它講成錯的選項。但對這個專案來說有三個實際成本。

**查詢語言。** InfluxDB 從 InfluxQL 換到 Flux、3.x 之後又走回 SQL，你搜到的教學可能對應到不同世代。更重要的是，你手上會累積的查詢不只有「撈某段行情」：Day 21 的組合搜尋結果表、Day 22 的績效比較、Day 28 的決策日誌，全部都是關聯式的資料，而且會需要跟行情表 join。學一套新語言只為了其中一張表，划不來。

**要多顧一個服務。** 行情放 Influx、其他放 Postgres，就是兩個資料庫、兩套備份、兩個會在凌晨三點掛掉的東西。這套系統的目標是 Day 27 之後無人值守地跑，能少一個 moving part 就少一個。

**資料模型對不太上。** Influx 的 tag／field 模型偏向監控指標，OHLCV 塞得進去，但之後 Day 28 要記錄「這筆買賣是依據哪個設定檔的哪個版本做出來的」這類帶結構的東西時，就不是它擅長的了。

誠實的補充：如果你要存的是幾百 TB、而且只做大範圍掃描不做 join，ClickHouse 這類欄式分析型資料庫會贏過 TimescaleDB。這個專案的資料量是個位數 GB，掃描速度不是限制，所以決定權落在「其他東西要不要用 SQL」上。

### 三個選項的取捨整理

| | 重跑不重複 | 時間分區 | 壓縮 | 增量聚合 | SQL 與 join | 這個專案的判斷 |
|---|---|---|---|---|---|---|
| parquet 檔案堆 | 自己寫 | 靠檔名 | 有（欄式） | 自己寫 | DuckDB 可以，跨表麻煩 | 留著當落地區與封存 |
| 純 PostgreSQL | 主鍵擋掉 | 自己建分區 | 沒有 | 自己寫 | 完整 | 差四個功能 |
| InfluxDB | 靠 timestamp 覆寫 | 內建 | 內建 | 內建 | 版本不一，join 弱 | 為一張表多學一套語言 |
| TimescaleDB | 主鍵擋掉 | hypertable 自動 | 政策自動 | continuous aggregate | 完整（就是 Postgres） | 選它 |

## 交易上的兩個決定

今天沒有全新的交易術語，但有兩個決定會影響後面二十幾天，值得花兩段講清楚。

**不同 timeframe 要分表還是共表。** 答案是共表，但理由不是「省事」。1m、5m、1h、1d 的欄位完全一樣，分表的話你會得到四張結構相同的表、四套寫入路徑、四份壓縮政策，而查詢時還要在應用層決定去哪張表拿。共表的做法是加一個 `timeframe` 欄位並放進主鍵前綴，查詢時 `WHERE timeframe = '1m'` 走同一個索引。共表唯一的代價是分區間隔只能設一個全域值，而 1m 跟 1d 的資料密度差了 1440 倍。這個代價之所以可以接受，是因為下一個決定。

**只落地 1 分鐘資料，其他 timeframe 用聚合長出來。** 交易上的理由很簡單：粗的 timeframe 可以從細的算出來，反過來不行。你有 1m 就等於同時有了 5m、15m、1h、4h、1d；你只存 1d，就永遠回答不了「這一天裡面價格是怎麼走到收盤價的」。Day 09 之後要往 OHLCV 底下再挖一層，那時候問的問題會是「這一分鐘裡到底成交了幾筆、買賣兩邊各出了多少力」，日線資料連問這個問題的解析度都沒有。

至於成本，一個交易對一年的 1 分鐘資料是 525,600 列，聽起來很多，壓縮之後大約 20 MB。這個量級不需要猶豫。

所以整體設計是：**`candles` 這張 hypertable 只收 1m（以及沒有 1m 的極長歷史才收 1d），5m 與 1h 由 continuous aggregate 自動長出來。** 分區間隔只要照 1m 的密度來設就好，共表的代價就這樣消掉了。

## 工程實作

以下的程式碼放在 `quantbot/storage/`，資料庫是 Day 01 用 `docker compose` 起的那個 TimescaleDB 容器。開始之前先確認 extension 版本，因為 2.13 與 2.18 各改過一次 API 名稱：

```sql
SELECT extversion FROM pg_extension WHERE extname = 'timescaledb';
```

### schema：一張表，一組複合主鍵

```sql
-- quantbot/storage/migrations/001_candles.sql
CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE IF NOT EXISTS candles (
    symbol      TEXT             NOT NULL,   -- 'BTC/USDT'
    market      TEXT             NOT NULL,   -- 'spot' | 'perp'
    timeframe   TEXT             NOT NULL,   -- '1m' | '1d'
    open_time   TIMESTAMPTZ      NOT NULL,   -- 這根 K 線的「開盤」時間，UTC
    open        DOUBLE PRECISION NOT NULL,
    high        DOUBLE PRECISION NOT NULL,
    low         DOUBLE PRECISION NOT NULL,
    close       DOUBLE PRECISION NOT NULL,
    volume      DOUBLE PRECISION NOT NULL,   -- 成交量，以基礎幣計價
    trades      INTEGER,                     -- 成交筆數，Day 12 會用到
    source      TEXT             NOT NULL,   -- 'binance_vision' | 'binance_rest'
    ingested_at TIMESTAMPTZ      NOT NULL DEFAULT now(),
    CONSTRAINT candles_pkey PRIMARY KEY (symbol, market, timeframe, open_time)
);
```

有幾個決定要說明。

**主鍵的四個欄位就是防重複的全部機制。** 同一個交易對、同一個市場、同一個 timeframe、同一個開盤時間，全世界只會有一根 K 線。這個約束一旦建立，「重跑不會產生重複列」就不再是你要記得的事，而是資料庫拒絕做的事。欄位順序也不是隨便排的：查詢永遠是三個等值條件加一個時間範圍，把 `open_time` 放最後，索引前綴剛好對上查詢形狀。

**`market` 為什麼在主鍵裡。** Day 01 的第三條選型原則是現貨資料 NEVER 拿去回測永續合約策略。與其靠自己記得，不如讓兩種市場的同一根 K 線在資料庫層就是兩列不同的資料，查詢時漏寫 `market` 條件會直接拿到兩倍的列數，而不是安靜地混在一起。

**價格用 DOUBLE PRECISION 而不是 NUMERIC。** NUMERIC 是精確的，但比較慢、比較大，而且 pandas 讀進來之後照樣會轉成 float64，精確性在計算階段就沒了。行情資料用 float8 是合理取捨，還有一個附帶好處：TimescaleDB 對 float8 欄位會套用 Gorilla 這類專門的浮點壓縮演算法，壓縮率比 NUMERIC 好。但要講清楚界線，**Day 24 之後的帳務數字（餘額、已實現損益）一律用 NUMERIC**，那裡不能有浮點誤差。

**`open_time` 是開盤時間，不是收盤時間，而且是 TIMESTAMPTZ。** Day 02 講過不同來源對這件事的定義不一樣，所以欄位名稱直接把答案寫進去。時區的部分留到後面的陷阱那節。

### 用 hypertable 分區，以及分區間隔怎麼選

```sql
SELECT create_hypertable(
    'candles',
    by_range('open_time', INTERVAL '7 days'),
    if_not_exists => TRUE
);
```

`by_range` 是 TimescaleDB 2.13 之後的寫法。舊版本用的是 `create_hypertable('candles', 'open_time', chunk_time_interval => INTERVAL '7 days')`，效果一樣。

這一句做的事情是：往後每次 INSERT，TimescaleDB 會看 `open_time` 落在哪一週，把它寫進對應的 chunk（實際上是一張子表），沒有這個 chunk 就當場建一個。查詢時 planner 會做 chunk exclusion，只碰到時間範圍涵蓋到的那幾個 chunk。你可以直接看到這件事：

```sql
EXPLAIN (COSTS OFF)
SELECT * FROM candles
WHERE symbol = 'BTC/USDT' AND market = 'spot' AND timeframe = '1m'
  AND open_time >= '2024-03-11T00:00:00Z' AND open_time < '2024-05-02T00:00:00Z';
```

輸出裡會看到只有八個左右的 `_hyper_1_..._chunk` 被掃到，其他上百個連碰都沒碰。三年的資料裡撈兩個月，代價就跟只有兩個月的資料時差不多，這就是分區買到的東西。

**間隔怎麼選。** 官方的經驗法則是讓「還在活躍寫入與查詢的那幾個 chunk，連同它們的索引，加起來佔用不超過記憶體的 25%」。實際算一次：

| 項目 | 數字 |
|---|---|
| 1m K 線每天每個交易對 | 1,440 列 |
| 假設同時追 10 個交易對 | 14,400 列／天 |
| 7 天一個 chunk | 約 10 萬列 |
| 每列含索引約 140 bytes | 約 14 MB／chunk |

14 MB 對任何機器都很輕鬆，所以 7 天是安全的起點。往兩邊偏會發生什麼也要知道：間隔太小（例如 1 天），三年就是 1,095 個 chunk，一次跨年度的查詢要規劃上千張子表，光是 planning 的時間就吃掉好處；間隔太大（例如 1 年），chunk exclusion 幾乎失效，撈兩個月的資料要掃整年。

間隔之後還可以改，但只對新建的 chunk 生效：

```sql
SELECT set_chunk_time_interval('candles', INTERVAL '14 days');
```

### 冪等寫入：用 ON CONFLICT DO NOTHING

有了複合主鍵，冪等寫入就只是一個子句：

```sql
INSERT INTO candles (symbol, market, timeframe, open_time,
                     open, high, low, close, volume, trades, source)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
ON CONFLICT (symbol, market, timeframe, open_time) DO NOTHING;
```

重跑同一段資料，第二次的所有列都會撞到主鍵、被安靜地跳過，`INSERT 0 0`。明天的管線之所以敢「不確定補到哪就整段重跑」，靠的就是這一行。

那什麼時候該用 `DO UPDATE`？兩種情況：

一是 Day 03 那段「REST 先補、月檔後到」的資料，月檔是更權威的來源，應該覆蓋掉 REST 版本。這時候用帶條件的 `DO UPDATE`，只讓權威來源蓋掉非權威來源，反過來不行：

```sql
ON CONFLICT (symbol, market, timeframe, open_time) DO UPDATE
SET open = EXCLUDED.open, high = EXCLUDED.high, low = EXCLUDED.low,
    close = EXCLUDED.close, volume = EXCLUDED.volume,
    trades = EXCLUDED.trades, source = EXCLUDED.source,
    ingested_at = now()
WHERE candles.source = 'binance_rest' AND EXCLUDED.source = 'binance_vision';
```

二是你不小心寫進了還沒收完的那一根。這是 `DO NOTHING` 最危險的地方：Day 02 提過最後一根 K 線是進行式，如果你在 09:47:30 抓到 09:47 這根、把當下的 close 寫進去，之後每次重跑都會被 `DO NOTHING` 跳過，那個錯的收盤價會**永遠留在資料庫裡**，而且不會有任何錯誤訊息。

正確的做法不是靠 `DO UPDATE` 補救，是根本不要寫進去。寫入前先過濾：

```python
from datetime import UTC, datetime, timedelta

import pandas as pd

TIMEFRAME_TO_DELTA: dict[str, timedelta] = {
    "1m": timedelta(minutes=1),
    "5m": timedelta(minutes=5),
    "1h": timedelta(hours=1),
    "1d": timedelta(days=1),
}


def drop_unclosed_bars(
    df: pd.DataFrame,
    timeframe: str,
    now: datetime | None = None,
) -> pd.DataFrame:
    """丟掉還沒收完的那一根 K 線。

    Day 02 講過最後一根 K 線是進行式。它一旦被寫進資料庫，
    ON CONFLICT DO NOTHING 就再也不會更新它了。

    Args:
        df: 至少含 tz-aware 的 open_time 欄位。
        timeframe: '1m'、'1h' 這類間隔字串。
        now: 測試時可注入的當下時間，預設為 UTC now。

    Returns:
        只含已收盤 K 線的 DataFrame（複本）。
    """
    step = TIMEFRAME_TO_DELTA[timeframe]
    reference = now or datetime.now(UTC)
    closed = df["open_time"] + step <= reference
    return df.loc[closed].copy()
```

### 用 COPY 批次寫入

逐筆 `INSERT` 每一列都是一次網路來回加一次語句解析。一年的 1 分鐘資料是 52 萬列，用逐筆寫法你會等到懷疑人生。

PostgreSQL 的 `COPY` 是為批次載入設計的協定，asyncpg 有對應的 `copy_records_to_table`。問題是 `COPY` 不支援 `ON CONFLICT`，所以不能直接往 `candles` 灌。標準做法是兩段式：**COPY 進一張暫存表，再從暫存表一句 `INSERT ... SELECT` 帶著 `ON CONFLICT` 併進主表。**

```python
# quantbot/storage/candles.py
from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime

import asyncpg

from quantbot.storage.db import get_pool

CANDLE_COLUMNS: tuple[str, ...] = (
    "symbol", "market", "timeframe", "open_time",
    "open", "high", "low", "close", "volume", "trades", "source",
)

CandleRecord = tuple[
    str, str, str, datetime, float, float, float, float, float, int | None, str
]

_STAGING_DDL = """
CREATE TEMP TABLE candles_staging
    (LIKE candles INCLUDING DEFAULTS)
    ON COMMIT DROP;
"""

# DISTINCT ON 是必要的：官方月檔在月份邊界偶爾會有重複列，
# 而 source 排序讓權威來源在同一批次裡勝出。
_MERGE_SQL = f"""
INSERT INTO candles ({", ".join(CANDLE_COLUMNS)})
SELECT DISTINCT ON (symbol, market, timeframe, open_time)
       {", ".join(CANDLE_COLUMNS)}
FROM   candles_staging
ORDER  BY symbol, market, timeframe, open_time, source
ON CONFLICT (symbol, market, timeframe, open_time) DO NOTHING;
"""


async def write_candles(records: Sequence[CandleRecord]) -> int:
    """把 K 線批次寫進 candles，重複的列會被主鍵擋掉。

    Args:
        records: 欄位順序必須與 CANDLE_COLUMNS 一致，
            open_time 必須是 tz-aware 的 UTC datetime。

    Returns:
        實際新增的列數（已存在的不計）。
    """
    if not records:
        return 0

    pool: asyncpg.Pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute(_STAGING_DDL)
            await conn.copy_records_to_table(
                "candles_staging",
                records=records,
                columns=list(CANDLE_COLUMNS),
            )
            status = await conn.execute(_MERGE_SQL)

    # status 形如 'INSERT 0 43200'
    return int(status.rsplit(" ", 1)[-1])
```

連線池單獨放一個檔案，之後每個模組都從這裡拿連線：

```python
# quantbot/storage/db.py
from __future__ import annotations

import asyncpg

from quantbot.config import settings

_pool: asyncpg.Pool | None = None


async def get_pool() -> asyncpg.Pool:
    """取得全域連線池；第一次呼叫時建立，之後重用。

    server_settings 把連線的 timezone 釘死在 UTC，
    避免作業系統的 locale 影響 timestamptz 的輸出。
    """
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            dsn=settings.postgres_dsn,
            min_size=1,
            max_size=8,
            command_timeout=60,
            server_settings={"timezone": "UTC", "application_name": "quantbot"},
        )
    return _pool
```

**三種寫法的實測差距。** 以下是在本機 Docker 容器（TimescaleDB pg16、4 vCPU、單一連線）寫入 525,600 列 1 分鐘 K 線的結果。你的機器數字會不一樣，重點是量級：

| 寫法 | 耗時 | 吞吐 | 相對倍數 |
|---|---|---|---|
| 迴圈裡逐筆 `conn.execute()` | 457 秒 | 約 1.1k 列／秒 | 1x |
| `conn.executemany()`，每批 1,000 列 | 37 秒 | 約 14k 列／秒 | 12x |
| `COPY` 進暫存表 ＋ `INSERT ... ON CONFLICT` | 6.7 秒 | 約 78k 列／秒 | 68x |

逐筆到 `executemany` 的差距來自省掉網路來回，`executemany` 到 `COPY` 的差距來自省掉逐列的語句處理。第三種寫法多了一次暫存表的寫入，但那是本機的 unlogged 寫入，比省下來的多得多。

這個 benchmark 值得自己跑一次，程式碼放在 `quantbot/storage/bench.py`，因為 Day 08 的管線要決定「一次補多大一批」，而那個決定要建立在你自己機器的數字上。

### continuous aggregate：讓 5m 與 1h 自己長出來

前面決定了只落地 1m，其他 timeframe 用聚合。這件事你當然可以自己用 pandas 的 `resample` 做，但這正是最容易算錯的地方。從 1m 聚合出 5m，五個欄位的規則各不相同：

| 欄位 | 聚合規則 | 寫錯的話 |
|---|---|---|
| open | 取第一筆（時間最早那根的 open） | 寫成 `min` 或 `mean`，整根 K 線的形狀就變了 |
| high | 取最大值 | 寫成最後一筆的 high，高點會被吃掉 |
| low | 取最小值 | 同上 |
| close | 取最後一筆（時間最晚那根的 close） | 寫成 `max`，等於偷看到未來的高點 |
| volume | 加總 | 寫成平均，成交量少了五倍 |

「open 取第一筆、close 取最後一筆」聽起來理所當然，但如果你的 1m 資料中間有缺漏、或者排序沒有嚴格按時間，`first()` 跟 `df.iloc[0]` 拿到的可能不是同一根。更要命的是這種錯不會噴例外，畫出來的 K 線圖看起來也很正常，你要等到 Day 20 發現回測數字對不上才會回頭查。

TimescaleDB 的 `first()` 與 `last()` 是明確指定「按哪一欄排序取第一／最後」的聚合函式，這正好把上面那個排序問題消掉：

```sql
-- quantbot/storage/migrations/002_aggregates.sql
CREATE MATERIALIZED VIEW candles_5m
WITH (timescaledb.continuous, timescaledb.materialized_only = true) AS
SELECT
    symbol,
    market,
    time_bucket(INTERVAL '5 minutes', open_time) AS open_time,
    first(open, open_time) AS open,
    max(high)              AS high,
    min(low)               AS low,
    last(close, open_time) AS close,
    sum(volume)            AS volume,
    sum(trades)            AS trades
FROM candles
WHERE timeframe = '1m'
GROUP BY symbol, market, open_time
WITH NO DATA;
```

`1h` 版本只要把 `INTERVAL '5 minutes'` 換掉。也可以把 1h 疊在 `candles_5m` 上（hierarchical continuous aggregate，2.9 之後支援），少掃一次原始資料；但每疊一層就多一層重新整理延遲，而這份資料的量沒有大到需要這樣省，兩個都直接建在 `candles` 上比較好推理。

`materialized_only = true` 這個設定值得單獨講。設成 `false` 的話，TimescaleDB 會在查詢時把「已經物化的部分」加上「原始表裡還沒物化的最新資料」union 起來給你，看起來很貼心。問題是那批最新資料裡可能包含一個**還沒滿五分鐘的 bucket**，於是你查到的最後一根 5m K 線是半根，而它長得跟完整的一根一模一樣。這就是 Day 02 講的「最後一根 K 線是進行式」在聚合層再出現一次，而且更難察覺。設成 `true`，你只會看到已經封好的 bucket，代價是資料會落後一點，而那個落後是可控且可預期的。

`WITH NO DATA` 表示建立時先不回填，接著手動跑一次，避免建立語句在幾百萬列上卡很久：

```sql
CALL refresh_continuous_aggregate('candles_5m', NULL, NULL);

SELECT add_continuous_aggregate_policy('candles_5m',
    start_offset      => INTERVAL '3 days',
    end_offset        => INTERVAL '10 minutes',
    schedule_interval => INTERVAL '5 minutes');
```

三個參數的意思：每 5 分鐘跑一次，每次重新計算「3 天前到 10 分鐘前」這個區間。`end_offset` 一定要大於一個 bucket 寬度，否則就會物化到還沒封好的 bucket，前面那個問題又回來了。`start_offset` 給 3 天是為了容錯，如果昨天有一批遲到的資料被補進 `candles`，這個窗口會把它涵蓋進去重算。

### 壓縮政策

壓縮設定要指定兩件事：按什麼分段、段內按什麼排序。

```sql
ALTER TABLE candles SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'symbol, market, timeframe',
    timescaledb.compress_orderby   = 'open_time DESC'
);

SELECT add_compression_policy('candles', INTERVAL '30 days');
```

`compress_segmentby` 放的是查詢時的等值條件欄位，這樣壓縮之後仍然可以只解壓需要的那幾段。`compress_orderby` 放時間，讓同一段內的時間戳連續，delta-of-delta 編碼才壓得下去。30 天的門檻是刻意留的緩衝：最近一個月的資料還可能被 Day 08 的管線回補，壓縮過的 chunk 回填會麻煩很多（後面的陷阱那節會講）。

注意 API 名稱：TimescaleDB 2.18 之後把這組功能改名成 columnstore（`timescaledb.enable_columnstore`、`timescaledb.segmentby`、`add_columnstore_policy`），舊寫法仍然可用。跑之前先確認版本。

實際效果可以直接查：

```sql
SELECT
    pg_size_pretty(before_compression_total_bytes) AS before,
    pg_size_pretty(after_compression_total_bytes)  AS after,
    round(before_compression_total_bytes::numeric
          / nullif(after_compression_total_bytes, 0), 1) AS ratio
FROM hypertable_compression_stats('candles');
```

一個交易對三年的 1 分鐘資料（1,576,800 列），在這份資料上的結果是 236 MB 壓到 24 MB，大約 9.8 倍。壓縮之後查詢速度通常不降反升，因為要從硬碟讀進來的 bytes 少了一個數量級。你的數字會因為交易對數量與價格波動程度而不同，跑上面那句就知道。

### storage 模組的樣子

```
quantbot/storage/
├── __init__.py
├── db.py              # 連線池
├── migrate.py         # 依序套用 migrations/ 底下的 .sql
├── candles.py         # write_candles / read_candles / latest_open_time
├── bench.py           # 三種寫法的 benchmark
└── migrations/
    ├── 001_candles.sql
    ├── 002_aggregates.sql
    └── 003_compression.sql
```

`migrate.py` 用一張 `schema_migrations` 表記錄套用過哪些檔案，跑第二次不會重複執行。讀取端回傳的是 pandas DataFrame，簽章跟 Day 04 到 Day 06 的指標函式接得上：

```python
async def read_candles(
    symbol: str,
    timeframe: str,
    start: datetime,
    end: datetime,
    market: str = "spot",
) -> pd.DataFrame:
    """讀出一段 K 線，索引是 tz-aware 的 UTC DatetimeIndex。

    end 是開區間（不含），跟 Day 03 的下載範圍慣例一致，
    這樣連續兩段的查詢不會在邊界重複拿到同一根。
    """
    pool = await get_pool()
    rows = await pool.fetch(
        """
        SELECT open_time, open, high, low, close, volume, trades
        FROM   candles
        WHERE  symbol = $1 AND market = $2 AND timeframe = $3
          AND  open_time >= $4 AND open_time < $5
        ORDER  BY open_time
        """,
        symbol, market, timeframe, start, end,
    )
    frame = pd.DataFrame(
        rows,
        columns=["open_time", "open", "high", "low", "close", "volume", "trades"],
    )
    frame["open_time"] = pd.to_datetime(frame["open_time"], utc=True)
    return frame.set_index("open_time")
```

`candles_5m` 是一個 view，查它跟查表一模一樣，所以同一支函式加一個 `table` 參數就能共用，不需要另一條路徑。

## 陷阱與驗證

### 時區：從容器到 DataFrame 都要是 UTC

`TIMESTAMPTZ` 的內部儲存永遠是 UTC，但**顯示**會被 session 的 `TimeZone` 影響。同一列資料，你在 psql 看到的字串跟程式讀到的可能差八小時，而兩邊都沒有錯，只是設定不同。這種不一致最後會變成兩份資料對不起來、日誌時間怎麼看都怪的問題。

要釘死三個地方：

```sql
ALTER DATABASE market SET timezone TO 'UTC';
```

容器層 Day 01 已經設過 `TZ: UTC`，連線層前面的 `server_settings={"timezone": "UTC"}` 是第三道。

Python 這邊只有一條規則：**進資料庫的 datetime 一律 tz-aware。** asyncpg 收到 naive datetime 寫進 `TIMESTAMPTZ` 欄位時不會報錯，它會照自己的規則解讀，而那個解讀不一定是你想的。所以在轉換函式裡直接擋掉：

```python
open_time = pd.DatetimeIndex(df["open_time"])
if open_time.tz is None:
    raise ValueError(
        "open_time 必須是 tz-aware。從毫秒時間戳轉換時用 "
        "pd.to_datetime(ms, unit='ms', utc=True)"
    )
open_time = open_time.tz_convert("UTC")
```

還有一個容易忽略的：`time_bucket` 對 `TIMESTAMPTZ` 的 bucket 邊界是以 UTC epoch 對齊的。1 天的 bucket 就是 UTC 的零點到零點。加密貨幣 24／7 不休市，UTC 日就是慣例，這裡剛好沒有爭議；但如果你之後把同一套東西拿去處理有開收盤的市場，這個假設要重新檢查。

### 驗證重跑不會產生重複列

這是今天最需要親手確認的一件事，不要只相信主鍵。三步驟：

```sql
-- 1. 記下目前的列數
SELECT count(*) FROM candles
WHERE symbol = 'BTC/USDT' AND market = 'spot' AND timeframe = '1m';
```

```bash
# 2. 把同一段資料原封不動再入庫一次
python -m quantbot.storage.load --symbol BTC/USDT --market spot \
    --timeframe 1m --from 2024-03-01 --to 2024-04-01
```

```sql
-- 3. 列數必須一模一樣，而且沒有任何一組鍵出現兩次
SELECT count(*) FROM candles
WHERE symbol = 'BTC/USDT' AND market = 'spot' AND timeframe = '1m';

SELECT symbol, market, timeframe, open_time, count(*)
FROM   candles
GROUP  BY 1, 2, 3, 4
HAVING count(*) > 1;
```

最後那句必須回 0 列。順手再確認一下入庫的資料本身合理：

```sql
SELECT count(*) FROM candles
WHERE high < low OR high < open OR high < close
   OR low  > open OR low  > close OR volume < 0;
```

也是 0 列。這句檢查在 Day 03 的欄位對映寫錯時會立刻抓到（例如把 high 跟 low 的欄位順序調換），而那種錯用肉眼看 DataFrame 是看不出來的。完整的缺漏偵測是明天的主題，今天先確認手上這批沒有明顯壞掉。

### continuous aggregate 的重新整理與資料延遲

聚合表的資料一定會落後原始表，這是設計如此，不是故障。落後多少要算得出來：`end_offset` 是 10 分鐘、`schedule_interval` 是 5 分鐘，所以最壞情況下 `candles_5m` 會比 `candles` 落後大約 15 分鐘。策略如果吃 5m 資料，這個延遲必須放進考量。

查目前的政策與最近幾次執行狀況：

```sql
SELECT view_name, materialized_only, compression_enabled
FROM   timescaledb_information.continuous_aggregates;

SELECT job_id, last_run_started_at, last_successful_finish,
       last_run_status, total_failures
FROM   timescaledb_information.job_stats
WHERE  hypertable_name LIKE 'candles%';
```

有一個情況一定會遇到：**回補的歷史資料落在 `start_offset` 窗口之外，政策不會自動處理。** 明天的管線補了 2023 年的一段缺漏，`candles` 有了，但 `candles_5m` 那段還是空的，因為政策只重算最近 3 天。所以任何歷史回補之後都要手動補一次：

```sql
CALL refresh_continuous_aggregate('candles_5m',
    '2023-06-01T00:00:00Z', '2023-07-01T00:00:00Z');
```

這一步會寫進明天管線的收尾階段。忘記它的症狀很不明顯：1m 查得到資料、5m 查出來是空的或少一段，而你可能過很久才注意到。

### 回填到已壓縮的 chunk

壓縮政策設 30 天，是因為往壓縮過的 chunk 寫資料要付額外代價。新版本的 TimescaleDB 支援直接 INSERT 進壓縮 chunk，但涉及主鍵衝突判斷時它得先把相關的段解壓，速度會掉一個數量級。真的需要回填很舊的資料時，正規做法是先解壓：

```sql
SELECT decompress_chunk(c, if_compressed => true)
FROM   show_chunks('candles',
                   older_than => INTERVAL '90 days',
                   newer_than => INTERVAL '120 days') c;
-- 回填完之後讓政策自己再壓回去，或手動 compress_chunk()
```

實務上更簡單的處理是把壓縮門檻設得夠遠。30 天遠大於 Day 03 那條「月檔次月初上傳」的延遲，正常的回補永遠碰不到壓縮過的資料。

## 今日交付物

`quantbot/storage/` 模組加上三個 migration，能把 Day 03 抓下來的 parquet 入庫，重跑不會產生重複列。

驗收標準，五項全過才算完成：

1. `python -m quantbot.storage.migrate` 跑完之後，`\d+ candles` 看得到主鍵是 `(symbol, market, timeframe, open_time)`，且 `SELECT * FROM timescaledb_information.hypertables;` 裡有 `candles`。
2. `python -m quantbot.storage.load --symbol BTC/USDT --market spot --timeframe 1m --from 2024-03-01 --to 2024-04-01` 能把 Day 03 的 parquet 灌進去，輸出實際新增的列數（3 月是 44,640 列）。
3. **同一句指令再跑一次，輸出的新增列數是 0**，而且上面那句 `GROUP BY ... HAVING count(*) > 1` 回 0 列。
4. `SELECT count(*) FROM candles_5m WHERE symbol = 'BTC/USDT';` 拿得到 8,928 列（44,640 ÷ 5），且隨機抽一根跟自己用 pandas `resample('5min')` 算出來的 OHLCV 完全一致。
5. `python -m quantbot.storage.bench` 跑得出三種寫法的對照表，`COPY` 版本至少快逐筆版本一個數量級。

第四項是今天最值得花時間的驗證。它同時證明了兩件事：聚合的規則沒寫錯，以及你之後可以放心用 `candles_5m` 而不必每次自己 resample。抽查的寫法是把同一段的 1m 讀出來，`df.resample("5min").agg({"open": "first", "high": "max", "low": "min", "close": "last", "volume": "sum"})`，然後跟資料庫的結果對 `assert_frame_equal`。這個對照可以直接寫進 `tests/test_aggregates.py`。

本系列為程式與資料工程的技術分享，所有數字皆為教學範例，不構成投資建議。

## 明天

明天 Day 08 是第一階段的收尾。前六天的零件都在了：Day 03 的雙軌下載、Day 04 到 Day 06 的三個指標、今天的入庫層。我們會把它們接成一條每天自己跑的管線：排程觸發、算出每個交易對缺哪幾段、決定走批次還是 REST、回補、清洗、入庫、跑對照驗證，最後輸出一份資料完整性報告。

重點會放在兩件事。**冪等**，今天的複合主鍵只解決了一半，另一半是管線中途掛掉之後怎麼從斷點繼續而不重複做工。**可觀測**，出錯的時候你要知道是哪一段、哪個交易對、哪個時間範圍出的問題，而不是看到一行 traceback 就得從頭查起。也會回收今天留的那個尾巴：回補完歷史資料之後，記得叫聚合表重算。

## Reference

- [hypertable 與分區間隔的選擇建議 — Timescale Documentation, "Hypertables"](https://docs.tigerdata.com/use-timescale/latest/hypertables/)
- [continuous aggregate 的重新整理政策與 materialized_only 的行為 — Timescale Documentation, "Continuous aggregates"](https://docs.tigerdata.com/use-timescale/latest/continuous-aggregates/)
- [壓縮的 segmentby／orderby 設定與 2.18 之後的 columnstore 命名 — Timescale Documentation, "Compression"](https://docs.tigerdata.com/use-timescale/latest/compression/)
- [`copy_records_to_table` 的用法與限制 — asyncpg Documentation, "Connection.copy_records_to_table"](https://magicstack.github.io/asyncpg/current/api/index.html)
- [`ON CONFLICT` 子句的語意與 EXCLUDED 的用法 — PostgreSQL Documentation, "INSERT"](https://www.postgresql.org/docs/current/sql-insert.html)
