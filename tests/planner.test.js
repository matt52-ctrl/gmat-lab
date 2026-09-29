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
  assert.ok(lvl.lines.some(l => /does not turn its own questions into a GMAT score/.test(l)));
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
