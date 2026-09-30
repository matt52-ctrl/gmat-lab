// Run with: node --test tests/*.test.js
// The exam engine against simulated test takers whose true ability is known.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const SPEC = require('../exam-spec.js');
const E = require('../exam-engine.js');
const G = require('../generators.js');

function rng(seed){ return () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; }; }
const written = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'questions', 'index.json'), 'utf8')).files
  .flatMap(f => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'questions', f), 'utf8')));
const groupOf = q => q.passage ? 'p:' + q.passage.title : null;
const bank = {}; for (const q of written) bank[q.id] = q;
const getQ = id => bank[id] || G.fromId(id);
const describe = id => { const q = getQ(id); return q ? { features: E.features(q), letter: Array.isArray(q.parts) || q.type === 'DS' ? null : 'ABCDE'[q.answer] } : null; };
function poolFor(section, seed){
  const gen = G.candidates({ seed, per: section === 'Data Insights' ? 6 : 2, section }).map(m => E.itemParams(SPEC, m));
  const wr = written.filter(q => q.section === section && q.set === 'practice').map(q => E.itemParams(SPEC, { ...q, group: groupOf(q) }));
  return section === 'Verbal' ? wr : gen.concat(wr);
}
/* Run one adaptive section for a simulated test taker of ability theta. */
function runSection(id, theta, seed, ability){
  const bp = E.blueprint(SPEC, 'official', [id], ability).sections[0];
  const st = E.newSectionState(bp), pool = poolFor(bp.section, seed), r = rng(seed), resp = [];
  for (;;){
    const qid = E.selectNext(SPEC, st, pool, { rng: r, describe });
    if (!qid) break;
    const it = st.items[st.items.length - 1];
    const y = r() < E.prob(theta, it) ? 1 : 0;
    E.record(SPEC, st, qid, !!y); resp.push({ it, y });
  }
  return { bp, st, resp, score: E.scoreSection(SPEC, resp, bp.questionCount - resp.length) };
}

test('the specification is internally consistent', () => {
  for (const s of SPEC.sections){
    const mins = Object.values(s.categories).reduce((a, v) => a + v[0], 0), maxs = Object.values(s.categories).reduce((a, v) => a + v[1], 0);
    assert.ok(mins <= s.questionCount && s.questionCount <= maxs, `${s.id}: ${mins}–${maxs} vs ${s.questionCount}`);
    for (const t of s.questionTypes) assert.ok(SPEC.questionTypes[t], t);
  }
  assert.equal(SPEC.sections.reduce((a, s) => a + s.duration, 0), SPEC.totalDuration);
  for (const m of SPEC.modes) assert.ok(m.id && m.name && m.text);
  for (const [k, v] of Object.entries(SPEC.errorCategories)) assert.ok(v.fix && Array.isArray(v.from), k);
});

test('scores follow the official scales and never decrease with ability', () => {
  let prev = 0;
  for (let th = -4; th <= 4; th += 0.1){ const s = E.thetaToSection(SPEC, th); assert.ok(s >= 60 && s <= 90 && s >= prev - 1e-9); prev = s; }
  const tot = E.scoreTotal(SPEC, [{ score: 85, range: [83, 87] }, { score: 84, range: [82, 86] }, { score: 86, range: [84, 88] }]);
  assert.equal(tot.total % 10, 5); assert.ok(tot.total >= 205 && tot.total <= 805);
  assert.ok(tot.range[0] <= tot.total && tot.total <= tot.range[1]);
  assert.equal(E.scoreTotal(SPEC, [{ score: 60, range: [60, 60] }, { score: 60, range: [60, 60] }, { score: 60, range: [60, 60] }]).total, 205);
  assert.equal(E.scoreTotal(SPEC, [{ score: 90, range: [90, 90] }, { score: 90, range: [90, 90] }, { score: 90, range: [90, 90] }]).total, 805);
  assert.equal(E.scoreTotal(SPEC, [{ score: 80, range: [80, 80] }]), null, 'a single section has no total');
});

test('Quant: the adaptive test recovers the true ability and respects the blueprint', () => {
  const errs = [];
  for (let i = 0; i < 24; i++){
    const theta = -2 + (i % 9) * 0.5, { bp, st, score } = runSection('Q', theta, 1000 + i);
    assert.equal(st.items.length, 21, 'full section');
    for (const [c, [mn, mx]] of Object.entries(bp.categories)) assert.ok((st.counts[c] || 0) >= mn && (st.counts[c] || 0) <= mx, `${c}: ${st.counts[c]}`);
    for (const n of Object.values(st.topics)) assert.ok(n <= bp.topicCap);
    const feats = st.items.map(it => describe(it.id).features);
    for (let a = 0; a < feats.length; a++) for (let b = a + 1; b < feats.length; b++) assert.ok(!E.isDuplicate(SPEC, feats[a], feats[b]), `duplicate ${st.items[a].id} ${st.items[b].id}`);
    const letters = st.items.map(it => describe(it.id).letter);
    for (let k = 3; k < letters.length; k++) assert.ok(!(letters[k] && letters.slice(k - 3, k + 1).every(l => l === letters[k])), 'answer run longer than 3');
    errs.push(score.theta - theta);
  }
  const rmse = Math.sqrt(errs.reduce((a, e) => a + e * e, 0) / errs.length);
  assert.ok(rmse < 0.6, `RMSE ${rmse.toFixed(2)}`);
});

test('the adaptive test targets the level: stronger test takers get harder questions', () => {
  const avgB = theta => { let s = 0, n = 0; for (let i = 0; i < 8; i++){ const { st } = runSection('Q', theta, 2000 + i); for (const it of st.items.slice(8)){ s += it.b; n++; } } return s / n; };
  assert.ok(avgB(1.5) - avgB(-1.5) > 1.2);
});

test('selection is not predictable: the same ability gives different sequences', () => {
  const a = runSection('Q', 0.5, 31).st.items.map(i => i.id), b = runSection('Q', 0.5, 32).st.items.map(i => i.id);
  assert.notDeepEqual(a, b);
});

test('Verbal: passages are served whole and in a row; CR and RC counts follow the blueprint', () => {
  for (let i = 0; i < 6; i++){
    const { bp, st } = runSection('V', -1 + i * 0.5, 3000 + i);
    assert.equal(st.items.length, 23);
    const c = st.counts; assert.ok(c.CR >= bp.categories.CR[0] && c.CR <= bp.categories.CR[1] && c.RC >= bp.categories.RC[0] && c.RC <= bp.categories.RC[1], JSON.stringify(c));
    const seq = st.items.map(it => it.group);
    const groups = [...new Set(seq.filter(Boolean))];
    for (const g of groups){ const idx = seq.map((x, k) => x === g ? k : -1).filter(k => k >= 0); assert.ok(idx.length >= 3 && idx[idx.length - 1] - idx[0] === idx.length - 1, `passage ${g} split: ${idx}`); }
    for (let k = 1; k < seq.length; k++) assert.ok(!(seq[k] && seq[k - 1] && seq[k] !== seq[k - 1]), 'two passages back to back');
  }
  // passages and CR questions mix through the section instead of piling up at one end
  let tailCR = 0, headCR = 0;
  for (let i = 0; i < 40; i++){ const t = runSection('V', 0, 5000 + i).st.items.map(it => it.type); if (t.slice(-6).every(x => x === 'CR')) tailCR++; if (t.slice(0, 6).every(x => x === 'CR')) headCR++; }
  assert.ok(tailCR <= 16 && headCR <= 16, `last 6 all CR in ${tailCR}/40, first 6 in ${headCR}/40`);
});

test('Data Insights: every type appears within its range, with no near-duplicates', () => {
  for (let i = 0; i < 8; i++){
    const { bp, st } = runSection('DI', -1 + i * 0.4, 4000 + i);
    assert.equal(st.items.length, 20, `only ${st.items.length}: ${JSON.stringify(st.counts)}`);
    for (const [c, [mn, mx]] of Object.entries(bp.categories)) assert.ok((st.counts[c] || 0) >= mn && (st.counts[c] || 0) <= mx, `${c}: ${st.counts[c]}`);
  }
});

test('running out of time lowers the score', () => {
  const resp = []; const r = rng(5);
  const { st } = runSection('Q', 1, 77);
  for (const it of st.items) resp.push({ it, y: r() < E.prob(1, it) ? 1 : 0 });
  const full = E.scoreSection(SPEC, resp, 0), cut = E.scoreSection(SPEC, resp.slice(0, 15), 6);
  assert.ok(cut.score < full.score || cut.theta < full.theta);
});

test('the analyzer finds timing patterns', () => {
  const params = {}, attempts = [];
  for (let i = 0; i < 20; i++){
    const id = 'q' + i; params[id] = { b: i < 10 ? -1 : 1.5, s: 0.5 };
    attempts.push({ qid: id, correct: i < 14, unanswered: i >= 18, timeSec: i < 6 ? 310 : i >= 12 && i < 18 ? 20 : 100, expectedSec: 120, type: i % 2 ? 'DS' : 'TA', topic: 'X', skill: 'y' });
  }
  const a = E.analyzeSection(SPEC, { section: 'Data Insights', attempts, params, durationSec: 2700, limitSec: 2700, theta: 0.2 });
  const ids = a.patterns.map(p => p.id);
  for (const want of ['earlyOverspend', 'endgame', 'rushHard', 'stuck']) assert.ok(ids.includes(want), `${want} missing: ${ids}`);
  assert.equal(a.unanswered, 2); assert.equal(a.n, 20);
});

test('errors are classified and explained with a next step', () => {
  const q = G.fromId('gen-pctseq-3-abc');
  const wrong = q.diagnosis.findIndex(d => d);
  const sec = { section: 'Quant', theta: 0, attempts: [
    { qid: q.id, answer: wrong, correct: false, unanswered: false, timeSec: 100, expectedSec: 120, topic: q.topic, type: 'PS' },
    { qid: q.id, answer: wrong, correct: false, unanswered: false, timeSec: 15, expectedSec: 120, topic: q.topic, type: 'PS' },
    { qid: q.id, answer: null, correct: false, unanswered: true, timeSec: 0, expectedSec: 120, topic: q.topic, type: 'PS' },
  ] };
  const out = E.classifyErrors(SPEC, sec, () => q, null, [{ topic: q.topic, category: 'Guessing' }]);
  assert.equal(out.length, 3);
  const cat = Object.keys(SPEC.errorCategories).find(k => SPEC.errorCategories[k].from.includes(q.diagnosis[wrong].type));
  assert.equal(out[0].category, cat); assert.equal(out[1].category, 'Guessing'); assert.equal(out[2].category, 'Timing Error');
  for (const e of out) for (const k of ['what', 'why', 'pattern', 'fix']) assert.ok(e[k] && e[k].length > 10, k);
  assert.match(out[1].pattern, /2nd guessing/);
  assert.ok(out[0].next.topic === q.topic && out[0].next.level >= 1 && out[0].next.level <= 6);
});

test('the ability model tracks sections and topics, and recent answers count more', () => {
  const r = rng(9), at = [], now = '2026-10-01';
  const mk = (theta, section, topic, days, n) => { for (let i = 0; i < n; i++){ const d = 1 + (i % 6); const it = E.itemParams(SPEC, { type: section === 'Quant' ? 'PS' : 'CR', difficulty: d }); at.push({ qid: 'x' + at.length, section, topic, skill: 's', type: it.type, difficulty: d, correct: r() < E.prob(theta, it), at: new Date(Date.parse(now) - days * 86400000).toISOString(), expectedSec: 120, timeSec: 110, timed: true }); } };
  mk(1.5, 'Quant', 'Percents', 1, 60); mk(-1, 'Quant', 'Probability', 1, 60); mk(1, 'Verbal', 'CR · Weaken', 1, 80);
  const m = E.abilityModel(SPEC, at, { now });
  assert.ok(m.topics.Percents.theta > m.topics.Probability.theta + 1);
  assert.ok(m.sections.Quant.theta > m.topics.Probability.theta && m.sections.Quant.theta < m.topics.Percents.theta, 'the section sits between its topics');
  assert.ok(Math.abs(m.sections.Verbal.theta - 1) < 0.5, `Verbal ${m.sections.Verbal.theta}`);
  assert.ok(m.estimatedScore.total == null, 'no total without Data Insights answers');
  assert.ok(m.timeEfficiency > 1);
  const old = [], fresh = [];
  for (let i = 0; i < 40; i++){ const it = E.itemParams(SPEC, { type: 'PS', difficulty: 3 }); old.push({ qid: 'o' + i, section: 'Quant', topic: 'T', type: 'PS', difficulty: 3, correct: false, at: '2026-01-01' }); fresh.push({ qid: 'f' + i, section: 'Quant', topic: 'T', type: 'PS', difficulty: 3, correct: true, at: '2026-09-30' }); }
  assert.ok(E.abilityModel(SPEC, old.concat(fresh), { now }).sections.Quant.theta > 0.3, 'recent right answers outweigh old misses');
});

test('the examiner picks focus topics from the mock, and readiness shows its evidence', () => {
  const errors = [{ topic: 'Probability', category: 'Conceptual Error' }, { topic: 'Probability', category: 'Calculation Error' }, { topic: 'Percents', category: 'Misread Question' }];
  const ex = E.examine(SPEC, {}, { Quant: { section: 'Quant', patterns: [{ severity: 3, text: 'x' }], difficulty: [{ label: 'Above your level', n: 4, acc: 0.25 }] } }, errors, null);
  assert.equal(ex.focus[0].topic, 'Probability'); assert.match(ex.findings.join(' '), /Conceptual|Calculation/);
  const nm = E.nextMockDecision(SPEC, '2026-09-20', [], ex.focus, '2026-09-25');
  assert.equal(nm.ready, false); assert.ok(nm.checks.length >= 3);
  assert.equal(E.nextMockDecision(SPEC, '2026-08-20', [], ex.focus, '2026-09-25').ready, true, 'overdue after 21 days');
  const sims = [0, 1, 2].map(i => ({ date: `2026-09-0${i + 1}`, total: 695 + i * 10, range: [675, 725], unanswered: 0, timeEfficiency: 1, sections: [{ section: 'Quant', score: 85 }, { section: 'Verbal', score: 84 }, { section: 'Data Insights', score: 83 + i }] }));
  const rd = E.readiness(SPEC, sims, [], null, [], 705, '2026-09-10', {});
  assert.ok(rd.checks.every(c => 'value' in c && typeof c.pass === 'boolean' && c.label));
  assert.equal(rd.checks.find(c => c.id === 'target').pass, true);
  assert.equal(rd.checks.find(c => c.id === 'official').pass, false, 'no official exam logged');
});
