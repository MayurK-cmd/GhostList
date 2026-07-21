import { useEffect, useRef, type SVGProps } from "react";
import { animate, createScope, type Scope } from "animejs";

type Props = SVGProps<SVGSVGElement> & { pulse?: boolean };

export function GhostMark({ pulse = false, ...props }: Props) {
  const ref = useRef<SVGSVGElement | null>(null);
  const scope = useRef<Scope | null>(null);

  useEffect(() => {
    if (!pulse || !ref.current) return;
    scope.current = createScope({ root: ref.current }).add(() => {
      animate(".eye", {
        scaleY: [1, 0.15, 1],
        duration: 1600,
        loop: true,
        ease: "inOutQuad",
        delay: (_t, i) => (i ?? 0) * 120,
      });
    });
    return () => scope.current?.revert();
  }, [pulse]);

  return (
    <svg
      ref={ref}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <defs>
        <linearGradient id="ghost-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="oklch(0.72 0.24 350)" />
          <stop offset="50%" stopColor="oklch(0.6 0.28 300)" />
          <stop offset="100%" stopColor="oklch(0.82 0.18 210)" />
        </linearGradient>
      </defs>
      <path
        d="M24 4c-8.28 0-15 6.72-15 15v22c0 1.7 1.98 2.63 3.28 1.54l3.22-2.7 3.28 2.75a2 2 0 0 0 2.56 0L24 39.9l2.66 2.7a2 2 0 0 0 2.56 0l3.28-2.75 3.22 2.7c1.3 1.09 3.28.16 3.28-1.54V19c0-8.28-6.72-15-15-15Z"
        fill="url(#ghost-g)"
      />
      <ellipse className="eye" cx="19" cy="22" rx="2.2" ry="3" fill="white" style={{ transformOrigin: "19px 22px" }} />
      <ellipse className="eye" cx="29" cy="22" rx="2.2" ry="3" fill="white" style={{ transformOrigin: "29px 22px" }} />
    </svg>
  );
}
