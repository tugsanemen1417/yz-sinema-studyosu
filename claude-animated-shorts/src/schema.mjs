// Hikaye şeması: Claude'un yazdığı ve çizim motorunun okuduğu "senaryo dosyası"nın kuralları.
// Koordinatlar ekranın yüzdesi olarak verilir: x=0 sol kenar, x=100 sağ kenar, y=0 üst, y=100 alt.
import { z } from "zod";

export const BACKGROUNDS = ["gunduz", "gece", "orman", "deniz", "sehir", "oda", "uzay", "col", "kar"];
export const PROPS = ["gunes", "ay", "bulut", "agac", "ev", "yildiz", "kalp", "cicek", "dag", "kaya", "balon", "hediye"];
export const SHAPES = ["top", "kedi", "robot", "kus", "tavsan", "ayi"];
export const MOODS = ["mutlu", "uzgun", "saskin", "kizgin", "uykulu"];
export const ACTIONS = ["bekle", "yuru", "zipla", "el_salla", "don", "titre", "dans"];
export const CAMERAS = ["sabit", "yaklas", "uzaklas", "sola_kay", "saga_kay"];

const Point = z.object({ x: z.number(), y: z.number() });

export const StorySchema = z.object({
  baslik: z.string().describe("Videonun kısa başlığı, açılışta ekranda görünür"),
  karakterler: z
    .array(
      z.object({
        id: z.string().describe("Kısa kimlik, ör. 'mia'"),
        isim: z.string(),
        sekil: z.enum(SHAPES),
        renk: z.string().describe("Gövde rengi, ör. '#ff8a3d'"),
      })
    )
    .describe("1-3 karakter"),
  sahneler: z
    .array(
      z.object({
        sure: z.number().describe("Sahnenin süresi (saniye), 3-8 arası"),
        arkaplan: z.enum(BACKGROUNDS),
        kamera: z.enum(CAMERAS),
        nesneler: z.array(
          z.object({
            tur: z.enum(PROPS),
            x: z.number(),
            y: z.number(),
            boyut: z.number().describe("1 normal; 0.5 küçük; 2 büyük"),
          })
        ),
        oyuncular: z.array(
          z.object({
            karakter: z.string().describe("karakterler listesindeki id"),
            baslangic: Point,
            bitis: Point,
            boyut: z.number().describe("1 normal"),
            duygu: z.enum(MOODS),
            hareket: z.enum(ACTIONS),
          })
        ),
        konusmalar: z.array(
          z.object({
            karakter: z.string(),
            metin: z.string().describe("Kısa konuşma balonu metni (en fazla ~8 kelime)"),
            bas: z.number().describe("Sahne içinde başlama saniyesi"),
            bit: z.number().describe("Sahne içinde bitiş saniyesi"),
          })
        ),
        anlatim: z.string().describe("Ekranın altında görünen anlatıcı yazısı; yoksa boş metin"),
      })
    )
    .describe("4-8 sahne"),
});
