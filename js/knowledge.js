// YouTube bilgi tabanı: neler izlenir, dikkat nasıl tutulur, yönetmen/senarist/editör teknikleri.
// Bunlar genel sektör pratiğidir; kesin istatistik değildir. Canlı veri için Trendler sekmesinde
// (ücretsiz) YouTube Data API anahtarı girilebilir.

export const FORMATS = {
  story:      { label: 'Kısa film / Hikâye',       fiction: true,  mood: 'mysterious' },
  mystery:    { label: 'Gizem / Gerilim',          fiction: true,  mood: 'tense' },
  horror:     { label: 'Korku hikâyesi',           fiction: true,  mood: 'dark' },
  scifi:      { label: 'Bilim kurgu',              fiction: true,  mood: 'epic' },
  drama:      { label: 'Duygusal dram',            fiction: true,  mood: 'warm' },
  lesson:     { label: 'Hayat dersi (mesel)',      fiction: true,  mood: 'warm' },
  whatif:     { label: '"Ya şöyle olsaydı?" senaryosu', fiction: true, mood: 'epic' },
  motivation: { label: 'Motivasyon',               fiction: false, mood: 'hopeful' },
  facts:      { label: 'Bilgi / Belgesel anlatım', fiction: false, mood: 'calm', needsFacts: true },
  list:       { label: 'Top liste (5 şey…)',       fiction: false, mood: 'energetic', needsFacts: true },
};

// Genel olarak en çok izlenen / en iyi performans gösteren içerik türleri (yapay zekâ ile
// yüzsüz (faceless) kanal olarak üretilebilenler öne çıkarıldı).
export const TOP_NICHES = [
  { name: 'Gizem & çözülmemiş olaylar', why: 'Merak boşluğu (curiosity gap) izleyiciyi sonuna kadar tutar; yorumlarda teori tartışması etkileşimi artırır.', ai: 'Çok uygun', fmt: 'mystery' },
  { name: 'Korku / creepypasta hikâyeleri', why: 'Gece izlenmesi yüksek, uzun izlenme süresi, sadık izleyici kitlesi.', ai: 'Çok uygun', fmt: 'horror' },
  { name: 'Tarih anlatıları', why: 'Evrensel ilgi; her dile çevrilebilir, zamansız (evergreen) içerik.', ai: 'Uygun (bilgiyi doğrula!)', fmt: 'facts' },
  { name: 'Uzay & bilim', why: 'Görsel olarak etkileyici, "ya şöyle olsaydı?" senaryoları çok paylaşılır.', ai: 'Çok uygun', fmt: 'whatif' },
  { name: 'Psikoloji & insan davranışı', why: 'İzleyici kendini tanır, kaydetme ve paylaşma oranı yüksek.', ai: 'Uygun', fmt: 'facts' },
  { name: 'Motivasyon & kişisel gelişim', why: 'Shorts\'ta tekrar izlenme yüksek; sabah/akşam rutin izlenmeleri.', ai: 'Çok uygun', fmt: 'motivation' },
  { name: 'Hayat dersi hikâyeleri / meseller', why: 'Duygusal kapanış paylaşmayı tetikler, tüm yaş gruplarına hitap eder.', ai: 'Çok uygun', fmt: 'lesson' },
  { name: 'Top 5/10 listeler', why: 'Net vaat ("5 şey") tıklamayı artırır; izleyici listenin sonunu merak eder.', ai: 'Uygun (bilgiyi doğrula!)', fmt: 'list' },
  { name: 'Kısa bilim kurgu filmleri', why: 'Sinematik görseller + twist = yüksek paylaşım.', ai: 'Uygun', fmt: 'scifi' },
  { name: 'Duygusal dram / ilişki hikâyeleri', why: 'Yorum ve paylaşım oranı yüksek, Shorts\'ta çok yayılır.', ai: 'Uygun', fmt: 'drama' },
];

// YouTube'da genel olarak en çok izlenen kategoriler (bağlam için).
export const GLOBAL_CATEGORIES = [
  'Müzik', 'Eğlence', 'Oyun', 'Kişiler & Bloglar', 'Komedi', 'Nasıl yapılır & Eğitim', 'Çocuk / aile', 'Bilim & Teknoloji', 'Spor', 'Yemek',
];

export const RETENTION_RULES = [
  { t: 'İlk 1–3 saniye her şeydir', d: 'Shorts\'ta izleyici ilk saniyelerde kaydırır. Videoyu doğrudan çatışma, soru veya şok edici bir görüntüyle aç. Logo/giriş yok.' },
  { t: 'Uzun videoda ilk 30 saniye', d: 'Vaadi ilk 15 saniyede ver, 30. saniyeye kadar bir "açık döngü" (cevabı sonra gelecek soru) kur.' },
  { t: 'Açık döngüler (open loops)', d: '"Ama asıl tuhaf olan, birazdan anlatacağım şeydi…" gibi cümlelerle merakı ileri taşı. Her 30–60 sn\'de bir yeni döngü aç.' },
  { t: 'Desen kırıcılar (pattern interrupt)', d: 'Shorts\'ta her 2–4 sn, uzun videoda her 5–10 sn\'de görüntü, açı, ses veya tempo değiştir.' },
  { t: 'Söz verdiğini öde', d: 'Başlık ve kapakta vaat edilen şey videoda mutlaka karşılanmalı; aksi halde izlenme oranı ve güven düşer.' },
  { t: 'Döngüsel bitiş (Shorts)', d: 'Son cümleyi ilk cümleye bağla; video başa döndüğünde kesintisiz devam ediyormuş gibi olsun → tekrar izlenme artar.' },
  { t: 'Altyazı şart', d: 'Mobil izleyicilerin önemli kısmı sessiz izler. Büyük, kontrastlı, ekranın ortasına yakın altyazı kullan.' },
  { t: 'Duygu > bilgi', d: 'İnsanlar bilgiyi değil, hissettiklerini paylaşır. Her videoda bir ana duygu seç: merak, korku, umut, öfke, hüzün, hayranlık.' },
  { t: 'Spesifik ol', d: '"Bir adam" yerine "1987\'de, Trabzon\'da bir balıkçı". Spesifiklik inandırıcılık ve merak yaratır.' },
  { t: 'Seri yap', d: 'Başarılı bir formatı tekrarla (Bölüm 1, 2, 3…). Algoritma, izleyiciyi seriye bağlayan kanalları sever.' },
];

export const TITLE_FORMULAS = [
  'Kimse {X} hakkında bunu söylemedi…',
  '{X}: Herkesin bildiği yalan',
  '{N} saniyede {X}',
  '{X} yüzünden her şey değişti',
  'Eğer {X} olsaydı ne olurdu?',
  '{X} ile ilgili 5 rahatsız edici gerçek',
  'Bu {X} hikâyesinin sonunu kimse tahmin edemedi',
  '{X}… ama bir şeyler ters gitti',
  'Ona {X} dediler. Yanılıyorlardı.',
  'Sadece %1\'in fark ettiği {X} detayı',
];

export const THUMBNAIL_RULES = [
  'En fazla 3–4 kelime; başlığı tekrar etme, tamamla.',
  'Tek bir odak noktası: bir yüz/obje + güçlü duygu.',
  'Yüksek kontrast: koyu arka plan + parlak sarı/beyaz metin.',
  'Telefonda küçük boyutta okunabiliyor mu? Test et.',
  'Merak boşluğu: sonucu değil, sonucun eşiğini göster.',
];

export const LENGTH_GUIDE = [
  { fmt: 'Shorts', d: '20–45 sn en güvenli bölge (Shorts 3 dakikaya kadar olabilir). Kısa = tekrar izlenme = daha fazla dağıtım.' },
  { fmt: 'Orta', d: '3–6 dk: hikâye anlatımı ve listeler için ideal.' },
  { fmt: 'Uzun', d: '8–15 dk: belgesel/gizem; orta reklam (mid-roll) için 8 dk üzeri.' },
];

export const GLOBAL_TIPS = [
  'Her videoya en az 5–10 dilde altyazı (.srt) yükle: YouTube Studio → Altyazılar. Bu uygulama hepsini tek tıkla üretir.',
  'Başlık ve açıklamayı da çevir (YouTube Studio → Çeviriler). Yabancı aramalarda görünür olursun.',
  'Kanal destekliyorsa çoklu ses kanalı (multi-language audio) ekle: aynı videoyu farklı dilde seslendir.',
  'İngilizce, İspanyolca, Portekizce (BR), Hintçe ve Endonezce çok büyük izleyici havuzlarıdır.',
  'Kültüre özgü espri ve deyimlerden kaçın ya da evrensel karşılığını kullan.',
  'Yayın saatini hedef ülkenin akşam saatine göre ayarla.',
];

// Yönetmen teknikleri (Nolan esintili: zaman yapısı, gerilim, pratik etkiler hissi)
export const DIRECTOR_TECHNIQUES = [
  { name: 'Doğrusal olmayan zaman', d: 'Hikâyeyi sondan, ortadan ya da iki zaman çizgisini dönüşümlü anlatarak izleyiciyi aktif düşünmeye zorla.' },
  { name: 'Tik tak saati (ticking clock)', d: 'Bir geri sayım ya da kaçınılmaz bir son tarih koy; gerilim kendiliğinden yükselir.' },
  { name: 'Shepard tonu hissi', d: 'Müziği ve kurguyu sürekli yükseliyormuş gibi kur; doruk noktasına kadar nefes aldırma.' },
  { name: 'Gösterme, anlatma', d: 'Duyguyu diyalogla değil görüntüyle ver: titreyen bir el, yarım kalmış bir kahve.' },
  { name: 'Ölçek kontrastı', d: 'Dev geniş planlardan aniden yakın plana geç; insanın küçüklüğü ile duygunun büyüklüğünü çarpıştır.' },
  { name: 'Ödül-kurulum (setup–payoff)', d: 'İlk sahnede masum görünen bir detay, finalde her şeyi açıklayan anahtar olsun.' },
  { name: 'Güvenilmez anlatıcı', d: 'Anlatıcının bir şey sakladığını son ana kadar fark ettirme.' },
];

export const EDITOR_RULES = [
  'Her kesme bir soru sormalı ya da cevaplamalı.',
  'Sessizliği silah olarak kullan: twist\'ten hemen önce 0.5–1 sn sessizlik.',
  'J-cut / L-cut: sonraki sahnenin sesini görüntüden önce başlat.',
  'Shorts\'ta sahne başına 2–4 sn; uzun videoda 4–8 sn.',
  'Müziği diyalog altında %20–30\'a çek (ducking) — bu uygulama otomatik yapar.',
  'Finalde 1 sn siyah ekran + tek cümle: akılda kalıcı kapanış.',
];

// Kanca (hook) tipleri — yerleşik motor ve LLM istemi bunlardan rastgele seçer.
export const HOOK_TYPES = {
  question: 'Merak sorusu',
  shock: 'Şok edici iddia',
  cold_open: 'Soğuk açılış (doğrudan aksiyon)',
  confession: 'İtiraf',
  countdown: 'Geri sayım / zaman baskısı',
  contradiction: 'Çelişki',
  direct: 'İzleyiciye doğrudan hitap',
};

export const TIME_STRUCTURES = {
  linear: 'Doğrusal',
  in_medias_res: 'Ortadan başla (in medias res)',
  reverse: 'Sondan başa',
  parallel: 'Paralel zaman çizgileri',
  loop: 'Döngü (başa bağlanan son)',
};

export const TWISTS = {
  self_letter: 'Mesajı gelecekteki kendisi göndermiş',
  helper_villain: 'Yardımcı aslında kötü karakter',
  narrator_lies: 'Anlatıcı yalan söylüyor',
  time_loop: 'Zaman döngüsü',
  protector_monster: 'Canavar aslında koruyucu',
  they_are_ghost: 'Ölen aslında kahramanın kendisi',
  test_reward: 'Ödül aslında sınavmış',
  stranger_family: 'Yabancı aslında aileden',
  recording: 'Her şey bir kayıt / simülasyon',
  never_lost: 'Kaybolan şey hiç kaybolmamış',
  role_swap: 'Avcı ile av yer değiştiriyor',
  kindness_echo: 'Küçük bir iyilik yıllar sonra geri dönüyor',
};

export const ENDINGS = { open: 'Açık uçlu', bittersweet: 'Acı-tatlı', triumphant: 'Zafer', dark: 'Karanlık', circular: 'Döngüsel' };

// Koç: tıkandığında
export const COACH = {
  mindset: [
    'Mükemmel video yoktur; yayınlanmış video vardır. Bugünün işi "bitmiş", yarının işi "iyi".',
    'İlk 100 video senin okulun. Her biri bir ders, hiçbiri bir hüküm.',
    'İlham beklenmez, randevu verilir. 10 dakika başla; motivasyon arkadan gelir.',
    'İzlenme sayın senin değerin değil; sadece bir sonraki deneyin verisidir.',
    'Kendini en sevdiğin yaratıcıyla değil, 3 ay önceki kendinle kıyasla.',
    'Tıkanmak, beyninin "daha iyisini biliyorum" demesidir. Bu iyi bir işaret.',
    'Bugün tek bir şey yap: bir kanca cümlesi yaz. Sadece bir tane.',
    'Disiplin, en az istediğin gün de küçük bir adım atmaktır.',
    'Eleştiri bir pusula olabilir ama direksiyon senin elinde.',
    'Yorgunsan dinlen, ama bırakma. Ara vermek pes etmek değildir.',
  ],
  exercises: [
    'Bir hikâyeyi son cümlesinden başlayarak yaz.',
    'Bugün gördüğün en sıradan nesneyi bir gizemin anahtarı yap.',
    'En sevdiğin filmin kötü karakterinin gözünden 30 saniyelik bir monolog yaz.',
    '"Ya … olsaydı?" cümlesini 10 farklı şekilde tamamla, en tuhafını seç.',
    'Tek bir kelime seç (ör. "anahtar"). O kelimeyle 3 farklı türde 3 kanca yaz.',
    'Çocukken en çok korktuğun şeyi bir yetişkin hikâyesine çevir.',
    'Bir yorumu (kendi videondan ya da başkasınınkinden) yeni bir video fikrine dönüştür.',
    'Hikâyeni 3 kelimeyle anlat. Sonra 3 cümleyle. Sonra 30 saniyeyle.',
    'Bir karakter yarat: dışı sert, içi kırılgan. Ona bir sır ver.',
    'Bugünkü haberlerden birini 100 yıl sonrasına taşı.',
  ],
  blockers: [
    { keys: ['fikir', 'ilham', 'idea', 'konu', 'ne yap'], reply: 'Fikir yokluğu genelde girdi yokluğudur. 15 dakika: 3 yorum oku, 2 trend videoya bak, 1 kişisel anını yaz. Sonra bunları "Fikir Kıvılcımı" butonuyla birleştir. Tek bir fikir yeter — mükemmel olması gerekmez.' },
    { keys: ['izlen', 'view', 'algoritma', 'abone', 'büyü'], reply: 'Düşük izlenme çoğu zaman kapak + başlık + ilk 3 saniye sorunudur, içerik değil. Son 3 videonun ilk cümlesini yeniden yaz: soru mu, şok mu, çatışma mı? Aynı videoyu yeni bir kancayla Shorts olarak tekrar dene.' },
    { keys: ['yorgun', 'bıktım', 'tüken', 'burnout', 'enerji'], reply: 'Tükenmişlik, sürdürülemez bir tempo işaretidir. Bu hafta üretimi yarıya indir, kaliteyi değil süreci kolaylaştır: bu uygulamayla bir seriyi şablonlaştır. Bir gün tamamen ekransız geçir. Kanal bir maraton.' },
    { keys: ['korku', 'utan', 'yargı', 'çekin', 'cesaret', 'ne der'], reply: 'İnsanlar senin hakkında sandığından çok daha az düşünüyor. Yüzsüz (faceless) içerikle başla; ses ve hikâye senin. İlk 10 videoyu "deney" olarak etiketle — deneyler başarısız olamaz, sadece veri üretir.' },
    { keys: ['mükemmel', 'beğenm', 'yeterli değil', 'kötü'], reply: '%80 iyi ve yayında, %100 iyi ve taslakta olandan her zaman daha değerlidir. Kendine bir son tarih koy: 48 saat. Süre dolunca yayınla, sonraki videoda düzelt.' },
    { keys: ['zaman', 'vakit', 'meşgul', 'yetişemi'], reply: 'Toplu üretim yap: bir oturumda 5 senaryo, bir oturumda 5 render. Bu uygulamada aynı fikirden "Farklı yeniden yaz" ile 5 varyasyon üretip tek seferde hazırla.' },
    { keys: ['motivasyon', 'istek', 'canım', 'isteksiz'], reply: 'Motivasyon eylemden sonra gelir. "2 dakika kuralı": sadece uygulamayı aç ve bir kanca üret. Çoğu zaman devam edersin. Etmezsen de bugünün görevi tamam.' },
  ],
  sparks: {
    subjects: ['terk edilmiş bir deniz feneri', 'kayıp bir mektup', 'son kalan kütüphaneci', 'gece yarısı çalan telefon', 'unutulan bir şehir', 'yapay zekâ ile konuşan bir çocuk', 'zamanda donmuş bir kasaba', 'sahibi olmayan bir gölge', 'okyanusun dibindeki sinyal', 'eski bir fotoğraftaki yabancı', 'hiç bitmeyen bir tren yolculuğu', 'kendi cenazesine davet edilen adam', 'Ay\'daki ilk bahçıvan', 'sessizlik satan dükkân', 'bir köyün sakladığı sır', 'yanlış numaradan gelen sesli mesaj', '100 yıl sonra açılan zaman kapsülü', 'uyuyamayan şehir'],
    angles: ['ama her şey tersten anlatılıyor', 'ama anlatıcı yalan söylüyor', 've 60 saniye içinde çözülmeli', 'bir çocuğun gözünden', 'kötü karakterin gözünden', 'tek bir odada geçiyor', 'iki farklı zamanda aynı anda', 'son sahne ilk sahneye bağlanıyor', 'hiç diyalog kullanmadan, sadece anlatıcıyla', 'bir mektuplar dizisi olarak'],
  },
};
