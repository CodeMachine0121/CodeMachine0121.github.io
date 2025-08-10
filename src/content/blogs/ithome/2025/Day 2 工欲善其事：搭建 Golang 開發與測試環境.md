# Day 2 - 工欲善其事：搭建 Golang 開發與測試環境

## 昨日回顧與今日目標

在 Day 1，我們了解 TDD「紅燈-綠燈-重構」的核心思想，並建立起「TDD 是為了更快地交付高品質軟體」的正確心態。理論的種子已經播下，今天，我們就要來為後續的實作做好萬全準備 ( 俗稱 setup 環境) 。

俗話說：「工欲善其事，必先利其器」。一個順暢、高效的開發環境，能讓我們專注於 TDD 的思考流程，而不是被工具問題搞得焦頭爛額。

- 今天的目標非常明確：
  - 安裝 Go 語言。
  - 安裝並設定 Visual Studio Code (VS Code)。
  - 安裝必要的 Go 擴充套件與工具。
  - 寫下第一個測試，驗證環境一切就緒！

## 步驟一：安裝 Go 語言

Go (或稱 Golang) 是由 Google 開發的一門靜態強型別、編譯型、併發型，並具有垃圾回收功能的程式語言。它的簡潔、高效能以及內建強大的測試工具，使其成為實踐 TDD 的絕佳選擇。

### 前往官網下載

首先，前往 Golang 的官方[下載頁面](https://go.dev/doc/install)

找一下符合自己的作業系統（Windows, macOS, Linux），並下載對應的安裝包。

### 進行安裝

- Windows: 下載 .msi 安裝包後，像安裝普通軟體一樣，打開並不斷「下一步」即可。安裝程式會自動幫你設定好環境變數。
- macOS: 下載 .pkg 安裝包後，同樣雙擊並按照提示完成安裝。
- Linux: 你可以下載 .tar.gz 壓縮檔，並將其解壓縮到 /usr/local 目錄。

### 驗證安裝

安裝完成後，打開你的終端機 (Terminal) 或命令提示字元 (Command Prompt)，輸入以下指令：

`go version`

如果你看到類似 go version xxxx  windows/amd64 的輸出訊息（版本號可能不同），那就代表 Go 語言已經成功安裝在你的電腦上了！

安裝程式會幫我們設定好 GOROOT (Go 的安裝路徑) 和 GOPATH (Go 的工作區路徑) 等環境變數 (Linux/Mac 用戶可能需要另外在 .bashrc 裡面進行變數設定)。

## 步驟二：安裝你的開發工具 - Visual Studio Code

VS Code 是由微軟開發的免費、開源且功能強大的編輯器，憑藉其豐富的擴充套件生態，成為了 Go 開發社群的主流選擇。

- 前往官網下載並安裝
    請至 VS Code [官方網站](https://code.visualstudio.com/)下載對應你作業系統的版本並安裝。
    安裝過程非常直觀，此處不再贅述。

## 步驟三：為 VS Code 注入 Go 的靈魂

剛安裝好的 VS Code 還只是一個通用的文字編輯器，我們需要為它安裝 Go 專屬的擴充套件，讓它「學會」如何理解並輔助我們撰寫 Go 程式碼。
AI 套件的部分就選擇自己喜歡的就好了。

### 安裝 Go 官方擴充套件，以下是我自己開發時候會安裝的幾個套件

1. Go
2. Golang postfix code completion
3. Golang Snippets
4. Golang Tools
5. GitLens
6. Github Copilot
7. Github Copilot Chat
8. vim (很吃受眾，所以看個人)

### 安裝 Go 開發工具集

光有擴充套件還不夠，它還需要一系列的底層命令列工具來提供程式碼自動完成、格式化、錯誤檢查等功能。幸運的是，這個過程非常簡單。

按下 Ctrl+Shift+P (Windows/Linux) 或 Cmd+Shift+P (macOS) 打開命令面板，輸入 `Go: Install/Update Tools` 並按 Enter，接著會在下方的「OUTPUT」視窗中開始自動下載並安裝 **gopls (語言伺服器)** 、 **go-outline (大綱視圖工具)**、 **goimports (自動整理 import)** 等幾個工具。

當你看到所有工具後面都顯示 succeeded 時，就代表我們的開發環境已經是完全體了！

## 步驟四：Hello, Test! - 驗證你的開發環境

讓我們來寫下第一行測試程式碼，確保所有工具都正常協同工作。

### 建立專案資料夾

在你的電腦上找個自己喜歡的地方，建立一個新的資料夾，然後用 VS Code 打開這個資料夾 ( 喜歡的人可以用 terminal cd 進該資料夾後，輸入 `code .` 來來開啟 vscode。

### 初始化專案

透過 terminal 進入到專案資料夾後，使用輸入: `go mod init day2` 來初始化 Golang 專案，當然 day2 可以替換成自己喜歡的名字。  

> 在 Golang 專案中先執行 `go mod init` 是因為 Go 使用 模組系統 (Go Modules) 來管理依賴關係和專案結構，簡單來說就像是向 Golang 宣告當前模組的名字。

- 建立你的第一個 Go 測試檔: 新增一個檔案，並將其命名為 hello_test.go。

> 在 Go 語言中，測試檔案的命名必須以_test.go 結尾。這是 Go 測試工具識別測試檔案的約定。

### 撰寫測試程式碼

```golang
package main

import (
    "testing"
)

func TestHelloEnvironment(t *testing.T) {
    t.Log("恭喜！您的 Go TDD 環境已準備就緒！")
}
```

聰明的你會注意到，當你儲存檔案時，`import ("testing")` 應該會被自動加入，這就是我們剛剛安裝的 **goimports** 工具在發揮作用。

### 執行測試

現在，你有兩種簡單的方式可以執行這個測試：

- UI執行： 在 func TestHelloEnvironment... 這一行的上方，你會看到一個「run test」按鈕。直接點擊它。

- 指令執行： 在 terminal 輸入 `go test`

### 驗證結果

無論使用哪種方式，你都應該會在終端機或輸出視窗看到 PASS 這個詞，就代表你的 Go 編譯器、go test 指令、VS Code 編輯器和所有擴充套件都已經正確安裝並協同工作了！

## 今日總結

今天我們從零開始，成功搭建了 Golang 開發與測試環境。一個好的開始是成功的一半，你已經為接下來的 TDD 實戰鋪平了道路。

預告：Day 3 - Golang 語法速成 - 打造「可測試」的函式、結構與介面
明天，我們將正式進入 Golang 的世界。主要會聚焦於那些與「可測試性」最息息相關的核心語法：函式、結構體 (Structs) 和介面 (Interfaces)，學習如何從一開始就寫出易於測試的程式碼。