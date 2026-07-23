# Product Proposal

What is the product and who is it for?

Ghostlist is a private allowlist mint gate for NFT and token drops. Instead of exposing your allowlist publicly on-chain - a transparent mapping from eligible wallet address to eligibility - your allowlist contents are never committed to the public blockchain. Only a cryptographic hash commitment to the allowlist is posted, and then the user comes to claim, proving they are eligible without revealing any personal information or their specific position on the list through a zero-knowledge proof performed at mint time.

This is the solution for a common pain point in web3 releases: public allowlists serve to announce who’s in the know to phishers and scam artists. Before an NFT collection even begins its drop, participants find themselves flooded with direct messages, potential hacks and wallet draining scams and social attacks. Ghostlist helps any project releasing an NFT collection, a token, an allow-listed airdrop, or a membership community provide benefits or perks to a specific set of supporters without publicly broadcasting exactly who those individuals are. Any allowlisted person that has claimed their spot privately can use Ghostlist.

Why Midnight specifically?

A publicly-transparent chain may be able to determine eligibility with a smart contract that reads an allowlist, but it can only ever prove it to do so by revealing the entire allowlist and potentially the mapping from user-to-spot. This allows public visibility-or at least an open record of who belongs to the group-which is precisely the problem we address. If you use a standard smart contractchain, there is no native way to confirm the identity of an in-range individual against an in-group set without either exposing your members publicly, or delegating the task to a centralized server, which presents a new surveillance and point-of-failure risk.

Midnight provides the ability for an on-chain contract to enforce eligibility for members of a specific set without disclosing any information whatsoever about member identities. We place the allowlist commitment in the contract in the form of a Merkle commitment (a commitment to the hash of the whole list). Our smart contract has the mint function that allows users to submit a proof, the verification for which is fully satisfied by the contract, that their private witness (a key, combined with Merkle proof) exists in the set of valid members (linked to the Merkle commitment committed onto the blockchain).

A user is prevented from double minting by providing a nullifier tied to their secretkey which is added to a publicset onchain.

It is only revealed as part of a proofand can notbe directly linked to any individual.

Data Model

Ghostlist is a private allowlist minting system where the smart contract doesn’t hold the actual list itself-it instead references a commitment to it. When a user mints, a “nullifier” (a one-way cryptographic hash) is publicly committed to an on-chain set that proves the wallet was verified but does not reveal identity.

|DataPoint|Type|DisclosedTo|

|---|---|---|

|merkleRoot| Publicledger(Field)| Everyone - commits the allow list without revealing its entries|
|usedNullifiers| Publicledger(Set\\>)| Everyone - prevents double-mints|
|totalMints| Publicledger(Counter)| Everyone - number of successfully made mints|
|nullifier| Circuit output (disclose())| Everyone - persistentHash(leaf) that proves identity privately|
|secret| Private witness (Bytes\<32\>)| No one - user’s private key within the allowlist, never leaves user’s device|
|leaf|Private witness / computed | No one - persistentHash(secret), is checked as part of Merkle proof|
|merklePath| Privatewitness(MerkleTreePath\<20, Bytes\<32\>\>)| No one - Merkle membership proof that binds leafto committedroot|

Mainnet Feasibility

Ghostlist has a clear path to mainnet by Level 6. All of the required core logic, from Merkle tree membership proofing through nullifier-based double mint prevention has been constructed and proven throughout the entire lifecycle in our Preview deployment, includingWallet Connect (local key generation, on-chain verification, privacy in observable outcomes) . Therefore, the effort between the current day and Mainnet consists primarily in preparing the product for wider adoption-the security measures already include the option to transition out of demo mode for every transaction , providing comprehensive error management capabilities, learning how real users engage with the product throughout the Full Moon phase, and simply preparing the same contract to be redeployed as Supermoon. Because the hard security mechanisms and primitives we rely on arealready validated,the project is well-scoped to be completed and launched successfully within program limitations.