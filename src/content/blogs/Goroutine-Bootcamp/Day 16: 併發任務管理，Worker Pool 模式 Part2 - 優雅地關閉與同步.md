---
title: "Day 16: 併發任務管理，Worker Pool 模式 Part2 - 優雅地關閉與同步"
datetime: "2025-11-20"
description: "在 [Day 15]，我們成功地搭建了一個基礎的 `Worker Pool`。它能夠有效地控制併發 `goroutine` 的數量，並透過 `channel` 來分發任務和收集結果。然而，我們的實作還留下了一些可以優化的空間：..."
parent: "Goroutine 最佳入門姿勢"
---

#### **前言**

在 [Day 15]，我們成功地搭建了一個基礎的 `Worker Pool`。它能夠有效地控制併發 `goroutine` 的數量，並透過 `channel` 來分發任務和收集結果。然而，我們的實作還留下了一些可以優化的空間：

1.  **同步問題**：我們目前是透過一個 `for` 迴圈來手動計數並收集結果 (`for a := 1; a <= numTasks; a++`)。這種方式要求我們**預先知道**任務的總數，不夠靈活。如果任務是動態生成的，我們該如何確定所有任務都已處理完畢？
2.  **關閉機制**：目前的 `worker` 只有在 `tasks channel` 被關閉後才會退出。如果我們想在任務處理到一半時，因為外部信號（例如，用戶請求關閉服務）而 **提前、優雅地** 停止所有的 `worker`，該怎麼辦？

今天，我們將對昨天的 `Worker Pool` 進行升級，引入 `sync.WaitGroup` 來解決同步問題，並結合 `context` 來實現一個健壯、可控的關閉機制。

#### **升級一：使用 sync.WaitGroup 進行同步**

`sync.WaitGroup` 是我們在 Day 3 學習過的老朋友了，它是等待一組 `goroutine` 完成的最佳工具。我們可以利用它來等待所有的 `worker` 都處理完任務並安全退出。

我們的思路是：
1.  **分發者 (Producer)**：每發送一個任務到 `tasks channel`，就對 `WaitGroup` 呼叫 `Add(1)`。
2.  **工作者 (Worker)**：每完成一個任務，就對 `WaitGroup` 呼叫 `Done()`。
3.  **主控者 (Main)**：在任務分發完畢後，呼叫 `Wait()` 來等待所有任務被處理完成。

讓我們來改造程式碼。我們將把任務分發和結果收集也放進 `goroutine`，讓整個流程更加併發化。

```go
package main

import (
	"fmt"
	"sync"
	"time"
)

// worker 的定義保持不變
func worker(id int, tasks <-chan int, results chan<- int, wg *sync.WaitGroup) {
	defer wg.Done() // 當 worker 退出時，通知 WaitGroup
	for task := range tasks {
		fmt.Printf("Worker %d started job %d\n", id, task)
		time.Sleep(time.Second)
		result := task * task
		fmt.Printf("Worker %d finished job %d\n", id, task, result)
		results <- result
	}
}

func main() {
	const numTasks = 10
	const numWorkers = 3

	tasks := make(chan int, numTasks)
	results := make(chan int, numTasks)

	var wg sync.WaitGroup

	// --- 步驟 1: 啟動 worker goroutine ---
	// 我們需要等待 worker goroutine 結束，所以 Add(numWorkers)
	wg.Add(numWorkers)
	for w := 1; w <= numWorkers; w++ {
		go worker(w, tasks, results, &wg)
	}

	// --- 步驟 2: 啟動一個 goroutine 來分發任務 ---
	go func() {
		for j := 1; j <= numTasks; j++ {
			tasks <- j
		}
		// 當所有任務都發送完畢後，關閉 tasks channel
		close(tasks)
	}()

	// --- 步驟 3: 啟動一個 goroutine 來等待所有 worker 結束，然後關閉 results channel ---
	go func() {
		wg.Wait() // 等待所有 worker 的 wg.Done() 被呼叫
		close(results) // 當所有 worker 都結束了，安全地關閉 results channel
	}()

	// --- 步驟 4: 在主 goroutine 中收集結果 ---
	// 使用 for...range 來遍歷 results channel，它會在 channel 關閉時自動結束
	for result := range results {
		fmt.Printf("Main: Got result %d\n", result)
	}

	fmt.Println("Main: All tasks are done.")
}
```

**程式碼解析與改進：**
1.  我們將任務分發和 `WaitGroup` 的等待邏輯都移入了各自的 `goroutine` 中。這使得 `main` 函式的主流程更加清晰。
2.  `worker` 現在接收一個 `*sync.WaitGroup`，並在退出時呼叫 `wg.Done()`。
3.  最巧妙的部分在步驟 3：我們啟動了一個專門的 `goroutine`，它的唯一職責就是 `wg.Wait()`。當 `Wait()` 返回時（意味著所有 `worker` 都已結束），它就安全地 `close(results)`。
4.  這使得步驟 4 中的結果收集變得極其優雅。我們不再需要手動計數，`for result := range results` 會一直讀取，直到 `results` channel 被關閉，迴圈自動終止。

這個版本在同步方面已經非常健壯了。現在，讓我們來解決最後一個問題：如何從外部提前終止它？

#### **升級二：結合 `context` 實現優雅關閉**

我們在 Day 11 和 Day 12 已經深入學習了 `context`。現在正是將它應用到我們 `Worker Pool` 中的時候。

思路是在 `worker` 的主迴圈中，使用 `select` 來同時監聽 `tasks channel` 和 `context.Done() channel`。

```go
// ... (保留 main 函式和 package/import)

// 改造後的 worker，增加了 context 參數
func workerWithContext(ctx context.Context, id int, tasks <-chan int, results chan<- int, wg *sync.WaitGroup) {
	defer wg.Done()
	for {
		select {
		case task, ok := <-tasks:
			if !ok {
				// tasks channel 被關閉，worker 正常退出
				fmt.Printf("Worker %d: Tasks channel closed, shutting down.\n", id)
				return
			}
			// 處理任務
			fmt.Printf("Worker %d started job %d\n", id, task)
			time.Sleep(time.Second)
			results <- task * task

		case <-ctx.Done():
			// 收到外部的取消信號
			fmt.Printf("Worker %d: Cancellation signal received, shutting down. Reason: %v\n", id, ctx.Err())
			return
		}
	}
}

// main 函式需要做相應的調整來創建和傳遞 context
func mainWithContext() {
    // ... (與上一個 main 類似的初始化)
	const numTasks = 10
	const numWorkers = 3
	tasks := make(chan int, numTasks)
	results := make(chan int, numTasks)
	var wg sync.WaitGroup

    // 創建一個可以被取消的 context
    ctx, cancel := context.WithCancel(context.Background())

	// 啟動 worker
	wg.Add(numWorkers)
	for w := 1; w <= numWorkers; w++ {
		go workerWithContext(ctx, w, tasks, results, &wg)
	}

  // 分發任務
	go func() {
		for j := 1; j <= numTasks; j++ {
      // 在發送任務前，也檢查一下 context 是否被取消
      select {
      case tasks <- j:
          // success
      case <-ctx.Done():
          fmt.Println("Producer: Cancellation signal received, stopping task generation.")
          return
      }
		}
		close(tasks)
	}()

  // 模擬一個外部事件，在 3 秒後取消所有操作
  go func(){
      time.Sleep(3 * time.Second)
      fmt.Println("\n!!! Main: Sending cancellation signal !!!\n")
      cancel() // 呼叫 cancel()
  }()

    // ... (與上一個 main 相同的結果收集邏輯)
	go func() {
		wg.Wait()
		close(results)
	}()

	for result := range results {
		fmt.Printf("Main: Got result %d\n", result)
	}

	fmt.Println("Main: All tasks are done.")
}
```

在這個 `workerWithContext` 版本中，`worker` 現在可以響應兩種退出信號：
1.  **正常結束**：`tasks channel` 被關閉。
2.  **提前終止**：`context` 被取消。

`select` 陳述句完美地處理了這種「二選一」的場景，使得我們的 `Worker Pool` 既能完成所有任務，也能在需要時被優雅地中斷。

#### **今日總結**

今天，我們將 `Worker Pool` 模式打磨得更加完善和健壯。
1.  我們使用 `sync.WaitGroup` 替代了手動計數，實現了對 `worker` `goroutine` 生命週期的精準同步，並以此為基礎實現了 `results channel` 的安全關閉。
2.  我們將 `context` 整合進 `worker` 的核心迴圈中，利用 `select` 陳述句賦予了 `Worker Pool` **可被外部取消**的能力，實現了優雅關閉。
3.  我們構建了一個包含任務分發、併發處理、結果收集、同步等待和優雅關閉等多個環節的、高度併發且健壯的 `Worker Pool` 模型。

`Worker Pool` 是一種「多對多」的併發模式。明天，我們將學習另外兩種相關但更簡單的模式：`Fan-out`（一對多）和 `Fan-in`（多對一），它們是構建併發**數據處理管道 (Pipeline)** 的基礎。

預告 Day 17: **【數據處理的流水線】Fan-in, Fan-out：分工與合作的藝術**。
