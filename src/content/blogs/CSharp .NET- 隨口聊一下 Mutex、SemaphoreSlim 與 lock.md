---
title: "C# 隨口聊一下 Mutex、SemaphoreSlim 與 lock"
datetime: "2025-09-08"
description: "身為後端工程師，或多或少我們都有遇過**併發**的情境，舉個例子: 訂票、交易等等。 我們都明白在多執行緒環境下確保資源的同步存取是重要的事情。 任何對共享資源的誤判都可能導致資料錯亂、系統崩潰等後果。今天就來聊聊三種關鍵的同步機制：lock、Mutex 和 SemaphoreSlim。"
image: "/images/titles/CSharp-lock.png"
---

## 前言 

身為後端工程師，或多或少我們都有遇過**併發**的情境，舉個例子: 訂票、交易等等。 我們都明白在多執行緒環境下確保資源的同步存取是重要的事情。 任何對共享資源的誤判都可能導致資料錯亂、系統崩潰等後果。今天就來聊聊三種關鍵的同步機制：lock、Mutex 和 SemaphoreSlim。

## 1. lock：輕量級的Process內獨佔鎖

`lock` 是 C# 中最常用的執行緒同步機制。它實質上是 `Monitor.Enter()` 和 `Monitor.Exit()` 的語法糖，提供了一種簡單的方式來確保程式碼區塊（臨界區）在同一時間只能被一個執行緒執行。

### 核心特性

- 範圍：僅限於單一Process (Process) 內。它無法用於跨Process的同步。
- 效能：非常輕量且快速，因為它通常在使用者模式下運作，只有在發生爭用時才會切換到核心模式。
- 用途：保護Process內的記憶體資源，如集合、物件狀態等。
- 可重入性 (Re-entrant)：同一個執行緒可以重複取得同一個鎖而不會造成 dead-lock。
- 實用場景：保護記憶體快取

### 實作一下：保護記憶體快取

假設我們的 API 需要一個簡單的記憶體快取來存放資料，為了避免多個請求同時讀寫這個快取導致資料不一致，lock 是最理想的選擇。

```csharp

   public class SharedResourceService
   {
       private readonly object _cacheLock = new object();
       private readonly Dictionary<string, object> _cache = new Dictionary<string, object>();

       public object? GetOrSetCache(string key, Func<object> valueFactory)
       {
           // 第一次檢查，避免不必要的鎖定
           if (_cache.TryGetValue(key, out var value))
           {
               return value;
           }

            lock (_cacheLock)
            {
                // 再次檢查，防止在等待鎖的期間，其他執行緒已經寫入
                if (!_cache.ContainsKey(key))
                {
                    var newValue = valueFactory();
                    _cache[key] = newValue;
                    return newValue;
                }
                return _cache[key];
            }
       }
   }

// Controller
[ApiController]
[Route("[controller]")]
public class DemoController : ControllerBase
{
private readonly SharedResourceService _service;

    public DemoController(SharedResourceService service)
    {
        _service = service;
    }

    [HttpGet("cache-test")]
    public IActionResult CacheTest()
    {
        string cacheKey = "my_data";
        var data = _service.GetOrSetCache(cacheKey, () => {
            // 模擬從資料庫或外部服務取得資料的耗時操作
            Thread.Sleep(200);
            return $"Data generated at {DateTime.UtcNow:O}";
        });
        return Ok(data);
    }
}
```

### 決策分析

在這個場景下，`_cache` 字典是一個Process內的共享資源。多個 HTTP 請求（由不同的執行緒處理）可能會同時觸發 `GetOrSetCache`。

- 使用 `lock` 可以確保對字典的寫入操作是原子性的，既簡單又高效。
- 選擇 `Mutex` 會因為其跨Process的能力而帶來不必要的效能開銷
- 選擇`SemaphoreSlim` 則是用於限制併發數量，而非獨佔存取，因此 `lock` 是此處的最佳選擇。

---

## 2. `Mutex`：重量級的跨 Process 同步守門員

`Mutex` (Mutual Exclusion) 是一種更強大的鎖，它可以被命名，並用於作業系統層級的同步，這意味著它可以用於協調不同Process之間的資源存取。

### 核心特性
*   **範圍**：可以是Process內，也可以是系統級別的跨Process同步。
*   **效能**：比 `lock` 慢得多，因為它是一個核心物件，每次操作都可能涉及核心模式的切換。
*   **用途**：保護系統級的共享資源，例如檔案、網路埠，或確保某個應用程式只有一個執行個體在執行。
*   **等待控制**：繼承自 `WaitHandle`，可以與 `WaitAny`, `WaitAll` 等方法結合使用。

### 實作一下：確保單一背景任務執行

想像一個場景：你的 Web API 需要觸發一個非常耗資源的背景任務（例如：每日報表生成）。你希望在任何時候，即使應用程式部署在多個實例上（例如負載平衡的 Web Farm），這個任務在整個系統中也只有一個實例在執行，以避免重複處理或資源衝突。

**注意**：在現代雲端架構中，通常會使用如 Redis、ZooKeeper 等分散式鎖服務來處理此類問題。但若環境限制在單一伺服器上的多個Process，`Mutex` 依然是個可行的選項。

**範例程式碼：**

```csharp
public class SharedResourceService
{
    // Mutex 名稱必須在整個作業系統中是唯一的
    private const string ReportGenerationMutexName = "Global\\MyWebAppReportGenerationMutex";

    public string TriggerReportGeneration()
    {
        // 嘗試取得 Mutex，等待時間為 0 表示不阻塞
        using (var mutex = new Mutex(false, ReportGenerationMutexName))
        {
            bool hasHandle = false;
            try
            {
                // 嘗試立即取得鎖
                hasHandle = mutex.WaitOne(0, false);

                if (!hasHandle)
                {
                    // 未取得鎖，表示已有其他Process或執行緒在執行
                    return "Report generation is already in progress by another process.";
                }

                // --- 成功取得鎖，開始執行耗時任務 ---
                Console.WriteLine($"[{DateTime.UtcNow:O}] Acquired mutex. Starting report generation...");
                Thread.Sleep(10000); // 模擬耗時 10 秒的任務
                Console.WriteLine($"[{DateTime.UtcNow:O}] Report generation finished.");
                return "Report generation started successfully and is now complete.";
                // --- 任務結束 ---
            }
            finally
            {
                if (hasHandle)
                {
                    // 確保釋放 Mutex
                    mutex.ReleaseMutex();
                }
            }
        }
    }
}
```

### 決策分析：

此場景的關鍵需求是「跨Process」的「獨佔」。lock 無法勝任，因為它的範圍僅限於單一Process。SemaphoreSlim 雖然可以限制併發數為 1，但它同樣是Process內的。因此，只有 Mutex 能夠提供系統級的鎖定，確保無論是同一個 Web API Process內的多個請求，還是不同Process實例的請求，都能被正確地同步。

## 3. SemaphoreSlim：併發流量管理員

SemaphoreSlim 是一個輕量級的機制(使用 flag進行控管)，它與鎖的核心區別在於：鎖（lock/Mutex）在同一時間只允許一個執行緒進入，而SemaphoreSlim則允許多個執行緒進入，但會限制最大併發數量。

### 核心特性

- 範圍：Process內。
- 非獨佔性：它不是用來保護特定資源的獨佔存取，而是用來限制能夠同時執行某段程式碼的執行緒數量。
-  非同步支援：提供了 WaitAsync() 方法，能與 async/await 完美結合，避免在等待時阻塞執行緒。這在 Web API 中極為重要。
- 效能：比 Mutex 快，且在非同步場景下比 lock 更適合。

### 實作一下：限制對外部 API 的呼叫速率

假設我們的 API 需要呼叫一個第三方的服務，而該服務有速率限制，例如「最多只允許 5 個併發連線」。如果我們不加限制地轉發請求，很容易就會因為超過速率而被封鎖。SemaphoreSlim 正是為此而生。

```csharp
public class SharedResourceService
{
    // 設定最多只允許 5 個併發請求
    private readonly SemaphoreSlim _apiRateLimiter = new SemaphoreSlim(5, 5);
    private readonly HttpClient _httpClient = new HttpClient();

    public async Task<string> CallLimitedExternalApiAsync()
    {
        Console.WriteLine($"[{DateTime.UtcNow:O}] Waiting to enter the semaphore. Current count: {_apiRateLimiter.CurrentCount}");

        // 非同步等待號誌
        await _apiRateLimiter.WaitAsync();

        try
        {
            Console.WriteLine($"[{DateTime.UtcNow:O}] Entered the semaphore. Starting external API call...");
            // 模擬呼叫外部 API
            var result = await _httpClient.GetStringAsync("https://httpbin.org/delay/2");
            Console.WriteLine($"[{DateTime.UtcNow:O}] External API call finished.");
            return result;
        }
        finally
        {
            // 確保釋放號誌
            _apiRateLimiter.Release();
            Console.WriteLine($"[{DateTime.UtcNow:O}] Released the semaphore. Current count: {_apiRateLimiter.CurrentCount}");
        }
    }
}
```

### 決策分析：

這個場景的核心是「限流 (Throttling)」，而不是「獨佔」。我們不關心是哪個執行緒在呼叫外部 API，只關心同時呼叫的數量。
lock 和 Mutex 會將併發數降為 1，這過於嚴格，無法充分利用第三方服務允許的吞吐量。
SemaphoreSlim 的 WaitAsync 方法是關鍵優勢。在 .NET Core 的非同步pipeline中，它可以在等待時將執行緒釋放回執行緒池，去處理其他 HTTP 請求，從而極大地提升了伺服器的吞吐能力和擴展性。

總結與決策樹
| 特性         | lock                      | Mutex                              | SemaphoreSlim                  |
|--------------|--------------------------|------------------------------------|-------------------------------|
| 主要用途     | 臨界區的獨佔存取         | 跨Process的獨佔存取                   | 限制併發執行緒數量            |
| 範圍         | Process內 (In-Process)      | 系統級 (Cross-Process)             | Process內 (In-Process)           |
| 效能         | 非常高                   | 較低 (核心物件)                    | 高 (輕量級)                   |
| 非同步支援   | 不支援 (會阻塞執行緒)    | 不直接支援 async                   | 完美支援 (WaitAsync)          |
| 適用場景     | 保護記憶體物件 (集合、快取) | 保護檔案、網路埠等系統資源；單例應用程式 | API 速率限制；資源池管理      |



結論
在併發的世界中，沒有絕對的答案。lock、Mutex 和 SemaphoreSlim 各有其明確的定位，我們可以 follow 以下的決策方式:

- 你的問題是否需要跨Process同步？
  - 是：選擇 Mutex 或考慮使用 Redis 等分散式鎖。
  - 否：繼續下一步。
- 你是需要「獨佔存取」還是「限制併發數」？
  - 獨佔存取 (一次一個)：繼續下一步。
  - 限制併發數 (一次 N 個)：選擇 SemaphoreSlim。
- 你的程式碼是否在 async/await 環境中？
  - 是：強烈建議使用 SemaphoreSlim(1, 1) 來模擬非同步鎖，避免 lock 阻塞執行緒。
  - 否：選擇 lock，它是最簡單高效的選擇。


作為開發人員，我們的價值不僅在於知道如何使用它們，更是要知道甚麼時候要使用它們。
