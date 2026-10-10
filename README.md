# 🎬 YZ Sinema Stüdyosu

Metinden veya bir fikirden YouTube videosu üreten, **tamamen ücretsiz** ve **tamamen tarayıcıda** çalışan yapay zekâ stüdyosu. Sunucu yok, abonelik yok, API anahtarı zorunlu değil.

## Ne yapar?

| Rol | Ne yapıyor |
|---|---|
| 🎥 **Yönetmen** | Doğrusal olmayan zaman yapıları (ortadan başla, sondan başa, paralel zaman, döngü), twist, kurulum-ödül, çekim ölçeği ve kamera hareketi seçer. |
| ✍️ **Senarist** | Her üretimde yeni bir "stil genomu" (yapı + kanca + twist + son + ton) ve yeni bir tohumla yazar. Aynı konu 100 kez yazılsa 100 farklı hikâye çıkar. |
| ✂️ **Editör** | Kanca uzunluğu, açık döngüler, tempo, süre, kapanış sorusu gibi ölçütlerle 100 üzerinden puan verir ve öneri sunar. Twist öncesi sessizlik ve müzik kısmayı (ducking) otomatik yapar. |
| 🧭 **Koç** | Tıkandığında fikir kıvılcımları, günlük kart, yaratıcı egzersizler, 10 dakikalık sprint ve "Tıkandım" sohbeti. |
| 📈 **Trend analisti** | Yapay zekâ ile en iyi işleyen türler, dikkat tutma kuralları, başlık/kapak formülleri; isteğe bağlı ücretsiz YouTube Data API ile canlı trend analizi. |
| 🧠 **Öğrenen sistem** | 👍/👎 ve gerçek izlenme oranlarından hangi stillerin işe yaradığını öğrenir (Thompson örneklemesi) — çeşitliliği bozmadan. |

### Video üretimi
- **Seslendirme — iki motor:**
  - **OmniVoice** (GitHub'daki [OmniVoice](https://github.com/tugsanemen1417/OmniVoice) fork'unun resmi ücretsiz Hugging Face demosu `k2-fsa/OmniVoice`): 600+ dil. Her karakter için cinsiyet/yaş/perde/fısıltı/aksan ile **ses tasarlanır**, sonra tüm replikler o sesten **klonlanır** → karakter video boyunca aynı sesle konuşur.
  - **Piper** (tarayıcı içi, tamamen çevrimdışı): OmniVoice'a ulaşılamazsa otomatik devreye girer.
- **Karakter sesleri:** Cinsiyet, yaş, beden yapısı ve kişilik (sıcakkanlı, otoriter, gizemli…) → ses profili. Aynı projede **iki karakter asla aynı ses imzasına sahip olmaz**.
- **Görseller:** Prosedürel sinematik sahneler (şehir, orman, deniz feneri, çöl, uzay, dağ, iç mekân, kasaba, soyut), paralaks, kamera hareketi, hava efektleri, film greni, renk derecelendirme. İstersen her sahneye kendi görselini/videonu ekle.
- **YZ video klipleri (deneysel):** GitHub'daki [LTX-2](https://github.com/tugsanemen1417/LTX-2) fork'unun modeliyle sahne karesi 3 sn'lik gerçek bir yapay zekâ klibine dönüştürülür (ücretsiz HF Space: LTX-2 Turbo, yedek: Lightricks/LTX-2-3).

### Ücretsiz GPU kotası hakkında
OmniVoice ve LTX-2, Hugging Face'in ücretsiz **ZeroGPU** altyapısında çalışır. Anonim kullanıcıların günlük GPU süresi sınırlıdır ve **tüm ZeroGPU Space'leri arasında ortaktır** — YZ klipleri bu kotayı hızla tüketir. Kota dolunca ses otomatik olarak Piper'a, sahneler prosedürel görsele döner; ertesi gün kota yenilenir. Ücretsiz bir HF hesabı açıp Ayarlar'a "read" anahtarı girmek kotayı artırır.
- **Müzik:** Ruh hâline göre bestelenen telifsiz film müziği (akor, pad, nabız, twist öncesi riser).
- **Altyazı:** Videoya gömülü (Shorts için kelime kelime vurgulu) + YouTube'a yüklemek için 20 dilde `.srt` dosyası. Başlık ve açıklama çevirisi.
- **Biçimler:** Shorts (9:16) ve YouTube (16:9), 720p / 1080p, MP4 veya WebM.

### Gizlilik
- Senaryolar, sesler ve videolar **yalnızca sekmenin belleğinde** durur.
- Video ancak **💾 Cihazıma kaydet** butonuna basınca indirilir. Altyazılar da yalnızca tıklayınca iner.
- Saklanan tek şeyler: indirilen ses modelleri (tarayıcı önbelleği, video değil) ve öğrenme puan tablosu (kapatılabilir/silinebilir).

## Kurulum — GitHub Pages ile ücretsiz yayınla

1. Bu klasörün içeriğini GitHub deponun köküne (veya `docs/` klasörüne) koy.
2. GitHub → **Settings → Pages → Build and deployment → Deploy from a branch** → `main` / `root` (veya `/docs`).
3. Birkaç dakika sonra `https://KULLANICI.github.io/DEPO/` adresinde telefon ve bilgisayardan açılır.

Yerel çalıştırma (ES modülleri `file://` ile açılmaz, küçük bir sunucu gerekir):

```bash
python -m http.server 8765
```

Sonra tarayıcıda `http://localhost:8765` aç.

## Daha güçlü senaryolar için (hepsi ücretsiz, isteğe bağlı)
Ayarlar → Senaryo motoru:
- **Tarayıcı içi YZ (WebLLM):** Qwen2.5 / Llama 3.2 / Gemma 2 modeli tarayıcında çalışır. Anahtar yok. WebGPU (güncel Chrome/Edge) gerekir.
- **Google Gemini:** aistudio.google.com'dan ücretsiz anahtar.
- **Groq / OpenRouter (:free) / Ollama / LM Studio:** OpenAI uyumlu herhangi bir uç nokta.

Anahtarlar varsayılan olarak yalnızca bellekte tutulur.

## Dosya yapısı
```
index.html          arayüz
css/style.css       tema (koyu, mobil uyumlu)
js/main.js          arayüz denetleyicisi
js/story.js         yerleşik senaryo motoru + "metnimi videoya çevir" ayrıştırıcısı
js/llm.js           dil modeli sağlayıcıları ve yönetmen/senarist/editör istemi
js/voices.js        karakter→ses eşleştirme, OmniVoice (tasarım+klon) ve Piper TTS, perde/tempo/tını işleme (WSOLA)
js/hf.js            ücretsiz Hugging Face (Gradio) Space istemcisi
js/aiclip.js        LTX-2 ile sahne → YZ video klibi
js/visuals.js       prosedürel sinematik sahne üretici
js/music.js         prosedürel film müziği
js/render.js        zaman çizelgesi, miksaj, önizleme ve video kaydı
js/subtitles.js     altyazı zamanlama, SRT/VTT, gömülü altyazı, çeviri
js/editor.js        editör puanlaması
js/coach.js         koç + YouTube trend analizi
js/learn.js         stil genomu öğrenmesi
js/knowledge.js     YouTube bilgi tabanı
js/langs.js         diller, ses cinsiyetleri, isim havuzları
```

## Metin biçimi ("Metnimi videoya çevir")
```
@Ayşe: kadın, genç, ince, neşeli
@Kerem: erkek, yaşlı, iri, bilge, gizemli
# deniz feneri, gece, gizemli, sis
Fener otuz yıldır ilk kez söndü.
AYŞE: Dede, bu ışık neden söndü?
KEREM: Çünkü artık beklediği gemi geldi.
```
Hiç biçim kullanmazsan düz metin cümlelere bölünür, sahneler ve mekânlar otomatik seçilir.

## Notlar
- Video gerçek zamanlı kaydedilir (60 sn'lik video ≈ 60 sn sürer).
- OmniVoice ile Türkçe dahil tüm dillerde gerçek kadın/erkek/çocuk/yaşlı sesleri tasarlanır. Çevrimdışı Piper'da Türkçe sesler erkek seslerdir; kadın karakterler perde/tını kaydırmayla üretilir.
- Hintçe, Endonezce, Japonca, Korece, Azerbaycanca için çevrimdışı Piper sesi yok; bu dillerde seslendirme yalnızca OmniVoice ile yapılır.
- Bilgi/belgesel ve liste türlerinde yerleşik motor **bilgi uydurmaz**; yer tutucu bırakır. Gerçek bilgi için metnini yapıştır ya da bir dil modeli bağla.
