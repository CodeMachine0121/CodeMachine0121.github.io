@ui
Feature: CV Page Redesign with Profile Picture & cv.json

  Scenario: Header 顯示大頭照與基本資訊
    Given I am on the "/cv" page
    Then the "profile picture" should be visible
    And I should see "James Hsueh"
    And I should see "Full Stack Software Engineer"
    And I should see "GitHub"
    And I should see "james.afternoon.dev@gmail.com"

  Scenario: Summary 顯示豐富的 professional summary
    Given I am on the "/cv" page
    Then I should see "Summary"
    And the summary text should contain at least 3 sentences

  Scenario: Experience achievements 以行動動詞開頭
    Given I am on the "/cv" page
    Then I should see "Experience"
    And I should see "Cafler"
    And I should see "Doutify Tech"
    And I should see "TitanSoft"
    And I should see "Implemented"
    And I should see "Built"

  Scenario: Education 與 Projects 區段正常顯示
    Given I am on the "/cv" page
    Then I should see "Education"
    And I should see "National Yunlin University of Science and Technology"
    And I should see "Projects"
    And I should see "DevOpsDays Taipei 2026"

  Scenario: Download PDF 功能正常
    Given I am on the "/cv" page
    When I click the "Export PDF" button
    Then a file download should be triggered

  Scenario: Back to Home 功能正常
    Given I am on the "/cv" page
    When I click the "Back to Home" link
    Then I should be navigated to "/"
