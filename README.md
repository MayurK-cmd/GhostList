# Ghostlist

> A private allowlist mint gate — prove you belong on the list, without
> ever revealing the list or which entry is yours.

Built for the **Midnight Builder Challenge (Level 1)** on [Rise In](https://risein.com).

## Contract Address

| Network | Address |
|---------|---------|
| Undeployed (local devnet) | `6545c1ff1fadcb695d8617ad418c77ad2b703cbe892822e37798281438c83776` |
| Preview | `a4021ce19d60ca3bb659126adc8c2ce5f9dcde46de5f7c88c6c654b48cf6b9d4` |
| Preprod  | *Not deployed* |

## What This Does

**Ghostlist** is a zero-knowledge allowlist mint gate written in Compact for the Midnight Network. Instead of storing the full allowlist on-chain (which leaks who's on it), the contract stores only a **Merkle root** — a cryptographic commitment to the list. Eligible users prove they're on the list by providing a private Merkle membership proof, without revealing which entry is theirs.

This Level 1 contract (`allowlist_stub.compact`) establishes the core privacy primitive:

- A **Merkle root** commits the allowlist to the ledger
- A **nullifier set** prevents double-minting
- Users prove membership via zero-knowledge circuits
- Only the derived nullifier is disclosed — never the secret or the path

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

## Tech Stack

- **Language**: [Compact](https://docs.midnight.network/compact/reference/lang-ref) — Midnight's zero-knowledge smart contract language
- **Runtime**: [@midnight-ntwrk/compact-runtime](https://www.npmjs.com/package/@midnight-ntwrk/compact-runtime) v0.15.0
- **SDK**: Midnight.js + Wallet SDK
- **Proof Server**: `midnightnetwork/proof-server` (Docker)
- **Node.js**: v22+
- **Package Manager**: npm

## Prerequisites

- [Node.js](https://nodejs.org/) v22 or later
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for proof server)
- [Compact compiler](https://github.com/midnightntwrk/compact/releases) (Linux/macOS binary; use WSL on Windows)
- A funded wallet on the target network (Preview or Preprod)

## Setup

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

# Generate a wallet address and fund it
npm run get-address -- --network preprod
# Visit the faucet URL printed, fund the address, then:

# Deploy
npm run deploy -- --network preprod
```

## Run Tests

```bash
npm test
```

The test suite covers:
1. A valid allowlist member can mint successfully
2. A non-member (invalid Merkle path) is rejected
3. The same secret cannot mint twice (nullifier reuse blocked)
4. The private secret and Merkle path never appear in any test output

## Project Structure

```
ghostlist/
├── contracts/
│   └── allowlist_stub.compact   ← The Compact contract
├── contracts/managed/           ← Compiled output (circuits + keys)
├── src/                         ← Deploy scripts
├── tests/
│   └── allowlist_stub.test.ts   ← Test suite
├── .github/workflows/          ← CI/CD (coming in Level 3)
├── package.json
├── tsconfig.json
└── README.md
```

## Initial Idea

Ghostlist is designed as a mint-gate for NFT/token drops that proves allowlist membership via zero-knowledge proofs instead of publishing the allowlist on-chain. Traditional allowlists leak who's on them — creating targeting, doxxing, and front-running risk for early supporters. Ghostlist commits only a Merkle root of the allowlist on-chain; eligible users mint by proving membership with a private witness, and a nullifier (not their identity) is recorded to prevent double-minting. The result: a useful, reusable on-chain primitive for private gated access.

**Future levels** will add:
- Token minting (shielded tokens)
- Off-chain allowlist management
- A frontend dApp
- CI/CD with automated testing

## Screenshots

![Compile output — circuits compiled successfully](screenshots/Screenshot%202026-07-17%20at%204.57.49%E2%80%AFPM.png)

![Contract deployed with address shown](screenshots/Screenshot%202026-07-17%20at%204.58.34%E2%80%AFPM.png)

---

Built for the [Midnight Builder Challenge](https://risein.com) — Level 1
