/**
 * CLI for interacting with Ghostlist contract (allowlist_stub).
 *
 * Commands:
 *   1. Mint — submit a real proof via the proof server
 *   2. Read state — show merkleRoot, totalMinted, usedNullifiers
 *   3. Check wallet balance
 *   4. Exit
 */
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { WebSocket } from 'ws';
import { Buffer } from 'buffer';

// Midnight SDK imports
import { findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { resolveNetwork, getOrCreateSeed, getDeployment } from './network';
import { createWallet, persistWalletState, unshieldedToken, type WalletContext } from './wallet';
import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js';

// Enable WebSocket for GraphQL subscriptions
// @ts-expect-error Required for wallet sync
globalThis.WebSocket = WebSocket;

// Must match the privateStateId used at deploy time so the CLI reconnects to
// the same private state. The allowlist_stub contract has no witnesses (empty state).
const PRIVATE_STATE_ID = 'helloWorldPrivateState';

const { network, config: networkConfig } = resolveNetwork();
const SEED = getOrCreateSeed(network);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const zkConfigPath = path.resolve(__dirname, '..', 'contracts', 'managed', 'allowlist_stub');

// Load compiled contract
const contractPath = path.join(zkConfigPath, 'contract', 'index.js');

// Check if contract is compiled
if (!fs.existsSync(contractPath)) {
  console.error('\n❌ Contract not compiled! Run: npm run compile\n');
  process.exit(1);
}

const HelloWorld = await import(pathToFileURL(contractPath).href);

// ─── Witness helpers

// ─── Witness helpers ─────────────────────────────────────────────────────

function hexToBytes(hex: string): Uint8Array {
  const bytes = hex.match(/.{1,2}/g);
  if (!bytes) throw new Error(`Invalid hex: ${hex}`);
  return new Uint8Array(bytes.map((b) => parseInt(b, 16)));
}

function createWitnesses(entry: TreeEntry) {
  const secretBytes = hexToBytes(entry.secret);
  const leafBytes = hexToBytes(entry.leaf);

  return {
    secret: (ctx: any): [any, Uint8Array] => {
      return [ctx.privateState, secretBytes];
    },
    merklePath: (ctx: any): [any, any] => {
      const merklePath = entry.path.map((e) => ({
        sibling: { field: BigInt(e.sibling) },
        goes_left: e.goes_left,
      }));
      return [ctx.privateState, { leaf: leafBytes, path: merklePath }];
    },
  };
}

// Load tree data once; rebuild witnesses dynamically per mint attempt.
let _treeData: TreeData | null | undefined; // undefined = not yet loaded, null = failed
function getTreeData(): TreeData | null {
  if (_treeData === undefined) _treeData = loadTreeData();
  return _treeData;
}

// Entry index for the next mint attempt. Incremented on "already minted".
let _nextEntryIndex = 0;

// Lazily re-create CompiledContract with a fresh witness for a given entry.
function makeCompiledContract(entry: TreeEntry) {
  return CompiledContract.make('allowlist_stub', HelloWorld.Contract).pipe(
    CompiledContract.withWitnesses(createWitnesses(entry)),
    CompiledContract.withCompiledFileAssets(zkConfigPath),
  );
}

// ─── Providers ────────────────────────────────────────────────────────────

async function createProviders(walletCtx: WalletContext) {
  const privateStatePassword = process.env.PRIVATE_STATE_PASSWORD?.trim() || 'Local-Devnet-Development-Placeholder-1';

  const walletProvider = {
    getCoinPublicKey: () => walletCtx.shieldedSecretKeys.coinPublicKey,
    getEncryptionPublicKey: () => walletCtx.shieldedSecretKeys.encryptionPublicKey,
    async balanceTx(tx: any, ttl?: Date) {
      const recipe = await walletCtx.wallet.balanceUnboundTransaction(
        tx,
        { shieldedSecretKeys: walletCtx.shieldedSecretKeys, dustSecretKey: walletCtx.dustSecretKey },
        { ttl: ttl ?? new Date(Date.now() + 30 * 60 * 1000) },
      );
      return walletCtx.wallet.finalizeRecipe(recipe);
    },
    submitTx: (tx: any) => walletCtx.wallet.submitTransaction(tx) as any,
  };

  const zkConfigProvider = new NodeZkConfigProvider(zkConfigPath);
  const accountId = walletCtx.unshieldedKeystore.getBech32Address().toString();

  return {
    privateStateProvider: levelPrivateStateProvider({
      privateStateStoreName: 'allowlist_stub-state',
      accountId,
      privateStoragePasswordProvider: () => privateStatePassword,
    }),
    publicDataProvider: indexerPublicDataProvider(networkConfig.indexer, networkConfig.indexerWS),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(networkConfig.proofServer, zkConfigProvider),
    walletProvider,
    midnightProvider: walletProvider,
  };
}

// ─── Main CLI ─────────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                   Ghostlist CLI                           ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  const rl = createInterface({ input: stdin, output: stdout });

  // Check for deployment
  const deployment = getDeployment(network);
  if (!deployment) {
    console.error(`No deploy on file for network ${network}. Run \`npm run setup -- --network ${network}\` first.`);
    process.exit(1);
  }
  console.log(`  Contract: ${deployment.address}`);
  console.log(`  Network: ${network}\n`);

  try {
    const seed = SEED;

    console.log('  Connecting to wallet...');
    const walletCtx = await createWallet({ network, networkConfig, seed });
    const restoredCount = Object.values(walletCtx.restored).filter(Boolean).length;
    if (restoredCount > 0) {
      console.log(`  Restored ${restoredCount}/3 child wallets from .midnight-wallet-state — sync will resume from saved point.`);
    }

    console.log('  Syncing with network...');
    console.log('  ℹ  This may take several minutes depending on network size.');
    console.log('     RPC disconnection messages during sync are normal and can be safely ignored.\n');
    const syncStart = Date.now();
    const syncInterval = setInterval(() => {
      const elapsed = Math.round((Date.now() - syncStart) / 1000);
      process.stdout.write(`\r  ⏳ Still syncing... (${elapsed}s elapsed)   `);
    }, 5000);
    const state = await walletCtx.wallet.waitForSyncedState();
    clearInterval(syncInterval);
    process.stdout.write('\r  ✓ Synced with network.                                      \n');

    await persistWalletState(network, walletCtx);
    const balance = state.unshielded.balances[unshieldedToken().raw] ?? 0n;
    console.log(`  Balance: ${balance.toLocaleString()} tNight\n`);

    if (balance === 0n && network !== 'undeployed' && networkConfig.faucet) {
      const address = walletCtx.unshieldedKeystore.getBech32Address();
      console.log('  ⚠ Wallet has no tNight. Fund it from the faucet to send transactions:');
      console.log(`     ${networkConfig.faucet}`);
      console.log(`     Wallet address: ${address}\n`);
    }

    // Setup providers (shared across mint attempts)
    const providers = await createProviders(walletCtx);

    // Connect to contract with the first tree entry (lazy — will reconnect
    // with the correct entry per mint attempt).
    async function connectWithEntry(entry: TreeEntry) {
      const cc = makeCompiledContract(entry);
      return await findDeployedContract(providers, {
        compiledContract: cc as any,
        contractAddress: deployment.address,
        privateStateId: PRIVATE_STATE_ID,
        initialPrivateState: {},
      }) as any;
    }

    console.log('  ✅ Providers ready!\n');

    // Interactive CLI loop
    let running = true;
    while (running) {
      console.log('─── Menu ───────────────────────────────────────────────────────');
      console.log('  1. Mint (submit proof via proof server)');
      console.log('  2. Read contract state');
      console.log('  3. Check wallet balance');
      console.log('  4. Exit\n');

      const choice = await rl.question('  Your choice: ');

      switch (choice.trim()) {
        case '1': {
          let tree = getTreeData();
          if (!tree || !tree.entries || tree.entries.length === 0) {
            console.log('\n  ❌ tree.json not found or empty. Run: npx tsx scripts/precompute-tree.ts > frontend/public/tree.json\n');
            break;
          }

          let success = false;
          for (let i = 0; i < tree.entries.length; i++) {
            const entryIndex = (_nextEntryIndex + i) % tree.entries.length;
            const entry = tree.entries[entryIndex];

            console.log(`\n  Trying entry ${entryIndex + 1}/${tree.entries.length}...`);
            try {
              const deployed = await connectWithEntry(entry);
              const tx = await deployed.callTx.mint();
              console.log(`\n  ✅ Mint successful!`);
              console.log(`  Tx ID: ${tx.public.txId}`);
              console.log(`  Block height: ${tx.public.blockHeight}\n`);
              _nextEntryIndex = (entryIndex + 1) % tree.entries.length;
              success = true;
              break;
            } catch (error) {
              const msg = error instanceof Error ? error.message : String(error);
              if (
                msg.includes('already-minted') ||
                msg.includes('Already minted') ||
                msg.includes('nullifier already used')
              ) {
                console.log(`  ⚠ Entry ${entryIndex + 1} already spent, trying next...`);
                continue;
              }
              // Non-nullifier error — surface and stop
              console.error(`\n  ❌ Mint failed:`, msg);
              break;
            }
          }
          if (!success) {
            console.log('\n  ❌ All allowlist entries have been spent. Generate a new tree and re-deploy.\n');
          }
          break;
        }

        case '2': {
          console.log('\n  Reading contract state from blockchain...');
          try {
            const contractState = await providers.publicDataProvider.queryContractState(deployment.address);
            if (contractState) {
              const ledgerState = HelloWorld.ledger(contractState.data);
              console.log(`\n  📋 Contract State:`);
              console.log(`     Merkle root:   ${ledgerState.merkleRoot.toString()}`);
              console.log(`     Total minted:  ${ledgerState.totalMinted.toString()}`);
              console.log(`     Nullifiers:    ${ledgerState.usedNullifiers.size} used\n`);
            } else {
              console.log('\n  📋 No contract state found\n');
            }
          } catch (error) {
            console.error('\n  ❌ Failed to read state:', error instanceof Error ? error.message : error);
          }
          break;
        }

        case '3': {
          console.log('\n  Checking balance...');
          const currentState = await walletCtx.wallet.waitForSyncedState();
          const currentBalance = currentState.unshielded.balances[unshieldedToken().raw] ?? 0n;
          const dustBalance = currentState.dust.balance(new Date());
          console.log(`\n  tNight: ${currentBalance.toLocaleString()}`);
          console.log(`  DUST:   ${dustBalance.toLocaleString()}\n`);
          break;
        }

        case '4':
          running = false;
          console.log('\n  👋 Goodbye!\n');
          break;

        default:
          console.log('\n  ❌ Invalid choice. Please enter 1-4.\n');
      }
    }

    await persistWalletState(network, walletCtx);
    await walletCtx.wallet.stop();
  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : error);
  } finally {
    rl.close();
  }
}

main().catch(console.error);
