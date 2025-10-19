# 研究報告：重新設計系列頁面

**功能**：重新設計系列頁面  
**日期**：2025-01-21  
**目的**：解決技術決策與最佳實踐研究

## 研究項目

### 1. Astro 動態路由最佳實踐

**決策**：使用 `[slug].astro` 動態路由處理系列頁面  
**理由**：
- Astro 原生支援動態路由，無需額外依賴
- 符合 RESTful URL 設計原則
- 支援靜態生成，保持效能優勢
- 與既有部落格文章路由模式一致

**替代方案評估**：
- 查詢參數方式 (`/series?name=xxx`)：URL 不夠語義化，SEO 不佳
- 單頁應用路由：增加複雜度，違反極簡原則

### 2. 中文字串 URL Slug 轉換策略

**決策**：使用 `encodeURIComponent` + 自訂清理規則  
**理由**：
- 瀏覽器原生支援，無需額外依賴
- 處理中文字元安全可靠
- 可讀性與技術安全性平衡

**實作方案**：
```typescript
function createSlug(seriesName: string): string {
  return encodeURIComponent(
    seriesName
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\w\u4e00-\u9fff-]/g, '')
  );
}
```

**替代方案評估**：
- 第三方 slug 套件：增加依賴，違反極簡原則
- 僅拼音轉換：失去中文語意，使用者體驗較差

### 3. 分頁實作模式

**決策**：使用 URL 查詢參數 `?page=N` 配合 Astro getStaticPaths  
**理由**：
- 符合 Web 標準分頁慣例
- 支援直接連結與書籤
- Astro 靜態生成相容
- 搜尋引擎友善

**實作策略**：
- 預生成前 3 頁（涵蓋大部分使用情境）
- 超過部分使用 SSR 或客戶端載入
- 每頁 12 篇文章（符合常見卡片佈局）

**替代方案評估**：
- 無限滾動：實作複雜，不符合靜態生成
- 全部載入：效能問題，違反效能目標

### 4. 組件重用策略

**決策**：建立 `SeriesList.astro` 包裝 `BlogList.astro`  
**理由**：
- 最大化程式碼重用
- 保持關注點分離
- 易於維護和測試
- 符合 DRY 原則

**包裝方式**：
```astro
---
// SeriesList.astro
import BlogList from '../blog/BlogList.astro';
const { seriesBlogs, seriesName } = Astro.props;
---
<BlogList blogs={seriesBlogs} title={seriesName} showBackButton={true} />
```

**替代方案評估**：
- 複製 BlogList 程式碼：違反 DRY，維護成本高
- 大幅修改 BlogList：影響既有功能，風險高

## 技術風險評估

### 低風險
- ✅ Astro 動態路由：成熟功能，文檔完整
- ✅ 組件重用：既有架構支援良好
- ✅ URL slug 轉換：瀏覽器原生 API 穩定

### 中風險
- ⚠️ 分頁效能：需測試大量文章情境
- ⚠️ SEO 影響：URL 結構變更需驗證

### 緩解策略
- 分頁：實作效能測試，設定合理限制
- SEO：加入重定向處理，保持既有 URL 相容

## 相依性分析

### 新增相依
- 無（使用原生 API 與既有組件）

### 修改項目
1. `src/pages/series.astro` - 移除展開邏輯，改為卡片導覽
2. 新增 `src/pages/series/[slug].astro` - 動態系列頁面
3. 新增 `src/utils/slugify.ts` - URL 轉換工具
4. 可能修改 `src/components/sections/blog/BlogList.astro` - 加入返回按鈕選項

### 影響評估
- 既有系列頁面功能完全重寫
- 既有 BlogList 組件輕微修改（向後相容）
- 新增 URL 路由，需更新導覽連結

## 結論

所有技術決策均符合專案憲章要求，採用最小化變更與最大化重用策略。無需引入新的外部依賴，基於 Astro 原生功能實作。預期開發週期 3-5 工作天，技術風險低。