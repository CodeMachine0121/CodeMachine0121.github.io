---
title: "Day 11 Kata 演練：TDD 如何優雅地完成 FizzBuzz"
datetime: "2025-08-14"
description:  "這篇文章延續前面的 FizzBuzz 練習，展示了如何透過多個完整的 TDD 循環，逐步實現所有 FizzBuzz 邏輯"
parent: "2025 ithome-鐵人賽: 從 0 到 1：與 AI 協作的 Golang TDD 實戰 系列"
image: "/images/titles/golang-cowboy.png"
---

## 昨日回顧與今日目標

在 Day 10，我們漂亮地完成了第一個 TDD 循環，讓我們的 Generate 函式能夠正確處理普通數字，我們擁有了一個通過的測試，這既是我們的成果，也是我們接下來擴充功能的「安全網」。

> 今天的目標：透過連續的「紅-綠-重構」循環，依次實現 "Fizz", "Buzz", 和 "FizzBuzz" 的邏輯。

我們將會看到，TDD 不僅僅是寫測試，它更是一種思考和設計的節奏。

## 循環二：引入 "Fizz"

### 紅燈：定義 "Fizz" 的需求

我們從一個新需求開始：「當數字是 3 的倍數時，應回傳 "Fizz"」。
我們將這個需求轉化為一個新的測試案例，加入到 `fizzbuzz/fizzbuzz_test.go` 的表格中。

```golang
// ... testCases ...
        {name: "should return '2' for number 2", input: 2, expected: "2"},
        {name: "should return 'Fizz' for number 3", input: 3, expected: "Fizz"},
// ...
```

執行 `go test -v ./...`，我們毫不意外地看到了紅燈: `Error: Not equal: expected: "Fizz" actual: "3"`

舊測試通過，新測試失敗。目標明確！

### 綠燈：讓 "Fizz" 測試通過

最簡單的實作方式就是增加一個 `if` 判斷，修改 `fizzbuzz/fizzbuzz.go`：

```golang
package fizzbuzz

import "strconv"

func Generate(number int) string {
	if number%3 == 0 { // 如果是 3 的倍數
		return "Fizz"
	}
	return strconv.Itoa(number)
}
```

再次執行 `go test -v ./...`，所有測試全部通過！綠燈亮起，我們成功地在不破壞舊功能的前提下，增加了新功能。

### 重構：審視程式碼

程式碼 `if number%3 == 0 ...` 結構清晰，沒有重複，結論：**無需重構**。

## 循環三：引入 "Buzz"

### 紅燈：定義 "Buzz" 的需求

下一個需求：「當數字是 5 的倍數時，應回傳 "Buzz"」，同樣地，在測試表格中新增案例，為了覆蓋更全面，我們把數字 4 的測試也加上。

```golang
// ... testCases ...
        {name: "should return 'Fizz' for number 3", input: 3, expected: "Fizz"},
        // 新增案例
        {name: "should return '4' for number 4", input: 4, expected: "4"},
        {name: "should return 'Buzz' for number 5", input: 5, expected: "Buzz"},
// ...
```

執行測試，紅燈再次亮起: `Error: Not equal: expected: "Buzz" actual: "5"`

### 綠燈：讓 "Buzz" 測試通過

最簡單的實現方式是什麼？再加一個 `if` 判斷。

```golang
package fizzbuzz

import "strconv"

func Generate(number int) string {
    if number%3 == 0 {
        return "Fizz"
    }
    if number%5 == 0 { // 新增的判斷
        return "Buzz"
    }
    return strconv.Itoa(number)
}
```

執行測試，一片綠燈！我們又一次成功了。

### 重構：審視程式碼

目前的程式碼結構依然清晰，雖然有兩個 if 語句，但它們處理的是不同的條件分支，沒有明顯的壞味道，結論：**無需重構**。

## 循環四：引入 "FizzBuzz" - 複雜性出現

### 紅燈：定義 "FizzBuzz" 的需求

現在到了最有趣的部分：「當數字同時是 3 和 5 的倍數時，應回傳 "FizzBuzz"」，最直接的例子就是數字 15。

我們在測試表格中新增這個案例，為了讓邏輯鏈更完整，我們也把數字 6 (Fizz) 和 10 (Buzz) 的案例加上。

```golang
// ... testCases ...
        {name: "should return 'Buzz' for number 5", input: 5, expected: "Buzz"},
        // 新增案例
        {name: "should return 'Fizz' for number 6", input: 6, expected: "Fizz"},
        {name: "should return 'Buzz' for number 10", input: 10, expected: "Buzz"},
        {name: "should return 'FizzBuzz' for number 15", input: 15, expected: "FizzBuzz"},
// ...
```

執行測試，紅燈亮起！但這次的失敗報告和之前有些不同： `Error: Not equal: expected: "FizzBuzz" actual: "Fizz"`

為什麼？ 因為當輸入為 15 時，我們的程式碼走到了第一個 `if number%3 == 0`，判斷為真，直接 `return "Fizz"`，根本沒有機會去檢查 5 的倍數，測試精準地暴露了我們現有邏輯的缺陷！

### 綠燈：最簡單的修正

為了同時滿足 3 和 5 的倍數，最簡單的方式是優先處理這個最特殊的條件，我們需要將 number % 15 == 0 的判斷放在最前面。

```golang
package fizzbuzz

import "strconv"

func Generate(number int) string {
    // 優先處理最特殊的條件
    if number%15 == 0 {
        return "FizzBuzz"
    }
    if number%3 == 0 {
        return "Fizz"  
    }
    if number%5 == 0 {
        return "Buzz"  
    }
    return strconv.Itoa(number)
}
```

執行測試，所有測試全部通過！綠燈！ 我們成功地處理了逐漸增加的複雜性。

### 重構：清理「壞味道」

現在，我們終於有東西可以重構了！審視一下程式碼： `if number%15 == 0 ...`

這裡的數字 15 是一個 **「魔法數字」(Magic Number)**。它是由 3 * 5 得來的，但程式碼本身並沒有體現出這個關係。如果未來需求變成「7的倍數說 'Jazz'」，那麼 3*5*7 的計算會讓程式碼越來越難懂。
一個更好的方式是通過邏輯判斷，而不是一個新的魔法數字，讓我們重構程式碼，使其意圖更清晰。

```golang
// 重構後的 fizzbuzz/fizzbuzz.go
package fizzbuzz

import "strconv"

func Generate(number int) string {
    isMultipleOf3 := (number % 3 == 0)
    isMultipleOf5 := (number % 5 == 0)

    if isMultipleOf3 && isMultipleOf5 {
        return "FizzBuzz"
    }
    if isMultipleOf3 {
        return "Fizz"
    }
    if isMultipleOf5 {
        return "Buzz"
    }

    return strconv.Itoa(number)
}
```

我們引入了兩個布林變數，讓程式碼讀起來更像是自然語言。現在，我們再次執行 `go test -v ./...`，確保測試依然是綠燈，這就是重構的信心來源！ （進階重構思考：我們甚至可以透過字串拼接的方式來完全移除巢狀的 if-else，但目前的版本已經足夠清晰，我們在此打住。）

## 今日總結

今天我們行雲流水地打完了一整套 FizzBuzz Kata，我們經歷了多次「紅-綠-重構」的循環，每一次循環都只專注於一個微小的目標，這個過程向我們證明了：

- TDD 是處理複雜性的利器：它將大問題分解為一系列小而可控的步驟。
- 測試是重構的基石：有了全面的測試覆蓋，我們可以無所畏懼地改善程式碼的設計。
- TDD 的節奏感：一旦熟悉，這種開發節奏會帶來極大的心流體驗和安全感。

我們不僅僅是「完成」了 FizzBuzz，更是用一種優雅、安全、可驗證的方式「演進」出了最終的解決方案。

預告：Day 12 - 進階 Kata 挑戰 - 字串計算機 (String Calculator)
FizzBuzz 的練習讓我們熟悉了 TDD 的基本節奏，為了應對更真實的挑戰，明天將介紹一個更能體現 TDD 價值的經典 Kata——「字串計算機」。它的需求會從一個空字串開始，層層遞進，蠻適合用來磨練TDD 技巧。