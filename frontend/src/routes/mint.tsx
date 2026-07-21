import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { toast } from "sonner";
import { AlertTriangle, ArrowRight, Loader2, RefreshCw, Sparkles, WalletMinimal } from "lucide-react";
import { Navbar } from "@/components/site/Navbar";
import { Footer } from "@/components/site/Footer";
import { GhostCard } from "@/components/site/GhostCard";
import { ProofPanel } from "@/components/site/ProofPanel";
import { MagneticButton } from "@/components/site/MagneticButton";
import { useWallet, truncate } from "@/hooks/useWallet";
import { useMint } from "@/hooks/useMint";

export const Route = createFileRoute("/mint")({
  head: () => ({
    meta: [
      { title: "Mint — Ghostlist" },
      { name: "description", content: "Prove your allowlist membership privately and mint." },
      { property: "og:title", content: "Mint — Ghostlist" },
      { property: "og:description", content: "A private, one-time mint gated by a zero-knowledge proof." },
    ],
  }),
  component: MintPage,
});

function MintPage() {
  const wallet = useWallet();
  const mint = useMint(wallet.address);
  const notified = useRef(false);

  useEffect(() => {
    if (mint.status === "success" && !notified.current) {
      notified.current = true;
      toast.success("Minted anonymously", {
        description: "Nullifier recorded. Your identity stays private.",
      });
    }
    if (mint.status === "error" && mint.error) {
      const map: Record<string, string> = {
        "not-connected": "Connect your Lace wallet to continue.",
        "not-on-allowlist": "This wallet isn't on the allowlist.",
        "already-minted": "This wallet has already minted a Ghost.",
        unknown: "Something went sideways while generating the proof.",
      };
      toast.error("Can't mint", { description: map[mint.error] });
    }
    if (mint.status === "proving" || mint.status === "minting") {
      notified.current = false;
    }
  }, [mint.status, mint.error]);

  const proving = mint.status === "proving" || mint.status === "minting";

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-10 md:py-16">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <Link to="/" className="text-xs text-foreground/50 hover:text-foreground">← Back to home</Link>
            <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
              <span className="text-gradient">Prove.</span> Then mint.
            </h1>
            <p className="mt-2 max-w-lg text-foreground/70">
              One wallet, one proof, one Ghost. Your identity never leaves your device.
            </p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-[1.05fr_1fr] md:gap-10">
          <div className="relative">
            <GhostCard status={mint.status} />
          </div>

          <div className="flex flex-col gap-6">
            {!wallet.connected ? (
              <NotConnected onConnect={wallet.connect} connecting={wallet.connecting} />
            ) : (
              <MintControls
                address={wallet.address!}
                proving={proving}
                status={mint.status}
                error={mint.error}
                alreadyMinted={mint.alreadyMinted}
                onProve={mint.proveAndMint}
                onReset={mint.reset}
              />
            )}
            <ProofPanel verified={mint.status === "success"} />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function NotConnected({ onConnect, connecting }: { onConnect: () => void; connecting: boolean }) {
  return (
    <div className="rounded-3xl glass-card p-6">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-2xl bg-foreground text-white">
          <WalletMinimal className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold">Connect your Lace wallet</h2>
          <p className="mt-1 text-sm text-foreground/70">
            Ghostlist uses your wallet locally to build the ZK proof. Nothing leaves your device until you approve.
          </p>
        </div>
      </div>
      <div className="mt-5">
        <MagneticButton onClick={onConnect}>
          {connecting ? (<><Loader2 className="h-4 w-4 animate-spin" /> Connecting…</>) : (<>Connect Lace <ArrowRight className="h-4 w-4" /></>)}
        </MagneticButton>
      </div>
    </div>
  );
}

function MintControls(props: {
  address: string;
  proving: boolean;
  status: string;
  error: string | null;
  alreadyMinted: boolean;
  onProve: () => void;
  onReset: () => void;
}) {
  const btnLabel = (() => {
    if (props.status === "proving") return "Generating proof…";
    if (props.status === "minting") return "Submitting to Midnight…";
    if (props.status === "success") return "Minted";
    return "Prove & Mint";
  })();

  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (props.status !== "success" || !ref.current) return;
    const ctx = gsap.context(() => {
      gsap.from(ref.current, { scale: 0.96, duration: 0.5, ease: "back.out(1.6)" });
    });
    return () => ctx.revert();
  }, [props.status]);

  return (
    <div ref={ref} className="rounded-3xl glass-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest text-foreground/50">Wallet</div>
          <div className="font-mono text-sm">{truncate(props.address, 6)}</div>
        </div>
        <span className="rounded-full bg-lime/50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider">Connected</span>
      </div>

      {props.error && (
        <ErrorNote error={props.error} onReset={props.onReset} />
      )}

      {!props.error && props.status !== "success" && (
        <>
          <div className="rounded-2xl bg-foreground/5 p-4 text-sm text-foreground/70">
            <div className="flex items-center gap-2 font-semibold text-foreground">
              <Sparkles className="h-4 w-4" /> What happens next
            </div>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>Your wallet builds a Merkle witness locally.</li>
              <li>The Compact circuit generates a proof of membership.</li>
              <li>The proof + a nullifier are submitted to Midnight.</li>
            </ol>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <MagneticButton onClick={props.onProve} disabled={props.proving || props.alreadyMinted}>
              {props.proving && <Loader2 className="h-4 w-4 animate-spin" />}
              {btnLabel}
            </MagneticButton>
          </div>
        </>
      )}

      {props.status === "success" && (
        <div className="rounded-2xl bg-lime/30 p-4 text-sm">
          <div className="font-semibold text-foreground">Verified — Minted</div>
          <p className="mt-1 text-foreground/70">
            Your Ghost is on Midnight and no one knows it was you. The chain only remembers
            a nullifier — a one-way tag that prevents double-minting.
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <MagneticButton variant="outline" onClick={props.onReset} strength={8}>
              <RefreshCw className="h-4 w-4" /> View another state
            </MagneticButton>
          </div>
        </div>
      )}
    </div>
  );
}

function ErrorNote({ error, onReset }: { error: string; onReset: () => void }) {
  const copy: Record<string, { title: string; body: string }> = {
    "not-connected": {
      title: "Wallet not connected",
      body: "Connect your Lace wallet to build a proof.",
    },
    "not-on-allowlist": {
      title: "Not on the allowlist",
      body: "This wallet's key doesn't map to any leaf in the current Merkle tree. If you think this is wrong, check with the drop's organizers — Ghostlist can't tell them who you are.",
    },
    "already-minted": {
      title: "Already minted",
      body: "The nullifier for this entry has been spent. That's the anti-double-mint guarantee doing its job.",
    },
    unknown: {
      title: "Proof failed",
      body: "The prover crashed before it produced a witness. Try again — your wallet stays put.",
    },
  };
  const c = copy[error] ?? copy.unknown;
  return (
    <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
        <div>
          <div className="font-semibold">{c.title}</div>
          <p className="mt-1 text-foreground/70">{c.body}</p>
        </div>
      </div>
      <div className="mt-3">
        <button
          onClick={onReset}
          className="text-xs font-semibold underline underline-offset-4 hover:text-primary"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
