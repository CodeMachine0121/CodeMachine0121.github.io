# Astro Resume Theme

Astro Resume Theme is a fully customizable and responsive template, built to help you create a beautiful online resume or portfolio with ease. It is powered by Astro and styled using Tailwind CSS, making it fast, modern, and easy to work with.

## Usage

You can bootstrap a new Astro project using the following command:

```bash
# Bun
bun create astro@latest --template wasutz/astro-resume-theme

# bun 7+
bun create astro@latest -- --template wasutz/astro-resume-theme

# pnpm
pnpm dlx create-astro --template wasutz/astro-resume-theme

# yarn
yarn create astro --template wasutz/astro-resume-theme
```

## 🚀 Features

- Tailwind CSS: Utilizes utility-first styling for rapid UI development.
- Dark Mode: Built-in dark mode toggle for better UX.
- Theme Customization: Easily adjustable in src/styles/theme.css.
- Responsive Design: Optimized for mobile, tablet, and desktop devices.
- MDX Support: Allows blog posts written in Markdown with JSX components.
- Excellent Lighthouse/PageSpeed scores
- SEO-friendly

## 🧞 Commands

All commands are run from the root of the project, from a terminal:
(Could be use 'bun' instead of bun)

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `bun install`             | Installs dependencies                            |
| `bun run dev`             | Starts local dev server at `localhost:4321`      |
| `bun run build`           | Build your production site to `./dist/`          |
| `bun run preview`         | Preview your build locally, before deploying     |
| `bun run astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `bun run astro -- --help` | Get help using the Astro CLI                     |

# Getting Started

1) Initialize the project
Run one of the commands listed in the Quick Start section.

2) Customize your resume data
Edit your resume data in `src/config/cv.json`

3) Customize theme colors
Modify the color scheme by editing `src/styles/theme.ts` to match your personal branding.

4) Replace your CV file
Put your cv file in `src/public/cv` and then replace the file name in `src/config/cv.json` (basic.cv_file_name)

5) Run the project locally
Once you’ve made your customizations, run the development server:

```
bun run dev
```

Open http://localhost:4321 in your browser to view the result 🚀

## License

Licensed under the MIT License, Copyright © Wasut Panyawiphat.

See [LICENSE](/LICENSE) for more information.

## 系列文章頁（/series）

本專案提供「系列文章」聚合頁，將具有 Frontmatter `parent` 的文章以系列分組顯示。

- 路徑與導覽：
  - 頁面路徑：`/series`
  - Header 選單已新增「系列文章」，首頁亦提供入口連結
- 文章標記（Frontmatter 範例）：
  ```md
  ---
  title: "文章標題"
  datetime: "YYYY-MM-DD"
  description: "可選"
  image: "可選"
  parent: "系列主題名稱"     # 指定所屬系列
  seriesIndex: 1              # 可選：系列內排序（小 → 大）
  ---
  ```
- 排序規則：
  - 系列卡片：依系列名稱字母序（locale：zh-TW）
  - 系列內文章：先依 `seriesIndex` 升冪；若相同或未設定，依 `datetime` 由早到晚（舊 → 新）
- 可近性：系列卡片可展開/收合，支援鍵盤（Enter/Space），ARIA 標註包含 `aria-controls`/`aria-expanded` 與 `role="region"`

### 驗證（可選）

執行以下指令列出各系列與文章數，並檢查排序是否符合規範：

```
node scripts/verify-series.mjs
```
