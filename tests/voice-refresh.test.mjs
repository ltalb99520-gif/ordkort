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

test('device voice list is refreshed, deduplicated and manually selected without routing', () => {
  const V=browser(['public/js/voice.js']).App.voice;
  const mx={voiceURI:'mx',name:'Paulina',lang:'es-MX'};
  const cl={voiceURI:'cl',name:'Francisca',lang:'es-CL'};
  const en={voiceURI:'en',name:'English',lang:'en-US'};
  assert.equal(V.choices([mx,mx,cl,en],'es').length,2);
  assert.equal(V.choices([mx,cl,en],'en')[0].voiceURI,'en');
  const src=read('public/js/views/settings.js');
  const block=src.slice(src.indexOf("row(t('set.voice')"),src.indexOf("row(t('set.voice_rate')"));
  assert.match(block,/A\.voice\.displayChoices\(detected, all \? null : s\.target\)/);
  assert.match(block,/set\(\{ voiceURI: sel\.value \}\)/);
  assert.match(block,/details\.append\(status, scope, sel\)/);
  assert.match(block,/A\.voice\.refresh\(\); signature = null; repaint\(\);/);
  assert.match(block,/t\('set\.voice_refresh'\)/);
  assert.doesNotMatch(block,/value: 'chile'|A\.route\(/);
  assert.match(block,/if \(s\.voice === 'chile'\) A\.store\.set\(\{ voice: 'system', voiceURI: '' \}\)/);
  assert.match(block,/value: 'neural', label: t\('set.voice_neural'\)/);
});

test('same-name voices retain distinct IDs and receive unambiguous labels', () => {
  const V=browser(['public/js/voice.js']).App.voice;
  const a={voiceURI:'com.apple.compact.mx',name:'Paulina',lang:'es-MX'};
  const b={voiceURI:'com.apple.enhanced.mx',name:'Paulina',lang:'es-MX'};
  const c={voiceURI:'unknown1',name:'Mónica',lang:'es-ES'};
  const d={voiceURI:'unknown2',name:'Mónica',lang:'es-ES'};
  const e={voiceURI:'en',name:'English',lang:'en-US'};
  const entries=[a,b,c,d,e,a];
  const out=V.displayChoices(entries,'es');
  assert.equal(out.length,4);
  assert.equal(new Set(out.map(x=>x.label)).size,4);
  assert.match(out[0].label,/compact/);
  assert.match(out[1].label,/enhanced/);
  assert.equal(V.displayChoices(entries).length,5);
  assert.equal(V.resolve(entries,{voice:'system',voiceURI:b.voiceURI},'es'),b);
});
