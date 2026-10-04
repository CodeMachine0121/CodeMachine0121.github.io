@ui
Feature: 介面語言
  整站介面文字只用一種語言：中文地區的讀者預設中文，其他預設英文；讀者可以切換並被記住。
  文章與作品等內容、各種名稱維持原文。

  Scenario Outline: 第一次來時依瀏覽器首選語言決定介面語言
    Given 讀者第一次來，瀏覽器首選語言為 "<瀏覽器語言>"
    When 讀者打開首頁
    Then 介面文字為<介面語言>

    Examples:
      | 瀏覽器語言 | 介面語言 |
      | zh-TW      | 中文     |
      | zh-CN      | 中文     |
      | en-US      | 英文     |
      | ja-JP      | 英文     |

  Scenario: 只看首選語言
    Given 讀者第一次來，瀏覽器首選語言為英文、第二順位為中文
    When 讀者打開首頁
    Then 介面文字為英文

  Scenario: 停用程式執行時為中文
    Given 讀者的瀏覽器停用程式執行，且瀏覽器首選語言為 "en-US"
    When 讀者打開首頁
    Then 介面文字為中文

  Scenario: 切換後記住選擇
    Given 讀者第一次來，瀏覽器首選語言為 "zh-TW"
    And 讀者打開首頁
    When 讀者在頁首切換語言
    And 讀者之後再回到網站
    Then 介面文字為英文

  Scenario: 瀏覽器不允許記住設定
    Given 讀者的瀏覽器不允許網站記住任何設定
    And 讀者打開首頁
    When 讀者在頁首切換語言
    Then 介面文字為英文
    When 讀者之後再回到網站
    Then 介面文字為中文

  Scenario Outline: 整站介面語言一致
    Given 讀者第一次來，瀏覽器首選語言為 "<瀏覽器語言>"
    When 讀者依序打開首頁、文章列表、系列總覽、系列頁、文章頁與找不到頁面
    Then 每一頁的介面文字都只有<介面語言>

    Examples:
      | 瀏覽器語言 | 介面語言 |
      | en-US      | 英文     |
      | zh-TW      | 中文     |

  Scenario: 英文介面的導覽、日期與閱讀時間
    Given 讀者第一次來，瀏覽器首選語言為 "en-US"
    When 讀者打開首頁
    Then 導覽顯示 "About"、"Articles"、"Series"
    And 首頁區塊標題顯示 "Latest articles"
    And 文章日期與閱讀時間以英文格式顯示

  Scenario: 中文介面的作品類型與經歷期間
    Given 讀者第一次來，瀏覽器首選語言為 "zh-TW"
    When 讀者打開首頁
    Then 作品類型顯示 "個人專案"
    And 經歷期間顯示 "2026 - 至今"
    And 自我介紹為中文

  Scenario Outline: 從首頁前往目前語言的履歷
    Given 讀者第一次來，瀏覽器首選語言為 "<瀏覽器語言>"
    And 讀者打開首頁
    When 讀者點首頁的 "<連結>"
    Then 進入 "<履歷網址>"

    Examples:
      | 瀏覽器語言 | 連結       | 履歷網址 |
      | zh-TW      | 看完整履歷 | /cv/zh   |
      | en-US      | View CV    | /cv/en   |

  Scenario: 不帶語言的履歷網址依預設語言導向
    Given 讀者第一次來，瀏覽器首選語言為 "en-US"
    When 讀者打開 "/cv"
    Then 進入 "/cv/en"

  Scenario: 中文版履歷的返回連結為中文
    Given 讀者第一次來，瀏覽器首選語言為 "zh-TW"
    When 讀者打開 "/cv/zh"
    Then 返回首頁的連結文字為 "首頁"

  Scenario: 在履歷切換語言也會記住
    Given 讀者第一次來，瀏覽器首選語言為 "zh-TW"
    And 讀者打開 "/cv/zh"
    When 讀者在履歷切換語言
    Then 進入 "/cv/en"
    When 讀者打開首頁
    Then 介面文字為英文
