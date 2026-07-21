import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { animate, createScope, type Scope } from "animejs";
import { CheckCircle2 } from "lucide-react";
import { GhostMark } from "./GhostMark";
import type { MintStatus } from "@/hooks/useMint";

type Props = { status: MintStatus };

export function GhostCard({ status }: Props) {
  const root = useRef<HTMLDivElement | null>(null);
  const scope = useRef<Scope | null>(null);
  const proving = status === "proving" || status === "minting";
  const success = status === "success";

  // Particle field
  useEffect(() => {
    if (!root.current) return;
    scope.current?.revert();
    scope.current = createScope({ root: root.current }).add(() => {
      if (proving) {
        animate(".particle", {
          translateY: [
            { to: [0, -40], duration: 1400 },
          ],
          translateX: () => (Math.random() - 0.5) * 60,
          opacity: [0, 1, 0],
          scale: [0.6, 1.4, 0.6],
          duration: 1600,
          loop: true,
          delay: (_t, i) => (i ?? 0) * 90,
          ease: "outQuad",
        });
      }
    });
    return () => scope.current?.revert();
  }, [proving]);

  useEffect(() => {
    if (!success) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".ghost-body",
        { filter: "blur(24px) saturate(30%)", opacity: 0.6 },
        { filter: "blur(0px) saturate(160%)", opacity: 1, duration: 1.1, ease: "power3.out" },
      );
      gsap.from(".check-badge", { scale: 0, rotate: -20, duration: 0.7, ease: "back.out(1.6)", delay: 0.5 });
    }, root);
    return () => ctx.revert();
  }, [success]);

  return (
    <div
      ref={root}
      className="relative aspect-square w-full overflow-hidden rounded-3xl bg-card p-6 gradient-border"
      style={{ boxShadow: "var(--shadow-glow)" }}
    >
      {/* Backdrop */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{ background: "var(--gradient-veil)", opacity: 0.15 }}
      />

      {/* Ghost body */}
      <div
        className="ghost-body absolute inset-0 flex items-center justify-center transition-all duration-700"
        style={{
          filter: success ? "blur(0) saturate(160%)" : "blur(18px) saturate(40%)",
          opacity: success ? 1 : 0.55,
        }}
      >
        <GhostMark className="h-1/2 w-1/2" pulse={proving || success} />
      </div>

      {/* Scan line while proving */}
      {proving && <div className="scanline" aria-hidden />}

      {/* Particles */}
      {proving && (
        <div className="pointer-events-none absolute inset-0 flex items-end justify-center">
          {Array.from({ length: 16 }).map((_, i) => (
            <span
              key={i}
              className="particle absolute bottom-8 h-2 w-2 rounded-full"
              style={{
                left: `${10 + i * 5}%`,
                background: i % 2 ? "oklch(0.72 0.24 350)" : "oklch(0.82 0.18 210)",
                opacity: 0,
              }}
            />
          ))}
        </div>
      )}

      {/* Status label */}
      <div className="absolute inset-x-4 top-4 flex items-center justify-between">
        <span className="rounded-full glass-card px-3 py-1 text-xs font-mono">
          {success ? "Membership: Verified" : "Membership: Unverified"}
        </span>
        {success && (
          <span className="check-badge grid h-9 w-9 place-items-center rounded-full bg-lime text-foreground shadow-lg">
            <CheckCircle2 className="h-5 w-5" />
          </span>
        )}
      </div>

      {/* Bottom caption */}
      <div className="absolute inset-x-4 bottom-4 flex items-center justify-between">
        <div className="rounded-full glass-card px-3 py-1 text-xs font-mono">
          {status === "idle" && "Ghost #????"}
          {status === "proving" && "generating proof…"}
          {status === "minting" && "submitting to chain…"}
          {status === "success" && "Ghost #7429 — Minted"}
          {status === "error" && "Ghost #????"}
        </div>
        <div className="rounded-full glass-card px-3 py-1 text-xs font-mono opacity-60">
          Midnight
        </div>
      </div>
    </div>
  );
}
