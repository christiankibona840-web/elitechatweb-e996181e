import { createFileRoute } from "@tanstack/react-router";
import Index from "@/pages/Index";

export const Route = createFileRoute("/app")({
  head: () => ({
    meta: [
      { title: "Loopstack Dashboard — Chat, Reels & Community" },
      { name: "description", content: "Your Loopstack workspace: real-time chats, reels, stories, events and in-app games." },
      { property: "og:title", content: "Loopstack Dashboard" },
      { property: "og:description", content: "Real-time chats, reels, stories, events and in-app games." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});
