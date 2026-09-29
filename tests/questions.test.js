// Run with: node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { validate, checkQuestion, syllabus } = require('../tools/validate-questions.js');

const SYL = syllabus();
const good = () => ({ id: 'x1', set: 'practice', block: 'Q', section: 'Quant', type: 'PS', topic: 'Percents', difficulty: 4, expectedSec: 120,
  stem: 'What is 10% of 50?', choices: ['1', '5', '10', '15', '50'], answer: 1, hints: ['a', 'b', 'c', 'd'], method: '0.1 × 50 = 5' });

test('the shipped question bank is valid', () => {
  const { problems, count } = validate();
  assert.deepEqual(problems, []);
  assert.ok(count >= 31);
});

test('a well-formed question passes', () => { assert.deepEqual(checkQuestion(good(), SYL), []); });

test('broken questions are caught', () => {
  const cases = [
    [{ answer: 5 }, /answer must be 0–4/],
    [{ choices: ['1', '1', '2', '3', '4'] }, /choices must all differ/],
    [{ hints: ['a'] }, /hints must be 4/],
    [{ topic: 'Geometry' }, /not in the Quant syllabus/],
    [{ section: 'Verbal' }, /section must be "Quant"/],
    [{ type: 'CR' }, /type CR belongs to Verbal/],
    [{ difficulty: 7 }, /difficulty/],
  ];
  for (const [patch, re] of cases){
    const problems = checkQuestion({ ...good(), ...patch }, SYL);
    assert.ok(problems.some(p => re.test(p)), `${JSON.stringify(patch)} → ${problems.join('; ')}`);
  }
});

test('multi-part and DS rules', () => {
  const ds = { ...good(), block: 'DI', section: 'Data Insights', type: 'DS', topic: 'Data Sufficiency', choices: undefined, statements: ['(1) x > 0', 'y = 2'] };
  assert.ok(checkQuestion(ds, SYL).some(p => /must not start with/.test(p)));
  const tpa = { ...good(), block: 'DI', section: 'Data Insights', type: 'TPA', topic: 'Two-Part Analysis', choices: undefined, answer: undefined, partStyle: 'tpa',
    parts: [{ label: 'A', options: ['1', '2'], answer: 0 }, { label: 'B', options: ['1', '3'], answer: 2 }] };
  const p = checkQuestion(tpa, SYL);
  assert.ok(p.some(x => /share the same options/.test(x)) && p.some(x => /out of range/.test(x)), p.join('; '));
});
