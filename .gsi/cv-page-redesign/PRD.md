# PRD: CV Page Redesign with Profile Picture & cv.json

## 功能描述

重新設計 `/cv` 頁面，提升視覺質感與專業度：
1. 將 CV 的主要文案從 `introduce.json` 遷移到獨立的 `cv.json`，並使用 action-verb + 量化結果的專業措辭。
2. 在 Header 區塊加入大頭照（profile picture），強化個人品牌識別。
3. 整體版型升級為現代、簡潔的工程師 Portfolio CV 風格。

## 業務規則

- 新建 `src/config/cv.json`，作為 CV 頁面的唯一資料來源；`introduce.json` 繼續保留供首頁使用，互不影響
- `cv.json` 的 summary 需為 3–4 句的 professional summary，包含年資、技術棧、工作風格等關鍵屬性詞
- `cv.json` 的每筆 experience achievement 需以行動動詞開頭（如 Built、Implemented、Led），並盡量包含量化指標
- Header 區塊需顯示大頭照（圓形或圓角），位置在姓名左側或上方
- 大頭照來源為 `src/assets/profile-picture.png`
- CV 頁面各區塊順序不變：Header → Summary → Experience → Education → Projects
- 版面維持可列印（Print）與 PDF 下載優先，大頭照需隨 PDF 一併輸出
- 既有的 Download PDF 與 Back to Home 功能不得退化

## 行為情境

### S-1: 使用者瀏覽 CV 頁面，看到大頭照與完整履歷
- **Given** 使用者開啟 `/cv`
- **When** 頁面載入完成
- **Then** 應在 Header 區塊看到大頭照圖片
- **And** 應看到姓名「James Hsueh」與職稱「Full Stack Software Engineer」
- **And** 應看到 GitHub 連結與 Email 連結
- **And** 應看到 3–4 句的 Professional Summary，文字比舊版更豐富
- **And** 應看到 Experience 區段，每筆 achievement 以行動動詞開頭
- **And** 應看到 Education 與 Projects 區段

### S-2: cv.json 提供獨立且更豐富的 CV 文案
- **Given** `cv.json` 已建立
- **When** CV 頁面載入
- **Then** Summary 文字應包含年資描述（如「4+ years」或具體年份範圍）
- **And** Experience 的 achievement bullets 應以動詞開頭（Built / Implemented / Led 等）
- **And** 至少 2 筆 experience 的 achievement 含可量化的成果描述

### S-3: 大頭照在 PDF 下載時正確顯示
- **Given** 使用者在 `/cv` 頁面上
- **When** 使用者點擊「Download PDF」按鈕
- **Then** 下載的 PDF 中，Header 區塊包含大頭照

### S-4: 大頭照載入失敗時頁面不崩潰
- **Given** profile-picture.png 無法正常載入
- **When** CV 頁面載入
- **Then** 頁面仍正常顯示，Header 以姓名縮寫 Fallback 或空白圖佔位，不顯示錯誤

### S-5: Back to Home 與 Download PDF 功能不退化
- **Given** 使用者在 `/cv` 頁面上
- **When** 使用者點擊「Download PDF」按鈕
- **Then** 瀏覽器自動下載 PDF 檔案
- **When** 使用者點擊「Back to Home」連結
- **Then** 被導向至首頁 `/`
