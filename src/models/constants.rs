// src/models/constants.rs

#[derive(Clone, PartialEq, Debug)]
pub struct LanguageCourse {
    pub id: &'static str,
    pub name: &'static str,
    pub native_name: &'static str,
    pub flag: &'static str,
    pub description: &'static str,
    pub theme_class: &'static str,
    pub button_class: &'static str,
    pub category: &'static str,
    pub tts_lang_code: &'static str,
}

pub const LANGUAGE_COURSES: &[LanguageCourse] = &[
    LanguageCourse { id: "English", name: "English Course", native_name: "English", flag: "\u{1F1EC}\u{1F1E7}", description: "Uji grammar, vocabulary, idiom, dan speaking bahasa Inggris berbasis CEFR.", theme_class: "hover:border-teal-500/50 border-slate-800 text-teal-400", button_class: "bg-teal-500 hover:bg-teal-600 text-slate-950", category: "Eropa", tts_lang_code: "en-US" },
    LanguageCourse { id: "Spanish", name: "Curso de Espanol", native_name: "Espanol", flag: "\u{1F1EA}\u{1F1F8}", description: "Latihan percakapan, conjugacion, dan ekspresi sehari-hari bahasa Spanyol.", theme_class: "hover:border-amber-500/50 border-slate-800 text-amber-400", button_class: "bg-amber-500 hover:bg-amber-600 text-slate-950", category: "Eropa", tts_lang_code: "es-ES" },
    LanguageCourse { id: "French", name: "Cours de Francais", native_name: "Francais", flag: "\u{1F1EB}\u{1F1F7}", description: "Kuasai kosakata, tata bahasa, dan pronunciation bahasa Prancis untuk konteks nyata.", theme_class: "hover:border-indigo-500/50 border-slate-800 text-indigo-400", button_class: "bg-indigo-500 hover:bg-indigo-600 text-white", category: "Eropa", tts_lang_code: "fr-FR" },
    LanguageCourse { id: "German", name: "Deutschkurs", native_name: "Deutsch", flag: "\u{1F1E9}\u{1F1EA}", description: "Pelajari artikel, struktur kalimat, dan konjugasi khas bahasa Jerman.", theme_class: "hover:border-orange-500/50 border-slate-800 text-orange-400", button_class: "bg-orange-400 hover:bg-orange-500 text-slate-950", category: "Eropa", tts_lang_code: "de-DE" },
    LanguageCourse { id: "Italian", name: "Corso di Italiano", native_name: "Italiano", flag: "\u{1F1EE}\u{1F1F9}", description: "Bangun kemampuan speaking dan listening bahasa Italia untuk travel dan daily chat.", theme_class: "hover:border-emerald-500/50 border-slate-800 text-emerald-400", button_class: "bg-emerald-500 hover:bg-emerald-600 text-slate-950", category: "Eropa", tts_lang_code: "it-IT" },
    LanguageCourse { id: "Portuguese", name: "Curso de Portugues", native_name: "Portugues", flag: "\u{1F1E7}\u{1F1F7}", description: "Latihan bahasa Portugis (Brasil) untuk percakapan natural dan ekspresi sehari-hari.", theme_class: "hover:border-lime-500/50 border-slate-800 text-lime-400", button_class: "bg-lime-500 hover:bg-lime-600 text-slate-950", category: "Amerika", tts_lang_code: "pt-BR" },
    LanguageCourse { id: "Japanese", name: "Nihongo Course", native_name: "日本語 (Nihongo)", flag: "\u{1F1EF}\u{1F1F5}", description: "Pelajari tata bahasa Jepang, ungkapan harian, dan pola kalimat untuk JLPT awal.", theme_class: "hover:border-rose-500/50 border-slate-800 text-rose-400", button_class: "bg-rose-500 hover:bg-rose-600 text-white", category: "Asia", tts_lang_code: "ja-JP" },
    LanguageCourse { id: "Korean", name: "Hangugeo Course", native_name: "한국어 (Hangugeo)", flag: "\u{1F1F0}\u{1F1F7}", description: "Fokus pada pola kalimat Korea, partikel, dan speaking untuk situasi sehari-hari.", theme_class: "hover:border-fuchsia-500/50 border-slate-800 text-fuchsia-400", button_class: "bg-fuchsia-500 hover:bg-fuchsia-600 text-white", category: "Asia", tts_lang_code: "ko-KR" },
    LanguageCourse { id: "Mandarin", name: "Putonghua Course", native_name: "普通话 (Putonghua)", flag: "\u{1F1E8}\u{1F1F3}", description: "Latihan Mandarin modern: pinyin, kosakata inti, dan struktur kalimat praktis.", theme_class: "hover:border-red-500/50 border-slate-800 text-red-400", button_class: "bg-red-500 hover:bg-red-600 text-white", category: "Asia", tts_lang_code: "zh-CN" },
    LanguageCourse { id: "Hindi", name: "Hindi Course", native_name: "हिन्दी (Hindi)", flag: "\u{1F1EE}\u{1F1F3}", description: "Belajar Hindi dasar-menengah untuk percakapan, tata bahasa, dan pemahaman konteks.", theme_class: "hover:border-yellow-500/50 border-slate-800 text-yellow-400", button_class: "bg-yellow-500 hover:bg-yellow-600 text-slate-950", category: "Asia", tts_lang_code: "hi-IN" },
    LanguageCourse { id: "Arabic", name: "Arabic Course", native_name: "العربية (Al Arabiyyah)", flag: "\u{1F1F8}\u{1F1E6}", description: "Bangun fondasi bahasa Arab modern untuk komunikasi umum dan profesional.", theme_class: "hover:border-cyan-500/50 border-slate-800 text-cyan-400", button_class: "bg-cyan-500 hover:bg-cyan-600 text-slate-950", category: "Timur Tengah", tts_lang_code: "ar-SA" },
    LanguageCourse { id: "Turkish", name: "Turkce Course", native_name: "Turkce", flag: "\u{1F1F9}\u{1F1F7}", description: "Pelajari struktur aglutinatif bahasa Turki dengan contoh percakapan realistis.", theme_class: "hover:border-sky-500/50 border-slate-800 text-sky-400", button_class: "bg-sky-500 hover:bg-sky-600 text-slate-950", category: "Timur Tengah", tts_lang_code: "tr-TR" },
];

pub const COURSE_CATEGORIES: &[&str] = &["All", "Eropa", "Amerika", "Asia", "Timur Tengah"];
