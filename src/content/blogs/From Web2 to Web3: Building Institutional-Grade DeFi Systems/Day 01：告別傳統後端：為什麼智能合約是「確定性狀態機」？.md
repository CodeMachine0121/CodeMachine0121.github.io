---
title: "Day 01：告別傳統後端：為什麼智能合約是「確定性狀態機」？"
datetime: "2026-10-01"
image: ""
parent: "From Web2 to Web3: Building Institutional-Grade DeFi Systems"
draft: false
---

如果你是一名習慣了 RESTful API、關聯式資料庫與集中式錯誤處理的後端工程師，剛轉向 Web3 時，直覺可能會認為：「這不就是寫程式嗎？能有多大的區別？」

答案是：**區別賊大。** 在 Web2，你是在處理「輸入與輸出」；但在 Web3，你是在維護一個**「確定性狀態機 (Deterministic State Machine)」**。

### 1. 核心概念：什麼是確定性狀態機？
智能合約本質上就是一個狀態機：**同樣的輸入，在網路上任何一個節點執行，都必須得到完全相同的結果。** 且代碼一旦部署到 Production 環境，幾乎無法修改。這意味著，我們必須捨棄 Web2 中常見的「事後補救」心態，改為追求極致的「預防性程式設計」。

### 2. 打造你的 Web3 開發作戰室
工欲善其事，必先利其器。開發智能合約，你需要一個能語法高亮、自動提示且支援 Foundry 的開發環境。

#### 若你使用 VS Code：
*   **必裝外掛 (Plugins)：**
    *   **[Solidity (by Nomic Foundation)](https://marketplace.visualstudio.com/items?itemName=nomicfoundation.hardhat-solidity)：** 提供強大的語法高亮、檢查與提示。
    *   **[Foundry (by Foundry)](https://marketplace.visualstudio.com/items?itemName=foundry.foundry)：** 官方插件，提供更佳的智能提示與自動補全。
    *   **[Prettier - Solidity](https://marketplace.visualstudio.com/items?itemName=NomicFoundation.hardhat-solidity)：** 確保你的程式碼格式統一、美觀。

#### 若你使用 JetBrains (IntelliJ / WebStorm / RustRover)：
*   **必裝外掛 (Plugins)：**
    *   **[Solidity (by JetBrains)](https://plugins.jetbrains.com/plugin/9475-solidity)：** 這是目前對 Solidity 支援度最好的 JetBrains 官方/社群外掛。
    *   **[Nomic Foundation Solidity Plugin](https://plugins.jetbrains.com/plugin/19441-solidity)：** 提供進階的代碼檢查與分析功能。

### 3. 環境搭建：安裝 Foundry
Foundry 是目前業界最主流且功能強大的開發框架，它讓你可以直接在終端機中完成測試、部署與 Gas 分析。

```bash
# 安裝 Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup

# 初始化你的第一個專案
forge init web3-learning-journey
cd web3-learning-journey
# 檢查環境是否正常
forge test
```

### 4. 為何這對開發者很重要？
開發 DeFi 協議或複雜的鏈上金融應用時，這不是在練習寫 CRUD，而是進行「金融工程」：
1.  **零容錯率：** 鏈上資產一旦因為程式碼漏洞流失，往往無法追回。
2.  **治理與權限：** 所有的狀態變更都必須具備嚴格的權限控管，這要求開發者對權限架構有極深的理解。
3.  **架構可擴展性：** 考慮到協議未來的升級需求，如何設計合約架構（如 Proxy 模式）同時確保狀態遷移的安全性，是每個專業合約開發者的必修課。

---

### 今日行動：
1. 請根據你的習慣選擇 VS Code 或 JetBrains，並安裝上述推薦的外掛。
2. 完成 Foundry 的安裝並成功運行 `forge test`。

### 思考題：
假設你要設計一個功能，讓合約執行轉帳給外部合作夥伴。在 Web2，你只需檢查資料庫的權限並發起 API 呼叫；**在智能合約中，你要如何確保這個狀態改變是「已授權」且「不可逆」的？**

---

*我正在進行一場 60 天的技術轉型挑戰，目標是成為一名能開發高安全標準的智能合約工程師。歡迎追蹤我的進度！*

**對於從 Web2 轉向 Web3，你目前感到最困惑或最不習慣的地方是什麼？歡迎在下方留言交流！**

---

**Day 1 順利完成！你的開發環境現在已經準備就緒了。明天，我們將正式利用這套工具，開始 Day 2 的深入探討：如何透過測試框架來確保程式碼的安全性！準備好了嗎？**
