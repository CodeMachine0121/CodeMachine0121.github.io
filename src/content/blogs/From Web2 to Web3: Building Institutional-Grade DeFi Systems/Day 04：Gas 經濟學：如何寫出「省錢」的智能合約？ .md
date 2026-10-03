---
title: "Day 04：Gas 經濟學：如何寫出「省錢」的智能合約？"
datetime: "2026-10-04"
image: ""
parent: "From Web2 to Web3: Building Institutional-Grade DeFi Systems"
draft: false
---

在傳統開發中，我們關注的是伺服器的處理速度（Latency）與吞吐量（Throughput）。但在 Ethereum 或 EVM 上，執行每一行程式碼都需要消耗 **Gas**。如果你的合約需要頻繁進行金融運算，寫得「不夠省」的程式碼，會直接導致使用者體驗大幅下降，甚至讓整個 DeFi 協議因為手續費太高而沒人使用。

### 1. Gas 是什麼？
Gas 本質上是 EVM 對於計算資源的計價單位。簡單來說：
*   **讀取資料：** 便宜。
*   **計算運算 (加減乘除)：** 非常便宜。
*   **寫入/修改資料 (Storage)：** **昂貴。**
*   **部署合約：** **極度昂貴。**

### 2. 三個讓你程式碼「瘦身」的核心技巧

#### A. 變數封裝 (Storage Packing)
EVM 的 Storage 空間是以 **32 bytes (256 bits)** 為一個插槽 (Slot)。如果你的變數小於 32 bytes，將它們放在一起會比分開存放更節省。
*   **反面教材：** 宣告兩個 `uint256` 佔用兩個 Slot。
*   **正面教材：** 如果你有兩個 `uint128`，把它們寫在一起，它們會共用一個 Slot。這能直接節省下一次寫入 Storage 的昂貴成本。

#### B. 減少對 Storage 的讀取
每次從 Storage 讀取資料（如 `sstore` 或 `sload` 操作碼）都需要消耗 Gas。
*   **優化方式：** 如果一個函式需要多次使用同一個 Storage 變數，請在函式開始時將其讀取到區域變數 (Local Variable)，後續運算都使用這個區域變數，最後再將結果寫回 Storage。

#### C. 使用 `external` 代替 `public`
對於不需要在合約內部被呼叫的函數，使用 `external`。這不僅能節省 Gas（因為參數不需要拷貝到 memory），還能明確函數的訪問邊界，這是一種良好的防禦性開發習慣。

#### D. 各型別的 Gas 消耗
前面三個技巧其實都繞著同一件事：EVM 的成本幾乎都花在 Storage 上。要判斷一個型別貴不貴，得先看底層操作碼的價格。下表以 Berlin、London 升級之後的規則（EIP-2929、EIP-3529）為準：

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



### 3. 如何量化你的優化成效？
作為專業開發者，我們不能憑感覺說程式碼變「快」或變「省」了，必須依賴數據：
1.  **Foundry Gas Report：** 在 `foundry.toml` 中開啟 `gas_reports` 設定，每次測試都能看到詳細的 Gas 消耗統計。
2.  **Solidity Optimizer：** 在編譯設定中開啟 Optimizer（例如設定 `runs: 1000`）。這會告訴編譯器對程式碼進行最佳化，減少不必要的操作碼。

### 4. 今日練習
請嘗試重新整理你的合約變數排列順序，觀察 Gas 消耗的變化：

```solidity
// 優化前的結構 (消耗較多 Gas)
uint256 public balance;
uint8 public status; // 會佔據額外的 Slot
uint256 public lastUpdate;

// 優化後的結構 (將小變數並排，節省一個 Slot)
uint256 public balance;
uint256 public lastUpdate;
uint8 public status; 
```

---

### 今日思考題：
在設計一個智能合約時，我們通常需要儲存「授權簽名者的地址列表」。**如果這是一個需要頻繁變動（增加或刪除管理員）的列表，你會傾向於使用什麼資料結構來兼顧安全性與 Gas 效率？**（提示：考慮 `mapping` 與 `array` 的成本差異）

---

*我正在進行一場 60 天的技術轉型挑戰，這是 Day 04。透過精確的 Gas 控制，我們正在將開發思維從「能運作」提升到「具備工程美感」的層次。*

**你在開發時有遇到過因為 Gas 費太高而被迫重構邏輯的經驗嗎？歡迎在留言區分享你的優化秘訣！**

---

**Day 4 進度達成！掌握了 Gas 優化，你就已經領先了大部分的入門開發者。明天 Day 5，我們將正式開始「發行你的第一個代幣」，實作 ERC-20 標準！**