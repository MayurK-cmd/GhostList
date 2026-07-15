/**
 * Quick wallet address generator — prints the wallet address immediately
 * so you can fund it from the faucet before deploying.
 *
 * Usage: npx tsx src/get-address.ts --network preview
 */
import { resolveNetwork, getOrCreateSeed } from './network';
import { createWallet } from './wallet';
import { WebSocket } from 'ws';
globalThis.WebSocket = WebSocket;

async function main() {
  const { network, config: networkConfig } = resolveNetwork();
  const seed = getOrCreateSeed(network);

  console.log(`\nNetwork: ${network}`);
  console.log(`Faucet:  ${networkConfig.faucet ?? '(local devnet — faucet not available)'}\n`);

  console.log('Generating wallet...');
  const walletCtx = await createWallet({ network, networkConfig, seed });

  const address = walletCtx.unshieldedKeystore.getBech32Address();
  console.log(`\n══════════════════════════════════════════════════`);
  console.log(`  Wallet Address: ${address}`);
  console.log(`══════════════════════════════════════════════════\n`);
  console.log(`Fund this address at: ${networkConfig.faucet}\n`);
  console.log('After funding, run: npm run deploy -- --network preview\n');

  await walletCtx.wallet.stop();
}

main().catch(console.error);
