// Run with: node --test tests/*.test.js
// Every template is built for many seeds and checked like a hand-written question; for the templates below,
// the answer key is re-derived independently from the question text by brute force.
const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('../generators.js');
const { checkQuestion, syllabus } = require('../tools/validate-questions.js');

const SYL = syllabus();
const SEEDS = 40;
const ids = (tid, L, n) => Array.from({ length: n }, (_, i) => `gen-${tid}-${L}-${(i * 2654435761 >>> 0).toString(36)}`);
const all = (tid, n) => { const t = G.templates().find(x => x.id === tid); const out = []; for (let L = t.levels[0]; L <= t.levels[1]; L++) for (const id of ids(tid, L, n)) out.push(G.fromId(id)); return out; };
const N = s => +String(s).replace(/,/g, '').replace(/−/g, '-').replace(/[$%]/g, '');
const right = q => q.choices[q.answer];
const frac = s => { s = String(s).replace(/−/g, '-'); const m = /^(-?\d+)\/(\d+)$/.exec(s); return m ? +m[1] / +m[2] : N(s); };

test('every template covers a syllabus topic, and every Quant and DI topic has templates', () => {
  const topics = new Set(G.templates().map(t => t.topic));
  for (const sec of ['Quant', 'Data Insights']) for (const t of SYL[sec]) assert.ok(topics.has(t), `no template for ${t}`);
  for (const t of G.templates()) assert.ok(SYL[t.section].includes(t.topic), `${t.id}: unknown topic ${t.topic}`);
  assert.equal(new Set(G.templates().map(t => t.id)).size, G.templates().length);
});

test('every template builds valid, complete questions at every level', () => {
  for (const t of G.templates()) for (let L = t.levels[0]; L <= t.levels[1]; L++) for (const id of ids(t.id, L, SEEDS)){
    const q = G.fromId(id);
    assert.ok(q, `${id} did not build`);
    assert.equal(q.set, 'generated');
    assert.equal(q.difficulty, L);
    assert.deepEqual(checkQuestion({ ...q, set: 'practice' }, SYL), [], id);
    const text = JSON.stringify(q);
    assert.ok(!/NaN|undefined|Infinity|\[object/.test(text), `${id}: ${text.match(/.{30}(NaN|undefined|Infinity|\[object).{10}/)}`);
    for (const c of q.choices || []) assert.ok(!/(^|[^\w^{])-\d/.test(c), `${id}: ASCII minus in "${c}"`);
    if (q.solution) assert.ok(q.solution.length > 20, id);
  }
});

test('the same id always gives the same question, and seeds vary the numbers', () => {
  for (const t of G.templates()){
    const [a, b] = ids(t.id, t.levels[0], 2), q1 = G.fromId(a);
    delete require.cache[require.resolve('../generators.js')];
    const again = require('../generators.js').fromId(a);
    assert.deepEqual(again, q1, t.id);
    const stems = new Set(ids(t.id, t.levels[1], 12).map(id => { const q = G.fromId(id); return q.stem + JSON.stringify(q.choices || q.statements || q.table || q.chart || q.tabs || ''); }));
    assert.ok(stems.size >= 5, `${t.id}: only ${stems.size} different questions in 12 seeds`);
  }
});

test('candidates are cheap metadata that match the built questions', () => {
  const c = G.candidates({ seed: 42 });
  assert.equal(c.length, G.templates().reduce((s, t) => s + t.levels[1] - t.levels[0] + 1, 0));
  for (const m of c.slice(0, 80)){
    const q = G.fromId(m.id);
    for (const k of ['topic', 'section', 'type', 'difficulty']) assert.equal(q[k], m[k], `${m.id} ${k}`);
    assert.ok(G.isGenerated(m.id));
  }
  assert.deepEqual(G.candidates({ seed: 42 }), c, 'same seed, same candidates');
  assert.notDeepEqual(G.candidates({ seed: 43 }).map(x => x.id), c.map(x => x.id));
  assert.ok(G.candidates({ topic: 'Percents', per: 3 }).every(x => x.topic === 'Percents'));
  assert.ok(G.candidates({ section: 'Data Insights' }).every(x => x.section === 'Data Insights'));
  assert.equal(G.fromId('gen-nosuch-3-abc'), null);
  assert.equal(G.fromId('gen-divcount-9-abc'), null);
  assert.equal(G.fromId('dq01'), null);
});

/* ---------------- independent answer checks */
test('divcount: brute-force count of multiples', () => {
  for (const q of all('divcount', 25)){
    const [A, B] = q.stem.match(/from ([\d,]+) to ([\d,]+)/).slice(1).map(N);
    let pred;
    if (/but not by/.test(q.stem)){ const [p, r] = q.stem.match(/divisible by (\d+) but not by (\d+)/).slice(1).map(Number); pred = n => n % p === 0 && n % r !== 0; }
    else if (/ or /.test(q.stem)){ const [p, r] = q.stem.match(/multiples of (\d+) or (\d+)/).slice(1).map(Number); pred = n => n % p === 0 || n % r === 0; }
    else { const k = +q.stem.match(/multiples of (\d+)\?/)[1]; pred = n => n % k === 0; }
    let c = 0; for (let n = A; n <= B; n++) if (pred(n)) c++;
    assert.equal(N(right(q)), c, q.id);
  }
});

test('divisors, zeros and square multipliers: brute force', () => {
  for (const q of all('divisors', 25)){
    let n = /\^\{/.test(q.stem) ? Math.pow(...q.stem.match(/does (\d+)\^\{(\d+)\}/).slice(1).map(Number)) : N(q.stem.match(/does ([\d,]+) have/)[1]);
    let c = 0; if (n < 1e8) { for (let d = 1; d * d <= n; d++) if (n % d === 0) c += d * d === n ? 1 : 2; assert.equal(N(right(q)), c, q.id); }
  }
  for (const q of all('zeros', 25)){
    const n = +q.stem.match(/(\d+)!/)[1];
    let big = 1n; for (let i = 2n; i <= BigInt(n); i++) big *= i;
    if (/zeros/.test(q.stem)){ let z = 0; while (big % 10n === 0n){ big /= 10n; z++; } assert.equal(N(right(q)), z, q.id); }
    else { const b = BigInt(q.stem.match(/that (\d+)\^\{k\}/)[1]); let k = 0; while (big % b === 0n){ big /= b; k++; } assert.equal(N(right(q)), k, q.id); }
  }
  for (const q of all('sqmult', 25)){
    const n = N(q.stem.match(/that ([\d,]+)k/)[1]), cube = /cube/.test(q.stem);
    let k = 1; while (!(cube ? Number.isInteger(Math.round(Math.cbrt(n * k))) && Math.round(Math.cbrt(n * k)) ** 3 === n * k : Math.round(Math.sqrt(n * k)) ** 2 === n * k)) k++;
    assert.equal(N(right(q)), k, q.id);
  }
});

test('remainders and units digits: brute force', () => {
  for (const q of all('units', 25)){
    const terms = [...q.stem.matchAll(/(\d+)\^\{(\d+)\}/g)].map(m => { let r = 1; for (let i = 0; i < +m[2]; i++) r = r * +m[1] % 10; return r; });
    const v = terms.length === 1 ? terms[0] : / \+ /.test(q.stem) ? (terms[0] + terms[1]) % 10 : terms[0] * terms[1] % 10;
    assert.equal(N(right(q)), v, q.id);
  }
  for (const q of all('remexpr', 25)){
    const [a, e, m] = q.stem.match(/(\d+)\^\{(\d+)\} is divided by (\d+)/).slice(1).map(Number);
    let r = 1; for (let i = 0; i < e; i++) r = r * a % m;
    assert.equal(N(right(q)), r, q.id);
  }
  for (const q of all('rem2', 25)){
    const [A, r] = q.stem.match(/divided by (\d+), the remainder is (\d+)/).slice(1).map(Number);
    const tail = q.stem.match(/when (.+?) is divided by (\d+)\?/), b = +tail[2];
    const lin = /(\d+)n \+ (\d+)/.exec(tail[1]), f = n => lin ? +lin[1] * n + +lin[2] : n;
    const seen = new Set(); for (let n = r; n < r + 50 * A; n += A) seen.add(f(n) % b);
    assert.equal(seen.size, 1, q.id); assert.equal(N(right(q)), [...seen][0], q.id);
  }
  for (const q of all('crt', 25)){
    const [r1, a, r2, b] = q.stem.match(/remainder of (\d+) when divided by (\d+) and a remainder of (\d+) when divided by (\d+)/).slice(1).map(Number);
    const ok = n => n % a === r1 && n % b === r2;
    if (/less than/.test(q.stem)){ const X = +q.stem.match(/less than (\d+)/)[1]; let c = 0; for (let n = 1; n < X; n++) if (ok(n)) c++; assert.equal(N(right(q)), c, q.id); }
    else { let n = 1; while (!ok(n)) n++; assert.equal(N(right(q)), n, q.id); }
  }
});

test('signs: exactly the keyed statement must be true', () => {
  const val = (expr, x, y, z) => { const v = { x, y, z }; const [top, bot] = expr.split('/'); const f = s => [...s.matchAll(/([xyz])(?:\^\{(\d+)\})?/g)].reduce((p, m) => p * Math.pow(v[m[1]], +(m[2] || 1)), 1); return f(top) / (bot ? f(bot) : 1); };
  for (const q of all('signs', 30)){
    const facts = [...q.stem.matchAll(/([^\s,]+) ([<>]) 0/g)].map(m => [m[1], m[2]]);
    const worlds = []; for (const x of [-2, 3]) for (const y of [-5, 7]) for (const z of [-11, 13]) if (facts.every(([e, r]) => r === '>' ? val(e, x, y, z) > 0 : val(e, x, y, z) < 0)) worlds.push([x, y, z]);
    assert.ok(worlds.length >= 2, q.id);
    q.choices.forEach((c, i) => { const [e, r] = c.split(' '); const must = worlds.every(w => r === '>' ? val(e, ...w) > 0 : val(e, ...w) < 0); assert.equal(must, i === q.answer, `${q.id} ${c}`); });
  }
});

test('fractions: terminating decimals and comparisons', () => {
  const term = s => { let [n, d] = s.split('/').map(Number); const g = (a, b) => b ? g(b, a % b) : a; d /= g(n, d); while (d % 2 === 0) d /= 2; while (d % 5 === 0) d /= 5; return d === 1; };
  for (const q of all('termin', 30)) q.choices.forEach((c, i) => assert.equal(term(c), i === q.answer, `${q.id} ${c}`));
  for (const q of all('fraccmp', 30)){ const v = q.choices.map(frac), best = /greatest/.test(q.stem) ? Math.max(...v) : Math.min(...v); assert.equal(v[q.answer], best, q.id); }
});

test('counting and probability: brute force', () => {
  const combos = (n, k, start = 0, pre = []) => k === 0 ? [pre] : Array.from({ length: n - start }, (_, i) => start + i).flatMap(i => combos(n, k - 1, i + 1, [...pre, i]));
  for (const q of all('committee', 15)){
    const [k, n] = q.stem.match(/committee of (\d+) (?:be )?(?:is )?chosen from (\d+)/).slice(1).map(Number);
    let list = combos(n, k);
    if (/doctors/.test(q.stem)){ const g = +q.stem.match(/(\d+) of whom are doctors/)[1]; list = list.filter(c => c.some(i => i < g)); }
    if (/refuse/.test(q.stem)) list = list.filter(c => !(c.includes(0) && c.includes(1)));
    assert.equal(N(right(q)), list.length, q.id);
  }
  for (const q of all('dice', 25)){
    let f = 0;
    for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++){
      if (/at least/.test(q.stem)){ const s = +q.stem.match(/at least (\d+)/)[1]; if (a + b >= s && a !== b) f++; }
      else if (a + b === +q.stem.match(/is (\d+)\?/)[1]) f++;
    }
    assert.ok(Math.abs(frac(right(q)) - f / 36) < 1e-12, q.id);
  }
  for (const q of all('draw', 15)){
    const r = +q.stem.match(/(\d+) red/)[1], bl = +q.stem.match(/(\d+) blue/)[1], g = /green/.test(q.stem) ? +q.stem.match(/(\d+) green/)[1] : 0;
    const bag = [...Array(r).fill('r'), ...Array(bl).fill('b'), ...Array(g).fill('g')], k = g ? 3 : 2, cs = combos(bag.length, k);
    const ok = c => { const col = c.map(i => bag[i]); return g ? new Set(col).size === 3 : /both are red/.test(q.stem) ? col.every(x => x === 'r') : col[0] !== col[1]; };
    assert.ok(Math.abs(frac(right(q)) - cs.filter(ok).length / cs.length) < 1e-12, q.id);
  }
});

test('algebra, sequences and statistics: independent solutions', () => {
  for (const q of all('abscount', 25)){
    let pred;
    const m2 = q.stem.match(/\|(.+?)\| \+ \|(.+?)\| ≤ (\d+)/), m1 = q.stem.match(/\|(.+?)\| (<|≤) (\d+)/);
    const lin = s => { const m = /^(\d*)x(?: ([+−]) (\d+))?$/.exec(s); const k = m[1] ? +m[1] : 1, c = m[2] ? (m[2] === '+' ? +m[3] : -m[3]) : 0; return x => k * x + c; };
    if (m2){ const f = lin(m2[1]), g = lin(m2[2]); pred = x => Math.abs(f(x)) + Math.abs(g(x)) <= +m2[3]; }
    else { const f = lin(m1[1]); pred = x => m1[2] === '<' ? Math.abs(f(x)) < +m1[3] : Math.abs(f(x)) <= +m1[3]; }
    let c = 0; for (let x = -500; x <= 500; x++) if (pred(x)) c++;
    assert.equal(N(right(q)), c, q.id);
  }
  for (const q of all('seqsum', 25)){
    const [k, A, B] = q.stem.match(/multiples of (\d+) from (\d+) to (\d+)/).slice(1).map(Number);
    let s = 0; for (let n = A; n <= B; n++) if (n % k === 0) s += n;
    assert.equal(N(right(q)), s, q.id);
  }
  for (const q of all('median', 25)){
    const xs = q.stem.match(/list ([\d, ]+)\?/)[1].split(', ').map(Number).sort((a, b) => a - b), k = xs.length;
    const med = k % 2 ? xs[(k - 1) / 2] : (xs[k / 2 - 1] + xs[k / 2]) / 2, mean = xs.reduce((a, b) => a + b, 0) / k;
    assert.ok(Math.abs(N(right(q)) - (/difference/.test(q.stem) ? Math.abs(mean - med) : med)) < 0.006, q.id);
  }
  for (const q of all('linsys', 25)){
    if (/no solution/.test(q.stem)){
      const [a, b, c, d, e] = q.stem.match(/(\d+)x \+ (\d+)y = (\d+), (\d+)x \+ ky = (\d+)/).slice(1).map(Number), k = N(right(q));
      assert.ok(a * k === b * d && a * e !== c * d, q.id); continue;
    }
    const eqs = [...q.stem.matchAll(/(−?\d*)x ([+−]) (\d*)y = (−?[\d,]+)/g)].map(m => [m[1] === '' ? 1 : m[1] === '−' ? -1 : N(m[1]), (m[2] === '+' ? 1 : -1) * (m[3] === '' ? 1 : +m[3]), N(m[4])]);
    const [[a, b, c], [d, e, f]] = eqs, det = a * e - b * d, x = (c * e - b * f) / det, y = (a * f - c * d) / det;
    const want = /x \+ y\?/.test(q.stem) ? x + y : /x − y\?/.test(q.stem) ? x - y : x;
    assert.ok(Math.abs(N(right(q)) - want) < 1e-9, q.id);
  }
  for (const q of all('quadsq', 25)){
    const m = q.stem.match(/x\^\{2\} (?:([+−]) (\d*)x )?([+−]) (\d+) = 0/), b = m[1] ? (m[1] === '+' ? 1 : -1) * (m[2] === '' ? 1 : +m[2]) : 0, c = (m[3] === '+' ? 1 : -1) * +m[4];
    const D = Math.sqrt(b * b - 4 * c), r = (-b + D) / 2, s = (-b - D) / 2;
    const want = /positive difference/.test(q.stem) ? Math.abs(r - s) : /r\^\{2\}/.test(q.stem) ? r * r + s * s : 1 / r + 1 / s;
    assert.ok(Math.abs(frac(right(q)) - want) < 1e-9, q.id);
  }
  for (const q of all('sets2', 25)){
    const n = [...q.stem.matchAll(/(\d+)/g)].map(m => +m[1]);
    if (/do neither\?/.test(q.stem)){ const [N_, A, B, both] = n; assert.equal(N(right(q)), N_ - (A + B - both), q.id); }
    else { const [N_, A, B, ne] = n; assert.equal(N(right(q)), A + B + ne - N_, q.id); }
  }
});

/* ---------------- Data Sufficiency: re-parse the statements and decide the letter on a much larger domain */
const Nstat = s => {
  const t = s.replace(/−/g, '-').replace(/,/g, ''); let m;
  if ((m = /^n is divisible by (\d+)\.$/.exec(t))) return n => n % +m[1] === 0;
  if ((m = /^n > (\d+)$/.exec(t))) return n => n > +m[1];
  if ((m = /^n < (\d+)$/.exec(t))) return n => n < +m[1];
  if ((m = /^When n is divided by (\d+),? the remainder is (\d+)\.$/.exec(t))) return n => n % +m[1] === +m[2];
  if (t === 'n is odd.') return n => n % 2 === 1;
  if (t === 'n is even.') return n => n % 2 === 0;
  if ((m = /^n \+ (\d+) is divisible by (\d+)\.$/.exec(t))) return n => (n + +m[1]) % +m[2] === 0;
  if ((m = /^n\^\{2\} is divisible by (\d+)\.$/.exec(t))) return n => n * n % +m[1] === 0;
  if ((m = /^2n is divisible by (\d+)\.$/.exec(t))) return n => 2 * n % +m[1] === 0;
  if ((m = /^n is a factor of (\d+)\.$/.exec(t))) return n => +m[1] % n === 0;
  if ((m = /^The units digit of n is (\d)\.$/.exec(t))) return n => n % 10 === +m[1];
  if (t === 'n is a prime number.') return n => { if (n < 2) return false; for (let i = 2; i * i <= n; i++) if (n % i === 0) return false; return true; };
  if ((m = /^n\^\{2\} < (\d+)$/.exec(t))) return n => n * n < +m[1];
  if (t === 'n^{2} + n is even.') return () => true;
  if ((m = /^n has exactly (\d+) positive divisors\.$/.exec(t))) return n => { let c = 0; for (let d = 1; d <= n; d++) if (n % d === 0) c++; return c === +m[1]; };
  throw new Error('unknown statement: ' + s);
};
const Nques = s => {
  const t = s.replace(/^If n is a positive integer, /, ''); let m;
  const prime = n => { if (n < 2) return false; for (let i = 2; i * i <= n; i++) if (n % i === 0) return false; return true; };
  if (t === 'is n even?') return n => n % 2 === 0;
  if ((m = /^is n divisible by (\d+)\?$/.exec(t))) return n => n % +m[1] === 0;
  if ((m = /^is n greater than (-?\d+)\?$/.exec(t.replace(/−/g, '-')))) return n => n > +m[1];
  if (t === 'is n a prime number?') return prime;
  if (t === 'is n a perfect square?') return n => Math.round(Math.sqrt(n)) ** 2 === n;
  if ((m = /^what is the remainder when n is divided by (\d+)\?$/.exec(t))) return n => n % +m[1];
  if (t === 'what is the value of n?') return n => n;
  if (t === 'what is the units digit of n?') return n => n % 10;
  throw new Error('unknown question: ' + s);
};
const XYstat = s => {
  const t = s.replace(/−/g, '-').replace(/,/g, ''); let m;
  if ((m = /^x \+ y = (\d+)$/.exec(t))) return (x, y) => x + y === +m[1];
  if ((m = /^x - y = (-?\d+)$/.exec(t))) return (x, y) => x - y === +m[1];
  if ((m = /^x > (\d+)$/.exec(t))) return x => x > +m[1];
  if ((m = /^y < (\d+)$/.exec(t))) return (x, y) => y < +m[1];
  if ((m = /^([xy]) is (odd|even)\.$/.exec(t))) return (x, y) => (m[1] === 'x' ? x : y) % 2 === (m[2] === 'odd' ? 1 : 0);
  if ((m = /^(\d+)x \+ (\d+)y = (\d+)$/.exec(t))) return (x, y) => +m[1] * x + +m[2] * y === +m[3];
  if ((m = /^xy = (\d+)$/.exec(t))) return (x, y) => x * y === +m[1];
  if ((m = /^x = (\d+)y$/.exec(t))) return (x, y) => x === +m[1] * y;
  if ((m = /^x\/y = (\d+)\/(\d+)$/.exec(t))) return (x, y) => x * +m[2] === y * +m[1];
  if ((m = /^x\^\{2\} = (\d+)$/.exec(t))) return x => x * x === +m[1];
  if ((m = /^x\^\{2\} - y\^\{2\} = (-?\d+)$/.exec(t))) return (x, y) => x * x - y * y === +m[1];
  if ((m = /^\|x - y\| = (\d+)$/.exec(t))) return (x, y) => Math.abs(x - y) === +m[1];
  throw new Error('unknown statement: ' + s);
};
const XYques = s => {
  const t = s.replace(/^If x and y are positive integers, /, '').replace(/−/g, '-'); let m;
  if (t === 'is x > y?') return (x, y) => x > y;
  if (t === 'what is the value of x + y?') return (x, y) => x + y;
  if (t === 'is xy even?') return (x, y) => x * y % 2 === 0;
  if (t === 'what is the value of x?') return x => x;
  if ((m = /^is x \+ y > (\d+)\?$/.exec(t))) return (x, y) => x + y > +m[1];
  if (t === 'what is the value of x - y?') return (x, y) => x - y;
  throw new Error('unknown question: ' + s);
};
function letter(domain, ask, s1, s2){
  const suff = preds => { const vals = new Set(); for (const p of domain) if (preds.every(f => f(...p))) vals.add(String(ask(...p))); return vals.size === 1; };
  const a = suff([s1]), b = suff([s2]);
  return a && b ? 3 : a ? 0 : b ? 1 : suff([s1, s2]) ? 2 : 4;
}
test('data sufficiency: the keyed letter holds on a far larger domain', () => {
  const dn = Array.from({ length: 3000 }, (_, i) => [i + 1]);
  for (const q of all('dsn', 12)) assert.equal(q.answer, letter(dn, Nques(q.stem), Nstat(q.statements[0]), Nstat(q.statements[1])), `${q.id}: ${q.stem} | ${q.statements.join(' | ')}`);
  const dxy = []; for (let x = 1; x <= 120; x++) for (let y = 1; y <= 120; y++) dxy.push([x, y]);
  for (const q of all('dsxy', 6)) assert.equal(q.answer, letter(dxy, XYques(q.stem), XYstat(q.statements[0]), XYstat(q.statements[1])), `${q.id}: ${q.stem} | ${q.statements.join(' | ')}`);
});

test('two-part, table, chart and multi-source answers check out', () => {
  for (const q of all('tpamix', 20)){
    const [, hp, pp, hq, pq, H, M] = q.stem.replace(/,/g, '').match(/needs (\d+) .+? profit of \$(\d+); each .+? needs (\d+) .+? profit of \$(\d+)\. .+? exactly (\d+) .+? exactly \$(\d+)/).map(Number);
    const P = +q.parts[0].options[q.parts[0].answer], Qv = +q.parts[1].options[q.parts[1].answer];
    assert.ok(hp * P + hq * Qv === H && pp * P + pq * Qv === M, q.id);
    let pairs = 0; for (const a of q.parts[0].options) for (const b of q.parts[1].options) if (hp * a + hq * b === H && pp * a + pq * b === M) pairs++;
    assert.equal(pairs, 1, `${q.id}: exactly one consistent pair`);
  }
  for (const q of all('gibars', 25)){
    const v = q.chart.values, L = q.chart.labels, tot = v.reduce((s, x) => s + x, 0), mean = tot / v.length;
    for (const p of q.parts){
      const got = +p.options[p.answer].replace('%', ''); let want, tol = 0.5 + 1e-9, m;
      if ((m = /value for (.+?) was greater than the value for (.+?) by/.exec(p.label))) want = 100 * (v[L.indexOf(m[1])] - v[L.indexOf(m[2])]) / v[L.indexOf(m[2])];
      else if (/accounted for/.test(p.label)) want = 100 * v[L.indexOf(p.label.split(' accounted')[0])] / tot;
      else if (/times the smallest/.test(p.label)){ want = Math.max(...v) / Math.min(...v); tol = 0.05 + 1e-9; }
      else if (/average of the \d+ values/.test(p.label)) want = mean;
      else if (/number of bars above the average/.test(p.label)){ want = v.filter(x => x > mean).length; tol = 0; }
      else assert.fail('unknown statement ' + p.label);
      assert.ok(Math.abs(got - want) <= tol, `${q.id}: ${p.label} ${got} vs ${want}`);
      // the keyed option is the closest one
      const vals = p.options.map(o => +o.replace('%', ''));
      assert.ok(vals.every(x => Math.abs(x - want) >= Math.abs(got - want) - 1e-9), `${q.id}: a closer option exists`);
    }
    assert.ok(q.chart.max >= Math.max(...v), q.id);
  }
  for (const q of all('tastore', 25)) for (const p of q.parts){
    const rows = q.table.rows, cols = q.table.columns.map(c => c.toLowerCase());
    const col = w => { const i = cols.findIndex(c => c.startsWith(w.replace(/^number of /, ''))); assert.ok(i >= 2, `${q.id}: no column for "${w}"`); return rows.map(r => r[i]); };
    const sum = a => a.reduce((s, x) => s + x, 0); let t, m;
    if ((m = /^The \w+ with the highest (.+?) per (\w+) also has the highest (.+)\.$/.exec(p.label))){ const a = col(m[1]), b = col(m[2] + 's'), c = col(m[3]); const r = a.map((x, i) => x / b[i]); t = r.indexOf(Math.max(...r)) === c.indexOf(Math.max(...c)); }
    else if ((m = /^The median (.+?) of the six \w+ is greater than (\$)?([\d,]+?)(,000)?\.$/.exec(p.label))){ const s = col(m[1]).slice().sort((a, b) => a - b); t = (s[2] + s[3]) / 2 > (m[2] ? N(m[3]) : N(m[3] + (m[4] || ''))); }
    else if ((m = /^The (\w+) \w+ together account for more than half of the total (.+?) of the six/.exec(p.label))){ const a = col(m[2]); t = sum(a.filter((_, i) => rows[i][1] === m[1])) > sum(a) / 2; }
    else if ((m = /^At least (\d+) of the \w+ have (?:more )?(.+?) (?:above|than) the average/.exec(p.label))){ const a = col(m[2]); t = a.filter(x => x > sum(a) / 6).length >= +m[1]; }
    else if ((m = /^The average number of (\w+) per \w+ is greater than (\d+)\.$/.exec(p.label))) t = sum(col(m[1])) / 6 > +m[2];
    else if ((m = /^Every \w+ with (.+?) above (\d+)(?:%| points) has more than (\d+) (\w+)\.$/.exec(p.label))){ const c = col(m[1]), e = col(m[4]); t = rows.every((r, i) => !(c[i] > +m[2]) || e[i] > +m[3]); }
    else assert.fail('unknown statement ' + p.label);
    assert.equal(p.answer, t ? 0 : 1, `${q.id}: ${p.label}`);
  }
  for (const q of all('tparange', 25)){
    const S = +q.stem.match(/x \+ y = (\d+)/)[1], conds = [];
    let m;
    if ((m = /x − y is greater than (\d+)/.exec(q.stem))) conds.push((x, y) => x - y > +m[1]);
    if (/x is more than twice y/.test(q.stem)) conds.push((x, y) => x > 2 * y);
    const ym = /y is at least (\d+)/.exec(q.stem); if (ym) conds.push((x, y) => y >= +ym[1]);
    const mq = /x is a multiple of (\d+)/.exec(q.stem); if (mq) conds.push(x => x % +mq[1] === 0);
    const ok = []; for (let y = 1; y < S; y++) if (conds.every(f => f(S - y, y))) ok.push([S - y, y]);
    assert.equal(+q.parts[0].options[q.parts[0].answer], Math.min(...ok.map(p => p[0])), q.id);
    assert.equal(+q.parts[1].options[q.parts[1].answer], Math.max(...ok.map(p => p[1])), q.id);
  }
  for (const q of all('msrstaff', 25)){
    const p = +q.tabs[0].body.match(/at most (\d+) patients\. A trainee/)[1], tp = +q.tabs[0].body.match(/trainee nurse may care for at most (\d+)/)[1];
    const [cn, ct] = [...q.tabs[2].body.matchAll(/\$([\d,]+) per shift/g)].map(x => N(x[1]));
    const wards = Object.fromEntries([...q.tabs[1].body.matchAll(/Ward (\w+): (\d+) patients per shift; (\d+) nurses and (\d+) trainees?/g)].map(x => [x[1], { pts: +x[2], n: +x[3], t: +x[4] }]));
    const cap = w => w.n * p + w.t * tp, short = w => Math.max(0, w.pts - cap(w));
    for (const part of q.parts){
      let t, m;
      if ((m = /^Ward (\w+) is adequately staffed/.exec(part.label))) t = cap(wards[m[1]]) >= wards[m[1]].pts;
      else if ((m = /at least (\d+) more nurses are needed/.exec(part.label))) t = Object.values(wards).reduce((s, w) => s + Math.ceil(short(w) / p), 0) >= +m[1];
      else if (/with trainees instead of nurses would cost less/.test(part.label)) t = Object.values(wards).reduce((s, w) => s + Math.ceil(short(w) / tp), 0) * ct < Object.values(wards).reduce((s, w) => s + Math.ceil(short(w) / p), 0) * cn;
      else if ((m = /patients on Ward (\w+) rose by (\d+)%/.exec(part.label))) t = cap(wards[m[1]]) >= Math.ceil(wards[m[1]].pts * (1 + +m[2] / 100) - 1e-9);
      else assert.fail('unknown statement ' + part.label);
      assert.equal(part.answer, t ? 0 : 1, `${q.id}: ${part.label}`);
    }
  }
  for (const q of all('msrship', 20)){
    const rule = q.tabs[0].body, base = N(rule.match(/costs \$([\d.]+) for/)[1]), inc = +rule.match(/up to (\d+) kg/)[1], per = N(rule.match(/plus \$([\d.]+) for each/)[1]), ex = +rule.match(/costs (\d+)% more/)[1];
    const orders = Object.fromEntries([...q.tabs[1].body.matchAll(/#(\d+): ([\d.]+) kg, (\w+)/g)].map(m => [m[1], { w: +m[2], x: m[3] === 'express' }]));
    const cost = (o, x = o.x) => Math.round((base + per * Math.max(0, Math.ceil(o.w - inc))) * (x ? 1 + ex / 100 : 1) * 100) / 100;
    for (const p of q.parts){
      let t, m;
      if ((m = /^Order #(\d+) costs more than \$([\d,]+(?:\.\d+)?) to deliver/.exec(p.label))) t = cost(orders[m[1]]) > N(m[2]);
      else if ((m = /^The express orders together cost more than \$([\d,]+(?:\.\d+)?)/.exec(p.label))) t = Object.values(orders).filter(o => o.x).reduce((s, o) => s + cost(o), 0) > N(m[1]) + 1e-9;
      else if ((m = /^Sending order #(\d+) .+? save more than \$([\d,]+(?:\.\d+)?)/.exec(p.label))) t = cost(orders[m[1]], true) - cost(orders[m[1]], false) > N(m[2]) + 1e-9;
      else if ((m = /^Order #(\d+) costs more to deliver than order #(\d+)/.exec(p.label))) t = cost(orders[m[1]]) > cost(orders[m[2]]);
      else assert.fail('unknown statement ' + p.label);
      assert.equal(p.answer, t ? 0 : 1, `${q.id}: ${p.label}`);
    }
  }
});
