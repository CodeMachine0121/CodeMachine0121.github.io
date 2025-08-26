---
title: '.Net: 快速生成 http client Kiota'
datetime: "2025-05-02"
---

## 前言

Hi all, 最近在團隊開發過程中，經常需要為 API 撰寫 client SDK，這是一項重複性高且耗時的工作。如果手動撰寫，不僅效率低下，而且容易出錯。最近，我們團隊([Jake](https://github.com/zz0108)、Kevin)發現了 Microsoft 開發的 [Kiota](https://learn.microsoft.com/zh-tw/openapi/kiota/overview) 工具，它可以根據 OpenAPI 規範自動生成強類型的 HTTP client SDK，大幅提升了我們的開發效率，覺得蠻好玩的 ，故做個筆記紀錄紀錄。

## Kiota 是什麼？

Kiota (Keee-oh-tah) 是 Microsoft 開發的開源工具，專門用於根據 OpenAPI 描述生成類型安全的 API client。它的名稱來源於希臘語中的「κοιτά」，意為「看」或「觀察」，象徵著它能夠「觀察」API 描述並生成相應的 client code。

## 安裝 Kiota

要使用 Kiota，首先需要安裝 .NET SDK 7.0 或更高版本，然後通過 .NET CLI 安裝 Kiota：

```bash
dotnet tool install --global Microsoft.OpenApi.Kiota
```

安裝完成後，可以通過以下命令驗證安裝：

```bash
kiota --version
```

<!--more-->

## 使用 Kiota 生成 HTTP Client

### 基本使用流程

1. **準備 OpenAPI 描述文件**：確保你有一個有效的 OpenAPI 描述檔（JSON 或 YAML 格式）
2. **Generate Client**：使用 Kiota 命令行工具生成 Client Code
3. **Apply 到專案**：將生成的 Client Code 套用進專案中，並加以 DI

### 實際操作範例

假設目前已經有一個 Test API ， 且套用 Swagger，因此我們可以從以下 url 取得 OpenAPI 描述檔

```bash
http://{test-api-url}/swagger/v1/swagger.json
```

接著，在這邊提供一個 Kiota 指令的 template 往後可以 base on template 繼續使用

```bash
kiota generate \
    -d http://{test-api-url}/swagger/v1/swagger.json \
    -l csharp \
    -o ./TestAPI.Client \
    -n TestAPI.Client \
    -c TestAPIClient \
    --include-path "/api/v1/test-api/**"
```

- 參數說明
  - `-d`：OpenAPI 描述檔的 URL
  - `-l`：生成 Client 的語言，例如 C#、Java、TypeScript 等
  - `-o`：生成 Client 的目錄
  - `-n`：生成 Client 的命名空間
  - `-c`：生成 Client 的類別名稱
  - `--include-path`：要包含在 Client 中的 API 路由，例如 `"/api/v1/test-api/**"`

這將在 `./TestAPI.Client` 目錄下生成 C# Client code，並使用 `TestAPI.Client` 命名空間。

### 專案集成

在引用 Http Client 的專案中，需要添加以下 NuGet 套件：

```bash
dotnet add package Microsoft.Kiota.Abstractions
dotnet add package Microsoft.Kiota.Http.HttpClientLibrary
```

### DI Http Client

在這邊主要就是讓 Kiota 生成的 client 能夠與 http client 進行整合，並註冊到 DI 容器中

```csharp
services.AddScoped<TKiotaHttpClient>(sp =>
{
    var clientFactory = sp.GetRequiredService<IHttpClientFactory>();
    var httpClient = clientFactory.CreateClient(nameof(TKiotaHttpClient));
    var authProvider = sp.GetRequiredService<IAuthenticationProvider>(); // 注意使用者需要自行實作
    var adapter = new HttpClientRequestAdapter(authProvider, httpClient: httpClient);
    return (TKiotaHttpClient)Activator.CreateInstance(typeof(TKiotaHttpClient), adapter)!;
});
```

### 使用生成的客戶端

下面是一個使用生成的客戶端訪問 Test API 的簡單示例：

```csharp
public class TestApiClient(TKiotaHttpClient client)
{
    public async Task<string> GetDataAsync()
    {
        var response = await client.Api.V1.Test.GetSomeData.GetAsync();
        return response.Body;
    }
}
```

## 使用 Kiota 的優勢

在我們團隊的實際使用過程中，Kiota 帶來了以下明顯優勢：

1. **開發效率提升**：不再需要手動寫 client code，可以專注於業務邏輯
2. **減少錯誤**：自動生成的 code 減少了手動寫 client code 時可能出現的錯誤
3. **易於維護**：當 API 規範更新時，只需重新生成 client code 即可
4. **一致性**：生成的 code 遵循一致的模式和命名約定

## 注意事項與限制

雖然 Kiota 非常方便，但在使用過程中我們也發現了一些限制：

1. **OpenAPI 規範要求**：需要有規範且完整的 OpenAPI 文檔
2. **生成 code 的大小**：對於大型 API，生成的 code 可能會很大
3. **學習曲線**：需要一些時間來熟悉 Kiota 的工作流程和生成的 code 結構
4. **自定義擴展**：某些特殊需求可能需要手動修改生成的 code

## 總結

Kiota 是一個方便的工具，可以簡化我們手寫 client code 的過程，並兼具類型安全和一致的效果。

## 參考資料

- [Kiota 官方文檔](https://learn.microsoft.com/zh-tw/openapi/kiota/)
- [Kiota GitHub 倉庫](https://github.com/microsoft/kiota)
- [OpenAPI 規範](https://swagger.io/specification/)
