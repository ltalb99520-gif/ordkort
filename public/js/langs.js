/* Languages: code, own name, English name (for the AI), TTS voice, "hello", RTL */
(globalThis.App ||= {}).langs = (() => {
  const RTL = 1;
  const rows = [
    ['en', 'English', 'English', 'en-US', 'Hello'],
    ['nb', 'Norsk bokmål', 'Norwegian Bokmål', 'nb-NO', 'Hei'],
    ['nn', 'Norsk nynorsk', 'Norwegian Nynorsk', 'nb-NO', 'Hei'],
    ['uk', 'Українська', 'Ukrainian', 'uk-UA', 'Привіт'],
    ['ru', 'Русский', 'Russian', 'ru-RU', 'Привет'],
    ['ar', 'العربية', 'Arabic (Modern Standard)', 'ar-SA', 'مرحبا', RTL],
    ['zh', '中文', 'Chinese (Mandarin, Simplified)', 'zh-CN', '你好'],
    ['es', 'Español', 'Spanish', 'es-ES', 'Hola'],
    ['fr', 'Français', 'French', 'fr-FR', 'Bonjour'],
    ['de', 'Deutsch', 'German', 'de-DE', 'Hallo'],
    ['it', 'Italiano', 'Italian', 'it-IT', 'Ciao'],
    ['pt', 'Português', 'Portuguese', 'pt-PT', 'Olá'],
    ['pl', 'Polski', 'Polish', 'pl-PL', 'Cześć'],
    ['tr', 'Türkçe', 'Turkish', 'tr-TR', 'Merhaba'],
    ['ja', '日本語', 'Japanese', 'ja-JP', 'こんにちは'],
    ['ko', '한국어', 'Korean', 'ko-KR', '안녕하세요'],
    ['hi', 'हिन्दी', 'Hindi', 'hi-IN', 'नमस्ते'],
    ['bn', 'বাংলা', 'Bengali', 'bn-BD', 'নমস্কার'],
    ['id', 'Bahasa Indonesia', 'Indonesian', 'id-ID', 'Halo'],
    ['vi', 'Tiếng Việt', 'Vietnamese', 'vi-VN', 'Xin chào'],
    ['th', 'ไทย', 'Thai', 'th-TH', 'สวัสดี'],
    ['nl', 'Nederlands', 'Dutch', 'nl-NL', 'Hallo'],
    ['sv', 'Svenska', 'Swedish', 'sv-SE', 'Hej'],
    ['da', 'Dansk', 'Danish', 'da-DK', 'Hej'],
    ['fi', 'Suomi', 'Finnish', 'fi-FI', 'Hei'],
    ['is', 'Íslenska', 'Icelandic', 'is-IS', 'Halló'],
    ['cs', 'Čeština', 'Czech', 'cs-CZ', 'Ahoj'],
    ['sk', 'Slovenčina', 'Slovak', 'sk-SK', 'Ahoj'],
    ['ro', 'Română', 'Romanian', 'ro-RO', 'Salut'],
    ['hu', 'Magyar', 'Hungarian', 'hu-HU', 'Szia'],
    ['el', 'Ελληνικά', 'Greek', 'el-GR', 'Γεια σου'],
    ['bg', 'Български', 'Bulgarian', 'bg-BG', 'Здравей'],
    ['sr', 'Српски', 'Serbian', 'sr-RS', 'Здраво'],
    ['hr', 'Hrvatski', 'Croatian', 'hr-HR', 'Bok'],
    ['lt', 'Lietuvių', 'Lithuanian', 'lt-LT', 'Labas'],
    ['lv', 'Latviešu', 'Latvian', 'lv-LV', 'Sveiki'],
    ['et', 'Eesti', 'Estonian', 'et-EE', 'Tere'],
    ['be', 'Беларуская', 'Belarusian', 'be-BY', 'Прывітанне'],
    ['ka', 'ქართული', 'Georgian', 'ka-GE', 'გამარჯობა'],
    ['hy', 'Հայերեն', 'Armenian', 'hy-AM', 'Բարև'],
    ['kk', 'Қазақша', 'Kazakh', 'kk-KZ', 'Сәлем'],
    ['uz', 'Oʻzbekcha', 'Uzbek', 'uz-UZ', 'Salom'],
    ['az', 'Azərbaycanca', 'Azerbaijani', 'az-AZ', 'Salam'],
    ['he', 'עברית', 'Hebrew', 'he-IL', 'שלום', RTL],
    ['fa', 'فارسی', 'Persian (Farsi)', 'fa-IR', 'سلام', RTL],
    ['prs', 'دری', 'Dari', 'fa-AF', 'سلام', RTL],
    ['ur', 'اردو', 'Urdu', 'ur-PK', 'السلام علیکم', RTL],
    ['ps', 'پښتو', 'Pashto', 'ps-AF', 'سلام', RTL],
    ['ckb', 'کوردی', 'Kurdish (Sorani)', 'ckb', 'سڵاو', RTL],
    ['kmr', 'Kurmancî', 'Kurdish (Kurmanji)', 'ku', 'Silav'],
    ['ta', 'தமிழ்', 'Tamil', 'ta-IN', 'வணக்கம்'],
    ['sw', 'Kiswahili', 'Swahili', 'sw-KE', 'Habari'],
    ['am', 'አማርኛ', 'Amharic', 'am-ET', 'ሰላም'],
    ['ti', 'ትግርኛ', 'Tigrinya', 'ti-ER', 'ሰላም'],
    ['so', 'Soomaali', 'Somali', 'so-SO', 'Salaan'],
    ['sq', 'Shqip', 'Albanian', 'sq-AL', 'Përshëndetje'],
    ['tl', 'Filipino', 'Filipino (Tagalog)', 'fil-PH', 'Kumusta'],
    ['ms', 'Bahasa Melayu', 'Malay', 'ms-MY', 'Helo'],
    ['la', 'Latina', 'Latin', 'la', 'Salve'],
    ['eo', 'Esperanto', 'Esperanto', 'eo', 'Saluton'],
    // Celtic
    ['cy', 'Cymraeg', 'Welsh', 'cy-GB', 'Helo'],
    ['ga', 'Gaeilge', 'Irish', 'ga-IE', 'Dia duit'],
    ['gd', 'Gàidhlig', 'Scottish Gaelic', 'gd', 'Halò'],
    ['br', 'Brezhoneg', 'Breton', 'br', 'Demat'],
    ['kw', 'Kernewek', 'Cornish', 'kw', 'Dydh da'],
    // Sámi
    ['se', 'Davvisámegiella', 'Northern Sámi', 'se-NO', 'Bures'],
    ['smj', 'Julevsámegiella', 'Lule Sámi', 'smj', 'Buorre biejvve'],
    ['sma', 'Åarjelsaemien gïele', 'South Sámi', 'sma', 'Buerie biejjie'],
    ['smn', 'Anarâškielâ', 'Inari Sámi', 'smn', 'Pyeri päivi'],
    // other European
    ['ca', 'Català', 'Catalan', 'ca-ES', 'Hola'],
    ['gl', 'Galego', 'Galician', 'gl-ES', 'Ola'],
    ['eu', 'Euskara', 'Basque', 'eu-ES', 'Kaixo'],
    ['oc', 'Occitan', 'Occitan', 'oc', 'Bonjorn'],
    ['co', 'Corsu', 'Corsican', 'co', 'Salute'],
    ['rm', 'Rumantsch', 'Romansh', 'rm', 'Bun di'],
    ['mt', 'Malti', 'Maltese', 'mt-MT', 'Bonġu'],
    ['fo', 'Føroyskt', 'Faroese', 'fo-FO', 'Halló'],
    ['kl', 'Kalaallisut', 'Greenlandic', 'kl-GL', 'Aluu'],
    ['fy', 'Frysk', 'West Frisian', 'fy-NL', 'Hoi'],
    ['lb', 'Lëtzebuergesch', 'Luxembourgish', 'lb-LU', 'Moien'],
    ['nds', 'Plattdüütsch', 'Low German', 'nds', 'Moin'],
    ['gsw', 'Schwiizerdütsch', 'Swiss German', 'de-CH', 'Grüezi'],
    ['hsb', 'Hornjoserbšćina', 'Upper Sorbian', 'hsb', 'Dobry dźeń'],
    ['dsb', 'Dolnoserbšćina', 'Lower Sorbian', 'dsb', 'Dobry źeń'],
    ['sl', 'Slovenščina', 'Slovene', 'sl-SI', 'Živjo'],
    ['bs', 'Bosanski', 'Bosnian', 'bs-BA', 'Zdravo'],
    ['mk', 'Македонски', 'Macedonian', 'mk-MK', 'Здраво'],
    ['yi', 'ייִדיש', 'Yiddish', 'yi', 'שלום', RTL],
    ['crh', 'Qırımtatarca', 'Crimean Tatar', 'crh', 'Selâm'],
    // Turkic and Central Asian
    ['tt', 'Татарча', 'Tatar', 'tt-RU', 'Сәлам'],
    ['ba', 'Башҡортса', 'Bashkir', 'ba', 'Сәләм'],
    ['ky', 'Кыргызча', 'Kyrgyz', 'ky-KG', 'Салам'],
    ['tg', 'Тоҷикӣ', 'Tajik', 'tg-TJ', 'Салом'],
    ['tk', 'Türkmençe', 'Turkmen', 'tk-TM', 'Salam'],
    ['mn', 'Монгол', 'Mongolian', 'mn-MN', 'Сайн уу'],
    ['ug', 'ئۇيغۇرچە', 'Uyghur', 'ug-CN', 'ياخشىمۇسىز', RTL],
    // South Asia
    ['mr', 'मराठी', 'Marathi', 'mr-IN', 'नमस्कार'],
    ['gu', 'ગુજરાતી', 'Gujarati', 'gu-IN', 'નમસ્તે'],
    ['pa', 'ਪੰਜਾਬੀ', 'Punjabi (Gurmukhi)', 'pa-IN', 'ਸਤ ਸ੍ਰੀ ਅਕਾਲ'],
    ['te', 'తెలుగు', 'Telugu', 'te-IN', 'నమస్కారం'],
    ['kn', 'ಕನ್ನಡ', 'Kannada', 'kn-IN', 'ನಮಸ್ಕಾರ'],
    ['ml', 'മലയാളം', 'Malayalam', 'ml-IN', 'നമസ്കാരം'],
    ['or', 'ଓଡ଼ିଆ', 'Odia', 'or-IN', 'ନମସ୍କାର'],
    ['as', 'অসমীয়া', 'Assamese', 'as-IN', 'নমস্কাৰ'],
    ['si', 'සිංහල', 'Sinhala', 'si-LK', 'ආයුබෝවන්'],
    ['ne', 'नेपाली', 'Nepali', 'ne-NP', 'नमस्ते'],
    ['sa', 'संस्कृतम्', 'Sanskrit', 'sa', 'नमस्ते'],
    ['bo', 'བོད་སྐད', 'Tibetan', 'bo', 'བཀྲ་ཤིས་བདེ་ལེགས།'],
    // Southeast Asia and Pacific
    ['my', 'မြန်မာ', 'Burmese', 'my-MM', 'မင်္ဂလာပါ'],
    ['km', 'ខ្មែរ', 'Khmer', 'km-KH', 'សួស្តី'],
    ['lo', 'ລາວ', 'Lao', 'lo-LA', 'ສະບາຍດີ'],
    ['jv', 'Basa Jawa', 'Javanese', 'jv-ID', 'Halo'],
    ['su', 'Basa Sunda', 'Sundanese', 'su-ID', 'Wilujeng'],
    ['ceb', 'Cebuano', 'Cebuano', 'ceb', 'Kumusta'],
    ['yue', '粵語', 'Cantonese', 'zh-HK', '你好'],
    ['mi', 'Māori', 'Māori', 'mi', 'Kia ora'],
    ['haw', 'ʻŌlelo Hawaiʻi', 'Hawaiian', 'haw', 'Aloha'],
    ['sm', 'Gagana Sāmoa', 'Samoan', 'sm', 'Talofa'],
    ['to', 'Lea faka-Tonga', 'Tongan', 'to', 'Mālō e lelei'],
    ['fj', 'Vosa Vakaviti', 'Fijian', 'fj', 'Bula'],
    ['tpi', 'Tok Pisin', 'Tok Pisin', 'tpi', 'Halo'],
    // Arabic dialects
    ['arz', 'مصرى', 'Egyptian Arabic', 'ar-EG', 'أهلاً', RTL],
    ['apc', 'شامي', 'Levantine Arabic', 'ar-LB', 'مرحبا', RTL],
    ['ary', 'الدارجة', 'Moroccan Arabic (Darija)', 'ar-MA', 'السلام', RTL],
    // Africa
    ['af', 'Afrikaans', 'Afrikaans', 'af-ZA', 'Hallo'],
    ['zu', 'isiZulu', 'Zulu', 'zu-ZA', 'Sawubona'],
    ['xh', 'isiXhosa', 'Xhosa', 'xh-ZA', 'Molo'],
    ['ss', 'SiSwati', 'Swazi', 'ss', 'Sawubona'],
    ['st', 'Sesotho', 'Southern Sotho', 'st-ZA', 'Dumela'],
    ['tn', 'Setswana', 'Tswana', 'tn-ZA', 'Dumela'],
    ['ts', 'Xitsonga', 'Tsonga', 'ts-ZA', 'Avuxeni'],
    ['ve', 'Tshivenḓa', 'Venda', 've-ZA', 'Ndaa'],
    ['sn', 'chiShona', 'Shona', 'sn-ZW', 'Mhoro'],
    ['ny', 'Chichewa', 'Chichewa', 'ny-MW', 'Moni'],
    ['yo', 'Yorùbá', 'Yoruba', 'yo-NG', 'Báwo ni'],
    ['ig', 'Igbo', 'Igbo', 'ig-NG', 'Nnọọ'],
    ['ha', 'Hausa', 'Hausa', 'ha-NG', 'Sannu'],
    ['ak', 'Twi', 'Twi (Akan)', 'ak-GH', 'Akwaaba'],
    ['ee', 'Eʋegbe', 'Ewe', 'ee', 'Woezɔ'],
    ['wo', 'Wolof', 'Wolof', 'wo-SN', 'Nanga def'],
    ['ff', 'Fulfulde', 'Fula', 'ff', 'Jaarama'],
    ['bm', 'Bamanankan', 'Bambara', 'bm', 'I ni ce'],
    ['ln', 'Lingála', 'Lingala', 'ln-CD', 'Mbote'],
    ['lg', 'Luganda', 'Luganda', 'lg-UG', 'Oli otya'],
    ['rw', 'Ikinyarwanda', 'Kinyarwanda', 'rw-RW', 'Muraho'],
    ['rn', 'Ikirundi', 'Kirundi', 'rn', 'Amahoro'],
    ['om', 'Afaan Oromoo', 'Oromo', 'om-ET', 'Akkam'],
    ['mg', 'Malagasy', 'Malagasy', 'mg-MG', 'Salama'],
    ['kab', 'Taqbaylit', 'Kabyle', 'kab', 'Azul'],
    ['zgh', 'ⵜⴰⵎⴰⵣⵉⵖⵜ', 'Standard Moroccan Tamazight', 'zgh', 'ⴰⵣⵓⵍ'],
    // the Americas
    ['qu', 'Runasimi', 'Quechua', 'qu-PE', 'Napaykullayki'],
    ['gn', 'Avañeʼẽ', 'Guaraní', 'gn-PY', 'Mba’éichapa'],
    ['ay', 'Aymar aru', 'Aymara', 'ay-BO', 'Kamisaki'],
    ['nah', 'Nāhuatl', 'Nahuatl', 'nah', 'Niltze'],
    ['nv', 'Diné bizaad', 'Navajo', 'nv', 'Yáʼátʼééh'],
    ['chr', 'ᏣᎳᎩ', 'Cherokee', 'chr', 'ᎣᏏᏲ'],
    ['iu', 'ᐃᓄᒃᑎᑐᑦ', 'Inuktitut', 'iu', 'ᐊᐃ'],
    ['ht', 'Kreyòl ayisyen', 'Haitian Creole', 'ht-HT', 'Bonjou'],
    ['pap', 'Papiamentu', 'Papiamento', 'pap', 'Bon dia'],
    // classical and constructed
    ['grc', 'Ἑλληνική', 'Ancient Greek', 'grc', 'Χαῖρε'],
    ['non', 'Norrǿn', 'Old Norse', 'non', 'Heill'],
    ['ang', 'Ænglisc', 'Old English', 'ang', 'Wes hāl'],
    ['ia', 'Interlingua', 'Interlingua', 'ia', 'Salute'],
    ['tok', 'toki pona', 'Toki Pona', 'tok', 'toki'],
    ['tlh', 'tlhIngan Hol', 'Klingon', 'tlh', 'nuqneH'],
  ];

  const list = rows.map(([code, name, en, tts, hello, rtl]) => ({ code, name, en, tts, hello, rtl: !!rtl }));
  const map = Object.fromEntries(list.map((l) => [l.code, l]));
  const get = (c) => map[c] || { code: c, name: c, en: c, tts: c, hello: '', rtl: false };

  /* The gender an article shows (c = common gender). A noun's gender is its article's: "en tallerken" is
     masculine whatever the AI wrote — used in the prompts, to check AI cards and for the label on a card. */
  const ARTICLE_GENDER = {
    nb: { en: 'm', ei: 'f', et: 'n' },
    nn: { ein: 'm', ei: 'f', eit: 'n' },
    de: { der: 'm', die: 'f', das: 'n' },
    sv: { en: 'c', ett: 'n' },
    da: { en: 'c', et: 'n' },
    nl: { de: 'c', het: 'n' },
    fr: { le: 'm', la: 'f' },
    es: { el: 'm', la: 'f' },
    it: { il: 'm', lo: 'm', la: 'f' },
    pt: { o: 'm', a: 'f' },
    el: { ο: 'm', η: 'f', το: 'n' },
    ca: { el: 'm', la: 'f' },
    gl: { o: 'm', a: 'f' },
    fy: { de: 'c', it: 'n' },
  };
  function articleGender(code, term) {
    const [art, ...rest] = String(term || '').trim().toLowerCase().split(/\s+/);
    return (rest.length && ARTICLE_GENDER[code]?.[art]) || '';
  }

  /* Which language a text is in, as far as its letters tell: the script first, then letters only some languages
     have (ø, ñ, ї…), then hints (names in a file name, the languages in use), then the usual one for the script.
     For an Anki deck whose sides are "щека" and "cheek", and for speech that must not read Russian as Norwegian. */
  const SCRIPTS = [
    ['Cyrillic', /\p{Script=Cyrillic}/u, ['ru', 'uk', 'bg', 'sr', 'be', 'kk', 'mk', 'tt', 'ba', 'ky', 'tg', 'mn']],
    ['Arabic', /\p{Script=Arabic}/u, ['ar', 'fa', 'prs', 'ur', 'ps', 'ckb', 'ug', 'arz', 'apc', 'ary']],
    ['Hebrew', /\p{Script=Hebrew}/u, ['he', 'yi']],
    ['Kana', /[\p{Script=Hiragana}\p{Script=Katakana}]/u, ['ja']],
    ['Han', /\p{Script=Han}/u, ['zh', 'ja', 'yue']],
    ['Hangul', /\p{Script=Hangul}/u, ['ko']],
    ['Devanagari', /\p{Script=Devanagari}/u, ['hi', 'mr', 'ne', 'sa']],
    ['Bengali', /\p{Script=Bengali}/u, ['bn', 'as']],
    ['Thai', /\p{Script=Thai}/u, ['th']],
    ['Greek', /\p{Script=Greek}/u, ['el']],
    ['Georgian', /\p{Script=Georgian}/u, ['ka']],
    ['Armenian', /\p{Script=Armenian}/u, ['hy']],
    ['Tamil', /\p{Script=Tamil}/u, ['ta']],
    ['Ethiopic', /\p{Script=Ethiopic}/u, ['am', 'ti']],
    ['Gujarati', /\p{Script=Gujarati}/u, ['gu']],
    ['Gurmukhi', /\p{Script=Gurmukhi}/u, ['pa']],
    ['Telugu', /\p{Script=Telugu}/u, ['te']],
    ['Kannada', /\p{Script=Kannada}/u, ['kn']],
    ['Malayalam', /\p{Script=Malayalam}/u, ['ml']],
    ['Oriya', /\p{Script=Oriya}/u, ['or']],
    ['Sinhala', /\p{Script=Sinhala}/u, ['si']],
    ['Myanmar', /\p{Script=Myanmar}/u, ['my']],
    ['Khmer', /\p{Script=Khmer}/u, ['km']],
    ['Lao', /\p{Script=Lao}/u, ['lo']],
    ['Tibetan', /\p{Script=Tibetan}/u, ['bo']],
    ['Tifinagh', /\p{Script=Tifinagh}/u, ['zgh']],
    ['Cherokee', /\p{Script=Cherokee}/u, ['chr']],
    ['Syllabics', /\p{Script=Canadian_Aboriginal}/u, ['iu']],
    ['Latin', /\p{Script=Latin}/u, null],
  ];
  const LETTERS = [ // [language, letters that point to it]
    ['uk', /[іїєґ]/i], ['mk', /[ѓќѕ]/i], ['tg', /[ғӣқӯҳҷ]/i], ['tt', /[җ]/i], ['ba', /[ҡҙҫ]/i], ['ky', /[ң]/i],
    ['be', /ў/i], ['sr', /[ђћџјљњ]/i], ['kk', /[әғқңөұүһ]/i],
    ['ug', /[ېۋڭۈۆۇ]/], ['ur', /[ٹڈڑںے]/], ['ps', /[ځڅښږ]/], ['ckb', /[ڵڕۆێ]/], ['fa', /[پچژگ]/],
    ['ja', /[\p{Script=Hiragana}\p{Script=Katakana}]/u],
    ['nb', /[æø]/i], ['sv', /ä.*å|å.*ä|ö.*å|å.*ö/i], ['da', /[æø]/i], ['de', /[ßü]|[äö]/i], ['es', /[ñ¿¡]/i], ['pt', /[ãõ]/i],
    ['pl', /[ąęłśźżń]/i], ['cs', /[řěů]/i], ['sk', /[ľĺŕô]/i], ['tr', /[ğışİ]/], ['ro', /[ășțşţ]/i], ['hu', /[őű]/i],
    ['vi', /[ơưđạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i], ['is', /[þð]/i], ['lt', /[ėįųū]/i], ['lv', /[āēīņķļ]/i],
    ['et', /õ/i], ['se', /[đŋŧ]/i], ['mt', /[ħġż]/i], ['cy', /[ŵŷ]/i], ['ha', /[ɓɗƙ]/i], ['ee', /[ɖɛɔʋƒ]/i], ['fr', /[çœèêëàâîïûù]/i], ['it', /[àèìòù]/i], ['az', /ə/i], ['nb', /å/i],
  ];
  function scriptOf(text) {
    const counts = new Map();
    for (const ch of String(text || '')) {
      if (!/\p{L}/u.test(ch)) continue;
      const sc = SCRIPTS.find(([, re]) => re.test(ch));
      if (sc) counts.set(sc[0], (counts.get(sc[0]) || 0) + 1);
    }
    if (counts.has('Kana')) return 'Kana';
    return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] || '';
  }
  const scriptLangs = (sc) => SCRIPTS.find(([name]) => name === sc)?.[2] || list.filter((l) => !SCRIPTS.some(([, , codes]) => codes?.includes(l.code))).map((l) => l.code);
  // the script a language is written in
  const scriptOfLang = (code) => SCRIPTS.find(([, , codes]) => codes?.includes(code))?.[0] || 'Latin';
  // codes of languages named in a text such as "Russian-English_Word_List" or "Norsk – русский"
  function named(text) {
    const s = ' ' + String(text || '').toLowerCase().replace(/[^\p{L}]+/gu, ' ') + ' ';
    return list.filter((l) => [l.en.split(' (')[0], l.name, l.name.split(' ')[0]].some((n) => n && s.includes(' ' + n.toLowerCase() + ' '))).map((l) => l.code);
  }
  /* Whether a text the learner reads is in their language, as far as its letters tell. Asked about a word of their
     own language ("закономерность" for a Russian speaker learning Chinese), the AI sometimes writes a dictionary
     entry's note and origin in the language being learnt. Only languages written in different scripts can be told
     apart: a text with hardly any letters of the learner's script is not theirs, while one of theirs may quote words
     of the other. */
  function readable(text, native, target) {
    const want = scriptOfLang(native);
    if (!text || want === scriptOfLang(target)) return true;
    // Japanese is kana and kanji, but kanji alone are Chinese
    const kanji = want === 'Kana' && /[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(text);
    let all = 0, own = 0;
    for (const ch of String(text)) {
      if (!/\p{L}/u.test(ch)) continue;
      all++;
      const sc = scriptOf(ch);
      if (sc === want || (kanji && sc === 'Han')) own++;
    }
    return !all || own * 4 >= all;
  }
  // whether a text can be in a language at all, by its letters ("щека" cannot be Norwegian)
  function fits(text, code) {
    const sc = scriptOf(text);
    return !sc || code === 'sr' || scriptLangs(sc).includes(code);
  }
  function guess(texts, hints = []) {
    const text = [].concat(texts).join(' / ');
    const sc = scriptOf(text);
    if (!sc) return '';
    const can = scriptLangs(sc);
    if (can.length === 1) return can[0];
    const hinted = hints.find((c) => can.includes(c));
    const marked = LETTERS.filter(([c, re]) => can.includes(c) && re.test(text)).map(([c]) => c);
    if (hinted && (marked.includes(hinted) || !marked.length)) return hinted;
    if (marked.length) return marked[0];
    return { Latin: 'en', Cyrillic: 'ru', Arabic: 'ar', Han: 'zh' }[sc] || can[0];
  }

  return {
    scriptOf,
    scriptOfLang,
    readable,
    fits,
    named,
    guess,
    list,
    get,
    name: (c) => get(c).name,
    en: (c) => get(c).en,
    rtl: (c) => get(c).rtl,
    has: (c) => !!map[c],
    ARTICLE_GENDER,
    articleGender,
  };
})();
