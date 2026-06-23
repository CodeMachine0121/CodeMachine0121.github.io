---
title: "C# Unit Test\_如何驗證多次呼叫"
datetime: "2025-08-03"
description: "在 C# 單元測試中，如何驗證多次呼叫的情況？本文提供了一個實際範例，展示如何使用 NSubstitute 和 FluentAssertions 來驗證多次呼叫的參數。"
image: "https://pub-159ff40b8c65457a8782edc77d8170be.r2.dev/images/titles/CSharp-Multiple-Assertion.png"
class: "responsive-blog-post"
---
Hi all, 由於工作的關係，我們在TDD的路上遇到了一個情境，那就是如何驗證多次被呼叫的情況。甚麼意思呢，這邊給個例子🌰
假設我們在DB有張用來存放學生資訊的table，但我們需要當這張table的資料轉移至另一張新的 table (俗稱 Archive)。但由於其資料量問題我們必須分批次的進行 Read 及 Insert，所以我們預期中的production會是長成這樣子。
<!--more-->
```csharp
public void Run(int batch)
{
    while (true)
    {
        var students = studentRepository.FetchByBatch(batch);
        if (!students.Any())
        {
            break;
        }
        studentRepository.Insert(students);
    }
}
```
那這樣問題來了，我們該如何驗證呢?

## 寫測試囉
這個問題其實苦惱了我們一下子，但透過 你的好同事 Chat GPT 後，我們發現其實我們使用的Assert 框架及 Mock框架提供了這樣的寫法 (BTW 這裡使用的 package分別為: NSubstitute 及 FluentAssertions )。
```csharp
[Test]
public void should_get_data_by_batch()
{
    _studentRepository.FetchByBatch(Arg.Any<int>()).Returns(
        new List<Student>()
        {
            new() { id = 1 },
            new() { id = 2 },
            new() { id = 3 }
        },
        new List<Student>()
        {
            new() { id = 4 },
            new() { id = 5 }
        },
        new List<Student>()
    );

    _batchService.Run(3);

    var argumentList = _studentRepository.ReceivedCalls().Where(x => x.GetMethodInfo().Name == "Insert").ToList();
    argumentList[0].GetArguments()[0].Should().BeEquivalentTo(new List<Student>()
    {
        new() { id = 1 },
        new() { id = 2 },
        new() { id = 3 }
    });
    argumentList[1].GetArguments()[0].Should().BeEquivalentTo(new List<Student>()
    {
        new() { id = 4 },
        new() { id = 5 }
    });
}
```

上面的 test code 雖然看起來又長又臭的，但其實可以蠻明確地看出 test 3A( Arrange, Action, Assert)。
Arrange
一般來說，我們會使用 Returns 來mock 這個被呼叫的函數回傳特定的值，但其實有的隱藏版用法就是可以透過逗號來區分第幾次呼叫要回傳的值，以這次的例子舉例，我們指定了第一次呼叫時要回傳 3個 Id為1~3的student 資料。

```csharp
_studentRepository.FetchByBatch(Arg.Any<int>()).Returns(
    new List<Student>()
    {
        new() { id = 1 },
        new() { id = 2 },
        new() { id = 3 }
    },
    new List<Student>()
    {
        new() { id = 4 },
        new() { id = 5 }
    }, 
    new List<Student>()
);
```

## Assert
在 Assert這一段，我們用了個人比較不常用到的方式來驗證。我們透過 ReceivedCalls() 取得我們整段測試針對此mock 物件接收到的呼叫請求，並再一步拿到 呼叫函數的資訊把方法名為 "Insert" 提取出來。
提取出來的物件會是一個List物件，其中每個成員都是每次呼叫方法的請求物件。在這個物件中，我們可以透過 GetArguments 取得該次請求所送出的參數，因此我們就可以來驗證不同呼叫時所帶的參數是否正確。

```csharp
var argumentList = _studentRepository.ReceivedCalls().Where(x => x.GetMethodInfo().Name == "Insert")
.ToList();
argumentList[0].GetArguments()[0].Should().BeEquivalentTo(new List<Student>()
{
    new() { id = 1 },
    new() { id = 2 },
    new() { id = 3 }
});
argumentList[1].GetArguments()[0].Should().BeEquivalentTo(new List<Student>()
{
    new() { id = 4 },
    new() { id = 5 }
});
```
## Conclusion
以上為如何驗證多次呼叫的實作，單純個人筆記。
