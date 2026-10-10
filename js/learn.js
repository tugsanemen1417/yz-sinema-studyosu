// "Kendini geliştiren" katman: her projenin bir "stil genomu" vardır (zaman yapısı, kanca, twist, son, ton).
// Kullanıcı 👍/👎 verdiğinde veya gerçek YouTube sonuçlarını (izlenme oranı) girdiğinde bu genlerin
// Beta dağılımları güncellenir; sonraki üretimlerde Thompson örneklemesiyle seçim yapılır.
// Bu sayede beğenilen stiller daha sık, ama asla her seferinde aynısı seçilmez (çeşitlilik korunur).
// Saklanan tek şey küçük sayaç tablosudur; video ya da metin saklanmaz. Ayarlardan kapatılabilir/silinebilir.

import { store, hash } from './util.js';

const KEY = 'yzs.learn.v1';
const ENABLED_KEY = 'yzs.learn.enabled';

let stats = store.get(KEY, {});
// Oturum içi tekrar önleme: aynı oturumda daha önce kullanılan kombinasyonlar ve başlıklar (sadece bellekte).
const sessionSeen = new Set();
const sessionTitles = [];

export const learning = {
  get enabled() { return store.get(ENABLED_KEY, true); },
  set enabled(v) { store.set(ENABLED_KEY, !!v); },

  choose(gene, options, rng) {
    const s = (this.enabled && stats[gene]) || {};
    let best = null, bestScore = -1;
    for (const opt of options) {
      const [a, b] = s[opt] || [1, 1];
      const score = rng.beta(a, b) * (0.85 + rng.next() * 0.3); // ekstra gürültü = keşif
      if (score > bestScore) { bestScore = score; best = opt; }
    }
    return best;
  },

  // Bir genom seç, oturumda daha önce birebir aynısı çıktıysa yeniden dene.
  pickGenome(spec, rng) {
    let g;
    for (let i = 0; i < 25; i++) {
      g = {};
      for (const [gene, opts] of Object.entries(spec)) g[gene] = this.choose(gene, opts, rng);
      const sig = hash(JSON.stringify(g));
      if (!sessionSeen.has(sig)) { sessionSeen.add(sig); break; }
    }
    return g;
  },

  rememberTitle(t) {
    if (t) sessionTitles.push(t);
    if (sessionTitles.length > 30) sessionTitles.shift();
  },
  recentTitles() { return sessionTitles.slice(-12); },

  feedback(genome, reward) {
    // reward: 0..1 (👎=0, 👍=1, izlenme oranı %50 => 0.5 ...)
    if (!this.enabled || !genome) return;
    for (const [gene, val] of Object.entries(genome)) {
      stats[gene] ??= {};
      const [a, b] = stats[gene][val] || [1, 1];
      stats[gene][val] = [a + reward, b + (1 - reward)];
    }
    store.set(KEY, stats);
  },

  summary() {
    const out = [];
    for (const [gene, vals] of Object.entries(stats)) {
      const ranked = Object.entries(vals)
        .map(([k, [a, b]]) => ({ k, mean: a / (a + b), n: a + b - 2 }))
        .filter((x) => x.n > 0)
        .sort((x, y) => y.mean - x.mean);
      if (ranked.length) out.push({ gene, ranked });
    }
    return out;
  },

  reset() { stats = {}; store.del(KEY); },
};
