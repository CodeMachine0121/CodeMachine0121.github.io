---
title: "Day 17 - 迎接 AI 隊友：設定 GitHub Copilot 的協作環境"
datetime: "2025-08-20"
description:  "正式邀請我們的 AI 隊友——GitHub Copilot——加入專案，並為我們的人機協作搭建好舞台。"
parent: "2025 ithome-鐵人賽: 從 0 到 1：與 AI 協作的 Golang TDD 實戰 系列"
image: "/images/titles/golang-space.jpg"
---
 

## 昨日回顧與今日目標

在 Day 16 的理性探討中，我們面對了 TDD 的適用邊界，我們認識到，TDD 雖是利器，卻非萬能的銀彈。

在過去的兩週裡，我們投入了大量精力來磨練手動 TDD 的技巧，我們體會了它的嚴謹、安全感，也感受到了它在編寫樣板程式碼和思考邊界條件時的繁瑣。

> 今天的目標：正式邀請我們的 AI 隊友——GitHub Copilot——加入專案，並為我們的人機協作搭建好舞台。


## 在 VS Code 中安裝並設定好 Copilot。

進行第一次互動，初步感受 AI「你的好同事」的威力。

## 你的 AI 好同事：GitHub Copilot

**GitHub Copilot** 不是一個簡單的自動補全工具。 傳統的自動補全（IntelliSense）是基於你專案中的語法和程式碼結構來提供建議，而 Copilot 則是由 OpenAI 開發的一個強大的大型語言模型 (LLM)，它學習了 GitHub 上數十億行的開源程式碼。

這意味著它不僅僅理解「語法」，它在一定程度上還理解「意圖」:

- 它可以根據你的函式名稱和註解，直接生成整個函式的實現。
- 它可以根據你正在編寫的測試案例，推斷出你接下來可能想寫的程式碼。
- 它可以幫你完成重複性的樣板程式碼。
- 它甚至可以為你的程式碼提出建議或解釋含義。

它就像一個坐在你身邊，知識淵博、不知疲倦、但偶爾會犯錯的結對程式設計夥伴。我們的目標，就是學會如何引導它、利用它，來極大地加速我們的 TDD 流程。

### 步驟一：訂閱與授權

要使用 GitHub Copilot，你需要一個 GitHub 帳號，並啟用 Copilot 的訂閱服務 (掏錢囉)。

付款方式分成幾種:

- 開始免費試用： Copilot 提供免費試用期（通常為 30 天），你需要授權 Copilot 存取你的 GitHub 帳號並綁定一個付款方式（試用期結束後才會收費）。
- 學生福利： 如果你是經過驗證的學生，恭喜你！你可以透過 GitHub 學生開發者套件 (Student Developer Pack) 免費使用 Copilot。

### 步驟二：在 VS Code 中安裝 Copilot

一旦你的 GitHub 帳號擁有了 Copilot 的使用權限，在 VS Code 中安裝它就非常簡單了。
打開 VS Code，點擊左側邊欄的「擴充套件 (Extensions)」圖示，在搜尋框中輸入 GitHub Copilot。
你會看到幾個由 GitHub 官方發布的擴充套件。我們需要安裝兩個核心的：

- GitHub Copilot: 這是提供程式碼建議的核心。
- GitHub Copilot Chat: 這提供了一個聊天介面，讓你可以用自然語言與 Copilot 對話、提問、解釋程式碼等。

當你在 VS Code 右下角的狀態列看到一個正常的 Copilot 圖示（一個小小的機器人頭像）時，就代表你的 AI 隊友已經準備就緒了！

### 步驟三：第一次親密接觸 - 讓 Copilot 為我們工作

讓我們回到 go-tdd-kata 專案，體驗一下 Copilot 的魔力。

#### 用註解生成程式碼。

在專案中建立一個臨時的練習檔案，例如 playground/hello_ai.go。
在檔案中，輸入以下這行註解，然後按下 Enter：

```golang
// Create a function that takes a name as a parameter and returns a greeting message.
```

稍等片刻（有時需要一兩秒），你會看到 Copilot 以灰色的字體，自動為你提示了接下來的程式碼！

```golang
// Create a function that takes a name as a parameter and returns a greeting message.
func Greet(name string) string {
    return "Hello, " + name + "!"
}
```

（灰色部分為 Copilot 的建議，每個人不同時間會有不同）

此刻，你有幾個選擇：

- 按下 Tab 鍵：接受這個建議，灰色的程式碼會立刻變成你檔案的正式內容。
- 按下 Esc 鍵：拒絕這個建議，灰色程式碼會消失。

這就是與 Copilot 互動最基本的方式。它會在你編寫程式碼時，根據上下文不斷地提供建議。

#### Copilot Chat：

選取你剛剛生成的 Greet 函式。
按下 Ctrl+I (Windows/Linux) 或 Cmd+I (macOS)，這會彈出一個內聯的聊天視窗，或是 ctrl+shift+p(Windows/Linux) 或 Cmd+shift+p(macos) 後搜尋: `Chat: Focus on Chat View`。

在輸入框中輸入 `/tests`，然後按 Enter，此時 Copilot Chat 會立刻分析你選取的函式，並在幾秒鐘內為它生成一個完整的、使用表格驅動模式的單元測試！

```golang
// Copilot Chat 可能生成的測試程式碼
func TestGreet(t *testing.T) {
    type args struct {
        name string
    }
    tests := []struct {
        name string
        args args
        want string
    }{
        {
            name: "Test with a regular name",
            args: args{name: "World"},
            want: "Hello, World!",
        },
        {
            name: "Test with an empty name",
            args: args{name: ""},
            want: "Hello, !",
        },
    }
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            if got := Greet(tt.args.name); got != tt.want {
                t.Errorf("Greet() = %v, want %v", got, tt.want)
            }
        })
    }
}
```

看到這裡，你是否已經開始其他與AI共舞的想法呢？ 回想一下我們之前手動編寫測試表格的過程，再看看 AI 在幾秒鐘內完成的工作，這就是我們下一階段將要深入探索的效率革命。

## 今日總結

今天，我們成功地使用我們的 AI，為 TDD 開發流程的下一次進化做好了準備。

- 了解 GitHub Copilot 是基於大型語言模型、理解程式碼「意圖」的 AI 結對程式設計夥伴。
- 在 VS Code 中完成了 Copilot 和 Copilot Chat 的安裝與設定。
- 透過註解生成程式碼和聊天生成測試的初體驗，親眼見證了 AI 賦能開發的巨大潛力。

預告：Day 18 - AI 詠唱術 (Prompt Engineering) - 如何下達讓 AI 理解 TDD 的指令

擁有強大的工具，還需要學會如何使用它。直接讓 AI 寫程式碼，與引導 AI 遵循 TDD 的流程，是完全不同的兩件事。明天，我們將學習一些基本的「AI 詠唱術」（即 Prompt Engineering），探討如何下達精準的指令，讓 AI 能夠理解我們的 TDD 意圖，成為我們 TDD 流程中的得力助手，而不是一個只會寫產品程式碼的「破壞者」。