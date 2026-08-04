import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getUserProfile } from "@/lib/profile";
import { getLanguages } from "@/lib/dashboard";
import DictationView from "@/components/DictationView";

export default async function DictationPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const [profile, languages] = await Promise.all([
    getUserProfile(session.email),
    getLanguages(),
  ]);
  if (!profile) redirect("/login");
  const langId = languages.some((l) => l.id === profile.preferred_language)
    ? profile.preferred_language
    : "English";
  const ttsLang = languages.find((l) => l.id === langId)?.tts_lang_code ?? "en-US";
  return <DictationView ttsLang={ttsLang} />;
}
