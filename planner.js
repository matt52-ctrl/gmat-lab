/* GMAT Lab coach engine: rule-based, no AI calls.
   Reads a snapshot of the student's data (built by plannerCtx() in app.js) and decides
   what to do today, which topics need work and what the numbers say.
   Pure functions, no DOM: loaded in the browser as window.GMATPlanner and in Node by the tests. */
(function (root){
'use strict';

const LEARN_MIN = 3;        // minutes per question in learn mode, review included
const TIMED_MIN = 2.2;      // minutes per question at real test pace (about 2:09 Q, 1:57 V, 2:15 DI)
const RETEST_MIN = 3;
const STATUS_WEIGHT = [0.8, 0.9, 1.0, 0.7, 0.35, 0.15];   // by mastery status 0..5: not started … mastered

const pad = n => String(n).padStart(2, '0');
const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
function parseD(s){ const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); }
const addDays = (s, n) => { const d = parseD(s); d.setDate(d.getDate() + n); return ymd(d); };
const daysBetween = (a, b) => Math.round((parseD(b) - parseD(a)) / 86400000);
const pct = x => (x == null || isNaN(x)) ? '—' : Math.round(x * 100) + '%';
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
const accOf = list => list.length ? list.filter(a => a.correct).length / list.length : null;

function claudeFocus(ctx){
  const p = ctx.claudePlan;
  if (!p || !Array.isArray(p.focus) || !p.updatedAt || daysBetween(String(p.updatedAt).slice(0, 10), ctx.today) > 9) return [];
  return p.focus.map(f => f && f.topic).filter(Boolean);
}

/* Every topic with a weight: higher = needs more work now. Strong topics keep a small weight so they stay sharp. */
function topicWeights(ctx){
  const recentCut = addDays(ctx.today, -14);
  const focus = new Set(claudeFocus(ctx));
  return ctx.topics.map(t => {
    const qs = ctx.pool.filter(q => q.topic === t.topic);
    let recentErr = 0;
    for (const e of ctx.errors) if (e.topic === t.topic) for (const h of (e.history || [])) if (h.date >= recentCut) recentErr++;
    const staleDays = t.last ? daysBetween(String(t.last).slice(0, 10), ctx.today) : null;
    const stale = t.status >= 4 && staleDays > 14;
    const slow = t.ratio != null && t.ratio > 1.3;
    let weight = STATUS_WEIGHT[t.status] != null ? STATUS_WEIGHT[t.status] : 0.8;
    weight += Math.min(0.45, 0.15 * recentErr);
    if (slow) weight += 0.15;
    if (stale) weight += 0.25;
    if (focus.has(t.topic)) weight += 0.3;
    return { ...t, weight, recentErr, slow, stale, staleDays, claudeFocus: focus.has(t.topic), available: qs.length, unseen: qs.filter(q => !q.seen).length };
  }).sort((a, b) => b.weight - a.weight || a.topic.localeCompare(b.topic));
}

function reason(t){
  const parts = [];
  parts.push(t.n ? `${pct(t.acc)} right in ${plural(t.n, 'question')}` : 'not practised yet');
  if (t.recentErr) parts.push(`${plural(t.recentErr, 'logged error')} in the last 2 weeks`);
  if (t.slow) parts.push(`${t.ratio.toFixed(1)}× the expected time`);
  if (t.stale) parts.push(`strong, but not seen for ${t.staleDays} days`);
  if (t.claudeFocus) parts.push('in Claude’s focus for this week');
  return cap(parts.join(', ')) + '.';
}

/* A topic needs work when accuracy is low, errors are recent, it is slow, it is going stale, or Claude flagged it.
   "Developing" with high accuracy only means few questions so far. */
const needsWork = t => t.status <= 2 || (t.status === 3 && (t.acc == null || t.acc < 0.8)) || t.recentErr > 0 || t.slow || t.stale || t.claudeFocus;

const targetDifficulty = status => status <= 2 ? 3 : status === 3 ? 4 : 5;

/* Pick n question ids. Topics are drawn in proportion to their weight, with a cap per topic in mixed sets;
   within a topic, questions near the right difficulty and not seen yet are preferred. */
function pickSet(ctx, n, opts){
  opts = opts || {};
  const rng = opts.rng || Math.random;
  const W = {}; for (const t of topicWeights(ctx)) W[t.topic] = t;
  const cands = ctx.pool.filter(q => (!opts.topic || q.topic === opts.topic) && (!opts.section || q.section === opts.section));
  const unseen = cands.filter(q => !q.seen);
  let left = unseen.length >= n ? unseen.slice() : cands.slice();
  let perTopic = opts.topic ? Infinity : Math.max(2, Math.ceil(n * 0.4));
  const used = {}, out = [];
  while (out.length < n && left.length){
    const ws = left.map(q => {
      if ((used[q.topic] || 0) >= perTopic) return 0;
      const t = W[q.topic] || { weight: 0.8, status: 0 };
      const fit = 1 / (1 + Math.abs((q.difficulty || 3) - targetDifficulty(t.status)));
      return t.weight * fit * (q.seen ? 0.3 : 1);
    });
    const total = ws.reduce((a, b) => a + b, 0);
    if (!total){ if (perTopic === Infinity) break; perTopic = Infinity; continue; }
    let r = rng() * total, i = -1;
    for (let k = 0; k < ws.length; k++){ if (ws[k] <= 0) continue; i = k; if (r < ws[k]) break; r -= ws[k]; }
    const q = left[i];
    out.push(q.id); used[q.topic] = (used[q.topic] || 0) + 1; left.splice(i, 1);
  }
  return out;
}

/* ------------------------------------------------------------------ adaptive sessions
   Like the real GMAT Focus, difficulty moves question by question: up after a right answer, down after a wrong one.
   Exam mode balances content the way a test does (no weakness weighting, topics spread out); practice mode leans
   toward weak topics and, after a miss, often stays on the same topic. Reading passages keep their questions together. */
const EXAM_COUNTS = { 'Quant': 21, 'Verbal': 23, 'Data Insights': 20 };
const EXAM_MINUTES = 45;
function levelAfter(level, res){
  if (!res) return level;
  if (res.unanswered || !res.correct) return clamp(level - 0.75, 1.5, 6);
  const fast = !(res.timeSec > 1.2 * res.expectedSec), sure = res.confidence == null || res.confidence >= 60;
  return clamp(level + (fast && sure ? 0.75 : 0.35), 1.5, 6);
}
function startLevel(ctx, st){
  if (st.exam) return 3.5;                       // the real test starts everyone at a middle level
  const ts = ctx.topics.filter(t => t.n > 0 && (!st.topic || t.topic === st.topic) && (!st.section || t.section === st.section));
  const n = ts.reduce((s, t) => s + t.n, 0);
  if (!n) return 3;
  return clamp(2.5 + 0.5 * ts.reduce((s, t) => s + t.status * t.n, 0) / n, 2.5, 5);
}
function nextAdaptive(ctx, st, opts){
  const rng = (opts && opts.rng) || Math.random;
  const used = new Set(st.used || []);
  const cands = ctx.pool.filter(q => !used.has(q.id) && (!st.topic || q.topic === st.topic) && (!st.section || q.section === st.section));
  let src = cands.filter(q => !q.seen);
  if (!src.length && !st.exam) src = cands;       // practice may reuse seen questions; a simulation may not
  if (!src.length) return null;
  const last = st.last;
  if (last && last.group){ const same = src.filter(q => q.group === last.group); if (same.length) src = same; }
  else if (!st.exam && !st.topic && last && !last.correct && rng() < 0.6){ const same = src.filter(q => q.topic === last.topic); if (same.length) src = same; }
  const W = {}; if (!st.exam && !st.topic) for (const t of topicWeights(ctx)) W[t.topic] = t.weight;
  const perTopic = {}; for (const id of used){ const q = ctx.pool.find(x => x.id === id); if (q) perTopic[q.topic] = (perTopic[q.topic] || 0) + 1; }
  const ws = src.map(q => {
    const topicW = st.exam ? 1 / (1 + (perTopic[q.topic] || 0)) : st.topic ? 1 : (W[q.topic] || 0.8);
    // a simulation stays close to the estimated level, as a real adaptive test does; practice allows a little more spread
    return topicW * Math.exp(-(st.exam ? 2 : 1.2) * Math.abs((q.difficulty || 3) - st.level)) * (q.seen ? 0.3 : 1);
  });
  const total = ws.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < src.length; i++){ if (r < ws[i]) return src[i].id; r -= ws[i]; }
  return src[src.length - 1].id;
}
/* Unseen questions per section against what a simulation needs. */
function examReadiness(ctx, sections){
  return sections.map(section => { const have = ctx.pool.filter(q => q.section === section && !q.seen).length; const need = EXAM_COUNTS[section]; return { section, have, need, ok: have >= need }; });
}

/* Today's plan within the minutes available. Order: interview, unfinished review, diagnostic, retests,
   weakest topic (learn mode), then a timed mixed set with what is left. */
function plan(ctx){
  const M = ctx.minutes; let left = M; const items = [];
  const add = it => { items.push(it); left -= it.minutes || 0; };
  if (!ctx.interviewDone) add({ id:'interview', title:'Complete the interview', why:'About ten minutes on your target, background and weekly time. The plan uses it.', minutes:10, act:'tab', arg:'profile' });
  if (ctx.pendingReview){
    const n = ctx.pendingReview.n;
    add({ id:'review', title:`Finish reviewing: ${ctx.pendingReview.label}`, why:`${plural(n, 'question')} still need${n === 1 ? 's' : ''} a retry, an error type and a prevention rule.`, minutes: clamp(n * 3, 5, 45), act:'openResults', arg: ctx.pendingReview.id });
  }
  if (ctx.nextBlock){
    const b = ctx.nextBlock;
    add({ id:'diagnostic', title:`Take the ${b.name} diagnostic`, why:`${b.n} questions in ${b.minutes} minutes at real pace. Everything else adapts to it.` + (left < b.minutes ? ` It needs ${b.minutes} quiet minutes: if you don’t have them today, do it on your next longer day.` : ''), minutes: b.minutes, act:'startBlock', arg: b.key });
  }
  if (ctx.due.length && left >= RETEST_MIN){
    const k = Math.min(ctx.due.length, Math.max(1, Math.floor(left / RETEST_MIN)));
    add({ id:'retests', title:`${plural(k, 'retest')}${k < ctx.due.length ? ` of ${ctx.due.length} due` : ' due'}`, why:'A miss counts as fixed only when you get it right again days later.', minutes: k * RETEST_MIN, act:'startRetests', arg: String(k) });
  }
  const weights = topicWeights(ctx);
  const top = weights.find(t => t.unseen > 0);
  if (top && left >= 2 * LEARN_MIN){
    const n = Math.min(top.unseen, 10, Math.max(2, Math.floor(left * 0.55 / LEARN_MIN)));
    add({ id:'weak', title:`Practice ${top.topic}`, why: reason(top) + ' Learn mode: feedback and review after each question.', minutes: n * LEARN_MIN, act:'startsmart', arg:`learn|${top.topic}|${n}`, topic: top.topic });
  }
  const unseenLeft = ctx.pool.filter(q => !q.seen && !(top && items.some(i => i.id === 'weak') && q.topic === top.topic)).length;
  if (left >= 3 * TIMED_MIN && unseenLeft >= 3){
    const n = Math.min(unseenLeft, 20, Math.floor(left / TIMED_MIN));
    add({ id:'mixed', title:`Timed mixed set · ${plural(n, 'question')}`, why:'Real pace. Weighted toward your weaker topics, with a few strong ones to keep them sharp.', minutes: Math.round(n * TIMED_MIN), act:'startsmart', arg:`timed||${n}` });
  }
  if (ctx.diagnosticDone && ctx.phase === 0 && !claudeFocus(ctx).length)
    add({ id:'analyse', title:'Ask Claude to analyse your diagnostic', why:'Write “analizza il diagnostic” to Claude, with GitHub sync on (or attach a backup). Claude builds your profile, your plan and new questions on your weak topics.', minutes:0 });
  else if (ctx.diagnosticDone && !ctx.pool.some(q => !q.seen))
    add({ id:'more', title:'You have seen every practice question', why:'Write “nuove domande” to Claude, or wait for tomorrow morning’s review: it adds questions on your weak topics.', minutes:0 });
  const mr = mockReadiness(ctx);
  const lastMock = ctx.mocks.map(m => m.date).sort().pop();
  if (mr.ready && (!lastMock || daysBetween(lastMock, ctx.today) >= 14))
    add({ id:'mock', title:'Plan an official practice exam this week', why:'Your timed numbers are steady enough for a full mock to be informative. Log the result in Mocks.', minutes:0 });
  if (!items.length) add({ id:'rest', title:'Nothing urgent today', why:'No reviews, retests or unseen questions are waiting. Rest, or read the Official Guide chapter for your weakest topic.', minutes:0 });
  return { minutes: M, used: M - Math.max(0, left), items };
}

/* ------------------------------------------------------------------ analysis */
function errorStats(ctx){
  const hist = [];
  for (const e of ctx.errors) for (const h of (e.history || [])) hist.push({ ...h, topic: e.topic });
  const byType = {}, combo = {};
  for (const h of hist){ byType[h.errorType] = (byType[h.errorType] || 0) + 1; const k = h.topic + ' · ' + h.errorType; combo[k] = (combo[k] || 0) + 1; }
  const types = Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([type, n]) => ({ type, n, share: n / hist.length }));
  const combos = Object.entries(combo).filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ label: k, n }));
  const repeated = ctx.errors.filter(e => (e.count || 0) > 1 || (e.relapses || 0) > 0);
  return { total: hist.length, types, combos, repeated };
}
function trend(ctx){
  const cut1 = addDays(ctx.today, -14), cut2 = addDays(ctx.today, -28);
  const recent = ctx.attempts.filter(a => String(a.at).slice(0, 10) > cut1);
  const prev = ctx.attempts.filter(a => { const d = String(a.at).slice(0, 10); return d > cut2 && d <= cut1; });
  const pace = list => { const x = list.filter(a => !a.unanswered && a.timeSec > 0 && a.expectedSec); return x.length ? x.reduce((s, a) => s + a.timeSec / a.expectedSec, 0) / x.length : null; };
  return { recent: { n: recent.length, acc: accOf(recent), pace: pace(recent) }, prev: { n: prev.length, acc: accOf(prev), pace: pace(prev) }, enough: recent.length >= 8 && prev.length >= 8 };
}
function mockReadiness(ctx){
  const timed = ctx.attempts.filter(a => a.timed);
  const last40 = timed.slice(-40);
  const answered = last40.filter(a => !a.unanswered && a.timeSec > 0 && a.expectedSec);
  const pace = answered.length ? answered.reduce((s, a) => s + a.timeSec / a.expectedSec, 0) / answered.length : null;
  const overdue = ctx.due.filter(e => e.nextDue && e.nextDue < ctx.today).length;
  const checks = [
    { ok: ctx.diagnosticDone, text: 'All three diagnostic blocks taken' },
    { ok: timed.length >= 60, text: `At least 60 timed questions answered (${timed.length} so far)` },
    { ok: last40.length >= 20 && accOf(last40) >= 0.6, text: `60%+ right on your last 40 timed questions (${last40.length >= 20 ? pct(accOf(last40)) : 'not enough yet'})` },
    { ok: pace != null && pace <= 1.1, text: `Timed pace within 1.1× the real pace (${pace == null ? '—' : pace.toFixed(2) + '×'})` },
    { ok: overdue <= 5, text: `No more than 5 overdue retests (${overdue})` },
  ];
  return { ready: checks.every(c => c.ok), checks };
}
function sectionStats(ctx){
  return ['Quant', 'Data Insights', 'Verbal'].map(section => {
    const a = ctx.attempts.filter(x => x.section === section);
    const hard = a.filter(x => (x.difficulty || 0) >= 4);
    return { section, n: a.length, acc: accOf(a), hardN: hard.length, hardAcc: accOf(hard) };
  });
}
function weekSplit(ctx){
  const hours = Number(ctx.hoursPerWeek) || 8;
  const weak = topicWeights(ctx).filter(t => (t.unseen > 0 || t.n > 0) && needsWork(t)).slice(0, 3);
  const rows = [];
  const retests = ctx.due.length ? 0.1 : 0.05;
  rows.push({ label: 'Retests and reviews', hours: hours * (retests + 0.1) });
  rows.push({ label: 'Timed mixed sets', hours: hours * 0.25 });
  const rest = hours - rows.reduce((s, r) => s + r.hours, 0);
  if (weak.length){
    const tw = weak.reduce((s, t) => s + t.weight, 0);
    for (const t of weak) rows.push({ label: t.topic, hours: rest * 0.8 * t.weight / tw, why: reason(t) });
    rows.push({ label: 'Official Guide reading on those topics', hours: rest * 0.2 });
  } else rows.push({ label: ctx.attempts.length ? 'More timed mixed sets at harder levels' : 'Diagnostic and first practice sets', hours: rest });
  return { hours, rows: rows.map(r => ({ ...r, hours: Math.round(r.hours * 2) / 2 })).filter(r => r.hours > 0) };
}

/* Answers to the coach's fixed questions, as plain text lines. */
const QUESTIONS = [
  ['today', 'What should I study today?'],
  ['weakness', 'What is my main weakness?'],
  ['improving', 'Am I improving?'],
  ['mistakes', 'Which mistakes do I repeat?'],
  ['mock', 'Am I ready for a mock?'],
  ['level', 'What is my level?'],
  ['week', 'How should I spread this week’s hours?'],
];
function answer(ctx, key){
  const L = [];
  const n = ctx.attempts.length;
  if (key === 'today'){
    const p = plan(ctx);
    for (const it of p.items) L.push(`${it.title}${it.minutes ? ` (~${it.minutes} min)` : ''}: ${it.why}`);
  }
  if (key === 'weakness'){
    const seen = topicWeights(ctx).filter(t => t.n > 0 || t.recentErr);
    const w = seen.filter(needsWork);
    if (!seen.length) L.push('Not enough data yet. The diagnostic shows where you start; after it this answer names your weakest topics.');
    else if (!w.length) L.push('No clear weakness right now: every topic you have practised is Strong or Mastered. Keep them warm with timed mixed sets and try harder levels.');
    else {
      L.push(`${w[0].topic}: ${reason(w[0])}`);
      for (const t of w.slice(1, 3)) L.push(`Then ${t.topic}: ${reason(t)}`);
      const es = errorStats(ctx);
      if (es.total >= 3) L.push(`Your most common error type is ${es.types[0].type} (${es.types[0].n} of ${es.total} logged errors).`);
    }
  }
  if (key === 'improving'){
    const t = trend(ctx);
    if (!t.enough) L.push(`Not enough data to tell yet: this needs at least 8 questions in each of the last two fortnights (you have ${t.recent.n} in the last 14 days and ${t.prev.n} in the 14 before).`);
    else {
      const d = t.recent.acc - t.prev.acc;
      L.push(`Accuracy: ${pct(t.recent.acc)} in the last 14 days (${t.recent.n} questions) against ${pct(t.prev.acc)} before (${t.prev.n}). ${Math.abs(d) < 0.05 ? 'About the same.' : d > 0 ? 'Up.' : 'Down: check whether the questions got harder.'}`);
      if (t.recent.pace && t.prev.pace) L.push(`Time: ${t.recent.pace.toFixed(2)}× the expected time, against ${t.prev.pace.toFixed(2)}× before.`);
    }
  }
  if (key === 'mistakes'){
    const es = errorStats(ctx);
    if (!es.total) L.push('No errors logged yet. They are logged when you review a session.');
    else {
      L.push('By type: ' + es.types.slice(0, 4).map(x => `${x.type} ${x.n}`).join(', ') + '.');
      for (const c of es.combos.slice(0, 3)) L.push(`${c.label}: ${plural(c.n, 'time')}.`);
      if (es.repeated.length) L.push(`${plural(es.repeated.length, 'question')} missed more than once: ${es.repeated.slice(0, 3).map(e => e.topic).join(', ')}.`);
      const withRule = ctx.errors.filter(e => e.prevention).slice(-1)[0];
      if (withRule) L.push(`Your latest prevention rule: “${withRule.prevention}”`);
    }
  }
  if (key === 'mock'){
    const mr = mockReadiness(ctx);
    L.push(mr.ready ? 'Yes: a full official practice exam would be informative now.' : 'Not yet. A mock is most useful when these are true:');
    for (const c of mr.checks) L.push(`${c.ok ? '✓' : '✗'} ${c.text}`);
    L.push('These thresholds are GMAT Lab’s rule of thumb, not an official standard.');
  }
  if (key === 'level'){
    const official = ctx.mocks.filter(m => /official/i.test(m.name || '')).sort((a, b) => String(a.date).localeCompare(String(b.date))).pop();
    L.push('GMAT Lab does not turn its own questions into a GMAT score: there are too few of them and they are not calibrated on real test takers, so any number would be a guess.');
    L.push(official ? `Your best estimate is your latest official practice exam: ${official.total} (${official.name}, ${official.date}).` : 'Your first real estimate will come from an official practice exam.');
    for (const s of sectionStats(ctx)) if (s.n) L.push(`${s.section}: ${pct(s.acc)} right in ${plural(s.n, 'question')}${s.hardN ? `; ${pct(s.hardAcc)} at level 4+ (${s.hardN})` : ''}.`);
    if (!n) L.push('No answers yet: start with the diagnostic.');
  }
  if (key === 'week'){
    const ws = weekSplit(ctx);
    L.push(`About ${ws.hours} hours this week${ctx.hoursPerWeek ? ' (from your interview)' : ' (set your hours in the interview)'}:`);
    for (const r of ws.rows) L.push(`${r.hours} h · ${r.label}${r.why ? ` — ${r.why}` : ''}`);
  }
  return { title: (QUESTIONS.find(q => q[0] === key) || [key, key])[1], lines: L };
}

const api = { topicWeights, pickSet, plan, answer, QUESTIONS, mockReadiness, trend, errorStats, weekSplit, reason, levelAfter, startLevel, nextAdaptive, examReadiness, EXAM_COUNTS, EXAM_MINUTES };
root.GMATPlanner = api;
if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
