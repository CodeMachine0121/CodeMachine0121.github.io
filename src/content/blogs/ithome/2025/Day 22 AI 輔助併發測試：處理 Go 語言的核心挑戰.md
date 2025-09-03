---
title: "Day 22 - AI 輔助併發測試：處理 Go 語言的核心挑戰"
datetime: "2025-08-24"
description:  "學習如何利用 AI，幫助我們輕鬆地編寫併發測試，並使用 TDD 的方式，來修復併發場景下的競爭條件 Bug。"
parent: "2025 ithome-鐵人賽: 從 0 到 1：與 AI 協作的 Golang TDD 實戰 系列"
image: "/images/titles/golang-dota.jpg"
---

## 昨日回顧與今日目標

在 Day 21，我們成功地將 AI 轉變為我們的專業QA，利用它的窮舉能力，為我們的程式碼增加了大量邊界條件測試，極大地提升了程式碼的可用性。

然而，到目前為止，我們所有的測試和程式碼都還運行在一個 **單執行緒** 的環境中，但我之所以選擇 Golang，正是看中了它的併發 (Concurrency) 能力。一個在單執行緒下完美無瑕的函式，在成百上千個 **Goroutine** 的同時呼叫下，可能因為資源爭搶而瞬間崩潰，這就是競爭條件 (Race Condition)，它是併發程式設計中最隱蔽、最難除錯的 Bug 之一。

> 今天的目標：學習如何利用 AI，幫助我們輕鬆地編寫併發測試，並使用 TDD 的方式，來修復併發場景下的競爭條件 Bug。

讓我們建立一個全新的、簡單的場景來進行今天的演練。

## 第零步 建立新套件

在專案中建立一個 `counter` 套件，並在其中建立 `counter.go` 和 `counter_test.go` 兩個檔案。

寫一個有問題的計數器: 故意寫一個在併發場景下有問題的計數器。

```golang
// counter/counter.go
package counter

// Counter 是一個簡單的計數器結構
type Counter struct {
    value int
}

// NewCounter 建立一個新的計數器
func NewCounter() *Counter {
    return &Counter{}
}

// Increment 將計數器的值加一
func (c *Counter) Increment() {
    c.value++
}

// Value 回傳計數器的當前值
func (c *Counter) Value() int {
    return c.value
}
```

這個計數器在單執行緒下工作正常，但 `c.value++` 這個操作是`有狀態`的，當多個 Goroutine 同時執行時，就會發生競爭，導致計數結果不準確。

## 第一步：詠唱 Prompt，生成併發測試 -> 點亮紅燈

我們如何用測試來證明這個計數器在併發下是有問題的? 我們需要一個能模擬「大量使用者同時訪問」的測試。

打開空的 counter/counter_test.go，對 Copilot Chat 下達指令：

```markdown
(角色) 你是一位精通 Go 語言併發程式設計和 TDD 的專家。
(上下文) 我正在 counter 套件中，需要為 Counter 結構編寫一個併發測試。
(指令) 請為我生成一個測試函式 TestCounter_Concurrent，測試需要建立一個新的 Counter，使用 `sync.WaitGroup` 來協調 Goroutines。同時啟動 1000 個 Goroutines，每個 Goroutine 都呼叫一次 `counter.Increment()` 方法，等待所有 Goroutines 執行完畢後，Assert `counter.Value()` 的最終結果應該是 1000。
(限制) 請只生成測試程式碼。
```

AI 可能的輸出:

```golang
// counter/counter_test.go
package counter

import (
    "sync"
    "testing"
    "github.com/stretchr/testify/assert"
)

func TestCounter_Concurrent(t *testing.T) {
    // 期望的計數次數
    expectedCount := 1000

    // 建立計數器
    counter := NewCounter()

    // 建立 WaitGroup 用於同步
    var wg sync.WaitGroup
    wg.Add(expectedCount)

    // 啟動 1000 個 goroutines
    for i := 0; i < expectedCount; i++ {
        go func() {
            defer wg.Done() // 確保 goroutine 結束時通知 WaitGroup
            counter.Increment()
        }()
    }

    // 等待所有 goroutines 完成
    wg.Wait()

    // Assert
    assert.Equal(t, expectedCount, counter.Value())
}
```

### Go 的 -race 檢測器

為了更精準地捕捉競爭條件，我們可以給 go test 指令增加一個強大的旗標：`-race`。
現在，在終端機執行：

```bash
go test -v -race ./...
```

你會看到兩種可能的紅燈：

- Assert 失敗： 測試直接失敗，並報告 `Error: Not equal: expected: 1000 actual: 998 (或某個小於 1000 的數字)`。
- Race Detector 報錯： 測試可能會通過，但終端機會打印出鮮紅的 `WARNING: DATA RACE` 報告，並精準地指出是 counter.go 的哪一行（c.value++）發生競爭。

無論哪種情況，這盞「紅燈」都確鑿無疑地證明了我們的程式碼存在嚴重的併發問題。

## 第二步：詠唱 Prompt，修復競爭條件 -> 轉為綠燈

我們已經有了一個能穩定復現問題的測試，現在，讓 AI 來幫我們修復它:

```markdown
**(上下文)** (開啟 counter.go 和 counter_test.go 兩個檔案)
**(指令)** 我的併發測試 TestCounter_Concurrent 失敗了，並且 -race 檢測器報告了資源競爭。請修改 counter.go 中的 Counter struct 和它的方法，確保併發安全。
```

AI 可能的輸出:

```golang
// 修改後的 counter/counter.go
package counter

import "sync" // 導入 sync 套件

// Counter 是一個併發安全的計數器
type Counter struct {
    mu    sync.Mutex // 加入互斥鎖
    value int
}

func NewCounter() *Counter {
    return &Counter{}
}

// Increment 使用鎖來保護寫操作
func (c *Counter) Increment() {
    c.mu.Lock()         // 加鎖
    defer c.mu.Unlock() // 確保函式結束時解鎖
    c.value++
}

// Value 使用鎖來保護讀操作
func (c *Counter) Value() int {
    c.mu.Lock()
    defer c.mu.Unlock()
    return c.value
}
```

再次執行 `go test -v -race ./...`，你會發現 AI幫我們加上了 `Mutex` 所的機制讓測試穩定地通過，並且 -race 檢測器再也沒有發出任何警告。綠燈！我們的計數器現在是併發安全的了。

## 今日總結

今天，我們挑戰了 Go 語言的核心——併發，並成功地利用 AI 駕馭了它。

- 我們讓 AI 為我們生成結構複雜但模式固定的併發單元測試，極大地降低了我們的認知負擔。
- 我們掌握了使用 `go test -race` 這個強大利器，來科學地、可復現地檢測出競爭條件 (Race Condition)。
- 我們體驗了一次由「併發測試」驅動的 TDD 循環，讓 AI 幫我們用互斥鎖 (Mutex) 修復了併發 Bug，將一個「執行緒不安全」的物件，改造成了「執行緒安全」的健壯物件。

AI 在處理這類需要大量樣板程式碼和固定模式的場景時，表現出了無與倫比的效率和準確性。

預告：Day 23 - 利用 AI 為既有程式碼補上「特性測試」
我們已經學會瞭如何從零開始，用 TDD 和 AI 開發新的、併發安全的程式碼。但現實世界中，我們更多的時間是在面對沒有測試的 **「舊程式碼」** 。
明天，我們將使用到一項至關重要的「考古」技能： 為一個神秘的舊函式編寫「特性測試」，在不理解其內部邏輯的情況下，為它建立起一層寶貴的保護傘，為未來的重構鋪平道路。