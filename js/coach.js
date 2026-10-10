// Yaratıcı yaşam koçu + trend analizi.

import { COACH, FORMATS, TITLE_FORMULAS } from './knowledge.js';
import { makeRng, newSeed } from './util.js';
import { llmAvailable, chat } from './llm.js';

export function spark() {
  const rng = makeRng(newSeed());
  const subject = rng.pick(COACH.sparks.subjects);
  const angle = rng.pick(COACH.sparks.angles);
  const fmtKey = rng.pick(Object.keys(FORMATS).filter((k) => FORMATS[k].fiction || k === 'motivation'));
  const title = rng.pick(TITLE_FORMULAS).replace('{X}', subject).replace('{N}', String(rng.pick([30, 60, 90])));
  return { subject, angle, fmtKey, fmt: FORMATS[fmtKey].label, title, idea: `${subject}, ${angle}` };
}

export function dailyCard() {
  const rng = makeRng(newSeed());
  return { mindset: rng.pick(COACH.mindset), exercise: rng.pick(COACH.exercises), spark: spark() };
}

const history = []; // sadece bellekte

export async function coachReply(text) {
  history.push({ role: 'user', content: text });
  if (llmAvailable()) {
    try {
      const out = await chat([
        { role: 'system', content: 'Sen sıcak ama net konuşan bir yaratıcı yaşam koçusun; YouTube içerik üreticilerine tıkandıklarında yardım ediyorsun. Kısa (en fazla 6 cümle), somut, uygulanabilir öneriler ver; sonunda bugün yapılacak tek bir mikro görev öner. Kullanıcı hangi dilde yazarsa o dilde cevap ver. Tıbbi/psikolojik kriz belirtisi görürsen nazikçe profesyonel destek önermeyi unutma.' },
        ...history.slice(-8),
      ], { temperature: 0.8, maxTokens: 500 });
      history.push({ role: 'assistant', content: out });
      return out;
    } catch (e) {
      console.warn(e);
    }
  }
  const t = text.toLocaleLowerCase('tr');
  const hit = COACH.blockers.find((b) => b.keys.some((k) => t.includes(k)));
  const rng = makeRng(newSeed());
  const base = hit ? hit.reply : rng.pick(COACH.mindset);
  const ex = rng.pick(COACH.exercises);
  const out = `${base}\n\n🎯 Bugünün mikro görevi: ${ex}`;
  history.push({ role: 'assistant', content: out });
  return out;
}

// ------------------------------------------------------------------ YouTube trendleri (ücretsiz API anahtarıyla)
function isoDur(s) {
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(s || '') || [];
  return (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0);
}
const STOP = new Set('the a an and or of to in on for with is are was be this that it you your my me i we our from at by ve ile bir bu şu o da de mi mı ne için gibi çok en daha ama | - – — & official video music 2024 2025 2026 ft feat'.split(' '));

export async function fetchTrending(key, region = 'TR', categoryId = '') {
  const u = new URL('https://www.googleapis.com/youtube/v3/videos');
  u.searchParams.set('part', 'snippet,statistics,contentDetails');
  u.searchParams.set('chart', 'mostPopular');
  u.searchParams.set('regionCode', region);
  u.searchParams.set('maxResults', '50');
  if (categoryId) u.searchParams.set('videoCategoryId', categoryId);
  u.searchParams.set('key', key);
  const r = await fetch(u);
  const j = await r.json();
  if (!r.ok) throw new Error(j.error?.message || 'YouTube API hatası');
  const items = (j.items || []).map((v) => ({
    id: v.id, title: v.snippet.title, channel: v.snippet.channelTitle, cat: v.snippet.categoryId,
    views: +v.statistics.viewCount || 0, likes: +v.statistics.likeCount || 0, comments: +v.statistics.commentCount || 0,
    dur: isoDur(v.contentDetails.duration), published: v.snippet.publishedAt,
  }));
  const words = new Map();
  for (const it of items) {
    for (const w of it.title.toLocaleLowerCase('tr').split(/[^\p{L}\p{N}]+/u)) {
      if (w.length < 3 || STOP.has(w) || /^\d+$/.test(w)) continue;
      words.set(w, (words.get(w) || 0) + 1);
    }
  }
  const durs = items.map((i) => i.dur).sort((a, b) => a - b);
  return {
    items,
    topWords: [...words.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25),
    medianDur: durs[Math.floor(durs.length / 2)] || 0,
    shortsShare: items.filter((i) => i.dur <= 180).length / (items.length || 1),
    avgTitleLen: Math.round(items.reduce((a, i) => a + i.title.length, 0) / (items.length || 1)),
    engagement: items.map((i) => ({ ...i, eng: i.views ? (i.likes + i.comments * 3) / i.views : 0 })).sort((a, b) => b.eng - a.eng).slice(0, 5),
  };
}

export const YT_CATEGORIES = { '': 'Tümü', 1: 'Film & Animasyon', 10: 'Müzik', 17: 'Spor', 20: 'Oyun', 22: 'Kişiler & Bloglar', 23: 'Komedi', 24: 'Eğlence', 25: 'Haber', 26: 'Nasıl yapılır', 27: 'Eğitim', 28: 'Bilim & Teknoloji' };
export const REGIONS = ['TR', 'US', 'GB', 'DE', 'FR', 'ES', 'BR', 'MX', 'IN', 'ID', 'JP', 'KR', 'RU', 'SA', 'AZ', 'NL', 'IT', 'PL'];
