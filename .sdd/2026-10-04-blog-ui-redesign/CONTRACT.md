# Contract Traceability Matrix — blog-ui-redesign

Contract: PRD.md
Design map: ARCH.md
Implementation: `src/`（Astro 靜態站）
Oracle: Acceptance Criteria（33 AC ＋ 6 BR ＋ 4 NFR = 43 clauses）

> **Run 1（實作完成後的首次稽核）。** 靜態一致性稽核：以 PRD 推出的預期結果為準，分別判斷「測試是否斷言該結果」與「程式是否產生該結果」，不以整套測試綠燈為依據。
> 輔助佐證（不作為判決依據）：一次性的 Playwright 瀏覽器檢查（21 項，未進版控）、改版前後的建置頁面清單比對（148 頁完全一致）。

縮寫：`BO` = `tests/build-output.test.ts`；`SC` = `src/utils/tests/series-core.test.ts`；`RT` = `src/utils/tests/reading-time.test.ts`；`TOC` = `src/utils/tests/table-of-contents.test.ts`；`I18N` = `src/utils/tests/i18n.test.ts`。

## Clauses

| ID | Clause | Spec-expected (oracle) | Impl | Test | Test audit | Code audit | Status |
|----|--------|------------------------|------|------|------------|------------|--------|
| AC-01 | US-01 全站套用同一套編輯風格 | 八種頁面使用同一套字體、配色、版寬；任何頁面都沒有手繪風格元素 | `src/styles/tokens.css:12`、`src/layouts/Layout.astro`、`src/pages/cv/[lang].astro:18` | BO:「不再帶手繪設計系統的類別與字型」「使用全站共用的字型」 | shallow（斷言了無手繪與共用字型，未斷言共用配色 token） | produces-oracle | 🟠 mis-asserted |
| AC-02 | US-01 文章正文維持舒適的閱讀寬度 | 寬螢幕上正文行長有上限，不隨螢幕拉寬 | `src/styles/article.css:5`、`tokens.css`（`--measure: 68ch`） | BO:422「文章正文限制在固定的閱讀寬度內」 | asserts-oracle | produces-oracle | ✅ conforms |
| AC-03 | US-02 一般中文文章 | 3,200 字中文 → 顯示「8 分鐘」 | `src/utils/reading-time.ts:31`、`components/blog/ReadingTime.astro` | RT「3,200 個中文字是 8 分鐘」＋ BO:254/263（顯示格式「N 分鐘」） | asserts-oracle | produces-oracle | ✅ conforms |
| AC-04 | US-02 超過整分鐘時無條件進位 | 3,201 字 → 「9 分鐘」 | `reading-time.ts:39` | RT「3,201 個中文字是 9 分鐘」 | asserts-oracle | produces-oracle | ✅ conforms |
| AC-05 | US-02 極短文章最少 1 分鐘 | 120 字 → 「1 分鐘」 | `reading-time.ts:39` | RT「極短文章最少 1 分鐘」 | asserts-oracle | produces-oracle | ✅ conforms |
| AC-06 | US-02 中英混合文章分開計算後加總 | 2,000 中文字＋400 英文字 → 「7 分鐘」 | `reading-time.ts:35` | RT「中英混合…7 分鐘」 | asserts-oracle | produces-oracle | ✅ conforms |
| AC-07 | US-03 寬螢幕在正文旁顯示兩層目錄 | 寬螢幕：正文旁固定一欄，依序 5 章，3 節縮排於所屬章下 | `utils/table-of-contents.ts:38`、`components/blog/TableOfContents.astro`、`article.css`（`.article-layout__toc`） | TOC「列出所有章，節縮排…」＋ BO:275 | shallow（章節結構有斷言；「正文旁固定一欄」無測試） | produces-oracle | 🟠 mis-asserted |
| AC-08 | US-03 捲動時標出目前位置 | 捲到第 3 章時，目錄中第 3 章被標為目前位置 | `src/scripts/tableOfContents.ts:16` | — | no-test | produces-oracle | 🟡 partial |
| AC-09 | US-03 點目錄跳到該章 | 點第 4 章 → 頁面跳到第 4 章開頭 | `TableOfContents.astro`（`href="#slug"` 對應標題 id） | BO:275（只斷言 `data-toc-chapter` 與章 id 一致） | shallow（未斷言連結目標，也未斷言跳轉） | produces-oracle | 🟠 mis-asserted |
| AC-10 | US-03 手機上目錄預設收合 | 手機：目錄在文章開頭、預設收合；點開列出所有章與節 | `TableOfContents.astro`（`<details>` `lg:hidden`）、`[...slug].astro`（目錄位於正文前） | BO:299「窄螢幕的目錄預設收合」 | shallow（只斷言收合；未斷言點開後列出章節） | produces-oracle | 🟠 mis-asserted |
| AC-11 | US-03 只有 1 個章時不顯示目錄 | 頁面上沒有目錄 | `table-of-contents.ts:47`＋`TableOfContents.astro`（空陣列不輸出） | TOC「只有 1 個章時沒有目錄」 | asserts-oracle | produces-oracle | ✅ conforms |
| AC-12 | US-03 有 2 個章時顯示目錄 | 顯示列出 2 章的目錄 | `table-of-contents.ts:47` | TOC「有 2 個章時列出這 2 個章」＋ BO:275 | asserts-oracle | produces-oracle | ✅ conforms |
| AC-13 | US-03 比節更深的小標不列入目錄 | 目錄只列章與節 | `table-of-contents.ts:41` | TOC「比節更深的小標不列入」 | asserts-oracle | produces-oracle | ✅ conforms |
| AC-14 | US-04 裝置為深色時預設深色 | 頁面以深色顯示 | `components/common/ThemeInit.astro`、`tokens.css:37` | — | no-test | produces-oracle | 🟡 partial |
| AC-15 | US-04 裝置為淺色時預設淺色 | 頁面以淺色顯示 | 同上 | — | no-test | produces-oracle | 🟡 partial |
| AC-16 | US-04 手動切換後記住選擇 | 裝置深色、手動切淺色 → 再回來仍為淺色 | `src/scripts/theme.ts:15`、`ThemeInit.astro` | — | no-test | produces-oracle | 🟡 partial |
| AC-17 | US-04 瀏覽器不允許記住設定 | 本次立即切換；下次依裝置設定 | `theme.ts:22`（try/catch）、`ThemeInit.astro`（try/catch） | — | no-test | produces-oracle | 🟡 partial |
| AC-18 | US-05 首頁呈現自我介紹、進行中的系列與最新文章 | 上半部自介＋履歷入口；下半部系列入口＋最新 5 篇 | `components/home/Intro.astro`、`LatestArticles.astro` | BO:313、322、338 | asserts-oracle | produces-oracle | ✅ conforms |
| AC-19 | US-05 草稿不出現在首頁並往下補足 | 最新一篇為草稿時不出現，仍列 5 篇已發布 | `pages/index.astro`（`getPublishedBlogs`）→ `selectLatestArticles` | BO:322（與 RSS 比對） | shallow（內容中沒有草稿，斷言無法區分「有過濾」與「沒過濾」） | produces-oracle | 🟠 mis-asserted |
| AC-20 | US-05 沒有任何系列時不顯示系列入口 | 首頁沒有系列入口，只列最新文章 | `LatestArticles.astro`（`latestSeries &&`） | SC「完全沒有系列文章時回傳 null」（只到資料層） | no-test（元件的條件呈現沒有測試） | produces-oracle | 🟡 partial |
| AC-21 | US-05 作品集直接列出、不再篩選 | 9 個作品全部列出，沒有分類篩選 | `components/home/ProjectList.astro` | BO:346 | asserts-oracle | produces-oracle | ✅ conforms |
| AC-22 | US-05 經歷精簡呈現 | 只列最近 3 段，並有完整履歷入口 | `components/home/ExperienceSummary.astro` | BO:352 | asserts-oracle | produces-oracle | ✅ conforms |
| AC-23 | US-06 便利貼不再出現 | 頁面上沒有便利貼，也沒有新增入口 | `pages/blogs/[...slug].astro`（已移除） | BO:433 | asserts-oracle | produces-oracle | ✅ conforms |
| AC-24 | US-06 進站不再出現載入畫面 | 內容直接出現，無遮住畫面的載入畫面 | `Layout.astro`（已移除） | BO:152 | asserts-oracle | produces-oracle | ✅ conforms |
| AC-25 | US-07 已上線網址繼續有效 | 任一已上線網址仍打開同一內容 | 路由檔未改名 | BO:190–210（只抽查系列分頁） | shallow（抽查少數網址，非全部已上線網址） | produces-oracle（改版前後 148 頁清單一致） | 🟠 mis-asserted |
| AC-26 | US-07 系列文章的上一篇是較早的一天 | 系列第 2 天點上一篇 → 第 1 天 | `utils/series-core.ts`（`findAdjacent`）、`components/blog/PostNavigation.astro` | SC:189 | asserts-oracle | produces-oracle | ✅ conforms |
| AC-27 | US-07 單篇文章的上一篇是較新的一篇 | 進到發布日期較新的單篇 | 同上 | SC:183 | asserts-oracle | produces-oracle | ✅ conforms |
| AC-28 | US-07 搜尋命中系列名稱 | 搜尋「agent」→ 系列入口與其文章都出現 | `components/blog/ArticleList.astro`（`applySearch`） | — | no-test | produces-oracle | 🟡 partial |
| AC-29 | US-07 搜尋沒有結果 | 顯示「沒有找到符合的文章」 | 同上 | — | no-test | produces-oracle | 🟡 partial |
| AC-30 | US-07 草稿全站隱藏 | 任何列表、系列、上下篇、訂閱來源都看不到草稿 | `utils/series.ts`（`getPublishedBlogs`，全站唯一入口，含新首頁） | SC「isPublished」＋ BO:440 | shallow（建置測試在沒有草稿時恆過；只有判斷式有單元測試） | produces-oracle | 🟠 mis-asserted |
| AC-31 | US-08 存成乾淨的 PDF | 印出的履歷不含頁首、按鈕、主題切換；建議檔名「姓名 - 職稱 - CV」 | `cv/[lang].astro`（`.no-print`、`<title>`）、`cv.scss`（`@media print`） | BO:369、374 | shallow（斷言了檔名與 `no-print` 標記，未斷言列印時真的隱藏；返回連結未檢查） | produces-oracle | 🟠 mis-asserted |
| AC-32 | US-08 深色主題下存成 PDF 仍為淺色 | PDF 為淺色版面 | `tokens.css`（深色包在 `@media screen`） | BO:386 | asserts-oracle | produces-oracle | ✅ conforms |
| AC-33 | US-08 缺中文說明時顯示英文 | 該經歷顯示英文說明 | `components/cv/CVExperience.astro:24` → `getLocalizedText` | I18N「該語系缺字時退回英文」 | asserts-oracle | produces-oracle | ✅ conforms |
| BR-01 | 閱讀時間公式，且文章頁、文章列表、首頁最新文章、系列頁都顯示 | 四處都顯示依公式算出的「N 分鐘」 | `reading-time.ts`、`ArticleMeta.astro`（文章頁與列表共用） | RT ＋ BO:254/263 | shallow（文章頁與首頁的顯示未斷言） | produces-oracle | 🟠 mis-asserted |
| BR-02 | 目錄只列章與節；章少於 2 不顯示；寬螢幕側欄＋目前位置；手機收合 | 同 AC-07～13 | 同 AC-07～13 | 同 AC-07～13 | shallow（同 AC-07～10） | produces-oracle | 🟠 mis-asserted |
| BR-03 | 主題：手動選擇優先 → 裝置設定；無法記住時僅本次有效 | 同 AC-14～17 | 同 AC-14～17 | — | no-test | produces-oracle | 🟡 partial |
| BR-04 | 首頁最新文章：已發布文章依日期新到舊取 5 篇（單篇與系列皆算） | 5 篇、新到舊、系列文章也算 | `series-core.ts`（`selectLatestArticles`） | SC「selectLatestArticles」三則 ＋ BO:322 | asserts-oracle | produces-oracle | ✅ conforms |
| BR-05 | 首頁經歷只列最近 3 段，其餘看完整履歷 | 3 段＋履歷入口 | `ExperienceSummary.astro` | BO:352 | asserts-oracle | produces-oracle | ✅ conforms |
| BR-06 | 相鄰文章、搜尋、草稿、網址完全沿用既有規則 | 同 AC-25～30 | 同 AC-25～30 | 部分（搜尋無測試） | shallow | produces-oracle | 🟠 mis-asserted |
| NFR-01 | 效能：字型不阻塞首屏、數學式建置期呈現、圖片走外部儲存、無 JS 可讀、手機可用 | 各項做法維持 | `SiteFonts.astro`、`astro.config.mjs`（rehype-katex）、`TableOfContents.astro`（`<details>`） | BO:158（字型）；無 JS／手機無測試 | shallow | produces-oracle | 🟠 mis-asserted |
| NFR-02 | 安全：不收集讀者資料；主題偏好只存在讀者瀏覽器 | 沒有任何對外送出的讀者資料 | `theme.ts`（僅 localStorage） | — | no-test | produces-oracle | 🟡 partial |
| NFR-03 | 相容：360px 起可用、不出現橫向捲動 | 各頁在 360px 寬無橫向捲動 | 各頁版面 | — | no-test | produces-oracle（一次性瀏覽器檢查 7 頁皆 0 溢出） | 🟡 partial |
| NFR-04 | 無障礙：對比足夠、鍵盤可操作、目錄／搜尋／主題切換具可讀名稱 | 三個互動元件都有可讀名稱；文字對比 ≥ 4.5:1 | `TableOfContents.astro`（`aria-label`）、`SearchBar.astro`（`label`）、`ThemeToggle.astro`（`aria-label`）、`tokens.css` | BO:246（只有搜尋框） | shallow | produces-oracle | 🟠 mis-asserted |

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

- Conforms: 19/43 clauses ✅ (44%)
- Violations: —
- Mis-asserted: AC-01, AC-07, AC-09, AC-10, AC-19, AC-25, AC-30, AC-31, BR-01, BR-02, BR-06, NFR-01, NFR-04
- Partial: AC-08, AC-14, AC-15, AC-16, AC-17, AC-20, AC-28, AC-29, BR-03, NFR-02, NFR-03
- Gaps: —
- Unclear: —
- Orphans: 5

**判讀：** 程式行為沒有任何一條偏離 PRD（0 violation、0 gap），問題集中在測試：瀏覽器端的互動（主題、目錄目前位置與跳轉、搜尋、手機版面）只有一次性的手動瀏覽器檢查，沒有進版控的測試；另有數條建置測試只抽查或只斷言了部分結果。
