---
title: "Day 12: 你的Goroutine正在悄悄洩漏 Part 2"
datetime: "2025-11-2"
description: >
  在 Day 11，我們學會了使用 context 套件來從外部優雅地取消一個 goroutine，解決了因等待外部事件（如用戶取消請求）而可能導致的洩漏問題。context 提供了一個強大的、跨越 `goroutine` 邊界的信號傳遞機制。今天，我們要回到 Day 10 提出的另一個問題：如何避免因 channel 操作本身被阻塞而導致的 goroutine 洩漏？比如，一個 goroutine 嘗試向一個緩衝區已滿且沒有接收者的 channel 發送數據。在這種情況下，沒有外部的 `cancel()` 函式會被調用，洩漏的根源在於 goroutine 內部的通信僵局。
parent: "Goroutine 最佳入門姿勢"
---

### 前言

在 Day 11，我們學會了使用 `context` 套件來從**外部**優雅地取消一個 `goroutine`，解決了因等待外部事件（如用戶取消請求）而可能導致的洩漏問題。`context` 提供了一個強大的、跨越 `goroutine` 邊界的信號傳遞機制。

今天，我們要回到 [Day 10] 提出的另一個問題：**如何避免因 `channel` 操作本身被阻塞而導致的 `goroutine` 洩漏？** 比如，一個 `goroutine` 嘗試向一個緩衝區已滿且沒有接收者的 `channel` 發送數據。在這種情況下，沒有外部的 `cancel()` 函式會被調用，洩漏的根源在於 `goroutine` 內部的通信僵局。

幸運的是，我們已經學會了所有需要的工具。答案就是將 `context` 和 `select` 結合起來，為我們的 `channel` 操作加上一道「安全鎖」。

### **問題重現：阻塞的發送者**

讓我們再次回顧 Day 10 的那個洩漏場景：一個 `goroutine` 嘗試向一個無人消費的 `channel` 發送數據，導致其永久阻塞。

```go
package main
import ("fmt")

// 洩漏的函式
func leakySender(data int) {
	ch := make(chan int)

	// 這個 goroutine 將會永遠阻塞
	go func() {
		fmt.Printf("Goroutine: trying to send %d\n", data)
		// 如果沒有接收者，這裡會永久阻塞
		ch <- data 
		fmt.Println("Goroutine: sent data!")
	}()
}

func main() {
    leakySender(42)
    // 雖然 main 函式結束了，但在一個長時間運行的服務中，
    // leakySender 啟動的 goroutine 會永遠存在。
}
```

如果這是在一個 Web 伺服器的請求處理函式中，那每次請求都會洩漏一個 `goroutine`，後果不堪設想。

### **解決方案：用 select 監聽取消信號和 Channel 操作**

解決這個問題的思路非常直觀：當 `goroutine` 嘗試進行一個可能會阻塞的 `channel` 操作時，**不能**只傻傻地等著這一個操作。它必須**同時**監聽一個「退出」信號。而這個退出信號，正是由我們昨天學習的 `context.Context` 來提供的。

`select` 陳述句就是為了這個場景而生的。它可以同時監聽多個 `channel`，哪個先就緒就執行哪個。

讓我們來改造 `leakySender`，讓它變得健壯：

```go
package main

import (
	"context"
	"fmt"
	"time"
)

// nonLeakySender 現在接收一個 context
func nonLeakySender(ctx context.Context, data int) {
	ch := make(chan int)

	// 這個 goroutine 現在是安全的
	go func() {
		// 使用 defer 確保我們知道 goroutine 何時退出
		defer fmt.Println("Goroutine: exiting.")

		select {
		case ch <- data:
			// 如果有接收者，數據會被成功發送
			fmt.Printf("Goroutine: successfully sent %d\n", data)
		case <-ctx.Done():
			// 如果在發送完成前，context 被取消了
			// 我們就會收到信號，從而避免阻塞
			fmt.Printf("Goroutine: sending canceled. Reason: %v\n", ctx.Err())
		}
	}()

	// 為了演示，我們在這個函式裡等待一下再決定是否接收
	time.Sleep(1 * time.Second)

	// 這裡的 select 只是為了模擬一個可能的消費者
	select {
	case val := <-ch:
		fmt.Printf("Main: received data: %d\n", val)
	default:
		fmt.Println("Main: no one received the data.")
	}
}

func main() {
	fmt.Println("--- Scenario 1: Timeout before sending ---")
	// 建立一個 500 毫秒後就會超時的 context
	ctx, cancel := context.WithTimeout(context.Background(), 500*time.Millisecond)
	defer cancel() // 好習慣：總是呼叫 cancel()

	// 我們的 goroutine 需要 1 秒才能被接收，但 context 在 500 毫秒時就超時了
	nonLeakySender(ctx, 42)
	time.Sleep(2 * time.Second) // 等待 goroutine 打印退出訊息

	fmt.Println("\n--- Scenario 2: Data sent successfully ---")
	// 這次，我們給足夠的時間
	ctx2, cancel2 := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel2()
	nonLeakySender(ctx2, 100)
	time.Sleep(2 * time.Second)
}
```

**執行結果：**
```text
--- Scenario 1: Timeout before sending ---
Main: no one received the data.
Goroutine: sending canceled. Reason: context deadline exceeded
Goroutine: exiting.

--- Scenario 2: Data sent successfully ---
Main: received data: 100
Goroutine: successfully sent 100
Goroutine: exiting.
```

**程式碼解析：**
1.  核心改動在於 `goroutine` 內部的 `select` 結構。它現在有兩個 `case`：
    *   `case ch <- data:`：嘗試發送數據。
    *   `case <-ctx.Done():`：監聽來自 `context` 的取消信號。
2.  **場景一 (Timeout)**：
    *   `goroutine` 等待發送數據，但 `main` 函式要等 1 秒後才會準備接收。
    *   在 `goroutine` 等待的過程中，500ms 時間到了，`ctx` 被取消，`ctx.Done()` 的 `channel` 被關閉。
    *   `goroutine` 中的 `select` 立刻捕獲到這個信號，執行了 `<-ctx.Done()` 的 `case`，打印訊息後退出。**洩漏被成功避免！**
3.  **場景二 (Success)**：
    *   這次，在 `ctx` 超時之前（1 秒後），`main` 函式準備好了接收。
    *   `select` 的 `ch <- data` 這個 `case` 成功執行，數據被發送。`goroutine` 打印成功訊息後退出。

這個模式不僅適用於發送操作，同樣也適用於接收操作 (`case val := <-ch:`)。

### **萬能的防洩漏公式**

至此，我們得到了一個可以用於幾乎所有 `goroutine` 的、健壯的防洩漏樣板程式：

```go
func SafeGoroutine(ctx context.Context, /* ... 其他參數 ... */) {
    go func() {
        // 在這裡 defer 必要的清理工作
        defer ...

        for { // 或者其他形式的迴圈/工作
            select {
            case <-ctx.Done():
                // 清理並返回
                return
            // case 1: 處理 channel 接收 ...
            // case 2: 處理 channel 發送 ...
            // case 3: 處理 Ticker ...
            default:
                // 如果沒有通信，執行計算密集型工作
            }
        }
    }()
}
```

這個結構確保了無論 `goroutine` 內部在做什麼，它總是在**同時**監聽一個外部的「停止」信號。這為 `goroutine` 的生命週期提供了一個強有力的保障。

### **今日總結**

今天，我們將前幾天的知識融會貫通，徹底解決了 `goroutine` 洩漏的問題。
1.  我們明確了 `select` 陳述句是避免 `channel` 操作永久阻塞的關鍵。
2.  我們將 `context` 作為 `goroutine` 的生命週期控制器，將其 `Done()` `channel` 作為 `select` 中的一個 `case`，為 `goroutine` 提供了可靠的退出路徑。
3.  我們總結出了一個幾乎適用於所有場景的、健壯的 `goroutine` 防洩漏樣板程式。

到目前為止，我們討論的通信方式 (`channel`) 和同步方式 (`WaitGroup`) 都是 `Golang` 推薦的、「透過溝通來共享記憶體」的模式。但有時，我們不可避免地需要回到傳統的併發模型：「透過共享記憶體來溝通」，比如，當多個 `goroutine` 需要修改同一個共享變數時。

預告 Day 13: **【共享資源的守護者】`sync.Mutex` 與競爭條件 (Race Condition)**。我們將學習如何使用傳統的互斥鎖來保護我們的共享數據，並介紹 `Golang` 內建的強大工具來檢測潛在的數據競爭問題。
