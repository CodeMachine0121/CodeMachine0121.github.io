---
title:  "Day 3: sync.WaitGroup 你的團隊合作好幫手"
datetime: "2025-10-11"
description: "在 Day 2 中，我們成功用 `go` 關鍵字啟動了我們的第一個 Goroutine。但我們也留下了一個懸念：如何優雅、可靠地等待一個或多個 Goroutine 完成它們的任務？我們使用了 `time.Sleep` 這個「土法煉鋼」的方式，但我們都知道，這在真實世界中是完全行不通的。"
parent: "Goroutine 最佳入門姿勢"
---

## 前言

在 Day 2 中，我們成功用 `go` 關鍵字啟動了我們的第一個 Goroutine。但我們也留下了一個懸念：如何優雅、可靠地等待一個或多個 Goroutine 完成它們的任務？我們使用了 `time.Sleep` 這個「土法煉鋼」的方式，但我們都知道，這在真實世界中是完全行不通的。

今天，我們就要來學習 Golang 官方`sync`標準庫中提供的利器——`sync.WaitGroup`。它能幫助我們精準地同步，確保主 Goroutine 會耐心等待所有「背景工作」都完成後，再繼續往下走。

## 一個比喻：專案經理與他的任務

想像你是一位專案經理 (Project Manager)，你手上有好幾個任務需要分派給不同的團隊成員去執行。你的工作流程是這樣的：

1.  **登記任務**：在開始之前，你先在你的待辦清單上登記：「我總共有 3 個任務需要追蹤」。
2.  **分派任務**：你把這 3 個任務分別交給 3 位成員，讓他們**同時**開工。
3.  **等待回報**：你不會自己先下班，而是在辦公室裡等待。每當有一位成員完成任務，他就會來跟你回報：「經理，我做完了！」。你就在清單上劃掉一項。
4.  **完成收工**：直到所有 3 位成員都來回報，清單上的任務都劃掉了，你才知道所有工作都完成了，這時你才能安心下班。

`sync.WaitGroup` 做的就是完全一樣的事情！

*   **專案經理** -> **主 Goroutine (main)**
*   **團隊成員** -> **我們啟動的其他 Goroutine**
*   **待辦清單** -> **`sync.WaitGroup` 內部的一個計數器**

## ***sync.WaitGroup*** 的三大神器

`WaitGroup` 的使用非常簡單，它主要只有三個方法：

1.  `Add(delta int)`：**增加計數器**。相當於專案經理在清單上登記任務。如果你要啟動 N 個 Goroutine，通常會在一開始就呼叫 `Add(N)`。
2.  `Done()`：**減少計數器** (等同於 `Add(-1)`）。相當於團隊成員來回報任務完成。通常我們會在 Goroutine 的任務結束時，透過 `defer` 來呼叫它。
3.  `Wait()`：**阻塞直到計數器歸零**。相當於專案經理的等待過程。它會一直卡在那裡，直到所有 Goroutine 都呼叫了 `Done()`，讓計數器變回 0。

## 實戰：用 `WaitGroup` 改造昨天的程式

讓我們把 Day 2 的 `time.Sleep` 範例，用 `WaitGroup` 來進行一次華麗的升級。

```go
package main

import (
	"fmt"
	"sync" // 引入 sync 套件
	"time"
)

// 我們讓 worker 函式接收一個指向 WaitGroup 的指標
func worker(id int, wg *sync.WaitGroup) {
    // defer 關鍵字確保在函式結束時，一定會執行 Done()
    // 這樣無論函式是正常結束還是中途發生 panic，都能確實通知 WaitGroup
	defer wg.Done()

	fmt.Printf("Worker %d starting\n", id)

	// 模擬一個耗時的任務
	time.Sleep(time.Second)

	fmt.Printf("Worker %d done\n", id)
}

func main() {
	// 宣告一個 WaitGroup
	var wg sync.WaitGroup

	// 我們要啟動 3 個 worker goroutine
	for i := 1; i <= 3; i++ {
		// 在每次啟動 goroutine 前，計數器 +1
		wg.Add(1)

		// 啟動 goroutine，並將 wg 的記憶體位址傳入
		go worker(i, &wg)
	}

	fmt.Println("Main: Waiting for workers to finish...")
	// Wait() 會阻塞在這裡，直到計數器歸零
	wg.Wait()

	fmt.Println("Main: All workers have finished. Exiting.")
}
```

執行這段程式碼，你會看到類似下面的輸出：

```text
Main: Waiting for workers to finish...
Worker 3 starting
Worker 1 starting
Worker 2 starting
Worker 2 done
Worker 1 done
Worker 3 done
Main: All workers have finished. Exiting.
```
*(Worker 的啟動和完成順序是不固定的，這正是併發的體現！)*

**程式碼解析：**
1.  我們在 `main` 函式中宣告了一個 `var wg sync.WaitGroup`。
2.  在 `for` 迴圈中，我們總共要啟動 3 個 Goroutine。所以在每次 `go worker(...)` **之前**，我們都呼叫 `wg.Add(1)`，明確地告訴 `WaitGroup`：「嘿，我又有一個任務要追蹤了」。
3.  `worker` 函式接收一個 `*sync.WaitGroup` 型別的參數。我們傳入 `&wg` (wg 的記憶體位址)，是為了確保所有 Goroutine 操作的都是**同一個** `WaitGroup` 實例。
4.  在 `worker` 函式的第一行，我們使用 `defer wg.Done()`。這是一個極佳的實踐！`defer` 能保證這行程式碼會在函式回傳前的最後一刻執行。這意味著不論 `worker` 函式中間的程式多麼複雜，甚至發生 `panic`，`wg.Done()` 都會被執行，計數器就會被正確地減 1。
5.  最後，`main` 函式呼叫 `wg.Wait()`。它會在這裡暫停執行，靜靜地等待 `wg` 的內部計數器從 3 變成 0。當第三個 `worker` 呼叫 `Done()` 使計數器歸零時，`Wait()` 就會解除阻塞，`main` 函式繼續執行最後的 `Println`。

## 一個常見的陷阱 (Gotcha!)

初學者有時會犯一個錯誤：把 `wg.Add(1)` 放在 Goroutine 裡面呼叫。

```go
// 錯誤的範例！
for i := 1; i <= 3; i++ {
    // 錯誤：把 Add() 移到了 goroutine 內部
    go func(id int, wg *sync.WaitGroup){
        wg.Add(1) // 在這裡才 Add
        worker(id, wg)
    }(i, &wg)
}
wg.Wait()
```

**為什麼這是錯的？**
因為這裡存在**競爭條件 (Race Condition)**。`go` 關鍵字只負責啟動 Goroutine，它不會等待 Goroutine 真正開始執行。所以，`for` 迴圈可能很快就跑完了，而這 3 個 Goroutine 可能都還沒來得及執行到 `wg.Add(1)`，外面的 `wg.Wait()` 就已經被呼叫了。這時 `WaitGroup` 的計數器還是 0，`Wait()` 會認為沒有任何任務需要等待，於是直接通過，導致程式提前退出。

**永遠記住：`Add()` 必須在 `go` 關鍵字呼叫之前執行，以確保 `Wait()` 開始等待時，計數器已經是正確的值。**

## 今日總結

`sync.WaitGroup` 是我們併發編程工具箱中的第一個，也是最基礎的同步原語。
1.  我們學會了使用 `sync.WaitGroup` 來取代不穩定的 `time.Sleep`，實現可靠的同步等待。
2.  掌握了它的三大核心方法：`Add()` 用於增加計數，`Done()` 用於減少計數，`Wait()` 用於阻塞等待計數器歸零。
3.  了解了最佳實踐：在啟動 Goroutine **之前**呼叫 `Add()`，並在 Goroutine 中使用 `defer wg.Done()` 來確保計數器被正確更新。

`WaitGroup` 完美地解決了「等待任務完成」的問題。但是，如果 Goroutine 不僅僅是執行任務，還需要把「執行結果」回傳給 `main` 函式呢？`WaitGroup` 本身並不負責傳遞資料。

這就引出了我們明天的課題：Goroutine 之間該如何安全、優雅地溝通和傳遞資料？

預告 Day 4: **【Goroutine的橋樑】Channels：優雅地在並行世界中傳遞訊息**。我們將會見識到 Go 語言併發哲學的精髓！
