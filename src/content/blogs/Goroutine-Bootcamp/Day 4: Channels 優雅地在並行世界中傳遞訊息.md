---
title: "Day 4: Channels 優雅地在並行世界中傳遞訊息"
datetime: "2025-10-13"
description: "昨天，我們學會了使用 `sync.WaitGroup` 來完美地解決「等待一組 Goroutine 執行完畢」的問題。它就像一位盡責的專案經理，確保所有人都完成工作後才收工。但是，一個新的問題浮現了：如果 Goroutine 完成了工作，需要把「計算結果」回報給主 Goroutine，該怎麼辦呢？`WaitGroup` 只負責同步，不負責溝通。我們總不能把結果存到一個全域變數裡吧？那樣做會引發「競爭條件 (Race Condition)」，需要用複雜的鎖機制來保護，完全違背了 Go 語言簡潔的設計哲學..."
parent: "Goroutine 最佳入門姿勢"
---

## 前言

昨天，我們學會了使用 `sync.WaitGroup` 來完美地解決「等待一組 Goroutine 執行完畢」的問題。它就像一位盡責的專案經理，確保所有人都完成工作後才收工。

但是，一個新的問題浮現了：如果 Goroutine 完成了工作，需要把「計算結果」回報給主 Goroutine，該怎麼辦呢？`WaitGroup` 只負責同步，不負責溝通。我們總不能把結果存到一個全域變數裡吧？那樣做會引發「競爭條件 (Race Condition)」，需要用複雜的鎖機制來保護，完全違背了 Go 語言簡潔的設計哲學。

今天，我們將揭曉 Golang 處理這個問題的答案，這也是 Golang 併發模型的核心與靈魂——**Channel**。

## Go 語言的併發哲學

在介紹 Channel 之前，必須先了解 Golang 一句非常重要的諺語：

> "Do not communicate by sharing memory; instead, share memory by communicating."
>
> **「不要透過共享記憶體來溝通；而是要透過溝通來共享記憶體。」**

這句話是什麼意思呢？
*   **傳統方式 (共享記憶體來溝通)**：就像在辦公室的白板（共享記憶體）上寫東西，為了防止多個人同時寫導致內容混亂，大家在寫之前都得先拿到一支「麥克風」（也就是鎖 `Mutex`），拿到麥克風的人才能寫。這種方式不僅麻煩，還容易出錯（比如有人拿著麥克風忘了還，造成死鎖）。
*   **Golang 的方式 (溝通來共享記憶體)**：Golang 說，別用白板了。我給你一個神奇的「**傳送管道 (Channel)**」。你想把資料給誰，直接把資料放進這個管道，管道的另一端會安全地把它交給接收者。這個管道是內建安全機制的，你完全不用擔心兩個人會同時操作它。

Channel 就是這個「傳送管道」，是 Goroutine 之間溝通的主要橋樑。它讓資料在不同的 Goroutine 之間進行安全的傳遞，從而避免了傳統併發程式設計中手動管理鎖的複雜性和風險。

## 什麼是 Channel？

從技術上講，Channel 是一個**帶有型別**的管道，你可以用它在 Goroutine 之間發送和接收特定型別的值。它有以下幾個關鍵特性：

1.  **型別安全 (Type-Safe)**：`chan int` 只能傳輸 `int` 型別的資料，`chan string` 只能傳輸 `string`。編譯器會幫你檢查，防止你傳錯型別。
2.  **先進先出 (FIFO)**：通常情況下，發送到 Channel 的資料會按照發送的順序被接收。
3.  **內建同步 (Built-in Synchronization)**：Channel 的發送和接收操作是**阻塞**的。這一點是 Channel 的精髓所在，我們稍後會詳細解釋。
4.  **執行緒安全 (Goroutine-Safe)**：你可以安全地在多個 Goroutine 中同時使用一個 Channel，Go Runtime 會處理好所有內部的鎖定細節。

## Channel 的基本操作

Channel 的操作只有三種：建立、發送和接收。

**1. 建立 Channel**

我們使用內建的 `make` 函式來建立 Channel。

```go
// 建立一個可以傳輸 int 型別的 channel
ch := make(chan int)

// 建立一個可以傳輸 string 型別的 channel
messages := make(chan string)
```

**2. 發送資料**

使用 `<-` 運算子將資料發送到 Channel。可以想像成箭頭 `<-` 指示著資料流動的方向。

```go
// 將數字 10 發送到 channel 'ch'
ch <- 10

// 將字串 "hello" 發送到 channel 'messages'
messages <- "hello"
```

**3. 接收資料**

同樣使用 `<-` 運算子，但位置不同，這次是從 Channel 中取出資料。

```go
// 從 channel 'ch' 接收一個數字，並存到變數 'number' 中
number := <-ch

// 從 channel 'messages' 接收一個字串，並存到變數 'msg' 中
msg := <-messages

// 如果你只關心是否收到了訊號，不關心具體的值，可以忽略它
<-ch
```

## 實戰：用 Channel 傳遞結果

讓我們來解決一開始提出的問題：一個 Goroutine 計算完畢後，如何把結果安全地傳回 `main`？

```go
package main

import (
	"fmt"
	"time"
)

// 這個 worker 會執行一個耗時的計算，然後將結果發送到 channel 中
func calculate(resultChan chan int) {
	fmt.Println("Worker: Starting calculation...")
	time.Sleep(2 * time.Second) // 模擬複雜計算
	result := 42
	fmt.Println("Worker: Calculation finished. Sending result.")

	// 將計算結果發送到 channel
	resultChan <- result
}

func main() {
	// 建立一個 channel 用於接收結果
	resultChannel := make(chan int)

	// 啟動 worker goroutine，並把 channel 傳給它
	go calculate(resultChannel)

	fmt.Println("Main: Waiting for result...")

	// 從 channel 接收結果。這一行會被阻塞！
	finalResult := <-resultChannel

	fmt.Printf("Main: Received result: %d\n", finalResult)
}
```

執行結果：

```text
Main: Waiting for result...
Worker: Starting calculation...
Worker: Calculation finished. Sending result.
Main: Received result: 42
```

**程式碼解析：**
1.  在 `main` 中，我們用 `make(chan int)` 建立了一個整數 Channel。
2.  我們啟動 `calculate` Goroutine，並將這個 Channel 作為參數傳遞進去。
3.  `main` 函式執行到 `finalResult := <-resultChannel` 這一行時，**它會停下來，靜靜地等待**，直到有資料可以從 `resultChannel` 中被讀取。
4.  與此同時，`calculate` Goroutine 正在執行它的「複雜計算」。計算完成後，它執行 `resultChan <- result`，將數字 42 發送到 Channel。
5.  就在 `calculate` Goroutine 發送資料的那一刻，`main` Goroutine 立刻就收到了資料，`<-resultChannel` 的阻塞被解除，`main` 函式繼續往下執行並印出結果。

我們不僅成功傳遞了資料，還**獲得了同步**！`main` Goroutine 的等待是透過 Channel 的接收操作自然實現的，不再需要 `sync.WaitGroup` 了。

## 今日總結

今天我們接觸到了 Go 併發編程最核心的組件——Channel。
1.  我們理解了 Go 的併發哲學：「透過溝通來共享記憶體」。
2.  學會了 Channel 的三大基本操作：`make` 建立、`ch <- v` 發送、`v := <-ch` 接收。
3.  透過一個實戰範例，我們體驗了如何使用 Channel 在 Goroutine 之間安全地傳遞資料，並利用其**阻塞特性**實現了隱式的同步。

我們今天使用的 `make(chan int)` 建立的是一個**無緩衝 (Unbuffered) Channel**。它的特性是：發送操作會一直阻塞，直到有另一個 Goroutine 準備好接收；反之亦然。這就像一手交錢，一手交貨，雙方必須同時在場。

但如果我們希望發送方不用等待接收方，而是像快遞員把包裹放進快遞櫃一樣，放進去就走人呢？這就需要用到**有緩衝 (Buffered) Channel**了。

預告 Day 5: **【Channels的雙面刃】無緩衝的同步之舞 vs. 有緩衝的非同步效率**。我們將深入探討這兩種 Channel 的區別和各自的使用場景。
