---
title: "Day6 優雅地接收: 用 `for...range` 遍歷Channel，直到世界盡頭"
datetime: "2025-10-15"
description: "在 Day 5，我們探討了無緩衝與有緩衝 Channel 的差異，了解了如何根據場景選擇合適的「管道」。我們學會了如何發送和接收單個數據，但真實世界中的場景往往更複雜：生產者 (Producer) Goroutine 可能會持續不斷地產生資料流，而消費者 (Consumer) Goroutine 需要處理完所有資料。我們如何知道生產者何時停止發送？消費者又該如何優雅地停止接收，而不是因為讀取一個空蕩蕩的 Channel 而永久阻塞下去？今天，我們將學習 `close()` 函式和 `for...range` 語法，這對組合技將完美解決這個問題。"
parent: "Goroutine 最佳入門姿勢"
---

## 前言

在 Day 5，我們探討了無緩衝與有緩衝 Channel 的差異，了解了如何根據場景選擇合適的「管道」。我們學會了如何發送和接收單個數據，但真實世界中的場景往往更複雜：生產者 (Producer) Goroutine 可能會持續不斷地產生資料流，而消費者 (Consumer) Goroutine 需要處理完所有資料。

我們如何知道生產者何時停止發送？消費者又該如何優雅地停止接收，而不是因為讀取一個空蕩蕩的 Channel 而永久阻塞下去？今天，我們將學習 `close()` 函式和 `for...range` 語法，這對組合技將完美解決這個問題。

## 問題：如何知道 Channel 的盡頭？

想像一個場景：一個 Goroutine 負責生產一系列的任務，並把它們發送到一個 Channel。另一個 Goroutine 負責從 Channel 中取出任務並執行。

```go
func producer(tasks chan<- int) {
    // 產生 5 個任務
    for i := 1; i <= 5; i++ {
        fmt.Printf("Producer: Sending task %d\n", i)
        tasks <- i
        time.Sleep(500 * time.Millisecond)
    }
    // 任務產生完了，然後呢？怎麼通知 consumer？
}
```

消費者該怎麼寫？如果它只接收 5 次，它就必須**預先知道**總共有 5 個任務，這在很多動態場景下是不現實的。如果它寫成一個無限迴圈，那麼在接收完第 5 個任務後，它會永遠阻塞在 `<-tasks` 這一行，等待永遠不會到來的第 6 個任務，最終導致 Goroutine 洩漏。

## 解法一：***val, ok*** 檢查模式

從一個 Channel 接收資料時，其實可以有兩個回傳值。

```go
val, ok := <-ch
```

*   `val`：從 Channel 接收到的值。
*   `ok` (bool)：一個非常重要的狀態旗標。
    *   如果 `ok` 為 `true`，表示成功地從 Channel 接收到了值 `val`。
    *   如果 `ok` 為 `false`，表示 Channel 已經被**關閉 (closed)** 且 Channel 中已經沒有任何緩衝的資料了。此時 `val` 會是該 Channel 型別的**零值**（例如 `int` 的零值是 `0`，`string` 的是 `""`）。

要利用這個特性，生產者在完成所有工作後，需要使用內建的 `close()` 函式來關閉 Channel。

**`close(ch)`**：這個函式會標記一個 Channel 為「關閉」狀態。這是一個**單向**操作，被關閉的 Channel 無法再次被開啟。關閉 Channel 的主要目的是向所有接收者廣播一個信號：「我不會再往這個 Channel 發送任何值了」。

讓我們來看看如何結合 `close` 和 `ok` 模式來解決問題：

```go
package main

import (
	"fmt"
	"time"
)

func producer(tasks chan<- int) {
	// 在函式結束時，關閉 channel
	// 這是一個非常重要的信號
	defer close(tasks)

	for i := 1; i <= 5; i++ {
		fmt.Printf("Producer: Sending task %d\n", i)
		tasks <- i
		time.Sleep(200 * time.Millisecond)
	}
	fmt.Println("Producer: All tasks sent. Channel closed.")
}

func main() {
	tasks := make(chan int, 3)
	go producer(tasks)

	// 使用無限迴圈和 ok 模式來接收
	for {
		task, ok := <-tasks
		if !ok {
			// 如果 ok 是 false，代表 channel 已關閉且無資料
			fmt.Println("Consumer: Channel closed. Exiting.")
			break // 跳出迴圈
		}
		fmt.Printf("Consumer: Received task %d\n", task)
		time.Sleep(500 * time.Millisecond)
	}
}
```

這個方法可行，但 `for { if !ok { break } }` 的寫法略顯繁瑣。Golang 官方提供了一種更優雅、更簡潔的語法。

## 解法二： ***for...range*** 的優雅之道

Go 語言的 `for...range` 迴圈不僅能遍歷 slice, map, array，它也能遍歷 Channel！

當 `for...range` 用於一個 Channel 時，它會自動地、不斷地從 Channel 中接收資料，直到這個 Channel 被**關閉**且裡面的值都被取光為止。迴圈會自動結束，你完全不需要自己去判斷 `ok` 的狀態。

讓我們用 `for...range` 來重寫上面的 `main` 函式：

```go
package main

import (
	"fmt"
	"time"
)

func producer(tasks chan<- int) {
	defer close(tasks)
	for i := 1; i <= 5; i++ {
		fmt.Printf("Producer: Sending task %d\n", i)
		tasks <- i
		time.Sleep(200 * time.Millisecond)
	}
	fmt.Println("Producer: All tasks sent. Channel closed.")
}

func main() {
	tasks := make(chan int, 3)
	go producer(tasks)

	// 使用 for...range 優雅地遍歷 channel
	// 這個迴圈會一直執行，直到 'tasks' channel 被關閉
	for task := range tasks {
		fmt.Printf("Consumer: Received task %d\n", task)
		time.Sleep(500 * time.Millisecond)
	}
	
	fmt.Println("Consumer: Loop finished. All tasks processed.")
}
```

執行結果與前一個版本完全相同，但 `main` 函式的程式碼是不是乾淨清爽多了？`for...range` 在內部幫我們處理了 `val, ok` 的檢查邏輯，讓我們可以專注於處理接收到的資料。

## 黃金法則：誰發送，誰關閉

一個至關重要的問題：應該由誰來關閉 Channel？

> **黃金法則：永遠由發送方 (Sender) 來關閉 Channel，絕不能由接收方 (Receiver) 關閉。**

為什麼？
因為接收方永遠不知道發送方是否還會發送資料。如果接收方擅自關閉了 Channel，而發送方此時正嘗試向這個已關閉的 Channel 發送資料，將會引發一個無法恢復的 `panic`。

反之，發送方非常清楚自己何時完成了所有發送任務，此時由它來關閉 Channel 是最安全、最合理的。

**對一個已關閉的 Channel 進行操作會發生什麼？**
*   **發送**到已關閉的 Channel：會引發 `panic`。
*   **接收**自已關閉的 Channel：
    *   如果 Channel 中還有緩衝的資料，會繼續成功接收，直到資料被取光。
    *   當資料取光後，任何接收操作都會立刻返回，得到的是該型別的**零值**。
*   **關閉**一個已經關閉的 Channel：會引發 `panic`。

## 今日總結

今天，我們掌握了如何優雅地處理來自 Channel 的資料流：
1.  **`close(ch)`** 是發送方用來通知接收方「不會再有新資料了」的信號。
2.  接收方可以透過 **`val, ok := <-ch`** 的模式來判斷 Channel 是否已被關閉。
3.  **`for task := range tasks`** 是遍歷 Channel 的最佳實踐，它簡潔、易讀，並能自動處理 Channel 關閉時的迴圈退出。
4.  我們謹記黃金法則：**由發送方負責關閉 Channel**。

我們現在已經能夠熟練地處理單個 Channel 的生命週期了。但如果我們的 Goroutine 需要同時應對**多個 Channel** 的事件呢？比如，一個 Channel 傳來任務，另一個 Channel 傳來取消信號。我們該如何同時監聽它們，並對最先到達的事件做出反應？

預告 Day 7: **【並行的十字路口】`select`：在多個Channel之間做出選擇**。我們將學習 Go 併發編程中的另一個強大武器——`select` 陳述式。
