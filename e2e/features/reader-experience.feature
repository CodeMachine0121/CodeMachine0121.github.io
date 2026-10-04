@ui
Feature: 改版後的讀者體驗
  讀者在任何裝置與主題下都能專心閱讀長文：目錄幫助掌握結構，主題跟著裝置與讀者的選擇，
  搜尋與履歷列印照舊可用。

  Scenario: 寬螢幕在正文旁顯示固定的目錄
    Given 讀者用寬螢幕打開一篇有多個章的文章
    Then 目錄位在正文旁的側欄
    When 讀者往下捲動一段
    Then 側欄目錄仍留在畫面上

  Scenario: 捲動時標出目前位置
    Given 讀者用寬螢幕打開一篇有多個章的文章
    When 讀者捲到第 3 章
    Then 目錄中第 3 章被標示為目前位置

  Scenario: 點目錄跳到該章
    Given 讀者用寬螢幕打開一篇有多個章的文章
    When 讀者點目錄中的第 2 章
    Then 頁面跳到第 2 章的開頭

  Scenario: 手機上目錄預設收合
    Given 讀者用手機打開一篇有多個章的文章
    Then 目錄出現在正文之前且預設收合
    When 讀者點開目錄
    Then 目錄列出所有章與節

  Scenario: 裝置為深色時預設深色
    Given 讀者第一次來，且裝置設定為深色
    When 讀者打開首頁
    Then 頁面以深色顯示

  Scenario: 裝置為淺色時預設淺色
    Given 讀者第一次來，且裝置設定為淺色
    When 讀者打開首頁
    Then 頁面以淺色顯示

  Scenario: 手動切換後記住選擇
    Given 讀者第一次來，且裝置設定為深色
    And 讀者打開首頁
    When 讀者手動切換主題
    And 讀者之後再回到網站
    Then 頁面以淺色顯示

  Scenario: 瀏覽器不允許記住設定
    Given 讀者的瀏覽器不允許網站記住任何設定
    And 讀者第一次來，且裝置設定為深色
    And 讀者打開首頁
    When 讀者手動切換主題
    Then 頁面以淺色顯示
    When 讀者之後再回到網站
    Then 頁面以深色顯示

  Scenario: 搜尋命中系列名稱
    Given 讀者在文章列表
    When 讀者搜尋進行中系列名稱的一部分
    Then 該系列入口與其文章都出現在結果中

  Scenario: 搜尋沒有結果
    Given 讀者在文章列表
    When 讀者搜尋「xyz」
    Then 顯示「沒有找到符合的文章」

  Scenario: 存成 PDF 時不含頁首與按鈕
    Given 讀者以深色主題瀏覽中文版履歷
    When 讀者把履歷存成 PDF
    Then 列印版面為淺色
    And 列印版面不含返回首頁、存成 PDF、語系與主題切換

  Scenario: 停用程式執行時仍可閱讀
    Given 讀者的瀏覽器停用程式執行，且裝置設定為深色
    When 讀者用手機打開一篇有多個章的文章
    Then 正文可以閱讀
    And 讀者仍可點開目錄看到章節
    And 頁面以深色顯示

  Scenario Outline: 手機寬度不會出現橫向捲動
    Given 讀者用 360 像素寬的手機
    When 讀者打開 "<頁面>"
    Then 頁面沒有橫向捲動

    Examples:
      | 頁面                   |
      | /                      |
      | /blogs                 |
      | /series                |
      | /series/nixos-bootcamp |
      | /cv/zh                 |
      | /ai-redefines-software |
      | /404                   |

  Scenario: 只用鍵盤也能切換主題與展開目錄
    Given 讀者第一次來，且裝置設定為淺色
    And 讀者用手機打開一篇有多個章的文章
    When 讀者用鍵盤操作主題切換鈕
    Then 頁面以深色顯示
    When 讀者用鍵盤展開目錄
    Then 目錄列出所有章與節
