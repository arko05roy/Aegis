// protocol/mcp/schemas.ts
import { z } from 'zod';

// RFQ (Request for Quote)
export const RfqGetSchema = z.object({
  intent: z.object({
    fromCurrency: z.string(),
    toCurrency: z.string(),
    toChain: z.string(),
    amount: z.string(),
    rails: z.array(z.string()),
  }),
  buyerAgent: z.string(),
  timestamp: z.number(),
  ttl: z.number(),
});
export type RfqGet = z.infer<typeof RfqGetSchema>;

// Quote (LP response)
export const QuoteSignSchema = z.object({
  rfqId: z.string(),
  lpAgent: z.string(),
  rate: z.string(),
  outputAmount: z.string(),
  fee: z.string(),
  rails: z.array(z.string()),
  expiry: z.number(),
  signature: z.string(),
  reputation: z.number(),
});
export type QuoteSign = z.infer<typeof QuoteSignSchema>;

// Order Commit
export const OrderCommitSchema = z.object({
  quoteId: z.string(),
  buyerAgent: z.string(),
  lpAgent: z.string(),
  selectedRail: z.string(),
  antiGriefBondTx: z.string(),
  timestamp: z.number(),
});
export type OrderCommit = z.infer<typeof OrderCommitSchema>;

// Fiat Details (e2e encrypted)
export const FiatDetailsSchema = z.object({
  orderId: z.string(),
  railType: z.string(),
  encryptedDetails: z.string(),
  nonce: z.string(),
});
export type FiatDetails = z.infer<typeof FiatDetailsSchema>;

// Proof Submit
export const ProofSubmitSchema = z.object({
  orderId: z.string(),
  proofType: z.literal('zktls'),
  railType: z.string(),
  proof: z.object({
    circuit: z.string(),
    publicSignals: z.array(z.string()),
    groth16Proof: z.object({
      a: z.array(z.string()),
      b: z.array(z.array(z.string())),
      c: z.array(z.string()),
    }),
  }),
  metadata: z.object({
    amount: z.string(),
    currency: z.string(),
    timestamp: z.number(),
    transactionId: z.string(),
  }),
  storageRootHash: z.string(),
});
export type ProofSubmit = z.infer<typeof ProofSubmitSchema>;

// Dispute
export const DisputeOpenSchema = z.object({
  orderId: z.string(),
  disputant: z.string(),
  reason: z.enum(['timeout', 'wrong_amount', 'fake_proof', 'no_fiat_received']),
  evidence: z.string(),
  timestamp: z.number(),
});
export type DisputeOpen = z.infer<typeof DisputeOpenSchema>;

// MCP Tool Definitions
export const MCP_TOOLS = {
  'rfq.get': {
    name: 'rfq.get',
    description: 'Request for quote - broadcast intent to LPs',
    inputSchema: RfqGetSchema,
  },
  'quote.sign': {
    name: 'quote.sign',
    description: 'LP responds with signed quote',
    inputSchema: QuoteSignSchema,
  },
  'order.commit': {
    name: 'order.commit',
    description: 'Buyer commits to a quote',
    inputSchema: OrderCommitSchema,
  },
  'fiat.details': {
    name: 'fiat.details',
    description: 'LP sends encrypted fiat payment details',
    inputSchema: FiatDetailsSchema,
  },
  'proof.submit': {
    name: 'proof.submit',
    description: 'Buyer submits zkTLS proof of fiat payment',
    inputSchema: ProofSubmitSchema,
  },
  'dispute.open': {
    name: 'dispute.open',
    description: 'Either party opens a dispute',
    inputSchema: DisputeOpenSchema,
  },
} as const;
