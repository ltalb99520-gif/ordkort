/* Which voice says a card: the site's recordings, or the device's — its default voice or one from the list. Pure. */
(() => {
  const A = window.App;

  const SITE = 'site';
  const DEVICE = 'system';
  const CHILE = 'chile';
  const NEURAL = 'neural';
  function neural(settings, lang) {
    return settings?.voice === NEURAL && lang === 'es' ? (settings.neuralVoice === 'lorenzo' ? 'lorenzo' : 'catalina') : '';
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

  function langTag(voices, lang) {
    const v = forLang(voices, lang);
    return (v && v.lang) || lang;
  }

  A.voice = { SITE, DEVICE, CHILE, NEURAL, neural, usesSite, list, forLang, resolve, langTag, rate };
})();
