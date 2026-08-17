import { createFileRoute } from "@tanstack/react-router";
import LoopstackLanding from "@/components/LoopstackLanding";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Loopstack — Apply for the Closed Beta" },
      { name: "description", content: "Loopstack: think, build, repeat. Apply now to join the closed beta of our real-time community platform." },
      { property: "og:title", content: "Loopstack — Apply for the Closed Beta" },
      { property: "og:description", content: "Think. Build. Repeat. Apply now to join the Loopstack closed beta." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LoopstackLanding,
});
