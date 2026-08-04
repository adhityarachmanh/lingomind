import { getSession } from "@/lib/auth";
import ChatView from "@/components/ChatView";

export default async function ChatPage() {
  const session = await getSession();
  return <ChatView />;
}
