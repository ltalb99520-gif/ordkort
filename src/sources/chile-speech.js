/* Optional Azure Chilean speech. Never expose the resource key or accept a caller-supplied endpoint. */
import { bump } from '../core/db.js';
import { readBytes } from '../core/util.js';

export const CHILE_VOICES = Object.freeze({
  catalina: 'es-CL-CatalinaNeural',
  lorenzo: 'es-CL-LorenzoNeural',
});
export const CLOUD_VOICES = Object.freeze({
  es: Object.freeze({...CHILE_VOICES, 'es-ES-ElviraNeural':'es-ES-ElviraNeural','es-MX-DaliaNeural':'es-MX-DaliaNeural'}),
  en: Object.freeze({'en-US-JennyNeural':'en-US-JennyNeural','en-US-GuyNeural':'en-US-GuyNeural','en-GB-SoniaNeural':'en-GB-SoniaNeural','en-AU-NatashaNeural':'en-AU-NatashaNeural'}),
  zh: Object.freeze({'zh-CN-XiaoxiaoNeural':'zh-CN-XiaoxiaoNeural','zh-CN-YunxiNeural':'zh-CN-YunxiNeural'}),
  fr: Object.freeze({'fr-FR-DeniseNeural':'fr-FR-DeniseNeural','fr-CA-SylvieNeural':'fr-CA-SylvieNeural'}),
  pt: Object.freeze({'pt-BR-FranciscaNeural':'pt-BR-FranciscaNeural','pt-PT-RaquelNeural':'pt-PT-RaquelNeural'}),
  ja: Object.freeze({'ja-JP-NanamiNeural':'ja-JP-NanamiNeural','ja-JP-KeitaNeural':'ja-JP-KeitaNeural'}),
  ko: Object.freeze({'ko-KR-SunHiNeural':'ko-KR-SunHiNeural','ko-KR-InJoonNeural':'ko-KR-InJoonNeural'}),
  de: Object.freeze({'de-DE-KatjaNeural':'de-DE-KatjaNeural','de-DE-ConradNeural':'de-DE-ConradNeural'}),
  it: Object.freeze({'it-IT-ElsaNeural':'it-IT-ElsaNeural','it-IT-DiegoNeural':'it-IT-DiegoNeural'}),
});
export function cloudVoice(lang, voice) {
  const group = Object.hasOwn(CLOUD_VOICES, lang) ? CLOUD_VOICES[lang] : null;
  return group && Object.hasOwn(group, voice) ? group[voice] : '';
}
const MONTH_BUDGET = 350000;
const DAY_BUDGET = 12000;
const MAX_AUDIO = 512 * 1024;
const xml = (s) => String(s).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export function configured(env) {
  return !!env.AZURE_SPEECH_KEY && /^[a-z0-9]{2,32}$/.test(env.AZURE_SPEECH_REGION || '');
}
export function ssml(text, voice, lang = 'es') {
  const name = cloudVoice(lang, voice);
  if (!name) throw new Error('invalid voice');
  return '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="' + name.split('-').slice(0,2).join('-') + '"><voice name="' + name + '">' + xml(text) + '</voice></speak>';
}
export async function chileSpeech(env, text, voice, lang = 'es') {
  if (!configured(env) || !cloudVoice(lang, voice) || !text || text.length > 200) return null;
  // Reserve before calling Azure; failed calls also count locally, conservatively.
  const day = new Date().toISOString().slice(0, 10);
  const amount = text.length;
  if (await bump(env.DB, 'azure-tts:day:' + day, 2 * 864e5, amount) > DAY_BUDGET) return null;
  if (await bump(env.DB, 'azure-tts:month:' + day.slice(0, 7), 40 * 864e5, amount) > MONTH_BUDGET) return null;
  const res = await fetch('https://' + env.AZURE_SPEECH_REGION + '.tts.speech.microsoft.com/cognitiveservices/v1', {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': env.AZURE_SPEECH_KEY,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
      'User-Agent': 'Ordkort',
    },
    body: ssml(text, voice, lang),
    signal: AbortSignal.timeout(10000),
  }).catch(() => null);
  if (!res?.ok || !/^audio\//i.test(res.headers.get('Content-Type') || '')) return null;
  const bytes = await readBytes(res.body, MAX_AUDIO).catch(() => null);
  if (!bytes?.length) return null;
  return bytes;
}
