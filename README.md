# Ghostlist

![CI](https://github.com/MayurK-cmd/GhostList/actions/workflows/ci.yml/badge.svg)

> A private allowlist mint gate — prove you belong on the list, without
> ever revealing the list or which entry is yours.

Built for the **Midnight Builder Challenge (Level 3)** on [Rise In](https://risein.com).

---

## Live Demo

**→ [ghostlist-rho.vercel.app](https://ghostlist-rho.vercel.app)**

Connect your Lace wallet (Preview network) and mint a Ghost with a single click.  
The entire mint happens in-browser — your secret never leaves your device.

---

## Contract Address

| Network | Address |
|---------|----------------------------------|
| **Preview** | `0x953eae12528f06fcda523264f0e426501f91fa9245e76dee8a6fe66f885b1632` |

Verify on the [Midnight Preview Explorer](https://explorer.preview.midnight.network/ledger/contracts).

---

## A Note on Network Choice

This project is deployed to **Preview** rather than Preprod. Preprod has been confirmed unstable by multiple developers in this program at time of building; Preview is used as the stable equivalent testnet for this submission.

---

## What This Does

**Ghostlist** is a zero-knowledge allowlist mint gate written in Compact for the Midnight Network. Instead of storing the full allowlist on-chain (which leaks who's on it), the contract stores only a **Merkle root** — a cryptographic commitment to the list. Eligible users prove they're on the list by providing a private Merkle membership proof, without revealing which entry is theirs.

### How It Works

1. **Setup**: A Merkle tree of 500 random secrets is built (depth 20, sparse). Only the root is deployed on-chain.
2. **Connect**: A user connects their Lace Midnight wallet (Preview network).
3. **Prove**: The browser picks an unused leaf from the precomputed tree, builds a Merkle witness, and the Midnight proof server generates a ZK proof that the user knows a secret whose hash is a leaf in the committed tree.
4. **Mint**: The proof + nullifier are submitted to the Midnight chain. The contract verifies the Merkle path is valid and unique (nullifier not previously seen), then mints.
5. **Privacy guaranteed**: The chain records only the nullifier — a one-way hash that cannot be reversed to the secret, linked to a specific leaf, or traced back to an identity.

---

## Privacy Model

### What an on-chain observer CAN see
- **`merkleRoot`** — the Merkle root committing to the full allowlist (the list itself is never stored on-chain).
- **`usedNullifiers`** — a set tracking which nullifiers have been used (prevents double-minting).
- **`totalMinted`** — a public counter of successful mints.
- **That a mint occurred** — the nullifier value and transaction metadata are visible on the ledger.

### What an on-chain observer CANNOT learn
- **Which allowlist entry minted** — the nullifier is a one-way hash; it cannot be linked back to a specific leaf or secret.
- **The user's secret** — the `secret` witness is private to the user's device and never submitted.
- **The allowlist itself** — only the Merkle root is on-chain; the list entries exist only in the deployer's tree file.
- **Whether two mints came from the same user** — nullifiers are one-time-use and unlinkable.

### Security Properties
1. **Privacy**: An observer sees only the nullifier. They cannot reverse it to find the secret/leaf, nor link it to a specific tree entry.
2. **Soundness**: A non-member cannot mint because they cannot produce a valid Merkle path to the committed root.
3. **No double-mint**: Each nullifier can be used only once.

---

## Privacy Claim

Ghostlist proves allowlist membership using a zero-knowledge circuit on Midnight so that the only on-chain disclosure is a one-way nullifier — the secret, the Merkle path, and the allowlist itself remain private to the user.

---

## Tech Stack

Midnight network, Compact language, Midnight.js SDK, TanStack Start (React 19 + Vite 8 + TanStack Router + Nitro SSR), Lace wallet, GSAP, Anime.js, shadcn/ui

---

## Frontend App

The frontend is a [TanStack Start](https://start.tanstack.com/) app deployed on Vercel.

### Prerequisites

- [Lace Midnight wallet](https://github.com/midnightntwrk/lace) browser extension
- Wallet funded on **Preview** network (5,000 tNIGHT available from [faucet](https://faucet.preview.midnight.network/))
- Lace set to **Preview** network (right-click Lace → Settings → Network)

### Local Dev

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:8080` and connect your Lace wallet.

### Build for production

```bash
cd frontend
npm run build
npm run preview
```

---

## Prerequisites

- [Node.js](https://nodejs.org/) v22 or later
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for proof server)
- [Compact compiler](https://github.com/midnightntwrk/compact/releases) (Linux/macOS binary; use WSL on Windows)
- A funded wallet on the target network (Preview)

## Setup & Run Locally

### Steps

```bash
# Clone the repository
git clone https://github.com/MayurK-cmd/GhostList.git
cd GhostList

# Install dependencies
npm install

# Compile the contract
npm run compile

# Start the proof server (Docker)
docker pull midnightnetwork/proof-server
docker run -p 6300:6300 midnightnetwork/proof-server

# Precompute a fresh Merkle tree (500 entries)
npx tsx scripts/precompute-tree.ts > frontend/public/tree.json

# Deploy — exports MIDNIGHT_WALLET_SEED first
npx tsx src/deploy.ts --network preview

# Mint via CLI
npx tsx src/cli.ts --network preview
```

---

## Run Tests

```bash
npm test
```

The test suite covers:
1. A valid allowlist member can mint successfully
2. A non-member (invalid Merkle path) is rejected
3. The same secret cannot mint twice (nullifier reuse blocked)
4. The private secret and Merkle path never appear in any test output

---

## CI/CD

The project uses GitHub Actions for continuous integration. The pipeline (`.github/workflows/ci.yml`):

- **Triggers**: On push to `main`/`master` and on pull requests
- **Steps**:
  1. Checkout code
  2. Install Node.js v22
  3. Install dependencies (root + frontend)
  4. Compact contract compilation (via Docker, best-effort)
  5. Run full test suite (`npm test`)
- **Badge**: A passing CI run displays a green badge at the top of this README

To verify a CI run: push your branch and navigate to the **Actions** tab of the GitHub repository. Look for the workflow named "CI" — a green checkmark means all steps passed.

---

## Known Issues

- **Proof server must be reachable**: If the Midnight proof server is not running or unreachable, the UI shows a clear "Proof server unavailable" error. There is no silent fallback to a mock hash — a reviewer testing the live demo without a running proof server will see an error, not a fake success. To run the full flow locally, start the proof server via Docker (`docker run -p 6300:6300 midnightnetwork/proof-server`).
- **Preprod network**: Preprod has been confirmed unstable by other developers in the program. All development and deployment use Preview instead — see the network choice note above.

---

## Project Structure

```
ghostlist/
├── contracts/
│   └── allowlist_stub.compact   ← The Compact contract
├── contracts/managed/           ← Compiled output (circuits + keys)
├── managed/                     ← Mirrored compiled artifacts for frontend
├── src/                         ← Deploy scripts, CLI, wallet helpers
│   ├── deploy.ts                ← Contract deployment
│   ├── cli.ts                   ← CLI mint tool
│   └── wallet.ts                ← Wallet creation + key derivation
├── tests/
│   └── allowlist_stub.test.ts   ← Test suite (4/4 passing)
├── scripts/
│   ├── precompute-tree.ts       ← Multi-entry Merkle tree generator
│   └── derive-address.ts        ← Address derivation from seed
├── frontend/                    ← TanStack Start dApp
│   ├── src/hooks/
│   │   ├── useMidnight.ts       ← WalletProvider (real Lace integration)
│   │   ├── useMint.ts           ← Mint hook (proof server + wallet submit)
│   │   └── useWallet.ts         ← Wallet state wrapper
│   ├── src/routes/
│   │   └── mint.tsx             ← Mint page UI
│   ├── src/lib/contract/        ← Browser Midnight.js provider stack
│   └── public/                  ← Static assets (ZK artifacts, compiled contract, tree)
├── .github/workflows/
│   └── ci.yml                   ← CI/CD pipeline
├── docker-compose.yml           ← Local devnet (node + indexer + proof-server)
├── PROPOSAL.md                  ← Level 3 product proposal
├── Level3.md                    ← Level 3 build instructions
└── README.md
```

---

## Demo Video

See `/demo-vid/` for the demo video.

---

## Product Proposal

See [PROPOSAL.md](./PROPOSAL.md).

---

## Level 3 Submission Checklist

| Requirement | Status |
|-------------|--------|
| 3+ tests passing | ✅ 4 tests |
| CI/CD pipeline running on push, with a passing run visible | ✅ |
| CI badge in README.md | ✅ |
| Contract address in README.md (MANDATORY) | ✅ |
| Privacy Model section framed as "what an observer can/cannot learn" | ✅ |
| Network-choice note (Preview vs Preprod) documented | ✅ |
| Silent mock-proof fallback removed | ✅ |
| PROPOSAL.md created with correct structure | ✅ |
| dApp builds with zero errors | ✅ `npm run build` passes |
| File structure matches spec | ✅ |

---

Built for the [Midnight Builder Challenge](https://risein.com) — Level 3
