# 實作計畫：文章頁面導覽按鈕

**分支**：`003-short-name-add` | **日期**：2025-10-19 | **規格**：[spec.md](./spec.md)
**輸入**：來源於 `/specs/003-short-name-add/spec.md` 的功能規格與研究

> 提醒：所有段落必須使用繁體中文撰寫，並遵守《CodeMachine0121 技術分享部落格憲章》之核心原則。

## 摘要

此計畫旨在為每篇文章頁面底部新增「上一篇」與「下一篇」的導覽按鈕。目標是提升讀者在不同文章間的切換流暢性，鼓勵連續閱讀。此功能將根據文章的發表日期（由新到舊）來決定導覽順序，並在按鈕上顯示相鄰文章的標題。

## 技術背景

**語言／版本**：TypeScript 5.x、Astro 4.x
**主要相依**：Tailwind CSS
**資料儲存**：Markdown (.md) 檔案
**測試工具**：Astro check、ESLint
**目標平臺**：靜態網站託管 (Netlify)
**專案型態**：單一前端
**效能目標**：頁面載入時間維持在 2 秒內
**限制條件**：建置需於 5 分鐘內完成
**規模／範圍**：應用於所有位於 `src/content/blogs/` 的文章

## 憲章檢查

*閘門：在 Phase 0 研究前必須確認以下條目均符合，Phase 1 設計完成後再次核對。*

- **極簡優先（KISS）**：是，此功能將重用現有元件樣式，且僅新增必要的導覽邏輯。
- **Astro + TypeScript 標準堆疊**：是，將完全在現有技術堆疊內實作。
- **提交前強制品質檢查**：是，現有的 Lint 與型別檢查流程將涵蓋新程式碼。
- **建置門檻**：是，`npm run build` 將作為驗收標準之一。
- **文件全面採用繁體中文**：是，所有產出文件與註解皆為繁體中文。
- **知識分享須可驗證**：是，此功能的 UI 變更是可直接驗證的。

## 專案結構

### 文件（此功能）

```
specs/003-short-name-add/
├── plan.md              # 本文件（由 /speckit.plan 產出）
├── research.md          # Phase 0 產出
├── data-model.md        # Phase 1 產出
├── quickstart.md        # Phase 1 產出
├── contracts/           # Phase 1 產出 (不適用)
└── tasks.md             # Phase 2 產出（由 /speckit.tasks 產生）
```

### 原始碼（儲存庫根目錄）

此功能將修改或建立以下檔案：

```
src/
├── components/
│   └── sections/
│       └── blog/
│           └── PostNavigation.astro  # (新) 導覽按鈕元件
├── layouts/
│   └── BlogPostLayout.astro      # (修改) 整合 PostNavigation 元件
└── utils/
    └── blog.ts                 # (修改) 新增取得相鄰文章的輔助函式
```

**結構決策**：遵循現有的專案結構，將新功能模組化為一個獨立的 Astro 元件 (`PostNavigation.astro`)，並在部落格文章的版面 (`BlogPostLayout.astro`) 中使用它。相關的業務邏輯（如尋找上一篇/下一篇文章）將放在 `src/utils/blog.ts` 中，以保持關注點分離。

## 複雜度追蹤

*僅在無法完全符合憲章原則時填寫，並提供具體理由。*

| 違反項目 | 為何必要 | 捨棄較簡單方案的原因 |
|----------|----------|----------------------|
| N/A      | N/A      | N/A                  |