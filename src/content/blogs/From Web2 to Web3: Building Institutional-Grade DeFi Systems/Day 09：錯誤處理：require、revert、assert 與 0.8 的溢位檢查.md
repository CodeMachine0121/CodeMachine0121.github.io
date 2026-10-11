---
title: "Day 09：錯誤處理：require、revert、assert 與 0.8 的溢位檢查"
datetime: "2026-10-09"
description: "從 revert 會撤銷什麼、留下什麼講起，拆開 Error(string)、custom error 與 Panic 三種 revert data，實測 custom error 到底省在哪裡；再看 0.8 之前的溢位漏洞、0.8 之後的 Panic(0x11)、型別轉換不檢查溢位的陷阱，以及 unchecked 什麼時候才安全。"
image: ""
parent: "From Web2 to Web3: Building Institutional-Grade DeFi Systems"
draft: false
---

昨天在 anvil 上送了一筆會超過上限的鑄造，收據的 `status` 是 `0`，`logs` 是空的，`gasUsed` 是 40,179。這筆交易失敗了，但失敗的方式和 Web2 很不一樣：狀態全部撤銷，Gas 照付，呼叫者拿到的只有一段 revert data。今天就從這段 revert data 講起，看合約有哪幾種失敗方式、各自該用在哪裡。

先收掉昨天的練習與思考題。

練習二重複授予同一個角色，`cast logs` 不會多出一筆，收據的 `logs` 是空陣列，這是昨天第 5 節說的「狀態沒變就沒有事件」。練習三替 `burn` 加一個 `Burned(address indexed burner, uint256 amount)` 事件，公式算出來是 `LOG2`：375 + 2 × 375 + 8 × 32 = 1,381 Gas。實測 `burn` 從 36,525 變成 38,119，多了 1,594，其中 213 是準備參數與取 `msg.sender` 的開銷，和 `Minted` 的比例差不多。

思考題問的是能不能靠加總今天的轉出事件來限制每日上限。答案是不行，合約讀不到任何事件。要做這個判斷，Storage 裡至少要記兩個值：今天是哪一天，以及今天已經轉出多少。把它們打包進同一個 slot（例如 `uint64 currentDay` 與 `uint192 spentToday`，這是 Day 04 的打包技巧），每筆轉出先用 `block.timestamp / 1 days` 算出今天，跟 `currentDay` 不同就把已轉出歸零，再檢查 `spentToday + amount` 是否超過上限，最後寫回一次。一筆轉出只有一次 Storage 寫入。Day 32 會實際實作這個模組，而 `spentToday + amount` 這個加法會不會溢位，正好是今天後半要談的事。

## 1. revert 撤銷什麼、留下什麼

Web2 後端處理錯誤的工具很多：拋出例外、在 middleware 統一攔截、轉成 HTTP 400 或 500 回給前端。如果錯誤發生在寫入資料庫的途中，要靠交易（transaction）把已經寫進去的部分 rollback，沒包交易的話，寫了一半的資料就留在那裡。

EVM 把這件事簡化成一條規則：**revert 會撤銷當前呼叫框裡的所有狀態變更**。Storage 寫入、餘額變化、發出的事件、對其他合約的呼叫造成的改動，全部回到呼叫之前的樣子。沒有「寫了一半」這種狀態，也不需要自己包交易。

revert 不會撤銷的有兩樣：

- **已經消耗的 Gas。** 昨天那筆交易執行到 `ERC20Capped` 的檢查才 revert，前面跑過的運算與 Storage 存取都已經花掉了。revert 之後剩下的 Gas 會退還，花掉的不會。
- **revert data。** 失敗時合約可以回傳一段資料給呼叫者，說明為什麼失敗。這是唯一能留下來的東西，也是今天的主角。

| 項目               | Web2 後端                        | 智能合約                                 |
|:-------------------|:---------------------------------|:-----------------------------------------|
| 失敗時的資料一致性 | 靠資料庫交易，沒包就可能寫一半    | revert 自動撤銷整個呼叫框的狀態          |
| 錯誤資訊           | 例外訊息、stack trace、HTTP 狀態碼 | revert data，格式由合約決定              |
| 失敗的成本         | 通常可以忽略                      | 已執行部分的 Gas 照付                     |
| 錯誤記錄           | 寫進 log                         | 事件會跟著被撤銷，失敗的呼叫不會留下事件 |

最後一列是昨天驗證過的：想在失敗時「記一筆錯誤日誌」是做不到的，那筆事件會跟著 revert 一起消失。

## 2. 三種寫法：require、revert、assert

Solidity 有三種主動讓呼叫失敗的寫法：

```solidity
// 1. require：條件不成立就 revert，第二個參數可以是錯誤字串或 custom error
require(balance >= amount, "insufficient balance");
require(balance >= amount, InsufficientBalance(msg.sender, balance, amount));

// 2. revert：無條件 revert，通常搭配 if
if (balance < amount) {
    revert InsufficientBalance(msg.sender, balance, amount);
}

// 3. assert：條件不成立就 Panic，只用於「不可能發生」的情況
assert(totalSupply() <= cap());
```

`require` 搭配 custom error 是比較新的語法：0.8.26 開始支援，但只限 via-IR 編譯流程，0.8.27 起一般的編譯流程也能用。實測用 0.8.24 編譯會得到 `No matching declaration found after argument-dependent lookup`。OpenZeppelin v5 支援 0.8.20 以上的編譯器，所以全面使用 `if` 加 `revert` 的寫法。

`require` 有一個不太直覺的行為：**第二個參數不管條件成不成立都會先被計算**。`require(true, CustomError(f()))` 裡的 `f()` 一定會執行，寫成錯誤字串的 `require(true, g())` 也一樣，實測兩者的副作用都會發生。錯誤參數只是讀幾個區域變數時，代價是成功路徑多付一點 Gas（第 4 節的表格會看到）；如果參數裡有函式呼叫，就要改用 `if` 加 `revert`，只在失敗時才計算。

`require` 和 `revert` 用來處理**可預期的失敗**：輸入不合法、餘額不足、權限不夠。這些是呼叫者的問題，合約要做的是清楚地拒絕。`assert` 處理的是**程式本身的錯誤**：如果條件不成立，代表合約的邏輯寫錯了，而不是呼叫者做錯了什麼。所以 `assert` 失敗應該永遠不會在正常使用中發生，一旦發生，就是一個 bug。

0.8 之前，`assert` 失敗會執行 `INVALID` opcode，把交易剩下的 Gas 全部吃掉，比 `require` 嚴厲得多。0.8 之後改成 revert 一個 `Panic(0x01)`，剩下的 Gas 會退還。實測一筆 `assert` 失敗的交易，`gas-limit` 設 1,000,000，`gasUsed` 只有 44,053。兩者在 Gas 上已經沒有差別，差別只剩語意：看到 `Panic` 就知道是合約有 bug，看到 custom error 就知道是呼叫者的問題。

實務上 `assert` 在正式合約裡很少見，OpenZeppelin 的程式碼幾乎不用它。「`totalSupply` 永遠不超過 `cap`」這類性質更適合寫成不變量測試，在部署之前用大量隨機呼叫去打它，而不是在每次呼叫時都付 Gas 檢查一次。Day 21 會用 Foundry 的 invariant testing 做這件事。

## 3. revert data 的三種格式

revert data 本身只是一段 bytes，但有三種約定的格式，前 4 bytes 都是 selector，用來辨認是哪一種錯誤：

| 格式             | selector     | 來源                                          |
|:-----------------|:-------------|:----------------------------------------------|
| `Error(string)`  | `0x08c379a0` | `require(cond, "...")`、`revert("...")`        |
| `Panic(uint256)` | `0x4e487b71` | `assert` 失敗、溢位、除以零、陣列越界等         |
| custom error     | 各自不同      | `revert MyError(...)`、`require(cond, MyError(...))` |

`Panic` 帶的 `uint256` 是錯誤代碼，由編譯器插入，常見的幾個：

| 代碼   | 意義                                  |
|:-------|:--------------------------------------|
| `0x01` | `assert` 條件不成立                    |
| `0x11` | 算術溢位或下溢（不在 `unchecked` 區塊內） |
| `0x12` | 除以零或對零取餘數                      |
| `0x21` | 把超出範圍的值轉成 enum                 |
| `0x32` | 陣列索引越界                            |
| `0x41` | 配置過多記憶體                          |

為了看清楚三種格式的差異，寫三個行為完全相同的帳本，只差在失敗時怎麼回報：

```solidity
// src/ErrorStyleLedgers.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

// 三個行為相同的帳本，只差在失敗時回報錯誤的方式
contract StringErrorLedger {
    mapping(address account => uint256) public balanceOf;

    constructor() {
        balanceOf[msg.sender] = 1_000;
    }

    function transfer(address to, uint256 amount) external {
        uint256 balance = balanceOf[msg.sender];
        require(balance >= amount, "StringErrorLedger: insufficient balance");
        balanceOf[msg.sender] = balance - amount;
        balanceOf[to] += amount;
    }
}

contract CustomErrorLedger {
    mapping(address account => uint256) public balanceOf;

    error CustomErrorLedgerInsufficientBalance(address account, uint256 balance, uint256 needed);

    constructor() {
        balanceOf[msg.sender] = 1_000;
    }

    function transfer(address to, uint256 amount) external {
        uint256 balance = balanceOf[msg.sender];
        if (balance < amount) {
            revert CustomErrorLedgerInsufficientBalance(msg.sender, balance, amount);
        }
        balanceOf[msg.sender] = balance - amount;
        balanceOf[to] += amount;
    }
}

contract RequireCustomErrorLedger {
    mapping(address account => uint256) public balanceOf;

    error RequireCustomErrorLedgerInsufficientBalance(address account, uint256 balance, uint256 needed);

    constructor() {
        balanceOf[msg.sender] = 1_000;
    }

    function transfer(address to, uint256 amount) external {
        uint256 balance = balanceOf[msg.sender];
        require(balance >= amount, RequireCustomErrorLedgerInsufficientBalance(msg.sender, balance, amount));
        balanceOf[msg.sender] = balance - amount;
        balanceOf[to] += amount;
    }
}
```

錯誤名稱加上合約名稱當前綴，是 Day 06 起沿用的慣例：custom error 只靠 selector 辨認，兩個合約各自定義了 `InsufficientBalance(address,uint256,uint256)`，selector 會一模一樣，呼叫端分不出是哪一個合約丟出來的。這個帳本是用來比較錯誤格式的教學範例，不會被後面的財庫沿用。

測試驗證三者的 revert data：

```solidity
// test/ErrorStyles.t.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";
import {
    StringErrorLedger,
    CustomErrorLedger,
    RequireCustomErrorLedger
} from "../src/ErrorStyleLedgers.sol";

contract ErrorStylesTest is Test {
    StringErrorLedger private stringLedger;
    CustomErrorLedger private customLedger;
    RequireCustomErrorLedger private requireCustomLedger;
    address private bob = makeAddr("bob");

    function setUp() public {
        stringLedger = new StringErrorLedger();
        customLedger = new CustomErrorLedger();
        requireCustomLedger = new RequireCustomErrorLedger();
    }

    // 錯誤字串被包成 Error(string)：selector 0x08c379a0 加上 ABI 編碼的字串
    function testStringErrorIsEncodedAsErrorString() public {
        vm.prank(bob);
        try stringLedger.transfer(address(this), 1) {
            fail();
        } catch (bytes memory revertData) {
            assertEq(bytes4(revertData), bytes4(0x08c379a0));
            assertEq(revertData, abi.encodeWithSignature("Error(string)", "StringErrorLedger: insufficient balance"));
        }
    }

    // custom error 只有 4 bytes 的 selector 加上參數
    function testCustomErrorCarriesArguments() public {
        vm.prank(bob);
        vm.expectRevert(
            abi.encodeWithSelector(CustomErrorLedger.CustomErrorLedgerInsufficientBalance.selector, bob, 0, 1)
        );
        customLedger.transfer(address(this), 1);
    }

    function testRequireWithCustomErrorRevertsTheSameWay() public {
        vm.prank(bob);
        vm.expectRevert(
            abi.encodeWithSelector(
                RequireCustomErrorLedger.RequireCustomErrorLedgerInsufficientBalance.selector, bob, 0, 1
            )
        );
        requireCustomLedger.transfer(address(this), 1);
    }

    function testRevertUndoesEveryWriteInTheCall() public {
        vm.expectRevert();
        customLedger.transfer(bob, 1_001);

        assertEq(customLedger.balanceOf(address(this)), 1_000);
        assertEq(customLedger.balanceOf(bob), 0);
    }
}
```

第一個測試用的是 `try`／`catch (bytes memory revertData)`，直接拿到原始的 revert data 拆開看。`catch` 還有兩種專門的寫法：`catch Error(string memory reason)` 只接 `Error(string)`，`catch Panic(uint256 code)` 只接 `Panic`，custom error 則只能用 `bytes` 接住再自己解碼。`try`／`catch` 只能用在外部呼叫上，這和明天 Day 10 的外部呼叫有關，屆時再細談。

### 鏈下看到的 revert data

同樣的三個帳本部署到 anvil，用一個沒有餘額的地址呼叫 `transfer`，`cast call` 會顯示節點回傳的錯誤：

```text
# StringErrorLedger
execution reverted: StringErrorLedger: insufficient balance, data: "0x08c379a0…"

# CustomErrorLedger
execution reverted: custom error 0x5a275e3d: 00000000000000000000000070997970c5…, data: "0x5a275e3d…"
```

（`data` 後面的內容省略。）錯誤字串是自我描述的，節點直接解碼成人讀得懂的句子。custom error 在節點眼中只是一個 selector 加上三個 32 bytes 的參數，不知道它叫什麼名字。要解讀它，得拿合約的 ABI 或錯誤簽章（最後一個參數放 `cast call` 回傳的完整 `data`，這裡省略中段）：

```bash
cast decode-error --sig "CustomErrorLedgerInsufficientBalance(address,uint256,uint256)" 0x5a275e3d00…01
```

```text
0x70997970C51812dc3A010C7d01b50e0d17dc79C8
0
1
```

這是 custom error 的代價：錯誤的「名稱」不在鏈上，而在 ABI 裡。所以合約部署後要在 Etherscan 上驗證原始碼（Day 41），錢包與區塊瀏覽器才能把 `0x5a275e3d` 顯示成 `CustomErrorLedgerInsufficientBalance`。昨天那筆超過上限的鑄造也是如此，它的 revert data 開頭是 `0x9e79f854`，也就是 `ERC20ExceededCap(uint256,uint256)`。

換來的好處是參數。錯誤字串很難帶上動態資訊，要在鏈上把餘額轉成字串再串接，又貴又麻煩；custom error 把「誰、餘額多少、要轉多少」原樣交給呼叫者，前端可以直接顯示「餘額 0，需要 1」，測試也可以斷言每個參數的值。

## 4. custom error 到底省了多少

規劃這篇時寫的是「custom error 比 revert string 省 Gas」。實際量過之後，這句話要講得更精確。用三個帳本在相同條件下各量一次（Foundry 預設不開 optimizer，部署 Gas 在 anvil 上量）：

| 項目                  | 錯誤字串    | `if` ＋ custom error | `require` ＋ custom error |
|:----------------------|------------:|---------------------:|-------------------------:|
| Runtime bytecode      | 1,095 bytes |          1,011 bytes |              1,017 bytes |
| 部署 Gas              |     312,413 |              294,545 |                  295,853 |
| `transfer` 成功       |      49,998 |               49,998 |                   50,021 |
| `transfer` 失敗       |      24,483 |               24,619 |                   24,628 |

省下來的主要是**部署成本與合約大小**。錯誤字串會原封不動地編進 bytecode，`"StringErrorLedger: insufficient balance"` 這 39 個字元連同 ABI 編碼的程式碼，讓合約多了 84 bytes。部署時每 byte 的 runtime code 要付 200 Gas，84 bytes 就是 16,800，這是部署 Gas 差了將近一萬八的主要來源。合約有幾十個錯誤時，這個差距會直接影響能不能塞進 EIP-170 規定的 24,576 bytes 上限。

成功路徑則幾乎沒有差別：錯誤字串只在失敗時才被讀取，正常執行不會碰到它。`require` 版本多出的 23 Gas，就是第 2 節說的「參數一定會先被計算」。

失敗路徑的結果和直覺相反：帶三個參數的 custom error 反而比錯誤字串多了一百多 Gas，因為它的 revert data 是 4 ＋ 3 × 32 = 100 bytes，比這段字串的編碼還長。另外量了一個不帶參數的版本 `error InsufficientBalance()`，失敗時是 24,216，比錯誤字串少 267。換句話說，custom error 在執行期的成本取決於帶了多少參數，而參數正是它比字串有用的地方。開啟 optimizer（200 runs）之後，三者失敗路徑的差距縮小到 30 Gas 以內，bytecode 則是 528、481、498 bytes，大小上的優勢仍在。

所以選 custom error 的理由排序應該是：結構化的參數、較小的合約、較低的部署成本，最後才是執行期的 Gas。失敗的呼叫本來就是少數，在那幾十 Gas 上做取捨意義不大。

## 5. 溢位：從 SafeMath 到 Panic(0x11)

`uint8` 能存 0 到 255。0.8 之前，`255 + 1` 的結果是 `0`，`0 - 1` 的結果是 `255`，EVM 的算術是模 2 的 n 次方運算，結果超出範圍就默默繞回，不會報錯。對處理餘額的合約來說，這等於帳本可以被算錯而沒有人知道。

2018 年 4 月的 BeautyChain（BEC）代幣就是這樣出事的。它的 `batchTransfer` 有一行：

```solidity
uint256 amount = uint256(cnt) * _value;
```

攻擊者傳入兩個收款地址和 `_value = 2**255`，乘起來剛好是 2 的 256 次方，溢位成 `0`。接下來的餘額檢查「發送者有沒有 `amount` 那麼多」輕鬆通過，然後兩個收款地址各自被加上 `2**255` 個代幣。這個漏洞編號 CVE-2018-10299，多個交易所隨即暫停了 BEC 的交易。

0.8 之前的標準解法是 OpenZeppelin 的 `SafeMath`：把每個 `a + b` 改寫成 `a.add(b)`，函式裡檢查結果，溢位就 revert。0.8 把這個檢查搬進編譯器，所有算術預設都會檢查，溢位就 revert `Panic(0x11)`。`SafeMath` 因此失去存在的理由，OpenZeppelin v5 已經把它移除了。

```solidity
// src/ArithmeticExamples.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";

contract ArithmeticExamples {
    function addChecked(uint8 a, uint8 b) external pure returns (uint8) {
        return a + b;
    }

    function addUnchecked(uint8 a, uint8 b) external pure returns (uint8) {
        unchecked {
            return a + b;
        }
    }

    function subtractChecked(uint256 a, uint256 b) external pure returns (uint256) {
        return a - b;
    }

    function divideUnchecked(uint256 a, uint256 b) external pure returns (uint256) {
        unchecked {
            return a / b;
        }
    }

    function narrowToUint8(uint256 value) external pure returns (uint8) {
        return uint8(value);
    }

    function safeNarrowToUint8(uint256 value) external pure returns (uint8) {
        return SafeCast.toUint8(value);
    }

    function sumChecked(uint256[] calldata values) external pure returns (uint256 total) {
        for (uint256 i = 0; i < values.length; i++) {
            total += values[i];
        }
    }

    function sumUnchecked(uint256[] calldata values) external pure returns (uint256 total) {
        for (uint256 i = 0; i < values.length; i++) {
            unchecked {
                total += values[i];
            }
        }
    }
}
```

```solidity
// test/ArithmeticExamples.t.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, stdError} from "forge-std/Test.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {ArithmeticExamples} from "../src/ArithmeticExamples.sol";

contract ArithmeticExamplesTest is Test {
    ArithmeticExamples private examples;

    function setUp() public {
        examples = new ArithmeticExamples();
    }

    // 0.8 之後溢位是 Panic(0x11)
    function testAdditionOverflowPanics() public {
        vm.expectRevert(stdError.arithmeticError);
        examples.addChecked(255, 1);
    }

    function testSubtractionUnderflowPanics() public {
        vm.expectRevert(abi.encodeWithSignature("Panic(uint256)", 0x11));
        examples.subtractChecked(0, 1);
    }

    // unchecked 回到 0.8 之前的行為：靜默繞回
    function testUncheckedAdditionWrapsAround() public view {
        assertEq(examples.addUnchecked(255, 1), 0);
    }

    // 除以零不受 unchecked 影響，永遠是 Panic(0x12)
    function testDivisionByZeroPanicsEvenWhenUnchecked() public {
        vm.expectRevert(stdError.divisionError);
        examples.divideUnchecked(1, 0);
    }

    // 顯式型別轉換不做溢位檢查：300 變成 44
    function testExplicitNarrowingTruncatesSilently() public view {
        assertEq(examples.narrowToUint8(300), 44);
    }

    function testSafeCastRejectsNarrowingOverflow() public {
        vm.expectRevert(abi.encodeWithSelector(SafeCast.SafeCastOverflowedUintDowncast.selector, 8, 300));
        examples.safeNarrowToUint8(300);
    }
}
```

`stdError.arithmeticError` 是 forge-std 預先編碼好的 `Panic(0x11)`，第二個測試則手動寫出同樣的內容，兩者等價。`stdError.divisionError` 對應 `Panic(0x12)`。

### 0.8 沒有檢查的地方：型別轉換

第五個測試是 0.8 之後仍然存在的坑：**顯式的型別轉換不檢查溢位**。`uint8(300)` 不會 revert，而是只保留最低的 8 bits，300 是二進位 `1_0010_1100`，砍掉最高位剩下 `0010_1100`，也就是 44。

這在 Day 04 的打包技巧裡特別容易出現：為了把欄位塞進同一個 slot，把 `uint256` 的計算結果轉成 `uint64` 或 `uint128` 存起來。計算過程都有溢位檢查，最後那個轉換卻沒有。思考題裡的 `uint192 spentToday` 如果寫成 `spentToday = uint192(spentToday + amount)`，`amount` 夠大時就會被截斷成一個很小的數字，每日上限形同虛設。

OpenZeppelin 的 `SafeCast` 補上了這個檢查：`SafeCast.toUint8(300)` 會 revert `SafeCastOverflowedUintDowncast(8, 300)`，兩個參數分別是目標位元數與原始值。Foundry 的 linter 也會在 `forge build` 時對 `uint8(value)` 這類轉換提出 `unsafe-typecast` 警告，確定安全時要在那一行上方加註解說明理由，才能把警告關掉。

## 6. unchecked：什麼時候才安全

`unchecked` 區塊會關掉裡面的溢位檢查，回到 0.8 之前的繞回行為。用它的唯一理由是省 Gas。100 個元素的加總，兩個版本的差距：

| 函式           | optimizer 關閉 | optimizer 開啟（200 runs） |
|:---------------|---------------:|---------------------------:|
| `sumChecked`   |         31,199 |                     18,177 |
| `sumUnchecked` |         13,321 |                     11,999 |

每個元素省下 60 到 180 Gas，看起來很誘人。但 `sumUnchecked` 是一個**錯誤的** `unchecked` 用法：`values` 由呼叫者傳入，任何人都可以傳兩個 `2**255` 進來，總和就繞回成 `0`，和 BEC 是同一種漏洞。

`unchecked` 安全的前提只有一個：**在這個區塊之前，已經有其他條件證明了它不可能溢位**。OpenZeppelin 的 `ERC20._update` 是最好的範本：

```solidity
// lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol（節錄）
function _update(address from, address to, uint256 value) internal virtual {
    if (from == address(0)) {
        // Overflow check required: The rest of the code assumes that totalSupply never overflows
        _totalSupply += value;
    } else {
        uint256 fromBalance = _balances[from];
        if (fromBalance < value) {
            revert ERC20InsufficientBalance(from, fromBalance, value);
        }
        unchecked {
            // Overflow not possible: value <= fromBalance <= totalSupply.
            _balances[from] = fromBalance - value;
        }
    }

    if (to == address(0)) {
        unchecked {
            // Overflow not possible: value <= totalSupply or value <= fromBalance <= totalSupply.
            _totalSupply -= value;
        }
    } else {
        unchecked {
            // Overflow not possible: balance + value is at most totalSupply, which we know fits into a uint256.
            _balances[to] += value;
        }
    }

    emit Transfer(from, to, value);
}
```

整個函式只有一個加法保留了檢查：鑄造時的 `_totalSupply += value`。其餘三個運算都包在 `unchecked` 裡，每一個都附註了不可能溢位的理由：

- `fromBalance - value`：上一行剛檢查過 `fromBalance >= value`。
- `_totalSupply -= value`：被銷毀的數量不會超過某個人的餘額，而任何人的餘額都不超過總量。
- `_balances[to] += value`：任何人的餘額加上這筆轉入，都不會超過總量，而總量已經在鑄造時被檢查過不會溢位。

這三個理由都建立在同一條不變量上：**所有人的餘額加總等於 `totalSupply`**。只要守住鑄造那一個入口，其他地方就不必重複檢查。這也說明了 `unchecked` 的真正成本：省下的 Gas 是用「依賴其他程式碼的正確性」換來的。哪天有人在 `_update` 之外直接改了 `_balances`，這條不變量被打破，三個 `unchecked` 就同時變成漏洞。

判斷能不能用 `unchecked`，可以照這個順序問：

1. **溢位的邊界能不能用一個已經檢查過的條件證明？** 不能就不要用。
2. **這個證明是不是只依賴同一個函式內的程式碼？** 依賴其他地方的不變量時，要像 OpenZeppelin 一樣在註解裡寫清楚依賴的是什麼。
3. **省下的 Gas 是在熱路徑上嗎？** `transfer` 每天被呼叫幾萬次，值得；一個只有管理者會呼叫的函式，省那幾十 Gas 不值得增加審查的負擔。

還有一個不必再自己做的優化：迴圈計數器的 `i++`。以前常見的寫法是在迴圈結尾寫 `unchecked { ++i; }`，0.8.22 之後，編譯器會自動對「計數器從小於某個上限的條件遞增、迴圈內沒有修改計數器」的 `for` 迴圈省略溢位檢查。上面兩個 `sum` 函式的差距，因此完全來自 `total +=` 那一行。

## 7. TreasuryToken 用到了哪些

回頭看前幾天的 `TreasuryToken`，今天的內容其實都已經在裡面了：

- 自己定義的兩個錯誤 `TreasuryTokenTransferToTokenContract` 與 `TreasuryTokenInvalidAdmin` 都是加了前綴的 custom error，用 `if` 加 `revert` 拋出。
- 繼承來的錯誤 `ERC20InsufficientBalance`、`ERC20ExceededCap`、`AccessControlUnauthorizedAccount`、`EnforcedPause` 也都是 custom error，命名遵循 ERC-6093。
- 餘額的加減由 `ERC20._update` 處理，`unchecked` 的使用與證明都在 OpenZeppelin 那一側，我們沒有寫任何算術。

這也是 Day 06「從不自己寫標準合約」的另一面：算術與錯誤處理最容易出錯的部分，已經被審計過的程式碼承擔了。第三階段的財庫會有自己的算術（每日上限、Aave 的利息計算），屆時每一個 `unchecked` 和每一次型別轉換，都要能回答本篇第 5、6 節的問題。

新增的兩個合約與兩個測試檔加上前幾天的五個檔案，七個測試檔共四十個測試，`forge test` 全部通過（Forge 1.8.3、solc 0.8.37、OpenZeppelin v5.6.1）。

---

## 今日練習

1. 把 `ErrorStyleLedgers.sol`、`ArithmeticExamples.sol` 與兩個測試檔放進專案，執行 `forge test` 確認四十個測試全部通過，再用 `forge test --gas-report` 對照第 4 節的表格。
2. 在 `ArithmeticExamples` 加一個函式 `readAt(uint256[] calldata values, uint256 index)` 回傳 `values[index]`，寫一個測試用 `stdError.indexOOBError` 斷言越界時的 `Panic` 代碼。
3. 把 `sumUnchecked` 改成安全的版本：保留 `unchecked`，但在函式開頭加上一個條件，讓溢位在數學上不可能發生（提示：限制陣列長度與每個元素的大小）。想一想這個限制是否合理，以及它和直接用 `sumChecked` 比起來划不划算。

## 今日思考題

`ERC20._update` 的三個 `unchecked` 都依賴「所有人的餘額加總等於 `totalSupply`」這條不變量。**如果有人繼承 `ERC20`，另外寫了一個 `function airdrop(address to, uint256 amount) internal { _balances[to] += amount; }`（假設 `_balances` 可以被子合約存取），哪一個 `unchecked` 會最先出問題？攻擊者要怎麼利用它？**

---

*這是 45 天技術轉型紀錄的 Day 09。revert 讓狀態永遠不會寫一半，但它擋不住一個沒有被檢查到的錯誤數字。*

**在 Web2 專案裡遇過整數溢位或型別截斷造成的 bug 嗎？當時是怎麼發現的？歡迎在下方留言交流。**

---

明天 Day 10，我們從今天只能用在外部呼叫上的 `try`／`catch` 出發：`public`、`external`、`internal`、`private` 各自畫出了什麼邊界，為什麼 `private` 不等於秘密，以及合約如何透過 `interface` 呼叫另一個合約，又為什麼這等於把控制權交出去。

## Reference

- [revert 撤銷狀態、Error(string) 與 Panic(uint256) 的編碼，以及各個 Panic 代碼的意義 — Solidity Documentation, Error handling: Assert, Require, Revert and Exceptions](https://docs.soliditylang.org/en/latest/control-structures.html#error-handling-assert-require-revert-and-exceptions)
- [custom error 的宣告、selector 與 ABI 編碼 — Solidity Documentation, Errors and the Revert Statement](https://docs.soliditylang.org/en/latest/contracts.html#errors-and-the-revert-statement)
- [0.8.0 起算術預設檢查、assert 改為 Panic 而不再消耗全部 Gas — Solidity Documentation, Solidity v0.8.0 Breaking Changes](https://docs.soliditylang.org/en/latest/080-breaking-changes.html)
- [unchecked 區塊的語意，以及顯式型別轉換不檢查溢位 — Solidity Documentation, Checked or Unchecked Arithmetic](https://docs.soliditylang.org/en/latest/control-structures.html#checked-or-unchecked-arithmetic)
- [require 搭配 custom error 在 0.8.26 僅支援 via-IR — Solidity v0.8.26 Release Announcement](https://soliditylang.org/blog/2024/05/21/solidity-0.8.26-release-announcement/)
- [require 搭配 custom error 在 0.8.27 起支援一般編譯流程 — Solidity v0.8.27 Release Announcement](https://soliditylang.org/blog/2024/09/04/solidity-0.8.27-release-announcement/)
- [for 迴圈計數器自動省略溢位檢查的條件 — Solidity v0.8.22 Release Announcement](https://soliditylang.org/blog/2023/10/25/solidity-0.8.22-release-announcement/)
- [BeautyChain batchTransfer 乘法溢位漏洞 — NVD, CVE-2018-10299](https://nvd.nist.gov/vuln/detail/CVE-2018-10299)
- [SafeMath 在 v5.0 被移除的紀錄 — OpenZeppelin Contracts CHANGELOG](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/CHANGELOG.md)
- [_update 中三個 unchecked 運算與其不可能溢位的註解 — OpenZeppelin Contracts v5.6.1, ERC20.sol](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v5.6.1/contracts/token/ERC20/ERC20.sol)
- [toUint8 等縮窄轉換與 SafeCastOverflowedUintDowncast 錯誤 — OpenZeppelin Contracts v5.6.1, SafeCast.sol](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v5.6.1/contracts/utils/math/SafeCast.sol)
- [每 byte runtime code 200 Gas 的部署成本 — Ethereum Yellow Paper](https://ethereum.github.io/yellowpaper/paper.pdf)
- [合約 runtime code 不得超過 24,576 bytes — EIP-170: Contract code size limit](https://eips.ethereum.org/EIPS/eip-170)
- [stdError.arithmeticError、divisionError、indexOOBError 等預先編碼的 Panic — Foundry Book, forge-std: Std Errors](https://getfoundry.sh/reference/forge-std/std-errors)
- [cast decode-error 的用法 — Foundry Book, cast decode-error](https://getfoundry.sh/cast/reference/decode-error)
