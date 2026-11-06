// Çizim motoru: bir hikaye dosyasını alır, istenen saniyedeki kareyi tuval (canvas) üzerine çizer.
// Hem tarayıcıda önizleme için hem de video kaydı sırasında kullanılır.
(function () {
  const W = 1080, H = 1920;
  const TITLE_SECONDS = 2.5, FADE = 0.35;

  // ---------- yardımcılar ----------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const px = (x) => (clamp(x, -20, 120) / 100) * W;
  const py = (y) => (clamp(y, -20, 120) / 100) * H;
  const rand = (seed) => { const s = Math.sin(seed * 9301 + 49297) * 233280; return s - Math.floor(s); };

  function shade(hex, amt) {
    let c = String(hex || "#888").replace("#", "");
    if (c.length === 3) c = c.split("").map((ch) => ch + ch).join("");
    const n = parseInt(c, 16);
    if (Number.isNaN(n)) return hex;
    const r = clamp(((n >> 16) & 255) + amt, 0, 255), g = clamp(((n >> 8) & 255) + amt, 0, 255), b = clamp((n & 255) + amt, 0, 255);
    return `rgb(${r},${g},${b})`;
  }
  function vgrad(ctx, top, bottom, y0 = 0, y1 = H) {
    const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, top); g.addColorStop(1, bottom); return g;
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function wrap(ctx, text, maxW) {
    const words = String(text).split(/\s+/); const lines = []; let line = "";
    for (const w of words) { const test = line ? line + " " + w : w; if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test; }
    if (line) lines.push(line); return lines;
  }

  // ---------- arka planlar ----------
  function ground(ctx, color, y = 0.78) {
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, H * y);
    for (let x = 0; x <= W; x += 60) ctx.lineTo(x, H * y + Math.sin(x / 140) * 18);
    ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
  }
  function starsField(ctx, t, n, seed) {
    for (let i = 0; i < n; i++) {
      const x = rand(i + seed) * W, y = rand(i * 3 + seed) * H * 0.7, tw = 0.5 + 0.5 * Math.sin(t * 2 + i);
      ctx.fillStyle = `rgba(255,255,255,${0.3 + 0.7 * tw})`; ctx.beginPath(); ctx.arc(x, y, 2 + rand(i * 7) * 3, 0, Math.PI * 2); ctx.fill();
    }
  }
  const BG = {
    gunduz(ctx) { ctx.fillStyle = vgrad(ctx, "#6ec6ff", "#e3f6ff"); ctx.fillRect(0, 0, W, H); ground(ctx, "#7ccf6a"); },
    gece(ctx, t) { ctx.fillStyle = vgrad(ctx, "#0b1340", "#2d3478"); ctx.fillRect(0, 0, W, H); starsField(ctx, t, 70, 1); ground(ctx, "#1e3b2e"); },
    orman(ctx, t) {
      ctx.fillStyle = vgrad(ctx, "#9ee0c4", "#e8fff4"); ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 7; i++) drawProp(ctx, "agac", 60 + i * 160, H * 0.74, 1.3 + rand(i) * 0.5, t, "#2f8f5b");
      ground(ctx, "#4fae63");
    },
    deniz(ctx, t) {
      ctx.fillStyle = vgrad(ctx, "#7fd3ff", "#d9f3ff"); ctx.fillRect(0, 0, W, H);
      for (let k = 0; k < 4; k++) {
        ctx.fillStyle = ["#2a8bd6", "#2379c0", "#1c69a8", "#155a92"][k]; ctx.beginPath(); const base = H * (0.62 + k * 0.08);
        ctx.moveTo(0, base); for (let x = 0; x <= W; x += 30) ctx.lineTo(x, base + Math.sin(x / 90 + t * 2 + k) * 16);
        ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.fill();
      }
    },
    sehir(ctx) {
      ctx.fillStyle = vgrad(ctx, "#ff9a8b", "#ffd7a8"); ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 9; i++) {
        const bw = 100 + rand(i) * 70, bh = 350 + rand(i + 5) * 600, x = i * 125 - 20, y = H * 0.8 - bh;
        ctx.fillStyle = shade("#4a3f6b", -i * 3); ctx.fillRect(x, y, bw, bh);
        ctx.fillStyle = "#ffe08a";
        for (let wy = y + 30; wy < H * 0.78 - 40; wy += 70) for (let wx = x + 18; wx < x + bw - 30; wx += 40) if (rand(wx * wy) > 0.45) ctx.fillRect(wx, wy, 18, 28);
      }
      ctx.fillStyle = "#3a3a4a"; ctx.fillRect(0, H * 0.8, W, H * 0.2);
    },
    oda(ctx) {
      ctx.fillStyle = "#f6e2c4"; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#d9a86c"; ctx.fillRect(0, H * 0.74, W, H * 0.26);
      ctx.fillStyle = "#87ceeb"; roundRect(ctx, W * 0.6, H * 0.18, 300, 360, 20); ctx.fill();
      ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 16; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(W * 0.6 + 150, H * 0.18); ctx.lineTo(W * 0.6 + 150, H * 0.18 + 360); ctx.moveTo(W * 0.6, H * 0.18 + 180); ctx.lineTo(W * 0.6 + 300, H * 0.18 + 180); ctx.stroke();
    },
    uzay(ctx, t) {
      ctx.fillStyle = vgrad(ctx, "#05010f", "#2a0f4f"); ctx.fillRect(0, 0, W, H); starsField(ctx, t, 140, 9);
      ctx.fillStyle = "#c46bff"; ctx.beginPath(); ctx.arc(W * 0.8, H * 0.2, 130, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#ffd36b"; ctx.lineWidth = 10; ctx.beginPath(); ctx.ellipse(W * 0.8, H * 0.2, 220, 50, -0.3, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = "#8a8aa3"; ctx.beginPath(); ctx.ellipse(W / 2, H * 1.05, W, H * 0.3, 0, 0, Math.PI * 2); ctx.fill();
    },
    col(ctx) {
      ctx.fillStyle = vgrad(ctx, "#ffb347", "#ffe7b0"); ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#e9b26b"; ctx.beginPath(); ctx.ellipse(W * 0.2, H * 0.85, 700, 260, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#f2c47f"; ctx.beginPath(); ctx.ellipse(W * 0.9, H * 0.9, 700, 280, 0, 0, Math.PI * 2); ctx.fill();
    },
    kar(ctx, t) {
      ctx.fillStyle = vgrad(ctx, "#a9c4e0", "#eef4fb"); ctx.fillRect(0, 0, W, H); ground(ctx, "#ffffff");
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      for (let i = 0; i < 80; i++) { const x = (rand(i) * W + Math.sin(t + i) * 30) % W, y = (rand(i * 5) * H + t * (60 + rand(i) * 80)) % H; ctx.beginPath(); ctx.arc(x, y, 4 + rand(i * 2) * 5, 0, Math.PI * 2); ctx.fill(); }
    },
  };

  // ---------- nesneler ----------
  function drawProp(ctx, type, x, y, s, t, colorOverride) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    switch (type) {
      case "gunes":
        ctx.rotate(t * 0.3); ctx.strokeStyle = "#ffcc33"; ctx.lineWidth = 12;
        for (let i = 0; i < 12; i++) { ctx.rotate(Math.PI / 6); ctx.beginPath(); ctx.moveTo(0, 95); ctx.lineTo(0, 135); ctx.stroke(); }
        ctx.fillStyle = "#ffd84d"; ctx.beginPath(); ctx.arc(0, 0, 80, 0, Math.PI * 2); ctx.fill(); break;
      case "ay":
        ctx.fillStyle = "#fff6c8"; ctx.beginPath(); ctx.arc(0, 0, 80, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgba(0,0,0,0.08)"; ctx.beginPath(); ctx.arc(-20, -15, 15, 0, Math.PI * 2); ctx.arc(25, 20, 10, 0, Math.PI * 2); ctx.fill(); break;
      case "bulut":
        ctx.translate(Math.sin(t * 0.5 + x) * 30, 0); ctx.fillStyle = "rgba(255,255,255,0.95)"; ctx.beginPath();
        ctx.arc(-70, 10, 55, 0, Math.PI * 2); ctx.arc(0, -15, 75, 0, Math.PI * 2); ctx.arc(75, 10, 55, 0, Math.PI * 2); ctx.fill(); break;
      case "agac":
        ctx.fillStyle = "#8b5a2b"; ctx.fillRect(-18, -120, 36, 120);
        ctx.fillStyle = colorOverride || "#3cae5c"; ctx.beginPath(); ctx.arc(0, -170, 85, 0, Math.PI * 2); ctx.arc(-55, -130, 60, 0, Math.PI * 2); ctx.arc(55, -130, 60, 0, Math.PI * 2); ctx.fill(); break;
      case "ev":
        ctx.fillStyle = "#ffe0b3"; ctx.fillRect(-120, -180, 240, 180);
        ctx.fillStyle = "#d9534f"; ctx.beginPath(); ctx.moveTo(-150, -175); ctx.lineTo(0, -300); ctx.lineTo(150, -175); ctx.fill();
        ctx.fillStyle = "#8b5a2b"; ctx.fillRect(-30, -100, 60, 100); ctx.fillStyle = "#87ceeb"; ctx.fillRect(50, -150, 50, 50); ctx.fillRect(-100, -150, 50, 50); break;
      case "yildiz": {
        const p = 1 + 0.15 * Math.sin(t * 4 + x); ctx.scale(p, p); ctx.fillStyle = "#ffe14d"; ctx.beginPath();
        for (let i = 0; i < 10; i++) { const r = i % 2 ? 22 : 55, a = (i * Math.PI) / 5 - Math.PI / 2; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
        ctx.closePath(); ctx.fill(); break;
      }
      case "kalp": {
        const p = 1 + 0.12 * Math.abs(Math.sin(t * 3)); ctx.scale(p, p); ctx.fillStyle = "#ff4d6d"; ctx.beginPath();
        ctx.moveTo(0, 40); ctx.bezierCurveTo(-90, -20, -40, -90, 0, -45); ctx.bezierCurveTo(40, -90, 90, -20, 0, 40); ctx.fill(); break;
      }
      case "cicek":
        ctx.strokeStyle = "#3a9d4a"; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -90); ctx.stroke();
        ctx.translate(0, -100); ctx.rotate(Math.sin(t * 2 + x) * 0.15); ctx.fillStyle = "#ff7eb6";
        for (let i = 0; i < 6; i++) { ctx.rotate(Math.PI / 3); ctx.beginPath(); ctx.ellipse(0, 25, 16, 26, 0, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = "#ffd84d"; ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.fill(); break;
      case "dag":
        ctx.fillStyle = "#7a8ca8"; ctx.beginPath(); ctx.moveTo(-260, 0); ctx.lineTo(0, -380); ctx.lineTo(260, 0); ctx.fill();
        ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.moveTo(-70, -280); ctx.lineTo(0, -380); ctx.lineTo(70, -280); ctx.lineTo(25, -300); ctx.lineTo(0, -270); ctx.lineTo(-30, -300); ctx.fill(); break;
      case "kaya":
        ctx.fillStyle = "#8d8d99"; ctx.beginPath(); ctx.ellipse(0, -40, 90, 55, 0, 0, Math.PI * 2); ctx.fill(); break;
      case "balon":
        ctx.translate(0, Math.sin(t * 1.5 + x) * 20); ctx.strokeStyle = "#555"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 60); ctx.quadraticCurveTo(15, 120, 0, 180); ctx.stroke();
        ctx.fillStyle = "#ff5c8a"; ctx.beginPath(); ctx.ellipse(0, 0, 55, 68, 0, 0, Math.PI * 2); ctx.fill(); break;
      case "hediye":
        ctx.fillStyle = "#4dabf7"; ctx.fillRect(-70, -120, 140, 120); ctx.fillStyle = "#ffd43b"; ctx.fillRect(-12, -120, 24, 120); ctx.fillRect(-70, -72, 140, 24);
        ctx.beginPath(); ctx.ellipse(-25, -132, 25, 14, -0.4, 0, Math.PI * 2); ctx.ellipse(25, -132, 25, 14, 0.4, 0, Math.PI * 2); ctx.fill(); break;
    }
    ctx.restore();
  }

  // ---------- karakterler ----------
  function drawFace(ctx, mood, talking, t, eyeY, kind) {
    const blink = (t % 3.2) < 0.12 || mood === "uykulu";
    ctx.fillStyle = "#222";
    for (const ex of [-28, 28]) {
      if (kind === "robot") { ctx.fillStyle = "#7df9ff"; ctx.fillRect(ex - 16, eyeY - (blink ? 3 : 16), 32, blink ? 6 : 32); continue; }
      if (blink) { ctx.fillRect(ex - 14, eyeY - 2, 28, 5); continue; }
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(ex, eyeY, 17, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#222"; ctx.beginPath(); ctx.arc(ex + 3, eyeY + 2, mood === "saskin" ? 6 : 9, 0, Math.PI * 2); ctx.fill();
    }
    if (mood === "kizgin") { ctx.strokeStyle = "#222"; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-45, eyeY - 30); ctx.lineTo(-15, eyeY - 20); ctx.moveTo(45, eyeY - 30); ctx.lineTo(15, eyeY - 20); ctx.stroke(); }
    const my = eyeY + 42; ctx.strokeStyle = "#222"; ctx.fillStyle = "#7a1f2b"; ctx.lineWidth = 6;
    if (talking) { const o = 6 + Math.abs(Math.sin(t * 16)) * 14; ctx.beginPath(); ctx.ellipse(0, my, 18, o, 0, 0, Math.PI * 2); ctx.fill(); return; }
    ctx.beginPath();
    if (mood === "mutlu") ctx.arc(0, my - 12, 22, 0.15 * Math.PI, 0.85 * Math.PI);
    else if (mood === "uzgun") ctx.arc(0, my + 14, 20, 1.15 * Math.PI, 1.85 * Math.PI);
    else if (mood === "saskin") { ctx.arc(0, my, 12, 0, Math.PI * 2); ctx.fill(); return; }
    else { ctx.moveTo(-16, my); ctx.lineTo(16, my); }
    ctx.stroke();
  }

  function drawCharacter(ctx, ch, a, t, talking) {
    const color = ch.renk || "#ff8a3d", kind = ch.sekil || "top";
    ctx.fillStyle = color; ctx.strokeStyle = shade(color, -60); ctx.lineWidth = 6;
    // kulaklar / ekler (gövdenin arkasında)
    if (kind === "kedi") { for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * 30, -170); ctx.lineTo(s * 85, -235); ctx.lineTo(s * 95, -130); ctx.fill(); ctx.stroke(); } }
    if (kind === "tavsan") { for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * 38, -250, 22, 75, s * 0.15 + Math.sin(t * 3) * 0.05 * s, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); } }
    if (kind === "ayi") { for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(s * 72, -180, 32, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); } }
    if (kind === "kedi") { ctx.beginPath(); ctx.moveTo(85, -40); ctx.quadraticCurveTo(170, -60 + Math.sin(t * 4) * 30, 140, -160); ctx.stroke(); }
    if (kind === "robot") { ctx.beginPath(); ctx.moveTo(0, -190); ctx.lineTo(0, -240); ctx.stroke(); ctx.fillStyle = (t % 1) < 0.5 ? "#ff4d4d" : "#ffb3b3"; ctx.beginPath(); ctx.arc(0, -248, 14, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = color; }

    // kollar
    const waving = a.hareket === "el_salla";
    ctx.lineWidth = 16; ctx.lineCap = "round"; ctx.strokeStyle = shade(color, -40);
    if (kind !== "kus") {
      ctx.beginPath(); ctx.moveTo(-85, -90); ctx.lineTo(-125, -40 + Math.sin(t * 6) * (a.hareket === "dans" ? 30 : 4)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(85, -90);
      if (waving) { const ang = -1.2 + Math.sin(t * 10) * 0.5; ctx.lineTo(85 + Math.cos(ang) * 75, -90 + Math.sin(ang) * 75); }
      else ctx.lineTo(125, -40 + Math.sin(t * 6 + 1) * (a.hareket === "dans" ? 30 : 4));
      ctx.stroke();
    }
    ctx.lineCap = "butt";

    // gövde
    ctx.fillStyle = color; ctx.strokeStyle = shade(color, -60); ctx.lineWidth = 6;
    if (kind === "robot") { roundRect(ctx, -95, -190, 190, 190, 28); ctx.fill(); ctx.stroke(); ctx.fillStyle = shade(color, 40); roundRect(ctx, -50, -70, 100, 50, 10); ctx.fill(); }
    else { ctx.beginPath(); ctx.ellipse(0, -95, 100, 100, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = shade(color, 45); ctx.beginPath(); ctx.ellipse(0, -55, 55, 40, 0, 0, Math.PI * 2); ctx.fill(); }
    if (kind === "kus") {
      const flap = Math.sin(t * (a.hareket === "zipla" || a.hareket === "yuru" ? 18 : 5)) * 0.5;
      ctx.fillStyle = shade(color, -30);
      for (const s of [-1, 1]) { ctx.save(); ctx.translate(s * 90, -100); ctx.rotate(s * (0.4 + flap)); ctx.beginPath(); ctx.ellipse(s * 30, 0, 45, 22, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
      ctx.fillStyle = "#ffb000"; ctx.beginPath(); ctx.moveTo(-14, -105); ctx.lineTo(14, -105); ctx.lineTo(0, -80); ctx.fill();
    }
    if (kind === "ayi" || kind === "tavsan") { ctx.fillStyle = "#ffb3c1"; for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(s * 55, -95, 12, 0, Math.PI * 2); ctx.fill(); } }
    if (kind === "kedi") { ctx.strokeStyle = "#333"; ctx.lineWidth = 3; for (const s of [-1, 1]) for (const d of [-8, 8]) { ctx.beginPath(); ctx.moveTo(s * 40, -88 + d); ctx.lineTo(s * 95, -92 + d * 2); ctx.stroke(); } }

    // ayaklar
    ctx.fillStyle = shade(color, -50);
    const step = a.hareket === "yuru" ? Math.sin(t * 10) * 14 : 0;
    ctx.beginPath(); ctx.ellipse(-40, -2 - Math.max(0, step), 30, 14, 0, 0, Math.PI * 2); ctx.ellipse(40, -2 - Math.max(0, -step), 30, 14, 0, 0, Math.PI * 2); ctx.fill();

    drawFace(ctx, a.duygu, talking, t, kind === "robot" ? -130 : -125, kind);
    if (a.duygu === "uykulu") { ctx.fillStyle = "#334"; ctx.font = "bold 50px sans-serif"; ctx.fillText("z", 100, -200 - (t * 30) % 60); ctx.font = "bold 36px sans-serif"; ctx.fillText("z", 140, -250 - (t * 30) % 60); }
    if (a.duygu === "uzgun") { ctx.fillStyle = "#6ec6ff"; ctx.beginPath(); ctx.ellipse(-30, -100 + ((t * 80) % 60), 7, 11, 0, 0, Math.PI * 2); ctx.fill(); }
  }

  function actorTransform(a, sceneT, sceneDur) {
    const p = ease(clamp(sceneT / Math.max(0.1, sceneDur), 0, 1));
    const b = a.baslangic || { x: 50, y: 75 }, e = a.bitis || b;
    const x = px(b.x + (e.x - b.x) * p), y = py(b.y + (e.y - b.y) * p);
    const t = sceneT; let dy = 0, rot = 0, sx = 1, sy = 1, dx = 0;
    switch (a.hareket) {
      case "yuru": dy = -Math.abs(Math.sin(t * 10)) * 18; rot = Math.sin(t * 10) * 0.05; break;
      case "zipla": { const h = Math.abs(Math.sin(t * 4)); dy = -h * 160; sy = 1 + (1 - h) * 0.06 * Math.sin(t * 8); break; }
      case "don": sx = Math.cos(t * 5); break;
      case "titre": dx = Math.sin(t * 50) * 8; break;
      case "dans": rot = Math.sin(t * 5) * 0.2; dy = -Math.abs(Math.sin(t * 5)) * 40; break;
      default: sy = 1 + Math.sin(t * 2.5) * 0.025; sx = 1 - Math.sin(t * 2.5) * 0.015;
    }
    const facing = e.x < b.x ? -1 : 1;
    const size = clamp(a.boyut || 1, 0.3, 3) * 1.1;
    return { x: x + dx, y: y + dy, rot, sx: sx * facing, sy, size, headX: x + dx, headY: y + dy - 260 * size * sy };
  }

  // ---------- konuşma balonu ve yazılar ----------
  function bubble(ctx, text, ax, ay, alpha) {
    ctx.save(); ctx.globalAlpha = alpha; ctx.font = "bold 52px 'Trebuchet MS', sans-serif";
    const lines = wrap(ctx, text, 620); const lh = 64; const w = Math.min(700, Math.max(...lines.map((l) => ctx.measureText(l).width)) + 70); const h = lines.length * lh + 50;
    let bx = clamp(ax - w / 2, 30, W - w - 30), by = clamp(ay - h - 50, 40, H - h - 40);
    ctx.fillStyle = "#fff"; ctx.strokeStyle = "#222"; ctx.lineWidth = 6;
    roundRect(ctx, bx, by, w, h, 36); ctx.fill(); ctx.stroke();
    const tx = clamp(ax, bx + 50, bx + w - 50);
    ctx.beginPath(); ctx.moveTo(tx - 22, by + h - 3); ctx.lineTo(tx, by + h + 40); ctx.lineTo(tx + 22, by + h - 3); ctx.fill();
    ctx.beginPath(); ctx.moveTo(tx - 22, by + h); ctx.lineTo(tx, by + h + 40); ctx.lineTo(tx + 22, by + h); ctx.stroke();
    ctx.fillStyle = "#222"; ctx.textAlign = "center"; ctx.textBaseline = "top";
    lines.forEach((l, i) => ctx.fillText(l, bx + w / 2, by + 25 + i * lh));
    ctx.restore();
  }
  function caption(ctx, text, alpha) {
    if (!text) return;
    ctx.save(); ctx.globalAlpha = alpha; ctx.font = "bold 58px 'Trebuchet MS', sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "top";
    const lines = wrap(ctx, text, W - 160); const lh = 72; const h = lines.length * lh + 50; const y = H - h - 140;
    ctx.fillStyle = "rgba(0,0,0,0.55)"; roundRect(ctx, 50, y, W - 100, h, 30); ctx.fill();
    ctx.fillStyle = "#fff"; lines.forEach((l, i) => ctx.fillText(l, W / 2, y + 25 + i * lh));
    ctx.restore();
  }
  function titleCard(ctx, text, alpha) {
    ctx.save(); ctx.globalAlpha = alpha; ctx.font = "900 92px 'Trebuchet MS', sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "top";
    const lines = wrap(ctx, text, W - 160); const lh = 108; const h = lines.length * lh + 70; const y = 170;
    ctx.fillStyle = "rgba(255,255,255,0.9)"; roundRect(ctx, 60, y, W - 120, h, 40); ctx.fill();
    ctx.fillStyle = "#2b2d42"; lines.forEach((l, i) => ctx.fillText(l, W / 2, y + 35 + i * lh));
    ctx.restore();
  }

  // ---------- ana çizim ----------
  let story = null, starts = [], total = 0;
  function load(s) {
    story = s; starts = []; total = 0;
    for (const sc of s.sahneler) { starts.push(total); total += clamp(Number(sc.sure) || 4, 1, 30); }
    return total;
  }
  function renderFrame(ctx, t) {
    if (!story) return;
    let i = starts.length - 1; while (i > 0 && t < starts[i]) i--;
    const sc = story.sahneler[i]; const dur = clamp(Number(sc.sure) || 4, 1, 30); const st = t - starts[i];
    const chars = Object.fromEntries((story.karakterler || []).map((c) => [c.id, c]));

    // kamera
    const p = ease(clamp(st / dur, 0, 1)); let zoom = 1, ox = 0;
    if (sc.kamera === "yaklas") zoom = 1 + 0.25 * p; else if (sc.kamera === "uzaklas") zoom = 1.25 - 0.25 * p;
    else if (sc.kamera === "sola_kay") { zoom = 1.15; ox = 70 - 140 * p; } else if (sc.kamera === "saga_kay") { zoom = 1.15; ox = -70 + 140 * p; }
    const cam = (x, y) => [(x - W / 2) * zoom + W / 2 + ox, (y - H / 2) * zoom + H / 2];

    ctx.save(); ctx.setTransform(zoom, 0, 0, zoom, W / 2 - zoom * W / 2 + ox, H / 2 - zoom * H / 2);
    (BG[sc.arkaplan] || BG.gunduz)(ctx, t);
    for (const n of sc.nesneler || []) drawProp(ctx, n.tur, px(n.x), py(n.y), clamp(n.boyut || 1, 0.2, 4), t);

    const talkingNow = new Set((sc.konusmalar || []).filter((k) => st >= k.bas && st <= k.bit).map((k) => k.karakter));
    const placed = {};
    const actors = [...(sc.oyuncular || [])].sort((a, b) => (a.baslangic?.y || 0) - (b.baslangic?.y || 0));
    for (const a of actors) {
      const ch = chars[a.karakter] || { renk: "#999", sekil: "top" }; const tr = actorTransform(a, st, dur);
      placed[a.karakter] = tr;
      ctx.fillStyle = "rgba(0,0,0,0.15)"; ctx.beginPath(); ctx.ellipse(tr.x, py((a.baslangic.y + (a.bitis.y - a.baslangic.y) * p)), 90 * tr.size, 18 * tr.size, 0, 0, Math.PI * 2); ctx.fill();
      ctx.save(); ctx.translate(tr.x, tr.y); ctx.rotate(tr.rot); ctx.scale(tr.size * tr.sx, tr.size * tr.sy);
      drawCharacter(ctx, ch, a, st, talkingNow.has(a.karakter)); ctx.restore();
    }
    ctx.restore();

    // ekran yazıları (kamera etkilemez)
    for (const k of sc.konusmalar || []) {
      if (st < k.bas || st > k.bit) continue; const tr = placed[k.karakter]; if (!tr) continue;
      const [ax, ay] = cam(tr.headX, tr.headY); const fade = clamp(Math.min(st - k.bas, k.bit - st) / 0.2, 0, 1);
      bubble(ctx, k.metin, ax, ay, fade);
    }
    caption(ctx, sc.anlatim, clamp(Math.min(st, dur - st) / 0.3, 0, 1));
    if (t < TITLE_SECONDS) titleCard(ctx, story.baslik, clamp((TITLE_SECONDS - t) / 0.5, 0, 1));

    // sahne geçişi: siyaha kararma
    const edge = Math.min(st, dur - st); if (edge < FADE && !(i === 0 && st < dur / 2)) { ctx.fillStyle = `rgba(0,0,0,${1 - edge / FADE})`; ctx.fillRect(0, 0, W, H); }
  }

  window.ShortPlayer = { W, H, load, renderFrame };
})();
