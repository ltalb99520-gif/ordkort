// The lexicon: Wiktionary (en.wiktionary.org, CC BY-SA 4.0 / GFDL) as extracted by wiktextract (kaikki.org), made
// small and split into files the Worker reads one at a time (src/sources/lexicon.js). With it every word the AI writes
// is looked up in a real dictionary at once: no request to Wikimedia, no budget of 50 requests, no tokens.
//
//   node scripts/lexicon.mjs [file.jsonl[.gz] …]
//
// Without files it downloads kaikki.org's raw data of the English Wiktionary (about 3 GB, updated weekly) into
// .lexicon/ and reads that. Any of kaikki.org's per-language files (kaikki.org-dictionary-Welsh.jsonl) works too.
// Writes public/lex/<code>/<n>.json and public/lex/<code>/meta.json for the languages of the site (public/js/langs.js),
// under Wiktionary's codes ("sh" for Serbian, Croatian and Bosnian). public/lex/ is not in git: it is made before a deploy.
//
// A shard holds the words whose plain spelling (wiktionary.js plain()) hashes to it: { "<plain>": [entry, …] }, an
// entry being { w: word, p: part of speech, g: genders ("m", "mf"…), h: the headword line ("bwyd m (plural bwydydd)"),
// f: forms, i: IPA, s: glosses }, or { x: [English words whose translation tables give it] }. Forms of a word that have an entry of their own ("čázi": a form of čáhci) are kept
// with the word, and point to it under their own spelling ({ w, p, of: lemma }), so an inflected form is found too.
import { createReadStream, createWriteStream, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync, readFileSync } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { createInterface } from 'node:readline';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import { App } from '../src/core/shared.js';
import { plain } from '../src/sources/wiktionary.js';
import { codeOf, shardOf } from '../src/sources/lexicon.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const OUT = join(ROOT, 'public', 'lex');
const WORK = join(ROOT, '.lexicon');
const RAW = 'https://kaikki.org/dictionary/raw-wiktextract-data.jsonl.gz';

// Wiktionary's codes and the shard of a word: the same functions the Worker reads the files with
export { codeOf, shardOf };
// Wiktionary's languages that make up one of the site's: Paraguayan Guaraní is the Guaraní taught, and Nahuatl has
// its classical and central forms in Wiktionary
const MERGE = { gug: 'gn', nci: 'nah', nhn: 'nah' };
// about this many bytes a shard: small enough to read and parse in a millisecond or two, few enough files for the
// 20,000 a Worker's static assets may have
export const SHARD_BYTES = 160 * 1024;

const POS = {
  noun: 'noun', verb: 'verb', adj: 'adjective', adv: 'adverb', pron: 'pronoun', prep: 'preposition', postp: 'preposition',
  conj: 'conjunction', num: 'numeral', intj: 'interjection', phrase: 'phrase', prep_phrase: 'phrase', proverb: 'phrase',
  det: 'determiner', article: 'article', particle: 'particle', contraction: 'other', name: 'name',
};
const GENDERS = { masculine: 'm', feminine: 'f', neuter: 'n', common: 'c' };
// forms that are notes of the extractor, not words
const JUNK = new Set(['table-tags', 'inflection-template', 'class', 'error-unrecognized-form', 'romanization', 'transliteration']);
const MAX_FORMS = 48, MAX_GLOSSES = 3, GLOSS = 90, HEAD = 120, MAX_ENGLISH = 12, MAX_TRANSLATIONS = 3;

/* One wiktextract entry → a compact one, or null for what a learner's card never is (letters, affixes, names) */
export function compact(e) {
  const p = POS[e.pos];
  if (!p || p === 'name' || !e.word) return null;
  const senses = e.senses || [];
  const of = senses.flatMap((s) => [...(s.form_of || []), ...(s.alt_of || [])]).map((x) => x.word).filter(Boolean);
  // an entry that is only a form or spelling of another word: a pointer to that word
  if (of.length && senses.every((s) => s.form_of || s.alt_of || (s.tags || []).includes('form-of'))) return { w: e.word, p, of: [...new Set(of)].slice(0, 3) };
  const tags = new Set([...(e.tags || []), ...senses.flatMap((s) => s.tags || [])]);
  const g = Object.entries(GENDERS).filter(([t]) => tags.has(t)).map(([, x]) => x).join('');
  const forms = [];
  for (const f of e.forms || []) {
    const t = f.tags || [];
    if (!f.form || t.some((x) => JUNK.has(x)) || f.form === e.word || /^[-–—]$/.test(f.form)) continue;
    if (!forms.includes(f.form)) forms.push(f.form);
    if (forms.length >= MAX_FORMS) break;
  }
  const out = { w: e.word, p };
  if (g) out.g = g;
  const head = (e.head_templates || []).map((h) => h.expansion).find((x) => x && x !== e.word);
  if (head) out.h = head.slice(0, HEAD);
  if (forms.length) out.f = forms;
  const ipa = (e.sounds || []).find((s) => s.ipa)?.ipa;
  if (ipa) out.i = ipa;
  const glosses = [...new Set(senses.flatMap((s) => s.glosses?.slice(-1) || []))].filter(Boolean).slice(0, MAX_GLOSSES).map((x) => x.slice(0, GLOSS));
  if (glosses.length) out.s = glosses;
  return out;
}

/* The translation tables of an English entry ("water": se čáhci, ru вода, kl imeq…) → [[code, { t: word, x: English
   word }]]: a word of a language with the English words it translates, so a card's translation can be compared with
   the meaning of its word in any language, the learner's too */
export function translations(e, wanted) {
  if (!POS[e.pos] || POS[e.pos] === 'name' || !e.word) return [];
  const out = [], seen = new Set();
  for (const t of e.translations || []) {
    const code = MERGE[t.lang_code || t.code] || t.lang_code || t.code;
    const word = String(t.word || '').trim();
    if (!wanted.has(code) || code === 'en' || !word || word.length > 40 || seen.has(code + word)) continue;
    seen.add(code + word);
    out.push([code, { t: word, x: e.word }]);
  }
  return out;
}

async function download() {
  mkdirSync(WORK, { recursive: true });
  const file = join(WORK, 'raw-wiktextract-data.jsonl.gz');
  if (existsSync(file) && Date.now() - statSync(file).mtimeMs < 7 * 864e5) return file;
  console.log('downloading', RAW);
  const r = await fetch(RAW, { headers: { 'User-Agent': 'Ordkort lexicon build (https://ordkort.com)' } });
  if (!r.ok) throw new Error('kaikki.org ' + r.status);
  await pipeline(r.body, createWriteStream(file));
  return file;
}

const lines = (file) => createInterface({ input: file.endsWith('.gz') ? createReadStream(file).pipe(createGunzip()) : createReadStream(file), crlfDelay: Infinity });

/* Pass 1: every entry of a language of the site into a file of its own, compact */
async function split(files, wanted) {
  const tmp = join(WORK, 'split');
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
  const outs = new Map();
  let n = 0, kept = 0;
  for (const file of files) {
    for await (const line of lines(file)) {
      if (!line) continue;
      n++;
      if (n % 500000 === 0) console.log(`${n} entries read, ${kept} kept`);
      // the entry's own language: not the first "lang_code" of the line, which may be one of its translations or
      // descendants (about one entry in eight)
      const e = JSON.parse(line);
      const code = MERGE[e.lang_code] || e.lang_code;
      if (!code || !wanted.has(code)) continue;
      const put = (lang, x) => {
        if (!outs.has(lang)) outs.set(lang, createWriteStream(join(tmp, lang + '.jsonl')));
        outs.get(lang).write(JSON.stringify(x) + '\n');
      };
      const tables = code === 'en' ? translations(e, wanted) : [];
      for (const [lang, x] of tables) put(lang, x);
      const c = compact(e);
      if (!c) continue;
      // an English word keeps its translations too (tr: { se: ["čáhci"], kl: ["imeq"] }), the words a topic's
      // list can be made of in a language the AI knows little (src/ai/routes.js dictionaryWords)
      if (tables.length && !c.of) {
        c.tr = {};
        for (const [lang, x] of tables) if ((c.tr[lang] ||= []).length < MAX_TRANSLATIONS) c.tr[lang].push(x.t);
      }
      put(code, c);
      kept++;
    }
  }
  await Promise.all([...outs.values()].map((s) => new Promise((res) => s.end(res))));
  console.log(`${n} entries read, ${kept} kept, ${outs.size} languages`);
  return tmp;
}

/* Pass 2: a language's entries merged by word and part of speech, forms joined to their word, then into shards */
export function build(entries, code) {
  const byKey = new Map(); // plain spelling → entries
  const add = (key, x) => { if (!byKey.has(key)) byKey.set(key, []); byKey.get(key).push(x); };
  const words = new Map(); // "word|pos" → entry
  const pointers = [];
  const english = new Map(); // plain spelling → English words it translates (from English translation tables)
  for (const e of entries) {
    if (e.t) {
      const key = plain(e.t, code);
      if (!english.has(key)) english.set(key, new Set());
      if (english.get(key).size < MAX_ENGLISH) english.get(key).add(e.x);
      continue;
    }
    if (e.of) { pointers.push(e); continue; }
    const k = e.w + '|' + e.p;
    const had = words.get(k);
    if (!had) { words.set(k, e); continue; }
    // the same word and class in two etymologies: one entry with both
    if (e.g) had.g = [...new Set((had.g || '') + e.g)].join('');
    if (e.f) had.f = [...new Set([...(had.f || []), ...e.f])].slice(0, MAX_FORMS);
    if (e.s) had.s = [...new Set([...(had.s || []), ...e.s])].slice(0, MAX_GLOSSES + 1);
    had.h ||= e.h; had.i ||= e.i;
    if (e.tr) for (const [lang, list] of Object.entries(e.tr)) had.tr = { ...had.tr, [lang]: [...new Set([...(had.tr?.[lang] || []), ...list])].slice(0, MAX_TRANSLATIONS) };
  }
  for (const e of words.values()) add(plain(e.w, code), e);
  for (const ptr of pointers) {
    // a form with an entry of its own goes with its word too (so a check of the word's forms knows it)
    for (const lemma of ptr.of) {
      const e = words.get(lemma + '|' + ptr.p);
      if (e && !(e.f || []).includes(ptr.w) && (e.f || []).length < MAX_FORMS) (e.f ||= []).push(ptr.w);
    }
    const key = plain(ptr.w, code);
    if (!byKey.get(key)?.some((x) => !x.of && x.p === ptr.p)) add(key, { w: ptr.w, p: ptr.p, of: ptr.of });
  }
  for (const [key, x] of english) if (key) add(key, { x: [...x] });
  const size = [...byKey].reduce((t, [k, v]) => t + k.length + JSON.stringify(v).length + 4, 0);
  const n = Math.max(1, Math.ceil(size / SHARD_BYTES));
  const shards = Array.from({ length: n }, () => ({}));
  for (const [k, v] of byKey) shards[shardOf(k, n)][k] = v;
  return { shards, words: words.size, keys: byKey.size };
}

async function main() {
  const args = process.argv.slice(2);
  const files = args.length ? args : [await download()];
  const ours = App.langs.list.map((l) => l.code);
  const wanted = new Set(ours.map(codeOf));
  const tmp = await split(files, wanted);
  rmSync(OUT, { recursive: true, force: true });
  let total = 0;
  const report = [];
  for (const f of readdirSync(tmp)) {
    const code = f.replace(/\.jsonl$/, '');
    const entries = readFileSync(join(tmp, f), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
    const { shards, words, keys } = build(entries, code);
    const dir = join(OUT, code);
    mkdirSync(dir, { recursive: true });
    shards.forEach((s, i) => writeFileSync(join(dir, `${i}.json`), JSON.stringify(s)));
    writeFileSync(join(dir, 'meta.json'), JSON.stringify({ n: shards.length, words, keys, source: 'Wiktionary (en.wiktionary.org) via kaikki.org/wiktextract', license: 'CC BY-SA 4.0', built: new Date().toISOString().slice(0, 10) }));
    total += shards.length + 1;
    report.push([code, words, shards.length]);
  }
  report.sort((a, b) => b[1] - a[1]);
  for (const [code, words, n] of report) console.log(`${code.padEnd(5)} ${String(words).padStart(8)} words ${String(n).padStart(5)} files`);
  console.log(`${total} files in public/lex/ (a Worker may have 20,000 static assets in all, the site has about 4,000 of its own)`);
  if (total > 15000) console.warn('too many files: raise SHARD_BYTES');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();
