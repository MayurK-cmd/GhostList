/**
 * Browser-based ZK config provider that loads artifacts from the app's own
 * public directory via fetch.  Matches the directory layout expected by
 * NodeZkConfigProvider:
 *
 *   public/keys/<circuitId>.prover
 *   public/keys/<circuitId>.verifier
 *   public/zkir/<circuitId>.bzkir
 *
 * The `baseUrl` defaults to the app origin so artifacts are served from
 * the same host as the frontend.
 */
import { ZKConfigProvider, createProverKey, createVerifierKey, createZKIR } from '@midnight-ntwrk/midnight-js-types';

const KEY_PATH = 'keys';
const PROVER_EXT = '.prover';
const VERIFIER_EXT = '.verifier';
const ZKIR_PATH = 'zkir';
const ZKIR_EXT = '.bzkir';

export class BrowserZkConfigProvider<K extends string> extends ZKConfigProvider<K> {
  readonly baseUrl: string;

  constructor(baseUrl?: string) {
    super();
    this.baseUrl = (baseUrl ?? window.location.origin).replace(/\/+$/, '');
  }

  private async fetchBinary(path: string): Promise<Uint8Array> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch ZK artifact: ${url} (${response.status})`);
    }
    return new Uint8Array(await response.arrayBuffer());
  }

  async getProverKey(circuitId: K) {
    const bytes = await this.fetchBinary(`/${KEY_PATH}/${circuitId}${PROVER_EXT}`);
    return createProverKey(bytes);
  }

  async getVerifierKey(circuitId: K) {
    const bytes = await this.fetchBinary(`/${KEY_PATH}/${circuitId}${VERIFIER_EXT}`);
    return createVerifierKey(bytes);
  }

  async getZKIR(circuitId: K) {
    const bytes = await this.fetchBinary(`/${ZKIR_PATH}/${circuitId}${ZKIR_EXT}`);
    return createZKIR(bytes);
  }
}
