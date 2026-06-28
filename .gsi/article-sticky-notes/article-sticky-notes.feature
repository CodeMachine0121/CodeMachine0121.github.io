@ui
Feature: Article Sticky Notes

  Scenario: TC-00 article page renders the sticky-notes layer with no notes
    Given I am on the "/blogs/clean-architecture-with-asp-dotnet-core-10" page
    Then the sticky-notes layer should be present
    And there should be 0 sticky notes

  Scenario: TC-01 desktop triple-click on the side margin adds an editable note
    Given I am on the "/blogs/clean-architecture-with-asp-dotnet-core-10" page
    When I triple-click in the left margin
    Then there should be 1 sticky notes
    And the new sticky note should be editable

  Scenario: TC-02 triple-click on the article body text adds no note
    Given I am on the "/blogs/clean-architecture-with-asp-dotnet-core-10" page
    When I triple-click on the article body text
    Then there should be 0 sticky notes
