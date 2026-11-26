import test from 'node:test';
import assert from 'node:assert/strict';
import { browser, read } from './helpers.mjs';
const V=browser(['public/js/voice.js']).App.voice;
const mx={name:'Paulina',lang:'es-MX',voiceURI:'mx'};
const cl={name:'Francisca',lang:'es-CL',voiceURI:'cl'};
const es={name:'Mónica',lang:'es-ES',voiceURI:'es'};
test('Chilean mode requests es-CL without binding an unrelated voice',()=>{
  const p=V.speechPlan([es,mx],{voice:'chile'},'es');
  assert.equal(p.voice,null);
  assert.equal(p.lang,'es-CL');
  assert.equal(p.fallback,mx);
  assert.equal(V.speechPlan([],{voice:'chile'},'es').lang,'es-CL');
});
test('an exposed Chilean voice is explicitly selected; manual selection is preserved',()=>{
  assert.equal(V.speechPlan([mx,cl],{voice:'chile'},'es').voice,cl);
  assert.equal(V.speechPlan([mx,cl],{voice:'system',voiceURI:'mx'},'es').voice,mx);
  assert.equal(V.speechPlan([mx],{voice:'neural'},'es').voice,null);
  assert.equal(V.speechPlan([mx],{voice:'neural'},'es').lang,'es-CL');
});
test('playback applies the locale plan and retries only explicit voice or language errors',()=>{
  const src=read('public/js/ui.js');
  assert.match(src,/const plan = A\.voice\.speechPlan\(/);
  assert.match(src,/if \(v\) u\.voice = v;/);
  assert.match(src,/u\.lang = plan\.lang;/);
  assert.match(src,/\['language-unavailable', 'voice-unavailable'\]\.includes\(event\.error\)/);
  assert.match(src,/retry\.voice = plan\.fallback;/);
});
