---
title: "Day 01：Agent 工程化的起點：從 Prompt 到可複製的執行環境"
datetime: "2026-06-23"
description: "探討 AI Agent 開發從『提示詞工程』轉向『系統架構設計』的必要性，確立 30 天路線圖，並提出貫穿全系列的三層心智地圖：context、invoke、enforce。"
image: ""
parent: "AI Agent Workflow Patterns：從架構設計到自動化開發協議的 30 天實戰"
---

在過去兩年，AI 應用的開發往往聚焦於「Prompt Engineering」。我們花大量時間調整 System Prompt，試圖讓模型在單次呼叫中輸出完美結果。然而當任務變成長週期的軟體工程（重構模組、自動化 CI/CD、跨檔案修改）時，這種「單次 Prompt」的方法很快達到極限——我們稱之為「複雜度崩潰 (Complexity Collapse)」。

這個系列要談的，是如何把 Agent 從「一次性對話」升級成「一套可複製、可版控、分層清楚的執行環境」。

## 1. 為什麼單點推理 (Single-shot) 會失敗？
單純依賴 LLM 的湧現能力，在長任務上缺乏工程上的可預測性。我們常面臨三大挑戰：

*   **上下文衰減 (Context Decay)：** 模型執行到第 10 步時，往往已模糊了最初的設計約束。
*   **不可觀測性 (Lack of Observability)：** 任務失敗時，開發者只看到最終錯誤，無法洞察 Agent 在哪個節點偏離。
*   **邏輯漂移 (Logic Drift)：** 沒有流程紀律，AI 會在多任務間思維發散，讓程式碼庫逐漸混亂。

## 2. 什麼是 Workflow Pattern？
Workflow Pattern 是一種「把認知過程結構化」的架構語言。它不是單純的 Prompt，而是一套定義明確的邏輯拓撲：

1.  **節點 (Nodes)：** 執行的最小單元（AI 推理，或一個具體工具）。
2.  **邊 (Edges)：** 資料流與控制流，規定前一步的產出如何成為下一步的輸入。
3.  **邊界 (Boundaries)：** 任務成功、失敗、以及何時該進入 Human-in-the-loop 的判定。

## 3. 本系列的執行引擎：Claude Code
接下來 30 天，我們統一使用 Claude Code 作為核心執行引擎。我們不把它當 Chatbot，而是一個 CLI-based 的 Agentic Runtime：它直接運作在你的檔案系統上，讀 git 歷史、跑 bash、改檔案，並透過 .claude/ 目錄下的各種機制被約束與擴充。

## 4. 三層心智地圖：context、invoke、enforce
這是貫穿整個第一階段、也是最重要的一張地圖。.claude/ 裡每個機制，都只屬於以下三類之一：

*   **context（會讀，但不保證遵守）：** 啟動就被讀進上下文的東西，例如 CLAUDE.md、rules。它影響模型的傾向，但模型可能不照做。
*   **invoke（觸發才載入）：** 平常不佔上下文，被叫到才展開，例如 skills、subagents。
*   **enforce（唯一能硬擋的層）：** 由 harness 強制執行、不進上下文，例如 settings/permissions 與 hooks。只有這一層能真正擋下一個動作。

多數人對 .claude/ 的最大誤解，就是把「載入」當成「強制」——以為寫進 rules 的東西 Agent 就一定會遵守。第一階段的目標，就是讓你看到任何一個機制，都能準確把它歸到這三層中的哪一層。

## 5. 30 天路線圖
*   **第一階段（Day 01–07）：** Claude Code 的真實機制與 .claude/——CLAUDE.md、記憶、rules、skills、subagents、hooks，最後組成一個可複製的 starter。
*   **第二~五階段（Day 08–30）：** Agent Workflow Patterns——ReAct、CoT、ToT、Supervisor、Debate、Map-Reduce 等，建立在第一階段這個正確的執行環境之上。

一個觀念先記住：**Agent 的能力上限，不是由模型決定，而是由你的執行環境與 Workflow 架構決定的。**

---

**今日實踐任務：**
找一個練習專案（或新開一個），執行 `git init`，並在根目錄建立一個空的 `.claude/` 資料夾。這就是接下來六天會逐日長大的範本起點——我們會一塊一塊把真實機制疊上去，第七天收成一個能 clone 來用的 starter。

*明天 Day 02，我們從「Agent 啟動時到底讀進了什麼」開始：CLAUDE.md 與 auto memory——兩個每次啟動都會被載入的內建記憶機制，也是三層地圖裡 context 的第一站。*
