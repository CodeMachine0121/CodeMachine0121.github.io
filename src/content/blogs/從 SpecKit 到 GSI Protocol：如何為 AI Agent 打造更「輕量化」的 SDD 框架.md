---
title: "從 SpecKit 到 GSI Protocol：我如何為 AI Agent 打造更「輕量化」的 SDD 框架"
datetime: "2025-12-03"
description: "SpecKit 無疑是 SDD (規格驅動開發) 的先行者與標竿。它展示了如何透過嚴謹的文件流程（Constitution -> Plan -> Tasks），讓 AI 的產出變得可控。 然而，在實際將 SpecKit 導入日常的 功能迭代 時，我遇到了一些挑戰：對於一個中小型功能來說，完整的 SpecKit 流程顯得有些「重型 (Heavyweight)」，隨之而來的是較高的 Token 成本 與 等待時間。 為了在「嚴謹度」與「敏捷性」之間取得更好的平衡，並解決AI 對「既有專案結構」感知不足 的問題，我基於 SDD 的精神，開發了 GSI Protocol。"
image: "/images/titles/GSI.png"
class: "responsive-blog-post"
---

在 AI 輔助開發的領域，**SpecKit** 無疑是 SDD (規格驅動開發) 的先行者與標竿。它展示了如何透過嚴謹的文件流程（Constitution -> Plan -> Tasks），讓 AI 的產出變得可控。

然而，在實際將 SpecKit 導入日常的**功能迭代 (Feature Iteration)** 時，我遇到了一些挑戰：對於一個中小型功能來說，完整的 SpecKit 流程顯得有些**「重型 (Heavyweight)」**，隨之而來的是較高的 **Token 成本** 與 **等待時間**。

為了在「嚴謹度」與「敏捷性」之間取得更好的平衡，並解決 **AI 對「既有專案結構」感知不足** 的問題，我基於 SDD 的精神，開發了 **GSI Protocol**。

---

### 📚 GSI, Gherkin -> Structure -> Implementation

GSI 是一套專為 AI Agent 設計的 規格驅動開發 (SDD) 協議。它將開發流程拆解為三個核心階段，強迫 AI 遵循 「先定義、再設計、後實作」 的紀律，就像是為軟體注入生命的三個步驟：

- **G - Gherkin (規格/靈魂)**： 使用 BDD 語法鎖定業務行為，確保 AI 懂需求。
- **S - Structure (架構/骨架)**： 掃描專案上下文並設計技術藍圖，確保 AI 懂架構。
- **I - Implementation (實作/血肉)**： 嚴格按圖施工，確保 AI 寫出的 Code 精準無誤。

透過 GSI，我們不再讓 AI 自由發揮，而是將其轉化為嚴謹的工程流水線。

### ⚖️ 場景對決：為什麼需要輕量化框架？

SpecKit 與 GSI Protocol 並非優劣之分，而是 **「適用場景」** 的不同。讓我們來看看兩者在設計哲學上的差異：

#### **設計哲學**

🏗️ **SpecKit (重型航母)**：全面且嚴謹，透過多層次文件 (Constitution, Plan...) 來確保萬無一失，不放過任何細節。

⚡ **GSI Protocol (快速突擊艇)**：精實且敏捷，只留下核心的 Gherkin 與 Architecture，專注於快速產出，別搞太複雜。

---

#### **Token 成本**

🏗️ **SpecKit (重型航母)**：成本較高 💰，整個上下文堆疊完整，適合那種不在乎花錢、非得要完美的大型模組。

⚡ **GSI Protocol (快速突擊艇)**：成本最佳化 🪙，Context 精簡得很乾淨，針對日常開發跟維護來做成本控管，荷包能省一大筆。

---

#### **上下文感知**

🏗️ **SpecKit (重型航母)**：專案無關，不管你現在是啥專案，AI 都能從零開始發揮，特別適合全新的 Greenfield 專案。

⚡ **GSI Protocol (快速突擊艇)**：專案感知，Phase 2 會先掃一遍你現在的專案狀況，然後在既有架構上面加功能 (Brownfield)，不會亂來。

---

#### **產出物**

🏗️ **SpecKit (重型航母)**：任務導向，會生成超詳細的執行計畫跟待辦清單，讓你知道咋一步步做下去。

⚡ **GSI Protocol (快速突擊艇)**：架構導向，直接生成檔案路徑、介面定義和最終程式碼，不囉唆，直接給你能用的東西。

---

#### **最佳適用場景**

🏗️ **SpecKit (重型航母)**：複雜度極高、非得從零建構的系統，那種大型專案、需要嚴謹的地方。

⚡ **GSI Protocol (快速突擊艇)**：既有專案的功能擴充、快速迭代，那種開發節奏快、要常常加功能的時候用最爽。

---

### 🔍 深度剖析：用 5W1H 重新思考 AI 開發流程

以下是我盡可能使用 5W1H 方法論，分析了在「既有專案」中導入重型 SDD 框架時會遇到的摩擦力，並提出 GSI 的優化解法：

#### **What (問題) - 過度設計 vs 精準打擊**

🔄 **重型框架的挑戰**：開發一個小功能卻得生成一堆計畫文件，整個流程又臭又長，特別不敏捷。

🟢 **GSI 的優化方案**：不搞那些繁瑣的計畫了，咱們直接鎖定「規格」和「架構」這兩個重點就夠了。

---

#### **Why (原因) - 成本考量 vs 效率優先**

🔄 **重型框架的挑戰**：一來一往對話多，Token 用得凶，等待時間長，整個心流被打斷，超級惱人。

🟢 **GSI 的優化方案**：把流程精簡下來，AI 推理時間大幅縮短，API 花費也能省下來，開發速度直接飆升。

---

#### **Where (位置) - 風格割裂 vs 路徑鎖定**

🔄 **重型框架的挑戰**：AI 常常不去理咱們既有專案的目錄結構和命名慣例，一下子就亂寫一通。

🟢 **GSI 的優化方案**：架構師 Agent 會先去掃一遍現在的專案，然後強制 AI 照著咱的風格來，避免咔下去就壞掉。

---

#### **How (方法) - 文件堆砌 vs 結構約束**

🔄 **重型框架的挑戰**：得靠一大堆文字敘述來約束 AI，講得再清楚 AI 有時候還是聽不懂。

🟢 **GSI 的優化方案**：與其寫一堆上百行文件，不如直接透過 Markdown 架構檔和 Gherkin 腳本來限制輸出，讓 AI 照著結構走。

---

### 🛠️ 核心框架：GSI Protocol 運作流程

GSI Protocol 吸取了 SpecKit 的精髓（先想再寫），但將其簡化為四個高效率的階段：

#### **Phase 1: 規格 (The Soul)**

🤖 **負責 Agent**：PM Agent

🎯 **核心目標**：定義行為，將模糊需求轉化為可測試的驗收標準。

📄 **關鍵產出**：`feature.gherkin` (Given/When/Then 腳本)

---

#### **Phase 2: 架構 (The Skeleton)** ⭐ 關鍵差異點

🤖 **負責 Agent**：Architect Agent

🎯 **核心目標**：掃描上下文，讀取現有專案結構，設計符合風格的技術藍圖。

📄 **關鍵產出**：`architecture.md` (繁體中文架構文件，含檔案路徑與介面定義)

---

#### **Phase 3: 實作 (The Flesh)**

🤖 **負責 Agent**：Engineer Agent

🎯 **核心目標**：按圖施工，嚴格遵守 Phase 2 的設計，填入程式邏輯。當然這個階段你也可以使用對應的 agent 來做不同風格的開發方式。

📄 **關鍵產出**：`implementation.py` (可執行的程式碼)

---

#### **Phase 4: 驗證 (The Check)**

🤖 **負責 Agent**：QA Agent

🎯 **核心目標**：閉環驗收，確保實作符合規格與架構。

📄 **關鍵產出**：`conclusion.md` (驗收報告，若失敗則回退重做)

---

### 🚀 實戰驗證：用 GSI 打造 Golang 專案

為了驗證這套流程好不好用，我實際使用 GSI Protocol 開發了一個 Golang 練習專案。

🔗 **實戰 Repo:** [https://github.com/CodeMachine0121/golang-gsi-practice](https://github.com/CodeMachine0121/golang-gsi-practice)

在這個專案中，你可以看到 GSI 如何完美適應 Golang的特性：

1.  **架構感知：** Architect Agent 掃描專案後，理解 Golang 的 Package 結構，正確規劃出 `internal/` 與 `pkg/` 的目錄配置。
2.  **介面先行：** 在 `architecture.md` 中先定義了 Golang Interface，降低Agent 實作時發生型別錯誤的機率。
3.  **文件即是程式碼：** 生成的 `.feature` 檔與架構文件直接存入 Repo，成為最棒的規格文件。

---

### ✨ 開源專案發布

為了讓這套更輕量、更省錢的 SDD 流程能被大家使用，我將其整理為開源的 **Agent Tool**。
如果你喜歡 SpecKit 的理念，但希望在日常開發中能有更輕快、更低成本的選擇，GSI Protocol 會是一個很好的互補方案。

🔗 **GitHub Repo:** [https://github.com/CodeMachine0121/GSI-Protocol](https://github.com/CodeMachine0121/GSI-Protocol)

### 這個 Repo 能幫你：

- ✅ **降低門檻：** 更少的 Token 消耗，適合頻繁的功能開發使用。
- ✅ **無縫整合：** 專為「既有專案」設計，自動讀取並融入現有架構。
- ✅ **保持嚴謹：** 依然保有 SDD 最核心的規格與測試精神。

歡迎 **Star ⭐️** 並試用，讓我們一起探索 AI 輔助開發的最佳實踐！
