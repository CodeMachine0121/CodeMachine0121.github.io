---
title: "Day 08：ReAct Pattern：推理與行動交錯的決策循環"
datetime: "2026-06-30"
description: "進入第二階段「決策、推理與結構化模式」，我們從最核心的 ReAct (Reasoning + Acting) 模式開始。探討如何讓 Agent 在『推理』與『行動』之間交錯循環，用真實的觀察結果校正思路，避免純推理導致的幻覺與脫軌。"
image: ""
parent: "AI Agent Workflow Patterns：從架構設計到自動化開發協議的 30 天實戰"
---

進入第二階段「決策、推理與結構化模式」，我們從最核心、也是讓 Agent 之所以成為 Agent 的模式——**ReAct (Reasoning + Acting)** 開始。在第一階段（Day 01–07），我們把 `.claude/` 的規則、技能、指令與知識庫鋪好，並整合成可一鍵初始化的樣板；今天起進入第二階段，要為 Agent 裝上真正的「思考骨架」。

純推理（如 Chain-of-Thought）有一個致命弱點：它**只在模型腦中跑，從不接觸外部世界**。當推理脫離真實狀態時，模型會自信地產生幻覺。ReAct 的設計哲學就是對治這件事：**讓「推理 (Reasoning)」與「行動 (Acting)」交錯進行，用每一次行動的真實「觀察 (Observation)」來校正下一步推理。**

## 1. 為什麼需要 ReAct？
想像你要 Agent「找出專案中所有沒被測試覆蓋的 public function」。

*   **純 CoT 的做法：** 模型在腦中「想像」專案結構，一口氣推理出一份清單——但它從沒真的讀過檔案，結果往往是憑訓練記憶捏造的。
*   **ReAct 的做法：** 模型先 `grep` 找出所有 public function（行動），看到真實結果（觀察），再推理「哪些有對應測試」，接著去讀測試檔（行動）⋯⋯ 每一步推理都**踩在真實證據上**。

差別不在「聰不聰明」，而在**有沒有跟環境形成回饋迴路**。

## 2. ReAct 的核心循環：Thought → Action → Observation
ReAct 把 Agent 的認知拆成一個不斷重複的三段式循環：

```text
┌─────────────────────────────────────────┐
│  Thought      現在該做什麼？為什麼？        │
│     ↓                                     │
│  Action       呼叫一個工具（或宣告 Finish）  │
│     ↓                                     │
│  Observation  記錄工具回傳的「真實結果」      │
│     ↓                                     │
│  （回到 Thought，直到證據足以收斂）           │
└─────────────────────────────────────────┘
```

關鍵在於 **Thought 必須引用上一個 Observation 的事實**——這條紀律強迫模型「看著真實結果說話」，而不是自由發揮。

## 3. .claude/ 中的協議實作
我們把 ReAct 的循環紀律「編譯」進規則檔，確保 Agent 不會跳過觀察、直接臆測到底。

### .claude/rules/react-protocol.md
```markdown
# ReAct 執行協議

## 1. 循環格式
每一步必須嚴格輸出三段，缺一不可：
- **Thought**: 說明現在該做什麼、為什麼。
- **Action**: 呼叫一個工具（如 `grep`、`read_file`、`run_test`），或宣告 `Finish`。
- **Observation**: 記錄工具回傳的真實結果。

## 2. 紀律要求
- 禁止在沒有 Observation 的情況下，連續臆測超過一步。
- 每個 Thought 必須引用上一個 Observation 的事實，不得脫離真實結果自由發揮。
- 設定步數上限：若連續 3 次 Observation 都未推進目標，必須停止並回報，禁止無限迴圈。
- 只有當證據足以支撐結論時，才允許輸出 `Action: Finish`。
```

## 4. 一段真實的 ReAct Trace
以「找出未被測試覆蓋的 public function」為例，Agent 的執行軌跡會長這樣：

```text
Thought: 我需要先列出所有 public function，再比對是否有對應測試。
Action: grep -rn "export function" src/
Observation: 找到 12 個 public function，分布在 5 個檔案。

Thought: 接著確認哪些被測試引用。先掃 test 目錄。
Action: grep -rn "import" tests/
Observation: tests/ 只引用了其中 9 個函式。

Thought: 剩下 3 個（formatDate, parseConfig, retryQueue）沒有任何測試引用。
       證據已足夠，可以收斂。
Action: Finish → 回報這 3 個未覆蓋的函式
```

注意每個 `Thought` 都緊扣前一個 `Observation`——這就是 ReAct 抗幻覺的核心機制。

## 5. 深度分析：ReAct vs CoT vs ToT
*   **CoT (Chain-of-Thought)：** 線性推理鏈，**純內在思考、不與環境互動**。適合封閉式問題（數學、邏輯推導）。
*   **ToT (Tree-of-Thought)：** 樹狀展開多條推理路徑再評估、回溯。適合**搜索空間大、需要試錯**的問題。
*   **ReAct：** 推理與行動交錯，**引入外部觀察**。適合需要與檔案系統、API、工具互動的 Agent 任務——也就是軟體工程的日常。

三者並非互斥：成熟的 Agent 常在 ReAct 的 `Thought` 階段內嵌 CoT 來深化單步推理。

## 6. Critical Thinking：ReAct 的代價
ReAct 不是免費的，它的成本來自那個「循環」本身：

*   **延遲與 Token 成本：** 每個 Thought-Action-Observation 都是一次往返，多步任務的 Token 消耗遠高於一次性 CoT。
*   **不收斂風險：** Agent 可能陷入「反覆嘗試同一個失敗動作」的迴圈。**這正是 #3 規則中「步數上限」存在的理由**——沒有停止條件的 ReAct 是危險的。
*   **Observation 品質決定一切：** 若工具回傳大量雜訊（如未過濾的 log），會污染後續所有推理。Garbage in, garbage out。
*   **架構決策：** 簡單的封閉式任務（純計算、格式轉換）用 ReAct 是殺雞用牛刀，直接 CoT 即可。**判斷「任務是否需要與環境互動」，是決定要不要啟動 ReAct 的關鍵。**

---

## 今日實踐任務：

1. 在 `.claude/rules/` 建立 `react-protocol.md`，定義 Thought / Action / Observation 的格式與停止條件。

2. **Side Project：陌生專案上手助手 (`onboarding-scout`)**

   找一個你**沒看過**的小型開源 repo，用 Claude Code 搭配你剛寫的 `react-protocol`，讓它透過 ReAct 循環自己摸索，最後產出一份「新人上手指南」：** 使用框架 / 安裝步驟 / 啟動指令 / 如何跑測試**。

   *為什麼這題適合練 ReAct：* 它無法一步到位——每一步的下個動作都取決於上一步的觀察（看到 `package.json` 才知道有沒有 `test` script；看到 `Cargo.toml` 就走另一條路），正好逼出 Thought → Action → Observation 迴圈，而且有明確的收斂點（四項資訊湊齊就 `Finish`）。

### 建議里程碑：
   - 動作先限定在**唯讀探索**（`ls`、`grep`、讀檔，最多跑一次 `install` / `test`），先不改任何檔案。
   - 要求 Agent 嚴格按 `react-protocol` 輸出每一步，禁止跳過 Observation 直接臆測。
   - 收斂條件：四項資訊到齊即輸出 Markdown 指南並 `Finish`。

### 驗收標準（對照本篇重點)：
   - [ ] 每個 Thought 都引用上一個 Observation 的事實，沒有憑空臆測。
   - [ ] 至少出現一次「觀察推翻了原本假設、進而改變下一步動作」。
   - [ ] 有命中停止條件，沒有陷入無限迴圈。

*明天 Day 09，我們會看推理模式的另一條路——CoT (Chain-of-Thought)：當任務不需要與環境互動、而是純粹的邏輯推導時，如何用「強制顯式推理」讓 Agent 把思路攤開、減少跳步出錯。*
