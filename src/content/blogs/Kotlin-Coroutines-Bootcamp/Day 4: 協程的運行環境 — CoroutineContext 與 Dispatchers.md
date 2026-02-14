---
title: ""
datetime: "2026-02-14"
description: "如果你的 App 畫面卡住（ANR），通常是因為你在 Main Thread 做了太重的工作。如果你的 App 崩潰報錯 NetworkOnMainThreadException，是因為你在 Main Thread 連網路。如果你的 App 崩潰報錯 CalledFromWrongThreadException，是因為你在 Background Thread 更新 UI。今天我們要學習如何用 Dispatchers 來指揮協程去正確的地方工作。"
parent: "Kotlin Coroutines Bootcamp"
---
在 Kotlin 協程中，我們不直接操作 Thread，而是通過 **Dispatcher** 來指定協程應該運行在哪個執行緒池中。

## 1. 四大 Dispatcher

Kotlin 提供了四種標準的 Dispatcher，涵蓋了絕大多數的使用場景：

| Dispatcher | 對應場景 | 背後機制 |
| :--- | :--- | :--- |
| **Dispatchers.Main** | **UI 操作** | Android 的 Main Looper (UI Thread)。<br>*(需引入 `kotlinx-coroutines-android`)* |
| **Dispatchers.IO** | **I/O 操作** | 讀寫檔案、資料庫、網路請求。<br>這是一個彈性的 Thread Pool，可以自動擴展（最多 64 個執行緒）。 |
| **Dispatchers.Default** | **CPU 密集型** | 複雜運算、JSON 解析、排序算法。<br>執行緒數量等於 CPU 核心數（例如 8 核手機就是 8 個執行緒）。 |
| **Dispatchers.Unconfined**| **不限制** | **(少用)** 啟動時跑在當前執行緒，掛起恢復後可能跑在別的執行緒。<br>通常只用於測試或極特殊的底層邏輯。 |

### 🛠️ 實戰：選擇正確的 Dispatcher

```kotlin
launch(Dispatchers.Main) { 
    // 這裡跑在 UI 執行緒，適合更新 TextView, RecyclerView
    updateUI()
}

launch(Dispatchers.IO) {
    // 這裡跑在背景執行緒，適合讀寫 DB, API Request
    database.save(data)
}

launch(Dispatchers.Default) {
    // 這裡跑在背景執行緒，適合處理大數據
    val sortedList = heavyList.sortedBy { it.id }
}
```

---

## 2. `withContext`：優雅的執行緒切換 (Thread Switching)

這是今天最重要的關鍵字。
在傳統 Android 開發（例如 AsyncTask 或 RxJava）中，切換執行緒往往意味著 callback 的嵌套。但在協程中，我們使用 `withContext` 來實現 **「同步式的執行緒切換」**。

### ❌ 錯誤示範（Callback 地獄再現）

```kotlin
// 假設這是傳統寫法
fun loadData() {
    thread(start = true) { // 切到背景
        val data = api.fetch()
        runOnUiThread { // 切回主執行緒
            textView.text = data
        }
    }
}
```

### ✅ 協程寫法（一氣呵成）

`withContext` 是一個 suspend 函數，它會：
1.  **切換** 到指定的 Dispatcher。
2.  **執行** 代碼塊。
3.  **等待** 執行完畢（掛起外部協程）。
4.  **切回** 原來的 Dispatcher，並返回結果。

```kotlin
// 假設這個函數是在 UI 執行緒被呼叫的
fun loadUserData() {
    scope.launch(Dispatchers.Main) {
        showLoading() // UI 操作 (Main)
        
        // 魔法發生在這裡：切換到 IO 執行緒去抓資料
        // 下一行代碼會 "掛起" 等待，直到 IO 跑完並返回結果
        val user = withContext(Dispatchers.IO) {
            println("正在 IO 執行緒: ${Thread.currentThread().name}")
            api.fetchUser() // 這是一個耗時操作
        } 
        
        // 自動切回 Main 執行緒
        println("回到 UI 執行緒: ${Thread.currentThread().name}")
        hideLoading() // UI 操作 (Main)
        updateUI(user)
    }
}
```

> **最佳實踐**：
> 一個良好的 suspend 函數應該是 **「Main-Safe (主執行緒安全)」** 的。
> 也就是說，不管誰呼叫這個函數，函數內部都應該自己處理好執行緒切換（使用 `withContext`），而不應該讓呼叫者擔心會不會卡死 UI。

---

## 3. 深入理解：什麼是 CoroutineContext？

你可能注意到 `launch` 的參數其實是 `CoroutineContext`。
`Dispatchers.IO` 只是 `CoroutineContext` 的其中一種元素。

### Context 是一個 Map (集合)
`CoroutineContext` 其實是一個包含不同元素的集合。它可以包含：
1.  **Job**：控制協程生命週期 (Day 3 學過)。
2.  **Dispatcher**：控制執行緒調度 (今天學的)。
3.  **CoroutineName**：給協程取名字 (方便 Debug)。
4.  **CoroutineExceptionHandler**：處理崩潰 (Day 6 會講)。

### ➕ 運算符重載：Context 的加法

你可以像數學加法一樣，把不同的配置組合成一個 Context：

```kotlin
// 組合：我要一個在 IO 執行緒跑的、名字叫 "NetworkRequest" 的、且有特定 Job 的協程
val myContext = Dispatchers.IO + CoroutineName("NetworkRequest") + Job()

launch(myContext) {
    println("我在 ${Thread.currentThread().name} 上運行")
    // 輸出可能包含: DefaultDispatcher-worker-1 @NetworkRequest#2
}
```

這在 Log 追蹤問題時非常有用！

---

## 4. 父子協程的繼承關係

當你在一個協程 A 裡面啟動協程 B 時，B 會自動繼承 A 的 Context。

```kotlin
launch(Dispatchers.Main) { // 父協程在 Main
    
    // 子協程沒有指定 Dispatcher，所以繼承父協程 -> 也在 Main
    launch { 
        println("我也是 Main") 
    }
    
    // 子協程指定了 IO，覆蓋了父協程的設定 -> 在 IO
    launch(Dispatchers.IO) {
        println("我是 IO")
    }
}
```

這就是為什麼在 Android 中，我們通常在 `ViewModel` 或 `Activity` 最外層定義一個 `CoroutineScope(Dispatchers.Main)`，這樣預設所有子任務都在 UI 執行緒，只有需要耗時操作時才用 `withContext(Dispatchers.IO)` 切出去。這樣最安全。

---

## Day 4 總結

1.  **Dispatchers.Main**：UI 專用（Android）。
2.  **Dispatchers.IO**：讀寫操作專用（網路/DB）。
3.  **Dispatchers.Default**：運算密集專用（排序/解析）。
4.  **`withContext`**：是切換執行緒的神器，它會掛起當前協程，執行完後自動切回來。
5.  **Context 組合**：`Dispatcher + Name + Job` 可以組合成完整的運行環境。

---

### 🟢 今日練習 (Homework)

**目標**：模擬一個完整的圖片處理流程。

請寫一段程式碼，模擬以下步驟，並在每個步驟印出 `Thread.currentThread().name` 來驗證執行緒是否正確：

1.  **UI 執行緒**：顯示 "開始下載圖片..."。
2.  **IO 執行緒**：模擬下載圖片（`delay(1000)`），返回一個 String "Image_Data"。
3.  **Default 執行緒**：模擬圖片壓縮/濾鏡處理（`delay(500)`），將 "Image_Data" 轉為 "Compressed_Image"。
4.  **UI 執行緒**：顯示 "圖片處理完成: Compressed_Image"。

**提示**：
你需要一個 `runBlocking` 來模擬主程式，但在 `runBlocking` 內部，試著用 `launch` 和 `withContext` 來完成切換。
*(注意：在單純的 JVM 專案中沒有 `Dispatchers.Main`，你可以用 `Dispatchers.Default` 代替 Main，或者引入 `kotlinx-coroutines-swing`，但在練習中只要看到執行緒名字有變即可)*

---

明天 **Day 5**，我們要進入協程最核心、也是最容易被忽略的設計哲學：**結構化並發 (Structured Concurrency)**。為什麼取消父協程，子協程就會自動取消？這對於防止 Memory Leak 至關重要！
