---
title: "Day 4 - Golang 的測試利器：go test 指令與 _test.go 檔案"
datetime: "2025-08-07"
description: "在 Day 4，我們將深入 Golang 的測試框架，學習如何撰寫測試檔案 `_test.go`，並使用 `go test` 指令來執行和管理測試。掌握這些基礎後，我們就能開始實踐 TDD 循環了！"
image: "https://github.com/CodeMachine0121/gophers-images/blob/master/sketch/science/welding.png?raw=true"
parent: "2025 ithome-鐵人賽: 從 0 到 1：與 AI 協作的 Golang TDD 實戰 系列"
---


## 昨日回顧與今日目標

在 Day 3，我們從「可測試性」的角度，掌握了 Go 語言的三大核心語法：函式、結構體與介面，我們理解到，良好的程式碼設計是 TDD 的基礎，而介面是實現測試隔離的關鍵。

今天，我們將再深入 Go 語言內建測試框架的神秘面紗。

Go 的一大魅力在於，測試是其語言生態中的「一等公民」，你不需要安裝任何第三方測試執行器 (Test Runner)，所有需要的工具都已內建，今天的目標是掌握 Go 測試的兩大基石：

- `_test.go` 檔案的結構： 學習測試程式碼的撰寫規範。
- `go test` 指令： 學習如何使用這個強大的命令列工具來執行和管理我們的測試。

掌握了它們，我們就等於拿到了進入 TDD 世界的鑰匙。

## 測試檔案的解剖：_test.go 的結構

在 Golang 的世界裡，一切都始於規定。測試的第一個規定，就是檔案的命名。

### 規定1： 測試程式碼必須放在與被測程式碼相同的套件 (package) 下，且檔案名稱必須以 _test.go 結尾。

例如，我們的 production code 在 calculator.go 中，那麼它的測試 code 就應該寫在 calculator_test.go 裡。這個命名規則讓 go 工具能夠自動識別哪些是測試檔案。

一個最基本的測試檔案包含三個核心元素：

```golang
// 1. 與被測程式碼相同的 package 聲明
package main

// 2. 導入 testing 套件
import (
    "testing"
)

// 3. 一個或多個以 Test 為前綴的測試函式
func TestMyFunction(t *testing.T) {
    // 測試 3A 寫這邊
}
```

- 函式簽名解析：func TestXxx(t *testing.T)

### 規定2： 測試函式必須以 Test 開頭，後面跟著一個以大寫字母開頭的描述性名稱 (Xxx)，並且必須接收一個 *testing.T 型別的參數。

- Test 前綴是強制性的，go test 只會執行符合此規則的函式。

- Xxx 部分應該清楚地描述你正在測試的函式或情境，例如 `TestAddPositiveNumbers` 或 `TestLoginWithInvalidPassword`。

- `t *testing.T` 這個參數是我們的「測試控制台」，它是 testing 套件提供給我們的工具箱，接下來我們會詳細介紹它。

### 測試工具：t *testing.T

`t` 這個參數，可以想像成是測試裁判手上的計分板和紅牌。我們透過呼叫它的各種方法，來向 Go 的測試框架報告測試結果，以下是幾個最常用的方法：

- `t.Logf(format string, args ...any)`: 用來記錄log。這些訊息在測試通過時預設不顯示，但在測試失敗時會被印出。這比用 fmt.Println() 好得多，因為它不會干擾正常的測試輸出。
- `t.Errorf(format string, args ...any)`: 報告一個錯誤。這是最常用的方法。它會記錄錯誤訊息，然後將該測試標記為「失敗」，但測試函式會繼續執行完畢。
- `t.Fatalf(format string, args ...any)`: 報告一個致命錯誤。它和 Errorf 類似，但它不只會記錄錯誤訊息，將測試標記為「失敗」，然後還會立即中止當前測試函式的執行。 **當後續的測試步驟依賴於某個前置條件時**，這個方法非常有用。
- `t.Fail()`: 將測試標記為失敗，但不記錄任何訊息，繼續執行。
- `t.FailNow()`: 將測試標記為失敗，立即中止執行。(Errorf 和 Fatalf 是更常用的帶訊息版本)。

#### Errorf vs Fatalf 的選擇：

- 如果一個斷言失敗後，後續的檢查還有意義，就用 `Errorf`。
- 如果一個斷言失敗需要讓後續的程式碼無法執行，就用 `Fatalf`。

## TDD 的瑞士軍刀：go test 指令

go test 是我們在 TDD 循環中會以極高頻率使用的指令。它不僅僅是執行測試，還附帶了許多實用的 flags。

讓我們可以在專案資料夾中動手試試看。

### 第一步：建立 Production Code calculator.go

```golang
// calculator.go
package main

func Add(a, b int) int {
    return a + b
}
```

### 第二步：建立 Test Code calculator_test.go

```golang
// calculator_test.go
package main

import "testing"

func TestAdd(t *testing.T) {
    result := Add(2, 3)
    expected := 5

    if result != expected {
        // 使用 Errorf 報告錯誤
        t.Errorf("Add(2, 3) = %d; want %d", result, expected)
    }
}
```

現在，打開 terminal，執行 go test：

#### go test (基本執行)

``` bash
go test
```

- 輸出：

```text
PASS
ok      day4  0.421s
```

非常簡潔。它只告訴我們結果是通過 (PASS) 還是失敗 (FAIL)。

#### go test -v (詳細模式 Verbose)

這個參數是我們的好朋友，它會顯示每個測試函式的執行情況和 t.Log 的輸出。

```bash
go test -v
```

- 輸出:

```text
=== RUN   TestAdd
--- PASS: TestAdd (0.00s)
PASS
ok      go-tdd-journey  0.421s
```

它清楚地告訴我們 TestAdd 被執行了。

#### go test -run <正則表達式> (聚焦執行)

當專案變大，測試變多時，我們只想執行正在開發的那一個測試。-run 可以讓我們根據函式名稱的模式來篩選。

```bash
# 只執行名字包含 "Add" 的測試
go test -v -run Add
```

這在 TDD 的「紅燈」階段尤其有用，可以讓我們專注於當前失敗的測試。

#### go test -cover (測試覆蓋率)

這個會計算並顯示你的測試覆蓋了多少比例的 production code。

```bash
go test -cover
```

- 輸出：

```text
PASS
coverage: 100.0% of statements
ok     day4  0.421s
```

覆蓋率( Test Coverage) 是一個有用的健康指標，但切記：100% 的覆蓋率不等於 100% 沒有 bug，它只代表程式碼被執行過，不代表所有情境都被正確地測試了。

## 今日總結

今天我們解鎖了 Golang 測試的核心能力

- 知道了如何遵循 `_test.go` 和 `TestXxx` 的命名規定來組織測試
- 學會了使用 `*testing.T` 的 `Errorf` 和 `Fatalf` 來報告測試結果
- 並掌握了 `go test` 指令最重要的幾個 flags (-v, -run, -cover)。

現在已經具備了golang的基本知識，可以開始親手編寫並執行一個完整的 TDD 循環了。

預告：Day 5 - 寫出優雅的斷言 - testing 套件與 stretchr/testify
雖然 `if result != expected { t.Errorf(...) }` 這種寫法完全可行，但當 Assert 邏輯變多時，它會顯得有些重複和冗長。
明天，我們將引入一個極受 歡迎的第三方套件 `stretchr/testify`，學習如何用 `assert.Equal(t, expected, result)` 這樣更優雅、更具可讀性的方式來寫我們的 Assert。