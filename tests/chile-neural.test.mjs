import test from 'node:test';
import assert from 'node:assert/strict';
import { configured, ssml, chileSpeech, CLOUD_VOICES } from '../src/sources/chile-speech.js';
import { geminiSpeech, GEMINI_MODEL, GEMINI_LOCALES, GEMINI_VOICES } from '../src/sources/gemini-speech.js';
import { tts, cloudStatus } from '../src/sources/voice.js';
import { browser } from './helpers.mjs';
function db() {
  const cache = new Map(), hits = new Map();
  return { cache, hits, prepare: (sql) => ({ bind: (...a) => ({
    first: async () => {
      if (/FROM cache/.test(sql)) return cache.get(a[0]) || null;
      if (/INSERT INTO hits/.test(sql)) { const n = (hits.get(a[0]) || 0) + a[1]; hits.set(a[0], n); return {n}; }
      if (/FROM hits/.test(sql)) return { n: hits.get(a[0]) || 0 };
      return null;
    },
    run: async () => { if (/INSERT INTO cache/.test(sql)) cache.set(a[0], {v:a[1], t:a[2]}); return {}; },
  }) }) };
}
const env = () => ({DB:db(), AZURE_SPEECH_KEY:'test-only', AZURE_SPEECH_REGION:'eastus'});
const ask = (e, voice, text, lang='es') => tts(new Request('https://ordkort.test/api/tts?l='+lang+'&neural='+voice+'&q='+encodeURIComponent(text)),e,'test');
test('configuration and SSML validate voice and escape text', () => {
  assert.equal(configured({}),false);
  assert.equal(configured({...env(),AZURE_SPEECH_REGION:'evil.example'}),false);
  assert.match(ssml('a < b & c','catalina'), /a &lt; b &amp; c/);
  assert.match(ssml('hola','lorenzo'), /es-CL-LorenzoNeural/);
  assert.throws(()=>ssml('hola','constructor'));
});
test('unconfigured cloud returns uncached unavailable; invalid voices and languages rejected', async () => {
  const r=await ask({DB:db()},'catalina','hola');
  assert.equal(r.status,404); assert.equal(r.headers.get('Cache-Control'),'no-store');
  await assert.rejects(ask(env(),'constructor','hola'),e=>e.status===400);
  await assert.rejects(ask(env(),'catalina','hello','en'),e=>e.status===400);
});
test('cloud audio caches separately by voice and text; provider errors stay uncached', async (t) => {
  const e=env(); let calls=0;
  t.mock.method(globalThis,'fetch',async (url,opts)=>{
    calls++; assert.equal(url,'https://eastus.tts.speech.microsoft.com/cognitiveservices/v1');
    assert.equal(opts.headers['Ocp-Apim-Subscription-Key'],'test-only');
    if(opts.body.includes('fallo')) return new Response('',{status:429});
    return new Response(new Uint8Array([73,68,51,1]),{headers:{'Content-Type':'audio/mpeg'}});
  });
  const r=await ask(e,'catalina','Palta de prueba');
  assert.equal(r.status,200); assert.match(decodeURIComponent(r.headers.get('X-Voice-By')), /CatalinaNeural/);
  assert.equal((await ask(e,'catalina','Palta de prueba')).status,200); assert.equal(calls,1);
  assert.equal((await ask(e,'lorenzo','Palta de prueba')).status,200); assert.equal(calls,2);
  assert.equal((await ask(e,'catalina','palta de prueba')).status,200); assert.equal(calls,3);
  assert.equal((await ask(e,'catalina','fallo')).status,404);
  assert.equal((await ask(e,'catalina','fallo')).status,404); assert.equal(calls,5);
});
test('daily and monthly budgets refuse before provider request', async (t)=>{
  const day=new Date().toISOString().slice(0,10);
  const e=env(); const f=t.mock.method(globalThis,'fetch',async()=>{throw Error('must not call');});
  e.DB.hits.set('azure-tts:day:'+day,12000);
  assert.equal(await chileSpeech(e,'hola','catalina'),null);
  const m=env(); m.DB.hits.set('azure-tts:month:'+day.slice(0,7),350000);
  assert.equal(await chileSpeech(m,'hola','lorenzo'),null);
  assert.equal(f.mock.callCount(),0);
});
test('cloud mode supports several languages and retains Chilean compatibility',()=>{
  const V=browser(['public/js/voice.js']).App.voice;
  const s={voice:'neural',neuralVoice:'lorenzo'};
  assert.equal(V.neural(s,'es'),'lorenzo'); assert.equal(V.neural(s,'en'),'en-US-JennyNeural'); assert.equal(V.neural(s,'eo'),'');
  assert.equal(V.neural({voice:'neural'},'es'),'catalina');
  const cl={lang:'es-CL',name:'Chile',voiceURI:'cl'};
  assert.equal(V.resolve([{lang:'es-ES',name:'Premium'},cl],s,'es'),cl);
});

test('client and server cloud catalogs match, SSML locale follows selected voice',()=>{
  const V=browser(['public/js/voice.js']).App.voice;
  for(const [lang,voices] of Object.entries(CLOUD_VOICES)) {
    assert.deepEqual(Array.from(V.cloudChoices(lang),v=>v.id),Object.keys(voices));
    for(const [id,name] of Object.entries(voices)) assert.ok(ssml('test',id,lang).includes('name="'+name+'"'));
  }
  assert.throws(()=>ssml('hello','en-US-JennyNeural','es'));
  assert.match(ssml('hello','en-GB-SoniaNeural','en'),/xml:lang="en-GB"/);
});
test('multilingual cloud audio is cached separately and configuration status reveals no key',async(t)=>{
  const e=env();let calls=0;
  t.mock.method(globalThis,'fetch',async(url,opts)=>{
    calls++;
    assert.match(opts.body,/xml:lang="en-(US|GB)"/);
    return new Response(new Uint8Array([73,68,51,1]),{headers:{'Content-Type':'audio/mpeg'}});
  });
  assert.equal((await ask(e,'en-US-JennyNeural','hello','en')).status,200);
  assert.equal((await ask(e,'en-US-JennyNeural','hello','en')).status,200);
  assert.equal((await ask(e,'en-GB-SoniaNeural','hello','en')).status,200);
  assert.equal(calls,2);
  assert.deepEqual(await cloudStatus(e).json(),{configured:true});
  assert.deepEqual(await cloudStatus({}).json(),{configured:false});
});
test('native fallback follows the selected cloud region',()=>{
  const V=browser(['public/js/voice.js']).App.voice;
  const cl={name:'Chile',lang:'es-CL',voiceURI:'cl'};
  const mx={name:'Mexico',lang:'es-MX',voiceURI:'mx'};
  assert.equal(V.speechPlan([cl,mx],{voice:'neural',neuralVoice:'es-MX-DaliaNeural'},'es').voice,mx);
  assert.equal(V.speechPlan([cl],{voice:'neural',neuralVoice:'es-MX-DaliaNeural'},'es').lang,'es-MX');
});

test('Gemini choices agree with server locale and voice catalog',()=>{
  const V=browser(['public/js/voice.js']).App.voice;
  for(const [lang,locales] of Object.entries(GEMINI_LOCALES)) {
    assert.deepEqual(Array.from(V.cloudChoices(lang,'gemini'),v=>v.id),locales.flatMap(l=>GEMINI_VOICES.map(v=>'gemini:'+l+':'+v)));
  }
  const settings={voice:'neural',neuralVoice:'gemini:es-CL:Kore'};
  assert.equal(V.provider(settings),'gemini');
  assert.equal(V.neural(settings,'es'),'gemini:es-CL:Kore');
  assert.equal(V.speechPlan([],settings,'es').lang,'es-CL');
});
test('Gemini is opt-in, validates locale and caps provider calls',async(t)=>{
  const e=env(), id='gemini:es-CL:Kore';
  assert.equal((await ask(e,id,'hola')).status,404);
  assert.deepEqual(await cloudStatus(e,'gemini').json(),{configured:false});
  e.GEMINI_TTS_API_KEY='test-gemini-key';
  e.GEMINI_TTS_DAILY_REQUESTS=1;
  const wav=new Uint8Array(46);wav.set(new TextEncoder().encode('RIFF'),0);wav.set(new TextEncoder().encode('WAVE'),8);
  const f=t.mock.method(globalThis,'fetch',async(url,opts)=>{
    assert.equal(url,'https://generativelanguage.googleapis.com/v1beta/interactions');
    assert.equal(opts.headers['x-goog-api-key'],'test-gemini-key');
    const body=JSON.parse(opts.body);
    assert.equal(body.model,GEMINI_MODEL);assert.equal(body.store,false);
    assert.equal(body.input[0].content[0].text,'hola');
    assert.match(body.input[0].content[0].annotations[0].style,/Chilean Spanish/);
    assert.equal(body.generation_config.speech_config[0].voice,'Kore');
    return Response.json({steps:[{type:'model_output',content:[{type:'audio',data:btoa(String.fromCharCode(...wav))}]}]});
  });
  const res=await ask(e,id,'hola');
  assert.equal(res.status,200);assert.equal(res.headers.get('Content-Type'),'audio/wav');
  assert.match(decodeURIComponent(res.headers.get('X-Voice-By')),/Gemini TTS/);
  assert.equal((await ask(e,id,'hola')).status,200);
  assert.equal((await ask(e,id,'adios')).status,404);
  assert.equal(f.mock.callCount(),1);
  await assert.rejects(ask(e,id,'hello','en'),err=>err.status===400);
  await assert.rejects(ask(e,'gemini:es-CL:Unknown','hola'),err=>err.status===400);
  assert.deepEqual(await cloudStatus(e,'gemini').json(),{configured:true});
});
test('Gemini errors and invalid audio return no result',async(t)=>{
  const e={...env(),GEMINI_TTS_API_KEY:'test'};
  t.mock.method(globalThis,'fetch',async()=>Response.json({steps:[{type:'model_output',content:[{type:'audio',data:'AAAA'}]}]}));
  assert.equal(await geminiSpeech(e,'hola','gemini:es-CL:Kore','es'),null);
});
