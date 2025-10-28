---
title: "Day11: Goroutine的 life controller, context 優雅地發出取消訊號"
datetime: "2025-10-28"
description: "在 [Day 10]，我們探討了由於 `channel` 永久阻塞導致的 `goroutine` 洩漏問題，並得出結論：**必須為每個 `goroutine` 提供一個明確的退出路徑**。但是，如果一個 `goroutine` 正在執行一個耗時的任務，比如資料庫查詢或 API 請求，我們該如何從外部通知它：「嘿，不用再等了，上游請求已經被用戶取消了！」"
parent: "Goroutine 最佳入門姿勢"
---

### **前言**

在 Day 10，我們探討了由於 `channel` 永久阻塞導致的 `goroutine` 洩漏問題，並得出結論：**必須為每個 `goroutine` 提供一個明確的退出路徑**。但是，如果一個 `goroutine` 正在執行一個耗時的任務，比如資料庫查詢或 API 請求，我們該如何從外部通知它：「嘿，不用再等了，上游請求已經被用戶取消了！」

這就是 `context` 套件登場的時刻。`context` 是 `Golang` 中專門用來**傳遞請求範圍 (`request-scoped`) 的值、取消信號和超時控制**的標準庫。你可以把 `Context` 想像成一個貫穿整個請求處理鏈的「指揮棒」。

#### **`context` 的核心概念**

`Context` 是一個 `interface`，它定義了四個方法：

```go
type Context interface {
    Deadline() (deadline time.Time, ok bool)
    Done() <-chan struct{}
    Err() error
    Value(key any) any
}
```

*   `Deadline()`：回傳這個 `Context` 是否被設定了截止時間。
*   **`Done()`**: 這是 `Context` 的核心。它回傳一個 `channel` (`<-chan struct{}`)。當這個 `Context` 被取消或超時的時候，這個 `channel` **會被關閉**。所有監聽這個 `channel` 的 `goroutine` 都能立刻收到這個「完成」信號。
*   **`Err()`**: 在 `Done()` 的 `channel` 被關閉後，`Err()` 會回傳一個非 `nil` 的錯誤，解釋 `Context` 被關閉的原因（例如，`context.Canceled` 或 `context.DeadlineExceeded`）。
*   `Value()`：允許你在 `Context` 中附加一些鍵值對數據，這些數據可以在整個請求鏈中向下傳遞。

### **如何建立和使用 `Context`？**

你永遠不會自己去實作 `Context` `interface`。`Golang` 提供了兩個最基礎的 `Context` 作為根節點：`context.Background()` 和 `context.TODO()`。

從根 `Context` 出發，我們可以使用四個 `With...` 函式來衍生出新的子 `Context`：

1.  **`context.WithCancel(parent Context)`**: 回傳一個子 `Context` 和一個 `CancelFunc`。當你呼叫這個 `CancelFunc` 時，這個子 `Context` 以及所有由它衍生的 `Context` 都會被取消。
2.  **`context.WithDeadline(parent Context, d time.Time)`**: 回傳一個子 `Context`, 子 `Context` 會在到達指定的**絕對時間** `d` 時自動被取消。
3.  **`context.WithTimeout(parent Context, timeout time.Duration)`**: 回傳一個子 `Context`, 子 `Context` 會在經過指定的**相對時間** `timeout` 後自動被取消。這是最常用的超時控制函式。
4.  **`context.WithValue(parent Context, key, val any)`**: 附加鍵值對。

### **實戰：用 `context.WithCancel` 優雅地停止 Goroutine**

讓我們用 `Context` 來賦予 `main` `goroutine` 提前「叫停」工作的能力。

```go
package main

import (
	"context"
	"fmt"
	"time"
)

// worker 函式接收一個 context.Context 作為第一個參數，這是標準實踐
func worker(ctx context.Context, name string) {
	fmt.Printf("Worker %s: Starting\n", name)
	defer fmt.Printf("Worker %s: Stopping\n", name)

	for {
		select {
		case <-ctx.Done():
			// Context 的 Done() channel 被關閉，收到取消信號
			fmt.Printf("Worker %s: Cancellation signal received. Reason: %v\n", name, ctx.Err())
			return // 乾淨地退出 goroutine
		default:
			// 模擬正在做一些工作
			fmt.Printf("Worker %s: Doing some work...\n", name)
			time.Sleep(500 * time.Millisecond)
		}
	}
}

func main() {
	// 建立一個可以被取消的 context
	ctx, cancel := context.WithCancel(context.Background())

	// 啟動一個 worker goroutine
	go worker(ctx, "A")

	time.Sleep(2 * time.Second)

	fmt.Println("Main: It's time to cancel the worker.")
	cancel() // 呼叫 cancel() 函式，發出取消信號

	time.Sleep(1 * time.Second) // 等待 worker 的退出訊息
	fmt.Println("Main: Finished.")
}
```

### **今日總結**

今天我們掌握了 `Golang` 併發開發中最重要的工具之一：`context`。
1.  我們理解了 `Context` 的核心是 `Done()` `channel`，它被用來廣播取消信號。
2.  學會了使用 `context.WithCancel`、`WithTimeout` 等函式來創建可被控制生命週期的子 `Context`。
3.  透過實戰，學會了在 `goroutine` 中使用 `select` 配合 `ctx.Done()` 來監聽取消信號並實現優雅退出，從而避免了 `goroutine` 洩漏。
