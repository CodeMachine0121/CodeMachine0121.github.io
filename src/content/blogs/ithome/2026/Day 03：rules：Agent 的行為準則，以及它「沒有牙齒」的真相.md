---
title: "Day 03：rules：Agent 的行為準則，以及它「沒有牙齒」的真相"
datetime: "2026-06-25"
description: "解析 .claude/rules/ 的真實行為：無 paths 的規則啟動載入、有 paths 的規則條件載入。並修正最常見的誤解——rules 是 context，不是強制執行，再硬的 MUST 也只是提示。"
image: ""
parent: "AI Agent Workflow Patterns：從架構設計到自動化開發協議的 30 天實戰"
---

昨天的 `CLAUDE.md` 是「每次都全文載入」的記憶。今天的 `rules/` 是它的進階版——一樣屬於 context，但多了一個關鍵能力：**條件式載入**。同時，今天要正面拆解整個系列最常見、也是舊版犯過的錯誤：以為「寫進 rules 的東西，Agent 就會被強制遵守」。

## 1. rules 是內建機制，但分兩種載入行為
`.claude/rules/` 是 Claude Code 內建的目錄，你可以把指示拆成多個 `.md` 檔（也支援 `~/.claude/rules/` 放使用者層規則）。它的載入行為由 frontmatter 決定：

*   **沒有 `paths` 的規則：** 啟動時載入，優先級等同 `.claude/CLAUDE.md`。
*   **有 `paths` 的規則：** 只有當 Claude 開到符合該 glob 的檔案時，才載入進上下文。

```text
.claude/rules/
├── coding-style.md     # 無 paths：全域，啟動就載入
└── api-rules.md        # 有 paths：只在動到 API 檔時才載入
```

## 2. path-scoped rules：把上下文花在刀口上
這是 rules 相對 CLAUDE.md 的真正價值。用 `paths` glob 把規則綁到特定檔案，平常完全不佔上下文，只有相關檔案出現時才喚醒：

```markdown
---
paths:
  - "src/api/**/*.ts"
---

# API 開發規範
- 所有 endpoint 必須做輸入驗證。
- 統一使用標準錯誤回應格式。
```

對照 glob 寫法：`**/*.ts`（任意目錄的 TS）、`src/**/*`（src 底下全部）、`*.md`（根目錄的 md）。

## 3. 怎麼寫一條「會被讀懂」的規則
規則仍是給模型看的文字，寫法影響遵守率：

*   **可驗證：** 「任何函式超過 40 行必須先提出拆解方案」勝過「請寫乾淨的程式碼」。
*   **可觀測：** 描述外部看得到的行為，而非內在心理（「回答前先輸出 reasoning 區塊」勝過「請仔細思考」）。
*   **優先級語氣：** 用 MUST / SHOULD / PREFER 標示強度，幫模型在衝突時排序。

## 4. 最大誤解：rules 沒有牙齒
重點來了。即使你寫下 `MUST NEVER push to main`，rules **仍然只是 context**：

> rules 會被讀進上下文、會提高遵守機率，但它不是 harness 的強制閘門。MUST 是「很強的提示」，不是「保證」。Claude 可能因為上下文太長、指令衝突、或單純判斷失誤而違反它。

換句話說：**rules 提高的是「機率」，不是「保證」。** 想要真正「不可能發生」的紅線，rules 做不到——那是 Day 05 hooks 與 permissions 的工作。今天先把這個落差釘住：把「希望它平常就照做」的事交給 rules；把「絕對不能發生」的事，留給 enforce 層。

## 5. Critical Thinking：規則的邊際效益遞減
規則不是越多越好。每條規則都佔上下文預算，當你寫到第 100 條，前面幾十條的遵守率反而開始下降——這就是「規則過載」。每加一條前先問：它和既有規則重疊嗎？能被更上層原則涵蓋嗎？違反它真的會讓任務失敗嗎？好的規則集像憲法一樣精簡有層次，而不是越寫越厚的免責聲明。

---

**今日實踐任務：**
在範本的 `.claude/rules/` 放兩條規則：一條沒有 `paths` 的全域 `coding-style.md`，一條帶 `paths: ["**/*.test.ts"]` 的測試專用規則。接著實測：開一個非測試檔、再開一個 `.test.ts` 檔，用 `/memory` 觀察 path-scoped 規則是否只在後者出現時才被載入。範本今天長出 `.claude/rules/`。

*明天 Day 04，我們跨出 context、進入 invoke：skills 與 subagents——平常只露出一行描述、被觸發才載入的能力與分身。*
