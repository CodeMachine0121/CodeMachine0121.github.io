---
title: "大AI 時代，開發者的新生存法則：從「碼農」到「AI 指揮家」"
datetime: "2026-10-23"
description: "在 Video Coding 興起的時候，社群上大概都有一個共同的焦慮：AI 會不會取代我們？ Kent Beck 透過與他的 AI (genie) 實作一個高效能的 B+ Tree Library 專案，得到的心得是..."
image: "/images/titles/augment-coding.jpg"
---

## Introduction

Hi all，最近讀到了 [Kent Beck](https://substack.com/@kentbeck) 的這篇[文章](https://substack.com/inbox/post/166781850)，最讓我印象深刻的是他文章內提出的觀點。我也針對這些觀點做了些小實驗，於是想寫篇文章記錄一下。

在 Video Coding 興起的時候，社群上大概都有一個共同的焦慮：**AI 會不會取代我們？**

***Kent Beck*** 透過與他的 AI (***genie***) 實作一個高效能的 B+ Tree Library 專案，得到的心得是：

> Yes programming changes with a genie, but it's still programming.

他接著描述了這種與 AI pair programming 的全新體驗：

> In some ways a much better programming experience. I make more consequential programming decisions per hour, fewer boring vanilla decisions.
---

## 觀點一：「Augmented Coding」 vs. 「Vibe Coding」

在這裡 ***Kent Beck*** 提出了一個重要的概念區分：

- **Vibe Coding**: 你只在乎結果，不在乎過程。遇到問題時，就把錯誤訊息丟給 AI，像許願一樣期待它給你一個能動的答案。至於程式碼品質、可維護性？那都不重要。
- **Augmented Coding**: 我們依然是一位專業的軟體工程師。我們關心程式碼的架構、簡潔性、測試覆蓋率。AI 在這裡不是一個許願池，而是一位能力超群、不知疲倦的「Pair Programming 夥伴」，而我們，是那位負責引導方向的 **Navigator**。
---

## 觀點二：全新的體驗——從鍵盤手到「AI 指揮家」

這篇文章最讓我印象深刻的，是 ***Kent Beck*** 為 AI 設定了一套 Coding Rules，內容涵蓋了 TDD（測試驅動開發）的每一步、Tidy First（先整潔）的原則，甚至連 Git 提交的規範都定義得一清二楚。

他會這樣指導 AI：
「下一步，為 plan.md 中那個未完成的測試編寫實作。」（他是用 Claude Code）
「只寫剛好能讓這個測試通過的程式碼。」
「我看到你產生了迴圈，這不是我想要的，停下來。」

這其實給了我一個 **AHA Moment**：
---

> 未來軟體工程師的核心價值，不再是逐字逐句地敲打程式碼，而是定義問題、拆解任務、制定規則，以及監督執行的能力。我們的工作，正從體力密集的「打字」，轉向腦力密集的「決策」。

## 觀點三：當 AI 卡關時，人類的創造力是最終解方

開發過程中，***Kent Beck*** 在 Rust 版本上遇到了瓶頸——B+ 樹的複雜性與程式語言先天的記憶體所有權模型結合，讓 AI 也陷入了困境。這時，他做了一個極富創造力的決定：他讓 AI 先用 Python 寫出一個功能完整的版本。因為 Python 沒有那麼多限制，可以讓演算法本身快速成形。然後，他再命令 AI：「好了，現在把這個成功的 Python 程式碼，『轉譯』成 Rust。」

這個 Workaround 的作法瞬間就解開了問題。這完美地展示了人與 AI 協作的精髓：

> AI 負責繁重的執行，而人類負責在卡關時，提供破框思考的創意與策略。
---

## 觀點四：專注於真正重要的事

***Kent Beck*** 分享說，他想為專案引入覆蓋率測試，但一想到要處理各種供應鏈的版本問題，就超級頭痛。以前可能花兩小時就放棄了，但現在他直接告訴 AI：「幫我跑覆蓋率測試，並提出能增加覆蓋率的測試案例。」AI 默默地就把這一切都搞定了。

這意味著：

> 我們可以把更多寶貴的時間和精力，從繁瑣的雜事中解放出來，專注於架構設計、業務邏輯、使用者體驗等真正創造價值的核心工作上。
---

## 結論：我們的飯碗還在，免驚

讀完這篇文章，我心中多的是一種興奮感。與其說興奮，不如說是手癢，想找個專案試用看看。

總結來說：我認為 AI 不是來搶我們飯碗的，而是來提升我們的開發者體驗。我們的工作正在變得更「好玩」、更有挑戰性。我們將花更少的時間在重複的勞動上，而花更多的時間在思考與創造上。

當然，不用 AI 又不會釐清需求做分析的工程師（碼農），那飯碗可能要小心點了。
