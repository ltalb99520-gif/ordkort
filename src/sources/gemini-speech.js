import { bump } from '../core/db.js';
import { readBytes } from '../core/util.js';

export const GEMINI_MODEL = 'gemini-3.8-flash-lite-tts';
export const GEMINI_VOICES = Object.freeze(['Kore','Puck','Zephyr','Charon','Aoede','Sulafat']);
export const GEMINI_LOCALES = Object.freeze({
  es: ['es-CL','es-MX','es-ES'], en: ['en-US','en-GB'], zh: ['zh-CN'],
  fr: ['fr-FR','fr-CA'], pt: ['pt-BR','pt-PT'], ja: ['ja-JP'],
  ko: ['ko-KR'], de: ['de-DE'], it: ['it-IT'],
});
const MAX_AUDIO = 512 * 1024;
export function geminiVoice(lang, id) {
  const match = /^gemini:([a-z]{2}-[A-Z]{2}):([A-Za-z]+)$/.exec(id || '');
  if (!match || !Object.hasOwn(GEMINI_LOCALES, lang) || !GEMINI_LOCALES[lang].includes(match[1]) || !GEMINI_VOICES.includes(match[2])) return null;
  return { locale: match[1], voice: match[2] };
}
export const geminiConfigured = env => typeof env.GEMINI_TTS_API_KEY === 'string' && !!env.GEMINI_TTS_API_KEY.trim();
export async function geminiSpeech(env, text, id, lang) {
  const choice = geminiVoice(lang, id);
  if (!geminiConfigured(env) || !choice || !text || text.length > 200) return null;
  // Independent from text-generation API. Conservative local caps, not Google's actual quota.
  const now = new Date().toISOString();
  const daily = Math.min(100, Math.max(0, Number(env.GEMINI_TTS_DAILY_REQUESTS ?? 20) || 0));
  if (!daily) return null;
  if (await bump(env.DB, 'gemini-tts:minute:' + now.slice(0,16), 120000, 1) > 2) return null;
  if (await bump(env.DB, 'gemini-tts:day:' + now.slice(0,10), 2*864e5, 1) > daily) return null;
  const accent = choice.locale === 'es-CL' ? 'natural Chilean Spanish (es-CL)' : choice.locale;
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    headers: {'x-goog-api-key': env.GEMINI_TTS_API_KEY, 'Content-Type':'application/json'},
    body: JSON.stringify({
      model: GEMINI_MODEL, store: false,
      input: [{type:'user_input',content:[{type:'text',text,annotations:[{type:'speech_metadata',style:'Pronounce exactly the provided text once, no introduction or explanation, clear learner-friendly articulation, accent: ' + accent}]}]}],
      response_format: {type:'audio',mime_type:'audio/wav',sample_rate:24000},
      generation_config: {speech_config:[{voice:choice.voice}]},
    }),
    signal: AbortSignal.timeout(15000),
  }).catch(()=>null);
  if (!res?.ok) return null;
  try {
    const raw = await readBytes(res.body, MAX_AUDIO * 2);
    const json = JSON.parse(new TextDecoder().decode(raw));
    const parts = (json.steps || []).filter(s=>s.type==='model_output').flatMap(s=>s.content || []).filter(p=>p.type==='audio');
    const data = parts.at(-1)?.data;
    if (typeof data !== 'string' || data.length > Math.ceil(MAX_AUDIO/3)*4) return null;
    const bytes = Uint8Array.from(atob(data), c=>c.charCodeAt(0));
    if (bytes.length < 44 || bytes.length > MAX_AUDIO || String.fromCharCode(...bytes.subarray(0,4)) !== 'RIFF' || String.fromCharCode(...bytes.subarray(8,12)) !== 'WAVE') return null;
    return bytes;
  } catch { return null; }
}
