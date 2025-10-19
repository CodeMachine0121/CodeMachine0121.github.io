# 實作計畫：重新設計系列頁面

**分支**：`002-base-on-the` | **日期**：2025-01-21 | **規格**：[spec.md](./spec.md)  
**輸入**：來源於 `/specs/002-base-on-the/spec.md` 的功能規格與研究

> 提醒：所有段落必須使用繁體中文撰寫，並遵守《CodeMachine0121 技術分享部落格憲章》之核心原則。

## 摘要

將現有系列頁面從展開/收合式介面重新設計為卡片導覽式介面。主要變更包括：(1) 系列概覽頁僅顯示系列標題和文章數量的簡潔卡片；(2) 建立動態路由 `/series/[slug]` 頁面，使用既有 BlogList 組件顯示系列內文章；(3) 實作 URL slug 自動轉換機制處理中文系列名稱；(4) 加入分頁功能支援大量文章的系列。此設計將提供與部落格清單一致的使用者體驗。

## 技術背景

**語言／版本**：TypeScript 5.x、Astro 5.x  
**主要相依**：既有 Astro 專案依賴，重用 BlogList 與 BlogItem 組件  
**資料儲存**：N/A（基於既有 Astro content collections）  
**測試工具**：Astro check、ESLint  
**目標平臺**：靜態網站託管  
**專案型態**：單一前端  
**效能目標**：系列頁面載入時間 < 2秒，分頁載入 < 1秒  
**限制條件**：必須重用既有 BlogList 組件，維持現有資料結構  
**規模／範圍**：支援任意數量系列，單一系列最佳化至 500+ 文章

## 憲章檢查

*閘門：在 Phase 0 研究前必須確認以下條目均符合，Phase 1 設計完成後再次核對。*

**Phase 1 完成後核對結果**:

- ✅ 極簡優先（KISS）：重用既有組件（BlogList, BlogItem），最小化新增程式碼，僅新增必要工具函式
- ✅ Astro + TypeScript 標準堆疊：完全維持現有架構和語言，使用 Astro 動態路由與內建功能
- ✅ 提交前強制品質檢查：使用既有 lint 與型別檢查流程，無需額外工具
- ✅ 建置門檻：所有新功能確保 `npm run build` 於本機與 CI 通過
- ✅ 文件全面採用繁體中文：所有新增文件、註解、介面均使用繁體中文
- ✅ 知識分享須可驗證：提供詳細 quickstart.md 與測試檢查清單，所有功能可獨立驗證

## 專案結構

### 文件（此功能）

```
specs/002-base-on-the/
├── plan.md              # 本文件（由 /speckit.plan 產出）
├── research.md          # Phase 0 產出
├── data-model.md        # Phase 1 產出
├── quickstart.md        # Phase 1 產出
├── contracts/           # Phase 1 產出
└── tasks.md             # Phase 2 產出（由 /speckit.tasks 產生）
```

### 原始碼（儲存庫根目錄）

```
src/
├── components/
│   └── sections/blog/   # 重用既有 BlogList, BlogItem
├── content/blogs/       # 既有內容不變
├── layouts/
└── pages/
    ├── series.astro     # 修改：系列概覽頁
    └── series/
        └── [slug].astro # 新增：動態系列頁面

utils/
└── slugify.ts          # 新增：URL slug 轉換工具
```

**結構決策**：採用 Astro 動態路由模式 `/series/[slug].astro` 處理個別系列頁面，重用既有 BlogList 架構以確保一致性與維護簡化。

## 複雜度追蹤

*僅在無法完全符合憲章原則時填寫，並提供具體理由。*

| 違反項目 | 為何必要 | 捨棄較簡單方案的原因 |
|----------|----------|----------------------|
| 無 | - | - |
