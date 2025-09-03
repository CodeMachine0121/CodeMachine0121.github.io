---
title: "Day 26 - ATDD 實戰 (二)：用 TDD 實現「步驟定義」，打通E2E流程"
datetime: "2025-08-27"
description:  "完成 ATDD 的後半部分，將業務描述與真實的程式碼邏輯連接起來，並點亮最終的綠燈！"
parent: "2025 ithome-鐵人賽: 從 0 到 1：與 AI 協作的 Golang TDD 實戰 系列"
image: "/images/titles/golang-couch-potato.png"
---

## 昨日回顧與今日目標

在 Day 25 中，我們成功地啟動了 ATDD 流程，我們利用 AI 撰寫了用來描述「購物車折扣」業務需求的 .feature 檔案，並執行了 godog 工具。
godog 並沒有報錯，而是為我們生成了一份「待辦清單」——那些尚未被實現的 Go 函式骨架，即「步驟定義」(Step Definitions)。現在，我們已經擁有了一張由業務驅動的、清晰的開發路線圖。

> 今天的目標：完成 ATDD 的後半部分，將業務描述與真實的程式碼邏輯連接起來，並點亮最終的綠燈！

## 建立一個 Go 檔案來存放和實現 godog 生成的步驟定義

在實現步驟定義的過程中，啟動 TDD 的「內循環」，來開發核心的 cart 業務邏輯，最終再次執行 godog，看到所有業務場景都順利通過，完成整個 ATDD 的閉環。

## 第一步：建立步驟定義檔案，連接 Gherkin 與 Go

godog 告訴我們需要實現一些 Golang 函式，我們需要一個地方來存放它們。

在 features 資料夾下，建立一個新檔案 feature_test.go，然後，將昨天 godog 在終端機中生成的那段程式碼骨架(需修改為透過 `*testing` 測試的版本 )，完整地貼到這個新檔案中。
為了在不同的步驟之間傳遞狀態（例如，在 Given 步驟中建立的購物車，需要在 Then 步驟中被驗證），我們需要一個共用的上下文結構體。

整理後的 features/steps.go 檔案看起來應該是這樣的：

```golang
// features/feature_test.go
package features

import (
    "testing"

    "github.com/cucumber/godog"
)

func aDiscountShouldBeApplied(arg1 int) error {
        return godog.ErrPending
}

func iHaveItemsInMyCart() error {
        return godog.ErrPending
}

func noDiscountShouldBeApplied() error {
        return godog.ErrPending
}

func ordersOverReceiveADiscount(arg1, arg2 int) error {
        return godog.ErrPending
}

func theCartDiscountSystemIsEnabled() error {
        return godog.ErrPending
}

func theCartTotalIs(arg1 int) error {
        return godog.ErrPending
}


// TestFeatures 是 Go 測試的進入點
func TestFeatures(t *testing.T) {
    suite := godog.TestSuite{
        ScenarioInitializer: func(s *godog.ScenarioContext) {
            // 在這裡初始化情境並註冊步驟定義
            s.Step(`^a (\d+)% discount should be applied$`, aDiscountShouldBeApplied)
            s.Step(`^I have items in my cart$`, iHaveItemsInMyCart)
            s.Step(`^no discount should be applied$`, noDiscountShouldBeApplied)
            s.Step(`^orders over \$(\d+) receive a (\d+)% discount$`, ordersOverReceiveADiscount)
            s.Step(`^the cart discount system is enabled$`, theCartDiscountSystemIsEnabled)
            s.Step(`^the cart total is \$(\d+)$`, theCartTotalIs)
            s.Step(`^the final price should be \$(\d+)$`, theFinalPriceShouldBe)
        },
        Options: &godog.Options{
            Format:   "pretty",             // 輸出格式，例如 "pretty" 或 "cucumber"
            Paths:    []string{"features"}, // .feature 檔案所在的目錄
            TestingT: t,                    // 傳入 *testing.T 實例
        },
    }

    if suite.Run() != 0 {
        t.Fatal("Godog 測試失敗")
    }
}

```

（注意：為了讓 testContext 的狀態能在步驟之間共享，我們將函式改為 testContext 的方法，並在 InitializeScenario 中建立 tc 實例。）

## 第二步：ATDD 驅動 TDD，開發核心邏輯

現在，`features/feature_test.go` 檔案是沒有意義的，因為 go-tdd-kata/cart 這個套件以及其中的 Cart 型別、NewCart 和 FinalPrice 方法都還不存在。

這正是 ATDD 最關鍵的時刻：一個失敗的、高層次的「驗收測試」，驅動我們去進行一個或多個低層次的「單元測試」開發，此時我們的目標變得非常明確：先讓整個專案都可以編譯。

- 建立 cart 套件： 在專案根目錄下建立 cart 資料夾，並在其中建立 cart.go 和 cart_test.go。
- 啟動 TDD 內循環 (紅燈): 我們先不關心 steps.go，而是專注於 cart 套件本身。根據 Gherkin 的描述，我們知道 FinalPrice 的邏輯是核心。所以在 cart/cart_test.go 中，寫下第一個單元測試：

```golang
// cart/cart_test.go
package cart

import (
    "testing"
    "github.com/stretchr/testify/assert"
)

func TestCart_FinalPrice(t *testing.T) {
    // 為了覆蓋 ATDD 的兩個場景，我們直接用表格驅動測試
    testCases := []struct {
        name           string
        initialPrice   int
        expectedPrice int
    }{
        {name: "gets discount", initialPrice: 120, expectedPrice: 108},
        {name: "no discount", initialPrice: 90, expectedPrice: 90},
        {name: "boundary condition at 100", initialPrice: 100, expectedPrice: 90},
    }

    for _, tc := range testCases {
        t.Run(tc.name, func(t *testing.T) {
            c := NewCart(tc.initialPrice)
            assert.Equal(t, tc.expectedPrice, c.FinalPrice())
        })
    }
}
```

### TDD 內循環 (綠燈 & 重構): 在 cart/cart.go 中，編寫剛好能讓上述單元測試通過的程式碼

#### 詠唱 prompt

```makrdown
角色: 專業的 TDD Golang 工程師
目標: 目前已經到了紅燈階段，請你修改 production code
```

#### AI 輸出 1

```golang
// cart/cart.go
package cart

type Cart struct {
    totalPrice int
}

func NewCart(price int) *Cart {
    return &Cart{totalPrice: price}
}

func (c *Cart) FinalPrice() int {
    if c.totalPrice >= 100 {
        // 折扣 10%
        return int(float64(c.totalPrice) * 0.9)
    }
    return c.totalPrice
}
```

現在執行 `go test -v ./cart`，你會看到 cart 套件的單元測試是通過的。我們的核心業務邏輯已經被 TDD 保護起來了。

## 第三步：完成步驟定義，打通端到端流程

既然 cart 套件已經開發完成，我們現在可以充滿信心地回到 features/steps.go，把那些 godog.ErrPending 替換成真實的邏輯了。

### 開始詠唱

```markdown
角色: 精通 bdd 的 golang 工程師
目標: 完成 #file:step.go 中的函示
限制: 只能更改 #file:feature_test.go, 業務邏輯請參考 #file:cart
```

### AI 輸出 2

```golang
package features_test

import (
    "fmt"
    "testing"

    "go-bdd/cart"

    "github.com/cucumber/godog"
)

// 全局變數來保存測試狀態
var (
    currentCart       *cart.Cart
    originalTotal     int
    discountEnabled   bool
    discountThreshold int
    discountRate      int
)

func aDiscountShouldBeApplied(discountPercent int) error {
    if currentCart == nil {
        return fmt.Errorf("no cart available")
    }

    // 檢查是否應該應用折扣
    finalPrice := currentCart.FinalPrice()
    expectedDiscount := float64(originalTotal) * float64(discountPercent) / 100
    expectedFinalPrice := originalTotal - int(expectedDiscount)

    if finalPrice != expectedFinalPrice {
        return fmt.Errorf("expected discount of %d%% to be applied, but final price is %d instead of %d",
            discountPercent, finalPrice, expectedFinalPrice)
    }

    return nil
}

func iHaveItemsInMyCart() error {
    // 這個步驟只是確認購物車狀態，不需要特殊處理
    return nil
}

func noDiscountShouldBeApplied() error {
    if currentCart == nil {
        return fmt.Errorf("no cart available")
    }

    finalPrice := currentCart.FinalPrice()

    if finalPrice != originalTotal {
        return fmt.Errorf("expected no discount, but final price %d differs from original total %d",
            finalPrice, originalTotal)
    }

    return nil
}

func ordersOverReceiveADiscount(threshold, discountPercent int) error {
    discountThreshold = threshold
    discountRate = discountPercent
    return nil
}

func theCartDiscountSystemIsEnabled() error {
    discountEnabled = true
    return nil
}

func theCartTotalIs(total int) error {
    originalTotal = total
    currentCart = cart.NewCart(total)
    return nil
}

func theFinalPriceShouldBe(expectedPrice int) error {
    if currentCart == nil {
        return fmt.Errorf("no cart available")
    }

    finalPrice := currentCart.FinalPrice()
    if finalPrice != expectedPrice {
        return fmt.Errorf("expected final price to be %d, but got %d", expectedPrice, finalPrice)
    }

    return nil
}

func TestFeatures(t *testing.T) {
    suite := godog.TestSuite{
        ScenarioInitializer: func(s *godog.ScenarioContext) {
            // 在這裡初始化情境並註冊步驟定義
            s.Step(`^a (\d+)% discount should be applied$`, aDiscountShouldBeApplied)
            s.Step(`^I have items in my cart$`, iHaveItemsInMyCart)
            s.Step(`^no discount should be applied$`, noDiscountShouldBeApplied)
            s.Step(`^orders over \$(\d+) receive a (\d+)% discount$`, ordersOverReceiveADiscount)
            s.Step(`^the cart discount system is enabled$`, theCartDiscountSystemIsEnabled)
            s.Step(`^the cart total is \$(\d+)$`, theCartTotalIs)
            s.Step(`^the final price should be \$(\d+)$`, theFinalPriceShouldBe)
        },
        Options: &godog.Options{
            Format:   "pretty",      // 輸出格式，例如 "pretty" 或 "cucumber"
            Paths:    []string{"."}, // .feature 檔案所在的目錄
            TestingT: t,             // 傳入 *testing.T 實例
        },
    }

    if suite.Run() != 0 {
        t.Fatal("Godog 測試失敗")
    }
}
```

## 第四步：驗收的時刻

所有拼圖都已就位。業務需求 (.feature) -> 步驟定義 (steps.go) -> 核心邏輯 (cart.go)。
讓我們回到專案的根目錄，執行最終的驗收指令：

```bash
go test -v ./...
```

這一次，你將看到一幅完美的景象：

```text
=== RUN   TestCart_FinalPrice
=== RUN   TestCart_FinalPrice/gets_discount
=== RUN   TestCart_FinalPrice/no_discount
=== RUN   TestCart_FinalPrice/boundary_condition_at_100
--- PASS: TestCart_FinalPrice (0.00s)
    --- PASS: TestCart_FinalPrice/gets_discount (0.00s)
    --- PASS: TestCart_FinalPrice/no_discount (0.00s)
    --- PASS: TestCart_FinalPrice/boundary_condition_at_100 (0.00s)
PASS
ok      go-bdd/cart     (cached)
=== RUN   TestFeatures
Feature: Cart Discount
  As a customer
  I want to receive a discount when my cart total reaches a certain amount
  So that I can save money on my purchases
=== RUN   TestFeatures/Cart_total_meets_discount_criteria

  Background:
    Given the cart discount system is enabled   # feature_test.go:97 -> go-bdd/features_test.theCartDiscountSystemIsEnabled
    And orders over $100 receive a 10% discount # feature_test.go:96 -> go-bdd/features_test.ordersOverReceiveADiscount

  Scenario: Cart total meets discount criteria  # cart_discount.feature:10
    Given I have items in my cart               # feature_test.go:94 -> go-bdd/features_test.iHaveItemsInMyCart
    When the cart total is $120                 # feature_test.go:98 -> go-bdd/features_test.theCartTotalIs
    Then a 10% discount should be applied       # feature_test.go:93 -> go-bdd/features_test.aDiscountShouldBeApplied
    And the final price should be $108          # feature_test.go:99 -> go-bdd/features_test.theFinalPriceShouldBe
=== RUN   TestFeatures/Cart_total_does_not_meet_discount_criteria

  Scenario: Cart total does not meet discount criteria # cart_discount.feature:16
    Given I have items in my cart                      # feature_test.go:94 -> go-bdd/features_test.iHaveItemsInMyCart
    When the cart total is $90                         # feature_test.go:98 -> go-bdd/features_test.theCartTotalIs
    Then no discount should be applied                 # feature_test.go:95 -> go-bdd/features_test.noDiscountShouldBeApplied
    And the final price should be $90                  # feature_test.go:99 -> go-bdd/features_test.theFinalPriceShouldBe

2 scenarios (2 passed)
12 steps (12 passed)
3.3728ms
--- PASS: TestFeatures (0.00s)
    --- PASS: TestFeatures/Cart_total_meets_discount_criteria (0.00s)
    --- PASS: TestFeatures/Cart_total_does_not_meet_discount_criteria (0.00s)
PASS
ok      go-bdd/features 3.253s
```

全綠！ 這份報告清晰地顯示，我們用程式碼的實現，精準地滿足了當初用自然語言描述的每一個業務場景。這就是 ATDD 帶來的信心與價值。

## 今日總結

今天，我們打通了 ATDD 的“最後一公里”。

- 我們學會了如何撰寫「步驟定義」Go 函式，來將 Gherkin 中的自然語言步驟翻譯成可執行的程式碼。
- 我們親身體驗了 ATDD (外循環) 如何驅動 TDD (內循環) 的開發模式。
- 我們最終用一份業務團隊也能看懂的測試報告，證明了我們的軟體不僅「做得對」，而且「做了對的事」。

當你掌握了 ATDD，你就擁有了一種強大的能力，能確保技術實現與業務目標始終保持一致。

預告：Day 27 - 人機協作的藝術 - 當 AI 的建議與你想法不同時
在經歷了從 TDD 到 ATDD 的完整實踐後，我們與 AI 的協作也進入了更廣闊的領域。現在，是時候來深入探討人機協作中的衝突、思辨與決策了。當 AI 對你的描述提出不同看法時，該如何應對？