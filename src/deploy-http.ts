/**
 * Deploy Ghostlist via direct HTTP RPC — no WebSocket wallet sync needed.
 *
 * Uses @polkadot/api's HTTP-based connection instead of WebSocket,
 * which avoids the subscribeRuntimeVersion issue on preprod.
 *
 * Usage: npx tsx src/deploy-http.ts --network preprod
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolveNetwork, getOrCreateSeed, recordDeployment } from './network';
import { WebSocket } from 'ws';

// Midnight SDK imports
import { deployContract } from '@midnight-ntwrk/midnight-js-contracts';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js';
import { setNetworkId, getNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import * as ledger from '@midnight-ntwrk/midnight-js-protocol/ledger';

globalThis.WebSocket = WebSocket;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { network, config: networkConfig } = resolveNetwork();
const SEED = getOrCreateSeed(network);

async function main() {
  console.log(`\n╔══════════════════════════════════════════════════╗`);
  console.log(`║  Deploy Ghostlist to ${network} (HTTP RPC)`);
  console.log(`╚══════════════════════════════════════════════════╝\n`);

  // 1. Load compiled contract
  const zkConfigPath = path.resolve(__dirname, '..', 'contracts', 'managed', 'allowlist_stub');
  const contractPath = path.join(zkConfigPath, 'contract', 'index.js');
  if (!fs.existsSync(contractPath)) {
    console.error('❌ Contract not compiled! Run: npm run compile\n');
    process.exit(1);
  }

  console.log('  Loading compiled contract...');
  const ContractModule = await import(pathToFileURL(contractPath).href);
  const compiledContract = CompiledContract.make('allowlist_stub', ContractModule.Contract).pipe(
    CompiledContract.withVacantWitnesses,
    CompiledContract.withCompiledFileAssets(zkConfigPath),
  );
  console.log('  ✅ Contract loaded\n');

  // 2. Set network ID
  setNetworkId(networkConfig.networkId);
  console.log(`  Network ID set to: ${getNetworkId()}`);

  // 3. Check proof server
  console.log('\n  Checking proof server...');
  try {
    const res = await fetch(networkConfig.proofServer, { signal: AbortSignal.timeout(5000) });
    console.log('  ✅ Proof server ready!\n');
  } catch (err: any) {
    console.error(`  ❌ Proof server unreachable at ${networkConfig.proofServer}`);
    console.error(`     Ensure the proof-server Docker container is running on port 6300.`);
    process.exit(1);
  }

  // 4. Check indexer reachable
  console.log('  Checking indexer...');
  try {
    const res = await fetch(networkConfig.indexer, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '{ __typename }' }),
      signal: AbortSignal.timeout(10000),
    });
    const data: any = await res.json();
    console.log(`  ✅ Indexer reachable: ${data?.data?.__typename}\n`);
  } catch (err: any) {
    console.error(`  ❌ Indexer unreachable: ${err?.message}`);
    process.exit(1);
  }

  // 5. Setup providers (minimal — wallet with minimal sync)
  const zkConfigProvider = new NodeZkConfigProvider(zkConfigPath);
  const privateStatePassword = 'Http-Deploy-Placeholder-1';

  const providers = {
    privateStateProvider: levelPrivateStateProvider({
      privateStateStoreName: 'ghostlist-http-deploy',
      accountId: 'http-deploy',
      privateStoragePasswordProvider: () => privateStatePassword,
    }),
    publicDataProvider: indexerPublicDataProvider(networkConfig.indexer, networkConfig.indexerWS),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(networkConfig.proofServer, zkConfigProvider),
    walletProvider: {
      getCoinPublicKey: () => {
        throw new Error('Not implemented in HTTP deploy');
      },
      getEncryptionPublicKey: () => {
        throw new Error('Not implemented in HTTP deploy');
      },
      balanceTx: async (tx: any, ttl?: Date) => {
        // Pass through — we expect the deployContract to handle this
        return tx;
      },
      submitTx: async (tx: any) => {
        // Submit via direct HTTP RPC call
        console.log('  Submitting transaction via HTTP RPC...');
        const res = await fetch(networkConfig.node, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'author_submitExtrinsic',
            params: [typeof tx === 'string' ? tx : tx.toHex?.() ?? String(tx)],
            id: 1,
          }),
        });
        const data: any = await res.json();
        if (data.error) throw new Error(`RPC error: ${data.error.message}`);
        return data.result;
      },
    },
    midnightProvider: {
      getCoinPublicKey: () => { throw new Error('Not implemented'); },
      getEncryptionPublicKey: () => { throw new Error('Not implemented'); },
      balanceTx: async (tx: any) => tx,
      submitTx: async (tx: any) => {
        const res = await fetch(networkConfig.node, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'author_submitExtrinsic',
            params: [typeof tx === 'string' ? tx : tx.toHex?.() ?? String(tx)],
            id: 1,
          }),
        });
        const data: any = await res.json();
        if (data.error) throw new Error(`RPC error: ${data.error.message}`);
        return data.result;
      },
    },
  };

  // 6. Deploy
  console.log('─── Deploy Contract ────────────────────────────────────────────\n');

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
      console.error(`  ✗ Error: ${msg.slice(0, 300)}`);
      if (msg.includes('proof') || msg.includes('Proof')) {
        console.error('  ❌ Proof server error — check Docker logs');
        break;
      }
      if (attempt < MAX_RETRIES) {
        console.log('  Retrying in 5s...\n');
        await new Promise(r => setTimeout(r, 5000));
      } else {
        throw err;
      }
    }
  }

  if (!deployed) {
    console.error('\n❌ Deployment failed');
    process.exit(1);
  }

  const contractAddress = deployed.deployTxData.public.contractAddress;
  console.log(`\n  ✅ ${'='.repeat(50)}`);
  console.log(`  ✅  Ghostlist deployed successfully!`);
  console.log(`  ✅ ${'='.repeat(50)}\n`);
  console.log(`  Contract: ${contractAddress}`);
  console.log(`  Network:  ${network}\n`);

  recordDeployment(network, contractAddress, `http-deploy-${network}`);
  console.log(`  Saved to .midnight-state.json\n`);
}

main().catch((err) => {
  console.error(`\n❌ Fatal: ${err?.message || err}`);
  process.exit(1);
});
