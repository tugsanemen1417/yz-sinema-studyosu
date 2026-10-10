import { $, $$, h, toast, newSeed, fmtTime } from './util.js';
import { LANGS, langByCode, UI_TRAITS } from './langs.js';
import { FORMATS, TOP_NICHES, RETENTION_RULES, TITLE_FORMULAS, THUMBNAIL_RULES, LENGTH_GUIDE, GLOBAL_TIPS, DIRECTOR_TECHNIQUES, EDITOR_RULES, HOOK_TYPES, TIME_STRUCTURES, TWISTS, ENDINGS, COACH } from './knowledge.js';
import { generateBuiltin, scriptFromText, SETTINGS, SETTING_LABELS, TIMES, MOODS, WEATHERS, CAMERAS } from './story.js';
import { llmConfig, saveLlmConfig, llmAvailable, generateWithLLM, chat, PRESETS } from './llm.js';
import { piperVoicesFor, castVoices, synth, clearVoiceCache, ttsPrefs, RemoteTTSError, edgeVoices, engineChain, activeVoice } from './voices.js';
import { makeClip } from './aiclip.js';
import { sceneImage, imgPrefs, STYLES, puterSignIn, puterSignedIn } from './images.js';
import { hfAuth } from './hf.js';
import { buildTimeline, mixAudio, Player } from './render.js';
import { buildCues, toSRT, translateAll } from './subtitles.js';
import { analyze } from './editor.js';
import { learning } from './learn.js';
import { dailyCard, spark, coachReply, fetchTrending, YT_CATEGORIES, REGIONS } from './coach.js';

// Tüm durum bellektedir. Sayfa kapanınca kaybolur — bilinçli olarak.
const S = {
  mode: 'idea', project: null, projects: [], tl: null, mix: null, dirty: true,
  blob: null, blobUrl: null, tr: {}, subLangs: new Set(['en', 'es', 'pt', 'hi', 'ar', 'id']), rated: null,
};
const player = new Player($('#canvas'));
window.__studio = { S, player }; // hata ayıklama için (konsoldan erişim)
let audioCtx = null;
const playBuf = async (buf) => {
  audioCtx ??= new AudioContext(); await audioCtx.resume();
  const s = audioCtx.createBufferSource(); s.buffer = buf; s.connect(audioCtx.destination); s.start();
};

// ------------------------------------------------------------------ Sekmeler
$$('.tab').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));
function showTab(name) {
  $$('.tab').forEach((x) => x.classList.toggle('active', x.dataset.tab === name));
  $$('.panel').forEach((x) => x.classList.toggle('active', x.id === 'tab-' + name));
  if (name === 'learn') renderLearn();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ------------------------------------------------------------------ Stüdyo girişleri
for (const [k, f] of Object.entries(FORMATS)) $('#format').append(h('option', { value: k }, f.label));
for (const l of LANGS) $('#lang').append(h('option', { value: l.code }, l.name));
$$('#mode button').forEach((b) => b.addEventListener('click', () => {
  S.mode = b.dataset.mode;
  $$('#mode button').forEach((x) => x.classList.toggle('on', x === b));
  $('#idea-box').hidden = S.mode !== 'idea';
  $('#text-box').hidden = S.mode !== 'text';
  $('#btn-generate').textContent = S.mode === 'idea' ? '🎬 Senaryoyu yaz' : '🎬 Metni sahnelere dönüştür';
}));
$('#btn-spark').addEventListener('click', () => {
  const s = spark();
  $('#topic').value = s.idea;
  $('#format').value = s.fmtKey;
  toast(`💡 ${s.fmt}: “${s.title}”`);
});
function engineLabel() {
  const names = { builtin: 'Yerleşik motor', webllm: 'Tarayıcı içi YZ (' + llmConfig.webllmModel.split('-').slice(0, 2).join(' ') + ')', gemini: 'Gemini', openai: 'OpenAI uyumlu (' + llmConfig.oaModel + ')' };
  $('#engine-label').textContent = 'Motor: ' + names[llmConfig.provider] + ' · Ayarlar’dan değiştir';
}
engineLabel();

$('#btn-generate').addEventListener('click', () => generate());
$('#btn-variant').addEventListener('click', () => generate());

function setStatus(sel, msg) { $(sel).textContent = msg || ''; }

async function generate() {
  const seed = newSeed();
  const lang = $('#lang').value, format = $('#format').value, aspect = $('#aspect').value, lengthMode = $('#length').value;
  const btn = $('#btn-generate'); btn.disabled = true; $('#btn-variant').disabled = true;
  try {
    let p;
    if (S.mode === 'text') {
      const text = $('#script').value.trim();
      if (!text) { toast('Önce metnini yapıştır.', 'error'); return; }
      p = scriptFromText(text, { lang, aspect, seed, format, lengthMode });
      if (!p.scenes.length) { toast('Metinden sahne çıkarılamadı.', 'error'); return; }
    } else {
      const topic = $('#topic').value.trim();
      if (llmAvailable()) {
        setStatus('#gen-status', '🎥 Yönetmen, senarist ve editör çalışıyor…');
        try {
          p = await generateWithLLM({ topic: topic || spark().idea, format, lang, lengthMode, aspect, seed, onProgress: (t) => setStatus('#gen-status', '⬇️ ' + t) });
        } catch (e) {
          console.error(e);
          toast('Dil modeli hatası: ' + e.message + ' — yerleşik motor kullanılıyor.', 'error', 6000);
        }
      }
      if (!p) {
        // Diğer diller için: konu İngilizce görünüyorsa İngilizce, aksi halde Türkçe üretip çevir.
        const looksEn = topic && !/[çğıöşüÇĞİÖŞÜ]/.test(topic) && /\b(the|a|an|of|and|in|my|your|what|if|lost|night)\b/i.test(topic);
        const baseLang = ['tr', 'en'].includes(lang) ? lang : looksEn ? 'en' : 'tr';
        p = generateBuiltin({ topic, format, lang: baseLang, lengthMode, seed, aspect, namesLang: baseLang !== lang ? 'en' : baseLang });
        if (baseLang !== lang) {
          setStatus('#gen-status', `🌍 Senaryo ${langByCode(lang).name} diline çevriliyor…`);
          await translateProject(p, lang);
        }
      }
    }
    p.createdAt = Date.now();
    S.project = p; S.dirty = true; S.tl = null; S.mix = null; S.tr = {}; S.rated = null;
    S.projects.push(p);
    discardVideo();
    $('#player').hidden = true;
    $('#btn-variant').hidden = S.mode !== 'idea';
    setStatus('#gen-status', '');
    await castProject();
    renderResult();
    $('#result').hidden = false;
    $('#result').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (e) {
    console.error(e);
    toast('Hata: ' + e.message, 'error', 6000);
    setStatus('#gen-status', '');
  } finally {
    btn.disabled = false; $('#btn-variant').disabled = false;
  }
}

async function translateProject(p, to) {
  const lines = p.scenes.flatMap((s) => s.lines);
  const texts = [p.title, p.logline, p.thumbnailText, ...lines.map((l) => l.text)];
  const out = await translateAll(texts, p.lang, to, (x) => setStatus('#gen-status', `🌍 Çeviri %${Math.round(x * 100)}`));
  [p.title, p.logline, p.thumbnailText] = out;
  p.hook = out[3];
  lines.forEach((l, i) => (l.text = out[3 + i]));
  p.narrator.name = to === 'tr' ? 'Anlatıcı' : 'Narrator';
  p.lang = to;
}

async function castProject() {
  const p = S.project;
  let models = [];
  setStatus('#voice-status', 'Ses listeleri alınıyor…');
  const [pm, ed] = await Promise.allSettled([piperVoicesFor(p.lang), engineChain(p.lang).includes('edge') ? edgeVoices() : Promise.resolve(null)]);
  if (pm.status === 'fulfilled') models = pm.value; else console.warn(pm.reason);
  if (ed.status === 'rejected') console.warn('Edge ses listesi alınamadı', ed.reason);
  p.models = models;
  castVoices(p, models, ed.status === 'fulfilled' ? ed.value : null);
  voiceStatus();
}
function voiceStatus() {
  const p = S.project; const n = langByCode(p.lang).name;
  const av = activeVoice(p.narrator?.voice, p.lang);
  const msg = {
    edge: `🔊 Edge sinir ağı sesleri: her karaktere ${n} dilinde ayrı, doğal bir ses atandı. Erişilemezse OmniVoice, sonra çevrimdışı Piper devreye girer.`,
    omnivoice: `🔊 OmniVoice: her karakter için ${n} dilinde ayrı bir ses tasarlanır ve tüm replikler o sesten klonlanır.`,
    piper: `🔊 Piper (çevrimdışı): ${n} için ${(p.models || []).length} ses modeli.`,
  }[av?.engine] || `⚠️ ${n} için kullanılabilir ses yok. Ayarlar → Ses motoru → Otomatik seç.`;
  setStatus('#voice-status', msg);
}

// ------------------------------------------------------------------ Sonuç görünümü
function renderResult() {
  const p = S.project;
  $('#p-title').value = p.title;
  $('#p-logline').textContent = p.logline || '';
  const g = $('#p-genome'); g.innerHTML = '';
  if (p.genome) {
    g.append(
      h('span', { class: 'chip', title: 'Zaman yapısı' }, '⏳ ' + TIME_STRUCTURES[p.genome.structure]),
      h('span', { class: 'chip', title: 'Kanca' }, '🪝 ' + HOOK_TYPES[p.genome.hook]),
      h('span', { class: 'chip', title: 'Twist' }, '🌀 ' + TWISTS[p.genome.twist]),
      h('span', { class: 'chip', title: 'Son' }, '🎬 ' + ENDINGS[p.genome.ending]),
    );
  }
  g.append(h('span', { class: 'chip', title: 'Bu versiyonun benzersiz tohumu' }, '🎲 #' + p.seed.toString(36)));
  $$('.rate button').forEach((b) => b.classList.remove('on'));
  renderScore();
  renderCast();
  renderScenes();
  $('#dir-notes').replaceChildren(...p.directorNotes.map((n) => h('li', {}, n)));
  $('#ed-notes').replaceChildren(...p.editorNotes.map((n) => h('li', {}, n)));
  $('#yt-thumb').value = p.thumbnailText || '';
  $('#yt-tags').value = (p.tags || []).join(', ');
  $('#yt-desc').value = p.description || defaultDescription(p);
  $('#meta-translations').innerHTML = '';
  renderSubLangs();
}

function defaultDescription(p) {
  const tags = (p.tags || []).slice(0, 4).map((t) => '#' + String(t).replace(/\s+/g, ''));
  return [p.logline || p.hook, '', tags.join(' ')].join('\n').trim();
}

function renderScore() {
  const p = S.project;
  const { score, tips } = analyze(p, S.tl?.total);
  const col = score >= 75 ? 'var(--ok)' : score >= 50 ? 'var(--warn)' : 'var(--bad)';
  $('#p-score').replaceChildren(
    h('div', { class: 'num', style: { color: col } }, String(score), h('small', {}, 'editör puanı')),
    tips.length ? h('ul', {}, tips.slice(0, 5).map((t) => h('li', {}, t))) : h('div', { class: 'hint' }, 'Editör onayı: kanca, tempo ve kapanış güçlü görünüyor. 🎯'),
  );
}

function markDirty() { S.dirty = true; $('#btn-prepare').textContent = S.tl ? '⚙️ Değişikliklerle yeniden hazırla' : '⚙️ Önizlemeyi hazırla'; }

$('#p-title').addEventListener('input', (e) => { S.project.title = e.target.value; renderScore(); });
$('#yt-thumb').addEventListener('input', (e) => { S.project.thumbnailText = e.target.value; markDirty(); });
$('#yt-tags').addEventListener('input', (e) => { S.project.tags = e.target.value.split(',').map((x) => x.trim()).filter(Boolean); });
$('#yt-desc').addEventListener('input', (e) => { S.project.description = e.target.value; });

// Puanlama → öğrenme
$('#rate-up').addEventListener('click', () => rate(1));
$('#rate-down').addEventListener('click', () => rate(0));
function rate(v) {
  const p = S.project; if (!p?.genome) { toast('Bu proje bir stil genomu içermiyor (metinden üretildi).'); return; }
  if (S.rated === p.id) { toast('Bu versiyonu zaten puanladın.'); return; }
  learning.feedback(p.genome, v);
  S.rated = p.id;
  $('#rate-up').classList.toggle('on', v === 1); $('#rate-down').classList.toggle('on', v === 0);
  toast(learning.enabled ? (v ? '👍 Öğrenildi: bu stil daha sık denenecek.' : '👎 Öğrenildi: bu stil daha az seçilecek.') : 'Öğrenme hafızası kapalı (Öğrenme sekmesi).', 'ok');
}

// ------------------------------------------------------------------ Karakterler
function allPeople() { const p = S.project; return [p.narrator, ...p.characters].filter(Boolean); }

function renderCast() {
  const box = $('#cast'); box.innerHTML = '';
  for (const c of allPeople()) {
    const sel = (key, map) => {
      const s = h('select', { 'aria-label': key }, Object.entries(map).map(([v, l]) => h('option', { value: v, selected: c[key] === v }, l)));
      s.addEventListener('change', () => { c[key] = s.value; recast(); });
      return s;
    };
    const name = h('input', { class: 'name', value: c.name, 'aria-label': 'İsim' });
    name.addEventListener('change', () => { c.name = name.value; renderScenes(); });
    const pchips = h('div', { class: 'pchips' }, Object.entries(UI_TRAITS.personality).map(([k, l]) => {
      const chip = h('span', { class: 'chip' + ((c.personality || []).includes(k) ? ' on' : '') }, l);
      chip.addEventListener('click', () => {
        c.personality = c.personality || [];
        if (c.personality.includes(k)) c.personality = c.personality.filter((x) => x !== k);
        else c.personality = [...c.personality, k].slice(-3);
        recast();
      });
      return chip;
    }));
    const v = c.voice || {};
    const lang = S.project.lang;
    const av = activeVoice(v, lang);
    const label = av?.label, unique = av?.unique;
    const test = h('button', { class: 'ghost sm', title: 'Sesi dinle' }, '▶ Dinle');
    test.addEventListener('click', async () => {
      if (!av) { toast('Bu dil için kullanılabilir ses yok.', 'error'); return; }
      test.disabled = true; test.textContent = '🎙️ …';
      const line = S.project.scenes.flatMap((s) => s.lines).find((l) => l.speaker === c.id)?.text || c.name;
      try {
        // motor zinciri: biri yanıt vermezse sıradakine geçer
        const buf = await synth(line, v, { onProgress: (p) => (test.textContent = `⬇ %${Math.round(p * 100)}`), lang });
        if (buf) await playBuf(buf);
      } catch (e) { toast('Ses hatası: ' + e.message, 'error'); }
      test.disabled = false; test.textContent = '▶ Dinle';
    });
    box.append(h('div', { class: 'person' },
      h('div', { class: 'row' }, name, h('span', { class: 'chip' }, c.id === 'narrator' ? 'anlatıcı' : ({ hero: 'kahraman', ally: 'yardımcı', other: 'karşıt', antagonist: 'karşıt' }[c.role] || 'karakter'))),
      h('div', { class: 'tri' }, sel('gender', UI_TRAITS.gender), sel('age', UI_TRAITS.age), sel('build', UI_TRAITS.build)),
      pchips,
      c.look ? h('div', { class: 'hint' }, '👤 ' + c.look) : null,
      h('div', { class: 'voice' }, '🎙️ ', h('span', {}, label || 'ses yok'),
        av ? h('span', { class: 'badge ' + (unique ? 'ok' : 'warn') }, unique ? 'benzersiz ✓' : 'benzer ⚠') : null,
        test),
    ));
  }
}
function recast() {
  for (const c of allPeople()) c.voiceLocked = false;
  castVoices(S.project, S.project.models || []);
  renderCast(); markDirty();
}
$('#btn-recast').addEventListener('click', () => {
  S.project.seed = (S.project.seed * 1664525 + 1013904223) >>> 0; // yeni dağılım
  recast(); toast('Sesler yeniden dağıtıldı — hepsi hâlâ birbirinden farklı.', 'ok');
});

// ------------------------------------------------------------------ Sahneler
function renderScenes() {
  const p = S.project; const box = $('#scenes'); box.innerHTML = '';
  const speakers = allPeople();
  p.scenes.forEach((sc, i) => {
    const sel = (key, map) => {
      const s = h('select', { title: key }, Object.entries(map).map(([v, l]) => h('option', { value: v, selected: sc[key] === v }, l)));
      s.addEventListener('change', () => { sc[key] = s.value; markDirty(); });
      return s;
    };
    const file = h('input', { type: 'file', accept: 'image/*,video/*', hidden: true });
    file.addEventListener('change', () => attachMedia(sc, file.files[0]));
    const mediaBtn = h('button', { class: 'ghost sm', title: 'Bu sahneye kendi görselini/videonu ekle (sadece bellekte)' }, sc.media ? '🖼️ Değiştir' : '🖼️ Görsel');
    mediaBtn.addEventListener('click', () => file.click());
    const rmMedia = sc.media ? h('button', { class: 'ghost sm', title: 'Görseli kaldır' }, '✖') : null;
    rmMedia?.addEventListener('click', () => { URL.revokeObjectURL(sc.media.url); sc.media = null; renderScenes(); markDirty(); });
    const aiBtn = h('button', { class: 'ghost sm', title: 'Bu sahneyi LTX-2 ile 3 sn\'lik yapay zekâ video klibine dönüştür (varsa sahne görselinden)' }, sc.media?.kind === 'aiclip' ? '🎞️ Yeniden' : '🎞️ Klip');
    aiBtn.addEventListener('click', async () => {
      aiBtn.disabled = true;
      try { await clipForScene(sc, (m) => (aiBtn.textContent = '⏳')); renderScenes(); toast('🎞️ Sahne canlandırıldı.', 'ok'); }
      catch (e) { toast('YZ klip üretilemedi: ' + e.message, 'error', 7000); aiBtn.disabled = false; aiBtn.textContent = '🎞️ Klip'; }
    });
    const imgBtn = h('button', { class: 'ghost sm', title: 'Bu sahne için yeni bir yapay zekâ görseli üret' }, sc.media?.kind === 'aiimg' || sc.media?.kind === 'stock' ? '🎨 Yenile' : '🎨 YZ görsel');
    imgBtn.addEventListener('click', async () => {
      imgBtn.disabled = true; imgBtn.textContent = '⏳';
      try { await imageForScene(sc, { variant: true }); renderScenes(); }
      catch (e) { toast('Görsel üretilemedi: ' + e.message, 'error', 8000); imgBtn.disabled = false; imgBtn.textContent = '🎨 YZ görsel'; }
    });
    const up = h('button', { class: 'ghost sm', title: 'Yukarı', disabled: i === 0 }, '↑');
    up.addEventListener('click', () => { [p.scenes[i - 1], p.scenes[i]] = [p.scenes[i], p.scenes[i - 1]]; renderScenes(); markDirty(); });
    const del = h('button', { class: 'ghost sm', title: 'Sahneyi sil' }, '🗑');
    del.addEventListener('click', () => { p.scenes.splice(i, 1); renderScenes(); markDirty(); renderScore(); });

    const body = h('div', { class: 'scene-b' });
    sc.lines.forEach((ln, li) => {
      const sp = h('select', {}, speakers.map((c) => h('option', { value: c.id, selected: ln.speaker === c.id }, c.name)));
      sp.addEventListener('change', () => { ln.speaker = sp.value; markDirty(); });
      const ta = h('textarea', { rows: 1 }, ln.text);
      ta.addEventListener('input', () => { ln.text = ta.value; markDirty(); });
      const x = h('button', { class: 'ghost', title: 'Satırı sil' }, '✖');
      x.addEventListener('click', () => { sc.lines.splice(li, 1); renderScenes(); markDirty(); });
      body.append(h('div', { class: 'line' }, sp, ta, x));
    });
    const add = h('button', { class: 'ghost sm' }, '＋ Satır');
    add.addEventListener('click', () => { sc.lines.push({ speaker: 'narrator', text: '' }); renderScenes(); markDirty(); });
    body.append(add);

    box.append(h('div', { class: 'scene' },
      h('div', { class: 'scene-h' },
        h('span', { class: 'no' }, String(i + 1)),
        h('span', { class: 'beat' }, sc.beat || ''),
        sel('setting', SETTING_LABELS), sel('time', TIMES), sel('mood', MOODS), sel('weather', WEATHERS), sel('camera', CAMERAS),
        h('span', { class: 'sp' }),
        sc.media ? h('span', { class: 'media-tag' }, '● ' + ({ aiimg: 'YZ görseli', aiclip: 'YZ klibi', stock: 'stok foto', user: 'kendi görselin' }[sc.media.kind] || 'görsel')) : null,
        imgBtn, aiBtn, mediaBtn, rmMedia, file, up, del),
      (sc.shot || sc.visual) ? h('div', { class: 'shot' }, '🎥 ' + [sc.shot, sc.visual].filter(Boolean).join(' — ')) : null,
      sc.media ? h('div', { class: 'thumb-row' }, sc.media.type === 'image' ? h('img', { src: sc.media.url, alt: '' }) : h('video', { src: sc.media.url, muted: true, playsinline: true }), sc.media.source ? h('span', { class: 'hint' }, sc.media.source) : null) : null,
      body));
  });
}
$('#btn-add-scene').addEventListener('click', () => {
  const p = S.project;
  const last = p.scenes[p.scenes.length - 1] || {};
  p.scenes.push({ id: 's' + Date.now().toString(36), beat: 'rising', setting: last.setting || 'abstract', time: last.time || 'dusk', mood: last.mood || 'mysterious', weather: 'clear', camera: 'push_in', shot: '', lines: [{ speaker: 'narrator', text: '' }], media: null });
  renderScenes(); markDirty();
});

function attachMedia(sc, f, { kind = 'user', silent = false, source = '', credit = '' } = {}) {
  if (!f) return;
  const url = URL.createObjectURL(f);
  if (sc.media) URL.revokeObjectURL(sc.media.url);
  const redraw = () => { if (!player.playing && S.tl) player.draw(player.now()); };
  if (f.type.startsWith('video/')) {
    const el = h('video', { muted: true, loop: true, playsinline: true });
    el.muted = true; el.preload = 'auto'; el.src = url;
    el.addEventListener('loadeddata', redraw, { once: true });
    sc.media = { type: 'video', el, url, kind, ai: kind.startsWith('ai'), source, credit };
  } else {
    const el = new Image(); el.onload = redraw; el.src = url;
    sc.media = { type: 'image', el, url, kind, ai: kind.startsWith('ai'), source, credit };
  }
  if (!silent) renderScenes();
  markDirty();
}

// ------------------------------------------------------------------ Sahne görselleri (FLUX / Nano Banana / stok)
const enCache = new Map();
async function englishFor(scenes) {
  const p = S.project;
  const texts = scenes.map((s) => s.lines.map((l) => l.text).join(' ').slice(0, 300));
  if (p.lang === 'en') return texts;
  const todo = texts.filter((t) => t && !enCache.has(t));
  if (todo.length) {
    try { const out = await translateAll(todo, p.lang, 'en'); todo.forEach((t, i) => enCache.set(t, out[i])); }
    catch (e) { console.warn('Görsel istemi çevirisi başarısız', e); }
  }
  return texts.map((t) => enCache.get(t) || '');
}
const STOP_EN = new Set('the a an and or of to in on for with is are was were be been this that it its you your he she his her they their them we our from at by as but not no so if then than there here what who whom which when where why how all any some one two very just only also into over under again out up down off about after before while because until'.split(' '));
// Stok arama için: hikâyeden bir isim-benzeri kelime + mekânın genel adı (ör. "lighthouse sea")
const SET_WORD = { city: 'city', forest: 'forest', ocean: 'sea', desert: 'desert', space: 'space', mountain: 'mountain', interior: 'room', village: 'village', abstract: '' };
function keywordsFrom(en, setting) {
  const words = (en || '').toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/)
    .filter((w) => w.length > 3 && !STOP_EN.has(w) && !/(ed|ing|ly|ould|ere)$/.test(w));
  const kw = words.sort((a, b) => b.length - a.length)[0] || '';
  return [kw, SET_WORD[setting] || ''].filter(Boolean).join(' ');
}
async function imageForScene(sc, { enText, variant = false, onStatus } = {}) {
  const p = S.project;
  if (enText == null) enText = (await englishFor([sc]))[0];
  if (variant) p.imgSalt = ((p.imgSalt || 0) + 7777) >>> 0; // yeni tohum = farklı görsel
  const r = await sceneImage(p, sc, { enText, keywords: keywordsFrom(enText, sc.setting), onStatus });
  attachMedia(sc, r.blob, { kind: r.source === 'Stok' ? 'stock' : 'aiimg', silent: true, source: r.source, credit: r.credit || '' });
  if (r.credit) addCredit(r.credit);
}
function addCredit(c) {
  const d = $('#yt-desc');
  if (!d.value.includes(c)) { d.value = d.value.replace(/\s*$/, '') + (d.value.includes('Görseller:') ? '\n' : '\n\nGörseller:\n') + c; S.project.description = d.value; }
}
let imgStop = false;
async function generateImages(scenes, { statusSel = '#img-status' } = {}) {
  if (imgPrefs.engine === 'procedural' || !scenes.length) return { ok: 0, fail: 0 };
  imgStop = false;
  $('#btn-images').disabled = true; $('#btn-images-stop').hidden = false;
  let ok = 0, fail = 0, lastErr = '';
  setStatus(statusSel, '🌍 Sahneler görsel istemine çevriliyor…');
  const ens = await englishFor(scenes);
  for (const [i, sc] of scenes.entries()) {
    if (imgStop) break;
    try {
      await imageForScene(sc, { enText: ens[i], onStatus: (m) => setStatus(statusSel, `🎨 Sahne ${i + 1}/${scenes.length} — ${m}`) });
      ok++; renderScenes();
    } catch (e) {
      fail++; lastErr = e.message; console.warn(e);
      if (fail >= 2 && ok === 0) break; // kaynaklar şu an kapalı; çizimle devam
    }
  }
  setStatus(statusSel, ok ? `🎨 ${ok} sahneye görsel eklendi${fail ? `, ${fail} sahne çizimle kaldı` : ''}.` : `⚠️ Görsel üretilemedi (${lastErr.slice(0, 160)}). Sahneler çizimle kalacak — Ayarlar'dan Puter'a bağlanabilir ya da Pexels anahtarı ekleyebilirsin.`);
  $('#btn-images').disabled = false; $('#btn-images-stop').hidden = true;
  return { ok, fail };
}
$('#btn-images').addEventListener('click', async () => {
  const p = S.project; if (!p) return;
  const todo = p.scenes.filter((s) => !s.media || s.media.kind === 'aiimg' || s.media.kind === 'stock');
  if (imgPrefs.engine === 'procedural') { toast('Görsel kaynağı "Çizim" seçili.'); return; }
  await generateImages(todo);
});
$('#btn-images-stop').addEventListener('click', () => { imgStop = true; });
for (const [k, s] of Object.entries(STYLES)) $('#img-style').append(h('option', { value: k }, s.label));
$('#img-style').value = imgPrefs.style;
$('#img-style').addEventListener('change', (e) => { imgPrefs.style = e.target.value; toast('Görsel stili değişti — "Tüm sahnelere görsel üret" ile yenile.'); });
$('#img-engine').value = imgPrefs.engine;
$('#img-engine').addEventListener('change', (e) => { imgPrefs.engine = e.target.value; });

// LTX-2 ile sahne klibi (sadece bellekte)
async function clipForScene(sc, onStatus) {
  const p = S.project;
  const first = sc.lines.find((l) => l.speaker !== 'narrator');
  const speaker = first ? allPeople().find((c) => c.id === first.speaker) : null;
  const blob = await makeClip(sc, { aspect: p.aspect, seed: (p.seed + p.scenes.indexOf(sc) * 7919) >>> 0, speaker, onStatus });
  attachMedia(sc, blob, { kind: 'aiclip', silent: true, source: 'LTX-2' });
}
let clipsStop = false;
$('#btn-aiclips').addEventListener('click', async () => {
  const p = S.project; if (!p) return;
  const todo = p.scenes.filter((s) => !s.media || s.media.type === 'image');
  if (!todo.length) { toast('Tüm sahnelerde zaten görsel/klip var.'); return; }
  clipsStop = false;
  $('#btn-aiclips').disabled = true; $('#btn-aiclips-stop').hidden = false;
  let ok = 0, fail = 0;
  for (const [i, sc] of todo.entries()) {
    if (clipsStop) break;
    try {
      await clipForScene(sc, (m) => setStatus('#aiclip-status', `Sahne ${i + 1}/${todo.length} — ${m}`));
      ok++; renderScenes();
    } catch (e) {
      fail++; console.warn(e);
      setStatus('#aiclip-status', `Sahne ${i + 1} başarısız: ${e.message}`);
      if (fail >= 2 && ok === 0) { toast('Ücretsiz GPU kotası dolmuş ya da servis meşgul görünüyor. Biraz sonra tekrar dene ya da Ayarlar’a HF anahtarı ekle.', 'error', 8000); break; }
    }
  }
  setStatus('#aiclip-status', `🎞️ ${ok} sahne canlandırıldı${fail ? `, ${fail} başarısız (prosedürel görselle kalır)` : ''}. Önizlemeyi yeniden hazırla.`);
  $('#btn-aiclips').disabled = false; $('#btn-aiclips-stop').hidden = true;
});
$('#btn-aiclips-stop').addEventListener('click', () => { clipsStop = true; setStatus('#aiclip-status', 'Mevcut sahne bitince duracak…'); });

// ------------------------------------------------------------------ Altyazı dilleri
function renderSubLangs() {
  const p = S.project; const box = $('#sub-langs'); box.innerHTML = '';
  for (const l of LANGS) {
    if (l.code === p.lang) continue;
    const c = h('span', { class: 'chip' + (S.subLangs.has(l.code) ? ' on' : '') }, l.name);
    c.addEventListener('click', () => {
      S.subLangs.has(l.code) ? S.subLangs.delete(l.code) : S.subLangs.add(l.code);
      c.classList.toggle('on'); renderBurnLang(); renderSrtButtons();
    });
    box.append(c);
  }
  renderBurnLang();
}
function renderBurnLang() {
  const p = S.project; const sel = $('#burn-lang'); const cur = sel.value;
  sel.innerHTML = '';
  sel.append(h('option', { value: p.lang }, langByCode(p.lang).name + ' (orijinal)'));
  for (const c of S.subLangs) if (c !== p.lang) sel.append(h('option', { value: c }, langByCode(c).name));
  sel.append(h('option', { value: 'none' }, 'Altyazı yok'));
  if ([...sel.options].some((o) => o.value === cur)) sel.value = cur;
}
$('#burn-lang').addEventListener('change', markDirty);

async function ensureTranslations(lang, statusSel) {
  const p = S.project;
  if (lang === p.lang || lang === 'none') return;
  S.tr[lang] ??= new Map();
  const m = S.tr[lang];
  const texts = [...new Set(p.scenes.flatMap((s) => s.lines.map((l) => l.text)).filter((t) => t && !m.has(t)))];
  if (!texts.length) return;
  const out = await translateAll(texts, p.lang, lang, (x) => statusSel && setStatus(statusSel, `🌍 ${langByCode(lang).name} çevirisi %${Math.round(x * 100)}`));
  texts.forEach((t, i) => m.set(t, out[i]));
}
const textFor = (lang) => (ln) => (lang === S.project.lang ? ln.text : S.tr[lang]?.get(ln.text) || ln.text);

// ------------------------------------------------------------------ Önizleme + kayıt
function videoOpts() {
  const burn = $('#burn-lang').value;
  return {
    subsOn: burn !== 'none', subText: textFor(burn === 'none' ? S.project.lang : burn),
    subStyle: $('#sub-style').value, cinema: $('#opt-cinema').checked, showTitle: $('#opt-title').checked,
    progressBar: $('#opt-progress').checked, hd: $('#quality').value === 'hd',
  };
}
['#sub-style', '#opt-cinema', '#opt-title', '#opt-progress', '#quality'].forEach((s) => $(s).addEventListener('change', () => {
  if (S.tl) { player.load(S.project, S.tl, S.mix, videoOpts()); }
}));
['#music-level', '#opt-voice'].forEach((s) => $(s).addEventListener('change', markDirty));

$('#btn-prepare').addEventListener('click', prepare);
async function prepare() {
  const p = S.project; if (!p) return;
  const btn = $('#btn-prepare'); btn.disabled = true;
  const bar = $('#prep-bar'); bar.hidden = false;
  const setBar = (x) => (bar.firstElementChild.style.width = Math.round(x * 100) + '%');
  try {
    player.pause();
    const burn = $('#burn-lang').value;
    await ensureTranslations(burn, '#prep-status');
    // 1) Görseli olmayan sahnelere yapay zekâ görseli
    const noMedia = p.scenes.filter((s) => !s.media);
    if (noMedia.length && imgPrefs.engine !== 'procedural') {
      setBar(0.02);
      await generateImages(noMedia, { statusSel: '#prep-status' });
    }
    // 2) Seslendirme: tüm video tek motorla (karakter sesi ortada değişmesin). Motor yanıt vermezse sıradakiyle baştan.
    const ENG = { edge: 'Edge sinir ağı sesleri', omnivoice: 'OmniVoice', piper: 'Piper (çevrimdışı)' };
    const chain = engineChain(p.lang).filter((e) => (e === 'edge' ? !!p.narrator?.voice?.edge : e === 'piper' ? (p.models || []).length > 0 : true));
    if (!chain.length) chain.push('piper');
    const tlOpts = { voiceOn: $('#opt-voice').checked, onStatus: (m, x) => { setStatus('#prep-status', `🎙️ ${ENG[tlOpts.engine] || ''} · ${m}`); if (x != null) setBar(0.1 + x * 0.75); } };
    let tl = null;
    for (const [i, eng] of chain.entries()) {
      tlOpts.engine = eng;
      try { tl = await buildTimeline(p, tlOpts); break; }
      catch (e) {
        if (!(e instanceof RemoteTTSError) || i === chain.length - 1) throw e;
        toast(`${ENG[eng]} şu an yanıt vermiyor (${e.message.slice(0, 120)}). ${ENG[chain[i + 1]]} ile devam ediliyor.`, 'error', 8000);
      }
    }
    if (!tl) tl = await buildTimeline(p, { ...tlOpts, voiceOn: false });
    const level = parseFloat($('#music-level').value);
    const mix = await mixAudio(p, tl, { musicOn: level > 0, musicLevel: level, onStatus: (m) => setStatus('#prep-status', m) });
    setBar(1);
    S.tl = tl; S.mix = mix; S.dirty = false;
    player.load(p, tl, mix, videoOpts());
    $('#player').hidden = false;
    $('#seek').value = 0; updateTime(0);
    setStatus('#prep-status', `✅ Hazır — ${fmtTime(tl.total)}. Oynat ya da videoyu oluştur.`);
    btn.textContent = '⚙️ Yeniden hazırla';
    renderScore(); renderSrtButtons();
  } catch (e) {
    console.error(e); toast('Hazırlık hatası: ' + e.message, 'error', 7000); setStatus('#prep-status', '');
  } finally {
    btn.disabled = false; setTimeout(() => (bar.hidden = true), 600);
  }
}

function updateTime(t) {
  $('#time').textContent = `${fmtTime(t)} / ${fmtTime(player.duration)}`;
  if (!seeking) $('#seek').value = Math.round((t / (player.duration || 1)) * 1000);
}
let seeking = false;
player.onTime = updateTime;
player.onEnd = () => ($('#btn-play').textContent = '▶');
$('#btn-play').addEventListener('click', async () => {
  if (S.dirty && S.tl) toast('Değişiklikler var: güncel hâli için "Yeniden hazırla"ya bas.');
  if (player.playing) { player.pause(); $('#btn-play').textContent = '▶'; }
  else { await player.play(); $('#btn-play').textContent = '⏸'; }
});
$('#seek').addEventListener('input', (e) => { seeking = true; const t = (e.target.value / 1000) * player.duration; player.seek(t); updateTime(t); seeking = false; });

$('#btn-record').addEventListener('click', async () => {
  if (!S.tl) return;
  if (S.dirty) await prepare();
  discardVideo();
  const btn = $('#btn-record'); btn.disabled = true; $('#btn-cancel-rec').hidden = false; $('#btn-prepare').disabled = true;
  $('#btn-play').textContent = '▶';
  try {
    const blob = await player.record((x) => setStatus('#rec-status', `⏺ Kaydediliyor %${Math.round(x * 100)} (bellekte)`));
    if (!blob) { setStatus('#rec-status', 'İptal edildi.'); return; }
    S.blob = blob; S.blobUrl = URL.createObjectURL(blob);
    $('#out-video').src = S.blobUrl;
    $('#output').hidden = false;
    $('#out-info').textContent = `${(blob.size / 1e6).toFixed(1)} MB · ${blob.type.includes('mp4') ? 'MP4' : 'WebM'} · sadece bellekte, henüz cihazına kaydedilmedi`;
    setStatus('#rec-status', '✅ Video hazır.');
    renderSrtButtons();
    $('#output').scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch (e) {
    console.error(e); toast('Kayıt hatası: ' + e.message, 'error', 7000);
  } finally {
    btn.disabled = false; $('#btn-cancel-rec').hidden = true; $('#btn-prepare').disabled = false;
  }
});
$('#btn-cancel-rec').addEventListener('click', () => player.cancelRecord());

function slug(s) { return (s || 'video').toLocaleLowerCase('tr').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 60) || 'video'; }
function download(blobOrText, name, type) {
  const blob = blobOrText instanceof Blob ? blobOrText : new Blob([blobOrText], { type });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: name }); document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
$('#btn-save').addEventListener('click', () => {
  if (!S.blob) return;
  download(S.blob, `${slug(S.project.title)}.${S.blob.type.includes('mp4') ? 'mp4' : 'webm'}`);
  toast('💾 Video cihazına kaydediliyor (İndirilenler).', 'ok');
});
$('#btn-discard').addEventListener('click', () => { discardVideo(); toast('Video bellekten silindi.'); });
function discardVideo() {
  if (S.blobUrl) URL.revokeObjectURL(S.blobUrl);
  S.blob = null; S.blobUrl = null;
  $('#out-video').removeAttribute('src'); $('#output').hidden = true;
}
window.addEventListener('beforeunload', (e) => { if (S.blob) { e.preventDefault(); e.returnValue = ''; } });

function renderSrtButtons() {
  const box = $('#srt-buttons'); box.innerHTML = '';
  if (!S.project || !S.tl) return;
  const langs = [S.project.lang, ...[...S.subLangs].filter((c) => c !== S.project.lang)];
  box.append(h('span', { class: 'hint' }, 'Altyazı (.srt):'));
  for (const code of langs) {
    const b = h('button', { class: 'ghost sm' }, '⬇ ' + langByCode(code).name);
    b.addEventListener('click', async () => {
      b.disabled = true;
      try {
        await ensureTranslations(code, '#rec-status');
        const cues = buildCues(S.tl.lines, textFor(code), { maxChars: 42 });
        download(toSRT(cues), `${slug(S.project.title)}.${code}.srt`, 'text/plain;charset=utf-8');
        setStatus('#rec-status', '');
      } catch (e) { toast('Çeviri hatası: ' + e.message, 'error', 6000); }
      b.disabled = false;
    });
    box.append(b);
  }
}

// ------------------------------------------------------------------ YouTube kapak görseli (tıklayınca indirilir)
$('#btn-thumb').addEventListener('click', async () => {
  const p = S.project; if (!p) return;
  const W = 1280, H = 720;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  const sc = p.scenes.find((s) => s.media?.type === 'image') || p.scenes.find((s) => s.beat === 'twist') || p.scenes[0];
  const { drawScene } = await import('./visuals.js');
  drawScene(x, W, H, { ...sc, camera: 'static', weather: 'clear' }, 1, 5, {});
  const g = x.createLinearGradient(0, 0, W * 0.75, 0);
  g.addColorStop(0, 'rgba(0,0,0,0.78)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  const text = (p.thumbnailText || p.title || '').toLocaleUpperCase(p.lang === 'tr' ? 'tr' : 'en');
  const words = text.split(/\s+/); const lines = []; let cur = '';
  x.font = '900 112px Inter, "Segoe UI", system-ui, sans-serif';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (x.measureText(t).width > W * 0.58 && cur) { lines.push(cur); cur = w; } else cur = t; }
  if (cur) lines.push(cur);
  const fs = lines.length > 3 ? 84 : 112;
  x.font = `900 ${fs}px Inter, "Segoe UI", system-ui, sans-serif`;
  x.textBaseline = 'middle'; x.lineJoin = 'round';
  const y0 = H / 2 - ((lines.length - 1) * fs * 1.05) / 2;
  lines.slice(0, 4).forEach((ln, i) => {
    x.lineWidth = fs * 0.16; x.strokeStyle = '#000'; x.strokeText(ln, 60, y0 + i * fs * 1.05);
    x.fillStyle = i === lines.length - 1 ? '#ffd23f' : '#ffffff'; x.fillText(ln, 60, y0 + i * fs * 1.05);
  });
  c.toBlob((b) => download(b, `${slug(p.title)}-kapak.png`), 'image/png');
});

// ------------------------------------------------------------------ YouTube meta
$('#btn-copy-meta').addEventListener('click', async () => {
  const p = S.project;
  const txt = `${p.title}\n\n${$('#yt-desc').value}\n\nEtiketler: ${(p.tags || []).join(', ')}`;
  try { await navigator.clipboard.writeText(txt); toast('📋 Kopyalandı', 'ok'); } catch { toast('Kopyalanamadı', 'error'); }
});
$('#btn-translate-meta').addEventListener('click', async () => {
  const p = S.project; const box = $('#meta-translations'); box.innerHTML = '';
  const btn = $('#btn-translate-meta'); btn.disabled = true;
  try {
    for (const code of S.subLangs) {
      if (code === p.lang) continue;
      const [t, d] = await translateAll([p.title, $('#yt-desc').value], p.lang, code);
      const copy = h('button', { class: 'ghost sm' }, '📋');
      copy.addEventListener('click', () => navigator.clipboard.writeText(`${t}\n\n${d}`).then(() => toast('Kopyalandı', 'ok')));
      box.append(h('div', { class: 'rule' }, h('b', {}, langByCode(code).name + ': ' + t), h('span', {}, d), ' ', copy));
    }
    box.prepend(h('p', { class: 'hint' }, 'YouTube Studio → Video → Altyazılar/Çeviriler bölümünden her dile ekle.'));
  } catch (e) { toast('Çeviri hatası: ' + e.message, 'error'); }
  btn.disabled = false;
});

// ------------------------------------------------------------------ Koç
function renderDaily() {
  const d = dailyCard();
  const go = h('button', { class: 'primary sm' }, '🎬 Bu fikirle senaryo yaz');
  go.addEventListener('click', () => {
    $('#topic').value = d.spark.idea; $('#format').value = d.spark.fmtKey;
    $$('#mode button')[0].click(); showTab('studio'); generate();
  });
  const again = h('button', { class: 'ghost sm' }, '🔄 Yeni kart');
  again.addEventListener('click', renderDaily);
  $('#daily').replaceChildren(
    h('div', { class: 'hint' }, 'Bugünün kartı'),
    h('div', { class: 'mind' }, '“' + d.mindset + '”'),
    h('div', { class: 'sparkbox' },
      h('div', { class: 'hint' }, '💡 Fikir kıvılcımı · ' + d.spark.fmt),
      h('div', { class: 'big' }, d.spark.idea),
      h('div', { class: 'hint' }, 'Başlık önerisi: “' + d.spark.title + '”'),
      h('div', { class: 'actions' }, go, again)),
  );
  $('#exercise').textContent = d.exercise;
}
renderDaily();
$('#btn-exercise').addEventListener('click', () => { $('#exercise').textContent = COACH.exercises[Math.floor(Math.random() * COACH.exercises.length)]; });
function addMsg(text, who) { const m = h('div', { class: 'msg ' + who }, text); $('#chat').append(m); $('#chat').scrollTop = 1e9; return m; }
addMsg('Merhaba! Ben senin yaratıcı koçunum. Bugün seni ne durduruyor?', 'bot');
async function sendChat() {
  const t = $('#chat-in').value.trim(); if (!t) return;
  $('#chat-in').value = ''; addMsg(t, 'me');
  const m = addMsg('…', 'bot');
  m.textContent = await coachReply(t);
}
$('#chat-send').addEventListener('click', sendChat);
$('#chat-in').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } });
let timerLeft = 600, timerId = 0;
const drawTimer = () => ($('#timer').textContent = fmtTime(timerLeft));
$('#timer-start').addEventListener('click', () => {
  if (timerId) { clearInterval(timerId); timerId = 0; $('#timer-start').textContent = 'Devam'; return; }
  $('#timer-start').textContent = 'Duraklat';
  timerId = setInterval(() => {
    timerLeft--; drawTimer();
    if (timerLeft <= 0) { clearInterval(timerId); timerId = 0; timerLeft = 0; toast('⏰ 10 dakika bitti! Ne ürettiysen yeterince iyi. Kaydet ve devam et.', 'ok', 8000); $('#timer-start').textContent = 'Başla'; }
  }, 1000);
});
$('#timer-reset').addEventListener('click', () => { clearInterval(timerId); timerId = 0; timerLeft = 600; drawTimer(); $('#timer-start').textContent = 'Başla'; });

// ------------------------------------------------------------------ Trendler
$('#niches').replaceChildren(...TOP_NICHES.map((n) => {
  const b = h('button', { class: 'ghost sm' }, 'Bu türde üret →');
  b.addEventListener('click', () => { $('#format').value = n.fmt; $$('#mode button')[0].click(); showTab('studio'); $('#topic').focus(); toast(`Tür: ${FORMATS[n.fmt].label}. Bir konu yaz ya da 🎲 bas.`); });
  return h('div', { class: 'niche' }, h('b', {}, n.name), h('p', {}, n.why), h('span', { class: 'ai' }, 'YZ uygunluğu: ' + n.ai), b);
}));
$('#retention').replaceChildren(...RETENTION_RULES.map((r) => h('div', { class: 'rule' }, h('b', {}, r.t), h('span', {}, r.d))));
$('#titles').replaceChildren(...TITLE_FORMULAS.map((t) => h('li', {}, t.replace('{X}', '…').replace('{N}', '60'))));
$('#thumbs').replaceChildren(...THUMBNAIL_RULES.map((t) => h('li', {}, t)));
$('#lengths').replaceChildren(...LENGTH_GUIDE.map((l) => h('li', {}, h('b', {}, l.fmt + ': '), l.d)));
$('#global').replaceChildren(...GLOBAL_TIPS.map((t) => h('li', {}, t)));
$('#director').replaceChildren(...DIRECTOR_TECHNIQUES.map((d) => h('li', {}, h('b', {}, d.name + ': '), d.d)));
$('#editor').replaceChildren(...EDITOR_RULES.map((t) => h('li', {}, t)));
for (const r of REGIONS) $('#yt-region').append(h('option', { value: r }, r));
for (const [k, v] of Object.entries(YT_CATEGORIES)) $('#yt-cat').append(h('option', { value: k }, v));
$('#btn-trends').addEventListener('click', async () => {
  const key = $('#yt-key').value.trim();
  if (!key) { toast('Önce ücretsiz YouTube Data API anahtarını gir.', 'error'); return; }
  const out = $('#trend-out'); out.textContent = 'Yükleniyor…';
  try {
    const r = await fetchTrending(key, $('#yt-region').value, $('#yt-cat').value);
    const n = (x) => x >= 1e6 ? (x / 1e6).toFixed(1) + 'M' : x >= 1e3 ? (x / 1e3).toFixed(0) + 'B' : String(x);
    const ideaBtn = h('button', { class: 'primary sm' }, '💡 Bu trendlerden fikir üret');
    ideaBtn.addEventListener('click', () => {
      const w = r.topWords.slice(0, 8);
      const pick = w[Math.floor(Math.random() * w.length)]?.[0] || '';
      const s = spark();
      $('#topic').value = `${pick} — ${s.angle}`; showTab('studio'); $$('#mode button')[0].click();
      toast('Trend kelimesi + yaratıcı açı birleştirildi. Şimdi "Senaryoyu yaz".');
    });
    out.replaceChildren(
      h('div', { class: 'chips' },
        h('span', { class: 'chip' }, `Medyan süre: ${fmtTime(r.medianDur)}`),
        h('span', { class: 'chip' }, `≤3 dk oranı: %${Math.round(r.shortsShare * 100)}`),
        h('span', { class: 'chip' }, `Ort. başlık: ${r.avgTitleLen} karakter`)),
      h('div', { class: 'hint' }, 'En sık geçen kelimeler:'),
      h('div', { class: 'chips' }, r.topWords.map(([w, c]) => h('span', { class: 'chip' }, `${w} ×${c}`))),
      h('div', { class: 'hint' }, 'Etkileşimi en yüksek 5 video (beğeni+yorum / izlenme):'),
      h('ul', { class: 'notes' }, r.engagement.map((v) => h('li', {}, `${v.title} — ${v.channel} (%${(v.eng * 100).toFixed(1)})`))),
      h('div', { class: 'actions' }, ideaBtn),
      h('table', {}, h('tr', {}, h('th', {}, '#'), h('th', {}, 'Başlık'), h('th', {}, 'Kanal'), h('th', {}, 'İzlenme'), h('th', {}, 'Süre')),
        r.items.slice(0, 25).map((v, i) => h('tr', {}, h('td', {}, String(i + 1)), h('td', {}, v.title), h('td', {}, v.channel), h('td', {}, n(v.views)), h('td', {}, fmtTime(v.dur))))),
    );
  } catch (e) { out.textContent = '⚠️ ' + e.message; }
});

// ------------------------------------------------------------------ Öğrenme
const GENE_LABELS = { structure: ['Zaman yapısı', TIME_STRUCTURES], hook: ['Kanca', HOOK_TYPES], twist: ['Twist', TWISTS], ending: ['Son', ENDINGS], tone: ['Görsel ton', { noir: 'Noir', hopeful: 'Umutlu', melancholic: 'Melankolik', tense: 'Gergin', epic: 'Destansı', intimate: 'Samimi' }] };
$('#learn-on').checked = learning.enabled;
$('#learn-on').addEventListener('change', (e) => { learning.enabled = e.target.checked; toast(e.target.checked ? 'Öğrenme açık.' : 'Öğrenme kapalı.'); });
$('#learn-reset').addEventListener('click', () => { if (confirm('Öğrenilen tüm stil tercihleri silinsin mi?')) { learning.reset(); renderLearn(); toast('Sıfırlandı.'); } });
$('#learn-submit').addEventListener('click', () => {
  const p = S.projects.find((x) => x.id === $('#learn-project').value);
  const v = parseFloat($('#learn-ret').value);
  if (!p || isNaN(v)) { toast('Proje ve izlenme oranı seç.', 'error'); return; }
  learning.feedback(p.genome, Math.max(0, Math.min(1, v / 100)));
  toast('📈 Gerçek veri öğrenildi. Teşekkürler!', 'ok'); $('#learn-ret').value = ''; renderLearn();
});
function renderLearn() {
  const sel = $('#learn-project'); sel.innerHTML = '';
  const withG = S.projects.filter((p) => p.genome);
  if (!withG.length) sel.append(h('option', { value: '' }, 'Bu oturumda henüz fikirden proje üretilmedi'));
  for (const p of withG) sel.append(h('option', { value: p.id }, p.title));
  const sum = learning.summary();
  $('#learn-summary').replaceChildren(...(sum.length ? sum.map(({ gene, ranked }) => {
    const [label, map] = GENE_LABELS[gene] || [gene, {}];
    return h('div', { class: 'rule' }, h('b', {}, label), ...ranked.slice(0, 5).map((r) => h('div', { class: 'learn-row' },
      h('span', {}, map[r.k] || r.k), h('div', { class: 'bar' }, h('i', { style: { width: Math.round(r.mean * 100) + '%' } })), h('span', {}, '%' + Math.round(r.mean * 100)))));
  }) : [h('p', { class: 'hint' }, 'Henüz veri yok. Ürettiğin senaryolara 👍/👎 ver.')]));
}

// ------------------------------------------------------------------ Ayarlar
function syncProviderUI() {
  $$('input[name=prov]').forEach((r) => (r.checked = r.value === llmConfig.provider));
  ['webllm', 'gemini', 'openai'].forEach((k) => ($('#prov-' + k).hidden = llmConfig.provider !== k));
  engineLabel();
}
$('#webllm-model').value = llmConfig.webllmModel;
$('#gem-key').value = llmConfig.geminiKey; $('#gem-model').value = llmConfig.geminiModel;
$('#oa-base').value = llmConfig.oaBase; $('#oa-model').value = llmConfig.oaModel; $('#oa-key').value = llmConfig.oaKey;
$('#llm-remember').checked = llmConfig.remember;
syncProviderUI();
$$('input[name=prov]').forEach((r) => r.addEventListener('change', () => { llmConfig.provider = r.value; saveLlmConfig(); syncProviderUI(); }));
const bind = (sel, key) => $(sel).addEventListener('change', (e) => { llmConfig[key] = e.target.value.trim(); saveLlmConfig(); engineLabel(); });
bind('#webllm-model', 'webllmModel'); bind('#gem-key', 'geminiKey'); bind('#gem-model', 'geminiModel'); bind('#oa-base', 'oaBase'); bind('#oa-model', 'oaModel'); bind('#oa-key', 'oaKey');
$('#llm-remember').addEventListener('change', (e) => { llmConfig.remember = e.target.checked; saveLlmConfig(); });
for (const [k, v] of Object.entries(PRESETS)) {
  const c = h('span', { class: 'chip', title: v.note, style: { cursor: 'pointer' } }, k);
  c.addEventListener('click', () => { llmConfig.oaBase = v.base; llmConfig.oaModel = v.model; $('#oa-base').value = v.base; $('#oa-model').value = v.model; saveLlmConfig(); engineLabel(); toast(v.note); });
  $('#oa-presets').append(c);
}
$('#llm-test').addEventListener('click', async () => {
  if (!llmAvailable()) { setStatus('#llm-status', 'Yerleşik motor her zaman çalışır ✓'); return; }
  setStatus('#llm-status', 'Test ediliyor…');
  try {
    const r = await chat([{ role: 'user', content: 'Reply with exactly: OK' }], { temperature: 0, maxTokens: 10, onProgress: (t) => setStatus('#llm-status', t) });
    setStatus('#llm-status', '✅ Bağlantı çalışıyor: ' + r.slice(0, 40));
  } catch (e) { setStatus('#llm-status', '❌ ' + e.message); }
});

$$('input[name=tts]').forEach((r) => {
  r.checked = r.value === ttsPrefs.engine;
  r.addEventListener('change', () => {
    ttsPrefs.engine = r.value;
    if (S.project) { renderCast(); voiceStatus(); markDirty(); }
    toast({ auto: 'Ses motoru: Otomatik (OmniVoice → Piper).', omnivoice: 'Ses motoru: OmniVoice.', piper: 'Ses motoru: Piper (tamamen çevrimdışı).' }[r.value], 'ok');
  });
});
$('#hf-token').addEventListener('change', (e) => { hfAuth.token = e.target.value.trim(); });
$('#edge-host').value = ttsPrefs.edgeHost;
$('#edge-host').addEventListener('change', (e) => { ttsPrefs.edgeHost = e.target.value.trim().replace(/\/$/, ''); toast('Edge TTS adresi kaydedildi. Yeni senaryoda kullanılacak.', 'ok'); });
$('#pexels-key').addEventListener('change', (e) => { imgPrefs.pexelsKey = e.target.value.trim(); });
async function puterStatus() { setStatus('#puter-status', (await puterSignedIn()) ? '✅ Bağlı — Nano Banana kullanılabilir.' : 'Bağlı değil.'); }
$('#btn-puter').addEventListener('click', async () => {
  try { const ok = await puterSignIn(); toast(ok ? '🍌 Puter bağlandı.' : 'Puter girişi tamamlanmadı.', ok ? 'ok' : 'error'); }
  catch (e) { toast('Puter girişi: ' + (e?.message || e?.error?.message || 'iptal edildi'), 'error'); }
  puterStatus();
});
for (const l of LANGS.filter((x) => x.piper)) $('#voice-lang').append(h('option', { value: l.code }, l.name));
const SAMPLE = { tr: 'Merhaba, bu benim sesim. Hikâyeni anlatmaya hazırım.', en: 'Hello, this is my voice. I am ready to tell your story.', es: 'Hola, esta es mi voz.', pt: 'Olá, esta é a minha voz.', de: 'Hallo, das ist meine Stimme.', fr: 'Bonjour, voici ma voix.', it: 'Ciao, questa è la mia voce.', ru: 'Привет, это мой голос.', ar: 'مرحبا، هذا صوتي.', zh: '你好，这是我的声音。', nl: 'Hallo, dit is mijn stem.', pl: 'Cześć, to jest mój głos.', uk: 'Привіт, це мій голос.', vi: 'Xin chào, đây là giọng nói của tôi.', fa: 'سلام، این صدای من است.' };
$('#btn-voice-list').addEventListener('click', async () => {
  const code = $('#voice-lang').value; const box = $('#voice-list'); box.textContent = 'Yükleniyor…';
  try {
    const vs = await piperVoicesFor(code);
    box.replaceChildren(h('table', {}, h('tr', {}, h('th', {}, 'Ses'), h('th', {}, 'Cinsiyet'), h('th', {}, 'Kalite'), h('th', {}, 'Boyut'), h('th', {}, '')),
      vs.map((v) => {
        const b = h('button', { class: 'ghost sm' }, '▶');
        b.addEventListener('click', async () => {
          b.disabled = true;
          try { const buf = await synth(SAMPLE[code] || SAMPLE.en, { model: v.key, pitch: 0, tempo: 1, bright: 0 }, { onProgress: (p) => (b.textContent = '%' + Math.round(p * 100)) }); if (buf) await playBuf(buf); }
          catch (e) { toast(e.message, 'error'); }
          b.disabled = false; b.textContent = '▶';
        });
        return h('tr', {}, h('td', {}, v.name), h('td', {}, { f: 'Kadın', m: 'Erkek', u: '?' }[v.gender]), h('td', {}, v.quality), h('td', {}, v.sizeMB + ' MB'), h('td', {}, b));
      })));
  } catch (e) { box.textContent = '⚠️ ' + e.message; }
});
$('#btn-voice-clear').addEventListener('click', async () => { try { await clearVoiceCache(); toast('Ses önbelleği temizlendi.', 'ok'); } catch (e) { toast(e.message, 'error'); } });

// Hızlı başlangıç: tarayıcı dili Türkçe değilse içerik dilini ona göre öner
const nav = (navigator.language || 'tr').slice(0, 2);
if (LANGS.some((l) => l.code === nav)) $('#lang').value = nav;
