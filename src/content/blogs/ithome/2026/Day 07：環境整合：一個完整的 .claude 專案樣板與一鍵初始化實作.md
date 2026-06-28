---
title: "Day 07：環境整合：一個完整的 .claude/ 專案樣板與一鍵初始化實作"
datetime: "2026-06-29"
description: "第一階段收尾。把前六天打造的 rules/、skills/、commands/、docs/ 組裝成一個可重用的 .claude/ 專案樣板，並寫一支「一鍵初始化」腳本，讓任何新專案都能在數秒內獲得標準化的 Agentic 執行環境。"
image: ""
parent: "AI Agent Workflow Patterns：從架構設計到自動化開發協議的 30 天實戰"
---

過去六天，我們像拆解引擎一樣，把 `.claude/` 的四個子系統逐一攤開來看。今天是第一階段的收尾：我們要把這些散落的「零件」組裝成一台能發動、可複製的「整機」——一個標準化的 `.claude/` 專案樣板，以及一支讓它在任何新專案中數秒落地的初始化腳本。

## 1. 從「零件」到「整機」：回顧四個子系統
在動手整合前，先用一張表把前六天的角色定位收束起來：

| 子系統 | 角色 | 回答的問題 |
|---|---|---|
| `rules/` | 行為約束 | Agent **該怎麼想**？ |
| `skills/` | 執行能力 | Agent **能可靠地做什麼**？ |
| `commands/` | 互動介面 | 開發者**如何啟動**一個 Pattern？ |
| `docs/` | 上下文基準 | Agent **依據什麼背景**做決策？ |
| `CLAUDE.md` | 主記憶索引 | 哪些是**永遠要記得**的全局原則？ |

這五者各司其職:`commands/` 是入口、`rules/` 是紀律、`skills/` 是手腳、`docs/` 是知識、`CLAUDE.md` 是把它們串起來的索引。

## 2. 標準樣板的目錄結構
一個「開箱即用」的最小樣板，應該長這樣——每個目錄都附上一個能跑的種子檔，而不是空殼：

```text
your-project/
├── CLAUDE.md                      # 全局原則 + 指向 docs 的索引
└── .claude/
    ├── rules/
    │   └── base-protocol.md       # 所有 Pattern 的前置規範（PRE-FLIGHT CHECK）
    ├── skills/
    │   └── git-summary.sh         # 範例工具：回傳工作區狀態（JSON）
    ├── commands/
    │   └── kickoff.md             # 範例指令：載入 context 後再開工
    └── docs/
        └── context.md             # Agent 必讀的全局情境總覽
```

關鍵在於 `base-protocol.md` 這份「前置規範」——它把 Day 06 提到的 **PRE-FLIGHT CHECK**（動手前先讀 `docs/context.md`）固定下來，成為所有後續 Pattern 共用的地基。

## 3. 一鍵初始化腳本
樣板的價值在於**可複製**。與其每次手動 `mkdir`，不如寫一支冪等 (idempotent) 的初始化腳本，讓任何專案一行指令就能獲得這套環境：

```bash
#!/usr/bin/env bash
# scripts/init-claude.sh —— 一鍵初始化標準 .claude/ 環境
set -euo pipefail

root="${1:-.}"
base="$root/.claude"

mkdir -p "$base"/{rules,skills,commands,docs}

# 種子檔：僅在不存在時建立，確保腳本可重複執行而不覆蓋既有內容
[ -f "$base/rules/base-protocol.md" ] || echo "# 基礎協議：所有 Pattern 的前置規範" > "$base/rules/base-protocol.md"
[ -f "$base/docs/context.md" ]        || echo "# 專案架構概覽（請填入核心設計原則）" > "$base/docs/context.md"
[ -f "$root/CLAUDE.md" ]              || echo "# 全局原則 + 指向 .claude/docs 的索引" > "$root/CLAUDE.md"

echo "✅ .claude/ 環境已初始化於 $base"
```

`|| echo ...` 的寫法確保它是**冪等**的：重複執行不會覆蓋你已經寫好的規則，這對「在既有專案上補裝」尤其重要。

## 4. 把樣板變成「可演進」的資產
初始化只是起點。一個健康的 `.claude/` 樣板，應該具備三個特性：

*   **版本控管：** 把 `.claude/` 納入 Git（呼應 Day 02 的「路徑確定性」與 CODEOWNERS 守護），讓 Agent 的行為變更像程式碼一樣可追溯、可 review。
*   **持續回填：** 樣板不是一次性產物。每當你在某個專案裡淬鍊出一個好用的 rule 或 command，就把它回填進樣板，讓下一個專案直接受益。
*   **跨專案複用：** 把樣板獨立成一個 repo，新專案 `git clone` 或透過 `init` 腳本拉取即可，團隊間共享同一套 Agentic 基準。

## 5. Critical Thinking：樣板的「過度標準化」風險
標準化是雙面刃。當樣板越長越大，它會從「加速器」退化成「負擔」:

*   **風險：** 一個只有三支腳本的小工具專案，被迫扛進一套為大型系統設計的 20 條規則與 10 個指令——這些用不到的內容會稀釋上下文、增加維護成本，正是 Day 03 警告過的「規則過載」。
*   **解法：** 提供**分層樣板**（`minimal` 與 `full` 兩種 profile），或讓 `init` 腳本以互動式選單讓使用者按需選裝模組。樣板的目標是「合身」，不是「大而全」。

---

**今日實踐任務：**
1. 把你前六天建立的 `rules/`、`skills/`、`commands/`、`docs/` 整理成一份乾淨的 `.claude/` 樣板目錄。
2. 寫一支 `init` 腳本（bash 或你慣用的語言），能把這份樣板複製到任意新專案並完成基本檢查（目錄是否齊全、種子檔是否存在）。
3. （選做）把樣板放上一個獨立 repo，驗證「新專案一鍵取得標準環境」的流程。

*第一階段到此完成——我們已經為 Agent 打造好一個標準化、可追溯、可複製的執行環境。明天 Day 08，我們正式跨入第二階段「決策、推理與結構化模式」，從第一個推理骨架 **ReAct (Reasoning + Acting)** 開始，讓 Agent 學會「邊推理、邊行動」。*
