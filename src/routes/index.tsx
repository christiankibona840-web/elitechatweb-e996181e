import { createFileRoute } from "@tanstack/react-router";
import Index from "@/pages/Index";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Elite Chat" },
      { name: "description", content: "Real-time chat, reels, stories, and in-chat games." },
      { property: "og:title", content: "Elite Chat" },
      { property: "og:description", content: "Real-time chat, reels, stories, and in-chat games." },
    ],
  }),
  component: Index,
});
