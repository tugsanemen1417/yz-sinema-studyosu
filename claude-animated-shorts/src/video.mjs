// Video kaydedici: hikaye dosyasını açar, her kareyi görünmez bir tarayıcıda çizer
// ve ffmpeg ile dikey (1080x1920) MP4 videoya çevirir.
// Kullanım: node src/video.mjs hikayeler/ornek.json
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import os from "node:os";
import { StorySchema } from "./schema.mjs";
import { hasVoices, voiceStory, buildSoundtrack } from "./ses.mjs";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const FPS = Number(process.env.FPS || 30);

export function loadStory(file) {
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  const res = StorySchema.safeParse(raw);
  if (!res.success) {
    console.error("❌ Hikaye dosyasında hata var:\n" + res.error.issues.map((i) => ` - ${i.path.join(".")}: ${i.message}`).join("\n"));
    process.exit(1);
  }
  return res.data;
}

export function writePreview(story, outHtml) {
  const html = fs.readFileSync(path.join(ROOT, "player/index.html"), "utf8")
    .replace('<script src="oynatici.js"></script>',
      `<script>window.STORY = ${JSON.stringify(story).replace(/</g, "\\u003c")};</script>\n<script>${fs.readFileSync(path.join(ROOT, "player/oynatici.js"), "utf8")}</script>`);
  fs.writeFileSync(outHtml, html);
}

export async function renderVideo(story, outMp4, { sessiz = false } = {}) {
  // 1) Ses: seslendir, zamanlamayı ayarla, müzik ve efektleri karıştır
  let audioArgs = ["-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo"];
  let wav = null;
  if (!sessiz) {
    let clips = [], total = story.sahneler.reduce((a, s) => a + s.sure, 0);
    if (hasVoices()) {
      console.log("🎙️  Karakterler seslendiriliyor...");
      ({ story, clips, total } = voiceStory(story));
    } else console.warn("⚠️  Ses modelleri bulunamadı: önce `npm run kurulum` çalıştırın. Şimdilik sadece müzik eklenecek.");
    console.log("🎵 Müzik ve efektler hazırlanıyor...");
    wav = path.join(os.tmpdir(), `shorts-${process.pid}.wav`);
    buildSoundtrack(story, clips, total, wav);
    audioArgs = ["-i", wav];
  }

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  await page.setContent(`<canvas id="c" width="1080" height="1920"></canvas>`);
  await page.addScriptTag({ path: path.join(ROOT, "player/oynatici.js") });
  const total = await page.evaluate((s) => { window.__ctx = document.getElementById("c").getContext("2d"); return ShortPlayer.load(s); }, story);
  const frames = Math.ceil(total * FPS);

  const ff = spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-",
    ...audioArgs, "-t", String(total),
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "medium", "-crf", "20",
    "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-c:a", "aac", "-b:a", "192k", "-ar", "44100", "-movflags", "+faststart", outMp4],
    { stdio: ["pipe", "inherit", "inherit"] });
  const done = new Promise((ok, fail) => ff.on("close", (c) => (c === 0 ? ok() : fail(new Error("ffmpeg hata kodu " + c)))));

  for (let f = 0; f < frames; f++) {
    const b64 = await page.evaluate((t) => { ShortPlayer.renderFrame(window.__ctx, t); return document.getElementById("c").toDataURL("image/jpeg", 0.92).split(",")[1]; }, f / FPS);
    if (!ff.stdin.write(Buffer.from(b64, "base64"))) await new Promise((r) => ff.stdin.once("drain", r));
    if (f % FPS === 0) process.stdout.write(`\r🎬 Kare ${f}/${frames} (%${Math.round((f / frames) * 100)})`);
  }
  ff.stdin.end(); await done; await browser.close();
  if (wav) fs.rmSync(wav, { force: true });
  writeExtras(story, outMp4);
  process.stdout.write(`\r✅ Video hazır: ${outMp4} (${total.toFixed(1)} sn)            \n`);
}

// Paylaşım paketi: kapak resmi + başlık/açıklama/etiket metni
function writeExtras(story, outMp4) {
  const base = outMp4.replace(/\.mp4$/, "");
  spawn("ffmpeg", ["-y", "-loglevel", "error", "-ss", "1.2", "-i", outMp4, "-frames:v", "1", "-q:v", "2", base + "-kapak.jpg"], { stdio: "ignore" });
  const names = story.karakterler.map((c) => c.isim).join(", ");
  const tags = ["#shorts", "#animasyon", "#çizgifilm", "#masal", "#çocuk", ...story.karakterler.map((c) => "#" + c.isim.toLocaleLowerCase("tr").replace(/\s+/g, ""))];
  const ozet = story.sahneler.map((s) => s.anlatim).filter(Boolean).join(" ");
  fs.writeFileSync(base + "-paylasim.txt",
    `BAŞLIK:\n${story.baslik} 🎬\n\nAÇIKLAMA:\n${ozet}\n\nKarakterler: ${names}\n\n${tags.join(" ")}\n`);
}

// Komut satırından çağrıldıysa
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const file = process.argv[2];
  if (!file) { console.log("Kullanım: npm run video -- hikayeler/dosya.json"); process.exit(1); }
  const story = loadStory(file);
  fs.mkdirSync(path.join(ROOT, "cikti"), { recursive: true });
  const base = path.join(ROOT, "cikti", path.basename(file, ".json"));
  writePreview(story, base + ".html");
  if (process.argv.includes("--sadece-onizleme")) { console.log("👀 Önizleme hazır: " + base + ".html (tarayıcıda açın)"); }
  else await renderVideo(story, base + ".mp4", { sessiz: process.argv.includes("--sessiz") });
}
