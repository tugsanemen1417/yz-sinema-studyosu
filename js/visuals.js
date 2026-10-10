// Prosedürel sinematik sahne üretici (tamamen ücretsiz, telifsiz, internet gerektirmez).
// Mekân + günün saati + ruh hâli + hava → katmanlı paralaks sahne, kamera hareketi,
// parçacıklar, film greni, vinyet, renk derecelendirme ve konuşan karakter silueti.
// Kullanıcı bir sahneye kendi görselini/videosunu eklerse o kullanılır (yalnızca bellekte).

import { makeRng, hash } from './util.js';

const SKY = {
  dawn: ['#1d2b53', '#7a4a7f', '#f2a07b'],
  day: ['#2463a6', '#7fb6e6', '#dcefff'],
  dusk: ['#1f1438', '#9c3d64', '#ff9a5a'],
  night: ['#050a18', '#122047', '#2a3d66'],
};
const GRADE = {
  calm: ['#6fa8dc', 0.08], mysterious: ['#5b3fa0', 0.18], tense: ['#0e7c7b', 0.16], dark: ['#000000', 0.32],
  hopeful: ['#ffb347', 0.16], warm: ['#ff8c42', 0.14], epic: ['#ff6a00', 0.14], melancholic: ['#4a6b8a', 0.22], energetic: ['#ff2e63', 0.1],
};

function hexToRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`;
}
function rgba(h, a) { const [r, g, b] = hexToRgb(h); return `rgba(${r},${g},${b},${a})`; }

// Sahne geometrisi bir kez hesaplanır (kareden kareye titreme olmasın)
const geoCache = new Map();
function geometry(scene, W, H) {
  const key = scene.id + W + 'x' + H + scene.setting;
  if (geoCache.has(key)) return geoCache.get(key);
  const rng = makeRng(parseInt(hash(scene.id + scene.setting), 36));
  const g = { rng };
  g.stars = Array.from({ length: 160 }, () => [rng.next(), rng.next() * 0.7, rng.float(0.4, 1.6), rng.next() * 6.28]);
  g.ridges = [0, 1, 2].map((layer) => {
    const pts = []; const n = 9 + layer * 3; const base = 0.55 + layer * 0.08;
    for (let i = 0; i <= n; i++) pts.push([i / n, base - rng.float(0.05, 0.22) / (layer + 1)]);
    return pts;
  });
  g.buildings = [0, 1].map((layer) => {
    const arr = []; let x = -0.05;
    while (x < 1.1) {
      const w = rng.float(0.05, 0.12) * (layer ? 1.3 : 1);
      const hgt = rng.float(0.18, 0.5) * (layer ? 0.8 : 1.1);
      const wins = []; for (let i = 0; i < 40; i++) wins.push(rng.chance(0.35));
      arr.push({ x, w, h: hgt, wins, antenna: rng.chance(0.25), neon: rng.chance(0.2) ? rng.pick(['#ff2e97', '#29f0ff', '#ffd23f']) : null });
      x += w + rng.float(0.0, 0.02);
    }
    return arr;
  });
  g.trees = [0, 1, 2].map((layer) => Array.from({ length: 14 + layer * 4 }, () => [rng.float(-0.05, 1.05), rng.float(0.18, 0.4) * (1 + layer * 0.35), rng.float(0.6, 1.2)]));
  g.dunes = [0, 1, 2].map(() => [rng.float(0.2, 0.8), rng.float(0.02, 0.08), rng.float(0.5, 2)]);
  g.houses = Array.from({ length: 7 }, () => [rng.float(0.02, 0.95), rng.float(0.05, 0.09), rng.float(0.05, 0.08), rng.chance(0.7)]);
  g.planet = { x: rng.float(0.2, 0.8), y: rng.float(0.2, 0.45), r: rng.float(0.12, 0.25), hue: rng.pick(['#c56b3a', '#4f7cac', '#8e5fbf', '#3aa57a']), ring: rng.chance(0.5) };
  g.nebula = Array.from({ length: 5 }, () => [rng.next(), rng.next() * 0.8, rng.float(0.2, 0.5), rng.pick(['#7b2ff7', '#f107a3', '#00c9ff', '#ff6a00', '#2af598'])]);
  g.lighthouse = rng.chance(0.6);
  g.particles = Array.from({ length: 220 }, () => [rng.next(), rng.next(), rng.next(), rng.next()]);
  g.flashes = Array.from({ length: 4 }, () => rng.float(0.5, 12));
  g.shelves = rng.chance(0.6);
  geoCache.set(key, g);
  return g;
}

// Film greni dokuları
let grains = null;
function grain() {
  if (grains) return grains;
  grains = [0, 1, 2].map(() => {
    const c = document.createElement('canvas'); c.width = c.height = 192;
    const x = c.getContext('2d'); const d = x.createImageData(192, 192);
    for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 26; }
    x.putImageData(d, 0, 0); return c;
  });
  return grains;
}

function camera(scene, p, t, W, H) {
  const c = { s: 1.06, x: 0, y: 0, rot: 0 };
  switch (scene.camera) {
    case 'push_in': c.s = 1.04 + 0.1 * p; break;
    case 'pull_out': c.s = 1.14 - 0.1 * p; break;
    case 'pan_left': c.x = (0.5 - p) * 0.06 * W; c.s = 1.1; break;
    case 'pan_right': c.x = (p - 0.5) * 0.06 * W; c.s = 1.1; break;
    case 'tilt_up': c.y = (p - 0.5) * 0.05 * H; c.s = 1.1; break;
    case 'shake': c.s = 1.1; c.x = Math.sin(t * 7.1) * W * 0.004 + Math.sin(t * 13.7) * W * 0.002; c.y = Math.cos(t * 8.3) * H * 0.003; c.rot = Math.sin(t * 3.1) * 0.003; break;
    default: c.s = 1.05;
  }
  if (scene.beat === 'twist') c.rot += 0.035 * Math.min(1, p * 2); // Dutch açı
  return c;
}

export function drawScene(ctx, W, H, scene, t, dur, opts = {}) {
  const p = dur > 0 ? Math.min(1, t / dur) : 0;
  const g = geometry(scene, W, H);
  const cam = camera(scene, p, t, W, H);
  ctx.save();
  ctx.translate(W / 2 + cam.x, H / 2 + cam.y);
  ctx.rotate(cam.rot);
  ctx.scale(cam.s, cam.s);
  ctx.translate(-W / 2, -H / 2);

  const media = scene.media;
  const real = !!(media && media.el && (media.type === 'image' ? media.el.complete && media.el.naturalWidth : media.el.readyState >= 2));
  try {
    if (real) drawCover(ctx, media.el, W, H);
    else drawEnvironment(ctx, W, H, scene, g, t, p);
  } finally {
    ctx.restore();
  }
  // Stok/kullanıcı fotoğrafı sahnenin saatine uymuyorsa sinemadaki "day-for-night" tekniği
  if (real && media.kind !== 'aiimg' && media.kind !== 'aiclip') {
    const tint = { night: ['multiply', 'rgba(40,60,120,0.85)', 'rgba(0,5,20,0.35)'], dusk: ['soft-light', 'rgba(255,120,60,0.55)', null], dawn: ['soft-light', 'rgba(255,170,150,0.45)', null] }[scene.time];
    if (tint) {
      ctx.save();
      ctx.globalCompositeOperation = tint[0]; ctx.fillStyle = tint[1]; ctx.fillRect(0, 0, W, H);
      if (tint[2]) { ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = tint[2]; ctx.fillRect(0, 0, W, H); }
      ctx.restore();
    }
  }

  // Gerçek görsel/video varsa: sadece hafif yağmur/kar katmanı, siluet yok, hafif renk derecelendirme
  if (!real || ['rain', 'snow', 'storm', 'embers'].includes(scene.weather)) {
    ctx.save(); if (real) ctx.globalAlpha = 0.45;
    drawWeather(ctx, W, H, real ? { ...scene, mood: 'calm', weather: scene.weather === 'fog' ? 'clear' : scene.weather } : scene, g, t);
    ctx.restore();
  }
  if (!real && opts.speaker && opts.speaker.id !== 'narrator') drawSilhouette(ctx, W, H, opts.speaker, opts.speakerIndex || 0, opts.speakerAlpha ?? 1, scene, t);
  grade(ctx, W, H, scene, t, real);
}

function drawCover(ctx, el, W, H) {
  const iw = el.videoWidth || el.naturalWidth, ih = el.videoHeight || el.naturalHeight;
  const s = Math.max(W / iw, H / ih);
  ctx.drawImage(el, (W - iw * s) / 2, (H - ih * s) / 2, iw * s, ih * s);
}

function sky(ctx, W, H, time, horizon = 0.62) {
  const [a, b, c] = SKY[time] || SKY.dusk;
  const gr = ctx.createLinearGradient(0, 0, 0, H * horizon);
  gr.addColorStop(0, a); gr.addColorStop(0.6, b); gr.addColorStop(1, c);
  ctx.fillStyle = gr; ctx.fillRect(-W * 0.2, -H * 0.2, W * 1.4, H * 1.4);
}

function celestial(ctx, W, H, time, t, x = 0.7, y = 0.3) {
  if (time === 'day') return;
  const isSun = time !== 'night';
  const cx = W * x, cy = H * (time === 'dawn' ? 0.5 : time === 'dusk' ? 0.48 : y) - t * 0.4;
  const r = Math.min(W, H) * (isSun ? 0.09 : 0.06);
  const glow = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 5);
  glow.addColorStop(0, isSun ? 'rgba(255,220,160,0.7)' : 'rgba(200,220,255,0.35)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow; ctx.fillRect(cx - r * 5, cy - r * 5, r * 10, r * 10);
  ctx.fillStyle = isSun ? '#ffe2b0' : '#e8eefc';
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill();
}

function stars(ctx, W, H, g, t, dens = 1) {
  for (let i = 0; i < g.stars.length * dens; i++) {
    const [x, y, s, ph] = g.stars[i % g.stars.length];
    const a = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.3 + ph));
    ctx.fillStyle = `rgba(255,255,255,${a * 0.8})`;
    ctx.fillRect(x * W, y * H, s, s);
  }
}

function ridges(ctx, W, H, g, base, far, near, snow = false, t = 0) {
  g.ridges.forEach((pts, layer) => {
    const col = mix(far, near, layer / 2);
    const par = (layer + 1) * 4 * Math.sin(t * 0.05);
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(-W * 0.1, H * 1.1);
    pts.forEach(([x, y]) => ctx.lineTo(x * W * 1.2 - W * 0.1 + par, y * H + layer * H * 0.03));
    ctx.lineTo(W * 1.1, H * 1.1); ctx.closePath(); ctx.fill();
    if (snow && layer < 2) {
      // Kar başlıkları: sadece tepe noktalarında, sırt eğimini takip ederek
      ctx.fillStyle = layer ? 'rgba(225,232,245,0.55)' : 'rgba(240,245,255,0.8)';
      const P = pts.map(([x, y]) => [x * W * 1.2 - W * 0.1 + par, y * H + layer * H * 0.03]);
      for (let i = 1; i < P.length - 1; i++) {
        const [px, py] = P[i], [lx, ly] = P[i - 1], [rx, ry] = P[i + 1];
        if (!(py < ly && py < ry)) continue;
        const k = 0.28;
        const ax = px + (lx - px) * k, ay = py + (ly - py) * k, bx = px + (rx - px) * k, by = py + (ry - py) * k;
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(bx, by);
        ctx.lineTo(px + (bx - px) * 0.5, (ay + by) / 2 - (by - py) * 0.15);
        ctx.lineTo(px + (ax - px) * 0.3, (ay + by) / 2 + 2);
        ctx.lineTo(ax, ay); ctx.closePath(); ctx.fill();
      }
    }
  });
}

function drawEnvironment(ctx, W, H, scene, g, t, p) {
  const time = scene.time || 'dusk';
  const night = time === 'night';
  const horizonCol = (SKY[time] || SKY.dusk)[2];
  switch (scene.setting) {
    case 'space': {
      ctx.fillStyle = '#02030a'; ctx.fillRect(-W, -H, W * 3, H * 3);
      g.nebula.forEach(([x, y, r, c], i) => {
        const gr = ctx.createRadialGradient(x * W + Math.sin(t * 0.1 + i) * 20, y * H, 0, x * W, y * H, r * Math.max(W, H));
        gr.addColorStop(0, rgba(c, 0.35)); gr.addColorStop(1, rgba(c, 0));
        ctx.fillStyle = gr; ctx.fillRect(-W, -H, W * 3, H * 3);
      });
      stars(ctx, W, H * 1.4, g, t, 1.5);
      const P = g.planet, pr = P.r * Math.min(W, H) * 1.6, px = P.x * W, py = P.y * H + t * 0.8;
      const pg = ctx.createRadialGradient(px - pr * 0.4, py - pr * 0.4, pr * 0.1, px, py, pr);
      pg.addColorStop(0, mix(P.hue, '#ffffff', 0.35)); pg.addColorStop(0.7, P.hue); pg.addColorStop(1, '#05060c');
      ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(px, py, pr, 0, 7); ctx.fill();
      if (P.ring) { ctx.strokeStyle = 'rgba(230,220,200,0.45)'; ctx.lineWidth = pr * 0.06; ctx.beginPath(); ctx.ellipse(px, py, pr * 1.7, pr * 0.35, -0.3, 0, 7); ctx.stroke(); }
      break;
    }
    case 'city': {
      sky(ctx, W, H, time, 0.75);
      if (night) stars(ctx, W, H * 0.6, g, t, 0.5);
      celestial(ctx, W, H, time, t, 0.25, 0.22);
      g.buildings.forEach((layer, li) => {
        const base = H * (0.78 + li * 0.08);
        const col = li ? mix('#05070d', horizonCol, 0.08) : mix('#0d1220', horizonCol, 0.25);
        const par = Math.sin(t * 0.08) * (li + 1) * 6;
        layer.forEach((b) => {
          const bx = b.x * W + par, bw = b.w * W, bh = b.h * H, by = base - bh;
          ctx.fillStyle = col; ctx.fillRect(bx, by, bw, bh + H);
          if (b.antenna) { ctx.fillRect(bx + bw / 2 - 1, by - H * 0.04, 2, H * 0.04); }
          if (night || time === 'dusk') {
            const cols = Math.max(2, Math.floor(bw / 14)), rows = Math.floor(bh / 18);
            for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
              if (!b.wins[(r * cols + c) % 40]) continue;
              const flick = (r * 7 + c * 3 + Math.floor(t * 0.5)) % 23 === 0 ? 0.3 : 1;
              ctx.fillStyle = `rgba(255,${200 + (c % 3) * 15},120,${(li ? 0.55 : 0.35) * flick})`;
              ctx.fillRect(bx + 4 + c * (bw - 8) / cols, by + 8 + r * 18, Math.max(2, (bw - 8) / cols - 4), 8);
            }
          }
          if (b.neon && night) {
            ctx.shadowColor = b.neon; ctx.shadowBlur = 18; ctx.fillStyle = b.neon;
            ctx.fillRect(bx + bw * 0.2, by + bh * 0.25, bw * 0.6, 4 + 2 * Math.sin(t * 6));
            ctx.shadowBlur = 0;
          }
        });
      });
      // ıslak zemin yansıması
      const gr = ctx.createLinearGradient(0, H * 0.86, 0, H);
      gr.addColorStop(0, 'rgba(10,14,24,0.95)'); gr.addColorStop(1, '#030407');
      ctx.fillStyle = gr; ctx.fillRect(-W, H * 0.86, W * 3, H);
      break;
    }
    case 'forest': {
      sky(ctx, W, H, time, 0.7);
      if (night) stars(ctx, W, H * 0.5, g, t, 0.6);
      celestial(ctx, W, H, time, t, 0.65, 0.2);
      ridges(ctx, W, H, g, 0.6, mix('#1a2a2a', horizonCol, 0.4), '#0c1612', false, t);
      g.trees.forEach((layer, li) => {
        const col = mix('#0a120e', horizonCol, 0.3 - li * 0.13);
        ctx.fillStyle = col;
        const ground = H * (0.74 + li * 0.1);
        layer.forEach(([x, hgt, w]) => {
          const tx = x * W + Math.sin(t * 0.07) * (li + 1) * 5, th = hgt * H, tw = th * 0.28 * w;
          for (let k = 0; k < 4; k++) {
            const yk = ground - th + (k * th) / 4.2;
            ctx.beginPath(); ctx.moveTo(tx, yk - th * 0.12); ctx.lineTo(tx - tw * (0.4 + k * 0.2), yk + th * 0.25); ctx.lineTo(tx + tw * (0.4 + k * 0.2), yk + th * 0.25); ctx.fill();
          }
          ctx.fillRect(tx - 2, ground - 4, 4, H);
        });
        ctx.fillRect(-W, ground + 2, W * 3, H);
      });
      if (time === 'dawn' || time === 'day') godRays(ctx, W, H, t, 'rgba(255,230,180,0.08)');
      if (night) fireflies(ctx, W, H, g, t);
      break;
    }
    case 'ocean': {
      const hz = 0.56;
      sky(ctx, W, H, time, hz);
      if (night) stars(ctx, W, H * 0.5, g, t, 0.8);
      celestial(ctx, W, H, time, t, 0.62, 0.25);
      const wg = ctx.createLinearGradient(0, H * hz, 0, H);
      wg.addColorStop(0, mix('#0a1a2e', horizonCol, 0.35)); wg.addColorStop(1, '#02060c');
      ctx.fillStyle = wg; ctx.fillRect(-W, H * hz, W * 3, H);
      // ay/güneş yansıması
      if (time !== 'day') {
        for (let i = 0; i < 26; i++) {
          const y = H * hz + i * i * 0.9 + 4, w = (8 + i * 3) * (1 + 0.3 * Math.sin(t * 2 + i));
          ctx.fillStyle = `rgba(255,${night ? 240 : 200},${night ? 255 : 150},${0.32 - i * 0.011})`;
          ctx.fillRect(W * 0.62 - w / 2 + Math.sin(t * 1.5 + i) * 6, y, w, 2);
        }
      }
      ctx.strokeStyle = 'rgba(180,210,255,0.08)'; ctx.lineWidth = 1.5;
      for (let i = 0; i < 18; i++) {
        const y = H * hz + Math.pow(i / 18, 1.6) * H * 0.44 + 6;
        ctx.beginPath();
        for (let x = -20; x <= W + 20; x += 20) ctx.lineTo(x, y + Math.sin(x * 0.02 + t * (1 + i * 0.05) + i) * (1 + i * 0.25));
        ctx.stroke();
      }
      if (g.lighthouse) {
        const lx = W * 0.18, ly = H * hz;
        ctx.fillStyle = '#05070b';
        ctx.beginPath(); ctx.moveTo(lx - W * 0.12, ly + 6); ctx.quadraticCurveTo(lx, ly - H * 0.04, lx + W * 0.14, ly + 6); ctx.fill();
        ctx.beginPath(); ctx.moveTo(lx - W * 0.018, ly - H * 0.01); ctx.lineTo(lx - W * 0.012, ly - H * 0.2); ctx.lineTo(lx + W * 0.012, ly - H * 0.2); ctx.lineTo(lx + W * 0.018, ly - H * 0.01); ctx.fill();
        if (time !== 'day') {
          const ang = t * 0.9;
          ctx.save(); ctx.translate(lx, ly - H * 0.205); ctx.rotate(Math.sin(ang) * 0.9);
          const bg = ctx.createLinearGradient(0, 0, W * 1.1, 0);
          bg.addColorStop(0, 'rgba(255,240,190,0.45)'); bg.addColorStop(1, 'rgba(255,240,190,0)');
          ctx.fillStyle = bg; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(W * 1.1, -H * 0.05); ctx.lineTo(W * 1.1, H * 0.05); ctx.fill();
          ctx.restore();
          ctx.fillStyle = '#fff3c4'; ctx.beginPath(); ctx.arc(lx, ly - H * 0.205, 4, 0, 7); ctx.fill();
        }
      }
      break;
    }
    case 'desert': {
      sky(ctx, W, H, time, 0.62);
      if (night) stars(ctx, W, H * 0.55, g, t, 1);
      celestial(ctx, W, H, time, t, 0.5, 0.25);
      g.dunes.forEach(([peak, amp, f], i) => {
        const base = H * (0.6 + i * 0.12);
        ctx.fillStyle = mix(night ? '#1a1420' : '#c98a4b', '#140b06', 0.25 + i * 0.25);
        ctx.beginPath(); ctx.moveTo(-W * 0.1, H * 1.2);
        for (let x = -W * 0.1; x <= W * 1.1; x += 12) ctx.lineTo(x, base - Math.sin((x / W) * Math.PI * f + peak * 6 + t * 0.01) * amp * H - amp * H);
        ctx.lineTo(W * 1.1, H * 1.2); ctx.fill();
      });
      break;
    }
    case 'mountain': {
      sky(ctx, W, H, time, 0.65);
      if (night) stars(ctx, W, H * 0.5, g, t, 1);
      celestial(ctx, W, H, time, t, 0.3, 0.2);
      ridges(ctx, W, H, g, 0.5, mix('#3a4660', horizonCol, 0.45), '#121826', true, t);
      ctx.fillStyle = mix('#dfe6f0', '#0b0f18', night ? 0.75 : 0.25);
      ctx.fillRect(-W, H * 0.86, W * 3, H);
      break;
    }
    case 'village': {
      sky(ctx, W, H, time, 0.7);
      if (night) stars(ctx, W, H * 0.5, g, t, 0.8);
      celestial(ctx, W, H, time, t, 0.75, 0.22);
      ridges(ctx, W, H, g, 0.6, mix('#22303a', horizonCol, 0.4), '#0d1418', false, t);
      g.houses.forEach(([x, w, h, lit]) => {
        const bx = x * W, bw = w * W * 1.5, bh = h * H * 0.8, by = H * 0.8 - bh;
        ctx.fillStyle = '#0a0d12'; ctx.fillRect(bx, by, bw, bh + H);
        ctx.beginPath(); ctx.moveTo(bx - 6, by); ctx.lineTo(bx + bw / 2, by - bh * 0.6); ctx.lineTo(bx + bw + 6, by); ctx.fill();
        if (lit && time !== 'day') { ctx.fillStyle = 'rgba(255,190,90,0.85)'; ctx.fillRect(bx + bw * 0.35, by + bh * 0.3, bw * 0.3, bh * 0.25); }
        ctx.fillStyle = 'rgba(200,200,210,0.08)';
        for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.arc(bx + bw * 0.8 + Math.sin(t + k) * 6, by - bh * 0.7 - k * 14 - (t * 8) % 14, 6 + k * 2, 0, 7); ctx.fill(); }
      });
      ctx.fillStyle = '#07090c'; ctx.fillRect(-W, H * 0.8, W * 3, H);
      break;
    }
    case 'interior': {
      const wall = ctx.createLinearGradient(0, 0, 0, H);
      wall.addColorStop(0, '#120f14'); wall.addColorStop(1, '#241c1c');
      ctx.fillStyle = wall; ctx.fillRect(-W, -H, W * 3, H * 3);
      const wx = W * 0.56, wy = H * 0.18, ww = W * 0.3, wh = H * 0.34;
      ctx.save(); ctx.beginPath(); ctx.rect(wx, wy, ww, wh); ctx.clip();
      sky(ctx, W, H, time, 0.6); if (time === 'night') stars(ctx, W, H * 0.5, g, t, 0.4); celestial(ctx, W, H, time, t, 0.72, 0.28);
      ctx.restore();
      ctx.strokeStyle = '#0a0809'; ctx.lineWidth = 8; ctx.strokeRect(wx, wy, ww, wh);
      ctx.beginPath(); ctx.moveTo(wx + ww / 2, wy); ctx.lineTo(wx + ww / 2, wy + wh); ctx.moveTo(wx, wy + wh / 2); ctx.lineTo(wx + ww, wy + wh / 2); ctx.stroke();
      const lightCol = time === 'night' ? 'rgba(160,190,255,0.10)' : 'rgba(255,220,160,0.14)';
      ctx.fillStyle = lightCol;
      ctx.beginPath(); ctx.moveTo(wx, wy + wh); ctx.lineTo(wx + ww, wy + wh); ctx.lineTo(wx + ww * 0.6, H); ctx.lineTo(wx - ww * 0.9, H); ctx.fill();
      if (g.shelves) {
        ctx.fillStyle = '#0b090b';
        for (let s = 0; s < 5; s++) {
          const y = H * 0.2 + s * H * 0.12;
          ctx.fillRect(W * 0.04, y, W * 0.38, 6);
          for (let b = 0; b < 14; b++) {
            const bh2 = H * (0.05 + ((b * 37 + s * 11) % 7) * 0.006);
            ctx.fillStyle = ['#2b1d1a', '#1b2230', '#2d2a1a', '#221a2b'][(b + s) % 4];
            ctx.fillRect(W * 0.05 + b * W * 0.026, y - bh2, W * 0.022, bh2);
          }
          ctx.fillStyle = '#0b090b';
        }
      }
      ctx.fillStyle = '#0d0a0a'; ctx.fillRect(-W, H * 0.84, W * 3, H);
      dust(ctx, W, H, g, t, wx, wy, ww, wh);
      break;
    }
    default: { // abstract
      ctx.fillStyle = '#05050a'; ctx.fillRect(-W, -H, W * 3, H * 3);
      const cols = { mysterious: ['#5b3fa0', '#0e7c7b'], hopeful: ['#ffb347', '#ff5e62'], dark: ['#2b0a0a', '#101020'], warm: ['#ff8c42', '#c0392b'], epic: ['#ff6a00', '#1e3c72'], tense: ['#0e7c7b', '#ff4e00'], melancholic: ['#4a6b8a', '#1c2541'], calm: ['#4facfe', '#00f2fe'], energetic: ['#ff2e63', '#08d9d6'] }[scene.mood] || ['#5b3fa0', '#0e7c7b'];
      for (let i = 0; i < 6; i++) {
        const x = W * (0.5 + 0.35 * Math.sin(t * 0.21 + i * 1.7)), y = H * (0.5 + 0.3 * Math.cos(t * 0.17 + i * 2.1));
        const r = Math.max(W, H) * (0.35 + 0.1 * Math.sin(t * 0.3 + i));
        const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, rgba(cols[i % 2], 0.35)); gr.addColorStop(1, rgba(cols[i % 2], 0));
        ctx.fillStyle = gr; ctx.fillRect(-W, -H, W * 3, H * 3);
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      for (let i = 0; i < 12; i++) { ctx.beginPath(); for (let x = 0; x <= W; x += 16) ctx.lineTo(x, H * (i / 12) + Math.sin(x * 0.01 + t * 0.6 + i) * 18); ctx.stroke(); }
    }
  }
}

function godRays(ctx, W, H, t, col) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = col;
  for (let i = 0; i < 5; i++) {
    const x = W * (0.2 + i * 0.17) + Math.sin(t * 0.2 + i) * 20;
    ctx.beginPath(); ctx.moveTo(x, -H * 0.1); ctx.lineTo(x + W * 0.05, -H * 0.1); ctx.lineTo(x + W * 0.2, H); ctx.lineTo(x + W * 0.08, H); ctx.fill();
  }
  ctx.restore();
}
function fireflies(ctx, W, H, g, t) {
  for (let i = 0; i < 30; i++) {
    const [a, b, c, d] = g.particles[i];
    const x = W * (a + 0.03 * Math.sin(t * (0.5 + c) + d * 6)), y = H * (0.55 + b * 0.4 + 0.02 * Math.cos(t * (0.7 + d)));
    const al = 0.5 + 0.5 * Math.sin(t * 3 + i);
    ctx.fillStyle = `rgba(220,255,140,${al * 0.8})`; ctx.shadowColor = '#d4ff80'; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.arc(x, y, 2, 0, 7); ctx.fill();
  }
  ctx.shadowBlur = 0;
}
function dust(ctx, W, H, g, t, wx, wy, ww, wh) {
  for (let i = 0; i < 60; i++) {
    const [a, b, c] = g.particles[i];
    const x = wx - ww * 0.6 + (a * ww * 1.8 + t * 6 * (c - 0.5)) % (ww * 1.8);
    const y = wy + wh + ((b * (H - wy - wh)) + t * 4 * c) % (H - wy - wh);
    ctx.fillStyle = `rgba(255,235,200,${0.25 * c})`;
    ctx.fillRect(x, y, 2, 2);
  }
}

function drawWeather(ctx, W, H, scene, g, t) {
  const wthr = scene.weather;
  if (wthr === 'rain' || wthr === 'storm') {
    ctx.strokeStyle = 'rgba(180,200,230,0.28)'; ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let i = 0; i < g.particles.length; i++) {
      const [a, b, c] = g.particles[i];
      const sp = 900 + c * 600;
      const y = ((b * H + t * sp) % (H + 40)) - 20, x = (a * W * 1.2 - W * 0.1 + y * 0.18) % (W * 1.1);
      ctx.moveTo(x, y); ctx.lineTo(x - 5, y + 18 + c * 10);
    }
    ctx.stroke();
    if (wthr === 'storm') {
      for (const ft of g.flashes) {
        const d = t - ft;
        if (d > 0 && d < 0.35) { ctx.fillStyle = `rgba(220,230,255,${(0.35 - d) * 1.6 * (d < 0.08 || d > 0.15 ? 1 : 0.3)})`; ctx.fillRect(0, 0, W, H); }
      }
    }
  } else if (wthr === 'snow') {
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    for (let i = 0; i < 160; i++) {
      const [a, b, c, d] = g.particles[i];
      const y = (b * H + t * (40 + c * 50)) % H, x = (a * W + Math.sin(t * (0.5 + d) + i) * 20) % W;
      ctx.beginPath(); ctx.arc(x, y, 1 + c * 2.5, 0, 7); ctx.fill();
    }
  } else if (wthr === 'embers') {
    for (let i = 0; i < 90; i++) {
      const [a, b, c, d] = g.particles[i];
      const y = H - ((b * H + t * (40 + c * 80)) % H), x = a * W + Math.sin(t * (1 + d) + i) * 25;
      ctx.fillStyle = `rgba(255,${120 + c * 100},40,${0.5 + 0.5 * Math.sin(t * 5 + i)})`;
      ctx.fillRect(x, y, 2 + c * 2, 2 + c * 2);
    }
  }
  if (wthr === 'fog' || scene.mood === 'mysterious' || scene.mood === 'dark') {
    for (let i = 0; i < 4; i++) {
      const y = H * (0.45 + i * 0.13), x = ((t * (12 + i * 6)) % (W * 2)) - W;
      const fg = ctx.createLinearGradient(0, y - H * 0.1, 0, y + H * 0.1);
      const a = wthr === 'fog' ? 0.16 : 0.07;
      fg.addColorStop(0, 'rgba(200,210,230,0)'); fg.addColorStop(0.5, `rgba(200,210,230,${a})`); fg.addColorStop(1, 'rgba(200,210,230,0)');
      ctx.fillStyle = fg; ctx.fillRect(x, y - H * 0.1, W * 2, H * 0.2);
    }
  }
}

// Konuşan karakterin stilize silueti: yapı (ince/iri), yaş (boy), cinsiyet (saç), kişiliğe göre kenar ışığı.
function drawSilhouette(ctx, W, H, c, idx, alpha, scene, t) {
  const side = idx % 2 === 0 ? 0.24 : 0.76;
  const ageH = { child: 0.62, young: 0.95, adult: 1, elder: 0.92 }[c.age] || 1;
  const buildW = { slim: 0.8, average: 1, heavy: 1.3 }[c.build] || 1;
  const unit = H > W ? H * 0.5 : H * 0.78; // orta plan: ayaklar kadraj dışında
  const h = unit * ageH, w = unit * 0.36 * buildW;
  const cx = W * side, base = H * 1.12;
  const breathe = Math.sin(t * 2.2) * 2;
  const rim = { warm: '#ffb36b', cold: '#7fc8ff', anxious: '#d9f99d', authoritative: '#ff6b6b', cheerful: '#ffe066', mysterious: '#b392f0', wise: '#f6d38b', aggressive: '#ff4d4d', shy: '#ffc4dd', playful: '#7cf5c8', sad: '#8fa8c8', brave: '#ffcf70' }[(c.personality || [])[0]] || '#cfd8e8';
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#05060a';
  ctx.shadowColor = rim; ctx.shadowBlur = 22;
  const headR = h * 0.085, neckY = base - h * 0.78 + breathe;
  // gövde
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.5, base);
  ctx.quadraticCurveTo(cx - w * 0.55, neckY + h * 0.12, cx - w * 0.22, neckY + h * 0.03);
  ctx.lineTo(cx + w * 0.22, neckY + h * 0.03);
  ctx.quadraticCurveTo(cx + w * 0.55, neckY + h * 0.12, cx + w * 0.5, base);
  ctx.closePath(); ctx.fill();
  // boyun + baş
  ctx.fillRect(cx - headR * 0.4, neckY - headR * 0.5, headR * 0.8, headR * 0.8);
  ctx.beginPath(); ctx.ellipse(cx, neckY - headR * 1.2, headR, headR * 1.2, 0, 0, 7); ctx.fill();
  if (c.gender === 'female') {
    ctx.beginPath(); ctx.ellipse(cx, neckY - headR * 0.6, headR * 1.15, headR * 1.6, 0, 0, 7); ctx.fill();
  }
  if (c.age === 'elder') { ctx.fillRect(cx + w * 0.55, base - h * 0.5, 4, h * 0.5); }
  ctx.restore();
}

function grade(ctx, W, H, scene, t, real = false) {
  const [col, a0] = GRADE[scene.mood] || GRADE.calm;
  const a = real ? a0 * 0.35 : a0;
  t = Math.max(0, t);
  ctx.save();
  try {
    ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = rgba(col, Math.min(0.6, a * 2.2)); ctx.fillRect(0, 0, W, H);
    if (!real) { ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = rgba(col, a * 0.35); ctx.fillRect(0, 0, W, H); }
    ctx.globalCompositeOperation = 'source-over';
    const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.max(W, H) * 0.8);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, `rgba(0,0,0,${real ? 0.32 : 0.5})`);
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    const gs = grain();
    ctx.globalAlpha = real ? 0.22 : 0.5; ctx.globalCompositeOperation = 'overlay';
    const gi = gs[Math.floor(t * 24) % 3], ox = (t * 977) % 192, oy = (t * 613) % 192;
    ctx.fillStyle = ctx.createPattern(gi, 'repeat');
    ctx.translate(-ox, -oy); ctx.fillRect(ox, oy, W, H);
  } finally {
    ctx.restore();
  }
}

export function letterbox(ctx, W, H) {
  const target = W / 2.39;
  const bar = Math.max(0, (H - target) / 2);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, bar); ctx.fillRect(0, H - bar, W, bar);
}
