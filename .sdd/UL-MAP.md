# Ubiquitous Language Map

**Project:** Coding Afternoon（CodeMachine0121.github.io）
**Bounded Context:** 個人技術部落格與作品集——文章發布與閱讀（文章／系列／草稿／導覽／搜尋／便利貼）、個人介紹與作品集、履歷（CV）
**Maintainer:** James Hsueh
**Last Updated:** 2026-10-04

> 本表由程式碼考古（Archeology）產生，掃描範圍：`src/content.config.ts`、`src/types/`、`src/utils/`、`src/scripts/`、`src/pages/`、`src/components/`、`src/config/*.json`。
> 所有列目前皆為 `Archeology`，需經維護者確認後改為 `Confirmed`。

---

## 1. Nouns & Concepts
*Records entities, value objects, attributes and their correspondence between code and real business.*

### 1.1 文章與系列

| Domain Term | Technical Name | User-Facing Label | Definition & Business Rules | Status |
| :--- | :--- | :--- | :--- | :--- |
| 文章（Article） | `blogs` collection、`BlogEntry`（`CollectionEntry<'blogs'>`）、`ArticleLike`、`blog`/`post` 變數 | 文章、Blog、Recent posts | 一篇 Markdown，放 `src/content/blogs/**/*.md`；由 frontmatter 描述。`blog.id` 即網址路徑 `/blogs/{id}/` | Archeology |
| 文章標題 | `data.title` | 頁面 `<h1>`、列表卡片標題 | 必填。頁面 h1 由它渲染，所以正文不得再用 h1 | Archeology |
| 發布日期 | `data.datetime` | 文章日期（`zh-TW` 長日期格式） | 必填字串（`YYYY-MM-DD`）。決定單篇排序、系列預設次序（無 `seriesIndex` 時）、RSS `pubDate` | Archeology |
| 文章摘要 | `data.description` | 文章副標、SEO description、RSS description | 選填；一句話摘要 | Archeology |
| 封面圖 | `data.image` | 文章頁頂端圖片、分享圖 | 選填；資產放 Cloudflare R2，填 R2 連結，不放 `public/` | Archeology |
| 系列（Series） | `Series<T>`、frontmatter `parent`、`seriesName`、`parentName` | 系列文章、Series | 以 `parent` 字串相同的文章歸為同一系列；同系列 `parent` 必須完全一致（`trim` 後比對） | Archeology |
| 系列名稱 | `Series.name`（= `parent`） | 系列卡片標題、文章頁徽章 | 原始名稱，可含中文與標點 | Archeology |
| 系列代稱（slug） | `Series.slug`、`createSlug()` | 網址 `/series/{slug}` | 保留中文、英數、底線、連字號；空白折成 `-`；無可用字元時退回 `series` | Archeology |
| 系列篇數 | `Series.count`、`childrenCount` | 「N 篇」「共 N 篇文章」 | 該系列已發布文章數 | Archeology |
| 系列序號 | `data.seriesIndex` | （不顯示） | 選填非負整數；系列內升冪排序，未設定者排後、同序號再依發布日期 | Archeology |
| 單篇文章（Standalone Article） | `selectStandaloneArticles()`、`data-series=""` | 文章列表主體 | 沒有 `parent` 的文章；列表依發布日期新到舊 | Archeology |
| 進行中的系列（Latest Series） | `selectLatestSeries()`、`latestSeries` | 文章列表頁上方的系列卡片 | 「最新一篇發布日期最新」的那個系列；文章列表頁只掛它的入口，其餘走 `/series` | Archeology |
| 草稿（Draft） | `data.draft`、`isPublished()` | （不顯示） | `draft: true` 的文章：不列出、不建置頁面、不進系列頁／上下篇／RSS。預設 `false` | Archeology |
| 已發布文章 | `getPublishedBlogs()` | — | 全站取用文章的唯一入口，負責過濾草稿 | Archeology |
| 未部署文章 | `src/content/not-deployed/` | （不存在於站上） | collection loader 的 base 是 `src/content/blogs`，此資料夾的文章永遠不會被建置 | Archeology |
| 相鄰文章 | `AdjacentArticles`、`prevPost`/`nextPost` | 「« 上一篇」「下一篇 »」 | 依**閱讀順序**而非發布時間；系列：第一篇→最後一篇；單篇：最新→最舊（方向差異是刻意的） | Archeology |
| 閱讀順序 | `articlesInReadingOrder`、`sortArticlesBySeries` | — | 見「相鄰文章」；系列頁的分頁順序與它一致 | Archeology |
| 系列頁分頁 | `ARTICLES_PER_PAGE`（12）、`paginate` | 「第 N / M 頁」「← 上一頁」「下一頁 →」 | 每頁 12 篇，每頁都是真實路徑（`/series/foo/2`） | Archeology |
| 留言 | `GiscusComments`（Giscus，以文章標題 `mapping=title` 對應） | 文章底部留言區 | 以 GitHub Discussions 承載；跟隨站台主題切換 | Archeology |
| 閱讀進度 | `ReadingProgress` | 頁面頂端進度條 | 純呈現 | Archeology |

### 1.2 便利貼（Sticky Notes）

| Domain Term | Technical Name | User-Facing Label | Definition & Business Rules | Status |
| :--- | :--- | :--- | :--- | :--- |
| 便利貼（Sticky Note） | `Note`（`stickyNotes.ts`）、`.sticky-note` | 便利貼 | 讀者在文章頁自建的筆記；欄位 `id`、`text`、`color`、`x`、`y`、選填 `w`/`h` | Archeology |
| 便利貼存放 | `STORAGE_PREFIX` + `location.pathname`（`sticky-notes:/blogs/...`） | — | 每篇文章各自一份，存讀者瀏覽器 `localStorage`；儲存失敗時本次瀏覽仍可用 | Archeology |
| 便利貼上限 | `MAX_NOTES`（20） | 「便利貼數量已達上限（20 張）」 | 每篇文章最多 20 張；超過時不新增並短暫提示 | Archeology |
| 便利貼面板 | `sticky-notes-panel`、`sticky-notes-fab` | 「我的便利貼」「便利貼內容」 | 列表檢視＋單張詳情檢視；手機唯一入口（桌機亦可用） | Archeology |
| 垃圾桶區 | `sticky-notes-trash`、`TRASH_THRESHOLD`（90px） | 「拖到這裡刪除」 | 拖曳便利貼到視窗頂端 90px 內放開即刪除 | Archeology |
| 便利貼最小尺寸 | `MIN_W`（120）、`MIN_H`（80） | — | 縮放時不得小於此尺寸 | Archeology |

### 1.3 個人介紹、作品集與履歷

| Domain Term | Technical Name | User-Facing Label | Definition & Business Rules | Status |
| :--- | :--- | :--- | :--- | :--- |
| 站台名稱 | `basic.site_name`（`introduce.json`）、RSS `title` | Coding Afternoon | 頁首 logo 與 RSS 標題 | Archeology |
| 導覽選單 | `menuItems`（`introduce.json`） | About Me / Blog / Series | 對應 `/`、`/blogs`、`/series` | Archeology |
| 作品集項目（Portfolio Project） | `introduce.json` 的 `projects`、`Portfolio.astro`、`data-project-type` | 首頁作品集卡片 | 首頁展示的作品；依 `type.en` 篩選 | Archeology |
| 作品類型 | `ProjectItem.type`（`LocalizedText`） | 篩選標籤（含數量） | 見 §4 作品類型 | Archeology |
| 履歷（CV） | `CvData`（`cv.json`）、`/cv/{lang}` | CV、Curriculum Vitae | 雙語履歷頁，可存成 PDF（瀏覽器列印，檔名取自 `<title>`） | Archeology |
| 基本資料 | `BasicInfo`（`name`、`job`、`location`、`email`、`looking_for`、`summary`） | 履歷頁首、Summary | `summary` 必填；`looking_for` 選填 | Archeology |
| 求職意向 | `basic.looking_for`、`CVLookingFor` | Looking for | 選填；有值才顯示 | Archeology |
| 技能分組 | `SkillGroup`（`category`、`items`） | Skills | 選填 | Archeology |
| 工作經歷 | `ExperienceItem`（`title`、`sub_title`、`years`、`details`、`achievements`）、`experiences` | Experience | `title` 職稱／公司、`sub_title` 次要說明、`years` 期間字串 | Archeology |
| 技術寫作與開源 | `side_projects`（型別同 `ExperienceItem`） | 技術寫作與開源 / Writing & Open Source | 以經歷格式呈現的 side project 區塊 | Archeology |
| 學歷 | `EducationItem` | Education | | Archeology |
| 社群連結 | `SocialLink`（`iconName`、`link`） | 頁首／履歷頁首圖示 | | Archeology |
| 多語文字 | `LocalizedText`（`en` 必填、`zh` 選填）、`getLocalizedText()` | — | 取指定語系，缺則退回英文，再缺用 fallback | Archeology |

---

## 2. Actions & Processes
*Records business operations, function logic, and their corresponding business actions.*

| Business Action | Technical Method | Trigger | Business Impact | Notes |
| :--- | :--- | :--- | :--- | :--- |
| 發布文章 | 新增 `.md` 到 `src/content/blogs/`，`git push` 到 `main` | 推上 main | GitHub Actions 建置並部署到 GitHub Pages | 本 repo 直接在 main 提交 |
| 撤回／暫存為草稿 | frontmatter 加 `draft: true` | 編輯文章 | 文章自列表、系列、上下篇、RSS 消失，頁面不建置（網址不存在） | 發布時移除 |
| 過濾已發布文章 | `getPublishedBlogs()` / `isPublished()` | 建置期間每個取用文章的頁面 | 確保草稿全站一致隱藏 | |
| 歸入系列 | `groupIntoSeries()` | 建置系列頁、文章列表 | 依 `parent` 分組；系列依各自最新一篇發布日期新到舊排列 | |
| 排序系列文章 | `sortArticlesBySeries(order)` | 系列分組時（預設 `seriesIndex-asc`） | 決定系列內閱讀順序 | |
| 找相鄰文章 | `findAdjacent()`、`getAdjacentPosts()`、`getAdjacentSeriesPosts()` | 建置文章頁 | 產生上一篇／下一篇連結 | 有 `parent` 走系列，否則走單篇 |
| 產生系列代稱 | `createSlug()` | 系列分組時 | 決定 `/series/{slug}` 網址 | |
| 搜尋文章 | `initBlogSearch()` / `applySearch()`（`BlogList.astro`） | 讀者在文章列表輸入關鍵字 | 以標題或系列名稱（不分大小寫、包含比對）篩選；搜尋時連進行中系列的文章也納入；無結果顯示「沒有找到符合的文章」 | 純前端 |
| 產生 RSS | `GET` in `rss.xml.ts` | 建置 | 已發布文章依日期新到舊輸出 `zh-TW` feed | |
| 新增便利貼 | `addNote()`（桌機：文章左右留白處三連擊）、`addNoteFromPanel()`（面板「＋ 新增便利貼」） | 讀者操作 | 新增一張黃色空白便利貼並存檔；達上限則提示 | 桌機寬度門檻 `DESKTOP_MIN` 768px |
| 編輯便利貼 | `syncText`（即時存）、詳情頁「保存這張便利貼」 | 讀者輸入 | 每次輸入即寫入 localStorage，避免重新整理遺失 | |
| 移動／縮放便利貼 | `onPointerMove`/`onPointerUp`、`clampToViewport()` | 拖曳標題列／右下角 | 位置限制在視窗內；放開時存檔 | |
| 切換便利貼顏色 | 顏色按鈕循環 `COLORS`、詳情頁色票 | 讀者點擊 | 改色並存檔 | |
| 刪除便利貼 | `removeNote()` | 點 ×、拖到垃圾桶區、面板列表 × | 自畫面與存放中移除 | |
| 切換主題 | `getNextTheme()`、`ThemeToggle` | 讀者點主題按鈕 | `<html data-theme>` 在 `light`/`dark` 間切換；Mermaid 圖與 Giscus 跟著重繪 | |
| 篩選作品集 | `filterProjects(category)` | 讀者點作品類型標籤 | 只顯示該類型作品（`all` 顯示全部） | |
| 切換履歷語系 | `LanguageSwitcher`、`/cv/en`、`/cv/zh` | 讀者點語系 | 以 `getLocalizedText` 重新取字 | |
| 履歷存成 PDF | `DownloadButton` | 讀者點「存成 PDF / Save as PDF」 | 呼叫瀏覽器列印；建議檔名 `{name} - {job} - CV` | |

---

## 3. Ambiguities & Conflicts
*Records cases where the same technical term means different things in different modules, or multiple terms refer to the same concept.*

| Ambiguous Term | Meaning in Context A | Meaning in Context B | Resolution |
| :--- | :--- | :--- | :--- |
| `blog` / `post` / `article` | collection 與型別叫 `blogs`、`BlogEntry` | 純邏輯層叫 `ArticleLike`、`articles`；導覽叫 `prevPost`/`nextPost`；UI 叫「文章」「Recent posts」 | 待確認：建議領域詞固定為「文章（Article）」，`blogs` 只保留為 collection 名稱 |
| `parent` | frontmatter 欄位名，值是系列名稱 | 元件 `ParentItem` / `parentName` / `childrenCount` 代表「系列卡片」 | 待確認：領域詞為「系列」；`parent` 視為歷史欄位名不改，元件命名可逐步改為 Series 語彙 |
| `slug` | 文章頁路由參數 `[...slug]` = `blog.id`（檔案路徑） | `Series.slug` = `createSlug(系列名稱)` | 兩者不同概念；建議稱前者「文章路徑（id）」、後者「系列代稱」 |
| `projects` | `introduce.json` 的作品集項目（首頁 Portfolio） | `cv.json` 的 `projects`（履歷 Projects 區塊），兩份資料各自維護 | 待確認：兩者是否應為同一份資料來源，或確實是不同受眾的兩種清單 |
| `side_projects` vs `projects` vs 作品類型 `Side Project` | 履歷的 `side_projects` 以經歷格式呈現，標題「技術寫作與開源」 | 作品集 `type.en = "Side Project"` 是類型標籤 | 待確認命名；`side_projects` 實際內容偏「技術寫作與開源」 |
| `Experience` | `components/sections/portfolio/Experience.astro`（首頁） | `components/cv/CVExperience.astro`（履歷，亦用於 side projects） | 兩套呈現；確認是否共用同一份資料（`introduce.json` vs `cv.json` 都有 `experiences`） |
| 語系代碼 | `Language = 'en' \| 'zh'`（資料與網址） | HTML `lang` 用 `zh-TW`；RSS 與日期格式用 `zh-TW` | `zh` 為內部代碼，對外輸出一律 `zh-TW` |
| 草稿 vs 未部署 | `draft: true`：在 collection 內、刻意隱藏 | `src/content/not-deployed/`：不在 collection 內 | 待確認：未部署資料夾是否為已淘汰的舊機制，新文章一律用 `draft` |
| 「上一篇」方向 | 系列文章：更早的一天 | 單篇文章：**更新**的一篇 | 刻意設計，已有測試鎖住；保留，於 UI 文案不另區分 |
| `Note` | 便利貼（`stickyNotes.ts`） | 部落格內容中的「筆記」類文章（如「原子習慣 note」） | 程式碼內 `Note` 專指便利貼；建議領域詞用「便利貼」 |

---

## 4. External & Enum Mapping
*Records magic numbers/strings in code and their real business meaning.*

| Category | Code Value / Key | Domain Label | Description |
| :--- | :--- | :--- | :--- |
| 系列排序方式 `ArticleSortOrder` | `seriesIndex-asc`（預設）/ `seriesIndex-desc` | 依系列序號 | 未設序號者排後，同序號依發布日期 |
| 系列排序方式 | `date-asc` / `date-desc` | 依發布日期 | |
| 系列排序方式 | `title-asc` / `title-desc` | 依標題 | 以 `zh-TW` locale 比較 |
| 草稿旗標 | `draft: true` / 省略或 `false` | 草稿 / 已發布 | |
| 系列頁每頁篇數 | `ARTICLES_PER_PAGE = 12` | 每頁 12 篇 | |
| 空系列代稱退路 | `'series'` | — | `createSlug` 產不出字元時使用 |
| 便利貼顏色 | `yellow`（預設）/ `pink` / `blue` / `green` | 黃／粉／藍／綠 | 點顏色鈕依此順序循環 |
| 便利貼上限 | `MAX_NOTES = 20` | 每篇 20 張 | |
| 便利貼桌機門檻 | `DESKTOP_MIN = 768` | 桌機寬度 | 低於此寬度不啟用三連擊新增 |
| 垃圾桶區高度 | `TRASH_THRESHOLD = 90` | 拖到頂端 90px 刪除 | |
| 便利貼最小尺寸 | `MIN_W = 120`、`MIN_H = 80` | — | px |
| 便利貼存放鍵 | `sticky-notes:{pathname}` | — | localStorage key |
| 主題 | `light` / `dark`（`<html data-theme>`） | 淺色／深色 | Giscus 對應 `light_protanopia` / `dark_protanopia` |
| 履歷語系 | `en` / `zh` | English / 中文 | 非法值退回 `en` |
| 作品類型 | `Side Project` / `Blog Series` / `DevOpsDays Speaker` / `SDK` / `Certification` | 篩選標籤 | 取自 `introduce.json` 的 `type.en`；`all` 為「全部」 |
| 導覽選單 | `/`、`/blogs`、`/series` | About Me、Blog、Series | |
| Giscus 對應方式 | `data-mapping = 'title'` | 以文章標題對應討論串 | 注意：改文章標題會斷開既有留言 |
| 外部服務 | Cloudflare R2 | 圖片與 CV PDF 資產 | 不放 `public/` |
| 外部服務 | Giscus（GitHub Discussions，category `General`） | 留言 | |
| 外部服務 | GitHub Pages（`CNAME`：coding-afternoon.com） | 站台部署 | 推 main 由 Actions 部署 |

---

## Quick Start Guide
1. **Archeology** — read source code; fill `Technical Name` with raw names found in the codebase.
2. **Mapping** — check UI screens or ask business stakeholders; fill `Domain Term` with the correct canonical name.
3. **Refine** — add business rules (e.g., "this field cannot be negative", "this action must occur after checkout").
4. **Sync** — this document is the single authoritative dictionary for all future renaming, refactoring, and new documentation.
