@ui
Feature: Article Sticky Notes

  Scenario: TC-00 article page renders the sticky-notes layer with no notes
    Given I am on the "/blogs/clean-architecture-with-asp-dotnet-core-10" page
    Then the sticky-notes layer should be present
    And there should be 0 sticky notes
