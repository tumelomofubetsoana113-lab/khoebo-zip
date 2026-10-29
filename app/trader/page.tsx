import type { Metadata } from "next";
import { ChatShell } from "@/components/chat/ChatShell";

export const metadata: Metadata = {
  title: "Trader chat",
};

export default function TraderPage() {
  return <ChatShell />;
}
