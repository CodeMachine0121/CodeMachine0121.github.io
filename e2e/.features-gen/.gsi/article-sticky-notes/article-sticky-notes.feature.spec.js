// Generated from: ../.gsi/article-sticky-notes/article-sticky-notes.feature
import { test } from "playwright-bdd";

test.describe('Article Sticky Notes', () => {

  test('TC-00 article page renders the sticky-notes layer with no notes', { tag: ['@ui'] }, async ({ Given, Then, And, page }) => { 
    await Given('I am on the "/blogs/clean-architecture-with-asp-dotnet-core-10" page', null, { page }); 
    await Then('the sticky-notes layer should be present', null, { page }); 
    await And('there should be 0 sticky notes', null, { page }); 
  });

  test('TC-01 desktop triple-click on the side margin adds an editable note', { tag: ['@ui'] }, async ({ Given, When, Then, And, page }) => { 
    await Given('I am on the "/blogs/clean-architecture-with-asp-dotnet-core-10" page', null, { page }); 
    await When('I triple-click in the left margin', null, { page }); 
    await Then('there should be 1 sticky notes', null, { page }); 
    await And('the new sticky note should be editable', null, { page }); 
  });

  test('TC-02 triple-click on the article body text adds no note', { tag: ['@ui'] }, async ({ Given, When, Then, page }) => { 
    await Given('I am on the "/blogs/clean-architecture-with-asp-dotnet-core-10" page', null, { page }); 
    await When('I triple-click on the article body text', null, { page }); 
    await Then('there should be 0 sticky notes', null, { page }); 
  });

  test('TC-03 note text is saved on blur and restored after reload', { tag: ['@ui'] }, async ({ Given, When, Then, And, page }) => { 
    await Given('I am on the "/blogs/clean-architecture-with-asp-dotnet-core-10" page', null, { page }); 
    await When('I triple-click in the left margin', null, { page }); 
    await And('I type "重點：六角架構" into the new sticky note', null, { page }); 
    await And('I blur the sticky note', null, { page }); 
    await And('I reload the page', null, { page }); 
    await Then('there should be 1 sticky notes', null, { page }); 
    await And('the sticky note should contain "重點：六角架構"', null, { page }); 
  });

  test('TC-04 note defaults to yellow, cycles color, and persists the choice', { tag: ['@ui'] }, async ({ Given, When, Then, page }) => { 
    await Given('I am on the "/blogs/clean-architecture-with-asp-dotnet-core-10" page', null, { page }); 
    await When('I triple-click in the left margin', null, { page }); 
    await Then('the sticky note color should be "yellow"', null, { page }); 
    await When('I click the sticky note color swatch', null, { page }); 
    await Then('the sticky note color should be "pink"', null, { page }); 
    await When('I reload the page', null, { page }); 
    await Then('the sticky note color should be "pink"', null, { page }); 
  });

  test('TC-05 dragging a note moves it and the position persists across reload', { tag: ['@ui'] }, async ({ Given, When, Then, And, page }) => { 
    await Given('I am on the "/blogs/clean-architecture-with-asp-dotnet-core-10" page', null, { page }); 
    await When('I triple-click in the left margin', null, { page }); 
    await And('I drag the sticky note by 150,200', null, { page }); 
    await Then('the sticky note should be at the dragged position', null, { page }); 
    await When('I reload the page', null, { page }); 
    await Then('there should be 1 sticky notes', null, { page }); 
    await And('the sticky note should be at the dragged position', null, { page }); 
  });

  test('TC-06 the X button deletes a note and removes it from storage', { tag: ['@ui'] }, async ({ Given, When, Then, page }) => { 
    await Given('I am on the "/blogs/clean-architecture-with-asp-dotnet-core-10" page', null, { page }); 
    await When('I triple-click in the left margin', null, { page }); 
    await Then('there should be 1 sticky notes', null, { page }); 
    await When('I click the sticky note delete button', null, { page }); 
    await Then('there should be 0 sticky notes', null, { page }); 
    await When('I reload the page', null, { page }); 
    await Then('there should be 0 sticky notes', null, { page }); 
  });

  test('TC-07 dragging a note to the top edge reveals the trash and drops to delete', { tag: ['@ui'] }, async ({ Given, When, Then, page }) => { 
    await Given('I am on the "/blogs/clean-architecture-with-asp-dotnet-core-10" page', null, { page }); 
    await When('I triple-click in the left margin', null, { page }); 
    await Then('there should be 1 sticky notes', null, { page }); 
    await When('I start dragging the sticky note to the top edge', null, { page }); 
    await Then('the sticky-notes trash zone should be visible', null, { page }); 
    await When('I drop the sticky note', null, { page }); 
    await Then('there should be 0 sticky notes', null, { page }); 
    await When('I reload the page', null, { page }); 
    await Then('there should be 0 sticky notes', null, { page }); 
  });

  test('TC-08 narrow screen shows a floating button that opens the notes panel', { tag: ['@ui'] }, async ({ Given, When, Then, And, page }) => { 
    await Given('the viewport is narrow', null, { page }); 
    await And('I am on the "/blogs/clean-architecture-with-asp-dotnet-core-10" page', null, { page }); 
    await Then('the sticky-notes button should be visible', null, { page }); 
    await When('I click the sticky-notes button', null, { page }); 
    await Then('the sticky-notes panel should be visible', null, { page }); 
  });

  test('TC-09 adding a note from the panel creates and lists it', { tag: ['@ui'] }, async ({ Given, When, Then, And, page }) => { 
    await Given('the viewport is narrow', null, { page }); 
    await And('I am on the "/blogs/clean-architecture-with-asp-dotnet-core-10" page', null, { page }); 
    await When('I click the sticky-notes button', null, { page }); 
    await And('I click the panel add button', null, { page }); 
    await Then('there should be 1 sticky notes', null, { page }); 
    await And('the notes panel should list 1 notes', null, { page }); 
  });

  test('TC-10 deleting a note from the panel list removes it', { tag: ['@ui'] }, async ({ Given, When, Then, And, page }) => { 
    await Given('the viewport is narrow', null, { page }); 
    await And('the article is preloaded with 1 sticky notes', null, { page }); 
    await When('I click the sticky-notes button', null, { page }); 
    await Then('the notes panel should list 1 notes', null, { page }); 
    await When('I click the panel item delete button', null, { page }); 
    await Then('there should be 0 sticky notes', null, { page }); 
    await And('the notes panel should list 0 notes', null, { page }); 
  });

  test('TC-11 notes are scoped per article and do not leak across pages', { tag: ['@ui'] }, async ({ Given, When, Then, page }) => { 
    await Given('I am on the "/blogs/clean-architecture-with-asp-dotnet-core-10" page', null, { page }); 
    await When('I triple-click in the left margin', null, { page }); 
    await Then('there should be 1 sticky notes', null, { page }); 
    await When('I navigate to the "/blogs/csharp-unit-test-如何驗證多次呼叫" page', null, { page }); 
    await Then('there should be 0 sticky notes', null, { page }); 
    await When('I navigate to the "/blogs/clean-architecture-with-asp-dotnet-core-10" page', null, { page }); 
    await Then('there should be 1 sticky notes', null, { page }); 
  });

  test('TC-12 adding beyond the soft cap of 20 is blocked with a notice', { tag: ['@ui'] }, async ({ Given, When, Then, And, page }) => { 
    await Given('the article is preloaded with 20 sticky notes', null, { page }); 
    await Then('there should be 20 sticky notes', null, { page }); 
    await When('I triple-click in the left margin', null, { page }); 
    await Then('there should be 20 sticky notes', null, { page }); 
    await And('the sticky-notes limit notice should be visible', null, { page }); 
  });

  test('TC-13 a note saved off-screen is clamped back into the viewport on restore', { tag: ['@ui'] }, async ({ Given, Then, And, page }) => { 
    await Given('the article is preloaded with an off-screen note', null, { page }); 
    await Then('there should be 1 sticky notes', null, { page }); 
    await And('the sticky note should be within the viewport', null, { page }); 
  });

  test('TC-14 resizing a note changes its size and persists across reload', { tag: ['@ui'] }, async ({ Given, When, Then, And, page }) => { 
    await Given('I am on the "/blogs/clean-architecture-with-asp-dotnet-core-10" page', null, { page }); 
    await When('I triple-click in the left margin', null, { page }); 
    await And('I resize the sticky note by 90,70', null, { page }); 
    await Then('the sticky note should be at the resized size', null, { page }); 
    await When('I reload the page', null, { page }); 
    await Then('there should be 1 sticky notes', null, { page }); 
    await And('the sticky note should be at the resized size', null, { page }); 
  });

  test('TC-15 resizing below the minimum is floored', { tag: ['@ui'] }, async ({ Given, When, Then, And, page }) => { 
    await Given('I am on the "/blogs/clean-architecture-with-asp-dotnet-core-10" page', null, { page }); 
    await When('I triple-click in the left margin', null, { page }); 
    await And('I resize the sticky note by -500,-500', null, { page }); 
    await Then('the sticky note should not be smaller than the minimum size', null, { page }); 
  });

  test('TC-16 on a narrow screen floating notes are not shown on the page', { tag: ['@ui'] }, async ({ Given, Then, And, page }) => { 
    await Given('the viewport is narrow', null, { page }); 
    await And('the article is preloaded with 1 sticky notes', null, { page }); 
    await Then('there should be 1 sticky notes', null, { page }); 
    await And('the floating sticky note should be hidden', null, { page }); 
  });

  test('TC-17 selecting a panel note opens its detail view with the content', { tag: ['@ui'] }, async ({ Given, When, Then, And, page }) => { 
    await Given('the viewport is narrow', null, { page }); 
    await And('the article is preloaded with 1 sticky notes', null, { page }); 
    await When('I click the sticky-notes button', null, { page }); 
    await And('I open the first panel note', null, { page }); 
    await Then('the sticky-notes detail view should be visible', null, { page }); 
    await And('the detail view should show note text "note 0"', null, { page }); 
  });

  test('TC-18 editing a note in the detail view persists across reload', { tag: ['@ui'] }, async ({ Given, When, Then, And, page }) => { 
    await Given('the viewport is narrow', null, { page }); 
    await And('the article is preloaded with 1 sticky notes', null, { page }); 
    await When('I click the sticky-notes button', null, { page }); 
    await And('I open the first panel note', null, { page }); 
    await And('I edit the detail text to "手機改的內容"', null, { page }); 
    await And('I reload the page', null, { page }); 
    await And('I click the sticky-notes button', null, { page }); 
    await And('I open the first panel note', null, { page }); 
    await Then('the detail view should show note text "手機改的內容"', null, { page }); 
  });

  test('TC-19 deleting a note from the detail view removes it', { tag: ['@ui'] }, async ({ Given, When, Then, And, page }) => { 
    await Given('the viewport is narrow', null, { page }); 
    await And('the article is preloaded with 1 sticky notes', null, { page }); 
    await When('I click the sticky-notes button', null, { page }); 
    await And('I open the first panel note', null, { page }); 
    await And('I click the detail delete button', null, { page }); 
    await Then('there should be 0 sticky notes', null, { page }); 
    await And('the notes panel should list 0 notes', null, { page }); 
  });

  test('TC-20 on a desktop screen the hamburger button is not shown', { tag: ['@ui'] }, async ({ Given, Then, page }) => { 
    await Given('I am on the "/blogs/clean-architecture-with-asp-dotnet-core-10" page', null, { page }); 
    await Then('the sticky-notes button should be hidden', null, { page }); 
  });

  test('TC-21 typed note text survives a reload even without blurring', { tag: ['@ui'] }, async ({ Given, When, Then, And, page }) => { 
    await Given('I am on the "/blogs/clean-architecture-with-asp-dotnet-core-10" page', null, { page }); 
    await When('I triple-click in the left margin', null, { page }); 
    await And('I type "不失焦也要存" into the focused note without blurring', null, { page }); 
    await And('I reload the page', null, { page }); 
    await Then('there should be 1 sticky notes', null, { page }); 
    await And('the sticky note should contain "不失焦也要存"', null, { page }); 
  });

  test('TC-22 adding from the panel jumps to the detail page; back returns to the list', { tag: ['@ui'] }, async ({ Given, When, Then, And, page }) => { 
    await Given('the viewport is narrow', null, { page }); 
    await And('I am on the "/blogs/clean-architecture-with-asp-dotnet-core-10" page', null, { page }); 
    await When('I click the sticky-notes button', null, { page }); 
    await And('I click the panel add button', null, { page }); 
    await Then('the sticky-notes detail view should be visible', null, { page }); 
    await When('I edit the detail text to "新便利貼內容"', null, { page }); 
    await And('I go back from the detail view', null, { page }); 
    await Then('the sticky-notes detail view should be hidden', null, { page }); 
    await And('the notes panel should list 1 notes', null, { page }); 
  });

});

// == technical section ==

test.use({
  $test: [({}, use) => use(test), { scope: 'test', box: true }],
  $uri: [({}, use) => use('../.gsi/article-sticky-notes/article-sticky-notes.feature'), { scope: 'test', box: true }],
  $bddFileData: [({}, use) => use(bddFileData), { scope: "test", box: true }],
});

const bddFileData = [ // bdd-data-start
  {"pwTestLine":6,"pickleLine":4,"tags":["@ui"],"steps":[{"pwStepLine":7,"gherkinStepLine":5,"keywordType":"Context","textWithKeyword":"Given I am on the \"/blogs/clean-architecture-with-asp-dotnet-core-10\" page","stepMatchArguments":[{"group":{"start":12,"value":"\"/blogs/clean-architecture-with-asp-dotnet-core-10\"","children":[{"start":13,"value":"/blogs/clean-architecture-with-asp-dotnet-core-10","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":8,"gherkinStepLine":6,"keywordType":"Outcome","textWithKeyword":"Then the sticky-notes layer should be present","stepMatchArguments":[]},{"pwStepLine":9,"gherkinStepLine":7,"keywordType":"Outcome","textWithKeyword":"And there should be 0 sticky notes","stepMatchArguments":[{"group":{"start":16,"value":"0"},"parameterTypeName":"int"}]}]},
  {"pwTestLine":12,"pickleLine":9,"tags":["@ui"],"steps":[{"pwStepLine":13,"gherkinStepLine":10,"keywordType":"Context","textWithKeyword":"Given I am on the \"/blogs/clean-architecture-with-asp-dotnet-core-10\" page","stepMatchArguments":[{"group":{"start":12,"value":"\"/blogs/clean-architecture-with-asp-dotnet-core-10\"","children":[{"start":13,"value":"/blogs/clean-architecture-with-asp-dotnet-core-10","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":14,"gherkinStepLine":11,"keywordType":"Action","textWithKeyword":"When I triple-click in the left margin","stepMatchArguments":[]},{"pwStepLine":15,"gherkinStepLine":12,"keywordType":"Outcome","textWithKeyword":"Then there should be 1 sticky notes","stepMatchArguments":[{"group":{"start":16,"value":"1"},"parameterTypeName":"int"}]},{"pwStepLine":16,"gherkinStepLine":13,"keywordType":"Outcome","textWithKeyword":"And the new sticky note should be editable","stepMatchArguments":[]}]},
  {"pwTestLine":19,"pickleLine":15,"tags":["@ui"],"steps":[{"pwStepLine":20,"gherkinStepLine":16,"keywordType":"Context","textWithKeyword":"Given I am on the \"/blogs/clean-architecture-with-asp-dotnet-core-10\" page","stepMatchArguments":[{"group":{"start":12,"value":"\"/blogs/clean-architecture-with-asp-dotnet-core-10\"","children":[{"start":13,"value":"/blogs/clean-architecture-with-asp-dotnet-core-10","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":21,"gherkinStepLine":17,"keywordType":"Action","textWithKeyword":"When I triple-click on the article body text","stepMatchArguments":[]},{"pwStepLine":22,"gherkinStepLine":18,"keywordType":"Outcome","textWithKeyword":"Then there should be 0 sticky notes","stepMatchArguments":[{"group":{"start":16,"value":"0"},"parameterTypeName":"int"}]}]},
  {"pwTestLine":25,"pickleLine":20,"tags":["@ui"],"steps":[{"pwStepLine":26,"gherkinStepLine":21,"keywordType":"Context","textWithKeyword":"Given I am on the \"/blogs/clean-architecture-with-asp-dotnet-core-10\" page","stepMatchArguments":[{"group":{"start":12,"value":"\"/blogs/clean-architecture-with-asp-dotnet-core-10\"","children":[{"start":13,"value":"/blogs/clean-architecture-with-asp-dotnet-core-10","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":27,"gherkinStepLine":22,"keywordType":"Action","textWithKeyword":"When I triple-click in the left margin","stepMatchArguments":[]},{"pwStepLine":28,"gherkinStepLine":23,"keywordType":"Action","textWithKeyword":"And I type \"重點：六角架構\" into the new sticky note","stepMatchArguments":[{"group":{"start":7,"value":"\"重點：六角架構\"","children":[{"start":8,"value":"重點：六角架構","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":29,"gherkinStepLine":24,"keywordType":"Action","textWithKeyword":"And I blur the sticky note","stepMatchArguments":[]},{"pwStepLine":30,"gherkinStepLine":25,"keywordType":"Action","textWithKeyword":"And I reload the page","stepMatchArguments":[]},{"pwStepLine":31,"gherkinStepLine":26,"keywordType":"Outcome","textWithKeyword":"Then there should be 1 sticky notes","stepMatchArguments":[{"group":{"start":16,"value":"1"},"parameterTypeName":"int"}]},{"pwStepLine":32,"gherkinStepLine":27,"keywordType":"Outcome","textWithKeyword":"And the sticky note should contain \"重點：六角架構\"","stepMatchArguments":[{"group":{"start":31,"value":"\"重點：六角架構\"","children":[{"start":32,"value":"重點：六角架構","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]}]},
  {"pwTestLine":35,"pickleLine":29,"tags":["@ui"],"steps":[{"pwStepLine":36,"gherkinStepLine":30,"keywordType":"Context","textWithKeyword":"Given I am on the \"/blogs/clean-architecture-with-asp-dotnet-core-10\" page","stepMatchArguments":[{"group":{"start":12,"value":"\"/blogs/clean-architecture-with-asp-dotnet-core-10\"","children":[{"start":13,"value":"/blogs/clean-architecture-with-asp-dotnet-core-10","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":37,"gherkinStepLine":31,"keywordType":"Action","textWithKeyword":"When I triple-click in the left margin","stepMatchArguments":[]},{"pwStepLine":38,"gherkinStepLine":32,"keywordType":"Outcome","textWithKeyword":"Then the sticky note color should be \"yellow\"","stepMatchArguments":[{"group":{"start":32,"value":"\"yellow\"","children":[{"start":33,"value":"yellow","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":39,"gherkinStepLine":33,"keywordType":"Action","textWithKeyword":"When I click the sticky note color swatch","stepMatchArguments":[]},{"pwStepLine":40,"gherkinStepLine":34,"keywordType":"Outcome","textWithKeyword":"Then the sticky note color should be \"pink\"","stepMatchArguments":[{"group":{"start":32,"value":"\"pink\"","children":[{"start":33,"value":"pink","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":41,"gherkinStepLine":35,"keywordType":"Action","textWithKeyword":"When I reload the page","stepMatchArguments":[]},{"pwStepLine":42,"gherkinStepLine":36,"keywordType":"Outcome","textWithKeyword":"Then the sticky note color should be \"pink\"","stepMatchArguments":[{"group":{"start":32,"value":"\"pink\"","children":[{"start":33,"value":"pink","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]}]},
  {"pwTestLine":45,"pickleLine":38,"tags":["@ui"],"steps":[{"pwStepLine":46,"gherkinStepLine":39,"keywordType":"Context","textWithKeyword":"Given I am on the \"/blogs/clean-architecture-with-asp-dotnet-core-10\" page","stepMatchArguments":[{"group":{"start":12,"value":"\"/blogs/clean-architecture-with-asp-dotnet-core-10\"","children":[{"start":13,"value":"/blogs/clean-architecture-with-asp-dotnet-core-10","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":47,"gherkinStepLine":40,"keywordType":"Action","textWithKeyword":"When I triple-click in the left margin","stepMatchArguments":[]},{"pwStepLine":48,"gherkinStepLine":41,"keywordType":"Action","textWithKeyword":"And I drag the sticky note by 150,200","stepMatchArguments":[{"group":{"start":26,"value":"150"},"parameterTypeName":"int"},{"group":{"start":30,"value":"200"},"parameterTypeName":"int"}]},{"pwStepLine":49,"gherkinStepLine":42,"keywordType":"Outcome","textWithKeyword":"Then the sticky note should be at the dragged position","stepMatchArguments":[]},{"pwStepLine":50,"gherkinStepLine":43,"keywordType":"Action","textWithKeyword":"When I reload the page","stepMatchArguments":[]},{"pwStepLine":51,"gherkinStepLine":44,"keywordType":"Outcome","textWithKeyword":"Then there should be 1 sticky notes","stepMatchArguments":[{"group":{"start":16,"value":"1"},"parameterTypeName":"int"}]},{"pwStepLine":52,"gherkinStepLine":45,"keywordType":"Outcome","textWithKeyword":"And the sticky note should be at the dragged position","stepMatchArguments":[]}]},
  {"pwTestLine":55,"pickleLine":47,"tags":["@ui"],"steps":[{"pwStepLine":56,"gherkinStepLine":48,"keywordType":"Context","textWithKeyword":"Given I am on the \"/blogs/clean-architecture-with-asp-dotnet-core-10\" page","stepMatchArguments":[{"group":{"start":12,"value":"\"/blogs/clean-architecture-with-asp-dotnet-core-10\"","children":[{"start":13,"value":"/blogs/clean-architecture-with-asp-dotnet-core-10","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":57,"gherkinStepLine":49,"keywordType":"Action","textWithKeyword":"When I triple-click in the left margin","stepMatchArguments":[]},{"pwStepLine":58,"gherkinStepLine":50,"keywordType":"Outcome","textWithKeyword":"Then there should be 1 sticky notes","stepMatchArguments":[{"group":{"start":16,"value":"1"},"parameterTypeName":"int"}]},{"pwStepLine":59,"gherkinStepLine":51,"keywordType":"Action","textWithKeyword":"When I click the sticky note delete button","stepMatchArguments":[]},{"pwStepLine":60,"gherkinStepLine":52,"keywordType":"Outcome","textWithKeyword":"Then there should be 0 sticky notes","stepMatchArguments":[{"group":{"start":16,"value":"0"},"parameterTypeName":"int"}]},{"pwStepLine":61,"gherkinStepLine":53,"keywordType":"Action","textWithKeyword":"When I reload the page","stepMatchArguments":[]},{"pwStepLine":62,"gherkinStepLine":54,"keywordType":"Outcome","textWithKeyword":"Then there should be 0 sticky notes","stepMatchArguments":[{"group":{"start":16,"value":"0"},"parameterTypeName":"int"}]}]},
  {"pwTestLine":65,"pickleLine":56,"tags":["@ui"],"steps":[{"pwStepLine":66,"gherkinStepLine":57,"keywordType":"Context","textWithKeyword":"Given I am on the \"/blogs/clean-architecture-with-asp-dotnet-core-10\" page","stepMatchArguments":[{"group":{"start":12,"value":"\"/blogs/clean-architecture-with-asp-dotnet-core-10\"","children":[{"start":13,"value":"/blogs/clean-architecture-with-asp-dotnet-core-10","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":67,"gherkinStepLine":58,"keywordType":"Action","textWithKeyword":"When I triple-click in the left margin","stepMatchArguments":[]},{"pwStepLine":68,"gherkinStepLine":59,"keywordType":"Outcome","textWithKeyword":"Then there should be 1 sticky notes","stepMatchArguments":[{"group":{"start":16,"value":"1"},"parameterTypeName":"int"}]},{"pwStepLine":69,"gherkinStepLine":60,"keywordType":"Action","textWithKeyword":"When I start dragging the sticky note to the top edge","stepMatchArguments":[]},{"pwStepLine":70,"gherkinStepLine":61,"keywordType":"Outcome","textWithKeyword":"Then the sticky-notes trash zone should be visible","stepMatchArguments":[]},{"pwStepLine":71,"gherkinStepLine":62,"keywordType":"Action","textWithKeyword":"When I drop the sticky note","stepMatchArguments":[]},{"pwStepLine":72,"gherkinStepLine":63,"keywordType":"Outcome","textWithKeyword":"Then there should be 0 sticky notes","stepMatchArguments":[{"group":{"start":16,"value":"0"},"parameterTypeName":"int"}]},{"pwStepLine":73,"gherkinStepLine":64,"keywordType":"Action","textWithKeyword":"When I reload the page","stepMatchArguments":[]},{"pwStepLine":74,"gherkinStepLine":65,"keywordType":"Outcome","textWithKeyword":"Then there should be 0 sticky notes","stepMatchArguments":[{"group":{"start":16,"value":"0"},"parameterTypeName":"int"}]}]},
  {"pwTestLine":77,"pickleLine":67,"tags":["@ui"],"steps":[{"pwStepLine":78,"gherkinStepLine":68,"keywordType":"Context","textWithKeyword":"Given the viewport is narrow","stepMatchArguments":[]},{"pwStepLine":79,"gherkinStepLine":69,"keywordType":"Context","textWithKeyword":"And I am on the \"/blogs/clean-architecture-with-asp-dotnet-core-10\" page","stepMatchArguments":[{"group":{"start":12,"value":"\"/blogs/clean-architecture-with-asp-dotnet-core-10\"","children":[{"start":13,"value":"/blogs/clean-architecture-with-asp-dotnet-core-10","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":80,"gherkinStepLine":70,"keywordType":"Outcome","textWithKeyword":"Then the sticky-notes button should be visible","stepMatchArguments":[]},{"pwStepLine":81,"gherkinStepLine":71,"keywordType":"Action","textWithKeyword":"When I click the sticky-notes button","stepMatchArguments":[]},{"pwStepLine":82,"gherkinStepLine":72,"keywordType":"Outcome","textWithKeyword":"Then the sticky-notes panel should be visible","stepMatchArguments":[]}]},
  {"pwTestLine":85,"pickleLine":74,"tags":["@ui"],"steps":[{"pwStepLine":86,"gherkinStepLine":75,"keywordType":"Context","textWithKeyword":"Given the viewport is narrow","stepMatchArguments":[]},{"pwStepLine":87,"gherkinStepLine":76,"keywordType":"Context","textWithKeyword":"And I am on the \"/blogs/clean-architecture-with-asp-dotnet-core-10\" page","stepMatchArguments":[{"group":{"start":12,"value":"\"/blogs/clean-architecture-with-asp-dotnet-core-10\"","children":[{"start":13,"value":"/blogs/clean-architecture-with-asp-dotnet-core-10","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":88,"gherkinStepLine":77,"keywordType":"Action","textWithKeyword":"When I click the sticky-notes button","stepMatchArguments":[]},{"pwStepLine":89,"gherkinStepLine":78,"keywordType":"Action","textWithKeyword":"And I click the panel add button","stepMatchArguments":[]},{"pwStepLine":90,"gherkinStepLine":79,"keywordType":"Outcome","textWithKeyword":"Then there should be 1 sticky notes","stepMatchArguments":[{"group":{"start":16,"value":"1"},"parameterTypeName":"int"}]},{"pwStepLine":91,"gherkinStepLine":80,"keywordType":"Outcome","textWithKeyword":"And the notes panel should list 1 notes","stepMatchArguments":[{"group":{"start":28,"value":"1"},"parameterTypeName":"int"}]}]},
  {"pwTestLine":94,"pickleLine":82,"tags":["@ui"],"steps":[{"pwStepLine":95,"gherkinStepLine":83,"keywordType":"Context","textWithKeyword":"Given the viewport is narrow","stepMatchArguments":[]},{"pwStepLine":96,"gherkinStepLine":84,"keywordType":"Context","textWithKeyword":"And the article is preloaded with 1 sticky notes","stepMatchArguments":[{"group":{"start":30,"value":"1"},"parameterTypeName":"int"}]},{"pwStepLine":97,"gherkinStepLine":85,"keywordType":"Action","textWithKeyword":"When I click the sticky-notes button","stepMatchArguments":[]},{"pwStepLine":98,"gherkinStepLine":86,"keywordType":"Outcome","textWithKeyword":"Then the notes panel should list 1 notes","stepMatchArguments":[{"group":{"start":28,"value":"1"},"parameterTypeName":"int"}]},{"pwStepLine":99,"gherkinStepLine":87,"keywordType":"Action","textWithKeyword":"When I click the panel item delete button","stepMatchArguments":[]},{"pwStepLine":100,"gherkinStepLine":88,"keywordType":"Outcome","textWithKeyword":"Then there should be 0 sticky notes","stepMatchArguments":[{"group":{"start":16,"value":"0"},"parameterTypeName":"int"}]},{"pwStepLine":101,"gherkinStepLine":89,"keywordType":"Outcome","textWithKeyword":"And the notes panel should list 0 notes","stepMatchArguments":[{"group":{"start":28,"value":"0"},"parameterTypeName":"int"}]}]},
  {"pwTestLine":104,"pickleLine":91,"tags":["@ui"],"steps":[{"pwStepLine":105,"gherkinStepLine":92,"keywordType":"Context","textWithKeyword":"Given I am on the \"/blogs/clean-architecture-with-asp-dotnet-core-10\" page","stepMatchArguments":[{"group":{"start":12,"value":"\"/blogs/clean-architecture-with-asp-dotnet-core-10\"","children":[{"start":13,"value":"/blogs/clean-architecture-with-asp-dotnet-core-10","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":106,"gherkinStepLine":93,"keywordType":"Action","textWithKeyword":"When I triple-click in the left margin","stepMatchArguments":[]},{"pwStepLine":107,"gherkinStepLine":94,"keywordType":"Outcome","textWithKeyword":"Then there should be 1 sticky notes","stepMatchArguments":[{"group":{"start":16,"value":"1"},"parameterTypeName":"int"}]},{"pwStepLine":108,"gherkinStepLine":95,"keywordType":"Action","textWithKeyword":"When I navigate to the \"/blogs/csharp-unit-test-如何驗證多次呼叫\" page","stepMatchArguments":[{"group":{"start":18,"value":"\"/blogs/csharp-unit-test-如何驗證多次呼叫\"","children":[{"start":19,"value":"/blogs/csharp-unit-test-如何驗證多次呼叫","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":109,"gherkinStepLine":96,"keywordType":"Outcome","textWithKeyword":"Then there should be 0 sticky notes","stepMatchArguments":[{"group":{"start":16,"value":"0"},"parameterTypeName":"int"}]},{"pwStepLine":110,"gherkinStepLine":97,"keywordType":"Action","textWithKeyword":"When I navigate to the \"/blogs/clean-architecture-with-asp-dotnet-core-10\" page","stepMatchArguments":[{"group":{"start":18,"value":"\"/blogs/clean-architecture-with-asp-dotnet-core-10\"","children":[{"start":19,"value":"/blogs/clean-architecture-with-asp-dotnet-core-10","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":111,"gherkinStepLine":98,"keywordType":"Outcome","textWithKeyword":"Then there should be 1 sticky notes","stepMatchArguments":[{"group":{"start":16,"value":"1"},"parameterTypeName":"int"}]}]},
  {"pwTestLine":114,"pickleLine":100,"tags":["@ui"],"steps":[{"pwStepLine":115,"gherkinStepLine":101,"keywordType":"Context","textWithKeyword":"Given the article is preloaded with 20 sticky notes","stepMatchArguments":[{"group":{"start":30,"value":"20"},"parameterTypeName":"int"}]},{"pwStepLine":116,"gherkinStepLine":102,"keywordType":"Outcome","textWithKeyword":"Then there should be 20 sticky notes","stepMatchArguments":[{"group":{"start":16,"value":"20"},"parameterTypeName":"int"}]},{"pwStepLine":117,"gherkinStepLine":103,"keywordType":"Action","textWithKeyword":"When I triple-click in the left margin","stepMatchArguments":[]},{"pwStepLine":118,"gherkinStepLine":104,"keywordType":"Outcome","textWithKeyword":"Then there should be 20 sticky notes","stepMatchArguments":[{"group":{"start":16,"value":"20"},"parameterTypeName":"int"}]},{"pwStepLine":119,"gherkinStepLine":105,"keywordType":"Outcome","textWithKeyword":"And the sticky-notes limit notice should be visible","stepMatchArguments":[]}]},
  {"pwTestLine":122,"pickleLine":107,"tags":["@ui"],"steps":[{"pwStepLine":123,"gherkinStepLine":108,"keywordType":"Context","textWithKeyword":"Given the article is preloaded with an off-screen note","stepMatchArguments":[]},{"pwStepLine":124,"gherkinStepLine":109,"keywordType":"Outcome","textWithKeyword":"Then there should be 1 sticky notes","stepMatchArguments":[{"group":{"start":16,"value":"1"},"parameterTypeName":"int"}]},{"pwStepLine":125,"gherkinStepLine":110,"keywordType":"Outcome","textWithKeyword":"And the sticky note should be within the viewport","stepMatchArguments":[]}]},
  {"pwTestLine":128,"pickleLine":112,"tags":["@ui"],"steps":[{"pwStepLine":129,"gherkinStepLine":113,"keywordType":"Context","textWithKeyword":"Given I am on the \"/blogs/clean-architecture-with-asp-dotnet-core-10\" page","stepMatchArguments":[{"group":{"start":12,"value":"\"/blogs/clean-architecture-with-asp-dotnet-core-10\"","children":[{"start":13,"value":"/blogs/clean-architecture-with-asp-dotnet-core-10","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":130,"gherkinStepLine":114,"keywordType":"Action","textWithKeyword":"When I triple-click in the left margin","stepMatchArguments":[]},{"pwStepLine":131,"gherkinStepLine":115,"keywordType":"Action","textWithKeyword":"And I resize the sticky note by 90,70","stepMatchArguments":[{"group":{"start":28,"value":"90"},"parameterTypeName":"int"},{"group":{"start":31,"value":"70"},"parameterTypeName":"int"}]},{"pwStepLine":132,"gherkinStepLine":116,"keywordType":"Outcome","textWithKeyword":"Then the sticky note should be at the resized size","stepMatchArguments":[]},{"pwStepLine":133,"gherkinStepLine":117,"keywordType":"Action","textWithKeyword":"When I reload the page","stepMatchArguments":[]},{"pwStepLine":134,"gherkinStepLine":118,"keywordType":"Outcome","textWithKeyword":"Then there should be 1 sticky notes","stepMatchArguments":[{"group":{"start":16,"value":"1"},"parameterTypeName":"int"}]},{"pwStepLine":135,"gherkinStepLine":119,"keywordType":"Outcome","textWithKeyword":"And the sticky note should be at the resized size","stepMatchArguments":[]}]},
  {"pwTestLine":138,"pickleLine":121,"tags":["@ui"],"steps":[{"pwStepLine":139,"gherkinStepLine":122,"keywordType":"Context","textWithKeyword":"Given I am on the \"/blogs/clean-architecture-with-asp-dotnet-core-10\" page","stepMatchArguments":[{"group":{"start":12,"value":"\"/blogs/clean-architecture-with-asp-dotnet-core-10\"","children":[{"start":13,"value":"/blogs/clean-architecture-with-asp-dotnet-core-10","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":140,"gherkinStepLine":123,"keywordType":"Action","textWithKeyword":"When I triple-click in the left margin","stepMatchArguments":[]},{"pwStepLine":141,"gherkinStepLine":124,"keywordType":"Action","textWithKeyword":"And I resize the sticky note by -500,-500","stepMatchArguments":[{"group":{"start":28,"value":"-500"},"parameterTypeName":"int"},{"group":{"start":33,"value":"-500"},"parameterTypeName":"int"}]},{"pwStepLine":142,"gherkinStepLine":125,"keywordType":"Outcome","textWithKeyword":"Then the sticky note should not be smaller than the minimum size","stepMatchArguments":[]}]},
  {"pwTestLine":145,"pickleLine":127,"tags":["@ui"],"steps":[{"pwStepLine":146,"gherkinStepLine":128,"keywordType":"Context","textWithKeyword":"Given the viewport is narrow","stepMatchArguments":[]},{"pwStepLine":147,"gherkinStepLine":129,"keywordType":"Context","textWithKeyword":"And the article is preloaded with 1 sticky notes","stepMatchArguments":[{"group":{"start":30,"value":"1"},"parameterTypeName":"int"}]},{"pwStepLine":148,"gherkinStepLine":130,"keywordType":"Outcome","textWithKeyword":"Then there should be 1 sticky notes","stepMatchArguments":[{"group":{"start":16,"value":"1"},"parameterTypeName":"int"}]},{"pwStepLine":149,"gherkinStepLine":131,"keywordType":"Outcome","textWithKeyword":"And the floating sticky note should be hidden","stepMatchArguments":[]}]},
  {"pwTestLine":152,"pickleLine":133,"tags":["@ui"],"steps":[{"pwStepLine":153,"gherkinStepLine":134,"keywordType":"Context","textWithKeyword":"Given the viewport is narrow","stepMatchArguments":[]},{"pwStepLine":154,"gherkinStepLine":135,"keywordType":"Context","textWithKeyword":"And the article is preloaded with 1 sticky notes","stepMatchArguments":[{"group":{"start":30,"value":"1"},"parameterTypeName":"int"}]},{"pwStepLine":155,"gherkinStepLine":136,"keywordType":"Action","textWithKeyword":"When I click the sticky-notes button","stepMatchArguments":[]},{"pwStepLine":156,"gherkinStepLine":137,"keywordType":"Action","textWithKeyword":"And I open the first panel note","stepMatchArguments":[]},{"pwStepLine":157,"gherkinStepLine":138,"keywordType":"Outcome","textWithKeyword":"Then the sticky-notes detail view should be visible","stepMatchArguments":[]},{"pwStepLine":158,"gherkinStepLine":139,"keywordType":"Outcome","textWithKeyword":"And the detail view should show note text \"note 0\"","stepMatchArguments":[{"group":{"start":38,"value":"\"note 0\"","children":[{"start":39,"value":"note 0","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]}]},
  {"pwTestLine":161,"pickleLine":141,"tags":["@ui"],"steps":[{"pwStepLine":162,"gherkinStepLine":142,"keywordType":"Context","textWithKeyword":"Given the viewport is narrow","stepMatchArguments":[]},{"pwStepLine":163,"gherkinStepLine":143,"keywordType":"Context","textWithKeyword":"And the article is preloaded with 1 sticky notes","stepMatchArguments":[{"group":{"start":30,"value":"1"},"parameterTypeName":"int"}]},{"pwStepLine":164,"gherkinStepLine":144,"keywordType":"Action","textWithKeyword":"When I click the sticky-notes button","stepMatchArguments":[]},{"pwStepLine":165,"gherkinStepLine":145,"keywordType":"Action","textWithKeyword":"And I open the first panel note","stepMatchArguments":[]},{"pwStepLine":166,"gherkinStepLine":146,"keywordType":"Action","textWithKeyword":"And I edit the detail text to \"手機改的內容\"","stepMatchArguments":[{"group":{"start":26,"value":"\"手機改的內容\"","children":[{"start":27,"value":"手機改的內容","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":167,"gherkinStepLine":147,"keywordType":"Action","textWithKeyword":"And I reload the page","stepMatchArguments":[]},{"pwStepLine":168,"gherkinStepLine":148,"keywordType":"Action","textWithKeyword":"And I click the sticky-notes button","stepMatchArguments":[]},{"pwStepLine":169,"gherkinStepLine":149,"keywordType":"Action","textWithKeyword":"And I open the first panel note","stepMatchArguments":[]},{"pwStepLine":170,"gherkinStepLine":150,"keywordType":"Outcome","textWithKeyword":"Then the detail view should show note text \"手機改的內容\"","stepMatchArguments":[{"group":{"start":38,"value":"\"手機改的內容\"","children":[{"start":39,"value":"手機改的內容","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]}]},
  {"pwTestLine":173,"pickleLine":152,"tags":["@ui"],"steps":[{"pwStepLine":174,"gherkinStepLine":153,"keywordType":"Context","textWithKeyword":"Given the viewport is narrow","stepMatchArguments":[]},{"pwStepLine":175,"gherkinStepLine":154,"keywordType":"Context","textWithKeyword":"And the article is preloaded with 1 sticky notes","stepMatchArguments":[{"group":{"start":30,"value":"1"},"parameterTypeName":"int"}]},{"pwStepLine":176,"gherkinStepLine":155,"keywordType":"Action","textWithKeyword":"When I click the sticky-notes button","stepMatchArguments":[]},{"pwStepLine":177,"gherkinStepLine":156,"keywordType":"Action","textWithKeyword":"And I open the first panel note","stepMatchArguments":[]},{"pwStepLine":178,"gherkinStepLine":157,"keywordType":"Action","textWithKeyword":"And I click the detail delete button","stepMatchArguments":[]},{"pwStepLine":179,"gherkinStepLine":158,"keywordType":"Outcome","textWithKeyword":"Then there should be 0 sticky notes","stepMatchArguments":[{"group":{"start":16,"value":"0"},"parameterTypeName":"int"}]},{"pwStepLine":180,"gherkinStepLine":159,"keywordType":"Outcome","textWithKeyword":"And the notes panel should list 0 notes","stepMatchArguments":[{"group":{"start":28,"value":"0"},"parameterTypeName":"int"}]}]},
  {"pwTestLine":183,"pickleLine":161,"tags":["@ui"],"steps":[{"pwStepLine":184,"gherkinStepLine":162,"keywordType":"Context","textWithKeyword":"Given I am on the \"/blogs/clean-architecture-with-asp-dotnet-core-10\" page","stepMatchArguments":[{"group":{"start":12,"value":"\"/blogs/clean-architecture-with-asp-dotnet-core-10\"","children":[{"start":13,"value":"/blogs/clean-architecture-with-asp-dotnet-core-10","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":185,"gherkinStepLine":163,"keywordType":"Outcome","textWithKeyword":"Then the sticky-notes button should be hidden","stepMatchArguments":[]}]},
  {"pwTestLine":188,"pickleLine":165,"tags":["@ui"],"steps":[{"pwStepLine":189,"gherkinStepLine":166,"keywordType":"Context","textWithKeyword":"Given I am on the \"/blogs/clean-architecture-with-asp-dotnet-core-10\" page","stepMatchArguments":[{"group":{"start":12,"value":"\"/blogs/clean-architecture-with-asp-dotnet-core-10\"","children":[{"start":13,"value":"/blogs/clean-architecture-with-asp-dotnet-core-10","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":190,"gherkinStepLine":167,"keywordType":"Action","textWithKeyword":"When I triple-click in the left margin","stepMatchArguments":[]},{"pwStepLine":191,"gherkinStepLine":168,"keywordType":"Action","textWithKeyword":"And I type \"不失焦也要存\" into the focused note without blurring","stepMatchArguments":[{"group":{"start":7,"value":"\"不失焦也要存\"","children":[{"start":8,"value":"不失焦也要存","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":192,"gherkinStepLine":169,"keywordType":"Action","textWithKeyword":"And I reload the page","stepMatchArguments":[]},{"pwStepLine":193,"gherkinStepLine":170,"keywordType":"Outcome","textWithKeyword":"Then there should be 1 sticky notes","stepMatchArguments":[{"group":{"start":16,"value":"1"},"parameterTypeName":"int"}]},{"pwStepLine":194,"gherkinStepLine":171,"keywordType":"Outcome","textWithKeyword":"And the sticky note should contain \"不失焦也要存\"","stepMatchArguments":[{"group":{"start":31,"value":"\"不失焦也要存\"","children":[{"start":32,"value":"不失焦也要存","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]}]},
  {"pwTestLine":197,"pickleLine":173,"tags":["@ui"],"steps":[{"pwStepLine":198,"gherkinStepLine":174,"keywordType":"Context","textWithKeyword":"Given the viewport is narrow","stepMatchArguments":[]},{"pwStepLine":199,"gherkinStepLine":175,"keywordType":"Context","textWithKeyword":"And I am on the \"/blogs/clean-architecture-with-asp-dotnet-core-10\" page","stepMatchArguments":[{"group":{"start":12,"value":"\"/blogs/clean-architecture-with-asp-dotnet-core-10\"","children":[{"start":13,"value":"/blogs/clean-architecture-with-asp-dotnet-core-10","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":200,"gherkinStepLine":176,"keywordType":"Action","textWithKeyword":"When I click the sticky-notes button","stepMatchArguments":[]},{"pwStepLine":201,"gherkinStepLine":177,"keywordType":"Action","textWithKeyword":"And I click the panel add button","stepMatchArguments":[]},{"pwStepLine":202,"gherkinStepLine":178,"keywordType":"Outcome","textWithKeyword":"Then the sticky-notes detail view should be visible","stepMatchArguments":[]},{"pwStepLine":203,"gherkinStepLine":179,"keywordType":"Action","textWithKeyword":"When I edit the detail text to \"新便利貼內容\"","stepMatchArguments":[{"group":{"start":26,"value":"\"新便利貼內容\"","children":[{"start":27,"value":"新便利貼內容","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":204,"gherkinStepLine":180,"keywordType":"Action","textWithKeyword":"And I go back from the detail view","stepMatchArguments":[]},{"pwStepLine":205,"gherkinStepLine":181,"keywordType":"Outcome","textWithKeyword":"Then the sticky-notes detail view should be hidden","stepMatchArguments":[]},{"pwStepLine":206,"gherkinStepLine":182,"keywordType":"Outcome","textWithKeyword":"And the notes panel should list 1 notes","stepMatchArguments":[{"group":{"start":28,"value":"1"},"parameterTypeName":"int"}]}]},
]; // bdd-data-end