@ui
Feature: Home Page CV Link

  Scenario: 首頁 Download CV 按鈕可見
    Given I am on the "/" page
    Then the "Download CV" link should be visible

  Scenario: 點擊 Download CV 導向 CV 頁面
    Given I am on the "/" page
    When I click the "Download CV" link
    Then I should be navigated to "/cv"
    And I should see "James Hsueh"
