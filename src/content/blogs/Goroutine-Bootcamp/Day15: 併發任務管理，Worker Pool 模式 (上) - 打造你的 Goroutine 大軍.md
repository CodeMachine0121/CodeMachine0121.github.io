---
title: "Day 15: 併發任務管理，Worker Pool 模式 (上) - 打造你的 Goroutine 大軍"
datetime: "2025-11-16"
description: > 
 在過去的兩週裡，我們已經掌握了 `Golang` 併發編程的基礎元件：`goroutine` 的啟動、`channel` 的通信以及 `Mutex` 的同步。我們現在可以輕易地為每一個傳入的任務都啟動一個新的 `goroutine` 來處理。
parent: "Goroutine 最佳入門姿勢"
---
### 前言

在過去的兩週裡，我們已經掌握了 `Golang` 併發模試的的基礎元件：`goroutine` 的啟動、`channel` 的通信以及 `Mutex` 的同步。我們現在可以輕易地為每一個傳入的任務都啟動一個新的 `goroutine` 來處理。

```go
for task := range tasks {
    go doWork(task) // 每來一個任務，就開一個 goroutine
}
```

這種做法在任務量不大的情況下非常簡單直接。但是，如果瞬間湧入成千上萬個任務，會發生什麼事？我們會立即創建出成千上萬個 `goroutine`。雖然 `goroutine` 很輕量，但如此毫無節制地創建也會帶來問題：

1.  **資源消耗**：每個 `goroutine` 依然需要佔用記憶體（初始約 2KB 的堆疊），大量的 `goroutine` 會快速消耗系統記憶體。
2.  **系統調度壓力**：`Golang` 的 `runtime scheduler` 需要管理和調度這些 `goroutine`，數量過多會增加其負擔。
3.  **下游系統壓力**：如果這些任務是網路請求或資料庫操作，無限制的併發可能會瞬間打垮下游的服務。

為了解決這個問題，我們需要引入一個經典的併發設計模式——**Worker Pool**。

### **什麼是 Worker Pool 模式？**

`Worker Pool` 模式的核心思想是：**創建一個固定數量的、可重複利用的 `worker goroutine` Pool**。

想像一個大型工廠的流水線：
*   **任務 (Tasks)**：源源不絕的訂單。
*   **老闆 (Producer)**：負責接收訂單，並把它們放到一個「待辦任務」的傳送帶上。
*   **工人 (Workers)**：工廠裡只有固定數量的工人（例如 5 位）。他們不會每來一個訂單就新招一個人。
*   **傳送帶 (Task Channel)**：工人們都盯著這個傳送帶。誰閒下來了，就從傳送帶上取下一個訂單來處理。

`Worker Pool` 模式就是這個模型的程式碼實現：
1.  **初始化**：在程式啟動時，預先創建一個固定數量的 `worker goroutine`。
2.  **任務分發**：有一個專門的 `channel` 用來傳遞待處理的任務。我們稱之為 `tasks channel`。
3.  **任務處理**：每個 `worker goroutine` 都在一個迴圈中，不斷地從 `tasks channel` 裡取出任務並執行。
4.  **結果收集 (可選)**：可以有另一個 `channel` 用來收集所有 `worker` 的處理結果。

**這種模式的好處是顯而易見的：**
*   **控制併發**：`goroutine` 的數量是固定的，從而控制了資源消耗和對下游的壓力。
*   **資源重複利用**：避免了頻繁創建和銷毀 `goroutine` 的開銷。

#### **實戰：實現一個基本的 Worker Pool**

讓我們來構建一個簡單的 `Worker Pool`。它會接收一組數字作為任務，每個 `worker` 的工作就是計算這個數字的平方，並將結果返回。

```go
package main

import (
	"fmt"
	"sync"
	"time"
)

// worker 是我們的工人 goroutine
// 它接收一個 ID，一個待辦任務的 channel，以及一個存放結果的 channel
func worker(id int, tasks <-chan int, results chan<- int) {
	// 每個 worker 都是一個 for...range 迴圈，不斷地從 tasks channel 接收任務
	for task := range tasks {
		fmt.Printf("Worker %d started job %d\n", id, task)
		// 模擬一個耗時的工作
		time.Sleep(time.Second)
		// 計算結果
		result := task * task
		fmt.Printf("Worker %d finished job %d, result %d\n", id, task, result)
		// 將結果發送到 results channel
		results <- result
	}
}

func main() {
	const numTasks = 5
	const numWorkers = 2

	// 建立任務 channel 和 結果 channel
	tasks := make(chan int, numTasks)
	results := make(chan int, numTasks)

	// --- 步驟 1: 啟動固定數量的 worker goroutine ---
	// 這些 worker 會在後台待命，阻塞在 <-tasks 等待任務
	for w := 1; w <= numWorkers; w++ {
		go worker(w, tasks, results)
	}

	// --- 步驟 2: 發送所有任務到 tasks channel ---
	// 將 5 個任務放入任務 channel
	for j := 1; j <= numTasks; j++ {
		tasks <- j
	}
	// 當所有任務都發送完畢後，關閉 tasks channel
	// 這是一個重要的信號，worker 的 for...range 迴圈會因此而結束
	close(tasks)

	// --- 步驟 3: 收集所有任務的結果 ---
	// 我們需要從 results channel 讀取 5 次結果
	for a := 1; a <= numTasks; a++ {
		result := <-results
		fmt.Printf("Main: Got result %d\n", result)
	}
	
	fmt.Println("Main: All tasks are done.")
}
```

**執行結果可能如下：**

```text
Worker 1 started job 1
Worker 2 started job 2
Worker 1 finished job 1, result 1
Worker 1 started job 3
Main: Got result 1
Worker 2 finished job 2, result 4
Worker 2 started job 4
Main: Got result 4
Worker 1 finished job 3, result 9
Worker 1 started job 5
Main: Got result 9
Worker 2 finished job 4, result 16
Main: Got result 16
Worker 1 finished job 5, result 25
Main: Got result 25
Main: All tasks are done.
```

**程式碼解析：**
1.  我們創建了 2 個 `worker`，但有 5 個 `task`。
2.  `main` 函式先把 5 個 `task` 全部放入 `tasks` channel，然後立刻 `close(tasks)`。
3.  2 個 `worker` `goroutine` 會併發地從 `tasks` channel 中競爭任務。`Worker 1` 拿到了 1，`Worker 2` 拿到了 2。
4.  當 `Worker 1` 完成任務 1 後，它會立刻再去拿任務 3。`Worker 2` 完成任務 2 後會去拿任務 4，以此類推。
5.  `close(tasks)` 至關重要。當所有 5 個任務都被 `worker` 取走後，`tasks` channel 就空了，`worker` 中的 `for task := range tasks` 迴圈會因為 `channel` 被關閉而正常結束。如果沒有 `close(tasks)`，`worker` `goroutine` 會在處理完所有任務後永久阻塞，導致洩漏！
6.  `main` 函式中的最後一個 `for` 迴圈負責收集結果，確保所有工作都完成後主程式才退出。

#### **今日總結**

今天，我們學習並實現了第一個重要的 `Golang` 併發模式——`Worker Pool`。
1.  我們理解了無限制創建 `goroutine` 的潛在風險。
2.  我們掌握了 `Worker Pool` 的核心思想：**創建固定數量的 `goroutine`，並透過 `channel` 來分發任務**，從而達到控制併發和資源複用的目的。
3.  我們親手實現了一個包含「任務分發」、「`Worker` 處理」和「結果收集」三個環節的基礎 `Worker Pool`。
4.  我們再次強調了 `close(channel)` 在通知消費者任務已結束這一信號機制中的重要作用。

我們今天的 `Worker Pool` 實現是有效的，但還比較基礎。例如，我們目前是手動等待結果收集，這在任務數量不確定的情況下不夠靈活。此外，我們還沒有一個優雅的方式來**停止**所有正在工作的 `worker`。

預告 Day 16: 併發任務管理，**Worker Pool模式：打造你的Goroutine大軍 (下)**。我們將會優化今天的 `Worker Pool`，引入 `sync.WaitGroup` 來同步，並結合 `context` 實現優雅的關閉機制。
