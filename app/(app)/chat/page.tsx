import { Suspense } from "react";
import ChatView from "@/components/ChatView";
import ChatHomeView from "@/components/ChatHomeView";

export const maxDuration = 60;

export default async function ChatPage({ searchParams }: { searchParams: Promise<{ session?: string }> }) {
  const { session } = await searchParams;
  if (session) {
    return (
      <Suspense fallback={<div className="p-8 text-center text-sm text-muted-foreground">Memuat percakapan...</div>}>
        <ChatView />
      </Suspense>
    );
  }
  return <ChatHomeView />;
}
