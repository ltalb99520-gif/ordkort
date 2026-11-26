import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { browser, read } from './helpers.mjs';

test('speech enumeration refreshes even after an initial nonempty fallback list', () => {
  const { App, ctx } = browser(['public/js/voice.js']);
  const events = {}, docEvents = {};
  let available = [{name:'Paulina',lang:'es-MX',voiceURI:'mx'}];
  ctx.speechSynthesis = {getVoices:()=>available,addEventListener:(k,f)=>events[k]=f};
  ctx.addEventListener = (k,f)=>events[k]=f;
  ctx.document = {hidden:false,addEventListener:(k,f)=>docEvents[k]=f};
  vm.runInContext(read('public/js/ui.js'),ctx);
  const settings = {voice:'chile'};
  assert.equal(App.voice.resolve(App.voice.now(),settings,'es').name,'Paulina');
  let changes=0;
  const off=App.voice.subscribe(()=>changes++);
  available=[...available,{name:'Francisca',lang:'es-CL',voiceURI:'cl'}];
  events.focus();
  assert.equal(changes,1);
  assert.equal(App.voice.resolve(App.voice.now(),settings,'es').name,'Francisca');
  events.voiceschanged();
  assert.equal(changes,1);
  available=available.slice(0,1);
  docEvents.visibilitychange();
  assert.equal(changes,2);
  off();
  available=[];
  App.voice.refresh();
  assert.equal(changes,2);
});
test('voice mode selection saves and redraws only its own details', () => {
  const src=read('public/js/views/settings.js');
  const block=src.slice(src.indexOf("row(t('set.voice')"),src.indexOf("row(t('set.voice_rate')"));
  assert.match(block,/set\(\{ voice: v \}\);\s*A\.voice\.refresh\(\);\s*draw\(\);/);
  assert.doesNotMatch(block,/A\.route\(|set\(\{ voice: v \}, true\)/);
  assert.match(block,/details\.replaceChildren\(\)/);
  assert.match(block,/A\.voice\.subscribe\(/);
});
