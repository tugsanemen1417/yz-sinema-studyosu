// Hikaye yazarı: verdiğiniz konuyu Claude'a gönderir, Claude kısa bir animasyon senaryosu yazar.
// Senaryo, çizim motorunun anlayacağı kurallara (schema.mjs) uygun bir JSON dosyası olarak kaydedilir.
// Kullanım: node src/hikaye.mjs "uçmayı öğrenen penguen" [--video]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { StorySchema, BACKGROUNDS, PROPS, SHAPES, MOODS, ACTIONS, CAMERAS } from "./schema.mjs";
import { renderVideo, writePreview } from "./video.mjs";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const MODEL = process.env.CLAUDE_MODEL || "claude-opus-5-5";

const SYSTEM = `Sen dikey (9:16) kısa animasyon videoları için senaryo yazan neşeli bir yazarsın.
Videolar Türkçe, 20-45 saniye uzunluğunda, çocuklara da uygun, sonu tatlı bir sürprizle veya küçük bir dersle biten hikayelerdir.

Çizim motoru sadece şu parçaları çizebilir, başka bir şey kullanma:
- Arka planlar: ${BACKGROUNDS.join(", ")}
- Nesneler: ${PROPS.join(", ")}
- Karakter şekilleri: ${SHAPES.join(", ")}
- Duygular: ${MOODS.join(", ")}
- Hareketler: ${ACTIONS.join(", ")}
- Kamera: ${CAMERAS.join(", ")}

Kurallar:
- Koordinatlar ekran yüzdesidir (0-100). Karakterlerin ayakları genelde y=70-82 arasında durur; x=15-85 arası güvenlidir.
- Gökteki nesneler (güneş, ay, bulut, yıldız) y=8-35 arasında; yerdekiler (ağaç, ev, çiçek, kaya) y=74-82 arasında olsun.
- Ekranın üst %20'si ilk 2.5 saniyede başlıkla kaplıdır; ilk sahnede konuşmayı 2.5. saniyeden sonra başlat.
- Konuşma balonları kısa olsun (en fazla 8 kelime) ve aynı anda en fazla bir balon görünsün.
- Her sahnede konuşmaların bit değeri sahne süresini aşmasın.
- Karakter renkleri canlı ve birbirinden farklı olsun (hex kodu).
- Hikayenin bir girişi, küçük bir sorunu ve mutlu bir çözümü olsun.`;

function slugify(s) {
  const map = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" };
  return s.toLowerCase().replace(/[çğıöşü]/g, (c) => map[c]).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "hikaye";
}

export async function writeStory(topic) {
  const client = new Anthropic();
  console.log(`✍️  Claude hikayeyi yazıyor: "${topic}" ...`);
  const msg = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: betaZodOutputFormat(StorySchema) },
    system: SYSTEM,
    messages: [{ role: "user", content: `Şu konuda kısa bir animasyon senaryosu yaz: ${topic}` }],
  });
  if (msg.stop_reason === "refusal") throw new Error("Claude bu konuyu yazmayı reddetti. Başka bir konu deneyin.");
  if (msg.stop_reason === "max_tokens") throw new Error("Cevap yarıda kesildi. Lütfen tekrar deneyin.");
  if (!msg.parsed_output) throw new Error("Claude'un cevabı okunamadı. Lütfen tekrar deneyin.");
  return msg.parsed_output;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const topic = args.filter((a) => !a.startsWith("--")).join(" ").trim();
  if (!topic) { console.log('Kullanım: npm run hikaye -- "konu"   veya   npm run uret -- "konu"'); process.exit(1); }
  try {
    const story = await writeStory(topic);
    fs.mkdirSync(path.join(ROOT, "hikayeler"), { recursive: true });
    fs.mkdirSync(path.join(ROOT, "cikti"), { recursive: true });
    const name = slugify(story.baslik || topic);
    const file = path.join(ROOT, "hikayeler", name + ".json");
    fs.writeFileSync(file, JSON.stringify(story, null, 2));
    console.log(`📜 Senaryo kaydedildi: ${file}`);
    writePreview(story, path.join(ROOT, "cikti", name + ".html"));
    if (args.includes("--video")) await renderVideo(story, path.join(ROOT, "cikti", name + ".mp4"));
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) console.error("❌ API anahtarı geçersiz. .env dosyasındaki ANTHROPIC_API_KEY'i kontrol edin.");
    else if (err instanceof Anthropic.RateLimitError) console.error("⏳ Çok sık istek gönderildi, biraz bekleyip tekrar deneyin.");
    else if (err instanceof Anthropic.APIError) console.error("❌ Claude API hatası:", err.message);
    else console.error("❌", err.message);
    process.exit(1);
  }
}
