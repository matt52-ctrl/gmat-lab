/* GMAT Lab: views, test engine and analytics. Storage is in store.js, the Claude coach in coach.js. */
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
const GEN_TYPE = { 'Quant':'PS', 'Data Insights':'DS', 'Verbal':'CR' };
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
const S = { db:null, dbStatus:'connecting', sample:null, bank:{}, sessions:{}, errors:{}, mocks:{}, profile:{}, studylog:{}, loaded:new Set(), tab:'today', run:null, ui:{ practice:{ section:'Quant', topic:'', diff:'', count:'10', mode:'learn', unseen:true }, gen:{ section:'Quant', topic:'Percents', diff:'4' }, sort:{}, msrTab:0 }, coach:null };
const COLLECTIONS = ['bank','sessions','errors','mocks','profile','studylog'];
const $ = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
const ESC = { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' };
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ESC[c]);
const clone = o => o == null ? o : JSON.parse(JSON.stringify(o));
function inline(s){ return esc(s).replace(/\^\{([^}]*)\}/g,'<sup>$1</sup>').replace(/_\{([^}]*)\}/g,'<sub>$1</sub>').replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>'); }
function rich(s){ return String(s == null ? '' : s).split(/\n{2,}/).map(p => '<p>' + inline(p).replace(/\n/g,'<br>') + '</p>').join(''); }
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
  S[col] = map;
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
      S[name] = m; S.loaded.add(name); scheduleRender();
    }, err => { S.dbStatus = 'error'; S.dbError = err && err.code; scheduleRender(); });
  }
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
  for (const s of Object.values(S.sessions)) for (const a of (s.attempts || [])) out.push({ ...a, kind: s.kind, timed: !!s.timed, sid: s.id });
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
  const inTest = S.run && ['question','review','edit'].includes(S.run.phase);
  const nav = $('#tabs'); nav.hidden = !!inTest;
  const due = S.dbStatus === 'ok' ? dueErrors().length : 0;
  const tabs = [['today','Today'],['coach','Coach'],['diagnostic','Diagnostic'],['practice','Practice'],['retests','Retests', due],['errors','Error log'],['mastery','Mastery'],['mocks','Mocks'],['profile','Profile'],['settings','Settings']];
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
  if (S.run){ main.innerHTML = runView(); postRender(); return; }
  S.ui.dirty = false;
  main.innerHTML = (VIEWS[S.tab] || VIEWS.today)();
  postRender();
}
function postRender(){ const t = $('#coach-log'); if (t) t.scrollTop = t.scrollHeight; }
let rq = false;
function scheduleRender(){
  if (rq) return; rq = true;
  setTimeout(() => { rq = false; renderChrome(); if (S.run || S.ui.dirty) return; $('#main').innerHTML = (VIEWS[S.tab] || VIEWS.today)(); }, 40);
}

/* ------------------------------------------------------------------ question rendering */
function qBody(q, ans, opt){
  opt = opt || {};
  const ctx = contextHTML(q);
  const main = `<div class="stem">${rich(q.stem)}</div>${statementsHTML(q)}${answerHTML(q, ans, opt)}`;
  if (q.passage || q.tabs) return `<div class="qgrid split"><div>${ctx}</div><div class="qgrid">${main}</div></div>`;
  return `<div class="qgrid">${ctx}${main}</div>`;
}
function contextHTML(q){
  if (q.passage) return `<article class="passage"><p class="eyebrow">${esc(q.passage.title || 'Passage')}</p>${rich(q.passage.text)}</article>`;
  if (q.tabs){ const t = Math.min(S.ui.msrTab || 0, q.tabs.length-1); return `<div class="msr"><div class="msr-tabs" role="tablist">${q.tabs.map((tb,i) => `<button role="tab" aria-selected="${i===t}" data-act="msrtab" data-t="${i}">${esc(tb.title)}</button>`).join('')}</div><div class="msr-body" role="tabpanel" id="msr-body">${rich(q.tabs[t].body)}</div></div>`; }
  if (q.table) return tableHTML(q);
  if (q.chart) return chartHTML(q.chart);
  return '';
}
function statementsHTML(q){
  if (q.type !== 'DS' || !q.statements) return '';
  return `<ol class="stmts">${q.statements.map((s,i) => `<li><span class="n">(${i+1})</span>${inline(s)}</li>`).join('')}</ol>`;
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
      return `<div class="stack">${q.parts.map((p,pi) => `<p class="dd">${inline(p.label)} <select data-p="${pi}" ${lock?'disabled':''} aria-label="Part ${pi+1}"><option value="">Select…</option>${p.options.map((o,i) => `<option value="${i}" ${cur[pi]===i?'selected':''}>${esc(o)}</option>`).join('')}</select>${rev ? `<span class="ok">Correct: ${esc(p.options[p.answer])}</span>` : ''}</p>`).join('')}</div>`;
    }
    return `<div class="box scroll"><table class="tbl parts"><thead><tr><th>Yes</th><th>No</th><th>Statement</th></tr></thead><tbody>${q.parts.map((p,pi) => `<tr>${p.options.map((o,i) => `<td><button class="opt ${cls(p,i,pi)}" data-act="pickpart" data-p="${pi}" data-i="${i}" aria-pressed="${cur[pi]===i}" aria-label="${esc(o)}: statement ${pi+1}" ${lock?'disabled':''}>${cur[pi]===i ? '●' : '○'}</button></td>`).join('')}<td class="stmt">${inline(p.label)}</td></tr>`).join('')}</tbody></table></div>`;
  }
  const ch = choicesOf(q);
  return `<div class="choices" role="group" aria-label="Answer choices">${ch.map((c,i) => {
    let cls = '', tag = '';
    if (rev && i === q.answer){ cls = 'is-correct'; tag = 'Correct answer'; }
    else if (rev && user === i){ cls = 'is-wrong'; tag = 'Your first answer'; }
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
  if (q.method) rows.push(['Best method', inline(q.method)]);
  if (q.altMethod) rows.push(['Another route', inline(q.altMethod)]);
  if (q.trap) rows.push(['The trap', inline(q.trap)]);
  if (q.solution) rows.push(['Every option', inline(q.solution)]);
  return `<div class="sol"><dl>${rows.map(([k,v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
    <p class="fine">Expected time ≈ ${fmtTime(expOf(q))} · ${esc(q.topic || '')}${q.subtopic ? ' · ' + esc(q.subtopic) : ''} · level ${q.difficulty || '—'}${q.set === 'generated' ? ' · written by Claude on request, not hand-checked' : ''} · <button class="linkbtn" data-act="report">Report a problem</button></p>
    <div id="report-box" hidden><label class="lab" for="report-note">What looks wrong?</label><textarea id="report-note" rows="2"></textarea><div class="row" style="margin-top:8px"><button class="btn small" data-act="reportsend">Send report</button><button class="btn small ghost" data-act="reportcancel">Cancel</button></div></div></div>`;
}
function coachBox(q, revealed){
  if (!S.sample) return '';
  if (!S.coach || S.coach.qid !== q.id) S.coach = { qid: q.id, turns: [], busy:false };
  const log = S.coach.turns.map(t => `<div class="bubble ${t.role === 'user' ? 'me' : 'ai'}">${esc(t.content)}</div>`).join('');
  return `<details class="coach card" ${S.ui.coachOpen ? 'open' : ''}><summary>Ask the coach about this question</summary>
    <div class="coach-log" id="coach-log">${log}</div>
    <label class="lab" for="coach-in">Your question, in English</label>
    <textarea id="coach-in" rows="2" placeholder="${revealed ? 'e.g. Is there a faster way than the method shown?' : 'e.g. I think the answer depends on the base. Am I on the right track?'}"></textarea>
    <div class="row" style="margin-top:8px"><button class="btn" id="coach-send" data-act="coachsend" data-rev="${revealed ? 1 : 0}">Ask</button><button class="btn ghost" id="coach-stop" data-act="coachstop" hidden>Stop</button></div>
    <p class="fine" style="margin-top:6px">Uses your Anthropic API key (Settings). ${revealed ? 'The solution is open, so the coach can explain it fully.' : 'The coach answers with questions and will not reveal the answer before you do.'}</p></details>`;
}

/* ------------------------------------------------------------------ run engine */
let ticker = null;
function startTicker(){ stopTicker(); ticker = setInterval(tick, 500); }
function stopTicker(){ if (ticker){ clearInterval(ticker); ticker = null; } }
function clockText(){
  const r = S.run; if (!r) return '';
  if (S.ui.clockHidden) return 'Show time';
  if (r.endsAt) return fmtTime((r.endsAt - Date.now())/1000);
  return fmtTime((Date.now() - r.qStart)/1000);
}
function tick(){
  const r = S.run; if (!r){ stopTicker(); return; }
  const el = $('#clock'); if (el){ el.textContent = clockText(); el.classList.toggle('low', !!r.endsAt && r.endsAt - Date.now() < 5*60000); }
  if (r.endsAt && Date.now() >= r.endsAt && ['question','review','edit'].includes(r.phase)) finishRun(true);
}
function startRun(o){
  const id = uid('s'); const now = Date.now();
  S.run = { id, kind:o.kind, block:o.block || null, mode:o.mode, label:o.label, qids:o.qids, timed:!!o.timed, limitSec:o.limitSec || null,
    idx:0, answers:{}, attempts:[], started:now, endsAt: o.timed ? now + o.limitSec*1000 : null, qStart:now,
    phase: o.mode === 'test' ? 'question' : 'learn', sub:'answer', editsUsed:0, reviewedQids:[] };
  S.ui.msrTab = 0; S.coach = null;
  write('sessions/' + id, 'set', { kind:o.kind, block:o.block || null, mode:o.mode, label:o.label, timed:!!o.timed, limitSec:o.limitSec || null, start:new Date(now).toISOString(), status:'active', attempts:[], qids:o.qids });
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
  const conf = r.answers[t.q.id] && r.answers[t.q.id].confidence != null;
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
function saveDraft(){ const r = S.run; write('sessions/' + r.id, 'update', { draft: clone(r.answers), lastIdx: r.idx }); }
function mkAttempt(q, a, extra){
  const done = isComplete(q, a.answer);
  return Object.assign({ qid:q.id, answer: done ? clone(a.answer) : null, correct: done && isCorrect(q, a.answer), timeSec: Math.round(a.timeSec || 0),
    confidence: a.confidence == null ? null : a.confidence, unanswered: !done, section:q.section, topic:q.topic, type:q.type,
    difficulty:q.difficulty || null, expectedSec: expOf(q), at:new Date().toISOString() }, extra || {});
}
function finishRun(timeUp){
  const r = S.run; if (!r) return;
  if (['question','edit'].includes(r.phase)) stampTime();
  stopTicker();
  r.attempts = r.qids.map(qid => { const q = S.bank[qid]; const a = r.answers[qid] || {};
    return mkAttempt(q, a, { reviewSec: Math.round(a.reviewSec || 0), bookmarked: !!a.bookmarked, edited: !!a.edited, changedFrom: a.changedFrom == null ? null : clone(a.changedFrom) }); });
  const dur = Math.round((Date.now() - r.started)/1000);
  r.durationSec = r.limitSec ? Math.min(dur, r.limitSec) : dur;
  r.phase = 'results'; r.timeUp = !!timeUp;
  write('sessions/' + r.id, 'update', { attempts:r.attempts, end:new Date().toISOString(), durationSec:r.durationSec, status:'done', timeUp:!!timeUp, editsUsed:r.editsUsed, draft:null, reviewed:false, reviewedQids:[] });
  if (timeUp) toast('Time is up. Unanswered questions count as wrong, as on the real exam.');
  render(); window.scrollTo(0,0);
}
function endRun(goTab){
  const r = S.run; stopTicker();
  if (r && r.mode === 'learn' && !r.closed) write('sessions/' + r.id, 'update', { status:'done', end:new Date().toISOString(), durationSec: Math.round((Date.now() - r.started)/1000) });
  S.run = null; S.coach = null;
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
  if (d.i < d.list.length - 1){ Object.assign(d, { i:d.i+1, retry:null, hints:0, tries:0, solved:false, revealed:false, etype:null, msg:null }); S.coach = null; S.ui.msrTab = 0; render(); window.scrollTo(0,0); return; }
  if (r.mode === 'learn'){ r.phase = 'learn'; r.debrief = null; learnAdvance(); return; }
  write('sessions/' + r.id, 'update', { reviewed:true });
  const n = d.list.length, back = r.kind === 'diagnostic' ? 'diagnostic' : 'today';
  endRun(back); toast(`Review saved: ${n} question${n > 1 ? 's' : ''} reviewed.`);
}
function learnAdvance(){
  const r = S.run;
  if (r.idx < r.qids.length - 1){ r.idx++; r.sub = 'answer'; r.qStart = Date.now(); S.ui.msrTab = 0; S.coach = null; render(); window.scrollTo(0,0); return; }
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
function testBar(extra){
  const r = S.run;
  return `<div class="testbar"><div class="tb-left"><strong>${esc(r.label)}</strong>${extra ? `<span class="muted">${extra}</span>` : ''}</div><div class="tb-right">${r.phase === 'question' ? (() => { const a = r.answers[r.qids[r.idx]] || {}; return `<button class="flag" data-act="bookmark" aria-pressed="${!!a.bookmarked}">${a.bookmarked ? 'Bookmarked' : 'Bookmark'}</button>`; })() : ''}<button class="clock" id="clock" data-act="toggleclock" aria-label="Timer; click to hide or show">${clockText()}</button></div></div>`;
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
  }
  return '';
}
function questionView(){
  const r = S.run, q = curQ(), a = r.answers[q.id] || {};
  const last = r.idx === r.qids.length - 1;
  const ready = isComplete(q, a.answer) && a.confidence != null;
  return `${testBar(`Question ${r.idx+1} of ${r.qids.length}`)}
    ${qBody(q, a.answer, {})}
    ${q.section === 'Data Insights' ? calcWidget() : ''}
    <div class="qfoot">${confPicker(a.confidence)}<div class="row"><button class="btn ghost" data-act="endprompt">End section</button><button class="btn primary" id="next-btn" data-act="next" ${ready ? '' : 'disabled'}>${last ? 'Finish section' : 'Next'}</button></div></div>
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
    <p class="muted">This measures where you start. It is not a GMAT score and is not converted to one.</p>
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
  const defaultType = d.etype || ({ guessed:'Guessing', unanswered:'Timing' })[it.reason] || null;
  if (open && !d.etype && defaultType) d.etype = defaultType;
  const classify = (it.reason === 'slow' && !d.logSlow) ? `<div class="row"><button class="btn" data-act="logslow">Log it as a Timing issue</button><button class="btn primary" data-act="skipitem">It was fine, next</button></div>` : `
    <div class="card stack"><h3>Log this ${it.reason === 'guessed' ? 'guess' : it.reason === 'slow' ? 'timing issue' : 'error'}</h3>
      <div class="chips" role="group" aria-label="Error type">${ERROR_TYPES.map(([k,desc]) => `<button class="chip" data-act="etype" data-v="${k}" title="${esc(desc)}" aria-pressed="${d.etype === k}">${k}</button>`).join('')}</div>
      <p class="fine" id="etype-desc">${d.etype ? esc((ERROR_TYPES.find(e => e[0] === d.etype) || [])[1]) : 'Pick the main cause.'}</p>
      <div><label class="lab" for="why">Why I missed it</label><textarea id="why" rows="2" placeholder="e.g. I took 10% of 40 and forgot that the total volume grows too."></textarea></div>
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
    ${open ? solutionHTML(q) : ''}
    ${open ? (it.reason === 'slow' ? `<div class="panel stack"><p class="eyebrow">Solution review</p><ul class="hints"><li>Why did you choose your approach?</li><li>Could you have eliminated answers without calculating?</li><li>Was there an estimate, a smart number or a backsolve that saves time?</li><li>Would you finish it in ${fmtTime(a.expectedSec)} under pressure?</li></ul></div>` : '') + classify : ''}
    ${coachBox(q, open)}
  </section>`;
}
function learnView(){
  const r = S.run, q = curQ(), a = r.answers[q.id] || {};
  const fb = r.sub === 'feedback'; const att = r.attempts[r.attempts.length - 1];
  return `${testBar(`Question ${r.idx+1} of ${r.qids.length}`)}
    ${qBody(q, a.answer, fb ? { locked:true, reveal:true, userAns:a.answer } : {})}
    ${q.section === 'Data Insights' && !fb ? calcWidget() : ''}
    ${fb ? `<p class="msg good">Correct in ${fmtTime(att.timeSec)} (expected about ${fmtTime(att.expectedSec)}).</p>${solutionHTML(q)}<div class="panel stack"><p class="eyebrow">Before you move on</p><ul class="hints"><li>Was your route the fastest reliable one, or just the first one you saw?</li><li>Which answers could you have eliminated without calculating?</li></ul></div>${coachBox(q, true)}<div class="row"><button class="btn primary" data-act="lnext">${r.idx === r.qids.length - 1 ? 'Finish' : 'Next question'}</button><button class="btn ghost" data-act="lend">End practice</button></div>`
      : `<div class="qfoot">${confPicker(a.confidence)}<div class="row"><button class="btn ghost" data-act="lend">End practice</button><button class="btn primary" id="check-btn" data-act="lcheck" ${isComplete(q, a.answer) && a.confidence != null ? '' : 'disabled'}>Check</button></div></div>${coachBox(q, false)}`}`;
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
function plannerCtx(minutes){
  const at = attemptsAll(); const seen = new Set(at.map(a => a.qid));
  const topics = SECTIONS.flatMap(sec => [...new Set([...SYLLABUS[sec], ...at.filter(a => a.section === sec).map(a => a.topic)])].map(t => ({ topic:t, section:sec, ...mastery(t) })));
  const pend = pendingReview(), nb = BLOCKS.find(b => !blockDone(b.key));
  return { today: today(), minutes, interviewDone: !!interview().done, phase: phase(),
    pendingReview: pend ? { id: pend.id, label: pend.label || 'last session', n: Math.max(1, buildDebrief(pend.attempts || [], pend.reviewedQids).length) } : null,
    nextBlock: nb && blockQids(nb.key).length ? { key: nb.key, name: nb.name, section: nb.section, n: blockQids(nb.key).length, minutes: Math.round(blockLimit(nb.key) / 60) } : null,
    diagnosticDone: BLOCKS.every(b => blockDone(b.key)),
    due: dueErrors().map(e => ({ qid: e.qid, topic: e.topic, nextDue: e.nextDue })),
    attempts: at, topics, errors: Object.values(S.errors),
    pool: practicePool().map(q => ({ id: q.id, topic: q.topic, section: q.section, difficulty: q.difficulty || 3, seen: seen.has(q.id) })),
    mocks: Object.values(S.mocks), hoursPerWeek: interview().hoursPerWeek || null, claudePlan: S.profile.coach || null };
}
const CTA = { interview:'Open the interview', review:'Continue the review', diagnostic:'Start', retests:'Start retests', weak:'Start', mixed:'Start' };
function planCard(nx){
  if (nx) return `<div class="card next"><p class="eyebrow">Next step · ${fmtDate(today())}</p><h1>${esc(nx.title)}</h1><p class="muted">${esc(nx.why)}</p></div>`;
  const min = todayMinutes(), p = GMATPlanner.plan(plannerCtx(min)), [first, ...rest] = p.items;
  const btn = (it, cls) => it.act ? `<button class="btn ${cls}" data-act="${it.act}" ${it.arg ? `data-arg="${esc(it.arg)}"` : ''}>${CTA[it.id] || 'Start'}</button>` : '';
  return `<div class="card next">
    <div class="row" style="justify-content:space-between"><p class="eyebrow">Today · ${fmtDate(today())} · plan for ${min} min</p>
      <div class="seg" role="group" aria-label="Time you have today">${MINUTES.map(m => `<button data-act="setmin" data-v="${m}" aria-pressed="${m === min}">${m}′</button>`).join('')}</div></div>
    <h1>${esc(first.title)}</h1><p class="muted">${esc(first.why)}</p>
    ${first.act ? `<div class="row" style="margin-top:16px">${btn(first, 'primary')}${first.minutes ? `<span class="fine mono">~${first.minutes} min</span>` : ''}</div>` : ''}
    ${rest.length ? `<ol class="plan">${rest.map(it => `<li><div><b>${esc(it.title)}</b><span class="fine">${esc(it.why)}</span></div><span class="mono fine">${it.minutes ? '~' + it.minutes + ' min' : ''}</span>${btn(it, 'small')}</li>`).join('')}</ol>` : ''}
    <p class="fine" style="margin-top:12px">Built from your answers, times, confidence and error log. <button class="linkbtn" data-act="tab" data-arg="coach">Ask the coach why</button></p>
  </div>`;
}
function startSmart(mode, n, opts){
  const ids = GMATPlanner.pickSet(plannerCtx(todayMinutes()), n, opts);
  if (!ids.length){ toast('No questions are available for this yet.'); return; }
  const label = `Coach set · ${opts.topic || opts.section || 'mixed'}`;
  if (mode === 'timed'){ const lim = Math.round(ids.reduce((s, id) => s + PACE[S.bank[id].section], 0)); startRun({ kind:'practice', qids: ids, mode:'test', timed:true, limitSec: lim, label: label + ' · timed' }); }
  else startLearn(ids, label, 'practice');
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
    <h2>${esc(a.title)}</h2><ul class="answer">${a.lines.map(l => `<li>${esc(l)}</li>`).join('')}</ul></section>
  <section class="grid2">
    <div class="stack"><h2>Where your practice goes</h2><p class="muted">Coach sets draw topics in proportion to these weights: weak topics come up most, strong ones now and then so they stay sharp.</p>
      ${w.length ? `<div class="box scroll"><table class="tbl"><thead><tr><th>Topic</th><th>Status</th><th>Weight</th><th class="num">Unseen</th></tr></thead><tbody>${w.map(t => `<tr><td>${esc(t.topic)}</td><td><span class="status st${t.status}"></span>${STATUS[t.status]}</td><td><div class="wbar" role="img" aria-label="weight ${t.weight.toFixed(2)}"><span style="width:${Math.round(t.weight / maxW * 100)}%"></span></div></td><td class="num">${t.unseen}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Nothing to weigh yet. Take the diagnostic first.</p>'}</div>
    <div class="stack"><h2>Claude’s weekly review</h2>
      ${cp ? `<div class="card stack"><p class="eyebrow">${cp.weekOf ? 'Week of ' + esc(fmtDate(cp.weekOf)) + ' · ' : ''}written ${esc(fmtDate(String(cp.updatedAt || '').slice(0, 10)))}${fresh ? '' : ' · older than a week'}</p>
        ${cp.summary ? `<div class="stack">${rich(cp.summary)}</div>` : ''}
        ${Array.isArray(cp.focus) && cp.focus.length ? `<div><p class="eyebrow">Focus</p><ul class="answer">${cp.focus.map(f => `<li><b>${esc(f.topic)}</b>${f.why ? ': ' + esc(f.why) : ''}</li>`).join('')}</ul></div>` : ''}
        ${Array.isArray(cp.tasks) && cp.tasks.length ? `<div><p class="eyebrow">This week</p><ul class="answer">${cp.tasks.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>` : ''}
        ${cp.newQuestions ? `<p class="fine">${esc(String(cp.newQuestions))} new questions added to Practice.</p>` : ''}
        ${fresh && Array.isArray(cp.focus) && cp.focus.length ? '<p class="fine">Focus topics get extra weight in your plan and coach sets.</p>' : ''}</div>`
      : `<p class="muted">Every Sunday evening Claude reads your synced progress, writes a review here and adds new questions on your weak topics. It needs GitHub sync on (Settings).</p>`}</div>
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
function practicePool(){ return Object.values(S.bank).filter(q => !q.flagged && (q.set !== 'diagnostic' || blockDone(q.block))); }
VIEWS.practice = function(){
  const P = S.ui.practice; const pool = practicePool();
  const seen = new Set(attemptsAll().map(a => a.qid));
  const inSec = pool.filter(q => !P.section || q.section === P.section);
  const topics = [...new Set(inSec.map(q => q.topic))].sort();
  const match = inSec.filter(q => (!P.topic || q.topic === P.topic) && (!P.diff || String(q.difficulty) === P.diff || (P.diff === '5' && q.difficulty >= 5)) && (!P.unseen || !seen.has(q.id)));
  const gen = S.ui.gen;
  const form = pool.length ? `<div class="card stack"><h2>Build a set</h2>
      <div class="fgrid">
        <div><label class="lab" for="p-sec">Section</label><select id="p-sec" data-ui="practice.section">${['', ...SECTIONS].map(s => `<option value="${s}" ${P.section === s ? 'selected' : ''}>${s || 'All sections'}</option>`).join('')}</select></div>
        <div><label class="lab" for="p-top">Topic</label><select id="p-top" data-ui="practice.topic"><option value="">All topics</option>${topics.map(t => `<option ${P.topic === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></div>
        <div><label class="lab" for="p-diff">Level</label><select id="p-diff" data-ui="practice.diff">${[['','Any'],['2','2 · easy'],['3','3 · standard'],['4','4 · hard'],['5','5–6 · 750+']].map(([v,l]) => `<option value="${v}" ${P.diff === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <div><label class="lab" for="p-count">Questions</label><select id="p-count" data-ui="practice.count">${['5','10','15','20'].map(v => `<option ${P.count === v ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
        <div><label class="lab" for="p-mode">Mode</label><select id="p-mode" data-ui="practice.mode"><option value="learn" ${P.mode === 'learn' ? 'selected' : ''}>Learn: feedback after each question</option><option value="timed" ${P.mode === 'timed' ? 'selected' : ''}>Timed: real pace, review at the end</option></select></div>
      </div>
      <label class="checks"><input type="checkbox" id="p-unseen" data-ui="practice.unseen" ${P.unseen ? 'checked' : ''}> Only questions I have not seen</label>
      <div class="row"><button class="btn primary" data-act="startpractice" ${match.length ? '' : 'disabled'}>Start ${Math.min(match.length, +P.count)} question${Math.min(match.length, +P.count) === 1 ? '' : 's'}</button><button class="btn" data-act="startsmartform" ${inSec.length ? '' : 'disabled'}>Let the coach pick</button><span class="fine">${match.length} match these filters. The coach picks within the section and topic, weighted toward your weak spots.</span></div></div>`
    : `<div class="card stack"><h2>Your training sets are not here yet</h2><p class="muted">Practice opens section by section once you finish that section’s diagnostic block. After the diagnostic, Claude adds sets aimed at your weakest topics.</p><div class="row"><button class="btn primary" data-act="tab" data-arg="diagnostic">Go to the diagnostic</button></div></div>`;
  const anyDone = BLOCKS.some(b => blockDone(b.key));
  const genCard = S.sample && anyDone ? `<div class="card stack"><h2>Generate a fresh question</h2><p class="muted">Claude writes a new question on the topic and level you choose and checks its own answer key. It has not been checked by hand, so report anything that looks wrong.</p>
      <div class="fgrid">
        <div><label class="lab" for="g-sec">Section</label><select id="g-sec" data-ui="gen.section">${SECTIONS.map(s => `<option ${gen.section === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
        <div><label class="lab" for="g-top">Topic</label><select id="g-top" data-ui="gen.topic">${genTopics(gen.section).map(t => `<option ${gen.topic === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></div>
        <div><label class="lab" for="g-diff">Level</label><select id="g-diff" data-ui="gen.diff">${[['3','3 · standard'],['4','4 · hard'],['5','5 · 750+']].map(([v,l]) => `<option value="${v}" ${gen.diff === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      </div>
      <div class="row"><button class="btn" id="gen-btn" data-act="gen">Generate and start</button><span class="fine" id="gen-status"></span></div></div>` : '';
  return `<section><h1>Practice</h1><p class="muted" style="max-width:70ch">Every set logs time, confidence and errors, like the diagnostic. In Learn mode a miss goes straight to review: retry, hints one at a time, then the solution.</p></section>
    <section class="grid2">${form}${genCard}</section>`;
};
function genTopics(section){
  if (section === 'Data Insights') return ['Integers & divisibility','Percents','Ratios & proportions','Statistics','Linear equations','Inequalities & absolute value','Rates & work','Word problems'];
  if (section === 'Verbal') return SYLLABUS['Verbal'].filter(t => t.startsWith('CR'));
  return SYLLABUS['Quant'];
}
VIEWS.retests = function(){
  const due = dueErrors(); const t = today();
  const upcoming = Object.values(S.errors).filter(e => e.status === 'active' && e.nextDue && e.nextDue > t).sort((a,b) => String(a.nextDue).localeCompare(String(b.nextDue)));
  const retired = Object.values(S.errors).filter(e => e.status === 'retired').length;
  const row = e => `<tr><td>${esc(e.topic)}</td><td>${esc(e.errorType || '—')}</td><td class="num">${e.count || 1}</td><td class="num">${e.box || 0}/${INTERVALS.length}</td><td class="num">${fmtDate(e.nextDue)}</td></tr>`;
  const head = '<thead><tr><th>Topic</th><th>Last error type</th><th class="num">Misses</th><th class="num">Step</th><th class="num">Due</th></tr></thead>';
  return `<section><h1>Retests</h1><p class="muted" style="max-width:70ch">Every logged error comes back after 1 day, then 3, 7, 21 and 45 days while you keep getting it right. One miss sends it back to the start. After the fifth correct retest it is retired.</p>
    <div class="row"><button class="btn primary" data-act="startRetests" ${due.length ? '' : 'disabled'}>Start ${due.length} due retest${due.length === 1 ? '' : 's'}</button><span class="fine">${retired} retired so far.</span></div></section>
    ${due.length ? `<section><h2>Due now</h2><div class="box scroll"><table class="tbl">${head}<tbody>${due.map(row).join('')}</tbody></table></div></section>` : ''}
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
      ${rows.map(({t,m}) => `<tr><td>${esc(t)}</td><td><span class="status st${m.status}"></span>${STATUS[m.status]}</td><td class="num">${m.n || '—'}</td><td class="num">${pct(m.acc)}</td><td class="num">${pct(m.tacc)}</td><td class="num">${m.ratio ? m.ratio.toFixed(2) + '×' : '—'}</td><td class="num">${m.last ? fmtDate(m.last) : '—'}</td></tr>`).join('')}
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
VIEWS.mocks = function(){
  const list = Object.values(S.mocks).sort((a,b) => String(a.date).localeCompare(String(b.date)));
  const tg = target();
  return `<section><h1>Mocks</h1><p class="muted" style="max-width:70ch">Log every full practice exam here. Official Practice Exams use the real scoring algorithm, and there are only a few, so keep them for when the numbers matter. After each mock, tell Claude “analizza il mock” for the full post-mock report.</p></section>
    ${list.length ? `<section class="card">${mockChart(list, tg)}</section>` : ''}
    <section class="grid2">
      <form class="card stack" data-form="mock" data-dirty><h2>Add a mock result</h2>
        <div class="fgrid"><div><label class="lab" for="m-date">Date</label><input id="m-date" type="date" value="${today()}" required></div>
        <div><label class="lab" for="m-name">Exam</label><select id="m-name">${['Official Practice Exam 1','Official Practice Exam 2','Official Practice Exam 3','Official Practice Exam 4','Official Practice Exam 5','Official Practice Exam 6','Other official material','Third-party mock'].map(x => `<option>${x}</option>`).join('')}</select></div></div>
        <div class="fgrid"><div><label class="lab" for="m-total">Total (205–805)</label><input id="m-total" type="number" min="205" max="805" step="10" required></div>
        <div><label class="lab" for="m-q">Quant (60–90)</label><input id="m-q" type="number" min="60" max="90"></div>
        <div><label class="lab" for="m-v">Verbal (60–90)</label><input id="m-v" type="number" min="60" max="90"></div>
        <div><label class="lab" for="m-di">Data Insights (60–90)</label><input id="m-di" type="number" min="60" max="90"></div></div>
        <div><label class="lab" for="m-notes">Notes</label><textarea id="m-notes" rows="2" placeholder="Section order, break, how the timing felt, what went wrong"></textarea></div>
        <div class="row"><button class="btn primary" type="submit">Save result</button></div></form>
      <div class="stack"><h2>Score history</h2>${list.length ? `<div class="box scroll"><table class="tbl"><thead><tr><th>Date</th><th>Mock</th><th class="num">Total</th><th class="num">Q</th><th class="num">V</th><th class="num">DI</th><th>Notes</th><th></th></tr></thead><tbody>${[...list].reverse().map(m => `<tr><td>${fmtDate(m.date)}</td><td>${esc(m.name)}</td><td class="num"><strong>${m.total}</strong></td><td class="num">${m.quant || '—'}</td><td class="num">${m.verbal || '—'}</td><td class="num">${m.di || '—'}</td><td>${esc(m.notes || '')}</td><td>${S.ui.delMock === m.id ? `<button class="btn small danger" data-act="mockdelok" data-arg="${esc(m.id)}">Delete</button> <button class="btn small ghost" data-act="mockdelno">Keep</button>` : `<button class="linkbtn" data-act="mockdel" data-arg="${esc(m.id)}">Remove</button>`}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">No mocks yet. The first official mock usually comes after the foundations phase.</p>'}</div>
    </section>`;
};
function mockChart(list, tg){
  const W = 680, H = 240, L = 46, R = 20, T = 18, B = 30, lo = 505, hi = 805;
  const y = v => T + (hi - Math.max(lo, Math.min(hi, v))) / (hi - lo) * (H - T - B);
  const x = i => list.length === 1 ? L + (W - L - R)/2 : L + i * (W - L - R) / (list.length - 1);
  let g = '';
  for (let v = lo; v <= hi; v += 50){ g += `<line class="grid" x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L-8}" y="${y(v)+4}" text-anchor="end">${v}</text>`; }
  if (tg) g += `<line class="target" x1="${L}" x2="${W-R}" y1="${y(tg.score)}" y2="${y(tg.score)}"/><text class="tlabel" x="${W-R}" y="${y(tg.score)-6}" text-anchor="end">target ${tg.score}</text>`;
  if (list.length > 1) g += `<polyline class="line" points="${list.map((m,i) => `${x(i)},${y(m.total)}`).join(' ')}"/>`;
  list.forEach((m,i) => { g += `<circle class="dot" cx="${x(i)}" cy="${y(m.total)}" r="${i === list.length-1 ? 5 : 3.5}"/><text class="val" x="${x(i)}" y="${y(m.total)-10}" text-anchor="middle">${m.total}</text><text x="${x(i)}" y="${H-10}" text-anchor="middle">${fmtDate(m.date)}</text>`; });
  return `<figure class="chart" style="margin:0"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Mock total scores over time">${g}</svg></figure>`;
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
  const sc = GMATStore.sync.config(), st = GMATStore.sync.status(), key = GMATStore.claude.key();
  const pill = { off:['', 'Off'], ok:['good', 'Synced'], error:['bad', 'Error'], syncing:['acc', 'Syncing…'], pending:['acc', 'Changes waiting'] }[st.status] || ['', st.status];
  return `<section><h1>Settings</h1><p class="muted" style="max-width:70ch">Where your progress is saved, and the optional Claude coach.</p></section>
  <section class="grid2">
    <div class="card stack"><h2>Your data</h2>
      <p class="muted">Progress is saved in this browser${sc.on ? ' and synced to GitHub' : ''}. ${sc.on ? 'Every device with sync on shares it.' : 'Other browsers and devices do not see it unless you turn on GitHub sync.'}</p>
      ${sum ? `<ul class="facts"><li><b>Questions</b><span class="mono">${sum.questions} in the bank${sum.generated ? ` · ${sum.generated} generated or reported` : ''}</span></li><li><b>Progress</b><span class="mono">${sum.sessions} sessions · ${sum.errors} logged errors · ${sum.mocks} mocks</span></li><li><b>Size</b><span class="mono">${Math.max(1, Math.round(sum.bytes/1024))} KB of about 5,000 KB</span></li></ul>` : ''}
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
    <form class="card stack" data-form="claudekey" data-dirty><h2>Claude coach</h2>
      <p class="muted">“Ask the coach” under each question and “Generate a fresh question” in Practice call Claude with your own Anthropic API key. Anthropic bills its use to that key, separately from any Claude subscription.</p>
      <div><label class="lab" for="ck-key">Anthropic API key</label><input id="ck-key" type="password" autocomplete="off" spellcheck="false" placeholder="${key ? 'Saved. Paste a new key to replace it.' : 'sk-ant-…'}"><p class="hint">Create one at console.anthropic.com → API keys.</p></div>
      <div class="row"><button class="btn primary" type="submit">Save key</button>${key ? '<button class="btn ghost" type="button" data-act="claudekeydel">Remove key</button>' : ''}<span class="fine">${key ? 'Coach on.' : 'Coach off.'}</span></div>
      <p class="fine">The key stays in this browser and is sent only to api.anthropic.com.</p>
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

/* ------------------------------------------------------------------ coach + generator */
function coachData(q, revealed){
  const d = { section:q.section, type:q.type, topic:q.topic, stem:q.stem };
  if (q.type === 'DS'){ d.statements = q.statements; d.choices = DS_CHOICES; } else if (q.choices) d.choices = q.choices.map((c,i) => LETTERS[i] + ') ' + c);
  if (q.parts) d.parts = q.parts.map(p => ({ label:p.label, options:p.options }));
  if (q.passage) d.passage = String(q.passage.text).slice(0, 3000);
  if (q.tabs) d.sources = q.tabs;
  if (q.table) d.table = q.table;
  if (q.chart) d.chart = q.chart;
  const r = S.run; const it = r && r.debrief && r.debrief.list[r.debrief.i];
  const a = it ? it.a : (r && r.answers[q.id]);
  if (a && a.answer != null) d.studentAnswer = answerText(q, a.answer);
  if (revealed){ d.correctAnswer = correctText(q); d.method = q.method; d.altMethod = q.altMethod; d.trap = q.trap; d.solution = q.solution; }
  return JSON.stringify(d);
}
function coachRules(revealed){
  return `You are a GMAT coach for a university economics student aiming for a very high GMAT score. The student writes in English to practise; it is not their first language.
Rules:
1. Reply in English, in under 150 words, plain text only (no headings, no markdown tables).
2. Be Socratic: guide with one or two questions or one short explanation of the concept the student is missing. ${revealed ? 'The solution is already open, so you may explain it fully, including why the other options fail and whether a faster route exists.' : 'Do NOT reveal the correct answer, the correct letter or value, or the full solution. If the student asks for it, point to the hint button or "Show full solution".'}
3. If the student states something wrong, say so plainly and explain why.
4. If the student's last message contains English mistakes, end with a line starting "✏️ English:" and list up to 3 corrections as: what they wrote → correct version (short reason). If there are none, leave that line out.`;
}
function sampleErrText(e){
  const c = e && e.code;
  if (c === 'bad_key') return 'Your Anthropic API key was rejected. Check it in Settings.';
  if (c === 'bad_model') return 'This API key cannot use the coach’s model. Check your Anthropic account.';
  if (c === 'rate_limited') return 'Too many requests right now. Try again in a little while.';
  if (c === 'overloaded') return 'Claude is overloaded right now. Try again in a minute.';
  if (c === 'network' || c === 'load_failed') return 'Could not reach Claude. Check your connection and try again.';
  if (c === 'refused') return 'Claude declined that request. Rephrase it and try again.';
  if (c === 'invalid_json') return 'The question came back in a broken format. Try again.';
  if (c === 'cancelled') return 'Stopped.';
  return 'Something went wrong while asking Claude. Try again.';
}
let coachCtl = null;
async function coachSend(rev){
  const ta = $('#coach-in'); const msg = (ta && ta.value || '').trim(); if (!msg || !S.sample || S.coach.busy) return;
  const q = curTarget().q; const revealed = !!rev;
  S.coach.turns.push({ role:'user', content: msg }); ta.value = '';
  const log = $('#coach-log');
  log.insertAdjacentHTML('beforeend', `<div class="bubble me">${esc(msg)}</div><div class="bubble ai" id="coach-live">Thinking…</div>`);
  log.scrollTop = log.scrollHeight;
  const live = $('#coach-live'); live.removeAttribute('id');
  S.coach.busy = true; $('#coach-send').disabled = true; $('#coach-stop').hidden = false;
  coachCtl = new AbortController();
  const turns = S.coach.turns.slice(-10);
  const system = coachRules(revealed) + '\n\nQuestion data (JSON):\n' + coachData(q, revealed);
  try {
    const { text } = await S.sample(turns, { system, signal: coachCtl.signal, onText: ({ text }) => { live.textContent = text; log.scrollTop = log.scrollHeight; } });
    S.coach.turns.push({ role:'assistant', content: text }); live.textContent = text;
  } catch (e){
    live.textContent = (e && e.text ? e.text + '\n\n' : '') + sampleErrText(e);
    S.coach.turns.pop();
  } finally {
    S.coach.busy = false; const sb = $('#coach-send'); if (sb) sb.disabled = false; const st = $('#coach-stop'); if (st) st.hidden = true;
  }
}
function genPrompt(g){
  const type = GEN_TYPE[g.section];
  const kind = { PS:'Problem Solving: arithmetic or algebra only (no geometry), solvable without a calculator in about 2 minutes by the best method; five answer choices with exactly one correct; wrong choices built from real student mistakes.',
    DS:'Data Sufficiency: a question and two statements. The answer index refers to the five standard choices: 0 = statement (1) alone sufficient, 1 = statement (2) alone sufficient, 2 = both together needed, 3 = each alone sufficient, 4 = not sufficient together.',
    CR:'Critical Reasoning: an argument of under 100 words and a question stem, five answer choices, exactly one defensible; wrong choices use the typical traps (out of scope, reversed, too strong, irrelevant comparison).' }[type];
  return `Write ONE original practice question in the style of the current GMAT exam. Do not copy or paraphrase any published or official question.
Section: ${g.section}. Type: ${type}. ${kind}
Topic: ${g.topic}. Difficulty: ${g.diff} on a 1–6 scale (3 = standard GMAT, 4 = hard, 5 = very hard, aimed at the 99th percentile).
Before replying, solve the question yourself twice using two different methods and make sure the answer key is correct and unique. Do this checking silently.
Write in plain text. Write exponents as x^{2}. In a CR boldface question, mark the bold parts with **double asterisks**.
Reply with only one JSON object with exactly these keys:
{"type":"${type}","topic":"${g.topic}","subtopic":"short name","skill":"the skill trained","difficulty":${g.diff},"stem":"…",${type === 'DS' ? '"statements":["statement 1 without numbering","statement 2 without numbering"],' : '"choices":["…","…","…","…","…"],'}"answer":0,"trap":"the trap in one sentence","expectedSec":120,"method":"the fastest reliable method, step by step","altMethod":"a second route","hints":["a small nudge phrased as a question","the direction","the key concept","the first step only"],"solution":"why the answer is right and why each other choice is wrong"}`;
}
function genSchema(type){
  const str = { type:'string' }, list = { type:'array', items:{ type:'string' } };
  const props = { type:str, topic:str, subtopic:str, skill:str, difficulty:{ type:'integer' }, stem:str, answer:{ type:'integer', enum:[0,1,2,3,4] }, trap:str, expectedSec:{ type:'integer' }, method:str, altMethod:str, hints:list, solution:str };
  if (type === 'DS') props.statements = list; else props.choices = list;
  return { type:'object', properties: props, required: Object.keys(props), additionalProperties: false };
}
function validateGen(o, g){
  const type = GEN_TYPE[g.section];
  if (!o || typeof o !== 'object' || typeof o.stem !== 'string' || !o.stem.trim()) throw { code:'invalid_json' };
  const ans = Number(o.answer); if (!Number.isInteger(ans) || ans < 0 || ans > 4) throw { code:'invalid_json' };
  const hints = Array.isArray(o.hints) ? o.hints.map(String).slice(0,4) : [];
  if (hints.length < 4) throw { code:'invalid_json' };
  const q = { set:'generated', section:g.section, block: g.section === 'Quant' ? 'Q' : g.section === 'Verbal' ? 'V' : 'DI', type, topic: type === 'DS' ? 'Data Sufficiency' : g.topic,
    subtopic: String(o.subtopic || (type === 'DS' ? g.topic : '')), skill: String(o.skill || ''), difficulty: Number(g.diff), stem: String(o.stem), answer: ans,
    trap: String(o.trap || ''), expectedSec: Math.max(45, Math.min(240, Number(o.expectedSec) || 120)), method: String(o.method || ''), altMethod: String(o.altMethod || ''),
    hints, solution: String(o.solution || ''), createdAt: new Date().toISOString() };
  if (type === 'DS'){ if (!Array.isArray(o.statements) || o.statements.length !== 2) throw { code:'invalid_json' }; q.statements = o.statements.map(s => String(s).replace(/^\s*\(\d\)\s*/, '')); }
  else { if (!Array.isArray(o.choices) || o.choices.length !== 5) throw { code:'invalid_json' }; q.choices = o.choices.map(c => String(c).replace(/^\s*[A-E][).]\s+/, '')); }
  return q;
}
async function generate(){
  const btn = $('#gen-btn'), st = $('#gen-status'); if (!S.sample || !btn) return;
  btn.disabled = true; st.textContent = 'Claude is writing and checking a question. This can take up to a minute…';
  try {
    const out = await S.sample.json(genPrompt(S.ui.gen), { schema: genSchema(GEN_TYPE[S.ui.gen.section]) });
    const q = validateGen(out, S.ui.gen); const id = uid('gen');
    const ok = await write('bank/' + id, 'set', q);
    if (!ok) throw { code:'save' };
    startLearn([id], `Generated · ${q.topic}`, 'practice');
  } catch (e){
    const b = $('#gen-btn'); if (b) b.disabled = false;
    const s = $('#gen-status'); if (s) s.textContent = e && e.code === 'save' ? 'The question could not be saved.' : sampleErrText(e);
  }
}

/* ------------------------------------------------------------------ actions */
const ACTIONS = {
  tab(el){ const t = el.dataset.arg; if (S.run){ const inTest = ['question','review','edit'].includes(S.run.phase); if (inTest) return; endRun(t); return; } S.tab = t; try { history.replaceState(null, '', '#' + t); } catch(e){} render(); window.scrollTo(0,0); },
  startBlock(el){ startBlock(el.dataset.arg); },
  restartBlock(el){ for (const s of diagSessions(el.dataset.arg).filter(s => s.status === 'active')) write('sessions/' + s.id, 'update', { status:'abandoned' }); startBlock(el.dataset.arg); },
  openResults(el){ openResults(el.dataset.arg); },
  startRetests(el){ const k = +(el && el.dataset.arg || 0); let qids = dueErrors().map(e => e.qid); if (k > 0) qids = qids.slice(0, k); if (qids.length) startLearn(qids, 'Retests', 'retest'); },
  pick(el){ const t = curTarget(); if (!t) return; const i = +el.dataset.i; t.set(i); $$('[data-act="pick"]', el.closest('.choices')).forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.i === i))); syncReady(); },
  pickpart(el){ const t = curTarget(); if (!t) return; const p = +el.dataset.p, i = +el.dataset.i; const v = Array.isArray(t.get()) ? [...t.get()] : t.q.parts.map(() => null); v[p] = i; t.set(v); $$(`[data-act="pickpart"][data-p="${p}"]`).forEach(b => { const on = +b.dataset.i === i; b.setAttribute('aria-pressed', String(on)); b.textContent = on ? '●' : '○'; }); syncReady(); },
  conf(el){ const q = curTarget().q; const r = S.run; r.answers[q.id] = r.answers[q.id] || {}; r.answers[q.id].confidence = +el.dataset.v; $$('button', el.parentElement).forEach(b => b.setAttribute('aria-pressed', String(b === el))); syncReady(); },
  bookmark(el){ const r = S.run; const q = curQ(); const a = r.answers[q.id] = r.answers[q.id] || {}; a.bookmarked = !a.bookmarked; el.setAttribute('aria-pressed', String(a.bookmarked)); el.textContent = a.bookmarked ? 'Bookmarked' : 'Bookmark'; },
  toggleclock(){ S.ui.clockHidden = !S.ui.clockHidden; tick(); },
  next(){ const r = S.run; stampTime(); saveDraft(); if (r.idx < r.qids.length - 1){ r.idx++; r.qStart = Date.now(); S.ui.msrTab = 0; render(); window.scrollTo(0,0); } else { r.phase = 'review'; render(); window.scrollTo(0,0); } },
  endprompt(){ $('#endconfirm').hidden = false; },
  endcancel(){ $('#endconfirm').hidden = true; },
  endnow(){ finishRun(false); },
  openedit(el){ const r = S.run; r.editIdx = +el.dataset.i; r.editDraft = clone((r.answers[r.qids[r.editIdx]] || {}).answer); r.phase = 'edit'; r.qStart = Date.now(); S.ui.msrTab = 0; render(); window.scrollTo(0,0); },
  backreview(){ const r = S.run; stampTime(); r.phase = 'review'; render(); },
  savechange(){ const r = S.run; const q = curQ(); const a = r.answers[q.id] = r.answers[q.id] || {};
    if (JSON.stringify(a.answer) !== JSON.stringify(r.editDraft) && r.editsUsed < 3){ if (!a.edited) a.changedFrom = clone(a.answer); a.answer = clone(r.editDraft); a.edited = true; r.editsUsed++; toast(`Answer changed. ${3 - r.editsUsed} change${3 - r.editsUsed === 1 ? '' : 's'} left.`); }
    stampTime(); r.phase = 'review'; saveDraft(); render(); },
  reviewstart(){ const r = S.run; const list = buildDebrief(r.attempts, r.reviewedQids); if (!list.length) return; r.debrief = newDebrief(list); r.phase = 'debrief'; S.ui.msrTab = 0; render(); window.scrollTo(0,0); },
  closeresults(){ const r = S.run; if (!buildDebrief(r.attempts, r.reviewedQids).length) write('sessions/' + r.id, 'update', { reviewed:true }); endRun(r.kind === 'diagnostic' ? 'diagnostic' : 'today'); },
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
    const why = ($('#why') || {}).value || '', rule = ($('#rule') || {}).value || '';
    saveError(q, it, d.etype, why.trim(), rule.trim()); d.logSlow = false; debriefAdvance(); },
  skipitem(){ S.run.debrief.logSlow = false; debriefAdvance(); },
  lcheck(){ learnCheck(); },
  lnext(){ learnAdvance(); },
  lend(){ const r = S.run; if (r.phase === 'learn' && r.sub === 'answer'){ r.phase = 'done'; r.closed = true; stopTicker(); write('sessions/' + r.id, 'update', { status:'done', end:new Date().toISOString(), durationSec: Math.round((Date.now() - r.started)/1000) }); render(); } else learnAdvanceEnd(); },
  closedone(){ endRun('today'); },
  msrtab(el){ const q = curTarget().q; const t = +el.dataset.t; S.ui.msrTab = t; $$('[data-act="msrtab"]').forEach(b => b.setAttribute('aria-selected', String(+b.dataset.t === t))); const body = $('#msr-body'); if (body) body.innerHTML = rich(q.tabs[t].body); },
  sort(el){ const id = el.dataset.q, c = +el.dataset.c; const st = S.ui.sort[id] || { c:null, dir:1 }; S.ui.sort[id] = st.c === c ? { c, dir: -st.dir } : { c, dir: 1 }; const box = $(`.ta[data-q="${id}"]`); if (box) box.outerHTML = tableHTML(S.bank[id]); },
  coachsend(el){ coachSend(el.dataset.rev === '1'); },
  coachstop(){ if (coachCtl) coachCtl.abort(); },
  startpractice(){ const P = S.ui.practice; const seen = new Set(attemptsAll().map(a => a.qid));
    let pool = practicePool().filter(q => (!P.section || q.section === P.section) && (!P.topic || q.topic === P.topic) && (!P.diff || String(q.difficulty) === P.diff || (P.diff === '5' && q.difficulty >= 5)) && (!P.unseen || !seen.has(q.id)));
    pool = pool.sort(() => Math.random() - 0.5).slice(0, +P.count); if (!pool.length) return;
    const label = `Practice · ${P.topic || P.section || 'mixed'}`;
    if (P.mode === 'timed'){ const lim = Math.round(pool.reduce((s,q) => s + PACE[q.section], 0)); startRun({ kind:'practice', qids: pool.map(q => q.id), mode:'test', timed:true, limitSec: lim, label: label + ' · timed' }); }
    else startLearn(pool.map(q => q.id), label, 'practice'); },
  gen(){ generate(); },
  report(){ const b = $('#report-box'); if (b) b.hidden = false; },
  reportcancel(){ const b = $('#report-box'); if (b) b.hidden = true; },
  async reportsend(){ const q = curTarget().q; const note = ($('#report-note') || {}).value || ''; const ok = await write('bank/' + q.id, 'update', { flagged:true, flagNote: note.trim(), flaggedAt: new Date().toISOString() }); if (ok){ toast('Reported. Claude will check this question.'); const b = $('#report-box'); if (b) b.hidden = true; } },
  mockdel(el){ S.ui.delMock = el.dataset.arg; render(); },
  mockdelno(){ S.ui.delMock = null; render(); },
  mockdelok(el){ write('mocks/' + el.dataset.arg, 'delete'); S.ui.delMock = null; render(); toast('Mock removed.'); },
  setmin(el){ S.ui.minutes = +el.dataset.v; try { localStorage.setItem('gmatlab.minutes', el.dataset.v); } catch(e){} render(); },
  coachq(el){ S.ui.coachQ = el.dataset.v; render(); },
  startsmart(el){ const [mode, topic, n] = el.dataset.arg.split('|'); startSmart(mode, +n, { topic: topic || null }); },
  startsmartform(){ const P = S.ui.practice; startSmart(P.mode === 'timed' ? 'timed' : 'learn', +P.count, { section: P.section || null, topic: P.topic || null }); },
  exportdata(){ downloadJSON(GMATStore.exportData(), `gmat-lab-backup-${today()}.json`); },
  importpick(){ const i = $('#import-file'); if (i) i.click(); },
  erase(){ S.ui.erase = true; render(); },
  eraseno(){ S.ui.erase = false; render(); },
  eraseok(){ GMATStore.eraseLocal(); S.ui.erase = false; render(); toast('Progress erased in this browser.'); },
  async syncnow(){ S.ui.dirty = false; await GMATStore.sync.now(); const st = GMATStore.sync.status(); toast(st.status === 'ok' ? 'Synced with GitHub.' : syncErrText(st.error)); render(); },
  syncoff(){ GMATStore.sync.disable(); S.ui.dirty = false; render(); toast('Sync turned off. Progress stays in this browser.'); },
  claudekeydel(){ GMATStore.claude.setKey(''); S.sample = null; S.ui.dirty = false; render(); toast('Key removed. The coach is off.'); },
};
function learnAdvanceEnd(){ const r = S.run; r.idx = r.qids.length - 1; learnAdvance(); }
const SUBMITS = {
  async studylog(f){ const min = Number($('#sl-min').value), date = $('#sl-date').value || today(), note = $('#sl-note').value.trim();
    if (!min || min < 1){ toast('Enter the minutes you studied.'); return; }
    const key = date.slice(0,7); const doc = S.studylog[key];
    const ok = await write('studylog/' + key, 'set', { entries: [...clone((doc && doc.entries) || []), { date, minutes:min, note }] });
    if (ok){ toast(`Logged ${min} minutes.`); S.ui.dirty = false; render(); } },
  async mock(f){ const total = Number($('#m-total').value);
    if (!total || total < 205 || total > 805 || total % 10 !== 5){ toast('Totals run from 205 to 805 and end in 5.'); return; }
    const sec = id => { const v = Number($(id).value); return v >= 60 && v <= 90 ? v : null; };
    const ok = await write('mocks/' + uid('m'), 'set', { date: $('#m-date').value || today(), name: $('#m-name').value, total, quant: sec('#m-q'), verbal: sec('#m-v'), di: sec('#m-di'), notes: $('#m-notes').value.trim() });
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
  claudekey(f){
    const key = $('#ck-key').value.trim(); if (!key){ toast('Paste your API key first.'); return; }
    try { GMATStore.claude.setKey(key); } catch (e){ toast(dbErrorText(e)); return; }
    S.sample = makeSample(); S.coach = null; S.ui.dirty = false; render(); toast('Key saved. The coach appears under each question.'); },
};

/* ------------------------------------------------------------------ events */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el || el.disabled) return;
  const fn = ACTIONS[el.dataset.act]; if (!fn) return;
  e.preventDefault(); fn(el, e);
});
document.addEventListener('change', e => {
  const el = e.target;
  if (el.id === 'import-file'){ importFile(el); return; }
  if (el.matches('select[data-p]')){ const t = curTarget(); if (!t) return; const p = +el.dataset.p; const v = Array.isArray(t.get()) ? [...t.get()] : t.q.parts.map(() => null); v[p] = el.value === '' ? null : +el.value; t.set(v); syncReady(); return; }
  if (el.dataset.ui){ const [grp, key] = el.dataset.ui.split('.'); S.ui[grp] = S.ui[grp] || {}; S.ui[grp][key] = el.type === 'checkbox' ? el.checked : el.value;
    if (grp === 'practice' && key === 'section') S.ui.practice.topic = '';
    if (grp === 'gen' && key === 'section') S.ui.gen.topic = genTopics(el.value)[0];
    render(); }
});
document.addEventListener('input', e => {
  const el = e.target;
  if (el.id === 'calc-in'){ const out = $('#calc-out'); const v = el.value.trim(); if (!v){ out.textContent = '='; return; } try { const r = calc(v); out.textContent = isFinite(r) ? '= ' + (Math.round(r*1e8)/1e8).toLocaleString('en-US', { maximumFractionDigits: 8 }) : '= —'; } catch(_){ out.textContent = '= …'; } return; }
  if (el.closest('form[data-dirty]')) S.ui.dirty = true;
});
document.addEventListener('submit', e => { e.preventDefault(); const f = e.target; const fn = SUBMITS[f.dataset.form]; if (fn) fn(f); });
document.addEventListener('toggle', e => { if (e.target.classList && e.target.classList.contains('coach')) S.ui.coachOpen = e.target.open; }, true);
document.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && e.target.id === 'coach-in'){ e.preventDefault(); const b = $('#coach-send'); if (b && !b.disabled) b.click(); } });
window.addEventListener('hashchange', () => { const t = location.hash.slice(1); if (VIEWS[t] && !S.run){ S.tab = t; render(); } });

/* ------------------------------------------------------------------ boot */
function makeSample(){
  const key = GMATStore.claude.key(); if (!key) return null;
  let mod = null;
  const load = () => mod || (mod = import('./coach.js').catch(() => { mod = null; throw { code:'load_failed' }; }));
  const f = async (messages, opts) => (await load()).chat(key, messages, opts);
  f.json = async (prompt, opts) => (await load()).json(key, prompt, opts);
  return f;
}
function boot(){
  const h = location.hash.slice(1); if (VIEWS[h]) S.tab = h;
  S.sample = makeSample();
  GMATStore.onStatus(onSyncStatus);
  render();
  GMATStore.open()
    .then(db => { S.db = db; S.dbStatus = 'ok'; subscribe(); render(); })
    .catch(e => { S.dbStatus = 'absent'; S.dbError = e && e.code; render(); });
}
boot();
})();
