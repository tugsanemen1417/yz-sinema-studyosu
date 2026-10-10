// Yerleşik (çevrimdışı, ücretsiz, anahtarsız) senaryo motoru + "metnimi videoya çevir" ayrıştırıcısı.
// Her üretim yeni bir tohumla çalışır: aynı konu yazılsa bile yapı, twist, kanca, karakterler,
// mekân, cümle seçimleri farklılaşır. Oturumda aynı "stil genomu" tekrar seçilmez (learn.js).

import { makeRng, fill, splitSentences } from './util.js';
import { NAMES } from './langs.js';
import { FORMATS, HOOK_TYPES, TIME_STRUCTURES, TWISTS, ENDINGS } from './knowledge.js';
import { learning } from './learn.js';

export const SETTINGS = ['city', 'forest', 'ocean', 'desert', 'space', 'mountain', 'interior', 'village', 'abstract'];
export const SETTING_LABELS = { city: 'Şehir', forest: 'Orman', ocean: 'Deniz / kıyı', desert: 'Çöl', space: 'Uzay', mountain: 'Dağ / kar', interior: 'İç mekân', village: 'Kasaba / köy', abstract: 'Soyut' };
export const TIMES = { dawn: 'Şafak', day: 'Gündüz', dusk: 'Gün batımı', night: 'Gece' };
export const MOODS = { calm: 'Sakin', mysterious: 'Gizemli', tense: 'Gergin', dark: 'Karanlık', hopeful: 'Umutlu', warm: 'Sıcak', epic: 'Destansı', melancholic: 'Hüzünlü', energetic: 'Enerjik' };
export const WEATHERS = { clear: 'Açık', rain: 'Yağmur', snow: 'Kar', storm: 'Fırtına', fog: 'Sis', embers: 'Kıvılcım' };
export const CAMERAS = { push_in: 'Yavaş içe kayma', pull_out: 'Geri çekilme', pan_left: 'Sola pan', pan_right: 'Sağa pan', tilt_up: 'Yukarı tilt', shake: 'El kamerası', static: 'Sabit' };

const KW = {
  setting: {
    ocean: ['deniz', 'okyanus', 'liman', 'fener', 'kıyı', 'sahil', 'gemi', 'balık', 'ada', 'sea', 'ocean', 'harbor', 'lighthouse', 'ship', 'island', 'beach'],
    forest: ['orman', 'ağaç', 'koru', 'kulübe', 'kurt', 'forest', 'tree', 'woods', 'cabin'],
    city: ['şehir', 'sokak', 'metro', 'cadde', 'gökdelen', 'istanbul', 'apartman', 'city', 'street', 'subway', 'tower', 'neon'],
    desert: ['çöl', 'kum', 'kervan', 'vaha', 'desert', 'sand', 'dune'],
    space: ['uzay', 'yıldız', 'gezegen', 'mars', 'ay\'', 'astronot', 'galaksi', 'yörünge', 'space', 'star', 'planet', 'moon', 'galaxy', 'orbit', 'alien', 'uzaylı'],
    mountain: ['dağ', 'kar', 'zirve', 'buz', 'mountain', 'snow', 'peak', 'ice'],
    interior: ['oda', 'ev', 'kütüphane', 'dükkân', 'dükkan', 'hastane', 'koridor', 'mutfak', 'room', 'house', 'library', 'shop', 'hospital', 'hall'],
    village: ['köy', 'kasaba', 'village', 'town'],
  },
  mood: {
    dark: ['ölüm', 'karanlık', 'korku', 'kan', 'hayalet', 'cin', 'death', 'dark', 'ghost', 'blood', 'fear'],
    tense: ['kaç', 'koş', 'tehlike', 'saldır', 'silah', 'run', 'danger', 'attack', 'chase'],
    hopeful: ['umut', 'başar', 'kazan', 'güneş', 'hayal', 'hope', 'win', 'dream', 'sun'],
    melancholic: ['hüzün', 'veda', 'özlem', 'kayıp', 'yalnız', 'goodbye', 'lonely', 'loss', 'miss'],
    warm: ['aile', 'sevgi', 'aşk', 'anne', 'dost', 'love', 'family', 'friend'],
    mysterious: ['sır', 'gizem', 'mektup', 'iz', 'secret', 'mystery', 'letter', 'clue'],
    epic: ['savaş', 'imparator', 'kahraman', 'war', 'empire', 'hero', 'legend', 'efsane'],
  },
  time: { night: ['gece', 'karanlık', 'ay ışığı', 'night', 'midnight'], dawn: ['şafak', 'sabah', 'dawn', 'morning'], dusk: ['akşam', 'gün batımı', 'dusk', 'sunset'] },
  weather: { rain: ['yağmur', 'rain'], snow: ['kar ', 'kış', 'snow', 'winter'], storm: ['fırtına', 'şimşek', 'storm', 'thunder'], fog: ['sis', 'duman', 'fog', 'mist'], embers: ['ateş', 'yangın', 'fire', 'flame'] },
};

function scoreKw(text, map) {
  const t = ' ' + text.toLocaleLowerCase('tr') + ' ';
  let best = null, bestN = 0;
  for (const [k, words] of Object.entries(map)) {
    const n = words.reduce((a, w) => a + (t.includes(w) ? 1 : 0), 0);
    if (n > bestN) { bestN = n; best = k; }
  }
  return best;
}
export const inferSetting = (t) => scoreKw(t, KW.setting);
export const inferMood = (t) => scoreKw(t, KW.mood);
export const inferTime = (t) => scoreKw(t, KW.time);
export const inferWeather = (t) => scoreKw(t, KW.weather);

// ---------------------------------------------------------------------------------------------
// Şablonlar. [a|b] = rastgele seçenek, {H} kahraman, {A} yardımcı, {V} öteki/karşıt, {T} konu,
// {O} motif nesne, {P} mekân, {Y} zaman, {H:gen} Türkçe ekli hâl.
// ---------------------------------------------------------------------------------------------
const TPL = {
  tr: {
    places: {
      city: ['Şehrin unutulmuş arka sokakları', 'Neon ışıklı bir metropol', 'Terk edilmiş bir metro istasyonu', 'Gökdelenlerin gölgesindeki küçük bir apartman'],
      forest: ['Sisli bir ormanın derinlikleri', 'Kimsenin girmediği eski bir koru', 'Çam ağaçlarıyla çevrili yalnız bir kulübe'],
      ocean: ['Rüzgârlı bir kıyı kasabası', 'Yalnız bir deniz feneri', 'Eski bir balıkçı limanı'],
      desert: ['Ufku olmayan bir çöl', 'Kumların yuttuğu eski bir kervan yolu'],
      space: ['Dünyadan milyonlarca kilometre uzaktaki bir istasyon', 'Mars\'taki ilk koloni', 'Sessiz bir yörünge'],
      mountain: ['Karla kaplı bir dağ geçidi', 'Bulutların üstünde kalmış bir köy'],
      interior: ['Tozlu bir sahaf dükkânı', 'Eski bir apartman dairesi', 'Gece yarısı boş bir hastane koridoru'],
      village: ['Haritada olmayan küçük bir kasaba', 'Tek yollu bir dağ köyü'],
      abstract: ['Zamanın dışında bir yer', 'Hatıraların arasında bir yer'],
    },
    years: ['1987 sonbaharı', 'Kasım\'ın en soğuk gecesi', 'Bir salı sabahı, saat 06.12', 'Yağmurun hiç dinmediği bir hafta', 'Bayramdan bir gün önce', 'Elektriklerin kesildiği gece', 'Yıl 2091', 'Yaz bitmek üzereyken'],
    objects: ['durmuş bir cep saati', 'üzerinde kendi adı yazan bir zarf', 'eski bir ses kaydı', 'kırık bir pusula', 'tanımadığı birinin fotoğrafı', 'paslı bir anahtar', 'yarım kalmış bir harita', 'kimsenin çalmadığı bir müzik kutusu'],
    hooks: {
      question: ['[Hiç düşündün mü|Bir saniye düşün]: {T} [aslında ne saklıyor|neden hep görmezden gelinir|seni ne kadar değiştirebilir]?', 'Peki ya {T} [bir uyarıysa|bir davetiyse|bir tuzaksa]?'],
      shock: ['Bu hikâyenin sonunda {H} [her şeyini kaybedecek|kim olduğunu unutacak|bir yalanın içinde uyanacak]. [Ve bunu kendisi seçecek|Ama nedenini asla tahmin edemezsin].', '{H} yıllardır kayıp sanılıyordu. Ta ki {T} ile ilgili [bir iz|bir mesaj|bir fotoğraf] ortaya çıkana kadar.'],
      cold_open: ['[Kapı üç kez çaldı|Telefon gece 03.17\'de çaldı|Işıklar bir anda söndü|Bütün saatler aynı anda durdu]. {H} [nefesini tuttu|yerinden kıpırdamadı|ilk kez gerçekten korktu].'],
      confession: ['[Bunu ilk kez anlatıyorum|Yıllardır kimseye söylemedim]. {T} hakkında [bildiğim bir şey var|bir sır taşıyorum]. Ve [artık susamam|bu gece anlatacağım].'],
      countdown: ['[Altmış|Doksan|Otuz] saniye. {H:gen} [gerçeği bulmak|her şeyi düzeltmek|kaçmak] için sadece bu kadar zamanı var.'],
      contradiction: ['Herkes {T} hakkında aynı hikâyeyi anlatır. [Hepsi yanılıyor|Ama hiçbiri gerçeği bilmiyor].', '{T}… [Kulağa sıradan geliyor|Herkesin bildiği bir şey], değil mi? [Bir de bunu dinle|Ben de öyle sanıyordum].'],
      direct: ['{H:gen} yerinde olsaydın [o kapıyı açar mıydın|o mektubu okur muydun|geri döner miydin]? [Cevabını sona sakla|Dikkatli düşün].'],
    },
    beats: {
      setup: [
        ['N', ['{P}. {Y}.', '{Y}. {P}.']],
        ['N', ['{H} [her sabah aynı saatte uyanır, aynı yoldan yürürdü|yıllardır kimseye bir şey sormadan yaşıyordu|hayatının tamamen sıradan olduğuna inanıyordu|kimsenin fark etmediği biriydi].', '{H:gen} [tek bir alışkanlığı vardı|bir kuralı vardı]: [asla geriye bakmamak|her gece pencereyi kontrol etmek|kimseye güvenmemek].']],
        ['H', ['[Bugün de|Yine] [aynı gün|sıradan bir gün]. [Hiçbir şey olmayacak|Her zamanki gibi].', '[Bir gün|Belki bir gün] [her şey değişecek|biri beni bulacak].'], 0.6],
      ],
      inciting: [
        ['N', ['[Ta ki o gün|Sonra bir gün] {O} buldu.', '[Kapısının önünde|Cebinde|Masasının üstünde] {O} [duruyordu|vardı]. [Orada olmaması gereken|Daha önce hiç görmediği] bir şey.']],
        ['N', ['[Ve her şey|Bütün mesele] {T} ile [başladı|ilgiliydi].', 'Üzerinde tek bir [cümle|kelime] yazıyordu: “{T}”.']],
        ['H', ['Bu [imkânsız|olamaz]… [Bunu kim bıraktı|Bu nasıl buraya geldi]?', '[Bekle|Dur]. Bunu [daha önce|bir yerde] gördüm.']],
      ],
      rising: [
        ['A', ['{H}, [bunu bırak|o şeyi geri koy]. [Bazı kapılar kapalı kalmalı|Ne olduğunu bilmiyorsun].', '[Sonunda|Demek] onu buldun. [Seni bekliyordum|Bunun olacağını biliyordum].', '[Bana güven|Dinle beni], {T} [sandığın şey değil|bir başlangıç değil, bir son].']],
        ['H', ['[Ne biliyorsun|Benden ne saklıyorsun], {A}?', '[Ya haklıysan|Ya yanılıyorsan]? [O zaman ne olacak|Geri dönüş var mı]?', 'Artık [duramam|geri dönemem].']],
        ['N', ['[Her ipucu|Her adım] onu [biraz daha derine|bir öncekinden daha tuhaf bir yere] götürdü.', '[Saatler|Günler] geçti. {O} [her gece biraz daha|her seferinde] [farklı görünüyordu|ağırlaşıyordu].'], 0.7],
      ],
      complication: [
        ['N', ['Ama [bir sorun vardı|işler planlandığı gibi gitmedi]. {V} [onu izliyordu|her adımını biliyordu|ondan bir adım öndeydi].', '[Sonra|O gece] {V} [kapıda belirdi|ilk kez konuştu].', '[Bir ses|Bir gölge] [ona eşlik ediyordu|peşini bırakmıyordu]. {V}.']],
        ['V', ['[Bunu aramayı bırak|Bırak onu], {H}. [Sonunu sevmeyeceksin|Bulduğun şey seni değiştirecek].', '[Benden kaçamazsın|Herkes sonunda buraya gelir]. [Sen de geldin|Sıra sende].', '[Ben senin düşmanın değilim|Seni korumaya çalışıyorum]. [Henüz anlamıyorsun|Bir gün anlayacaksın].']],
        ['H', ['[Kimsin sen|Ne istiyorsun benden]?', '[Korkmuyorum|Artık korkmuyorum]. [Sadece gerçeği istiyorum|Bitirelim şunu].', '[Yalan söylüyorsun|Sana inanmıyorum].'], 0.8],
      ],
      crisis: [
        ['N', ['[Fırtına başladığında|Saat gece yarısını vurduğunda|Işıklar son kez titrediğinde] {H} [tek başınaydı|artık geri dönemeyeceğini biliyordu].', '[Zaman tükeniyordu|Elinde sadece birkaç dakika kalmıştı]. [Ya şimdi|Şimdi ya da asla].']],
        ['H', ['[Lütfen|Hadi]… [işe yara|bir kez olsun doğru git].', '[Eğer bu bir hataysa|Eğer yanılıyorsam], [bedelini ben öderim|bu benim hatam olsun].']],
      ],
    },
    twists: {
      self_letter: [['N', ['{O} son kez çevirdiğinde [arkadaki el yazısını|köşedeki imzayı] tanıdı. [Kendi el yazısıydı|Kendi imzasıydı].']], ['N', ['Mesajı yıllar sonra kendisi [yazmıştı|göndermişti]. [Kendini uyarmak için|Bu anı değiştirmek için].']]],
      helper_villain: [['N', ['Ve o an anladı: [en başından beri|her adımda] onu yönlendiren {A} idi.']], ['A', ['[Üzgünüm|Başka yolu yoktu], {H}. [Bunun olması gerekiyordu|Seni buraya ben getirdim].']]],
      narrator_lies: [['N', ['[Sana bir şeyi söylemedim|Sana yalan söyledim]. Bu hikâyede {H} [hiç yalnız değildi|bir tanık değildi].']], ['N', ['Çünkü o gece o kapıyı açan [bendim|ben oldum].']]],
      time_loop: [['N', ['Saat yine 03.17\'yi gösterdiğinde {H} anladı: [bu gece daha önce de yaşanmıştı|bu döngü hiç bitmemişti].']], ['H', ['[Kaçıncı kez|Kaç kere] buradayım ben?']]],
      protector_monster: [['N', ['[Korktuğu şey|Gölgelerdeki şey] ona saldırmadı. [Onu korudu|Önüne geçti].']], ['N', ['Yıllardır kaçtığı şey, [aslında onu koruyordu|onu bekleyen tek dostuydu].']]],
      they_are_ghost: [['N', ['Aynaya baktığında [kimseyi göremedi|aynada yalnızca oda vardı].']], ['N', ['Herkesin onu görmezden gelmesinin bir nedeni vardı. {H} [artık bu dünyaya ait değildi|yıllar önce gitmişti].']]],
      test_reward: [['N', ['[Ödül|Hazine] diye aradığı şey [aslında bir sınavdı|bir aynaydı]. Ve {H} [onu çoktan geçmişti|kim olduğunu ilk kez görmüştü].']]],
      stranger_family: [['V', ['[Seni ilk gördüğüm günü hatırlıyorum|Yıllardır seni arıyorum], {H}. Ben {VREL}.']], ['N', ['{H} [yere çöktü|sustu]. Bütün parçalar [yerine oturdu|bir anda birleşti].']]],
      recording: [['N', ['Ve sonra [ekran karardı|her şey dondu]. Bir yazı belirdi: “Kayıt [sona erdi|47 tamamlandı].”']], ['N', ['{H:gen} yaşadığı her şey [bir kayıttı|bir simülasyondu]. Ve [birileri izliyordu|bunu hep biliyordu].']]],
      never_lost: [['N', ['[Aradığı|Kaybettiğini sandığı] şey [hiç kaybolmamıştı|en başından beri yanındaydı]. Sadece [bakmayı unutmuştu|görmek istememişti].']]],
      role_swap: [['N', ['Ve o an roller değişti. Avlanan artık {H} değildi; kaçan {V} oldu.']], ['V', ['[Hayır|Dur]… [bu böyle olmamalıydı|plan bu değildi]!'], 0.7]],
      kindness_echo: [['N', ['{V} gülümsedi. Yıllar önce {H:gen} [ona uzattığı bir parça ekmeği|ona verdiği şemsiyeyi|ona söylediği tek bir güzel sözü] hiç unutmamıştı.']], ['V', ['[Borcumu ödemeye geldim|Şimdi sıra bende], {H}.']]],
    },
    endings: {
      open: [['N', ['{H} [kapıyı açtı|ilk adımı attı]. Öteki tarafta ne olduğunu [kimse bilmiyor|hâlâ kimse bilmiyor].']]],
      bittersweet: [['N', ['[Kazandı|Gerçeği buldu]. Ama [bedeli|kaybettiği şey] [hiç geri gelmeyecekti|her şeyden ağırdı].']], ['H', ['[Buna değdi mi|Değdi mi]? [Bilmiyorum|Belki]… [ama artık özgürüm|ama artık biliyorum].'], 0.7]],
      triumphant: [['N', ['Ve o sabah güneş [ilk kez|yıllar sonra ilk kez] onun için doğdu.', '{H} [korkusuyla yüzleşti|kaderini kendi yazdı]. Ve [kazandı|her şey değişti].']], ['H', ['[Bitti|Sonunda]. [Artık kendi hikâyemi ben yazacağım|Artık hazırım].'], 0.7]],
      dark: [['N', ['[Kapı arkasından kapandı|Işıklar bir daha yanmadı]. Ve {H} [bir daha görülmedi|hâlâ orada bekliyor].']]],
      circular: [['N', ['[Ertesi sabah|Yıllar sonra] [başka biri|küçük bir çocuk] [kapısının önünde|cebinde] {O} buldu.']]],
    },
    close: ['[Sence|Peki sen olsan], {H} doğru olanı mı yaptı? [Yorumlara yaz|Cevabını yorumlara bırak].', '[Bazı hikâyeler bitmez|Bazı kapılar hiç kapanmaz]. [Sadece el değiştirir|Sadece bekler].', 'Ve unutma: {T} [her zaman göründüğü gibi değildir|bir gün seni de bulabilir].'],
    lessonClose: ['[Bazen|Çoğu zaman] [en büyük ders|en değerli hazine] [en küçük şeyde saklıdır|bir iyilikte saklıdır].', 'Ve {H} o gün şunu öğrendi: [acele eden, yolu kaybeder|verdiğin her şey bir gün sana döner|korku, cesaretin ilk adımıdır].'],
    loopClose: ['Ve {H} yine [o kapının önündeydi|o telefonun çalmasını bekliyordu]…'],
    inMedias: '[Ama bunu anlamak için|Nasıl buraya geldiğini anlamak için] [geriye gitmeliyiz|üç gün öncesine dönmeliyiz].',
    reverseMarks: ['Son.', 'Bir saat önce.', 'Bir gün önce.', 'Bir hafta önce.', 'Her şeyin başladığı an.', 'Çok daha önce.'],
    pastMark: '[Yıllar önce|1999 yılında].',
    nowMark: '[Bugün|Şimdi].',
    rel: { female: 'senin annenim', male: 'senin babanım', neutral: 'senin kardeşinim' },
    titles: ['{T}: [Kimsenin bilmediği hikâye|Sonunu kimse tahmin edemedi]', '{H} ve [o gece|son mektup|kayıp saat]', 'Ona {T} dediler. [Yanılıyorlardı|Ama gerçek başkaydı].', '{T}… ama bir şeyler ters gitti', '[Bu hikâyenin|Bu gecenin] sonunu kimse tahmin edemedi'],
    thumbs: ['ONU AÇMA', 'SON 60 SANİYE', 'KİM GÖNDERDİ?', 'GERİ DÖNME', 'GERÇEK BU MU?', 'ÇOK GEÇ'],
    logline: '{H}, {O} bulduğunda {T} ile ilgili [karanlık|tuhaf] bir gerçeğe yaklaşır; ama asıl sır [kendi geçmişinde|en güvendiği kişide] saklıdır.',
    narrator: 'Anlatıcı',
    motivation: {
      hook: ['[Bunu duymaya ihtiyacın var|Bu video sana denk geldiyse bir sebebi var].', 'Herkes {T} için [yetenek|şans] gerektiğini söyler. [Yanılıyorlar|Bu bir yalan].', '[Bir yıl sonra|Beş yıl sonra] bugüne bakıp ya teşekkür edeceksin ya da pişman olacaksın.'],
      problem: ['[Çoğu insan|İnsanların çoğu] {T} konusunda [başlamadan pes eder|ilk zorlukta durur]. [Çünkü sonucu hemen görmek ister|Çünkü mükemmel anı bekler].', '[Sorun yeteneğin değil|Sorun zamanın değil]. Sorun, [her gün yeniden başlamaman|kendine verdiğin sözü tutmaman].'],
      story: ['{H} [yıllarca reddedildi|sıfırdan başladı|herkesin güldüğü biriydi]. [Kimse ona inanmadı|Elinde hiçbir şey yoktu].', 'Ama {H} [her sabah 05.00\'te kalktı|her gün sadece bir adım attı|bir kez bile durmadı].'],
      mentor: ['[Yavaş git ama durma|Her gün bir adım. Sadece bir adım], {H}.', '[Kimse seni kurtarmaya gelmiyor|Bekleme], {H}. [Kendi kahramanın ol|Başla].'],
      principles: ['[Birinci|İlk] kural: [küçük başla|bugün başla|kimseden izin bekleme].', 'İkincisi: [sonuca değil, sürece âşık ol|kendini başkalarıyla değil, dünkü kendinle kıyasla].', 'Üçüncüsü: [düştüğünde kalk|vazgeçmek istediğinde, neden başladığını hatırla|disiplin, motivasyonun bittiği yerde başlar].'],
      cta: ['Şimdi [telefonu bırak|bu videoyu kapat] ve {T} için [ilk adımı at|bugün tek bir şey yap].', '[Hazır olmayı bekleme|Mükemmel zaman yok]. [Zaman şimdi|Başla].'],
      titles: ['{T}: [Bunu duymaya ihtiyacın var|Kimsenin sana söylemediği gerçek]', '{T} için [tek kural|3 basit kural]', 'Bir yıl sonra bana teşekkür edeceksin ({T})', '{T} hakkında [acı|rahatsız edici] bir gerçek'],
      thumbs: ['BUGÜN BAŞLA', 'TEK KURAL', 'BUNU DUY', 'VAZGEÇME'],
    },
    whatif: {
      hook: ['Ya [yarın sabah|bu gece] {T} gerçek olsaydı?', 'Bir düşün: {T}. [Peki ya gerçekten olsaydı|Hayatın nasıl değişirdi]?'],
      phases: ['İlk saniyede [kimse fark etmezdi|her şey normal görünürdü].', 'İlk saatte [sosyal medya çıldırırdı|telefonlar susmazdı|bilim insanları acil toplantıya çağrılırdı].', 'İlk gün [şehirler sessizleşirdi|insanlar sokaklara dökülürdü|marketlerdeki raflar boşalırdı].', 'Bir hafta sonra [yeni kurallar yazılırdı|dünya ikiye bölünürdü: inananlar ve inanmayanlar].', 'Bir yıl sonra [çocuklar bunu normal sanırdı|ekonomi yeniden şekillenirdi|haritalar değişirdi].', 'Ve yüz yıl sonra… [tarih kitapları bu günü dönüm noktası diye anlatırdı|kimse eskiden nasıl olduğunu hatırlamazdı].'],
      react: ['Buna [hazır mıyız|gerçekten hazır mıyız]?', '[Belki de|Ya] [bu bir fırsatsa|bu en iyisiyse]?', '[İnanamıyorum|Bu daha başlangıç].'],
      cta: ['Sen olsan [ilk ne yapardın|nereye giderdin]? [Yorumlara yaz|Yorumlarda konuşalım].'],
      note: 'Bu bir kurgu / varsayım senaryosudur.',
      titles: ['Ya {T} gerçek olsaydı?', '{T}: ilk saniyeden 100 yıl sonrasına', '{T} olsaydı dünya nasıl değişirdi?'],
    },
  },

  en: {
    places: {
      city: ['The forgotten back streets of the city', 'A neon-lit metropolis', 'An abandoned subway station', 'A small apartment in the shadow of skyscrapers'],
      forest: ['Deep inside a misty forest', 'An old grove nobody enters', 'A lonely cabin among the pines'],
      ocean: ['A windy coastal town', 'A lonely lighthouse', 'An old fishing harbor'],
      desert: ['A desert without a horizon', 'An old caravan road swallowed by sand'],
      space: ['A station millions of miles from Earth', 'The first colony on Mars', 'A silent orbit'],
      mountain: ['A snow-covered mountain pass', 'A village above the clouds'],
      interior: ['A dusty old bookshop', 'An old apartment', 'An empty hospital corridor at midnight'],
      village: ['A small town that is on no map', 'A one-road mountain village'],
      abstract: ['A place outside of time', 'Somewhere between memories'],
    },
    years: ['Autumn, 1987', 'The coldest night of November', 'A Tuesday morning, 6:12 a.m.', 'A week when the rain never stopped', 'The night the power went out', 'The year 2091', 'The last day of summer'],
    objects: ['a stopped pocket watch', 'an envelope with their own name on it', 'an old voice recording', 'a broken compass', 'a photograph of a stranger', 'a rusty key', 'a half-finished map', 'a music box nobody wound'],
    hooks: {
      question: ['[Have you ever wondered|Think about it]: what is {T} [really hiding|trying to tell us]?', 'What if {T} [is a warning|is an invitation|is a trap]?'],
      shock: ['By the end of this story, {H} will [lose everything|forget who they are|wake up inside a lie]. [And choose it|And you will never guess why].', '{H} had been missing for years. Until [a trace|a message|a photograph] of {T} appeared.'],
      cold_open: ['[The door knocked three times|The phone rang at 3:17 a.m.|The lights went out at once|Every clock stopped at the same second]. {H} [held their breath|did not move|was truly afraid for the first time].'],
      confession: ['[I have never told anyone this|I kept this secret for years]. I know something about {T}. And [tonight I will tell you|I cannot stay silent anymore].'],
      countdown: ['[Sixty|Ninety|Thirty] seconds. That is all {H} has to [find the truth|fix everything|escape].'],
      contradiction: ['Everyone tells the same story about {T}. [They are all wrong|None of them know the truth].', '{T}… [Sounds ordinary|Everybody knows that], right? [Listen to this|I thought so too].'],
      direct: ['If you were {H}, would you [open that door|read that letter|go back]? [Keep your answer until the end|Think carefully].'],
    },
    beats: {
      setup: [
        ['N', ['{P}. {Y}.', '{Y}. {P}.']],
        ['N', ['{H} [woke up at the same time every morning and walked the same road|had lived for years without asking anyone anything|believed their life was perfectly ordinary|was someone nobody noticed].', '{H} had [one habit|one rule]: [never look back|check the window every night|trust no one].']],
        ['H', ['[Another|Just another] ordinary day. [Nothing will happen|Same as always].', '[Someday|Maybe someday] [everything will change|someone will find me].'], 0.6],
      ],
      inciting: [
        ['N', ['[Until that day|Then one day], {H} found {O}.', '[On the doorstep|In a pocket|On the desk] there was {O}. [Something that should not have been there|Something never seen before].']],
        ['N', ['[And it all|The whole thing] [began|had to do] with {T}.', 'Only one [sentence|word] was written on it: “{T}”.']],
        ['H', ['This is [impossible|not possible]… [Who left this|How did this get here]?', '[Wait|Hold on]. I have seen this [before|somewhere].']],
      ],
      rising: [
        ['A', ['{H}, [leave it|put that back]. [Some doors should stay closed|You do not know what it is].', '[So|Finally] you found it. [I have been waiting for you|I knew this would happen].', '[Trust me|Listen to me], {T} is [not what you think|not a beginning, it is an ending].']],
        ['H', ['[What do you know|What are you hiding from me], {A}?', '[What if you are right|What if you are wrong]? [Then what|Is there a way back]?', 'I [cannot stop now|cannot go back now].']],
        ['N', ['[Every clue|Every step] took them [deeper|somewhere stranger than before].', '[Hours|Days] passed. {O} looked [a little different every night|heavier each time].'], 0.7],
      ],
      complication: [
        ['N', ['But [there was a problem|things did not go as planned]. {V} [was watching|knew every move|was always one step ahead].', '[Then|That night] {V} [appeared at the door|spoke for the first time].']],
        ['V', ['[Stop looking|Let it go], {H}. [You will not like the ending|What you find will change you].', '[You cannot run from me|Everyone ends up here]. [So did you|It is your turn].', '[I am not your enemy|I am trying to protect you]. [You do not understand yet|One day you will].']],
        ['H', ['[Who are you|What do you want from me]?', '[I am not afraid|I am not afraid anymore]. [I just want the truth|Let us end this].'], 0.8],
      ],
      crisis: [
        ['N', ['[When the storm began|When the clock struck midnight|When the lights flickered one last time], {H} [was alone|knew there was no way back].', '[Time was running out|Only minutes were left]. [Now or never|It had to be now].']],
        ['H', ['[Please|Come on]… [work|go right just this once].', '[If this is a mistake|If I am wrong], [I will pay for it|let it be mine].']],
      ],
    },
    twists: {
      self_letter: [['N', ['When {H} turned {O} over one last time, they recognized [the handwriting|the signature]. [It was their own|Their own].']], ['N', ['They had [written|sent] the message themselves, years later. [To warn themselves|To change this very moment].']]],
      helper_villain: [['N', ['And in that moment they understood: [from the very beginning|at every step], it was {A} who had led them here.']], ['A', ['[I am sorry|There was no other way], {H}. [It had to happen|I brought you here].']]],
      narrator_lies: [['N', ['[I did not tell you something|I lied to you]. In this story, {H} was [never alone|not just a witness].']], ['N', ['Because the one who opened that door that night [was me|was me all along].']]],
      time_loop: [['N', ['When the clock showed 3:17 again, {H} understood: [this night had happened before|the loop had never ended].']], ['H', ['How many times [have I been here|have I lived this]?']]],
      protector_monster: [['N', ['[The thing they feared|The thing in the shadows] did not attack. [It protected them|It stood in front of them].']], ['N', ['What they had run from for years [had been protecting them|was the only friend waiting for them].']]],
      they_are_ghost: [['N', ['In the mirror, [there was no one|there was only the room].']], ['N', ['There was a reason everyone ignored them. {H} [no longer belonged to this world|had been gone for years].']]],
      test_reward: [['N', ['The [reward|treasure] they were searching for [was a test|was a mirror]. And {H} [had already passed it|saw who they were for the first time].']]],
      stranger_family: [['V', ['[I remember the first day I saw you|I have been looking for you for years], {H}. I am {VREL}.']], ['N', ['{H} [fell silent|sank to the floor]. Every piece [fell into place|came together at once].']]],
      recording: [['N', ['And then [the screen went black|everything froze]. Words appeared: “Recording [ended|47 complete].”']], ['N', ['Everything {H} lived through [was a recording|was a simulation]. And [someone was watching|they had always known].']]],
      never_lost: [['N', ['What they [searched for|thought was lost] [was never lost|had been right beside them all along]. They had just [forgotten to look|refused to see].']]],
      role_swap: [['N', ['And then the roles reversed. {H} was no longer the hunted; {V} was the one running.']], ['V', ['[No|Wait]… [this was not supposed to happen|this was not the plan]!'], 0.7]],
      kindness_echo: [['N', ['{V} smiled. Years ago, {H} had [handed them a piece of bread|given them an umbrella|said one kind word to them], and they never forgot.']], ['V', ['[I came to repay my debt|Now it is my turn], {H}.']]],
    },
    endings: {
      open: [['N', ['{H} [opened the door|took the first step]. What lies on the other side, [nobody knows|nobody knows to this day].']]],
      bittersweet: [['N', ['[They won|They found the truth]. But [the price|what they lost] [would never come back|was heavier than anything].']], ['H', ['[Was it worth it|Worth it]? [I do not know|Maybe]… [but now I am free|but now I know].'], 0.7]],
      triumphant: [['N', ['And that morning, the sun rose for them [for the first time|for the first time in years].', '{H} [faced the fear|wrote their own fate]. And [won|everything changed].']], ['H', ['[It is over|Finally]. [Now I write my own story|Now I am ready].'], 0.7]],
      dark: [['N', ['[The door closed behind them|The lights never came back on]. And {H} [was never seen again|is still waiting there].']]],
      circular: [['N', ['[The next morning|Years later], [someone else|a little child] found {O} [on the doorstep|in a pocket].']]],
    },
    close: ['[Do you think|If you were there, would] {H} did the right thing? [Tell me in the comments|Leave your answer below].', '[Some stories never end|Some doors never close]. [They only change hands|They just wait].', 'And remember: {T} is [not always what it seems|might find you one day too].'],
    lessonClose: ['[Sometimes|More often than not], [the greatest lesson|the most precious treasure] [hides in the smallest thing|hides in a single kindness].', 'And that day {H} learned: [those who rush lose the road|everything you give comes back one day|fear is the first step of courage].'],
    loopClose: ['And once again, {H} [stood in front of that door|waited for the phone to ring]…'],
    inMedias: '[But to understand this|To understand how we got here], [we have to go back|we have to go back three days].',
    reverseMarks: ['The end.', 'One hour earlier.', 'One day earlier.', 'One week earlier.', 'The moment it all began.', 'Long before.'],
    pastMark: '[Years ago|In 1999].',
    nowMark: '[Today|Now].',
    rel: { female: 'your mother', male: 'your father', neutral: 'your sibling' },
    titles: ['{T}: [The story nobody knows|Nobody saw the ending coming]', '{H} and [that night|the last letter|the lost hour]', 'They called it {T}. [They were wrong|The truth was different].', '{T}… but something went wrong', 'Nobody predicted how [this story|this night] ends'],
    thumbs: ['DON\'T OPEN IT', 'LAST 60 SECONDS', 'WHO SENT IT?', 'DON\'T GO BACK', 'IS IT REAL?', 'TOO LATE'],
    logline: 'When {H} finds {O}, they get close to a [dark|strange] truth about {T}; but the real secret hides [in their own past|in the person they trust most].',
    narrator: 'Narrator',
    motivation: {
      hook: ['[You needed to hear this|If this video found you, there is a reason].', 'Everyone says {T} takes [talent|luck]. [They are wrong|That is a lie].', '[One year|Five years] from now you will look back at today with either gratitude or regret.'],
      problem: ['[Most people|Almost everyone] [quit {T} before they start|stops at the first obstacle]. [Because they want results now|Because they wait for the perfect moment].', '[The problem is not talent|The problem is not time]. It is [not starting again every day|breaking promises to yourself].'],
      story: ['{H} [was rejected for years|started from zero|was the one everyone laughed at]. [Nobody believed in them|They had nothing].', 'But {H} [got up at 5 a.m. every day|took just one step every day|never stopped, not once].'],
      mentor: ['[Go slow, but never stop|One step a day. Just one], {H}.', '[Nobody is coming to save you|Do not wait], {H}. [Be your own hero|Start].'],
      principles: ['Rule [one|number one]: [start small|start today|do not wait for permission].', 'Two: [fall in love with the process, not the result|compare yourself to who you were yesterday, not to others].', 'Three: [when you fall, get up|when you want to quit, remember why you started|discipline begins where motivation ends].'],
      cta: ['Now [put the phone down|close this video] and [take the first step|do one thing today] for {T}.', '[Do not wait to be ready|There is no perfect time]. [The time is now|Begin].'],
      titles: ['{T}: [You needed to hear this|The truth nobody tells you]', '[The one rule|3 simple rules] for {T}', 'You will thank me in a year ({T})', 'The [brutal|uncomfortable] truth about {T}'],
      thumbs: ['START TODAY', 'ONE RULE', 'HEAR THIS', 'DON\'T QUIT'],
    },
    whatif: {
      hook: ['What if {T} became real [tomorrow morning|tonight]?', 'Imagine: {T}. [What if it really happened|How would your life change]?'],
      phases: ['In the first second, [nobody would notice|everything would look normal].', 'In the first hour, [social media would explode|phones would not stop ringing|scientists would be called to emergency meetings].', 'On the first day, [cities would fall silent|people would fill the streets|store shelves would be empty].', 'A week later, [new rules would be written|the world would split in two: believers and doubters].', 'A year later, [children would think it was normal|the economy would reshape itself|maps would change].', 'And a hundred years later… [history books would call it a turning point|nobody would remember how it used to be].'],
      react: ['Are we [ready for this|really ready for this]?', '[Maybe|What if] [this is an opportunity|this is for the best]?', '[I cannot believe it|This is only the beginning].'],
      cta: ['What would you [do first|go first]? [Tell me in the comments|Let us talk in the comments].'],
      note: 'This is a fictional / hypothetical scenario.',
      titles: ['What if {T} were real?', '{T}: from the first second to 100 years later', 'How the world would change if {T}'],
    },
  },
};

// Bir sahnede hangi ruh hâli/zaman/hava/çekim kullanılacağı (yönetmen dili)
const BEAT_LOOK = {
  hook: { mood: 'mysterious', time: 'night', weather: 'fog', shot: 'Ekstrem yakın plan — en çarpıcı görüntü', camera: 'push_in' },
  setup: { mood: 'calm', time: 'dawn', weather: 'clear', shot: 'Geniş plan (establishing)', camera: 'pan_right' },
  inciting: { mood: 'mysterious', time: 'dusk', weather: 'clear', shot: 'Ekstrem yakın plan — obje', camera: 'push_in' },
  rising: { mood: 'tense', time: 'dusk', weather: 'fog', shot: 'Omuz üstü (OTS) diyalog', camera: 'pan_left' },
  complication: { mood: 'tense', time: 'night', weather: 'rain', shot: 'Alçak açı — tehdit hissi', camera: 'shake' },
  crisis: { mood: 'dark', time: 'night', weather: 'storm', shot: 'El kamerası, hızlı kesmeler', camera: 'shake' },
  twist: { mood: 'mysterious', time: 'night', weather: 'fog', shot: 'Yavaş zoom + Dutch açı, 1 sn sessizlik', camera: 'push_in' },
  resolution: { mood: 'hopeful', time: 'dawn', weather: 'clear', shot: 'Geniş plan, yukarı kreyn', camera: 'pull_out' },
  close: { mood: 'melancholic', time: 'dusk', weather: 'clear', shot: 'Siyaha geçiş öncesi son kare', camera: 'pull_out' },
  marker: { mood: 'mysterious', time: 'night', weather: 'clear', shot: 'Siyah ekran + başlık kartı', camera: 'static' },
};
const ENDING_LOOK = {
  open: { mood: 'mysterious', time: 'dawn', weather: 'fog' },
  bittersweet: { mood: 'melancholic', time: 'dusk', weather: 'clear' },
  triumphant: { mood: 'hopeful', time: 'dawn', weather: 'clear' },
  dark: { mood: 'dark', time: 'night', weather: 'rain' },
  circular: { mood: 'calm', time: 'day', weather: 'clear' },
};
const FORMAT_FLAVOR = {
  horror: { weather: 'fog', time: 'night', mood: 'dark' },
  scifi: { setting: 'space' },
  mystery: { mood: 'mysterious' },
  drama: { mood: 'warm' },
};

const PERSONALITY_BY_ROLE = {
  hero: [['brave', 'anxious'], ['warm', 'brave'], ['shy', 'brave'], ['anxious', 'warm'], ['playful', 'brave']],
  ally: [['wise', 'warm'], ['wise', 'mysterious'], ['cheerful', 'warm'], ['authoritative', 'wise']],
  other: [['cold', 'mysterious'], ['aggressive', 'authoritative'], ['mysterious', 'sad'], ['cold', 'authoritative'], ['playful', 'mysterious']],
};

function makeCharacter(role, rng, lang, usedNames) {
  const gender = rng.pick(['female', 'male']);
  const pool = (NAMES[lang] || NAMES.en)[gender === 'female' ? 'f' : 'm'].filter((n) => !usedNames.has(n));
  const name = rng.pick(pool);
  usedNames.add(name);
  const age = role === 'ally' ? rng.pick(['elder', 'elder', 'adult']) : role === 'hero' ? rng.pick(['young', 'adult', 'young', 'child']) : rng.pick(['adult', 'elder', 'young']);
  return {
    id: 'c' + Math.floor(rng.next() * 1e9).toString(36),
    name, gender, age,
    build: rng.pick(['slim', 'average', 'heavy']),
    personality: rng.pick(PERSONALITY_BY_ROLE[role]),
    role,
    look: '',
  };
}

export function makeNarrator(lang, rng, tone) {
  return {
    id: 'narrator', name: (TPL[lang] || TPL.en).narrator, role: 'narrator',
    gender: rng ? rng.pick(['male', 'female']) : 'male',
    age: 'adult', build: 'average',
    personality: tone === 'hopeful' ? ['warm', 'wise'] : ['mysterious', 'wise'],
    look: '',
  };
}

export const GENOME_SPEC = {
  structure: Object.keys(TIME_STRUCTURES),
  hook: Object.keys(HOOK_TYPES),
  twist: Object.keys(TWISTS),
  ending: Object.keys(ENDINGS),
  tone: ['noir', 'hopeful', 'melancholic', 'tense', 'epic', 'intimate'],
};

const cap = (s, lang) => (s ? s.charAt(0).toLocaleUpperCase(lang === 'tr' ? 'tr' : 'en') + s.slice(1) : s);

// Ana giriş: fikirden proje üret (yerleşik motor). İçerik dili tr veya en; diğer diller için
// en üretilip translate.js ile çevrilir (main.js yönetir).
export function generateBuiltin({ topic, format, lang, lengthMode, seed, aspect, namesLang }) {
  const L = TPL[lang] ? lang : 'en';
  const T = TPL[L];
  const rng = makeRng(seed);
  const genome = learning.pickGenome(GENOME_SPEC, rng);
  const fmt = FORMATS[format] || FORMATS.story;
  topic = (topic || '').trim() || rng.pick(L === 'tr' ? ['kayıp bir mektup', 'gece yarısı çalan telefon', 'unutulmuş bir şehir', 'eski bir fotoğraf'] : ['a lost letter', 'a phone ringing at midnight', 'a forgotten city', 'an old photograph']);

  const used = new Set();
  // Çeviri yapılacaksa isimler uluslararası havuzdan (ör. "Lale" → "Tulip" diye çevrilmesin)
  const NL = namesLang || L;
  const hero = makeCharacter('hero', rng, NL, used);
  const ally = makeCharacter('ally', rng, NL, used);
  const other = makeCharacter('other', rng, NL, used);
  const narrator = makeNarrator(L, rng, genome.tone);

  let mainSetting = inferSetting(topic) || (FORMAT_FLAVOR[format]?.setting) || rng.pick(SETTINGS.filter((s) => s !== 'abstract'));
  const vars = {
    H: hero.name, A: ally.name, V: other.name, T: topic,
    O: rng.pick(T.objects), P: rng.pick(T.places[mainSetting]), Y: rng.pick(T.years),
    VREL: T.rel[other.gender] || T.rel.neutral,
  };
  const F = (tpl) => cap(fill(tpl, vars, rng, L), L);
  const speakerId = { N: 'narrator', H: hero.id, A: ally.id, V: other.id };

  const scenes = [];
  const addScene = (beat, lines, overrides = {}) => {
    if (!lines.length) return;
    const look = { ...BEAT_LOOK[beat] };
    const flav = FORMAT_FLAVOR[format] || {};
    if (flav.mood && !['resolution', 'setup'].includes(beat)) look.mood = flav.mood;
    if (flav.time && beat !== 'resolution') look.time = flav.time;
    if (flav.weather && ['rising', 'crisis', 'twist'].includes(beat)) look.weather = flav.weather;
    let setting = mainSetting;
    if (beat === 'rising' && rng.chance(0.3)) setting = 'interior';
    if (beat === 'marker') setting = 'abstract';
    scenes.push({
      id: 's' + scenes.length + '_' + Math.floor(rng.next() * 1e6).toString(36),
      beat, setting, ...look, ...overrides,
      lines: lines.map(([who, text]) => ({ speaker: speakerId[who] || who, text })),
      media: null,
    });
  };
  // Shorts'ta her vuruş en fazla 2 satır, isteğe bağlı satırlar daha seyrek (hedef 30–55 sn).
  const short = lengthMode === 'short';
  const runBeat = (specs, cap = short ? 2 : 9) => {
    const out = [];
    for (const [who, alts, p] of specs) {
      if (p != null && !rng.chance(short ? p * 0.4 : p)) continue;
      if (out.length >= cap) break;
      out.push([who, F(rng.pick(alts))]);
    }
    return out;
  };

  // Kanca her zaman ilk sahne
  const hookTpl = rng.pick(T.hooks[genome.hook]);
  const hookLine = F(hookTpl);

  const chars = [hero, ally, other];
  let directorNotes = [], editorNotes = [];

  if (format === 'motivation') {
    const M = T.motivation;
    addScene('hook', [['N', F(rng.pick(M.hook))]], { mood: 'energetic', time: 'dawn', setting: rng.pick(['mountain', 'city', 'abstract']) });
    addScene('setup', [['N', F(rng.pick(M.problem))]], { mood: 'melancholic' });
    addScene('rising', [['N', F(M.story[0])], ['N', F(M.story[1])]], { mood: 'tense', setting: mainSetting });
    addScene('rising', [['A', F(rng.pick(M.mentor))]], { mood: 'warm', time: 'dusk' });
    const pr = lengthMode === 'short' ? M.principles.slice(0, 3) : M.principles;
    pr.forEach((p, i) => addScene('resolution', [['N', F(p)]], { mood: 'hopeful', time: ['dawn', 'day', 'dawn'][i % 3], setting: rng.pick(['mountain', 'ocean', 'city', 'forest']) }));
    addScene('close', [['N', F(rng.pick(M.cta))]], { mood: 'energetic', time: 'dawn', weather: 'clear', setting: 'mountain' });
    chars.splice(2, 1);
  } else if (format === 'whatif') {
    const W = T.whatif;
    addScene('hook', [['N', F(rng.pick(W.hook))]], { mood: 'epic', setting: mainSetting });
    const phases = lengthMode === 'short' ? W.phases.filter((_, i) => i !== 3) : W.phases;
    phases.forEach((ph, i) => {
      const lines = [['N', F(ph)]];
      if (i === 2 || (lengthMode !== 'short' && i === 4)) lines.push([i === 2 ? 'H' : 'A', F(rng.pick(W.react))]);
      addScene(i < 2 ? 'inciting' : i < 4 ? 'rising' : 'resolution', lines, { mood: ['mysterious', 'tense', 'tense', 'epic', 'hopeful', 'epic'][i], time: ['night', 'night', 'day', 'dusk', 'dawn', 'dawn'][i], setting: i === 5 ? 'space' : mainSetting });
    });
    addScene('close', [['N', F(rng.pick(W.cta))]]);
    chars.splice(2, 1);
    editorNotes.push(W.note);
  } else if (fmt.needsFacts) {
    // Uydurma bilgi üretmiyoruz: iskelet + açık yer tutucular. Gerçek bilgi için LLM bağla veya kendi metnini yapıştır.
    const isTr = L === 'tr';
    const n = format === 'list' ? 5 : 4;
    addScene('hook', [['N', isTr ? `${cap(topic, L)} hakkında bildiğini sandığın her şeyi unut.` : `Forget everything you think you know about ${topic}.`]]);
    for (let i = 1; i <= n; i++) {
      addScene(i === n ? 'twist' : 'rising', [['N', isTr ? `[${format === 'list' ? `${n - i + 1}. madde` : `${i}. bölüm`}: ${topic} ile ilgili doğrulanmış bir bilgiyi buraya yaz.]` : `[${format === 'list' ? `Item ${n - i + 1}` : `Part ${i}`}: write a verified fact about ${topic} here.]`]], { setting: mainSetting });
    }
    addScene('close', [['N', isTr ? 'Hangisi seni en çok şaşırttı? Yorumlara yaz.' : 'Which one surprised you most? Tell me in the comments.']]);
    chars.length = 0;
    editorNotes.push(isTr ? 'Bilgi içeriklerinde uydurma bilgi üretilmez. Köşeli parantezli satırları doğrulanmış bilgilerle doldur ya da Ayarlar’dan bir dil modeli bağla.' : 'Facts are not invented. Fill bracketed lines with verified facts or connect a language model in Settings.');
  } else {
    // Kurgu: zaman yapısına göre ritim
    const B = T.beats;
    const nComp = lengthMode === 'short' ? (rng.chance(0.4) ? 1 : 0) : lengthMode === 'medium' ? 2 : 4;
    const beatsSeq = { setup: () => runBeat(short ? [B.setup[1]] : B.setup), inciting: () => runBeat(B.inciting), rising: () => runBeat(B.rising), crisis: () => runBeat(B.crisis) };
    const twistLines = () => runBeat(T.twists[genome.twist].map(([w, a, p]) => [w, a, p]));
    const endLines = () => runBeat(T.endings[genome.ending] || T.endings.open);
    const endLook = ENDING_LOOK[genome.ending] || {};
    const closeLine = () => {
      if (genome.structure === 'loop') return [['N', F(rng.pick(T.loopClose))], ['N', hookLine]];
      if (format === 'lesson') return [['N', F(rng.pick(T.lessonClose))]];
      return [['N', F(rng.chance(0.6) ? T.close[0] : rng.pick(T.close))]]; // çoğunlukla yorum sorusu
    };

    addScene('hook', [['N', hookLine]], { setting: mainSetting });
    const comps = () => { for (let i = 0; i < nComp; i++) addScene('complication', runBeat(B.complication)); };

    switch (genome.structure) {
      case 'in_medias_res':
        addScene('crisis', beatsSeq.crisis());
        addScene('marker', [['N', F(T.inMedias)]]);
        addScene('setup', beatsSeq.setup());
        addScene('inciting', beatsSeq.inciting());
        addScene('rising', beatsSeq.rising());
        comps();
        addScene('twist', twistLines());
        addScene('resolution', endLines(), endLook);
        break;
      case 'reverse': {
        const marks = T.reverseMarks;
        addScene('resolution', [['N', F(marks[0])], ...endLines()], endLook);
        addScene('crisis', [['N', F(marks[1])], ...beatsSeq.crisis()]);
        if (nComp) addScene('complication', [['N', F(marks[2])], ...runBeat(B.complication)]);
        addScene('rising', [['N', F(marks[3])], ...beatsSeq.rising()]);
        addScene('inciting', [['N', F(marks[4])], ...beatsSeq.inciting()]);
        addScene('twist', [['N', F(marks[5])], ...twistLines()]);
        break;
      }
      case 'parallel': {
        const past = () => ['N', F(T.pastMark)], now = () => ['N', F(T.nowMark)];
        addScene('setup', [past(), ...beatsSeq.setup()], { time: 'day', mood: 'warm' });
        addScene('inciting', [now(), ...beatsSeq.inciting()]);
        addScene('rising', [past(), ...beatsSeq.rising()], { time: 'dusk', mood: 'warm' });
        comps();
        addScene('crisis', [now(), ...beatsSeq.crisis()]);
        addScene('twist', twistLines());
        addScene('resolution', endLines(), endLook);
        break;
      }
      default: // linear, loop
        addScene('setup', beatsSeq.setup());
        addScene('inciting', beatsSeq.inciting());
        addScene('rising', beatsSeq.rising());
        comps();
        addScene('crisis', beatsSeq.crisis());
        addScene('twist', twistLines());
        addScene('resolution', endLines(), endLook);
    }
    addScene('close', closeLine());
  }

  // Kullanılmayan karakterleri çıkar
  const usedIds = new Set(scenes.flatMap((s) => s.lines.map((l) => l.speaker)));
  const characters = chars.filter((c) => usedIds.has(c.id));

  const titlePool = format === 'motivation' ? T.motivation.titles : format === 'whatif' ? T.whatif.titles : T.titles;
  const title = F(rng.pick(titlePool));
  learning.rememberTitle(title);

  directorNotes = [
    `Zaman yapısı: ${TIME_STRUCTURES[genome.structure]}. Kanca: ${HOOK_TYPES[genome.hook]}. Twist: ${TWISTS[genome.twist]}. Son: ${ENDINGS[genome.ending]}.`,
    `Görsel dil: ${{ noir: 'yüksek kontrast, gölge ağırlıklı noir', hopeful: 'sıcak tonlar, altın saat ışığı', melancholic: 'soğuk mavi-gri, düşük doygunluk', tense: 'teal-turuncu, sert yan ışık', epic: 'geniş planlar, derin kontrast', intimate: 'yakın planlar, yumuşak ışık' }[genome.tone]}.`,
    'Kurulum-ödül: ilk sahnedeki motif nesne finalde anlam kazanmalı.',
    ...directorNotes,
  ];
  editorNotes = [
    aspect === '9:16' ? 'Shorts: ilk cümle 2 saniye içinde başlamalı; sahne başına 2–4 sn.' : 'Uzun video: 30. saniyede ikinci bir açık döngü kur.',
    'Twist’ten hemen önce 0.6 sn sessizlik (otomatik eklendi).',
    'Müzik diyalog altında otomatik kısılır (ducking).',
    ...editorNotes,
  ];

  const tagsBase = topic.split(/\s+/).filter((w) => w.length > 3).slice(0, 4);
  return {
    id: 'p' + seed.toString(36),
    seed, lang: L, format, aspect, lengthMode, genome, engine: 'builtin',
    title,
    logline: fmt.fiction ? F(T.logline) : cap(topic, L),
    hook: hookLine,
    thumbnailText: rng.pick(format === 'motivation' ? T.motivation.thumbs : T.thumbs),
    description: '',
    tags: [...new Set([...tagsBase, FORMATS[format]?.label.split(' ')[0].toLowerCase(), aspect === '9:16' ? 'shorts' : 'story'].filter(Boolean))],
    characters, narrator, scenes, directorNotes, editorNotes,
  };
}

// ---------------------------------------------------------------------------------------------
// "Metnimi videoya çevir": kullanıcının metnini olduğu gibi kullanır.
// Desteklenen biçim (hepsi isteğe bağlı):
//   @Ayşe: kadın, genç, ince, neşeli, gizemli     → karakter tanımı
//   # orman, gece, gergin, yağmur                  → yeni sahne başlığı
//   AYŞE: Replik...                                → diyalog
//   Diğer her satır                                → anlatıcı
// ---------------------------------------------------------------------------------------------
const TRAIT_WORDS = {
  gender: { female: ['kadın', 'kız', 'female', 'woman', 'girl'], male: ['erkek', 'adam', 'oğlan', 'male', 'man', 'boy'], neutral: ['belirsiz', 'neutral', 'robot', 'yapay'] },
  age: { child: ['çocuk', 'child', 'kid'], young: ['genç', 'young', 'teen'], adult: ['yetişkin', 'orta yaş', 'adult'], elder: ['yaşlı', 'ihtiyar', 'old', 'elder', 'dede', 'nine'] },
  build: { slim: ['ince', 'zayıf', 'slim', 'thin'], average: ['orta', 'average'], heavy: ['iri', 'kilolu', 'güçlü', 'heavy', 'big', 'kaslı'] },
  personality: {
    warm: ['sıcak', 'warm', 'şefkatli'], cold: ['soğuk', 'cold', 'mesafeli'], anxious: ['gergin', 'anxious', 'endişeli', 'korkak'],
    authoritative: ['otoriter', 'sert', 'authoritative', 'lider'], cheerful: ['neşeli', 'cheerful', 'mutlu'], mysterious: ['gizemli', 'mysterious'],
    wise: ['bilge', 'wise', 'akıllı'], aggressive: ['saldırgan', 'öfkeli', 'aggressive', 'sinirli'], shy: ['utangaç', 'shy', 'çekingen'],
    playful: ['muzip', 'şakacı', 'playful'], sad: ['hüzünlü', 'üzgün', 'sad'], brave: ['cesur', 'brave', 'gözüpek'],
  },
};
function parseTraits(text) {
  const t = text.toLocaleLowerCase('tr');
  const pick1 = (map, d) => Object.entries(map).find(([, ws]) => ws.some((w) => t.includes(w)))?.[0] || d;
  return {
    gender: pick1(TRAIT_WORDS.gender, 'neutral'),
    age: pick1(TRAIT_WORDS.age, 'adult'),
    build: pick1(TRAIT_WORDS.build, 'average'),
    personality: Object.entries(TRAIT_WORDS.personality).filter(([, ws]) => ws.some((w) => t.includes(w))).map(([k]) => k).slice(0, 3),
    look: text.trim(),
  };
}

export function scriptFromText(text, { lang, aspect, seed, format = 'story', lengthMode }) {
  const rng = makeRng(seed);
  const characters = [];
  const byName = new Map();
  const narrator = makeNarrator(lang, rng, 'tense');
  const isNarr = (n) => /^(anlatıcı|anlatici|narrator|n)$/i.test(n);
  const getChar = (name) => {
    const key = name.toLocaleLowerCase('tr');
    if (isNarr(name)) return narrator;
    if (!byName.has(key)) {
      const c = { id: 'c' + characters.length + '_' + Math.floor(rng.next() * 1e6).toString(36), name: name.charAt(0) + name.slice(1).toLocaleLowerCase(lang === 'tr' ? 'tr' : 'en'), gender: rng.pick(['female', 'male']), age: 'adult', build: 'average', personality: [], role: 'character', look: '' };
      characters.push(c);
      byName.set(key, c);
    }
    return byName.get(key);
  };

  const scenes = [];
  let cur = null;
  let lastSetting = inferSetting(text) || 'abstract';
  const perScene = aspect === '9:16' ? 2 : 3;
  const newScene = (header = '') => {
    const h = header || '';
    cur = {
      id: 's' + scenes.length + '_' + Math.floor(rng.next() * 1e6).toString(36),
      beat: scenes.length === 0 ? 'hook' : 'rising',
      setting: inferSetting(h) || lastSetting, time: inferTime(h) || 'dusk', mood: inferMood(h) || 'mysterious', weather: inferWeather(h) || 'clear',
      shot: '', camera: rng.pick(['push_in', 'pan_left', 'pan_right', 'pull_out']), lines: [], media: null, _explicit: !!header,
    };
    lastSetting = cur.setting;
    scenes.push(cur);
  };

  const raw = text.replace(/\r/g, '').split('\n');
  for (let line of raw) {
    line = line.trim();
    if (!line) { if (cur && cur.lines.length && !cur._explicit) cur = null; continue; }
    let m;
    if ((m = line.match(/^@\s*([^:]{1,30}):\s*(.+)$/))) {
      const c = getChar(m[1].trim());
      Object.assign(c, parseTraits(m[2]));
      continue;
    }
    if (line.startsWith('#')) { newScene(line.replace(/^#+\s*/, '').replace(/^(sahne|scene)\s*[:\-]?\s*/i, '')); continue; }
    if ((m = line.match(/^([A-Za-zÇĞİÖŞÜçğıöşüÂâÎîÛû][\wÇĞİÖŞÜçğıöşüÂâÎîÛû.' ]{0,22}):\s*(.+)$/)) && m[1].split(' ').length <= 3 && !/^\d/.test(m[1])) {
      const who = getChar(m[1].trim());
      if (!cur) newScene();
      cur.lines.push({ speaker: who.id, text: m[2].trim() });
      continue;
    }
    // Anlatı: cümlelere böl ve sahnelere dağıt
    for (const s of splitSentences(line)) {
      if (!cur || (!cur._explicit && cur.lines.length >= perScene)) newScene();
      if (!cur._explicit && cur.lines.length === 0) {
        const st = inferSetting(s); if (st) { cur.setting = st; lastSetting = st; }
        cur.mood = inferMood(s) || cur.mood; cur.time = inferTime(s) || cur.time; cur.weather = inferWeather(s) || cur.weather;
      }
      cur.lines.push({ speaker: 'narrator', text: s });
    }
  }
  const cleanScenes = scenes.filter((s) => s.lines.length).map(({ _explicit, ...s }) => s);
  if (cleanScenes.length) cleanScenes[cleanScenes.length - 1].beat = 'close';
  const first = cleanScenes[0]?.lines[0]?.text || '';
  return {
    id: 'p' + seed.toString(36), seed, lang, format, aspect, lengthMode, engine: 'text', genome: null,
    title: first.length > 70 ? first.slice(0, 67) + '…' : first,
    logline: '', hook: first, thumbnailText: '', description: '', tags: [],
    characters, narrator, scenes: cleanScenes,
    directorNotes: ['Metin olduğu gibi kullanıldı. Sahne mekânlarını ve ruh hâllerini aşağıdan düzenleyebilirsin.'],
    editorNotes: ['Kendi görselini/videonu her sahneye ekleyebilirsin (yalnızca bellekte tutulur).'],
  };
}
