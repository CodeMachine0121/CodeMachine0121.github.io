// Generated from: ../.gsi/cv-page-redesign/cv-page-redesign.feature
import { test } from "playwright-bdd";

test.describe('CV Page Redesign with Profile Picture & cv.json', () => {

  test('Header 顯示大頭照與基本資訊', { tag: ['@ui'] }, async ({ Given, Then, And, page }) => { 
    await Given('I am on the "/cv" page', null, { page }); 
    await Then('the "profile picture" should be visible', null, { page }); 
    await And('I should see "James Hsueh"', null, { page }); 
    await And('I should see "Full Stack Software Engineer"', null, { page }); 
    await And('I should see "GitHub"', null, { page }); 
    await And('I should see "james.afternoon.dev@gmail.com"', null, { page }); 
  });

  test('Summary 顯示豐富的 professional summary', { tag: ['@ui'] }, async ({ Given, Then, And, page }) => { 
    await Given('I am on the "/cv" page', null, { page }); 
    await Then('I should see "Summary"', null, { page }); 
    await And('the summary text should contain at least 3 sentences', null, { page }); 
  });

  test('Experience achievements 以行動動詞開頭', { tag: ['@ui'] }, async ({ Given, Then, And, page }) => { 
    await Given('I am on the "/cv" page', null, { page }); 
    await Then('I should see "Experience"', null, { page }); 
    await And('I should see "Cafler"', null, { page }); 
    await And('I should see "Doutify Tech"', null, { page }); 
    await And('I should see "TitanSoft"', null, { page }); 
    await And('I should see "Implemented"', null, { page }); 
    await And('I should see "Built"', null, { page }); 
  });

  test('Education 與 Projects 區段正常顯示', { tag: ['@ui'] }, async ({ Given, Then, And, page }) => { 
    await Given('I am on the "/cv" page', null, { page }); 
    await Then('I should see "Education"', null, { page }); 
    await And('I should see "National Yunlin University of Science and Technology"', null, { page }); 
    await And('I should see "Projects"', null, { page }); 
    await And('I should see "GSI Protocol"', null, { page }); 
  });

  test('Download PDF 功能正常', { tag: ['@ui'] }, async ({ Given, When, Then, page }) => { 
    await Given('I am on the "/cv" page', null, { page }); 
    await When('I click the "Download PDF" button', null, { page }); 
    await Then('a file download should be triggered'); 
  });

  test('Back to Home 功能正常', { tag: ['@ui'] }, async ({ Given, When, Then, page }) => { 
    await Given('I am on the "/cv" page', null, { page }); 
    await When('I click the "Back to Home" link', null, { page }); 
    await Then('I should be navigated to "/"', null, { page }); 
  });

});

// == technical section ==

test.use({
  $test: [({}, use) => use(test), { scope: 'test', box: true }],
  $uri: [({}, use) => use('../.gsi/cv-page-redesign/cv-page-redesign.feature'), { scope: 'test', box: true }],
  $bddFileData: [({}, use) => use(bddFileData), { scope: "test", box: true }],
});

const bddFileData = [ // bdd-data-start
  {"pwTestLine":6,"pickleLine":4,"tags":["@ui"],"steps":[{"pwStepLine":7,"gherkinStepLine":5,"keywordType":"Context","textWithKeyword":"Given I am on the \"/cv\" page","stepMatchArguments":[{"group":{"start":12,"value":"\"/cv\"","children":[{"start":13,"value":"/cv","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":8,"gherkinStepLine":6,"keywordType":"Outcome","textWithKeyword":"Then the \"profile picture\" should be visible","stepMatchArguments":[{"group":{"start":4,"value":"\"profile picture\"","children":[{"start":5,"value":"profile picture","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":9,"gherkinStepLine":7,"keywordType":"Outcome","textWithKeyword":"And I should see \"James Hsueh\"","stepMatchArguments":[{"group":{"start":13,"value":"\"James Hsueh\"","children":[{"start":14,"value":"James Hsueh","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":10,"gherkinStepLine":8,"keywordType":"Outcome","textWithKeyword":"And I should see \"Full Stack Software Engineer\"","stepMatchArguments":[{"group":{"start":13,"value":"\"Full Stack Software Engineer\"","children":[{"start":14,"value":"Full Stack Software Engineer","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":11,"gherkinStepLine":9,"keywordType":"Outcome","textWithKeyword":"And I should see \"GitHub\"","stepMatchArguments":[{"group":{"start":13,"value":"\"GitHub\"","children":[{"start":14,"value":"GitHub","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":12,"gherkinStepLine":10,"keywordType":"Outcome","textWithKeyword":"And I should see \"james.afternoon.dev@gmail.com\"","stepMatchArguments":[{"group":{"start":13,"value":"\"james.afternoon.dev@gmail.com\"","children":[{"start":14,"value":"james.afternoon.dev@gmail.com","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]}]},
  {"pwTestLine":15,"pickleLine":12,"tags":["@ui"],"steps":[{"pwStepLine":16,"gherkinStepLine":13,"keywordType":"Context","textWithKeyword":"Given I am on the \"/cv\" page","stepMatchArguments":[{"group":{"start":12,"value":"\"/cv\"","children":[{"start":13,"value":"/cv","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":17,"gherkinStepLine":14,"keywordType":"Outcome","textWithKeyword":"Then I should see \"Summary\"","stepMatchArguments":[{"group":{"start":13,"value":"\"Summary\"","children":[{"start":14,"value":"Summary","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":18,"gherkinStepLine":15,"keywordType":"Outcome","textWithKeyword":"And the summary text should contain at least 3 sentences","stepMatchArguments":[]}]},
  {"pwTestLine":21,"pickleLine":17,"tags":["@ui"],"steps":[{"pwStepLine":22,"gherkinStepLine":18,"keywordType":"Context","textWithKeyword":"Given I am on the \"/cv\" page","stepMatchArguments":[{"group":{"start":12,"value":"\"/cv\"","children":[{"start":13,"value":"/cv","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":23,"gherkinStepLine":19,"keywordType":"Outcome","textWithKeyword":"Then I should see \"Experience\"","stepMatchArguments":[{"group":{"start":13,"value":"\"Experience\"","children":[{"start":14,"value":"Experience","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":24,"gherkinStepLine":20,"keywordType":"Outcome","textWithKeyword":"And I should see \"Cafler\"","stepMatchArguments":[{"group":{"start":13,"value":"\"Cafler\"","children":[{"start":14,"value":"Cafler","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":25,"gherkinStepLine":21,"keywordType":"Outcome","textWithKeyword":"And I should see \"Doutify Tech\"","stepMatchArguments":[{"group":{"start":13,"value":"\"Doutify Tech\"","children":[{"start":14,"value":"Doutify Tech","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":26,"gherkinStepLine":22,"keywordType":"Outcome","textWithKeyword":"And I should see \"TitanSoft\"","stepMatchArguments":[{"group":{"start":13,"value":"\"TitanSoft\"","children":[{"start":14,"value":"TitanSoft","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":27,"gherkinStepLine":23,"keywordType":"Outcome","textWithKeyword":"And I should see \"Implemented\"","stepMatchArguments":[{"group":{"start":13,"value":"\"Implemented\"","children":[{"start":14,"value":"Implemented","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":28,"gherkinStepLine":24,"keywordType":"Outcome","textWithKeyword":"And I should see \"Built\"","stepMatchArguments":[{"group":{"start":13,"value":"\"Built\"","children":[{"start":14,"value":"Built","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]}]},
  {"pwTestLine":31,"pickleLine":26,"tags":["@ui"],"steps":[{"pwStepLine":32,"gherkinStepLine":27,"keywordType":"Context","textWithKeyword":"Given I am on the \"/cv\" page","stepMatchArguments":[{"group":{"start":12,"value":"\"/cv\"","children":[{"start":13,"value":"/cv","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":33,"gherkinStepLine":28,"keywordType":"Outcome","textWithKeyword":"Then I should see \"Education\"","stepMatchArguments":[{"group":{"start":13,"value":"\"Education\"","children":[{"start":14,"value":"Education","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":34,"gherkinStepLine":29,"keywordType":"Outcome","textWithKeyword":"And I should see \"National Yunlin University of Science and Technology\"","stepMatchArguments":[{"group":{"start":13,"value":"\"National Yunlin University of Science and Technology\"","children":[{"start":14,"value":"National Yunlin University of Science and Technology","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":35,"gherkinStepLine":30,"keywordType":"Outcome","textWithKeyword":"And I should see \"Projects\"","stepMatchArguments":[{"group":{"start":13,"value":"\"Projects\"","children":[{"start":14,"value":"Projects","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":36,"gherkinStepLine":31,"keywordType":"Outcome","textWithKeyword":"And I should see \"GSI Protocol\"","stepMatchArguments":[{"group":{"start":13,"value":"\"GSI Protocol\"","children":[{"start":14,"value":"GSI Protocol","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]}]},
  {"pwTestLine":39,"pickleLine":33,"tags":["@ui"],"steps":[{"pwStepLine":40,"gherkinStepLine":34,"keywordType":"Context","textWithKeyword":"Given I am on the \"/cv\" page","stepMatchArguments":[{"group":{"start":12,"value":"\"/cv\"","children":[{"start":13,"value":"/cv","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":41,"gherkinStepLine":35,"keywordType":"Action","textWithKeyword":"When I click the \"Download PDF\" button","stepMatchArguments":[{"group":{"start":12,"value":"\"Download PDF\"","children":[{"start":13,"value":"Download PDF","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":42,"gherkinStepLine":36,"keywordType":"Outcome","textWithKeyword":"Then a file download should be triggered","stepMatchArguments":[]}]},
  {"pwTestLine":45,"pickleLine":38,"tags":["@ui"],"steps":[{"pwStepLine":46,"gherkinStepLine":39,"keywordType":"Context","textWithKeyword":"Given I am on the \"/cv\" page","stepMatchArguments":[{"group":{"start":12,"value":"\"/cv\"","children":[{"start":13,"value":"/cv","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":47,"gherkinStepLine":40,"keywordType":"Action","textWithKeyword":"When I click the \"Back to Home\" link","stepMatchArguments":[{"group":{"start":12,"value":"\"Back to Home\"","children":[{"start":13,"value":"Back to Home","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":48,"gherkinStepLine":41,"keywordType":"Outcome","textWithKeyword":"Then I should be navigated to \"/\"","stepMatchArguments":[{"group":{"start":25,"value":"\"/\"","children":[{"start":26,"value":"/","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]}]},
]; // bdd-data-end