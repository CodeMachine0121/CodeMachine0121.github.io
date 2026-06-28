# iThome 2026 鐵人賽系列規劃

> 系列名稱（frontmatter `parent`）：**AI Agent Workflow Patterns：從架構設計到自動化開發協議的 30 天實戰**
> 文章位置：`src/content/blogs/ithome/2026/`
> 發布節奏：每日一篇，`datetime` 從 `2026-06-23`（Day 01）起連續遞增，`Day N = 2026-06-(22+N)`。

## 全系列路線圖（Day 01–30）

### 第一階段：`.claude/` 系統架構與協議基礎（Day 01–07）
| Day | 標題 | 日期 |
|---|---|---|
| 01 | Agent 工程化的定義：為什麼我們需要 Workflow Pattern？ | 2026-06-23 |
| 02 | `.claude/` 目錄協議：打造標準化的 Agent 運作根目錄 | 2026-06-24 |
| 03 | `rules/` 深度剖析：將系統約束編譯為 Agent 的行為準則 | 2026-06-25 |
| 04 | `skills/` 深度剖析：構建原子化、可測試的工具庫原則 | 2026-06-26 |
| 05 | `commands/` 與執行擴充：定義 Agent 的斜線指令協議 | 2026-06-27 |
| 06 | `docs/` 與知識庫：建立 Agent 的「架構大局觀」 | 2026-06-28 |
| 07 | 環境整合：一個完整的 `.claude/` 專案樣板與一鍵初始化實作 | 2026-06-29 |

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
- ✅ Day 01–08 已撰寫完成。
- ⏳ Day 09 起（CoT、ToT…）尚未建檔。

## 撰寫慣例（重點摘要，完整規範見 [`blog-writing-style`](../rules/blog-writing-style.md)）
- **標題層級從 h2（`##`）開始**，子節用 h3（`###`）；正文不寫 h1（標題由模板從 frontmatter `title` 渲染）。
- frontmatter 必填：`title`、`datetime`、`description`、`image`、`parent`。
- 檔名不可含 `/`（會被當成路徑分隔）；標題中的 `rules/`、`docs/` 等斜線只寫在 frontmatter `title`，檔名用無斜線版本。
- 每篇結尾以「明天 Day N＋1」預告銜接，開頭可呼應前一天，維持系列連貫。
- 圖片與 CV 等資產放 Cloudflare R2，不放 `public/`。
