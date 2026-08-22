---
title: "Day 30：完賽總結：自動化替我們執行了哪些紀律，以及這套系統的下一步"
datetime: "2026-10-14"
description: "自動化贏的不是演算法聰明——這 30 天沒有一個策略賺錢。贏在它會嚴格執行冷靜時訂下的規則，而那件事在程式碼裡有具體的位置。這篇把三十天的成績單照實列出來，包含十五個「不會報錯」的錯誤，並給出五個演化方向與各自的前置條件。"
image: ""
parent: "2026 ithome-鐵人賽: 工程師的量化交易入門：從 K 線到可組合的交易策略引擎 系列"
draft: true
---

## 三十天之後手上有什麼

一個能自己抓資料、清洗入庫、算特徵、產生訊號、決定部位大小、送單重試對帳、
從手機接指令、市況不對自己停手、每一筆決策都留下完整脈絡的服務。

以及三個賠錢的策略。

這兩件事要放在一起講，因為它們是同一個結論的兩半：**這 30 天交付的是做研究的
基礎設施，不是一個賺錢的策略。**

## 自動化到底贏在哪

不是贏在演算法聰明。第三階段的三個策略在真實成本下都不賺錢，而如果自動化的
價值在於「電腦算得比人好」，那這 30 天就是失敗的。

它贏在別的地方，而那件事在程式碼裡有具體的位置。

**它不會因為虧了三筆就放大部位。** 人會，而那個衝動有一個名字叫做「把它賺回來」。
程式不會，因為下注比例是一個算式：

```python
# quantbot/domain/values/risk_limits.py
@dataclass(frozen=True)
class RiskLimits:
    """硬性上限。**它在部位計算之後套用，而且 NEVER 由策略設定檔覆寫。**

    落地方式是型別上的：`sizing.yaml` 裡沒有任何欄位對得到這三個值，而多寫一個
    `maximum_weight:` 會被 FeatureParameters.ensure_used() 當成拼錯的參數直接
    報錯——因為沒有任何 builder 會去取它。這條規則因此不靠人記得。
    """
```

「不靠人記得」是這一整套設計的重點。一個能從設定檔調高上限的系統，會在最想調高
上限的那個時刻被調高。

**它不會因為捨不得就把停損往下挪。** 出場條件是宣告式的一棵樹，寫在 YAML 裡，
而它跟進場條件在同一個檔案裡被同一份載入器讀進來。要挪停損得改設定檔、重啟，
而那個摩擦剛好夠讓人想一下。

**它不會半夜看到暴跌就恐慌平倉。** Day 29 的熔斷器在市況不對的時候做的事是
**什麼都不做**——而那正是極端行情下最常正確的動作。人在那個時刻的預設動作
是相反的。

而從手機下得動的指令刻意只有四個：

```python
# quantbot/domain/values/control_command.py
    """只有四個而不是「一個通用的指令介面」，是刻意的。可以從手機下的指令越多，
    在最不該即興決策的時刻能做的即興決策就越多。
    """
```

四個裡有三個是「少做一點」（暫停、平倉、查看），沒有一個是「多做一點」。

## 反過來說

人性的那些弱點在把規則寫成程式碼的那一刻就被隔離了。而同一件事的另一面是：
**規則寫錯的時候，它會忠實地一路錯到底。**

人會在第五筆感覺不對而停下來。程式不會——它會用同一個錯誤的判斷跑完一整年，
而每一筆都完全一致。這就是為什麼前面 29 天有那麼大一部分不是在寫策略，
而是在寫**驗證**：

| 這一天做的事 | 它擋的是哪一種「錯了但不會報錯」 |
|---|---|
| Day 04–06 每個指標配一個照定義手寫的對照組 | 指標算錯，而錯的值照樣落在合理範圍裡 |
| Day 16 訊號位移只寫在引擎一個地方 | 未來函數。策略數量一多，靠人記得一定會漏 |
| Day 17 條件引用的欄名要跟宣告的特徵對帳 | 打錯一個字，條件從第一根到最後一根都不成立 |
| Day 19 回測配逐根模擬與現成引擎兩個對照組 | 向量化寫錯，而權益曲線照樣長得很像 |
| Day 20 滑價用掛單簿實測而不是拍腦袋 | 假設高估了 6,400 倍 |
| Day 21 同一組搜尋也在打亂順序的假資料上跑一次 | 把運氣讀成訊號 |
| Day 22 並排比較的四個條件寫成建構時的檢查 | 拿兩段不同長度的回測比較，而報表上看不出來 |
| Day 23 失敗分四類，回報遺失只能查單 | 重送在「其實已經成交」的那一半機率裡建出第二個部位 |
| Day 26 加速的驗收條件是逐根完全相同 | 快但答案不一樣。慢只是慢，不一樣是錯的 |
| Day 28 決策日誌記整棵條件樹 | 「三天前那筆單為什麼會下」答不出來 |
| Day 29 極端案例全部故障注入 | 真實資料太乾淨，那些路徑從來沒有被執行過 |

## 十五個不會報錯的錯誤

這是這 30 天最實際的一份紀念品。每一個都是實跑抓到的，而它們的共同點是
**程式照樣跑完、數字照樣落在合理範圍**：

| 哪一天 | 錯誤 | 症狀 |
|---|---|---|
| 03 | `read_csv(skiprows=1)` 配 `names=` | 每個檔案的第一列資料被吃掉 |
| 03 | `sort_index()` 之後才去重 | 預設 quicksort 不穩定，實測只有 37% 的列保住該勝出的來源 |
| 05 | `ewm(span=3)` 的手算數字 | 文章寫 102.1667，pandas 3.0 實測 102.375 |
| 09 | 先拉快照再訂閱 | 兩者之間的空窗讓每次啟動必然多一次重取快照 |
| 09 | 緩衝只看列數不看時間 | 深度摘要每秒一列，湊滿 5,000 列要 83 分鐘 |
| 09 | 成交的時間戳不唯一 | `reindex(method="ffill")` 在重複索引上丟 `ValueError`，而合成測試資料測不到 |
| 09 | `shift()` 只認得「第幾格」 | 錄製中斷的 22 分鐘空白讓「往後一秒」跨了二十幾分鐘 |
| 21 | 搜尋空間展開沒改特徵名 | 改 `period` 就改了 `ema_12` → `ema_8`，而條件引用的是名字；Day 17 的特徵對帳會在組裝時攔下來 |
| 23 | 抖動寫成「乘上 1 ± 0.25」 | 號稱上限 4 秒，實測最大 4.998 秒 |
| 23 | ccxt 的 `RequestTimeout` 繼承 `NetworkError` | 「逾時」被歸成可重試 → 重複下單 |
| 24 | 比較報告假設各列交易筆數相同 | 凱利對負期望策略給 0，那一列是 0 筆而不是 232 筆 |
| 26 | `pd.Timedelta.value` 一律回奈秒 | 索引是微秒，於是五天的視窗變成五千天 |
| 26 | 浮點運算順序 | 13,848 根裡 90 根差 2.29e-16 |
| 28 | `blocking_leaves()` 沒處理取反 | 「被否決的原因」印出一個空字串 |
| 29 | ccxt 的 `InvalidNonce` 也繼承 `NetworkError` | 時鐘漂了被歸成可重試，於是在整段漂移期間不停重試 |

第 10 與第 15 條是同一個形狀的錯誤在同一個檔案裡出現兩次。**繼承階層跟語意階層
不一致**是 SDK 的常態，而處理方式是把每一個要用到的例外型別都單獨查一次。

## 積木庫的故事怎麼收

第三階段的核心產出不是三個策略，是**一套能表達策略的語言**：

```yaml
# quantbot/infrastructure/configuration/strategies/trend_ema_rsi.yaml
name: trend_ema_rsi
features:
  - {kind: ema, period: 12}
  - {kind: ema, period: 26}
  - {kind: rsi, period: 14}
entry:   {kind: crossover, fast: ema_12, direction: up, slow: ema_26}
exit:    {kind: crossover, fast: ema_12, direction: down, slow: ema_26}
filters:
  kind: not
  of: [{kind: threshold, feature: rsi_14, comparison: above, value: 70}]
```

新策略的成本降到一份設定檔，兩份設定可以交換一半，四種下注方式換一行就換一種。
而語言的價值有一個前提：

**能自由組合，就必須同時有能力判斷組出來的東西是不是垃圾。**

這就是 Day 21 存在的理由，而它不是加分題。積木化讓「多試幾組看看」變得太容易，
所以安全鎖必須跟工具一起交付。那一天的實測數字值得再看一次：44 個組合裡最好的
樣本內夏普是 **−1.266**，而同樣的搜尋跑在**打亂順序的假資料**上，五個 seed 分別
得到 −0.860／+1.186／+1.187／+0.862／−0.311——**五次全部比真實資料好。**

一套沒有這個對照的搜尋工具，會很有效率地產出漂亮的廢話。

## 誠實的成績單

全部是實測，資料是 BTC/USDT **現貨**、2025-01 至 2026-08（同期 BTC 下跌 33.71%）：

| 項目 | 數字 |
|---|---|
| 三份策略設定的總報酬（扣成本） | −63.54%／−2.45%／−42.97% |
| 贏過 BuyAndHold 基準的策略 | 1 / 5（而它自己也是賠的） |
| 掛單簿實測半價差 | 0.00078 bp（原本假設的 0.05% 高估約 6,400 倍） |
| 由賺轉賠的來回成本率 | 均值回歸 0.2117%、動能爆發 0.0048%、趨勢跟隨不存在 |
| 組合搜尋 | 48 種剪枝後 44 種，最佳樣本內夏普 −1.266 |
| 假資料上的同一次搜尋 | 五個 seed 全部比真實資料好 |
| 凱利對兩個策略的答案 | 不要下注（期望值為負，0 筆交易） |
| 滿倉對固定 25% 的破產機率 | 100% 對 0% |
| 特徵管線 | 13 個特徵 × 13,848 根，0.034 秒 |
| 最慢的特徵加速倍數 | 2,237 倍（其中 82.6 倍沒用到編譯器） |
| 830,879 根 1 分鐘 K 線裡的異常 | 0（最大單分鐘跳動 4.290%，門檻 5%） |
| 測試 / 型別 / 依賴方向 | 661 passed、mypy strict 322 檔、3 條契約 |

那個 −63.54% 值得多講一句。它是趨勢跟隨在**滿倉**下的數字，而 Day 19 的理想回測
（沒有手續費與滑價）是 −26.83%。差距的 36.71 個百分點全部是成本——232 筆交易、
總換手 464 倍、付掉 4,499 美元。**這個策略的問題不是判斷錯，是交易太頻繁。**
而那件事在加成本之前完全看不出來。

## 五個下一步，以及各自的前置條件

跳級做這些事的結果是得到一個看起來很進步、實際上沒有根據的系統。所以每一項
都附前置條件。

**1. 把交易迴圈串起來。** 前置條件：無，這是最該先做的一件。所有零件都在
（下單、風控、通知、熔斷、日誌各自可用且測過），缺的是編排——每根 K 線醒來一次，
依序問三個閘門、算訊號、算部位、下單、記日誌。它不該引入任何新的領域概念，
而 `TradingControl.acknowledge_flat()` 與 `MarketCircuitBreaker.record_clean()`
都是留給它呼叫的。

**2. 補上持久化的整合測試。** 前置條件：一個可丟棄的 PostgreSQL。要驗的三件事
很具體：同一段資料寫兩次只有第一次有列數、交易在中途失敗時不留半份資料、
continuous aggregate 的聚合結果跟手算的一致。**這三件事目前沒有任何測試在守**，
而照這個專案的測試策略它們不能用替身驗——把寫入通道換成替身，驗到的只會是
替身自己的行為。

**3. 多交易對與投資組合配置。** 前置條件：第 2 件做完（多交易對會讓寫入量翻幾倍，
冪等在那時候才真的被壓力測到），以及 Day 22 那個相關性矩陣的讀法——兩個相關性
0.9 的策略各下一半資金，風險跟只下一個幾乎一樣，而報表上會顯示「已分散到兩個
策略」。沒有相關性的視角，多交易對只是把同一個賭注下更多次。

**4. 市場狀態偵測與策略切換。** 前置條件：一個能誠實評估「切換規則」本身的方法。
這件事很容易變成 Day 21 那個陷阱的高級版本——「在趨勢市場用趨勢策略、在盤整市場
用均值回歸」在歷史資料上一定好看，**因為市場狀態是事後才分得出來的**。要做它，
得先能在只用當下資訊的前提下判斷狀態，而那本身就是一個要驗證的預測問題。

**5. 從現貨走向合約。** 前置條件：`Decimal` 的帳務路徑要先真的被用過（現在只有
下單數量在用），因為合約的保證金、資金費率、強制平倉都是帳，而 float 做帳會慢慢
對不起來。另外 `PositionDirection.SHORT` 在引擎裡已經一視同仁，但它**從來沒有被
跑過一次**——走到合約時它是第一個要驗的東西。

至於機器學習：它是第 3 與第 4 件的延伸，而它的前置條件是前面兩件。一個沒有
樣本外驗證與相關性視角的模型，只是一個參數更多的挖礦工具。

## 回收 Day 01 的資料來源版圖

Day 01 攤開了五類 provider，並且說了一句「現在還不需要買這個」。30 天之後可以驗證
那句話：**全程只用了免費的交易所原生資料**（`data.binance.vision` 批次檔、
Binance REST 與 WebSocket），加上 CoinGecko 當對照組。零成本。

現在可以談什麼時候值得往外擴，而判準只有一條：**這筆錢買到的資料，會改變
哪一個決策。**

**衍生品資料（CoinGlass 之類）。** 值得的條件是要做資金費率套利，或者想把清算
熱力圖當特徵。前者是一個明確的策略類型，後者是一個明確的特徵——兩個都答得出
「會改變哪個決策」。而它的前置條件是上面第 5 件（現貨的框架先走到合約）。

**機構級 tick 與 L2 歷史（Tardis.dev 之類，月費 $50–900）。** 值得的條件是要
跨多家交易所重建多年份的掛單簿。這個系列碰到的限制很具體：現貨沒有掛單簿的歷史
批次檔，所以 Day 10 的 OBI、Day 13 的流動性擺盪只能在自己錄的那 45 分鐘上驗證。
要把那些特徵放上正式路徑，這筆錢是必要的——但要先確認那些特徵真的有預測力，
而 Day 10 的 `PredictivePowerService` 就是為了先回答這個問題而寫的。

**鏈上資料（Dune／Nansen／Glassnode／DefiLlama）。** 這 30 天沒有一天需要它。
值得的條件是要做 DeFi 相關或 smart money 追蹤的策略，而那是一個不同的題目，
不是現在這個題目的延伸。

## 今日交付物

`quantbot` 的完整專案，以及一份寫完的 README：

```
quantbot/                    322 個 Python 檔案
├── domain/                  九個資料夾：values, entities, indicators, features,
│                            sizing, strategies, services, dto, interfaces
├── application/             17 個用例
├── infrastructure/          binance, coingecko, telegram, persistence,
│                            charting, configuration, reporting
├── entrypoints/             28 個指令（組裝根）
├── docker/                  Dockerfile ＋ 四個服務的 compose
└── tests/                   82 個測試檔案，661 條測試
```

README 裡有三段是刻意寫的：**核心立場**（每一個數字都要能被追溯與驗證）、
**這個專案做不到什麼**（誠實的清單比功能清單有用）、以及上面那五件事。

### 從零跑一遍

```bash
git clone <repo> quantbot && cd quantbot
uv sync
cp .env.example .env          # 只跑研究路徑的話可以不填
docker compose -f docker/docker-compose.yml up -d timescaledb
uv run python -m quantbot.infrastructure.persistence.migrate
uv run python -m quantbot.entrypoints.ingest_pipeline_command
```

然後把四個階段各跑一次：

```bash
# 第二階段：特徵
uv run python -m quantbot.entrypoints.features_command \
    --timeframe 1h --start 2025-01-01 --end 2026-08-01

# 第三階段：回測、搜尋、比較
uv run python -m quantbot.entrypoints.backtest_command \
    --strategy trend_ema_rsi --timeframe 1h --start 2025-01-01 --end 2026-08-01
uv run python -m quantbot.entrypoints.search_command \
    --timeframe 1h --start 2025-01-01 --end 2026-08-01
uv run python -m quantbot.entrypoints.compare_strategies_command \
    --timeframe 1h --start 2025-01-01 --end 2026-08-01

# 第四階段：風控、執行、維運
uv run python -m quantbot.entrypoints.sizing_command \
    --strategy trend_ema_rsi --timeframe 1h \
    --start 2025-01-01 --end 2026-08-01 --max-weight 1.0
uv run python -m quantbot.entrypoints.place_order_command      # 乾跑
uv run python -m quantbot.entrypoints.sanity_command --timeframe 1h
uv run python -m quantbot.entrypoints.journal_command --bars 24
```

### 驗收標準

這 30 天的驗收標準從第一天就沒有換過，而它是四個指令：

```bash
uv run pytest          # 661 passed, 2 skipped
uv run mypy quantbot   # Success（strict，322 檔）
uv run ruff check .    # All checks passed
uv run lint-imports    # 3 contracts kept
```

四項全過，而且每一天的 commit 都獨立驗過——照文章一天一天做會得到同樣的結果。

最後那一條（`lint-imports`）是這四項裡最容易被省略的一個，而它守的東西是
**依賴方向**。少了它，「domain 不認識任何外部技術」只是一句寫在文件裡的話，
而文件跟程式碼會在第三個月漂移。

> 免責聲明：本系列為程式與資料工程的技術分享，所有策略與數字皆為歷史資料上的
> 觀察與教學範例，不構成投資建議。文中的三個策略在真實成本下都不賺錢，這是照實
> 記錄的結果。加密貨幣波動劇烈，實際交易請自行評估風險；實單前一律先用 testnet。

## 最後

這 30 天沒有找到一個賺錢的策略，而那不是這個系列的失敗——那是它最誠實的一個
輸出。一個 30 天寫出賺錢策略的系列，要嘛沒有加成本，要嘛沒有算試驗次數，
要嘛沒有做樣本外驗證。三件事這裡都做了，而做完之後的結論是那三個策略不成立。

真正留下來的是判斷工具：一個能表達策略的語言、一套會告訴我們「純靠運氣能挖到
多好」的搜尋、一份標注試驗次數的報告、一條會在資訊不可靠時停手的執行路徑，
以及一份記得住每一次決策的日誌。

用它找到一個能上線的策略，是這 30 天結束之後的事。

## Reference

- [`data.binance.vision` 的批次檔清單與上傳時程 — Binance Public Data](https://github.com/binance/binance-public-data)
- [多重比較與參數挖礦：試的次數越多，最佳結果的期望值越高 — Wikipedia, Multiple comparisons problem](https://en.wikipedia.org/wiki/Multiple_comparisons_problem)
- [walk-forward 驗證的定義與它跟單次樣本外切分的差別 — Wikipedia, Walk forward optimization](https://en.wikipedia.org/wiki/Walk_forward_optimization)
- [`import-linter` 的 layers 與 forbidden 契約寫法 — import-linter documentation, Contract types](https://import-linter.readthedocs.io/en/stable/contract_types.html)
- [`uv sync --frozen` 要求 lock 檔與 pyproject 一致，不一致就失敗 — uv documentation, Locking and syncing](https://docs.astral.sh/uv/concepts/projects/sync/)
