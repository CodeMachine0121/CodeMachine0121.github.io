# iThome 2026 鐵人賽系列規劃

> 系列名稱（frontmatter `parent`）：**AI Agent Workflow Patterns：從架構設計到自動化開發協議的 30 天實戰**
> 文章位置：`src/content/blogs/ithome/2026/`
> 發布節奏：每日一篇，`datetime` 從 `2026-06-23`（Day 01）起連續遞增，`Day N = 2026-06-(22+N)`。

## 全系列路線圖（Day 01–30）

### 第一階段：Claude Code 真實機制與 .claude/ 地基（Day 01–07）
主軸：context（會讀不保證遵守）→ invoke（觸發才載入）→ enforce（只有 hook/permissions 強制）。七天逐日疊加出一個可 clone 的 starter。

| Day | 標題 | 日期 |
|---|---|---|
| 01 | Agent 工程化的起點：從 Prompt 到可複製的執行環境 | 2026-06-23 |
| 02 | CLAUDE.md 與 auto memory：Agent 啟動就讀進的長期記憶 | 2026-06-24 |
| 03 | rules：Agent 的行為準則，以及它「沒有牙齒」的真相 | 2026-06-25 |
| 04 | skills 與 subagents：觸發才載入的能力與分身 | 2026-06-26 |
| 05 | settings 與 hooks：唯一真正擋得下動作的 enforce 層 | 2026-06-27 |
| 06 | docs 與 context 邊界：放進 .claude 不等於讀得到 | 2026-06-28 |
| 07 | 整合：把七天疊加成一個可 clone 的 starter | 2026-06-29 |

### 第二階段：決策、推理與結構化模式（Day 08–14）
| Day | 標題 | 日期 |
|---|---|---|
| 08 | ReAct Pattern：推理與行動交錯的決策循環 | 2026-06-30 |
| 09 | CoT (Chain-of-Thought) Pattern：強制顯式推理的工程實踐 | 2026-07-01 |
| 10 | Tree-of-Thoughts (ToT) Pattern：非線性路徑的探索與分支決策 | 2026-07-02 |
| 11 | Skeleton-of-Thought Pattern：先建構骨架再填充的廣度優先開發 | 2026-07-03 |
| 12 | Reasoning Trace Pattern：建立可審計的決策過程日誌 | 2026-07-04 |
| 13 | Self-Reflection Pattern：引入評估節點的自我優化循環 | 2026-07-05 |
| 14 | Dual-Process Pattern：系統一（直覺）與系統二（深思）的並行架構 | 2026-07-06 |

### 第三階段：協作、博弈與路由模式（Day 15–20）
| Day | 標題 | 日期 |
|---|---|---|
| 15 | Supervisor Pattern：階層式管理與子任務分發（Manager-Worker Model） | 2026-07-07 |
| 16 | Debate Pattern：對抗式生成——透過 Agent 互評減少決策偏差 | 2026-07-08 |
| 17 | Peer Review Pattern：生產者與審核者的流水線檢查機制 | 2026-07-09 |
| 18 | Task Routing Pattern：動態任務調度——依任務複雜度路由至最佳 Agent | 2026-07-10 |
| 19 | Consensus Pattern：多重代理匯總機制（Voting & Aggregation） | 2026-07-11 |
| 20 | Swarm Pattern：分散式代理架構——執行大規模並行任務的邏輯 | 2026-07-12 |

### 第四階段：執行韌性與工程可靠性（Day 21–26）
| Day | 標題 | 日期 |
|---|---|---|
| 21 | Dynamic Skill Injection Pattern：環境感知的技能動態掛載 | 2026-07-13 |
| 22 | Map-Reduce Pattern：針對海量代碼庫的分治與聚合模式 | 2026-07-14 |
| 23 | Fallback Pattern：多層級失敗處理與自動降級協議 | 2026-07-15 |
| 24 | State-Management Pattern：長任務中的持久化上下文儲存策略 | 2026-07-16 |
| 25 | Human-in-the-Loop Pattern：高風險決策的非同步互動與斷點設計 | 2026-07-17 |
| 26 | Context Window Management Pattern：動態滾動記憶與上下文歸納機制 | 2026-07-18 |

### 第五階段：進階實戰與生態優化（Day 27–30）
| Day | 標題 | 日期 |
|---|---|---|
| 27 | Codebase Analysis Pattern：基於知識檢索的代碼執行流 | 2026-07-19 |
| 28 | TDD Workflow Pattern：利用測試案例作為 Agent 的事實規範 | 2026-07-20 |
| 29 | Doc-as-Code Pattern：執行過程中自動同步系統文件的協作模式 | 2026-07-21 |
| 30 | 打造你的 Pattern Language：總結與未來——建立私有 Agent 生態系 | 2026-07-22 |

## 目前進度
- 已完成：Day 01–09。
- 待撰寫：Day 10 起（ToT、Skeleton-of-Thought…）。

## Side Project 練習題（各 Pattern 日）

> 每篇 Pattern 文章的「今日實踐任務」收錄一個「剛好需要該 pattern 才好解」的 side project。Day 08 已寫入文章；Day 09–30 為以下設計，待各篇撰寫時嵌入。

### 第二階段：決策、推理與結構化
- **Day 08 ReAct（已嵌入文章）** — 陌生專案上手助手 `onboarding-scout`：唯讀探索一個沒看過的 repo，摸出技術棧／安裝／啟動／測試；每步動作取決於上一步觀察，逼出 Thought→Action→Observation。
- **Day 09 CoT** — 演算法解題陪練：強制先寫出顯式推導（狀態轉移、邊界、複雜度）再下 code，對照「省略推理」的錯誤率。純推理、不碰環境，與 ReAct 對照。
- **Day 10 ToT** — 重構方案探索器：對一段爛 code 同時展開三條重構路徑，各自評估後選優、回溯淘汰，體現分支與剪枝。
- **Day 11 Skeleton-of-Thought** — 長文／文件產生器：先生成整篇章節骨架，再平行填充各段，對照線性寫法的速度與一致性。
- **Day 12 Reasoning Trace** — 決策日誌型修改助手：每次自動修改都產出可審計的 reasoning trace（為何這樣改、否決了什麼），存成 decision log。
- **Day 13 Self-Reflection** — 自我修訂產生器：產生 → 用 rubric 自評打分 → 修訂，迭代到通過門檻才輸出。
- **Day 14 Dual-Process** — 快慢雙軌問答器：先判斷題目難度，簡單走 System 1 直答、複雜觸發 System 2 深思。

### 第三階段：協作、博弈與路由
- **Day 15 Supervisor** — 多檔案重構指揮官：supervisor 把大重構拆成子任務派給 worker，再彙整驗收。
- **Day 16 Debate** — 技術選型辯論賽：兩個 agent 各持立場辯論（如 SQL vs NoSQL），裁判 agent 總結，降低單一視角偏差。
- **Day 17 Peer Review** — Producer／Reviewer 流水線：一個寫 code、一個專挑錯退回，直到通過。
- **Day 18 Task Routing** — 智慧路由分流：依問題複雜度／類型路由到不同成本的 agent（便宜的處理簡單、貴的處理難題）。
- **Day 19 Consensus** — 多視角投票答題器：同一問題跑 N 個視角，投票取共識並標出分歧。
- **Day 20 Swarm** — 整庫註解蜂群：對整個 repo 並行 fan-out 同一任務（補 docstring／i18n），體驗大規模並行。

### 第四階段：執行韌性與工程可靠性
- **Day 21 Dynamic Skill Injection** — 環境感知裝備器：偵測 repo 型別（Python／Node／Rust）動態掛載對應 skills。
- **Day 22 Map-Reduce** — 全庫安全掃描器：map 階段每檔獨立掃描、reduce 階段彙整成一份報告。
- **Day 23 Fallback** — 韌性呼叫器：主方案失敗逐層降級（貴模型→便宜模型、線上→快取），確保不整個失敗。
- **Day 24 State-Management** — 可續跑批次遷移器：長任務把進度寫入 state 檔，中斷後從斷點續跑。
- **Day 25 Human-in-the-Loop** — 危險操作確認閘：在 rm／migration／deploy 等高風險動作前停下等人確認。
- **Day 26 Context Window Management** — 滾動摘要記憶器：對話超過閾值就把舊內容歸納成摘要塞回，壓縮上下文。

### 第五階段：進階實戰與生態優化
- **Day 27 Codebase Analysis** — Repo 問答機：索引整庫，用檢索回答「X 功能在哪實作、怎麼運作」。
- **Day 28 TDD Workflow** — 紅綠燈 TDD agent：先寫測試（紅）→ 實作到綠 → 重構，測試即事實規範。
- **Day 29 Doc-as-Code** — 文件同步守門員：改了 API 就同步更新 docs／README，CI 檢查不一致即擋。
- **Day 30 Pattern Language（總結）** — 組合技 capstone：挑 2–3 個學過的 pattern 串成你自己的私有 workflow（例如 Supervisor + TDD + Doc-as-Code 的「功能交付流水線」）。

## 撰寫慣例（重點摘要，完整規範見 [`blog-writing-style`](../rules/blog-writing-style.md)）
- **標題層級從 h2（`##`）開始**，子節用 h3（`###`）；正文不寫 h1（標題由模板從 frontmatter `title` 渲染）。
- frontmatter 必填：`title`、`datetime`、`description`、`image`；`parent` 為系列文章專屬（單篇不加）。
- 檔名不可含 `/`（會被當成路徑分隔）；標題中的 `rules/`、`docs/` 等斜線只寫在 frontmatter `title`，檔名用無斜線版本。
- 每篇結尾以「明天 Day N＋1」預告銜接，開頭可呼應前一天，維持系列連貫。
- 圖片與 CV 等資產放 Cloudflare R2，不放 `public/`。
