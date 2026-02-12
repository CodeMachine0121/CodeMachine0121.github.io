---
title: "Day 1: 為什麼我們需要 Coroutines？— 從 Thread 到 協程的演進"
datetime: "2026-02-12"
description: "在第一天，我們先不急著寫複雜的程式碼，而是先釐清「Coroutine 解決了什麼問題」。我們會比較傳統 Java Thread 的代價、Callback 的維護困難，以及 RxJava 的學習曲線。我們將通過一個簡單的性能測試"
parent: "Kotlin Coroutines Bootcamp"
---

在 Kotlin Coroutine 出現之前，Android 或 Java 後端開發處理「非同步任務」（例如：網路請求、讀寫資料庫）主要有兩種方式：
1.  **直接開 Thread** ( `new Thread()`, `AsyncTask`, `ExecutorService` )
2.  **回呼地獄 (Callback Hell)**

這兩種方式都有明顯的痛點。

## 1. Thread 的痛點：太「重」了 (The Heavyweight Problem)

在 Java/JVM 的世界裡，**Thread 是昂貴的資源**。
每一個 Java Thread 直接對應到作業系統（OS）級別的線程。

*   **記憶體佔用高**：每創建一個 Thread，JVM 預設需要分配約 **1MB** 的堆疊記憶體 (Stack Size)。如果你想開 10,000 個 Thread，你需要 10GB 的記憶體，這在手機上幾乎是不可能的。
*   **Context Switch 成本高**：CPU 在不同 Thread 之間切換時，需要保存和恢復暫存器、堆疊等狀態，這非常消耗 CPU 資源。

### 🚨 實作驗證：Thread vs Coroutine 的效能對決

讓我們寫一段程式碼來實證這件事。假設我們需要併發執行 **10 萬個** 簡單的任務（例如：睡 1 秒鐘）。

#### ❌ 使用 Java Thread

```kotlin
import kotlin.concurrent.thread

fun main() {
    val startTime = System.currentTimeMillis()
    
    // 嘗試創建 10 萬個 Thread
    val threads = List(100_000) {
        thread {
            Thread.sleep(1000) // 模擬耗時操作
        } 
    }
    
    threads.forEach { it.join() } // 等待所有線程結束
    
    val endTime = System.currentTimeMillis()
    println("Thread 完成時間: ${endTime - startTime} ms")
}
```

**結果預測**：
你的電腦極有可能會直接崩潰，拋出 `OutOfMemoryError: unable to create new native thread`。即使你的電腦記憶體夠大沒崩潰，電腦也會變得非常卡頓，因為 CPU 忙於調度這 10 萬個線程，而不是執行任務。

---

#### ✅ 使用 Kotlin Coroutine

現在我們用 Coroutine 做同樣的事。

```kotlin
import kotlinx.coroutines.*

fun main() = runBlocking {
    val startTime = System.currentTimeMillis()

    // 創建 10 萬個 Coroutine
    val jobs = List(100_000) {
        launch {
            delay(1000) // 這是協程的 "非阻塞" 等待
        }
    }

    jobs.forEach { it.join() } // 等待所有 Job 結束

    val endTime = System.currentTimeMillis()
    println("Coroutine 完成時間: ${endTime - startTime} ms")
}
```

**結果**：
這段程式碼會在約 **1100ms ~ 1500ms** 內跑完（只比 1000ms 多一點點）。
記憶體佔用極低，CPU 幾乎沒有負擔。

**為什麼？**
- 因為這 10 萬個 coroutines，可能只運行在 **2 到 3 個** 真實的 Thread 上。
- Coroutine 是 **「用戶態 (User-space)」** 的線程，它們不是由作業系統管理的，而是由 Kotlin 的 Runtime 庫管理的。

> **小結**：Coroutine 是 **"Lightweight Threads" (輕量級線程)**。你可以輕易創建百萬個 Coroutines，而不用擔心記憶體爆掉。

---

## 2. 邏輯的痛點：回呼地獄 (Callback Hell)

即使我們使用 Thread Pool 來解決記憶體問題，我們還要面對程式碼邏輯的問題。
在處理依賴關係時（例如：先登入 -> 再拿 User ID -> 再拿 User Profile），傳統程式碼會變成這樣：

#### ❌ 傳統 Callback 風格

```kotlin
fun login(cb: (User) -> Unit) { ... }
fun getUserId(user: User, cb: (String) -> Unit) { ... }
fun getUserProfile(id: String, cb: (Profile) -> Unit) { ... }

// 呼叫時：
login { user ->
    getUserId(user) { id ->
        getUserProfile(id) { profile ->
            // 終於拿到了... 這就是 Callback Hell
            // 縮排越來越深，錯誤處理 (try-catch) 非常難寫
            updateUI(profile)
        }
    }
}
```

這造成了幾個問題：
1.  **可讀性差**：多層縮排。
2.  **錯誤處理困難**：你沒辦法在最外層包一個 `try-catch` 來捕獲內部的錯誤。

#### ✅ Kotlin Coroutine 風格

Kotlin Coroutine 允許我們用 **「同步的方式寫異步程式碼」 (Imperative style)**。

```kotlin
// 透過 suspend 關鍵字 (明天會細講)
suspend fun login(): User { ... }
suspend fun getUserId(user: User): String { ... }
suspend fun getUserProfile(id: String): Profile { ... }

// 呼叫時：
launch {
    try {
        val user = login()           // 程式會在這裡 "掛起" (暫停)，直到結果回來
        val id = getUserId(user)     // 前一行做完才會做這一行
        val profile = getUserProfile(id)
        updateUI(profile)
    } catch (e: Exception) {
        // 所有的錯誤都可以在這裡統一捕獲！
        showError(e)
    }
}
```

這段程式碼看起來像是單線程順序執行的，但實際上它在執行網路請求時並**沒有阻塞 (Block)** 主執行緒，它只是**掛起 (Suspend)** 了。這讓程式碼邏輯清晰，且易於維護。

---

## 總結與核心觀念

1.  **Thread 很貴**：JVM Thread 對應 OS Thread，佔用 1MB 記憶體，Context Switch 成本高。
2.  **Coroutine 很便宜**：它是語言層面的併發工具，創建成本極低，可以在少量 Thread 上復用執行大量任務。
3.  **解決 Callback Hell**：協程讓我們能用順序寫法（Sequential code）來處理非同步邏輯，大幅提升可讀性與異常處理能力。
4.  **非阻塞 (Non-blocking)**：協程的核心特性。當任務需要等待（如 IO 操作）時，它會讓出 CPU 給其他協程使用，而不是讓 Thread 傻傻等待。

---

### 🟢 今日練習 (Homework)

請嘗試在你的 IDE (IntelliJ IDEA 或 Android Studio) 中：
1.  建立一個 Kotlin 專案。
2.  引入 `kotlinx-coroutines-core` 依賴。
3.  親自運行上面的範例程式碼
4.  觀察你的 記憶體與 CPU 的 usage。

**依賴設定 (build.gradle.kts)**:
```kotlin
dependencies {
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.7.3") // 或最新版本
}
```

準備好了就可以進入 **Day 2 - 徹底理解 `suspend` 是如何工作的**。
