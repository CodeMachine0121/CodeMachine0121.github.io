---
title: "Day 04：Gas 經濟學：如何寫出「省錢」的智能合約？"
datetime: "2026-10-04"
description: "EVM 的成本幾乎都花在 Storage 上。從操作碼的 Gas 價格出發，整理變數打包、減少 Storage 存取、constant 與 immutable 等寫出省錢合約的技巧。"
image: ""
parent: "From Web2 to Web3: Building Institutional-Grade DeFi Systems"
draft: false
---

在傳統開發中，我們關注的是伺服器的延遲（Latency）與吞吐量（Throughput）。但在 Ethereum 或其他 EVM 鏈上，每一行程式碼的執行都要消耗 **Gas**。合約如果需要頻繁進行金融運算，寫得不夠省會直接拉高使用者的手續費，嚴重時整個 DeFi 協議會因為太貴而沒人使用。

## 1. Gas 是什麼？

Gas 是 EVM 對計算資源的計價單位。粗略來說：

- **算術運算（加減乘除）：** 非常便宜。
- **讀取 memory 與 calldata：** 便宜。
- **讀取 Storage：** 不便宜，一筆交易中第一次讀某個 slot 要 2,100。
- **寫入／修改 Storage：** **昂貴。**
- **部署合約：** **極度昂貴。**

## 2. 讓合約「瘦身」的四個方向

### A. 變數打包（Storage Packing）

EVM 的 Storage 以 **32 bytes（256 bits）** 為一個插槽（slot）。小於 32 bytes 的變數放在一起，可以共用同一個 slot。

- **反面教材：** 兩個 `uint256` 各佔一個 slot。
- **正面教材：** 兩個 `uint128` 相鄰宣告，會共用一個 slot；如果它們在同一筆交易中一起更新，就少了一次昂貴的 Storage 寫入。

### B. 減少對 Storage 的存取

每一次 `SLOAD`（讀）與 `SSTORE`（寫）都要消耗 Gas。

- **優化方式：** 函式需要多次使用同一個 Storage 變數時，在函式開頭把它讀進區域變數，後續運算都用區域變數，最後再一次寫回 Storage。

### C. 只給外部呼叫的函式用 external

不需要在合約內部被呼叫的函式，宣告成 `external`。早期版本的 Solidity 中，`public` 函式的陣列與字串參數一律會複製到 memory，`external` 則直接從 calldata 讀，差距明顯；0.6.9 之後 `public` 函式也能宣告 `calldata` 參數，Gas 差距已經縮小。現在選 `external` 的主要理由，是它把函式的呼叫邊界寫得很清楚：這個函式只給外部呼叫，屬於防禦性開發的習慣。

### D. 各型別的 Gas 消耗

前面三個方向其實繞著同一件事：EVM 的成本幾乎都花在 Storage 上。要判斷一個型別貴不貴，得先看底層操作碼的價格。下表以 Berlin、London 升級之後的規則（EIP-2929、EIP-3529）為準：

| 操作                 | Gas               | 說明                                                  |
|:---------------------|:------------------|:------------------------------------------------------|
| `ADD` / `SUB`        | 3                 | 加減法                                                |
| `MUL` / `DIV`        | 5                 | 乘除法                                                |
| `MLOAD` / `MSTORE`   | 3 起              | 另計 memory 擴張成本，用得越多越貴（二次方成長）      |
| `SLOAD`（cold）      | 2,100             | 這筆交易第一次讀某個 slot                             |
| `SLOAD`（warm）      | 100               | 同一筆交易內再讀同一個 slot                           |
| `SSTORE` 0 → 非 0    | 22,100            | 20,000 加上 cold 存取的 2,100                         |
| `SSTORE` 非 0 → 非 0 | 5,000             | 2,900 加上 cold 存取的 2,100                          |
| `SSTORE` 非 0 → 0    | 5,000，退還 4,800 | 清空 slot 有部分退款，但退款上限是交易 Gas 的五分之一 |
| Calldata             | 4 或 16 / byte    | 零 byte 4、非零 byte 16                               |

一次冷寫入 22,100，大約是一次加法的七千倍。有了這張表，再來看各型別的差異：

| 型別                     | 大小        | Storage 佔用方式                                                                           | Gas 上要注意的事                                               |
|:-------------------------|:------------|:-------------------------------------------------------------------------------------------|:---------------------------------------------------------------|
| `uint256` / `int256`     | 32 bytes    | 獨佔 1 個 slot                                                                             | EVM 的原生字長，運算不需要額外處理                             |
| `uint8` ～ `uint128`     | 1～16 bytes | 可與相鄰變數共用 slot                                                                      | 只有打包進 Storage 才省；當區域變數用反而略貴                  |
| `bool`                   | 1 byte      | 可打包                                                                                     | 單獨存放時仍佔滿一個 slot；`false` → `true` 是 0 → 非 0 的寫入 |
| `address`                | 20 bytes    | 剩下 12 bytes 可打包                                                                       | 常見組合是 `address` 加 `uint96`，剛好湊滿 32 bytes            |
| `bytes32`                | 32 bytes    | 1 個 slot                                                                                  | 長度固定，成本可預測                                           |
| `string` / `bytes`       | 動態        | 31 bytes 以內存在 1 個 slot；超過時長度佔 1 個 slot，內容從 `keccak256(slot)` 開始連續存放 | 內容每多 32 bytes 就多一次 `SSTORE`                            |
| `T[]`（動態陣列）        | 動態        | 長度佔 1 個 slot，元素從 `keccak256(slot)` 開始                                            | `push` 要同時寫元素與長度；遍歷成本和長度成正比                |
| `mapping(K => V)`        | 無          | 不存長度，每個 key 的位置是 `keccak256(key, slot)`                                         | 單筆存取 O(1)，但無法遍歷                                      |
| `struct`                 | 各欄位加總  | 依宣告順序打包                                                                             | 欄位順序決定佔用幾個 slot                                      |
| `constant` / `immutable` | 無          | 不佔 Storage                                                                               | 值直接寫在 bytecode 裡，讀取約 3 Gas，對比 `SLOAD` 的 2,100    |

表格之外，有四件事值得單獨說明。

**小型別不一定比較省。** EVM 每次運算都以 256 bits 為單位，`uint8` 的區域變數在運算後，編譯器還得插入遮罩（masking）指令把高位清掉。所以迴圈計數器、函式內的暫存值直接用 `uint256` 就好，`uint8`、`uint128` 這類小型別留給要打包進 Storage 的欄位。

**旗標用 `uint256` 的 1 和 2，而不是 `bool`。** OpenZeppelin 的 `ReentrancyGuard` 就是這樣做的。如果用 `bool`，每次呼叫都要經歷 `false` → `true` → `false`，也就是 0 → 非 0 的 20,000 寫入，再靠一筆有上限的退款補回來；改用 1 和 2 之後，狀態切換一直是非 0 → 非 0，每次寫入只要 2,900（warm）。另外 `bool` 與其他小型別共用 slot 時，寫入前還得先讀出整個 slot 再改其中幾個 bit。

**struct 的欄位順序會直接反映在 slot 數量上。** 同樣三個欄位，排法不同就差一個 slot：

```solidity
// 佔 3 個 slot
struct Position {
    uint128 amount;   // slot 0（16 bytes）
    uint256 price;    // slot 1（slot 0 剩下的 16 bytes 放不下 32 bytes）
    uint64  openedAt; // slot 2
}

// 佔 2 個 slot
struct Position {
    uint256 price;    // slot 0
    uint128 amount;   // slot 1（16 bytes）
    uint64  openedAt; // slot 1（再 8 bytes，合計 24 bytes）
}
```

要注意的是，打包的好處要在「同一筆交易一起更新這幾個欄位」時才會完整發揮；如果兩個欄位總是分開更新，共用 slot 省下的只有 slot 數量，寫入次數並沒有變少。

**不會變的值用 `constant` 或 `immutable`。** 像手續費率上限這種寫死的參數用 `constant`，部署時才決定的值（例如管理員地址）用 `immutable`。兩者都不佔 Storage，讀取時不必付 `SLOAD` 的 2,100。同理，`external` 函式的陣列或字串參數宣告成 `calldata` 而不是 `memory`，可以省掉一次複製到 memory 的成本。

> 注意：這些數字會隨硬分叉調整，例如 EIP-7623 就提高了大量使用 calldata 之交易的最低計價。實際成本請以 Foundry Gas Report 的量測結果為準。

## 3. 如何量化優化成效？

程式碼變「省」了沒有，不能憑感覺判斷，要看數據：

1. **Foundry Gas Report：** 執行 `forge test --gas-report`，就能看到每個函式的 Gas 消耗統計；`foundry.toml` 的 `gas_reports` 設定可以指定要報告哪些合約。
2. **Solidity Optimizer：** 在 `foundry.toml` 設定 `optimizer = true` 與 `optimizer_runs`。`optimizer_runs` 代表預期每個函式會被呼叫的次數，數字越大，編譯器越偏向壓低執行成本，代價是部署成本變高；數字越小則反過來。會被頻繁呼叫的 DeFi 合約通常設得比較高。

## 4. 今日練習

調整合約變數的宣告順序，觀察 Gas 消耗的變化：

```solidity
// 優化前：3 個 slot
uint64 public lastUpdate;  // slot 0（8 bytes）
uint256 public balance;    // slot 1（slot 0 剩下的 24 bytes 放不下 32 bytes）
uint8 public status;       // slot 2

// 優化後：2 個 slot
uint256 public balance;    // slot 0
uint64 public lastUpdate;  // slot 1（8 bytes）
uint8 public status;       // slot 1（再 1 byte，合計 9 bytes）
```

`lastUpdate` 存的是區塊時間戳，`uint64` 足以涵蓋數千億年。寫一個同時更新 `lastUpdate` 與 `status` 的函式，用 `forge test --gas-report` 比較兩種排法的差距。

---

## 今日思考題

合約常常需要儲存「授權簽署者的地址列表」。**如果這個列表需要頻繁變動（新增或刪除管理員），要用什麼資料結構來兼顧安全性與 Gas 效率？**（提示：比較 `mapping` 與 `array` 的成本差異）

---

*這是 45 天技術轉型紀錄的 Day 04。能用數字說明每一行程式碼花了多少 Gas，才算真正掌握了它的成本。*

**開發時有沒有因為 Gas 太高而被迫重構邏輯的經驗？歡迎在留言區分享。**

---

明天 Day 05，我們要動手實作 ERC-20 標準，發行第一個代幣。
