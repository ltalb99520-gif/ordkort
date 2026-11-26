import test from 'node:test';
import assert from 'node:assert/strict';
import { browser, read } from './helpers.mjs';

function storage() {
  const entries = new Map();
  const cache = {
    match: async (key) => entries.get(key)?.clone(),
    put: async (key, response) => { entries.set(key, response.clone()); },
    keys: async () => [...entries.keys()],
    delete: async (key) => entries.delete(key),
  };
  return { entries, caches: {open: async (name) => {assert.equal(name,'ordkort-voice-v1'); return cache;}} };
}
function device(store, call) {
  const { App, ctx } = browser(['public/js/media.js']);
  ctx.caches = store.caches;
  ctx.location = {origin:'https://ordkort.test'};
  App.ai = {call};
  return App.media;
}
const audio = () => new Response(new Uint8Array([1,2,3]),{headers:{'Content-Type':'audio/mpeg'}});
test('previously fetched audio can be replayed after a reload without the network', async () => {
  const disk = storage(); let calls = 0;
  const a = device(disk, async () => {calls++; return audio();});
  assert.ok(await a.voice('palta','es'));
  assert.equal(disk.entries.size,1);
  assert.equal(calls,1);
  const b = device(disk, async () => {calls++; throw Error('offline');});
  assert.ok(await b.voice('palta','es'));
  assert.equal(calls,1);
  assert.equal(await b.voice('frutilla','es'),'');
  assert.equal(calls,2);
});
test('offline speech separates cloud voices and never saves an unsuccessful response', async () => {
  const disk = storage();
  const paths = [];
  const a = device(disk, async (path) => {
    paths.push(path);
    return path.includes('fallo') ? new Response('',{status:404}) : audio();
  });
  assert.ok(await a.voice('palta','es','catalina'));
  assert.ok(await a.voice('palta','es','lorenzo'));
  assert.equal(await a.voice('fallo','es','catalina'),'');
  assert.equal(await a.voice('fallo','es','catalina'),'');
  assert.equal(disk.entries.size,2);
  assert.equal(paths.length,4);
  for (const key of disk.entries.keys()) assert.match(key,/\/__ordkort_voice\/[a-f0-9]{64}$/);
});
test('offline cache is limited to 256 entries and skips oversized audio', async () => {
  const disk = storage();
  const a = device(disk, async () => audio());
  for(let i=0;i<257;i++) await a.voice('word '+i,'es');
  assert.equal(disk.entries.size,256);
  const b = device(disk, async () => new Response(new Uint8Array(256*1024+1),{headers:{'Content-Type':'audio/mpeg'}}));
  assert.ok(await b.voice('oversized','es'));
  assert.equal(disk.entries.size,256);
});
test('app updates retain the disposable offline voice cache', () => {
  const sw=read('public/sw.js');
  assert.match(sw,/const VOICE_CACHE = 'ordkort-voice-v1'/);
  assert.match(sw,/k !== CACHE && k !== REMIND && k !== VOICE_CACHE/);
});
