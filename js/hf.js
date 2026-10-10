// Ücretsiz Hugging Face Space'lerini (Gradio) tarayıcıdan doğrudan çağırmak için küçük istemci.
// Kullanılanlar kullanıcının GitHub fork'larının resmi demolarıdır:
//   k2-fsa/OmniVoice (OmniVoice fork'u) — çok dilli ses tasarımı + klonlama
//   Lightricks/LTX-2-3 (LTX-2 fork'u)   — görselden videoya

// İsteğe bağlı ücretsiz HF erişim anahtarı (hf.co/settings/tokens, "read" yeterli): ZeroGPU kotasını artırır.
// Varsayılan olarak sadece bellekte tutulur.
export const hfAuth = { token: '' };

function headers(json) {
  const h = {};
  if (json) h['Content-Type'] = 'application/json';
  if (hfAuth.token) h.Authorization = 'Bearer ' + hfAuth.token;
  return h;
}

export async function gradioCall(host, api, data, { signal } = {}) {
  const r = await fetch(`${host}/gradio_api/call/${api}`, { method: 'POST', headers: headers(true), body: JSON.stringify({ data }), signal });
  if (!r.ok) throw new Error(`${host.replace('https://', '')} yanıt vermedi (${r.status})`);
  const { event_id } = await r.json();
  const s = await fetch(`${host}/gradio_api/call/${api}/${event_id}`, { headers: headers(false), signal });
  const txt = await s.text();
  const events = txt.split('\n\n').map((b) => {
    const ev = /event: (\w+)/.exec(b)?.[1];
    const d = /data: (.*)/s.exec(b)?.[1];
    return { ev, d };
  });
  const done = events.find((e) => e.ev === 'complete');
  if (done) return JSON.parse(done.d);
  const err = events.find((e) => e.ev === 'error');
  let msg = err?.d && err.d !== 'null' ? err.d : 'Hugging Face ücretsiz GPU kotası dolmuş ya da Space meşgul. Ayarlar’a ücretsiz HF anahtarı ekle veya daha sonra tekrar dene.';
  try { msg = JSON.parse(msg)?.message || msg; } catch {}
  throw new Error(msg);
}

export async function gradioUpload(host, blob, name) {
  const fd = new FormData();
  fd.append('files', blob, name);
  const r = await fetch(`${host}/gradio_api/upload`, { method: 'POST', headers: headers(false), body: fd });
  if (!r.ok) throw new Error('Yükleme başarısız (' + r.status + ')');
  const [path] = await r.json();
  return { path, meta: { _type: 'gradio.FileData' }, orig_name: name, mime_type: blob.type };
}

export async function gradioFile(fileData) {
  const r = await fetch(fileData.url, { headers: headers(false) });
  if (!r.ok) throw new Error('Dosya indirilemedi (' + r.status + ')');
  return r.arrayBuffer();
}
