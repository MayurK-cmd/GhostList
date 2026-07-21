import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/site/Navbar";
import { Hero } from "@/components/site/Hero";
import { BentoFeatures } from "@/components/site/BentoFeatures";
import { HowItWorks } from "@/components/site/HowItWorks";
import { Marquee } from "@/components/site/Marquee";
import { Footer } from "@/components/site/Footer";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ghostlist — Private allowlist mint on Midnight" },
      {
        name: "description",
        content:
          "A zero-knowledge mint gate. Prove you're on the allowlist without publishing it, without revealing which entry is yours.",
      },
      { property: "og:title", content: "Ghostlist — Private allowlist mint on Midnight" },
      {
        property: "og:description",
        content: "Prove you belong. Reveal nothing. A ZK mint gate on Midnight.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <Hero />
      <Marquee />
      <BentoFeatures />
      <HowItWorks />
      <Footer />
    </div>
  );
}
