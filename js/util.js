// Ortak yardımcılar: tohumlu rastgelelik, Türkçe ekler, küçük DOM yardımcıları.

export function newSeed() {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0];
}

// mulberry32 — hızlı, tohumlu RNG. Aynı tohum = aynı sonuç (tekrar üretilebilirlik için),
// her "Üret" tıklaması yeni bir tohum alır = her seferinde farklı hikâye.
export function makeRng(seed) {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng = {
    next,
    float: (a = 0, b = 1) => a + next() * (b - a),
    int: (a, b) => Math.floor(a + next() * (b - a + 1)),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    chance: (p) => next() < p,
    shuffle: (arr) => {
      const r = arr.slice();
      for (let i = r.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [r[i], r[j]] = [r[j], r[i]];
      }
      return r;
    },
    weighted: (items, weightFn) => {
      const ws = items.map(weightFn);
      const total = ws.reduce((a, b) => a + b, 0);
      let x = next() * total;
      for (let i = 0; i < items.length; i++) {
        x -= ws[i];
        if (x <= 0) return items[i];
      }
      return items[items.length - 1];
    },
    // Beta(a,b) örneği — öğrenme modülündeki Thompson örneklemesi için.
    beta: (a, b) => {
      const g = (k) => {
        // Marsaglia-Tsang gamma
        if (k < 1) return g(k + 1) * Math.pow(next(), 1 / k);
        const d = k - 1 / 3, c = 1 / Math.sqrt(9 * d);
        for (;;) {
          let x, v;
          do {
            const u1 = next() || 1e-9, u2 = next();
            x = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
            v = 1 + c * x;
          } while (v <= 0);
          v = v * v * v;
          const u = next();
          if (u < 1 - 0.0331 * x ** 4) return d * v;
          if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
        }
      };
      const x = g(a), y = g(b);
      return x / (x + y);
    },
  };
  return rng;
}

// Şablon dolumu: "[a|b|c]" rastgele seçer, "{X}" / "{X:gen}" değişken + Türkçe ek.
export function fill(template, vars, rng, lang = 'tr') {
  let s = template;
  // İç içe seçenekleri içten dışa çöz
  let guard = 0;
  while (/\[[^\[\]]*\]/.test(s) && guard++ < 50) {
    s = s.replace(/\[([^\[\]]*)\]/g, (_, body) => rng.pick(body.split('|')));
  }
  s = s.replace(/\{(\w+)(?::(\w+))?\}/g, (_, key, suf) => {
    const v = vars[key];
    if (v == null) return '';
    if (!suf) return v;
    return lang === 'tr' ? trSuffix(v, suf) : enSuffix(v, suf);
  });
  return s.replace(/\s+([,.!?;:])/g, '$1').replace(/\s{2,}/g, ' ').trim();
}

const TR_VOWELS = 'aeıioöuüAEIİOÖUÜ';
const TR_HARD = 'fstkçşhpFSTKÇŞHP';
function lastVowel(w) {
  for (let i = w.length - 1; i >= 0; i--) if (TR_VOWELS.includes(w[i])) return w[i].toLocaleLowerCase('tr');
  return 'e';
}
// Özel isimler için kesme işaretli Türkçe hal ekleri (ünlü uyumu + ünsüz benzeşmesi).
export function trSuffix(word, kind) {
  const v = lastVowel(word);
  const endsVowel = TR_VOWELS.includes(word[word.length - 1]);
  const hard = TR_HARD.includes(word[word.length - 1]);
  const back = 'aıou'.includes(v);
  const four = { a: 'ı', ı: 'ı', o: 'u', u: 'u', e: 'i', i: 'i', ö: 'ü', ü: 'ü' }[v] || 'i';
  const two = back ? 'a' : 'e';
  const ap = "'";
  switch (kind) {
    case 'gen': return word + ap + (endsVowel ? 'n' : '') + four + 'n';
    case 'acc': return word + ap + (endsVowel ? 'y' : '') + four;
    case 'dat': return word + ap + (endsVowel ? 'y' : '') + two;
    case 'loc': return word + ap + (hard ? 't' : 'd') + two;
    case 'abl': return word + ap + (hard ? 't' : 'd') + two + 'n';
    case 'ins': return word + ap + (endsVowel ? 'y' : '') + 'l' + two;
    default: return word;
  }
}
function enSuffix(word, kind) {
  if (kind === 'gen') return word + (word.endsWith('s') ? "'" : "'s");
  return word;
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function toast(msg, kind = 'info', ms = 3800) {
  let box = document.getElementById('toasts');
  if (!box) {
    box = h('div', { id: 'toasts' });
    document.body.append(box);
  }
  const t = h('div', { class: 'toast ' + kind }, msg);
  box.append(t);
  setTimeout(() => t.classList.add('out'), ms);
  setTimeout(() => t.remove(), ms + 400);
}

export function hash(str) {
  let h1 = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h1 ^= str.charCodeAt(i);
    h1 = Math.imul(h1, 16777619);
  }
  return (h1 >>> 0).toString(36);
}

export function fmtTime(sec) {
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

// localStorage erişimi her zaman try/catch içinde — gizli pencerede patlamasın.
export const store = {
  get(k, d = null) {
    try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; }
  },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};

export function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

export function splitSentences(text) {
  return (text.match(/[^.!?…]+[.!?…]+["”»)]?|[^.!?…]+$/g) || [])
    .map((s) => s.trim())
    .filter(Boolean);
}
