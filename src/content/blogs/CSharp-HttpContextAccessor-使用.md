---
title: 使用 HttpContextAccessor
datetime: "2025-04-23"
---

Hi all，因應工作需求，我們使用了在日常開發中不太常用的 `HttpContextAccessor`，覺得很方便，特此做個筆記。

## 情境介紹

- 多個 API 需要共用相同參數（以下以 `customerId` 為例）。
- 業務邏輯層需先將 `customerId` 轉換後再使用。
- 如果在每個 API 都分別定義相同的 Request Model 並實現相同的轉換邏輯，程式碼會大量重複。
- 因此，我們希望透過依賴注入（DI）注入一個 `StatusContext`，在其中統一取得並轉換 `customerId`，上層使用時只要注入即可。

<!--more-->

## 解決方案

使用 `HttpContextAccessor` 來存取 `HttpContext`，並取得路由參數：

```csharp
services.AddHttpContextAccessor();

var httpContextAccessor = provider.GetRequiredService<IHttpContextAccessor>();
var httpContext = httpContextAccessor.HttpContext;
if (httpContext.Request.RouteValues.TryGetValue("customerId", out var routeValue))
{
    var customerId = routeValue?.ToString();
    var convertedCustomerId = DoSomething(customerId);
}
```

接著將 `customerId` 及轉換後的結果封裝成物件，並註冊到 DI 容器：

```csharp

public class StatusContext
{
    public string CustomerId { get; set; }
    public string ConvertedCustomerId { get; set; }
}

services.AddScoped<StatusContext>(provider=>
{
    var httpContextAccessor = provider.GetRequiredService<IHttpContextAccessor>();
    var httpContext = httpContextAccessor.HttpContext;
    if (httpContext.Request.RouteValues.TryGetValue("customerId", out var routeValue))
    {
        var customerId = routeValue?.ToString();
        var convertedCustomerId = DoSomething(customerId);
        return new StatusContext
        {
            CustomerId = customerId,
            ConvertedCustomerId = convertedCustomerId
        };
    }

    return new StatusContext();
});
```

## 總結

這邊就直接讓 agent 結論了。

使用 `HttpContextAccessor` 可以：

1. 直接存取 HTTP 請求參數，免去在每個 API 重複定義 Request Model。
2. 將參數轉換邏輯集中在同一處，提升程式碼可讀性與可維護性。
3. 透過 DI 容器注入 `StatusContext`，在需要的地方直接注入，減少重複程式碼。

此方案特別適合多個 API 共用參數的場景，但也要避免過度依賴，以免使業務邏輯層與 HTTP 層過度耦合。
