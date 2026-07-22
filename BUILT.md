# Ghostlist — Build Status

> **Level 1** of the Midnight Builder Challenge — Private Allowlist Mint Gate
>
> Deployed to **Preview** testnet ✓ — Live demo at [ghostlist-rho.vercel.app](https://ghostlist-rho.vercel.app)

---

## 1. Smart Contract

**File:** `contracts/allowlist_stub.compact`

A zero-knowledge private allowlist mint gate written in Compact language for the Midnight Network.

### Circuits

| Circuit | Purpose |
|---------|---------|
| `constructor(initialRoot)` | Initialize the contract with the allowlist Merkle root |
| `mint()` | Prove allowlist membership in ZK and mint |

### Privacy Model

| Visibility | Data |
|------------|------|
| **Public** (on-chain) | `merkleRoot` (Field), `usedNullifiers` (Set\<Bytes\<32\>\>), `totalMinted` (Counter) |
| **Private** (witnesses) | `secret` (Bytes\<32\>), `merklePath` (MerkleTreePath\<20, Bytes\<32\>\>) |
| **Disclosed** | `nullifier` — proves membership without revealing identity |

### Security Properties

1. **Privacy** — Only the nullifier is disclosed; secret & Merkle path stay hidden
2. **Soundness** — Non-members cannot produce a valid Merkle proof
3. **No double-mint** — Used nullifiers are tracked and rejected on reuse

---

## 2. Tests

**File:** `tests/allowlist_stub.test.ts`

All **4/4 tests passing**:

| # | Test | Status |
|---|------|--------|
| 1 | Valid allowlist member can mint | ✅ |
| 2 | Non-member (invalid Merkle path) rejected | ✅ |
| 3 | Same secret cannot mint twice (nullifier reuse blocked) | ✅ |
| 4 | Private secret/path never appear in output | ✅ |

---

## 3. Deployment

### Preview Network

| Field | Value |
|-------|-------|
| **Contract Address** | `0x953eae12528f06fcda523264f0e426501f91fa9245e76dee8a6fe66f885b1632` |
| **Deployer** | `mn_addr_preview1efg4lt8ftffh58ex23anwlq9rdy36t29nf8uf0qhke6gq08249nsem3gz6` |
| **Merkle Tree** | 500-entry multi-leaf depth-20 sparse tree |
| **Tree Root** | `7956799017384263079554096761475090569954816895386770660524833229856540226662` |
| **Block Explorer** | [Preview Explorer](https://explorer.preview.midnight.network/ledger/contracts) |

---

## 4. Frontend (dApp)

**Stack:** TanStack Start (React 19 + Vite 8 + TanStack Router + Nitro SSR)  
**Deployed:** [ghostlist-rho.vercel.app](https://ghostlist-rho.vercel.app) (Vercel)

### Key Files

| File | Purpose |
|------|---------|
| `frontend/src/hooks/useMidnight.ts` | React context (`WalletProvider`) wrapping real `window.midnight.mnLace` |
| `frontend/src/hooks/useWallet.ts` | Thin wrapper around `useMidnight()` |
| `frontend/src/hooks/useMint.ts` | Full mint flow: proof server → wallet → contract. Falls back to demo mock |
| `frontend/src/routes/mint.tsx` | Mint page — connect wallet, prove, mint |
| `frontend/src/components/site/GhostCard.tsx` | Animated mint card with status states |
| `frontend/src/components/site/ProofPanel.tsx` | Privacy label: "Proved without revealing your identity" |
| `frontend/src/components/site/Navbar.tsx` | Connect/disconnect with error toasts |
| `frontend/src/lib/contract/createProviders.ts` | Wires wallet + indexer + proof server + ZK config |
| `frontend/src/lib/contract/browserZkConfigProvider.ts` | Fetches ZK artifacts from app's `/keys/` and `/zkir/` |
| `frontend/src/lib/contract/inMemoryPrivateStateProvider.ts` | In-memory private state for browser |
| `frontend/public/tree.json` | Precomputed 500-entry Merkle tree |

### Mint Flow

1. User connects Lace wallet (Preview network)
2. Load Merkle tree data from `/tree.json` (500 entries)
3. Pick the first non-spent entry (tracked via `localStorage` index pointer)
4. Build dynamic witnesses for that entry (secret + Merkle path)
5. Proof server generates ZK proof
6. Wallet balances + submits the transaction via Midnight.js
7. On chain error "Already minted" — auto-advance to the next entry and retry

---

## 5. CLI Tool

**File:** `src/cli.ts`

Interactive CLI mint tool that uses the same multi-leaf Merkle tree:

- Lazy-loads tree data (BOM-safe JSON loading)
- Creates fresh `CompiledContract` per entry with dynamic witnesses
- Tries entries sequentially, skips already-spent ones via error detection
- Reports "all spent" when every leaf is consumed

---

## 6. Scripts

| Script | Purpose |
|--------|---------|
| `scripts/precompute-tree.ts` | Generates 500-entry Merkle tree with secrets, leaves, and paths |
| `src/deploy.ts` | Standard deploy script (Preview/Preprod) |
| `src/cli.ts` | CLI mint tool |
| `src/check-balance.ts` | Wallet balance checker |
| `src/get-address.ts` | Quick wallet address generator |
| `src/network.ts` | Network config (undeployed/preview/preprod) |
| `src/wallet.ts` | Wallet creation + key derivation |
| `src/wallet-state.ts` | Wallet state persistence |
| `src/setup.ts` | Local devnet setup script |
| `scripts/e2e-check.ts` | End-to-end verification of deployed contract |

---

## 7. Network Configurations

| Network | Indexer | RPC Node | Faucet |
|---------|---------|----------|--------|
| **Preview** | `https://indexer.preview.midnight.network/api/v4/graphql` | `https://rpc.preview.midnight.network` | [Faucet](https://midnight-tmnight-preview.nethermind.dev) |
| **Preprod** | `https://indexer.preprod.midnight.network/api/v4/graphql` | `https://rpc.preprod.midnight.network` | [Faucet](https://midnight-tmnight-preprod.nethermind.dev) |

---

## 8. Quick Reference

```bash
# Frontend dev
cd frontend
npm run dev

# Frontend build
npm run build

# Compile contract
npm run compile

# Run tests
npm test

# Generate fresh Merkle tree
npx tsx scripts/precompute-tree.ts > frontend/public/tree.json

# Deploy to Preview
export MIDNIGHT_WALLET_SEED="<hex-seed>"
npx tsx src/deploy.ts --network preview

# Mint via CLI
npx tsx src/cli.ts --network preview
```

---

## 9. Known Issues

1. **Proof server required for real proving** — The frontend falls back to a demo mock if the proof server is unavailable (no error, just random hash). For real ZK proofs, run `docker compose up -d proof-server`.
2. **Wallet needs tNIGHT on Preview** — The deployer wallet is funded with 5,000 tNIGHT. New wallets need the faucet.
3. **500-entry tree limit** — Once all 500 entries are spent, the contract needs re-deploying with a fresh tree.

---

*Last updated: 2026-07-22*
