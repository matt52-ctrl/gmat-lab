/* GMAT Lab foundations drills: short timed sets on the basics the GMAT takes for granted (mental arithmetic, signs,
   fractions, decimals, percents, ratios, powers, equations, divisibility, averages and rates), three levels each.
   Answers are typed and checked exactly, as fractions, so 0.75, 3/4 and 75% are compared by value.
   Pure functions, no DOM: window.GMATDrills in the browser, module.exports in Node (tests/drills.test.js). */
(function (root){
'use strict';

/* ------------------------------------------------------------------ exact numbers: n/d in lowest terms, d > 0 */
const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b){ const t = a % b; a = b; b = t; } return a; };
function Q(n, d){
  d = d == null ? 1 : d;
  if (!d) throw new Error('division by zero');
  if (d < 0){ n = -n; d = -d; }
  const g = gcd(n, d) || 1;
  return { n: n / g, d: d / g };
}
const add = (a, b) => Q(a.n * b.d + b.n * a.d, a.d * b.d);
const sub = (a, b) => Q(a.n * b.d - b.n * a.d, a.d * b.d);
const mul = (a, b) => Q(a.n * b.n, a.d * b.d);
const div = (a, b) => Q(a.n * b.d, a.d * b.n);
const eq = (a, b) => a.n === b.n && a.d === b.d;
const frac = q => q.d === 1 ? String(q.n) : q.n + '/' + q.d;
/* The terminating decimal of q, or null (1/3 has none). */
function dec(q){
  let d = q.d; while (d % 2 === 0) d /= 2; while (d % 5 === 0) d /= 5;
  return d === 1 ? String(+(q.n / q.d).toFixed(10)) : null;
}
const neg = x => x < 0 ? '−' + (-x) : String(x);            // display: typographic minus
const par = x => x < 0 ? '(−' + (-x) + ')' : String(x);      // a negative operand in brackets

/* Everything a typed answer could mean: "3/4", "0.75", "0,75" (decimal comma), "1,200", "1 1/2", "75%", "8:15", "x = 5". */
function readings(input){
  let s = String(input == null ? '' : input).trim().toLowerCase().replace(/[−–—]/g, '-').replace(/^[a-z]\s*=\s*/, '').replace(/\s*%$/, '').replace(/\s+/g, ' ');
  if (!s) return [];
  const out = [], one = t => { const q = readOne(t); if (q) out.push(q); };
  if (/^-?\d{1,3}(,\d{3})+$/.test(s)){ one(s.replace(/,/g, '')); if (/^-?\d+,\d{3}$/.test(s)) one(s.replace(',', '.')); }
  else if (/^-?\d*,\d+$/.test(s)) one(s.replace(',', '.'));
  else one(s);
  return out;
}
function readOne(s){
  let m;
  if ((m = /^(-?)(\d+) (\d+)\/(\d+)$/.exec(s))){ if (+m[4] === 0) return null; const q = Q(+m[2] * +m[4] + +m[3], +m[4]); return m[1] ? Q(-q.n, q.d) : q; }
  if ((m = /^(-?\d+) ?[/:] ?(\d+)$/.exec(s))) return +m[2] === 0 ? null : Q(+m[1], +m[2]);
  if ((m = /^(-?)(\d*)\.(\d+)$/.exec(s))){ const k = m[3].length; const q = Q(+(m[2] || 0) * Math.pow(10, k) + +m[3], Math.pow(10, k)); return m[1] ? Q(-q.n, q.d) : q; }
  if (/^-?\d+$/.test(s)) return Q(+s, 1);
  return null;
}
/* Check a typed answer. item.form: 'fraction' needs a fraction in lowest terms, 'decimal' a decimal; otherwise any
   equivalent value counts. Returns { ok, reason } with reason 'empty' | 'unreadable' | 'lowest' | 'form' | 'wrong'. */
function check(item, input){
  const raw = String(input == null ? '' : input).trim();
  if (!raw) return { ok: false, reason: 'empty' };
  const rs = readings(raw);
  if (!rs.length) return { ok: false, reason: 'unreadable' };
  if (!rs.some(q => eq(q, item.answer))) return { ok: false, reason: 'wrong' };
  if (item.form === 'fraction'){
    const m = /^\s*(-?\d+)\s*\/\s*(\d+)\s*$/.exec(raw.replace(/[−–—]/g, '-'));
    if (!m) return item.answer.d === 1 && /^-?\d+$/.test(raw.trim()) ? { ok: true, reason: null } : { ok: false, reason: 'form' };
    if (gcd(+m[1], +m[2]) !== 1) return { ok: false, reason: 'lowest' };
  }
  if (item.form === 'decimal' && item.answer.d !== 1 && !/[.,]/.test(raw)) return { ok: false, reason: 'form' };
  return { ok: true, reason: null };
}
/* The answer as the drill shows it. */
function show(item){
  if (item.show) return item.show;
  const a = item.answer;
  if (a.d === 1) return neg(a.n);
  if (item.form === 'decimal' || item.prefer === 'decimal'){ const d = dec(a); if (d) return d.replace('-', '−'); }
  return (a.n < 0 ? '−' + (-a.n) : a.n) + '/' + a.d;
}

/* ------------------------------------------------------------------ random helpers */
function R(rng){
  const r = rng || Math.random;
  const int = (a, b) => a + Math.floor(r() * (b - a + 1));
  return { int, pick: arr => arr[Math.floor(r() * arr.length)], chance: p => r() < p, nz: (a, b) => { let x = 0; while (!x) x = int(a, b); return x; } };
}
const coprimeFrac = (r, maxD, proper) => { for (;;){ const d = r.int(2, maxD), n = r.int(1, proper ? d - 1 : 2 * d); if (gcd(n, d) === 1) return [n, d]; } };

/* ------------------------------------------------------------------ the skills
   Each level: target = the median seconds per answer that passes the level (with 9 of 10 right); gen(r) → item.
   item: { prompt (inline markup: ^{…}), answer (Q), form?, prefer?, show?, tip, expr? (JS for the tests), data? } */
const SKILLS = [
  { id: 'mental', name: 'Mental arithmetic', topic: null,
    text: 'Adding, subtracting, times tables and squares without a calculator: the Quant section has none.',
    levels: [
      { target: 6, gen: r => { const a = r.int(12, 89), b = r.int(11, 79), plus = r.chance(0.5), x = Math.max(a, b), y = Math.min(a, b);
          return plus ? { prompt: `${a} + ${b}`, answer: Q(a + b), expr: `${a}+${b}`, tip: 'Round and correct: 47 + 38 = 47 + 40 − 2.' }
            : { prompt: `${x} − ${y}`, answer: Q(x - y), expr: `${x}-${y}`, tip: 'Count up from the smaller number: 83 − 47 → 47 + 3 = 50, + 33 = 83, so 36.' }; } },
      { target: 5, gen: r => { const a = r.int(2, 12), b = r.int(2, 12);
          return r.chance(0.6) ? { prompt: `${a} × ${b}`, answer: Q(a * b), expr: `${a}*${b}`, tip: 'The tables up to 12 × 12 should be instant.' }
            : { prompt: `${a * b} ÷ ${a}`, answer: Q(b), expr: `${a * b}/${a}`, tip: 'Division is the table read backwards: which number times ' + a + ' gives ' + (a * b) + '?' }; } },
      { target: 10, gen: r => { const k = r.int(0, 2);
          if (k === 0){ const a = r.int(12, 99), b = r.int(3, 9); return { prompt: `${a} × ${b}`, answer: Q(a * b), expr: `${a}*${b}`, tip: 'Split the two-digit number: 47 × 6 = 40 × 6 + 7 × 6 = 240 + 42.' }; }
          if (k === 1){ const n = r.int(11, 20); return { prompt: `${n}^{2}`, answer: Q(n * n), expr: `${n}**2`, tip: 'Learn the squares up to 20^{2} = 400 by heart; they come up everywhere.' }; }
          const b = r.int(3, 9), q = r.int(20, 150); return { prompt: `${b * q} ÷ ${b}`, answer: Q(q), expr: `${b * q}/${b}`, tip: 'Split the dividend into easy multiples: 432 ÷ 6 = 420 ÷ 6 + 12 ÷ 6 = 70 + 2.' }; } },
    ] },
  { id: 'signs', name: 'Negative numbers and order of operations', topic: 'Odd/even & signs',
    text: 'Signs and brackets: most careless errors in algebra start here.',
    levels: [
      { target: 8, gen: r => { const a = r.nz(-20, 20), b = r.nz(-20, 20), plus = r.chance(0.5);
          return { prompt: `${neg(a)} ${plus ? '+' : '−'} ${par(b)}`, answer: Q(plus ? a + b : a - b), expr: `(${a})${plus ? '+' : '-'}(${b})`, tip: 'Subtracting a negative is adding: −7 − (−12) = −7 + 12 = 5.' }; } },
      { target: 8, gen: r => { let a = r.int(2, 12) * (r.chance(0.5) ? -1 : 1), b = r.int(2, 12) * (r.chance(0.5) ? -1 : 1); if (a > 0 && b > 0) a = -a;
          return r.chance(0.5) ? { prompt: `${neg(a)} × ${par(b)}`, answer: Q(a * b), expr: `(${a})*(${b})`, tip: 'Same signs give a positive, different signs a negative.' }
            : { prompt: `${neg(a * b)} ÷ ${par(a)}`, answer: Q(b), expr: `(${a * b})/(${a})`, tip: 'Same signs give a positive, different signs a negative.' }; } },
      { target: 20, gen: r => { const k = r.int(0, 3), a = r.int(2, 9), b = r.int(1, 9), c = r.int(1, 9), d = r.int(1, 9);
          if (k === 0) return { prompt: `${a} − ${b} × (${c} − ${d})`, answer: Q(a - b * (c - d)), expr: `${a}-${b}*(${c}-${d})`, tip: 'Brackets first, then × and ÷, then + and −.' };
          if (k === 1) return { prompt: `(${a} − ${b + a})^{2} − ${c} × ${d}`, answer: Q(b * b - c * d), expr: `(${a}-${b + a})**2-${c}*${d}`, tip: 'Brackets, then powers: (−5)^{2} = 25.' };
          if (k === 2) return { prompt: `−${a}^{2} + ${b} × ${c}`, answer: Q(-a * a + b * c), expr: `-(${a}**2)+${b}*${c}`, tip: '−3^{2} means −(3^{2}) = −9; only (−3)^{2} is 9.' };
          return { prompt: `(−${a})^{2} − ${b} × ${c}`, answer: Q(a * a - b * c), expr: `(-${a})**2-${b}*${c}`, tip: 'The bracket makes the square positive: (−4)^{2} = 16.' }; } },
    ] },
  { id: 'fractions', name: 'Fractions', topic: 'Fractions & decimals',
    text: 'Simplifying, adding and dividing fractions quickly and exactly.',
    levels: [
      { target: 12, gen: r => { const [p, q] = coprimeFrac(r, 12, true), k = r.int(2, 9);
          return { prompt: `Simplify ${p * k}/${q * k}`, answer: Q(p, q), form: 'fraction', data: { n: p * k, d: q * k }, tip: `Divide top and bottom by their greatest common factor (here ${k}).` }; } },
      { target: 20, gen: r => { const [a, b] = coprimeFrac(r, 12, true), [c, d] = coprimeFrac(r, 12, true), A = Q(a, b), C = Q(c, d), plus = r.chance(0.5) || eq(A, C);
          const [x, y] = plus || A.n * C.d > C.n * A.d ? [[a, b], [c, d]] : [[c, d], [a, b]];
          return { prompt: `${x[0]}/${x[1]} ${plus ? '+' : '−'} ${y[0]}/${y[1]}`, answer: plus ? add(Q(x[0], x[1]), Q(y[0], y[1])) : sub(Q(x[0], x[1]), Q(y[0], y[1])),
            expr: `${x[0]}/${x[1]}${plus ? '+' : '-'}${y[0]}/${y[1]}`, tip: 'Common denominator: a/b + c/d = (ad + bc)/bd, then simplify.' }; } },
      { target: 20, gen: r => { const k = r.int(0, 2), [a, b] = coprimeFrac(r, 9, false), [c, d] = coprimeFrac(r, 9, false);
          if (k === 0) return { prompt: `${a}/${b} × ${c}/${d}`, answer: mul(Q(a, b), Q(c, d)), expr: `(${a}/${b})*(${c}/${d})`, tip: 'Cancel across before multiplying: 4/9 × 3/8 = 1/3 × 1/2.' };
          if (k === 1) return { prompt: `${a}/${b} ÷ ${c}/${d}`, answer: div(Q(a, b), Q(c, d)), expr: `(${a}/${b})/(${c}/${d})`, tip: 'To divide, multiply by the reciprocal: a/b ÷ c/d = a/b × d/c.' };
          const [p, q] = coprimeFrac(r, 9, true), N = q * r.int(2, 15);
          return { prompt: `${p}/${q} of ${N}`, answer: Q(p * N, q), expr: `${p}/${q}*${N}`, tip: '"Of" means multiply: divide by the bottom, multiply by the top.' }; } },
    ] },
  { id: 'decimals', name: 'Fractions, decimals and percents', topic: 'Fractions & decimals',
    text: 'The same number in three forms: 3/8 = 0.375 = 37.5%.',
    levels: [
      { target: 8, gen: r => { const [p, q] = r.pick([[1, 2], [1, 4], [3, 4], [1, 5], [2, 5], [3, 5], [4, 5], [1, 8], [3, 8], [5, 8], [7, 8], [1, 10], [3, 10], [7, 10], [1, 20], [1, 25], [1, 50]]);
          return r.chance(0.5) ? { prompt: `Write ${p}/${q} as a decimal`, answer: Q(p, q), form: 'decimal', expr: `${p}/${q}`, tip: 'Learn the eighths and fifths by heart: 1/8 = 0.125, 1/5 = 0.2.' }
            : { prompt: `Write ${p}/${q} as a percent`, answer: Q(100 * p, q), prefer: 'decimal', expr: `100*${p}/${q}`, tip: 'Percent = decimal × 100: 3/8 = 0.375 = 37.5%.' }; } },
      { target: 10, gen: r => { const q = r.pick([4, 5, 8, 10, 20, 25, 50]), p = (() => { for (;;){ const x = r.int(1, q - 1); if (gcd(x, q) === 1) return x; } })(), val = Q(p, q);
          const ds = dec(val), k = ds.split('.')[1].length;
          if (r.chance(0.5)) return { prompt: `Write ${ds} as a fraction in lowest terms`, answer: val, form: 'fraction', expr: `${p}/${q}`, tip: `${ds} = ${Math.round(p / q * Math.pow(10, k))}/${Math.pow(10, k)}; then divide top and bottom by their common factors.` };
          const pc = dec(Q(100 * p, q));
          return { prompt: `Write ${pc}% as a fraction in lowest terms`, answer: val, form: 'fraction', expr: `${p}/${q}`, tip: `${pc}% = ${pc}/100; then simplify.` }; } },
      { target: 15, gen: r => { const k = r.int(0, 1);
          if (k === 0){ const a = Q(r.int(1, 9), r.pick([10, 100])), b = Q(r.int(1, 9), r.pick([10, 100]));
            return { prompt: `${dec(a)} × ${dec(b)}`, answer: mul(a, b), prefer: 'decimal', expr: `${dec(a)}*${dec(b)}`, tip: 'Multiply the digits, then count the decimal places: 0.3 × 0.02 → 3 × 2 = 6, three places → 0.006.' }; }
          const b = r.pick([Q(2, 100), Q(4, 100), Q(5, 100), Q(2, 10), Q(25, 100), Q(5, 10), Q(3, 10), Q(6, 10), Q(12, 10)]), n = r.int(2, 40), a = mul(Q(n), b);
          return { prompt: `${dec(a)} ÷ ${dec(b)}`, answer: Q(n), expr: `${dec(a)}/${dec(b)}`, tip: 'Move both decimal points until the divisor is whole: 1.2 ÷ 0.04 = 120 ÷ 4.' }; } },
    ] },
  { id: 'percent', name: 'Percents', topic: 'Percents',
    text: 'Percent of, percent change, successive changes and reverse percents.',
    levels: [
      { target: 12, gen: r => { const p = r.pick([5, 10, 15, 20, 25, 30, 40, 50, 60, 75]), Y = 20 * r.int(1, 20);
          return { prompt: `${p}% of ${Y}`, answer: Q(p * Y, 100), expr: `${p}*${Y}/100`, tip: '10% moves the point one place; 5% is half of that; 25% is a quarter.' }; } },
      { target: 20, gen: r => { const k = r.int(0, 2), o = 20 * r.int(1, 20), c = r.pick([5, 10, 20, 25, 30, 40, 50, 60, 75]), up = r.chance(0.5), n = up ? o + o * c / 100 : o - o * c / 100;
          if (k === 0) return { prompt: `From ${o} to ${n}: percent ${up ? 'increase' : 'decrease'}?`, answer: Q(c), expr: `Math.abs(${n}-${o})/${o}*100`, tip: 'Change ÷ original × 100: always divide by the starting value.' };
          if (k === 1) return { prompt: `${o} ${up ? 'increased' : 'decreased'} by ${c}%`, answer: Q(n), expr: `${o}*(1${up ? '+' : '-'}${c}/100)`, tip: `Multiply by one factor: × ${up ? 1 + c / 100 : 1 - c / 100}.` };
          return { prompt: `${o * c / 100} is what percent of ${o}?`, answer: Q(c), expr: `${o * c / 100}/${o}*100`, tip: 'Part ÷ whole × 100.' }; } },
      { target: 25, gen: r => { if (r.chance(0.5)){ const a = r.pick([10, 20, 25, 50]), b = r.pick([10, 20, 25, 50]), f = mul(Q(100 + a, 100), Q(100 - b, 100));
            return { prompt: `A price rises by ${a}%, then falls by ${b}%. Overall percent change? (negative for a decrease)`, answer: mul(sub(f, Q(1)), Q(100)), prefer: 'decimal', expr: `((1+${a}/100)*(1-${b}/100)-1)*100`, tip: `Multiply the factors: ${1 + a / 100} × ${1 - b / 100} = ${+((1 + a / 100) * (1 - b / 100)).toFixed(4)}.` }; }
          const c = r.pick([10, 20, 25, 40, 50]), o = 20 * r.int(2, 25), dn = r.chance(0.6), P = dn ? o - o * c / 100 : o + o * c / 100;
          return { prompt: `After a ${c}% ${dn ? 'discount' : 'increase'} a price is ${P}. The original price?`, answer: Q(o), expr: `${P}/(1${dn ? '-' : '+'}${c}/100)`, tip: `Divide by the factor: ${P} ÷ ${dn ? 1 - c / 100 : 1 + c / 100}, not ${P} ${dn ? '+' : '−'} ${c}%.` }; } },
    ] },
  { id: 'ratios', name: 'Ratios and proportions', topic: 'Ratios & proportions',
    text: 'Splitting in a ratio, proportions and combining ratios.',
    levels: [
      { target: 12, gen: r => { let a, b; do { a = r.int(1, 9); b = r.int(1, 9); } while (a === b || gcd(a, b) !== 1); const T = (a + b) * r.int(2, 12), big = r.chance(0.5);
          return { prompt: `Split ${T} in the ratio ${a}:${b}. The ${big ? 'larger' : 'smaller'} part?`, answer: Q(T * (big ? Math.max(a, b) : Math.min(a, b)), a + b), expr: `${T}*${big ? Math.max(a, b) : Math.min(a, b)}/${a + b}`, tip: 'One part = total ÷ (a + b); then multiply.' }; } },
      { target: 15, gen: r => { if (r.chance(0.5)){ const b = r.int(2, 20), c = r.int(1, 9), d = r.pick([2, 4, 5, 8, 10]);
            return { prompt: `x/${b} = ${c}/${d}. x = ?`, answer: Q(b * c, d), prefer: 'decimal', expr: `${b}*${c}/${d}`, tip: 'Cross-multiply: x = b × c ÷ d.' }; }
          const u = r.pick([Q(1, 2), Q(3, 4), Q(6, 5), Q(3, 2), Q(2), Q(5, 2), Q(9, 4), Q(3)]), n1 = r.int(2, 6), n2 = r.int(7, 15);
          const price = mul(Q(n1), u), money = x => x.d === 1 ? String(x.n) : (x.n / x.d).toFixed(2);
          return { prompt: `${n1} pens cost $${money(price)}. How many dollars do ${n2} pens cost?`, answer: mul(Q(n2), u), prefer: 'decimal', expr: `${dec(price)}/${n1}*${n2}`, tip: 'Find the price of one, then multiply.' }; } },
      { target: 25, gen: r => { let p, q, rr, s; do { p = r.int(1, 7); q = r.int(2, 8); rr = r.int(2, 9); s = r.int(1, 9); } while (p === q || rr === s || rr === q || gcd(p, q) !== 1 || gcd(rr, s) !== 1); const ans = Q(p * rr, q * s);
          return { prompt: `a:b = ${p}:${q} and b:c = ${rr}:${s}. What is a:c?`, answer: ans, show: `${ans.n}:${ans.d}`, data: { p, q, r: rr, s }, tip: `Make b equal in both: multiply the first by ${rr} and the second by ${q}.` }; } },
    ] },
  { id: 'powers', name: 'Powers and roots', topic: 'Exponents & roots',
    text: 'Common powers, the exponent rules and fractional exponents.',
    levels: [
      { target: 8, gen: r => { const k = r.int(0, 3);
          if (k === 0){ const [b, e] = r.pick([[2, r.int(2, 10)], [3, r.int(2, 5)], [5, r.int(2, 4)], [10, r.int(2, 6)], [4, r.int(2, 4)]]); return { prompt: `${b}^{${e}}`, answer: Q(Math.pow(b, e)), expr: `${b}**${e}`, tip: 'Know the powers of 2 up to 2^{10} = 1024 and of 3 up to 3^{5} = 243.' }; }
          if (k <= 2){ const n = r.int(2, 15); return { prompt: `√${n * n}`, answer: Q(n), expr: `Math.sqrt(${n * n})`, tip: 'Know the squares up to 15^{2} = 225.' }; }
          const n = r.int(2, 6); return { prompt: `∛${n * n * n}`, answer: Q(n), expr: `Math.cbrt(${n * n * n})`, tip: 'Know the cubes up to 6^{3} = 216.' }; } },
      { target: 15, gen: r => { const k = r.int(0, 3), b = r.pick([2, 3, 5, 7]), a = r.int(2, 9), c = r.int(2, 6);
          if (k === 0) return { prompt: `${b}^{${a}} × ${b}^{${c}} = ${b}^{?}`, answer: Q(a + c), data: { kind: 'exp', b, value: `${b}**${a}*${b}**${c}` }, tip: 'Same base, multiplying: add the exponents.' };
          if (k === 1) return { prompt: `(${b}^{${a}})^{${c}} = ${b}^{?}`, answer: Q(a * c), data: { kind: 'exp', b, value: `(${b}**${a})**${c}` }, tip: 'A power of a power: multiply the exponents.' };
          if (k === 2) return { prompt: `${b}^{${a}} ÷ ${b}^{${c}} = ${b}^{?}`, answer: Q(a - c), data: { kind: 'exp', b, value: `${b}**${a}/${b}**${c}` }, tip: 'Same base, dividing: subtract the exponents (the result can be negative).' };
          const e = r.int(1, 3), bb = r.pick([2, 3, 4, 5, 10]);
          return r.chance(0.5) ? { prompt: `${bb}^{−${e}}`, answer: Q(1, Math.pow(bb, e)), expr: `${bb}**(-${e})`, tip: 'A negative exponent is a reciprocal: 2^{−3} = 1/2^{3} = 1/8.' }
            : { prompt: `(1/${bb})^{−${e}}`, answer: Q(Math.pow(bb, e)), expr: `(1/${bb})**(-${e})`, tip: 'Flip the fraction and make the exponent positive.' }; } },
      { target: 20, gen: r => { const k = r.int(0, 3), a = r.int(2, 6), c = r.int(1, 8);
          if (k === 0){ const [B, p] = r.pick([[4, 2], [8, 3], [16, 4], [32, 5]]); return { prompt: `${B}^{${a}} = 2^{?}`, answer: Q(p * a), data: { kind: 'exp', b: 2, value: `${B}**${a}` }, tip: `Rewrite the base: ${B} = 2^{${p}}, so ${B}^{${a}} = 2^{${p * a}}.` }; }
          if (k === 1) return { prompt: `8^{${a}} × 2^{${c}} = 2^{?}`, answer: Q(3 * a + c), data: { kind: 'exp', b: 2, value: `8**${a}*2**${c}` }, tip: '8 = 2^{3}: rewrite, then add the exponents.' };
          if (k === 2) return { prompt: `9^{${a}} ÷ 3^{${c}} = 3^{?}`, answer: Q(2 * a - c), data: { kind: 'exp', b: 3, value: `9**${a}/3**${c}` }, tip: '9 = 3^{2}: rewrite, then subtract the exponents.' };
          const [B, t, ans] = r.pick([[27, '2/3', 9], [16, '3/4', 8], [8, '2/3', 4], [32, '3/5', 8], [81, '3/4', 27], [64, '1/3', 4], [25, '3/2', 125], [4, '5/2', 32]]);
          return { prompt: `${B}^{${t}}`, answer: Q(ans), expr: `${B}**(${t})`, tip: 'Take the root first (the bottom of the exponent), then the power: 27^{2/3} = 3^{2} = 9.' }; } },
    ] },
  { id: 'equations', name: 'Linear equations', topic: 'Linear equations',
    text: 'Solving for x in one step, two steps and with two equations.',
    levels: [
      { target: 12, gen: r => { const a = r.int(2, 9) * (r.chance(0.25) ? -1 : 1), x = r.int(-10, 12), b = r.nz(-20, 20), c = a * x + b;
          return { prompt: `${neg(a)}x ${b < 0 ? '−' : '+'} ${Math.abs(b)} = ${neg(c)}. x = ?`, answer: Q(x), data: { kind: 'lin', a, b, c }, tip: 'Undo in reverse order: move the number, then divide by the coefficient.' }; } },
      { target: 20, gen: r => { if (r.chance(0.5)){ const a = r.int(2, 6), b = r.int(1, 6), c = r.int(1, a - 1), x = r.int(-6, 10), d = a * (x - b) - c * x;
            return { prompt: `${a}(x − ${b}) = ${c === 1 ? '' : c}x ${d < 0 ? '−' : '+'} ${Math.abs(d)}. x = ?`, answer: Q(x), data: { kind: 'lin2', a, b, c, d }, tip: 'Expand the bracket, then collect the x terms on one side.' }; }
          const a = r.int(2, 6), x = a * r.int(-5, 8), b = r.int(1, 12), c = x / a + b;
          return { prompt: `x/${a} + ${b} = ${neg(c)}. x = ?`, answer: Q(x), data: { kind: 'lin3', a, b, c }, tip: 'Subtract first, then multiply by the denominator.' }; } },
      { target: 30, gen: r => { const k = r.int(0, 2), x = r.int(-5, 12), y = r.int(-5, 12);
          if (k === 0){ const wantX = r.chance(0.5); return { prompt: `x + y = ${neg(x + y)} and x − y = ${neg(x - y)}. ${wantX ? 'x' : 'y'} = ?`, answer: Q(wantX ? x : y), data: { kind: 'sys', a: [1, 1, x + y], b: [1, -1, x - y], want: wantX ? 'x' : 'y' }, tip: 'Add the two equations to eliminate y; subtract them to eliminate x.' }; }
          if (k === 1){ const a = r.int(2, 5), b = r.int(2, 5), c = a * x + b * y, d = x - y; return { prompt: `${a}x + ${b}y = ${neg(c)} and x − y = ${neg(d)}. x = ?`, answer: Q(x), data: { kind: 'sys', a: [a, b, c], b: [1, -1, d], want: 'x' }, tip: `Substitute y = x ${d < 0 ? '+ ' + (-d) : '− ' + d} into the first equation.` }; }
          const [p, q] = r.pick([[2, 3], [3, 4], [2, 5], [3, 6], [4, 6], [2, 4]]), X = p * q / gcd(p, q) * r.int(1, 6), s = Q(X, p), t = Q(X, q), tot = add(s, t);
          return { prompt: `x/${p} + x/${q} = ${frac(tot)}. x = ?`, answer: Q(X), data: { kind: 'fr', p, q, tot: frac(tot) }, tip: `Multiply everything by ${p * q / gcd(p, q)} (the common denominator) to clear the fractions.` }; } },
    ] },
  { id: 'divisibility', name: 'Divisibility, primes and remainders', topic: 'Integers & divisibility',
    text: 'Remainders, greatest common divisors, least common multiples and counting divisors.',
    levels: [
      { target: 10, gen: r => { const n = r.int(20, 99), d = r.int(3, 9);
          return { prompt: `The remainder when ${n} is divided by ${d}`, answer: Q(n % d), data: { kind: 'rem', n, d }, tip: 'Take the largest multiple of the divisor not above the number; the remainder is what is left (0 ≤ r < divisor).' }; } },
      { target: 20, gen: r => { let m, n; do { m = r.int(2, 8); n = r.int(2, 8); } while (m === n || gcd(m, n) !== 1); const g = r.int(2, 9), a = g * m, b = g * n, lcm = r.chance(0.5);
          return { prompt: lcm ? `The least common multiple of ${a} and ${b}` : `The greatest common divisor of ${a} and ${b}`, answer: Q(lcm ? g * m * n : g), data: { kind: lcm ? 'lcm' : 'gcd', a, b }, tip: 'Factor both into primes: the GCD takes the lowest powers, the LCM the highest.' }; } },
      { target: 25, gen: r => { if (r.chance(0.6)){ let n; do { n = Math.pow(2, r.int(0, 4)) * Math.pow(3, r.int(0, 3)) * Math.pow(5, r.int(0, 2)) * r.pick([1, 1, 7]); } while (n < 12 || n > 400);
            let cnt = 0; for (let i = 1; i <= n; i++) if (n % i === 0) cnt++;
            return { prompt: `How many positive divisors does ${n} have?`, answer: Q(cnt), data: { kind: 'ndiv', n }, tip: 'Write n = 2^{a} × 3^{b} × 5^{c}…; it has (a + 1)(b + 1)(c + 1)… positive divisors.' }; }
          const P = [7, 11, 13, 17, 19, 23, 29, 31], p = r.pick(P), q = r.pick(P.filter(x => x > p).concat([37])), N = p * q;
          return { prompt: `The smallest prime factor of ${N}`, answer: Q(p), data: { kind: 'spf', n: N }, tip: 'Test primes in order (2, 3, 5, 7, 11, 13…) up to the square root.' }; } },
    ] },
  { id: 'averages', name: 'Averages and rates', topic: 'Statistics',
    text: 'Averages, sums, missing values, speed, work and weighted averages.',
    levels: [
      { target: 15, gen: r => { const k = r.int(4, 5), m = r.int(8, 25); let xs;
          do { xs = Array.from({ length: k - 1 }, () => r.int(Math.max(1, m - 10), m + 10)); xs.push(k * m - xs.reduce((s, v) => s + v, 0)); } while (xs[k - 1] < 1 || xs[k - 1] > 40);
          return { prompt: `The average of ${xs.join(', ')}`, answer: Q(m), expr: `(${xs.join('+')})/${k}`, tip: 'Sum ÷ count.' }; } },
      { target: 20, gen: r => { const k = r.int(4, 8), m = r.int(6, 30);
          if (r.chance(0.4)) return { prompt: `The average of ${k} numbers is ${m}. Their sum?`, answer: Q(k * m), expr: `${k}*${m}`, tip: 'Sum = average × count.' };
          const n = r.int(3, 5); let xs; do { xs = Array.from({ length: n - 1 }, () => r.int(Math.max(1, m - 8), m + 8)); } while (n * m - xs.reduce((s, v) => s + v, 0) < 1);
          const last = n * m - xs.reduce((s, v) => s + v, 0);
          return { prompt: `The average of ${n} numbers is ${m}. ${n - 1} of them are ${xs.join(', ')}. The last one?`, answer: Q(last), expr: `${n}*${m}-(${xs.join('+')})`, tip: 'Total = average × count; the missing value is the total minus the known values.' }; } },
      { target: 25, gen: r => { const k = r.int(0, 2);
          if (k === 0){ const t = r.pick([Q(1, 2), Q(3, 2), Q(2), Q(5, 2), Q(3), Q(3, 4), Q(5, 4)]), v = 5 * t.d * r.int(Math.ceil(4 / t.d), Math.floor(24 / t.d)), d = mul(Q(v), t);
            return { prompt: `${d.n} km in ${dec(t)} hours: the average speed in km/h?`, answer: Q(v), expr: `${d.n}/${dec(t)}`, tip: 'Speed = distance ÷ time.' }; }
          if (k === 1){ const [a, b] = r.pick([[3, 6], [4, 12], [6, 12], [2, 6], [10, 15], [12, 24], [20, 30], [6, 3], [5, 20], [2, 3]]);
            return { prompt: `A does a job alone in ${a} hours, B alone in ${b} hours. Working together, how many hours?`, answer: Q(a * b, a + b), prefer: 'decimal', expr: `1/(1/${a}+1/${b})`, tip: 'Add the rates, not the times: 1/a + 1/b jobs per hour; time = 1 ÷ that.' }; }
          let n1, n2, a1, a2; do { n1 = r.int(2, 30); n2 = r.int(2, 30); a1 = 5 * r.int(10, 18); a2 = 5 * r.int(10, 18); } while (a1 === a2 || (n1 * a1 + n2 * a2) % (n1 + n2));
          return { prompt: `${n1} students average ${a1} and ${n2} students average ${a2}. The average of all ${n1 + n2}?`, answer: Q((n1 * a1 + n2 * a2) / (n1 + n2)), expr: `(${n1}*${a1}+${n2}*${a2})/(${n1 + n2})`, tip: 'Weighted average: (n₁a₁ + n₂a₂) ÷ (n₁ + n₂), not the plain average of the two averages.' }; } },
    ] },
];
const SKILLS_BY = Object.fromEntries(SKILLS.map(s => [s.id, s]));
/* Levels whose answers can be negative, fractions or ratios get a full keyboard on phones (the number pad has no − or /).
   Chosen per level, not per question, so the keyboard never gives away the sign of the answer. */
const TEXT_KEYS = { signs: [1, 2, 3], fractions: [1, 2, 3], equations: [1, 2, 3], decimals: [2], percent: [3], ratios: [3], powers: [2, 3] };
const LEVELS = 3, SET_SIZE = 10, PASS_SHARE = 0.9;

/* A drill set: n different questions of one skill and level. */
function makeSet(skillId, level, n, rng){
  const sk = SKILLS_BY[skillId]; if (!sk) return [];
  const L = sk.levels[Math.max(1, Math.min(LEVELS, level)) - 1], r = R(rng), out = [], seen = new Set();
  n = n || SET_SIZE;
  for (let tries = 0; out.length < n && tries < n * 30; tries++){
    const it = L.gen(r); if (seen.has(it.prompt)) continue;
    seen.add(it.prompt); out.push({ ...it, skill: skillId, level, target: L.target, keys: (TEXT_KEYS[skillId] || []).includes(level) ? 'text' : 'decimal' });
  }
  return out;
}
const median = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
/* results: [{ ok, sec }]. A level is passed with 90% right and a median time within the target. */
function evaluate(skillId, level, results){
  const L = SKILLS_BY[skillId].levels[level - 1], n = results.length, correct = results.filter(x => x.ok).length, med = median(results.map(x => x.sec));
  return { n, correct, medianSec: med == null ? null : Math.round(med * 10) / 10, target: L.target, accuracyOk: n >= SET_SIZE && correct / n >= PASS_SHARE, speedOk: med != null && med <= L.target,
    passed: n >= SET_SIZE && correct / n >= PASS_SHARE && med <= L.target };
}
/* progress: { skillId: { passed: 0–3 } }. Next drill: the lowest level first, in the order of SKILLS, so every basic gets
   covered before any goes deep. */
function nextDrill(progress){
  const p = id => Math.min(LEVELS, ((progress || {})[id] || {}).passed || 0);
  const low = Math.min(...SKILLS.map(s => p(s.id)));
  if (low >= LEVELS) return null;
  const s = SKILLS.find(x => p(x.id) === low);
  return { skill: s.id, name: s.name, level: low + 1 };
}
const skills = () => SKILLS.map(s => ({ id: s.id, name: s.name, topic: s.topic, text: s.text, targets: s.levels.map(l => l.target) }));

const api = { skills, makeSet, check, show, evaluate, nextDrill, readings, dec, frac, Q, LEVELS, SET_SIZE, _test: { SKILLS, gcd } };
root.GMATDrills = api;
if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
