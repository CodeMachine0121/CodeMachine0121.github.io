@ui
Feature: Home Page CV Link

  Scenario: 首頁 View My CV 按鈕可見
    Given I am on the "/" page
    Then the "View My CV" link should be visible

  Scenario: 點擊 View My CV 導向 CV 頁面
    Given I am on the "/" page
    When I click the "View My CV" link
    Then I should be navigated to "/cv/en"
    And I should see "James Hsueh"
