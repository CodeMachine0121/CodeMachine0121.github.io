---
title: "Day 08：第一階段總結：把擷取、清洗、入庫串成一條每天自己跑的 Pipeline"
datetime: "2026-09-22"
description: "前六天的零件都在，但還是靠手動接。這篇把盤點、路由、回補、清洗、入庫、複驗串成一條 cron 叫得動的管線，重點放在冪等與可觀測：跑兩次結果一樣，出錯知道是哪一段，最後吐出一份資料完整性報告。"
image: ""
parent: "2026 ithome-鐵人賽: 工程師的量化交易入門：從 K 線到可組合的交易策略引擎 系列"
draft: false
---

## 零件都齊了，但它們之間還是手動接的

昨天把 TimescaleDB 的 schema 建好、寫入做成冪等的了。要驗證它能用，大概是這樣做的：手動跑一次 Day 03 的 `backfill_command`、把回傳的 `CandleSeries` 看一眼、再手動呼叫 `TimescaleCandleRepository.save` 寫進去。一個交易對、一次性回補，這樣做完全沒問題。

問題是這條路不會只走一次。明天早上會想看昨天的資料，下週會想把 ETH/USDT 加進來，某天畫圖的時候會發現三個禮拜前有一段沒抓到。每次都手動跑一遍，遲早會有一次漏掉，或是同一段跑了兩次。

今天要做的事就是把這些手動步驟接成一條管線，讓 cron 叫得動它，而且叫幾次都不會出事。整條管線只有兩個設計目標：

- **冪等**：同一條指令跑一次跟跑五次，資料庫的狀態一模一樣。
- **可觀測**：跑完要知道補了哪幾段、哪幾段沒補到、哪幾根資料看起來不對勁。管線不能只回傳「成功」。

## 交易概念補課：一根缺漏的 K 線會讓均線錯十天

今天沒有新的交易術語。但有一件事必須先講清楚，否則後面那些工程細節看起來都像過度設計。

假設在抓 BTC/USDT 現貨的 1 分鐘 K 線。某天 02:13 到 02:17 這五根沒抓到，可能是 REST 翻頁時 off-by-one，也可能是那次請求逾時之後重試邏輯跳過了它。一天有 1440 根 K 線，缺 5 根是 0.35%，把圖畫出來肉眼絕對看不出來。

現在在這段資料上算 20 週期均線：

```python
df["ma20"] = df["close"].rolling(20).mean()
```

`rolling(20)` 取的是「這張表往前數 20 列」，不是「往前數 20 分鐘」。缺口之後的第一根 K 線，它的 MA20 用到的 20 列實際橫跨了 25 分鐘。第二根也是，第三根也是，一直到缺口被推出視窗為止，總共 20 根 K 線的均線都是「過去 25 分鐘的平均」，而帳面上它是 20 分鐘。

Day 05 的 EMA 與 Day 06 的 RSI 更麻煩一點。遞迴指標的每個值都依賴前一個值，缺漏的影響不會在 20 根之後乾淨地消失，只會隨著平滑係數慢慢衰減。

整件事最麻煩的地方在於：**沒有任何錯誤訊息**。`rolling` 不會報錯，`pandas-ta` 對照組也不會，因為它拿到的是同一張有缺漏的表，兩邊會算出同一個錯誤答案。Day 04 到 Day 06 建立的對照組習慣，防的是「公式寫錯」，防不了「資料少了幾列」。

有人會想到改用時間基準的視窗，`rolling("20min")`。這確實讓視窗涵蓋的時間變正確了，但視窗裡的樣本數變少，算出來的均線一樣不是帳面上那個東西，只是錯得比較溫和。真正的處理方式是讓缺漏成為一件看得見的事：管線每次跑完都要能回答「這段時間該有幾根、實際有幾根、差的那幾根在哪裡」。

## 資料來源：今天不引入新來源，只是把三條路徑接起來

今天沒有新的 provider。用的還是 Day 03 那三條路徑，加上 Day 01 就講好的對照組：

| 用途     | 來源                           | 這條管線裡負責哪一段           |
|--------|------------------------------|----------------------|
| 大量歷史回補 | data.binance.vision 批次 zip   | 缺口在兩天以前、而且夠長的那些      |
| 近期缺口回補 | Binance REST（透過 ccxt）        | 批次檔還沒上傳的那幾天，以及零星的小缺口 |
| 即時串流   | Binance WebSocket            | 今天還沒接，Day 09 才進來     |
| 對照驗證   | CoinGecko、CryptoDataDownload | 管線最後一步的抽樣比對          |

要注意批次檔有上傳延遲：daily zip 是隔日上傳，monthly 要等次月初。所以「昨天 00:00 UTC」之後的資料，不管缺口多長都只能走 REST。這個邊界會直接寫進路由邏輯。

## 管線長什麼樣子

六個步驟，順序不能換：

```
cron（每小時第 5 分鐘）
 │
 ├─ 讀設定檔：要顧哪些 symbol / timeframe / market / 從哪天開始
 │
 ▼
[1] 盤點   查 DB 現有的 open_time，跟預期的時間軸做 diff → 缺口清單
 │
 ▼
[2] 路由   每個缺口切成（批次段, REST 段），依長度與批次檔上傳延遲決定
 │
 ▼
[3] 取得   批次段 → data.binance.vision zip；REST 段 → ccxt 翻頁
 │
 ▼
[4] 清洗   時區統一 → 去重 → OHLC 邏輯檢查 → 異常標記
 │
 ▼
[5] 入庫   COPY 進 staging，ON CONFLICT DO NOTHING（Day 07）
 │
 ▼
[6] 複驗   再跑一次 [1]，缺口應為空；抽樣跟對照組比
 │
 ▼
資料完整性報告 + exit code
```

多說一點步驟 [6]，它不是額外的檢查，它就是步驟 [1] 再跑一次。管線自己驗自己補完了沒有，比事後開 notebook 查快得多，也不會忘記做。

冪等來自三個地方：步驟 [1] 每次都重新讀資料庫的實際狀態，不依賴上一輪跑到哪裡；步驟 [4] 不改到輸入；步驟 [5] 有複合主鍵擋重複。所以就算在步驟 [3] 中斷、隔天重跑，管線會自己算出還缺哪些，不會從頭重來，也不會漏。

還有一個容易忽略的冪等前提，是 Day 02 講過的：**最後一根還沒收完的 K 線一律不入庫**。把它寫進去的話，五分鐘後再跑一次，同一個 `open_time` 會有兩組不同的 OHLCV，而 `ON CONFLICT DO NOTHING` 會保留先寫進去的那一組，也就是不完整的那一組。這既破壞冪等，也是一個很難察覺的未來函數來源。所以整條管線的時間軸右端一律用開區間。

## 工程實作

### 今天幾乎不寫新的計算

先看一眼今天要動的東西，會發現一件事：**六個步驟裡有四個已經有負責的對象了**。

| 步驟     | 誰負責                                                      | 什麼時候寫的 |
|--------|----------------------------------------------------------|--------|
| [1] 盤點 | `DataIntegrityService`                                   | Day 03 |
| [2] 路由 | `SourceRoutingService`                                   | Day 03 |
| [3] 取得 | `BinanceArchiveCandleSource` / `BinanceRestCandleSource` | Day 03 |
| [4] 清洗 | `CandleSanitationService`                                | **今天** |
| [5] 入庫 | `TimescaleCandleRepository`                              | Day 07 |
| [6] 複驗 | 同 [1] 的 `DataIntegrityService`                           | Day 03 |

所以今天真正要寫的只有兩樣：一個清洗的 domain service，以及一個把順序串起來的 application。這不是巧合——**Day 03 那些 service 當初就是照「不做 I/O、不吃介面」設計的，所以它們可以在完全不同的場景裡被第二次使用**。如果當時把「查缺口」寫死在回補流程裡，今天就得再寫一份給資料庫用，而兩份實作遲早會對不起來。

### 設定檔

管線要顧哪些東西，寫在設定檔裡，不寫在程式碼裡：

```yaml
# quantbot/infrastructure/configuration/pipeline.yaml
defaults:
  market: spot            # 現貨。永續合約的資料 NEVER 跟現貨混在同一張表
  start: "2024-01-01"
  max_concurrency: 4

symbols:
  - symbol: BTC/USDT
    timeframes: ["1m", "1h"]
  - symbol: ETH/USDT
    timeframes: ["1m", "1h"]
  - symbol: SOL/USDT
    timeframes: ["1h"]

crosscheck:
  provider: coingecko
  sample_days: 5
  tolerance: 0.01         # 相對差超過 1% 就在報告裡標出來
```

YAML 長什麼樣子是 infrastructure 的細節，domain 只認得一個值物件：

```python
# quantbot/domain/values/pipeline_configuration.py
from dataclasses import dataclass

import pandas as pd

from quantbot.domain.values.instrument import Instrument


@dataclass(frozen=True)
class PipelineConfiguration:
    """管線要顧哪些東西。純資料，由 infrastructure 的 YAML loader 建出來。"""

    instruments: tuple[Instrument, ...]
    history_start: pd.Timestamp
    maximum_concurrency: int = 4
    cross_check_tolerance: float = 0.01
    cross_check_sample_days: int = 5

    def __post_init__(self) -> None:
        if not self.instruments:
            raise ValueError("設定檔裡沒有任何 instrument")
        if self.history_start.tz is None:
            raise ValueError("history_start 必須是 tz-aware 的 UTC 時間")
```

```python
# quantbot/infrastructure/configuration/yaml_pipeline_configuration_loader.py
from __future__ import annotations

from pathlib import Path

import pandas as pd
import yaml

from quantbot.domain.values.instrument import Instrument
from quantbot.domain.values.market import Market
from quantbot.domain.values.pipeline_configuration import PipelineConfiguration
from quantbot.domain.values.timeframe import Timeframe


class YamlPipelineConfigurationLoader:
    """把 YAML 讀成 PipelineConfiguration。

    YAML 的長相是 infrastructure 的細節；domain 只認得 PipelineConfiguration
    這個值物件。所以要換成 TOML 或環境變數，只要多寫一個 loader。
    """

    def load(self, path: Path) -> PipelineConfiguration:
        document = yaml.safe_load(path.read_text())
        defaults = document["defaults"]
        market = Market(defaults["market"])

        instruments = tuple(
            Instrument(
                symbol=entry["symbol"],
                market=market,
                timeframe=Timeframe(timeframe_value),
            )
            for entry in document["symbols"]
            for timeframe_value in entry["timeframes"]
        )
        crosscheck = document.get("crosscheck", {})

        return PipelineConfiguration(
            instruments=instruments,
            history_start=pd.Timestamp(defaults["start"], tz="UTC"),
            maximum_concurrency=defaults.get("max_concurrency", 4),
            cross_check_tolerance=crosscheck.get("tolerance", 0.01),
            cross_check_sample_days=crosscheck.get("sample_days", 5),
        )
```

這樣切的好處在測試時最明顯：要測「三個交易對兩種 timeframe 會展開成六組」，直接建 `PipelineConfiguration` 就好，不必寫一個 YAML 檔到硬碟上。

### 清洗與異常值

資料拿回來之後、入庫之前，過一次清洗。這裡要先訂一條政策：**什麼該丟、什麼該標記**。

結構上不可能是真的資料才丟，例如 high 比 low 小、或出現負數的價格與成交量。這種列留著只會讓後面的計算產生沒人看得懂的結果。其他看起來不對勁但可能是真的，一律保留並標記，因為市場上真的會出現看起來不合理的資料。要做的是讓它出現在報告裡、由人決定要不要處理，而不是讓管線悄悄替我們決定。

```python
# quantbot/domain/services/candle_sanitation_service.py
from __future__ import annotations

from collections.abc import Mapping
from types import MappingProxyType
from typing import ClassVar

import pandas as pd

from quantbot.domain.entities.candle_series import CandleSeries
from quantbot.domain.values.candle_columns import CandleColumns
from quantbot.domain.values.sanitation_outcome import SanitationOutcome


class CandleSanitationService:
    """入庫前的清洗與異常標記。

    政策只有一條：**結構上不可能為真的丟掉，看起來不對勁但可能是真的保留並標記。**
    市場上真的會出現看起來不合理的資料，要做的是讓它進報告、由人決定，
    而不是讓管線悄悄替我們決定。
    """

    FATAL_FLAGS: ClassVar[tuple[str, ...]] = ("ohlc_invalid", "negative_value")
    # 單根 K 線的合理跳動上限。1 分鐘跳 5% 跟日線跳 5% 是完全不同的事件，
    # 用同一個數字沒有意義，所以門檻跟 timeframe 綁在一起。
    MAXIMUM_ABSOLUTE_RETURNS: ClassVar[Mapping[str, float]] = MappingProxyType(
        {
            "1m": 0.05,
            "5m": 0.08,
            "15m": 0.12,
            "1h": 0.20,
            "4h": 0.30,
            "1d": 0.50,
        }
    )

    def sanitize(self, series: CandleSeries) -> SanitationOutcome:
        candles = series.frame
        flags = self._flag(candles, series.instrument.timeframe.value)
        fatal = flags[list(self.FATAL_FLAGS)].any(axis=1)

        return SanitationOutcome(
            accepted=CandleSeries(series.instrument, candles.loc[~fatal]),
            anomalies=candles.join(flags).loc[flags.any(axis=1)],
        )

    def maximum_absolute_return(self, timeframe_value: str) -> float:
        if timeframe_value not in self.MAXIMUM_ABSOLUTE_RETURNS:
            raise ValueError(f"沒有為 {timeframe_value} 訂跳動門檻")
        return self.MAXIMUM_ABSOLUTE_RETURNS[timeframe_value]

    def _flag(self, candles: pd.DataFrame, timeframe_value: str) -> pd.DataFrame:
        """四個向量化的標記，沒有一行在遍歷 K 線。"""
        body_high = candles[["open", "close"]].max(axis=1)
        body_low = candles[["open", "close"]].min(axis=1)

        flags = pd.DataFrame(index=candles.index)
        flags["ohlc_invalid"] = (
            (candles["high"] < candles["low"])
            | (candles["high"] < body_high)
            | (candles["low"] > body_low)
        )
        flags["negative_value"] = (candles[list(CandleColumns.all_columns())] < 0).any(
            axis=1
        )
        flags["zero_volume"] = candles["volume"].eq(0)
        flags["price_jump"] = candles["close"].pct_change().abs() > (
            self.maximum_absolute_return(timeframe_value)
        )
        return flags
```

```python
# quantbot/domain/values/sanitation_outcome.py
from dataclasses import dataclass

import pandas as pd

from quantbot.domain.entities.candle_series import CandleSeries


@dataclass(frozen=True)
class SanitationOutcome:
    """清洗的產出。兩邊都要留：報告要講的是被丟掉的那些列。"""

    accepted: CandleSeries  # 可入庫的
    anomalies: pd.DataFrame  # 所有被標記的列，含仍留在 accepted 裡的那些

    @property
    def rejected_bar_count(self) -> int:
        if self.anomalies.empty:
            return 0
        fatal = self.anomalies[["ohlc_invalid", "negative_value"]].any(axis=1)
        return int(fatal.sum())

    def counts_by_flag(self) -> dict[str, int]:
        flags = ["ohlc_invalid", "negative_value", "zero_volume", "price_jump"]
        if self.anomalies.empty:
            return dict.fromkeys(flags, 0)
        return {flag: int(self.anomalies[flag].sum()) for flag in flags}
```

四個標記各自在抓什麼：

| 標記               | 通常代表什麼                                                   | 處理    |
|------------------|----------------------------------------------------------|-------|
| `ohlc_invalid`   | 欄位順序對映錯了。官方 CSV 沒有標頭，Day 03 是靠文件排欄位的，排錯就會出現 high 比 low 小 | 丟棄並記錄 |
| `negative_value` | 型別轉換出問題，或讀到了非 OHLCV 的欄位                                  | 丟棄並記錄 |
| `zero_volume`    | 冷門交易對真的沒人成交（此時 OHLC 四個數字會相同），或抓錯了成交量欄位                   | 保留並標記 |
| `price_jump`     | 真的有一波急跌急漲，或是資料源給了髒資料                                     | 保留並標記 |

跳動門檻跟 timeframe 綁在一起，而且它問的是 `series.instrument.timeframe`——不是另外傳一個字串進來。Day 03 把 timeframe 做成值物件之後，「這是哪一種粒度」就一路跟著資料走，不會有人在第四層呼叫時傳錯。

`ohlc_invalid` 那條特別值得跑一次。欄位對映錯誤是這個階段最常見的錯誤，而且它不會噴例外，只會讓之後每一張圖都長得怪怪的。

### 串起來

```python
# quantbot/application/ingest_pipeline_application.py
from __future__ import annotations

import asyncio
from collections.abc import Mapping

import pandas as pd

from quantbot.domain.dto.data_integrity_report import DataIntegrityReportDto
from quantbot.domain.dto.pipeline_report import InstrumentReportDto, PipelineReportDto
from quantbot.domain.dto.price_cross_check_report import PriceCrossCheckReportDto
from quantbot.domain.interfaces.candle_repository import CandleRepository
from quantbot.domain.interfaces.candle_source import CandleSource
from quantbot.domain.interfaces.clock import Clock
from quantbot.domain.interfaces.reference_price_source import ReferencePriceSource
from quantbot.domain.services.candle_sanitation_service import CandleSanitationService
from quantbot.domain.services.data_integrity_service import DataIntegrityService
from quantbot.domain.services.price_cross_check_service import PriceCrossCheckService
from quantbot.domain.services.source_routing_service import SourceRoutingService
from quantbot.domain.values.instrument import Instrument
from quantbot.domain.values.pipeline_configuration import PipelineConfiguration
from quantbot.domain.values.source_kind import SourceKind
from quantbot.domain.values.time_range import TimeRange


class IngestPipelineApplication:
    """六個步驟的編排：盤點 → 路由 → 取得 → 清洗 → 入庫 → 複驗。

    它自己不查缺口、不決定路由、不清洗、不寫資料庫、不打任何 HTTP——那幾件事
    各有主人。它負責的是順序、併發，以及把每一段的結果收進報告。

    建構參數全部是介面或 domain service，所以測試時只要對最外層的介面做替身。
    """

    def __init__(
        self,
        configuration: PipelineConfiguration,
        *,
        sources: Mapping[SourceKind, CandleSource],
        repository: CandleRepository,
        reference: ReferencePriceSource,
        routing: SourceRoutingService,
        integrity: DataIntegrityService,
        sanitation: CandleSanitationService,
        cross_check: PriceCrossCheckService,
        clock: Clock,
    ) -> None:
        self._configuration = configuration
        self._sources = sources
        self._repository = repository
        self._reference = reference
        self._routing = routing
        self._integrity = integrity
        self._sanitation = sanitation
        self._cross_check = cross_check
        self._clock = clock
        self._semaphore = asyncio.Semaphore(configuration.maximum_concurrency)

    async def run(self) -> PipelineReportDto:
        now = self._clock.now()
        reports = await asyncio.gather(
            *(
                self._synchronize(instrument, now=now)
                for instrument in self._configuration.instruments
            ),
            # 單一 instrument 失敗不拖垮整批，但失敗本身要進報告
            return_exceptions=True,
        )
        return PipelineReportDto(
            run_at=now,
            instrument_reports=tuple(
                self._as_report(instrument, outcome)
                for instrument, outcome in zip(
                    self._configuration.instruments, reports, strict=True
                )
            ),
        )

    async def _synchronize(
        self, instrument: Instrument, *, now: pd.Timestamp
    ) -> InstrumentReportDto:
        async with self._semaphore:
            report = InstrumentReportDto(instrument=instrument)
            # 右端一律往下取整到整根 K 線，排除還沒收完的那一根
            period = TimeRange(
                self._configuration.history_start, instrument.timeframe.floor(now)
            )

            # [1] 盤點
            report.integrity_before = await self._inspect(instrument, period)

            # [2][3][4][5] 每段缺口：路由 → 取得 → 清洗 → 入庫
            for gap in report.integrity_before.gaps:
                gap_period = TimeRange(gap.start, gap.end + instrument.timeframe.step)
                for instruction in self._routing.route(gap_period, now=now):
                    fetched = await self._sources[instruction.source_kind].load(
                        instrument, instruction.period
                    )
                    outcome = self._sanitation.sanitize(fetched)
                    self._accumulate_anomalies(report, outcome.counts_by_flag())
                    written = await self._repository.save(
                        outcome.accepted, source=str(instruction.source_kind)
                    )
                    report.written_bar_counts[str(instruction.source_kind)] = (
                        report.written_bar_counts.get(str(instruction.source_kind), 0)
                        + written
                    )

            # [6] 複驗：同一個 DataIntegrityService 再跑一次，缺口應該是空的
            report.integrity_after = await self._inspect(instrument, period)
            report.cross_check = await self._verify_against_reference(
                instrument, now=now
            )
            return report

    async def _inspect(
        self, instrument: Instrument, period: TimeRange
    ) -> DataIntegrityReportDto:
        open_times = await self._repository.existing_open_times(instrument, period)
        return self._integrity.inspect(
            open_times, period=period, timeframe=instrument.timeframe
        )

    async def _verify_against_reference(
        self, instrument: Instrument, *, now: pd.Timestamp
    ) -> PriceCrossCheckReportDto | None:
        if not self._reference.supports(instrument.symbol):
            return None  # 沒有對照來源就留空，NEVER 默默當成通過

        window = TimeRange(
            now - pd.Timedelta(days=self._configuration.cross_check_sample_days), now
        )
        theirs = await self._reference.daily_close(instrument.symbol, window)
        ours = await self._repository.read(instrument, window)
        return self._cross_check.compare(
            ours.frame["close"].resample("1D").last().rename("ours"),
            theirs,
            reference_name=self._reference.name,
        )

    @staticmethod
    def _accumulate_anomalies(
        report: InstrumentReportDto, counts: Mapping[str, int]
    ) -> None:
        for flag, count in counts.items():
            report.anomaly_counts[flag] = report.anomaly_counts.get(flag, 0) + count

    @staticmethod
    def _as_report(
        instrument: Instrument, outcome: InstrumentReportDto | BaseException
    ) -> InstrumentReportDto:
        if isinstance(outcome, BaseException):
            return InstrumentReportDto(
                instrument=instrument, failure=f"{type(outcome).__name__}: {outcome}"
            )
        return outcome
```

這個類別有幾件事值得指出來。

**它沒有 import 任何 infrastructure。** 建構參數是四個 domain service 加四個 `Protocol`，所以要換掉資料庫、換掉交易所、換掉對照組，改的是組裝根。這也是為什麼下一節的測試只需要三個替身就能測完整條管線。

**`return_exceptions=True` 加上把例外收進報告。** 單一交易對失敗不拖垮整批，但失敗**必須**出現在報告裡並讓 exit code 變成非 0。吞掉例外只印個 log 是最糟的組合：批次看起來成功了，而某個交易對已經好幾天沒補到。

**`_synchronize` 讀起來就是那六個步驟。** 盤點、路由、取得、清洗、入庫、複驗，每一行都是一次委派。這是分層做對了的樣子：編排的程式碼裡沒有任何計算，計算的程式碼裡沒有任何編排。

**複驗用的是同一個 `DataIntegrityService` 實例。** 步驟 [6] 不是另一套檢查，它就是步驟 [1] 再跑一次。管線自己驗自己補完了沒有，比事後開 notebook 查快得多，也不會忘記做。

### 報告與 exit code

報告是 DTO，渲染是 infrastructure：

```python
# quantbot/domain/dto/pipeline_report.py
from dataclasses import dataclass, field

import pandas as pd

from quantbot.domain.dto.data_integrity_report import DataIntegrityReportDto
from quantbot.domain.dto.price_cross_check_report import PriceCrossCheckReportDto
from quantbot.domain.values.instrument import Instrument


@dataclass
class InstrumentReportDto:
    """單一 instrument 這一輪做了什麼、結果如何。"""

    instrument: Instrument
    integrity_before: DataIntegrityReportDto | None = None
    integrity_after: DataIntegrityReportDto | None = None
    written_bar_counts: dict[str, int] = field(default_factory=dict)
    anomaly_counts: dict[str, int] = field(default_factory=dict)
    cross_check: PriceCrossCheckReportDto | None = None
    failure: str | None = None

    @property
    def ok(self) -> bool:
        if self.failure is not None:
            return False
        if self.integrity_after is not None and not self.integrity_after.is_complete:
            return False
        return self.cross_check is None or self.cross_check.passed


@dataclass(frozen=True)
class PipelineReportDto:
    """整輪的報告。exit code 由它決定。"""

    run_at: pd.Timestamp
    instrument_reports: tuple[InstrumentReportDto, ...]

    @property
    def ok(self) -> bool:
        return all(report.ok for report in self.instrument_reports)
```

```python
# quantbot/infrastructure/reporting/text_pipeline_report_renderer.py
from __future__ import annotations

from quantbot.domain.dto.pipeline_report import InstrumentReportDto, PipelineReportDto


class TextPipelineReportRenderer:
    """把報告 DTO 印成給人看的文字。

    渲染是輸出格式，屬於 infrastructure。哪天要改成 JSON 給 Grafana 吃、
    或改成 Markdown 貼進 Telegram，多寫一個 renderer 就好，
    application 與 DTO 一個字都不用改。
    """

    def render(self, report: PipelineReportDto) -> str:
        lines = [
            "=== quantbot data integrity report ===",
            f"run_at : {report.run_at.isoformat()}",
            "",
        ]
        for instrument_report in report.instrument_reports:
            lines.extend(self._render_instrument(instrument_report))
            lines.append("")

        failed = sum(1 for one in report.instrument_reports if not one.ok)
        lines.append(f"result : {'PASS' if report.ok else 'FAIL'}（{failed} 個未通過）")
        lines.append(f"exit   : {0 if report.ok else 1}")
        return "\n".join(lines)

    def _render_instrument(self, report: InstrumentReportDto) -> list[str]:
        lines = [report.instrument.storage_key]
        if report.failure is not None:
            return [*lines, f"  失敗           {report.failure}"]

        before, after = report.integrity_before, report.integrity_after
        if before is not None:
            lines.append(
                f"  預期 / 實際    {before.expected_bar_count:,} / "
                f"{before.actual_bar_count:,}   ({before.coverage_ratio:.2%})"
            )
            lines.append(
                f"  回補前缺口     {len(before.gaps)} 段, "
                f"共 {before.missing_bar_count} 根"
            )
        written = " / ".join(
            f"{source} {count}"
            for source, count in sorted(report.written_bar_counts.items())
        )
        lines.append(f"  本次寫入       {written or '無'}")
        if after is not None:
            lines.append(f"  回補後缺口     {len(after.gaps)} 段")
        if report.anomaly_counts:
            anomalies = " / ".join(
                f"{flag} {count}"
                for flag, count in sorted(report.anomaly_counts.items())
            )
            lines.append(f"  異常標記       {anomalies}")
        if report.cross_check is not None:
            check = report.cross_check
            lines.append(
                f"  對照組 {check.reference_name}（容許 {check.tolerance:.2%}）"
                f"    最大相對差 {check.maximum_relative_difference:.2%}"
                f"    {'PASS' if check.passed else 'FAIL  需人工確認'}"
            )
        else:
            lines.append("  對照組         SKIP（這個交易對沒有對照來源）")
        return lines
```

分開的理由跟前面幾天一樣：`ok` 這個判斷是領域規則（有沒有補完、對照過不過），而「印成什麼樣子」是輸出格式。Day 25 要把它推到 Telegram、Day 28 要存成結構化日誌時，多寫一個 renderer 就好，`PipelineReportDto` 一個字都不用改。

### 組裝

```python
# quantbot/entrypoints/ingest_pipeline_command.py
"""把設定檔裡所有交易對補到最新，並輸出一份資料完整性報告。

uv run python -m quantbot.entrypoints.ingest_pipeline_command
"""

from __future__ import annotations

import asyncio
from pathlib import Path

import ccxt.async_support as ccxt
import httpx

from quantbot.application.ingest_pipeline_application import IngestPipelineApplication
from quantbot.config import settings
from quantbot.domain.services.candle_sanitation_service import CandleSanitationService
from quantbot.domain.services.data_integrity_service import DataIntegrityService
from quantbot.domain.services.price_cross_check_service import PriceCrossCheckService
from quantbot.domain.services.source_routing_service import SourceRoutingService
from quantbot.domain.values.source_kind import SourceKind
from quantbot.infrastructure.binance.binance_archive_candle_source import (
    BinanceArchiveCandleSource,
)
from quantbot.infrastructure.binance.binance_archive_downloader import (
    BinanceArchiveDownloader,
)
from quantbot.infrastructure.binance.binance_archive_url_builder import (
    BinanceArchiveUrlBuilder,
)
from quantbot.infrastructure.binance.binance_candle_csv_parser import (
    BinanceCandleCsvParser,
)
from quantbot.infrastructure.binance.binance_rate_limit_guard import (
    BinanceRateLimitGuard,
)
from quantbot.infrastructure.binance.binance_rest_candle_source import (
    BinanceRestCandleSource,
)
from quantbot.infrastructure.coingecko.coingecko_reference_price_source import (
    CoinGeckoReferencePriceSource,
)
from quantbot.infrastructure.configuration.yaml_pipeline_configuration_loader import (
    YamlPipelineConfigurationLoader,
)
from quantbot.infrastructure.persistence.postgres_database import PostgresDatabase
from quantbot.infrastructure.persistence.timescale_candle_repository import (
    TimescaleCandleRepository,
)
from quantbot.infrastructure.reporting.text_pipeline_report_renderer import (
    TextPipelineReportRenderer,
)
from quantbot.infrastructure.system_clock import SystemClock

CONFIGURATION_PATH = Path("quantbot/infrastructure/configuration/pipeline.yaml")


async def main() -> int:
    configuration = YamlPipelineConfigurationLoader().load(CONFIGURATION_PATH)
    database = PostgresDatabase.from_settings()
    url_builder = BinanceArchiveUrlBuilder()
    exchange = ccxt.binance({"enableRateLimit": True})

    async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
        try:
            application = IngestPipelineApplication(
                configuration,
                sources={
                    SourceKind.ARCHIVE: BinanceArchiveCandleSource(
                        BinanceArchiveDownloader(
                            client,
                            url_builder,
                            cache_directory=settings.raw_data_directory,
                        ),
                        url_builder,
                        BinanceCandleCsvParser(),
                    ),
                    SourceKind.REST: BinanceRestCandleSource(
                        exchange, BinanceRateLimitGuard()
                    ),
                },
                repository=TimescaleCandleRepository(database),
                reference=CoinGeckoReferencePriceSource(
                    client, api_key=settings.coingecko_api_key
                ),
                routing=SourceRoutingService(),
                integrity=DataIntegrityService(),
                sanitation=CandleSanitationService(),
                cross_check=PriceCrossCheckService(
                    tolerance=configuration.cross_check_tolerance
                ),
                clock=SystemClock(),
            )
            report = await application.run()
        finally:
            await exchange.close()
            await database.close()

    print(TextPipelineReportRenderer().render(report))
    return 0 if report.ok else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
```

這個檔案很長，而且**它應該是全專案唯一長成這樣的檔案**，在這邊建議讀者直接複製程式碼的部分，畢竟程式碼在現在這個時代已經可以透過 AI 快速生成了。

另外，注意最後那個 exit code。管線不是「跑完就算成功」，而是「回補後還有缺口、有致命異常、或對照組沒過，就回傳非 0」。cron 抓得到 exit code，Day 25 接上 Telegram 告警時，這一行就是觸發條件。

### 跑起來

這支指令會寫資料庫，所以 schema 要先在。兩件前置，順序不能顛倒：

```bash
# 1. 資料庫起來
docker compose -f docker/docker-compose.yml up -d

# 2. 套用 Day 07 的三個 migration（已經套過的話會印「沒有待套用的 migration」）
uv run python -m quantbot.infrastructure.persistence.migrate
```

不需要先跑 Day 03 的 `backfill_command`。管線自己會盤點缺口、自己決定走批次還是 REST、自己入庫——那正是今天在做的事。空資料庫直接跑就可以：

```bash
uv run python -m quantbot.entrypoints.ingest_pipeline_command
```

設定檔涵蓋三個交易對、五組 instrument、資料從 2024-01-01 起算，所以第一次跑會下載不少東西。跑完長這樣：

```
=== quantbot data integrity report ===
run_at : 2026-08-02T10:49:47.496355+00:00

spot_BTCUSDT_1m
  預期 / 實際    1,360,009 / 44,640   (3.28%)
  回補前缺口     2 段, 共 1315369 根
  本次寫入       archive 1311840 / rest 3529
  回補後缺口     0 段
  異常標記       negative_value 0 / ohlc_invalid 0 / price_jump 0 / zero_volume 0
  對照組 coingecko（容許 1.00%）    最大相對差 0.36%    PASS

spot_BTCUSDT_1h
  預期 / 實際    22,666 / 0   (0.00%)
  回補前缺口     1 段, 共 22666 根
  本次寫入       archive 22608 / rest 58
  回補後缺口     0 段
  異常標記       negative_value 0 / ohlc_invalid 0 / price_jump 0 / zero_volume 0
  對照組 coingecko（容許 1.00%）    最大相對差 0.36%    PASS

spot_ETHUSDT_1m
  預期 / 實際    1,360,009 / 0   (0.00%)
  回補前缺口     1 段, 共 1360009 根
  本次寫入       archive 1356480 / rest 3529
  回補後缺口     0 段
  異常標記       negative_value 0 / ohlc_invalid 0 / price_jump 4 / zero_volume 0
  對照組 coingecko（容許 1.00%）    最大相對差 0.71%    PASS

spot_ETHUSDT_1h
  預期 / 實際    22,666 / 0   (0.00%)
  回補前缺口     1 段, 共 22666 根
  本次寫入       archive 22608 / rest 58
  回補後缺口     0 段
  異常標記       negative_value 0 / ohlc_invalid 0 / price_jump 0 / zero_volume 0
  對照組 coingecko（容許 1.00%）    最大相對差 0.71%    PASS

spot_SOLUSDT_1h
  預期 / 實際    22,666 / 0   (0.00%)
  回補前缺口     1 段, 共 22666 根
  本次寫入       archive 22608 / rest 58
  回補後缺口     0 段
  異常標記       negative_value 0 / ohlc_invalid 0 / price_jump 0 / zero_volume 0
  對照組 coingecko（容許 1.00%）    最大相對差 0.70%    PASS

result : PASS（0 個未通過）
exit   : 0
```

有幾行值得停下來看。

**第一行的 `44,640 / 3.28%`。** 這是 Day 07 那句 `backfill_command --store` 灌進去的 2025 年 3 月，管線盤點時看到它已經在庫裡，於是缺口算出來是兩段而不是一整段——中間那個月被跳過了。沒跑過 Day 07 的話這裡會是 `0 / 0.00%`、缺口一段，結果完全一樣，只是少省一點事。

**每一行的 `archive` 與 `rest` 是分開計數的。** BTC 1m 是 1,311,840 根走批次檔、3,529 根走 REST，切點就是 Day 03 那條「月檔次月初才上傳」的規則：上個月以前走批次，這個月走 REST。這也是為什麼管線寫進資料庫的 `source` 分得出來，而 `backfill_command --store` 只能一律寫 `'backfill'`。

**`spot_ETHUSDT_1m` 的 `price_jump 4`。** 四根被標記為單根跳動過大。它們照樣入庫了——`price_jump` 是提示不是拒收，因為加密貨幣真的會在幾分鐘內跳幾個百分點，而清洗階段沒有資格替我們判斷那是壞資料還是真行情。`ohlc_invalid` 才是會被擋下來的那種。

**exit code 是 0。** 五組全數 PASS，cron 不會告警。

接著三分鐘後原封不動再跑一次，這次的報告才是重點：

```
=== quantbot data integrity report ===
run_at : 2026-08-02T10:52:55.152031+00:00

spot_BTCUSDT_1m
  預期 / 實際    1,360,012 / 1,360,009   (100.00%)
  回補前缺口     1 段, 共 3 根
  本次寫入       rest 3
  回補後缺口     0 段
  異常標記       negative_value 0 / ohlc_invalid 0 / price_jump 0 / zero_volume 0
  對照組 coingecko（容許 1.00%）    最大相對差 0.36%    PASS

spot_BTCUSDT_1h
  預期 / 實際    22,666 / 22,666   (100.00%)
  回補前缺口     0 段, 共 0 根
  本次寫入       無
  回補後缺口     0 段
  對照組 coingecko（容許 1.00%）    最大相對差 0.36%    PASS
```

（其餘三組跟 `spot_BTCUSDT_1h` 一樣，都是「本次寫入 無」。）

三個 1h 的 instrument 全部是「本次寫入 無」，一根都沒重寫。兩個 1m 的各補了 3 根——那不是重複寫入，那就是這三分鐘裡真的新產生的三根 1 分鐘 K 線，而且它們走 `rest`，因為這個月的月檔還不存在。

冪等在這裡不是靠「記得跑過了」，是三層各擋一半：管線先盤點缺口，沒缺就不抓；抓回來的資料走 `ON CONFLICT DO NOTHING`，撞到主鍵就跳過；而「最後一根還沒收完」由 `closed_only` 在入庫前就丟掉，所以進行式的 K 線根本沒有機會被寫進去、再也改不掉。任何一層單獨都不夠。

### 測試：只對最外層做替身

```python
# tests/application/test_ingest_pipeline_application.py
"""管線的測試：注入真實的 domain service，只對最外層的 Protocol 做替身。

替身一律用 create_autospec(..., spec_set=True)——簽章會被檢查，所以 Protocol
改了方法名或參數，這裡會紅。NEVER 手寫 fake 類別。
"""

from unittest.mock import create_autospec

import pandas as pd
import pytest

from quantbot.application.ingest_pipeline_application import IngestPipelineApplication
from quantbot.domain.entities.candle_series import CandleSeries
from quantbot.domain.interfaces.candle_repository import CandleRepository
from quantbot.domain.interfaces.candle_source import CandleSource
from quantbot.domain.interfaces.clock import Clock
from quantbot.domain.interfaces.reference_price_source import ReferencePriceSource
from quantbot.domain.services.candle_sanitation_service import CandleSanitationService
from quantbot.domain.services.data_integrity_service import DataIntegrityService
from quantbot.domain.services.price_cross_check_service import PriceCrossCheckService
from quantbot.domain.services.source_routing_service import SourceRoutingService
from quantbot.domain.values.instrument import Instrument
from quantbot.domain.values.market import Market
from quantbot.domain.values.pipeline_configuration import PipelineConfiguration
from quantbot.domain.values.source_kind import SourceKind
from quantbot.domain.values.time_range import TimeRange
from quantbot.domain.values.timeframe import Timeframe

NOW = pd.Timestamp("2026-09-22 04:30", tz="UTC")
HISTORY_START = pd.Timestamp("2026-09-22 00:00", tz="UTC")
INSTRUMENT = Instrument(
    symbol="BTC/USDT", market=Market.SPOT, timeframe=Timeframe("1h")
)


def complete_open_times() -> pd.DatetimeIndex:
    """這段期間「應該」有的每一根開盤時間。"""
    timeframe = INSTRUMENT.timeframe
    return timeframe.expected_open_times(TimeRange(HISTORY_START, timeframe.floor(NOW)))


def make_candles(start: str, bar_count: int, *, close: float = 100.0) -> CandleSeries:
    index = pd.date_range(
        start, periods=bar_count, freq="1h", tz="UTC", name="open_time"
    )
    return CandleSeries(
        INSTRUMENT,
        pd.DataFrame(
            {
                "open": close,
                "high": close * 1.01,
                "low": close * 0.99,
                "close": close,
                "volume": 1.0,
            },
            index=index,
        ),
    )


def build_pipeline(*, existing: pd.DatetimeIndex, fetched: CandleSeries):
    repository = create_autospec(CandleRepository, spec_set=True, instance=True)
    # 盤點時回傳既有的開盤時間，複驗時回傳「補完之後」的完整時間軸
    repository.existing_open_times.side_effect = [
        existing,
        complete_open_times(),
    ]
    repository.save.return_value = len(fetched)

    source = create_autospec(CandleSource, spec_set=True, instance=True)
    source.load.return_value = fetched

    reference = create_autospec(ReferencePriceSource, spec_set=True, instance=True)
    reference.supports.return_value = False

    clock = create_autospec(Clock, spec_set=True, instance=True)
    clock.now.return_value = NOW

    application = IngestPipelineApplication(
        PipelineConfiguration(instruments=(INSTRUMENT,), history_start=HISTORY_START),
        sources={SourceKind.ARCHIVE: source, SourceKind.REST: source},
        repository=repository,
        reference=reference,
        routing=SourceRoutingService(),
        integrity=DataIntegrityService(),
        sanitation=CandleSanitationService(),
        cross_check=PriceCrossCheckService(),
        clock=clock,
    )
    return application, repository, source, reference


@pytest.mark.asyncio
async def test_gaps_are_fetched_and_written_then_reverified():
    existing = complete_open_times().delete([1, 2])  # 少了兩根
    application, repository, source, _ = build_pipeline(
        existing=existing, fetched=make_candles("2026-09-22 01:00", 2)
    )

    report = await application.run()
    instrument_report = report.instrument_reports[0]

    assert instrument_report.integrity_before.missing_bar_count == 2
    assert instrument_report.integrity_after.is_complete
    assert sum(instrument_report.written_bar_counts.values()) == 2
    source.load.assert_awaited_once()
    repository.save.assert_awaited_once()
    assert instrument_report.ok and report.ok


@pytest.mark.asyncio
async def test_nothing_is_fetched_when_there_is_no_gap():
    application, repository, source, _ = build_pipeline(
        existing=complete_open_times(), fetched=CandleSeries.empty(INSTRUMENT)
    )

    report = await application.run()

    source.load.assert_not_awaited()
    repository.save.assert_not_awaited()
    assert report.instrument_reports[0].written_bar_counts == {}
    assert report.ok


@pytest.mark.asyncio
async def test_a_failing_instrument_does_not_take_down_the_batch():
    application, repository, _, _ = build_pipeline(
        existing=pd.DatetimeIndex([], tz="UTC"),
        fetched=CandleSeries.empty(INSTRUMENT),
    )
    repository.existing_open_times.side_effect = RuntimeError("連線掛了")

    report = await application.run()

    assert not report.ok
    assert "連線掛了" in report.instrument_reports[0].failure
```

這份測試是整套分層最直接的回報。它**注入真實的四個 domain service**（路由、缺漏、清洗、對照），只對 `CandleRepository`、`CandleSource`、`ReferencePriceSource`、`Clock` 這四個 `Protocol` 做替身——所以跑一次測試，連帶把 Day 03 的路由邏輯、缺漏偵測、`CandleSeries` 的合併規則全部測過一輪。這是刻意的測試力度放大。

替身一律用 `create_autospec(..., spec_set=True)`：它會照 Protocol 的簽章建替身，所以哪天 `CandleRepository.save` 多一個參數而忘了改呼叫端，紅的會是這裡，而不是上線之後。**NEVER 手寫 fake 類別**——手寫的替身不會跟著介面一起變。

還有一件事這份測試做不到，要講清楚：**冪等與交易語意不能用替身驗。** 把寫入通道換成替身，驗到的只會是替身自己的行為。那幾條保證是 Day 07 那些整合測試的工作，要用真的 PostgreSQL 跑。

### 排程

先用 cron，機器時區設 UTC：

```
# crontab -e
5 * * * * cd /srv/quantbot && flock -n /tmp/quantbot-ingest.lock \
    /usr/local/bin/uv run python -m quantbot.entrypoints.ingest_pipeline_command \
    >> /var/log/quantbot/ingest.log 2>&1
```

每小時第 5 分鐘跑，避開整點那一根 K 線剛收完、交易所還在寫入的那幾十秒。`flock -n` 是防止上一輪還沒跑完就啟動下一輪；管線本身雖然冪等，但兩個行程同時對同一段做回補只是白白消耗 rate limit 額度。

Day 27 部署時這段會換成容器內的排程，跟其他服務一起用 Docker Compose 管，屆時 log 也會改成結構化輸出。今天先用 cron，因為它現在就能動。

## 驗證：管線的最後一步是對照組

Day 01 訂的六條選型原則裡，第五條是「每個主來源都要有對照組」。Day 03 已經把它寫成了 `ReferencePriceSource` 這個介面加上 `PriceCrossCheckService` 這個 domain service，今天要做的只有一件事：把它變成管線的固定步驟。

兩個候選的對照組用途不一樣，要分清楚：

- **CryptoDataDownload** 提供的就是 Binance 自己的資料，只是已經整理成 CSV。所以自己的資料跟它應該幾乎完全相同，差異只可能來自時間戳定義。它適合抓欄位對映與時間戳偏移這類結構性錯誤，容許值可以設得很緊。
- **CoinGecko** 是跨交易所的參考價，跟單一交易所本來就有天然差異，加上 USDT 對美元也不是嚴格 1:1。它抓不出小數點後的問題，但抓得出「整段價格量級不對」「時間軸整體位移」「不小心抓成了永續合約」這種等級的錯。

管線裡用 CoinGecko，容許值 1%。設 1% 不是因為期待對到 1%，是因為超過 1% 通常代表出了上面那類錯誤。

程式碼今天一行都不用寫——`IngestPipelineApplication._verify_against_reference` 那幾行就是全部：

```python
    async def _verify_against_reference(self, instrument, *, now):
        if not self._reference.supports(instrument.symbol):
            return None   # 沒有對照來源就留空，NEVER 默默當成通過

        window = TimeRange(
            now - pd.Timedelta(days=self._configuration.cross_check_sample_days), now
        )
        theirs = await self._reference.daily_close(instrument.symbol, window)
        ours = await self._repository.read(instrument, window)
        return self._cross_check.compare(
            ours.frame["close"].resample("1D").last().rename("ours"),
            theirs,
            reference_name=self._reference.name,
        )
```

要換成 CryptoDataDownload，就多寫一個實作 `ReferencePriceSource` 的類別，然後改組裝根那一行。管線、比對邏輯、報告都不用動——這就是 Day 03 把對照組做成介面（而不是寫成一支函式）的理由。

抽樣不用比對全部歷史，每次跑抽最近幾天就夠，額度也省。CoinGecko 免費層每月 10,000 credits，一天抽五天、三個交易對，一個月大約 450 次呼叫，離上限還很遠。

比對沒過的時候，管線不會自動修正，只會在報告裡標出來並讓 exit code 變成非 0。這是刻意的：對不上的原因可能是自己的資料錯了，也可能是那天兩個來源真的有落差，這個判斷需要人來做。

## 今日交付物

一支 `quantbot.entrypoints.ingest_pipeline_command`，能把設定檔裡所有交易對補到最新，並輸出一份資料完整性報告。

今天新增的檔案只有五個，其中兩個是報告的形狀：

```
quantbot/
├── domain/
│   ├── values/pipeline_configuration.py       今天
│   ├── values/sanitation_outcome.py           今天
│   ├── services/candle_sanitation_service.py  今天
│   └── dto/pipeline_report.py                 今天
├── application/ingest_pipeline_application.py 今天
├── infrastructure/
│   ├── configuration/yaml_pipeline_configuration_loader.py  今天
│   └── reporting/text_pipeline_report_renderer.py           今天
└── entrypoints/ingest_pipeline_command.py     今天
```

其他全部是前面五天寫好的東西被**第二次使用**：Day 03 的兩條 `CandleSource`、路由、缺漏偵測、對照組，Day 07 的 repository。

前面貼的兩份報告都是 PASS。對照組真的沒過的時候長這樣，這也是唯一會讓 exit code 變成 1 的常見情況：

```
=== quantbot data integrity report ===
run_at : 2026-09-22T04:00:00+00:00

spot_BTCUSDT_1m
  預期 / 實際    1,401,120 / 1,401,120   (100.00%)
  回補前缺口     2 段, 共 47 根
  本次寫入       rest 47
  回補後缺口     0 段
  異常標記       ohlc_invalid 0 / price_jump 1 / zero_volume 31
  對照組 coingecko（容許 1.00%）    最大相對差 0.06%    PASS

spot_ETHUSDT_1m
  預期 / 實際    1,401,120 / 1,401,120   (100.00%)
  回補前缺口     0 段, 共 0 根
  本次寫入       無
  回補後缺口     0 段
  對照組 coingecko（容許 1.00%）    最大相對差 4.11%    FAIL  需人工確認

result : FAIL（1 個未通過）
exit   : 1
```

「本次寫入 無」這一行是冪等的直接證據。第一次跑完之後，只要沒有新的缺口，之後每次跑這個欄位都應該是空的或只有零星幾根。

驗收標準，六項全過才算完成：

1. 先 `docker compose -f docker/docker-compose.yml up -d` 與 `uv run python -m quantbot.infrastructure.persistence.migrate`（Day 07 的三個 migration），再空資料庫跑第一次。跑完報告顯示每個交易對的「回補後缺口」都是 0 段。
2. 立刻再跑一次。報告的「本次寫入」是空的，或者只有這中間真的新收線的那幾根；`SELECT count(*)` 不會多出任何重複列。這是冪等。
3. 手動 `DELETE` 掉中間一段（例如三個月前的一整天，以及昨天的十分鐘），再跑一次。兩段都補回來了，而且報告裡標出前者走 archive、後者走 rest。這是路由邏輯。
4. 故意把清洗前的某幾列 `high` 與 `low` 對調，確認那幾列出現在報告的 `ohlc_invalid` 裡而且沒有進資料庫。
5. 對照組全數 PASS，exit code 為 0；或者有 FAIL 但報告明確指出是哪一天、差多少，exit code 為 1。
6. `uv run pytest`、`uv run mypy quantbot`、`uv run lint-imports` 全過。第一階段到今天收尾，這三個指令是它交出去的品質保證。

第三項是這六項裡最值得認真跑的。它同時驗到了盤點、路由與入庫三段，而且刪一段再補回來這個動作，之後每次懷疑資料有問題時都會用到。

寫到這邊，我發現我們實作的東西實在太多了，光是這七天就有 20 個檔案、超過 1,000 行程式碼。為了讓讀者不會在這些程式碼裡迷路，我將實作的專案開源至 [GitHub 專案](https://github.com/CodeMachine0121/quantbot) 供你們參考。

## 第一階段回顧：現在手上有什麼

七天下來，`quantbot` 從一個空專案長成了一條會自己跑的資料管線。

| Day | 建了什麼                                                   | 現在手上有                                                        |
|-----|--------------------------------------------------------|--------------------------------------------------------------|
| 02  | K 線的資料結構與時間戳規則                                         | 一張 UTC `DatetimeIndex` 的表，知道時間戳是開盤時間、知道最後一根不能用               |
| 03  | 分層骨架、`CandleSource` 介面、Binance 的六個類別、三個 domain service | 批次下載加 REST 補洞，會退避重試、看 weight 標頭讓路，而且 application 不認識 Binance |
| 04  | `Indicator` 基底類別 ＋ `SMA` ＋ `CrossoverSignals`          | SMA，含資料不足與有缺漏的邊界測試，以及未來函數的第一次警告                              |
| 05  | `EMA` ＋ `ReferenceEMA`                                 | EMA，遞迴指標的正確寫法，與兩個對照組誤差都在 1e-9 以內                             |
| 06  | `RSI` ＋ `WilderSmoother` ＋ `INDICATORS`                | RSI，Wilder 平滑；三個指標在同一張註冊表裡，暖機期問得出來                           |
| 07  | `CandleRepository` ＋ TimescaleDB 實作                    | hypertable、冪等寫入、1m 自動聚合出 5m 與 1h、壓縮政策                        |
| 08  | `IngestPipelineApplication` ＋ 清洗 ＋ 報告                  | 一條 cron 叫得動的管線，跑完產出一份完整性報告與 exit code                        |

把它整理成三件事：

- **一份查得快、不會重複、缺漏可查的歷史資料**，存在 TimescaleDB 裡，會自己每小時往前補。
- **三個自己實作、跟現成套件對過數字的指標**，介面統一在 `Indicator` 底下，Day 15 會直接搬進特徵模組。
- **一組會跟著我們到最後的習慣**：每個主來源配一個對照組、每個計算配一個測試、每次跑完都有東西可以看。

還有第四件事，它沒有出現在交付物清單上，但它是前面三件能撐下去的原因：**依賴方向從第三天起就一直指向核心。** 今天的管線之所以只寫了五個新檔案，是因為缺漏偵測、路由、對照組在 Day 03 就被放在「不做 I/O、不吃介面」的位置上——它們因此可以在完全不同的場景裡被第二次使用。這個投資在第二階段會領第二次利息：Day 09 的 Tick 資料是另一種 `CandleSource`、另一個 repository，而 `IngestPipelineApplication` 幾乎不用改。

## 免責聲明

本系列為程式與資料工程的技術分享，所有策略與數字皆為教學範例，不構成投資建議；加密貨幣波動劇烈，實際交易請自行評估風險。

## 明天

第一階段到今天結束，明天進入第二階段。

Day 02 講 K 線的時候留了一個伏筆：一根 1 分鐘 K 線把這一分鐘內所有成交壓成五個數字，開高低收加成交量。壓縮一定有損失，那一分鐘裡可能發生了 3 筆成交，也可能發生了 3000 筆；可能是一路緩慢上漲，也可能是先急殺再拉回，收在同一個價位。這五個數字看不出任何差別，而這七天算的所有指標都建在這五個數字上。

明天 Day 09 我們往下挖一層，去拿回被丟掉的那些資訊：**Tick**（每一筆成交的原始紀錄，不做任何壓縮）與 **L2 掛單簿**（此刻市場上還沒成交、正在等著的買賣單）。這兩種資料的量級跟 K 線完全不同，一天的資料就比一年的日線大好幾個數量級，所以「要存什麼」本身就是個需要先想清楚的問題。

第二階段（Day 09 到 Day 15）要做的東西，跟第一階段有一個明確的差別：MA、EMA、RSI 這三個指標，任何看盤軟體上都有現成的。接下來要做的特徵，別人的看盤軟體上沒有，因為那些都得自己從 Tick 與掛單簿算出來。
