---
title: "Day 14 - 字串計算機實戰 (二)：處理兩個及多個數字"
datetime: "2025-08-17"
description:  "這篇文章讓字串計算機真正開始「計算」，處理多個數字的相加"
parent: "2025 ithome-鐵人賽: 從 0 到 1：與 AI 協作的 Golang TDD 實戰 系列"
image: "/images/titles/golang-drawing.png"
---

## 昨日回顧與今日目標

在 Day 13，我們為字串計算機打下了堅實的基礎，成功地透過兩個快速的 TDD 循環處理了「空字串」和「單一數字」的情況，我們甚至還體驗了一次 TDD 如何防止我們進行不正確的重構。

到目前為止，我們的計算機還名不副實——它從未進行過任何「計算」，今天，我們將讓 Add 函式學會處理多個數字。

今天的目標：透過 TDD 循環，讓我們的計算機學會處理：

- 用逗號分隔的兩個數字。
- 用逗號分隔的任意多個數字。

## 循環三：處理兩個數字

### 紅燈："1,2" 應回傳 3

我們的下一個需求是：「對於兩個用逗號分隔的數字，它將回傳它們的和」，我們再次回到 stringcalc/stringcalc_test.go，在測試表格中加入這個新的案例：

```golang
// in stringcalc_test.go, within testCases
{
    name:     "should return the number itself for a single number",
    input:    "1",
    expected: 1,
},
// 新增案例
{
    name:     "should return the sum of two comma-separated numbers",
    input:    "1,2",
    expected: 3,
},
```

執行測試 (go test -v ./...)，毫不意外，紅燈亮起: `panic: strconv.Atoi: parsing "1,2": invalid syntax`

這次的失敗報告和之前不同。它不是一個 assert 錯誤，而是一個 panic（恐慌），這是因為我們現有的程式碼 strconv.Atoi("1,2") 無法將包含逗號的字串轉換為整數，於是拋出了異常。這個 panic 精準地告訴我們，現有邏輯無法處理新需求。

### 綠燈：最簡單的實現

為了處理 "1,2"，我們需要做兩件事：

- 用逗號分割字串，得到一個字串的 slice：`["1", "2"]`。
- 遍歷這個 slice，將每個字串轉換為整數，並把它們加起來。

Go 的標準函式庫 `strings` 提供了 `Split` 函式，正好能完成第一步，讓我們來修改 stringcalc/stringcalc.go：

```golang
package stringcalc

import (
    "strconv"
    "strings" // 導入 strings
)

func Add(numbers string) (int, error) {
    if numbers == "" {
        return 0, nil
    }

    // 使用 strings.Split 處理逗號
    parts := strings.Split(numbers, ",")

    if len(parts) == 1 {
        return strconv.Atoi(parts[0])
    }

    // 處理兩個數字的情況
    num1, _ := strconv.Atoi(parts[0])
    num2, _ := strconv.Atoi(parts[1])

    return num1 + num2, nil
}
```

### 分析

這個實作非常「直接」，甚至有點「笨拙」，我們明確地處理了 `len(parts) == 1` 的情況，然後寫死了處理 `parts[0]` 和 `parts[1]` 的邏輯，我們暫時忽略了 `Atoi` 可能回傳的 error，因為我們的測試案例都是合法的。

這完全符合 TDD 的「綠燈」階段精神：用最簡單、甚至有些討巧的方式讓測試通過。

### 重構：從「寫死」到「通用」

我們的產品程式碼現在可以工作了，但它存在明顯的壞味道：**它只能處理一個或兩個數字**，無法處理三個或更多，`num1, _ := ...`， `num2, _ := ...` 這樣的程式碼重複性很高。

在測試的保護下，我們可以自信地將其重構為一個更通用的、基於迴圈的解決方案，重構後的 stringcalc/stringcalc.go

```golang
package stringcalc

import (
    "strconv"
    "strings"
)

func Add(numbers string) (int, error) {
    if numbers == "" {
        return 0, nil
    }

    parts := strings.Split(numbers, ",")
    sum := 0
    // 使用迴圈來處理任意數量的數字
    for _, part := range parts {
        num, err := strconv.Atoi(part)
        if err != nil {
            // 暫時忽略錯誤處理
            return 0, err
        }
        sum += num
    }

    return sum, nil
}
```

這個版本優雅多了！它不再關心到底有幾個數字，不管是 1 個、2 個還是 10 個，這個迴圈都能正確處理。 執行測試，綠燈依然亮著！ 我們的重構是成功的。

## 循環四：處理任意數量的數字

我們的重構實際上已經「預見」並「實現」了這個需求，但我們應該用一個明確的測試案例來「鎖定」這個功能。

### 紅燈 (理論上)："1,2,3,4,5" 應回傳 15

在測試表格中增加這個更複雜的案例：

```golang
// in stringcalc_test.go, within testCases
{
    name:     "should return the sum of two comma-separated numbers",
    input:    "1,2",
    expected: 3,
},
// 新增案例
{
    name:     "should return the sum of multiple comma-separated numbers",
    input:    "1,2,3,4,5",
    expected: 15,
}
```

執行測試，你會發現一個有趣的情況：測試直接就通過了！
這是一個 **「快樂的意外」**，這意味著我們在上一個循環的重構階段，選擇了一個足夠通用的設計，它不僅滿足了當時的需求，還順便滿足了下一個需求。
在 TDD 中，這是一個非常積極的信號，證明我們的設計走在正確的軌道上，即便如此，這個新的測試案例依然是極其重要的。它將「處理多個數字」這個功能，從一個「意外的副作用」變成了一個「被明確定義和保護的需求」。從此以後，任何破壞這個功能的修改，都會被這個測試案例捕捉到。

## 循環五：支援換行符 (\n)

### 紅燈："1\n2,3" 應回傳 6

新需求： 允許使用換行符 `\n` 和逗號 , 作為分隔符，我們在 stringcalc_test.go 中加入新的測試案例。

```golang
// in testCases
// 新增案例
{
    name:     "should handle new lines between numbers",
    input:    "1\n2,3",
    expected: 6,
},
```

執行測試 (go test -v ./...)，紅燈亮起，現有的 `strings.Split(numbers, ",")` 無法處理 `\n`。

### 綠燈 & 重構：一個更通用的分隔器

我們不能再只用逗號來分割了。一個簡單的想法是，先把所有的 `\n` 都替換成 `,`，然後再用老辦法 Split。

```golang
package stringcalc

import (
    "strconv"
    "strings"
)

func Add(numbers string) (int, error) {
    if numbers == "" {
        return 0, nil
    }

    // 先將換行符替換為逗號
    processedString := strings.ReplaceAll(numbers, "\n", ",")
    parts := strings.Split(processedString, ",")

    sum := 0
    for _, part := range parts {
        num, err := strconv.Atoi(part)
        if err != nil {
            return 0, err
        }
        sum += num
    }

    return sum, nil
}
```

執行測試，綠燈！這個小小的重構（引入 processedString）非常有效。程式碼意圖清晰，無需進一步重構。

## 循環六：支援自訂分隔符

### 紅燈："//;\n1;2" 應回傳 3

新需求： 支援自訂分隔符。格式為 `//[delimiter]\n[numbers...]`。
這個需求引入了全新的格式。我們新增測試案例：

```golang
{
    name:     "should support a custom delimiter",
    input:    "//;\n1;2",
    expected: 3,
},
```


執行測試，紅燈亮起！我們的程式碼會把 `//;` 當成數字，導致 Atoi 失敗。

### 綠燈 & 重構：解析與分離

我們需要先檢查字串是否以 `//` 開頭，如果是，我們就解析出新的分隔符和真正的數字部分；如果不是，就還用老方法。

```golang
// in stringcalc.go
func Add(numbers string) (int, error) {
    if numbers == "" {
        return 0, nil
    }

    delimiter := ","
    numbersPart := numbers

    // 檢查是否有自訂分隔符
    if strings.HasPrefix(numbers, "//") {
        parts := strings.SplitN(numbers, "\n", 2)
        delimiter = strings.TrimPrefix(parts[0], "//")
        numbersPart = parts[1]
    }

    processedString := strings.ReplaceAll(numbersPart, "\n", delimiter)
    parts := strings.Split(processedString, delimiter)

    sum := 0
    for _, part := range parts {
        // ... (summation logic remains the same)
        num, _ := strconv.Atoi(part)
        sum += num
    }
    return sum, nil
    }
```

這段程式碼很巧妙地分離了「配置解析」和「數字計算」兩個關注點。執行測試，綠燈！程式碼的職責劃分已經很清晰了，無需進一步重構。

## 循環七：處理負數

### 紅燈：傳入負數應拋出錯誤

新需求： 不允許傳入負數，如果傳入了，函式應回傳一個包含所有負數的錯誤訊息。

這次我們需要測試錯誤，這是一個很好的機會來寫一個獨立的測試函式，專門用來驗證錯誤情境。

```golang
// in stringcalc_test.go

func TestStringCalculator_Add_WithNegatives(t *testing.T) {
    input := "1,-2,3,-4"

    // 呼叫函式
    _, err := Add(input)

    // 斷言：我們期望一個錯誤
    require.Error(t, err, "an error should be returned for negative numbers")
    // 斷言：錯誤訊息應該包含所有負數
    assert.EqualError(t, err, "negatives not allowed: -2, -4")
}
```

執行測試，紅燈亮起，我們現有的程式碼會正常回傳 `-2`，err 是 `nil`，`require.Error` 會失敗。

### 綠燈 & 重構：收集與報告

我們需要在加總的迴圈中，檢查數字是否為負。如果發現負數，我們應該把它們收集起來，而不是直接加總。

```golang
// in stringcalc.go

func Add(numbers string) (int, error) {
    // ... (delimiter parsing logic remains the same)

    processedString := strings.ReplaceAll(numbersPart, "\n", delimiter)
    parts := strings.Split(processedString, delimiter)

    sum := 0
    var negatives []string // 用來收集負數

    for _, part := range parts {
        num, _ := strconv.Atoi(part)
        
        if num < 0 {
            negatives = append(negatives, strconv.Itoa(num))
            continue // 發現負數，加入列表，繼續下一個
        }
        sum += num
    }

    // 如果有負數，格式化錯誤並回傳
    if len(negatives) > 0 {
        return 0, fmt.Errorf("negatives not allowed: %s", strings.Join(negatives, ", "))
    }

    return sum, nil
}
```

執行測試，所有測試，包括新的錯誤測試，全部通過！一片綠燈！
我們的程式碼現在既健壯又優雅。它清晰地分離了職責：解析輸入、遍歷處理、報告錯誤。這就是 TDD 引導我們達到的良好設計。

## 今日總結

今天我們經歷了一場需求的「閃電戰」，並在 TDD 的引導下取得了全面的勝利。我們不僅完成了字串計算機的所有核心需求，更重要的是，我們見證了一個簡單的函式是如何演進成一個健壯、設計良好的微型解析器。

- 我們處理了 TDD 過程中常見的 `panic` 失敗。
- 我們經歷了一次經典的重構：從一個寫死的、具體的實現，演進到一個通用的、基於迴圈的優雅實現。
- 我們還體驗了「快樂的意外」，即一次好的重構能夠預先滿足未來的需求，並學會了用新的測試案例來鎖定和保護這些新功能。
- 錯誤也是一等公民： TDD 不僅僅是測試正確的路徑，測試錯誤路徑同等重要，它能確保我們的程式碼在異常情況下依然表現得體。
  
我們的 TDD 手動實踐部分到此告一段落。你已經具備了利用 TDD 開發健壯軟體的堅實基礎。

預告：第三階段正式開啟！Day 15 - TDD 實戰回顧 - 我們從 Kata 中學到了什麼？
