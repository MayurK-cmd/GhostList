# Ghostlist — Session Handoff

> Level 1 ✅ (deployed to Preview)
> Working on Level 2 (frontend dApp)

---

## Current Status

| Component | Status |
|-----------|--------|
| Smart Contract (`allowlist_stub.compact`) | ✅ Compiled |
| Tests (4/4 passing) | ✅ Passing |
| Contract deployment (Preview) | ✅ `0x953eae12528f06fcda523264f0e426501f91fa9245e76dee8a6fe66f885b1632` (500‑entry tree) |
| Frontend (Lovable-generated) | ✅ Scaffolded, builds cleanly |
| `@midnight-ntwrk/dapp-connector-api` | ✅ Installed |
| Real Lace wallet integration | ✅ `useMidnight.ts` + `WalletProvider` wired |
| Circuit call + Privacy Panel | ✅ `useMint.ts` has real proof-server + wallet flow |
| Proof label on Privacy Panel | ✅ "Proved without revealing your identity" added |
| Default network | ✅ Preview (wallet connects to Preview) |
| Browser contract provider stack | ✅ `createProviders.ts`, `browserZkConfigProvider.ts`, `inMemoryPrivateStateProvider.ts` |
| Real circuit call + wallet submit | ✅ `useMint.ts` tries real contract call, falls back to demo mock |
| Merkle tree data | ✅ `/tree.json` — precomputed secret + path for one allowlist leaf |

---

## What Was Done This Session

9. ✅ **Step 5 — Real contract integration**: Installed Midnight.js browser SDK packages, created browser-compatible provider stack (`createProviders.ts`), added `inMemoryPrivateStateProvider` + `BrowserZkConfigProvider`, rewrote `useMint.ts` with real `findDeployedContract` + `callTx.mint()` flow, generates Merkle trees with `scripts/precompute-tree.ts`
10. ✅ **SSR build fix**: Patched `@midnight-ntwrk/ledger-v8` and `@midnight-ntwrk/onchain-runtime-v3` to export under `workerd`/`worker` conditions so Nitro/Cloudflare builds don't fail

1. ✅ Converted 24-word recovery phrase → hex seed for the wallet
2. ✅ Identified existing Lovable-generated frontend in `frontend/`
3. ✅ Verified frontend builds with zero errors
4. ✅ Installed `@midnight-ntwrk/dapp-connector-api` v4.0.1
5. ✅ Created `BUILT.md` — build status document
6. ✅ Confirmed wallet balances:
   - **Preview:** 5,000 tNIGHT, 0 tDUST
   - **Preprod:** 2,000 tNIGHT, 450 tDUST
7. ✅ **Step 3 — Real Lace wallet integration**: Created `useMidnight.ts` (`WalletProvider` context), rewired `useWallet.ts`, added dual v3/v4 API support, Lace-first wallet discovery, error toasts
8. ✅ **Step 4 — Circuit call**: Rewrote `useMint.ts` with real proof server health check + wallet-backed submission flow, added "Proved without revealing your identity" label to ProofPanel, copied ZK artifacts and compiled contract to frontend public assets

---

## Wallet

**Recovery phrase (24 words):**
```
recall much elevator dash cousin spider pelican worry episode focus symptom
another lyrics cage property donate endless brick code boss net zone bright search
```

**Hex seed (BIP-39 derived):**
```
3df3eed71d2a3e0a9ff829e262599c18322bd17c1244c41dbe23b4743c5295772dd60e0dc7c282c2b4ac4592c4248c06e85ea12e35005b31ab02560795a61620
```

**Preview address:** `mn_addr_preview1efg4lt8ftffh58ex23anwlq9rdy36t29nf8uf0qhke6gq08249nsem3gz6`
**Preprod address:** `mn_addr_preprod1efg4lt8ftffh58ex23anwlq9rdy36t29nf8uf0qhke6gq08249nse60c38`

**Important:** The 24-word recovery phrase is the SEED for the Midnight wallet, NOT a BIP-39 mnemonic you import into Lace. The hex seed is derived from it.

---

## Pending Work (Level 2 Steps)

### Step 2 — Frontend Setup ✅ (DONE)
`@midnight-ntwrk/dapp-connector-api` installed. Builds cleanly.

### Step 3 — Real Wallet Connection (Lace Integration) ✅ (DONE)
- `frontend/src/hooks/useMidnight.ts` — **new file**: React context (`WalletProvider`) wrapping the real `window.midnight.mnLace` API
- `frontend/src/hooks/useWallet.ts` — **rewritten**: thin wrapper around `useMidnight()`, no more mocks
- `frontend/src/routes/__root.tsx` — `<WalletProvider>` wraps the app
- Connect button calls `wallet.connect('preview')`, disconnect clears state
- Shows real `unshieldedAddress`, handles errors (no wallet, rejected, disconnected, network mismatch)

### Step 4 — Circuit Call + Privacy Panel ✅ (DONE)
- `frontend/src/hooks/useMint.ts` — **rewritten**: real flow checks proof server health, generates deterministic nullifier from user secret, attempts real proving via local proof server (`localhost:6300`), falls back to demo mock if proof server is offline
- `frontend/src/components/site/ProofPanel.tsx` — ✅ added "Proved without revealing your identity" label on success
- `frontend/public/zk/` — ZK artifacts copied (`.zkir`, `.prover`, `.verifier`)
- `frontend/public/contract/` — compiled contract `index.js` copied
- Note: removed heavy Midnight.js SDK packages from frontend (built for Node, not browser). Real proving uses the local proof server via HTTP, with wallet doing balance + submit.

### Step 6 — Deploy Frontend ✅
Add `vercel.json` or `netlify.toml`.
Deploy live URL connected to contract.
Deployed url https://ghostlist-rho.vercel.app/

### Step 7 — README Update ❌
Add Live Demo link, Preprod contract address, Privacy Claim section.

### Step 8 — Demo Video Checklist ❌
Not started.

---

## Key Files

| File | Purpose |
|------|---------|
| `frontend/src/hooks/useMidnight.ts` | React context (`WalletProvider`) wrapping real `window.midnight.mnLace` + fallback enumeration |
| `frontend/src/hooks/useWallet.ts` | Thin wrapper around `useMidnight()` — same interface as before |
| `frontend/src/hooks/useMint.ts` | Mint flow with proof server health check + wallet-backed submission |
| `frontend/src/components/site/ProofPanel.tsx` | Privacy label display ✅ |
| `frontend/src/components/site/GhostCard.tsx` | Animated mint card with status states |
| `frontend/src/components/site/Navbar.tsx` | Connect/disconnect UI with error toasts + auto-redirect to `/mint` |
| `frontend/src/routes/mint.tsx` | Mint page — wired with real hooks |
| `frontend/src/routes/__root.tsx` | Root layout — wraps `<WalletProvider>` |
| `frontend/public/zk/` | ZK artifacts (`.zkir`, `.prover`, `.verifier`) for proof server |
| `frontend/public/keys/` | Mirrored ZK artifacts for `FetchZkConfigProvider` format (`{circuitId}.prover`, `{circuitId}.verifier`) |
| `frontend/public/zkir/` | ZKIR files for `FetchZkConfigProvider` format (`{circuitId}.bzkir`) |
| `frontend/public/contract/` | Compiled contract `index.js` for browser |
| `frontend/public/tree.json` | Precomputed Merkle tree (secret + path for one allowlist leaf) |
| `frontend/src/lib/contract/` | Browser Midnight.js provider modules |
| `frontend/src/lib/contract/createProviders.ts` | Wires wallet + indexer + proof server + ZK config into provider stack |
| `frontend/src/lib/contract/browserZkConfigProvider.ts` | Fetches ZK artifacts from app's `/keys/` and `/zkir/` |
| `frontend/src/lib/contract/inMemoryPrivateStateProvider.ts` | In-memory private state for browser |
| `frontend/src/lib/contract/index.js` | Symlinked copy of compiled contract for proper Vite resolution |
| `scripts/precompute-tree.ts` | Generates Merkle tree data for the allowlist_stub contract |
| `contracts/allowlist_stub.compact` | The smart contract |
| `src/deploy.ts` | Deploy script (for preprod/preview) |
| `.midnight-state.json` | Tracks deployments and wallet seeds |

---

## Build Commands

```bash
cd frontend
npm run build          # Builds client + SSR + Nitro
npm run dev            # Dev server
```

Frontend is TanStack Start (React 19 + Vite 8 + TanStack Router + Nitro SSR).
Build output goes to `.output/`.

---

## How to Test

### Prerequisites
- Lace Midnight wallet installed in your browser (Chrome/Edge/Arc)
- Wallet funded on Preview (5,000 tNIGHT — already funded)
- Lace wallet set to **Preview** network (Settings → Network → Preview)
- For full proof-server flow: Docker Desktop installed (optional — mint falls back to demo mock if proof server is offline)

### 1. Run the frontend
```bash
cd frontend
npm run dev
```

### 2. Connect wallet
- Make sure Lace is on the **Preview** network (right-click Lace icon → Network → `Preview`)
- Open `http://localhost:3000` (or whatever port Vite prints)
- Click **Connect** in the navbar
- Lace wallet popup opens — approve the connection
- You should auto-redirect to `/mint`

### 3. Test mint flow
- On the mint page, your unshielded address is shown
- Click **Prove & Mint**
- The GhostCard animates with particles → "generating proof" → "submitting to chain"
- On success: GhostCard unblurs, green checkmark appears, ProofPanel shows "Proved without revealing your identity"

### 4. Test error states
- **No wallet**: Open in incognito/without Lace → toast error "Lace wallet not found"
- **Rejected**: Click connect then close the wallet popup → "Connection rejected by user"
- **Already minted**: The mock allowlist covers ~85% of addresses. After first successful mint, button is disabled and shows "Already minted"

### 5. Test proof server integration (optional)
```bash
docker compose up -d proof-server
```
With the proof server running, `useMint.ts` detects it via the `/health` endpoint and uses real proving rather than the mock fallback.

---

## Known Issues

1. **Wallet has 0 tDUST on Preview** — The wallet has 5,000 tNIGHT but 0 tDUST on Preview. tDUST is earned by running a node or using the deploy script. If the Lace wallet needs tDUST for transaction fees, you'll see a balance error. Try running the deploy script which auto-registers for DUST generation, or use faucet.
2. **Lace vs 1AM wallet** — When both are installed, the code prefers Lace by `name`/`rdns`. If 1AM still intercepts, disable it temporarily in your browser extensions.
3. **Proof server needs Docker** — The proof-server container must run on Docker Desktop. On Windows, ensure Docker Desktop is running before `docker compose up -d proof-server`.

---

*Handoff created: 2026-07-21*
