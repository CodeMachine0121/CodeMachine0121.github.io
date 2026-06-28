---
title: "Day 02：CLAUDE.md 與 auto memory：Agent 啟動就讀進的長期記憶"
datetime: "2026-06-24"
description: "解析 Claude Code 兩個每次啟動都會載入的內建記憶機制：CLAUDE.md 的階層與 @import，以及 Claude 自己寫的 auto memory。並第一次點明三層主軸：載入進上下文，不等於會被強制遵守。"
image: ""
parent: "AI Agent Workflow Patterns：從架構設計到自動化開發協議的 30 天實戰"
---

昨天我們建立了空的 `.claude/`，也畫出了三層地圖：context、invoke、enforce。今天從 context 的第一站開始——**Agent 每次啟動時，到底有哪些東西會被自動讀進上下文？**

答案是兩個內建機制：你寫的 `CLAUDE.md`，以及 Claude 自己寫的 `auto memory`。

## 1. 先給一張 .claude/ 全貌
為了避免舊版的誤導，先把 Claude Code 真正會用到的東西列清楚（注意：commands 已併入 skills，docs/ 不是內建）：

```text
你的專案/
├── CLAUDE.md                  # 啟動載入的專案記憶（context）
└── .claude/
    ├── rules/                 # 條件式載入的行為準則（context，Day 03）
    ├── skills/                # 觸發才載入的能力（invoke，Day 04）
    ├── agents/                # 可被委派的子代理（invoke，Day 04）
    ├── settings.json          # 權限與 hooks（enforce，Day 05）
    └── docs/                  # 自訂慣例，非內建、不自動讀（Day 06）
```

而 auto memory 不在專案裡，是放在你機器上的 `~/.claude/projects/<專案>/memory/`。

## 2. CLAUDE.md：每次啟動載入全文
`CLAUDE.md` 是你寫給 Claude 的持久化指示，**每次 session 開始都會被完整讀進上下文**。它有一套由廣到窄的階層，後載入的較貼近你，優先級較高：

| 範圍 | 位置 |
|---|---|
| 組織政策 | 系統層（managed policy） |
| 使用者 | `~/.claude/CLAUDE.md` |
| 專案 | `./CLAUDE.md` 或 `./.claude/CLAUDE.md` |
| 個人本地 | `./CLAUDE.local.md`（建議加進 .gitignore） |

所有命中的檔案會被「疊加」進上下文，而不是互相覆蓋。

## 3. @import：把細節拆出去、主記憶保持精簡
`CLAUDE.md` 一膨脹就會稀釋上下文。官方建議單檔控制在 200 行內。要拆檔，用 `@import` 把其他檔案在啟動時一起展開載入：

```markdown
# 專案：coding-afternoon
- 技術棧：Bun + Astro + TypeScript
- 慣例：一律用 Bun，不用 npm；測試用 bun test

詳細架構見 @./.claude/docs/architecture.md
```

注意 `@./.claude/docs/architecture.md` 這一行——它是把 docs/ 內容送進上下文的**唯一合法管道**之一（Day 06 會回收這個伏筆）。

## 4. auto memory：Claude 自己寫的跨 session 記憶
另一個內建機制是 auto memory：Claude 會在工作中，把它認為未來有用的事實（build 指令、除錯心得、你的偏好）寫進 `~/.claude/projects/<專案>/memory/MEMORY.md`。每次啟動會載入這份檔案的前 200 行（或 25KB）。

兩者的分工很清楚：**CLAUDE.md 是「你寫的約定」，auto memory 是「Claude 自記的學習」。**

## 5. 關鍵澄清：載入進上下文，不等於會被遵守
這是整個系列最重要的一句話，今天先講清楚：

> CLAUDE.md 與 auto memory 都是被放進上下文的「文字」，是 context、不是強制設定。Claude 會讀、會盡量遵守，但**不保證**。

如果你寫了「絕對不要 push 到 main」，它多數時候會聽——但這不是一道保證擋得住的閘門。真正能「硬擋」的機制要等到 Day 05 的 hooks。先記住這個落差，後面每一天都會回扣它。

---

**今日實踐任務：**
在你的範本寫出第一版 `./CLAUDE.md`：寫上專案技術棧、兩三條最關鍵的慣例，並加一行 `@./.claude/docs/architecture.md`（檔案先留空，當作佔位，Day 06 會把它補上並驗證）。接著開一個 Claude Code session，問它「你現在知道這個專案的哪些約定？」，確認 CLAUDE.md 真的被讀進去了。

*明天 Day 03，我們看 context 的第二種形式——rules：它能做到 CLAUDE.md 做不到的「條件式載入」，但也藏著本系列要修正的最大誤解：rules 其實沒有牙齒。*
