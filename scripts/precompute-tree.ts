/**
 * Precompute a Merkle tree with N random secrets for the allowlist_stub contract.
 *
 * Builds a depth-20 sparse Merkle tree. The first N leaves (positions 0..N-1)
 * are populated with random secrets; the remaining 2^20 - N leaves are zeros.
 * Outputs all N entries with their Merkle paths, plus the tree root.
 *
 * Usage:
 *   cd ghostlist-deploy && npx tsx ../scripts/precompute-tree.ts > ../frontend/public/tree.json
 *
 * Then deploy the contract with `args: [root]` using the printed root value.
 */
import { randomBytes } from 'node:crypto';
import { Buffer } from 'node:buffer';

const cr = await import('@midnight-ntwrk/compact-runtime');

// ─── Type descriptors (mirror contract/index.js) ────────────────────────

const Field = cr.CompactTypeField;
const Bytes32 = new cr.CompactTypeBytes(32);
const Bytes6 = new cr.CompactTypeBytes(6);
const LeafPreimageType = new (class {
  alignment() { return Bytes6.alignment().concat(Bytes32.alignment()); }
  fromValue(v: any) { return { domain_sep: Bytes6.fromValue(v), data: Bytes32.fromValue(v) }; }
  toValue(v: any) { return Bytes6.toValue(v.domain_sep).concat(Bytes32.toValue(v.data)); }
})();
const Vector2Field = new cr.CompactTypeVector(2, Field);

const DOMAIN_SEP_LH = new Uint8Array([109, 100, 110, 58, 108, 104]); // "mdn:lh"
const DEPTH = 20;
const N_ENTRIES = 500;

// ─── Hash helpers ───────────────────────────────────────────────────────

function hashLeaf(secret: Uint8Array): Uint8Array {
  return cr.persistentHash(Bytes32, secret);
}

function hashLeafDigest(leaf: Uint8Array): bigint {
  return BigInt(cr.degradeToTransient(
    cr.persistentHash(LeafPreimageType, { domain_sep: DOMAIN_SEP_LH, data: leaf })
  ));
}

function hashPair(left: bigint, right: bigint): bigint {
  return BigInt(cr.transientHash(Vector2Field, [left, right]));
}

// ─── Build a sparse Merkle tree with N non-zero leaves ─────────────────

function main() {
  // 1. Generate N random secrets and compute their leaf hashes
  const secrets: Uint8Array[] = Array.from({ length: N_ENTRIES }, () => randomBytes(32));
  const leafHashes: Uint8Array[] = secrets.map((s) => hashLeaf(s));
  const leafDigests: bigint[] = leafHashes.map((l) => hashLeafDigest(l));

  // 2. Compute zero subtree hashes
  const zeroLeaf = new Uint8Array(32);
  const zeroSubtrees: bigint[] = new Array(DEPTH);
  zeroSubtrees[0] = hashLeafDigest(hashLeaf(zeroLeaf));
  for (let i = 1; i < DEPTH; i++) {
    zeroSubtrees[i] = hashPair(zeroSubtrees[i - 1], zeroSubtrees[i - 1]);
  }

  // 3. Build the tree bottom-up, tracking only nodes that have at least
  //    one non-zero leaf descendant.  Keys are "level:position".
  const nodes = new Map<string, bigint>();

  // Level 0 — leaf digests
  for (let i = 0; i < N_ENTRIES; i++) {
    nodes.set(`0:${i}`, leafDigests[i]);
  }

  // Levels 1..DEPTH — internal nodes
  for (let level = 1; level <= DEPTH; level++) {
    // Collect parent positions from non-zero nodes at the previous level
    const parents = new Set<number>();
    for (const key of nodes.keys()) {
      const [lvl, pos] = key.split(':').map(Number);
      if (lvl === level - 1) parents.add(pos >> 1);
    }
    for (const parentPos of parents) {
      const key = `${level}:${parentPos}`;
      if (nodes.has(key)) continue;
      const left  = nodes.get(`${level - 1}:${parentPos * 2}`) ?? zeroSubtrees[level - 1];
      const right = nodes.get(`${level - 1}:${parentPos * 2 + 1}`) ?? zeroSubtrees[level - 1];
      nodes.set(key, hashPair(left, right));
    }
  }

  const root = nodes.get(`${DEPTH}:0`)!;

  // 4. Build path for each leaf
  const entries: any[] = [];
  for (let i = 0; i < N_ENTRIES; i++) {
    const path: any[] = [];
    for (let level = 0; level < DEPTH; level++) {
      // Sibling position at this level
      const sibPos = (i >> level) ^ 1;
      const sibKey = `${level}:${sibPos}`;
      const sibling = nodes.get(sibKey) ?? zeroSubtrees[level];
      // goes_left = true  → sibling is left child (our node is right child)
      // goes_left = false → sibling is right child (our node is left child)
      // goes_left = true  → our value is the left child (sibling is right) → hashPair(our, sibling)
      // goes_left = false → our value is the right child (sibling is left) → hashPair(sibling, our)
      path.push({
        sibling: sibling.toString(),
        goes_left: ((i >> level) & 1) === 0,
      });
    }
    entries.push({
      secret: Buffer.from(secrets[i]).toString('hex'),
      leaf: Buffer.from(leafHashes[i]).toString('hex'),
      path,
    });
  }

  const output = {
    root: root.toString(),
    count: N_ENTRIES,
    entries,
  };

  process.stdout.write(JSON.stringify(output, null, 2) + '\n');
}

main();
