---
title: "Clean Architecture with ASP .NET Core by Ardalis"
datetime: "2025-11-17"
description: "觀看完 2025年 .net conf 後，對這個 Topic 覺得說得還不錯，故透過筆記記錄。"
image: "/images/titles/clean-architecture-with-dotnet10.png"
class: "responsive-blog-post"
---

Hi all, 在看完這部由 Ard Dallas 解說 .Net 10 的 Clean Architecture [影片](https://www.youtube.com/watch?v=rjefnUC9Z90)後，覺得還不錯，透過這份筆記將知識點記錄下來，也鼓勵大家先去看完影片再來看這邊或是自行消化。

### 簡介

本演講由 Ard Dallas（本名 Steve Smith）主講，探討如何在 ASP.NET Core 10 中應用 Clean Architecture。講者提到，雖然他已多次分享 Clean Architecture，但他每年都會納入新的學習和 .NET Core/ASP.NET 的新功能。

#### 軟體架構的黃金法則：權衡取捨（Trade-off）

架構的第一條規則是：軟體架構中的一切都是一種**權衡取捨 (trade-off)**。這句話源自《軟體架構基礎》（Fundamentals of Software Architecture）一書，它強調了在設計系統和選擇架構時，沒有絕對正確的答案，因為**一切都取決於（it depends）**具體的上下文。

影響架構選擇的上下文因素包括：您正在建構什麼、使用者是誰、需要的性能、數據量、以及團隊的知識和經驗水平。不同的架構在諸如模組化程度、建造成本、複雜性、可測試性、可擴展性和性能等能力之間都存在著權衡。

### Clean Architecture 的演進背景

Clean Architecture 的出現是為了解決歷史上軟體開發中的關鍵問題。

1. 1990 年代：客戶端-伺服器架構 (Client Server Architecture)：企業軟體的主要開發方式。應用程式通常依賴於一個龐大且昂貴的資料庫伺服器。儘管這確保了所有應用程式都能「免費」看到資料變動（例如客戶電話號碼更新），但缺點是所有應用程式都依賴相同的資料庫結構。任何應用程式想要更改資料庫 Schema 都會受到限制，導致資料庫中許多欄位隨著時間推移被新增為可空（nullable），以滿足特定應用程式的需求。
2. 分層架構 (Layered Architecture)：這種架構將程式碼邏輯上分離為 UI、業務邏輯和資料存取層。然而，在初期實作時，這種方法幾乎總是導致所有層級都間接或直接地依賴於資料庫。
3. 測試的興起：在 2000 年代初期，單元測試和 TDD（Test-Driven Development）開始流行。由於分層架構中對資料庫的強依賴性，執行業務邏輯的測試變得困難，通常需要一個測試資料庫，這阻礙了自動化測試和持續整合（CI）的推廣。
4. 領域驅動設計 (Domain-Driven Design, DDD)：Eric Evans 在 2003 年提出 DDD。其核心思想是讓應用程式更鬆散地耦合於基礎設施（應用程式執行過程之外的任何事物，如資料庫、檔案系統）。
5. 核心目標：從 DDD 開始，領域中心（Domain-Centric）架構的目標一直是：如何將我們的業務邏輯與所有使測試變得困難的基礎設施問題隔離開來。
6. 領域中心架構的演進：
  - 六角架構 (Hexagonal Architecture / Ports and Adapters)：這是第一個領域中心架構。它允許將資料庫或 XML 檔案等基礎設施作為「適配器」（adapters）插入到應用程式的核心領域邏輯中。這使得測試所有複雜的業務規則變得非常容易和快速。
  - Clean Architecture (2011 年發表第一篇文章)：是繼六角架構、Onion Architecture 之後的最新演變。


### Clean Architecture 的核心：依賴規則 (The Dependency Rule)

Clean Architecture 的第一條規則是依賴規則：

- 依賴關係應流向核心專案或領域模型所在層，而非流向基礎設施。
- 在 .NET 專案中，這一規則可以透過編譯器來強制執行，因為 .NET 不允許專案之間存在循環引用 (如下圖)

![not-allow-dependency-.not-allow-dependency.png](/images/not-allow-dependency-.net-project.png)


### 架構層次結構：

在講者心裡的架構依賴關係應該要長這樣:

![allow-dependency-.net-project.png](/images/allow-dependency-.net-project.png)

1. Core Domain Project（核心領域專案）： 位於底部，包含所有純粹的業務邏輯和領域模型（實體、值對象等）。這裡的程式碼是純 C#，不包含任何依賴項，因此單元測試非常容易。
2. Application Layer / Use Cases（應用程式層/使用案例）： 實作使用案例，通常透過命令和查詢（CQRS）來執行，例如「新增項目到購物車」。
3. Infrastructure Project（基礎設施專案）： 包含所有外部關注點，例如資料庫存取（使用 Entity Framework）。這個專案必須依賴於 Core 和 Use Cases 專案。
4. Web Front End（網頁前端）： ASP.NET Core 應用程式，負責處理 HTTP 請求。
基礎設施與核心領域之間的界限：Infrastructure 專案是唯一允許與外部程序（資料庫、檔案系統等）溝通的部分。它通過實作定義在內部專案（Core/Use Cases）中的介面（interfaces）來作為適配器 (adapters)，確保核心邏輯無法依賴於基礎設施。

### 專案建立的Demo

影片中作者為我們 demo 了一小段他的 Clean Architecture, 其中他的 Solution 底下會有四個專案：Core, Infrastructure, UseCases, Web。 以下是他建立專案的指令（我認為不用指令透過人工方式去新增也可以）

首先，講者事先做好了一個 .net project 的 template，我們需要先下載起來

```bash
dotnet new install Ardails.CleanArchitecture.Template
```

接著我們可以使用下面指令查看細節

```bash
dotnet new clean-arch -?
```

最後以這個指令新增專案

```bash
dotnet new clean-arch -o <Project-Name>
```

### 實作上的挑戰：垂直切片架構 (Vertical Slice Architecture)

Clean Architecture 的一個常見批評是，當開發者新增一個功能時，必須在多個專案之間跳轉（Web、Use Cases、Core）。
**垂直切片架構（VSA）**是 Feature Folder 的重新命名，它將程式碼按「功能」（feature）組織。VSA 的問題在於，若所有程式碼都在一個專案中，開發者很容易在某個功能中直接依賴於基礎設施（例如直接使用 DbContext），從而破壞了 Clean Architecture 的依賴規則。

### 解決方案：NSECOP (Namespace Dependency Cop)

講者推薦了一個工具 [NSECOP](https://github.com/realvizu/NsDepCop)，它允許開發者在實行垂直切片架構的同時，強制執行 Clean Architecture 的依賴規則。通過在設定中指定哪些命名空間之間的引用是非法的，NSECOP 會在編譯時拋出錯誤（例如 NSE depppcop01），防止核心領域程式碼依賴於資料命名空間。這使得開發者可以同時享受按功能組織程式碼的便利性，以及 Clean Architecture 嚴格的依賴隔離。


### 總結

Clean Architecture 就像一個國家邊境管制系統。核心領域（國家內部）是珍貴的業務邏輯，它不能直接依賴於外界基礎設施（鄰國或港口）。所有進出國境（與資料庫、文件系統等互動）的交通，都必須通過嚴格管制的邊境檢查站，也就是基礎設施層實作的介面（Ports and Adapters），確保核心業務邏輯的純淨和安全，不受外部變動的影響。
