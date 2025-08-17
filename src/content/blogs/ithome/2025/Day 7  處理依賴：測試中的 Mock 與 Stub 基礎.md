---
title: "Day 7 - 處理依賴：測試中的 Mock 與 Stub 基礎"
datetime: "2025-08-10"
description: "在 Day 7，我們將學習如何處理測試中的外部依賴，使用 Mock 和 Stub 來隔離測試環境，確保我們的單元測試能夠專注於商業邏輯，而不受外部因素影響。掌握這些技巧後，你將能夠撰寫更穩定、更可靠的測試案例。"
image: "/images/titles/golang-header.jpg"
parent: "2025 ithome-鐵人賽: 從 0 到 1：與 AI 協作的 Golang TDD 實戰 系列"
---


## 昨日回顧與今日目標

在 Day 6，我們透過「表格驅動測試」掌握了組織和擴充測試案例的強大模式。到目前為止，我們測試的 Add 函式是一個美好的「純函式」——沒有任何外部依賴，就像是在無塵室裡做實驗。

然而，現實很骨感，真正的軟體是複雜且相互關聯的，我們的程式碼需要跟資料庫溝通、呼叫遠端 API、讀寫檔案、或發送訊息到佇列，這些外部依賴，是單元測試 (Unit Test) 的天敵。

### Why 為什麼？

一個單元測試的核心目標是「在隔離的環境下，快速驗證一個小單元 (unit) 的商業邏輯是否正確」，如果測試一個簡單的函式，卻需要： 

- 啟動一個真的資料庫？ -> 測試會變慢！
- 依賴網路連線到一個外部 API？ -> 測試會不穩定 (Flaky)！
- 每次測試都真的寄送一封 Email？ -> 會產生不必要的副作用！

這就不是單元測試了，而是整合測試 (Integration Test)。

> 今天的目標：學習 TDD 中最關鍵的技巧之一 : 使用「測試替身」(Test Doubles) 來切斷外部依賴，讓我們的測試回歸單元測試的本質，我們將聚焦於兩種最常見的測試替身：Stub 和 Mock。

## 測試替身 (Test Doubles)

就像電影中，危險的動作會由「替身演員」(Stunt Double) 來完成一樣，在測試中，我們也會用一個「假的」物件來替換掉那些「昂貴」或「不穩定」的真實依賴，這就是「測試替身」。

我們將利用在 Day 3 學到的「介面」魔法來實現這一點。

### Stub (存根)：提供「罐頭答案」的替身

> Stub 的核心職責： 在測試期間，提供一個固定的、可預測的「罐頭」回傳值。

我們使用 Stub 是為了**驗證狀態 (State Verification)**，也就是說，我們不關心 Stub 內部發生了什麼，只關心我們的被測函式在「拿到 Stub 給的答案後」，是否產生了我們預期的結果。

接著假設我們要寫一個 GetWelcomeMessage 函式，它需要從資料庫裡根據使用者 ID 取得使用者名稱。

#### 第一步：定義依賴的「合約」(Interface)

```golang
// user_repository.go
type User struct {
    ID   string
    Name string
}

// UserDatabase 是我們的依賴介面
type IUserRepository interface {
    GetUser(id string) (User, error)
}
```

#### 第二步：被測函式依賴於「介面」

```golang
// greeter.go
import "fmt"

type Greeter struct {
    db IUserRepository // 依賴介面！
}

func (g *Greeter) GetWelcomeMessage(userID string) (string, error) {
    user, err := g.db.GetUser(userID) // 呼叫介面的方法
    if err != nil {
        return "", err
    }
    return fmt.Sprintf("Welcome, %s!", user.Name), nil
}
```

#### 第三步：建立 Stub 並進行測試

```golang
// greeter_test.go

import (
    "testing"
    "github.com/stretchr/testify/assert"
)

// StubUserRepository 只為了測試而存在
type StubUserRepository struct{}

// 讓 Stub 實現介面，並回傳一個固定的「罐頭答案」
func (s StubUserRepository) GetUser(id string) (User, error) {
    // 無論輸入什麼 id，都回傳同一個使用者
    return User{ID: "123", Name: "John"}, nil
}

func TestGreeter_GetWelcomeMessage_WithStub(t *testing.T) {
    // 建立一個 Stub 實例
    stub := StubUserRepository{}
    // 將 Stub 注入到我們的 Greeter 中
    greeter := Greeter{db: stub}

    // 執行被測函式
    message, err := greeter.GetWelcomeMessage("any-id")

    // 驗證狀態：我們關心的是最終產生的 message 是否正確
    assert.NoError(t, err)
    assert.Equal(t, "Welcome, John!", message)
}
```

在這個測試中，我們完全不需要一個真的資料庫，Stub 替我們扮演了資料庫的角色，並給出了一個我們預設好的答案。

### Mock (模擬物件)：監視「互動行為」的間諜

> Mock 的核心職責： 驗證被測物件是否以預期的方式與其依賴進行了「互動」（呼叫）。

我們使用 Mock 是為了 **驗證行為 (Behavior Verification)**。 也就是說，我們不僅關心結果，更關心「過程中，被測函式有沒有呼叫我指定的函式」、「呼叫時傳的參數對不對」、「呼叫了幾次」。

接著我們來假設 `Greeter` 在打招呼後，還需要呼叫一個 logging 服務來記錄這次活動。

#### 第一步：定義 LogService 介面

```golang
type ILogService interface {
    Log(message string)
}
```

#### 第二步：修改 Greeter，讓它依賴 LogService

```golang
type Greeter struct {
    db  IUserRepository
    log ILogService // 新增依賴
}

func (g *Greeter) GetWelcomeMessage(userId string) (string, error) {
    ser, err := g.db.GetUser(userId)
    if err != nil {
        return "", err
    }

    message := fmt.Sprintf("Welcome, %s!", user.Name)
    g.log.Log(fmt.Sprintf("Welcomed user %s", userId)) // 呼叫 logging 服務
    return message, nil
}
```

#### 第三步：建立 Mock 並進行測試

```golang
// MockLogService 是一個間諜
type MockLogService struct {
    IsLogged bool
    Message  string
}

// 讓 Mock 實現介面
func (m *MockLogService) Log(message string) {
    m.IsLogged = true
    m.Message = message
}

func TestGreeter_LogsActivity(t *testing.T) {
    // 建立 Stub 和 Mock
    stubDb := StubUserRepository{}
    mockLog := &MockLogService{} // 注意用指標，這樣才能修改它裡面的值
    greeter := Greeter{db: stubDb, log: mockLog}

    // 執行
    greeter.GetWelcomeMessage("user-456")

    // 驗證行為：我們關心的是 Mock 物件的狀態
    assert.True(t, mockLog.IsLogged)
    assert.Equal(t, "Welcome user: user-456", mockLog.Message)
}
```

在這個測試中，我們的斷言是針對 mockLog 這個「間諜」本身。我們檢查它是否完成了我們期望它完成的任務。

## 小結：Stub vs. Mock

| 特性 | Stub (存根) | Mock (模擬物件) |
|------|-------------|-----------------|
| 目的 | 提供測試所需的「狀態」 | 驗證與依賴之間的「行為」 |
| 驗證類型 | 狀態驗證 (State Verification) | 行為驗證 (Behavior Verification) |
| 測試斷言 | 斷言被測物件的最終狀態或回傳值 | 斷言Mock 物件本身的方法是否被正確呼叫 |
| 比喻 | 提供「罐頭答案」的客服 | 監視「互動過程」的間諜 |

專業工具：stretchr/testify/mock
手動編寫 Mock 物件在學習階段非常有幫助，但在真實專案中會變得很繁瑣，所以 **testify** 套件提供了一個強大的 mock 工具，可以自動化這個過程。

```golang
// 這只是一個預覽，我們將在後續實戰中大量使用它
import "github.com/stretchr/testify/mock"

// 1. 定義 Mock 結構，嵌入 testify 的 Mock 物件
type MockRepository struct {
    mock.Mock
}

// 2. 讓它實現介面，方法內部呼叫 testify 的方法
func (m *MockRepository) GetUser(id string) (User, error) {
    args := m.Called(id)
    return args.Get(0).(User), args.Error(1)
q}

func TestWithTestifyMock(t *testing.T) {
    mockRepository := new(MockDatabase)
    // 設定預期：當 GetUser 被呼叫且參數為 "123" 時，
    // 回傳指定的 User 物件和 nil error。
    mockRepository.On("GetUser", "123").Return(User{ID: "123", Name: "Jane"}, nil)

    greeter := Greeter{db: mockRepository, log: &MockLogService{}}
    greeter.GetWelcomeMessage("123")

    // 驗證所有設定的預期行為都已發生
    mockDb.AssertExpectations(t)
}
```

`testify/mock` 讓我們能用更宣告式的方式來定義預期行為和回傳值，功能更強大，程式碼也更簡潔。

## 今日總結

今天:

- 我們了解 TDD 中最重要也最容易混淆的難關
- 我們理解了為何需要用測試替身來隔離外部依賴。
- 我們學會了Stub 和 Mock 的核心區別：Stub 提供狀態，Mock 驗證行為。
- 我們透過手動實作，再次鞏固了「依賴介面」的重要性。
- 我們初步見識了 testify/mock 工具的威力。

至此，我們 TDD中最重要的單元測試的「理論與工具基礎」階段已全部解述完畢，理論上我們已經擁有開始實戰所需的七成知識 (三成留給往後實際上戰場後學到的知識)！

預告：第二階段正式開啟！Day 8 - 專案啟動 - 設定我們的 Kata 專案結構 (Go Modules)
從明天開始，我們將開始建立一個真實的 Go Modules 專案，我們將透過經典的 TDD Kata，將這幾天學到的理論和工具，轉化為你指尖的肌肉記憶，準備好享受TDD吧!