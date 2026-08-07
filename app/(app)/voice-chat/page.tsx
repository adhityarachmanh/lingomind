import { Suspense } from "react";
import VoiceChatView from "@/components/VoiceChatView";
import { Skeleton } from "@/components/ui/skeleton";

export const maxDuration = 60;

export default function VoiceChatPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-md mx-auto px-4 py-8 space-y-3">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      }
    >
      <VoiceChatView />
    </Suspense>
  );
}
