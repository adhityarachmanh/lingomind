import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import AdminConfigPanel from "@/components/admin/AdminConfigPanel";
import AdminContentPanel from "@/components/admin/AdminContentPanel";
import AdminCurriculumPanel from "@/components/admin/AdminCurriculumPanel";
import AdminLanguagePanel from "@/components/admin/AdminLanguagePanel";
import AdminShopPanel from "@/components/admin/AdminShopPanel";
import AdminUsersPanel from "@/components/admin/AdminUsersPanel";

export default async function AdminTabPage({ params }: { params: Promise<{ tab: string }> }) {
  const { tab } = await params;
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");

  switch (tab) {
    case "konfigurasi": return <AdminConfigPanel />;
    case "toko": return <AdminShopPanel />;
    case "bahasa": return <AdminLanguagePanel />;
    case "kurikulum": return <AdminCurriculumPanel />;
    case "pengguna": return <AdminUsersPanel adminEmail={admin.email} />;
    case "konten": return <AdminContentPanel />;
    default: return <p className="text-sm text-slate-400">Tab tidak ditemukan.</p>;
  }
}
