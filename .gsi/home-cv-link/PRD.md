# PRD: Home Page CV Link

## 功能描述

將首頁 Hero 區塊的「Download CV」按鈕目標從直接下載 PDF 改為導向 `/cv` 頁面，
讓訪客先瀏覽完整的線上履歷，再視需求從該頁下載 PDF。

## 業務規則

- 首頁 Hero 區塊的「Download CV」按鈕點擊後，導向 `/cv` 頁面（站內導航）
- 不再直接觸發瀏覽器下載行為（移除 `download` 屬性語意）
- 按鈕外觀與文字保持不變（仍顯示「Download CV」）

## 行為情境

### S-1: 使用者從首頁點擊 Download CV
- **Given** 使用者在首頁 `/`
- **When** 使用者點擊「Download CV」按鈕
- **Then** 被導向至 `/cv` 頁面

### S-2: 邊界情況 — 按鈕在頁面可見
- **Given** 使用者在首頁 `/`
- **When** 頁面載入完成
- **Then** 應看到「Download CV」按鈕

### S-3: 邊界情況 — /cv 頁面正常載入
- **Given** 使用者點擊「Download CV」被導向 `/cv`
- **When** `/cv` 頁面載入完成
- **Then** 應看到「James Hsueh」（確認 CV 頁面正常）
