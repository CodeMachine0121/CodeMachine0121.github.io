---
title: "Day 9  Kata 演練：FizzBuzz (一) - 寫下第一個失敗的測試 (紅燈)"
datetime: "2025-08-11"
description: "在 Day 9，我們將正式開始我們的第一個 TDD Kata 練習。我們將完全遵循 TDD 的節奏，從最小的需求出發，為 FizzBuzz 問題寫下第一個「注定會失敗」的測試。"
parent: "2025 ithome-鐵人賽: 從 0 到 1：與 AI 協作的 Golang TDD 實戰 系列"
image: "/images/titles/golang-coffee.png"
---

## 昨日回顧與今日目標

在 Day 8，我們成功搭建了 TDD Kata 練習的專案，一個結構清晰的 go-tdd-kata 專案。我們將開始 TDD 的黃金循環： **「紅燈 -> 綠燈 -> 重構」** ，而這一切的起點，就是點亮「紅燈」。

> 今天的目標：為我們的第一個 Kata「FizzBuzz」，寫下一個最小化的、注定會失敗的測試案例。

這一步是 TDD 中最考驗紀律性的一步。我們需要抑制住立即開始寫 production code 的衝動，而是先專注於「定義我們下一步的目標」。

## Kata 介紹：FizzBuzz 問題

FizzBuzz 是一個經典的程式設計題，規則簡單，卻足以用來檢視程式設計師的基礎能力。它的規則如下：

編寫一個函式，接收一個整數 `n`，並根據以下規則回傳一個字串：

- 如果 n 是 3 的倍數，回傳 "Fizz"。
- 如果 n 是 5 的倍數，回傳 "Buzz"。
- 如果 n 同時是 3 和 5 的倍數，回傳 "FizzBuzz"。
- 在其他所有情況下，回傳數字 n 本身的字串形式。

## TDD 的思考藝術：「先想最小的，再想下一步」

面對以上這四條規則，我們應該先從哪一條開始？

一個新手可能會想從最複雜的 "FizzBuzz" 開始，但 TDD 會告訴你：

> 永遠從最簡單、最平凡的案例開始。

在 FizzBuzz 問題中，最簡單的案例是什麼？ 是規則4：當數字不是 3 或 5 的倍數時，直接回傳數字本身，而在這個案例中，最簡單的輸入又是什麼？是 1。

所以，我們的第一個測試目標就確定了： **「當輸入為 1 時，函式應回傳字串 '1'」**

> TDD 的精髓：將一個大問題，分解成一個個微小、可驗證的步驟。

## 動手實踐

現在，打開我們在 Day 8 建立的專案，找到 `fizzbuzz/fizzbuzz_test.go` 檔案，我們將使用在 Day 6 學到的「表格驅動測試」模式來組織我們的測試。

將以下程式碼完整地(自己手寫更有記憶) 貼到 fizzbuzz/fizzbuzz_test.go 中：

```golang
// fizzbuzz/fizzbuzz_test.go
package fizzbuzz

import (
    "testing"

    "github.com/stretchr/testify/assert"
)

func TestFizzBuzzGenerator(t *testing.T) {
    // 我們使用表格驅動測試的結構
    testCases := []struct {
        name     string
        input   int
        expected string
    }{
        // 這是我們定義的第一個，也是目前唯一的測試案例
        {
            name:     "should return '1' for number 1",
            input:   1,
            expected: "1",
        },
    }

    for _, tc := range testCases {
        t.Run(tc.name, func(t *testing.T) {
            // 呼叫我們「即將」實現的產品程式碼
            result := Generate(tc.input)
            // 斷言結果是否符合預期
            assert.Equal(t, tc.expected, result)
        })  
    }
}
```

### 程式碼分析：

- 我們導入了 `testify/assert` 來幫助我們寫出優雅的斷言。
- 我們定義了 testCases 表格，並且只放入了那一個最簡單的案例。

在 `t.Run 中`，我們呼叫了 `Generate()` 函式（它目前還在 fizzbuzz.go 中，回傳的是一個空字串），我們 assert `Generate(1)` 的結果應該要等於 "1"。

### 見證「紅燈」的時刻

一切就緒，回到terminal，確保你在專案的根目錄 (go-tdd-kata)，然後執行我們熟悉的指令：

```bash
go test -v ./...
```

如果一切順利，你將會看到期待已久的「紅色」失敗訊息！

```text
=== RUN   TestFizzBuzzGenerator
=== RUN   TestFizzBuzzGenerator/should_return_1_for_number_1
    fizzbuzz_test.go:27:
                Error Trace:    go-tdd-kata/fizzbuzz/fizzbuzz_test.go:27
                Error:          Not equal:
                                expected: "1"
                                actual  : ""

                                Diff:
                                --- Expected
                                +++ Actual
                                @@ -1 +1 @@
                                -1
                                +
                Test:           TestFizzBuzzGenerator/should_return_1_for_number_1
--- FAIL: TestFizzBuzzGenerator (0.00s)
    --- FAIL: TestFizzBuzzGenerator/should_return_1_for_number_1 (0.00s)
FAIL
FAIL    go-tdd-kata/fizzbuzz    2.301s
FAIL
```

### 分析失敗報告

這份報告非常清晰地告訴我們：

- 在名為 `should return '1' for number 1` 的子測試中發生了錯誤。
- 錯誤的原因是：**預期 (expected) 得到 `"1"`，但實際 (actual) 得到的是 `""` (空字串)。**

為什麼會這樣？ 因為我們的產品程式碼 `fizzbuzz.go` 中的 `Generate` 函式現在長這樣：

```golang
func Generate(number int) string {
    return "" // 它總是回傳空字串
}
```

測試結果完美地反映了程式碼的現狀，第一次勝利：這盞紅燈是我們的目標。對於 TDD 開發者來說，看到這個紅燈並不是挫敗，而是第一次的勝利，我們成功地：

- 將一個模糊的需求，轉化為一個精確、可自動執行的規格。
- 建立了一個清晰的目標。
- 擁有了一個能夠在我們達成目標時通知我們的「裁判」。

## 今日總結

今天我們嚴格遵守了 TDD 的紀律，邁出了最關鍵的第一步，我們分析了需求，選擇了最簡單的案例，並為它編寫了一個會失敗的測試，成功點亮了 TDD 循環中的「紅燈」。

預告：Day 10 - Kata 演練：FizzBuzz (二) - 最簡單的實作與重構 (綠燈 -> 重構)
既然目標已經明確，明天我們的任務就變得非常簡單：寫下「最少量」的程式碼，不多不少，剛好讓今天這盞紅燈變綠。我們將體驗到 TDD 循環中，從「紅」到「綠」的爽感，並探討在這個微小循環中，「重構」的意義。