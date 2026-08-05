export type ScenarioType = "language" | "general";

export interface ScenarioTemplate {
  id: string;
  category: string;
  title: string;
  description: string;
  type: ScenarioType;
}

export interface UsedScenarioTemplate {
  templateId: string | null;
  language: string;
}

export function isTemplateUsed(
  used: UsedScenarioTemplate[],
  templateId: string | null,
  language: string
): boolean {
  return used.some((u) => u.templateId === templateId && u.language === language);
}

export const SCENARIO_TEMPLATES: ScenarioTemplate[] = [
  { id: "daily-standup", category: "Pekerjaan & Bisnis", title: "Daily Standup Meeting", description: "Rapat standup harian tim tech", type: "language" },
  { id: "job-interview", category: "Pekerjaan & Bisnis", title: "Job Interview", description: "Wawancara kerja dengan HR", type: "language" },
  { id: "client-meeting", category: "Pekerjaan & Bisnis", title: "Client Meeting", description: "Meeting dengan klien membahas proyek", type: "language" },
  { id: "office-small-talk", category: "Pekerjaan & Bisnis", title: "Office Small Talk", description: "Obrolan ringan dengan rekan kantor", type: "language" },
  { id: "project-presentation", category: "Pekerjaan & Bisnis", title: "Project Presentation", description: "Presentasi proyek di depan tim", type: "language" },
  { id: "salary-negotiation", category: "Pekerjaan & Bisnis", title: "Salary Negotiation", description: "Negosiasi gaji dengan atasan", type: "language" },
  { id: "networking-event", category: "Pekerjaan & Bisnis", title: "Networking Event", description: "Berkenalan di acara networking", type: "language" },
  { id: "team-feedback", category: "Pekerjaan & Bisnis", title: "Team Feedback", description: "Memberi dan menerima umpan balik kerja", type: "language" },
  { id: "airport-immigration", category: "Perjalanan", title: "Airport Immigration", description: "Menjawab pertanyaan petugas imigrasi", type: "language" },
  { id: "hotel-checkin", category: "Perjalanan", title: "Hotel Check-in", description: "Check-in dan bertanya fasilitas hotel", type: "language" },
  { id: "lost-luggage", category: "Perjalanan", title: "Lost Luggage", description: "Melaporkan bagasi hilang", type: "language" },
  { id: "taxi-ride", category: "Perjalanan", title: "Taxi Ride", description: "Naik taksi dan memberi arahan", type: "language" },
  { id: "train-station", category: "Perjalanan", title: "Train Station", description: "Membeli tiket dan bertanya jadwal kereta", type: "language" },
  { id: "tourist-info", category: "Perjalanan", title: "Tourist Info", description: "Bertanya wisata di pusat informasi", type: "language" },
  { id: "flight-booking", category: "Perjalanan", title: "Flight Booking", description: "Memesan tiket pesawat", type: "language" },
  { id: "hotel-complaint", category: "Perjalanan", title: "Hotel Complaint", description: "Mengajukan keluhan ke layanan hotel", type: "language" },
  { id: "restaurant-order", category: "Makanan & Minuman", title: "Restaurant Ordering", description: "Memesan makanan di restoran", type: "language" },
  { id: "coffee-shop", category: "Makanan & Minuman", title: "Coffee Shop", description: "Memesan kopi dan camilan", type: "language" },
  { id: "street-food", category: "Makanan & Minuman", title: "Street Food", description: "Membeli makanan di kaki lima", type: "language" },
  { id: "fine-dining", category: "Makanan & Minuman", title: "Fine Dining", description: "Makan malam di restoran mewah", type: "language" },
  { id: "fast-food", category: "Makanan & Minuman", title: "Fast Food Counter", description: "Memesan di gerai makanan cepat saji", type: "language" },
  { id: "food-delivery", category: "Makanan & Minuman", title: "Food Delivery", description: "Memesan makanan antar", type: "language" },
  { id: "supermarket", category: "Belanja & Layanan", title: "Supermarket", description: "Berbelanja kebutuhan di supermarket", type: "language" },
  { id: "clothes-shopping", category: "Belanja & Layanan", title: "Clothes Shopping", description: "Mencoba dan membeli pakaian", type: "language" },
  { id: "electronics-store", category: "Belanja & Layanan", title: "Electronics Store", description: "Membeli barang elektronik", type: "language" },
  { id: "bank-visit", category: "Belanja & Layanan", title: "Bank Visit", description: "Transaksi di bank", type: "language" },
  { id: "post-office", category: "Belanja & Layanan", title: "Post Office", description: "Mengirim paket di kantor pos", type: "language" },
  { id: "barber-salon", category: "Belanja & Layanan", title: "Barber & Salon", description: "Potong rambut di barber atau salon", type: "language" },
  { id: "pharmacy", category: "Belanja & Layanan", title: "Pharmacy", description: "Membeli obat di apotek", type: "language" },
  { id: "hospital-visit", category: "Kesehatan", title: "Hospital Visit", description: "Menggambarkan gejala ke dokter", type: "language" },
  { id: "doctor-appointment", category: "Kesehatan", title: "Doctor Appointment", description: "Janji temu dan konsultasi dokter", type: "language" },
  { id: "dentist-visit", category: "Kesehatan", title: "Dentist Visit", description: "Periksa gigi ke dokter gigi", type: "language" },
  { id: "small-talk", category: "Sosial & Pertemanan", title: "Small Talk", description: "Obrolan santai dengan orang baru", type: "language" },
  { id: "party-conversation", category: "Sosial & Pertemanan", title: "Party Conversation", description: "Mengobrol di pesta", type: "language" },
  { id: "friends-hangout", category: "Sosial & Pertemanan", title: "Friends Hangout", description: "Nongkrong dengan teman", type: "language" },
  { id: "meeting-new-people", category: "Sosial & Pertemanan", title: "Meeting New People", description: "Perkenalan dengan orang baru", type: "language" },
  { id: "family-gathering", category: "Sosial & Pertemanan", title: "Family Gathering", description: "Berkumpul dengan keluarga besar", type: "language" },
  { id: "tech-support", category: "Teknologi", title: "Tech Support", description: "Menghubungi dukungan teknis", type: "language" },
  { id: "wifi-setup", category: "Teknologi", title: "Setting Up Wi-Fi", description: "Memasang dan mengatur Wi-Fi", type: "language" },
  { id: "gadget-shopping", category: "Teknologi", title: "Gadget Shopping", description: "Konsultasi membeli gadget baru", type: "language" },
  { id: "asking-directions", category: "Sehari-hari", title: "Asking Directions", description: "Bertanya arah di jalan", type: "language" },
  { id: "weekend-plans", category: "Sehari-hari", title: "Weekend Plans", description: "Membicarakan rencana akhir pekan", type: "language" },
  { id: "hobbies-talk", category: "Sehari-hari", title: "Hobbies Talk", description: "Membicarakan hobi dan minat", type: "language" },
  { id: "weather-talk", category: "Sehari-hari", title: "Weather Talk", description: "Membicarakan cuaca", type: "language" },
  { id: "time-schedule", category: "Sehari-hari", title: "Time & Schedules", description: "Mengatur jadwal dan waktu", type: "language" },
  { id: "math-tutor", category: "Umum", title: "Guru Matematika", description: "Diskusi rumus, cara cepat, dan latihan soal", type: "general" },
  { id: "physics-tutor", category: "Umum", title: "Guru Fisika", description: "Konsep fisika dan penyelesaian soal", type: "general" },
  { id: "chemistry-tutor", category: "Umum", title: "Guru Kimia", description: "Reaksi kimia dan perhitungan stoikiometri", type: "general" },
  { id: "writing-assistant", category: "Umum", title: "Asisten Menulis", description: "Membantu menyusun teks, email, atau laporan", type: "general" },
  { id: "daily-discussion", category: "Umum", title: "Diskusi Sehari-hari", description: "Ngobrol santai atau konsultasi keseharian", type: "general" },
  { id: "interview-prep", category: "Umum", title: "Persiapan Interview Kerja", description: "Latihan pertanyaan interview + umpan balik", type: "general" },
  { id: "study-coach", category: "Umum", title: "Coach Belajar", description: "Tips belajar efektif dan manajemen waktu", type: "general" },
];
