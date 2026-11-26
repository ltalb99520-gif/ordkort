/* Which voice says a card: the site's recordings, or the device's — its default voice or one from the list. Pure. */
(() => {
  const A = window.App;

  const SITE = 'site';
  const DEVICE = 'system';
  const CHILE = 'chile';
  const NEURAL = 'neural';
  const CLOUD = Object.freeze({
    es: ['catalina','lorenzo','es-ES-ElviraNeural','es-MX-DaliaNeural'],
    en: ['en-US-JennyNeural','en-US-GuyNeural','en-GB-SoniaNeural','en-AU-NatashaNeural'],
    zh: ['zh-CN-XiaoxiaoNeural','zh-CN-YunxiNeural'],
    fr: ['fr-FR-DeniseNeural','fr-CA-SylvieNeural'],
    pt: ['pt-BR-FranciscaNeural','pt-PT-RaquelNeural'],
    ja: ['ja-JP-NanamiNeural','ja-JP-KeitaNeural'],
    ko: ['ko-KR-SunHiNeural','ko-KR-InJoonNeural'],
    de: ['de-DE-KatjaNeural','de-DE-ConradNeural'],
    it: ['it-IT-ElsaNeural','it-IT-DiegoNeural'],
  });
  function cloudChoices(lang) {
    return (Object.hasOwn(CLOUD, lang) ? CLOUD[lang] : []).map(id => {
      const full = id === 'catalina' ? 'es-CL-CatalinaNeural' : id === 'lorenzo' ? 'es-CL-LorenzoNeural' : id;
      const [language, region, name] = full.split('-');
      return {id, label: name.replace(/Neural$/, '') + ' — ' + language + '-' + region};
    });
  }
  function neural(settings, lang) {
    if (settings?.voice !== NEURAL) return '';
    const options = cloudChoices(lang);
    return options.find(v => v.id === settings.neuralVoice)?.id || options[0]?.id || '';
  }

  const ALIAS = { nb: ['nb', 'no', 'nn'], nn: ['nn', 'nb', 'no'], zh: ['zh-cn', 'cmn', 'zh'], prs: ['fa-af', 'prs', 'fa'], kmr: ['ku', 'kmr'], tl: ['fil', 'tl'], he: ['he', 'iw'], arz: ['ar-eg', 'ar'], apc: ['ar-lb', 'ar-sy', 'ar'], ary: ['ar-ma', 'ar'], yue: ['zh-hk', 'yue'], gsw: ['gsw', 'de-ch'], bs: ['bs', 'hr'] };

  const tag = (v) => String((v && v.lang) || '').toLowerCase().replace('_', '-');

  function list(voices, lang) {
    const codes = ALIAS[lang] || [lang];
    const out = [];
    for (const c of codes) {
      for (const v of voices || []) if (tag(v).startsWith(c) && !out.includes(v)) out.push(v);
    }
    return out;
  }

  function choices(voices, lang) {
    const source = lang ? list(voices, lang) : (voices || []);
    return [...new Map(source.filter(v => v.voiceURI).map(v => [v.voiceURI, v])).values()];
  }

  // Same display name can refer to distinct installed voice identifiers.
  // Retain these choices, but distinguish known quality or number otherwise.
  function displayChoices(voices, lang) {
    const entries = choices(voices, lang);
    const base = v => v.name + ' — ' + v.lang;
    const quality = v => {
      const id = String(v.voiceURI);
      const match = id.match(/(?:^|[. _-])(premium|enhanced|compact|standard|default)(?:$|[. _-])/i);
      return match ? match[1].toLowerCase() : '';
    };
    const seen = new Map();
    return entries.map(v => {
      const label = base(v);
      const same = entries.filter(x => x.name === v.name && tag(x) === tag(v));
      if (same.length === 1) return { voice: v, label };
      const q = quality(v);
      const uniqueQuality = q && same.filter(x => quality(x) === q).length === 1;
      if (uniqueQuality) return { voice: v, label: label + ' · ' + q };
      const key = v.name + '\\n' + tag(v);
      const n = (seen.get(key) || 0) + 1;
      seen.set(key, n);
      return { voice: v, label: label + ' · #' + n };
    });
  }

  function searchChoices(entries, query) {
    const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/_/g, '-');
    const terms = normalize(query).trim().split(/\s+/).filter(Boolean);
    return entries.filter(({voice, label}) => {
      const haystack = normalize([label, voice.name, voice.lang, voice.voiceURI].join(' '));
      return terms.every(term => haystack.includes(term));
    });
  }

  function voiceChanges(before, after) {
    const old = new Set(choices(before).map(v => v.voiceURI));
    const current = choices(after);
    const ids = new Set(current.map(v => v.voiceURI));
    return { before: old.size, after: ids.size, added: current.filter(v => !old.has(v.voiceURI)), removed: [...old].filter(id => !ids.has(id)).length };
  }

  function forLang(voices, lang) {
    const fits = list(voices, lang);
    const preferred = (xs) => xs.find((x) => /natural|neural|online|google|enhanced|premium|siri/i.test(x.name)) || xs[0] || null;
    if (lang === 'es') {
      const chilean = fits.filter((v) => tag(v) === 'es-cl');
      if (chilean.length) return preferred(chilean);
    }
    return preferred(fits);
  }

  function usesSite(voice, lang) {
    return voice !== DEVICE && !(voice === CHILE && (!lang || lang === 'es'));
  }

  function rate(settings) {
    const n = Number(settings?.voiceRate ?? 0.9);
    return Number.isFinite(n) && n >= 0.5 && n <= 1.5 ? n : 0.9;
  }

  /* The voice to speak `lang` with, or null for "leave u.voice unset": that is the only way to the system default,
     which on iOS is the Siri voice — a voice getVoices() never lists. */
  function resolve(voices, settings, lang) {
    if ((settings?.voice === CHILE || neural(settings, lang)) && lang === 'es') {
      const fits = list(voices, lang);
      const exact = fits.filter((v) => tag(v) === 'es-cl');
      if (exact.length) return forLang(exact, lang);
      const latam = fits.filter((v) => /^es-(?:419|ar|bo|co|cr|cu|do|ec|gt|hn|mx|ni|pa|pe|pr|py|sv|uy|ve)$/.test(tag(v)));
      return forLang(latam, lang) || forLang(fits, lang);
    }
    if (usesSite(settings?.voice, lang)) return forLang(voices, lang);
    const pick = settings?.voiceURI;
    return pick ? (voices || []).find((v) => v.voiceURI === pick) || null : null;
  }

  // Ask the OS for Chilean speech even when the browser hides installed voices.
  // An explicit non-Chilean voice would override this locale request.
  function speechPlan(voices, settings, lang) {
    const fallback = resolve(voices, settings, lang);
    if (lang === 'es' && (settings?.voice === CHILE || neural(settings, lang))) {
      if (fallback && tag(fallback) === 'es-cl') return { voice: fallback, lang: fallback.lang, fallback: null };
      return { voice: null, lang: 'es-CL', fallback };
    }
    return { voice: fallback, lang: fallback?.lang || langTag(voices, lang), fallback: null };
  }

  function langTag(voices, lang) {
    const v = forLang(voices, lang);
    return (v && v.lang) || lang;
  }

  A.voice = { SITE, DEVICE, CHILE, NEURAL, neural, cloudChoices, usesSite, list, choices, displayChoices, searchChoices, voiceChanges, forLang, resolve, speechPlan, langTag, rate };
})();
