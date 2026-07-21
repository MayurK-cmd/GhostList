import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { useWallet, truncate } from "@/hooks/useWallet";
import { MagneticButton } from "./MagneticButton";
import { GhostMark } from "./GhostMark";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { LogOut, Wallet, AlertTriangle } from "lucide-react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

export function Navbar() {
  const wallet = useWallet();
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const prevError = useRef<string | null>(null);
  const wasConnected = useRef(wallet.connected);

  // Redirect to /mint when wallet connects (only once per connect)
  useEffect(() => {
    if (wallet.connected && !wasConnected.current && pathname !== "/mint") {
      router.navigate({ to: "/mint" });
    }
    wasConnected.current = wallet.connected;
  }, [wallet.connected, router, pathname]);

  useEffect(() => {
    if (wallet.error && wallet.error !== prevError.current) {
      prevError.current = wallet.error;
      toast.error("Connection failed", { description: wallet.error });
    }
    if (!wallet.error) {
      prevError.current = null;
    }
  }, [wallet.error]);

  return (
    <header className="sticky top-0 z-40 w-full">
      <div className="mx-auto mt-4 flex max-w-6xl items-center justify-between rounded-full glass-card px-4 py-2 md:px-6">
        <Link to="/" className="flex cursor-pointer items-center gap-2">
          <GhostMark className="h-8 w-8" />
          <span className="font-display text-lg font-bold tracking-tight">Ghostlist</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {[
            { to: "/mint", label: "Mint" },
            { to: "/#how", label: "How it Works" },
            { to: "/#docs", label: "Docs" },
          ].map((n) => (
            <a
              key={n.to}
              href={n.to}
              className="cursor-pointer rounded-full px-4 py-1.5 text-sm font-medium text-foreground/70 transition-colors hover:bg-foreground/5 hover:text-foreground"
            >
              {n.label}
            </a>
          ))}
        </nav>

        {wallet.connected && wallet.address ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-full glass-card px-3 py-1.5 text-sm font-medium">
                <span className="h-2 w-2 rounded-full bg-lime" />
                <Wallet className="h-4 w-4" />
                <span className="hidden sm:inline">{truncate(wallet.address, 5)}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-2xl">
              <div className="px-2 py-1.5 text-xs text-muted-foreground">Lace wallet</div>
              <div className="px-2 pb-1 font-mono text-xs">{truncate(wallet.address, 8)}</div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={wallet.disconnect} className="text-destructive">
                <LogOut className="mr-2 h-4 w-4" /> Disconnect
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <MagneticButton
            onClick={() => wallet.connect()}
            className="text-sm px-4 py-2"
            strength={12}
          >
            {wallet.connecting ? "Connecting…" : pathname === "/mint" ? "Connect Wallet" : "Connect"}
          </MagneticButton>
        )}
      </div>
    </header>
  );
}
