---
title: "Day 27：本機跑得好好的，上雲就掛？用 Docker 把機器人打包部署到 VPS"
datetime: "2026-10-11"
description: "容器化解決的是環境一致與掛掉自動重啟。這篇寫多階段 Dockerfile、把 .env 擋在映像檔外面、以及 compose 的 depends_on 為什麼一定要配 healthcheck。另外做一個真正有用的健康檢查——它問的不是「行程還在嗎」，是「資料還新嗎」，而基準必須是最後一根已收盤的 K 線。順帶量出多階段建置在這個專案只省了 70 MB，而真正的重量是昨天為了加速付的 169 MB。"
image: ""
parent: "2026 ithome-鐵人賽: 工程師的量化交易入門：從 K 線到可組合的交易策略引擎 系列"
draft: true
---

## 從「跑得動」到「一直在跑」

到目前為止所有指令都跑在本機，而本機有幾個很好的性質：Python 版本是對的、`.env` 在該在的位置、資料庫在 localhost、以及有人在旁邊看著。

搬到 VPS 之後這四件事全部不成立。今天處理的就是把它們一個一個變回成立。

容器化解決的是其中兩件：**環境一致**（本機與雲端跑的是同一份映像檔）與**掛掉自動重啟**。剩下兩件要自己處理：金鑰不能進映像檔，以及「還活著」要有人（或有東西）在問。

## 交易概念補課：VPS 選在哪裡

機房離交易所越近，延遲越低。Binance 的現貨與合約撮合主要在 AWS 的東京區（ap-northeast-1），所以那一區的 VPS 到 API 的往返會比歐美機房快上百毫秒。

而對本系列的策略頻率來說，**穩定性比延遲重要得多**。1 小時 K 線的策略在收盤後才產生訊號，一百毫秒的差別在一小時的週期裡量不出來。反過來，一個便宜但每週斷線兩次的機房會讓 Day 23 的重試與斷路器天天在工作，而每一次斷線都是一段狀態不明的時間。

所以選機房的順序是：先看**穩定與網路品質**，再看地理位置。不要為了幾毫秒挑一個會斷線的地方——那是拿一個量不到的好處，換一個看得見的風險。

## 多階段建置，以及它在這裡沒省到多少

```dockerfile
# docker/Dockerfile
FROM ghcr.io/astral-sh/uv:python3.14-bookworm-slim AS builder

# UV_COMPILE_BYTECODE 讓 .pyc 在建置時就產好，容器啟動不必再編一次。
# UV_LINK_MODE=copy 是因為快取掛載與目標在不同的檔案系統上，硬連結會失敗。
# UV_PYTHON_DOWNLOADS=never 確保用的是映像檔裡那一個 Python，不會偷偷下載另一個。
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never

WORKDIR /app

# 依賴與程式碼分成兩層，順序是刻意的：pyproject.toml 與 uv.lock 很少變，
# 所以「安裝依賴」那一層可以被快取；改一行 Python 不必重裝 numba。
COPY pyproject.toml uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-install-project --no-dev
```

分層那一段是 Dockerfile 最實際的一個技巧：**把很少變的東西放在前面。** 依賴與程式碼分兩層之後，改一行 Python 的重建只需要幾秒；混在一起的話每次都要重裝 numba 與 pyarrow。

`--frozen` 也值得指出來：它要求 `uv.lock` 與 `pyproject.toml` 一致，不一致就失敗而不是自己重解一次。部署時**不該**發生依賴版本悄悄變動這件事，而 `--frozen` 讓那件事變成一個建置錯誤。

然後是誠實的部分。多階段建置的宣傳語是「映像檔小很多」，而這個專案量出來的數字是：

| 映像檔 | 大小 |
|---|---|
| builder 階段（含 uv 與快取） | 1.27 GB |
| 最終映像檔 | **1.20 GB** |

**省了 70 MB。** 原因不難查：

```
$ docker run --rm quantbot:latest sh -c 'du -sh /app/.venv; du -sh /app/.venv/lib/python3.14/site-packages/* | sort -rh | head -6'
731M    /app/.venv
169M    llvmlite
143M    pyarrow
 77M    pandas
 70M    ccxt
 67M    plotly
 40M    numpy
```

肥的是 `.venv` 本身（731 MB），而 builder 階段多的那 70 MB 只是 uv 執行檔與一些建置工具。多階段建置在這裡的價值不是體積，是**乾淨**：最終映像檔裡沒有套件管理器、沒有編譯器、沒有 lock 檔，被打進來的人少了幾樣工具。

那 169 MB 的 `llvmlite` 是昨天的帳單：Numba 需要 LLVM，而那是換到 2,237 倍加速付的價錢。這個取捨要記得，因為它是可以反悔的——如果哪天 POC 那個特徵不再需要（它只在離線分析路徑上），拿掉 numba 就省下 200 MB。

`plotly` 那 67 MB 是另一個候選：它只用在研究階段的圖表，機器人跑起來不需要畫圖。要拿掉它得先把 Day 20 到 22 的 renderer 移到一個 optional extra 裡，而那會動到模組邊界，所以先記在這裡不做。

真正有效的一刀是 `--no-dev`：

```dockerfile
# docker/Dockerfile
# --no-dev 把 vectorbt 排除在外。它是 Day 19 的對照組，只在測試裡用得到，
# 而它自己的依賴樹（含 matplotlib、scipy）比整個專案還大。
```

## 不用 root 跑

```dockerfile
# docker/Dockerfile
# 不用 root 跑。這一層很便宜，而它擋掉的是「容器被打進來之後還是 root」。
RUN useradd --create-home --uid 10001 quantbot
...
USER quantbot
```

加上時區：

```dockerfile
# 時區釘死 UTC。整個專案的時間戳都是 tz-aware UTC，而容器的 locale 不該有機會
# 影響任何一個數字——K 線的邊界差一小時，所有訊號都會對不上。
ENV TZ=UTC
```

`TZ=UTC` 在這個專案裡其實是**第二道防線**：時間從 Day 03 起就一律 tz-aware UTC，naive datetime 在邊界就被擋掉。但一個把容器時區設成本地時間的部署，會讓任何一個未來新增的、不小心用了本地時間的程式碼安靜地錯一小時，而 K 線邊界錯一小時的結果是所有訊號都對不上。這一行的成本是零。

最後：

```dockerfile
# 預設什麼都不做：這個映像檔有好幾個入口（回補、管線、控制迴圈、健康檢查），
# 而「預設跑哪一個」是 compose 的決定，不是映像檔的決定。
CMD ["python", "-m", "quantbot.entrypoints.health_command"]
```

## .env 不能進映像檔

這是今天唯一一個「做錯會直接把金鑰寄出去」的地方。

映像檔會被推到 registry、會被 `docker history` 讀出每一層的內容、會被任何拿到那個 tag 的人 pull 下來。一個 `COPY . .` 會把 `.env` 打包進去，而刪掉之後那一層還在——Docker 的層是疊加的，後面的 `RM` 只是在上層蓋一個「這個檔案不存在」的標記，底層那份還讀得出來。

```
# .dockerignore
# 這個檔案的第一行就是它存在的理由：.env 有 API key 與 bot token，
# 而 COPY . . 會把它一起打包進映像檔。映像檔會被推到 registry、
# 被 docker history 讀出來——那等於把金鑰寄出去。
#
# 這個專案的 Dockerfile 只 COPY 三個明確的路徑（pyproject.toml、uv.lock、
# quantbot/），所以 .env 本來也進不去。這份清單是第二道防線：哪天有人為了
# 方便改成 COPY . .，它還在。
.env
.env.*
!.env.example
```

兩道防線都要有。`COPY` 只複製明確的路徑是主要的保護，`.dockerignore` 是那個保護被改掉之後的後備。驗一次很快：

```
$ docker run --rm quantbot:latest ls -a /app
.
..
.venv
data
quantbot
```

金鑰怎麼進去：compose 的 `env_file`。它在容器**執行時**注入環境變數，不會進映像檔。

## compose：depends_on 不配 healthcheck 等於沒有

```yaml
# docker/docker-compose.yml
  migrate:
    build:
      context: ..
      dockerfile: docker/Dockerfile
    command: ["python", "-m", "quantbot.infrastructure.persistence.migrate"]
    depends_on:
      timescaledb:
        # 只寫 depends_on 的話 compose 只等「容器啟動」，而 PostgreSQL 的容器
        # 啟動之後還要幾秒才接受連線。service_healthy 等的是 healthcheck 通過。
        condition: service_healthy
    restart: "no"
```

三個細節。

**`condition: service_healthy`。** 不寫條件的 `depends_on` 只保證「那個容器被啟動了」，而資料庫在容器啟動之後還要幾秒才接受連線。第一次部署會失敗、重啟之後成功，於是這個問題會被歸類成「第一次總是要重跑一次」而不是一個 bug。

**`restart: "no"`。** 遷移是一次性的工作，正常結束的 exit code 是 0。而 `restart: unless-stopped` 會把「正常結束」也當成需要重啟——於是 migrate 會無限重跑。這是 compose 最容易踩到的一個組合。

**下游用 `service_completed_successfully`。**

```yaml
# docker/docker-compose.yml
    depends_on:
      migrate:
        # 遷移要跑完才輪到它。service_completed_successfully 等的是 exit code 0，
        # 所以遷移失敗的話管線根本不會起來——而那是對的：schema 不對的話寫進去的
        # 資料會是錯的。
        condition: service_completed_successfully
```

還有一個跟安全有關的：

```yaml
    ports:
      # 只綁 127.0.0.1。不寫的話 docker 會幫忙在 VPS 上開一個對外的 5432，
      # 而它會繞過 ufw——docker 直接寫 iptables，防火牆規則管不到它。
      - "127.0.0.1:5432:5432"
```

這一條在 VPS 上是必要的。`ufw deny 5432` 對 docker 發布的埠沒有效果，因為 docker 把規則寫在 `DOCKER` 這條 iptables chain 上，而它在 ufw 的規則之前。一個「防火牆已經關掉 5432」的 VPS 上，一個沒綁 127.0.0.1 的 compose 會讓整個網際網路連得到那個資料庫。

## 健康檢查要問「資料還新嗎」，不是「行程還在嗎」

`docker ps` 已經知道行程還在不在，所以那件事不值得再寫一次。真正會發生而 docker 看不出來的故障是：**行程活著，但它已經停止做事了。**

回補管線卡在一個永遠不會回來的請求上、交易所改了 API 而錯誤被 `|| true` 吃掉、或者磁碟滿了寫不進去——三種情況下行程都活著。

```python
# quantbot/domain/values/data_freshness.py
@dataclass(frozen=True)
class DataFreshness:
    """資料落後了幾根。健康檢查裡最重要的一個數字。

    「落後幾根」而不是「落後幾分鐘」，因為門檻要能跨 timeframe 沿用：1 小時 K 線
    落後 30 分鐘完全正常（那一根還沒收），1 分鐘 K 線落後 30 分鐘代表管線死了。
    換成根數之後，同一個門檻在兩種粒度上都是對的。

    比較的基準是**最後一根已收盤的 K 線**，不是「現在」。這是 Day 03 就處理過的
    區別，而它在健康檢查裡特別容易忘記：拿 now 去減最後一筆資料的時間，永遠會
    得到一個介於 0 與一根之間的落後，於是門檻只能設得很鬆，而鬆到某個程度就
    什麼都擋不住了。
    """
```

那個「基準」是這一段唯一會出錯而且不會被發現的地方，所以它有測試：

```python
# tests/domain/services/test_data_freshness_service.py
def test_bars_behind_counts_from_the_latest_closed_bar(
    latest, expected_behind, expected_fresh
):
    """基準是最後一根**已收盤**的 K 線，不是「現在」。

    拿 now 去減最後一筆資料的時間，永遠會得到一個介於 0 與一根之間的落後，
    於是門檻設 3 根也永遠不會觸發——一個永遠回報健康的健康檢查。
    """
```

「一筆資料都沒有」與「落後很多根」在型別上是分開的（`bars_behind` 回 `None` 而不是一個很大的數字），因為它們是不同的處境：前者是剛部署，後者是壞了。

兩項檢查也是分開的：

```python
# quantbot/application/check_health_application.py
class CheckHealthApplication:
    """容器的健康檢查：資料庫連得上嗎、資料夠新嗎。

    兩項檢查的順序是刻意的，而它反映一件事：**「連不上資料庫」與「資料太舊」
    是兩個不同的故障，處理方式也不同。** 前者是基礎設施（容器起來的順序、
    網路、密碼），後者是管線（回補的 job 死了、交易所改了 API）。一個把兩者
    混成一個「不健康」的檢查，會讓半夜看到告警的人先查錯地方。

    連線失敗**不往上丟例外**，而是變成一項失敗的檢查。理由很實際：這個用例的
    呼叫端是 docker 的 healthcheck，而它讀的是 exit code。一個 traceback 跟一個
    exit code 1 對 docker 來說一樣，但對人不一樣——後者印得出「差多少根」。
    """
```

在容器裡實跑兩種情況：

```
$ docker run --rm -e POSTGRES_DSN="postgresql://quantbot:...@host.docker.internal:5432/market" \
    quantbot:latest python -m quantbot.entrypoints.health_command --timeframe 1h
checked_at : 2026-08-21T23:46:25.471471+00:00
  PASS  database        連得上，查詢正常
  PASS  data_freshness  最後一根 2026-08-21T20:00:00+00:00，落後 2 根（門檻 3）
result : HEALTHY
exit=0

$ docker run --rm -e POSTGRES_DSN="postgresql://quantbot:...@nowhere:5432/market" \
    quantbot:latest python -m quantbot.entrypoints.health_command --timeframe 1h
checked_at : 2026-08-21T23:46:26.360385+00:00
  FAIL  database        連不上或查詢失敗：gaierror: [Errno -2] Name or service not known
result : UNHEALTHY
failing: database
exit=1
```

接到 compose 上：

```yaml
# docker/docker-compose.yml
    healthcheck:
      # 健康檢查問的不是「行程還在嗎」（那件事 docker 自己知道），而是
      # 「資料還新嗎」。一個活著但停止回補的管線，行程檢查完全看不出來。
      test: ["CMD", "python", "-m", "quantbot.entrypoints.health_command", "--timeframe", "1h"]
      interval: 5m
      timeout: 60s
      # start_period 期間失敗不算失敗。第一次部署要跑完整段回補，那會超過幾分鐘。
      start_period: 30m
      retries: 3
```

`start_period` 那一行是第一次部署會咬人的地方：整段歷史回補要跑十幾分鐘，而在那之前資料當然是「不新」的。沒有 `start_period` 的話 compose 會在回補完成前就把容器判成不健康。

## 週期性工作：容器裡不要養 cron

回補管線要每小時跑一次。在 VPS 上的自然選擇是 crontab，而在容器裡它不是：

```yaml
# docker/docker-compose.yml
  # 回補管線。每小時跑一次，用 shell 的迴圈而不是 cron——一個容器一個行程，
  # 而 cron 在容器裡要多養一個 daemon 跟一份自己的環境變數。
    command:
      - sh
      - -c
      - >-
        while true; do
        python -m quantbot.entrypoints.ingest_pipeline_command || echo "ingest failed, retrying next hour";
        sleep 3600;
        done
```

`|| echo` 那一段是刻意的：一次回補失敗**不該**讓容器結束。它下一個小時會再試一次，而中間的缺口由 Day 03 的缺漏偵測補回來——那條路徑本來就是為了這個而存在的。真的持續失敗的話，健康檢查會在資料落後超過三根的時候把它標成不健康，而那才是需要人的訊號。

## 部署到 VPS 的完整步驟

以 Ubuntu 24.04 的一台小機器為例。

```bash
# 1. 只留 SSH，其餘一律拒絕。注意這對 docker 發布的埠無效（見上面那一節），
#    所以資料庫的 port 綁定必須寫 127.0.0.1。
sudo ufw default deny incoming
sudo ufw allow OpenSSH
sudo ufw enable

# 2. 對時。交易系統的時間錯一分鐘，K 線的邊界就對不上，而簽章也可能被交易所拒絕
#    （Binance 對 timestamp 有容許範圍）。
sudo timedatectl set-timezone UTC
timedatectl show --property=NTPSynchronized --value   # 要是 yes

# 3. Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker "$USER"   # 重新登入才生效

# 4. 專案與金鑰
git clone <repo> quantbot && cd quantbot
cp .env.example .env && ${EDITOR:-vi} .env    # 填 testnet 的金鑰
chmod 600 .env

# 5. 起來
docker compose -f docker/docker-compose.yml up -d --build
docker compose -f docker/docker-compose.yml ps
docker compose -f docker/docker-compose.yml logs -f ingest
```

第二步值得多一句。Binance 的簽章請求帶一個 `timestamp`，而伺服器會拒絕偏離太多的請求（預設容許 1 秒，可調到 60 秒）。一台沒有對時的 VPS 漂移幾分鐘之後，**所有需要簽章的請求都會失敗**，而錯誤訊息是「timestamp 超出容許範圍」——那個訊息很清楚，但如果沒想到時間這件事，它看起來像一個 API 的問題。

## 今日交付物

```
quantbot/
├── docker/
│   ├── Dockerfile                    今天：多階段、非 root、TZ=UTC
│   └── docker-compose.yml            今天：四個服務，depends_on 配 healthcheck
├── .dockerignore                     今天：第一行是 .env
├── .env.example                      今天（原本是空的）
├── domain/
│   ├── values/data_freshness.py      今天
│   ├── services/data_freshness_service.py   今天
│   └── dto/health_report.py          今天
├── application/check_health_application.py  今天
├── infrastructure/reporting/text_health_report_renderer.py   今天
├── entrypoints/health_command.py     今天
└── tests/                            2 個新測試檔案，共 13 條
```

### 本機先驗一次

```bash
uv sync
docker compose -f docker/docker-compose.yml up -d timescaledb
uv run python -m quantbot.entrypoints.ingest_pipeline_command
uv run python -m quantbot.entrypoints.health_command --timeframe 1h
echo $?    # 0 才對
```

### 打包並在容器裡跑一次

```bash
docker build -f docker/Dockerfile -t quantbot:latest .
docker run --rm quantbot:latest ls -a /app          # 不該看到 .env
docker run --rm \
    -e POSTGRES_DSN="postgresql://quantbot:changeme@host.docker.internal:5432/market" \
    quantbot:latest python -m quantbot.entrypoints.health_command --timeframe 1h
```

### 整套起來

```bash
docker compose -f docker/docker-compose.yml up -d --build
docker compose -f docker/docker-compose.yml ps      # ingest 要是 healthy
```

第一次會花十幾分鐘，因為 `ingest` 要跑完整段回補。`start_period: 30m` 就是為了這一段。

### 驗收標準

八項全過才算完成：

1. `docker build` 成功，映像檔跑得起來（`ls -a /app` 看得到 `.venv`、`data`、`quantbot`）。
2. **映像檔裡沒有 `.env`。** 這一項用一個指令驗，不要用「應該不會有」。
3. **健康檢查在連不上資料庫時回 exit 1 並印出原因**，不是 traceback。有測試釘住。
4. **落後根數從「最後一根已收盤」算起**，有測試釘住五種落後量。
5. **「一筆資料都沒有」與「落後很多根」在型別上分得出來**，有測試釘住。
6. `migrate` 服務的 `restart` 是 `"no"`，而下游用 `service_completed_successfully`。
7. 資料庫的 port 綁在 `127.0.0.1`。
8. `uv run pytest`（613 passed）、`uv run mypy quantbot`、`uv run lint-imports` 全過。

第 2 與第 7 項是今天最值得留著的兩條，因為它們擋的是「金鑰外流」與「資料庫對整個網際網路開放」。

> 免責聲明：本文為程式與資料工程的技術分享，映像檔大小與建置時間為本機實測（Apple Silicon、Docker Desktop），換平台會不同。部署一律先接 testnet；所有策略與數字皆為教學範例，不構成投資建議。

## 明天

機器人在雲端跑起來了，而它的日誌現在長這樣：一堆「回補完成」與「送單成功」。

那份日誌回答不了一個問題，而它是策略虧錢時唯一想問的問題：**三天前那筆單為什麼會下？**

明天做結構化的決策日誌。要記的不只是「下了什麼單」，而是當下的完整決策脈絡：那一刻每個特徵的值、條件樹裡哪幾個節點成立、部位計算的輸入與輸出。而積木化讓這件事變得可行——因為策略是宣告式的，整棵條件樹連同各節點的當下真假值可以一起存下來，出事時直接看得到是哪一個積木判斷錯。

## Reference

- [uv 官方的 Docker 用法：多階段、快取掛載、`--frozen` 與 `--no-install-project` 的分層 — uv documentation, Using uv in Docker](https://docs.astral.sh/uv/guides/integration/docker/)
- [`depends_on` 的三種 condition，以及 `service_started` 為什麼不夠 — Docker documentation, Compose file reference: depends_on](https://docs.docker.com/reference/compose-file/services/#depends_on)
- [healthcheck 的 `start_period` 在該期間內失敗不計入 retries — Docker documentation, Compose file reference: healthcheck](https://docs.docker.com/reference/compose-file/services/#healthcheck)
- [Docker 發布的埠會繞過 ufw，因為它直接寫 iptables 的 DOCKER chain — Docker documentation, Packet filtering and firewalls](https://docs.docker.com/engine/network/packet-filtering-firewalls/)
- [簽章請求的 timestamp 容許範圍（recvWindow）與伺服器時間同步的要求 — Binance Spot API Documentation, Endpoint security type](https://developers.binance.com/docs/binance-spot-api-docs/rest-api/general-api-information)
