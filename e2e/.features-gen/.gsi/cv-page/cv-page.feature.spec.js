// Generated from: ../.gsi/cv-page/cv-page.feature
import { test } from "playwright-bdd";

test.describe('CV Page (International SWE Style)', () => {

  test('頁面顯示完整 Resume 內容', { tag: ['@ui'] }, async ({ Given, Then, And, page }) => { 
    await Given('I am on the "/cv" page', null, { page }); 
    await Then('I should see "James Hsueh"', null, { page }); 
    await And('I should see "Full Stack Software Engineer"', null, { page }); 
    await And('I should see "GitHub"', null, { page }); 
    await And('I should see "Experience"', null, { page }); 
    await And('I should see "Cafler"', null, { page }); 
    await And('I should see "Doutify Tech"', null, { page }); 
    await And('I should see "TitanSoft"', null, { page }); 
    await And('I should see "Education"', null, { page }); 
    await And('I should see "National Yunlin University of Science and Technology"', null, { page }); 
    await And('I should see "Projects"', null, { page }); 
    await And('I should see "GSI Protocol"', null, { page }); 
    await And('the "Download PDF" button should be visible', null, { page }); 
  });

  test('每筆工作經歷顯示 achievements', { tag: ['@ui'] }, async ({ Given, Then, And, page }) => { 
    await Given('I am on the "/cv" page', null, { page }); 
    await Then('I should see "Built cross-regional business integration"', null, { page }); 
    await And('I should see "Reconstructed the credit loan system"', null, { page }); 
    await And('I should see "CKAD"', null, { page }); 
  });

  test('CV 頁面不含首頁特有區塊', { tag: ['@ui'] }, async ({ Given, Then, And, page }) => { 
    await Given('I am on the "/cv" page', null, { page }); 
    await Then('the page should not contain "Portfolio"', null, { page }); 
    await And('the page should not contain "Hero"', null, { page }); 
  });

  test('下載 PDF', { tag: ['@ui'] }, async ({ Given, When, Then, page }) => { 
    await Given('I am on the "/cv" page', null, { page }); 
    await When('I click the "Download PDF" button', null, { page }); 
    await Then('a file named "james_cv.pdf" should be downloaded'); 
  });

  test('返回首頁', { tag: ['@ui'] }, async ({ Given, When, Then, page }) => { 
    await Given('I am on the "/cv" page', null, { page }); 
    await When('I click the "Back to Home" link', null, { page }); 
    await Then('I should be navigated to "/"', null, { page }); 
  });

});

// == technical section ==

test.use({
  $test: [({}, use) => use(test), { scope: 'test', box: true }],
  $uri: [({}, use) => use('../.gsi/cv-page/cv-page.feature'), { scope: 'test', box: true }],
  $bddFileData: [({}, use) => use(bddFileData), { scope: "test", box: true }],
});

const bddFileData = [ // bdd-data-start
  {"pwTestLine":6,"pickleLine":4,"tags":["@ui"],"steps":[{"pwStepLine":7,"gherkinStepLine":5,"keywordType":"Context","textWithKeyword":"Given I am on the \"/cv\" page","stepMatchArguments":[{"group":{"start":12,"value":"\"/cv\"","children":[{"start":13,"value":"/cv","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":8,"gherkinStepLine":6,"keywordType":"Outcome","textWithKeyword":"Then I should see \"James Hsueh\"","stepMatchArguments":[{"group":{"start":13,"value":"\"James Hsueh\"","children":[{"start":14,"value":"James Hsueh","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":9,"gherkinStepLine":7,"keywordType":"Outcome","textWithKeyword":"And I should see \"Full Stack Software Engineer\"","stepMatchArguments":[{"group":{"start":13,"value":"\"Full Stack Software Engineer\"","children":[{"start":14,"value":"Full Stack Software Engineer","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":10,"gherkinStepLine":8,"keywordType":"Outcome","textWithKeyword":"And I should see \"GitHub\"","stepMatchArguments":[{"group":{"start":13,"value":"\"GitHub\"","children":[{"start":14,"value":"GitHub","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":11,"gherkinStepLine":9,"keywordType":"Outcome","textWithKeyword":"And I should see \"Experience\"","stepMatchArguments":[{"group":{"start":13,"value":"\"Experience\"","children":[{"start":14,"value":"Experience","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":12,"gherkinStepLine":10,"keywordType":"Outcome","textWithKeyword":"And I should see \"Cafler\"","stepMatchArguments":[{"group":{"start":13,"value":"\"Cafler\"","children":[{"start":14,"value":"Cafler","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":13,"gherkinStepLine":11,"keywordType":"Outcome","textWithKeyword":"And I should see \"Doutify Tech\"","stepMatchArguments":[{"group":{"start":13,"value":"\"Doutify Tech\"","children":[{"start":14,"value":"Doutify Tech","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":14,"gherkinStepLine":12,"keywordType":"Outcome","textWithKeyword":"And I should see \"TitanSoft\"","stepMatchArguments":[{"group":{"start":13,"value":"\"TitanSoft\"","children":[{"start":14,"value":"TitanSoft","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":15,"gherkinStepLine":13,"keywordType":"Outcome","textWithKeyword":"And I should see \"Education\"","stepMatchArguments":[{"group":{"start":13,"value":"\"Education\"","children":[{"start":14,"value":"Education","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":16,"gherkinStepLine":14,"keywordType":"Outcome","textWithKeyword":"And I should see \"National Yunlin University of Science and Technology\"","stepMatchArguments":[{"group":{"start":13,"value":"\"National Yunlin University of Science and Technology\"","children":[{"start":14,"value":"National Yunlin University of Science and Technology","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":17,"gherkinStepLine":15,"keywordType":"Outcome","textWithKeyword":"And I should see \"Projects\"","stepMatchArguments":[{"group":{"start":13,"value":"\"Projects\"","children":[{"start":14,"value":"Projects","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":18,"gherkinStepLine":16,"keywordType":"Outcome","textWithKeyword":"And I should see \"GSI Protocol\"","stepMatchArguments":[{"group":{"start":13,"value":"\"GSI Protocol\"","children":[{"start":14,"value":"GSI Protocol","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":19,"gherkinStepLine":17,"keywordType":"Outcome","textWithKeyword":"And the \"Download PDF\" button should be visible","stepMatchArguments":[{"group":{"start":4,"value":"\"Download PDF\"","children":[{"start":5,"value":"Download PDF","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]}]},
  {"pwTestLine":22,"pickleLine":19,"tags":["@ui"],"steps":[{"pwStepLine":23,"gherkinStepLine":20,"keywordType":"Context","textWithKeyword":"Given I am on the \"/cv\" page","stepMatchArguments":[{"group":{"start":12,"value":"\"/cv\"","children":[{"start":13,"value":"/cv","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":24,"gherkinStepLine":21,"keywordType":"Outcome","textWithKeyword":"Then I should see \"Built cross-regional business integration\"","stepMatchArguments":[{"group":{"start":13,"value":"\"Built cross-regional business integration\"","children":[{"start":14,"value":"Built cross-regional business integration","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":25,"gherkinStepLine":22,"keywordType":"Outcome","textWithKeyword":"And I should see \"Reconstructed the credit loan system\"","stepMatchArguments":[{"group":{"start":13,"value":"\"Reconstructed the credit loan system\"","children":[{"start":14,"value":"Reconstructed the credit loan system","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":26,"gherkinStepLine":23,"keywordType":"Outcome","textWithKeyword":"And I should see \"CKAD\"","stepMatchArguments":[{"group":{"start":13,"value":"\"CKAD\"","children":[{"start":14,"value":"CKAD","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]}]},
  {"pwTestLine":29,"pickleLine":25,"tags":["@ui"],"steps":[{"pwStepLine":30,"gherkinStepLine":26,"keywordType":"Context","textWithKeyword":"Given I am on the \"/cv\" page","stepMatchArguments":[{"group":{"start":12,"value":"\"/cv\"","children":[{"start":13,"value":"/cv","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":31,"gherkinStepLine":27,"keywordType":"Outcome","textWithKeyword":"Then the page should not contain \"Portfolio\"","stepMatchArguments":[{"group":{"start":28,"value":"\"Portfolio\"","children":[{"start":29,"value":"Portfolio","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":32,"gherkinStepLine":28,"keywordType":"Outcome","textWithKeyword":"And the page should not contain \"Hero\"","stepMatchArguments":[{"group":{"start":28,"value":"\"Hero\"","children":[{"start":29,"value":"Hero","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]}]},
  {"pwTestLine":35,"pickleLine":30,"tags":["@ui"],"steps":[{"pwStepLine":36,"gherkinStepLine":31,"keywordType":"Context","textWithKeyword":"Given I am on the \"/cv\" page","stepMatchArguments":[{"group":{"start":12,"value":"\"/cv\"","children":[{"start":13,"value":"/cv","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":37,"gherkinStepLine":32,"keywordType":"Action","textWithKeyword":"When I click the \"Download PDF\" button","stepMatchArguments":[{"group":{"start":12,"value":"\"Download PDF\"","children":[{"start":13,"value":"Download PDF","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":38,"gherkinStepLine":33,"keywordType":"Outcome","textWithKeyword":"Then a file named \"james_cv.pdf\" should be downloaded","stepMatchArguments":[{"group":{"start":13,"value":"\"james_cv.pdf\"","children":[{"start":14,"value":"james_cv.pdf","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]}]},
  {"pwTestLine":41,"pickleLine":35,"tags":["@ui"],"steps":[{"pwStepLine":42,"gherkinStepLine":36,"keywordType":"Context","textWithKeyword":"Given I am on the \"/cv\" page","stepMatchArguments":[{"group":{"start":12,"value":"\"/cv\"","children":[{"start":13,"value":"/cv","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":43,"gherkinStepLine":37,"keywordType":"Action","textWithKeyword":"When I click the \"Back to Home\" link","stepMatchArguments":[{"group":{"start":12,"value":"\"Back to Home\"","children":[{"start":13,"value":"Back to Home","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":44,"gherkinStepLine":38,"keywordType":"Outcome","textWithKeyword":"Then I should be navigated to \"/\"","stepMatchArguments":[{"group":{"start":25,"value":"\"/\"","children":[{"start":26,"value":"/","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]}]},
]; // bdd-data-end