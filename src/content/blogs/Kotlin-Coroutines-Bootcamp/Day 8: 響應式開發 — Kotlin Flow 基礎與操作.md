---
title: "Day 8: 響應式開發 — Kotlin Flow 基礎與操作"
datetime: "2026-02-16"
description: "Flow 是 Kotlin 為了對標 RxJava 而設計的工具，它基於 Coroutines 構建，具備 結構化併發特色"
parent: "Kotlin Coroutines Bootcamp"
---

## 1. 什麼是 Flow ? 

在 Flow 的世界裡，有一條鐵律：
> **Code inside `flow { ... }` does not run until you `collect` it.**
> (Flow 裡的程式碼，直到被收集時才會執行。)

這跟 `Channel` 或 `GlobalScope.launch` 完全不同，這類型一旦宣告就會開始跑。
依筆者我來看他更像是 Delegate。

### 🧊 實作驗證:

```kotlin
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*

fun main() = runBlocking {
    println("1. 準備創建 Flow")
    
    val simpleFlow = flow {
        println("   🌊 Flow 開始運行了 (有人按下播放鍵)")
        emit(1) // emit 資料
        delay(100)
        emit(2)
        println("   🌊 Flow 結束")
    }

    println("2. Flow 創建完畢，但還沒執行...")
    delay(1000) // 即使過了 1 秒，上面的 "Flow 開始運行了" 也不會印出來

    println("3. 第一次收集 (Collect)")
    simpleFlow.collect { value -> 
        println("   📥 收到: $value")
    }

    println("4. 第二次收集 (Re-run)")
    simpleFlow.collect { value -> // 冷流是可以重複收集的，每次都會從頭開始
        println("   📥 再次收到: $value")
    }
}
```
**結果**：你會發現 `flow { ... }` 裡面的程式碼被執行了**兩次**，而且只有在呼叫 `collect` 之後才開始。

---

## 2. 運算子：像流水線一樣處理資料

Flow 最強大的地方在於它的 **中間運算子 (Intermediate Operators)**。你可以像lambda一樣，對資料進行一連串的加工。

常用的運算方法：
*   **`map`**: 轉換資料 (例如：Int $\rightarrow$ String)。
*   **`filter`**: 過濾資料 (例如：只留偶數)。
*   **`take`**: 只取前 N 個。
*   **`onEach`**: 窺視資料 (不改變數據，通常用來印 Log)。

```kotlin
suspend fun performFlowTransformation() {
    flowOf(1, 2, 3, 4, 5) // 快速建立 Flow
        .filter { it % 2 == 0 }     // 1. 過濾：留下偶數 [2, 4]
        .map { it * it }            // 2. 轉換：變成平方 [4, 16]
        .onEach { println("處理中: $it") } // 3. 偷看一眼
        .collect { result ->        // 4. 終端收集
            println("最終結果: $result")
        }
}
```
**注意**：所有中間運算子（map, filter）都是沒有被運行的。它們只是「設定」了規則，直到 `collect` 發生時，資料才會真正地被處理。

---

## 3. Thread 切換：`flowOn`

在協程中，Flow 預設擁有 **Context Preservation (上下文保留)** 的特性。
簡單說：**你在哪個Thread呼叫 `collect`，Flow 中的運算程式碼就在哪個Thread跑。**

但在 Android 開發中，我們通常在 `Main Thread` 呼叫 `collect` (為了更新 UI)，但我們希望 Flow 裡面的 `emit` (讀資料庫/網路) 跑在 `IO Thread` （對，這代表 emit 的 value 也可以是 function類型)。

這時就要用 **`flowOn`**。

### 🔄 `flowOn` 是如何工作的？

它會改變它 **上游 (Upstream)** 運算的執行環境。

```kotlin
fun main() = runBlocking {
    flow {
        // 這裡會跑在 IO Thread，因為下面設了 flowOn(Dispatchers.IO)
        println("Emit Thread: ${Thread.currentThread().name}")
        emit("Data from DB")
    }
    .map { 
        // 這裡也跑在 IO Thread (依然在 flowOn 的上游)
        println("Map 操作 Thread: ${Thread.currentThread().name}") 
        it.uppercase()
    }
    .flowOn(Dispatchers.IO) // 👈 關鍵！切換上游所有操作的Thread
    .collect { 
        // 這裡跑在 Main Thread (或啟動這個 runBlocking 的線程)
        // 因為 flowOn 只影響上游，不影響下游 (Downstream)
        println("收集端 Thread: ${Thread.currentThread().name}")
        println("結果: $it")
    }
}
```

**口訣**：`flowOn` 就像一個 **分水嶺**。它告訴上面的程式碼：「你們去那邊跑」，而它下面的代碼保持原樣。

---

## 4. 異常處理：優雅的 `catch`

在前面我們學過 `try-catch`。在 Flow 中，雖然你也可以在 `collect` 外面包 `try-catch`，但更推薦使用 **聲明式 (Declarative)** 的 `catch` 運算子。

它的優點是：保持程式碼整潔，並且可以 emit **Fallback Value (備用值)**。

```kotlin
fun main() = runBlocking {
    flow {
        emit(1)
        emit(2)
        throw RuntimeException("💥 網路斷線！") // 發生錯誤
        emit(3) // 這行不會執行
    }
    .catch { e -> 
        // 這裡捕獲上游的異常
        println("捕獲到異常: ${e.message}")
        emit(-1) // emit 一個「錯誤程式碼」或「緩存資料」
    }
    .collect { 
        println("收到: $it")
    }
}
```
**輸出**：
1
2
捕獲到異常: 💥 網路斷線！
收到: -1 (collect 正常結束，程式沒崩潰)

**注意**：`catch` **只能** 捕獲它 **上游** 發生的異常。如果在 `catch` 下面的 `map` 或 `collect` 裡發生異常，它是抓不到的！

---

## 5. Flow 與 LiveData 的區別 (Android Context)

如果你是 Android 開發者，你可能會問：「為什麼不用 LiveData？」

| 特性 | LiveData | Flow |
| :--- | :--- | :--- |
| **生命週期感知** | ✅ 自動感知 (不怕 Leak) | ❌ 需配合 `lifecycleScope` / `repeatOnLifecycle` |
| **Thread切換** | ❌ 只能在 Main | ✅ `flowOn` 自由切換 |
| **運算子** | ⚠️ 少 (Transformations) | ✅ 多 (map, filter, zip, combine...) |
| **資料流向** | 總是保留最新值 (State) | 是一條流 (Stream) |

**結論**：在現代 Android 開發中，Google 推薦在 **Repository/ViewModel 層使用 Flow** 處理複雜資料，最後在 UI 層可以轉換成 LiveData 或是直接使用 `collectAsState` (Jetpack Compose) 來觀察。

---

## Day 8 總結

1.  **Flow 只有在 `collect` 時才運行。**
2.  **Operators**: `map`, `filter` 讓我們能優雅地轉換資料。
3.  **Thread Switching**: 使用 `flowOn(Dispatchers.IO)` 將繁重的emit 工作移到背景，而不影響主Thread的收集工作。
4.  **Error Handling**: 使用 `catch` 運算子來攔截異常併emit 替代資料。

---

### 🟢 今日練習 (Homework)

**目標**：模擬一個「搜尋聯想 (Search Suggestion)」功能。

請實作一個 Flow，模擬使用者輸入關鍵字，並從資料庫撈取建議：

1.  建立一個 `flowOf("a", "ap", "app", "apple")`，模擬使用者連續輸入的字串。
2.  使用 `onEach` 加上 `delay(100)` 模擬輸入間隔。
3.  使用 `map` 模擬去資料庫查詢建議（字串長度 * 10 筆結果），例如 "ap" -> "找到 20 筆結果"。
    *   **要求**：這個查詢動作必須模擬耗時 500ms (`delay(500)`).
4.  使用 `flowOn` 將上面的查詢動作指定在 `Dispatchers.IO` 執行。
5.  在 `collect` 中印出結果。

這個練習是 Flow 在 UI 開發中最經典的應用場景！

---

明天 **Day 9**，我們要進入 **單元測試 (Unit Testing)**。寫了這麼多非同步程式碼，如果不能測試，上線就是災難。我們會學習如何控制時間，讓 `delay(10000)` 在測試中瞬間完成！
