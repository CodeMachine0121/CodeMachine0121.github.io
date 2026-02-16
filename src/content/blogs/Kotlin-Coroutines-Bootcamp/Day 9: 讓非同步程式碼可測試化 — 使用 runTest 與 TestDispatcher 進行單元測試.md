---
title: "Day 9: 讓非同步程式碼可測試化 — 使用 runTest 與 TestDispatcher 進行單元測試.md"
datetime: "2026-02-16"
description: "在傳統的單元測試（Unit Test）中，測試跑完就結束了，不會等你背景的 Thread 跑完。而且，如果你的程式碼裡有 delay(5000)，難道測試真的要等 5 秒嗎？這樣測試速度會慢到令人髮指。今天我們要介紹 kotlinx-coroutines-test，它是官方提供的測試框架，能讓你像「奇異博士」一樣控制時間。"
parent: "Kotlin Coroutines Bootcamp"
---

要進行協程測試，首先需要在 `build.gradle` 加入專用依賴：

```kotlin
testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.7.3")
```

## 1. 告別 `runBlocking`，擁抱 `runTest`

在 Day 2 我們說過 `runBlocking` 可以用在測試。但在現代（Coroutine 1.6+）的標準中，請改用 **`runTest`**。

### ⏳ 虛擬時間 (Virtual Time)
`runTest` 最強大的功能是它會自動跳過 `delay` 的等待時間。

```kotlin
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.delay
import org.junit.Test
import kotlin.system.measureTimeMillis

class BasicTest {
    @Test
    fun testDelay() = runTest {
        val time = measureTimeMillis {
            // 在真實世界這要跑 5 秒
            // 在 runTest 裡，這行程式碼瞬間執行完畢，但虛擬時間前進了 5000ms
            delay(5000) 
        }
        
        // 驗證：真實執行時間應該趨近於 0
        println("真實耗時: $time ms") 
        assert(time < 100) { "測試跑太慢了！" }
    }
}
```
**原理**：`runTest` 內部使用了一個 `TestCoroutineScheduler`，它攔截了 `delay` 呼叫，直接修改內部的「虛擬時鐘」，而不是讓 CPU 真的睡著。

---

## 2. 標準 Dispatcher ：`StandardTestDispatcher`

當你使用 `runTest` 時，它預設使用 `StandardTestDispatcher`。
這個 Dispatcher 的特點是：**它不會自動執行新啟動的協程**，除非你叫它跑。這讓你能夠精確控制執行順序。

### 🎮 手動推進時間 (Manual Advancement)

```kotlin
@Test
fun testStandardDispatcher() = runTest {
    // 1. 啟動一個新協程
    val job = launch { 
        println("   🚀 協程開始")
        delay(1000)
        println("   ✅ 協程結束")
    }

    println("1. 測試開始")
    
    // 此時，launch 裡的程式碼其實還沒跑！因為 StandardTestDispatcher 把它排進了佇列。
    
    // 2. 推進虛擬時間 1000ms
    println("2. 推進時間...")
    advanceTimeBy(1000) 
    
    // 或者用這個，推進直到所有任務都閒置
    // advanceUntilIdle()

    println("3. 測試結束")
}
```

**輸出順序**：
1. 測試開始
2. 推進時間...
3. 🚀 協程開始
4. ✅ 協程結束
5. 測試結束

*(注意：這裡的輸出順序取決於 `launch` 是否立即被調度。在 `StandardTestDispatcher` 中，新任務會被排隊。如果你希望它像 `runBlocking` 一樣立刻跑，可以使用 `UnconfinedTestDispatcher`，但 `Standard` 更適合用來測試複雜的時間邏輯。)*

---

## 3. 解決 Android 的痛點：`MainDispatcherRule`

在 Android 單元測試（JVM Test）中，沒有真實的 UI Thread (Main Looper)。
如果你的程式碼中用了 `Dispatchers.Main`，測試會直接報錯：
`Module with the Main dispatcher is missing. Add dependency 'kotlinx-coroutines-test'.`

**解決方案**：在測試開始前，把 `Dispatchers.Main` 替換成我們的 `TestDispatcher`。

### 🛠️ 最佳實踐：依賴注入 (Dependency Injection)

**不要** 在你的類別裡寫死 `Dispatchers.IO` 或 `Main`。應該把它們當作參數傳進去。

**好的設計：**
```kotlin
class UserRepository(
    // 預設用 IO，但測試時可以換掉
    private val ioDispatcher: CoroutineDispatcher = Dispatchers.IO 
) {
    suspend fun fetchData() = withContext(ioDispatcher) {
        delay(1000)
        "Real Data"
    }
}
```

**測試程式碼：**
```kotlin
@Test
fun testRepo() = runTest {
    // 注入 StandardTestDispatcher
    val repo = UserRepository(StandardTestDispatcher(testScheduler))
    
    val deferred = async { repo.fetchData() }
    
    // 因為用了 StandardDispatcher，要手動推進時間
    advanceUntilIdle() 
    
    assertEquals("Real Data", deferred.await())
}
```
---

## 4. 測試 Flow (冷 flow )

測試 Flow 有兩種常見策略。

### A. 轉換成 List (對於有限的 flow )
如果 Flow 會結束（例如 `take(3)`），直接轉成 `toList()` 驗證。

```kotlin
@Test
fun testFlowValues() = runTest {
    val flow = flow {
        emit(1)
        delay(100)
        emit(2)
    }
    
    val result = flow.toList() // 這會等待 flow 結束
    assertEquals(listOf(1, 2), result)
}
```

### B. 使用 `backgroundScope` (對於無限的 flow )
如果 Flow 是無限的（例如 `StateFlow`），你不能用 `toList()`，因為它永遠不會結束，測試會卡死。
這時可以用 `backgroundScope` 來收集它。這個 Scope 會在測試結束時自動取消。

```kotlin
@Test
fun testStateFlow() = runTest {
    val viewModel = MyViewModel()
    val results = mutableListOf<String>()

    // 在背景收集資料
    backgroundScope.launch(UnconfinedTestDispatcher(testScheduler)) {
        viewModel.uiState.toList(results)
    }

    viewModel.updateData("A")
    viewModel.updateData("B")
    
    assertEquals(listOf("Initial", "A", "B"), results)
}
```

```kotlin
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

class MyViewModel {
    // 1. Backing Property (後備屬性)
    // 私有的可變 Flow，只有 ViewModel 自己能修改
    private val _uiState = MutableStateFlow("Initial")

    // 2. 公開的不可變 Flow
    // 外部（如 UI 或 Test）只能觀察，不能修改
    val uiState: StateFlow<String> = _uiState.asStateFlow()

    // 3. 更新數據的方法
    fun updateData(newData: String) {
        // StateFlow 的特色：設定 value 會立即發射新數據
        _uiState.value = newData
    }
}
```


---

## Day 9 總結

1.  **`runTest`**：協程單元測試的標準入口，自帶虛擬時鐘，能跳過 `delay`。
2.  **`StandardTestDispatcher`**：需要手動呼叫 `advanceTimeBy` 或 `advanceUntilIdle` 才會執行任務，適合精細控制。
3.  **`UnconfinedTestDispatcher`**：像 `Dispatchers.Unconfined` 一樣急切執行（Eagerly），適合簡單邏輯測試。
4.  **`Dispatchers.setMain`**：解決單元測試沒有 Main Thread 的問題。
5.  **依賴注入 Dispatcher**：這是讓程式碼可測試的黃金法則。永遠不要寫死 `Dispatchers.IO`。

---

### 🟢 今日練習 (Homework)

**目標**：修復一個無法測試的類別。

1.  **壞程式碼**：寫一個 `NewsPresenter` 類別，裡面有一個 `fetchNews()` 方法。
    *   它直接使用了 `GlobalScope.launch(Dispatchers.Main)` (這是壞習慣，但為了練習)。
    *   它內部呼叫 `delay(2000)`。
    *   最後更新一個 `var latestNews: String`。

2.  **重構**：
    *   改成接收 `CoroutineDispatcher` 作為建構子參數。
    *   使用 `CoroutineScope` (例如實現 `CoroutineScope` 介面，或傳入 scope) 代替 `GlobalScope`。

3.  **測試**：
    *   使用 `runTest`。
    *   注入 `StandardTestDispatcher`。
    *   呼叫 `fetchNews()`。
    *   斷言 `latestNews` 還是空的（因為時間還沒到）。
    *   使用 `advanceTimeBy(2001)`。
    *   斷言 `latestNews` 已經更新。

這個練習會讓你深刻體會「控制時間」對於測試非同步邏輯的重要性。

---

明天是最後一天 **Day 10**！我們要進入深水區，探索 Kotlin 協程的底層：**協程是如何被編譯成狀態機 (State Machine) 的？** 了解這個，我們就完成 Kotlin Coroutine 0 到 1 的旅程啦！
