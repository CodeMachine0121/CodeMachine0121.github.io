---
title: "Day 04：skills 與 subagents：觸發才載入的能力與分身"
datetime: "2026-06-26"
description: "從 context 跨入 invoke：skills 透過漸進式揭露只在被觸發時載入 body，subagents 則把子任務丟到獨立上下文執行。並釐清 commands 已併入 skills 的官方現況。"
image: ""
parent: "AI Agent Workflow Patterns：從架構設計到自動化開發協議的 30 天實戰"
---

前兩天的 CLAUDE.md 與 rules 都是 context——**啟動就載入、一直佔著上下文**。今天進入第二層 invoke：能力平常只露出一行描述，被觸發時才真正載入。代表機制有兩個：`skills`（載入一段能力到當前對話）與 `subagents`（把子任務交給一個獨立上下文的分身）。

## 1. skills：一份 SKILL.md + 它指定的資源
一個 skill 是 `.claude/skills/<name>/` 下的目錄，核心是 `SKILL.md`：

*   **frontmatter（`name` + `description`）：** `description` 是觸發條件。Claude 啟動時只先看到所有 skill 的 description，由模型自行判斷何時該載入這個 skill。
*   **body：** 用自然語言寫清楚流程，並指定要跑哪支 `scripts/` 腳本、套哪個 `templates/` 範本。

```text
.claude/skills/
└── conventional-commit/
    ├── SKILL.md
    └── scripts/
        └── staged-summary.sh
```

## 2. 漸進式揭露：invoke 省 context 的關鍵
skill 採三層按需載入：

| 層級 | 內容 | 何時載入 |
|---|---|---|
| Tier 1 | `name` + `description` | 啟動就掃，成本極小 |
| Tier 2 | 完整 SKILL.md body | 被觸發時才載入 |
| Tier 3 | scripts / templates | 真的要執行時才載入 |

這就是 invoke 與 context 的根本差異：rules 是「一直在」，skill 是「叫到才來」。你可以掛幾十個 skill，平常只付那幾十句 description 的入場費。

## 3. 範例：一份 SKILL.md
```markdown
---
name: conventional-commit
description: 依 Conventional Commits 規範，從 staged 變更產生 commit 訊息。當使用者說「幫我寫 commit message」「產生 commit」時使用。
---

# Conventional Commit 產生器

## 流程
1. 執行 scripts/staged-summary.sh 取得 staged 差異摘要（JSON）。
2. 依變更性質選定 type（feat/fix/docs/refactor/chore）與 scope。
3. 產出一行 summary，必要時加 body，遵守 72 字元上限。
```

兩種觸發方式：**model-invoked**（描述符合任務時，模型自己叫用）與 **/skill 手動觸發**。description 寫得準不準，直接決定它會不會在對的時機被載入。

## 4. commands 已併入 skills
如果你看過舊資料會問：那 `.claude/commands/` 呢？官方已經把 commands 併入 skills——`.claude/commands/deploy.md` 與 `.claude/skills/deploy/SKILL.md` 都會產生 `/deploy`，行為一致。舊的 `commands/` 檔仍可用（向後相容），但新做法一律寫成 skill。所以你可以把斜線指令，理解成 skill 的「手動觸發外衣」。

## 5. subagents：把子任務丟到獨立上下文
`.claude/agents/*.md` 定義的子代理，也是 invoke 家族，但粒度更大：skill 是「把一段能力載入當前對話」，subagent 是「開一個有獨立上下文的執行者去跑子任務」。

```markdown
---
name: code-reviewer
description: 審查 diff，找出 bug 與風格問題。當使用者要求 code review、檢查變更、審查 PR 時委派。
tools: Read, Grep, Bash
---

你是嚴格的程式碼審查者。只讀不改，輸出依嚴重度排序的問題清單。
```

委派同樣靠 description 比對：Claude 遇到符合描述的任務時，把它交給這個 subagent，子代理在自己的乾淨上下文裡跑完、回傳結果。適合用來隔離雜訊、做平行 fan-out，或需要一個不受主對話干擾的視角（如審查）。

## 6. Critical Thinking：description 是 invoke 的命脈
skills 與 subagents 共用同一個罩門：**它們會不會在對的時機被叫到，幾乎完全取決於 description。** 寫太廣會到處誤觸發、稀釋判斷；寫太窄或太模糊，該用時模型選不到它。description 要明確寫出「情境與觸發語句」。同時，invoke 仍然不是 enforce——它是「被叫到才載入」，不是「保證會被叫到」。

---

**今日實踐任務：**
在範本加兩樣東西：(1) 一個會跑的 skill（例如上面的 `conventional-commit`，scripts 輸出 JSON 並寫個最小測試）；(2) 一個 `code-reviewer` subagent。先用 `/conventional-commit` 手動觸發，再用接近 description 的話讓模型自動觸發，比較兩者。範本今天長出 `.claude/skills/` 與 `.claude/agents/`。

*明天 Day 05，我們終於走到 enforce：settings 與 hooks——前四天學的全是「會讀」或「會被叫到」，沒有一個保證執行；明天看唯一真正擋得下動作的那一層。*
