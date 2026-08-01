---
title: "Day 01：會寫程式、但完全不懂交易，為什麼你反而是量化交易的最佳人選"
datetime: "2026-09-15"
description: "量化交易去掉術語之後，剩下的骨架就是一條後端資料管線。這篇講清楚工程師進場的三個優勢與三個常犯的錯，攤開加密貨幣的資料來源版圖與選型理由（以及為什麼這 30 天你一毛錢都不用花），最後把 quantbot 這個範例專案的環境建起來。"
image: ""
parent: "2026 ithome-鐵人賽: 工程師的量化交易入門：從 K 線到可組合的交易策略引擎 系列"
draft: true
---

## 你缺的是幾十個名詞，不是能力

假設你寫了幾年程式，某天在辦公室聽到隔壁桌在聊均線、停損、爆倉，那些字你每個都認得，串起來卻完全不知道在講什麼。你可能因此覺得交易是另一個領域的事，得先去補一大堆金融知識才有資格碰。

實際情況沒那麼糟。量化交易這件事，去掉交易術語之後，剩下的骨架你每天都在做：**接一個外部資料源、把資料清乾淨存起來、跑一組計算得到幾個數字、根據數字觸發動作、記錄下來、出錯要能自己恢復。** 這是一個後端服務該有的樣子。你缺的是幾十個名詞，以及知道哪些地方特別容易算錯。這個系列會一天補一點名詞，其餘時間都在寫你熟悉的東西。

## 量化交易在做什麼：把「看盤下判斷」換成「資料進、訊號出」

人工交易的流程是：盯著圖，覺得看起來要漲了，下單。這裡面每一步都依賴當下的注意力與情緒，而且無法回頭檢驗，因為你說不清楚「看起來要漲」的判斷條件到底是什麼。

量化交易做的事情是把同一個流程改寫成一條有明確輸入輸出的管線：

```
市場資料 → 特徵計算 → 條件判斷 → 訊號（多／空／空手） → 部位大小 → 下單 → 記錄
```

每一段都是純函式或明確的狀態轉換，所以每一段都能被測試、能被回放、能被換掉。這條管線就是這 30 天要蓋的東西，也是後面所有內容的骨架：Day 02 到 Day 08 處理最左邊的「市場資料」，Day 09 到 Day 15 處理「特徵計算」，Day 16 到 Day 22 處理「條件判斷」與驗證，Day 23 之後處理右半邊的下單、記錄與不會掛掉。

### 工程思維的三個切入點

這條管線之所以對工程師友善，是因為它需要的三種能力你本來就有，而交易圈普遍缺乏。

**自動化，對應「條件判斷 → 下單」這一段。** 人看盤會累、會漏掉、會在虧了兩筆之後想加碼把錢賺回來。程式不會。凡是能寫成條件的判斷，都可以交給程式在你睡覺時執行，而且執行得跟你清醒時訂下的規則一模一樣。

**防禦性設計，對應「下單、記錄」與整個服務的生命週期。** 交易程式跑在真錢上，網路會斷、API 會限流、交易所會回 5xx、WebSocket 會靜默斷線。你已經習慣在寫任何外部呼叫時先想「它會怎麼壞」，這個習慣在交易系統裡的價值比在一般服務裡更高，因為這裡壞掉的代價是錢。

**數據分析，對應「特徵計算」與策略驗證。** 一個策略好不好可以回測、可以量化、可以跟基準並排比較，不必憑感覺。你已經習慣拿數字做決策，也習慣懷疑一個好看的數字是不是量測方式有問題。這個懷疑的習慣，在回測這件事上幾乎是唯一的護欄。

### 工程師最容易犯的三個錯

優勢講完了，接著講反面。工程師進場出的錯也很固定，而且都是同一個原因：程式跑得出結果，不代表結果是對的。

**第一，把回測寫得太樂觀。** 最常見的是未來函數，也就是在計算第 t 根 K 線的訊號時，不小心用到了第 t 根之後才會知道的資訊。這種錯不會噴例外，只會讓你的權益曲線變得非常漂亮。其次是忽略手續費與滑價，理想回測預設你能用收盤價成交、不用付錢、想買多少有多少，三個假設都是假的。未來函數在 Day 04 第一次正式警告，回測作弊的完整清單與成本模型則在 Day 19 到 Day 20 處理。

**第二，把指標算錯卻沒發現。** RSI 的 Wilder 平滑係數是 1/n 而不是 2/(n+1)，寫錯了它照樣輸出 0 到 100 的數字，圖畫出來也很像那麼回事。差別要跟現成套件對數字才看得出來。所以這個系列每個自己實作的指標都會配一個對照組，Day 04 到 Day 06 就開始這麼做。

**第三，把系統寫得太脆弱。** 本機跑得好好的，掛上去第三天凌晨 API 斷線，程式沒有崩潰、也沒有重連，就是安靜地停在那裡不動，而你以為它還在跑。這比直接掛掉更糟，因為你不會收到任何通知。Day 23 整篇在講這件事。

還有一個錯是這套積木庫特有的：**組合太多、全部跑一遍、挑回測最好看的那一個。** 這在統計上等於自欺，而且積木化之後會變得非常容易做。Day 21 是整個系列裡最重要的一篇之一，專門處理它。

### 先把期待值講清楚

這個系列不教你怎麼判斷會漲會跌，也不會給你一個能賺錢的策略。這兩件事一個超出範圍，另一個不誠實。

它教的是：**怎麼把一個判斷變成可驗證、可自動執行的系統。** 判斷本身從哪來是你的事，可能來自你讀的研究、可能來自你觀察到的規律。這個系列給你的是把判斷寫成程式碼、拿歷史資料檢驗它、加上真實成本再檢驗一次、確認它不是運氣、最後讓它無人值守地跑起來的完整流程。這套流程換一個判斷還能重跑，這才是它的價值。

## 30 天後你手上會有什麼

不是三個寫死的策略，是一套**策略積木庫**。

如果每個策略都是一個獨立的 class，三個策略就有三份重複的「算特徵、判斷條件、決定部位」邏輯，而且當你想試「這個策略的進場條件配那個策略的出場條件」時，完全沒有辦法。所以這個系列從 Day 16 開始把策略拆成可互換的積木：進場條件、過濾條件、出場規則，Day 24 再加上部位計算。新策略的成本從此降到一個設定檔。

先給你看一眼終點長什麼樣子。這是 Day 17 會產出的設定檔，一個以 EMA 快慢線交叉進場、用 RSI 過濾掉追高的策略：

```yaml
name: trend_ema_rsi
symbol: BTC/USDT
market: spot          # 現貨。標清楚市場類型，不跟永續合約的資料混用
timeframe: 1h

entry:
  all_of:
    - cross_above:
        fast: { feature: ema, period: 12 }
        slow: { feature: ema, period: 26 }

filter:                # 過濾不會讓你進場，只會否決進場
  none_of:
    - threshold:
        feature: { feature: rsi, period: 14 }
        op: ">"
        value: 70

exit:
  any_of:
    - cross_below:
        fast: { feature: ema, period: 12 }
        slow: { feature: ema, period: 26 }
    - max_holding_bars: 48
```

看得懂這份設定檔在說什麼，不需要任何交易背景，這正是積木化想達到的效果。到了 Day 18，換掉 `entry` 底下那幾行就能得到一個哲學完全相反的均值回歸策略，不必改任何 Python。

不過這裡有一個必須先講的配套。能自由組合，就一定會有人（包括你自己）拿它亂試一通，跑個五百組挑最漂亮的那一個。所以這套工具**必須連安全鎖一起交付**，Day 21 會用一份「在完全隨機的假資料上照樣挖得出漂亮策略」的示範把這件事講完。在那之前，這個系列不會鼓勵你多試幾組看看。

## 資料來源版圖：先畫地圖，再決定走哪一條

新手最容易在這裡停很久。你搜「crypto data api」，跳出十幾家 provider，每一家的首頁都說自己是機構級、每一家都有價目表，看起來每一家都很重要。實際上它們解決的是完全不同的問題，而這 30 天你只需要走其中一條。

先把地圖攤開。

### 五類 provider 各自解決什麼問題

| 類別 | 解決什麼問題 | 代表 | 本系列用不用 |
|---|---|---|---|
| A. 交易所原生 | 你實際下單那個場所的第一手行情：歷史批次、缺口回補、即時串流 | data.binance.vision、Binance REST、Binance WebSocket | 主力。所有進到專案的市場資料都源自這裡 |
| B. 多交易所聚合 | 跨市場參考價、幣種基本資料、交叉驗證 | CoinGecko、CoinMarketCap、CryptoDataDownload | 只當對照組 |
| C. 機構級 tick 與 L2 歷史 | 跨多家交易所、多年份的逐筆成交與掛單簿重建 | Tardis.dev、Kaiko、CoinAPI、Amberdata | 不用 |
| D. 衍生品專項 | 資金費率、未平倉量、清算資料 | CoinGlass | 不用（Day 30 的演化路徑） |
| E. 鏈上資料 | 錢包標記、協議 TVL、鏈上資金流 | Dune、Nansen、Glassnode、DefiLlama、Etherscan、The Graph | 不用（Day 30 的演化路徑） |

這張表最重要的是最後一欄。五類裡面，這 30 天真正會動到的只有 A，B 只出現在驗證的環節。

### 為什麼主來源選 Binance

第一類裡面交易所有幾十家，選哪一家是有理由的，而且理由要能查證。

**一，流動性集中在它身上。** 依 CoinGecko 2026 年第二季的交易所報告，前十大中心化交易所的現貨總量約 1.95 兆美元，其中 Binance 佔 38.7%，第二名 Bybit 約 10%。流動性直接決定你的資料品質：同一段時間裡成交越密集，K 線與掛單簿反映的資訊越完整，第二階段的微觀結構特徵才算得出東西。

**二，資料粒度。** Binance 提供 1 秒 K 線，Bybit 與 OKX 的最小間隔是 1 分鐘。對 Day 02 到 Day 08 的日線與小時線來說這沒差別，但 Day 09 之後要處理逐筆成交與掛單簿時，這是實質差距。

**三，官方免費的批次資料下載。** `data.binance.vision` 提供 klines、aggTrades、bookTicker、fundingRate 的 daily 與 monthly zip 檔，免費、無額度限制、不消耗 API weight。這件事的重要性在 Day 03 會算給你看：用 REST 翻頁抓一年份的 1 分鐘 K 線要跑幾百次請求，而下載月檔只要幾個 HTTP GET。

所以在這個系列裡，Binance 資料有三條路徑，各管一段：

| 路徑 | 拿什麼 | 條件 |
|---|---|---|
| data.binance.vision 批次 | 大量歷史 K 線、逐筆成交、掛單簿快照 | 免費、不吃 rate limit。當日資料隔日上傳，月檔次月初才會有 |
| Binance REST（透過 ccxt） | 最近幾天的缺口回補、帳戶與訂單查詢 | klines 單次上限 1000 根、每次 2 weight，每 IP 每分鐘 2400 weight |
| Binance WebSocket（原生 websockets） | 即時逐筆成交、掛單簿增量更新 | 免費，但心跳、重連、序號斷裂後重取快照要自己處理 |

歷史批次跟即時串流是兩條分開設計的路徑，中間的缺口用 REST 補。這個雙軌設計是 Day 03 的主題。

### 你現在不需要付錢

第三類那幾家會在搜尋結果裡排得很前面，價目表也很有存在感。Tardis.dev 提供 150 家以上交易所的 tick 級掛單簿、成交、資金費率、清算與選擇權鏈資料，月費約 50 到 900 美元；Kaiko 與 Amberdata 走合規與機構整合路線；CoinAPI 給你統一 schema 的 REST 歷史查詢加上 WebSocket 歷史重播。

這些服務都很好，但它們解決的是一個你現在沒有的問題：**跨多家交易所、重建多年份的 L2 掛單簿，或者做需要精確 bid-ask 的高頻策略。** 只要你的策略頻率在分鐘級以上、而且只在一個交易所下單，Binance 官方免費的批次檔加上 WebSocket 就完全夠用。

這個系列會**全程零成本跑完**：資料源全部免費，下單全部走 testnet。你不需要在第一天就掏出信用卡，這不是入場門檻。

### 你現在不需要鏈上資料

第五類的名氣可能比其他四類加起來還大。Dune 讓你用 SQL 查鏈上資料、介面對工程師最友善；Nansen 做錢包標記與 smart money 追蹤，覆蓋 20 條以上的鏈；Glassnode 提供 realized price、持有者分布、NVT 這類機構級鏈上指標；DefiLlama 的協議 TVL 與 DEX 成交量 API 免費；Etherscan 與 The Graph 則是查詢與索引的基礎設施。

要對你誠實：**這 30 天沒有一天真的需要鏈上資料。** 系列裡會做出來的每一個特徵，OBI、VWAP、活躍度、流動性擺盪、Volume Profile，全部來自交易所的行情與掛單簿。鏈上資料是 Day 30 演化路徑裡的一個方向，前置條件是你已經有一套能驗證特徵有沒有預測力的流程，而那正是前面 29 天在蓋的東西。

把這件事講清楚，是為了讓你不要在第一天就卡在「要不要買 Nansen」這種還輪不到你煩惱的問題上。

### 六條選型原則

這六條是全系列的選型基準，之後每一天用到資料時都要對得回這裡。

**一、先問「這筆資料要拿來做什麼決策」，再選 provider。** 決策不同，可接受的延遲、粒度與成本就不同。日線策略需要的東西跟秒級策略差了幾個數量級。

**二、能用交易所原生就用原生。** 聚合商會重採樣、對齊時間戳、補值，這些加工在回測時是雜訊來源。更重要的理由是：你實際下單的地方就是那個交易所，訊號用的資料必須跟成交場所一致。

**三、現貨資料 NEVER 拿去回測永續合約策略，反之亦然。** 現貨是一手交錢一手交幣，永續合約是沒有到期日的槓桿衍生品，兩者的價格、成交量與費用結構都不同（Day 03 會正式解釋）。這是新手回測失真最常見的來源之一，而且症狀很隱蔽：兩邊的價格走勢看起來幾乎一樣，差異藏在你不會特別去看的地方。所以文章裡出現交易對時一律標清楚市場類型，設定檔裡也要有 `market` 這一欄。

**四、歷史批次與即時串流是兩條路徑，分開設計。** 批次走 data.binance.vision，即時走 WebSocket，中間的缺口用 REST 補。三者的資料在入庫時必須統一 schema 與時區，一律 UTC。

**五、每個主來源都要有對照組。** 用 CoinGecko 或 CryptoDataDownload 抽樣比對 Binance 的資料，不一致就查清楚原因再往下做。不同 provider 對「時間戳是開盤還是收盤」「成交量是張數還是名目金額」的定義不一樣，接錯了會產生看起來很合理、實際上是假的訊號。唯一的例外是 Day 09 引入的 tick 與掛單簿，那層粒度沒有免費對照組，只能信交易所原生。

**六、免費層夠不夠用，動工前先算。** 不要寫到 Day 20 才發現要付月費。順帶提一個實際的例子：CoinMarketCap 免費層每分鐘 50 calls、每月 15,000 credits 看起來很夠，但它**不含歷史 OHLCV**，只有即時報價，所以不能拿它當歷史資料源。CoinGecko 的 Demo 方案每月 10,000 credits、50 個以上的 endpoint，含最多一年的日／時／分 OHLCV，這才是能當對照組的規格。以上額度是 2026 年中的狀態，這類數字半年就會變，動工前自己去官網確認一次。

### 各階段的主來源對照

| 階段 | 主來源 | 對照／備援 |
|---|---|---|
| Day 02–08 基石（K 線、指標、入庫） | data.binance.vision 批次 ＋ REST 補洞 | CoinGecko、CryptoDataDownload 抽樣比對 |
| Day 09–15 微觀結構（Tick、掛單簿） | Binance WebSocket 即時錄製 ＋ 批次的 aggTrades／bookTicker | 無，這層只信原生 |
| Day 16–22 策略與回測 | 前兩階段入庫的 TimescaleDB | 用 CoinGecko 驗證回測期間的價格區間合理 |
| Day 23–29 上線與維運 | Binance testnet（REST ＋ WS） | 正式環境唯讀 API key 做對帳 |

## 把環境建起來

技術棧先一張表帶過。每一項的完整理由留給真正用到的那一天，這裡各給一句話就好。

| 用途 | 選型 | 一句話理由 |
|---|---|---|
| 語言 | Python 3.12 | 量化生態系最完整；算得慢的部分交給 numpy 與 Numba |
| 歷史回補 | data.binance.vision | 免費、不吃 rate limit（Day 03） |
| 連線與下單 | ccxt ＋ 原生 websockets | REST signing 不自己手刻，即時資料走原生 WS 才控制得住重連（Day 03、Day 09） |
| 非同步 | asyncio ＋ aiohttp | 爬取與行情訂閱是 I/O bound，不用 threading |
| 資料處理 | pandas ＋ numpy | 全系列一律向量化，NEVER 用 for loop 遍歷 K 線 |
| 儲存 | TimescaleDB ＋ asyncpg | 時序資料要的是 hypertable 分區、時間桶聚合與壓縮（Day 07） |
| 指標 | 自己實作，pandas-ta 當對照組 | 自己算一遍才知道哪裡會錯（Day 04–06） |
| 回測 | VectorBT | 向量化，跟前面的資料處理一脈相承（Day 19） |
| 視覺化 | Plotly ＋ matplotlib | 指標與績效一定要有圖，Plotly 可以縮放看細節 |
| 加速 | Numba | 遞迴型指標向量化不掉時才用（Day 26） |
| 告警 | Telegram Bot API | 免費、有官方 API、手機直接收（Day 25） |
| 設定與密鑰 | pydantic-settings ＋ .env | API key NEVER 寫進程式碼，NEVER 進版控（Day 03） |
| 測試 | pytest | 指標與策略邏輯要有測試，尤其是邊界情況 |
| 部署 | Docker ＋ Docker Compose ＋ VPS | 本機與雲端同一份映像檔（Day 27） |

### 建專案

用 uv（沒裝也可以用 venv 加 pip，指令換掉即可）：

```bash
uv init quantbot && cd quantbot
uv python pin 3.12
uv add pandas numpy ccxt asyncpg pydantic-settings pyyaml
uv add --dev pytest pytest-asyncio ruff
```

目錄不要一次全建好。這 30 天會一天長一塊，今天只需要能跑測試的最小骨架：

```
quantbot/
├── quantbot/
│   ├── __init__.py
│   └── config.py       # 今天唯一的實作
├── tests/
│   └── test_config.py
├── docker/
│   └── docker-compose.yml
├── .env.example
├── .gitignore
├── pyproject.toml
└── README.md
```

### 設定與密鑰

從第一天就把設定集中在一個地方，之後每加一個外部服務就往這裡加欄位。API key 一律從 `.env` 讀，不寫死在程式碼裡：

```python
# quantbot/config.py
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """全專案共用的設定。來源是 .env，程式碼裡不出現任何密鑰。"""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    binance_api_key: str = ""
    binance_api_secret: str = ""
    binance_testnet: bool = True

    postgres_dsn: str = Field(
        default="postgresql://quantbot:changeme@localhost:5432/market",
        description="TimescaleDB 連線字串",
    )

    default_symbol: str = "BTC/USDT"
    default_market: str = "spot"


settings = Settings()
```

`binance_testnet` 預設 `True`。這個預設值不是為了今天，是為了三週後那個改完程式碼、忘記自己在改哪個環境的你。

`.env.example` 進版控，`.env` 不進：

```bash
# .env.example
BINANCE_API_KEY=
BINANCE_API_SECRET=
BINANCE_TESTNET=true
POSTGRES_PASSWORD=changeme
POSTGRES_DSN=postgresql://quantbot:changeme@localhost:5432/market
```

`.gitignore` 至少要有這幾行：

```
.env
.venv/
__pycache__/
data/
*.parquet
```

### 起一個 TimescaleDB

Day 07 才會真的用到資料庫，但今天先把它跑起來，確認環境沒問題：

```yaml
# docker/docker-compose.yml
services:
  timescaledb:
    image: timescale/timescaledb:latest-pg16
    container_name: quantbot-db
    environment:
      POSTGRES_USER: quantbot
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-changeme}
      POSTGRES_DB: market
      TZ: UTC
    ports:
      - "5432:5432"
    volumes:
      - timescale-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U quantbot -d market"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

volumes:
  timescale-data:
```

時區設 UTC 不是細節。交易資料只要有一個環節用了本地時間，之後對帳時你會花很久才找到差異在哪。

## 今日交付物

`quantbot` 空專案，能跑起來、能跑測試、密鑰不會外洩、README 裡有一張資料源對照表。

驗收標準，四項全過才算完成：

1. `docker compose -f docker/docker-compose.yml up -d` 之後，`docker compose ps` 看到 timescaledb 狀態是 `healthy`。
2. `uv run pytest` 跑得動，至少有一個測試通過（測 `Settings` 能載入、`binance_testnet` 預設為 `True` 就夠）。
3. `.env.example` 存在且已進版控；`.env` 存在但 `git status` 看不到它。
4. README 裡有一張「本系列用哪些資料源、各自負責什麼」的表，內容就是上面那張五類 provider 表的精簡版。之後每引入一個新來源就更新它。

第四項看起來像雜務，但它會在 Day 20 之後救你一次。當你發現某個回測結果不合理時，第一個要問的問題永遠是「這張表是誰給的」，而那時候你的專案裡已經有三種擷取路徑跟兩個對照組了。

## 免責聲明

本系列為程式與資料工程的技術分享，所有策略與數字皆為教學範例，不構成投資建議。加密貨幣波動劇烈，實際交易請自行評估風險。系列中所有回測結果都是歷史資料上的表現，不保證未來，也不代表任何策略會賺錢。

## 明天

明天 Day 02，我們從資料管線最左邊那一格開始：打開行情圖只看到一堆紅綠棒子，那些棒子其實就是五個數字。我們會把 K 線（OHLCV）拆成你熟悉的資料結構，講清楚為什麼是這五個數字、時間戳到底是開盤還是收盤、最後一根 K 線為什麼不能直接拿來用。也會留一個伏筆：這五個數字在壓縮的過程中，丟掉了一整段資訊，那段資訊要到 Day 09 才拿得回來。

## Reference

- Binance 現貨市占數字的報導來源，引用 CoinGecko 2026 年第二季交易所報告 — Crypto Briefing, "Binance dominant amid spot volume drop"：https://cryptobriefing.com/binance-dominant-amid-spot-volume-drop/
- 官方免費歷史批次資料的檔案結構與下載方式 — Binance Public Data：https://github.com/binance/binance-public-data
- 各家歷史行情 API 的粒度、覆蓋範圍與方案比較 — CoinGecko, "Best Historical Crypto Data APIs"：https://www.coingecko.com/learn/best-historical-crypto-data-apis
- 免費層額度與是否含歷史 OHLCV 的比較（含 CoinMarketCap 免費層限制） — CoinMarketCap Academy, "Best Free Crypto API in 2026: Free Tier Comparison"：https://coinmarketcap.com/academy/article/best-free-crypto-api-in-2026-free-tier-comparison
- 機構級 tick 與 L2 掛單簿歷史資料的涵蓋範圍與價位 — Tardis.dev：https://tardis.dev/
- 衍生品資料（資金費率、未平倉、清算）的 API 規格 — CoinGlass API Documentation：https://docs.coinglass.com/
