import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { EyeOff, Sparkle, ShieldCheck } from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

const cards = [
  {
    title: "No Public List",
    body: "The allowlist is committed as a single Merkle root. Individual entries never appear on-chain — nothing to scrape, nothing to leak.",
    icon: EyeOff,
    tint: "oklch(0.72 0.24 350)",
    span: "md:col-span-2",
  },
  {
    title: "One-Time Mint",
    body: "A nullifier is recorded when you mint — not your address, not your entry. You can't double-mint, and no one can link mints back to you.",
    icon: Sparkle,
    tint: "oklch(0.85 0.18 200)",
    span: "",
  },
  {
    title: "Fully Verifiable",
    body: "Anyone can verify the proof and the Merkle root on-chain. Privacy without trust — the math shows the gate is honest.",
    icon: ShieldCheck,
    tint: "oklch(0.9 0.22 130)",
    span: "md:col-span-3",
  },
];

export function BentoFeatures() {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(".bento-card", {
        y: 60,
        opacity: 0,
        duration: 0.9,
        ease: "power3.out",
        stagger: 0.12,
        scrollTrigger: { trigger: rootRef.current, start: "top 75%" },
      });
    }, rootRef);
    return () => ctx.revert();
  }, []);

  return (
    <section className="relative px-4 py-20 md:py-28" ref={rootRef}>
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">
            A mint gate that <span className="text-gradient">forgets you</span> the moment it lets you through.
          </h2>
          <p className="mt-4 text-foreground/70">
            Three guarantees, baked into the circuit.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-3">
          {cards.map((c) => (
            <div
              key={c.title}
              className={`bento-card gradient-border relative overflow-hidden rounded-3xl bg-card p-6 md:p-8 ${c.span}`}
              style={{
                boxShadow: `0 30px 60px -30px color-mix(in oklab, ${c.tint} 40%, transparent)`,
              }}
            >
              <div
                aria-hidden
                className="absolute -right-16 -top-16 h-56 w-56 rounded-full opacity-70 blur-3xl"
                style={{ background: `radial-gradient(circle, ${c.tint}, transparent 70%)` }}
              />
              <div className="relative flex items-start gap-4">
                <div
                  className="grid h-11 w-11 place-items-center rounded-2xl bg-foreground text-white"
                  style={{ boxShadow: `0 10px 30px -10px ${c.tint}` }}
                >
                  <c.icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">{c.title}</h3>
                  <p className="mt-2 text-sm text-foreground/70">{c.body}</p>
                </div>
              </div>

              <MicroViz kind={c.title} tint={c.tint} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function MicroViz({ kind, tint }: { kind: string; tint: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    const ctx = gsap.context(() => {
      if (kind === "No Public List") {
        gsap.to(".chip", { opacity: 0.15, duration: 1.4, yoyo: true, repeat: -1, stagger: { each: 0.05, from: "random" }, ease: "sine.inOut" });
      } else if (kind === "One-Time Mint") {
        gsap.to(".stamp", { scale: 1.06, duration: 1.4, yoyo: true, repeat: -1, ease: "sine.inOut" });
      } else {
        gsap.to(".check-ring", { rotate: 360, duration: 8, repeat: -1, ease: "none" });
      }
    }, ref);
    return () => ctx.revert();
  }, [kind]);

  if (kind === "No Public List") {
    return (
      <div ref={ref} className="relative mt-6 grid grid-cols-8 gap-1.5">
        {Array.from({ length: 32 }).map((_, i) => (
          <div key={i} className="chip h-6 rounded-md" style={{ background: `color-mix(in oklab, ${tint} 30%, transparent)` }} />
        ))}
        <div className="absolute inset-0 grid place-items-center">
          <span className="rounded-full glass-card px-3 py-1 text-xs font-mono">root: 0x9f…c31a</span>
        </div>
      </div>
    );
  }
  if (kind === "One-Time Mint") {
    return (
      <div ref={ref} className="relative mt-6 grid place-items-center">
        <div className="stamp rounded-2xl border-2 border-dashed border-foreground/30 px-4 py-3 font-mono text-xs">
          nullifier used ✓
        </div>
      </div>
    );
  }
  return (
    <div ref={ref} className="relative mt-6 flex items-center gap-3">
      <div className="check-ring h-14 w-14 rounded-full" style={{ background: "var(--gradient-veil)", mask: "radial-gradient(circle, transparent 45%, black 46%)", WebkitMask: "radial-gradient(circle, transparent 45%, black 46%)" as string }} />
      <div className="flex-1">
        <div className="h-2 w-3/4 rounded-full bg-foreground/10" />
        <div className="mt-2 h-2 w-1/2 rounded-full bg-foreground/10" />
      </div>
    </div>
  );
}
