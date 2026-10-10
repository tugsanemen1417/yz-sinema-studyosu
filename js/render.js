// Zaman çizelgesi, ses miksajı (seslendirme + müzik + otomatik ducking), önizleme oynatıcı ve
// video dışa aktarma. Oluşturulan video SADECE bellekte (Blob) tutulur; kullanıcı "Kaydet"e
// basmadıkça cihaza hiçbir şey yazılmaz.

import { synth, OmniError } from './voices.js';
import { renderScore } from './music.js';
import { drawScene, letterbox } from './visuals.js';
import { buildCues, drawCue } from './subtitles.js';

const OUT_SR = 48000;

export function people(project) {
  const m = new Map();
  if (project.narrator) m.set('narrator', project.narrator);
  for (const c of project.characters) m.set(c.id, c);
  return m;
}

export async function buildTimeline(project, { onStatus, voiceOn = true, engine } = {}) {
  const ppl = people(project);
  const lines = [], scenes = [];
  let t = 0.25, prevSpeaker = null, n = 0;
  const total = project.scenes.reduce((a, s) => a + s.lines.length, 0);
  for (const scene of project.scenes) {
    const sStart = t;
    if (scene.beat === 'twist') t += 0.6; // sessizlik vurgusu
    for (const line of scene.lines) {
      const who = ppl.get(line.speaker) || project.narrator;
      onStatus?.(`Seslendiriliyor ${++n}/${total}: ${who?.name || ''}`, n / total);
      let buf = null;
      if (voiceOn && who?.voice) {
        try {
          buf = await synth(line.text, who.voice, { lang: project.lang, engine, onProgress: (p, id) => onStatus?.(`Ses modeli indiriliyor (${id}) %${Math.round(p * 100)}`, n / total) });
        } catch (e) {
          if (e instanceof OmniError) throw e; // otomatik modda üst katman Piper ile yeniden dener
          console.warn('TTS hatası', e);
        }
      }
      const dur = buf ? buf.duration : Math.max(1.4, line.text.length / 14);
      if (prevSpeaker && prevSpeaker !== line.speaker) t += 0.12;
      lines.push({ start: t, end: t + dur, text: line.text, speaker: line.speaker, buf, sceneId: scene.id, ref: line });
      t += dur + 0.28;
      prevSpeaker = line.speaker;
    }
    const minDur = project.aspect === '9:16' ? 2 : 3;
    if (t - sStart < minDur) t = sStart + minDur;
    t += 0.15;
    scenes.push({ scene, start: sStart, end: t });
  }
  return { lines, scenes, total: t + 0.9 };
}

export async function mixAudio(project, tl, { musicOn = true, musicLevel = 0.8, onStatus } = {}) {
  const len = Math.ceil(tl.total * OUT_SR);
  const ctx = new OfflineAudioContext(2, len, OUT_SR);
  const voiceBus = ctx.createGain(); voiceBus.gain.value = 1;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.15;
  voiceBus.connect(comp).connect(ctx.destination);
  for (const ln of tl.lines) {
    if (!ln.buf) continue;
    const s = ctx.createBufferSource(); s.buffer = ln.buf; s.connect(voiceBus); s.start(ln.start);
  }
  if (musicOn) {
    onStatus?.('Film müziği besteleniyor…');
    const segs = tl.scenes.map((s) => ({ start: s.start, end: s.end, mood: s.scene.mood, beat: s.scene.beat }));
    const score = await renderScore(segs, tl.total, project.seed);
    const ms = ctx.createBufferSource(); ms.buffer = score;
    const duck = ctx.createGain(); duck.gain.setValueAtTime(musicLevel, 0);
    for (const ln of tl.lines) {
      if (!ln.buf) continue;
      duck.gain.setTargetAtTime(musicLevel * 0.3, Math.max(0, ln.start - 0.2), 0.08);
      duck.gain.setTargetAtTime(musicLevel, ln.end + 0.15, 0.3);
    }
    ms.connect(duck).connect(ctx.destination); ms.start(0);
  }
  onStatus?.('Ses miksajı yapılıyor…');
  return ctx.startRendering();
}

// ---------------------------------------------------------------------------------------------
export class Player {
  constructor(canvas) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d');
    this.actx = null; this.src = null; this.playing = false; this.offset = 0; this.raf = 0;
    this.onTime = null; this.onEnd = null;
  }
  load(project, tl, mix, opts) {
    this.stop();
    this.project = project; this.tl = tl; this.mix = mix; this.opts = opts;
    const vertical = project.aspect === '9:16';
    const hd = opts.hd;
    this.canvas.width = vertical ? (hd ? 1080 : 720) : (hd ? 1920 : 1280);
    this.canvas.height = vertical ? (hd ? 1920 : 1280) : (hd ? 1080 : 720);
    this.ppl = people(project);
    this.charIndex = new Map(project.characters.map((c, i) => [c.id, i]));
    this.cues = buildCues(tl.lines, (ln) => opts.subText(ln), { maxChars: vertical ? 22 : 42 });
    this.offset = 0;
    this._curScene = null;
    this.draw(0);
  }
  get duration() { return this.tl?.total || 0; }
  now() { return this.playing ? this.actx.currentTime - this.startAt : this.offset; }
  async play() {
    if (!this.tl || this.playing) return;
    this.actx ??= new AudioContext();
    await this.actx.resume();
    if (this.offset >= this.duration - 0.05) this.offset = 0;
    this._startSource(this.actx.destination);
    this.playing = true;
    this._loop();
  }
  _startSource(dest) {
    if (this.mix) {
      this.src = this.actx.createBufferSource(); this.src.buffer = this.mix; this.src.connect(dest);
      this.src.start(0, this.offset);
    }
    this.startAt = this.actx.currentTime - this.offset;
  }
  pause() {
    if (!this.playing) return;
    this.offset = this.now(); this.playing = false;
    try { this.src?.stop(); } catch {}
    cancelAnimationFrame(this.raf);
    if (this._curScene?.media?.type === 'video') this._curScene.media.el.pause();
  }
  stop() { this.pause(); this.offset = 0; }
  seek(t) { const was = this.playing; this.pause(); this.offset = Math.max(0, Math.min(this.duration, t)); this.draw(this.offset); if (was) this.play(); }
  _loop() {
    const t = this.now();
    this.draw(t);
    this.onTime?.(t);
    if (t >= this.duration) { this.playing = false; this.offset = this.duration; try { this.src?.stop(); } catch {} this.onEnd?.(); return; }
    this.raf = requestAnimationFrame(() => this._loop());
  }

  draw(t) {
    const { ctx, canvas } = this; const W = canvas.width, H = canvas.height;
    if (!this.tl) return;
    const vertical = this.project.aspect === '9:16';
    const segs = this.tl.scenes;
    let si = segs.findIndex((s) => t >= s.start && t < s.end);
    if (si < 0) si = t < 0.1 ? 0 : segs.length - 1;
    const seg = segs[si];
    const local = Math.max(0, t - seg.start), dur = seg.end - seg.start;
    this._syncClip(seg.scene, dur);
    const line = this.tl.lines.find((l) => l.sceneId === seg.scene.id && t >= l.start - 0.1 && t <= l.end + 0.25);
    const speaker = line ? this.ppl.get(line.speaker) : null;
    let speakerAlpha = 0;
    if (line) speakerAlpha = Math.min(1, (t - line.start + 0.1) / 0.3, (line.end + 0.25 - t) / 0.3);
    ctx.save();
    drawScene(ctx, W, H, seg.scene, local, dur, { speaker, speakerIndex: speaker ? this.charIndex.get(speaker.id) || 0 : 0, speakerAlpha: Math.max(0, speakerAlpha) });
    ctx.restore();
    // geçişler: sahne başı/sonu siyaha kısa dip
    const fadeIn = vertical ? 0.12 : 0.35, fadeOut = vertical ? 0.08 : 0.3;
    let dip = 0;
    if (local < fadeIn) dip = 1 - local / fadeIn;
    if (dur - local < fadeOut) dip = Math.max(dip, 1 - (dur - local) / fadeOut);
    if (si === 0 && local < fadeIn) dip = 0; // kanca bekletmeden başlasın
    if (t > this.duration - 0.9) dip = Math.max(dip, (t - (this.duration - 0.9)) / 0.9);
    if (dip > 0) { ctx.fillStyle = `rgba(0,0,0,${Math.min(1, dip)})`; ctx.fillRect(0, 0, W, H); }
    if (!vertical && this.opts.cinema) letterbox(ctx, W, H);
    // kapak metni ilk 1.6 sn
    if (this.opts.showTitle && t < 1.8 && this.project.thumbnailText) {
      const a = Math.min(1, (1.8 - t) / 0.4);
      ctx.save(); ctx.globalAlpha = a;
      const fs = Math.round((vertical ? W * 0.085 : H * 0.075));
      ctx.font = `900 ${fs}px "Inter", system-ui, sans-serif`; ctx.textAlign = 'center';
      ctx.lineWidth = fs * 0.14; ctx.strokeStyle = '#000'; ctx.lineJoin = 'round';
      const y = vertical ? H * 0.18 : H * 0.2;
      ctx.strokeText(this.project.thumbnailText, W / 2, y);
      ctx.fillStyle = '#ffd23f'; ctx.fillText(this.project.thumbnailText, W / 2, y);
      ctx.restore();
    }
    if (this.opts.subsOn) {
      const cue = this.cues.find((c) => t >= c.start && t < c.end + 0.05);
      const nm = cue && cue.speaker !== 'narrator' ? this.ppl.get(cue.speaker)?.name : null;
      drawCue(ctx, W, H, cue, t, { vertical, style: this.opts.subStyle, speakerName: nm });
    }
    if (vertical && this.opts.progressBar) {
      ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(0, H - 6, W, 6);
      ctx.fillStyle = '#ffd23f'; ctx.fillRect(0, H - 6, W * (t / this.duration), 6);
    }
  }

  // Sahne video klipleri (kullanıcı videosu ya da YZ klibi): sahne başında baştan başlar,
  // kısa klip sahneye yayılsın diye yavaşlatılır (en fazla 2x ağır çekim), oynatıcıyla birlikte durur.
  _syncClip(scene, dur) {
    if (this._curScene !== scene) {
      const prev = this._curScene?.media;
      if (prev?.type === 'video') prev.el.pause();
      this._curScene = scene;
      const m = scene.media;
      if (m?.type === 'video') {
        try { m.el.currentTime = 0; } catch {}
        const d = m.el.duration || 3;
        m.el.playbackRate = Math.max(0.5, Math.min(1, d / dur));
      }
    }
    const m = scene.media;
    if (m?.type === 'video') {
      if (this.playing && m.el.paused) m.el.play().catch(() => {});
      else if (!this.playing && !m.el.paused) m.el.pause();
    }
  }

  // Gerçek zamanlı kayıt: tuval + miks → MediaRecorder. Sonuç bellekte bir Blob.
  async record(onProgress) {
    this.pause();
    this.actx ??= new AudioContext();
    await this.actx.resume();
    if (this.actx.state !== 'running') throw new Error('Tarayıcı sesi başlatmaya izin vermedi. Sayfada bir yere tıklayıp tekrar dene.');
    const dest = this.actx.createMediaStreamDestination();
    const vStream = this.canvas.captureStream(30);
    const stream = new MediaStream([...vStream.getVideoTracks(), ...dest.stream.getAudioTracks()]);
    const types = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1,opus', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
    const mimeType = types.find((m) => MediaRecorder.isTypeSupported(m)) || '';
    const hd = this.canvas.width >= 1080 || this.canvas.height >= 1080;
    const rec = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: hd ? 12e6 : 6e6, audioBitsPerSecond: 192000 });
    const chunks = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    const done = new Promise((res) => (rec.onstop = res));
    this.offset = 0;
    this._curScene = null;
    this.playing = true; // klipler ilk karede oynamaya başlasın
    this.draw(0);
    rec.start(500);
    this._startSource(dest);
    this.recording = true;
    // Kare saati bir Worker'dan gelir: sekme arka plana düşse bile tarayıcı zamanlayıcıları
    // kısmaz, video akıcı kalır.
    const worker = new Worker(URL.createObjectURL(new Blob(['setInterval(()=>postMessage(0),1000/30)'], { type: 'text/javascript' })));
    await new Promise((res) => {
      worker.onmessage = () => {
        const t = this.now();
        this.draw(t);
        onProgress?.(t / this.duration);
        if (t >= this.duration || !this.recording) res();
      };
    });
    worker.terminate();
    this.playing = false;
    try { this.src?.stop(); } catch {}
    rec.stop();
    await done;
    vStream.getTracks().forEach((t) => t.stop());
    const cancelled = !this.recording;
    this.recording = false;
    this.offset = 0; this.draw(0); this.onTime?.(0);
    if (cancelled) return null;
    const type = (mimeType || 'video/webm').split(';')[0];
    return new Blob(chunks, { type });
  }
  cancelRecord() { this.recording = false; }
}
