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
  assert.match(block,/A\.voice\.searchChoices\(A\.voice\.displayChoices\(detected, all \? null : s\.target\), search\.value\)/);
  assert.match(block,/set\(\{ voiceURI: sel\.value \}\)/);
  assert.match(block,/details\.append\(status, scope, search, sel, info\)/);
  assert.match(block,/A\.voice\.refresh\(\);\s*signature = null;\s*repaint\(\);/);
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

test('voice search matches accents, locale and identifiers; refresh diff detects replacement at equal counts', () => {
  const V=browser(['public/js/voice.js']).App.voice;
  const a={name:'Mónica',lang:'es-ES',voiceURI:'one'};
  const b={name:'Francisca',lang:'es-CL',voiceURI:'two'};
  const c={name:'Paulina',lang:'es-MX',voiceURI:'three'};
  const entries=V.displayChoices([a,b,c]);
  assert.equal(V.searchChoices(entries,'monica es-es')[0].voice,a);
  assert.equal(V.searchChoices(entries,'es_CL')[0].voice,b);
  assert.equal(V.searchChoices(entries,'three')[0].voice,c);
  assert.equal(V.searchChoices(entries,'no matching voice').length,0);
  const diff=V.voiceChanges([a,c],[a,b]);
  assert.equal(diff.before,2);
  assert.equal(diff.after,2);
  assert.equal(diff.removed,1);
  assert.equal(diff.added[0],b);
  assert.equal(V.voiceChanges([a,b],[b,a]).added.length,0);
});
test('refresh polls several times and reports differences without rerouting', () => {
  const src=read('public/js/views/settings.js');
  const block=src.slice(src.indexOf("row(t('set.voice')"),src.indexOf("row(t('set.voice_rate')"));
  assert.match(block,/for \(const delay of \[0, 350, 900, 1500\]\)/);
  assert.match(block,/if \(!refresh\.isConnected\) return/);
  assert.match(block,/A\.voice\.voiceChanges\(before, A\.voice\.now\(\)\)/);
  assert.match(block,/t\('set\.voice_unchanged'\)/);
  assert.match(block,/v\.localService/);
  assert.doesNotMatch(block,/A\.route\(/);
});
