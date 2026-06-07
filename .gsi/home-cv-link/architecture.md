# Home Page CV Link - 架構設計

> 來源：.gsi/home-cv-link/home-cv-link.feature
> 建立日期：2026-06-07

## 1. 專案上下文

- 程式語言：TypeScript
- 框架：Astro 5.4.1 + Tailwind CSS
- 架構模式：頁面驅動元件組合
- 命名慣例：PascalCase 元件檔名、camelCase 變數

## 2. 功能概述

修改 `src/components/sections/Hero.astro` 中既有「Download CV」`<a>` 元素：
將 `href` 從 `/cv/james_cv.pdf`（直接下載）改為 `/cv`（站內導航），並移除 `download` 屬性。
按鈕文字與樣式完全不變。

## 3. 資料模型

無新增資料模型。修改點為靜態 HTML 屬性，不涉及任何資料流。

## 4. 服務介面

### Hero.astro（`src/components/sections/Hero.astro`）

職責：首頁英雄區塊，包含 CTA 按鈕群

#### Download CV 連結
來源：`"When I click the 'Download CV' link"` / `"I should be navigated to '/cv'"` (feature 第 8-9 行)

**變更前：**
```
href="/cv/{basic.cv_file_name}"  download  role="button"
```

**變更後：**
```
href="/cv"  （移除 download 屬性）
```

**業務規則：**
1. `href` 固定指向 `/cv`，不依賴 `basic.cv_file_name`
2. 移除 `download` 屬性，改為標準站內超連結語意
3. 按鈕文字「Download CV」、class、SVG icon 均不變

## 5. 架構決策

- **修改範圍極小**：僅改 Hero.astro 的一個 `<a>` 的兩個屬性，無需新增元件
- **不抽象化**：href 直接寫死 `/cv`，無需透過 props 傳入；過度抽象反而增加維護成本
- **保留按鈕樣式**：`role="button"` 可一併移除（`<a>` 本身即 link role），但不影響功能，保持最小變更原則

## 6. 情境對應

| 情境 | Feature 行數 | 變更位置 | 互動 |
|---|---|---|---|
| Download CV 按鈕可見 | 4-5 | Hero.astro `<a>` 文字 | Playwright `getByRole('link', {name: 'Download CV'})` |
| 點擊導向 /cv | 8-10 | Hero.astro `href="/cv"` | 標準 `<a>` 導航 |

## 7. 頁面 URL 映射

| feature `<page>` token | 路由 | 對應檔案 |
|---|---|---|
| `"/"` | `/` | `src/pages/index.astro`（不變） |
| `"/cv"` | `/cv` | `src/pages/cv.astro`（既有） |

## 8. 可及名稱清單（Playwright locators）

| 元素類型 | 可及名稱 | 來源元件 |
|---|---|---|
| link | `"Download CV"` | Hero.astro `<a>` 文字內容 |
| text | `"James Hsueh"` | CV 頁面（導航後驗證） |

## 9. 檔案結構

```
src/components/sections/
└── Hero.astro    ← 修改：<a href="/cv">，移除 download 屬性
```
