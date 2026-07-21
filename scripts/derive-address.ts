import { HDWallet, Roles, createKeystore } from '@midnight-ntwrk/wallet-sdk';
import { setNetworkId, getNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { Buffer } from 'buffer';

const network = process.argv[2] || 'preprod';
setNetworkId(network);

const seed = '3df3eed71d2a3e0a9ff829e262599c18322bd17c1244c41dbe23b4743c5295772dd60e0dc7c282c2b4ac4592c4248c06e85ea12e35005b31ab02560795a61620';
const hdWallet = HDWallet.fromSeed(Buffer.from(seed, 'hex'));
if (hdWallet.type !== 'seedOk') { console.error('Invalid seed'); process.exit(1); }
const keys = hdWallet.hdWallet
  .selectAccount(0)
  .selectRoles([Roles.Zswap, Roles.NightExternal, Roles.Dust])
  .deriveKeysAt(0);
if (keys.type !== 'keysDerived') { console.error('Key derivation failed'); process.exit(1); }
const keystore = createKeystore(keys.keys[Roles.NightExternal], getNetworkId());
console.log(`${network} address:`, keystore.getBech32Address().toString());
hdWallet.hdWallet.clear();
