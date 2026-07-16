/**
 * Ghostlist deploy to preprod — follows official DUST generation guide.
 *
 * This script:
 *  1. Creates/restores a wallet from MIDNIGHT_WALLET_SEED env var
 *  2. Syncs with network (with emission logging)
 *  3. Registers NIGHT for DUST generation (with proper dustReceiver param)
 *  4. Deploys the Ghostlist contract
 *
 * Usage: MIDNIGHT_WALLET_SEED=<hex> npx tsx src/deploy-final.ts --network preprod
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { WebSocket } from 'ws';
import * as Rx from 'rxjs';
import { Buffer } from 'buffer';

(globalThis as any).WebSocket = WebSocket;

// Midnight SDK imports (using canoncial @midnightntwrk scope)
import { HDWallet, Roles, WalletFacade, ShieldedWallet, DustWallet, UnshieldedWallet, createKeystore, PublicKey, NoOpTransactionHistoryStorage, MidnightBech32m, DustAddress } from '@midnight-ntwrk/wallet-sdk';
import type { UnshieldedKeystore } from '@midnight-ntwrk/wallet-sdk';
import { deployContract } from '@midnight-ntwrk/midnight-js-contracts';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js';
import * as ledger from '@midnight-ntwrk/midnight-js-protocol/ledger';
import { unshieldedToken } from '@midnight-ntwrk/midnight-js-protocol/ledger';
import { setNetworkId, getNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import type { NetworkId } from './network';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Config ──────────────────────────────────────────────────────
const CONFIG = {
  networkId: 'preprod' as NetworkId,
  indexerHttpUrl: 'https://indexer.preprod.midnight.network/api/v4/graphql',
  indexerWsUrl: 'wss://indexer.preprod.midnight.network/api/v4/graphql/ws',
  node: 'https://rpc.preprod.midnight.network',
  proofServer: 'http://127.0.0.1:6300',
};

// ─── Helper ──────────────────────────────────────────────────────
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
const SYNC_TIMEOUT = 3_600_000; // 60 min

// ─── Derive keys ─────────────────────────────────────────────────
function deriveKeys(seed: string) {
  const hdWallet = HDWallet.fromSeed(Buffer.from(seed, 'hex'));
  if (hdWallet.type !== 'seedOk') throw new Error('Invalid seed');
  const result = hdWallet.hdWallet.selectAccount(0).selectRoles([Roles.Zswap, Roles.NightExternal, Roles.Dust]).deriveKeysAt(0);
  if (result.type !== 'keysDerived') throw new Error('Key derivation failed');
  hdWallet.hdWallet.clear();
  return result.keys;
}

// ─── Build wallet ────────────────────────────────────────────────
async function buildWallet(keys: ReturnType<typeof deriveKeys>) {
  setNetworkId(CONFIG.networkId);
  const networkId = getNetworkId();
  const shieldedSecretKeys = ledger.ZswapSecretKeys.fromSeed(keys[Roles.Zswap]);
  const dustSecretKey = ledger.DustSecretKey.fromSeed(keys[Roles.Dust]);
  const unshieldedKeystore = createKeystore(keys[Roles.NightExternal], networkId);

  const sharedConfig = {
    networkId,
    indexerClientConnection: { indexerHttpUrl: CONFIG.indexerHttpUrl, indexerWsUrl: CONFIG.indexerWsUrl },
    provingServerUrl: new URL(CONFIG.proofServer),
    relayURL: new URL(CONFIG.node.replace(/^https/, 'wss')),
  };

  const wallet = await WalletFacade.init({
    configuration: {
      ...sharedConfig,
      costParameters: { additionalFeeOverhead: 300_000_000_000_000n, feeBlocksMargin: 5 },
      txHistoryStorage: new NoOpTransactionHistoryStorage(),
    },
    shielded: (cfg: any) => ShieldedWallet(cfg).startWithSecretKeys(shieldedSecretKeys),
    unshielded: (cfg: any) => UnshieldedWallet(cfg).startWithPublicKey(PublicKey.fromKeyStore(unshieldedKeystore)),
    dust: (cfg: any) => DustWallet(cfg).startWithSecretKey(dustSecretKey, ledger.LedgerParameters.initialParameters().dust),
  });
  await wallet.start(shieldedSecretKeys, dustSecretKey);
  return { wallet, shieldedSecretKeys, dustSecretKey, unshieldedKeystore };
}

// ─── Main ────────────────────────────────────────────────────────
async function main() {
  console.log(`\n╔══════════════════════════════════════════════════╗`);
  console.log(`║  Deploy Ghostlist to ${CONFIG.networkId} (final)`);
  console.log(`╚══════════════════════════════════════════════════╝\n`);

  // 1. Load compiled contract
  const zkConfigPath = path.resolve(__dirname, '..', 'contracts', 'managed', 'allowlist_stub');
  const contractPath = path.join(zkConfigPath, 'contract', 'index.js');
  if (!fs.existsSync(contractPath)) {
    console.error('❌ Contract not compiled! Run: npm run compile\n'); process.exit(1);
  }
  const ContractModule = await import(pathToFileURL(contractPath).href);
  const compiledContract = CompiledContract.make('allowlist_stub', ContractModule.Contract).pipe(
    CompiledContract.withWitnesses({
      secret: (ctx: any) => { throw new Error('secret witness must be provided'); },
      merklePath: (ctx: any) => { throw new Error('merklePath witness must be provided'); },
    }),
    CompiledContract.withCompiledFileAssets(zkConfigPath),
  );

  // 2. Seed
  const seed = process.env.MIDNIGHT_WALLET_SEED;
  if (!seed) { console.error('❌ Set MIDNIGHT_WALLET_SEED env var\n'); process.exit(1); }
  console.log(`  Using provided wallet seed\n`);

  // 3. Build wallet
  console.log('─── Wallet ────────────────────────────────────────────────\n');
  const keys = deriveKeys(seed);
  const { wallet, unshieldedKeystore, shieldedSecretKeys, dustSecretKey } = await buildWallet(keys);
  const address = unshieldedKeystore.getBech32Address();
  console.log(`  Address: ${address}\n`);

  // 4. Sync (verbose)
  console.log('  Syncing...');
  const syncStart = Date.now();
  let emCount = 0;
  await Rx.firstValueFrom(wallet.state().pipe(
    Rx.tap((s: any) => { emCount++; if (emCount % 100 === 0) { process.stdout.write(`\r  Emissions: ${emCount}`); } }),
    Rx.filter((s: any) => {
      const shielded = s.shielded?.state?.progress?.isStrictlyComplete() ?? false;
      const unshielded = s.unshielded?.progress?.isStrictlyComplete() ?? false;
      return shielded && unshielded;
    }),
    Rx.timeout({ each: SYNC_TIMEOUT, with: () => Rx.throwError(() => new Error('Sync timeout')) }),
  ));
  console.log(`\r  ✅ Synced (${emCount} emissions, ${Math.round((Date.now()-syncStart)/1000)}s)\n`);

  // 5. Check balances
  const state = await Rx.firstValueFrom(wallet.state());
  const nightBal = state.unshielded.balances[unshieldedToken().raw] ?? 0n;
  let dustBal = state.dust.balance(new Date());
  console.log(`  tNIGHT: ${nightBal}`);
  console.log(`  DUST:   ${dustBal}\n`);

  // 6. Register for DUST if needed
  if (nightBal > 0n && dustBal === 0n) {
    console.log('─── DUST Registration ─────────────────────────────────────\n');
    const dustPublicKey = state.dust.publicKey;
    const ownDustAddr = DustAddress.encodePublicKey(getNetworkId(), dustPublicKey);
    console.log(`  Dust address: ${ownDustAddr}`);

    const unreg = state.unshielded.availableCoins.filter((c: any) => !c.meta?.registeredForDustGeneration);
    if (unreg.length > 0) {
      const dustReceiver = MidnightBech32m.parse(ownDustAddr).decode(DustAddress, getNetworkId());
      console.log(`  Registering ${unreg.length} UTXO(s) for DUST...`);
      const recipe = await wallet.registerNightUtxosForDustGeneration(
        unreg, unshieldedKeystore.getPublicKey(),
        (payload: any) => unshieldedKeystore.signData(payload),
        dustReceiver,
      );
      const finalized = await wallet.finalizeRecipe(recipe);
      await wallet.submitTransaction(finalized);
      console.log('  ✅ Registration submitted\n');
    }

    // Wait for DUST
    console.log('  Waiting for DUST (1-2 min)...');
    try {
      await Rx.firstValueFrom(wallet.state().pipe(
        Rx.throttleTime(5000), Rx.filter((s: any) => s.isSynced),
        Rx.filter((s: any) => s.dust.balance(new Date()) > 0n),
        Rx.timeout({ each: 600_000, with: () => Rx.throwError(() => new Error('DUST timeout')) }),
      ));
      const newState = await Rx.firstValueFrom(wallet.state());
      dustBal = newState.dust.balance(new Date());
      console.log(`  ✅ DUST balance: ${dustBal}\n`);
    } catch {
      console.log('  ⚠ DUST not received after 5 min — deploying anyway\n');
    }
  } else if (dustBal > 0n) {
    console.log(`  ✅ Already have DUST: ${dustBal}\n`);
  }

  // 7. Check proof server
  console.log('─── Deploy ────────────────────────────────────────────────\n');
  try {
    await fetch(CONFIG.proofServer, { signal: AbortSignal.timeout(5000) });
    console.log('  ✅ Proof server ready\n');
  } catch {
    console.error('  ❌ Proof server not running on', CONFIG.proofServer); process.exit(1);
  }

  // 8. Deploy
  const zkConfigProvider = new NodeZkConfigProvider(zkConfigPath);
  const accountId = address.toString();

  const providers = {
    privateStateProvider: levelPrivateStateProvider({
      privateStateStoreName: 'ghostlist-final', accountId,
      privateStoragePasswordProvider: () => 'Ghostlist-Final-Deploy-Placeholder!',
    }),
    publicDataProvider: indexerPublicDataProvider(CONFIG.indexerHttpUrl, CONFIG.indexerWsUrl),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(CONFIG.proofServer, zkConfigProvider),
    walletProvider: {
      getCoinPublicKey: () => shieldedSecretKeys.coinPublicKey,
      getEncryptionPublicKey: () => shieldedSecretKeys.encryptionPublicKey,
      balanceTx: async (tx: any, ttl?: Date) => {
        const recipe = await wallet.balanceUnboundTransaction(tx,
          { shieldedSecretKeys, dustSecretKey },
          { ttl: ttl ?? new Date(Date.now() + 30 * 60 * 1000) });
        return wallet.finalizeRecipe(recipe);
      },
      submitTx: (tx: any) => wallet.submitTransaction(tx) as any,
    },
    midnightProvider: {
      getCoinPublicKey: () => shieldedSecretKeys.coinPublicKey,
      getEncryptionPublicKey: () => shieldedSecretKeys.encryptionPublicKey,
      balanceTx: async (tx: any) => tx,
      submitTx: (tx: any) => wallet.submitTransaction(tx) as any,
    },
  };

  const MAX_RETRIES = 5;
  let deployed: any;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`  Attempt ${attempt}/${MAX_RETRIES}...`);
      deployed = await deployContract(providers, {
        compiledContract: compiledContract as any,
        args: [0n],
      });
      break;
    } catch (err: any) {
      const msg = err?.message || '';
      console.error(`  ✗ ${msg.slice(0, 200)}`);
      if (attempt < MAX_RETRIES) { console.log('  Retry in 5s...\n'); await wait(5000); }
      else throw err;
    }
  }

  if (!deployed) throw new Error('Deploy failed');

  const contractAddress = deployed.deployTxData.public.contractAddress;
  console.log(`\n  ✅ ${'='.repeat(45)}`);
  console.log(`  ✅ Ghostlist deployed!`);
  console.log(`  ✅ ${'='.repeat(45)}\n`);
  console.log(`  Contract: ${contractAddress}`);
  console.log(`  Network:  ${CONFIG.networkId}\n`);

  // Save
  const stateFile = path.resolve(__dirname, '..', '.midnight-state.json');
  const stateData = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
  stateData.deployments = { ...stateData.deployments, [CONFIG.networkId]: { address: contractAddress, deployer: address.toString(), deployedAt: new Date().toISOString() } };
  fs.writeFileSync(stateFile, JSON.stringify(stateData, null, 2) + '\n');
  console.log('  ✅ State saved\n');

  await wallet.stop();
  console.log('  Done!\n');
}

main().catch((err) => { console.error(err); process.exit(1); });
