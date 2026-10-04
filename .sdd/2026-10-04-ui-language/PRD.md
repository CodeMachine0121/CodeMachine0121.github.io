# Product Requirements Document (PRD) — 介面語言統一與預設語言

**Status:** Finalized
**Version:** v1.0
**Owner:** James Hsueh
**Stakeholders:** Engineering（個人專案）

---

## 1. Background & Goal (Why & Goal)

- **Problem Statement:** 改版後的介面文字中英混雜：導覽是英文、區塊標題與按鈕是中文、自我介紹與作品類型只有英文、履歷中文版的返回連結是「Home」。讀者無法得到一致的語言體驗；國際招募方看到中文按鈕，中文讀者看到英文導覽。
- **Expected Outcome:**
  - 任一時刻整站介面文字只有一種語言（名稱與文章內文除外）。
  - 中文地區讀者預設中文介面，其他地區預設英文；可手動切換並被記住。
  - 已上線網址不變，現有功能行為不變。
- **Out of Scope:** 翻譯文章內文與各種名稱；英文版另開網址或分語言收錄；依 IP 判斷地區；中英以外的語言。

---

## 2. User Personas

- **Primary Role(s):**
  - **中文讀者**：瀏覽器為中文，閱讀中文文章。
  - **國際招募方**：瀏覽器為英文，看首頁、作品、履歷。
- **Usage Context:** 桌機與手機；可能從分享連結直接進入任一頁。

---

## 3. User Stories & Acceptance Criteria

### US-01 — 依讀者所在語言區預設介面語言 [priority: P0]
**As a** 讀者, **I want** 第一次來就看到自己熟悉的介面語言, **so that** 不用找設定就能順利瀏覽。

```gherkin
Scenario: 瀏覽器為繁體中文時預設中文
  Given 讀者第一次來，瀏覽器首選語言為繁體中文（台灣）
  When 讀者打開首頁
  Then 介面文字為中文

Scenario: 瀏覽器為簡體中文時預設中文
  Given 讀者第一次來，瀏覽器首選語言為簡體中文
  When 讀者打開首頁
  Then 介面文字為中文

Scenario: 瀏覽器為英文時預設英文
  Given 讀者第一次來，瀏覽器首選語言為美式英文
  When 讀者打開首頁
  Then 介面文字為英文

Scenario: 瀏覽器為其他語言時預設英文
  Given 讀者第一次來，瀏覽器首選語言為日文
  When 讀者打開首頁
  Then 介面文字為英文

Scenario: 只看首選語言
  Given 讀者第一次來，瀏覽器首選語言為英文、第二順位為中文
  When 讀者打開首頁
  Then 介面文字為英文

Scenario: 停用程式執行時為中文
  Given 讀者的瀏覽器停用程式執行
  When 讀者打開首頁
  Then 介面文字為中文
```

### US-02 — 手動切換語言 [priority: P0]
**As a** 讀者, **I want** 自己切換介面語言並被記住, **so that** 預設猜錯時也能用習慣的語言。

```gherkin
Scenario: 切換後記住選擇
  Given 讀者的瀏覽器為中文
  And 讀者在頁首切換為英文
  When 讀者之後再回到網站
  Then 介面文字為英文

Scenario: 瀏覽器不允許記住設定
  Given 讀者的瀏覽器不允許網站記住任何設定，且瀏覽器為中文
  When 讀者在頁首切換為英文
  Then 本次瀏覽的介面立即變為英文
  And 讀者下次回來時介面為中文
```

### US-03 — 整站介面語言一致 [priority: P0]
**As a** 讀者, **I want** 同一時間只看到一種介面語言, **so that** 頁面讀起來一致、專業。

```gherkin
Scenario: 英文介面
  Given 介面為英文
  When 讀者瀏覽首頁、文章列表、系列頁、文章頁與找不到頁面
  Then 導覽顯示 About、Articles、Series
  And 首頁區塊標題顯示 Latest articles
  And 日期顯示如「Oct 4, 2026」，閱讀時間顯示如「7 min read」
  And 頁面上沒有任何中文介面文字
  And 文章標題維持原文

Scenario: 中文介面
  Given 介面為中文
  When 讀者瀏覽首頁、文章列表、系列頁、文章頁與找不到頁面
  Then 導覽顯示 關於我、文章、系列
  And 首頁區塊標題顯示「最新文章」
  And 日期顯示如「2026年10月4日」，閱讀時間顯示如「7 分鐘」
  And 頁面上沒有任何英文介面文字

Scenario: 名稱維持原文、類型依語言顯示
  Given 介面為中文，某作品名稱為英文、類型為 Side Project
  When 讀者看首頁的作品區
  Then 作品名稱維持英文
  And 類型顯示「個人專案」

Scenario: 經歷期間的「至今」依語言顯示
  Given 某段經歷的期間為 2026 年至今
  When 讀者以中文介面看首頁的經歷
  Then 期間顯示「2026 - 至今」

Scenario: 自我介紹依語言顯示
  Given 介面為中文
  When 讀者看首頁的自我介紹
  Then 顯示履歷中文版的自我介紹
```

### US-04 — 履歷與網站語言一致 [priority: P0]
**As a** 招募方, **I want** 從網站進入的履歷就是我正在用的語言, **so that** 不用再切一次。

```gherkin
Scenario: 中文介面前往中文版履歷
  Given 介面為中文
  When 讀者點首頁的「看完整履歷」
  Then 進入中文版履歷

Scenario: 英文介面前往英文版履歷
  Given 介面為英文
  When 讀者點首頁的「View CV」
  Then 進入英文版履歷

Scenario: 不帶語言的履歷網址依預設語言導向
  Given 讀者瀏覽器為英文且未選過語言
  When 讀者打開不帶語言的履歷網址
  Then 進入英文版履歷

Scenario: 中文版履歷的返回連結為中文
  Given 讀者在中文版履歷
  When 讀者看返回首頁的連結
  Then 連結文字為「首頁」

Scenario: 在履歷切換語言也會記住
  Given 讀者在中文版履歷
  When 讀者切換成英文版履歷，再回到首頁
  Then 首頁介面為英文
```

---

## 4. Business Flow & Logic

- **Core Business Rules:**
  - **語言決定順序**：讀者手動選擇 → 瀏覽器首選語言（任何中文為中文，其餘英文）→ 無法判斷時中文。
  - **介面文字**：導覽、頁面與區塊標題、按鈕、提示、空狀態、分頁、麵包屑、無障礙名稱、頁面分頁標題（瀏覽器分頁上的字）都依語言顯示。
  - **不翻譯**：文章標題、文章內文、系列名稱、作品名稱、職稱、公司與學校名稱。
  - **格式**：日期中文為「2026年10月4日」、英文為「Oct 4, 2026」；閱讀時間中文為「N 分鐘」、英文為「N min read」；系列篇數中文為「N 篇文章」、英文為「N articles」。
  - **履歷**：沿用中英兩個網址；網站上的履歷連結指向目前語言的版本；在履歷切換語言視為讀者的語言選擇。
- **Edge Cases:**
  - 讀者從分享連結直接進入任一頁：依上述順序決定語言。
  - 無法記住設定：切換本次有效。
  - 停用程式執行：中文介面，履歷連結指向中文版。

---

## 5. UI/UX Design & Interaction

- 語言切換鈕位於頁首主題切換鈕旁，顯示「切換後的語言」（中文介面顯示 EN，英文介面顯示 中文）。
- 切換即時生效，不重新載入頁面、不閃爍。
- 分享預覽與搜尋引擎摘要維持中文（網站內容的主要語言）。

---

## 6. Non-Functional Requirements

- **Performance:** 首次繪製前就決定語言，不出現先顯示另一種語言再跳換的閃爍。
- **Security:** 語言偏好只存在讀者自己的瀏覽器。
- **Compatibility:** 同改版規格（360px 起可用）。
- **Accessibility:** 頁面的語言標記與目前介面語言一致；語言切換鈕具可讀出的名稱。

---

## 7. Dependencies & Risks

- **External Dependencies:** 留言服務需跟著介面語言切換。
- **Known Risks:** 英文介面下文章內文仍為中文，屬預期。

---

## 8. Appendix

- 需求來源：同資料夾 `BRIEF.md`；延續 `.sdd/2026-10-04-blog-ui-redesign/`。
- 決策紀錄（採業界慣例）：頁面分頁標題跟著語言變動；分享預覽與搜尋摘要維持中文；切換鈕顯示目標語言。
