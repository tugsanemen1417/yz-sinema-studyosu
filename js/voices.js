// Seslendirme: karakterin dış görünüşü + iç yapısı → ses profili (model, perde, tempo, tını).
// Aynı projede iki karakter asla aynı sese sahip olmaz: aynı modeli paylaşan karakterler
// perde/tempo/tını olarak belirgin şekilde ayrıştırılır.
// Motor: Piper (tarayıcı içinde çalışan ücretsiz sinir ağı TTS). Ses modelleri ilk kullanımda indirilir
// ve tarayıcının özel deposunda (OPFS) önbelleğe alınır — videolar değil, sadece ses modelleri.

import { PIPER_GENDER, langByCode, UI_TRAITS } from './langs.js';
import { makeRng, splitSentences, store } from './util.js';
import { gradioCall, gradioFile } from './hf.js';

// ------------------------------------------------------------------ Ses motoru seçimi
// auto     : OmniVoice (k2-fsa/OmniVoice ücretsiz Hugging Face Space'i, 600+ dil, ses tasarımı + klonlama),
//            erişilemezse Piper'a (tarayıcı içi, çevrimdışı) düşer.
// omnivoice: sadece OmniVoice. piper: sadece tarayıcı içi.
export const ttsPrefs = { get engine() { return store.get('yzs.tts', 'auto'); }, set engine(v) { store.set('yzs.tts', v); } };
const OMNI = 'https://k2-fsa-omnivoice.hf.space';
export const OMNI_LANG = { tr: 'Turkish', en: 'English', es: 'Spanish', pt: 'Portuguese', de: 'German', fr: 'French', it: 'Italian', ru: 'Russian', ar: 'Standard Arabic', hi: 'Hindi', id: 'Indonesian', ja: 'Japanese', ko: 'Korean', zh: 'Chinese', nl: 'Dutch', pl: 'Polish', uk: 'Ukrainian', vi: 'Vietnamese', fa: 'Persian', az: 'Azerbaijani' };
export class OmniError extends Error {}

const PIPER_URL = 'https://cdn.jsdelivr.net/npm/@mintplex-labs/piper-tts-web@1.0.4/+esm';
export const SR = 24000; // ses işleme örnekleme hızı

let piperMod = null;
let voiceList = null;
const sessions = new Map();
let queue = Promise.resolve();
const cache = new Map(); // bellek içi sentez önbelleği

async function piper() {
  if (!piperMod) piperMod = await import(PIPER_URL);
  return piperMod;
}

export async function piperVoicesFor(langCode) {
  const lang = langByCode(langCode);
  if (!lang.piper) return [];
  const tts = await piper();
  voiceList ??= await tts.voices();
  const fam = lang.piper.split('_')[0];
  let list = voiceList.filter((v) => v.language?.code === lang.piper);
  if (!list.length) list = voiceList.filter((v) => v.language?.family === fam);
  // kaliteyi tercih et: medium > high > low > x_low, aynı konuşmacının tek sürümü
  const rank = { medium: 0, high: 1, low: 2, x_low: 3 };
  const bySpeaker = new Map();
  for (const v of list.sort((a, b) => (rank[a.quality] ?? 9) - (rank[b.quality] ?? 9))) {
    const k = v.language.code + v.name;
    if (!bySpeaker.has(k)) bySpeaker.set(k, v);
  }
  return [...bySpeaker.values()].map((v) => ({
    key: v.key, name: v.name, quality: v.quality,
    gender: PIPER_GENDER[v.key] || 'u',
    sizeMB: Math.round(Object.values(v.files || {}).reduce((a, f) => a + (f.size_bytes || 0), 0) / 1e6),
  }));
}

async function getSession(voiceId, onProgress) {
  if (sessions.has(voiceId)) return sessions.get(voiceId);
  const tts = await piper();
  // Kütüphane tekil (singleton) oturum kullanıyor; her ses için ayrı oturum açmak için sıfırlıyoruz.
  tts.TtsSession._instance = null;
  const s = await tts.TtsSession.create({
    voiceId,
    progress: (p) => onProgress?.(p.total ? p.loaded / p.total : 0, voiceId),
  });
  sessions.set(voiceId, s);
  return s;
}

export async function clearVoiceCache() {
  const tts = await piper();
  await tts.flush();
  sessions.clear();
  cache.clear();
}

// ------------------------------------------------------------------ Oyuncu seçimi (casting)
const P_MOD = {
  warm: [0, 0.98, 0.5], cold: [-0.3, 0.97, -1.5], anxious: [0.8, 1.1, 0.5], authoritative: [-1.2, 0.92, -1],
  cheerful: [1, 1.06, 2], mysterious: [-0.8, 0.9, -3], wise: [-0.6, 0.9, -0.5], aggressive: [-0.4, 1.08, 3],
  shy: [0.6, 0.95, -1.5], playful: [1.2, 1.07, 1.5], sad: [-0.5, 0.88, -2], brave: [-0.3, 1.0, 1],
};

function targetProfile(c, modelGender) {
  let pitch = 0, tempo = 1, bright = 0;
  if (c.gender === 'female') pitch += modelGender === 'm' ? 5 : modelGender === 'u' ? 2 : 0.5;
  else if (c.gender === 'male') pitch += modelGender === 'f' ? -4.5 : -0.5;
  else pitch += modelGender === 'm' ? 2.5 : modelGender === 'f' ? -2 : 0;
  pitch += { child: 4, young: 1, adult: 0, elder: -1.5 }[c.age] ?? 0;
  tempo *= { child: 1.05, young: 1.03, adult: 1, elder: 0.9 }[c.age] ?? 1;
  pitch += { slim: 0.7, average: 0, heavy: -1.5 }[c.build] ?? 0;
  bright += { slim: 1.5, average: 0, heavy: -2 }[c.build] ?? 0;
  for (const p of c.personality || []) {
    const m = P_MOD[p]; if (!m) continue;
    pitch += m[0]; tempo *= m[1]; bright += m[2];
  }
  return { pitch: clamp(pitch, -6, 8), tempo: clamp(tempo, 0.78, 1.22), bright: clamp(bright, -6, 6) };
}
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

function tooSimilar(a, b) {
  if (a.model !== b.model) return false;
  const dp = Math.abs(a.pitch - b.pitch), dt = Math.abs(a.tempo - b.tempo), db = Math.abs(a.bright - b.bright);
  return !(dp >= 2 || (dp >= 1.2 && dt >= 0.08 && db >= 3));
}

// project.narrator + project.characters için voice alanlarını doldurur. models: piperVoicesFor çıktısı.
export function castVoices(project, models) {
  const people = [project.narrator, ...project.characters].filter(Boolean);
  const rng = makeRng(project.seed ^ 0x5eed);
  const usage = new Map();
  const assigned = [];
  const gKey = (c) => (c.gender === 'female' ? 'f' : c.gender === 'male' ? 'm' : 'u');
  const shuffled = rng.shuffle(models);
  for (const c of people) {
    if (c.voiceLocked && c.voice) { assigned.push(c.voice); usage.set(c.voice.model, (usage.get(c.voice.model) || 0) + 1); continue; }
    let model = null, mg = 'u';
    if (shuffled.length) {
      const want = gKey(c);
      const scored = shuffled.map((m) => ({ m, s: (m.gender === want ? 0 : m.gender === 'u' ? 1 : 2) * 10 + (usage.get(m.key) || 0) * 6 }));
      scored.sort((a, b) => a.s - b.s);
      model = scored[0].m.key; mg = scored[0].m.gender;
    }
    const prof = { model, modelGender: mg, ...targetProfile(c, mg) };
    // benzersizlik: aynı modeli kullananlardan yeterince uzaklaştır
    let guard = 0, dir = c.gender === 'female' ? 1 : c.gender === 'male' ? -1 : (rng.chance(0.5) ? 1 : -1);
    while (assigned.some((o) => tooSimilar(o, prof)) && guard++ < 12) {
      prof.pitch = clamp(prof.pitch + dir * 1.6, -7, 9);
      prof.bright = clamp(prof.bright + dir * 1.2, -7, 7);
      if (prof.pitch >= 9 || prof.pitch <= -7) dir = -dir;
    }
    prof.unique = !assigned.some((o) => tooSimilar(o, prof));
    prof.label = describeVoice(c, prof);
    prof.uid = Math.floor(rng.next() * 1e9).toString(36);
    c.voice = prof;
    assigned.push(prof);
    usage.set(model, (usage.get(model) || 0) + 1);
  }
  castOmni(people, rng, project.lang);
  return people;
}

// OmniVoice ses tasarımı: cinsiyet + yaş + perde sınıfı + fısıltı + aksan. Her karakterin imzası farklı olmak zorunda.
const O_AGE = { child: 'Child / 儿童', young: 'Young Adult / 青年', adult: 'Middle-aged / 中年', elder: 'Elderly / 老年' };
const O_PITCH = ['Very Low Pitch / 极低音调', 'Low Pitch / 低音调', 'Moderate Pitch / 中音调', 'High Pitch / 高音调', 'Very High Pitch / 极高音调'];
const O_PITCH_TR = ['çok kalın', 'kalın', 'orta', 'ince', 'çok ince'];
const O_ACCENTS = ['American Accent / 美式口音', 'British Accent / 英国口音', 'Australian Accent / 澳大利亚口音', 'Canadian Accent / 加拿大口音', 'Indian Accent / 印度口音'];
function castOmni(people, rng, lang) {
  const used = new Set();
  let accentI = Math.floor(rng.next() * O_ACCENTS.length);
  for (const c of people) {
    const v = c.voice; if (!v) continue;
    let s = { child: 2, young: 0.7, adult: 0, elder: -0.8 }[c.age] ?? 0;
    s += { slim: 0.5, average: 0, heavy: -1 }[c.build] ?? 0;
    for (const p of c.personality || []) s += (P_MOD[p]?.[0] || 0) * 0.8;
    let pi = s <= -1.8 ? 0 : s <= -0.6 ? 1 : s < 0.6 ? 2 : s < 1.6 ? 3 : 4;
    const pers = c.personality || [];
    const o = {
      gender: c.gender === 'female' ? 'Female / 女' : c.gender === 'male' ? 'Male / 男' : 'Auto',
      age: O_AGE[c.age] || O_AGE.adult,
      whisper: pers.includes('mysterious') && (pers.includes('shy') || pers.includes('sad')) ? 'Whisper / 耳语' : 'Auto',
      accent: lang === 'en' ? O_ACCENTS[accentI++ % O_ACCENTS.length] : 'Auto',
      speed: clamp(+v.tempo.toFixed(2), 0.85, 1.15),
    };
    const sig = () => [o.gender, o.age, pi, o.whisper, o.accent].join('|');
    let dir = c.gender === 'female' ? 1 : -1, guard = 0;
    while (used.has(sig()) && guard++ < 8) {
      if (pi + dir < 0 || pi + dir > 4) dir = -dir;
      pi += dir;
    }
    o.pitch = O_PITCH[pi];
    o.sig = sig();
    o.unique = !used.has(o.sig);
    used.add(o.sig);
    o.label = `OmniVoice · ${UI_TRAITS.gender[c.gender] || ''} · ${UI_TRAITS.age[c.age] || ''} · ${O_PITCH_TR[pi]} perde${o.whisper !== 'Auto' ? ' · fısıltı' : ''}${o.accent !== 'Auto' ? ' · ' + o.accent.split(' ')[0] : ''} · hız ${o.speed}`;
    v.omni = o;
    v.omniRef = null;
  }
}

export function usesOmni(lang, engine = ttsPrefs.engine) {
  return engine !== 'piper' && !!OMNI_LANG[lang];
}

export function describeVoice(c, v) {
  const pitchWord = v.pitch > 3 ? 'ince/tiz' : v.pitch > 0.8 ? 'hafif ince' : v.pitch < -2.5 ? 'kalın/derin' : v.pitch < -0.8 ? 'tok' : 'orta';
  const tempoWord = v.tempo > 1.06 ? 'hızlı' : v.tempo < 0.93 ? 'ağır' : 'dengeli';
  const brightWord = v.bright > 2 ? 'parlak' : v.bright < -2 ? 'boğuk/karanlık' : 'doğal';
  const model = v.model ? v.model.split('-')[1] : 'tarayıcı';
  return `${model} · ${pitchWord} · ${tempoWord} · ${brightWord} tını`;
}

export function traitSummary(c) {
  return [UI_TRAITS.gender[c.gender], UI_TRAITS.age[c.age], UI_TRAITS.build[c.build], ...(c.personality || []).map((p) => UI_TRAITS.personality[p])].filter(Boolean).join(', ');
}

// ------------------------------------------------------------------ Sentez + DSP
function cleanText(t) {
  return t.replace(/[\[\]{}<>*_#"“”«»]/g, '').replace(/\s+/g, ' ').trim();
}

// Bir satırı seslendirir → AudioBuffer (SR, mono). Uygun motor yoksa null döner.
export async function synth(text, voice, { onProgress, lang = 'tr', engine = ttsPrefs.engine } = {}) {
  text = cleanText(text);
  if (!text || !voice) return null;
  if (usesOmni(lang, engine) && voice.omni) {
    try { return await omniSynth(text, voice, lang); }
    catch (e) {
      if (engine === 'omnivoice') throw e;
      throw new OmniError(e.message); // otomatik modda çağıran taraf Piper'a geçer
    }
  }
  if (!voice.model) return null;
  const key = JSON.stringify([voice.model, voice.pitch.toFixed(2), voice.tempo.toFixed(3), voice.bright.toFixed(1), text]);
  if (cache.has(key)) return cache.get(key);
  const job = queue.then(async () => {
    const s = await getSession(voice.model, onProgress);
    const parts = text.length > 220 ? splitSentences(text) : [text];
    const bufs = [];
    for (const p of parts) {
      const wav = await s.predict(p);
      bufs.push(await decode(await wav.arrayBuffer()));
    }
    const joined = concat(bufs, 0.12);
    return await shapeVoice(joined, voice);
  });
  queue = job.catch(() => {});
  const out = await job;
  cache.set(key, out);
  return out;
}

// OmniVoice: karakterin ilk repliği "ses tasarımı" ile doğar, sonraki tüm replikler o örnekten
// klonlanır → karakter video boyunca hep aynı sesle konuşur.
let omniQueue = Promise.resolve();
async function omniSynth(text, voice, lang) {
  const key = JSON.stringify(['omni', lang, voice.uid, voice.omni.sig, text]);
  if (cache.has(key)) return cache.get(key);
  const o = voice.omni, L = OMNI_LANG[lang];
  const job = omniQueue.then(async () => {
    let out = null;
    if (voice.omniRef) {
      try {
        out = await gradioCall(OMNI, '_clone_fn', [text, L, { path: voice.omniRef.path, meta: { _type: 'gradio.FileData' } }, voice.omniRef.text, '', 32, 2, true, o.speed, null, true, true]);
      } catch (e) { console.warn('Klon başarısız, ses yeniden tasarlanıyor', e); voice.omniRef = null; }
    }
    if (!out) {
      out = await gradioCall(OMNI, '_design_fn', [text, L, 32, 2, true, o.speed, null, true, true, o.gender, o.age, o.pitch, o.whisper, o.accent, 'Auto']);
      voice.omniRef = { path: out[0].path, text };
    }
    const x = await decode(await gradioFile(out[0]));
    normalize(x, 0.89);
    const buf = new AudioBuffer({ length: x.length, sampleRate: SR, numberOfChannels: 1 });
    buf.copyToChannel(x, 0);
    return buf;
  });
  omniQueue = job.catch(() => {});
  const res = await job;
  cache.set(key, res);
  return res;
}

async function decode(ab) {
  const off = new OfflineAudioContext(1, 1, SR);
  const b = await off.decodeAudioData(ab);
  return trimSilence(b.getChannelData(0));
}

function trimSilence(x, thr = 0.008) {
  let a = 0, b = x.length - 1;
  while (a < b && Math.abs(x[a]) < thr) a++;
  while (b > a && Math.abs(x[b]) < thr) b--;
  a = Math.max(0, a - Math.floor(SR * 0.03));
  b = Math.min(x.length - 1, b + Math.floor(SR * 0.08));
  return x.slice(a, b + 1);
}

function concat(arrs, gapSec) {
  const gap = Math.floor(gapSec * SR);
  const total = arrs.reduce((a, x) => a + x.length, 0) + gap * Math.max(0, arrs.length - 1);
  const out = new Float32Array(total);
  let o = 0;
  arrs.forEach((x, i) => { out.set(x, o); o += x.length + (i < arrs.length - 1 ? gap : 0); });
  return out;
}

// Perde kaydırma (yeniden örnekleme) + tını EQ + WSOLA ile tempo düzeltme.
async function shapeVoice(x, v) {
  const r = Math.pow(2, v.pitch / 12);
  const len = Math.max(1, Math.ceil(x.length / r));
  const off = new OfflineAudioContext(1, len, SR);
  const buf = off.createBuffer(1, x.length, SR);
  buf.copyToChannel(x, 0);
  const src = off.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = r;
  const hs = off.createBiquadFilter(); hs.type = 'highshelf'; hs.frequency.value = 2800; hs.gain.value = v.bright;
  const ls = off.createBiquadFilter(); ls.type = 'lowshelf'; ls.frequency.value = 220; ls.gain.value = -v.bright * 0.5 + (v.pitch < -2 ? 2 : 0);
  const hp = off.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 70;
  src.connect(hp).connect(ls).connect(hs).connect(off.destination);
  src.start();
  const rendered = (await off.startRendering()).getChannelData(0);
  const speed = v.tempo / r; // çıktı = giriş / speed
  const y = wsola(rendered, speed);
  normalize(y, 0.89);
  const out = new AudioBuffer({ length: y.length, sampleRate: SR, numberOfChannels: 1 });
  out.copyToChannel(y, 0);
  return out;
}

function normalize(y, peak) {
  let m = 0;
  for (let i = 0; i < y.length; i++) m = Math.max(m, Math.abs(y[i]));
  if (m > 0) { const g = peak / m; for (let i = 0; i < y.length; i++) y[i] *= g; }
}

// WSOLA zaman esnetme: perdeyi değiştirmeden hızı ayarlar.
export function wsola(x, speed) {
  if (Math.abs(speed - 1) < 0.01) return x.slice();
  const N = 1024, Hs = N / 2, tol = 256;
  const win = new Float32Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N);
  const outLen = Math.floor(x.length / speed);
  const y = new Float32Array(outLen + N), w = new Float32Array(outLen + N);
  let prev = 0;
  for (let outPos = 0, k = 0; outPos < outLen; outPos += Hs, k++) {
    const ideal = Math.round(outPos * speed);
    let best = Math.min(Math.max(0, ideal), Math.max(0, x.length - N - 1));
    if (k > 0) {
      const nat = prev + Hs;
      if (nat + N < x.length) {
        let bestC = -Infinity;
        for (let d = -tol; d <= tol; d += 3) {
          const p = ideal + d;
          if (p < 0 || p + N >= x.length) continue;
          let c = 0;
          for (let i = 0; i < N; i += 4) c += x[nat + i] * x[p + i];
          if (c > bestC) { bestC = c; best = p; }
        }
      }
    }
    if (best + N >= x.length) break;
    for (let i = 0; i < N; i++) { y[outPos + i] += x[best + i] * win[i]; w[outPos + i] += win[i]; }
    prev = best;
  }
  for (let i = 0; i < outLen; i++) if (w[i] > 1e-3) y[i] /= w[i];
  return y.slice(0, outLen);
}

// ------------------------------------------------------------------ Tarayıcı sesi (yedek, sadece canlı önizleme)
export function webSpeechVoices(lang) {
  const all = speechSynthesis.getVoices();
  return all.filter((v) => v.lang?.toLowerCase().startsWith(lang));
}
export function speakLive(text, voice, lang) {
  return new Promise((res) => {
    const u = new SpeechSynthesisUtterance(cleanText(text));
    u.lang = lang;
    const vs = webSpeechVoices(lang);
    if (vs.length) u.voice = vs[Math.abs(Math.round(voice?.pitch || 0)) % vs.length];
    u.pitch = clamp(1 + (voice?.pitch || 0) / 10, 0.1, 2);
    u.rate = clamp(voice?.tempo || 1, 0.5, 2);
    u.onend = u.onerror = () => res();
    speechSynthesis.speak(u);
  });
}
