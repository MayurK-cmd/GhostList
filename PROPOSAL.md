# Product Proposal

## What is the product, and who uses it?

[I WILL FILL THIS IN]

## Why Midnight specifically?

[I WILL FILL THIS IN — what does Midnight do that a transparent
chain could not do well for this product?]

## Data Model

Ghostlist is a private allowlist mint gate. The contract stores only a
cryptographic commitment to the allowlist, not the list itself. When a user
mints, the only value disclosed on-chain is a nullifier — a one-way hash
that proves eligibility without revealing identity.

| Data Point | Type | Disclosed To |
|---|---|---|
| `merkleRoot` | Public ledger (Field) | Everyone — commits the allowlist without revealing its entries |
| `usedNullifiers` | Public ledger (Set\<Bytes\<32\>\>) | Everyone — prevents double-minting |
| `totalMinted` | Public ledger (Counter) | Everyone — total number of mints |
| `nullifier` | Circuit output (disclose()) | Everyone — `persistentHash(leaf)` proves eligibility anonymously |
| `secret` | Private witness (Bytes\<32\>) | No one — the user's allowlist key, never leaves their device |
| `leaf` | Private witness / derived | No one — `persistentHash(secret)`, used internally to verify Merkle path |
| `merklePath` | Private witness (MerkleTreePath\<20, Bytes\<32\>\>) | No one — Merkle membership proof linking leaf to the committed root |

[I WILL FILL IN THE ROWS]

## Mainnet Feasibility

[I WILL FILL THIS IN — is this realistic to reach Mainnet by Level 6?]
