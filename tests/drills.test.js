// Run with: node --test tests/*.test.js
// Every drill at every level, many times: the answer key is re-derived independently, and the answer checker is exercised.
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../drills.js');

function rng(seed){ return () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; }; }
const val = q => q.n / q.d;
const close = (a, b) => Math.abs(a - b) < 1e-9 * Math.max(1, Math.abs(b));
const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b){ [a, b] = [b, a % b]; } return a; };
function brute(d){
  if (d.p != null && d.s != null) return (d.p / d.q) * (d.r / d.s);   // combined ratio a:c
  switch (d.kind){
    case undefined: return d.n / d.d;                                   // simplify a fraction
    case 'exp': return Math.log(Function('return ' + d.value)()) / Math.log(d.b);
    case 'lin': return (d.c - d.b) / d.a;
    case 'lin2': return (d.d + d.a * d.b) / (d.a - d.c);
    case 'lin3': return d.a * (d.c - d.b);
    case 'sys': { const [a1, b1, c1] = d.a, [a2, b2, c2] = d.b, det = a1 * b2 - a2 * b1; return d.want === 'x' ? (c1 * b2 - c2 * b1) / det : (a1 * c2 - a2 * c1) / det; }
    case 'fr': { const [n, m] = d.tot.split('/').map(Number); return (n / (m || 1)) / (1 / d.p + 1 / d.q); }
    case 'rem': return d.n % d.d;
    case 'gcd': { let g = 1; for (let i = 1; i <= Math.min(d.a, d.b); i++) if (d.a % i === 0 && d.b % i === 0) g = i; return g; }
    case 'lcm': { for (let m = Math.max(d.a, d.b); ; m++) if (m % d.a === 0 && m % d.b === 0) return m; }
    case 'ndiv': { let c = 0; for (let i = 1; i <= d.n; i++) if (d.n % i === 0) c++; return c; }
    case 'spf': { for (let p = 2; ; p++) if (d.n % p === 0) return p; }
  }
  throw new Error('no check for ' + JSON.stringify(d));
}

test('every drill has a correct, well-formed answer key at every level', () => {
  for (const sk of D.skills()) for (let L = 1; L <= D.LEVELS; L++){
    const prompts = new Set();
    for (let seed = 1; seed <= 60; seed++) for (const it of D.makeSet(sk.id, L, 5, rng(seed * 7919 + L))){
      const where = `${sk.id} L${L}: ${it.prompt}`;
      prompts.add(it.prompt);
      assert.ok(Number.isInteger(it.answer.n) && Number.isInteger(it.answer.d) && it.answer.d > 0 && gcd(it.answer.n, it.answer.d) === 1, where);
      assert.ok(it.expr || it.data, where + ': nothing to verify the key with');
      if (it.expr) assert.ok(close(Function('return ' + it.expr)(), val(it.answer)), `${where}: ${it.expr} ≠ ${D.frac(it.answer)}`);
      if (it.data) assert.ok(close(brute(it.data), val(it.answer)), `${where}: brute force ${brute(it.data)} ≠ ${D.frac(it.answer)}`);
      assert.ok(D.check(it, D.show(it)).ok, `${where}: the shown answer ${D.show(it)} is rejected`);
      assert.ok(it.tip && it.target > 0);
      assert.ok(!D.check(it, D.frac({ n: it.answer.n + it.answer.d, d: it.answer.d })).ok, where + ': a wrong answer is accepted');
    }
    assert.ok(prompts.size >= 25, `${sk.id} L${L}: only ${prompts.size} different questions`);
  }
});

test('typed answers are read the way a student writes them', () => {
  const it = (n, d, extra) => ({ answer: D.Q(n, d), ...extra });
  assert.ok(D.check(it(3, 4), '0.75').ok && D.check(it(3, 4), '3/4').ok && D.check(it(3, 4), '6/8').ok && D.check(it(3, 4), '0,75').ok);
  assert.ok(D.check(it(3, 8), '0,375').ok, 'decimal comma with three digits');
  assert.ok(D.check(it(1200, 1), '1,200').ok && D.check(it(1200, 1), '1200').ok);
  assert.ok(D.check(it(75, 1), '75%').ok && D.check(it(5, 1), 'x = 5').ok && D.check(it(-3, 1), '−3').ok && D.check(it(3, 2), '1 1/2').ok);
  assert.ok(D.check(it(8, 15), '8:15').ok && D.check(it(8, 15), '16:30').ok);
  assert.equal(D.check(it(3, 4, { form: 'fraction' }), '6/8').reason, 'lowest');
  assert.equal(D.check(it(3, 4, { form: 'fraction' }), '0.75').reason, 'form');
  assert.equal(D.check(it(3, 8, { form: 'decimal' }), '3/8').reason, 'form');
  assert.equal(D.check(it(3, 4), 'abc').reason, 'unreadable');
  assert.equal(D.check(it(3, 4), '').reason, 'empty');
  assert.equal(D.check(it(3, 4), '0.7').reason, 'wrong');
  assert.equal(D.check(it(1, 3), '0.333').reason, 'wrong', '1/3 has no exact decimal');
});

test('a level is passed with 9 of 10 right within the target time; drills go breadth first', () => {
  const t = D.skills()[0].targets[0];
  const run = (right, sec) => Array.from({ length: 10 }, (_, i) => ({ ok: i < right, sec }));
  assert.equal(D.evaluate('mental', 1, run(9, t)).passed, true);
  assert.equal(D.evaluate('mental', 1, run(10, t + 1)).passed, false, 'too slow');
  assert.equal(D.evaluate('mental', 1, run(8, 1)).passed, false, 'too many errors');
  assert.deepEqual(D.nextDrill({}), { skill: 'mental', name: 'Mental arithmetic', level: 1 });
  const all1 = Object.fromEntries(D.skills().map(s => [s.id, { passed: 1 }]));
  assert.equal(D.nextDrill({ ...all1, mental: { passed: 2 } }).skill, 'signs');
  assert.equal(D.nextDrill({ ...all1, mental: { passed: 2 } }).level, 2);
  assert.equal(D.nextDrill(Object.fromEntries(D.skills().map(s => [s.id, { passed: 3 }]))), null);
});
