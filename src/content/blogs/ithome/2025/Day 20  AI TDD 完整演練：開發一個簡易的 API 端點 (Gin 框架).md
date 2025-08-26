---
title: "Day 20 - AI TDD 完整演練：開發一個簡易的 API 端點 (Gin 框架)"
datetime: "2025-08-22"
description:  "進行一次迄今為止最真實的 AI TDD 實戰演練！我們將使用流行的 Gin 框架，從零開始，完整地開發一個簡單的 HTTP API 端點。"
parent: "2025 ithome-鐵人賽: 從 0 到 1：與 AI 協作的 Golang TDD 實戰 系列"
image: "/images/titles/golang-gin.webp"
---

## 昨日回顧與今日目標

在 Day 19，我們將 AI 的協作能力提升到了一個新的層次，我們不僅讓它生成程式碼，更讓它扮演了 Code Reviewer 和 QA 的角色，幫助我們重構程式碼、補完邊界案例。

到目前為止，我們的所有練習都還停留在純粹的函式邏輯層面。但是，後端開發的現實中，更多的是與框架、API 請求、JSON、狀態碼打交道。

> 今天的目標：進行一次迄今為止最真實的 AI TDD 實戰演練！我們將使用流行的 Gin 框架，從零開始，完整地開發一個簡單的 HTTP API 端點。

以下就直接進入我們的實作部分

## 功能

- 接收一個查詢參數 name (e.g., `/v1/greet?name=World`)。
- 如果 name 存在，回傳 `200 OK` 和 JSON `{ "message": "Hello, World" }`。
- 如果 name 缺失，回傳 `400 Bad Request` 和 JSON `{ "error": "name is required" }`。

## 第零步: 安裝 Gin

- 新增資料夾 `go-tdd-gin` 作為專案跟目錄
- 在專案根目錄下，執行指令安裝 Gin 及測試框架

```bash
go get github.com/gin-gonic/gin
go get github.com/stretchr/testify 
```

- 建立 `handler.go` 和 `handler_test.go` 兩個檔案。

## 第一步：Goal & Prompt for Test -> 直達紅燈

我們的第一個目標： 測試當 `name` 參數缺失時，API 是否如期回傳 400 錯誤。
在 Go 中測試 HTTP Handler，我們不需要真的啟動一個伺服器，我們可以使用 `net/http/httptest` 套件來建立一個模擬的 HTTP 請求和一個用於記錄回應的 ResponseRecorder。

### 詠唱術

打開空的 `api/handler_test.go`，然後對 Copilot Chat 下達指令：

```markdown
**(角色)** 你是一位精通 Golang Gin 框架和 TDD 的專家。
**(上下文)** 我正在 api 套件中，需要測試一個 Gin 的 Handler GreetHandler。
**(指令)** 請為我生成一個單元測試。這個測試需要驗證：當我們發送一個 GET 請求到 /v1/greet 且沒有提供 name 查詢參數時，HTTP 回應的狀態碼應該是 400 Bad Request，並且回應的 JSON body 應該是 {"error":"name is required"}。
**(限制)** 請使用 net/http/httptest 來建立請求和回應記錄器，只生成測試程式碼(assert 部分請使用 testify/assert)。
```

### AI 可能會生成如下的程式碼(紅燈)

```golang
// api/handler_test.go
package apis

import (
    "net/http"
    "net/http/httptest"
    "testing"

    "github.com/gin-gonic/gin"
    "github.com/stretchr/testify/assert"
)

func TestGreetHandler_MissingNameParameter_ShouldReturnBadRequest(t *testing.T) {
    // Arrange
    gin.SetMode(gin.TestMode)
    router := gin.New()
    router.GET("/v1/greet", GreetHandler)

    // Create a request without the name query parameter
    req, err := http.NewRequest("GET", "/v1/greet", nil)
    assert.NoError(t, err)

    // Create a ResponseRecorder to record the response
    recorder := httptest.NewRecorder()

    // Act
    router.ServeHTTP(recorder, req)

    // Assert
    assert.Equal(t, http.StatusBadRequest, recorder.Code)
    assert.Equal(t, `{"error":"name is required"}`, recorder.Body.String())
    assert.Equal(t, "application/json; charset=utf-8", recorder.Header().Get("Content-Type"))
}
```

同時，在 api/handler.go 中放入一個空的 Handler 以通過編譯：

```golang
// api/handler.go
package api

import (
    "net/http"
    "github.com/gin-gonic/gin"
)

func GreetHandler(c *gin.Context) {
    // 留空，預設會回傳 200 OK
}
```

執行 `go test -v ./...`，紅燈亮起！狀態碼 assert 失敗 (expected: 400, actual: 200)，JSON body assert也失敗。

## 第二步：Prompt for Implementation -> 轉為綠燈

目標非常清晰。我們再次召喚 Copilot Chat。

### Prompt 詠唱

```markdown
**(上下文)** (開啟 handler.go 和 handler_test.go)
**(指令)** 我的測試 `TestGreetHandler_MissingName` 失敗了。請修改 GreetHandler 函式，讓它能夠檢查 name 查詢參數。如果參數不存在，就回傳 400 狀態碼和 {"error":"name is required"} 的 JSON。
```

### AI 可能會生成如下的程式碼(綠燈)

```golang
// api/handler.go
package api

import (
    "net/http"
    "github.com/gin-gonic/gin"
)

func GreetHandler(c *gin.Context) {
    // 獲取查詢參數
    name := c.Query("name")

    // 檢查參數是否存在
    if name == "" {
        c.JSON(http.StatusBadRequest, gin.H{"error": "name is required"})
        return // 記得 return 來中止執行
    }
}
```

再次執行 `go test -v ./...`，綠燈！第一個測試循環完成！

## 第三步：疊加成功路徑的測試

現在我們來做一個 TDD循環的正常流程。

### Goal

測試當提供了 name 參數時，API 是否回傳 200 和正確的訊息。

### Prompt for Test

給予 prompt

```markdown
"很好，現在請為我再寫一個測試 `TestGreetHandler_Success`，驗證當請求是`/v1/greet?name=Tester`時，狀態碼為 200，JSON body 為`{"message":"Hello, Tester"}`。"
```

### Test Fails (第二次紅燈)

#### copilot 輸出

```golang
func TestGreetHandler_Success(t *testing.T) {
    // Arrange
    gin.SetMode(gin.TestMode)
    router := gin.New()
    router.GET("/v1/greet", GreetHandler)

    // Create a request with the name query parameter
    req, err := http.NewRequest("GET", "/v1/greet?name=Tester", nil)
    assert.NoError(t, err)

    // Create a ResponseRecorder to record the response
    recorder := httptest.NewRecorder()

    // Act
    router.ServeHTTP(recorder, req)

    // Assert
    assert.Equal(t, http.StatusOK, recorder.Code)
    assert.Equal(t, `{"message":"Hello, Tester"}`, recorder.Body.String())
    assert.Equal(t, "application/json; charset=utf-8", recorder.Header().Get("Content-Type"))
}

```

執行 `go test -v ./...`，紅燈！，因為我們目前的 Handler 在 name 存在時什麼也沒做。

### Prompt for Implementation

給予 prompt：

```markdown
"我的新測試失敗了，請在 GreetHandler 中補完成功路徑的邏輯。"
```

### Test Pass (第二次綠燈)

AI 可能會輸出的 code

```golang
// api/handler.go
func GreetHandler(c *gin.Context) {
 name := c.Query("name")

 if name == "" {
  c.JSON(http.StatusBadRequest, gin.H{"error": "name is required"})
  return
 }
 
 // 新增的成功路徑
 c.JSON(http.StatusOK, gin.H{"message": "Hello, " + name})
}
```

再次執行測試，所有測試都通過了！

### Refactor

我們可以請求 AI 審查這段程式碼:

```markdown
"你覺得這個 Handler (production code 及 test code) 有沒有可以重構的地方？" 
```

#### AI 可能會告訴我們

``` markdown
測試代碼重構建議：
1. 消除重複代碼 (DRY 原則)
兩個測試中有很多重複的設置代碼，可以提取成輔助函數：

2. 使用表格驅動測試 (Table-Driven Tests)
可以將多個相似的測試用例組織成一個表格驅動的測試

3. 常數定義
將重複的字串定義為常數

Production 代碼重構建議：
1. 字串格式化
使用 fmt.Sprintf 取代字串連接

2. 常數定義
將錯誤訊息定義為常數

3. 分離關注點
將驗證邏輯分離出來
```

#### AI 重構後的 production code

``` golang
package apis

import (
    "fmt"
    "net/http"

    "github.com/gin-gonic/gin"
)

const (
    ErrNameRequired = "name is required"
    GreetingFormat  = "Hello, %s"
)

func GreetHandler(c *gin.Context) {
    name := c.Query("name")
    if name == "" {
        c.JSON(http.StatusBadRequest, gin.H{"error": ErrNameRequired})
        return
    }

    message := fmt.Sprintf(GreetingFormat, name)
    c.JSON(http.StatusOK, gin.H{"message": message})
}
```

#### AI 重構後的 test code

```golang
package apis

import (
    "fmt"
    "net/http"
    "net/http/httptest"
    "testing"

    "github.com/gin-gonic/gin"
    "github.com/stretchr/testify/assert"
)

const (
    testURL         = "/v1/greet"
    expectedJSON    = "application/json; charset=utf-8"
    errorResponse   = `{"error":"name is required"}`
    successResponse = `{"message":"Hello, %s"}`
)

// setupTestRouter 創建並配置測試用的 Gin router
func setupTestRouter() *gin.Engine {
    gin.SetMode(gin.TestMode)
    router := gin.New()
    router.GET(testURL, GreetHandler)
    return router
}

// performRequest 執行 HTTP 請求並返回 recorder
func performRequest(router *gin.Engine, method, url string) *httptest.ResponseRecorder {
    req, _ := http.NewRequest(method, url, nil)
    recorder := httptest.NewRecorder()
    router.ServeHTTP(recorder, req)
    return recorder
}

func TestGreetHandler_MissingNameParameter_ShouldReturnBadRequest(t *testing.T) {
    // Arrange
    router := setupTestRouter()

    // Act
    recorder := performRequest(router, "GET", testURL)

    // Assert
    assert.Equal(t, http.StatusBadRequest, recorder.Code)
    assert.Equal(t, errorResponse, recorder.Body.String())
    assert.Equal(t, expectedJSON, recorder.Header().Get("Content-Type"))
}

func TestGreetHandler_Success(t *testing.T) {
    // Arrange
    router := setupTestRouter()
    testName := "Tester"
    expectedResponse := fmt.Sprintf(successResponse, testName)

    // Act
    recorder := performRequest(router, "GET", testURL+"?name="+testName)

    // Assert
    assert.Equal(t, http.StatusOK, recorder.Code)
    assert.Equal(t, expectedResponse, recorder.Body.String())
    assert.Equal(t, expectedJSON, recorder.Header().Get("Content-Type"))
}
```

## 今日總結

今天我們用了一個最簡單的例子，體會了最貼近真實後端開發的 AI TDD 演練。

- 我們證明了，即使是涉及到框架、HTTP 請求/回應等複雜互動，TDD 流程依然完全適用。
- 我們學會了如何利用 httptest 來對 Gin Handler 進行快速的單元測試，避免了啟動真實伺服器的緩慢和不便。
- 我們將之前學到的所有 AI 協作技巧（生成測試、生成實作）應用於一個連貫的開發流程中，體驗到了效率的顯著提升。

AI 不僅能幫我們處理純粹的演算法邏輯，在處理框架的樣板程式碼時，它的優勢更加明顯。

預告：Day 21 - 人機協作的藝術 - 當 AI 的建議與你想法不同時
到目前為止，AI 似乎都非常聽話。但如果 AI 給出的重構建議我們不認同怎麼辦？如果它生成的程式碼風格與團隊規範不符怎麼辦？
