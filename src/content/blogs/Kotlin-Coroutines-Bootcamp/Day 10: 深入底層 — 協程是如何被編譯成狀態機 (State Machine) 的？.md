---
title: "Day 10: 深入底層 — 協程是如何被編譯成狀態機 (State Machine) 的？"
datetime: "2026-02-17"
description: "為什麼 suspend 函數可以暫停？為什麼局部變數在暫停後還能恢復？為什麼協程切換比 Thread 快這麼多？答案就在於：狀態機 (State Machine) 與 CPS (Continuation-Passing Style)。"
parent: "Kotlin Coroutines Bootcamp"
---

你以為的 `suspend` 是一個關鍵字，但在 Java Bytecode 的眼裡，它是一個巨大的「變形魔法」。

## 1. 魔法第一步：CPS 變換 (Continuation-Passing Style)

當你寫下一個 `suspend` 函數時：

```kotlin
suspend fun getUser(userId: String): User {
    return api.fetchUser(userId)
}
```

Kotlin 編譯器在編譯時，會偷偷修改這個函數的簽名 (Signature)。它會變成類似這樣的 Java 程式碼：

```java
// 編譯後的樣子 (簡化版)
public Object getUser(String userId, Continuation<User> cont) {
    // ...
}
```

**發生了兩件事：**
1.  **多了一個參數**：`Continuation<User> cont`。 你可以把它想像成一個 Callback，它帶著「接下來要做的事」以及「上下文環境」。
2.  **返回值變了**：返回值變成了 `Object`。為什麼？因為這個函數可能返回兩種類型的東西：
    *   如果沒暫停（直接完成）：返回 `User` 物件。
    *   如果暫停了（需要等待）：返回一個特殊的標記 `COROUTINE_SUSPENDED`。

---

## 2. 魔法第二步：狀態機 (State Machine)

這是最精彩的部分。編譯器會掃描你的函數，找出所有的 **暫停點 (Suspension Points)**（例如呼叫了別的 `suspend` 函數的地方），然後把程式碼切成好幾塊，塞進一個 `switch-case` 結構裡。

讓我們看一個具體的例子。

### 原始 Kotlin 程式碼：

```kotlin
suspend fun makeCoffee() {
    print("1. 磨豆子")
    delay(1000) // 暫停點 1
    print("2. 煮開水")
    delay(1000) // 暫停點 2
    print("3. 完成")
}
```

### 編譯器眼中的樣子 (偽程式碼)：

編譯器會生成一個匿名內部類別（就是那個 Continuation），裡面有一個 `label` 變數用來記錄「我跑到哪了」。

```java
public Object makeCoffee(Continuation cont) {
    // 1. 如果 cont 已經是我們生成的這個狀態機實例，就直接用；否則創建一個新的
    MyStateMachine sm = (cont instanceof MyStateMachine) ? (MyStateMachine) cont : new MyStateMachine(cont);

    Object result = null;

    // 2. 根據 label 決定從哪裡開始跑
    switch (sm.label) {
        case 0: // --- 剛開始 ---
            print("1. 磨豆子");
            
            sm.label = 1; // 標記：下次回來請跳到 case 1
            result = DelayKt.delay(1000, sm); // 呼叫 delay，並把「自己(sm)」傳進去當 Callback
            
            // 如果 delay 真的暫停了，我們就返回 SUSPENDED，讓出 Thread
            if (result == COROUTINE_SUSPENDED) return COROUTINE_SUSPENDED;
            
            // 如果沒暫停 (比如 delay(0))，就直接往下流 (fall-through) 到 case 1
            break; 

        case 1: // --- 從第一次暫停恢復 ---
            // 這裡不需要重跑 print("1. 磨豆子")，直接從這裡開始
            print("2. 煮開水");
            
            sm.label = 2; // 標記：下次回來請跳到 case 2
            result = DelayKt.delay(1000, sm);
            
            if (result == COROUTINE_SUSPENDED) return COROUTINE_SUSPENDED;
            break;

        case 2: // --- 從第二次暫停恢復 ---
            print("3. 完成");
            return Unit.INSTANCE;
    }
}
```

**核心邏輯**：
1.  **暫停時**：函數執行到 `delay`，將 `label` 設為 1，然後 `return`。這時候，**Thread 就被釋放了**（去執行別的任務）。
2.  **恢復時**：當 `delay` 時間到了，計時器會呼叫 `sm.resume()`。這會導致 `makeCoffee(sm)` 再次被呼叫。
3.  **穿越時空**：這次進來，`sm.label` 是 1，`switch` 直接跳轉到 `case 1`，繼續執行「煮開水」。

這就是為什麼協程看起來像是「暫停」了，其實是函數**結束**了，只是下次呼叫時能**接關**（像玩遊戲存檔讀檔一樣）。

---

## 3. 變數存哪裡？ (Stack vs Heap)

在普通函數中，局部變數存在 **Stack (堆疊)** 上。函數返回，Stack Frame 銷毀，變數就沒了。
但在協程中，局部變數必須在暫停後還活著。

**編譯器會把局部變數「升級」到 Heap (堆積) 上。**
也就是說，你的變數會變成那個 `MyStateMachine` 物件的 **成員變數 (Field)**。

```kotlin
suspend fun calculation() {
    val a = 10  // 局部變數
    delay(1000)
    println(a)  // 暫停回來後，a 還要在
}
```

編譯後：
```java
class MyStateMachine extends ContinuationImpl {
    int a; // 變成了成員變數，存在 Heap 裡
    // ...
}
```

這就是為什麼協程比 Thread 輕量，但比普通函數重一點點（因為要分配一個小物件在 Heap 上）。但相比 Thread 的 1MB Stack，這幾百 Bytes 的物件簡直微不足道。

---

## 4. 協程切換 vs Thread切換

為什麼協程切換成本低？

*   **Thread Switch (Context Switch)**：
    *   由 **OS 內核 (Kernel)** 負責。
    *   需要保存 CPU 暫存器、Program Counter、切換記憶體分頁表 (Page Table) 等。
    *   CPU 緩存 (Cache) 可能失效。
    *   成本：微秒級 (us)。

*   **Coroutine Switch**：
    *   由 **用戶態 (User Land)** 程式碼負責 (JVM)。
    *   本質上就是一個 **普通的函數呼叫 (Function Call)**。
    *   更新一下狀態機的 label，把變數從 Heap 拿出來。
    *   成本：奈秒級 (ns)。

---

## 5. 完結篇總結：這 10 天我們學到了什麼？

回顧這段旅程，我們已經了解了完整的 Kotlin Coroutines：

1.  **基礎觀念**：理解了協程是輕量級Thread，解決了 Callback Hell。
2.  **核心操作**：熟練使用 `launch`, `async`, `runBlocking`。
3.  ** Dispatcher **：知道如何用 `Dispatchers` 和 `withContext` 在 Main/IO 之間切換。
4.  **結構化併發**：學會了 `CoroutineScope`，知道父子協程如何連動取消。
5.  **異常處理**：不再害怕崩潰，懂得用 `SupervisorJob` 和 `try-catch`。
6.  **資料流**：掌握了`Channel` 和 `Flow` 的應用場景。
7.  **測試**：學會了用 `runTest` 控制時間，讓測試不再慢吞吞。
8.  **原理**：今天，你看到了編譯器背後的狀態機魔法。

我們已經從一個協程新手，進化成能夠撰寫高效、安全、可測試併發程式碼的開發者了。
