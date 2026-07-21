/**
 * Precompute a valid Merkle tree for the allowlist_stub contract.
 *
 * Builds a depth-20 tree where all leaves except the first are zeros.
 * Outputs secret + Merkle path for the first leaf, plus the tree root.
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
const LeafPreimageType = new (class {
  alignment() { return Bytes32.alignment().concat(Bytes32.alignment()); }
  fromValue(v: any) { return { domain_sep: Bytes32.fromValue(v), data: Bytes32.fromValue(v) }; }
  toValue(v: any) { return Bytes32.toValue(v.domain_sep).concat(Bytes32.toValue(v.data)); }
})();
const Vector2Field = new cr.CompactTypeVector(2, Field);

const DOMAIN_SEP_LH = new Uint8Array([109, 100, 110, 58, 108, 104]); // "mdn:lh"

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

// ─── Build a Merkle tree with one non-zero leaf ────────────────────────

const DEPTH = 20;

function main() {
  // 1. Generate a random 32-byte secret
  const secret = randomBytes(32);

  // 2. Compute the leaf hash
  const leaf = hashLeaf(secret);
  let current = hashLeafDigest(leaf);

  // 3. Compute the "zero subtree" hashes (all-zero leaves)
  const zeroSubtrees: bigint[] = new Array(DEPTH);
  const zeroLeafHash = hashLeaf(new Uint8Array(32));
  zeroSubtrees[0] = hashLeafDigest(zeroLeafHash);
  for (let i = 1; i < DEPTH; i++) {
    zeroSubtrees[i] = hashPair(zeroSubtrees[i - 1], zeroSubtrees[i - 1]);
  }

  // 4. Build the path for leaf 0: at each level, sibling is the zero subtree,
  //    and goes_left = true (our leaf is the left child at every fork)
  const path = [];
  for (let level = 0; level < DEPTH; level++) {
    path.push({
      sibling: { field: zeroSubtrees[level] },
      goes_left: true,
    });
    current = hashPair(current, zeroSubtrees[level]);
  }

  const root = current;

  const output = {
    secret: Buffer.from(secret).toString('hex'),
    leaf: Buffer.from(leaf).toString('hex'),
    root: root.toString(),
    path: path.map(e => ({
      sibling: e.sibling.field.toString(),
      goes_left: e.goes_left,
    })),
  };

  process.stdout.write(JSON.stringify(output, null, 2) + '\n');
}

main();
