# 部落格文章撰寫規範

適用範圍：`src/content/blogs/**` 下的所有文章（尤其是 iThome 系列）。

## 1. 標題層級：從 h2（`##`）開始

- 文章正文的章節標題 **MUST** 從 **h2（`##`）** 開始，子節用 h3（`###`），再下一層用 h4（`####`），依序遞減。
- **NEVER** 在正文中使用 h1（`#`）作為標題。頁面的 `<h1>` 由模板從 frontmatter 的 `title` 自動渲染，正文再放 h1 會造成重複標題。
- 此規則 **不適用於程式碼區塊（```）內**的 `#`——那是程式碼或範例內容，保持原樣。
- **標題（frontmatter `title` 與內文章節標題）NEVER 使用反引號的行內程式碼格式**（如 `` `.claude/` ``、`` `context.md` ``）。標題中要提到目錄或檔名時，直接寫純文字（`.claude/`、`context.md`），反引號只用在正文與條列。

## 2. Frontmatter

每篇文章 **MUST** 包含 `title`、`datetime`、`description`、`image`：

```yaml
---
title: "主標題：副標題"
datetime: "YYYY-MM-DD"
description: "一句話摘要，用於列表與 SEO。"
image: ""
---
```

- **`parent`：系列文章專屬欄位。** 只有屬於某個系列的文章才加上 `parent`，值為系列名稱，且同系列所有文章 **MUST** 完全一致（用於分組與系列排序）。
- **單篇（非系列）文章 NEVER 加 `parent`**——多出此欄位會被誤歸入系列。

```yaml
# 系列文章（例：iThome 2026）才加這一行
parent: "AI Agent Workflow Patterns：從架構設計到自動化開發協議的 30 天實戰"
```

## 3. 檔名

- 檔名 **NEVER** 含 ASCII 斜線 `/`（會被當成路徑分隔，破壞 URL slug）。
- 若標題含 `rules/`、`docs/`、`.claude/` 等斜線，斜線只保留在 frontmatter `title`，**檔名用無斜線版本**（例：title 為 `rules/ 深度剖析`，檔名用 `Day 03：rules 深度剖析…`）。

## 4. 系列連貫性

- 系列文章透過 `datetime` 排序（無 `seriesIndex` 時的預設）；同系列日期 **MUST** 連續且唯一。
- 每篇結尾以「明天 Day N＋1」預告銜接下一篇；開頭可呼應前一天，維持敘事連貫。
- 撰寫 iThome 2026 系列前，**MUST** 先參閱 [`../docs/ithome-2026-series-plan.md`](../docs/ithome-2026-series-plan.md) 確認該篇的標題、日期與在路線圖中的定位。

## 5. 資產

- 圖片、CV PDF 等資產放 Cloudflare R2，**NEVER** 放進 `public/`；frontmatter `image` 填 R2 連結。

## 6. 內文不使用 emoji

- 文章正文 **NEVER** 使用 emoji（如 🚀、✅、⚠️、📌、⏳）。需要標示「注意／重點」時，改用文字（「注意：」「重點：」）或引言區塊（`>`）。
- 箭頭（`→` `←` `↓`）、表格、ASCII 線框等**功能性符號不受此限**。
