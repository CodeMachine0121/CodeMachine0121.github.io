---
title: "Day 06：docs 與 context 邊界：放進 .claude 不等於讀得到"
datetime: "2026-06-28"
description: "回收 Day 02 的 @import 佔位，藉此說清楚 .claude/docs/ 不是內建、不會自動讀；只有 @import 或當下 Read 才進得了上下文。並整理一張『什麼會自動進 context、什麼不會』的對照。"
image: ""
parent: "AI Agent Workflow Patterns：從架構設計到自動化開發協議的 30 天實戰"
---

前五天我們把 CLAUDE.md、rules、skills、subagents、hooks 都鋪好了。今天回收 Day 02 留下的伏筆——CLAUDE.md 裡那行 `@./.claude/docs/architecture.md` 佔位——並用它釐清一個多數人都誤會的點：**把文件放進 `.claude/` 裡，不代表 Agent 就讀得到。**

## 1. docs/ 不是內建機制
先講結論：`.claude/docs/` **不是 Claude Code 的內建目錄**。它不像 rules/、skills/ 會被自動發現或載入。官方文件根本沒有「docs/ 是自動知識庫」這回事。

它能發揮作用，只有兩條路：

*   被 `CLAUDE.md`（或某個 rule）用 `@import` 掛進來，在啟動時一起載入；
*   Agent 在當下用 Read 工具主動去讀它。

換句話說，`.claude/docs/` 是一個**自訂慣例**：一個你拿來放文件的普通資料夾，沒有任何魔法。

## 2. 回收伏筆：實測「不 import 就讀不到」
Day 02 我們在 CLAUDE.md 留了一行：

```markdown
詳細架構見 @./.claude/docs/architecture.md
```

今天把 `architecture.md` 補上真正的內容（例如分層架構、資料流、命名慣例）。然後做一個對照實驗：

1.  **先把那行 `@import` 註解掉**，問 Claude「這個專案的架構是怎麼分層的？」——它答不出來，因為那份文件根本沒進上下文。
2.  **把 `@import` 加回去**，重開 session 再問一次——這次它答得出來。

這個一行之差，就是「放在 .claude/docs/」與「真的進了 context」之間的距離。docs/ 本身不會自己跳進來。

## 3. 那 docs/ 還有什麼用？
有用，而且很實用——只要你誠實看待它的角色：

*   **對抗 lost-in-the-middle：** 把長架構文件拆出去，CLAUDE.md 只留精簡原則 + 一行 `@import`，主記憶保持乾淨。
*   **按需掛載：** 不需要每次都載入的細節（某個子系統的 API 約定），可以不放 `@import`，改在動到該區域時讓 Agent 主動 Read。
*   **人機共用：** 它同時是給人看的文件、也是 Agent 可被指向的知識來源。

關鍵心法：**docs/ 是「等著被引用」的素材庫，不是「會自動進腦」的記憶。**

## 4. 收束：什麼會自動進 context、什麼不會
把六天的機制按「會不會自動進上下文」整理一次：

| 機制 | 會自動進 context？ |
|---|---|
| CLAUDE.md（含 @import 的檔） | 會，啟動全文載入 |
| auto memory（MEMORY.md 前段） | 會，啟動載入 |
| rules（無 paths） | 會，啟動載入 |
| rules（有 paths） | 條件式——開到符合檔案才載入 |
| skills / subagents | 不會——只先看描述，觸發才載入 |
| settings / hooks | 不會——不進 context，由 harness 執行 |
| docs/ | 不會——除非被 @import 或當下 Read |

這張表就是三層地圖的具體落地：context 會自動進、invoke 觸發才進、enforce 根本不進（它在另一個維度運作）。

---

**今日實踐任務：**
把 Day 02 佔位的 `.claude/docs/architecture.md` 補上你專案的真實架構摘要，然後做上面那個「註解掉 @import vs 加回來」的對照實驗，親眼確認 docs/ 不 import 就讀不到。範本今天讓 `docs/` 真正被 CLAUDE.md 引用起來。

*明天 Day 07，是第一階段的收尾：把這六天逐日疊加的零件，組裝成一個能 clone 來用的 `.claude/` starter，並附上一張機制自檢清單，確保每塊東西都放在對的那一層。*
