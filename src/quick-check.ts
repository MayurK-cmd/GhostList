/**
 * Quick wallet check — creates wallet and prints status.
 */
import { resolveNetwork, getOrCreateSeed } from './network';
import { createWallet } from './wallet';
import { WebSocket } from 'ws';
globalThis.WebSocket = WebSocket;

async function main() {
  const { network, config } = resolveNetwork();
  const seed = getOrCreateSeed(network);
  console.log(`Network: ${network}`);
  console.log(`Seed: ${seed.slice(0, 16)}...\n`);

  console.log('Creating wallet...');
  const walletCtx = await createWallet({ network, networkConfig: config, seed, restore: false });

  const address = walletCtx.unshieldedKeystore.getBech32Address();
  console.log(`Address: ${address}\n`);

  console.log('Getting initial state (non-blocking)...');
  try {
    const state = await Promise.race([
      walletCtx.wallet.waitForSyncedState(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('sync timeout')), 30000))
    ]) as any;
    const balance = state.unshielded.balances[Object.keys(state.unshielded.balances)[0]] ?? 0n;
    console.log(`Balance: ${balance} tNight`);
  } catch (e: any) {
    console.log(`Sync not completed: ${e.message}`);
  }

  await walletCtx.wallet.stop();
  console.log('\nDone.');
}

main().catch(console.error);
