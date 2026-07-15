/**
 * Deploy Ghostlist — with monkey-patch for subscribeRuntimeVersion issue.
 *
 * The Midnight preprod RPC node closes WebSocket connections that use the
 * deprecated 'state_subscribeRuntimeVersion' subscription. This patch
 * intercepts the call and returns a mock subscription that calls the
 * one-shot getRuntimeVersion instead.
 *
 * Usage: npx tsx src/deploy-fixed.ts --network preprod
 */

// ── Patch @polkadot/api bundle to use getRuntimeVersion ──────────
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

// The wallet-sdk loads @polkadot/rpc-core which has its own bundle.js
const rpcCorePath = path.resolve(
  path.dirname(fileURLToPath(import.meta.resolve('@polkadot/rpc-core/package.json'))),
  'bundle.js',
);
const apiPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.resolve('@polkadot/api/package.json'))),
  'bundle-polkadot-api.js',
);

for (const targetPath of [rpcCorePath, apiPath]) {
  if (!fs.existsSync(targetPath)) continue;
  let content = fs.readFileSync(targetPath, 'utf-8');
  const marker = '// PATCHED_getRuntimeVersion';
  if (content.includes(marker)) {
    console.log(`  ✓ Already patched: ${path.basename(targetPath)}`);
    continue;
  }
  // Replace subscribeRuntimeVersion() with getRuntimeVersion() in the _subscribeUpdates method
  // Pattern: this._rpcCore.state.subscribeRuntimeVersion().pipe(...)
  const patched = content.replace(
    /this\._rpcCore\.state\.subscribeRuntimeVersion\(\)/g,
    `this._rpcCore.state.getRuntimeVersion()${marker}`,
  );
  if (patched !== content) {
    fs.writeFileSync(targetPath, patched);
    console.log(`  🔧 Patched ${path.basename(targetPath)}`);
  } else {
    console.log(`  ? No subscribeRuntimeVersion found in ${path.basename(targetPath)}`);
  }
}

// ── END PATCH ────────────────────────────────────────────────────

// Import and run the normal deploy
await import('./deploy.ts');
