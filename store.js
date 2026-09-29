/* GMAT Lab storage.
   Progress lives in this browser (localStorage). The question bank is read from questions/*.json.
   Optional: sync progress to a JSON file in a GitHub repository, so it follows you across devices
   and Claude can read it. Exposes window.GMATStore with the doc/collection surface app.js uses. */
(() => {
'use strict';

const COLLECTIONS = ['bank','sessions','errors','mocks','profile','studylog'];
const LS_DATA = 'gmatlab.data.v1';
const LS_SYNC = 'gmatlab.sync.v1';
const LS_OLD_KEY = 'gmatlab.claude.v1';   // an API key saved by an older version: deleted at start
const PUSH_DELAY = 5000, PUSH_MAX_WAIT = 30000;

const clone = o => o == null ? o : JSON.parse(JSON.stringify(o));
const now = () => Date.now();
function lsGet(k){ try { return localStorage.getItem(k); } catch(e){ return null; } }
function lsSet(k, v){ try { localStorage.setItem(k, v); } catch(e){ throw { code: e && e.name === 'QuotaExceededError' ? 'quota_exceeded' : 'no_storage' }; } }
function lsDel(k){ try { localStorage.removeItem(k); } catch(e){} }
function readJSON(k){ try { const v = lsGet(k); return v ? JSON.parse(v) : null; } catch(e){ return null; } }

/* state: docs[col][id] = doc; ts['col/id'] = last change; dead['col/id'] = deletion time (so deletes survive a merge) */
function emptyState(){ const docs = {}; for (const c of COLLECTIONS) docs[c] = {}; return { docs, ts:{}, dead:{}, dirty:false }; }
function normalize(s){
  const out = emptyState();
  if (!s || typeof s !== 'object') return out;
  for (const c of COLLECTIONS) if (s.docs && s.docs[c] && typeof s.docs[c] === 'object') out.docs[c] = s.docs[c];
  out.ts = (s.ts && typeof s.ts === 'object') ? s.ts : {};
  out.dead = (s.dead && typeof s.dead === 'object') ? s.dead : {};
  out.dirty = !!s.dirty;
  return out;
}

let state = emptyState();
let base = {};               // question bank from questions/*.json
let bankError = null;
const listeners = {};
const statusFns = [];

function persist(){ lsSet(LS_DATA, JSON.stringify(state)); }
function snapDocs(col){
  if (col !== 'bank') return state.docs[col] || {};
  const m = {};
  for (const [id, q] of Object.entries(base)) m[id] = q;
  for (const [id, q] of Object.entries(state.docs.bank || {})) m[id] = { ...(m[id] || {}), ...q };
  return m;
}
function snap(col){ return { docs: Object.entries(snapDocs(col)).map(([id, d]) => ({ id, exists:true, data: () => d })) }; }
function emit(col){ (listeners[col] || []).forEach(fn => { try { fn(snap(col)); } catch(e){ console.error(e); } }); }
function emitAll(){ COLLECTIONS.forEach(emit); }

function apply(path, op, data){
  const [col, id] = String(path).split('/');
  if (!COLLECTIONS.includes(col) || !id) throw { code:'invalid_argument' };
  const docs = state.docs[col];
  if (op === 'delete'){ delete docs[id]; delete state.ts[path]; state.dead[path] = now(); }
  else {
    const d = clone(data) || {}; delete d.id;
    docs[id] = op === 'set' ? d : { ...(docs[id] || {}), ...d };
    state.ts[path] = now(); delete state.dead[path];
  }
  state.dirty = true;
  persist();
  emit(col);
  Sync.schedule();
}

/* Merge two states document by document: the newer change wins. */
function merge(a, b){
  const out = emptyState();
  const keys = new Set([...Object.keys(a.ts), ...Object.keys(a.dead), ...Object.keys(b.ts), ...Object.keys(b.dead)]);
  for (const k of COLLECTIONS) for (const id of Object.keys(a.docs[k])) if (!a.ts[k + '/' + id]) keys.add(k + '/' + id);
  for (const k of COLLECTIONS) for (const id of Object.keys(b.docs[k])) if (!b.ts[k + '/' + id]) keys.add(k + '/' + id);
  for (const path of keys){
    const [col, id] = path.split('/'); if (!COLLECTIONS.includes(col)) continue;
    const side = s => { const t = s.ts[path] || (s.docs[col][id] ? 1 : 0), d = s.dead[path] || 0; return d > t ? { t:d, dead:true } : { t, doc: s.docs[col][id] }; };
    const x = side(a), y = side(b); const w = y.t > x.t ? y : x;
    if (!w.t) continue;
    if (w.dead) out.dead[path] = w.t;
    else if (w.doc){ out.docs[col][id] = w.doc; out.ts[path] = w.t; }
  }
  return out;
}
function canon(v){
  if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
  return JSON.stringify(v === undefined ? null : v);
}
const sameData = (a, b) => canon({ d:a.docs, t:a.ts, x:a.dead }) === canon({ d:b.docs, t:b.ts, x:b.dead });

function exportData(){ return { app:'gmat-lab', version:1, exportedAt:new Date().toISOString(), docs:clone(state.docs), ts:clone(state.ts), dead:clone(state.dead) }; }
function importData(obj){
  if (!obj || typeof obj !== 'object' || (obj.app && obj.app !== 'gmat-lab')) throw { code:'bad_file' };
  let inc;
  if (obj.docs) inc = normalize(obj);
  else { inc = emptyState(); for (const c of COLLECTIONS) if (obj[c] && typeof obj[c] === 'object') inc.docs[c] = obj[c]; }
  const t = now();
  for (const c of COLLECTIONS) for (const id of Object.keys(inc.docs[c])) if (!inc.ts[c + '/' + id]) inc.ts[c + '/' + id] = t;
  const count = COLLECTIONS.reduce((n, c) => n + Object.keys(inc.docs[c]).length, 0);
  if (!count) throw { code:'bad_file' };
  state = merge(state, inc); state.dirty = true;
  persist(); emitAll(); Sync.schedule(true);
  return count;
}
function eraseLocal(){ state = emptyState(); persist(); emitAll(); }
function summary(){
  const n = c => Object.keys(state.docs[c] || {}).length;
  let bytes = 0; try { bytes = (lsGet(LS_DATA) || '').length; } catch(e){}
  return { sessions:n('sessions'), errors:n('errors'), mocks:n('mocks'), generated:n('bank'), questions:Object.keys(snapDocs('bank')).length, bytes };
}

/* ------------------------------------------------------------------ GitHub sync */
function b64encode(str){ const bytes = new TextEncoder().encode(str); let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(bin); }
function b64decode(b64){ const bin = atob(String(b64).replace(/\s/g, '')); return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0))); }
/* Default sync target: a private "<site repo>-progress" repository, so progress never sits in the public site repo. */
function guessRepo(){
  const h = location.hostname;
  if (/\.github\.io$/i.test(h)){ const owner = h.split('.')[0]; const seg = location.pathname.split('/').filter(Boolean)[0]; return owner + '/' + (seg || h) + '-progress'; }
  return '';
}
const Sync = {
  status:'off', error:null, lastSync:null, sha:null, timer:null, firstChange:0, busy:null, again:false,
  cfg(){ const c = readJSON(LS_SYNC) || {}; return { token: c.token || '', repo: c.repo || guessRepo(), branch: c.branch || 'gmat-progress', path: c.path || 'progress/gmat-lab.json', on: !!(c.on && c.token && c.repo) }; },
  set(st, err){ this.status = st; this.error = err || null; statusFns.forEach(fn => { try { fn(); } catch(e){} }); },
  async gh(method, url, body){
    const c = this.cfg();
    let r;
    try { r = await fetch('https://api.github.com' + url, { method, cache:'no-store', headers: { Authorization:'Bearer ' + c.token, Accept:'application/vnd.github+json', 'X-GitHub-Api-Version':'2022-11-28', ...(body ? { 'Content-Type':'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined }); }
    catch(e){ throw { code:'network' }; }
    let j = null; try { j = await r.json(); } catch(e){}
    return { status: r.status, ok: r.ok, json: j };
  },
  repoPath(){ return '/repos/' + this.cfg().repo.split('/').map(encodeURIComponent).join('/'); },
  filePath(){ return this.repoPath() + '/contents/' + this.cfg().path.split('/').map(encodeURIComponent).join('/'); },
  fail(res){
    if (res.status === 401) return { code:'gh_auth' };
    if (res.status === 403 || res.status === 404) return { code:'gh_access' };
    if (res.status === 429) return { code:'gh_rate' };
    return { code:'gh_other', text: res.json && res.json.message };
  },
  async check(){
    const res = await this.gh('GET', this.repoPath());
    if (!res.ok) throw this.fail(res);
    if (!res.json.permissions || !res.json.permissions.push) throw { code:'gh_readonly' };
    return res.json;
  },
  async ensureBranch(){
    const c = this.cfg();
    const b = await this.gh('GET', this.repoPath() + '/branches/' + encodeURIComponent(c.branch));
    if (b.ok) return;
    if (b.status !== 404) throw this.fail(b);
    const repo = await this.check();
    const refPath = this.repoPath() + '/git/ref/heads/' + encodeURIComponent(repo.default_branch);
    let ref = await this.gh('GET', refPath);
    if (ref.status === 409 || ref.status === 404){   // empty repository: give it a first commit to branch from
      const init = await this.gh('PUT', this.repoPath() + '/contents/README.md', { message:'Start GMAT Lab progress', content: b64encode('# GMAT Lab progress\n\nWritten by the GMAT Lab app. Keep this repository private.\n') });
      if (!init.ok && init.status !== 422) throw this.fail(init);
      ref = await this.gh('GET', refPath);
    }
    if (!ref.ok) throw this.fail(ref);
    const mk = await this.gh('POST', this.repoPath() + '/git/refs', { ref:'refs/heads/' + c.branch, sha: ref.json.object.sha });
    if (!mk.ok && mk.status !== 422) throw this.fail(mk);
  },
  async fetchRemote(){
    const c = this.cfg();
    const res = await this.gh('GET', this.filePath() + '?ref=' + encodeURIComponent(c.branch));
    if (res.status === 404){ this.sha = null; return null; }
    if (!res.ok) throw this.fail(res);
    let content = res.json.content;
    if (!content && res.json.sha){ const blob = await this.gh('GET', this.repoPath() + '/git/blobs/' + res.json.sha); if (!blob.ok) throw this.fail(blob); content = blob.json.content; }
    this.sha = res.json.sha;
    try { return normalize(JSON.parse(b64decode(content || ''))); } catch(e){ throw { code:'gh_badfile' }; }
  },
  async pullMerge(){
    const remote = await this.fetchRemote();
    if (!remote) return true;
    const merged = merge(state, remote);
    const changedLocal = !sameData(merged, state), needPush = !sameData(merged, remote);
    merged.dirty = needPush;
    state = merged; persist();
    if (changedLocal) emitAll();
    return needPush;
  },
  async push(){
    const c = this.cfg();
    const body = { message:'GMAT Lab progress · ' + new Date().toISOString().slice(0,16).replace('T',' '), branch:c.branch, content: b64encode(JSON.stringify(exportData(), null, 1)) };
    if (this.sha) body.sha = this.sha; else await this.ensureBranch();   // first save: the branch may not exist yet
    const res = await this.gh('PUT', this.filePath(), body);
    if (res.status === 409 || res.status === 422) return false;          // the file changed since we read it
    if (!res.ok) throw this.fail(res);
    this.sha = res.json.content.sha;
    return true;
  },
  run(){
    if (this.busy){ this.again = true; return this.busy; }
    if (!this.cfg().on){ this.set('off'); return Promise.resolve(); }
    this.set('syncing');
    this.busy = (async () => {
      try {
        let needPush = await this.pullMerge() || state.dirty;
        for (let i = 0; needPush && i < 3; i++){
          if (await this.push()){ needPush = false; break; }
          needPush = await this.pullMerge();        // someone else pushed first: merge, then retry
        }
        if (needPush) throw { code:'gh_conflict' };
        state.dirty = false; persist();
        this.lastSync = new Date(); this.set('ok');
      } catch(e){ this.set('error', e && e.code ? e : { code:'gh_other' }); }
      finally {
        this.busy = null;
        if (this.again){ this.again = false; this.schedule(); }
      }
    })();
    return this.busy;
  },
  schedule(soon){
    if (!this.cfg().on) return;
    if (this.status !== 'syncing') this.set('pending');
    const t = now(); if (!this.firstChange) this.firstChange = t;
    clearTimeout(this.timer);
    const wait = soon ? 300 : Math.max(0, Math.min(PUSH_DELAY, this.firstChange + PUSH_MAX_WAIT - t));
    this.timer = setTimeout(() => { this.firstChange = 0; this.run(); }, wait);
  },
  flush(){ if (this.cfg().on && (this.timer || state.dirty)){ clearTimeout(this.timer); this.timer = null; this.firstChange = 0; this.run(); } },
};

/* ------------------------------------------------------------------ public API */
async function loadBank(){
  const r = await fetch('questions/index.json', { cache:'no-cache' });
  if (!r.ok) throw 0;
  const idx = await r.json();
  const files = await Promise.all((idx.files || []).map(f => fetch('questions/' + f, { cache:'no-cache' }).then(x => { if (!x.ok) throw 0; return x.json(); })));
  const m = {};
  for (const list of files) for (const q of (Array.isArray(list) ? list : [])) if (q && q.id){ const d = { ...q }; delete d.id; m[q.id] = d; }
  return m;
}
const db = {
  doc: path => ({
    set: d => new Promise((ok, no) => { try { apply(path, 'set', d); ok(); } catch(e){ no(e); } }),
    update: d => new Promise((ok, no) => { try { apply(path, 'update', d); ok(); } catch(e){ no(e); } }),
    delete: () => new Promise((ok, no) => { try { apply(path, 'delete'); ok(); } catch(e){ no(e); } }),
  }),
  collection: col => ({ onSnapshot(next){ (listeners[col] = listeners[col] || []).push(next); setTimeout(() => next(snap(col)), 0); return () => { listeners[col] = (listeners[col] || []).filter(f => f !== next); }; } }),
};

async function open(){
  try { localStorage.setItem('gmatlab.probe', '1'); localStorage.removeItem('gmatlab.probe'); }
  catch(e){ throw { code:'no_storage' }; }
  lsDel(LS_OLD_KEY);
  state = normalize(readJSON(LS_DATA));
  try { base = await loadBank(); } catch(e){ base = {}; bankError = location.protocol === 'file:' ? 'file' : 'fetch'; }
  window.addEventListener('storage', e => { if (e.key === LS_DATA){ state = normalize(readJSON(LS_DATA)); emitAll(); } });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') Sync.flush(); else if (Sync.cfg().on && Sync.status !== 'syncing') Sync.run(); });
  if (Sync.cfg().on) setTimeout(() => Sync.run(), 0);
  return db;
}

window.GMATStore = {
  open, exportData, importData, eraseLocal, summary,
  bankError: () => bankError,
  onStatus: fn => { statusFns.push(fn); },
  sync: {
    config: () => { const c = Sync.cfg(); return { repo:c.repo, branch:c.branch, path:c.path, on:c.on, hasToken: !!c.token }; },
    status: () => ({ status: Sync.cfg().on ? Sync.status : 'off', error: Sync.error, lastSync: Sync.lastSync }),
    async enable(o){
      const prev = readJSON(LS_SYNC) || {};
      const next = { token: o.token || prev.token || '', repo: String(o.repo || '').trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/, '').replace(/\/+$/, ''), branch: String(o.branch || '').trim() || 'gmat-progress', path: prev.path || 'progress/gmat-lab.json', on:false };
      if (!/^[\w.-]+\/[\w.-]+$/.test(next.repo)) throw { code:'gh_repo' };
      if (!next.token) throw { code:'gh_auth' };
      lsSet(LS_SYNC, JSON.stringify(next));
      Sync.sha = null;
      try { const repo = await Sync.check(); if (!repo.private && !o.allowPublic) throw { code:'gh_public' }; } catch(e){ Sync.set(e.code === 'gh_public' ? 'off' : 'error', e.code === 'gh_public' ? null : e); throw e; }
      next.on = true; lsSet(LS_SYNC, JSON.stringify(next));
      await Sync.run();
      if (Sync.status === 'error') throw Sync.error;
    },
    disable(){ const c = readJSON(LS_SYNC) || {}; lsDel(LS_SYNC); if (c.repo) lsSet(LS_SYNC, JSON.stringify({ repo:c.repo, branch:c.branch, path:c.path })); clearTimeout(Sync.timer); Sync.sha = null; Sync.set('off'); },
    now: () => Sync.run(),
  },
};
})();
