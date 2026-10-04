@ui
Feature: 系列總覽封面卡片
  系列總覽以封面卡片呈現，依各系列最後一篇文章的日期排序。

  Scenario: 寬螢幕卡片排成兩欄
    Given 讀者用寬螢幕打開系列總覽
    Then 前兩張卡片並排在同一列

  Scenario: 手機卡片排成一欄
    Given 讀者用 360 像素寬的手機
    When 讀者打開 "/series"
    Then 每張卡片各占一列
    And 頁面沒有橫向捲動

  Scenario: 英文介面的卡片資訊
    Given 讀者第一次來，瀏覽器首選語言為 "en-US"
    When 讀者打開 "/series"
    Then 每張卡片顯示英文的篇數與最後更新日期

  Scenario: 點卡片進入系列頁
    Given 讀者用寬螢幕打開系列總覽
    When 讀者點第一張卡片
    Then 進入該系列的系列頁
