# Phase 1：資料模型（系列文章頁面）

## 實體與欄位

- 實體：Series（衍生自文章 Frontmatter 的 `parent`）
  - name：string（系列主題；由 `parent` 去重得出）
  - count：number（該系列包含的文章數）

- 實體：Article（已存在於 blogs collection）
  - title：string（必要）
  - datetime：string（必要，可解析日期）
  - description：string（可選）
  - image：string（可選）
  - parent：string（可選；若存在表示屬於某系列）
  - seriesIndex：number（可選；系列內顯示順序，升冪）

## 關聯

- Series 1 — N Article：`Series.name` = `Article.parent`

## 驗證規則

- 若 `Article.parent` 存在：
  - 必須為非空字串。
- `seriesIndex`（若存在）：
  - 為非負整數，僅用於排序，不影響文章本體。

## 衍生集合與排序

- 系列清單：由 `blogs` 文章聚合 `parent` 非空得出，依 `Series.name` 字母序排序。
- 系列內文章排序：
  - 先依 `seriesIndex` 升冪（缺省視為無限大置於最後），
  - 其次依 `datetime` 新到舊。
