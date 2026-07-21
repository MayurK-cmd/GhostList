import { Link } from "@tanstack/react-router";
import { GhostMark } from "./GhostMark";

export function Footer() {
  return (
    <footer id="docs" className="relative mt-10 px-4 pb-10">
      <div className="mx-auto max-w-6xl rounded-3xl glass-card p-8 md:p-12">
        <div className="grid gap-10 md:grid-cols-3">
          <div>
            <div className="flex items-center gap-2">
              <GhostMark className="h-9 w-9" />
              <span className="font-display text-xl font-bold">Ghostlist</span>
            </div>
            <p className="mt-3 max-w-xs text-sm text-foreground/70">
              Private allowlist mint gate on the Midnight blockchain.
            </p>
          </div>
          <div>
            <div className="text-sm font-semibold">Product</div>
            <ul className="mt-3 space-y-2 text-sm text-foreground/70">
              <li><Link to="/mint" className="hover:text-foreground">Mint</Link></li>
              <li><a href="#how" className="hover:text-foreground">How it Works</a></li>
              <li><a href="#" className="hover:text-foreground">Docs</a></li>
            </ul>
          </div>
          <div>
            <div className="text-sm font-semibold">Built with</div>
            <ul className="mt-3 space-y-2 text-sm text-foreground/70">
              <li>Midnight Compact ZK</li>
              <li>Lace Wallet SDK</li>
              <li>Kachina protocol</li>
            </ul>
          </div>
        </div>
        <div className="mt-10 flex flex-col items-start justify-between gap-2 border-t border-foreground/10 pt-6 text-xs text-foreground/50 md:flex-row md:items-center">
          <div>© {new Date().getFullYear()} Ghostlist. Privacy is not a mode.</div>
          <div>Made for people who want to belong without being counted.</div>
        </div>
      </div>
    </footer>
  );
}
