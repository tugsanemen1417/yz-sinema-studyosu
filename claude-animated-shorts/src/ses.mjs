// Ses stüdyosu: videonun ses kanalını hazırlar.
//  1) Seslendirme: anlatıcı ve her karakter için doğal Türkçe konuşma. İnsan kayıtlarıyla eğitilmiş
//     yapay zeka ses modelleri (Piper / sherpa-onnx) kullanılır; internet gerekmez, ücretsizdir.
//     Kedi, kuş gibi karakterlerin sesi inceltilir; ayının sesi kalınlaştırılır.
//  2) Zamanlama: konuşmalar üst üste binmesin diye balon zamanlarını seslere göre ayarlar.
//  3) Müzik: kodla üretilen neşeli bir arka plan melodisi (konuşurken sesi kısılır).
//  4) Efektler: açılış "ding", sahne geçişi "vuuş", zıplama "boing".
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

export const RATE = 44100;
const TITLE_SECONDS = 2.5;
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const MODEL_DIR = path.join(ROOT, "modeller");
export const MODELS = ["fettah", "dfki"]; // erkek Türkçe sesler; diğer tınılar perde değiştirilerek elde edilir

// Karakter tipine göre ses: hangi model, perde çarpanı (1 = doğal, 1.4 = ince, 0.8 = kalın), konuşma hızı
const VOICES = {
  // fettah sesi inceltmeye en dayanıklı ses (Whisper testlerinde en anlaşılır çıkan)
  anlatici: { model: "fettah", pitch: 1.0, speed: 0.95 },
  kedi: { model: "fettah", pitch: 1.25, speed: 0.95 },
  kus: { model: "fettah", pitch: 1.35, speed: 1.0 },
  tavsan: { model: "fettah", pitch: 1.3, speed: 1.0 },
  top: { model: "fettah", pitch: 1.12, speed: 1.0 },
  // dfki sesi kalın/doğal perdede güzel
  robot: { model: "dfki", pitch: 0.95, speed: 0.95, robot: true },
  ayi: { model: "dfki", pitch: 0.85, speed: 0.9 },
};

const modelPath = (name) => path.join(MODEL_DIR, `vits-piper-tr_TR-${name}-medium`);
export function hasVoices() {
  return MODELS.every((m) => fs.existsSync(path.join(modelPath(m), `tr_TR-${m}-medium.onnx`)));
}

const engines = {};
function engine(name) {
  if (engines[name]) return engines[name];
  const sherpa = createRequire(import.meta.url)("sherpa-onnx-node");
  const d = modelPath(name);
  engines[name] = new sherpa.OfflineTts({
    model: { vits: { model: path.join(d, `tr_TR-${name}-medium.onnx`), tokens: path.join(d, "tokens.txt"), dataDir: path.join(d, "espeak-ng-data") }, numThreads: Math.min(4, os.cpus().length), provider: "cpu" },
    maxNumSentences: 1,
  });
  return engines[name];
}

// ---------- WAV okuma / yazma ----------
function readWav(file) {
  const b = fs.readFileSync(file);
  let off = 12, sr = 22050, ch = 1, data = null;
  while (off < b.length - 8) {
    const id = b.toString("ascii", off, off + 4); let size = b.readUInt32LE(off + 4);
    if (id === "fmt ") { ch = b.readUInt16LE(off + 10); sr = b.readUInt32LE(off + 12); }
    if (id === "data") { if (size === 0 || off + 8 + size > b.length) size = b.length - off - 8; data = b.subarray(off + 8, off + 8 + size); break; }
    off += 8 + size;
  }
  const n = Math.floor(data.length / 2 / ch); const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = data.readInt16LE(i * 2 * ch) / 32768;
  // 44.1 kHz'e yeniden örnekle
  const ratio = sr / RATE, m = Math.floor(n / ratio), res = new Float32Array(m);
  for (let i = 0; i < m; i++) { const x = i * ratio, j = Math.floor(x), f = x - j; res[i] = (out[j] || 0) * (1 - f) + (out[j + 1] || 0) * f; }
  return res;
}
export function writeWav(file, L, R) {
  const n = L.length, b = Buffer.alloc(44 + n * 4);
  b.write("RIFF", 0); b.writeUInt32LE(36 + n * 4, 4); b.write("WAVEfmt ", 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(2, 22);
  b.writeUInt32LE(RATE, 24); b.writeUInt32LE(RATE * 4, 28); b.writeUInt16LE(4, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i])) * 32767), 44 + i * 4);
    b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i])) * 32767), 46 + i * 4);
  }
  fs.writeFileSync(file, b);
}

// ---------- seslendirme ----------
function speak(text, voice, tmp, idx) {
  const clean = String(text).replace(/[^\p{L}\p{N}\s.,!?'’"-]/gu, " ").replace(/\.{2,}/g, ".").replace(/\s+/g, " ").trim();
  const audio = engine(voice.model).generate({ text: clean, sid: 0, speed: voice.speed });
  const raw = path.join(tmp, `ham-${idx}.wav`), out = path.join(tmp, `ses-${idx}.wav`);
  writeMonoWav(raw, audio.samples, audio.sampleRate);
  // perde değişimi (inceltme/kalınlaştırma) + 44.1 kHz'e çevirme; süre aynı kalır
  const f = voice.pitch, sr = audio.sampleRate;
  const filters = Math.abs(f - 1) < 0.01 ? `aresample=${RATE}` : `asetrate=${Math.round(sr * f)},aresample=${RATE},atempo=${(1 / f).toFixed(4)}`;
  const r = spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-i", raw, "-af", `${filters},highpass=f=70,acompressor=threshold=-18dB:ratio=3:attack=5:release=80`, "-ac", "1", out]);
  if (r.status !== 0) throw new Error("ffmpeg ses işleme hatası: " + r.stderr);
  let pcm = readWav(out);
  // baştaki/sondaki sessizliği kırp
  let a = 0, z = pcm.length - 1; while (a < z && Math.abs(pcm[a]) < 0.01) a++; while (z > a && Math.abs(pcm[z]) < 0.01) z--;
  pcm = pcm.slice(Math.max(0, a - 400), Math.min(pcm.length, z + 3000));
  if (voice.robot) for (let i = 0; i < pcm.length; i++) pcm[i] *= 0.75 + 0.25 * Math.sin((2 * Math.PI * 40 * i) / RATE);
  // ses seviyesini eşitle
  let peak = 0; for (const v of pcm) peak = Math.max(peak, Math.abs(v)); const g = peak > 0 ? 0.85 / peak : 1;
  for (let i = 0; i < pcm.length; i++) pcm[i] *= g;
  return pcm;
}

function writeMonoWav(file, samples, sr) {
  const n = samples.length, b = Buffer.alloc(44 + n * 2);
  b.write("RIFF", 0); b.writeUInt32LE(36 + n * 2, 4); b.write("WAVEfmt ", 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), 44 + i * 2);
  fs.writeFileSync(file, b);
}

/**
 * Hikayedeki her konuşmayı seslendirir ve balon zamanlarını seslerle eşleştirir.
 * Geriye zamanı ayarlanmış yeni bir hikaye ve ses parçalarının listesini döndürür.
 */
export function voiceStory(story) {
  const s = structuredClone(story);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "shorts-ses-"));
  const shapeOf = Object.fromEntries(s.karakterler.map((c, i) => [c.id, { shape: c.sekil, i }]));
  const voiceFor = (id) => {
    const info = shapeOf[id] || { shape: "top", i: 0 }; const base = VOICES[info.shape] || VOICES.top;
    // aynı tipte iki karakter varsa perdeyi biraz değiştir
    const same = s.karakterler.filter((c, j) => c.sekil === info.shape && j < info.i).length;
    return { ...base, pitch: base.pitch + same * (base.pitch >= 1 ? 0.08 : -0.08) };
  };
  const clips = []; let t0 = 0, idx = 0;
  s.sahneler.forEach((sc, si) => {
    let cursor = si === 0 ? 0.6 : 0.45;
    if (sc.anlatim && sc.anlatim.trim()) {
      const pcm = speak(sc.anlatim, VOICES.anlatici, tmp, idx++);
      clips.push({ at: t0 + cursor, pcm, gain: 0.95 }); cursor += pcm.length / RATE + 0.3;
    }
    const lines = [...(sc.konusmalar || [])].sort((a, b) => a.bas - b.bas);
    for (const k of lines) {
      const pcm = speak(k.metin, voiceFor(k.karakter), tmp, idx++); const d = pcm.length / RATE;
      let start = Math.max(k.bas, cursor); if (si === 0) start = Math.max(start, TITLE_SECONDS + 0.1);
      k.bas = +start.toFixed(2); k.bit = +(start + d + 0.2).toFixed(2);
      clips.push({ at: t0 + start, pcm, gain: 1 }); cursor = start + d + 0.25;
    }
    sc.konusmalar = lines;
    sc.sure = +Math.max(sc.sure, cursor + 0.6).toFixed(2);
    t0 += sc.sure;
  });
  fs.rmSync(tmp, { recursive: true, force: true });
  return { story: s, clips, total: t0 };
}

// ---------- müzik ----------
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
function makeMusic(total) {
  const n = Math.ceil(total * RATE), out = new Float32Array(n);
  const bpm = 100, beat = 60 / bpm, bar = beat * 4;
  const chords = [[60, 64, 67], [65, 69, 72], [57, 60, 64], [55, 59, 62]]; // Do - Fa - La minör - Sol
  const melody = [72, 74, 76, 79, 76, 74, 72, 67, 69, 72, 74, 72, 71, 67, 69, 71];
  let seed = 7; const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  const add = (startS, dur, fn) => { const a = Math.floor(startS * RATE), m = Math.min(n - a, Math.floor(dur * RATE)); for (let i = 0; i < m; i++) out[a + i] += fn(i / RATE); };
  const tri = (ph) => 2 * Math.abs(2 * (ph - Math.floor(ph + 0.5))) - 1;
  for (let b = 0; b * bar < total; b++) {
    const ch = chords[b % 4], bs = b * bar;
    // yumuşak akor
    for (const note of ch) { const f = midi(note - 12); add(bs, bar, (t) => Math.sin(2 * Math.PI * f * t) * 0.045 * Math.min(1, t / 0.3) * Math.min(1, (bar - t) / 0.3)); }
    // bas
    for (const k of [0, 2]) { const f = midi(ch[0] - 24); add(bs + k * beat, beat * 1.8, (t) => Math.sin(2 * Math.PI * f * t) * 0.16 * Math.exp(-t * 2.5)); }
    // arpej / melodi
    for (let e = 0; e < 8; e++) {
      const note = b % 2 === 0 ? ch[e % 3] + 12 : melody[(b * 4 + e) % melody.length]; const f = midi(note);
      add(bs + e * beat / 2, beat, (t) => tri(f * t) * 0.07 * Math.exp(-t * 6));
    }
    // davul: kick 1-3, el çırpma 2-4, zil arada
    for (const k of [0, 2]) add(bs + k * beat, 0.25, (t) => Math.sin(2 * Math.PI * (50 + 90 * Math.exp(-t * 30)) * t) * 0.3 * Math.exp(-t * 14));
    for (const k of [1, 3]) add(bs + k * beat, 0.15, (t) => noise() * 0.07 * Math.exp(-t * 30));
    for (let e = 0; e < 8; e++) if (e % 2) add(bs + e * beat / 2, 0.05, (t) => noise() * 0.025 * Math.exp(-t * 80));
  }
  // giriş/çıkış yumuşatma
  for (let i = 0; i < n; i++) { const t = i / RATE; out[i] *= Math.min(1, t / 1, (total - t) / 2); }
  return out;
}

// ---------- efektler ----------
function sfx(type) {
  const dur = { ding: 1.2, vuus: 0.6, boing: 0.35 }[type], n = Math.floor(dur * RATE), o = new Float32Array(n);
  let seed = 3, lp = 0; const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    if (type === "ding") o[i] = (Math.sin(2 * Math.PI * 1318 * t) + 0.5 * Math.sin(2 * Math.PI * 1976 * t)) * 0.35 * Math.exp(-t * 4);
    if (type === "vuus") { const c = 0.02 + 0.25 * Math.sin(Math.PI * t / dur); lp += c * (noise() - lp); o[i] = lp * 1.2 * Math.sin(Math.PI * t / dur); }
    if (type === "boing") o[i] = Math.sin(2 * Math.PI * (180 + 320 * t / dur + 40 * Math.sin(t * 60)) * t) * 0.25 * Math.exp(-t * 9);
  }
  return o;
}

/** Tüm sesleri karıştırıp stereo WAV dosyası yazar. */
export function buildSoundtrack(story, clips, total, outWav) {
  const n = Math.ceil(total * RATE), voice = new Float32Array(n), fx = new Float32Array(n);
  const place = (buf, pcm, at, gain) => { const a = Math.floor(at * RATE); for (let i = 0; i < pcm.length && a + i < n; i++) if (a + i >= 0) buf[a + i] += pcm[i] * gain; };
  for (const c of clips) place(voice, c.pcm, c.at, c.gain);

  place(fx, sfx("ding"), 0.05, 0.6);
  let t0 = 0;
  story.sahneler.forEach((sc, si) => {
    if (si > 0) place(fx, sfx("vuus"), t0 - 0.3, 0.5);
    for (const a of sc.oyuncular) if (a.hareket === "zipla") for (let k = 1; k <= 3; k++) { const at = (k * Math.PI) / 4; if (at < sc.sure - 0.3) place(fx, sfx("boing"), t0 + at, 0.35); }
    t0 += sc.sure;
  });

  // konuşma varken müziği kıs (ducking)
  const music = makeMusic(total); let env = 0;
  const L = new Float32Array(n), R = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const target = Math.abs(voice[i]) > 0.02 ? 1 : 0; env += (target - env) * (target > env ? 0.01 : 0.00004);
    const m = music[i] * (1 - 0.75 * env) * 0.85;
    const v = voice[i] * 0.9 + fx[i];
    L[i] = Math.tanh(v + m * 1.05); R[i] = Math.tanh(v + m * 0.95);
  }
  writeWav(outWav, L, R);
}

