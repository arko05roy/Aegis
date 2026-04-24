import { Indexer, MemData } from '@0gfoundation/0g-ts-sdk';
import { ethers } from 'ethers';

const ZEROG_RPC = process.env.ZEROG_TESTNET_RPC || 'https://evmrpc-testnet.0g.ai';
const INDEXER_RPC = process.env.ZEROG_INDEXER_RPC || 'https://indexer-storage-testnet-turbo.0g.ai';

export class ZeroGStorage {
  private indexer: Indexer;
  private signer: ethers.Wallet;

  constructor(privateKey: string) {
    const provider = new ethers.JsonRpcProvider(ZEROG_RPC);
    this.signer = new ethers.Wallet(privateKey, provider);
    this.indexer = new Indexer(INDEXER_RPC);
  }

  async uploadProof(proofData: Uint8Array): Promise<string> {
    const memData = new MemData(proofData);
    const [tree, treeErr] = await memData.merkleTree();
    if (treeErr !== null) {
      throw new Error(`Merkle tree error: ${treeErr}`);
    }

    const rootHash = tree?.rootHash();
    console.log(`[0G Storage] Uploading proof, root: ${rootHash}`);

    const [tx, uploadErr] = await this.indexer.upload(memData, ZEROG_RPC, this.signer);
    if (uploadErr !== null) {
      throw new Error(`Upload error: ${uploadErr}`);
    }

    console.log(`[0G Storage] Upload complete, tx: ${JSON.stringify(tx)}`);
    return rootHash!;
  }

  async downloadProof(rootHash: string, outputPath: string): Promise<void> {
    const err = await this.indexer.download(rootHash, outputPath, true);
    if (err !== null) {
      throw new Error(`Download error: ${err}`);
    }
  }

  async uploadMemory(agentId: string, memoryState: object): Promise<string> {
    const data = new TextEncoder().encode(JSON.stringify({
      agentId,
      timestamp: Date.now(),
      state: memoryState,
    }));
    return this.uploadProof(data);
  }
}

export async function verifyStorageSetup(): Promise<boolean> {
  console.log('[0G Storage] Verifying setup...');

  const provider = new ethers.JsonRpcProvider(ZEROG_RPC);
  const blockNumber = await provider.getBlockNumber();
  console.log(`[0G Storage] Connected to 0G testnet, block: ${blockNumber}`);

  new Indexer(INDEXER_RPC);
  console.log('[0G Storage] Indexer connected');

  return true;
}
