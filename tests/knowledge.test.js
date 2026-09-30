// Run with: node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { syllabus } = require('../tools/validate-questions.js');

const dir = path.join(__dirname, '..', 'knowledge');
const index = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'));
const lessons = index.lessons.flatMap(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
const guides = JSON.parse(fs.readFileSync(path.join(dir, index.guides), 'utf8'));
const str = v => typeof v === 'string' && v.trim().length > 0;

test('every syllabus topic has exactly one lesson, in the right section', () => {
  const SYL = syllabus();
  for (const [section, topics] of Object.entries(SYL)) for (const t of topics){
    const found = lessons.filter(l => l.topic === t);
    assert.equal(found.length, 1, `${t}: ${found.length} lessons`);
    assert.equal(found[0].section, section, t);
  }
  const all = Object.values(SYL).flat();
  for (const l of lessons) assert.ok(all.includes(l.topic), `lesson for unknown topic ${l.topic}`);
});

test('lessons are complete', () => {
  for (const l of lessons){
    assert.ok(str(l.summary), l.topic + ' summary');
    for (const k of ['ideas', 'method', 'traps']) assert.ok(Array.isArray(l[k]) && l[k].length >= 1 && l[k].every(str), `${l.topic} ${k}`);
    for (const k of ['formulas', 'shortcuts']) assert.ok(Array.isArray(l[k]) && l[k].every(str), `${l.topic} ${k}`);
    if (l.example) assert.ok(str(l.example.q) && str(l.example.a), l.topic + ' example');
  }
});

test('guides are complete', () => {
  assert.ok(guides.length >= 4);
  for (const g of guides) assert.ok(str(g.id) && str(g.title) && g.points.length && g.points.every(str), g.id);
  assert.equal(new Set(guides.map(g => g.id)).size, guides.length);
});

test('the glossary is complete: every entry has an Italian meaning and an area, and no term appears twice', () => {
  const glossary = JSON.parse(fs.readFileSync(path.join(dir, index.glossary), 'utf8'));
  assert.ok(glossary.length >= 150, `${glossary.length} entries`);
  const seen = new Set();
  for (const e of glossary){
    assert.ok(str(e.term) && str(e.it), JSON.stringify(e));
    assert.ok(['quant', 'di', 'verbal', 'exam'].includes(e.area), e.term + ' area');
    assert.ok(e.note === undefined || str(e.note), e.term + ' note');
    assert.ok(e.tap === undefined || e.tap === false, e.term + ' tap');
    assert.ok(/^[a-z][a-z '-]*$/.test(e.term), e.term + ': lower-case letters only, so it can be matched in a question');
    for (const f of [e.term, ...(e.forms || [])]){ const k = f.toLowerCase().replace(/[\s-]+/g, ' '); assert.ok(!seen.has(k), 'twice: ' + f); seen.add(k); }
  }
});
