# iThome 2026 鐵人賽系列規劃

> 系列名稱（frontmatter `parent`）：**AI Agent Workflow Patterns：從架構設計到自動化開發協議的 30 天實戰**
> 文章位置：`src/content/blogs/ithome/2026/`
> 發布節奏：每日一篇，`datetime` 從 `2026-06-23`（Day 01）起連續遞增，`Day N = 2026-06-(22+N)`。

## 系列主軸：As a developer, what pattern in what scenario？

這個系列的視角是**開發者本人**，不是 pattern 百科。每一篇的問句都是同一個：
**「我在開發時遇到這件事，這時候該拿出哪個 pattern，用 Claude Code 怎麼落地？」**

所以每篇都是**情境先行**：讀者帶著一個真實問題進來（「AI 沒讀檔就開始瞎猜」「大重構跨十幾個檔案」「上線後湧進一堆 user feedback」），文章回答「這個場景該用哪個模式」。學術 pattern 名稱（ReAct、Supervisor…）**保留當對照詞彙**，讓讀者查得到業界術語，但不再當主角。

全系列由三大 Part 貫穿，對應「打造並套用自己的 Agent 運作模式」的三個層次（地基已併入 Part 1，因為那些機制正是用來「建立」pattern 的工具）：

| Part | 名稱 | 核心問題 | 天數 |
|---|---|---|---|
| 開篇 | — | 為何要用 pattern 思維、認識貫穿的 side project | Day 01 |
| Part 1 | 建立 Pattern Setting | 用 Claude Code 機制（記憶／規則／技能／守門）＋推理模式，把運作模式固定成可複製 | Day 02–13 |
| Part 2 | 組裝 Composing with Sub-agents | 單一 agent 不夠時，用分身組合出處理特定任務的 pattern | Day 14–21 |
| Part 3 | 應用 Applying in a Real Side Project | 在真實、有使用者的專案裡套用——維運、收回饋、發想 | Day 22–30 |
| Part 4 | 驗證 The Self-Verifying Project（番外篇） | 用 agent 自動、持續替專案驗證，出錯就擋下 | Day 31–34 |

## 參考書籍：Agentic Design Patterns

本系列的 pattern 設計以 *Agentic Design Patterns*（`../Agentic-Design-Patterns/`）的 21 個章節為對照骨幹。做法是：**書提供業界通用的 pattern 定義與判斷條件，本系列把它翻譯成「開發者情境 + Claude Code 落地」**。全系列已覆蓋書中全部 21 個 pattern（對照見文末「書籍對照總表」）。特別值得一提：書中 Ch20 Prioritization 與 Ch21 Exploration and Discovery 幾乎正好對應 Part 3 的兩條主線——**處理 user feedback（排優先）**與**發想新功能（探索）**。

## 貫穿主線：一個真實會上線的 Side Project

全系列用**同一個** side project 當主線，隨天數長大，每個 pattern 都是為了解決這個專案**當下遇到的事**而登場——不是各篇孤立舉例。

> **預設專案（可替換）：** 一個「稍後閱讀 + AI 週報摘要」的小型 web 工具——使用者存文章連結，agent 抓內容、產單篇摘要，每週彙整成一份週報。它天生同時需要：核心功能開發（Part 1）、交付流水線與審查（Part 2）、上線後維運與收 user feedback／發想新功能（Part 3）。如果你手上有想用的真實專案，換掉名字即可，三大 Part 的結構不變。

專案生命週期對應三大 Part：

- **Part 1（Day 02–13）— 一人 MVP 起步。** 你獨自用 Claude Code 開發核心功能（存連結、抓內容、單篇摘要）。這階段的重點是**建立你自己的開發 pattern**：先把環境（記憶／規則／技能／守門）鋪好，再用推理模式讓 agent「想清楚再動手」，留下可複製的運作模式。
- **Part 2（Day 14–21）— 功能變多、要加速交付。** 單一 agent 顧不來，你開始用 sub-agent **組裝**流水線（拆派、審查、選型、整庫任務），把交付變成一條可靠的產線。
- **Part 3（Day 22–30）— 上線、有使用者了。** 先站穩維運可靠性（會失敗、會斷、危險操作、context 爆掉），再處理兩條真實主線——**收 user feedback**（彙整、分類、排優先）與**發想新功能**（多視角激盪、決策），最後把三部組成你自己的私有 workflow 閉環。
- **Part 4（Day 31–34，番外篇）— 讓專案自己會驗證。** 正賽收工後的加碼：當開發與交付都交給 agent，怎麼相信成果？再用 agent 建一層自動、持續的驗證，並在出錯時擋下來。

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

**Day 03（2026-06-25）— 你三令五申、它卻照樣我行我素？認識 rules 與它「沒有牙齒」的真相**
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
- Side Project：搭「抓網頁內容」模組——逼 agent 先探（有無 RSS？需不需要 headless？）再動手，每步取決於上一步觀察。

**Day 09（2026-07-01）— 一段爛 code 有好幾種救法、選哪個？讓它展開多路徑評估再回溯（Tree-of-Thoughts）**
- 講什麼：ToT 的分支與剪枝；適用「搜索空間大、需試錯」的問題；各路徑自評分再選優、淘汰劣枝。
- 對照書章：Ch17 Reasoning Techniques（ToT）、Ch21 Exploration and Discovery、Ch6 Planning。
- Side Project：對「單篇該用哪種摘要策略」同時展開三方案，各自評估後選優、回溯淘汰。

**Day 10（2026-07-02）— 要一次生出結構化的大東西、怕越寫越歪？先立骨架再平行填肉（Skeleton-of-Thought）**
- 講什麼：先產整體骨架（章節／元件）、再平行填充各段；對照線性寫法的速度與一致性；與 Planning、Parallelization 的關係。
- 對照書章：Ch6 Planning、Ch3 Parallelization、Ch1 Prompt Chaining。
- Side Project：一次生出多頁 UI 的骨架再平行填內容，維持整體結構一致。

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

**Day 30（2026-07-22）— 把學到的組成你自己的私有 workflow：從收回饋、發想到交付的閉環（Pattern Language 總結）**
- 講什麼：把前面的 pattern 組成一條私有 workflow——收 feedback（排優先）→ 發想（探索）→ 交付（拆派＋審查＋TDD）→ 收尾（Doc-as-Code）；如何挑選與串接 pattern。
- 對照書章：Ch20 Prioritization、Ch21 Exploration and Discovery、Ch7 Multi-Agent Collaboration。
- Side Project：用真實回饋驅動下一輪功能，把三部串成「回饋 → 發想 → 交付」的閉環 capstone。

### Part 4｜驗證 The Self-Verifying Project（番外篇，Day 31–34）
side project 階段：正賽收工後的加碼。當開發與交付都交給 agent，怎麼相信成果？答案是再用 agent 建一層自動、持續的驗證。這一段複用並升級 Reasoning Trace（Day 12）、Self-Reflection（Day 13）、Peer Review（Day 16）、TDD（Day 28），把驗證變成專案常駐、自動、有升級機制的基礎設施。標題一律以「(番外篇)」為前綴，parent 維持與正賽相同。

**(番外篇) Day 31（2026-07-23）— 全交給 agent 開發後，你怎麼相信它沒搞砸？先決定要驗什麼、哪些自動、哪些留給人**
- 講什麼：驗證分層（語法 → 測試 → 行為 → 契約 → 回歸）；哪一層值得自動化、哪一層該升級給人；建立整個 Part 4 的地圖與判斷準則。
- 對照書章：Ch19 Evaluation and Monitoring、Ch18 Guardrails / Safety Patterns、Ch11 Goal Setting and Monitoring。
- Side Project：替稍後閱讀工具盤點「要驗什麼」——摘要品質、抓取正確性、API 契約、回歸範圍，並排出哪些自動、哪些留給人。

**(番外篇) Day 32（2026-07-24）— 怎麼抓出「看起來對、其實錯」的改動？派一群 agent 專門想辦法推翻它**
- 講什麼：對抗式驗證——多個懷疑者 agent 各自試圖推翻這次改動，預設「有疑慮就當推翻」，多數推翻就擋下；對治單一 reviewer 的過度自信（延伸自 Day 16 Peer Review）。
- 對照書章：Ch7 Multi-Agent Collaboration、Ch19 Evaluation and Monitoring。
- Side Project：對一次「摘要邏輯重構」派三個懷疑者 agent，分別從正確性／邊界／回歸角度找它破壞了什麼，多數推翻就退回。

**(番外篇) Day 33（2026-07-25）— 改一個地方、悄悄弄壞另一個？把關鍵行為變成 agent 每次自動跑的評估集**
- 講什麼：評估集 + LLM-as-Judge——把專案關鍵行為做成可回歸的 eval set，每次改動後 agent 自動跑分、比對基準、抓行為漂移；為何用語意評分而非精確比對，基準怎麼定。
- 對照書章：Ch19 Evaluation and Monitoring（正式登場）、Ch11 Goal Setting and Monitoring。
- Side Project：建一組「代表性文章 → 期望摘要特徵」的評估集，每次改摘要邏輯就自動跑分，低於門檻即警示。

**(番外篇) Day 34（2026-07-26）— 驗證不該靠你記得跑：把 agent 守門接進 CI 與 hook，失敗擋下、模糊升級，收束成自我驗證閉環**
- 講什麼：把前三章接進 pre-commit／CI hook，變成專案的自動化基礎設施；失敗擋下合併、模糊案例升級給人；作為 Part 4 與全系列的驗證閉環總結。
- 對照書章：Ch18 Guardrails / Safety Patterns、Ch13 Human-in-the-Loop、Ch5 Tool Use。
- Side Project：把 code review＋評估集接進 CI／pre-commit，PR 沒過自動驗證就擋，模糊的通知你決定，形成「改動 → 自動驗證 → 合併」的閉環。

## 書籍對照總表（Agentic Design Patterns 21 章 → 本系列）

| 書章 | 主要對應 Day |
|---|---|
| Ch1 Prompt Chaining | 07, 10, 29 |
| Ch2 Routing | 13, 17 |
| Ch3 Parallelization | 10, 18, 19, 20, 27 |
| Ch4 Reflection | 12, 16, 28 |
| Ch5 Tool Use (Function Calling) | 04, 08, 21, 34 |
| Ch6 Planning | 08, 09, 10 |
| Ch7 Multi-Agent Collaboration | 04, 14, 15, 18, 30, 32 |
| Ch8 Memory Management | 02, 06, 23, 25 |
| Ch9 Learning and Adaptation | 12, 21 |
| Ch10 Model Context Protocol (MCP) | 21 |
| Ch11 Goal Setting and Monitoring | 11, 12, 16, 23, 28, 31, 33 |
| Ch12 Exception Handling and Recovery | 22 |
| Ch13 Human-in-the-Loop | 24, 34 |
| Ch14 Knowledge Retrieval (RAG) | 06, 26 |
| Ch15 Inter-Agent Communication (A2A) | 14, 18 |
| Ch16 Resource-Aware Optimization | 13, 17, 22 |
| Ch17 Reasoning Techniques | 07, 08, 09 |
| Ch18 Guardrails / Safety Patterns | 03, 05, 24, 31, 34 |
| Ch19 Evaluation and Monitoring | 11, 16, 28, 29, 31, 32, 33 |
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
- **已完成撰稿：Day 01–10**（依新版情境先行框架打掉重練，舊稿已刪除）。已通過驗證：frontmatter 五欄齊全、正文無 h1（僅程式碼區塊內有 #）、無 emoji、每篇有「明天 Day N＋1」預告、系列連貫。
- 待撰寫：Day 11 起（Reasoning Trace…），以及新增的 Part 4 番外篇（Day 31–34，自動化驗證）。

## 撰寫慣例（重點摘要，完整規範見 [`blog-writing-style`](../rules/blog-writing-style.md)）
- **標題層級從 h2（`##`）開始**，子節用 h3（`###`）；正文不寫 h1（標題由模板從 frontmatter `title` 渲染）。
- frontmatter 必填：`title`、`datetime`、`description`、`image`；`parent` 為系列文章專屬（單篇不加）。
- 檔名不可含 `/`（會被當成路徑分隔）；標題中的 `rules/`、`docs/` 等斜線只寫在 frontmatter `title`，檔名用無斜線版本。
- **標題採情境先行**：以讀者遇到的真實場景開頭，對照的學術 pattern 名稱放句尾括號（如 `…（ReAct）`），不用反引號行內程式碼。
- **番外篇（Part 4，Day 31–34）標題最前面加「(番外篇)」前綴**（例：`(番外篇) Day 31：全交給 agent 開發後…`）；`parent` 維持與正賽完全相同，不另建系列。
- **情境要對得上真實的 agent 行為**：Claude Code 動手前通常會先掃過當前專案，NEVER 把情境寫成「agent 全忘光、框架／套件全做錯」這種戲劇化但失真的前提。真實的破口在掃描補不上的地方——(1) 早期專案沒前例可照抄；(2) 負向約束與意圖（不要用什麼、不要放哪、之後打算怎麼走）程式碼裡看不到；(3) 掃描是機率性的、會漏看、又要花 token。情境要落在這些真實缺口上，而不是假裝 agent 讀不到擺在眼前的 `package.json`。
- 每篇結尾以「明天 Day N＋1」預告銜接，開頭可呼應前一天，維持系列連貫。
- 圖片與 CV 等資產放 Cloudflare R2，不放 `public/`。
