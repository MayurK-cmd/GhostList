import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const steps = [
  {
    n: "01",
    title: "Allowlist committed as a hash",
    body: "The full allowlist is turned into a Merkle tree off-chain. Only the root is published — a single 32-byte fingerprint that reveals nothing about who's on it.",
  },
  {
    n: "02",
    title: "You prove membership privately",
    body: "Your wallet builds a ZK proof: 'I know a leaf in the tree with this root, and I haven't spent its nullifier.' The proof reveals no address, no index, no path.",
  },
  {
    n: "03",
    title: "Nullifier recorded, not identity",
    body: "The chain checks the proof and stores a nullifier so this entry can't mint again. Your address is never linked to your slot. Ghostlist forgets you.",
  },
];

export function HowItWorks() {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>(".how-step").forEach((el) => {
        gsap.from(el, {
          opacity: 0,
          y: 60,
          duration: 0.9,
          ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 80%" },
        });
      });

      gsap.to(".how-progress", {
        scaleY: 1,
        transformOrigin: "top",
        ease: "none",
        scrollTrigger: {
          trigger: ".how-track",
          start: "top 60%",
          end: "bottom 70%",
          scrub: true,
        },
      });
    }, ref);
    return () => ctx.revert();
  }, []);

  return (
    <section id="how" ref={ref} className="relative px-4 py-24 md:py-32">
      <div className="mx-auto max-w-4xl">
        <div className="text-center">
          <span className="rounded-full glass-card px-3 py-1 text-xs font-medium">How it works</span>
          <h2 className="mt-5 text-4xl font-bold tracking-tight sm:text-5xl">
            Three steps. <span className="text-gradient">Zero leaks.</span>
          </h2>
        </div>

        <div className="how-track relative mt-20 pl-8 md:pl-16">
          <div className="absolute left-3 top-2 bottom-2 w-px bg-foreground/10 md:left-6" />
          <div className="how-progress absolute left-3 top-2 bottom-2 w-px origin-top scale-y-0 bg-kinetic md:left-6" />

          <div className="space-y-14">
            {steps.map((s) => (
              <div key={s.n} className="how-step relative">
                <div className="absolute -left-8 top-1 grid h-6 w-6 place-items-center rounded-full bg-kinetic text-[10px] font-bold text-white md:-left-[3.75rem] md:h-9 md:w-9 md:text-xs">
                  {s.n}
                </div>
                <h3 className="text-2xl font-bold tracking-tight md:text-3xl">{s.title}</h3>
                <p className="mt-2 max-w-2xl text-foreground/70 md:text-lg">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
