/* GMAT Lab exam engine: the parts of a mock exam that are not screens. Pure functions, no DOM, no storage.
   Exam Specification (exam-spec.js) → Blueprint → Question Selection → [Mock Exam Engine: app.js] → Scoring
   → Performance Analyzer → User Ability Model → Examiner (study-plan signals, readiness).
   Item model: 3-parameter logistic IRT. Each question has a discrimination a, a difficulty b on the ability scale and a
   guessing floor c, from its own `irt` field when calibrated, otherwise from its difficulty and type (see the spec).
   Loaded as window.GMATEngine in the browser; module.exports in Node. */
(function (root){
'use strict';

const D = 1.7;
const sum = a => a.reduce((s, v) => s + v, 0);
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const round = (x, dp) => { const k = Math.pow(10, dp || 0); return Math.round(x * k) / k; };
const pctText = x => x == null ? '—' : Math.round(100 * x) + '%';
const fmtSec = s => { s = Math.max(0, Math.round(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const daysBetween = (a, b) => Math.round((Date.parse(String(b).slice(0, 10)) - Date.parse(String(a).slice(0, 10))) / 86400000);
const ord = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
const sd = a => { if (a.length < 2) return null; const m = sum(a) / a.length; return Math.sqrt(sum(a.map(x => (x - m) * (x - m))) / (a.length - 1)); };

/* ------------------------------------------------------------------ item model */
function sectionSpec(spec, key){ return spec.sections.find(s => s.id === key || s.section === key || s.name === key) || null; }
function topicGroup(spec, topic){ for (const [g, list] of Object.entries(spec.topicGroups || {})) if (list.includes(topic)) return g; return topic; }
/* IRT parameters of a question, or of a pool entry that has only type, difficulty and topic. */
function itemParams(spec, q){
  const t = spec.questionTypes[q.type] || { discrimination: 1, guessing: 0.2 };
  const s = q.difficultyScore != null ? clamp(q.difficultyScore, 0, 1) : spec.difficultyScale.fromLevel(q.difficulty || 3);
  const irt = q.irt || {};
  let c = irt.c;
  if (c == null) c = Array.isArray(q.parts) && q.parts.length ? q.parts.reduce((p, x) => p / Math.max(2, x.options.length), 1) : (q.choices || q.type === 'DS' ? 0.2 : t.guessing);
  return { id: q.id, a: irt.a != null ? irt.a : t.discrimination, b: irt.b != null ? irt.b : spec.difficultyScale.toTheta(s), c, s,
    type: q.type, topic: q.topic, section: q.section, group: q.group || null, est: q.expectedSec || q.est || 120 };
}
function prob(theta, it){ return it.c + (1 - it.c) / (1 + Math.exp(-D * it.a * (theta - it.b))); }
function info(theta, it){ const p = prob(theta, it); return Math.pow(D * it.a, 2) * ((1 - p) / p) * Math.pow((p - it.c) / (1 - it.c), 2); }
/* Expected a posteriori ability from responses [{ it, y, w }] (w = weight, default 1) and a normal prior. */
function eap(spec, resp, prior){
  const g = spec.scoringRules.grid, pts = [];
  for (let th = g.from; th <= g.to + 1e-9; th += g.step) pts.push(th);
  const logs = pts.map(th => { let l = -0.5 * Math.pow((th - prior.mean) / prior.sd, 2); for (const r of resp){ const p = prob(th, r.it), w = r.w == null ? 1 : r.w; l += w * (r.y ? Math.log(p) : Math.log(1 - p)); } return l; });
  const mx = Math.max(...logs), ws = logs.map(l => Math.exp(l - mx)), tot = sum(ws);
  const mean = sum(ws.map((w, i) => w * pts[i])) / tot;
  const v = sum(ws.map((w, i) => w * Math.pow(pts[i] - mean, 2))) / tot;
  return { theta: mean, se: Math.sqrt(v), n: resp.length };
}

/* ------------------------------------------------------------------ scoring */
function thetaToSection(spec, theta){
  const A = spec.scoringRules.sectionScale.anchors;
  if (theta <= A[0][0]) return A[0][1];
  for (let i = 1; i < A.length; i++) if (theta <= A[i][0]) return A[i - 1][1] + (theta - A[i - 1][0]) / (A[i][0] - A[i - 1][0]) * (A[i][1] - A[i - 1][1]);
  return A[A.length - 1][1];
}
/* A section score with its range. Questions left unanswered when time ran out count as wrong answers at the level reached. */
function scoreSection(spec, responses, missing){
  const pr = spec.scoringRules.prior, z = spec.scoringRules.rangeZ;
  let est = eap(spec, responses, pr);
  const extra = [];
  if (missing > 0){
    for (let i = 0; i < missing; i++) extra.push({ it: { a: 1, b: est.theta, c: 0.2 }, y: 0 });
    est = eap(spec, responses.concat(extra), pr);
  }
  const sc = th => Math.round(thetaToSection(spec, th));
  return { theta: round(est.theta, 3), se: round(est.se, 3), score: sc(est.theta), range: [sc(est.theta - z * est.se), sc(est.theta + z * est.se)], n: responses.length + missing, missing };
}
function totalFromSections(spec, scores){
  const T = spec.scoringRules.totalScale;
  const conv = s => clamp(T.min + T.step * Math.round((s - T.sectionSumMin) * (T.max - T.min) / (T.sectionSumMax - T.sectionSumMin) / T.step), T.min, T.max);
  return conv;
}
function scoreTotal(spec, sections){
  if (sections.length !== spec.sections.length) return null;
  const conv = totalFromSections(spec, sections.map(s => s.score));
  const s = sum(sections.map(x => x.score));
  const half = Math.sqrt(sum(sections.map(x => Math.pow((x.range[1] - x.range[0]) / 2, 2))));
  return { total: conv(s), range: [conv(s - half), conv(s + half)] };
}

/* ------------------------------------------------------------------ duplicates */
const STOP = new Set('the a an of to in and or for on at by with from that this is are was were be been it its as which what if then than not no any each all into over after before more most less least'.split(' '));
function textFeatures(text){
  const w = String(text || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(x => x && !STOP.has(x));
  const f = new Set(); for (let i = 0; i + 2 < w.length; i++) f.add(w[i] + ' ' + w[i + 1] + ' ' + w[i + 2]);
  return [...f];
}
/* Features that describe the underlying problem. The first one is the core: two questions with the same core are the same problem. */
function features(q){
  if (q.template) return [q.template + (q.sig && q.sig.length ? ':' + q.sig[0] : ''), ...(q.sig || []).slice(1).map(x => 'k:' + q.template + ':' + x)];
  const body = [q.stem, ...(q.choices || []), ...(q.statements || []), ...((q.parts || []).map(p => p.label))].join(' ');
  return ['w:' + q.id, ...textFeatures(body)];
}
function jaccard(a, b){ const A = new Set(a), B = new Set(b); let i = 0; for (const x of A) if (B.has(x)) i++; const u = A.size + B.size - i; return u ? i / u : 0; }
function isDuplicate(spec, fa, fb){ return fa[0] === fb[0] || jaccard(fa.slice(1), fb.slice(1)) >= spec.adaptiveRules.similarity; }

/* ------------------------------------------------------------------ blueprint */
/* ability: from abilityModel() (may be null). Returns the plan the selection engine must respect. */
function blueprint(spec, modeId, sectionIds, ability){
  const mode = spec.modes.find(m => m.id === modeId) || spec.modes[0];
  const AR = spec.adaptiveRules.start;
  return { mode: mode.id, modeName: mode.name, spec: spec.examName + ' ' + spec.version, timed: mode.timed, comparable: mode.comparable,
    sections: sectionIds.map(id => {
      const s = sectionSpec(spec, id);
      const cats = JSON.parse(JSON.stringify(s.categories));
      const secAb = ability && ability.sections[s.section];
      const start = secAb && secAb.n >= 5 ? clamp(secAb.theta * AR.shrink, AR.clamp[0], AR.clamp[1]) : 0;
      let weakTopics = [];
      if (ability) weakTopics = Object.entries(ability.topics).filter(([t, v]) => v.section === s.section && v.n >= 2).sort((x, y) => x[1].theta - y[1].theta).slice(0, 3).map(([t]) => t);
      if (mode.blueprint === 'weakness' && weakTopics.length){
        const weakCats = [...new Set(weakTopics.map(t => categoryOfTopic(spec, s, t)))].filter(c => cats[c]).slice(0, 2);
        for (const c of weakCats){ cats[c][1] = Math.min(s.questionCount, cats[c][1] + 3); cats[c][0] = Math.min(cats[c][1], cats[c][0] + 3); }
        const others = Object.keys(cats).filter(c => !weakCats.includes(c));
        while (sum(Object.values(cats).map(v => v[0])) > s.questionCount){ const c = others.find(o => cats[o][0] > 0); if (!c) break; cats[c][0]--; }
      }
      return { id: s.id, section: s.section, name: s.name, questionCount: s.questionCount, duration: mode.timed ? s.duration : null, questionTypes: s.questionTypes,
        categoryOf: s.categoryOf, categories: cats, topicCap: s.topicCap, passageSize: s.passageSize || null, weakTopics: mode.blueprint === 'weakness' ? weakTopics : [],
        difficulty: { model: 'adaptive', start: round(start, 2), band: 1 }, calculator: s.calculator,
        estimatedTime: null };
    }) };
}
/* Which blueprint category a topic falls in (Verbal and DI balance by type, Quant by topic group). */
function categoryOfTopic(spec, sec, topic){
  if (sec.categoryOf === 'topicGroup') return topicGroup(spec, topic);
  if (sec.section === 'Verbal') return /^CR/.test(topic) ? 'CR' : 'RC';
  return { 'Data Sufficiency': 'DS', 'Two-Part Analysis': 'TPA', 'Table Analysis': 'TA', 'Graphics Interpretation': 'GI', 'Multi-Source Reasoning': 'MSR' }[topic] || topic;
}
function categoryOfItem(spec, bpSec, it){ return bpSec.categoryOf === 'topicGroup' ? topicGroup(spec, it.topic) : it.type; }

/* ------------------------------------------------------------------ question selection (computerized adaptive testing) */
function newSectionState(bpSec){ return { bp: bpSec, theta: bpSec.difficulty.start, se: 1, items: [], resp: [], queue: [], counts: {}, topics: {}, letters: [], feats: [], used: [] }; }
/* Choose the next question for a section.
   pool: item params (itemParams) of every question allowed in this section; opts: { rng, describe(id) → { features, letter } | null, taken: Set of ids used elsewhere in the mock }. */
function selectNext(spec, st, pool, opts){
  const bp = st.bp, N = bp.questionCount, rng = opts.rng || Math.random, taken = opts.taken || new Set();
  if (st.items.length >= N) return null;
  while (st.queue.length){ const id = st.queue.shift(); const it = pool.find(x => x.id === id); if (it && !st.used.includes(id)){ commit(spec, st, it, opts); return id; } }
  const remaining = N - st.items.length, used = new Set([...st.used, ...taken]), ps = bp.passageSize || [3, 4];
  const units = [], groups = {};
  for (const it of pool){
    if (used.has(it.id)) continue;
    if (it.group) (groups[it.group] = groups[it.group] || []).push(it); else units.push({ items: [it], group: false });
  }
  for (const g of Object.values(groups)) if (g.length >= ps[0]) units.push({ items: g.slice(0, ps[1]), group: true });
  const cats = bp.categories;
  const need = counts => sum(Object.entries(cats).map(([c, [mn]]) => Math.max(0, mn - (counts[c] || 0))));
  const fits = u => {
    const c = categoryOfItem(spec, bp, u.items[0]);
    if (!cats[c]) return false;
    const room = Math.min(cats[c][1] - (st.counts[c] || 0), remaining);
    const k = u.group ? Math.min(u.items.length, room) : 1;
    if (room < 1 || (u.group && k < ps[0])) return false;
    if (need({ ...st.counts, [c]: (st.counts[c] || 0) + k }) > remaining - k) return false;
    if (!u.group){ const cap = bp.topicCap + (bp.weakTopics.includes(u.items[0].topic) ? 1 : 0); if ((st.topics[u.items[0].topic] || 0) >= cap) return false; }
    u.take = k;
    return true;
  };
  const ranked = units.filter(fits);
  // Two stages, as in content-balanced adaptive tests: first the content category (weighted by what the blueprint still
  // needs, so categories spread through the section in no fixed order), then the most informative question in it.
  const byCat = {};
  for (const u of ranked){
    const its = u.items.slice(0, u.take), c = categoryOfItem(spec, bp, u.items[0]);
    u.score = sum(its.map(it => info(st.theta, it))) / its.length * (bp.weakTopics.includes(u.items[0].topic) ? 1.6 : 1);
    (byCat[c] = byCat[c] || []).push(u);
  }
  if (!st.target) st.target = planTargets(bp, rng);
  const lastIt = st.items[st.items.length - 1], lastGroup = lastIt && lastIt.group ? categoryOfItem(spec, bp, lastIt) : null;
  const short = Object.keys(byCat).filter(c => (st.counts[c] || 0) < cats[c][0]);
  const forced = need(st.counts) >= remaining;
  const K = Math.max(1, spec.adaptiveRules.randomesque);
  let catList = forced ? short.filter(c => byCat[c]) : Object.keys(byCat);
  // Each category is drawn in proportion to the units it still needs for this section's plan (a reading passage is one
  // unit of 3–4 questions), so categories mix evenly through the section. Two passages come back to back only when
  // nothing else fits.
  const unitSize = c => sum(byCat[c].map(u => u.take)) / byCat[c].length;
  while (catList.length){
    const w = catList.map(c => Math.max(0.15, (st.target[c] - (st.counts[c] || 0)) / unitSize(c)) * (c === lastGroup && catList.length > 1 ? 0 : 1));
    let r = rng() * sum(w), ci = 0;
    for (; ci < catList.length - 1; ci++){ if (r < w[ci]) break; r -= w[ci]; }
    const c = catList[ci], list = byCat[c].sort((x, y) => y.score - x.score);
    while (list.length){
      const top = list.slice(0, K), tot = sum(top.map(u => u.score)) || 1;
      let r2 = rng() * tot, i = 0;
      for (; i < top.length - 1; i++){ if (r2 < top[i].score) break; r2 -= top[i].score; }
      const u = top[i];
      if (acceptable(spec, st, u, opts)){
        const ids = u.items.slice(0, u.take).map(x => x.id);
        commit(spec, st, u.items[0], opts);
        st.queue = ids.slice(1);
        return ids[0];
      }
      list.splice(list.indexOf(u), 1);
    }
    catList.splice(ci, 1);
  }
  return null;
}
/* How many questions of each category this section will have: the blueprint's minimums, the rest spread at random within
   the maximums. Drawn once per section, so two mocks rarely share the same mix. */
function planTargets(bp, rng){
  const cats = bp.categories, t = {}; let left = bp.questionCount;
  for (const [c, [mn]] of Object.entries(cats)){ t[c] = mn; left -= mn; }
  while (left > 0){
    const open = Object.keys(cats).filter(c => t[c] < cats[c][1]); if (!open.length) break;
    const w = open.map(c => cats[c][1] - t[c]); let r = rng() * sum(w), i = 0;
    for (; i < open.length - 1; i++){ if (r < w[i]) break; r -= w[i]; }
    t[open[i]]++; left--;
  }
  return t;
}
function acceptable(spec, st, u, opts){
  if (!opts.describe) return true;
  const d = opts.describe(u.items[0].id);
  if (!d) return false;
  if (st.feats.some(f => isDuplicate(spec, f, d.features))) return false;
  const run = spec.adaptiveRules.maxSameAnswerRun;
  if (d.letter && st.letters.length >= run && st.letters.slice(-run).every(l => l === d.letter)) return false;
  return true;
}
function commit(spec, st, it, opts){
  const c = categoryOfItem(spec, st.bp, it);
  st.items.push(it); st.used.push(it.id);
  st.counts[c] = (st.counts[c] || 0) + 1;
  st.topics[it.topic] = (st.topics[it.topic] || 0) + 1;
  const d = opts.describe ? opts.describe(it.id) : null;
  if (d){ st.feats.push(d.features); st.letters.push(d.letter || '-'); }
}
/* After an answer: update the provisional ability used to choose the next question. */
function record(spec, st, id, correct){
  const it = st.items.find(x => x.id === id); if (!it) return st;
  st.resp.push({ it, y: correct ? 1 : 0 });
  const e = eap(spec, st.resp, { mean: st.bp.difficulty.start, sd: spec.adaptiveRules.selectionPrior.sd });
  st.theta = e.theta; st.se = e.se;
  return st;
}

/* ------------------------------------------------------------------ performance analyzer */
/* sec: { section, attempts: [{ qid, correct, unanswered, timeSec, expectedSec, difficulty, topic, type, skill, changes, edited, changedFrom }],
   params: { qid → itemParams }, durationSec, limitSec, theta } */
function analyzeSection(spec, sec){
  const A = spec.timingRules.analysis, at = sec.attempts, ans = at.filter(a => !a.unanswered);
  const th = sec.theta || 0, P = id => sec.params[id] || { b: 0 };
  const acc = list => list.length ? list.filter(a => a.correct).length / list.length : null;
  const time = sum(ans.map(a => a.timeSec || 0)), expd = sum(ans.map(a => a.expectedSec || 0));
  const lost = sum(at.filter(a => !a.correct && !a.unanswered).map(a => Math.max(0, (a.timeSec || 0) - (a.expectedSec || 0))));
  const rel = a => P(a.qid).b - th;
  const bands = [['Below your level', a => rel(a) < -0.5], ['At your level', a => Math.abs(rel(a)) <= 0.5], ['Above your level', a => rel(a) > 0.5]]
    .map(([label, f]) => { const l = ans.filter(f); return { label, n: l.length, acc: acc(l) }; });
  const by = key => { const m = {}; for (const a of at){ const k = a[key] || '—'; (m[k] = m[k] || []).push(a); } return Object.entries(m).map(([k, l]) => ({ key: k, n: l.length, correct: l.filter(a => a.correct).length, acc: acc(l), ratio: sum(l.filter(a => !a.unanswered).map(a => a.timeSec || 0)) / (sum(l.filter(a => !a.unanswered).map(a => a.expectedSec || 0)) || 1) })).sort((x, y) => (x.acc == null ? 1 : x.acc) - (y.acc == null ? 1 : y.acc) || y.n - x.n); };
  const patterns = [];
  for (const t of by('type')) if (t.n >= 2 && t.ratio > A.slowTypeRatio) patterns.push({ id: 'slowType', text: `${t.key}: ${t.ratio.toFixed(1)}× the expected time per question (${t.n} questions).`, severity: 2 });
  const rush = ans.filter(a => rel(a) > 0.3 && a.timeSec < A.rushRatio * a.expectedSec);
  if (rush.length >= 2 && rush.filter(a => !a.correct).length >= Math.ceil(rush.length / 2)) patterns.push({ id: 'rushHard', text: `On ${rush.length} questions above your level you answered in under ${Math.round(A.rushRatio * 100)}% of the expected time, and missed ${rush.filter(a => !a.correct).length}.`, severity: 3 });
  const n = at.length, cut = Math.max(1, Math.round(n * A.earlyPart));
  const early = sum(at.slice(0, cut).map(a => a.timeSec || 0)), used = sec.durationSec || time;
  if (n >= 6 && used > 0 && early / used > A.earlyShare) patterns.push({ id: 'earlyOverspend', text: `The first ${cut} questions took ${pctText(early / used)} of your time (about ${pctText(A.earlyPart)} would be even).`, severity: 2 });
  const tail = Math.max(2, Math.round(n * A.endgamePart)), head = at.slice(0, n - tail), end = at.slice(n - tail);
  const un = at.filter(a => a.unanswered).length;
  if (n >= 8 && (acc(head) - acc(end) >= A.endgameDrop || un)) patterns.push({ id: 'endgame', text: un ? `${un} question${un > 1 ? 's' : ''} left unanswered when time ran out; accuracy on the last ${tail} was ${pctText(acc(end))}.` : `Accuracy fell from ${pctText(acc(head))} to ${pctText(acc(end))} in the last ${tail} questions.`, severity: 3 });
  const eff = time ? expd / time : null;
  if (acc(ans) >= 0.7 && eff != null && eff < A.lowEfficiency) patterns.push({ id: 'accurateSlow', text: `High accuracy (${pctText(acc(ans))}) but ${(1 / eff).toFixed(2)}× the expected time per question: speed, not knowledge, is the limit.`, severity: 2 });
  at.forEach((a, i) => { if (!a.unanswered && a.timeSec > A.stuckRatio * a.expectedSec) patterns.push({ id: 'stuck', text: `Question ${i + 1} took ${fmtSec(a.timeSec)}, ${(a.timeSec / a.expectedSec).toFixed(1)}× the expected time.`, severity: 1, index: i }); });
  const changed = at.filter(a => a.changes > 0).length, edits = at.filter(a => a.edited && a.changedFrom != null);
  return {
    section: sec.section, n, answered: ans.length, correct: at.filter(a => a.correct).length, accuracy: acc(at), unanswered: un,
    avgTime: ans.length ? time / ans.length : null, timeUsed: sec.durationSec, timeLimit: sec.limitSec, timeRemaining: sec.limitSec ? Math.max(0, sec.limitSec - (sec.durationSec || 0)) : null,
    timeEfficiency: eff, timeLost: lost, difficulty: bands, avgDifficulty: ans.length ? sum(ans.map(a => P(a.qid).s || 0)) / ans.length : null,
    topics: by('topic'), skills: by('skill'), types: by('type'), patterns: patterns.sort((x, y) => y.severity - x.severity),
    changes: { questionsWithChanges: changed, edits: edits.length },
  };
}
/* Every missed or unanswered question, classified and explained: what happened, why, the skill, the pattern, the fix, the next exercise.
   q(qid) returns the question; history: [{ topic, category, date }] from earlier mocks and the error log; ability: abilityModel(). */
function classifyErrors(spec, sec, q, ability, history){
  const A = spec.timingRules.analysis, cats = spec.errorCategories, L = 'ABCDE';
  const catOf = type => Object.keys(cats).find(k => cats[k].from.includes(type)) || null;
  const secTheta = ability && ability.sections[sec.section] ? ability.sections[sec.section].theta : (sec.theta || 0);
  const out = [];
  sec.attempts.forEach((a, i) => {
    if (a.correct) return;
    const Q = q(a.qid); if (!Q) return;
    const topicAb = ability && ability.topics[a.topic];
    let diag = [];
    if (!a.unanswered && a.answer != null){
      if (Array.isArray(Q.parts)) Q.parts.forEach((p, k) => { const v = Array.isArray(a.answer) ? a.answer[k] : null; if (Number.isInteger(v) && v !== p.answer && p.diagnosis && p.diagnosis[v]) diag.push({ ...p.diagnosis[v], part: p.label, pick: p.options[v] }); });
      else if (Q.diagnosis && Q.diagnosis[a.answer]) diag.push({ ...Q.diagnosis[a.answer], pick: L[a.answer] });
    }
    const fast = !a.unanswered && a.timeSec < A.guessRatio * a.expectedSec, slow = !a.unanswered && a.timeSec > A.overtimeRatio * a.expectedSec;
    let category, why;
    if (a.unanswered){ category = 'Timing Error'; why = 'Time ran out before you reached it: the section ended with it unanswered, which counts as wrong.'; }
    else if (fast){ category = 'Guessing'; why = `You answered in ${fmtSec(a.timeSec)}, under ${Math.round(A.guessRatio * 100)}% of the expected ${fmtSec(a.expectedSec)}: too fast to have solved it.`; }
    else {
      category = (diag[0] && catOf(diag[0].type)) || 'Conceptual Error';
      why = diag[0] ? `The option you chose is the one this mistake produces (${diag[0].type.toLowerCase()} slip).` : 'The answer you gave does not follow from the correct method.';
      if (topicAb && topicAb.n >= 3 && topicAb.theta < secTheta - 0.75 && ['Conceptual Error', 'Knowledge Gap'].includes(category)){ category = 'Knowledge Gap'; why = `Your ability estimate on ${a.topic} is well below your ${sec.section} level, so this is more than a one-off slip.`; }
      if (slow) why += ` It also took ${fmtSec(a.timeSec)}, ${(a.timeSec / a.expectedSec).toFixed(1)}× the expected time.`;
    }
    const right = Array.isArray(Q.parts) ? Q.parts.map(p => p.options[p.answer]).join(' · ') : L[Q.answer];
    const yours = diag.length && diag[0].part ? diag.map(d => `${d.pick} for “${d.part}”`).join('; ') : Array.isArray(a.answer) ? a.answer.map((v, k) => Q.parts[k].options[v]).join(' · ') : L[a.answer];
    const what = a.unanswered ? `Not answered. The right answer is ${right}.` : `You answered ${yours}; the right answer is ${right}.${diag.length ? ' ' + diag.map(d => d.why).join(' ') : ''}`;
    const same = history.filter(h => h.topic === a.topic && h.category === category).length + out.filter(e => e.topic === a.topic && e.category === category).length;
    const sameCat = history.filter(h => h.category === category).length;
    const pattern = same ? `${ord(same + 1)} ${category.toLowerCase()} on ${a.topic} in your recent record.` : sameCat >= 2 ? `First on ${a.topic}, but ${sameCat} earlier ${category.toLowerCase()}s on other topics: it is a habit, not a topic problem.` : 'No earlier error of this kind on this topic.';
    const lvl = spec.difficultyScale.toLevel(clamp(((topicAb ? topicAb.theta : secTheta) + 0.3 + 2.5) / 5, 0.2, 1));
    const n = category === 'Knowledge Gap' ? 8 : 6;
    const fix = (cats[category] ? cats[category].fix : 'Review the solution, then practise {n} questions on {topic}.').replace(/\{topic\}/g, a.topic).replace(/\{n\}/g, n).replace(/\{level\}/g, lvl);
    out.push({ qid: a.qid, index: i, topic: a.topic, type: a.type, category, what, why, skill: [Q.skill, Q.subtopic].filter(Boolean).join(' · ') + (Q.prerequisites && Q.prerequisites.length ? ` (builds on: ${Q.prerequisites.join(', ')})` : ''),
      pattern, repeated: same, fix, next: { topic: a.topic, level: lvl, n } });
  });
  return out;
}

/* ------------------------------------------------------------------ user ability model */
/* attempts: [{ qid, section, topic, skill, type, difficulty, difficultyScore?, irt?, correct, unanswered, timeSec, expectedSec, at, kind, timed, mode }] */
function abilityModel(spec, attempts, opts){
  opts = opts || {};
  const now = opts.now || new Date().toISOString(), half = opts.halfLifeDays || 45;
  const W = opts.weights || { exam: 1.5, learn: 0.7 };
  const rows = attempts.filter(a => a && a.section && (a.unanswered ? a.kind === 'exam' : true)).map(a => {
    const age = Math.max(0, daysBetween(a.at || now, now));
    const w = Math.pow(0.5, age / half) * (a.kind === 'exam' ? W.exam : a.mode === 'learn' ? W.learn : 1);
    return { a, it: itemParams(spec, { ...a, id: a.qid }), y: a.correct ? 1 : 0, w };
  });
  const est = (list, prior) => { const e = eap(spec, list, prior); return { theta: round(e.theta, 3), se: round(e.se, 3), n: list.length }; };
  const overall = est(rows, spec.scoringRules.prior);
  const sections = {}, topics = {}, skills = {};
  for (const s of spec.sections){ const l = rows.filter(r => r.a.section === s.section); sections[s.section] = est(l, spec.scoringRules.prior); }
  const tset = [...new Set(rows.map(r => r.a.topic))];
  for (const t of tset){ const l = rows.filter(r => r.a.topic === t), sec = l[0].a.section; topics[t] = { ...est(l, { mean: sections[sec].theta, sd: 0.7 }), section: sec }; }
  const kset = [...new Set(rows.filter(r => r.a.skill).map(r => r.a.topic + '|' + r.a.skill))];
  for (const k of kset){ const [t, sk] = k.split('|'); const l = rows.filter(r => r.a.topic === t && r.a.skill === sk); skills[k] = { ...est(l, { mean: topics[t].theta, sd: 0.6 }), topic: t, skill: sk }; }
  const secScores = spec.sections.map(s => { const e = sections[s.section]; const z = spec.scoringRules.rangeZ; return { section: s.section, n: e.n, score: Math.round(thetaToSection(spec, e.theta)), range: [Math.round(thetaToSection(spec, e.theta - z * e.se)), Math.round(thetaToSection(spec, e.theta + z * e.se))] }; });
  const enough = secScores.every(s => s.n >= 10);
  const answered = rows.filter(r => !r.a.unanswered);
  const recent = answered.slice(-30);
  const expAcc = recent.length ? sum(recent.map(r => prob(sections[r.a.section].theta, r.it))) / recent.length : null;
  const timedRecent = answered.filter(r => r.a.timed && r.a.timeSec > 0 && r.a.expectedSec && daysBetween(r.a.at || now, now) <= 60);
  const eff = timedRecent.length ? sum(timedRecent.map(r => r.a.expectedSec)) / sum(timedRecent.map(r => r.a.timeSec)) : null;
  const bySession = {}; for (const r of answered) if (r.a.sid) (bySession[r.a.sid] = bySession[r.a.sid] || []).push(r);
  const resid = Object.values(bySession).filter(l => l.length >= 5).slice(-10).map(l => l.filter(r => r.y).length / l.length - sum(l.map(r => prob(sections[r.a.section].theta, r.it))) / l.length);
  return {
    overallAbility: overall, sectionAbilities: sections, sections, topics, skills,
    estimatedScore: enough ? { sections: secScores, ...scoreTotal(spec, secScores) } : { sections: secScores, total: null, range: null, note: 'Needs at least 10 answers in every section.' },
    confidence: { se: overall.se, label: overall.n < 20 ? 'very low' : overall.se > 0.45 ? 'low' : overall.se > 0.3 ? 'medium' : 'high' },
    recentPerformance: { n: recent.length, accuracy: recent.length ? recent.filter(r => r.y).length / recent.length : null, expected: expAcc },
    timeEfficiency: eff, consistency: { sd: sd(resid), sessions: resid.length },
    updatedAt: now, n: rows.length,
  };
}

/* ------------------------------------------------------------------ examiner */
/* mock: a saved simulation (see app.js); analyses: { section → analyzeSection() }; errors: classifyErrors() for all sections. */
function examine(spec, mock, analyses, errors, ability){
  const topicScore = {};
  for (const e of errors) topicScore[e.topic] = (topicScore[e.topic] || 0) + 1;
  if (ability) for (const [t, v] of Object.entries(ability.topics)){ const s = ability.sections[v.section]; if (v.n >= 3 && s && s.theta - v.theta > 0.5) topicScore[t] = (topicScore[t] || 0) + (s.theta - v.theta); }
  const focus = Object.entries(topicScore).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([topic]) => {
    const miss = errors.filter(e => e.topic === topic), ab = ability && ability.topics[topic], s = ab && ability.sections[ab.section];
    const parts = [];
    if (miss.length) parts.push(`${miss.length} miss${miss.length > 1 ? 'es' : ''} in this mock (${[...new Set(miss.map(m => m.category.toLowerCase()))].join(', ')})`);
    if (ab && s && ab.n >= 3 && s.theta - ab.theta > 0.3) parts.push(`ability ${(s.theta - ab.theta).toFixed(1)} below your ${ab.section} level over ${ab.n} answers`);
    return { topic, why: parts.join('; ') + '.' };
  });
  const cats = {}; for (const e of errors) cats[e.category] = (cats[e.category] || 0) + 1;
  const findings = [];
  for (const a of Object.values(analyses)) for (const p of a.patterns.filter(p => p.severity >= 2).slice(0, 2)) findings.push(`${a.section}: ${p.text}`);
  const topCat = Object.entries(cats).sort((a, b) => b[1] - a[1])[0];
  if (topCat) findings.push(`Most common error type: ${topCat[0]} (${topCat[1]} of ${errors.length}).`);
  for (const a of Object.values(analyses)){ const hard = a.difficulty.find(b => b.label === 'Above your level'); if (hard && hard.n >= 3) findings.push(`${a.section}: ${pctText(hard.acc)} right on ${hard.n} questions above your level.`); }
  return { focus, categories: cats, findings, focusDays: 9 };
}
/* When a new full mock is worth taking. lastFull: date of the latest full simulation; since: attempts after it; focus: examiner focus topics. */
function nextMockDecision(spec, lastFull, since, focus, today){
  const R = spec.readinessRules.nextMock;
  if (!lastFull) return { ready: true, checks: [{ label: 'No full simulation yet: the first one sets your baseline.', pass: true }] };
  const days = daysBetween(lastFull, today);
  const onFocus = focus.map(f => { const l = since.filter(a => a.topic === f.topic && !a.unanswered); return { topic: f.topic, n: l.length, acc: l.length ? l.filter(a => a.correct).length / l.length : null }; });
  const checks = [
    { label: `At least ${R.minDays} days since the last full simulation (${days})`, pass: days >= R.minDays },
    { label: `At least ${R.practiceSince} questions practised since then (${since.length})`, pass: since.length >= R.practiceSince },
    ...onFocus.map(f => ({ label: `${f.topic}: ${R.perFocusTopic}+ questions at ${pctText(R.focusAccuracy)}+ since the mock (${f.n}, ${pctText(f.acc)})`, pass: f.n >= R.perFocusTopic && f.acc >= R.focusAccuracy })),
  ];
  const overdue = days >= R.maxDays;
  return { ready: checks.every(c => c.pass) || overdue, overdue, days, checks };
}

/* ------------------------------------------------------------------ readiness */
/* sims: comparable full simulations (oldest first) { date, total, sections: [{ section, score }], unanswered, timeEfficiency };
   officials: logged official practice exams { date, total }; target: total score; attempts: all attempts. */
function readiness(spec, sims, officials, ability, attempts, target, today, errorsByType){
  const R = spec.readinessRules;
  const last = sims[sims.length - 1] || null, last3 = sims.slice(-3);
  const in30 = sims.filter(s => daysBetween(s.date, today) <= 30).length;
  const totals = last3.map(s => s.total);
  const slope = last3.length >= 2 ? (last3[last3.length - 1].total - last3[0].total) / (last3.length - 1) : null;
  const secSd = spec.sections.map(s => ({ section: s.section, sd: sd(last3.map(m => (m.sections.find(x => x.section === s.section) || {}).score).filter(x => x != null)), last: last && (last.sections.find(x => x.section === s.section) || {}).score }));
  const recentAt = attempts.filter(a => daysBetween(a.at, today) <= 60);
  const hard = recentAt.filter(a => a.timed && (a.difficulty || 0) >= 5);
  const hardAcc = hard.length ? hard.filter(a => a.correct).length / hard.length : null;
  const errs = errorsByType || {};
  const skills = ability ? Object.values(ability.skills).filter(s => s.n >= 4) : [];
  const offRecent = officials.filter(o => daysBetween(o.date, today) <= R.officialDays).pop();
  const checks = [
    { id: 'count', label: `${R.simulationsIn30Days}+ full simulations in the last 30 days`, value: in30, pass: in30 >= R.simulationsIn30Days },
    { id: 'target', label: target ? `Latest simulation within ${R.targetMargin} of your target (${target})` : 'Latest simulation vs target (set a target in the interview)', value: last ? last.total : null, pass: !!(last && target && last.total >= target - R.targetMargin) },
    { id: 'stability', label: `Last 3 totals vary by at most ${R.totalSd} points (standard deviation)`, value: sd(totals) == null ? null : Math.round(sd(totals)), pass: totals.length >= 3 && sd(totals) <= R.totalSd },
    { id: 'sections', label: `Each section varies by at most ${R.sectionSd} points over the last 3`, value: secSd.map(s => `${s.section} ${s.sd == null ? '—' : s.sd.toFixed(1)}`).join(' · '), pass: last3.length >= 3 && secSd.every(s => s.sd != null && s.sd <= R.sectionSd) },
    { id: 'timing', label: 'No unanswered questions in the last 2 simulations', value: sims.slice(-2).map(s => s.unanswered).join(' · ') || null, pass: sims.length >= 2 && sims.slice(-2).every(s => !s.unanswered) },
    { id: 'efficiency', label: `Time efficiency ${R.timeEfficiency}+ (expected time ÷ time used)`, value: ability && ability.timeEfficiency != null ? ability.timeEfficiency.toFixed(2) : null, pass: !!(ability && ability.timeEfficiency >= R.timeEfficiency) },
    { id: 'hard', label: `${pctText(R.hardAccuracy)}+ right on level 5–6 questions in the last 60 days (${R.hardMin}+ answered)`, value: hard.length ? `${pctText(hardAcc)} of ${hard.length}` : null, pass: hard.length >= R.hardMin && hardAcc >= R.hardAccuracy },
    { id: 'official', label: `An official practice exam in the last ${R.officialDays} days within ${R.officialWithin} of your target`, value: offRecent ? offRecent.total : null, pass: !!(offRecent && target && offRecent.total >= target - R.officialWithin) },
  ];
  return {
    overall: { last: last ? { date: last.date, total: last.total, range: last.range } : null, model: ability ? ability.estimatedScore : null, target },
    sectionConsistency: secSd, recent: last3.map(s => ({ date: s.date, total: s.total })), trend: slope,
    timeManagement: { unanswered: sims.slice(-3).map(s => s.unanswered), efficiency: ability ? ability.timeEfficiency : null, lastEfficiency: last ? last.timeEfficiency : null },
    weakestSkills: skills.slice().sort((a, b) => a.theta - b.theta).slice(0, 5), strongestSkills: skills.slice().sort((a, b) => b.theta - a.theta).slice(0, 5),
    errorRate: { byType: errs, answered: recentAt.length, wrong: recentAt.filter(a => !a.correct).length },
    difficultyTolerance: { n: hard.length, acc: hardAcc }, stability: { sd: sd(totals), slope },
    checks, passed: checks.filter(c => c.pass).length,
  };
}

const api = { itemParams, prob, info, eap, thetaToSection, scoreSection, scoreTotal, features, isDuplicate, jaccard, blueprint, categoryOfItem, topicGroup,
  newSectionState, selectNext, record, analyzeSection, classifyErrors, abilityModel, examine, nextMockDecision, readiness };
root.GMATEngine = api;
if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
