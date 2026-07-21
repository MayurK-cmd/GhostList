import { Check, X } from "lucide-react";

const rows = [
  { ok: true, text: "You are on the allowlist" },
  { ok: true, text: "You have not minted before" },
  { ok: false, text: "Your identity was never revealed" },
  { ok: false, text: "The allowlist was never published" },
];

export function ProofPanel({ verified }: { verified: boolean }) {
  return (
    <div className="rounded-3xl glass-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-bold">What was proven</h3>
        <span
          className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
            verified ? "bg-lime/40 text-foreground" : "bg-foreground/10 text-foreground/60"
          }`}
        >
          {verified ? "Circuit output" : "Pending"}
        </span>
      </div>
      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.text} className="flex items-start gap-3 text-sm">
            <span
              className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full ${
                r.ok
                  ? "bg-lime text-foreground"
                  : "bg-foreground text-background"
              } ${verified ? "" : "opacity-40"}`}
            >
              {r.ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
            </span>
            <span className={verified ? "text-foreground" : "text-foreground/50"}>{r.text}</span>
          </li>
        ))}
      </ul>
      {verified && (
        <p className="mt-4 text-center text-sm font-semibold text-lime">
          Proved without revealing your identity.
        </p>
      )}
      <p className="mt-3 text-xs text-foreground/50">
        The two checks are asserted by the circuit; the two crosses describe information
        that never left your wallet.
      </p>
    </div>
  );
}
