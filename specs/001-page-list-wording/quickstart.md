# 快速開始：系列文章頁面與作者標記

## 1. 新增文章並標示所屬系列

在 `src/content/blogs/...` 新增 Markdown（或 MDX）檔，於 Frontmatter 加入以下欄位：

```md
---
title: "我的第一篇測試文章"
datetime: "2025-10-16"
description: "這是一段摘要文字（可選）"
image: "https://example.com/cover.png" # 可選
parent: "Golang TDD 系列"          # 指定所屬系列（必要，若該文屬於系列）
seriesIndex: 1                      # 系列內順序（可選；小到大排序）
---
```

注意事項：
- `parent` 為系列主題名稱，頁面卡片標題將使用此值；同名即視為同一系列。
- 未填 `parent` 的文章不會出現在系列頁中。
- 未填 `seriesIndex` 時，預設以 `datetime` 由早到晚排序（舊 → 新）。

## 2. 檢視系列文章頁

啟動開發伺服器後，前往 `系列文章` 頁面（將新增 `src/pages/series.astro`）。
- 首頁可導向此頁（後續在導覽中加入入口）。
- 你會看到所有 `parent` 非空的系列，以長條卡片清單呈現。
- 點擊任一卡片可展開該系列文章列表，再次點擊可收合。

### 排序規則一覽

- 系列卡片排序：依系列名稱字母序（locale：zh-TW）。
- 系列內文章排序：
  1) 先依 `seriesIndex` 升冪（未設定者視為最大值置於最後）。
  2) 若相同或未設定，則依 `datetime` 由早到晚（舊 → 新）。

## 3. 驗證清單（手動）

- 頁面可載入且卡片樣式一致。
- 展開/收合在 1 秒內完成並有清楚狀態指示。
- 文章列表排序符合 `seriesIndex` → `datetime` 規則。
- 點擊文章項目可正確導向文章頁。

## 4. 品質檢查

- 提交前執行：
  - `npm run build`（含 `astro check` 型別檢查）
  - `npm run lint`（需新增 ESLint 腳本與設定）

## 5. 常見問題

- 看不到新增的系列？
  - 確認文章 Frontmatter 含 `parent` 且非空字串。
- 排序不如預期？
  - 檢查是否同時存在 `seriesIndex` 與正確的 `datetime` 格式。
