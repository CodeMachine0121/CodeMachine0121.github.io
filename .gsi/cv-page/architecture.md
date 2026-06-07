# CV Page (International SWE Style) - 架構設計

> 來源：.gsi/cv-page/cv-page.feature
> 建立日期：2026-06-07

## 1. 專案上下文

- 程式語言：TypeScript
- 框架：Astro 5.4.1 + Tailwind CSS
- 架構模式：頁面驅動元件組合（Page → Section Components）
- 命名慣例：PascalCase 元件檔名、camelCase 變數、kebab-case 路由
- **重構說明**：移除既有 `TimelineSection` / `TimelineItem` 依賴（帶有 `data-reveal` 動畫，會造成 PDF 轉換空白）；改以無動畫、print-safe 的 CV 專用元件全面替換

## 2. 功能概述

以西方 SWE Resume 版型重建 `/cv` 頁面：無動畫、單欄、分區清晰，版面順序為
Header → Summary → Experience → Education → Projects，並保留 PDF 下載功能。

## 3. 資料模型

### 3.1 核心實體

#### BasicInfo
來源：`"I should see 'James Hsueh'"` / `"I should see 'Full Stack Software Engineer'"` (feature 第 5-6 行)

| 欄位 | 型別 | 必填 | 說明 |
|---|---|---|---|
| name | string | ✅ | 姓名，顯示於 Header H1 |
| job | string | ✅ | 職稱，顯示於姓名下方 |
| summary.en | string | ✅ | 摘要段落 |
| cv_file_name | string | ✅ | PDF 下載檔名 |

#### SocialLink
來源：`"I should see 'GitHub'"` (feature 第 8 行)

| 欄位 | 型別 | 必填 | 說明 |
|---|---|---|---|
| iconName | string | ✅ | 識別名稱（"Github"、"Email"） |
| link | string | ✅ | 超連結 URL |

#### ExperienceItem
來源：`"I should see 'Cafler'"` 等 (feature 第 9-11 行)

| 欄位 | 型別 | 必填 | 說明 |
|---|---|---|---|
| title | string | ✅ | 職稱 |
| sub_title | string | ✅ | 公司名稱 |
| years | string | ✅ | 年份範圍 |
| details.en | string | - | 職務描述 |
| achievements | `{ en: string }[]` | - | 成就條列 |

#### EducationItem
來源：`"I should see 'National Yunlin University'"` (feature 第 13 行)

| 欄位 | 型別 | 必填 | 說明 |
|---|---|---|---|
| title | string | ✅ | 學位名稱 |
| sub_title | string | ✅ | 學校名稱 |
| years | string | ✅ | 就讀年份 |
| details.en | string | - | 學業描述 |

#### ProjectItem
來源：`"I should see 'GSI Protocol'"` (feature 第 15 行)

| 欄位 | 型別 | 必填 | 說明 |
|---|---|---|---|
| title.en | string | ✅ | 專案標題 |
| type.en | string | ✅ | 類型標籤（Blog、SDK、Certification 等） |
| link | string | - | 外部連結 |

## 4. 服務介面（元件設計）

### cv.astro（`src/pages/cv.astro`）

職責：頁面進入點，自建精簡 HTML shell，組合所有 CV section 元件

```
cv.astro
├── <ActionBar />          ← no-print，含 Back to Home + DownloadButton
├── <div id="cv-content">  ← html2pdf 擷取範圍
│   ├── <CVHeader />
│   ├── <CVSummary />
│   ├── <CVExperience />
│   ├── <CVEducation />
│   └── <CVProjects />
└── </div>
```

---

### CVHeader（`src/components/cv/CVHeader.astro`）

職責：顯示姓名、職稱、social links（GitHub、Email）

**Props 簽名：** `interface Props { basic: BasicInfo; socialLinks: SocialLink[] }`

| Props | 型別 | 說明 |
|---|---|---|
| basic | BasicInfo | 姓名與職稱 |
| socialLinks | SocialLink[] | GitHub / Email 連結列表 |

**渲染結構：**
- `<h1>` → `basic.name`（Playwright locator text: `"James Hsueh"`）
- `<p>` → `basic.job`（locator text: `"Full Stack Software Engineer"`）
- 每個 socialLink 渲染為 `<a>` 含 iconName 文字（locator text: `"GitHub"`, `"Email"`）

---

### CVSummary（`src/components/cv/CVSummary.astro`）

職責：Professional Summary 段落

**Props 簽名：** `interface Props { summary: string }`

**渲染結構：**
- Section 標題：`<h2>Summary</h2>`
- `<p>` → summary 文字

---

### CVExperience（`src/components/cv/CVExperience.astro`）

職責：Work Experience 區段，無動畫，pure HTML list

**Props 簽名：** `interface Props { items: ExperienceItem[] }`

來源：`"I should see 'Cafler'"` / `"Asia Region Business Integration"` (feature 第 9-11、第 18-20 行)

**渲染結構（每筆 entry）：**
- Section 標題：`<h2>Experience</h2>`（Playwright locator text: `"Experience"`）
- 職稱 `<h3>` + 公司 `<span>` + 年份 `<time>` 同一行（右側對齊年份）
- 描述 `<p>`
- achievements → `<ul><li>` bullet list（locator text: `"Asia Region Business Integration"` 等）

---

### CVEducation（`src/components/cv/CVEducation.astro`）

職責：Education 區段

**Props 簽名：** `interface Props { items: EducationItem[] }`

來源：`"I should see 'National Yunlin University'"` (feature 第 13 行)

**渲染結構：**
- Section 標題：`<h2>Education</h2>`（locator text: `"Education"`）
- 每筆：學位 `<h3>` + 學校 `<span>` + 年份 `<time>`
- 描述 `<p>`

---

### CVProjects（`src/components/cv/CVProjects.astro`）

職責：Projects & Publications 區段

**Props 簽名：** `interface Props { items: ProjectItem[] }`

來源：`"I should see 'Projects'"` / `"I should see 'GSI Protocol'"` (feature 第 14-15 行)

**渲染結構：**
- Section 標題：`<h2>Projects</h2>`（locator text: `"Projects"`）
- 每筆：標題（`<a>` 含 link，可點擊） + 類型 badge `<span>`
- 無 link 時退化為純文字 `<span>`

---

### DownloadButton（`src/components/cv/DownloadButton.astro`）

職責：保持既有實作不變（html2pdf.js CDN + window.print() fallback）

**Props 簽名：** `interface Props { fileName: string }`（不變）

## 5. 架構決策

- **不複用 TimelineSection / TimelineItem**：既有元件依賴 `data-reveal` scroll 動畫，元素初始為 `opacity-0`，html2pdf 在靜態快照時擷取不到內容，導致 PDF 空白。CV 專用元件一律不加動畫屬性
- **新建 CVSummary / CVExperience / CVEducation / CVProjects**：語意明確、職責單一，且全部 print-safe；後續維護不受首頁動畫升級影響
- **Section 標題使用語意 `<h2>` + 大寫文字**：符合西方 SWE Resume 視覺慣例（EXPERIENCE、EDUCATION、PROJECTS），且 Playwright `getByText` 可直接命中
- **`id="cv-content"` 包裝**：html2pdf 擷取範圍，同時作為 `@media print` 錨點（隱藏 no-print 元素）
- **socialLinks 顯示 iconName 文字**：讓 Playwright `I should see "GitHub"` 可直接命中可見文字
- **`DownloadButton` 保持不變**：PDF 邏輯已通過 E2E 驗證，不需重寫

## 6. 情境對應

| 情境 | Feature 行數 | 資料模型 | 元件 |
|---|---|---|---|
| 頁面顯示完整 Resume 內容 | 5-17 | BasicInfo, SocialLink, ExperienceItem, EducationItem, ProjectItem | CVHeader, CVSummary, CVExperience, CVEducation, CVProjects |
| 每筆工作經歷顯示 achievements | 20-22 | ExperienceItem.achievements | CVExperience |
| CV 頁面不含首頁特有區塊 | 25-27 | - | cv.astro 不引入 Hero/Portfolio |
| 下載 PDF | 30-31 | BasicInfo.cv_file_name | DownloadButton |
| 返回首頁 | 34-35 | - | `<a href="/">Back to Home</a>` |

## 7. 頁面 URL 映射

| feature `<page>` token | 路由 | 對應檔案 |
|---|---|---|
| `"/cv"` | `/cv` | `src/pages/cv.astro`（重寫） |
| `"/"` | `/` | `src/pages/index.astro`（不變） |

## 8. 可及名稱清單（Playwright locators）

| 元素類型 | 可及名稱 / 文字 | 來源元件 |
|---|---|---|
| text | `"James Hsueh"` | CVHeader `<h1>` |
| text | `"Full Stack Software Engineer"` | CVHeader `<p>` |
| text | `"GitHub"` | CVHeader social link |
| text | `"Experience"` | CVExperience `<h2>` |
| text | `"Cafler"` | CVExperience entry |
| text | `"Doutify Tech"` | CVExperience entry |
| text | `"TitanSoft"` | CVExperience entry |
| text | `"Asia Region Business Integration"` | CVExperience achievement |
| text | `"Re-Construct Credit Loan System"` | CVExperience achievement |
| text | `"CKAD"` | CVExperience achievement（CKAD in TitanSoft achievements） |
| text | `"Education"` | CVEducation `<h2>` |
| text | `"National Yunlin University of Science and Technology"` | CVEducation entry |
| text | `"Projects"` | CVProjects `<h2>` |
| text | `"GSI Protocol"` | CVProjects entry |
| button | `"Download PDF"` | DownloadButton |
| link | `"Back to Home"` | cv.astro ActionBar |

## 9. 檔案結構

```
src/
├── pages/
│   └── cv.astro                    ← 重寫（自建 HTML shell，無動畫）
└── components/cv/
    ├── CVHeader.astro              ← 重寫（加入 socialLinks）
    ├── CVSummary.astro             ← 新建
    ├── CVExperience.astro          ← 新建（取代 TimelineSection）
    ├── CVEducation.astro           ← 新建（取代 TimelineSection）
    ├── CVProjects.astro            ← 新建
    └── DownloadButton.astro        ← 保持不變
```
