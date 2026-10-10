// Telifsiz, prosedürel film müziği: sahnelerin ruh hâline göre akor, pad, bas, nabız ve
// twist öncesi yükselen gerilim (riser) + twist anında kısa sessizlik. Her tohumda farklı ton/akorlar.

import { makeRng } from './util.js';

export const MSR = 44100;
const MINOR = { mysterious: 1, tense: 1, dark: 1, melancholic: 1 };
const PROG_MINOR = [[[0, 3, 7], [8, 12, 15], [3, 7, 10], [10, 14, 17]], [[0, 3, 7], [5, 8, 12], [8, 12, 15], [7, 11, 14]], [[0, 3, 7], [10, 14, 17], [8, 12, 15], [5, 8, 12]]];
const PROG_MAJOR = [[[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]], [[0, 4, 7], [5, 9, 12], [9, 12, 16], [7, 11, 14]], [[5, 9, 12], [0, 4, 7], [7, 11, 14], [9, 12, 16]]];

function impulse(ctx, sec = 3.2) {
  const len = Math.floor(sec * ctx.sampleRate);
  const b = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
  }
  return b;
}

// segments: [{start, end, mood, beat}]
export async function renderScore(segments, total, seed, { intensity = 1 } = {}) {
  const rng = makeRng(seed ^ 0xabcdef);
  const len = Math.ceil((total + 0.5) * MSR);
  const ctx = new OfflineAudioContext(2, len, MSR);
  const master = ctx.createGain(); master.gain.value = 0.55 * intensity;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3;
  const rev = ctx.createConvolver(); rev.buffer = impulse(ctx);
  const revGain = ctx.createGain(); revGain.gain.value = 0.55;
  const dry = ctx.createGain(); dry.gain.value = 0.6;
  dry.connect(comp); rev.connect(revGain).connect(comp); comp.connect(master).connect(ctx.destination);
  const bus = ctx.createGain(); bus.connect(dry); bus.connect(rev);

  const rootMidi = rng.pick([45, 46, 47, 48, 50, 52, 53]); // A2..F3
  const f = (semi) => 440 * Math.pow(2, (rootMidi + semi - 69) / 12);
  const progMin = rng.pick(PROG_MINOR), progMaj = rng.pick(PROG_MAJOR);
  const chordLen = rng.pick([3.2, 4, 4.8]);

  // Pad + bas
  for (let t0 = 0, k = 0; t0 < total; t0 += chordLen, k++) {
    const seg = segments.find((s) => t0 >= s.start && t0 < s.end) || segments[segments.length - 1];
    const mood = seg?.mood || 'calm';
    const prog = MINOR[mood] ? progMin : progMaj;
    const chord = prog[k % prog.length];
    const t1 = Math.min(total + 0.5, t0 + chordLen + 1.2);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(mood === 'dark' ? 600 : mood === 'energetic' || mood === 'epic' ? 2200 : 1200, t0);
    lp.Q.value = 0.7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.09, t0 + 1.0);
    g.gain.setValueAtTime(0.09, t1 - 1.2);
    g.gain.linearRampToValueAtTime(0.0001, t1);
    lp.connect(g).connect(bus);
    chord.forEach((semi, i) => {
      for (const det of [-7, 6]) {
        const o = ctx.createOscillator();
        o.type = i === 0 ? 'triangle' : 'sawtooth';
        o.frequency.value = f(semi + 12);
        o.detune.value = det;
        const og = ctx.createGain(); og.gain.value = i === 0 ? 0.5 : 0.22;
        o.connect(og).connect(lp);
        o.start(t0); o.stop(t1);
      }
    });
    const b = ctx.createOscillator(); b.type = 'sine'; b.frequency.value = f(chord[0] - 12);
    const bg = ctx.createGain(); bg.gain.setValueAtTime(0.0001, t0); bg.gain.linearRampToValueAtTime(0.16, t0 + 0.6); bg.gain.linearRampToValueAtTime(0.0001, t1);
    b.connect(bg).connect(dry); b.start(t0); b.stop(t1);

    // Arpej (umutlu / enerjik / sıcak / destansı)
    if (['hopeful', 'energetic', 'warm', 'epic', 'calm'].includes(mood)) {
      const step = mood === 'energetic' ? chordLen / 16 : chordLen / 8;
      for (let s = 0; s < chordLen / step; s++) {
        const at = t0 + s * step; if (at >= total) break;
        const n = chord[(s * (rng.chance(0.5) ? 1 : 2)) % 3] + 24 + (s % 4 === 3 ? 12 : 0);
        const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f(n);
        const og = ctx.createGain(); og.gain.setValueAtTime(0.0001, at); og.gain.exponentialRampToValueAtTime(0.05, at + 0.01); og.gain.exponentialRampToValueAtTime(0.0001, at + step * 1.8);
        o.connect(og).connect(bus); o.start(at); o.stop(at + step * 2);
      }
    }
  }

  // Nabız (gergin / karanlık / gizemli)
  for (const seg of segments) {
    if (!['tense', 'dark', 'mysterious'].includes(seg.mood)) continue;
    const period = seg.mood === 'tense' ? 0.72 : seg.mood === 'dark' ? 1.1 : 1.5;
    for (let at = seg.start; at < seg.end; at += period) {
      for (const [off, amp] of [[0, 0.5], [0.16, 0.32]]) {
        const tt = at + off; if (tt >= total) continue;
        const o = ctx.createOscillator(); o.type = 'sine';
        o.frequency.setValueAtTime(90, tt); o.frequency.exponentialRampToValueAtTime(38, tt + 0.18);
        const og = ctx.createGain(); og.gain.setValueAtTime(0.0001, tt); og.gain.exponentialRampToValueAtTime(amp * 0.5, tt + 0.01); og.gain.exponentialRampToValueAtTime(0.0001, tt + 0.3);
        o.connect(og).connect(dry); o.start(tt); o.stop(tt + 0.32);
      }
      if (seg.mood === 'mysterious') break;
    }
  }

  // Twist: önce yükselen gerilim, sonra sessizlik
  const tw = segments.find((s) => s.beat === 'twist');
  if (tw && tw.start > 3) {
    const rs = tw.start - 3, re = tw.start;
    const nb = ctx.createBuffer(1, Math.ceil(3 * MSR), MSR);
    const d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const ns = ctx.createBufferSource(); ns.buffer = nb;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 4;
    bp.frequency.setValueAtTime(300, rs); bp.frequency.exponentialRampToValueAtTime(6000, re);
    const ng = ctx.createGain(); ng.gain.setValueAtTime(0.0001, rs); ng.gain.exponentialRampToValueAtTime(0.12, re - 0.05); ng.gain.linearRampToValueAtTime(0, re);
    ns.connect(bp).connect(ng).connect(bus); ns.start(rs); ns.stop(re);
    master.gain.setValueAtTime(0.55 * intensity, re - 0.02);
    master.gain.linearRampToValueAtTime(0.0001, re + 0.05);
    master.gain.setValueAtTime(0.0001, re + 0.6);
    master.gain.linearRampToValueAtTime(0.55 * intensity, re + 2.5);
  }
  // Giriş/çıkış
  master.gain.setValueAtTime(0.0001, 0);
  master.gain.linearRampToValueAtTime(0.55 * intensity, 0.8);
  master.gain.setValueAtTime(0.55 * intensity, Math.max(0.9, total - 1.5));
  master.gain.linearRampToValueAtTime(0.0001, total + 0.4);

  return ctx.startRendering();
}
