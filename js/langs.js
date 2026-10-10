// Desteklenen diller: içerik dili (seslendirme) ve altyazı dilleri.
// piper: Piper ses ailesi kodu (tarayıcı içi ücretsiz TTS). null = seslendirme yok, sadece altyazı.

export const LANGS = [
  { code: 'tr', name: 'Türkçe', piper: 'tr_TR', mm: 'tr-TR' },
  { code: 'en', name: 'English', piper: 'en_US', mm: 'en-GB' },
  { code: 'es', name: 'Español', piper: 'es_ES', mm: 'es-ES' },
  { code: 'pt', name: 'Português (BR)', piper: 'pt_BR', mm: 'pt-BR' },
  { code: 'de', name: 'Deutsch', piper: 'de_DE', mm: 'de-DE' },
  { code: 'fr', name: 'Français', piper: 'fr_FR', mm: 'fr-FR' },
  { code: 'it', name: 'Italiano', piper: 'it_IT', mm: 'it-IT' },
  { code: 'ru', name: 'Русский', piper: 'ru_RU', mm: 'ru-RU' },
  { code: 'ar', name: 'العربية', piper: 'ar_JO', mm: 'ar-SA' },
  { code: 'hi', name: 'हिन्दी', piper: null, mm: 'hi-IN' },
  { code: 'id', name: 'Bahasa Indonesia', piper: null, mm: 'id-ID' },
  { code: 'ja', name: '日本語', piper: null, mm: 'ja-JP' },
  { code: 'ko', name: '한국어', piper: null, mm: 'ko-KR' },
  { code: 'zh', name: '中文', piper: 'zh_CN', mm: 'zh-CN' },
  { code: 'nl', name: 'Nederlands', piper: 'nl_NL', mm: 'nl-NL' },
  { code: 'pl', name: 'Polski', piper: 'pl_PL', mm: 'pl-PL' },
  { code: 'uk', name: 'Українська', piper: 'uk_UA', mm: 'uk-UA' },
  { code: 'vi', name: 'Tiếng Việt', piper: 'vi_VN', mm: 'vi-VN' },
  { code: 'fa', name: 'فارسی', piper: 'fa_IR', mm: 'fa-IR' },
  { code: 'az', name: 'Azərbaycan', piper: null, mm: 'az-AZ' },
];

export const langByCode = (c) => LANGS.find((l) => l.code === c) || LANGS[0];

// Piper seslerinin bilinen cinsiyetleri (ses seçiminde karakterle eşleştirmek için).
// Listede olmayanlar "u" (bilinmiyor) sayılır.
export const PIPER_GENDER = {
  'tr_TR-dfki-medium': 'm', 'tr_TR-fahrettin-medium': 'm', 'tr_TR-fettah-medium': 'm',
  'en_US-amy-medium': 'f', 'en_US-kathleen-low': 'f', 'en_US-kristin-medium': 'f', 'en_US-ljspeech-medium': 'f',
  'en_US-hfc_female-medium': 'f', 'en_US-lessac-medium': 'f', 'en_US-lessac-high': 'f',
  'en_US-ryan-medium': 'm', 'en_US-ryan-high': 'm', 'en_US-joe-medium': 'm', 'en_US-john-medium': 'm',
  'en_US-kusal-medium': 'm', 'en_US-hfc_male-medium': 'm', 'en_US-norman-medium': 'm', 'en_US-bryce-medium': 'm',
  'en_US-danny-low': 'm', 'en_US-lessac-low': 'f',
  'de_DE-thorsten-medium': 'm', 'de_DE-thorsten-high': 'm', 'de_DE-eva_k-x_low': 'f', 'de_DE-kerstin-low': 'f',
  'de_DE-ramona-low': 'f', 'de_DE-karlsson-low': 'm', 'de_DE-pavoque-low': 'm',
  'es_ES-davefx-medium': 'm', 'es_ES-carlfm-x_low': 'm', 'es_MX-ald-medium': 'm', 'es_MX-claude-high': 'f',
  'fr_FR-siwis-medium': 'f', 'fr_FR-gilles-low': 'm', 'fr_FR-tom-medium': 'm',
  'it_IT-paola-medium': 'f', 'it_IT-riccardo-x_low': 'm',
  'pt_BR-faber-medium': 'm', 'pt_PT-tugao-medium': 'm',
  'ru_RU-irina-medium': 'f', 'ru_RU-denis-medium': 'm', 'ru_RU-dmitri-medium': 'm', 'ru_RU-ruslan-medium': 'm',
  'ar_JO-kareem-medium': 'm', 'ar_JO-kareem-low': 'm',
  'zh_CN-huayan-medium': 'f', 'zh_CN-huayan-x_low': 'f',
  'nl_NL-mls-medium': 'u', 'nl_BE-nathalie-medium': 'f', 'nl_BE-rdh-medium': 'm',
  'pl_PL-gosia-medium': 'f', 'pl_PL-darkman-medium': 'm', 'pl_PL-mc_speech-medium': 'm',
  'uk_UA-lada-x_low': 'f', 'uk_UA-ukrainian_tts-medium': 'u',
  'fa_IR-amir-medium': 'm', 'fa_IR-gyro-medium': 'm',
  'vi_VN-vais1000-medium': 'f', 'vi_VN-25hours_single-low': 'f',
};

// Karakter isim havuzları (yerleşik hikâye motoru için).
export const NAMES = {
  tr: {
    f: ['Ayşe', 'Elif', 'Zeynep', 'Defne', 'Melis', 'Selin', 'Nehir', 'Ece', 'Asya', 'Derya', 'Lale', 'Sevda', 'İpek', 'Nur', 'Ada', 'Mira', 'Feride', 'Güneş'],
    m: ['Kerem', 'Emir', 'Arda', 'Mert', 'Kaan', 'Deniz', 'Selim', 'Cem', 'Baran', 'Tuna', 'Orhan', 'Yusuf', 'Rüzgar', 'Demir', 'Ozan', 'Kemal', 'Atlas', 'Doruk'],
  },
  en: {
    f: ['Mara', 'Iris', 'Nora', 'Clara', 'June', 'Lena', 'Ava', 'Hazel', 'Ruth', 'Elena', 'Sloane', 'Wren', 'Vera', 'Tess'],
    m: ['Elias', 'Theo', 'Jonah', 'Silas', 'Owen', 'Adrian', 'Cole', 'Felix', 'Victor', 'Leo', 'Hugo', 'Abel', 'Cyrus', 'Dorian'],
  },
};

export const UI_TRAITS = {
  gender: { female: 'Kadın', male: 'Erkek', neutral: 'Belirsiz' },
  age: { child: 'Çocuk', young: 'Genç', adult: 'Yetişkin', elder: 'Yaşlı' },
  build: { slim: 'İnce', average: 'Orta', heavy: 'İri' },
  personality: {
    warm: 'Sıcakkanlı', cold: 'Soğuk', anxious: 'Gergin', authoritative: 'Otoriter', cheerful: 'Neşeli',
    mysterious: 'Gizemli', wise: 'Bilge', aggressive: 'Saldırgan', shy: 'Utangaç', playful: 'Muzip', sad: 'Hüzünlü', brave: 'Cesur',
  },
};
