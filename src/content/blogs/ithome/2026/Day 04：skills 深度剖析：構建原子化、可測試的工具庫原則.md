---
title: "Day 04：skills/ 深度剖析：構建原子化、可測試的工具庫原則"
datetime: "2026-06-26"
description: "探討 .claude/skills/ 的設計：一個 skill 是一份 SKILL.md（定義何時觸發）加上它所指定的腳本與範本。透過漸進式揭露的三層載入，讓能力被模型在對的時機自動載入，並把確定性的執行沉澱成可測試的 scripts。"
image: ""
parent: "AI Agent Workflow Patterns：從架構設計到自動化開發協議的 30 天實戰"
---

昨天我們剖析了 `rules/`——Agent 的「大腦邏輯」，它約束 Agent **怎麼想**。但光有紀律不夠，Agent 還需要可靠的「手腳」去**動手做**。今天，我們從「行為約束」走向「執行能力」，深入剖析 `.claude/skills/`。

這裡要先打破一個常見誤解：**一個 skill 不是一支放在資料夾裡、等人呼叫的腳本。** 用官方的話說，skill 是一個「能力包 (expertise package)」——把**指令、可執行程式碼與資源**打包在一起，層級比單一 tool 更高。它的核心是一份 `SKILL.md`，由它描述「自己是什麼、何時該被用」，再去指定要執行哪支腳本、套用哪個範本。

## 1. 什麼是 Skill？一份 SKILL.md + 它所指定的資源
一個 skill 是 `.claude/skills/<name>/` 下的一個目錄，核心是根目錄的 `SKILL.md`：

*   **frontmatter（`name` + `description`）：** 這是 skill 的「身分證」。其中 `description` 最關鍵——它不是給人看的註解，而是 **觸發條件**。Claude Code 啟動時會掃過所有 skill 的 description，**由模型自行判斷**什麼情境該載入這個 skill（model-invoked），你不需要手動呼叫。
*   **body（Markdown 內文）：** 用自然語言寫清楚這個能力的流程，以及**該呼叫哪支 `scripts/` 腳本、套用哪個 `templates/` 範本來產出**。

換句話說：`SKILL.md` 是編排（orchestration），`scripts/` 與 `templates/` 是它調度的執行單元與輸出模具。

> 這也是 Skill 與明天要談的 `commands/` 最大的差別：**Skill 是「模型觸發」**（Claude 依 description 自己決定何時用）；**Command 是「使用者觸發」**（你打 `/command` 才啟動）。

## 2. Skill 的結構
```text
.claude/skills/
└── git-report/
    ├── SKILL.md              # 定義：name + description（觸發時機）+ 流程
    ├── scripts/
    │   └── summarize.sh      # 原子化、可測試的執行單元（輸出 JSON）
    └── templates/
        └── report.md         # 輸出範本（格式與邏輯分離）
```

`SKILL.md` 是大腦，`scripts/` 是肌肉，`templates/` 是模具——三者各司其職。

## 3. 範例：一份 SKILL.md
```markdown
---
name: git-report                 # 人類可讀的識別名，上限 64 字元
description: 產出目前 Git 工作區的狀態摘要報告。當使用者詢問「現在改了哪些東西」「幫我看 git 狀態」「整理一份變更摘要」時使用。   # 上限 1024 字元
---

# Git 變更摘要

## 流程
1. 執行 `scripts/summarize.sh`，取得結構化的工作區狀態（JSON）。
2. 將 JSON 的 `branch` / `staged` / `modified` 欄位填入 `templates/report.md`。
3. 輸出填好的報告給使用者。
```

重點在於：**「何時用」寫在 description、「怎麼做」寫在 body、「實際執行」交給 script、「長什麼樣」交給 template。** 每一層職責清晰。

## 4. 為什麼這樣切？漸進式揭露 (Progressive Disclosure)
Skill 之所以拆成「frontmatter／SKILL.md 內文／外部檔案」三層，不是為了整齊，而是為了**省 token**。Claude Code 採用三層按需載入：

| 層級 | 內容 | 何時載入 | 成本 |
|---|---|---|---|
| **Tier 1** Metadata | `name` + `description` | **永遠**（啟動就掃描） | 極小 |
| **Tier 2** 完整 SKILL.md | 流程、最佳實踐 | 模型判斷相關時才載入 | 約數千 tokens |
| **Tier 3** 連結檔案 | `scripts/`、`templates/`、resources | 真的要執行時才載入 | 用到才付 |

這個模型一次解釋了前面兩個設計為什麼成立：

*   **為什麼 `description` 要寫準：** 因為 Tier 1 只有它。模型在「還沒讀內文」的情況下，就要靠這一句決定要不要把整個 skill 展開。
*   **為什麼 `scripts/`、`templates/` 要獨立成檔：** 因為它們是 Tier 3，平常不佔上下文，要用時才載入。把大段範本或長腳本塞進 SKILL.md 內文，等於把 Tier 3 的成本硬塞進 Tier 2。

副作用很迷人：你可以同時掛上幾十個 skill，平常只付那幾十句 `description` 的「入場費」，真正用到某個才展開它的內文與腳本——這就是 skill 能「能力很多、上下文卻不爆」的關鍵。

## 5. 確定性的執行，沉澱進可測試的 scripts
`SKILL.md` 指定的腳本，才是真正動手的地方。它應遵守三個原則：

### A. 原子化 (Atomicity)
一支腳本只做一件可獨立描述的事。不要寫「跑測試順便部署順便發通知」的萬能腳本——那無法被獨立驗證，也無法重用。

### B. 確定性 (Determinism)
相同輸入產生相同輸出，並用明確的 **exit code** 表達成敗。一個「有時回 0、有時靜默失敗」的腳本，會讓上層整個 skill 跟著崩潰。

### C. 結構化輸出 (Structured Output)
腳本應回傳 **JSON**，而不是給人看的純文字。讓模型去解析 `git status` 那種為人類排版的輸出，等於逼它在雜訊裡猜資料；直接給結構化結果，`SKILL.md` 的後續步驟才能可靠地引用。

```bash
#!/usr/bin/env bash
# .claude/skills/git-report/scripts/summarize.sh
# 原子化執行單元：回傳工作區狀態（JSON）
set -euo pipefail

branch=$(git rev-parse --abbrev-ref HEAD)
staged=$(git diff --cached --name-only | wc -l | tr -d ' ')
modified=$(git diff --name-only | wc -l | tr -d ' ')

printf '{"branch":"%s","staged":%s,"modified":%s}\n' "$branch" "$staged" "$modified"
```

## 6. 為什麼「可測試」是 skill 的命脈
Skill 由兩種材質組成，要用不同方式確保品質：

*   **`SKILL.md` 是給模型的 prompt：** 無法跑單元測試，但可以「審查」——尤其是 `description` 寫得夠不夠精準（決定它會不會在對的時機被觸發）。
*   **`scripts/` 是純粹的程式：** 不含 LLM 的隨機性，**可以用傳統單元測試完整覆蓋**。

所以好的設計是：**把易變的判斷與編排留在 `SKILL.md`，把確定性的操作下沉到可測試的 `scripts/`。** 這條界線帶來可觀測性——任務失敗時，你能明確區分「是腳本壞了，還是模型的判斷錯了」。

## 7. Critical Thinking：description 的精準度與 skill 粒度
Skill 最難的不是寫腳本，而是兩件事：

*   **`description` 的精準度：** 它同時是 Tier 1 的全部、也是模型唯一的觸發依據。寫太廣（「處理檔案相關的事」），它會到處誤觸發；寫太窄或太模糊，該用的時候模型卻選不到它。description 要明確描述**情境與觸發語句**，這直接決定 skill 有沒有用。
*   **粒度 (Granularity)：** 以「一個可獨立描述、可獨立驗證的能力」作為一個 skill 的邊界。「產出 Git 變更摘要」是好邊界；「處理所有 git 相關的事」則太肥，會失去原子性與可測試性。

---

**今日實踐任務：**
1. 建立 `.claude/skills/<name>/SKILL.md`，frontmatter 寫上 `name` 與一段**明確描述觸發時機**的 `description`，body 指定要跑哪支 script、套哪個 template。
2. 把實際操作沉澱成 `scripts/` 下的原子化腳本（**輸出 JSON**），並為它寫一個最小測試。
3. 打開 Claude Code，用接近 `description` 的話描述需求，觀察它是否會**自動載入**這個 skill——藉此檢驗你的 description（也就是 Tier 1）寫得夠不夠精準。

*明天 Day 05，我們會看 skill 的另一面：當你想要**主動、明確地**啟動一套流程，而不是等模型自己判斷時，就輪到 `commands/` 上場——用一行 `/command` 觸發完整的 Workflow。*
