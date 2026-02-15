---
title: "Day 2: 關鍵字大解密 — suspend, runBlocking, coroutineScope, launch"
datetime: "2026-02-13"
description: "今天我們不談深奧的理論，而是專注於掃除新手最常見的誤區。你是否曾經困惑：為什麼加了 suspend 程式碼還是卡住？runBlocking 到底該不該用？它跟 coroutineScope 又有什麼差別？在這一天，我們將深入拆解 suspend、launch、runBlocking 與 coroutineScope。透過程式碼實戰，你將徹底釐清 「阻塞 (Blocking)」 與 「暫停 (Suspending)」 的本質區別，學會如何正確地啟動協程，建立連接「同步世界」與「非同步世界」的橋樑。"
parent: "Kotlin Coroutines Bootcamp"
---

今天我們要把這四個最容易混淆的概念一次講清楚。

## 1. `suspend`：只是個標記 (The Marker)

這是最基礎的關鍵字。
**誤區**：很多人以為加上 `suspend`，函數就會自動跑到背景執行緒去執行。
**真相**：`suspend` **不會** 切換執行緒。它只是一個「標記」，告訴編譯器：「這個函數可能會被**暫停 (suspend)**，請幫我準備好暫停和恢復的機制」。

*   **功能**：標記該函數具有「暫停」的能力。
*   **限制**：`suspend` 函數只能被 **別的 suspend 函數** 或者 **協程構建器 (Coroutine Builder)** 呼叫。

```kotlin
// 普通函數
fun regularFunction() {
    println("Hello")
}

// 暫停函數
suspend fun slowFunction() {
    println("Start")
    delay(1000) // delay 是一個 suspend 函數，它會暫停程式碼，但不會阻塞執行緒
    println("End")
}
```

---

## 2. `runBlocking`：連接現實與協程的橋樑 (The Bridge)

協程的世界（Suspend World）和普通程式碼的世界（Blocking World）是隔離的。普通函數不能直接呼叫 `suspend` 函數。我們需要一個橋樑。

*   **功能**：建立一個新的協程，並 **阻塞 (Block)** 當前執行緒，直到裡面的程式碼全部跑完。
*   **場景**：**僅限於** `main()` 函數、單元測試 (Unit Test)。
*   **重點**：**絕對不要** 在 Android 的 UI Thread (Main Thread) 或後端 Server 的 Request 處理中呼叫它，否則會導致畫面卡死或伺服器吞吐量下降。

```kotlin
fun main() { // 這是普通世界
    println("1. 開始")
    
    // 建立橋樑，進入協程世界
    runBlocking {
        println("2. 進入協程，休息一下")
        delay(1000) 
        println("3. 協程結束")
    } // 在這裡會卡住(Block)，直到上面大括號內都跑完
    
    println("4. 程式結束")
}
```

---

## 3. `launch`：射後不理 (Fire and Forget)

這是在協程世界裡最常用的啟動方式。

*   **功能**：啟動一個**新的**協程，並**並發 (Concurrently)** 執行。
*   **特點**：它不會阻塞程式碼往下跑。它像是一個「分身」，你去跑你的，我繼續往下走。
*   **返回值**：`Job` (可以用來手動取消這個任務)。

```kotlin
fun main() = runBlocking {
    println("主程式開始")

    // 啟動一個新協程 (分身 A)
    launch {
        delay(1000)
        println("分身 A 完成")
    }

    // 啟動另一個新協程 (分身 B)
    launch {
        delay(500)
        println("分身 B 完成")
    }

    println("主程式繼續走... (不會等上面兩個 launch)")
}
```
**輸出順序**：
1. 主程式開始
2. 主程式繼續走...
3. 分身 B 完成 (過了 500ms)
4. 分身 A 完成 (過了 1000ms)

---

## 4. `coroutineScope`：最有禮貌的等待者 (The Polite Waiter)

這是初學者最容易跟 `runBlocking` 搞混的關鍵字。

*   **功能**：創建一個新的作用域，並在**所有子協程**完成之前，**暫停 (Suspend)** 外部的協程。
*   **關鍵區別**：
    *   `runBlocking` 會 **阻塞 (Block)** 執行緒（Thread 停下來死等）。
    *   `coroutineScope` 會 **暫停 (Suspend)** 協程（Thread 沒事做，可以去執行別的協程任務，等這邊好了再回來）。
*   **用途**：用來實現「並行分解」。比如你需要同時下載 A 和 下載 B，兩個都好了才能繼續往下走。

### ⚔️ 關鍵對決：`runBlocking` vs `coroutineScope`

這個範例，請仔細看 `Thread` 的行為：

```kotlin
fun main() = runBlocking { // 這裡佔用了 Main Thread
    
    println("1. runBlocking 開始")

    // --- 場景 A: 使用 runBlocking (霸道) ---
    // 這會新建一個協程，但它會阻塞當前 Thread
    runBlocking {
        launch { 
            delay(500)
            println("Task A done") 
        }
        delay(100)
        println("runBlocking 內部")
    }
    // 注意：外部必須等上面完全做完，Thread 才能動

    // --- 場景 B: 使用 coroutineScope (禮貌) ---
    // 這會暫停當前的 execution，釋放 Thread 去做別的事(如果有的話)
    coroutineScope {
        launch {
            delay(500)
            println("Task B done")
        }
        delay(100)
        println("coroutineScope 內部")
    }
    
    println("2. 全部結束")
}
```

雖然在單執行緒下看起來效果很像（都要等），但在高併發環境下：
*   `runBlocking` 像是一個人霸佔著廁所玩手機（佔用 Thread 資源不放）。
*   `coroutineScope` 像是排隊時先讓出位置，等輪到自己了再回來（釋放 Thread 資源）。

---

## `run` 又是什麼？

你提到了 `run`。在 Kotlin 中，`run` 其實有兩種含義，容易混淆：

1.  **Library 函數 `T.run { ... }`**：
    這跟協程沒直接關係，它只是 Kotlin 的 Scope Function。
    ```kotlin
    val result = "Hello".run {
        this.length // 返回 5
    }
    ```
    
2.  **`run` 在協程中的誤用**：
    有些開發者會以為有一個協程 builder 叫 `run`。其實沒有。最接近的是 `withContext` 或者是 `runBlocking`。
    
    如果是想「切換執行緒並執行一段程式碼」，通常我們用 `withContext` (後續會在做解說)。
    如果只是想「執行一段同步程式碼」，就用標準的 `run`。

---

## Day 2 總結：一張表看懂

| 關鍵字 | 類型 | 阻塞 Thread? | 用途 |
| :--- | :--- | :--- | :--- |
| **suspend** | 修飾符 | **No** | 標記函數可以被暫停，必須在協程中呼叫。 |
| **runBlocking** | Builder | **Yes** (危險!) | 測試、Main 函數入口。**生產環境少用**。 |
| **launch** | Builder | **No** | 啟動一個新協程，不關心結果 (Fire-and-forget)。 |
| **coroutineScope**| Scope | **No** (Suspend) | 等待多個並行任務完成，結構化並發的基礎。 |
| **delay** | 函數 | **No** (Suspend) | 非阻塞的睡眠，讓出 CPU。 |

---

### 🟢 今日練習 (Homework)

請嘗試解決這個小任務：
**目標**：模擬「煎牛排」和「煮湯」同時進行。
1.  使用 `runBlocking` 作為入口。
2.  使用 `launch` 啟動「煎牛排」（耗時 2000ms）。
3.  使用 `launch` 啟動「煮湯」（耗時 1000ms）。
4.  在最後印出「晚餐做好了！」。
5.  **挑戰**：確保「晚餐做好了」這句話，一定要在牛排和湯**都完成後**才印出來。（提示：利用 `join` 或者把 print 放在正確的位置，或者使用 `coroutineScope` 包裹它們）。

這有助於你理解協程的執行順序！明天 Day 3，我們將更深入探討 `async` 和如何獲取執行結果。
