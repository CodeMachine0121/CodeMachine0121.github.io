---
title: "Day 01：告別傳統後端：為什麼智能合約是「確定性狀態機」？"
datetime: "2026-10-01"
description: "從 Web2 後端轉向智能合約，第一個要換掉的是心智模型：合約是一台確定性狀態機，部署後不可修改，錯誤沒有事後補救的空間。"
image: ""
parent: "From Web2 to Web3: Building Institutional-Grade DeFi Systems"
draft: false
---

習慣了 RESTful API、關聯式資料庫與集中式錯誤處理的後端工程師，剛接觸 Web3 時，直覺多半是：「這不就是寫程式嗎？能有多大的差別？」

差別比想像中大。在 Web2，我們處理的是「輸入與輸出」；在 Web3，我們維護的是一台**確定性狀態機（Deterministic State Machine）**。

## 1. 核心概念：什麼是確定性狀態機？

智能合約本質上就是一個狀態機：**同樣的輸入，在網路上任何一個節點執行，都必須得到完全相同的結果。** 而且程式碼一旦部署到正式環境，幾乎無法修改。這意味著 Web2 常見的「上線後發現問題再補」行不通，必須在部署前就把能想到的錯誤擋下來，也就是所謂的預防性程式設計。

## 2. 準備開發環境

開發智能合約需要一個有語法高亮、自動提示，並且能配合 Foundry 的編輯器。

### VS Code

- **[Solidity (by Nomic Foundation)](https://marketplace.visualstudio.com/items?itemName=nomicfoundation.hardhat-solidity)：** 語法高亮、編譯錯誤檢查與自動補全。
- **[Foundry (by Foundry)](https://marketplace.visualstudio.com/items?itemName=foundry.foundry)：** 官方外掛，補強 Foundry 專案的提示與補全。
- **格式化：** Foundry 內建 `forge fmt`，不必另外安裝格式化外掛，團隊之間的格式也會一致。

### JetBrains（IntelliJ / WebStorm / RustRover）

- **[Solidity (by JetBrains)](https://plugins.jetbrains.com/plugin/9475-solidity)：** 目前 JetBrains 系列對 Solidity 支援度最好的外掛。
- **[Nomic Foundation Solidity Plugin](https://plugins.jetbrains.com/plugin/19441-solidity)：** 提供進階的程式碼檢查與分析。

## 3. 安裝 Foundry

Foundry 是目前主流的合約開發框架，測試、部署與 Gas 分析都能在終端機裡完成。

```bash
# 安裝 Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup

# 初始化第一個專案
forge init web3-learning-journey
cd web3-learning-journey

# 檢查環境是否正常
forge test
```

## 4. 為什麼這件事對開發者很重要？

開發 DeFi 協議或鏈上金融應用時，寫的不是 CRUD，而是直接操作資產的金融邏輯：

1. **零容錯率：** 鏈上資產一旦因為程式碼漏洞流失，往往無法追回。
2. **治理與權限：** 每一個狀態變更都必須有嚴格的權限控管，開發者要清楚誰能在什麼條件下改動什麼。
3. **架構可擴展性：** 協議未來可能需要升級，如何設計合約架構（例如 Proxy 模式）並確保狀態遷移的安全，是合約開發者遲早要面對的問題。

---

## 今日行動

1. 依習慣選擇 VS Code 或 JetBrains，安裝上述外掛。
2. 完成 Foundry 的安裝，並成功執行 `forge test`。

## 思考題

假設要設計一個功能，讓合約轉帳給外部合作夥伴。在 Web2，只需要檢查資料庫裡的權限再發起 API 呼叫；**在智能合約中，要如何確保這個狀態改變是「已授權」且「不可逆」的？**

---

*這是一場 45 天的技術轉型紀錄，目標是成為能開發高安全標準智能合約的工程師。*

**從 Web2 轉向 Web3，最不習慣的地方是什麼？歡迎在下方留言交流。**

---

明天 Day 02，我們會打開今天建立的 Foundry 專案，看看它的目錄結構，並寫下第一個 Solidity 測試。
