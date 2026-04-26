// agents/fiat-agent/index.ts
import { BaseAgent, AgentConfig } from '../runtime/index';
import { RfqGet, QuoteSign, OrderCommit } from '../../protocol/mcp/schemas';
import { simulatePayment } from '../payment-verify/banksim';
import type { PaymentWebhookPayload } from '../payment-verify/webhook';

interface FiatAgentConfig extends Omit<AgentConfig, 'role'> {
  supportedRails: string[];
  demoMode: boolean;
  webhookUrl: string;
}

export class FiatAgent extends BaseAgent {
  private fiatConfig: FiatAgentConfig;
  private pendingQuotes: Map<string, QuoteSign[]> = new Map();

  constructor(config: FiatAgentConfig) {
    super({ ...config, role: 'buyer' });
    this.fiatConfig = config;
  }

  protected setupMessageHandlers(): void {
    this.messageHandler.on('quote.sign', async (msg) => {
      const quote = msg.data as QuoteSign;
      console.log(`[FiatAgent] Received quote from ${quote.lpAgent}: ${quote.rate}`);

      const quotes = this.pendingQuotes.get(quote.rfqId) || [];
      quotes.push(quote);
      this.pendingQuotes.set(quote.rfqId, quotes);
    });

    this.messageHandler.on('fiat.details', async (msg) => {
      console.log(`[FiatAgent] Received fiat details for order ${msg.data.orderId}`);
    });
  }

  async broadcastRfq(intent: RfqGet['intent']): Promise<string> {
    const rfqId = `rfq_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    const rfq: RfqGet = {
      intent,
      buyerAgent: await this.getAXLPublicKey(),
      timestamp: Date.now(),
      ttl: 60,
    };

    console.log(`[FiatAgent] Broadcasting RFQ: ${JSON.stringify(intent)}`);

    return rfqId;
  }

  async selectQuoteAndCommit(rfqId: string): Promise<OrderCommit | null> {
    const quotes = this.pendingQuotes.get(rfqId);
    if (!quotes || quotes.length === 0) {
      console.log('[FiatAgent] No quotes received');
      return null;
    }

    const scored = quotes.map(q => ({
      quote: q,
      score: parseFloat(q.rate) * (q.reputation / 100),
    }));

    scored.sort((a, b) => b.score - a.score);
    const bestQuote = scored[0].quote;

    console.log(`[FiatAgent] Selected quote from ${bestQuote.lpAgent}`);

    const commit: OrderCommit = {
      quoteId: bestQuote.rfqId,
      buyerAgent: await this.getAXLPublicKey(),
      lpAgent: bestQuote.lpAgent,
      selectedRail: bestQuote.rails[0],
      antiGriefBondTx: '',
      timestamp: Date.now(),
    };

    await this.axl.send(bestQuote.lpAgent, { type: 'order.commit', ...commit });

    return commit;
  }

  async submitPaymentProof(
    orderId: string,
    amount: string,
    currency: string,
    railType: string,
    receiverHandle: string,
    senderHandle: string
  ): Promise<string> {
    console.log(`[FiatAgent] Awaiting payment for order ${orderId}`);
    console.log(`[FiatAgent] Pay ${amount} ${currency} via ${railType} to ${receiverHandle}`);
    console.log(`[FiatAgent] Include memo: orderId=${orderId}`);

    if (this.fiatConfig.demoMode) {
      const payload: PaymentWebhookPayload = {
        orderId,
        amount,
        currency,
        sender: senderHandle,
        receiver: receiverHandle,
        transactionId: `tx_${orderId}`,
        timestamp: Math.floor(Date.now() / 1000),
        rail: railType as any,
      };
      await simulatePayment(this.fiatConfig.webhookUrl, payload);
    }

    const rootHash = await this.waitForEscrowRelease(orderId);
    console.log(`[FiatAgent] Escrow released. Evidence hash: ${rootHash}`);

    return rootHash;
  }

  private async waitForEscrowRelease(
    orderId: string,
    timeoutMs: number = 600_000
  ): Promise<string> {
    const { ethers } = await import('ethers');
    const provider = new ethers.JsonRpcProvider(process.env.ZEROG_TESTNET_RPC!);
    const escrow = new ethers.Contract(
      process.env.ESCROW_ADDRESS!,
      ['event Released(bytes32 indexed orderId, bytes32 evidenceHash)'],
      provider
    );
    const orderHash = ethers.id(orderId);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('Escrow release timeout')),
        timeoutMs
      );
      escrow.on('Released', (id: string, evidenceHash: string) => {
        if (id === orderHash) {
          clearTimeout(timeout);
          escrow.removeAllListeners('Released');
          resolve(evidenceHash);
        }
      });
    });
  }
}
