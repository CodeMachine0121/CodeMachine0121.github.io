---
title: 'STM, Software Transactional Memory'
datetime: "2025-01-21"
---

接續上篇，書中有一個小篇章在講述狀態這件事情，並講述到 STM 這個防併發的做法，覺得蠻有趣的故作個筆記。

## What's Software Transaction Memory

簡單來說，它是個限制存取資源的機制，STM 透過把一組 **(讀取, 寫入)** 封裝在一個 **transaction** 中，來實現所謂的操作原子性，其中最主要的目的在於避免資源競爭、Dead-Lock 的情況發生。

以下是 STM 的一些特性：
<!--more-->

- 原子性：在 STM 中，所有的讀取和寫入操作都被視為一個整體，這些操作要麼全部成功，要麼完全不執行。這一特性類似於數據庫中的 ACID 屬性，但 STM 主要針對記憶體操作，而不是持久化存儲。

- 樂觀併發：STM 通常採用樂觀的方式來處理併發操作。這意味著 transaction 在執行時不會立即鎖定資源，而是記錄所有的讀取和寫入操作，並在 transaction 結束時檢查是否有其他 transaction 對其訪問的資源進行了修改。如果發現衝突，則會中止當前 transaction 並重新執行。

- 可組合性和模塊性：STM 的設計使得不同的 transaction 可以輕鬆組合，這樣開發者可以構建更高層次的併發抽象，而無需關心底層的同步細節，這提高了程式碼的可維護性和可重用性。

## How STM Work

1. Transaction 的開始
在 STM 中，開發者定義一個 transaction，這是一組要執行的讀取和寫入操作。這些操作被封裝在一個原子操作中，確保它們要麼全部成功，要麼完全不執行。

2. 讀取和寫入操作
在 transaction 執行期間，所有的讀取和寫入操作都會被記錄。這些操作不會立即影響共享記憶體的狀態，而是先在內部的 transaction 上下文中進行。這樣，其他 transaction 無法看到這些操作的中間狀態，從而避免了競爭條件的發生。

3. Transaction 的驗證
當 transaction 中的所有操作完成後，系統會進行驗證，檢查在 transaction 執行期間是否有其他 transaction 對所涉及的共享記憶體進行了修改。如果沒有發現衝突，則 transaction 可以提交，所有的變更將被永久應用到共享記憶體中。

4. Transaction 的 commit/rollback
   - commit：如果驗證成功，transaction 的所有變更將被應用，並且這些變更對其他 transaction 可見。
   - rollback：如果在驗證過程中發現衝突，則當前 transaction 將被中止，所有的變更將被撤銷，並且 transaction 會重新執行，直到成功為止。
這種樂觀的併發控制方法使得多個 transaction 可以同時執行，而不需要等待鎖的釋放，從而提高了系統的併發性和性能。

## Conclusion

與其說 STM 簡化了整體的開發流程，倒不如說它簡化了開發者的認知負擔。開發者不需要多付額外的功夫去理解跟實作鎖，但相對的效能上的開銷也就相對大許多，畢竟背地裡管理著許多 transaction 的 commit/rollback 狀況。
