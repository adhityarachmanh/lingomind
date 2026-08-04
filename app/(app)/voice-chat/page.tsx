import { redirect } from "next/navigation";
import VoiceChatView from "@/components/VoiceChatView";

export default function VoiceChatPage() {
  return <VoiceChatView language="English" ttsLang="en-US" />;
}
