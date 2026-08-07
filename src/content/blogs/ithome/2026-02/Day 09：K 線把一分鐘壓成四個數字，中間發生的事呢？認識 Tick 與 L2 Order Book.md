---
title: "Day 09：K 線把一分鐘壓成四個數字，中間發生的事呢？認識 Tick 與 L2 Order Book"
datetime: "2026-09-23"
description: "回收 Day 02 的伏筆：同一天裡有兩分鐘的開高低收與成交量幾乎一樣，一分鐘的主動買佔 80.6%，另一分鐘只佔 4.7%。這篇接上逐筆成交與 L2 掛單簿兩條路徑：aggTrades 批次回補（一天 739,547 列）、WebSocket 即時錄製、序號校驗與重取快照，並用重建 K 線跟官方逐欄對帳，九個欄位誤差都在 2.4e-16 以內。"
image: ""
parent: "2026 ithome-鐵人賽: 工程師的量化交易入門：從 K 線到可組合的交易策略引擎 系列"
draft: false
---

## 同一天的兩分鐘，K 線圖上長得幾乎一樣

Day 02 把 K 線拆成五個數字的時候，留了一句話沒展開：**壓縮是有損的**。今天就來說說那個伏筆。

從之前入庫的 BTC/USDT 現貨資料裡挑 2026-07-15 這一天，找兩根 1 分鐘 K 線：

| 開盤時間（UTC） | 開         | 高         | 低         | 收         | 成交量（BTC） | 成交額（USDT） |
|-----------|-----------|-----------|-----------|-----------|----------|-----------|
| 20:39     | 64,997.99 | 65,013.01 | 64,997.55 | 65,011.60 | 12.755   | 829,187   |
| 07:46     | 64,592.64 | 64,592.64 | 64,577.70 | 64,577.70 | 12.883   | 832,009   |

價位不同（一根在 65,000 附近、一根在 64,580 附近），但形狀幾乎可以疊在一起：高低差是 15.46 對 14.94 USDT，成交量差 1%，成交額差 0.3%。一根小陽線、一根小陰線，實體長度差 1.3 USDT。任何一張 K 線圖上，這兩根看起來就是同一種東西。

現在把同樣那兩分鐘的逐筆成交撈出來，問幾個 OHLCV 回答不了的問題：

|             | 20:39      | 07:46      |
|-------------|------------|------------|
| 真實成交筆數      | 581        | 2,426      |
| 主動買佔成交量     | 80.6%      | 4.7%       |
| 出現過幾個不同的成交價 | 133        | 72         |
| 最大單筆        | 2.5445 BTC | 1.1366 BTC |
| 成交價方向變換次數   | 62         | 177        |

第一分鐘是**買方在推**：八成的成交量來自主動買，價格一路被抬到收在高點附近，其中還有一筆 2.54 BTC 的大單。第二分鐘剛好相反，主動買只佔 4.7%，換句話說九成五的量是主動賣砸出來的，而且它砸得很碎：兩千四百多筆、方向來回換了 177 次。

這兩分鐘在市場上是相反的事件。K 線把它們畫成了同一個形狀。

這裡要說得準確一點：官方 K 線的 12 個欄位裡有 `trade_count` 與 `taker_buy_base_volume`，所以「幾筆」和「主動買佔多少」其實在 1 分鐘的粒度上查得到，Day 02 也已經一併存下來了。逐筆資料真正多給的是**順序**與**分布**：那 80.6% 的主動買是一次吃進來的還是分兩千筆慢慢買的、大單出現在這一分鐘的哪個位置、價格是單調往上還是來回震盪。這些東西沒有任何聚合欄位裝得下，因為它們是路徑，不是總和。

今天要做的就是把這條路徑接進 `quantbot`：歷史的逐筆成交怎麼回補，即時的成交與掛單簿怎麼錄，以及最麻煩的那一件——**掛單簿是一個狀態機，維護錯了不會有任何錯誤訊息**。

## 交易概念補課

今天的新名詞比前幾天多，因為往下挖了一層。

### 逐筆成交與 Tick

每一次撮合成功，交易所就產生一筆成交紀錄：什麼時候、什麼價格、多少數量。這種一筆一筆的原始紀錄叫**逐筆成交**，習慣上也叫 **Tick 資料**。

K 線是這些紀錄的 summary statistics（Day 02 用過這個說法）：開盤價是第一筆的價格、收盤價是最後一筆的、最高最低是那一分鐘所有價格的極值、成交量是所有數量的加總。所以 K 線可以從逐筆成交算出來，反過來不行，這是有損壓縮的定義。

### 聚合成交（aggTrades）：一列不等於一筆

Binance 的歷史批次資料有兩種粒度：`trades`（每一筆都是一列）與 `aggTrades`（聚合成交）。

聚合的規則是：**同一張吃單在同一個價格上掃到的連續成交，併成一列。** 一張想買 2 BTC 的市價單可能同時吃掉掛在同一價位的五十張小賣單，那在 `trades` 裡是 50 列，在 `aggTrades` 裡是 1 列，只是那列會帶著「我併了第 100 到第 149 筆」這個資訊。

實測 2026-07-15 這一天的 BTC/USDT 現貨：`aggTrades` 有 739,547 列，展開後是 2,668,919 筆真實成交，平均一列併 3.61 筆，最誇張的一列併了 527 筆。

這個差別會直接影響正確性。「這一分鐘有幾筆成交」如果用列數去數，答案會少掉四分之三。正確的算法是把每一列的 `last_trade_id - first_trade_id + 1` 加起來，所以那兩個識別碼不是冗餘欄位，等一下對帳會用到它們。

本系列用 `aggTrades` 而不是 `trades`：體積小三到四倍，而我們要算的特徵（資金流方向、活躍度、成交量分布）都不需要拆到每一筆。

### 掛單簿、深度、買賣價差

成交是已經發生的事。**掛單簿（order book）**是還沒發生的事：所有掛在市場上等著成交的委託單，依價格排好。

它有兩側。買方（bid）想低買，所以價格從高往低排；賣方（ask）想高賣，價格從低往高排。兩側最接近的那一對（最高的買價與最低的賣價）中間的差距就是**買賣價差（spread）**。

一份掛單簿看起來像這樣（實際錄到的一筆，2026-08-04 16:52:53 UTC）：

```
        價格          掛量（BTC）
賣方    63,922.67       0.0424      ← 最低賣價
買方    63,922.66       2.6103      ← 最高買價
        ...
```

價差是 0.01 USDT。這不是巧合，那是 BTC/USDT 現貨的最小報價單位（tick size），也就是價差已經窄到不能再窄。實測那 227 筆錄製樣本裡，價差**每一筆都是 0.01**，這是流動性極好的市場才有的樣子，等一下講對照組限制時還會用到這件事。

**深度（depth）**指的是「往下看幾檔」。只看最好的一檔是「一檔深度」，把前 20 檔的掛量加起來是「20 檔深度」。深度回答的是「要吃掉多少量才會把價格推動多少」，它跟價差一起描述了流動性。

「L2」是這種資料的慣用名稱：L1 只有最好的買賣價，L2 有逐檔的價格與總掛量，L3 還會拆到每一張單子是誰掛的。交易所公開的是 L2。

### taker 與 maker

每筆成交都有買方與賣方，所以問「這筆是買還是賣」沒有意義。有意義的問題是**誰是主動的那一方**。

掛單在簿子上等的人叫 **maker**（他提供流動性），衝過來直接吃掉掛單的人叫 **taker**（他消耗流動性）。價格會動是因為 taker 吃穿了某一側的掛單，所以 taker 的方向才是「資金流」的方向。

官方資料給的欄位是 `is_buyer_maker`：買方是 maker 的話，主動的是賣方。這個反轉只寫一次就好，寫反了不會報錯，只會讓後面每個資金流特徵的正負號整批顛倒。所以它在程式碼裡是一個有名字的轉換：

```python
# quantbot/domain/values/taker_side.py
from __future__ import annotations

from enum import StrEnum


class TakerSide(StrEnum):
    """這筆成交是被誰吃掉的：主動買進，還是主動賣出。

    每一筆成交都同時有買方與賣方，所以「這筆是買還是賣」本身不是問題——
    有意義的問題是**誰是主動的那一方**。掛在簿子上等的是 maker，
    衝過來成交的是 taker，而 taker 的方向才是資金流的方向。

    官方資料給的是 is_buyer_maker：買方掛單的話，主動的是賣方。
    這個轉換只寫在 from_buyer_is_maker() 一份，NEVER 在呼叫端手動反轉——
    寫反了不會報錯，只會讓後面每個資金流特徵的正負號整批顛倒。
    """

    BUY = "buy"
    SELL = "sell"

    @classmethod
    def from_buyer_is_maker(cls, buyer_is_maker: bool) -> TakerSide:
        return cls.SELL if buyer_is_maker else cls.BUY
```

## 資料來源：兩條路徑，以及一個要先說明的限制

Day 03 的原則今天要再用一次：**歷史批次與即時串流是兩條路徑，分開設計。** 只是這一層的兩條路徑不對稱得多。

### 歷史成交走批次，跟 Day 03 同一條路

`data.binance.vision` 有 `aggTrades` 的日檔與月檔，URL 規則跟 K 線那條幾乎一樣，只是路徑裡沒有 timeframe，因為成交是事件，不是被切好的區間。

有一個刻意的差別：**這條路只用日檔。**

|      | K 線（Day 03） | aggTrades（今天） |
|------|-------------|---------------|
| 月檔大小 | 幾十 KB       | 498 MB        |
| 日檔大小 | 幾 KB        | 11.2 MB       |
| 解壓後  | —           | 64.0 MB／天     |
| 一天幾列 | 1,440（1m）   | 739,547       |

K 線那邊優先抓月檔是對的，少 30 個請求就是省。`aggTrades` 完全相反：一個月的 zip 接近 500 MB，而實際要分析的通常是幾天。用日檔換到的是「想要幾天就下幾天」、快取有意義、中斷重跑的代價是一天而不是一個月。

所以那個類別**沒有** `monthly_agg_trades()` 這個方法，而這是設計決定，不是還沒寫：

```python
# quantbot/infrastructure/binance/binance_archive_url_builder.py（Day 03 的類別，今天加一個方法）
    def daily_agg_trades(self, listing: Listing, day: date) -> str:
        """逐筆成交只有日檔這條路。

        月檔存在，但 BTC/USDT 現貨一個月的 aggTrades zip 接近 500 MB，而要分析的
        通常是幾天，所以這裡不提供 monthly_agg_trades()——**沒有這個方法本身就是
        設計決定**，不是還沒寫。要一個月的話就下三十個日檔，併發下載本來就有。

        網址裡沒有 timeframe：成交是事件，不是被切好的區間，所以它吃 Listing。
        """
        prefix = self.MARKET_PREFIXES[listing.market]
        symbol = listing.native_symbol
        filename = f"{symbol}-aggTrades-{day:%Y-%m-%d}.zip"
        return f"{self.BASE_URL}/{prefix}/daily/aggTrades/{symbol}/{filename}"
```

### 時間戳的單位在 2025-01-01 從毫秒變成微秒

這件事值得單獨一節，因為它是那種「寫死一個常數、兩年後才爆」的問題。

Day 02 寫 `CandleColumns.to_utc()` 的時候，用數量級判斷 epoch 的單位而不是寫死 `unit="ms"`，當時的理由是「格式再改一次也不用改判斷邏輯」。這個決定在今天兌現了。實測同一個資料集不同日期的第一列，看時間戳欄位有幾位數：

| 日期         | 第一列的時間戳          | 位數 | 單位 |
|------------|------------------|----|----|
| 2024-09-15 | —                | 13 | 毫秒 |
| 2024-12-31 | 1735603200213    | 13 | 毫秒 |
| 2025-01-01 | 1735689600010866 | 16 | 微秒 |
| 2026-07-15 | 1784073600013019 | 16 | 微秒 |

分界線正好落在 2025-01-01。也就是說，任何寫死 `unit="ms"` 的程式，回補 2025 年之後的資料時會把時間算成 1970 年附近的某個時刻，而 pandas 不會抱怨，它會給一張時間全錯、其他欄位全對的表。反過來寫死 `unit="us"`，2024 年的資料會落到 1970 年那一側。**沒有哪一個常數是對的**，這是寫死單位這件事的根本問題。

用數量級判斷就不必知道哪一年換的，也不必為新舊檔案各寫一條分支。所以 `TradeColumns` 直接借那一份，不再寫第二張對照表：

```python
# quantbot/domain/values/trade_columns.py
    @staticmethod
    def to_utc(epochs: pd.Series) -> pd.Series:
        """epoch 整數轉 UTC 時間。

        這裡直接借 CandleColumns 的單位判斷，因為官方 aggTrades 的時間戳在近年的
        檔案裡是**微秒**，而 K 線一直是毫秒。寫死 unit="ms" 的話時間會落到 1970 年
        附近，而且不會有任何錯誤訊息。用數量級判斷就不必知道哪一年換的。
        """
        return CandleColumns.to_utc(epochs)
```

### 現貨的掛單簿歷史，免費資料源裡沒有

這是今天最需要講清楚的一件事，而它跟系列一開始的規劃不一樣，所以直接把查證結果攤開。

列一次 `data.binance.vision` 上現貨與永續各有哪些資料集：

| 市場                   | 有哪些批次資料                                                                         |
|----------------------|---------------------------------------------------------------------------------|
| 現貨（`spot`）           | `klines`、`aggTrades`、`trades`                                                   |
| U 本位永續（`futures/um`） | `klines`、`aggTrades`、`trades`、`bookDepth`、`bookTicker`、`metrics`、`fundingRate`… |

**現貨沒有任何掛單簿資料。** 掛單簿的批次檔（`bookDepth` 逐檔深度、`bookTicker` 最佳買賣價）只有永續合約那邊有。

而 Day 01 訂的原則第三條是：現貨資料 NEVER 拿去回測永續策略，反之亦然。兩者的價格、成交量、費用結構都不同。所以「拿永續的 `bookDepth` 當現貨掛單簿的替代品」這條路是關著的——不是麻煩，是不正確。

剩下的選項只有三個，連代價一起列：

1. **自己從現在開始錄。** 零成本，但沒有過去。今天開始錄，一個月後才有一個月的資料。
2. **買。** Tardis.dev 這類機構級 tick 服務有完整的歷史 L2，月費在 $50–900 這個區間（Day 01 提過）。本系列全程零成本，所以不走這條。
3. **改用永續合約當主市場。** 那是另一個系列的選擇，會影響第三、四階段的每一個假設。

本系列走第一條。這決定了後面幾天的形狀：**Day 10 的掛單簿特徵只能算在我們自己錄下來的那段資料上，而 Day 11 到 Day 14 的特徵都建在成交資料上**，後者有完整歷史，回測時間夠長。這不是把 Day 10 降級，而是把它的適用範圍講清楚：它是一個要靠即時資料才用得起來的特徵，這件事本身就是它的性質之一。

順帶把 Day 01 的另一條原則也交代掉：**每個主來源都要有對照組。** 這一層是全系列唯一的例外：外面沒有免費的第二個 tick 來源可以比。但它不是沒有把關，只是把關的形狀不同：逐筆成交聚合起來**必須**等於官方的 K 線，而那份 K 線 Day 03 就有辦法拿到。這道對帳等一下會做，而且它一次擔保五件事。

## 工程實作

### 先解決身分問題：成交沒有 timeframe

Day 02 訂的 `Instrument` 是「symbol ＋ market ＋ timeframe」。逐筆成交跟掛單簿沒有 timeframe，硬塞一個進去，「這段 tick 是 1m 的」這種沒有意義的句子就變成合法的程式碼。

所以多一個值，描述「哪一個交易對在哪個市場」這半件事：

```python
# quantbot/domain/values/listing.py
from __future__ import annotations

from dataclasses import dataclass

from quantbot.domain.values.instrument import Instrument
from quantbot.domain.values.market import Market


@dataclass(frozen=True)
class Listing:
    """一個交易對在某個市場上的掛牌：symbol ＋ market，沒有粒度。

    逐筆成交與掛單簿沒有 timeframe——它們是事件，不是被切好的區間。所以它們的
    身分不能用 Instrument 表示，硬塞一個 timeframe 進去只會讓「這段 tick 是 1m
    的」這種沒有意義的句子變成合法的程式碼。

    Instrument 因此可以看成 Listing ＋ timeframe，用 Listing.of() 取得那一半。
    """

    symbol: str  # ccxt 寫法，帶斜線：BTC/USDT
    market: Market

    @classmethod
    def of(cls, instrument: Instrument) -> Listing:
        """從 Instrument 取出不含粒度的那一半。"""
        return cls(symbol=instrument.symbol, market=instrument.market)

    @property
    def native_symbol(self) -> str:
        """交易所原生寫法，沒有斜線：BTCUSDT。"""
        return self.symbol.replace("/", "").upper()

    @property
    def storage_key(self) -> str:
        """落地檔名與報告標題的前綴，例如 spot_BTCUSDT。"""
        return f"{self.market}_{self.native_symbol}"
```

`Listing.of()` 這個方向是刻意的：新的值認識舊的值，舊的值不必改一個字。Day 02 的 `Instrument` 到今天為止一個字都沒動過，這是它當時把「網址規則不放這裡」那個決定做對的回報。

### 欄位語彙：兩個識別碼不是冗餘

`TradeColumns` 是 `CandleColumns` 的對應物，但有兩處關鍵差異：

```python
# quantbot/domain/values/trade_columns.py
class TradeColumns:
    """逐筆成交的欄位語彙。CandleColumns 的對應物，只是這裡的一列是一個事件。

    K 線的索引是開盤時間、一根一格；成交的索引是**成交時間**，同一個毫秒裡可以有
    幾十列，所以它 NEVER 是唯一鍵。唯一鍵是 trade_id，去重要看它。

    first_trade_id 與 last_trade_id 不是冗餘欄位。官方的 aggTrades 把「同一張吃單
    在同一個價格上掃到的多筆成交」併成一列，所以一列不等於一筆成交；真正的成交
    筆數是 last - first + 1。少了這兩欄，就沒辦法拿重建出來的 K 線跟官方的
    trade_count 對數字，也偵測不出中間漏了哪幾筆。
    """

    TRANSACT_TIME: ClassVar[str] = "transact_time"
    TRADE_ID: ClassVar[str] = "trade_id"
    FIRST_TRADE_ID: ClassVar[str] = "first_trade_id"
    LAST_TRADE_ID: ClassVar[str] = "last_trade_id"
    INTEGER_COLUMNS: ClassVar[tuple[str, ...]] = (
        TRADE_ID,
        FIRST_TRADE_ID,
        LAST_TRADE_ID,
    )
    PRICE: ClassVar[str] = "price"
    QUANTITY: ClassVar[str] = "quantity"
    BUYER_IS_MAKER: ClassVar[str] = "buyer_is_maker"
    FLOAT_COLUMNS: ClassVar[tuple[str, ...]] = (PRICE, QUANTITY)
    BOOLEAN_COLUMNS: ClassVar[tuple[str, ...]] = (BUYER_IS_MAKER,)

    @classmethod
    def all_columns(cls) -> tuple[str, ...]:
        """落地後的欄位與順序。每條來源都要對齊到這一份。"""
        return cls.INTEGER_COLUMNS + cls.FLOAT_COLUMNS + cls.BOOLEAN_COLUMNS

    @classmethod
    def conform(cls, trades: pd.DataFrame) -> pd.DataFrame:
        """轉型並補齊欄位，讓批次檔與即時串流產出同一種表。

        整數欄用 int64 而不是可空的 Int64：識別碼缺值的成交不存在，允許 NA 只會
        讓「去重」與「找斷號」這兩件事各多一種要考慮的狀態。
        """
        conformed = pd.DataFrame(index=trades.index)
        for column in cls.INTEGER_COLUMNS:
            conformed[column] = trades[column].astype("int64")
        for column in cls.FLOAT_COLUMNS:
            conformed[column] = trades[column].astype("float64")
        for column in cls.BOOLEAN_COLUMNS:
            conformed[column] = trades[column].astype("bool")
        return conformed
```

「索引不是唯一鍵」這件事在真實資料上很極端：實測那一天，`aggTrades` 每分鐘的列數中位數是 368，最忙的一分鐘有 5,217 列。同一個時間戳有幾十列是常態，所以 `CandleSeries` 那套「用索引去重」的做法在這裡是錯的。

### TradeSeries：去重看 trade_id，斷號要查得出來

```python
# quantbot/domain/entities/trade_series.py
class TradeSeries:
    """一段逐筆成交，以及它自己知道怎麼做的那些事。

    跟 CandleSeries 最大的差別是**去重看的不是索引**：同一個時間戳可以有很多筆
    成交，所以重跑批次或串流重連之後，要靠 trade_id 判斷哪些是同一筆。
    這條規則寫錯的症狀很難看出來——成交量會多算，而價格看起來完全正常。
    """

    def merge(self, other: TradeSeries) -> TradeSeries:
        """併入另一段，**以 trade_id 去重**，重疊時以 self 為準。

        跟 CandleSeries.merge 一樣先去重再排序：sort_index() 是不穩定排序，
        排完再去重的話留下來的是哪一列會變成隨機的。
        """
        if other.listing != self.listing:
            raise ValueError(
                f"不同的 listing 不可合併：{self.listing} / {other.listing}"
            )
        combined = pd.concat([self._trades, other.frame])
        deduplicated = combined[
            ~combined[TradeColumns.TRADE_ID].duplicated(keep="first")
        ]
        return TradeSeries(self.listing, deduplicated)

    def missing_trade_id_count(self) -> int:
        """有幾筆成交沒被涵蓋到。

        aggTrades 的 first/last trade id 應該首尾相接：前一列的 last + 1 等於
        這一列的 first。斷號代表這段資料不完整，而它 NEVER 以缺列的形式表現——
        表看起來是連續的，只是中間少了幾筆成交。
        """
        if len(self._trades) < 2:
            return 0
        first = self._trades[TradeColumns.FIRST_TRADE_ID]
        last = self._trades[TradeColumns.LAST_TRADE_ID]
        breaks = first.to_numpy()[1:] - last.to_numpy()[:-1] - 1
        return int(breaks[breaks > 0].sum())
```

`missing_trade_id_count()` 值得停一下。Day 08 的缺漏偵測靠的是「預期的時間序列跟實際的做 diff」：K 線每一根都該存在，少一根就是一個洞。逐筆成交沒有這種預期：市場冷清的時候一分鐘真的只有 55 列，那不是缺漏。

所以這一層的完整性要靠識別碼的連續性來驗。前一列涵蓋到第 19 筆、這一列從第 31 筆開始，中間那 11 筆就是掉了，而表上完全看不出來，列與列之間的時間戳照樣是遞增的。

### 從逐筆成交重建 K 線：這一層的對照組

這是今天最重要的一段程式碼，因為它是這條資料路徑上唯一的正確性把關。

```python
# quantbot/domain/entities/trade_series.py
    def aggregate_to_candles(self, timeframe: Timeframe) -> CandleSeries:
        """把逐筆成交聚合回 K 線。

        這不是為了省下載——官方的 K 線就在那裡。它的用途是**對帳**：拿重建出來的
        K 線跟官方的逐欄比對，如果九個欄位全對得上，就同時證明了欄位對映、時間戳
        單位、時區、聚合邊界、taker 方向這五件事都沒錯。這是這層資料唯一拿得到的
        對照組，因為外面沒有免費的第二個 tick 來源。

        trade_count 用 last - first + 1 加總而不是列數：aggTrades 的一列是被併過的。
        """
        trades = self._trades
        quote_amount = trades[TradeColumns.PRICE] * trades[TradeColumns.QUANTITY]
        taker_buy = ~trades[TradeColumns.BUYER_IS_MAKER]

        working = pd.DataFrame(
            {
                "price": trades[TradeColumns.PRICE],
                "quantity": trades[TradeColumns.QUANTITY],
                "quote_amount": quote_amount,
                "taker_buy_base": trades[TradeColumns.QUANTITY].where(taker_buy, 0.0),
                "taker_buy_quote": quote_amount.where(taker_buy, 0.0),
                "trade_count": (
                    trades[TradeColumns.LAST_TRADE_ID]
                    - trades[TradeColumns.FIRST_TRADE_ID]
                    + 1
                ),
            },
            index=trades.index,
        )
        aggregated = working.resample(
            timeframe.pandas_frequency, label="left", closed="left"
        ).agg(
            open=("price", "first"),
            high=("price", "max"),
            low=("price", "min"),
            close=("price", "last"),
            volume=("quantity", "sum"),
            quote_volume=("quote_amount", "sum"),
            taker_buy_base_volume=("taker_buy_base", "sum"),
            taker_buy_quote_volume=("taker_buy_quote", "sum"),
            trade_count=("trade_count", "sum"),
        )
        aggregated.index.name = CandleColumns.OPEN_TIME
        instrument = Instrument(
            symbol=self.listing.symbol,
            market=self.listing.market,
            timeframe=timeframe,
        )
        # 沒有任何成交的那幾格 open 是 NaN。官方 K 線在完全沒成交時也不出這一根，
        # 所以丟掉它才對得起來——補一根「開高低收都等於前收」的假 K 線是捏造資料。
        return CandleSeries(instrument, aggregated.dropna(subset=["open"]))
```

`label="left", closed="left"` 跟 Day 02 的 `CandleSeries.resample` 一致：索引存的是開盤時間，區間右端開。這兩個參數只要有一個寫反，整段資料會往前或往後位移一格，而位移之後的 K 線圖看起來完全正常。

比較的部分是一個 domain service。它跟 Day 03 的 `PriceCrossCheckService` 分開，因為容忍度的量級完全不同：

```python
# quantbot/domain/services/candle_agreement_service.py
class CandleAgreementService:
    """比對兩份 K 線是否逐欄一致。

    Day 03 的 PriceCrossCheckService 比的是「我們跟外部參考價的量級對不對」，
    容忍度是 1%，因為那是兩個不同市場的價格。這裡不一樣：兩邊都是同一個交易所的
    同一段成交，只是一邊是官方聚合好的、一邊是我們自己從逐筆成交重建的。它們應該
    **幾乎完全相等**，所以容忍度是浮點誤差的量級。

    這是逐筆成交這層資料唯一拿得到的對照組——外面沒有免費的第二個 tick 來源。
    它一次擔保五件事：欄位對映、時間戳單位、時區、聚合邊界、taker 方向。
    """

    def __init__(self, *, tolerance: float = 1e-6) -> None:
        self._tolerance = tolerance

    def compare(
        self, rebuilt: CandleSeries, official: CandleSeries
    ) -> CandleAgreementReportDto:
        shared = rebuilt.open_times.intersection(official.open_times)
        ours = rebuilt.frame.loc[shared]
        theirs = official.frame.loc[shared]

        return CandleAgreementReportDto(
            compared_bar_count=len(shared),
            missing_in_rebuilt=len(official.open_times.difference(rebuilt.open_times)),
            missing_in_official=len(rebuilt.open_times.difference(official.open_times)),
            maximum_relative_difference={
                column: self._maximum_relative_difference(ours[column], theirs[column])
                for column in CandleColumns.all_columns()
                if column in ours and column in theirs
            },
            tolerance=self._tolerance,
        )

    @staticmethod
    def _maximum_relative_difference(ours: pd.Series, theirs: pd.Series) -> float:
        """相對誤差的最大值。分母為 0 的那幾格改看絕對差。

        成交量那幾欄在冷清的一分鐘裡真的會是 0，用相對誤差會變成 0/0；
        把那幾格換成絕對差，才不會讓一個合法的 0 產生 NaN 或 inf。
        """
        difference = (ours.astype("float64") - theirs.astype("float64")).abs()
        scale = theirs.astype("float64").abs()
        relative = difference.where(scale == 0.0, difference / scale)
        return 0.0 if relative.empty else float(relative.max())
```

報告的 DTO 只留每欄的最大誤差，不留整張比對表。這是刻意的：報告要能印在終端機上被看完，而真的要逐根追的話重跑一次比對就有了。它另外提供一個 `worst_column`：

```python
# quantbot/domain/dto/candle_agreement_report.py
    @property
    def worst_column(self) -> str:
        """誤差最大的那一欄。欄位對映錯一格的話，錯的那一欄會遠遠突出。"""
        if not self.maximum_relative_difference:
            return ""
        return max(
            self.maximum_relative_difference,
            key=lambda column: self.maximum_relative_difference[column],
        )

    @property
    def passed(self) -> bool:
        return (
            self.compared_bar_count > 0
            and self.missing_in_rebuilt == 0
            and self.missing_in_official == 0
            and all(
                difference <= self.tolerance
                for difference in self.maximum_relative_difference.values()
            )
        )
```

`compared_bar_count > 0` 那一條是防一種很具體的假通過：兩邊的時間完全對不上時，交集是空的、所有誤差都是 0，看起來完美。沒有這一條的話，一個時區寫錯的版本會拿到滿分。

### 掛單簿：全系列第一個有狀態的東西

到今天為止，`quantbot` 裡每個東西都是「一段資料進來、一個結果出去」。掛單簿不是。它是狀態機：現在的樣子取決於初始快照，以及之後每一筆增量更新是否都正確套用過。

維護它的規則只有三條，但每一條寫錯都不會有錯誤訊息：

1. 先拿一份**快照**（REST），它帶著一個序號 `lastUpdateId`。
2. 收到的**增量更新**帶著一個序號區間 `[U, u]`，只有序號接得上的才能套用。
3. 掛量為 0 代表「這一檔被清空了」，要從簿子上**移除**，不是留一個掛 0 的價位。

第三條是最容易被忽略的。留一個掛 0 的價位，深度加總不會變（值是 0），但它會佔掉一個「前 N 檔」的位置，讓 20 檔深度實際上只涵蓋 19 檔真實掛單。這種錯誤的症狀是「掛單不對稱這個特徵有點怪但說不上哪裡怪」。

```python
# quantbot/domain/entities/order_book.py
class OrderBook:
    """本地維護的一份掛單簿。全系列唯一一個**有狀態**的 entity。

    前面所有東西都是「一段資料進來、一個結果出去」。掛單簿不是：它是一個狀態機，
    現在的樣子取決於初始快照與之後每一筆增量更新是否都正確套用過。這個差別決定了
    它的測試方式——要驗的不是某次計算的輸出，而是**一連串操作之後的狀態**。

    兩側各用一個 dict（價格 → 掛量）。這裡刻意不是 DataFrame：增量更新一次只動
    十幾檔，每一筆都重建一張表的話，一分鐘幾千筆更新會直接跟不上。全系列「NEVER
    用 for loop」針對的是遍歷幾十萬根 K 線，不是遍歷一筆更新裡的十幾檔掛單。
    """

    def apply(self, update: OrderBookUpdate) -> None:
        """套用一筆增量更新。

        呼叫端 MUST 先問過 OrderBookSequenceService 這筆該不該套——這個方法
        NEVER 自己檢查序號。理由是「該不該套」是規則、屬於 domain service，
        「怎麼套」是狀態轉移、屬於這個 entity；混在一起的話，兩者都測不乾淨。
        """
        self._apply_side(self._bids, update.bid_changes)
        self._apply_side(self._asks, update.ask_changes)
        self._last_update_id = update.final_update_id

    @staticmethod
    def _apply_side(side: dict[float, float], changes: tuple[PriceLevel, ...]) -> None:
        """掛量 0 是「這一檔清空了」，要移除而不是留一個掛 0 的價位。

        留著的話它會被算進深度加總的分母（值是 0，不影響加總），但會佔掉一個
        「前 N 檔」的位置，讓 N 檔實際上只涵蓋 N-1 檔真實掛單。
        """
        for level in changes:
            if level.is_removal:
                side.pop(level.price, None)
            else:
                side[level.price] = level.quantity
```

「NEVER 用 for loop 遍歷 K 線」這條規矩針對的是**資料量級**：幾十萬列的向量化運算跟逐列迴圈差三個數量級。一筆增量更新裡有十幾檔掛單變動，而每 100 毫秒來一筆，用 DataFrame 表示的話每一筆都要重建一張表，那才是真的跟不上。判準不是「有沒有 for」，是「這個迴圈跑幾次、有沒有向量化的替代品」。

摘要那一段的反向排序也值得看一眼，因為它是另一個「錯了很難發現」的地方：

```python
# quantbot/domain/entities/order_book.py
    def summarize(self, captured_at: pd.Timestamp) -> OrderBookDepthSummary:
        """壓成落地得起的幾個數字。深度清單由 DepthColumns 決定，不是參數。

        買方要價格最高的前 N 檔，賣方要價格最低的前 N 檔——兩邊的「前面」
        是反方向的。這個反向排序寫錯的症狀是掛單不對稱的正負號整批顛倒，
        而數值範圍看起來完全正常。
        """
        descending_bids = sorted(self._bids.items(), reverse=True)
        ascending_asks = sorted(self._asks.items())

        return OrderBookDepthSummary(
            captured_at=captured_at,
            best_bid_price=self.best_bid_price,
            best_ask_price=self.best_ask_price,
            depth_quantities=tuple(
                DepthQuantity(
                    level=level,
                    bid_quantity=sum(
                        quantity for _, quantity in descending_bids[:level]
                    ),
                    ask_quantity=sum(
                        quantity for _, quantity in ascending_asks[:level]
                    ),
                )
                for level in DepthColumns.LEVELS
            ),
        )
```

### 序號校驗：一張表就測得完的規則

序號規則有兩段，分別對應「剛接上」與「已經在跑」。它們是純規則：不碰網路、不碰狀態、只吃兩個數字與一筆更新，回傳一個決定。所以它是 domain service，而且可以用一張表把所有情況列完：

```python
# quantbot/domain/services/order_book_sequence_service.py
class OrderBookSequenceService:
    """判斷一筆增量更新該套用、該丟掉，還是該重新拉快照。

    這是整個即時資料路徑最容易寫錯、而且錯了最難察覺的一段規則，所以它獨立成一個
    domain service：不碰網路、不碰狀態、只吃兩個數字與一筆更新，回傳一個決定。
    它因此可以用一張表把所有情況列完並測完，不需要開任何連線。

    規則有兩段，分別對應「剛接上」與「已經在跑」兩種處境：

    - 第一筆（still_synchronizing 為真）：更新的區間必須**跨過**快照的序號，
      也就是 first <= snapshot + 1 <= final。跨不過的話有兩種可能——整個區間都在
      快照之前（內容已經包含在快照裡，丟掉），或整個區間都在快照之後（中間漏了，
      快照已經追不上，重拉）。
    - 之後每一筆：first 必須正好等於本地序號 + 1。
    """

    def decide(
        self,
        local_update_id: int,
        update: OrderBookUpdate,
        *,
        still_synchronizing: bool,
    ) -> SequenceDecision:
        if update.final_update_id <= local_update_id:
            # 整個區間都在本地序號之前：這筆的內容已經反映在簿子上了。
            # 套下去等於把時間往回撥，會把之後才被撤掉的掛單又放回來。
            return SequenceDecision.DISCARD

        if still_synchronizing:
            covers_snapshot = update.first_update_id <= local_update_id + 1
            return (
                SequenceDecision.APPLY
                if covers_snapshot
                else SequenceDecision.RESYNCHRONIZE
            )

        return (
            SequenceDecision.APPLY
            if update.first_update_id == local_update_id + 1
            else SequenceDecision.RESYNCHRONIZE
        )
```

三個決定各有名字，因為它們是三種不同的處置，而漏掉任何一個都會壞：

```python
# quantbot/domain/values/sequence_decision.py
class SequenceDecision(StrEnum):
    """收到一筆增量更新之後，該拿它怎麼辦。

    三個選項，缺一個就會壞：

    - DISCARD：這筆的內容已經包含在快照裡了，套下去等於把時間往回撥。
    - APPLY：序號接得上，套用。
    - RESYNCHRONIZE：中間漏了幾筆，本地的簿子從這一刻起是錯的。**唯一正確的
      處理是丟掉重拉快照**，NEVER 硬套下去——漏掉的那幾筆裡可能有「某一檔被清空」，
      沒收到的話那一檔會永遠留在本地的簿子上，之後每個特徵都吃到那一檔早就不存在的掛單。
    """

    DISCARD = "discard"
    APPLY = "apply"
    RESYNCHRONIZE = "resynchronize"
```

### 順序：先訂閱，後拉快照

這一節是實跑之後才寫的，因為問題是跑出來才看到的。

直覺的寫法是「先拉快照，再訂閱增量」，先有基礎狀態，再開始接更新，聽起來完全合理。第一版就是這樣寫的，然後每次錄製結束，報告裡的重取快照次數都是 **1**。

原因是那兩個動作之間有一段空窗：快照拍完、WebSocket 連線還沒建立好的那幾百毫秒裡，市場照樣在動，而那段變動沒有任何人收到。所以連上之後的第一筆更新一定接不上快照的序號，於是觸發一次重拉。啟動時必然多付一次 5 weight，而且那個 `resynchronization_count` 從此永遠不是 0——一個永遠不歸零的健康指標等於沒有指標。

正確的順序是反過來：**先訂閱，收到第一筆更新之後才去拉快照。** 拉快照那幾百毫秒裡推來的更新會待在 WebSocket 的接收緩衝裡，一筆都不會掉；它們的序號比快照舊，於是被 `DISCARD` 掉，這正是那個計數器該有的用途。

```python
# quantbot/application/record_microstructure_application.py
    async def _consume_order_book(self) -> None:
        """維護本地簿子，並按固定間隔摘要一次。

        摘要跟套用更新在同一個協程裡，所以 NEVER 會摘到一份「套了一半」的簿子。
        另開一個協程定時摘要看起來更整齊，但那需要在兩者之間加鎖，
        而鎖是為了修補一個不必存在的問題。

        **順序很重要：先訂閱，收到第一筆更新之後才去拉快照。** 反過來寫（先拉快照
        再訂閱）看起來更自然，但那之間有一段空窗——快照拍完、連線還沒建立的那幾百
        毫秒裡發生的變動沒有人收到，所以第一筆更新一定接不上，啟動時必然多一次重拉。
        實測過：先快照後訂閱的版本，每次啟動的 resynchronization_count 都是 1。

        先訂閱的話，拉快照期間的更新會待在 WebSocket 的接收緩衝裡，一筆都不會掉；
        它們的序號比快照舊，於是被 DISCARD 掉，這正是那個計數器該有的用途。
        """
        book: OrderBook | None = None
        next_capture = self._clock.now()
        still_synchronizing = True

        async for update in self._order_book.updates(self._configuration.listing):
            if book is None:
                # 第一筆更新已經在手上（也就是訂閱確實成功了）才拉快照
                book = await self._resynchronize()
            decision = self._sequence.decide(
                book.last_update_id, update, still_synchronizing=still_synchronizing
            )
            if decision is SequenceDecision.DISCARD:
                self._discarded_update_count += 1
                continue
            if decision is SequenceDecision.RESYNCHRONIZE:
                self._resynchronization_count += 1
                book = await self._resynchronize()
                still_synchronizing = True
                continue

            book.apply(update)
            self._applied_update_count += 1
            still_synchronizing = False

            now = self._clock.now()
            if now >= next_capture:
                self._depth_buffer.append(book.summarize(now))
                next_capture = now + self._configuration.capture_interval
                if self._is_due(len(self._depth_buffer), self._latest_depth_flush_at):
                    await self._flush_depth()
```

改完之後同樣錄 120 秒，重取快照 0 次、丟棄 1 筆。那個 1 就是拉快照期間緩衝下來的更新，它被丟掉是對的。

這件事寫進測試比寫在註解裡有用，因為順序很容易在某次重構時被「整理」回去：

```python
async def test_no_update_means_no_snapshot_was_ever_requested():
    """訂閱先、快照後。這個順序寫反的代價是每次啟動都多一次重拉。

    一筆更新都沒收到的話，代表訂閱根本沒成功，那時候拉快照是白花 5 weight——
    而且它會讓「啟動時的 resynchronization_count 應該是 0」這個健康指標失效。
    """
    application, snapshots, _, _ = build(updates=[], events=[trade_event(1)])

    report = await application.run()

    snapshots.snapshot.assert_not_awaited()
    assert report.resynchronization_count == 0
```

### 深度摘要：落地的那一刻就決定了以後算得出什麼

掛單簿一秒可以變動幾百次。全部留下來一天就是幾十 GB，而且相鄰兩筆通常只差一兩檔。所以要壓縮，而且是**有損**壓縮。

問題是丟掉什麼。這裡的選擇是：留最好的買賣價（價差算得出來）與幾個深度的加總（掛單不對稱算得出來），其餘丟掉。丟掉的東西包含「單一大額掛單」與「掛單的分布形狀」。

關鍵在於這個決定**不可逆**：

```python
# quantbot/domain/values/depth_columns.py
class DepthColumns:
    """掛單簿深度摘要的欄位語彙。

    這裡的 LEVELS 不是一個「參數」，是 schema 的一部分：一旦錄下來的是前 5／10／20
    檔的加總，事後就再也算不出前 7 檔——原始的逐檔資料沒有被留下來。所以深度清單
    只寫在這一個地方，錄製端與資料表都從它產生，NEVER 讓兩邊各寫一份。

    要改這個清單的代價是重新錄一次，不是重跑一次計算。這個代價要在文章裡講清楚，
    也是「先想清楚要算什麼特徵，再決定存什麼」這句話的具體樣子。
    """

    CAPTURED_AT: ClassVar[str] = "captured_at"
    LEVELS: ClassVar[tuple[int, ...]] = (5, 10, 20)
```

這是 Day 09 跟前面七天最不一樣的地方。K 線那條路上做錯的決定都可以重跑：欄位對映錯了重新解析一次、清洗規則改了重新跑一次 pipeline ，原始的 zip 還在 `data/raw/`。掛單簿沒有這種保險：沒錄下來的東西就是沒有了，而且回不去。

5／10／20 這三個深度是照 Day 10 要算的東西挑的：OBI 的慣例深度是 5 到 20 檔，三個一起錄才比較得出「深度取幾檔會不會改變結論」。

### WebSocket：重連寫一份，心跳不必自己做

斷線不是例外狀況，是預期事件。往上丟的話呼叫端每隔幾小時就要處理一次同樣的錯誤，而它能做的也只有重連。所以重連在最底層解決，而且只有一份：

```python
# quantbot/infrastructure/binance/binance_websocket_message_source.py
class BinanceWebsocketMessageSource:
    """一條會自己重連的 WebSocket 連線，吐出原始的文字訊息。

    重連邏輯只寫在這裡一份。兩個 stream（成交與掛單簿）都走這條路，所以「斷線要
    等多久再試」這件事不會有兩種行為。

    退避是指數的並且有上限：斷線的原因通常不是我們這邊的問題（交易所重啟、網路
    抖動），一秒重試一百次只會讓自己被擋。上限存在的理由相反——真的是長時間中斷
    的話，退避不能無限長大到「服務恢復了兩小時我們還在睡」。

    心跳不必自己處理：websockets 這個套件預設每 20 秒送一次 ping，對方沒回就
    主動關閉連線，而關閉會讓下面的 async for 結束、外層迴圈重連。自己實作 ping
    只會多一份要維護的計時器。
    """

    async def messages(
        self, listing: Listing, *, streams: tuple[str, ...]
    ) -> AsyncIterator[str]:
        url = self._url_builder.combined_stream(listing, streams=streams)
        backoff_seconds = self._initial_backoff_seconds

        while True:
            try:
                async with connect(url, max_queue=1024) as connection:
                    backoff_seconds = self._initial_backoff_seconds  # 連上了就重設
                    async for frame in connection:
                        yield frame if isinstance(frame, str) else frame.decode("utf-8")
            except OSError, websockets.WebSocketException:
                # 斷線是預期事件，不是例外狀況。往上丟的話呼叫端每隔幾小時就要
                # 處理一次同樣的錯誤，而它能做的也只有重連。
                await asyncio.sleep(backoff_seconds)
                backoff_seconds = min(
                    backoff_seconds * 2, self._maximum_backoff_seconds
                )
```

那個 `except` 少了一對括號，不是筆誤。Python 3.14 起可以不加括號寫多個例外型別（PEP 758），而 ruff 的格式化在 `target-version = "py314"` 下會主動把那對括號拿掉。在 3.13 或更早的版本上照抄這一行會得到 `SyntaxError`，補回括號就好。

`max_queue=1024` 就是前面說的接收緩衝：拉快照那幾百毫秒裡推來的更新待在這裡。設太小的話它們會被丟掉，那就回到「先快照後訂閱」那個問題。

兩個 stream 合併成一條連線，不是兩條：

```python
# quantbot/infrastructure/binance/binance_stream_url_builder.py
    def combined_stream(self, listing: Listing, *, streams: tuple[str, ...]) -> str:
        """一條連線訂閱多個 stream。

        兩個 stream 各開一條連線也能跑，但合併訂閱有一個實際好處：兩邊的訊息
        在同一條 TCP 連線上依序抵達，斷線時一起斷，不會出現「成交還在來、
        掛單簿早就停了」這種只有事後對帳才看得出來的狀態。
        """
        symbol = listing.native_symbol.lower()
        joined = "/".join(f"{symbol}@{stream}" for stream in streams)
        return f"{self.WEBSOCKET_BASE_URLS[listing.market]}/stream?streams={joined}"
```

順帶一個很容易踩到的細節：stream 路徑裡的 symbol **必須小寫**。寫成 `BTCUSDT@aggTrade` 不會被拒絕，連線會建立成功，然後什麼資料都不會來。

### 外部 JSON 是型別系統的邊界

Binance 的即時訊息用單字母欄名（`a`、`p`、`q`、`U`、`u`、`b`、`m`），在頻寬上是對的，在可讀性上是災難。所有這種知識關在一個 parser 裡。

另外有一件事一定要處理：**價格與數量在 Binance 的 JSON 裡是字串，不是數字。**

```python
# quantbot/infrastructure/binance/binance_stream_payload_parser.py
    @staticmethod
    def _number(payload: Mapping[str, object], key: str) -> float:
        """價格與數量在 Binance 的 JSON 裡是**字串**，不是數字。

        這是刻意的：字串不會在傳輸過程中被某一端的 JSON 實作重新格式化成
        科學記號或截掉尾數。代價是每個數值欄位都要自己轉，忘了轉的話
        pandas 會安靜地給我們一整欄 object 型別的字串。
        """
        value = payload[key]
        if isinstance(value, str):
            return float(value)
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise ValueError(f"{key} 應該是數字或數字字串，實得 {value!r}")
        return float(value)
```

每個欄位都經過一次型別檢查再落地，看起來囉唆，但這裡是型別系統的邊界：不擋的話 `price` 就是一個「可能是字串、可能是數字、可能不存在」的東西，一路飄進計算才炸，而且炸出來的訊息跟真正的原因無關。

`isinstance(value, bool)` 那一段不是多餘的：Python 的 `bool` 是 `int` 的子類別，所以 `isinstance(True, int)` 是 `True`。少了那個檢查，一個布林欄位會安靜地變成 1.0。

### 重拉快照不是免費的

序號斷裂就要重拉快照，而快照走 REST、吃 API weight。spot 的 `/api/v3/depth` 按檔數分級：100 檔以內 5、500 檔 25、1000 檔 50、5000 檔 250。

問題在於斷裂會成串發生。網路品質差的時候「斷裂 → 重拉 → 又斷 → 又重拉」可以在幾秒內打幾十次，而那個額度跟 Day 03 的回補、以及第四階段的下單共用同一個 IP。

Day 03 的 `BinanceRateLimitGuard` 管的是回補時的 weight 帳，它讀 ccxt 的回應標頭、逼近門檻就讓路。這裡要防的是另一種形狀的問題，所以是另一個 guard：

```python
# quantbot/infrastructure/binance/binance_snapshot_rate_guard.py
class BinanceSnapshotRateGuard:
    """限制重拉快照的頻率。

    Day 03 的 BinanceRateLimitGuard 管的是回補時的 weight 帳，它讀 ccxt 的回應
    標頭、逼近門檻就讓路。這裡要防的是另一種形狀的問題：**序號斷裂風暴**。

    掛單簿的增量更新每 100ms 來一次，序號一斷就要重拉快照。網路品質差的時候，
    「斷裂 → 重拉 → 又斷 → 又重拉」可以在幾秒內打幾十次 /api/v3/depth，
    每次 5 weight（100 檔以內）。撞到每分鐘 2400 weight 的上限之後，IP 會被
    暫時封鎖，而那條路徑同時是回補與（第四階段）下單在用的。

    所以這個 guard 的規則很簡單：兩次快照之間至少隔 minimum_interval_seconds。
    在那之前想重拉的話就等——寧可有幾秒沒有掛單簿資料，也 NEVER 把整個 IP 賠掉。
    """

    async def acquire(self) -> None:
        """要打快照之前呼叫。太密的話睡到可以打為止。"""
        now = self._clock.now()
        if self._latest_acquired_at is not None:
            elapsed_seconds = (now - self._latest_acquired_at).total_seconds()
            remaining_seconds = self._minimum_interval_seconds - elapsed_seconds
            if remaining_seconds > 0:
                await asyncio.sleep(remaining_seconds)
                now = self._clock.now()
        self._latest_acquired_at = now
```

它收 `Clock` 而不是自己讀系統時間，理由跟 Day 03 一樣：時間相關的行為要測得起來。

### 兩條串流一起管

用例本身很短，因為該分出去的都分出去了。它負責三個決定：狀態要不要重建、什麼時候摘要一次、緩衝滿了要不要倒出去。

```python
# quantbot/application/record_microstructure_application.py
    async def run(self) -> RecordingReportDto:
        """錄到時間到（或串流結束）為止，然後把剩下的緩衝倒完。

        duration_seconds 為 None 就一直跑，所以正式部署不需要外面包一層排程；
        文章與測試給它一個秒數，才有辦法在有限時間內看到結果。
        """
        try:
            async with asyncio.timeout(self._configuration.duration_seconds):
                async with asyncio.TaskGroup() as group:
                    group.create_task(self._consume_trades())
                    group.create_task(self._consume_order_book())
        except TimeoutError:
            pass  # 時間到是正常的結束方式，不是錯誤

        await self._flush_trades()
        await self._flush_depth()
        return RecordingReportDto(
            listing=self._configuration.listing,
            recorded_trade_count=self._recorded_trade_count,
            recorded_depth_row_count=self._recorded_depth_row_count,
            applied_update_count=self._applied_update_count,
            discarded_update_count=self._discarded_update_count,
            resynchronization_count=self._resynchronization_count,
        )
```

`asyncio.TaskGroup` 的行為正是這裡要的：任一條掉了就整組結束。少了這個保證，最壞的情況是「成交還在錄、掛單簿其實早就斷了」，錄出一段看起來完整、其實只有一半的資料，而那要等到分析階段才會發現。

成交那條路刻意攢一批再寫：

```python
# quantbot/application/record_microstructure_application.py
    @staticmethod
    def _as_frame(events: list[TradeEvent]) -> pd.DataFrame:
        """一次把整個緩衝轉成表，NEVER 一筆一筆寫進資料庫。

        每筆成交一次 INSERT 的話，BTC/USDT 活躍時段一秒幾十筆就會讓連線變成瓶頸，
        而且每一筆都是一次獨立交易。攢一批再 COPY，寫入從瓶頸變成不用管的事。
        """
```

不過「攢一批」只寫列數條件是不夠的，而這件事也是實跑才發現的。第一版的緩衝只在滿 5,000 列時倒出去，於是錄一小時的結果是：**整個小時的深度摘要都還在記憶體裡**，因為每秒一列要 83 分鐘才湊滿一批。這種設計在正式部署（`duration_seconds` 為 None、一直跑）上更糟，因為它意味著任何一次當掉都會吃掉最近一個多小時的資料，而串流沒有重放。

所以倒緩衝要有兩個觸發條件：

```python
# quantbot/application/record_microstructure_application.py
    def _is_due(self, buffered_row_count: int, latest_flush_at: pd.Timestamp) -> bool:
        """該倒緩衝了嗎：攢夠一批，或者離上次倒出去已經太久。

        兩個條件都要有。只看列數的話，冷清時段可能幾十分鐘湊不滿一批，而那段時間
        程式一旦掛掉，緩衝裡的東西就跟著沒了——那是唯一一份，串流不能重放。
        """
        if buffered_row_count >= self._configuration.flush_row_count:
            return True
        elapsed_seconds = (self._clock.now() - latest_flush_at).total_seconds()
        return (
            buffered_row_count > 0
            and elapsed_seconds >= self._configuration.flush_interval_seconds
        )
```

批次那條路沒有這個問題：檔案在硬碟上，重跑就有。即時資料的每一筆都只有一次機會，這是兩條路徑在設計上最實際的差別。

### 資料表：一天一個 chunk

Day 07 的 `candles` 是七天一個 chunk。這裡改成一天，因為同樣的列數對應的時間跨度差了兩三個數量級：

| 表 | 一個 chunk | 為什麼 |
|---|---|---|
| `candles` | 7 天 | 一年的 1 分鐘 K 線是 52 萬列 |
| `agg_trades` | 1 天 | 一天就是 74 萬列 |
| `order_book_depth` | 1 天 | 每秒一列，一天 86,400 列 |

主鍵的設計也不一樣，而且有一個要交代的妥協：

```sql
-- quantbot/infrastructure/persistence/migrations/004_microstructure.sql
CREATE TABLE IF NOT EXISTS agg_trades (
    symbol          TEXT             NOT NULL,   -- 'BTC/USDT'
    market          TEXT             NOT NULL,   -- 'spot' | 'usdm'
    trade_id        BIGINT           NOT NULL,   -- 聚合成交編號，唯一鍵
    transact_time   TIMESTAMPTZ      NOT NULL,   -- 成交時間，UTC
    price           DOUBLE PRECISION NOT NULL,
    quantity        DOUBLE PRECISION NOT NULL,   -- 以基礎幣計價
    first_trade_id  BIGINT           NOT NULL,   -- 這一列併了哪幾筆原始成交
    last_trade_id   BIGINT           NOT NULL,
    buyer_is_maker  BOOLEAN          NOT NULL,   -- 買方掛單 → 主動方是賣方
    source          TEXT             NOT NULL,   -- 'binance_archive' | 'binance_websocket'
    ingested_at     TIMESTAMPTZ      NOT NULL DEFAULT now(),
    CONSTRAINT agg_trades_pkey PRIMARY KEY (symbol, market, transact_time, trade_id)
);

-- hypertable 的分區欄必須是主鍵的一部分，所以 transact_time 在主鍵裡；
-- 真正防重複的是 trade_id，但單獨對它建唯一索引在分區表上做不到，
-- 所以複合主鍵是 (symbol, market, transact_time, trade_id)。
-- 這代表「同一筆成交用不同的時間戳寫兩次」擋不住——而那不會發生：
-- 時間戳是交易所給的事實，不是我們算出來的。
SELECT create_hypertable(
    'agg_trades',
    by_range('transact_time', INTERVAL '1 day'),
    if_not_exists => TRUE
);
```

壓縮政策也比 K 線積極：7 天就壓，而不是 30 天。理由是逐筆成交長得太快，而且歷史的成交是定稿：補洞只會往後加，不會回頭改寫，所以壓縮過的 chunk 不會需要回填。

## 陷阱與驗證

### 對帳：九個欄位

先跑回補。一天的資料，包含下載、驗 checksum、解壓、解析、入庫、對帳：

```bash
uv run python -m quantbot.entrypoints.backfill_trades_command \
    --symbol BTC/USDT --market spot --start 2026-07-15 --end 2026-07-16
```

```
spot_BTCUSDT
  抓到 739,547 列，寫入 739,547 列（差額是資料庫裡已經有的）
  成交編號斷號：0 筆
  對帳：1,440 根 K 線，容忍度 1e-06
    OK open                     最大相對誤差 0.000e+00
    OK high                     最大相對誤差 0.000e+00
    OK low                      最大相對誤差 0.000e+00
    OK close                    最大相對誤差 0.000e+00
    OK volume                   最大相對誤差 2.200e-16
    OK quote_volume             最大相對誤差 2.204e-16
    OK taker_buy_base_volume    最大相對誤差 2.219e-16
    OK taker_buy_quote_volume   最大相對誤差 2.414e-16
    OK trade_count              最大相對誤差 0.000e+00
  結果：通過
```

整段花 13 秒。

這九行是今天最有份量的產出，值得逐項看它證明了什麼：

- **開高低收誤差是 0**，不是 1e-16。這四個值是從原始價格挑出來的（第一筆、最大、最小、最後一筆），沒有經過任何算術，所以應該逐位元相同。真的相同。
- **四個成交量欄位是 2.2e-16 到 2.4e-16**，也就是 `float64` 的機器精度。這是七十幾萬個數字相加的順序不同造成的，沒有邏輯差異。
- **`trade_count` 誤差是 0**。這一項最能說明問題：官方數的是真實成交筆數，我們手上是被併過的 739,547 列。如果用列數去數，這一欄會差四倍多而不是 0。它對得上，就證明 `last - first + 1` 這個算法是對的。
- **1,440 根全部對上**，兩邊都沒有多出或少掉任何一根。也就是「哪一分鐘該有 K 線」的判斷（沒成交就不出）跟官方一致。

一次對帳同時擔保了欄位對映、時間戳單位、時區、聚合邊界、taker 方向這五件事。而它只需要一份我們早就有辦法拿到的官方 K 線。

### 跨過那條單位分界線

前面說時間戳的單位在 2025-01-01 從毫秒換成微秒，而數量級判斷可以不管那件事。這句話值得實際跑一次來證明，而且只要挑一個跨過那一天的區間就行：

```bash
uv run python -m quantbot.entrypoints.backfill_trades_command \
    --symbol BTC/USDT --market spot --start 2024-12-31 --end 2025-01-02
```

```
spot_BTCUSDT
  抓到 1,871,855 列，寫入 1,871,855 列（差額是資料庫裡已經有的）
  成交編號斷號：0 筆
  對帳：2,880 根 K 線，容忍度 1e-06
    OK open                     最大相對誤差 0.000e+00
    OK high                     最大相對誤差 0.000e+00
    OK low                      最大相對誤差 0.000e+00
    OK close                    最大相對誤差 0.000e+00
    OK volume                   最大相對誤差 2.217e-16
    OK quote_volume             最大相對誤差 2.473e-16
    OK taker_buy_base_volume    最大相對誤差 2.206e-16
    OK taker_buy_quote_volume   最大相對誤差 2.548e-16
    OK trade_count              最大相對誤差 0.000e+00
  結果：通過
```

兩個日檔的時間戳單位不一樣（一個 13 位、一個 16 位），在同一次執行裡被解析、併成一段、聚合成 2,880 根 K 線，然後跟官方的兩天 K 線逐欄對上。這道對帳的價值就在這裡：它不只驗「我算得對不對」，也驗「我對這份資料的假設對不對」。單位判斷寫錯的話，錯的那一天會整批位移到 1970 年，於是那 1,440 根跟官方一根都對不上，`missing_in_rebuilt` 立刻是 1,440。

### 重跑

第二次跑同一天：

```
spot_BTCUSDT
  抓到 739,547 列，寫入 0 列（差額是資料庫裡已經有的）
  成交編號斷號：0 筆
```

抓到的還是七十幾萬列，寫進去的是 0。冪等在報告上要看得見，而不是要去猜，這也是為什麼那兩個數字分開列。

### taker 方向寫反的話會怎樣

前面說 taker 方向寫反「不會報錯」。把它變成一個測試，就會知道有了對帳之後它會被抓出來：

```python
async def test_a_wrong_taker_side_is_caught_by_the_reconciliation():
    """把 buyer_is_maker 反過來，價格與成交量全對，只有兩個 taker 欄位會壞。

    這正是這道對帳存在的理由：taker 方向寫反不會影響任何一個價格欄位，
    所以沒有這道檢查的話，它會一路活到某個資金流特徵的正負號整批顛倒為止。
    """
    trades = make_trades()
    flipped = TradeSeries(
        LISTING,
        trades.frame.assign(
            **{TradeColumns.BUYER_IS_MAKER: ~trades.frame[TradeColumns.BUYER_IS_MAKER]}
        ),
    )
    application, _, _, _ = build(flipped, official_from=trades)

    report = await application.run(LISTING, PERIOD)

    assert report.agreement is not None
    assert not report.passed
    assert report.agreement.worst_column.startswith("taker_buy")
    assert report.agreement.maximum_relative_difference["close"] == 0.0
```

最後那一行是重點：`close` 的誤差仍然是 0。這種錯誤不會弄壞任何一個價格欄位，所以肉眼看圖、對收盤價、跑均線都不會發現。

### 掛單簿要測的是「一連串操作之後的狀態」

`OrderBook` 是狀態機，所以測試的形狀跟前面的指標不一樣：不是「餵一段資料、比對輸出」，而是「做幾個動作、檢查狀態」。

```python
def test_zero_quantity_removes_the_level_instead_of_keeping_a_zero():
    """掛量 0 是「這一檔清空了」。留著它的症狀是前 N 檔實際上只涵蓋 N-1 檔。"""
    book = OrderBook(snapshot())

    book.apply(
        OrderBookUpdate(
            event_time=CAPTURED_AT,
            first_update_id=101,
            final_update_id=101,
            bid_changes=(PriceLevel(99.0, 0.0),),
            ask_changes=(),
        )
    )

    assert book.best_bid_price == 98.0
    assert len(book) == 59
    # 前五檔仍然是五檔真實掛單，不是四檔加一個 0
    assert book.summarize(CAPTURED_AT).depth_quantities[
        0
    ].bid_quantity == pytest.approx(5.0)


def test_summary_uses_opposite_orderings_for_the_two_sides():
    """買方要價格最高的前 N 檔，賣方要價格最低的前 N 檔。

    兩邊都用同一個方向排序的話，數值範圍看起來完全正常，但掛單不對稱的
    正負號會整批顛倒——這是這個 entity 最需要被釘住的一件事。
    """
    book = OrderBook(
        OrderBookSnapshot(
            last_update_id=1,
            # 買方最好的那一檔（100）掛得特別多
            bids=(PriceLevel(100.0, 9.0), PriceLevel(99.0, 1.0), PriceLevel(98.0, 1.0)),
            # 賣方最好的那一檔（101）掛得特別少
            asks=(
                PriceLevel(101.0, 1.0),
                PriceLevel(102.0, 9.0),
                PriceLevel(103.0, 9.0),
            ),
        )
    )

    quantities = book.summarize(CAPTURED_AT).depth_quantities[0]
    assert quantities.level == DepthColumns.LEVELS[0]
    assert quantities.bid_quantity == pytest.approx(11.0)
    assert quantities.ask_quantity == pytest.approx(19.0)
```

第二個測試的資料是刻意設計的：兩側的總量不同（11 對 19），而且哪一側多取決於排序方向。排序寫錯的話這兩個斷言會同時失敗，而任何「檢查數值範圍合理」的測試都抓不到。

序號規則那邊用一張表列完九種情況：

```python
@pytest.mark.parametrize(
    ("local", "first", "final", "synchronizing", "expected"),
    [
        # 剛接上：更新的區間跨過快照序號，這是唯一可以開始套用的情況
        (100, 95, 105, True, SequenceDecision.APPLY),
        (100, 101, 110, True, SequenceDecision.APPLY),  # 正好接在後面
        # 整段都在快照之前：內容已經包含在快照裡
        (100, 90, 99, True, SequenceDecision.DISCARD),
        (100, 90, 100, True, SequenceDecision.DISCARD),  # 邊界：final == local
        # 剛接上就已經跳過去了：快照追不上，只能重拉
        (100, 102, 110, True, SequenceDecision.RESYNCHRONIZE),
        # 已經在跑：first 必須正好是 local + 1
        (100, 101, 105, False, SequenceDecision.APPLY),
        (100, 103, 105, False, SequenceDecision.RESYNCHRONIZE),
        (100, 99, 105, False, SequenceDecision.RESYNCHRONIZE),  # 重疊也不接受
        (100, 95, 98, False, SequenceDecision.DISCARD),
    ],
)
def test_decision_table(local, first, final, synchronizing, expected):
    decision = OrderBookSequenceService().decide(
        local, update(first, final), still_synchronizing=synchronizing
    )
    assert decision is expected
```

加上一個防「校驗寫太嚴」的測試。上面那張表全過、但正常流量每一筆都要求重拉，是有可能的：

```python
def test_a_continuous_stream_is_always_applied():
    """連續的更新流一筆都不該被丟掉，也不該觸發重拉。

    這個測試存在的理由是防「校驗寫太嚴」：把條件寫成 first > local 之類的話，
    上面那張表可能還是全過，但正常流量會每一筆都要求重拉。
    """
    service = OrderBookSequenceService()
    local = 1_000
    synchronizing = True

    for step in range(50):
        current = update(local + 1, local + 3)
        decision = service.decide(local, current, still_synchronizing=synchronizing)
        assert decision is SequenceDecision.APPLY, f"第 {step} 筆被拒絕"
        local = current.final_update_id
        synchronizing = False
```

### 實際錄一段

```bash
uv run python -m quantbot.entrypoints.record_microstructure_command \
    --symbol BTC/USDT --market spot --seconds 120
```

```
spot_BTCUSDT
  成交寫入 833 列
  深度摘要寫入 114 列
  掛單簿更新：套用 1,195、丟棄 1、重取快照 0 次
```

兩分鐘裡：833 筆聚合成交、114 筆深度摘要（設定是每秒一筆）、1,195 筆掛單簿更新。丟棄的那 1 筆是拉快照期間緩衝下來的，重取快照 0 次。

兩分鐘太短，看不出穩定性。把它拉長到 45 分鐘：

```
spot_BTCUSDT
  成交寫入 19,481 列
  深度摘要寫入 2,553 列
  掛單簿更新：套用 26,991、丟棄 1、重取快照 0 次
```

26,991 筆更新一筆都沒漏，序號從頭接到尾。丟棄的還是只有啟動時那 1 筆。

這個結果要小心解讀。**「0 次」是好事，但它不是「序號校驗有在運作」的證據**：一段連線品質很好的 45 分鐘，把校驗整段註解掉也會得到 0。真正證明校驗有效的是那張決定表的九個案例與那個連續流的測試，它們在沒有網路的情況下跑。實跑數字證明的是另一件事：**這條路徑在正常情況下不會誤判**，也就是校驗沒有寫得太嚴。兩個方向都要驗，缺一邊都會漏掉一整類錯誤。

錄下來的深度摘要長這樣：

```
                                  best_bid_price  best_ask_price  bid_quantity_5  ask_quantity_5
captured_at
2026-08-04 16:52:53.247815+00:00        63922.66        63922.67         3.01816         2.10481
2026-08-04 16:52:54.247985+00:00        63922.66        63922.67         5.62843         0.04242
2026-08-04 16:52:55.254427+00:00        63924.56        63924.57         8.28721         0.10843
2026-08-04 16:52:56.349543+00:00        63924.56        63924.57         3.46778         2.43468
```

有兩件事可以先看出來，都會在明天用到。

第一，**價差是常數 0.01**。那 227 筆樣本裡每一筆都是 0.01 USDT，也就是 BTC/USDT 現貨的最小報價單位，價差已經窄到不能再窄。所以在這個交易對上，價差本身沒有資訊量，可以動的只有深度。換到冷門交易對就不是這樣了。

第二，**兩側的掛量變化很劇烈**。第二列的賣方前五檔只剩 0.042 BTC，買方是 5.63 BTC，相差一百多倍；下一秒賣方又回到 0.108，再下一秒回到 2.43。把「兩側差多少」算成一個數字（明天的 OBI），這 227 筆樣本的範圍是 −0.999 到 +0.986，平均 −0.126。

也就是說這個特徵**幾乎每秒都在大幅擺動**。這件事對明天很重要：一個擺動這麼快的特徵，能不能拿來當訊號，是要驗證的，不是假設的。

### 資料量的現實

把三張表放在一起看：

| 表                  | 列數        | 佔用空間   | 涵蓋範圍          |
|--------------------|-----------|--------|---------------|
| `candles`          | 2,794,384 | 132 MB | 兩年多的 1m 與 1h  |
| `agg_trades`       | 741,304   | 197 MB | **一天** ＋ 兩段錄製 |
| `order_book_depth` | 227       | 136 kB | 五分鐘錄製         |

一天的逐筆成交比兩年多的 K 線更佔空間。這不是一個「以後要注意」的提醒，它現在就在改變設計：`agg_trades` 的讀取方法一律要帶時間範圍，NEVER 提供「把這個交易對的成交全撈出來」；深度摘要每秒一列，一天 86,400 列大約 52 MB，錄一個月就 1.5 GB。

Day 07 選 TimescaleDB 的理由（只增不改、都用時間範圍查、量隨時間線性成長）在這一層才真正變成剛需。K 線那個量級用 parquet 檔案堆其實也還撐得住；到了這一層就不行了。

## 今日交付物

```
quantbot/
├── domain/
│   ├── values/
│   │   ├── listing.py                          今天：Listing（symbol ＋ market）
│   │   ├── taker_side.py                       今天：TakerSide
│   │   ├── trade_columns.py                    今天：逐筆成交的欄位語彙
│   │   ├── trade_event.py                      今天：即時串流的一筆成交
│   │   ├── price_level.py                      今天：掛單簿的一檔
│   │   ├── order_book_snapshot.py              今天
│   │   ├── order_book_update.py                今天
│   │   ├── sequence_decision.py                今天：三種處置
│   │   ├── depth_columns.py                    今天：LEVELS 是 schema 的一部分
│   │   ├── order_book_depth_summary.py         今天
│   │   └── recording_configuration.py          今天
│   ├── entities/
│   │   ├── trade_series.py                     今天：去重看 trade_id、重建 K 線
│   │   ├── order_book.py                       今天：唯一有狀態的 entity
│   │   └── depth_series.py                     今天
│   ├── services/
│   │   ├── order_book_sequence_service.py      今天：序號規則
│   │   └── candle_agreement_service.py         今天：逐欄對帳
│   ├── dto/
│   │   ├── candle_agreement_report.py          今天
│   │   ├── trade_ingest_report.py              今天
│   │   └── recording_report.py                 今天
│   └── interfaces/                             今天：六個 Protocol
│       ├── trade_source.py / trade_parser.py
│       ├── trade_repository.py / depth_repository.py
│       └── trade_stream.py / order_book_stream.py
│           ＋ order_book_snapshot_source.py
├── application/
│   ├── backfill_trades_application.py          今天：取得 → 查斷號 → 入庫 → 對帳
│   └── record_microstructure_application.py    今天：兩條串流 ＋ 狀態維護
├── infrastructure/
│   ├── binance/
│   │   ├── binance_agg_trade_csv_parser.py     今天
│   │   ├── binance_archive_trade_source.py     今天：只用日檔
│   │   ├── binance_archive_url_builder.py      Day 03，今天加 daily_agg_trades()
│   │   ├── binance_stream_url_builder.py       今天
│   │   ├── binance_stream_payload_parser.py    今天：單字母欄名關在這裡
│   │   ├── binance_websocket_message_source.py 今天：重連只有一份
│   │   ├── binance_websocket_trade_stream.py   今天
│   │   ├── binance_websocket_order_book_stream.py 今天
│   │   ├── binance_rest_order_book_snapshot_source.py 今天
│   │   └── binance_snapshot_rate_guard.py      今天：防斷裂風暴
│   ├── persistence/
│   │   ├── migrations/004_microstructure.sql   今天：兩張 hypertable
│   │   ├── timescale_trade_repository.py       今天
│   │   └── timescale_depth_repository.py       今天
│   └── reporting/
│       └── text_trade_ingest_report_renderer.py 今天
├── entrypoints/
│   ├── backfill_trades_command.py              今天
│   └── record_microstructure_command.py        今天
└── tests/
    ├── domain/entities/test_trade_series.py    今天
    ├── domain/entities/test_order_book.py      今天
    ├── domain/services/test_order_book_sequence_service.py     今天
    ├── domain/services/test_candle_agreement_service.py        今天
    ├── application/test_backfill_trades_application.py         今天
    └── application/test_record_microstructure_application.py   今天
```

### 驗收標準

七項全過才算完成：

1. `uv run python -m quantbot.infrastructure.persistence.migrate` 套用 `004_microstructure.sql`，`agg_trades` 與 `order_book_depth` 都是 hypertable，chunk 間隔一天。
2. `uv run python -m quantbot.entrypoints.backfill_trades_command --symbol BTC/USDT --market spot --start 2026-07-15 --end 2026-07-16` 抓到 739,547 列、斷號 0 筆，對帳的九個欄位最大相對誤差都在 `1e-6` 以內（實測價格四欄是 0、成交量四欄約 2.2e-16、`trade_count` 是 0），最後印「通過」。
3. 同一條指令再跑一次：抓到的列數一樣，寫入 0 列，仍然通過。冪等要看得見。
4. `uv run python -m quantbot.entrypoints.record_microstructure_command --symbol BTC/USDT --market spot --seconds 120` 跑完後，成交與深度摘要都有寫入，而且**重取快照次數是 0**。不是 0 的話先檢查是不是把「先拉快照再訂閱」的順序寫回去了。
5. `uv run pytest` 全綠。掛單簿那組要包含掛量 0 移除、快照外新價位、兩側反向排序、空的一側四種情況；序號那組要包含九種決定與連續流不被誤判。
6. `uv run mypy quantbot` 與 `uv run lint-imports` 全過。特別確認 domain 那幾個新檔案沒有 import 到 `websockets` 或 `httpx`，即時資料路徑是最容易讓技術細節漏進 domain 的地方。
7. 讀得回來：`TimescaleTradeRepository.read()` 拿一天的資料出來，`aggregate_to_candles(Timeframe("1m"))` 得到 1,440 根，跟 `candles` 表裡同一天的 1 分鐘 K 線對得上。

第 4 項是今天真正的重點。前三項是歷史資料對不對，第 4 項是即時路徑的狀態維護對不對，而後者沒有對照組可比，只能靠序號校驗的結果來判斷。那個「0 次」是它唯一的證據。

> 免責聲明：本文為程式與資料工程的技術分享，所有數字皆為教學範例，不構成投資建議；加密貨幣波動劇烈，實際交易請自行評估風險。

## 明天

今天手上多了兩種資料：完整歷史的逐筆成交，以及從現在開始累積的掛單簿深度摘要。它們目前只是躺在資料庫裡的列。

明天 Day 10 把掛單簿那份變成第一個特徵：**Order Book Imbalance**，也就是「買賣兩側的掛量差多少」壓成一個 −1 到 +1 的數字。直覺很簡單：買單掛得比賣單多，短時間內價格傾向往上。

但今天那 227 筆樣本已經先透露了兩件事：這個數字的擺動範圍是 −0.999 到 +0.986，而且幾乎每秒都在大幅改變。一個擺動這麼劇烈的數字到底有沒有預測力，不能靠直覺回答。所以明天除了算出這個特徵，還要做一件本系列到目前為止沒做過的事：**驗證一個特徵值不值得用**，把它跟未來 N 秒的報酬做相關性分析，實際看它有沒有資訊，而不是因為它聽起來合理就收進積木庫。

順帶也會回答一個工程問題：深度要取幾檔。5 檔、10 檔、20 檔算出來的結論如果不一樣，那才是需要解釋的事。

## Reference

- [aggTrades 的欄位順序、日檔與月檔的路徑規則，以及各資料集的可用範圍 — Binance Public Data](https://github.com/binance/binance-public-data)
- [Diff. Depth Stream 的推送頻率與「如何正確維護一份本地掛單簿」的官方步驟 — Binance Spot API Documentation, WebSocket Streams](https://developers.binance.com/docs/binance-spot-api-docs/web-socket-streams)
- [深度快照端點 `/api/v3/depth` 按 limit 分級的 weight（100 檔 5、500 檔 25、1000 檔 50、5000 檔 250）與每分鐘 2400 weight 的 IP 上限 — Binance Spot API Documentation, Market Data Endpoints](https://developers.binance.com/docs/binance-spot-api-docs/rest-api/market-data-endpoints)
- [`websockets` 預設每 20 秒送一次 ping、對方沒回就關閉連線，所以心跳不必自己實作 — websockets documentation, Keepalive and latency](https://websockets.readthedocs.io/en/stable/topics/keepalive.html)
- [`asyncio.TaskGroup` 在任一子任務失敗時取消整組的語意 — Python documentation, asyncio Task Groups](https://docs.python.org/3/library/asyncio-task.html#task-groups)
