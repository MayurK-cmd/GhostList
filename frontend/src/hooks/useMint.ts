/**
 * Mint hook — on-chain contract call via Lace wallet + proof server.
 *
 * Architecture:
 *  1. User connects Lace wallet (Preview network)
 *  2. Load precomputed Merkle tree data with N entries from /tree.json
 *  3. Pick the first non-spent entry (tracked via localStorage index pointer)
 *  4. Call the `mint` circuit with real witnesses for that entry
 *  5. Proof server generates ZK proof
 *  6. Wallet balances + submits the transaction
 *  7. On "Already minted", advance to the next entry and retry
 *
 * Falls back to a demo mock flow when the real stack is unavailable
 * (proof server offline, indexer unreachable, etc.).
 */
import { useCallback, useState } from "react";
import { useMidnight } from "@/hooks/useMidnight";
import type { ConnectedAPI } from "@midnight-ntwrk/dapp-connector-api";

export type MintStatus = "idle" | "proving" | "minting" | "success" | "error";

export type MintError =
  | "not-connected"
  | "not-on-allowlist"
  | "already-minted"
  | "proof-server-offline"
  | "contract-not-found"
  | "tree-not-loaded"
  | "all-entries-spent"
  | "mint-failed"
  | "unknown";

export type MintResult = {
  nullifier: string;
  txHash: string;
};

// --------------------------------------------------------------------------
// Types for the multi-entry Merkle tree data
// --------------------------------------------------------------------------

interface MerklePathEntry {
  sibling: string;
  goes_left: boolean;
}

interface TreeEntry {
  secret: string;
  leaf: string;
  path: MerklePathEntry[];
}

interface TreeData {
  root: string;
  count: number;
  entries: TreeEntry[];
}

const NEXT_ENTRY_KEY = "ghostlist:nextEntry";
const CONTRACT_ADDRESS =
  "953eae12528f06fcda523264f0e426501f91fa9245e76dee8a6fe66f885b1632";

// --------------------------------------------------------------------------
// Lazy-load the multi-entry Merkle tree data
// --------------------------------------------------------------------------

let _treeData: TreeData | null = null;
let _treeLoading: Promise<TreeData | null> | null = null;

async function loadTreeData(): Promise<TreeData | null> {
  if (_treeData) return _treeData;
  if (_treeLoading) return _treeLoading;
  _treeLoading = (async () => {
    try {
      const res = await fetch("/tree.json");
      if (!res.ok) return null;
      _treeData = (await res.json()) as TreeData;
      return _treeData;
    } catch {
      return null;
    }
  })();
  return _treeLoading;
}

/**
 * Return the next unspent entry index from localStorage, defaulting to 0.
 */
function getNextEntryIndex(): number {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(NEXT_ENTRY_KEY);
  if (raw === null) return 0;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Advance the entry pointer so the next mint tries a different leaf.
 */
function advanceEntry(count: number): void {
  if (typeof window === "undefined") return;
  const next = Math.min(getNextEntryIndex() + 1, count - 1);
  window.localStorage.setItem(NEXT_ENTRY_KEY, String(next));
}

// --------------------------------------------------------------------------
// Hook
// --------------------------------------------------------------------------

export function useMint(_address: string | null) {
  const { walletApi } = useMidnight();
  const [status, setStatus] = useState<MintStatus>("idle");
  const [error, setError] = useState<MintError | null>(null);
  const [result, setResult] = useState<MintResult | null>(null);

  const proveAndMint = useCallback(async () => {
    setError(null);
    setResult(null);

    if (!_address) {
      setError("not-connected");
      setStatus("error");
      return;
    }

    const api = walletApi as ConnectedAPI | null;
    if (!api) {
      setError("not-connected");
      setStatus("error");
      return;
    }

    // ── Phase 1: Load tree data ──
    const tree = await loadTreeData();
    if (!tree || !tree.entries || tree.entries.length === 0) {
      setError("tree-not-loaded");
      setStatus("error");
      return;
    }

    // ── Phase 2: Determine which entry to try ──
    const startIndex = getNextEntryIndex();
    let lastError: string | null = null;

    for (let attempt = 0; attempt < tree.entries.length; attempt++) {
      const entryIndex = (startIndex + attempt) % tree.entries.length;
      const entry = tree.entries[entryIndex];

      setStatus("proving");
      setError(null);

      try {
        const config = await api.getConfiguration();
        const proofServerUrl = config.proverServerUri ?? "http://localhost:6300";

        // Check proof server
        try {
          const healthRes = await fetch(`${proofServerUrl}/health`, {
            signal: AbortSignal.timeout(5000),
          });
          if (!healthRes.ok) throw new Error("health check failed");
        } catch {
          throw new Error("proof-server-offline");
        }

        // ── Phase 3: Dynamic imports (SSR-safe) ──
        const [
          { CompiledContract },
          { findDeployedContract },
          { setNetworkId },
          { createGhostlistProviders },
        ] = await Promise.all([
          import("@midnight-ntwrk/midnight-js-protocol/compact-js"),
          import("@midnight-ntwrk/midnight-js-contracts"),
          import("@midnight-ntwrk/midnight-js-network-id"),
          import("@/lib/contract/createProviders"),
        ]);

        setNetworkId(config.networkId as any);

        // ── Phase 4: Providers ──
        const ghostlist = await createGhostlistProviders(
          api,
          CONTRACT_ADDRESS as any,
        );

        // ── Phase 5: Load contract + build witnesses for this entry ──
        const { Contract } = await import("@/lib/contract/index.js");

        const secretBytes = new Uint8Array(
          entry.secret.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)),
        );
        const leafBytes = new Uint8Array(
          entry.leaf.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)),
        );

        const witnesses = {
          secret: (ctx: any): [any, Uint8Array] => {
            return [ctx.privateState, secretBytes];
          },
          merklePath: (ctx: any): [any, any] => {
            const merklePath = entry.path.map((pe) => ({
              sibling: { field: BigInt(pe.sibling) },
              goes_left: pe.goes_left,
            }));
            return [ctx.privateState, { leaf: leafBytes, path: merklePath }];
          },
        };

        const compiledContract = CompiledContract.make(
          "allowlist_stub",
          Contract,
        ).pipe(CompiledContract.withWitnesses(witnesses));

        // ── Phase 6: Find on-chain contract ──
        const deployed = await findDeployedContract(ghostlist.providers as any, {
          compiledContract: compiledContract as any,
          contractAddress: CONTRACT_ADDRESS as any,
          privateStateId: "ghostlist-private",
          initialPrivateState: {},
        });

        // ── Phase 7: Call mint circuit ──
        setStatus("minting");
        const callResult = await deployed.callTx.mint();
        const txId = callResult.public.txId;

        // Mark the NEXT entry for subsequent mints
        advanceEntry(tree.entries.length);
        setResult({ nullifier: entry.leaf, txHash: txId });
        setStatus("success");
        return;
      } catch (err: any) {
        const msg = err?.message ?? "";

        // If proof server is offline, bail immediately (no point retrying)
        if (msg === "proof-server-offline") {
          console.warn("proof-server-offline — falling back to demo mock flow");
          break;
        }

        // If this specific nullifier was already used, try the next entry
        if (
          msg.includes("already-minted") ||
          msg.includes("Already minted") ||
          msg.includes("nullifier already used")
        ) {
          lastError = "already-minted";
          console.warn(`Entry ${entryIndex} already spent, trying next...`);
          advanceEntry(tree.entries.length);
          continue;
        }

        // Other errors — surfaces up
        if (
          msg.includes("Not on allowlist") ||
          msg.includes("Merkle")
        ) {
          setError("not-on-allowlist");
          setStatus("error");
          return;
        }

        console.error("Real mint error:", err);
        // Surface the actual error message — dig into cause chain
        const fullMsg = [err?.message, err?.cause?.message, err?.cause?.toString()]
          .filter(Boolean)
          .join(" → ");
        if (typeof window !== "undefined") {
          (window as any).__mintError = fullMsg || msg;
        }
        setStatus("error");
        // If proof server responded but the call failed, it's a contract/network error
        if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
          setError("proof-server-offline");
        } else {
          setError("mint-failed");
        }
        return;
      }
    }

    // All entries tried, none worked
    if (lastError === "already-minted") {
      setError("all-entries-spent");
      setStatus("error");
      return;
    }

    // ── Fallback: demo mock flow ──
    try {
      setStatus("proving");
      const userSecret = crypto.getRandomValues(new Uint8Array(32));
      const hashOfSecret = new Uint8Array(
        await crypto.subtle.digest("SHA-256", userSecret),
      );
      const nullifier =
        "0x" +
        Array.from(hashOfSecret)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");

      setStatus("minting");
      const txHashBytes = crypto.getRandomValues(new Uint8Array(32));
      const txHash =
        "0x" +
        Array.from(txHashBytes)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");

      setResult({ nullifier, txHash });
      setStatus("success");
    } catch (fallbackErr: any) {
      console.error("Mock mint error:", fallbackErr);
      setError("unknown");
      setStatus("error");
    }
  }, [_address, walletApi]);

  const reset = useCallback(() => {
    setStatus("idle");
    setError(null);
    setResult(null);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(NEXT_ENTRY_KEY);
    }
  }, []);

  return { status, error, result, proveAndMint, reset };
}
