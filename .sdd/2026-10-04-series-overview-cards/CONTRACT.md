# Contract Traceability Matrix — series-overview-cards

Contract: PRD.md
Design map: ARCH.md
Implementation: `src/`（Astro 靜態站）
Oracle: Acceptance Criteria（11 AC ＋ 4 BR ＋ 3 NFR = 18 clauses）

> **第二輪。** 第一輪 15/18：BR-04 只檢查名稱對得到系列、NFR-01 與 NFR-03 沒有測試；已補上三則建置測試並各自以突變確認可失敗。
>
> 靜態一致性稽核：先只依 PRD 推出預期結果，再分別判斷「測試是否斷言該結果」與「程式是否產生該結果」。建置測試的預期值由建置出的系列頁獨立推算（系列名稱、各篇日期與封面），不呼叫被測的函式。

縮寫：`SC` = `src/utils/tests/series-core.test.ts`；`UL` = `src/utils/tests/ui-language.test.ts`；`BO` = `tests/build-output.test.ts`「系列總覽封面卡片」；`SO` = `e2e/features/series-overview.feature`。

## Clauses

| ID | Clause | Spec-expected (oracle) | Impl | Test | Test audit | Code audit | Status |
|----|--------|------------------------|------|------|------------|------------|--------|
| AC-01 | US-01 依最後一篇文章的日期排序 | 最後一篇 2026-10-14 的系列排在 2026-10-05 之前 | `series-core.ts`（`groupIntoSeries` ＋ `lastPublishedOf`） | SC「最後一篇較新的系列排前面」＋ BO「卡片依各系列最後一篇文章的日期排序」 | asserts-oracle | produces-oracle | ✅ conforms |
| AC-02 | US-01 只看最後一篇，不看開始日期 | 較早開始但最後一篇較新的系列排前面 | 同上 | SC「只看最後一篇，不看開始日期」 | asserts-oracle | produces-oracle | ✅ conforms |
| AC-03 | US-01 中文介面的卡片資訊 | 「31 篇文章 · 更新於 2026年10月14日」 | `SeriesCard.astro`、`formatArticleCount`、`formatLastUpdated` | UL「formatLastUpdated」＋ BO「卡片顯示篇數與最後更新日期」（2025 系列：30 篇、2025年8月30日） | asserts-oracle | produces-oracle | ✅ conforms |
| AC-04 | US-01 英文介面的卡片資訊 | 「31 articles · Updated Oct 14, 2026」 | 同上 | BO（英文那一份）＋ SO「英文介面的卡片資訊」（每張卡片畫面上的文字） | asserts-oracle | produces-oracle | ✅ conforms |
| AC-05 | US-01 點卡片進入系列頁 | 進入該系列的系列頁 | `SeriesCard.astro`（整張卡片為連結） | BO「每張卡片都連到實際存在的系列頁」＋ SO「點卡片進入系列頁」 | asserts-oracle | produces-oracle | ✅ conforms |
| AC-06 | US-01 寬螢幕兩欄、手機一欄 | 寬螢幕兩張並排；手機每張一列 | `series.astro`（`sm:grid-cols-2`） | SO「寬螢幕卡片排成兩欄」「手機卡片排成一欄」 | asserts-oracle | produces-oracle | ✅ conforms |
| AC-07 | US-02 使用設定檔指定的封面 | 顯示設定檔的圖片 | `selectSeriesCover`、`series-covers.json` | SC「設定檔指定的封面優先」＋ BO「封面：…」（以設定檔為準；突變驗證：設定檔有值而卡片忽略時失敗） | asserts-oracle | produces-oracle | ✅ conforms |
| AC-08 | US-02 未指定時用最新一篇文章的封面 | 顯示最新一篇的封面 | `selectSeriesCover` | SC「未指定時用最新一篇文章的封面」＋ BO（2025 系列實際走此路徑） | asserts-oracle | produces-oracle | ✅ conforms |
| AC-09 | US-02 最新一篇沒有封面時往前找 | 顯示最新一篇「有封面」的文章的封面 | `selectSeriesCover`（先篩有封面者） | SC「最新一篇沒有封面時往前找…」 | asserts-oracle | produces-oracle | ✅ conforms |
| AC-10 | US-02 都沒有封面時顯示預設封面 | 顯示佔位封面 | `selectSeriesCover` 回傳 null → `SeriesCard` 佔位 | SC「都沒有封面時回傳 null」＋ BO（4 個系列實際走此路徑） | asserts-oracle | produces-oracle | ✅ conforms |
| AC-11 | US-02 設定檔中的系列名稱打錯會被擋下 | 建置檢查失敗並指出該名稱 | `tests/build-output.test.ts` | BO「封面設定檔的每個名稱都對得到網站上的系列」（失敗訊息列出對不到的名稱；突變驗證通過） | asserts-oracle | produces-oracle | ✅ conforms |
| BR-01 | 排序：依最後一篇文章的發布日期，新的在前 | 同 AC-01、AC-02 | 同上 | SC ＋ BO | asserts-oracle | produces-oracle | ✅ conforms |
| BR-02 | 最後更新日期：系列中發布日期最新的那一篇 | 與系列內順序、日期是否補零無關 | `lastPublishedOf`（以日期比較） | SC「lastPublishedOf…」兩則 | asserts-oracle | produces-oracle | ✅ conforms |
| BR-03 | 封面決定順序：設定檔 → 最新有封面的文章 → 佔位 | 同 AC-07～10 | `selectSeriesCover` | SC 五則 ＋ BO | asserts-oracle | produces-oracle | ✅ conforms |
| BR-04 | 設定檔以系列名稱對應封面網址；所有系列列在檔案中，未指定為空值 | 設定檔含網站上每個系列 | `src/config/series-covers.json`（5 個系列，皆為 `null`） | BO「網站上的每個系列都列在封面設定檔中」＋「每個名稱都對得到網站上的系列」 | asserts-oracle | produces-oracle | ✅ conforms |
| NFR-01 | 首屏以外的封面延遲載入；封面區固定比例 | 前兩張立即載入、其餘延遲；封面區 16:9 | `SeriesCard.astro`（`eager`、`aspect-[16/9]`） | BO「封面區固定 16:9；前兩張以外的封面延遲載入」 | asserts-oracle | produces-oracle | ✅ conforms |
| NFR-02 | 360px 起無橫向捲動 | 系列總覽在 360px 無橫向捲動 | `series.astro` | SO「手機卡片排成一欄」（含無橫向捲動）＋ RE 手機寬度情境 | asserts-oracle | produces-oracle | ✅ conforms |
| NFR-03 | 封面為裝飾性圖片，不重複朗讀 | 封面 `alt` 為空、佔位為 `aria-hidden` | `SeriesCard.astro` | BO「封面是裝飾性圖片，不會被重複朗讀」 | asserts-oracle | produces-oracle | ✅ conforms |

## Orphans (code with no clause)

| Code | Description | Verdict |
|------|-------------|---------|
| `README.md`「系列封面」 | 設定檔的用法說明 | undocumented（作者文件，非行為） |

## Summary

- Conforms: 18/18 clauses ✅ (100%)（第一輪 15/18；BR-04、NFR-01、NFR-03 補測試並以突變驗證後通過）
- Violations: —
- Mis-asserted: —
- Partial: —
- Gaps: —
- Unclear: —
- Orphans: 1
