/* AI request handlers. The order is always the same:
   validate the input → look in the shared base → only if it is not there, take one from the limit and ask Groq →
   check the answer → save it to the shared base for everyone who asks next. */
import { App, LEVELS, lang, pairOf } from '../core/shared.js';
import { groq } from './groq.js';
import { cacheGet, cacheSet, cacheForget, cacheOf, bump, peek } from '../core/db.js';
import { takeAI, aiLeft, takeSimple, NET_OF_WHO } from '../core/limits.js';
import { HttpError, json, readJSON, str, arr, int, sha256, norm, today } from '../core/util.js';
import * as P from './prompts.js';
import * as W from '../sources/wiktionary.js';
import * as D from '../sources/dicts.js';
import * as L from '../sources/lexicon.js';

const BUILT_IN_UI = ['en', 'ru', 'uk', 'nb', 'nn', 'ar', 'zh'];
const UI_CHUNK = 90;
const WEEK = 7 * 864e5;

const h32 = async (s) => (await sha256(s)).slice(0, 32);

/* Cache keys — one place, so that reports can find exactly the entry that was served */
const KEYS = {
  lookup: async (t, n, b) => `d1:${t}:${n}:${await h32(str(b.q, 60).toLowerCase())}`,
  chapter: async (t, n, b) => `g1:${t}:${n}:${b.id}`,
  ask: async (t, n, b) => `a1:${t}:${n}:${await h32(str(b.q, 300).toLowerCase())}`,
  translate: async (t, n, b) => `t1:${t}:${n}:${b.from === 'auto' ? 'auto' : lang(b.from)}:${lang(b.to)}:${await h32(str(b.text, 600))}`,
};
async function groupOf(b, target, native) {
  const level = LEVELS.includes(b.level) ? b.level : 'A1';
  const tp = typeof b.topic === 'string' ? App.topics.get(b.topic) : null;
  const custom = tp ? '' : str(b.custom, 80);
  if (!tp && !custom) throw new HttpError(400, 'bad_topic');
  // phrases for a situation are a bank of their own, apart from the words for the same text
  const phrases = !tp && b.phrases === true;
  return { tp, custom, level, phrases, grp: `${target}:${native}:${tp ? tp.id : (phrases ? 'p:' : 'c:') + (await h32(norm(custom)))}:${level}` };
}

const quotaHeaders = (q) => (q ? { 'X-AI-Left': String(q.left), 'X-AI-Limit': String(q.limit) } : { 'X-Cache': 'hit' });

/* identical requests arriving at the same time share one generation */
const inflight = new Map();
function once(k, fn) {
  if (inflight.has(k)) return inflight.get(k);
  const p = fn().finally(() => inflight.delete(k));
  inflight.set(k, p);
  return p;
}

// a fresh answer replaces the one everybody is served: a few a day, apart from the AI limits, counted only when one
// was made (a failed try, and the Retry after it, cost nothing)
const FRESH_PER_DAY = 20;
// `retry`: an answer that is worth asking for once more (the second is taken only if it is better, and costs the
// person nothing extra); `served`: what is done to every answer before it is shown, a saved one too; `checked`: what is
// done once to a new answer before it is saved (a look in the dictionaries, a repair of what they contradict)
async function generate(env, key, cacheKey, { fresh, prompt, clean, keep = () => true, retry = () => false, served = (x) => x, checked = async (x) => x }) {
  const fk = `fresh:${key}:${today()}`;
  if (fresh && (await peek(env.DB, fk)) >= FRESH_PER_DAY) throw new HttpError(429, 'slow_down');
  if (!fresh) {
    const hit = await cacheGet(env.DB, cacheKey);
    if (hit) return json(served(hit), 200, quotaHeaders(null));
  }
  const { data, q } = await once(cacheKey + (fresh ? ':fresh' : ''), async () => {
    const quota = await takeAI(env, key);
    try {
      const p = await prompt();
      let out = clean(await groq(env, p));
      if (out && retry(out)) {
        const next = await groq(env, p).then(clean, () => null);
        if (next && !retry(next)) out = next;
      }
      if (out) out = await checked(out).catch((e) => { console.log('check failed:', e.message); return out; });
      out = out && served(out);
      if (!out) throw new HttpError(502, 'bad_ai');
      if (keep(out)) await cacheSet(env.DB, cacheKey, out);
      if (fresh) await bump(env.DB, fk, 26 * 36e5);
      return { data: out, q: quota };
    } catch (e) {
      await quota.refund();
      throw e;
    }
  });
  return json(data, 200, quotaHeaders(q));
}

/* ---------- words for a deck: the word bank first, then the AI ---------- */
export async function words(request, env, key) {
  const b = await readJSON(request, 60000);
  const { target, native } = pairOf(b);
  const n = int(b.n, 5, 30, 20);
  const { tp, custom, level, grp, phrases } = await groupOf(b, target, native);

  const have = new Set(arr(b.have, 3000).map((x) => norm(str(x, 80))).filter(Boolean));
  // what the browser says it has goes into the prompt, and the answer into the bank everybody shares:
  // only things that look like words, so nobody can write instructions for the AI into the shared bank
  const wordLike = (s) => s.length <= (phrases ? 80 : 40) && s.split(' ').length <= (phrases ? 9 : 4) && /^[\p{L}\p{M}\p{N}'’ -]+$/u.test(s);
  // topics that are a word class ("prepositions and adverbs") get only words of that class — also from the bank,
  // which may still hold words generated before this rule (verbs such as "å ligge" among prepositions)
  const fits = (w) => !tp?.pos || tp.pos.includes(w.pos);
  const bank = (await env.DB.prepare('SELECT norm, data FROM words WHERE grp = ? ORDER BY id LIMIT 500').bind(grp).all()).results || [];
  const avail = bank.filter((r) => !have.has(r.norm)).map((r) => JSON.parse(r.data)).filter(fits);
  if (avail.length >= n) {
    const out = avail.slice(0, n);
    await saveChecked(env, grp, await checkWords(env, target, out, native));
    return json({ words: out, source: 'bank' }, 200, quotaHeaders(null));
  }

  const quota = await takeAI(env, key);
  try {
    const avoid = [...new Set([...bank.map((r) => r.norm), ...[...have].filter(wordLike)])].slice(-220);
    const dict = tp && !phrases ? await dictionaryWords(env, target, tp, level, n, new Set([...have, ...bank.map((r) => r.norm)])).catch(() => []) : [];
    const raw = await groq(env, phrases
      ? P.phrasesPrompt({ target, native, topic: custom, level, n, avoid })
      : P.wordsPrompt({ target, native, topic: tp ? tp.en : custom, hint: tp?.hint, only: tp?.pos, level, n, avoid, dict }));
    const seen = new Set([...have, ...bank.map((r) => r.norm)]);
    const fresh = [];
    for (const w of arr(raw.words, 40).map((x) => P.aiWord(x, target))) {
      const k = norm(w.term);
      if (!w.term || !w.tr || !k || seen.has(k) || !fits(w)) continue;
      seen.add(k);
      fresh.push({ k, w });
    }
    // the new words (they go into the bank already checked) and the bank words served with them
    const served = avail.slice(0, n);
    const checked = await checkWords(env, target, [...fresh.map((f) => f.w), ...served], native);
    await saveChecked(env, grp, checked.filter((w) => served.includes(w)));
    // into the bank in one statement (up to 30 rows × 3 parameters ≤ 100 D1 parameters)
    const shared = bankable(fresh.map((f) => f.w), n) ? fresh : [];
    for (let i = 0; i < shared.length; i += 30) {
      const part = shared.slice(i, i + 30);
      await env.DB.prepare(`INSERT OR IGNORE INTO words (grp, norm, data) VALUES ${part.map(() => '(?, ?, ?)').join(', ')}`)
        .bind(...part.flatMap(({ k, w }) => [grp, k, JSON.stringify(w)])).run();
    }
    return json({ words: [...avail, ...fresh.map((f) => f.w)].slice(0, n), source: 'ai' }, 200, quotaHeaders(quota));
  } catch (e) {
    await quota.refund();
    throw e;
  }
}

/* For a language the AI knows little (not WELL_KNOWN), the words of a topic come from the dictionary: the English words
   of the same topic in the bank ("the water", "to eat") lead through the translation tables of English Wiktionary to
   real words of the language ("čáhci", "borrat"), and the AI chooses among them instead of making words up. [] when
   there are too few (then it writes the words as before, and the checks mark what no dictionary has). */
async function dictionaryWords(env, target, tp, level, n, known) {
  if (WELL_KNOWN.includes(target) || target === 'en') return [];
  const rows = (await env.DB.prepare('SELECT data FROM words WHERE grp LIKE ? ORDER BY id LIMIT 300').bind(`en:%:${tp.id}:${level}`).all()).results || [];
  const english = [...new Set(rows.map((r) => { try { return JSON.parse(r.data).term; } catch { return ''; } })
    .map((t) => String(t).trim().replace(/^(the|a|an|to)\s+/i, '')).filter((t) => t && !/\s/.test(t)))].slice(0, 80);
  if (english.length < n / 2) return [];
  const found = (await L.fromEnglish(env, target, english)) || [];
  const fresh = found.filter((d) => !known.has(norm(d.word)) && d.word.split(' ').length <= 3);
  return fresh.length >= n / 2 ? fresh.slice(0, n * 2) : [];
}

/* Nouns and verbs are checked against a dictionary once — the official one (ordbokene.no) for Norwegian,
   Wiktionary for other languages: a wrong article ("et ingrediens", "die Hund") or forms that do not exist are
   fixed, in the bank for everyone, and `chk` marks the word as checked; `g` is a gender Wiktionary confirmed
   for a noun whose term does not show it ("книга", "l’école"); `nf` marks a word no dictionary has — it may be
   invented, so it is never called checked (see `verified`). A Worker may make only 50 requests to other sites
   and the AI call may need up to 8, so this check makes at most 30 and leaves the rest for the next time. */
const checkable = (target) => App.ordbok.supports(target) || W.supports(target);
// a common-gender word ("en" in Swedish) is masculine or feminine in a dictionary that tells them apart
const sameGender = (a, b) => a === b || (a === 'c' && 'mf'.includes(b)) || (b === 'c' && 'mf'.includes(a));
// a word a dictionary has confirmed (not one it could not find, nor one whose translation is not what it means)
export const verified = (w) => !!w.chk && !w.nf && !w.tm;
/* Whether new words are good enough for the shared bank, where everybody gets them: not a cut-off answer (fewer than
   half the words asked for), and not one where most of the words a dictionary could judge are words it does not have
   or translated as something they do not mean — in such an answer the rest is hardly better. They still go to the
   person who asked. */
export function bankable(words, n) {
  if (words.length < Math.ceil(n / 2)) return false;
  const judged = words.filter((w) => w.chk || w.mc);
  return judged.length < 4 || judged.filter((w) => w.nf || w.tm).length * 2 <= judged.length;
}
// the forms and existence of words (below), then whether their translations say what they mean → the words changed
async function checkWords(env, target, words, native) {
  const done = new Set(await checkForms(env, target, words));
  if (native) for (const w of await checkMeanings(env, target, native, words)) done.add(w);
  return [...done];
}

/* Whether a card's translation is what its word means. The lexicon knows a word's meaning in English (its glosses,
   and the English words whose translation tables give it) for the language being learnt and the learner's alike: the
   English of the term and the English of the translation must share a word. "mánnu" translated "масло": moon, month
   against butter, oil — `tm`, no translation of it. Words the lexicon knows too little of stay as they are; `mc`
   marks a word whose meaning was looked at, so it is looked at once. */
const ARTICLE_OR_TO = /^(to|å|att|at|zu)\s+/i;
function bare(term, target) {
  const t = String(term || '').trim();
  return App.langs.articleGender(target, t) ? t.split(/\s+/).slice(1).join(' ') : t.replace(ARTICLE_OR_TO, '').replace(/^l['’]\s*/i, '');
}
async function checkMeanings(env, target, native, words) {
  const done = [];
  for (const w of words) {
    if (w.mc || !w.tr || w.pos === 'phrase' || target === native) continue;
    const term = bare(w.term, target);
    if (!term || term.split(/\s+/).length > 3) continue;
    const of = await L.english(env, target, term, w.pos).catch(() => undefined);
    if (of === undefined) return done; // no lexicon for the language
    const tr = String(w.tr).split(/[,;/]/).map((x) => x.replace(/\([^)]*\)/g, '').trim()).filter(Boolean).slice(0, 4);
    const said = new Set();
    for (const v of tr) {
      const e = await L.english(env, native, native === 'en' ? v : bare(v, native)).catch(() => undefined);
      if (e === undefined) return done; // no lexicon for the learner's language
      for (const x of e) said.add(x);
    }
    w.mc = 1;
    done.push(w);
    if (!of.size || !said.size) continue; // too little known to tell
    const a = L.meaningWords(of), b = L.meaningWords(said);
    if ([...b].some((x) => a.has(x))) delete w.tm;
    else w.tm = 1;
  }
  return done;
}
async function checkForms(env, target, words) {
  const full = checkable(target);
  const official = App.ordbok.supports(target);
  // every other single word (an adjective, an adverb; any word of a language the full check skips) is looked up in
  // the lexicon: there or not, without a request to another site
  const done = await knownWords(env, target, words.filter((w) => !w.chk && (!full || (w.pos !== 'noun' && w.pos !== 'verb'))));
  if (!full) return done;
  const cache = cacheOf(env);
  const lex = (lemma, pos) => L.entry(env, target, lemma, pos);
  const todo = words.filter((w) => !w.chk && (w.pos === 'noun' || w.pos === 'verb'));
  const budget = { left: 30 };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  let i = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (i < todo.length && budget.left > 5) {
      const w = todo[i++];
      try {
        const opts = { signal: ctrl.signal, budget };
        const r = official ? await App.ordbok.verify(w, target, opts)
          : await W.check(cache, target, w, { ...opts, lex, more: (lemma, pos) => D.entry(cache, target, lemma, pos, opts) });
        if (r?.none) w.nf = 1;
        else if (r) {
          // a gender label written for the wrong article, or for another gender than the dictionary's
          if (r.term !== w.term || (r.g && w.ag && !sameGender(w.ag, r.g))) w.gram = '';
          w.term = r.term; w.forms = r.forms;
          if (r.g) w.g = r.g;
          delete w.nf;
        }
        w.chk = 1;
        done.push(w);
      } catch { /* timeout, budget or network: another time */ }
    }
  }));
  clearTimeout(timer);
  return done;
}
const SKIP_POS = ['phrase', 'noun', 'verb'];
async function knownWords(env, target, words) {
  const done = [];
  for (const w of words) {
    const t = w.term.trim();
    if (w.pos === 'phrase' || /\s/.test(t) || (SKIP_POS.includes(w.pos) && checkable(target))) continue;
    const known = await L.knows(env, target, t).catch(() => undefined);
    if (known === undefined) return done; // no lexicon for the language: none of them can be looked up
    if (!known) w.nf = 1;
    else delete w.nf;
    w.chk = 1;
    done.push(w);
  }
  return done;
}
async function saveChecked(env, grp, words) {
  if (!words.length) return;
  const q = 'UPDATE words SET data = ? WHERE grp = ? AND norm = ?';
  await env.DB.batch(words.map((w) => env.DB.prepare(q).bind(JSON.stringify(w), grp, norm(w.term))));
}

/* ---------- cards saved before the check existed: the browser sends them 10 at a time ---------- */
export async function check(request, env, key) {
  await takeSimple(env, 'check', key, 120, 36e5);
  const b = await readJSON(request, 20000);
  const { target, native } = pairOf(b);
  if (!checkable(target)) throw new HttpError(400, 'bad_lang');
  const words = arr(b.words, 10).map((w) => ({ term: str(w?.term, 80), pos: str(w?.pos, 20), forms: str(w?.forms, 200), tr: str(w?.tr, 160) }));
  await checkWords(env, target, words.filter((w) => w.term), native);
  // null: not checked this time (a timeout or the budget) — the browser asks again later
  // nf: no dictionary has the word (it may be invented); tm: the translation is not what the word means
  return json({ words: words.map((w) => (w.chk || w.mc ? { term: w.term, forms: w.forms, g: w.g || '', ...(w.nf ? { nf: 1 } : {}), ...(w.tm ? { tm: 1 } : {}) } : null)) });
}

/* ---------- card autofill (personal, not cached) ---------- */
// the deck a card is filled in for: one of the app's topics by its id, or the title of the person's own deck.
// It picks the meaning of a word with several ("felt" in a deck about driving: lane, not field)
const deckTopic = (b) => {
  const tp = typeof b.topic === 'string' ? App.topics.get(b.topic) : null;
  return tp ? tp.en + (tp.hint ? ` (${tp.hint})` : '') : str(b.topic, 80);
};
// the bank groups (their prefixes, see groupOf) of a deck's own topic: [] for a deck without one
async function topicGroups(b, target, native) {
  if (typeof b.topic !== 'string' || !b.topic.trim()) return [];
  const tp = App.topics.get(b.topic);
  if (tp) return [`${target}:${native}:${tp.id}:`];
  const h = await h32(norm(str(b.topic, 80)));
  return [`${target}:${native}:c:${h}:`, `${target}:${native}:p:${h}:`];
}
export async function fill(request, env, key) {
  const b = await readJSON(request, 4000);
  const { target, native } = pairOf(b);
  const term = str(b.term, 80), tr = str(b.tr, 120);
  if (!term && !tr) throw new HttpError(400, 'empty');
  const quota = await takeAI(env, key);
  try {
    const w = P.aiWord(await groq(env, P.fillPrompt({ target, native, level: LEVELS.includes(b.level) ? b.level : 'A1', term, tr, topic: deckTopic(b) })), target);
    await checkWords(env, target, [w], native);
    return json(w, 200, quotaHeaders(quota));
  } catch (e) {
    await quota.refund();
    throw e;
  }
}

/* ---------- many cards at once (an imported deck with empty fields) ----------
   Up to 20 cards in one request, which counts as one generation. A word the shared bank already has, or one
   someone filled in before (the same word and translation), costs nothing: it comes from there. */
const FILL_MAX = 20;
const fillKey = async (target, native, w, topic) => 'fill1:' + (await sha256([target, native, norm(w.term), norm(w.tr), ...(topic ? [norm(topic)] : [])].join('\n'))).slice(0, 32);
export async function fillMany(request, env, key) {
  const b = await readJSON(request, 20000);
  const { target, native } = pairOf(b);
  const level = LEVELS.includes(b.level) ? b.level : 'A1';
  const items = arr(b.words, FILL_MAX).map((w) => ({ term: str(w?.term, 80), tr: str(w?.tr, 120), ex: str(w?.ex, 300) }));
  if (!items.length || items.some((w) => !w.term && !w.tr)) throw new HttpError(400, 'empty');
  const topic = deckTopic(b);
  const out = new Array(items.length).fill(null);
  const keys = await Promise.all(items.map((w) => fillKey(target, native, w, topic)));
  // 1. filled before
  await Promise.all(keys.map(async (k, i) => { out[i] = (await cacheGet(env.DB, k)) || null; }));
  // 2. the shared bank, for a word with no example of its own (the bank's example would not be the card's)
  const ask = items.map((w, i) => i).filter((i) => !out[i]);
  const bankable = ask.filter((i) => items[i].term && !items[i].ex);
  if (bankable.length) {
    const norms = [...new Set(bankable.map((i) => norm(items[i].term)))];
    // the word as the bank has it for the deck's own topic first (elsewhere it may mean another thing), then any
    const own = new Set(await topicGroups(b, target, native));
    const rows = (await env.DB.prepare(`SELECT norm, grp, data FROM words WHERE norm IN (${norms.map(() => '?').join(',')}) AND grp >= ? AND grp < ?`)
      .bind(...norms, `${target}:${native}:`, `${target}:${native};`).all()).results || [];
    const mine = (r) => [...own].some((g) => r.grp.startsWith(g));
    const bank = new Map(rows.sort((x, y) => mine(x) - mine(y)).map((r) => [r.norm, JSON.parse(r.data)])); // the deck's own row last: it wins
    for (const i of bankable) {
      const w = bank.get(norm(items[i].term));
      if (w) out[i] = { ...w, tr: items[i].tr && items[i].tr.length > 1 ? items[i].tr : w.tr };
    }
  }
  // 3. the AI, for the rest, all in one request
  const rest = ask.filter((i) => !out[i]);
  if (!rest.length) return json({ words: out }, 200, quotaHeaders(null));
  const quota = await takeAI(env, key);
  try {
    const raw = await groq(env, P.fillManyPrompt({ target, native, level, items: rest.map((i) => items[i]), topic }));
    const got = arr(raw?.words, FILL_MAX);
    const made = [];
    got.forEach((r, j) => {
      const at = Number.isInteger(r?.i) && r.i >= 0 && r.i < rest.length ? r.i : j; // by its number, or by its place
      const i = rest[at];
      if (i === undefined || out[i]) return;
      const w = P.aiWord(r, target);
      if (!w.term || !w.tr) return;
      out[i] = w;
      made.push([i, w]);
    });
    if (!made.length) throw new HttpError(502, 'parse');
    await checkWords(env, target, made.map(([, w]) => w), native);
    await Promise.all(made.map(([i, w]) => cacheSet(env.DB, keys[i], w)));
    return json({ words: out }, 200, quotaHeaders(quota));
  } catch (e) {
    await quota.refund();
    throw e;
  }
}

/* ---------- dictionary entry (grounded in ordbokene.no for Norwegian, in Wiktionary for other languages) ---------- */
export async function lookup(request, env, key) {
  const b = await readJSON(request, 4000);
  const { target, native } = pairOf(b);
  const q = str(b.q, 60);
  if (!q) throw new HttpError(400, 'empty');
  const cacheKey = await KEYS.lookup(target, native, b);
  // a note or origin written in the language being learnt instead of the learner's: asked for once more, and if it
  // comes so again, left out (in an entry saved before this check too)
  return generate(env, key, cacheKey, {
    fresh: !!b.fresh,
    prompt: async () => ({ ...P.lookupPrompt({ target, native, q, ...(await groundFor(env, target, q)) }) }),
    clean: P.cleanEntry,
    checked: (e) => realWords(env, target, e),
    keep: (e) => e.found !== false,
    retry: (e) => !P.isNative(e, native, target),
    served: (e) => P.inNative(e, native, target),
  });
}

/* An entry without the compounds, synonyms and antonyms the lexicon has never heard of ("blyneddol" for Welsh
   blynedd): the AI invents them more than anything else, and a learner would take them for words */
async function realWords(env, target, e) {
  if (!e || e.found === false) return e;
  const real = async (list) => (await Promise.all(list.map(async (w) => ((/\s/.test(w) || (await L.knows(env, target, w)) !== false) ? w : null)))).filter(Boolean);
  return { ...e, compounds: await real(e.compounds || []), synonyms: await real(e.synonyms || []), antonyms: await real(e.antonyms || []) };
}

const inTime = (p) => Promise.race([p, new Promise((res) => setTimeout(() => res(null), 4000))]);
async function groundFor(env, target, q) {
  if (W.hasEntries(target)) {
    const cache = cacheOf(env), signal = AbortSignal.timeout(8000);
    const [r, more] = await Promise.all([
      inTime(W.lookup(cache, target, q, { budget: { left: 3 }, signal })).catch(() => null),
      inTime(D.lookup(cache, target, q, { budget: { left: 4 }, signal })).catch(() => null),
    ]);
    const lex = await L.facts(env, target, [q]).catch(() => []);
    return { ground: [W.summary(r), D.summary(more || []), lex.length ? `Lexicon (Wiktionary data):\n${lex.join('\n')}` : ''].filter(Boolean).join('\n'), source: 'wiktionary' };
  }
  return { ground: await officialSummary(env, target, q), source: 'official' };
}
async function officialSummary(env, target, q) {
  if (!App.ordbok.supports(target)) return '';
  const k = `o1:${target}:${await h32(q.toLowerCase())}`;
  const hit = await cacheGet(env.DB, k, WEEK);
  if (hit !== null) return hit.s;
  try {
    const s = App.ordbok.summary(await inTime(App.ordbok.lookup(q, target)));
    await cacheSet(env.DB, k, { s });
    return s;
  } catch {
    return '';
  }
}

/* ---------- the dictionaries shown next to the AI entry (languages without an official dictionary here) ----------
   Wiktionary, and in `more` the free dictionaries of src/sources/dicts.js that have the word */
export async function wikt(request, env, key) {
  const b = await readJSON(request, 2000);
  const { target } = pairOf(b);
  const q = str(b.q, 60);
  if (!q) throw new HttpError(400, 'empty');
  if (!W.hasEntries(target)) throw new HttpError(400, 'bad_lang');
  const cache = cacheOf(env);
  // a word someone looked up before costs Wikimedia nothing; a new one takes from a small hourly limit
  const seen = await cache.get(`wk3:${target}:${W.plain(q, target)}`, 30 * 864e5) && await cache.get(`lx1:${target}:${W.plain(q, target)}`, 30 * 864e5);
  if (!seen) await takeSimple(env, 'wikt', key, 120, 36e5);
  const signal = AbortSignal.timeout(8000);
  // `checked`: the dictionaries that answered, so "not found" names each of them (one that was down is not named)
  const [wk, free] = await Promise.all([
    W.lookup(cache, target, q, { budget: { left: 3 }, signal }).then((r) => ({ r, ok: true }), () => ({ r: null, ok: false })),
    D.search(cache, target, q, { budget: { left: 4 }, signal }).catch(() => ({ found: [], checked: [] })),
  ]);
  const checked = [...(wk.ok ? ['Wiktionary'] : []), ...free.checked];
  if (!wk.r && !free.found.length) return json({ found: false, checked });
  return json({ found: true, ...(wk.r || { articles: [] }), more: D.shown(free.found), checked });
}

/* ---------- textbook chapter ---------- */
// a chapter that lost several pieces to the checks of cleanChapter (the model's thinking, stray letters, a "mistake"
// that is no mistake) is asked for once more; the second is taken only if it is better
const tooMuchLeftOut = (ch) => ch.dropped >= 2;
export async function chapter(request, env, key) {
  const b = await readJSON(request, 2000);
  const { target, native } = pairOf(b);
  if (!App.topics.chapter(b.id)) throw new HttpError(400, 'bad_chapter');
  return generate(env, key, await KEYS.chapter(target, native, b), {
    fresh: !!b.fresh,
    prompt: () => P.chapterPrompt({ target, native, id: b.id }),
    clean: (r) => P.cleanChapter(r, target, native),
    retry: tooMuchLeftOut,
  });
}

/* ---------- grammar question ---------- */
export async function ask(request, env, key) {
  const b = await readJSON(request, 4000);
  const { target, native } = pairOf(b);
  const q = str(b.q, 300);
  if (q.length < 3) throw new HttpError(400, 'empty');
  return generate(env, key, await KEYS.ask(target, native, b), {
    fresh: !!b.fresh,
    prompt: () => P.askPrompt({ target, native, q }),
    clean: (r) => P.cleanChapter(r, target, native),
    retry: tooMuchLeftOut,
  });
}

/* ---------- translation with explanations ---------- */
export async function translate(request, env, key) {
  const b = await readJSON(request, 8000);
  const { target, native } = pairOf(b);
  const text = str(b.text, 600);
  if (!text) throw new HttpError(400, 'empty');
  const from = b.from === 'auto' ? 'auto' : lang(b.from);
  const to = lang(b.to);
  if (!from || !to) throw new HttpError(400, 'bad_lang');
  return generate(env, key, await KEYS.translate(target, native, b), {
    fresh: false,
    prompt: () => P.translatePrompt({ target, native, from, to, text }),
    clean: P.cleanTranslation,
    checked: (r) => checkTranslation(env, target, native, r),
  });
}

/* The text in the language being learnt, checked against the dictionary once: the lexicon's headword lines of its
   words ("blynedd f", "tri m (feminine tair)") go to the AI with the analysis, and what they contradict is repaired:
   the sentence itself and the tokens whose form or explanation was wrong ("am dri blynedd" -> "am dair blynedd": the
   year is feminine). Only for the languages the AI knows less well (WELL_KNOWN are the rest), with one small extra
   request, and the answer is saved, so a text is checked once for everybody. */
/* What the dictionary says about agreement, found without the AI: a word with a feminine form of its own ("tri m
   (feminine tair)") right before a noun that is only feminine ("blynedd f") must take that form. Said to the AI in
   plain words, it is not missed ("am dri blynedd" -> "am dair blynedd"). */
async function agreement(env, target, tokens) {
  const notes = [];
  for (let i = 0; i < tokens.length - 1 && notes.length < 5; i++) {
    const a = tokens[i];
    if (!['numeral', 'adjective', 'determiner', 'article', 'pronoun'].includes(a.pos)) continue;
    const e = await L.entry(env, target, a.lemma || a.t, a.pos);
    const fem = /feminine ([^\s,;)]+)/.exec(e?.head || '')?.[1];
    if (!fem) continue;
    const next = tokens.slice(i + 1, i + 3).find((x) => x.pos === 'noun');
    const n = next && ((await L.entry(env, target, next.t, 'noun')) || (await L.entry(env, target, next.lemma, 'noun')));
    if (n && n.genders.has('f') && !n.genders.has('m')) notes.push(`NOTE: "${a.t}" goes with "${next.t}", a feminine noun: the feminine form of ${a.lemma || a.t} is ${fem} (with any mutation the word before causes).`);
  }
  return notes;
}
const WELL_KNOWN = ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'uk', 'pl', 'nl', 'sv', 'da', 'nb', 'nn', 'zh', 'ja', 'ko'];
async function checkTranslation(env, target, native, r) {
  if (WELL_KNOWN.includes(target) || !r?.tokens?.length) return r;
  const facts = await L.facts(env, target, r.tokens.flatMap((x) => [x.t, x.lemma])).catch(() => []);
  if (!facts.length) return r;
  facts.push(...await agreement(env, target, r.tokens).catch(() => []));
  const text = r.analyzed === 'source' ? null : r.translation;
  const fix = P.cleanFix(await groq(env, P.checkPrompt({ target, native, text: text || r.tokens.map((x) => x.t).join(' '), tokens: r.tokens, facts, fixText: !!text })));
  if (!fix) return r;
  // in the learner's own text the word stays as written; its explanation starts with what it should be
  const tokens = r.tokens.map((x, i) => {
    const f = fix.tokens[i];
    if (!f) return x;
    if (text || !f.t || f.t.toLowerCase() === x.t.toLowerCase()) return { ...x, ...f };
    return { ...x, ...f, t: x.t, why: `${x.t} → ${f.t}. ${f.why || ''}`.trim() };
  });
  return { ...r, ...(text && fix.translation ? { translation: fix.translation } : {}), tokens };
}

/* ---------- interface translation into a language without a hand-made one ---------- */
export async function ui(request, env, key) {
  const b = await readJSON(request, 1000);
  const code = lang(b.lang);
  if (!code || BUILT_IN_UI.includes(code)) throw new HttpError(400, 'bad_lang');
  const keys = Object.keys(App.i18nData.en);
  const parts = Math.ceil(keys.length / UI_CHUNK);
  const part = int(b.part, 0, parts - 1, 0);
  const chunk = Object.fromEntries(keys.slice(part * UI_CHUNK, (part + 1) * UI_CHUNK).map((k) => [k, App.i18nData.en[k]]));
  const cacheKey = `u1:${code}:${await h32(JSON.stringify(chunk))}`;
  const holes = (s) => (String(s).match(/\{\w+\}/g) || []).sort().join();
  const res = await generate(env, key, cacheKey, {
    fresh: false,
    prompt: () => P.uiPrompt({ lang: code, strings: chunk }),
    clean: (raw) => {
      const out = {};
      for (const [k, v] of Object.entries(chunk)) {
        const t = raw && typeof raw[k] === 'string' ? str(raw[k], 600) : '';
        out[k] = t && holes(t) === holes(v) ? t : v;
      }
      return out;
    },
  });
  res.headers.set('X-UI-Parts', String(parts));
  return res;
}

/* ---------- "report a mistake": after REPORTS_TO_DROP independent reports the entry is regenerated ---------- */
export async function report(request, env, key) {
  await takeSimple(env, 'report', key, 30, 36e5);
  const b = await readJSON(request, 8000);
  const { target, native } = pairOf(b);
  let k, drop;
  if (b.kind === 'word') {
    const { grp } = await groupOf(b, target, native);
    const w = norm(str(b.term, 80));
    if (!w) throw new HttpError(400, 'empty');
    k = `w:${grp}:${w}`;
    drop = () => env.DB.prepare('DELETE FROM words WHERE grp = ? AND norm = ?').bind(grp, w).run();
  } else if (KEYS[b.kind]) {
    if (b.kind === 'chapter' && !App.topics.chapter(b.id)) throw new HttpError(400, 'bad_chapter');
    k = await KEYS[b.kind](target, native, b);
    drop = async () => { await env.DB.prepare('DELETE FROM cache WHERE k = ?').bind(k).run(); cacheForget(k); };
  } else {
    throw new HttpError(400, 'bad_kind');
  }
  await env.DB.prepare('INSERT OR IGNORE INTO reports (k, who, t) VALUES (?, ?, ?)').bind(k, key, Date.now()).run();
  // dropped after REPORTS_TO_DROP people, from at least two networks: addresses of one server cannot drop what
  // everybody is served
  const row = await env.DB.prepare(`SELECT count(*) AS n, COUNT(DISTINCT ${NET_OF_WHO}) AS nets FROM reports WHERE k = ?`).bind(k).first();
  if ((row?.n || 0) >= (Number(env.REPORTS_TO_DROP) || 2) && (row?.nets || 0) >= 2) {
    await drop();
    await env.DB.prepare('DELETE FROM reports WHERE k = ?').bind(k).run();
    return json({ dropped: true });
  }
  return json({ dropped: false });
}

/* ---------- reading mode: gloss a piece of text (≤ 600 chars; longer texts come in parts) ---------- */
export async function gloss(request, env, key) {
  const b = await readJSON(request, 4000);
  const { target, native } = pairOf(b);
  const text = str(b.text, 600);
  if (text.length < 2) throw new HttpError(400, 'empty');
  return generate(env, key, `r2:${target}:${native}:${await h32(text)}`, {
    fresh: false,
    prompt: () => P.glossPrompt({ target, native, text }),
    clean: P.cleanGloss,
  });
}

// words of the shared bank for a topic, without asking the AI: [] when the bank has none yet
export async function bankWords(env, { target, native, topic, level = 'A1', n = 20 }) {
  const { grp } = await groupOf({ topic, level }, target, native);
  const rows = (await env.DB.prepare('SELECT data FROM words WHERE grp = ? ORDER BY id LIMIT ?').bind(grp, int(n, 1, 100, 20)).all()).results || [];
  return rows.map((r) => JSON.parse(r.data));
}

export async function limits(request, env, key) {
  return json(await aiLeft(env, key));
}
