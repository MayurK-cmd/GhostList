import { GhostMark } from "./GhostMark";

const chains = ["Midnight", "Lace Wallet", "ZK-SNARK", "Merkle Root", "Nullifier", "Privacy-First", "Kachina"];

export function Marquee() {
  const items = [...chains, ...chains];
  return (
    <div className="relative overflow-hidden border-y border-foreground/10 bg-white/40 py-6 backdrop-blur">
      <div className="marquee flex w-max gap-14 whitespace-nowrap">
        {items.map((t, i) => (
          <div key={i} className="flex items-center gap-3 text-lg font-semibold text-foreground/60">
            <GhostMark className="h-6 w-6 opacity-70" />
            <span>{t}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
