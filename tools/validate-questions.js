#!/usr/bin/env node
/* Checks every question file listed in questions/index.json. Run: node tools/validate-questions.js
   Exits with code 1 and one line per problem if anything is wrong. The topic list is read from SYLLABUS in app.js. */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SECTION_OF_BLOCK = { Q: 'Quant', DI: 'Data Insights', V: 'Verbal' };
const TYPES = { PS: 'Quant', DS: 'Data Insights', TPA: 'Data Insights', TA: 'Data Insights', GI: 'Data Insights', MSR: 'Data Insights', CR: 'Verbal', RC: 'Verbal' };
const MULTI = ['TPA', 'TA', 'GI', 'MSR'];

function syllabus(){
  const src = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
  const m = /const SYLLABUS = (\{[\s\S]*?\n\});/.exec(src);
  if (!m) throw new Error('SYLLABUS not found in app.js');
  return new Function('return ' + m[1])();
}
function errorTypes(){
  const src = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
  const m = /const ERROR_TYPES = (\[[\s\S]*?\n\]);/.exec(src);
  if (!m) throw new Error('ERROR_TYPES not found in app.js');
  return new Function('return ' + m[1])().map(x => x[0]);
}
const TYPES_OF_ERROR = errorTypes();
const str = v => typeof v === 'string' && v.trim().length > 0;
/* diagnosis: one entry per option; null for the right one, { why, type } for every wrong one */
function checkDiagnosis(diag, n, answer, where){
  const e = [];
  if (!Array.isArray(diag) || diag.length !== n){ e.push(`${where} diagnosis needs one entry per option (${n})`); return e; }
  diag.forEach((d, i) => {
    if (i === answer){ if (d !== null) e.push(`${where} diagnosis for the right option must be null`); return; }
    if (!d || !str(d.why)) e.push(`${where} diagnosis ${i} needs a “why”`);
    else if (!TYPES_OF_ERROR.includes(d.type)) e.push(`${where} diagnosis ${i}: type must be one of ${TYPES_OF_ERROR.join(', ')}`);
  });
  return e;
}
const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;

function checkQuestion(q, SYL){
  const e = [];
  if (!str(q.id) || !/^[A-Za-z0-9_-]+$/.test(q.id)) e.push('id must be letters, digits, - or _');
  if (!['diagnostic', 'practice'].includes(q.set)) e.push('set must be "diagnostic" or "practice"');
  if (!SECTION_OF_BLOCK[q.block]) e.push('block must be Q, DI or V');
  else if (q.section !== SECTION_OF_BLOCK[q.block]) e.push(`section must be "${SECTION_OF_BLOCK[q.block]}" for block ${q.block}`);
  if (!TYPES[q.type]) e.push('type must be one of ' + Object.keys(TYPES).join(', '));
  else if (TYPES[q.type] !== q.section) e.push(`type ${q.type} belongs to ${TYPES[q.type]}, not ${q.section}`);
  if (SYL[q.section] && !SYL[q.section].includes(q.topic)) e.push(`topic "${q.topic}" is not in the ${q.section} syllabus`);
  if (!int(q.difficulty, 1, 6)) e.push('difficulty must be an integer 1–6');
  if (!int(q.expectedSec, 30, 400)) e.push('expectedSec must be an integer 30–400');
  if (!str(q.stem)) e.push('stem is empty');
  if (!Array.isArray(q.hints) || q.hints.length !== 4 || !q.hints.every(str)) e.push('hints must be 4 non-empty strings');
  if (!str(q.method)) e.push('method is empty');
  if (q.set === 'diagnostic' && !int(q.order, 1, 99)) e.push('diagnostic questions need an order');

  if (q.type === 'PS' || q.type === 'CR' || q.type === 'RC'){
    if (!Array.isArray(q.choices) || q.choices.length !== 5 || !q.choices.every(str)) e.push('choices must be 5 non-empty strings');
    else if (new Set(q.choices.map(c => c.trim())).size !== 5) e.push('choices must all differ');
    if (!int(q.answer, 0, 4)) e.push('answer must be 0–4');
    else e.push(...checkDiagnosis(q.diagnosis, 5, q.answer, ''));
  }
  if (q.type === 'RC' && !(q.passage && str(q.passage.text))) e.push('RC needs passage.text');
  if (q.type === 'DS'){
    if (!Array.isArray(q.statements) || q.statements.length !== 2 || !q.statements.every(str)) e.push('statements must be 2 non-empty strings');
    else if (q.statements.some(s => /^\s*\(\d\)/.test(s))) e.push('statements must not start with (1)/(2)');
    if (!int(q.answer, 0, 4)) e.push('answer must be 0–4');
    else e.push(...checkDiagnosis(q.diagnosis, 5, q.answer, ''));
    if (q.choices) e.push('DS questions use the standard choices: remove "choices"');
  }
  if (MULTI.includes(q.type)){
    if (q.answer !== undefined) e.push('multi-part questions keep answers in parts[].answer');
    if (!['tpa', 'yesno', 'dropdown'].includes(q.partStyle)) e.push('partStyle must be tpa, yesno or dropdown');
    if (!Array.isArray(q.parts) || !q.parts.length) e.push('parts is empty');
    else q.parts.forEach((p, i) => {
      if (!str(p.label)) e.push(`parts[${i}].label is empty`);
      if (!Array.isArray(p.options) || p.options.length < 2 || !p.options.every(str)) e.push(`parts[${i}].options needs 2+ strings`);
      else if (!int(p.answer, 0, p.options.length - 1)) e.push(`parts[${i}].answer is out of range`);
      else e.push(...checkDiagnosis(p.diagnosis, p.options.length, p.answer, `parts[${i}]`));
      if (q.partStyle === 'yesno' && JSON.stringify(p.options) !== '["Yes","No"]') e.push(`parts[${i}].options must be ["Yes","No"]`);
      if (q.partStyle === 'tpa' && i > 0 && JSON.stringify(p.options) !== JSON.stringify(q.parts[0].options)) e.push('tpa parts must share the same options');
    });
  }
  if (q.type === 'TA'){
    const t = q.table;
    if (!t || !Array.isArray(t.columns) || !Array.isArray(t.rows) || !t.rows.length) e.push('TA needs table.columns and table.rows');
    else {
      if (t.rows.some(r => !Array.isArray(r) || r.length !== t.columns.length)) e.push('every table row needs one value per column');
      if (t.numeric && (!Array.isArray(t.numeric) || t.numeric.length !== t.columns.length)) e.push('table.numeric needs one flag per column');
    }
  }
  if (q.type === 'GI'){
    const c = q.chart;
    if (!c || !Array.isArray(c.labels) || !Array.isArray(c.values) || c.labels.length !== c.values.length || !c.values.length) e.push('GI needs chart.labels and chart.values of the same length');
    else if (!c.values.every(v => typeof v === 'number' && isFinite(v))) e.push('chart.values must be numbers');
  }
  if (q.type === 'MSR' && !(Array.isArray(q.tabs) && q.tabs.length >= 2 && q.tabs.every(t => str(t.title) && str(t.body)))) e.push('MSR needs 2+ tabs with title and body');
  return e;
}

function validate(root){
  root = root || ROOT;
  const problems = [];
  const SYL = syllabus();
  let idx;
  try { idx = JSON.parse(fs.readFileSync(path.join(root, 'questions', 'index.json'), 'utf8')); }
  catch (err){ return { problems: ['questions/index.json: ' + err.message], count: 0 }; }
  if (!idx || !Array.isArray(idx.files) || !idx.files.length) return { problems: ['questions/index.json: "files" must list the question files'], count: 0 };
  const ids = new Map(), orders = new Map();
  let count = 0;
  for (const f of idx.files){
    let list;
    try { list = JSON.parse(fs.readFileSync(path.join(root, 'questions', f), 'utf8')); }
    catch (err){ problems.push(`questions/${f}: ${err.code === 'ENOENT' ? 'listed in index.json but missing' : err.message}`); continue; }
    if (!Array.isArray(list)){ problems.push(`questions/${f}: must be a JSON array`); continue; }
    for (const q of list){
      count++;
      const where = `questions/${f} ${q && q.id ? q.id : '#' + count}`;
      if (!q || typeof q !== 'object'){ problems.push(where + ': not an object'); continue; }
      if (ids.has(q.id)) problems.push(`${where}: id already used in ${ids.get(q.id)}`); else ids.set(q.id, f);
      if (q.set === 'diagnostic'){ const k = q.block + ':' + q.order; if (orders.has(k)) problems.push(`${where}: order ${q.order} already used in block ${q.block}`); orders.set(k, q.id); }
      for (const p of checkQuestion(q, SYL)) problems.push(`${where}: ${p}`);
    }
  }
  for (const f of fs.readdirSync(path.join(root, 'questions'))) if (f.endsWith('.json') && f !== 'index.json' && !idx.files.includes(f)) problems.push(`questions/${f}: not listed in index.json`);
  return { problems, count };
}

if (require.main === module){
  const { problems, count } = validate();
  if (problems.length){ console.error(problems.join('\n')); console.error(`\n${problems.length} problem(s) in ${count} questions.`); process.exit(1); }
  console.log(`${count} questions OK.`);
}
module.exports = { validate, checkQuestion, syllabus, errorTypes };
