// The lexicon (scripts/lexicon.mjs → public/lex/, read by src/sources/lexicon.js): Wiktionary entries as kaikki.org
// extracts them, made small, split into files, and looked up by the checks of the AI's words. The entries below are
// cut-down copies of real kaikki.org lines (Northern Sami and Welsh).
import test from 'node:test';
import assert from 'node:assert/strict';
import { compact, build, translations } from '../scripts/lexicon.mjs';
import * as L from '../src/sources/lexicon.js';
import { check } from '../src/sources/wiktionary.js';
import { App } from '../src/core/shared.js';

const LINES = {
  se: [
    { pos: 'noun', word: 'čáhci', lang_code: 'se', sounds: [{ ipa: '/ˈt͡ʃaːht͡siː/' }], forms: [{ form: 'no-table-tags', tags: ['table-tags'] }, { form: 'i-stem', tags: ['class'] }, { form: 'čáhci', tags: ['nominative', 'singular'] }, { form: 'čázit', tags: ['nominative', 'plural'] }, { form: 'čázi', tags: ['genitive', 'singular'] }], senses: [{ glosses: ['water'] }] },
    { pos: 'noun', word: 'mánnu', lang_code: 'se', forms: [{ form: 'mánut', tags: ['nominative', 'plural'] }], senses: [{ glosses: ['moon'] }, { glosses: ['month'] }] },
    { pos: 'noun', word: 'biebmu', lang_code: 'se', forms: [{ form: 'biepmu', tags: ['genitive', 'singular'] }], senses: [{ glosses: ['food, sustenance'] }] },
    { pos: 'verb', word: 'borrat', lang_code: 'se', forms: [{ form: 'boran', tags: ['first-person', 'singular', 'present'] }], senses: [{ glosses: ['to eat'] }] },
    { pos: 'adj', word: 'buorre', lang_code: 'se', forms: [{ form: 'buoret', tags: ['comparative'] }], senses: [{ glosses: ['good'] }] },
    { pos: 'verb', word: 'bone', lang_code: 'se', senses: [{ form_of: [{ word: 'botnit' }], glosses: ['inflection of botnit'] }] },
    { pos: 'character', word: 'A', lang_code: 'se', senses: [{ glosses: ['The first letter'] }] },
  ],
  cy: [
    { pos: 'noun', word: 'bwyd', lang_code: 'cy', head_templates: [{ expansion: 'bwyd m (plural bwydydd)' }], forms: [{ form: 'bwydydd', tags: ['plural'] }, { form: 'fwyd', tags: ['soft'], source: 'mutation' }, { form: 'bwyd', tags: ['error-unrecognized-form'] }], senses: [{ glosses: ['food'], tags: ['masculine'] }] },
    { pos: 'noun', word: 'fwyd', lang_code: 'cy', senses: [{ form_of: [{ word: 'bwyd' }], glosses: ['soft mutation of bwyd'], tags: ['form-of'] }] },
    { pos: 'noun', word: 'coffi', lang_code: 'cy', senses: [{ glosses: ['coffee'], tags: ['masculine'] }] },
  ],
  ru: [
    { pos: 'noun', word: 'еда́', lang_code: 'ru', senses: [{ glosses: ['food'] }] },
  ],
  // English entries: their translation tables tell what words of other languages mean
  en: [
    { pos: 'noun', word: 'moon', lang_code: 'en', senses: [{ glosses: ['the Moon'] }], translations: [{ lang_code: 'se', word: 'mánnu' }, { lang_code: 'ru', word: 'луна́' }] },
    { pos: 'noun', word: 'butter', lang_code: 'en', senses: [{ glosses: ['a dairy product'] }], translations: [{ lang_code: 'ru', word: 'ма́сло' }, { lang_code: 'se', word: 'vuodja' }] },
    { pos: 'noun', word: 'oil', lang_code: 'en', senses: [{ glosses: ['liquid fat'] }], translations: [{ lang_code: 'ru', word: 'ма́сло' }] },
    { pos: 'noun', word: 'food', lang_code: 'en', senses: [{ glosses: ['what is eaten'] }], translations: [{ lang_code: 'se', word: 'biebmu' }, { lang_code: 'ru', word: 'пи́ща' }, { lang_code: 'xx', word: 'nope' }] },
  ],
};

// the files the build writes, served as a Worker's static assets are
function assets() {
  const files = new Map();
  const wanted = new Set(Object.keys(LINES));
  const tables = LINES.en.flatMap((e) => translations(e, wanted));
  for (const [code, lines] of Object.entries(LINES)) {
    const { shards } = build([...lines.map(compact).filter(Boolean), ...tables.filter(([c]) => c === code).map(([, x]) => x)], code);
    shards.forEach((s, i) => files.set(`/lex/${code}/${i}.json`, JSON.stringify(s)));
    files.set(`/lex/${code}/meta.json`, JSON.stringify({ n: shards.length }));
  }
  const reads = [];
  return {
    reads,
    ASSETS: { fetch: async (req) => { const p = new URL(req.url).pathname; reads.push(p); return files.has(p) ? new Response(files.get(p)) : new Response('', { status: 404 }); } },
  };
}

// one database for the file: initDB makes the schema once per process
let db1;
async function database() {
  if (db1) return db1;
  const { default: initSqlJs } = await import('sql.js');
  const { initDB } = await import('../src/core/db.js');
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  const stmt = (sql, args = []) => ({
    first: async () => { const s = db.prepare(sql); s.bind(args); const row = s.step() ? s.getAsObject() : null; s.free(); return row; },
    all: async () => { const s = db.prepare(sql); s.bind(args); const results = []; while (s.step()) results.push(s.getAsObject()); s.free(); return { results }; },
    run: async () => { db.run(sql, args); return { meta: { changes: db.getRowsModified() } }; },
  });
  db1 = { prepare: (sql) => ({ ...stmt(sql), bind: (...a) => stmt(sql, a) }), batch: async (list) => { for (const p of list) await p.run(); return []; } };
  await initDB(db1);
  return db1;
}

test('an entry made small: word, class, gender, headword line, forms without the extractor’s notes, IPA, glosses', () => {
  assert.deepEqual(compact(LINES.cy[0]), { w: 'bwyd', p: 'noun', g: 'm', h: 'bwyd m (plural bwydydd)', f: ['bwydydd', 'fwyd'], s: ['food'] });
  assert.deepEqual(compact(LINES.se[0]).f, ['čázit', 'čázi']);
  assert.equal(compact(LINES.se[0]).i, '/ˈt͡ʃaːht͡siː/');
  assert.deepEqual(compact(LINES.cy[1]), { w: 'fwyd', p: 'noun', of: ['bwyd'] }, 'a form of another word points to it');
  assert.equal(compact(LINES.se[6]), null, 'a letter is no word for a card');
});

test('a word is found in its file; the AI’s invented words are not there; a mutated form brings its word', async () => {
  L.forget();
  const env = assets();
  assert.deepEqual((await L.entry(env, 'se', 'mánnu', 'noun')).glosses, ['moon', 'month'], 'moon, not butter');
  assert.equal(await L.entry(env, 'se', 'biebbu', 'noun'), null, 'no such word');
  assert.equal(await L.entry(env, 'se', 'borrat', 'noun'), null, 'a verb, not a noun');
  assert.ok((await L.entry(env, 'se', 'čáhci', 'noun')).forms.has('čázit'));
  const fwyd = await L.entry(env, 'cy', 'fwyd', 'noun');
  assert.deepEqual([...fwyd.genders], ['m']);
  assert.equal(fwyd.head, 'bwyd m (plural bwydydd)');
  assert.equal(await L.knows(env, 'se', 'buorre'), true);
  assert.equal(await L.knows(env, 'se', 'čáppas'), false);
  assert.equal(await L.knows(env, 'kl', 'anaana'), undefined, 'no lexicon for the language: cannot tell');
  const before = env.reads.length;
  await L.knows(env, 'se', 'buorre');
  assert.equal(env.reads.length, before, 'a file read once stays in the isolate');
  L.forget();
  assert.equal(await L.knows({}, 'se', 'buorre'), undefined, 'no lexicon in this deploy');
});

test('a card is checked against the lexicon without asking Wiktionary: forms it never heard of go, an unknown word is told apart', async () => {
  L.forget();
  const env = assets();
  const real = globalThis.fetch;
  let asked = 0;
  globalThis.fetch = async () => { asked++; throw new TypeError('offline'); };
  const cache = { get: async () => null, set: async () => {} };
  const lex = (lemma, pos) => L.entry(env, 'se', lemma, pos);
  try {
    assert.equal((await check(cache, 'se', { term: 'čáhci', pos: 'noun', forms: 'čázit, čázi, čáhcit' }, { lex })).forms, 'čázit, čázi, čáhcit',
      'too few forms known to judge: nothing is dropped');
    assert.deepEqual(await check(cache, 'se', { term: 'biebbu', pos: 'noun' }, { lex }), { none: 1 });
    assert.equal(asked, 0, 'Wiktionary was not asked');
  } finally { globalThis.fetch = real; }
});

test('the bank: the AI’s Northern Sami words are looked up, adjectives too, and an answer of mostly invented words is not shared', async () => {
  L.forget();
  const api = await import('../src/ai/routes.js');
  const DB = await database();
  const env = { DB, GROQ_API_KEY: 'k', GROQ_MODELS: 'lex1', ...assets() };
  const topic = App.topics.list[0].id;
  // as the bank of 2026-11-19 had them: real words with wrong meanings, and invented ones
  const ai = ['biebbu', 'sivdnjat', 'juohtit', 'biehkit', 'čáppas', 'mánnu', 'buorre', 'gáffe', 'bivdu', 'suovas', 'čáhci']
    .map((term, i) => ({ term, tr: `слово ${i}`, pos: ['juohtit', 'biehkit'].includes(term) ? 'verb' : ['čáppas', 'buorre'].includes(term) ? 'adjective' : 'noun', gram: '', forms: '', pron: '', ex: '', ex_tr: '' }));
  const real = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (!String(url).includes('groq')) throw new TypeError('offline');
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ words: ai }) } }] }), { status: 200 });
  };
  try {
    const req = new Request('https://ordkort.test/api/words', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target: 'se', native: 'ru', topic, level: 'A1', n: 20 }) });
    const out = await (await api.words(req, env, 'ante.home')).json();
    const by = Object.fromEntries(out.words.map((w) => [w.term, w]));
    assert.equal(by.biebbu.nf, 1);
    assert.equal(by.čáppas.nf, 1, 'an adjective is looked up too');
    assert.equal(by.buorre.nf, undefined);
    assert.equal(by.buorre.chk, 1);
    assert.equal(by.mánnu.nf, undefined);
    const row = await DB.prepare('SELECT count(*) AS n FROM words').first();
    assert.equal(row.n, 0, 'most of what a dictionary could judge is not in it: nothing shared');
  } finally { globalThis.fetch = real; }
});

test('a translation is compared with what the word means: "mánnu" is the moon, not butter; "biebmu" is food', async () => {
  L.forget();
  const env = assets();
  assert.deepEqual(translations(LINES.en[3], new Set(['se', 'ru'])), [['se', { t: 'biebmu', x: 'food' }], ['ru', { t: 'пи́ща', x: 'food' }]], 'only languages of the site');
  assert.deepEqual([...await L.english(env, 'ru', 'масло')].sort(), ['butter', 'oil'], 'stress marks are no part of the spelling');
  assert.deepEqual([...await L.english(env, 'se', 'mánnu', 'noun')].sort(), ['month', 'moon'], 'its glosses and the English word whose table gives it');
  assert.deepEqual([...L.meaningWords(['to eat (food)', 'the Moon', 'cats'])].sort(), ['cat', 'cats', 'eat', 'moon']);
  const api = await import('../src/ai/routes.js');
  const DB = await database();
  const real = globalThis.fetch;
  const ai = [['mánnu', 'масло'], ['biebmu', 'еда, пища'], ['čáhci', 'вода']].map(([term, tr]) => ({ term, tr, pos: 'noun', gram: '', forms: '', pron: '', ex: '', ex_tr: '' }));
  globalThis.fetch = async (url) => {
    if (!String(url).includes('groq')) throw new TypeError('offline');
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ words: ai }) } }] }), { status: 200 });
  };
  try {
    const req = new Request('https://ordkort.test/api/words', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target: 'se', native: 'ru', topic: App.topics.list[0].id, level: 'A1', n: 5 }) });
    const out = await (await api.words(req, { DB, GROQ_API_KEY: 'k', GROQ_MODELS: 'lex2', ...env }, 'ante.home')).json();
    const by = Object.fromEntries(out.words.map((w) => [w.term, w]));
    assert.equal(by.mánnu.tm, 1, 'moon, month against butter, oil');
    assert.equal(by.biebmu.tm, undefined, 'food');
    assert.equal(by.biebmu.mc, 1);
    assert.equal(by.čáhci.tm, undefined, 'the lexicon knows nothing of "вода" here: cannot tell, left as it is');
    assert.equal(api.verified(by.mánnu), false);
  } finally { globalThis.fetch = real; }
});

test('a topic’s words in a language the AI knows little come from the dictionary: English words of the topic lead to real ones', async () => {
  L.forget();
  const env = assets();
  // English entries keep their translations (scripts/lexicon.mjs split): tr: { se: ["čáhci"] }
  const water = { ...compact({ pos: 'noun', word: 'water', lang_code: 'en', senses: [{ glosses: ['a liquid'] }] }), tr: { se: ['čáhci'], ru: ['вода́'] } };
  const { shards } = build([water], 'en');
  const files = new Map(shards.map((s, i) => [`/lex/en/${i}.json`, JSON.stringify(s)]));
  files.set('/lex/en/meta.json', JSON.stringify({ n: shards.length }));
  const inner = env.ASSETS.fetch;
  env.ASSETS.fetch = async (req) => { const p = new URL(req.url).pathname; return files.has(p) ? new Response(files.get(p)) : inner(req); };
  assert.deepEqual(await L.fromEnglish(env, 'se', ['water', 'fire']), [{ word: 'čáhci', en: 'water' }]);
  assert.deepEqual(await L.fromEnglish(env, 'ru', ['water']), [{ word: 'вода', en: 'water' }], 'without the stress mark dictionaries add');
  const { wordsPrompt } = await import('../src/ai/prompts.js');
  const p = wordsPrompt({ target: 'se', native: 'ru', topic: 'Food', level: 'A1', n: 5, avoid: [], dict: [{ word: 'čáhci', en: 'water' }] });
  assert.match(p.user, /ONLY from this list of real Northern Sámi words.*čáhci = water/s);
  assert.doesNotMatch(wordsPrompt({ target: 'se', native: 'ru', topic: 'Food', level: 'A1', n: 5, avoid: [] }).user, /ONLY from this list/);
});
