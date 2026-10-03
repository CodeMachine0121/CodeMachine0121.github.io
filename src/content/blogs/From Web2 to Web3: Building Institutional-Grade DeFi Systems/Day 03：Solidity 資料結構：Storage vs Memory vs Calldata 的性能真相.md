---
title: "Day 03：Solidity 資料結構：Storage vs Memory vs Calldata 的性能真相"
datetime: "2026-10-04"
image: ""
parent: "From Web2 to Web3: Building Institutional-Grade DeFi Systems"
draft: false
---

在傳統後端開發中，我們習慣將變數放在記憶體（RAM）中，並透過資料庫（Database）進行持久化儲存。但在 Solidity 中，資料的「存放位置」不僅決定了存取速度，更直接關係到每一筆交易需要支付的 **Gas 成本**。

理解 **Storage**、**Memory** 與 **Calldata** 的區別，是每一位專業合約開發者的基本功。

### 1. 三種資料儲存位置的定義

*   **Storage (永久儲存)：**
    *   **定義：** 區塊鏈上的真實儲存空間，對應 EVM 的 Storage 槽位。
    *   **特性：** 資料會永久保存在鏈上，狀態變更會反應在區塊鏈的歷史中。
    *   **成本：** **最昂貴。** 修改 Storage 變數需要消耗大量的 Gas。
*   **Memory (臨時儲存)：**
    *   **定義：** 僅在單次函數執行期間存在。
    *   **特性：** 函數結束後即清除，類似於傳統程式語言中的本地變數（Local Variables）。
    *   **成本：** **中等。** 雖然比 Storage 省錢，但在記憶體中頻繁擴展也會產生相應的開銷。
*   **Calldata (唯讀臨時儲存)：**
    *   **定義：** 專門用於存放「函數的輸入參數」。
    *   **特性：** 這是不可變的（Immutable），你無法在函數中修改它。
    *   **成本：** **最便宜。** 如果你的變數只需要讀取，使用 `calldata` 能顯著降低 Gas 消耗。

### 2. 為什麼開發者必須在意？
在 Web2 後端開發，你可能不太會擔心宣告一個 `string` 變數放在堆疊（Stack）還是堆積（Heap）對硬碟成本的影響。但在 Web3，**存取資料的位置就是存取成本。**

舉個例子，如果你的函數需要處理大量的字串或陣列，且不需要修改它們，使用 `calldata` 就能避免將資料複製到 `memory` 的額外開銷，這在處理機構級大型合約交互時，能省下可觀的費用。

### 3. 常見的優化場景
一個專業的合約開發者，在撰寫函數時會遵循以下原則：
1.  **盡量使用 `calldata`：** 如果函數參數只是要讀取，永遠選擇 `calldata` 而非 `memory`。
2.  **減少 Storage 讀寫：** 盡量將 Storage 中的資料一次讀取到本地變數（在函數內以 `memory` 或 `stack` 處理），處理完畢後再一次性寫回 Storage。
3.  **變數封裝 (Packing)：** 由於 Storage 是以 32 位元組（32-byte slot）為單位的，將小型的變數（如 `uint8`, `bool`）緊鄰排列，可以合併在同一個 Slot 中，這能極大化節省空間。

### 4. 今日練習
請試著編寫一個簡單的 `StringManager` 合約，觀察使用 `memory` 與 `calldata` 處理字串時的差別：

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract DataDemo {
    // 使用 calldata (唯讀，更省 Gas)
    function processInput(string calldata _input) external pure returns (string memory) {
        return _input;
    }
}
```

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.37;

import {Test} from "forge-std/Test.sol";
import {DataDemo} from "../src/DataDemo.sol";

contract DataDemoTest is Test {
    
    function testProcessInput() public {
        string memory input = "test";
        string memory output = new DataDemo().processInput(input);
        assertEq(output, input);
    }

}
```

執行 `forge test`，並嘗試運行 `forge test --gas-report`，你就能量化看到選擇不同儲存位置所帶來的 Gas 差異。

---

### 今日思考題：
在機構級平台的開發中，我們通常會有大量的設定參數需要儲存（例如：管理員地址、交易限制額度）。**若某個變數只需要在初始化時設置一次，且之後幾乎不會改變，你會選擇將它存放在 Storage，還是有其他更省 Gas 的方案？**

---

*我正在進行一場 60 天的技術轉型挑戰，這是 Day 03。深入理解 EVM 的運作機制，是構建高效合約的必經之路。*

**對於 Storage、Memory 與 Calldata 的概念，你覺得最難理解的部分是什麼？歡迎在下方留言交流！**

---

**Day 3 進度達成！這可是合約優化的核心邏輯。明天我們將進入 Day 4，談談「Gas 經濟學」——如何在確保安全的前提下，寫出最精簡的程式碼。**
