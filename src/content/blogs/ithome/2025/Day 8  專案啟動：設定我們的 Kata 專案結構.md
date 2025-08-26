---
title: "Day 8 專案啟動：設定我們的 Kata 專案結構"
datetime: "2025-08-11"
description: "在 Day 8，我們將建立一個結構清晰、可擴充的 Go Modules 專案，為我們的 TDD Kata 練習做好準備。這個專案將成為我們未來所有 Kata 練習的家。"
parent: "2025 ithome-鐵人賽: 從 0 到 1：與 AI 協作的 Golang TDD 實戰 系列"
image: "/images/titles/golang-worker.png"
---

## 昨日回顧與今日目標

在過去的七天裡，我們共同建立了一個堅實的理論與工具基礎，從 TDD 的「紅-綠-重構」心法，到 Go 語言的測試利器 go test，再到處理依賴關係的工具——介面與 Mocks，目前我們已經擁有了開始 TDD 實戰所需的所有知識。

今天，我們將正式開啟本系列最核心的第二階段： **TDD Kata**。

## 什麼是 Kata？

Kata（日語「形」）源自武術，指一系列固定招式的「套路練習」，在程式設計領域，TDD Kata 意味著透過反覆練習一個小而定義明確的程式設計問題，將 TDD 的思考流程和開發節奏，內化為我們的肌肉記憶。

我們的第一個 Kata 將是經典的 FizzBuzz。但在動手寫程式碼之前，我們必須先搭建好我們的「道場」。

> 今天的目標：建立一個結構清晰、可擴充的 Go Modules 專案，它將是我們未來所有 Kata 練習的家。

## 步驟一：建立專案根目錄

首先，在你的電腦上找一個合適的位置，建立一個新的專案資料夾，我們就叫它 go-tdd-kata 好了。

```bash
mkdir go-tdd-kata
cd go-tdd-kata
```

然後，使用你熟悉的IDE打開這個全新的空資料夾。

## 步驟二：初始化 Go Modules

從 Go 1.11 版本開始，Modules（模組）成為了官方推薦的依賴管理系統，它可以幫我們管理專案中用到的第三方套件（例如我們之前學到的 testify）。

在專案的根目錄 (go-tdd-kata) 下，打開 terminal，執行以下指令：

```bash
go mod init go-tdd-kata
```

### 這個指令做了什麼？

```go mod init``` 會初始化一個新的 Go 模組，go-tdd-kata 是我們給這個模組起的名字，在實際的開源專案中，這裡通常會使用像是 github.com/your-username/go-tdd-kata 這樣的路徑，以確保全域唯一，但對於本地練習，一個簡單的名字就足夠了。

執行完畢後，你會發現資料夾裡多了一個新檔案：`go.mod`。

> go.mod 檔案：這個檔案定義了我們的模組路徑、所使用的 Go 版本，並會在未來記錄我們所有的直接依賴。

他看起來會像這樣:

```text
module go-tdd-kata

go 1.24.5
```

## 步驟三：規劃專案目錄結構

一個好的專案結構能讓程式碼的職責分明，易於導航和維護。我們將採用一個簡單且符合 Go 語言慣例的結構，將每個 Kata 練習放在它自己的套件 (package) 中。

請在 go-tdd-kata 根目錄下，建立以下資料夾和檔案：

``` text
go-tdd-kata/
├── go.mod
├── fizzbuzz/
│   ├── fizzbuzz.go      # FizzBuzz 的產品程式碼將會寫在這裡
│   └── fizzbuzz_test.go # FizzBuzz 的測試程式碼將會寫在這裡
└── main.go              # 一個可選的程式進入點，用於未來可能的整合
```

- `fizzbuzz/`: 這是一個獨立的 package。將相關的產品程式碼和測試程式碼放在同一個資料夾下，是 Go 的標準做法。
- `main.go`: 這個檔案代表如果我們的 go-tdd-kata 是一個可以執行的應用程式，那麼程式的起點就在這裡。目前我們可以先讓它空著，或者放一個簡單的 main 函式。

## 步驟四：填充佔位程式碼並進行首次測試

為了確保我們的結構是正確的，讓我們在剛建立的檔案中填充一些最基本的程式碼。

### 1. 填充 fizzbuzz/fizzbuzz.go

```golang
// fizzbuzz/fizzbuzz.go
package fizzbuzz
// Generate 是一個佔位函式，我們將透過 TDD 來實現它
func Generate(number int) string {
    return ""
}
```

**注意：** 檔案的第一行是 `package fizzbuzz`，這宣告了它屬於我們剛剛建立的 `fizzbuzz` 套件。

### 2. 填充 `fizzbuzz/fizzbuzz_test.go`

```go
// fizzbuzz/fizzbuzz_test.go
package fizzbuzz

import "testing"

func TestFizzBuzzGenerator(t *testing.T) {
    // 這裡我們先留白，下一天才會寫下第一個失敗的測試
}
```

### 3. 執行全專案測試

現在，回到專案的根目錄 (go-tdd-kata)，在終端機執行一個新的測試指令：

```bash
go test ./...
```

#### ./... 是什麼意思？

這是 Go 工具鏈的一個通配符，意思是「測試當前目錄以及所有子目錄下的所有套件」，這是一個非常有用的指令，當你的專案變大時，可以用它來執行一次全專案的回歸測試。
執行後，你應該會看到類似的輸出：

```text
?       go-tdd-kata [no test files]
ok      go-tdd-kata/fizzbuzz    0.314s
```

第一行的 ? 表示根目錄 go-tdd-kata 本身沒有測試檔案，這很正常。
第二行的 ok 表示 fizzbuzz 套件下的所有測試（雖然目前是空的）都通過了。
看到這個輸出，就代表我們的專案「道場」已經成功搭建完畢！

## 今日總結

今天我們沒有寫太多程式碼，但完成了至關重要的一步，我們從一個空資料夾開始，建立了一個：

- 使用 Go Modules 進行依賴管理的標準專案。
- 擁有清晰、可擴充的套件式目錄結構。
- 並驗證了整個結構可以被 Go 的測試工具正確識別。

我們的舞台已經搭好，演員也已就位。
預告：Day 9 - Kata 演練：FizzBuzz (一) - 寫下第一個失敗的測試 (紅燈)
明天，我們將正式開始我們的第一個 TDD Kata 練習。我們將完全遵循 TDD 的節奏，從最小的需求出發，為 FizzBuzz 問題寫下第一個 **「注定會失敗」** 的測試。