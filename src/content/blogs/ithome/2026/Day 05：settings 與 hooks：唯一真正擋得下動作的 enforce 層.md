---
title: "Day 05：settings 與 hooks：唯一真正擋得下動作的 enforce 層"
datetime: "2026-06-27"
description: "前四天的機制全都只是『會讀』或『被叫到』，沒有一個保證執行。今天進入 enforce：settings.json 的 permissions 與 hooks，由 harness 強制執行，是唯一能在動作發生前硬性擋下它的層。"
image: ""
parent: "AI Agent Workflow Patterns：從架構設計到自動化開發協議的 30 天實戰"
---

回顧前四天：CLAUDE.md 與 rules 是 context（會讀，不保證遵守），skills 與 subagents 是 invoke（觸發才載入）。它們有一個共同點——**全都依賴模型「願不願意聽話」，沒有一個能保證一件事不發生。**

今天補上最後、也是最關鍵的一層：enforce。它由 Claude Code 的 harness 直接執行，不進上下文、不靠模型自律，是唯一能在動作發生前真正擋下它的機制。

## 1. settings.json 與 permissions：不進上下文的硬閘門
`.claude/settings.json` 不會被讀進對話，而是由 harness 讀取並執行。其中 `permissions` 是對工具與路徑的硬性閘門：

```json
{
  "permissions": {
    "deny": ["Bash(rm -rf /*)", "Read(./.env)"],
    "ask":  ["Bash(git push:*)"]
  }
}
```

`deny` 的東西會被直接擋下，`ask` 會要求你確認。注意這跟 rules 寫「請不要刪這個檔」本質不同：rules 是請求，permissions 是命令——**前者可能被無視，後者由 harness 保證。**

## 2. hooks：在動作發生前攔截
hooks 是 enforce 層更靈活的形式。它在固定的生命週期事件（PreToolUse、PostToolUse、Stop 等）執行你指定的 shell 指令。其中 **PreToolUse 是唯一能在工具實際執行前攔截、並擋下它的點**：

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          { "type": "command", "command": ".claude/hooks/guard-branch.sh" }
        ]
      }
    ]
  }
}
```

hook 腳本從 stdin 收到工具呼叫的 JSON，**回傳非零（exit 2）就能擋下這次動作**，並把 stderr 回饋給 Claude：

```bash
#!/usr/bin/env bash
# .claude/hooks/guard-branch.sh —— 擋下直接 push 到受保護分支
input=$(cat)
cmd=$(echo "$input" | jq -r '.tool_input.command // ""')
if echo "$cmd" | grep -Eq 'git push.*(main|master)'; then
  echo "禁止直接 push 到受保護分支，請改開 PR。" >&2
  exit 2
fi
exit 0
```

關鍵在於：這個閘門**不管模型怎麼想**。就算 Claude 判斷「現在直接 push 比較快」，hook 仍然會把它擋下來。這正是 rules 做不到的事。

## 3. enforce 與 context 的正確分工
把三層擺在一起，分工就清楚了：

| 你想要的 | 該用 |
|---|---|
| 平常傾向這樣做（風格、慣例） | CLAUDE.md / rules（context） |
| 按需才載入的能力 | skills / subagents（invoke） |
| 絕對不能發生（紅線） | permissions / hooks（enforce） |

舊版最大的錯，就是把「絕對不能發生」的事寫進 rules，以為它會被強制——結果它只是個會被讀到的願望。真正的紅線，要寫成 hook。

## 4. Critical Thinking：enforce 也有代價
hooks 與 permissions 很強，但別濫用：它們不進上下文，所以對 Agent 來說是「看不見的牆」——當它被莫名擋下又不知原因時，行為會變得難以除錯（記得讓 hook 用 stderr 說清楚為什麼擋）。原則是：enforce 只留給「真正不可逾越」的少數紅線，其餘的傾向交給 context 層，保持系統可讀、可預期。

---

**今日實踐任務：**
在範本加上 `.claude/settings.json`：一條 `permissions.deny`（擋掉一個危險指令），以及一個 PreToolUse hook（例如上面的 `guard-branch.sh`，攔截 push 到 main）。接著實測對比：先在 rules 寫「不要 push 到 main」，看模型能不能被說服繞過；再用 hook 擋一次，確認它無論如何都被擋下。範本今天長出 `settings.json` 與 `.claude/hooks/`。

*明天 Day 06，我們回頭把一個伏筆收掉：Day 02 在 CLAUDE.md 裡留的那行 `@import` 佔位——藉它說清楚 docs/ 為什麼不是內建、放進 .claude 不等於 Agent 讀得到。*
