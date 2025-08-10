---
title: "Day 5 - 寫出優雅的 Assertion:  使用 testing 套件與  stretchr/testify"
datetime: "2025-08-08"
description: "在 Day 4，我們將深入 Golang 的測試框架，學習如何撰寫測試檔案 `_test.go`，並使用 `go test` 指令來執行和管理測試。掌握這些基礎後，我們就能開始實踐 TDD 循環了！"
image: "https://github.com/CodeMachine0121/gophers-images/blob/master/sketch/fairy-tale/witch-too-much-candy.png?raw=true"
parent: "2025 ithome-鐵人賽: 從 0 到 1：與 AI 協作的 Golang TDD 實戰 系列"
---

## 昨日回顧與今日目標

在 Day 4，我們掌握了 Go 內建的測試工具，學會了 _test.go 的檔案結構和 go test 指令的實用flag，我們現在已經可以完整地執行測試了。

回顧一下我們昨天的測試程式碼：

```golang
func TestAdd(t *testing.T) {
    result := Add(2, 3)
    expected := 5

    if result != expected {
        t.Errorf("Add(2, 3) = %d; want %d", result, expected)
    }
}
```

這段程式碼完全沒有問題，它清晰且有效。但想像一下，如果一個函式需要驗證五、六個不同的結果呢？我們很快就會被一堆 `if... t.Errorf(...)` 的程式碼所淹沒，這會降低測試的可讀性。

> 今天的目標: 學習使用 stretchr/testify 套件，將我們的 Assert 從「命令式」升級為「宣告式」，讓測試程式碼更優雅、更易讀。

## 為什麼需要更好的 Assertion？

我們希望測試程式碼讀起來就像在讀一篇規格說明文件。

原本的寫法，讀起來像：
>「如果 result 不等於 expected，那麼就標記一個格式為『...』的錯誤。」

我們期望的寫法，讀起來像：
>「我在此 assert expected 等同於 result。」

第二種方式更直接，更貼近人類的思考方式，這就是 testify 帶給我們的價值。

## 步驟一：安裝 stretchr/testify

testify 是一個第三方套件，它提供了一整套豐富的 assert 工具。由於我們在 Day 2 建立專案時已經使用了 Go Modules，現在安裝它只需要一行指令。
使用 terminal 在專案資料夾中，執行：

```bash
go get github.com/stretchr/testify
```

Go Modules 會自動下載套件，並將其版本資訊記錄在 go.mod 和 go.sum 檔案中。

## 步驟二：初識 testify/assert

assert 是 testify 提供的眾多工具之一，它的行為類似於我們之前使用的 t.Errorf —— 當 assert 失敗時，它會將測試標記為失敗，但會繼續執行後續的程式碼。

### 用 assert 來重寫昨天的 TestAdd

```golang
// calculator_test.go
package main

import (
    "testing"
    "github.com/stretchr/testify/assert" // 導入 assert 套件
)

func TestAddWithAssert(t *testing.T) {
    result := Add(2, 3)
    expected := 5

    // 使用 assert.Equal 進行 assert
    assert.Equal(t, expected, result, "2 + 3 應該等於 5")
}
```

### 程式碼對比與分析

| 比較項目 | 原生寫法 | testify/assert 寫法 |
|---------|---------|-------------------|
| 語法 | `if result != expected { ... }` | `assert.Equal(t, expected, result)` |
| 參數順序 | 容易寫反 result 和 expected 的順序 | 參數順序固定 (t, expected, actual)，不易出錯 |
| 錯誤訊息 | 錯誤訊息需要手動 fmt.Sprintf 風格的格式化 | 錯誤訊息更友好，自動提示「Expected」和「Actual」 |
| 程式碼簡潔性 | 程式碼更多，意圖被 if 語句包裹 | 程式碼更少，assert.Equal 直接表達「assert 相等」的意圖 |

`assert.Equal` 的最後一個參數是可選的，可以用來提供額外的上下文說明訊息，這在除錯時非常有用。

### assert 的常用工具

testify 提供了非常豐富的assert函式，幾乎涵蓋了所有你能想到的情境：

| assert 函式 | 功能描述 |
|---------|---------|
| `assert.NotEqual(t, unexpected, actual)` | assert 不相等 |
| `assert.Nil(t, object)` / `assert.NotNil(t, object)` | assert 為 nil / 不為 nil |
| `assert.True(t, value)` / `assert.False(t, value)` | assert 為 true / false |
| `assert.Len(t, object, length)` | assert 集合（如 slice, map）的長度 |
| `assert.Contains(t, "Hello World", "Hello")` | assert 字串/集合包含某個子項 |
| `assert.NoError(t, err)` / `assert.Error(t, err)` | assert 錯誤為 nil / 不為 nil (這在測試錯誤處理時極其重要！) |


## 步驟三：認識 testify/require - 失敗就停止

testify 還提供了另一個幾乎與 assert 完全一樣的套件：require。它們的函式名稱、參數都一模一樣，但有一個關鍵的行為區別：

| 套件 | 失敗後的行為 |
|------|-------------|
| `assert` | assert 失敗後，繼續執行當前的測試函式 |
| `require` | assert 失敗後，立即停止執行當前的測試函式（行為類似 t.Fatalf） |

那麼，我們該用哪一個呢？ 這取決於你的測試情境。

> 經驗法則： 當一個 assert 是後續所有 assert的先決條件時，使用 require，反之，使用 assert。

### 範例

假設我們在測試一個「建立使用者並回傳資料」的函式。

```golang
func TestCreateUser(t *testing.T) {
    // 導入 require 套件
    // import "github.com/stretchr/testify/require"

    // 步驟一：建立使用者，這個過程不應該出錯
    user, err := CreateUser("John Doe")
    
    // 前置條件的檢查：如果建立使用者就失敗了，後續的檢查都沒意義了
    // 所以這裡用 require！
    require.NoError(t, err)
    require.NotNil(t, user)

    // 步驟二：檢查回傳使用者的各個屬性
    // 這裡用 assert，因為檢查 name 和檢查 email 是獨立的
    // 即使 name 不對，我們也想知道 email 是否正確
    assert.Equal(t, "John Doe", user.Name)
    assert.Equal(t, "active", user.Status)
    assert.True(t, user.CreatedAt.Before(time.Now()))
}
```

在這個例子中，如果 `CreateUser` 就直接返回了 `error` 或 `nil` 的 `user`，後續的 `assert.Equal(t, "John Doe", user.Name)` 會立刻引發一個 `nil pointer panic`，測試會以一種混亂的方式崩潰，使用 `require` 可以讓測試在第一個前置條件不滿足時就乾淨地停止，並給出清晰的錯誤報告。

## 今日總結

今天我們為我們的 TDD 工具箱增加了一件強大的工具： `testify`。

- 學會了使用 `testify/assert` 來撰寫更具可讀性、更宣告式的 assertion。
- 理解了 assert (繼續執行) 和 require (停止執行) 的關鍵區別。
- 掌握了一個重要的經驗法則：用 require 守護前置條件，用 assert 驗證最終結果。

這項技能將極大地提升我們測試程式碼的品質和維護性。
預告：Day 6 - 表格驅動測試 (Table-Driven Tests) - Go 語言的測試慣用法
我們已經學會了如何優雅地測試「一個」情境。但如果我們要測試 `Add(2, 3)`、`Add(-1, 1)`、`Add(0, 0)` 等多個情境呢？是寫好幾個測試函式嗎？明天，我們將使用 Golang中一種模式——「表格驅動測試」，它能讓我們用少量程式碼，優雅地覆蓋多個的測試案例。