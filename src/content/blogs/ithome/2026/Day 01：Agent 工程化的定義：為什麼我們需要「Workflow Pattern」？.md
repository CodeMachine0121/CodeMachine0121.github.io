---
title: "Day 01：Agent 工程化的定義：為什麼我們需要 Workflow Pattern？"
datetime: "2026-06-23"
description: "探討 AI Agent 開發從『提示詞工程』轉向『系統架構設計』的必要性，確立本系列 30 天的實作路線圖，並導入 Claude Code 作為我們的核心執行協議。"
image: ""
parent: "AI Agent Workflow Patterns：從架構設計到自動化開發協議的 30 天實戰"
---

在過去兩年，AI 應用的開發往往聚焦於「Prompt Engineering」。我們花費大量時間調整 System Prompt，試圖讓模型在單次呼叫中輸出完美的結果。然而，當我們試圖解決複雜、長週期的軟體工程任務（如重構一個模組、自動化 CI/CD、複雜數據處理）時，這種「單次 Prompt」的方法很快就會達到極限——我們稱之為 **「複雜度崩潰 (Complexity Collapse)」**。

### 1. 為什麼需要 Pattern？
單純依賴 LLM 的「湧現能力」就像是在賭博，缺乏工程上的可預測性。我們需要將 AI 從「一個全知全能的代理」轉變為「一個遵循協議的協作者」。
*   **分而治之：** 透過模式化，將大任務拆解，確保每個環節的可控性。
*   **可觀測性：** 透過模式，開發者能明確知道 Agent 正處於流程中的哪一個環節。
*   **工程化擴充：** 透過模式，你可以輕鬆抽換 Skill 或優化流程，而無需重寫整套系統。

### 2. 本系列的核心執行協議：Claude Code
在接下來的 30 天中，我們將統一使用 **Claude Code** 作為主要的 Agent 執行引擎。為什麼選擇它？
*   **CLI 原生性：** 它直接運作在終端機中，能夠直接存取檔案系統、執行指令、並與 Git 互動。
*   **環境感知：** 不同於網頁版 Chatbot，Claude Code 具備完整的專案上下文感知。
*   **協議導向：** 我們會將 30 種 Pattern 封裝為可由 Claude Code 讀取的「工作流協議」。讀者可以透過指令直接讓 Claude Code 載入特定 Pattern 並執行對應的 Skill Collection。

### 3. 30 天實作路線圖
我們的旅程將分為五個階段，逐步建構你的 Agentic 架構庫：

*   **階段一 (Day 01-05)：基礎協議與環境建立** (定義 Pattern、設定 Claude Code、封裝 Skill)。
*   **階段二 (Day 06-12)：決策與推理模式** (包含 GSI Protocol、ToT、CoT 等)。
*   **階段三 (Day 13-18)：協作與對抗博弈** (Supervisor、Debate、Swarm 等)。
*   **階段四 (Day 19-24)：執行韌性與工程可靠性** (Fallback、State-Management、HITL 等)。
*   **階段五 (Day 25-30)：進階實戰與生態系統** (TDD、成本優化、建立你的 Pattern 語言)。

### 4. 設計哲學：Pattern + Skill + Engine
我們的核心價值在於建立一套「工程化協議」：
1.  **Pattern (設計模式)：** 定義解決問題的邏輯與流程。
2.  **Skill Collection (技能集合)：** 封裝成 Node.js 或 Python 的原子化腳本，供 Agent 調用。
3.  **Claude Code (執行引擎)：** 負責解析 Pattern 並調用這些 Skill。

### 5. 今日思考 (Critical Thinking)
在開始進入後續的模式實作前，請思考：如果你的 AI Agent 是一個團隊成員，它現在最缺乏的不是「智商」，而是「流程的紀律」。

我們這 30 天要做的，就是為 AI 建立這份「紀律」。準備好將你的開發流程轉化為可執行、可驗證的協議了嗎？

---
*明天 Day 02，我們將深入探討如何配置你的本地開發環境，讓 Claude Code 成為你最可靠的 Agent 執行引擎。*
