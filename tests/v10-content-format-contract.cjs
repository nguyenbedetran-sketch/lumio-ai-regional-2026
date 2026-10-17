// Prompt -> JSON decoding -> existing structured validator -> actual React/KaTeX.
// Authored responses, no provider quality or production claim.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { root, load, render, nodes } = require('./content-renderer-utils.cjs');
const { educationalContentFormat } = load('lib/ai/content-format.ts');
const { instructions } = load('lib/ai/router.ts');
const { validateStructured } = load('lib/ai/contracts.ts');
const checks = [];
function check(name, fn) { fn(); checks.push({name,status:'PASS'}); console.log('PASS '+name); }
check('The prompt JSON example decodes exactly once into supported inline mathematics', () => {
  const example = educationalContentFormat.match(/JSON string ("(?:\\.|[^"])*")/);
  assert.ok(example); const decoded = JSON.parse(example[1]);
  assert.equal(decoded, String.raw`\(x\neq 0\)`);
  const html = render(decoded); assert.equal(nodes(html).filter(n=>n.name==='math').length,1);
  assert.ok(!html.includes('data-math-fallback'));
});
check('All existing AI tasks and teacher schemas receive one common presentation contract', () => {
  for (const input of [
    ...['chat','summary','cards','quiz'].map(task=>({task,language:'vi',source:'',question:'Bài học'})),
    ...['lesson','questions','feedback','assistant'].map(kind=>({task:'chat',language:'vi',source:'',question:'Bài học',teachingContext:{kind}})),
  ]) {
    const prompt=instructions(input);
    assert.equal(prompt.split('CONTENT FORMAT:').length-1,1);
    assert.ok(prompt.includes('exact source quotations'));
    assert.ok(prompt.includes('not proof of a correct answer'));
  }
});
check('An authored JSON card retains canonical math and reference fields through validation and rendering', () => {
  const body=JSON.parse(JSON.stringify({cards:[{front:String.raw`Điều kiện của \(\frac{1}{x-2}\)?`,back:String.raw`\(x\neq2\)`,references:[{segmentId:'s1',quote:'Mẫu số khác không.'}]}]}));
  const before=JSON.stringify(body); const result=validateStructured('cards',before,{task:'cards',language:'vi',question:'Tạo thẻ',source:'Mẫu số khác không.'});
  assert.equal(JSON.stringify(body),before);
  assert.equal(nodes(render(result.cards[0].front)).filter(n=>n.name==='math').length,1);
  assert.equal(nodes(render(result.cards[0].back)).filter(n=>n.name==='math').length,1);
  assert.equal(result.cards[0].references[0].quote,'Mẫu số khác không.');
});
fs.mkdirSync(path.join(root,'docs/next/reports/content-renderer'),{recursive:true});
fs.writeFileSync(path.join(root,'docs/next/reports/content-renderer/format-contract.json'),JSON.stringify({status:'PASS',checkedAt:new Date().toISOString(),passed:checks.length,checks,actualProviderRequests:0,scope:'Authored prompt/JSON/structured-output/rendering contract, not generated-answer correctness.'},null,2)+'\n');
