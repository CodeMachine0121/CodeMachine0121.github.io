@ui
Feature: CV Page (International SWE Style)

  Scenario: 頁面顯示完整 Resume 內容
    Given I am on the "/cv" page
    Then I should see "James Hsueh"
    And I should see "Full Stack Software Engineer"
    And I should see "GitHub"
    And I should see "Experience"
    And I should see "Cafler"
    And I should see "Doutify Tech"
    And I should see "TitanSoft"
    And I should see "Education"
    And I should see "National Yunlin University of Science and Technology"
    And I should see "Projects"
    And I should see "GSI Protocol"
    And the "Export PDF" button should be visible

  Scenario: 每筆工作經歷顯示 achievements
    Given I am on the "/cv" page
    Then I should see "Built cross-regional .NET Core services"
    And I should see "Migrated the credit loan system"
    And I should see "CKAD"

  Scenario: CV 頁面不含首頁特有區塊
    Given I am on the "/cv" page
    Then the page should not contain "Portfolio"
    And the page should not contain "Hero"

  Scenario: 下載 PDF
    Given I am on the "/cv" page
    When I click the "Export PDF" button
    Then a file named "james_cv.pdf" should be downloaded

  Scenario: 返回首頁
    Given I am on the "/cv" page
    When I click the "Back to Home" link
    Then I should be navigated to "/"
