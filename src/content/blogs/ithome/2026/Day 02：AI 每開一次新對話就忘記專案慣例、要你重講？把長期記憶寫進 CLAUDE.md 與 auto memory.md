---
title: "Day 02：AI 每開一次新對話就忘記專案慣例、要你重講？把長期記憶寫進 CLAUDE.md 與 auto memory"
datetime: "2026-06-24"
description: "就算 Claude Code 會先掃過專案，早期沒程式碼可掃、負向約束與你心裡的技術決定它一樣讀不到。把這些關鍵慣例寫進 CLAUDE.md 與 auto memory，變成 agent 啟動就自動載入的長期記憶——但別忘了：context 會被讀，不保證被遵守。"
image: ""
parent: "2026 ithome-鐵人賽: 從 Prompt 到 Loop：與 Claude Code 協作的自主開發迴圈實戰 系列"
---

## 從昨天的專案接著說

昨天定調了整個系列的主軸：與其把時間花在「怎麼把 prompt 下得更完整」，不如建立一套可複製的運作模式，讓 agent 每次都照著你的方式做事。也介紹了要陪我們走三十天的範例專案——一個「稍後閱讀 + AI 週報摘要」的純 Go 後端服務：使用者透過 API 把想之後再看的文章連結存進來，服務負責抓內容、呼叫 LLM 產單篇摘要，每週再彙整成一份週報。

一個 agent 其實就是一個迴圈：想 → 動 → 看 → 修，直到目標達成。而這個迴圈要跑得動，得先有幾個零件到位。今天要建的 CLAUDE.md 與 auto memory，就是其中的第一個零件——迴圈的「State/Memory」。Addy Osmani 是這樣講的：

> The agent forgets, the repo doesn't.

今天做的，就是把該記住的東西從你的嘴裡搬進專案的檔案裡，替後面所有迴圈鋪地基。

## 情境：它其實會先掃專案，卻還是做錯

假設收工前，你已經跟 Claude Code 講好了這個專案的底細：後端用 Go 加 chi 當路由，資料先用 SQLite、driver 挑純 Go 的 `modernc.org/sqlite`，查詢層走 sqlc、migration 用 goose，商業邏輯放 `internal/service/`，抓網頁的爬蟲程式碼集中在 `internal/fetcher/` 不要散出去。它做得很好，把專案骨架搭了起來。

隔天開一個新對話，下一個任務給它：「幫我加一個存連結的 API」。它給的東西往往一半對、一半歪：路由用 chi 沒錯——因為 `go.mod` 裡就有這個 package，它掃一眼就知道。但資料庫它抓了需要 cgo 的 `mattn/go-sqlite3`（甚至直接搬出 GORM），檔案建在自己新開的 `internal/api/` 底下，還把抓連結內容的邏輯順手寫進了 handler。套件錯、目錄錯、邊界也破了。

這裡得先澄清一個常見誤會：Claude Code 這類 coding agent 動手前通常會先掃過當前專案，所以它沒有你想的那麼健忘——寫進程式碼、擺在設定檔裡的事，它讀得到。真正的問題比「失憶」更細，而且掃描補不上：

- **早期根本沒東西可掃。** 這是專案第一支 API，程式碼裡還沒有任何 API 可以讓它照抄慣例；先前只搭了骨架、還沒碰資料庫，所以它面對「該用哪個 SQLite 套件」時無例可循，就滑回網路上最常見的 `mattn/go-sqlite3`。
- **有些決定，程式碼裡看不到。** 「爬蟲一律集中在 `internal/fetcher/`、不要散出去」是一條負向約束；程式碼只記得你做了什麼，記不得你決定不做什麼、打算之後怎麼走。這些意圖與禁令，掃描永遠掃不到。
- **掃描是機率性的，還要花成本。** 就算資訊在程式碼裡，它也是每次重新推導一遍——會抽樣、會漏看，在大一點、風格不一致的 repo 裡甚至讀到互相矛盾的訊號。你每天開的每個對話，它都要重新推導一次，結果不保證一樣，還順便付一次掃描的 token。

換句話說，你以為每天早上是在跟一個記得專案的夥伴協作，實際上比較像跟一個很認真、卻只能靠現場翻程式碼來猜你規矩的新人共事。他翻得不錯，但翻不到的、還沒寫進去的、你心裡才有的那幾條，他只能用最常見的預設去補。而那幾條沒固定下來，你就得每個新對話再交代一次；一天開五六個對話，這就從小麻煩變成每天固定要重講的成本。

## 判斷：什麼該進長期記憶，什麼不該

在動手把東西寫進去之前，先想清楚一件事：不是所有你講過的話都值得變成長期記憶。

值得寫進去的，是那些**穩定、跨對話重複、且一講錯就會連鎖出錯**的資訊——尤其是掃描補不上的那幾類：負向約束（不要用什麼、不要放哪）、還沒被寫進任何檔案的新慣例、以及只存在你腦裡的技術選擇。框架、套件選型、命名慣例、目錄邊界、專案不變的約定都算。這些是 agent 最容易猜錯、猜錯代價又最大的地方——Agent 一但走錯方向，後面所有相關的 code 都得跟著重來。

不該寫進去的，是**只在當下這件任務裡成立的臨時資訊**。「這個 bug 出現在第 42 行」「先幫我把這個函式改成 async」——這些屬於當前對話的 context，任務結束就過期了。把它們塞進長期記憶，只會讓每次啟動載入的內容越來越肥，訊號被雜訊淹沒，真正重要的慣例反而被稀釋掉。

一個好用的判準：問自己「這句話下週開一個全新對話時，還成立嗎？」成立的，是慣例，寫進長期記憶；只在這次成立的，是當下的 context，留在對話裡就好。

還有一件必須先講清楚、否則後面會誤會的事：**長期記憶的本質是「會被讀，但不保證被遵守」。** 把慣例寫進 CLAUDE.md，等於在每次啟動時把它塞進模型的 context，讓模型「看得到」。看得到不等於一定照做——模型仍可能在某次生成裡忽略某條規定。這一層解決的是「它根本不知道」的問題，不是「它明知故犯」的問題。後者要靠別的機制擋，那是後面幾天的主題。今天先把「讓它知道」這件事做扎實。

## 建立：把慣例固定成啟動就載入的記憶

Claude Code 有兩個地方可以放這種長期記憶，各有分工。

第一個是專案根目錄的 `CLAUDE.md`。這是最主要、也最該優先用的。它是純文字的 Markdown 檔，放在專案根目錄下，agent 每次在這個專案啟動時都會自動把它讀進 context。你可以把它想成「專案的入職手冊」——任何新人（或新對話）該先知道的事，都寫在這。它會進 git、跟著 repo 一起被 clone，所以整個團隊共用同一份慣例。

第二個是 auto memory，也就是使用者層級、跨專案的個人記憶。它記的是「你這個人」的偏好，而不是「這個專案」的規定。比如你習慣用繁體中文溝通、你偏好函式先寫測試再實作、你不喜歡過度註解——這些放進個人記憶，之後在任何專案都會生效，不用每個 repo 重講一遍。它不進專案的 git，是你私人的。

分工原則很單純：**跟專案綁定、要團隊共用的，寫 `CLAUDE.md`；跟你個人綁定、跨專案通用的，寫 auto memory。** 前者回答「這個專案怎麼做事」，後者回答「你這個人怎麼做事」。

## 用 Claude Code 落地

先看 `CLAUDE.md` 該長什麼樣。重點不是寫得多，而是寫得準——只放那些「猜錯代價高」的資訊，用結構清楚的段落分好，讓模型一眼能對上。一個好用的骨架是：開頭一句話點明這份檔案是給 Claude Code 的指引，接著依序放 Project（這是什麼）、Tech Stack（用什麼、不用什麼）、Conventions（命名與慣例）、Commands（常用指令）、Layout（目錄結構）。以我們的範例專案為例：

```markdown
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**稍後閱讀 + AI 週報摘要（後端服務）** — 一個 Go 後端 API：使用者透過 API 存文章連結，服務抓取內容、呼叫 LLM 產單篇摘要，每週彙整成週報（API／Email 輸出，無前端）。目前是一人開發的 MVP。

## Tech Stack

- 語言：Go 1.22+
- HTTP 路由：chi（不要用 gin／echo）
- DB：SQLite，driver 用 modernc.org/sqlite（純 Go，不要用需 cgo 的 mattn/go-sqlite3）
- 查詢層：sqlc，從 queries/*.sql 生成；生成的 internal/db/ 不准手改（要改改 queries 再 sqlc generate，不要用 GORM）
- Migration：goose，SQL 放 db/migrations/
- 摘要：呼叫 LLM API

## Conventions

- package 全小寫單字；檔名小寫、多字用底線（article_service.go）
- 匯出識別字 PascalCase、未匯出 camelCase；不縮寫
- 錯誤明確回傳 error，不 panic；每個 service 函式附表格驅動測試

## Directory Boundaries

- internal/api/ — 只放 chi 路由與 handler，邏輯往 service 呼叫
- internal/service/ — 商業邏輯
- internal/fetcher/ — 抓網頁內容一律集中在此
- internal/db/ — sqlc 生成產物，NEVER 手改
- db/migrations/ — goose migration，schema 變更用新增 migration

## Commands

- go run ./cmd/server — 啟動服務
- go test ./... — 跑全部測試
- sqlc generate — 從 queries/ 重生存取層

## Layout

.
├── cmd/server/main.go
├── internal/{api,service,fetcher,summary,report,db}/
├── queries/        # sqlc SQL 來源
└── db/migrations/  # goose migration
```

幾個寫法上的重點：

第一，**每條規定盡量帶上「不要做什麼」。** 「用 chi」不如「用 chi，不要用 gin／echo」。模型的預設傾向是往最常見的寫法走（gin、GORM、`mattn/go-sqlite3` 都是網路上最多的），得明確把那條預設路徑堵起來，它才不會滑回去。

第二，**目錄邊界要講清楚「什麼放哪、什麼不放哪」。** 這通常是最有效的一段。只要把 `internal/fetcher/` 的邊界寫死，它就不會再把爬蟲邏輯亂塞進 handler 裡；把 `internal/db/` 標成禁改區，它就不會去動 sqlc 生成的檔案。

第三，**別把它寫成長篇大論。** CLAUDE.md 每次啟動都會佔用 context，寫太多反而稀釋重點、也吃掉可用的 context 空間。一個 MVP 階段的專案，這份檔案控制在幾十行就夠了。之後真的踩到重複的坑，再補上去。

至於 auto memory，用法更輕。在對話裡直接告訴 Claude Code「請記住：我習慣用繁體中文溝通、函式先寫測試再實作」，它就會把這條偏好寫進你的個人記憶檔，之後跨專案都生效。你不用手動去編輯檔案，用自然語言講一次即可；要調整或刪除時，同樣用一句話請它更新。這一層適合放那些「你懶得每次重講、但又跟特定專案無關」的個人習慣。

## 對照概念：這是迴圈的 State/Memory 零件

把鏡頭拉遠一點，今天做的事其實是在替 agent 的迴圈裝上第一個零件：State/Memory。

一個迴圈要能一天天跑下去、而不是每個新對話都從零開始，靠的就是這個零件把「這個專案怎麼做事」持久化下來。LLM 本身沒有記憶，它每次推理都只看得到當下 context 裡的東西；要讓迴圈跨越單次對話還記得規矩，就得在外面補上記憶層。業界會把記憶分成幾種：短期記憶是當前這段對話的 context，任務結束就散；長期記憶是跨越單次對話、持久保存的知識；其中還有一類叫程序記憶（procedural memory），記的是「做這件事該遵循的規則與流程」。

CLAUDE.md 與 auto memory 正是長期記憶與程序記憶在 Claude Code 裡的具體落地——它們把程序性知識持久化，讓 agent 每次啟動都能重新載入，不必每次都靠你重講一遍。這正是開頭那句話的意思——agent 每次都會忘，但只要寫進專案裡，它每次啟動就能重新載入。今天的做法並不高深，只是把迴圈的第一個零件用最基本的方式補齊；接下來幾天，我們會一個一個把其餘的零件（rules、skills、hooks／permissions）也裝上去。

## 今日實踐任務

用 Claude Code 替你的專案建立 `CLAUDE.md`，至少涵蓋三塊：

1. **框架／套件**：語言版本、HTTP 路由、資料庫 driver、查詢層與 migration 工具，每條盡量帶上「不要用什麼」（如 chi 不用 gin、`modernc.org/sqlite` 不用 `mattn/go-sqlite3`、sqlc 不用 GORM）。
2. **命名慣例**：package、檔名、匯出／未匯出識別字的大小寫規則。
3. **目錄邊界**：哪個目錄放什麼、什麼不該放進去（尤其標出 `internal/db/` 這類禁改區）。

另外，挑一到兩條「跟專案無關、但你每次都想講」的個人習慣，用一句話請 Claude Code 寫進 auto memory。

驗收標準：

- 開一個**全新對話**，直接下一個具體任務（例如「幫我加一個存連結的 API」），不再口頭複述任何慣例。
- 檢查它產出的 code：路由用的是不是 chi、SQLite driver 有沒有選 `modernc.org/sqlite`（而非 `mattn/go-sqlite3` 或 GORM）、檔案有沒有放進正確的目錄。
- 若某條慣例它還是沒照做，回頭看 CLAUDE.md 那條寫得夠不夠明確（尤其有沒有堵住預設路徑），改到它願意讀懂為止。

做完你會發現一件很實在的事：早上那五分鐘的「重新自我介紹」不見了。這就是把記憶從你的嘴裡搬進檔案的直接回報。

## 明天 Day 03

不過，光把規矩寫進記憶，還不足以讓 agent 乖乖聽話。你一定遇過這種事：慣例明明寫得清清楚楚，它讀了、也點頭了，下一步照樣北爛。明天我們來談 rules——專門寫行為準則的地方。它能告訴 agent 該怎麼做，卻擋不下它不該做的動作。搞懂這個，你才知道哪些事不能只靠寫規則來期待。

## Reference

- "The agent forgets, the repo doesn't." — Addy Osmani, "Loop Engineering"：https://addyosmani.com/blog/loop-engineering/
