---
title: "Day 05：ERC-20 標準解析：發行你的第一個鏈上代幣"
datetime: "2026-10-05"
image: ""
parent: "From Web2 to Web3: Building Institutional-Grade DeFi Systems"
draft: false
---

在 Web2，如果你要建立一個點數系統，你需要設計資料庫 Schema、寫入 API，並確保帳目不會出錯。在 Web3，我們直接遵循 **ERC-20 標準**。這不僅僅是一個代幣規範，更是一種「介面合約」，確保了你的代幣可以與 Uniswap 交易、Aave 借貸等任何 DeFi 協定無縫整合。

### 1. 什麼是 ERC-20？
ERC-20 定義了一套標準化的函式庫，讓代幣具有可互換性（Fungible）。無論是 USDT 還是你自己發行的代幣，只要符合這個標準，任何錢包和交易所都能讀取你的餘額並執行轉帳。

核心函式包含：
*   `totalSupply()`: 總發行量。
*   `balanceOf(address)`: 查詢餘額。
*   `transfer(to, amount)`: 轉帳。
*   `approve(spender, amount)`: **（關鍵！）** 授權某個合約使用你的代幣。
*   `transferFrom(from, to, amount)`: 由被授權者發起轉帳（這是 DeFi 運作的基礎）。

### 2. 為什麼我們不自己手寫？
初學者常會想：「我為什麼不自己寫 `balanceOf` 的邏輯？」
答案是：**安全是無價的。**

手寫 ERC-20 會面臨無數邊際效應（Edge Cases），例如：
*   轉帳給合約時如何觸發回呼（Callback）？
*   如何防止惡意合約鎖住資金？
*   如何確保算術運算不會溢位？

這就是 **OpenZeppelin** 的價值所在。他們提供了經過無數次審計（Audit）與實戰驗證的基礎合約，我們只需要繼承即可。

### 3. 實戰：利用 OpenZeppelin 發行代幣
在 Foundry 專案中，你可以透過 `forge install` 安裝 OpenZeppelin 函式庫：

```bash
forge install OpenZeppelin/openzeppelin-contracts
```

接著，發行代幣只需幾行程式碼：

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MyInstitutionalToken is ERC20 {
    constructor() ERC20("Institutional Token", "INST") {
        // 發行 1,000,000 枚代幣給部署者
        _mint(msg.sender, 1000000 * 10 ** decimals());
    }
}
```

#### Test Code

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/MyInstitutionalToken.sol";

contract MyInstitutionalTokenTest is Test {
    MyInstitutionalToken token;
    address owner = address(1);
    address alice = address(2);

    function setUp() public {
        // 模擬 owner 部署合約
        vm.prank(owner);
        token = new MyInstitutionalToken();
    }

    function testInitialSupply() external view {
        assertEq(token.balanceOf(owner), 1000000 * 10**18);
    }

    function testTransfer() external {
        vm.prank(owner);
        token.transfer(alice, 1000 * 10**18);
        
        assertEq(token.balanceOf(alice), 1000 * 10**18);
        assertEq(token.balanceOf(owner), 999000 * 10**18);
    }

    function testApproveAndTransferFrom() external {
        // Alice 授權 Bob (address(3)) 使用她的額度
        address bob = address(3);
        
        vm.prank(owner);
        token.transfer(alice, 1000 * 10**18);

        // Alice 授權 Bob 使用 500 枚
        vm.prank(alice);
        token.approve(bob, 500 * 10**18);

        // Bob 代表 Alice 轉帳給自己
        vm.prank(bob);
        token.transferFrom(alice, bob, 500 * 10**18);

        assertEq(token.balanceOf(bob), 500 * 10**18);
        assertEq(token.allowance(alice, bob), 0);
    }
}
```
#### 這份測試的關鍵設計思維：

- vm.prank(address)： 這是 Foundry 的核心功能。它告訴 EVM：「接下來這筆交易，由這個 address 發起」。這是測試權限控管與授權（Approval）的最強工具。
- 狀態驗證： 我們不只是測試「程式碼有沒有報錯」，而是嚴格驗證「轉帳後的餘額」與「授權後的額度 (Allowance)」是否符合預期。
- 邊界條件： 實際開發中，你還需要測試「餘額不足時轉帳是否會 Revert」以及「授權超過餘額是否失敗」。 


### 4. 關鍵思維：Approve 的風險
身為一名專業的合約開發者，你必須明白 `approve` 函式的危險性。當使用者 `approve` 了某個惡意合約後，該合約就可以隨意將使用者的餘額轉走。這也是為什麼現代 DeFi 系統（如 Vention 平台）在進行資產操作時，必須具備極嚴格的「審核」與「預警」機制。

---

### 今日行動：
1. 使用 `forge install` 安裝 OpenZeppelin 函式庫。
2. 編寫並編譯你的 `MyInstitutionalToken` 合約。
3. 撰寫一個測試腳本，驗證轉帳 (transfer) 與授權 (approve) 功能是否正常運作。

### 今日思考題：
假設你的財庫平台需要整合 ERC-20 代幣，但在與某個 DeFi 協議互動時，你需要先呼叫 `approve`。**若該協議被判定為高風險，除了限制 `approve` 的額度外，有沒有什麼架構設計能確保即使 `approve` 了，資金也不會被一次性領光？**

---

*我正在進行一場 60 天的技術轉型挑戰，這是 Day 05。掌握標準，就是掌握與鏈上世界互動的規律。*

**你在理解 `approve` 與 `transferFrom` 的運作邏輯時，有沒有覺得這與傳統的權限管理很不一樣？歡迎留言討論！**

---

**Day 5 達成！你已經擁有了自己的代幣合約。明天 Day 6，我們將聊聊如何利用 OpenZeppelin 的模組，更聰明地進行合約開發，並介紹一些專業級的開發模式！**
