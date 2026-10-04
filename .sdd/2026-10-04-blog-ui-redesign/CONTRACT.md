# Contract Traceability Matrix — blog-ui-redesign

Contract: PRD.md
Design map: ARCH.md
Implementation: `src/`（Astro 靜態站）
Oracle: Acceptance Criteria（PRD v1.2：36 AC ＋ 6 BR ＋ 4 NFR = 46 clauses）

> **Run 2（依 Run 1 回饋補測試、修正後重新稽核）。** Run 1：19/43 conforms（44%），0 violation、0 gap；問題集中在瀏覽器互動沒有進版控的測試、數條建置測試只抽查。
>
> **Run 1 說明：** 靜態一致性稽核：以 PRD 推出的預期結果為準，分別判斷「測試是否斷言該結果」與「程式是否產生該結果」，不以整套測試綠燈為依據。
> 輔助佐證（不作為判決依據）：改版前後的建置頁面清單比對（148 頁完全一致）。Run 2 的瀏覽器互動改由進版控的 `e2e/features/reader-experience.feature`（20 個情境，對正式建置產物執行）斷言。

縮寫：`BO` = `tests/build-output.test.ts`；`SC` = `src/utils/tests/series-core.test.ts`；`RT` = `src/utils/tests/reading-time.test.ts`；`TOC` = `src/utils/tests/table-of-contents.test.ts`；`I18N` = `src/utils/tests/i18n.test.ts`。

## Clauses

| ID | Clause | Spec-expected (oracle) | Impl | Test | Test audit | Code audit | Status |
|----|--------|------------------------|------|------|------------|------------|--------|
| AC-01 | US-01 全站套用同一套編輯風格 | 八種頁面使用同一套字體、配色、版寬；任何頁面都沒有手繪風格元素 | `src/styles/tokens.css:12`、`src/layouts/Layout.astro`、`src/pages/cv/[lang].astro:18` | BO「不再帶手繪設計系統的類別與字型」「使用全站共用的字型」「套用全站共用的配色 token」（8 頁） | asserts-oracle | produces-oracle | ✅ conforms |
| AC-02 | US-01 文章正文維持舒適的閱讀寬度 | 寬螢幕上正文行長有上限，不隨螢幕拉寬 | `src/styles/article.css:5`、`tokens.css`（`--measure: 68ch`） | BO:422「文章正文限制在固定的閱讀寬度內」 | asserts-oracle | produces-oracle | ✅ conforms |
| AC-03 | US-02 一般中文文章 | 3,200 字中文 → 顯示「8 分鐘」 | `src/utils/reading-time.ts:31`、`components/blog/ReadingTime.astro` | RT「3,200 個中文字是 8 分鐘」＋ BO:254/263（顯示格式「N 分鐘」） | asserts-oracle | produces-oracle | ✅ conforms |
| AC-04 | US-02 超過整分鐘時無條件進位 | 3,201 字 → 「9 分鐘」 | `reading-time.ts:39` | RT「3,201 個中文字是 9 分鐘」 | asserts-oracle | produces-oracle | ✅ conforms |
| AC-05 | US-02 極短文章最少 1 分鐘 | 120 字 → 「1 分鐘」 | `reading-time.ts:39` | RT「極短文章最少 1 分鐘」 | asserts-oracle | produces-oracle | ✅ conforms |
| AC-06 | US-02 中英混合文章分開計算後加總 | 2,000 中文字＋400 英文字 → 「7 分鐘」 | `reading-time.ts:35` | RT「中英混合…7 分鐘」 | asserts-oracle | produces-oracle | ✅ conforms |
| AC-07 | US-03 寬螢幕在正文旁顯示兩層目錄 | 寬螢幕：正文旁固定一欄，依序 5 章，3 節縮排於所屬章下 | `utils/table-of-contents.ts:38`、`components/blog/TableOfContents.astro`、`article.css`（`.article-layout__toc`） | TOC「列出所有章，節縮排…」＋ BO:275 ＋ `e2e/features/reader-experience.feature`「寬螢幕在正文旁顯示固定的目錄」 | asserts-oracle | produces-oracle | ✅ conforms |
| AC-08 | US-03 捲動時標出目前位置 | 捲到第 3 章時，目錄中第 3 章被標為目前位置 | `src/scripts/tableOfContents.ts:16` | `e2e/features/reader-experience.feature`「捲動時標出目前位置」 | asserts-oracle | produces-oracle | ✅ conforms |
| AC-09 | US-03 點目錄跳到該章 | 點第 4 章 → 頁面跳到第 4 章開頭 | `TableOfContents.astro`（`href="#slug"` 對應標題 id） | BO「目錄的每一章都連到正文中那一章的標題」＋ `e2e/features/reader-experience.feature`「點目錄跳到該章」 | asserts-oracle | produces-oracle | ✅ conforms |
| AC-10 | US-03 手機上目錄預設收合 | 手機：目錄在文章開頭、預設收合；點開列出所有章與節 | `TableOfContents.astro`（`<details>` `lg:hidden`）、`[...slug].astro`（目錄位於正文前） | BO:299 ＋ `e2e/features/reader-experience.feature`「手機上目錄預設收合」（在正文前、收合、點開列出章與節） | asserts-oracle | produces-oracle | ✅ conforms |
| AC-11 | US-03 只有 1 個章時不顯示目錄 | 頁面上沒有目錄 | `table-of-contents.ts:47`＋`TableOfContents.astro`（空陣列不輸出） | TOC「只有 1 個章時沒有目錄」 | asserts-oracle | produces-oracle | ✅ conforms |
| AC-12 | US-03 有 2 個章時顯示目錄 | 顯示列出 2 章的目錄 | `table-of-contents.ts:47` | TOC「有 2 個章時列出這 2 個章」＋ BO:275 | asserts-oracle | produces-oracle | ✅ conforms |
| AC-13 | US-03 比節更深的小標不列入目錄 | 目錄只列章與節 | `table-of-contents.ts:41` | TOC「比節更深的小標不列入」 | asserts-oracle | produces-oracle | ✅ conforms |
| AC-14 | US-04 裝置為深色時預設深色 | 頁面以深色顯示 | `components/common/ThemeInit.astro`、`tokens.css:37` | `e2e/features/reader-experience.feature`「裝置為深色時預設深色」 | asserts-oracle | produces-oracle | ✅ conforms |
| AC-15 | US-04 裝置為淺色時預設淺色 | 頁面以淺色顯示 | 同上 | `e2e/features/reader-experience.feature`「裝置為淺色時預設淺色」 | asserts-oracle | produces-oracle | ✅ conforms |
| AC-16 | US-04 手動切換後記住選擇 | 裝置深色、手動切淺色 → 再回來仍為淺色 | `src/scripts/theme.ts:15`、`ThemeInit.astro` | `e2e/features/reader-experience.feature`「手動切換後記住選擇」 | asserts-oracle | produces-oracle | ✅ conforms |
| AC-17 | US-04 瀏覽器不允許記住設定 | 本次立即切換；下次依裝置設定 | `theme.ts:22`（try/catch）、`ThemeInit.astro`（try/catch） | `e2e/features/reader-experience.feature`「瀏覽器不允許記住設定」 | asserts-oracle | produces-oracle | ✅ conforms |
| AC-18 | US-05 首頁呈現自我介紹、最新的系列與最新的單篇文章 | 上半部自介＋履歷入口；下半部建立日期最新的系列入口＋最新 5 篇單篇文章 | `components/home/Intro.astro`、`LatestArticles.astro` | BO:「上半部有自我介紹…」「系列入口是建立日期…最新的系列」「最新文章只列單篇文章，且是最新的 5 篇」 | asserts-oracle | produces-oracle | ✅ conforms |
| AC-18a | US-05 系列入口依建立日期，而非最近更新（v1.1） | A（2025-01 開始、2026-06 更新）與 B（2026-01 開始）→ 首頁是 B | `series-core.ts`（`selectNewestSeries`） | SC「取第一篇發布最晚的系列，而不是最近更新的系列」＋ BO「系列入口是建立日期…」（實際內容：首頁為 Web2→Web3 系列，非最近更新的量化交易系列） | asserts-oracle | produces-oracle | ✅ conforms |
| AC-18b | US-05 最新文章不列入系列文章（v1.1） | 最新 3 篇是系列文章時不出現，列的是最新 5 篇單篇 | `LatestArticles.astro`（`selectStandaloneArticles`） | BO「最新文章只列單篇文章，且是最新的 5 篇」（以系列頁判定歸屬、以發布時間判定新舊） | asserts-oracle | produces-oracle | ✅ conforms |
| AC-19 | US-05 草稿不出現在首頁並往下補足 | 最新一篇為草稿時不出現，仍列 5 篇已發布 | `pages/index.astro`（`getPublishedBlogs`）→ `selectStandaloneArticles` | BO「最新文章只列單篇文章…」 | shallow（內容中沒有草稿，斷言無法區分「有過濾」與「沒過濾」） | produces-oracle | 🟠 mis-asserted |
| AC-20 | US-05 沒有任何系列時不顯示系列入口 | 首頁沒有系列入口，只列最新文章 | `LatestArticles.astro`（`newestSeries &&`） | SC `selectNewestSeries`「完全沒有系列文章時回傳 null」（只到資料層） | no-test（元件的條件呈現沒有測試） | produces-oracle | 🟡 partial |
| AC-21 | US-05 作品集直接列出、不再篩選 | 9 個作品全部列出，沒有分類篩選 | `components/home/ProjectList.astro` | BO:346 | asserts-oracle | produces-oracle | ✅ conforms |
| AC-22 | US-05 經歷精簡呈現 | 只列最近 3 段，並有完整履歷入口 | `components/home/ExperienceSummary.astro` | BO:352 | asserts-oracle | produces-oracle | ✅ conforms |
| AC-23 | US-06 便利貼不再出現 | 頁面上沒有便利貼，也沒有新增入口 | `pages/blogs/[...slug].astro`（已移除） | BO:433 | asserts-oracle | produces-oracle | ✅ conforms |
| AC-24 | US-06 進站不再出現載入畫面 | 內容直接出現，無遮住畫面的載入畫面 | `Layout.astro`（已移除） | BO:152 | asserts-oracle | produces-oracle | ✅ conforms |
| AC-25 | US-07 已上線網址繼續有效 | 任一已上線網址仍打開同一內容 | 路由檔未改名 | BO「改版前就存在的每一頁，建置後都還在」（`tests/fixtures/published-pages.txt`，148 項） | asserts-oracle | produces-oracle（改版前後 148 頁清單一致） | ✅ conforms |
| AC-26 | US-07 系列文章的上一篇是較早的一天 | 系列第 2 天點上一篇 → 第 1 天 | `utils/series-core.ts`（`findAdjacent`）、`components/blog/PostNavigation.astro` | SC:189 | asserts-oracle | produces-oracle | ✅ conforms |
| AC-27 | US-07 單篇文章的上一篇是較新的一篇 | 進到發布日期較新的單篇 | 同上 | SC:183 | asserts-oracle | produces-oracle | ✅ conforms |
| AC-28 | US-07 搜尋命中系列名稱（v1.2） | 搜尋系列名稱 → 該系列的文章出現 | `components/blog/ArticleList.astro`（`applySearch`） | `e2e/features/reader-experience.feature`「搜尋命中系列名稱」 | asserts-oracle | produces-oracle | ✅ conforms |
| AC-28a | US-07 文章列表沒有系列入口（v1.2） | 文章列表上沒有系列入口，只列單篇文章 | `components/blog/ArticleList.astro` | BO「沒有系列入口，只列單篇文章」「最近更新那個系列的文章預設隱藏，留給搜尋」＋ RE「文章列表沒有系列入口」（突變驗證：放回系列連結時兩者皆失敗） | asserts-oracle | produces-oracle | ✅ conforms |
| AC-29 | US-07 搜尋沒有結果 | 顯示「沒有找到符合的文章」 | 同上 | `e2e/features/reader-experience.feature`「搜尋沒有結果」 | asserts-oracle | produces-oracle | ✅ conforms |
| AC-30 | US-07 草稿全站隱藏 | 任何列表、系列、上下篇、訂閱來源都看不到草稿 | `utils/series.ts`（`getPublishedBlogs`，全站唯一入口，含新首頁） | SC「isPublished」＋ BO:440 | shallow（建置測試在沒有草稿時恆過；只有判斷式有單元測試） | produces-oracle | 🟠 mis-asserted |
| AC-31 | US-08 存成乾淨的 PDF | 印出的履歷不含頁首、按鈕、主題切換；建議檔名「姓名 - 職稱 - CV」 | `cv/[lang].astro`（`.no-print`、`<title>`）、`cv.scss`（`@media print`） | BO:369（檔名）＋ `e2e/features/reader-experience.feature`「存成 PDF 時不含頁首與按鈕」（列印媒體下實際隱藏） | asserts-oracle | produces-oracle | ✅ conforms |
| AC-32 | US-08 深色主題下存成 PDF 仍為淺色 | PDF 為淺色版面 | `tokens.css`（深色包在 `@media screen`） | BO:386 | asserts-oracle | produces-oracle | ✅ conforms |
| AC-33 | US-08 缺中文說明時顯示英文 | 該經歷顯示英文說明 | `components/cv/CVExperience.astro:24` → `getLocalizedText` | I18N「該語系缺字時退回英文」 | asserts-oracle | produces-oracle | ✅ conforms |
| BR-01 | 閱讀時間公式，且文章頁、文章列表、首頁最新文章、系列頁都顯示 | 四處都顯示依公式算出的「N 分鐘」 | `reading-time.ts`、`ArticleMeta.astro`（文章頁與列表共用） | RT ＋ BO「文章列表／系列頁／文章頁／首頁最新文章都標出閱讀時間」 | asserts-oracle | produces-oracle | ✅ conforms |
| BR-02 | 目錄只列章與節；章少於 2 不顯示；寬螢幕側欄＋目前位置；手機收合 | 同 AC-07～13 | 同 AC-07～13 | 同 AC-07～13 | asserts-oracle | produces-oracle | ✅ conforms |
| BR-03 | 主題：手動選擇優先 → 裝置設定；無法記住時僅本次有效 | 同 AC-14～17 | 同 AC-14～17 | 同 AC-14～17（`e2e/features/reader-experience.feature`） | asserts-oracle | produces-oracle | ✅ conforms |
| BR-04 | 首頁最新文章：已發布的單篇文章依日期新到舊取 5 篇；首頁系列入口為建立日期最新的系列（v1.1） | 5 篇單篇、新到舊；系列入口為第一篇最晚的系列 | `series-core.ts`（`selectStandaloneArticles`、`selectNewestSeries`） | SC「selectStandaloneArticles」「selectNewestSeries」＋ BO 兩則首頁測試 | asserts-oracle | produces-oracle | ✅ conforms |
| BR-05 | 首頁經歷只列最近 3 段，其餘看完整履歷 | 3 段＋履歷入口 | `ExperienceSummary.astro` | BO:352 | asserts-oracle | produces-oracle | ✅ conforms |
| BR-06 | 相鄰文章、搜尋、草稿、網址完全沿用既有規則 | 同 AC-25～30 | 同 AC-25～30 | 網址、相鄰文章、搜尋皆有斷言（見 AC-25～29）；草稿部分同 AC-30 | shallow（僅草稿部分） | produces-oracle | 🟠 mis-asserted |
| NFR-01 | 效能：字型不阻塞首屏、數學式建置期呈現、圖片走外部儲存、無 JS 可讀、手機可用 | 各項做法維持 | `SiteFonts.astro`、`astro.config.mjs`（rehype-katex）、`TableOfContents.astro`（`<details>`） | BO「字型不阻塞首屏」「數學式在建置期就呈現」＋ `e2e/features/reader-experience.feature`「停用程式執行時仍可閱讀」「手機寬度不會出現橫向捲動」 | asserts-oracle | produces-oracle | ✅ conforms |
| NFR-02 | 安全：不收集讀者資料；主題偏好只存在讀者瀏覽器 | 沒有任何對外送出的讀者資料 | `theme.ts`（僅 localStorage） | `tests/reader-privacy.test.ts`「站上的程式碼沒有任何對外送出資料的呼叫」 | asserts-oracle | produces-oracle | ✅ conforms |
| NFR-03 | 相容：360px 起可用、不出現橫向捲動 | 各頁在 360px 寬無橫向捲動 | 各頁版面 | `e2e/features/reader-experience.feature`「手機寬度不會出現橫向捲動」（7 頁，360px） | asserts-oracle | produces-oracle（Run 1 後發現履歷在 360px 溢出 263px，已修正 `cv.scss`、`cv/_components.scss`） | ✅ conforms |
| NFR-04 | 無障礙：對比足夠、鍵盤可操作、目錄／搜尋／主題切換具可讀名稱 | 三個互動元件都有可讀名稱；文字對比 ≥ 4.5:1 | `TableOfContents.astro`（`aria-label`）、`SearchBar.astro`（`label`）、`ThemeToggle.astro`（`aria-label`）、`tokens.css` | `tests/design-tokens.test.ts`（兩主題文字對比 ≥ 4.5:1，12 組）＋ BO「目錄與主題切換都有可讀出的名稱」「搜尋框有可存取名稱」＋ `e2e/features/reader-experience.feature`「只用鍵盤也能切換主題與展開目錄」 | asserts-oracle | produces-oracle | ✅ conforms |

## Orphans (code with no clause)

| Code | Description | Verdict |
|------|-------------|---------|
| `src/components/layouts/Header.astro:7` | 導覽列標出目前所在的頁面（`aria-current`） | undocumented（無障礙增強，建議納入 NFR-04） |
| `src/layouts/Layout.astro`（`.skip-link`） | 「跳到主要內容」連結 | undocumented（無障礙增強，建議納入 NFR-04） |
| `src/components/layouts/Footer.astro` | 頁尾 RSS 連結 | undocumented |
| `src/pages/ai-redefines-software.astro` | 對談筆記頁也有文章目錄 | undocumented（PRD 只要求套用新設計） |
| `src/scripts/tableOfContents.ts:26` | 捲到頁底時改標畫面上最後一章 | undocumented（AC-08 的邊界補強） |

沒有任何程式碼落在 PRD 的 Out of Scope（無後端、無帳號、無便利貼移轉）。

## Summary

- Conforms: 42/46 clauses ✅ (91%)（PRD v1.1 新增 AC-18a、AC-18b；v1.2 新增 AC-28a，皆 conforms）
- Violations: —
- Mis-asserted: AC-19, AC-30, BR-06
- Partial: AC-20
- Gaps: —
- Unclear: —
- Orphans: 5

**Run 2 期間發現並修正的行為問題：** 履歷頁在 360px 手機寬度溢出 263px（NFR-03）。Run 1 的一次性檢查以行動裝置模擬會自動縮放而漏掉；新的瀏覽器情境以實際 360px 寬度量測後抓到，已修正。

**仍未關閉的項目與原因：**

- **AC-19、AC-30、BR-06（草稿）**：程式行為正確——全站唯一取用入口 `getPublishedBlogs()` 過濾草稿，首頁也走它，判斷式 `isPublished` 有單元測試。但目前內容裡沒有任何草稿，建置測試無法區分「有過濾」與「沒過濾」。要讓測試真正斷言，需要一篇只供測試的草稿內容或可替換內容來源的測試建置；兩者都會動到文章內容或建置設定，留給維護者決定。
- **AC-20（沒有系列時不顯示入口）**：`selectLatestSeries` 回傳 null 已有單元測試，元件以 `latestSeries &&` 條件呈現；但實際內容永遠有系列，建置與瀏覽器測試都無法造出這個狀態。若要補，需引入 Astro 元件的獨立渲染測試。
