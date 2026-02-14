---
title: "Day 5: 結構化並發 (Structured Concurrency) — 馴服野生協程的韁繩"
datetime: "2026-02-14"
description: "無論是在實際開發中（特別是 Android/Backend）或是 現實生活中，我們最怕的是 「僵屍」的出現。在開發上的殭屍是指那些使用者已經離開頁面，卻還在背景默默下載大檔案、消耗電量、甚至導致記憶體洩漏 (Memory Leak) 的任務。今天我們要學習 Kotlin 協程最引以為傲的設計哲學：結構化併發 (Structured Concurrency)。"
parent: "Kotlin Coroutines Bootcamp"
---

在傳統的 Thread 世界裡，如果你創建了一個 Thread，它就變成了一個「野生」的執行緒。除非你手動保留它的引用並 kill 掉它，否則它會一直跑到結束。這就是 **"Fire-and-forget" (射後不理)** 的隱患。

Kotlin 引入了 **結構化並發**，它的核心規則只有一條：
> **新的協程必須在一個特定的作用域 (Scope) 中啟動。**

這就像是「家」的概念。協程不能流浪，必須有家長。

## 1. 父子協程的「連坐法」 (Parent-Child Relationship)

當你在一個協程（父）中啟動另一個協程（子）時，神奇的事情發生了：
1.  **繼承**：子協程會繼承父協程的 Context（Day 4 有提及）。
2.  **生命週期綁定**：父協程會自動等待所有子協程完成，才能算「完工」。
3.  **取消傳播**：如果父協程被取消，所有子協程也會收到取消信號。

### 👨‍👦 實作：父死子亡，子死父悲

```kotlin
fun main() = runBlocking {
    println("1. 爸爸 (Parent) 開始工作")

    val parentJob = launch { // 啟動父協程
        
        // 子協程 A
        launch { 
            repeat(10) { i ->
                println("   👶 子協程 A: 我還活著 $i")
                delay(500)
            }
        }

        // 子協程 B
        launch {
            delay(2000)
            println("   👶 子協程 B: 我做完了")
        }
    }

    delay(10000)
    println("2. 發生意外！取消爸爸！")
    
    // 關鍵時刻：取消父協程
    parentJob.cancel()
    parentJob.join() // 等待清理完成

    println("3. 全家都結束了")
}
```

**輸出結果**：
你會發現，當 `parentJob.cancel()` 被呼叫後，**子協程 A 和 B 都會立刻停止**。
這就是結構化並發的威力：**你不需要手動去追蹤每一個啟動的任務，只要控制最上層的 Scope，就能一鍵清理所有背景任務。**

---

## 2. 千萬別用 `GlobalScope` (The Forbidden Fruit)

在網路上的舊教學中，你可能會看到這樣的程式碼：

```kotlin
// ❌ 錯誤示範
GlobalScope.launch {
    // 下載檔案...
}
```

**為什麼 `GlobalScope` 是惡魔？**
*   它沒有父母（它是孤兒）。
*   它的生命週期跟整個 App 一樣長。
*   如果你在 Activity 中用了它，就算 Activity 關閉了，它還在跑。這就是 **Memory Leak** 的元兇。

**✅ 正確做法：**
總是使用綁定生命週期的 Scope。
*   **Android**: 使用 `viewModelScope` 或 `lifecycleScope`。
*   **一般 Kotlin**: 創建自己的 `CoroutineScope` 並在適當時機 `cancel`。

---

## 3. `coroutineScope` Builder：打造自己的結構

Day 2 我們簡單提過 `coroutineScope`，現在從結構的角度重新看它。
它是一個 suspend 函數，它會**創建一個新的子作用域**，並繼承外部的 Context。

它的特點是：**「同生共死」**。
如果 `coroutineScope` 內部啟動了 3 個子協程，只要其中 **任何一個失敗 (拋出異常)**，整個 Scope 就會失敗，並自動取消另外 2 個還在跑的協程。

### 💥 實作：連鎖反應 (Chain Reaction)

```kotlin
fun main() = runBlocking {
    try {
        doWork()
    } catch (e: Exception) {
        println("捕捉到異常: $e")
    }
}

suspend fun doWork() = coroutineScope { // 建立一個結構範圍
    val job1 = launch {
        println("Job 1: 正常工作中...")
        delay(1000)
        println("Job 1: 雖然我沒錯，但我會被連累取消...") // 這行不會印出來
    }

    val job2 = launch {
        println("Job 2: 我準備要搞砸了...")
        delay(500)
        throw RuntimeException("Job 2 發生爆炸！") // 拋出異常
    }
}
```

**發生了什麼事？**
1.  Job 2 爆炸。
2.  `coroutineScope` 收到錯誤通知。
3.  `coroutineScope` **立刻取消** Job 1。
4.  `coroutineScope` 將異常拋給外部。

這保證了你的程式狀態一致性：如果「下載圖片」失敗了，那麼「壓縮圖片」的任務就應該被取消，而不是浪費資源繼續跑。

---

## 4. 作用域取消的陷阱：Cancellation is Cooperative

雖然父協程說「取消！」，但子協程**不一定**會馬上停下來。
協程的取消是 **「協作式 (Cooperative)」** 的。

這意味著：子協程的程式碼必須「配合」檢查取消信號。

### ❌ 霸道的子協程 (無法取消)

```kotlin
val job = launch(Dispatchers.Default) {
    var i = 0
    while (i < 10) { // 這是一個死循環，且沒有檢查取消
        // 這裡沒有任何 suspend 函數 (如 delay)
        // 所以它佔著 CPU 不放，聽不到 cancel 信號
        Thread.sleep(500) // 模擬繁重運算 (Blocking)
        println("I am working $i")
        i++
    }
}
delay(1000)
job.cancel() // 這行程式碼發出信號，但上面的 loop 根本不理你
```

### ✅ 乖巧的子協程 (可取消)

要讓 CPU 密集型任務支持取消，你需要定期檢查 `isActive` 屬性或呼叫 `ensureActive()`。

```kotlin
val job = launch(Dispatchers.Default) {
    var i = 0
    while (isActive) { // ✅ 檢查點：如果你叫我停，我就跳出迴圈
        Thread.sleep(500)
        println("I am working $i")
        i++
    }
}
```
或者，只要你的程式碼中有呼叫標準的 suspend 函數（如 `delay()`, `yield()`, `withContext()`），它們內部都會自動檢查取消信號。

---

## Day 5 總結

1.  **結構化並發**：協程必須有家（Scope）。
2.  **父子關係**：
    *   父協程取消 $\rightarrow$ 子協程全部取消。
    *   子協程異常 $\rightarrow$ 父協程（默認）也會異常並取消其他兄弟。
3.  **Scope 選擇**：
    *   **禁止** `GlobalScope`。
    *   **推薦** `coroutineScope` 用於並行分解。
    *   **Android** 使用 `viewModelScope`。
4.  **取消機制**：取消需要程式碼配合（Check `isActive` 或呼叫 `yield()`）。

---

### 🟢 今日練習 (Homework)

**目標**：模擬一個「檔案下載器」，並實作「取消下載」功能。

1.  建立一個 `CoroutineScope` (可以用 `runBlocking` 模擬，或自定義 Scope)。
2.  啟動 3 個子協程，分別模擬下載「檔案 A (500ms)」、「檔案 B (1000ms)」、「檔案 C (2000ms)」。
3.  在下載過程中，每隔 100ms 印出進度條。
4.  在主程式等待 800ms 後，覺得下載太慢了，呼叫 Scope 的 `cancel()`。
5.  **驗證**：
    *   檔案 A 應該顯示「下載完成」。
    *   檔案 B 應該下載到一半被中斷。
    *   檔案 C 應該下載到一半被中斷。
    *   程式應該優雅結束，沒有報錯。

這個練習將讓你親手體驗「一人（Scope）得道（Cancel），雞犬（Children）升天（Stop）」的快感。

---

明天 **Day 6**，我們要深入探討剛剛提到的「異常傳播」問題。如果我不想要「一個子協程死掉，全家都死光」怎麼辦？我們會介紹 `SupervisorJob` 和 `try-catch` 的正確用法！
