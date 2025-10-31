---
title: "Day11: 使用 Context 優雅地發出取消訊號"
datetime: "2025-10-28"
description: "在 Day 10，我們探討了由於 channel 永久阻塞導致的 goroutine 洩漏問題，並得出結論：必須為每個 goroutine 提供一個明確的退出路徑。但是，如果一個 goroutine 正在執行一個耗時的任務，比如資料庫查詢或 API 請求，我們該如何從外部通知它：「嘿，不用再等了，上游請求已經被用戶取消了！」"
parent: "Goroutine 最佳入門姿勢"
---

### **前言**

在 Day 10，我們探討了由於 `channel` 永久阻塞導致的 `goroutine` 洩漏問題，並得出結論：**必須為每個 `goroutine` 提供一個明確的退出路徑**。但是，如果一個 `goroutine` 正在執行一個耗時的任務（例如資料庫查詢或 API 請求），我們該如何從外部通知它：「嘿，不用再等了，上游請求已經被用戶取消了！」

這就是 `context` 套件登場的時刻。`context` 是 `Golang` 中專門用來**傳遞請求範圍 (request-scoped) 的值、取消信號 (cancellation signals) 和超時控制 (timeouts)** 的標準庫。你可以把 `Context` 想像成一個貫穿整個請求處理鏈的「指揮棒」，它能將「停止」的信號安全、高效地傳達給所有相關的 `goroutine`。

---

### **第一部分：深入理解 `Context` 介面**

`Context` 是一個介面，它定義了四個核心方法。讓我們透過實際範例來逐一解析它們。

```go
type Context interface {
    Deadline() (deadline time.Time, ok bool)
    Done()     <-chan struct{}
    Err()      error
    Value(key any) any
}
```

#### **1. `Deadline()`**

此方法回傳 `Context` 被設定的截止時間。如果沒有設定截止時間，`ok` 會是 `false`。

**實作範例：**

```go
package main

import (
	"context"
	"fmt"
	"time"
)

func checkDeadline(ctx context.Context, name string) {
	if deadline, ok := ctx.Deadline(); ok {
		fmt.Printf("[%s] Deadline is set to: %s\n", name, deadline.Format(time.RFC3339))
		fmt.Printf("[%s] Time remaining: %s\n", name, time.Until(deadline).Round(time.Millisecond))
	} else {
		fmt.Printf("[%s] No deadline is set.\n", name)
	}
}

func main() {
	// 1. 建立一個 2 秒後超時的 context
	ctxWithTimeout, cancelTimeout := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancelTimeout()
	checkDeadline(ctxWithTimeout, "WithTimeout")

	fmt.Println("---")

	// 2. 建立一個沒有截止時間的 context
	ctxBackground := context.Background()
	checkDeadline(ctxBackground, "Background")
}
```
**輸出：**
```text
[WithTimeout] Deadline is set to: 2025-10-31T23:22:02+08:00
[WithTimeout] Time remaining: 2s
[Background] No deadline is set.
---
```

---

#### **2. `Done()` 與 3. `Err()`**

`Done()` 是 `Context` 的靈魂。它回傳一個 `channel`，當 `Context` 被取消時，這個 `channel` 會被關閉。`Err()` 則是在 `Done()` 的 `channel` 關閉後，回傳 `Context` 被關閉的原因。這兩者通常一起使用。

**實作範例：**

```go
package main

import (
	"context"
	"fmt"
	"time"
)

func main() {
	// 建立一個可以手動取消的 context
	ctx, cancel := context.WithCancel(context.Background())

	go func(ctx context.Context) {
		fmt.Println("Goroutine: Waiting for cancellation...")
		// Done() 回傳一個 channel，我們會阻塞在這裡直到它被關閉
		<-ctx.Done()
		
		// 一旦 Done() 的 channel 被關閉，Err() 就會回傳取消的原因
		err := ctx.Err()
		fmt.Printf("Goroutine: Cancellation signal received! Reason: %v\n", err)
	}(ctx)

	// 等待 2 秒，模擬一些工作
	time.Sleep(2 * time.Second)

	// 從外部呼叫 cancel() 來關閉 ctx.Done() 的 channel
	fmt.Println("Main: Canceling the context...")
	cancel()

	// 再等 1 秒，確保 goroutine 有時間打印訊息
	time.Sleep(1 * time.Second)
}
```
**輸出：**
```text
Goroutine: Waiting for cancellation...
Main: Canceling the context...
Goroutine: Cancellation signal received! Reason: context canceled
```

---

#### **4. `Value()`**

`Value()` 允許你在 `Context` 中附加**請求範圍 (request-scoped)** 的數據，例如 `request ID` 或使用者身份信息。

**重要實踐**：為了避免鍵名衝突，`Context` 的 `key` 應該使用自訂的、非導出的型別。

**實作範例：**

```go
package main

import (
	"context"
	"fmt"
)

// 使用自訂型別作為 key，避免與其他套件的 key 衝突
type requestIDKey string

func processRequest(ctx context.Context) {
	// 使用 ctx.Value() 來獲取值
	// 需要進行型別斷言 (type assertion) 來轉成原始型別
	if reqID, ok := ctx.Value(requestIDKey("requestID")).(string); ok {
		fmt.Printf("Processing request with ID: %s\n", reqID)
	} else {
		fmt.Println("Could not find request ID in context.")
	}
}

func main() {
	// 建立一個空的 background context
	ctx := context.Background()
	
	// 使用 context.WithValue 附加一個 request ID
	ctxWithValue := context.WithValue(ctx, requestIDKey("requestID"), "req-12345")

	processRequest(ctxWithValue) // 會成功找到 request ID
	processRequest(ctx)         // 找不到 request ID
}
```

**輸出：**
```text

Processing request with ID: req-12345
Could not find request ID in context.
```

---

### **第二部分：使用 `With...` 函式衍生 Context**

#### **`With...` 函式是什麼？**

在 `Golang` 中，我們永遠不會直接從零開始創建一個 `Context`。相反地，`context` 套件提供了一系列的 `With...` 函式，讓我們能從一個已存在的 **`parent Context`** 衍生出一個帶有新功能的 **`child Context`**。

這個過程形成了一個 `Context` 的**樹狀結構 (tree structure)** 或**衍生鏈 (derivation chain)**。所有 `Context` 樹的根源通常是 `context.Background()`（用於正式程式碼）或 `context.TODO()`（用於測試或尚未確定的情況）。

這種父子關係有兩個至關重要的特性：
1.  **取消信號向下傳播**：當一個 `parent Context` 被取消時，所有由它衍生出來的 `child Context` 也會**自動被取消**。這就是 `Context` 強大的信號傳播機制。
2.  **值向上查找**：`child Context` 會繼承其 `parent` 的所有 `value`。當在一個 `child Context` 上呼叫 `Value()` 方法時，如果 `child` 自身沒有這個 `key`，它會向上回溯到 `parent` 繼續尋找。

`context` 套件主要提供了四種 `With...` 函式來建立這種衍生關係，每種函式都為新的 `Context` 賦予了特定的能力：

-----

#### **1. `context.WithCancel()`**

創建一個可以手動取消的 Context。當 goroutine 的生命週期不依賴於時間，而是由某個外部事件（如用戶點擊取消按鈕）決定時，使用此函式。

**實作範例：** (這是一個完整的、結合 `select` 的實踐)

```go
package main

import (
	"context"
	"fmt"
	"time"
)

func worker(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			fmt.Printf("Worker: Cancellation signal received. Exiting. Reason: %v\n", ctx.Err())
			return
		default:
			fmt.Println("Worker: Doing some work...")
			time.Sleep(500 * time.Millisecond)
		}
	}
}

func main() {
	ctx, cancel := context.WithCancel(context.Background())
	go worker(ctx)
	time.Sleep(2 * time.Second)
	fmt.Println("Main: It's time to cancel the worker.")
	cancel() // 手動發出取消信號
	time.Sleep(1 * time.Second) // 等待 goroutine 打印退出訊息
	fmt.Println("Main: Finished.")
}
```
```
```

#### **2. `context.WithTimeout()` 與 3. `context.WithDeadline()`**

`WithTimeout` (相對時間) 和 `WithDeadline` (絕對時間) 是用來創建會在**未來某個時間點自動取消**的 `Context`。

**實作範例 (WithTimeout)：**

```go
package main

import (
	"context"
	"fmt"
	"time"
)

// 模擬一個耗時 3 秒的資料庫查詢
func dbQuery(ctx context.Context) (string, error) {
	select {
	case <-time.After(3 * time.Second):
		return "Query Result", nil
	case <-ctx.Done():
		return "", ctx.Err() // 如果 context 被取消，回傳錯誤
	}
}

func main() {
	// 我們最多只願意等待 2 秒
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	fmt.Println("Executing DB query with 2s timeout...")
	result, err := dbQuery(ctx)
	if err != nil {
		fmt.Printf("Error: %v\n", err)
	} else {
		fmt.Printf("Result: %s\n", result)
	}
}
```

**輸出：**

```text
Executing DB query with 2s timeout...
Error: context deadline exceeded
```

這個例子完美展示了 `select` 如何在「任務完成」和「`context` 超時」之間進行競賽，並由先到達者勝出。

#### **4. `context.WithValue()`**

前面已有範例，其核心價值在於**安全地**、**不可變地**傳遞跨越 API 邊界的請求數據，而不會污染函式簽章。父 `Context` 無法存取子 `Context` 中附加的值。

---

### **黃金法則：`Context` 的使用慣例**

為了讓 `context` 的使用保持一致性和可讀性，`Golang` 社群形成了一些約定俗成的規則：
*   **將 `Context` 作為函式的第一個參數**，通常命名為 `ctx`。
*   **絕不**將 `Context` 存放在一個結構體中，而是要明確地在函式間傳遞。
*   **`cancel` 函式是有冪等性的 (idempotent)**，多次呼叫是安全的。
*   **不要忘記呼叫 `cancel`**：即使函式正常返回，也應該呼叫 `cancel()` 來釋放與該 `Context` 相關的資源。使用 `defer cancel()` 是一個很好的實踐。

### **今日總結**

今天，我們不僅學習了 `context` 的基本用法，還透過一系列詳細的實作範例，深入探索了其四大介面方法和四大創建函式的細微之處：
1.  我們掌握了如何使用 `Deadline()` 檢查超時，如何結合 `Done()` 和 `Err()` 監聽取消信號並獲取原因，以及如何透過 `Value()` 安全地傳遞請求範圍數據。
2.  我們透過實例對比了 `WithCancel` (手動取消)、`WithTimeout` (自動超時)，並理解了它們在不同場景下的應用。
3.  我們再次強調了 `Context` 的使用慣例，這是寫出標準、可維護的 `Golang` 併發程式碼的基石。
