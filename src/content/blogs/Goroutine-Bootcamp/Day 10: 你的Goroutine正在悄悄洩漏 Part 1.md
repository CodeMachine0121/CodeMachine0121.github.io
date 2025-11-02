---
title: "Day10: 你的Goroutine正在悄悄洩漏 Part 1"
datetime: "2025-10-19"
description: "在 Day9 的結尾，我們提到了「Goroutine 洩漏 (Goroutine Leak)」，並警告說忘記停止 `Ticker` 是導致洩漏的原因之一。今天，我們要正式面對這個併發程式中極其隱蔽且危險的敵人"
parent: "Goroutine 最佳入門姿勢"
---

## 前言

在 Day9 的結尾，我們提到了「Goroutine 洩漏 (Goroutine Leak)」，並警告說忘記停止 `Ticker` 是導致洩漏的原因之一。今天，我們要正式面對這個併發程式中極其隱蔽且危險的敵人。

什麼是 Goroutine 洩漏？簡單來說，就是你啟動了一個 Goroutine，但由於程式上的缺陷，這個 Goroutine **永遠無法結束**，它會一直存活在背景，佔用著記憶體和 CPU 資源，直到整個程式終結。如果這種洩漏發生在一個會被頻繁呼叫的函式中，那麼洩漏的 Goroutine 數量會不斷累積，最終可能導致程式因資源耗盡而崩潰。

Goroutine 非常輕量，洩漏一兩個你可能毫無察覺。但千里之堤，潰於蟻穴。學會如何識別和預防 Goroutine 洩漏，是每一位 Golang 開發者的必修課。今天，我們將探討最常見的一種洩漏場景：**Channel 的永久阻塞**。

## 洩漏場景一：無人接收的 Channel

最簡單、也最經典的洩漏，源於一個無緩衝 Channel 只有發送方，卻沒有接收方。

回想一下 Day 5 我們講到的無緩衝 Channel 的特性：發送操作會一直**阻塞**，直到有接收方準備好接收。如果永遠沒有接收方，那麼發送操作所在的 Goroutine 將會永久地被掛起。

讓我們看一個例子：

```go
package main

import (
	"fmt"
	"runtime"
	"time"
)

func leakyWorker() {
	ch := make(chan int)

	// 這個 goroutine 嘗試發送數據，但 main 函式並沒有接收
	// 它將會永遠阻塞在這裡
	go func() {
		fmt.Println("Goroutine: Waiting to send data...")
		ch <- 10
		fmt.Println("Goroutine: Data sent!") // 這行永遠不會執行
	}()

	// 注意：leakyWorker 函式本身會立刻返回
	// 它不會等待內部的 goroutine
}

func main() {
	// 在程式開始時，打印 goroutine 數量
	// 通常是 1 (main goroutine)
	fmt.Printf("Initial Goroutines: %d\n", runtime.NumGoroutine())

	leakyWorker()

	// 給一點時間讓 goroutine 啟動
	time.Sleep(1 * time.Second)

	// 洩漏發生了！
	// 你會看到 goroutine 數量變成了 2
	fmt.Printf("Goroutines after leakyWorker: %d\n", runtime.NumGoroutine())

	// 在這裡可以做其他事情，但那個洩漏的 goroutine 會一直存在
	time.Sleep(5 * time.Second)
	fmt.Printf("Goroutines before exit: %d\n", runtime.NumGoroutine())
}
```

**執行結果：**
```text
Initial Goroutines: 1
Goroutine: Waiting to send data...
Goroutines after leakyWorker: 2
Goroutines before exit: 2
```

**程式碼解析：**
1.  我們使用 `runtime.NumGoroutine()` 來觀察當前活躍的 Goroutine 數量。
2.  `leakyWorker` 函式啟動了一個匿名的 Goroutine。這個 Goroutine 唯一的任務就是向一個無緩衝 Channel `ch` 發送數字 10。
3.  `leakyWorker` 函式本身並沒有任何接收 `ch` 的程式碼，它啟動 Goroutine 後就立刻返回了。`main` 函式也不知道 `ch` 的存在，自然也無法接收。
4.  結果就是，這個被啟動的 Goroutine 在 `ch <- 10` 這一行被**永久阻塞**了。它無法退出，它所佔用的記憶體（儘管很小）也無法被回收。我們成功地製造了一次洩漏。

## 洩漏場景二：有緩衝 Channel 被填滿

你可能會想：「那我用有緩衝 Channel 不就好了嗎？」

是的，有緩衝 Channel 可以緩解這個問題，但不能根治。如果生產者向有緩衝 Channel 發送數據的速度，長期來看快於消費者的處理速度，那麼緩衝區總有一天會被**填滿**。一旦緩衝區滿了，有緩衝 Channel 的發送操作就會變得和無緩衝 Channel 一樣——**阻塞**，直到有空間被釋放出來。

**程式碼解析：**

1.  Goroutine 執行 `messages <- "Hello"`，成功，緩衝區現在有 1 個元素。
2.  `processFirstMessage` 執行 `<-messages`，成功，緩衝區變空。
3.  Goroutine 執行 `messages <- "World"`，成功，緩衝區再次有 1 個元素。
4.  Goroutine 結束。`main` 函式結束。這個例子**不會洩漏**。

```go
// ... (package and import)

// 這個函式完全不讀取 channel
func doNothingWithChannel(messages <-chan string) {
    // 假裝很忙
    time.Sleep(1 * time.Second)
    fmt.Println("doNothingWithChannel is done, but it read nothing.")
}


func main() {
	fmt.Printf("Initial Goroutines: %d\n", runtime.NumGoroutine())

	// 建立一個容量為 1 的 channel
	messages := make(chan string, 1)

	// 啟動一個 goroutine，它會發送兩條消息
	go func() {
		messages <- "Hello" // 成功，緩衝區滿
		fmt.Println("Goroutine: Sent 'Hello'")

		// 此時緩衝區已滿，且沒有人會再讀取了
		// 所以這裡會永久阻塞
		messages <- "World"
		fmt.Println("Goroutine: Sent 'World'") // 這行永遠不會執行
	}()

	time.Sleep(100 * time.Millisecond) // 確保 goroutine 先運行
	doNothingWithChannel(messages) // 這個函式根本不消費

	time.Sleep(2 * time.Second)
	fmt.Printf("Goroutines before exit: %d\n", runtime.NumGoroutine())
}
```

**修正後的執行結果：**
```text
Initial Goroutines: 1
Goroutine: Sent 'Hello'
doNothingWithChannel is done, but it read nothing.
Goroutines before exit: 2
```
Goroutine 在發送 "World" 時，因為緩衝區已滿且沒有消費者，導致了永久阻塞和洩漏。

## 如何預防？

預防這類洩漏的核心思想是：**確保每一個 Goroutine 都有一個明確的退出路徑。**

對於基於 Channel 通信的 Goroutine，這意味著：
1.  **要麼**保證 Channel 的接收方一定會消費掉所有數據。
2.  **要麼**提供一個額外的信號，讓發送方知道何時應該停止發送。

這第二點，正是我們明天要探討的內容。簡單的 `close()` 機制在很多情況下是有效的，但當 Goroutine 的生命週期管理變得複雜時（例如，需要從外部取消一個正在執行的任務），我們就需要一個更強大的工具。

## 今日總結

今天我們化身偵探，揪出了第一類「記憶體小偷」：
1.  我們理解了 **Goroutine 洩漏**的定義：一個永遠無法退出的 Goroutine。
2.  分析了兩種由 Channel 阻塞導致的洩漏場景：
    *   向**無緩衝 Channel** 發送，但沒有接收方。
    *   向**有緩衝 Channel** 發送，但緩衝區已滿，且沒有接收方會繼續消費。
3.  我們意識到，避免洩漏的關鍵在於**為每一個 Goroutine 設計清晰的退出機制**。

僅僅依賴 Channel 的讀寫來同步退出路徑是不夠的，因為這很容易出錯。我們需要一種機制，能夠跨越 Goroutine 的邊界，廣播一個「是時候退出了」的信號。

預告 Day 11: **【Goroutine的生命控制器】`context`：優雅地發出取消訊號**。我們將學習 Go 語言中用於控制 Goroutine 生命週期的標準利器——`context` 套件。
