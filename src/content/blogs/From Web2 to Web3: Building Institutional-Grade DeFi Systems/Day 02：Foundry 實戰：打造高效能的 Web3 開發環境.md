---
title: "Day 02：Foundry 實戰：打造高效能的 Web3 開發環境"
datetime: "2026-10-03"
image: ""
parent: "From Web2 to Web3: Building Institutional-Grade DeFi Systems"
draft: false
---

在昨天的文章中，我們聊到了智能合約是一個「確定性狀態機」。今天，我們將正式進入開發實作。如果你之前有寫過測試的經驗，你會發現 Web3 的開發工具鏈已經從「手動部署測試」進化到了「高度自動化的測試框架」。

在眾多工具中，**Foundry** 是目前最受專業合約開發者青睞的框架，原因很簡單：它完全使用 Solidity 編寫測試，速度快，且與 EVM 的底層交互非常直觀。

### 1. 為什麼選擇 Foundry？
傳統的 Web3 開發多半使用 Hardhat (JavaScript/TypeScript)。雖然它生態系龐大，但 Foundry 提供了幾個好功能：
*   **Solidity Native：** 你不需要在 TypeScript 和 Solidity 之間切換心智模型，測試直接用 Solidity 寫，這能大幅提升對合約行為的精準控制。
*   **極速運行：** 測試運行速度比傳統框架快上數倍，這對於需要頻繁執行數百個測試案例的開發流程至關重要。
*   **強大的 Debug 工具：** 它內建的 Trace 功能，能讓你清楚看到每一筆交易呼叫過程中的狀態變化，這對於理解合約執行流程非常有幫助。

### 2. 初始化你的專案
如果昨天你已經完成了安裝，讓我們看看專案結構裡有什麼：

```bash
# 查看專案結構
tree -L 2
```

你會看到 `src` (存放你的合約)、`test` (存放測試程式碼) 和 `script` (存放部署腳本)。這與你在 Web2 常見的 MVC 或專案結構邏輯大同小異，但每個目錄的功能更加嚴謹。

### 3. 第一個測試：從「假定」到「驗證」
在 Solidity 測試中，我們使用 `assertEq` 來驗證結果。試著在 `test` 資料夾下建立一個測試檔案：

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/YourContract.sol";

contract CounterTest is Test {
    function testIncrement() public {
        uint256 x = 1;
        assertEq(x + 1, 2);
    }
}
```

執行 `forge test`，當你看到綠色的 **[PASS]** 時，這代表你的環境已準備就緒。

### 4. 為何開發環境配置如此關鍵？
在開發 DeFi 應用時，你的測試套件就是你的「合約防禦陣線」：
1.  **測試驅動開發 (TDD)：** 由於 Production 環境中的錯誤無法撤銷，強迫自己先寫測試再寫功能，是保護資產的最低門檻。
2.  **模擬狀態：** Foundry 允許你使用 `vm.prank(address)` 輕鬆模擬不同的使用者身份，這對於驗證權限控管（Access Control）非常有效。
3.  **GAS 報告：** 在執行測試時，透過 `forge test --gas-report`，你可以直接看到每個函式呼叫消耗了多少 Gas，讓你從第一天起就養成優化程式碼的好習慣。

---

### 今日行動：部署你的第一個合約
除了跑測試，請嘗試編寫一個簡單的 `Counter` 合約，並透過 `forge script` 將其部署到 Foundry 內建的測試鏈上。

### 思考題：
在開發過程中，你覺得「測試」這件事，在 Web2 的 API 開發與 Web3 的智能合約開發之間，最大的心理負擔差異是什麼？是「害怕丟失資產」還是「對區塊鏈狀態的不確定性」？

---

*我正在進行一場 60 天的技術轉型挑戰，這是 Day 2。透過紮實的工具鏈訓練，我正在一步步建立開發 DeFi 應用所需的專業素養。*

**如果你在安裝或跑測試時遇到什麼問題，歡迎在留言區提出，我們一起解決！**

---

**Day 2 進度達成！接下來 Day 3 我們要深入探討 Solidity 最令開發者頭痛的「記憶體配置 (Memory vs Storage)」，這可是 Gas 優化的核心，準備好了嗎？**
