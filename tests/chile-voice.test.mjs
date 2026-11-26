import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const window = { App: {} };
vm.runInNewContext(readFileSync(new URL('../public/js/voice.js', import.meta.url), 'utf8'), { window });
const V = window.App.voice;
const voice = (lang, name = lang) => ({lang, name, voiceURI: lang});
const es = voice('es-ES', 'Premium Spain');
const cl = voice('es-CL');
const mx = voice('es-MX');
const latam = voice('es-419');
const en = voice('en-US');
const chile = {voice: 'chile'};

test('Chilean mode chooses es-CL ahead of premium Spanish voices', () => {
  assert.equal(V.resolve([es, mx, cl], chile, 'es'), cl);
});
test('Chilean mode falls back to Latin American Spanish, including es-419', () => {
  assert.equal(V.resolve([es, mx], chile, 'es'), mx);
  assert.equal(V.resolve([es, latam], chile, 'es'), latam);
  assert.equal(V.resolve([es], chile, 'es'), es);
  assert.equal(V.resolve([en], chile, 'es'), null);
});
test('Chilean mode bypasses site audio only for Spanish', () => {
  assert.equal(V.usesSite('chile', 'es'), false);
  assert.equal(V.usesSite('chile', 'en'), true);
  assert.equal(V.usesSite('site', 'es'), true);
  assert.equal(V.usesSite('system', 'en'), false);
});
test('Manual voice selection and system defaults remain available', () => {
  assert.equal(V.resolve([es, cl], {voice:'system', voiceURI:'es-ES'}, 'es'), es);
  assert.equal(V.resolve([es, en], {voice:'system', voiceURI:'es-ES'}, 'en'), null);
  assert.equal(V.resolve([es, cl], {voice:'system'}, 'es'), null);
});
test('Device speech rate validates stored settings', () => {
  assert.equal(V.rate({}), 0.9);
  for (const n of [0.5, 0.8, 1, 1.5]) assert.equal(V.rate({voiceRate:n}), n);
  for (const n of [0, 2, 'bad', Infinity]) assert.equal(V.rate({voiceRate:n}), 0.9);
});
