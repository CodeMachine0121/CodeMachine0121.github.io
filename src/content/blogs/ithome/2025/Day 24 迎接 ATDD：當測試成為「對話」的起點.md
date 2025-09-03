---
title: "Day 24 - 迎接 ATDD：當測試成為「對話」的起點"
datetime: "2025-08-26"
description:  "將我們的視角從 開發維度 提升到 業務維度，引入 TDD 的近親——驗收測試驅動開發 (ATDD)，並學習一種能讓業務、QA 和開發者都能溝通的「共同語言」。"
parent: "2025 ithome-鐵人賽: 從 0 到 1：與 AI 協作的 Golang TDD 實戰 系列"
image: "/images/titles/golang-biker.png"
---

## 昨日回顧與今日目標

在 Day 23，我們體驗了 TDD 實踐中最棘手的敵人——遺留程式碼，我們學會了利用 AI 生成「特性測試」，為前人留下的舊程式碼建立起保護傘，從而為後續的重構與功能疊加鋪平了道路。

至此，我們有足夠的能力透過 AI(或是靠自己) 來實踐 TDD，我們能夠確保我們寫的函式邏輯都符合我們對於該單一功能的預期。但是，一個嚴峻的問題擺在面前：

> 誰來保證我們多個函式邏輯組合出來的功能，完全符合「業務需求」呢？

舉個情境，我們可能完美地實現了一個功能，最後卻發現 PM/PO 想要的根本不是這個，這種由於溝通不暢導致的返工，是開發中最大的浪費之一。

**今天的目標**：將我們的視角從 開發維度 提升到 業務維度，引入 TDD 的近親——驗收測試驅動開發 (ATDD)，並學習一種能讓業務、QA 和開發者都能溝通的「共同語言」。

> TDD 的局限性：從「把事情做對」到「做對的事情」

## 回顧一下 TDD 的流程

> 開發者理解需求 -> 編寫失敗的單元測試 -> 編寫通過的程式碼 -> 重構

這個流程的核心是開發者，它能極好地保證我們把單一件事情做對 (Doing the things right)，即程式碼的實現與開發者的理解完全一致。但它無法保證我們在做對的事情 (Doing the right thing)，如果開發者一開始就誤解了業務需求，那麼 T-D-D 的每一步都會「精準地」走向錯誤的終點。

## ATDD 的誕生：讓「驗收標準」驅動開發

**驗收測試驅動開發 (Acceptance Test-Driven Development, ATDD)**，也常被認為是 **行為驅動開發 (Behavior-Driven Development, BDD)**，但兩者的核心思想都是為了解決這個問題。

ATDD 的流程是這樣的：

> 團隊共同定義驗收標準 (Acceptance Criteria) -> 將標準轉化為自動化的驗收測試 -> 執行測試，看到失敗 -> 啟動 TDD 循環開發功能 -> 直到驗收測試通過

BDD 的流程是這樣的:

> 產品、QA、開發者共同討論並定義業務場景 -> 用自然語言（Gherkin）描述場景 -> 將場景轉化為自動化的行為測試 -> 執行測試，看到失敗 -> 啟動 TDD 循環開發功能 -> 直到行為測試通過

### ATDD 與 TDD 的關鍵區別與關係

- 視角不同： TDD 是開發者視角，關注一個「單元」的內部邏輯；ATDD 是使用者/業務視角，關注整個系統在特定場景下的外部可觀測行為。
- 驅動力不同： TDD 由開發者編寫的技術測試驅動；ATDD 由團隊（產品、QA、開發）共同定義的業務需求驅動。
- 關係： ATDD 是 TDD 的外層循環，一個失敗的 ATDD 驗收測試，會觸發一系列 TDD 的「紅-綠-重構」小循環，當所有小循環完成後，外層的 ATDD 測試就應該通過。它們是相輔相成、完美互補的。
- Gherkin：讓所有人都能讀懂的「共同語言」

要讓產品經理和 QA 也能參與定義測試，我們顯然不能讓他們去寫 Go 程式碼。所以我們需要一種更友好的語言。這就是 **Gherkin** 發揮作用的地方。

### Gherkin

Gherkin 是一種簡單的、結構化的自然語言，它使用 Given-When-Then 的語法來描述一個業務場景。
Gherkin 的核心關鍵字：

- Feature: 描述我們要測試的「功能」是什麼。
- Scenario: 描述在這個功能下的一個具體「場景」。
- Given (給定): 描述場景開始前的前置條件或初始狀態。
- When (當): 描述使用者執行的某個動作或觸發的某個事件。
- Then (那麼): 描述我們期望系統產生的可觀測的結果或狀態變化。
- And, But (和, 但): 用於連接多個 Given, When, 或 Then。

#### 一個 Gherkin 範例（使用者登入）

```gherkin
Feature: User Authentication

  Scenario: Successful login with valid credentials
    Given I am a registered user with username "johndoe" and password "password123"
    And I am on the login page
    When I fill in "username" with "johndoe"
    And I fill in "password" with "password123"
    And I click the "Login" button
    Then I should be redirected to my dashboard
    And I should see the welcome message "Welcome, johndoe!"
```

這段描述，團隊裡的任何角色都能看懂、能討論、能確認。它就是我們一直在尋找的「共同語言」，是連接業務與程式碼的橋樑。

### Go 語言的 ATDD 利器：`godog`

我們如何讓這段用自然語言寫的 `.feature` 檔案，真正地「執行」起來呢？在 Go 的世界裡，最流行的工具就是 `godog`。

`godog` 是一個 Go 版本的 Cucumber（Cucumber 是 BDD/ATDD 的OG級框架）。它的工作流程是：

1. 你編寫一個 `.feature` 檔案。
2. 你執行 `godog` 命令。
3. `godog` 會讀取你的 `.feature` 檔案，然後告訴你：「很好，我理解了這些業務步驟，但你還沒有告訴我，在 Go 的世界裡，`When I click the 'Login' button` 這句話到底對應著要執行哪一段 Go 程式碼。」
4. 你需要編寫一個 Go 函式，我們稱之為「步驟定義 (Step Definition)」，並用正則表達式將它與 Gherkin 中的句子「綁定」。
5. 當所有的 Gherkin 步驟都被綁定了對應的 Go 函式後，`godog` 就能完整地執行整個業務場景了。

### 今日總結

今天，我們完成了一次重要的視角提升，從開發者的微觀世界，躍升到了團隊協作的宏觀視角。

- 我們理解了 TDD 的局限性，並認識到 ATDD 是如何透過**從業務需求出發**來彌補這一點的，它確保我們在「做對的事情」。
- 我們學習了 Gherkin 語言的 `Given-When-Then` 語法，掌握了一種能讓產品、QA、開發**無障礙溝通的共同語言**。
- 我們了解了 `godog` 是 Go 語言中實現 ATDD 的核心工具，它充當了從 `.feature` 業務描述到 Go 程式碼實現之間的「翻譯官」。

我們已經為ATDD的開發實踐做好了理論準備。

預告：Day 25 - ATDD 實戰 (一)：用 `godog` 定義第一個業務場景**
理論需要實作來鞏固，明天我們將在專案中安裝並設定 `godog`，並為一個簡單的功能，完整地編寫第一個 `.feature` 檔案，首次執行 `godog` 命令，看看它是如何引導我們去實現缺失的「步驟定義」的。準備好，用一種全新的方式來定義你的開發起點吧！