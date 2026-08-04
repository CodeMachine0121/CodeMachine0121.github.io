---
title: "TimescaleDB 入門：從 hypertable 原理到讀懂執行計劃"
datetime: "2026-08-04"
description: "hypertable 到底幫我們做了什麼、什麼時候值得換掉純 PostgreSQL、以及怎麼從 EXPLAIN 的輸出確認它真的有在工作。用一份 260 萬列的實測資料，把分區、壓縮與連續聚合各自買到的東西分開來看。"
image: "https://cdn.coding-afternoon.com/images/titles/TimescaleDB 入門：從 hypertable 原理到讀懂執行計劃.png"
---

## 起因

先前寫量化交易系列時，有一篇花了很大篇幅在講怎麼用 TimescaleDB 存 K 線資料：複合主鍵、批次寫入、連續聚合、壓縮政策一路排下來。那篇的目標是把一條可重跑的入庫路徑做出來，所以 TimescaleDB 本身的原理只能塞在段落之間帶過。

這篇補上那個缺口，而且刻意不綁任何領域。範例改用最通用的感測器讀數，想回答的是三個更基本的問題：

- **原理**：hypertable 到底做了什麼，跟自己在 PostgreSQL 上建分區差在哪。
- **操作**：從一個空的容器開始，最少要下哪幾道指令。
- **驗證**：怎麼從 `EXPLAIN` 的輸出確認它真的有在工作，而不是以為有。

第三點是這篇最想講的。TimescaleDB 大部分的優化都是「安靜生效」的，寫錯查詢的時候它不會報錯，只會慢，而慢多少在資料量還小的時候看不出來。執行計劃是唯一會誠實回答的地方。

> 本文的所有數字都來自一次實際的執行，環境是 Docker 上的 TimescaleDB 2.28.0 ＋ PostgreSQL 16.14，資料是 10 個裝置、每分鐘一筆、共 181 天，合計 2,606,400 列。不同機器的絕對值一定不一樣，值得看的是量級與比例。

## 什麼樣的資料算時序資料

在談 hypertable 之前，先確認手上的資料適不適合。判斷方式不是「有沒有時間欄位」，多數資料表都有 `created_at`，那不構成理由。真正的判準有三條，而且要三條都成立：

**一、只增不改。** 新資料一直進來，舊資料寫進去之後基本上不動。感測器讀數、交易紀錄、應用日誌、系統指標都屬於這類。相對地，訂單狀態、使用者資料這種會被反覆 UPDATE 的東西不算。

**二、查詢幾乎都帶時間範圍。** 問題長成「最近一小時」「這個月每天的平均」「某段區間內的最大值」。如果主要查詢是「找出 id = 12345 那一列」，那是一般的 OLTP 存取，分區幫不上忙。

**三、量隨時間線性成長，而且沒有上限。** 只要來源還在，資料就一直長。這一條決定了「舊資料怎麼辦」會不會變成問題，而那正是 TimescaleDB 花最多力氣處理的部分。

三條都成立的話，往下讀會有收穫。只成立一兩條的話，純 PostgreSQL 大概就夠了，而這個結論在後面的實測裡會再出現一次。

## 原理：hypertable 是一張虛擬表

### 一張表，底下自動切成很多張

TimescaleDB 最核心的概念只有一個。當我們建立 hypertable 之後，`readings` 這個名字指向的不再是一張實體表，而是一個**虛擬表**。真正存資料的是底下一堆按時間切開的子表，叫做 chunk。

```
readings（hypertable：虛擬的，不存資料）
   │
   ├── _hyper_1_1_chunk    2026-01-29 ~ 2026-02-05
   ├── _hyper_1_2_chunk    2026-02-05 ~ 2026-02-12
   ├── _hyper_1_3_chunk    2026-02-12 ~ 2026-02-19
   │   ...
   └── _hyper_1_27_chunk   2026-07-30 ~ 2026-08-06
```

寫入時，TimescaleDB 看時間欄位落在哪個區間，把資料塞進對應的 chunk；那個 chunk 不存在就當場建一個。查詢時，`SELECT * FROM readings` 照常運作，規劃器會把它展開成底下相關 chunk 的聯集。

這件事 PostgreSQL 原生的宣告式分區也做得到，差別在**自動**。原生分區要自己寫一支「每個月建下個月分區」的維護工作，還要處理它沒跑到的那天；hypertable 是寫入時當場建，沒有這支工作，也就沒有忘記的那天。

### 分區買到的第一件事：chunk exclusion

把表切開之後，時間範圍查詢就不必碰所有資料。查 6 月第一週，規劃器可以在**產生計畫的階段**就判斷出只有兩個 chunk 的時間範圍跟條件有交集，其餘 25 個連計畫都不會出現。這叫 chunk exclusion，是分區最直接的效果。

這裡有一個很重要、但常被誤解的地方：**chunk exclusion 的效果不等於「快了幾倍」。** 純 PostgreSQL 只要在時間欄位上有索引，同一個查詢一樣不會掃全表。索引和分區在「只讀需要的部分」這件事上是重疊的，後面的實測會把這一點量化。

分區真正獨佔的好處在別的地方：每個 chunk 有自己的索引，所以熱資料的索引小到能整個待在記憶體裡，不會隨著三年份的歷史資料一起長大；以及下一節要講的兩件事。

### 分區買到的第二件事：整塊丟棄與整塊壓縮

一旦資料按時間分成獨立的實體表，兩個操作就從「逐列處理」變成「整張表處理」。

**刪舊資料。** `DELETE FROM readings WHERE recorded_at < '2026-03-01'` 在一般表上要逐列標記刪除、產生大量 dead tuple、然後等 VACUUM 慢慢回收，而且空間在 `VACUUM FULL` 之前根本不會還給作業系統。換成 hypertable，`drop_chunks()` 做的是 `DROP TABLE`，整個 chunk 直接消失。

**壓縮。** 這是 TimescaleDB 最有價值的功能，原理值得講清楚。壓縮不是對整張表套一個壓縮演算法，而是把一個 chunk 從**列式**轉成**欄式**：每 1000 列打包成一個批次，同一個欄位的 1000 個值收成一個陣列，再對那個陣列套用適合它的編碼。時間戳用 delta-of-delta（連續時間戳的差幾乎固定，差的差就是一長串 0），浮點數用 Gorilla，重複的字串用字典。

打包的同時，TimescaleDB 會替每個批次記下時間欄位的最小值與最大值。查詢時就能先看這組 metadata、跳過整個不相關的批次，連解壓都不必。這個機制在執行計劃裡看得到，是後面最值得看的一段輸出。

### 連續聚合：帶水位的物化檢視

第三個功能跟分區沒有直接關係，但它解決的是時序資料最常見的查詢形態：「按小時／按天彙總」。

每次查詢都現場 `GROUP BY` 的話，資料一多就慢，而且同一段歷史會被重算無數次。自己維護一張物化表也可以，但那需要一個「算到哪裡了」的水位標記，還要一支排程去補新的部分，以及處理「有遲到的資料補進來了，那段要重算」。

連續聚合就是把這三件事包起來。它是一個物化檢視，底下同樣是一張 hypertable，TimescaleDB 額外維護一份失效紀錄（invalidation log）：原始表哪一段被改動過，重新整理時就只重算那一段。

## 操作：從空容器到第一張 hypertable

### 起一個容器

```yaml
# docker-compose.yml
services:
  timescaledb:
    image: timescale/timescaledb:latest-pg16
    environment:
      POSTGRES_USER: demo
      POSTGRES_PASSWORD: demo
      POSTGRES_DB: demo
      TZ: UTC
    ports:
      - "5432:5432"
    volumes:
      - timescale-data:/var/lib/postgresql/data

volumes:
  timescale-data:
```

`TZ: UTC` 不是可選的。時序資料庫最容易踩到的坑就是時區，而它通常在事情已經存了三個月之後才浮出來，所以從容器層就把它釘死。

啟用 extension，並且確認版本：

```sql
CREATE EXTENSION IF NOT EXISTS timescaledb;

SELECT extversion FROM pg_extension WHERE extname = 'timescaledb';
```

```
 extversion
------------
 2.28.0
```

版本要記下來。TimescaleDB 在 2.13 與 2.18 各改過一次 API 名稱，網路上搜到的教學很可能對應到不同世代，後面會遇到具體的例子。

### 建表，然後把它變成 hypertable

```sql
CREATE TABLE readings (
    device_id   TEXT             NOT NULL,
    metric      TEXT             NOT NULL,
    recorded_at TIMESTAMPTZ      NOT NULL,
    value       DOUBLE PRECISION NOT NULL
);

SELECT create_hypertable('readings', by_range('recorded_at', INTERVAL '7 days'));
```

```
 create_hypertable
-------------------
 (1,t)
```

`by_range` 是 2.13 之後的寫法，舊版是 `create_hypertable('readings', 'recorded_at', chunk_time_interval => INTERVAL '7 days')`，效果相同。

**分區間隔怎麼選。** 官方的經驗法則是讓「還在活躍寫入與查詢的那幾個 chunk，連同它們的索引」加起來不超過記憶體的 25%。實際算一次比背規則有用：10 個裝置每分鐘一筆是 14,400 列／天，7 天一個 chunk 約 10 萬列，每列含索引抓 140 bytes 大概是 14 MB。這個數字對任何機器都很輕鬆，所以 7 天是安全的起點。

往兩邊偏會發生什麼也要知道。間隔太小（例如 1 天），三年就是 1,095 個 chunk，一次跨年度的查詢要規劃上千張子表，光是 planning 的時間就吃掉分區的好處。間隔太大（例如 1 年），chunk exclusion 幾乎失效，撈兩個月要掃整年。

間隔之後可以改，但只對新建的 chunk 生效：

```sql
SELECT set_chunk_time_interval('readings', INTERVAL '14 days');
```

### 塞一批測試資料

要驗證任何效能行為，資料量得夠。用 `generate_series` 在資料庫端直接產生，比從應用程式灌快得多：

```sql
INSERT INTO readings (device_id, metric, recorded_at, value)
SELECT
    'sensor-' || lpad(d::TEXT, 3, '0'),
    'temperature',
    t,
    22 + 6 * sin(extract(epoch FROM t) / 86400.0 * 2 * pi()) + (d % 5) * 0.3
FROM generate_series(1, 10) AS d,
     generate_series(TIMESTAMPTZ '2026-02-01 00:00:00+00',
                     TIMESTAMPTZ '2026-07-31 23:59:00+00',
                     INTERVAL '1 minute') AS t;

CREATE INDEX ON readings (device_id, recorded_at DESC);
ANALYZE readings;
```

`ANALYZE` 不要漏。統計資訊沒更新的話，接下來看到的執行計劃會是規劃器在瞎猜的結果。

索引的欄位順序也值得說明：查詢形態是「某個裝置、某段時間」，也就是一個等值條件加一個範圍條件，把等值的放前面、範圍的放後面，索引前綴才對得上查詢形狀。

### 看看 chunk 長什麼樣

```sql
SELECT chunk_name, range_start::date, range_end::date
FROM   timescaledb_information.chunks
WHERE  hypertable_name = 'readings'
ORDER  BY range_start
LIMIT  4;
```

```
    chunk_name    | range_start | range_end
------------------+-------------+------------
 _hyper_1_1_chunk | 2026-01-29  | 2026-02-05
 _hyper_1_2_chunk | 2026-02-05  | 2026-02-12
 _hyper_1_3_chunk | 2026-02-12  | 2026-02-19
 _hyper_1_4_chunk | 2026-02-19  | 2026-02-26
```

這裡有一個第一次看會愣一下的地方：資料是從 2026-02-01 開始塞的，但第一個 chunk 的範圍從 **2026-01-29** 起算。**chunk 的邊界是對齊 UTC epoch 的，不是對齊第一筆資料。** 7 天一格從 1970-01-01 開始數，2026-02-01 剛好落在 01-29 那一格裡面。這個行為在對照「某一天的資料在哪個 chunk」時會用到，知道了就不會困惑。

總共切出 27 個 chunk：

```sql
SELECT count(*) FROM show_chunks('readings');
```

```
 count
-------
    27
```

## 讀執行計劃

這是確認 TimescaleDB 有沒有在工作的唯一方法。先講通用的讀法，再講 TimescaleDB 特有的節點。

### EXPLAIN 的基本讀法

`EXPLAIN` 只給規劃器的**估計**，不實際執行。`EXPLAIN (ANALYZE)` 會真的把查詢跑一遍，回報實際的列數與耗時。要判斷效能問題，幾乎都需要 `ANALYZE`。

常用的組合是這樣：

```sql
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF) SELECT ...;
```

- `ANALYZE`：實際執行，給出 `actual rows` 與 `Execution Time`。
- `BUFFERS`：報告讀了多少 page，以及其中多少是快取命中。這比時間更穩定，因為它不受機器當下負載影響。
- `COSTS OFF`：把估計成本那串數字關掉。剛開始學的時候，那串數字只會讓輸出更難讀。

讀的方向是**由內而外、由下而上**：縮排最深的節點最先執行，結果往上層傳。

幾個要盯的欄位：

| 欄位 | 看什麼 |
|---|---|
| `actual rows` | 實際吐出幾列。跟規劃器的估計差一個數量級以上，通常是統計資訊過期，補 `ANALYZE`。 |
| `loops` | 這個節點被執行幾次。**`actual rows` 是每次的平均值**，總量要自己乘。 |
| `Rows Removed by Filter` | 讀進來又丟掉的列數。這是純粹的浪費，數字大代表條件沒被推到索引或分區層。 |
| `Buffers: shared hit / read` | `hit` 是快取命中，`read` 是真的去讀。 |

最後一欄特別值得說：`Rows Removed by Filter` 是判斷「條件有沒有生效」最直接的訊號，接下來的反例整段都圍著它打轉。

### 確認 chunk exclusion 有生效

先看一個正常的查詢，撈某一天的資料：

```sql
EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF)
SELECT count(*) FROM readings
WHERE recorded_at >= '2026-06-01' AND recorded_at < '2026-06-02';
```

```
 Aggregate (actual rows=1 loops=1)
   ->  Index Only Scan using _hyper_1_18_chunk_readings_recorded_at_idx
       on _hyper_1_18_chunk (actual rows=14400 loops=1)
         Index Cond: ((recorded_at >= '2026-06-01 00:00:00+00'::timestamptz)
                  AND (recorded_at <  '2026-06-02 00:00:00+00'::timestamptz))
         Heap Fetches: 0
 Planning Time: 1.578 ms
 Execution Time: 1.048 ms
```

**判斷方式就是數計畫裡出現了幾個 chunk。** 這裡只有 `_hyper_1_18_chunk` 一個，其餘 26 個在規劃階段就被排除掉了，連出現在計畫裡的機會都沒有。這是 chunk exclusion 生效時的樣子：被排除的 chunk 是**安靜消失**的，不會有任何一行輸出說「我排除了 26 個」。

`Heap Fetches: 0` 是額外的好消息，代表 `count(*)` 完全靠索引回答，沒有回主表撈任何一列。

### 反例：把時間欄位包在函式裡

同樣是撈 6 月 1 日一整天，換一種寫法：

```sql
EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF)
SELECT count(*) FROM readings
WHERE date_trunc('day', recorded_at) = '2026-06-01';
```

```
 Finalize Aggregate (actual rows=1 loops=1)
   ->  Gather (actual rows=37 loops=1)
         Workers Planned: 5
         ->  Parallel Custom Scan (ChunkAppend) on readings (actual rows=6 loops=6)
               Chunks excluded during startup: 0
               ->  Partial Aggregate (actual rows=1 loops=1)
                     ->  Parallel Index Only Scan on _hyper_1_2_chunk (actual rows=0 loops=1)
                           Filter: (date_trunc('day'::text, recorded_at) = '2026-06-01 ...')
                           Rows Removed by Filter: 100800
               ->  Partial Aggregate (actual rows=1 loops=1)
                     ->  Parallel Index Only Scan on _hyper_1_3_chunk (actual rows=0 loops=1)
                           Filter: (date_trunc('day'::text, recorded_at) = '2026-06-01 ...')
                           Rows Removed by Filter: 100800
               ...（27 個 chunk 全部都在，此處省略 24 個）
 Planning Time: 4.099 ms
 Execution Time: 39.461 ms
```

同樣的問題、同樣的答案，1.048 ms 變成 39.461 ms，慢了 37 倍。

原因在計畫裡寫得很清楚。時間條件從 `Index Cond` 掉到了 `Filter`：一旦欄位被 `date_trunc()` 包住，規劃器就無法把它跟 chunk 的時間範圍比對，也無法拿去查索引。它只能把每個 chunk 的每一列都讀出來、算一次 `date_trunc`、再比對。每個 chunk 下面那行 `Rows Removed by Filter: 100800` 就是被白讀的量。

`Chunks excluded during startup: 0` 這行是 TimescaleDB 直接告訴我們排除了幾個，答案是零。

**規則很單純：時間條件要讓欄位單獨站在比較運算子的一邊。** 需要按天分組就用 `time_bucket()` 放在 `GROUP BY`，篩選條件仍然寫成範圍比較。

這個反例值得記住的原因，是它不會報錯。資料量小的時候，兩種寫法都是幾毫秒，看不出差別；等資料長到幾千萬列，它就變成一個沒人知道從哪來的效能問題。

### 執行期才知道範圍的查詢

如果條件裡有 `now()`，規劃器在產生計畫時還不知道具體時間，沒辦法在規劃階段排除 chunk：

```sql
EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF)
SELECT count(*) FROM readings
WHERE recorded_at > now() - INTERVAL '40 days';
```

```
 Finalize Aggregate (actual rows=1 loops=1)
   ->  Gather (actual rows=11 loops=1)
         Workers Planned: 3
         ->  Parallel Custom Scan (ChunkAppend) on readings (actual rows=3 loops=4)
               Chunks excluded during startup: 1
               ->  Partial Aggregate (actual rows=1 loops=1)
                     ->  Parallel Index Only Scan on _hyper_1_23_chunk (actual rows=100800 loops=1)
                           Index Cond: (recorded_at > (now() - '40 days'::interval))
               ...（共 6 個 chunk）
 Planning Time: 0.414 ms
 Execution Time: 8.088 ms
```

這裡出現了 `Custom Scan (ChunkAppend)`，它是 TimescaleDB 專門為這種情況做的節點：把排除的時機從規劃期延到**執行期**，等 `now()` 真的求值之後再決定要碰哪些 chunk。`Chunks excluded during startup: 1` 就是它在執行期額外排除掉的數量。

所以 `now()` 相對條件不是問題，該生效的還是生效了，只是排除發生在別的階段、報告在別的地方。看計畫時知道要去哪裡找就好。

### 壓縮之後的計畫

這是整篇最值得看的一段輸出。先把壓縮打開：

```sql
ALTER TABLE readings SET (
    timescaledb.enable_columnstore = true,
    timescaledb.segmentby = 'device_id',
    timescaledb.orderby   = 'recorded_at DESC'
);

SELECT compress_chunk(c) FROM show_chunks('readings', older_than => INTERVAL '30 days') c;
```

兩個設定值決定了壓縮的效果：

- `segmentby` 放**查詢時的等值條件欄位**。這裡是 `device_id`，代表壓縮後同一個裝置的資料仍然聚在一起，查單一裝置時不必解開其他裝置的批次。
- `orderby` 放**時間**，讓同一個批次內的時間戳連續，delta-of-delta 編碼才有東西可以壓。

然後查一段落在已壓縮 chunk 裡的資料：

```sql
EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF)
SELECT avg(value) FROM readings
WHERE device_id = 'sensor-003'
  AND recorded_at >= '2026-03-01' AND recorded_at < '2026-03-08';
```

```
 Finalize Aggregate (actual rows=1 loops=1)
   ->  Append (actual rows=2 loops=1)
         ->  Custom Scan (VectorAgg) (actual rows=1 loops=1)
               ->  Custom Scan (ColumnarScan) on _hyper_1_5_chunk (actual rows=5760 loops=1)
                     Vectorized Filter: ((recorded_at >= '2026-03-01 ...')
                                     AND (recorded_at <  '2026-03-08 ...'))
                     Rows Removed by Filter: 240
                     ->  Index Scan using compress_hyper_3_36_chunk_device_id__ts_meta_v2_last_record_idx
                         on compress_hyper_3_36_chunk (actual rows=6 loops=1)
                           Index Cond: ((device_id = 'sensor-003'::text)
                                    AND (_ts_meta_v2_last_recorded_at  < '2026-03-08 ...')
                                    AND (_ts_meta_v2_first_recorded_at >= '2026-03-01 ...'))
         ->  Custom Scan (VectorAgg) (actual rows=1 loops=1)
               ->  Custom Scan (ColumnarScan) on _hyper_1_6_chunk (actual rows=4320 loops=1)
                     Vectorized Filter: ...
                     Rows Removed by Filter: 760
                     ->  Index Scan on compress_hyper_3_37_chunk (actual rows=6 loops=1)
 Planning Time: 3.641 ms
 Execution Time: 0.812 ms
```

三個地方值得逐一看。

**最內層的 `actual rows=6`。** 這是實際從硬碟撈出來的**壓縮列**數量，只有 6 列。它的上層 `ColumnarScan` 吐出 5,760 列。一列壓縮列展開成 1000 列原始資料，6 列就是 6,000 列，扣掉範圍外的 240 列，剛好是 5,760。原理那節講的「每 1000 列打包成一個批次」，在這裡具體看得到。

**`_ts_meta_v2_first_recorded_at` 與 `_ts_meta_v2_last_recorded_at`。** 這兩個是 TimescaleDB 替每個批次記下的時間最小值與最大值，而它們現在出現在 `Index Cond` 裡。意思是時間範圍的篩選在**批次層級**就完成了，不相關的批次連解壓都沒有。

**`Custom Scan (VectorAgg)`。** 資料已經是欄式的陣列，`avg()` 可以直接在陣列上做向量化運算，不必先還原成一列一列再逐列累加。

結果是 0.812 ms，比壓縮前查同樣範圍還快一點。壓縮通常不會讓查詢變慢，因為要從硬碟讀進來的 bytes 少了一個數量級，省下的 I/O 多過解壓的成本。

順帶一提，如果看到的節點名稱是 `DecompressChunk` 而不是 `ColumnarScan`，那是比較舊的版本，概念一樣。

## 三個功能各自買到了什麼

這節把前面的東西放到一起量化。誠實地講，其中一項的答案跟直覺不太一樣。

### 分區本身：在這個量級沒有買到速度

拿同一份資料建一張普通 PostgreSQL 表 `readings_plain`，索引開得一模一樣，然後跑同一個時間範圍查詢：

| | 掃描方式 | Execution Time |
|---|---|---|
| 純 PostgreSQL 表 | Index Scan，100,800 列 | 13.116 ms |
| hypertable | 2 個 chunk 各一次 Index Scan | 13.324 ms |

兩邊一樣快，hypertable 甚至還慢了 0.2 ms。

這個結果不意外，前面提過原因：索引和分區在「只讀需要的部分」上是重疊的。260 萬列對 PostgreSQL 來說根本不算多，btree 索引整個待在快取裡，分區沒有額外的東西可以省。

值得補一句的是，第一次做這個對照時 `readings_plain` 上少了時間欄位的索引，於是它走了 Parallel Seq Scan、掃掉 62 萬列才回答，22.5 ms 對 11.8 ms，看起來 hypertable 快了一倍。那個數字是索引沒開好造成的，不是分區的功勞。做這類比較的時候，兩邊的索引要先對齊，否則量到的是別的東西。

所以分區在這個量級的價值不在單次查詢的速度，而在於它讓後面兩件事變成可能，以及讓索引不會隨歷史資料無限長大。

### 連續聚合：147 ms 變成 1.1 ms

這是差距最大的一項。先看現場聚合，把三個月的資料按小時分組：

```sql
EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF)
SELECT time_bucket(INTERVAL '1 hour', recorded_at) AS bucket,
       device_id, avg(value)
FROM readings
WHERE recorded_at >= '2026-05-01' AND recorded_at < '2026-08-01'
GROUP BY bucket, device_id;
```

計畫是 13 個 chunk 各做一次 Seq Scan 加 Partial HashAggregate，輸出 22,080 列，`Execution Time: 147.243 ms`。

建一個連續聚合：

```sql
CREATE MATERIALIZED VIEW readings_hourly
WITH (timescaledb.continuous, timescaledb.materialized_only = true) AS
SELECT
    device_id,
    time_bucket(INTERVAL '1 hour', recorded_at) AS bucket,
    avg(value)   AS avg_value,
    max(value)   AS max_value,
    min(value)   AS min_value,
    count(*)     AS sample_count
FROM readings
GROUP BY device_id, time_bucket(INTERVAL '1 hour', recorded_at)
WITH NO DATA;

CALL refresh_continuous_aggregate('readings_hourly', NULL, NULL);
```

同一個問題改問聚合表，輸出同樣的 22,080 列：

```
 Append (actual rows=22080 loops=1)
   ->  Seq Scan on _hyper_2_28_chunk (actual rows=3840 loops=1)
   ->  Seq Scan on _hyper_2_29_chunk (actual rows=16800 loops=1)
   ->  Index Scan on _hyper_2_30_chunk (actual rows=1440 loops=1)
 Execution Time: 1.108 ms
```

147.243 ms 變成 1.108 ms，大約 130 倍。從 chunk 名稱 `_hyper_2_*` 也看得出來，連續聚合本身也是一張 hypertable。

有三個地方要注意。

**`GROUP BY` 一定要重寫完整的 `time_bucket(...)`，不能寫輸出別名。** 這是一定會撞到一次的錯誤。如果別名跟來源欄位同名，PostgreSQL 在 `GROUP BY` 遇到這個識別字時會解析成來源欄位，於是分組分的是原始時間戳，TimescaleDB 檢查時找不到時間桶，直接回 `continuous aggregate view must include a valid time bucket function`。

**`materialized_only = true` 要想清楚。** 設成 `false` 的話，查詢時 TimescaleDB 會把已物化的部分，加上原始表裡還沒物化的最新資料，union 起來一併回傳。看起來很貼心，問題是那批最新資料可能包含一個**還沒滿一小時的 bucket**，於是查到的最後一列是半個小時的平均值，而它長得跟完整的一列一模一樣。設成 `true` 只會看到已經封好的 bucket，代價是資料會落後一點，但那個落後是可控且可預期的。

**`WITH NO DATA` 加手動重新整理。** 建立時先不回填，避免 `CREATE` 語句在幾百萬列上卡住，建好之後再單獨跑一次。注意 `CALL refresh_continuous_aggregate()` 不能在交易區塊裡執行，所以它必須單獨送出，跟其他語句一起送會失敗。

接著掛上自動重新整理的政策：

```sql
SELECT add_continuous_aggregate_policy('readings_hourly',
    start_offset      => INTERVAL '3 days',
    end_offset        => INTERVAL '1 hour',
    schedule_interval => INTERVAL '30 minutes');
```

意思是每 30 分鐘跑一次，每次重算「3 天前到 1 小時前」這個區間。`end_offset` 必須大於一個 bucket 的寬度，否則會物化到還沒封好的 bucket，前面那個問題又回來了。`start_offset` 給 3 天是容錯用的，涵蓋可能遲到的資料。

由此也可以推算出資料的落後量：最壞情況下 `readings_hourly` 會比 `readings` 落後大約 90 分鐘。如果有任何邏輯要吃這張表，這個延遲得先放進考量。

### 壓縮：12.7 倍，而且查詢沒有變慢

```sql
SELECT pg_size_pretty(sum(before_compression_total_bytes)) AS before,
       pg_size_pretty(sum(after_compression_total_bytes))  AS after,
       round(sum(before_compression_total_bytes)::numeric
             / nullif(sum(after_compression_total_bytes), 0), 1) AS ratio
FROM   chunk_compression_stats('readings');
```

```
 before | after | ratio
--------+-------+-------
 253 MB | 20 MB |  12.7
```

整張 hypertable 從 303 MB 降到 71 MB（22 個 chunk 壓縮，最近 5 個保持未壓縮）。單看一個 chunk 是 12 MB 壓到 944 kB。

**這個 12.7 倍要打點折扣。** 測試資料是用 `sin()` 產生的平滑曲線，浮點壓縮在這種資料上表現特別好。真實資料通常沒這麼漂亮，前面提到的市場行情資料實測大約是 10 倍。要知道自己的資料壓得如何，跑上面那句就有答案。

掛上自動壓縮政策時，會遇到一個 API 的版本差異：

```sql
-- 2.18 之後：add_columnstore_policy 是 procedure，要用 CALL
CALL add_columnstore_policy('readings', after => INTERVAL '30 days');

-- 2.18 之前：add_compression_policy 是 function，用 SELECT
SELECT add_compression_policy('readings', compress_after => INTERVAL '30 days');
```

用錯的話會拿到這個訊息：

```
ERROR:  add_columnstore_policy(unknown, after => interval) is a procedure
HINT:  To call a procedure, use CALL.
```

錯誤訊息講得夠清楚，不至於卡住，但知道有這回事可以省下一次困惑。兩組 API 目前都還在，舊的仍然可用。

門檻設 30 天是刻意留的緩衝。壓縮過的 chunk 要回填資料會麻煩很多，所以這個值應該大於「資料還可能被修正」的時間窗。

### 刪舊資料：drop_chunks 與 DELETE

最後這項的差距不只在速度。同樣刪掉 2026-03-01 之前的資料：

| | 耗時 | 結果 |
|---|---|---|
| `DELETE FROM readings_plain WHERE recorded_at < '2026-03-01'` | 206.637 ms | 刪掉 403,200 列 |
| `SELECT drop_chunks('readings', older_than => TIMESTAMPTZ '2026-03-01')` | 13.320 ms | 丟掉 4 個 chunk |

速度差 15 倍，但更重要的是刪完之後的狀態：

```sql
SELECT n_live_tup, n_dead_tup FROM pg_stat_user_tables WHERE relname = 'readings_plain';
```

```
 n_live_tup | n_dead_tup
------------+------------
    2203200 |     403200
```

`DELETE` 留下了 403,200 個 dead tuple，heap 仍然佔著 170 MB。那些空間要等 VACUUM 才會被標記成可重用，而要真正還給作業系統得跑 `VACUUM FULL`，那會鎖住整張表。`drop_chunks` 做的是 `DROP TABLE`，空間當場就回來了。

**但這裡有一個一定要知道的差異。** 看一下兩邊剩下的最舊資料：

```
 hypertable_min           plain_min
------------------------ ------------------------
 2026-02-26 00:00:00+00   2026-03-01 00:00:00+00
```

`DELETE` 精確刪到 2026-03-01，`drop_chunks` 只刪到 2026-02-26。原因是 **`drop_chunks` 只會丟掉整個時間範圍都在門檻之前的 chunk**，它不會刪半個 chunk。跨越門檻的那個 chunk（2026-02-26 到 2026-03-05）原封不動保留了下來，裡面有 43,200 列比門檻還舊的資料活著。

這對保留政策來說通常無所謂，多留幾天不是問題。但如果刪除是為了滿足法規或隱私要求，「一定要刪乾淨」的話，就得認知到這個行為，該補的用 `DELETE` 補。

自動化的版本：

```sql
SELECT add_retention_policy('readings', drop_after => INTERVAL '365 days');
```

掛上去之後，可以在工作清單裡看到它：

```sql
SELECT job_id, application_name, schedule_interval, next_start
FROM   timescaledb_information.jobs
WHERE  hypertable_name = 'readings';
```

```
 job_id |     application_name      | schedule_interval |          next_start
--------+---------------------------+-------------------+------------------------------
   1000 | Retention Policy [1000]   | 1 day             | 2026-08-05 00:53:34.72163+00
   1002 | Columnstore Policy [1002] | 12:00:00          |
```

政策出問題時，`timescaledb_information.job_stats` 有 `last_run_status` 與 `total_failures` 可以查。背景工作失敗是安靜的，值得定期看一眼。

## 幾個容易踩到的地方

**時區。** `TIMESTAMPTZ` 內部永遠存 UTC，但**顯示**會被 session 的 `TimeZone` 影響。同一列資料，在 psql 看到的字串跟程式讀到的可能差好幾小時，兩邊都沒有錯，只是設定不同。要釘死三個地方：容器的 `TZ`、資料庫的 `ALTER DATABASE demo SET timezone TO 'UTC'`、以及連線層的設定。另外 `time_bucket` 對 `TIMESTAMPTZ` 的 bucket 邊界是以 UTC epoch 對齊的，需要按當地時區分天的話，得用它的 timezone 參數版本。

**寫入方式。** 逐筆 `INSERT` 在時序資料的量級下會慢到無法接受，因為每一列都是一次網路來回加一次語句解析。批次載入用 `COPY`，差距通常是幾十倍。要同時處理重複資料的話，標準做法是先 `COPY` 進暫存表，再一句 `INSERT ... SELECT ... ON CONFLICT` 併進主表，因為 `COPY` 本身不支援 `ON CONFLICT`。

**回填到已壓縮的 chunk。** 新版本支援直接寫入壓縮 chunk，但涉及主鍵衝突判斷時得先解壓相關的段，速度會掉一個數量級。與其想辦法處理，不如把壓縮門檻設得夠遠，讓正常的回補永遠碰不到壓縮過的資料。

**歷史回補之後，聚合表不會自動跟上。** 連續聚合的政策只重算 `start_offset` 窗口內的資料。如果補了一段很舊的歷史，那段的聚合結果會是空的，而且不會有任何錯誤。手動補一次：

```sql
CALL refresh_continuous_aggregate('readings_hourly',
    '2026-03-01T00:00:00Z', '2026-04-01T00:00:00Z');
```

這件事的症狀很不明顯，原始表查得到、聚合表少一段，可能過很久才會被注意到。任何歷史回補的流程都該把這一步寫進收尾。

## 小結

回到最前面那三個問題。

**原理。** hypertable 是一張虛擬表，底下按時間自動切成 chunk。分區本身讓查詢只碰到相關的子表，但更重要的是它讓「整塊丟棄」與「整塊壓縮」變成可能，而這兩件事在單一大表上做不到。

**操作。** 最少的一組指令是 `CREATE EXTENSION`、`CREATE TABLE`、`create_hypertable`。之後視需要加上連續聚合、壓縮政策、保留政策，三者都是掛上去就自動跑的背景工作。

**驗證。** `EXPLAIN (ANALYZE, BUFFERS)` 是唯一誠實的地方。看計畫裡出現了幾個 chunk，就知道 chunk exclusion 有沒有生效；看時間條件落在 `Index Cond` 還是 `Filter`，就知道有沒有寫錯查詢；看 `ColumnarScan` 底下那層的 `actual rows`，就知道壓縮的批次跳過機制有沒有在工作。

至於「該不該換掉純 PostgreSQL」，實測給的答案比行銷素材保守：**單看查詢速度，260 萬列的量級下兩者沒有差別。** 值得換的理由是壓縮（12.7 倍）、連續聚合（130 倍）、以及 `drop_chunks` 對比 `DELETE` 的空間回收。這三件事在純 PostgreSQL 上都得自己寫，而且都不好寫。

它的代價則低到幾乎不必考慮：TimescaleDB 就是 PostgreSQL 的一個 extension，psql、pg_dump、既有的 driver 全部照用。所以取捨從來不是「PostgreSQL 還是 TimescaleDB」，而是「PostgreSQL，還是 PostgreSQL 加上三個本來要自己寫的功能」。

## Reference

- [hypertable 的概念、`create_hypertable` 語法與分區間隔的選擇建議 — Timescale Documentation, "Hypertables"](https://docs.tigerdata.com/use-timescale/latest/hypertables/)
- [連續聚合的重新整理政策、`start_offset`／`end_offset` 語意與 `materialized_only` 的行為 — Timescale Documentation, "Continuous aggregates"](https://docs.tigerdata.com/use-timescale/latest/continuous-aggregates/)
- [壓縮的 `segmentby`／`orderby` 設定、批次化原理與 2.18 之後改名為 columnstore 的 API — Timescale Documentation, "Compression"](https://docs.tigerdata.com/use-timescale/latest/compression/)
- [`drop_chunks` 只丟棄完整落在門檻之前的 chunk 這項行為 — Timescale Documentation, "drop_chunks"](https://docs.tigerdata.com/api/latest/hypertable/drop_chunks/)
- [`EXPLAIN` 各欄位的意義、`ANALYZE` 與 `BUFFERS` 選項 — PostgreSQL Documentation, "Using EXPLAIN"](https://www.postgresql.org/docs/current/using-explain.html)
- [`VACUUM` 為何無法把空間還給作業系統、以及 `VACUUM FULL` 的代價 — PostgreSQL Documentation, "Routine Vacuuming"](https://www.postgresql.org/docs/current/routine-vacuuming.html)
