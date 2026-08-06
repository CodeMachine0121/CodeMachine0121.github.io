---
title: "Day 10：掛單簿買賣兩邊不對稱代表什麼？用 Order Book Imbalance 量化短線壓力"
datetime: "2026-09-24"
description: "OBI 把買賣兩側的掛量差壓成一個 −1 到 +1 的數字。這篇在 2,508 筆實錄的掛單簿上量它到底有沒有預測力：對未來一筆取樣的秩相關是 0.43（t = 23.8）、五組分位數報酬單調遞增，但拉到 30 筆就掉到 0.14，聚合到 1 分鐘 K 線之後跟 0 分不出來。最後算一次它跟手續費的比例——0.37 bp 對 20 bp。"
image: ""
parent: "2026 ithome-鐵人賽: 工程師的量化交易入門：從 K 線到可組合的交易策略引擎 系列"
draft: true
---

## 昨天錄下來的那 227 筆，藏著一個很躁動的東西

Day 09 最後貼了一段實際錄到的深度摘要，當時只看出兩件事：買賣價差是固定的 0.01 USDT，以及兩側的掛量變化很劇烈。第二件事值得拉出來看清楚。

拿昨天那批樣本裡的一小段，只看前五檔的兩側掛量：

```
                                  bid_quantity_5  ask_quantity_5
captured_at
2026-08-04 16:52:53.247815+00:00         3.01816         2.10481
2026-08-04 16:52:54.247985+00:00         5.62843         0.04242
2026-08-04 16:52:55.254427+00:00         8.28721         0.10843
2026-08-04 16:52:56.349543+00:00         3.46778         2.43468
```

第二秒的賣方前五檔只剩 0.042 BTC，買方是 5.63 BTC，相差一百三十倍。下一秒賣方回到 0.108，再下一秒回到 2.43。三秒之間，這個市場的樣子換了三次。

直覺的解讀是：買單掛得比賣單多很多，所以短時間內價格傾向往上。這個直覺有名字——**Order Book Imbalance（OBI，掛單不對稱）**——而且它是這一階段第一個「只有自己錄資料才算得出來」的特徵。

但直覺就只是直覺。一個每秒換一次臉的數字，到底有沒有預測力，是要量的。所以今天做兩件事：把 OBI 寫成一個特徵，以及**做這個系列到目前為止沒做過的事——驗證一個特徵值不值得用**。

先說結論，因為它同時是好消息與壞消息：在秒的尺度上，這個特徵的資訊量相當明確（秩相關 0.43、t = 23.8、分組報酬單調）；而它能抓到的價差是 0.37 個基點，來回手續費是 20 個基點。

## 交易概念補課

### 流動性：想馬上成交要付多少代價

流動性（liquidity）講的是「現在想馬上買到或賣掉，代價有多大」。它有兩個面向，Day 09 都已經看過了：

- **買賣價差**：最好的買價與最好的賣價差多少。價差窄代表馬上成交的代價小。
- **深度**：兩側各掛了多少量。深度厚代表可以馬上成交比較大的數量而不推動價格。

BTC/USDT 現貨的價差在昨天那 227 筆樣本裡**每一筆都是 0.01 USDT**，也就是最小報價單位。這件事對今天有一個直接的後果：在這個交易對上，價差沒有資訊量，因為它已經窄到不能再窄。會動的只有深度，所以今天的特徵是從深度算出來的。

換到冷門交易對就不是這樣，那裡的價差會忽大忽小，本身就是一個特徵。

### 掛單不對稱：把「哪一邊比較多」變成一個數字

OBI 的定義只有一行：

```
OBI = (買方掛量 − 賣方掛量) / (買方掛量 + 賣方掛量)
```

分母是兩側的總量，所以它是**比例**而不是差額。這一步不能省：同樣「買方多掛 10 BTC」，在總掛量 20 BTC 的市場與 2,000 BTC 的市場是完全不同的事件，而差額看不出差別。除以總量之後值域固定在 −1 到 +1，不同交易對、不同時段之間才可比。

兩個極端有明確的意義：+1 是賣方一張單都沒有，−1 是買方一張單都沒有。

### 一個必須先講的提醒：掛單可以撤

前面那個直覺——買單多所以會漲——有一個很大的漏洞：**掛單不是承諾**。掛出來的單隨時可以撤，而且撤單是免費的。

有一種操作就是刻意掛出大量單子製造某一側很厚的假象，等別人跟進之後撤掉，這叫 spoofing。它在多數受監管的市場是違法的，但加密貨幣市場的監管程度差異很大，而且要證明「那是意圖誤導」很難。

所以 OBI 量到的是「現在簿子上長什麼樣」，不是「有多少人真的想成交」。這兩件事在多數時候接近，在某些時候差很多，而後者剛好是最容易虧錢的時候。這個限制沒有辦法靠算法解決——它是這個資料源的性質。真正抵得住這件事的是**成交**資料（成交是既成事實，撤不掉），那是 Day 11 到 Day 14 的主場。

### 吃單與掛單：資金流的方向

Day 09 已經用到這一組詞，這裡補完整。掛單在簿子上等成交的是 maker，主動吃掉掛單的是 taker。價格會動是因為 taker 吃穿了某一側，所以 taker 的方向才是「資金流」的方向。

OBI 看的是 maker 那一側（還沒成交的意願），Day 11 的 VWAP 與資金流看的是 taker 那一側（已經成交的事實）。兩邊都有用，但它們的可信程度不同，理由就是上一節那個。

## 資料來源：只有自己錄的那幾段

Day 09 查證過一件事，這裡要再強調一次，因為它決定了今天能做到什麼程度：**`data.binance.vision` 的現貨批次資料裡沒有任何掛單簿資料**（只有 `klines`、`aggTrades`、`trades`）。掛單簿的批次檔只有永續合約那邊有，而現貨與永續 NEVER 混用。

所以今天算 OBI 用的是 Day 09 錄下來的那幾段，總共 45 分鐘、2,508 筆取樣。這個樣本量對「量一個秒級特徵」是夠的（2,507 個配對），對「量一個分鐘級特徵」完全不夠（44 根 K 線）。這個落差本身就是今天的一個結論，等一下會用數字說明。

這也是為什麼 Day 11 到 Day 14 的特徵全部建在成交資料上：那一層有完整歷史，回測時間夠長。OBI 是這一階段唯一受限於「從今天開始累積」的特徵。

## 工程實作

### 先訂介面，因為這是第一個特徵

今天要寫的是第一個「特徵」，而不是第三個「指標」。這兩個詞在這個專案裡是兩個型別，差別要講清楚。

Day 04 訂的 `Indicator` 是一個 ABC，契約是「吃 K 線的一個欄位、回一條等長的序列」。`compute()` 會先取出 `self.column`、轉成 `float64`、算完之後把名字貼上去，子類別只實作 `name` 與 `_compute`。那個共用實作是 ABC 存在的理由。

OBI 裝不進那個契約。它的輸入不是 K 線的某一欄，是掛單簿；而掛單簿的索引是不規則的，跟 K 線對不上。硬要塞進去，只有兩條路：破壞 `Indicator` 的契約，或在 OBI 裡繞過基底類別。兩種都比「它是另一種東西」糟。

所以有第二個介面，而它是 `Protocol` 而不是 ABC：

```python
# quantbot/domain/interfaces/feature.py
from typing import Protocol

import pandas as pd

from quantbot.domain.values.market_input import MarketInput
from quantbot.domain.values.market_view import MarketView


class Feature(Protocol):
    """一個特徵：吃一份市場原料，回傳一條與 K 線等長、index 相同的序列。

    它跟 Day 04 的 Indicator 是兩件不同的事，所以是兩個型別：

    - Indicator 是 ABC，因為它有共用實作要給子類別（檢查欄位、轉型、貼名字），
      而且它只吃 K 線的一個欄位。
    - Feature 是 Protocol，因為它的實作沒有共用骨架可分——從掛單簿算的、從逐筆
      成交算的、從 K 線算的，中間沒有一行程式碼是一樣的。

    介面在**第一個特徵出現的這一天**就訂死，不等到 Day 15 收斂時才回頭統一。
    Day 04 為三個指標訂 Indicator 時是同樣的判斷：中途改介面的成本是所有實作、
    所有測試、所有呼叫端一起改。

    required_inputs 是這個介面最重要的一條。它讓「這個特徵需要什麼資料」變成
    算之前就問得出來的事，Day 15 的管線因此可以在載入設定時就擋掉跑不起來的組合。
    """

    @property
    def name(self) -> str:
        """輸出序列的名字，慣例是 {feature}_{參數}。"""
        ...

    @property
    def warmup_bar_count(self) -> int:
        """前幾根不能用。整條特徵管線的暖機期是所有特徵裡最長的那一個。"""
        ...

    @property
    def required_inputs(self) -> frozenset[MarketInput]: ...

    def compute(self, view: MarketView) -> pd.Series: ...
```

這裡有一個刻意的選擇要交代：**介面在今天訂，不是留到 Day 15 才統一。** Day 15 的主題是把散落的東西收斂成一條管線，聽起來是訂介面的好時機。但 Day 04 已經走過這條路——當時三個指標的基底類別提前到第一個指標那天訂，理由是「中途改介面的成本是所有實作、所有測試、所有呼叫端一起改」。今天要寫五個特徵裡的第一個，同樣的判斷成立。

Day 15 要做的事因此變得更具體：註冊表、參數驗證、暖機期與快取、以及把 `Indicator` 接進來的轉接器。那些都是管線的事，不是介面的事。

### 原料收成一個值

特徵的輸入不能是「一堆參數」，否則每加一種資料就要改所有特徵的簽章。所以有一個值把原料裝起來：

```python
# quantbot/domain/values/market_view.py
@dataclass(frozen=True)
class MarketView:
    """一次特徵計算的所有原料。

    為什麼不是「每個特徵各自宣告要吃 DataFrame 還是 CandleSeries」：那樣的話每加
    一種資料，所有特徵的簽章都要跟著改一次。這裡把「有哪些資料」收成一個值，
    特徵的簽章就固定了，而它們用 require_* 取自己要的那份。

    K 線是必要的，因為它定義了**輸出的索引**。掛單簿與逐筆成交的索引是不規則的，
    要跟策略對得起來就必須對齊到某個共同的時間軸，而那個時間軸只能是 K 線。
    """

    candles: CandleSeries
    trades: TradeSeries | None = None
    depth: DepthSeries | None = None
```

`require_depth()` 那一段的行為值得單獨說明，因為它決定了 NaN 在這個專案裡的意思：

```python
# quantbot/domain/values/market_view.py
    def require_depth(self) -> DepthSeries:
        """缺掛單簿時丟 ValueError 而不是回空的。

        回空的話後面會算出一整欄 NaN，而 NaN 在這個系列裡的意思是「暖機期還沒到」。
        兩件事都用 NaN 表達，就再也分不出「資料沒錄到」與「資料還不夠」。
        """
        if self.depth is None or self.depth.is_empty():
            raise ValueError("這個特徵需要掛單簿深度摘要，但 MarketView 裡沒有")
        return self.depth
```

### OBI 本身

計算只有一行，但周圍有三個決定：

```python
# quantbot/domain/features/order_book_imbalance.py
class OrderBookImbalance:
    """買賣兩側的掛量差多少，壓成 −1 到 +1 的一個數字。實作 domain 的 Feature。

        OBI = (買方掛量 − 賣方掛量) / (買方掛量 + 賣方掛量)

    分母是兩側的總量，所以它是**比例**而不是差額。這件事很重要：直接用差額的話，
    同樣「買方多掛 10 BTC」在總掛量 20 BTC 的市場與 2000 BTC 的市場是完全不同的
    事件，而差額看不出差別。除以總量之後，值域固定在 −1 到 +1，不同交易對、
    不同時段之間才可比。

    兩個極端有明確意義：+1 是賣方一張單都沒有，−1 是買方一張單都沒有。

    depth_level 與 aggregation 都進名字，因為它們是兩個不同的特徵而不是同一個特徵
    的設定：前 5 檔與前 20 檔測的是不同深度的壓力，平均與收盤取樣測的是不同時點。
    """

    def __init__(
        self,
        depth_level: int = 5,
        *,
        aggregation: DepthAggregation = DepthAggregation.MEAN,
    ) -> None:
        if depth_level not in DepthColumns.LEVELS:
            raise ValueError(
                f"沒有錄前 {depth_level} 檔。錄下來的深度是 {DepthColumns.LEVELS}，"
                "而這是 schema 的一部分——換一個深度要重新錄，不是重算"
            )
        self.depth_level = depth_level
        self.aggregation = aggregation
```

那個建構檢查是 Day 09 那個「不可逆的決定」在程式碼裡的樣子。深度清單一旦錄成前 5／10／20 檔的加總，事後就再也算不出前 7 檔——原始的逐檔資料沒有被留下來。這種錯誤不該在算到一半才被發現，所以它在建構時就擋掉，而錯誤訊息要說清楚**代價是重錄不是重算**。

```python
# quantbot/domain/features/order_book_imbalance.py
    def ratio(self, depth: pd.DataFrame) -> pd.Series:
        """原始取樣頻率下的 OBI，不做任何聚合。

        驗證這個特徵有沒有預測力時要用這一個：它衰減得很快，先聚合到 K 線再驗，
        驗到的是「聚合之後還剩多少」，而不是這個特徵本身有多少。

        名字裡沒有 aggregation，因為這一層還沒有聚合。名字要說實話——
        叫它 obi_5_mean 會讓報告上兩個不同粒度的結果看起來像同一個東西。
        """
        bid = depth[DepthColumns.bid_quantity(self.depth_level)]
        ask = depth[DepthColumns.ask_quantity(self.depth_level)]
        total = bid + ask
        # 兩側都空的時候補 NaN 而不是 0：0 的意思是「兩側一樣多」，
        # 而「兩側都沒有掛單」是另一回事，那時候這個特徵沒有定義。
        return ((bid - ask) / total).where(total > 0).rename(f"obi_{self.depth_level}")
```

### 對齊：先算比例，再按 K 線聚合

掛單簿是每秒一筆，K 線是每分鐘一根，所以要壓。壓的順序有兩種寫法，而它們算出來的是不同的東西：

```python
# quantbot/domain/features/order_book_imbalance.py
    def aligned(self, view: MarketView) -> pd.Series:
        """先算比例、再按 K 線聚合。

        順序不能顛倒。先把兩側掛量平均起來、再算比例，算的是「這一分鐘的平均買方
        掛量對平均賣方掛量」，那是另一個量——比例的平均不等於平均的比例。兩種寫法
        都跑得出 −1 到 +1 的數字，也都畫得出圖，只有並排對數字才看得出差別。
        """
        depth = view.require_depth()
        timeframe = view.candles.instrument.timeframe
        resampled = self.ratio(depth.frame).resample(
            timeframe.pandas_frequency, label="left", closed="left"
        )
        return (
            resampled.mean()
            if self.aggregation is DepthAggregation.MEAN
            else resampled.last()
        )
```

差多少？用一根 1 分鐘 K 線、前 30 秒買 1 賣 9、後 30 秒買 90 賣 10 來算：

| 寫法 | 結果 |
|---|---|
| 比例的平均（正確） | 0.000 |
| 先平均掛量再算比例 | +0.654 |

一個說「這一分鐘兩邊力道相當」，一個說「這一分鐘買方明顯佔優」。兩個都落在 −1 到 +1 之間，畫出來的圖也都像 OBI。這是那種只有並排對數字才抓得到的錯誤，所以它是一個測試：

```python
def test_ratio_of_means_is_not_the_mean_of_ratios():
    """順序寫反不會報錯，也照樣落在 −1 到 +1，只有並排對數字才看得出來。

    這一根裡：前 30 秒買 1 賣 9（OBI = −0.8），後 30 秒買 90 賣 10（OBI = +0.8）。
    比例的平均是 0；先把掛量平均起來（買 45.5、賣 9.5）再算比例是 +0.654。
    """
    bid = [1.0] * 30 + [90.0] * 30
    ask = [9.0] * 30 + [10.0] * 30
    depth = make_depth(bid, ask)
    feature = OrderBookImbalance(5)
    view = MarketView(candles=make_candles(1), depth=depth)

    mean_of_ratios = feature.compute(view).iloc[0]

    averaged_bid = depth.frame[DepthColumns.bid_quantity(5)].mean()
    averaged_ask = depth.frame[DepthColumns.ask_quantity(5)].mean()
    ratio_of_means = (averaged_bid - averaged_ask) / (averaged_bid + averaged_ask)

    assert mean_of_ratios == pytest.approx(0.0)
    assert ratio_of_means == pytest.approx(0.654, abs=1e-3)
```

「平均」與「收盤取樣」也是兩個不同的特徵，不是同一個特徵的兩種設定，所以它們的名字不同（`obi_5_mean` 與 `obi_5_last`）：

```python
def test_mean_and_last_disagree_and_both_are_defensible():
    """一分鐘裡壓力翻面的話，平均與收盤取樣會給出相反的答案。"""
    bid = [1.0] * 30 + [9.0] * 30
    ask = [9.0] * 30 + [1.0] * 30
    view = MarketView(candles=make_candles(1), depth=make_depth(bid, ask))

    averaged = OrderBookImbalance(5, aggregation=DepthAggregation.MEAN).compute(view)
    latest = OrderBookImbalance(5, aggregation=DepthAggregation.LAST).compute(view)

    assert averaged.iloc[0] == pytest.approx(0.0)  # 前後抵銷
    assert latest.iloc[0] == pytest.approx(0.8)  # 只看最後一秒
```

## 這個特徵有沒有用：一套可以重複使用的檢查

到今天為止，這個系列驗證的都是「算得對不對」——跟對照組對數字、跟官方 K 線對帳。那些是**正確性**問題，有明確的對錯。

「這個特徵有沒有用」不是那種問題。它沒有標準答案，只有證據。所以需要一組工具，而且這組工具本身要先站得住。

### 三個數字，一個都不能少

```python
# quantbot/domain/services/predictive_power_service.py
class PredictivePowerService:
    """量一個特徵對未來報酬有沒有資訊。

    這是本系列第一個「判斷特徵值不值得用」的工具，而它要先擋掉兩件事：

    1. **未來函數。** 未來報酬一定是用 shift(-horizon) 往後看，而特徵是當下的值。
       兩者對齊錯一格，就會拿「當下的報酬」去解釋「當下的特徵」，相關係數會漂亮
       得不像話。這裡的對齊只寫在 forward_returns() 一份。
    2. **看起來有效其實是樣本太少。** 相關係數在小樣本上天生就會偏離 0，所以報告
       裡一定要有樣本數與 t 值，NEVER 只印一個相關係數。

    用 Spearman 而不是 Pearson：報酬的分布有厚尾，Pearson 會被幾個極端值主導。
    Spearman 只看排序，回答的是「特徵大的時候報酬是否傾向比較大」——這正是問題。
    """
```

報告裡有三種東西：

- **秩相關係數（IC）**：特徵的排序與未來報酬的排序有多一致。
- **t 值與樣本數**：那個相關係數跟 0 分不分得出來。
- **分組報酬**：把特徵值由低到高分成等量的幾組，各組的平均未來報酬。

第三項是前兩項補不了的。相關係數是一個線性摘要，它看不出「只有最極端的那一組有效、中間完全沒差」這種形狀，而那種形狀在交易上的意義完全不同。分組報酬如果**單調遞增**，這個特徵比較可能是真的有資訊；如果頭尾差很大但中間亂跳，通常表示那個差距來自少數幾個極端值。

### 未來函數：只有一個地方可以往未來看

```python
# quantbot/domain/services/predictive_power_service.py
    @staticmethod
    def forward_returns(
        prices: pd.Series, *, horizon: int, maximum_step: pd.Timedelta | None = None
    ) -> pd.Series:
        """往後 horizon 格的報酬率，對齊到「現在」這一格。

        shift(-horizon) 是這整套驗證唯一允許往未來看的地方，而它必須出現在
        被解釋的那一側（報酬），NEVER 出現在特徵那一側。特徵一旦偷看未來，
        後面所有數字都是假的，而且看起來會特別好。

        maximum_step 處理的是另一個問題：**shift() 只認得「第幾格」，不認得時間。**
        掛單簿的取樣是不規則的，而且錄製中斷過的話中間會有一段空白。那時候
        shift(-1) 會把空白前後的兩筆配成一對，於是一個「往後一秒」的報酬實際上
        跨了二十幾分鐘。這種列不多，但它們的報酬大得離譜，足以主導相關係數。

        給了 maximum_step 就把間隔過大的配對變成 NaN。這是 K 線不會遇到、
        而不規則取樣一定會遇到的事，所以它是參數而不是預設行為。
        """
        if horizon < 1:
            raise ValueError(f"horizon 必須 >= 1，收到 {horizon}")
        returns = prices.shift(-horizon) / prices - 1.0
        if maximum_step is not None:
            times = pd.Series(pd.DatetimeIndex(prices.index), index=prices.index)
            elapsed = times.shift(-horizon) - times
            returns = returns.where(elapsed <= maximum_step)
        return returns.rename(f"forward_{horizon}")
```

`maximum_step` 那一段不是預先想到的，是實跑撞到的。第一次跑分析時用的區間橫跨了兩段錄製，中間空了 22 分鐘。`shift(-1)` 不知道那件事，於是空白前的最後一筆跟空白後的第一筆被配成一對，那個「往後一秒的報酬」實際上是 22 分鐘的報酬——而且它的絕對值比正常的秒級報酬大幾百倍。一筆這種列就足以把相關係數帶偏。

這是 K 線資料不會遇到的問題：K 線每根等距，缺漏在 Day 08 就被偵測並補掉了。不規則取樣沒有這種保障，所以它需要一個時間上限：

```python
def test_forward_returns_drops_pairs_that_span_a_recording_gap():
    """shift() 只認得「第幾格」，不認得時間。

    這裡的第 2 與第 3 筆中間空了二十分鐘（錄製中斷）。沒有 maximum_step 的話，
    那一對會被當成「往後一筆」，於是一個一秒的報酬實際上跨了二十分鐘——
    而那種列的報酬大得離譜，足以主導整個相關係數。
    """
    index = pd.DatetimeIndex(
        [
            "2026-08-04T16:52:00Z",
            "2026-08-04T16:52:01Z",
            "2026-08-04T17:12:00Z",  # 中斷之後才回來
            "2026-08-04T17:12:01Z",
        ]
    )
    prices = pd.Series([100.0, 100.1, 130.0, 130.2], index=index, name="mid_price")

    without_bound = PredictivePowerService.forward_returns(prices, horizon=1)
    with_bound = PredictivePowerService.forward_returns(
        prices, horizon=1, maximum_step=pd.Timedelta(seconds=5)
    )

    assert without_bound.iloc[1] == pytest.approx(0.2987, abs=1e-4)  # 跨越空白
    assert pd.isna(with_bound.iloc[1])
    assert with_bound.iloc[0] == pytest.approx(0.001)  # 正常的那些不受影響
    assert with_bound.iloc[2] == pytest.approx(0.2 / 130.0)
```

### 不用 scipy 的 Spearman

用秩相關而不是一般的相關係數，理由是報酬的分布有厚尾——少數幾根極端的 K 線會主導 Pearson 相關係數，而我們要問的是「特徵大的時候報酬是否傾向比較大」，那是排序問題。

pandas 的 `corr(method="spearman")` 會轉去呼叫 scipy，而這個專案沒有那個依賴。與其為了一行相關係數多裝一整包，不如照定義寫：

```python
# quantbot/domain/services/predictive_power_service.py
    @staticmethod
    def rank_correlation(feature: pd.Series, forward: pd.Series) -> float:
        """Spearman 相關係數，用定義算：**先取排名，再算 Pearson**。

        pandas 的 corr(method="spearman") 會轉去呼叫 scipy，而這個專案沒有 scipy
        這個依賴。與其為了一行相關係數多裝一整包，不如照定義寫——Spearman 本來就
        是「排名上的 Pearson」，這樣寫出來的程式碼還比呼叫別人的更說明它在做什麼。

        rank() 預設用平均排名處理同分，跟 scipy 的預設一致。這件事對 OBI 很重要：
        它有大量的值落在 ±1（某一側被清空），同分處理方式不同會改變結果。
        """
        return float(feature.rank().corr(forward.rank()))
```

### 先驗這套工具本身

在拿工具去判斷特徵之前，工具自己要先過兩個測試。這兩個測試比任何一個特徵的結果都重要，因為之後所有「這個特徵沒用」的結論都建在它們上面：

```python
def test_a_feature_that_is_the_future_gets_a_perfect_score():
    """自我檢查：把未來報酬本身當特徵，IC 應該接近 1。

    這個測試在驗**驗證工具本身**。如果連這種極端情況都量不出高相關，
    那之後所有「這個特徵沒用」的結論都不能信——可能是工具壞了。
    """
    generator = np.random.default_rng(20260924)
    prices = series(100 * np.exp(np.cumsum(generator.normal(0, 0.001, 800))))
    forward = PredictivePowerService.forward_returns(prices, horizon=1)

    report = PredictivePowerService().evaluate(forward.rename("cheating"), forward)

    assert report.information_coefficient == pytest.approx(1.0)
    assert report.is_monotonic


def test_pure_noise_gets_an_information_coefficient_near_zero():
    generator = np.random.default_rng(7)
    prices = series(100 * np.exp(np.cumsum(generator.normal(0, 0.001, 2_000))))
    noise = series(generator.normal(0, 1, 2_000), name="noise")

    report = PredictivePowerService().evaluate(
        noise, PredictivePowerService.forward_returns(prices, horizon=5)
    )

    assert abs(report.information_coefficient) < 0.05
    assert abs(report.t_statistic) < 2.0  # 跟 0 分不出來
```

一個作弊的特徵要拿到滿分，一個純雜訊要拿到接近 0。兩端都對，中間的數字才有意義。

### 這份報告刻意沒有「通過」

前面幾天的報告（資料完整性、逐欄對帳）都有 `passed`，因為那些是對錯問題。這一份沒有：

```python
# quantbot/domain/dto/predictive_power_report.py
@dataclass(frozen=True)
class PredictivePowerReportDto:
    """一個特徵對未來報酬有沒有資訊，攤成幾個看得懂的數字。

    刻意不提供 passed 這種布林值。前面幾天的報告（資料完整性、逐欄對帳）可以有
    通過與不通過，因為那些是對錯問題。這裡不是——「IC 0.03 算不算有用」取決於
    交易成本、訊號頻率、部位大小，而那三件事到 Day 20 與 Day 24 才會定下來。
    現在給一個門檻，只會變成一個被拿去當結論的魔術數字。
    """
```

## 實際跑一次

錄 45 分鐘（Day 09 那支指令），然後：

```bash
uv run python -m quantbot.entrypoints.imbalance_power_command \
    --symbol BTC/USDT --market spot --timeframe 1m \
    --start 2026-08-04T17:20 --end 2026-08-04T18:05
```

```
  掛單簿取樣 2,508 筆，K 線 45 根

  原始取樣（每秒一筆，未來報酬用中間價）
    特徵                 往後       樣本       IC       t     頭尾差(bp)  分組報酬（bp）
    obi_5              1筆    2,507   0.4291   23.78        0.37   -0.21  -0.04   0.01   0.10   0.16 單調
    obi_5              5筆    2,503   0.3911   21.25        0.89   -0.49  -0.21   0.10   0.27   0.39 單調
    obi_5             30筆    2,478   0.1379    6.93        1.25   -0.83  -0.23   0.24   0.59   0.41
    obi_10             1筆    2,507   0.4258   23.55        0.37   -0.22  -0.04   0.01   0.10   0.16 單調
    obi_10             5筆    2,503   0.3884   21.08        0.89   -0.51  -0.19   0.07   0.31   0.38 單調
    obi_10            30筆    2,478   0.1352    6.79        1.28   -0.81  -0.18   0.09   0.60   0.48
    obi_20             1筆    2,507   0.4199   23.16        0.37   -0.21  -0.03   0.00   0.09   0.16 單調
    obi_20             5筆    2,503   0.3951   21.51        0.95   -0.53  -0.19   0.10   0.25   0.42 單調
    obi_20            30筆    2,478   0.1421    7.15        1.41   -0.75  -0.27   0.13   0.40   0.67 單調

  聚合到 K 線（未來報酬用收盤價）
    特徵                 往後       樣本       IC       t     頭尾差(bp)  分組報酬（bp）
    obi_5_mean         1根       44  -0.0932   -0.61       -2.04    1.19   0.21  -0.26  -0.69  -0.86
    obi_5_mean         3根       42  -0.0493   -0.31       -3.25    1.54  -2.98  -0.16   1.81  -1.71
    obi_10_mean        1根       44  -0.1063   -0.69       -2.12    1.27   0.13  -0.26  -0.69  -0.86
    obi_10_mean        3根       42  -0.0497   -0.31       -3.25    1.54  -2.98  -0.16   1.81  -1.71
    obi_20_mean        1根       44  -0.1170   -0.76       -2.25    1.50  -0.23   0.63  -1.46  -0.75
    obi_20_mean        3根       42  -0.0560   -0.35       -3.82    1.54  -3.01   0.12   2.20  -2.28
```

這張表有四件事可以讀出來，一件一件講。

### 一、在秒的尺度上，這個特徵有資訊

`obi_5` 對未來一筆取樣（約一秒）的秩相關是 **0.4291**，t 值 **23.78**，2,507 個配對。五組分位數的平均未來報酬是 −0.21、−0.04、0.01、0.10、0.16 個基點，**單調遞增**。

三個證據方向一致：相關係數不小、t 值遠離 2、分組報酬沒有中間亂跳。這不是一個模稜兩可的結果。

要對這個 0.43 保持一點警覺的地方在於，OBI 與中間價是從**同一張快照**算出來的。賣方前五檔只剩 0.04 BTC 的時候，那一檔很快會被吃掉，而下一秒的中間價因此往上——這個關聯有一部分是機械性的，不是「預測」了什麼新資訊。話說回來，這正是 OBI 這個特徵的定義：它量的就是「哪一側比較容易被吃穿」。所以數字是真的，只是它的意義比「能預測價格」窄得多。

### 二、它衰減得很快

同一個 `obi_5`，換三個時間跨度：

| 往後 | IC | t | 頭尾差（bp） |
|---|---|---|---|
| 1 筆（約 1 秒） | 0.4291 | 23.78 | 0.37 |
| 5 筆（約 5 秒） | 0.3911 | 21.25 | 0.89 |
| 30 筆（約 30 秒） | 0.1379 | 6.93 | 1.25 |

相關係數從 0.43 掉到 0.14，30 秒之後只剩三分之一。t 值還在 6.93，所以它沒有歸零，但**它是一個秒級的東西**。

有意思的是頭尾差往反方向走：0.37 → 0.89 → 1.25 個基點。時間拉長，能抓到的價差變大（價格有更多時間移動），但預測的準確度下降。這兩件事的取捨，到 Day 20 加上成本之後才有辦法算出哪邊划算。

### 三、深度取幾檔幾乎不影響結論

這是一個負面結果，但它省下很多時間：

| 深度 | 往後 1 筆的 IC |
|---|---|
| 前 5 檔 | 0.4291 |
| 前 10 檔 | 0.4258 |
| 前 20 檔 | 0.4199 |

三個差在小數第二位。原因不難理解：BTC/USDT 的價差是一個 tick，兩側最好的那幾檔本來就是主要的量，再往深處加十幾檔不會改變「哪一側比較薄」這個判斷。

這件事的實務意義是：**不要花時間調這個參數。** Day 09 錄了三個深度是為了回答這個問題，而答案是「不重要」。知道一個參數不重要，跟知道一個參數的最佳值一樣有價值——而且前者更穩定。

### 四、聚合到 1 分鐘之後，什麼都不剩

下半張表的相關係數是 −0.09 到 −0.12，t 值全部在 ±1 以內。

**這裡要非常小心不要過度解讀。** 負號看起來像是「聚合之後反向了」，但 t 值 −0.61 的意思是：這個數字跟 0 分不出來。它不是「反向」的證據，它是「沒有證據」。

而且樣本只有 44 根 K 線。45 分鐘的錄製只能產生 45 根 1 分鐘 K 線，分成五組之後每組不到 9 個。這種樣本量上的任何結論都不能信——包含「它沒用」這個結論在內。

正確的說法是兩句話：

1. 這 45 分鐘的資料**沒有能力回答**「OBI 聚合到 1 分鐘之後有沒有用」。要回答它得先錄幾天。
2. 但秒級那半張表的結論是穩的，而它已經足以說明一件事——把一個秒級特徵平均成分鐘級，等於把大部分資訊平均掉。第一段那三筆取樣（0.042、0.108、2.43 BTC）在一分鐘的平均裡完全看不見。

這也是 Day 09 那個「先想清楚要算什麼特徵，再決定存什麼」的另一半：不只是存什麼，還有**用什麼粒度用它**。

### 最後算一次帳

前面都在講統計。現在講一件更實際的事：那 0.37 個基點是多少錢。

一個基點是萬分之一。0.37 bp 在 63,900 USDT 的價位上是 **2.4 USDT**——這是最高組與最低組的平均未來報酬之差，也就是「完美地在 OBI 最高的時候做多、最低的時候做空」能抓到的每次價差。

對面是成本。Binance 現貨一般用戶的手續費是每邊 0.1%，也就是 10 個基點；來回 **20 個基點**。

| 項目 | 大小（bp） |
|---|---|
| OBI 前後五分之一組的報酬差（1 秒） | 0.37 |
| 同上（30 秒） | 1.25 |
| 買賣價差來回（0.01 USDT 對 63,900） | 0.0016 |
| 手續費來回（一般費率） | 20 |

價差幾乎可以忽略——BTC/USDT 現貨窄到只有 0.0016 個基點。真正的牆是手續費：它是那 0.37 個基點的 **54 倍**，就算用 30 秒那個較大的 1.25 個基點，也還差 16 倍。

所以今天的完整結論是：**這個特徵在統計上有資訊，而那個資訊在一般費率下換不到錢。**

這不是「白做工」。它有三個實際用途：

- 它可以當**過濾條件**而不是進場條件——不必自己賺到那 0.37 個基點，只要幫另一個訊號避開明顯不利的時刻就有價值。Day 16 會把「過濾」做成一種獨立的角色。
- 頻率不同結論就不同。掛單（maker）成交、費率折扣、或把持有時間拉長，都會改變這張表。那是 Day 20 的題目。
- **它是一個知道自己有多大的特徵。** 一個沒量過的特徵，看起來永遠比實際上有用。

Day 19 之後每一個回測結果都要標「試了幾個組合才得到這個」，而今天這張表是那條規矩的前身：先量清楚一個特徵的大小，再決定要不要把它放進策略。

## 視覺化

兩張圖並排在同一份輸出裡，因為它們回答兩個不同的問題：上格是「這個特徵長什麼樣子」，下格是「它有沒有用」。

```python
# quantbot/infrastructure/charting/plotly_imbalance_power_chart_renderer.py
class PlotlyImbalancePowerChartRenderer:
    """上格 OBI 與中間價疊圖，下格分組報酬長條圖。

    兩張圖回答的是兩個不同的問題，所以要並排在同一份輸出裡：上格回答「這個特徵
    長什麼樣子」（會不會一直貼在極值、有沒有明顯的躁動），下格回答「它有沒有用」。
    只看上格會誤以為一個劇烈擺動的序列一定有資訊。

    OBI 與價格的量級差了六個數量級，所以用左右雙軸而不是硬疊在同一軸上。
    """
```

下格的報酬用**基點**而不是原始的比例值，不然 y 軸刻度上全是 `0.0000`：

```python
# quantbot/infrastructure/charting/plotly_imbalance_power_chart_renderer.py
        for report in reports:
            figure.add_trace(
                go.Bar(
                    x=[
                        f"第 {index + 1} 組"
                        for index in range(len(report.bucket_mean_returns))
                    ],
                    # 報酬用基點（萬分之一）表示，不然刻度上全是 0.0000
                    y=[value * 10_000 for value in report.bucket_mean_returns],
                    name=f"往後 {report.horizon} 格",
                ),
                row=2,
                col=1,
            )
```

打開產出的 html，把上格的 OBI 曲線拉近看，會看到它幾乎沒有一段是平的——每一秒都在動，而且經常直接貼到 ±1。這正是「一個特徵劇烈擺動」與「一個特徵有預測力」是兩件事的畫面版本：那條線看起來充滿資訊，實際上能換到 0.37 個基點。

## 今日交付物

```
quantbot/
├── domain/
│   ├── values/
│   │   ├── market_input.py                     今天：三種原料
│   │   ├── market_view.py                      今天：特徵的輸入
│   │   └── depth_aggregation.py                今天：MEAN / LAST
│   ├── interfaces/feature.py                   今天：Feature Protocol
│   ├── features/order_book_imbalance.py        今天：OBI
│   ├── services/predictive_power_service.py    今天：預測力檢查
│   └── dto/
│       ├── predictive_power_report.py          今天（刻意沒有 passed）
│       └── imbalance_power_report.py           今天
├── application/
│   └── evaluate_imbalance_power_application.py 今天：兩種粒度各跑一次
├── infrastructure/
│   ├── charting/plotly_imbalance_power_chart_renderer.py   今天
│   └── reporting/text_imbalance_power_report_renderer.py   今天
├── entrypoints/imbalance_power_command.py      今天
└── tests/
    ├── domain/features/test_order_book_imbalance.py        今天
    └── domain/services/test_predictive_power_service.py    今天
```

### 驗收標準

六項全過才算完成：

1. `uv run pytest tests/domain/features/test_order_book_imbalance.py` 全綠，包含值域邊界（±1）、兩側都空回 NaN、尺度不變、沒錄的深度在建構時就被拒絕、以及「比例的平均 ≠ 平均的比例」那一個。
2. `uv run pytest tests/domain/services/test_predictive_power_service.py` 全綠。**最重要的是那兩個驗工具本身的測試**：作弊特徵的 IC 要接近 1、純雜訊的 |t| 要小於 2。這兩個不過的話，後面所有結論都不能信。
3. 樣本不足時 `evaluate()` 要丟 `ValueError` 而不是回一個數字。實測 20 分鐘的窗只有 8 根 K 線，它會拒絕分 5 組——這是預期行為。
4. 手上有 Day 09 錄的資料之後，`uv run python -m quantbot.entrypoints.imbalance_power_command --symbol BTC/USDT --market spot --timeframe 1m --start <錄製起點> --end <錄製終點>` 印出兩張表，原始取樣那一半的樣本數要接近取樣筆數。
5. 原始取樣的 IC 隨時間跨度遞減（1 筆 > 5 筆 > 30 筆），而三個深度的 IC 差在小數第二位。這兩個形狀是這份資料的結構，換一段錄製應該還在。
6. `uv run mypy quantbot` 與 `uv run lint-imports` 全過。特別確認 `domain/features/` 底下沒有 import 到 `asyncpg` 或 `plotly`——特徵是純計算，它不知道資料從哪來。

第 2 項與第 5 項是今天的重點。第 2 項守的是工具，第 5 項守的是「結論要有形狀，不只有一個數字」。

> 免責聲明：本文為程式與資料工程的技術分享，所有數字皆為教學範例，不構成投資建議；文中的相關係數與分組報酬取自 45 分鐘的單一樣本，NEVER 可推論為未來的表現。

## 明天

今天的特徵有一個很硬的限制：**它只有我們自己錄下來的那 45 分鐘。** 現貨的掛單簿歷史在免費資料源裡不存在，所以 OBI 沒辦法拿去驗證一年的資料。

明天換一邊。掛單可以撤，成交不能撤——成交是既成事實，而且它有完整的歷史（Day 09 那條 aggTrades 路徑一天七十幾萬列，要幾天有幾天）。

Day 11 從一個看起來很無聊的問題開始：**均價要用哪個。** 算術平均把成交 1 顆 BTC 跟成交 100 顆當成一樣重要，這顯然不對；用成交量加權之後得到的 VWAP 代表「市場的平均成本」，而「現在的價格對已經進場的人是賺還是賠」是一個跟均線完全不同的問題。

也會處理一個看起來只是實作細節、實際上會吃掉數值精度的地方：加權標準差如果照課本那條恆等式直接寫，在 BTC 的價位上會把 float64 的有效位數吃掉大半。

## Reference

- [`/api/v3/depth` 回傳的 `lastUpdateId` 與 Diff. Depth Stream 的 `U`／`u` 序號語意 — Binance Spot API Documentation, WebSocket Streams](https://developers.binance.com/docs/binance-spot-api-docs/web-socket-streams)
- [現貨一般用戶（VIP 0）的 maker／taker 費率各 0.1%，本文的 20 bp 來回成本由此計算 — Binance, Trading Fees](https://www.binance.com/en/fee/schedule)
- [Spearman 秩相關就是「排名上的 Pearson」，以及同分用平均排名處理的慣例 — pandas documentation, `Series.rank`](https://pandas.pydata.org/docs/reference/api/pandas.Series.rank.html)
- [`qcut` 做等量分組、`duplicates="drop"` 處理分位點重複 — pandas documentation, `qcut`](https://pandas.pydata.org/docs/reference/api/pandas.qcut.html)
