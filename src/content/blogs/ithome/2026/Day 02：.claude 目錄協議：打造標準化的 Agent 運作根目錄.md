---
title: "Day 02：.claude/ 目錄協議：打造標準化的 Agent 運作根目錄"
datetime: "2026-06-24"
description: "深入解析 .claude/ 目錄的內部結構與設計哲學，並確立 Agentic Runtime 的標準目錄配置，作為後續 30 天所有 Workflow Pattern 的執行地基。"
image: ""
parent: "AI Agent Workflow Patterns：從架構設計到自動化開發協議的 30 天實戰"
---

在軟體工程中，我們有 `src/` 放原始碼，`tests/` 放測試，`docs/` 放文件。這是一種「共識」。同樣地，在 Agentic Workflow 中，我們需要建立一個專屬於 AI Agent 的「系統目錄」，即 **`.claude/`**。

這不僅僅是一個資料夾，它是 **Agentic Runtime Environment (代理執行環境)** 的控制中心。若沒有標準化的目錄結構，Agent 的行為將隨著每個專案的 Prompt 設定不同而產生不可預測的偏差。

### 1. `.claude/` 的設計哲學：系統與行為分離
我們將 `.claude/` 的設計核心建立在**「配置即協議 (Configuration as Protocol)」**之上。一個標準化的目錄結構應包含以下三個核心子系統：

```text
.claude/
├── rules/            # 【行為約束】存放 Workflow 的 Pattern 定義與行為守則
├── skills/           # 【執行能力】存放原子化的 CLI 工具腳本 (Node.js/Python)
├── commands/         # 【互動介面】定義 Agent 可觸發的斜線指令
└── docs/             # 【上下文基準】提供 Agent 參考的技術協議文件
```

### 2. 核心目錄結構深度剖析

#### A. rules/ (Behavioral Constraints)
這裡存放的是讓 Agent「遵守紀律」的 Markdown 檔案。
*   **作用：** 強制 AI 遵守特定的決策邏輯。例如 `react-protocol.md` 會規定 Agent 在解決問題時，必須交錯「推理」與「行動」，每一步都踩在真實觀察上。
*   **深度設計：** 將每個 Workflow Pattern 定義為一個規則檔，Claude Code 在啟動時會讀取這些規則，自動「載入」該模式的思考方式。

#### B. skills/ (Functional Capabilities)
這是 Agent 的「手腳」，存放與專案業務邏輯相關的原子化腳本。
*   **作用：** 將複雜的 Shell 命令封裝成具備 JSON 輸出格式的工具。
*   **深度設計：** 這是實現「系統與邏輯解耦」的關鍵。Agent 不需要知道 `git rebase` 的複雜選項，它只需要呼叫 `.claude/skills/git-safe-rebase.sh`。

#### C. commands/ (Interaction Interface)
定義 Agent 的快捷指令。
*   **作用：** 透過將複雜的 Pattern 呼叫簡化為 `/pattern-name`，降低開發者的認知負載。
*   **深度設計：** 這將原本需要數百字的 Prompt 指令，縮減為一個 CLI 指令，確保 Agent 每次執行的輸入參數都是標準化的。

#### D. docs/ (Contextual Base)
這是 Agent 的「長期記憶」與「架構知識庫」。
*   **作用：** 當專案變大，Agent 無法記住所有細節時，它會在此目錄查詢技術規範（如 API 設計風格、資料庫架構）。
*   **深度設計：** 這是實現 **「文檔驅動開發 (Docs-Driven Development)」** 的核心。

### 3. 為何目錄結構化能提升穩定性？
當目錄結構固定後，我們便能達成 **「路徑確定性 (Path Determinism)」**：
*   **標準化部署：** 任何開發者克隆這個 Repo，Agent 的行為模式都是完全一致的，因為 `.claude/` 內的規則是 Git 可追溯的。
*   **減少雜訊：** Agent 不需要遍歷整個專案目錄去猜測哪些檔案是工具，哪些是設定，明確的目錄結構能讓 Claude Code 的搜尋路徑極度精準。

### 4. Critical Thinking: 目錄污染與權限控制
將 `.claude/` 視為系統目錄後，我們必須面對一個風險：**權限濫用**。
*   **風險：** 如果 `rules/` 被惡意修改，Agent 的行為邏輯會被植入後門。
*   **防護：** 我們必須將 `.claude/` 目錄納入 Git 的 **CODEOWNERS** 機制，嚴格限制變更權限。此外，Claude Code 的執行環境應設定為僅允許執行位於 `.claude/skills/` 下的腳本，封鎖未授權的 Shell 執行權限。

---

**今日實踐任務：**
請在你的專案中建立 `.claude/` 資料夾，並依照上述結構建立 `rules/`, `skills/`, `commands/`, `docs/` 四個子目錄。這將是你未來 28 天實作 Pattern 的統一底座。

*明天 Day 03，我們將針對 `rules/` 目錄進行「手術級」的深度剖析，探討如何撰寫讓 AI 嚴格遵守邏輯轉場的 Markdown 行為準則。*
