# Ghostlist

> A private allowlist mint gate — prove you belong on the list, without
> ever revealing the list or which entry is yours.

Built for the **Midnight Builder Challenge (Level 1)** on [Rise In](https://risein.com).

---

## Live Demo

**→ [ghostlist-rho.vercel.app](https://ghostlist-rho.vercel.app)**

Connect your Lace wallet (Preview network) and mint a Ghost with a single click.  
The entire mint happens in-browser — your secret never leaves your device.

---

## Demo Video

in /demo-vid/

---
## Contract Address

| Network | Address |
|---------|---------|
| **Preview** | `0x953eae12528f06fcda523264f0e426501f91fa9245e76dee8a6fe66f885b1632` |
| Preprod | *Skipped — devs confirmed Preprod is unstable* |

Verify on the [Midnight Preview Explorer](https://explorer.preview.midnight.network/ledger/contracts).

---

## What This Does

**Ghostlist** is a zero-knowledge allowlist mint gate written in Compact for the Midnight Network. Instead of storing the full allowlist on-chain (which leaks who's on it), the contract stores only a **Merkle root** — a cryptographic commitment to the list. Eligible users prove they're on the list by providing a private Merkle membership proof, without revealing which entry is theirs.

This Level 1 contract (`allowlist_stub.compact`) establishes the core privacy primitive:

- A **Merkle root** commits the allowlist to the ledger
- A **nullifier set** prevents double-minting
- Users prove membership via zero-knowledge circuits
- Only the derived nullifier is disclosed — never the secret or the path

### How It Works

1. **Setup**: A Merkle tree of 500 random secrets is built (depth 20, sparse). Only the root is deployed on-chain.
2. **Connect**: A user connects their Lace Midnight wallet (Preview network).
3. **Prove**: The browser picks an unused leaf from the precomputed tree, builds a Merkle witness, and the Midnight proof server generates a ZK proof that the user knows a secret whose hash is a leaf in the committed tree.
4. **Mint**: The proof + nullifier are submitted to the Midnight chain. The contract verifies the Merkle path is valid and unique (nullifier not previously seen), then mints.
5. **Privacy guaranteed**: The chain records only the nullifier — a one-way hash that cannot be reversed to the secret, linked to a specific leaf, or traced back to an identity.

---

## Privacy Model

### PUBLIC (on-chain, visible to anyone)
- **`merkleRoot`** — the Merkle root committing to the full allowlist (the list itself is never stored on-chain)
- **`usedNullifiers`** — a set tracking which nullifiers have been used (prevents double-minting without revealing identity)
- **`totalMinted`** — a public counter of successful mints

### PRIVATE (witness-only, never on-chain)
- **`secret`** — the user's private allowlist key (`Bytes<32>`)
- **`merklePath`** — a `MerkleTreePath<20, Bytes<32>>` proving the hash of the secret is a leaf in the tree

### DISCLOSED (proves eligibility without revealing identity)
- **`nullifier`** — `persistentHash(leaf)` — a hash of the hashed secret. This proves the user knows a secret whose hash is in the allowlist tree, and prevents double-minting, **without revealing which leaf is theirs**.

### Security Properties
1. **Privacy**: An observer sees only the nullifier. They cannot reverse it to find the secret/leaf, nor link it to a specific tree entry.
2. **Soundness**: A non-member cannot mint because they cannot produce a valid Merkle path to the committed root.
3. **No double-mint**: Each nullifier can be used only once.

---

## Frontend App

The frontend is a [TanStack Start](https://start.tanstack.com/) app (React 19 + Vite 8 + TanStack Router + Nitro SSR) deployed on Vercel.

### Prerequisites

- [Lace Midnight wallet](https://github.com/midnightntwrk/lace) browser extension
- Wallet funded on **Preview** network (5,000 tNIGHT available from faucet)
- Lace set to **Preview** network (right-click Lace → Settings → Network)

### Local Dev

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000` and connect your Lace wallet.

### Build for production

```bash
cd frontend
npm run build
npm run preview
```

---

## Smart Contract Development

### Prerequisites

- [Node.js](https://nodejs.org/) v22 or later
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for proof server)
- [Compact compiler](https://github.com/midnightntwrk/compact/releases) (Linux/macOS binary; use WSL on Windows)
- A funded wallet on the target network (Preview or Preprod)

### Setup

```bash
# Clone the repository
git clone https://github.com/MayurK-cmd/GhostList.git
cd GhostList

# Install dependencies
npm install

# Compile the contract
npm run compile

# Start the proof server (Docker)
docker run -p 6300:6300 midnightnetwork/proof-server

# Precompute a fresh Merkle tree (500 entries)
npx tsx scripts/precompute-tree.ts > frontend/public/tree.json

# Deploy — exports MIDNIGHT_WALLET_SEED first
npx tsx src/deploy.ts --network preview

# Mint via CLI
npx tsx src/cli.ts --network preview
```

### Run Tests

```bash
npm test
```

The test suite covers:
1. A valid allowlist member can mint successfully
2. A non-member (invalid Merkle path) is rejected
3. The same secret cannot mint twice (nullifier reuse blocked)
4. The private secret and Merkle path never appear in any test output

---

## Project Structure

```
ghostlist/
├── contracts/
│   └── allowlist_stub.compact   ← The Compact contract
├── contracts/managed/           ← Compiled output (circuits + keys) — gitignored
├── src/                         ← Deploy scripts, CLI, wallet helpers
│   ├── deploy.ts                ← Contract deployment
│   ├── cli.ts                   ← CLI mint tool
│   └── wallet.ts                ← Wallet creation + key derivation
├── tests/
│   └── allowlist_stub.test.ts   ← Test suite (4/4 passing)
├── scripts/
│   └── precompute-tree.ts       ← Multi-entry Merkle tree generator
├── frontend/                    ← TanStack Start dApp
│   ├── src/hooks/
│   │   ├── useMidnight.ts       ← WalletProvider (real Lace integration)
│   │   ├── useMint.ts           ← Mint hook (proof server + wallet submit)
│   │   └── useWallet.ts         ← Wallet state wrapper
│   ├── src/routes/
│   │   └── mint.tsx             ← Mint page UI
│   ├── src/lib/contract/        ← Browser Midnight.js provider stack
│   └── public/                  ← Static assets (ZK artifacts, compiled contract, tree)
├── docker-compose.yml           ← Local devnet (node + indexer + proof-server)
└── README.md
```

---

## Intended Future Levels

- **Level 2**: Token minting (shielded tokens via Midnight's native assets)
- **Level 3**: Off-chain allowlist management + CI/CD
- **Level 4**: NFT minting gated by the same ZK allowlist proof

---

## Grant Submission Checklist

| Requirement | Status |
|-------------|--------|
| Lace wallet connect / disconnect | ✅ |
| Circuit called successfully from the frontend | ✅ |
| Observable privacy behavior (ZK proof, nullifier disclosure) | ✅ |
| Contract deployed to verifiable address | ✅ Preview: `0x953eae12528f06fcda523264f0e426501f91fa9245e76dee8a6fe66f885b1632` |
| Public GitHub repository | ✅ [github.com/MayurK-cmd/GhostList](https://github.com/MayurK-cmd/GhostList) |
| Live demo link | ✅ [ghostlist-rho.vercel.app](https://ghostlist-rho.vercel.app) |
| 8+ meaningful commits | ✅ 18 commits |
| README documenting privacy claim | ✅ (this document) |
| Demo video | in /demo-vid/ |

---

Built for the [Midnight Builder Challenge](https://risein.com) — Level 2
