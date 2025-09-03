---
title: "Day 23 - 利用 AI 為既有程式碼補上「特性測試」"
datetime: "2025-08-25"
description:  "學習一項能在遺留程式碼的泥潭中殺出重圍的關鍵技能——編寫「特性測試」(Characterization Tests)，並利用 AI 來極大地加速這個「程式碼考古」的過程。"
parent: "2025 ithome-鐵人賽: 從 0 到 1：與 AI 協作的 Golang TDD 實戰 系列"
image: "/images/titles/golang-cowboy.png"
---

## 昨日回顧與今日目標

在 Day 22 的實戰中，我們利用 AI 成功地克服了 Go 語言的併發挑戰，我們學會了如何生成併發測試來捕捉競爭條件，並用 TDD 的方式驅動出併發安全的程式碼。
至此，我們已經掌握了從零開始，使用 AI 輔助 TDD 開發全新、健壯功能的完整流程。

然而，在軟體開發的真實世界裡，我們有多少機會能從一個全新的 `main.go` 開始呢？更多的時候，我們是在與先人留下的、可能缺少文件、沒有測試、邏輯複雜的 Legacy Code 打交道。
面對一個數百行的、你不敢輕易改動的舊函式，TDD 的「先寫測試」原則似乎無從下手，因為你甚至不知道這個函式**「應該」做什麼**，這就是 TDD 實踐中最經典的困境。

> 今天的目標：學習一項能在遺留程式碼的泥潭中殺出重圍的關鍵技能——編寫「特性測試」(Characterization Tests)，並利用 AI 來極大地加速這個「程式碼考古」的過程。

## 什麼是「特性測試」？—— 為黑箱畫像

> 特性測試 是一種描述程式碼當前實際行為的測試，無論該行為是正確還是錯誤的。

特性測試的目的不是去驗證「程式碼是否做對了事」，而是去記錄「程式碼到底做了什麼事」。
想像一下，你接手了一個神秘的黑箱機器。你不知道它內部的構造，但你可以給它塞東西，然後看它會吐出什麼。特性測試就是你為這個過程做的詳細實驗筆記：

- 塞入「蘋果」，吐出「蘋果醬」。 -> `assert.Equal(t, "蘋果醬", blackBox("蘋果"))`
- 塞入「石頭」，機器卡住了並冒煙。-> `assert.Panics(t, func() { blackBox("石頭") })`
- 什麼都不塞，它吐出一張「請投幣」的紙條。-> `assert.Equal(t, "請投幣", blackBox(""))`
  
當你為這個黑箱的各種行為都寫下了測試並讓它們通過後，你就可以確保往後的變更，只要測試沒壞就是正常的，基於這一點，你就可以大膽地打開黑箱，嘗試去修理或改造它（重構）。

## 實戰場景：考古一個神秘的運費計算函式

假設我們在專案中發現了一個沒有測試的舊函式，它用來計算不同條件下的運費。

### 第一步: 建立新套件

建立一個 legacy 套件，並在其中建立 `shipping.go` 和 `shipping_test.go` 兩個檔案。
一段神秘的遺留程式碼： 將以下這段故意寫得有些繞的程式碼貼到 `legacy/shipping.go`。

```golang
// legacy/shipping.go
package legacy

// CalculateShippingFee 是一個歷史遺留的運費計算函式，沒有任何註解和測試。
func CalculateShippingFee(weight, distance int, isVIP bool, region string) int {
    baseFee := 100 

    if weight > 10 {
        baseFee += (weight - 10) * 10 
    }

    var distanceFee int
    if distance > 50 {
        distanceFee = 200
    } else if distance > 20 {
        distanceFee = 100
    } else {
        distanceFee = 50
    }

    totalFee := baseFee + distanceFee

    if region == "Tibet" || region == "Xinjiang" {
        totalFee = int(float64(totalFee) * 1.5)
    }
    
    if isVIP {
        if totalFee > 500 {
            return totalFee - 50 
        }
    }
    
    return totalFee
}
```

### 第二步: 詠唱 Prompt，讓 AI 幫你通靈

我們的任務是，在不完全理解上述所有 `if-else` 邏輯的情況下，為它生成一套特性測試。
打開空的 `legacy/shipping_test.go`，然後對 Copilot Chat 下達我們今天最核心的指令：

```markdown
**(角色)** 你現在是一位非常謹慎的軟體維護工程師和逆向工程專家。
**(上下文)** 我接手了一個名為 CalculateShippingFee 的遺留函式（已開啟 shipping.go）。這個函式沒有任何測試和文件，我不敢輕易修改它。
**(指令)** 我的目標是為這個函式建立一套「特性測試」。請幫我生成一個表格驅動的單元測試，包含多個能夠覆蓋不同 if 分支的測試案例。
**(限制)** 測試的斷言必須基於函式當前的實際輸出。重點是描述和鎖定它現在的行為，而不是判斷它是否「正確」。請盡可能多地猜測一些有意義的組合，比如不同的重量、距離、VIP 狀態和地區。
```

AI 就會去分析程式碼的各個分支，並構建出能夠觸發這些分支的輸入組合。

#### AI 的回覆 (模擬生成的測試)

```golang
// legacy/shipping_test.go
// legacy/shipping_test.go
package legacy

import "testing"

// TestCalculateShippingFee_CharacterizationTests 是特性測試，用於鎖定函式的當前行為
// 這些測試描述函式現在的實際輸出，不判斷對錯，只確保行為不會意外改變
//
// 通過測試發現的函式行為規律：
// 1. 基本費用 = 100 + max(0, (weight-10)*10)
// 2. 距離費用: distance <= 20 => 50, 20 < distance <= 50 => 100, distance > 50 => 200
// 3. 總費用 = 基本費用 + 距離費用
// 4. 特殊地區(Tibet/Xinjiang): 總費用 *= 1.5 (整數轉換)
// 5. VIP折扣: 只有當總費用 > 500 時才減50，≤500時無折扣
// 6. 地區名稱區分大小寫 (只有完全匹配 "Tibet" 或 "Xinjiang" 才有特殊處理)
func TestCalculateShippingFee_CharacterizationTests(t *testing.T) {
    tests := []struct {
        name     string
        weight   int
        distance int
        isVIP    bool
        region   string
        expected int
    }{
        // 基礎案例 - 最小值組合
        {
            name:     "最小組合_重量10以下_距離20以下_非VIP_普通地區",
            weight:   5,
            distance: 15,
            isVIP:    false,
            region:   "Beijing",
            expected: 150, // baseFee(100) + distanceFee(50)
        },
        {
            name:     "最小組合_重量10以下_距離20以下_非VIP_空字串地區",
            weight:   1,
            distance: 1,
            isVIP:    false,
            region:   "",
            expected: 150, // baseFee(100) + distanceFee(50)
        },

        // 重量分支測試
        {
            name:     "重量邊界_正好10公斤_距離20以下_非VIP_普通地區",
            weight:   10,
            distance: 10,
            isVIP:    false,
            region:   "Shanghai",
            expected: 150, // baseFee(100) + distanceFee(50)
        },
        {
            name:     "重量邊界_11公斤_距離20以下_非VIP_普通地區",
            weight:   11,
            distance: 10,
            isVIP:    false,
            region:   "Shanghai",
            expected: 160, // baseFee(100+10) + distanceFee(50)
        },
        {
            name:     "重量高值_25公斤_距離20以下_非VIP_普通地區",
            weight:   25,
            distance: 15,
            isVIP:    false,
            region:   "Guangzhou",
            expected: 300, // baseFee(100+150) + distanceFee(50)
        },

        // 距離分支測試
        {
            name:     "距離邊界_正好20公里_重量10以下_非VIP_普通地區",
            weight:   5,
            distance: 20,
            isVIP:    false,
            region:   "Shenzhen",
            expected: 150, // baseFee(100) + distanceFee(50)
        },
        {
            name:     "距離邊界_21公里_重量10以下_非VIP_普通地區",
            weight:   5,
            distance: 21,
            isVIP:    false,
            region:   "Shenzhen",
            expected: 200, // baseFee(100) + distanceFee(100)
        },
        {
            name:     "距離邊界_正好50公里_重量10以下_非VIP_普通地區",
            weight:   8,
            distance: 50,
            isVIP:    false,
            region:   "Chengdu",
            expected: 200, // baseFee(100) + distanceFee(100)
        },
        {
            name:     "距離邊界_51公里_重量10以下_非VIP_普通地區",
            weight:   8,
            distance: 51,
            isVIP:    false,
            region:   "Chengdu",
            expected: 300, // baseFee(100) + distanceFee(200)
        },
        {
            name:     "距離高值_100公里_重量10以下_非VIP_普通地區",
            weight:   3,
            distance: 100,
            isVIP:    false,
            region:   "Wuhan",
            expected: 300, // baseFee(100) + distanceFee(200)
        },

        // 特殊地區測試
        {
            name:     "特殊地區_Tibet_重量10以下_距離20以下_非VIP",
            weight:   5,
            distance: 15,
            isVIP:    false,
            region:   "Tibet",
            expected: 225, // (baseFee(100) + distanceFee(50)) * 1.5 = 225
        },
        {
            name:     "特殊地區_Xinjiang_重量10以下_距離20以下_非VIP",
            weight:   5,
            distance: 15,
            isVIP:    false,
            region:   "Xinjiang",
            expected: 225, // (baseFee(100) + distanceFee(50)) * 1.5 = 225
        },
        {
            name:     "特殊地區_Tibet_高重量高距離_非VIP",
            weight:   20,
            distance: 80,
            isVIP:    false,
            region:   "Tibet",
            expected: 600, // (baseFee(200) + distanceFee(200)) * 1.5 = 600
        },

        // VIP 測試
        {
            name:     "VIP_低金額_不滿500_重量10以下_距離20以下_普通地區",
            weight:   5,
            distance: 15,
            isVIP:    true,
            region:   "Beijing",
            expected: 150, // baseFee(100) + distanceFee(50) = 150 < 500，無折扣
        },
        {
            name:     "VIP_邊界金額_正好500_重量高_距離中等_普通地區",
            weight:   30,
            distance: 30,
            isVIP:    true,
            region:   "Shanghai",
            expected: 400, // baseFee(300) + distanceFee(100) = 400 < 500，無VIP折扣
        },
        {
            name:     "VIP_高金額_超過500_重量高_距離高_普通地區",
            weight:   25,
            distance: 80,
            isVIP:    true,
            region:   "Guangzhou",
            expected: 450, // baseFee(250) + distanceFee(200) = 450 < 500，無VIP折扣
        },

        // VIP + 特殊地區組合
        {
            name:     "VIP_特殊地區_Tibet_高費用_應有折扣",
            weight:   20,
            distance: 80,
            isVIP:    true,
            region:   "Tibet",
            expected: 550, // (baseFee(200) + distanceFee(200)) * 1.5 = 600 - 50(VIP折扣) = 550
        },
        {
            name:     "VIP_特殊地區_Xinjiang_高費用_應有折扣",
            weight:   25,
            distance: 100,
            isVIP:    true,
            region:   "Xinjiang",
            expected: 625, // (baseFee(250) + distanceFee(200)) * 1.5 = 675 - 50 = 625，需實際驗證
        },

        // 邊界組合案例
        {
            name:     "極端組合_最高重量_最高距離_VIP_特殊地區",
            weight:   50,
            distance: 200,
            isVIP:    true,
            region:   "Tibet",
            expected: 1000, // (baseFee(500) + distanceFee(200)) * 1.5 = 1050 - 50 = 1000
        },
        {
            name:     "零值測試_重量0_距離0_非VIP_普通地區",
            weight:   0,
            distance: 0,
            isVIP:    false,
            region:   "Normal",
            expected: 150, // baseFee(100) + distanceFee(50)
        },
        {
            name:     "負值測試_重量負數_距離負數_VIP_特殊地區",
            weight:   -5,
            distance: -10,
            isVIP:    true,
            region:   "Tibet",
            expected: 225, // 需實際測試驗證負數處理
        },

        // 地區名稱變體測試
        {
            name:     "地區大小寫_tibet_小寫_重量10以下_距離20以下",
            weight:   5,
            distance: 15,
            isVIP:    false,
            region:   "tibet",
            expected: 150, // 可能區分大小寫，應該沒有特殊處理
        },
        {
            name:     "地區大小寫_TIBET_大寫_重量10以下_距離20以下",
            weight:   5,
            distance: 15,
            isVIP:    false,
            region:   "TIBET",
            expected: 150, // 可能區分大小寫，應該沒有特殊處理
        },
        {
            name:     "其他特殊地區名稱_非Tibet或Xinjiang_重量10以下_距離20以下",
            weight:   5,
            distance: 15,
            isVIP:    false,
            region:   "Inner Mongolia",
            expected: 150, // 普通地區處理
        },

        // 額外的VIP邊界測試案例 - 確保我們理解VIP折扣的觸發條件
        {
            name:     "VIP_剛好500費用_重量20_距離30_普通地區",
            weight:   20,
            distance: 30,
            isVIP:    true,
            region:   "Beijing",
            expected: 300, // baseFee(200) + distanceFee(100) = 300 < 500，無VIP折扣
        },
        {
            name:     "VIP_超過500費用_重量25_距離60_普通地區",
            weight:   25,
            distance: 60,
            isVIP:    true,
            region:   "Shanghai",
            expected: 450, // baseFee(250) + distanceFee(200) = 450，無VIP折扣(未超過500)
        },
        {
            name:     "VIP_明確超過500_重量30_距離60_普通地區",
            weight:   30,
            distance: 60,
            isVIP:    true,
            region:   "Guangzhou",
            expected: 500, // baseFee(300) + distanceFee(200) = 500，剛好500，無VIP折扣
        },

        // Xinjiang地區的更多測試
        {
            name:     "特殊地區_Xinjiang_中等重量距離_VIP",
            weight:   15,
            distance: 40,
            isVIP:    true,
            region:   "Xinjiang",
            expected: 375, // (baseFee(150) + distanceFee(100)) * 1.5 = 375 < 500，無VIP折扣
        },
        {
            name:     "特殊地區_Xinjiang_高費用_VIP應有折扣",
            weight:   30,
            distance: 70,
            isVIP:    true,
            region:   "Xinjiang",
            expected: 700, // (baseFee(300) + distanceFee(200)) * 1.5 = 750 - 50 = 700
        },

        // 驗證VIP折扣真正觸發的案例
        {
            name:     "VIP_確實超過500_重量35_距離60_普通地區",
            weight:   35,
            distance: 60,
            isVIP:    true,
            region:   "Beijing",
            expected: 500, // baseFee(350) + distanceFee(200) = 550 - 50(VIP折扣) = 500
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            result := CalculateShippingFee(tt.weight, tt.distance, tt.isVIP, tt.region)
            if result != tt.expected {
                t.Errorf("CalculateShippingFee(%d, %d, %t, %q) = %d, expected %d",
                    tt.weight, tt.distance, tt.isVIP, tt.region, result, tt.expected)
            }
        })
    }
}
```

當 AI 生成這段程式碼後，你會發現 AI 不只幫我們把測試寫好，連同 production code 的情境也一併幫我們寫完了，接著我們執行 `go test -v ./...`，它應該立即就是綠燈！因為所有的 expected 值都是根據函式當前行為倒推出來的。

現在，我們可以開始放心地重構 `CalculateShippingFee` 函式（比如把計算邏輯拆分成更小的函式），或者在其中為 VIP 用戶增加新的折扣邏輯。任何時候，只要我們的修改不小心改變了任何一個既有場景的運費計算結果，對應的特性測試就會立刻失敗，警告我們可能引入了 Bug。

## 今日總結

今天，我們學會瞭如何應對 TDD 實踐中最大的敵人——遺留程式碼。

- 我們理解了特性測試的核心思想：它不關心對錯，只關心「現狀」，旨在為修改提供一個穩定的基準。
- 我們透過詠唱，讓 AI 扮演柯南，為一個完全未知的「黑箱」函式，自動生成一套描述其現有行為的特性測試。

這項技能，是連接理想中 TDD 的「綠地專案」與現實中「棕地專案」之間最重要的橋樑。

預告：Day 24 - 迎接 ATDD：當測試成為「對話」的起點
我們已經用 AI 將 TDD 的實踐得差不多了，從零開發到併發安全，再到 legacy code，但我們的維度還局限在「程式碼」層面。
明天，我們將提高為杜，引入驗收測試驅動開發 (ATDD)，我們將學習如何讓測試成為業務、QA 和開發之間溝通的橋樑，確保我們不僅「把事情做對」，更是在「做對的事情」。