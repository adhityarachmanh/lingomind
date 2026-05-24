CREATE TABLE languages (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    native_name VARCHAR(255) NOT NULL,
    flag VARCHAR(20) NOT NULL,
    description TEXT NOT NULL,
    theme_class VARCHAR(255) NOT NULL,
    button_class VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    tts_lang_code VARCHAR(20) NOT NULL
);

CREATE TABLE levels (
    id VARCHAR(10) PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    base_reward_points INT NOT NULL,
    order_index INT NOT NULL
);

CREATE TABLE topics (
    id SERIAL PRIMARY KEY,
    level_id VARCHAR(10) NOT NULL REFERENCES levels(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    order_index INT NOT NULL
);

CREATE TABLE user_language_progress (
    email VARCHAR(255) NOT NULL REFERENCES users(email) ON DELETE CASCADE,
    language_id VARCHAR(50) NOT NULL REFERENCES languages(id) ON DELETE CASCADE,
    base_level VARCHAR(10) NOT NULL REFERENCES levels(id),
    topic_idx INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (email, language_id)
);

ALTER TABLE users DROP COLUMN IF EXISTS current_level;

INSERT INTO languages (id, name, native_name, flag, description, theme_class, button_class, category, tts_lang_code) VALUES
('English', 'English Course', 'English', '🇬🇧', 'Uji grammar, vocabulary, idiom, dan speaking bahasa Inggris berbasis CEFR.', 'hover:border-teal-500/50 border-slate-800 text-teal-400', 'bg-teal-500 hover:bg-teal-600 text-slate-950', 'Eropa', 'en-US'),
('Spanish', 'Curso de Espanol', 'Espanol', '🇪🇸', 'Latihan percakapan, conjugacion, dan ekspresi sehari-hari bahasa Spanyol.', 'hover:border-amber-500/50 border-slate-800 text-amber-400', 'bg-amber-500 hover:bg-amber-600 text-slate-950', 'Eropa', 'es-ES'),
('French', 'Cours de Francais', 'Francais', '🇫🇷', 'Kuasai kosakata, tata bahasa, dan pronunciation bahasa Prancis untuk konteks nyata.', 'hover:border-indigo-500/50 border-slate-800 text-indigo-400', 'bg-indigo-500 hover:bg-indigo-600 text-white', 'Eropa', 'fr-FR'),
('German', 'Deutschkurs', 'Deutsch', '🇩🇪', 'Pelajari artikel, struktur kalimat, dan konjugasi khas bahasa Jerman.', 'hover:border-orange-500/50 border-slate-800 text-orange-400', 'bg-orange-400 hover:bg-orange-500 text-slate-950', 'Eropa', 'de-DE'),
('Italian', 'Corso di Italiano', 'Italiano', '🇮🇹', 'Bangun kemampuan speaking dan listening bahasa Italia per travel dan daily chat.', 'hover:border-emerald-500/50 border-slate-800 text-emerald-400', 'bg-emerald-500 hover:bg-emerald-600 text-slate-950', 'Eropa', 'it-IT'),
('Portuguese', 'Curso de Portugues', 'Portugues', '🇧🇷', 'Latihan bahasa Portugis (Brasil) untuk percakapan natural dan ekspresi sehari-hari.', 'hover:border-lime-500/50 border-slate-800 text-lime-400', 'bg-lime-500 hover:bg-lime-600 text-slate-950', 'Amerika', 'pt-BR'),
('Japanese', 'Nihongo Course', '日本語 (Nihongo)', '🇯🇵', 'Pelajari tata bahasa Jepang, ungkapan harian, dan pola kalimat untuk JLPT awal.', 'hover:border-rose-500/50 border-slate-800 text-rose-400', 'bg-rose-500 hover:bg-rose-600 text-white', 'Asia', 'ja-JP'),
('Korean', 'Hangugeo Course', '한국어 (Hangugeo)', '🇰🇷', 'Fokus pada pola kalimat Korea, partikel, dan speaking untuk situasi sehari-hari.', 'hover:border-fuchsia-500/50 border-slate-800 text-fuchsia-400', 'bg-fuchsia-500 hover:bg-fuchsia-600 text-white', 'Asia', 'ko-KR'),
('Mandarin', 'Putonghua Course', '普通话 (Putonghua)', '🇨🇳', 'Latihan Mandarin modern: pinyin, kosakata inti, dan struktur kalimat praktis.', 'hover:border-red-500/50 border-slate-800 text-red-400', 'bg-red-500 hover:bg-red-600 text-white', 'Asia', 'zh-CN'),
('Hindi', 'Hindi Course', 'हिन्दी (Hindi)', '🇮🇳', 'Belajar Hindi dasar-menengah untuk percakapan, tata bahasa, dan pemahaman konteks.', 'hover:border-yellow-500/50 border-slate-800 text-yellow-400', 'bg-yellow-500 hover:bg-yellow-600 text-slate-950', 'Asia', 'hi-IN'),
('Arabic', 'Arabic Course', 'العربية (Al Arabiyyah)', '🇸🇦', 'Bangun fondasi bahasa Arab modern untuk komunikasi umum dan profesional.', 'hover:border-cyan-500/50 border-slate-800 text-cyan-400', 'bg-cyan-500 hover:bg-cyan-600 text-slate-950', 'Timur Tengah', 'ar-SA'),
('Turkish', 'Turkce Course', 'Turkce', '🇹🇷', 'Pelajari struktur aglutinatif bahasa Turki dengan contoh percakapan realistis.', 'hover:border-sky-500/50 border-slate-800 text-sky-400', 'bg-sky-500 hover:bg-sky-600 text-slate-950', 'Timur Tengah', 'tr-TR'),
('Russian', 'Kurs Russkogo', 'Русский (Russkiy)', '🇷🇺', 'Pelajari kasus tata bahasa, kosakata, dan percakapan bahasa Rusia.', 'hover:border-blue-500/50 border-slate-800 text-blue-400', 'bg-blue-500 hover:bg-blue-600 text-white', 'Eropa', 'ru-RU'),
('Dutch', 'Nederlandse Cursus', 'Nederlands', '🇳🇱', 'Kuasai tata bahasa Belanda, pelafalan, dan kalimat percakapan sehari-hari.', 'hover:border-cyan-500/50 border-slate-800 text-cyan-400', 'bg-cyan-500 hover:bg-cyan-600 text-slate-950', 'Eropa', 'nl-NL'),
('Vietnamese', 'Khoa Hoc Tieng Viet', 'Tiếng Việt', '🇻🇳', 'Latih nada bicara, tata bahasa, dan percakapan praktis bahasa Vietnam.', 'hover:border-red-500/50 border-slate-800 text-red-400', 'bg-red-500 hover:bg-red-600 text-white', 'Asia', 'vi-VN'),
('Thai', 'Laksoot Phasa Thai', 'ไทย (Thai)', '🇹🇭', 'Pelajari aksara Thai, nada pengucapan, dan komunikasi harian yang sopan.', 'hover:border-purple-500/50 border-slate-800 text-purple-400', 'bg-purple-500 hover:bg-purple-600 text-white', 'Asia', 'th-TH'),
('Swedish', 'Svensk Kurs', 'Svenska', '🇸🇪', 'Pelajari melodi vokal bahasa Swedia, kosakata, dan struktur kalimat dasar.', 'hover:border-yellow-500/50 border-slate-800 text-yellow-300', 'bg-yellow-400 hover:bg-yellow-500 text-slate-950', 'Eropa', 'sv-SE'),
('Polish', 'Kurs Jezyka Polskiego', 'Polski', '🇵🇱', 'Tantang tata bahasa dan sistem deklinasi bahasa Polandia yang kaya.', 'hover:border-rose-400/50 border-slate-800 text-rose-300', 'bg-rose-500 hover:bg-rose-600 text-white', 'Eropa', 'pl-PL'),
('Danish', 'Dansk Kursus', 'Dansk', '🇩🇰', 'Pelajari tata bahasa dan ungkapan praktis bahasa Denmark.', 'hover:border-red-400/50 border-slate-800 text-red-300', 'bg-red-500 hover:bg-red-600 text-white', 'Eropa', 'da-DK'),
('Finnish', 'Suomen Kurssi', 'Suomi', '🇫🇮', 'Pelajari bahasa Finlandia dengan keunikan tata bahasanya.', 'hover:border-blue-400/50 border-slate-800 text-blue-300', 'bg-blue-500 hover:bg-blue-600 text-white', 'Eropa', 'fi-FI'),
('Norwegian', 'Norsk Kurs', 'Norsk', '🇳🇴', 'Kuasai tata bahasa dan percakapan harian bahasa Norwegia.', 'hover:border-red-500/50 border-slate-800 text-red-400', 'bg-red-500 hover:bg-red-600 text-white', 'Eropa', 'nb-NO'),
('Greek', 'Mathimata Ellinikon', 'Ελληνικά (Ellinika)', '🇬🇷', 'Pelajari alfabet Yunani dan percakapan dasar untuk liburan atau eksplorasi budaya.', 'hover:border-blue-500/50 border-slate-800 text-blue-400', 'bg-blue-500 hover:bg-blue-600 text-white', 'Eropa', 'el-GR'),
('Ukrainian', 'Kurs Ukrayins''koyi', 'Українська (Ukrainska)', '🇺🇦', 'Pelajari bahasa Ukraina, mulai dari alfabet Cyrillic hingga ungkapan harian.', 'hover:border-yellow-500/50 border-slate-800 text-yellow-400', 'bg-yellow-500 hover:bg-yellow-600 text-slate-950', 'Eropa', 'uk-UA'),
('Czech', 'Kurz Cestiny', 'Čeština', '🇨🇿', 'Kuasai dasar-dasar bahasa Ceko dan frasa untuk perjalanan di Eropa Tengah.', 'hover:border-red-500/50 border-slate-800 text-red-400', 'bg-red-500 hover:bg-red-600 text-white', 'Eropa', 'cs-CZ'),
('Romanian', 'Curs de Romana', 'Română', '🇷🇴', 'Pelajari bahasa Roman yang unik ini dengan kosakatanya yang menarik.', 'hover:border-yellow-500/50 border-slate-800 text-yellow-400', 'bg-yellow-500 hover:bg-yellow-600 text-slate-950', 'Eropa', 'ro-RO'),
('Hungarian', 'Magyar Kurzus', 'Magyar', '🇭🇺', 'Tantang diri Anda dengan bahasa Hungaria yang memiliki struktur unik.', 'hover:border-green-500/50 border-slate-800 text-green-400', 'bg-green-500 hover:bg-green-600 text-white', 'Eropa', 'hu-HU'),
('Filipino', 'Kursong Filipino', 'Filipino (Tagalog)', '🇵🇭', 'Pelajari bahasa Filipino untuk komunikasi harian dan ekspresi kasual.', 'hover:border-blue-500/50 border-slate-800 text-blue-400', 'bg-blue-500 hover:bg-blue-600 text-white', 'Asia', 'fil-PH'),
('Malay', 'Kursus Bahasa Melayu', 'Bahasa Melayu', '🇲🇾', 'Pelajari bahasa Melayu untuk komunikasi serumpun yang mudah dan praktis.', 'hover:border-yellow-500/50 border-slate-800 text-yellow-400', 'bg-yellow-500 hover:bg-yellow-600 text-slate-950', 'Asia', 'ms-MY');

INSERT INTO levels (id, title, description, base_reward_points, order_index) VALUES
('A1', 'Beginner', 'Memahami dan menggunakan ekspresi sehari-hari yang sangat dasar.', 10, 0),
('A2', 'Elementary', 'Dapat berkomunikasi dalam tugas-tugas sederhana dan rutin.', 20, 1),
('B1', 'Intermediate', 'Dapat memahami poin utama dari input standar yang jelas.', 30, 2),
('B2', 'Upper Intermediate', 'Dapat memahami gagasan utama dari teks kompleks.', 40, 3),
('C1', 'Advanced', 'Dapat mengekspresikan ide dengan lancar dan spontan.', 50, 4),
('C2', 'Mastery', 'Dapat memahami hampir semua hal yang didengar atau dibaca dengan mudah.', 60, 5);

INSERT INTO topics (level_id, title, order_index) VALUES
('A1', 'Greetings & Introductions', 0),
('A1', 'Basic Numbers & Time', 1),
('A1', 'Everyday Vocabulary', 2),
('A1', 'Simple Sentences', 3),
('A2', 'Daily Routines', 0),
('A2', 'Past Experiences', 1),
('A2', 'Making Plans', 2),
('A2', 'Giving Directions', 3),
('B1', 'Travel & Hobbies', 0),
('B1', 'Expressing Opinions', 1),
('B1', 'Modals & Conditionals', 2),
('B1', 'Understanding Short Texts', 3),
('B2', 'Complex Conversations', 0),
('B2', 'Advanced Grammar', 1),
('B2', 'Expressing Emotions', 2),
('B2', 'Debating & Persuasion', 3),
('C1', 'Nuances of Meaning', 0),
('C1', 'Idiomatic Expressions', 1),
('C1', 'Professional Discussions', 2),
('C1', 'Cultural Contexts', 3),
('C2', 'Abstract Concepts', 0),
('C2', 'Literature & Media', 1),
('C2', 'Complex Debates', 2),
('C2', 'Subtle Implication', 3);

