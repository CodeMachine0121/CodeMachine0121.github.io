# Coding Afternoon

James Hsueh 的技術部落格與作品集，網址 <https://coding-afternoon.com>。
以 Astro 建置為靜態站，推上 `main` 由 GitHub Actions 部署到 GitHub Pages。

## 開發

需要 [Bun](https://bun.sh)。

```bash
bun install
bun run dev        # http://localhost:4321
```

## 指令

| 指令 | 作用 |
| :--- | :--- |
| `bun run dev` | 開發伺服器 |
| `bun run build` | `astro check` 後輸出到 `dist/` |
| `bun run preview` | 預覽 `dist/` |
| `bun run lint` | ESLint（flat config，`no-console` 是 error） |
| `bun run test` | `src/**/tests/` 的單元測試，不需要先建置 |
| `bun run test:build` | `tests/` 的產物驗收測試，**需要先 `bun run build`** |
| `bun run verify` | lint → test → build → test:build，與 CI 同一條 |
| `bun run e2e` | Playwright BDD |

## 結構

```
src/
├── components/     # 版面、區塊與共用元件
├── config/         # CV 與個人資訊的 JSON 資料
├── content/blogs/  # 文章（Markdown），content collection 的來源
├── layouts/        # Layout.astro：<head>、SEO meta、頁面外框
├── pages/          # 路由
├── styles/         # 全域樣式與 handdrawn 設計系統
├── types/
└── utils/
    ├── series-core.ts   # 分組／排序／相鄰的純邏輯，無 Astro 相依
    ├── series.ts        # astro:content 包裝
    └── tests/           # 單元測試
tests/              # 針對 dist/ 的產物驗收測試
```

測試檔放在所屬層級的 `tests/` 資料夾裡。

## 寫文章

文章放 `src/content/blogs/`，frontmatter：

```yaml
---
title: "主標題：副標題"
datetime: "YYYY-MM-DD"
description: "一句話摘要，會進 meta description 與分享預覽。"
image: ""          # 分享縮圖網址（放 Cloudflare R2）
parent: "系列名稱"  # 系列文章才加；同系列必須完全一致
draft: true        # 尚未發佈；會從列表、系列、RSS 與建置一併隱藏
---
```

`getPublishedBlogs()`（`src/utils/series.ts`）是全站取用文章的唯一入口，
草稿的過濾集中在那裡。

撰寫規範見 [`.claude/rules/blog-writing-style.md`](.claude/rules/blog-writing-style.md)。

## 兩個容易誤會的地方

- **「上一篇／下一篇」的方向在兩種列表刻意不同。** 兩者都是「閱讀順序上的前一篇」，
  但系列是第一篇讀到最後一篇，單篇是最新讀到最舊，所以系列的「上一篇」比較舊、
  單篇的「上一篇」比較新。`src/utils/tests/series-core.test.ts` 有測試鎖住這個行為。
- **系列頁的 slug 就是網址。** `src/utils/tests/slugify.test.ts` 把已上線的四個
  slug 寫死進測試，改 slug 規則若動到它們就是 404。

## 授權

程式碼採 [MIT](LICENSE)；`src/content/` 下的文章內容版權為作者所有。
