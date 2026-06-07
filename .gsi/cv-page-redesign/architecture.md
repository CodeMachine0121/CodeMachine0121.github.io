# CV Page Redesign - 架構設計

> 來源：.gsi/cv-page-redesign/cv-page-redesign.feature
> 建立日期：2026-06-07

## 1. 專案上下文

- 程式語言：TypeScript
- 框架：Astro 5.4.1 + Tailwind CSS
- 架構模式：靜態頁面 + 元件化 (Component-based)；資料集中於 `src/config/`
- 命名慣例：元件 PascalCase（`CVHeader.astro`）；資料欄位 snake_case（`cv_file_name`）

## 2. 功能概述

此次重新設計擴充既有 `/cv` 頁面，主要目標：

1. **資料分離**：新增 `src/config/cv.json`，使 CV 頁面不再直接依賴 `introduce.json`，讓 CV 專屬措辭（professional summary、action-verb achievements）獨立維護。
2. **大頭照**：在 CVHeader 元件加入 `profile-picture.png`，呈現於姓名左側，提升個人品牌識別。
3. **視覺升級**：CVHeader 改為左右雙欄（大頭照 ＋ 文字），整體間距、字型層級微調為更現代的工程師 CV 風格。

## 3. 資料模型

### 3.1 cv.json 完整結構

#### CvBasicInfo
來源："I should see 'James Hsueh'" (第 7 行)、"I should see 'Full Stack Software Engineer'" (第 8 行)

| 欄位 | 型別 | 必填 | 說明 |
|---|---|---|---|
| name | string | ✅ | 姓名 |
| job | string | ✅ | 職稱 |
| location | string | ✅ | 所在地（新增） |
| email | string | ✅ | Email（從 socialLinks 提升至 basic，CV 需直接顯示） |
| summary | { en: string } | ✅ | 3–4 句的 professional summary |
| cv_file_name | string | ✅ | 下載 PDF 的檔名 |

#### CvExperienceItem
來源："I should see 'Cafler'" (第 22 行)、"I should see 'Implemented'" (第 23 行)

| 欄位 | 型別 | 必填 | 說明 |
|---|---|---|---|
| title | string | ✅ | 職稱 |
| sub_title | string | ✅ | 公司名 |
| years | string | ✅ | 年份範圍 |
| details | { en: string } | - | 職位描述 |
| achievements | { en: string }[] | ✅ | 以行動動詞開頭的成就 bullet |

#### CvEducationItem
來源："I should see 'National Yunlin University of Science and Technology'" (第 29 行)

| 欄位 | 型別 | 必填 | 說明 |
|---|---|---|---|
| title | string | ✅ | 學位名稱 |
| sub_title | string | ✅ | 學校名稱 |
| years | string | ✅ | 就學年份 |
| details | { en: string } | - | 學習重點描述 |

#### CvProjectItem
來源："I should see 'GSI Protocol'" (第 30 行)

| 欄位 | 型別 | 必填 | 說明 |
|---|---|---|---|
| title | { en: string } | ✅ | 專案名稱 |
| type | { en: string } | ✅ | 類型標籤（Blog / Certification / SDK 等） |
| link | string | - | 外部連結 |

#### CvSocialLink
來源："I should see 'GitHub'" (第 9 行)、"I should see 'Email'" (第 10 行)

| 欄位 | 型別 | 必填 | 說明 |
|---|---|---|---|
| iconName | string | ✅ | "Github" / "Email" / "Instagram" |
| link | string | ✅ | 完整 URL 或 mailto: |

### 3.2 TypeScript 型別（更新 src/types/cv.ts）

新增 `CvData` 根型別，作為 cv.json 的整體結構定義：

```
CvData {
  basic: CvBasicInfo
  experiences: CvExperienceItem[]
  education: CvEducationItem[]
  projects: CvProjectItem[]
  socialLinks: CvSocialLink[]
}
```

## 4. 元件介面（服務介面）

### CVHeader.astro（更新）

職責：顯示大頭照、姓名、職稱、聯絡連結

來源："the 'profile picture' should be visible" (第 6 行)、"I should see 'GitHub'" (第 9 行)

**Props 介面：**

| Prop | 型別 | 說明 |
|---|---|---|
| basic | CvBasicInfo | 姓名、職稱、email、location |
| socialLinks | CvSocialLink[] | GitHub / Email 連結 |
| profilePicture | ImageMetadata | 從 `src/assets/profile-picture.png` import 後傳入（Astro Image 優化） |

**畫面結構：**
```
<header>
  ┌─────────────────────────────────────────────┐
  │  [大頭照 80×80px 圓形]  James Hsueh          │
  │                         Full Stack SWE       │
  │                         📍 Taiwan            │
  │                         GitHub · Email       │
  └─────────────────────────────────────────────┘
```

**大頭照 Fallback：**
- 若圖片載入失敗，顯示以姓名首字母「JH」為內容的圓形色塊佔位

### cv.astro（更新）

職責：CV 頁面入口，改為從 `cv.json` 讀取資料，並傳入 profilePicture import 給 CVHeader

來源："I am on the '/cv' page" (第 5 行)

**變更：**
- `import { basic, experiences, ... } from '../config/introduce.json'`
  → `import cvData from '../config/cv.json'`
- 新增 `import profilePicture from '../assets/profile-picture.png'`
- 傳遞 `profilePicture` 給 `<CVHeader>`

### CVSummary.astro（維持不變）

介面不變，但 summary 文字由 cv.json 提供更豐富的版本

### CVExperience.astro（維持不變）

介面不變，但 achievements 文字由 cv.json 提供 action-verb 版本

## 5. 架構決策

- **為何新建 cv.json 而非修改 introduce.json**：`introduce.json` 同時供首頁使用，CV 的措辭風格（action-verb, 量化結果）與首頁簡介措辭不同，分離維護避免相互干擾。
- **為何在 cv.astro import profilePicture 再傳入 CVHeader**：遵循 Astro 的 Image 最佳化流程——`import` 在編譯期解析，由 `<Image>` 元件輸出最佳化的 `<img>`，避免在 CVHeader 內部動態 import 導致 SSG 無法靜態追蹤。
- **大頭照呈現**：左右雙欄 flex layout，照片固定 80×80px 圓形（`rounded-full object-cover`），與文字水平對齊。

## 6. 情境對應

| 情境 | 行數 | 資料模型 | 元件 |
|---|---|---|---|
| Header 顯示大頭照與基本資訊 | 4–10 | CvBasicInfo, CvSocialLink | CVHeader（更新） |
| Summary 顯示 3 句以上 professional summary | 12–15 | CvBasicInfo.summary | CVSummary |
| Experience achievements 以動詞開頭 | 17–24 | CvExperienceItem.achievements | CVExperience |
| Education 與 Projects 正常顯示 | 26–31 | CvEducationItem, CvProjectItem | CVEducation, CVProjects |
| Download PDF | 33–36 | CvBasicInfo.cv_file_name | DownloadButton |
| Back to Home | 38–41 | — | cv.astro nav link |

## 7. 可及性名稱清單（Playwright locator 所需）

以下元素必須在 DOM 中具有對應的可見文字或 aria-label，讓 Gherkin 斷言可命中：

| 斷言 | 所需可見元素 |
|---|---|
| `the "profile picture" should be visible` | `<img alt="profile picture">` 或 `<img alt="James Hsueh">` |
| `I should see "GitHub"` | 連結文字為 "GitHub" 的 `<a>` |
| `I should see "Email"` | 連結文字為 "Email" 的 `<a>` |
| `I click the "Download PDF" button` | `<button>` 文字為 "Download PDF" |
| `I click the "Back to Home" link` | `<a>` 文字為 "Back to Home" |

## 8. 檔案結構

```
src/
├── config/
│   ├── introduce.json          # 維持不變（首頁用）
│   └── cv.json                 # 新增（CV 頁面專用）
├── types/
│   └── cv.ts                   # 更新：新增 CvData 根型別
├── assets/
│   └── profile-picture.png     # 既有（直接使用）
├── pages/
│   └── cv.astro                # 更新：改從 cv.json 讀取 + profilePicture
└── components/cv/
    ├── CVHeader.astro           # 更新：加入大頭照 prop
    ├── CVSummary.astro          # 維持不變
    ├── CVExperience.astro       # 維持不變
    ├── CVEducation.astro        # 維持不變
    ├── CVProjects.astro         # 維持不變
    ├── CVSection.astro          # 維持不變
    ├── CVTimelineEntry.astro    # 維持不變
    └── DownloadButton.astro     # 維持不變
```
