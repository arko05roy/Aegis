// services/agent-server/index.ts
// Standalone agent server - runs FiatAgent + CryptoAgent with full AXL, 0G, KeeperHub integration

import 'dotenv/config';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { FiatAgent } from '../../agents/fiat-agent';
import { CryptoAgent } from '../../agents/crypto-agent';
import { ZeroGStorage } from '../../zerog/storage/client';
import { ZeroGCompute } from '../../zerog/compute/client';
import { AXLBridge } from '../../protocol/axl/bridge';

const PORT = parseInt(process.env.AGENT_SERVER_PORT || '4002');
const PRIVATE_KEY = process.env.PRIVATE_KEY!;
const RPC_URL = process.env.ZEROG_TESTNET_RPC || 'https://evmrpc-testnet.0g.ai';
const WEBHOOK_URL = process.env.WEBHOOK_RECEIVER_URL || 'http://127.0.0.1:4001/webhook/payment';

interface AgentPair {
  fiat: FiatAgent;
  crypto: CryptoAgent;
  walletAddress: string;
  createdAt: number;
}

interface RfqRecord {
  rfqId: string;
  walletAddress: string;
  intent: any;
  createdAt: number;
}

class AgentServer {
  private agents: Map<string, AgentPair> = new Map();
  private rfqs: Map<string, RfqRecord> = new Map();
  private storage: ZeroGStorage;
  private compute: ZeroGCompute;
  private axl: AXLBridge;
  private computeInitialized = false;

  constructor() {
    this.storage = new ZeroGStorage(PRIVATE_KEY);
    this.compute = new ZeroGCompute();
    this.axl = new AXLBridge();
  }

  async initialize() {
    console.log('[AgentServer] Initializing...');

    // Check AXL connectivity
    try {
      const topology = await this.axl.getTopology();
      console.log(`[AgentServer] AXL connected: ${topology.our_public_key.slice(0, 16)}...`);
    } catch (err) {
      console.warn('[AgentServer] AXL not available, will retry on requests');
    }

    // Initialize 0G Compute
    try {
      await this.compute.initialize(PRIVATE_KEY);
      this.computeInitialized = true;
      console.log('[AgentServer] 0G Compute initialized');
    } catch (err) {
      console.warn('[AgentServer] 0G Compute not available:', err);
    }

    console.log('[AgentServer] Ready');
  }

  async getOrCreateAgents(walletAddress: string): Promise<AgentPair> {
    const key = walletAddress.toLowerCase();
    const existing = this.agents.get(key);
    if (existing) return existing;

    console.log(`[AgentServer] Creating agents for ${walletAddress}`);

    const fiat = new FiatAgent({
      name: `fiat-${key.slice(2, 10)}`,
      privateKey: PRIVATE_KEY,
      rpcUrl: RPC_URL,
      supportedRails: ['banksim', 'upi', 'venmo', 'transak'],
      demoMode: false,
      webhookUrl: WEBHOOK_URL,
    });

    const crypto = new CryptoAgent({
      name: `crypto-${key.slice(2, 10)}`,
      privateKey: PRIVATE_KEY,
      rpcUrl: RPC_URL,
      inventory: [
        { token: 'ETH', balance: '10', minOrder: '0.01' },
        { token: 'USDC', balance: '10000', minOrder: '1' },
      ],
      spreadBps: 50,
      supportedRails: ['banksim', 'upi', 'venmo', 'transak'],
      fiatDetails: {
        banksim: { account: 'lp@banksim' },
        upi: { vpa: 'lp@upi' },
        venmo: { handle: '@lp-venmo' },
      },
    });

    await fiat.initialize();
    await crypto.initialize();

    // Start message handlers (non-blocking)
    fiat.start().catch(err => console.error('[FiatAgent] Start error:', err));
    crypto.start().catch(err => console.error('[CryptoAgent] Start error:', err));

    const pair: AgentPair = { fiat, crypto, walletAddress: key, createdAt: Date.now() };
    this.agents.set(key, pair);

    // Log to 0G Storage
    await this.logEvent('agent.created', { walletAddress: key });

    return pair;
  }

  async broadcastRfq(walletAddress: string, intent: any): Promise<string> {
    const pair = this.agents.get(walletAddress.toLowerCase());
    if (!pair) throw new Error('No agents for wallet');

    // Get all LP agents (other users' crypto agents)
    const lpPubkeys: string[] = [];
    for (const [addr, p] of this.agents) {
      if (addr !== walletAddress.toLowerCase()) {
        lpPubkeys.push(await p.crypto.getAXLPublicKey());
      }
    }

    // If no other LPs, use own crypto agent (self-trade)
    if (lpPubkeys.length === 0) {
      lpPubkeys.push(await pair.crypto.getAXLPublicKey());
    }

    const rfqId = await pair.fiat.broadcastRfq(intent, lpPubkeys);

    this.rfqs.set(rfqId, {
      rfqId,
      walletAddress: walletAddress.toLowerCase(),
      intent,
      createdAt: Date.now(),
    });

    // Direct quote generation from all available LPs (fallback if AXL slow/unavailable)
    for (const [addr, p] of this.agents) {
      try {
        const quote = await p.crypto.generateQuoteDirectly(intent, rfqId);
        if (quote) {
          pair.fiat.addQuote(rfqId, quote);
          console.log(`[AgentServer] Direct quote from ${addr}: ${quote.rate}`);
        }
      } catch (err) {
        console.error(`[AgentServer] Direct quote failed from ${addr}:`, err);
      }
    }

    // Log to 0G Storage
    await this.logEvent('rfq.broadcast', { rfqId, walletAddress, intent, lpCount: lpPubkeys.length });

    return rfqId;
  }

  getQuotes(walletAddress: string, rfqId: string): any[] {
    const pair = this.agents.get(walletAddress.toLowerCase());
    if (!pair) return [];
    return pair.fiat.getQuotesForRfq(rfqId);
  }

  async commitToQuote(walletAddress: string, rfqId: string, quoteIndex: number): Promise<any> {
    const pair = this.agents.get(walletAddress.toLowerCase());
    if (!pair) throw new Error('No agents for wallet');

    const quotes = pair.fiat.getQuotesForRfq(rfqId);
    if (quotes.length === 0) throw new Error('No quotes available');

    const quote = quotes[quoteIndex] || quotes[0];
    await pair.fiat.commitToQuote(quote);

    // Log to 0G Storage
    await this.logEvent('order.committed', { rfqId, quoteId: quote.rfqId, lpAgent: quote.lpAgent });

    // Save agent state
    await pair.fiat.saveState();
    await pair.crypto.saveState();

    return quote;
  }

  async verifyDecision(context: any): Promise<{ verified: boolean; chatId: string }> {
    if (!this.computeInitialized) {
      return { verified: false, chatId: 'compute-not-initialized' };
    }

    try {
      const result = await this.compute.makeVerifiableDecision(
        'Verify this trading decision is valid and within risk parameters.',
        context
      );
      return { verified: result.verified, chatId: result.chatId };
    } catch (err: any) {
      console.warn('[AgentServer] 0G Compute skipped:', err.message?.slice(0, 80));
      return { verified: false, chatId: `local-${Date.now()}` };
    }
  }

  private async logEvent(event: string, data: any): Promise<string | null> {
    try {
      const entry = {
        event,
        data,
        timestamp: Date.now(),
        server: 'agent-server',
      };
      const hash = await this.storage.uploadProof(
        new TextEncoder().encode(JSON.stringify(entry))
      );
      console.log(`[0G Storage] Logged ${event}: ${hash.slice(0, 16)}...`);
      return hash;
    } catch (err) {
      console.error('[0G Storage] Log failed:', err);
      return null;
    }
  }

  getStatus() {
    return {
      agents: this.agents.size,
      rfqs: this.rfqs.size,
      computeReady: this.computeInitialized,
    };
  }

  listAgents() {
    const result: any[] = [];
    this.agents.forEach((pair, addr) => {
      result.push({
        walletAddress: addr,
        createdAt: pair.createdAt,
      });
    });
    return result;
  }

  getDecisions(walletAddress: string): { fiat: any; crypto: any } | null {
    const pair = this.agents.get(walletAddress.toLowerCase());
    if (!pair) return null;

    return {
      fiat: {
        agentName: pair.fiat.getName(),
        attestation: pair.fiat.getAttestation(),
        decisions: pair.fiat.getDecisionLog(),
        memoryHash: pair.fiat.getMemoryHash(),
      },
      crypto: {
        agentName: pair.crypto.getName(),
        attestation: pair.crypto.getAttestation(),
        decisions: pair.crypto.getDecisionLog(),
        memoryHash: pair.crypto.getMemoryHash(),
      },
    };
  }
}

// Create server
const agentServer = new AgentServer();
const app = new Hono();

app.use('/*', cors());

app.get('/health', (c) => c.json({ ok: true, ...agentServer.getStatus() }));

app.post('/agents', async (c) => {
  const { walletAddress } = await c.req.json();
  if (!walletAddress) return c.json({ error: 'Missing walletAddress' }, 400);

  try {
    const pair = await agentServer.getOrCreateAgents(walletAddress);
    return c.json({
      ok: true,
      walletAddress,
      fiatPubkey: await pair.fiat.getAXLPublicKey(),
      cryptoPubkey: await pair.crypto.getAXLPublicKey(),
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.get('/agents', (c) => {
  return c.json({ agents: agentServer.listAgents() });
});

app.post('/rfq', async (c) => {
  const { walletAddress, intent } = await c.req.json();
  if (!walletAddress || !intent) return c.json({ error: 'Missing params' }, 400);

  try {
    const rfqId = await agentServer.broadcastRfq(walletAddress, intent);
    const lpCount = agentServer.getStatus().agents;
    return c.json({ ok: true, rfqId, broadcastTo: lpCount });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.get('/quotes/:rfqId', async (c) => {
  const rfqId = c.req.param('rfqId');
  const walletAddress = c.req.query('wallet');
  if (!walletAddress) return c.json({ error: 'Missing wallet param' }, 400);

  const quotes = agentServer.getQuotes(walletAddress, rfqId);
  return c.json({ rfqId, quotes });
});

app.post('/commit', async (c) => {
  const { walletAddress, rfqId, quoteIndex, orderRefId, rail } = await c.req.json();
  if (!walletAddress || !rfqId) return c.json({ error: 'Missing params' }, 400);

  try {
    const quote = await agentServer.commitToQuote(walletAddress, rfqId, quoteIndex ?? 0);

    const selectedRail = rail || quote.rails?.[0] || 'banksim';
    const refId = orderRefId || `order-${Date.now()}`;
    const fiatDetails = {
      railType: selectedRail,
      paymentId: 'arkoroy@okicici',
      reference: refId,
      qrPayload: `pay://arkoroy@okicici?amount=${refId}&ref=${refId}`,
    };

    return c.json({ ok: true, quote, fiatDetails });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.post('/verify', async (c) => {
  const context = await c.req.json();
  const result = await agentServer.verifyDecision(context);
  return c.json(result);
});

app.get('/decisions/:walletAddress', (c) => {
  const walletAddress = c.req.param('walletAddress');
  const decisions = agentServer.getDecisions(walletAddress);
  if (!decisions) {
    return c.json({ error: 'No agents found for wallet' }, 404);
  }
  return c.json(decisions);
});

// Start
async function main() {
  await agentServer.initialize();
  serve({ fetch: app.fetch, port: PORT });
  console.log(`[AgentServer] Listening on :${PORT}`);
}

main().catch(console.error);
