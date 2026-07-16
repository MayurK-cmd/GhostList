/**
 * Verbose deploy — logs sync emissions so we can see progress.
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
import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js';

globalThis.WebSocket = WebSocket;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PRIVATE_STATE_ID = 'ghostlistPrivateState';
const { network, config: networkConfig } = resolveNetwork();
const SEED = getOrCreateSeed(network);

async function waitForProofServer(maxAttempts = 30, delayMs = 2000): Promise<boolean> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await fetch(networkConfig.proofServer, { method: 'GET', signal: AbortSignal.timeout(3000) });
      return true;
    } catch {
      if (attempt < maxAttempts) {
        process.stdout.write(`\r  Waiting for proof server... (${attempt}/${maxAttempts})`);
        await new Promise(r => setTimeout(r, delayMs));
      }
    }
  }
  return false;
}

async function main() {
  console.log(`\n╔══════════════════════════════════════════════════╗`);
  console.log(`║  Deploy Ghostlist to ${network} (verbose)`);
  console.log(`╚══════════════════════════════════════════════════╝\n`);

  // Load contract
  const zkConfigPath = path.resolve(__dirname, '..', 'contracts', 'managed', 'allowlist_stub');
  const contractPath = path.join(zkConfigPath, 'contract', 'index.js');
  if (!fs.existsSync(contractPath)) {
    console.error('❌ Contract not compiled! Run: npm run compile\n');
    process.exit(1);
  }

  const ContractModule = await import(pathToFileURL(contractPath).href);
  const witnesses = {
    secret: (ctx: any) => { throw new Error('secret witness must be provided'); },
    merklePath: (ctx: any) => { throw new Error('merklePath witness must be provided'); },
  };
  const compiledContract = CompiledContract.make('allowlist_stub', ContractModule.Contract).pipe(
    CompiledContract.withWitnesses(witnesses),
    CompiledContract.withCompiledFileAssets(zkConfigPath),
  );

  // Wallet with verbose sync
  console.log('─── Wallet setup ───────────────────────────────────────────────\n');
  const walletCtx = await createWallet({ network, networkConfig, seed: SEED });

  // Verbose sync: subscribe to state emissions
  console.log('  Syncing with network (verbose)...');
  let emissionCount = 0;
  const syncStart = Date.now();

  const syncedState = await Rx.firstValueFrom(
    walletCtx.wallet.state().pipe(
      Rx.tap((state: any) => {
        emissionCount++;
        if (emissionCount % 50 === 1 || emissionCount % 50 === 0) {
          const elapsed = Math.round((Date.now() - syncStart) / 1000);
          const shielded = state.shielded?.state?.progress?.isStrictlyComplete() ?? '?';
          const unshielded = state.unshielded?.progress?.isStrictlyComplete() ?? '?';
          const dust = state.dust?.state?.progress?.isStrictlyComplete() ?? '?';
          const shieldedCoins = state.shielded?.availableCoins?.length ?? '?';
          const unshieldedUtxos = state.unshielded?.availableCoins?.length ?? '?';
          process.stdout.write(`\r  ⏳ [${emissionCount} em, ${elapsed}s] S=${shielded} U=${unshielded} D=${dust} (utxos: ${unshieldedUtxos})`);
        }
      }),
      Rx.filter((state: any) => {
        // Only wait for shielded + unshielded (dust might never sync fully on remote)
        const shielded = state.shielded?.state?.progress?.isStrictlyComplete() ?? false;
        const unshielded = state.unshielded?.progress?.isStrictlyComplete() ?? false;
        const dust = state.dust?.state?.progress?.isStrictlyComplete() ?? false;
        return shielded && unshielded;
      }),
      Rx.timeout({
        each: 3_600_000, // 60 min
        with: () => Rx.throwError(() => new Error(`Sync timeout after ${Math.round((Date.now() - syncStart) / 1000)}s (${emissionCount} emissions)`)),
      }),
    ),
  );

  const syncTime = Math.round((Date.now() - syncStart) / 1000);
  process.stdout.write(`\r  ✓ Synced after ${emissionCount} emissions (${syncTime}s)\n`);

  await persistWalletState(network, walletCtx);

  const address = walletCtx.unshieldedKeystore.getBech32Address();
  const balance = syncedState.unshielded.balances[unshieldedToken().raw] ?? 0n;
  console.log(`\n  Wallet Address: ${address}`);
  console.log(`  Balance: ${balance.toLocaleString()} tNight\n`);

  // Fund check for remote networks
  if (network !== 'undeployed' && networkConfig.faucet && balance === 0n) {
    console.log('─── Fund Wallet ────────────────────────────────────────────────\n');
    console.log(`  Address: ${address}`);
    console.log(`  Faucet:  ${networkConfig.faucet}`);
    console.log('\n  Waiting for tNIGHT (poll every 10s)...');
    const start = Date.now();
    while (true) {
      await new Promise(r => setTimeout(r, 10_000));
      const s = await Rx.firstValueFrom(walletCtx.wallet.state().pipe(Rx.filter((x: any) => x.isSynced)));
      const tn = s.unshielded.balances[unshieldedToken().raw] ?? 0n;
      if (tn > 0n) { console.log(`\n  Funded! Balance: ${tn.toLocaleString()}\n`); break; }
      if (Date.now() - start > 3_600_000) {
        console.log(`\n  ❌ Funding timeout. Address: ${address}\n`);
        await walletCtx.wallet.stop(); process.exit(1);
      }
    }
  }

  // DUST
  console.log('─── DUST Token Setup ───────────────────────────────────────────\n');
  const dustState = syncedState;
  const unregisteredUtxos = dustState.unshielded.availableCoins.filter((c: any) => !c.meta?.registeredForDustGeneration);
  if (unregisteredUtxos.length > 0) {
    console.log(`  Registering ${unregisteredUtxos.length} UTXOs for DUST...`);
    const recipe = await walletCtx.wallet.registerNightUtxosForDustGeneration(
      unregisteredUtxos, walletCtx.unshieldedKeystore.getPublicKey(),
      (payload: any) => walletCtx.unshieldedKeystore.signData(payload),
    );
    await walletCtx.wallet.finalizeRecipe(recipe).then((tx: any) => walletCtx.wallet.submitTransaction(tx));
  }
  const dustBal = dustState.dust.balance(new Date());
  console.log(`  DUST balance: ${dustBal}`);
  if (dustBal === 0n) {
    // Wait up to 10 minutes for DUST to generate after registration
    console.log('  Waiting up to 30 min for DUST to generate...');
    try {
      await Rx.firstValueFrom(walletCtx.wallet.state().pipe(
        Rx.throttleTime(5000),
        Rx.filter((s: any) => s.isSynced),
        Rx.filter((s: any) => s.dust.balance(new Date()) > 0n),
        Rx.timeout({ each: 1_800_000, with: () => Rx.throwError(() => new Error('DUST timeout')) }),
      ));
      console.log('  DUST received!\n');
    } catch {
      console.log('  Proceeding without DUST (deploy may fail)\n');
    }
  } else {
    console.log('  DUST ready!\n');
  }

  // Deploy
  console.log('─── Deploy Contract ────────────────────────────────────────────\n');
  const proofServerReady = await waitForProofServer();
  if (!proofServerReady) { console.log('  ❌ Proof server not responding.\n'); await walletCtx.wallet.stop(); process.exit(1); }
  console.log('  Proof server ready!\n');

  const privateStatePassword = 'Local-Devnet-Development-Placeholder-1';
  const zkConfigProvider = new NodeZkConfigProvider(zkConfigPath);
  const accountId = walletCtx.unshieldedKeystore.getBech32Address().toString();

  const providers = {
    privateStateProvider: levelPrivateStateProvider({
      privateStateStoreName: 'ghostlist-verbose-state', accountId,
      privateStoragePasswordProvider: () => privateStatePassword,
    }),
    publicDataProvider: indexerPublicDataProvider(networkConfig.indexer, networkConfig.indexerWS),
    zkConfigProvider, proofProvider: httpClientProofProvider(networkConfig.proofServer, zkConfigProvider),
    walletProvider: {
      getCoinPublicKey: () => walletCtx.shieldedSecretKeys.coinPublicKey,
      getEncryptionPublicKey: () => walletCtx.shieldedSecretKeys.encryptionPublicKey,
      async balanceTx(tx: any, ttl?: Date) {
        const recipe = await walletCtx.wallet.balanceUnboundTransaction(tx,
          { shieldedSecretKeys: walletCtx.shieldedSecretKeys, dustSecretKey: walletCtx.dustSecretKey },
          { ttl: ttl ?? new Date(Date.now() + 30 * 60 * 1000) });
        return walletCtx.wallet.finalizeRecipe(recipe);
      }, submitTx: (tx: any) => walletCtx.wallet.submitTransaction(tx) as any,
    },
    midnightProvider: {
      getCoinPublicKey: () => walletCtx.shieldedSecretKeys.coinPublicKey,
      getEncryptionPublicKey: () => walletCtx.shieldedSecretKeys.encryptionPublicKey,
    },
  };

  console.log('  Deploying contract...');
  const MAX_RETRIES = 20;
  let deployed: any;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      deployed = await deployContract(providers, {
        compiledContract: compiledContract as any,
        privateStateId: PRIVATE_STATE_ID,
        initialPrivateState: {},
        args: [0n],
      });
      break;
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.includes('dust') || msg.includes('Dust')) {
        console.log(`  ⏳ Waiting for DUST (attempt ${attempt}/${MAX_RETRIES})`);
        await new Promise(r => setTimeout(r, 5000));
      } else { console.error(`  ✗ ${msg.slice(0, 200)}`); throw err; }
    }
  }

  if (!deployed) throw new Error('Deploy failed');

  const contractAddress = deployed.deployTxData.public.contractAddress;
  console.log(`\n  ✅ ${'='.repeat(45)}`);
  console.log(`  ✅ Contract deployed successfully!`);
  console.log(`  ✅ ${'='.repeat(45)}\n`);
  console.log(`  Contract: ${contractAddress}`);
  console.log(`  Network:  ${network}\n`);

  recordDeployment(network, contractAddress, address.toString());
  await persistWalletState(network, walletCtx);
  await walletCtx.wallet.stop();

  console.log(`  Saved to .midnight-state.json\n`);
  console.log(`  Done!\n`);
}

main().catch((err) => { console.error(err); process.exit(1); });
