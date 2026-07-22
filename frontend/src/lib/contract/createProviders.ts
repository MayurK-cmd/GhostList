/**
 * Create the full Midnight.js provider stack for in-browser contract interaction.
 *
 * ALL runtime imports are dynamic so the SSR build (Nitro / Cloudflare) doesn't
 * try to resolve packages that only work in the browser (onchain-runtime WASM,
 * ledger WASM, graphql-ws, etc.).
 *
 * Only types are imported statically — they're erased at compile time.
 */
import type { WalletConnectedAPI } from "@midnight-ntwrk/dapp-connector-api";
import type { ContractProviders, WalletProvider } from "@midnight-ntwrk/midnight-js-contracts";
import type { MidnightProvider } from "@midnight-ntwrk/midnight-js-types";
import type { ContractAddress } from "@midnight-ntwrk/midnight-js-protocol/compact-runtime";
import type { Contract } from "@midnight-ntwrk/midnight-js-protocol/compact-js";
import type { BrowserZkConfigProvider } from "./browserZkConfigProvider";
import type { PrivateStateProvider } from "@midnight-ntwrk/midnight-js-types";

export type GhostlistCircuits = "mint";

export interface GhostlistProviders {
  providers: ContractProviders<Contract.Any>;
  config: {
    indexerUri: string;
    indexerWsUri: string;
    proofServerUri: string;
    networkId: string;
  };
}

/**
 * Initialize all providers from a connected wallet API.
 * Call this ONLY from a browser context — never during SSR.
 */
export async function createGhostlistProviders(
  walletApi: WalletConnectedAPI,
  contractAddress: ContractAddress,
): Promise<GhostlistProviders> {
  // All runtime imports are dynamic — they won't resolve during SSR
  const [
    { httpClientProofProvider },
    { indexerPublicDataProvider },
    { setNetworkId },
    { toHex, fromHex },
    { BrowserZkConfigProvider: BrowserZk },
    { inMemoryPrivateStateProvider },
    ledger,
  ] = await Promise.all([
    import("@midnight-ntwrk/midnight-js-http-client-proof-provider"),
    import("@midnight-ntwrk/midnight-js-indexer-public-data-provider"),
    import("@midnight-ntwrk/midnight-js-network-id"),
    import("@midnight-ntwrk/midnight-js-utils"),
    import("./browserZkConfigProvider"),
    import("./inMemoryPrivateStateProvider"),
    import("@midnight-ntwrk/midnight-js-protocol/ledger"),
  ]);

  const {
    Transaction,
    Binding,
    Proof,
    SignatureEnabled,
  } = ledger;

  // 1. Get wallet configuration (indexer URLs, proof server, network)
  const config = await walletApi.getConfiguration();

  // 2. Set the network ID so midnight-js internals can validate addresses
  setNetworkId(config.networkId as any);

  // 3. Get the shielded address info for the wallet provider
  const shieldedAddresses = await walletApi.getShieldedAddresses();

  // 4. ZK config provider — serves from our app's public/ directory
  const zkConfigProvider = new BrowserZk<GhostlistCircuits>(
    window.location.origin,
  );

  // 5. Proof provider — talks to the proof server (local or wallet-configured)
  const proofServerUri = config.proverServerUri ?? "http://localhost:6300";
  const proofProvider = httpClientProofProvider(proofServerUri, zkConfigProvider);

  // 6. Indexer public data provider — reads on-chain state
  const publicDataProvider = indexerPublicDataProvider(
    config.indexerUri,
    config.indexerWsUri,
  );

  // 7. Private state (in-memory — no persistence in browser)
  const privateStateProvider = inMemoryPrivateStateProvider();
  privateStateProvider.setContractAddress(contractAddress);

  // 8. Wallet provider — wraps Lace's ConnectedAPI
  const walletProvider: WalletProvider = {
    getCoinPublicKey: () => shieldedAddresses.shieldedCoinPublicKey as any,
    getEncryptionPublicKey: () => shieldedAddresses.shieldedEncryptionPublicKey as any,
    balanceTx: async (tx: any, ttl?: Date) => {
      const serialized = toHex(tx.serialize());
      let received: { tx: string };
      try {
        received = await walletApi.balanceUnsealedTransaction(serialized, {
          payFees: true,
        });
      } catch (balErr: any) {
        const balMsg = balErr?.message || balErr?.toString() || "unknown balance error";
        throw new Error(`wallet balanceUnsealedTransaction failed: ${balMsg}`);
      }
      return Transaction.deserialize<typeof SignatureEnabled, typeof Proof, typeof Binding>(
        "signature",
        "proof",
        "binding",
        fromHex(received.tx),
      );
    },
  };

  // 9. Midnight provider — submits via wallet
  const midnightProvider: MidnightProvider = {
    submitTx: async (tx: any) => {
      const hexTx = toHex(tx.serialize());
      try {
        await walletApi.submitTransaction(hexTx);
      } catch (submitErr: any) {
        const submitMsg = submitErr?.message || submitErr?.toString() || "unknown submit error";
        throw new Error(`wallet submitTransaction failed: ${submitMsg}`);
      }
      return tx.identifiers()[0];
    },
  };

  return {
    providers: {
      privateStateProvider,
      publicDataProvider,
      zkConfigProvider,
      proofProvider,
      walletProvider,
      midnightProvider,
    },
    config: {
      indexerUri: config.indexerUri,
      indexerWsUri: config.indexerWsUri,
      proofServerUri,
      networkId: config.networkId,
    },
  };
}
