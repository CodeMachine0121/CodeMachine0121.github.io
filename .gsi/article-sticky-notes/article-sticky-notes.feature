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

  Scenario: TC-08 narrow screen shows a floating button that opens the notes panel
    Given the viewport is narrow
    And I am on the "/blogs/clean-architecture-with-asp-dotnet-core-10" page
    Then the sticky-notes button should be visible
    When I click the sticky-notes button
    Then the sticky-notes panel should be visible

  Scenario: TC-09 adding a note from the panel creates and lists it
    Given the viewport is narrow
    And I am on the "/blogs/clean-architecture-with-asp-dotnet-core-10" page
    When I click the sticky-notes button
    And I click the panel add button
    Then there should be 1 sticky notes
    And the notes panel should list 1 notes

  Scenario: TC-10 deleting a note from the panel removes it
    Given the viewport is narrow
    And I am on the "/blogs/clean-architecture-with-asp-dotnet-core-10" page
    When I click the sticky-notes button
    And I click the panel add button
    Then there should be 1 sticky notes
    When I click the panel item delete button
    Then there should be 0 sticky notes
    And the notes panel should list 0 notes

  Scenario: TC-11 notes are scoped per article and do not leak across pages
    Given I am on the "/blogs/clean-architecture-with-asp-dotnet-core-10" page
    When I triple-click in the left margin
    Then there should be 1 sticky notes
    When I navigate to the "/blogs/csharp-unit-test-如何驗證多次呼叫" page
    Then there should be 0 sticky notes
    When I navigate to the "/blogs/clean-architecture-with-asp-dotnet-core-10" page
    Then there should be 1 sticky notes

  Scenario: TC-12 adding beyond the soft cap of 20 is blocked with a notice
    Given the article is preloaded with 20 sticky notes
    Then there should be 20 sticky notes
    When I triple-click in the left margin
    Then there should be 20 sticky notes
    And the sticky-notes limit notice should be visible

  Scenario: TC-13 a note saved off-screen is clamped back into the viewport on restore
    Given the article is preloaded with an off-screen note
    Then there should be 1 sticky notes
    And the sticky note should be within the viewport

  Scenario: TC-14 resizing a note changes its size and persists across reload
    Given I am on the "/blogs/clean-architecture-with-asp-dotnet-core-10" page
    When I triple-click in the left margin
    And I resize the sticky note by 90,70
    Then the sticky note should be at the resized size
    When I reload the page
    Then there should be 1 sticky notes
    And the sticky note should be at the resized size

  Scenario: TC-15 resizing below the minimum is floored
    Given I am on the "/blogs/clean-architecture-with-asp-dotnet-core-10" page
    When I triple-click in the left margin
    And I resize the sticky note by -500,-500
    Then the sticky note should not be smaller than the minimum size
