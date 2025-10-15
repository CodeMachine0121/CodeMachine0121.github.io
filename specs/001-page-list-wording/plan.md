# 實作計畫：系列文章頁面與標記規範

**分支**：`001-page-list-wording` | **日期**：2025-10-16 | **規格**：`specs/001-page-list-wording/spec.md`  
**輸入**：來源於 `/specs/001-page-list-wording/spec.md` 的功能規格與研究

> 提醒：所有段落必須使用繁體中文撰寫，並遵守《CodeMachine0121 技術分享部落格憲章》之核心原則。

## 摘要

建立「系列文章」頁面，使用長條卡片清單呈現各系列主標題；點擊卡片於頁內展開該系列所含文章清單，再次點擊可收合。為符合後續作者維運需求，規範以 Markdown Frontmatter 欄位 `parent` 作為系列標記，文章加入時只需設定 `parent: "系列主題"`（可選 `seriesIndex` 控制系列內排序）。全部文件與規格維持繁體中文，並遵守 KISS 原則。

## 技術背景

**語言／版本**：TypeScript 5.x、Astro 5.4.1  
**主要相依**：`@astrojs/mdx`、`@astrojs/sitemap`、Tailwind CSS  
**資料儲存**：N/A（內容來源為 Markdown 檔）  
**測試工具**：Astro Check、ESLint（需補 `npm run lint` 腳本與設定）  
**目標平臺**：靜態網站託管（Netlify 設定已存在）  
**專案型態**：單一前端網站  
**效能目標**：系列頁卡片載入 < 1 秒、展開/收合互動回饋 < 1 秒  
**限制條件**：建置時間 < 5 分鐘；提交前需通過 Lint 與型別檢查  
**規模／範圍**：可支援數十個系列、每系列數十篇文章

## 憲章檢查

*閘門：在 Phase 0 研究前必須確認以下條目均符合，Phase 1 設計完成後再次核對。*

- 極簡優先（KISS）：採用既有 `blogs` collection 與 Frontmatter `parent` 聚合，不新增額外資料層。✓
- Astro + TypeScript 標準堆疊：維持現況並於 `src/pages/series.astro` 實作。✓
- 提交前強制品質檢查：補 `npm run lint` 與 ESLint 設定，CI 與 pre-commit 執行。△（需新增）
- 文件全面採用繁體中文：本計畫與規格已符合。✓
- 知識分享須可驗證：提供作者標記事例與手動驗證步驟於 quickstart.md。✓

## 專案結構

### 文件（此功能）

```
specs/[###-feature]/
├── plan.md              # 本文件（由 /speckit.plan 產出）
├── research.md          # Phase 0 產出
├── data-model.md        # Phase 1 產出
├── quickstart.md        # Phase 1 產出
├── contracts/           # Phase 1 產出
└── tasks.md             # Phase 2 產出（由 /speckit.tasks 產生）
```

### 原始碼（儲存庫根目錄）

```
# 單一前端專案
src/
├── components/
├── content/
├── layouts/
└── pages/
    └── series.astro   # 系列文章頁面（新）

public/

tests/
├── lint/
├── type/
└── integration/
```

> 若專案需要其他結構（例如加入 API 或分離後台），必須在此明確記錄並說明緣由。

**結構決策**：沿用 `src/content/config.ts` 的 `blogs` collection 與現有 `src/pages/blogs/*`。新增 `src/pages/series.astro`，以 `getCollection('blogs')` 讀取內容後依 `parent` 聚合顯示。

## 複雜度追蹤

*僅在無法完全符合憲章原則時填寫，並提供具體理由。*

| 違反項目 | 為何必要 | 捨棄較簡單方案的原因 |
|----------|----------|----------------------|
| （無） | — | — |
