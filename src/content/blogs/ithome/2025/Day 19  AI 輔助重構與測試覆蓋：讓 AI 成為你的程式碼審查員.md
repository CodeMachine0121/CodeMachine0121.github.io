---
title: "Day 19 - AI 輔助重構與測試覆蓋：讓 AI 成為你的 Code Reviewer"
datetime: "2025-08-22"
description:  "學習如何利用 AI，來強化我們 TDD 循環中的「重構」與「測試完備性」。"
parent: "2025 ithome-鐵人賽: 從 0 到 1：與 AI 協作的 Golang TDD 實戰 系列"
image: "/images/titles/golang-starwar.jpg"
---

## 昨日回顧與今日目標

在 Day 18 的完整實戰中，我們成功地指揮 AI，遵循 G-P-T-R 模式完成了一個微型 Kata。我們體驗了如何透過精準的 Prompt，讓 AI 在 TDD 的「紅燈」和「綠燈」階段成為我們的高效助手。

但是，TDD 的黃金循環還有最後，也是最能體現功力的一環——重構 (Refactor)，一個好的重構能提升程式碼的可讀性和可維護性。此外，我們的測試案例真的寫得夠完整嗎？有沒有遺漏什麼邊界條件？

> 今天的目標：學習如何利用 AI，來強化我們 TDD 循環中的「重構」與「測試完備性」。

- AI 輔助重構： 讓 AI 扮演 Code Reviewer 的角色，為我們的「綠燈」程式碼提出改進建議。
- AI 擴充測試覆蓋： 利用 AI 窮舉式的思維，幫助我們找到可能忽略的邊界條件，並為其生成新的測試案例。

## 場景一：AI 作為你的即時 Code Reviewer

讓我們回到昨天 password Kata 的最終成果。假設經過幾個循環後，我的 Validate 函式變成了這樣：

``` golang
// password/password.go
package gopasswordverify

import (
    "errors"
    "regexp"
)

func Validate(password string) (bool, error) {
    if len(password) < 8 {
        return false, errors.New("password is too short")
    }

    hasNumber := regexp.MustCompile(`[0-9]`).MatchString(password)
    if !hasNumber {
        return false, errors.New("password must contain at least one number")
    }

    hasUppercase := regexp.MustCompile(`[A-Z]`).MatchString(password)
    if !hasUppercase {
        return false, errors.New("password must contain at least one uppercase letter")
    }

    return true, nil
}

```

這段程式碼的功能是正確的（所有測試都是綠燈），現在，讓我們召喚 AI 審查員。

### 詠唱 Prompt，請求重構建議

在 VS Code 中，選取整個 Validate 函式，然後對 Copilot Chat 說：

``` markdown
**(角色)**: 你是一位追求極致程式碼品質的 Golang 軟體架構師。
**(上下文)**: (已選取 Validate 函式)
**(指令)**: 請 Code Review 我選取的這段程式碼。它目前的功能是正確的，但不確定是否有 code smell。若有請指出它的問題，並給我一個重構後的版本。請優先考慮效能和可擴充性。
```

### AI 可能會給出類似下面的分析和建議

### AI Refactor 後的 code (作者自己這邊的)

```golang
package gopasswordverify

import (
    "errors"
    "regexp"
)

const (
    MinPasswordLength = 8
)

var (
    // 預編譯正規表達式以提升效能
    numberRegex    = regexp.MustCompile(`[0-9]`)
    uppercaseRegex = regexp.MustCompile(`[A-Z]`)
)

// ValidationRule 定義驗證規則的介面
type ValidationRule interface {
    Validate(password string) error
}

// LengthRule 長度驗證規則
type LengthRule struct {
    MinLength int
}

func (r LengthRule) Validate(password string) error {
    if len(password) < r.MinLength {
        return errors.New("password is too short")
    }
    return nil
}

// NumberRule 數字驗證規則
type NumberRule struct{}

func (r NumberRule) Validate(password string) error {
    if !numberRegex.MatchString(password) {
        return errors.New("password must contain at least one number")
    }
    return nil
}

// UppercaseRule 大寫字母驗證規則
type UppercaseRule struct{}

func (r UppercaseRule) Validate(password string) error {
    if !uppercaseRegex.MatchString(password) {
        return errors.New("password must contain at least one uppercase letter")
    }
    return nil
}

// PasswordValidator 密碼驗證器
type PasswordValidator struct {
    rules []ValidationRule
}

// NewPasswordValidator 建立預設的密碼驗證器
func NewPasswordValidator() *PasswordValidator {
    return &PasswordValidator{
        rules: []ValidationRule{
            LengthRule{MinLength: MinPasswordLength},
            NumberRule{},
            UppercaseRule{},
        },
    }
}

// AddRule 添加自定義驗證規則
func (v *PasswordValidator) AddRule(rule ValidationRule) {
    v.rules = append(v.rules, rule)
}

// ValidatePassword 驗證密碼
func (v *PasswordValidator) ValidatePassword(password string) (bool, error) {
    for _, rule := range v.rules {
        if err := rule.Validate(password); err != nil {
            return false, err
        }
    }
    return true, nil
}

// Validate 保持向後相容的函式
func Validate(password string) (bool, error) {
    validator := NewPasswordValidator()
    return validator.ValidatePassword(password)
}
```

### AI 的回覆 (作者自己這邊的)

```text
經過 Code Review，我發現這段程式碼確實存在幾個 code smell 和效能問題：

問題分析
- 效能問題: 每次呼叫都重複編譯正規表達式，造成不必要的效能開銷
- 可擴充性問題: 硬編碼的驗證規則，增加新規則需要修改核心函式
- 單一職責原則違反: 一個函式承擔多種驗證責任
- 魔術數字: 硬編碼的最小長度 8
- 重複的程式碼模式: 每個驗證都是相似的 if 檢查
```

這個重構後的版本，將多次迴圈合併為一次，顯著提升了效能。我們作為開發者，可以接受這個建議 或是 回應她我們不能接受的寫法請AI再跑一次後，然後立即執行 `go test -v ./...`，看到測試依然是綠燈，我們就知道這次重構是安全的。這就是 TDD 與 AI 輔助重構結合的威力！

## 場景二：AI 作為你的測試案例擴充夥伴

我們的測試案例覆蓋了「密碼太短」、「沒有數字」、「沒有大寫字母」等情況。但我們是否遺漏了什麼？人類的思維容易有盲點，但 AI 擅長從海量資料中進行模式匹配和窮舉。

### Prompt 詠唱

```markdown
(角色) 你是一位經驗豐富的軟體測試工程師 (QA)。
(上下文) (已開啟 password_test.go 檔案)
(指令) 這是我為 Validate 函式編寫的測試。請幫我分析一下，我可能遺漏了哪些重要的邊界條件或測試案例？請以列表形式告訴我。
```

AI 可能會給出一些我們沒想到的建議：

```markdown
遺漏的測試案例清單
1. 空值和邊界條件: 
    - 空字串 "" - 測試極端邊界
    - 僅空格的字串 "        " - 測試空白字元處理
    -  包含空格的密碼 "Abc 123" - 測試空格是否被正確處理
2. 長度邊界條件:
    - 剛好 7 個字元（最小長度-1）- 測試邊界條件
    - 剛好 8 個字元且符合所有規則的密碼 "Abcdefg1" - 測試最小長度邊界
    - 非常長的密碼（如 100+ 字元）- 測試效能和上限處理
3. 成功案例:
    最重要的遺漏：缺少至少一個完全符合所有規則的有效密碼測試案例，例如："Abcdefg1", "Password123", "MyPass1"
4. 特殊字元處理
    - 包含特殊字元的密碼 "Abcdef1@" - 測試特殊字元是否被接受
    - 包含 Unicode 字元的密碼 "密碼Test1" - 測試國際字元
    - 包含符號的密碼 "Abc!@#1" - 測試各種符號
5. 數字位置變化
    - 數字在開頭 "1Abcdefg"
    - 數字在中間 "Abcd1efg"
    - 數字在結尾 "Abcdefg1"（你已有此案例）
    - 多個數字 "Ab12def3"
...
```

看到這些建議，我們恍然大悟！特別是第 4 點，對於 Go 語言來說，測試 Unicode 的處理方式是一個非常好的實踐。

現在，我們可以接著下指令："很好，請為我剛剛提到的第 4 點，生成對應的測試案例，並添加到我的測試表格中。 (當然這個 part 一樣留給讀者大大們玩玩看)
AI 會幫我們生成新的測試案例，我們再為這些新案例走一次「紅-綠-重構」循環（儘管它們很可能直接就是綠燈），從而讓我們的測試安全網變得更加密不透風。

## 今日總結

今天，我們將 AI 的角色從單純的「程式碼生成者」提升為更智慧的「協作者」。

- 我們學會了如何詠唱，讓 AI 扮演 Code Reviewer，幫助我們發現程式碼中的壞味道並提供安全的重構方案。
- 我們學會了如何詠唱，讓 AI 扮演QA，幫助我們突破思維盲點，找到被遺漏的邊界條件，提升測試的完備性。
- 我們深刻體會到，在 TDD 循環中，go test 是我們驗證 AI 所有建議（無論是重構還是新增測試）是否安全可靠的最終仲裁者。

AI 讓 TDD 的「重構」階段變得更深入，也讓我們的測試「紅燈」覆蓋得更全面。

新預告：Day 20 - AI TDD 完整演練：開發一個簡易的 API 端點

到目前為止，我們的 Kata 都發生在純邏輯層。明天，我想挑戰一個較為真實的後端開發任務：使用 AI 輔助的 TDD 流程，從零開始開發一個簡單的 HTTP API 端點，這將涉及到處理 HTTP 請求、回應、狀態碼等，我們將看看 AI 在這個場景下，如何幫助我們駕馭更複雜的互動。