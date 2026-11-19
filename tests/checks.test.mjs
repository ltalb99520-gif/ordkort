// Checks of what the AI writes, found in the audit of 2026-11-19 on rare languages: the model's own thinking left in a
// chapter, letters of a third script in an example, "mistakes" that are none, words no dictionary has served as
// checked, and Wiktionary pages asked for with the marks they do not have in their titles.
import test from 'node:test';
import assert from 'node:assert/strict';
import { App } from '../src/core/shared.js';
import { cleanChapter, thinks, aiWord } from '../src/ai/prompts.js';
import { bankable, verified } from '../src/ai/routes.js';
import { title } from '../src/sources/wiktionary.js';

const chapter = (over = {}) => ({
  title: 'Nouns', intro: 'Nouns have cases.',
  sections: [{ heading: 'Cases', text: 'There are seven cases.', table: null, examples: [], tip: '' }],
  mistakes: [], practice: [], ...over,
});

test('the model’s thinking is told from ordinary sentences, English examples among them', () => {
  for (const s of ['Wait, the plural of cù is coin.', 'This is actually correct. Let’s find a real mistake.', 'Actually, the plural of cù is cù? No, coin.', 'Hmm, cat starts with c.'])
    assert.ok(thinks(s), s);
  for (const s of ['Wait! Don’t go.', 'Let’s go to the park.', 'I think it is a good idea.', 'Let me help you.', 'Actually, I like it.'])
    assert.ok(!thinks(s), s);
});

test('a Scottish Gaelic chapter: examples and mistakes with the model’s thinking go, so does a mistake that is none', () => {
  const ch = cleanChapter(chapter({
    sections: [{
      heading: 'Plural', text: 'Most nouns add -an. Wait, cat starts with c. Some change the vowel.', table: null, tip: '',
      examples: [{ text: 'cù → coin', tr: 'dog → dogs' }, { text: 'Actually, the plural of cù is cù? No, coin.', tr: '' }],
    }],
    mistakes: [{ wrong: 'an cailin', right: 'An cailin.', why: 'same' }, { wrong: 'na cùan', right: 'na coin', why: 'irregular' },
      { wrong: 'x', right: 'This is actually correct.', why: '' }],
    practice: [{ q: 'Plural of cù?', a: 'coin' }, { q: 'No answer', a: '' }],
  }), 'gd', 'en');
  assert.equal(ch.sections[0].text, 'Most nouns add -an. Some change the vowel.');
  assert.deepEqual(ch.sections[0].examples.map((x) => x.text), ['cù → coin']);
  assert.deepEqual(ch.mistakes.map((m) => m.right), ['na coin']);
  assert.deepEqual(ch.practice.map((p) => p.a), ['coin'], 'an exercise without an answer is no exercise');
  assert.equal(ch.dropped, 4);
  assert.ok(!('dropped' in JSON.parse(JSON.stringify(ch))), 'the count is not saved with the chapter');
});

test('a Georgian chapter: a sentence with a Marathi word goes; Georgian, English and IPA letters stay', () => {
  const ch = cleanChapter(chapter({
    intro: 'კატის სახლი დიდი आहे. Georgian has no articles; θ in /θ/ is not Georgian.',
    sections: [{ heading: 'h', text: 'კაცი — man.', table: null, tip: '', examples: [{ text: 'კატა დიდია.', tr: 'The cat is big.' }, { text: 'კატა आहे', tr: 'x' }] }],
  }), 'ka', 'en');
  assert.equal(ch.intro, 'Georgian has no articles; θ in /θ/ is not Georgian.');
  assert.deepEqual(ch.sections[0].examples.map((x) => x.text), ['კატა დიდია.']);
  assert.equal(ch.dropped, 2);
  const ja = cleanChapter(chapter({ sections: [{ heading: 'h', text: '本を読みます。Книга.', table: null, tip: '', examples: [] }] }), 'ja', 'ru');
  assert.equal(ja.dropped, 0, 'kana and kanji for Japanese, Cyrillic for the Russian reader');
});

test('a cut-off answer, or one made mostly of words no dictionary has, does not go into the shared bank', () => {
  const w = (chk, nf) => ({ term: 'x', chk, ...(nf ? { nf: 1 } : {}) });
  assert.equal(bankable([w(1), w(1), w(1), w(1), w(1)], 30), false, '5 of 30');
  assert.equal(bankable(Array.from({ length: 18 }, () => w(0)), 30), true, 'nothing a dictionary could judge');
  assert.equal(bankable([...Array.from({ length: 10 }, () => w(1, 1)), ...Array.from({ length: 8 }, () => w(1))], 30), false, '10 of 18 judged not found');
  assert.equal(bankable([...Array.from({ length: 9 }, () => w(1, 1)), ...Array.from({ length: 9 }, () => w(1))], 30), true, 'half');
  assert.equal(verified(w(1)), true);
  assert.equal(verified(w(1, 1)), false, 'looked up, not found: not checked');
  assert.equal(verified(w(0)), false);
});

test('the gender the AI meant travels with a noun for the dictionary check, never into the bank', () => {
  const w = aiWord({ term: 'biebbu', tr: 'еда', pos: 'noun', gender: 'masculine', gram: 'мужской род' }, 'se');
  assert.equal(w.ag, 'm');
  assert.ok(!('ag' in JSON.parse(JSON.stringify(w))));
  assert.equal(aiWord({ term: 'borrat', tr: 'есть', pos: 'verb', gender: '' }, 'se').ag, undefined);
});

test('Wiktionary titles without the marks they leave out: Latin macrons, Arabic and Hebrew vowel signs; Greek keeps its', () => {
  assert.equal(title('rēx', 'la'), 'rex');
  assert.equal(title('stān', 'ang'), 'stan');
  assert.equal(title('كِتَاب', 'ar'), 'كتاب');
  assert.equal(title('كِتَاب', 'arz'), 'كتاب');
  assert.equal(title('סֵפֶר', 'he'), 'ספר');
  assert.equal(title('λόγος', 'grc'), 'λόγος');
  assert.equal(title('hús', 'non'), 'hús');
  assert.equal(title('Hund', 'de'), 'Hund');
});

test('scripts: Ancient Greek is Greek, polytonic text points to it', () => {
  assert.equal(App.langs.scriptOfLang('grc'), 'Greek');
  assert.ok(App.langs.fits('λόγος', 'grc'));
  assert.equal(App.langs.guess('ὁ ἄνθρωπος'), 'grc');
  assert.equal(App.langs.guess('ο άνθρωπος'), 'el');
});
