---
title: "Day 02：打開行情圖只看到一堆紅綠棒子？先把 K 線（OHLCV）拆成熟悉的資料結構"
datetime: "2026-09-16"
description: "一根 K 線就是一段時間內所有成交的 summary statistics，五個數字而已。這篇把 OHLCV 拆開看：五個欄位各自回答什麼問題、時間框架怎麼選、時間戳單位與時區有哪些會算錯的地方，最後從官方批次檔拿到 BTC/USDT 現貨日線、存成 parquet、畫出第一張 K 線圖。"
image: ""
parent: "2026 ithome-鐵人賽: 工程師的量化交易入門：從 K 線到可組合的交易策略引擎 系列"
draft: true
---

## 紅綠棒子只是一種畫法

昨天我們把 `quantbot` 的骨架建起來了：設定集中在 `config.py`、密鑰走 `.env`、`docker compose` 起得動一個 TimescaleDB。專案是空的，但它跑得起來。

今天要往管線最左邊那一格填第一筆資料。在那之前，先解決一件讓很多人卡住的事：打開任何一個行情網站，畫面上是一堆密密麻麻的紅綠棒子，每根棒子中間有身體、上下有鬚，滑鼠移上去會跳出四五個數字。它看起來像是需要某種解讀能力才能看懂的東西。

其實那張圖背後就是一張表。每一根棒子是一列，每一列有五個數字。看盤軟體只是把這五個數字畫成一個圖形，方便一眼掃過幾百列。

順帶一提顏色：歐美的看盤軟體多半是綠漲紅跌，台灣、日本、中國的習慣相反，紅漲綠跌。同一份資料換個網站看，顏色可能整個對調。資料裡沒有「顏色」這一欄，顏色是畫圖的時候拿 close 跟 open 比出來的。

## 交易概念補課：一根 K 線就是一組 summary statistics

**K 線**（candlestick，也叫 bar）是一個時間區間內所有成交的摘要。**OHLCV** 是這個摘要的五個欄位：open、high、low、close、volume。

換個熟悉的講法：市場上每成交一筆就產生一列紀錄（時間、價格、數量），這些紀錄按時間切成等長的桶，每個桶算出五個統計量。就這樣。

換成 SQL 就是這件事：

```sql
SELECT
    time_bucket('1 day', traded_at) AS open_time,
    first(price, traded_at)         AS open,
    max(price)                      AS high,
    min(price)                      AS low,
    last(price, traded_at)          AS close,
    sum(quantity)                   AS volume
FROM trades
GROUP BY open_time;
```

交易所就是這樣產生 K 線的，它手上有自己撮合出來的每一筆成交。所以有一件事今天要先記住：**K 線不是原始資料，是聚合結果。** 後面很多會算錯的地方，追下去都是因為忘了這句話。

### 五個數字各自回答什麼問題

**open**：這段時間第一筆成交的價格。它是上一段的延續，通常等於或非常接近前一根的 close。

**high 與 low**：這段時間內成交價的最大值與最小值。它們說的是價格「摸到過」哪裡，但沒說是什麼時候摸到的、摸了幾次、停留多久。

**close**：最後一筆成交的價格。五個數字裡最常被拿來用的就是它，因為它代表這段時間結束時市場的共識價。之後幾天算的每一個指標，預設輸入都是 close。

**volume**：這段時間成交的總量，單位是 base asset，也就是 BTC 的顆數，不是美元金額。金額在另一個欄位（quote volume）。同樣是漲 1%，成交量大代表很多人參與、這個價格被廣泛接受；成交量小代表可能只是幾張單就把價格推過去了。

四個價格加一個量，這是絕大多數公開行情資料的最小共同格式。不管從哪個交易所、哪個看盤軟體、哪個資料商拿到的東西，去掉包裝之後都是這五個欄位。

### 多空：兩個字先講掉

**做多**（long）是先買後賣，賭價格會漲。**做空**（short）是先賣出自己還沒有的東西、之後再買回來還掉，賭價格會跌。行情討論裡的「多方」「空方」，指的就是這兩邊的參與者。

今天不會下單，但先講是因為它會影響我們怎麼看那張圖。一根收黑的 K 線對做多的人是壞消息、對做空的人是好消息，資料本身沒有好壞。從 Day 16 開始，程式每根 K 線要輸出的判斷就是「做多、做空、還是不動」這三選一。

### 時間框架：選的是解析度

**時間框架**（timeframe）就是上面那個 `time_bucket` 的桶寬。1m 代表每一分鐘聚合一根，1d 代表每天一根。同一段歷史，換一個 timeframe 就是換一個解析度，資料量與能看見的東西跟著變：

| timeframe | 一年幾根    | 一年的官方 CSV 量級 | 看得到什麼      |
|-----------|---------|--------------|------------|
| 1m        | 525,600 | 約 80 MB      | 一天之內價格怎麼來回 |
| 1h        | 8,760   | 約 1.4 MB     | 數小時到數天的走勢  |
| 1d        | 365     | 約 60 KB      | 數週到數月的走勢   |

取捨在這裡。1d 乾淨、算什麼都快，但一年只有 365 列，這對統計來說是很小的樣本；如果規則一個月才觸發一次，一年下來只有十二次觀察，看到什麼結論都不太能當真。1m 樣本多、細節多，但一年就是五十幾萬列，而且雜訊比例高得多。

這個系列的做法是：**入庫時存最細的那一份，要用粗的時候再聚合出來。** 1m 可以聚合成 1h 與 1d，反過來不行。Day 07 會用 TimescaleDB 的 continuous aggregate 把這件事自動化，今天先手動做一次，用的就是上面那段 SQL 的邏輯。

### 這五個數字丟掉了什麼

回到「K 線是聚合結果」這句話。任何聚合都會丟東西，問題只是丟了什麼。

一根 1 分鐘 K 線背後可能是 3 筆成交，也可能是 3000 筆。OHLCV 這五個數字完全看不出差別。價格是先漲到 high 再跌到 low，還是先跌到 low 再漲到 high，也看不出來。中間來回震盪了幾次、每次多深，一樣看不出來。

這不是資料缺陷，是聚合的定義本來就這樣。但它有實際後果：有些判斷在 OHLCV 這一層根本做不出來，因為需要的資訊在壓縮的時候就沒了。這條伏筆會在 Day 09 收，那天我們往下挖一層，去看每一筆成交（Tick）與掛單簿長什麼樣子。今天先把它記在心裡，等一下會用真實資料量一次差距有多大。

## 資料來源：今天走最短的一條路

今天只需要一小段資料，看清楚結構就好，所以直接從 Binance 官方的批次檔下載，不繞路。

`data.binance.vision` 是 Binance 官方的 public data dump，把歷史行情打包成 zip 放著讓人下載。免費、不消耗 API 額度、URL 結構固定：

```
https://data.binance.vision/data/spot/monthly/klines/BTCUSDT/1d/BTCUSDT-1d-2026-06.zip
                              └ spot          └ symbol └ tf  └ 檔名 = SYMBOL-TF-YYYY-MM.zip
```

路徑裡的 `spot` 是市場類型。這個系列從頭到尾用的都是 **BTC/USDT 現貨**，跟永續合約是兩個不同的市場，資料 NEVER 混用（差別明天講）。

同一個目錄下還有 `.zip.CHECKSUM`，內容是 SHA256 加檔名，可以用來驗證下載完整。今天先不做，明天併發下載的時候會用上。

還有一個要先知道的：**月檔要等該月結束之後才會上傳**，通常是次月頭幾天。想拿最近幾天的資料，得改走 `daily/` 目錄的日檔，或者用 REST 補。「大量歷史該怎麼抓、缺口怎麼補」就是明天 Day 03 的主題，今天只需要手上有一張 DataFrame。

## 工程實作：把 CSV 變成一張信得過的 DataFrame

### 官方 CSV 沒有標頭，欄位順序要自己查

解開 zip 之後是一個 CSV，第一列直接就是資料，沒有欄位名稱。十二個欄位的順序寫在官方文件裡：

| #     | 欄位                                            | 說明                                 |
|-------|-----------------------------------------------|------------------------------------|
| 1     | open_time                                     | 這根 K 線的起始時間，epoch 整數               |
| 2–5   | open, high, low, close                        | 四個價格                               |
| 6     | volume                                        | 成交量，單位是 base asset（BTC 顆數）         |
| 7     | close_time                                    | 結束時間，等於下一根 open_time 減 1 個時間單位     |
| 8     | quote_volume                                  | 成交金額，單位是 quote asset（USDT）         |
| 9     | trade_count                                   | 這段時間內的成交筆數                         |
| 10–11 | taker_buy_base_volume, taker_buy_quote_volume | 主動買進的部分。taker 是什麼 Day 10 才解釋，今天照著存 |
| 12    | ignore                                        | 官方保留欄位，忽略                          |

第 9 欄值得多看一眼。剛才說「一根 K 線可能是 3 筆成交也可能是 3000 筆，OHLCV 看不出來」，而 `trade_count` 這一欄剛好把答案寫在旁邊。它不屬於 OHLCV，是交易所額外附贈的，等一下會用到。

### 三個關於時間的地方容易算錯

**第一，時間戳的單位不是固定的。** 這不是理論上的可能性，Binance 真的改過。看兩個檔案的第一列：

```
# BTCUSDT-1d-2024-12.csv
1733011200000,96407.99000000,...
# BTCUSDT-1d-2025-01.csv
1735689600000000,93576.00000000,...
```

13 位數是毫秒，16 位數是微秒。Binance 從 2025 年 1 月起把 public data 的時間戳換成微秒，同一個資料源、同一個檔名格式，跨過那個月份單位就變了。在 `pd.to_datetime` 裡寫死 `unit="ms"`，2025 年之後的資料會被解析成西元五萬多年。

正確做法是用數量級判斷，不要假設：

```python
def detect_epoch_unit(epochs: pd.Series) -> str:
    """用數量級判斷 epoch 整數的時間單位，NEVER 寫死。

    2020 年代的時間戳：秒約 1.7e9、毫秒約 1.7e12、微秒約 1.7e15。
    """
    magnitude = int(epochs.max())
    if magnitude < 10**11:
        return "s"
    if magnitude < 10**14:
        return "ms"
    return "us"
```

**第二，時間戳是開盤時間還是收盤時間。** 官方 CSV 兩個都給，但很多 API 與資料商只給一個，而且不一定會說明是哪一個。這個差異在日線上是整整一天。判斷方法是拿第一列的時間戳，看它是不是落在一個整齊的邊界上：1d 的 open_time 會是當天 00:00:00 整，close_time 則是 23:59:59.999999。

這個系列的統一規定：**index 一律用 open_time**。理由是 open_time 對齊時間桶邊界，聚合、切片、跟其他資料源對齊都方便；close_time 則保留成一般欄位，等一下要拿它來判斷 K 線收完了沒。

**第三，時區一律 UTC。** Binance 的時間戳是 UTC epoch，`pd.to_datetime(..., utc=True)` 轉出來就是 tz-aware 的 UTC。不要 `tz_convert` 成本地時間，也不要留 naive datetime。加密貨幣 24/7 不休市，機器可能跑在任何地方，只要有一個環節混進本地時間，之後對帳時要花很久才找出那幾小時的差異是哪來的。Day 01 的 `docker-compose.yml` 裡把容器 `TZ` 設成 UTC，就是同一件事的另一半。

### 型別、缺漏，以及 pandas 的一個小地雷

CSV 讀進來預設會被 pandas 猜型別，價格欄位有時候會猜成 `object`。這個系列的做法是 `dtype=str` 全部讀成字串，再明確轉一次，出錯會在轉型那行就炸掉，不會安靜地帶著錯誤型別往下跑。價格用 `float64`，NEVER 用 `float32`，BTC 的價格加上小數位已經吃掉不少有效位數。

另一件事是 K 線不保證連續。某個時間桶裡完全沒有成交，交易所就不會產生那根 K 線，index 會直接跳過去。BTC/USDT 現貨幾乎不會發生，但成交冷清的交易對很常見，所以要有一個檢查：

```python
# Binance 的 timeframe 字串跟 pandas 的 freq 字串不一樣，要對映，不要直接傳。
# pandas 的 "1m" 不是分鐘，"1min" 才是。
PANDAS_FREQ: dict[str, str] = {
    "1m": "1min",
    "5m": "5min",
    "15m": "15min",
    "1h": "1h",
    "4h": "4h",
    "1d": "1D",
}


def find_gaps(frame: pd.DataFrame, freq: str) -> pd.DatetimeIndex:
    """回傳預期存在、但資料裡沒有的 K 線起始時間。"""
    expected = pd.date_range(frame.index[0], frame.index[-1], freq=freq, tz="UTC")
    return expected.difference(frame.index)
```

至於 `SettingWithCopyWarning`：下面的模組用 `raw[FLOAT_COLUMNS].astype("float64")` 開場，`astype` 回傳的是新物件不是 view，接著加欄位不會觸發那個警告。改寫成先切片再指派就會看到它。

### 最後一根 K 線還沒收完

這是新手最常見的一個問題，而且它不會噴錯，只會讓結果變好看。

假設現在是 14:37，去抓 1h 的 K 線。最後一根的 open_time 是 14:00，它的 close 欄位是 14:37 這一刻的成交價，不是 15:00 的收盤價。它的 high、low、volume 也都還會繼續變。這根 K 線是活的。

問題出在把這張表存下來、之後拿它做計算的時候。歷史上的每一根都是收完的定局，只有最後那一根不是。用它算出來的判斷，在事後看起來成立，但在當下那個時間點，那個數字根本還不存在。這種「用了當時還不知道的資訊」的錯誤有個正式名稱，Day 04 會正式介紹它，今天先建立一個習慣：**進到資料表裡的 K 線，一律只有收完的。**

判斷方法就是 close_time：

```python
def drop_unclosed_bar(
    frame: pd.DataFrame, now: pd.Timestamp | None = None
) -> pd.DataFrame:
    """丟掉還沒收完的最後一根 K 線。

    close_time 還在未來，就代表那根的 high/low/close/volume 都還會變。
    """
    current_time = now if now is not None else pd.Timestamp.now(tz="UTC")
    return frame.loc[frame["close_time"] <= current_time]
```

批次檔裡不會有未收完的 K 線（月檔是整月結束後才上傳的），但明天接上 REST 之後就會有。這個函式現在寫，之後每條路徑都會經過它。

### 完整模組

先補三個套件：

```bash
uv add httpx pyarrow plotly
```

```python
# quantbot/ingest/binance_vision.py
"""從 data.binance.vision 取得現貨 K 線，轉成全專案統一的 DataFrame schema。

資料來源：Binance 官方 public data dump（現貨 monthly klines）。
免費、不消耗 API 額度；當月的月檔要到次月頭幾天才會上傳。
"""

from __future__ import annotations

import io
import zipfile

import httpx
import pandas as pd

BASE_URL = "https://data.binance.vision/data/spot/monthly/klines"

# 官方 CSV 沒有標頭列，欄位順序寫死在這裡，來源是 Binance public data 文件。
RAW_COLUMNS: list[str] = [
    "open_time",
    "open",
    "high",
    "low",
    "close",
    "volume",
    "close_time",
    "quote_volume",
    "trade_count",
    "taker_buy_base_volume",
    "taker_buy_quote_volume",
    "ignore",
]

FLOAT_COLUMNS: list[str] = ["open", "high", "low", "close", "volume", "quote_volume"]

PANDAS_FREQ: dict[str, str] = {
    "1m": "1min",
    "5m": "5min",
    "15m": "15min",
    "1h": "1h",
    "4h": "4h",
    "1d": "1D",
}


def detect_epoch_unit(epochs: pd.Series) -> str:
    """用數量級判斷 epoch 整數的時間單位，NEVER 寫死。"""
    magnitude = int(epochs.max())
    if magnitude < 10**11:
        return "s"
    if magnitude < 10**14:
        return "ms"
    return "us"


def download_monthly_klines(symbol: str, timeframe: str, month: str) -> pd.DataFrame:
    """下載單一月份的現貨 K 線 zip，回傳未經轉換的原始欄位。

    Args:
        symbol: 交易所格式的現貨交易對，例如 "BTCUSDT"。
        timeframe: K 線的時間框架，例如 "1d"、"1h"、"1m"。
        month: 月份，格式 "YYYY-MM"。
    """
    url = f"{BASE_URL}/{symbol}/{timeframe}/{symbol}-{timeframe}-{month}.zip"
    response = httpx.get(url, timeout=60.0, follow_redirects=True)
    response.raise_for_status()

    with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
        csv_bytes = archive.read(archive.namelist()[0])

    return pd.read_csv(
        io.BytesIO(csv_bytes), header=None, names=RAW_COLUMNS, dtype=str
    )


def normalize_klines(raw: pd.DataFrame) -> pd.DataFrame:
    """把原始欄位轉成統一 schema：UTC 的 DatetimeIndex ＋ float64 的 OHLCV。"""
    open_time = pd.to_numeric(raw["open_time"])
    close_time = pd.to_numeric(raw["close_time"])
    unit = detect_epoch_unit(open_time)

    frame = raw[FLOAT_COLUMNS].astype("float64")
    frame["trade_count"] = raw["trade_count"].astype("int64")
    frame["close_time"] = pd.to_datetime(close_time, unit=unit, utc=True)
    frame.index = pd.to_datetime(open_time, unit=unit, utc=True)
    frame.index.name = "open_time"

    return frame.sort_index()


def drop_unclosed_bar(
    frame: pd.DataFrame, now: pd.Timestamp | None = None
) -> pd.DataFrame:
    """丟掉還沒收完的最後一根 K 線。"""
    current_time = now if now is not None else pd.Timestamp.now(tz="UTC")
    return frame.loc[frame["close_time"] <= current_time]


def find_gaps(frame: pd.DataFrame, freq: str) -> pd.DatetimeIndex:
    """回傳預期存在、但資料裡沒有的 K 線起始時間。"""
    expected = pd.date_range(frame.index[0], frame.index[-1], freq=freq, tz="UTC")
    return expected.difference(frame.index)


def load_klines(symbol: str, timeframe: str, months: list[str]) -> pd.DataFrame:
    """下載多個月份並接成一張表：排序、去重、丟掉未收完的那一根。"""
    monthly = [
        normalize_klines(download_monthly_klines(symbol, timeframe, month))
        for month in months
    ]
    combined = pd.concat(monthly).sort_index()
    combined = combined[~combined.index.duplicated(keep="last")]

    return drop_unclosed_bar(combined)


def resample_ohlcv(frame: pd.DataFrame, freq: str) -> pd.DataFrame:
    """把細粒度 K 線聚合成粗粒度，交易所產生日線的方式就是這樣。"""
    aggregated = frame.resample(freq, label="left", closed="left").agg(
        open=("open", "first"),
        high=("high", "max"),
        low=("low", "min"),
        close=("close", "last"),
        volume=("volume", "sum"),
        trade_count=("trade_count", "sum"),
    )
    return aggregated.dropna(subset=["open"])
```

全部向量化，沒有一行在遍歷 K 線。這是全系列的一條規矩：`resample().agg()` 不只是比較快，邊界也比手寫迴圈難寫錯。

## 用資料證明「丟掉了什麼」

先驗證 `resample_ohlcv` 真的重現了交易所的聚合邏輯。抓同一個月的 1m 與 1d，把 1m 聚合成日線，跟官方日線逐欄相減：

```python
minute = load_klines("BTCUSDT", "1m", ["2026-06"])
daily = load_klines("BTCUSDT", "1d", ["2026-06"])

rebuilt = resample_ohlcv(minute, PANDAS_FREQ["1d"])
columns = ["open", "high", "low", "close", "volume"]
print((rebuilt[columns] - daily[columns]).abs().max())
```

```
open      0.0
high      0.0
low       0.0
close     0.0
volume    0.0
```

一模一樣。這裡同時確認了兩件事：欄位對映與時區都對了（算錯任何一個都會出現非零差異），以及日線確實只是 1440 根 1 分鐘 K 線的摘要，沒有多也沒有少的資訊。

那反過來，摘要沒帶到的是什麼？拿 1m 資料算一個 OHLCV 算不出來的量：**當天價格實際走過的總路程**。把每分鐘的漲跌幅取絕對值加起來就是了。

```python
minute_move = minute["close"].pct_change().abs()
path_length = minute_move.resample("1D").sum() * 100
bar_range = (daily["high"] - daily["low"]) / daily["open"] * 100

comparison = pd.DataFrame(
    {
        "range_pct": bar_range.round(2),
        "path_pct": path_length.round(1),
        "trade_count": daily["trade_count"],
    }
)
print(comparison.loc[["2026-06-08", "2026-06-28"]])
```

```
                           range_pct  path_pct  trade_count
open_time
2026-06-08 00:00:00+00:00       2.83      86.7      4887564
2026-06-28 00:00:00+00:00       2.73      45.1      2299232
```

這兩天在日線上長得幾乎一樣：高低幅度都是 2.8% 上下，都是收黑。但一天的價格在那個區間裡來回走了 86.7%，另一天只走了 45.1%，成交筆數差了一倍以上。如果規則是在日內做判斷，這兩天完全是不同的環境，而日線的五個數字一個字都沒提到這件事。

把整個 6 月排出來會看到，路程長度是日線高低幅度的十幾到三十倍。也就是說，日線那根棒子的長度，大概只涵蓋了當天價格實際移動量的二十分之一。

這就是 Day 09 要往下挖的原因。1 分鐘 K 線比日線細，但它一樣是聚合結果，一樣有自己的路程沒被記錄下來。要拿回全部的資訊，只能回到最原始的那一層。

## 視覺化：第一張 K 線圖

五個數字，就畫五個數字。上半張是 OHLC 的蠟燭，下半張是 volume 的長條，共用同一條時間軸。

```python
# quantbot/plotting.py
"""K 線繪圖。OHLCV 五個欄位全部畫出來，不要只畫價格。"""

from __future__ import annotations

import pandas as pd
import plotly.graph_objects as go
from plotly.subplots import make_subplots


def plot_ohlcv(frame: pd.DataFrame, title: str) -> go.Figure:
    """畫出 K 線與成交量的雙層圖。

    Args:
        frame: 需要 UTC 的 DatetimeIndex 與 open/high/low/close/volume 欄位。
        title: 圖表標題，MUST 標明交易對與市場類型。
    """
    figure = make_subplots(
        rows=2,
        cols=1,
        shared_xaxes=True,
        row_heights=[0.72, 0.28],
        vertical_spacing=0.04,
        subplot_titles=(
            "價格 open / high / low / close（USDT）",
            "成交量 volume（BTC）",
        ),
    )

    figure.add_trace(
        go.Candlestick(
            x=frame.index,
            open=frame["open"],
            high=frame["high"],
            low=frame["low"],
            close=frame["close"],
            name="OHLC",
            increasing_line_color="#26a69a",
            decreasing_line_color="#ef5350",
        ),
        row=1,
        col=1,
    )

    figure.add_trace(
        go.Bar(
            x=frame.index,
            y=frame["volume"],
            name="volume",
            marker_color="#78909c",
        ),
        row=2,
        col=1,
    )

    figure.update_layout(
        title=title,
        height=720,
        showlegend=False,
        template="plotly_dark",
        xaxis_rangeslider_visible=False,
    )
    figure.update_xaxes(title_text="時間（UTC）", row=2, col=1)

    return figure
```

`xaxis_rangeslider_visible=False` 是刻意關掉的。Plotly 的 Candlestick 預設會在下面掛一條縮圖式的區間選擇器，在雙層圖裡它會擠掉成交量那一格。要縮放的話直接在圖上框選就好。

`template="plotly_dark"` 純粹是個人偏好，換成 `plotly_white` 也可以。重點是軸要標清楚單位：時間是 UTC、價格是 USDT、成交量是 BTC 顆數。這三個標記之後每一張圖都要有，因為很快就會同時看好幾張不同來源的圖。

## 今日交付物

`quantbot/ingest/binance_vision.py` 與 `quantbot/plotting.py` 兩個模組，加上一支把它們串起來的腳本：

```python
# quantbot/ingest/fetch_klines.py
"""取得 BTC/USDT 現貨日線 K 線，存成 parquet 並輸出 K 線圖。

用法：
    uv run python -m quantbot.ingest.fetch_klines
"""

from __future__ import annotations

from pathlib import Path

from quantbot.config import settings
from quantbot.ingest.binance_vision import PANDAS_FREQ, find_gaps, load_klines
from quantbot.plotting import plot_ohlcv

# config 裡的 default_symbol 是 ccxt 格式的 "BTC/USDT"，
# 批次檔用的是 "BTCUSDT"。命名怎麼統一是明天 Day 03 的事，今天先手動去掉斜線。
SYMBOL = settings.default_symbol.replace("/", "")
TIMEFRAME = "1d"
MONTHS = [f"2026-{month:02d}" for month in range(1, 7)]

DATA_DIR = Path("data/klines")
CHART_DIR = Path("notebooks")


def main() -> None:
    klines = load_klines(SYMBOL, TIMEFRAME, MONTHS)
    gaps = find_gaps(klines, PANDAS_FREQ[TIMEFRAME])

    print(f"{len(klines)} 根 K 線：{klines.index[0]} → {klines.index[-1]}")
    print(f"缺漏 {len(gaps)} 根")
    print(klines.dtypes)

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    CHART_DIR.mkdir(parents=True, exist_ok=True)

    klines.to_parquet(DATA_DIR / f"{SYMBOL}-spot-{TIMEFRAME}.parquet")
    chart = plot_ohlcv(klines, f"{SYMBOL} 現貨 {TIMEFRAME}（data.binance.vision）")
    chart.write_html(CHART_DIR / f"day02-{SYMBOL}-{TIMEFRAME}.html")


if __name__ == "__main__":
    main()
```

存 parquet 不存 CSV，理由是 parquet 帶著型別走。CSV 存出去之後 `float64` 跟 tz-aware 的 index 都會退化成字串，下次讀進來要重轉一次，重轉就有機會轉錯。Day 01 的 `.gitignore` 已經把 `data/` 與 `*.parquet` 擋掉了，資料不進版控。

驗收標準，五項全過才算完成：

1. `uv run python -m quantbot.ingest.fetch_klines` 跑完不噴錯，印出 181 根 K 線（2026 年 1 月 1 日到 6 月 30 日），缺漏 0 根。
2. 印出來的 dtypes 裡，`open`／`high`／`low`／`close`／`volume` 是 `float64`，`trade_count` 是 `int64`，`close_time` 是 `datetime64[ns, UTC]`。
3. `data/klines/BTCUSDT-spot-1d.parquet` 存在；用 `pd.read_parquet` 讀回來，index 是 tz-aware 的 UTC `DatetimeIndex`，第一根的 open_time 是 `2026-01-01 00:00:00+00:00`。
4. `notebooks/day02-BTCUSDT-1d.html` 打開後看得到 K 線與成交量兩層圖，滑鼠移到任一根上面會跳出 OHLC 四個數字。
5. 把 `resample_ohlcv` 那段驗證跑一次，1m 聚合出來的日線跟官方日線逐欄差異全部是 0。

第五項不是可有可無的裝飾。它同時檢查了欄位對映、時間戳單位、時區、聚合邊界四件事，只要其中任何一項錯了都不會通過。這個系列往後每加一個計算，都會用類似的方式找一個獨立的東西來對。

## 免責聲明

本系列為程式與資料工程的技術分享，所有數字皆為教學範例，不構成投資建議；加密貨幣波動劇烈，實際交易請自行評估風險。

## 明天

今天用一行 `httpx.get` 就拿到了一個月的資料，看起來抓歷史資料沒什麼難的。換個規模就不一樣了：抓一整年的 1 分鐘 K 線。

多數人的第一反應是去打 API，然後就會遇到限流。Binance 的 klines 端點單次上限 1000 根，一年的 1 分鐘 K 線是 525,600 根，翻頁要翻五百多次，而每個 IP 每分鐘只有 2400 weight 可以用。明天 Day 03 我們把這筆帳算清楚，然後設計一條正確的路：大量歷史走批次下載，最近幾天的缺口才用 REST 補，兩條路徑分開設計、在入庫時對齊。另外把今天欠的東西補上：交易對命名、現貨與永續合約的差別、checksum 驗證，以及 API key 該怎麼放才不會外流。

## Reference

- [官方批次資料的目錄結構、檔案格式與 checksum 說明 — Binance Public Data](https://github.com/binance/binance-public-data)
- [批次檔下載入口 — data.binance.vision](https://data.binance.vision/)
- [kline 十二個欄位的定義與 timeframe 清單 — Binance Spot API Documentation, Market Data Endpoints](https://developers.binance.com/docs/binance-spot-api-docs/rest-api/market-data-endpoints)
- [Candlestick 圖的完整參數 — Plotly Python, Candlestick Charts](https://plotly.com/python/candlestick-charts/)
