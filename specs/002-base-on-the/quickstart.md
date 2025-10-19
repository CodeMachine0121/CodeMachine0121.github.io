# 快速開始：系列頁面重新設計

**功能分支**: `002-base-on-the`  
**預估時間**: 3-5 工作天  
**前置需求**: 熟悉 Astro 與 TypeScript

## 開發環境設定

### 1. 分支切換與環境準備
```bash
# 確認目前在正確分支
git branch --show-current  # 應顯示 002-base-on-the

# 安裝依賴（如尚未安裝）
npm install

# 啟動開發服務器
npm run dev
```

### 2. 檢查現有結構
```bash
# 檢視現有系列頁面
open http://localhost:4321/series

# 確認既有組件位置
ls src/components/sections/blog/
ls src/pages/series.astro
```

## 實作檢查清單

### Phase 1: 建立核心工具 (第 1 天)

#### ✅ 建立 URL slug 工具
```typescript
// src/utils/slugify.ts
export function createSlug(seriesName: string): string {
  return encodeURIComponent(
    seriesName
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\w\u4e00-\u9fff-]/g, '')
  );
}

// 測試函式
export function validateSlug(slug: string): boolean {
  try {
    const decoded = decodeURIComponent(slug);
    return decoded.length > 0 && decoded.length <= 150;
  } catch {
    return false;
  }
}
```

**驗證步驟**:
- [ ] 中文系列名稱轉換正確
- [ ] 特殊字元處理安全
- [ ] URL 可正常編碼/解碼

#### ✅ 建立系列資料聚合函式
```typescript
// src/utils/series.ts  
import { getCollection, type CollectionEntry } from 'astro:content';
import { createSlug } from './slugify';

type BlogEntry = CollectionEntry<'blogs'>;

export interface Series {
  name: string;
  slug: string;
  articles: BlogEntry[];
  count: number;
}

export async function generateSeriesList(): Promise<Series[]> {
  const allBlogs = await getCollection('blogs');
  const withParent = allBlogs.filter(blog => blog.data.parent?.trim());
  
  const seriesMap = new Map<string, BlogEntry[]>();
  for (const blog of withParent) {
    const seriesName = blog.data.parent!.trim();
    const articles = seriesMap.get(seriesName) ?? [];
    articles.push(blog);
    seriesMap.set(seriesName, articles);
  }
  
  return Array.from(seriesMap.entries())
    .map(([name, articles]) => ({
      name,
      slug: createSlug(name),
      articles: sortArticlesBySeries(articles),
      count: articles.length
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-TW'));
}

function sortArticlesBySeries(articles: BlogEntry[]): BlogEntry[] {
  return articles.sort((a, b) => {
    // 1. seriesIndex 升序（未定義者置後）
    const aIndex = Number.isFinite(a.data.seriesIndex) 
      ? Number(a.data.seriesIndex) 
      : Number.POSITIVE_INFINITY;
    const bIndex = Number.isFinite(b.data.seriesIndex) 
      ? Number(b.data.seriesIndex) 
      : Number.POSITIVE_INFINITY;
    
    if (aIndex !== bIndex) return aIndex - bIndex;
    
    // 2. 發布時間升序（舊到新）
    const aTime = new Date(a.data.datetime).getTime();
    const bTime = new Date(b.data.datetime).getTime();
    return aTime - bTime;
  });
}
```

**驗證步驟**:
- [ ] 系列正確聚合
- [ ] 文章排序符合規格
- [ ] 空系列處理正常

### Phase 2: 修改系列概覽頁 (第 2 天)

#### ✅ 更新 series.astro
```astro
---
// src/pages/series.astro
import Layout from "../layouts/Layout.astro";
import { generateSeriesList } from "../utils/series";

const seriesList = await generateSeriesList();
---

<Layout title="系列文章">
  <section class="py-8">
    <h1 class="text-3xl font-bold mb-6">系列文章</h1>

    {seriesList.length === 0 && (
      <p class="text-offset">目前沒有任何系列文章。</p>
    )}

    <div class="grid gap-4 max-w-4xl">
      {seriesList.map((series) => (
        <a 
          href={`/series/${series.slug}`}
          class="block p-6 border border-default rounded-lg bg-background hover:shadow-md transition-shadow"
        >
          <div class="flex items-center justify-between">
            <h2 class="text-xl font-semibold text-text hover:text-primary transition-colors">
              {series.name}
            </h2>
            <span class="text-sm text-offset bg-background-offset px-3 py-1 rounded-full">
              {series.count} 篇
            </span>
          </div>
        </a>
      ))}
    </div>
  </section>
</Layout>

<style>
  .border-default { border-color: rgba(125, 125, 125, 0.2); }
  .bg-background { background: transparent; }
  .bg-background-offset { background: rgba(125, 125, 125, 0.1); }
  .text-text { color: inherit; }
  .text-offset { opacity: 0.75; }
  .text-primary { color: var(--primary-color, #0066cc); }
</style>
```

**驗證步驟**:
- [ ] 卡片樣式美觀一致
- [ ] 點擊可導向系列頁面
- [ ] 響應式設計正常
- [ ] 空狀態顯示正確

### Phase 3: 建立動態系列頁 (第 3-4 天)

#### ✅ 建立 [slug].astro
```astro
---
// src/pages/series/[slug].astro
import type { GetStaticPaths } from 'astro';
import Layout from "../../layouts/Layout.astro";
import BlogList from "../../components/sections/blog/BlogList.astro";
import { generateSeriesList } from "../../utils/series";
import { validateSlug } from "../../utils/slugify";

export const getStaticPaths: GetStaticPaths = async () => {
  const seriesList = await generateSeriesList();
  
  return seriesList.map((series) => ({
    params: { 
      slug: series.slug 
    },
    props: { 
      series,
      // 傳遞系列資料到頁面組件
    }
  }));
};

const { slug } = Astro.params;
const { series } = Astro.props;

// 驗證 slug 有效性
if (!slug || !validateSlug(slug)) {
  return Astro.redirect('/404', 404);
}

// 處理分頁
const url = new URL(Astro.request.url);
const currentPage = parseInt(url.searchParams.get('page') || '1');
const itemsPerPage = 12;
const totalPages = Math.ceil(series.count / itemsPerPage);

if (currentPage < 1 || currentPage > totalPages) {
  return Astro.redirect(`/series/${slug}`, 302);
}

const startIndex = (currentPage - 1) * itemsPerPage;
const paginatedArticles = series.articles.slice(startIndex, startIndex + itemsPerPage);

// 建立麵包屑
const breadcrumb = [
  { text: '系列文章', url: '/series', active: false },
  { text: series.name, active: true }
];
---

<Layout title={`${series.name} - 系列文章`}>
  <section class="py-8">
    <!-- 麵包屑導覽 -->
    <nav class="mb-6">
      <ol class="flex items-center text-sm text-offset">
        {breadcrumb.map((item, index) => (
          <li class="flex items-center">
            {index > 0 && <span class="mx-2">></span>}
            {item.url ? (
              <a href={item.url} class="hover:text-text transition-colors">
                {item.text}
              </a>
            ) : (
              <span class={item.active ? 'text-text font-medium' : ''}>
                {item.text}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>

    <!-- 系列標題 -->
    <div class="mb-8">
      <h1 class="text-3xl font-bold mb-2">{series.name}</h1>
      <p class="text-offset">共 {series.count} 篇文章</p>
    </div>

    <!-- 文章清單 -->
    {paginatedArticles.length === 0 ? (
      <p class="text-center text-offset py-8">此系列尚無文章。</p>
    ) : (
      <div class="space-y-6">
        {paginatedArticles.map((blog, index) => (
          <div class="blog-item">
            <BlogItem blog={blog} isFirst={index === 0} />
          </div>
        ))}
      </div>
    )}

    <!-- 分頁導覽 -->
    {totalPages > 1 && (
      <nav class="flex justify-center items-center mt-12 space-x-4">
        {currentPage > 1 && (
          <a 
            href={`/series/${slug}?page=${currentPage - 1}`}
            class="px-4 py-2 border border-default rounded hover:bg-background-offset transition-colors"
          >
            上一頁
          </a>
        )}
        
        <span class="text-offset">
          第 {currentPage} 頁，共 {totalPages} 頁
        </span>
        
        {currentPage < totalPages && (
          <a 
            href={`/series/${slug}?page=${currentPage + 1}`}
            class="px-4 py-2 border border-default rounded hover:bg-background-offset transition-colors"
          >
            下一頁
          </a>
        )}
      </nav>
    )}
  </section>
</Layout>

<style>
  .border-default { border-color: rgba(125, 125, 125, 0.2); }
  .bg-background-offset { background: rgba(125, 125, 125, 0.08); }
  .text-text { color: inherit; }
  .text-offset { opacity: 0.75; }
</style>
```

**驗證步驟**:
- [ ] 動態路由正常生成
- [ ] 麵包屑導覽功能正常
- [ ] 文章清單顯示正確
- [ ] 分頁功能運作正常
- [ ] 404 錯誤處理正確

### Phase 4: 整合與優化 (第 5 天)

#### ✅ 導覽連結更新
檢查並更新主導覽中的系列文章連結：
- [ ] 主選單連結到 `/series`
- [ ] 首頁系列區塊連結正確
- [ ] 文章內系列相關連結更新

#### ✅ 效能優化
```typescript
// 加入圖片 lazy loading
// 確認分頁預生成設定
// 檢查建置時間是否合理
```

#### ✅ SEO 優化
- [ ] 各頁面 meta 標籤完整
- [ ] Canonical URL 設定
- [ ] 分頁 prev/next 連結
- [ ] Sitemap 包含新路由

## 測試指南

### 功能測試
```bash
# 1. 建置測試
npm run build

# 2. 預覽測試  
npm run preview
open http://localhost:4321/series

# 3. 路由測試
# 測試各種系列 slug
open http://localhost:4321/series/typescript-basics
open http://localhost:4321/series/invalid-slug  # 應返回 404

# 4. 分頁測試
open http://localhost:4321/series/large-series?page=2
```

### 品質檢查
```bash
# TypeScript 檢查
npm run check

# ESLint 檢查
npm run lint

# 效能測試（可選）
npm run lighthouse
```

### 手動測試檢查清單
- [ ] 系列概覽頁載入正常
- [ ] 系列卡片點擊功能正常
- [ ] 系列頁面顯示正確文章
- [ ] 麵包屑導覽可以使用
- [ ] 分頁功能正常運作
- [ ] 行動裝置顯示正常
- [ ] 無 JavaScript 錯誤
- [ ] 載入速度符合要求

## 故障排除

### 常見問題
1. **中文系列名稱 URL 編碼問題**
   - 檢查 `createSlug` 函式實作
   - 確認瀏覽器正確解碼 URL

2. **文章排序不正確**
   - 檢查 `sortArticlesBySeries` 邏輯
   - 確認 `seriesIndex` 欄位資料正確

3. **分頁導覽錯誤**
   - 檢查頁數計算邏輯
   - 確認 URL 參數解析正確

4. **建置時間過長**
   - 檢查預生成頁面數量設定
   - 考慮調整 `getStaticPaths` 策略

### 除錯技巧
```typescript
// 在開發中加入 console.log 檢查資料
console.log('Series list:', seriesList);
console.log('Current series:', series);
console.log('Paginated articles:', paginatedArticles);
```

## 部署前檢查
- [ ] 所有測試通過
- [ ] 建置成功且無警告
- [ ] 效能符合目標（< 2秒載入時間）
- [ ] 既有功能未受影響
- [ ] 憲章合規性檢查完成

## 完成標準
當以下所有項目完成時，此功能視為完成：
1. ✅ 系列概覽頁重新設計完成
2. ✅ 動態系列頁面實作完成
3. ✅ URL slug 轉換功能正常
4. ✅ 分頁機制運作正確
5. ✅ 所有測試通過
6. ✅ 效能目標達成
7. ✅ 文件更新完整