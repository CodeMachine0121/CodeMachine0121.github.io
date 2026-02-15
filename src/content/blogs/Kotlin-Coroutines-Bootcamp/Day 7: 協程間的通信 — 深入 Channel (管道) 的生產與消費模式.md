---
title: "Day 7: 協程間的通信 — 深入 Channel (管道) 的生產與消費模式"
datetime: "2026-02-14"
description: "在複雜的系統中，協程之間往往需要交換資訊。例如：一個協程負責讀取網路資訊，另一個協程負責將資訊轉換寫入資料庫。比較傳統做法是使用「共享變數」（Shared Mutable State），例如一個 List，但這需要加鎖（Lock/Synchronized），容易導致死鎖或效能低落。"
parent: "Kotlin Coroutines Bootcamp"
---

我們可以先把 **Channel** 想像成工廠裡的 **輸送帶**，或者是 Java 中的 `BlockingQueue`。
*   **左邊（SendChannel）**：生產者（Producer）把東西放上去。
*   **右邊（ReceiveChannel）**：消費者（Consumer）把東西拿下來。

## 1. Hello Channel：基本的發送與接收

要建立一個 Channel 非常簡單，它是一個泛型接口 `Channel<T>`。

```kotlin
import kotlinx.coroutines.*
import kotlinx.coroutines.channels.*

fun main() = runBlocking {
    // 1. 創建一個管道，傳遞整數
    val channel = Channel<Int>()

    // 2. 啟動生產者 (Producer)
    launch {
        for (x in 1..5) {
            println("📤 發送: $x")
            channel.send(x) // 這是一個 suspend 函數
            delay(100) // 模擬生產耗時
        }
        channel.close() // 3. 重要！發送完畢要關閉管道
        println("生產者下班了")
    }

    // 4. 啟動消費者 (Consumer)
    launch {
        // 使用 for 迴圈直接從 channel 拿取資料，直到它被 close
        for (y in channel) { 
            println("📥 接收: $y")
        }
        println("消費者下班了")
    }
    
    println("主程式等待中...")
}
```

**關鍵點**：
*   **`send(x)`**：如果沒有人來拿，或者緩衝區滿了，這個函數會 **Suspend**。
*   **`receive()`** (隱藏在 for 迴圈裡)：如果管道是空的，這個函數會 **Suspend**。
*   **`close()`**：告訴消費者「沒有更多資料了」，for 迴圈會優雅結束。如果不 close，消費者會一直暫停等待，造成洩漏。

---

## 2. Channel 的容量與緩衝策略 (Buffer Strategy)

Channel 的行為很大程度上取決於它的 **容量 (Capacity)**。你可以在創建時指定：

`val channel = Channel<Int>(capacity = ...)`

這裡有四種常見的策略：

### A. Rendezvous (預設值, 容量 0)
*   **代號**：`Channel.RENDEZVOUS`
*   **含義**：**「不見不散」**。
*   **行為**：沒有緩衝區。生產者發送時，必須**剛好**有一個消費者在等待接收，否則生產者會暫停。
*   **場景**：強同步，確保資料即時被處理。

### B. Buffered (指定容量)
*   **代號**：`Channel(10)`
*   **含義**：**「積木堆」**。
*   **行為**：有一個固定大小的陣列。生產者可以一直發送，直到填滿陣列才會暫停。
*   **場景**：允許生產者跑得比消費者快一點點（削峰填谷）。

### C. Conflated (容量 1, 丟棄舊值)
*   **代號**：`Channel.CONFLATED`
*   **含義**：**「喜新厭舊」**。
*   **行為**：永遠只保留**最新**的一個值。如果消費者來不及拿，舊的值會直接被丟掉（Overwrite）。生產者永遠不會暫停。
*   **場景**：UI 狀態更新（如下載進度條，我只在乎當前的 %，不在乎剛剛是 50% 還是 51%）。

### D. Unlimited (無限容量)
*   **代號**：`Channel.UNLIMITED`
*   **含義**：**「無底洞」**。
*   **行為**：記憶體允許範圍內無限存放。
*   **場景**：**危險！** 如果消費者掛了，生產者會把記憶體塞爆 (OOM)。慎用。

---

## 3. 實戰：生產者-消費者模式 (Producer-Consumer)

Kotlin 提供了一個更優雅的構建器 `produce`，它會自動啟動一個協程，並在代碼塊結束時自動 `close` Channel。這比手動 `launch` + `Channel()` 更安全。

### ☕️ 咖啡店模擬

```kotlin
// 這是生產者：咖啡師
// CoroutineScope 的擴展函數，返回 ReceiveChannel
fun CoroutineScope.produceCoffee() = produce<String> { 
    var orderId = 1
    while (true) {
        send("Coffee #$orderId") // 生產咖啡
        println("☕️ 咖啡師做好了 Coffee #$orderId")
        orderId++
        delay(200) // 做一杯要 200ms
        
        if (orderId > 5) break // 做完 5 杯下班
    }
    // 這裡自動 close()
}

fun main() = runBlocking {
    val coffeeChannel = produceCoffee() // 取得 Channel

    // 這是消費者：顧客
    // 顧客喝得比較慢，500ms 喝一杯
    for (coffee in coffeeChannel) {
        println("😋 顧客拿到了 $coffee")
        delay(500) 
        println("👌 顧客喝完了 $coffee")
    }
    
    println("咖啡店打烊")
}
```

**觀察結果（Backpressure 背壓）**：
你會發現，因為顧客喝得慢（500ms），咖啡師雖然做得快（200ms），但他不會一次把 5 杯都做完。
如果是預設的 Rendezvous Channel，咖啡師做好一杯後，會**被迫等待**顧客喝完，才能做下一杯。這就是協程自動幫你處理的**流量控制**。

---

## 4. 進階：Fan-out 與 Fan-in (扇出與扇入)

Channel 支持多個協程同時存取。

### 🌪️ Fan-out (扇出)：分發工作
**一個生產者 $\rightarrow$ 多個消費者**。
適合用來做負載平衡 (Load Balancing)。

```kotlin
    suspend fun executeFanOut() = coroutineScope{
        
        val tasksChannel = produce {
            for (i in 1..100) {
                println("Send mission $i")
                send("Mission #$i")
                delay(100)
            }
            println("Send mission done")
        }
        
        repeat(3){ workerId ->
            launch {
                // 這裡會自動處理競爭 (Race Condition)，不會有兩個工人拿到同一個任務
                for (task in tasksChannel) {
                    println("   👷 工人 $workerId 搶到了: $task")
                    delay(500) // 工人處理速度較慢 (500ms)
                    println("   ✅ 工人 $workerId 完成了: $task")
                }
                println("   👋 工人 $workerId 下班")
            }
        }
    }

```
5 個工人都會從同一個 Channel 搶單，誰有空誰就拿，不會重複處理。

### 🌪️ Fan-in (扇入)：匯總結果
**多個生產者 $\rightarrow$ 一個消費者**。
適合用來匯總不同來源的資料。

```kotlin
    suspend fun executeFanIn() = coroutineScope{
        val dashBoardChannel = Channel<String>()
        
        // simulate multiple producer
        // sensor A with delay 100ms
        repeat(5){ i->
            launch { dashBoardChannel.send("Sensor A: data: $i") }
            delay(500)
        }
        
        // sensor B with delay 200ms
        repeat(5){ i->
            launch { dashBoardChannel.send("Sensor B: data: $i") }
            delay(300)
        }
        
        
        //simulate consumer
        // there are totally 10 tasks need to be received
        repeat(10){
            val receivedData = dashBoardChannel.receive()
            println("Received data: $receivedData")
        }
        
        println("All data received")
        dashBoardChannel.close()
    }
```

---

## 5. 為什麼有了 Flow 還要 Channel？

這是一個常見的面試題。(後續我們會再細說 Flow)。
簡單來說：
*   **Channel 是熱的 (Hot)**：不管有沒有人聽，它都在運作（只要生產者還在跑）。適合 **事件 (Events)**，如：按鈕點擊、通知、隊列任務。
*   **Flow 是冷的 (Cold)**：只有你呼叫 `collect` 時，它才開始運作。適合 **資料流 (Data Streams)**，如：資料庫查詢結果、檔案讀取。

---

## Day 7 總結

1.  **Channel** 是協程之間的溝通橋樑，實現了非同步的生產者-消費者模型。
2.  **`send` / `receive`** 是 suspend 函數，具有自動流量控制的能力。
3.  **緩衝策略** 很重要：
    *   `Rendezvous` (0)：同步手拉手。
    *   `Buffered` (N)：有緩衝空間。
    *   `Conflated`：只留最新。
4.  使用 **`produce`** builder 可以更安全地創建 Channel（自動關閉）。
5.  **Fan-out/Fan-in** 讓你輕鬆實現並發處理與結果聚合。

---

### 🟢 今日練習 (Homework)

**目標**：模擬一個「餐廳點餐系統」。

1.  **建立一個 `Order` model **：包含 `id` 和 `name` (如 "漢堡", "薯條")。
2.  **生產者 (櫃台)**：使用 `produce` 創建一個 Channel。每 500ms 產生一個隨機訂單，總共產生 10 個，然後關閉。
3.  **消費者 (廚師)**：啟動 **3 個** 廚師協程 (Worker)。
    *   每個廚師從 Channel 搶訂單。
    *   廚師拿到訂單後，模擬製作時間 (隨機 `delay(1000..2000)` )。
    *   印出：「廚師 [ID] 正在做 [訂單]... 完成！」
4.  **觀察**：
    *   雖然訂單每 500ms 就來一個，但因為廚師做得慢，訂單會積壓嗎？
    *   試著把 Channel 改成 `Channel(capacity = 5)`，看看櫃台是否能先把訂單接單，而不是卡住等待廚師。

這個練習將讓你深刻理解並發處理中的**緩衝**與**競爭**機制。

---

明天 **Day 8**，我們要進入 Kotlin **Flow (冷流)**。這是 Google 官方推薦用來取代 RxJava 的神器！
