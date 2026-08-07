import { Suspense } from "react";
import ChatView from "@/components/ChatView";
import ChatHomeView from "@/components/ChatHomeView";
import { Skeleton } from "@/components/ui/skeleton";

export const maxDuration = 60;

export default async function ChatPage({ searchParams }: { searchParams: Promise<{ session?: string }> }) {
  const { session } = await searchParams;
  if (session) {
    return (
      <Suspense
        fallback={
          <div className="max-w-2xl mx-auto px-4 py-6 space-y-3">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-16 w-2/3" />
            <Skeleton className="h-16 w-1/2" />
          </div>
        }
      >
        <ChatView />
      </Suspense>
    );
  }
  return <ChatHomeView />;
}
