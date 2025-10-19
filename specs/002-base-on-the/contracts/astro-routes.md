# Astro 路由規範

## 系列頁面路由設計

### 系列概覽頁
- **路徑**: `/series`
- **檔案**: `src/pages/series.astro`
- **功能**: 顯示所有系列的概覽卡片
- **資料**: `SeriesOverviewData`

### 系列專屬頁面
- **路徑**: `/series/[slug]`
- **檔案**: `src/pages/series/[slug].astro`
- **功能**: 顯示特定系列的文章清單
- **資料**: `SeriesPageData`

### 分頁路由
- **路徑**: `/series/[slug]?page=N`
- **模式**: 查詢參數分頁
- **預設**: `page=1`
- **範圍**: `1 <= page <= totalPages`

## 路由參數規範

### [slug] 參數
```typescript
// 有效 slug 格式
type SeriesSlug = string; // URL-encoded series name

// 範例
'/series/typescript%E5%85%A5%E9%96%80'  // "TypeScript入門"
'/series/react-hooks'                   // "React Hooks"
'/series/%E7%B3%BB%E7%B5%B1%E8%A8%AD%E8%A8%88' // "系統設計"
```

### 查詢參數
```typescript
interface SeriesQuery {
  page?: string;        // "1", "2", "3", ...
  // 保留未來擴充空間
  sort?: string;        // 未來可能的排序選項
  filter?: string;      // 未來可能的篩選選項
}
```

## 靜態路徑生成

### getStaticPaths 實作規範
```typescript
// src/pages/series/[slug].astro
export async function getStaticPaths(): Promise<GetStaticPaths> {
  const series = await generateAllSeries();
  
  return series.flatMap(serie => {
    const totalPages = Math.ceil(serie.count / ITEMS_PER_PAGE);
    
    // 預生成前 N 頁
    const pagesToGenerate = Math.min(totalPages, PREGENERATE_PAGES);
    
    return Array.from({ length: pagesToGenerate }, (_, i) => ({
      params: { 
        slug: serie.slug 
      },
      props: {
        series: serie,
        page: i + 1,
        totalPages,
        // 傳遞給頁面組件的其他資料...
      }
    }));
  });
}
```

### 路由優先級
1. 靜態路由：`/series` (概覽頁)
2. 動態路由：`/series/[slug]` (系列頁)
3. 404 處理：無效 slug 回傳 404

## URL 重定向規範

### 舊版相容性
```typescript
// 如果有舊的 URL 格式需要重定向
const redirects = {
  '/series?name=typescript-basics': '/series/typescript-basics',
  '/series.html': '/series',
  // ... 其他重定向規則
};
```

### 規範化處理
- 移除 trailing slash: `/series/` → `/series`
- 小寫轉換: `/series/TypeScript-Basics` → `/series/typescript-basics`
- 特殊字元編碼: 自動處理中文字元

## 錯誤處理

### 404 情境
- 無效的系列 slug
- 系列存在但頁數超出範圍
- 格式錯誤的 URL

### 錯誤頁面
```astro
---
// src/pages/series/[slug].astro
const { slug } = Astro.params;
const series = await findSeriesBySlug(slug);

if (!series) {
  return Astro.redirect('/404', 404);
}

const { page = '1' } = Astro.url.searchParams;
const pageNum = parseInt(page);

if (pageNum < 1 || pageNum > series.totalPages) {
  // 重定向到第一頁或最後一頁
  return Astro.redirect(`/series/${slug}`, 302);
}
---
```

## SEO 與 Meta 標籤

### 系列概覽頁
```html
<title>系列文章 - CodeMachine0121 技術分享</title>
<meta name="description" content="探索各種技術主題的系列文章，深度學習程式開發知識。">
<meta property="og:url" content="https://codemachine0121.github.io/series">
<link rel="canonical" href="https://codemachine0121.github.io/series">
```

### 系列專屬頁面
```html
<title>{seriesName} - 系列文章 - CodeMachine0121</title>
<meta name="description" content="閱讀「{seriesName}」系列的所有文章，共 {articleCount} 篇。">
<meta property="og:url" content="https://codemachine0121.github.io/series/{slug}">
<link rel="canonical" href="https://codemachine0121.github.io/series/{slug}">

<!-- 分頁 SEO -->
{page > 1 && (
  <link rel="prev" href="/series/{slug}?page={page-1}">
)}
{page < totalPages && (
  <link rel="next" href="/series/{slug}?page={page+1}">
)}
```

## 效能優化

### 預載入策略
```html
<!-- 在系列概覽頁預載入熱門系列 -->
<link rel="prefetch" href="/series/typescript-basics">
<link rel="prefetch" href="/series/react-tutorial">
```

### 快取標頭
```typescript
// Astro 設定中的快取策略
export default {
  // ...
  server: {
    headers: {
      '/series': {
        'Cache-Control': 'public, max-age=3600' // 1小時
      },
      '/series/*': {
        'Cache-Control': 'public, max-age=7200' // 2小時
      }
    }
  }
}
```

### 圖片優化
```astro
---
// 在系列頁面中優化圖片載入
import { Image } from 'astro:assets';
---

{articles.map((article, index) => (
  <Image 
    src={article.data.image} 
    alt={article.data.title}
    loading={index < 3 ? "eager" : "lazy"}
    width={400}
    height={200}
  />
))}
```

## 測試檢查表

### 路由測試
- [ ] 系列概覽頁可正常存取
- [ ] 有效系列 slug 可正常存取
- [ ] 無效 slug 回傳 404
- [ ] 分頁參數正常運作
- [ ] URL 編碼正確處理中文

### SEO 測試  
- [ ] 所有頁面有正確的 title 和 description
- [ ] Canonical URL 設定正確
- [ ] 分頁有適當的 prev/next 連結
- [ ] Open Graph 資料完整

### 效能測試
- [ ] 首頁載入時間 < 2秒
- [ ] 系列頁面載入時間 < 2秒
- [ ] 圖片 lazy loading 正常運作
- [ ] 預載入不影響初始效能