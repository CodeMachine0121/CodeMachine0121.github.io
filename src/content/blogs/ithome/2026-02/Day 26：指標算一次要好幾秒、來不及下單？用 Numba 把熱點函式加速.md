---
title: "Day 26：指標算一次要好幾秒、來不及下單？用 Numba 把熱點函式加速"
datetime: "2026-10-10"
description: "先量測再優化。cProfile 說最慢的特徵有七成時間花在「每一根重建一次驗證過的 entity」，而全專案最顯眼的那個 Python for 迴圈每次只要 0.45 毫秒。三步下來 19.21 秒變成 0.0086 秒（2,237 倍），其中 82.6 倍完全沒用到編譯器。順帶記錄兩件事：讓數值逐根相同要複製 numpy 的運算順序，以及 Timedelta.value 一律回奈秒這個不會報錯的陷阱。"
image: ""
parent: "2026 ithome-鐵人賽: 工程師的量化交易入門：從 K 線到可組合的交易策略引擎 系列"
draft: true
---

## Day 05 留下的那個尾巴

Day 05 寫 EMA 的時候留了一句話：遞迴指標沒辦法向量化，因為每一根都依賴前一根的結果。那時候用 `ewm()` 繞過去了，而繞過去的意思是「pandas 幫我們在 C 裡跑那個迴圈」。

Day 14 沒有這種好運。Volume Profile 的距離特徵每一根都要重算一次分布，而它的困難跟 EMA 不同——EMA 是遞迴，這個是**每一步的輸入集合都不一樣**。那天的文章寫下了一句「它算得慢」，然後就往下走了。

今天回來收這筆帳。而在動手之前，先講清楚順序。

## 交易概念補課：延遲對不同策略的意義

「來不及下單」對不同頻率的策略是完全不同的事。

日線策略慢三秒沒有任何影響——訊號在收盤後產生，而下一根要等 24 小時。分鐘級策略慢三秒可能整個訊號就沒了：那三秒裡價格已經移動過，我們用的是一個過期的判斷。掛單簿層級的策略（Day 10 那種）慢三十毫秒就出局。

所以第一個問題不是「怎麼加速」，是**「這個策略需不需要這個加速」**。本系列的三個策略都跑 1 小時 K 線，訊號在收盤後產生，下一根一小時後才成交——十九秒完全來不及變成一個問題。

那為什麼還要優化？因為有一個地方會痛：**研究迴圈**。Day 21 的組合搜尋要跑 44 個組合，Day 24 的下注比較跑 4 種，換一段時間再跑一次。一個要十九秒的特徵在這種路徑上會被乘上幾十倍，而研究速度直接決定一天能問幾個問題。

## 先量測

不猜。跑一次 `cProfile`：

```
distance_to_poc_5d：49.713 秒（13,848 根）
   205,588,415 function calls in 49.713 seconds

   ncalls  tottime  cumtime  filename:lineno(function)
        1    0.064   49.713  distance_to_point_of_control.py:50(compute)
    13848    0.153   49.642  distance_to_point_of_control.py:63(_distance_at)
    13847    0.019   34.806  candle_series.py:20(__init__)
    13847    0.215   34.788  candle_columns.py:34(conform)
   124623    0.324   22.839  pandas/core/frame.py:4559(__setitem__)
    13847    0.082   11.229  volume_profile_service.py:47(from_candles)
   166164    0.078    8.158  pandas/_config/config.py:143(get_option)
```

先講一件關於工具的事：**49.7 秒是在 profiler 下面量到的，不開 profiler 是 19.2 秒。** cProfile 對每一次函式呼叫都要記帳，而這段程式碼呼叫了兩億次函式，所以它的額外成本超過一倍。這代表 cProfile 給的是**比例**而不是絕對值——找熱點很好用，量絕對速度要用 `time.perf_counter()`。

然後是那份比例。慢的地方不是計算：

**`CandleSeries.__init__` 佔了 34.8 秒，七成。** 那是 entity 的建構——欄位檢查、型別轉換、DataFrame 複製。原本的實作每一根都重建一次一個驗證過的 `CandleSeries`，只為了把它交給 `VolumeProfileService`。13,847 次建構。

**真正在算的 `from_candles` 只佔 11.2 秒。** 而它裡面的 `np.histogram` 是 C 實作的。

**`pandas.get_option` 被呼叫了 166,164 次，花了 8.2 秒。** 那是 pandas 內部讀設定，完全不是我們寫的程式碼——但它是我們每一根都建一個 DataFrame 的後果。

換句話說：**這段程式碼慢的原因是設計，不是計算。** 而編譯器解決不了設計問題。

## 想像中的熱點不是熱點

在跑 profiler 之前，最像熱點的是這一段：

```python
# quantbot/domain/services/performance_metrics_service.py
    def longest_drawdown_bars(self, equity: pd.Series) -> int:
        ...
        longest = 0
        current = 0
        for peaked in at_peak.to_numpy():
            current = 0 if peaked else current + 1
            longest = max(longest, current)
        return longest
```

它是全專案最顯眼的一個 Python `for` 迴圈，而且它真的在遍歷每一根 K 線——正是這個系列從 Day 04 就在說不要做的事。

量出來的結果：

```
對照：longest_drawdown_bars 的 Python 迴圈（13,848 根）每次 0.457 毫秒，值 7157
→ 它是全專案最明顯的一個 for 迴圈，而它不是熱點。不動它。
```

**0.457 毫秒。** 那個看起來最該被優化的東西，成本是那個看起來沒問題的東西的四萬分之一。

所以今天的產出之一是一個「不動」。這條迴圈留在那裡，而它旁邊沒有註解說「這裡很慢」——因為它不慢，寫一句不實的註解比不寫更糟。

順帶一提，`ewm()` 那條路也一樣：EMA 與 RSI 的 Wilder 平滑在 profiler 上根本進不了前二十名，因為 pandas 的 `ewm` 已經是 C 裡的迴圈。Day 05 那個「不能向量化」的煩惱在效能上其實不存在，它只是一個關於**寫法**的問題。

## 第一步：拿掉設計上的浪費

第一版的修法完全沒有用到編譯器。做三件事：把典型價與成交量在整段上算一次、視窗改用二分搜尋、histogram 直接吃 numpy 切片。

```python
# quantbot/entrypoints/benchmark_command.py（對照組，NEVER 進正式路徑）
def numpy_only_distance_to_point_of_control(
    candles: CandleSeries, *, window_days: int, service: VolumeProfileService
) -> pd.Series:
    """不重建 entity、視窗用 searchsorted，但每一根還是呼叫一次 np.histogram。

    它是三步裡的第二步，也是本檔存在的主要理由：**光是拿掉設計上的浪費就有 83 倍**，
    而那一步完全沒有用到編譯器。
    """
```

`searchsorted` 那一段值得單獨講。原本每一根都做一次 `(times >= moment - window) & (times < moment)`，那是兩次全長度的比較加一次布林運算——每一根 O(n)，整段 O(n²)。時間軸是排序過的，所以同一件事是一次二分搜尋：

```python
# quantbot/domain/features/distance_to_point_of_control.py
    def _window_starts(self, index: pd.DatetimeIndex) -> npt.NDArray[np.int64]:
        """每一根的視窗從第幾根開始。時間軸是排序過的，所以這是一次二分搜尋。

        單位換算是這裡唯一的陷阱，而它不會報錯：`pd.Timedelta.value` **一律回奈秒**，
        而這個索引的單位是微秒（Day 09 那次毫秒到微秒的分界留下來的）。用 `.value`
        當偏移量會讓五天的視窗變成五千天，而結果照樣是一堆看起來很合理的數字。
        所以偏移量用兩個 Timedelta 相除算出來——那個除法會處理單位。
        """
        stamps = index.astype("int64").to_numpy()
        offset = pd.Timedelta(days=self.window_days) // pd.Timedelta(1, unit=index.unit)
```

那個單位陷阱是實作到一半才發現的，而發現的方式是對照組：新版跟舊版有 13,689 根不一樣，最大差 0.4。0.4 不是浮點誤差，是**演算法不同**。查下去才看到 `pd.Timedelta(days=5).value` 回的是 `432000000000000`（奈秒），而索引的單位是微秒，所以 `stamps - offset` 往前跳了五千天——視窗變成「從資料的開頭到現在」。

它不會報錯，算出來的每一個數字都在合理範圍內。Day 09 那次毫秒到微秒的分界留下的影響，在一年之後用這種方式回來了一次。

## 第二步：把剩下的迴圈交給 Numba

拿掉浪費之後剩下的是一個真正必要的迴圈：每一根都要在它自己的視窗上重算一次分布。這個迴圈沒有辦法用 numpy 廣播消掉，因為每一步的輸入集合不同、而且每一步的桶邊界取決於那個視窗自己的最高最低價。

```python
# quantbot/domain/features/distance_to_point_of_control.py
@njit(cache=True)
def _rolling_distance_to_point_of_control(
    typical_prices: npt.NDArray[np.float64],
    volumes: npt.NDArray[np.float64],
    closes: npt.NDArray[np.float64],
    window_starts: npt.NDArray[np.int64],
    bucket_count: int,
) -> npt.NDArray[np.float64]:
    """每一根的「離 POC 多遠」，一次算完。

    這是全專案唯一一個 `@njit` 的函式，而它是模組層級的普通函式而不是方法，
    因為 Numba 編譯不了 `self`。這是「計算行為掛在物件的方法上」那條規矩的第三個
    例外（前兩個是 entrypoints 的 main 與示範錯誤寫法的對照程式碼），
    而界線是：**它是私有的，唯一的入口是下面那個類別的 compute()。**
    """
```

Numba 的四個限制在這裡都碰到了，值得列出來：

**它編譯不了 `self`。** 所以核心必須是一個普通函式。這跟這個專案「計算行為掛在物件的方法上」那條規矩衝突，而解法是把它當成一個私有的實作細節：函式名前綴 `_`，外面包一個類別，`compute()` 是唯一的入口。

**它不吃 pandas 物件。** `Series`、`DataFrame`、`DatetimeIndex` 一個都不能進去。所以邊界很清楚：pandas 的東西在類別裡拆成 `ndarray`，核心只認 numpy。

**型別要穩定。** 迴圈裡的變數不能有時是 `float` 有時是 `int`。這一點在寫的時候幾乎感覺不到，因為 Python 平常允許，而 Numba 會在編譯期就抱怨。

**`cache=True` 要記得加。** 沒有它的話每次啟動都要重新編譯一次，而編譯要半秒——一個每小時醒來一次的機器人會為此付掉每天十二秒。實測三個數字：

| 情況 | 秒 |
|---|---|
| 第一次執行（真的在編譯） | 0.556 |
| 之後每次啟動（從磁碟載入編譯結果） | 0.153 |
| 同一個行程內的第二次呼叫 | 0.0086 |

`cache=True` 把 0.556 降到 0.153，而那個 0.153 是載入編譯產物的成本。

## 數值逐根相同的代價：複製 numpy 的運算順序

加速的驗收條件不是「差不多」，是**逐根完全相同**。一個快但答案不一樣的指標比慢的那個糟得多：慢只是慢，不一樣是錯的。

第一版的核心跑出來的結果，13,848 根裡有 90 根跟原版不同，最大差 `2.29e-16`。那是一個 ULP 的等級，完全無害——而它不能留。

```python
# quantbot/domain/features/distance_to_point_of_control.py
    """裡面每一行都在複製 `np.histogram` 的算法，而**運算順序必須一模一樣**：

    - 桶的邊界是 `i * step + lowest`（numpy 的 linspace 是 `arange * step + start`），
      NEVER 寫成 `lowest + width * i / n`——後者數學上相同、浮點上不同。
    - 桶的索引是 `(value - lowest) * (n / width)`，NEVER 寫成
      `(value - lowest) / width * n`。
    - 邊界修正只做一步（numpy 也只做一步），而不是 while 迴圈。

    這三件事在改對之前，13,848 根裡有 90 根跟原版差 2.29e-16。那個誤差本身無害，
    但它會讓「數值完全一致」這個驗收條件變成「數值差不多」，而那條界線一鬆，
    之後就再也分不出「浮點誤差」與「算錯了」。
    """
```

最後那句是留下這三行的理由。`assert_allclose(atol=1e-15)` 寫起來一秒鐘，而它會讓下一次真的算錯的時候（例如把 `>=` 寫成 `>`，某些邊界值跑到隔壁的桶）測試照樣通過——因為那個錯的差距也很小。

驗收用的是舊實作，它被搬到 `tests/reference/`：

```python
# tests/reference/reference_point_of_control.py
"""Day 14 原本的寫法：每一根重建一次 CandleSeries，再交給 VolumeProfileService。

它留在 tests/ 是因為它是 Day 26 那個加速版本的**對照組**，而不是因為它錯——
它的數字是對的，只是慢 2,229 倍。正式路徑 NEVER import tests（import-linter
的第三條契約），所以它的存在不會讓生產程式碼繞回這個慢版本。
"""
```

這是 Day 05 那個 `ReferenceEMA`、Day 19 那個逐根回測的同一個做法：**每一個「快版本」都配一個「照定義寫的慢版本」，而慢版本住在測試裡。**

## 為什麼 Numba 可以出現在 domain 裡

這個專案有一條 import-linter 契約：domain 不准 import 外部技術。清單上有 httpx、ccxt、asyncpg、plotly、yaml。而 Numba 現在出現在 domain 的一個檔案裡。

這件事需要一個判準，而不是一個例外：

```toml
# pyproject.toml
# 這張清單上的是「外部世界的細節」：HTTP、交易所 SDK、SQL 驅動、圖表、設定格式。
# numpy / pandas / numba 刻意不在上面，因為它們是 domain 的**計算基材**而不是
# 對外技術——判準是「它會不會把 domain 綁到外部世界的某個約定上」。httpx 會
# （HTTP 的細節）、asyncpg 會（SQL 的細節）；numba 不會，它只是把同一個算式
# 編譯成機器碼，拿掉它算出來的數字要一模一樣（Day 26 有測試釘住這件事）。
name = "domain 不認識任何外部技術"
```

那句「拿掉它算出來的數字要一模一樣」是這個判準能成立的條件，而它有測試在守。如果 Numba 版本與純 Python 版本的答案不同，那它就不只是一個編譯器了——它會變成一個影響領域邏輯的技術選擇，而那時候它就該被擋在外面。

## 三步的成績

```bash
uv run python -m quantbot.entrypoints.benchmark_command \
    --timeframe 1h --start 2025-01-01 --end 2026-08-01
```

BTC/USDT **現貨** 1 小時 K 線，13,848 根，`distance_to_poc_5d`（視窗 5 天、100 個桶）：

| 寫法 | 秒 | 加速 | 數值 |
|---|---|---|---|
| A 逐根重建 entity（Day 14 原版） | 19.2122 | 1.0× | —— |
| B 純 numpy（不重建 ＋ searchsorted） | 0.2327 | **82.6×** | 逐根相同 |
| C Numba 首次（真的在編譯） | 0.5560 | 34.6× | 逐根相同 |
| C Numba 已編譯 | **0.0086** | **2237.2×** | 逐根相同 |

三個數字值得停一下。

**82.6 倍完全沒有用到編譯器。** 那一步做的事只是「不要在迴圈裡重建 entity」與「不要每一根都重掃索引」。如果第一步就跳到 Numba，會得到一個編譯過的、但仍然在迴圈裡建 DataFrame 的版本——而 Numba 根本編譯不了那個版本。

**Numba 在已經很快的版本上又多了 27 倍。** 這是編譯器該有的效果：它處理的是「純數值迴圈的解譯成本」，而那正是拿掉 pandas 之後剩下的東西。

**首次執行比純 numpy 版本慢。** 0.556 對 0.233。只跑一次的話 Numba 是負優化，而這件事在只跑一次的腳本裡很容易忘記。

整條特徵管線（13 個特徵）也一起量了：

```
特徵管線：13,848 列 × 13 欄
         56,428 function calls in 0.034 seconds
   ncalls  tottime  cumtime  filename:lineno(function)
        1    0.007    0.009  distance_to_point_of_control.py:135(compute)
       13    0.002    0.002  pandas/core/window/rolling.py:577(calc)
```

**0.034 秒。** 而 POC 那個特徵仍然是裡面最貴的一項（0.009 秒，26%），只是整條管線已經不再是以「秒」為單位的東西了。Day 15 那條管線從此可以在研究迴圈裡被呼叫幾百次而不必等。

## 什麼時候該用 numpy 廣播而不是 Numba

三個判準，順序就是該嘗試的順序：

**能用一句 numpy 表達就用 numpy。** 廣播、`cumsum`、`rolling` 都是 C 迴圈，而且不必付編譯成本、不必處理型別穩定性、不必多一個依賴。`longest_drawdown_bars` 其實也能寫成一句 numpy，但它 0.45 毫秒——所以連這一步都不必做。

**每一步的輸入集合都不同時，numpy 幫不上忙。** 這就是今天這個特徵的情況：每一根的視窗不同、桶的邊界不同。硬要用 numpy 表達會變成一個 13,848 × 視窗長度的矩陣，記憶體先爆掉。

**遞迴的情況先找有沒有現成的 C 實作。** EMA 是 `ewm`、Wilder 平滑也是 `ewm`（只是 alpha 不同）。自己用 Numba 寫一個更快的 EMA 是可能的，但那是為了幾毫秒去承擔一個「數字可能不一樣」的風險。

## 今日交付物

```
quantbot/
├── domain/features/distance_to_point_of_control.py   改寫：一個 @njit 核心
├── entrypoints/benchmark_command.py                  今天：三種寫法並排 ＋ --profile
├── pyproject.toml                                    numba 進主依賴；記下它為什麼
│                                                     不在 domain 的禁止清單上
└── tests/
    ├── reference/reference_point_of_control.py       今天：舊實作當對照組
    └── domain/features/test_distance_to_point_of_control_kernel.py   今天，5 條
```

### 先把資料補到最新

benchmark 的數字跟資料量成正比，所以要跟文章對得起來就得跑同一段：

```bash
uv sync
docker compose -f docker/docker-compose.yml up -d
uv run python -m quantbot.entrypoints.ingest_pipeline_command
```

`uv sync` 這次會真的裝東西：`numba` 進了主依賴（它原本只是 VectorBT 的間接依賴，而間接依賴 NEVER 拿來當正式路徑的基礎）。

### 跑起來

```bash
# 三種寫法並排，附「數值是否逐根相同」
uv run python -m quantbot.entrypoints.benchmark_command \
    --timeframe 1h --start 2025-01-01 --end 2026-08-01

# 對整條特徵管線跑 cProfile
uv run python -m quantbot.entrypoints.benchmark_command \
    --timeframe 1h --start 2025-01-01 --end 2026-08-01 --profile
```

想看「真的在編譯」那個數字，先把編譯快取刪掉：

```bash
rm -f quantbot/domain/features/__pycache__/*_rolling*.nb*
```

### 驗收標準

七項全過才算完成：

1. `uv run pytest` 全綠（600 passed）。
2. **加速版與對照組逐根完全相同**，三種視窗長度與兩種分桶數各驗一次。用的是
   `array_equal(..., equal_nan=True)`，**不是** `assert_allclose`。
3. **空視窗（第一根）回 NaN**，而不是一個湊出來的數字。
4. **整段只有一個價位時走退化路徑**，兩邊都是。
5. **視窗偏移量用的是索引的單位**，有測試比對「一天的視窗」與「五天的視窗」答案不同。
6. benchmark 表上 B 那一列的加速**不含編譯器**——這一條不是自動化測試，是讀表時
   要確認的事。
7. `uv run mypy quantbot` 與 `uv run lint-imports` 全過（297 檔，3 條契約）。

第 2 項是今天唯一不能妥協的一條。加速可以不做，答案不能變。

> 免責聲明：本文為程式與資料工程的技術分享，所有數字皆為本機實測（Apple Silicon、Python 3.14、numba 0.67），換一台機器絕對值會不同、比例大致不變。文中所有策略與數字皆為教學範例，不構成投資建議。

## 明天

程式跑得夠快了，接下來的問題是**它跑在哪裡**。

明天把整套東西打包成容器丟到 VPS 上。容器化解決的是兩件事：環境一致（本機與雲端同一份映像檔）與掛掉自動重啟。多階段建置縮小映像檔，`docker compose` 把交易機器人、TimescaleDB、監控三個服務接起來。

有幾個細節會咬人：`.dockerignore` 沒寫好會把 `.env` 打包進映像檔（那等於把 API key 寄出去）、`depends_on` 沒配 healthcheck 的話機器人會在資料庫還沒起來的時候就開始連、以及容器裡的時區與 NTP 對時——時間錯一分鐘，K 線的邊界就對不上。

先接 testnet。

## Reference

- [`cProfile` 的計時開銷與它適合回答什麼問題 — Python documentation, The Python Profilers](https://docs.python.org/3/library/profile.html)
- [`@njit` 的 nopython 模式、`cache=True` 如何把編譯結果寫到磁碟 — Numba documentation, Compiling Python code with @jit](https://numba.readthedocs.io/en/stable/user/jit.html)
- [Numba 支援與不支援的 Python 與 NumPy 功能（pandas 物件不在支援清單裡）— Numba documentation, Supported Python features](https://numba.readthedocs.io/en/stable/reference/pysupported.html)
- [`np.histogram` 對等寬分箱的實際算法：先用 norm 求索引，再做一步邊界修正 — NumPy documentation, `numpy.histogram`](https://numpy.org/doc/stable/reference/generated/numpy.histogram.html)
- [`Timedelta.value` 回傳的是奈秒整數，與索引的解析度無關 — pandas documentation, `Timedelta.value`](https://pandas.pydata.org/docs/reference/api/pandas.Timedelta.value.html)
- [`np.searchsorted` 在排序過的陣列上做二分搜尋 — NumPy documentation, `numpy.searchsorted`](https://numpy.org/doc/stable/reference/generated/numpy.searchsorted.html)
