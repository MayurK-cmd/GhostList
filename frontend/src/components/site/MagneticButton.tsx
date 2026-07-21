import { forwardRef, useEffect, useRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  strength?: number;
  variant?: "kinetic" | "outline" | "ghost";
};

export const MagneticButton = forwardRef<HTMLButtonElement, Props>(function MagneticButton(
  { className, children, strength = 22, variant = "kinetic", ...props },
  _ref,
) {
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const glowRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const el = btnRef.current;
    if (!el) return;
    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left - r.width / 2;
      const y = e.clientY - r.top - r.height / 2;
      el.style.transform = `translate(${(x / r.width) * strength}px, ${(y / r.height) * strength}px)`;
      if (glowRef.current) {
        glowRef.current.style.left = `${e.clientX - r.left}px`;
        glowRef.current.style.top = `${e.clientY - r.top}px`;
      }
    };
    const onLeave = () => {
      el.style.transform = "translate(0,0)";
    };
    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
    };
  }, [strength]);

  const base =
    "relative inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 font-semibold tracking-tight overflow-hidden transition-[transform,box-shadow] duration-200 ease-out will-change-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60 disabled:pointer-events-none";
  const variants = {
    kinetic:
      "text-white bg-kinetic shadow-[0_20px_50px_-15px_color-mix(in_oklab,var(--primary)_60%,transparent)] hover:shadow-[0_25px_70px_-15px_color-mix(in_oklab,var(--accent)_70%,transparent)]",
    outline:
      "text-foreground bg-white/60 backdrop-blur border border-foreground/15 hover:bg-white",
    ghost:
      "text-foreground hover:bg-foreground/5",
  } as const;

  return (
    <button
      ref={(node) => { btnRef.current = node; }}
      className={cn(base, variants[variant], className)}
      {...props}
    >
      <span className="relative z-10 flex items-center gap-2">{children}</span>
      <span
        ref={glowRef}
        aria-hidden
        className="pointer-events-none absolute h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/40 blur-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      />
    </button>
  );
});
