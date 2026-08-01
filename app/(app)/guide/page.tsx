const CARDS = [
  { icon: "🗺️", title: "Pembelajaran Adaptif", desc: "Materi dan soal disesuaikan dengan level CEFR Anda secara otomatis." },
  { icon: "🎙️", title: "Voice Chat & Speech Scoring", desc: "Praktik berbicara langsung dengan AI dan latih akurasi pronunciation." },
  { icon: "📈", title: "Analisis Kelemahan Cerdas", desc: "AI memetakan topik yang sering Anda salah untuk latihan fokus." },
  { icon: "🃏", title: "Flashcard & Algoritma SM-2", desc: "Ulangi kartu dengan jadwal cerdas untuk hafalan jangka panjang." },
  { icon: "🏅", title: "Gamifikasi: Koin & Badges", desc: "Dapatkan koin setiap kali menyelesaikan kuis! Tukarkan koin di Toko untuk membeli Streak Freeze ❄️. Buka juga berbagai pencapaian (Badge) unik seiring berkembangnya kemampuan Anda." },
  { icon: "⚔️", title: "Mode Sosial & Beranda Feed", desc: "Tantang teman dan ikuti aktivitas belajar mereka." },
  { icon: "❤️", title: "Sistem Nyawa (Hearts)", desc: "Setiap jawaban salah mengurangi nyawa. Nyawa pulih otomatis tiap 4 jam." },
  { icon: "🐾", title: "Peliharaan Virtual (Pets)", desc: "Beli telur di Toko, rawat, dan saksikan peliharaan Anda tumbuh." },
  { icon: "📱", title: "PWA & Mode Offline", desc: "Akses aplikasi dari perangkat apa pun kapan saja." },
];

export default function GuidePage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl sm:text-3xl font-extrabold mb-6 text-center">Panduan Lengkap LingoMind 🚀</h1>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {CARDS.map((c) => (
          <div key={c.title} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm">
            <p className="text-2xl">{c.icon}</p>
            <p className="font-extrabold mt-2">{c.title}</p>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">{c.desc}</p>
          </div>
        ))}
      </div>
      <p className="text-center text-sm text-slate-400 mt-8">
        Teruslah berlatih, pertahankan Streak Anda, dan jadilah Master Bahasa! 🔥
      </p>
    </div>
  );
}
