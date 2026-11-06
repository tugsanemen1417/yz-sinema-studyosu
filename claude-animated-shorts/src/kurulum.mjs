// Kurulum: doğal Türkçe ses modellerini (yaklaşık 160 MB) bir kereye mahsus indirir.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { MODEL_DIR, MODELS, hasVoices } from "./ses.mjs";

const URL = (m) => `https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-tr_TR-${m}-medium.tar.bz2`;

if (hasVoices()) { console.log("✅ Ses modelleri zaten kurulu."); process.exit(0); }
fs.mkdirSync(MODEL_DIR, { recursive: true });
for (const m of MODELS) {
  const file = path.join(MODEL_DIR, `${m}.tar.bz2`);
  console.log(`⬇️  "${m}" sesi indiriliyor...`);
  const res = await fetch(URL(m));
  if (!res.ok) { console.error(`❌ İndirilemedi (${res.status}): ${URL(m)}`); process.exit(1); }
  await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(file));
  const r = spawnSync("tar", ["xjf", file, "-C", MODEL_DIR], { stdio: "inherit" });
  fs.rmSync(file, { force: true });
  if (r.status !== 0) { console.error("❌ Arşiv açılamadı."); process.exit(1); }
}
console.log(hasVoices() ? "✅ Ses modelleri kuruldu." : "❌ Kurulum tamamlanamadı.");
