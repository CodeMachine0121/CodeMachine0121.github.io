---
title: "Day 10：要一次生出結構化的大東西、怕越寫越歪？先立骨架再平行填肉（Skeleton-of-Thought）"
datetime: "2026-07-02"
description: "要 agent 一口氣生出結構性強的大東西，線性寫到後面常常前後不一致、越寫越歪。這篇講清楚 Skeleton-of-Thought：為什麼「先立骨架、再平行填肉」能穩住一致性，它和「先規劃再執行」「平行化」的本質差異在哪，並在範例專案用它一次生出整組 API endpoints 的骨架。"
image: ""
parent: "2026 ithome-鐵人賽: 從 Prompt 到 Loop：與 Claude Code 協作的自主開發迴圈實戰 系列"
draft: true
---

## 越寫越歪的那個下午

過去這三天，我們一路在談 agent「怎麼想」。Chain-of-Thought 是讓它把步驟攤開來想；ReAct 是想一步、動一步、再看結果修正；昨天的 Tree-of-Thoughts 則是同時展開好幾條路徑，最後選一條最好的走。推理三連到這裡告一段落，三種都在解「思考」的問題。但有一種痛，跟「怎麼想」關係不大，跟「怎麼一次產出一個結構化的大東西」關係很大。

假設你要一次替稍後閱讀工具加上一整組 API endpoints：links 的一整套 CRUD（建立、列出、取得、更新已讀狀態、刪除），再加 tags、report 幾組資源。每一組都要跨三層——`internal/api` 的 handler、`internal/service` 的商業邏輯、`queries/` 的 sqlc 查詢。你很自然地丟了一句「把這幾組 endpoints 生出來」。agent 開始寫，links 那組寫得挺好，tags 也還行。可是寫到 report 的時候，你會發現它的 service 函式簽章跟前面兩組對不上；錯誤處理有的回 `error`、有的自己包了一層自訂型別；DTO 在 handler 跟 service 各定義了一份長得很像卻不完全一樣的 struct；命名也飄了，前面叫 `CreateLink`，後面變成 `AddReport`。等它全部寫完，你拿到的是幾組「各自都能編譯、湊在一起像好幾個人寫的」程式碼。

這跟人熬夜趕一份長文件很像：寫到第五章，你其實已經不太記得第一章用了哪些詞，於是同一個概念換了三種叫法。

這不是它笨。這是「一邊生成一邊決定結構」這種寫法本身的毛病。今天要建的是一種輕度 loop：先把大結構的骨架穩住，再讓多條填肉迴圈平行跑。先立骨架，確認結構，再平行填肉。

## 為什麼線性生成大東西會越寫越歪

模型在生成長內容時，是一個 token 接一個 token 往下續的。它每寫一段，能參考的就是「已經寫出來的前文，加上你的指令」。麻煩在於，很多結構性的決策——整組資源要分幾層、每層負責什麼、函式簽章長什麼樣、錯誤怎麼往上傳、DTO 由誰定義、命名規則是什麼——是在它寫到第一組 endpoints 的時候就順手定下的，而且從來沒被明確寫出來過，只是隱含在它已生成的程式碼裡。

於是兩件事開始累積誤差。第一，結構是「邊寫邊長出來的」，不是先想好的。它寫到第三組才發現前面的分層切法不太一致，但已經回不去了，只能沿著錯的往下接。第二，越往後，它要同時兼顧的前文越長，一致性的維護成本越高，注意力被稀釋，前面立的規矩就慢慢守不住——handler 呼叫 service 的方式、service 回傳的錯誤型別，一組一個樣。

關鍵的體悟就在這裡：一致性最好的保證，是讓所有部分共用同一份「已經確定、而且明確寫出來的」結構，而不是指望模型在漫長的線性生成裡自己記著。既然如此，那就把結構這件事，從實作生成裡抽出來、先單獨做完。

## 判斷：什麼時候該用、什麼時候不必

三個訊號同時成立才划算：產出「大」、結構性「強」、各段可「獨立填」。判斷那把尺很樸素：這東西大到你會怕它寫到後面對不上自己嗎？

一次生多組 endpoints 剛好符合——它大（三組資源、跨三層）、結構性強（每組都吃同一套分層與錯誤處理慣例）、各段可獨立填（links 的 service 實作跟 tags 的 service 實作互不干涉）。一份長規格、一組 migration＋query＋handler，也都吃這一套。

反過來，如果你要的東西又短又單一，比方說「幫這個 HTML 清理函式補個錯誤處理」（就是 Day 09 動過的那個），那就直接寫，硬要它先產一份骨架只是多繞一圈。還有一種反例要特別小心：如果一段內容的寫法會強烈牽動另一段（例如某個 service 的資料結構決定了另一個 service 怎麼寫），那就不是「可獨立填」，硬拆平行反而出事。

## 建立：先產骨架，確認後再填肉

方法本身只有三步：

第一步，只要骨架，不要內容。讓它先交出整體結構——有哪些 endpoints、每組跨哪幾層、每層的函式簽章長什麼樣、共用哪些 interface 與型別、命名怎麼定，先不要碰任何實作，函式一律留空 body 或只放 `// TODO`。

第二步，也是最重要的一步：你先確認並鎖定骨架，再讓它往下走。骨架階段的錯改起來便宜——改一行簽章而已；等三層實作都長滿再改函式簽章，等於整組重寫。

第三步，骨架定案後各段平行填。因為簽章與共用型別已經是共識，分開生成也不會漂走，順帶把速度賺回來。

顯性化正是它比「一次寫完」強的地方：過去「先想分層與簽章」這件事你在腦子裡做，現在你要求 agent 把「骨架」這個中間產物明確交出來，讓它能被檢查、確認，並當成後續平行工作的共同依據。

## 用 Claude Code 落地

### 第一步：讓它只產骨架

骨架用 Go 直接表示——handler 與 service 的函式簽章、共用 interface 與 DTO，全部留空 body。

```
你是這個範例專案（稍後閱讀 + AI 週報摘要工具，純 Go 後端）的 API 架構者。
現在只做一件事：產出整組 endpoints 的骨架，NEVER 寫任何實作。

技術棧固定：Go 1.22+、chi 路由、sqlc（queries/*.sql）、service 層放商業邏輯。
資源範圍：links（Create/List/Get/UpdateReadStatus/Delete）、tags（Create/List/Delete）、report（Generate/Get）。

請輸出以下三塊，全部只給簽章、不給實作：

1. 端點清單：METHOD 路徑 → 對應的 handler 函式名，逐條列出。
2. 各層函式簽章（Go 程式碼，body 留 // TODO）：
   - internal/api：每個 handler 的簽章。
   - internal/service：每個 service 方法的簽章，含它依賴的 store interface。
   - queries：每個 sqlc query 的名稱與輸入/輸出（用 -- name: 註解形式）。
3. 全域約束：
   - 共用型別（DTO / 請求 / 回應 struct）一次定死，跨資源共用者只定義一份。
   - 錯誤處理慣例（service 一律回 error、handler 統一怎麼轉 HTTP status）。
   - 命名規則（動詞用 Create/List/Get/Update/Delete，不用 Add/Fetch 等同義詞飄移）。

現在只輸出骨架與全域約束，NEVER 填任何函式 body。
```

你會拿回類似這樣的骨架（節錄 links 一組），重點是簽章對齊、共用 interface 一份定死：

```go
// internal/service/links.go
type LinkStore interface {
    CreateLink(ctx context.Context, arg CreateLinkParams) (Link, error)
    ListLinks(ctx context.Context) ([]Link, error)
    GetLink(ctx context.Context, id int64) (Link, error)
    UpdateLinkReadStatus(ctx context.Context, arg UpdateReadStatusParams) (Link, error)
    DeleteLink(ctx context.Context, id int64) error
}

type LinkService struct {
    store LinkStore
}

func (s *LinkService) Create(ctx context.Context, in CreateLinkInput) (LinkDTO, error)          // TODO
func (s *LinkService) List(ctx context.Context) ([]LinkDTO, error)                               // TODO
func (s *LinkService) Get(ctx context.Context, id int64) (LinkDTO, error)                        // TODO
func (s *LinkService) UpdateReadStatus(ctx context.Context, id int64, read bool) (LinkDTO, error) // TODO
func (s *LinkService) Delete(ctx context.Context, id int64) error                                // TODO

// internal/api/links.go
func (h *Handler) CreateLink(w http.ResponseWriter, r *http.Request)          // TODO
func (h *Handler) ListLinks(w http.ResponseWriter, r *http.Request)           // TODO
func (h *Handler) GetLink(w http.ResponseWriter, r *http.Request)             // TODO
func (h *Handler) UpdateLinkReadStatus(w http.ResponseWriter, r *http.Request) // TODO
func (h *Handler) DeleteLink(w http.ResponseWriter, r *http.Request)          // TODO
```

tags 與 report 兩組照同一份約束展開，動詞與分層一致，DTO 共用同一份定義。

### 第二步：你確認並鎖定骨架

拿到骨架，花兩分鐘：檢查三組資源的 service 簽章形狀是不是對稱（都吃 `ctx`、都回 `(DTO, error)`）；檢查共用型別有沒有被重複定義；檢查命名有沒有混用同義動詞。把改好的骨架貼回去，明確說一句：骨架就定這樣，接下來所有實作 MUST 遵守這份簽章與全域約束，NEVER 新增或改名共用型別、NEVER 改動任何函式簽章。

這一步千萬別省。第二步沒真的鎖定，後面平行填肉就等於各寫各的。

### 第三步：平行填肉（用 subagent 分派）

```
骨架已鎖定（就是上一步你確認並貼回的那份骨架簽章與全域約束）。現在平行填肉。
請為以下每組資源各派一個 subagent，同時進行：links、tags、report。

每個 subagent 的輸入固定為兩塊：
1. 全域約束（共用型別 / 錯誤處理慣例 / 命名規則）——原文照抄，NEVER 改動。
2. 該組資源的骨架簽章（handler + service + queries）。

每個 subagent 的產出要求：
- 只實作自己那一組，其他組不要碰。
- 共用型別一律 import 既有定義，NEVER 自己重新宣告或改名。
- 函式簽章 NEVER 更動，只填 body。
- service 一律回 error、handler 依約定轉 HTTP status，不得自創錯誤風格。
- 交件前自己確認能編譯、簽章與骨架逐一對得上，並在結尾附一份自查結果。

全部回來後，主流程再做一次跨資源一致性檢查。
```

### 收尾：跨段整合檢查

平行的代價是各段可能有細微偏差，最後一定要補一次整合檢查：把三組擺在一起，只看跨資源一致性——共用型別是不是真的共用（沒有人偷偷重宣告一份）、動詞命名有沒有分岔、錯誤處理風格有沒有跑掉、handler → service 的呼叫形狀一不一致。這一步交給主流程做，不要讓任何填肉的 subagent 去評判全局。

## 對照概念：這跟「先規劃再執行」「平行化」差在哪

它跟「先規劃再執行」共享同一個直覺：別急著動手，先把結構想清楚。差別在目的。一般的先規劃再執行，規劃是為了排出正確的執行順序，重點在流程對不對；計畫做完常常就丟了。這裡的骨架不是為了排順序，而是為了產出一份會被所有後續實作共用的結構契約，重點在一致性與可平行——這份骨架（簽章與共用型別）是要一路被引用到最後的活文件。

它跟「平行化」也不同。單純的平行化是把彼此無關的任務同時跑，目的是省時間，各任務之間沒有共同前提。這裡的平行是「受約束的平行」——每一組實作都被同一份骨架綁住，平行是結果不是目的。它真正買到的不是速度，是一致性。學術上這個「先產骨架、再平行填」的做法叫 Skeleton-of-Thought<sup>註</sup>，但你可以把它就當成一種輕度 loop：先穩住骨架，再讓多條填肉迴圈平行跑，它跟前面的規劃與平行化是一路的。

## 今日實踐任務

1. 線性組：開一個乾淨對話，直接要 agent 一次生出 links／tags／report 三組 endpoints 的完整三層實作，不給骨架。存下結果。
2. 骨架組：用第一步的骨架 spec 產出骨架，自己確認並鎖定，再用 subagent 平行填三組。存下結果。
3. 對照兩組一致性，逐項打勾：共用型別是否真的只有一份；命名動詞是否統一（沒有 Create/Add 混用）；錯誤處理風格是否一致；每組的函式簽章是否跟骨架逐一對得上；跨層呼叫形狀是否一致。

驗收標準：骨架組在「共用型別重複定義數」與「命名分岔數」上明顯少於線性組，且三組都能對上骨架簽章、整包能編譯。若沒有明顯較好，多半是骨架不夠細（簽章沒定死），或第二步沒真的鎖定。

明天 Day 11 我們談 Reasoning Trace。agent 把程式改完了，你卻完全不知道它為什麼這樣改——下一篇要解的就是這個，怎麼讓 agent 留下一份可審計的決策軌跡。

---

<sup>註</sup>：Skeleton-of-Thought，先生成答案骨架、再平行填充各段細節的推理與生成技術。
