# iThome 2026 鐵人賽系列規劃

> 系列名稱（frontmatter `parent`）：**2026 ithome-鐵人賽: 從 Prompt 到 Loop：與 Claude Code 協作的自主開發迴圈實戰 系列**
> 文章位置：`src/content/blogs/ithome/2026/`
> 發布節奏：每日一篇，`datetime` 從 `2026-06-23`（Day 01）起連續遞增，`Day N = 2026-06-(22+N)`。

## 系列主軸：從 Prompt Engineering 到 Loop Engineering

這個系列的視角是**開發者本人**，主軸是一個正在發生的轉變：**你的槓桿不再是「怎麼把 prompt 講好」，而是「設計 agent 在裡面跑的迴圈」。** 社群裡已經有人這樣講——Boris Cherny（Claude Code 負責人）說「My job is to write loops」；Peter Steinberger 說「你不該再 prompt coding agent，你該設計會去 prompt agent 的 loop」。

一個 agent 本質上就是一個迴圈：**act → observe → verify → repeat**，直到目標達成。跟它合作的效果，取決於你替它工程化了什麼樣的回饋迴路——回饋多快、多真實、能不能自己收斂、什麼時候該停、由誰驗證。這個系列教的就是**怎麼設計、收緊、自動化這些迴圈**，一路把一個真實 side project 包進一個「能自己跑」的開發迴圈。

學術 pattern 名稱（ReAct、Supervisor、Reflection…）**退為括號註腳**：它們其實都是迴圈技術（ReAct＝最小的 act-observe 迴圈、Reflection／Peer Review＝maker-checker 迴圈、TDD＝紅綠迴圈、Evaluation＝回歸驗證迴圈）。本系列以「你在建哪個迴圈」為主角，pattern 名稱只當讓讀者查得到的對照詞。

全系列由三大 Part 貫穿，一路把迴圈從「內迴圈」擴到「多角色」、再到「自主維運」；驗證（獨立 verifier、回歸、CI 守門）不是獨立一段，而是內建在各 Part 的迴圈裡（Self-Reflection、Peer Review、TDD、Doc-as-Code），到 Day 30 收束成完整的自主迴圈：

| Part | 名稱 | 你在建哪種迴圈 | 天數 |
|---|---|---|---|
| 開篇 | — | 為何從 prompt 走向 loop、認識貫穿的 side project | Day 01 |
| Part 1 | 地基與內迴圈 | 鋪好迴圈的零件（記憶／規則／技能／守門），建立最小的「想→動→看→修」內迴圈 | Day 02–13 |
| Part 2 | 多角色與平行迴圈 | 用 sub-agent 把迴圈擴成生產者—審查者、辯論—裁判、路由—執行，並平行隔離 | Day 14–21 |
| Part 3 | 維運與自主迴圈 | 上線後的恢復／續跑／回饋迴圈，最後用 automations 讓迴圈自己跑、並自我驗證 | Day 22–30 |

## 參考：Loop Engineering 與 Agentic Design Patterns

- **主軸來源｜Loop Engineering。** 本系列主軸取自社群近期的 Loop Engineering 討論（Boris Cherny、Peter Steinberger，以及 Addy Osmani 的整理）。Addy 把一個 loop 拆成六個零件——**State/Memory、Skills、Sub-agents、Connectors/MCP、Guardrails、Automations（/loop、/goal）**——本系列的地基天正是逐一把這些零件建起來（見下「Loop 的零件」對照）。
- **技術詞彙｜Agentic Design Patterns。** 書（`../Agentic-Design-Patterns/`）21 章提供每個迴圈技術的業界定義與判斷條件；本系列把它們當「迴圈技術的詞彙表」，名稱退為括號註腳（對照見文末總表）。

### Loop 的零件 → 在哪幾天建起來
| Loop 零件 | 對應 Day |
|---|---|
| State / Memory（agent 會忘、repo 不會） | Day 02（CLAUDE.md/memory）、Day 23（state 續跑）、Day 25（context 管理） |
| Skills（消除 intent debt） | Day 04 |
| Guardrails | Day 05（hooks/permissions） |
| Sub-agents（maker/checker 分離） | Part 2（Day 14–21）、驗證迴圈（Day 16 Peer Review） |
| Connectors / MCP | Day 21 |
| Worktrees（平行隔離） | Day 19–20（Swarm/Map-Reduce） |
| Automations（/loop、/goal — 迴圈的心臟） | Day 30（自主迴圈 capstone） |

## 貫穿主線：一個真實會上線的 Side Project

全系列用**同一個** side project 當主線，隨天數長大，每個 pattern 都是為了解決這個專案**當下遇到的事**而登場——不是各篇孤立舉例。

> **預設專案（可替換）：** 一個「稍後閱讀 + AI 週報摘要」的**純 Go 後端服務**——使用者透過 API 存文章連結，服務抓取內容、呼叫 LLM 產單篇摘要，每週彙整成一份週報（以 API／Email 輸出，不自帶前端）。它天生同時需要：核心功能開發（Part 1）、交付流水線與審查（Part 2）、上線後維運與收 user feedback／發想新功能（Part 3）。如果你手上有想用的真實專案，換掉名字即可，三大 Part 的結構不變。
>
> **技術棧（Go 後端，全系列一致）：** 語言 Go 1.22+；HTTP 路由 chi（不用 gin／echo）；DB 用 SQLite，driver 用純 Go 的 modernc.org/sqlite（不用需 cgo 的 mattn/go-sqlite3）；查詢層用 sqlc 從 `queries/*.sql` 生成型別安全存取（不用 GORM），**生成的 `internal/db/` 為禁改區**；migration 用 goose（`db/migrations/`）；摘要呼叫 LLM API；測試用 `go test`（表格驅動）。目錄：`cmd/server/`、`internal/{api,service,fetcher,summary,report,db}`、`queries/`、`db/migrations/`。命名走 Go 慣例：package 全小寫、匯出 PascalCase、未匯出 camelCase、不縮寫。

專案生命週期對應三大 Part：

- **Part 1（Day 02–13）— 一人 MVP 起步。** 你獨自用 Claude Code 開發核心功能（存連結、抓內容、單篇摘要）。這階段的重點是**把迴圈的零件鋪好、建起最小的內迴圈**：先備齊環境（記憶／規則／技能／守門），再用推理模式讓 agent「想→動→看→修」踩在真實回饋上。
- **Part 2（Day 14–21）— 功能變多、要加速交付。** 單一 agent 顧不來，你開始用 sub-agent **組裝**流水線（拆派、審查、選型、整庫任務），把交付變成一條可靠的產線。
- **Part 3（Day 22–30）— 上線、有使用者了。** 先站穩維運可靠性（會失敗、會斷、危險操作、context 爆掉），再處理兩條真實主線——**收 user feedback**（彙整、分類、排優先）與**發想新功能**（多視角激盪、決策），最後用 automations（/loop、/goal）把「發現工作→實作→驗證→更新 state」串成能自己跑的自主迴圈。

## 路線圖與逐日內容（Day 01–30）

> 各日標題為情境先行、pattern 當對照（括號內為對照的學術 pattern）。每日區塊含「講什麼／對照書章／Side Project 推進」。全系列為重新設計版本，既有 Day 01–10 舊稿一律視為草稿、將依此重寫。

### 開篇（Day 01）

**Day 01（2026-06-23）— As a developer, 你需要的不是更會聊天的 AI，而是一套可複製的 pattern**
- 講什麼：系列主軸（情境 → pattern → Claude Code 落地）；為何「pattern 思維」比「更會下 prompt」更關鍵；介紹三大 Part（建立／組裝／應用）與全系列的「情境 → pattern」地圖。
- 對照書章：Introduction、What makes an AI system an Agent。
- Side Project：介紹貫穿全系列的專案（稍後閱讀 + AI 週報摘要工具）——它會遇到哪些問題，正好對應後面每一天的 pattern。

### Part 1｜建立 Pattern Setting（Day 02–13）
side project 階段：一人 MVP 起步。主軸：先鋪環境地基，再用推理模式，把「讓 agent 照你的規矩、想清楚再動手」固定成可複製的運作模式。

#### 地基：先把環境建立起來（Day 02–06）

**Day 02（2026-06-24）— AI 每開一次新對話就忘記專案慣例、要你重講？把長期記憶寫進 CLAUDE.md 與 auto memory**
- 講什麼：context 會被讀、但不保證遵守；CLAUDE.md 與 auto memory 是 agent 啟動就載入的長期記憶；哪些該寫進去、哪些不該。
- 對照書章：Ch8 Memory Management（長期／程序記憶）。
- Side Project：建立專案的 CLAUDE.md——框架／套件、慣例、目錄邊界，讓 agent 一開場就對得上。

**Day 03（2026-06-25）— 規則都寫清楚了，AI 讀了卻照樣不做？rules 沒有強制力的真相**
- 講什麼：rules 是行為準則、但屬於「會讀不保證遵守」層；為什麼光靠 rules 擋不下動作；rules 該寫什麼、不能期待它做什麼。
- 對照書章：Ch8 Memory Management（程序記憶）、Ch18 Guardrails / Safety Patterns。
- Side Project：把開發慣例（命名、測試要求、禁改區）寫成 rules，並認清它的極限。

**Day 04（2026-06-26）— 複雜任務每次都要重講一長串？封裝成 skills 與 subagents，觸發才載入**
- 講什麼：skills／subagents 是「觸發才載入的能力與分身」；如何把重複的複雜任務封裝、按需啟動；與工具呼叫、多代理的關係。
- 對照書章：Ch5 Tool Use（Function Calling）、Ch7 Multi-Agent Collaboration。
- Side Project：把「抓網頁內容並產摘要」封裝成一個可重複觸發的 skill／subagent。

**Day 05（2026-06-27）— 有些操作絕對不能讓 AI 自己來？用 settings 與 hooks 設唯一擋得下的 enforce 層**
- 講什麼：hooks／permissions 是唯一真正 enforce（強制）的一層；context／invoke／enforce 三層的分工；如何在關鍵動作前真正攔截。
- 對照書章：Ch18 Guardrails / Safety Patterns。
- Side Project：用 hook／permissions 擋下危險指令（如刪檔、寫入禁改區），只放行安全動作。

**Day 06（2026-06-28）— 檔案放進 .claude/ 不等於 AI 讀得到——釐清 context 邊界，收斂成可 clone 的 starter**
- 講什麼：放進目錄 ≠ 進入 context；docs 與 context 的邊界、什麼時候才會被讀到；把 Day 02–05 疊成一個可一鍵 clone 的 starter。
- 對照書章：Ch8 Memory Management、Ch14 Knowledge Retrieval（何時該檢索才載入）。
- Side Project：整理專案的 .claude/ 結構，輸出成可 clone 的 starter 範本。

#### 推理：讓 agent 想清楚再動手（Day 07–13）

**Day 07（2026-06-29）— 純邏輯題 AI 老是跳步算錯？先逼它把推理攤開再下 code（Chain-of-Thought）**
- 講什麼：CoT 是純內在推理、不碰環境；強制顯式推導（狀態、邊界、複雜度）再產 code；用 prompt chaining 把「推導 → 實作」拆兩步。
- 對照書章：Ch17 Reasoning Techniques（CoT）、Ch1 Prompt Chaining、Appendix A。
- Side Project：設計摘要的去重／排序邏輯——先寫推導再下 code，對照「省略推理」的錯誤率。

**Day 08（2026-06-30）— AI 沒讀檔就動手、憑印象亂猜？用邊查邊做的迴圈逼它踩在證據上（ReAct）**
- 講什麼：Thought → Action → Observation 迴圈；為何加了環境互動就能抗幻覺；用 rule 把「每步引用上一個觀察、設步數上限、證據夠才 Finish」編譯成協議。
- 對照書章：Ch17 Reasoning Techniques（ReAct）、Ch5 Tool Use、Ch6 Planning。
- Side Project：用 ReAct 強化多來源抓取——逼 agent 先探每個來源（有無 RSS？是不是 SPA 要 headless？）再接，每步取決於上一步觀察。

**Day 09（2026-07-01）— 一段爛 code 有好幾種救法、選哪個？讓它展開多路徑評估再回溯（Tree-of-Thoughts）**
- 講什麼：ToT 的分支與剪枝；適用「搜索空間大、需試錯」的問題；各路徑自評分再選優、淘汰劣枝。
- 對照書章：Ch17 Reasoning Techniques（ToT）、Ch21 Exploration and Discovery、Ch6 Planning。
- Side Project：對「單篇該用哪種摘要策略」同時展開三方案，各自評估後選優、回溯淘汰。

**Day 10（2026-07-02）— 要一次生出結構化的大東西、怕越寫越歪？先立骨架再平行填肉（Skeleton-of-Thought）**
- 講什麼：先產整體骨架（端點清單與各層函式簽章）、再平行填充各段實作；對照線性寫法的速度與一致性；與 Planning、Parallelization 的關係。
- 對照書章：Ch6 Planning、Ch3 Parallelization、Ch1 Prompt Chaining。
- Side Project：一次生出整組 API endpoints（links／tags／report 的 handler／service／query 各層）的骨架，確認後再平行填實作，維持跨層與命名一致。

**Day 11（2026-07-03）— AI 改完你卻不知道它為何這樣改？留一份可審計的決策軌跡（Reasoning Trace）**
- 講什麼：把「為何這樣改、否決了什麼」寫成 decision log；與 Evaluation 的 trajectory 評估銜接；用 rule 強制每次修改附軌跡。
- 對照書章：Ch19 Evaluation and Monitoring（軌跡評估）、Ch11 Goal Setting and Monitoring。
- Side Project：每次自動改動都輸出 reasoning trace，存成可回溯的 decision log。

**Day 12（2026-07-04）— 第一版總是差一口氣？加一個評審節點讓它自己修到過關（Self-Reflection）**
- 講什麼：Producer-Critic（生產者／評論者）迴圈；用獨立 persona 避免自評偏誤；設 rubric 與最大迭代次數；成本與 context 膨脹的取捨。
- 對照書章：Ch4 Reflection、Ch11 Goal Setting and Monitoring、Ch9 Learning and Adaptation。
- Side Project：摘要品質「產生 → 用 rubric 自評 → 修訂」，迭代到過門檻才輸出。

**Day 13（2026-07-05）— 小改也動用重推理很浪費？先分難易，該快就快、該深才深（Dual-Process）**
- 講什麼：System 1／System 2 分流；先判斷任務複雜度再選路徑；資源感知（成本／延遲）的取捨；與 Routing 的關係。
- 對照書章：Ch16 Resource-Aware Optimization、Ch2 Routing。
- Side Project：小改字走直答（System 1），加新功能走深思（System 2），先判難易再決定路徑。

### Part 2｜組裝 Composing with Sub-agents（Day 14–21）
side project 階段：功能變多、要加速交付。主軸：用 sub-agent 架構組裝出處理特定任務的 pattern。

**Day 14（2026-07-06）— 大重構散落十幾個檔案、一個 agent 顧不來？主管拆派、工人執行、再驗收（Supervisor / Multi-Agent）**
- 講什麼：Supervisor（Manager-Worker）階層委派；通訊結構光譜（Network／Supervisor／Hierarchical）；子任務切分與彙整驗收。
- 對照書章：Ch7 Multi-Agent Collaboration、Ch15 Inter-Agent Communication（A2A）。
- Side Project：把「加使用者系統」大重構拆成子任務派給 worker，再由 supervisor 彙整驗收。

**Day 15（2026-07-07）— 技術選型舉棋不定、怕一個人想偏？讓兩個 agent 辯論、裁判定案（Debate）**
- 講什麼：對抗式生成降低單一視角偏差；兩方各持立場、裁判總結；與 Exploration 的 generate-debate-evolve 呼應。
- 對照書章：Ch7 Multi-Agent Collaboration（辯論共識）、Ch21 Exploration and Discovery。
- Side Project：SQLite vs Postgres 的儲存層選型辯論，裁判 agent 給出結論與理由。

**Day 16（2026-07-08）— 不敢直接信 agent 寫的 code？架一條寫的人對挑錯的人的產線（Peer Review）**
- 講什麼：Producer／Reviewer 流水線；為何「同一模型兼寫兼審」會失準、必須分離角色並真的跑測試；退回—修正的收斂條件。
- 對照書章：Ch11 Goal Setting and Monitoring（分離角色的警告）、Ch4 Reflection、Ch19 Evaluation and Monitoring。
- Side Project：一個 agent 寫功能、一個專挑錯退回，直到通過驗收。

**Day 17（2026-07-09）— 任務有難有易、全用貴模型太燒？依複雜度分流到合適的 agent（Routing）**
- 講什麼：LLM／embedding／rule-based 路由；先分類意圖與複雜度再導流；成本與品質的平衡。
- 對照書章：Ch2 Routing、Ch16 Resource-Aware Optimization。
- Side Project：小改交便宜 agent、難題交強模型，用路由控成本。

**Day 18（2026-07-10）— 重要決定想多方查核？同題跑多視角投票取共識、標出分歧（Consensus）**
- 講什麼：多視角並行 + 投票／聚合；共識與分歧的呈現；與 Parallelization、多代理交叉驗證的關係。
- 對照書章：Ch7 Multi-Agent Collaboration、Ch3 Parallelization、Ch21 Exploration and Discovery。
- Side Project：對「這個 API 設計」跑 N 個視角，投票取共識並標出分歧點。

**Day 19（2026-07-11）— 整庫規模的重複工（補 i18n／docstring）？放一群分身並行掃過去（Swarm / Parallelization）**
- 講什麼：大規模 fan-out 並行；獨立子任務的切分與匯聚；並行帶來的除錯／日誌／成本複雜度。
- 對照書章：Ch3 Parallelization、Ch7 Multi-Agent Collaboration。
- Side Project：對整個 repo 並行 fan-out 同一任務（補 i18n／docstring）。

**Day 20（2026-07-12）— 海量檔案要逐一分析再收斂成一份報告？map 各檔、reduce 成結論（Map-Reduce）**
- 講什麼：map（每檔獨立處理）→ reduce（彙整成單一結論）；與 Swarm 的差異（強調聚合階段）；控制上下文與成本。
- 對照書章：Ch3 Parallelization、Ch7 Multi-Agent Collaboration。
- Side Project：全庫安全掃描——map 每檔獨立掃、reduce 成一份彙整報告。

**Day 21（2026-07-13）— 不同子目錄要不同裝備、還要接外部工具？用 MCP 與環境感知動態掛能力（Dynamic Skill Injection / MCP）**
- 講什麼：MCP 當「通用轉接頭」動態發現／掛載工具；依 repo 型別注入對應 skills；與 function calling 的差異（開放、可發現、可重用）。
- 對照書章：Ch10 Model Context Protocol（MCP）、Ch5 Tool Use、Ch9 Learning and Adaptation。
- Side Project：前端／後端子目錄各自掛對應 skills，並用 MCP 接檔案系統／資料庫工具。

### Part 3｜應用 Applying in a Real Side Project（Day 22–30）
side project 階段：上線、有使用者。先站穩維運可靠性，再處理兩條主線——**收 user feedback** 與**發想新功能**——最後收束成閉環。

**Day 22（2026-07-14）— 外部服務或模型呼叫會失敗、上線不能整包掛掉？逐層降級的韌性協議（Fallback / Exception Handling）**
- 講什麼：錯誤偵測（逾時／API code）、retry、fallback、graceful degradation、escalation；失敗後用 reflection 改 prompt 重試。
- 對照書章：Ch12 Exception Handling and Recovery、Ch16 Resource-Aware Optimization。
- Side Project：摘要 API 失敗時逐層降級（貴模型 → 便宜模型 → 快取），確保不整個掛。

**Day 23（2026-07-15）— 長批次任務跑到一半斷線？把進度存起來、從斷點續跑（State Management / Memory）**
- 講什麼：短期 vs 長期記憶；把進度持久化成 state、中斷後續跑；session state 的更新與讀取。
- 對照書章：Ch8 Memory Management、Ch11 Goal Setting and Monitoring。
- Side Project：幫舊資料補摘要的長任務把進度寫入 state 檔，中斷後從斷點續跑。

**Day 24（2026-07-16）— deploy、DB migration 這種一步錯就完蛋的動作？在斷點停下等人拍板（Human-in-the-Loop）**
- 講什麼：HITL 的六面向（監督、介入、回饋學習、升級政策…）；Human-on-the-loop 變體；用 hook／permissions 在高風險動作前設閘。
- 對照書章：Ch13 Human-in-the-Loop、Ch18 Guardrails / Safety Patterns。
- Side Project：上線前的危險操作確認閘——deploy／DB migration 前停下等人確認。

**Day 25（2026-07-17）— 長時間維運對話把上下文塞爆？滾動摘要壓縮舊內容再塞回（Context Window Management / Memory）**
- 講什麼：短期記憶＝context window 的壓縮；超過閾值就把舊內容歸納成摘要塞回；語意檢索補長期知識。
- 對照書章：Ch8 Memory Management。
- Side Project：長維運對話超過閾值就滾動摘要，壓縮上下文續談。

**Day 26（2026-07-18）— 專案大到自己都忘記 X 功能在哪、怎麼運作？用檢索式問答讀懂自己的 codebase（Codebase Analysis / RAG）**
- 講什麼：RAG 基礎（embedding、chunking、向量檢索、hybrid）；Agentic RAG（主動驗證來源、拆子查詢、缺資料就用工具）；回答「X 在哪、怎麼運作」。
- 對照書章：Ch14 Knowledge Retrieval（RAG）。
- Side Project：索引整庫做 repo 問答機，回答「某功能在哪實作、怎麼運作」。

**Day 27（2026-07-19）— 上線後湧進一堆雜亂 user feedback？讓 agent 幫你彙整、分類、排出先做什麼（Prioritization）**
- 講什麼：把回饋去重／分群／依緊急度與重要性排序；用 Map-Reduce／Consensus 複用前面的 pattern 做彙整；缺資訊時給合理預設。
- 對照書章：Ch20 Prioritization、Ch3 Parallelization、Ch7 Multi-Agent Collaboration。
- Side Project：把使用者對週報的回饋餵給 agent，輸出「P0／P1／P2」的功能待辦清單。

**Day 28（2026-07-20）— 加新功能怕弄壞舊的？用測試當事實規範跑紅綠燈（TDD Workflow）**
- 講什麼：測試即可驗證的交付規格（contractor 模型）；紅 → 綠 → 重構；用測試/評估把模糊 prompt 轉成明確驗收。
- 對照書章：Ch11 Goal Setting and Monitoring、Ch19 Evaluation and Monitoring、Ch4 Reflection。
- Side Project：從 Day 27 選一個 P0 功能，先寫測試（紅）→ 實作到綠 → 重構。

**Day 29（2026-07-21）— 改了 API、文件卻沒跟上？讓文件隨 code 自動同步、CI 守門（Doc-as-Code）**
- 講什麼：把「改 code → 同步 docs」串成流程；CI 檢查文件與程式不一致即擋；結構化輸出確保可解析。
- 對照書章：Ch19 Evaluation and Monitoring、Ch1 Prompt Chaining。
- Side Project：API 改動就同步更新 docs／README，CI 檢查不一致即擋。

**Day 30（2026-07-22）— 把整條迴圈接起來：一個能自己發現工作、實作、驗證、更新狀態的自主開發迴圈（總結）**
- 講什麼：用 automations（/loop、/goal）把前面所有零件串成一條能自己跑的迴圈——發現工作（收 feedback／排優先）→ 實作（拆派＋填肉）→ **驗證（獨立 verifier／回歸／CI 守門，出錯就擋、模糊升級給人）** → 更新 state → 下一輪。驗證迴圈在這裡閉合，是自主迴圈能放手的前提，不另立番外。呼應開篇「把 side project 包進一個能自己跑的迴圈」的目標，並收在「你要當設計迴圈的工程師，不是按開始鍵的人」。
- 對照書章：Ch20 Prioritization、Ch21 Exploration and Discovery、Ch7 Multi-Agent Collaboration、Ch19 Evaluation and Monitoring、Ch13 Human-in-the-Loop。
- Side Project：把「發現 → 實作 → 驗證 → 更新 state」接成自主迴圈——用真實回饋驅動下一輪功能，且每輪產出都先過自動驗證（測試＋獨立 verifier）才合併，模糊的停下等你拍板。

## 書籍對照總表（Agentic Design Patterns 21 章 → 本系列）

| 書章 | 主要對應 Day |
|---|---|
| Ch1 Prompt Chaining | 07, 10, 29 |
| Ch2 Routing | 13, 17 |
| Ch3 Parallelization | 10, 18, 19, 20, 27 |
| Ch4 Reflection | 12, 16, 28 |
| Ch5 Tool Use (Function Calling) | 04, 08, 21 |
| Ch6 Planning | 08, 09, 10 |
| Ch7 Multi-Agent Collaboration | 04, 14, 15, 18, 30 |
| Ch8 Memory Management | 02, 06, 23, 25 |
| Ch9 Learning and Adaptation | 12, 21 |
| Ch10 Model Context Protocol (MCP) | 21 |
| Ch11 Goal Setting and Monitoring | 11, 12, 16, 23, 28 |
| Ch12 Exception Handling and Recovery | 22 |
| Ch13 Human-in-the-Loop | 24 |
| Ch14 Knowledge Retrieval (RAG) | 06, 26 |
| Ch15 Inter-Agent Communication (A2A) | 14, 18 |
| Ch16 Resource-Aware Optimization | 13, 17, 22 |
| Ch17 Reasoning Techniques | 07, 08, 09 |
| Ch18 Guardrails / Safety Patterns | 03, 05, 24 |
| Ch19 Evaluation and Monitoring | 11, 16, 28, 29 |
| Ch20 Prioritization | 27, 30 |
| Ch21 Exploration and Discovery | 09, 15, 18, 30 |

## 每篇文章骨架（新主軸的統一版式）

Day 02–30 每篇 **MUST** 具備以下區塊（順序可微調，但一個都不能少）：

1. **情境（開場）**：用 side project 當下遇到的一件真事切入——讀者一看就對得上自己的處境。
2. **判斷：該不該用、什麼時候用**：這個場景的判斷條件是什麼？符合哪些訊號才值得動用這個 pattern；什麼時候是殺雞用牛刀。這是「what pattern in what scenario」的核心。
3. **建立 or 組裝**：怎麼用 prompt / rules（Part 1）或 sub-agent 組裝（Part 2）把這個 pattern 固定成可複製的運作模式。
4. **用 Claude Code 落地**：具體的 `.claude/` 設定、rule 檔、subagent 定義或指令，可直接複製。
5. **對照學術 pattern**：點出這對應業界的哪個 pattern（可引用參考書章）、與相鄰 pattern 的差異。
6. **今日實踐任務**：推進**同一個 side project** 的下一步，並附驗收標準。

## 目前進度
- **全系列已重新設計**（本文件為最新版路線圖）。
- **已完成撰稿：Day 01–10**，且已全數轉為**純 Go 後端 side project + Loop Engineering 主軸 + 新系列名**（reader 視角、pattern 名退括號註腳）。已通過驗證：frontmatter 五欄齊全且 `parent` 為新系列名、正文無 h1（僅程式碼區塊內有 #）、無 emoji、無舊技術棧殘留（Bun/Hono/React 等）、每篇有「明天 Day N＋1」預告、side project 時間線連貫。
- 待撰寫：Day 11 起（Reasoning Trace…）到 Day 30。全系列共 30 天，無番外篇。

## 撰寫慣例（重點摘要，完整規範見 [`blog-writing-style`](../rules/blog-writing-style.md)）
- **標題層級從 h2（`##`）開始**，子節用 h3（`###`）；正文不寫 h1（標題由模板從 frontmatter `title` 渲染）。
- frontmatter 必填：`title`、`datetime`、`description`、`image`；`parent` 為系列文章專屬（單篇不加）。
- 檔名不可含 `/`（會被當成路徑分隔）；標題中的 `rules/`、`docs/` 等斜線只寫在 frontmatter `title`，檔名用無斜線版本。
- **標題採情境先行**：以讀者遇到的真實場景開頭，對照的學術 pattern 名稱放句尾括號（如 `…（ReAct）`），不用反引號行內程式碼。
- **情境要對得上真實的 agent 行為**：Claude Code 動手前通常會先掃過當前專案，NEVER 把情境寫成「agent 全忘光、框架／套件全做錯」這種戲劇化但失真的前提。真實的破口在掃描補不上的地方——(1) 早期專案沒前例可照抄；(2) 負向約束與意圖（不要用什麼、不要放哪、之後打算怎麼走）程式碼裡看不到；(3) 掃描是機率性的、會漏看、又要花 token。情境要落在這些真實缺口上，而不是假裝 agent 讀不到擺在眼前的 `package.json`。
- **side project 是一條連續時間線，每天 MUST 接續前一天**：撰寫任一篇前，先確認前後篇實際動了 side project 的哪個功能，本篇的情境與今日任務要接著往下長，NEVER 與其他天撞題（同一功能做兩次）或引用尚未建立的模組。已知時間線：Day 02 存連結 API → Day 03 加「已讀狀態」欄位（產生 migration）→ Day 04 封裝 fetch-and-summarize skill → Day 05 hooks（差點誤刪 migrations）→ Day 06 收斂 starter＋docs → Day 07 週報 dedupeAndRank（去重排序只在這裡）→ Day 08 用 ReAct 強化多來源抓取 → Day 09 重構 HTML 清理函式＋摘要策略 → Day 10 一次生出整組 API endpoints 骨架。適當加入對前一天的回指（如「Day 04 你把 fetch-and-summarize 封裝好」）。全系列 side project 為純 Go 後端（stack 見上「貫穿主線」段），文章內的技術棧、目錄、範例、指令一律用 Go。
- **每篇用 Loop Engineering 當敘事主軸、pattern 名稱退為括號註腳**：開頭與收尾扣著「你今天在建／收緊／自動化哪一個迴圈」，正文以迴圈（act→observe→verify→repeat、maker/checker、紅綠、回歸）為主角；學術 pattern 名稱只放句尾括號當對照，NEVER 當標題主詞或敘事主體。
- **引用他人說法：用 blockquote、原文、標出處、文末列 Reference**。(1) 引用**不要鑲在內文句子裡，用 markdown blockquote（`>`）獨立拉出來**，前一句用內文樸素帶出是誰說的（「X 說過：」「X 是這樣講的：」即可，NEVER 用「有句話講得很到位／一針見血／精闢」這類老套的吹捧修飾）；(2) 引用的文字**只能用原文（例：英文原句），NEVER 自行翻譯**，也不要在引號內加中文翻譯；(3) 文章最後加一個 `## Reference` 標題，用清單列出來源（原文引言 — 作者, 出處標題：URL）。查證出處後才引用，不確定原文就不要當引用寫。
- **避免死語／老套詞**：完整黑名單與替代寫法見文末「[死語黑名單](#死語黑名單)」章節，撰稿前 MUST 先過一遍。
- **內文一律用「範例專案」，NEVER 出現「side project」一詞**：正文提到那個貫穿全系列的專案時，用「範例專案」（或「這個專案」）。本規劃文件內部仍以 side project 指稱無妨，但寫進文章的字一律是「範例專案」。
- **用讀者視角，不要以作者個人經歷當敘事主軸**：這系列是寫給讀者看的教學。NEVER 用「我就經歷過…」「我實測下來…」「今天早上我開了一個新對話」這種第一人稱親身故事當主線。改用第二人稱對讀者說（你會遇到…、你可以…）或中性陳述；情境用「你／假設你」描述，而非「我」。可用「我們」做系列導引（如「昨天我們定了主軸」「明天我們來談」），但不要用單數「我」講親身經歷。（注意：這與單篇 XP 隨筆可用的私人口吻不同，本系列一律採讀者視角。）
- 每篇結尾以「明天 Day N＋1」預告銜接，開頭可呼應前一天，維持系列連貫。
- 圖片與 CV 等資產放 Cloudflare R2，不放 `public/`。

## 死語黑名單

寫給讀者的教學文，NEVER 出現下列陳腔、吹捧或過時流行語。撰稿與定稿前都 MUST 用這張表掃一遍；發現新的就補進來。

| 死語 | 為什麼不用 | 改用（樸素講法） |
|---|---|---|
| 很到位／一針見血／精闢／講得很直接 | 引言前的吹捧修飾，老套 | 直接帶出是誰說的：「X 說過：」「X 是這樣講的：」 |
| 痛點 | PM／行銷 buzzword | 最難的是／最麻煩的是／卡住的地方 |
| 心法 | 武俠味陳腔 | 原則／訣竅／重點 |
| 一鍵 | 行銷用語 | 可直接／一次 |
| 本質上 | 填充語、AI tic | 就是／其實／終究，或直接刪去 |
| 天花板（當「上限」的比喻） | 網路流行語 | 上限／次數上限／明確的次數 |
| 說穿了 | 口頭陳腔 | 其實／換個說法 |
| 倉庫（指 repo） | repo 的直譯，中文「倉庫」是 warehouse，讀來突兀 | 專案／程式碼／檔案（依語境）；或直接寫 repo |
| 上下文（指 context） | 與全系列統一用的英文 context 不一致 | 一律用 context |
| 三令五申／我行我素（及類似老氣成語） | 生硬、老派，不像人在講話 | 白話：規則都寫清楚了／照樣不做 |
| 沒有牙齒／長出牙齒（指強制力） | 生硬的比喻，讀來突兀 | 沒有強制力／擋不下動作／擋得下來 |
| 撞到牆／撞牆／撞上一道牆（指遇到問題） | 生硬的比喻 | 遇到下一個問題／發現走不通 |
| 悶虧（如「這種悶虧很典型」） | 老派口語 | 這種情況並不少見／你大概不陌生 |
| 典型（如「就是典型」「很典型」） | 生硬、翻譯腔 | 就是這樣／剛好符合／並不少見 |
| 講白了／說白了 | 口語填充，與「說穿了」同類 | 其實／簡單說 |
| 洋洋灑灑／將錯就錯／殺雞用牛刀／硬著頭皮（及類似成語） | 成語太老派 | 白話：一口氣列／一路錯到底／小題大作／明知是死路還往下走 |
| 掃興 | 老派口語 | 不太樂觀 |
| 踩坑／踩雷／踩到坑／踩的坑／入坑／避坑／填坑，及「踩到規則」「踩過一次」「踩的誤會」這類 踩＋負面 的用法 | 工程部落格流行語，老套 | 遇到問題／出錯／弄錯的地方／違反規則／遇過一次／會有的誤會（依語境選白話） |

**比喻與擬人一律從嚴**：這系列 NEVER 用擬人化（如「它跑得理直氣壯」）與花俏比喻（如重擲骰子、每天要繳的稅、外接硬碟、閉卷／開卷考、撞牆、沒有牙齒、畫死線）。可以口語，但用直白講法描述事實即可。既有比喻若能用一句白話取代，就取代。（「畫死線」另有毛病：與「死線＝deadline」撞義，讀來突兀。）

> 「踩坑」黑名單的例外：**「踩在（證據／真實回饋／上一個觀察）上」是系列刻意的敘事用語**（ReAct／內迴圈「讓推理踩在證據上，而非踩在想像上」的核心比喻），意思是「立足於」，與「踩坑＝遇到麻煩」完全相反，NEVER 誤刪。同理「踩得住的煞車」「踩得到的閘」也保留。要禁的只有 踩＋負面（坑／雷／誤會）那一類。

> 判斷原則：能用一個樸素、日常的講法表達，就不要用聽起來「很像在下標」或「很像行銷文」的詞。與 [`blog-writing-style`](../rules/blog-writing-style.md) 第 7 條（語氣克制、不要「太 AI」）一致。
