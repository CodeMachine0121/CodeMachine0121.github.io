---
title: 初探 Functional Design
datetime: "2025-01-20"
---
有天心血來潮去[天瓏書局](https://www.tenlong.com.tw)逛逛，看到了一本由 [UncleBob](http://cleancoder.com/products) 撰寫的 Functional Design。乍聽之下感覺還不錯，就當給自己的 2025 年新年禮物回家讀，所以才會有這篇筆記。

# 什麼是 Functional Design

簡單來說，就是以 function 的方式撰寫程式碼（我知道這樣有講跟沒講一樣...）。

以下是 ***Uncle Bob*** 的回答：
> ***Programming without assignment statements.***

以下是我結合書上列出來的觀點及一些自身的想法所列出來的 Functional Design 的幾個特色：

1. Always $f(x)=y$
2. Function 內不會有變數上的變動
<!--more-->

# Always $f(x)=y$

意思就是不管什麼時候一個輸入總是會有相對的輸出，寫出來的 function 不應該會讓相同的輸入得到不同的輸出。舉個例子：

```csharp
public string TestFunc(int x)
{
    return x + 1;
}
```

以上面的例子為例，不管什麼時候 `TestFunc(1)` 永遠會得到 2。

# Function 內不會有變數上的變動

意思就是不能對變數有後天上的改動，我們應該讓它從 function 一開始到結束的值都保持一致。
如果針對變數進行改值的話，會怎樣呢？舉個例子：

```csharp
public string TestFunc(int x)
{
    DoSomething1(x);
    x++;
    DoSomething2(x);
}
```

以上面的例子來說，會有個問題點：

1. 你會讓你的 function 變成有順序性的程式碼，意思就是必須先做 `DoSomething1` 才能做 `DoSomething2`。

> 此類壞味道為： ***sequential or temporal coupling***

# How to Be Functional

若真要完全符合 **Functional Design** $\rightarrow$ 遞迴函數
但遞迴函數會造成運算上很大的負擔，因此書上範例中使用了 laziness calculate 來解決。

## Laziness calculate

它的核心思路是將計算的執行延遲到真正需要結果的時候才進行，這種技術在處理大數據集、無限序列或需要動態計算的場景中特別有用，因為它可以避免不必要的計算和記憶體佔用。

以下面的程式碼為例：

- `Main`：
    使用了 Fibonacci().Take(10) 來取得前 10 個斐波那契數字並打印出來。這裡的 Take 方法是一個自定義的擴展方法，用於示範取有限數量的元素。
- `Fibonacci`：
    這個方法使用了 yield return 來依次返回無窮長度的斐波那契數列。每次調用 yield return 時，方法的執行會暫停，並記住當前的執行狀態。當再次訪問序列的下一個元素時，執行會從暫停的位置繼續。
- `ExtensionMethods`：
    Take 方法是一個自定義的擴展方法，它模仿了 LINQ 中的 Take 方法，用於演示如何從無窮序列中取有限數量的元素。這個方法遍歷序列並返回指定數量的元素。

```csharp
public class Program
{
    public static void Main(string[] args)
    {

        foreach (var number in Fibonacci().Take(10))
        {
            Console.Write(number + " ");
        }
    }

    private static IEnumerable<long> Fibonacci()
    {
        long first = 0, second = 1;
        while (true)
        {
            yield return first;
            var temp = first;
            first = second;
            second = temp + second;
        }
    }
}

public static class ExtensionMethods
{
    public static IEnumerable<T> Take<T>(this IEnumerable<T> source, int count)
    {
        var counter = 0;
        foreach (var item in source)
        {
            if (counter++ >= count)
            {
                yield break;
            }

            yield return item;
        }
    }
}

```

## 不是說好不能後天改值嗎

這邊其實作者有提出個蠻 cheating 的想法，那就是當我們很明確知道這個變數當下的值已經不會再被需要了，那為什麼我們要留著它呢？

因此這邊我自己有個想法：
> 變數值的更改只能在確保呼叫端不會再使用該變數的情況下發生。

# 小結

以上是小弟我，截至目前讀到的部分，理論上這會是個連載筆記。如果我的理解有誤或是有不同想法的也可以在下面留言交流一下哈。

# Reference

[書籍](https://www.informit.com/store/functional-design-principles-patterns-and-practices-9780138176396)
