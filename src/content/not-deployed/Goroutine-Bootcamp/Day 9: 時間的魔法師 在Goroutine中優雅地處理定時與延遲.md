---
title: "Day 9: 時間的魔法師 在Goroutine中優雅地處理定時與延遲"
datetime: "2025-10-18"
description: "在 Day 8，我們透過單向 Channel 為我們的併發 API 加上了型別安全。到目前為止，我們的 Goroutine 都是事件驅動的——它們因為 Channel 裡來了資料而觸發工作。但是，如果我們想引入「時間」這個維度呢？"
parent: "Goroutine 最佳入門姿勢"
---

## 前言

在 Day 8，我們透過單向 Channel 為我們的併發 API 加上了型別安全。到目前為止，我們的 Goroutine 都是事件驅動的——它們因為 Channel 裡來了資料而觸發工作。但是，如果我們想引入「時間」這個維度呢？

*   如何讓一個操作在**延遲** 2 秒後執行？
*   如何建立一個**定時**任務，每隔 500 毫秒就執行一次？

你可能會想到 `time.Sleep()`，但它有一個問題：它會**阻塞**整個 Goroutine。在 `select` 結構中，我們希望的是一種非阻塞的、能與其他 Channel 操作一起被監聽的時間事件。幸運的是，Go 的 `time` 套件提供了與 Channel 完美整合的時間工具：`Timer` 和 `Ticker`。

## 一個比喻：廚房裡的計時器

1.  **`time.Timer` (一次性鬧鐘)**
    你正在烤蛋糕，食譜說要烤 30 分鐘。你拿出一個廚房計時器，設定了 30 分鐘，然後就去做別的事情了。30 分鐘後，計時器「叮」地一響，提醒你蛋糕烤好了。這個鬧鐘只會響**一次**。

2.  **`time.Ticker` (節拍器)**
    你正在做一份需要不斷攪拌的醬汁，要求每 30 秒就要攪拌一次。你拿出一個節拍器，設定為 30 秒響一次。接下來的時間裡，它會穩定地、每隔 30 秒就「滴答」一聲，提醒你該攪拌了。這個節拍器會**持續不斷**地響。

在 Go 的世界裡，`Timer` 和 `Ticker` 的「響鈴」信號，就是透過 Channel 來傳遞的。

## time.Timer：一次性的延遲事件

`Timer` 會在指定的時間延遲後，向其內部的一個 Channel 發送一個時間值。

我們在 Day 7 其實已經見過它的簡化版 `time.After(duration)`。`time.After` 是一個方便的函式，它內部會建立一個 `Timer` 並直接返回其 Channel。

讓我們看看如何用它來實現一個簡單的延遲執行。

```go
package main

import (
	"fmt"
	"time"
)

func main() {
	fmt.Println("Program started. Waiting for 2 seconds...")

	// <-time.After(2 * time.Second) 會阻塞，直到 2 秒後
	// 它的 channel 接收到一個值
	<-time.After(2 * time.Second)

	fmt.Println("2 seconds have passed. Program finished.")
}
```

這個範例雖然簡單，但它展示了 `Timer` 與 Channel 的結合。它真正的威力體現在 `select` 語句中，用於實現超時控制，我們在 Day 7 已經詳細探討過。

**停止計時器 `Timer.Stop()`**
如果你用 `time.NewTimer()` 創建了一個計時器，但在它觸發前，你因為其他原因不再需要它了（例如，`select` 中的另一個 case 先被觸發），一個好的習慣是呼叫 `timer.Stop()` 來停止它。這可以讓 Golang 的垃圾回收器及時回收計時器相關的資源。

```go
timer := time.NewTimer(3 * time.Second)

select {
case <-someOtherChan:
    // 另一個 channel 先到了
    // 我們不再需要這個 timer 了，最好停掉它
    if !timer.Stop() {
        <-timer.C // 如果 Stop 返回 false，說明 timer 可能已經觸發了，需要手動排空 channel
    }
case <-timer.C:
    // timer 觸發了
    fmt.Println("Timer fired!")
}
```

## time.Ticker：週期性的定時任務

`Ticker` 是一個結構，它包含一個 Channel `C`。Go Runtime 會以固定的時間間隔，不斷地向這個 `C` Channel 發送當前的時間。

它的典型用法是在一個 `for...select` 迴圈中，持續監聽 `Ticker` 的 Channel。

```go
package main

import (
	"fmt"
	"time"
)

func main() {
	// 建立一個每 500 毫秒觸發一次的 Ticker
	ticker := time.NewTicker(500 * time.Millisecond)
	// 建立一個在 3 秒後觸發的 channel，用來停止 ticker
	stopper := time.After(3 * time.Second)

	// 使用 defer 來確保 ticker 在 main 函式結束時被停止
	// 這非常重要，可以防止 goroutine 洩漏
	defer ticker.Stop()

	fmt.Println("Ticker started. Will stop after 3 seconds.")

	for {
		select {
		case t := <-ticker.C:
			// 每次 ticker 觸發，就會執行這裡
			fmt.Println("Tick at", t.Format("15:04:05.000"))
		case <-stopper:
			// 3 秒時間到，停止訊號來了
			fmt.Println("Ticker stopped.")
			return // 結束函式
		}
	}
}
```
**執行結果：**
```text
Ticker started. Will stop after 3 seconds.
Tick at 10:07:01.500
Tick at 10:07:02.000
Tick at 10:07:02.500
Tick at 10:07:03.000
Tick at 10:07:03.500
Tick at 10:07:04.000
Ticker stopped.
```

**黃金法則：記得 `Stop()` 你的 Ticker！**
`Ticker` 和 `Timer` 不同，它會一直佔用系統資源，直到你明確地呼叫 `ticker.Stop()` 為止。如果你啟動了一個 `Ticker` 所在的 Goroutine，卻忘記在 Goroutine 結束時停止它，這個 `Ticker` 將會永遠存活下去，即使你已經不再需要它了。這是一個非常典型的 **Goroutine 洩漏 (Goroutine Leak)**。

所以，請務必養成好習慣：**當你不再需要一個 `Ticker` 時，一定要呼叫它的 `Stop()` 方法。** 使用 `defer` 是一個很好的實踐。

## 今日總結

今天，我們學會了如何使用 Go 語言提供的、與 Channel 緊密集成的時間工具：
1.  **`time.Timer`** (或 `time.After`) 用於實現**一次性**的延遲或超時，是併發程式中控制等待時間的利器。
2.  **`time.Ticker`** 用於實現**週期性**的定時任務，非常適合需要規律執行工作的場景。
3.  我們深刻理解了**停止計時器**的重要性，特別是對於 `Ticker`，必須呼叫 `Stop()` 方法來釋放資源，避免造成 Goroutine 洩漏。

我們剛剛提到了「Goroutine 洩漏」，這是一個非常重要的概念。除了忘記關閉 `Ticker`，還有哪些常見的錯誤寫法會導致我們的 Goroutine 像幽靈一樣，永遠運行在背景，悄悄地耗盡我們的系統資源呢？

預告 Day 10: **【記憶體的小偷】你的Goroutine正在悄悄洩漏嗎? **。我們將化身偵探，學習識別和預防幾種最常見的 Goroutine 洩漏場景。
