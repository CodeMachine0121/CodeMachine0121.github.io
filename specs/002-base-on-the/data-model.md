# 資料模型：重新設計系列頁面

**功能**：重新設計系列頁面  
**日期**：2025-01-21  
**版本**：1.0.0

## 核心實體

### Series（系列）

**描述**：由共同 parent 值聚合的部落格文章集合

**屬性**：
- `name: string` - 系列名稱（來自 blog.data.parent 值）
- `slug: string` - URL 安全的系列識別符（自動生成）
- `articles: BlogEntry[]` - 屬於此系列的文章陣列
- `count: number` - 文章總數（衍生屬性）

**驗證規則**：
- `name` 必填且不可為空字串
- `slug` 必須為有效 URL 路徑片段
- `articles` 必須按 seriesIndex 升序排列，其次按 datetime 升序
- `count` 必須等於 articles.length

**關聯性**：
- 一個 Series 包含多個 BlogEntry
- 透過 BlogEntry.data.parent 值建立關聯

### BlogEntry（部落格文章）

**描述**：既有 Astro Content Collection 項目，無需修改

**相關屬性**：
- `data.parent?: string` - 所屬系列名稱（可選）
- `data.seriesIndex?: number` - 系列內排序（可選）
- `data.title: string` - 文章標題
- `data.datetime: string` - 發布時間
- `data.description?: string` - 文章描述
- `data.image?: string` - 縮圖路徑
- `slug: string` - URL 路徑

**狀態轉換**：
- 無狀態變化（唯讀資料）

### SeriesPage（系列頁面）

**描述**：動態生成的系列專屬頁面資料結構

**屬性**：
- `series: Series` - 系列資訊
- `paginatedArticles: PaginatedResult<BlogEntry>` - 分頁後的文章
- `breadcrumb: BreadcrumbItem[]` - 導覽路徑

**衍生屬性**：
- `pageTitle: string` - 頁面標題（系列名稱）
- `canonicalUrl: string` - 規範 URL
- `prevPage?: string` - 前一頁 URL（如適用）
- `nextPage?: string` - 下一頁 URL（如適用）

### PaginatedResult<T>

**描述**：分頁資料的通用容器

**屬性**：
- `items: T[]` - 目前頁面項目
- `currentPage: number` - 目前頁碼（1-based）
- `totalPages: number` - 總頁數
- `totalItems: number` - 總項目數
- `itemsPerPage: number` - 每頁項目數
- `hasNext: boolean` - 是否有下一頁
- `hasPrev: boolean` - 是否有上一頁

### BreadcrumbItem

**描述**：導覽麵包屑項目

**屬性**：
- `text: string` - 顯示文字
- `url?: string` - 連結 URL（最後一項通常無連結）
- `active: boolean` - 是否為目前頁面

## 資料流程

### 系列概覽頁面（/series）

```typescript
// 資料聚合流程
const allBlogs = await getCollection('blogs');
const withParent = allBlogs.filter(blog => blog.data.parent?.trim());

const seriesMap = new Map<string, BlogEntry[]>();
for (const blog of withParent) {
  const seriesName = blog.data.parent!.trim();
  const articles = seriesMap.get(seriesName) ?? [];
  articles.push(blog);
  seriesMap.set(seriesName, articles);
}

const seriesList: Series[] = Array.from(seriesMap.entries())
  .map(([name, articles]) => ({
    name,
    slug: createSlug(name),
    articles: sortArticles(articles),
    count: articles.length
  }))
  .sort((a, b) => a.name.localeCompare(b.name, 'zh-TW'));
```

### 系列專屬頁面（/series/[slug]）

```typescript
// 頁面生成流程
export async function getStaticPaths() {
  const seriesList = await generateSeriesList();
  
  return seriesList.flatMap(series => {
    const totalPages = Math.ceil(series.count / ITEMS_PER_PAGE);
    return Array.from({ length: totalPages }, (_, i) => ({
      params: { 
        slug: series.slug 
      },
      props: { 
        series,
        page: i + 1,
        totalPages
      }
    }));
  });
}
```

## 資料驗證

### 輸入驗證
- 系列名稱不可包含特殊控制字元
- 分頁參數必須為正整數
- URL slug 必須為有效路徑片段

### 輸出驗證
- 系列文章排序必須一致且可預測
- 分頁資料數學一致性（總數 = 頁數 × 每頁數量 ± 餘數）
- 麵包屑路徑完整且可導覽

### 錯誤處理
- 無效 slug：返回 404
- 空系列：顯示「此系列尚無文章」
- 分頁超出範圍：重定向至最後一頁

## 效能考量

### 資料快取
- 系列清單在建置時靜態生成
- 個別系列頁面預生成前 3 頁
- 使用 Astro 內建快取機制

### 記憶體優化
- 避免重複載入相同文章資料
- 分頁時僅載入需要的文章子集
- 使用 lazy loading 處理大型系列

### 建置優化
- 平行生成多個系列頁面
- 增量建置支援（僅重建異動系列）
- 靜態資產最小化

## 版本相容性

### 向後相容
- 既有 blog.data.parent 欄位保持不變
- 既有 URL 結構維持（/series 主頁）
- 既有內容格式無需遷移

### 遷移策略
- 無需資料遷移
- 漸進式部署（功能開關控制）
- 舊 URL 自動重定向至新結構

## 測試資料

### 模擬情境
1. **小型系列**：2-3 篇文章
2. **中型系列**：10-20 篇文章
3. **大型系列**：50+ 篇文章
4. **空系列**：有名稱但無文章
5. **特殊字元系列**：包含中文、空格、符號

### 邊界測試
- 系列名稱最大長度
- 單頁最大文章數
- 分頁導覽極限情境
- URL slug 衝突處理