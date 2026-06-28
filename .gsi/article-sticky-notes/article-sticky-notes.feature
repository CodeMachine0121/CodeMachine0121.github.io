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

  Scenario: TC-03 note text is saved on blur and restored after reload
    Given I am on the "/blogs/clean-architecture-with-asp-dotnet-core-10" page
    When I triple-click in the left margin
    And I type "重點：六角架構" into the new sticky note
    And I blur the sticky note
    And I reload the page
    Then there should be 1 sticky notes
    And the sticky note should contain "重點：六角架構"

  Scenario: TC-04 note defaults to yellow, cycles color, and persists the choice
    Given I am on the "/blogs/clean-architecture-with-asp-dotnet-core-10" page
    When I triple-click in the left margin
    Then the sticky note color should be "yellow"
    When I click the sticky note color swatch
    Then the sticky note color should be "pink"
    When I reload the page
    Then the sticky note color should be "pink"

  Scenario: TC-05 dragging a note moves it and the position persists across reload
    Given I am on the "/blogs/clean-architecture-with-asp-dotnet-core-10" page
    When I triple-click in the left margin
    And I drag the sticky note by 150,200
    Then the sticky note should be at the dragged position
    When I reload the page
    Then there should be 1 sticky notes
    And the sticky note should be at the dragged position

  Scenario: TC-06 the X button deletes a note and removes it from storage
    Given I am on the "/blogs/clean-architecture-with-asp-dotnet-core-10" page
    When I triple-click in the left margin
    Then there should be 1 sticky notes
    When I click the sticky note delete button
    Then there should be 0 sticky notes
    When I reload the page
    Then there should be 0 sticky notes

  Scenario: TC-07 dragging a note to the top edge reveals the trash and drops to delete
    Given I am on the "/blogs/clean-architecture-with-asp-dotnet-core-10" page
    When I triple-click in the left margin
    Then there should be 1 sticky notes
    When I start dragging the sticky note to the top edge
    Then the sticky-notes trash zone should be visible
    When I drop the sticky note
    Then there should be 0 sticky notes
    When I reload the page
    Then there should be 0 sticky notes
