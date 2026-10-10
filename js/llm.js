// Dil modeli sağlayıcıları — hepsi ücretsiz kullanılabilir:
//  - builtin : Yerleşik motor (çevrimdışı, anahtarsız). Her zaman çalışır.
//  - webllm  : Model tarayıcıda (WebGPU) çalışır. Anahtar yok, ücret yok; ilk seferde model indirilir.
//  - gemini  : Google AI Studio ücretsiz katman anahtarı.
//  - openai  : OpenAI uyumlu herhangi bir uç nokta (Groq ücretsiz, OpenRouter ":free" modeller, yerel Ollama/LM Studio).
// API anahtarları varsayılan olarak SADECE bellekte tutulur.

import { store, makeRng } from './util.js';
import { FORMATS, HOOK_TYPES, TIME_STRUCTURES, TWISTS, ENDINGS } from './knowledge.js';
import { SETTINGS, MOODS, TIMES, WEATHERS, makeNarrator, GENOME_SPEC } from './story.js';
import { learning } from './learn.js';
import { langByCode } from './langs.js';

export const PRESETS = {
  groq: { base: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile', note: 'console.groq.com → ücretsiz anahtar' },
  openrouter: { base: 'https://openrouter.ai/api/v1', model: 'meta-llama/llama-3.3-70b-instruct:free', note: 'openrouter.ai → ":free" modeller ücretsiz' },
  ollama: { base: 'http://localhost:11434/v1', model: 'llama3.1', note: 'Bilgisayarında Ollama çalışıyorsa (tamamen yerel)' },
  lmstudio: { base: 'http://localhost:1234/v1', model: 'local-model', note: 'LM Studio yerel sunucu' },
};

const REMEMBER_KEY = 'yzs.llm.cfg';
export const llmConfig = Object.assign(
  { provider: 'builtin', geminiKey: '', geminiModel: 'gemini-2.5-flash', oaBase: PRESETS.groq.base, oaKey: '', oaModel: PRESETS.groq.model, webllmModel: 'Qwen2.5-3B-Instruct-q4f16_1-MLC', remember: false },
  store.get(REMEMBER_KEY, {}),
);
export function saveLlmConfig() {
  if (llmConfig.remember) store.set(REMEMBER_KEY, llmConfig);
  else store.set(REMEMBER_KEY, { provider: llmConfig.provider, geminiModel: llmConfig.geminiModel, oaBase: llmConfig.oaBase, oaModel: llmConfig.oaModel, webllmModel: llmConfig.webllmModel, remember: false });
}

let webllmEngine = null, webllmLoaded = '';
async function getWebLLM(onProgress) {
  if (webllmEngine && webllmLoaded === llmConfig.webllmModel) return webllmEngine;
  if (!navigator.gpu) throw new Error('Bu tarayıcı WebGPU desteklemiyor. Chrome/Edge güncel sürüm gerekir.');
  const webllm = await import('https://esm.run/@mlc-ai/web-llm@0.2.79');
  webllmEngine = await webllm.CreateMLCEngine(llmConfig.webllmModel, {
    initProgressCallback: (p) => onProgress?.(p.text || '', p.progress || 0),
  });
  webllmLoaded = llmConfig.webllmModel;
  return webllmEngine;
}

export function llmAvailable() { return llmConfig.provider !== 'builtin'; }

export async function chat(messages, { temperature = 1.0, json = false, seed, onProgress, maxTokens = 3500 } = {}) {
  const p = llmConfig.provider;
  if (p === 'gemini') {
    if (!llmConfig.geminiKey) throw new Error('Gemini anahtarı girilmemiş (Ayarlar).');
    const sys = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n');
    const contents = messages.filter((m) => m.role !== 'system').map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(llmConfig.geminiModel)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': llmConfig.geminiKey },
      body: JSON.stringify({
        systemInstruction: sys ? { parts: [{ text: sys }] } : undefined,
        contents,
        generationConfig: { temperature, maxOutputTokens: maxTokens, ...(json ? { responseMimeType: 'application/json' } : {}), ...(seed != null ? { seed: seed % 2147483647 } : {}) },
      }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error?.message || 'Gemini hatası ' + r.status);
    return j.candidates?.[0]?.content?.parts?.map((x) => x.text).join('') || '';
  }
  if (p === 'openai') {
    const headers = { 'Content-Type': 'application/json' };
    if (llmConfig.oaKey) headers.Authorization = 'Bearer ' + llmConfig.oaKey;
    const r = await fetch(llmConfig.oaBase.replace(/\/$/, '') + '/chat/completions', {
      method: 'POST', headers,
      body: JSON.stringify({ model: llmConfig.oaModel, messages, temperature, max_tokens: maxTokens, ...(seed != null ? { seed: seed % 2147483647 } : {}), ...(json ? { response_format: { type: 'json_object' } } : {}) }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error?.message || 'API hatası ' + r.status);
    return j.choices?.[0]?.message?.content || '';
  }
  if (p === 'webllm') {
    const eng = await getWebLLM(onProgress);
    const r = await eng.chat.completions.create({ messages, temperature, max_tokens: maxTokens, seed: seed != null ? seed % 2147483647 : undefined, ...(json ? { response_format: { type: 'json_object' } } : {}) });
    return r.choices?.[0]?.message?.content || '';
  }
  throw new Error('Dil modeli seçilmedi.');
}

export function parseJsonLoose(text) {
  let t = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a >= 0 && b > a) t = t.slice(a, b + 1);
  try { return JSON.parse(t); } catch {}
  // küçük onarımlar: sondaki virgüller, akıllı tırnaklar
  t = t.replace(/,\s*([}\]])/g, '$1').replace(/[“”]/g, '"');
  return JSON.parse(t);
}

const ENUMS = {
  setting: SETTINGS, time: Object.keys(TIMES), mood: Object.keys(MOODS), weather: Object.keys(WEATHERS),
  gender: ['female', 'male', 'neutral'], age: ['child', 'young', 'adult', 'elder'], build: ['slim', 'average', 'heavy'],
  personality: ['warm', 'cold', 'anxious', 'authoritative', 'cheerful', 'mysterious', 'wise', 'aggressive', 'shy', 'playful', 'sad', 'brave'],
  camera: ['push_in', 'pull_out', 'pan_left', 'pan_right', 'tilt_up', 'shake', 'static'],
};
const oneOf = (v, list, d) => (list.includes(v) ? v : d);

// Senarist + yönetmen + editör rolü için sistem istemi.
function systemPrompt() {
  return `You are three experts in one: a visionary film director with Christopher Nolan-level command of non-linear time, tension and setup/payoff; a master screenwriter; and a top YouTube retention editor who knows what makes viewers stay (strong hook in the first 2 seconds, open loops, pattern interrupts, emotional payoff, loopable endings for Shorts).
You write ORIGINAL scripts for faceless AI YouTube videos. Never copy existing films or stories. Never present invented facts as real: for factual formats only include well-established, verifiable facts; otherwise frame as fiction/hypothetical.
Always reply with a single valid JSON object only, no markdown.`;
}

function userPrompt({ topic, format, lang, lengthMode, aspect, genome, avoid }) {
  const L = langByCode(lang).name;
  const fmt = FORMATS[format]?.label || format;
  const sceneCount = lengthMode === 'short' ? '7-10' : lengthMode === 'medium' ? '14-20' : '25-35';
  const words = lengthMode === 'short' ? '90-140' : lengthMode === 'medium' ? '450-700' : '1100-1600';
  return `Write a YouTube ${aspect === '9:16' ? 'Shorts (vertical)' : 'video (16:9)'} script.
Topic / idea: "${topic}"
Format: ${fmt}
Language for ALL spoken lines, title, description: ${L}
Total spoken words: ~${words}. Scenes: ${sceneCount}.
Creative dice for THIS version (must follow, they make each version unique):
- Time structure: ${TIME_STRUCTURES[genome.structure]} (${genome.structure})
- Hook type: ${HOOK_TYPES[genome.hook]} (${genome.hook})
- Twist: ${TWISTS[genome.twist]} (${genome.twist}) ${FORMATS[format]?.fiction ? '' : '(use only if it fits a non-fiction format, otherwise use a surprising insight)'}
- Ending: ${ENDINGS[genome.ending]} (${genome.ending})
- Visual tone: ${genome.tone}
${avoid.length ? `Do NOT reuse these previous titles or their plots: ${avoid.map((t) => `"${t}"`).join(', ')}` : ''}
Characters: 0-4, each clearly distinct in appearance AND inner nature (this drives their unique voice). A narrator speaks as "narrator".

Return JSON exactly in this shape:
{
 "title": "max 60 chars, curiosity gap",
 "logline": "one sentence",
 "hook": "the very first spoken line",
 "thumbnail_text": "max 4 words, uppercase",
 "description": "YouTube description, 2-4 sentences + 3-5 hashtags",
 "tags": ["8-12 tags"],
 "characters": [{"name":"","gender":"female|male|neutral","age":"child|young|adult|elder","build":"slim|average|heavy","personality":["2-3 of: ${ENUMS.personality.join(', ')}"],"look":"short appearance description","role":"hero|ally|antagonist|other"}],
 "scenes": [{"setting":"${SETTINGS.join('|')}","time":"dawn|day|dusk|night","mood":"${Object.keys(MOODS).join('|')}","weather":"${Object.keys(WEATHERS).join('|')}","shot":"shot type & framing (director)","camera":"${ENUMS.camera.join('|')}","visual":"what we see, 1 sentence","lines":[{"speaker":"narrator or exact character name","text":"spoken line"}]}],
 "director_notes": ["3-5 notes"],
 "editor_notes": ["3-5 notes on pacing, cuts, retention"]
}`;
}

export async function generateWithLLM({ topic, format, lang, lengthMode, aspect, seed, onProgress }) {
  const rng = makeRng(seed);
  const genome = learning.pickGenome(GENOME_SPEC, rng);
  const avoid = learning.recentTitles();
  const raw = await chat(
    [{ role: 'system', content: systemPrompt() }, { role: 'user', content: userPrompt({ topic, format, lang, lengthMode, aspect, genome, avoid }) }],
    { temperature: 1.05, json: true, seed, onProgress },
  );
  const j = parseJsonLoose(raw);
  const narrator = makeNarrator(lang, rng, genome.tone);
  const characters = (j.characters || []).slice(0, 6).map((c, i) => ({
    id: 'c' + i + '_' + Math.floor(rng.next() * 1e6).toString(36),
    name: String(c.name || `Karakter ${i + 1}`).slice(0, 30),
    gender: oneOf(c.gender, ENUMS.gender, 'neutral'),
    age: oneOf(c.age, ENUMS.age, 'adult'),
    build: oneOf(c.build, ENUMS.build, 'average'),
    personality: (Array.isArray(c.personality) ? c.personality : []).filter((p) => ENUMS.personality.includes(p)).slice(0, 3),
    look: String(c.look || ''),
    role: String(c.role || 'other'),
  }));
  const byName = new Map(characters.map((c) => [c.name.toLocaleLowerCase(), c]));
  const scenes = (j.scenes || []).map((s, i) => ({
    id: 's' + i + '_' + Math.floor(rng.next() * 1e6).toString(36),
    beat: i === 0 ? 'hook' : i === j.scenes.length - 1 ? 'close' : 'rising',
    setting: oneOf(s.setting, ENUMS.setting, 'abstract'),
    time: oneOf(s.time, ENUMS.time, 'dusk'),
    mood: oneOf(s.mood, ENUMS.mood, 'mysterious'),
    weather: oneOf(s.weather, ENUMS.weather, 'clear'),
    shot: String(s.shot || ''), camera: oneOf(s.camera, ENUMS.camera, 'push_in'), visual: String(s.visual || ''),
    lines: (s.lines || []).filter((l) => l && l.text).map((l) => {
      const sp = String(l.speaker || 'narrator').toLocaleLowerCase();
      const c = byName.get(sp);
      return { speaker: c ? c.id : 'narrator', text: String(l.text).trim() };
    }),
    media: null,
  })).filter((s) => s.lines.length);
  if (!scenes.length) throw new Error('Model geçerli sahne üretmedi.');
  // twist sahnesini işaretle (sessizlik vurgusu için): sondan 2-3. sahne
  if (scenes.length > 4) scenes[scenes.length - 3].beat = 'twist';
  learning.rememberTitle(j.title);
  return {
    id: 'p' + seed.toString(36), seed, lang, format, aspect, lengthMode, genome, engine: llmConfig.provider,
    title: String(j.title || topic), logline: String(j.logline || ''), hook: String(j.hook || scenes[0].lines[0].text),
    thumbnailText: String(j.thumbnail_text || ''), description: String(j.description || ''),
    tags: Array.isArray(j.tags) ? j.tags.map(String).slice(0, 15) : [],
    characters, narrator, scenes,
    directorNotes: Array.isArray(j.director_notes) ? j.director_notes.map(String) : [],
    editorNotes: Array.isArray(j.editor_notes) ? j.editor_notes.map(String) : [],
  };
}
