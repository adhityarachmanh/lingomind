import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

const languages = [
  {
    "id": "English",
    "name": "English Course",
    "nativeName": "English",
    "flag": "🇬🇧",
    "description": "Uji grammar, vocabulary, idiom, dan speaking bahasa Inggris berbasis CEFR.",
    "themeClass": "hover:border-teal-500/50 border-slate-800 text-teal-400",
    "buttonClass": "bg-teal-500 hover:bg-teal-600 text-slate-950",
    "category": "Eropa",
    "ttsLangCode": "en-US",
    "edgeTtsVoice": "en-US-AriaNeural"
  },
  {
    "id": "Spanish",
    "name": "Curso de Espanol",
    "nativeName": "Espanol",
    "flag": "🇪🇸",
    "description": "Latihan percakapan, conjugacion, dan ekspresi sehari-hari bahasa Spanyol.",
    "themeClass": "hover:border-amber-500/50 border-slate-800 text-amber-400",
    "buttonClass": "bg-amber-500 hover:bg-amber-600 text-slate-950",
    "category": "Eropa",
    "ttsLangCode": "es-ES",
    "edgeTtsVoice": "es-ES-ElviraNeural"
  },
  {
    "id": "French",
    "name": "Cours de Francais",
    "nativeName": "Francais",
    "flag": "🇫🇷",
    "description": "Kuasai kosakata, tata bahasa, dan pronunciation bahasa Prancis untuk konteks nyata.",
    "themeClass": "hover:border-indigo-500/50 border-slate-800 text-indigo-400",
    "buttonClass": "bg-indigo-500 hover:bg-indigo-600 text-white",
    "category": "Eropa",
    "ttsLangCode": "fr-FR",
    "edgeTtsVoice": "fr-FR-DeniseNeural"
  },
  {
    "id": "German",
    "name": "Deutschkurs",
    "nativeName": "Deutsch",
    "flag": "🇩🇪",
    "description": "Pelajari artikel, struktur kalimat, dan konjugasi khas bahasa Jerman.",
    "themeClass": "hover:border-orange-500/50 border-slate-800 text-orange-400",
    "buttonClass": "bg-orange-400 hover:bg-orange-500 text-slate-950",
    "category": "Eropa",
    "ttsLangCode": "de-DE",
    "edgeTtsVoice": "de-DE-KatjaNeural"
  },
  {
    "id": "Italian",
    "name": "Corso di Italiano",
    "nativeName": "Italiano",
    "flag": "🇮🇹",
    "description": "Bangun kemampuan speaking dan listening bahasa Italia per travel dan daily chat.",
    "themeClass": "hover:border-emerald-500/50 border-slate-800 text-emerald-400",
    "buttonClass": "bg-emerald-500 hover:bg-emerald-600 text-slate-950",
    "category": "Eropa",
    "ttsLangCode": "it-IT",
    "edgeTtsVoice": "it-IT-ElsaNeural"
  },
  {
    "id": "Portuguese",
    "name": "Curso de Portugues",
    "nativeName": "Portugues",
    "flag": "🇧🇷",
    "description": "Latihan bahasa Portugis (Brasil) untuk percakapan natural dan ekspresi sehari-hari.",
    "themeClass": "hover:border-lime-500/50 border-slate-800 text-lime-400",
    "buttonClass": "bg-lime-500 hover:bg-lime-600 text-slate-950",
    "category": "Amerika",
    "ttsLangCode": "pt-BR",
    "edgeTtsVoice": "pt-BR-FranciscaNeural"
  },
  {
    "id": "Japanese",
    "name": "Nihongo Course",
    "nativeName": "日本語 (Nihongo)",
    "flag": "🇯🇵",
    "description": "Pelajari tata bahasa Jepang, ungkapan harian, dan pola kalimat untuk JLPT awal.",
    "themeClass": "hover:border-rose-500/50 border-slate-800 text-rose-400",
    "buttonClass": "bg-rose-500 hover:bg-rose-600 text-white",
    "category": "Asia",
    "ttsLangCode": "ja-JP",
    "edgeTtsVoice": "ja-JP-NanamiNeural"
  },
  {
    "id": "Korean",
    "name": "Hangugeo Course",
    "nativeName": "한국어 (Hangugeo)",
    "flag": "🇰🇷",
    "description": "Fokus pada pola kalimat Korea, partikel, dan speaking untuk situasi sehari-hari.",
    "themeClass": "hover:border-fuchsia-500/50 border-slate-800 text-fuchsia-400",
    "buttonClass": "bg-fuchsia-500 hover:bg-fuchsia-600 text-white",
    "category": "Asia",
    "ttsLangCode": "ko-KR",
    "edgeTtsVoice": "ko-KR-SunHiNeural"
  },
  {
    "id": "Mandarin",
    "name": "Putonghua Course",
    "nativeName": "普通话 (Putonghua)",
    "flag": "🇨🇳",
    "description": "Latihan Mandarin modern: pinyin, kosakata inti, dan struktur kalimat praktis.",
    "themeClass": "hover:border-red-500/50 border-slate-800 text-red-400",
    "buttonClass": "bg-red-500 hover:bg-red-600 text-white",
    "category": "Asia",
    "ttsLangCode": "zh-CN",
    "edgeTtsVoice": "zh-CN-XiaoxiaoNeural"
  },
  {
    "id": "Hindi",
    "name": "Hindi Course",
    "nativeName": "हिन्दी (Hindi)",
    "flag": "🇮🇳",
    "description": "Belajar Hindi dasar-menengah untuk percakapan, tata bahasa, dan pemahaman konteks.",
    "themeClass": "hover:border-yellow-500/50 border-slate-800 text-yellow-400",
    "buttonClass": "bg-yellow-500 hover:bg-yellow-600 text-slate-950",
    "category": "Asia",
    "ttsLangCode": "hi-IN",
    "edgeTtsVoice": "hi-IN-SwaraNeural"
  },
  {
    "id": "Arabic",
    "name": "Arabic Course",
    "nativeName": "العربية (Al Arabiyyah)",
    "flag": "🇸🇦",
    "description": "Bangun fondasi bahasa Arab modern untuk komunikasi umum dan profesional.",
    "themeClass": "hover:border-cyan-500/50 border-slate-800 text-cyan-400",
    "buttonClass": "bg-cyan-500 hover:bg-cyan-600 text-slate-950",
    "category": "Timur Tengah",
    "ttsLangCode": "ar-SA",
    "edgeTtsVoice": "ar-SA-HamedNeural"
  },
  {
    "id": "Turkish",
    "name": "Turkce Course",
    "nativeName": "Turkce",
    "flag": "🇹🇷",
    "description": "Pelajari struktur aglutinatif bahasa Turki dengan contoh percakapan realistis.",
    "themeClass": "hover:border-sky-500/50 border-slate-800 text-sky-400",
    "buttonClass": "bg-sky-500 hover:bg-sky-600 text-slate-950",
    "category": "Timur Tengah",
    "ttsLangCode": "tr-TR",
    "edgeTtsVoice": "tr-TR-AhmetNeural"
  },
  {
    "id": "Russian",
    "name": "Kurs Russkogo",
    "nativeName": "Русский (Russkiy)",
    "flag": "🇷🇺",
    "description": "Pelajari kasus tata bahasa, kosakata, dan percakapan bahasa Rusia.",
    "themeClass": "hover:border-blue-500/50 border-slate-800 text-blue-400",
    "buttonClass": "bg-blue-500 hover:bg-blue-600 text-white",
    "category": "Eropa",
    "ttsLangCode": "ru-RU",
    "edgeTtsVoice": "ru-RU-SvetlanaNeural"
  },
  {
    "id": "Dutch",
    "name": "Nederlandse Cursus",
    "nativeName": "Nederlands",
    "flag": "🇳🇱",
    "description": "Kuasai tata bahasa Belanda, pelafalan, dan kalimat percakapan sehari-hari.",
    "themeClass": "hover:border-cyan-500/50 border-slate-800 text-cyan-400",
    "buttonClass": "bg-cyan-500 hover:bg-cyan-600 text-slate-950",
    "category": "Eropa",
    "ttsLangCode": "nl-NL",
    "edgeTtsVoice": "nl-NL-ColetteNeural"
  },
  {
    "id": "Vietnamese",
    "name": "Khoa Hoc Tieng Viet",
    "nativeName": "Tiếng Việt",
    "flag": "🇻🇳",
    "description": "Latih nada bicara, tata bahasa, dan percakapan praktis bahasa Vietnam.",
    "themeClass": "hover:border-red-500/50 border-slate-800 text-red-400",
    "buttonClass": "bg-red-500 hover:bg-red-600 text-white",
    "category": "Asia",
    "ttsLangCode": "vi-VN",
    "edgeTtsVoice": "vi-VN-HoaiMyNeural"
  },
  {
    "id": "Thai",
    "name": "Laksoot Phasa Thai",
    "nativeName": "ไทย (Thai)",
    "flag": "🇹🇭",
    "description": "Pelajari aksara Thai, nada pengucapan, dan komunikasi harian yang sopan.",
    "themeClass": "hover:border-purple-500/50 border-slate-800 text-purple-400",
    "buttonClass": "bg-purple-500 hover:bg-purple-600 text-white",
    "category": "Asia",
    "ttsLangCode": "th-TH",
    "edgeTtsVoice": "th-TH-AcharaNeural"
  },
  {
    "id": "Swedish",
    "name": "Svensk Kurs",
    "nativeName": "Svenska",
    "flag": "🇸🇪",
    "description": "Pelajari melodi vokal bahasa Swedia, kosakata, dan struktur kalimat dasar.",
    "themeClass": "hover:border-yellow-500/50 border-slate-800 text-yellow-300",
    "buttonClass": "bg-yellow-400 hover:bg-yellow-500 text-slate-950",
    "category": "Eropa",
    "ttsLangCode": "sv-SE",
    "edgeTtsVoice": "sv-SE-SofieNeural"
  },
  {
    "id": "Polish",
    "name": "Kurs Jezyka Polskiego",
    "nativeName": "Polski",
    "flag": "🇵🇱",
    "description": "Tantang tata bahasa dan sistem deklinasi bahasa Polandia yang kaya.",
    "themeClass": "hover:border-rose-400/50 border-slate-800 text-rose-300",
    "buttonClass": "bg-rose-500 hover:bg-rose-600 text-white",
    "category": "Eropa",
    "ttsLangCode": "pl-PL",
    "edgeTtsVoice": "pl-PL-ZofiaNeural"
  },
  {
    "id": "Danish",
    "name": "Dansk Kursus",
    "nativeName": "Dansk",
    "flag": "🇩🇰",
    "description": "Pelajari tata bahasa dan ungkapan praktis bahasa Denmark.",
    "themeClass": "hover:border-red-400/50 border-slate-800 text-red-300",
    "buttonClass": "bg-red-500 hover:bg-red-600 text-white",
    "category": "Eropa",
    "ttsLangCode": "da-DK",
    "edgeTtsVoice": "da-DK-ChristelNeural"
  },
  {
    "id": "Finnish",
    "name": "Suomen Kurssi",
    "nativeName": "Suomi",
    "flag": "🇫🇮",
    "description": "Pelajari bahasa Finlandia dengan keunikan tata bahasanya.",
    "themeClass": "hover:border-blue-400/50 border-slate-800 text-blue-300",
    "buttonClass": "bg-blue-500 hover:bg-blue-600 text-white",
    "category": "Eropa",
    "ttsLangCode": "fi-FI",
    "edgeTtsVoice": "fi-FI-SelmaNeural"
  },
  {
    "id": "Norwegian",
    "name": "Norsk Kurs",
    "nativeName": "Norsk",
    "flag": "🇳🇴",
    "description": "Kuasai tata bahasa dan percakapan harian bahasa Norwegia.",
    "themeClass": "hover:border-red-500/50 border-slate-800 text-red-400",
    "buttonClass": "bg-red-500 hover:bg-red-600 text-white",
    "category": "Eropa",
    "ttsLangCode": "nb-NO",
    "edgeTtsVoice": "nb-NO-PernilleNeural"
  },
  {
    "id": "Greek",
    "name": "Mathimata Ellinikon",
    "nativeName": "Ελληνικά (Ellinika)",
    "flag": "🇬🇷",
    "description": "Pelajari alfabet Yunani dan percakapan dasar untuk liburan atau eksplorasi budaya.",
    "themeClass": "hover:border-blue-500/50 border-slate-800 text-blue-400",
    "buttonClass": "bg-blue-500 hover:bg-blue-600 text-white",
    "category": "Eropa",
    "ttsLangCode": "el-GR",
    "edgeTtsVoice": "el-GR-AthinaNeural"
  },
  {
    "id": "Ukrainian",
    "name": "Kurs Ukrayins'koyi",
    "nativeName": "Українська (Ukrainska)",
    "flag": "🇺🇦",
    "description": "Pelajari bahasa Ukraina, mulai dari alfabet Cyrillic hingga ungkapan harian.",
    "themeClass": "hover:border-yellow-500/50 border-slate-800 text-yellow-400",
    "buttonClass": "bg-yellow-500 hover:bg-yellow-600 text-slate-950",
    "category": "Eropa",
    "ttsLangCode": "uk-UA",
    "edgeTtsVoice": "uk-UA-OstapNeural"
  },
  {
    "id": "Czech",
    "name": "Kurz Cestiny",
    "nativeName": "Čeština",
    "flag": "🇨🇿",
    "description": "Kuasai dasar-dasar bahasa Ceko dan frasa untuk perjalanan di Eropa Tengah.",
    "themeClass": "hover:border-red-500/50 border-slate-800 text-red-400",
    "buttonClass": "bg-red-500 hover:bg-red-600 text-white",
    "category": "Eropa",
    "ttsLangCode": "cs-CZ",
    "edgeTtsVoice": "cs-CZ-VlastaNeural"
  },
  {
    "id": "Romanian",
    "name": "Curs de Romana",
    "nativeName": "Română",
    "flag": "🇷🇴",
    "description": "Pelajari bahasa Roman yang unik ini dengan kosakatanya yang menarik.",
    "themeClass": "hover:border-yellow-500/50 border-slate-800 text-yellow-400",
    "buttonClass": "bg-yellow-500 hover:bg-yellow-600 text-slate-950",
    "category": "Eropa",
    "ttsLangCode": "ro-RO",
    "edgeTtsVoice": "ro-RO-AlinaNeural"
  },
  {
    "id": "Hungarian",
    "name": "Magyar Kurzus",
    "nativeName": "Magyar",
    "flag": "🇭🇺",
    "description": "Tantang diri Anda dengan bahasa Hungaria yang memiliki struktur unik.",
    "themeClass": "hover:border-green-500/50 border-slate-800 text-green-400",
    "buttonClass": "bg-green-500 hover:bg-green-600 text-white",
    "category": "Eropa",
    "ttsLangCode": "hu-HU",
    "edgeTtsVoice": "hu-HU-NoemiNeural"
  },
  {
    "id": "Filipino",
    "name": "Kursong Filipino",
    "nativeName": "Filipino (Tagalog)",
    "flag": "🇵🇭",
    "description": "Pelajari bahasa Filipino untuk komunikasi harian dan ekspresi kasual.",
    "themeClass": "hover:border-blue-500/50 border-slate-800 text-blue-400",
    "buttonClass": "bg-blue-500 hover:bg-blue-600 text-white",
    "category": "Asia",
    "ttsLangCode": "fil-PH",
    "edgeTtsVoice": "fil-PH-AngeloNeural"
  },
  {
    "id": "Malay",
    "name": "Kursus Bahasa Melayu",
    "nativeName": "Bahasa Melayu",
    "flag": "🇲🇾",
    "description": "Pelajari bahasa Melayu untuk komunikasi serumpun yang mudah dan praktis.",
    "themeClass": "hover:border-yellow-500/50 border-slate-800 text-yellow-400",
    "buttonClass": "bg-yellow-500 hover:bg-yellow-600 text-slate-950",
    "category": "Asia",
    "ttsLangCode": "ms-MY",
    "edgeTtsVoice": "ms-MY-YasminNeural"
  }
];

const levels = [
  {
    "id": "A1",
    "title": "Beginner",
    "description": "Memahami dan menggunakan ekspresi sehari-hari yang sangat dasar.",
    "baseRewardPoints": 10,
    "orderIndex": 0
  },
  {
    "id": "A2",
    "title": "Elementary",
    "description": "Dapat berkomunikasi dalam tugas-tugas sederhana dan rutin.",
    "baseRewardPoints": 20,
    "orderIndex": 1
  },
  {
    "id": "B1",
    "title": "Intermediate",
    "description": "Dapat memahami poin utama dari input standar yang jelas.",
    "baseRewardPoints": 30,
    "orderIndex": 2
  },
  {
    "id": "B2",
    "title": "Upper Intermediate",
    "description": "Dapat memahami gagasan utama dari teks kompleks.",
    "baseRewardPoints": 40,
    "orderIndex": 3
  },
  {
    "id": "C1",
    "title": "Advanced",
    "description": "Dapat mengekspresikan ide dengan lancar dan spontan.",
    "baseRewardPoints": 50,
    "orderIndex": 4
  },
  {
    "id": "C2",
    "title": "Mastery",
    "description": "Dapat memahami hampir semua hal yang didengar atau dibaca dengan mudah.",
    "baseRewardPoints": 60,
    "orderIndex": 5
  }
];

const topics = [
  {
    "levelId": "A1",
    "title": "Greetings & Introductions",
    "orderIndex": 0
  },
  {
    "levelId": "A1",
    "title": "Basic Numbers & Time",
    "orderIndex": 1
  },
  {
    "levelId": "A1",
    "title": "Everyday Vocabulary",
    "orderIndex": 2
  },
  {
    "levelId": "A1",
    "title": "Simple Sentences",
    "orderIndex": 3
  },
  {
    "levelId": "A2",
    "title": "Daily Routines",
    "orderIndex": 0
  },
  {
    "levelId": "A2",
    "title": "Past Experiences",
    "orderIndex": 1
  },
  {
    "levelId": "A2",
    "title": "Making Plans",
    "orderIndex": 2
  },
  {
    "levelId": "A2",
    "title": "Giving Directions",
    "orderIndex": 3
  },
  {
    "levelId": "B1",
    "title": "Travel & Hobbies",
    "orderIndex": 0
  },
  {
    "levelId": "B1",
    "title": "Expressing Opinions",
    "orderIndex": 1
  },
  {
    "levelId": "B1",
    "title": "Modals & Conditionals",
    "orderIndex": 2
  },
  {
    "levelId": "B1",
    "title": "Understanding Short Texts",
    "orderIndex": 3
  },
  {
    "levelId": "B2",
    "title": "Complex Conversations",
    "orderIndex": 0
  },
  {
    "levelId": "B2",
    "title": "Advanced Grammar",
    "orderIndex": 1
  },
  {
    "levelId": "B2",
    "title": "Expressing Emotions",
    "orderIndex": 2
  },
  {
    "levelId": "B2",
    "title": "Debating & Persuasion",
    "orderIndex": 3
  },
  {
    "levelId": "C1",
    "title": "Nuances of Meaning",
    "orderIndex": 0
  },
  {
    "levelId": "C1",
    "title": "Idiomatic Expressions",
    "orderIndex": 1
  },
  {
    "levelId": "C1",
    "title": "Professional Discussions",
    "orderIndex": 2
  },
  {
    "levelId": "C1",
    "title": "Cultural Contexts",
    "orderIndex": 3
  },
  {
    "levelId": "C2",
    "title": "Abstract Concepts",
    "orderIndex": 0
  },
  {
    "levelId": "C2",
    "title": "Literature & Media",
    "orderIndex": 1
  },
  {
    "levelId": "C2",
    "title": "Complex Debates",
    "orderIndex": 2
  },
  {
    "levelId": "C2",
    "title": "Subtle Implication",
    "orderIndex": 3
  }
];

async function main() {
  const langResult = await db.language.createMany({
    data: languages,
    skipDuplicates: true,
  });
  console.log('languages seeded:', langResult.count);

  const levelResult = await db.level.createMany({
    data: levels,
    skipDuplicates: true,
  });
  console.log('levels seeded:', levelResult.count);

  const topicCount = await db.topic.count();
  if (topicCount !== topics.length) {
    await db.topic.deleteMany({});
    const topicResult = await db.topic.createMany({ data: topics });
    console.log('topics seeded:', topicResult.count);
  } else {
    console.log('topics already seeded:', topicCount);
  }

  const missionCount = await db.missionConfig.count();
  if (missionCount === 0) {
    await db.missionConfig.create({
      data: {
        name: 'Daily Standard',
        lessonTarget: 1,
        quizTarget: 1,
        weaknessTarget: 3,
        flashcardTargetMin: 5,
        flashcardTargetMax: 15,
      },
    });
    console.log('mission_config seeded: 1');
  } else {
    console.log('mission_config already seeded:', missionCount);
  }

  await db.appConfig.upsert({
    where: { key: 'quiz_completion_coins' },
    update: {},
    create: {
      key: 'quiz_completion_coins',
      value: '10',
      description: 'Koin yang didapat setelah menyelesaikan kuis',
    },
  });
  console.log('app_config quiz_completion_coins upserted');

  await db.user.upsert({
    where: { email: 'admin@lingomind.com' },
    update: {},
    create: {
      fullName: 'Admin LingoMind',
      email: 'admin@lingomind.com',
      passwordHash: '$2b$10$zlW71qZZbyjCUGGCSwEg.ubpNykB/7jMTZFyENN/q4AVEmT6klanq',
      role: 'admin',
      isVerified: true,
      preferredLanguage: 'English',
      score: 0,
    },
  });
  console.log('admin user upserted');

  const adminCount = await db.user.count({ where: { email: 'admin@lingomind.com' } });
  console.log('admin user count:', adminCount);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
