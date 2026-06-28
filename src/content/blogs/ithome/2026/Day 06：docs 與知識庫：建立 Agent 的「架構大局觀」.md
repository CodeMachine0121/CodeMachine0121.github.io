---
title: "Day 06：docs/ 與知識庫：建立 Agent 的「架構大局觀」"
datetime: "2026-06-28"
description: "探討如何利用 `.claude/docs/` 構建結構化的知識庫，解決 Agent 在處理大型專案時喪失全域觀點的問題，並實現『文檔驅動開發』的自動化邏輯。"
image: ""
parent: "AI Agent Workflow Patterns：從架構設計到自動化開發協議的 30 天實戰"
---

在 Day 05，我們把複雜的 Workflow 封裝成 `commands/` 的「指令介面」。但指令只是入口；隨著專案規模擴大，Agent 會碰到一個更根本的瓶頸：**「見木不見林」**。當它深入分析某個模組的邏輯時，往往會忘記整體架構的設計原則或商業邏輯，導致產出的代碼雖然能跑，卻違反了專案的長期維護規範。

在 `.claude/` 目錄中，`docs/` 不僅是給人類看的說明書，它更可以扮演 **Agent 的「架構知識庫 (Architectural Knowledge Base)」**。

> 先釐清一個關鍵前提：`.claude/docs/` **不是** Claude Code 內建會自動讀取或檢索的特殊目錄（這點和 Day 05 會被自動掃描的 `commands/` 不同）。它能發揮作用，完全來自我們在 `commands/` 或 `rules/` 中用 `@` 主動掛載、或在前置檢查中引導 Agent 去讀取。本篇所談的「知識庫」，是一套**自訂的協議設計模式**，而非開箱即用的功能。

## 1. 知識庫的架構角色：為什麼 AI 需要 Docs？
LLM 的上下文視窗 (Context Window) 雖然在擴大，但長上下文中段的資訊容易被忽略（即所謂的 "lost in the middle"），塞得越多不代表 Agent 越能精準引用。當我們將架構規範、設計模式、API 約定定義在 `.claude/docs/` 中、再按需掛載時，我們實際上是在為 Agent 構建一個 **「外掛式長期記憶 (External Long-term Memory)」**。

**那它跟 `CLAUDE.md` 有什麼不同？** Claude Code 真正內建、每次都會自動載入的記憶機制其實是 `CLAUDE.md`。但 `CLAUDE.md` 一膨脹就會佔滿上下文、稀釋重點。比較務實的分工是：`CLAUDE.md` 只放「最精簡的全局原則 + 指向 docs 的索引」，把細節拆進 `.claude/docs/`，再透過 `@` 在需要時掛載。這樣主記憶保持精簡，又能在深入特定任務時補上完整脈絡。

*   **定義邊界：** 哪些模組是底層設施？哪些是商業邏輯？
*   **約束行為：** 確保 Agent 產出的代碼符合專案的 API 設計風格。
*   **減少錯誤：** 當 Agent 準備修改核心功能前，引導其先閱讀相關架構文件，避免觸發連鎖毀滅。

## 2. 目錄規範：結構化你的架構知識
為了讓 Agent 在被掛載時能快速定位、也方便人類維護，我們不建議直接丟入雜亂的 Markdown。建議結構如下：

```text
.claude/docs/
├── architecture/         # 系統拓撲與核心設計決策 (ADR, Architecture Decision Record)
├── api/                  # API 合約與數據 Schema 定義
├── standards/            # Coding Standards 與風格指南
└── context.md            # [核心] Agent 必讀的全局情境總覽
```

## 3. 深層設計：context.md —— Agent 的「入職培訓」
這份檔案是 `.claude/docs/` 的靈魂。我們在 Command 或 Rule 中，引導 Agent 於每次執行任何 Workflow Pattern 前優先讀取此檔案。（再次提醒：這是 Prompt 層的引導而非執行期保證，Agent 仍可能略過，因此關鍵約束務必同時寫進 `CLAUDE.md`。）

**實作範例：`.claude/docs/context.md`**
```markdown
# 專案架構概覽
- 核心技術棧: Node.js (TypeScript), PostgreSQL
- 架構模式: 領域驅動設計 (DDD)
- 絕對禁止: 
    - 不得使用 `any` 型別。
    - 所有 DB 操作必須經由 `Repository` 層。
- 優先查詢: 在修改 API 前，請先檢查 `.claude/docs/api/endpoints.md`。
```

## 4. Workflow 整合：如何讓 Rule 調用 Docs？
知識庫光是存在沒有意義，必須整合進之前的 `rules/`、由規則主動把它掛載進上下文。這正是 #1 提到「`docs/` 不會被自動讀取」的具體解法——我們用一段前置檢查，引導 Agent 在動手前先讀取對應文件：

```markdown
# [任何 Pattern] 的前置規範

## [PRE-FLIGHT CHECK]
- 在執行邏輯前，Agent 必須執行以下操作：
    1. 讀取 `.claude/docs/context.md` 以確認全域規範。
    2. 若涉及 API 修改，必須讀取 `.claude/docs/api/endpoints.md`。
    3. 若涉及架構決策，檢查 `.claude/docs/architecture/adr-list.md`。
- 如果目前的任務與文檔描述有衝突，Agent 必須先詢問人類意見，禁止單方面推翻架構原則。
```

## 5. Critical Thinking: 知識庫的「過期風險」 (Staleness)
這是知識庫最大的痛點：**代碼變了，文檔沒更新，AI 根據舊文檔寫出錯誤代碼。**

*   **架構解法：**
    *   **Doc-as-Code：** 規則檔應要求 Agent 在執行最後階段，檢查是否有文檔需要根據本次修改進行更新。
    *   **CI/CD 驗證：** 若可以，在 CI 流程中加入「文檔檢查」，若代碼與文檔描述不符，觸發提醒。
    *   **最小化原則：** 不要在 `docs/` 存放重複的邏輯說明（那屬於註解），只存放「全局決策」與「邊界規範」。

---

**今日實踐任務：**
1. 在 `.claude/docs/` 下建立 `context.md`，總結你目前專案最核心的三個設計原則（例如：錯誤處理方式、命名規範、模組邊界）。
2. 在你的 `.claude/rules/base-protocol.md` (或類似的基礎規則) 中，增加一個「前置讀取 (Pre-flight Reading)」步驟，強制要求 Agent 在進入任何模式前閱讀 `context.md`。

*明天 Day 07，我們將完成整個「基礎架構系列」的最後一塊拼圖：把這六天打造的 `rules/`、`skills/`、`commands/`、`docs/` 整合成一個完整的 `.claude/` 專案樣板，並寫一支「一鍵初始化」腳本，為環境建構階段正式收尾。*