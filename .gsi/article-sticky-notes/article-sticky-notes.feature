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

  Scenario: TC-10 deleting a note from the panel list removes it
    Given the viewport is narrow
    And the article is preloaded with 1 sticky notes
    When I click the sticky-notes button
    Then the notes panel should list 1 notes
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

  Scenario: TC-16 on a narrow screen floating notes are not shown on the page
    Given the viewport is narrow
    And the article is preloaded with 1 sticky notes
    Then there should be 1 sticky notes
    And the floating sticky note should be hidden

  Scenario: TC-17 selecting a panel note opens its detail view with the content
    Given the viewport is narrow
    And the article is preloaded with 1 sticky notes
    When I click the sticky-notes button
    And I open the first panel note
    Then the sticky-notes detail view should be visible
    And the detail view should show note text "note 0"

  Scenario: TC-18 editing a note in the detail view persists across reload
    Given the viewport is narrow
    And the article is preloaded with 1 sticky notes
    When I click the sticky-notes button
    And I open the first panel note
    And I edit the detail text to "手機改的內容"
    And I reload the page
    And I click the sticky-notes button
    And I open the first panel note
    Then the detail view should show note text "手機改的內容"

  Scenario: TC-19 saving from the detail view upserts the content and returns to the list
    Given the viewport is narrow
    And the article is preloaded with 1 sticky notes
    When I click the sticky-notes button
    And I open the first panel note
    And I edit the detail text to "已更新內容"
    And I save the detail view
    Then the sticky-notes detail view should be hidden
    And the notes panel should list 1 notes
    When I reload the page
    And I click the sticky-notes button
    And I open the first panel note
    Then the detail view should show note text "已更新內容"

  Scenario: TC-20 on a desktop screen the hamburger button is not shown
    Given I am on the "/blogs/clean-architecture-with-asp-dotnet-core-10" page
    Then the sticky-notes button should be hidden

  Scenario: TC-21 typed note text survives a reload even without blurring
    Given I am on the "/blogs/clean-architecture-with-asp-dotnet-core-10" page
    When I triple-click in the left margin
    And I type "不失焦也要存" into the focused note without blurring
    And I reload the page
    Then there should be 1 sticky notes
    And the sticky note should contain "不失焦也要存"

  Scenario: TC-22 adding from the panel jumps to the detail page; back returns to the list
    Given the viewport is narrow
    And I am on the "/blogs/clean-architecture-with-asp-dotnet-core-10" page
    When I click the sticky-notes button
    And I click the panel add button
    Then the sticky-notes detail view should be visible
    When I edit the detail text to "新便利貼內容"
    And I go back from the detail view
    Then the sticky-notes detail view should be hidden
    And the notes panel should list 1 notes
