---
title: "Day 18：換一組積木就換一種風格：均值回歸與動能爆發"
datetime: "2026-10-02"
description: "只有一個策略的時候，任何抽象看起來都夠用。這篇用兩個哲學相反的策略檢驗 Day 16 的切法：均值回歸賭偏離會被拉回來，動能爆發賭剛啟動的會繼續走。它們逼出一個新積木（連續成立 N 根），也讓時間規則第一次真的動作。最後把趨勢的進場配動能的出場，曝險從 48% 掉到 3.46%。"
image: ""
parent: "2026 ithome-鐵人賽: 工程師的量化交易入門：從 K 線到可組合的交易策略引擎 系列"
draft: false
---

## 一個策略證明不了抽象是對的

昨天的結論是「新增策略的成本是一份 YAML」。這句話目前沒有被驗證過——只有一個策略的時候，任何抽象看起來都夠用，因為那個抽象就是照著它長出來的。

所以今天寫兩個策略，而且刻意挑跟趨勢跟隨**哲學相反**的：

| | 趨勢跟隨（昨天） | 均值回歸 | 動能爆發 |
|---|---|---|---|
| 賭什麼 | 已經在動的會繼續動 | 偏離會被拉回來 | 剛啟動的會走一段 |
| 進場時機 | 趨勢確立之後 | 價格離均值太遠時 | 突破 ＋ 爆量的那一根 |
| 訊號密度 | 中等 | 稀疏 | 很稀疏，而且是事件 |
| 最怕什麼 | 趨勢是假的，來回被打 | 回歸沒發生，一路往下 | 突破是假的，馬上被打回來 |

如果同一組積木表達不出這三種，那就是 Day 16 的抽象切錯了，今天要回頭改。

## 交易概念補課：兩種相反的賭

**均值回歸（mean reversion）**假設價格會繞著某個「合理價位」擺動，偏離太遠就會被拉回來。它的績效形狀跟趨勢跟隨正好相反：**勝率高，但賠率低。** 大部分交易是小賺（回歸發生了，賺那一小段），而少數幾筆是大賠——回歸沒有發生，價格繼續往原本的方向走，而那不是偏離，那是新的趨勢。

所以均值回歸的成敗幾乎完全在「認錯」這件事上。趨勢跟隨可以抱著等，均值回歸不行：它的前提一旦錯了，繼續抱著只會虧更多。

**動能爆發（momentum burst）**賭的是另一件事：有些行情啟動時會有明確的跡象（成交量突然放大、站上關鍵價位），而啟動之後會延續一段。它是**事件驅動**的——不是每根 K 線都在問「現在該不該進場」，而是等一個事件發生。

事件驅動有一個統計後果，Day 13 講過而今天要再提一次：**它的樣本數是事件數，不是 K 線數。** 一個月可能只有幾次。樣本少會讓回測的統計意義變薄，這條伏筆 Day 21 收。

還有一個關於這兩者的實務判斷：**趨勢與均值回歸不該同時開。** 它們對同一段行情的判讀相反，同時跑等於用兩筆錢互相對沖，付兩份手續費換一個接近零的部位。要同時擁有兩者，前提是能先判斷「現在的市場適合哪一種」——那個判斷叫**市場狀態（regime）**，而它需要的東西（狀態偵測 ＋ 策略切換）在 Day 30 的演化路徑上，不在這 30 天裡。

## 先寫死：均值回歸的邏輯

照昨天的順序，先講清楚每個判斷在防什麼，再看設定檔。

進場的核心是 Day 11 的偏離度：現價離日內 VWAP 幾個加權標準差。跌破兩個標準差就買——這是最單純的均值回歸。

但單純的版本有一個具體的問題：**一根長下影線就足以觸發。** 那種價格戳一下就回來的走勢，等程式在下一根成交時，便宜已經被收走了。所以進場條件加一個要求：偏離要**連續兩根**都站在門檻外。

出場相反，要寬鬆：回到均價（偏離度 ≥ 0）就走，不等它翻到另一側。均值回歸賺的是那一段回歸，多等的每一根都在承擔「回歸失敗變成趨勢」的風險。

**進場嚴格、出場寬鬆是均值回歸的常態，而它剛好檢驗了 Day 16 的三組條件是不是真的獨立。** 如果進出場共用同一個閾值（跌破 -2 買、漲破 +2 賣），那組條件就是對稱的，不需要三棵樹；一旦不對稱，進場與出場就必須能各自寫。

然後是這個策略最重要的一件事：**回歸沒發生怎麼辦。** 出場條件永遠不會成立，一個 -2 進場的部位可能一路跌到 -8，而程式會忠實地抱著它到資料結束。所以要有一個「認錯」的後備出場。

## 一個新積木：連續成立 N 根

「偏離連續兩根都在門檻外」寫不出來——現有的六種葉條件都只看單一根。

所以要新增，而新增之前要問 Day 16 那個問題：**這是不是該進積木庫？** 判準是「會被第二個策略用到才抽象化」。而動能爆發也需要同一件事（不希望一根暴量就當成趨勢啟動），所以它剛好踩在線上。

```python
# quantbot/domain/strategies/sustained_condition.py
class Sustained(Condition):
    """另一個條件連續成立 N 根才算成立。

    它是第一個**修飾**條件的條件——`AllOf` 與 `Not` 組合的是同一根的判斷，這個看的
    是時間軸上的一段。所以組合運算子那套代數不只有三個運算子：任何「吃一個條件、
    回一個條件」的東西都接得上，因為進出的形狀相同。

    它為什麼值得進積木庫，而不是寫死在某個策略裡：兩個策略都需要它，而且需要的
    理由一樣。均值回歸不希望價格只是短暫戳破偏離門檻就進場（那多半是一根長影線），
    動能爆發不希望一根暴量就當成趨勢。兩者要的都是「這個狀態站得住」。
    Day 16 那條判準是「會被第二個策略用到才抽象化」，這裡剛好踩在線上。

    暖機期是子條件的暖機期再加 bars - 1：要湊滿 N 根才答得出第一個 True。
    """

    def _evaluate(self, table: pd.DataFrame) -> pd.Series:
        """滾動求和等於視窗長度，就是「這 N 根全部成立」。

        用 rolling().sum() 而不是 N 個 shift() 相 AND：後者的寫法要隨 bars 改變
        程式碼結構，而且 N 大的時候會產生 N 份中間結果。min_periods 用預設值
        （等於視窗長度），所以前 N-1 根是 NaN，而 NaN != bars 的結果是 False——
        正好是要的語意，不必另外處理。
        """
        satisfied = self._condition.evaluate(table).astype("float64")
        return satisfied.rolling(self._bars).sum() == float(self._bars)
```

它是這套抽象的一個意外收穫。Day 16 只給了三個運算子（and、or、not），而 `Sustained` 說明那不是全部：**任何「吃一個條件、回一個條件」的東西都接得上**，因為進出的形狀相同。條件的代數不限於布林邏輯，時間軸上的修飾也是它的一部分。

它也順便測到 Day 16 的暖機期推導。`Sustained(Crossover(...), 3)` 的暖機期是 1 + 3 − 1 = 3，而那個數字會一路傳到引擎，決定前幾根一律不持有。

## 均值回歸的設定檔

```yaml
# quantbot/infrastructure/configuration/strategies/mean_reversion_vwap.yaml
name: mean_reversion_vwap

features:
  # Day 11 的偏離度：現價離日內 VWAP 幾個加權標準差
  - kind: vwap_deviation
    mode: session
  # Day 12 的活躍度：用來擋掉冷清時段。z-score 過的值才能跨交易對沿用門檻
  - kind: activity
    measure: trade_count
    baseline: rolling
    window: 168

# 進場嚴格：偏離要夠深，而且**連續兩根**都站在門檻外。
# 只看一根的話，一根長下影線就足以觸發，而那種戳一下就回來的價格
# 通常在下一根就把便宜收走了。
entry:
  kind: sustained
  bars: 2
  of:
    - kind: threshold
      feature: vwap_session_deviation
      comparison: at_most
      value: -2.0

# 出場寬鬆：回到均價就走，不等它翻到另一側。
# 均值回歸賺的是那一段回歸，貪心多等的每一根都在承擔「回歸失敗變成趨勢」的風險。
exit:
  kind: threshold
  feature: vwap_session_deviation
  comparison: at_least
  value: 0.0

# 冷清時段的偏離多半是流動性造成的，不是真的錯價
filters:
  kind: threshold
  feature: activity_trade_count_rolling_168
  comparison: at_least
  value: -0.5

# 這個策略最怕的事：回歸沒有發生，價格繼續往下。
# 出場條件永遠不會成立，所以要有一個「認錯」的後備出場——48 根 1 小時 K 線是兩天。
# 冷卻期擋的是同一波下跌裡一路往下接。
holding:
  maximum_holding_bars: 48
  cooldown_bars: 12
```

`holding` 那一段是 Day 16 留下的契約第一次真的被填起來。當時說明過為什麼那兩條規則不能是條件：特徵表裡沒有「這個部位已經抱了幾根」這一欄，而那個數字取決於哪一根進場，是引擎解出來的結果。今天可以看到它們防的是什麼具體的事：

- **`maximum_holding_bars: 48`** —— 回歸沒發生時的認錯出場。48 根 1 小時 K 線是兩天。
- **`cooldown_bars: 12`** —— 擋掉「同一波下跌裡一路往下接」。少了它，一段連續下跌會在 -2、-3、-4 各進一次，而那三筆說到底是同一個判斷錯三次。

這兩條規則有一個測試專門守著，而那個測試的資料是**特意造出來的最壞情況**：偏離度一路 -3、永遠不回到 0，也就是出場條件永遠不成立。在那段資料上，沒有時間規則的版本只有 1 筆交易、曝險 97% 以上（抱到資料結束），有時間規則的版本變成好幾筆、曝險掉到 48/60。

## 動能爆發的設定檔

```yaml
# quantbot/infrastructure/configuration/strategies/momentum_breakout.yaml
name: momentum_breakout

features:
  # Day 13 的突破：這一根有沒有站上過去 20 根的最高價
  - kind: breakout
    side: high
    window: 20
  # Day 12 的活躍度：突破要有量才算數
  - kind: activity
    measure: trade_count
    baseline: rolling
    window: 168
  - kind: activity
    measure: absolute_return
    baseline: rolling
    window: 168

# 進場嚴格：突破 ＋ 成交熱度高於基準一個標準差以上。
# Day 13 量過在這個定義下 90.78% 的突破會被打回來，所以突破本身遠遠不夠當進場理由。
entry:
  kind: all
  of:
    - kind: event
      feature: breakout_high_20
    - kind: threshold
      feature: activity_trade_count_rolling_168
      comparison: at_least
      value: 1.0

# 出場：熱度退回基準以下就走。動能策略的前提是「還在動」，
# 不動了就沒有理由繼續持有——這跟趨勢策略等反向訊號是不同的判斷。
exit:
  kind: threshold
  feature: activity_trade_count_rolling_168
  comparison: at_most
  value: 0.0

# 波動已經極端放大時不追。爆量配上極端的單根報酬，多半是消息面的一次性跳動，
# 那種價位進場等於替別人接最後一段。
filters:
  kind: threshold
  feature: activity_absolute_return_rolling_168
  comparison: at_most
  value: 3.0

# 動能是短命的。24 根（一天）等不到熱度退場就自己走。
holding:
  maximum_holding_bars: 24
  cooldown_bars: 6
```

這個策略的出場條件值得看一下，因為它跟另外兩個都不一樣。趨勢策略等反向訊號、均值回歸等回到均價，而動能策略等的是「熱度退了」——它的前提是「還在動」，前提消失就沒有理由繼續持有，即使價格還在漲。

### 沒有用上的兩個特徵，以及為什麼

原本的規劃裡，均值回歸要配 OBI（掛單簿顯示反向壓力），動能爆發要配流動性擺盪（分辨突破是真的還是撤單造成的）。兩個都沒有用上，理由是資料而不是設計。

Day 09 查證過：`data.binance.vision` 的**現貨**只有 `klines`、`aggTrades`、`trades` 三個資料集，**沒有任何掛單簿的批次檔**（`bookTicker` 與 `bookDepth` 只有永續那邊有，而現貨與永續 NEVER 混用）。所以掛單簿只有自己從 WebSocket 錄下來的那 45 分鐘。

一個依賴掛單簿的策略，在 19 個月的歷史上有 45 分鐘的資料可用。那不是「樣本少」，那是「回測不了」。

這件事在 Day 10 就有伏筆：OBI 的頭尾組差 0.37 bp，而來回手續費是 20 bp——它比交易成本小 54 倍，本來就不足以單獨當進場依據。今天的結論一致但理由更硬：**它連被回測的機會都沒有。** Day 10 到 Day 14 做的五個特徵，有兩個進不了這一階段，而這是誠實的結果，不是失敗。它們的用途在即時路徑（Day 23 之後），那裡的資料是當下錄到的，不需要歷史。

## 實測：三個策略並排

```bash
uv run python -m quantbot.entrypoints.signals_command \
    --strategy mean_reversion_vwap --timeframe 1h \
    --start 2025-01-01 --end 2026-08-01
```

BTC/USDT **現貨** 1 小時 K 線，2025-01 至 2026-08，資料來自 Day 07 的 TimescaleDB：

| 策略 | K 線 | 進場訊號 | 被否決 | 交易筆數 | 曝險 |
|---|---|---|---|---|---|
| 趨勢跟隨 | 13,823 | 240 | 8 | 232 | 48.42% |
| 均值回歸 | 13,679 | 58 | 15 | 28 | 1.35% |
| 動能爆發 | 13,679 | 421 | 95 | 190 | 6.67% |
| BuyAndHold | 13,823 | — | — | 1 | 99.99% |

四個觀察。

**K 線根數不一樣。** 後兩個策略少了 144 根，因為活躍度的暖機期是 168 根（一週），比 EMA 的 26 根長很多。Day 15 的管線切掉的是「所有特徵都有值」之前的那一段，所以宣告一個長視窗特徵的代價是整份資料的開頭都變短。

**均值回歸只有 28 筆交易、曝險 1.35%。** 19 個月只交易 28 次，這個策略幾乎整段時間都在場外。這件事有兩個意思：它對「回歸」的定義（連續兩根跌破兩個標準差）確實很嚴，這是刻意的；但 28 筆是一個統計上非常薄的樣本，而 Day 21 會說明為什麼「用 28 筆交易的回測結果挑策略」在統計上等於自欺。

**58 個進場訊號變成 28 筆交易。** 差的那 30 個裡，15 個被過濾條件否決（冷清時段），其餘的落在已經持有部位或冷卻期內。三個數字都印出來，才看得出哪一個機制吃掉了什麼。

**動能爆發的出場訊號有 8,798 根。** 「活躍度低於基準」在 13,679 根裡佔了六成——那不是訊號，那是常態。這個現象本身沒有問題（出場條件成立與否只在持有部位時才重要），但它提醒一件事：出場條件的成立次數不能拿來判斷它嚴不嚴格。

## 交叉組合：真的可以換一半

這才是積木化要換到的東西。趨勢跟隨的進場條件，配動能爆發的出場條件：

```bash
uv run python -m quantbot.entrypoints.signals_command \
    --strategy trend_ema_rsi --exit-from momentum_breakout \
    --timeframe 1h --start 2025-01-01 --end 2026-08-01
```

```
策略 trend_ema_rsi_entry_x_momentum_breakout_exit（long）
  進場  ema_12 ↑ cross ema_26
  出場  activity_trade_count_rolling_168 <= 0
  過濾  NOT rsi_14 > 70
  持有  最多抱 24 根、出場後冷卻 6 根
  需要特徵  ['activity_trade_count_rolling_168', 'ema_12', 'ema_26', 'rsi_14']
```

| 組合 | 交易筆數 | 曝險 |
|---|---|---|
| 趨勢進場 ＋ 趨勢出場 | 232 | 48.42% |
| 趨勢進場 ＋ 動能出場 | 221 | 3.46% |
| 動能進場 ＋ 動能出場 | 190 | 6.67% |
| 動能進場 ＋ 趨勢出場 | 124 | 35.08% |

**同一個進場條件，換掉出場之後曝險從 48.42% 掉到 3.46%**，交易筆數卻幾乎沒變（232 → 221）。這說明一件事：出場條件決定的是持有時間，而持有時間決定曝險。兩個策略的差別有很大一部分不在「什麼時候買」，在「抱多久」。

反過來也成立：動能的進場條件配趨勢的出場之後，曝險從 6.67% 跳到 35.08%，交易筆數反而少了（190 → 124）——因為每一筆抱得更久，後面的進場訊號落在持有期間內就不算新交易。

實作上，交叉組合是一個值物件的方法：

```python
# quantbot/domain/values/strategy_specification.py
    def with_exit_from(self, donor: StrategySpecification) -> StrategySpecification:
        """自己的進場與過濾，配另一份設定的出場。

        這是積木化真正要換到的東西：兩個獨立寫出來的策略，可以把其中一半換掉而
        不必改任何 Python。如果這件事做不到，那麼「策略是積木」只是一種說法。

        **時間規則跟著出場走。** 最大持有根數是「等不到出場條件時的後備出場」，
        冷卻期是「出場之後多久才准再進」——兩者都是出場側的規則，所以捐出出場
        條件的那一份也把它們一起捐出來。留著自己的會得到一個沒人要的組合：
        新的出場條件配舊的持有上限。

        特徵清單取聯集並去重，因為兩邊的條件都要有東西可讀。去重用 describe()
        的字串當鍵，那是「同一種特徵、同一組參數」的可讀形式。
        """
```

「時間規則跟著出場走」是這裡唯一需要判斷的一件事，而它沒有標準答案。選擇的理由寫在 docstring 裡：那兩條規則本來就是出場側的東西，留著自己的會得到一個沒人要的組合。

特徵清單取聯集這件事也值得指出。合併之後的設定會多算幾欄特徵，而 Day 17 的對帳照樣要通過——新的出場條件要讀的欄位，必須在合併後的清單裡。這條有測試守著，因為它是交叉組合唯一會安靜壞掉的地方。

## 抽象的檢驗結果

回到今天的問題：Day 16 的切法對不對。

**對的部分。** 三個哲學相反的策略都表達得出來，而且引擎一行都沒改。三組條件的角色（進場、出場、過濾）在三個策略上都對得上，沒有出現「這個策略的某個條件不知道該放哪一組」的情況。交叉組合也真的能用。

**需要補的部分。** 缺一個修飾類的條件（連續 N 根），而它不是三個運算子的變體，是另一種東西。這說明 Day 16 那句「條件的代數只有三個運算子」講得太窄了。

**沒有動到的部分。** 時間規則的契約在 Day 16 就訂好，今天填進去時不必改引擎——這是那個「先訂契約」的決定的回報。反過來說，如果今天才發現需要它，那就是所有策略、所有測試、所有結果一起重跑。

還有一個誠實的觀察：三個策略讀的特徵**幾乎不重疊**（測試裡有一條斷言它們的交集是空的）。這是「同一組積木表達不同哲學」的證據，但它也提醒一件事——今天沒有任何一個策略證明過「這些條件組合起來會賺錢」。它們只是三個能跑的組合。

**明天開始才有辦法回答賺不賺錢，而答案可能三個都不賺。** 那樣的結果會照實寫出來。

## 今日交付物

```
quantbot/
├── domain/
│   ├── strategies/sustained_condition.py     今天：連續成立 N 根 ＋ builder
│   └── values/strategy_specification.py      今天加 with_exit_from()
├── infrastructure/configuration/strategies/
│   ├── mean_reversion_vwap.yaml              今天
│   └── momentum_breakout.yaml                今天
├── entrypoints/signals_command.py            今天加 --exit-from
└── tests/domain/strategies/
    ├── test_sustained_condition.py           今天
    └── test_shipped_strategies.py            今天：三份設定 ＋ 交叉組合
```

### 先把資料補到最新

這兩個策略吃的特徵比昨天多，而活躍度需要 168 根暖機期，所以資料要夠長：

```bash
docker compose -f docker/docker-compose.yml up -d
uv sync
uv run python -m quantbot.entrypoints.ingest_pipeline_command
```

補完之後可以先確認特徵都算得出來，再跑訊號：

```bash
uv run python -m quantbot.entrypoints.features_command \
    --symbol BTC/USDT --market spot --timeframe 1h \
    --start 2025-01-01 --end 2026-08-01
```

### 驗收標準

七項全過才算完成：

1. `uv run pytest` 全綠。
2. **三份設定檔都有測試載得起來、組得出來、跑得出部位。** 它們是文件，而跑不起來的文件比沒有文件糟。
3. 連續 N 根的條件要有「一根戳破不算」的測試。這是它存在的唯一理由，少了這個測試等於沒驗到。
4. **時間規則的測試要用「出場條件永遠不成立」的資料。** 在正常資料上，最大持有根數多半不會被觸發，於是測試會在什麼都沒驗到的情況下通過。
5. 交叉組合之後，Day 17 的特徵對帳照樣要過——新的出場條件要讀的欄位必須在合併後的清單裡。
6. 三個策略的 `需要特徵` 那一行要真的不一樣。如果三份設定讀的是同一組特徵，「表達不同哲學」這件事就沒有被驗證。
7. `uv run mypy quantbot` 與 `uv run lint-imports` 全過。

第 4 項是今天最容易騙過自己的一條。

> 免責聲明：本文為程式與資料工程的技術分享，所有數字皆為歷史資料上的觀察與教學範例，不構成投資建議。

## 明天

三個策略都跑得出訊號，但沒有一個數字回答「這些訊號值不值錢」。曝險 48% 與 1.35% 的兩個策略，連比較的基準都還沒有。

明天做回測：把部位序列與價格對起來，算出權益曲線與第一份績效數字。也會講清楚回測能證明什麼（過去有效）跟不能證明什麼（未來有效），以及回測作弊的四種常見形式——其中兩種在積木化之後特別容易發生。

還有一件從 Day 04 欠到現在的事要收：**把引擎的訊號位移關掉，看報酬會離譜到什麼程度。** 那個數字會說明 Day 16 為什麼把 `shift` 收進引擎，而不是信任每個策略作者都記得。

## Reference

- [`rolling` 的 `min_periods` 預設等於視窗長度，所以前 N-1 根是 NaN — pandas documentation, `Series.rolling`](https://pandas.pydata.org/docs/reference/api/pandas.Series.rolling.html)
- [`dataclasses.replace` 產生一份只改幾個欄位的新值 — Python documentation, `dataclasses`](https://docs.python.org/3/library/dataclasses.html#dataclasses.replace)
- [現貨的 public data 只有 klines、trades、aggTrades，掛單簿資料集只在 futures 底下 — Binance Public Data repository](https://github.com/binance/binance-public-data)
- [`dict.setdefault` 用來做「先到先留」的去重 — Python documentation, `dict`](https://docs.python.org/3/library/stdtypes.html#dict.setdefault)
