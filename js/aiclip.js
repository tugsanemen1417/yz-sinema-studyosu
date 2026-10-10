// Sahne → gerçek yapay zekâ video klibi (LTX-2, ücretsiz Hugging Face Space'leri üzerinden).
// Sahnenin prosedürel karesi (ya da kullanıcının kendi görseli) ilk kare olarak yüklenir,
// LTX-2 onu yönetmen notlarına (kamera, hava, ruh hâli) göre canlandırır.
// Klip yalnızca bellekte tutulur. Ücretsiz GPU kotası sınırlıdır; dolarsa prosedürel sahne kullanılır.

import { gradioCall, gradioUpload, gradioFile } from './hf.js';
import { drawScene } from './visuals.js';

export const LTX_SPACES = [
  // Topluluk Space'i (LTX-2 turbo) — testte ücretsiz kotayla çalıştı
  { name: 'LTX-2 Turbo', host: 'https://alexnasa-ltx-2-turbo.hf.space', api: 'generate_video', args: (img, prompt, w, h, seed) => [img, null, prompt, null, 'Image-to-Video', false, seed, false, h, w, 'No LoRA', null] },
  // Lightricks'in resmi LTX-2.3 Space'i (yedek)
  { name: 'LTX-2.3', host: 'https://lightricks-ltx-2-3.hf.space', api: 'generate_video', args: (img, prompt, w, h, seed) => [img, prompt, 3, false, seed, false, h, w] },
];

const W_SET = { city: 'city lights', forest: 'trees and mist', ocean: 'sea waves and light', desert: 'sand and heat haze', space: 'stars, nebula and the planet', mountain: 'clouds over the peaks', interior: 'dust in the light beam', village: 'chimney smoke and window lights', abstract: 'flowing light' };
const W_WEATHER = { clear: '', rain: 'heavy rain falling', snow: 'snow falling', storm: 'thunderstorm with lightning flashes', fog: 'fog drifting', embers: 'glowing embers floating' };
const W_MOOD = { calm: 'calm', mysterious: 'mysterious', tense: 'tense', dark: 'dark, ominous', hopeful: 'hopeful, warm', warm: 'warm', epic: 'epic', melancholic: 'melancholic', energetic: 'energetic' };
const W_CAM = { push_in: 'slow dolly-in', pull_out: 'slow pull-back', pan_left: 'slow pan to the left', pan_right: 'slow pan to the right', tilt_up: 'slow tilt up', shake: 'handheld camera', static: 'locked-off camera' };

export function scenePrompt(scene, hasFigure) {
  const parts = [
    'Make this image come alive',
    W_SET[scene.setting] && `${W_SET[scene.setting]} moving naturally`,
    W_WEATHER[scene.weather],
    hasFigure && 'the silhouetted figure breathes and moves subtly',
    `${W_MOOD[scene.mood] || 'cinematic'} cinematic atmosphere`,
    W_CAM[scene.camera] || 'slow dolly-in',
    /^[\x20-\x7E]+$/.test(scene.visual || '') ? scene.visual : '',
    'film grain, no text, no watermark',
  ];
  return parts.filter(Boolean).join(', ');
}

export async function makeClip(scene, { aspect, seed, speaker, onStatus }) {
  const vertical = aspect === '9:16';
  const w = vertical ? 512 : 768, h = vertical ? 768 : 512;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  // YZ görseli ya da kullanıcının görseli varsa ilk kare odur (en kaliteli sonuç)
  const img = scene.media?.type === 'image' ? scene.media : null;
  drawScene(c.getContext('2d'), w, h, { ...scene, media: img, camera: 'static', beat: 'rising' }, 1, 5, { speaker, speakerAlpha: 1 });
  const frame = await new Promise((r) => c.toBlob(r, 'image/png'));
  const prompt = scenePrompt(scene, !!speaker && !img);
  let lastErr;
  for (const sp of LTX_SPACES) {
    try {
      onStatus?.(`${sp.name}: kare yükleniyor…`);
      const fd = await gradioUpload(sp.host, frame, 'frame.png');
      onStatus?.(`${sp.name}: yapay zekâ videoyu üretiyor (≈20–60 sn)…`);
      const out = await gradioCall(sp.host, sp.api, sp.args(fd, prompt, w, h, seed % 100000));
      let file = out[0];
      if (file?.video) file = file.video;
      const ab = await gradioFile(file);
      return new Blob([ab], { type: 'video/mp4' });
    } catch (e) {
      console.warn(sp.name, e);
      lastErr = e;
    }
  }
  throw lastErr || new Error('YZ video servisi yanıt vermedi.');
}
