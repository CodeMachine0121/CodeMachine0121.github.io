---
title: "Day 05：實戰：用 Solidity 寫一個極簡版 ERC-20 代幣合約"
datetime: "2026-10-05"
description: "代幣不是存在錢包裡的檔案，而是合約裡的一張帳本。從 EIP-20 規格出發手寫一個極簡 ERC-20，用 Foundry 測試驗證，並用測試重現兩個自己寫最容易踩到的坑。"
image: ""
parent: "From Web2 to Web3: Building Institutional-Grade DeFi Systems"
draft: false
---

前四天我們談了狀態機、工具鏈、資料存放位置與 Gas 成本，今天把這些概念放進第一個真正的合約：ERC-20 代幣。

先修正一個常見的誤解。錢包裡顯示「持有 100 USDC」，並不代表錢包裡存了 100 個什麼東西。代幣其實是一個合約，合約裡有一張帳本，記著每個地址有多少餘額；錢包只是去問合約「這個地址的餘額是多少」，再把答案顯示出來。換成 Web2 的說法，ERC-20 代幣就是一張 `balances` 表，加上一組規定好簽名的 API，而這組 API 的規格就是 EIP-20。

## 1. ERC-20 規格：一組大家都認得的介面

ERC-20 的價值不在於功能多強，而在於**每個代幣都長一樣**。錢包、交易所、DeFi 協議只要認得這組介面，就能和任何 ERC-20 代幣互動，不需要為每個代幣寫專屬的整合程式。

規格要求的函式與事件如下：

| 成員                            | 用途                                              |
|:--------------------------------|:--------------------------------------------------|
| `totalSupply()`                 | 代幣總發行量                                      |
| `balanceOf(owner)`              | 查詢某個地址的餘額                                |
| `transfer(to, value)`           | 從呼叫者自己的餘額轉出                            |
| `approve(spender, value)`       | 授權另一個地址代為轉出最多 `value`                |
| `allowance(owner, spender)`     | 查詢剩餘的授權額度                                |
| `transferFrom(from, to, value)` | 被授權者從 `from` 轉出，並扣除授權額度            |
| `event Transfer`                | 每次餘額移動都要發出，包含鑄造（`from` 為零地址） |
| `event Approval`                | 每次呼叫 `approve` 成功都要發出                   |

`name`、`symbol`、`decimals` 是選配，但幾乎所有代幣都會實作，錢包也依賴它們顯示。

`approve` 加 `transferFrom` 這一組是 ERC-20 和「單純的轉帳」最大的差別。DeFi 協議不能直接伸手拿使用者的代幣，所以流程是使用者先 `approve` 協議一個額度，協議再在使用者呼叫它的時候用 `transferFrom` 把代幣拉進來。Web2 裡最接近的概念是 OAuth 的授權範圍：先授權，後使用，而且有上限。

## 2. 資料結構：兩個 mapping

帳本需要兩張表：

- **餘額**：`mapping(address => uint256)`，地址對應餘額。
- **授權額度**：`mapping(address => mapping(address => uint256))`，持有者對應被授權者，再對應額度。

這也回答了昨天的思考題。頻繁增刪的地址集合用 `mapping` 存，因為單筆讀寫是 O(1)，而且不會因為集合變大而變貴；`array` 要刪除中間的元素就得搬移或遍歷，成本和長度成正比。`mapping` 的代價是無法列舉，需要列出所有成員時，通常會另外維護一個陣列，或交給鏈下透過事件重建，這一點 Day 08 談事件時會再遇到。

還有一個從 Web2 帶過來容易出錯的地方：**金額一律是整數**。EVM 沒有浮點數，`decimals = 18` 的意思是「顯示時把整數除以 10 的 18 次方」。合約裡的 `1 ether` 就是 `1 * 10**18`，代表 1 顆代幣。這和 Web2 金流系統用「分」為單位存整數是同一個道理。

## 3. 實作 MinimalToken

```solidity
// src/MinimalToken.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MinimalToken {
    string public name;
    string public symbol;
    uint8 public constant decimals = 18;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(string memory name_, string memory symbol_, uint256 initialSupply) {
        name = name_;
        symbol = symbol_;
        totalSupply = initialSupply;
        balanceOf[msg.sender] = initialSupply;
        emit Transfer(address(0), msg.sender, initialSupply);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(allowance[from][msg.sender] >= amount, "insufficient allowance");
        allowance[from][msg.sender] -= amount;
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) private {
        require(balanceOf[from] >= amount, "insufficient balance");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
    }
}
```

幾個值得注意的地方：

- **`public` 狀態變數會自動產生 getter。** `balanceOf` 與 `allowance` 宣告成 `public mapping`，編譯器就會產生 `balanceOf(address)` 與 `allowance(address, address)` 兩個函式，剛好符合規格，不必手寫。
- **`decimals` 用 `constant`。** 它永遠不會變，照 Day 04 的原則不佔 Storage。`name` 與 `symbol` 是字串，Solidity 不支援 `immutable` 字串，只能放在 Storage。
- **鑄造也要發出 `Transfer`。** 建構子把全部發行量給部署者時，發出一筆 `from` 為零地址的 `Transfer`。鏈下的索引服務靠事件重建餘額，少了這筆事件，它們算出來的帳就對不上。
- **`require` 先檢查再改狀態。** 先確認額度與餘額足夠，才動到 Storage。Solidity 0.8 之後減法不足會自動 revert，所以就算拿掉 `require`，`-=` 也不會讓餘額變成一個巨大的數字；寫出 `require` 是為了給出看得懂的錯誤訊息。錯誤處理的寫法 Day 09 會再細談。

## 4. 用 Foundry 測試

```solidity
// test/MinimalToken.t.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {MinimalToken} from "../src/MinimalToken.sol";

contract MinimalTokenTest is Test {
    event Transfer(address indexed from, address indexed to, uint256 value);

    uint256 private constant INITIAL_SUPPLY = 1_000_000 ether;

    MinimalToken private token;
    address private alice = makeAddr("alice");
    address private bob = makeAddr("bob");

    function setUp() public {
        vm.prank(alice);
        token = new MinimalToken("Treasury Token", "TT", INITIAL_SUPPLY);
    }

    function testDeployerReceivesInitialSupply() public view {
        assertEq(token.totalSupply(), INITIAL_SUPPLY);
        assertEq(token.balanceOf(alice), INITIAL_SUPPLY);
    }

    function testTransferMovesBalanceAndEmitsEvent() public {
        vm.expectEmit(true, true, false, true, address(token));
        emit Transfer(alice, bob, 100 ether);

        vm.prank(alice);
        token.transfer(bob, 100 ether);

        assertEq(token.balanceOf(alice), INITIAL_SUPPLY - 100 ether);
        assertEq(token.balanceOf(bob), 100 ether);
    }

    function testTransferRevertsWhenBalanceIsInsufficient() public {
        vm.prank(bob);
        vm.expectRevert(bytes("insufficient balance"));
        token.transfer(alice, 1);
    }

    function testTransferFromSpendsAllowance() public {
        vm.prank(alice);
        token.approve(bob, 300 ether);

        vm.prank(bob);
        token.transferFrom(alice, bob, 200 ether);

        assertEq(token.allowance(alice, bob), 100 ether);
        assertEq(token.balanceOf(bob), 200 ether);
    }

    function testTransferFromRevertsWithoutAllowance() public {
        vm.prank(bob);
        vm.expectRevert(bytes("insufficient allowance"));
        token.transferFrom(alice, bob, 1);
    }
}
```

這裡用到三個 Foundry 的作弊碼（cheatcode）：

- **`makeAddr("alice")`**：產生一個帶標籤的測試地址，trace 裡會顯示 `alice` 而不是一串十六進位。
- **`vm.prank(address)`**：讓下一次呼叫的 `msg.sender` 變成指定地址。`setUp` 裡用它讓 alice 成為部署者，所以初始發行量會落在 alice 身上。
- **`vm.expectRevert` 與 `vm.expectEmit`**：斷言下一次呼叫會 revert 並帶著指定訊息，或會發出指定的事件。`expectEmit` 前四個布林值分別代表要不要比對三個 indexed topic 與 data，最後一個參數限定事件必須來自 `token`。

執行 `forge test`，五個測試全部通過。

## 5. 自己寫最容易踩到的兩個坑

測試全過，不代表這個代幣可以上線。下面兩個問題，功能測試完全抓不到，但都可以用測試**重現**出來。

```solidity
// test/MinimalTokenPitfalls.t.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {MinimalToken} from "../src/MinimalToken.sol";

contract MinimalTokenPitfallsTest is Test {
    MinimalToken private token;
    address private alice = makeAddr("alice");
    address private bob = makeAddr("bob");

    function setUp() public {
        vm.prank(alice);
        token = new MinimalToken("Treasury Token", "TT", 1_000_000 ether);
    }

    // 坑一：轉給零地址不會失敗，代幣就此鎖死
    function testTransferToZeroAddressSilentlyLocksTokens() public {
        vm.prank(alice);
        token.transfer(address(0), 100 ether);

        assertEq(token.balanceOf(address(0)), 100 ether);
        assertEq(token.totalSupply(), 1_000_000 ether);
    }

    // 坑二：改額度的空檔被搶先，spender 拿到新舊兩份額度
    function testChangingAllowanceCanBeFrontRun() public {
        vm.prank(alice);
        token.approve(bob, 100 ether);

        // bob 在 mempool 看到 alice 要把額度改成 50，搶先花掉舊的 100
        vm.prank(bob);
        token.transferFrom(alice, bob, 100 ether);

        // alice 的交易接著上鏈
        vm.prank(alice);
        token.approve(bob, 50 ether);

        // bob 再花掉新的 50
        vm.prank(bob);
        token.transferFrom(alice, bob, 50 ether);

        assertEq(token.balanceOf(bob), 150 ether);
    }
}
```

這兩個測試會**通過**，而通過正是問題所在。

**坑一：零地址。** 沒有人持有零地址的私鑰，轉進去的代幣再也拿不出來。更麻煩的是 `totalSupply` 沒有變，帳面上這 100 顆代幣還在流通，實際上已經永遠鎖死。前端少驗一個欄位、使用者複製地址時漏了字元，都可能觸發這個情況。Web2 裡轉帳給不存在的帳戶，銀行會退件；合約不檢查，就沒有人替我們退件。

**坑二：approve 的搶先交易。** alice 原本授權 bob 100，想改成 50。問題在於 alice 的 `approve` 送出之後、上鏈之前，會先在公開的 mempool 裡等待。bob 看到這筆交易，可以付更高的手續費讓自己的 `transferFrom` 先被打包，把舊的 100 花掉；alice 的交易接著上鏈把額度設成 50，bob 再花掉這 50。alice 原本只打算讓 bob 動用 50，結果被轉走 150。EIP-20 規格在 `approve` 的段落裡就提到了這個攻擊向量。這是 Day 01 狀態機思維的直接後果：交易的**排序**本身也是可以被操縱的輸入。

除了這兩個，這個版本還有幾個沒處理的地方：

- 沒有「無限授權」的慣例。很多協議會請使用者 `approve` 成 `type(uint256).max`，省去每次重新授權，但這個實作每次 `transferFrom` 都還是會去扣額度、多付一次 Storage 寫入。
- 錯誤訊息用字串，比 custom error 更耗 Gas，也不利於前端解析。
- 只有在建構子裡鑄造，沒有之後增發或銷毀的機制，也就沒有「誰有權鑄造」的權限設計。

這些問題 OpenZeppelin 的實作都處理過了，明天我們會拿它重寫這個代幣，逐項對照差在哪裡。

---

## 今日練習

1. 把 `MinimalToken` 與兩個測試檔放進 Day 02 建立的 Foundry 專案，執行 `forge test`，確認七個測試全部通過。
2. 在 `_transfer` 加上零地址檢查，讓 `testTransferToZeroAddressSilentlyLocksTokens` 改成預期 revert，並思考建構子裡的鑄造為什麼不會被這個檢查擋下。

## 今日思考題

坑二的根源是「把額度從一個非零值直接改成另一個非零值」。**如果不能修改 ERC-20 的介面，在應用層（前端或呼叫方合約）可以用什麼方式避開這個搶先交易？**

---

*這是 45 天技術轉型紀錄的 Day 05。親手寫過一次，才知道標準實作替我們擋下了哪些問題。*

**第一次寫代幣合約時，最意外的是哪個細節？歡迎在下方留言交流。**

---

明天 Day 06，我們用 OpenZeppelin 重寫今天的代幣，看它怎麼處理零地址、無限授權與錯誤訊息，以及為什麼合約開發者從不自己寫標準合約。

## Reference

- [ERC-20 的函式、事件定義，以及 approve 段落對搶先交易攻擊向量的說明 — EIP-20: Token Standard](https://eips.ethereum.org/EIPS/eip-20)
