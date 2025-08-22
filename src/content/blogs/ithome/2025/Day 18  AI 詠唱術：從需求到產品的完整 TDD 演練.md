---
title: "Day 18 - AI 詠唱術：從需求到產品的完整 TDD 演練"
datetime: "2025-08-21"
description:  "掌握 TDD 流程中的「AI 詠唱術」(Prompt Engineering)，並透過一個全新的微型 Kata，完整地演練一次從需求發想到開發完成的 AI 協作 TDD 流程。"
parent: "2025 ithome-鐵人賽: 從 0 到 1：與 AI 協作的 Golang TDD 實戰 系列"
image: "/images/titles/golang-space-2.jpg"
---
## 昨日回顧與今日目標

在 Day 17 中，我們成功整合了 AI 好同事——GitHub Copilot，但我們也需要能夠意識到，一個只會瘋狂寫 production code 的 AI，只會破壞整個 TDD 的流程，我們需要學會如何「指揮」AI，而不是被 AI「主宰」。

> 今天的目標：掌握 TDD 流程中的「AI 詠唱術」(Prompt Engineering)，並透過一個全新的微型 Kata，完整地演練一次從需求發想到開發完成的 AI 協作 TDD 流程。

## 為何需要「詠唱」？—— 主導權的遊戲

與 AI 協作，就像是和一個知識淵博但沒有主見的實習生一起工作，如果你對他說：「幫我做個登入功能」，他可能會用他所知道的「最常見」的方式，給你一個包含所有程式碼的巨大檔案。

但如果你遵循 TDD 的紀律，你會對他說：

- 「先幫我寫一個測試，驗證當使用者名稱為空時，登入函式會回傳錯誤。不要寫任何實作程式碼。」 (紅燈)
- (當測試失敗後) 「好了，現在幫我寫最簡單的程式碼，讓剛剛那個測試通過。」 (綠燈)
- (當測試通過後) 「幫我看看這段程式碼，有沒有可以重構的地方？比如命名或重複的邏輯。」 (重構)

看到區別了嗎？後者將一個大任務分解成了符合 TDD 節奏的微小步驟，而主導權始終在我們（開發者）手中，我們可以利用 AI 來加速每一個步驟，而不是讓 AI 取代整個流程。

> Prompt Engineering 就是設計這些精準、分步指令的藝術。

## 一種 友好的 AI 互動模式：G-P-T-R

我們可以將傳統的 **R-G-R (Red-Green-Refactor)** 循環，擴充為一個包含 AI 互動的新模式：

- **Goal (目標)**: 開發者用自然語言清晰地定義下一個微小的需求。
- **Prompt for Test (詠唱-測試)**: 開發者根據 Goal，向 AI (Copilot Chat) 下達指令，要求只生成會失敗的 test code。
- **Test Fails (紅燈)**: 開發者執行測試，親眼確認它如預期般失敗（亮起紅燈）。這是驗證我們的目標和測試都定義正確的關鍵一步。
- **Prompt for Implementation (詠唱-實作)**: 開發者將失敗的測試（或錯誤訊息）提供給 AI，要求只編寫剛好能讓測試通過的最少量 production code。
- **Test Passes (綠燈)**: 開發者再次執行測試，確認所有測試通過。
- **Refactor (重構)**: 開發者檢查 test code 及 production code，並可以請求 AI 提出重構建議，但最終的修改權由開發者掌握。

## AI 協作的 TDD 模式與詠唱原則

### 精準詠唱的 C.R.I.S. 原則

- **Context (上下文)**: 提供充足的背景資訊 (選取程式碼、開啟相關檔案)。
- **Role (角色)**: 給 AI 分配一個專家角色。
- **Instruction (指令)**: 給出清晰、明確、帶有限制的指令。
- **Shot (範例)**: 給 AI 一個參考範例 (One-Shot Learning)。

這個模式確保了我們始終遵循 TDD 的核心紀律，同時在每一步都利用 AI 來提升效率。
坐而言不如起而行，接下來就透過 「TDD 來寫個密碼驗證器」

## 實戰演練： 開發一個「密碼驗證器」Kata

我們來建立一個新的套件 `password`，可以先建立 password/password.go 和 password/password_test.go 兩個空檔案。

### 第一步：Goal (目標) - 需求發想與拆解

我們的第一個需求是：「密碼長度必須至少為 8 個字元」。

根據這個需求，我們可以發想出幾個測試案例 (Test Case)：

#### 失敗案例 (不滿足條件)

- 密碼為 "1234567" (7個字元) -> 應回傳 false 和一個錯誤。
- 密碼為 "" (空字串) -> 應回傳 false 和一個錯誤。

#### 成功案例 (滿足條件)

- 密碼為 "12345678" (正好8個字元) -> 應回傳 true 和 nil 錯誤。

TDD 的精髓是小步快跑，我們選擇第一個失敗案例作為起點。

### 第二步：Prompt for Test (詠唱-測試) -> 點亮紅燈

我們打開空的 password_test.go 檔案，然後對 Copilot 下我們的第一個指令。

#### Prompt 詠唱

```markdown
- **角色**: 你是一位資深的 Golang TDD 專家。
- **上下文**: 我正在 password 套件中，需要為一個名為 Validate(password string) (bool, error) 的函式編寫測試。
- **指令**: 請為我生成一個表格驅動的單元測試。現在，只需要包含一個測試案例：驗證當密碼長度少於8個字元時（例如 "123"），Validate 函式應回傳 false 和一個內容為 "password is too short" 的錯誤。
- **限制**: 只生成測試程式碼，不要生成 Validate 函式的任何實作，且測試工具使用 `testify`。
```

Copilot Chat 可能會生成如下的測試程式碼：

```golang
// copilot 可能會產出的 code
// password/password_test.go
package gopasswordverify

import (
    "testing"

    "github.com/stretchr/testify/assert"
)

func TestValidate(t *testing.T) {
    tests := []struct {
        name          string
        password      string
        expectedValid bool
        expectedError string
    }{
        {
            name:          "password too short",
            password:      "123",
            expectedValid: false,
            expectedError: "password is too short",
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            valid, err := Validate(tt.password)

            assert.Equal(t, tt.expectedValid, valid)

            if tt.expectedError != "" {
                assert.Error(t, err)
                assert.Equal(t, tt.expectedError, err.Error())
            } else {
                assert.NoError(t, err)
            }
        })
    }
}

```

同時，我們需要在 password.go 補上一個空的函式簽名，以避免編譯錯誤：

```golang
// 手動建立空函式
// password/password.go
package password

func Validate(password string) (bool, error) {
    return true, nil 
}
```

執行 `go test -v ./...`，我們如願以償地看到了紅燈！require.Error(t, err) 失敗了，因為我們回傳的是 nil 錯誤。

### 第三步：Prompt for Implementation (詠唱-實作) -> 轉為綠燈

#### Prompt 詠唱

我們已經有了一個清晰的、失敗的測試。現在，我們再次召喚 Copilot Chat。

```markdown
- **上下文**: (開啟 password.go 和 password_test.go 兩個檔案，讓 Copilot 知道全局)
- **指令**: 我的測試 `TestValidate` 失敗了，錯誤是測試期望一個 error 但得到 `nil`， 請修改 password.go 中的 Validate 函式，只編寫最少的程式碼，來讓這個測試通過。
```

Copilot 分析了測試案例後：

```golang
// copilot 可能會產出的 ocde
// password/password.go
package password

import (
    "errors"
    "fmt" // Copilot可能會選擇用 fmt.Errorf
)

func Validate(password string) (bool, error) {
    if len(password) < 8 {
        return false, errors.New("password is too short")
    }

    return true, nil
}
```

再次執行 `go test -v ./...`，綠燈亮起！第一個 TDD 循環完成。

### 第四步：繼續循環，疊加功能

#### 課後練習題

現在，我們想新增以下幾項需求

- 密碼必須包含至少一個數字
- 密碼必須至少含有一個大寫英文字母

相信透過重複以上循環，我們可以快速、安全地完成所有需求 (這部分就先留給各位讀者大大啦，讓你們也享受一下當老闆的感覺 ~~~)

## 今日總結

今天我們將理論與實踐相結合，完成了一次從零到一的 AI 協作 TDD 演練。

- 我們學會了如何將需求拆解為微小的測試案例。
- 我們實踐了 **G-P-T-R 模式**，讓 AI 在 TDD 的每一個步驟中都扮演了精準的「工具人」角色，而主導權始終在我們手中。
- 我們運用 **C.R.I.S. 原則**，特別是帶有限制的指令，成功地引導 AI 遵循了 TDD 的紀律。

現在，你已經不僅僅是 TDD 的實踐者，更是懂得如何利用 AI 將 TDD 效率最大化的「新世代開發者」。

新預告：Day 19 - AI 輔助重構與測試覆蓋 - 讓 AI 成為你的程式碼審查員  
今天我們讓 AI 幫我們寫程式碼，明天我們就讓 AI 幫我們「挑刺」，我們預期利用 AI 快速發現程式碼中的壞味道、提出重構建議，並利用它窮舉式的思維，幫助我們找到測試案例中可能遺漏的邊界條件，以達到更高的測試覆蓋率。
