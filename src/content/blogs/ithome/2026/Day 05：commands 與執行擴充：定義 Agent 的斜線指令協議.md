---
title: "Day 05：commands/ 與執行擴充：定義 Agent 的斜線指令協議"
datetime: "2026-06-27"
description: "探討 `.claude/commands/` 的實作機制，將複雜的 Workflow Pattern 封裝為可呼叫的 CLI 指令，降低 AI 協作的認知負載。"
image: ""
parent: "AI Agent Workflow Patterns：從架構設計到自動化開發協議的 30 天實戰"
---

在 Day 03 與 Day 04 中，我們建立了 Agent 的「大腦邏輯 (`rules/`)」與「執行手腳 (`skills/`)」。然而，如果每次要啟動一個複雜的 Pattern，都需要對 AI 進行冗長的說明（例如：「請依照 TDD 流程執行，先跑測試，再診斷，再 Patch...」），不僅降低效率，還容易因描述誤差導致 Agent 偏離流程。

這就是 **`.claude/commands/`** 存在的意義：**將複雜的 Workflow 封裝成可預測的「指令介面 (Interface)」。**

### 1. 什麼是 Command 協議？
在 Claude Code 的架構中，Command 是 Agent 的「快捷鍵」。它不是隨機的聊天指令，而是預定義好的 **「任務入口點 (Task Entry Point)」**。透過 `commands/`，我們將複雜的規則集與技能鏈，對應到一個簡單的 `/指令`。

### 2. 目錄結構與定義規範
Claude Code 會自動掃描 `.claude/commands/` 目錄下的 Markdown 定義檔。**指令名稱直接來自「檔名」**（`tdd.md` 對應 `/tdd`），檔案結構則是「頂部 YAML frontmatter + 下方 Prompt 內文」。

這裡有一個關鍵觀念要先釐清：**Command 的內文本質上是一段「可重用的 Prompt 範本」，而不是會被執行的程式。** 當你輸入 `/tdd`，Claude Code 會把這段文字展開後餵給 Agent，由 Agent 理解並行動；它不會像 runtime 一樣去「跑」一支腳本。

frontmatter 實際支援的欄位包括 `description`、`argument-hint`、`allowed-tools`、`model` 等；內文則可透過 `@檔案路徑` 引用檔案、`!指令` 執行 bash、`$ARGUMENTS` 帶入參數。

**範例：定義一個 `/tdd` 指令 (`.claude/commands/tdd.md`)**
```markdown
---
description: "啟動 TDD 工作流：自動執行測試、診斷錯誤並生成修復方案"
argument-hint: "[測試檔案路徑]"
allowed-tools: Bash(bun test:*), Read, Edit
---

請依照 TDD 協議執行以下流程：
1. 載入 @.claude/rules/tdd-protocol.md 中定義的規則集
2. 執行測試並診斷失敗原因
3. 若測試失敗，將診斷結果作為上下文，提出並套用修復方案
```

### 3. 使用方式：從「對話」轉向「指令導向」
這是架構設計的關鍵轉變：
*   **傳統開發 (Chat-driven)：** 開發者輸入：「幫我檢查程式有沒有錯，如果有錯幫我修好。」（AI 此時會進入隨機試錯模式）
*   **協議開發 (Command-driven)：** 開發者輸入：`/tdd`。
    *   **Agent 的行為：** Claude Code 直接將上下文鎖定在 `tdd-protocol.md` 的規則集，並嚴格遵循定義好的執行節點，不再進行無意義的聊天。

### 4. 深度設計：指令的「邊界守護」
Command 不僅僅是觸發器，更可以扮演 **「環境初始化工具」** 的角色。

> ⚠️ 注意：以下三個機制（狀態驗證、上下文掛載、環境預設）是**本系列自訂的協議設計模式**，並非 Claude Code 內建會自動執行的行為。它們都是透過 Command 內文的 Prompt 指示，引導 Agent 主動去完成的。

一個嚴謹的 Command 可以在內文中編排出如下流程：

1.  **狀態驗證 (State Validation)：** 在內文中指示 Agent 先讀取自訂的狀態檔（例如 `@.claude/state/agent_state.json`）。若上次任務未完成，要求 Agent 先恢復狀態，避免重複作業。
2.  **上下文掛載 (Context Mounting)：** 透過 `@` 語法主動引用相關的技術規範文件（例如存放在 `.claude/docs/` 下的文件），確保 Agent 了解當前的業務背景。
3.  **環境預設 (Environment Preset)：** 在 frontmatter 以 `allowed-tools`、`model` 等欄位收斂 Agent 的能力範圍，或在內文明確要求 Agent 提高輸出嚴謹度。

### 5. Critical Thinking: 抽象層的維護成本
將所有邏輯都寫在 Command 定義中會產生一個問題：**「抽象過度 (Over-abstraction)」**。
*   **風險：** 當 Pattern 複雜到需要透過 5 個指令串聯時，開發者會混淆指令的職責。
*   **解法：** 遵循 **「One Command, One Pattern」** 原則。一個 Command 對應一個完整的 Pattern 實例。如果該 Pattern 太複雜，請將其拆解為子指令（例如 `/tdd` 啟動主流程，`/tdd-fix` 執行修復細節），並明確寫在 `commands/README.md` 中。

---

**今日實踐任務：**
1.  在 `.claude/commands/` 下建立你的第一個指令檔案（例如 `/tdd` 或 `/debug`）。
2.  在檔案中定義該指令對應的 `rules/` 與 `skills/` 的連結。
3.  打開 Claude Code，嘗試使用你定義的指令。觀察 Agent 是否會根據指令名稱，直接讀取對應的 `rules` 並進入預期工作狀態。

*明天 Day 06，我們將深入剖析 `docs/` 資料夾，探討如何建立一套讓 Agent 能快速索引的「架構知識庫」，徹底解決 AI 在大型專案中「喪失大局觀」的痛點。*