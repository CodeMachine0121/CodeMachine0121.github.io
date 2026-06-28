---
title: "Day 07：整合：把七天疊加成一個可 clone 的 starter"
datetime: "2026-06-29"
description: "第一階段收尾。用 context / invoke / enforce 三層總表收束六天的機制，組裝成一個完整的 .claude/ starter，附一鍵初始化腳本與機制自檢清單，讓任何新專案數秒落地一套機制無漏的執行環境。"
image: ""
parent: "AI Agent Workflow Patterns：從架構設計到自動化開發協議的 30 天實戰"
---

過去六天，我們一塊一塊把 Claude Code 的真實機制疊上 `.claude/`。今天是第一階段的收尾：把這些零件組裝成一台能複製、機制無漏的整機——一個可以 clone 來用的 starter。

## 1. 三層總表：現在才給全貌
Day 01 我們只埋了三層地圖的鉤子。走完六天、有了體感，現在把它補成完整總表：

| 機制 | 層 | 何時載入 / 執行 | 由誰決定 |
|---|---|---|---|
| CLAUDE.md（+ @import） | context | 啟動載入全文 | 模型自律 |
| auto memory | context | 啟動載入前段 | 模型自律 |
| rules（無 paths） | context | 啟動載入 | 模型自律 |
| rules（有 paths） | context（條件） | 開到符合檔案才載入 | 模型自律 |
| skills | invoke | 觸發才載入 body | 模型自律 |
| subagents | invoke | 描述符合才委派 | 模型自律 |
| permissions / hooks | enforce | 不進 context，事件點執行 | harness 強制 |
| docs/ | 自訂慣例 | 只能 @import 或當下 Read | — |

一句話總結整個第一階段：**context 是「希望」，invoke 是「按需」，enforce 是「保證」。**

## 2. 完整的 starter 結構
把六天的產物收進一個樣板：

```text
your-project/
├── CLAUDE.md                      # 精簡原則 + @import docs
└── .claude/
    ├── rules/
    │   ├── coding-style.md         # 全域（無 paths）
    │   └── api-rules.md            # path-scoped
    ├── skills/
    │   └── conventional-commit/SKILL.md
    ├── agents/
    │   └── code-reviewer.md
    ├── docs/
    │   └── architecture.md         # 被 CLAUDE.md @import
    ├── hooks/
    │   └── guard-branch.sh
    └── settings.json               # permissions + hooks
```

注意它和舊版的差異：補齊了 `agents/`、`hooks/`、`settings.json`，移除了「commands 當獨立子系統」的錯誤，並把 `docs/` 明確標為自訂慣例而非內建知識庫。

## 3. 一鍵初始化腳本
與其每次手動建，不如寫一支冪等的初始化腳本，讓任何新專案一行落地：

```bash
#!/usr/bin/env bash
# scripts/init-claude.sh —— 初始化標準 .claude/ starter
set -euo pipefail
root="${1:-.}"
mkdir -p "$root"/.claude/{rules,skills,agents,docs,hooks}

[ -f "$root/CLAUDE.md" ] || cat > "$root/CLAUDE.md" <<'MD'
# 專案
- 技術棧：（請填）
- 慣例：（請填）

詳細架構見 @./.claude/docs/architecture.md
MD
[ -f "$root/.claude/docs/architecture.md" ] || echo "# 架構概覽（請填入分層、資料流、命名慣例）" > "$root/.claude/docs/architecture.md"
[ -f "$root/.claude/settings.json" ] || echo '{ "permissions": { "ask": ["Bash(git push:*)"] }, "hooks": {} }' > "$root/.claude/settings.json"

echo "完成：.claude/ starter 已初始化於 $root"
```

`|| ...` 確保它是冪等的：重複執行不會覆蓋你已寫好的內容，方便在既有專案上補裝。

## 4. 機制自檢清單
加進 starter 前，對每個檔案問一句「它屬於哪一層」，避免重蹈舊版「把願望當保證」的覆轍：

*   這個需求是「希望平常照做」嗎？→ 寫進 CLAUDE.md 或 rules（context）。
*   是「按需才需要的能力 / 視角」嗎？→ 做成 skill 或 subagent（invoke）。
*   是「絕對不能發生的紅線」嗎？→ 寫成 permissions 或 hook（enforce）。**寫進 rules 沒用。**
*   是「給人或被引用的文件」嗎？→ 放 docs/，並記得用 @import 才進得了 context。

## 5. Critical Thinking：樣板要「合身」，不要「大而全」
starter 的價值不在塞滿檔案，而在示範了三層分工。一個只有三支腳本的小工具，硬套一份為大型系統設計的 20 條規則與 10 個 hook，只會稀釋上下文、增加維護負擔。提供 minimal 與 full 兩種 profile，或讓 init 腳本互動式選裝，讓樣板對得起專案的實際規模。

---

**今日實踐任務：**
把前六天累積的零件收斂成一個乾淨的 `.claude/` starter，寫好 `init-claude.sh`，在一個全新的空專案跑一次，並用第 4 節的自檢清單逐項打勾。最後 push 成一個你之後可以 `git clone` 直接用的 starter repo。

*第一階段到此完成——我們已經為 Agent 打造好一個機制正確、分層清楚、可複製的執行環境。明天 Day 08，正式進入第二階段：從第一個推理骨架 ReAct (Reasoning + Acting) 開始，把 Workflow Patterns 蓋在這個地基上。*
