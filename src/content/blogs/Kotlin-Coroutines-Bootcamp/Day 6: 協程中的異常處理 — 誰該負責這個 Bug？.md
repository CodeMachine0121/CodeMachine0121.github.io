---
title: "Day 6: 協程中的異常處理 — 誰該負責這個 Bug？"
datetime: "2026-02-14"
description: "在實際開發中，如果我同時發送 3 個 API 請求，其中一個失敗了（比如 404），我不希望另外兩個請求也被強制取消，甚至導致 App 閃退。今天我們要學習如何控制 **異常傳播 (Exception Propagation)**，以及如何正確地捕捉協程中的錯誤。"
parent: "Kotlin Coroutines Bootcamp"
---

在 Kotlin 協程中，異常處理有三個重要原則，與傳統 Java/Kotlin 程式碼略有不同。我們將依序破解這些誤區。

## 1. 誤區：外層的 `try-catch` 抓不到 `launch` 的錯

這是新手最常犯的錯誤。

### ❌ 錯誤寫法

```kotlin
fun main() = runBlocking {
    try {
        // 啟動一個新協程
        launch {
            throw RuntimeException("💥 發生爆炸！")
        }
    } catch (e: Exception) {
        // 你以為會抓到嗎？不，這裡永遠不會執行。
        println("捕捉到異常: $e")
    }
}
```

**為什麼抓不到？**
因為 `launch` 是一個「射後不理」的啟動器。它會立即返回，`try-catch` 區塊瞬間就執行結束了。而那個異常是在稍後（背景執行緒或下一個事件循環）才拋出的。這時外面的 `try-catch` 早就沒了。

### ✅ 正確寫法：在協程內部 catch

你必須把 `try-catch` 搬到協程**裡面**去。

```kotlin
launch {
    try {
        throw RuntimeException("💥 發生爆炸！")
    } catch (e: Exception) {
        println("成功捕捉: $e")
    }
}
```

---

## 2. 異常傳播：連鎖反應 (The Chain Reaction)

如果協程內部**沒有** `try-catch`，這個異常會去哪裡？

1.  子協程崩潰。
2.  異常向上傳播給 **父協程**。
3.  父協程 **取消** 自己。
4.  父協程 **取消** 所有其他的子協程（兄弟協程）。
5.  父協程將異常繼續往上拋... 直到頂層。

這就是所謂的 **「雙向傳播」**：異常向上（給父母），取消向下（給兄弟）。

### 💥 實作：一個失敗，全家遭殃

```kotlin
fun main() = runBlocking {
    val job = launch { // 父協程
        
        // 兄弟 A (無辜的受害者)
        launch {
            try {
                delay(Long.MAX_VALUE)
            } finally {
                println("兄弟 A: 為什麼要取消我！？😭")
            }
        }

        // 兄弟 B (肇事者)
        launch {
            delay(500)
            throw Exception("兄弟 B: 我搞砸了！")
        }
    }
    job.join()
}
```
**結果**：兄弟 B 拋出異常，父協程收到後，含淚殺了兄弟 A。

---

## 3. 解決方案：SupervisorJob 與 supervisorScope

如果你希望「兄弟登山，各自努力」，也就是**其中一個子協程失敗，不要影響其他人**，你需要使用 **Supervisor (監督者)** 模式。

### 🛡️ `supervisorScope`：防火牆

`supervisorScope` 是一個特殊的 Scope，它會改變異常傳播的規則：
*   **規則**：子協程發生異常時，**不會** 匯報給父協程，也不會取消其他兄弟。子協程自己負責處理這個異常。

```kotlin
fun main() = runBlocking {
    
    // 使用 supervisorScope 建立一個「防火牆」區域
    supervisorScope {
        
        // 兄弟 A (這次安全了)
        launch {
            delay(1000)
            println("兄弟 A: 我還活著！即使 B 失敗了。")
        }

        // 兄弟 B (肇事者)
        launch {
            delay(500)
            println("兄弟 B: 我要爆炸了...")
            throw Exception("B 失敗") 
            // 這裡雖然拋出異常，但 supervisorScope 會把它「吞掉」(或者交給 Handler)，
            // 不會擴散到 A。
        }
    }
    
    println("主程式繼續執行...")
}
```

> **注意**：`SupervisorJob` 只能處理它「直接」啟動的子協程。如果你在 `supervisorScope` 裡面再套一層普通的 `coroutineScope`，那麼那裡面還是會連鎖崩潰。

---

## 4. 最後的防線：CoroutineExceptionHandler (CEH)

有些異常你不想在每個地方都寫 `try-catch`，但你又希望能記錄下來（例如上報 Crashlytics）。這時可以使用 `CoroutineExceptionHandler`。

它是 `CoroutineContext` 的一部分（Day 4 學過），用來處理**未捕獲的異常**。

**⚠️ 重要限制**：
1.  它只能放在 **頂層 (Root) 協程** (例如 `viewModelScope.launch`) 或者 `SupervisorJob` 的直接子協程中才有效。
2.  它**不能阻止崩潰傳播**，它只是在崩潰發生時給你一個 Callback 通知（就像 `Thread.uncaughtExceptionHandler`）。

```kotlin
val handler = CoroutineExceptionHandler { context, exception ->
    println("⚠️ 全局捕獲異常: $exception in $context")
}

fun main() = runBlocking {
    val scope = supervisorScope(Dispatchers.Default + handler)

    scope.launch {
        throw RuntimeException("又爆炸了")
    }.join()
}
```
**輸出**：`⚠️ 全局捕獲異常: java.lang.RuntimeException: 又爆炸了 ...`

---

## 5. `launch` vs `async` 的異常處理差異

這兩者在異常處理上有巨大的區別：

*   **`launch`**：異常會被視為「未捕獲異常」，會**立即拋出**，並觸發 CEH。
*   **`async`**：異常會被封裝在 `Deferred` 物件中。
    *   如果你**不呼叫** `.await()`，這個異常就被吞掉了（在 Root 協程中）。
    *   當你呼叫 `.await()` 時，異常才會被拋出。

```kotlin
fun main() = runBlocking {
    val deferred = async {
        throw RuntimeException("Async 錯誤")
    }

    // 到這裡為止，程式都不會崩潰
    println("Async 啟動了，但還沒崩潰")

    try {
        deferred.await() // 💣 就在這裡爆炸！
    } catch (e: Exception) {
        println("在 await 時捕獲: $e")
    }
}
```

> **最佳實踐**：對於 `async`，總是在呼叫 `await()` 的地方包 `try-catch`。

---

## Day 6 總結：異常處理決策圖

當你在寫協程時，遇到可能出錯的程式碼，請依序思考：

1.  **這是可預期的錯誤嗎？** (如網路斷線)
    *   $\rightarrow$ 在協程內部使用 `try-catch`。
2.  **這是並行任務，且互不影響嗎？** (如同時下載多張圖)
    *   $\rightarrow$ 使用 `supervisorScope` 包裹，或在 `launch` 時加上 `SupervisorJob()`。
3.  **這是不可預期的 Bug 嗎？** (如 NullPointer)
    *   $\rightarrow$ 在最外層 Scope 加上 `CoroutineExceptionHandler` 來記錄 Log。
4.  **是 `launch` 還是 `async`？**
    *   `launch`: 異常會立即爆開。
    *   `async`: 異常會在 `await()` 時爆開。

---

### 🟢 今日練習 (Homework)

**目標**：打造一個「強健的 Data Loader」。

1.  創建一個 `supervisorScope`。
2.  在裡面啟動三個 `launch` 協程，分別模擬：
    *   **任務 A**: 成功加載 User Data (500ms)。
    *   **任務 B**: 加載 User Config 失敗，拋出異常 (200ms)。
    *   **任務 C**: 成功加載 User Icon (800ms)。
3.  為每個任務添加 `CoroutineExceptionHandler`，使得任務 B 失敗時，能印出 Error Log，但**不影響** A 和 C 的執行。
4.  驗證 A 和 C 最後都成功印出了「完成」。

(提示：雖然是在 `supervisorScope` 裡，但為了讓 Handler 生效，你可能需要將 Handler 傳入 `launch(handler) { ... }` 中)。

---

明天 **Day 7**，我們要從「單發任務」進化到「資料流」。如何讓協程之間像接力賽一樣傳遞資料？我們要介紹 **Channel (管道)**！
