# Article Sticky Notes — Requirements Brief

## Goal
讓讀者在部落格文章頁貼上可編輯、可移動、可刪除的便利貼做個人筆記；便利貼依文章分組存於瀏覽器 localStorage，並在重訪該文章時自動還原。

## Requirements
- **新增（桌機）**：在文章兩側空白處連點三下（triple-click），於該位置新增一張便利貼。
- **新增/管理（窄螢幕）**：角落提供一個浮動的漢堡選單圖示按鈕；點擊後彈出 pop-up 小視窗，列出本篇所有便利貼，讀者可在面板內進行新增與刪除。
- 一篇文章可同時存在多張便利貼。
- 便利貼內容為純文字、可點擊就地編輯，失焦（blur）時自動儲存。
- 便利貼可選擇顏色（對齊手繪設計系統色票）。
- 可拖曳移動便利貼到讀者想釘選的位置；定位基準為「固定於視窗（fixed to viewport）」——捲動文章時便利貼留在畫面上。
- **刪除方式兩種並存**：
  - (a) 每張便利貼上的「X」按鈕，點擊即刪。
  - (b) 將便利貼拖到視窗頂端邊緣時浮現垃圾桶區提示，放開即刪。
- **持久化**：所有便利貼的文字、顏色、位置存於 localStorage，以文章為 key 分組；重訪同一篇文章時還原全部便利貼與其狀態。
- 外觀對齊手繪 `--hd-*` 設計系統（sketchbook 風格）；非互動時不干擾正常閱讀。

## Out of Scope
- 跨裝置 / 雲端同步、登入、後端儲存（僅 localStorage）。
- 便利貼之間連線、富文本、圖片、標籤等進階筆記功能。
- 匯出 / 匯入便利貼。
- 非文章頁（首頁、CV、系列列表等）的便利貼功能。

## Open Decisions
Items the PRD author should resolve:
- 桌機是否也提供浮動漢堡面板作為列表/管理入口，或桌機僅靠三連點新增、窄螢幕才出現面板。
- 「固定於視窗」的便利貼在不同視窗寬度下的位置還原策略（存絕對 px 或相對比例/百分比，避免縮放後跑版或超出畫面）。
- localStorage key 命名規則（以文章 slug/id 分組）與容量上限（每篇張數上限、超量處理方式）。
- 顏色選項的數量與具體色票（需對應 handdrawn `--hd-*` tokens）。
- 觸發手勢與瀏覽器原生「三連點選取整段文字」的衝突處理方式。
- 窄螢幕 / 桌機判斷的斷點（沿用既有 Tailwind 斷點，例如 md）。

## Context / Background
- 技術棧：Astro 6 + Tailwind + SCSS（手繪設計系統）。文章頁透過 `src/pages/blogs/[...slug].astro` 渲染，內容置於置中的 `<article>`（`max-w-4xl`）。側邊空白僅在桌機存在，窄螢幕為滿版——因此需要獨立的窄螢幕新增路徑（浮動漢堡面板）。
- 既有元件慣例：自包含的 `.astro` 元件搭配 inline `<script>`（如 `BackToTop.astro`、`ReadingProgress.astro`），由頁面引入。本功能預期實作為新元件（如 `StickyNotes.astro`）加入 blog 詳情頁。
- `localStorage` 已用於主題（`Layout.astro` 的 theme 初始化），便利貼沿用相同持久化方式。
- 樣式需對齊 `src/styles/handdrawn/`、`src/styles/blog.css` 的 `--hd-*` tokens；顏色選項應映射至手繪色票。
- 專案先前無 `.sdd/`，此為第一份 feature brief。

### Clarification 決議摘要
- 刪除方式：兩種都做（X 按鈕 + 拖到頂端垃圾桶）。
- 窄螢幕：浮動漢堡選單按鈕 → pop-up 面板列出便利貼，於面板內新增/刪除。
- 定位基準：固定於視窗。
- 內容形式：純文字 + 可選顏色。
