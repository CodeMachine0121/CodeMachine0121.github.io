---
title: "Day 25 - ATDD 實戰 (一)：用 godog 定義第一個業務場景"
datetime: "2025-08-27"
description:  "為「購物車折扣」功能，完成 ATDD 的前半部分工作 —— 定義需求，並讓 godog 引導我們下一步該做什麼。"
parent: "2025 ithome-鐵人賽: 從 0 到 1：與 AI 協作的 Golang TDD 實戰 系列"
image: "/images/titles/golang-beard.jpg"
---

## 昨日回顧與今日目標

在 Day 24，我們提升了思考的維度，從開發者內部的 TDD，躍升到了跨團隊協作的 ATDD，我們學到了 Gherkin 的 Given-When-Then 語法，並知道了 godog 是將業務描述與 Golang 程式碼連接起來的橋樑。理論的種子已經播下，今天，我們將親手種下第一棵樹苗。

> 今天的目標：為「購物車折扣」功能，完成 ATDD 的前半部分工作 —— 定義需求，並讓 godog 引導我們下一步該做什麼。

## 實戰場景：購物車折扣功能

讓我們再次明確我們的業務需求：

- 規則 1: 購物車商品總價滿 100 元 (含)，可享受 10% 的折扣。
- 規則 2: 總價未滿 100 元，沒有折扣。

## 第一步：安裝 godog

首先，我們需要將 godog 工具安裝到我們的專案中。
安裝 godog CLI: 在專案根目錄 (go-atdd) 下，執行以下指令來安裝 godog 的命令列工具。

```bash
go install github.com/cucumber/godog/cmd/godog@latest
```

## 第二步：用 Gherkin 和 AI 編寫 .feature 檔案

現在，我們要將團隊（產品經理、QA、你）共同確認的業務需求，轉化為 Gherkin 格式。

新增一個 features 資料夾，並在其底下建立一個新檔案 `cart_discount.feature`，這個任務非常適合交給 AI，因為它能精準地理解自然語言並轉換為結構化的 Gherkin。

### 讓我們對 Copilot Chat 下達指令

```makrdown
**(角色)** 你是一位經驗豐富的業務分析師 (BA)，精通 BDD 和 Gherkin 語法。
**(指令)** 請為我編寫一個 Gherkin 的 .feature 檔案，來描述「購物車折扣」功能。請包含兩個場景：

- 一個成功的場景：購物車總價為 120 元時，最終價格應為 108 元。
- 一個不滿足條件的場景：購物車總價為 90 元時，最終價格應為 90 元。

請使用 Given-When-Then 格式。
```

### AI 的輸出

```gherkin
Feature: Cart Discount
  As a customer
  I want to receive a discount when my cart total reaches a certain amount
  So that I can save money on my purchases

  Background:
    Given the cart discount system is enabled
    And orders over $100 receive a 10% discount

  Scenario: Cart total meets discount criteria
    Given I have items in my cart
    When the cart total is $120
    Then a 10% discount should be applied
    And the final price should be $108

  Scenario: Cart total does not meet discount criteria
    Given I have items in my cart
    When the cart total is $90
    Then no discount should be applied
    And the final price should be $90
```

至此，我們已經將模糊的業務需求，轉化為了一份清晰、結構化、可被機器讀取的驗收標準。

## 第三步：執行 godog，聆聽它的「引導」

我們已經定義了「期望做什麼」，但還沒有定義「具體怎麼做」，現在，讓我們執行 godog，看看它會對我們說些什麼。

在專案根目錄下，打開 terminal，執行：

```bash
godog
```

你會看到一段非常有價值的輸出，godog 會告訴你：它成功地解析了你的 .feature 檔案，理解了裡面的 2 個場景和 6 個步驟，但是，它不知道這些用自然語言寫的步驟，應該對應到 Go 語言中的哪個函式。

因此，它給出了這樣的提示：

```text
# ... (godog 的輸出)
You can implement step definitions for undefined steps with these snippets:

func aShoppingCartWithATotalPriceOf(arg1 int) error {
    return godog.ErrPending
}

func theUserCalculatesTheFinalPrice() error {
    return godog.ErrPending
}

func theFinalPriceShouldBe(arg1 int) error {
    return godog.ErrPending
}

func InitializeScenario(ctx *godog.ScenarioContext) {
    ctx.Step(`^a shopping cart with a total price of (\d+)$`, aShoppingCartWithATotalPriceOf)
    ctx.Step(`^the user calculates the final price$`, theUserCalculatesTheFinalPrice)
    ctx.Step(`^the final price should be (\d+)$`, theFinalPriceShouldBe)
}

# ...
```

其中，我們應該會看到以下的 warning:

```text
Use of godog CLI is deprecated, please use *testing.T instead.
See https://github.com/cucumber/godog/discussions/478 for details.
```

這是因為 godog cli 不建議我們使用它的cli運行測試，因此我們需要做點小修改。
將 `InitializeScenario` 替換成使用 `*testing` 的方式運行

``` golang
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

### 輸出解析

- `ctx.Step(...)`: 這一部分是「綁定」。它使用正則表達式，將 Gherkin 中的句子（例如 a shopping cart with a total price of 120）與一個 Go 函式（例如 aShoppingCartWithATotalPriceOf）關聯起來，正則表達式中的 `(\d+)` 會被自動捕捉，並作為參數（arg1 int）傳遞給 Go 函式。
- `return godog.ErrPending`: 這是一個佔位符錯誤，意思是「這個步驟我認識了，但它還在等待你去實現」。

我們的任務，就是把這段由 godog 生成的程式碼 template，變成可以工作的 Go 程式碼。

## 今日總結

今天，我們成功地邁出了 ATDD 實踐的第一步，

- 我們在專案中安裝並初始化了 `godog` 工具。
- 我們利用 AI 的能力，將模糊的業務需求，快速轉化為了一份清晰、結構化的 Gherkin .feature 檔案。
- 我們執行了 `godog`，並學會了如何解讀它的輸出——它不是在報錯，而是在為我們生成下一步開發的「待辦清單」。

我們已經有了一份由業務驅動的、清晰的開發路線圖，剩下的工作，就是用我們熟悉的 TDD 循環，來逐一完成這個清單上的任務。

預告：Day 26 - ATDD 實戰 (二)：用 TDD 實現「步驟定義」，打通 E2E 流程
路線圖已經繪製好。明天，我們將正式開始撰寫 Go 程式碼，來實現今天 `godog` 為我們生成的那些「待辦事項」，我們將看到 ATDD 如何作為外層循環，驅動我們進行內層的 TDD 開發，並最終將業務需求、驗收測試和產品程式碼完美地串聯在一起，點亮最終的「全綠」燈號！