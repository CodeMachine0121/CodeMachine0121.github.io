# Product Requirements Document (PRD) — Article Sticky Notes（文章便利貼）

**Status:** Draft
**Version:** v1.3
**Owner:** James Hsueh
**Stakeholders:** Engineering（個人專案）

> ## 變更紀錄
>
> ### v1.1 — 自由調整大小
> - 便利貼右下角新增縮放把手，可拖曳調整寬高；最小尺寸 120×80。尺寸（w/h）隨便利貼存入 localStorage，重載還原。對應測試 TC-14、TC-15。
>
> ### v1.2 — 手機模式改為「漢堡選單 + 詳情頁」
> - 手機／窄螢幕（< md）**不再顯示浮貼便利貼**，也沒有三連點新增與拖曳垃圾桶；一切操作只透過漢堡選單面板。對應測試 TC-16。
> - 面板列表點選某張便利貼會「進入下一頁」的詳情畫面，顯示完整內容，且**可查看也可編輯**（文字 + 顏色）、可刪除、可返回列表。對應測試 TC-17、TC-18、TC-19。
> - 手機端的新增、修改、刪除、查看全部在漢堡選單內完成；選單外無法操作便利貼。
>
> ### v1.3 — 面板列表/詳情頁互動細修
> - 面板列表頁為純條列清單；按「新增便利貼」直接進入詳情頁撰寫內文，按上一頁（←）才回到列表。對應測試 TC-22。
> - 詳情頁底部按鈕為「保存這張便利貼」（upsert：沿用既有便利貼、更新其內容），保存後返回列表；刪除改為只在列表頁每列的 × 進行。對應測試 TC-19（保存）、TC-10（列表刪除）。
> - 修正詳情頁未正確隱藏的問題（CSS `display:flex` 蓋過 `[hidden]`）。

---

## 1. Background & Goal (Why & Goal)

- **Problem Statement:** 讀者在閱讀部落格文章時，常想就地記下想法、待查、重點，但目前頁面沒有任何個人標註機制，只能離開頁面另記，閱讀心流被打斷。
- **Expected Outcome:** 讀者可在文章頁直接貼上便利貼做筆記；便利貼依文章保存在瀏覽器 localStorage，重訪同篇文章時自動還原。成功訊號：在同一瀏覽器重訪文章時，先前新增的便利貼（文字、顏色、位置）完整重現，且新增/編輯/移動/刪除皆可正常操作。
- **Out of Scope:**
  - 跨裝置 / 雲端同步、登入、後端儲存（僅 localStorage）。
  - 便利貼之間連線、富文本、圖片、標籤等進階筆記功能。
  - 匯出 / 匯入便利貼。
  - 非文章頁（首頁、CV、系列列表等）的便利貼功能。

---

## 2. User Personas

- **Primary Role(s):** 部落格讀者（匿名、無登入）。
- **Usage Context:**
  - **桌機 / 寬螢幕（≥ md, 768px）**：文章 `<article>` 置中，兩側有空白區，於空白處互動新增便利貼。
  - **手機 / 窄螢幕（< md, 768px）**：文章滿版、兩側無空白，改以角落浮動的漢堡選單按鈕 + pop-up 面板管理便利貼。

---

## 3. User Stories & Acceptance Criteria

| ID | User Story | Acceptance Criteria | Priority |
| :--- | :--- | :--- | :--- |
| **US-01** | **As a** 桌機讀者, **I want** 在文章兩側空白處連點三下新增一張便利貼, **so that** 我能就地記下想法。 | 1. Given 視窗寬度 ≥ 768px，When 在文章左/右側空白處連續點擊三下，Then 在該點擊位置出現一張新便利貼且進入可編輯狀態。<br>2. 三連點落在正文文字上不觸發新增（避免與閱讀/選字衝突）；落在空白觸發區則阻止瀏覽器原生選字預設行為。 | P0 |
| **US-02** | **As a** 窄螢幕讀者, **I want** 透過浮動漢堡按鈕開啟面板新增/管理便利貼, **so that** 在沒有側邊空白的手機上也能用。 | 1. Given 視窗寬度 < 768px，Then 角落顯示一個浮動漢堡選單圖示按鈕。<br>2. When 點擊該按鈕，Then 彈出 pop-up 面板，列出本篇所有便利貼。<br>3. 面板內可「新增」一張便利貼，亦可對列表中任一便利貼執行「刪除」。 | P0 |
| **US-03** | **As a** 讀者, **I want** 編輯便利貼的純文字內容並選擇顏色, **so that** 我能寫下筆記並用顏色分類。 | 1. 點擊便利貼即可就地編輯純文字；失焦（blur）時自動儲存。<br>2. 每張便利貼可在 4 種顏色（黃 / 粉 / 藍 / 綠）間切換，新增時預設為黃色。 | P0 |
| **US-04** | **As a** 讀者, **I want** 拖曳移動便利貼到想釘選的位置, **so that** 便利貼留在我要的畫面位置。 | 1. 可用拖曳移動便利貼。<br>2. 定位基準為固定於視窗（position: fixed）：捲動文章時便利貼維持在畫面上的位置。<br>3. 放開後新位置即時儲存。 | P0 |
| **US-05** | **As a** 讀者, **I want** 用「X」按鈕或拖到頂端垃圾桶刪除便利貼, **so that** 移除不再需要的筆記。 | 1. 每張便利貼右上角有「X」按鈕，點擊即刪除。<br>2. 拖曳便利貼接近視窗頂端邊緣時，浮現垃圾桶區提示；在垃圾桶區放開即刪除。<br>3. 刪除後該便利貼自 localStorage 移除。 | P0 |
| **US-06** | **As a** 讀者, **I want** 我的便利貼在重訪文章時還原, **so that** 筆記不會遺失。 | 1. 便利貼的文字、顏色、位置存於 localStorage，以文章 slug 分組。<br>2. Given 同一瀏覽器重新載入或重訪同篇文章，Then 所有便利貼按原顏色與位置重現。<br>3. 不同文章的便利貼互不混雜。 | P0 |

---

## 4. Business Flow & Logic

- **Flow Diagram:**

```
桌機新增：side whitespace triple-click → 建立 note(@click pos, 黃, 空白文字) → 進入編輯 → blur 存檔
窄螢幕新增：浮動漢堡按鈕 → pop-up 面板 → 「新增」 → 建立 note → 面板列出
編輯：click note → 編輯純文字 → blur → 存檔
換色：note 上的顏色控制 → 切換 4 色之一 → 存檔
移動：drag note（fixed 定位）→ drop → 存新 px 位置
刪除：(a) note 的 X 按鈕；(b) drag 到視窗頂端 → 浮現垃圾桶區 → 在垃圾桶 drop → 移除
還原：頁面載入 → 讀 localStorage[key=slug] → 逐張渲染（位置 px 經 clamp 修正）
```

- **Core Business Rules:**
  - **桌機/窄螢幕判斷**：以 Tailwind `md` 斷點（768px）為界。桌機（≥768px）以三連點空白新增，**不提供**浮動漢堡面板；窄螢幕（<768px）以浮動漢堡面板新增/管理。
  - **定位基準**：所有便利貼為固定於視窗（`position: fixed`），捲動時不隨內容移動。
  - **位置儲存與還原**：以絕對 px 儲存（left/top）。還原時若位置超出目前可視區，夾回（clamp）至視窗邊界內，避免跑出畫面。
  - **顏色**：4 色（黃 / 粉 / 藍 / 綠），對齊手繪 `--hd-*` 設計系統色票；新增預設黃色。
  - **數量上限**：每篇軟上限 20 張；達上限時提示使用者（不硬擋既有編輯，但阻止再新增並顯示提示訊息）。
  - **持久化 key**：以文章 slug 分組，例如 `sticky-notes:<slug>`；單篇所有便利貼存為一個 JSON 陣列（含 id、text、color、x、y）。
  - **自動儲存時機**：新增、編輯失焦、換色、移動放開、刪除後皆即時寫入 localStorage。

- **Edge Cases:**
  - **三連點選字衝突**：觸發區僅限文章兩側空白（無正文文字），落在空白處的三連點阻止原生選字預設行為；落在正文則不攔截、不新增。
  - **localStorage 不可用 / 寫入失敗**（隱私模式、配額已滿）：便利貼於當前 session 仍可操作，但無法持久化；以提示告知無法儲存，不讓頁面崩潰。
  - **視窗縮放 / 旋轉**：以 clamp 規則確保便利貼留在可視區內。
  - **達數量上限**：阻止新增並顯示提示，既有便利貼不受影響。
  - **空白便利貼**：新增後未輸入任何文字即失焦——保留空白便利貼（讀者可稍後補；亦可透過 X 刪除）。
  - **resize 期間拖曳 / 多張重疊**：後新增者顯示在上層（z-index 遞增）。

---

## 5. UI/UX Design & Interaction

- **Prototype Link:** 無（依手繪設計系統實作）。
- **Key Interactions:**
  - **便利貼外觀**：對齊手繪 sketchbook 風格（`src/styles/handdrawn/`、`blog.css` 的 `--hd-*` tokens）——不規則邊角、手繪邊框、offset 陰影。
  - **桌機觸發**：兩側空白區為三連點觸發區；游標進入可給予細微提示（如 cursor 變化）使可發現性提升（nice-to-have）。
  - **窄螢幕入口**：浮動漢堡按鈕沿用既有浮動按鈕樣式（參考 `BackToTop.astro` 的 `hd-icon-circle`），固定於角落；pop-up 面板列出便利貼（內容摘要 + 顏色 + 刪除）。
  - **編輯狀態**：點擊便利貼進入文字編輯（contenteditable 或 textarea）；失焦存檔。
  - **顏色切換**：便利貼上提供 4 色切換控制。
  - **刪除—X 按鈕**：便利貼右上角「X」。
  - **刪除—垃圾桶區**：拖曳便利貼接近視窗頂端時，頂端浮現垃圾桶圖示區；進入該區時給予 hover 視覺回饋，放開即刪。
  - **Empty state（窄螢幕面板）**：尚無便利貼時，面板顯示提示與「新增」入口。
  - **達上限提示**：以文字提示（非 emoji）告知已達 20 張上限。
- **無障礙 / 細節**：浮動按鈕需 `aria-label`；便利貼文字區可鍵盤聚焦編輯；正文與便利貼 UI 文案不使用 emoji（沿用部落格風格規範）。

---

## 6. Non-Functional Requirements

- **Performance:** 純前端、無網路請求；便利貼渲染與互動不可造成明顯卡頓。頁面載入時還原便利貼不應阻塞首屏（於 DOMContentLoaded 後初始化）。
- **Security / Privacy:** 僅存於使用者本機 localStorage，不上傳；不含任何個資處理。
- **Compatibility:** 支援現代瀏覽器（Chrome / Safari / Firefox 近版）桌機與行動裝置；指標裝置（滑鼠拖曳）與觸控裝置（touch 拖曳）皆需可拖曳。
- **Tech Fit:** 以 Astro 元件 + inline `<script>` 實作（沿用 `BackToTop.astro` / `ReadingProgress.astro` 慣例），預期新增 `StickyNotes.astro` 加入 `src/pages/blogs/[...slug].astro`；樣式對齊手繪設計系統 tokens。
- **Analytics / Tracking:** 無需埋點。

---

## 7. Dependencies & Risks

- **External Dependencies:** 無第三方服務；僅瀏覽器 localStorage 與既有設計系統。
- **Known Risks:**
  - 觸控裝置的拖曳與頁面捲動手勢可能衝突，需於拖曳時妥善處理 `touch` 事件與 `preventDefault`。
  - localStorage 在隱私模式或配額滿時可能拋錯，需 try/catch 降級。
  - 「固定於視窗」便利貼在極小螢幕可能遮擋內容；以 clamp 與合理預設尺寸緩解。
  - 三連點觸發區的可發現性偏低（讀者不一定知道此互動）；可日後補上首次提示，本版視為可接受。

---

## 8. Appendix

- 來源需求簡報：`.sdd/2026-06-28-article-sticky-notes/BRIEF.md`
- 相關程式：
  - 文章頁：`src/pages/blogs/[...slug].astro`
  - 元件慣例參考：`src/components/common/BackToTop.astro`、`ReadingProgress.astro`
  - 設計系統：`src/styles/handdrawn/`（`--hd-*` tokens）、`src/styles/blog.css`
- Clarify / PRD 決議：
  - 桌機僅三連點新增（漢堡面板僅窄螢幕）。
  - 位置存絕對 px，超出可視區則 clamp 夾回。
  - 顏色 4 種（黃 / 粉 / 藍 / 綠），預設黃。
  - 每篇軟上限 20 張，達上限提示。
  - 桌機/窄螢幕以 Tailwind `md`（768px）斷點區分。
- 註：本功能未建立 `.sdd/UL-MAP.md`（使用者選擇略過），便利貼相關語彙於本 PRD 內就地定義。
