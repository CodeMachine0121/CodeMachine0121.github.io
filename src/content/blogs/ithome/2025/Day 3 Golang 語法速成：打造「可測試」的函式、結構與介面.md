---
title: "Day 3 - Golang 語法速成：打造「可測試」的函式、結構與介面"
datetime: "2025-08-06"
description: "在 Day 3，我們將深入 Golang 語法，學習如何設計「可測試」的程式碼。重點包括函式、結構與介面的使用，並透過實際範例來理解它們在 TDD 中的重要性。"
image: "https://www.pinclipart.com/picdir/big/400-4000243_addthis-sharing-buttons-gophers-golang-clipart.png"
parent: "2025 ithome-鐵人賽: 從 0 到 1：與 AI 協作的 Golang TDD 實戰 系列"
---

## 昨日回顧與今日目標

在昨天，我們已經成功 setup  Golang 開發與測試環境，並透過一個簡單的 Hello, Test! 驗證了所有工具都已就緒，我們的開發工具已經備妥。
今天，我們將正式踏入 Go 語言的核心，我們的目標會聚焦在: 學習如何運用 Go 的語法，從一開始就設計出「可測試」(Testable) 的程式碼。在 TDD 的世界裡，程式碼的可測試性，就是它的生命線。

我們將重點掌握三個最關鍵的建構單元：

- 函式 (Functions): 執行的基本單位。
- 結構 (Structs): 組織資料的容器。
- 介面 (Interfaces): 解除依賴的魔法。

## 函式 (Functions)

在 TDD 中，受測試的 code 的最小單位通常就是一個函式。一個「可測試」的函式，往往具有一個非常重要的特質：它是一個純粹的「轉換器」。
可測試函式的理想型態： 給定**明確**的輸入 (Input)，它就能回傳**可預測**的輸出 (Output)，並且過程中沒有產生外部可見的「副作用」(Side Effects)，例如 寫入資料庫 或 修改全域變數。

以下來看一個最簡單的例子，一個 **可測試** 的函式：

```golang
package main

func Add(a, b int) int {
    return a + b
}
```

這個 Add 函式非常容易測試。我們可以明確地給定 a=2, b=3，然後可預期 (Assert) 回傳的結果是否為 5。

以下是一個相對 **不可測試** 的函式：

```golang
package main

import "fmt"

func AddAndPrint(a, b int) {
    result := a + b
    fmt.Printf("The sum is: %d\n", result) // 這是一個副作用！
}
```

為什麼 `AddAndPrint` 是不好測試的函式呢？ 因為它沒有 output！ 我們如何用程式碼來自動驗證它「印出」的內容是否正確，這會變得非常麻煩，所以在 TDD 中，我會傾向於將「計算」和「顯示」這兩個職責分開。

## 結構 (Structs)

當函式需要操作的資料(參數 或是 回傳值)變多時，把它們用一個「結構」包裝起來，會讓程式碼更清晰， 在 Go 中類似於其他語言的 class，但它只包含資料欄位。
語法：

```golang
type Student struct {
    Name string
    Class string
    Id int
}
```

### 範例：一個計算器

與其讓 Add 函式散落在各處，我們可以建立一個 Calculator 結構，並為它定義「方法」(Methods)。方法是一個與特定型別關聯的函式。

```golang
package main

type Calculator struct {
    // 現在它可以是空的，未來可以儲存狀態，例如歷史紀錄。
}

func (c Calculator) Add(a, b int) int {
    return a + b
}
```

這裡，Add 函式變成了 Calculator 型別的一個方法。這讓我們的程式碼意圖更清晰：這是一個屬於「計算器」的「加法」能力。
在測試時，我們就可以建立一個 Calculator 的實例 (Instance)，然後呼叫它的 Add 方法來進行測試。

## 介面 (Interfaces)

如果說函式和結構是個別不同形狀的磚塊，那麼 **介面** 就是負責連結這兩者的黏著劑，介面是 TDD 得以處理複雜依賴關係的秘密武器。

### 介面是什麼？

它是一份「合約」或「行為規範」。它只定義了「需要有哪些方法」，但完全不管「這些方法是如何實現的」。

```golang
type InterfaceName interface {
    MethodName1(params) (returns)
    MethodName2(params) (returns)
}
```

### Go 的隱式介面之美

在 Go 中，一個結構不需要像 Java 或 C# 那樣明確地說 implements InterfaceName。只要這個結構「實現了介面中定義的所有方法」，Go 就會自動認定它「滿足」了這個介面，這我們稱之為「隱式實作」或「結構化型別」(Structural Typing)。

#### 為何介面對 TDD 如此重要？

想像我們的計算器需要一個「通知」功能，在計算完成後發送郵件。

以下是不良的設計 (緊密耦合):

```golang
import "awesome-email-sdk"

type Calculator struct {
    // ...
}

func (c Calculator) Add(a, b int) int {
    result := a + b
    // 直接依賴一個具體的 EmailSender
    emailSender := awesome-email-sdk.NewSender("api-key") 
    emailSender.Send("admin@example.com", "Calculation done!")
    return result
}
```

這個設計是「無法測試」的！因為每次我們呼叫 Add 來測試加法時，它都會真的去寄送一封 Email！我們不希望測試時有太多的外部依賴，反之我們受測試的code 應該要能獨立運行。

#### 良好的設計 (使用介面解耦)

- 第一步：定義一份「合約」(Interface)

```golang
// Notifier 是一個能發送通知的介面
type INotifier interface {
    Send(message string) error
}
```

- 第二步：讓我們的結構依賴於介面，而非「實作」

```golang
// Calculator 依賴於 Notifier 介面
type Calculator struct {
    notifier INotifier // 依賴介面！
}

func (c *Calculator) AddAndNotify(a, b int) (int, error) {
    result := a + b
    // 呼叫介面的方法，不關心具體是誰來做
    err := c.notifier.Send("Calculation done!")
    if err != nil {
        return 0, err
    }
    return result, nil
}
```

- 第三步：在正式環境中，傳入「真的」實作

```golang
type EmailNotifier struct { 

 }

func (e EmailNotifier) Send(message string) error {
    // ... 真正的寄信邏輯
    return nil
}

// main.go
func main() {
    emailNotifier := EmailNotifier{}
    calculator := &Calculator{notifier: emailNotifier} // 注入真的 Notifier
    calculator.AddAndNotify(1, 2)
}
```

- 第四步 (TDD 的魔法！): 在測試中，傳入一個「假的」測試替身 (Mock)

```golang
// calculator_test.go

// 建立一個假的 Notifier，它只為了測試而存在
type MockNotifier struct {
    DidSend bool // 用來記錄 Send 是否被呼叫過
}

func (m *MockNotifier) Send(message string) error {
    m.DidSend = true // 不真的寄信，只做個標記
    return nil
}

func TestCalculatorNotifies(t *testing.T) {
    mock := &MockNotifier{}
    calculator := &Calculator{notifier: mock} // 注入假的 Notifier！

    calculator.AddAndNotify(3, 4)

    // 斷言：我們的假 Notifier 真的被呼叫了嗎？
    if !mock.DidSend {
        t.Error("expected notifier.Send to be called, but it wasn't")
    }
}
```

透過介面，我們成功地將「計算邏輯」與「通知邏輯」分開測試，這就是 TDD 能夠處理複雜系統的基石。

## 今日總結

今天我們快速掌握了 Go 語言中與 TDD 最相關的三大語法：

- **函式**： 我們測試的基本單位，追求「純粹」的輸入與輸出。
- **結構**： 將相關資料組織在一起，形成清晰的程式碼結構。
- **介面**： TDD 的超級武器，透過定義 介面 來解除程式碼之間的依賴，讓我們可以輕易地換上「測試替身」，達成單元測試的隔離性。

我們不僅學了語法，更重要的是理解了它們在「設計可測試程式碼」中所扮演的角色。

預告：Day 4 - Golang 的測試利器 - go test 指令與 _test.go 檔案
語法基礎已經打下，明天我們將正式揭開 Go 內建測試工具的神秘面紗，深入了解 `_test.go` 檔案的結構，以及 go test 指令背後的各種強大參數。