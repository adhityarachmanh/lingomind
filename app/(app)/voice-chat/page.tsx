import { Suspense } from "react";
import VoiceChatView from "@/components/VoiceChatView";

export default function VoiceChatPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-muted-foreground">Memuat...</div>}>
      <VoiceChatView />
    </Suspense>
  );
}
