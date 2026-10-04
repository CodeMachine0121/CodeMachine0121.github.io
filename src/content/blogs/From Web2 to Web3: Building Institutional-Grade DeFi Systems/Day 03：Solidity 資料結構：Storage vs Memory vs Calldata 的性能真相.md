---
title: "Day 03：Solidity 資料結構：Storage vs Memory vs Calldata 的性能真相"
datetime: "2026-10-03"
description: "Solidity 的資料放在 Storage、Memory 還是 Calldata，不只影響存取速度，更直接決定每筆交易的 Gas 成本。"
image: ""
parent: "From Web2 to Web3: Building Institutional-Grade DeFi Systems"
draft: false
---

在傳統後端開發中，我們習慣把變數放在記憶體（RAM），再透過資料庫做持久化儲存。但在 Solidity 中，資料的「存放位置」不只決定存取速度，更直接關係到每一筆交易要支付的 **Gas 成本**。

所以 **Storage**、**Memory** 與 **Calldata** 的差別，是寫合約的基本功。

## 1. 三種資料存放位置的定義

- **Storage（永久儲存）：**
  - **定義：** 區塊鏈上真正的儲存空間，對應 EVM 的 Storage 槽位（slot）。
  - **特性：** 資料永久保存在鏈上，每一次變更都會反映在區塊鏈的狀態中。
  - **成本：** **最昂貴。** 修改 Storage 變數需要消耗大量 Gas。
- **Memory（臨時儲存）：**
  - **定義：** 只在單次函式執行期間存在。
  - **特性：** 函式結束後即清除，類似傳統程式語言中的區域變數。
  - **成本：** **中等。** 比 Storage 便宜得多，但 memory 用得越多，擴張成本會跟著上升。
- **Calldata（唯讀的輸入資料）：**
  - **定義：** 存放外部呼叫傳進來的函式參數。
  - **特性：** 不可變（immutable），函式內無法修改它。
  - **成本：** **最便宜。** 參數只需要讀取時，使用 `calldata` 能省掉複製的成本。

## 2. 為什麼開發者必須在意？

在 Web2 後端，我們很少會去煩惱一個 `string` 放在 stack 還是 heap 會花多少錢。但在 Web3，**資料放在哪裡，就決定了存取它要付多少錢。**

舉例來說，函式要處理大量字串或陣列、而且不需要修改時，用 `calldata` 就能避免把資料複製到 `memory` 的額外開銷。在機構級的大型合約互動中，這類成本會隨呼叫次數累積成可觀的數字。

## 3. 常見的優化場景

撰寫函式時，可以遵循以下幾條原則：

1. **唯讀參數用 `calldata`：** 函式參數只需要讀取時，選擇 `calldata` 而非 `memory`。
2. **減少 Storage 讀寫：** 把 Storage 中的資料一次讀到區域變數，處理完畢後再一次寫回 Storage，不要在迴圈裡反覆讀寫。
3. **變數打包（Packing）：** Storage 以 32 bytes 為一個 slot，把 `uint8`、`bool` 這類小型變數排在一起，可以共用同一個 slot。這一點明天 Day 04 會用實際的 Gas 數字說明。

## 4. 今日練習

寫一個 `DataDemo` 合約，用兩個功能相同、只差在參數存放位置的函式，比較 `memory` 與 `calldata` 的差別：

```solidity
// src/DataDemo.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract DataDemo {
    // 參數放在 calldata：唯讀，不需要複製
    function echoFromCalldata(string calldata input) external pure returns (string memory) {
        return input;
    }

    // 參數放在 memory：呼叫時會先把參數複製進 memory
    function echoFromMemory(string memory input) external pure returns (string memory) {
        return input;
    }
}
```

```solidity
// test/DataDemo.t.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {DataDemo} from "../src/DataDemo.sol";

contract DataDemoTest is Test {
    DataDemo private dataDemo;
    string private constant LONG_INPUT =
        "a fairly long input string that spans more than one 32-byte word in memory";

    function setUp() public {
        dataDemo = new DataDemo();
    }

    function testEchoFromCalldata() public view {
        assertEq(dataDemo.echoFromCalldata(LONG_INPUT), LONG_INPUT);
    }

    function testEchoFromMemory() public view {
        assertEq(dataDemo.echoFromMemory(LONG_INPUT), LONG_INPUT);
    }
}
```

執行 `forge test --gas-report`，比較 `echoFromCalldata` 與 `echoFromMemory` 兩列的 Gas 數字。輸入字串越長，兩者的差距越明顯。

---

## 今日思考題

機構級平台通常有不少設定參數要儲存，例如管理員地址、交易額度上限。**如果某個變數只在初始化時設定一次，之後幾乎不會改變，應該放在 Storage，還是有更省 Gas 的方案？**

---

*這是 45 天技術轉型紀錄的 Day 03。理解 EVM 怎麼存放資料，是寫出有效率合約的前提。*

**Storage、Memory 與 Calldata 的概念中，哪個部分最難理解？歡迎在下方留言交流。**

---

明天 Day 04，我們要談 Gas 經濟學：EVM 的每個操作碼各要多少 Gas、各種型別在 Storage 中怎麼佔位，以及怎麼在不犧牲安全的前提下寫出更省的合約。
