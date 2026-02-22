# Giscus 留言板功能設計

**日期**：2026-02-22
**功能**：在部落格文章內頁加入 Giscus 留言板

---

## 背景與目標

為靜態 Astro 部落格（coding-afternoon.com）新增留言功能，讓讀者可在每篇文章下方留言互動。

**選擇方案**：Giscus（GitHub Discussions 後端）+ 純 Astro/JS（無 React 依賴）

---

## 技術選型理由

- **Giscus**：開源、無廣告、留言儲存於自己的 GitHub Discussions
- **GitHub 登入**：適合技術型部落格受眾，減少垃圾留言
- **方案 C（腳本 + postMessage）**：不需引入 React，與現有 Astro 架構一致，且能完整同步 dark/light theme

---

## 架構

### 檔案變更

```
src/components/common/
  └── GiscusComments.astro   ← 新建

src/pages/blogs/
  └── [slug].astro           ← 在 <PostNavigation /> 後加入 <GiscusComments />
  └── [...slug].astro        ← 同上
```

### GiscusComments.astro 功能

1. 在掛載時讀取 `document.documentElement.dataset.theme` 判斷目前主題
2. 動態插入 Giscus `<script>` 標籤，帶入正確的 `data-theme`
3. 監聽 theme 切換事件（目前使用 `data-theme` attribute 變更），用 `postMessage` 通知 Giscus iframe 切換主題

### Giscus 設定

| 參數 | 值 |
|---|---|
| `repo` | `CodeMachine0121/CodeMachine0121.github.io` |
| `repo-id` | *(從 giscus.app 取得)* |
| `category` | `General` |
| `category-id` | *(從 giscus.app 取得)* |
| `mapping` | `pathname` |
| `strict` | `0` |
| `reactions-enabled` | `1` |
| `emit-metadata` | `0` |
| `input-position` | `bottom` |
| `theme` | 動態切換 `light` / `dark` |
| `lang` | `zh-TW` |

---

## 前置作業（手動，需要使用者操作）

1. GitHub repo Settings → Features → **Discussions 打開**
2. 安裝 **Giscus GitHub App**：https://github.com/apps/giscus
3. 前往 https://giscus.app，填入 repo 資訊，取得 `repo-id` 與 `category-id`

---

## Theme 同步機制

```
[使用者切換 dark/light]
  → document.documentElement.dataset.theme 改變
  → MutationObserver 偵測到屬性變更
  → postMessage 到 .giscus-frame iframe
  → Giscus 即時切換主題
```

---

## 不在範圍內

- 後台留言審核介面（留言直接在 GitHub Discussions 管理）
- 電子郵件通知設定（使用者自行在 GitHub 設定 Watch）
- 留言分頁或搜尋（Giscus 內建）

---

## 成功標準

- [ ] 每篇文章底部顯示 Giscus 留言區塊
- [ ] 未登入者看到提示，點擊後跳轉 GitHub OAuth
- [ ] 切換 dark/light mode 時留言區塊主題跟著切換
- [ ] 系列文章（`[...slug].astro`）也有留言功能
