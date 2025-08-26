---
title: 學習單元測試使用 C#、NUnit3 和 NSubstitute
datetime: "2025-01-30"
---

Hi all, 由於工作上的的需要撰寫單元測試(雖然小弟我是TDD派，但也不是每個人都這麼異類) 加上不是所有 member 都知道怎麼寫單元測試，所以我打算來做的小小Sharing 故有這篇文章，這篇文章會有幾個小topic

1. [目標](#目標)
2. [介紹](#介紹)
3. [前置作業](#前置作業)
4. [範例](#範例)
5. [結論](#結論)
<!--more-->

## 目標

- 了解單元測試的基本概念
- 學習如何使用 NUnit3 來撰寫和執行單元測試
- 學習如何使用 NSubstitute 來模擬物件
- 了解不同種類的模擬物件

## 介紹

### Why && What's Unit Test

以我自己的經驗來說，為什麼需要單元測試有以下幾個原因

- 確保需求是真的有達到
- 增加自信心，降低做/改A壞B的機率
- 發現隱藏的耦合問題

那不免俗的還是得放上這張測試金字塔(Test-Automation-Pyramid)
![img.png](/src/content/images/Test-Automation-Pyramid.png)

測試金字塔是一個視覺化的概念，用來描述不同層級的測試以及它們之間的比例關係。

以上圖來說，由下至上有這幾個測試的類別

| 測試類型       | 測試目標    | 測試速度 | 測試範圍|
| ------------------ | ------------------------------- | -------| ------ |
| 單元測試       | 主要針對單一函式或類別進行測試，能夠快速檢查程式碼的正確性。 | 快 | 小 |
| 整合測試       | 主要測試多個模組之間的互動，能夠檢查模組之間的整合是否正確| 中 | 中 |
| 端到端測試     | 模擬真實使用者的操作，測試整個應用程式的工作流程 |慢 | 大|

總結一句話就是：
> 在測試金字塔中，越靠上方所耗費成本越高、執行時間越長；反之，越靠底下所耗費成本低，執行時間越短。

## 前置作業

在開始之前，請確保您的開發環境已經安裝以下套件：

- Rider 或其他 C# 開發工具
- NUnit3
- NSubstitute

## 建立第一個單元測試

1. 建立一個新的 C# 專案。
2. 安裝 NUnit3 和 NSubstitute 套件。
3. 建立一個簡單的類別來進行測試。

```csharp
public class Calculator
{
    public int Add(int a, int b)
    {
        return a + b;
    }
}
```

4. 建立一個測試類別來測試 `Calculator` 類別。

```csharp
using NUnit.Framework;
using NSubstitute;

[TestFixture]
public class CalculatorTests
{
    private Calculator _calculator;

    [SetUp]
    public void Setup()
    {
        _calculator = new Calculator();
    }

    [Test]
    public void Add_WhenCalled_ReturnsSumOfArguments()
    {
        var result = _calculator.Add(1, 2);
        Assert.AreEqual(3, result);
    }
}
```

## Stub、Mock 和 Fake 的說明

在單元測試中，stub、mock 和 fake 是三種常見的測試替身（test doubles），用來模擬物件的行為。

### Example Test Service

```csharp
public class EmailService(IEmailProxy)
{
    public string SendEmail()
    {
        var result = IEmailProxy.SendEmail();
        if (result)
        {
            return "Ok";
        }
        return "Fail";
    } 
}
```

### Stub

Stub 是一種簡單的測試替身，用來提供預定義的輸出。它通常用於測試中不關心的部分，只需要返回固定的結果。例如：

```csharp
[TestFixure]
public class EmailServiceTests()
{
    private IEmailProxy _emailProxy;
    private EmailService _emailService;

    [Setup]
    public void Setup()
    {
        _emailProxy = Subtitute.For<IEmailProxy>();
        _emailService = new EmailService();
    }

    [Test]
    public void should_get_true()
    {
        _emailProxy.SendEmail.Returns(true);

        var result = _emailService.SendEmail();

        Assert.That(result, Is.Equal("Ok"));
    }
}
```

### Mock

Mock 是一種測試替身，可以驗證方法的呼叫次數和參數。Mock 通常用於驗證某些行為是否發生。例如：

```csharp
[TestFixture]
public class NotificationServiceTests
{
    private EmailService _emailService;
    private IEmailProxy _emailProxy;

    [SetUp]
    public void Setup()
    {
        _emailProxy = Substitute.For<IEmailProxy>();
        _emailService = new EmailService(_emailProxy);
    }

    [Test]
    public void Notify_WhenCalled_SendsEmail()
    {
        var result = _emailService.SendEmail();

        _emailProxy.Received().SendEmail();
    }
}
```

在這個範例中，我們使用 NSub 來模擬 `IEmailProxy` 介面，並驗證 `SendEmail` 方法是否被呼叫。

### Fake

Fake 是一種更接近真實實現的測試替身。它通常具有一些簡單的邏輯，可以用來模擬真實物件的行為。例如：

```csharp
public class FakeProxy : EmailProxy2 
{
    public override bool SendEmail()
    {
        return false;
    }
}

public class EmailService()
{
    public string SendEmail()
    {
        var emailProxy2 = new EmailProxy2()
        var result = emailProxy2.SendEmail();

        if (result)
        {
            return "Ok";
        }
        return "Fail";
    } 
}


[TestFixture]
public class OrderServiceTests
{
    private EmailService _emailService;
    private FakeProxy _fakeProxy;

    [SetUp]
    public void Setup()
    {
        _fakeProxy = new FakeProxy();
        _emailService = new EmailService(_fakePRoxy);
    }

    [Test]
    public void PlaceOrder_WhenCalled_SendsEmail()
    {
        var result = _emailService.SendEmail();
        Assert.That(result, Is.Equal("Fail"));
    }
}
```

在這個範例中，我們使用 `FakeProxy` 來繼承 `EmailProxy2` 並改寫 `SendService`，並測試 `EmailService` 類別的行為。`FakeProxy` 來模擬真實的行為，這樣我們可以在測試中進行驗證。

## 結論

- > 同一測試案例中，請避免 stub 與 mock 在同一個案例一起驗證。

<details>
<summary>點擊這裡查看原因</summary>
原因就如同一直在強調的單元測試準則，一次只驗證一件事。 stub 與 mock 的用途本就不同，stub 是用來輔助驗證回傳值或目標物件狀態，而 mock 是用來驗證目標物件與相依物件互動的情況是否符合預期。既然八竿子打不著，又怎麼會在同一個測試案例中，驗證這兩個完全不同的情況呢？
</details>

- > 當 mock/stub 物件變多的時候，就可以思考使否在設計上出現問題 (太多耦合)
- > 當測試變得很長很複雜 $\rightarrow$ 思考職責是不是太多

## Reference

- [91-TDD: [30天快速上手TDD][Day 7]Unit Test - Stub, Mock, Fake 簡介](https://dotblogs.com.tw/hatelove/2012/11/29/learning-tdd-in-30-days-day7-unit-testing-stub-mock-and-fake-object-introduction)
- [單元測試的藝術, 2/e](https://www.tenlong.com.tw/products/9789864342471)
