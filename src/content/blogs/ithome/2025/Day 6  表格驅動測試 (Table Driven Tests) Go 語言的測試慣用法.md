---
title: "Day 6  表格驅動測試 (Table Driven Tests) : Go 語言的測試慣用法"
datetime: "2025-08-09"
description: "在 Day 6，我們將深入 Golang 的表格驅動測試 (Table Driven Tests) 慣用法，學習如何使用表格來組織測試案例，讓測試程式碼更清晰、易於擴充。掌握這個模式後，你將能夠以最優雅的方式撰寫測試，並輕鬆應對各種情境。"
image: "/images/titles/golang-boxer.jpg"
parent: "2025 ithome-鐵人賽: 從 0 到 1：與 AI 協作的 Golang TDD 實戰 系列"
---

## 昨日回顧與今日目標

在 Day 5，我們學會了使用 testify 套件來撰寫優雅且富有表達力的斷言，並掌握了 `assert` 和 `require` 的使用時機，讓測試程式碼變得更加清晰易讀。

現在，我們來思考一個問題：如何測試我們的 `Add` 函式在多種不同情境下的行為？

- 正數 + 正數
- 正數 + 負數
- 兩個都是零
- ...等等

一個直覺的方法可能是這樣：

```golang
func TestAddScenarios(t *testing.T) {
    assert.Equal(t, 5, Add(2, 3))
    assert.Equal(t, 0, Add(-1, 1))
    assert.Equal(t, 0, Add(0, 0))
    assert.Equal(t, -5, Add(-2, -3))
}
```

或者為每種情境寫一個測試函式 (`TestAddPositive`, `TestAddNegative`...)，這兩種方法都有明顯的缺點：**程式碼重複**、 **難以管理**，而且當一個 assert 失敗時，我們不太容易一眼看出是哪一組「輸入」出了問題。

> 今天的目標：學習 Golang 的「最佳實踐」—— 表格驅動測試 (Table-Driven Tests)，用最優雅、最可擴充的方式來組織我們的測試案例。

## 什麼是表格驅動測試？

表格驅動測試是一種撰寫測試的模式，它的核心思想是：

> 將所有的測試案例（包含輸入、預期輸出和描述）定義在一個集中的「表格」結構中（通常是一個 Slice）。

編寫一段通用的測試邏輯，遍歷這個表格，讓每一個測試案例都執行一次這段通用的測試邏輯。這種模式能讓你的測試程式碼保持高度的 DRY (Don't Repeat Yourself)，並且在未來新增測試案例時變得異常簡單。

## 實現表格驅動測試的四個步驟

### 步驟一：定義「測試案例」的結構 (struct)

首先，我們需要定義一個 **struct** 來描述單一測試案例的所有元素，一個好的測試案例 struct 至少應該包含：
- name: 一個描述性的名稱，用於在測試失敗時快速定位問題。
- inputA, inputB: 函式的輸入。
- expected: 預期的回傳值。

```golang
// 在 calculator_test.go 中
func TestAddTableDriven(t *testing.T) {
    // 1. 定義測試案例的結構
    testCases := []struct {
        name     string // 測試案例名稱
        inputA   int
        inputB   int
        expected int
    }{
        // ... 案例將會填寫在這裡 ...
    }

    // ... 測試邏輯將會寫在這裡 ...
}
```

### 步驟二：填充你的「測試表格」

現在，我們將所有想測試的情境，作為 struct 的實例，填充到 `testCases` 這個 slice 中。這就是我們的「表格」。

```go
    // 2. 填充我們的測試表格
    testCases := []struct {
        name     string
        inputA   int
        inputB   int
        expected int
    }{
        {name: "正數 + 正數", inputA: 2, inputB: 3, expected: 5},
        {name: "正數 + 負數", inputA: 5, inputB: -2, expected: 3},
        {name: "負數 + 負數", inputA: -2, inputB: -3, expected: -5},
        {name: "與零相加", inputA: 10, inputB: 0, expected: 10},
    }
```

看到它的好處了嗎？ 所有的測試情境一目了然，就像在讀一份規格文件。想新增一個案例？只需在下面加一行即可。

### 步驟三：遍歷表格並執行測試

這是最核心的步驟。我們使用一個 for 迴圈來遍歷 testCases。

```golang
// 3. 遍歷表格，執行測試
for _, tc := range testCases {
    // ...
}
```

### 步驟四：使用 t.Run() 建立子測試

如果直接在 for 迴圈裡寫assert，當有案例失敗時，我們只會知道 TestAddTableDriven 失敗了，但不知道是哪一個案例。
為了得到更清晰的報告，我們使用 `t.Run()`，`t.Run` 可以建立一個獨立的「子測試」，這樣，每個表格中的案例都會成為一個可以獨立執行、獨立報告成功或失敗的測試單元。

```golang
// 完整範例: calculator_test.go

package main

import (
    "testing"
    "github.com/stretchr/testify/assert"
)

func TestAddTableDriven(t *testing.T) {
    testCases := []struct {
        name     string // 測試案例名稱
        inputA   int
        inputB   int
        expected int
    }{
        {name: "正數 + 正數", inputA: 2, inputB: 3, expected: 5},
        {name: "正數 + 負數", inputA: 5, inputB: -2, expected: 3},
        {name: "負數 + 負數", inputA: -2, inputB: -3, expected: -5},
        {name: "與零相加", inputA: 10, inputB: 0, expected: 10},
        // 讓我們故意放一個會失敗的案例
        {name: "一個會失敗的案例", inputA: 1, inputB: 1, expected: 3},
    }

    for _, tc := range testCases {
        // 4. 使用 t.Run 建立子測試
        t.Run(tc.name, func(t *testing.T) {
            // 執行我們的函式
            result := Add(tc.inputA, tc.inputB)
            // 使用 testify 進行斷言
            assert.Equal(t, tc.expected, result)
        })
    }
}
```

現在，讓我們執行 go test -v，看看輸出結果：

```text
=== RUN   TestAddTableDriven
=== RUN   TestAddTableDriven/正數_+_正數
=== RUN   TestAddTableDriven/正數_+_負數
=== RUN   TestAddTableDriven/負數_+_負數
=== RUN   TestAddTableDriven/與零相加
=== RUN   TestAddTableDriven/一個會失敗的案例
    calculator_test.go:28:
                Error Trace:    calculator_test.go:28
                Error:          Not equal:
                                expected: 3
                                actual  : 2
                Test:           TestAddTableDriven/一個會失敗的案例
--- FAIL: TestAddTableDriven (0.00s)
    --- PASS: TestAddTableDriven/正數_+_正數 (0.00s)
    --- PASS: TestAddTableDriven/正數_+_負數 (0.00s)
    --- PASS: TestAddTableDriven/負數_+_負數 (0.00s)
    --- PASS: TestAddTableDriven/與零相加 (0.00s)
    --- FAIL: TestAddTableDriven/一個會失敗的案例 (0.00s)
FAIL
exit status 1
FAIL    day6    0.495s
```

這個輸出結果非常完美！它清楚地告訴我們： 有四個子測試通過了，名為「一個會失敗的案例」的子測試失敗了，失敗的原因是預期得到 3，但實際得到 2。
我們甚至可以只執行這一個失敗的子測試來進行除錯： `go test -v -run TestAddTableDriven/` 一個會失敗的案例

## 今日總結

今天我們掌握了 Go 測試中一個極其強大的模式：表格驅動測試，學會了如何透過「定義案例 struct -> 填充表格 -> 迴圈 -> t.Run」這四個步驟，來建立結構清晰、易於擴充的測試。

表格驅動測試的優點：

- 清晰：所有測試情境集中管理，一目了然。
- 可擴充：新增測試案例只需在表格中增加一行，無需修改測試邏輯。
- DRY：測試的核心邏輯只寫一次。
- 精準：透過 t.Run，可以快速定位到失敗的具體案例。

這是 Go TDD 實戰中的必備技能，在後續的專案中我們將會大量使用它。
預告：Day 7 - 處理依賴 - 測試中的 Mock 與 Stub 基礎
我們的 Add 函式是一個純函式，沒有任何外部依賴。但真實世界的程式碼很少這麼單純。如果我們的函式需要 讀取資料庫、呼叫外部 API 或讀寫檔案，該如何測試呢？
明天，我們將深入探討這個 TDD 中的核心難題，並學習使用測試替身 (Test Doubles) 中的 `Mock` 和 `Stub` 來解決它。