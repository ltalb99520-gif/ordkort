/* The lexicon (scripts/lexicon.mjs): Wiktionary's words for every language of the site, in static files of this
   Worker (public/lex/<code>/<n>.json). A word is one file read, without a request to another site: so every word the
   AI writes can be looked up, not only the 30 a request may ask Wikimedia about.

   Not every deploy has it (it is made before a deploy, not kept in git) and not every language is in it: then
   `entry` answers undefined and the checks ask Wikimedia as before. null means the language is there and the word is
   not: Wiktionary has no such word (as of the lexicon's date). */
import { plain } from './wiktionary.js';

// Wiktionary's codes where they differ from ours (as in scripts/lexicon.mjs)
const WIKT = { sr: 'sh', hr: 'sh', bs: 'sh', prs: 'fa' };
export const codeOf = (lang) => WIKT[lang] || lang;
// the same hash as scripts/lexicon.mjs shardOf
export function shardOf(key, n) {
  let h = 0x811c9dc5;
  for (const ch of key) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return h % n;
}

// what this isolate has read: the files of a language stay a while (a deck's words are of one language)
const metas = new Map();
const shards = new Map();
const KEEP = 40;
async function read(env, path) {
  if (!env?.ASSETS) return null;
  const r = await env.ASSETS.fetch(new Request(`https://assets.local/lex/${path}`));
  if (!r.ok) { await r.body?.cancel(); return null; }
  return r.json();
}
async function meta(env, code) {
  if (!metas.has(code)) metas.set(code, read(env, `${code}/meta.json`).catch(() => null));
  const m = await metas.get(code);
  if (!m) metas.delete(code); // asked again next time: a deploy may bring it
  return m;
}
async function shard(env, code, i) {
  const k = `${code}/${i}`;
  if (shards.has(k)) { const v = shards.get(k); shards.delete(k); shards.set(k, v); return v; }
  const v = read(env, `${k}.json`).catch(() => null);
  shards.set(k, v);
  if (shards.size > KEEP) shards.delete(shards.keys().next().value);
  return v;
}

/* Everything the lexicon has under this spelling → [{ w, p, g, h, f, i, s } or { w, p, of }], [] when it has nothing,
   or undefined when there is no lexicon for the language */
export async function lookup(env, lang, word) {
  const code = codeOf(lang);
  const m = await meta(env, code);
  if (!m) return undefined;
  const key = plain(word, lang);
  if (!key) return [];
  const s = await shard(env, code, shardOf(key, m.n));
  return s?.[key] || [];
}

/* A word as the checks of a card want it (like wiktionary.js entry): { genders, forms, glosses, head, ipa }, null when
   the lexicon does not have it in this part of speech, undefined when there is no lexicon for the language. A form
   that points to its word ("fwyd" → bwyd) brings that word. */
export async function entry(env, lang, word, pos) {
  const list = await lookup(env, lang, word);
  if (!list) return undefined;
  let hits = list.filter((x) => x.p === pos && !x.of);
  if (!hits.length) {
    const of = list.find((x) => x.p === pos && x.of)?.of?.[0];
    if (of) hits = ((await lookup(env, lang, of)) || []).filter((x) => x.p === pos && !x.of);
  }
  if (!hits.length) return null;
  const want = plain(word, lang);
  return {
    genders: new Set(hits.flatMap((x) => [...(x.g || '')])),
    forms: new Set([want, ...hits.flatMap((x) => [x.w, ...(x.f || [])].map((f) => plain(f, lang)))]),
    glosses: hits.flatMap((x) => x.s || []),
    head: hits.map((x) => x.h).find(Boolean) || '',
    ipa: hits.map((x) => x.i).find(Boolean) || '',
  };
}

// whether the lexicon knows the word at all, in any part of speech (an adjective, an adverb): true, false, or
// undefined without a lexicon for the language
export async function knows(env, lang, word) {
  const list = await lookup(env, lang, word);
  return list ? list.length > 0 : undefined;
}

/* What a word means, in English: its glosses (of this part of speech, when one is given) and the English words whose
   translation tables give it ("масло": butter, oil; "mánnu": moon, month) → a Set of English texts, empty when the
   lexicon has nothing on the word, undefined without a lexicon for the language. English is itself. */
export async function english(env, lang, word, pos) {
  if (lang === 'en') return new Set([String(word).trim()]);
  const list = await lookup(env, lang, word);
  if (!list) return undefined;
  const out = new Set();
  for (const x of list) {
    for (const e of x.x || []) out.add(e);
    if (x.s && (!pos || x.p === pos)) for (const s of x.s) out.add(s);
  }
  // a form brings what its word means ("fwyd" → bwyd: food)
  const of = !out.size && list.find((x) => x.of && (!pos || x.p === pos))?.of?.[0];
  if (of) for (const s of await english(env, lang, of, pos)) out.add(s);
  return out;
}

// the words that carry the meaning of English glosses and translations: "to eat (food)" → eat, food
const STOP = new Set(['to', 'a', 'an', 'the', 'of', 'be', 'one', 'someone', 'something', 'somebody', 'oneself', 'in', 'on', 'at',
  'for', 'with', 'by', 'or', 'and', 'as', 'from', 'that', 'which', 'who', 'some', 'any', 'very', 'its', 'it', 'is', 'are', 'not',
  'usually', 'especially', 'etc', 'eg', 'ie', 'also', 'used', 'kind', 'type', 'sort', 'act', 'state', 'quality', 'into', 'up', 'out']);
export function meaningWords(texts) {
  const out = new Set();
  for (const t of texts) {
    for (const w of String(t).toLowerCase().replace(/\([^)]*\)/g, ' ').split(/[^\p{L}\p{M}'-]+/u)) {
      if (w.length < 2 || STOP.has(w)) continue;
      out.add(w);
      // plurals and verb forms of glosses: "eats", "cats" → eat, cat
      if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) out.add(w.slice(0, -1));
    }
  }
  return out;
}

// the files of the lexicon read by the tests, without the network: forget what this isolate has read
export function forget() { metas.clear(); shards.clear(); }
