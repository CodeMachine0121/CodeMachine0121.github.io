---
description: "Task list for feature: 系列文章頁面與標記規範"
---

# 任務清單：系列文章頁面與標記規範

**輸入**：`/specs/001-page-list-wording/` 內的設計文件  
**前置條件**：已完成 plan.md、spec.md（草稿完成），並同步 research.md、data-model.md、quickstart.md

> 所有任務使用繁體中文撰寫，並遵守《CodeMachine0121 技術分享部落格憲章》。任務避免過度設計，聚焦 KISS 與可驗證結果。

## Phase 1：環境設定（共用基礎）

**目的**：建立必要檔案與品質檢查流程

- [x] T001 在 `src/pages/series.astro` 建立頁面檔（骨架與標題）
- [x] T002 於 `src/content/config.ts` 新增選用欄位 `seriesIndex: z.number().int().nonnegative().optional()` 並確保 `parent` 允許為可選字串
- [x] T003 [P] 於 `package.json` 新增腳本 `lint`（例如：`eslint .`）與 `check`（`astro check` 已在 build 觸發）
- [x] T004 [P] 新增 `.eslintrc.cjs`（基本規則即可，對齊 TypeScript/Astro）與 `.eslintignore`

---

## Phase 2：基礎要件（阻擋項）

**目的**：完成所有故事前必備的共用能力

- [x] T005 建立系列聚合與排序邏輯於 `src/pages/series.astro`（以 `getCollection('blogs')` 讀取，依 `parent` 聚合）
- [x] T006 定義排序規則：系列依名稱字母序；系列內文章以 `seriesIndex` 升冪，缺省則回退 `datetime` 新到舊（寫於頁內註解）
- [x] T007 驗證前置：在本機以假資料（或既有內容）印出系列名稱與文章數於 console（開發時）

**檢查點**：聚合與排序正確，頁面可載入，無型別錯誤。

---

## Phase 3：使用者故事 1－瀏覽系列清單（優先度：P1）🎯 MVP

**目標**：顯示系列清單（長條卡片樣式可極簡），每張卡片含系列主標題與文章數量

**獨立測試方式**：能在 `/series` 頁看到正確的系列清單與數量，不依賴展開/收合。

### 實作任務

- [x] T010 [P] [US1] 於 `src/pages/series.astro` 渲染系列清單（僅顯示主標題與計數）
- [x] T011 [P] [US1] 在 `src/config/cv.json` 的 `menuItems` 加入 `{ name: "系列文章", link: "/series" }`
- [x] T012 [US1] 於 `src/pages/index.astro` 新增前往 `/series` 的入口（按鈕或連結，極簡即可）

**檢查點**：系列清單可見；主導覽與首頁皆可到達 `/series`。

---

## Phase 4：使用者故事 2－展開系列查看文章（優先度：P2）

**目標**：點擊卡片於頁內展開該系列文章清單；支援再次點擊收合；允許多卡片同時展開；鍵盤可操作。

**獨立測試方式**：不導向文章頁，僅檢查展開/收合與列表內容正確。

### 實作任務

- [ ] T020 [US2] 在 `src/pages/series.astro` 實作展開/收合行為（可用原生 JS；多卡片同時展開）
- [ ] T021 [US2] 加入 ARIA 屬性與鍵盤操作（Enter/Space 切換；聚焦樣式）於 `src/pages/series.astro`
- [ ] T022 [US2] 處理空系列提示：「此系列尚無文章」

**檢查點**：展開/收合在 1 秒內完成並有狀態指示；可鍵盤操作。

---

## Phase 5：使用者故事 3－由系列清單開啟文章（優先度：P3）

**目標**：點擊展開清單中的文章項目可導向對應文章頁。

**獨立測試方式**：點擊文章項目導向 `/blogs/{slug}` 頁，內容可讀。

### 實作任務

- [ ] T026 [US3] 於 `src/pages/series.astro` 的展開清單中為每篇文章建立連結（`/blogs/${entry.slug}`）
- [ ] T027 [US3] 確認對應頁（`src/pages/blogs/[slug].astro` 與 `src/pages/blogs/[...slug].astro`）可正常載入內容

**檢查點**：95% 連結點擊可正確導向文章頁。

---

## Phase N：強化與跨故事事項

**目的**：跨故事的整體改善與文件同步

- [ ] T030 [P] 更新 `specs/001-page-list-wording/quickstart.md`（補充 `seriesIndex` 範例與排序規則說明）
- [ ] T031 檢查並更新 `README.md`（加入系列頁與標記規範說明）
- [ ] T032 [P] 新增基本整合驗證腳本（可於專案 wiki/腳本說明；非必要自動化）
- [ ] T033 整體可近性自查（焦點、對比、ARIA），必要時微調

---

## 相依關係與執行順序

### 階段相依

- **Phase 1**：可立即開始
- **Phase 2**：依賴 Phase 1 完成（聚合與排序先到位）
- **Phase 3+**：依賴 Phase 2 完成
- **Phase N**：於故事完成後進行

### 故事相依

- **故事 1（P1）**：基礎清單視圖，完成後可成為 MVP
- **故事 2（P2）**：基於清單，加入展開/收合互動
- **故事 3（P3）**：基於展開清單，導向文章頁

### 故事內部順序

- 先資料聚合與排序，後互動行為
- 先入口與導覽，後內部導向

### 平行機會

- T003/T004（Lint 與設定）可與頁面開發平行
- 導覽與首頁入口（T011/T012）可與清單渲染（T010）平行
- 可近性修正（T021/T033）可平行於其它不相依任務

---

## 實作策略

### MVP 優先（僅完成故事 1）

1. 完成 Phase 1：環境設定  
2. 完成 Phase 2：聚合與排序  
3. 完成 Phase 3：清單渲染與導覽、首頁入口  
4. 驗證：/series 可顯示正確系列清單

### 迭代交付

1. 加入故事 2：展開/收合（含可近性）→ 驗證  
2. 加入故事 3：導向文章頁 → 驗證  
3. 最後進行跨故事強化（文件、可近性微調）
