/**
 * In-memory private state provider for browser use.
 *
 * Stores private state (which is just `{}` for the allowlist_stub contract)
 * in a Map. No encryption, no persistence — suitable for demo/dapp use where
 * the contract has no real private state (witnesses are supplied ad-hoc).
 */
import type { ContractAddress, SigningKey } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import type {
  PrivateStateId,
  PrivateStateProvider,
} from '@midnight-ntwrk/midnight-js-types';

export const inMemoryPrivateStateProvider = (): PrivateStateProvider => {
  const states = new Map<PrivateStateId, unknown>();
  const signingKeys = new Map<string, SigningKey>();
  let contractAddress: ContractAddress | undefined;

  return {
    setContractAddress(address: ContractAddress) {
      contractAddress = address;
    },

    async set(privateStateId: PrivateStateId, state: unknown) {
      states.set(privateStateId, state);
    },

    async get(privateStateId: PrivateStateId) {
      return (states.get(privateStateId) ?? null) as unknown as Promise<any>;
    },

    async remove(privateStateId: PrivateStateId) {
      states.delete(privateStateId);
    },

    async clear() {
      states.clear();
    },

    async setSigningKey(address: ContractAddress, key: SigningKey) {
      signingKeys.set(address.toString(), key);
    },

    async getSigningKey(address: ContractAddress) {
      return (signingKeys.get(address.toString()) ?? null) as unknown as Promise<any>;
    },

    async removeSigningKey(address: ContractAddress) {
      signingKeys.delete(address.toString());
    },

    async clearSigningKeys() {
      signingKeys.clear();
    },

    async exportPrivateStates() {
      throw new Error('exportPrivateStates not implemented in in-memory provider');
    },

    async importPrivateStates() {
      throw new Error('importPrivateStates not implemented in in-memory provider');
    },

    async exportSigningKeys() {
      throw new Error('exportSigningKeys not implemented in in-memory provider');
    },

    async importSigningKeys() {
      throw new Error('importSigningKeys not implemented in in-memory provider');
    },
  };
};
