---
title:  "Day 2: 用一行 go 關鍵字，開啟並行的奇幻旅程"
datetime: "2025-10-10"
description: "在 Day 1 我們釐清了並行 (Concurrency) 與平行 (Parallelism) 的觀念，並了解到 Golang 的設計核心就是讓「並行」的程式設計變得簡單。今天，我們將不再紙上談兵，而是要親手寫下第一段併發程式碼，召喚出我們的主角——Goroutine"
parent: "Goroutine 最佳入門姿勢"
---

## 前言

在 Day 1 我們釐清了並行 (Concurrency) 與平行 (Parallelism) 的觀念，並了解到 Golang 的設計核心就是讓「並行」的程式設計變得簡單。今天，我們將不再紙上談兵，而是要親手寫下第一段併發程式碼，召喚出我們的主角——**Goroutine**。

準備好了嗎？讓我們用一行神奇的關鍵字 `go`，正式走進並行的世界！

## 什麼是 Goroutine？

在深入程式碼之前，我們先來認識一下 Goroutine 到底是什麼。

你可以把它想像成一個由 **Golang 執行時 (Go Runtime) 所管理的、極其輕量的「執行緒 (Thread)」**。

相比於作業系統 (OS) 層級的傳統執行緒，Goroutine 有兩大優勢：

1.  **更輕量 (Lighter Weight)**：
    *   **記憶體佔用小**：每個 Goroutine 的初始堆疊 (stack) 大小僅有約 2KB，而 OS 執行緒通常需要 1MB 到 2MB。這意味著你可以在一個程式中，輕鬆地同時運行數十萬甚至上百萬個 Goroutine，而 OS 執行緒開個幾千個可能就會耗盡系統資源。
    *   **創建與銷毀成本低**：Goroutine 的創建與銷毀由 Go Runtime 管理，不涉及系統呼叫 (syscall)，成本遠低於 OS 執行緒。

2.  **調度更高效 (More Efficient Scheduling)**：
    *   **由 Go Runtime 調度**：Goroutine 之間的切換不需經過作業系統核心，切換延遲極低。Go 的調度器 (Scheduler) 會將多個 Goroutine 智慧地分配 (multiplex) 到少量的 OS 執行緒上執行。這個我們後續章節會深入探討 (G-P-M 模型)。

總而言之，Goroutine 就是 Go 語言提供給我們用來實現併發的、**成本極低且效能極高**的執行單位。

## 我們的第一個 Goroutine

廢話不多說，上程式碼！假設我們有一個簡單的函式 `sayHello`。

```go
package main

import (
	"fmt"
)

func sayHello() {
	fmt.Println("Hello from sayHello function!")
}

func main() {
	// 一般的函式呼叫 (同步執行)
	sayHello()
	fmt.Println("Hello from main function!")
}
```

執行這段程式碼，你會得到非常符合預期的結果：

```text
Hello from sayHello function!
Hello from main function!
```

這是一個**同步 (Synchronous)** 的執行流程，`main` 函式會等待 `sayHello` 完全執行完畢後，才會繼續往下執行。

現在，讓我們施展魔法，在 `sayHello()` 前面加上 `go` 關鍵字：

```go
package main

import (
	"fmt"
)

func sayHello() {
	fmt.Println("Hello from Goroutine!")
}

func main() {
	// 使用 'go' 關鍵字，啟動一個新的 Goroutine
	go sayHello()

	fmt.Println("Hello from main function!")
}
```

再次執行，你可能會看到以下結果：

```text
Hello from main function!
```

咦？`"Hello from Goroutine!"` 跑去哪了？它被印出來了嗎？為什麼我們沒看到？

## 主 Goroutine (Main Goroutine) 的秘密

這就是我們遇到的第一個，也是最重要的 Goroutine 特性：

> Go 程式的 `main()` 函式本身就在一個特殊的 Goroutine 中運行，我們稱之為 **主 Goroutine (Main Goroutine)**。當主 Goroutine 執行結束時，整個程式就會**立即退出**，不管其他的 Goroutine 是否已經執行完畢。

回到我們的咖啡店比喻：主 Goroutine 就是咖啡店的老闆。當老闆說「好了，今天打烊了！」(`main` 函式執行完畢)，所有還在工作的咖啡師 (其他的 Goroutine) 就會立刻被強制下班，哪怕手上的咖啡才做了一半。

在我們的範例中，`go sayHello()` 啟動了一個新的 Goroutine 後，主 Goroutine **完全不會等待它**，而是立刻繼續往下執行 `fmt.Println("Hello from main function!")`。印出這句話後，`main` 函式就結束了，程式隨之關閉。而那個剛被啟動的 `sayHello` Goroutine，可能還來不及被 Go 調度器分配到 CPU 上執行，整個程式就已經煙消雲散了。

## 一個簡單（但錯誤）的修正方式

那麼，該如何讓主 Goroutine 等一下其他的 Goroutine 呢？一個最直觀的想法就是：「讓主 Goroutine 睡一會兒，給別人一點時間」。

```go
package main

import (
	"fmt"
	"time" // 引入 time 套件
)

func sayHello() {
	fmt.Println("Hello from Goroutine!")
}

func main() {
	go sayHello()

	fmt.Println("Hello from main function!")

	// 讓主 Goroutine 睡一秒鐘
	time.Sleep(1 * time.Second)
    fmt.Println("Main function finished.")
}
```

這次再執行，你應該就能成功看到：

```text
Hello from main function!
Hello from Goroutine!
Main function finished.
```
*(注意：`Hello from main function!` 和 `Hello from Goroutine!` 的順序可能會因為調度而改變)*

太棒了！我們成功了！……但先別高興得太早。

使用 `time.Sleep` 是一個**非常糟糕**的同步方式。為什麼？
*   **你得靠猜**：你怎麼知道該睡多久？1 秒？100 毫秒？如果 `sayHello` 是一個需要 2 秒才能完成的複雜任務，睡 1 秒鐘顯然不夠。
*   **效率低下**：如果 `sayHello` 只需要 10 毫秒就完成了，主 Goroutine 卻依然傻傻地睡了整整 1 秒，這 990 毫秒的時間就完全被浪費了。

`time.Sleep` 在這裡只是一個教學工具，用來證明 Goroutine 確實需要時間來執行。在真實的專案中，我們**絕對不能**使用這種不確定的方式來等待 Goroutine。

## 今日總結

今天我們跨出了巨大的一步：
1.  我們認識了 Goroutine 是 Go 語言中輕量、高效的併發執行單位。
2.  學會了使用 `go` 關鍵字來啟動一個新的 Goroutine。
3.  理解了主 Goroutine 的重要規則：它一旦結束，整個程式就結束。
4.  知道了為什麼 `time.Sleep` 是一種不可靠的同步方法。

我們已經成功地把任務「丟」了出去，但還不知道如何優雅地「回收」結果或等待它完成。這正是我們明天要解決的問題。

預告 Day 3: **【Goroutine的同步與等待】`sync.WaitGroup`：你的團隊合作好幫手**。我們將會學習 Go 語言提供的標準工具，來精準、可靠地等待我們的 Goroutine 完成任務！
