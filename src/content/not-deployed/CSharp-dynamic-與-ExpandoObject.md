---
title: CSharp dynamic 與 ExpandoObject
datetime: "2025-04-25"
---

## 前言

Hi all, 今天在進行 code review 時，我們討論到一個有趣的問題：如何在 C# 中動態解析 JSON 字串，特別是當我們不確定 JSON 結構，或是結構過於複雜不值得建立完整模型時。

傳統上，我們可能會使用 `Dictionary<string, object>` 或建立專用的類別來解析 JSON。但今天我想分享另一個更靈活的方法：使用 C# 的 `dynamic` 類型搭配 `ExpandoObject`。

<!--more-->

## 什麼是 dynamic 類型？

`dynamic` 是 C# 4.0 引入的一種類型，它允許我們繞過編譯時的類型檢查，將類型檢查推遲到運行時進行。使用 `dynamic` 類型的物件，我們可以像在動態語言（如 JavaScript）中一樣操作物件，而不需要預先定義其屬性或方法。

簡單來說，`dynamic` 告訴編譯器：「相信我，這個物件在運行時會有這些屬性和方法。」

```csharp
public void ExampleMethod()
{
    dynamic dynamicObject = new object();

    // 以下在編譯時不會報錯，但可能在運行時報錯
    dynamicObject.SomeProperty = "Hello";
    dynamicObject.SomeMethod();
}
```

## 什麼是 ExpandoObject？

`ExpandoObject` 是 .NET 提供的一個實現，它允許我們在運行時動態地添加和移除物件的成員。當與 `dynamic` 關鍵字一起使用時，`ExpandoObject` 提供了一種建立可動態擴展物件的方法。

```csharp
using System.Dynamic;

public void ExpandoExample()
{
    dynamic expando = new ExpandoObject();

    // 動態添加屬性
    expando.Name = "James";
    expando.Age = 30;

    // 動態添加方法
    expando.SayHello = (Action)(() => Console.WriteLine($"Hello, {expando.Name}"));

    // 使用動態添加的屬性和方法
    Console.WriteLine($"Name: {expando.Name}, Age: {expando.Age}");
    expando.SayHello();
}
```

## 動態解析 JSON 字串

現在讓我們來看看如何使用 `dynamic` 和 `ExpandoObject` 來解析 JSON 字串。

### 傳統方式解析 JSON

假設我們有以下 JSON 字串：

```json
{
  "name": "James",
  "age": 30,
  "address": {
    "city": "Taipei",
    "country": "Taiwan"
  },
  "skills": ["C#", "JavaScript", "Python"]
}
```

傳統上，我們可能會建立對應的類別：

```csharp
public class Person
{
    public string Name { get; set; }
    public int Age { get; set; }
    public Address Address { get; set; }
    public List<string> Skills { get; set; }
}

public class Address
{
    public string City { get; set; }
    public string Country { get; set; }
}

// 使用 System.Text.Json
Person person = JsonSerializer.Deserialize<Person>(jsonString);
Console.WriteLine($"Name: {person.Name}, City: {person.Address.City}");
```

### 使用 dynamic 和 ExpandoObject 解析 JSON

現在，讓我們看看如何使用 `dynamic` 和 `ExpandoObject` 來解析同樣的 JSON 字串：

```csharp
using System.Dynamic;
using System.Text.Json;

public void ParseJsonDynamically()
{
    string jsonString = @"{
  ""name"": ""James"",
  ""age"": 30,
  ""address"": {
    ""city"": ""Taipei"",
    ""country"": ""Taiwan""
  },
  ""skills"": [""C#"", ""JavaScript"", ""Python""]
}";

    // 直接使用 JsonSerializer 將 JSON 字串反序列化為 dynamic ExpandoObject
    // 這比手動轉換簡單得多
    var options = new JsonSerializerOptions
    {
        PropertyNameCaseInsensitive = true,
        ReadCommentHandling = JsonCommentHandling.Skip,
        AllowTrailingCommas = true
    };

    dynamic result = JsonSerializer.Deserialize<ExpandoObject>(jsonString, options);

    // 現在可以像操作強型別物件一樣操作 result
    Console.WriteLine($"Name: {result.name}, Age: {result.age}");
    Console.WriteLine($"City: {result.address.city}, Country: {result.address.country}");

    // 操作陣列
    Console.WriteLine("Skills:");
    foreach (var skill in result.skills)
    {
        Console.WriteLine($"  - {skill}");
    }
}
```

## 使用場景與優勢

這種方法特別適合以下場景：

1. **未知或變動的 JSON 結構**：當我們不確定 JSON 的確切結構，或者結構可能變化時。

2. **一次性解析**：當我們只需要從 JSON 中提取少量資訊，而不需要建立完整的強型別模型時。

3. **動態 API response**：處理第三方 API 的 response，尤其是當 API 的 response 格式可能變化或包含大量我們不關心的資訊時。

4. **建立靈活的數據處理功能**：可以讓使用者動態定義資料轉換規則，而不需要修改程式碼。

這種方法的優勢包括：

- **靈活性**：不需要預先定義所有可能的屬性和結構。
- **簡潔性**：減少了大量的類別定義程式碼。
- **易於使用**：可以像使用強型別物件一樣使用動態物件。

## 注意事項與限制

儘管 `dynamic` 和 `ExpandoObject` 提供了靈活性，但也有一些需要注意的地方：

1. **效能開銷**：動態類型的解析和操作比強型別解析慢，因為類型檢查被推遲到運行時。

2. **缺少編譯時檢查**：編譯器不會檢查動態物件的屬性和方法是否存在，這可能導致運行時錯誤。

3. **Debug 困難**：動態物件的錯誤通常在運行時才會被發現，這可能增加 Debug 的難度。

## 總結

`dynamic` 和 `ExpandoObject` 為 C# 開發人員提供了處理動態數據的強大工具，特別是在處理未知或變化的 JSON 結構時。雖然這種方法有一些限制和性能開銷，但在適當的場景下，它可以大大簡化我們的程式碼並提高開發效率。

在實際開發中，我建議根據具體需求選擇合適的方法：

- 對於已知且不變的 JSON 結構，使用強型別類別可能更合適。
- 對於未知或變化的 JSON 結構，或者只需要提取部分數據的情況，使用 `dynamic` 和 `ExpandoObject` 可能是更好的選擇。
