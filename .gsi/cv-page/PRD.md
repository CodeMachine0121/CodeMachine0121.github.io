# PRD: CV Page (International SWE Style)

## 功能描述

提供獨立的 `/cv` 頁面，以西方軟體工程師 Resume 排版呈現 James Hsueh 的完整履歷，
供投遞國際職缺使用。版面乾淨、分區清晰，支援一鍵下載 PDF（A4 列印優化）。

## 業務規則

- 路由為 `/cv`，與首頁完全分離，不含 Hero、Portfolio、Header 導覽列等
- 資料全部來自 `cv.json`（basic、experiences、education、projects、socialLinks）
- 版面依標準 Resume 順序排列：Header → Summary → Experience → Education → Projects
- Header 區塊需顯示：姓名、職稱、以及 socialLinks（GitHub、Email）
- Experience 每筆需顯示：職稱、公司名、年份、職務描述、achievements bullet points
- Projects 區段顯示 cv.json 的 `projects` 陣列，含標題與類型標籤
- 頁面無動畫效果，確保 PDF 轉換品質
- 提供「Download PDF」按鈕，觸發瀏覽器端 HTML → PDF（A4）並自動下載
- PDF 內容不含 Download 按鈕本身與返回首頁連結（列印時隱藏）
- 提供「Back to Home」連結導回 `/`
- PDF 函式庫載入失敗時降級至 `window.print()`

## 行為情境

### S-1: 使用者瀏覽 CV 頁面，看到完整履歷
- **Given** 使用者開啟 `/cv`
- **When** 頁面載入完成
- **Then** 應看到姓名「James Hsueh」與職稱「Full Stack Software Engineer」
- **And** 應看到 GitHub 連結與 Email 連結
- **And** 應看到 Professional Summary 段落
- **And** 應看到 Experience 區段，含 Cafler、Doutify Tech、TitanSoft 三筆
- **And** 每筆工作經歷應顯示職稱、公司、年份、描述與 bullet achievements
- **And** 應看到 Education 區段，含兩筆學歷
- **And** 應看到 Projects 區段，含 GSI Protocol 等項目

### S-2: 使用者下載 CV 為 PDF
- **Given** 使用者在 `/cv` 頁面上
- **When** 使用者點擊「Download PDF」按鈕
- **Then** 瀏覽器自動下載名為 `james_cv.pdf` 的 PDF 檔案

### S-3: 使用者從 CV 頁面返回首頁
- **Given** 使用者在 `/cv` 頁面上
- **When** 使用者點擊「Back to Home」連結
- **Then** 被導向至首頁 `/`

### S-4: PDF 函式庫失敗降級
- **Given** PDF 函式庫無法載入
- **When** 使用者點擊「Download PDF」按鈕
- **Then** 觸發瀏覽器原生列印對話框，不顯示 JS 錯誤給使用者
