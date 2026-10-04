# Contract Traceability Matrix — ui-language

Contract: PRD.md
Design map: ARCH.md
Implementation: `src/`（Astro 靜態站）
Oracle: Acceptance Criteria（18 AC ＋ 5 BR ＋ 4 NFR = 27 clauses）

> 靜態一致性稽核：先只依 PRD 推出預期結果，再分別判斷「測試是否斷言該結果」與「程式是否產生該結果」。
> 稽核過程中發現 3 處測試只斷言部分結果（英文介面下的文章標題原文、分頁標題與無障礙名稱、英文介面的手機寬度），已先補測試（`e2e/features/interface-language.feature` 末段）並以突變確認可失敗，下表為補強後的結果。

縮寫：`UL` = `src/utils/tests/ui-language.test.ts`；`BO` = `tests/build-output.test.ts`；`IL` = `e2e/features/interface-language.feature`；`RE` = `e2e/features/reader-experience.feature`。

## Clauses

| ID | Clause | Spec-expected (oracle) | Impl | Test | Test audit | Code audit | Status |
|----|--------|------------------------|------|------|------------|------------|--------|
| AC-01 | US-01 瀏覽器為繁體中文時預設中文 | 首頁介面文字為中文 | `utils/ui-language.ts`（`resolveLanguage`）→ `LanguageInit.astro` | UL「繁體中文（台灣）→ 中文」＋ IL「第一次來時依瀏覽器首選語言…」zh-TW | asserts-oracle | produces-oracle | ✅ conforms |
| AC-02 | US-01 瀏覽器為簡體中文時預設中文 | 介面為中文 | 同上 | UL「簡體中文 → 中文」＋ IL zh-CN | asserts-oracle | produces-oracle | ✅ conforms |
| AC-03 | US-01 瀏覽器為英文時預設英文 | 介面為英文 | 同上 | UL ＋ IL en-US | asserts-oracle | produces-oracle | ✅ conforms |
| AC-04 | US-01 瀏覽器為其他語言時預設英文 | 日文 → 英文 | 同上 | UL「日文等其他語言 → 英文」＋ IL ja-JP | asserts-oracle | produces-oracle | ✅ conforms |
| AC-05 | US-01 只看首選語言 | 首選英文、第二順位中文 → 英文 | `LanguageInit.astro`（只讀 `navigator.language`） | IL「只看首選語言」 | asserts-oracle | produces-oracle | ✅ conforms |
| AC-06 | US-01 停用程式執行時為中文 | 介面為中文 | `index.css`（沒有 `data-language` 時隱藏英文） | IL「停用程式執行時為中文」（瀏覽器為英文仍得中文） | asserts-oracle | produces-oracle | ✅ conforms |
| AC-07 | US-02 切換後記住選擇 | 切到英文後再回來仍為英文 | `scripts/language.ts`（`chooseLanguage`） | IL「切換後記住選擇」 | asserts-oracle | produces-oracle | ✅ conforms |
| AC-08 | US-02 瀏覽器不允許記住設定 | 本次立即英文；下次回來中文 | `language.ts`（try/catch）＋ `resolveLanguageExpression`（讀不到視為沒選） | IL「瀏覽器不允許記住設定」＋ UL「讀不到儲存時當作沒選過」 | asserts-oracle | produces-oracle | ✅ conforms |
| AC-09 | US-03 英文介面 | 導覽 About/Articles/Series、區塊標題 Latest articles、日期「Oct 4, 2026」、閱讀時間「7 min read」、無中文介面文字、文章標題原文 | `UI_TEXT`、`UiText`、格式化函式、`introduce.json` | IL「整站介面語言一致（en-US，6 頁）」「英文介面的導覽、日期與閱讀時間」「…名稱與內容維持原文…」 | asserts-oracle | produces-oracle | ✅ conforms |
| AC-10 | US-03 中文介面 | 導覽 關於我/文章/系列、「最新文章」、「2026年10月4日」、「7 分鐘」、無英文介面文字 | 同上 | IL「整站介面語言一致（zh-TW，6 頁）」＋ BO「導覽同時帶著中英兩份文字」＋ UL 日期／閱讀時間格式 | asserts-oracle | produces-oracle | ✅ conforms |
| AC-11 | US-03 名稱維持原文、類型依語言顯示 | 作品名稱維持英文；類型「個人專案」 | `ProjectList.astro`（名稱 `data-content`、類型 `UiText`）、`introduce.json` | IL「中文介面的作品類型與經歷期間」 | asserts-oracle | produces-oracle | ✅ conforms |
| AC-12 | US-03 經歷期間的「至今」依語言顯示 | 「2026 - 至今」 | `localizePeriod`、`ExperienceSummary.astro` | UL「經歷期間的『至今』」＋ IL | asserts-oracle | produces-oracle | ✅ conforms |
| AC-13 | US-03 自我介紹依語言顯示 | 中文介面顯示履歷中文版的自我介紹 | `introduce.json`（`summary.zh` 取自 `cv.json`）、`Intro.astro` | IL「自我介紹為中文」（逐字比對 `cv.json`） | asserts-oracle | produces-oracle | ✅ conforms |
| AC-14 | US-04 中文介面前往中文版履歷 | 點「看完整履歷」→ `/cv/zh` | `CV_PATH`、`LinkButton`（`localizedHref`） | IL「從首頁前往目前語言的履歷」zh-TW ＋ BO 首頁履歷連結 | asserts-oracle | produces-oracle | ✅ conforms |
| AC-15 | US-04 英文介面前往英文版履歷 | 點「View CV」→ `/cv/en` | `language.ts`（套用 `href` 對照） | IL en-US | asserts-oracle | produces-oracle | ✅ conforms |
| AC-16 | US-04 不帶語言的履歷網址依預設語言導向 | 英文瀏覽器開 `/cv` → `/cv/en` | `pages/cv/index.astro` | IL「不帶語言的履歷網址依預設語言導向」 | asserts-oracle | produces-oracle | ✅ conforms |
| AC-17 | US-04 中文版履歷的返回連結為中文 | 連結文字「首頁」 | `pages/cv/[lang].astro`（`uiText('cv.home')`） | IL「中文版履歷的返回連結為中文」 | asserts-oracle | produces-oracle | ✅ conforms |
| AC-18 | US-04 在履歷切換語言也會記住 | 中文版切到英文版再回首頁 → 英文 | `cv/LanguageSwitcher.astro`（`chooseLanguage`） | IL「在履歷切換語言也會記住」 | asserts-oracle | produces-oracle | ✅ conforms |
| BR-01 | 語言決定順序：手動選擇 → 瀏覽器首選語言 → 中文 | 同 AC-01～08 | `resolveLanguage` | UL（10 則）＋ IL | asserts-oracle | produces-oracle | ✅ conforms |
| BR-02 | 介面文字（含無障礙名稱、分頁標題）都依語言 | 英文介面下分頁標題與主題切換鈕名稱為英文 | `uiAttributes`、`Layout.astro`（`data-ui-title`）、`language.ts` | IL「…分頁標題為 Articles、主題切換鈕名稱…」＋ 一致性檢查 | asserts-oracle | produces-oracle | ✅ conforms |
| BR-03 | 不翻譯：文章標題、內文、系列名稱、作品名稱、職稱、公司與學校 | 英文介面下文章標題與分頁標題仍為原文 | `data-content`／`translate="no"` 標示 | IL「文章標題維持原文」 | asserts-oracle | produces-oracle | ✅ conforms |
| BR-04 | 格式：日期、閱讀時間、系列篇數 | 中文「2026年10月4日」「N 分鐘」「N 篇文章」；英文「Oct 4, 2026」「N min read」「N articles」 | 格式化函式 | UL 依語言的格式（6 則）＋ BO `READING_TIME` | asserts-oracle | produces-oracle | ✅ conforms |
| BR-05 | 履歷沿用中英網址；網站連結指向目前語言；在履歷切換視為語言選擇 | 同 AC-14～18 | 同 AC-14～18 | IL | asserts-oracle | produces-oracle | ✅ conforms |
| NFR-01 | 首次繪製前決定語言，不閃爍 | 語言在 `<head>` 內決定 | `LanguageInit.astro` | BO「語言在 <head> 裡、首次繪製前就決定」 | asserts-oracle | produces-oracle | ✅ conforms |
| NFR-02 | 語言偏好只存在讀者瀏覽器 | 沒有對外送出資料的程式 | `language.ts`（僅 localStorage） | `tests/reader-privacy.test.ts` | asserts-oracle | produces-oracle | ✅ conforms |
| NFR-03 | 360px 起可用 | 中英兩種介面在 360px 無橫向捲動 | 各頁版面 | RE「手機寬度不會出現橫向捲動」（中文，7 頁）＋ IL「英文介面在手機寬度…」（4 頁） | asserts-oracle | produces-oracle | ✅ conforms |
| NFR-04 | 頁面語言標記與介面一致；語言切換鈕具可讀名稱 | 英文介面 `lang="en"`；切換鈕有名稱 | `language.ts`、`LanguageInit.astro`、`LanguageToggle.astro` | IL（英文介面檢查 `lang="en"`）＋ BO「頁首有語言切換鈕，名稱可被讀出」 | asserts-oracle | produces-oracle | ✅ conforms |

## Orphans (code with no clause)

| Code | Description | Verdict |
|------|-------------|---------|
| `src/pages/cv/index.astro` 頁面內容 | 不帶語言的履歷網址在沒有 JS 時，頁面上同時列出「中文履歷」與「English CV」兩個連結 | undocumented（語言選擇頁慣例：各連結以自己的語言標示，與「介面只用一種語言」的規則刻意不同） |
| `src/components/common/GiscusComments.astro` | 留言區語系跟著介面語言即時切換 | 對應 PRD §7 外部相依，未列為驗收情境 |
| `src/pages/ai-redefines-software.astro` | 頁面標示「Video Notes」改為「影片筆記」 | undocumented（該頁內容為中文，屬內容一致性） |

沒有任何程式碼落在 Out of Scope（未翻譯內文、未另開英文網址、未依 IP 判斷地區）。

## Summary

- Conforms: 27/27 clauses ✅ (100%)
- Violations: —
- Mis-asserted: —（稽核中發現的 3 處淺測試已先補強）
- Partial: —
- Gaps: —
- Unclear: —
- Orphans: 3
