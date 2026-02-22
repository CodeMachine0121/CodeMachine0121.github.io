---
title: "Rule Table Pattern｜用 TDD 馴服複雜的交叉條件邏輯"
datetime: "2026-02-22"
description: "這篇文章的啟發主要是我在開發的時候遇到的一個情境，我覺得產出挺不錯的，就放上來做紀錄，雖然是使用 Golang 做開發，但我想概念適用於各個程式語言"
image: "/images/titles/Rule Table Pattern｜用 TDD 馴服複雜的交叉條件邏輯.png"
---

Hi all, 當我們在開發的時候，多少會遇到需要交叉判斷的邏輯，更雖小的時候判斷條件可能還會同時包含： 

- 類別（例如：A/B、group、type…）
- 年齡/級距（range）
- 數值區間（range）
- 需要回傳一個 label/level/result

接著我就用 TDD (Test Driven Development) 的方式，帶大家開發一次。


## 情境

因為我實際上的開發內容不方便公開，我在這邊透過一個 **運費計算器** 例子來展示，以下是我們的業務規則:

### Rules Table（Shipping Fee Calculator）

> Range 約定：全部採 **左閉右開** [min, max)， 
> 例如：DistanceKm = 5.0 不屬於 [0, 5)；WeightKg = 1.0 屬於 [1, 3)。

| Rule ID | Region | Distance Range (km) | Weight Range (kg) | Fee | Notes |
|-------:|:------:|:-------------------:|:-----------------:|---:|:------|
| 1 | Local  | [0, 5)  | [0, 1) | 60 | Small parcel, short distance |
| 2 | Local  | [0, 5)  | [1, 3) | 90 | Medium parcel, short distance |
| 3 | Local  | [5, 20) | [0, 1) | 80 | Small parcel, medium distance |
| 4 | Local  | [5, 20) | [1, 3) | 120 | Medium parcel, medium distance |
| 5 | Local  | [20, 999) | [0, 1) | 150 | Small parcel, long distance |
| 6 | Local  | [20, 999) | [1, 3) | 210 | Medium parcel, long distance |
| 7 | Remote | [0, 5)  | [0, 1) | 100 | Remote surcharge, short distance |
| 8 | Remote | [0, 5)  | [1, 3) | 140 | Remote surcharge, short distance |
| 9 | Remote | [5, 20) | [0, 1) | 130 | Remote surcharge, medium distance |
| 10 | Remote | [5, 20) | [1, 3) | 180 | Remote surcharge, medium distance |
| 11 | Remote | [20, 999) | [0, 1) | 220 | Remote surcharge, long distance |
| 12 | Remote | [20, 999) | [1, 3) | 300 | Remote surcharge, long distance |

### Fallback
- If no rule matches, return: `999`

這是個蠻易懂的例子，我們會有 `Regin (地區)`、`DistanceKm (距離)` 及 `WeightKg (重量)` 三個因素來計算出 `Expected Fee (預期運費)`，都搞懂的話就開始 TDD 第一步吧。

## Step 0：先寫第一個最小的測試（Red）

需求：Local 區域、距離 0–5km、重量 0–1kg → 60 元。 

```go
func (s *FeeServiceSuite) TestFee_Local_0to5km_0to1k_Should_Be_60() {

	fee := s.FeeService.Calculate("Local", 3.0, 0.8)
	s.Equal(60.0, fee)
}
```

此時，你的 IDE肯定會是紅線爬滿整個螢幕，但一切都在預期中。

## Step 1: 一分鐘綠燈

這個時候，我們用最最最簡單的方式讓這個測試綠燈：

```go

type FeeService struct{}

func (service FeeService) Calculate(region string, distance float64, weight float64) float64 {
	return 60.0
}

```
這個時候跑一下測試，就會看到測試通過囉。

## Step 3: 第二個紅燈

需求：Local 區域、距離 0-5km、重量 1-3kg → 90 元。 

```go
func (s *FeeServiceSuite) TestFee_Local_0to5km_1to3k_Should_Be_90() {

	fee := s.FeeService.Calculate("Local", 2.0, 2.2)
	s.Equal(90.0, fee)
}
```

## Step 4: 一分鐘綠燈

最直覺的做法就是 `if-else` (我開發時候是這樣想的)

```go
func (service FeeService) Calculate(region string, distance float64, weight float64) float64 {

	if region == "Local" &&
		distance > 0 && distance < 5 &&
		weight >= 1 && weight < 3 {
		return 90.0
	}
	return 60.0

}
```

## Step 5: 重構

此時我會覺得，`Calculate` 這個方法有 **Long Parameters** 的 Code Smell，所以我要重構他，程式碼如下：

### Production Code

```go
type FeeService struct{}

type CalculateFeeParams struct {
	Region   string
	Distance float64
	Weight   float64
}

func (service FeeService) Calculate(params CalculateFeeParams) float64 {

	if params.Region == "Local" &&
		params.Distance > 0 && params.Distance < 5 &&
		params.Weight >= 1 && params.Weight < 3 {
		return 90.0
	}
	return 60.0

}

```

### Test Code

此時，我們更改了 production code 的介面，立論上 test code就會壞了，我們來稍微修整一下

```go

func (s *FeeServiceSuite) TestFee_Local_0to5km_0to1k_Should_Be_60() {

	fee := s.FeeService.Calculate(CalculateFeeParams{"Local", 3.0, 0.8})
	s.Equal(60.0, fee)
}

func (s *FeeServiceSuite) TestFee_Local_0to5km_1to3k_Should_Be_90() {

	fee := s.FeeService.Calculate(CalculateFeeParams{"Local", 2.0, 2.2})
	s.Equal(90.0, fee)
}

```

此時跑一下測試，會發現測試還會是全綠燈。


## Step 6: 第三個紅燈

需求：Local 區域、距離 5-20km、重量 0-1kg → 80 元。 

```go
func (s *FeeServiceSuite) TestFee_Local_5to20km_0to1k_Should_Be_80() {

	fee := s.FeeService.Calculate(CalculateFeeParams{"Local", 6.0, 1.0})
	s.Equal(80.0, fee)
}
```

## Step 7: 一分鐘綠燈

這個時候，我們不能想太多，只要想讓測試通過就好

```go

func (service FeeService) Calculate(params CalculateFeeParams) float64 {

	if params.Region == "Local" &&
		params.Distance > 0 && params.Distance < 5 &&
		params.Weight >= 1 && params.Weight < 3 {
		return 90.0
	}

	if params.Region == "Local" &&
		params.Distance > 5 && params.Distance < 20 &&
		params.Weight >= 1 && params.Weight < 3 {
		return 80.0
	}

	return 60.0

}

```

跑個測試，測試全部綠燈

## Step 8: 重構

這個時候，身為開發者的我們應該要聽到腦海中的聲音:

> 那接下來的測試全部都用 `if-else`串下去，不就好了嗎，

當然可以，但日子一長，規則一直加，你能有把握可以馬上看懂所有的規則嗎? (至少我不能😢）

與 AI 討論過後，我們可以這樣子來設計 Pattern:

### 定義兩個 range 用的 model
程式碼如下：

```go
type DistanceRange struct {
	Min float64
	Max float64
}

func (d DistanceRange) Contains(value float64) bool {
	return value >= d.Min && value < d.Max
}

type WeightRange struct {
	Min float64
	 Max float64
}

func (w WeightRange) Contains(value float64) bool {
	return value >= w.Min && value < w.Max
}
```
### 定義 Rule model

程式碼如下：

```go
type  FeeRules struct {
	Region string
	DistanceRange DistnaceRange
	WeightRange WeightRange
	Fee float64
}
```
### Apply Pattern

接著我們來修改下當前的 production code 

```go

type FeeService struct {
	rules []FeeRules
}

func (service FeeService) Calculate(params CalculateFeeParams) float64 {

	for _, rule := range service.rules {
		if rule.Region == params.Region && 
			rule.DistanceRange.Contains(params.Distance) && 
			rule.WeightRange.Contains(params.Weight) {
			return rule.Fee
		}
	}

	return 60.0

}

func NewFeeService() *FeeService {
	return &FeeService{
		rules: []FeeRules{
			{Region: "Local", DistanceRange: DistanceRange{Min: 0, Max: 5}, WeightRange: WeightRange{Min: 1, Max: 3}, Fee: 90.0},
			{Region: "Local", DistanceRange: DistanceRange{Min: 5, Max: 20}, WeightRange: WeightRange{Min: 1, Max: 3}, Fee: 80.0},
		},
	}
}
```

可以看到我們上面多了一個新的 method `NewFeeService` ，這個 method 我們可以視為 constructor 的存在，此時我們在這裡定義 rules。
然而此時 test code 的 setup test 那邊也需要動點手腳，讓它是透過 `NewFeeService` 取得 `FeeService`:

```go
func (s *FeeServiceSuite) SetupTest() {
	s.FeeService = NewFeeService()
}
```

此時，跑一下測試... 全數通過，讚。

## 免不了 AI 出場

理論上，我們應該要繼續我們的 TDD 旅程，但是~~~~ 我可是有付錢買 AI 的人耶，不用就太浪費了對吧？

所以我決定將剩下的 test case 讓 AI  follow 我們的 pattern 進行撰寫， prompt 如下：

```text
請 follow 當前的 design pattern， 針對以下 test case 進行開發

/***
這裡什麼都不用想，把 markdown table 或是 excel 直接複製貼上來
***/
```

假設你的 AI 有好好聽話，理論上你執行測試都要是綠燈。

## 結論

說到底，這次 TDD 旅程帶來最大的收穫不是「寫測試」本身，而是**重構的勇氣**。

因為有測試保護，才敢大膽把 if-else 打掉重練(反正弄壞了，我們有 git 可以 rollback 嘛)，換成更清楚的 Rule Table。對我來說，這就是 TDD 的價值：不是一口氣把 pattern 全部生出來，而是在一步步紅燈、綠燈的過程中，讓設計自然長出來。

Rule Table Pattern 的好處也在這個過程中一一浮現：

- 每一條規則獨立存在，互不干擾
- 新增規則不需要觸碰已有邏輯（符合 Open/Closed Principle）
- 規則本身就是文件，幾乎不需要額外說明
- AI 可以直接讀懂規則並協助補齊

下次遇到多條件交叉邏輯時，試試看這個 pattern，相信你也會很快愛上它的。

BTW: 相關的範例程式碼，我放在這 [GitHub](https://github.com/CodeMachine0121/tdd-rules-pattern)
