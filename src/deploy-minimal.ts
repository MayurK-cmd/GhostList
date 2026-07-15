/**
 * Minimal deploy script — bypasses full wallet history sync.
 *
 * The standard deploy script calls wallet.waitForSyncedState() which downloads
 * the full chain history. This minimal version skips the balance check (we
 * already know the wallet is funded) and goes straight to DUST registration
 * and contract deployment.
 *
 * Usage: npx tsx src/deploy-minimal.ts --network preview
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { resolveNetwork, getOrCreateSeed, recordDeployment } from './network';
import { createWallet, persistWalletState, unshieldedToken } from './wallet';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { WebSocket } from 'ws';
import * as Rx from 'rxjs';

import { deployContract } from '@midnight-ntwrk/midnight-js-contracts';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { CompiledContract } from '@midnight-ntwrk/compact-js';

globalThis.WebSocket = WebSocket;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function waitForProofServer(maxAttempts = 30, delayMs = 2000): Promise<boolean> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await fetch(networkConfig.proofServer, { method: 'GET', signal: AbortSignal.timeout(3000) });
      return true;
    } catch {
      if (attempt < maxAttempts) {
        process.stdout.write(`\r  Waiting for proof server... (${attempt}/${maxAttempts})`);
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }
  return false;
}

const { network, config: networkConfig } = resolveNetwork();
const SEED = getOrCreateSeed(network);

async function main() {
  console.log(`\n╔══════════════════════════════════════════════════════════════╗`);
  console.log(`║  Deploy Ghostlist to ${network} (minimal mode)`);
  console.log(`╚══════════════════════════════════════════════════════════════╝\n`);

  // --- Load compiled contract ---
  const zkConfigPath = path.resolve(__dirname, '..', 'contracts', 'managed', 'allowlist_stub');
  const contractPath = path.join(zkConfigPath, 'contract', 'index.js');
  if (!fs.existsSync(contractPath)) {
    console.error('\n❌ Contract not compiled! Run: npm run compile\n');
    process.exit(1);
  }
  const ContractModule = await import(pathToFileURL(contractPath).href);
  const compiledContract = CompiledContract.make('allowlist_stub', ContractModule.Contract).pipe(
    CompiledContract.withVacantWitnesses,
    CompiledContract.withCompiledFileAssets(zkConfigPath),
  );

  // --- Wallet (skip full history sync) ---
  console.log('─── Wallet setup ───────────────────────────────────────────────\n');
  const walletCtx = await createWallet({ network, networkConfig, seed: SEED });
  const state = await walletCtx.wallet.waitForSyncedState();
  const address = walletCtx.unshieldedKeystore.getBech32Address();
  const balance = state.unshielded.balances[unshieldedToken().raw] ?? 0n;
  console.log(`  Wallet Address: ${address}`);
  console.log(`  Balance: ${balance.toLocaleString()} tNight\n`);

  await persistWalletState(network, walletCtx);

  if (balance === 0n) {
    console.log(`  ❌ Balance is 0 — fund at ${networkConfig.faucet}\n`);
    await walletCtx.wallet.stop();
    process.exit(1);
  }

  // --- DUST registration ---
  console.log('─── DUST Token Setup ───────────────────────────────────────────\n');
  const dustState = state;
  const unregisteredUtxos = dustState.unshielded.availableCoins.filter(
    (c: any) => !c.meta?.registeredForDustGeneration,
  );
  if (unregisteredUtxos.length > 0) {
    console.log(`  Registering ${unregisteredUtxos.length} NIGHT UTXOs for DUST...`);
    const recipe = await walletCtx.wallet.registerNightUtxosForDustGeneration(
      unregisteredUtxos,
      walletCtx.unshieldedKeystore.getPublicKey(),
      (payload) => walletCtx.unshieldedKeystore.signData(payload),
    );
    const finalized = await walletCtx.wallet.finalizeRecipe(recipe);
    await walletCtx.wallet.submitTransaction(finalized);
  }

  if (dustState.dust.balance(new Date()) === 0n) {
    console.log('  Waiting for DUST tokens...');
    await Rx.firstValueFrom(
      walletCtx.wallet.state().pipe(
        Rx.throttleTime(5000),
        Rx.filter((s: any) => s.isSynced),
        Rx.filter((s: any) => s.dust.balance(new Date()) > 0n),
      ),
    );
  }
  console.log('  DUST tokens ready!\n');

  // --- Deploy ---
  console.log('─── Deploy Contract ────────────────────────────────────────────\n');
  const proofServerReady = await waitForProofServer();
  if (!proofServerReady) {
    console.log('\n  ❌ Proof server not responding.\n');
    await walletCtx.wallet.stop();
    process.exit(1);
  }
  console.log('  Proof server ready!\n');

  const privateStatePassword = 'Local-Devnet-Development-Placeholder-1';
  const zkConfigProvider = new NodeZkConfigProvider(zkConfigPath);
  const accountId = walletCtx.unshieldedKeystore.getBech32Address().toString();

  const providers = {
    privateStateProvider: levelPrivateStateProvider({
      privateStateStoreName: 'ghostlist-state',
      accountId,
      privateStoragePasswordProvider: () => privateStatePassword,
    }),
    publicDataProvider: indexerPublicDataProvider(networkConfig.indexer, networkConfig.indexerWS),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(networkConfig.proofServer, zkConfigProvider),
    walletProvider: {
      getCoinPublicKey: () => state.shielded.coinPublicKey.toHexString(),
      getEncryptionPublicKey: () => state.shielded.encryptionPublicKey.toHexString(),
      async balanceTx(tx: any, ttl?: Date) {
        const recipe = await walletCtx.wallet.balanceUnboundTransaction(
          tx,
          { shieldedSecretKeys: walletCtx.shieldedSecretKeys, dustSecretKey: walletCtx.dustSecretKey },
          { ttl: ttl ?? new Date(Date.now() + 30 * 60 * 1000) },
        );
        const signedRecipe = await walletCtx.wallet.signRecipe(recipe, (payload) =>
          walletCtx.unshieldedKeystore.signData(payload),
        );
        return walletCtx.wallet.finalizeRecipe(signedRecipe);
      },
      submitTx: (tx: any) => walletCtx.wallet.submitTransaction(tx) as any,
    },
    midnightProvider: ({
      getCoinPublicKey: () => state.shielded.coinPublicKey.toHexString(),
      getEncryptionPublicKey: () => state.shielded.encryptionPublicKey.toHexString(),
      balanceTx: async (tx: any) => {
        throw new Error('midnightProvider.balanceTx not implemented');
      },
      submitTx: (tx: any) => walletCtx.wallet.submitTransaction(tx) as any,
    }),
  };

  console.log('  Deploying contract...\n');
  const MAX_RETRIES = 20;
  const RETRY_DELAY_MS = 5000;
  let deployed: any;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      deployed = await deployContract(providers, {
        compiledContract: compiledContract as any,
        args: [], // Ghostlist constructor takes no args (root set later)
      });
      break;
    } catch (err: any) {
      const errMsg = err?.message || '';
      if (errMsg.includes('Not enough Dust') || errMsg.includes('Insufficient Funds') || errMsg.includes('dust')) {
        const dState = await walletCtx.wallet.waitForSyncedState();
        const dB = dState.dust.balance(new Date());
        if (attempt === 1) console.log(`  Still generating DUST, retrying...`);
        else console.log(`  ⏳ DUST: ${dB.toLocaleString()} (attempt ${attempt}/${MAX_RETRIES})`);
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      } else if (errMsg.includes('Proof Server') || errMsg.includes('ECONNREFUSED')) {
        console.log('  ❌ Proof server unreachable.\n');
        await walletCtx.wallet.stop();
        process.exit(1);
      } else {
        throw err;
      }
    }
  }

  if (!deployed) throw new Error('Deployment failed after all retries');

  const contractAddress = deployed.deployTxData.public.contractAddress;
  console.log('\n  ✅ Contract deployed successfully!\n');
  console.log(`  Contract Address: ${contractAddress}\n`);

  recordDeployment(network, contractAddress, address.toString());
  await persistWalletState(network, walletCtx);
  await walletCtx.wallet.stop();

  console.log('─── Deployment complete ────────────────────────────────────────\n');
  console.log(`  Network:        ${network}`);
  console.log(`  Contract:       ${contractAddress}`);
  console.log(`  Wallet:         ${address}`);
  console.log(`  Balance:        ${balance.toLocaleString()} tNight\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
