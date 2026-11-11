// ================================================================
// Math problem generation (verified answers + distractors)
// ================================================================
const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a || 1; };
function fracStr(n, d) { if (d < 0) { n = -n; d = -d; } const g = gcd(n, d); n /= g; d /= g; return d === 1 ? String(n) : n + '/' + d; }
function fracVal(s) { s = String(s); if (s.includes('…')) { const [q, r] = s.split('…'); return +q * 1000 + +r + 0.5; } if (s.includes('/')) { const [n, d] = s.split('/'); return +n / +d; } return +s; }
const decStr = (tenths, places = 1) => { const m = Math.pow(10, places); const neg = tenths < 0; let v = Math.abs(tenths); const ip = Math.floor(v / m), fp = v % m; let s = String(ip); if (fp) { s += '.' + String(fp).padStart(places, '0').replace(/0+$/, ''); } return (neg ? '-' : '') + s; };

const _bat = (v) => { let s = String(v); if (s.includes('/')) s = s.split('/')[0]; const ch = s.replace(/[^0-9]/g, '').slice(-1); return '013678'.includes(ch); };
const iy = (v) => (_bat(v) ? '이에요' : '예요');
const eul = (v) => (_bat(v) ? '을' : '를');
const LEVELS = [
  null,
  { id: 1, name: '새싹', icon: '🌱', ages: '초등 1학년', desc: '한 자리 덧셈·뺄셈, 두 자리 + 한 자리' },
  { id: 2, name: '떡잎', icon: '🌿', ages: '초등 2학년', desc: '받아올림·받아내림, 두 자리 덧셈, 구구단' },
  { id: 3, name: '탐험가', icon: '🧭', ages: '초등 3학년', desc: '곱셈과 나눗셈, 나머지, 세 자리 수 계산' },
  { id: 4, name: '모험가', icon: '⛰️', ages: '초등 4학년', desc: '큰 수 곱셈, 혼합 계산, 분수·소수 기초' },
  { id: 5, name: '도전자', icon: '⚡', ages: '초등 5학년', desc: '괄호 계산, 분모가 다른 분수, 소수의 곱셈' },
  { id: 6, name: '마스터', icon: '👑', ages: '초등 6학년', desc: '분수·소수 혼합, 비율, 응용 문제' },
];
const MAX_LEVEL = 6;
function levelForAge(age) { return clamp(age - 6, 1, 6); }
const GRADE_TYPES = { 1: ['add1', 'sub1', 'add21', 'sub21'], 2: ['add2', 'sub2', 'add22', 'mul_t'], 3: ['mul21', 'div', 'divr', 'add3'], 4: ['two', 'mix2', 'frac', 'dec'], 5: ['mix3', 'fracdiff', 'complex', 'decmul'], 6: ['fracdec', 'fracmul', 'percent', 'word'] };

// Each type: gen() -> { text, answer (string), explain }, wrong(q) -> candidate wrong strings
const QTYPES = {
  add21: { name: '두 자리 + 한 자리', gen() { let a, b; do { a = randi(10, 88); b = randi(1, 9); } while ((a % 10) + b > 9); return { text: `${a} + ${b} = ?`, ans: a + b, explain: `일의 자리끼리 ${a % 10}+${b}=${(a % 10) + b}, 십의 자리 숫자 ${Math.floor(a / 10)}, 그대로 두면 답은 ${a + b}${iy(a + b)}.` }; } },
  sub21: { name: '두 자리 − 한 자리', gen() { let a, b; do { a = randi(11, 99); } while (a % 10 === 0); b = randi(1, a % 10); return { text: `${a} − ${b} = ?`, ans: a - b, explain: `일의 자리끼리 ${a % 10}−${b}=${(a % 10) - b}, 십의 자리 숫자 ${Math.floor(a / 10)}, 그대로 두면 답은 ${a - b}${iy(a - b)}.` }; } },
  add22: { name: '두 자리 + 두 자리', gen() { const a = randi(11, 60), b = randi(11, 99 - a - 1); return { text: `${a} + ${b} = ?`, ans: a + b, explain: `십의 자리끼리 ${Math.floor(a / 10) * 10}+${Math.floor(b / 10) * 10}=${(Math.floor(a / 10) + Math.floor(b / 10)) * 10}, 일의 자리끼리 ${a % 10}+${b % 10}=${(a % 10) + (b % 10)}. 합치면 ${a + b}${iy(a + b)}.` }; } },
  add3: { name: '세 자리 수 덧셈·뺄셈', gen() { if (Math.random() < 0.5) { const a = randi(120, 600), b = randi(110, 380); return { text: `${a} + ${b} = ?`, ans: a + b, explain: `백의 자리, 십의 자리, 일의 자리끼리 차례로 더해요. 답은 ${a + b}${iy(a + b)}.` }; } const a = randi(400, 990), b = randi(110, a - 100); return { text: `${a} − ${b} = ?`, ans: a - b, explain: `일의 자리부터 차례로 빼요. 모자라면 윗자리에서 빌려와요. 답은 ${a - b}${iy(a - b)}.` }; } },
  decmul: { name: '소수 × 자연수', gen() { const a = randi(11, 95), b = randi(2, 9); return { text: `${decStr(a)} × ${b} = ?`, answer: decStr(a * b), explain: `${a}×${b}=${a * b}을 먼저 계산하고 소수점을 한 자리 찍으면 ${decStr(a * b)}${iy(decStr(a * b))}.`, t: a * b }; } },
  fracmul: { name: '분수 × 자연수', gen() { const d = pick([3, 4, 5, 6, 7, 8, 9]), a = randi(1, d - 1), n = randi(2, 6); return { text: `${a}/${d} × ${n} = ?`, answer: fracStr(a * n, d), explain: `분자에만 곱해요: ${a}×${n}=${a * n}. ${a * n}/${d}${fracStr(a * n, d) !== `${a * n}/${d}` ? ' → 약분하면 ' + fracStr(a * n, d) : ''}${iy(fracStr(a * n, d))}.`, n: a * n, d, a, b: n }; } },
  percent: { name: '비율(%)', gen() { const pct = pick([10, 20, 25, 50, 75]), base = randi(1, 10) * 20; return { text: `${base}의 ${pct}%는 얼마?`, ans: base * pct / 100, explain: `${pct}%는 ${pct}/100이에요. ${base}×${pct}÷100=${base * pct / 100}${iy(base * pct / 100)}.`, trap: base * pct / 10 }; } },
  add1: { name: '한 자리 덧셈', gen() { const a = randi(1, 9), b = randi(1, 9); return { text: `${a} + ${b} = ?`, ans: a + b, explain: `${a}에 ${b}만큼 더 세면 ${a + b}${iy(a + b)}.`, a, b }; } },
  sub1: { name: '한 자리 뺄셈', gen() { const a = randi(3, 9), b = randi(1, a); return { text: `${a} − ${b} = ?`, ans: a - b, explain: `${a}에서 ${b}만큼 거꾸로 세면 ${a - b}${iy(a - b)}.` }; } },
  add2: { name: '두 자리 덧셈(받아올림)', gen() {
      let a, b; do { a = randi(11, 79); b = randi(3, 29); } while ((a % 10) + (b % 10) < 10 || a + b > 99);
      const s = a + b; return { text: `${a} + ${b} = ?`, ans: s, explain: `일의 자리 ${a % 10}+${b % 10}=${(a % 10) + (b % 10)}이라 10을 받아올려요. 십의 자리는 ${Math.floor(a / 10)}+${Math.floor(b / 10)}+1=${Math.floor(s / 10)}, 답은 ${s}${iy(s)}.` }; } },
  sub2: { name: '두 자리 뺄셈(받아내림)', gen() {
      let a, b; do { a = randi(21, 99); b = randi(3, a - 5); } while ((a % 10) >= (b % 10) || b < 3);
      return { text: `${a} − ${b} = ?`, ans: a - b, explain: `일의 자리 ${a % 10}에서 ${b % 10}을 뺄 수 없어서 십의 자리에서 10을 빌려와요. ${10 + (a % 10)}−${b % 10}=${10 + (a % 10) - (b % 10)}, 답은 ${a - b}${iy(a - b)}.` }; } },
  mul_t: { name: '구구단', gen() { const a = randi(2, 9), b = randi(2, 9); return { text: `${a} × ${b} = ?`, ans: a * b, explain: `${a}단: ${a}${eul(a)} ${b}번 더하면 ${a * b}${iy(a * b)}.` }; } },
  mul21: { name: '두 자리 × 한 자리', gen() { const a = randi(12, 49), b = randi(2, 9); const t = Math.floor(a / 10) * 10, o = a % 10; return { text: `${a} × ${b} = ?`, ans: a * b, explain: `${t}×${b}=${t * b}, ${o}×${b}=${o * b}. 둘을 더하면 ${a * b}${iy(a * b)}.` }; } },
  div: { name: '나눗셈', gen() { const b = randi(2, 9), q = randi(2, 9); return { text: `${b * q} ÷ ${b} = ?`, ans: q, explain: `${b}×${q}=${b * q}이니까 ${b * q}÷${b}=${q}${iy(q)}.` }; } },
  divr: { name: '나머지 있는 나눗셈', gen() {
      const b = randi(3, 9), q = randi(2, 9), r = randi(1, b - 1), a = b * q + r;
      return { text: `${a} ÷ ${b} = 몫…나머지`, answer: `${q}…${r}`, explain: `${b}×${q}=${b * q}, ${a}−${b * q}=${r}. 몫은 ${q}, 나머지는 ${r}${iy(r)}.`, q, r, b }; } },
  mix2: { name: '간단한 혼합 계산', gen() {
      if (Math.random() < 0.5) { const a = randi(2, 20), b = randi(2, 9), c = randi(2, 9); return { text: `${a} + ${b} × ${c} = ?`, ans: a + b * c, explain: `곱셈 먼저! ${b}×${c}=${b * c}, 그다음 ${a}+${b * c}=${a + b * c}${iy(a + b * c)}.`, trap: (a + b) * c }; }
      const a = randi(2, 9), b = randi(2, 9), c = randi(1, a * b - 1); return { text: `${a} × ${b} − ${c} = ?`, ans: a * b - c, explain: `곱셈 먼저! ${a}×${b}=${a * b}, ${a * b}−${c}=${a * b - c}${iy(a * b - c)}.`, trap: a * (b - c) }; } },
  two: { name: '두 자리 수 계산', gen() {
      const k = randi(0, 2);
      if (k === 0) { const a = randi(25, 99), b = randi(25, 99); return { text: `${a} + ${b} = ?`, ans: a + b, explain: `십의 자리끼리 ${Math.floor(a / 10) * 10}+${Math.floor(b / 10) * 10}=${(Math.floor(a / 10) + Math.floor(b / 10)) * 10}, 일의 자리끼리 ${a % 10}+${b % 10}=${(a % 10) + (b % 10)}. 합치면 ${a + b}${iy(a + b)}.` }; }
      if (k === 1) { const a = randi(50, 99), b = randi(12, a - 10); return { text: `${a} − ${b} = ?`, ans: a - b, explain: `${a}−${Math.floor(b / 10) * 10}=${a - Math.floor(b / 10) * 10}, 다시 ${b % 10}을 빼면 ${a - b}${iy(a - b)}.` }; }
      const a = randi(11, 25), b = randi(11, 19); return { text: `${a} × ${b} = ?`, ans: a * b, explain: `${a}×${Math.floor(b / 10) * 10}=${a * Math.floor(b / 10) * 10}, ${a}×${b % 10}=${a * (b % 10)}. 더하면 ${a * b}${iy(a * b)}.` }; } },
  frac: { name: '분수 덧셈·뺄셈', gen() {
      const d = pick([4, 5, 6, 7, 8, 9, 10, 12]);
      if (Math.random() < 0.55) { const a = randi(1, d - 2), b = randi(1, d - 1 - a); return { text: `${a}/${d} + ${b}/${d} = ?`, answer: fracStr(a + b, d), explain: `분모가 같으면 분자끼리 더해요: ${a}+${b}=${a + b}. ${a + b}/${d}${fracStr(a + b, d) !== `${a + b}/${d}` ? ' → 약분하면 ' + fracStr(a + b, d) : ''}이에요.`, n: a + b, d, a, b }; }
      const a = randi(2, d - 1), b = randi(1, a - 1); return { text: `${a}/${d} − ${b}/${d} = ?`, answer: fracStr(a - b, d), explain: `분모가 같으면 분자끼리 빼요: ${a}−${b}=${a - b}. ${a - b}/${d}${fracStr(a - b, d) !== `${a - b}/${d}` ? ' → 약분하면 ' + fracStr(a - b, d) : ''}이에요.`, n: a - b, d, a, b }; } },
  dec: { name: '소수 덧셈·뺄셈', gen() {
      const a = randi(11, 89), b = randi(11, 59);
      if (Math.random() < 0.5) return { text: `${decStr(a)} + ${decStr(b)} = ?`, answer: decStr(a + b), explain: `소수점을 맞추고 더해요. ${decStr(a)}+${decStr(b)}=${decStr(a + b)}${iy(decStr(a + b))}.`, t: a + b };
      const x = Math.max(a, b), y = Math.min(a, b); return { text: `${decStr(x)} − ${decStr(y)} = ?`, answer: decStr(x - y), explain: `소수점을 맞추고 빼요. ${decStr(x)}−${decStr(y)}=${decStr(x - y)}${iy(decStr(x - y))}.`, t: x - y }; } },
  mix3: { name: '혼합 계산(괄호)', gen() {
      if (Math.random() < 0.5) { const a = randi(2, 15), b = randi(2, 15), c = randi(2, 6); return { text: `(${a} + ${b}) × ${c} = ?`, ans: (a + b) * c, explain: `괄호 먼저! ${a}+${b}=${a + b}, ${a + b}×${c}=${(a + b) * c}${iy((a + b) * c)}.`, trap: a + b * c }; }
      const c = randi(2, 9), b = randi(c + 1, 15), a = randi(2, 9); return { text: `${a} × (${b} − ${c}) = ?`, ans: a * (b - c), explain: `괄호 먼저! ${b}−${c}=${b - c}, ${a}×${b - c}=${a * (b - c)}${iy(a * (b - c))}.`, trap: a * b - c }; } },
  complex: { name: '복합 연산', gen() {
      const k = randi(0, 2);
      if (k === 0) { const a = randi(2, 9), b = randi(2, 9), c = randi(2, 9), d = randi(2, 9); return { text: `${a} × ${b} + ${c} × ${d} = ?`, ans: a * b + c * d, explain: `곱셈 두 개를 먼저: ${a * b}, ${c * d}. 더하면 ${a * b + c * d}${iy(a * b + c * d)}.`, trap: (a * b + c) * d }; }
      if (k === 1) { const a = randi(3, 12), b = randi(3, 12), c = randi(2, 5), d = randi(2, 20); return { text: `(${a} + ${b}) × ${c} − ${d} = ?`, ans: (a + b) * c - d, explain: `괄호 ${a + b}, ×${c}=${(a + b) * c}, −${d}=${(a + b) * c - d}${iy((a + b) * c - d)}.`, trap: a + b * c - d }; }
      const c = randi(2, 9), q = randi(3, 12), a = randi(10, 40); return { text: `${a} + ${c * q} ÷ ${c} = ?`, ans: a + q, explain: `나눗셈 먼저! ${c * q}÷${c}=${q}, ${a}+${q}=${a + q}${iy(a + q)}.`, trap: Math.round((a + c * q) / c) }; } },
  fracdec: { name: '분수와 소수 혼합', gen() {
      const fr = pick([[1, 2], [1, 4], [3, 4], [1, 5], [2, 5], [3, 5], [4, 5], [1, 10], [3, 10], [7, 10]]);
      const fh = fr[0] * (100 / fr[1]); // hundredths
      const dh = pick([5, 10, 15, 20, 25, 30, 40, 50, 60, 75]);
      const s = fh + dh;
      return { text: `${fr[0]}/${fr[1]} + ${decStr(dh, 2)} = ?`, answer: decStr(s, 2), explain: `${fr[0]}/${fr[1]}을 소수로 바꾸면 ${decStr(fh, 2)}. ${decStr(fh, 2)}+${decStr(dh, 2)}=${decStr(s, 2)}${iy(decStr(s, 2))}.`, h: s }; } },
  fracdiff: { name: '분모가 다른 분수', gen() {
      const pairs = [[2, 3], [2, 5], [3, 4], [3, 5], [4, 6], [2, 7], [3, 8], [4, 5], [2, 9]];
      const [d1, d2] = pick(pairs); const a = randi(1, d1 - 1), b = randi(1, d2 - 1);
      const L = d1 * d2 / gcd(d1, d2), n = a * (L / d1) + b * (L / d2);
      return { text: `${a}/${d1} + ${b}/${d2} = ?`, answer: fracStr(n, L), explain: `통분: ${a}/${d1}=${a * L / d1}/${L}, ${b}/${d2}=${b * L / d2}/${L}. 더하면 ${n}/${L}${fracStr(n, L) !== n + '/' + L ? ' = ' + fracStr(n, L) : ''}${iy(fracStr(n, L) !== n + '/' + L ? ' = ' + fracStr(n, L) : '')}.`, n, L, a, b, d1, d2 }; } },
  word: { name: '응용 문제', gen() {
      const k = randi(0, 3);
      if (k === 0) { const a = randi(4, 9), b = randi(3, 8), c = randi(2, 15); return { text: `사탕이 한 봉지에 ${a}개씩 ${b}봉지 있어요. ${c}개를 먹으면 남는 사탕은?`, ans: a * b - c, explain: `전체 ${a}×${b}=${a * b}개, ${c}개를 먹으면 ${a * b - c}개예요.`, trap: a * b + c }; }
      if (k === 1) { const p = randi(3, 9), n = randi(3, 8), g = randi(2, 4); return { text: `말랑이 ${n * g}명이 ${g}팀으로 나누어 달려요. 한 팀이 젤리를 ${p}개씩 받으면 한 팀 젤리는 모두 몇 개?`, ans: n * p, explain: `한 팀은 ${n * g}÷${g}=${n}명, ${n}×${p}=${n * p}개예요.`, trap: n * g * p }; }
      if (k === 2) { const s = randi(3, 8), t = randi(4, 12); return { text: `말랑이가 1초에 ${s}m씩 달려요. ${t}초 동안 달린 뒤 5m를 뒤로 미끄러지면 출발점에서 몇 m?`, ans: s * t - 5, explain: `${s}×${t}=${s * t}m, 5m를 빼면 ${s * t - 5}m예요.`, trap: s * t + 5 }; }
      const tot = randi(3, 9) * 4; return { text: `숫자 에너지 ${tot}개의 3/4을 모았어요. 모은 에너지는 몇 개?`, ans: tot / 4 * 3, explain: `${tot}의 1/4은 ${tot / 4}, 3/4은 ${tot / 4}×3=${tot / 4 * 3}개예요.`, trap: tot / 4 }; } },
};
const TYPES_BY_LEVEL = GRADE_TYPES;
for (const L in GRADE_TYPES) for (const id of GRADE_TYPES[L]) QTYPES[id].level = +L;

function wrongCandidates(type, q) {
  const out = [];
  const A = q.answer;
  if (q.ans !== undefined) {
    const v = q.ans; const spread = Math.max(3, Math.round(Math.abs(v) * 0.15));
    [v + 1, v - 1, v + 2, v - 2, v + 10, v - 10, v + 3, v - 3, q.trap, v + 5, v - 5, v + 11, v - 9, v + spread, v - spread].forEach((x) => { if (x !== undefined && x >= 0) out.push(String(x)); });
    for (let i = 0; i < 20; i++) { const x = v + randi(-spread * 2, spread * 2); if (x >= 0) out.push(String(x)); }
  } else if (type === 'divr') {
    const { q: Q, r: R, b: B } = q;
    [[Q, R + 1], [Q, R - 1], [Q + 1, R], [Q - 1, R], [Q + 1, R - 1], [Q - 1, R + 1], [Q, 0], [Q + 1, 0], [Q - 1, R + B - 1], [Q + 2, R], [Q, R + 2]].forEach(([a, b]) => { if (a >= 0 && b >= 0 && b < B) out.push(`${a}…${b}`); });
    for (let i = 0; i < 20; i++) { const a = Q + randi(-2, 2), b = randi(0, B - 1); if (a >= 0) out.push(`${a}…${b}`); }
  } else if (type === 'frac' || type === 'fracmul') {
    const { n, d, a, b } = q;
    [[n + 1, d], [n - 1, d], [n, d * 2], [n + 2, d], [n - 2, d], [a + b, d + d], [Math.abs(a - b), d], [n, d + 1], [n, d - 1], [d - n, d]].forEach(([x, y]) => { if (x > 0 && y > 0) out.push(fracStr(x, y)); });
    for (let i = 0; i < 20; i++) out.push(fracStr(randi(1, d), d));
  } else if (q.t !== undefined) {
    const t = q.t; [t + 1, t - 1, t + 10, t - 10, t + 2, t - 2, t + 11, t - 9, t * 10, t + 5].forEach((x) => { if (x > 0) out.push(decStr(x)); });
    for (let i = 0; i < 20; i++) { const x = t + randi(-15, 15); if (x > 0) out.push(decStr(x)); }
  } else if (type === 'fracdec') {
    const h = q.h; [h + 5, h - 5, h + 10, h - 10, h + 25, h - 25, h + 1, h + 50, h - 15, h + 15].forEach((x) => { if (x > 0) out.push(decStr(x, 2)); });
    for (let i = 0; i < 20; i++) { const x = h + randi(-6, 6) * 5; if (x > 0) out.push(decStr(x, 2)); }
  } else if (type === 'fracdiff') {
    const { n, L, a, b, d1, d2 } = q;
    [[a + b, d1 + d2], [n + 1, L], [n - 1, L], [a + b, L], [n, L * 2], [n + 2, L], [a * b, d1 * d2], [n - 2, L]].forEach(([x, y]) => { if (x > 0 && y > 0) out.push(fracStr(x, y)); });
    for (let i = 0; i < 20; i++) out.push(fracStr(randi(1, L * 2), L));
  }
  return out;
}

function makeQuestion(level, typeId) {
  const types = TYPES_BY_LEVEL[level] || TYPES_BY_LEVEL[1];
  const type = typeId || pick(types);
  const q = QTYPES[type].gen();
  if (q.answer === undefined) q.answer = String(q.ans);
  q.type = type; q.level = QTYPES[type].level;
  const ansVal = fracVal(q.answer);
  const seen = new Set([q.answer]);
  const wrongs = [];
  for (const c of shuffle(wrongCandidates(type, q))) {
    if (seen.has(c)) continue;
    if (Math.abs(fracVal(c) - ansVal) < 1e-9) continue; // numerically equal (e.g. 2/4 vs 1/2) -> never a "wrong" door
    seen.add(c); wrongs.push(c);
  }
  // fallback filler (guarantees 8 distinct wrong values)
  for (let k = 1; wrongs.length < 8 && k < 200; k++) {
    let c;
    if (q.ans !== undefined) c = String(q.ans + k + 3);
    else if (type === 'divr') c = `${q.q + k}…${k % q.b}`;
    else if (q.t !== undefined) c = decStr(q.t + k * 3);
    else if (type === 'fracdec') c = decStr(q.h + k * 7, 2);
    else c = fracStr(k + 1, (q.d || q.L || 7) + k);
    if (seen.has(c) || Math.abs(fracVal(c) - ansVal) < 1e-9) continue; seen.add(c); wrongs.push(c);
  }
  q.wrongs = wrongs;
  return q;
}
// 9 doors in one row; 1~3 of them carry the correct answer
function buildDoors(q, n = 5) {
  const k = q.textAnswer ? 1 : n <= 5 ? (Math.random() < 0.7 ? 1 : 2) : randi(1, 3);
  const slots = shuffle([...Array(n).keys()]).slice(0, k);
  const wr = q.wrongs.slice(0, n - k);
  let wi = 0; const doors = [];
  for (let i = 0; i < n; i++) doors.push(slots.includes(i) ? q.answer : wr[wi++]);
  return { values: doors, correctCount: k };
}
function isCorrect(q, value) { if (q.textAnswer) return value === q.answer; return Math.abs(fracVal(value) - fracVal(q.answer)) < 1e-9; }
// 4-choice version for exams / practice
function choices4(q) { const arr = shuffle([q.answer, ...q.wrongs.slice(0, 3)]); return arr; }

// stats helpers
function recordAnswer(q, chosen, correct, context) {
  const st = Save.data.stats; const t = (st.byType[q.type] = st.byType[q.type] || { a: 0, c: 0 });
  t.a++; st.total.a++; if (correct) { t.c++; st.total.c++; }
  if (!correct) {
    const now = new Date();
    const prev = Save.data.wrongNotes.find((w) => w.text === q.text && !w.resolved);
    if (prev) { prev.count = (prev.count || 1) + 1; prev.chosen = chosen; prev.date = now.toISOString(); }
    else Save.data.wrongNotes.unshift({ id: Date.now() + '' + randi(0, 999), text: q.text, chosen, answer: q.answer, explain: q.explain, type: q.type, level: q.level, date: now.toISOString(), count: 1, resolved: false, context, opts: q.textAnswer ? q.wrongs.slice(0, 4) : undefined });
    if (Save.data.wrongNotes.length > 300) Save.data.wrongNotes.length = 300;
  }
}
function typeAccuracy(type) { const t = Save.data.stats.byType[type]; return t && t.a ? t.c / t.a : null; }
function promotionStatus() {
  const L = Save.data.profile.level; const types = TYPES_BY_LEVEL[L]; let a = 0, c = 0;
  const per = types.map((id) => { const t = Save.data.stats.byType[id] || { a: 0, c: 0 }; a += t.a; c += t.c; return { id, name: QTYPES[id].name, a: t.a, c: t.c, acc: t.a ? t.c / t.a : 0, ok: t.a >= 3 && t.c / t.a >= 0.7 }; });
  const acc = a ? c / a : 0;
  const conds = [
    { label: `이 레벨 문제 30개 이상 풀기 (${a}/30)`, ok: a >= 30 },
    { label: `정답률 85% 이상 (${Math.round(acc * 100)}%)`, ok: acc >= 0.85 },
    { label: `모든 유형 3문제 이상 + 정답률 70% 이상`, ok: per.every((p) => p.ok) },
  ];
  return { level: L, per, conds, ready: L < MAX_LEVEL && conds.every((x) => x.ok), max: L >= MAX_LEVEL };
}
