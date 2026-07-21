import { createContext, useContext, useCallback, useState, createElement, type ReactNode } from "react";
import type { ConnectedAPI, InitialAPI } from "@midnight-ntwrk/dapp-connector-api";

export type WalletState = {
  address: string | null;
  connected: boolean;
  connecting: boolean;
  error: string | null;
  walletApi: ConnectedAPI | null;
  networkId: string;
};

export type WalletContextValue = WalletState & {
  connect: (networkId?: string) => Promise<void>;
  disconnect: () => void;
};

const WalletContext = createContext<WalletContextValue | null>(null);

// ---------------------------------------------------------------------------
// v3 Lace wallet shape (the writeup uses enable() + state())
// ---------------------------------------------------------------------------
interface LaceV3WalletAPI {
  readonly name: string;
  readonly icon: string;
  readonly apiVersion?: string;
  isEnabled(): Promise<boolean>;
  enable(): Promise<LaceV3ConnectedAPI>;
}

interface LaceV3ConnectedAPI {
  state(): Promise<{ address: string; coinPublicKey: string }>;
  getUnshieldedAddress?(): Promise<{ unshieldedAddress: string }>;
}

// ---------------------------------------------------------------------------
// Type guard: v4 InitialAPI has a connect() method
// ---------------------------------------------------------------------------
function isV4API(w: unknown): w is InitialAPI {
  return !!w && typeof w === "object" && "connect" in w;
}

function isV3API(w: unknown): w is LaceV3WalletAPI {
  return !!w && typeof w === "object" && "enable" in w;
}

export function WalletProvider({
  children,
  defaultNetworkId = "preprod",
}: {
  children: ReactNode;
  defaultNetworkId?: string;
}) {
  const [state, setState] = useState<WalletState>({
    address: null,
    connected: false,
    connecting: false,
    error: null,
    walletApi: null,
    networkId: defaultNetworkId,
  });

  const connect = useCallback(
    async (networkId?: string) => {
      const netId = networkId ?? defaultNetworkId;
      setState((s) => ({ ...s, connecting: true, error: null }));

      try {
        if (typeof window === "undefined") {
          throw new Error("Cannot connect wallet during server-side rendering.");
        }

        const midnight = window.midnight;
        if (!midnight) {
          throw new Error(
            "Lace wallet not found. Please install the Lace Midnight extension and refresh the page.",
          );
        }

        // Discover the wallet API
        // 1) Try the well-known Lace key
        // 2) Scan all injected wallets — prefer the one called "Lace"
        // 3) Fall back to the first valid wallet
        let wallet: unknown = midnight.mnLace;

        if (!wallet) {
          const allWallets = Object.values(midnight).filter(
            (w): w is InitialAPI | LaceV3WalletAPI => isV4API(w) || isV3API(w),
          );

          const laceWallet = allWallets.find(
            (w) =>
              (w as InitialAPI).name?.toLowerCase().includes("lace") ||
              (w as InitialAPI).rdns?.toLowerCase().includes("lace"),
          );

          wallet = laceWallet ?? allWallets[0];
        }

        if (!wallet) {
          throw new Error(
            "No Midnight wallet found. Please install the Lace Midnight extension and refresh the page.",
          );
        }

        // ----- V3 path first — Lace exposes BOTH enable (v3) and connect (v4), but
        //      connect() doesn't trigger the auth popup. 1AM (pure v4) won't have
        //      isEnabled so it falls through to the v4 path below. -----
        if (isV3API(wallet)) {
          // enable() triggers the Lace popup AND returns the ConnectedAPI
          const connectedApi: LaceV3ConnectedAPI = await wallet.enable();

          // If user closed the popup, enable() throws or isEnabled still false
          const nowAuthd = await wallet.isEnabled();
          if (!nowAuthd) {
            throw new Error("Connection rejected by user.");
          }

          // Try v4-style address fetch first, fall back to v3 state()
          let addr: string;
          if (connectedApi.getUnshieldedAddress) {
            const r = await connectedApi.getUnshieldedAddress();
            addr = r.unshieldedAddress;
          } else {
            const walletState = await connectedApi.state();
            addr = walletState.address;
          }

          if (!addr) {
            throw new Error("Could not retrieve wallet address.");
          }

          setState({
            address: addr,
            connected: true,
            connecting: false,
            error: null,
            walletApi: connectedApi as unknown as ConnectedAPI,
            networkId: netId,
          });
          return;
        }

        // ----- V4 path (pure v4 wallets like 1AM that don't have enable/isEnabled) -----
        if (isV4API(wallet)) {
          const connectedApi: ConnectedAPI = await wallet.connect(netId);
          const { unshieldedAddress } = await connectedApi.getUnshieldedAddress();

          setState({
            address: unshieldedAddress,
            connected: true,
            connecting: false,
            error: null,
            walletApi: connectedApi,
            networkId: netId,
          });
          return;
        }

        throw new Error("Unrecognised wallet API version.");
      } catch (err: unknown) {
        const apiErr = err as { code?: string; message?: string; reason?: string };

        let message: string;
        if (apiErr?.code === "Rejected") {
          message = "Connection rejected by user.";
        } else if (apiErr?.code === "Disconnected") {
          message = "Wallet disconnected during connection attempt.";
        } else if (apiErr?.code === "InvalidRequest") {
          message = apiErr.reason ?? "Invalid network or request.";
        } else {
          message = apiErr?.message ?? "Failed to connect to Lace wallet.";
        }

        setState((s) => ({
          ...s,
          address: null,
          connected: false,
          connecting: false,
          error: message,
          walletApi: null,
        }));
      }
    },
    [defaultNetworkId],
  );

  const disconnect = useCallback(() => {
    setState({
      address: null,
      connected: false,
      connecting: false,
      error: null,
      walletApi: null,
      networkId: defaultNetworkId,
    });
  }, [defaultNetworkId]);

  return createElement(
    WalletContext.Provider,
    { value: { ...state, connect, disconnect } },
    children,
  );
}

export function useMidnight(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error("useMidnight must be used within a <WalletProvider>.");
  }
  return ctx;
}
