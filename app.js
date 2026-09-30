/* GMAT Lab: views, test engine and analytics. Storage is in store.js; the rule-based coach and adaptive engine in planner.js. */
(() => {
'use strict';

/* ------------------------------------------------------------------ constants */
const PACE = { 'Quant': 45*60/21, 'Data Insights': 45*60/20, 'Verbal': 45*60/23 };
const SECTIONS = ['Quant', 'Data Insights', 'Verbal'];
const BLOCKS = [
  { key:'Q', section:'Quant', name:'Quantitative Reasoning', note:'No calculator. Problem Solving only. Work on paper, as on the test-center noteboard.' },
  { key:'DI', section:'Data Insights', name:'Data Insights', note:'On-screen calculator available. A multi-part question scores only if every part is right.' },
  { key:'V', section:'Verbal', name:'Verbal Reasoning', note:'Five Critical Reasoning questions and one Reading Comprehension passage with four questions.' },
];
const DS_CHOICES = [
  'Statement (1) ALONE is sufficient, but statement (2) alone is not sufficient.',
  'Statement (2) ALONE is sufficient, but statement (1) alone is not sufficient.',
  'BOTH statements TOGETHER are sufficient, but NEITHER statement ALONE is sufficient.',
  'EACH statement ALONE is sufficient.',
  'Statements (1) and (2) TOGETHER are NOT sufficient.'
];
const ERROR_TYPES = [
  ['Conceptual', 'I did not know the concept.'],
  ['Procedural', 'I knew the concept but applied the procedure wrongly.'],
  ['Calculation', 'Arithmetic or algebra slip.'],
  ['Interpretation', 'I misunderstood what the question asked.'],
  ['Reading', 'I misread a word, a number or a condition.'],
  ['Logic', 'My reasoning was flawed.'],
  ['Strategy', 'I chose an inefficient approach.'],
  ['Timing', 'I spent too long or ran out of time.'],
  ['Careless', 'An avoidable slip I could have caught.'],
  ['Trap', 'I fell for the trap built into the question.'],
  ['Guessing', 'I guessed, right or wrong.'],
  ['Overthinking', 'I complicated a simple problem.'],
];
const CONF = [20, 40, 60, 80, 100];
const INTERVALS = [1, 3, 7, 21, 45];
const LETTERS = 'ABCDE';
const SYLLABUS = {
  'Quant': ['Integers & divisibility','Primes & factors','Remainders','Odd/even & signs','Fractions & decimals','Exponents & roots','Percents','Ratios & proportions','Rates & work','Mixtures','Interest','Overlapping sets','Statistics','Counting','Probability','Sequences','Linear equations','Quadratics & functions','Inequalities & absolute value','Word problems'],
  'Data Insights': ['Data Sufficiency','Two-Part Analysis','Table Analysis','Graphics Interpretation','Multi-Source Reasoning'],
  'Verbal': ['CR · Strengthen','CR · Weaken','CR · Assumption','CR · Evaluate','CR · Inference','CR · Boldface/Role','CR · Flaw','CR · Explain discrepancy','CR · Plan/Method','RC · Main idea','RC · Detail','RC · Inference','RC · Function/Structure','RC · Application','RC · Tone/Style'],
};
const STATUS = ['Not started','Introduced','Practicing','Developing','Strong','Mastered'];
const PHASES = ['Diagnostic & setup','Foundations','Core mastery','Advanced problem solving','Timing & pressure','High-level (750+)','Full simulations','Final optimization'];
const TARGETS = {
  classic750: { label:'750 on the old scale', score:705, note:'≈ 695–715 on today’s scale · 97–99th percentile' },
  new755: { label:'755+ on today’s scale', score:755, note:'99.8th percentile' },
};
const EXAM_DEFAULT = '2027-07-19';
const RATING_ITEMS = [
  ['r_mental','Mental math, fractions, percents'],
  ['r_algebra','Algebra: equations, inequalities, absolute value, powers and roots'],
  ['r_numbers','Number properties: divisibility, primes, remainders, odd/even'],
  ['r_word','Word problems: rates, work, mixtures, interest'],
  ['r_stats','Descriptive statistics, probability, counting'],
  ['r_data','Reading tables and charts'],
  ['r_reading','Reading long, dense English texts at exam speed'],
  ['r_args','Taking an argument apart: premise, conclusion, hidden assumption'],
];
const RESOURCES = ['Official Starter Kit + Practice Exams 1–2 (free)','GMAT Official Guide 2026–2027','Official Quant Review','Official Verbal Review','Official Data Insights Review','Official Practice Exams 3–6','Other course or book'];

/* ------------------------------------------------------------------ state + helpers */
const S = { db:null, dbStatus:'connecting', bank:{}, sessions:{}, errors:{}, mocks:{}, profile:{}, studylog:{}, loaded:new Set(), tab:'today', run:null, ui:{ practice:{ section:'Quant', topic:'', diff:'', count:'10', mode:'learn', unseen:true }, sort:{}, msrTab:0 } };
const COLLECTIONS = ['bank','sessions','errors','mocks','profile','studylog'];
const $ = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
const ESC = { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' };
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ESC[c]);
const clone = o => o == null ? o : JSON.parse(JSON.stringify(o));
/* sec: the section whose glossary terms get underlined (see glossary below); omit it for plain text. */
function inline(s, sec){ return gloss(esc(s), sec).replace(/\^\{([^}]*)\}/g,'<sup>$1</sup>').replace(/_\{([^}]*)\}/g,'<sub>$1</sub>').replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>'); }
function rich(s, sec){ return String(s == null ? '' : s).split(/\n{2,}/).map(p => '<p>' + inline(p, sec).replace(/\n/g,'<br>') + '</p>').join(''); }
/* English–Italian glossary (knowledge/glossary.json): terms are underlined in practice questions, solutions, lessons and drills;
   a tap shows the Italian. Never in a mock or while a diagnostic block runs, as on the real exam. Each term only once per paragraph. */
let GL = null;
const GLOSS_AREAS = { 'Quant': ['quant', 'di', 'exam'], 'Data Insights': ['quant', 'di', 'exam'], 'Verbal': ['verbal', 'exam'] };
function buildGloss(list){
  const byForm = new Map(), forms = [];
  for (const e of list || []) for (const f of [e.term, ...(e.forms || [])]){ byForm.set(glossKey(f), e); if (e.tap !== false) forms.push(f); }
  forms.sort((a, b) => b.length - a.length);
  const re = forms.length ? new RegExp('\\b(' + forms.map(f => f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/[ -]/g, '[\\s-]+')).join('|') + ')(?:s|es)?\\b', 'gi') : null;
  return { re, byForm, list: list || [] };
}
const glossKey = w => String(w).toLowerCase().replace(/[\s-]+/g, ' ');
function glossEntry(w){ return GL.byForm.get(glossKey(w)) || null; }
function glossOn(){
  if (!GL || !GL.re || S.ui.gloss === false) return false;
  const r = S.run; return !(r && (r.kind === 'exam' || r.kind === 'diagnostic') && LOCKED.includes(r.phase));
}
function gloss(html, sec){
  const areas = sec && GLOSS_AREAS[sec]; if (!areas || !glossOn()) return html;
  const used = new Set();
  return html.replace(GL.re, (m, w) => { const e = glossEntry(w); if (!e || !areas.includes(e.area) || used.has(e.term)) return m; used.add(e.term); return `<button type="button" class="gl" data-gl="${esc(e.term)}">${m}</button>`; });
}
function showGloss(btn){
  const e = GL && GL.byForm.get(glossKey(btn.dataset.gl)), pop = $('#glpop'); if (!e || !pop) return;
  pop.innerHTML = `<b lang="en">${esc(e.term)}</b><span class="it" lang="it">${esc(e.it)}</span>${e.note ? `<span class="note" lang="it">${esc(e.note)}</span>` : ''}`;
  pop.hidden = false;
  const r = btn.getBoundingClientRect(), w = Math.min(300, window.innerWidth - 24);
  pop.style.width = w + 'px';
  const x = Math.min(Math.max(12, r.left), window.innerWidth - w - 12);
  let y = r.bottom + 6; if (y + pop.offsetHeight > window.innerHeight - 8) y = Math.max(8, r.top - pop.offsetHeight - 6);
  pop.style.left = x + 'px'; pop.style.top = y + 'px';
}
function hideGloss(){ const pop = $('#glpop'); if (pop && !pop.hidden) pop.hidden = true; }
const pad = n => String(n).padStart(2,'0');
function ymd(d){ return d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate()); }
const today = () => ymd(new Date());
function parseD(s){ const [y,m,d] = String(s).slice(0,10).split('-').map(Number); return new Date(y, m-1, d); }
function addDays(s, n){ const d = parseD(s); d.setDate(d.getDate()+n); return ymd(d); }
function daysBetween(a, b){ return Math.round((parseD(b) - parseD(a)) / 86400000); }
function fmtTime(sec){ sec = Math.max(0, Math.round(sec || 0)); return Math.floor(sec/60) + ':' + pad(sec % 60); }
function fmtDate(s){ if (!s) return '—'; return parseD(s).toLocaleDateString('en-GB', { day:'numeric', month:'short', year: String(s).slice(0,4) === String(new Date().getFullYear()) ? undefined : 'numeric' }); }
const pct = x => (x == null || isNaN(x)) ? '—' : Math.round(x*100) + '%';
const uid = p => p + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2,6);
function fmtNum(v){ return typeof v === 'number' ? v.toLocaleString('en-US', { maximumFractionDigits: 2 }) : esc(v); }
function median(a){ if (!a.length) return null; const s = [...a].sort((x,y)=>x-y); const m = Math.floor(s.length/2); return s.length % 2 ? s[m] : (s[m-1]+s[m])/2; }
function expOf(q){ return (q && q.expectedSec) || Math.round(PACE[q && q.section] || 120); }

let toastT;
function toast(msg){ const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 4200); }

/* ------------------------------------------------------------------ database */
const chains = {};
function localApply(path, op, data){
  const [col, id] = path.split('/');
  if (!COLLECTIONS.includes(col) || !id) return;
  const map = { ...S[col] };
  if (op === 'delete') delete map[id];
  else if (op === 'set') map[id] = { id, ...clone(data) };
  else map[id] = { ...(map[id] || { id }), ...clone(data) };
  S[col] = col === 'bank' ? withGenerated(map) : map;
}
function dbErrorText(e){
  const c = e && e.code;
  if (c === 'quota_exceeded') return 'Browser storage is full. Export a backup in Settings, then ask Claude to archive old sessions.';
  if (c === 'invalid_argument') return 'Not saved: this view cannot write to GMAT Lab’s data.';
  if (c === 'no_storage' || c === 'no_db') return 'Not saved: this browser blocks storage (private mode?). Open GMAT Lab in a normal window.';
  return 'Could not save. Try again.';
}
function write(path, op, data){
  if (!S.db){ toast(dbErrorText({ code:'no_db' })); return Promise.resolve(false); }
  localApply(path, op, data);
  const run = () => { const ref = S.db.doc(path); return op === 'set' ? ref.set(data) : op === 'update' ? ref.update(data) : ref.delete(); };
  const prev = chains[path] || Promise.resolve();
  const p = prev.then(run).catch(async e => {
    if (e && e.code === 'unavailable'){ await new Promise(r => setTimeout(r, 600 + Math.random()*900)); return run(); }
    throw e;
  }).then(() => true, e => { toast(dbErrorText(e)); return false; });
  chains[path] = p;
  return p;
}
function subscribe(){
  for (const name of COLLECTIONS){
    S.db.collection(name).onSnapshot(snap => {
      const m = {};
      for (const d of snap.docs){ const v = d.data(); if (v) m[d.id] = { id: d.id, ...v }; }
      S[name] = name === 'bank' ? withGenerated(m) : m; S.loaded.add(name); scheduleRender();
    }, err => { S.dbStatus = 'error'; S.dbError = err && err.code; scheduleRender(); });
  }
}

/* Generated questions (generators.js) are rebuilt from their id, so the bank never stores them: a missing gen- id
   is built on demand, and a local override (a report) is laid over the built question. */
const GEN = window.GMATGen || null;
let genSeed = Math.floor(Math.random() * 1e9);
function withGenerated(m){
  if (!GEN) return m;
  for (const id of Object.keys(m)) if (GEN.isGenerated(id)){ const q = GEN.fromId(id); if (q) m[id] = { ...q, ...m[id] }; else delete m[id]; }
  return new Proxy(m, { get: (t, k) => (typeof k === 'string' && !(k in t) && GEN.isGenerated(k)) ? (GEN.fromId(k) || undefined) : t[k] });
}
/* Fresh generated candidates for the planner and the practice form: two per template and level, more for one topic.
   Like written practice questions, they open section by section once that section's diagnostic block is done. */
function genPool(topic){
  if (!GEN) return [];
  const open = BLOCKS.filter(b => blockDone(b.key)).map(b => b.section);
  const list = GEN.candidates({ seed: genSeed, per: 2 });
  if (topic) list.push(...GEN.candidates({ seed: genSeed + 1, per: 8, topic }));
  const own = id => Object.prototype.hasOwnProperty.call(S.bank, id);      // no build: overrides only
  return list.filter(q => open.includes(q.section) && !(own(q.id) && S.bank[q.id].flagged));
}

/* ------------------------------------------------------------------ question model */
const isMulti = q => Array.isArray(q.parts) && q.parts.length > 0;
const choicesOf = q => q.type === 'DS' ? DS_CHOICES : (q.choices || []);
function isComplete(q, ans){ if (isMulti(q)) return Array.isArray(ans) && q.parts.every((p,i) => Number.isInteger(ans[i])); return Number.isInteger(ans); }
function isCorrect(q, ans){ if (!isComplete(q, ans)) return false; if (isMulti(q)) return q.parts.every((p,i) => ans[i] === p.answer); return ans === q.answer; }
function answerText(q, ans){
  if (ans == null) return '—';
  if (isMulti(q)) return q.parts.map((p,i) => (Array.isArray(ans) && Number.isInteger(ans[i])) ? p.options[ans[i]] : '—').join(' · ');
  return LETTERS[ans] || '—';
}
const correctText = q => isMulti(q) ? q.parts.map(p => p.options[p.answer]).join(' · ') : LETTERS[q.answer];
function shortStem(q){ const t = String(q.stem || '').replace(/\*\*/g,'').replace(/\^\{([^}]*)\}/g,'^$1').split('\n')[0]; return t.length > 110 ? t.slice(0,107) + '…' : t; }
function blockQids(key){ return Object.values(S.bank).filter(q => q.set === 'diagnostic' && q.block === key).sort((a,b) => (a.order||0)-(b.order||0)).map(q => q.id); }
function blockLimit(key){ const b = BLOCKS.find(x => x.key === key); return Math.round(blockQids(key).length * PACE[b.section]); }
function diagSessions(key){ return Object.values(S.sessions).filter(s => s.kind === 'diagnostic' && s.block === key); }
function blockDone(key){ return diagSessions(key).some(s => s.status === 'done'); }
function doneSession(key){ return diagSessions(key).filter(s => s.status === 'done').sort((a,b) => String(b.start).localeCompare(String(a.start)))[0]; }
function pendingReview(){ return Object.values(S.sessions).find(s => s.status === 'done' && s.mode === 'test' && !s.reviewed && (s.attempts||[]).length); }

function attemptsAll(){
  const out = [];
  for (const s of Object.values(S.sessions)) for (const a of (s.attempts || [])) out.push({ ...a, kind: s.kind, timed: a.timed != null ? !!a.timed : !!s.timed, sid: s.id });
  return out.sort((a,b) => String(a.at).localeCompare(String(b.at)));
}
function dueErrors(){ const t = today(); return Object.values(S.errors).filter(e => e.status === 'active' && e.nextDue && e.nextDue <= t && S.bank[e.qid]).sort((a,b) => String(a.nextDue).localeCompare(String(b.nextDue))); }
function interview(){ return S.profile.interview || {}; }
function examDate(){ return interview().examDate || EXAM_DEFAULT; }
function target(){ return TARGETS[interview().target] || null; }
function phase(){ const p = (S.profile.settings || {}).phase; return Number.isInteger(p) ? p : 0; }

/* ------------------------------------------------------------------ analytics */
function computeStats(){
  const at = attemptsAll(); const n = at.length;
  const acc = n ? at.filter(a => a.correct).length / n : null;
  const t = at.filter(a => a.timed);
  const tacc = t.length ? t.filter(a => a.correct).length / t.length : null;
  const ans = at.filter(a => !a.unanswered && a.timeSec > 0);
  const pace = ans.length ? ans.reduce((s,a) => s + a.timeSec / (PACE[a.section] || 120), 0) / ans.length : null;
  let sec = 0; for (const s of Object.values(S.sessions)) sec += Number(s.durationSec) || 0;
  let min = 0; for (const m of Object.values(S.studylog)) for (const e of (m.entries || [])) min += Number(e.minutes) || 0;
  sec += Number((S.profile.drills || {}).totalSec) || 0;
  return { n, acc, tacc, tn: t.length, pace, hours: sec/3600 + min/60, due: dueErrors().length };
}
function alerts(){
  const out = []; const at = attemptsAll();
  const byTopic = {};
  for (const a of at){ (byTopic[a.topic] = byTopic[a.topic] || []).push(a); }
  for (const [topic, arr] of Object.entries(byTopic)){
    const last = arr.slice(-12); const wrong = last.filter(a => !a.correct).length;
    if (last.length >= 4 && wrong >= 3 && wrong / last.length >= 0.34) out.push({ level:'bad', tag:'Repeated', text:`${wrong} misses in your last ${last.length} questions on ${topic}.` });
  }
  const hist = [];
  for (const e of Object.values(S.errors)) for (const h of (e.history || [])) hist.push({ ...h, topic: e.topic });
  hist.sort((a,b) => String(a.date).localeCompare(String(b.date)));
  const last20 = hist.slice(-20); const byType = {};
  for (const h of last20) byType[h.errorType] = (byType[h.errorType] || 0) + 1;
  for (const [type, k] of Object.entries(byType)) if (k >= 4) out.push({ level:'warn', tag:'Pattern', text:`${type}: ${k} of your last ${last20.length} logged errors.` });
  const hi = at.filter(a => !a.unanswered && a.confidence >= 80);
  if (hi.length >= 8){ const r = hi.filter(a => a.correct).length / hi.length; if (r < 0.7) out.push({ level:'warn', tag:'Calibration', text:`When you feel 80–100% sure you are right ${pct(r)} of the time (${hi.length} questions). Overconfidence costs points.` }); }
  const lo = at.filter(a => !a.unanswered && a.confidence != null && a.confidence <= 40);
  if (lo.length >= 8){ const r = lo.filter(a => a.correct).length / lo.length; if (r > 0.6) out.push({ level:'warn', tag:'Calibration', text:`When you feel unsure (20–40%) you are still right ${pct(r)} of the time. You may be doubting correct work.` }); }
  const un = at.filter(a => a.unanswered).length;
  if (un >= 2) out.push({ level:'bad', tag:'Pacing', text:`${un} questions left unanswered when time ran out. On the real exam each one costs points.` });
  return out;
}
function mastery(topic){
  const at = attemptsAll().filter(a => a.topic === topic); const n = at.length;
  const res = { n, acc:null, tacc:null, ratio:null, last:null, status:0 };
  if (!n) return res;
  const acc = at.filter(a => a.correct).length / n; res.acc = acc;
  const tm = at.filter(a => a.timed); res.tacc = tm.length ? tm.filter(a => a.correct).length / tm.length : null;
  const ans = at.filter(a => !a.unanswered && a.timeSec > 0 && a.expectedSec);
  res.ratio = ans.length ? ans.reduce((s,a) => s + a.timeSec / a.expectedSec, 0) / ans.length : null;
  res.last = at[n-1].at;
  const last10 = at.slice(-10); const acc10 = last10.filter(a => a.correct).length / last10.length;
  const levels = new Set(at.filter(a => a.correct && a.difficulty >= 3).map(a => a.difficulty));
  let st;
  if (n < 5) st = 1; else if (acc < 0.6) st = 2; else if (n < 10 || acc10 < 0.8 || levels.size < 2) st = 3; else st = 4;
  if (st === 4){
    const hard = at.filter(a => a.timed && a.difficulty >= 4);
    const hardOk = hard.filter(a => a.correct && a.timeSec <= 1.2 * a.expectedSec);
    const errs = Object.values(S.errors).filter(e => e.topic === topic);
    const correctDays = at.filter(a => a.correct).map(a => String(a.at).slice(0,10));
    const retained = errs.length
      ? errs.every(e => e.status === 'retired' || (e.retests || []).some(r => r.correct && e.lastWrong && daysBetween(e.lastWrong, r.date) >= 7))
      : (correctDays.length > 1 && daysBetween(correctDays[0], correctDays[correctDays.length-1]) >= 7);
    if (hard.length >= 6 && hardOk.length / hard.length >= 0.8 && retained) st = 5;
  }
  res.status = st; return res;
}
function calibration(){
  const at = attemptsAll().filter(a => !a.unanswered && a.confidence != null);
  return CONF.map(c => { const g = at.filter(a => a.confidence === c); return { c, n: g.length, acc: g.length ? g.filter(a => a.correct).length / g.length : null }; });
}

/* ------------------------------------------------------------------ chrome */
function renderChrome(){
  const days = daysBetween(today(), examDate());
  $('#countdown').textContent = (days > 0 ? `${days} days to ${fmtDate(examDate())}` : `Exam date: ${fmtDate(examDate())}`) + (S.dbStatus === 'ok' ? ' · ' + saveText() : '');
  const inTest = S.run && LOCKED.includes(S.run.phase);
  const nav = $('#tabs'); nav.hidden = !!inTest;
  const due = S.dbStatus === 'ok' ? dueErrors().length + dueOgErrors().length : 0;
  const tabs = [['today','Today'],['coach','Coach'],['learn','Learn'],['drills','Drills'],['diagnostic','Diagnostic'],['practice','Practice'],['retests','Retests', due],['errors','Error log'],['mastery','Mastery'],['mocks','Mocks'],['profile','Profile'],['settings','Settings']];
  nav.innerHTML = tabs.map(([k,l,b]) => `<button data-act="tab" data-arg="${k}" ${S.tab === k && !S.run ? 'aria-current="page"' : ''}>${l}${b ? ` <span class="badge">${b}</span>` : ''}</button>`).join('');
  let msg = '';
  if (S.dbStatus === 'absent') msg = dbErrorText({ code:'no_storage' });
  else if (S.dbStatus === 'ok' && GMATStore.bankError()) msg = GMATStore.bankError() === 'file'
    ? 'You opened the file directly, so the questions cannot load. Open GMAT Lab from its GitHub Pages address instead.'
    : 'The questions could not be loaded. Check your connection, then reload the page.';
  if (S.dbStatus === 'error') msg = 'The connection to your saved data stopped. Reload the page to reconnect.';
  $('#banner').innerHTML = msg ? `<p class="banner">${esc(msg)}</p>` : '';
}
function render(){
  renderChrome();
  const main = $('#main');
  if (S.run){ main.innerHTML = runView(); return; }
  if (S.drill){ main.innerHTML = drillView(); const f = S.drill.last || S.drill.phase !== 'ask' ? $('#drill-go') : $('#drill-in'); if (f) f.focus(); return; }
  S.ui.dirty = false;
  main.innerHTML = (VIEWS[S.tab] || VIEWS.today)();
}
let rq = false;
function scheduleRender(){
  if (rq) return; rq = true;
  setTimeout(() => { rq = false; renderChrome(); if (S.run || S.drill || S.ui.dirty) return; $('#main').innerHTML = (VIEWS[S.tab] || VIEWS.today)(); }, 40);
}

/* ------------------------------------------------------------------ question rendering */
function qBody(q, ans, opt){
  opt = opt || {};
  const ctx = contextHTML(q);
  const main = `<div class="stem">${rich(q.stem, q.section)}</div>${statementsHTML(q)}${answerHTML(q, ans, opt)}`;
  if (q.passage || q.tabs) return `<div class="qgrid split"><div>${ctx}</div><div class="qgrid">${main}</div></div>`;
  return `<div class="qgrid">${ctx}${main}</div>`;
}
function contextHTML(q){
  if (q.passage) return `<article class="passage"><p class="eyebrow">${esc(q.passage.title || 'Passage')}</p>${rich(q.passage.text, q.section)}</article>`;
  if (q.tabs){ const t = Math.min(S.ui.msrTab || 0, q.tabs.length-1); return `<div class="msr"><div class="msr-tabs" role="tablist">${q.tabs.map((tb,i) => `<button role="tab" aria-selected="${i===t}" data-act="msrtab" data-t="${i}">${esc(tb.title)}</button>`).join('')}</div><div class="msr-body" role="tabpanel" id="msr-body">${rich(q.tabs[t].body, q.section)}</div></div>`; }
  if (q.table) return tableHTML(q);
  if (q.chart) return chartHTML(q.chart);
  return '';
}
function statementsHTML(q){
  if (q.type !== 'DS' || !q.statements) return '';
  return `<ol class="stmts">${q.statements.map((s,i) => `<li><span class="n">(${i+1})</span>${inline(s, q.section)}</li>`).join('')}</ol>`;
}
function tableHTML(q){
  const t = q.table; const st = S.ui.sort[q.id] || { c:null, dir:1 };
  const rows = t.rows.map(r => r.slice());
  if (st.c != null) rows.sort((a,b) => { const x = a[st.c], y = b[st.c]; return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))) * st.dir; });
  const num = i => t.numeric && t.numeric[i];
  return `<div class="box scroll ta" data-q="${esc(q.id)}"><table class="tbl data"><thead><tr>${t.columns.map((c,i) => `<th class="${num(i)?'num':''}" ${st.c===i ? `aria-sort="${st.dir>0?'ascending':'descending'}"` : ''}><button class="sort" data-act="sort" data-q="${esc(q.id)}" data-c="${i}">${esc(c)} <span aria-hidden="true">${st.c===i ? (st.dir>0?'▲':'▼') : '↕'}</span></button></th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map((v,i) => `<td class="${num(i)?'num':''}">${fmtNum(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function chartHTML(c){
  const W = 540, H = 270, L = 46, R = 14, T = 38, B = 34;
  const max = c.max || Math.ceil(Math.max(...c.values) * 1.2); const step = c.step || Math.ceil(max/5);
  const pw = W-L-R, ph = H-T-B, n = c.values.length, slot = pw/n, bw = slot*0.52;
  let g = `<text class="ttl" x="${L}" y="18">${esc(c.title)}${c.unit ? ` (${esc(c.unit)})` : ''}</text>`;
  for (let v = 0; v <= max; v += step){ const y = T + ph - v/max*ph; g += `<line class="grid" x1="${L}" x2="${W-R}" y1="${y}" y2="${y}"/><text x="${L-8}" y="${y+4}" text-anchor="end">${v}</text>`; }
  c.values.forEach((v,i) => { const x = L + i*slot + (slot-bw)/2, h = v/max*ph, y = T + ph - h;
    g += `<rect class="bar" x="${x}" y="${y}" width="${bw}" height="${h}" rx="2"/><text class="val" x="${x+bw/2}" y="${y-6}" text-anchor="middle">${v}</text><text x="${x+bw/2}" y="${T+ph+20}" text-anchor="middle">${esc(c.labels[i])}</text>`; });
  g += `<line class="axis" x1="${L}" x2="${W-R}" y1="${T+ph}" y2="${T+ph}"/>`;
  return `<figure class="chart" style="margin:0"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(c.title)}: ${c.labels.map((l,i) => l + ' ' + c.values[i]).join(', ')}">${g}</svg></figure>`;
}
function answerHTML(q, ans, opt){
  const lock = !!opt.locked, rev = !!opt.reveal, user = opt.userAns;
  if (isMulti(q)){
    const cur = Array.isArray(ans) ? ans : [];
    const cls = (p, i, pi) => { if (!rev) return ''; if (i === p.answer) return 'is-correct'; if (Array.isArray(user) && user[pi] === i) return 'is-wrong'; return ''; };
    if (q.partStyle === 'tpa'){
      const opts = q.parts[0].options;
      return `<div class="box scroll"><table class="tbl parts"><thead><tr>${q.parts.map(p => `<th>${esc(p.label)}</th>`).join('')}<th>Value</th></tr></thead><tbody>${opts.map((o,i) => `<tr>${q.parts.map((p,pi) => `<td><button class="opt ${cls(p,i,pi)}" data-act="pickpart" data-p="${pi}" data-i="${i}" aria-pressed="${cur[pi]===i}" aria-label="${esc(p.label)}: ${esc(o)}" ${lock?'disabled':''}>${cur[pi]===i ? '●' : '○'}</button></td>`).join('')}<td class="mono">${esc(o)}</td></tr>`).join('')}</tbody></table></div>`;
    }
    if (q.partStyle === 'dropdown'){
      return `<div class="stack">${q.parts.map((p,pi) => `<p class="dd">${inline(p.label, q.section)} <select data-p="${pi}" ${lock?'disabled':''} aria-label="Part ${pi+1}"><option value="">Select…</option>${p.options.map((o,i) => `<option value="${i}" ${cur[pi]===i?'selected':''}>${esc(o)}</option>`).join('')}</select>${rev ? `<span class="ok">Correct: ${esc(p.options[p.answer])}</span>` : ''}</p>`).join('')}</div>`;
    }
    return `<div class="box scroll"><table class="tbl parts"><thead><tr><th>Yes</th><th>No</th><th>Statement</th></tr></thead><tbody>${q.parts.map((p,pi) => `<tr>${p.options.map((o,i) => `<td><button class="opt ${cls(p,i,pi)}" data-act="pickpart" data-p="${pi}" data-i="${i}" aria-pressed="${cur[pi]===i}" aria-label="${esc(o)}: statement ${pi+1}" ${lock?'disabled':''}>${cur[pi]===i ? '●' : '○'}</button></td>`).join('')}<td class="stmt">${inline(p.label, q.section)}</td></tr>`).join('')}</tbody></table></div>`;
  }
  const ch = choicesOf(q);
  return `<div class="choices" role="group" aria-label="Answer choices">${ch.map((c,i) => {
    let cls = '', tag = '';
    if (rev && i === q.answer){ cls = 'is-correct'; tag = 'Correct answer'; }
    else if (rev && user === i){ cls = 'is-wrong'; tag = opt.userLabel || 'Your first answer'; }
    return `<button class="choice ${cls}" data-act="pick" data-i="${i}" aria-pressed="${ans===i}" ${lock?'disabled':''}><span class="let">${LETTERS[i]}</span><span>${inline(c)}</span>${tag ? `<span class="tag">${tag}</span>` : ''}</button>`;
  }).join('')}</div>`;
}
function confPicker(v){ return `<div class="conf"><span class="conf-l">Confidence</span><div class="seg" role="group" aria-label="Confidence">${CONF.map(c => `<button data-act="conf" data-v="${c}" aria-pressed="${v===c}">${c}%</button>`).join('')}</div></div>`; }
function calcWidget(){ return `<details class="calc"><summary>Calculator</summary><div class="calc-row"><label for="calc-in" class="sr">Expression</label><input id="calc-in" type="text" inputmode="decimal" autocomplete="off" placeholder="e.g. 21/66*100"><output id="calc-out" for="calc-in">=</output></div></details>`; }
function calc(expr){
  const s = expr.replace(/\s+/g,'').replace(/×/g,'*').replace(/÷/g,'/').replace(/,/g,''); let i = 0;
  const num = () => { const m = /^\d*\.?\d+(e[+-]?\d+)?/i.exec(s.slice(i)); if (!m) throw 0; i += m[0].length; return parseFloat(m[0]); };
  const post = v => { if (s[i] === '%'){ i++; return v/100; } return v; };
  const factor = () => { if (s[i] === '-'){ i++; return -factor(); } if (s[i] === '+'){ i++; return factor(); } if (s[i] === '('){ i++; const v = sum(); if (s[i] !== ')') throw 0; i++; return post(v); } return post(num()); };
  const pow = () => { const b = factor(); if (s[i] === '^'){ i++; return Math.pow(b, pow()); } return b; };
  const term = () => { let v = pow(); while (s[i] === '*' || s[i] === '/'){ const o = s[i++]; const r = pow(); v = o === '*' ? v*r : v/r; } return v; };
  const sum = () => { let v = term(); while (s[i] === '+' || s[i] === '-'){ const o = s[i++]; const r = term(); v = o === '+' ? v+r : v-r; } return v; };
  const v = sum(); if (i !== s.length) throw 0; return v;
}
function solutionHTML(q){
  const rows = [['Answer', esc(correctText(q))]];
  if (q.method) rows.push(['Best method', inline(q.method, q.section)]);
  if (q.altMethod) rows.push(['Another route', inline(q.altMethod, q.section)]);
  if (q.trap) rows.push(['The trap', inline(q.trap, q.section)]);
  if (q.solution) rows.push(['Every option', inline(q.solution, q.section)]);
  const L = lessonOf(q.topic);
  return `<div class="sol"><dl>${rows.map(([k,v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
    ${L ? `<details class="more"><summary>Theory: ${esc(q.topic)}</summary><div class="stack" style="margin-top:8px"><p class="muted">${inline(L.summary, L.section)}</p><div><p class="eyebrow">Key ideas</p><ul class="answer">${L.ideas.map(x => `<li>${inline(x, L.section)}</li>`).join('')}</ul></div><div><p class="eyebrow">Traps</p><ul class="answer">${L.traps.map(x => `<li>${inline(x, L.section)}</li>`).join('')}</ul></div></div></details>` : ''}
    <p class="fine">Expected time ≈ ${fmtTime(expOf(q))} · ${esc(q.topic || '')}${q.subtopic ? ' · ' + esc(q.subtopic) : ''} · level ${q.difficulty || '—'}${q.set === 'generated' ? ' · generated question: new numbers every time, answer computed exactly' : ''} · <button class="linkbtn" data-act="report">Report a problem</button></p>
    <div id="report-box" hidden><label class="lab" for="report-note">What looks wrong?</label><textarea id="report-note" rows="2"></textarea><div class="row" style="margin-top:8px"><button class="btn small" data-act="reportsend">Send report</button><button class="btn small ghost" data-act="reportcancel">Cancel</button></div></div></div>`;
}

/* ------------------------------------------------------------------ run engine */
let ticker = null;
function startTicker(){ stopTicker(); ticker = setInterval(tick, 500); }
function stopTicker(){ if (ticker){ clearInterval(ticker); ticker = null; } }
function clockText(){
  const r = S.run; if (!r) return '';
  if (S.ui.clockHidden && !r.examId) return 'Show time';
  if (r.endsAt) return fmtTime((r.endsAt - Date.now())/1000);
  if (r.examId) return fmtTime((Date.now() - r.started)/1000);     // untimed mock: time in the section, always on screen
  return fmtTime((Date.now() - r.qStart)/1000);
}
function tick(){
  const r = S.run; if (!r){ stopTicker(); return; }
  const el = $('#clock'); if (el){ el.textContent = clockText(); el.classList.toggle('low', !!r.endsAt && r.endsAt - Date.now() < 5*60000); }
  if (r.endsAt && Date.now() >= r.endsAt && ['question','review','edit'].includes(r.phase)) finishRun(true);
  if (r.phase === 'break'){ const b = $('#breakclock'); const left = (r.breakEnds - Date.now()) / 1000; if (b) b.textContent = fmtTime(left); if (left <= 0) examNext(); }
}
const LOCKED = ['question','review','edit','between','break','examdone'];   // no tabs while these are on screen
function startRun(o){
  const id = uid('s'); const now = Date.now();
  S.run = { id, kind:o.kind, block:o.block || null, mode:o.mode, label:o.label, qids:o.qids, timed:!!o.timed, limitSec:o.limitSec || null,
    idx:0, answers:{}, attempts:[], started:now, endsAt: o.timed ? now + o.limitSec*1000 : null, qStart:now,
    phase: o.mode === 'test' ? 'question' : 'learn', sub:'answer', editsUsed:0, reviewedQids:[],
    adaptive: o.adaptive || null, noConf: !!o.noConf, examId: o.examId || null, examMode: o.examMode || null };
  S.ui.msrTab = 0;
  write('sessions/' + id, 'set', { kind:o.kind, block:o.block || null, mode:o.mode, label:o.label, timed:!!o.timed, limitSec:o.limitSec || null, start:new Date(now).toISOString(), status:'active', attempts:[], qids:o.qids,
    ...(o.adaptive ? { adaptive:true } : {}), ...(o.examId ? { examId:o.examId, examSection:o.adaptive.section, examMode:o.examMode || null } : {}) });
  startTicker(); render(); window.scrollTo(0,0);
}
function curQ(){ const r = S.run; return S.bank[r.phase === 'edit' ? r.qids[r.editIdx] : r.qids[r.idx]]; }
function curTarget(){
  const r = S.run; if (!r) return null;
  if (r.phase === 'debrief'){ const d = r.debrief; return { q: S.bank[d.list[d.i].qid], get: () => d.retry, set: v => { d.retry = v; } }; }
  if (r.phase === 'edit') return { q: curQ(), get: () => r.editDraft, set: v => { r.editDraft = v; } };
  const q = curQ(); r.answers[q.id] = r.answers[q.id] || {};
  return { q, get: () => r.answers[q.id].answer, set: v => { r.answers[q.id].answer = v; } };
}
function syncReady(){
  const r = S.run; if (!r) return; const t = curTarget(); if (!t || !t.q) return;
  const complete = isComplete(t.q, t.get());
  const conf = r.noConf || (r.answers[t.q.id] && r.answers[t.q.id].confidence != null);
  const nb = $('#next-btn'); if (nb) nb.disabled = !(complete && conf);
  const cb = $('#check-btn'); if (cb) cb.disabled = r.phase === 'debrief' ? !complete : !(complete && conf);
  const sb = $('#savechange-btn'); if (sb) sb.disabled = !complete || r.editsUsed >= 3;
}
function stampTime(){
  const r = S.run; const q = curQ(); if (!q) return;
  const a = r.answers[q.id] = r.answers[q.id] || {};
  const dt = (Date.now() - r.qStart)/1000;
  if (r.phase === 'edit') a.reviewSec = (a.reviewSec || 0) + dt; else a.timeSec = (a.timeSec || 0) + dt;
  r.qStart = Date.now();
}
/* Adaptive runs grow one question at a time: the next one depends on the answer just given. */
const runTotal = r => r.adaptive ? r.adaptive.n : r.qids.length;
const groupOf = q => q && q.passage ? 'p:' + (q.passage.title || '') + ':' + String(q.passage.text || '').length : null;
function adaptivePush(r){
  const A = r.adaptive; if (!A || r.qids.length >= A.n) return false;
  const q = S.bank[r.qids[r.qids.length - 1]], a = r.answers[q.id] || {};
  let id;
  if (A.cat) id = catPush(r, q, a);          // mocks: item response theory (exam-engine.js)
  else {
    A.level = GMATPlanner.levelAfter(A.level, { correct: isCorrect(q, a.answer), unanswered: !isComplete(q, a.answer), timeSec: a.timeSec || 0, expectedSec: expOf(q), confidence: a.confidence == null ? null : a.confidence });
    id = GMATPlanner.nextAdaptive(plannerCtx(todayMinutes(), A.topic), { ...A, used: r.qids, last: { topic: q.topic, group: groupOf(q), correct: isCorrect(q, a.answer) } });
  }
  if (!id){ A.n = r.qids.length; return false; }
  r.qids.push(id);
  write('sessions/' + r.id, 'update', { qids: r.qids });
  return true;
}
function saveDraft(){ const r = S.run; write('sessions/' + r.id, 'update', { draft: clone(r.answers), lastIdx: r.idx }); }
function mkAttempt(q, a, extra){
  const done = isComplete(q, a.answer);
  return Object.assign({ qid:q.id, answer: done ? clone(a.answer) : null, correct: done && isCorrect(q, a.answer), timeSec: Math.round(a.timeSec || 0),
    confidence: a.confidence == null ? null : a.confidence, unanswered: !done, section:q.section, topic:q.topic, type:q.type,
    skill:q.skill || null, ...(q.subtopic ? { subtopic:q.subtopic } : {}), difficulty:q.difficulty || null, expectedSec: expOf(q), at:new Date().toISOString(),
    ...(a.changes ? { changes:a.changes } : {}), ...(a.events ? { events:clone(a.events) } : {}) }, extra || {});
}
/* Answer changes while a question is on screen: counted in every test, with a timeline in mocks. */
function isChange(q, before, after){
  if (isMulti(q)) return Array.isArray(before) && q.parts.some((p, i) => Number.isInteger(before[i]) && Array.isArray(after) && after[i] !== before[i]);
  return Number.isInteger(before) && before !== after;
}
function noteAnswer(t, before){
  const r = S.run; if (!r || r.phase !== 'question' || !t) return;
  const a = r.answers[t.q.id] = r.answers[t.q.id] || {}, after = t.get();
  if (isChange(t.q, before, after)) a.changes = (a.changes || 0) + 1;
  if (r.examId) a.events = [...(a.events || []), [Math.round((a.timeSec || 0) + (Date.now() - r.qStart) / 1000), clone(after)]].slice(-12);
}
function finishRun(timeUp){
  const r = S.run; if (!r) return;
  if (['question','edit'].includes(r.phase)) stampTime();
  stopTicker();
  r.attempts = r.qids.map(qid => { const q = S.bank[qid]; const a = r.answers[qid] || {};
    return mkAttempt(q, a, { reviewSec: Math.round(a.reviewSec || 0), bookmarked: !!a.bookmarked, edited: !!a.edited, changedFrom: a.changedFrom == null ? null : clone(a.changedFrom) }); });
  const dur = Math.round((Date.now() - r.started)/1000);
  r.durationSec = r.limitSec ? Math.min(dur, r.limitSec) : dur;
  r.phase = r.examId && S.exam ? (S.exam.i < S.exam.order.length - 1 ? 'between' : 'examdone') : 'results'; r.timeUp = !!timeUp;
  write('sessions/' + r.id, 'update', { attempts:r.attempts, end:new Date().toISOString(), durationSec:r.durationSec, status:'done', timeUp:!!timeUp, editsUsed:r.editsUsed, draft:null, reviewed:false, reviewedQids:[],
    ...(r.adaptive && !r.adaptive.cat ? { adaptiveLevel: Math.round(r.adaptive.level * 100) / 100 } : {}), ...(r.adaptive && r.adaptive.cat ? { notReached: Math.max(0, r.adaptive.n - r.qids.length) } : {}) });
  if (r.examId && S.exam) examSectionDone(r);
  if (timeUp) toast('Time is up. Unanswered questions count as wrong, as on the real exam.');
  render(); window.scrollTo(0,0);
}
function endRun(goTab){
  const r = S.run; stopTicker();
  if (r && r.mode === 'learn' && !r.closed) write('sessions/' + r.id, 'update', { status:'done', end:new Date().toISOString(), durationSec: Math.round((Date.now() - r.started)/1000) });
  S.run = null; genSeed = Math.floor(Math.random() * 1e9);
  if (goTab){ S.tab = goTab; try { history.replaceState(null, '', '#' + goTab); } catch(e){} }
  render(); window.scrollTo(0,0);
}
function startBlock(key){
  const qids = blockQids(key);
  if (!qids.length){ toast('The questions for this block have not loaded yet.'); return; }
  const b = BLOCKS.find(x => x.key === key);
  startRun({ kind:'diagnostic', block:key, qids, mode:'test', timed:true, limitSec: blockLimit(key), label:`Diagnostic · ${b.section}` });
}
function startLearn(qids, label, kind){ startRun({ kind: kind || 'practice', qids, mode:'learn', timed:false, label }); }
function openResults(sid){
  const s = S.sessions[sid]; if (!s) return;
  const at = clone(s.attempts || []);
  S.run = { id:sid, kind:s.kind, block:s.block, mode:'test', label:s.label || 'Session', qids: at.map(a => a.qid), attempts: at, answers:{}, started: Date.parse(s.start) || Date.now(),
    durationSec:s.durationSec, limitSec:s.limitSec, phase:'results', reviewedQids:[...(s.reviewedQids || [])], editsUsed:s.editsUsed || 0, timeUp:!!s.timeUp, reopened:true, closed:true };
  render(); window.scrollTo(0,0);
}
function newDebrief(list){ return { list, i:0, retry:null, hints:0, tries:0, solved:false, revealed:false, etype:null, msg:null }; }
function buildDebrief(attempts, done){
  const list = [];
  for (const a of attempts){
    if ((done || []).includes(a.qid)) continue; const q = S.bank[a.qid]; if (!q) continue;
    if (a.unanswered) list.push({ qid:a.qid, reason:'unanswered', a });
    else if (!a.correct) list.push({ qid:a.qid, reason:'wrong', a });
    else if (a.confidence != null && a.confidence <= 40) list.push({ qid:a.qid, reason:'guessed', a });
    else if (a.timeSec > 1.5 * expOf(q)) list.push({ qid:a.qid, reason:'slow', a });
  }
  return list;
}
function saveError(q, it, etype, why, rule){
  const t = today(); const prev = S.errors[q.id];
  const doc = prev ? clone(prev) : { qid:q.id, section:q.section, topic:q.topic, subtopic:q.subtopic || '', type:q.type, difficulty:q.difficulty || null, created:t, count:0, history:[], retests:[], relapses:0 };
  delete doc.id;
  doc.count = (doc.count || 0) + 1; doc.lastWrong = t; doc.errorType = etype; doc.why = why; doc.prevention = rule;
  doc.myAnswer = answerText(q, it.a.answer); doc.correctAnswer = correctText(q); doc.correctMethod = q.method || '';
  doc.stemShort = shortStem(q); doc.box = 0; doc.nextDue = addDays(t, INTERVALS[0]); doc.status = 'active';
  doc.history = [...(doc.history || []), { date:t, answer:doc.myAnswer, errorType:etype, why, reason:it.reason, sid:S.run.id }].slice(-20);
  return write('errors/' + q.id, 'set', doc);
}
function recordRetest(q, correct){
  const e = S.errors[q.id]; if (!e) return;
  const d = clone(e); delete d.id;
  d.retests = [...(d.retests || []), { date:today(), correct }].slice(-20);
  if (correct){ d.box = (d.box || 0) + 1; if (d.box >= INTERVALS.length){ d.status = 'retired'; d.nextDue = null; } else d.nextDue = addDays(today(), INTERVALS[d.box]); }
  else { d.box = 0; d.nextDue = addDays(today(), INTERVALS[0]); d.relapses = (d.relapses || 0) + 1; }
  write('errors/' + q.id, 'set', d);
}
function debriefAdvance(){
  const r = S.run, d = r.debrief, it = d.list[d.i];
  if (r.mode === 'test'){ r.reviewedQids = [...(r.reviewedQids || []), it.qid]; write('sessions/' + r.id, 'update', { reviewedQids:r.reviewedQids }); }
  if (d.i < d.list.length - 1){ Object.assign(d, { i:d.i+1, retry:null, hints:0, tries:0, solved:false, revealed:false, etype:null, msg:null }); S.ui.msrTab = 0; render(); window.scrollTo(0,0); return; }
  if (r.mode === 'learn'){ r.phase = 'learn'; r.debrief = null; learnAdvance(); return; }
  write('sessions/' + r.id, 'update', { reviewed:true });
  const n = d.list.length, back = r.kind === 'diagnostic' ? 'diagnostic' : r.kind === 'exam' ? 'mocks' : 'today';
  endRun(back); toast(`Review saved: ${n} question${n > 1 ? 's' : ''} reviewed.`);
}
function learnAdvance(){
  const r = S.run;
  if (r.idx === r.qids.length - 1) adaptivePush(r);
  if (r.idx < r.qids.length - 1){ r.idx++; r.sub = 'answer'; r.qStart = Date.now(); S.ui.msrTab = 0; render(); window.scrollTo(0,0); return; }
  r.phase = 'done'; r.closed = true; stopTicker();
  write('sessions/' + r.id, 'update', { status:'done', end:new Date().toISOString(), durationSec: Math.round((Date.now() - r.started)/1000) });
  render(); window.scrollTo(0,0);
}
function learnCheck(){
  const r = S.run; const q = curQ(); const a = r.answers[q.id]; stampTime();
  const att = mkAttempt(q, a); r.attempts.push(att);
  write('sessions/' + r.id, 'update', { attempts:r.attempts, end:new Date().toISOString(), durationSec: Math.round((Date.now() - r.started)/1000) });
  if (r.kind === 'retest') recordRetest(q, att.correct);
  const slow = att.timeSec > 1.5 * att.expectedSec;
  if (att.correct && (a.confidence == null || a.confidence > 40) && !slow){ r.sub = 'feedback'; render(); return; }
  const reason = !att.correct ? 'wrong' : (a.confidence != null && a.confidence <= 40 ? 'guessed' : 'slow');
  r.debrief = newDebrief([{ qid:q.id, reason, a:att }]); r.phase = 'debrief'; render();
}

/* ------------------------------------------------------------------ run views */
function runCounter(r){
  const base = `Question ${r.idx + 1} of ${runTotal(r)}`;
  return r.adaptive && !r.examId ? `${base} · adaptive, level ${Math.round(r.adaptive.level * 2) / 2}` : base;
}
function testBar(extra){
  const r = S.run;
  return `<div class="testbar"><div class="tb-left"><strong>${esc(r.label)}</strong>${extra ? `<span class="muted">${extra}</span>` : ''}</div><div class="tb-right">${r.phase === 'question' ? (() => { const a = r.answers[r.qids[r.idx]] || {}; return `<button class="flag" data-act="bookmark" aria-pressed="${!!a.bookmarked}">${a.bookmarked ? 'Bookmarked' : 'Bookmark'}</button>`; })() : ''}${r.examId ? `<span class="clock fixed" id="clock" role="timer" aria-label="${r.endsAt ? 'Time left in this section' : 'Time in this section'}">${clockText()}</span>` : `<button class="clock" id="clock" data-act="toggleclock" aria-label="Timer; click to hide or show">${clockText()}</button>`}</div></div>`;
}
function runView(){
  const r = S.run;
  switch (r.phase){
    case 'question': return questionView();
    case 'review': return reviewView();
    case 'edit': return editView();
    case 'results': return resultsView();
    case 'debrief': return debriefView();
    case 'learn': return learnView();
    case 'done': return doneView();
    case 'between': return betweenView();
    case 'break': return breakView();
    case 'examdone': return examDoneView();
  }
  return '';
}
function questionView(){
  const r = S.run, q = curQ(), a = r.answers[q.id] || {};
  const last = r.idx === runTotal(r) - 1;
  const ready = isComplete(q, a.answer) && (r.noConf || a.confidence != null);
  return `${testBar(runCounter(r))}
    ${qBody(q, a.answer, {})}
    ${q.section === 'Data Insights' ? calcWidget() : ''}
    <div class="qfoot">${r.noConf ? '<span></span>' : confPicker(a.confidence)}<div class="row">${r.examId ? '' : '<button class="btn ghost" data-act="endprompt">End section</button>'}<button class="btn primary" id="next-btn" data-act="next" ${ready ? '' : 'disabled'}>${last ? 'Finish section' : 'Next'}</button></div></div>
    <div id="endconfirm" hidden><div class="confirm"><span>End the section now? Questions you have not answered count as wrong.</span><button class="btn small danger" data-act="endnow">End section</button><button class="btn small" data-act="endcancel">Keep going</button></div></div>`;
}
function reviewView(){
  const r = S.run; const left = 3 - r.editsUsed;
  return `${testBar('Review & Edit')}
    <section><h2>Review &amp; Edit</h2><p class="muted">You can open any question. Saving a different answer uses one of your <strong>${left}</strong> remaining change${left === 1 ? '' : 's'}. When the time runs out the section ends.</p>
    <ol class="revlist">${r.qids.map((qid,i) => { const a = r.answers[qid] || {}; return `<li><button data-act="openedit" data-i="${i}"><span>Question ${i+1}</span>${a.bookmarked ? '<span class="fl" aria-label="bookmarked"></span>' : ''}${a.edited ? '<span class="pill">changed</span>' : ''}</button></li>`; }).join('')}</ol>
    <div class="row"><button class="btn primary" data-act="endnow">End section</button></div></section>`;
}
function editView(){
  const r = S.run, q = curQ(), a = r.answers[q.id] || {};
  const can = r.editsUsed < 3;
  return `${testBar(`Editing question ${r.editIdx+1}`)}
    ${qBody(q, r.editDraft, { locked: !can })}
    <div class="qfoot"><p class="muted">${can ? `Changes left: ${3 - r.editsUsed}. Your saved answer: <strong>${esc(answerText(q, a.answer))}</strong>` : 'You have used all 3 changes for this section.'}</p><div class="row"><button class="btn" data-act="backreview">Back to review</button>${can ? `<button class="btn primary" id="savechange-btn" data-act="savechange">Save change</button>` : ''}</div></div>`;
}
function resultsView(){
  const r = S.run, at = r.attempts; const n = at.length;
  const c = at.filter(a => a.correct).length; const ans = at.filter(a => !a.unanswered);
  const times = ans.map(a => a.timeSec);
  const guesses = at.filter(a => !a.unanswered && a.confidence != null && a.confidence <= 40).length;
  const un = at.filter(a => a.unanswered).length;
  const flips = at.filter(a => a.edited && a.changedFrom != null).map(a => { const q = S.bank[a.qid]; return { from: isCorrect(q, a.changedFrom), to: a.correct }; });
  const slow = [...ans].sort((x,y) => (y.timeSec / y.expectedSec) - (x.timeSec / x.expectedSec)).slice(0,3);
  const todo = buildDebrief(at, r.reviewedQids);
  const reviewedAll = r.reopened && !todo.length;
  const cells = [
    ['Correct', `${c}/${n}`], ['Accuracy', pct(n ? c/n : null)], ['Time used', `${fmtTime(r.durationSec)}${r.limitSec ? ' / ' + fmtTime(r.limitSec) : ''}`],
    ['Median time', times.length ? fmtTime(median(times)) : '—'], ['Unanswered', String(un)], ['Low-confidence', String(guesses)],
  ];
  return `<section>
    <p class="eyebrow">${esc(r.label)} · results</p>
    <h1>${c} of ${n} correct${r.timeUp ? ' · time ran out' : ''}</h1>
    ${r.kind === 'diagnostic' ? '<p class="muted">This measures where you start. It is not a GMAT score and is not converted to one.</p>' : r.kind === 'exam' ? '<p class="muted">One section of a mock. Its estimated score and the Examiner’s analysis are on the Mocks tab.</p>' : ''}
    <div class="metrics">${cells.map(([k,v]) => `<div><span class="k">${k}</span><span class="v">${v}</span></div>`).join('')}</div>
    ${flips.length ? `<p class="muted">Answer changes: ${flips.filter(f => !f.from && f.to).length} wrong → right, ${flips.filter(f => f.from && !f.to).length} right → wrong, ${flips.filter(f => f.from === f.to).length} no effect.</p>` : ''}
    ${slow.length ? `<p class="muted">Slowest against expected time: ${slow.map(a => `Q${r.qids.indexOf(a.qid)+1} (${fmtTime(a.timeSec)} vs ${fmtTime(a.expectedSec)})`).join(' · ')}</p>` : ''}
    <div class="box scroll"><table class="tbl"><thead><tr><th>#</th><th>Topic</th><th class="num">Level</th><th>Result</th><th class="num">Time</th><th class="num">Expected</th><th class="num">Confidence</th></tr></thead><tbody>
      ${at.map((a,i) => `<tr><td class="num">${i+1}</td><td>${esc(a.topic)}</td><td class="num">${a.difficulty || '—'}</td><td>${a.unanswered ? '<span class="res-skip">Unanswered</span>' : a.correct ? '<span class="res-ok">✓ Correct</span>' : '<span class="res-no">✗ Wrong</span>'}${a.edited ? ' <span class="pill">changed</span>' : ''}</td><td class="num">${fmtTime(a.timeSec)}</td><td class="num">${fmtTime(a.expectedSec)}</td><td class="num">${a.confidence == null ? '—' : a.confidence + '%'}</td></tr>`).join('')}
    </tbody></table></div>
    <div class="row">${todo.length ? `<button class="btn primary" data-act="reviewstart">Review ${todo.length} question${todo.length > 1 ? 's' : ''}</button>` : ''}<button class="btn" data-act="closeresults">${reviewedAll || !todo.length ? 'Done' : 'Review later'}</button></div>
    ${todo.length ? '<p class="fine">You review wrong, unanswered, low-confidence and slow questions. You try each one again before any answer is shown.</p>' : ''}
  </section>`;
}
/* Why a wrong answer is tempting, from the question's own diagnosis (one note per wrong option). */
function diagnose(q, ans){
  if (ans == null) return [];
  if (isMulti(q)) return q.parts.map((p, i) => Array.isArray(ans) && Number.isInteger(ans[i]) && ans[i] !== p.answer && p.diagnosis && p.diagnosis[ans[i]] ? { label: p.label, pick: p.options[ans[i]], ...p.diagnosis[ans[i]] } : null).filter(Boolean);
  const d = Number.isInteger(ans) && q.diagnosis && q.diagnosis[ans];
  return d ? [{ label: null, pick: LETTERS[ans], ...d }] : [];
}
function diagnosisHTML(list){
  if (!list.length) return '';
  return `<div class="panel stack"><p class="eyebrow">Why your answer was tempting</p><ul class="answer">${list.map(x => `<li>${x.label ? `<b>${inline(x.label)}</b> — you chose ${esc(x.pick)}. ` : `You chose ${esc(x.pick)}. `}${inline(x.why)} <span class="pill">${esc(x.type)}</span></li>`).join('')}</ul></div>`;
}
const REASON = { wrong:['bad','Wrong answer'], unanswered:['warn','Unanswered'], guessed:['warn','Low confidence'], slow:['acc','Slow'] };
function debriefView(){
  const r = S.run, d = r.debrief, it = d.list[d.i], q = S.bank[it.qid], a = it.a;
  const retryable = it.reason === 'wrong' || it.reason === 'unanswered';
  const open = !retryable || d.solved || d.revealed;
  let lead = '';
  if (it.reason === 'wrong') lead = `Your answer <strong>${esc(answerText(q, a.answer))}</strong> is not correct. Try again before you look at anything else.`;
  if (it.reason === 'unanswered') lead = 'You did not answer this one in time. Solve it now, without the clock.';
  if (it.reason === 'guessed') lead = `Correct, but you rated your confidence ${a.confidence}%. A right guess is still a gap.`;
  if (it.reason === 'slow') lead = `Correct in ${fmtTime(a.timeSec)}, against about ${fmtTime(a.expectedSec)} expected. Check whether a faster route existed.`;
  const [tone, label] = REASON[it.reason];
  const body = open ? qBody(q, retryable ? (d.solved ? d.retry : a.answer) : a.answer, { locked:true, reveal:true, userAns: a.answer }) : qBody(q, d.retry, {});
  const hints = d.hints ? `<div><p class="eyebrow">Hints</p><ol class="hints">${q.hints.slice(0, d.hints).map(h => `<li>${inline(h)}</li>`).join('')}</ol></div>` : '';
  let actions = '';
  if (!open){
    actions = `<div class="row"><button class="btn primary" id="check-btn" data-act="dcheck" disabled>Check</button>${d.hints < q.hints.length ? `<button class="btn" data-act="hint">Show hint ${d.hints+1} of ${q.hints.length}</button>` : `<button class="btn" data-act="reveal">Show full solution</button>`}${d.hints > 0 && d.hints < q.hints.length ? '<button class="btn ghost" data-act="reveal">Skip to the solution</button>' : ''}</div>`;
  }
  const diag = it.reason === 'wrong' ? diagnose(q, a.answer) : [];
  const defaultType = d.etype || (diag[0] && diag[0].type) || ({ guessed:'Guessing', unanswered:'Timing' })[it.reason] || null;
  if (open && !d.etype && defaultType) d.etype = defaultType;
  const classify = (it.reason === 'slow' && !d.logSlow) ? `<div class="row"><button class="btn" data-act="logslow">Log it as a Timing issue</button><button class="btn primary" data-act="skipitem">It was fine, next</button></div>` : `
    <div class="card stack"><h3>Log this ${it.reason === 'guessed' ? 'guess' : it.reason === 'slow' ? 'timing issue' : 'error'}</h3>
      <div class="chips" role="group" aria-label="Error type">${ERROR_TYPES.map(([k,desc]) => `<button class="chip" data-act="etype" data-v="${k}" title="${esc(desc)}" aria-pressed="${d.etype === k}">${k}</button>`).join('')}</div>
      <p class="fine" id="etype-desc">${d.etype ? esc((ERROR_TYPES.find(e => e[0] === d.etype) || [])[1]) : 'Pick the main cause.'}${diag.length ? ' Suggested from the answer you chose; change it if the cause was different.' : ''}</p>
      <div><label class="lab" for="why">Why I missed it</label><textarea id="why" rows="2" placeholder="${diag.length ? esc('In your own words, or leave empty to keep: ' + diag.map(x => x.why).join(' ').replace(/\*\*|\^\{|\}|_\{/g, '')) : 'e.g. I took 10% of 40 and forgot that the total volume grows too.'}"></textarea></div>
      <div><label class="lab" for="rule">Prevention rule</label><textarea id="rule" rows="2" placeholder="e.g. In mixture problems, write the new part AND the new total before any equation."></textarea></div>
      <div class="row"><button class="btn primary" data-act="saveerror">Save to error log</button>${it.reason !== 'wrong' && it.reason !== 'unanswered' ? '<button class="btn ghost" data-act="skipitem">Skip</button>' : ''}</div>
    </div>`;
  return `<section>
    <div class="row" style="justify-content:space-between"><p class="eyebrow">${esc(r.label)} · review ${d.i+1} of ${d.list.length}</p><span class="pill ${tone}">${label}</span></div>
    <p class="msg info">${lead}</p>
    ${body}
    ${d.msg ? `<p class="msg ${d.msg.kind}">${esc(d.msg.text)}</p>` : ''}
    ${hints}
    ${actions}
    ${open ? diagnosisHTML(diag) : ''}
    ${open ? solutionHTML(q) : ''}
    ${open ? (it.reason === 'slow' ? `<div class="panel stack"><p class="eyebrow">Solution review</p><ul class="hints"><li>Why did you choose your approach?</li><li>Could you have eliminated answers without calculating?</li><li>Was there an estimate, a smart number or a backsolve that saves time?</li><li>Would you finish it in ${fmtTime(a.expectedSec)} under pressure?</li></ul></div>` : '') + classify : ''}
  </section>`;
}
function learnView(){
  const r = S.run, q = curQ(), a = r.answers[q.id] || {};
  const fb = r.sub === 'feedback'; const att = r.attempts[r.attempts.length - 1];
  return `${testBar(runCounter(r))}
    ${qBody(q, a.answer, fb ? { locked:true, reveal:true, userAns:a.answer } : {})}
    ${q.section === 'Data Insights' && !fb ? calcWidget() : ''}
    ${fb ? `<p class="msg good">Correct in ${fmtTime(att.timeSec)} (expected about ${fmtTime(att.expectedSec)}).</p>${solutionHTML(q)}<div class="panel stack"><p class="eyebrow">Before you move on</p><ul class="hints"><li>Was your route the fastest reliable one, or just the first one you saw?</li><li>Which answers could you have eliminated without calculating?</li></ul></div><div class="row"><button class="btn primary" data-act="lnext">${r.idx === runTotal(r) - 1 ? 'Finish' : 'Next question'}</button><button class="btn ghost" data-act="lend">End practice</button></div>`
      : `<div class="qfoot">${confPicker(a.confidence)}<div class="row"><button class="btn ghost" data-act="lend">End practice</button><button class="btn primary" id="check-btn" data-act="lcheck" ${isComplete(q, a.answer) && a.confidence != null ? '' : 'disabled'}>Check</button></div></div>`}`;
}
function doneView(){
  const r = S.run, at = r.attempts; const c = at.filter(a => a.correct).length;
  return `<section class="card stack"><p class="eyebrow">${esc(r.label)}</p><h1>${c} of ${at.length} right on the first try</h1>
    <p class="muted">Misses went to the error log with a retest tomorrow. ${r.kind === 'retest' ? 'Correct retests move to a longer interval (1 → 3 → 7 → 21 → 45 days).' : ''}</p>
    <div class="row"><button class="btn primary" data-act="closedone">Back to Today</button></div></section>`;
}

/* ------------------------------------------------------------------ tab views */
const VIEWS = {};
VIEWS.today = function(){
  const st = computeStats(), nx = planReady() ? null : nextStep(), al = S.dbStatus === 'ok' ? alerts() : [], cal = calibration(), tg = target();
  const tiles = [
    ['Questions', st.n ? String(st.n) : '0', 'answered so far'],
    ['Accuracy', pct(st.acc), 'first attempts'],
    ['Timed accuracy', pct(st.tacc), st.tn ? `${st.tn} timed questions` : 'from timed sets'],
    ['Time vs pace', st.pace ? st.pace.toFixed(2) + '×' : '—', '1.00× = real test pace'],
    ['Study hours', st.hours ? st.hours.toFixed(1) : '0.0', 'sessions + logged time'],
    ['Retests due', String(st.due), 'spaced review'],
  ];
  const recent = Object.values(S.sessions).filter(s => s.status === 'done').sort((a,b) => String(b.start).localeCompare(String(a.start))).slice(0,6);
  const hasCal = cal.some(x => x.n);
  return `<section class="hero">
      ${planCard(nx)}
      <div class="card"><p class="eyebrow" style="margin-bottom:8px">Programme phase</p><ol class="phases">${PHASES.map((p,i) => `<li class="${i < phase() ? 'done' : i === phase() ? 'cur' : ''}"><span class="n">${i}</span><span>${esc(p)}</span></li>`).join('')}</ol></div>
    </section>
    <section><div class="tiles">${tiles.map(([k,v,c]) => `<div class="tile"><span class="k">${k}</span><span class="v">${v}</span><span class="c">${c}</span></div>`).join('')}</div></section>
    ${al.length ? `<section><h2>What the data says</h2><ul class="alerts">${al.map(x => `<li><span class="pill ${x.level}">${x.tag}</span><span>${esc(x.text)}</span></li>`).join('')}</ul></section>` : ''}
    <section class="grid2">
      <div class="stack"><h2>Confidence vs results</h2>${hasCal ? `<div class="cal">${cal.map(x => `<div class="cal-row"><span class="mono">${x.c}%</span><div class="meter" role="img" aria-label="${x.c}% confidence: ${x.n ? pct(x.acc) + ' correct' : 'no data'}"><span style="width:${x.acc == null ? 0 : Math.round(x.acc*100)}%"></span></div><span class="mono fine">${x.n ? `${pct(x.acc)} of ${x.n}` : '—'}</span></div>`).join('')}</div><p class="fine">Well calibrated: the bar at 80% sits near 80%.</p>` : '<p class="muted">Every answer asks how sure you are. After a few questions this shows whether your confidence matches your results.</p>'}</div>
      <div class="stack"><h2>Recent sessions</h2>${recent.length ? `<div class="box scroll"><table class="tbl"><thead><tr><th>Date</th><th>Session</th><th class="num">Score</th><th class="num">Time</th></tr></thead><tbody>${recent.map(s => { const at = s.attempts || []; const c = at.filter(a => a.correct).length; return `<tr><td>${fmtDate(s.start)}</td><td>${s.mode === 'test' ? `<button class="linkbtn" data-act="openResults" data-arg="${esc(s.id)}">${esc(s.label || s.kind)}</button>` : esc(s.label || s.kind)}</td><td class="num">${c}/${at.length}</td><td class="num">${fmtTime(s.durationSec)}</td></tr>`; }).join('')}</tbody></table></div>` : '<p class="muted">Nothing yet. Your first session will be a diagnostic block.</p>'}</div>
    </section>
    <section class="grid2">
      <div class="stack"><h2>The exam you are training for</h2><ul class="facts">
        <li><b>Target</b><span>${tg ? `${esc(tg.label)} <span class="fine">(${esc(tg.note)})</span>` : 'Not set yet: choose it in Profile.'}</span></li>
        <li><b>Exam date</b><span>${fmtDate(examDate())} · test center</span></li>
        <li><b>Format</b><span>Quant 21 · Verbal 23 · Data Insights 20 questions, 45 min each, one optional 10-min break</span></li>
        <li><b>Pace</b><span class="mono">Q 2:09 · V 1:57 · DI 2:15 per question</span></li>
        <li><b>Edits</b><span>Up to 3 answer changes per section, only if time is left</span></li>
        <li><b>Scale</b><span>Total 205–805, each section 60–90, all three weigh the same</span></li>
      </ul><p class="fine">Verified on mba.com on 29 Sep 2026.</p></div>
      <form class="stack" data-form="studylog" data-dirty><h2>Log study time</h2><p class="muted">For work outside GMAT Lab, like reading the Official Guide.</p>
        <div class="fgrid"><div><label class="lab" for="sl-min">Minutes</label><input id="sl-min" type="number" min="5" max="600" step="5" required></div><div><label class="lab" for="sl-date">Date</label><input id="sl-date" type="date" value="${today()}" required></div></div>
        <div><label class="lab" for="sl-note">What you did</label><input id="sl-note" type="text" placeholder="e.g. OG Quant review, chapter on number properties"></div>
        <div class="row"><button class="btn" type="submit">Add</button></div></form>
    </section>`;
};
function nextStep(){
  if (S.dbStatus === 'absent') return { title:'This browser cannot save progress', why:'Storage is blocked here, often by private browsing. Open GMAT Lab in a normal window.' };
  if (S.dbStatus === 'error') return { title:'Reconnect to your data', why:'Reload the page to reconnect.' };
  return { title:'Loading your data…', why:'One moment.' };
}
/* ------------------------------------------------------------------ coach: rule-based plan (planner.js) */
const MINUTES = [15, 30, 45, 60, 90, 120];
function planReady(){ return S.dbStatus === 'ok' && ['bank','profile','sessions','errors','mocks'].every(c => S.loaded.has(c)); }
function todayMinutes(){
  if (MINUTES.includes(S.ui.minutes)) return S.ui.minutes;
  let v = null; try { v = +localStorage.getItem('gmatlab.minutes'); } catch(e){}
  if (MINUTES.includes(v)) return v;
  const iv = interview(); const per = iv.hoursPerWeek ? iv.hoursPerWeek * 60 / ((iv.days || []).length || 5) : 45;
  return MINUTES.reduce((best, m) => Math.abs(m - per) < Math.abs(best - per) ? m : best, 45);
}
function plannerCtx(minutes, topic){
  const at = attemptsAll(); const seen = new Set(at.map(a => a.qid));
  const topics = SECTIONS.flatMap(sec => [...new Set([...SYLLABUS[sec], ...at.filter(a => a.section === sec).map(a => a.topic)])].map(t => ({ topic:t, section:sec, ...mastery(t) })));
  const pend = pendingReview(), nb = BLOCKS.find(b => !blockDone(b.key));
  return { today: today(), minutes, interviewDone: !!interview().done, phase: phase(),
    pendingReview: pend ? { id: pend.id, label: pend.label || 'last session', n: Math.max(1, buildDebrief(pend.attempts || [], pend.reviewedQids).length) } : null,
    nextBlock: nb && blockQids(nb.key).length ? { key: nb.key, name: nb.name, section: nb.section, n: blockQids(nb.key).length, minutes: Math.round(blockLimit(nb.key) / 60) } : null,
    diagnosticDone: BLOCKS.every(b => blockDone(b.key)),
    due: dueErrors().map(e => ({ qid: e.qid, topic: e.topic, nextDue: e.nextDue })),
    attempts: at, topics, errors: Object.values(S.errors),
    pool: practicePool().map(q => ({ id: q.id, topic: q.topic, section: q.section, type: q.type, group: groupOf(q), difficulty: q.difficulty || 3, seen: seen.has(q.id), gen: q.set === 'generated' }))
      .concat(genPool(topic).map(q => ({ ...q, seen: seen.has(q.id) }))),
    mocks: loggedMocks(), hoursPerWeek: interview().hoursPerWeek || null, claudePlan: S.profile.coach || null,
    examinerFocus: examinerFocus().map(f => f.topic), drill: drillPlanInfo(), ogDue: dueOgErrors().length,
    // computed only when the plan or the coach's answers read them
    get nextMock(){ return nextMockNow(); },
    get mockPoolReady(){ return SECTIONS.every(s => poolCheck(s).ok); },
    get ability(){ const ab = abilityNow(); return { estimate: ab.estimatedScore, confidence: ab.confidence.label, n: ab.n }; },
    get latestSim(){ const m = fullSims().slice(-1)[0]; return m ? { date: m.date, total: m.total, range: m.range } : null; } };
}
const CTA = { interview:'Open the interview', review:'Continue the review', diagnostic:'Start', retests:'Start retests', weak:'Start', mixed:'Start', fullmock:'Open Mocks', drill:'Start' };
function planCard(nx){
  if (nx) return `<div class="card next"><p class="eyebrow">Next step · ${fmtDate(today())}</p><h1>${esc(nx.title)}</h1><p class="muted">${esc(nx.why)}</p></div>`;
  const min = todayMinutes(), p = GMATPlanner.plan(plannerCtx(min)), [first, ...rest] = p.items;
  const btn = (it, cls) => it.act ? `<button class="btn ${cls}" data-act="${it.act}" ${it.arg ? `data-arg="${esc(it.arg)}"` : ''}>${CTA[it.id] || 'Start'}</button>` : '';
  const theory = (it, cls) => it.topic && lessonOf(it.topic) ? `<button class="btn ghost ${cls}" data-act="lesson" data-arg="${esc(it.topic)}">Theory</button>` : '';
  return `<div class="card next">
    <div class="row" style="justify-content:space-between"><p class="eyebrow">Today · ${fmtDate(today())} · plan for ${min} min</p>
      <div class="seg" role="group" aria-label="Time you have today">${MINUTES.map(m => `<button data-act="setmin" data-v="${m}" aria-pressed="${m === min}">${m}′</button>`).join('')}</div></div>
    <h1>${esc(first.title)}</h1><p class="muted">${esc(first.why)}</p>
    ${first.act ? `<div class="row" style="margin-top:16px">${btn(first, 'primary')}${theory(first, '')}${first.minutes ? `<span class="fine mono">~${first.minutes} min</span>` : ''}</div>` : ''}
    ${rest.length ? `<ol class="plan">${rest.map(it => `<li><div><b>${esc(it.title)}</b><span class="fine">${esc(it.why)}</span></div><span class="mono fine">${it.minutes ? '~' + it.minutes + ' min' : ''}</span><span class="row" style="gap:6px;flex-wrap:nowrap">${theory(it, 'small')}${btn(it, 'small')}</span></li>`).join('')}</ol>` : ''}
    <p class="fine" style="margin-top:12px">Built from your answers, times, confidence and error log. <button class="linkbtn" data-act="tab" data-arg="coach">See why on the Coach tab</button></p>
  </div>`;
}
/* Coach sets are adaptive: weak topics first, difficulty following your answers. */
function startSmart(mode, n, opts){
  const ctx = plannerCtx(todayMinutes(), opts.topic);
  const A = { n, topic: opts.topic || null, section: opts.section || null, exam: false };
  A.level = GMATPlanner.startLevel(ctx, A);
  const first = GMATPlanner.nextAdaptive(ctx, { ...A, used: [] });
  if (!first){ toast('No questions are available for this yet.'); return; }
  const label = `Coach set · ${opts.topic || opts.section || 'mixed'}`;
  if (mode === 'timed'){ const pace = A.section ? PACE[A.section] : (PACE['Quant'] + PACE['Verbal'] + PACE['Data Insights']) / 3; startRun({ kind:'practice', qids:[first], mode:'test', timed:true, limitSec: Math.round(n * pace), label: label + ' · timed', adaptive: A }); }
  else startRun({ kind:'practice', qids:[first], mode:'learn', timed:false, label, adaptive: A });
}
/* ------------------------------------------------------------------ mock exams: the Mock Exam Engine
   exam-spec.js says what the exam is; exam-engine.js builds the blueprint, chooses questions, scores, analyses, keeps the
   ability model and plays the examiner. This section runs a mock, saves it and shows the score, the review and the report. */
const SPEC = window.GMATSpec, ENGINE = window.GMATEngine;
const EXAM_ORDERS = [['Quant','Verbal','Data Insights'],['Quant','Data Insights','Verbal'],['Verbal','Quant','Data Insights'],['Verbal','Data Insights','Quant'],['Data Insights','Quant','Verbal'],['Data Insights','Verbal','Quant']];
const SHORT = { 'Quant':'Q', 'Verbal':'V', 'Data Insights':'DI' };
const SCORE_NOTE = 'A GMAT Lab estimate on the official scales. GMAC does not publish how answers become scores, and GMAT Lab’s questions are not calibrated on real test takers, so an official practice exam stays the reference.';
const specOf = section => SPEC.sections.find(s => s.section === section);
const modeOf = id => SPEC.modes.find(m => m.id === id) || SPEC.modes[0];
const blockOf = section => BLOCKS.find(b => b.section === section).key;
function examUI(){ const U = S.ui.exam = S.ui.exam || {}; if (U.order == null) U.order = '0'; if (!U.section) U.section = 'Quant'; return U; }
function examOrder(){ return EXAM_ORDERS[+examUI().order] || EXAM_ORDERS[0]; }
const simulations = () => Object.values(S.mocks).filter(m => m.kind === 'simulation').sort((a, b) => String(a.end || a.date).localeCompare(String(b.end || b.date)));
const loggedMocks = () => Object.values(S.mocks).filter(m => m.kind !== 'simulation').sort((a, b) => String(a.date).localeCompare(String(b.date)));
const officialMocks = () => loggedMocks().filter(m => /official/i.test(m.name || ''));
const fullSims = () => simulations().filter(m => m.comparable && m.total != null);
const r2 = x => x == null || isNaN(x) ? null : Math.round(x * 100) / 100;
const toSection = th => Math.round(ENGINE.thetaToSection(SPEC, th));
const levelOf = s => s == null ? '—' : (1 + 5 * s).toFixed(1);
function fmtLong(sec){ sec = Math.max(0, Math.round(sec || 0)); return sec >= 3600 ? Math.floor(sec / 3600) + ':' + pad(Math.floor(sec % 3600 / 60)) + ':' + pad(sec % 60) : fmtTime(sec); }

/* User ability model: every answer (diagnostic, practice, retests, mocks), recomputed only when the answers change. */
let abilityMemo = { key: null, model: null };
function abilityNow(){
  const at = attemptsAll(), key = at.length + '|' + (at.length ? at[at.length - 1].at : '') + '|' + Object.keys(S.sessions).length;
  if (abilityMemo.key === key) return abilityMemo.model;
  const rows = at.map(a => { const q = GEN && GEN.isGenerated(a.qid) ? null : S.bank[a.qid]; return { ...a, skill: a.skill || (q && q.skill) || null, irt: q && q.irt, difficultyScore: q && q.difficultyScore, mode: (S.sessions[a.sid] || {}).mode }; });
  abilityMemo = { key, model: ENGINE.abilityModel(SPEC, rows, { now: new Date().toISOString() }) };
  return abilityMemo.model;
}
/* Earlier errors by category, from the error log and earlier mocks, so the examiner can tell a habit from a one-off. */
function catOfType(t){ return Object.keys(SPEC.errorCategories).find(k => SPEC.errorCategories[k].from.includes(t)) || null; }
function errorHistory(exceptId){
  const out = [], logged = new Set();
  for (const e of Object.values(S.errors)) for (const h of (e.history || [])){ const c = catOfType(h.errorType); if (c){ logged.add(e.qid); out.push({ topic: e.topic, category: c, date: h.date }); } }
  for (const m of simulations()) if (m.id !== exceptId) for (const e of (m.errors || [])) if (!logged.has(e.qid)) out.push({ topic: e.topic, category: e.category, date: m.date });
  return out;
}
function errorsByCategory(days){ const out = {}; for (const h of errorHistory(null)) if (!days || daysBetween(String(h.date).slice(0, 10), today()) <= days) out[h.category] = (out[h.category] || 0) + 1; return out; }

/* The questions a mock section may use: never seen, not reported, official-like; written ones plus fresh generated ones. */
function mockPool(section){
  if (!blockDone(blockOf(section))) return [];
  const seen = new Set(attemptsAll().map(a => a.qid)), own = id => Object.prototype.hasOwnProperty.call(S.bank, id);
  const written = Object.values(S.bank).filter(q => q.section === section && q.set !== 'diagnostic' && !(GEN && GEN.isGenerated(q.id)) && !q.flagged && q.officialLike !== false && !seen.has(q.id))
    .map(q => ENGINE.itemParams(SPEC, { ...q, group: groupOf(q) }));
  const gen = GEN ? GEN.candidates({ seed: genSeed + 7, per: section === 'Data Insights' ? 6 : 2, section }).filter(m => !seen.has(m.id) && !(own(m.id) && S.bank[m.id].flagged)).map(m => ENGINE.itemParams(SPEC, m)) : [];
  return written.concat(gen);
}
/* Can the pool fill a section's blueprint? Counts only: near-duplicates are skipped while the mock runs. */
let poolMemo = { key: null, map: {} };
function poolCounts(section){
  const key = attemptsAll().length + '|' + Object.keys(S.bank).length + '|' + BLOCKS.map(b => blockDone(b.key) ? 1 : 0).join('');
  if (poolMemo.key !== key) poolMemo = { key, map: {} };
  if (poolMemo.map[section]) return poolMemo.map[section];
  const sp = specOf(section), pool = mockPool(section), have = {}, groups = {}, ps = sp.passageSize || [3, 4];
  for (const it of pool){ if (it.group) (groups[it.group] = groups[it.group] || []).push(it); else { const c = ENGINE.categoryOfItem(SPEC, sp, it); have[c] = (have[c] || 0) + 1; } }
  for (const g of Object.values(groups)) if (g.length >= ps[0]){ const c = ENGINE.categoryOfItem(SPEC, sp, g[0]); have[c] = (have[c] || 0) + Math.min(g.length, ps[1]); }
  return poolMemo.map[section] = { open: blockDone(blockOf(section)), have, total: Object.values(have).reduce((s, v) => s + v, 0) };
}
function poolCheck(section, cats){
  const sp = specOf(section), pc = poolCounts(section); cats = cats || sp.categories;
  if (!pc.open) return { section, ok: false, text: `${section} opens after its diagnostic block.` };
  const short = Object.entries(cats).filter(([c, [mn]]) => (pc.have[c] || 0) < mn);
  if (short.length || pc.total < sp.questionCount) return { section, ok: false, text: `${section}: not enough unseen questions yet (${short.length ? short.map(([c, [mn]]) => `${c} ${pc.have[c] || 0} of ${mn}`).join(', ') : `${pc.total} of ${sp.questionCount}`}). Claude’s daily review adds more.` };
  return { section, ok: true, text: `${section}: ready` };
}
const describeCache = new Map();
function describeQ(id){
  if (describeCache.has(id)) return describeCache.get(id);
  const q = S.bank[id];
  const d = q ? { features: ENGINE.features(q), letter: isMulti(q) || q.type === 'DS' ? null : LETTERS[q.answer] } : null;
  describeCache.set(id, d); return d;
}
/* The examiner's signals for the planner: focus topics after the last mock, and whether a new full mock is worth it. */
function lastFullDate(){ const f = fullSims(); return f.length ? f[f.length - 1].date : null; }
function examinerFocus(){ const last = simulations().slice(-1)[0]; return last && daysBetween(last.date, today()) <= (last.focusDays || 9) ? (last.focus || []) : []; }
function nextMockNow(){
  const lf = lastFullDate(), since = lf ? attemptsAll().filter(a => String(a.at).slice(0, 10) > lf) : [];
  const last = fullSims().slice(-1)[0];
  return { ...ENGINE.nextMockDecision(SPEC, lf, since, last ? (last.focus || []) : [], today()), lastFull: lf };
}

function startMock(modeId){
  if (S.run) return;
  const mode = modeOf(modeId), U = examUI();
  const order = mode.sections === 'all' ? examOrder() : [U.section];
  if (mode.requiresReadiness && !nextMockNow().ready){ toast('The Examiner does not recommend a full mock yet: see its checks on this page.'); return; }
  const bp = ENGINE.blueprint(SPEC, mode.id, order.map(s => specOf(s).id), abilityNow());
  const bad = order.map((s, i) => poolCheck(s, bp.sections[i].categories)).find(c => !c.ok);
  if (bad){ toast(bad.text); return; }
  S.exam = { id: uid('x'), mode: mode.id, order, i: 0, sids: [], done: [], breakUsed: false, bp, taken: [], start: new Date().toISOString() };
  startExamSection();
}
function startExamSection(){
  const X = S.exam, section = X.order[X.i], bps = X.bp.sections[X.i], mode = modeOf(X.mode);
  X.st = ENGINE.newSectionState(bps); X.pool = mockPool(section);
  const first = ENGINE.selectNext(SPEC, X.st, X.pool, { describe: describeQ, taken: new Set(X.taken) });
  if (!first){ toast('Not enough unseen questions for this section.'); S.exam = null; endRun('mocks'); return; }
  const label = X.order.length > 1 ? `${mode.name} · ${section} · section ${X.i + 1} of ${X.order.length}` : `${mode.name} · ${section}`;
  startRun({ kind:'exam', mode:'test', timed: mode.timed, limitSec: mode.timed ? bps.duration : null, qids:[first], label, noConf: true, examId: X.id, examMode: X.mode,
    adaptive: { n: bps.questionCount, section, cat: true, level: 0 } });
}
/* After each answer: update the provisional ability and choose the next question (blueprint, information, no near-duplicates). */
function catPush(r, q, a){
  const X = S.exam; if (!X || !X.st || X.id !== r.examId) return null;
  ENGINE.record(SPEC, X.st, q.id, isCorrect(q, a.answer));
  return ENGINE.selectNext(SPEC, X.st, X.pool, { describe: describeQ, taken: new Set(X.taken) });
}
function examSectionDone(r){
  const X = S.exam; if (!X || X.id !== r.examId) return;
  X.done.push({ section: r.adaptive.section, sid: r.id, attempts: clone(r.attempts), durationSec: r.durationSec, limitSec: r.limitSec, timeUp: !!r.timeUp, editsUsed: r.editsUsed,
    notReached: Math.max(0, r.adaptive.n - r.qids.length) });
  X.taken.push(...r.qids); X.sids.push(r.id);
  if (X.i === X.order.length - 1) X.record = saveMockRecord(X);
}
function examNext(){ const X = S.exam; if (!X) return; stopTicker(); X.i++; startExamSection(); }

/* Score and analysis of one section from its attempts. Questions not reached before time ran out count as wrong. */
function sectionResult(d){
  const params = {};
  for (const a of d.attempts){ const q = S.bank[a.qid]; params[a.qid] = ENGINE.itemParams(SPEC, q ? { ...q, group: groupOf(q) } : { id: a.qid, type: a.type, difficulty: a.difficulty }); }
  const answered = d.attempts.filter(a => !a.unanswered), missing = d.attempts.length - answered.length + (d.notReached || 0);
  const sc = ENGINE.scoreSection(SPEC, answered.map(a => ({ it: params[a.qid], y: a.correct ? 1 : 0 })), missing);
  const an = ENGINE.analyzeSection(SPEC, { section: d.section, attempts: d.attempts, params, durationSec: d.durationSec, limitSec: d.limitSec, theta: sc.theta });
  return { section: d.section, sc, an, params, questions: d.attempts.length + (d.notReached || 0), missing };
}
function saveMockRecord(X){
  const mode = modeOf(X.mode), ab = abilityNow(), hist = errorHistory(X.id);
  const secs = X.done.map(d => ({ ...sectionResult(d), d }));
  const errors = secs.flatMap(s => ENGINE.classifyErrors(SPEC, { section: s.section, attempts: s.d.attempts, theta: s.sc.theta }, id => S.bank[id], ab, hist).map(e => ({ ...e, section: s.section })));
  const ex = ENGINE.examine(SPEC, null, Object.fromEntries(secs.map(s => [s.section, s.an])), errors, ab);
  for (const s of secs) if (s.d.notReached){ ex.categories['Timing Error'] = (ex.categories['Timing Error'] || 0) + s.d.notReached; ex.findings.unshift(`${s.section}: ${s.d.notReached} question${s.d.notReached > 1 ? 's' : ''} not reached before time ran out; each counts as wrong.`); }
  const tot = ENGINE.scoreTotal(SPEC, secs.map(s => ({ score: s.sc.score, range: s.sc.range })));
  const sum = f => secs.reduce((t, s) => t + (f(s) || 0), 0);
  const ans = s => s.d.attempts.filter(a => !a.unanswered);
  const usedT = sum(s => ans(s).reduce((t, a) => t + (a.timeSec || 0), 0)), expT = sum(s => ans(s).reduce((t, a) => t + (a.expectedSec || 0), 0));
  const rec = { kind: 'simulation', mode: mode.id, modeName: mode.name, comparable: !!mode.comparable, timed: !!mode.timed, spec: `${SPEC.examName} ${SPEC.version}`,
    date: today(), start: X.start, end: new Date().toISOString(), order: X.order, breakUsed: X.breakUsed, sids: X.sids,
    sections: secs.map(s => ({ section: s.section, sid: s.d.sid, score: s.sc.score, range: s.sc.range, theta: s.sc.theta, se: s.sc.se, questions: s.questions, answered: s.an.answered, correct: s.an.correct,
      unanswered: s.missing, notReached: s.d.notReached, timeUsed: s.d.durationSec, timeLimit: s.d.limitSec, timeEfficiency: r2(s.an.timeEfficiency), timeLost: Math.round(s.an.timeLost),
      avgDifficulty: r2(s.an.avgDifficulty), editsUsed: s.d.editsUsed, timeUp: s.d.timeUp })),
    total: tot ? tot.total : null, range: tot ? tot.range : null, durationSec: sum(s => s.d.durationSec), accuracy: r2(sum(s => s.an.correct) / sum(s => s.questions)),
    timeEfficiency: usedT ? r2(expT / usedT) : null, unanswered: sum(s => s.missing),
    errorCategories: ex.categories, errors, focus: ex.focus, findings: ex.findings, focusDays: ex.focusDays,
    ability: { overall: r2(ab.overallAbility.theta), sections: Object.fromEntries(Object.entries(ab.sections).map(([k, v]) => [k, r2(v.theta)])), estimate: ab.estimatedScore.total, range: ab.estimatedScore.range } };
  write('mocks/' + X.id, 'set', rec);
  return { id: X.id, ...rec };
}

function betweenView(){
  const X = S.exam, next = X.order[X.i + 1], B = SPEC.navigationRules.breaks;
  const canBreak = !X.breakUsed && B.count > 0 && B.afterSection.includes(X.i + 1);
  const later = !X.breakUsed && B.afterSection.some(k => k > X.i + 1 && k < X.order.length);
  return `<section class="card stack"><p class="eyebrow">Section ${X.i + 1} of ${X.order.length} complete</p><h1>Next: ${esc(next)}</h1>
    <p class="muted">${canBreak ? `You may take the optional ${B.minutes}-minute break now${later ? ' or after the next section' : ''}. On the real exam it is the only break.` : X.breakUsed ? 'You have used your break. The next section starts when you continue.' : 'No break at this point.'} Your score comes after the last section.</p>
    <div class="row"><button class="btn primary" data-act="examnext">Start ${esc(next)}</button>${canBreak ? `<button class="btn" data-act="exambreak">Take the ${B.minutes}-minute break</button>` : ''}</div></section>`;
}
function breakView(){
  const r = S.run, next = S.exam.order[S.exam.i + 1];
  return `<section class="card stack"><p class="eyebrow">Optional break</p><h1 class="mono" id="breakclock">${fmtTime((r.breakEnds - Date.now()) / 1000)}</h1>
    <p class="muted">Stand up, drink some water, stay off your phone. ${esc(next)} starts automatically when the break ends.</p>
    <div class="row"><button class="btn primary" data-act="examnext">End the break and start ${esc(next)}</button></div></section>`;
}
function percentileNote(){
  const tg = target();
  return 'GMAC revises its percentile table every year, so GMAT Lab does not turn estimates into percentiles.' + (tg ? ` For reference, your target (${tg.label}) is ${tg.note}.` : '');
}
/* After the last section: the score only, as on the real exam. Answers wait for the review, a separate step. */
function examDoneView(){
  const X = S.exam, m = X.record; if (!m) return '';
  const full = m.total != null, s0 = m.sections[0];
  const cells = [['Total time', fmtLong(m.durationSec)], ['Answered', `${m.sections.reduce((t, s) => t + s.answered, 0)} of ${m.sections.reduce((t, s) => t + s.questions, 0)}`], ['Unanswered', String(m.unanswered)], ['Break', X.order.length > 1 ? (m.breakUsed ? 'taken' : 'not taken') : '—']];
  return `<section class="stack"><p class="eyebrow">${esc(m.modeName)} · ${m.order.map(x => SHORT[x]).join(' → ')} · ${fmtDate(m.date)}</p>
    <h1>${full ? `Estimated score: ${m.total}` : `Estimated ${esc(s0.section)} score: ${s0.score}`}</h1>
    <p class="muted" style="max-width:72ch">Range ${full ? `${m.range[0]}–${m.range[1]}` : `${s0.range[0]}–${s0.range[1]}`}: one standard error either side. ${esc(SCORE_NOTE)}</p>
    <div class="metrics m4">${cells.map(([k, v]) => `<div><span class="k">${k}</span><span class="v">${v}</span></div>`).join('')}</div>
    <div class="box scroll"><table class="tbl"><thead><tr><th>Section</th><th class="num">Score</th><th class="num">Range</th><th class="num">Time used</th><th class="num">Answered</th></tr></thead><tbody>
      ${m.sections.map(s => `<tr><td>${esc(s.section)}</td><td class="num"><strong>${s.score}</strong></td><td class="num">${s.range[0]}–${s.range[1]}</td><td class="num">${fmtTime(s.timeUsed)}${s.timeLimit ? ' / ' + fmtTime(s.timeLimit) : ''}</td><td class="num">${s.answered} of ${s.questions}</td></tr>`).join('')}
    </tbody></table></div>
    <p class="fine">${esc(percentileNote())}${m.comparable ? '' : ' This mode is kept out of your score trend.'}</p>
    <div class="row"><button class="btn primary" data-act="mockreport" data-arg="${esc(X.id)}">Examiner report</button><button class="btn" data-act="mockreview" data-arg="${esc(X.id)}">Review the exam</button><button class="btn ghost" data-act="examclose">Done</button></div>
    <p class="fine">As on the real exam, your answers are not shown with the score. The review is the next, separate step; the misses also wait in Today’s plan.</p></section>`;
}
VIEWS.coach = function(){
  if (!planReady()) return `<section><h1>Coach</h1><p class="muted">${esc(nextStep().why)}</p></section>`;
  const ctx = plannerCtx(todayMinutes()), key = S.ui.coachQ || 'today', a = GMATPlanner.answer(ctx, key);
  const w = GMATPlanner.topicWeights(ctx).filter(t => t.unseen || t.n || t.recentErr).slice(0, 10);
  const maxW = Math.max(...w.map(t => t.weight), 1);
  const cp = S.profile.coach;
  const fresh = cp && cp.updatedAt && daysBetween(String(cp.updatedAt).slice(0, 10), today()) <= 9;
  return `<section><h1>Coach</h1><p class="muted" style="max-width:70ch">Answers from your own data: every answer, time, confidence rating and logged error. It runs in this page, with no AI and no cost, and updates as you practise.</p></section>
  <section class="card stack"><div class="chips" role="group" aria-label="Questions for the coach">${GMATPlanner.QUESTIONS.map(([k, l]) => `<button class="chip" data-act="coachq" data-v="${k}" aria-pressed="${k === key}">${esc(l)}</button>`).join('')}</div>
    <h2>${esc(a.title)}</h2><ul class="answer">${a.lines.map(l => `<li>${esc(l)}</li>`).join('')}</ul>
    ${key === 'weakness' ? (() => { const ts = GMATPlanner.topicWeights(ctx).filter(t => t.n > 0 && (t.status <= 2 || t.recentErr) && lessonOf(t.topic)).slice(0, 3); return ts.length ? `<div class="row">${ts.map(t => `<button class="btn small" data-act="lesson" data-arg="${esc(t.topic)}">Study ${esc(t.topic)}</button>`).join('')}</div>` : ''; })() : ''}</section>
  <section class="grid2">
    <div class="stack"><h2>Where your practice goes</h2><p class="muted">Coach sets draw topics in proportion to these weights: weak topics come up most, strong ones now and then so they stay sharp.</p>
      ${w.length ? `<div class="box scroll"><table class="tbl"><thead><tr><th>Topic</th><th>Status</th><th>Weight</th><th class="num">Unseen</th></tr></thead><tbody>${w.map(t => `<tr><td>${esc(t.topic)}</td><td><span class="status st${t.status}"></span>${STATUS[t.status]}</td><td><div class="wbar" role="img" aria-label="weight ${t.weight.toFixed(2)}"><span style="width:${Math.round(t.weight / maxW * 100)}%"></span></div></td><td class="num">${t.unseen}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Nothing to weigh yet. Take the diagnostic first.</p>'}</div>
    <div class="stack"><h2>Claude’s review</h2>
      ${cp ? `<div class="card stack"><p class="eyebrow">${cp.weekOf ? 'Week of ' + esc(fmtDate(cp.weekOf)) + ' · ' : ''}written ${esc(fmtDate(String(cp.updatedAt || '').slice(0, 10)))}${fresh ? '' : ' · older than a week'}</p>
        ${cp.summary ? `<div class="stack">${rich(cp.summary)}</div>` : ''}
        ${Array.isArray(cp.focus) && cp.focus.length ? `<div><p class="eyebrow">Focus</p><ul class="answer">${cp.focus.map(f => `<li><b>${esc(f.topic)}</b>${f.why ? ': ' + esc(f.why) : ''}</li>`).join('')}</ul></div>` : ''}
        ${Array.isArray(cp.tasks) && cp.tasks.length ? `<div><p class="eyebrow">This week</p><ul class="answer">${cp.tasks.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>` : ''}
        ${cp.newQuestions ? `<p class="fine">${esc(String(cp.newQuestions))} new questions added to Practice.</p>` : ''}
        ${fresh && Array.isArray(cp.focus) && cp.focus.length ? '<p class="fine">Focus topics get extra weight in your plan and coach sets.</p>' : ''}</div>`
      : `<p class="muted">Every morning Claude reads your synced progress, writes a review here and adds new questions on your weak topics and for the Verbal mocks. It needs GitHub sync on (Settings).</p>`}</div>
  </section>`;
};
VIEWS.diagnostic = function(){
  const cards = BLOCKS.map(b => {
    const n = blockQids(b.key).length, lim = blockLimit(b.key);
    const done = doneSession(b.key);
    const broken = diagSessions(b.key).filter(s => s.status === 'active' && !(S.run && S.run.id === s.id));
    let status, actions;
    if (done){ const at = done.attempts || []; const c = at.filter(a => a.correct).length;
      status = `<span class="pill good">Done ${fmtDate(done.start)}</span> ${done.reviewed ? '<span class="pill">Reviewed</span>' : '<span class="pill warn">Review pending</span>'}<p class="mono">${c}/${at.length} correct · ${fmtTime(done.durationSec)} used</p>`;
      actions = `<button class="btn ${done.reviewed ? '' : 'primary'}" data-act="openResults" data-arg="${esc(done.id)}">${done.reviewed ? 'See results' : 'Review now'}</button>`; }
    else if (broken.length){ status = `<span class="pill warn">Interrupted ${fmtDate(broken[0].start)}</span><p class="fine">A reload or a closed tab stopped the clock. Start again for a clean measurement.</p>`; actions = `<button class="btn primary" data-act="restartBlock" data-arg="${b.key}">Start again</button>`; }
    else { status = '<span class="pill">Not taken</span>'; actions = `<button class="btn primary" data-act="startBlock" data-arg="${b.key}" ${n ? '' : 'disabled'}>Start</button>`; }
    return `<div class="card block"><p class="eyebrow">${esc(b.section)}</p><h2>${esc(b.name)}</h2><p class="spec">${n || '—'} questions · ${n ? fmtTime(lim) : '—'} · ${fmtTime(PACE[b.section])} per question</p><p class="muted">${esc(b.note)}</p><div>${status}</div><div class="row">${actions}</div></div>`;
  }).join('');
  return `<section><h1>Diagnostic</h1><p class="muted" style="max-width:70ch">Three blocks, one per section, at real test pace. Take them on different days if you like. Work as on test day: a quiet room, paper for scratch work, no phone. Answer every question, because unanswered questions cost points on the real exam. Rate how sure you are before moving on. At the end of a block you can change up to 3 answers if time is left. Then you review each miss and try it again before seeing the solution.</p></section>
    <section class="blocks">${cards}</section>`;
};
/* Practice opens section by section once that section's diagnostic block is done, for written and generated questions alike. */
function practicePool(){ return Object.values(S.bank).filter(q => !q.flagged && blockDone(q.block)); }
VIEWS.practice = function(){
  const P = S.ui.practice; const pool = practicePool(), gen = genPool(P.topic);
  const seen = new Set(attemptsAll().map(a => a.qid));
  const inSec = pool.filter(q => !P.section || q.section === P.section), genSec = gen.filter(q => !P.section || q.section === P.section);
  const topics = [...new Set([...inSec, ...genSec].map(q => q.topic))].sort();
  const fits = q => (!P.topic || q.topic === P.topic) && (!P.diff || String(q.difficulty) === P.diff || (P.diff === '5' && q.difficulty >= 5));
  const match = inSec.filter(q => fits(q) && (!P.unseen || !seen.has(q.id))), genMatch = genSec.filter(fits);
  const can = genMatch.length ? +P.count : Math.min(match.length, +P.count);
  const form = pool.length || gen.length ? `<div class="card stack"><h2>Build a set</h2>
      <div class="fgrid">
        <div><label class="lab" for="p-sec">Section</label><select id="p-sec" data-ui="practice.section">${['', ...SECTIONS].map(s => `<option value="${s}" ${P.section === s ? 'selected' : ''}>${s || 'All sections'}</option>`).join('')}</select></div>
        <div><label class="lab" for="p-top">Topic</label><select id="p-top" data-ui="practice.topic"><option value="">All topics</option>${topics.map(t => `<option ${P.topic === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></div>
        <div><label class="lab" for="p-diff">Level</label><select id="p-diff" data-ui="practice.diff">${[['','Any'],['2','2 · easy'],['3','3 · standard'],['4','4 · hard'],['5','5–6 · 750+']].map(([v,l]) => `<option value="${v}" ${P.diff === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <div><label class="lab" for="p-count">Questions</label><select id="p-count" data-ui="practice.count">${['5','10','15','20'].map(v => `<option ${P.count === v ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
        <div><label class="lab" for="p-mode">Mode</label><select id="p-mode" data-ui="practice.mode"><option value="learn" ${P.mode === 'learn' ? 'selected' : ''}>Learn: feedback after each question</option><option value="timed" ${P.mode === 'timed' ? 'selected' : ''}>Timed: real pace, review at the end</option></select></div>
      </div>
      <label class="checks"><input type="checkbox" id="p-unseen" data-ui="practice.unseen" ${P.unseen ? 'checked' : ''}> Only questions I have not seen</label>
      <div class="row"><button class="btn primary" data-act="startpractice" ${can ? '' : 'disabled'}>Start ${can} question${can === 1 ? '' : 's'}</button><button class="btn" data-act="startsmartform" ${inSec.length || genSec.length ? '' : 'disabled'}>Let the coach pick</button><span class="fine">${match.length} written question${match.length === 1 ? '' : 's'} match${match.length === 1 ? 'es' : ''} these filters${genMatch.length ? ', plus new generated questions without limit (written ones come first)' : ''}. The coach picks within the section and topic, weighted toward your weak spots.</span></div></div>`
    : `<div class="card stack"><h2>Your training sets are not here yet</h2><p class="muted">Practice opens section by section once you finish that section’s diagnostic block. Then Quant and Data Insights have new generated questions without limit, and Claude adds Verbal sets aimed at your weakest topics.</p><div class="row"><button class="btn primary" data-act="tab" data-arg="diagnostic">Go to the diagnostic</button></div></div>`;
  return `<section><h1>Practice</h1><p class="muted" style="max-width:70ch">Every set logs time, confidence and errors, like the diagnostic. In Learn mode a miss goes straight to review: retry, hints one at a time, then the solution.</p></section>
    <section class="grid2">${form}</section>
    ${ogCard()}`;
};
VIEWS.retests = function(){
  const due = dueErrors(); const t = today();
  const upcoming = Object.values(S.errors).filter(e => e.status === 'active' && e.nextDue && e.nextDue > t).sort((a,b) => String(a.nextDue).localeCompare(String(b.nextDue)));
  const retired = Object.values(S.errors).filter(e => e.status === 'retired').length, ogDue = dueOgErrors();
  const row = e => `<tr><td>${esc(e.topic)}${isOg(e.qid) ? ` <span class="pill">${esc(ogName(e.og))}</span>` : ''}</td><td>${esc(e.errorType || '—')}</td><td class="num">${e.count || 1}</td><td class="num">${e.box || 0}/${INTERVALS.length}</td><td class="num">${fmtDate(e.nextDue)}</td></tr>`;
  const head = '<thead><tr><th>Topic</th><th>Last error type</th><th class="num">Misses</th><th class="num">Step</th><th class="num">Due</th></tr></thead>';
  return `<section><h1>Retests</h1><p class="muted" style="max-width:70ch">Every logged error comes back after 1 day, then 3, 7, 21 and 45 days while you keep getting it right. One miss sends it back to the start. After the fifth correct retest it is retired.</p>
    <div class="row"><button class="btn primary" data-act="startRetests" ${due.length ? '' : 'disabled'}>Start ${due.length} due retest${due.length === 1 ? '' : 's'}</button><span class="fine">${retired} retired so far.</span></div></section>
    ${due.length ? `<section><h2>Due now</h2><div class="box scroll"><table class="tbl">${head}<tbody>${due.map(row).join('')}</tbody></table></div></section>` : ''}
    ${ogDue.length ? `<section><h2>Official Guide: redo these in your book</h2><p class="muted" style="max-width:70ch">Solve each one again without your notes and without looking at the answer, then record the result here.</p><div class="box scroll"><table class="tbl"><thead><tr><th>Question</th><th>Topic</th><th>Last error type</th><th class="num">Misses</th><th class="num">Step</th><th>Result</th></tr></thead><tbody>
      ${ogDue.map(e => `<tr><td>${esc(ogName(e.og))}</td><td>${esc(e.topic)}</td><td>${esc(e.errorType || '—')}</td><td class="num">${e.count || 1}</td><td class="num">${e.box || 0}/${INTERVALS.length}</td><td><button class="btn small" data-act="ogretest" data-arg="${esc(e.qid)}|1">Right</button> <button class="btn small ghost" data-act="ogretest" data-arg="${esc(e.qid)}|0">Wrong again</button></td></tr>`).join('')}</tbody></table></div></section>` : ''}
    <section><h2>Coming up</h2>${upcoming.length ? `<div class="box scroll"><table class="tbl">${head}<tbody>${upcoming.map(row).join('')}</tbody></table></div>` : '<p class="muted">No retests scheduled yet. They appear as you log errors.</p>'}</section>`;
};
VIEWS.errors = function(){
  const F = S.ui.errf || (S.ui.errf = { section:'', type:'', status:'active' });
  const all = Object.values(S.errors);
  const list = all.filter(e => (!F.section || e.section === F.section) && (!F.type || e.errorType === F.type) && (!F.status || e.status === F.status)).sort((a,b) => String(b.lastWrong).localeCompare(String(a.lastWrong)));
  const counts = {}; for (const e of all) for (const h of (e.history || [])) counts[h.errorType] = (counts[h.errorType] || 0) + 1;
  return `<section><h1>Error log</h1><p class="muted" style="max-width:70ch">Every significant error with its cause, the correct method and your prevention rule. Claude reads this log when it plans your next week.</p>
    ${Object.keys(counts).length ? `<div class="chips">${Object.entries(counts).sort((a,b) => b[1]-a[1]).map(([k,v]) => `<span class="pill">${esc(k)} · ${v}</span>`).join('')}</div>` : ''}
    <div class="fgrid" style="max-width:720px">
      <div><label class="lab" for="ef-sec">Section</label><select id="ef-sec" data-ui="errf.section"><option value="">All</option>${SECTIONS.map(s => `<option ${F.section === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
      <div><label class="lab" for="ef-type">Error type</label><select id="ef-type" data-ui="errf.type"><option value="">All</option>${ERROR_TYPES.map(([k]) => `<option ${F.type === k ? 'selected' : ''}>${k}</option>`).join('')}</select></div>
      <div><label class="lab" for="ef-st">Status</label><select id="ef-st" data-ui="errf.status"><option value="active" ${F.status === 'active' ? 'selected' : ''}>Active</option><option value="retired" ${F.status === 'retired' ? 'selected' : ''}>Retired</option><option value="" ${F.status === '' ? 'selected' : ''}>All</option></select></div>
    </div></section>
    <section>${list.length ? `<div class="box scroll"><table class="tbl wide"><thead><tr><th>Date</th><th>Section</th><th>Topic</th><th class="num">Level</th><th>Question</th><th>My answer</th><th>Correct</th><th>Error type</th><th>Why I missed it</th><th>Correct method</th><th>Prevention rule</th><th>Retest</th></tr></thead><tbody>
      ${list.map(e => `<tr><td>${fmtDate(e.lastWrong)}</td><td>${esc(e.section)}</td><td>${esc(e.topic)}</td><td class="num">${e.difficulty || '—'}</td><td class="q">${esc(e.stemShort)}</td><td class="mono">${esc(e.myAnswer)}</td><td class="mono">${esc(e.correctAnswer)}</td><td><span class="pill">${esc(e.errorType)}</span>${e.count > 1 ? ` <span class="pill bad">×${e.count}</span>` : ''}</td><td>${esc(e.why || '—')}</td><td>${inline(e.correctMethod || '—')}</td><td>${esc(e.prevention || '—')}</td><td>${e.status === 'retired' ? 'Retired' : fmtDate(e.nextDue)}</td></tr>`).join('')}
    </tbody></table></div>` : '<p class="muted">No errors match. Errors are added when you review a session.</p>'}</section>`;
};
VIEWS.mastery = function(){
  const secs = SECTIONS.map(sec => {
    const topics = [...new Set([...SYLLABUS[sec], ...attemptsAll().filter(a => a.section === sec).map(a => a.topic)])];
    const rows = topics.map(t => ({ t, m: mastery(t) }));
    const counts = STATUS.map((_,i) => rows.filter(r => r.m.status === i).length);
    return `<section><div class="row" style="justify-content:space-between"><h2>${sec}</h2><span class="fine">${counts.map((c,i) => c ? `${STATUS[i]} ${c}` : '').filter(Boolean).join(' · ')}</span></div>
      <div class="box scroll"><table class="tbl"><thead><tr><th>Topic</th><th>Status</th><th class="num">Questions</th><th class="num">Accuracy</th><th class="num">Timed</th><th class="num">Time vs expected</th><th class="num">Last seen</th></tr></thead><tbody>
      ${rows.map(({t,m}) => `<tr><td>${lessonOf(t) ? `<button class="linkbtn" data-act="lesson" data-arg="${esc(t)}">${esc(t)}</button>` : esc(t)}</td><td><span class="status st${m.status}"></span>${STATUS[m.status]}</td><td class="num">${m.n || '—'}</td><td class="num">${pct(m.acc)}</td><td class="num">${pct(m.tacc)}</td><td class="num">${m.ratio ? m.ratio.toFixed(2) + '×' : '—'}</td><td class="num">${m.last ? fmtDate(m.last) : '—'}</td></tr>`).join('')}
      </tbody></table></div></section>`;
  }).join('');
  return `<section><h1>Mastery</h1><p class="muted" style="max-width:70ch">The full topic list for the current GMAT, with your status on each. A topic is never marked mastered after a few right answers: it needs accuracy, speed, harder levels and retention after a week.</p>
    <details class="more"><summary>How status is decided (GMAT Lab’s own thresholds, not official)</summary><ul class="hints" style="margin-top:8px">
      <li><b>Introduced</b>: 1–4 questions.</li><li><b>Practicing</b>: 5 or more questions, accuracy under 60%.</li>
      <li><b>Developing</b>: accuracy 60% or more, but fewer than 10 questions, under 80% on the last 10, or right at fewer than two levels from 3 up.</li>
      <li><b>Strong</b>: 10+ questions, 80%+ on the last 10, right at two or more levels from 3 up.</li>
      <li><b>Mastered</b>: Strong, plus 80%+ on at least 6 timed questions at level 4+ within 1.2× the expected time, plus a correct retest at least 7 days after your last error on the topic.</li></ul></details></section>
    ${secs}`;
};
/* ------------------------------------------------------------------ mocks tab: take a mock, history, readiness, official exams, report, review */
const MOCK_PAGES = [['take', 'Take a mock'], ['history', 'History'], ['readiness', 'Readiness'], ['official', 'Official exams']];
VIEWS.mocks = function(){
  if (!planReady()) return `<section><h1>Mocks</h1><p class="muted">${esc(nextStep().why)}</p></section>`;
  const v = S.ui.mockView || 'take', m = S.mocks[S.ui.mockId];
  const page = v === 'report' || v === 'review' ? (m ? (v === 'report' ? mockReportView(m) : mockReviewView(m)) : '<section><p class="muted">This mock is no longer here.</p></section>')
    : ({ take: mockTakeView, history: mockHistoryView, readiness: readinessView, official: officialView }[v] || mockTakeView)();
  const nav = `<div class="chips" role="group" aria-label="Mock pages">${MOCK_PAGES.map(([k, l]) => `<button class="chip" data-act="mockview" data-arg="${k}" aria-pressed="${v === k}">${l}</button>`).join('')}</div>`;
  if (v === 'report' || v === 'review') return `<section>${nav}</section>${page}`;
  return `<section><h1>Mocks</h1><p class="muted" style="max-width:75ch">Full exams and single sections built like the real GMAT Focus: a blueprint for each section, questions that adapt to your answers, the official timing and navigation rules, an estimated score, then the Examiner’s analysis and a separate review. Everything shown comes from your own answers.</p>
    ${nav}</section>
    ${page}`;
};
function checkList(list){
  return `<ul class="checklist">${list.map(c => `<li class="${c.pass ? 'ok' : 'no'}"><span class="mk" aria-hidden="true">${c.pass ? '✓' : '✗'}</span><span>${esc(c.label)}${c.value != null && c.value !== '' ? ` <span class="mono fine">· ${esc(String(c.value))}</span>` : ''}<span class="sr">${c.pass ? ' (met)' : ' (not met)'}</span></span></li>`).join('')}</ul>`;
}
function nextMockCard(nm){
  const met = nm.checks.filter(c => c.pass).length;
  const lead = !nm.lastFull ? 'No full mock yet: the first one sets your baseline.'
    : nm.overdue ? `${nm.days} days since your last full mock (${fmtDate(nm.lastFull)}): take one now, even with checks open, so your score stays current.`
    : nm.ready ? `Last full mock ${fmtDate(nm.lastFull)}. The checks are met: a new one will measure real progress.`
    : `Last full mock ${fmtDate(nm.lastFull)}. ${met} of ${nm.checks.length} checks met: a new mock now would mostly repeat the last one.`;
  return `<div class="card stack"><div class="row" style="justify-content:space-between"><h2>When to take the next full mock</h2><span class="pill ${nm.ready ? 'good' : 'warn'}">${nm.ready ? 'Recommended now' : 'Not yet'}</span></div>
    <p class="muted">${esc(lead)}</p>${checkList(nm.checks)}<p class="fine">The Examiner’s rule (GMAT Lab’s, not official): at least a week and some real practice since the last full mock, including its focus topics; after three weeks, take one anyway.</p></div>`;
}
function mockTakeView(){
  const U = examUI(), nm = nextMockNow(), R = SPEC.navigationRules, checks = SECTIONS.map(s => poolCheck(s));
  const ok = s => checks.find(c => c.section === s).ok;
  const card = m => {
    const secs = m.sections === 'all' ? examOrder() : [U.section], gate = m.requiresReadiness && !nm.ready;
    const mins = secs.reduce((t, s) => t + specOf(s).duration, 0) / 60;
    return `<div class="card block"><p class="eyebrow">${m.sections === 'all' ? 'Full exam' : 'One section'} · ${m.timed ? `${mins} min` : 'no clock'}${m.comparable ? '' : ' · outside the score trend'}</p><h2>${esc(m.name)}</h2>
      <p class="muted">${esc(m.text)}</p><p class="spec">${secs.map(s => `${SHORT[s]} ${specOf(s).questionCount}`).join(' · ')}</p>
      <div class="row"><button class="btn ${m.id === 'official' ? 'primary' : ''}" data-act="startmock" data-arg="${esc(m.id)}" ${secs.every(ok) && !gate ? '' : 'disabled'}>Start</button>${gate ? '<span class="fine">Opens when the Examiner recommends a full mock (below).</span>' : ''}</div></div>`;
  };
  return `<section class="card stack"><div class="fgrid" style="max-width:720px">
      <div><label class="lab" for="ex-order">Section order for full mocks</label><select id="ex-order" data-ui="exam.order">${EXAM_ORDERS.map((o, i) => `<option value="${i}" ${String(U.order) === String(i) ? 'selected' : ''}>${o.join(' → ')}</option>`).join('')}</select></div>
      <div><label class="lab" for="ex-sec">Section for one-section mocks</label><select id="ex-sec" data-ui="exam.section">${SECTIONS.map(s => `<option ${U.section === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div></div>
    <p class="fine">Unseen questions: ${checks.map(c => `<span class="${c.ok ? '' : 'res-no'}">${esc(c.ok ? c.section + ' ready' : c.text)}</span>`).join(' · ')}</p>
    <details class="more"><summary>The rules in every mock</summary><ul class="hints" style="margin-top:8px">
      <li>Each section follows a blueprint: how many questions of each topic group or type, as on the real exam. Within it, every question is chosen to measure you best after your last answer, so the order is never the same twice.</li>
      <li>No going back. Bookmark any question; at the end of the section, while time remains, you can review and change up to ${R.reviewAndEdit.maxChanges} answers.</li>
      <li>The timer is always on screen. When it reaches zero the section ends, and every unanswered question counts as wrong.</li>
      <li>Full mocks: one optional ${R.breaks.minutes}-minute break after the first or second section. Calculator only in Data Insights.</li>
      <li>No hints, explanations or feedback until the end. Only questions you have never seen, and never two versions of the same problem in one mock.</li></ul></details></section>
    <section class="blocks">${SPEC.modes.map(card).join('')}</section>
    <section class="grid2">${nextMockCard(nm)}
      <div class="card stack"><h2>Other ways to practise</h2>${SPEC.links.map(l => `<div class="row" style="justify-content:space-between"><div><b>${esc(l.name)}</b><p class="fine">${esc(l.text)}</p></div><button class="btn small" data-act="tab" data-arg="${esc(l.tab)}">Open</button></div>`).join('')}
        <p class="fine">Exam specification: ${esc(SPEC.examName)} (${esc(SPEC.version)}). Structure, timing and navigation are the official ones; the question mix inside a section and the scoring are GMAT Lab estimates.</p></div></section>`;
}
/* Score over time: GMAT Lab full mocks (comparable modes) and official practice exams, against the target. */
function scoreChart(sims, offs, tg){
  const pts = [...sims.map(m => ({ d: m.date, v: m.total })), ...offs.map(m => ({ d: m.date, v: m.total }))];
  if (!pts.length) return '';
  const W = 680, H = 250, L = 46, R = 24, T = 16, B = 30, hi = 805;
  const lo = Math.max(205, Math.min(505, Math.floor((Math.min(...pts.map(p => p.v), ...sims.map(m => m.range ? m.range[0] : m.total), tg ? tg.score : 805) - 20) / 50) * 50));
  const t0 = Math.min(...pts.map(p => parseD(p.d).getTime())), t1 = Math.max(...pts.map(p => parseD(p.d).getTime()));
  const x = d => t1 === t0 ? L + (W - L - R) / 2 : L + (parseD(d).getTime() - t0) / (t1 - t0) * (W - L - R);
  const y = v => T + (hi - Math.max(lo, Math.min(hi, v))) / (hi - lo) * (H - T - B);
  let g = '';
  for (let v = lo; v <= hi; v += 50) g += `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${v}</text>`;
  if (tg) g += `<line class="target" x1="${L}" x2="${W - R}" y1="${y(tg.score)}" y2="${y(tg.score)}"/><text class="tlabel" x="${W - R}" y="${y(tg.score) - 6}" text-anchor="end">target ${tg.score}</text>`;
  const dates = [...new Set(pts.map(p => p.d))].sort(); const ticks = dates.length <= 6 ? dates : [dates[0], dates[Math.floor(dates.length / 2)], dates[dates.length - 1]];
  for (const d of ticks) g += `<text x="${x(d)}" y="${H - 10}" text-anchor="middle">${esc(fmtDate(d))}</text>`;
  if (sims.length > 1) g += `<polyline class="s1 line" points="${sims.map(m => `${x(m.date)},${y(m.total)}`).join(' ')}"/>`;
  if (offs.length > 1) g += `<polyline class="s2 line" points="${offs.map(m => `${x(m.date)},${y(m.total)}`).join(' ')}"/>`;
  sims.forEach((m, i) => {
    if (m.range) g += `<line class="s1 whisker" x1="${x(m.date)}" x2="${x(m.date)}" y1="${y(m.range[0])}" y2="${y(m.range[1])}"/>`;
    g += `<circle class="s1 dot" cx="${x(m.date)}" cy="${y(m.total)}" r="${i === sims.length - 1 ? 5.5 : 4}"><title>Mock #${i + 1} · ${esc(fmtDate(m.date))} · ${m.total}${m.range ? ` (range ${m.range[0]}–${m.range[1]})` : ''}</title></circle>`;
    if (i === sims.length - 1) g += `<text class="val" x="${x(m.date)}" y="${y(m.total) - 11}" text-anchor="middle">${m.total}</text>`;
  });
  offs.forEach((m, i) => {
    g += `<rect class="s2 dot" x="${x(m.date) - 4.5}" y="${y(m.total) - 4.5}" width="9" height="9"><title>${esc(m.name)} · ${esc(fmtDate(m.date))} · ${m.total}</title></rect>`;
    if (i === offs.length - 1) g += `<text class="val" x="${x(m.date)}" y="${y(m.total) + 20}" text-anchor="middle">${m.total}</text>`;
  });
  const label = `Total scores over time: ${sims.length} GMAT Lab full mock${sims.length === 1 ? '' : 's'}${sims.length ? `, latest ${sims[sims.length - 1].total}` : ''}; ${offs.length} official practice exam${offs.length === 1 ? '' : 's'}${offs.length ? `, latest ${offs[offs.length - 1].total}` : ''}.`;
  return `<figure class="chart trend" style="margin:0"><div class="legend">${sims.length ? '<span><i class="k1"></i>GMAT Lab full mocks (estimate, with range)</span>' : ''}${offs.length ? '<span><i class="k2"></i>Official practice exams</span>' : ''}</div>
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">${g}</svg></figure>`;
}
function topCats(cats, k){ return Object.entries(cats || {}).sort((a, b) => b[1] - a[1]).slice(0, k || 2).map(([c, n]) => `${c.replace(/ Error$/, '')} ${n}`).join(' · ') || '—'; }
function mockHistoryView(){
  const sims = simulations(), full = fullSims(), offs = officialMocks(), tg = target();
  if (!sims.length && !loggedMocks().length) return '<section><p class="muted">No mocks yet. Take one from the first page, or log an official practice exam under Official exams.</p></section>';
  const sec = (m, s) => { const x = (m.sections || []).find(z => z.section === s); return x ? x.score : '—'; };
  const lvl = m => { const l = (m.sections || []).filter(s => s.avgDifficulty != null); return l.length ? levelOf(l.reduce((t, s) => t + s.avgDifficulty * s.questions, 0) / l.reduce((t, s) => t + s.questions, 0)) : '—'; };
  const evo = full.map((m, i) => `Mock #${i + 1}: ${m.total}${i ? ` (${m.total - full[i - 1].total >= 0 ? '+' : '−'}${Math.abs(m.total - full[i - 1].total)})` : ''}`);
  return `${full.length || offs.length ? `<section class="card stack"><h2>Score over time</h2>${scoreChart(full, offs, tg)}
      ${evo.length ? `<p class="mono fine">${evo.map(esc).join(' → ')}</p>` : ''}
      <p class="fine">Only full mocks in comparable modes are in the trend. The whisker is the estimate’s range; official practice exams use GMAC’s own scoring.</p></section>` : ''}
    ${sims.length ? `<section><h2>GMAT Lab mocks</h2><div class="box scroll"><table class="tbl"><thead><tr><th>Date</th><th>Mode</th><th class="num">Score</th><th class="num">Q</th><th class="num">V</th><th class="num">DI</th><th class="num">Time</th><th class="num">Accuracy</th><th class="num">Avg level</th><th class="num">Time efficiency</th><th class="num">Unanswered</th><th>Main error types</th><th class="num">Ability estimate</th><th></th></tr></thead><tbody>
      ${[...sims].reverse().map(m => `<tr><td>${fmtDate(m.date)}</td><td>${esc(m.modeName)}${m.order && m.order.length > 1 ? `<br><span class="fine">${m.order.map(x => SHORT[x]).join(' → ')}</span>` : ''}</td>
        <td class="num"><strong>${m.total != null ? m.total : (m.sections || []).map(s => s.score).join(' · ')}</strong><br><span class="fine">${m.range ? m.range.join('–') : m.sections && m.sections[0] ? m.sections[0].range.join('–') : ''}</span></td>
        <td class="num">${sec(m, 'Quant')}</td><td class="num">${sec(m, 'Verbal')}</td><td class="num">${sec(m, 'Data Insights')}</td><td class="num">${fmtLong(m.durationSec)}</td><td class="num">${pct(m.accuracy)}</td><td class="num">${lvl(m)}</td>
        <td class="num">${m.timeEfficiency == null ? '—' : m.timeEfficiency.toFixed(2)}</td><td class="num">${m.unanswered}</td><td>${esc(topCats(m.errorCategories))}</td><td class="num">${m.ability && m.ability.estimate ? m.ability.estimate : '—'}</td>
        <td><button class="linkbtn" data-act="mockreport" data-arg="${esc(m.id)}">Report</button> · <button class="linkbtn" data-act="mockreview" data-arg="${esc(m.id)}">Review</button></td></tr>`).join('')}
    </tbody></table></div><p class="fine">Accuracy counts unanswered questions as wrong. Avg level: 1–6. Time efficiency: expected time ÷ time used (1.00 = real pace, higher = faster). Ability estimate: the ability model’s total at the time, from all your answers.</p></section>` : ''}`;
}
function officialView(){
  const list = loggedMocks();
  return `<section class="grid2">
      <form class="card stack" data-form="mock" data-dirty><h2>Log an official practice exam</h2><p class="muted">Official Practice Exams use GMAC’s real scoring and there are only a few, so keep them for when the numbers matter.</p>
        <div class="fgrid"><div><label class="lab" for="m-date">Date</label><input id="m-date" type="date" value="${today()}" required></div>
        <div><label class="lab" for="m-name">Exam</label><select id="m-name">${['Official Practice Exam 1','Official Practice Exam 2','Official Practice Exam 3','Official Practice Exam 4','Official Practice Exam 5','Official Practice Exam 6','Other official material','Third-party mock'].map(x => `<option>${x}</option>`).join('')}</select></div></div>
        <div class="fgrid"><div><label class="lab" for="m-total">Total (205–805)</label><input id="m-total" type="number" min="205" max="805" step="10" required></div>
        <div><label class="lab" for="m-q">Quant (60–90)</label><input id="m-q" type="number" min="60" max="90"></div>
        <div><label class="lab" for="m-v">Verbal (60–90)</label><input id="m-v" type="number" min="60" max="90"></div>
        <div><label class="lab" for="m-di">Data Insights (60–90)</label><input id="m-di" type="number" min="60" max="90"></div></div>
        <div><label class="lab" for="m-notes">Notes</label><textarea id="m-notes" rows="2" placeholder="Section order, break, how the timing felt, what went wrong"></textarea></div>
        <div class="row"><button class="btn primary" type="submit">Save result</button></div></form>
      <div class="stack"><h2>Logged exams</h2>${list.length ? `<div class="box scroll"><table class="tbl"><thead><tr><th>Date</th><th>Exam</th><th class="num">Total</th><th class="num">Q</th><th class="num">V</th><th class="num">DI</th><th>Notes</th><th></th></tr></thead><tbody>${[...list].reverse().map(m => `<tr><td>${fmtDate(m.date)}</td><td>${esc(m.name)}</td><td class="num"><strong>${m.total}</strong></td><td class="num">${m.quant || '—'}</td><td class="num">${m.verbal || '—'}</td><td class="num">${m.di || '—'}</td><td>${esc(m.notes || '')}</td><td>${S.ui.delMock === m.id ? `<button class="btn small danger" data-act="mockdelok" data-arg="${esc(m.id)}">Delete</button> <button class="btn small ghost" data-act="mockdelno">Keep</button>` : `<button class="linkbtn" data-act="mockdel" data-arg="${esc(m.id)}">Remove</button>`}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">None yet. The first official practice exam usually comes after the foundations phase.</p>'}</div>
    </section>`;
}
/* Exam readiness: every judgement next to the numbers behind it. */
function readinessView(){
  const ab = abilityNow(), tg = target(), sims = fullSims();
  const R = ENGINE.readiness(SPEC, sims, officialMocks(), ab, attemptsAll(), tg ? tg.score : null, today(), errorsByCategory(60));
  const est = ab.estimatedScore, open = R.checks.filter(c => !c.pass);
  const verdict = !open.length ? `All ${R.checks.length} checks are met. On this evidence the exam is a reasonable next step; keep one full mock a week until test day so the numbers stay current.`
    : `${R.passed} of ${R.checks.length} checks met. Each check below shows your current value; the ones marked ✗ are still open, so the data does not yet support sitting the exam.`;
  const skillRow = s => `<tr><td>${esc(s.skill)}<br><span class="fine">${esc(s.topic)}</span></td><td class="num">≈ ${toSection(s.theta)}</td><td class="num">${s.n}</td></tr>`;
  const skillTable = (title, list) => `<div class="stack"><h3>${title}</h3>${list.length ? `<div class="box scroll"><table class="tbl"><thead><tr><th>Skill</th><th class="num">Level</th><th class="num">Answers</th></tr></thead><tbody>${list.map(skillRow).join('')}</tbody></table></div>` : '<p class="fine">Needs 4+ answers on a skill.</p>'}</div>`;
  const topics = Object.entries(ab.topics).filter(([, v]) => v.n >= 3).sort((a, b) => a[1].theta - b[1].theta);
  const allSk = Object.values(ab.skills).filter(s => s.n >= 4).sort((a, b) => a.theta - b.theta), half = Math.min(5, Math.ceil(allSk.length / 2));
  const cats = Object.entries(R.errorRate.byType).sort((a, b) => b[1] - a[1]);
  return `<section class="card stack"><div class="row" style="justify-content:space-between"><h2>Exam readiness</h2><span class="pill ${open.length ? 'warn' : 'good'}">${R.passed} of ${R.checks.length} checks met</span></div>
      <p class="muted" style="max-width:75ch">${esc(verdict)}</p>${checkList(R.checks)}
      <p class="fine">Thresholds are GMAT Lab’s rule of thumb, set in the exam specification; the value after each check is yours.</p></section>
    <section class="grid2">
      <div class="card stack"><h2>Where you are</h2><ul class="facts">
        <li><b>Latest full mock</b><span>${R.overall.last ? `${R.overall.last.total} (range ${R.overall.last.range.join('–')}), ${fmtDate(R.overall.last.date)}` : 'none yet'}</span></li>
        <li><b>Ability model</b><span>${est.total != null ? `≈ ${est.total} (range ${est.range.join('–')}), confidence ${esc(ab.confidence.label)}` : esc(est.note)}</span></li>
        <li><b>Target</b><span>${tg ? `${tg.score} · ${esc(tg.label)}` : 'not set: choose it in Profile'}</span></li>
        <li><b>Last 3 mocks</b><span class="mono">${R.recent.length ? R.recent.map(x => x.total).join(' → ') : '—'}${R.trend != null ? ` · ${R.trend >= 0 ? '+' : '−'}${Math.abs(Math.round(R.trend))} per mock` : ''}</span></li>
        <li><b>Stability</b><span>${R.stability.sd != null ? `totals vary by ±${Math.round(R.stability.sd)} (standard deviation)` : 'needs 2+ full mocks'}</span></li></ul></div>
      <div class="card stack"><h2>Sections</h2><div class="box scroll"><table class="tbl"><thead><tr><th>Section</th><th class="num">Last mock</th><th class="num">Spread, last 3</th><th class="num">Model</th><th class="num">Answers</th></tr></thead><tbody>
        ${est.sections.map(s => { const c = R.sectionConsistency.find(x => x.section === s.section) || {}; return `<tr><td>${esc(s.section)}</td><td class="num">${c.last || '—'}</td><td class="num">${c.sd == null ? '—' : '±' + c.sd.toFixed(1)}</td><td class="num nw">${s.n ? `${s.score} <span class="fine">${s.range.join('–')}</span>` : '—'}</td><td class="num">${s.n}</td></tr>`; }).join('')}
      </tbody></table></div><p class="fine">Model: the section score your answers point to, from every question you have answered, recent and timed work weighing more.</p></div>
      <div class="card stack"><h2>Time and difficulty</h2><ul class="facts">
        <li><b>Unanswered</b><span class="mono">${R.timeManagement.unanswered.length ? R.timeManagement.unanswered.join(' · ') + ' in the last mocks' : '—'}</span></li>
        <li><b>Efficiency</b><span>${R.timeManagement.efficiency != null ? `${R.timeManagement.efficiency.toFixed(2)} on timed work in the last 60 days` : '—'}${R.timeManagement.lastEfficiency != null ? ` · ${R.timeManagement.lastEfficiency.toFixed(2)} in the last mock` : ''}</span></li>
        <li><b>Level 5–6</b><span>${R.difficultyTolerance.n ? `${pct(R.difficultyTolerance.acc)} right on ${R.difficultyTolerance.n} timed questions (60 days)` : 'no timed level 5–6 questions yet'}</span></li>
        <li><b>Error rate</b><span>${R.errorRate.answered ? `${pct(R.errorRate.wrong / R.errorRate.answered)} wrong of ${R.errorRate.answered} answers (60 days)` : '—'}</span></li>
        <li><b>Error types</b><span>${cats.length ? cats.map(([c, n]) => `${esc(c)} ${n}`).join(' · ') : 'none logged'}</span></li></ul>
        <p class="fine">Efficiency: expected time ÷ time used; 1.00 is the real pace.</p></div>
      <div class="card stack"><h2>Your ability model</h2><ul class="facts">
        <li><b>Answers</b><span>${ab.n} · confidence ${esc(ab.confidence.label)} (±${ab.overallAbility.se.toFixed(2)} on the ability scale)</span></li>
        <li><b>Recent 30</b><span>${ab.recentPerformance.n ? `${pct(ab.recentPerformance.accuracy)} right, ${pct(ab.recentPerformance.expected)} expected at your level` : '—'}</span></li>
        <li><b>Consistency</b><span>${ab.consistency.sd != null ? `sessions differ from expectation by ±${pct(ab.consistency.sd)} (${ab.consistency.sessions} sessions)` : 'needs 2+ sessions of 5+ questions'}</span></li></ul>
        <p class="fine">Updated after every answer in practice, retests, the diagnostic and mocks. Mocks weigh 1.5×, learn mode 0.7×; answers lose half their weight every 45 days.</p></div>
    </section>
    <section class="grid2">${skillTable('Weakest skills', allSk.slice(0, half))}${skillTable('Strongest skills', allSk.slice(half).reverse().slice(0, 5))}</section>
    ${topics.length ? `<section><h2>Topics, weakest first</h2><div class="box scroll"><table class="tbl"><thead><tr><th>Topic</th><th>Section</th><th class="num">Level</th><th class="num">Answers</th><th></th></tr></thead><tbody>
      ${topics.slice(0, 12).map(([t, v]) => `<tr><td>${esc(t)}</td><td>${esc(v.section)}</td><td class="num">≈ ${toSection(v.theta)}</td><td class="num">${v.n}</td><td><button class="linkbtn" data-act="startsmart" data-arg="learn|${esc(t)}|6">Practise</button></td></tr>`).join('')}
    </tbody></table></div><p class="fine">Level: the section score (60–90) that your answers on the topic point to.</p></section>` : ''}`;
}
/* The Examiner's report on one mock: per-section performance, time management, every error explained, focus, next mock. */
function mockSections(m){
  return (m.sections || []).map(s => { const ses = S.sessions[s.sid]; return { rec: s, ses, res: ses ? sectionResult({ section: s.section, attempts: ses.attempts || [], durationSec: ses.durationSec, limitSec: ses.limitSec, notReached: s.notReached || 0 }) : null }; });
}
function perfTable(title, rows, pace){
  const list = rows.filter(r => r.key !== '—'); if (!list.length) return '';
  return `<div class="stack" style="gap:6px"><h3>${title}</h3><div class="box scroll"><table class="tbl"><thead><tr><th>${title.replace(/^By /, '')}</th><th class="num">Right</th><th class="num">Accuracy</th>${pace ? '<th class="num">Time vs expected</th>' : ''}</tr></thead><tbody>
    ${list.map(r => `<tr><td>${esc(r.key)}</td><td class="num">${r.correct}/${r.n}</td><td class="num">${pct(r.acc)}</td>${pace ? `<td class="num">${r.ratio ? r.ratio.toFixed(2) + '×' : '—'}</td>` : ''}</tr>`).join('')}</tbody></table></div></div>`;
}
function errorCardHTML(e, withQ){
  const head = `<b>${withQ ? `Question ${e.index + 1} · ` : ''}${esc(e.topic)}</b><span class="pill bad">${esc(e.category)}</span>`;
  const body = `<dl class="kv"><div><dt>What happened</dt><dd>${inline(e.what)}</dd></div><div><dt>Why</dt><dd>${inline(e.why)}</dd></div>
      ${e.skill ? `<div><dt>Skill to rebuild</dt><dd>${esc(e.skill)}</dd></div>` : ''}<div><dt>Pattern</dt><dd>${esc(e.pattern)}</dd></div>
      <div><dt>How to fix it</dt><dd>${esc(e.fix)}</dd></div>
      <div><dt>Next exercise</dt><dd>${e.next.n} questions on ${esc(e.next.topic)} around level ${e.next.level}. <button class="btn small" data-act="startsmart" data-arg="learn|${esc(e.next.topic)}|${e.next.n}">Practise now</button>${lessonOf(e.next.topic) ? ` <button class="btn small ghost" data-act="lesson" data-arg="${esc(e.next.topic)}">Theory</button>` : ''}</dd></div></dl>`;
  return withQ ? `<li class="err"><details><summary>${head}<span class="fine">${esc((e.what.match(/^.*?\.(?=\s|$)/) || [e.what])[0])}</span></summary>${body}</details></li>`
    : `<li class="card stack err"><div class="row" style="justify-content:space-between">${head}</div>${body}</li>`;
}
function mockReportView(m){
  const secs = mockSections(m), full = m.total != null, nm = nextMockNow();
  const cats = Object.entries(m.errorCategories || {}).sort((a, b) => b[1] - a[1]);
  const secHTML = ({ rec, res }) => {
    if (!res) return `<section class="card"><h2>${esc(rec.section)}</h2><p class="muted">The answers of this section are not on this device.</p></section>`;
    const an = res.an, pace = PACE[rec.section];
    const cells = [['Score', `${rec.score}`, `range ${rec.range.join('–')}`], ['Accuracy', pct(an.correct / res.questions), `${an.correct} of ${res.questions}`], ['Avg time', an.avgTime == null ? '—' : fmtTime(an.avgTime), `real pace ${fmtTime(pace)}`],
      ['Time used', fmtTime(rec.timeUsed), rec.timeLimit ? `of ${fmtTime(rec.timeLimit)}${rec.timeUp ? ', ran out' : ''}` : 'no clock'], ['Efficiency', an.timeEfficiency == null ? '—' : an.timeEfficiency.toFixed(2), 'expected ÷ used'],
      ['Time lost', fmtTime(an.timeLost), 'over expected, on misses'], ['Unanswered', String(res.missing), rec.notReached ? `${rec.notReached} not reached` : 'incl. not reached'], ['Changes', String(an.changes.questionsWithChanges + (rec.editsUsed || 0)), `${an.changes.questionsWithChanges} while answering, ${rec.editsUsed || 0} at review`]];
    return `<section class="stack"><h2>${esc(rec.section)}</h2>
      <div class="metrics m4">${cells.map(([k, v, c]) => `<div><span class="k">${k}</span><span class="v">${v}</span><span class="fine">${esc(c)}</span></div>`).join('')}</div>
      <div class="grid2"><div class="stack" style="gap:6px"><h3>By difficulty</h3><div class="box scroll"><table class="tbl"><thead><tr><th>Questions</th><th class="num">Right</th><th class="num">Accuracy</th></tr></thead><tbody>${an.difficulty.map(b => `<tr><td>${esc(b.label)}</td><td class="num">${b.n ? Math.round(b.acc * b.n) + '/' + b.n : '—'}</td><td class="num">${pct(b.acc)}</td></tr>`).join('')}</tbody></table></div><p class="fine">Relative to your estimated level in this section. Average question level ${levelOf(an.avgDifficulty)}.</p></div>
        ${perfTable('By topic', an.topics, true)}${rec.section !== 'Quant' ? perfTable('By question type', an.types, true) : ''}${perfTable('By skill', an.skills, false)}</div>
      <div class="stack" style="gap:6px"><h3>Time management</h3>${an.patterns.length ? `<ul class="alerts">${an.patterns.map(p => `<li><span class="pill ${p.severity >= 3 ? 'bad' : p.severity === 2 ? 'warn' : ''}">${{ slowType: 'Slow type', rushHard: 'Rushing', earlyOverspend: 'Early overspend', endgame: 'Endgame', accurateSlow: 'Speed', stuck: 'Stuck' }[p.id] || 'Timing'}</span><span>${esc(p.text)}</span></li>`).join('')}</ul>` : '<p class="muted">No timing pattern: time went where it should.</p>'}</div></section>`;
  };
  const errs = m.errors || [];
  return `<section class="stack"><div class="row"><button class="btn small ghost" data-act="mockview" data-arg="history">← History</button><button class="btn small" data-act="mockreview" data-arg="${esc(m.id)}">Review the exam</button></div>
      <p class="eyebrow">Examiner report · ${esc(m.modeName)} · ${fmtDate(m.date)}${m.order && m.order.length > 1 ? ' · ' + m.order.map(x => SHORT[x]).join(' → ') : ''}</p>
      <h1>${full ? `Estimated score ${m.total} <span class="muted mono" style="font-size:16px">${m.range.join('–')}</span>` : m.sections.map(s => `${esc(s.section)} ${s.score}`).join(' · ')}</h1>
      <p class="fine" style="max-width:75ch">${esc(SCORE_NOTE)} ${esc(percentileNote())}</p></section>
    <section class="grid2"><div class="card stack"><h2>What the Examiner found</h2>${m.findings && m.findings.length ? `<ul class="answer">${m.findings.map(f => `<li>${esc(f)}</li>`).join('')}</ul>` : '<p class="muted">No pattern stands out in this mock.</p>'}
        ${cats.length ? `<div class="chips">${cats.map(([c, n]) => `<span class="pill">${esc(c)} · ${n}</span>`).join('')}</div>` : ''}</div>
      <div class="card stack"><h2>Focus for the next ${m.focusDays || 9} days</h2>${m.focus && m.focus.length ? `<ul class="answer">${m.focus.map(f => `<li><b>${esc(f.topic)}</b>: ${esc(f.why)} <button class="linkbtn" data-act="startsmart" data-arg="learn|${esc(f.topic)}|6">Practise</button></li>`).join('')}</ul><p class="fine">These topics now weigh more in Today’s plan and in coach sets, and weakness-based mocks aim at them.</p>` : '<p class="muted">No focus topic: no miss stood out from your usual level.</p>'}</div></section>
    ${secs.map(secHTML).join('')}
    <section class="stack"><h2>Every error, explained</h2>${errs.length ? `<p class="muted">Open any miss for what happened, why, the skill behind it, whether it repeats, how to fix it and the next exercise.</p>` + m.sections.map(s => { const l = errs.filter(e => e.section === s.section); return l.length ? `<h3>${esc(s.section)} · ${l.length} miss${l.length > 1 ? 'es' : ''}</h3><ul class="errs">${l.map(e => errorCardHTML(e, true)).join('')}</ul>` : ''; }).join('') : '<p class="muted">No wrong answers.</p>'}
      <p class="fine">The category comes from the wrong option you chose (each one maps to a typical mistake), your time on the question and your record on the topic. Correct it in the guided review if the cause was different.</p></section>
    <section class="grid2">${nextMockCard(nm)}</section>`;
}
/* Review Exam: every question with your answer, the right one, time and changes; open any one for the solution. */
function mockReviewView(m){
  const secs = mockSections(m), sel = S.ui.reviewQ, errs = m.errors || [];
  const rowHTML = (a, i, q) => `<tr><td class="num">${i + 1}</td><td>${esc(a.topic)}</td><td>${esc(a.type)}</td><td class="num">${a.difficulty || '—'}</td><td class="mono">${esc(q ? answerText(q, a.answer) : '—')}</td><td class="mono">${esc(q ? correctText(q) : '—')}</td>
    <td>${a.unanswered ? '<span class="res-skip">Unanswered</span>' : a.correct ? '<span class="res-ok">✓ Right</span>' : '<span class="res-no">✗ Wrong</span>'}${a.bookmarked ? ' <span class="pill">bookmarked</span>' : ''}${a.edited ? ' <span class="pill">changed at review</span>' : ''}</td>
    <td class="num">${fmtTime(a.timeSec)}</td><td class="num">${fmtTime(a.expectedSec)}</td><td class="num">${a.changes || 0}</td><td>${q ? `<button class="linkbtn" data-act="reviewq" data-arg="${esc(a.qid)}">${sel === a.qid ? 'Hide' : 'Open'}</button>` : ''}</td></tr>`;
  const panel = (a, i, q) => {
    const e = errs.find(x => x.qid === a.qid);
    return `<div class="card stack" id="rq"><p class="eyebrow">Question ${i + 1} · ${esc(a.topic)} · level ${a.difficulty || '—'} · ${fmtTime(a.timeSec)} (expected ${fmtTime(a.expectedSec)})</p>
      ${qBody(q, a.answer, { locked: true, reveal: true, userAns: a.answer, userLabel: 'Your answer' })}
      ${a.events && a.events.length > 1 ? `<p class="fine">Your answers on screen: ${a.events.map(([t, v]) => `${esc(answerText(q, v))} at ${fmtTime(t)}`).join(' → ')}.</p>` : ''}
      ${a.edited && a.changedFrom != null ? `<p class="fine">Changed at review from ${esc(answerText(q, a.changedFrom))} to ${esc(answerText(q, a.answer))}.</p>` : ''}
      ${!a.correct && !a.unanswered ? diagnosisHTML(diagnose(q, a.answer)) : ''}${e ? `<ul class="errs">${errorCardHTML(e, false)}</ul>` : ''}
      ${solutionHTML(q)}</div>`;
  };
  return `<section class="stack"><div class="row"><button class="btn small ghost" data-act="mockview" data-arg="history">← History</button><button class="btn small" data-act="mockreport" data-arg="${esc(m.id)}">Examiner report</button></div>
      <p class="eyebrow">Review · ${esc(m.modeName)} · ${fmtDate(m.date)}</p><h1>Review the exam</h1>
      <p class="muted" style="max-width:75ch">Every question in the order you saw it. Open one to see it with the right answer, why your option was tempting and the full solution. The guided review makes you retry each miss before any answer is shown, and logs the error with a retest.</p></section>
    ${secs.map(({ rec, ses }) => {
      if (!ses) return `<section class="card"><h2>${esc(rec.section)}</h2><p class="muted">The answers of this section are not on this device.</p></section>`;
      const at = ses.attempts || [], open = at.findIndex(a => a.qid === sel);
      return `<section class="stack"><div class="row" style="justify-content:space-between"><h2>${esc(rec.section)} · ${rec.score}</h2>${at.some(a => !a.correct) ? `<button class="btn small primary" data-act="openResults" data-arg="${esc(ses.id)}">${ses.reviewed ? 'Guided review (done)' : 'Guided review of the misses'}</button>` : ''}</div>
        <div class="box scroll"><table class="tbl"><thead><tr><th class="num">#</th><th>Topic</th><th>Type</th><th class="num">Level</th><th>Your answer</th><th>Right answer</th><th>Result</th><th class="num">Time</th><th class="num">Expected</th><th class="num">Changes</th><th></th></tr></thead><tbody>
          ${at.map((a, i) => rowHTML(a, i, S.bank[a.qid])).join('')}${rec.notReached ? `<tr><td colspan="11" class="fine">${rec.notReached} question${rec.notReached > 1 ? 's' : ''} not reached before time ran out: counted as wrong.</td></tr>` : ''}
        </tbody></table></div>${open >= 0 && S.bank[sel] ? panel(at[open], open, S.bank[sel]) : ''}</section>`;
    }).join('')}`;
}
VIEWS.profile = function(){
  const iv = interview();
  const val = k => esc(iv[k] == null ? '' : iv[k]);
  const days = iv.days || [];
  const res = iv.resources || [];
  return `<section><h1>Interview</h1><p class="muted" style="max-width:70ch">Claude builds your student profile from these answers and the diagnostic. Short answers are fine. Nothing here is graded; the diagnostic measures what you can do.</p></section>
  <form class="stack" data-form="interview" data-dirty style="gap:26px">
    <section class="card stack"><p class="eyebrow">Part 1 · Target</p><h2>What does “750” mean for you?</h2>
      <p class="muted">The 750 target comes from the old 200–800 scale. On today’s 205–805 scale, GMAC’s official conversion (August 2026) puts it at 695–715. A 750 does not exist on the new scale: 745 is the 99.6th percentile and 755 the 99.8th.</p>
      <div class="radio-cards">
        <label><input type="radio" name="target" value="classic750" ${iv.target === 'classic750' ? 'checked' : ''}><span><b>750 on the old scale</b><br><span class="fine">About 705–715 today · 97–99th percentile · what “750” has always meant to schools</span></span></label>
        <label><input type="radio" name="target" value="new755" ${iv.target === 'new755' ? 'checked' : ''}><span><b>755+ on today’s scale</b><br><span class="fine">99.8th percentile · top 0.2% of test takers</span></span></label>
      </div>
      <p class="fine">For the first months the training is the same either way. The choice sets the bar for calling you ready.</p>
    </section>
    <section class="card stack"><p class="eyebrow">Part 1 · Background</p>
      <div><label class="lab" for="iv-bg">What Claude already knows (edit anything wrong)</label><textarea id="iv-bg" rows="4">${val('background')}</textarea></div>
      <div><label class="lab" for="iv-school">High school</label><textarea id="iv-school" rows="2" placeholder="Type of school, and when you last did algebra without a calculator">${val('school')}</textarea></div>
      <div><label class="lab" for="iv-uni">Math and statistics exams so far, with grades</label><textarea id="iv-uni" rows="2" placeholder="e.g. Mathematics for Economists: 27/30 …">${val('uniMath')}</textarea></div>
      <div><p class="lab">Rate yourself before the diagnostic (1 = I remember nothing, 5 = sure even under time)</p><p class="hint">The diagnostic measures the real level. The gap between the two is your first calibration data.</p>
        <div class="ratings" style="margin-top:8px">${RATING_ITEMS.map(([k,l]) => `<div class="rt"><label for="iv-${k}">${esc(l)}</label><select id="iv-${k}"><option value="">—</option>${[1,2,3,4,5].map(n => `<option ${String(iv[k]) === String(n) ? 'selected' : ''}>${n}</option>`).join('')}</select></div>`).join('')}</div></div>
      <div><label class="lab" for="iv-tests">Timed multiple-choice tests you have taken (TOLC, SAT, IELTS, TOEFL, entrance tests)</label><textarea id="iv-tests" rows="2" placeholder="Test, year, result">${val('priorTests')}</textarea></div>
      <div><label class="lab" for="iv-gmat">GMAT so far</label><textarea id="iv-gmat" rows="2" placeholder="Any mock or practice test? Score, sections, date, which mock, how many errors, what felt hard. Write “none” if none.">${val('gmatExp')}</textarea></div>
    </section>
    <section class="card stack"><p class="eyebrow">Part 2 · Time and resources</p>
      <div class="fgrid">
        <div><label class="lab" for="iv-exam">Planned exam date</label><input id="iv-exam" type="date" value="${esc(iv.examDate || EXAM_DEFAULT)}"><p class="hint">Default: 19 July 2027.</p></div>
        <div><label class="lab" for="iv-hours">Realistic hours per week</label><input id="iv-hours" type="number" min="1" max="40" step="0.5" value="${val('hoursPerWeek')}"><p class="hint">Counting the weeks with exams.</p></div>
        <div><label class="lab" for="iv-len">Preferred session length</label><select id="iv-len">${['','30–45 min','60–90 min','2 hours or more','Mixed'].map(o => `<option ${iv.sessionLength === o ? 'selected' : ''} value="${o}">${o || '—'}</option>`).join('')}</select></div>
        <div><label class="lab" for="iv-we">Weekends</label><select id="iv-we">${['','Yes','Sometimes','No'].map(o => `<option ${iv.weekends === o ? 'selected' : ''} value="${o}">${o || '—'}</option>`).join('')}</select></div>
      </div>
      <div><p class="lab">Days you can study</p><div class="checks">${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => `<label><input type="checkbox" name="days" value="${d}" ${days.includes(d) ? 'checked' : ''}> ${d}</label>`).join('')}</div></div>
      <div><label class="lab" for="iv-busy">Heavy weeks</label><textarea id="iv-busy" rows="3">${val('busyWeeks')}</textarea></div>
      <div><label class="lab" for="iv-hol">Holidays and weeks away</label><textarea id="iv-hol" rows="2" placeholder="e.g. Christmas holidays 20 Dec – 6 Jan">${val('holidays')}</textarea></div>
      <div><p class="lab">GMAT material you already have</p><div class="checks">${RESOURCES.map(r => `<label><input type="checkbox" name="resources" value="${esc(r)}" ${res.includes(r) ? 'checked' : ''}> ${esc(r)}</label>`).join('')}</div>
        <label class="lab" for="iv-resother" style="margin-top:10px">Other material</label><input id="iv-resother" type="text" value="${val('resourcesOther')}"></div>
    </section>
    <div class="row"><button class="btn primary" type="submit">Save interview</button>${iv.updatedAt ? `<span class="fine">Last saved ${fmtDate(iv.updatedAt)}</span>` : ''}</div>
  </form>`;
};

/* ------------------------------------------------------------------ settings: data, GitHub sync, coach key */
function saveText(){
  const st = GMATStore.sync.status();
  if (st.status === 'off') return 'saved in this browser';
  if (st.status === 'ok') return 'synced with GitHub' + (st.lastSync ? ' ' + st.lastSync.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' }) : '');
  if (st.status === 'error') return 'GitHub sync failed · see Settings';
  return 'syncing with GitHub…';
}
function syncErrText(e){
  const c = e && e.code;
  if (c === 'gh_auth') return 'GitHub rejected the token. Create a new one and paste it again.';
  if (c === 'gh_access') return 'The token cannot see that repository. Check the name, and give the token access to it.';
  if (c === 'gh_readonly') return 'The token can read the repository but not write to it. Give it “Contents: Read and write”.';
  if (c === 'gh_repo') return 'Write the repository as owner/name, for example matt52-ctrl/claude.';
  if (c === 'gh_rate') return 'GitHub is limiting requests right now. Try again in a few minutes.';
  if (c === 'gh_public') return 'That repository is public: anyone could read your progress. Use a private repository, or tick the box to sync there anyway.';
  if (c === 'gh_conflict') return 'Another device kept saving at the same time. Press “Sync now” again.';
  if (c === 'gh_badfile') return 'The progress file on GitHub is not valid JSON. Ask Claude to repair it.';
  if (c === 'network') return 'Could not reach GitHub. Your progress is safe in this browser and syncs when you are back online.';
  return 'GitHub sync failed' + (e && e.text ? ': ' + e.text : '.');
}
function onSyncStatus(){ renderChrome(); if (S.tab === 'settings' && !S.run && !S.ui.dirty) render(); }
VIEWS.settings = function(){
  const ok = S.dbStatus === 'ok', sum = ok ? GMATStore.summary() : null;
  const sc = GMATStore.sync.config(), st = GMATStore.sync.status();
  const pill = { off:['', 'Off'], ok:['good', 'Synced'], error:['bad', 'Error'], syncing:['acc', 'Syncing…'], pending:['acc', 'Changes waiting'] }[st.status] || ['', st.status];
  return `<section><h1>Settings</h1><p class="muted" style="max-width:70ch">Where your progress is saved.</p></section>
  <section class="grid2">
    <div class="card stack"><h2>Your data</h2>
      <p class="muted">Progress is saved in this browser${sc.on ? ' and synced to GitHub' : ''}. ${sc.on ? 'Every device with sync on shares it.' : 'Other browsers and devices do not see it unless you turn on GitHub sync.'}</p>
      ${sum ? `<ul class="facts"><li><b>Questions</b><span class="mono">${sum.questions} in the bank${sum.generated ? ` · ${sum.generated} reported` : ''}${GEN ? ` · plus unlimited generated Quant and Data Insights questions` : ''}</span></li><li><b>Progress</b><span class="mono">${sum.sessions} sessions · ${sum.errors} logged errors · ${sum.mocks} mocks</span></li><li><b>Size</b><span class="mono">${Math.max(1, Math.round(sum.bytes/1024))} KB of about 5,000 KB</span></li></ul>` : ''}
      <div class="row"><button class="btn" data-act="exportdata" ${ok ? '' : 'disabled'}>Export backup</button><button class="btn" data-act="importpick" ${ok ? '' : 'disabled'}>Import backup</button><input type="file" id="import-file" accept=".json,application/json" hidden></div>
      <p class="fine">A backup is one JSON file. Importing adds it to what is here; for each item the newer version wins.</p>
      ${S.ui.erase ? `<div class="confirm"><span>Erase all progress in this browser?${sc.on ? ' The copy on GitHub stays and comes back at the next sync.' : ' Export a backup first if you may need it.'}</span><button class="btn small danger" data-act="eraseok">Erase</button><button class="btn small" data-act="eraseno">Keep</button></div>` : `<div class="row"><button class="btn ghost danger small" data-act="erase" ${ok ? '' : 'disabled'}>Erase data in this browser</button></div>`}
    </div>
    <form class="card stack" data-form="sync" data-dirty><div class="row" style="justify-content:space-between"><h2>Sync with GitHub</h2><span class="pill ${pill[0]}">${pill[1]}</span></div>
      <p class="muted">Saves your progress as one file in a GitHub repository. It follows you across devices, and Claude can read it to plan your training.</p>
      ${st.status === 'error' ? `<p class="msg bad">${esc(syncErrText(st.error))}</p>` : ''}
      ${st.status === 'ok' && st.lastSync ? `<p class="fine">Last sync ${esc(st.lastSync.toLocaleString('en-GB', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }))} · file <span class="mono">${esc(sc.path)}</span> on branch <span class="mono">${esc(sc.branch)}</span></p>` : ''}
      <div class="fgrid"><div><label class="lab" for="sy-repo">Repository</label><input id="sy-repo" type="text" autocomplete="off" spellcheck="false" placeholder="owner/name" value="${esc(sc.repo)}"></div>
        <div><label class="lab" for="sy-branch">Branch</label><input id="sy-branch" type="text" autocomplete="off" spellcheck="false" value="${esc(sc.branch)}"><p class="hint">Created if missing.</p></div></div>
      <div><label class="lab" for="sy-token">GitHub token</label><input id="sy-token" type="password" autocomplete="off" spellcheck="false" placeholder="${sc.hasToken ? 'Saved. Paste a new one to replace it.' : 'github_pat_…'}"></div>
      ${S.ui.syncPublic ? '<label class="checks"><input type="checkbox" id="sy-public"> Sync to this public repository anyway</label>' : ''}
      <div class="row"><button class="btn primary" type="submit">${sc.on ? 'Save and sync' : 'Turn on sync'}</button>${sc.on ? '<button class="btn" type="button" data-act="syncnow">Sync now</button><button class="btn ghost" type="button" data-act="syncoff">Turn off</button>' : ''}</div>
      <details class="more"><summary>How to create the token</summary><ol class="hints" style="margin-top:8px">
        <li>On github.com open Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token.</li>
        <li>Repository access: <b>Only select repositories</b>, and pick the repository above.</li>
        <li>Permissions → Repository permissions → <b>Contents: Read and write</b>. Nothing else.</li>
        <li>Pick an expiry date, generate, and paste the token here. Repeat on each device.</li></ol></details>
      <p class="fine">Use a <b>private</b> repository (by default <span class="mono">${esc(sc.repo || 'your-site-repo-progress')}</span>), not the public one that hosts this site. The token stays in this browser and is sent only to api.github.com.</p>
    </form>
  </section>`;
};
function downloadJSON(obj, name){
  const url = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 1)], { type:'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
function importFile(input){
  const f = input.files && input.files[0]; if (!f) return;
  f.text().then(t => { const n = GMATStore.importData(JSON.parse(t)); toast(`Imported ${n} item${n === 1 ? '' : 's'}.`); render(); })
    .catch(e => toast(e && e.code === 'quota_exceeded' ? dbErrorText(e) : 'That file is not a GMAT Lab backup.'))
    .finally(() => { input.value = ''; });
}

/* ------------------------------------------------------------------ actions */
const ACTIONS = {
  lesson(el){ S.ui.lesson = el.dataset.arg; quitDrill(); if (S.run){ if (LOCKED.includes(S.run.phase)) return; endRun('learn'); return; } S.tab = 'learn'; try { history.replaceState(null, '', '#learn'); } catch(e){} render(); window.scrollTo(0,0); },
  lessonback(){ S.ui.lesson = null; render(); window.scrollTo(0,0); },
  tab(el){ const t = el.dataset.arg; if (t === 'learn') S.ui.lesson = null; quitDrill(); if (S.run){ if (LOCKED.includes(S.run.phase)) return; endRun(t); return; } S.tab = t; try { history.replaceState(null, '', '#' + t); } catch(e){} render(); window.scrollTo(0,0); },
  startBlock(el){ startBlock(el.dataset.arg); },
  restartBlock(el){ for (const s of diagSessions(el.dataset.arg).filter(s => s.status === 'active')) write('sessions/' + s.id, 'update', { status:'abandoned' }); startBlock(el.dataset.arg); },
  openResults(el){ openResults(el.dataset.arg); },
  startRetests(el){ const k = +(el && el.dataset.arg || 0); let qids = dueErrors().map(e => e.qid); if (k > 0) qids = qids.slice(0, k); if (qids.length) startLearn(qids, 'Retests', 'retest'); },
  pick(el){ const t = curTarget(); if (!t) return; const i = +el.dataset.i, before = clone(t.get()); t.set(i); noteAnswer(t, before); $$('[data-act="pick"]', el.closest('.choices')).forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.i === i))); syncReady(); },
  pickpart(el){ const t = curTarget(); if (!t) return; const p = +el.dataset.p, i = +el.dataset.i, before = clone(t.get()); const v = Array.isArray(t.get()) ? [...t.get()] : t.q.parts.map(() => null); v[p] = i; t.set(v); noteAnswer(t, before); $$(`[data-act="pickpart"][data-p="${p}"]`).forEach(b => { const on = +b.dataset.i === i; b.setAttribute('aria-pressed', String(on)); b.textContent = on ? '●' : '○'; }); syncReady(); },
  conf(el){ const q = curTarget().q; const r = S.run; r.answers[q.id] = r.answers[q.id] || {}; r.answers[q.id].confidence = +el.dataset.v; $$('button', el.parentElement).forEach(b => b.setAttribute('aria-pressed', String(b === el))); syncReady(); },
  bookmark(el){ const r = S.run; const q = curQ(); const a = r.answers[q.id] = r.answers[q.id] || {}; a.bookmarked = !a.bookmarked; el.setAttribute('aria-pressed', String(a.bookmarked)); el.textContent = a.bookmarked ? 'Bookmarked' : 'Bookmark'; },
  toggleclock(){ S.ui.clockHidden = !S.ui.clockHidden; tick(); },
  next(){ const r = S.run; stampTime(); if (r.idx === r.qids.length - 1) adaptivePush(r); saveDraft(); if (r.idx < r.qids.length - 1){ r.idx++; r.qStart = Date.now(); S.ui.msrTab = 0; render(); window.scrollTo(0,0); } else { r.phase = 'review'; render(); window.scrollTo(0,0); } },
  endprompt(){ $('#endconfirm').hidden = false; },
  endcancel(){ $('#endconfirm').hidden = true; },
  endnow(){ finishRun(false); },
  openedit(el){ const r = S.run; r.editIdx = +el.dataset.i; r.editDraft = clone((r.answers[r.qids[r.editIdx]] || {}).answer); r.phase = 'edit'; r.qStart = Date.now(); S.ui.msrTab = 0; render(); window.scrollTo(0,0); },
  backreview(){ const r = S.run; stampTime(); r.phase = 'review'; render(); },
  savechange(){ const r = S.run; const q = curQ(); const a = r.answers[q.id] = r.answers[q.id] || {};
    if (JSON.stringify(a.answer) !== JSON.stringify(r.editDraft) && r.editsUsed < 3){ if (!a.edited) a.changedFrom = clone(a.answer); a.answer = clone(r.editDraft); a.edited = true; r.editsUsed++; toast(`Answer changed. ${3 - r.editsUsed} change${3 - r.editsUsed === 1 ? '' : 's'} left.`); }
    stampTime(); r.phase = 'review'; saveDraft(); render(); },
  reviewstart(){ const r = S.run; const list = buildDebrief(r.attempts, r.reviewedQids); if (!list.length) return; r.debrief = newDebrief(list); r.phase = 'debrief'; S.ui.msrTab = 0; render(); window.scrollTo(0,0); },
  closeresults(){ const r = S.run; if (!buildDebrief(r.attempts, r.reviewedQids).length) write('sessions/' + r.id, 'update', { reviewed:true }); endRun(r.kind === 'diagnostic' ? 'diagnostic' : r.kind === 'exam' ? 'mocks' : 'today'); },
  dcheck(){ const d = S.run.debrief; const q = curTarget().q; d.tries++;
    if (isCorrect(q, d.retry)){ d.solved = true; d.msg = { kind:'good', text:`Correct on retry${d.hints ? `, after ${d.hints} hint${d.hints > 1 ? 's' : ''}` : ''}. Now log why the first attempt went wrong.` }; }
    else { d.msg = { kind:'bad', text: d.tries > 1 ? 'Still not correct. Take the next hint.' : 'Still not correct. Try another angle or take a hint.' }; d.retry = null; }
    render(); },
  hint(){ const d = S.run.debrief; d.hints++; d.msg = null; render(); },
  reveal(){ const d = S.run.debrief; d.revealed = true; d.msg = null; render(); },
  etype(el){ const d = S.run.debrief; d.etype = el.dataset.v; $$('[data-act="etype"]').forEach(b => b.setAttribute('aria-pressed', String(b === el))); const e = ERROR_TYPES.find(x => x[0] === d.etype); $('#etype-desc').textContent = e ? e[1] : ''; },
  logslow(){ const d = S.run.debrief; d.logSlow = true; d.etype = 'Timing'; render(); },
  async saveerror(){ const r = S.run, d = r.debrief, it = d.list[d.i], q = S.bank[it.qid];
    if (!d.etype){ toast('Pick the error type first.'); return; }
    const why = ($('#why') || {}).value.trim() || (it.reason === 'wrong' ? diagnose(q, it.a.answer).map(x => x.why).join(' ') : ''), rule = ($('#rule') || {}).value || '';
    saveError(q, it, d.etype, why.trim(), rule.trim()); d.logSlow = false; debriefAdvance(); },
  skipitem(){ S.run.debrief.logSlow = false; debriefAdvance(); },
  lcheck(){ learnCheck(); },
  lnext(){ learnAdvance(); },
  lend(){ const r = S.run; if (r.phase === 'learn' && r.sub === 'answer'){ r.phase = 'done'; r.closed = true; stopTicker(); write('sessions/' + r.id, 'update', { status:'done', end:new Date().toISOString(), durationSec: Math.round((Date.now() - r.started)/1000) }); render(); } else learnAdvanceEnd(); },
  closedone(){ endRun('today'); },
  msrtab(el){ const ct = curTarget(), q = ct ? ct.q : S.bank[S.ui.reviewQ]; if (!q) return; const t = +el.dataset.t; S.ui.msrTab = t; $$('[data-act="msrtab"]').forEach(b => b.setAttribute('aria-selected', String(+b.dataset.t === t))); const body = $('#msr-body'); if (body) body.innerHTML = rich(q.tabs[t].body, q.section); },
  sort(el){ const id = el.dataset.q, c = +el.dataset.c; const st = S.ui.sort[id] || { c:null, dir:1 }; S.ui.sort[id] = st.c === c ? { c, dir: -st.dir } : { c, dir: 1 }; const box = $(`.ta[data-q="${id}"]`); if (box) box.outerHTML = tableHTML(S.bank[id]); },
  startpractice(){ const P = S.ui.practice; const seen = new Set(attemptsAll().map(a => a.qid));
    let pool = practicePool().filter(q => (!P.section || q.section === P.section) && (!P.topic || q.topic === P.topic) && (!P.diff || String(q.difficulty) === P.diff || (P.diff === '5' && q.difficulty >= 5)) && (!P.unseen || !seen.has(q.id)));
    pool = pool.sort(() => Math.random() - 0.5).slice(0, +P.count);
    if (pool.length < +P.count){      // top up with generated questions, one per template before any repeats
      const g = genPool(P.topic).filter(q => (!P.section || q.section === P.section) && (!P.topic || q.topic === P.topic) && (!P.diff || String(q.difficulty) === P.diff || (P.diff === '5' && q.difficulty >= 5))).sort(() => Math.random() - 0.5);
      const tpl = id => id.split('-')[1], firsts = g.filter((q, i) => g.findIndex(x => tpl(x.id) === tpl(q.id)) === i);
      pool = pool.concat([...firsts, ...g.filter(q => !firsts.includes(q))].slice(0, +P.count - pool.length));
    }
    if (!pool.length) return;
    const label = `Practice · ${P.topic || P.section || 'mixed'}`;
    if (P.mode === 'timed'){ const lim = Math.round(pool.reduce((s,q) => s + PACE[q.section], 0)); startRun({ kind:'practice', qids: pool.map(q => q.id), mode:'test', timed:true, limitSec: lim, label: label + ' · timed' }); }
    else startLearn(pool.map(q => q.id), label, 'practice'); },
  report(){ const b = $('#report-box'); if (b) b.hidden = false; },
  reportcancel(){ const b = $('#report-box'); if (b) b.hidden = true; },
  async reportsend(){ const ct = curTarget(), q = ct ? ct.q : S.bank[S.ui.reviewQ]; if (!q) return; const note = ($('#report-note') || {}).value || ''; const ok = await write('bank/' + q.id, 'update', { flagged:true, flagNote: note.trim(), flaggedAt: new Date().toISOString() }); if (ok){ toast('Reported. Claude will check this question.'); const b = $('#report-box'); if (b) b.hidden = true; } },
  mockdel(el){ S.ui.delMock = el.dataset.arg; render(); },
  mockdelno(){ S.ui.delMock = null; render(); },
  mockdelok(el){ write('mocks/' + el.dataset.arg, 'delete'); S.ui.delMock = null; render(); toast('Mock removed.'); },
  setmin(el){ S.ui.minutes = +el.dataset.v; try { localStorage.setItem('gmatlab.minutes', el.dataset.v); } catch(e){} render(); },
  coachq(el){ S.ui.coachQ = el.dataset.v; render(); },
  startsmart(el){ const [mode, topic, n] = el.dataset.arg.split('|'); startSmart(mode, +n, { topic: topic || null }); },
  startsmartform(){ const P = S.ui.practice; startSmart(P.mode === 'timed' ? 'timed' : 'learn', +P.count, { section: P.section || null, topic: P.topic || null }); },
  startmock(el){ startMock(el.dataset.arg); },
  startdrill(el){ const [skill, level] = String(el.dataset.arg || '').split('|'); quitDrill(); startDrill(skill || null, level ? +level : null); },
  ogetype(el){ const U = ogUI(); U.etype = el.dataset.v; $$('[data-act="ogetype"]').forEach(b => b.setAttribute('aria-pressed', String(b === el))); },
  ogretest(el){ const [qid, ok] = el.dataset.arg.split('|'); ogRetest(qid, ok === '1'); },
  ogdel(el){ ogStash(); S.ui.ogDel = el.dataset.arg; render(); },
  ogdelno(){ ogStash(); S.ui.ogDel = null; render(); },
  ogdelok(el){ ogStash(); ogDelete(el.dataset.arg); },
  drillquit(){ quitDrill(); S.tab = 'drills'; render(); window.scrollTo(0,0); },
  examnext(){ examNext(); },
  exambreak(){ const r = S.run; S.exam.breakUsed = true; r.phase = 'break'; r.breakEnds = Date.now() + SPEC.navigationRules.breaks.minutes * 60000; startTicker(); render(); window.scrollTo(0,0); },
  examclose(){ S.exam = null; S.ui.mockView = 'history'; endRun('mocks'); },
  mockview(el){ S.ui.mockView = el.dataset.arg; S.ui.reviewQ = null; render(); window.scrollTo(0,0); },
  mockreport(el){ openMockPage('report', el.dataset.arg); },
  mockreview(el){ openMockPage('review', el.dataset.arg); },
  reviewq(el){ S.ui.reviewQ = S.ui.reviewQ === el.dataset.arg ? null : el.dataset.arg; S.ui.msrTab = 0; render(); const n = $('#rq'); if (n) n.scrollIntoView({ block:'start' }); },
  exportdata(){ downloadJSON(GMATStore.exportData(), `gmat-lab-backup-${today()}.json`); },
  importpick(){ const i = $('#import-file'); if (i) i.click(); },
  erase(){ S.ui.erase = true; render(); },
  eraseno(){ S.ui.erase = false; render(); },
  eraseok(){ GMATStore.eraseLocal(); S.ui.erase = false; render(); toast('Progress erased in this browser.'); },
  async syncnow(){ S.ui.dirty = false; await GMATStore.sync.now(); const st = GMATStore.sync.status(); toast(st.status === 'ok' ? 'Synced with GitHub.' : syncErrText(st.error)); render(); },
  syncoff(){ GMATStore.sync.disable(); S.ui.dirty = false; render(); toast('Sync turned off. Progress stays in this browser.'); },
};
function openMockPage(view, id){
  S.ui.mockView = view; S.ui.mockId = id; S.ui.reviewQ = null;
  if (S.run){ S.exam = null; endRun('mocks'); return; }
  S.tab = 'mocks'; try { history.replaceState(null, '', '#mocks'); } catch(e){} render(); window.scrollTo(0,0);
}
function learnAdvanceEnd(){ const r = S.run; if (r.adaptive) r.adaptive.n = r.qids.length; r.idx = r.qids.length - 1; learnAdvance(); }
const SUBMITS = {
  drill(){ drillSubmit(); },
  og(){ ogSave(); },
  async studylog(f){ const min = Number($('#sl-min').value), date = $('#sl-date').value || today(), note = $('#sl-note').value.trim();
    if (!min || min < 1){ toast('Enter the minutes you studied.'); return; }
    const key = date.slice(0,7); const doc = S.studylog[key];
    const ok = await write('studylog/' + key, 'set', { entries: [...clone((doc && doc.entries) || []), { date, minutes:min, note }] });
    if (ok){ toast(`Logged ${min} minutes.`); S.ui.dirty = false; render(); } },
  async mock(f){ const total = Number($('#m-total').value);
    if (!total || total < 205 || total > 805 || total % 10 !== 5){ toast('Totals run from 205 to 805 and end in 5.'); return; }
    const sec = id => { const v = Number($(id).value); return v >= 60 && v <= 90 ? v : null; };
    const ok = await write('mocks/' + uid('m'), 'set', { kind:'logged', date: $('#m-date').value || today(), name: $('#m-name').value, total, quant: sec('#m-q'), verbal: sec('#m-v'), di: sec('#m-di'), notes: $('#m-notes').value.trim() });
    if (ok){ toast('Mock saved.'); S.ui.dirty = false; render(); } },
  async interview(f){
    const g = id => ($(id) || {}).value || '';
    const tgt = (f.querySelector('input[name="target"]:checked') || {}).value || '';
    const doc = { ...clone(interview()) }; delete doc.id;
    Object.assign(doc, { target: tgt, background: g('#iv-bg').trim(), school: g('#iv-school').trim(), uniMath: g('#iv-uni').trim(), priorTests: g('#iv-tests').trim(), gmatExp: g('#iv-gmat').trim(),
      examDate: g('#iv-exam') || EXAM_DEFAULT, hoursPerWeek: g('#iv-hours') ? Number(g('#iv-hours')) : null, sessionLength: g('#iv-len'), weekends: g('#iv-we'),
      days: $$('input[name="days"]:checked', f).map(x => x.value), busyWeeks: g('#iv-busy').trim(), holidays: g('#iv-hol').trim(),
      resources: $$('input[name="resources"]:checked', f).map(x => x.value), resourcesOther: g('#iv-resother').trim(), updatedAt: new Date().toISOString() });
    for (const [k] of RATING_ITEMS){ const v = g('#iv-' + k); doc[k] = v ? Number(v) : null; }
    const missing = []; if (!doc.target) missing.push('the target'); if (!doc.hoursPerWeek) missing.push('hours per week'); if (!doc.gmatExp) missing.push('your GMAT experience (write “none” if none)');
    doc.done = missing.length === 0;
    const ok = await write('profile/interview', 'set', doc);
    if (ok){ S.ui.dirty = false; toast(doc.done ? 'Interview saved. Next: the diagnostic.' : `Saved. Still missing: ${missing.join(', ')}.`); if (doc.done){ S.tab = 'today'; try { history.replaceState(null, '', '#today'); } catch(e){} } render(); window.scrollTo(0,0); } },
  async sync(f){
    const btn = f.querySelector('button[type="submit"]'); if (btn) btn.disabled = true;
    toast('Connecting to GitHub…');
    try { await GMATStore.sync.enable({ repo: $('#sy-repo').value, branch: $('#sy-branch').value, token: $('#sy-token').value.trim(), allowPublic: !!($('#sy-public') || {}).checked }); S.ui.syncPublic = false; toast('Sync is on. Your progress is on GitHub.'); }
    catch (e){ if (e && e.code === 'gh_public') S.ui.syncPublic = true; toast(syncErrText(e)); }
    S.ui.dirty = false; render(); },
};

/* ------------------------------------------------------------------ events */
document.addEventListener('click', e => {
  const g = e.target.closest('[data-gl]');
  if (g){ e.preventDefault(); showGloss(g); return; }
  if (!e.target.closest('#glpop')) hideGloss();
  const el = e.target.closest('[data-act]'); if (!el || el.disabled) return;
  const fn = ACTIONS[el.dataset.act]; if (!fn) return;
  e.preventDefault(); fn(el, e);
});
document.addEventListener('change', e => {
  const el = e.target;
  if (el.id === 'import-file'){ importFile(el); return; }
  if (el.id === 'gl-toggle'){ S.ui.gloss = el.checked; try { localStorage.setItem('gmatlab.gloss', el.checked ? 'on' : 'off'); } catch(e){} toast(el.checked ? 'Glossary words are underlined again.' : 'Glossary underlining is off.'); return; }
  if (el.matches('select[data-p]')){ const t = curTarget(); if (!t) return; const p = +el.dataset.p, before = clone(t.get()); const v = Array.isArray(t.get()) ? [...t.get()] : t.q.parts.map(() => null); v[p] = el.value === '' ? null : +el.value; t.set(v); noteAnswer(t, before); syncReady(); return; }
  if (el.id === 'og-result'){ ogUI().result = el.value; const box = $('#og-err'); if (box) box.hidden = el.value !== 'wrong'; return; }
  if (el.dataset.ui && el.dataset.ui.startsWith('og.')) ogStash();
  if (el.dataset.ui){ const [grp, key] = el.dataset.ui.split('.'); S.ui[grp] = S.ui[grp] || {}; S.ui[grp][key] = el.type === 'checkbox' ? el.checked : el.value;
    if (grp === 'practice' && key === 'section') S.ui.practice.topic = '';
    render(); }
});
document.addEventListener('input', e => {
  const el = e.target;
  if (el.id === 'gl-search'){ const q = el.value.trim().toLowerCase(); $$('[data-glrow]').forEach(n => { n.hidden = !!q && !n.dataset.glrow.includes(q); }); return; }
  if (el.id === 'kb-search'){ const q = el.value.trim().toLowerCase(); $$('[data-kb]').forEach(n => { n.hidden = !!q && !n.dataset.kb.includes(q); }); return; }
  if (el.id === 'calc-in'){ const out = $('#calc-out'); const v = el.value.trim(); if (!v){ out.textContent = '='; return; } try { const r = calc(v); out.textContent = isFinite(r) ? '= ' + (Math.round(r*1e8)/1e8).toLocaleString('en-US', { maximumFractionDigits: 8 }) : '= —'; } catch(_){ out.textContent = '= …'; } return; }
  if (el.closest('form[data-dirty]')) S.ui.dirty = true;
});
document.addEventListener('submit', e => { e.preventDefault(); const f = e.target; const fn = SUBMITS[f.dataset.form]; if (fn) fn(f); });
window.addEventListener('hashchange', () => { const t = location.hash.slice(1); if (VIEWS[t] && !S.run && !S.drill){ S.tab = t; render(); } });

/* ------------------------------------------------------------------ boot */
/* ------------------------------------------------------------------ Official Guide tracker
   Questions from the official books are logged, never copied: book, number, topic, level, result, time and, for a miss,
   the cause. Each day's entries are one session (kind 'og', mode 'log', id og-YYYY-MM-DD), so they count in mastery, the
   ability model and the plan; a miss goes to the error log (errors/og-…, source 'og') and comes back in Retests, to redo in the book. */
const OG_BOOKS = [
  { key: 'og', name: 'GMAT Official Guide 2026–2027', short: 'OG' },
  { key: 'qr', name: 'Official Guide Quantitative Review', short: 'OG Quant Review', section: 'Quant' },
  { key: 'dir', name: 'Official Guide Data Insights Review', short: 'OG DI Review', section: 'Data Insights' },
  { key: 'vr', name: 'Official Guide Verbal Review', short: 'OG Verbal Review', section: 'Verbal' },
  { key: 'online', name: 'Official online question bank', short: 'OG online' },
  { key: 'other', name: 'Other official material', short: 'Official' },
];
const OG_DIFF = [['Easy', 2], ['Medium', 4], ['Hard', 5]];     // GMAT Lab's reading of the official labels on its 1–6 scale
const DI_TYPE = { 'Data Sufficiency': 'DS', 'Two-Part Analysis': 'TPA', 'Table Analysis': 'TA', 'Graphics Interpretation': 'GI', 'Multi-Source Reasoning': 'MSR' };
const typeOfTopic = (section, topic) => section === 'Quant' ? 'PS' : section === 'Verbal' ? (/^RC/.test(topic) ? 'RC' : 'CR') : (DI_TYPE[topic] || 'DS');
const ogBook = key => OG_BOOKS.find(b => b.key === key) || OG_BOOKS[0];
const isOg = qid => /^og-/.test(String(qid));
const ogName = o => o ? `${ogBook(o.book).short} · ${SHORT[o.section] || o.section} #${o.num}` : '';
function ogUI(){
  const U = S.ui.og = S.ui.og || {};
  if (!U.book) U.book = 'og';
  const b = ogBook(U.book); if (b.section) U.section = b.section;
  if (!SECTIONS.includes(U.section)) U.section = 'Quant';
  if (!SYLLABUS[U.section].includes(U.topic)) U.topic = SYLLABUS[U.section][0];
  if (!U.diff) U.diff = 'Medium';
  return U;
}
/* Keep what was typed when a select re-renders the form. */
function ogStash(){ const U = ogUI(); for (const [k, id] of [['num', '#og-num'], ['time', '#og-time'], ['why', '#og-why'], ['rule', '#og-rule'], ['result', '#og-result'], ['mine', '#og-mine'], ['right', '#og-right']]){ const el = $(id); if (el) U[k] = el.value; } }
function ogAttempts(){ return attemptsAll().filter(a => a.kind === 'og'); }
function dueOgErrors(){ const t = today(); return Object.values(S.errors).filter(e => isOg(e.qid) && e.status === 'active' && e.nextDue && e.nextDue <= t).sort((a, b) => String(a.nextDue).localeCompare(String(b.nextDue))); }
function parseTime(v){ v = String(v || '').trim(); if (!v) return 0; const m = /^(\d{1,2}):([0-5]\d)$/.exec(v); if (m) return +m[1] * 60 + +m[2]; return /^\d{1,4}$/.test(v) ? +v : NaN; }
/* Append one attempt to today's Official Guide session. */
function ogLogAttempt(at){
  const sid = 'og-' + today(), ses = S.sessions[sid], attempts = [...((ses && ses.attempts) || []), at];
  return write('sessions/' + sid, 'set', { kind: 'og', mode: 'log', label: 'Official Guide · ' + fmtDate(today()), status: 'done', reviewed: true, timed: false,
    start: (ses && ses.start) || at.at, end: at.at, durationSec: attempts.reduce((t, x) => t + (x.timeSec || 0), 0), attempts });
}
function saveOgError(at, etype, why, rule, mine, right){
  const t = today(), prev = S.errors[at.qid];
  const doc = prev ? clone(prev) : { qid: at.qid, section: at.section, topic: at.topic, subtopic: '', type: at.type, difficulty: at.difficulty, created: t, count: 0, history: [], retests: [], relapses: 0, source: 'og', og: { ...at.og, section: at.section } };
  delete doc.id;
  doc.count = (doc.count || 0) + 1; doc.lastWrong = t; doc.errorType = etype; doc.why = why; doc.prevention = rule;
  doc.myAnswer = mine || '—'; doc.correctAnswer = right || '—'; doc.correctMethod = ''; doc.stemShort = ogName(doc.og) + ' (in the book)';
  doc.box = 0; doc.nextDue = addDays(t, INTERVALS[0]); doc.status = 'active';
  doc.history = [...(doc.history || []), { date: t, answer: doc.myAnswer, errorType: etype, why, reason: 'wrong', sid: 'og-' + t }].slice(-20);
  return write('errors/' + at.qid, 'set', doc);
}
async function ogSave(){
  ogStash();
  const U = ogUI(), num = String(U.num || '').trim(), sec = parseTime(U.time);
  if (!/^\d{1,4}$/.test(num)){ toast('Enter the question number from the book.'); return; }
  if (U.result !== 'right' && U.result !== 'wrong'){ toast('Choose Right or Wrong.'); return; }
  if (isNaN(sec)){ toast('Write the time as m:ss (for example 2:10), or leave it empty.'); return; }
  const section = U.section, topic = U.topic, correct = U.result === 'right', qid = `og-${U.book}-${SHORT[section].toLowerCase()}-${num}`;
  const prev = S.errors[qid], redo = !!(prev && prev.status === 'active');
  if (!correct && !redo && !U.etype){ toast('Pick the error type first.'); return; }
  const at = { qid, answer: null, correct, unanswered: false, timeSec: sec, expectedSec: Math.round(PACE[section]), confidence: null, section, topic, type: typeOfTopic(section, topic), skill: null,
    difficulty: (OG_DIFF.find(d => d[0] === U.diff) || OG_DIFF[1])[1], at: new Date().toISOString(), timed: sec > 0, og: { book: U.book, num: +num, diff: U.diff }, ...(redo ? { retest: true } : {}) };
  const ok = await ogLogAttempt(at); if (!ok) return;
  if (redo){ recordRetest({ id: qid }, correct); if (!correct && U.etype) write('errors/' + qid, 'update', { errorType: U.etype, why: (U.why || '').trim() || prev.why || '', prevention: (U.rule || '').trim() || prev.prevention || '' }); }
  else if (!correct) saveOgError(at, U.etype, (U.why || '').trim(), (U.rule || '').trim(), U.mine, U.right);
  toast(redo ? `Retest recorded: ${correct ? 'right, the next one comes later' : 'wrong again, it comes back tomorrow'}.` : correct ? `Saved: ${ogName({ ...at.og, section })}, right.` : `Saved to the error log: ${ogName({ ...at.og, section })}. Redo it in the book tomorrow.`);
  Object.assign(U, { num: String(+num + 1), time: '', result: '', etype: null, why: '', rule: '', mine: '', right: '' });
  S.ui.dirty = false; render();
}
function ogRetest(qid, correct){
  const e = S.errors[qid]; if (!e) return;
  const o = e.og || {}, section = e.section;
  ogLogAttempt({ qid, answer: null, correct, unanswered: false, timeSec: 0, expectedSec: Math.round(PACE[section] || 120), confidence: null, section, topic: e.topic, type: e.type, skill: null, difficulty: e.difficulty, at: new Date().toISOString(), timed: false, og: { book: o.book, num: o.num, diff: o.diff }, retest: true });
  recordRetest({ id: qid }, correct);
  toast(correct ? 'Right: the next retest comes later.' : 'Wrong again: it comes back tomorrow.'); render();
}
function ogCard(){
  const U = ogUI(), b = ogBook(U.book), at = ogAttempts(), recent = at.slice(-12).reverse();
  const stats = SECTIONS.map(sec => { const l = at.filter(a => a.section === sec), t = l.filter(a => a.timeSec > 0);
    return { sec, n: l.length, acc: l.length ? l.filter(a => a.correct).length / l.length : null, pace: t.length ? t.reduce((s, a) => s + a.timeSec / a.expectedSec, 0) / t.length : null }; });
  const opt = (v, label, cur) => `<option value="${esc(v)}" ${String(cur) === String(v) ? 'selected' : ''}>${esc(label)}</option>`;
  const letters = (id, cur, label) => `<div><label class="lab" for="${id}">${label}</label><select id="${id}">${opt('', '—', cur)}${[...LETTERS].map(l => opt(l, l, cur)).join('')}</select></div>`;
  return `<section class="grid2">
    <form class="card stack" data-form="og" data-dirty><h2>Official Guide tracker</h2>
      <p class="muted">Log the official questions you do in the books: they count in Mastery, the Error log, your ability estimate and the plan. Only the number is saved, never the question.</p>
      <div class="fgrid">
        <div><label class="lab" for="og-book">Book</label><select id="og-book" data-ui="og.book">${OG_BOOKS.map(x => opt(x.key, x.name, U.book)).join('')}</select></div>
        <div><label class="lab" for="og-sec">Section</label><select id="og-sec" data-ui="og.section" ${b.section ? 'disabled' : ''}>${SECTIONS.map(s => opt(s, s, U.section)).join('')}</select></div>
        <div><label class="lab" for="og-num">Question number</label><input id="og-num" type="text" inputmode="numeric" autocomplete="off" value="${esc(U.num || '')}" placeholder="e.g. 123"></div>
        <div><label class="lab" for="og-topic">Topic</label><select id="og-topic" data-ui="og.topic">${SYLLABUS[U.section].map(t => opt(t, t, U.topic)).join('')}</select></div>
        <div><label class="lab" for="og-diff">Difficulty in the book</label><select id="og-diff" data-ui="og.diff">${OG_DIFF.map(([d]) => opt(d, d, U.diff)).join('')}</select></div>
        <div><label class="lab" for="og-time">Your time (m:ss)</label><input id="og-time" type="text" inputmode="numeric" autocomplete="off" value="${esc(U.time || '')}" placeholder="e.g. 2:10, or empty"></div>
        <div><label class="lab" for="og-result">Result</label><select id="og-result">${opt('', 'Choose…', U.result)}${opt('right', 'Right', U.result)}${opt('wrong', 'Wrong', U.result)}</select></div>
      </div>
      <div id="og-err" class="stack" ${U.result === 'wrong' ? '' : 'hidden'}>
        <div class="chips" role="group" aria-label="Error type">${ERROR_TYPES.map(([k, d]) => `<button type="button" class="chip" data-act="ogetype" data-v="${k}" title="${esc(d)}" aria-pressed="${U.etype === k}">${k}</button>`).join('')}</div>
        <div class="fgrid">${letters('og-mine', U.mine, 'Your answer (optional)')}${letters('og-right', U.right, 'Right answer (optional)')}</div>
        <div><label class="lab" for="og-why">Why I missed it</label><textarea id="og-why" rows="2">${esc(U.why || '')}</textarea></div>
        <div><label class="lab" for="og-rule">Prevention rule</label><textarea id="og-rule" rows="2">${esc(U.rule || '')}</textarea></div>
        <p class="fine">If this question is already in your error log, it is recorded as a retest instead.</p>
      </div>
      <div class="row"><button class="btn primary" type="submit">Save</button><span class="fine">Expected time at real pace: ${fmtTime(PACE[U.section])} per question.</span></div>
    </form>
    <div class="stack"><h2>Your official questions</h2>
      ${at.length ? `<div class="box scroll"><table class="tbl"><thead><tr><th>Section</th><th class="num">Questions</th><th class="num">Accuracy</th><th class="num">Time vs pace</th></tr></thead><tbody>${stats.map(x => `<tr><td>${esc(x.sec)}</td><td class="num">${x.n}</td><td class="num">${pct(x.acc)}</td><td class="num">${x.pace == null ? '—' : x.pace.toFixed(2) + '×'}</td></tr>`).join('')}</tbody></table></div>
      <div class="box scroll"><table class="tbl"><thead><tr><th>Date</th><th>Question</th><th>Topic</th><th>Result</th><th class="num">Time</th><th></th></tr></thead><tbody>${recent.map(a => { const key = a.sid + '|' + a.at;
        return `<tr><td>${fmtDate(a.at)}</td><td>${esc(ogName({ ...(a.og || {}), section: a.section }))}</td><td>${esc(a.topic)}</td><td>${a.correct ? '<span class="res-ok">✓ Right</span>' : '<span class="res-no">✗ Wrong</span>'}${a.retest ? ' <span class="pill">retest</span>' : ''}</td><td class="num">${a.timeSec ? fmtTime(a.timeSec) : '—'}</td>
        <td>${S.ui.ogDel === key ? `<button class="btn small danger" data-act="ogdelok" data-arg="${esc(key)}">Delete</button> <button class="btn small ghost" data-act="ogdelno">Keep</button>` : `<button class="linkbtn" data-act="ogdel" data-arg="${esc(key)}">Remove</button>`}</td></tr>`; }).join('')}</tbody></table></div>` : '<p class="muted">Nothing logged yet. Do a few questions in the Official Guide, then log each one here: it takes ten seconds.</p>'}
    </div></section>`;
}
/* Remove a logged entry (a typo); the error it created goes too if nothing else happened to it. */
function ogDelete(key){
  const i = key.lastIndexOf('|'), sid = key.slice(0, i), atIso = key.slice(i + 1), ses = S.sessions[sid]; if (!ses) return;
  const gone = (ses.attempts || []).find(a => a.at === atIso), attempts = (ses.attempts || []).filter(a => a.at !== atIso);
  write('sessions/' + sid, attempts.length ? 'update' : 'delete', attempts.length ? { attempts, durationSec: attempts.reduce((t, x) => t + (x.timeSec || 0), 0) } : undefined);
  const e = gone && S.errors[gone.qid];
  if (e && !gone.retest && e.count === 1 && !(e.retests || []).length && e.created === String(atIso).slice(0, 10)) write('errors/' + gone.qid, 'delete');
  S.ui.ogDel = null; toast('Entry removed.'); render();
}

/* ------------------------------------------------------------------ drills: the basics, fast (drills.js)
   Progress lives in profile/drills: { skills: { id: { passed: 0–3, runs: [...] } }, totalSec, lastDate, updatedAt }. */
const DR = window.GMATDrills || null;
let drillTimer = null;
function drillProgress(){ return (S.profile.drills || {}).skills || {}; }
function drillPlanInfo(){
  if (!DR) return null;
  const nx = DR.nextDrill(drillProgress()), d = S.profile.drills || {};
  return { skill: nx ? nx.skill : null, name: nx ? nx.name : null, level: nx ? nx.level : null, doneToday: d.lastDate === today(), allMastered: !nx };
}
function drillLevelOf(skill){ return Math.min(DR.LEVELS, ((drillProgress()[skill] || {}).passed || 0) + 1); }
function startDrill(skill, level){
  if (!DR || S.run) return;
  if (!skill){ const nx = DR.nextDrill(drillProgress()); skill = nx ? nx.skill : DR.skills()[0].id; }
  level = level || drillLevelOf(skill);
  S.drill = { skill, level, items: DR.makeSet(skill, level, DR.SET_SIZE), i: 0, results: [], phase: 'ask', start: Date.now(), qStart: Date.now(), last: null };
  S.tab = 'drills'; try { history.replaceState(null, '', '#drills'); } catch(e){}
  stopDrillTimer(); drillTimer = setInterval(() => { const D = S.drill, el = $('#drill-clock'); if (!D){ stopDrillTimer(); return; } if (el && D.phase === 'ask' && !D.last) el.textContent = ((Date.now() - D.qStart) / 1000).toFixed(1) + ' s'; }, 100);
  render(); window.scrollTo(0,0);
}
function stopDrillTimer(){ if (drillTimer){ clearInterval(drillTimer); drillTimer = null; } }
function quitDrill(){ S.drill = null; stopDrillTimer(); }
function drillSubmit(){
  const D = S.drill; if (!D || D.phase !== 'ask') return;
  if (D.last){ // "Next"
    D.last = null; D.i++; D.qStart = Date.now();
    if (D.i >= D.items.length) saveDrill();
    render(); return;
  }
  const it = D.items[D.i], input = ($('#drill-in') || {}).value || '', res = DR.check(it, input);
  if (res.reason === 'empty' || res.reason === 'unreadable'){ D.hint = res.reason === 'empty' ? 'Type your answer first.' : 'Write a number, like 12, −3, 0.75 (or 0,75), 3/4 or 3:4.'; render(); return; }
  const sec = Math.round((Date.now() - D.qStart) / 100) / 10;
  D.results.push({ ok: res.ok, sec, input, reason: res.reason });
  D.last = { ok: res.ok, sec, input, reason: res.reason }; D.hint = null;
  render();
}
function saveDrill(){
  const D = S.drill, ev = DR.evaluate(D.skill, D.level, D.results);
  const doc = clone(S.profile.drills || {}); delete doc.id;
  doc.skills = doc.skills || {};
  const sp = doc.skills[D.skill] = doc.skills[D.skill] || { passed: 0, runs: [] };
  const before = sp.passed || 0;
  if (ev.passed && D.level > before) sp.passed = D.level;
  sp.runs = [...(sp.runs || []), { date: today(), level: D.level, n: ev.n, correct: ev.correct, medianSec: ev.medianSec, passed: ev.passed }].slice(-20);
  doc.totalSec = (doc.totalSec || 0) + Math.round((Date.now() - D.start) / 1000);
  doc.lastDate = today(); doc.updatedAt = new Date().toISOString();
  write('profile/drills', 'set', doc);
  D.eval = ev; D.levelUp = (sp.passed || 0) > before; D.phase = 'done'; stopDrillTimer();
}
function drillView(){
  const D = S.drill, sk = DR.skills().find(s => s.id === D.skill);
  if (D.phase === 'done') return drillDoneView(sk);
  const it = D.items[D.i], fb = D.last, lastQ = D.i === D.items.length - 1;
  const hint = it.form === 'fraction' ? 'As a fraction in lowest terms, like 3/4.' : it.form === 'decimal' ? 'As a decimal, like 0.375 (or 0,375).' : /:/.test(DR.show(it)) ? 'As a ratio, like 3:4.' : 'Whole numbers, decimals (0.75 or 0,75) or fractions (3/4).';
  let msg = '';
  if (fb && fb.ok) msg = `<p class="msg good">✓ Right in ${fb.sec.toFixed(1)} s${fb.sec > it.target ? ` · the target is ${it.target} s: aim for speed next time` : ''}</p>`;
  else if (fb) msg = `<p class="msg bad">✗ ${fb.reason === 'lowest' ? 'Right value, but not in lowest terms.' : fb.reason === 'form' ? (it.form === 'fraction' ? 'Write it as a fraction.' : 'Write it as a decimal.') : 'Not right.'} The answer is ${esc(DR.show(it))}.</p><p class="muted">${inline(it.tip, 'Quant')}</p>`;
  return `<div class="testbar"><div class="tb-left"><strong>Drill · ${esc(sk.name)} · level ${D.level}</strong><span class="muted">Question ${D.i + 1} of ${D.items.length} · target ${it.target} s</span></div><div class="tb-right"><span class="clock fixed" id="drill-clock" role="timer" aria-label="Time on this question">${fb ? fb.sec.toFixed(1) + ' s' : '0.0 s'}</span></div></div>
    <section class="card stack drill">
      <p class="drill-q">${inline(it.prompt, 'Quant')}</p>
      <form data-form="drill" class="row drill-row" autocomplete="off">
        <label class="sr" for="drill-in">Your answer</label>
        <input id="drill-in" type="text" inputmode="${it.keys === 'text' ? 'text' : 'decimal'}" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="${fb ? 'next' : 'done'}" value="${fb ? esc(fb.input) : ''}" ${fb ? 'readonly' : ''}>
        <button class="btn primary" id="drill-go" type="submit">${fb ? (lastQ ? 'See the result' : 'Next') : 'Check'}</button>
      </form>
      ${msg || `<p class="fine">${D.hint ? `<span class="res-no">${esc(D.hint)}</span> ` : ''}${hint} Press Enter to check.</p>`}
    </section>
    <div class="row"><button class="btn ghost small" data-act="drillquit">Stop the drill</button></div>`;
}
function drillDoneView(sk){
  const D = S.drill, ev = D.eval, misses = D.results.map((r, i) => ({ r, it: D.items[i] })).filter(x => !x.r.ok);
  const nx = DR.nextDrill(drillProgress());
  const verdict = ev.passed ? (D.levelUp ? (D.level < DR.LEVELS ? `Level ${D.level} passed. Next time: level ${D.level + 1}.` : `Level ${D.level} passed: ${sk.name} mastered.`) : `Passed again at level ${D.level}.`)
    : `Not passed yet: level ${D.level} needs 9 of 10 right${ev.accuracyOk ? '' : ` (you had ${ev.correct})`} and a median time within ${ev.target} s${ev.speedOk ? '' : ` (yours: ${ev.medianSec} s)`}.`;
  return `<section class="card stack"><p class="eyebrow">Drill · ${esc(sk.name)} · level ${D.level}</p><h1>${ev.correct} of ${ev.n} right · median ${ev.medianSec} s</h1>
    <p class="msg ${ev.passed ? 'good' : 'info'}">${esc(verdict)}</p>
    ${misses.length ? `<div class="box scroll"><table class="tbl"><thead><tr><th>Question</th><th>You wrote</th><th>Answer</th><th>Tip</th></tr></thead><tbody>${misses.map(({ r, it }) => `<tr><td>${inline(it.prompt, 'Quant')}</td><td class="mono">${esc(r.input)}</td><td class="mono">${esc(DR.show(it))}</td><td>${inline(it.tip, 'Quant')}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">No mistakes.</p>'}
    <div class="row"><button class="btn ${ev.passed ? '' : 'primary'}" data-act="startdrill" data-arg="${esc(D.skill)}|${D.level}">Again</button>${nx ? `<button class="btn ${ev.passed ? 'primary' : ''}" data-act="startdrill" data-arg="${esc(nx.skill)}">Next drill: ${esc(nx.name)} · level ${nx.level}</button>` : ''}<button class="btn ghost" data-act="drillquit">Back to drills</button></div></section>`;
}
VIEWS.drills = function(){
  if (!DR) return '<section><h1>Drills</h1><p class="banner">The drills could not be loaded. Reload the page.</p></section>';
  const prog = drillProgress(), info = drillPlanInfo(), d = S.profile.drills || {};
  const dots = n => Array.from({ length: DR.LEVELS }, (_, i) => `<span class="lvl ${i < n ? 'on' : ''}" aria-hidden="true"></span>`).join('');
  const card = s => {
    const p = prog[s.id] || {}, passed = Math.min(DR.LEVELS, p.passed || 0), cur = Math.min(DR.LEVELS, passed + 1), last = (p.runs || []).slice(-1)[0];
    return `<div class="card block"><p class="eyebrow"><span class="lvls">${dots(passed)}</span> ${passed >= DR.LEVELS ? 'Mastered' : `Level ${cur} of ${DR.LEVELS}`}</p><h2>${esc(s.name)}</h2><p class="muted">${esc(s.text)}</p>
      <p class="spec">${last ? `Last: ${last.correct}/${last.n}, median ${last.medianSec} s at level ${last.level} (${fmtDate(last.date)})` : 'Not tried yet'} · targets ${s.targets.map(t => t + ' s').join(' / ')}</p>
      <div class="row"><button class="btn small primary" data-act="startdrill" data-arg="${esc(s.id)}|${cur}">Level ${cur}</button>${Array.from({ length: cur - 1 }, (_, i) => `<button class="btn small" data-act="startdrill" data-arg="${esc(s.id)}|${i + 1}">Level ${i + 1}</button>`).join('')}${s.topic && lessonOf(s.topic) ? `<button class="btn small ghost" data-act="lesson" data-arg="${esc(s.topic)}">Theory</button>` : ''}</div></div>`;
  };
  return `<section><h1>Drills</h1><p class="muted" style="max-width:72ch">Five minutes a day on the basics the GMAT takes for granted. Type each answer and press Enter. A level is passed with 9 of 10 right and a median time within the target: on the exam these steps must be automatic, so speed counts as much as accuracy.</p></section>
    <section class="card next stack"><p class="eyebrow">Today’s drill${info && info.doneToday ? ' · done today ✓' : ''}</p>
      ${info && !info.allMastered ? `<h2>${esc(info.name)} · level ${info.level}</h2><p class="muted">Drills go through every skill at level 1 first, then level 2, then level 3, so no basic is left behind.</p><div class="row"><button class="btn primary" data-act="startdrill" data-arg="${esc(info.skill)}">Start · about 5 min</button><span class="fine mono">${Math.round((d.totalSec || 0) / 60)} min of drills so far</span></div>`
        : '<h2>Every drill mastered</h2><p class="muted">Keep them sharp with a drill a week at level 3.</p>'}</section>
    <section class="blocks">${DR.skills().map(card).join('')}</section>`;
};

/* ------------------------------------------------------------------ knowledge base: lessons and guides in knowledge/*.json */
function loadKnowledge(){
  const get = f => fetch('knowledge/' + f, { cache:'no-cache' }).then(r => { if (!r.ok) throw 0; return r.json(); });
  get('index.json').then(ix => Promise.all([Promise.all(ix.lessons.map(get)), get(ix.guides), ix.glossary ? get(ix.glossary).catch(() => []) : []]))
    .then(([files, guides, glossary]) => { const byTopic = {}; for (const l of files.flat()) byTopic[l.topic] = l; S.kb = { byTopic, guides, glossary }; GL = buildGloss(glossary); if (!S.run && !S.drill) render(); })
    .catch(() => { S.kb = { byTopic: {}, guides: [], error: true }; if (!S.run && S.tab === 'learn') render(); });
}
function lessonOf(topic){ return S.kb && S.kb.byTopic[topic] || null; }
VIEWS.learn = function(){
  if (!S.kb) return `<section><h1>Learn</h1><p class="muted">Loading the lessons…</p></section>`;
  if (S.kb.error) return `<section><h1>Learn</h1><p class="banner">The lessons could not be loaded. Check your connection and reload the page.</p></section>`;
  if (S.ui.lesson === 'glossary') return glossaryView();
  if (S.ui.lesson) return S.ui.lesson.startsWith('guide:') ? guideView(S.ui.lesson.slice(6)) : lessonView(S.ui.lesson);
  const diagDone = BLOCKS.every(b => blockDone(b.key));
  const row = l => { const m = mastery(l.topic); return `<li data-kb="${esc((l.topic + ' ' + l.summary + ' ' + l.ideas.join(' ') + ' ' + l.traps.join(' ')).toLowerCase())}"><button class="lrow" data-act="lesson" data-arg="${esc(l.topic)}"><span><span class="status st${m.status}"></span><b>${esc(l.topic)}</b></span><span class="fine">${inline(l.summary)}</span></button></li>`; };
  return `<section><h1>Learn</h1><p class="muted" style="max-width:70ch">Theory, methods and traps for every topic of the GMAT Focus, plus how the exam works. Written once and always here: no AI needed. The dot shows your mastery of each topic.</p>
    ${diagDone ? '' : '<p class="banner">Tip: take the diagnostic before studying the lessons, so it measures where you really start.</p>'}
    <div style="max-width:420px"><label class="lab" for="kb-search">Search</label><input id="kb-search" type="text" autocomplete="off" placeholder="e.g. remainder, assumption, median"></div></section>
    <section><h2>English–Italian glossary</h2><ul class="lessons"><li><button class="lrow" data-act="lesson" data-arg="glossary"><span><b>${(S.kb.glossary || []).length} GMAT words and phrases</b></span><span class="fine">From “at least” and “remainder” to “assumption” and “only if”, with the Italian and the traps. ${S.ui.gloss === false ? 'Underlining is off.' : 'Tap an underlined word in a question to see it.'}</span></button></li></ul></section>
    <section><h2>How the exam works</h2><ul class="lessons">${S.kb.guides.map(g => `<li data-kb="${esc((g.title + ' ' + g.points.join(' ')).toLowerCase())}"><button class="lrow" data-act="lesson" data-arg="guide:${esc(g.id)}"><span><b>${esc(g.title)}</b></span><span class="fine">${esc(g.points[0])}</span></button></li>`).join('')}</ul></section>
    ${SECTIONS.map(sec => `<section><h2>${sec}</h2><ul class="lessons">${SYLLABUS[sec].map(t => lessonOf(t)).filter(Boolean).map(row).join('')}</ul></section>`).join('')}`;
};
function lessonView(topic){
  const L = lessonOf(topic);
  if (!L){ S.ui.lesson = null; return VIEWS.learn(); }
  const all = SECTIONS.flatMap(sec => SYLLABUS[sec]).filter(t => lessonOf(t)), i = all.indexOf(topic);
  const m = mastery(topic), avail = practicePool().filter(q => q.topic === topic).length + genPool(topic).filter(q => q.topic === topic).length;
  const list = (title, arr, tag) => arr && arr.length ? `<div class="stack" style="gap:6px"><h3>${title}</h3><${tag} class="answer">${arr.map(x => `<li>${inline(x, L.section)}</li>`).join('')}</${tag}></div>` : '';
  return `<section class="stack"><div class="row"><button class="btn small ghost" data-act="lessonback">← All lessons</button></div>
    <p class="eyebrow">${esc(L.section)}</p><h1>${esc(L.topic)}</h1><p class="muted" style="max-width:70ch">${inline(L.summary, L.section)}</p>
    <p class="fine"><span class="status st${m.status}"></span>${STATUS[m.status]}${m.n ? ` · ${pct(m.acc)} right in ${m.n} question${m.n === 1 ? '' : 's'}` : ''}</p></section>
  <section class="card stack" style="max-width:820px">
    ${list('Key ideas', L.ideas, 'ul')}
    ${L.formulas.length ? `<div class="stack" style="gap:6px"><h3>Formulas</h3><ul class="answer mono">${L.formulas.map(x => `<li>${inline(x)}</li>`).join('')}</ul></div>` : ''}
    ${list('Method', L.method, 'ol')}
    ${list('Traps', L.traps, 'ul')}
    ${list('Shortcuts', L.shortcuts, 'ul')}
    ${L.example ? `<div class="panel stack"><p class="eyebrow">Example</p><p>${inline(L.example.q, L.section)}</p><details class="more"><summary>Show the solution</summary><p style="margin-top:8px">${inline(L.example.a, L.section)}</p></details></div>` : ''}
  </section>
  <section class="row">${avail ? `<button class="btn primary" data-act="startsmart" data-arg="learn|${esc(topic)}|${Math.min(5, avail)}">Practice ${esc(topic)}</button>` : `<span class="fine">${BLOCKS.some(b => b.section === L.section && !blockDone(b.key)) ? `Practice on this topic opens when you finish the ${esc(L.section)} diagnostic block.` : 'No practice questions on this topic yet: the daily review adds them.'}</span>`}
    ${i > 0 ? `<button class="btn ghost" data-act="lesson" data-arg="${esc(all[i - 1])}">← ${esc(all[i - 1])}</button>` : ''}${i < all.length - 1 ? `<button class="btn ghost" data-act="lesson" data-arg="${esc(all[i + 1])}">${esc(all[i + 1])} →</button>` : ''}</section>`;
}
const GLOSS_GROUPS = [['quant', 'Quant'], ['di', 'Data Insights'], ['verbal', 'Verbal'], ['exam', 'The exam']];
function glossaryView(){
  const list = (S.kb.glossary || []).slice().sort((a, b) => a.term.localeCompare(b.term));
  return `<section class="stack"><div class="row"><button class="btn small ghost" data-act="lessonback">← All lessons</button></div><p class="eyebrow">Learn</p><h1>English–Italian glossary</h1>
      <p class="muted" style="max-width:72ch">The words and phrases that decide GMAT questions. Many errors come from reading them wrong, not from the maths.</p>
      <label class="checks"><input type="checkbox" id="gl-toggle" ${S.ui.gloss === false ? '' : 'checked'}> Underline these words in practice questions, solutions, lessons and drills; tap one to see the Italian. Never in mocks or while a diagnostic block runs, as on the real exam.</label>
      <div style="max-width:420px"><label class="lab" for="gl-search">Search, in English or Italian</label><input id="gl-search" type="text" autocomplete="off" placeholder="e.g. remainder, almeno, assumption"></div></section>
    ${GLOSS_GROUPS.map(([k, name]) => { const l = list.filter(e => e.area === k); return l.length ? `<section><h2>${name}</h2><div class="box scroll"><table class="tbl gloss"><thead><tr><th>English</th><th>Italiano</th><th>Note</th></tr></thead><tbody>${l.map(e => `<tr data-glrow="${esc((e.term + ' ' + (e.forms || []).join(' ') + ' ' + e.it + ' ' + (e.note || '')).toLowerCase())}"><td lang="en"><b>${esc(e.term)}</b></td><td lang="it">${esc(e.it)}</td><td class="fine" lang="it">${esc(e.note || '')}</td></tr>`).join('')}</tbody></table></div></section>` : ''; }).join('')}`;
}
function guideView(id){
  const g = S.kb.guides.find(x => x.id === id);
  if (!g){ S.ui.lesson = null; return VIEWS.learn(); }
  return `<section class="stack"><div class="row"><button class="btn small ghost" data-act="lessonback">← All lessons</button></div><p class="eyebrow">How the exam works</p><h1>${esc(g.title)}</h1></section>
    <section class="card" style="max-width:820px"><ul class="answer">${g.points.map(x => `<li>${inline(x)}</li>`).join('')}</ul></section>`;
}
window.addEventListener('scroll', hideGloss, { passive: true });
document.addEventListener('keydown', e => { if (e.key === 'Escape') hideGloss(); });
function boot(){
  const h = location.hash.slice(1); if (VIEWS[h]) S.tab = h;
  try { if (localStorage.getItem('gmatlab.gloss') === 'off') S.ui.gloss = false; } catch(e){}
  loadKnowledge();
  GMATStore.onStatus(onSyncStatus);
  render();
  GMATStore.open()
    .then(db => { S.db = db; S.dbStatus = 'ok'; subscribe(); render(); })
    .catch(e => { S.dbStatus = 'absent'; S.dbError = e && e.code; render(); });
}
boot();
})();
