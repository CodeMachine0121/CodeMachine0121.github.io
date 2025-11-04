---
title: "Day 14: sync.RWMutex 讓你的讀取操作飛起來"
datetime: "2025-11-03"
description: > 
  在 Day 13，我們學習了如何使用 sync.Mutex 來保護共享資源，成功地避免了競爭條件 (Race Condition)。Mutex 像一把堅固的鎖，確保任何時候都只有一個 goroutine 能進入臨界區 (Critical Section)，無論它是要讀取還是寫入數據。
parent: "Goroutine 最佳入門姿勢"
---

### **前言**

在 Day 13，我們學習了如何使用 `sync.Mutex` 來保護共享資源，成功地避免了**競爭條件 (Race Condition)**。`Mutex` 像一把堅固的鎖，確保任何時候都只有一個 `goroutine` 能進入**臨界區 (Critical Section)**，無論它是要讀取還是寫入數據。

然而，這種「一刀切」的策略在某些場景下顯得過於嚴苛。想像一個場景：一個系統的組態設定被儲存在一個共享的 `map` 中。有成百上千個 `goroutine` 需要頻繁地**讀取**這些組態，但只有極少數情況下（例如，管理員更新設定）才需要**寫入**。

在這種「讀多寫少」的場景中，讀取操作本身是安全的——多個 `goroutine` 同時讀取同一份數據並不會產生衝突。但如果我們使用 `sync.Mutex`，即使是讀取操作也必須排隊等待，這會嚴重限制系統的併發效能。為此，`Golang` 提供了另一把更智慧的鎖：`sync.RWMutex` (讀寫互斥鎖)。

### **`sync.RWMutex` 是什麼？**

`sync.RWMutex` (Read-Write Mutual Exclusion Lock) 是一把更精細的鎖，它區分了「讀取」和「寫入」兩種操作。

我們可以把它比喻成一個圖書館的讀書室：
*   **讀取操作 (Reading)**：許多人可以**同時**進入讀書室安靜地看書，他們互不干擾。
*   **寫入操作 (Writing)**：如果圖書館管理員要進來整理書架（修改資料），他會要求**所有**正在看書的人先離開，並鎖上門，直到他整理完畢。在他整理期間，外面的人（無論是想看書還是想整理）都必須等待。

`RWMutex` 的規則正是如此：
1.  **讀者是共享的**：可以有多個 `goroutine` 同時持有讀鎖。
2.  **作者是排他的**：一次只能有一個 `goroutine` 持有寫鎖。
3.  **讀寫互斥**：如果一個 `goroutine` 持有寫鎖，其他任何 `goroutine`（無論是讀還是寫）都必須等待。反之，如果任何 `goroutine` 持有讀鎖，寫操作就必須等待。

### **`RWMutex` 的核心方法**

`RWMutex` 提供了四個核心方法：
*   `mu.RLock()`: 獲取**讀鎖** (Read Lock)。如果此刻有寫鎖被持有，則阻塞。
*   `mu.RUnlock()`: 釋放**讀鎖** (Read Unlock)。
*   `mu.Lock()`: 獲取**寫鎖** (Write Lock)。如果此刻有任何鎖（讀鎖或寫鎖）被持有，則阻塞。
*   `mu.Unlock()`: 釋放**寫鎖** (Write Unlock)。

### **實戰：優化共享 Config 的讀取**

讓我們來實作前面提到的共享 Config 場景，比較 `Mutex` 和 `RWMutex` 的差異。

```go
package main

import (
	"fmt"
	"sync"
	"time"
)

type Config struct {
	mu      sync.RWMutex // 使用 RWMutex
	content map[string]string
}

// Read 操作使用讀鎖
func (c *Config) Get(key string) string {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.content[key]
}

// Write 操作使用寫鎖
func (c *Config) Set(key, value string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.content[key] = value
}

func main() {
	config := &Config{
		content: make(map[string]string),
	}

	var wg sync.WaitGroup

	// 模擬一個寫入者 goroutine，每秒更新一次 Config
	wg.Add(1)
	go func() {
		defer wg.Done()
		for i := 0; i < 5; i++ {
			config.Set("key", fmt.Sprintf("value-%d", i))
			fmt.Println("Writer: Set new config")
			time.Sleep(1 * time.Second)
		}
	}()

	// 模擬 10 個讀取者 goroutine，每 200 毫秒讀取一次 Config
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			for j := 0; j < 10; j++ {
				value := config.Get("key")
				fmt.Printf("Reader %d: Got '%s'\n", id, value)
				time.Sleep(200 * time.Millisecond)
			}
		}(i)
	}

	wg.Wait()
}
```
**程式碼解析：**
1.  我們創建了一個 `Config` Struct，其中包含一個 `sync.RWMutex`。
2.  在 `Get` 方法中，我們使用 `RLock()` 和 `RUnlock()`。這意味著所有 10 個 `Reader` `goroutine` 幾乎可以**同時**進入 `Get` 方法並讀取數據，它們之間不會互相阻塞。
3.  在 `Set` 方法中，我們使用 `Lock()` 和 `Unlock()`。當 `Writer` `goroutine` 呼叫 `Set` 時，它會等待所有當前的 `Reader` 完成後再獲取寫鎖。一旦 `Writer` 拿到鎖，所有新的 `Reader`（和 `Writer`）都必須排隊等待，直到 `Writer` 釋放鎖。

如果這個例子使用 `sync.Mutex`，那麼在任何時間點，即使是 10 個 `Reader` 之間也必須互相排隊，大大降低了程式的併發度。

### **何時該用 `RWMutex`？**

`RWMutex` 並非萬靈丹，它比 `Mutex` 更複雜，內部協調的成本也更高。只有在滿足以下條件時，使用 `RWMutex` 才能帶來顯著的效能提升：

1.  **讀操作遠多於寫操作**：這是使用 `RWMutex` 的最基本前提。
2.  **讀鎖被持有的時間較長**：如果讀操作非常快，鎖的競爭本身就不是瓶頸，那麼 `Mutex` 的開銷更小，可能反而更快。
3.  **有高併發的讀取需求**：有很多 `goroutine` 會同時嘗試讀取。

如果寫操作很頻繁，或者讀操作本身很快，那麼使用更簡單的 `sync.Mutex` 通常是更好、更清晰的選擇。

### **今日總結**

今天，我們為我們的併發工具箱增添了一把更精細的鎖：
1.  我們理解了 `sync.RWMutex` 的核心思想：**讀共享，寫排他**。
2.  我們掌握了它的四個核心方法：`RLock`, `RUnlock`, `Lock`, `Unlock`。
3.  透過一個實戰範例，我們了解了如何在「讀多寫少」的場景中利用 `RWMutex` 來提升系統的併發效能。
4.  我們探討了選擇 `RWMutex` 還是 `Mutex` 的權衡標準，並非所有情況下 `RWMutex` 都是更優選。

到目前為止，我們學習的都是 `Golang` 併發開發中的「原子元件」——`goroutine`, `channel` 和各種鎖。接下來，我們將開始學著如何將這些元件組合起來，構建出一些經典的、可重用的**併發模式 (Concurrency Patterns)**。

預告 Day 15: **【併發任務管理】Worker Pool模式：打造你的Goroutine大軍 Part 1**。我們將學習第一個，也是最常用的一個併發模式，來控制併發任務的數量並重複利用資源。
