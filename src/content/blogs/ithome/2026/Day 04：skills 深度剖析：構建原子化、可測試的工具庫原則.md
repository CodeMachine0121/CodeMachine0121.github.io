---
title: "Day 04：skills/ 深度剖析：構建原子化、可測試的工具庫原則"
datetime: "2026-06-26"
description: "探討 .claude/skills/ 的設計原則：如何把不確定的 Shell 操作封裝成原子化、可測試、輸出結構化的「工具」，讓 Agent 的手腳既可靠又可被驗證，真正實現系統與邏輯的解耦。"
image: ""
parent: "AI Agent Workflow Patterns：從架構設計到自動化開發協議的 30 天實戰"
---

昨天我們剖析了 `rules/`——Agent 的「大腦邏輯」，它約束 Agent **怎麼想**。但光有紀律不夠，Agent 還需要可靠的「手腳」去**動手做**。今天，我們從「行為約束」走向「執行能力」，深入剖析 `.claude/skills/`。

> ⚠️ 先釐清：本系列所談的 `skills/`，指的是一套**自訂的協議設計模式**——存放在 `.claude/skills/` 下、由 Agent 透過 Bash 呼叫的**原子化 CLI 工具腳本**。重點在於工程紀律（原子化、可測試、結構化輸出），而非任何開箱即用的功能。

### 1. 為什麼要建工具庫，而不是讓 Agent 自由打指令？
最危險的 Agent，是一個能隨意生成並執行任意 Shell 命令的 Agent。

LLM 直接吐 shell 是**不可預測**的：它可能記錯 `git` 的選項、在 macOS 與 Linux 間踩到 `sed` 的差異、甚至在「想清理一下」的善意下打出 `rm -rf`。`skills/` 的核心價值，就是把這些**高風險或高複雜度的操作，預先封裝成寫好、測過的腳本**。

*   `rules/` 定義 Agent **怎麼想**（決策邏輯）。
*   `skills/` 提供 Agent **怎麼做**（可靠動作）。

Agent 不需要重新發明 `git rebase` 的複雜流程，它只需要呼叫 `.claude/skills/git-safe-rebase.sh`。我們把「不確定性」鎖進一個個經過驗證的盒子裡。

### 2. 好工具的三個原則：原子化、確定性、結構化輸出

#### A. 原子化 (Atomicity)
一支腳本只做一件可獨立描述的事。不要寫一支「跑測試順便部署順便發通知」的萬能腳本——那會讓它無法被獨立驗證，也無法被重用。

#### B. 確定性 (Determinism)
相同輸入必須產生相同輸出，並用明確的 **exit code** 表達成功與失敗。Agent 依賴 exit code 來判斷下一步，一個「有時回 0、有時靜默失敗」的腳本，會讓上層所有 Pattern 跟著崩潰。

#### C. 結構化輸出 (Structured Output)
這是工具與「一般 CLI 指令」最關鍵的差異：**工具應該回傳 JSON，而不是給人看的純文字。** 讓 Agent 去解析 `git status` 那種為人類設計的排版，等於逼它在雜訊裡猜資料；直接給它結構化結果，解析就變得可靠。

### 3. 範例：一支結構化輸出的 skill
```bash
#!/usr/bin/env bash
# .claude/skills/git-summary.sh
# 原子化工具：回傳目前 Git 工作區狀態（JSON）
set -euo pipefail

branch=$(git rev-parse --abbrev-ref HEAD)
staged=$(git diff --cached --name-only | wc -l | tr -d ' ')
modified=$(git diff --name-only | wc -l | tr -d ' ')

printf '{"branch":"%s","staged":%s,"modified":%s}\n' "$branch" "$staged" "$modified"
```

Agent 呼叫它得到的是 `{"branch":"main","staged":2,"modified":5}`——一個它能 100% 可靠解析的事實，而不是一段需要「閱讀理解」的輸出。

### 4. 為什麼「可測試」是 skill 的命脈
`skills/` 是整個 Agent 行為的地基。地基不穩，上面疊的所有 Workflow Pattern 都會塌。

而 skills 有一個 `rules/` 沒有的巨大優勢：**它們是純粹的 CLI 程式，不含 LLM 的隨機性，因此可以用傳統單元測試完整覆蓋。** 這帶來兩個關鍵好處：

*   **可靠性：** 工具在進入 Agent 的工具箱前，就已經被驗證過行為正確。
*   **可觀測性：** 當任務失敗時，你能明確區分「是工具壞了，還是 Agent 的推理錯了」。沒有這條界線，除錯會變成一場災難。

### 5. Critical Thinking：工具粒度的拿捏 (Granularity)
工具庫最難的不是寫腳本，而是**切分邊界**：

*   **太細碎：** 每支腳本只做一個 micro 操作，Agent 得串接十幾支才能完成一件事，認知負擔反而暴增、組裝容易出錯。
*   **太肥大：** 一支腳本包山包海，失去原子性、無法單獨測試，也難以在其他 Pattern 中重用。

實務上的判準是：**以「一個可獨立驗證的業務動作」作為一支 skill 的邊界。** 「安全地 rebase」「總結測試覆蓋率缺口」都是好邊界；「處理所有 git 相關的事」則不是。

---

**今日實踐任務：**
1. 挑一個你常讓 AI 重複執行、又容易出錯的 Shell 操作（例如清理 build、檢查依賴版本），把它封裝成 `.claude/skills/` 下的一支腳本，並要求它**輸出 JSON**。
2. 幫這支腳本寫一個最小測試（給定輸入 → 驗證輸出），確保它是一個「可測試的工具」，而不是一次性的 hack。

*明天 Day 05，我們會把 `rules/` 的紀律與 `skills/` 的工具組合起來，封裝成一個個斜線指令 (`commands/`)，讓開發者用一行 `/command` 就能啟動完整的 Workflow。*
