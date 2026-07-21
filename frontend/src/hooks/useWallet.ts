// Real wallet hook backed by Lace (via WalletProvider).
// Preserves the same public interface so Navbar, mint.tsx, etc. work unchanged.
import { useMidnight, type WalletState } from "@/hooks/useMidnight";

export type { WalletState };

export function truncate(addr: string, n = 6) {
  return addr.length > n * 2 + 2 ? `${addr.slice(0, n)}…${addr.slice(-n)}` : addr;
}

/**
 * Thin wrapper around `useMidnight()` that exposes a `connect()` overload
 * matching the original hook signature.
 */
export function useWallet() {
  const ctx = useMidnight();

  return {
    address: ctx.address,
    connected: ctx.connected,
    connecting: ctx.connecting,
    error: ctx.error,
    connect: ctx.connect,          // (networkId?: string) => Promise<void>
    disconnect: ctx.disconnect,
  };
}
