---
title: "Day 21 - 使用 AI 窮舉邊界：讓你的測試無懈可擊"
datetime: "2025-08-23"
description:  "學習如何利用 AI 的窮舉能力，扮演我們的「對抗性陪練」，幫助我們找到並測試那些容易被忽略的邊界條件。"
parent: "2025 ithome-鐵人賽: 從 0 到 1：與 AI 協作的 Golang TDD 實戰 系列"
image: "/images/titles/golang-boxer.jpg"
---

## 昨日回顧與今日目標

在 Day 20，我們完成了一次 AI TDD 實戰，從零開發了一個 Gin API 端點。我們證明了，即使在涉及框架和 HTTP 的場景下，**G-P-T-R 協作模式**依然行之有效，而我們所編寫的測試也成功地覆蓋了已知的「快樂路徑」（成功流程）和「悲傷路徑」（已知錯誤）。

但是，軟體系統的絕大多數 Bug 和安全漏洞，並非來自已知路徑，而是潛藏在那些我們**從未想到的、意料之外的「邊界」**上。 畢竟人腦還是有限，我們的思維總有慣性和盲點，我們能想到 name 為空，但我們是否想到了 name 長達一萬個字元？我們能想到密碼太短，但我們是否想到了密碼裡包含惡意腳本？

這正是 AI 能發揮巨大作用的地方。

> 今天的目標：學習如何利用 AI 的窮舉能力，扮演我們的「對抗性陪練」，幫助我們找到並測試那些容易被忽略的邊界條件。

## 你的「對抗性陪練」：AI 的思維模式

AI，特別是大型語言模型，學習了網路上數十億行的程式碼，其中包含了無數的 Bug 修復和極端的測試案例，因此，它在「找碴」和「鑽牛角尖」方面，有著天然的優勢。

我們今天能做的，就是透過精準的 Prompt，引出 AI 「對抗性思維」，讓它從一個順從的「小助理」，變身為一個嚴苛的 QA。

## 實戰場景：加固我們的密碼驗證器

讓我們回到 password 套件中的 `Validate` 函式，目前，它可能驗證了長度、是否包含數字和大小寫。 現在，我們想讓它的健壯性提升到工業級別。

### 第一步：詠唱「尋找邊界」的 Prompt

打開的 `password/password.go` 和 `password/password_test.go` 檔案，讓 Copilot 充分理解上下文，然後，再對 Copilot Chat 下達一個角色扮演的指令。

#### Prompt 詠唱 1 - 惡意輸入攻擊

```markdown
**(角色)** 你現在是一位頂級的網路安全專家和滲透測試工程師。
**(上下文)** (已開啟 password.go 檔案)
**(指令)** 請審查這個 Validate 函式。以一個攻擊者的視角，我可能會輸入哪些惡意的、非預期的或極端的字串，來嘗試繞過驗證、引發錯誤或導致效能問題？請將你想到的攻擊向量以列表形式告訴我。
```

#### AI 的回覆 (作者的):

```markdown
根據我對這個密碼驗證系統的分析，以下是從攻擊者角度可能嘗試的攻擊向量

🔥 高風險攻擊向量
1. 記憶體消耗攻擊 (Memory Exhaustion)
極長字串: strings.Repeat("A", 1000000) - 嘗試用極長密碼消耗記憶體
Unicode 炸彈: strings.Repeat("💀", 100000) - 使用 Unicode 字符增加記憶體壓力
組合字符: "A\u0300\u0301\u0302" 重複 - 複雜的 Unicode 組合字符
2. 正規表達式 DoS (ReDoS)
嵌套重複結構: strings.Repeat("a", 10000) + "B1" - 可能導致正規表達式引擎回溯爆炸
邊界情況: strings.Repeat("9", 100000) - 大量數字測試 numberRegex 效能
3. Unicode 編碼攻擊
零寬度字符: "Password1\u200B\u200C\u200D" - 隱形字符繞過長度檢查
同形異義字符: "Рassword1" (使用西里爾字母 Р 替代 P)
正規化攻擊: "ＡＢＣＤＥＦＧ１" (全形字符)
🟡 中風險攻擊向量
4. 邊界值攻擊
精確長度邊界: 7 個字符 (低於最小長度)
空字串: ""
純空白字符: "        " (8個空格)
5. 特殊字符注入
控制字符: "Password1\x00\x01\x02"
換行字符: "Pass\nword1", "Pass\rword1"
Tab 字符: "Pass\tword1"
6. 編碼相關攻擊
UTF-8 BOM: "\uFEFFPassword1"
不同編碼的數字: "Password１" (全形數字)
不同編碼的大寫: "passwordＡ1" (全形 A)
🟢 低風險但值得測試
7. 極端情況
純 Emoji: "😀😁😂😃😄😅😆😇1"
混合 RTL/LTR: "Password1עברית"
大量重複: strings.Repeat("A1", 50000)
8. 邏輯繞過嘗試
SQL 注入風格: "Password1'; DROP TABLE--"
腳本注入: "<script>alert('xss')</script>A1"
路徑遍歷: "../../../Password1"
```

看到這份清單，我們意識到，之前我們寫的測試是多麼的「天真」！

### 第二步：將「攻擊向量」轉化為「防禦性測試」

我們從這份清單中挑選出最有價值的幾點，讓 AI 幫我們把它們變成真正的測試案例。

#### Prompt 詠唱 2 - 生成邊界測試

```markdown
**(指令)**: 現在，請為剛剛列表中的第 1、2、3 點，幫我在 password_test.go 的測試表格中，新增對應的測試案例。對於超長字串，生成一個 10000 個字元的合法密碼即可。對於這些輸入，我們期望的結果應該是驗證通過 (true, nil)，因為我們的函式應該能健壯地處理它們。
```

AI 會幫我們在 testCases slice 中，加入新的案例：

```golang
// 攻擊向量測試 - 記憶體消耗攻擊
{
    name:          "extremely long valid password (memory exhaustion test)",
    password:      strings.Repeat("A", 9998) + "1B", // 10000 字元的合法密碼
    expectedValid: true,
    expectedError: "",
},
{
    name:          "unicode bomb attack with valid password",
    password:      strings.Repeat("💀", 2665) + "A1", // Unicode 字符記憶體攻擊，約 10000+ 字元
    expectedValid: true,
    expectedError: "",
},
{
    name:          "complex unicode combining characters",
    password:      strings.Repeat("A\u0300\u0301\u0302", 2500) + "B1", // 組合字符攻擊
    expectedValid: true,
    expectedError: "",
},
// 攻擊向量測試 - 正規表達式 DoS
{
    name:          "massive numbers string (ReDoS test)",
    password:      strings.Repeat("9", 9998) + "AB", // 大量數字測試正規表達式效能
    expectedValid: true,
    expectedError: "",
},
{
    name:          "nested repetitive structure",
    password:      strings.Repeat("a", 9997) + "B1", // 嵌套重複結構
    expectedValid: true,
    expectedError: "",
},
// 攻擊向量測試 - Unicode 編碼攻擊
{
    name:          "zero-width characters attack",
    password:      "Password1\u200B\u200C\u200D", // 零寬度字符
    expectedValid: true,
    expectedError: "",
},
{
    name:          "homoglyph attack with cyrillic characters",
    password:      "Рassword1", // 使用西里爾字母 Р 替代 P
    expectedValid: true,
    expectedError: "",
},
{
    name:          "fullwidth unicode characters",
    password:      "ＡＢＣＤＥＦＧ１", // 全形字符
    expectedValid: true,
    expectedError: "",
},
```

(注意：AI 可能會需要 `strings` 套件來輔助生成長字串)

### 第三步：執行測試，加固程式碼

執行 `go test -v ./...`。

- **如果測試通過（綠燈）**: 恭喜你！你的程式碼比你想像的更健壯。這些新增的測試將成為新的安全感來源，確保未來的修改不會在這些邊界上引入新的 Bug。
- **如果測試失敗（紅燈）**: 那更要恭喜你！AI 在產品上線前，為你免費找到了一個潛在的 Bug 或效能瓶頸！現在，你可以再次啟動 TDD 循環，將失敗的錯誤報告交給 AI，讓它處理這種情況。

例如，為了防止超長字串的 DoS 攻擊，AI 可能會建議在函式入口增加一個最大長度限制的判斷。這就是由「對抗性測試」驅動出的「防禦性程式設計」。

## 今日總結

今天，我們將 AI 的協作提升到了「邊緣案例的測試」和「安全檢查」的層次。

- 我們學會了如何透過角色扮演的 Prompt，讓 AI 具有「對抗性思維」，從攻擊者的角度審視我們的程式碼。
- 我們成功地利用 AI 突破了自身的思維盲點，識別出了多個容易被忽略的惡意輸入和邊界條件。
- 我們將這些新發現的「攻擊向量」轉化為具體的防禦性測試案例，並透過 TDD 循環，驅動我們的程式碼進行加固。

> 讓 AI 成為你的「紅隊」，持續攻擊你的程式碼，你就能打造出無懈可擊的「藍隊」防禦。

預告：Day 22 - AI 輔助併發測試 - 處理 Go 語言的核心挑戰
我們已經加固了單執行緒下的程式碼，但是，Go 語言的靈魂在於併發。明天，我們將挑戰一個更硬核的主題：如何利用 AI 幫助我們編寫和修復併發測試，揪出那些在併發場景下才會現形的、最令人頭痛的 Bug。