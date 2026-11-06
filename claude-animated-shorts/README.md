# 🎬 Claude Animated Shorts

Bir konu yazıyorsunuz → **Claude** kısa bir çizgi film senaryosu yazıyor → bilgisayar bunu
**dikey (9:16) MP4 videoya** çeviriyor. YouTube Shorts, TikTok ve Reels için hazır.

## Nasıl çalışıyor? (çok basit anlatım)

1. **Yazar (Claude):** Konunuzu okur, karakterleri, sahneleri, konuşma balonlarını ve
   anlatıcı yazılarını içeren bir **senaryo dosyası** yazar (`hikayeler/` klasörüne).
2. **Ressam (çizim motoru):** Senaryoyu okur; arka planı, karakterleri, hareketleri saniye saniye çizer.
   Hiçbir yapay zeka görseli kullanılmaz, her şey kodla çizilir; bu yüzden **ücretsizdir**.
3. **Ses stüdyosu:** Anlatıcıyı ve her karakteri, insan kayıtlarıyla eğitilmiş yapay zeka
   ses modelleriyle (Piper) doğal bir Türkçe sesle seslendirir. Kedi, kuş gibi karakterlerin sesi
   inceltilir, ayının sesi kalınlaştırılır. Ayrıca kodla bestelenmiş
   neşeli bir müzik ve efektler (açılış "ding", geçiş "vuuş", zıplama "boing") ekler.
   Konuşma balonları seslerle aynı anda çıkar, konuşurken müzik kısılır.
4. **Kameraman (ffmpeg):** Kareleri ve sesi birleştirip videoyu yapar (`cikti/` klasörüne).

## Kurulum (bir kere yapılır)

Gerekenler: [Node.js 22.9+](https://nodejs.org) ve [ffmpeg](https://ffmpeg.org/download.html).

```bash
npm install          # gerekli parçaları indirir
npm run kurulum      # görünmez tarayıcıyı ve Türkçe ses modellerini (~160 MB) indirir
```

Sonra `.env.example` dosyasını kopyalayıp adını `.env` yapın ve içine Claude API anahtarınızı yazın.

## Kullanım

| Ne yapmak istiyorum? | Komut |
|---|---|
| Anahtar olmadan örnek videoyu üret | `npm run ornek` |
| Konudan senaryo + video üret | `npm run uret -- "uçmayı öğrenen penguen"` |
| Sadece senaryo yaz | `npm run hikaye -- "uzayda kaybolan robot"` |
| Senaryoyu elle düzelttim, videoyu yeniden üret | `npm run video -- hikayeler/dosya.json` |
| Videoyu beklemeden tarayıcıda izle | `npm run onizle -- hikayeler/dosya.json` |

Her çalıştırmada `cikti/` klasöründe şunlar oluşur:

- `.mp4` — sesli, paylaşıma hazır dikey video (1080x1920, YouTube/TikTok ses seviyesine ayarlı)
- `-kapak.jpg` — kapak resmi
- `-paylasim.txt` — kopyala-yapıştır başlık, açıklama ve etiketler
- `.html` — tarayıcıda sessiz önizleme

Sessiz video isterseniz komutun sonuna `--sessiz` ekleyin.

## Çizim motorunun bildikleri

- **Arka planlar:** gunduz, gece, orman, deniz, sehir, oda, uzay, col, kar
- **Nesneler:** gunes, ay, bulut, agac, ev, yildiz, kalp, cicek, dag, kaya, balon, hediye
- **Karakterler:** top, kedi, robot, kus, tavsan, ayi (istediğiniz renkte)
- **Duygular:** mutlu, uzgun, saskin, kizgin, uykulu
- **Hareketler:** bekle, yuru, zipla, el_salla, don, titre, dans
- **Kamera:** sabit, yaklas, uzaklas, sola_kay, saga_kay

Senaryo dosyasının kuralları `src/schema.mjs` içinde. Yeni bir karakter ya da arka plan eklemek için
`player/oynatici.js` dosyasına çizimini ekleyip `src/schema.mjs` listesine adını yazmak yeterli.

## Ayarlar

- `CLAUDE_MODEL` — kullanılacak model (varsayılan `claude-opus-5-5`)
- `FPS` — saniyedeki kare sayısı (varsayılan 30)

## Sesler hakkında

Sesler internetsiz ve ücretsiz çalışır; modeller `modeller/` klasörüne bir kez indirilir.
Kullanılan modeller: Piper `tr_TR-fettah-medium` ve `tr_TR-dfki-medium` (sherpa-onnx üzerinden).
Her karakter tipinin sesi `src/ses.mjs` içindeki `VOICES` tablosundan değiştirilebilir
(`pitch`: 1 doğal, büyük sayı daha ince ses; `speed`: konuşma hızı).

Bu iki model de erkek sesidir; kadın ve çocuk karakterlerin sesi perde yükseltilerek elde edilir.
