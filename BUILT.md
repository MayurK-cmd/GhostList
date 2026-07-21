# Ghostlist — Build Status

> **Level 1** of the Midnight Builder Challenge — Private Allowlist Mint Gate
>
> Deployed to **Preview** testnet ✓

---

## 1. Smart Contract

**File:** `contracts/allowlist_stub.compact`

A zero-knowledge private allowlist mint gate written in Compact language for the Midnight Network.

### Privacy Model

| Visibility | Data |
|------------|------|
| **Public** (on-chain) | `merkleRoot` (Field), `usedNullifiers` (Set\<Bytes\<32\>\>), `totalMinted` (Counter) |
| **Private** (witnesses) | `secret` (Bytes\<32\>), `merklePath` (MerkleTreePath\<20, Bytes\<32\>\>) |
| **Disclosed** | `nullifier` — proves membership without revealing identity |

### Circuits

| Circuit | Purpose |
|---------|---------|
| `constructor(initialRoot)` | Initialize the contract with the allowlist Merkle root |
| `mint()` | Prove allowlist membership in ZK and mint |

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
| **Contract Address** | `a4021ce19d60ca3bb659126adc8c2ce5f9dcde46de5f7c88c6c654b48cf6b9d4` |
| **Deployer Address** | `mn_addr_preview1efg4lt8ftffh58ex23anwlq9rdy36t29nf8uf0qhke6gq08249nsem3gz6` |
| **Deployed At** | 2026-07-17T11:24:32.472Z |
| **tNIGHT Balance** | 5,000,000,000,000 (raw) |
| **Block Explorer** | Check on [explorer](https://preview.midnightexplorer.com/) |

### Undeployed (Local Devnet)

| Field | Value |
|-------|-------|
| **Contract Address** | `6545c1ff1fadcb695d8617ad418c77ad2b703cbe892822e37798281438c83776` |
| **Deployer** | `mn_addr_undeployed1h3ssm5ru...` |

---

## 4. Source Files

| File | Purpose |
|------|---------|
| `contracts/allowlist_stub.compact` | The smart contract source |
| `contracts/managed/allowlist_stub/` | Compiled contract artifacts |
| `tests/allowlist_stub.test.ts` | 4/4 passing test suite |
| `src/deploy.ts` | Standard deploy script |
| `src/deploy-verbose.ts` | Deploy with emission logging (better for sync debugging) |
| `src/check-balance.ts` | Wallet balance checker |
| `src/get-address.ts` | Quick wallet address generator |
| `src/cli.ts` | CLI for interacting with deployed contract |
| `src/network.ts` | Network config (undeployed/preview/preprod endpoints) |
| `src/wallet.ts` | Wallet creation + key derivation |
| `src/wallet-state.ts` | Wallet state persistence |
| `src/setup.ts` | Local devnet setup script |
| `docker-compose.yml` | Local devnet (node + indexer + proof-server) |
| `scripts/e2e-check.ts` | End-to-end verification of deployed contract |

---

## 5. Network Configurations

| Network | Indexer | RPC Node | Faucet |
|---------|---------|----------|--------|
| **Undeployed** | `http://127.0.0.1:8088/api/v4/graphql` | `ws://127.0.0.1:9944` | None |
| **Preview** | `https://indexer.preview.midnight.network/api/v4/graphql` | `https://rpc.preview.midnight.network` | [Faucet](https://midnight-tmnight-preview.nethermind.dev) |
| **Preprod** | `https://indexer.preprod.midnight.network/api/v4/graphql` | `https://rpc.preprod.midnight.network` | [Faucet](https://midnight-tmnight-preprod.nethermind.dev) |

---

## 6. Quick Reference

```bash
# Compile contract
npm run compile

# Run tests
npm test

# Deploy to network
export MIDNIGHT_WALLET_SEED="<hex-seed>"
npx tsx src/deploy.ts --network preview    # Preview
npx tsx src/deploy.ts --network preprod    # Preprod

# Check balance
npx tsx src/check-balance.ts --network preview

# Start proof server (needed for deploy)
docker compose -f docker-compose.yml up -d proof-server
```

---

## 7. Git History (10 commits)

```
72006f8 contract deployed
f537b8e windows issue, trying on mac
2ad73f8 minor issues in deploying
18e1291 tests
7f86349 init
16e7a2e level 1 - completed
bb272c0 fixed
ae60ec3 readme
d171168 readme
8362eab readme
```

---

*Last updated: 2026-07-17*
