import { requireAdmin } from "@/lib/auth";
import AdminShell from "@/components/admin/AdminShell";

const TABS = [
  { key: "konfigurasi", label: "Konfigurasi", icon: "⚙️" },
  { key: "toko", label: "Toko", icon: "🏪" },
  { key: "bahasa", label: "Bahasa", icon: "🌐" },
  { key: "kurikulum", label: "Kurikulum", icon: "📚" },
  { key: "pengguna", label: "Pengguna", icon: "👥" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  if (!admin) return <>{children}</>;
  return <AdminShell tabs={TABS}>{children}</AdminShell>;
}
