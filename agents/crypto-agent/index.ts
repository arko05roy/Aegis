// agents/crypto-agent/index.ts
import { BaseAgent, AgentConfig } from '../runtime/index';
import { RfqGet, QuoteSign, FiatDetails } from '../../protocol/mcp/schemas';
import { ethers } from 'ethers';

interface CryptoAgentConfig extends Omit<AgentConfig, 'role'> {
  inventory: {
    token: string;
    balance: string;
    minOrder: string;
  }[];
  spreadBps: number;
  supportedRails: string[];
  fiatDetails: Record<string, any>;
}

export class CryptoAgent extends BaseAgent {
  private lpConfig: CryptoAgentConfig;
  private activeOrders: Map<string, any> = new Map();

  constructor(config: CryptoAgentConfig) {
    super({ ...config, role: 'lp' });
    this.lpConfig = config;
  }

  protected setupMessageHandlers(): void {
    this.messageHandler.on('rfq.get', async (msg) => {
      const rfq = msg.data as RfqGet;
      console.log(`[CryptoAgent] Received RFQ from ${rfq.buyerAgent}`);

      const quote = await this.generateQuote(rfq);
      if (quote) {
        await this.axl.send(rfq.buyerAgent, { type: 'quote.sign', ...quote });
      }
    });

    this.messageHandler.on('order.commit', async (msg) => {
      const commit = msg.data;
      console.log(`[CryptoAgent] Order committed: ${commit.quoteId}`);

      const details: FiatDetails = {
        orderId: commit.quoteId,
        railType: commit.selectedRail,
        encryptedDetails: await this.encryptFiatDetails(
          commit.buyerAgent,
          this.lpConfig.fiatDetails[commit.selectedRail]
        ),
        nonce: ethers.hexlify(ethers.randomBytes(24)),
      };

      await this.axl.send(commit.buyerAgent, { type: 'fiat.details', ...details });
    });

    this.messageHandler.on('proof.submit', async (msg) => {
      console.log(`[CryptoAgent] Proof submitted for order ${msg.data.orderId}`);
    });
  }

  private async generateQuote(rfq: RfqGet): Promise<QuoteSign | null> {
    const canFulfill = this.checkInventory(rfq.intent.toCurrency, rfq.intent.amount);
    if (!canFulfill) {
      console.log('[CryptoAgent] Insufficient inventory');
      return null;
    }

    const matchedRails = rfq.intent.rails.filter(r =>
      this.lpConfig.supportedRails.includes(r)
    );
    if (matchedRails.length === 0) {
      console.log('[CryptoAgent] No matching rails');
      return null;
    }

    const baseRate = await this.getMarketRate(rfq.intent.fromCurrency, rfq.intent.toCurrency);
    const rateWithSpread = baseRate * (1 - this.lpConfig.spreadBps / 10000);

    const outputAmount = parseFloat(rfq.intent.amount) * rateWithSpread;

    const quote: QuoteSign = {
      rfqId: `quote_${Date.now()}`,
      lpAgent: await this.getAXLPublicKey(),
      rate: rateWithSpread.toFixed(8),
      outputAmount: outputAmount.toFixed(8),
      fee: (parseFloat(rfq.intent.amount) * 0.005).toFixed(2),
      rails: matchedRails,
      expiry: Date.now() + 60000,
      signature: '',
      reputation: 85,
    };

    return quote;
  }

  private checkInventory(currency: string, amount: string): boolean {
    const inv = this.lpConfig.inventory.find(i =>
      i.token.toLowerCase() === currency.toLowerCase()
    );
    if (!inv) return false;
    return parseFloat(inv.balance) >= parseFloat(amount);
  }

  private async getMarketRate(from: string, to: string): Promise<number> {
    const rates: Record<string, number> = {
      'USD-ETH': 0.00035,
      'USD-USDC': 1.0,
    };
    return rates[`${from}-${to}`] || 0;
  }

  private async encryptFiatDetails(buyerPubkey: string, details: any): Promise<string> {
    return Buffer.from(JSON.stringify(details)).toString('base64');
  }
}
