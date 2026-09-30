/* GMAT Lab question generators: Quant and Data Insights questions built by code, no AI.
   A generated question has an id gen-<template>-<level>-<seed>, and the same id always rebuilds the same question,
   so sessions, retests and the error log keep working. Answers are computed exactly; every wrong option comes from a
   named mistake, which is also its diagnosis. Pure functions, no DOM: window.GMATGen in the browser, module.exports in Node.
   A template that changes what an existing id shows should get a new template id; mark the old one `retired: true`. */
(function (root){
'use strict';

/* ------------------------------------------------------------------ seeded random numbers */
function mulberry(seed){ let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function hash(...parts){ let h = 2166136261; for (const ch of parts.join('|')){ h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
class Retry extends Error {}
const need = c => { if (!c) throw new Retry('retry'); };
function Rng(seed){
  const f = mulberry(seed);
  const r = {
    int: (lo, hi) => lo + Math.floor(f() * (hi - lo + 1)),
    pick: a => a[Math.floor(f() * a.length)],
    chance: p => f() < p,
    shuffle: a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--){ const j = Math.floor(f() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; },
  };
  r.sample = (a, k) => r.shuffle(a).slice(0, k);
  r.mc = (correct, wrong, o) => mc(r, correct, wrong, o || {});
  return r;
}

/* ------------------------------------------------------------------ exact arithmetic */
const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
const lcm = (a, b) => a / gcd(a, b) * b;
const C = (n, k) => { if (k < 0 || k > n) return 0; let r = 1; for (let i = 1; i <= k; i++) r = r * (n - k + i) / i; return Math.round(r); };
const P = (n, k) => { let r = 1; for (let i = 0; i < k; i++) r *= n - i; return r; };
const fact = n => n <= 1 ? 1 : n * fact(n - 1);
const isPrime = n => { if (n < 2) return false; for (let i = 2; i * i <= n; i++) if (n % i === 0) return false; return true; };
function factorize(n){ const f = {}; for (let p = 2; p * p <= n; p++) while (n % p === 0){ f[p] = (f[p] || 0) + 1; n /= p; } if (n > 1) f[n] = (f[n] || 0) + 1; return f; }
const mod = (a, m) => ((a % m) + m) % m;
function powmod(b, e, m){ let r = 1 % m; b = mod(b, m); while (e > 0){ if (e & 1) r = r * b % m; b = b * b % m; e = Math.floor(e / 2); } return r; }
const round = (x, dp) => { const k = Math.pow(10, dp || 0); return Math.round(x * k) / k; };
const isInt = x => Math.abs(x - Math.round(x)) < 1e-9;
const decimals = (x, dp) => isInt(x * Math.pow(10, dp));      // x has at most dp decimals
const sum = a => a.reduce((s, v) => s + v, 0);
const legendre = (n, p) => { let v = 0; for (let q = p; q <= n; q *= p) v += Math.floor(n / q); return v; };
const divisorsOf = n => { const d = []; for (let i = 1; i <= n; i++) if (n % i === 0) d.push(i); return d; };

class Frac {
  constructor(n, d){ this.n = n; this.d = d; }
  valueOf(){ return this.n / this.d; }
  toString(){ return this.d === 1 ? num(this.n) : (this.n < 0 ? '−' : '') + Math.abs(this.n) + '/' + this.d; }
}
function Q(n, d){ if (d === undefined) d = 1; need(d !== 0 && Number.isInteger(n) && Number.isInteger(d)); if (d < 0){ n = -n; d = -d; } const g = gcd(n, d) || 1; return new Frac(n / g, d / g); }
const qn = x => x instanceof Frac ? x : Q(x, 1);
const qadd = (a, b) => { a = qn(a); b = qn(b); return Q(a.n * b.d + b.n * a.d, a.d * b.d); };
const qsub = (a, b) => { b = qn(b); return qadd(a, Q(-b.n, b.d)); };
const qmul = (a, b) => { a = qn(a); b = qn(b); return Q(a.n * b.n, a.d * b.d); };
const qdiv = (a, b) => { a = qn(a); b = qn(b); need(b.n !== 0); return Q(a.n * b.d, a.d * b.n); };

/* ------------------------------------------------------------------ number formats */
function num(x, dp){
  if (x instanceof Frac) return x.toString();
  if (typeof x === 'string') return x;
  if (!isFinite(x)) return String(x);
  let v = round(x, dp == null ? 6 : dp);
  const neg = v < 0; v = Math.abs(v);
  let [i, f] = (dp == null ? String(v) : v.toFixed(dp)).split('.');
  i = i.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (neg && +v !== 0 ? '−' : '') + i + (f ? '.' + f : '');
}
const money = x => '$' + num(x, isInt(x) ? 0 : 2);
const pct = x => num(x) + '%';
function mixed(x){          // 12/5 → "2 2/5"
  x = qn(x);
  if (x.d === 1 || Math.abs(x.n) < x.d) return x.toString();
  const w = Math.trunc(x.n / x.d), r = Math.abs(x.n - w * x.d);
  return num(w) + ' ' + r + '/' + x.d;
}
const hrs = x => { const s = mixed(x); return s + (+x === 1 ? ' hour' : ' hours'); };
const signed = n => n < 0 ? '− ' + num(-n) : '+ ' + num(n);          // "+ 5" / "− 5" inside an expression
const term = (c, v) => (c === 1 ? '' : c === -1 ? '−' : num(c)) + v;   // 1x → x, −1x → −x
const list = a => a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
const sup = (b, e) => e === 1 ? String(b) : `${b}^{${e}}`;
const factorText = f => Object.entries(f).map(([p, e]) => sup(p, e)).join(' × ');
const LETTER = 'ABCDE';
const par = n => n < 0 ? `(${num(n)})` : num(n);                     // −5 → (−5) after an operator
const ord = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');

/* ------------------------------------------------------------------ five choices from one right answer and named mistakes
   wrong: [value, why, type, label?]; the label is what the option shows when it is not the formatted value. */
function mc(R, correct, wrong, o){
  const fmt = o.fmt || num;
  const valid = v => v != null && (typeof v === 'string' || (isFinite(+v) && (!o.positive || +v > 0) && (!o.nonneg || +v >= 0) && (!o.integer || isInt(+v))));
  const opts = [];
  const add = (v, d, label) => {
    if (!valid(v)) return;
    const s = label || fmt(v);
    if (!s || /NaN|undefined|Infinity|null/.test(s)) return;
    if (opts.some(x => x.s === s || (typeof v !== 'string' && typeof x.v !== 'string' && Math.abs(+x.v - +v) < 1e-9))) return;
    opts.push({ v, s, d });
  };
  add(correct, null, o.label);
  need(opts.length === 1);
  for (const [v, why, type, label] of wrong){ if (opts.length < 5) add(v, { why, type }, label); }
  if (opts.length < 5 && typeof correct !== 'string'){
    const v = +correct, fill = [];
    if (correct instanceof Frac) for (const k of [1, -1, 2, -2, 3, -3, 4, 5]) fill.push(Q(correct.n + k, correct.d));
    else {
      const int = isInt(v) && (o.integer || isInt(v));
      const step = o.step || (int ? Math.max(1, Math.round(Math.abs(v) / 12)) : Math.pow(10, Math.floor(Math.log10(Math.abs(v) || 1)) - 1));
      for (const k of [1, -1, 2, -2, 3, -3, 4, 5, 6]) fill.push(int ? v + k * step : round(v + k * step, 6));
    }
    for (const v2 of fill) if (opts.length < 5) add(v2, { why: o.fillWhy || 'No correct method leads to this value: it comes from an arithmetic slip. Redo each step and check the result against the question.', type: 'Calculation' });
  }
  need(opts.length === 5);
  const numeric = opts.every(x => typeof x.v !== 'string');
  const list = o.order === 'shuffle' || !numeric ? R.shuffle(opts) : opts.slice().sort((a, b) => +a.v - +b.v);
  return {
    choices: list.map(x => x.s),
    answer: list.findIndex(x => x.d === null),
    diagnosis: list.map(x => x.d),
    solution: list.map((x, i) => `(${LETTER[i]}) ${x.s}: ${x.d ? x.d.why : 'the right answer.'}`).join(' '),
  };
}
/* A Problem Solving question from its parts. */
function ps(R, o){
  const m = R.mc(o.answer, o.wrong, o);
  const q = { type: 'PS', stem: o.stem, choices: m.choices, answer: m.answer, diagnosis: m.diagnosis, solution: m.solution,
    hints: o.hints, method: o.method, trap: o.trap, subtopic: o.sub, skill: o.skill };
  if (o.alt) q.altMethod = o.alt;
  return q;
}

/* ------------------------------------------------------------------ templates */
const TPL = [];
const T = t => { TPL.push(t); };

/* ================================================================== QUANT */
/* ---------------- Integers & divisibility */
const multiplesIn = (A, B, k) => Math.floor(B / k) - Math.floor((A - 1) / k);
T({ id: 'divcount', topic: 'Integers & divisibility', levels: [2, 5], make(L, R){
  const A = R.int(L <= 2 ? 2 : 12, L <= 2 ? 30 : 180), B = A + R.int(L <= 2 ? 60 : 180, L <= 2 ? 160 : 800);
  const f = k => multiplesIn(A, B, k);
  const hints = k => [
    'Would (last − first) ÷ divisor always give the count? Try multiples of 3 from 1 to 10 and from 10 to 19.',
    `Count the multiples up to ${num(B)}, then take away the ones below ${num(A)}.`,
    'Key idea: from 1 to N there are exactly “whole part of N ÷ k” multiples of k.',
    `Start with ${num(B)} ÷ ${k}: its whole part is ${Math.floor(B / k)}.`];
  if (L <= 3){
    const k = R.pick(L <= 2 ? [3, 4, 5, 6, 7] : [6, 7, 8, 9, 11, 12, 13, 14]);
    const n = f(k), first = Math.ceil(A / k) * k, last = Math.floor(B / k) * k;
    return ps(R, { stem: `How many integers from ${num(A)} to ${num(B)}, inclusive, are multiples of ${k}?`, answer: n,
      wrong: [
        [Math.floor((B - A) / k), `Dividing the width of the range, (${num(B)} − ${num(A)}) ÷ ${k}, does not count multiples: the count depends on where the range starts and ends.`, 'Procedural'],
        [Math.floor(B / k), `${Math.floor(B / k)} counts every multiple of ${k} from 1 to ${num(B)}; the ones below ${num(A)} must come out.`, 'Reading'],
        [n + 1, `One too many: the first multiple in the range is ${num(first)} and the last is ${num(last)}, so the count is (${num(last)} − ${num(first)}) ÷ ${k} + 1 = ${n}.`, 'Careless'],
        [n - 1, `One too few: (last − first) ÷ ${k} counts the gaps between multiples; add 1 to count the multiples themselves.`, 'Careless'],
      ], hints: hints(k), sub: 'Multiples in a range', skill: 'Counting multiples',
      method: `Multiples of ${k} from 1 to ${num(B)}: ${Math.floor(B / k)}. From 1 to ${num(A - 1)}: ${Math.floor((A - 1) / k)}. In the range: ${Math.floor(B / k)} − ${Math.floor((A - 1) / k)} = ${n}.`,
      alt: `First multiple ${num(first)}, last ${num(last)}: (${num(last)} − ${num(first)}) ÷ ${k} + 1 = ${n}.`,
      trap: `Dividing the width of the range by ${k} can be off by one either way.` });
  }
  const [p, q] = R.pick([[4, 6], [6, 9], [4, 10], [6, 10], [6, 15], [8, 12], [3, 5], [4, 7], [5, 7], [9, 12], [10, 15], [6, 8]]);
  const l = lcm(p, q);
  if (L === 4){
    const n = f(p) + f(q) - f(l);
    return ps(R, { stem: `How many integers from ${num(A)} to ${num(B)}, inclusive, are multiples of ${p} or ${q} (or both)?`, answer: n,
      wrong: [
        [f(p) + f(q), `Adding ${f(p)} and ${f(q)} counts the multiples of both ${p} and ${q} twice; subtract them once.`, 'Trap'],
        [l !== p * q ? f(p) + f(q) - f(p * q) : null, `The numbers divisible by both ${p} and ${q} are the multiples of their LCM, ${l}, not of the product ${p * q}.`, 'Conceptual'],
        [f(p) + f(q) - 2 * f(l), `Subtracting the common multiples twice removes them completely: that counts the numbers divisible by exactly one of the two.`, 'Procedural'],
        [f(l), `${f(l)} is the number of multiples of both, not of either.`, 'Interpretation'],
      ], hints: [
        'Count each set separately first. What happens to numbers that are multiples of both?',
        `Numbers divisible by both ${p} and ${q} are the multiples of a single number. Which one?`,
        'Key idea: |A or B| = |A| + |B| − |A and B|, and “divisible by both” means “divisible by the LCM”.',
        `Multiples of ${p} in the range: ${f(p)}. Now do ${q} and LCM(${p}, ${q}) = ${l}.`],
      method: `Multiples of ${p}: ${f(p)}. Of ${q}: ${f(q)}. Of both (LCM ${l}): ${f(l)}. Either: ${f(p)} + ${f(q)} − ${f(l)} = ${n}.`,
      trap: `Using ${p} × ${q} = ${p * q} for “both” when the LCM is ${l}${l === p * q ? ' (here they happen to agree)' : ''}, or forgetting to subtract the overlap.`,
      sub: 'Inclusion–exclusion on multiples', skill: 'Union of multiples' });
  }
  const n = f(p) - f(l);
  return ps(R, { stem: `How many integers from ${num(A)} to ${num(B)}, inclusive, are divisible by ${p} but not by ${q}?`, answer: n,
    wrong: [
      [f(p) - f(q), `Subtracting all ${f(q)} multiples of ${q} removes numbers that were never multiples of ${p}. Remove only the multiples of both, the multiples of ${l}.`, 'Trap'],
      [l !== p * q ? f(p) - f(p * q) : null, `The numbers divisible by both are the multiples of LCM(${p}, ${q}) = ${l}, not of ${p * q}.`, 'Conceptual'],
      [f(p) + f(q) - 2 * f(l), `That counts numbers divisible by exactly one of ${p} and ${q}, including multiples of ${q} that are not multiples of ${p}.`, 'Interpretation'],
      [f(p), `${f(p)} is every multiple of ${p}; the ones also divisible by ${q} must come out.`, 'Reading'],
    ], hints: [
      `Start with all multiples of ${p}. Which of them must you throw away?`,
      `A multiple of ${p} that is also divisible by ${q} is a multiple of which number?`,
      'Key idea: “divisible by p but not q” = multiples of p − multiples of LCM(p, q).',
      `LCM(${p}, ${q}) = ${l}. Count the multiples of ${p} and of ${l} in the range.`],
    method: `Multiples of ${p}: ${f(p)}. Multiples of LCM ${l}: ${f(l)}. Answer: ${f(p)} − ${f(l)} = ${n}.`,
    trap: `Subtracting every multiple of ${q}, including those that are not multiples of ${p}.`,
    sub: 'Excluding a divisor', skill: 'Set difference on multiples' });
} });

T({ id: 'gcdlcm', topic: 'Integers & divisibility', levels: [3, 5], make(L, R){
  if (L === 3){
    const [a, b, c] = R.sample([4, 6, 8, 9, 10, 12, 14, 15, 16, 18, 20, 21, 24, 28, 30], 3).sort((x, y) => x - y);
    const l = lcm(lcm(a, b), c);
    need(l <= 2520 && l !== a * b * c && l !== c);
    return ps(R, { stem: `What is the least positive integer that is divisible by each of ${a}, ${b} and ${c}?`, answer: l,
      wrong: [
        [a * b * c, `${a} × ${b} × ${c} = ${num(a * b * c)} is divisible by all three, but shared prime factors are counted more than once, so it is not the least.`, 'Trap'],
        [lcm(a, b), `${lcm(a, b)} is the LCM of ${a} and ${b} only; it is not divisible by ${c}.`, 'Careless'],
        [2 * l, `${num(2 * l)} is a common multiple, but not the least: ${num(l)} also works.`, 'Conceptual'],
        [l / 2, `${num(l / 2)} is not divisible by all three: check it against each number.`, 'Calculation'],
      ], hints: [
        'Multiplying the three numbers gives a common multiple. Is it the smallest?',
        'Write each number as a product of primes.',
        'Key idea: the LCM takes every prime at its highest power in any of the numbers.',
        `${a} = ${factorText(factorize(a))}, ${b} = ${factorText(factorize(b))}, ${c} = ${factorText(factorize(c))}.`],
      method: `Highest powers: ${factorText(factorize(l))} = ${num(l)}.`, trap: 'Multiplying the numbers counts shared factors twice.',
      sub: 'LCM of three numbers', skill: 'Prime-power LCM' });
  }
  if (L === 4){
    const g = R.int(2, 9); const [u, v] = R.sample([2, 3, 4, 5, 7, 8, 9, 11], 2); need(gcd(u, v) === 1);
    const m = g * u, n = g * v, l = g * u * v;
    return ps(R, { stem: `The greatest common divisor of the positive integers m and n is ${g}, and their least common multiple is ${num(l)}. If m = ${m}, what is n?`, answer: n,
      wrong: [
        [v, `${num(l)} ÷ ${m} = ${v} is n ÷ ${g}, not n: the GCD has to go back in.`, 'Procedural'],
        [u * v, `${num(l)} ÷ ${g} = ${u * v} is the product of the parts the two numbers do not share, not n.`, 'Procedural'],
        [l, `The LCM is a multiple of n, not n itself.`, 'Conceptual'],
        [g * u * u * v, `m × LCM ÷ GCD turns the formula upside down: m × n = GCD × LCM, so n = GCD × LCM ÷ m.`, 'Procedural'],
      ], hints: [
        'Is there a relation between m, n, their GCD and their LCM?',
        'Try it on 4 and 6: GCD 2, LCM 12. Compare 4 × 6 with 2 × 12.',
        'Key idea: m × n = GCD(m, n) × LCM(m, n) for any two positive integers.',
        `So ${m} × n = ${g} × ${num(l)}.`],
      method: `m × n = GCD × LCM → n = ${g} × ${num(l)} ÷ ${m} = ${n}. Check: GCD(${m}, ${n}) = ${g}, LCM = ${num(l)}.`,
      trap: 'Dividing the LCM by m gives n ÷ GCD, not n.', sub: 'GCD × LCM = product', skill: 'GCD–LCM identity' });
  }
  const [a, b, c] = R.sample([4, 6, 8, 9, 10, 12, 15, 18, 20], 3), l = lcm(lcm(a, b), c), H = R.int(3, 12);
  const n = Math.floor(60 * H / l);
  need(n >= 2 && l !== a * b * c);
  return ps(R, { stem: `Three bells ring every ${a}, ${b} and ${c} minutes. They ring together at 8:00 a.m. How many more times do all three ring together in the ${H} hours after 8:00 a.m., up to and including ${8 + H > 12 ? 8 + H - 12 : 8 + H}:00 ${8 + H >= 12 ? 'p.m.' : 'a.m.'}?`, answer: n,
    wrong: [
      [n + 1, `Counting the ring at 8:00 a.m. itself: the question asks how many more times.`, 'Reading'],
      [Math.floor(60 * H / (a * b * c)), `The bells meet every LCM(${a}, ${b}, ${c}) = ${l} minutes, not every ${a * b * c} minutes.`, 'Trap'],
      [Math.floor(60 * H / lcm(a, b)), `Every ${lcm(a, b)} minutes only the first two bells ring together.`, 'Careless'],
      [Math.floor(H * 60 / (a + b + c)), `Adding the intervals has no meaning here: the bells meet at common multiples of the intervals.`, 'Conceptual'],
    ], hints: [
      'When do two bells that ring every 4 and 6 minutes ring together again?',
      'All three ring together at every common multiple of the three intervals.',
      'Key idea: the time between joint rings is the LCM of the intervals.',
      `LCM(${a}, ${b}, ${c}) = ${l} minutes. How many of those fit in ${H * 60} minutes?`],
    method: `LCM = ${l} minutes. ${H * 60} ÷ ${l} → ${n} joint rings after 8:00.`,
    trap: 'Using the product of the intervals, or counting the 8:00 ring.', sub: 'Repeating events', skill: 'LCM in word problems' });
} });

T({ id: 'consec', topic: 'Integers & divisibility', levels: [3, 5], make(L, R){
  const step = L === 5 ? R.pick([2, 3, 5]) : 1;
  const k = L === 3 ? R.pick([5, 7, 9, 11]) : L === 4 ? R.pick([6, 8, 10, 12]) : R.int(5, 9);
  let first = R.int(-12, 60); if (step > 1) first = step * R.int(-4, 20);
  const S = k * first + step * k * (k - 1) / 2, last = first + step * (k - 1);
  const kind = step === 1 ? 'consecutive integers' : step === 2 ? 'consecutive even integers' : `consecutive multiples of ${step}`;
  return ps(R, { stem: `The sum of ${k} ${kind} is ${num(S)}. What is the greatest of these integers?`, answer: last,
    wrong: [
      [first, `${num(first)} is the least of the ${k} integers, not the greatest.`, 'Interpretation'],
      [S / k, `${num(S / k)} is the average, which sits in the middle of the list, not at the top.`, 'Procedural'],
      [first + step * k, `The greatest is the first plus ${k - 1} steps, not ${k}: ${num(first + step * k)} is one step too far.`, 'Careless'],
      [last - step, `One step short: the list has ${k} terms, from ${num(first)} to ${num(last)}.`, 'Careless'],
    ], hints: [
      'In an evenly spaced list, where does the average sit?',
      `The average of the ${k} numbers is ${num(S)} ÷ ${k}.`,
      'Key idea: in an evenly spaced list, average = (least + greatest) ÷ 2 = the middle.',
      `Average ${num(S / k)}; the greatest is ${(k - 1) / 2} steps of ${step} above it.`],
    method: `Average = ${num(S)} ÷ ${k} = ${num(S / k)}. The list runs from ${num(first)} to ${num(last)} (step ${step}); the greatest is ${num(last)}.`,
    alt: `Let the least be x: ${k}x + ${num(step * k * (k - 1) / 2)} = ${num(S)} → x = ${num(first)}, greatest x + ${step * (k - 1)} = ${num(last)}.`,
    integer: true, trap: k % 2 === 0 ? `With an even number of terms the average (${num(S / k)}) is not one of the integers.` : 'Stopping at the average, which is the middle term.',
    sub: 'Consecutive integers', skill: 'Evenly spaced sets' });
} });

/* ---------------- Primes & factors */
T({ id: 'divisors', topic: 'Primes & factors', levels: [2, 4], make(L, R){
  if (L <= 3){
    const ps_ = R.sample([2, 3, 5, 7], L === 2 ? 2 : 3).sort((a, b) => a - b);
    const ex = ps_.map(() => R.int(1, L === 2 ? 3 : 3));
    const N = ps_.reduce((s, p, i) => s * Math.pow(p, ex[i]), 1); need(N <= 3000 && N >= 24);
    const f = {}; ps_.forEach((p, i) => f[p] = ex[i]);
    const n = ex.reduce((s, e) => s * (e + 1), 1);
    return ps(R, { stem: `How many positive divisors does ${num(N)} have?`, answer: n,
      wrong: [
        [ex.reduce((s, e) => s * e, 1), `Multiplying the exponents (${ex.join(' × ')}) leaves out the choice of power 0 for each prime.`, 'Procedural'],
        [sum(ex.map(e => e + 1)), `Adding (exponent + 1) for each prime: the choices for different primes combine by multiplication.`, 'Conceptual'],
        [n - 2, `The count includes 1 and ${num(N)} itself; both are positive divisors.`, 'Interpretation'],
        [sum(ex), `The sum of the exponents counts prime factors with repetition, not divisors.`, 'Conceptual'],
      ], hints: [
        'Listing divisors in pairs works, but is slow and easy to get wrong. Is there a formula?',
        `Write ${num(N)} as a product of prime powers.`,
        'Key idea: if N = p^{a} × q^{b} × …, the number of positive divisors is (a + 1)(b + 1)…',
        `${num(N)} = ${factorText(f)}.`],
      method: `${num(N)} = ${factorText(f)} → ${ex.map(e => `(${e} + 1)`).join('')} = ${n} divisors.`,
      trap: 'Forgetting the +1 (the power 0 of each prime), or leaving out 1 and N.', sub: 'Number of divisors', skill: 'Divisor-count formula' });
  }
  const a = R.pick([6, 10, 12, 14, 15, 18, 20, 21, 28, 45, 50]), k = R.int(2, 5), f = factorize(a);
  const n = Object.values(f).reduce((s, e) => s * (e * k + 1), 1), da = Object.values(f).reduce((s, e) => s * (e + 1), 1);
  const fk = {}; for (const p in f) fk[p] = f[p] * k;
  return ps(R, { stem: `How many positive divisors does ${a}^{${k}} have?`, answer: n,
    wrong: [
      [Math.pow(da, k), `${a} has ${da} divisors, but the divisors of ${a}^{${k}} are not ${da}^{${k}}: redo the count from the prime powers of ${a}^{${k}}.`, 'Trap'],
      [da * k, `Multiplying the divisor count of ${a} by ${k} does not follow from any rule.`, 'Procedural'],
      [Object.values(fk).reduce((s, e) => s * e, 1), `Multiplying the exponents of ${factorText(fk)} forgets the +1 for each prime.`, 'Procedural'],
      [k + 1, `${k} + 1 treats ${a} as if it were prime.`, 'Conceptual'],
    ], hints: [
      `Is ${a} prime? If not, what are its prime factors?`,
      `Write ${a} as a product of primes, then raise each power to the ${k}th.`,
      'Key idea: number of divisors = product of (exponent + 1) over the prime factorization.',
      `${a}^{${k}} = ${factorText(fk)}.`],
    method: `${a}^{${k}} = ${factorText(fk)} → ${Object.values(fk).map(e => `(${e} + 1)`).join('')} = ${n}.`,
    trap: `Raising the divisor count of ${a} to the power ${k}.`, sub: 'Divisors of a power', skill: 'Prime factorization of powers' });
} });

T({ id: 'sqdiv', topic: 'Primes & factors', levels: [5, 6], make(L, R){
  const ps_ = [2, 3, 5, 7].slice(0, R.int(2, 3)), ex = ps_.map(() => R.int(1, 6)), f = {};
  ps_.forEach((p, i) => f[p] = ex[i]);
  const N = ps_.reduce((s, p, i) => s * Math.pow(p, ex[i]), 1), total = ex.reduce((s, e) => s * (e + 1), 1);
  const shown = N <= 50000 && L === 5 ? num(N) : factorText(f);
  if (R.chance(0.5)){
    const n = ex.reduce((s, e) => s * (Math.floor(e / 2) + 1), 1);
    return ps(R, { stem: `How many of the positive divisors of ${shown} are perfect squares?`, answer: n,
      wrong: [
        [Math.floor(total / 2), `About half the divisors being squares is a guess; squares are the divisors with every exponent even.`, 'Trap'],
        [ex.reduce((s, e) => s * Math.floor(e / 2), 1), `Leaving out the exponent 0 for each prime drops divisors such as 1, which is a perfect square.`, 'Procedural'],
        [total, `${total} is the number of all divisors, not just the perfect squares.`, 'Reading'],
        [ex.reduce((s, e) => s * Math.ceil(e / 2), 1), `Counting ⌈e/2⌉ even exponents for each prime misses one: the even exponents from 0 to e number ⌊e/2⌋ + 1.`, 'Calculation'],
      ], hints: [
        'What does the prime factorization of a perfect square look like?',
        `A divisor of N has the form ${ps_.map((p, i) => `${p}^{${'abc'[i]}}`).join(' × ')} with each exponent at most N’s exponent.`,
        'Key idea: a number is a perfect square exactly when every exponent in its factorization is even (0 counts).',
        `For the prime ${ps_[0]}, the even exponents from 0 to ${ex[0]} are ${Array.from({ length: Math.floor(ex[0] / 2) + 1 }, (_, i) => 2 * i).join(', ')}.`],
      method: `N = ${factorText(f)}. Even exponents per prime: ${ex.map(e => Math.floor(e / 2) + 1).join(' × ')} = ${n}.`,
      trap: 'Forgetting that exponent 0 is even, so 1 is a perfect-square divisor.', sub: 'Square divisors', skill: 'Exponent parity in divisors' });
  }
  need(ps_[0] === 2);
  const odd = ex.slice(1).reduce((s, e) => s * (e + 1), 1), n = total - odd;
  return ps(R, { stem: `How many of the positive divisors of ${shown} are even?`, answer: n,
    wrong: [
      [Math.floor(total / 2), `Half the divisors are even only when 2 appears exactly once; here it appears ${ex[0]} time${ex[0] > 1 ? 's' : ''}.`, 'Trap'],
      [odd, `${odd} is the number of odd divisors (exponent of 2 equal to 0).`, 'Interpretation'],
      [total, `${total} counts all divisors, odd ones included.`, 'Reading'],
      [(ex[0] - 1) * odd, `An even divisor can use 2^{1} up to 2^{${ex[0]}}: that is ${ex[0]} choices, not ${ex[0] - 1}.`, 'Calculation'],
    ], hints: [
      'Which divisors are odd? Can you count them first?',
      'An even divisor must contain at least one factor 2.',
      'Key idea: even divisors = all divisors − odd divisors, and odd divisors use 2^{0} only.',
      `All divisors: ${ex.map(e => e + 1).join(' × ')} = ${total}.`],
    method: `All: ${total}. Odd (power of 2 is 0): ${ex.slice(1).map(e => e + 1).join(' × ')} = ${odd}. Even: ${total} − ${odd} = ${n}.`,
    alt: `Directly: ${ex[0]} choices for the power of 2 (1 to ${ex[0]}) × ${odd} = ${n}.`,
    trap: 'Assuming half of the divisors are even.', sub: 'Even divisors', skill: 'Counting with constraints on divisors' });
} });

T({ id: 'zeros', topic: 'Primes & factors', levels: [3, 6], make(L, R){
  if (L === 3){
    const n = R.int(25, 99), z = legendre(n, 5);
    return ps(R, { stem: `How many zeros are at the end of ${n}! when it is written out in full? (n! is the product of the integers from 1 to n.)`, answer: z,
      wrong: [
        [Math.floor(n / 5), `Counting only the multiples of 5 misses the extra factor 5 in ${[25, 50, 75].filter(x => x <= n).join(', ')}.`, 'Trap'],
        [Math.floor(n / 10), `Zeros come from pairs 2 × 5, not only from multiples of 10.`, 'Conceptual'],
        [legendre(n, 2), `That is the number of factors 2. Each zero needs a 2 and a 5, and the 5s run out first.`, 'Conceptual'],
        [z + 1, `One too many: count the factors 5 once more, number by number.`, 'Careless'],
      ], hints: [
        'Where does each zero at the end of a number come from?',
        'Every trailing zero is a factor 10 = 2 × 5. Which prime is scarcer in n!?',
        'Key idea: the number of 5s in n! is ⌊n/5⌋ + ⌊n/25⌋ + ⌊n/125⌋ + …',
        `⌊${n}/5⌋ = ${Math.floor(n / 5)}. Now add ⌊${n}/25⌋.`],
      method: `Factors of 5: ⌊${n}/5⌋ + ⌊${n}/25⌋ = ${Math.floor(n / 5)} + ${Math.floor(n / 25)} = ${z}. There are more than enough 2s, so ${z} zeros.`,
      trap: 'Forgetting that 25, 50 and 75 each carry two factors of 5.', sub: 'Trailing zeros of n!', skill: 'Legendre’s formula' });
  }
  if (L <= 5){
    const p = R.pick([2, 3, 7]), n = R.int(p === 7 ? 50 : 20, p === 2 ? 40 : 70), v = legendre(n, p);
    need(n >= p * p);
    return ps(R, { stem: `What is the greatest integer k such that ${p}^{k} is a factor of ${n}!?`, answer: v,
      wrong: [
        [Math.floor(n / p), `⌊${n}/${p}⌋ counts the multiples of ${p} but not the extra factors in multiples of ${p * p}${p * p * p <= n ? ` and ${p * p * p}` : ''}.`, 'Trap'],
        [Math.floor(n / (p * p)), `⌊${n}/${p * p}⌋ is only the second term of the count.`, 'Procedural'],
        [v + 1, `One factor too many: add the terms ⌊${n}/${p}⌋ + ⌊${n}/${p * p}⌋ + … again.`, 'Careless'],
        [v - 1, `One factor short: add ⌊${n}/${p}⌋ + ⌊${n}/${p * p}⌋ + … again.`, 'Careless'],
      ], hints: [
        `Which of the numbers 1 to ${n} contribute a factor ${p}? Do some contribute more than one?`,
        `Multiples of ${p * p} give two factors of ${p}.`,
        `Key idea: the exponent of ${p} in n! is ⌊n/${p}⌋ + ⌊n/${p * p}⌋ + ⌊n/${p * p * p}⌋ + …`,
        `⌊${n}/${p}⌋ = ${Math.floor(n / p)}.`],
      method: `${[p, p * p, p * p * p, p ** 4, p ** 5].filter(q => q <= n).map(q => `⌊${n}/${q}⌋`).join(' + ')} = ${[p, p * p, p * p * p, p ** 4, p ** 5].filter(q => q <= n).map(q => Math.floor(n / q)).join(' + ')} = ${v}.`,
      trap: `Counting multiples of ${p} only once each.`, sub: 'Prime powers in n!', skill: 'Legendre’s formula' });
  }
  const b = R.pick([12, 18, 20, 24, 45, 36, 75]), n = R.int(15, 45), f = factorize(b);
  const per = Object.entries(f).map(([p, e]) => ({ p: +p, e, v: legendre(n, +p), k: Math.floor(legendre(n, +p) / e) }));
  const k = Math.min(...per.map(x => x.k)), lim = per.find(x => x.k === k), other = per.find(x => x.k !== k);
  need(other);
  return ps(R, { stem: `What is the greatest integer k such that ${b}^{k} is a factor of ${n}!?`, answer: k,
    wrong: [
      [Math.floor(n / b), `⌊${n}/${b}⌋ counts multiples of ${b}, but factors of ${b} can be assembled from different numbers.`, 'Trap'],
      [Math.min(...per.map(x => x.v)), `${b} = ${factorText(f)}: each copy of ${b} uses ${lim.e} factor${lim.e > 1 ? 's' : ''} of ${lim.p}, so divide the count of ${lim.p}s by ${lim.e}.`, 'Conceptual'],
      [other.k, `${other.k} copies are possible for the prime ${other.p}, but the prime ${lim.p} runs out first: only ${k}.`, 'Procedural'],
      [k + 1, `One copy too many: there are only ${lim.v} factors of ${lim.p}, enough for ${k} copies.`, 'Careless'],
    ], hints: [
      `Write ${b} as a product of primes.`,
      `For each prime of ${b}, count how many times it divides ${n}!.`,
      'Key idea: the limit is the prime that runs out first, after dividing by its exponent in the base.',
      `${b} = ${factorText(f)}. Count the ${per.map(x => x.p).join('s and the ')}s in ${n}!.`],
    method: `${b} = ${factorText(f)}. In ${n}!: ${per.map(x => `${x.v} factors of ${x.p} → ${x.v}/${x.e} → ${x.k}`).join('; ')}. The smaller is k = ${k}.`,
    trap: `Counting multiples of ${b}, or forgetting that ${lim.p} appears ${lim.e > 1 ? `${lim.e} times` : 'once'} in ${b}.`, sub: 'Composite powers in n!', skill: 'Limiting prime' });
} });

T({ id: 'sqmult', topic: 'Primes & factors', levels: [3, 5], make(L, R){
  const m = L === 5 ? 3 : 2, word = m === 2 ? 'the square of an integer' : 'the cube of an integer';
  const ps_ = R.sample([2, 3, 5, 7], R.int(2, 3)).sort((a, b) => a - b), f = {};
  for (const p of ps_) f[p] = R.int(1, m === 2 ? 4 : 5);
  const N = Object.entries(f).reduce((s, [p, e]) => s * Math.pow(p, e), 1); need(N >= 40 && N <= 20000);
  const k = Object.entries(f).reduce((s, [p, e]) => s * Math.pow(+p, (m - e % m) % m), 1); need(k > 1);
  const rad = ps_.reduce((s, p) => s * p, 1), rest = Object.entries(f).reduce((s, [p, e]) => s * Math.pow(+p, e % m), 1);
  return ps(R, { stem: `What is the least positive integer k such that ${num(N)}k is ${word}?`, answer: k,
    wrong: [
      [m === 2 ? N : N * N, m === 2 ? `k = ${num(N)} works (${num(N)} × ${num(N)} is a square), but it is not the least.` : `k = ${num(N)}² works (${num(N)}³ is a cube), but it is not the least.`, 'Conceptual'],
      [rad, `Multiplying by one of each prime (${ps_.join(' × ')}) does not make every exponent a multiple of ${m}.`, 'Trap'],
      [m === 3 ? rest : null, `${rest} is the part of ${num(N)} left over, not the part missing: each exponent must be raised to a multiple of 3.`, 'Procedural'],
      [k * ps_[0], `${num(k * ps_[0])} works too, but the extra factor ${ps_[0]} is not needed.`, 'Careless'],
    ], hints: [
      `What does the prime factorization of ${word.replace('the ', 'a ')} look like?`,
      `Factor ${num(N)} into primes.`,
      `Key idea: in ${m === 2 ? 'a perfect square every exponent is even' : 'a perfect cube every exponent is a multiple of 3'}. k supplies only what is missing.`,
      `${num(N)} = ${factorText(f)}.`],
    method: `${num(N)} = ${factorText(f)}. Raise each exponent to the next multiple of ${m}: k = ${((ft) => ft === String(k) ? ft : ft + ' = ' + num(k))(factorText(Object.fromEntries(Object.entries(f).map(([p, e]) => [p, (m - e % m) % m]).filter(x => x[1]))))}.`,
    trap: 'Multiplying by one copy of each prime, or by the number itself.', sub: `Making a perfect ${m === 2 ? 'square' : 'cube'}`, skill: 'Exponents in prime factorization' });
} });

/* ---------------- Remainders */
T({ id: 'rem2', topic: 'Remainders', levels: [2, 4], make(L, R){
  const b = R.int(3, 9), mlt = R.int(2, 6), A = b * mlt, r = R.int(b, A - 1); need(r % b !== 0 || L >= 4);
  if (L <= 3){
    const ans = r % b;
    return ps(R, { stem: `When the positive integer n is divided by ${A}, the remainder is ${r}. What is the remainder when n is divided by ${b}?`, answer: ans,
      wrong: [
        [r, `A remainder must be smaller than the divisor: ${r} is not a possible remainder when dividing by ${b}.`, 'Procedural'],
        [b - ans, `${b - ans} is how far n is from the next multiple of ${b}, not the remainder.`, 'Conceptual'],
        [Math.floor(r / b), `${Math.floor(r / b)} is the quotient of ${r} ÷ ${b}, not the remainder.`, 'Procedural'],
        [r % mlt, `Dividing ${r} by ${mlt} instead of ${b} answers a different question.`, 'Careless'],
      ], nonneg: true, hints: [
        'Pick a number that fits: the smallest is n = ' + r + '. What is its remainder when divided by ' + b + '?',
        `Every n that fits is ${A}q + ${r} for some whole q.`,
        `Key idea: ${A} is a multiple of ${b}, so ${A}q leaves no remainder when divided by ${b}; only ${r} matters.`,
        `Divide ${r} by ${b}.`],
      method: `n = ${A}q + ${r}. ${A}q is divisible by ${b}, and ${r} = ${b} × ${Math.floor(r / b)} + ${ans}, so the remainder is ${ans}.`,
      alt: `Test values: n = ${r} and n = ${r + A} both leave ${ans}.`, trap: `Answering ${r}, which is larger than ${b}.`, sub: 'Remainder with a divisor of the divisor', skill: 'Reducing remainders' });
  }
  const k = R.int(2, 5), c = R.int(1, 9), ans = mod(k * r + c, b);
  return ps(R, { stem: `When the positive integer n is divided by ${A}, the remainder is ${r}. What is the remainder when ${k}n + ${c} is divided by ${b}?`, answer: ans,
    wrong: [
      [k * r + c, `${k * r + c} is larger than ${b}: reduce it to a remainder.`, 'Procedural'],
      [mod(r + c, b), `Forgetting to multiply the remainder by ${k}.`, 'Careless'],
      [mod(k * r, b), `Forgetting to add ${c}.`, 'Careless'],
      [mod(k * r + c, A), `${mod(k * r + c, A)} is the remainder when dividing by ${A}, not by ${b}.`, 'Reading'],
    ], nonneg: true, hints: [
      `Try the smallest n that fits: n = ${r}. What is ${k}n + ${c}?`,
      `In general n = ${A}q + ${r}, so ${k}n + ${c} = ${k * A}q + ${k * r + c}.`,
      `Key idea: remainders can be multiplied and added, then reduced at the end, as long as the divisor divides ${A}.`,
      `Divide ${k * r + c} by ${b}.`],
    method: `${k}n + ${c} = ${k * A}q + ${k * r + c}; ${k * A}q is a multiple of ${b}, and ${k * r + c} = ${b} × ${Math.floor((k * r + c) / b)} + ${ans}. Remainder ${ans}.`,
    trap: 'Stopping before reducing the result below the divisor.', sub: 'Remainder of an expression', skill: 'Remainder arithmetic' });
} });

T({ id: 'crt', topic: 'Remainders', levels: [4, 6], make(L, R){
  const [a, b] = R.sample([3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 2).sort((x, y) => x - y), n0 = R.int(8, 150);
  const r1 = n0 % a, r2 = n0 % b, Lm = lcm(a, b), fits = n => n % a === r1 && n % b === r2;
  let s = 1; while (!fits(s)) s++;
  need(s !== r1 && s !== r2 && s > Math.max(a, b));
  const cond = `leaves a remainder of ${r1} when divided by ${a} and a remainder of ${r2} when divided by ${b}`;
  if (L <= 5){
    let only1 = r1 || a; while (fits(only1)) only1 += a;
    let only2 = r2 || b; while (fits(only2)) only2 += b;
    return ps(R, { stem: `What is the least positive integer that ${cond}?`, answer: s,
      wrong: [
        [s + Lm, `${s + Lm} fits both conditions, but it is the second such number: ${s} is smaller.`, 'Careless'],
        [only1, `${only1} leaves ${r1} when divided by ${a}, but ${only1 % b} (not ${r2}) when divided by ${b}.`, 'Reading'],
        [only2, `${only2} leaves ${r2} when divided by ${b}, but ${only2 % a} (not ${r1}) when divided by ${a}.`, 'Reading'],
        [r1 !== r2 ? Lm + r1 : a * b + r1, `LCM + remainder works only when both remainders are equal; here they are ${r1} and ${r2}.`, 'Trap'],
      ], positive: true, hints: [
        `List the numbers that leave ${r1} when divided by ${a}: ${r1 || a}, ${(r1 || a) + a}, ${(r1 || a) + 2 * a}, …`,
        `Check each one against the second condition.`,
        `Key idea: solutions repeat every LCM(${a}, ${b}) = ${Lm}, so the first match below ${Lm + 1} is the least.`,
        `Divide each listed number by ${b} and look for remainder ${r2}.`],
      method: `Numbers ≡ ${r1} (mod ${a}): ${[0, 1, 2, 3, 4].map(i => (r1 || a) + i * a).join(', ')}, … The first that leaves ${r2} when divided by ${b} is ${s}.`,
      trap: 'Adding a remainder to the LCM when the two remainders differ.', sub: 'Two remainder conditions', skill: 'Listing and matching' });
  }
  const X = R.int(150, 400), cnt = Math.floor((X - 1 - s) / Lm) + 1;
  return ps(R, { stem: `How many positive integers less than ${X} ${cond.replace('leaves', 'leave')}?`, answer: cnt,
    wrong: [
      [cnt + 1, `The last candidate, ${s + cnt * Lm}, is not less than ${X}.`, 'Careless'],
      [cnt - 1, `The first solution, ${s}, counts too: solutions are ${s}, ${s + Lm}, …, ${s + (cnt - 1) * Lm}.`, 'Careless'],
      [Lm !== a * b ? Math.floor((X - 1 - s) / (a * b)) + 1 : null, `Solutions repeat every LCM(${a}, ${b}) = ${Lm}, not every ${a * b}.`, 'Conceptual'],
      [Math.floor(X / a), `${Math.floor(X / a)} counts numbers that meet only the first condition.`, 'Reading'],
    ], positive: true, hints: [
      'Find the smallest positive integer that meets both conditions.',
      'How far apart are consecutive solutions?',
      `Key idea: solutions form an evenly spaced list with gap LCM(${a}, ${b}) = ${Lm}.`,
      `The smallest solution is ${s}.`],
    method: `Smallest ${s}; gap ${Lm}. Solutions below ${X}: ${s}, ${s + Lm}, …, ${s + (cnt - 1) * Lm} → (${s + (cnt - 1) * Lm} − ${s}) ÷ ${Lm} + 1 = ${cnt}.`,
    trap: 'Using the product of the divisors as the gap when they share a factor.', sub: 'Counting solutions', skill: 'Periodic solutions' });
} });

T({ id: 'units', topic: 'Remainders', levels: [3, 5], make(L, R){
  const cyc = a => { const c = []; let x = a % 10; do { c.push(x); x = x * (a % 10) % 10; } while (x !== c[0]); return c; };
  const ud = (a, n) => powmod(a, n, 10);
  const a = R.pick([2, 3, 7, 8, 12, 13, 17, 18, 22, 23, 27, 33, 37, 43]), n = R.int(21, 99);
  const hint4 = `The units digits of powers of ${a} repeat: ${cyc(a).join(', ')}, …`;
  if (L === 3){
    need(n % 4 === 0 || R.chance(0.6));
    const ans = ud(a, n);
    return ps(R, { stem: `What is the units digit of ${a}^{${n}}?`, answer: ans,
      wrong: [
        [n % 4 === 0 ? 1 : ud(a, (n % 4) + 1), n % 4 === 0 ? `A remainder of 0 when dividing ${n} by 4 means the last digit of the cycle, not ${a}^{0} = 1.` : `Off by one in the cycle: ${n} leaves remainder ${n % 4} when divided by 4, so take the ${n % 4}th digit of the cycle.`, n % 4 === 0 ? 'Trap' : 'Procedural'],
        [(a * n) % 10, `${a} × ${n} is multiplication; ${a}^{${n}} multiplies ${a} by itself ${n} times.`, 'Conceptual'],
        [a % 10, `${a % 10} is the units digit of ${a}, the first power only.`, 'Careless'],
        [ud(a, n + 2), `Recount the position in the cycle ${cyc(a).join(', ')} using ${n} ÷ 4.`, 'Calculation'],
      ], nonneg: true, hints: [
        `Compute the units digits of ${a}^{1}, ${a}^{2}, ${a}^{3}, ${a}^{4}. What do you notice?`,
        'Only the units digit matters at each step.', 'Key idea: units digits of powers repeat in a cycle of length 1, 2 or 4.', hint4],
      method: `Cycle ${cyc(a).join(', ')} (length ${cyc(a).length}). ${n} ÷ ${cyc(a).length} leaves ${n % cyc(a).length}${n % cyc(a).length === 0 ? ', the last place in the cycle' : ''} → units digit ${ans}.`,
      trap: 'Treating remainder 0 as the start of the cycle instead of its end.', sub: 'Units digit of a power', skill: 'Cyclicity' });
  }
  const b = R.pick([3, 4, 7, 8, 9, 13, 14, 19]), m = R.int(21, 99), op = L === 4 ? '+' : '×';
  const ans = op === '+' ? (ud(a, n) + ud(b, m)) % 10 : (ud(a, n) * ud(b, m)) % 10;
  const other = op === '+' ? (ud(a, n) * ud(b, m)) % 10 : (ud(a, n) + ud(b, m)) % 10;
  return ps(R, { stem: `What is the units digit of ${a}^{${n}} ${op} ${b}^{${m}}?`, answer: ans,
    wrong: [
      [other, `That combines the two units digits (${ud(a, n)} and ${ud(b, m)}) with ${op === '+' ? 'multiplication' : 'addition'} instead of ${op === '+' ? 'addition' : 'multiplication'}.`, 'Careless'],
      [op === '+' ? (ud(a, n + 1) + ud(b, m)) % 10 : (ud(a, n + 1) * ud(b, m)) % 10, `The first power is one step off in its cycle: ${a}^{${n}} ends in ${ud(a, n)}.`, 'Procedural'],
      [op === '+' ? (ud(a, n) + ud(b, m + 1)) % 10 : (ud(a, n) * ud(b, m + 1)) % 10, `The second power is one step off in its cycle: ${b}^{${m}} ends in ${ud(b, m)}.`, 'Procedural'],
      [op === '+' ? (ud(a, n) + ud(b, m)) : null, `The units digit is a single digit: ${ud(a, n) + ud(b, m)} ends in ${(ud(a, n) + ud(b, m)) % 10}.`, 'Careless'],
    ], nonneg: true, integer: true, hints: [
      'Find the units digit of each power separately.', hint4,
      'Key idea: the units digit of a sum or product depends only on the units digits of its parts.',
      `The units digits of powers of ${b} repeat: ${cyc(b).join(', ')}, …`],
    method: `${a}^{${n}} ends in ${ud(a, n)}; ${b}^{${m}} ends in ${ud(b, m)}. ${ud(a, n)} ${op} ${ud(b, m)} = ${op === '+' ? ud(a, n) + ud(b, m) : ud(a, n) * ud(b, m)} → units digit ${ans}.`,
    trap: 'Miscounting the position in a cycle when the exponent is a multiple of the cycle length.', sub: 'Units digit of a sum or product', skill: 'Cyclicity' });
} });

T({ id: 'remexpr', topic: 'Remainders', levels: [4, 6], make(L, R){
  const m = R.pick(L === 4 ? [3, 4, 5, 7] : [7, 8, 9, 11, 13]), a = R.int(2, 15), n = R.int(L === 6 ? 100 : 20, L === 6 ? 999 : 99);
  need(a % m !== 0 && a % m !== 1 && gcd(a, m) === 1);
  const seq = []; let x = a % m; for (let i = 0; i < 40; i++){ seq.push(x); x = x * a % m; }
  let per = 1; while (per < 40 && !seq.every((v, i) => i + per >= 40 || seq[i + per] === v)) per++;
  const ans = powmod(a, n, m);
  return ps(R, { stem: `What is the remainder when ${a}^{${n}} is divided by ${m}?`, answer: ans,
    wrong: [
      [(a * n) % m, `${a} × ${n} is not ${a}^{${n}}: the remainders of powers follow a cycle.`, 'Conceptual'],
      [powmod(a, n + 1, m), `One step off in the cycle ${seq.slice(0, per).join(', ')}: count the position with ${n} ÷ ${per}.`, 'Procedural'],
      [powmod(a, n - 1, m), `One step short in the cycle ${seq.slice(0, per).join(', ')}.`, 'Procedural'],
      [a % m, `${a % m} is the remainder of ${a}^{1} only.`, 'Careless'],
      [powmod(a, n, 10) < m ? powmod(a, n, 10) : null, `That is the units digit of ${a}^{${n}}, which gives the remainder when dividing by 10, not by ${m}.`, 'Interpretation'],
    ], nonneg: true, hints: [
      `Find the remainders of ${a}^{1}, ${a}^{2}, ${a}^{3}, … when divided by ${m}.`,
      'Multiply only the remainders at each step.', `Key idea: the remainders repeat with a fixed period; here the period is ${per}.`,
      `Remainders: ${seq.slice(0, per + 1).join(', ')}, … Now place ${n} in the cycle.`],
    method: `Cycle of remainders: ${seq.slice(0, per).join(', ')} (period ${per}). ${n} = ${per} × ${Math.floor(n / per)} + ${n % per} → ${n % per === 0 ? 'last' : 'position ' + (n % per)} in the cycle → ${ans}.`,
    trap: 'Miscounting where the exponent falls in the cycle.', sub: 'Remainders of powers', skill: 'Cyclicity of remainders' });
} });

/* ---------------- Odd/even & signs */
T({ id: 'parity', topic: 'Odd/even & signs', levels: [2, 4], make(L, R){
  const E = [['a + b', (a, b) => a + b], ['ab', (a, b) => a * b], ['a^{2} + b', (a, b) => a * a + b], ['2a + b', (a, b) => 2 * a + b], ['a + 2b', (a, b) => a + 2 * b],
    ['a^{2}b', (a, b) => a * a * b], ['ab + a', (a, b) => a * b + a], ['(a + 1)(b + 1)', (a, b) => (a + 1) * (b + 1)], ['a^{2} + b^{2}', (a, b) => a * a + b * b],
    ['3a + 5b', (a, b) => 3 * a + 5 * b], ['a − b + 1', (a, b) => a - b + 1], ['b^{2} + 2a', (a, b) => b * b + 2 * a], ['a^{3} + 3b', (a, b) => a ** 3 + 3 * b],
    ['ab^{2} + b', (a, b) => a * b * b + b], ['(a + b)^{2} + 1', (a, b) => (a + b) ** 2 + 1], ['a(b + 1)', (a, b) => a * (b + 1)], ['4a + 3b', (a, b) => 4 * a + 3 * b], ['a^{2} − 1', (a, b) => a * a - 1]];
  const C2 = L <= 3 ? [['a is odd and b is even', 1, 0], ['a is even and b is odd', 0, 1], ['a and b are both odd', 1, 1]]
    : [['ab is odd', 1, 1], ['a + b is odd and a is even', 0, 1], ['a^{2}b is even and a is odd', 1, 0], ['a − b is even and ab is odd', 1, 1], ['a + b is odd and ab + a is even', 0, 1]];
  const [cond, pa, pb] = R.pick(C2), want = R.pick([0, 1]), word = want ? 'odd' : 'even';
  const ex = [pa ? 3 : 4, pb ? 5 : 2];
  const good = E.filter(e => mod(e[1](...ex), 2) === want), bad = E.filter(e => mod(e[1](...ex), 2) !== want);
  need(good.length && bad.length >= 4);
  const right = R.pick(good), wrongs = R.sample(bad, 4);
  return ps(R, { stem: `If a and b are integers and ${cond}, which of the following must be ${word}?`, answer: right[0],
    wrong: wrongs.map(e => [e[0], `With a = ${ex[0]} and b = ${ex[1]}, ${e[0]} = ${num(e[1](...ex))}, which is ${want ? 'even' : 'odd'}; the parity is the same for every a and b that fit.`, 'Procedural']),
    hints: [
      'What do the conditions tell you about a and b separately?',
      'Pick the simplest numbers with the right parity and test each option.',
      'Key idea: odd × odd = odd, anything × even = even; odd ± odd = even, odd ± even = odd.',
      `Here a is ${pa ? 'odd' : 'even'} and b is ${pb ? 'odd' : 'even'}; try a = ${ex[0]}, b = ${ex[1]}.`],
    method: `From “${cond}”: a is ${pa ? 'odd' : 'even'} and b is ${pb ? 'odd' : 'even'}. ${right[0]} with a = ${ex[0]}, b = ${ex[1]} is ${num(right[1](...ex))}: ${word}, and the parity rules make it ${word} for every such a and b.`,
    trap: 'Deciding by how an expression looks instead of applying the parity rules term by term.', sub: 'Parity of expressions', skill: 'Parity rules' });
} });

T({ id: 'signs', topic: 'Odd/even & signs', levels: [3, 5], make(L, R){
  const V = ['x', 'y', 'z'], s = V.map(() => R.pick([1, -1]));
  const show = e => { const top = [], bot = []; e.forEach((k, i) => { if (k > 0) top.push(k === 1 ? V[i] : `${V[i]}^{${k}}`); if (k < 0) bot.push(k === -1 ? V[i] : `${V[i]}^{${-k}}`); }); return (top.join('') || '1') + (bot.length ? '/' + bot.join('') : ''); };
  const sign = (e, sg) => e.reduce((p, k, i) => p * (Math.abs(k) % 2 ? sg[i] : 1), 1);
  const fact = (i, j) => { const e = [0, 0, 0]; e[i] = L === 5 ? R.pick([1, 3]) : 1; e[j] = L >= 4 ? R.pick([1, -1, 3]) : 1; return { e, txt: `${show(e)} ${sign(e, s) > 0 ? '>' : '<'} 0` }; };
  const f1 = fact(0, 1), f2 = fact(1, 2);
  const rel = (i, j) => s[i] * s[j] > 0 ? 'the same sign' : 'opposite signs';
  const pool = [];
  const exps = L === 3 ? [1, 2] : [1, 2, 3, -1];
  for (let t = 0; t < 60 && pool.length < 40; t++){
    const e = V.map(() => R.pick([0, ...exps]));
    const odd = e.filter(k => Math.abs(k) % 2).length; if (!odd) continue;
    pool.push({ e, det: odd % 2 === 0 });
  }
  const opts = [];
  const txt = (e, gt) => `${show(e)} ${gt ? '>' : '<'} 0`;
  const trueDet = pool.find(p => p.det && Math.abs(p.e[0]) % 2 && Math.abs(p.e[2]) % 2); need(trueDet);
  const right = txt(trueDet.e, sign(trueDet.e, s) > 0);
  const oddVars = e => e.map((k, i) => Math.abs(k) % 2 ? V[i] : null).filter(Boolean);
  for (const p of pool){
    if (opts.length === 4) break;
    if (p === trueDet) continue;
    if (p.det){
      const t = txt(p.e, sign(p.e, s) < 0), [u, w] = oddVars(p.e);
      if (t !== right && !opts.some(o => o[0] === t)) opts.push([t, `${u} and ${w} have ${rel(V.indexOf(u), V.indexOf(w))}, so ${show(p.e)} is ${sign(p.e, s) > 0 ? 'positive' : 'negative'}: this is never true.`, 'Logic']);
    } else {
      const gt = R.chance(0.5), t = txt(p.e, gt), flip = s.map(v => -v);
      const ok = sign(p.e, s) > 0 === gt ? s : flip, no = ok === s ? flip : s;
      if (t !== right && !opts.some(o => o[0] === t)) opts.push([t, `It can be true, but it need not be: x = ${num(ok[0])}, y = ${num(ok[1])}, z = ${num(ok[2])} fits both facts and makes it true, while x = ${num(no[0])}, y = ${num(no[1])}, z = ${num(no[2])} also fits and makes it false.`, 'Trap']);
    }
  }
  need(opts.length === 4);
  const [u, w] = oddVars(trueDet.e);
  return ps(R, { stem: `If x, y and z are nonzero numbers such that ${f1.txt} and ${f2.txt}, which of the following must be true?`, answer: right, wrong: opts,
    hints: [
      'Only signs matter. What does each fact say about the signs of two of the variables?',
      'An even power never changes a sign; an odd power keeps it.',
      'Key idea: the facts fix the signs only up to flipping all three at once. A statement that must be true survives that flip.',
      `From the facts: x and y have ${rel(0, 1)}; y and z have ${rel(1, 2)}.`],
    method: `x and y: ${rel(0, 1)}. y and z: ${rel(1, 2)}. So ${u} and ${w} have ${rel(V.indexOf(u), V.indexOf(w))}, and ${show(trueDet.e)} is ${sign(trueDet.e, s) > 0 ? 'positive' : 'negative'} in every case.`,
    trap: 'Picking a statement that is true for one choice of signs but false when every sign is flipped.', sub: 'Signs of products', skill: 'Sign analysis' });
} });

/* ---------------- Fractions & decimals */
T({ id: 'termin', topic: 'Fractions & decimals', levels: [3, 5], make(L, R){
  const only25 = d => { while (d % 2 === 0) d /= 2; while (d % 5 === 0) d /= 5; return d === 1; };
  const red = (n, d) => { const g = gcd(n, d); return [n / g, d / g]; };
  const d0 = Math.pow(2, R.int(0, 4)) * Math.pow(5, R.int(0, 2)); need(d0 >= 4);
  let n, d;
  if (L === 3){ d = d0; n = R.int(1, 3 * d); need(gcd(n, d) === 1); }
  else { const g = R.pick([3, 7, 9, 11, 21]); d = d0 * g; n = g * R.int(1, 12); need(gcd(n / g, d0) === 1); }
  const right = `${n}/${d}`;
  const wrong = [];
  for (let t = 0; t < 80 && wrong.length < 4; t++){
    const bad = R.pick([3, 6, 7, 9, 11, 12, 13, 15]), dd = Math.pow(2, R.int(0, 3)) * Math.pow(5, R.int(0, 2)) * bad;
    const nn = L >= 4 && R.chance(0.4) ? 5 * R.int(1, 9) : R.int(1, 2 * dd);
    const [rn, rd] = red(nn, dd);
    if (only25(rd) || rd === 1 || dd > 400) continue;
    const s = `${nn}/${dd}`; if (s === right || wrong.some(w => w[0] === s)) continue;
    const pf = factorText(factorize(rd));
    const has = pf === String(rd) ? `${rd} is a prime other than 2 and 5` : `${rd} = ${pf} has a prime factor other than 2 and 5`;
    wrong.push([s, `${nn}/${dd}${rn !== nn ? ` reduces to ${rn}/${rd}, and ` : ': '}${has}, so the decimal repeats.`, dd % 10 === 0 ? 'Trap' : 'Conceptual']);
  }
  need(wrong.length === 4);
  return ps(R, { stem: 'Which of the following fractions is equal to a terminating decimal?', answer: right, wrong,
    hints: [
      'Why does 1/4 = 0.25 end while 1/3 = 0.333… does not?',
      'Reduce each fraction to lowest terms before you judge it.',
      'Key idea: a fraction in lowest terms terminates exactly when its denominator has no prime factors other than 2 and 5.',
      'Factor each reduced denominator.'],
    method: L === 3 ? `${right}: ${d} = ${factorText(factorize(d))} has only 2s and 5s → terminates. Every other denominator keeps a factor such as 3, 7, 11 or 13.`
      : `${right} reduces to ${red(n, d).join('/')}, and ${red(n, d)[1]} = ${factorText(factorize(red(n, d)[1]))} has only 2s and 5s → terminates. The others keep a factor 3, 7, 11 or 13 after reducing.`,
    trap: L === 3 ? 'Judging by whether the denominator ends in 0.' : 'Judging before reducing: a factor 3 or 7 in the denominator can cancel.', sub: 'Terminating decimals', skill: 'Denominators of 2s and 5s' });
} });

T({ id: 'fracleft', topic: 'Fractions & decimals', levels: [3, 5], make(L, R){
  const a = R.int(3, 6), b = R.int(2, 5), c = L === 5 ? R.int(2, 4) : 1, t = R.int(5, 40);
  const B = a * b * c * t * (L === 5 ? 1 : R.pick([1, 2, 5])), left = B * (a - 1) / a * (b - 1) / b * (c - 1 || 1) / (c === 1 ? 1 : c);
  need(isInt(left));
  const steps = L === 5 ? `1/${a} of her savings on rent, 1/${b} of the remainder on food and 1/${c} of what was then left on travel` : `1/${a} of her savings on rent and 1/${b} of the remainder on food`;
  const shareLeft = L === 5 ? `(${a - 1}/${a})(${b - 1}/${b})(${c - 1}/${c})` : `(${a - 1}/${a})(${b - 1}/${b})`;
  const whole = L === 5 ? 1 - 1 / a - 1 / b - 1 / c : 1 - 1 / a - 1 / b;
  return ps(R, { stem: `Maria spent ${steps}. She had ${money(left)} left. How much were her savings at the start?`, answer: B, fmt: money,
    wrong: [
      [whole > 0 ? round(left / whole, 2) : null, `Taking every fraction of the original savings: 1/${b}${L === 5 ? ` and 1/${c} apply` : ' applies'} to what was left, not to the whole.`, 'Trap'],
      [B / a, `${money(B / a)} is what she spent on rent, not her savings.`, 'Interpretation'],
      [B - left, `${money(B - left)} is how much she spent in total.`, 'Interpretation'],
      [left * a / (a - 1), `Undoing only the first step: ${money(left)} is what remained after every step.`, 'Procedural'],
    ], positive: true, hints: [
      'After spending 1/' + a + ', what fraction of the savings remains?',
      `Then 1/${b} of that remainder goes: what fraction of the remainder is left?`,
      'Key idea: “of the remainder” means multiply the fractions left at each step.',
      `Fraction left: ${shareLeft}.`],
    method: `Left = savings × ${shareLeft} = savings × ${Q(left, B)}. Savings = ${money(left)} ÷ ${Q(left, B)} = ${money(B)}.`,
    alt: L === 5 ? `Work backwards: before travel she had ${money(left * c / (c - 1))}, before food ${money(left * c / (c - 1) * b / (b - 1))}, before rent ${money(B)}.` : `Work backwards: before food she had ${money(left * b / (b - 1))}, before rent ${money(B)}.`,
    trap: 'Subtracting each fraction from the original total.', sub: 'Fractions of a remainder', skill: 'Successive fractions' });
} });

T({ id: 'fraccmp', topic: 'Fractions & decimals', levels: [2, 4], make(L, R){
  const target = R.int(35, 85) / 100, fr = [];
  for (let t = 0; t < 200 && fr.length < 5; t++){
    const d = R.int(L >= 4 ? 11 : 5, L >= 4 ? 29 : 17), n = Math.round(d * (target + (R.int(-40, 40) / 1000)));
    if (n <= 0 || n >= d || gcd(n, d) !== 1) continue;
    if (fr.some(f => Math.abs(f.n / f.d - n / d) < 0.004)) continue;
    fr.push({ n, d });
  }
  need(fr.length === 5);
  const greatest = R.chance(0.6), best = fr.reduce((m, f) => (greatest ? f.n / f.d > m.n / m.d : f.n / f.d < m.n / m.d) ? f : m);
  const bigNum = fr.reduce((m, f) => f.n > m.n ? f : m);
  const dec = f => (f.n / f.d).toFixed(3);
  return ps(R, { stem: `Which of the following is ${greatest ? 'greatest' : 'least'}?`, answer: `${best.n}/${best.d}`,
    wrong: fr.filter(f => f !== best).map(f => [`${f.n}/${f.d}`, f === bigNum && greatest ? `${f.n}/${f.d} has the largest numerator, but its denominator is large too: ${f.n}/${f.d} ≈ ${dec(f)} < ${best.n}/${best.d} ≈ ${dec(best)}.` : `${f.n}/${f.d} ≈ ${dec(f)}, ${greatest ? 'less' : 'more'} than ${best.n}/${best.d} ≈ ${dec(best)}.`, f === bigNum && greatest ? 'Trap' : 'Calculation']),
    hints: [
      'The fractions are close together. Would a rough estimate separate them?',
      'Compare two at a time: cross-multiply instead of dividing.',
      'Key idea: a/b > c/d exactly when ad > bc (for positive denominators).',
      'Start with the two that look largest and cross-multiply.'],
    method: `As decimals: ${fr.map(f => `${f.n}/${f.d} ≈ ${dec(f)}`).join(', ')}. The ${greatest ? 'greatest' : 'least'} is ${best.n}/${best.d}.`,
    trap: 'Judging a fraction by its numerator or denominator alone.', sub: 'Comparing fractions', skill: 'Cross-multiplication' });
} });

/* ---------------- Exponents & roots */
T({ id: 'exprule', topic: 'Exponents & roots', levels: [2, 3], make(L, R){
  if (L === 2){
    const p = R.int(2, 5), q = R.int(2, 5), r = R.int(1, 9), t = R.int(1, 12), k = p * q + r - t;
    return ps(R, { stem: `If x > 1 and (x^{${p}})^{${q}} · x^{${r}} ÷ x^{${t}} = x^{k}, what is the value of k?`, answer: k,
      wrong: [
        [p + q + r - t, `A power of a power multiplies the exponents: (x^{${p}})^{${q}} = x^{${p * q}}, not x^{${p + q}}.`, 'Conceptual'],
        [p * q + r + t, `Dividing subtracts exponents: ÷ x^{${t}} means − ${t}.`, 'Careless'],
        [Math.pow(p, q) + r - t, `(x^{${p}})^{${q}} is x^{${p} × ${q}}, not x^{${p}^${q}}.`, 'Conceptual'],
        [p * q * r - t, `Multiplying powers of the same base adds the exponents: x^{${p * q}} · x^{${r}} = x^{${p * q + r}}.`, 'Procedural'],
      ], hints: ['Handle one operation at a time, from the inside out.', 'What is (x^{a})^{b} as a single power of x?',
        'Key idea: (x^{a})^{b} = x^{ab}; x^{a} · x^{b} = x^{a+b}; x^{a} ÷ x^{b} = x^{a−b}.', `(x^{${p}})^{${q}} = x^{${p * q}}.`],
      method: `x^{${p * q}} · x^{${r}} ÷ x^{${t}} = x^{${p * q} + ${r} − ${t}} = x^{${k}}.`, trap: 'Adding exponents in a power of a power.',
      sub: 'Exponent rules', skill: 'Combining powers' });
  }
  const a = R.int(1, 9), b = R.int(1, 6), c = R.int(1, 5), k = a + 2 * b - 3 * c;
  return ps(R, { stem: `If 2^{${a}} · 4^{${b}} ÷ 8^{${c}} = 2^{k}, what is the value of k?`, answer: k,
    wrong: [
      [a + b - c, `4 and 8 are not 2: rewrite 4^{${b}} as 2^{${2 * b}} and 8^{${c}} as 2^{${3 * c}} before combining.`, 'Trap'],
      [a + 2 * b + 3 * c, `Dividing by 8^{${c}} subtracts ${3 * c}; it does not add it.`, 'Careless'],
      [a + 4 * b - 8 * c, `4^{${b}} = (2^{2})^{${b}} = 2^{${2 * b}}: multiply the exponent by 2, not by 4.`, 'Procedural'],
      [a * 2 * b - 3 * c, `Multiplying powers adds exponents: 2^{${a}} · 2^{${2 * b}} = 2^{${a + 2 * b}}.`, 'Procedural'],
    ], hints: ['Can every base be written as a power of 2?', '4 = 2^{2} and 8 = 2^{3}.', 'Key idea: rewrite with one base, then add and subtract the exponents.',
      `4^{${b}} = 2^{${2 * b}} and 8^{${c}} = 2^{${3 * c}}.`],
    method: `2^{${a}} · 2^{${2 * b}} ÷ 2^{${3 * c}} = 2^{${a} + ${2 * b} − ${3 * c}} = 2^{${k}}.`, trap: 'Combining exponents before converting to a common base.',
    sub: 'Common base', skill: 'Rewriting bases' });
} });

T({ id: 'expbase', topic: 'Exponents & roots', levels: [4, 5], make(L, R){
  const p = R.pick([2, 3]), [m, n] = R.pick(p === 2 ? [[1, 2], [2, 3], [1, 3], [2, 5], [3, 4], [1, 4]] : [[1, 2], [2, 3], [1, 3], [1, 4]]);
  const a = R.int(1, 6), b = R.int(1, 6), B1 = Math.pow(p, m), B2 = Math.pow(p, n);
  const mx = (k, v) => k === 1 ? v : `${k}${v}`, mp = (k, e) => k === 1 ? `(${e})` : `${k}(${e})`;
  if (L === 5){
    // (p^m)^(x+a) · p^x = (p^n)^(x−b) → m(x + a) + x = n(x − b) → x = (ma + nb)/(n − m − 1)
    const d5 = n - m - 1; need(d5 > 0 && (m * a + n * b) % d5 === 0);
    const x5 = (m * a + n * b) / d5;
    return ps(R, { stem: `If ${B1}^{x + ${a}} · ${p}^{x} = ${B2}^{x − ${b}}, what is the value of x?`, answer: x5,
      wrong: [
        [Q(m * a + n * b, n - m), `The factor ${p}^{x} adds x to the left exponent: ${mp(m, 'x + ' + a)} + x = ${n}(x − ${b}).`, 'Careless'],
        [Q(m * a + b, d5), `Multiply the whole exponent by ${n}: ${B2}^{x − ${b}} = ${p}^{${n}x − ${n * b}}, not ${p}^{${n}x − ${b}}.`, 'Procedural'],
        [Q(m * a - n * b, d5), `Sign slip: ${n}(x − ${b}) = ${n}x − ${n * b}.`, 'Calculation'],
        [Q(a + b, 1), `The exponents can be compared only after both sides have base ${p}.`, 'Trap'],
      ], hints: [`Write every base as a power of ${p}.`, `${B2} = ${p}^{${n}}${m > 1 ? ` and ${B1} = ${p}^{${m}}` : ''}.`, 'Key idea: with equal bases (other than 0, 1 and −1), equal powers need equal exponents.',
        `Left side: ${p}^{${mp(m, 'x + ' + a)} + x}.`],
      method: `${p}^{${mx(m + 1, 'x')} + ${m * a}} = ${p}^{${n}x − ${n * b}} → ${mx(m + 1, 'x')} + ${m * a} = ${n}x − ${n * b} → x = ${x5}.`,
      trap: 'Comparing exponents before converting to one base.', sub: 'Exponential equations', skill: 'Equating exponents' });
  }
  const num_ = m * a + n * b, den = n - m; need(num_ % den === 0);
  const x = num_ / den;
  return ps(R, { stem: `If ${B1}^{x + ${a}} = ${B2}^{x − ${b}}, what is the value of x?`, answer: x,
    wrong: [
      [Q(m * a + b, den), `Multiply the whole exponent by ${n}: ${B2}^{x − ${b}} = ${p}^{${n}x − ${n * b}}, not ${p}^{${n}x − ${b}}.`, 'Procedural'],
      [Q(m * a - n * b, den), `Sign slip: ${n}(x − ${b}) = ${n}x − ${n * b}.`, 'Calculation'],
      [Q(-(n * a + m * b), den), `The exponents went to the wrong bases: ${B1} = ${p}^{${m}} goes with x + ${a}.`, 'Careless'],
      [Q(a + b, 1), `The exponents can be compared only after both sides have the same base.`, 'Trap'],
      [m > 1 ? Q(a + b, den) : null, `Multiply every exponent by its power, constants included: ${m}(x + ${a}) and ${n}(x − ${b}).`, 'Procedural'],
    ], hints: [`Write ${m > 1 ? 'both bases' : B2} as ${m > 1 ? 'powers' : 'a power'} of ${p}.`, `${B2} = ${p}^{${n}}${m > 1 ? ` and ${B1} = ${p}^{${m}}` : ''}.`, 'Key idea: once the bases match, set the exponents equal.',
      `${mp(m, 'x + ' + a)} = ${n}(x − ${b}).`.replace(/^\((.*?)\) =/, '$1 =')],
    method: `${p}^{${mp(m, 'x + ' + a)}} = ${p}^{${n}(x − ${b})} → ${mx(m, 'x')} + ${m * a} = ${n}x − ${n * b} → ${den === 1 ? '' : `${den}x = ${num_} → `}x = ${x}.`,
    trap: `Multiplying only the x by ${n} and leaving the constant, or comparing exponents before the bases match.`, sub: 'Exponential equations', skill: 'Common base' });
} });

T({ id: 'roots', topic: 'Exponents & roots', levels: [3, 4], make(L, R){
  const p = R.pick([2, 3, 5, 6, 7]), [a, b, c] = R.sample([2, 3, 4, 5, 6, 7], 3), k = a + b - c;
  need(k > 0 && k !== 1);
  const r = x => `√${x * x * p}`, s2 = a * a + b * b - c * c;
  const show = (m, q) => `${m}√${q}`;
  const opts = [
    [s2 > 0 ? Math.sqrt(s2 * p) : null, 'Roots do not add: √a + √b is not √(a + b). Simplify each root first.', 'Trap', s2 > 0 ? `√${s2 * p}` : null],
    [(a + b + c) * Math.sqrt(p), `Sign slip: the last root is subtracted, ${a} + ${b} − ${c} = ${k}.`, 'Careless', show(a + b + c, p)],
    [k * p, `√${p} does not become ${p}: only the square factors leave the root.`, 'Procedural', `${k * p}`],
    [s2 > 0 && s2 !== k ? s2 * Math.sqrt(p) : null, `The squares ${a * a}, ${b * b}, ${c * c} come out of the root as ${a}, ${b}, ${c}, not as the squares themselves.`, 'Procedural', s2 > 0 ? show(s2, p) : null],
    [k * Math.sqrt(2 * p), `Each root simplifies to a multiple of √${p}, not √${2 * p}.`, 'Calculation', show(k, 2 * p)],
  ];
  if (L === 4){
    const e = R.int(2, 3);
    const m = R.mc(k * Math.sqrt(p) * e, opts.map(o => [o[0] == null ? null : o[0] * e, o[1], o[2], o[3] == null ? null : (o[3].includes('√') ? `${e * (+o[3].split('√')[0] || 1)}√${o[3].split('√')[1]}` : `${e * +o[3]}`)]), { label: show(k * e, p) });
    return { type: 'PS', stem: `What is ${e}(${r(a)} + ${r(b)} − ${r(c)})?`, choices: m.choices, answer: m.answer, diagnosis: m.diagnosis, solution: m.solution,
      hints: ['Can each root be simplified on its own?', `Look for the largest square factor of each number under a root.`, 'Key idea: √(m²n) = m√n; only like roots can be added.', `${r(a)} = ${a}√${p}.`],
      method: `${r(a)} = ${a}√${p}, ${r(b)} = ${b}√${p}, ${r(c)} = ${c}√${p}. Sum: ${k}√${p}; times ${e}: ${k * e}√${p}.`, trap: 'Adding the numbers under the roots.', subtopic: 'Simplifying roots', skill: 'Like radicals' };
  }
  const m = R.mc(k * Math.sqrt(p), opts, { label: show(k, p) });
  return { type: 'PS', stem: `What is ${r(a)} + ${r(b)} − ${r(c)}?`, choices: m.choices, answer: m.answer, diagnosis: m.diagnosis, solution: m.solution,
    hints: ['Can each root be simplified on its own?', 'Look for the largest square factor of each number under a root.', 'Key idea: √(m²n) = m√n; only like roots can be added.', `${r(a)} = ${a}√${p}.`],
    method: `${r(a)} = ${a}√${p}, ${r(b)} = ${b}√${p}, ${r(c)} = ${c}√${p}. Total: (${a} + ${b} − ${c})√${p} = ${k}√${p}.`, trap: 'Adding the numbers under the roots.', subtopic: 'Simplifying roots', skill: 'Like radicals' };
} });

T({ id: 'expfac', topic: 'Exponents & roots', levels: [4, 5], make(L, R){
  const b = R.pick([2, 3, 5]), s = R.int(1, b === 5 ? 2 : 3), x = R.int(2, b === 2 ? 9 : 5), plus = L === 5;
  const V = Math.pow(b, x) * (Math.pow(b, s) + (plus ? 1 : -1)); need(V <= 60000);
  let lg = 0; while (Math.pow(b, lg + 1) <= V) lg++;
  return ps(R, { stem: `If ${b}^{x + ${s}} ${plus ? '+' : '−'} ${b}^{x} = ${num(V)}, what is the value of x?`, answer: x,
    wrong: [
      [x + s, `${x + s} is the larger exponent, x + ${s}; the question asks for x.`, 'Interpretation'],
      [lg !== x && lg !== x + s ? lg : x - 1, lg !== x && lg !== x + s ? `${num(V)} is not a power of ${b}; guessing the nearest power (${b}^{${lg}}) ignores the factor ${Math.pow(b, s) + (plus ? 1 : -1)}.` : `Recheck: ${b}^{${x - 1}} × ${Math.pow(b, s) + (plus ? 1 : -1)} = ${num(Math.pow(b, x - 1) * (Math.pow(b, s) + (plus ? 1 : -1)))}, not ${num(V)}.`, lg !== x && lg !== x + s ? 'Trap' : 'Calculation'],
      [x + 1, `Recheck: ${b}^{${x + 1}} × ${Math.pow(b, s) + (plus ? 1 : -1)} = ${num(Math.pow(b, x + 1) * (Math.pow(b, s) + (plus ? 1 : -1)))}, not ${num(V)}.`, 'Calculation'],
      [plus ? null : x + s - 1, `${b}^{x + ${s}} − ${b}^{x} is not ${b}^{x + ${s - 1}}: subtracting powers does not subtract exponents.`, 'Conceptual'],
      [x - 1, `Recheck: ${b}^{${x - 1}} × ${Math.pow(b, s) + (plus ? 1 : -1)} is too small.`, 'Calculation'],
    ], hints: [`Can you factor ${b}^{x} out of both terms?`, `${b}^{x + ${s}} = ${b}^{x} · ${b}^{${s}}.`, 'Key idea: factor out the smallest power, then compare with the prime factorization of the number.',
      `${b}^{x}(${Math.pow(b, s)} ${plus ? '+' : '−'} 1) = ${num(V)}.`],
    method: `${b}^{x}(${b}^{${s}} ${plus ? '+' : '−'} 1) = ${b}^{x} × ${Math.pow(b, s) + (plus ? 1 : -1)} = ${num(V)} → ${b}^{x} = ${num(Math.pow(b, x))} → x = ${x}.`,
    trap: 'Treating a sum or difference of powers as a single power.', sub: 'Factoring powers', skill: 'Factor out the common power' });
} });

/* ---------------- Percents */
const chg = v => v < 0 ? `${num(-v)}% decrease` : v > 0 ? `${num(v)}% increase` : 'No change';
T({ id: 'pctseq', topic: 'Percents', levels: [2, 4], make(L, R){
  const c = L === 2 ? [5 * R.int(2, 10), -5 * R.int(2, 10)] : [5 * R.int(1, 8), -5 * R.int(2, 8), 5 * R.int(1, 4)];
  if (L === 2 && R.chance(0.5)) c.reverse();
  const f = c.map(x => (100 + x) / 100), fin = 100 * f.reduce((s, v) => s * v, 1);
  need(decimals(fin, 2));
  const say = x => x > 0 ? `increased by ${x}%` : `decreased by ${-x}%`;
  if (L === 2){
    const net = round(fin - 100, 4); need(net !== 0);
    return ps(R, { stem: `The price of a jacket is ${say(c[0])}, and the new price is then ${say(c[1])}. What is the overall change in the price?`, answer: net, fmt: chg,
      wrong: [
        [c[0] + c[1], `Adding ${num(c[0])}% and ${num(c[1])}% ignores that the second change applies to the new price.`, 'Trap'],
        [-net, `Right size, wrong direction: ${f[0]} × ${f[1]} = ${round(fin / 100, 4)}, which is ${fin < 100 ? 'below' : 'above'} 1.`, 'Calculation'],
        [round(c[0] + c[1] + c[0] * c[1] / 10, 4), 'The cross term is c₁ × c₂ ÷ 100, not ÷ 10.', 'Calculation'],
        [round(c[0] * c[1] / 100, 4), `${num(c[0] * c[1] / 100)}% is only the cross term; the two changes themselves also count.`, 'Procedural'],
      ], hints: ['Would a 10% rise followed by a 10% cut bring the price back to where it started?', 'Turn each change into a multiplier.',
        'Key idea: +a% means × (1 + a/100); successive changes multiply.', `Start from 100: 100 → ${num(100 * f[0])}.`],
      method: `${f[0]} × ${f[1]} = ${round(fin / 100, 4)} → ${chg(net).toLowerCase()}.`, alt: `From 100: ${num(100 * f[0])}, then ${num(fin)}.`,
      trap: 'Adding the percents.', sub: 'Successive percent changes', skill: 'Multipliers' });
  }
  const noLast = 100 * f[0] * f[1];
  return ps(R, { stem: `A price is ${say(c[0])}. The new price is then ${say(c[1])}, and finally a ${c[2]}% tax is added to that price. The final amount is what percent of the original price?`, answer: fin, fmt: pct,
    wrong: [
      [100 + c[0] + c[1] + c[2], `Adding the percents (${c[0]} ${c[1] < 0 ? '−' : '+'} ${Math.abs(c[1])} + ${c[2]}) ignores that each change acts on a different base.`, 'Trap'],
      [round(noLast, 4), `${num(noLast)}% leaves out the ${c[2]}% tax.`, 'Careless'],
      [round(noLast + c[2], 4), `The tax is ${c[2]}% of the reduced price, not of the original: ${num(noLast)} × ${f[2]}.`, 'Procedural'],
      [round(100 * (1 + c[0] / 100) * (1 + c[2] / 100) * (1 + c[1] / 100 * -1), 4), `The middle change is a decrease: multiply by ${f[1]}.`, 'Reading'],
    ], hints: ['Would +20% followed by −20% bring a price back to where it started?', 'Each change applies to the result of the previous one.',
      'Key idea: turn every change into a multiplier and multiply.', `Start from 100: 100 → ${num(100 * f[0])}.`],
    method: `${f.join(' × ')} = ${round(fin / 100, 6)} → ${num(fin)}%.`, alt: `From 100: ${num(100 * f[0])} → ${num(noLast)} → ${num(fin)}.`,
    trap: 'Adding the percents.', sub: 'Successive percent changes', skill: 'Multipliers' });
} });

T({ id: 'pctrev', topic: 'Percents', levels: [3, 4], make(L, R){
  if (L === 3){
    const p = R.pick([10, 15, 20, 25, 30, 40]), O = R.int(3, 60) * 20, X = O * (100 - p) / 100; need(isInt(X));
    return ps(R, { stem: `After a ${p}% discount, a lamp costs ${money(X)}. What was the price before the discount?`, answer: O, fmt: money,
      wrong: [
        [X * (100 + p) / 100, `Adding ${p}% of ${money(X)} uses the wrong base: the discount was ${p}% of the original price, not of the sale price.`, 'Trap'],
        [round(X / (1 + p / 100), 2), `Dividing by ${1 + p / 100} undoes an increase, not a discount.`, 'Procedural'],
        [O * p / 100, `${money(O * p / 100)} is the size of the discount, not the original price.`, 'Interpretation'],
        [X * (100 - p) / 100, `Applying the discount again goes the wrong way.`, 'Procedural'],
      ], positive: true, hints: ['Is the discount a percent of the old price or of the new one?', `The sale price is (100 − ${p})% of the original.`,
        'Key idea: new = original × (1 − p/100), so original = new ÷ (1 − p/100).', `${money(X)} = original × ${(100 - p) / 100}.`],
      method: `Original = ${money(X)} ÷ ${(100 - p) / 100} = ${money(O)}.`, alt: `Check: ${money(O)} − ${p}% = ${money(X)}.`,
      trap: `Adding ${p}% back to the sale price.`, sub: 'Reverse percent', skill: 'Undoing a percent change' });
  }
  const a = 5 * R.int(2, 8), b = 5 * R.int(2, 8), O = R.int(4, 40) * 20, X = O * (100 + a) / 100 * (100 - b) / 100;
  need(decimals(X, 2) && a !== b);
  return ps(R, { stem: `A price was increased by ${a}% and the new price was then decreased by ${b}%. The final price is ${money(X)}. What was the original price?`, answer: O, fmt: money,
    wrong: [
      [round(X / (1 + (a - b) / 100), 2), `Netting the changes to ${a - b > 0 ? '+' : '−'}${Math.abs(a - b)}% ignores that the ${b}% applies to the higher price.`, 'Trap'],
      [round(X * (100 - a) / 100 * (100 + b) / 100, 2), `Reversing a +${a}% change is not a −${a}% change: divide by ${1 + a / 100} instead.`, 'Procedural'],
      [round(O * (100 + a) / 100, 2), `${money(O * (100 + a) / 100)} is the price after the increase.`, 'Interpretation'],
      [round(X / ((100 + a) / 100), 2), `Only the increase has been undone; divide by ${(100 - b) / 100} too.`, 'Careless'],
    ], positive: true, hints: ['Write the final price as the original times two multipliers.', `+${a}% → × ${(100 + a) / 100}; −${b}% → × ${(100 - b) / 100}.`,
      'Key idea: to go back, divide by the same multipliers.', `${money(X)} = original × ${(100 + a) / 100} × ${(100 - b) / 100}.`],
    method: `Original = ${money(X)} ÷ (${(100 + a) / 100} × ${(100 - b) / 100}) = ${money(X)} ÷ ${round((100 + a) * (100 - b) / 10000, 6)} = ${money(O)}.`,
    trap: 'Netting the two changes into one.', sub: 'Reverse percent', skill: 'Undoing successive changes' });
} });

T({ id: 'pctpts', topic: 'Percents', levels: [3, 4], make(L, R){
  const a = R.pick([4, 5, 8, 10, 12, 15, 16, 20, 25, 40]), b = a + R.pick(L === 3 ? [1, 2, 3, 4, 5, 6] : [-1, -2, -3, -4, 1, 2, 3, 5, 6]), up = b > a;
  need(b > 0 && decimals(100 * (b - a) / a, 2));
  const ans = Math.abs(100 * (b - a) / a), ctx = R.pick(['the unemployment rate in a region', 'the interest rate on a loan', 'a company’s profit margin', 'the share of students who passed an exam']);
  return ps(R, { stem: `Over one year, ${ctx} ${up ? 'rose' : 'fell'} from ${a}% to ${b}%. By what percent did it ${up ? 'increase' : 'decrease'}?`, answer: ans, fmt: pct,
    wrong: [
      [Math.abs(b - a), `${Math.abs(b - a)} is the change in percentage points. The percent change divides it by the starting value, ${a}.`, 'Trap'],
      [round(100 * Math.abs(b - a) / b, 2), `Divide by the starting value, ${a}%, not the final value, ${b}%.`, 'Procedural'],
      [round(100 * b / a, 2), `${num(round(100 * b / a, 2))}% is the new rate as a percent of the old one; subtract 100% to get the change.`, 'Conceptual'],
      [round(Math.abs(b - a) / a, 4), `The ratio ${num(round(Math.abs(b - a) / a, 4))} still needs × 100 to become a percent.`, 'Careless'],
    ], positive: true, hints: [`Is going from ${a}% to ${b}% a change of ${Math.abs(b - a)}%, or of ${Math.abs(b - a)} percentage point${Math.abs(b - a) === 1 ? '' : 's'}?`, 'Percent change compares the change with the starting value.',
      'Key idea: percent change = (new − old) ÷ old × 100; percentage points = new − old.', `Change: ${Math.abs(b - a)} percentage point${Math.abs(b - a) === 1 ? '' : 's'}. Starting value: ${a}.`],
    method: `${Math.abs(b - a)} ÷ ${a} × 100 = ${num(ans)}%.`, trap: 'Reporting the change in percentage points as a percent change.', sub: 'Percent vs percentage points', skill: 'Choosing the base' });
} });

T({ id: 'pctof', topic: 'Percents', levels: [2, 4], make(L, R){
  if (L <= 3){
    const p = R.pick([20, 25, 40, 50, 60, 75, 80, 120, 125, 150, 200]), q = R.pick([10, 20, 25, 30, 40, 60, 80, 150]), ans = p * q / 100;
    need(decimals(ans, 2) && p !== q);
    return ps(R, { stem: `If x is ${p}% of y and y is ${q}% of z, then x is what percent of z?`, answer: ans, fmt: pct,
      wrong: [
        [p + q, `Percents of different bases do not add: x = ${p / 100}y and y = ${q / 100}z, so multiply.`, 'Conceptual'],
        [p * q, `${p} × ${q} = ${num(p * q)} still has to be divided by 100: ${p / 100} × ${q / 100} = ${ans / 100}.`, 'Procedural'],
        [round(100 * p / q, 2), `Dividing ${p} by ${q} compares the two percents, not x with z.`, 'Procedural'],
        [(p + q) / 2, 'Averaging the percents has no meaning here.', 'Conceptual'],
      ], positive: true, hints: ['Write each sentence as an equation.', `x = ${p / 100} × y and y = ${q / 100} × z.`, 'Key idea: substitute one equation into the other.', `x = ${p / 100} × ${q / 100} × z.`],
      method: `x = ${p / 100}y = ${p / 100} × ${q / 100}z = ${ans / 100}z → ${num(ans)}%.`, alt: 'Smart number: z = 100.', trap: 'Adding the percents.',
      sub: 'Chained percents', skill: 'Percent equations' });
  }
  const a = 5 * R.int(2, 12), b = 5 * R.int(2, 12), ans = (100 + a) * (100 - b) / 100;
  need(decimals(ans, 2) && a !== b);
  return ps(R, { stem: `x is ${a}% greater than y, and y is ${b}% less than z. x is what percent of z?`, answer: ans, fmt: pct,
    wrong: [
      [100 + a - b, `Netting +${a}% and −${b}% ignores that they apply to different bases.`, 'Trap'],
      [round((100 + a) / (100 - b) * 100, 2), `x = ${(100 + a) / 100}y and y = ${(100 - b) / 100}z: multiply, do not divide.`, 'Procedural'],
      [(100 - a) * (100 + b) / 100, `The directions are swapped: x is greater than y, and y is less than z.`, 'Reading'],
      [round(ans - 100, 2) > 0 ? round(ans - 100, 2) : null, `${num(round(ans - 100, 2))}% is how much greater x is than z, not x as a percent of z.`, 'Interpretation'],
    ], positive: true, hints: ['Turn “greater than” and “less than” into multipliers.', `x = ${(100 + a) / 100}y; y = ${(100 - b) / 100}z.`, 'Key idea: chain the multipliers.', 'Try z = 100.'],
    method: `x = ${(100 + a) / 100} × ${(100 - b) / 100} z = ${ans / 100}z → ${num(ans)}%.`, trap: 'Netting the percents.', sub: 'Chained percent changes', skill: 'Multipliers' });
} });

/* ---------------- Ratios & proportions */
const ratioStr = (a, b) => { const g = gcd(a, b); return `${a / g}:${b / g}`; };
T({ id: 'ratioadd', topic: 'Ratios & proportions', levels: [3, 5], make(L, R){
  const a = R.int(1, 7), b = R.int(2, 9); need(gcd(a, b) === 1 && a !== b);
  const t = R.int(2, 12), k = R.int(2, 30), A = a * t, B = b * t;
  if (L <= 4){
    const g = gcd(A + k, B), c = (A + k) / g, d = B / g; need(c <= 15 && d <= 15 && c * b !== a * d);
    return ps(R, { stem: `In a box, the ratio of red marbles to blue marbles is ${a}:${b}. After ${k} red marbles are added and none are removed, the ratio becomes ${c}:${d}. How many blue marbles are in the box?`, answer: B,
      wrong: [
        [A, `${A} is the number of red marbles before the addition.`, 'Interpretation'],
        [A + k, `${A + k} is the number of red marbles after the addition.`, 'Interpretation'],
        [(a + b) * t, `${(a + b) * t} is the total before the addition.`, 'Interpretation'],
        [isInt(k * b / (c - a)) && c !== a ? k * b / (c - a) : k * d, `Ratio terms are not counts: ${c} − ${a} parts do not correspond to ${k} marbles, because the two ratios use different part sizes.`, 'Trap'],
      ], positive: true, integer: true, hints: ['Which colour does not change?', `Write red = ${term(a, 't')} and blue = ${b}t for some t.`,
        'Key idea: keep the unchanged quantity fixed and write one equation for the new ratio.', `(${term(a, 't')} + ${k}) : ${b}t = ${c} : ${d}.`],
      method: `${d}(${term(a, 't')} + ${k}) = ${c} × ${b}t → ${term(d * a, 't')} + ${d * k} = ${c * b}t → t = ${t}. Blue = ${b} × ${t} = ${B}.`,
      trap: 'Treating differences between ratio terms as counts.', sub: 'Changing a ratio', skill: 'Ratio multiplier' });
  }
  const g = gcd(A + k, B + k), c = (A + k) / g, d = (B + k) / g; need(c <= 15 && d <= 15 && c * b !== a * d);
  return ps(R, { stem: `The ratio of boys to girls in a club is ${a}:${b}. After ${k} boys and ${k} girls join, the ratio becomes ${c}:${d}. How many members did the club have before?`, answer: A + B,
    wrong: [
      [A + B + 2 * k, `${A + B + 2 * k} is the number of members after the new ones joined.`, 'Interpretation'],
      [B, `${B} is the number of girls before, not all members.`, 'Interpretation'],
      [A, `${A} is the number of boys before.`, 'Interpretation'],
      [isInt(k * (a + b) / Math.abs(d - c - (b - a))) && d - c !== b - a ? k * (a + b) / Math.abs(d - c - (b - a)) : (a + b) * k, 'Ratio terms are parts of different sizes before and after; set up one equation with the multiplier t.', 'Trap'],
    ], positive: true, integer: true, hints: ['Both groups change. What stays the same?', `Boys = ${term(a, 't')}, girls = ${b}t.`, 'Key idea: one unknown multiplier t; the new ratio gives one equation.', `(${term(a, 't')} + ${k}) : (${b}t + ${k}) = ${c} : ${d}.`],
    method: `${d}(${term(a, 't')} + ${k}) = ${c}(${b}t + ${k}) → ${term(d * a, 't')} + ${d * k} = ${term(c * b, 't')} + ${c * k} → t = ${t}. Members before: ${a + b} × ${t} = ${A + B}.`,
    trap: 'Assuming the ratio terms are the actual numbers.', sub: 'Changing a ratio', skill: 'Ratio multiplier' });
} });

T({ id: 'ratiocomb', topic: 'Ratios & proportions', levels: [3, 4], make(L, R){
  const p = R.int(1, 9), q = R.int(2, 9), r = R.int(2, 9), s = R.int(1, 9); need(gcd(p, q) === 1 && gcd(r, s) === 1 && q !== r && p !== q && r !== s);
  if (L === 3){
    return ps(R, { stem: `If a:b = ${p}:${q} and b:c = ${r}:${s}, what is a:c?`, answer: ratioStr(p * r, q * s), order: 'shuffle',
      wrong: [
        [ratioStr(p, s), `a:c is not ${p}:${s}: the two ratios use different amounts for b, so b must be matched first.`, 'Trap'],
        [ratioStr(p * s, q * r), 'The scaling is upside down: make b equal in both ratios, then read a and c.', 'Procedural'],
        [ratioStr(p + r, q + s), 'Adding ratio terms has no meaning.', 'Conceptual'],
        [ratioStr(q * r, p * s), 'That is c:a flipped the wrong way; check which term goes with a.', 'Careless'],
      ].filter(w => w[0] !== ratioStr(p * r, q * s)),
      hints: ['b appears in both ratios with different numbers. Can you make them equal?', `Scale a:b by ${r} and b:c by ${q}.`, 'Key idea: match the common term using the LCM of its two values.', `a:b = ${p * r}:${q * r}, b:c = ${q * r}:${q * s}.`],
      method: `a:b:c = ${p * r}:${q * r}:${q * s} → a:c = ${ratioStr(p * r, q * s)}.`, trap: 'Reading a and c straight from the two ratios.', sub: 'Combining ratios', skill: 'Matching the common term' });
  }
  const A = p * r, Bv = q * r, Cv = q * s, g = gcd(gcd(A, Bv), Cv), tot = (A + Bv + Cv) / g, N = tot * R.int(2, 9), c = Cv / g * N / tot;
  return ps(R, { stem: `A sum of ${num(N)} dollars is split among A, B and C. The ratio of A’s share to B’s share is ${p}:${q}, and the ratio of B’s share to C’s share is ${r}:${s}. How many dollars does C receive?`, answer: c, fmt: money,
    wrong: [
      [N * s / (p + q + s), `Joining ${p}:${q} and ${r}:${s} into ${p}:${q}:${s} ignores that B has different values in the two ratios.`, 'Trap'],
      [N * Cv / (A + Cv), `B’s share has to be part of the total too.`, 'Procedural'],
      [A / g * N / tot, `That is A’s share.`, 'Reading'],
      [N / 3, 'The shares are not equal.', 'Conceptual'],
    ], positive: true, integer: true, hints: ['B is in both ratios. Match its value first.', `Scale to a common B: ${q} × ${r} = ${q * r}.`, 'Key idea: A:B:C with one value of B, then share of total = part ÷ sum of parts.',
      `A:B:C = ${A / g}:${Bv / g}:${Cv / g}.`],
    method: `A:B:C = ${A / g}:${Bv / g}:${Cv / g}, ${tot} parts. C = ${Cv / g}/${tot} × ${num(N)} = ${money(c)}.`, trap: 'Merging the ratios without matching B.', sub: 'Three-part ratios', skill: 'Matching the common term' });
} });

T({ id: 'propinv', topic: 'Ratios & proportions', levels: [3, 5], make(L, R){
  if (L <= 4){
    const k = R.int(2, 9), n = R.int(2, 12) * 10, h = R.int(2, 10), m = R.int(2, 12), p = R.int(2, 12) * 10; need(m !== k && p !== n);
    const ans = qmul(qmul(h, Q(k, m)), Q(p, n));
    need(ans.d <= 6 && +ans < 60);
    return ps(R, { stem: `Running at the same constant rate, ${k} identical machines produce ${n} parts in ${h} hours. At this rate, how many hours would ${m} of these machines take to produce ${p} parts?`, answer: ans, fmt: hrs,
      wrong: [
        [qmul(qmul(h, Q(m, k)), Q(p, n)), `More machines finish faster: multiply by ${k}/${m}, not ${m}/${k}.`, 'Conceptual'],
        [qmul(h, Q(p, n)), `The number of machines changed from ${k} to ${m}.`, 'Careless'],
        [qmul(h, Q(k, m)), `The number of parts changed from ${n} to ${p}.`, 'Careless'],
        [qmul(qmul(h, Q(k, m)), Q(n, p)), `More parts take longer: multiply by ${p}/${n}, not ${n}/${p}.`, 'Procedural'],
      ], positive: true, hints: ['How many parts does one machine make in one hour?', `${n} parts ÷ (${k} machines × ${h} hours).`, 'Key idea: work = machines × hours × rate per machine.', `One machine makes ${Q(n, k * h)} ${+Q(n, k * h) === 1 ? 'part' : 'parts'} per hour.`],
      method: `Rate = ${n} ÷ (${k} × ${h}) = ${Q(n, k * h)} parts per machine-hour. Hours = ${p} ÷ (${m} × ${Q(n, k * h)}) = ${mixed(ans)}.`, trap: 'Flipping a ratio the wrong way.', sub: 'Combined proportion', skill: 'Machine-hours' });
  }
  const w = R.int(4, 12), hd = R.int(6, 10), d = R.int(6, 30), w2 = R.int(3, 16), h2 = R.int(4, 10); need(w2 !== w && h2 !== hd);
  const ans = Q(d * w * hd, w2 * h2); need(ans.d <= 4);
  return ps(R, { stem: `${w} workers, each working ${hd} hours a day, finish a job in ${d} days. How many days would ${w2} workers, each working ${h2} hours a day at the same rate, take to finish the same job?`, answer: ans, fmt: x => mixed(x) + ' days',
    wrong: [
      [Q(d * w2 * h2, w * hd), 'The ratios are upside down: more workers or longer days mean fewer days.', 'Conceptual'],
      [Q(d * w, w2), `The hours per day changed too, from ${hd} to ${h2}.`, 'Careless'],
      [Q(d * hd, h2), `The number of workers changed too, from ${w} to ${w2}.`, 'Careless'],
      [Q(d * w * h2, w2 * hd), `Hours per day work like workers: multiply by ${hd}/${h2}, not ${h2}/${hd}.`, 'Procedural'],
    ], positive: true, hints: ['Measure the job in worker-hours.', `${w} × ${hd} × ${d} worker-hours.`, 'Key idea: total work stays the same; days = work ÷ (workers × hours per day).', `The job is ${w * hd * d} worker-hours.`],
    method: `${w} × ${hd} × ${d} = ${w * hd * d} worker-hours. ${w * hd * d} ÷ (${w2} × ${h2}) = ${mixed(ans)} days.`, trap: 'Scaling in the wrong direction.', sub: 'Inverse proportion', skill: 'Worker-hours' });
} });

/* ---------------- Rates & work */
T({ id: 'worktog', topic: 'Rates & work', levels: [2, 5], make(L, R){
  const a = R.int(2, 12), b = R.int(3, 15); need(a !== b);
  if (L <= 3){
    const ans = Q(a * b, a + b);
    return ps(R, { stem: `Working alone at its constant rate, pump A fills a tank in ${a} hours; pump B fills it in ${b} hours. How many hours do the two pumps take to fill the tank working together?`, answer: ans, fmt: hrs,
      wrong: [
        [Q(a + b, 2), 'Averaging the times: two pumps together are faster than either alone.', 'Trap'],
        [Q(a + b, 1), 'Adding the times: working together takes less time, not more.', 'Conceptual'],
        [Q(a + b, a * b), `1/${a} + 1/${b} = ${Q(a + b, a * b)} is the combined rate in tanks per hour; the time is its reciprocal.`, 'Procedural'],
        [Q(Math.min(a, b), 2), `Halving the faster time assumes both pumps are as fast as the faster one.`, 'Logic'],
      ], positive: true, hints: ['What fraction of the tank does each pump fill in one hour?', `A: 1/${a} per hour; B: 1/${b} per hour.`, 'Key idea: rates add; time = 1 ÷ combined rate.', `Combined: 1/${a} + 1/${b} = ${Q(a + b, a * b)} per hour.`],
      method: `1/${a} + 1/${b} = ${Q(a + b, a * b)} → time = ${Q(a * b, a + b)} = ${hrs(ans)}.`, alt: `Formula ab/(a + b) = ${a * b}/${a + b}.`,
      trap: 'Averaging or adding the times.', sub: 'Working together', skill: 'Adding rates' });
  }
  if (L === 4){
    const t = Q(a * b, a + b), slow = Math.max(a, b), fast = Math.min(a, b);
    return ps(R, { stem: `Working together at constant rates, printers A and B finish a job in ${mixed(t)} hours. Working alone, printer A takes ${fast} hours. How many hours would printer B take working alone?`, answer: slow, fmt: x => hrs(x),
      wrong: [
        [qsub(fast, t), `Subtracting times does not work: subtract the rates, 1/${mixed(t)} − 1/${fast}.`, 'Trap'],
        [qdiv(qmul(fast, t), qadd(fast, t)), 'Adding the rates gives a faster machine; B’s rate is the difference of the rates.', 'Procedural'],
        [qmul(2, t), 'Doubling the joint time assumes both printers work at the same rate.', 'Logic'],
        [qadd(fast, t), 'Adding the times has no meaning here.', 'Conceptual'],
      ], positive: true, hints: ['What part of the job does each printer do per hour?', `Together: 1 ÷ ${mixed(t)} = ${qdiv(1, t)} of the job per hour.`, 'Key idea: B’s rate = joint rate − A’s rate.', `${qdiv(1, t)} − 1/${fast} = ?`],
      method: `${qdiv(1, t)} − ${Q(1, fast)} = ${Q(1, slow)} → B alone takes ${slow} hours.`, trap: 'Subtracting times instead of rates.', sub: 'Finding one rate', skill: 'Subtracting rates' });
  }
  const x = R.int(1, Math.max(1, a - 1)), rem = qsub(1, Q(x, a)), ans = qdiv(rem, Q(a + b, a * b)); need(+rem > 0);
  return ps(R, { stem: `Pipe A alone fills a tank in ${a} hours and pipe B alone in ${b} hours. Pipe A runs alone for ${x} hour${x > 1 ? 's' : ''}; then pipe B is also opened. How many more hours does it take to fill the tank?`, answer: ans, fmt: hrs,
    wrong: [
      [Q(a * b, a + b), `That is the time for a full tank together; pipe A already filled ${Q(x, a)} of it.`, 'Reading'],
      [qadd(ans, x), `That counts from the start, including the ${x} hour${x > 1 ? 's' : ''} pipe A ran alone.`, 'Interpretation'],
      [qmul(rem, b), `After B opens, both pipes keep working.`, 'Careless'],
      [qdiv(rem, Q(1, a) ), `After B opens, both pipes work; A alone would take ${mixed(qmul(rem, a))} more hours.`, 'Careless'],
    ], positive: true, hints: ['How much of the tank is full when B opens?', `A fills 1/${a} per hour, so ${Q(x, a)} after ${x} hour${x > 1 ? 's' : ''}.`, 'Key idea: remaining work ÷ combined rate.', `Remaining: ${rem}. Combined rate: ${Q(a + b, a * b)}.`],
    method: `Remaining ${rem} ÷ ${Q(a + b, a * b)} = ${mixed(ans)} hours.`, trap: 'Ignoring the head start.', sub: 'Staggered work', skill: 'Remaining work' });
} });

T({ id: 'avgspeed', topic: 'Rates & work', levels: [3, 5], make(L, R){
  if (L === 3){
    const v1 = 10 * R.int(3, 9), v2 = 10 * R.int(3, 12); need(v1 !== v2);
    const ans = 2 * v1 * v2 / (v1 + v2); need(decimals(ans, 1));
    return ps(R, { stem: `A car travels from town P to town Q at an average speed of ${v1} km per hour and returns along the same road at ${v2} km per hour. What is its average speed for the whole round trip, in km per hour?`, answer: ans,
      wrong: [
        [(v1 + v2) / 2, `Averaging the speeds weights them equally, but the car spends more time at the slower speed.`, 'Trap'],
        [v1 * v2 / (v1 + v2), 'Total distance is twice the one-way distance: the factor 2 is missing.', 'Procedural'],
        [Math.abs(v1 - v2), 'The difference of the speeds is not a speed of the trip.', 'Conceptual'],
        [round(Math.sqrt(v1 * v2), 1), 'The geometric mean is not the right average for speeds over equal distances.', 'Conceptual'],
      ], positive: true, hints: ['Is the car at each speed for the same time or the same distance?', 'Pick a convenient distance, such as the LCM of the speeds.',
        'Key idea: average speed = total distance ÷ total time.', `Try a one-way distance of ${lcm(v1, v2)} km.`],
      method: `One way ${lcm(v1, v2)} km: times ${lcm(v1, v2) / v1} h and ${lcm(v1, v2) / v2} h. ${2 * lcm(v1, v2)} km ÷ ${lcm(v1, v2) / v1 + lcm(v1, v2) / v2} h = ${num(ans)} km/h.`,
      alt: `Formula 2v₁v₂/(v₁ + v₂) = ${2 * v1 * v2}/${v1 + v2}.`, trap: 'Averaging the two speeds.', sub: 'Average speed', skill: 'Total distance ÷ total time' });
  }
  const v1 = 10 * R.int(3, 9), v2 = 10 * R.int(3, 12), t1 = R.int(1, 4), t2 = R.int(1, 4); need(v1 !== v2 && t1 !== t2);
  const d1 = v1 * t1, d2 = v2 * t2, ans = (d1 + d2) / (t1 + t2); need(decimals(ans, 1));
  return ps(R, { stem: `A cyclist rides ${d1} km at ${v1} km per hour and then ${d2} km at ${v2} km per hour. What is the average speed for the whole ride, in km per hour?`, answer: ans,
    wrong: [
      [(v1 + v2) / 2, 'Averaging the speeds ignores how long each part took.', 'Trap'],
      [round((d1 * v1 + d2 * v2) / (d1 + d2), 1), 'Weighting speeds by distance is wrong; weight by time.', 'Procedural'],
      [round((d1 + d2) / 2, 1), 'Half the total distance is not a speed.', 'Conceptual'],
      [round((d1 + d2) / (t1 + t2 + 1), 1), `Recount the time: ${d1}/${v1} = ${t1} h and ${d2}/${v2} = ${t2} h.`, 'Calculation'],
    ], positive: true, hints: ['How long does each part take?', `Time = distance ÷ speed: ${d1} ÷ ${v1}.`, 'Key idea: average speed = total distance ÷ total time.', `Times: ${t1} h and ${t2} h.`],
    method: `(${d1} + ${d2}) km ÷ (${t1} + ${t2}) h = ${num(ans)} km/h.`, trap: 'Averaging the speeds.', sub: 'Average speed', skill: 'Total distance ÷ total time' });
} });

T({ id: 'meet', topic: 'Rates & work', levels: [3, 5], make(L, R){
  if (L === 3){
    const v1 = 5 * R.int(6, 20), v2 = 5 * R.int(6, 20), t = R.pick([Q(3, 2), Q(2), Q(5, 2), Q(3), Q(4), Q(9, 4)]); need(v1 !== v2);
    const d = (v1 + v2) * +t; need(isInt(d));
    return ps(R, { stem: `Two trains leave stations ${num(d)} km apart at the same time and travel toward each other on parallel tracks, one at ${v1} km per hour and the other at ${v2} km per hour. After how many hours do they meet?`, answer: t, fmt: hrs,
      wrong: [
        [Q(d, Math.abs(v1 - v2)), 'Moving toward each other, the gap closes at the sum of the speeds, not the difference.', 'Conceptual'],
        [Q(2 * d, v1 + v2), 'Each train covers only part of the distance; together they cover it once.', 'Procedural'],
        [Q(d, Math.max(v1, v2)), 'That is the time for the faster train to cover the whole distance alone.', 'Logic'],
        [Q(d, Math.min(v1, v2)), 'That is the time for the slower train to cover the whole distance alone.', 'Logic'],
      ], positive: true, hints: ['How fast does the gap between the trains shrink?', 'In one hour, each train covers its speed in km.', 'Key idea: approaching objects close the gap at the sum of their speeds.', `${v1} + ${v2} = ${v1 + v2} km per hour.`],
      method: `${num(d)} ÷ (${v1} + ${v2}) = ${mixed(t)} hours.`, trap: 'Using the difference of the speeds.', sub: 'Meeting problems', skill: 'Relative speed' });
  }
  const v1 = 10 * R.int(3, 8), v2 = v1 + 10 * R.int(1, 4), h = R.pick([1, 2, 3, Q(1, 2), Q(3, 2)]), T_ = qdiv(qmul(v1, h), v2 - v1);
  need(T_.d <= 4 && +T_ < 12);
  return ps(R, { stem: `A truck leaves a depot at ${v1} km per hour. ${mixed(h)} hour${+h === 1 ? '' : 's'} later a van leaves the same depot on the same road at ${v2} km per hour. How many hours after the van leaves does it catch up with the truck?`, answer: T_, fmt: hrs,
    wrong: [
      [qdiv(qmul(v1, h), v1 + v2), 'The van chases the truck: the gap closes at the difference of the speeds.', 'Conceptual'],
      [qadd(T_, h), 'That counts from the moment the truck left.', 'Interpretation'],
      [qdiv(qmul(v2 - v1, h), v1), 'The ratio is upside down: head start ÷ closing speed.', 'Procedural'],
      [qmul(v1, h), `${num(+qmul(v1, h))} is the truck’s head start in km, not a time.`, 'Interpretation'],
    ], positive: true, hints: ['How far ahead is the truck when the van starts?', `Head start: ${v1} × ${mixed(h)} km.`, 'Key idea: catch-up time = head start ÷ (faster speed − slower speed).', `Head start ${num(+qmul(v1, h))} km; closing speed ${v2 - v1} km/h.`],
    method: `${num(+qmul(v1, h))} ÷ (${v2} − ${v1}) = ${mixed(T_)} hours.`, trap: 'Adding the speeds when one chases the other.', sub: 'Catch-up problems', skill: 'Relative speed' });
} });

/* ---------------- Mixtures */
T({ id: 'mixpure', topic: 'Mixtures', levels: [2, 3], make(L, R){
  const a = 5 * R.int(1, 8), b = 5 * R.int(6, 18), x = 10 * R.int(1, 8), y = 10 * R.int(1, 8); need(a !== b && x !== y);
  const ans = (a * x + b * y) / (x + y); need(decimals(ans, 1));
  return ps(R, { stem: `${x} liters of a ${a}% salt solution are mixed with ${y} liters of a ${b}% salt solution. What is the salt concentration of the mixture?`, answer: ans, fmt: pct,
    wrong: [
      [(a + b) / 2, `Averaging ${a}% and ${b}% treats the two amounts as equal, but there are ${x} and ${y} liters.`, 'Trap'],
      [round((a * y + b * x) / (x + y), 1), 'The weights are swapped: each concentration goes with its own volume.', 'Procedural'],
      [round((a * x + b * y) / 100, 1), `${num((a * x + b * y) / 100)} is the amount of salt in liters; divide by the total volume.`, 'Interpretation'],
      [a + b, 'Concentrations do not add.', 'Conceptual'],
    ], positive: true, hints: ['How much salt is in each solution?', `${a}% of ${x} liters and ${b}% of ${y} liters.`, 'Key idea: concentration = total salt ÷ total volume.', `Salt: ${num(a * x / 100)} + ${num(b * y / 100)} liters.`],
    method: `Salt ${num(a * x / 100)} + ${num(b * y / 100)} = ${num((a * x + b * y) / 100)} L in ${x + y} L → ${num(ans)}%.`, trap: 'Averaging the percents.', sub: 'Weighted concentration', skill: 'Total solute ÷ total volume' });
} });

T({ id: 'mixwater', topic: 'Mixtures', levels: [4, 5], make(L, R){
  if (L === 4){
    const x = 10 * R.int(2, 12), a = 5 * R.int(3, 12), b = 5 * R.int(1, 10); need(b < a);
    if (R.chance(0.5)){
      const w = x * (a - b) / b; need(decimals(w, 1));
      return ps(R, { stem: `How many liters of water must be added to ${x} liters of a ${a}% acid solution to make a ${b}% acid solution?`, answer: w,
        wrong: [
          [round(x * (a - b) / a, 1), `The acid stays at ${num(x * a / 100)} L; the final volume must make it ${b}%, so divide by ${b}, not ${a}.`, 'Procedural'],
          [round(x * (a - b) / 100, 1), `${a - b} percentage points of ${x} liters is not the water needed.`, 'Trap'],
          [round(x * a / b, 1), `${num(x * a / b)} L is the final volume; subtract the ${x} L already there.`, 'Interpretation'],
          [round(x * b / a, 1), 'The ratio is upside down.', 'Calculation'],
        ], positive: true, hints: ['What stays the same when you add water?', `The acid: ${a}% of ${x} = ${num(x * a / 100)} liters.`, 'Key idea: the amount of solute is fixed; only the total volume changes.', `${num(x * a / 100)} must be ${b}% of the new volume.`],
        method: `Acid ${num(x * a / 100)} L = ${b}% of V → V = ${num(x * a / b)} L. Water added: ${num(x * a / b)} − ${x} = ${num(w)} L.`, trap: 'Using percentage points of the volume.', sub: 'Dilution', skill: 'Fixed solute' });
    }
    const [lo, hi] = [b, a], rm = x - x * lo / hi; need(decimals(rm, 1));
    return ps(R, { stem: `A tank holds ${x} liters of a ${lo}% sugar solution. How many liters of water must evaporate for the solution to become ${hi}% sugar?`, answer: rm,
      wrong: [
        [round(x * (hi - lo) / 100, 1), `${hi - lo} percentage points of ${x} liters does not give the water lost.`, 'Trap'],
        [round(x * lo / hi, 1), `${num(x * lo / hi)} L is what remains, not what evaporates.`, 'Interpretation'],
        [round(x * (hi - lo) / lo, 1), 'The base is wrong: the sugar is fixed at ' + num(x * lo / 100) + ' L, and it must be ' + hi + '% of what remains.', 'Procedural'],
        [round(x / 2, 1), 'Halving the volume doubles the concentration only if the target is twice the start.', 'Logic'],
      ], positive: true, hints: ['What does not evaporate?', `The sugar: ${lo}% of ${x} = ${num(x * lo / 100)} liters.`, 'Key idea: the solute is fixed; find the volume where it is the new percent.', `${num(x * lo / 100)} = ${hi}% of V.`],
      method: `V = ${num(x * lo / 100)} ÷ ${hi / 100} = ${num(x * lo / hi)} L. Evaporated: ${x} − ${num(x * lo / hi)} = ${num(rm)} L.`, trap: 'Using percentage points.', sub: 'Evaporation', skill: 'Fixed solute' });
  }
  const x = R.pick([20, 40, 50, 60, 80, 100]), fr = R.pick([Q(1, 4), Q(1, 5), Q(1, 2), Q(1, 10)]), y = x * +fr, a = R.pick([20, 40, 50, 60, 80, 90]);
  const ans = a * Math.pow(1 - +fr, 2); need(decimals(ans, 2) && isInt(y));
  return ps(R, { stem: `A ${x}-liter container is full of a ${a}% alcohol solution. ${y} liters are removed and replaced with water. Then ${y} liters of the new mixture are removed and replaced with water again. What is the alcohol concentration now?`, answer: ans, fmt: pct,
    wrong: [
      [round(a * (1 - 2 * +fr), 2), 'Removing twice is not removing 2 × ' + y + ' liters of the original: the second time the mixture is already weaker.', 'Trap'],
      [round(a * (1 - +fr), 2), 'That is the concentration after the first replacement only.', 'Careless'],
      [round(a - 2 * y, 2) > 0 ? round(a - 2 * y, 2) : null, 'Liters and percentage points cannot be subtracted from each other.', 'Conceptual'],
      [round(a * +fr * +fr, 2), 'That multiplies by the fraction removed; the fraction kept is ' + mixed(qsub(1, fr)) + '.', 'Procedural'],
    ], positive: true, hints: ['Each replacement keeps what fraction of the alcohol?', `Removing ${y} of ${x} liters keeps ${qsub(1, fr)} of everything, alcohol included.`, 'Key idea: each replacement multiplies the concentration by (1 − removed/total).', `After one: ${a}% × ${qsub(1, fr)}.`],
    method: `${a}% × (${qsub(1, fr)})² = ${num(ans)}%.`, trap: 'Treating the two removals as one larger removal.', sub: 'Repeated replacement', skill: 'Multiplicative dilution' });
} });

T({ id: 'mixtwo', topic: 'Mixtures', levels: [4, 5], make(L, R){
  const a = 5 * R.int(1, 6), b = 5 * R.int(8, 16), c = 5 * R.int(a / 5 + 1, b / 5 - 1), y = 10 * R.int(1, 10);
  const x = y * (b - c) / (c - a); need(isInt(x) && x !== y);
  return ps(R, { stem: `How many liters of a ${a}% juice drink must be mixed with ${y} liters of a ${b}% juice drink to obtain a ${c}% juice drink?`, answer: x,
    wrong: [
      [y * (c - a) / (b - c), 'The ratio is inverted: the amount of each drink is proportional to the distance of the other one from the target.', 'Trap'],
      [y, 'Equal amounts give the average, ' + (a + b) / 2 + '%, not ' + c + '%.', 'Conceptual'],
      [x + y, `${x + y} L is the total mixture.`, 'Interpretation'],
      [y * (b - c) / c, 'Set up juice before = juice after: ' + a + '% · x + ' + b + '% · ' + y + ' = ' + c + '% · (x + ' + y + ').', 'Procedural'],
    ], positive: true, integer: true, hints: ['Write one equation for the amount of juice.', `${a}% of x plus ${b}% of ${y} equals ${c}% of (x + ${y}).`,
      'Key idea (alligation): the amounts are in the ratio (distance of the other from the target).', `Distances: ${c - a} and ${b - c}.`],
    method: `${a}x + ${b * y} = ${c}(x + ${y}) → ${c - a}x = ${(b - c) * y} → x = ${x} L.`, alt: `Alligation: x : ${y} = (${b} − ${c}) : (${c} − ${a}) = ${b - c}:${c - a}.`,
    trap: 'Inverting the alligation ratio.', sub: 'Two-solution mix', skill: 'Alligation' });
} });

/* ---------------- Interest */
T({ id: 'interest', topic: 'Interest', levels: [2, 5], make(L, R){
  const P0 = 500 * R.int(2, 40), r = R.pick([4, 5, 6, 8, 10, 12, 20]), n = R.int(2, 5);
  const hints = k => ['Is the interest simple (on the original amount only) or compound (on interest too)?', 'Write the growth factor for one period.', 'Key idea: simple interest = P·r·t; compound amount = P(1 + r)^{t}.', k];
  if (L === 2){
    const I = P0 * r * n / 100;
    return ps(R, { stem: `How much simple interest does ${money(P0)} earn in ${n} years at ${r}% per year?`, answer: I, fmt: money,
      wrong: [
        [round(P0 * (Math.pow(1 + r / 100, n) - 1), 2), 'That is compound interest; simple interest is on the original amount only.', 'Conceptual'],
        [P0 + I, `${money(P0 + I)} is the total amount, principal included.`, 'Interpretation'],
        [P0 * r / 100, `${money(P0 * r / 100)} is one year of interest.`, 'Careless'],
        [P0 * r * n / 1000, 'Decimal slip: ' + r + '% = ' + r / 100 + '.', 'Calculation'],
      ], positive: true, hints: hints(`One year: ${r}% of ${money(P0)} = ${money(P0 * r / 100)}.`),
      method: `${money(P0)} × ${r / 100} × ${n} = ${money(I)}.`, trap: 'Giving the total amount instead of the interest.', sub: 'Simple interest', skill: 'P·r·t' });
  }
  if (L === 3){
    const I = round(P0 * (Math.pow(1 + r / 100, 2) - 1), 2);
    return ps(R, { stem: `${money(P0)} is invested at ${r}% annual interest, compounded annually. How much interest does it earn in 2 years?`, answer: I, fmt: money,
      wrong: [
        [2 * P0 * r / 100, `${money(2 * P0 * r / 100)} is simple interest; with compounding, the second year also earns interest on the first year’s interest.`, 'Trap'],
        [round(P0 * Math.pow(1 + r / 100, 2), 2), 'That is the final amount, principal included.', 'Interpretation'],
        [round(P0 * Math.pow(r / 100, 2), 2), `${money(P0 * Math.pow(r / 100, 2))} is only the interest on interest.`, 'Procedural'],
        [P0 * r / 100, 'That is one year of interest.', 'Careless'],
      ], positive: true, hints: hints(`After one year: ${money(P0)} × ${1 + r / 100} = ${money(P0 * (1 + r / 100))}.`),
      method: `${money(P0)} × ${1 + r / 100}² = ${money(P0 * Math.pow(1 + r / 100, 2))}; interest ${money(I)}.`, trap: 'Using simple interest.', sub: 'Compound interest', skill: 'Growth factor' });
  }
  if (L === 4){
    const d = round(P0 * Math.pow(r / 100, 2), 2);
    return ps(R, { stem: `${money(P0)} is invested for 2 years at ${r}% per year. How much more interest does it earn if interest is compounded annually than if it is simple interest?`, answer: d, fmt: money,
      wrong: [
        [round(P0 * (Math.pow(1 + r / 100, 2) - 1), 2), 'That is the whole compound interest, not the difference.', 'Interpretation'],
        [2 * P0 * r / 100, 'That is the simple interest itself.', 'Interpretation'],
        [P0 * r / 100, 'The difference is the interest earned on the first year’s interest, not a full year of interest.', 'Procedural'],
        [round(2 * P0 * Math.pow(r / 100, 2), 2), 'Only the second year earns interest on interest.', 'Logic'],
      ], positive: true, hints: hints('The first year is the same under both methods. What is different in year 2?'),
      method: `Year 1 interest ${money(P0 * r / 100)}; in year 2 compounding adds ${r}% of it: ${money(d)}.`, alt: `Formula P·r² = ${money(P0)} × ${r / 100}².`,
      trap: 'Reporting the full compound interest.', sub: 'Compound vs simple', skill: 'Interest on interest' });
  }
  const A = round(P0 * Math.pow(1 + r / 200, 2), 2);
  return ps(R, { stem: `${money(P0)} is deposited at an annual interest rate of ${r}%, compounded semiannually. What is the balance after 1 year?`, answer: A, fmt: money,
    wrong: [
      [P0 * (1 + r / 100), 'That is annual compounding; semiannual compounding pays half the rate twice.', 'Trap'],
      [round(P0 * Math.pow(1 + r / 100, 2), 2), `Each half-year earns ${r / 2}%, not ${r}%.`, 'Procedural'],
      [round(A - P0, 2), 'That is the interest only; the balance includes the deposit.', 'Interpretation'],
      [round(P0 * (1 + r / 200), 2), 'That is the balance after only 6 months.', 'Careless'],
    ], positive: true, hints: hints(`Each half-year: × (1 + ${r / 200}).`),
    method: `${money(P0)} × ${1 + r / 200}² = ${money(A)}.`, trap: 'Using the annual rate for each half-year.', sub: 'Compounding periods', skill: 'Rate per period' });
} });

/* ---------------- Overlapping sets */
T({ id: 'sets2', topic: 'Overlapping sets', levels: [2, 3], make(L, R){
  const both = R.int(3, 40), oa = R.int(3, 60), ob = R.int(3, 60), neither = R.int(L === 2 ? 0 : 2, 40);
  const A = oa + both, B = ob + both, N = oa + ob + both + neither;
  const [xa, xb, grp] = R.pick([['play chess', 'play go', 'members of a club'], ['speak French', 'speak German', 'employees'], ['own a dog', 'own a cat', 'people surveyed'], ['take biology', 'take chemistry', 'students']]);
  if (L === 2 || R.chance(0.5)){
    return ps(R, { stem: `Of the ${N} ${grp}, ${A} ${xa}, ${B} ${xb}, and ${neither} do neither. How many ${xa} and ${xb}?`, answer: both,
      wrong: [
        [neither ? A + B - N : null, `A + B − total works only when nobody is outside both groups; here ${neither} do neither.`, 'Procedural'],
        [N - neither, `${N - neither} is the number who do at least one.`, 'Interpretation'],
        [oa, `${oa} is the number who ${xa} only.`, 'Interpretation'],
        [Math.min(A, B), 'The overlap can be at most the smaller group, but it need not equal it.', 'Logic'],
      ], nonneg: true, hints: ['Draw two overlapping circles inside a box for everyone.', `${N - neither} are in at least one circle.`, 'Key idea: total = A + B − both + neither.', `${N} = ${A} + ${B} − both + ${neither}.`],
      method: `Both = ${A} + ${B} + ${neither} − ${N} = ${both}.`, trap: 'Forgetting the people in neither group.', sub: 'Two-set overlap', skill: 'Inclusion–exclusion' });
  }
  return ps(R, { stem: `Of the ${N} ${grp}, ${A} ${xa} and ${B} ${xb}. If ${both} ${xa} and ${xb}, how many do neither?`, answer: neither,
    wrong: [
      [N - A - B > 0 ? N - A - B : null, `Subtracting ${A} and ${B} removes the ${both} who do both twice.`, 'Trap'],
      [N - (A + B - both), null, null],
      [A + B - both, `${A + B - both} do at least one.`, 'Interpretation'],
      [N - A - B + 2 * both, `The overlap is added back once, not twice.`, 'Calculation'],
      [N - both, 'Subtract everyone who does at least one, not only the overlap.', 'Procedural'],
    ].filter(w => w[1]), nonneg: true, hints: ['Draw the two circles and fill in the overlap first.', `At least one: ${A} + ${B} − ${both}.`, 'Key idea: total = A + B − both + neither.', `${N} = ${A} + ${B} − ${both} + neither.`],
    method: `At least one: ${A} + ${B} − ${both} = ${A + B - both}. Neither: ${N} − ${A + B - both} = ${neither}.`, trap: 'Counting the overlap twice.', sub: 'Two-set overlap', skill: 'Inclusion–exclusion' });
} });

T({ id: 'setsmatrix', topic: 'Overlapping sets', levels: [4, 5], make(L, R){
  const N = 20 * R.int(5, 30), p1 = 5 * R.int(4, 16), p2 = 5 * R.int(2, 16), p3 = 5 * R.int(2, 12);
  const rem = N * p1 / 100, remM = rem * p2 / 100, mTot = N * p3 / 100, off = N - rem, offM = mTot - remM, offN = off - offM;
  need([rem, remM, mTot].every(isInt) && offM > 0 && offN > 0 && remM > 0);
  return ps(R, { stem: `Of the ${N} employees of a company, ${p1}% work remotely. ${p2}% of the remote employees are managers, and ${p3}% of all employees are managers. How many employees work in the office and are not managers?`, answer: offN,
    wrong: [
      [off - mTot, `Subtracting all ${mTot} managers from the ${off} office workers removes the ${remM} remote managers too.`, 'Trap'],
      [round(off * (100 - p3) / 100, 2), `${p3}% is the manager share of all employees, not of office workers.`, 'Procedural'],
      [rem - remM, `${rem - remM} are remote employees who are not managers.`, 'Reading'],
      [N - mTot, `${N - mTot} is everyone who is not a manager, remote staff included.`, 'Interpretation'],
    ], positive: true, integer: true, hints: ['Draw a 2 × 2 table: remote / office against manager / not manager.', `Remote: ${p1}% of ${N} = ${rem}.`, 'Key idea: fill the cells you can, then use row and column totals.', `Remote managers: ${p2}% of ${rem} = ${remM}. Managers in total: ${mTot}.`],
    method: `Remote ${rem}, office ${off}. Managers ${mTot}, of whom ${remM} remote → ${offM} in the office. Office non-managers: ${off} − ${offM} = ${offN}.`, trap: 'Applying a percent to the wrong group.', sub: 'Two-way table', skill: 'Matrix method' });
} });

T({ id: 'sets3', topic: 'Overlapping sets', levels: [5, 6], make(L, R){
  const r = () => R.int(2, 25), oA = r(), oB = r(), oC = r(), ab = R.int(1, 12), ac = R.int(1, 12), bc = R.int(1, 12), abc = R.int(1, 10), ne = R.int(0, 30);
  const A = oA + ab + ac + abc, B = oB + ab + bc + abc, Cc = oC + ac + bc + abc, E2 = ab + ac + bc, N = oA + oB + oC + E2 + abc + ne;
  if (L === 5){
    return ps(R, { stem: `In a survey, ${A} people use app A, ${B} use app B and ${Cc} use app C. ${E2} people use exactly two of the apps, ${abc} use${abc === 1 ? 's' : ''} all three, and ${ne} use${ne === 1 ? 's' : ''} none. How many people were surveyed?`, answer: N,
      wrong: [
        [A + B + Cc - E2 - abc + ne, `People in all three are counted three times in ${A} + ${B} + ${Cc}; subtract them twice, not once.`, 'Trap'],
        [A + B + Cc - E2 - 3 * abc + ne, 'Subtracting the triple overlap three times removes those people entirely.', 'Procedural'],
        [A + B + Cc + ne, 'People in two or three groups are counted more than once in the sum.', 'Conceptual'],
        [A + B + Cc - E2 - 2 * abc, `The ${ne} who use${ne === 1 ? 's' : ''} none ${ne === 1 ? 'is' : 'are'} part of the survey too.`, 'Careless'],
      ], positive: true, hints: ['How many times is a person in exactly two groups counted in A + B + C? In all three?', 'Exactly two: counted twice. All three: counted three times.',
        'Key idea: at least one = A + B + C − (exactly two) − 2 × (all three).', `${A} + ${B} + ${Cc} = ${A + B + Cc}.`],
      method: `At least one: ${A + B + Cc} − ${E2} − 2 × ${abc} = ${A + B + Cc - E2 - 2 * abc}. Plus none: ${N}.`, trap: 'Subtracting the triple overlap only once.', sub: 'Three-set overlap', skill: 'Exactly-two formula' });
  }
  return ps(R, { stem: `Of ${N} students, ${A} study Spanish, ${B} study Chinese and ${Cc} study Arabic; ${ne} ${ne === 1 ? 'studies' : 'study'} none of the three. If ${E2} students study exactly two of the languages, how many study all three?`, answer: abc,
    wrong: [
      [A + B + Cc - E2 - (N - ne), `Solve A + B + C − (exactly two) − 2 × (all three) = ${N - ne}: the factor 2 is missing.`, 'Trap'],
      [round((A + B + Cc - E2 - (N - ne)) / 3, 2), 'Each person in all three groups is counted 3 times, but one of those counts belongs in the total: divide by 2, not 3.', 'Procedural'],
      [(A + B + Cc - E2 - N) / 2, `The ${ne} who ${ne === 1 ? 'studies' : 'study'} none ${ne === 1 ? 'is' : 'are'} not in any group.`, 'Careless'],
      [(A + B + Cc - (N - ne)) / 2, 'The exactly-two group has to come out first.', 'Procedural'],
    ], positive: true, integer: true, hints: ['How many students study at least one language?', `${N} − ${ne} = ${N - ne}.`, 'Key idea: at least one = A + B + C − (exactly two) − 2 × (all three).', `${N - ne} = ${A + B + Cc} − ${E2} − 2x.`],
    method: `${A + B + Cc} − ${E2} − 2x = ${N - ne} → 2x = ${2 * abc} → x = ${abc}.`, trap: 'Subtracting the triple overlap only once.', sub: 'Three-set overlap', skill: 'Exactly-two formula' });
} });

/* ---------------- Statistics */
T({ id: 'meanremove', topic: 'Statistics', levels: [3, 4], make(L, R){
  const n = R.int(5, 12), m = R.int(10, 60), add = L === 4;
  if (!add){
    const m2 = m + R.int(-6, 6) || m + 1, v = n * m - (n - 1) * m2; need(v > 0 && m2 !== m);
    return ps(R, { stem: `The average of ${n} numbers is ${m}. When one of the numbers is removed, the average of the remaining numbers is ${m2}. What number was removed?`, answer: v,
      wrong: [
        [Math.abs(m - m2), `The averages differ by ${Math.abs(m - m2)}, but the removed number is not that difference.`, 'Trap'],
        [n * Math.abs(m - m2), 'Sum before minus sum after: the second sum has ' + (n - 1) + ' numbers, not ' + n + '.', 'Procedural'],
        [m, 'Removing a number equal to the average would leave the average unchanged.', 'Logic'],
        [n * m - n * m2 + m2 === v ? v + m2 : n * m - n * m2 + m2, 'Recount the sums: ' + n + ' × ' + m + ' and ' + (n - 1) + ' × ' + m2 + '.', 'Calculation'],
      ], hints: ['Turn each average into a sum.', `Sum of ${n} numbers: ${n} × ${m}.`, 'Key idea: removed number = old sum − new sum.', `Old sum ${n * m}; new sum ${n - 1} × ${m2} = ${(n - 1) * m2}.`],
      method: `${n * m} − ${(n - 1) * m2} = ${v}.`, trap: 'Working with averages instead of sums.', sub: 'Average after removal', skill: 'Sum = average × count' });
  }
  const m2 = m + R.int(1, 6), v = (n + 1) * m2 - n * m;
  return ps(R, { stem: `The average score on ${n} tests is ${m}. What score on the next test would raise the average of all ${n + 1} tests to ${m2}?`, answer: v,
    wrong: [
      [m2, `A score of ${m2} would leave the average below ${m2}; the new score must also make up the shortfall of the earlier tests.`, 'Trap'],
      [m2 + (m2 - m), `The shortfall is ${m2 - m} on each of ${n} tests, not on one.`, 'Procedural'],
      [n * m2 - n * m, `That is only the total shortfall; the new test must also score ${m2} itself.`, 'Procedural'],
      [(n + 1) * m2 - n * m - n, 'Recount: new sum ' + (n + 1) + ' × ' + m2 + ' minus old sum ' + n + ' × ' + m + '.', 'Calculation'],
    ], hints: ['Turn each average into a sum.', `Current sum: ${n} × ${m} = ${n * m}.`, 'Key idea: needed score = target sum − current sum.', `Target sum: ${n + 1} × ${m2} = ${(n + 1) * m2}.`],
    method: `${(n + 1) * m2} − ${n * m} = ${v}.`, alt: `Each old test is ${m2 - m} short: ${m2} + ${n} × ${m2 - m} = ${v}.`, trap: 'Scoring exactly the target average.', sub: 'Raising an average', skill: 'Sum = average × count' });
} });

T({ id: 'median', topic: 'Statistics', levels: [2, 4], make(L, R){
  const k = L === 2 ? R.pick([7, 9]) : R.pick([6, 8]), xs = []; while (xs.length < k){ const v = R.int(2, 60); if (!xs.includes(v)) xs.push(v); }
  const s = xs.slice().sort((a, b) => a - b), med = k % 2 ? s[(k - 1) / 2] : (s[k / 2 - 1] + s[k / 2]) / 2, mean = sum(xs) / k;
  const unsortedMid = k % 2 ? xs[(k - 1) / 2] : (xs[k / 2 - 1] + xs[k / 2]) / 2;
  need(unsortedMid !== med && decimals(mean, 2));
  if (L === 4){
    const d = round(Math.abs(mean - med), 2); need(d > 0);
    return ps(R, { stem: `What is the positive difference between the mean and the median of the list ${xs.join(', ')}?`, answer: d,
      wrong: [
        [round(Math.abs(mean - unsortedMid), 2), 'The median is the middle of the sorted list, not of the list as written.', 'Trap'],
        [round(Math.abs(mean - s[k / 2 - 1]), 2), `With ${k} numbers the median is the average of the two middle values, ${s[k / 2 - 1]} and ${s[k / 2]}.`, 'Procedural'],
        [round(Math.abs(mean - s[k / 2]), 2), `With ${k} numbers the median is the average of the two middle values, ${s[k / 2 - 1]} and ${s[k / 2]}.`, 'Procedural'],
        [round(Math.abs(sum(xs) / (k - 1) - med), 2), `Divide the sum by ${k}, the number of values.`, 'Calculation'],
      ], nonneg: true, hints: ['Sort the list first.', `Sorted: ${s.join(', ')}.`, 'Key idea: median = middle value (average of the two middle values for an even count); mean = sum ÷ count.', `Sum = ${sum(xs)}.`],
      method: `Mean ${sum(xs)}/${k} = ${num(mean)}; median (${s[k / 2 - 1]} + ${s[k / 2]})/2 = ${num(med)}; difference ${num(d)}.`, trap: 'Taking the middle of the unsorted list.', sub: 'Mean vs median', skill: 'Sorting first' });
  }
  return ps(R, { stem: `What is the median of the list ${xs.join(', ')}?`, answer: med,
    wrong: [
      [unsortedMid, 'The median is the middle of the sorted list, not of the list as written.', 'Trap'],
      [round(mean, 2), `${num(mean)} is the mean.`, 'Conceptual'],
      [k % 2 ? s[(k - 1) / 2 - 1] : s[k / 2 - 1], 'Off by one position in the sorted list.', 'Careless'],
      [k % 2 ? s[(k + 1) / 2] : s[k / 2], 'Off by one position in the sorted list.', 'Careless'],
    ], hints: ['What must you do to a list before finding its middle?', `There are ${k} numbers.`, 'Key idea: the median is the middle value of the sorted list.', `Sorted: ${s.join(', ')}.`],
    method: `Sorted: ${s.join(', ')} → median ${num(med)}.`, trap: 'Not sorting.', sub: 'Median', skill: 'Sorting first' });
} });

T({ id: 'meannew', topic: 'Statistics', levels: [3, 5], make(L, R){
  if (L <= 4){
    const n1 = R.int(10, 40), n2 = R.int(10, 40), a = R.int(60, 90), b = R.int(50, 95); need(n1 !== n2 && a !== b);
    const ans = (n1 * a + n2 * b) / (n1 + n2); need(decimals(ans, 1));
    return ps(R, { stem: `A class of ${n1} students had an average score of ${a}, and a class of ${n2} students had an average score of ${b}. What was the average score of all ${n1 + n2} students?`, answer: ans,
      wrong: [
        [(a + b) / 2, 'Averaging the two averages treats the classes as the same size.', 'Trap'],
        [round((n1 * b + n2 * a) / (n1 + n2), 1), 'The weights are swapped: each average goes with its own class size.', 'Procedural'],
        [round((n1 * a + n2 * b) / Math.max(n1, n2), 1), 'Divide by the total number of students.', 'Calculation'],
        [round(Math.max(a, b) - Math.abs(a - b) / 4, 1), 'Guessing a point between the two averages is not a calculation.', 'Guessing'],
      ], positive: true, hints: ['Which class has more weight?', 'Turn each average into a total.', 'Key idea: combined average = total of all scores ÷ total count.', `Totals: ${n1} × ${a} and ${n2} × ${b}.`],
      method: `(${n1 * a} + ${n2 * b}) ÷ ${n1 + n2} = ${num(ans)}.`, trap: 'Averaging the averages.', sub: 'Weighted average', skill: 'Totals, not averages' });
  }
  const n = R.int(6, 20), m = R.int(20, 80), k = R.int(2, n - 1), c = R.int(2, 15), ans = m + k * c / n; need(decimals(ans, 2));
  return ps(R, { stem: `The average of ${n} numbers is ${m}. If ${k} of the numbers are each increased by ${c}, what is the new average?`, answer: ans,
    wrong: [
      [m + c, `Only ${k} of the ${n} numbers change, so the average rises by less than ${c}.`, 'Trap'],
      [m + k * c, `The total rises by ${k * c}; the average rises by ${k * c} ÷ ${n}.`, 'Procedural'],
      [round(m + c * n / k, 2), 'The fraction is upside down: ' + k + '/' + n + ' of the numbers change.', 'Calculation'],
      [round(m + c / n, 2), `Each of the ${k} numbers adds ${c} to the total.`, 'Careless'],
    ], positive: true, hints: ['By how much does the total change?', `${k} numbers × ${c} each.`, 'Key idea: new average = old average + (change in total ÷ count).', `Total rises by ${k * c}.`],
    method: `${m} + ${k * c}/${n} = ${num(ans)}.`, trap: 'Adding the whole increase to the average.', sub: 'Changing an average', skill: 'Change in total ÷ count' });
} });

T({ id: 'sdchange', topic: 'Statistics', levels: [4, 5], make(L, R){
  const m = R.int(10, 60), s = R.int(2, 12), k = R.pick([2, 3, 4, 5]), c = R.int(3, 20), neg = L === 5 && R.chance(0.5), kk = neg ? -k : k;
  const what = R.pick(L === 4 ? ['standard deviation', 'mean'] : ['standard deviation', 'range', 'mean']);
  const rng_ = s * 3, desc = `each value is multiplied by ${num(kk)} and then ${c} is added to it`;
  const given = `A data set has mean ${m}, standard deviation ${s}${what === 'range' ? ` and range ${rng_}` : ''}.`;
  if (what === 'mean'){
    const ans = kk * m + c;
    return ps(R, { stem: `${given} If ${desc}, what is the mean of the new data set?`, answer: ans,
      wrong: [
        [kk * (m + c), 'The order matters: multiply first, then add ' + c + '.', 'Procedural'],
        [kk * m, `Adding ${c} to every value raises the mean by ${c}.`, 'Careless'],
        [m + c, `Multiplying every value by ${num(kk)} multiplies the mean too.`, 'Careless'],
        [kk * s + c, 'That uses the standard deviation instead of the mean.', 'Reading'],
      ], hints: ['What happens to the mean if every value doubles? If every value rises by 5?', 'Apply the two steps in order.', 'Key idea: the mean follows every operation applied to all values.', `${num(kk)} × ${m} first.`],
      method: `New mean = ${num(kk)} × ${m} + ${c} = ${num(ans)}.`, trap: 'Applying the steps in the wrong order.', sub: 'Transforming data', skill: 'Linear transformations' });
  }
  const base = what === 'range' ? rng_ : s, ans = Math.abs(kk) * base;
  return ps(R, { stem: `${given} If ${desc}, what is the ${what} of the new data set?`, answer: ans,
    wrong: [
      [Math.abs(kk) * base + c, `Adding ${c} to every value shifts the data without spreading it: the ${what} does not change.`, 'Trap'],
      [base, `Multiplying every value by ${num(kk)} stretches the gaps between values by ${k}.`, 'Conceptual'],
      [what === 'standard deviation' ? k * k * base : null, 'The variance is multiplied by ' + k * k + '; the standard deviation by ' + k + '.', 'Procedural'],
      [neg ? kk * base : base + c, neg ? `A ${what} is never negative: multiplying by ${num(kk)} scales it by |${num(kk)}| = ${k}.` : `Adding ${c} does not change the ${what}.`, neg ? 'Conceptual' : 'Trap'],
      [kk * m + c, 'That is the new mean.', 'Reading'],
    ], hints: [`Does adding the same number to every value change how spread out they are?`, 'Does multiplying every value by ' + num(kk) + ' change the spread?',
      `Key idea: the ${what} ignores additions and is multiplied by the absolute value of the multiplier.`, `|${num(kk)}| × ${base}.`],
    method: `Adding ${c} leaves the ${what} unchanged; multiplying by ${num(kk)} multiplies it by ${k}: ${k} × ${base} = ${ans}.`, trap: 'Letting an added constant change the spread.', sub: 'Transforming data', skill: 'Spread under transformations' });
} });

/* ---------------- Counting */
T({ id: 'committee', topic: 'Counting', levels: [3, 5], make(L, R){
  const n = R.int(7, 12), k = R.int(3, Math.min(5, n - 3));
  if (L === 3){
    const ans = C(n, k);
    return ps(R, { stem: `In how many ways can a committee of ${k} be chosen from ${n} people?`, answer: ans,
      wrong: [
        [P(n, k), `${num(P(n, k))} counts ordered lists; a committee has no order, so divide by ${k}! = ${fact(k)}.`, 'Trap'],
        [C(n, k - 1), `That chooses ${k - 1} people, not ${k}.`, 'Careless'],
        [n * k, 'Multiplying the two numbers does not count selections.', 'Conceptual'],
        [Math.pow(n, k) <= 1e7 ? Math.pow(n, k) : C(n, k) * 2, 'That allows the same person to be chosen more than once, in order.', 'Conceptual'],
      ], positive: true, hints: ['Does the order in which people are picked matter?', 'Count ordered picks first, then remove the repeats.', 'Key idea: unordered selections = C(n, k) = n! ÷ (k!(n − k)!).', `Ordered: ${Array.from({ length: k }, (_, i) => n - i).join(' × ')} = ${num(P(n, k))}.`],
      method: `C(${n}, ${k}) = ${num(P(n, k))} ÷ ${fact(k)} = ${num(ans)}.`, trap: 'Counting ordered lists.', sub: 'Combinations', skill: 'C(n, k)' });
  }
  const g = R.int(2, Math.min(5, n - 2));
  if (L === 4){
    const ans = C(n, k) - C(n - g, k); need(ans > 0 && C(n - g, k) > 0);
    return ps(R, { stem: `A committee of ${k} is chosen from ${n} people, ${g} of whom are doctors. How many committees include at least one doctor?`, answer: ans,
      wrong: [
        [g * C(n - 1, k - 1), `Choosing “one doctor, then anyone” counts committees with several doctors more than once.`, 'Trap'],
        [C(n - g, k), `${num(C(n - g, k))} is the number of committees with no doctor.`, 'Interpretation'],
        [g * C(n - g, k - 1), `${num(g * C(n - g, k - 1))} counts committees with exactly one doctor.`, 'Interpretation'],
        [C(n, k), `${num(C(n, k))} is every committee, with or without a doctor.`, 'Reading'],
      ], positive: true, hints: ['Is it easier to count the committees you do not want?', 'Committees with no doctor use only the other ' + (n - g) + ' people.', 'Key idea: at least one = all − none.', `All: C(${n}, ${k}) = ${num(C(n, k))}.`],
      method: `C(${n}, ${k}) − C(${n - g}, ${k}) = ${num(C(n, k))} − ${num(C(n - g, k))} = ${num(ans)}.`, trap: 'Fixing one doctor and choosing the rest freely.', sub: 'At least one', skill: 'Complement counting' });
  }
  const ans = C(n, k) - C(n - 2, k - 2);
  return ps(R, { stem: `A committee of ${k} is chosen from ${n} people. Two of the people, Ana and Ben, refuse to serve together. How many committees are possible?`, answer: ans,
    wrong: [
      [C(n - 2, k), 'That leaves out both Ana and Ben, but either one may serve without the other.', 'Procedural'],
      [C(n - 2, k - 2), `${num(C(n - 2, k - 2))} is the number of committees with both of them.`, 'Interpretation'],
      [C(n, k) - 2 * C(n - 1, k - 1), 'That removes every committee with Ana and every committee with Ben, far more than the ones with both.', 'Logic'],
      [C(n, k) - C(n - 2, k - 2) * 2, 'Ana and Ben together is one case; subtract it once.', 'Calculation'],
    ], positive: true, hints: ['Count all committees, then remove the forbidden ones.', 'A forbidden committee contains both Ana and Ben.', 'Key idea: allowed = all − (those with both).', `With both: choose the other ${k - 2} from ${n - 2}.`],
    method: `C(${n}, ${k}) − C(${n - 2}, ${k - 2}) = ${num(C(n, k))} − ${num(C(n - 2, k - 2))} = ${num(ans)}.`, trap: 'Removing everyone who might cause a conflict.', sub: 'Restrictions', skill: 'Complement counting' });
} });

T({ id: 'together', topic: 'Counting', levels: [3, 5], make(L, R){
  const n = R.int(5, 9), [A, B, Cn] = R.sample(['Ada', 'Ben', 'Carla', 'Dev', 'Eli', 'Fay', 'Gus', 'Hana'], 3), v = R.int(0, 1);
  if (L === 3 && v === 0){
    const ans = 2 * fact(n - 1);
    return ps(R, { stem: `In how many ways can ${n} people sit in a row of ${n} chairs if two of them, ${A} and ${B}, must sit next to each other?`, answer: ans,
      wrong: [
        [fact(n - 1), `${A} and ${B} can swap places inside their pair: multiply by 2.`, 'Procedural'],
        [fact(n), `${num(fact(n))} ignores the condition.`, 'Reading'],
        [fact(n) - 2 * fact(n - 1), 'That counts the arrangements where they are apart.', 'Interpretation'],
        [2 * fact(n - 2), `Gluing the pair gives ${n - 1} units to arrange, not ${n - 2}.`, 'Calculation'],
      ], positive: true, hints: ['Treat the pair as one block.', `Then there are ${n - 1} units to arrange.`, 'Key idea: glue the pair, arrange the units, then arrange inside the pair.', `${n - 1}! = ${num(fact(n - 1))}.`],
      method: `${n - 1}! × 2 = ${num(fact(n - 1))} × 2 = ${num(ans)}.`, trap: 'Forgetting the order inside the pair.', sub: 'Arrangements with a block', skill: 'Glue method' });
  }
  if (L === 3){
    const ans = 6 * fact(n - 2);
    return ps(R, { stem: `In how many ways can ${n} people sit in a row of ${n} chairs if three of them, ${A}, ${B} and ${Cn}, must sit next to one another?`, answer: ans,
      wrong: [
        [fact(n - 2), `The three friends can be arranged in 3! = 6 orders inside their block.`, 'Procedural'],
        [3 * fact(n - 2), `Three people can be ordered in 3! = 6 ways, not 3.`, 'Calculation'],
        [6 * fact(n - 3), `Gluing three people into one block leaves ${n - 2} units, not ${n - 3}.`, 'Calculation'],
        [fact(n), `${num(fact(n))} ignores the condition.`, 'Reading'],
      ], positive: true, hints: ['Treat the three friends as one block.', `Then there are ${n - 2} units to arrange.`, 'Key idea: glue the group, arrange the units, then arrange inside the group.', `${n - 2}! = ${num(fact(n - 2))}.`],
      method: `${n - 2}! × 3! = ${num(fact(n - 2))} × 6 = ${num(ans)}.`, trap: 'Forgetting the order inside the block.', sub: 'Arrangements with a block', skill: 'Glue method' });
  }
  if (L === 4 && v === 0){
    const ans = fact(n) - 2 * fact(n - 1);
    return ps(R, { stem: `In how many ways can ${n} people sit in a row of ${n} chairs if two of them, ${A} and ${B}, must not sit next to each other?`, answer: ans,
      wrong: [
        [2 * fact(n - 1), 'That counts the arrangements where they do sit together.', 'Interpretation'],
        [fact(n) - fact(n - 1), `The pair can sit as ${A}–${B} or ${B}–${A}: subtract 2 × ${n - 1}!.`, 'Procedural'],
        [fact(n), `${num(fact(n))} ignores the condition.`, 'Reading'],
        [fact(n) / 2, 'Halving assumes they sit together half the time.', 'Trap'],
      ], positive: true, hints: ['Is it easier to count the arrangements where they are together?', 'Together: glue the pair.', 'Key idea: apart = all − together.', `All: ${n}! = ${num(fact(n))}.`],
      method: `${n}! − 2 × ${n - 1}! = ${num(fact(n))} − ${num(2 * fact(n - 1))} = ${num(ans)}.`, trap: 'Assuming half of the arrangements separate them.', sub: 'Arrangements with a restriction', skill: 'Complement counting' });
  }
  if (L === 4){
    const ans = 2 * fact(n - 2);
    return ps(R, { stem: `In how many ways can ${n} people sit in a row of ${n} chairs if ${A} and ${B} must sit in the two end chairs?`, answer: ans,
      wrong: [
        [fact(n - 2), `${A} can take the left end and ${B} the right, or the other way round: multiply by 2.`, 'Procedural'],
        [2 * fact(n - 1), `Once the ends are filled, ${n - 2} people remain for ${n - 2} chairs.`, 'Calculation'],
        [fact(n - 1), 'Fix the two ends first, then arrange the others.', 'Procedural'],
        [fact(n), `${num(fact(n))} ignores the condition.`, 'Reading'],
      ], positive: true, hints: ['Which chairs are fixed by the condition?', `${A} and ${B} take the two ends.`, 'Key idea: fill the restricted places first, then the rest.', `The ends: 2 ways. The middle ${n - 2} chairs: ${n - 2}!.`],
      method: `2 × ${n - 2}! = 2 × ${num(fact(n - 2))} = ${num(ans)}.`, trap: 'Forgetting that the two can swap ends.', sub: 'Fixed positions', skill: 'Restricted places first' });
  }
  if (v === 0){
    const ans = 2 * fact(n - 2);
    return ps(R, { stem: `In how many ways can ${n} people sit around a circular table if two of them, ${A} and ${B}, must sit next to each other? (Arrangements that differ only by a rotation are the same.)`, answer: ans,
      wrong: [
        [2 * fact(n - 1), `Around a circle, rotations are the same arrangement: ${n - 1} units give (${n - 1} − 1)! arrangements.`, 'Trap'],
        [fact(n - 2), `${A} and ${B} can swap places inside their pair.`, 'Procedural'],
        [fact(n - 1), `${num(fact(n - 1))} is every circular arrangement, with no condition.`, 'Reading'],
        [2 * fact(n - 1) / n, 'Recount: glue the pair, then fix one unit to remove rotations.', 'Calculation'],
      ], positive: true, integer: true, hints: ['How many arrangements do n people have around a circle?', 'Circular: (n − 1)!, because rotations are identical.', 'Key idea: glue the pair into one unit, arrange the units around the circle, then swap inside the pair.', `${n - 1} units around a circle: ${n - 2}! ways.`],
      method: `${n - 1} units → (${n - 1} − 1)! = ${num(fact(n - 2))}; × 2 = ${num(ans)}.`, trap: 'Counting rotations as different.', sub: 'Circular arrangements', skill: 'Fix one seat' });
  }
  const ans = fact(n - 1) - 2 * fact(n - 2);
  return ps(R, { stem: `In how many ways can ${n} people sit around a circular table if ${A} and ${B} must not sit next to each other? (Arrangements that differ only by a rotation are the same.)`, answer: ans,
    wrong: [
      [fact(n) - 2 * fact(n - 1), 'That is the count for a row; around a circle, rotations are the same arrangement.', 'Trap'],
      [fact(n - 1) - fact(n - 2), `The pair can sit as ${A}–${B} or ${B}–${A}: subtract 2 × ${n - 2}!.`, 'Procedural'],
      [2 * fact(n - 2), 'That counts the arrangements where they do sit together.', 'Interpretation'],
      [fact(n - 1), `${num(fact(n - 1))} is every circular arrangement, with no condition.`, 'Reading'],
    ], positive: true, hints: ['Count all circular arrangements, then remove the ones you do not want.', `All: (${n} − 1)! = ${num(fact(n - 1))}.`, 'Key idea: apart = all − together; together = glue the pair, then (units − 1)! × 2.', `Together: ${n - 1} units → ${n - 2}! × 2.`],
    method: `${num(fact(n - 1))} − 2 × ${num(fact(n - 2))} = ${num(ans)}.`, trap: 'Using the row formula for a circle.', sub: 'Circular arrangements', skill: 'Complement counting' });
} });

T({ id: 'codes', topic: 'Counting', levels: [3, 5], make(L, R){
  const k = R.int(3, 5);
  if (L === 3){
    const d = R.int(5, 9), rep = R.chance(0.5), ans = rep ? Math.pow(d, k) : P(d, k);
    return ps(R, { stem: `A code consists of ${k} symbols chosen from ${d} different symbols${rep ? ', and symbols may repeat' : '; no symbol may be used more than once'}. How many codes are possible?`, answer: ans,
      wrong: [
        [rep ? P(d, k) : Math.pow(d, k), rep ? 'Symbols may repeat, so every position has all ' + d + ' choices.' : 'Symbols cannot repeat, so each position has one fewer choice than the one before.', 'Reading'],
        [C(d, k), 'The order of symbols in a code matters.', 'Trap'],
        [d * k, `${d} × ${k} multiplies the number of symbols by the length; the choices for the ${k} positions multiply with each other instead.`, 'Conceptual'],
        [Math.pow(k, d), `${k}^{${d}} swaps the roles: ${d} choices for each of ${k} positions is ${d}^{${k}}.`, 'Procedural'],
      ], positive: true, hints: ['How many choices for the first symbol? For the second?', rep ? 'Repeats are allowed.' : 'Each symbol can be used once.', 'Key idea: multiply the choices for each position.', `First position: ${d} choices.`],
      method: rep ? `${d}^{${k}} = ${num(ans)}.` : `${Array.from({ length: k }, (_, i) => d - i).join(' × ')} = ${num(ans)}.`, trap: 'Using combinations for ordered codes.', sub: 'Codes', skill: 'Multiplication principle' });
  }
  const total = 9 * Math.pow(10, k - 1), distinct = 9 * P(9, k - 1), v = R.int(0, 2);
  const count = f => { let c = 0; for (let x = Math.pow(10, k - 1); x < Math.pow(10, k); x++) if (f(String(x))) c++; return c; };
  const uniq = d => new Set(d).size === d.length;
  if (L === 4 && v === 0){
    return ps(R, { stem: `How many ${k}-digit positive integers have no repeated digits?`, answer: distinct,
      wrong: [
        [P(10, k), 'A number cannot start with 0: the first digit has 9 choices.', 'Trap'],
        [total, `${num(total)} is every ${k}-digit number, repeats allowed.`, 'Reading'],
        [Math.pow(9, k), 'After the first digit, 0 becomes available: the second digit has 9 choices, the third 8, and so on.', 'Procedural'],
        [C(10, k), 'The order of digits matters.', 'Conceptual'],
      ], positive: true, hints: ['Which digit has a special restriction?', 'The first digit cannot be 0.', 'Key idea: fill the most restricted position first.', 'First digit: 9 choices (1–9). Second: 9 (0 is now allowed, one digit is used).'],
      method: `9 × ${Array.from({ length: k - 1 }, (_, i) => 9 - i).join(' × ')} = ${num(distinct)}.`, trap: 'Letting the number start with 0.', sub: 'Digits without repetition', skill: 'Restricted first position' });
  }
  if (L === 4){
    const odd = v === 1, ans = Math.pow(5, k);
    return ps(R, { stem: `How many ${k}-digit positive integers have only ${odd ? 'odd' : 'even'} digits?`, answer: odd ? ans : 4 * Math.pow(5, k - 1),
      wrong: odd ? [
        [P(5, k), 'Digits may repeat: each position has all 5 odd digits.', 'Reading'],
        [total / 2, 'Half of all numbers are odd, but that depends on the last digit only; here every digit must be odd.', 'Interpretation'],
        [Math.pow(5, k - 1), `Each of the ${k} positions has 5 choices, the first one included.`, 'Careless'],
        [4 * Math.pow(5, k - 1), 'The first digit can be any odd digit: 0 is not odd, so no special case is needed.', 'Procedural'],
        [Math.pow(k, 5), `${k}^{5} swaps the roles: 5 choices for each of ${k} positions is 5^{${k}}.`, 'Procedural'],
      ] : [
        [Math.pow(5, k), 'The first digit cannot be 0: it has 4 choices (2, 4, 6, 8).', 'Trap'],
        [4 * P(4, k - 1), 'Digits may repeat.', 'Reading'],
        [total / 2, 'Half of all numbers are even, but that is about the last digit, not every digit.', 'Interpretation'],
        [Math.pow(4, k), 'After the first digit, 0 is allowed: 5 choices for each later position.', 'Procedural'],
      ], positive: true, integer: true, hints: [`Which digits are ${odd ? 'odd' : 'even'}?`, odd ? 'There are 5 odd digits: 1, 3, 5, 7, 9.' : 'There are 5 even digits: 0, 2, 4, 6, 8, but a number cannot start with 0.', 'Key idea: multiply the choices for each position.', odd ? `5 choices for each of ${k} positions.` : `First digit: 4 choices; each later digit: 5.`],
      method: odd ? `5^{${k}} = ${num(ans)}.` : `4 × 5^{${k - 1}} = ${num(4 * Math.pow(5, k - 1))}.`, trap: odd ? 'Assuming digits cannot repeat.' : 'Letting the number start with 0.', sub: 'Digit restrictions', skill: 'Multiplication principle' });
  }
  const k2 = R.int(3, 4);
  if (v === 0){
    return ps(R, { stem: `How many ${k}-digit positive integers have at least one repeated digit?`, answer: total - distinct,
      wrong: [
        [distinct, `${num(distinct)} is the number with no repeated digit.`, 'Interpretation'],
        [total - P(10, k), 'Numbers cannot start with 0: there are ' + num(distinct) + ' with all digits different, not ' + num(P(10, k)) + '.', 'Trap'],
        [Math.pow(10, k) - P(10, k), 'Strings starting with 0 are not ' + k + '-digit numbers.', 'Procedural'],
        [total, `${num(total)} is every ${k}-digit number.`, 'Reading'],
      ], positive: true, hints: ['“At least one” is usually easiest through its complement.', `All ${k}-digit numbers: 9 × 10^{${k - 1}}.`, 'Key idea: at least one repeat = all − all distinct.', `All distinct: 9 × ${Array.from({ length: k - 1 }, (_, i) => 9 - i).join(' × ')}.`],
      method: `${num(total)} − ${num(distinct)} = ${num(total - distinct)}.`, trap: 'Counting strings that start with 0.', sub: 'At least one repeat', skill: 'Complement counting' });
  }
  const kk = k2, dist = 9 * P(9, kk - 1), tot = 9 * Math.pow(10, kk - 1);
  const cnt2 = f => { let c = 0; for (let x = Math.pow(10, kk - 1); x < Math.pow(10, kk); x++) if (f(String(x))) c++; return c; };
  if (v === 1){
    const ans = cnt2(d => uniq(d) && +d[d.length - 1] % 2 === 0), zero = P(9, kk - 1), other = 4 * 8 * P(8, kk - 2);
    return ps(R, { stem: `How many ${kk}-digit even positive integers have no repeated digits?`, answer: ans,
      wrong: [
        [5 * 9 * P(8, kk - 2), 'Treating 0 like the other even digits: when the last digit is 0, the first digit has 9 choices, otherwise only 8.', 'Trap'],
        [other, `Those are the numbers ending in 2, 4, 6 or 8; the ${num(zero)} ending in 0 are missing.`, 'Procedural'],
        [dist / 2, 'Exactly half of the numbers with distinct digits are not even: 0 is an even digit that can only sit at the end.', 'Logic'],
        [zero, `Those are only the numbers ending in 0.`, 'Careless'],
      ], positive: true, integer: true, hints: ['Which positions have restrictions?', 'The last digit must be even; the first cannot be 0.', 'Key idea: split into cases — last digit 0, or last digit 2, 4, 6, 8.', `Last digit 0: ${P(9, kk - 1)} numbers.`],
      method: `Last digit 0: 9 × ${Array.from({ length: kk - 2 }, (_, i) => 8 - i).join(' × ')} = ${num(zero)}. Last digit 2, 4, 6 or 8: 4 × 8 × ${Array.from({ length: kk - 2 }, (_, i) => 8 - i).join(' × ')} = ${num(other)}. Total ${num(ans)}.`,
      trap: 'Ignoring that 0 is both an even digit and forbidden in front.', sub: 'Cases with digits', skill: 'Splitting into cases' });
  }
  const ans = cnt2(d => uniq(d) && (d[d.length - 1] === '0' || d[d.length - 1] === '5')), z = P(9, kk - 1), f5 = 8 * P(8, kk - 2);
  return ps(R, { stem: `How many ${kk}-digit positive integers divisible by 5 have no repeated digits?`, answer: ans,
    wrong: [
      [2 * P(9, kk - 1), 'When the last digit is 5, the first digit cannot be 0 or 5: only 8 choices.', 'Trap'],
      [z, 'Those are only the numbers ending in 0.', 'Careless'],
      [f5, 'Those are only the numbers ending in 5.', 'Careless'],
      [Math.round(dist / 5), 'Divisibility by 5 depends on the last digit only; count the two cases.', 'Logic'],
    ], positive: true, integer: true, hints: ['Which last digits make a number divisible by 5?', 'The last digit is 0 or 5.', 'Key idea: split into cases by the last digit; the first digit cannot be 0.', `Last digit 0: 9 × ${Array.from({ length: kk - 2 }, (_, i) => 8 - i).join(' × ')}.`],
    method: `Ending in 0: ${num(z)}. Ending in 5: 8 × ${Array.from({ length: kk - 2 }, (_, i) => 8 - i).join(' × ')} = ${num(f5)}. Total ${num(ans)}.`,
    trap: 'Ignoring that the first digit cannot be 0.', sub: 'Cases with digits', skill: 'Splitting into cases' });
} });

/* ---------------- Probability */
T({ id: 'atleast', topic: 'Probability', levels: [3, 4], make(L, R){
  const b = R.pick([2, 3, 4, 5, 6]), a = R.int(1, b - 1), n = L === 3 ? 2 : R.int(3, 4), p = Q(a, b), q = Q(b - a, b);
  const none = Q(Math.pow(b - a, n), Math.pow(b, n)), ans = qsub(1, none);
  const ctx = R.pick(['a free throw', 'a coin-operated game', 'a quality check', 'a lottery ticket']);
  return ps(R, { stem: `Each attempt at ${ctx} succeeds with probability ${p}, independently of the others. What is the probability of at least one success in ${n} attempts?`, answer: ans,
    wrong: [
      [+qmul(n, p) < 1 ? qmul(n, p) : null, `Adding ${n} × ${p} counts the cases with several successes more than once.`, 'Trap'],
      [Q(Math.pow(a, n), Math.pow(b, n)), `${Q(Math.pow(a, n), Math.pow(b, n))} is the probability that every attempt succeeds.`, 'Interpretation'],
      [none, `${none} is the probability of no success at all.`, 'Interpretation'],
      [qsub(1, Q(Math.pow(a, n), Math.pow(b, n))), `1 − (${p})^{${n}} is the probability that not every attempt succeeds.`, 'Procedural'],
      [p, `${p} is the chance for one attempt only.`, 'Careless'],
    ], hints: ['What is the opposite of “at least one success”?', 'The opposite is “no success at all”.', 'Key idea: P(at least one) = 1 − P(none), and independent probabilities multiply.', `P(fail once) = ${q}.`],
    method: `P(none) = (${q})^{${n}} = ${none}. P(at least one) = 1 − ${none} = ${ans}.`, trap: 'Adding the probabilities.', sub: 'At least one', skill: 'Complement rule' });
} });

T({ id: 'draw', topic: 'Probability', levels: [3, 5], make(L, R){
  const r = R.int(2, 8), bl = R.int(2, 8), N = r + bl;
  if (L === 3){
    const ans = Q(r * (r - 1), N * (N - 1));
    return ps(R, { stem: `A bag holds ${r} red and ${bl} blue marbles. Two marbles are drawn at random without replacement. What is the probability that both are red?`, answer: ans,
      wrong: [
        [Q(r * r, N * N), 'That assumes replacement: after one red is drawn, there are ' + (r - 1) + ' red among ' + (N - 1) + '.', 'Trap'],
        [Q(r, N), `${Q(r, N)} is the chance for the first marble only.`, 'Careless'],
        [Q(r - 1, N - 1), `${Q(r - 1, N - 1)} is only the second draw, given the first was red.`, 'Procedural'],
        [Q(C(r, 2), C(N, 2) + r), 'Recount the pairs: C(' + N + ', 2) = ' + C(N, 2) + ' equally likely pairs.', 'Calculation'],
      ], hints: ['Does the first draw change the second?', 'Without replacement, the bag has one marble fewer.', 'Key idea: multiply the probability of each draw given the ones before.', `First red: ${Q(r, N)}.`],
      method: `${Q(r, N)} × ${Q(r - 1, N - 1)} = ${ans}.`, alt: `C(${r}, 2)/C(${N}, 2) = ${C(r, 2)}/${C(N, 2)}.`, trap: 'Treating the draws as independent.', sub: 'Without replacement', skill: 'Conditional multiplication' });
  }
  if (L === 4){
    const ans = Q(2 * r * bl, N * (N - 1));
    return ps(R, { stem: `A bag holds ${r} red and ${bl} blue marbles. Two marbles are drawn at random without replacement. What is the probability that they are of different colors?`, answer: ans,
      wrong: [
        [Q(r * bl, N * (N - 1)), 'Red then blue is only one order; blue then red is another.', 'Procedural'],
        [Q(2 * r * bl, N * N), 'Without replacement the second draw is out of ' + (N - 1) + '.', 'Trap'],
        [qsub(1, Q(2 * r * bl, N * (N - 1))), 'That is the probability of the same color.', 'Interpretation'],
        [Q(r * bl, C(N, 2) * 2), 'Recount: ' + r + ' × ' + bl + ' mixed pairs out of C(' + N + ', 2) = ' + C(N, 2) + ' pairs.', 'Calculation'],
      ], hints: ['In how many orders can you get one of each color?', 'Red then blue, or blue then red.', 'Key idea: add the probabilities of the separate orders.', `Red then blue: ${Q(r, N)} × ${Q(bl, N - 1)}.`],
      method: `2 × ${r}/${N} × ${bl}/${N - 1} = ${ans}.`, alt: `${r} × ${bl} mixed pairs ÷ C(${N}, 2) = ${r * bl}/${C(N, 2)}.`, trap: 'Counting only one order.', sub: 'Without replacement', skill: 'Both orders' });
  }
  const g = R.int(2, 6), T3 = r + bl + g, ans = Q(r * bl * g * 6, T3 * (T3 - 1) * (T3 - 2));
  return ps(R, { stem: `A box holds ${r} red, ${bl} blue and ${g} green pens. Three pens are taken at random without replacement. What is the probability that the three pens have three different colors?`, answer: ans,
    wrong: [
      [Q(r * bl * g, T3 * (T3 - 1) * (T3 - 2)), 'That is one specific order (red, blue, green); there are 3! = 6 orders.', 'Procedural'],
      [Q(r * bl * g * 6, T3 * T3 * T3), 'Without replacement the pool shrinks: ' + T3 + ', ' + (T3 - 1) + ', ' + (T3 - 2) + '.', 'Trap'],
      [Q(r * bl * g, C(T3, 3) * 6), 'With unordered selections, divide ' + r * bl * g + ' by C(' + T3 + ', 3) = ' + C(T3, 3) + ' only.', 'Calculation'],
      [qsub(1, ans), 'That is the probability that at least two pens share a color.', 'Interpretation'],
    ], hints: ['Count the favourable selections, then all selections.', 'One of each color: ' + r + ' × ' + bl + ' × ' + g + ' choices.', 'Key idea: with unordered selections, favourable ÷ C(total, 3).', `C(${T3}, 3) = ${C(T3, 3)}.`],
    method: `${r} × ${bl} × ${g} = ${r * bl * g}; ÷ C(${T3}, 3) = ${C(T3, 3)} → ${ans}.`, trap: 'Counting a single order.', sub: 'Without replacement', skill: 'Counting favourable selections' });
} });

T({ id: 'dice', topic: 'Probability', levels: [3, 4], make(L, R){
  const outcomes = []; for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) outcomes.push([a, b]);
  if (L === 3){
    const s = R.int(3, 11), f = outcomes.filter(([a, b]) => a + b === s).length, un = outcomes.filter(([a, b]) => a <= b && a + b === s).length;
    return ps(R, { stem: `Two fair six-sided dice are rolled. What is the probability that the sum of the numbers rolled is ${s}?`, answer: Q(f, 36),
      wrong: [
        [Q(1, 11), 'The 11 possible sums are not equally likely.', 'Conceptual'],
        [Q(un, 36) + 0 === +Q(f, 36) ? Q(un, 21) : Q(un, 36), 'Counting unordered pairs undercounts: (a, b) and (b, a) are different outcomes.', 'Trap'],
        [Q(un, 21), 'The 36 ordered outcomes are equally likely; the 21 unordered pairs are not.', 'Conceptual'],
        [Q(f + 1, 36), 'Recount the pairs that give ' + s + '.', 'Calculation'],
      ], hints: ['How many equally likely outcomes are there?', '6 × 6 = 36 ordered outcomes.', 'Key idea: list the ordered pairs that give the sum.', `Pairs for ${s}: start with (${Math.max(1, s - 6)}, ${s - Math.max(1, s - 6)}).`],
      method: `${f} ordered pairs give ${s}: ${f}/36 = ${Q(f, 36)}.`, trap: 'Treating (2, 3) and (3, 2) as one outcome.', sub: 'Two dice', skill: 'Ordered outcomes' });
  }
  const s = R.int(5, 10), f = outcomes.filter(([a, b]) => a + b >= s && a !== b).length;
  return ps(R, { stem: `Two fair six-sided dice are rolled. What is the probability that the sum is at least ${s} and the two numbers are different?`, answer: Q(f, 36),
    wrong: [
      [Q(outcomes.filter(([a, b]) => a + b >= s).length, 36), 'That includes doubles such as (' + Math.ceil(s / 2) + ', ' + Math.ceil(s / 2) + '), which the question excludes.', 'Reading'],
      [Q(f / 2, 21), 'The 21 unordered pairs are not equally likely.', 'Conceptual'],
      [Q(f / 2, 36), 'Each unordered pair of different numbers is two outcomes.', 'Trap'],
      [Q(outcomes.filter(([a, b]) => a + b > s && a !== b).length, 36), '“At least ' + s + '” includes ' + s + '.', 'Reading'],
    ], hints: ['List the outcomes as a 6 × 6 grid.', `Mark the sums of ${s} or more.`, 'Key idea: count ordered pairs, then remove doubles.', 'Doubles are (1, 1) … (6, 6).'],
    method: `Ordered pairs with sum ≥ ${s}: ${outcomes.filter(([a, b]) => a + b >= s).length}; minus doubles: ${outcomes.filter(([a, b]) => a + b >= s && a === b).length} → ${f}/36 = ${Q(f, 36)}.`, trap: 'Forgetting to remove doubles, or using unordered pairs.', sub: 'Two dice', skill: 'Grid counting' });
} });

/* ---------------- Sequences */
T({ id: 'arith', topic: 'Sequences', levels: [2, 4], make(L, R){
  const a1 = R.int(-20, 30), d = R.pick([-7, -5, -4, -3, 2, 3, 4, 5, 6, 7, 9, 11]), p = R.int(2, 6), q = p + R.int(3, 10), r = q + R.int(5, 40);
  const t = n => a1 + (n - 1) * d;
  return ps(R, { stem: L === 2 ? `The first term of an arithmetic sequence is ${num(a1)} and each term after the first is ${d > 0 ? d + ' more' : -d + ' less'} than the term before it. What is the ${ord(r)} term?`
      : `In an arithmetic sequence, the ${ord(p)} term is ${num(t(p))} and the ${ord(q)} term is ${num(t(q))}. What is the ${ord(r)} term?`, answer: t(r),
    wrong: [
      [a1 + r * d, `The ${ord(r)} term is ${r - 1} steps after the first, not ${r}.`, 'Careless'],
      [L === 2 ? a1 + (r - 2) * d : t(q) + (r - p) * d, L === 2 ? 'One step short.' : `Starting from the ${ord(q)} term you need ${r - q} steps, not ${r - p}.`, 'Procedural'],
      [L === 2 ? r * d : (t(q) - t(p)) / (q - p + 1) * (r - 1) + a1, L === 2 ? 'The first term has to be included.' : `Between the ${p}th and ${q}th terms there are ${q - p} steps, not ${q - p + 1}.`, 'Calculation'],
      [t(r) - 2 * d, 'Recount the number of steps from a term whose value you know.', 'Calculation'],
    ], integer: true, hints: ['How much does the sequence change from one term to the next?', L === 2 ? `Each step adds ${num(d)}.` : `From term ${p} to term ${q}: ${q - p} steps.`, 'Key idea: the nth term = first term + (n − 1) × difference.', L === 2 ? `Term ${r} is ${r - 1} steps after term 1.` : `Difference d = (${num(t(q))} − ${num(t(p))}) ÷ ${q - p} = ${num(d)}.`],
    method: L === 2 ? `${num(a1)} + (${r} − 1) × ${par(d)} = ${num(t(r))}.` : `d = ${num(d)}. Term ${r} = term ${q} + (${r} − ${q}) × ${par(d)} = ${num(t(q))} ${signed((r - q) * d)} = ${num(t(r))}.`,
    trap: 'Counting n steps to the nth term instead of n − 1.', sub: 'Arithmetic sequences', skill: 'nth term' });
} });

T({ id: 'seqsum', topic: 'Sequences', levels: [3, 4], make(L, R){
  const k = R.int(3, 9), A = R.int(10, 60), B = A + R.int(40, 200), f = Math.ceil(A / k) * k, l = Math.floor(B / k) * k, n = (l - f) / k + 1, S = n * (f + l) / 2;
  need(f !== A || l !== B || L === 3);
  return ps(R, { stem: `What is the sum of all multiples of ${k} from ${A} to ${B}, inclusive?`, answer: S,
    wrong: [
      [(n - 1) * (f + l) / 2, `There are ${n} multiples, not ${n - 1}: (last − first) ÷ ${k} + 1.`, 'Careless'],
      [n * (A + B) / 2, `The average of the multiples is (${f} + ${l}) ÷ 2, not the average of the range ends ${A} and ${B}.`, 'Trap'],
      [(n + 1) * (f + l) / 2, `There are ${n} multiples, not ${n + 1}.`, 'Careless'],
      [Math.floor((B - A) / k) * (f + l) / 2 === S ? S + f : Math.floor((B - A) / k) * (f + l) / 2, `Count the multiples from the first (${f}) to the last (${l}).`, 'Procedural'],
    ], integer: true, positive: true, hints: ['Which are the first and last multiples in the range?', `First: ${f}. Last: ${l}.`, 'Key idea: sum of an evenly spaced list = number of terms × average of first and last.', `Number of terms: (${l} − ${f}) ÷ ${k} + 1.`],
    method: `${n} terms, average (${f} + ${l}) ÷ 2 = ${num((f + l) / 2)} → ${num(S)}.`, trap: 'Using the range ends instead of the first and last multiples.', sub: 'Sum of a sequence', skill: 'Count × average' });
} });

T({ id: 'recur', topic: 'Sequences', levels: [4, 6], make(L, R){
  if (L <= 5){
    const c = R.pick([2, 3, -2]), e = R.int(-5, 6), a1 = R.int(-4, 6), k = L === 4 ? 5 : 6;
    need(e !== 0);
    const a = [null, a1]; for (let i = 2; i <= k + 1; i++) a.push(c * a[i - 1] + e);
    need(Math.abs(a[k]) < 5000);
    return ps(R, { stem: `A sequence is defined by a_{1} = ${num(a1)} and a_{n} = ${num(c)}a_{n−1} ${signed(e)} for n > 1. What is a_{${k}}?`, answer: a[k],
      wrong: [
        [a[k - 1], `That is a_{${k - 1}}: one step short.`, 'Careless'],
        [a[k + 1], `That is a_{${k + 1}}: one step too far.`, 'Careless'],
        [Math.pow(c, k - 1) * a1, `Multiplying by ${num(c)} alone forgets the ${signed(e)} at every step.`, 'Procedural'],
        [c * a[k - 1] - e, 'Sign slip in the last step.', 'Calculation'],
      ], integer: true, hints: ['Compute the terms one at a time.', `a_{2} = ${num(c)} × ${num(a1)} ${signed(e)}.`, 'Key idea: write each term in a list so you do not lose count.', `a_{2} = ${num(a[2])}.`],
      method: `${a.slice(1, k + 1).map((v, i) => `a_{${i + 1}} = ${num(v)}`).join(', ')}.`, trap: 'Stopping one term early or late.', sub: 'Recursive sequences', skill: 'Step-by-step terms' });
  }
  const x = R.int(1, 9), y = R.int(-9, 9); need(y !== x && y !== 0 && x !== 0);
  const seq = [x, y]; for (let i = 2; i < 12; i++) seq.push(seq[i - 1] - seq[i - 2]);
  const N = R.int(40, 300), ans = seq[(N - 1) % 6];
  return ps(R, { stem: `In a sequence, a_{1} = ${num(x)}, a_{2} = ${num(y)}, and a_{n} = a_{n−1} − a_{n−2} for n > 2. What is a_{${N}}?`, answer: ans,
    wrong: [
      [seq[N % 6], `The pattern repeats every 6 terms: a_{${N}} = a_{${(N - 1) % 6 + 1}}, not a_{${N % 6 + 1}}.`, 'Procedural'],
      [seq[(N - 2) % 6], 'One position off in the cycle.', 'Careless'],
      [-ans, 'Sign slip: recompute the six terms of the cycle.', 'Calculation'],
      [seq[(N - 1) % 5], 'The cycle has length 6, not 5.', 'Procedural'],
    ], integer: true, hints: ['Write out the first eight terms.', `a_{3} = ${num(y)} − ${num(x)} = ${num(seq[2])}.`, 'Key idea: this sequence repeats every 6 terms.', `Terms: ${seq.slice(0, 7).map(v => num(v)).join(', ')}, …`],
    method: `Cycle ${seq.slice(0, 6).map(v => num(v)).join(', ')}. ${N} = 6 × ${Math.floor((N - 1) / 6)} + ${(N - 1) % 6 + 1} → a_{${N}} = a_{${(N - 1) % 6 + 1}} = ${num(ans)}.`, trap: 'Miscounting the position in the cycle.', sub: 'Periodic sequences', skill: 'Finding the cycle' });
} });

/* ---------------- Linear equations */
T({ id: 'linsys', topic: 'Linear equations', levels: [2, 5], make(L, R){
  const x = R.int(-8, 12), y = R.int(-8, 12); need(x !== y && x !== 0 && y !== 0);
  const eq = (a, b) => `${term(a, 'x')} ${b < 0 ? '−' : '+'} ${term(Math.abs(b), 'y')} = ${num(a * x + b * y)}`;
  if (L <= 3){
    const [a1, b1, a2, b2] = [R.int(1, 5), R.int(-4, 5), R.int(1, 5), R.int(-4, 5)]; need(a1 * b2 - a2 * b1 !== 0 && b1 && b2);
    return ps(R, { stem: `If ${eq(a1, b1)} and ${eq(a2, b2)}, what is the value of x?`, answer: x,
      wrong: [
        [y, `${num(y)} is the value of y.`, 'Interpretation'],
        [-x, 'Sign slip while eliminating.', 'Calculation'],
        [x + y, `${num(x + y)} is x + y.`, 'Interpretation'],
        [(a1 * x + b1 * y) - (a2 * x + b2 * y), 'Subtracting the equations eliminates nothing unless a coefficient matches first.', 'Procedural'],
      ], integer: true, hints: ['Can you make the y-coefficients equal and opposite?', `Multiply the first equation by ${Math.abs(b2)} and the second by ${Math.abs(b1)}.`, 'Key idea: elimination — scale, then add or subtract to remove one variable.', 'Then solve for x.'],
      method: `Eliminate y: x = ${num(x)} (and y = ${num(y)}). Check: ${eq(a1, b1)}.`, trap: 'Reporting y, or a sign slip.', sub: 'Two equations', skill: 'Elimination' });
  }
  if (L === 4){
    const a = R.int(2, 7), b = R.int(1, 6); need(a !== b);
    const c1 = a * x + b * y, c2 = b * x + a * y, ask = R.pick(['x + y', 'x − y']);
    const ans = ask === 'x + y' ? x + y : x - y;
    return ps(R, { stem: `If ${a}x + ${b}y = ${num(c1)} and ${b}x + ${a}y = ${num(c2)}, what is the value of ${ask}?`, answer: ans,
      wrong: [
        [ask === 'x + y' ? x - y : x + y, `That is ${ask === 'x + y' ? 'x − y' : 'x + y'}.`, 'Reading'],
        [ask === 'x + y' ? c1 + c2 : c1 - c2, `${ask === 'x + y' ? 'Adding' : 'Subtracting'} gives ${a + (ask === 'x + y' ? b : -b)}(${ask}); divide by ${a + (ask === 'x + y' ? b : -b)}.`, 'Procedural'],
        [x, `${num(x)} is x alone.`, 'Interpretation'],
        [ask === 'x + y' ? (c1 + c2) / 2 : (c1 - c2) / 2, `Divide by ${ask === 'x + y' ? a + b : a - b}, not by 2.`, 'Calculation'],
      ], integer: true, hints: ['Look at the pattern of the coefficients.', 'What happens if you add the two equations? If you subtract them?', `Key idea: adding gives ${a + b}(x + y); subtracting gives ${a - b}(x − y).`, `${ask === 'x + y' ? 'Add' : 'Subtract'} the equations.`],
      method: ask === 'x + y' ? `Add: ${a + b}(x + y) = ${num(c1 + c2)} → x + y = ${num(ans)}.` : `Subtract: ${a - b}(x − y) = ${num(c1 - c2)} → x − y = ${num(ans)}.`, alt: 'Solving for x and y separately works but takes longer.',
      trap: 'Solving the whole system when one step is enough.', sub: 'Symmetric systems', skill: 'Combining equations' });
  }
  const a = R.int(1, 6), b = R.int(1, 6), d = R.int(2, 6), c = R.int(1, 20), e = R.int(1, 20), k = b * d / a;
  need(isInt(k) && k !== b && c * d !== a * e);
  return ps(R, { stem: `For which value of k does the system ${a}x + ${b}y = ${c}, ${d}x + ky = ${e} have no solution?`, answer: k,
    wrong: [
      [a * d / b, `The coefficients must be in the same ratio: ${a}/${d} = ${b}/k, so k = ${b} × ${d} ÷ ${a}.`, 'Procedural'],
      [-k, 'Sign slip: the lines must be parallel, with equal slopes.', 'Calculation'],
      [b, `k = ${b} would need ${d} = ${a} for parallel lines.`, 'Logic'],
      [isInt(b * e / c) ? b * e / c : null, 'Matching the constants does not make the lines parallel.', 'Conceptual'],
    ], integer: true, hints: ['When does a system of two lines have no solution?', 'The lines must be parallel and different.', 'Key idea: no solution when a₁/a₂ = b₁/b₂ ≠ c₁/c₂.', `${a}/${d} = ${b}/k.`],
    method: `${a}/${d} = ${b}/k → k = ${num(k)}; and ${a}/${d} ≠ ${c}/${e}, so the lines are parallel and distinct.`, trap: 'Setting up the ratio upside down.', sub: 'Systems with no solution', skill: 'Parallel lines' });
} });

T({ id: 'linword', topic: 'Linear equations', levels: [3, 4], make(L, R){
  const pa = R.int(6, 20), pc = R.int(2, pa - 2), A = R.int(10, 80), Cn = R.int(10, 80), T_ = A + Cn, Rv = pa * A + pc * Cn;
  return ps(R, { stem: `A theater sold ${T_} tickets for a total of ${money(Rv)}. Adult tickets cost ${money(pa)} and child tickets cost ${money(pc)}. How many child tickets were sold?`, answer: Cn,
    wrong: [
      [A, `${A} is the number of adult tickets.`, 'Interpretation'],
      [T_ % 2 === 0 ? T_ / 2 : null, 'Assuming half of the tickets were for children.', 'Trap'],
      [isInt(Rv / (pa + pc)) ? Rv / (pa + pc) : null, 'Dividing the revenue by the sum of the prices assumes equal numbers of each ticket.', 'Conceptual'],
      [isInt((Rv - pc * T_) / pc) ? (Rv - pc * T_) / pc : null, `If every ticket were a child ticket, revenue would be ${money(pc * T_)}; each adult ticket adds ${money(pa - pc)}, so divide the gap by ${pa - pc}.`, 'Procedural'],
      [isInt((pa * T_ - Rv) / pa) ? (pa * T_ - Rv) / pa : null, `The gap of ${money(pa * T_ - Rv)} shrinks by ${money(pa - pc)} (the price difference) for each child ticket, not by ${money(pa)}.`, 'Procedural'],
      [Cn + (pa - pc), 'Recheck with the two equations.', 'Calculation'],
    ], positive: true, integer: true, hints: ['Two unknowns: how many equations do you have?', 'One equation counts tickets, one counts dollars.', `Key idea: a + c = ${T_}, ${pa}a + ${pc}c = ${Rv}.`, `If all ${T_} were adult tickets, revenue would be ${money(pa * T_)}.`],
    method: `All adult: ${money(pa * T_)}; actual ${money(Rv)}; gap ${money(pa * T_ - Rv)}; each child ticket saves ${money(pa - pc)} → ${Cn} child tickets.`, alt: `Solve a + c = ${T_}, ${pa}a + ${pc}c = ${Rv}.`,
    trap: 'Answering with the adult tickets.', sub: 'Word equations', skill: 'Two-variable systems' });
} });

/* ---------------- Quadratics & functions */
T({ id: 'quadsq', topic: 'Quadratics & functions', levels: [3, 5], make(L, R){
  const r1 = R.int(-9, 9), r2 = R.int(-9, 9); need(r1 !== r2 && r1 && r2 && r1 !== -r2);
  const S = r1 + r2, Pd = r1 * r2, poly = `x^{2} ${S === 0 ? '' : signed(-S) + 'x '}${signed(Pd)} = 0`.replace('+ 1x', '+ x').replace('− 1x', '− x');
  if (L === 3){
    const d = Math.abs(r1 - r2);
    return ps(R, { stem: `What is the positive difference between the two solutions of ${poly}?`, answer: d,
      wrong: [
        [Math.abs(S), `${Math.abs(S)} is the absolute value of the sum of the solutions.`, 'Interpretation'],
        [Math.abs(Pd), `${Math.abs(Pd)} is the absolute value of the product.`, 'Interpretation'],
        [Math.max(r1, r2), `${Math.max(r1, r2)} is the larger solution itself.`, 'Interpretation'],
        [Math.abs(Math.abs(r1) - Math.abs(r2)), 'Sign slip: the roots are ' + num(Math.min(r1, r2)) + ' and ' + num(Math.max(r1, r2)) + '.', 'Calculation'],
      ], positive: true, hints: ['Can you factor the quadratic?', `Find two numbers with product ${num(Pd)} and sum ${num(S)}.`, 'Key idea: x² − (sum)x + product = (x − r₁)(x − r₂).', `Try ${num(r1)} and ${num(r2)}.`],
      method: `(x ${signed(-r1)})(x ${signed(-r2)}) = 0 → x = ${num(r1)} or ${num(r2)}; difference ${d}.`, trap: 'Sign slips when reading the roots from the factors.', sub: 'Factoring', skill: 'Roots from factors' });
  }
  if (L === 4){
    const ans = S * S - 2 * Pd;
    return ps(R, { stem: `If r and s are the solutions of ${poly}, what is r^{2} + s^{2}?`, answer: ans,
      wrong: [
        [S * S, '(r + s)² = r² + 2rs + s², not r² + s².', 'Trap'],
        [S * S + 2 * Pd, 'Sign slip: r² + s² = (r + s)² − 2rs.', 'Calculation'],
        [S * S - 4 * Pd, `${num(S * S - 4 * Pd)} is (r − s)².`, 'Procedural'],
        [S * S - Pd, 'Subtract 2rs, not rs.', 'Procedural'],
      ], positive: true, hints: ['Do you need the roots themselves?', `r + s = ${num(S)} and rs = ${num(Pd)}.`, 'Key idea: r² + s² = (r + s)² − 2rs.', `(${num(S)})² − 2(${num(Pd)}).`],
      method: `${par(S)}² − 2 × ${par(Pd)} = ${num(ans)}.`, alt: `Roots ${num(r1)} and ${num(r2)}: ${r1 * r1} + ${r2 * r2} = ${ans}.`, trap: 'Squaring the sum.', sub: 'Sum and product of roots', skill: 'Symmetric expressions' });
  }
  const ans = Q(S, Pd); need(S !== 0);
  return ps(R, { stem: `If r and s are the solutions of ${poly}, what is 1/r + 1/s?`, answer: ans,
    wrong: [
      [Q(1, S), '1/r + 1/s is not 1/(r + s).', 'Trap'],
      [Q(Pd, S), 'Upside down: 1/r + 1/s = (r + s)/rs.', 'Procedural'],
      [Q(-S, Pd), 'Sign slip: for x² − (sum)x + product, the sum of the roots is ' + num(S) + '.', 'Calculation'],
      [Q(2, S), 'That is not the sum of the reciprocals.', 'Calculation'],
    ], hints: ['Add the fractions.', '1/r + 1/s = (s + r)/(rs).', 'Key idea: sum of roots and product of roots come from the coefficients.', `r + s = ${num(S)}, rs = ${num(Pd)}.`],
    method: `(r + s)/rs = ${num(S)}/${num(Pd)} = ${ans}.`, trap: 'Writing 1/(r + s).', sub: 'Sum and product of roots', skill: 'Symmetric expressions' });
} });

T({ id: 'funccomp', topic: 'Quadratics & functions', levels: [3, 4], make(L, R){
  const a = R.pick([-3, -2, 2, 3, 4, 5]), b = R.int(-9, 9), c = R.int(1, 9), k = R.int(-4, 5);
  const f = x => a * x + b, g = x => x * x - c;
  const fs = `${term(a, 'x')} ${signed(b)}`, gs = `x^{2} − ${c}`;
  if (L === 3){
    const ans = f(g(k)); need(f(g(k)) !== g(f(k)));
    return ps(R, { stem: `If f(x) = ${fs} and g(x) = ${gs}, what is f(g(${num(k)}))?`, answer: ans,
      wrong: [
        [g(f(k)), `${num(g(f(k)))} is g(f(${num(k)})): the inner function goes first.`, 'Trap'],
        [f(k) * g(k), 'f(g(x)) is a composition, not a product.', 'Conceptual'],
        [f(k) + g(k), 'f(g(x)) is a composition, not a sum.', 'Conceptual'],
        [a * (k * k) - c + b === ans ? ans + 2 * c : a * k * k - c + b, `Apply f to all of g(${num(k)}) = ${num(g(k))}: ${num(a)} × ${par(g(k))} ${signed(b)}.`, 'Procedural'],
      ], integer: true, hints: ['Which function acts first?', `Start inside: g(${num(k)}).`, 'Key idea: f(g(k)) means compute g(k), then feed it to f.', `g(${num(k)}) = ${num(g(k))}.`],
      method: `g(${num(k)}) = ${num(g(k))}; f(${num(g(k))}) = ${num(ans)}.`, trap: 'Applying the functions in the wrong order.', sub: 'Composition', skill: 'Inside out' });
  }
  const t = R.int(-5, 6), V = f(g(t)), sols = [-Math.abs(t), Math.abs(t)].filter((v, i, arr) => arr.indexOf(v) === i);
  need(t !== 0);
  return ps(R, { stem: `If f(x) = ${fs} and g(x) = ${gs}, what is the greatest value of x for which f(g(x)) = ${num(V)}?`, answer: Math.abs(t),
    wrong: [
      [-Math.abs(t), `x² = ${t * t} has two solutions, ${Math.abs(t)} and −${Math.abs(t)}; the greater is ${Math.abs(t)}.`, 'Careless'],
      [t * t, `${t * t} is x², not x.`, 'Interpretation'],
      [V - b, 'Undo f first: ' + num(a) + '·g(x) ' + signed(b) + ' = ' + num(V) + '.', 'Procedural'],
      [isInt((V - b) / a) ? (V - b) / a : 2 * Math.abs(t), (isInt((V - b) / a) ? `${num((V - b) / a)} is g(x), not x.` : 'Recheck the equation.'), 'Interpretation'],
    ], integer: true, hints: ['Undo f first to find g(x).', `${num(a)}·g(x) ${signed(b)} = ${num(V)} → g(x) = ${num((V - b) / a)}.`, 'Key idea: work from the outside in — undo f, then solve g(x) = that value.', `x² − ${c} = ${num((V - b) / a)}.`],
    method: `g(x) = ${num((V - b) / a)} → x² = ${t * t} → x = ±${Math.abs(t)}; the greater is ${Math.abs(t)}.`, trap: 'Stopping at g(x) instead of solving for x.', sub: 'Composition', skill: 'Solving inside out' });
} });

T({ id: 'diffsq', topic: 'Quadratics & functions', levels: [3, 4], make(L, R){
  const x = R.int(3, 30), y = R.int(1, 25); need(x > y && x - y !== x + y);
  const D = x * x - y * y, S = x + y;
  if (L === 3){
    return ps(R, { stem: `If x^{2} − y^{2} = ${num(D)} and x + y = ${S}, what is x − y?`, answer: x - y,
      wrong: [
        [D - S, 'x² − y² factors; it is not reduced by subtracting x + y.', 'Conceptual'],
        [isInt(Math.sqrt(D)) ? Math.sqrt(D) : x, isInt(Math.sqrt(D)) ? '√(x² − y²) is not x − y.' : `${x} is x.`, isInt(Math.sqrt(D)) ? 'Trap' : 'Interpretation'],
        [D * S > 10000 ? null : D / S + S, 'Divide, and stop there.', 'Careless'],
        [x, `${x} is x itself.`, 'Interpretation'],
        [y, `${y} is y.`, 'Interpretation'],
      ], positive: true, integer: true, hints: ['Can x² − y² be factored?', 'x² − y² = (x + y)(x − y).', 'Key idea: difference of squares.', `${S}(x − y) = ${num(D)}.`],
      method: `(x + y)(x − y) = ${num(D)} → x − y = ${num(D)} ÷ ${S} = ${x - y}.`, trap: 'Taking a square root of the difference.', sub: 'Difference of squares', skill: 'Factoring' });
  }
  return ps(R, { stem: `If x^{2} − y^{2} = ${num(D)} and x + y = ${S}, what is the value of y?`, answer: y,
    wrong: [
      [x, `${x} is x; y = (${S} − ${x - y}) ÷ 2.`, 'Interpretation'],
      [x - y, `${x - y} is x − y.`, 'Interpretation'],
      [(S + x - y) / 2 === x ? S - (x - y) : (S + x - y) / 2, 'Solve the two linear equations x + y = ' + S + ' and x − y = ' + (x - y) + '.', 'Calculation'],
      [S / 2, 'Halving x + y assumes x = y.', 'Logic'],
    ], positive: true, hints: ['Factor the difference of squares.', `${S}(x − y) = ${num(D)}, so x − y = ${x - y}.`, 'Key idea: add or subtract x + y and x − y.', `Subtract: 2y = ${S} − ${x - y}.`],
    method: `x − y = ${num(D)} ÷ ${S} = ${x - y}. Then 2y = ${S} − ${x - y} = ${2 * y} → y = ${y}.`, trap: 'Stopping at x − y.', sub: 'Difference of squares', skill: 'Factoring' });
} });

/* ---------------- Inequalities & absolute value */
T({ id: 'abscount', topic: 'Inequalities & absolute value', levels: [3, 5], make(L, R){
  const a = R.int(-10, 12), b = R.int(3, 12);
  const count = pred => { let n = 0; for (let x = -200; x <= 200; x++) if (pred(x)) n++; return n; };
  if (L === 3){
    const strict = R.chance(0.5), ans = count(x => strict ? Math.abs(x - a) < b : Math.abs(x - a) <= b);
    const expr = `|x ${signed(-a)}| ${strict ? '<' : '≤'} ${b}`.replace('|x + 0|', '|x|').replace('|x − 0|', '|x|');
    return ps(R, { stem: `How many integers x satisfy ${expr}?`, answer: ans,
      wrong: [
        [strict ? 2 * b + 1 : 2 * b - 1, strict ? `The endpoints ${num(a - b)} and ${num(a + b)} do not satisfy a strict inequality.` : `The endpoints ${num(a - b)} and ${num(a + b)} satisfy ≤ and count.`, 'Reading'],
        [2 * b, 'Count the integers in the interval including the centre: (right − left) + 1 for a closed interval.', 'Procedural'],
        [strict ? b - 1 : b + 1, 'That counts one side of the centre only: |x − a| < b allows x on both sides of a.', 'Conceptual'],
        [strict ? b : b, `${b} is the distance, not the number of integers.`, 'Interpretation'],
      ], positive: true, hints: ['What does |x − a| mean on the number line?', `|x ${signed(-a)}| is the distance from x to ${num(a)}.`, 'Key idea: |x − a| < b ⟺ a − b < x < a + b.', `Here: ${num(a - b)} ${strict ? '<' : '≤'} x ${strict ? '<' : '≤'} ${num(a + b)}.`],
      method: `${num(a - b)} ${strict ? '<' : '≤'} x ${strict ? '<' : '≤'} ${num(a + b)} → ${ans} integers.`, trap: 'Getting the endpoints wrong.', sub: 'Absolute value inequalities', skill: 'Distance on the number line' });
  }
  if (L === 4){
    const k = R.pick([2, 3]), ans = count(x => Math.abs(k * x - a) <= b);
    return ps(R, { stem: `How many integers x satisfy |${k}x ${signed(-a)}| ≤ ${b}?`, answer: ans,
      wrong: [
        [2 * b + 1, `That counts |x ${signed(-a)}| ≤ ${b}; the ${k} shrinks the interval.`, 'Procedural'],
        [count(x => Math.abs(k * x - a) < b), 'The endpoints satisfy “≤”.', 'Reading'],
        [Math.floor((2 * b + 1) / k) + 1, `Solve for x first: ${Q(a - b, k)} ≤ x ≤ ${Q(a + b, k)}, then count.`, 'Calculation'],
        [b, `${b} is not the number of integers.`, 'Interpretation'],
      ], positive: true, hints: ['Remove the absolute value by writing a double inequality.', `−${b} ≤ ${k}x ${signed(-a)} ≤ ${b}.`, 'Key idea: |E| ≤ b ⟺ −b ≤ E ≤ b; then solve for x.', `${num(a - b)} ≤ ${k}x ≤ ${num(a + b)}.`],
      method: `${Q(a - b, k)} ≤ x ≤ ${Q(a + b, k)} → ${ans} integers.`, trap: 'Ignoring the coefficient of x.', sub: 'Absolute value inequalities', skill: 'Double inequalities' });
  }
  const p = R.int(-8, 4), q = p + R.int(2, 8), c = (q - p) + R.int(2, 10), ans = count(x => Math.abs(x - p) + Math.abs(x - q) <= c);
  return ps(R, { stem: `How many integers x satisfy |x ${signed(-p)}| + |x ${signed(-q)}| ≤ ${c}?`.replace('|x + 0|', '|x|').replace('|x − 0|', '|x|'), answer: ans,
    wrong: [
      [q - p + 1, `Between ${num(p)} and ${num(q)} the sum is always ${q - p}, but values outside also fit while the sum stays ≤ ${c}.`, 'Trap'],
      [count(x => Math.abs(x - p) + Math.abs(x - q) < c), 'The endpoints satisfy “≤”.', 'Reading'],
      [2 * c + 1, `That counts |x| ≤ ${c}; the sum of two distances behaves differently.`, 'Procedural'],
      [count(x => Math.abs(x - p) <= c), 'That uses only the first distance.', 'Careless'],
    ], positive: true, hints: ['Read each absolute value as a distance.', `The sum is the distance from x to ${num(p)} plus the distance to ${num(q)}.`, `Key idea: between ${num(p)} and ${num(q)} the sum is constant (${q - p}); outside it grows by 2 per step.`, `Extra room: ${c} − ${q - p} = ${c - (q - p)}, split on both sides.`],
    method: `The sum ≤ ${c} for x from ${num(p - Math.floor((c - (q - p)) / 2))} to ${num(q + Math.floor((c - (q - p)) / 2))} → ${ans} integers.`, trap: 'Counting only the points between the two centres.', sub: 'Sum of distances', skill: 'Piecewise thinking' });
} });

T({ id: 'ineqrange', topic: 'Inequalities & absolute value', levels: [3, 5], make(L, R){
  if (L === 3){
    const a = R.int(-8, 2), b = a + R.int(3, 10), c = R.int(-9, -1), d = R.int(1, 9);
    return ps(R, { stem: `If ${num(a)} ≤ x ≤ ${num(b)} and ${num(c)} ≤ y ≤ ${num(d)}, what is the greatest possible value of x − y?`, answer: b - c,
      wrong: [
        [b - d, `Subtracting the largest y makes x − y smaller; subtract the smallest y, ${num(c)}.`, 'Trap'],
        [b + d, 'x − y is largest when y is smallest, not largest.', 'Logic'],
        [a - c, `x − y is largest when x is largest, ${num(b)}.`, 'Careless'],
        [b - d - (a - c) === b - c ? b : (b - d) - (a - c), 'Pick the extreme values of each variable, one at a time.', 'Calculation'],
      ], integer: true, hints: ['Which value of x makes x − y as large as possible?', 'Which value of y?', 'Key idea: to maximize a difference, maximize the first term and minimize the second.', `x = ${num(b)}, y = ${num(c)}.`],
      method: `${num(b)} − (${num(c)}) = ${num(b - c)}.`, trap: 'Subtracting the largest value of y.', sub: 'Ranges', skill: 'Extreme values' });
  }
  if (L === 4){
    const a = R.int(-9, -3), b = R.int(1, 6), c = R.int(-9, -3), d = R.int(1, 6); need(a * c > b * d);
    const corners = [a * c, a * d, b * c, b * d], ans = Math.max(...corners);
    return ps(R, { stem: `If ${num(a)} ≤ x ≤ ${num(b)} and ${num(c)} ≤ y ≤ ${num(d)}, what is the greatest possible value of xy?`, answer: ans,
      wrong: [
        [b * d, `${b} × ${d} uses the two largest values, but two negatives multiply to more: ${num(a)} × ${num(c)} = ${ans}.`, 'Trap'],
        [Math.min(...corners), 'That is the least possible value.', 'Interpretation'],
        [a * d, 'A negative times a positive is negative.', 'Logic'],
        [b * c, 'A positive times a negative is negative.', 'Logic'],
      ], integer: true, hints: ['Where can the extreme values of a product occur?', 'Check the four corners: each end of x with each end of y.', 'Key idea: with negatives in the ranges, test all four corner products.', `${num(a)} × ${num(c)} = ${a * c}.`],
      method: `Corners: ${corners.map(v => num(v)).join(', ')} → greatest ${num(ans)}.`, trap: 'Multiplying the two largest values.', sub: 'Ranges', skill: 'Corner products' });
  }
  const a = R.int(2, 6), b = R.int(-10, 10), c = R.int(-15, 15), p = R.int(2, 5), q = R.int(-10, 10), r = R.int(5, 30);
  const ok = x => b - a * x < c && p * x + q <= r;
  let n = 0, lo = null, hi = null; for (let x = -200; x <= 200; x++) if (ok(x)){ n++; if (lo === null) lo = x; hi = x; }
  need(n >= 2 && n <= 20);
  let nf = 0; for (let x = -200; x <= 200; x++) if (b - a * x < c && p * x + q < r) nf++;
  let nw = 0; for (let x = -200; x <= 200; x++) if (b - a * x <= c && p * x + q <= r) nw++;
  return ps(R, { stem: `How many integers x satisfy both ${num(b)} − ${a}x < ${num(c)} and ${p}x ${signed(q)} ≤ ${num(r)}?`, answer: n,
    wrong: [
      [(() => { let m = 0; for (let x = -200; x <= 200; x++) if (b - a * x > c && p * x + q <= r) m++; return m > 0 && m < 30 ? m : null; })(), `Dividing by −${a} flips the inequality: x > ${num((b - c) / a)}, not x < ${num((b - c) / a)}.`, 'Trap'],
      [nf !== n ? nf : null, 'The second inequality allows equality.', 'Reading'],
      [nw !== n ? nw : null, 'The first inequality is strict.', 'Reading'],
      [n + 1, `Count again: x runs from ${lo} to ${hi}.`, 'Careless'],
      [n - 1, `Count again: x runs from ${lo} to ${hi}, both included.`, 'Careless'],
    ], positive: true, hints: ['Solve each inequality for x.', `First: −${a}x < ${num(c - b)}. What happens when you divide by −${a}?`, 'Key idea: dividing or multiplying by a negative number flips the inequality sign.', `x > ${num((b - c) / a)} and x ≤ ${num((r - q) / p)}.`],
    method: `x > ${num(round((b - c) / a, 2))} and x ≤ ${num(round((r - q) / p, 2))} → integers ${lo} to ${hi}: ${n}.`, trap: 'Forgetting to flip the sign.', sub: 'Systems of inequalities', skill: 'Flipping the sign' });
} });

T({ id: 'ineqsolve', topic: 'Inequalities & absolute value', levels: [2, 3], make(L, R){
  const a = R.int(2, 7), b = R.int(-10, 15), x0 = R.int(-8, 8), c = b - a * x0 - (L === 3 ? R.int(1, a - 1) : 0);
  const k = Q(b - c, a), mk = Q(c - b, a);
  need(+k !== 0);
  const s = v => `x ${v} ${num(k)}`;
  const stem = `Which of the following is equivalent to ${num(b)} − ${a}x > ${num(c)}?`;
  return ps(R, { stem, answer: s('<'),
    wrong: [
      [s('>'), `Dividing by −${a} reverses the inequality: x < ${num(k)}.`, 'Trap'],
      [`x < ${num(mk)}`, `Sign slip: −${a}x > ${num(c - b)} gives x < ${num(c - b)} ÷ (−${a}) = ${num(k)}.`, 'Calculation'],
      [`x > ${num(mk)}`, 'Two slips: the sign of the number and the direction of the inequality.', 'Calculation'],
      [`x < ${num(Q(b + c, a))}`, `Move ${num(b)} by subtracting it: −${a}x > ${num(c - b)}.`, 'Procedural'],
      [`x ≤ ${num(k)}`, 'The original inequality is strict, so the result is strict too.', 'Reading'],
    ], hints: ['Isolate the x-term first.', `−${a}x > ${num(c - b)}.`, 'Key idea: dividing by a negative number flips the inequality.', `Divide both sides by −${a}.`],
    method: `−${a}x > ${num(c - b)} → x < ${num(k)} (sign flipped).`, trap: 'Keeping the inequality sign when dividing by a negative number.', sub: 'Linear inequalities', skill: 'Flipping the sign' });
} });

/* ---------------- Word problems */
T({ id: 'profit', topic: 'Word problems', levels: [3, 4], make(L, R){
  const m = 5 * R.int(4, 16), d = 5 * R.int(2, 8), ans = round((100 + m) * (100 - d) / 100 - 100, 4);
  need(decimals(ans, 2) && ans !== 0);
  if (L === 3){
    return ps(R, { stem: `A shop marks up the cost of a coat by ${m}% and then sells it at a ${d}% discount off the marked price. The profit is what percent of the cost?`, answer: ans, fmt: pct,
      wrong: [
        [m - d, `The discount is ${d}% of the marked price, which is larger than the cost.`, 'Trap'],
        [round(100 + ans, 4), `${num(100 + ans)}% is the selling price as a percent of cost, not the profit.`, 'Interpretation'],
        [round(m - d - m * d / 100 === ans ? m - d + m * d / 100 : m - d - m * d / 100 - 1, 4), 'Recheck the multipliers: ' + (100 + m) / 100 + ' × ' + (100 - d) / 100 + '.', 'Calculation'],
        [round(m * (100 - d) / 100, 4), 'That applies the discount to the markup only.', 'Procedural'],
      ], hints: ['Choose a cost of $100.', `Marked price: $${100 + m}.`, 'Key idea: successive percent changes multiply.', `Selling price: ${100 + m} × ${(100 - d) / 100}.`],
      method: `100 → ${100 + m} → ${num(100 + m - (100 + m) * d / 100)}: profit ${num(ans)}%.`, trap: 'Subtracting the percents.', sub: 'Markup and discount', skill: 'Smart number 100' });
  }
  const cost = 10 * R.int(2, 40), n = R.int(20, 200), sell = cost * (100 + m) / 100 * (100 - d) / 100; need(decimals(sell, 2));
  const P_ = round(n * (sell - cost), 2);
  return ps(R, { stem: `A store buys ${n} lamps at ${money(cost)} each. It marks each lamp up by ${m}%, then sells all of them at ${d}% off the marked price. What is the total profit?`, answer: P_, fmt: money,
    wrong: [
      [round(n * cost * (m - d) / 100, 2), `Subtracting ${d}% from ${m}% ignores that the discount applies to the higher price.`, 'Trap'],
      [round(n * sell, 2), 'That is the total revenue, not the profit.', 'Interpretation'],
      [round(sell - cost, 2), 'That is the profit on one lamp.', 'Careless'],
      [round(n * cost * m / 100, 2), 'That is the profit before the discount.', 'Careless'],
    ], hints: ['Find the selling price of one lamp.', `Marked: ${money(cost)} × ${(100 + m) / 100}.`, 'Key idea: profit = revenue − cost.', `Selling price: ${money(sell)}.`],
    method: `Sell ${money(sell)} − cost ${money(cost)} = ${money(sell - cost)} per lamp; × ${n} = ${money(P_)}.`, trap: 'Subtracting the percents.', sub: 'Profit', skill: 'Per-unit profit' });
} });

const AGES = { now: [], past: [] };           // every small (son, k, years, times) combination that works out in whole numbers
for (let B = 3; B <= 20; B++) for (let k = 2; k <= 5; k++){
  for (let t = 2; t <= 15; t++){ const f = (k * B + t) / (B + t); if (isInt(f) && f > 1 && f !== k) AGES.now.push([B, k, t, f]); }
  for (let t = 1; t < B && t <= 10; t++){ const f = (k * B - t) / (B - t); if (isInt(f) && f > k) AGES.past.push([B, k, t, f]); }
}
T({ id: 'age', topic: 'Word problems', levels: [3, 5], make(L, R){
  if (L <= 4){
    const [B, k, t, fut] = R.pick(AGES.now), A = k * B;
    return ps(R, { stem: `Lena is ${k} times as old as her son. In ${t} years she will be ${fut} times as old as he will be then. How old is Lena now?`, answer: A,
      wrong: [
        [B, `${B} is the son’s age.`, 'Interpretation'],
        [A + t, `${A + t} is Lena’s age in ${t} years.`, 'Interpretation'],
        [k * (B + t), `${k} × ${B + t} uses the son’s age in ${t} years; “${k} times as old” describes their ages now.`, 'Procedural'],
        [isInt(t * fut / (k - fut)) ? k * t * fut / (k - fut) : null, `Lena also gets ${t} years older: ${k}s + ${t} = ${fut}(s + ${t}).`, 'Procedural'],
      ], positive: true, integer: true, hints: ['Let the son’s age be s. What is Lena’s?', `Lena: ${k}s now; in ${t} years both are ${t} years older.`, `Key idea: ${k}s + ${t} = ${fut}(s + ${t}).`, `Expand: ${k}s + ${t} = ${fut}s + ${fut * t}.`],
      method: `${k}s + ${t} = ${fut}s + ${fut * t} → s = ${B} → Lena ${A}.`, trap: 'Adding the years to one person only.', sub: 'Age problems', skill: 'Same time shift for everyone' });
  }
  const [B, k, t2, past] = R.pick(AGES.past), A = k * B, t = R.int(2, 15);
  need(t !== t2);
  return ps(R, { stem: `Lena is ${k} times as old as her son. ${t2} years ago she was ${past} times as old as he was then. How old will Lena be in ${t} years?`, answer: A + t,
    wrong: [
      [A, `${A} is Lena’s age now.`, 'Interpretation'],
      [B + t, `${B + t} is the son’s age in ${t} years.`, 'Interpretation'],
      [A - t2, `${A - t2} was her age ${t2} years ago.`, 'Reading'],
      [A + t2, `Add ${t} years, not ${t2}.`, 'Reading'],
    ], positive: true, integer: true, hints: ['Let the son’s age now be s.', `${t2} years ago: Lena ${k}s − ${t2}, son s − ${t2}.`, `Key idea: ${k}s − ${t2} = ${past}(s − ${t2}).`, `Solve for s, then add ${t} to Lena’s age.`],
    method: `${k}s − ${t2} = ${past}s − ${past * t2} → s = ${B}; Lena ${A} now, ${A + t} in ${t} years.`, trap: 'Answering with the age now.', sub: 'Age problems', skill: 'Time shifts' });
} });

T({ id: 'wage', topic: 'Word problems', levels: [3, 4], make(L, R){
  const base = R.int(12, 30), h0 = R.int(35, 40), mult = R.pick([Q(3, 2), Q(2), Q(5, 4)]), extra = R.int(2, 15), H = h0 + extra;
  const pay = base * h0 + +qmul(base, mult) * extra; need(decimals(pay, 2));
  return ps(R, { stem: `A worker earns ${money(base)} per hour for the first ${h0} hours of a week and ${mixed(mult)} times that rate for every hour beyond ${h0}. How much does she earn in a week in which she works ${H} hours?`, answer: pay, fmt: money,
    wrong: [
      [+qmul(base, mult) * H, `The higher rate applies only to the ${extra} hours beyond ${h0}.`, 'Reading'],
      [base * H, `The ${extra} extra hours are paid at ${mixed(mult)} times the rate.`, 'Careless'],
      [base * h0 + (base + +mult) * extra, `${mixed(mult)} times the rate means × ${mixed(mult)}, not + ${mixed(mult)} dollars.`, 'Procedural'],
      [base * h0 + +qmul(base, mult) * H, `Only the hours beyond ${h0} are overtime: ${extra}, not ${H}.`, 'Procedural'],
    ], positive: true, hints: ['Split the hours into regular and extra.', `Regular: ${h0}; extra: ${extra}.`, 'Key idea: pay = regular hours × rate + extra hours × higher rate.', `Higher rate: ${money(base)} × ${mixed(mult)} = ${money(+qmul(base, mult))}.`],
    method: `${h0} × ${money(base)} + ${extra} × ${money(+qmul(base, mult))} = ${money(pay)}.`, trap: 'Paying every hour at the higher rate.', sub: 'Piecewise rates', skill: 'Splitting a quantity' });
} });

/* ================================================================== DATA INSIGHTS */
/* ---------------- Data Sufficiency: brute force over a finite stand-in for the positive integers.
   Every constant stays well below the edge of the domain, so a finite check gives the same verdict as the infinite one. */
const DS_CLAIMS = [['s1', 's2x'], ['s2', 's1x'], ['s1x', 's2x', 'b'], ['s1', 's2'], ['s1x', 's2x', 'bx']];
function dsBuild(R, L, cfg){
  const targets = L <= 3 ? [0, 1, 3, 0, 1, 2] : L === 4 ? [0, 1, 2, 3, 4] : [2, 4, 2, 4, 3, 0, 1];
  const want = R.pick(targets);
  for (let tries = 0; tries < 300; tries++){
    const p0 = cfg.point(R), Qn = R.pick(cfg.questions(R, p0, L)), pool = cfg.statements(R, p0, L).filter(s => s.key !== Qn.key);
    if (pool.length < 2) continue;
    const [S1, S2] = R.sample(pool, 2);
    if (S1.text === S2.text || S1.key === S2.key && S1.key !== 'range') continue;
    const ev = preds => {
      const fit = cfg.domain.filter(p => preds.every(f => f(p))), vals = new Map();
      for (const p of fit){ const a = Qn.ans(p); if (!vals.has(a)) vals.set(a, p); if (vals.size > 2) break; }
      return { fit, vals, suff: vals.size === 1 };
    };
    const e1 = ev([S1.f]), e2 = ev([S2.f]), eb = ev([S1.f, S2.f]);
    const letter = e1.suff && e2.suff ? 3 : e1.suff ? 0 : e2.suff ? 1 : eb.suff ? 2 : 4;
    if (letter !== want) continue;
    if (e1.fit.length === cfg.domain.length && e2.fit.length === cfg.domain.length) continue;
    const insuff = e => { const [[a1, p1], [a2, p2]] = [...e.vals]; return `${cfg.show(p1)} ${Qn.say(a1)} and ${cfg.show(p2)} ${Qn.say(a2)}, and both fit`; };
    const suff = e => { const [[a, p]] = [...e.vals]; return e.fit.length === 1 ? `only ${cfg.show(p)} fits, and it ${Qn.say(a)}` : `every value that fits ${Qn.say(a)} (for example ${cfg.show(p)})`; };
    const verdict = e => e.suff ? 'sufficient: ' + suff(e) : 'not sufficient: ' + insuff(e);
    const E = { s1: e1, s2: e2, b: eb };
    const claimTrue = c => c === 's1' ? e1.suff : c === 's2' ? e2.suff : c === 's1x' ? !e1.suff : c === 's2x' ? !e2.suff : c === 'b' ? eb.suff : !eb.suff;
    const diagnosis = [0, 1, 2, 3, 4].map(l => {
      if (l === letter) return null;
      const c = DS_CLAIMS[l].find(x => !claimTrue(x)), i = c[1] === '1' ? 1 : 2;
      if (c === 's1' || c === 's2') return { why: `Statement (${i}) alone is not sufficient: ${insuff(E['s' + i])}.`, type: E['s' + i].fit.length === cfg.domain.length ? 'Trap' : 'Logic' };
      if (c === 's1x' || c === 's2x') return { why: `Statement (${i}) alone is already sufficient: ${suff(E['s' + i])}.`, type: l === 2 || l === 4 ? 'Conceptual' : 'Logic' };
      if (c === 'b') return { why: `Even together the statements are not sufficient: ${insuff(eb)}.`, type: 'Trap' };
      return { why: `Together the statements are sufficient: ${suff(eb)}.`, type: 'Procedural' };
    });
    const few = e => e.fit.slice(0, 4).map(cfg.show).join('; ');
    const always = [S1, S2].map((s, i) => [e1, e2][i].fit.length === cfg.domain.length ? i + 1 : 0).filter(Boolean);
    return { type: 'DS', sig: [Qn.key, S1.key, S2.key], stem: `${cfg.intro} ${Qn.text}`, statements: [S1.text, S2.text], answer: letter, diagnosis,
      solution: diagnosis.map((d, l) => `(${LETTER[l]}) ${d ? d.why : 'the right answer.'}`).join(' '),
      hints: [
        `What does the question need: ${Qn.yn ? 'a definite Yes or a definite No' : 'one single value'}?`,
        `Values that satisfy statement (1): ${few(e1)}, … Do they all give the same answer?`,
        'Key idea: a statement is sufficient only if every value that fits it gives the same answer; one counterexample is enough to rule it out.',
        `Values that satisfy statement (2): ${few(e2)}, …`],
      method: `(1) alone is ${verdict(e1)}. (2) alone is ${verdict(e2)}.${letter === 2 || letter === 4 ? ` Together they are ${verdict(eb)}.` : ''} Answer ${LETTER[letter]}.`,
      trap: always.length ? `Statement (${always[0]}) is true for every ${cfg.every}, so it adds no information.` : letter === 2 ? 'Each statement alone leaves more than one answer; only together do they settle it.'
        : letter === 4 ? 'Together the statements still allow different answers: test values that fit both.' : letter === 3 ? 'Each statement works alone; check them separately before combining.' : 'Do not combine the statements when one is enough on its own.',
      subtopic: cfg.sub, skill: 'Testing cases' };
  }
  throw new Retry('ds');
}
const yn = (key, text, f) => ({ key, text, yn: true, ans: p => f(p) ? 'Yes' : 'No', say: a => `gives “${a}”` });
const val = (key, text, f, what) => ({ key, text, ans: p => String(f(p)), say: a => `gives ${what} ${a}` });
const DOM_N = Array.from({ length: 720 }, (_, i) => i + 1);
const NDIV = DOM_N.map(n => divisorsOf(n).length);          // NDIV[n − 1] = number of divisors of n
T({ id: 'dsn', topic: 'Data Sufficiency', type: 'DS', levels: [3, 6], make(L, R){
  return dsBuild(R, L, { domain: DOM_N, intro: 'If n is a positive integer,', every: 'positive integer', show: n => `n = ${n}`, sub: 'Number properties',
    point: R => R.int(2, 120),
    questions: (R, n0) => {
      const k = R.pick([3, 4, 5, 6, 8, 9, 10, 12, 15]), c = n0 + R.int(-8, 8), m = R.pick([3, 4, 5, 6, 7, 9]);
      return [yn('parity', 'is n even?', n => n % 2 === 0), yn('div' + k, `is n divisible by ${k}?`, n => n % k === 0), yn('size', `is n greater than ${c}?`, n => n > c),
        yn('prime', 'is n a prime number?', isPrime), val('rem' + m, `what is the remainder when n is divided by ${m}?`, n => n % m, 'remainder'),
        val('value', 'what is the value of n?', n => n, 'n ='), val('units', 'what is the units digit of n?', n => n % 10, 'units digit')].concat(L >= 5 ? [yn('square', 'is n a perfect square?', n => isInt(Math.sqrt(n)))] : []);
    },
    statements: (R, n0, L) => {
      const out = [], add = (key, text, f) => { if (f(n0)) out.push({ key, text, f }); };
      const divs = [2, 3, 4, 5, 6, 8, 9, 10, 12, 15].filter(k => n0 % k === 0);
      if (divs.length) { const k = R.pick(divs); add('div' + k, `n is divisible by ${k}.`, n => n % k === 0); }
      const lo = n0 - R.int(1, 12), hi = n0 + R.int(1, 12);
      if (lo > 0) add('range', `n > ${lo}`, n => n > lo);
      add('range', `n < ${hi}`, n => n < hi);
      const m = R.pick([3, 4, 5, 6, 7, 8]); add('rem' + m, `When n is divided by ${m}, the remainder is ${n0 % m}.`, n => n % m === n0 % m);
      add('parity', n0 % 2 ? 'n is odd.' : 'n is even.', n => n % 2 === n0 % 2);
      const c = R.int(1, 9), kk = R.pick([3, 4, 5, 6, 7]); if ((n0 + c) % kk === 0) add('shift', `n + ${c} is divisible by ${kk}.`, n => (n + c) % kk === 0);
      if (L >= 4){
        const sq = [4, 8, 9, 12, 18, 20, 25, 27, 36, 45, 50].filter(k => (n0 * n0) % k === 0);
        if (sq.length){ const k = R.pick(sq); add('sqdiv', `n^{2} is divisible by ${k}.`, n => (n * n) % k === 0); }
        const k2 = R.pick([4, 6, 10, 12, 14]); if ((2 * n0) % k2 === 0) add('twice', `2n is divisible by ${k2}.`, n => (2 * n) % k2 === 0);
        if (n0 <= 60){ const cc = n0 * R.pick([1, 2, 3]); if (cc <= 180) add('factor', `n is a factor of ${cc}.`, n => cc % n === 0); }
        add('units', `The units digit of n is ${n0 % 10}.`, n => n % 10 === n0 % 10);
        if (isPrime(n0)) add('prime', 'n is a prime number.', isPrime);
        const X = n0 * n0 + R.int(1, 2 * n0); add('sqsize', `n^{2} < ${num(X)}`, n => n * n < X);
      }
      if (L >= 5){
        add('always', 'n^{2} + n is even.', n => (n * n + n) % 2 === 0);
        const d = NDIV[n0 - 1]; if (d <= 4) add('ndiv', `n has exactly ${d} positive divisors.`, n => NDIV[n - 1] === d);
      }
      return out;
    } });
} });

const DOM_XY = []; for (let x = 1; x <= 48; x++) for (let y = 1; y <= 48; y++) DOM_XY.push([x, y]);
T({ id: 'dsxy', topic: 'Data Sufficiency', type: 'DS', levels: [3, 6], make(L, R){
  return dsBuild(R, L, { domain: DOM_XY, intro: 'If x and y are positive integers,', every: 'pair of positive integers', show: ([x, y]) => `x = ${x}, y = ${y}`, sub: 'Two unknowns',
    point: R => [R.int(1, 15), R.int(1, 15)],
    questions: (R, [x0, y0]) => {
      const c = x0 + y0 + R.int(-4, 4);
      return [yn('order', 'is x > y?', ([x, y]) => x > y), val('sum', 'what is the value of x + y?', ([x, y]) => x + y, 'x + y ='), yn('prodpar', 'is xy even?', ([x, y]) => x * y % 2 === 0),
        val('x', 'what is the value of x?', ([x]) => x, 'x ='), yn('sumsize', `is x + y > ${c}?`, ([x, y]) => x + y > c), val('diff', 'what is the value of x − y?', ([x, y]) => x - y, 'x − y =')];
    },
    statements: (R, [x0, y0], L) => {
      const out = [], add = (key, text, f) => { if (f([x0, y0])) out.push({ key, text, f }); };
      add('sum', `x + y = ${x0 + y0}`, ([x, y]) => x + y === x0 + y0);
      if (x0 !== y0) add('diff', `x − y = ${num(x0 - y0)}`, ([x, y]) => x - y === x0 - y0);
      const cx = x0 - R.int(1, 6); if (cx > 0) add('xsize', `x > ${cx}`, ([x]) => x > cx);
      const cy = y0 + R.int(1, 6); add('ysize', `y < ${cy}`, ([, y]) => y < cy);
      add('xpar', x0 % 2 ? 'x is odd.' : 'x is even.', ([x]) => x % 2 === x0 % 2);
      add('ypar', y0 % 2 ? 'y is odd.' : 'y is even.', ([, y]) => y % 2 === y0 % 2);
      const a = R.int(2, 4), b = R.int(2, 5); add('lin', `${a}x + ${b}y = ${a * x0 + b * y0}`, ([x, y]) => a * x + b * y === a * x0 + b * y0);
      if (L >= 4){
        add('prod', `xy = ${x0 * y0}`, ([x, y]) => x * y === x0 * y0);
        if (x0 % y0 === 0 && x0 !== y0) add('mult', `x = ${x0 / y0}y`, ([x, y]) => x === (x0 / y0) * y);
        const g = gcd(x0, y0); if (x0 !== y0) add('ratio', `x/y = ${x0 / g}/${y0 / g}`, ([x, y]) => x * (y0 / g) === y * (x0 / g));
        add('sqx', `x^{2} = ${x0 * x0}`, ([x]) => x === x0);
      }
      if (L >= 5){
        add('sqdiff', `x^{2} − y^{2} = ${num(x0 * x0 - y0 * y0)}`, ([x, y]) => x * x - y * y === x0 * x0 - y0 * y0);
        add('absd', `|x − y| = ${Math.abs(x0 - y0)}`, ([x, y]) => Math.abs(x - y) === Math.abs(x0 - y0));
      }
      return out;
    } });
} });

/* ---------------- Two-Part Analysis: two products sharing one resource */
T({ id: 'tpamix', topic: 'Two-Part Analysis', type: 'TPA', levels: [3, 5], make(L, R){
  const [[sP, nP], [sQ, nQ], res, unit] = R.pick([[['chair', 'chairs'], ['table', 'tables'], 'hours of labor', 'hours'], [['small box', 'small boxes'], ['large box', 'large boxes'], 'kg of cardboard', 'kg'], [['lamp', 'lamps'], ['shelf', 'shelves'], 'hours of machine time', 'hours'], [['basic kit', 'basic kits'], ['deluxe kit', 'deluxe kits'], 'hours of assembly', 'hours']]);
  const cnt = (k, one, many) => `${k} ${k === 1 ? one : many}`;
  const hp = R.int(2, L === 5 ? 9 : 6), hq = R.int(2, L === 5 ? 9 : 7), pp = 5 * R.int(4, 18), pq = 5 * R.int(4, 20), P0 = R.int(2, L === 3 ? 15 : 30), Q0 = R.int(2, L === 3 ? 15 : 30);
  need(hp !== hq && pp !== pq && P0 !== Q0 && hp * pq !== hq * pp);
  const H = hp * P0 + hq * Q0, M = pp * P0 + pq * Q0;
  const labourOnly = []; for (let p = 1; p <= H / hp; p++){ const q = (H - hp * p) / hq; if (isInt(q) && q >= 1 && p !== P0) labourOnly.push([p, q]); }
  const opts = new Set([P0, Q0]);
  for (const [p, q] of R.shuffle(labourOnly)) { if (opts.size >= 4) break; opts.add(p); opts.add(q); }
  for (let t = 0; opts.size < 6 && t < 50; t++) opts.add(Math.max(1, (R.chance(0.5) ? P0 : Q0) + R.int(-6, 6)));
  const options = [...opts].slice(0, 6).sort((a, b) => a - b);
  need(options.length === 6 && options.includes(P0) && options.includes(Q0));
  const why = (v, first) => {
    const [hv, ho, pv, po, nv, no, sv, so, right] = first ? [hp, hq, pp, pq, nP, nQ, sP, sQ, P0] : [hq, hp, pq, pp, nQ, nP, sQ, sP, Q0];
    if (v === right) return null;
    if (v === (first ? Q0 : P0)) return { why: `${v} is the number of ${no}: the columns are swapped.`, type: 'Interpretation' };
    const o = (H - hv * v) / ho;
    if (o < 0) return { why: `${cnt(v, sv, nv)} alone ${v === 1 ? 'needs' : 'need'} ${hv * v} ${unit}, more than the ${H} available.`, type: 'Procedural' };
    if (!isInt(o)) return { why: `With ${cnt(v, sv, nv)}, the remaining ${H - hv * v} ${unit} would make ${num(round(o, 2))} ${no}, not a whole number.`, type: 'Procedural' };
    return { why: `With ${cnt(v, sv, nv)}, the ${res} leave ${cnt(o, so, no)}, and the profit would be ${money(pv * v + po * o)}, not ${money(M)}.`, type: labourOnly.some(([p, q]) => (first ? p : q) === v) ? 'Trap' : 'Procedural' };
  };
  const cap = s => s[0].toUpperCase() + s.slice(1);
  return { type: 'TPA', partStyle: 'tpa',
    stem: `A workshop makes ${nP} and ${nQ}. Each ${sP} needs ${hp} ${res} and earns a profit of ${money(pp)}; each ${sQ} needs ${hq} ${res} and earns a profit of ${money(pq)}. Last week the workshop used exactly ${H} ${res} and earned a total profit of exactly ${money(M)} on these two products.\n\nSelect for **${cap(nP)}** and for **${cap(nQ)}** the numbers made last week that are consistent with this information. Make only two selections, one in each column.`,
    parts: [{ label: cap(nP), options: options.map(String), answer: options.indexOf(P0), diagnosis: options.map(v => why(v, true)) },
      { label: cap(nQ), options: options.map(String), answer: options.indexOf(Q0), diagnosis: options.map(v => why(v, false)) }],
    hints: ['How many unknowns and how many conditions?', `One equation for the ${res}, one for the profit.`, 'Key idea: two linear equations in two unknowns; eliminate one variable.', `${hp}p + ${hq}q = ${H} and ${pp}p + ${pq}q = ${M}.`],
    method: `${hp}p + ${hq}q = ${H}; ${pp}p + ${pq}q = ${num(M)}. Eliminating gives p = ${P0}, q = ${Q0}. Check: ${hp * P0} + ${hq * Q0} = ${H} and ${num(pp * P0)} + ${num(pq * Q0)} = ${num(M)}.`,
    altMethod: labourOnly.length ? `Test the options: only pairs that use exactly ${H} ${unit} can work (${labourOnly.slice(0, 3).map(([p, q]) => `${p} and ${q}`).join('; ')}; ${P0} and ${Q0}); then check the profit.` : 'Test each option in the first equation, then check the profit.',
    trap: 'A pair that fits the resource total but not the profit.', subtopic: 'Two linear conditions', skill: 'Simultaneous equations' };
} });

/* ---------------- Two-Part Analysis: extreme values under constraints */
T({ id: 'tparange', topic: 'Two-Part Analysis', type: 'TPA', levels: [3, 5], make(L, R){
  const S = R.int(24, 70), k = R.int(2, 12), m = R.int(2, 8), q = R.pick([3, 4, 5]);
  const C = [
    { text: `x − y is greater than ${k}`, ok: (x, y) => x - y > k, loose: (x, y) => x - y >= k, show: (x, y) => `x − y = ${num(x - y)}, which is not greater than ${k}`, strict: true },
    L === 4 ? { text: 'x is more than twice y', ok: (x, y) => x > 2 * y, loose: (x, y) => x >= 2 * y, show: (x, y) => `x = ${x} is not more than twice y = ${y}`, strict: true } : null,
    { text: `y is at least ${m}`, ok: (x, y) => y >= m, loose: (x, y) => y >= m, show: (x, y) => `y = ${y} is less than ${m}` },
    L === 5 ? { text: `x is a multiple of ${q}`, ok: x => x % q === 0, loose: x => x % q === 0, show: x => `x = ${x} is not a multiple of ${q}`, mult: true } : null,
  ].filter(Boolean);
  const pairs = f => { const out = []; for (let y = 1; y < S; y++){ const x = S - y; if (f(x, y)) out.push([x, y]); } return out; };
  const good = pairs((x, y) => C.every(c => c.ok(x, y)));
  need(good.length >= 3);
  const xmin = Math.min(...good.map(p => p[0])), ymax = Math.max(...good.map(p => p[1]));
  const loose = pairs((x, y) => C.every(c => c.loose(x, y))), noMult = pairs((x, y) => C.filter(c => !c.mult).every(c => c.ok(x, y)));
  const cands = [xmin, ymax, Math.min(...loose.map(p => p[0])), Math.max(...loose.map(p => p[1])), Math.max(...good.map(p => p[0])), Math.min(...good.map(p => p[1])), Math.min(...noMult.map(p => p[0])), Math.max(...noMult.map(p => p[1])), xmin + 1, ymax - 1, xmin - 2, ymax + 2];
  const opts = [...new Set(cands.filter(v => v >= 1 && v < S))].slice(0, 6).sort((a, b) => a - b);
  need(opts.length === 6 && opts.includes(xmin) && opts.includes(ymax) && xmin !== ymax);
  const fails = (x, y) => C.find(c => !c.ok(x, y));
  const why = (v, col) => {
    const [x, y] = col === 'x' ? [v, S - v] : [S - v, v];
    if (col === 'x' ? v === xmin : v === ymax) return null;
    if (col === 'x' ? v === ymax : v === xmin) return { why: `${v} is the answer for the other column: ${col === 'x' ? 'the greatest y' : 'the least x'}.`, type: 'Interpretation' };
    const f = fails(x, y);
    if (!f) return { why: col === 'x' ? `x = ${v} (with y = ${y}) meets every condition, but x = ${xmin} does too, and it is smaller.` : `y = ${v} (with x = ${x}) meets every condition, but y = ${ymax} does too, and it is greater.`, type: col === 'x' ? (v === Math.max(...good.map(p => p[0])) ? 'Reading' : 'Logic') : (v === Math.min(...good.map(p => p[1])) ? 'Reading' : 'Logic') };
    const eq = f.strict && f.loose(x, y);
    return { why: `With ${col} = ${v}, ${col === 'x' ? 'y' : 'x'} = ${col === 'x' ? y : x}, and ${f.show(x, y)}.${eq ? ' The condition is strict: equality is not enough.' : ''}`, type: eq ? 'Reading' : f.mult ? 'Careless' : 'Calculation' };
  };
  return { type: 'TPA', partStyle: 'tpa', sig: ['L' + L],
    stem: `The positive integers x and y satisfy x + y = ${S}. In addition, ${list(C.map(c => c.text))}.\n\nSelect for **Least possible x** the least possible value of x, and select for **Greatest possible y** the greatest possible value of y. Make only two selections, one in each column.`,
    parts: [{ label: 'Least possible x', options: opts.map(String), answer: opts.indexOf(xmin), diagnosis: opts.map(v => why(v, 'x')) },
      { label: 'Greatest possible y', options: opts.map(String), answer: opts.indexOf(ymax), diagnosis: opts.map(v => why(v, 'y')) }],
    hints: ['Since x + y is fixed, what happens to y when x gets smaller?', 'The least x and the greatest y come from the same pair.', 'Key idea: write y = ' + S + ' − x and turn every condition into a condition on one variable.', `Try y = ${ymax + 1}: which condition fails?`],
    method: `y = ${S} − x. Conditions: ${C.map(c => c.text).join('; ')}. The pairs that work run from (x, y) = (${xmin}, ${ymax}) upward in x, so the least x is ${xmin} and the greatest y is ${ymax}.`,
    altMethod: `Test the options from the extremes: the largest y option that satisfies every condition is ${ymax}, and then x = ${S} − ${ymax} = ${xmin}.`,
    trap: 'Treating a strict inequality (“greater than”) as if equality were allowed.', subtopic: 'Extreme values under constraints', skill: 'Constraints on two variables' };
} });

/* ---------------- Table Analysis: a sortable table and three Yes/No statements, in one of several settings */
const TA_CONTEXTS = [
  { id: 'stores', intro: 'The table shows 2026 data for the six stores of a retail chain. Revenue is in thousands of dollars; growth compares 2026 revenue with 2025.', entity: 'store', entities: 'stores', groupCol: 'Region', groups: ['North', 'South', 'West'],
    names: ['Aarhus', 'Bergen', 'Cork', 'Dresden', 'Evora', 'Fribourg', 'Graz', 'Haarlem', 'Innsbruck', 'Lyon', 'Malmö', 'Nantes', 'Porto', 'Turku', 'Utrecht'],
    c1: 'Revenue ($000)', w1: 'revenue', r1: [60, 210, 10], f1: v => `$${num(v)},000`, c2: 'Employees', w2: 'employees', one2: 'employee', r2: [12, 48], c3: 'Growth vs 2025 (%)', w3: 'growth', u3: '%', r3: [-30, 99] },
  { id: 'hospitals', intro: 'The table shows last year’s data for the six hospitals of a regional health service. Satisfaction change compares patient satisfaction scores with the year before, in points.', entity: 'hospital', entities: 'hospitals', groupCol: 'District', groups: ['Central', 'Coastal', 'Upland'],
    names: ['Ashford', 'Brookside', 'Castleton', 'Deerfield', 'Elmwood', 'Fairview', 'Glenhaven', 'Hillcrest', 'Ivybridge', 'Kingsmere', 'Lakeview', 'Millbrook'],
    c1: 'Patients treated', w1: 'patients treated', r1: [200, 900, 10], f1: v => num(v), c2: 'Doctors', w2: 'doctors', one2: 'doctor', r2: [20, 95], c3: 'Satisfaction change (points)', w3: 'satisfaction change', u3: ' points', r3: [-40, 60] },
  { id: 'routes', intro: 'The table shows one month of data for six routes of a regional airline. Load-factor change compares the share of seats filled with the same month a year earlier, in percentage points.', entity: 'route', entities: 'routes', groupCol: 'Hub', groups: ['Oslo', 'Riga', 'Tallinn'],
    names: ['Aalborg', 'Bodø', 'Gdańsk', 'Kaunas', 'Luleå', 'Malmö', 'Oulu', 'Poznań', 'Tartu', 'Tromsø', 'Umeå', 'Vilnius'],
    c1: 'Passengers', w1: 'passengers', r1: [300, 1800, 10], f1: v => num(v), c2: 'Flights', w2: 'flights', one2: 'flight', r2: [30, 120], c3: 'Load-factor change (points)', w3: 'load-factor change', u3: ' points', r3: [-50, 80] },
  { id: 'schools', intro: 'The table shows this year’s data for six schools in one district. Pass-rate change compares the share of students who passed the final exam with last year, in percentage points.', entity: 'school', entities: 'schools', groupCol: 'Type', groups: ['Public', 'Private', 'Charter'],
    names: ['Alder', 'Birchwood', 'Cedar Hill', 'Dunmore', 'Eastfield', 'Foxglove', 'Greenway', 'Hawthorn', 'Juniper', 'Kestrel', 'Linden', 'Maplewood'],
    c1: 'Students', w1: 'students', r1: [30, 150, 10], f1: v => num(v), c2: 'Teachers', w2: 'teachers', one2: 'teacher', r2: [20, 90], c3: 'Pass-rate change (points)', w3: 'pass-rate change', u3: ' points', r3: [-45, 70] },
];
T({ id: 'tastore', topic: 'Table Analysis', type: 'TA', levels: [3, 5], make(L, R){
  const X = R.pick(TA_CONTEXTS), n1 = X.id === 'stores' ? X.w1 : 'number of ' + X.w1;
  const names = R.sample(X.names, 6).sort(), groups = names.map(() => R.pick(X.groups));
  const v1 = names.map(() => X.r1[2] * R.int(X.r1[0], X.r1[1])), v2 = names.map(() => R.int(X.r2[0], X.r2[1])), v3 = names.map(() => round(R.int(X.r3[0], X.r3[1]) / 10, 1));
  need(new Set(v1).size === 6 && new Set(v3).size === 6);
  const per = v1.map((r, i) => r / v2[i]); need(new Set(per.map(v => v.toFixed(2))).size === 6);
  const total = sum(v1), sorted = v1.slice().sort((a, b) => a - b), med = (sorted[2] + sorted[3]) / 2, mean = total / 6;
  const iMax = a => a.indexOf(Math.max(...a));
  const S = [];
  { const i = iMax(per), j = iMax(v3), t = i === j, k = iMax(v1);
    S.push({ kind: 'ratio', label: `The ${X.entity} with the highest ${n1} per ${X.one2} also has the highest ${X.w3}.`, t, type: k !== i ? 'Trap' : 'Calculation',
      why: `${X.w1[0].toUpperCase() + X.w1.slice(1)} per ${X.one2} is highest at ${names[i]} (${num(v1[i])}/${v2[i]} ≈ ${num(round(per[i], 1))}); the highest ${X.w3} is at ${names[j]} (${v3[j]}${X.u3}).${k !== i ? ` Judging by ${X.w1} alone points to ${names[k]}.` : ''}` }); }
  { const step = X.r1[2], v = step * Math.round((med + R.pick([-3, -2, -1, 1, 2, 3]) * step) / step), t = med > v;
    need(v !== med);
    S.push({ kind: 'median', label: `The median ${n1} of the six ${X.entities} is greater than ${X.f1(v)}.`, t, type: 'Procedural',
      why: `Sorted ${X.w1}: ${sorted.map(x => num(x)).join(', ')}. With six values the median is the average of the 3rd and 4th: (${num(sorted[2])} + ${num(sorted[3])})/2 = ${num(med)}.` }); }
  { const regs = [...new Set(groups)].filter(r => groups.filter(x => x === r).length >= 2); need(regs.length);
    const reg = R.pick(regs), part = v1.filter((_, i) => groups[i] === reg), rs = sum(part), t = rs > total / 2;
    S.push({ kind: 'share', label: `The ${reg} ${X.entities} together account for more than half of the total ${n1} of the six ${X.entities}.`, t, type: 'Calculation',
      why: `${reg}: ${part.map(x => num(x)).join(' + ')} = ${num(rs)}; half of the total ${num(total)} is ${num(total / 2)}.` }); }
  { const above = v1.filter(r => r > mean).length, k = R.pick([above, above + 1]), t = above >= k;
    S.push({ kind: 'above', label: X.id === 'stores' ? `At least ${k} of the stores have revenue above the average revenue of the six stores.` : `At least ${k} of the ${X.entities} have more ${X.w1} than the average of the six ${X.entities}.`, t, type: 'Calculation',
      why: `Average ${X.w1}: ${num(total)}/6 ≈ ${num(round(mean, 1))}. ${X.entities[0].toUpperCase() + X.entities.slice(1)} above it: ${above}.` }); }
  { const avg = sum(v2) / 6, v = R.int(Math.floor(avg) - 2, Math.ceil(avg) + 2), t = avg > v;
    need(avg !== v);
    S.push({ kind: 'avg2', label: `The average number of ${X.w2} per ${X.entity} is greater than ${v}.`, t, type: 'Calculation',
      why: `${X.w2[0].toUpperCase() + X.w2.slice(1)}: ${v2.join(' + ')} = ${sum(v2)}; ${sum(v2)}/6 ≈ ${num(round(avg, 2))}.` }); }
  { const g = R.pick([0, 2, 3, 4]), idx = names.map((_, i) => i).filter(i => v3[i] > g), mid = Math.round((X.r2[0] + X.r2[1]) / 2), e = R.int(mid - 10, mid + 8), t = idx.every(i => v2[i] > e);
    need(idx.length >= 2);
    S.push({ kind: 'every', label: `Every ${X.entity} with ${X.w3} above ${g}${X.u3} has more than ${e} ${X.w2}.`, t, type: 'Reading',
      why: `${X.entities[0].toUpperCase() + X.entities.slice(1)} with ${X.w3} above ${g}${X.u3}: ${idx.map(i => `${names[i]} (${v2[i]})`).join(', ')}.` }); }
  const pick = R.sample(S, 3); need(pick.some(s => s.t) && pick.some(s => !s.t));
  return { type: 'TA', partStyle: 'yesno', sig: [X.id, ...pick.map(s => s.kind)],
    stem: `${X.intro} You can sort the table by any column.\n\nFor each statement, select **Yes** if it is true based on the table. Otherwise select **No**.`,
    table: { columns: [X.entity[0].toUpperCase() + X.entity.slice(1), X.groupCol, X.c1, X.c2, X.c3], numeric: [false, false, true, true, true], rows: names.map((n, i) => [n, groups[i], v1[i], v2[i], v3[i]]) },
    parts: pick.map(s => ({ label: s.label, options: ['Yes', 'No'], answer: s.t ? 0 : 1, diagnosis: s.t ? [null, { why: s.why + ' So the statement is true.', type: s.type }] : [{ why: s.why + ' So the statement is false.', type: s.type }, null] })),
    hints: ['Which statements need a calculation, and which can you settle by sorting or estimating?', 'Sort by the column each statement is about.', 'Key idea: compute only what a statement needs, and check the exact wording (more than, at least, every).', 'Start with the statement that needs the least arithmetic.'],
    method: pick.map((s, i) => `${i + 1}) ${s.why} → ${s.t ? 'Yes' : 'No'}.`).join(' '), trap: 'Answering from a quick impression of one column when the statement needs a ratio, a median or a sum.',
    subtopic: 'Ratios, medians, shares', skill: 'Sort and compute only what is needed' };
} });

/* ---------------- Graphics Interpretation: a bar chart with two drop-down statements of different kinds */
const GI_CONTEXTS = [['sales', 'Quarterly sales, 2025', '$ million', ['Q1', 'Q2', 'Q3', 'Q4'], 'million dollars'], ['visitors', 'Visitors to a museum', 'thousand visitors', ['2021', '2022', '2023', '2024', '2025'], 'thousand visitors'],
  ['orders', 'Orders by region', 'hundred orders', ['North', 'South', 'East', 'West'], 'hundred orders'], ['energy', 'Energy use by month', 'MWh', ['Jan', 'Feb', 'Mar', 'Apr', 'May'], 'MWh']];
T({ id: 'gibars', topic: 'Graphics Interpretation', type: 'GI', levels: [3, 5], make(L, R){
  const [cid, title, unit, labels, words] = R.pick(GI_CONTEXTS);
  const values = labels.map(() => R.int(8, 40)), total = sum(values), n = labels.length, mean = total / n;
  const pc = (x, b) => Math.round(100 * x / b);
  const part = (label, list, fmt) => {
    const seen = [], use = [];
    for (const [v, d] of list){ if (v == null || v < 0 || seen.some(s => Math.abs(s - v) < (fmt === 'n' ? 1 : fmt === 'x' ? 0.15 : 4))) continue; seen.push(v); use.push([v, d]); if (use.length === 4) break; }
    need(use.length === 4 && use[0][1] === null);
    use.sort((a, b) => a[0] - b[0]);
    const show = v => fmt === 'n' ? String(v) : fmt === 'x' ? num(v) : v + '%';
    return { label, options: use.map(([v]) => show(v)), answer: use.findIndex(x => x[1] === null), diagnosis: use.map(x => x[1]) };
  };
  const K = {
    change(){
      const ia = R.int(0, n - 2), ib = R.int(ia + 1, n - 1); need(values[ib] > values[ia] * 1.1);
      const ch = pc(values[ib] - values[ia], values[ia]), wb = pc(values[ib] - values[ia], values[ib]);
      return { m: `(${values[ib]} − ${values[ia]})/${values[ia]} ≈ ${ch}%`, p: part(`The value for ${labels[ib]} was greater than the value for ${labels[ia]} by approximately`, [[ch, null],
        [wb, { why: `Using ${labels[ib]} as the base (${values[ib] - values[ia]}/${values[ib]}) gives about ${wb}%. The base of “greater than ${labels[ia]}” is ${labels[ia]}: ${values[ib] - values[ia]}/${values[ia]}.`, type: 'Trap' }],
        [values[ib] - values[ia], { why: `${values[ib] - values[ia]} is the difference in ${words}, not a percent.`, type: 'Reading' }],
        [pc(values[ib], values[ia]), { why: `${values[ib]}/${values[ia]} ≈ ${pc(values[ib], values[ia])}% is ${labels[ib]} as a percent of ${labels[ia]}; subtract 100%.`, type: 'Conceptual' }],
        [ch + (R.chance(0.5) ? 20 : -20), { why: 'Recompute the change and divide by the starting value.', type: 'Calculation' }]]) };
    },
    share(){
      const k = R.int(0, n - 1), sh = pc(values[k], total), drop = (k + 1) % n, mx = Math.max(...values);
      return { m: `Total ${total}; ${values[k]}/${total} ≈ ${sh}%`, p: part(`${labels[k]} accounted for approximately this share of the total of all bars:`, [[sh, null],
        [pc(values[k], total - values[drop]), { why: `That leaves ${labels[drop]} out of the total. The total is ${values.join(' + ')} = ${total}.`, type: 'Careless' }],
        [pc(values[drop], total), { why: `${pc(values[drop], total)}% is ${labels[drop]}’s share, not ${labels[k]}’s.`, type: 'Reading' }],
        [values[k] < mx ? pc(values[k], mx) : null, { why: `That compares ${labels[k]} with the tallest bar, not with the total.`, type: 'Interpretation' }],
        [Math.round(100 / n), { why: `${Math.round(100 / n)}% would be an equal share for every bar; the bars differ.`, type: 'Guessing' }]]) };
    },
    ratio(){
      const hi = values.indexOf(Math.max(...values)), lo = values.indexOf(Math.min(...values)); need(hi !== lo && values[hi] / values[lo] >= 1.4);
      const r = round(values[hi] / values[lo], 1);
      return { m: `${values[hi]}/${values[lo]} ≈ ${num(r)}`, p: part(`The largest value was approximately this many times the smallest:`, [[r, null],
        [round(values[lo] / values[hi], 1), { why: 'The ratio is upside down: divide the largest value by the smallest.', type: 'Careless' }],
        [round((values[hi] - values[lo]) / values[lo], 1), { why: `That is how much larger it is, as a multiple (${values[hi] - values[lo]}/${values[lo]}); “times as large” is ${values[hi]}/${values[lo]}.`, type: 'Conceptual' }],
        [round(r + 1, 1), { why: 'Recompute the division.', type: 'Calculation' }],
        [round(values[hi] / values[(hi + 1) % n], 1), { why: `That divides by ${labels[(hi + 1) % n]}, not by the smallest bar.`, type: 'Reading' }]], 'x') };
    },
    average(){
      const avg = round(mean, 0), s = values.slice().sort((a, b) => a - b), medv = n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
      need(Math.abs(medv - avg) >= 2);
      const opts = [[avg, null], [Math.round(medv), { why: `That is the median (${num(medv)}); the average is ${total}/${n}.`, type: 'Conceptual' }],
        [Math.round((Math.max(...values) + Math.min(...values)) / 2), { why: 'Averaging only the largest and smallest bars ignores the others.', type: 'Procedural' }],
        [Math.round(total / (n - 1)), { why: `Divide the total by ${n}, the number of bars.`, type: 'Careless' }], [avg + 3, { why: 'Recompute the total.', type: 'Calculation' }]];
      return { m: `${values.join(' + ')} = ${total}; ${total}/${n} ≈ ${num(round(mean, 1))}`, p: part(`The average of the ${n} values is closest to`, opts, 'n') };
    },
    above(){
      const cnt = values.filter(v => v > mean).length, s = values.slice().sort((a, b) => a - b), medv = n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
      const byMed = values.filter(v => v > medv).length, ge = values.filter(v => v >= Math.round(mean)).length;
      return { m: `Average ${total}/${n} ≈ ${num(round(mean, 1))}; ${cnt} bars are above it`, p: part(`The number of bars above the average of all ${n} bars is`, [[cnt, null],
        [byMed !== cnt ? byMed : null, { why: 'That counts the bars above the median, not above the average.', type: 'Conceptual' }],
        [ge !== cnt ? ge : null, { why: `A bar equal to the rounded average (${Math.round(mean)}) is not above ${num(round(mean, 2))}.`, type: 'Careless' }],
        [n - cnt, { why: 'That counts the bars at or below the average.', type: 'Reading' }],
        [cnt + 1, { why: `Recount: the average is ${num(round(mean, 2))}.`, type: 'Calculation' }], [cnt - 1 >= 0 ? cnt - 1 : null, { why: `Recount: the average is ${num(round(mean, 2))}.`, type: 'Calculation' }]], 'n') };
    },
  };
  const kinds = R.sample(Object.keys(K), 2), built = kinds.map(k => K[k]());
  const step = 10, max = Math.ceil(Math.max(...values) / step) * step + (Math.max(...values) % step === 0 ? step : 0);
  return { type: 'GI', partStyle: 'dropdown', sig: [cid, ...kinds], stem: 'The chart shows ' + title.toLowerCase() + '. Use the drop-down menus to complete each statement so that it is accurate based on the chart.',
    chart: { kind: 'bar', title, unit, labels, values, max, step },
    parts: built.map(b => b.p),
    hints: ['For each statement, which bars does it use, and which one is the base?', 'Read the values first and write them down.', 'Key idea: “greater than A by x%” uses A as the base; a share or an average uses all the bars.', `Read the bars: ${labels.map((l, i) => `${l} ${values[i]}`).join(', ')}.`],
    method: built.map((b, i) => `${i + 1}) ${b.m}.`).join(' '),
    trap: 'Using the wrong bar as the base, or leaving a bar out of a total.', subtopic: 'Bar chart: ' + kinds.join(' and '), skill: 'Reading a chart precisely' };
} });

/* ---------------- Multi-Source Reasoning: a price list, an order list and three Yes/No statements */
T({ id: 'msrship', topic: 'Multi-Source Reasoning', type: 'MSR', levels: [4, 6], make(L, R){
  const base = R.int(6, 14), per = R.pick([1.5, 2, 2.5, 3, 4]), inc = R.int(2, 3), ex = R.pick([20, 25, 40, 50]);
  const extra = w => Math.max(0, Math.ceil(w - inc)), std = w => base + per * extra(w), cost = (w, x) => round(std(w) * (x ? 1 + ex / 100 : 1), 2);
  const ids = [101, 102, 103, 104, 105].map(n => n + 10 * R.int(0, 8)).sort((a, b) => a - b);
  const orders = ids.map(id => ({ id, w: round(R.int(8, 95) / 10, 1), x: R.chance(0.5) }));
  need(orders.some(o => o.x) && orders.some(o => !o.x) && orders.some(o => !isInt(o.w) && o.w > inc));
  const S = [];
  { const o = R.pick(orders.filter(o => !isInt(o.w) && o.w > inc)), c = cost(o.w, o.x);
    const naive = round((base + per * Math.max(0, o.w - inc)) * (o.x ? 1 + ex / 100 : 1), 2);
    const mid = Math.round(naive + c) / 2, v = mid > naive && mid < c && R.chance(0.7) ? mid : Math.round(c) + R.pick([-2, -1, 1, 2]), t = c > v;
    S.push({ label: `Order #${o.id} costs more than ${money(v)} to deliver.`, t, type: naive > v !== t ? 'Reading' : 'Calculation',
      why: `Order #${o.id}: ${o.w} kg → ${extra(o.w)} extra kg (a part of a kg counts as a whole kg) → ${money(base)} + ${extra(o.w)} × ${money(per)} = ${money(std(o.w))}${o.x ? `, plus ${ex}% for express = ${money(c)}` : ''}.` }); }
  { const xs = orders.filter(o => o.x), tot = round(sum(xs.map(o => cost(o.w, o.x))), 2), v = Math.round(tot + R.pick([-6, -3, 3, 6]));
    const naive = round(sum(xs.map(o => std(o.w))) + xs.length * base * ex / 100, 2);
    S.push({ label: `The express orders together cost more than ${money(v)} to deliver.`, t: tot > v, type: (naive > v) !== (tot > v) ? 'Procedural' : 'Calculation',
      why: `Express orders: ${xs.map(o => `#${o.id} ${money(cost(o.w, true))}`).join(', ')}; total ${money(tot)}. The ${ex}% applies to the whole standard price, not only the base fee.` }); }
  { const o = R.pick(orders.filter(o => o.x)), saving = round(cost(o.w, true) - cost(o.w, false), 2), v = Math.round(saving) + R.pick([-1, 1]) * (isInt(saving) ? 1 : R.pick([0, 1])) + (isInt(saving) ? 0 : 0.5 * R.pick([-1, 1]));
    need(v > 0);
    S.push({ label: `Sending order #${o.id} by standard delivery instead of express would save more than ${money(v)}.`, t: saving > v, type: 'Calculation',
      why: `Order #${o.id}: standard ${money(cost(o.w, false))}, express ${money(cost(o.w, true))}; the saving is ${money(saving)}.` }); }
  { const a = R.pick(orders), b = R.pick(orders.filter(o => o !== a)), ca = cost(a.w, a.x), cb = cost(b.w, b.x); need(ca !== cb);
    S.push({ label: `Order #${a.id} costs more to deliver than order #${b.id}.`, t: ca > cb, type: a.w > b.w !== ca > cb ? 'Trap' : 'Calculation',
      why: `#${a.id}: ${money(ca)}${a.x ? ' (express)' : ''}; #${b.id}: ${money(cb)}${b.x ? ' (express)' : ''}.${a.w > b.w !== ca > cb ? ' The heavier order is not always the dearer one: express adds ' + ex + '%.' : ''}` }); }
  const pick = R.sample(S, 3); need(pick.some(s => s.t) && pick.some(s => !s.t));
  return { type: 'MSR', partStyle: 'yesno', sig: ['ship', ...pick.map(s => s.label.split(' ')[0])],
    stem: 'For each statement, select **Yes** if it is supported by the information in the two sources. Otherwise select **No**.',
    tabs: [{ title: 'Price list', body: `Standard delivery costs ${money(base)} for a parcel of up to ${inc} kg, plus ${money(per)} for each additional kg or part of a kg.\n\nExpress delivery costs ${ex}% more than standard delivery for the same parcel.` },
      { title: 'Today’s orders', body: orders.map(o => `Order #${o.id}: ${o.w} kg, ${o.x ? 'express' : 'standard'}`).join('\n') }],
    parts: pick.map(s => ({ label: s.label, options: ['Yes', 'No'], answer: s.t ? 0 : 1, diagnosis: s.t ? [null, { why: s.why + ' So the statement is true.', type: s.type }] : [{ why: s.why + ' So the statement is false.', type: s.type }, null] })),
    hints: ['Which facts come from which tab? Write down the pricing rule first.', '“Each additional kg or part of a kg” means rounding the extra weight up.', `Key idea: standard price = ${money(base)} + ${money(per)} × (extra kg rounded up); express = standard × ${1 + ex / 100}.`, `For example, ${orders[0].w} kg has ${extra(orders[0].w)} extra kg.`],
    method: pick.map((s, i) => `${i + 1}) ${s.why} → ${s.t ? 'Yes' : 'No'}.`).join(' '), trap: 'Not rounding a part of a kg up, or applying the express surcharge to the base fee only.',
    subtopic: 'Pricing rule across two sources', skill: 'Combining sources' };
} });

/* ---------------- Multi-Source Reasoning: a staffing rule, a ward roster and costs */
T({ id: 'msrstaff', topic: 'Multi-Source Reasoning', type: 'MSR', levels: [4, 6], make(L, R){
  const p = R.pick([4, 5, 6]), tp = Math.floor(p / 2), cn = 10 * R.int(28, 45), ct = 10 * R.int(14, 24);
  const wards = R.sample(['Amber', 'Birch', 'Cedar', 'Dune', 'Elder', 'Fern'], 3).map(name => ({ name, pts: R.int(12, 40), n: R.int(2, 7), t: R.int(0, 3) }));
  const cap = w => w.n * p + w.t * tp, short = w => Math.max(0, w.pts - cap(w));
  const nurses = w => Math.ceil(short(w) / p), trainees = w => Math.ceil(short(w) / tp);
  need(wards.some(w => short(w) > 0) && wards.some(w => short(w) === 0));
  const S = [];
  { const w = R.pick(wards), ok = cap(w) >= w.pts, wrong = w.n * p + w.t * p >= w.pts;
    S.push({ kind: 'staffed', label: `Ward ${w.name} is adequately staffed under the staffing rule.`, t: ok, type: wrong !== ok ? 'Trap' : 'Calculation',
      why: `Ward ${w.name}: ${w.n} nurses × ${p} + ${w.t} trainee${w.t === 1 ? '' : 's'} × ${tp} = ${cap(w)} patients covered, for ${w.pts} patients.${wrong !== ok ? ' Counting trainees as full nurses gives the wrong answer.' : ''}` }); }
  { const total = sum(wards.map(nurses)), K = total + R.pick([-1, 0, 1]); need(K >= 1);
    const naive = Math.ceil(sum(wards.map(short)) / p);
    S.push({ kind: 'total', label: `If no trainees are added, at least ${K} more nurses are needed in total to staff every ward adequately.`, t: total >= K, type: naive !== total && (naive >= K) !== (total >= K) ? 'Procedural' : 'Calculation',
      why: `Shortfalls: ${wards.map(w => `${w.name} ${short(w)} patients → ${nurses(w)} nurse${nurses(w) === 1 ? '' : 's'}`).join('; ')}. Total ${total}. Each ward is staffed separately, so round up ward by ward.` }); }
  { const cN = sum(wards.map(nurses)) * cn, cT = sum(wards.map(trainees)) * ct;
    need(cN !== cT);
    S.push({ kind: 'cost', label: 'Covering every shortfall with trainees instead of nurses would cost less per shift.', t: cT < cN, type: 'Calculation',
      why: `Nurses: ${sum(wards.map(nurses))} × $${num(cn)} = $${num(cN)}. Trainees (each covers ${tp}): ${sum(wards.map(trainees))} × $${num(ct)} = $${num(cT)}.` }); }
  { const w = R.pick(wards.filter(x => short(x) === 0)), r = R.pick([10, 20, 25, 30, 50]), np = Math.ceil(w.pts * (1 + r / 100)), ok = cap(w) >= np;
    S.push({ kind: 'rise', label: `If the number of patients on Ward ${w.name} rose by ${r}%, its current staff would still be adequate.`, t: ok, type: 'Calculation',
      why: `Ward ${w.name}: ${w.pts} × ${1 + r / 100} = ${num(round(w.pts * (1 + r / 100), 2))}, so ${np} patients; current staff covers ${cap(w)}.` }); }
  const pick = R.sample(S, 3); need(pick.some(s => s.t) && pick.some(s => !s.t));
  return { type: 'MSR', partStyle: 'yesno', sig: ['staff', ...pick.map(s => s.kind)],
    stem: 'For each statement, select **Yes** if it is supported by the information in the three sources. Otherwise select **No**.',
    tabs: [{ title: 'Staffing rule', body: `From: Director of nursing\n\nOn every shift, each nurse may care for at most ${p} patients. A trainee nurse may care for at most ${tp} patients. A ward is adequately staffed when its nurses and trainees together can cover all of its patients.` },
      { title: 'Ward roster', body: wards.map(w => `Ward ${w.name}: ${w.pts} patients per shift; ${w.n} nurses and ${w.t} trainee${w.t === 1 ? '' : 's'} on each shift`).join('\n') },
      { title: 'Costs', body: `A nurse costs $${num(cn)} per shift. A trainee costs $${num(ct)} per shift. Extra staff are hired ward by ward.` }],
    parts: pick.map(s => ({ label: s.label, options: ['Yes', 'No'], answer: s.t ? 0 : 1, diagnosis: s.t ? [null, { why: s.why + ' So the statement is true.', type: s.type }] : [{ why: s.why + ' So the statement is false.', type: s.type }, null] })),
    hints: ['Which tab gives the rule, which the numbers, which the costs?', `Work out how many patients each ward’s current staff can cover: nurses × ${p} + trainees × ${tp}.`, 'Key idea: staff come in whole people, and every ward is staffed separately, so round up ward by ward.', `Ward ${wards[0].name} can cover ${cap(wards[0])} patients now.`],
    method: pick.map((s, i) => `${i + 1}) ${s.why} → ${s.t ? 'Yes' : 'No'}.`).join(' '), trap: 'Counting a trainee as a full nurse, or pooling the shortfalls of different wards before rounding up.',
    subtopic: 'Staffing rule across three sources', skill: 'Combining sources' };
} });

/* ================================================================== API */
const BLOCK = { PS: 'Q', DS: 'DI', TPA: 'DI', TA: 'DI', GI: 'DI', MSR: 'DI' };
const SECTION = { Q: 'Quant', DI: 'Data Insights' };
const SEC = { PS: [0, 60, 90, 120, 140, 160, 180], DS: [0, 60, 90, 110, 130, 150, 165], TPA: [0, 120, 135, 150, 165, 180, 195], TA: [0, 120, 135, 150, 165, 180, 195], GI: [0, 100, 110, 120, 140, 155, 170], MSR: [0, 150, 165, 180, 195, 210, 225] };
const byId = {}; for (const t of TPL){ t.type = t.type || 'PS'; byId[t.id] = t; }
const ID = /^gen-([a-z0-9]+)-([1-6])-([a-z0-9]+)$/;
const cache = new Map();
function parse(id){
  const m = ID.exec(String(id)); if (!m) return null;
  const t = byId[m[1]], L = +m[2];
  return t && L >= t.levels[0] && L <= t.levels[1] ? { t, L, seed: m[3] } : null;
}
function meta(id){
  const p = parse(id); if (!p) return null;
  return { id, topic: p.t.topic, section: SECTION[BLOCK[p.t.type]], type: p.t.type, difficulty: p.L, group: null, gen: true };
}
/* The question behind an id, or null if the id is unknown. The same id always gives the same question. */
function fromId(id){
  if (cache.has(id)) return cache.get(id);
  const p = parse(id); let q = null;
  if (p){
    for (let k = 0; k < 100 && !q; k++){
      try { q = p.t.make(p.L, Rng(hash(p.t.id, p.L, p.seed, k))); }
      catch (e){ if (!(e instanceof Retry)){ if (typeof console !== 'undefined') console.error('GMATGen: ' + id, e); break; } }
    }
    if (q){
      const block = BLOCK[p.t.type];
      q = Object.assign({ id, set: 'generated', block, section: SECTION[block], type: p.t.type, topic: p.t.topic, difficulty: p.L, expectedSec: SEC[p.t.type][p.L], template: p.t.id }, q, { id, set: 'generated', topic: p.t.topic, difficulty: p.L });
      for (const k of Object.keys(q)) if (q[k] === undefined) delete q[k];
    }
  }
  cache.set(id, q);
  return q;
}
/* Pool entries (no question built yet): `per` fresh ids for every template and level, filtered by topic, section or level. */
function candidates(opts){
  opts = opts || {};
  const seed = opts.seed == null ? 1 : opts.seed, per = opts.per || 1, out = [];
  for (const t of TPL){
    if (t.retired || (opts.topic && t.topic !== opts.topic) || (opts.section && SECTION[BLOCK[t.type]] !== opts.section)) continue;
    for (let L = t.levels[0]; L <= t.levels[1]; L++){
      if (opts.level && L !== opts.level) continue;
      for (let k = 0; k < per; k++) out.push(meta(`gen-${t.id}-${L}-${hash(seed, t.id, L, k).toString(36)}`));
    }
  }
  return out;
}
const templates = () => TPL.filter(t => !t.retired).map(t => ({ id: t.id, topic: t.topic, type: t.type, section: SECTION[BLOCK[t.type]], levels: t.levels.slice() }));
const topics = () => [...new Set(templates().map(t => t.topic))];
const isGenerated = id => ID.test(String(id));

const api = { fromId, candidates, meta, templates, topics, isGenerated, _test: { Q, Frac, num, powmod, legendre, C, P, isPrime } };
root.GMATGen = api;
if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
