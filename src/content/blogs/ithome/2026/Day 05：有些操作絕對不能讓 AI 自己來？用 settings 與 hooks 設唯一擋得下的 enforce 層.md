---
title: "Day 05：有些操作絕對不能讓 AI 自己來？用 settings 與 hooks 設唯一擋得下的 enforce 層"
datetime: "2026-06-27"
description: "把危險動作交給 AI 自己判斷，遲早會出事。這篇釐清 context、invoke、enforce 三層的分工，說明為什麼只有 hooks 與 permissions 才真的擋得下動作，並在範例專案裡設一道實際攔得住刪檔的閘。"
image: ""
parent: "2026 ithome-鐵人賽: 從 Prompt 到 Loop：與 Claude Code 協作的自主開發迴圈實戰 系列"
---

## 能幹一點，也就危險一點

昨天我們把「抓網頁內容、產摘要」這件重複的複雜任務封裝成 skill 與 subagent，讓 agent 更能幹：一句話就能觸發一整套流程，不用每次重講。

但能幹的另一面，是它現在能做的事變多了，而且是自己決定要不要做。

假設你在稍後閱讀工具這個範例專案上想清一批舊的暫存檔，隨口說了「把 tmp 底下那些不用的抓取快取清一清」。agent 很盡責，它先掃了一圈目錄，然後決定「這樣一個一個刪太慢」，直接來了一句 `rm -rf` 往上退了一層路徑。等你看到它印出「已刪除 4,213 個檔案」才反應過來——它連 `db/migrations/` 底下那幾支 goose migration 檔一起清了。

還好有 git。但這件事會讓你想通一個之前一直含糊帶過的問題：前面幾天寫的 CLAUDE.md、rules、skills，沒有一個能擋下這種事。它們能讓 AI「知道」不該亂刪，卻沒辦法在它真的按下去的那一刻攔住手。

換個角度看，今天要建的其實是自動化迴圈的一個零件——那道踩得住的煞車。前面幾天我們一直在替 agent 的「想→動→看→修」內迴圈補齊零件（memory、rules、skills），但迴圈跑得越自動，越需要一個不靠它自我約束、真的攔得下手的煞車。這道煞車就是今天的主角，也是整個系列裡唯一真正 enforce 得了的一層——等到 Day 30 讓迴圈自己跑起來時，它會是那個讓你敢放手的前提（這層在 Loop Engineering 的零件拆解裡叫 Guardrails，對應業界的護欄／安全模式）。

## 判斷：context、invoke、enforce 是三層不同的東西

要想清楚這件事，得先把 `.claude/` 底下那些機制分成三層，它們的「約束力」完全不同。

第一層是 context。CLAUDE.md、auto memory、rules 都屬於這層。它們的特性是 agent 啟動或運作時「會被讀進去」，變成它判斷的依據。但關鍵字是「會讀」，不是「一定照做」。它讀了你的規則、理解了你的意圖，然後在生成的時候盡量遵守——盡量。這是機率性的服從，不是保證。我們在 Day 03 就講過 rules 沒有強制力，就是這個意思。

第二層是 invoke。skills、subagents 屬於這層，也就是昨天的主題。它們平常不在 context 裡，被觸發（invoke）了才載入。這解決的是「能力該不該現在出現」的問題，讓 context 不被塞爆。但注意，被觸發之後，它們一樣是丟給模型去讀、去執行的內容，終究還是「會讀不保證」的那一類。invoke 管的是「何時載入」，不是「能不能阻止」。

第三層是 enforce。這層只有兩個東西：permissions 與 hooks。它們不是寫給模型讀的文字，而是由執行環境（Claude Code 本身）在動作真的要發生前跑的程式邏輯。模型想執行一個 Bash 指令、想寫一個檔案，這個意圖會先經過 enforce 層的檢查，檢查不過就直接被擋下，模型連做的機會都沒有。

三層放在一起看就清楚了：

| 層 | 代表機制 | 約束力 | 管的事 |
|---|---|---|---|
| context | CLAUDE.md、rules、memory | 會讀，但不保證遵守 | agent 判斷時的依據 |
| invoke | skills、subagents | 觸發才載入，載入後仍是「會讀」 | 能力何時出現 |
| enforce | permissions、hooks | 由環境強制執行，擋得下動作 | 動作能不能發生 |

重點在最後一欄。你可以在 rules 裡寫一百遍「禁止刪除 migrations 目錄」，那是 context 層的宣告，agent 大多數時候會聽，但只要有一次它判斷失誤，規則就形同虛設。而 enforce 層不管 agent 怎麼想，它就是在 `rm` 真的要跑之前把它攔下來。

很多人以為把禁令寫進 rules 就夠了。但只要踩過一次那樣的 `rm -rf`，你就會承認：想擋動作，只有 enforce 層辦得到。

## 該不該設、什麼時候設

不是每件事都要動用 enforce。它是有成本的——設得太緊，agent 動不動就被擋，你得一直手動放行，反而拖慢自己。所以判斷標準很單純：這個動作一旦做錯，能不能輕易復原？

- 可逆、低風險的：改一般原始碼檔、跑測試、讀檔、git status。這些交給 context 層引導就好，出錯了改回來就是。
- 不可逆或高破壞力的：刪檔（尤其是遞迴刪除）、寫入禁改區（`db/migrations/`、sqlc 生成的 `internal/db/`、生產設定、`.env`）、`git push --force`、直接對資料庫下指令、動到部署腳本。這些就該進 enforce 層。

判斷的訊號其實就是你自己的那句「這要是錯了你會很痛」。會痛的，設一道閘；不痛的，別擋，留給 AI 自由度。每個小動作都設閘的話，你會被自己設的閘煩死，最後乾脆全開，那就更糟。

## 建立：permissions 管靜態規則，hooks 管動態判斷

enforce 層裡的兩個工具分工不太一樣，搭配起來用。

permissions 是靜態的規則表。你在 settings 裡列出哪些工具、哪些指令樣式是允許、詢問、還是拒絕。它適合表達那種「不管什麼情況都這樣」的規則，例如「所有 Bash 指令執行前都要問你」或「永遠不准碰 `.env`」。它的好處是宣告式、好讀，缺點是它只能比對樣式，沒辦法做複雜判斷。

hooks 則是動態的。它是你掛在某個生命週期事件上的一段自己的腳本——最有用的是 PreToolUse，在工具真的被呼叫前觸發。hook 拿得到這次要執行的完整資訊（哪個工具、什麼參數、什麼指令），你的腳本可以任意判斷，然後用回傳值決定放行或攔截。需要「看情況」的規則就靠它，例如「刪除指令只有在目標明確落在 tmp 底下才放行，其餘一律擋」。

一句話記法：permissions 畫死線，hooks 做判斷。

## 用 Claude Code 落地

先看 permissions。它寫在專案的 `.claude/settings.json`，用 allow / ask / deny 三種清單。deny 的優先級最高，會直接拒絕。

```json
{
  "permissions": {
    "deny": [
      "Read(./.env)",
      "Write(./db/migrations/**)",
      "Write(./internal/db/**)",
      "Bash(git push --force:*)"
    ],
    "ask": [
      "Bash(rm:*)",
      "Bash(git push:*)"
    ]
  }
}
```

這份設定的意思是：讀 `.env`、寫入 `db/migrations/` 或 sqlc 生成的 `internal/db/`、強制推送直接拒絕；任何 rm 或一般 push 都要先問過你。光這幾行，就已經把那種 `rm -rf` 的意外擋在門外了——它會停下來等你確認，而不是自己按下去。

但 ask 每次都跳出來問，久了也累。如果你想更精準——安全範圍內的刪除自動放行、越界的才擋——就得靠 hook 做判斷。在 settings 裡註冊一個 PreToolUse hook：

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          { "type": "command", "command": ".claude/hooks/guard-rm.sh" }
        ]
      }
    ]
  }
}
```

然後寫這支 hook 腳本。它從標準輸入拿到工具參數，只針對刪除指令做檢查，落在 tmp 才放行：

```bash
#!/usr/bin/env bash
# .claude/hooks/guard-rm.sh
input=$(cat)
cmd=$(echo "$input" | jq -r '.tool_input.command // ""')

# 只攔刪除類指令，其餘一律放行
if ! echo "$cmd" | grep -qE '(^|[[:space:]])rm([[:space:]]|$)'; then
  exit 0
fi

# 刪除目標必須明確落在 tmp/ 底下，否則擋下
if echo "$cmd" | grep -qE '(\.\.|db/migrations|internal/db|\.env|--no-preserve-root)' \
   || ! echo "$cmd" | grep -qE '(^|[[:space:]])(\./)?tmp/'; then
  echo '{"decision":"block","reason":"刪除目標超出 tmp/ 安全範圍，已攔截。請縮小刪除路徑或改由人工執行。"}'
  exit 0
fi

exit 0
```

腳本的邏輯很樸素：不是刪除指令就直接放行，是刪除指令才進一步檢查目標路徑；一旦看到往上退（`..`）、碰到禁改區、或根本沒指向 tmp，就回傳 block，並附一句理由告訴 agent 為什麼被擋。agent 收到 block 後不會硬幹，它會看到理由、調整做法或回來問你。

這裡有個實務細節值得提：hook 的判斷是你寫的程式碼，它不受模型的說服。agent 再怎麼「覺得應該可以刪」，只要腳本回 block，它就是過不了。這正是 enforce 之所以是 enforce 的原因——它不參與辯論。

## 對照概念：這就是 agent 的護欄

把視角拉高，這一層對應的是 agent 設計裡談的護欄，或說安全模式。核心主張很一致：一個能自主行動的系統，光靠「它應該會做對」是不夠的，你得在它與真實世界之間放一道獨立於它判斷之外的防線。

護欄的關鍵字是「獨立」。如果防線本身也是丟給模型去讀、去自我約束的，那它就跟被它守護的對象共享同一個弱點——判斷會出錯。真正的護欄必須在模型之外執行，這樣模型錯了，防線還在。permissions 與 hooks 之所以是唯一擋得下的一層，正是因為它們滿足這個條件：它們是環境在動作發生前跑的檢查，不是模型自己讀的規則。

把 context、invoke、enforce 三層對到常見講法：context 與 invoke 都還在「引導模型做對」的範疇，enforce 才是「就算模型做錯也擋得住」的護欄。回到迴圈的角度，這道護欄就是自動化迴圈的煞車零件：迴圈本身負責「想→動→看→修」，煞車負責在動作真的出手前把越界的那一下攔下來。前四天我們一直在把 AI 教得更聰明、更能幹，今天這一層是承認一件事——再聰明的自主系統，也需要一道它自己關不掉的閘。

## 今日實踐任務

為稍後閱讀工具設一道真正的 enforce 層，目標是擋下危險刪除與寫入禁改區，同時不妨礙日常開發。

1. 在專案 `.claude/settings.json` 的 permissions 裡，把你的禁改區列進 deny（至少含 `.env` 與資料庫 migrations 目錄），把 rm 與 push 列進 ask。
2. 加一支 PreToolUse hook（可直接改上面的 guard-rm.sh），讓落在安全目錄的刪除自動放行、越界的回 block 並附理由。
3. 手動驗收，跑三個情境：
   - 請 agent 刪 tmp 底下一個檔 → 應該順利執行（安全動作放行）。
   - 請 agent 刪一個 tmp 以外的目錄 → 應該被 hook 擋下，並在對話裡看到你寫的攔截理由。
   - 請 agent 寫入 migrations 目錄 → 應該被 permissions 的 deny 直接拒絕。

驗收標準：三個情境的結果，都不取決於當下 agent「想不想聽話」——放行的放行、擋下的擋下，換一次對話重跑一樣。做到這點，你的禁令才第一次真的擋得下來。

## 明天 Day 06

到今天，memory、rules、skills、hooks／permissions 這四塊地基都鋪好了。但這裡藏著一個很多人踩的誤會：把檔案放進 `.claude/` 目錄，不等於 AI 真的讀得到它。目錄裡的東西，哪些會自動進 context、哪些要被檢索或觸發才會被看見，是有邊界的——搞錯了，你會以為某份規則生效了，其實 agent 根本沒讀到。

明天 Day 06 我們把這條 context 邊界釐清，順便把 Day 02 到 05 疊起來，收斂成一個可以直接 clone 的 starter 範本。地基就此收尾。
