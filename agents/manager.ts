// agents/manager.ts
import { FiatAgent } from './fiat-agent';
import { CryptoAgent } from './crypto-agent';

export interface AgentPair {
  fiat: FiatAgent;
  crypto: CryptoAgent;
  walletAddress: string;
  createdAt: number;
}

export interface AgentStatus {
  walletAddress: string;
  fiatPubkey: string;
  cryptoPubkey: string;
  isRunning: boolean;
  createdAt: number;
}

const WEBHOOK_URL = process.env.WEBHOOK_RECEIVER_URL || 'http://127.0.0.1:4001/webhook/payment';

class AgentManager {
  private agents: Map<string, AgentPair> = new Map();
  private lpAgents: Map<string, CryptoAgent> = new Map();

  async getOrCreate(
    walletAddress: string,
    privateKey: string,
    rpcUrl: string,
    axlPort: number = 9002
  ): Promise<AgentPair> {
    const existing = this.agents.get(walletAddress.toLowerCase());
    if (existing) return existing;

    const fiat = new FiatAgent({
      name: `fiat-${walletAddress.slice(0, 8)}`,
      privateKey,
      rpcUrl,
      axlPort,
      supportedRails: ['banksim', 'upi', 'venmo'],
      demoMode: true,
      webhookUrl: WEBHOOK_URL,
    });

    const crypto = new CryptoAgent({
      name: `crypto-${walletAddress.slice(0, 8)}`,
      privateKey,
      rpcUrl,
      axlPort,
      inventory: [
        { token: 'ETH', balance: '10', minOrder: '0.01' },
        { token: 'USDC', balance: '10000', minOrder: '1' },
      ],
      spreadBps: 50,
      supportedRails: ['banksim', 'upi', 'venmo'],
      fiatDetails: {
        banksim: { account: 'lp@banksim' },
        upi: { vpa: 'lp@upi' },
        venmo: { handle: '@lp-venmo' },
      },
    });

    await fiat.initialize();
    await crypto.initialize();

    fiat.start();
    crypto.start();

    const pair: AgentPair = {
      fiat,
      crypto,
      walletAddress: walletAddress.toLowerCase(),
      createdAt: Date.now(),
    };

    this.agents.set(walletAddress.toLowerCase(), pair);
    this.lpAgents.set(await crypto.getAXLPublicKey(), crypto);

    console.log(`[AgentManager] Created agent pair for ${walletAddress}`);
    return pair;
  }

  get(walletAddress: string): AgentPair | undefined {
    return this.agents.get(walletAddress.toLowerCase());
  }

  async getStatus(walletAddress: string): Promise<AgentStatus | null> {
    const pair = this.agents.get(walletAddress.toLowerCase());
    if (!pair) return null;

    return {
      walletAddress: pair.walletAddress,
      fiatPubkey: await pair.fiat.getAXLPublicKey(),
      cryptoPubkey: await pair.crypto.getAXLPublicKey(),
      isRunning: true,
      createdAt: pair.createdAt,
    };
  }

  listLPAgents(): { pubkey: string; address: string }[] {
    const result: { pubkey: string; address: string }[] = [];
    for (const [pubkey, agent] of this.lpAgents) {
      result.push({ pubkey, address: agent.getAddress() });
    }
    return result;
  }

  getLPAgent(pubkey: string): CryptoAgent | undefined {
    return this.lpAgents.get(pubkey);
  }

  async shutdown(walletAddress: string): Promise<boolean> {
    const pair = this.agents.get(walletAddress.toLowerCase());
    if (!pair) return false;

    pair.fiat.stop();
    pair.crypto.stop();

    const cryptoPubkey = await pair.crypto.getAXLPublicKey();
    this.lpAgents.delete(cryptoPubkey);
    this.agents.delete(walletAddress.toLowerCase());

    console.log(`[AgentManager] Shutdown agents for ${walletAddress}`);
    return true;
  }

  async shutdownAll(): Promise<void> {
    for (const [wallet] of this.agents) {
      await this.shutdown(wallet);
    }
  }

  getActiveCount(): number {
    return this.agents.size;
  }
}

export const agentManager = new AgentManager();
