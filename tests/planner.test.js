// Run with: node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../planner.js');

const TODAY = '2026-10-20';
function topic(t, section, status, extra){ return { topic: t, section, status, n: 0, acc: null, ratio: null, last: null, ...extra }; }
function q(id, t, section, difficulty, seen){ return { id, topic: t, section, difficulty, seen: !!seen, expectedSec: 120 }; }
function ctx(over){
  return {
    today: TODAY, minutes: 45, interviewDone: true, pendingReview: null, nextBlock: null, diagnosticDone: true, phase: 1,
    due: [], attempts: [], errors: [], mocks: [], hoursPerWeek: 8, claudePlan: null,
    topics: [
      topic('Percents', 'Quant', 5, { n: 30, acc: 0.93, last: '2026-10-18' }),
      topic('Probability', 'Quant', 2, { n: 8, acc: 0.4, last: '2026-10-19' }),
      topic('CR · Weaken', 'Verbal', 4, { n: 14, acc: 0.85, last: '2026-10-15' }),
    ],
    pool: [
      q('p1', 'Percents', 'Quant', 4), q('p2', 'Percents', 'Quant', 5), q('p3', 'Percents', 'Quant', 5),
      q('b1', 'Probability', 'Quant', 3), q('b2', 'Probability', 'Quant', 3), q('b3', 'Probability', 'Quant', 4), q('b4', 'Probability', 'Quant', 5),
      q('w1', 'CR · Weaken', 'Verbal', 5), q('w2', 'CR · Weaken', 'Verbal', 4),
    ],
    ...over,
  };
}
function seeded(seed){ return () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; }; }

test('weak topics outrank strong ones, strong ones keep a small weight', () => {
  const w = P.topicWeights(ctx());
  assert.equal(w[0].topic, 'Probability');
  assert.equal(w[w.length - 1].topic, 'Percents');
  assert.ok(w[w.length - 1].weight > 0);
});

test('recent errors and Claude’s weekly focus raise a topic', () => {
  const errors = [{ topic: 'CR · Weaken', history: [{ date: '2026-10-18', errorType: 'Logic' }, { date: '2026-10-19', errorType: 'Logic' }, { date: '2026-10-19', errorType: 'Trap' }] }];
  const base = P.topicWeights(ctx()).find(t => t.topic === 'CR · Weaken').weight;
  const withErr = P.topicWeights(ctx({ errors })).find(t => t.topic === 'CR · Weaken');
  assert.equal(withErr.recentErr, 3);
  assert.ok(withErr.weight > base);
  const focus = P.topicWeights(ctx({ claudePlan: { updatedAt: '2026-10-18T10:00:00Z', focus: [{ topic: 'Percents' }] } })).find(t => t.topic === 'Percents');
  assert.ok(focus.claudeFocus && focus.weight > 0.4);
  const old = P.topicWeights(ctx({ claudePlan: { updatedAt: '2026-09-01T10:00:00Z', focus: [{ topic: 'Percents' }] } })).find(t => t.topic === 'Percents');
  assert.equal(old.claudeFocus, false);
});

test('mixed sets lean toward weak topics without ignoring strong ones', () => {
  const counts = {};
  const rng = seeded(7);
  for (let i = 0; i < 400; i++) for (const id of P.pickSet(ctx(), 4, { rng })) counts[id[0]] = (counts[id[0]] || 0) + 1;
  assert.ok(counts.b > counts.p, JSON.stringify(counts));
  assert.ok(counts.p > 0 && counts.w > 0, JSON.stringify(counts));
});

test('pickSet returns unique unseen ids, respects the topic filter, tops up with seen questions', () => {
  const ids = P.pickSet(ctx(), 5, { rng: seeded(1) });
  assert.equal(ids.length, 5);
  assert.equal(new Set(ids).size, 5);
  const onlyProb = P.pickSet(ctx(), 3, { topic: 'Probability', rng: seeded(2) });
  assert.ok(onlyProb.every(id => id.startsWith('b')));
  const c = ctx({ pool: [q('a', 'Probability', 'Quant', 3, true), q('b', 'Probability', 'Quant', 3, false)] });
  assert.deepEqual(P.pickSet(c, 2, { rng: seeded(3) }).sort(), ['a', 'b']);
  assert.equal(P.pickSet(ctx(), 50, { rng: seeded(4) }).length, 9);
});

test('plan fits the time and follows the priorities', () => {
  const p = P.plan(ctx({ minutes: 45 }));
  assert.equal(p.items[0].id, 'weak');
  assert.equal(p.items[0].topic, 'Probability');
  assert.ok(p.used <= 45, JSON.stringify(p));
  const early = P.plan(ctx({ interviewDone: false, diagnosticDone: false, nextBlock: { key: 'Q', name: 'Quantitative Reasoning', n: 14, minutes: 30 }, pool: [] }));
  assert.deepEqual(early.items.map(i => i.id), ['interview', 'diagnostic']);
  const review = P.plan(ctx({ pendingReview: { id: 's1', label: 'Practice', n: 3 }, due: [{ qid: 'x', topic: 'Percents', nextDue: TODAY }] }));
  assert.deepEqual(review.items.slice(0, 2).map(i => i.id), ['review', 'retests']);
});

test('short days get fewer retests, and a note when the diagnostic does not fit', () => {
  const due = Array.from({ length: 12 }, (_, i) => ({ qid: 'e' + i, topic: 'Percents', nextDue: TODAY }));
  const p = P.plan(ctx({ minutes: 15, due }));
  const r = p.items.find(i => i.id === 'retests');
  assert.equal(r.arg, '5');
  assert.match(r.title, /of 12 due/);
  const d = P.plan(ctx({ minutes: 15, diagnosticDone: false, nextBlock: { key: 'V', name: 'Verbal Reasoning', n: 9, minutes: 18 } }));
  assert.match(d.items[0].why, /next longer day/);
});

test('mock readiness needs every check; the level answer never invents a score', () => {
  assert.equal(P.mockReadiness(ctx()).ready, false);
  const attempts = Array.from({ length: 70 }, (_, i) => ({ timed: true, correct: i % 4 !== 0, unanswered: false, timeSec: 110, expectedSec: 120, at: '2026-10-10T10:00:00Z', section: 'Quant', topic: 'Percents' }));
  assert.equal(P.mockReadiness(ctx({ attempts })).ready, true);
  const lvl = P.answer(ctx({ attempts }), 'level');
  assert.ok(lvl.lines.some(l => /not a GMAT score/.test(l)));
  const withEst = P.answer(ctx({ attempts, ability: { n: 70, confidence: 'medium', estimate: { total: 615, range: [585, 645], sections: [{ section: 'Quant', score: 82, range: [80, 84] }] } } }), 'level');
  assert.ok(withEst.lines.some(l => /about 615 \(range 585–645\)/.test(l)) && withEst.lines.some(l => /not a GMAT score/.test(l)));
  const withMock = P.answer(ctx({ mocks: [{ name: 'Official Practice Exam 1', total: 625, date: '2026-10-01' }] }), 'level');
  assert.ok(withMock.lines.some(l => /625/.test(l)));
});

test('improving says when there is not enough data', () => {
  const a = P.answer(ctx(), 'improving');
  assert.match(a.lines[0], /Not enough data/);
  const mk = (d, ok) => ({ at: d + 'T10:00:00Z', correct: ok, timeSec: 100, expectedSec: 120 });
  const attempts = [...Array.from({ length: 10 }, (_, i) => mk('2026-09-30', i < 5)), ...Array.from({ length: 10 }, (_, i) => mk('2026-10-15', i < 8))];
  const b = P.answer(ctx({ attempts }), 'improving');
  assert.match(b.lines[0], /80% in the last 14 days .* 50% before .* Up\./);
});

test('every coach question has an answer, even with no data', () => {
  const empty = ctx({ topics: [], pool: [], attempts: [] });
  for (const [key] of P.QUESTIONS){
    const a = P.answer(empty, key);
    assert.ok(a.title && a.lines.length, key);
  }
});

test('weakness never names a strong topic as a weakness', () => {
  const strongOnly = ctx({ topics: [topic('Percents', 'Quant', 5, { n: 30, acc: 0.93, last: '2026-10-18' })] });
  assert.match(P.answer(strongOnly, 'weakness').lines[0], /No clear weakness/);
  const mixed = P.answer(ctx(), 'weakness').lines;
  assert.match(mixed[0], /^Probability/);
  assert.ok(!mixed.some(l => /Percents/.test(l)));
});

test('a Developing topic with high accuracy is not called a weakness', () => {
  const c = ctx({ topics: [topic('Probability', 'Quant', 2, { n: 8, acc: 0.4 }), topic('CR · Weaken', 'Verbal', 3, { n: 9, acc: 1 })] });
  const lines = P.answer(c, 'weakness').lines;
  assert.ok(!lines.some(l => /CR · Weaken/.test(l)), lines.join(' | '));
  const week = P.answer(c, 'week').lines;
  assert.ok(week.some(l => /Probability/.test(l)) && !week.some(l => /CR · Weaken/.test(l)), week.join(' | '));
});

test('adaptive level: up after a right answer, more when fast and sure; down after a miss; stays in range', () => {
  assert.equal(P.levelAfter(3.5, { correct: true, timeSec: 80, expectedSec: 120, confidence: 80 }), 4.25);
  assert.equal(P.levelAfter(3.5, { correct: true, timeSec: 200, expectedSec: 120, confidence: 80 }), 3.85);
  assert.equal(P.levelAfter(3.5, { correct: false, timeSec: 80, expectedSec: 120 }), 2.75);
  assert.equal(P.levelAfter(3.5, { unanswered: true }), 2.75);
  assert.equal(P.levelAfter(5.8, { correct: true, timeSec: 60, expectedSec: 120 }), 6);
  assert.equal(P.levelAfter(1.6, { correct: false }), 1.5);
});

test('simulations start at a middle level; practice starts from mastery', () => {
  assert.equal(P.startLevel(ctx(), { exam: true }), 3.5);
  assert.equal(P.startLevel(ctx({ topics: [] }), {}), 3);
  assert.ok(P.startLevel(ctx(), { topic: 'Percents' }) > P.startLevel(ctx(), { topic: 'Probability' }));
});

test('the next question tracks the level, never repeats, and a simulation never reuses seen questions', () => {
  const pool = [1, 2, 3, 4, 5, 6].map(d => q('d' + d, 'Percents', 'Quant', d));
  const c = ctx({ pool });
  const hits = {};
  for (let i = 0; i < 300; i++){ const id = P.nextAdaptive(c, { level: 5, used: [], exam: true }, { rng: seeded(i + 1) }); hits[id] = (hits[id] || 0) + 1; }
  assert.ok(hits.d5 / 300 > 0.6, 'most picks at the level: ' + JSON.stringify(hits));
  assert.ok(!hits.d1 && (hits.d2 || 0) < 10, 'almost never 3+ levels away: ' + JSON.stringify(hits));
  assert.equal(P.nextAdaptive(c, { level: 3, used: pool.map(x => x.id), exam: true }), null);
  const seenOnly = ctx({ pool: [q('s1', 'Percents', 'Quant', 3, true)] });
  assert.equal(P.nextAdaptive(seenOnly, { level: 3, used: [], exam: true }), null);
  assert.equal(P.nextAdaptive(seenOnly, { level: 3, used: [] }), 's1');
});

test('a reading passage keeps its questions together', () => {
  const pool = [ { ...q('r1', 'RC · Main idea', 'Verbal', 3), group: 'p1' }, { ...q('r2', 'RC · Detail', 'Verbal', 4), group: 'p1' }, q('c1', 'CR · Weaken', 'Verbal', 4), q('c2', 'CR · Weaken', 'Verbal', 3) ];
  for (let i = 0; i < 20; i++) assert.equal(P.nextAdaptive(ctx({ pool }), { level: 4, used: ['r1'], exam: true, last: { group: 'p1', topic: 'RC · Main idea', correct: true } }, { rng: seeded(i + 1) }), 'r2');
});

test('simulation spreads topics; practice leans toward weak topics', () => {
  const pool = [...Array.from({ length: 6 }, (_, i) => q('p' + i, 'Percents', 'Quant', 4)), ...Array.from({ length: 6 }, (_, i) => q('b' + i, 'Probability', 'Quant', 4))];
  const c = ctx({ pool });
  let examPerc = 0, pracProb = 0;
  for (let i = 0; i < 300; i++){
    if (P.nextAdaptive(c, { level: 4, used: ['p0', 'p1', 'p2'], exam: true }, { rng: seeded(i + 7) }).startsWith('b')) examPerc++;
    if (P.nextAdaptive(c, { level: 4, used: [] }, { rng: seeded(i + 9) }).startsWith('b')) pracProb++;
  }
  assert.ok(examPerc > 200, 'after 3 Percents the simulation should move on: ' + examPerc);
  assert.ok(pracProb > 150, 'practice should favour the weak topic: ' + pracProb);
});

test('the Examiner’s focus raises a topic and a full mock enters the plan only when recommended', () => {
  const base = P.topicWeights(ctx()).find(t => t.topic === 'Percents');
  const f = P.topicWeights(ctx({ examinerFocus: ['Percents'] })).find(t => t.topic === 'Percents');
  assert.ok(f.weight > base.weight + 0.25 && f.examinerFocus && /Examiner/.test(P.reason(f)));
  const nm = ready => ({ lastFull: '2026-10-01', ready, overdue: false, days: 19, checks: [{ label: 'At least 7 days since the last full simulation (19)', pass: true }, { label: 'At least 30 questions practised since then (12)', pass: ready }] });
  const ids = over => P.plan(ctx({ minutes: 30, ...over })).items.map(i => i.id);
  assert.ok(ids({ nextMock: nm(true), mockPoolReady: true }).includes('fullmock'));
  assert.ok(!ids({ nextMock: nm(false), mockPoolReady: true }).includes('fullmock'));
  assert.ok(!ids({ nextMock: nm(true), mockPoolReady: false }).includes('fullmock'), 'no full mock without enough unseen questions');
  const m = P.answer(ctx({ nextMock: nm(false) }), 'mock');
  assert.ok(m.lines.some(l => /✗ At least 30 questions/.test(l)));
});

test('generated questions fill in, but written questions at the same level come first', () => {
  const G = require('../generators.js');
  const gen = G.candidates({ seed: 7, topic: 'Probability', per: 3 }).map(x => ({ ...x, seen: false }));
  const pool = [q('b1', 'Probability', 'Quant', 3), q('b2', 'Probability', 'Quant', 3), ...gen];
  const rng = seeded(11);
  let written = 0; const N = 400;
  for (let i = 0; i < N; i++){ const id = P.nextAdaptive(ctx({ pool }), { n: 5, topic: 'Probability', level: 3, used: [] }, { rng }); if (!G.isGenerated(id)) written++; }
  const share = 2 / (2 + gen.filter(x => x.difficulty === 3).length);
  assert.ok(written / N > share * 1.5, `written picked ${written}/${N}`);
  // with the written ones used up, a long topic set keeps going on generated questions
  const used = ['b1', 'b2']; for (let i = 0; i < 15; i++){ const id = P.nextAdaptive(ctx({ pool }), { n: 20, topic: 'Probability', level: 4, used }, { rng }); assert.ok(id && !used.includes(id)); used.push(id); }
});

test('the daily drill and Official Guide retests enter the plan', () => {
  const drill = { skill: 'fractions', name: 'Fractions', level: 2, doneToday: false, allMastered: false };
  const ids = over => P.plan(ctx({ minutes: 45, ...over })).items.map(i => i.id);
  assert.ok(ids({ drill }).includes('drill'));
  assert.ok(!ids({ drill: { ...drill, doneToday: true } }).includes('drill'), 'once a day');
  assert.ok(!ids({ drill: { ...drill, allMastered: true } }).includes('drill'));
  const it = P.plan(ctx({ minutes: 45, drill })).items.find(i => i.id === 'drill');
  assert.equal(it.act, 'startdrill'); assert.equal(it.arg, 'fractions');
  assert.ok(ids({ ogDue: 2 }).includes('ogretests'));
  assert.ok(!ids({ ogDue: 0 }).includes('ogretests'));
});
