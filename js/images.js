// Sahne görselleri: gerçek yapay zekâ görselleri (FLUX / Nano Banana) ya da lisanslı stok fotoğraf.
// Zincir (otomatik): FLUX.1-schnell (ücretsiz HF ZeroGPU) → Puter (Nano Banana / FLUX, kullanıcı girişliyse)
//                    → stok fotoğraf (Pexels anahtarı varsa, yoksa Openverse) → prosedürel çizim.
// Prompt yapısı awesome-nano-banana-pro-prompts fork'undaki "sinematik film karesi" kalıbını izler:
// stil + özne + karakter tarifi + mekân + ışık + hava + renk derecelendirme + kadraj + lens + negatifler.
// Görseller yalnızca bellekte tutulur.

import { gradioCall, gradioFile } from './hf.js';
import { makeRng, store, hash } from './util.js';

export const imgPrefs = {
  get engine() { return store.get('yzs.img', 'auto'); }, set engine(v) { store.set('yzs.img', v); },
  get style() { return store.get('yzs.style', 'cinematic'); }, set style(v) { store.set('yzs.style', v); },
  pexelsKey: '',
};

export const STYLES = {
  cinematic: { label: 'Sinematik gerçekçi', p: 'cinematic film still, shot on ARRI Alexa 65 with anamorphic lens, shallow depth of field, natural film grain, dramatic motivated lighting, rich teal and amber color grade, photorealistic, 8k detail' },
  noir: { label: 'Karanlık gerilim (noir)', p: 'neo-noir film still, hard low-key lighting, deep shadows, rain-slick reflections, high contrast, desaturated with selective warm highlights, photorealistic, 35mm film grain' },
  documentary: { label: 'Belgesel fotoğraf', p: 'award-winning documentary photograph, natural available light, authentic, candid, 35mm lens, realistic textures, subtle grain' },
  anime: { label: 'Anime', p: 'high quality anime key visual, detailed painted background, luminous sky, cinematic lighting, vibrant colors, crisp line art' },
  animated3d: { label: '3D animasyon filmi', p: '3D animated feature film still, stylized characters, soft global illumination, subsurface scattering, vibrant yet cinematic palette, highly detailed' },
  fantasy: { label: 'Karanlık fantastik', p: 'dark fantasy concept art, epic scale, volumetric god rays, atmospheric haze, painterly detail, moody palette' },
  oil: { label: 'Yağlı boya', p: 'classical oil painting, visible brush strokes, chiaroscuro lighting, museum quality, rich pigments' },
};

const SET_EN = {
  city: 'a sprawling city at street level with towering buildings', forest: 'a dense misty pine forest', ocean: 'a rugged coastline with a lone lighthouse and crashing waves',
  desert: 'vast rolling desert dunes', space: 'deep space with a giant planet and glowing nebula', mountain: 'snow-capped mountain peaks and a narrow pass',
  interior: 'a dim old room with dust floating in a shaft of window light', village: 'a small remote village with stone houses', abstract: 'a surreal dreamlike void with floating light',
};
const TIME_EN = { dawn: 'at dawn, soft pink and gold light', day: 'in clear daylight', dusk: 'at golden hour sunset, long shadows', night: 'at night, moonlight and practical lights' };
const WEATHER_EN = { clear: '', rain: 'heavy rain, wet reflective surfaces', snow: 'falling snow', storm: 'violent thunderstorm, lightning in the sky', fog: 'thick drifting fog', embers: 'glowing embers floating in the air' };
const MOOD_EN = { calm: 'serene calm mood', mysterious: 'mysterious eerie mood', tense: 'tense suspenseful mood', dark: 'dark ominous mood', hopeful: 'hopeful uplifting mood', warm: 'warm intimate mood', epic: 'epic grand mood', melancholic: 'melancholic lonely mood', energetic: 'energetic dynamic mood' };
const SHOT_EN = { hook: 'dramatic extreme close-up', setup: 'wide establishing shot', inciting: 'close-up detail shot', rising: 'medium shot', complication: 'low-angle shot', crisis: 'dynamic handheld shot', twist: 'tilted dutch-angle close-up', resolution: 'wide shot', close: 'wide shot, silhouette against the sky', marker: 'minimal symbolic shot' };

// Karakterin sabit görsel tarifi (her sahnede aynı kişi görünsün diye tohumla seçilir)
export function characterLook(c) {
  if (c.visualDesc) return c.visualDesc;
  const r = makeRng(parseInt(hash(c.id + c.name), 36));
  const g = c.gender === 'female' ? 'woman' : c.gender === 'male' ? 'man' : 'person';
  const age = { child: c.gender === 'female' ? 'little girl' : c.gender === 'male' ? 'little boy' : 'child', young: 'young ' + g, adult: 'middle-aged ' + g, elder: 'elderly ' + g }[c.age] || g;
  const build = { slim: 'slender', average: '', heavy: 'heavyset' }[c.build] || '';
  const hair = c.age === 'elder' ? r.pick(['silver hair', 'white hair', 'grey beard and hair']) : r.pick(['short dark hair', 'long wavy brown hair', 'curly black hair', 'auburn hair in a loose bun', 'messy blond hair', 'cropped black hair']);
  const wear = r.pick(['a dark wool coat', 'a worn leather jacket', 'a grey hoodie', 'a long beige trench coat', 'a simple linen shirt', 'a knitted sweater', 'a navy raincoat']);
  const asciiLook = /^[\x20-\x7E]{4,}$/.test(c.look || '') ? `, ${c.look}` : '';
  c.visualDesc = `a ${build ? build + ' ' : ''}${age} with ${hair}, wearing ${wear}${asciiLook}`;
  return c.visualDesc;
}

export function scenePrompt(project, scene, enText = '') {
  const style = STYLES[imgPrefs.style] || STYLES.cinematic;
  const ppl = [project.narrator, ...project.characters];
  const speakers = [...new Set(scene.lines.map((l) => l.speaker).filter((s) => s !== 'narrator'))]
    .map((id) => ppl.find((c) => c?.id === id)).filter(Boolean).slice(0, 2);
  const subject = /^[\x20-\x7E]{8,}$/.test(scene.visual || '') ? scene.visual : enText;
  const parts = [
    style.p,
    subject && `scene: ${subject.slice(0, 260)}`,
    speakers.length ? `featuring ${speakers.map(characterLook).join(' and ')}` : '',
    `setting: ${SET_EN[scene.setting] || SET_EN.abstract} ${TIME_EN[scene.time] || ''}`,
    WEATHER_EN[scene.weather],
    MOOD_EN[scene.mood],
    SHOT_EN[scene.beat] || 'medium shot',
    project.aspect === '9:16' ? 'vertical composition' : 'widescreen composition',
    'no text, no letters, no watermark, no subtitles, no logo',
  ];
  return parts.filter(Boolean).join(', ');
}

// ------------------------------------------------------------------ Sağlayıcılar
const FLUX_HOSTS = ['https://black-forest-labs-flux-1-schnell.hf.space', 'https://evalstate-flux1-schnell.hf.space'];
async function flux(prompt, w, h, seed) {
  let last;
  for (const host of FLUX_HOSTS) {
    try {
      const out = await gradioCall(host, 'infer', [prompt, seed % 2147483647, false, w, h, 4]);
      const f = out[0]?.url ? out[0] : out[0]?.image || out[0];
      return new Blob([await gradioFile(f)], { type: 'image/webp' });
    } catch (e) { last = e; }
  }
  throw last;
}

let puterLoading = null;
export function loadPuter() {
  if (window.puter) return Promise.resolve(window.puter);
  puterLoading ??= new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://js.puter.com/v2/';
    s.onload = () => res(window.puter);
    s.onerror = () => rej(new Error('Puter yüklenemedi'));
    document.head.append(s);
  });
  return puterLoading;
}
export async function puterSignedIn() {
  try { const p = await loadPuter(); return p.auth.isSignedIn(); } catch { return false; }
}
// Kullanıcı tıklamasıyla çağrılmalı (açılır pencere)
export async function puterSignIn() { const p = await loadPuter(); await p.auth.signIn(); return p.auth.isSignedIn(); }

async function puterImage(prompt) {
  const p = await loadPuter();
  if (!p.auth.isSignedIn()) throw new Error('Puter girişi yok');
  let lastErr;
  for (const model of ['gemini-2.5-flash-image-preview', 'black-forest-labs/FLUX.1-schnell', undefined]) {
    try {
      const img = await p.ai.txt2img(prompt, model ? { model } : {});
      return await (await fetch(img.src)).blob();
    } catch (e) { lastErr = e; }
  }
  throw new Error(lastErr?.error?.message || lastErr?.message || 'Puter görsel üretemedi');
}

const STOCK_Q = { city: 'city night street', forest: 'misty forest', ocean: 'lighthouse sea', desert: 'desert dunes', space: 'galaxy nebula', mountain: 'snowy mountains', interior: 'old room window light', village: 'village houses', abstract: 'abstract light' };
async function stockImage(scene, vertical, keywords) {
  const q = (keywords || STOCK_Q[scene.setting] || 'landscape').slice(0, 60);
  if (imgPrefs.pexelsKey) {
    const r = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&orientation=${vertical ? 'portrait' : 'landscape'}&per_page=15`, { headers: { Authorization: imgPrefs.pexelsKey } });
    if (r.ok) {
      const j = await r.json();
      const ph = j.photos?.[Math.floor(Math.random() * Math.min(j.photos.length, 8))];
      if (ph) {
        const b = await (await fetch(ph.src.large2x)).blob();
        return { blob: b, credit: `Fotoğraf: ${ph.photographer} (Pexels)` };
      }
    }
  }
  // Openverse alaka sıralaması zayıf: başlığında/etiketinde aranan kelime geçmeyen sonuçları at.
  const search = async (query) => {
    const r = await fetch(`https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&page_size=20&license_type=commercial,modification&size=large&mature=false`);
    const j = await r.json();
    const words = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
    return (j.results || []).filter((it) => {
      const hay = ((it.title || '') + ' ' + (it.tags || []).map((t) => t.name).join(' ')).toLowerCase();
      return words.some((w) => new RegExp(`\\b${w}`).test(hay));
    });
  };
  let results = (await search(q)).slice(0, 10);
  if (results.length < 2 && STOCK_Q[scene.setting] && q !== STOCK_Q[scene.setting]) results = (await search(STOCK_Q[scene.setting])).slice(0, 10);
  // aynı sahneye her seferinde aynı foto gelmesin
  const start = Math.floor(Math.random() * Math.min(4, results.length));
  for (const it of [...results.slice(start), ...results.slice(0, start)]) {
    const wm = /upload\.wikimedia\.org\/wikipedia\/commons\/(\w)\/(\w\w)\/([^/?#]+)$/.exec(it.url);
    // Wikimedia yalnızca standart küçük resim genişliklerini kabul ediyor
    const urls = wm ? [1920, 1280].map((w) => `https://upload.wikimedia.org/wikipedia/commons/thumb/${wm[1]}/${wm[2]}/${wm[3]}/${w}px-${wm[3]}`) : [it.url];
    for (const url of urls) {
      try {
        const resp = await fetch(url);
        if (!resp.ok) continue;
        const b = await resp.blob();
        if (b.size < 20000 || b.size > 8e6 || !b.type.startsWith('image/')) continue;
        return { blob: b, credit: `${it.title || 'Görsel'} — ${it.creator || 'bilinmiyor'} (${(it.license || '').toUpperCase()} ${it.license_version || ''}) ${it.foreign_landing_url || ''}`.trim() };
      } catch {}
    }
  }
  throw new Error('Uygun stok fotoğraf bulunamadı');
}

// Tek sahne için görsel üret. Dönüş: { blob, source, credit }
export async function sceneImage(project, scene, { enText = '', keywords = '', onStatus } = {}) {
  const vertical = project.aspect === '9:16';
  const w = vertical ? 768 : 1344, h = vertical ? 1344 : 768;
  const prompt = scenePrompt(project, scene, enText);
  const seed = (project.seed + (project.imgSalt || 0) + project.scenes.indexOf(scene) * 104729) >>> 0;
  const pref = imgPrefs.engine;
  const chain = pref === 'auto' ? ['flux', 'puter', 'stock'] : [pref];
  const errors = [];
  for (const e of chain) {
    try {
      if (e === 'flux') { onStatus?.('FLUX yapay zekâ görseli üretiyor…'); return { blob: await flux(prompt, w, h, seed), source: 'FLUX.1-schnell', prompt }; }
      if (e === 'puter') {
        if (pref === 'auto' && !(await puterSignedIn())) continue;
        onStatus?.('Nano Banana (Puter) görsel üretiyor…');
        return { blob: await puterImage(prompt), source: 'Puter / Nano Banana', prompt };
      }
      if (e === 'stock') { onStatus?.('Stok fotoğraf aranıyor…'); const s = await stockImage(scene, vertical, keywords); return { ...s, source: 'Stok', prompt }; }
    } catch (err) { errors.push(`${e}: ${err.message}`); }
  }
  throw new Error(errors.join(' · ') || 'Görsel kaynağı yok');
}
