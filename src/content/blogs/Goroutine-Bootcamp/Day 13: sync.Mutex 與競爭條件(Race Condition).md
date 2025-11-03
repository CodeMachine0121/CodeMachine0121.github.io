---
title: "Day 13: sync.Mutex 與競爭條件(Race Condition)"
datetime: "2025-11-03"
description: > 
  在某些場景下，我們不得不回到更傳統的併發模型：「透過共享記憶體來溝通」。例如，當多個 `goroutine` 需要頻繁地讀取或修改一個共享的設定變數或一個共用的計數器時。一旦我們允許多個 `goroutine` 同時存取同一塊記憶體，一個幽靈般的問題就會浮現，那就是**競爭條件 (Race Condition)**。今天，我們將學習如何識別它，並介紹 `sync` 套件中的守護者——`sync.Mutex`——來馴服它
parent: "Goroutine 最佳入門姿勢"
---

### **前言**

在過去的旅程中，我們深度探索了 `channel`，並遵循了 `Golang` 的核心併發哲學：

> Do not communicate by sharing memory; instead, share memory by communicating.

這種模式非常強大，它透過讓 `goroutine` 之間傳遞資料所有權來避免併發訪問的衝突。

但是，在某些場景下，我們不得不回到更傳統的併發模型：「透過共享記憶體來溝通」。例如，當多個 `goroutine` 需要頻繁地讀取或修改一個共享的設定變數或一個共用的計數器時。

一旦我們允許多個 `goroutine` 同時存取同一塊記憶體，一個幽靈般的問題就會浮現，那就是**競爭條件 (Race Condition)**。今天，我們將學習如何識別它，並介紹 `sync` 套件中的守護者——`sync.Mutex`——來馴服它。

### **什麼是競爭條件 (Race Condition)？**

`Race Condition` 指的是，當多個併發的執行緒或 `goroutine` 同時存取共享資源，並且最終的結果取決於它們執行的時序或交錯順序時，所發生的不可預期的情況。

想像一個簡單的銀行帳戶，餘額有 100 元。現在，你和你太太（兩個 `goroutine`）同時從這個帳戶各自提款 80 元。理想情況下，這是不可能的。但如果程式邏輯有漏洞，可能會發生以下情況：

1.  **你的 Goroutine**: 讀取餘額 (100 元)。
2.  **太太的 Goroutine**: 也讀取餘額 (100 元)。
3.  **你的 Goroutine**: 計算新餘額 (100 - 80 = 20)，並寫入。帳戶餘額現在是 20 元。
4.  **太太的 Goroutine**: 也計算新餘額 (100 - 80 = 20)，並寫入。帳戶餘額最終還是 20 元。

結果是，銀行損失了 80 元，因為第二次的提款操作覆蓋了第一次的結果。這就是 `Race Condition`，因為最終的餘額取決於 CPU 如何安排這兩個 `goroutine` 的讀取和寫入順序。

在 `Golang` 中，像 `counter++` 這樣的操作並不是**原子的 (atomic)**。它實際上至少包含三個步驟：
1.  **讀取** `counter` 的目前值到暫存器。
2.  在暫存器中對值**加一**。
3.  將暫存器中的新值**寫回** `counter`。

如果兩個 `goroutine` 在第一步和第三步之間交錯執行，就會產生非預期的結果。

### **實戰：親手製造一個 Race Condition**

讓我們用程式碼來證明這一點。我們將啟動 1000 個 `goroutine`，每個都對一個共享計數器加一。

```go
package main

import (
	"fmt"
	"sync"
)

func main() {
	var wg sync.WaitGroup
	var counter int = 0

	// 我們要啟動 1000 個 goroutine
	numGoroutines := 1000
	wg.Add(numGoroutines)

	for i := 0; i < numGoroutines; i++ {
		go func() {
			defer wg.Done()
			// 這裡存在 Race Condition！
			counter++
		}()
	}

	// 等待所有 goroutine 完成
	wg.Wait()

	fmt.Printf("Expected counter: %d\n", numGoroutines)
	fmt.Printf("Actual counter: %d\n", counter) // 結果幾乎總是不等於 1000
}
```

多次執行這個程式，你會發現 `Actual counter` 的值幾乎每次都不同，而且幾乎從來不是 1000！它可能是 998、995，或任何小於 1000 的數字。這就是 `Race Condition` 活生生的例子。

### **解法：`sync.Mutex` 互斥鎖**

為了解決這個問題，我們需要一種機制來確保在任何時候，只有一個 `goroutine` 能夠存取 `counter`。這塊一次只允許一個 `goroutine` 進入的程式碼區域，我們稱之為**臨界區 (Critical Section)**。

`sync.Mutex`（Mutual Exclusion Lock，互斥鎖）就是用來保護臨界區的工具。

想像一下公共廁所的門鎖。一次只能有一個人進去，進去前必須鎖門 (`Lock()`)，出來時必須解鎖 (`Unlock()`)，這樣下一個人才能進去。`Mutex` 就是這把鎖。

它有兩個主要方法：
*   `mu.Lock()`: 獲取鎖。如果鎖已經被其他 `goroutine` 持有，那麼當前的 `goroutine` 將會**阻塞**，直到鎖被釋放。
*   `mu.Unlock()`: 釋放鎖。讓其他正在等待的 `goroutine` 有機會獲取鎖。

**最佳實踐**：總是使用 `defer mu.Unlock()`。這可以確保即使在臨界區的程式碼發生 `panic`，鎖也能被正確釋放，避免造成**死鎖 (Deadlock)**。

#### **修正我們的程式碼**

```go
package main

import (
	"fmt"
	"sync"
)

func main() {
	var wg sync.WaitGroup
	var counter int = 0
	var mu sync.Mutex // 宣告一個 Mutex

	numGoroutines := 1000
	wg.Add(numGoroutines)

	for i := 0; i < numGoroutines; i++ {
		go func() {
			defer wg.Done()

			// 在修改 counter 前，先鎖定
			mu.Lock()
			// 使用 defer 確保在函式結束時解鎖
			defer mu.Unlock()

			// 現在這塊區域是安全的臨界區
			counter++
		}()
	}

	wg.Wait()

	fmt.Printf("Expected counter: %d\n", numGoroutines)
	fmt.Printf("Actual counter: %d\n", counter) // 結果永遠是 1000
}
```

現在，無論你執行多少次，`Actual counter` 的值都將**永遠是 1000**。`Mutex` 成功地保護了我們的共享資源。

### **偵測 Race Condition 的神器：Race Detector**

`Golang` 提供了一個內建的、極其強大的工具來幫助我們偵測程式碼中潛在的 `Race Condition`。你只需要在執行或測試時加上 `-race` 旗標。

現在，對我們**第一個有問題的版本**執行以下指令：
`go run -race your_file_name.go`

你會看到一份詳細的報告，明確指出哪一行程式碼發生了數據競爭，以及是哪兩個 `goroutine` 發生了衝突。這是一個無價的工具，強烈建議在你的併發專案中常規性地使用它。

### **今日總結**

今天，我們踏入了共享記憶體的併發世界，並學會了如何應對其最大的挑戰：
1.  我們理解了**競爭條件 (Race Condition)** 的成因：多個 `goroutine` 對共享資源進行非原子的讀-改-寫操作。
2.  我們學會了使用 `sync.Mutex` 來建立**臨界區 (Critical Section)**，透過 `Lock()` 和 `Unlock()` 保護共享數據，確保同一時間只有一個 `goroutine` 可以存取它。
3.  我們強調了使用 `defer mu.Unlock()` 作為一個健壯的程式設計模式，以防止死鎖。
4.  我們認識了 `go run -race` 這個強大的 `Race Detector` 工具，可以用來自動偵測程式中的 `Race Condition`。

`sync.Mutex` 是一把非常有用的鎖，但它也是一把「一刀切」的鎖。無論 `goroutine` 是想讀取數據還是寫入數據，都必須排隊等待。但在很多「讀多寫少」的場景中，允許多個 `goroutine` **同時讀取**數據是安全的，這時如果還使用 `Mutex`，就會不必要地降低程式的效能。

預告 Day 14: **【讀寫效能優化】`sync.RWMutex`：讓你的讀取操作飛起來**。我們將學習一種更精細的鎖，來優化讀取密集型的併發場景。
