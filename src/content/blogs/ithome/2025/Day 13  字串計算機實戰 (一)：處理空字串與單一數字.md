---
title: "Day 13 - 字串計算機實戰 (一)：處理空字串與單一數字"
datetime: "2025-08-16"
description:  "這篇文章實作字串計算機的前兩個基本功能，展現了紮實的 TDD 基礎"
parent: "2025 ithome-鐵人賽: 從 0 到 1：與 AI 協作的 Golang TDD 實戰 系列"
image: "/images/titles/golang-biker.png"
---

## 昨日回顧與今日目標

在 Day 12，我們認識了新的挑戰——字串計算機 Kata，並為它搭建好了獨立的 stringcalc 套件，最重要的是，我們已經用 TDD 的思維，從一堆需求中識別出了第一個、也是最簡單的攻擊目標： **「當輸入為空字串時，Add 函式應回傳 0。」**

今天，我們將正式動手，將這個目標轉化為程式碼，並快速推進，完成 Kata 的前兩個基本需求。

> 今天的目標：透過兩個快速的 TDD 循環，依次實現：處理空字串 及 處理單一數字。

## 循環一：處理空字串

### 紅燈：空字串應回傳 0

我們將遵循 Day 6 學到的「表格驅動測試」模式，打開 stringcalc/stringcalc_test.go，用以下程式碼替換其內容：

```golang
// stringcalc/stringcalc_test.go
package stringcalc

import (
    "testing"
    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/require"
)

func TestStringCalculator_Add(t *testing.T) {
    testCases := []struct {
        name     string
        input    string
        expected int
    }{
        // 我們的第一個測試案例
        {
            name:     "should return 0 for an empty string",
            input:    "",
            expected: 0,
        },
    }

    for _, tc := range testCases {
        t.Run(tc.name, func(t *testing.T) {
            // 呼叫產品程式碼
            result, err := Add(tc.input)

            // 斷言：我們期望沒有錯誤發生
            require.NoError(t, err) 
            // 斷言：結果應該符合預期
            assert.Equal(t, tc.expected, result)
        })
    }
}
```

### 程式碼分析

- 這次我們同時導入了 `assert` 和 `require`。
- 我們使用 `require.NoError(t, err)` 來作為前置條件的斷言。如果 `Add` 函式意外地回傳了錯誤，測試應該立即停止，因為後續的結果斷言就沒有意義了。

現在，修改一下 `stringcalc/stringcalc.go` 中的佔位程式碼，讓它故意回傳一個錯誤的值，以確保我們的測試能正常失敗：

```golang
// stringcalc/stringcalc.go
package stringcalc

func Add(numbers string) (int, error) {
    return -1, nil // 故意回傳一個錯誤的數字
}
```

執行 `go test -v ./...`，我們如期看到了紅燈： `Error: Not equal: expected: 0 actual: -1`

### 綠燈：最簡單的實現

什麼是最簡單的程式碼，能讓 Add("") 回傳 0？
很簡單，就是直接判斷輸入是否為空字串，修改 stringcalc/stringcalc.go：

```golang
package stringcalc

func Add(numbers string) (int, error) {
    if numbers == "" { 
        return 0, nil
    }
    return -1, nil // 保持其他路徑的錯誤值
}
```

再次執行測試，第一個子測試 `should return 0 for an empty string` 成功變綠！

### 重構

程式碼 `if numbers == ""` 結構清晰，意圖明確。無需重構。第一個循環，完成！

## 循環二：處理單一數字

我們的第一個測試案例已經成為了安全網，現在我們來處理下一個需求：「對於一個數字，它將回傳數字本身」。
紅燈："1" 應回傳 1
我們只需在測試表格中增加一個新案例：

```go
// in stringcalc_test.go, within testCases
{
    name: "should return 0 for an empty string",
    input: "",
    expected: 0,
},
// 新增案例
{
    name: "should return the number itself for a single number",
    input: "1",
    expected: 1,
},
```

執行測試，**紅燈**為我們亮起： `Error: Not equal: expected: 1 actual: -1`

舊測試通過，新測試失敗。目標清晰！

### 綠燈：最快的修正

我們需要將字串轉換為整數，這正是 Golang 標準函式庫 `strconv.Atoi` (`ASCII to Integer`) 的用武之地。

修改 `stringcalc/stringcalc.go`：

```golang
package stringcalc

import "strconv" // 導入 strconv

func Add(numbers string) (int, error) {
    if numbers == "" {
        return 0, nil
    }

    // 將字串轉換為整數
    number, err := strconv.Atoi(numbers)
    if err != nil {
        // 如果轉換失敗，這是一個意料之外的錯誤，我們暫時先 panic
        // 後續的 TDD 循環會讓我們來處理這個 error
        panic(err) 
    }
    return number, nil
}
```

> 注意：`strconv.Atoi` 會回傳一個 `error`，在 TDD 的早期，如果我們還沒準備好處理某個錯誤，可以直接 `panic`，因為我們的測試案例不會觸發它。

執行 `go test -v ./...`，所有測試全部通過！ 第二個綠燈亮起。

### 重構：簡化邏輯

讓我們審視一下產品程式碼：

```golang

func Add(numbers string) (int, error) {
    if numbers == "" {
        return 0, nil   
    }
    number, err := strconv.Atoi(numbers)
    // ...
    return number, nil
}
```

這裡的程式碼看起來還不錯，但我們能否發現一個有趣的關聯？

`strconv.Atoi("")` 其實會回傳 `0` 和一個 `error`，這意味著，我們的第一個 `if numbers == ""` 判斷，似乎可以被 `Atoi` 的邏輯所「吸收」。

讓我們來進行一次重構，看看能否簡化程式碼，重構後的 `stringcalc/stringcalc.go`

```golang
package stringcalc

import "strconv"

func Add(numbers string) (int, error) {
    if numbers == "" {
        return 0, nil
    }
    // 對於單一數字的情況，這段邏輯就夠了
    return strconv.Atoi(numbers)
}
```

> 注意：重構後的 Atoi 會自己回傳 (int, error)，正好符合我們的函式簽名。

執行測試，測試依然是綠燈！ 這證明我們的重構是安全的，新的程式碼更簡潔，因為它移除了那個特殊的 if 判斷。

### 思考

為甚麼我們不讓 `if numbers == ""` 的 test case 也一併使用 `strconv.Atoi("")` 來回傳呢? 那是因為雖然回傳 `0`，但它同時也回傳了一個 error。我們的測試 `require.NoError(t, err)` 會因此失敗。

這說明我們的重構是不正確的！這是一個絕佳的例子，說明測試是如何防止我們做出錯誤的簡化。
所以，我們撤銷這次重構，回到之前的版本。TDD 保護了我們！）

### 最終決定

保持綠燈階段的程式碼不變，它已經是當下最清晰的表達。無需重構。

## 今日總結

今天我們以賊快的節奏，連續完成了字串計算機的前兩個需求的 TDD 循環。

- 我們為「空字串」和「單一數字」這兩種情況建立了堅實的測試保護網。
- 我們體驗了 TDD 帶來的快速迭代節奏。
- 我們甚至在重構階段，透過測試的反馈，阻止了一次看似合理但實則錯誤的程式碼簡化，這深刻地體現了 TDD 作為安全網的價值！

預告：Day 14 - 字串計算機實戰 (二) - 處理多個數字與換行符，單一數字已經無法滿足我們了。
明天，我們將開始處理真正的「計算」，讓我們的函式能夠解析用逗號分隔的多個數字（如 "1,2,3"），並將它們加總。需求的複雜性將會第一次跳躍式增長！