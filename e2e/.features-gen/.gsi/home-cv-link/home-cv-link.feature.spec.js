// Generated from: ../.gsi/home-cv-link/home-cv-link.feature
import { test } from "playwright-bdd";

test.describe('Home Page CV Link', () => {

  test('首頁 Download CV 按鈕可見', { tag: ['@ui'] }, async ({ Given, Then, page }) => { 
    await Given('I am on the "/" page', null, { page }); 
    await Then('the "Download CV" link should be visible', null, { page }); 
  });

  test('點擊 Download CV 導向 CV 頁面', { tag: ['@ui'] }, async ({ Given, When, Then, And, page }) => { 
    await Given('I am on the "/" page', null, { page }); 
    await When('I click the "Download CV" link', null, { page }); 
    await Then('I should be navigated to "/cv"', null, { page }); 
    await And('I should see "James Hsueh"', null, { page }); 
  });

});

// == technical section ==

test.use({
  $test: [({}, use) => use(test), { scope: 'test', box: true }],
  $uri: [({}, use) => use('../.gsi/home-cv-link/home-cv-link.feature'), { scope: 'test', box: true }],
  $bddFileData: [({}, use) => use(bddFileData), { scope: "test", box: true }],
});

const bddFileData = [ // bdd-data-start
  {"pwTestLine":6,"pickleLine":4,"tags":["@ui"],"steps":[{"pwStepLine":7,"gherkinStepLine":5,"keywordType":"Context","textWithKeyword":"Given I am on the \"/\" page","stepMatchArguments":[{"group":{"start":12,"value":"\"/\"","children":[{"start":13,"value":"/","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":8,"gherkinStepLine":6,"keywordType":"Outcome","textWithKeyword":"Then the \"Download CV\" link should be visible","stepMatchArguments":[{"group":{"start":4,"value":"\"Download CV\"","children":[{"start":5,"value":"Download CV","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]}]},
  {"pwTestLine":11,"pickleLine":8,"tags":["@ui"],"steps":[{"pwStepLine":12,"gherkinStepLine":9,"keywordType":"Context","textWithKeyword":"Given I am on the \"/\" page","stepMatchArguments":[{"group":{"start":12,"value":"\"/\"","children":[{"start":13,"value":"/","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":13,"gherkinStepLine":10,"keywordType":"Action","textWithKeyword":"When I click the \"Download CV\" link","stepMatchArguments":[{"group":{"start":12,"value":"\"Download CV\"","children":[{"start":13,"value":"Download CV","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":14,"gherkinStepLine":11,"keywordType":"Outcome","textWithKeyword":"Then I should be navigated to \"/cv\"","stepMatchArguments":[{"group":{"start":25,"value":"\"/cv\"","children":[{"start":26,"value":"/cv","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":15,"gherkinStepLine":12,"keywordType":"Outcome","textWithKeyword":"And I should see \"James Hsueh\"","stepMatchArguments":[{"group":{"start":13,"value":"\"James Hsueh\"","children":[{"start":14,"value":"James Hsueh","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]}]},
]; // bdd-data-end