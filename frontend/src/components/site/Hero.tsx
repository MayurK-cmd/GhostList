import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { Link } from "@tanstack/react-router";
import { MagneticButton } from "./MagneticButton";
import { ArrowRight, Sparkles } from "lucide-react";

export function Hero() {
  const rootRef = useRef<HTMLElement | null>(null);
  const blobsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(".hero-line span", {
        y: "110%",
        opacity: 0,
        rotateX: -40,
        duration: 1,
        ease: "expo.out",
        stagger: 0.05,
      });
      gsap.from(".hero-sub", { y: 30, opacity: 0, duration: 0.9, delay: 0.5, ease: "power3.out" });
      gsap.from(".hero-cta", { y: 20, opacity: 0, duration: 0.8, delay: 0.7, ease: "power3.out" });
      gsap.from(".hero-badge", { y: -20, opacity: 0, duration: 0.7, ease: "power3.out" });

      // Parallax blobs
      const onMove = (e: MouseEvent) => {
        if (!blobsRef.current) return;
        const x = (e.clientX / window.innerWidth - 0.5) * 30;
        const y = (e.clientY / window.innerHeight - 0.5) * 30;
        gsap.to(blobsRef.current.children, {
          x: (i: number) => x * (i + 1) * 0.6,
          y: (i: number) => y * (i + 1) * 0.6,
          duration: 1.2,
          ease: "power2.out",
        });
      };
      window.addEventListener("mousemove", onMove);
      return () => window.removeEventListener("mousemove", onMove);
    }, rootRef);
    return () => ctx.revert();
  }, []);

  const headline = ["Prove", "you", "belong.", "Reveal", "nothing."];

  return (
    <section ref={rootRef} className="relative overflow-hidden px-4 pt-10 pb-24 sm:pt-16 md:pb-32">
      <div
        ref={blobsRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
      >
        <div
          className="absolute left-[10%] top-[10%] h-72 w-72 rounded-full opacity-70 blur-3xl"
          style={{ background: "radial-gradient(circle, oklch(0.75 0.25 340), transparent 70%)", animation: "float-blob 8s ease-in-out infinite" }}
        />
        <div
          className="absolute right-[8%] top-[20%] h-96 w-96 rounded-full opacity-60 blur-3xl"
          style={{ background: "radial-gradient(circle, oklch(0.7 0.25 300), transparent 70%)", animation: "float-blob 11s ease-in-out infinite" }}
        />
        <div
          className="absolute left-[35%] bottom-[-10%] h-96 w-96 rounded-full opacity-60 blur-3xl"
          style={{ background: "radial-gradient(circle, oklch(0.85 0.18 200), transparent 70%)", animation: "float-blob 9s ease-in-out infinite" }}
        />
      </div>

      <div className="mx-auto max-w-6xl">
        <div className="hero-badge mx-auto mb-8 flex w-fit items-center gap-2 rounded-full glass-card px-4 py-1.5 text-xs font-medium">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span>Zero-knowledge mint gate on Midnight</span>
        </div>

        <h1 className="hero-line mx-auto max-w-5xl text-center text-5xl font-bold leading-[0.95] tracking-tight sm:text-7xl md:text-[7.5rem]">
          {headline.map((w, i) => (
            <span key={i} className="mr-3 inline-block overflow-hidden align-bottom md:mr-5">
              <span className={`inline-block ${i === 3 || i === 4 ? "text-gradient" : ""}`}>
                {w}
              </span>
            </span>
          ))}
        </h1>

        <p className="hero-sub mx-auto mt-8 max-w-2xl text-center text-lg text-foreground/70 sm:text-xl">
          A private allowlist mint. Prove membership with a zero-knowledge proof —
          the list never touches the chain, and no one learns which entry is yours.
        </p>

        <div className="hero-cta mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link to="/mint">
            <MagneticButton className="text-base">
              Enter the Ghostlist <ArrowRight className="h-4 w-4" />
            </MagneticButton>
          </Link>
          <a href="#how">
            <MagneticButton variant="outline" className="text-base" strength={10}>
              How it works
            </MagneticButton>
          </a>
        </div>
      </div>
    </section>
  );
}
