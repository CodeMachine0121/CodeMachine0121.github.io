---
title: "Day 3: 啟動協程的三種姿勢 — launch, async 與 Job 的掌控權"
datetime: "2026-02-13"
description: 在 Java/Android 的世界裡，要從一個背景執行緒拿到結果通常很麻煩（需要 Callback 或是 Future.get() 阻塞）。Kotlin 協程提供了兩個最強大的武器：launch 和 async。"
parent: "Kotlin Coroutines Bootcamp"
---

在 Java/Android 的世界裡，要從一個背景執行緒拿到結果通常很麻煩（需要 Callback 或是 `Future.get()` 阻塞）。Kotlin 協程提供了兩個最強大的武器：**`launch`** 和 **`async`**。

## `launch` vs `async`：到底該用哪個？

這兩個都是用來啟動新協程的「構建器 (Builder)」，但目的完全不同。

### 🚀 `launch`：射後不理 (Fire-and-Forget)
*   **含義**：「我發射一個火箭，我不指望它飛回來帶給我什麼紀念品。」
*   **返回值**：`Job`。
*   **用途**：執行那些 **不需要返回結果** 的任務。例如：寫入 Log、更新資料庫、發送 Analytics 事件。
*   **異常處理**：如果裡面爆掉了，它會直接拋出異常（如果沒抓就會 Crash）。

```kotlin
val job = scope.launch {
    // 做一些事情...
    println("Log 寫入完成")
}
// job 無法 .await()，只能 .join() 等待它結束
```

### 📡 `async`：有去有回 (Compute a Result)
*   **含義**：「我派一個間諜出去，他任務完成後必須帶一份機密文件回來。」
*   **返回值**：`Deferred<T>` (這是 `Job` 的子類別，帶有結果泛型)。
*   **用途**：執行 **需要計算結果** 的任務。例如：抓取網路 API JSON、讀取檔案內容、複雜數學運算。
*   **獲取結果**：使用 `.await()`。

```kotlin
val deferred = scope.async {
    // 做一些運算...
    return@async 42
}
val result = deferred.await() // 拿到 42
```

---

## 2. 實戰：並行執行的威力 (Concurrent Execution)

這是新手最容易犯錯的地方。請仔細看下面兩個例子的區別。

假設我們有兩個耗時任務：
1.  `getStockPrice("Apple")` (需 1000ms)
2.  `getStockPrice("Google")` (需 1000ms)

我們希望拿到兩個股價的總和。

### ❌ 錯誤寫法：序列執行 (Sequential)

```kotlin
suspend fun calculateTotal() {
    val start = System.currentTimeMillis()
    
    // 這裡雖然用了 async，但馬上就 await，導致這裡會 "暫停" 等待結果
    val apple = async { getStockPrice("Apple") }.await() 
    
    // 等上面 1000ms 跑完，才開始跑這個
    val google = async { getStockPrice("Google") }.await()

    println("總價: ${apple + google}")
    println("耗時: ${System.currentTimeMillis() - start} ms")
}
```
**結果**：耗時 **2000ms**。這跟沒用協程一樣慢！

### ✅ 正確寫法：並發執行 (Concurrent)

```kotlin
suspend fun calculateTotal() = coroutineScope {
    val start = System.currentTimeMillis()
    
    // 1. 同時啟動兩個任務 (非阻塞)
    val appleDeferred = async { getStockPrice("Apple") }
    val googleDeferred = async { getStockPrice("Google") }

    // 2. 這時候兩個都在背景跑... 我們可以在這裡做別的事

    // 3. 需要結果時，再 await
    val applePrice = appleDeferred.await()
    val googlePrice = googleDeferred.await()

    println("總價: ${applePrice + googlePrice}")
    println("耗時: ${System.currentTimeMillis() - start} ms")
}
```
**結果**：耗時 **1000ms** (取兩者最大值)。
因為兩個任務是同時跑的。這就是 `async` 最大的價值。

---

## 3. `Job` 與 `Deferred`：遙控器的按鈕

當你呼叫 `launch` 或 `async` 時，你會得到一個物件 (`Job` 或 `Deferred`)，你可以把它想像成這個協程的「遙控器」。

### 遙控器上的功能鍵：

1.  **`join()`**：
    *   **暫停** 當前協程，直到那個 Job 完成。
    *   不關心結果，只關心「它做完了沒」。

2.  **`cancel()`**：
    *   **取消** 那個 Job。
    *   如果使用者離開了頁面，原本還在跑的網路請求就應該被 cancel，節省資源。

3.  **`await()`** (僅限 `Deferred`)：
    *   **暫停** 當前協程，直到拿到結果。
    *   如果 Job 被取消了，呼叫 `await()` 會拋出 `CancellationException`。

### ⚠️ 關於 `runBlocking` 的回顧

結合 Day 2，我們來看一個完整的 `main` 函數範例：

```kotlin
fun main() = runBlocking {
    println("主程式開始")

    val job = launch {
        repeat(1000) { i -> run {
                println("下載中... $i%")
                delay(500)
            }
        }
    }

    delay(1300) // 主程式休息一下，讓協程跑一會兒
    println("主程式：等太久了，取消！")
    
    job.cancel() // 發送取消信號
    job.join()   // 等待協程真正的結束 (處理後事)
    
    println("主程式：安全退出")
}
```
**輸出**：
1. 下載中... 0%
2. 下載中... 1%
3. 下載中... 2%
4. 主程式：等太久了，取消！
5. 主程式：安全退出

*(註：如果沒有 `job.join()`，有可能 "安全退出" 會在協程完全清理乾淨之前印出來，這是 Race Condition 的細節)*

---

## 4. 懶加載協程 (Lazy Async) - 進階技巧

有時候你創建了一個任務，但不想馬上執行，想等到「真的有人需要結果」時再執行。

```kotlin
val deferred = async(start = CoroutineStart.LAZY) {
    println("開始計算...")
    return@async 100
}

println("Deferred 創建了，但還沒跑")
delay(1000)
println("現在我需要結果了")
deferred.start() // 或直接呼叫 deferred.await() 也會觸發啟動
```

---

## Day 3 總結

1.  **`launch`**：適合「副作用」任務 (Fire-and-forget)，返回 `Job`，無法直接拿結果。
2.  **`async`**：適合「計算/查詢」任務，返回 `Deferred`，透過 `.await()` 拿結果。
3.  **並行技巧**：不要在 `async` 後馬上 `await()`，除非你有順序依賴。應該先全部 `async` 啟動，最後再統一 `await()`。
4.  **`Job`**：是協程的控制程式碼，可以用來 `cancel()` 或 `join()`。

---

### 🟢 今日練習 (Homework)

**目標**：模擬一個「比價系統」。
1.  建立三個 `suspend` 函數，分別模擬去 `PChome`、`Momo`、`Shopee` 查詢價格（使用 `delay` 模擬不同耗時，例如 1秒、2秒、1.5秒），並返回隨機價格。
2.  在 `runBlocking` 中，**並行 (Concurrently)** 查詢這三家網站。
3.  等待三家都返回結果後，找出**最低價格**並印出：「最便宜的是 XX 平台，價格 $XXX」。
4.  **挑戰**：計算總共花費的時間，確認它接近最慢的那個網站，而不是三者之和。

這個練習會讓你對 `async/await` 的並行能力有非常直觀的理解。

---

準備好了嗎？ **Day 4** 我們來討論一個重要的話題：**Dispatcher**。我們的協程到底跑在哪個 Thread 上？如何避免在 UI Thread 做耗時操作（ANR)。
