// Editör gözü: senaryoyu izlenme/tutma (retention) açısından puanlar ve somut öneriler verir.
// Bu bir sezgisel kontrol listesidir; gerçek sonuç için YouTube Studio verilerini Öğrenme panelinde gir.

const LOOP_WORDS = ['ama', 'ta ki', 'fakat', 'oysa', 'birazdan', 'sonra', 'but', 'until', 'however', 'then', 'suddenly', 'aniden'];
const STRONG = ['asla', 'kimse', 'hiç', 'gerçek', 'sır', 'yalan', 'son', 'ölü', 'kayıp', 'imkânsız', 'never', 'nobody', 'secret', 'truth', 'lie', 'last', 'impossible', 'dead'];

export function analyze(project, totalSec) {
  const tips = [];
  let score = 0;
  const lines = project.scenes.flatMap((s) => s.lines);
  const first = (lines[0]?.text || '').toLocaleLowerCase('tr');
  const firstWords = first.split(/\s+/).length;
  const all = lines.map((l) => l.text.toLocaleLowerCase('tr')).join(' ');
  const vertical = project.aspect === '9:16';

  if (firstWords <= 16) score += 15; else tips.push(`Kanca çok uzun (${firstWords} kelime). İlk cümleyi 8–14 kelimeye indir.`);
  if (/[?!]/.test(first) || /\d/.test(first) || STRONG.some((w) => first.includes(w))) score += 10; else tips.push('Kancaya bir soru, sayı veya güçlü kelime ekle (ör. "kimse", "asla", "sır").');

  if (totalSec) {
    if (vertical) {
      if (totalSec >= 15 && totalSec <= 60) score += 15;
      else tips.push(totalSec > 60 ? `Shorts için ${Math.round(totalSec)} sn uzun; 30–55 sn hedefle (en zayıf sahneyi çıkar).` : 'Video çok kısa; bir gerilim sahnesi ekle.');
    } else if (totalSec >= 120) score += 15; else tips.push('Yatay video için en az 2–3 dakika hedefle ya da Shorts formatına geç.');
  } else score += 8;

  const title = project.title || '';
  if (title.length > 0 && title.length <= 60) score += 10; else tips.push('Başlığı 60 karakterin altına indir; telefonda kesilmesin.');
  const loops = LOOP_WORDS.reduce((a, w) => a + (` ${all} `.split(new RegExp(`[\\s,.!?…]${w}[\\s,.!?…]`)).length - 1), 0);
  if (loops >= 2) score += 10; else tips.push('Açık döngü yok: ortalara "Ama…", "Ta ki…" gibi merak köprüleri ekle.');
  const speakers = new Set(lines.map((l) => l.speaker));
  if (speakers.size >= 2) score += 10; else tips.push('Tek ses monoton olabilir: bir karakter repliği ekle (sesler otomatik farklılaşır).');
  const last = (lines[lines.length - 1]?.text || '');
  if (/\?/.test(last) || /yorum|comment|abone|subscribe/i.test(last)) score += 10; else tips.push('Finale izleyiciye bir soru sor (yorum etkileşimi artar).');
  if (project.scenes.some((s) => s.beat === 'twist')) score += 10; else tips.push('Bir twist / beklenmedik bilgi ekle.');
  const tw = (project.thumbnailText || '').split(/\s+/).filter(Boolean).length;
  if (tw >= 1 && tw <= 4) score += 10; else tips.push('Kapak metni 1–4 kelime olmalı.');
  const avgScene = totalSec ? totalSec / project.scenes.length : 0;
  if (avgScene && vertical && avgScene > 6) tips.push(`Sahne başına ortalama ${avgScene.toFixed(1)} sn: Shorts için sahneleri böl (2–4 sn).`);

  return { score: Math.min(100, score), tips };
}
