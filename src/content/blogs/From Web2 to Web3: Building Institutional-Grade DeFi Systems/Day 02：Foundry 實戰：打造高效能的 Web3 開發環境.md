---
title: "Day 02：Foundry 實戰：打造高效能的 Web3 開發環境"
datetime: "2026-10-02"
description: "為什麼專業合約開發者偏好 Foundry：用 Solidity 寫測試、執行速度快、內建 trace 與 Gas 報告，並寫下第一個合約測試。"
image: ""
parent: "From Web2 to Web3: Building Institutional-Grade DeFi Systems"
draft: false
---

昨天我們聊到智能合約是一台「確定性狀態機」，也裝好了 Foundry。今天正式進入開發實作。寫過測試的人會發現，Web3 的工具鏈已經從「手動部署再測試」進化到高度自動化的測試框架。

在眾多工具中，**Foundry** 是目前最受合約開發者青睞的框架：它用 Solidity 寫測試、執行速度快，而且和 EVM 底層的互動很直觀。

## 1. 為什麼選擇 Foundry？

早期的合約開發多半使用 Hardhat（JavaScript／TypeScript）。它的生態系龐大，但 Foundry 有幾個明顯的優勢：

- **Solidity Native：** 測試直接用 Solidity 寫，不需要在 TypeScript 和 Solidity 之間切換心智模型，對合約行為的控制也更精準。
- **執行速度快：** 測試執行速度比 JavaScript 系的框架快上數倍，當測試案例累積到數百個時，這個差距會直接影響開發節奏。
- **Debug 工具：** 內建的 trace 功能可以看到每一筆交易呼叫過程中的狀態變化，對理解合約的執行流程很有幫助。

## 2. 專案結構

先看看昨天 `forge init` 產生了什麼：

```bash
# 查看專案結構
tree -L 2
```

會看到三個主要目錄：`src`（合約）、`test`（測試）和 `script`（部署腳本）。這和 Web2 專案常見的分層邏輯差不多，只是每個目錄的職責劃分得更明確。另外還有 `lib`（依賴套件，例如 `forge-std`）與設定檔 `foundry.toml`。

## 3. 第一個測試：從「假定」到「驗證」

`forge init` 預設會產生一個 `Counter` 合約，有 `number`、`setNumber` 與 `increment` 三個成員。在 `test` 資料夾下新增一個測試檔，驗證它的行為：

```solidity
// test/CounterIncrement.t.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {Counter} from "../src/Counter.sol";

contract CounterIncrementTest is Test {
    Counter private counter;

    function setUp() public {
        counter = new Counter();
        counter.setNumber(1);
    }

    function testIncrementAddsOne() public {
        counter.increment();
        assertEq(counter.number(), 2);
    }
}
```

`setUp` 會在每個測試函式執行前跑一次，每個測試都從同樣的初始狀態開始。執行 `forge test`，看到 **[PASS]** 就代表環境已經準備就緒。

## 4. 為什麼開發環境的配置這麼關鍵？

開發 DeFi 應用時，測試套件就是合約的第一道防線：

1. **測試驅動開發（TDD）：** 正式環境的錯誤無法撤銷，先寫測試再寫功能，是保護資產的最低門檻。
2. **模擬身份：** Foundry 可以用 `vm.prank(address)` 模擬不同使用者發出的呼叫，驗證權限控管（Access Control）時非常好用。
3. **Gas 報告：** 執行 `forge test --gas-report` 可以直接看到每個函式消耗多少 Gas，從第一天起就能把成本納入考量。

---

## 今日行動：部署第一個合約

除了跑測試，試著用 `forge script` 把 `Counter` 合約部署到 Foundry 內建的本機測試鏈 `anvil` 上。

## 思考題

「測試」這件事，在 Web2 的 API 開發與 Web3 的合約開發之間，最大的心理負擔差異是什麼？是「害怕資產損失」，還是「對區塊鏈狀態的不確定」？

---

*這是 45 天技術轉型紀錄的 Day 02。先把工具鏈打穩，後面開發 DeFi 應用時才有可靠的驗證手段。*

**安裝或跑測試時遇到問題，歡迎在留言區提出，我們一起解決。**

---

明天 Day 03，我們要談 Solidity 的三種資料存放位置：Storage、Memory 與 Calldata。它們的差別直接決定了每一筆交易的 Gas 成本。
