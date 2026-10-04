# Project Overview

**Project:** Coding Afternoon（CodeMachine0121.github.io）
**Bounded Context:** 個人技術部落格與作品集——文章發布與閱讀（文章／系列／草稿／導覽／搜尋／便利貼）、個人介紹與作品集、履歷（CV）
**Last Updated:** 2026-10-04
**Status:** Active

> 標記說明：`[推論]` = 由程式碼、設定檔或既有文件自動推得，待維護者確認；`TBD` = 無法從程式碼推得，需維護者補上。

---

## 1. Vision & Mission

- **Problem Statement:** 把實務經驗整理成可公開閱讀的技術文章與系列（含 iThome 鐵人賽），同時作為個人品牌與求職的門面（作品集＋履歷）。
- **Target Users:**
  - 主要：繁體中文的軟體工程師讀者（含 iThome 讀者），閱讀單篇文章與系列。
  - 次要：國際招募方，透過英文版履歷與作品集了解維護者。
- **Success Metrics:**
  - 系列文章依規劃穩定發布（日期連續、無漏篇）。
  - 已上線網址零壞連結（文章路徑、系列代稱、分頁、RSS 不因改動而 404）。
  - 推上 `main` 即自動部署，且 CI（lint → test → build → test:build）全過。
- **Out of Scope:**
  - 不做後端、登入或會員；不收集讀者個資。
  - 不做跨裝置同步（便利貼等讀者資料只存本機）。
  - 不做付費內容或電子報。
  - 不導入 CMS；文章一律以 Markdown 寫在 repo 內。

---

## 2. Core Tech Stack

| Layer | Technology | Version / Notes |
| :--- | :--- | :--- |
| Frontend | Astro（靜態輸出）＋ TypeScript（`astro/tsconfigs/strict` ＋ `noUncheckedIndexedAccess`） | astro 6.4.6、typescript ^5.5 `[推論]` |
| Styling | Tailwind CSS 3 ＋ `@tailwindcss/typography`、Sass（handdrawn 設計系統 `src/styles/handdrawn/`、CV 樣式） | 主題以 `<html data-theme>` 切換 light／dark `[推論]` |
| Backend | 無——純靜態站，無伺服器端程式 | `[推論]` |
| Database | 無——文章為 Markdown（Astro content collection `blogs`）；個人資料為 `src/config/introduce.json`、`cv.json`；讀者便利貼存在讀者瀏覽器 localStorage | `[推論]` |
| Infrastructure | GitHub Pages（自訂網域 `coding-afternoon.com`），GitHub Actions 推 `main` 即建置部署 | `[推論]` |
| Runtime / Tooling | Bun（安裝、腳本、單元測試）；ESLint 9 flat config | `[推論]` |
| Key Libraries | `@astrojs/mdx`、`@astrojs/rss`、`@astrojs/sitemap`、`astro-icon`、`mermaid`（前端渲染概念圖）、`remark-math` ＋ `rehype-katex`（建置期數學式） | `[推論]` |
| Testing | `bun test`（單元＋建置產物驗收）、Playwright ＋ `playwright-bdd`（E2E） | `[推論]` |
| External Services | Cloudflare R2（圖片與 CV PDF 資產）、Giscus（GitHub Discussions 留言）、Google Fonts | `[推論]` |

---

## 3. Architecture Principles

- **Style:** 靜態網站（SSG）單體 repo；所有頁面在建置期產生，部署產物為 `dist/`。`[推論]`
- **Key Patterns:** `[推論]`
  - **純邏輯與框架分離**：`src/utils/series-core.ts` 不 import `astro:content`，只依賴結構型別 `ArticleLike`，可直接被 `bun test` 涵蓋；`series.ts` 只負責從 collection 取資料。
  - **單一取用入口**：全站取文章一律走 `getPublishedBlogs()`，草稿過濾集中一處。
  - **資料驅動頁面**：作品集與履歷內容放 JSON 設定檔，元件只負責呈現；「進行中的系列」由資料決定，不寫死名稱。
  - **漸進增強**：互動（搜尋、作品集篩選、便利貼、主題切換）皆為前端腳本；沒有 JS 也要能閱讀（有 noscript 退路與建置產物測試把關）。
- **Folder / Layer Structure:** `[推論]`
  - `src/pages/` 路由；`src/layouts/` 頁面外框與 SEO meta；`src/components/`（`layouts/`、`sections/`、`common/`、`cv/`）
  - `src/content/blogs/` 文章（collection 來源）；`src/content/not-deployed/` 不建置的舊文
  - `src/utils/` 純邏輯與 collection 包裝；`src/types/` 型別；`src/scripts/` 前端互動；`src/plugins/` remark 插件；`src/config/` JSON 資料；`src/styles/` 樣式
  - `tests/` 建置產物驗收；`e2e/` Playwright BDD
- **Data Flow:** Markdown／JSON → 建置期（content collection ＋ remark／rehype 插件 ＋ series 分組排序）→ 靜態 HTML／RSS／sitemap → GitHub Pages。讀者端資料（便利貼、主題偏好）只存在讀者瀏覽器。`[推論]`

---

## 4. Development Conventions

- **Naming:** `[推論]`
  - TypeScript 開啟 strict 與 `noUncheckedIndexedAccess`；未使用變數以 `_` 前綴豁免。
  - 文章檔名不得含 ASCII 斜線 `/`（會破壞網址）。
  - 系列代稱即網址，已上線的 slug 以測試鎖住，改 slug 規則不得改到既有網址。
  - 領域用語以 `.sdd/UL-MAP.md` 為準。
- **Branching Strategy:** 直接在 `main` 提交（trunk-based），不開 feature branch、不做 merge commit；推上 `main` 即部署。`[推論，來自維護者既有偏好]`
- **Commit Message:** 英文 Conventional Commits（如 `feat(content): …`、`fix(seo): …`、`refactor(cv): …`）。`[推論]`
- **Testing Requirements:** `[推論]`
  - 單元測試放在所屬層級的 `tests/` 子資料夾（如 `src/utils/tests/`），`bun run test`。
  - 建置產物驗收在根目錄 `tests/`，需先 build（`bun run test:build`），檢查 SEO meta、canonical／OG、無重複 DOM id、無 `console.log`、系列分頁真實路徑等。
  - 互動功能以 Playwright BDD 撰寫 E2E（`bun run e2e`）。
  - 刻意的行為（如上一篇／下一篇方向差異）必須有測試鎖住。
- **Code Review Rules:** 個人專案，無必要審查者；CI 關卡為 `lint → test → build → test:build`（`bun run verify` 同一條），全過才部署。`[推論]`
- **Content Rules:** 文章撰寫規範見 `.claude/rules/blog-writing-style.md`（正文從 h2 起、frontmatter 必填欄位、無 emoji、語氣與人稱等）；iThome 系列另依 `.claude/docs/` 的系列規劃與 `.claude/rules/` 相關規範。`[推論]`

---

## 5. Non-Negotiables & Constraints

- **Performance SLAs:** 不設數字門檻；守住既有做法：
  - 字型不阻塞首屏
  - 數學式在建置期渲染
  - 圖片走 CDN（R2）
  - 沒有 JS 也能閱讀
  - 手機寬度可用
- **Security Requirements:** 無登入、無後端、不收集讀者個資；讀者便利貼只存本機瀏覽器，不上傳。`[推論]`
- **Operational Constraints:** `[推論]`
  - 只能是靜態產物（GitHub Pages），任何功能不得依賴伺服器端執行。
  - 圖片與 PDF 資產放 Cloudflare R2，**不放 `public/`**。
  - production bundle 不得含 `console.log`（ESLint 與產物測試雙重把關）。
  - 草稿（`draft: true`）不得出現在任何列表、系列、上下篇、RSS，也不建置頁面。
  - 已上線網址（文章路徑、系列代稱）視為對外契約，不得無意間變動。
- **Known Technical Debt:** `[推論]`
  - `introduce.json` 與 `cv.json` 各自維護 `experiences`／`projects`，資料重複（見 UL-MAP §3）。
  - `src/content/not-deployed/` 與 `draft` 兩種隱藏機制並存。
  - 元件命名仍沿用 `parent` 語彙（`ParentItem`、`parentName`），與領域詞「系列」不一致。
  - `src/pages/ai-redefines-software.astro` 為獨立頁面，自行載入 Tailwind CDN，未走共用 Layout。

---

## 6. Glossary Reference

> Domain terms are maintained in `.sdd/UL-MAP.md`. This section links key terms
> relevant to project-level decisions.

| Term | Short Definition |
| :--- | :--- |
| 文章（Article） | `src/content/blogs/` 下的一篇 Markdown，由 frontmatter 描述 |
| 系列（Series） | `parent` 相同的文章集合；有自己的系列頁與閱讀順序 |
| 系列代稱 | 由系列名稱轉出的網址片段 `/series/{slug}`，上線後不得變動 |
| 草稿（Draft） | `draft: true` 的文章，全站隱藏且不建置 |
| 已發布文章 | 經 `getPublishedBlogs()` 過濾後的文章，全站唯一取用入口 |
| 相鄰文章 | 依閱讀順序的上一篇／下一篇；系列與單篇方向刻意不同 |
| 進行中的系列 | 最近更新的系列，文章列表頁只掛它的入口 |
| 便利貼（Sticky Note） | 讀者在文章頁自建、存在本機瀏覽器的筆記，每篇上限 20 張 |
| 作品集項目 | 首頁展示的作品，依作品類型篩選 |
| 履歷（CV） | 中英雙語履歷頁，可存成 PDF |
