/**
 * Bypass deploy — submits the compiled contract via @polkadot/api directly,
 * bypassing the wallet SDK's WebSocket sync (which hangs on preprod).
 *
 * Usage: npx tsx src/deploy-direct.ts --network preprod
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolveNetwork, getOrCreateSeed, recordDeployment } from './network';
import { createWallet, persistWalletState } from './wallet';
import { WebSocket } from 'ws';

// Midnight SDK imports (new template pattern)
import { deployContract } from '@midnight-ntwrk/midnight-js-contracts';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js';

globalThis.WebSocket = WebSocket;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { network, config: networkConfig } = resolveNetwork();
const SEED = getOrCreateSeed(network);

async function main() {
  console.log(`\n╔══════════════════════════════════════════════════╗`);
  console.log(`║  Deploy Ghostlist to ${network} (direct RPC)`);
  console.log(`╚══════════════════════════════════════════════════╝\n`);

  // 1. Use @polkadot/api directly via RPC (HTTP, no WebSocket sync)
  const { ApiPromise, WsProvider } = await import('@polkadot/api');
  const WS_URL = networkConfig.node.replace(/^http/, 'ws').replace(/^https/, 'wss');

  console.log(`  Connecting to ${WS_URL}...`);
  const provider = new WsProvider(WS_URL, 5000);
  const api = await ApiPromise.create({ provider, throwOnConnect: false });

  // Wait for connection with timeout
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('WebSocket timeout')), 30000);
    const unsub = provider.on('connected', () => {
      clearTimeout(timeout);
      unsub();
      resolve();
    });
  });

  const chainName = await api.rpc.system.chain();
  const chainVersion = await api.rpc.system.version();
  console.log(`  Connected: ${chainName} v${chainVersion}\n`);

  // 2. Providers
  const zkConfigPath = path.resolve(__dirname, '..', 'contracts', 'managed', 'allowlist_stub');
  const contractPath = path.join(zkConfigPath, 'contract', 'index.js');
  if (!fs.existsSync(contractPath)) {
    console.error('❌ Contract not compiled! Run: npm run compile\n');
    process.exit(1);
  }

  const ContractModule = await import(pathToFileURL(contractPath).href);
  const compiledContract = CompiledContract.make('allowlist_stub', ContractModule.Contract).pipe(
    CompiledContract.withVacantWitnesses,
    CompiledContract.withCompiledFileAssets(zkConfigPath),
  );

  const zkConfigProvider = new NodeZkConfigProvider(zkConfigPath);

  const providers = {
    privateStateProvider: levelPrivateStateProvider({
      privateStateStoreName: 'ghostlist-direct',
      accountId: 'direct-deploy',
      privateStoragePasswordProvider: () => 'Direct-Deploy-Bypass-Placeholder-1',
    }),
    publicDataProvider: indexerPublicDataProvider(networkConfig.indexer, networkConfig.indexerWS),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(networkConfig.proofServer, zkConfigProvider),
    walletProvider: {
      getCoinPublicKey: () => { throw new Error('not used'); },
      getEncryptionPublicKey: () => { throw new Error('not used'); },
      balanceTx: async (tx: any) => tx,
      submitTx: async (tx: any) => {
        return api.rpc.author.submitExtrinsic(tx);
      },
    },
    midnightProvider: {
      getCoinPublicKey: () => { throw new Error('not used'); },
      getEncryptionPublicKey: () => { throw new Error('not used'); },
      balanceTx: async (tx: any) => tx,
      submitTx: async (tx: any) => {
        return api.rpc.author.submitExtrinsic(tx);
      },
    },
  };

  // 3. Check proof server
  console.log('  Checking proof server...');
  try {
    await fetch(networkConfig.proofServer, { signal: AbortSignal.timeout(5000) });
    console.log('  ✅ Proof server ready!\n');
  } catch {
    console.error('  ❌ Proof server not responding on', networkConfig.proofServer);
    process.exit(1);
  }

  // 4. Deploy
  console.log('─── Deploy Contract ────────────────────────────────────────────\n');

  const MAX_RETRIES = 5;
  let deployed: any;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      deployed = await deployContract(providers, {
        compiledContract: compiledContract as any,
        args: [0n],
      });
      if (deployed) break;
    } catch (err: any) {
      console.error(`  Attempt ${attempt} failed: ${err?.message?.slice(0, 200)}`);
      if (attempt < MAX_RETRIES) {
        console.log('  Retrying in 5s...');
        await new Promise(r => setTimeout(r, 5000));
      } else {
        throw err;
      }
    }
  }

  if (!deployed) throw new Error('Deployment failed after all retries');

  const contractAddress = deployed.deployTxData.public.contractAddress;
  console.log(`\n  ✅ ${'='.repeat(45)}`);
  console.log(`  ✅ Contract deployed successfully!`);
  console.log(`  ✅ ${'='.repeat(45)}\n`);
  console.log(`  Contract Address: ${contractAddress}`);
  console.log(`  Network:          ${network}\n`);

  // Save
  recordDeployment(network, contractAddress, `direct-rpc-${network}`);
  provider.disconnect();

  console.log(`  Saved to .midnight-state.json\n`);
  console.log(`  Done!\n`);
}

main().catch((err) => {
  console.error(`\n❌ Fatal: ${err?.message || err}`);
  process.exit(1);
});
