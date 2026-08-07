---
title: "Day 14：支撐壓力線可以不用手畫嗎？用 Volume Profile 自動找出籌碼密集區"
datetime: "2026-09-28"
description: "Volume Profile 換一個維度看成交量：不看時間軸，看價格軸上的分布。這篇實作 POC 與價值區間，並用同一天的 739,547 筆逐筆成交當對照組，量出「用 K 線近似」到底差多少——1 分鐘線的價值區間重疊 97.79%，1 小時線只剩 52.74%。結論不是「一定要用 tick」，而是知道哪一種粒度夠用。"
image: ""
parent: "2026 ithome-鐵人賽: 工程師的量化交易入門：從 K 線到可組合的交易策略引擎 系列"
draft: true
---

## 換一個軸來看成交量

Day 13 用的是「前 20 根最高價」——時間軸上的極值。它有一個很實際的問題：那個價位是**一根 K 線的高點**，也就是某一個瞬間曾經觸及的價格。價格在那裡待了 0.1 秒還是待了兩個小時，前高完全看不出來。

而「支撐壓力」這件事在意的正是後者。一個價位之所以擋得住價格，不是因為曾經有人在那裡成交過一次，是因為**有很多人在那裡成交**。那些人現在手上有部位，而部位會影響他們的行為。

所以換一個軸來看。到目前為止所有東西的 x 軸都是時間：K 線圖、均線、RSI、OBI，全部都是「時間 → 值」。今天把成交量放在**價格軸**上問一個不同的問題：

> 在 64,500 這個價位上總共成交了多少？65,000 呢？

答案是一張分布，而它的形狀就是籌碼分布。成交量堆積最多的價格是多數人的成本區，那裡自然形成支撐或壓力，而它不需要任何人手畫線。

今天要做兩件事。第一是實作這張分布與從它推導出的關鍵價位。第二件比較有意思：**Day 09 那條逐筆成交的路徑今天第一次真的被用來算特徵**，所以可以直接量「用 K 線近似」跟「用 tick 精算」差多少。這個問題的答案不是「當然要用 tick」，實測結果比那個有趣。

## 交易概念補課

### 支撐與壓力

「支撐」指價格跌到某個價位附近就停下來、往回走的傾向；「壓力」是反過來，漲到某個價位就上不去。

傳統畫法是在圖上找幾個轉折點，用直尺連起來。這個做法有一個工程上很難接受的性質：**它是主觀的**。同一張圖，十個人畫出十組線，而且沒有辦法驗證誰畫得對。要把它寫成程式，第一步不是「教電腦畫線」，是換一個不需要主觀判斷的定義。

### 籌碼密集區與 POC

換掉的定義是這樣：如果某個價位上成交了特別多的量，代表有特別多人的成本落在那裡。這種價位叫**籌碼密集區**。

價格回到密集區附近時會發生兩件事，方向相反但都會產生阻力：

- 套在那裡的人（現在虧損）看到接近解套，有出場的動機。
- 在那裡賺到的人（現在獲利）看到接近成本，有保護獲利的動機。

兩邊都在那個價位附近有行動的理由，所以成交量會變大、價格容易停頓。這不是預測，是對一群人處境的描述。

成交量最大的那一個價位叫 **POC（Point of Control）**。它是這張分布的眾數，也是「多數人的成本」最直接的近似。

### 價值區間

只有一個 POC 太粗，所以還要一個範圍：從 POC 往兩側擴張，直到涵蓋總成交量的某個比例（慣例是 70%），得到的範圍叫**價值區間（Value Area）**。

它的解讀是：這段區間內是市場「認可」的價格，區間之外是少數人的成交。價格在區間內震盪是常態，跑出區間則代表市場在重新定價。

70% 這個數字跟 RSI 的 14、超買的 70 一樣，是慣例不是定律。它的來源是「常態分布的一個標準差大約涵蓋 68%」這個粗略的類比，而市場的分布並不常態。所以它是一個約定，用它是為了跟別人算出來的數字對得上。

## 工程實作

### 它不是特徵，這件事有實際後果

前面九個東西全部實作 `Feature`，而 Volume Profile 不行。理由不是分類學上的講究：

```python
# quantbot/domain/values/volume_profile.py
@dataclass(frozen=True)
class VolumeProfile:
    """價格軸上的成交量分布，以及從它推導出的幾個關鍵價位。

    它跟前面所有特徵最大的不同是**它不是時間序列**。索引是價格（分桶之後的價格
    區間），值是那個價位上總共成交了多少。所以它 NEVER 實作 Feature 協定——
    Feature 的契約是「回傳一條與 K 線等長、index 相同的序列」，而這個東西的
    index 是價格。

    能進特徵管線的是**從它算出來的純量**（距離 POC 多遠、在不在價值區間裡），
    那是 Day 15 要處理的事。這個區分不是形式主義：一張分布沒辦法跟 K 線對齊，
    硬要塞進管線只會產生一張全是 NaN 的表。
    """

    volume_by_price: pd.Series
    value_area_fraction: float
```

「硬塞進管線會產生一張全是 NaN 的表」是很具體的後果：`pd.concat` 兩張索引不同的表時，pandas 不會報錯——它會把兩邊的索引聯集起來，然後在對不上的位置填 NaN。一張價格索引與一張時間索引的聯集，交集是空的，於是每一欄都有一半是 NaN，而那看起來很像「暖機期特別長」。

Day 10 訂 `Feature` 協定時把「回傳一條與 K 線等長、index 相同的序列」寫進契約，今天是那句話第一次擋掉東西。

### 價值區間：貪婪擴張，而且它不對稱

```python
# quantbot/domain/values/volume_profile.py
    @property
    def value_area(self) -> tuple[float, float]:
        """價值區間：從 POC 往兩側擴張，直到涵蓋 value_area_fraction 的成交量。

        擴張規則是每一步選「相鄰兩側裡成交量較大的那一格」。這是這個指標的傳統
        算法，而它有一個要知道的性質：**結果不一定對稱**，也不保證是全域最窄的
        區間。它是一個貪婪演算法，不是最佳化。

        用貪婪而不是「找最窄的區間」是刻意的：前者是業界通用的定義，換一個軟體
        算出來的數字對得起來；後者更「正確」但沒有人用，對不上任何人的圖。
        """
        volumes = self.volume_by_price.to_numpy(dtype="float64")
        prices = self.volume_by_price.index.to_numpy(dtype="float64")
        target = self.total_volume * self.value_area_fraction

        peak = int(np.argmax(volumes))
        lower, upper = peak, peak
        accumulated = volumes[peak]

        while accumulated < target and (lower > 0 or upper < len(volumes) - 1):
            below = volumes[lower - 1] if lower > 0 else -1.0
            above = volumes[upper + 1] if upper < len(volumes) - 1 else -1.0
            if above >= below:
                upper += 1
                accumulated += volumes[upper]
            else:
                lower -= 1
                accumulated += volumes[lower]

        return float(prices[lower]), float(prices[upper])
```

這裡有一個工程上值得停一下的選擇。「涵蓋 70% 成交量的最窄區間」是一個定義清楚的最佳化問題，可以解得比貪婪法更好。但業界通用的算法是貪婪法，所有看盤軟體算出來的價值區間都是貪婪法的結果。

選貪婪法的理由不是它比較好，是**它比較有用**：算出來的數字跟別人的圖對得上。一個更「正確」但跟所有人都不一樣的價值區間，在討論時反而是負債。同樣的判斷 Day 06 對 RSI 的 14 週期做過一次。

這個演算法有兩個性質要主動講出來，因為它們會讓人以為程式寫錯了：結果**不一定對稱**（POC 兩側的成交量分布不同），而且**不保證最窄**。把它釘成測試：

```python
def test_value_area_expands_from_the_peak_towards_the_larger_neighbour():
    """貪婪擴張：每一步選相鄰兩側裡成交量較大的那一格。

    這裡 POC 在 102（成交 10）。左邊是 4、右邊是 3，所以先往左；
    累積 14 已經超過 20 × 0.7 = 14，停下來。結果是不對稱的區間。
    """
    profile = VolumeProfile(
        volume_by_price=pd.Series(
            [1.0, 2.0, 4.0, 10.0, 3.0], index=[99.0, 100.0, 101.0, 102.0, 103.0]
        ),
        value_area_fraction=0.7,
    )

    low, high = profile.value_area

    assert profile.point_of_control == pytest.approx(102.0)
    assert (low, high) == (pytest.approx(101.0), pytest.approx(102.0))
```

還有一個測試守的是「不管形狀怎麼樣，涵蓋率至少要達標」——那是這個演算法唯一該保證的事：

```python
def test_value_area_covers_at_least_the_requested_fraction():
    ...
    assert volumes[inside].sum() >= profile.total_volume * 0.7
```

### 分桶：一行 histogram，沒有迴圈

```python
# quantbot/domain/services/volume_profile_service.py
    def _profile(self, prices: np.ndarray, volumes: np.ndarray) -> VolumeProfile:
        """分桶。用 np.histogram 的 weights 參數一次完成，沒有一行在遍歷資料。

        桶的邊界由資料的最高最低價決定，所以兩條路徑算出來的桶**不一定一樣**——
        逐筆成交的極值會比 K 線的高低價更極端嗎？不會，K 線的高低價就是那段時間
        的成交極值。所以邊界會一致，兩張分布才比較得起來。
        """
        if len(prices) == 0:
            raise ValueError("沒有資料可以做 profile")

        lowest, highest = float(prices.min()), float(prices.max())
        if lowest == highest:
            # 整段只有一個成交價：分布退化成一根柱子，硬分桶會讓邊界重疊
            return VolumeProfile(
                volume_by_price=pd.Series(
                    [float(volumes.sum())], index=[lowest], name="volume"
                ),
                value_area_fraction=self._value_area_fraction,
            )

        counts, edges = np.histogram(
            prices, bins=self._bucket_count, range=(lowest, highest), weights=volumes
        )
        # 用每個桶的中心價當索引，不用邊界：中心價才是那一桶代表的價位
        centres = (edges[:-1] + edges[1:]) / 2.0
        return VolumeProfile(
            volume_by_price=pd.Series(counts, index=centres, name="volume"),
            value_area_fraction=self._value_area_fraction,
        )
```

`np.histogram` 的 `weights` 參數是這裡的關鍵：不加 weights 它數的是「有幾筆成交落在這個價格區間」，加了 weights 它加總的是「那些成交的量」。兩者是不同的分布——前者是筆數 profile，後者是成交量 profile，而 Day 09 那兩根 K 線已經示範過筆數與量會分家。

七十四萬筆成交丟進去，一行完成，沒有任何迴圈。

### 兩條路徑，兩種假設

```python
# quantbot/domain/services/volume_profile_service.py
class VolumeProfileService:
    """把成交量按價格分桶，做出價格軸上的分布。

    兩條路徑，因為兩種資料都拿得到，而它們的差別是這一天的重點：

    - from_trades：**精算**。每一筆成交都知道自己的價格，直接丟進對應的價格桶。
    - from_candles：**近似**。一根 K 線只有四個價格與一個總量，所以必須假設那個量
      在某個價格上（或某個範圍內）。假設不同，畫出來的分布就不同。

    近似的誤差不是小數點後幾位的問題。一根 1 分鐘 K 線的成交散落在整個高低範圍裡，
    而近似法把它全部塞在一個點上，於是分布會出現實際上不存在的尖峰。這一天要做的
    就是把那個差距量出來。
    """
```

精算那條沒有任何自由度：每一筆成交都知道自己的價格。近似那條有一個必須做的假設：

```python
# quantbot/domain/services/volume_profile_service.py
    def from_candles(self, candles: CandleSeries) -> VolumeProfile:
        """用 K 線近似。把每一根的成交量整份放在它的典型價上。

        典型價 (高 + 低 + 收) / 3 是慣例，但**放在哪裡都是猜的**。其他常見的選擇
        是收盤價、或是把量平均攤在高低之間。三種都會產生不同的分布，而沒有哪一種
        能還原真相——真相在逐筆成交裡。

        這個方法存在的理由是實務的：逐筆成交一天七十幾萬列，要算一年的 profile
        得處理兩億多列；K 線一年五十幾萬根。所以近似法會被用，而用它的人應該知道
        自己放棄了什麼。
        """
```

「一年兩億多列」不是誇飾：Day 09 量到一天 739,547 列，乘 365 是 2.7 億。而一年的 1 分鐘 K 線是 525,600 根，差了 500 倍。所以近似法一定會被用，問題只是用的人知不知道代價。

### 距離 POC：能進管線的那個純量

分布進不了管線，但從它算出來的距離可以：

```python
# quantbot/domain/features/distance_to_point_of_control.py
class DistanceToPointOfControl:
    """現在的價格離 POC 多遠，以 POC 的百分比表示。實作 domain 的 Feature。

    Volume Profile 本身進不了特徵管線——它的 index 是價格，跟 K 線對不齊。能進管線
    的是**從它算出來的純量**，而這是最有用的那一個：價格相對於籌碼密集區的位置。

    滾動視窗的部分要小心：每一根 K 線的 POC 都必須只用**那根之前**的資料算。用整段
    資料算一個 POC 再套到每一根上，就是 Day 12 那個鐘點基準的錯誤換一種形狀——
    在 2025 年 3 月那一根上，POC 裡含著 2026 年的成交。

    代價是它算得慢：每一根都要重算一次分布。所以視窗用「天」而不是「根」來表達，
    而且預設值刻意保守。這是這一階段第一個**不能向量化**的特徵，理由跟 Day 05 的
    EMA 不同——EMA 是遞迴，這個是每一步的輸入集合都不一樣。
    """
```

「不能向量化」在這個系列裡是一件要交代清楚的事，因為全系列的規矩是 NEVER 用 for loop 遍歷 K 線。這裡有兩種不能向量化的理由，而它們不一樣：

- Day 05 的 EMA 是**遞迴**：第 i 個值依賴第 i−1 個值。這種情況有 `ewm()` 這類專門的向量化實作，或者用 Numba（Day 26）。
- 這裡是**每一步的輸入集合都不同**：第 i 根要對「第 i 根之前一天的所有 K 線」做一次分桶。這不是遞迴，也沒有哪個 pandas 函式做得到，因為 `rolling().apply()` 也是逐窗呼叫。

判準還是那一條：這個迴圈跑幾次、有沒有向量化的替代品。這裡沒有替代品，而且它是離線分析用的特徵，不在即時路徑上，所以慢是可以接受的。

未來函數那一段照 Day 12 的模式處理：

```python
# quantbot/domain/features/distance_to_point_of_control.py
    def _distance_at(
        self,
        candles: CandleSeries,
        moment: pd.Timestamp,
        window: pd.Timedelta,
        close: float,
    ) -> float:
        """這一根的距離。視窗是 [moment − window, moment)，**右端開區間排除當根**。"""
        times = candles.open_times
        selected = (times >= moment - window) & (times < moment)
        history = candles.frame.loc[selected]
        if history.empty:
            return float("nan")

        profile = self._service.from_candles(CandleSeries(candles.instrument, history))
        point_of_control = profile.point_of_control
        return (close - point_of_control) / point_of_control
```

測試用一段很極端的資料，讓錯誤版本無處可躲：

```python
def test_the_window_excludes_the_current_bar():
    """每一根的 POC 只能用那根之前的資料算。

    用整段資料算一個 POC 再套到每一根上，是 Day 12 那個鐘點基準的錯誤換一種形狀。
    這裡的資料是：前 24 小時都成交在 100，第 25 根跳到 200。第 25 根的距離必須是
    +100%（相對於它之前的 POC 100），而不是 0%（相對於含它自己的 POC）。
    """
    closes = [100.0] * 24 + [200.0]
    view = make_view(closes)

    distance = DistanceToPointOfControl(window_days=1).compute(view)

    assert distance.iloc[-1] == pytest.approx(1.0)
```

## 陷阱與驗證：近似到底差多少

這是今天最有價值的一節，因為它回答一個實際的取捨問題，而答案跟直覺不同。

```bash
uv run python -m quantbot.entrypoints.volume_profile_command \
    --symbol BTC/USDT --market spot --start 2026-07-15 --end 2026-07-16
```

```
spot_BTCUSDT：K 線 1,440 根、逐筆成交 739,547 列，100 個價格桶

[逐筆精算]
  POC                65,003.48
  價值區間上緣       65,126.12
  價值區間下緣       64,579.77
  總成交量          18,401.897 BTC

[K 線近似]
  POC                65,018.58
  價值區間上緣       65,114.06
  價值區間下緣       64,562.40
  總成交量          18,401.897 BTC

兩者差距
  POC 相差             0.0232%
  價值區間重疊          97.79%
```

先看一個健康檢查：**兩邊的總成交量完全一樣**（18,401.897 BTC）。這是應該的——同一段時間的成交量就是那麼多，只是被分配到不同的價格桶。如果這兩個數字不一樣，那不是近似誤差，是有一邊算漏了。

然後是真正的結果：**POC 只差 0.0232%（15.1 USDT），價值區間重疊 97.79%。**

這跟直覺不太一樣。近似法把整根 K 線的成交量塞在一個價格上，聽起來很粗暴，而它的結果幾乎跟精算一樣。原因是 1 分鐘 K 線很窄：一根 1 分鐘 K 線的高低範圍在 BTC 上通常是十幾二十 USDT，而一整天的價格範圍是好幾百。**假設的誤差只有一根 K 線的寬度，而分桶的粒度是整天範圍的百分之一**，兩者量級相當，所以誤差被分桶本身吸收掉了。

這個解釋馬上給出一個可以驗證的預測：**K 線越粗，近似越差。** 換 timeframe 跑三次：

| timeframe | K 線根數 | POC 相差 | 價值區間重疊 |
|---|---|---|---|
| 1m | 1,440 | 0.0232% | 97.79% |
| 5m | 288 | 0.0712% | 89.71% |
| 1h | 24 | 0.2956% | 52.74% |

三次都用同一天、同一份逐筆成交當對照組，只換 K 線的粒度。誤差單調增加，而 1 小時線的價值區間**只重疊一半**。

所以今天的實務結論不是「一定要用 tick」，是一句更有用的話：

> 用 1 分鐘 K 線做 Volume Profile 夠準；用小時線不夠。

這件事的價值在於它把一個「要不要花力氣處理兩億列資料」的問題，變成一個有數字支撐的決定。一年的 1 分鐘 K 線是 52 萬列，處理起來不痛；一年的逐筆成交是 2.7 億列。如果 1 分鐘的近似誤差是 0.02%，那 500 倍的資料量換到的東西太少。

反過來也要講清楚**什麼時候需要精算**：

- 粒度只有小時線可用的時候（重疊率 52.74%，那不是誤差，是另一張圖）。
- 需要「筆數 profile」而不是「成交量 profile」的時候——K 線的 12 欄有 `trade_count`，但那是整根的總數，沒辦法按價格拆開。
- 需要區分主動買與主動賣的 profile（有時候叫 delta profile）的時候。K 線的 `taker_buy_base_volume` 同樣是整根的總量。

也就是說近似法的限制不在「準不準」，在「它只能算成交量這一個維度」。要拆維度就得回到逐筆成交，而那條路徑 Day 09 已經鋪好了。

把兩條路徑的差異釘成一個小測試，用最極端的情況讓差距明顯：

```python
def test_the_two_paths_disagree_on_where_the_volume_sits():
    """同一段行情，精算與近似算出來的 POC 不一樣——這是這一天的重點。

    逐筆成交：大部分的量成交在 90 附近。
    K 線近似：那一根的典型價是 100，於是整份量被記在 100。
    """
    trades = make_trades(prices=[90.0] * 9 + [110.0], quantities=[1.0] * 9 + [1.0])
    candles = make_candles(highs=[110.0], lows=[90.0], closes=[100.0], volumes=[10.0])
    service = VolumeProfileService(bucket_count=5)

    exact = service.from_trades(trades)
    approximate = service.from_candles(candles)

    assert exact.total_volume == pytest.approx(approximate.total_volume)
    assert exact.point_of_control == pytest.approx(92.0)
    assert approximate.point_of_control == pytest.approx(100.0)
```

一根 K 線裡九成的量成交在 90，但典型價是 100，於是近似法把 POC 放在 100——一個實際上只成交了一筆的價位。這是那 0.0232% 在最壞情況下的樣子，而它在真實資料上被大量 K 線平均掉了。

### 距離 POC 的實際數字

同一天的滾動 1 天 POC：

```
距離 POC（滾動 1 天，可用 1,439 根）
  最後一根            -0.4034%
  絕對值中位數         0.1776%
```

絕對值中位數 0.1776% 的意思是：一半的時間裡，價格離籌碼密集區不到 0.18%。這個數字本身就說明了 POC 是一個「價格會回來」的價位——不是因為它有魔力，是因為那裡本來就是成交最集中的地方，而成交集中的地方價格待得久。

這也提醒一件事：**這個特徵的值很小。** 0.18% 對照 Day 10 算的手續費（來回 20 個基點 = 0.2%），量級相當。一個「離 POC 超過 0.18% 就進場」的規則，抓到的幅度跟成本一樣大。這種比較 Day 20 會系統性地做一次，今天先建立習慣：算出一個特徵的典型幅度之後，順手跟成本比一下。

## 視覺化：橫的長條圖不只是好看

```python
# quantbot/infrastructure/charting/plotly_volume_profile_chart_renderer.py
class PlotlyVolumeProfileChartRenderer:
    """左邊 K 線，右邊橫向的成交量分布，共用同一條價格軸。

    橫向長條圖是這個指標的傳統畫法，而它不只是美觀：**分布的 y 軸就是 K 線的 y 軸**，
    所以「POC 在哪個價位」可以直接用眼睛連到左邊的 K 線上。畫成一般的直立長條圖
    （x 軸是價格）就得在腦中轉九十度，而那一步很容易看錯。

    兩張 profile 疊在同一格：精算的實心、近似的外框。要看的是它們的**形狀差異**，
    分成兩格就得靠眼睛在兩邊來回對價位。
    """
```

`shared_yaxes=True` 是這張圖的關鍵設定：兩格共用價格軸，所以右邊分布的尖峰跟左邊 K 線的價位是對齊的，用眼睛連過去就行。

三條水平線畫在 K 線那一格而不是分布那一格：

```python
# quantbot/infrastructure/charting/plotly_volume_profile_chart_renderer.py
        # 三條水平線畫在 K 線那一格：POC 與價值區間上下緣才是要拿去用的價位
        levels = exact.key_levels()
        for key, dash in (
            ("point_of_control", "solid"),
            ("value_area_high", "dash"),
            ("value_area_low", "dash"),
        ):
            figure.add_hline(
                y=levels[key],
                line_dash=dash,
                line_color=self.EXACT_COLOR,
                line_width=1.2,
                annotation_text=f"{key} {levels[key]:,.0f}",
                annotation_position="right",
                row=1,
                col=1,
            )
```

打開產出的 html，把 1 分鐘那張跟 1 小時那張並排開兩個分頁：1 分鐘那張的兩條分布幾乎完全重合；1 小時那張的橘色（近似）會出現幾根很突出的柱子，而藍色（精算）是平滑的。那幾根突出的柱子就是「24 根 K 線的量各自被塞在一個價格上」的樣子——一天只有 24 個典型價，所以分布最多只有 24 個非零的桶，而精算那張有將近一百個。

這張圖也是「近似法放棄了什麼」最直觀的呈現：它不是把分布算得偏一點，是把一條連續的分布打散成幾根釘子。

## 今日交付物

```
quantbot/
├── domain/
│   ├── values/volume_profile.py                今天：POC ＋ 價值區間（不是 Feature）
│   ├── services/volume_profile_service.py      今天：精算與近似兩條路徑
│   ├── features/
│   │   └── distance_to_point_of_control.py     今天：能進管線的那個純量
│   └── dto/volume_profile_report.py            今天：兩張並排的差距
├── application/
│   └── compare_volume_profiles_application.py  今天
├── infrastructure/charting/
│   └── plotly_volume_profile_chart_renderer.py 今天
├── entrypoints/volume_profile_command.py       今天
└── tests/
    ├── domain/services/test_volume_profile_service.py          今天
    └── domain/features/test_distance_to_point_of_control.py    今天
```

### 驗收標準

七項全過才算完成：

1. `uv run pytest tests/domain/services/test_volume_profile_service.py` 全綠，包含價值區間的貪婪擴張、涵蓋率下限、單一成交價的退化情況、以及兩條路徑不一致那個測試。
2. `uv run pytest tests/domain/features/test_distance_to_point_of_control.py` 全綠，尤其「視窗排除當根」那一個。
3. 手上有 2026-07-15 的逐筆成交（Day 09 補過）之後，`uv run python -m quantbot.entrypoints.volume_profile_command --symbol BTC/USDT --market spot --start 2026-07-15 --end 2026-07-16` 印出兩張 profile 的關鍵價位與差距。
4. **兩條路徑的總成交量必須完全相同。** 不一樣的話不是近似誤差，是有一邊算漏了資料。
5. 換 `--timeframe 5m` 與 `--timeframe 1h` 再各跑一次：價值區間重疊率要單調下降（實測 97.79% → 89.71% → 52.74%）。這個趨勢是這一天的主要結論，換一段資料方向應該不變。
6. 打開 `notebooks/day14-spot_BTCUSDT_1m-profile.html`：右邊的分布與左邊的 K 線共用價格軸，POC 那條實線穿過分布最寬的位置；1 小時那張的近似分布明顯變成幾根釘子。
7. `uv run mypy quantbot` 與 `uv run lint-imports` 全過。

第 5 項是今天真正的產出。單一個「差 0.02%」只是一個數字，三個粒度排起來才是一個可以拿去做決定的關係。

> 免責聲明：本文為程式與資料工程的技術分享，所有數字皆為教學範例，不構成投資建議；POC 與價值區間是對已發生成交的描述，不預測後續走勢。

## 明天

第二階段到今天為止做出了八個東西：Day 04–06 的三個指標（SMA、EMA、RSI），加上這一階段的 OBI、VWAP 與偏離度、活躍度與 ATR、前高與突破與流動性擺盪、以及今天的 Volume Profile 與距離 POC。

它們現在的狀態很像一個工具箱被翻倒在地上：每一個都能用，但要一起用得自己動手串。而它們的形狀差異比看起來大：

- 有的只吃 K 線，有的要逐筆成交，有的三種都要。
- 暖機期從 0 到「window × 一天幾根」都有，而且有兩個特徵算不出精確的暖機根數。
- 有的是連續值，有的是 0 與 1 的事件。
- 有一個根本不是時間序列（Volume Profile），只有從它算出來的純量能用。

明天 Day 15 把它們收成一條管線：一份設定就能算出所有特徵、暖機期自動處理、缺原料在載入設定時就報錯、同一份資料同樣參數不重算。

這一天的產出會直接變成第三階段的原料——Day 16 的策略積木會用字串去特徵註冊表取東西，使用者寫設定檔時才不必碰 Python。所以介面要在明天訂死，再往後改成本很高。

## Reference

- [`np.histogram` 的 `weights` 參數：不加是數筆數，加了是加總權重 — NumPy documentation, `numpy.histogram`](https://numpy.org/doc/stable/reference/generated/numpy.histogram.html)
- [官方 K 線的 12 個欄位（`trade_count` 與 `taker_buy_base_volume` 都是整根的總量，無法按價格拆開） — Binance Spot API Documentation, Market Data Endpoints](https://developers.binance.com/docs/binance-spot-api-docs/rest-api/market-data-endpoints)
- [`pd.concat` 在索引對不上時會取聯集並填 NaN，而不是報錯 — pandas documentation, Merge, join, concatenate](https://pandas.pydata.org/docs/user_guide/merging.html)
- [`make_subplots` 的 `shared_yaxes`，讓兩格共用價格軸 — Plotly documentation, Subplots](https://plotly.com/python/subplots/)
