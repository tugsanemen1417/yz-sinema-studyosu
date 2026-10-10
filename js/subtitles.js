// Altyazılar: zamanlama, parçalama, SRT/VTT üretimi, videoya gömülü (burn-in) çizim ve çeviri.

import { langByCode } from './langs.js';
import { llmAvailable, chat, parseJsonLoose } from './llm.js';
import { sleep } from './util.js';

// timeline.lines: [{start, end, text, speaker, key}] → altyazı parçaları
export function buildCues(lines, textOf, { maxChars = 42 } = {}) {
  const cues = [];
  for (const ln of lines) {
    const text = (textOf(ln) || '').trim();
    if (!text) continue;
    const words = text.split(/\s+/);
    const chunks = []; let cur = [];
    for (const w of words) {
      if ((cur.join(' ') + ' ' + w).trim().length > maxChars && cur.length) { chunks.push(cur.join(' ')); cur = []; }
      cur.push(w);
      if (/[.!?…]$/.test(w) && cur.join(' ').length > maxChars * 0.5) { chunks.push(cur.join(' ')); cur = []; }
    }
    if (cur.length) chunks.push(cur.join(' '));
    const total = chunks.reduce((a, c) => a + c.length, 0) || 1;
    let t = ln.start;
    const span = ln.end - ln.start;
    for (const c of chunks) {
      const d = span * (c.length / total);
      cues.push({ start: t, end: t + d, text: c, speaker: ln.speaker });
      t += d;
    }
  }
  return cues;
}

const ts = (s, sep) => {
  const ms = Math.max(0, Math.round(s * 1000));
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), sec = Math.floor((ms % 60000) / 1000), r = ms % 1000;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}${sep}${String(r).padStart(3, '0')}`;
};
export function toSRT(cues) {
  return cues.map((c, i) => `${i + 1}\n${ts(c.start, ',')} --> ${ts(c.end, ',')}\n${c.text}\n`).join('\n');
}
export function toVTT(cues) {
  return 'WEBVTT\n\n' + cues.map((c) => `${ts(c.start, '.')} --> ${ts(c.end, '.')}\n${c.text}\n`).join('\n');
}

function wrap(ctx, text, maxW) {
  const words = text.split(' '); const lines = []; let cur = '';
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; } else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}

// Gömülü altyazı: Shorts'ta büyük, ortaya yakın, kelime vurgulu; yatayda alt orta.
export function drawCue(ctx, W, H, cue, t, { vertical, style = 'bold', speakerName } = {}) {
  if (!cue) return;
  const fs = Math.round((vertical ? W * 0.068 : H * 0.052) * (style === 'small' ? 0.75 : 1));
  ctx.save();
  ctx.font = `800 ${fs}px "Inter", "Segoe UI", system-ui, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const maxW = W * (vertical ? 0.84 : 0.8);
  const lines = wrap(ctx, cue.text, maxW);
  const lh = fs * 1.22;
  const baseY = vertical ? H * 0.7 : H * 0.86 - (lines.length - 1) * lh;
  const p = Math.min(1, Math.max(0, (t - cue.start) / Math.max(0.01, cue.end - cue.start)));
  const pop = Math.min(1, (t - cue.start) / 0.12);
  const allWords = cue.text.split(' ');
  const activeIdx = Math.min(allWords.length - 1, Math.floor(p * allWords.length));
  let wi = 0;
  lines.forEach((ln, li) => {
    const y = baseY + li * lh;
    if (style === 'box') {
      const w = ctx.measureText(ln).width + fs * 0.8;
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(W / 2 - w / 2, y - lh / 2, w, lh);
    }
    // kelime kelime çiz (vurgu için)
    const words = ln.split(' ');
    const totalW = ctx.measureText(ln).width;
    let x = W / 2 - totalW / 2;
    ctx.textAlign = 'left';
    for (const w of words) {
      const ww = ctx.measureText(w).width;
      const isActive = vertical && wi === activeIdx;
      const sc = isActive ? 1 + 0.08 * pop : 1;
      ctx.save();
      ctx.translate(x + ww / 2, y); ctx.scale(sc, sc);
      ctx.lineJoin = 'round'; ctx.lineWidth = fs * 0.16; ctx.strokeStyle = 'rgba(0,0,0,0.9)';
      ctx.strokeText(w, -ww / 2, 0);
      ctx.fillStyle = isActive ? '#ffd23f' : '#ffffff';
      ctx.fillText(w, -ww / 2, 0);
      ctx.restore();
      x += ww + ctx.measureText(' ').width;
      wi++;
    }
    ctx.textAlign = 'center';
  });
  if (speakerName && !vertical) {
    ctx.font = `600 ${Math.round(fs * 0.5)}px "Inter", system-ui, sans-serif`;
    ctx.fillStyle = 'rgba(255,210,63,0.9)';
    ctx.fillText(speakerName.toUpperCase(), W / 2, baseY - lh * 0.85);
  }
  ctx.restore();
}

// ------------------------------------------------------------------ Çeviri
const tcache = new Map();

async function mymemory(text, from, to) {
  const k = `${from}|${to}|${text}`;
  if (tcache.has(k)) return tcache.get(k);
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.slice(0, 480))}&langpair=${encodeURIComponent(langByCode(from).mm)}|${encodeURIComponent(langByCode(to).mm)}`;
  const r = await fetch(url);
  const j = await r.json();
  if (j.quotaFinished) throw new Error('Ücretsiz çeviri günlük kotası doldu. Ayarlar’dan bir dil modeli bağlayabilirsin.');
  let out = j.responseData?.translatedText || text;
  if (/MYMEMORY WARNING|QUERY LENGTH LIMIT/i.test(out)) throw new Error('Çeviri servisi sınırı: ' + out.slice(0, 80));
  out = out.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  tcache.set(k, out);
  return out;
}

async function llmTranslate(texts, from, to) {
  const raw = await chat([
    { role: 'system', content: 'You are a professional subtitle translator. Keep meaning, tone and brevity; adapt idioms naturally. Reply with JSON only.' },
    { role: 'user', content: `Translate each string from ${langByCode(from).name} to ${langByCode(to).name}. Return {"t":[...]} with the same number of items in the same order.\n${JSON.stringify(texts)}` },
  ], { temperature: 0.3, json: true });
  const j = parseJsonLoose(raw);
  if (!Array.isArray(j.t) || j.t.length !== texts.length) throw new Error('Çeviri sayısı uyuşmadı');
  return j.t.map(String);
}

// texts: string[] → çevrilmiş string[]
export async function translateAll(texts, from, to, onProgress) {
  if (from === to) return texts.slice();
  if (llmAvailable()) {
    try {
      const out = [];
      for (let i = 0; i < texts.length; i += 25) {
        out.push(...(await llmTranslate(texts.slice(i, i + 25), from, to)));
        onProgress?.(Math.min(1, (i + 25) / texts.length));
      }
      return out;
    } catch (e) {
      console.warn('LLM çevirisi başarısız, MyMemory deneniyor', e);
    }
  }
  const out = new Array(texts.length);
  let done = 0;
  const workers = Array.from({ length: 3 }, async (_, w) => {
    for (let i = w; i < texts.length; i += 3) {
      out[i] = texts[i].trim() ? await mymemory(texts[i], from, to) : texts[i];
      onProgress?.(++done / texts.length);
      await sleep(120);
    }
  });
  await Promise.all(workers);
  return out;
}
