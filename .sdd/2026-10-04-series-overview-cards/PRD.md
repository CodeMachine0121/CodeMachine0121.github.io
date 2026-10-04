# Product Requirements Document (PRD) — 系列總覽封面卡片格

**Status:** Finalized
**Version:** v1.0
**Owner:** James Hsueh
**Stakeholders:** Engineering（個人專案）

---

## 1. Background & Goal (Why & Goal)

- **Problem Statement:** 系列總覽目前是純文字的條列，系列之間缺乏視覺辨識；讀者也看不出每個系列多久沒更新。作者沒有地方為系列指定代表圖片，多數系列的文章也沒有封面。
- **Expected Outcome:** 系列總覽改為封面卡片格，每張卡片可一眼看出系列、篇數與最後更新日期；作者用一個設定檔即可為系列指定封面；排序維持依最後一篇文章的日期。
- **Out of Scope:** 單一系列頁、首頁與文章列表上的系列入口樣式；系列文字介紹；圖片上傳與託管。

---

## 2. User Personas

- **Primary Role(s):** 讀者（瀏覽有哪些系列）；作者（維護系列封面）。
- **Usage Context:** 桌機與手機；作者以編輯設定檔、推上主線的方式更新封面。

---

## 3. User Stories & Acceptance Criteria

### US-01 — 以封面卡片瀏覽系列 [priority: P0]
**As a** 讀者, **I want** 以封面卡片瀏覽所有系列並看到篇數與最後更新日期, **so that** 我能快速挑出想讀、而且還在更新的系列。

```gherkin
Scenario: 依最後一篇文章的日期排序
  Given 系列 A 最後一篇發布於 2026-10-14
  And 系列 B 最後一篇發布於 2026-10-05
  When 讀者打開系列總覽
  Then 系列 A 的卡片排在系列 B 之前

Scenario: 只看最後一篇，不看開始日期
  Given 系列 C 較早開始、最後一篇發布於 2026-04-13
  And 系列 D 較晚開始、最後一篇發布於 2026-02-17
  When 讀者打開系列總覽
  Then 系列 C 的卡片排在系列 D 之前

Scenario: 中文介面的卡片資訊
  Given 某系列共 31 篇，最後一篇發布於 2026-10-14
  When 讀者以中文介面看該系列的卡片
  Then 卡片顯示「31 篇文章 · 更新於 2026年10月14日」

Scenario: 英文介面的卡片資訊
  Given 某系列共 31 篇，最後一篇發布於 2026-10-14
  When 讀者以英文介面看該系列的卡片
  Then 卡片顯示「31 articles · Updated Oct 14, 2026」

Scenario: 點卡片進入系列頁
  Given 讀者在系列總覽
  When 讀者點某系列的卡片
  Then 進入該系列的系列頁

Scenario: 寬螢幕兩欄、手機一欄
  Given 系列總覽有多個系列
  When 讀者分別以寬螢幕與手機打開系列總覽
  Then 寬螢幕上卡片排成兩欄，手機上排成一欄
```

### US-02 — 作者指定系列封面 [priority: P0]
**As a** 作者, **I want** 在一個設定檔裡為每個系列指定封面圖片網址, **so that** 系列有代表性的封面，不受文章有沒有封面影響。

```gherkin
Scenario: 使用設定檔指定的封面
  Given 設定檔為系列 A 指定了一張封面圖片
  When 讀者看系列 A 的卡片
  Then 卡片顯示設定檔指定的圖片

Scenario: 未指定時用最新一篇文章的封面
  Given 設定檔未指定系列 B 的封面
  And 系列 B 最新一篇文章有封面
  When 讀者看系列 B 的卡片
  Then 卡片顯示系列 B 最新一篇文章的封面

Scenario: 最新一篇沒有封面時往前找
  Given 設定檔未指定系列 C 的封面
  And 系列 C 最新一篇沒有封面，較早的一篇有
  When 讀者看系列 C 的卡片
  Then 卡片顯示系列 C 中最新一篇有封面的文章的封面

Scenario: 都沒有封面時顯示預設封面
  Given 設定檔未指定系列 D 的封面
  And 系列 D 所有文章都沒有封面
  When 讀者看系列 D 的卡片
  Then 卡片顯示預設的佔位封面

Scenario: 設定檔中的系列名稱打錯會被擋下
  Given 設定檔中有一個名稱對不到網站上任何系列
  When 建置網站
  Then 建置檢查失敗，並指出那個對不到的名稱
```

---

## 4. Business Flow & Logic

- **Core Business Rules:**
  - **排序**：依系列最後一篇文章的發布日期，新的在前（沿用現有規則）。
  - **最後更新日期**：系列中發布日期最新的那一篇文章的日期。
  - **封面決定順序**：設定檔指定 → 系列中最新一篇有封面的文章 → 預設佔位封面。
  - **設定檔**：以系列名稱（與文章設定的系列名稱完全相同）對應封面網址；網站上的每個系列都列在檔案中，未指定者為空值。
- **Edge Cases:** 封面圖片載入失敗時，卡片版面不變形（封面區固定比例）。

---

## 5. UI/UX Design & Interaction

- 參考：[Uxcel 課程目錄](https://mobbin.com/screens/505763a3-f117-46e9-b002-8154facaf6eb)、[Codecademy 課程卡片](https://mobbin.com/screens/f44a17bb-8915-42ad-b46a-3f6234035d3b)。
- 卡片：上方 16:9 封面、下方系列名稱（最多兩行）、篇數與最後更新日期；滑過時邊框變為強調色。
- 預設佔位封面：使用網站的強調色淡底，中央顯示系列標記，深淺色主題皆可讀。
- 版面：寬螢幕兩欄、手機一欄；沿用網站設計 token。

---

## 6. Non-Functional Requirements

- **Performance:** 首屏以外的封面延遲載入；封面區固定比例，避免版面跳動。
- **Compatibility:** 360px 起無橫向捲動。
- **Accessibility:** 封面為裝飾性圖片（系列名稱已是文字），不重複朗讀。

---

## 7. Dependencies & Risks

- **External Dependencies:** 外部圖片儲存（封面網址）。
- **Known Risks:** 封面網址失效時顯示破圖；以固定比例的封面區降低影響。

---

## 8. Appendix

- 需求來源：同資料夾 `BRIEF.md`。
- 決策紀錄：設定檔以系列名稱為鍵（作者在文章中寫的就是名稱）；預設佔位封面採淡強調色底＋系列圖示。
