<p align="center">
  <img src="public/aegis-logo.png" alt="Aegis" width="200" />
</p>

<h1 align="center">The First Decentralized Fiat ↔ Crypto Onramp</h1>

<p align="center">
  <strong>Autonomous AI agents + zkTLS proofs + P2P negotiation.</strong><br/>
  No CEX. No custodian. No middleman.
</p>

<p align="center">
  <a href="#the-irony">The Irony</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#how-aegis-uses-0g">0G</a> •
  <a href="#how-aegis-uses-gensyn-axl">AXL</a> •
  <a href="#how-aegis-uses-keeperhub">KeeperHub</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/0G-Storage%20%2B%20Compute-00D4AA?style=flat-square" alt="0G" />
  <img src="https://img.shields.io/badge/Gensyn-AXL-7C3AED?style=flat-square" alt="AXL" />
  <img src="https://img.shields.io/badge/KeeperHub-Automation-FF6B35?style=flat-square" alt="KeeperHub" />
  <img src="https://img.shields.io/badge/x402-Payments-3B82F6?style=flat-square" alt="x402" />
</p>

---

## The Irony

Onboarding into crypto, DeFi, and decentralization requires you to interact with centralized servers.

**The gateway to decentralization is centralization.**

```
Coinbase       →  Custodies your funds, freezes accounts at will
Binance        →  KYC everything, banned in half the world
CoinDCX        →  Centralized order matching, withdrawal limits
MoonPay        →  5% fees, centralized verification, your data sold
```

**$50B+ flows through these centralized onramps every year.** Aegis changes that.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                              USER WALLET                                  │
│  ┌─────────────┐                                      ┌─────────────┐    │
│  │ Fiat Agent  │◄────── AXL P2P Mesh ───────────────►│ Crypto Agent│    │
│  └──────┬──────┘                                      └──────┬──────┘    │
│         │                                                    │           │
│         │  broadcast/receive quotes                          │           │
│         └────────────────────┬───────────────────────────────┘           │
│                              ▼                                            │
│                    ┌─────────────────┐                                   │
│                    │  Escrow Contract │ ◄── funds locked here            │
│                    └────────┬────────┘                                   │
│                             │                                            │
└─────────────────────────────┼────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│   0G Storage  │    │  0G Compute   │    │   KeeperHub   │
│   (decision   │    │  (TEE         │    │   (escrow     │
│    logs)      │    │   attestation)│    │    automation)│
└───────────────┘    └───────────────┘    └───────────────┘
```

Agents handle negotiation only. Funds remain in escrow contracts until zkTLS proof verification triggers release.

---

## Components

| Component | Technology | Function |
|-----------|------------|----------|
| P2P Messaging | Gensyn AXL | Encrypted agent communication over mesh network |
| State Persistence | 0G Storage | On-chain storage for agent decisions and LP rankings |
| Code Attestation | 0G Compute | TEE verification of agent binary integrity |
| Payment Proof | Reclaim zkTLS | Cryptographic proof extraction from bank TLS sessions |
| Escrow Automation | KeeperHub | Conditional release triggers on proof verification |
| Settlement | 0G Galileo + Base | Smart contract escrow and reputation tracking |
| Agent Payments | x402 | HTTP-native micropayments for agent-to-agent fees |

---

## How Aegis Uses 0G

[0G](https://0g.ai) provides the decentralized infrastructure layer for Aegis — storage, compute, and settlement.

### 0G Storage

Agent decisions are persisted on-chain via 0G's distributed storage network. Every quote selection, LP ranking update, and pricing decision is logged with a Merkle root hash.

```typescript
// zerog/storage/client.ts
await storage.uploadMemory(agentId, {
  decision: "selected LP-1 over LP-2",
  reason: "0.02% lower fee, 98% reputation",
  timestamp: Date.now()
});
// Returns: Merkle root hash for on-chain reference
```

Payment proofs from zkTLS are also pinned here — the evidence blob is stored on 0G, and only the root hash goes on-chain to the escrow contract.

### 0G Compute

Agent code integrity is verified through 0G's TEE (Trusted Execution Environment) network. Before any agent session, the code hash is attested:

```typescript
// zerog/compute/client.ts
const attestation = await compute.attestAgent(codeHash, "fiat-agent", "1.0.0");
// TEE signature proves: this binary matches the open-source release
```

LP pricing decisions can also run through verifiable inference — the agent queries 0G Compute for optimal spread calculations, and the response includes a `chatId` for auditability.

### 0G Chain (Galileo)

Escrow contracts, agent registry, and reputation tracking live on 0G's EVM-compatible L1. Settlement happens here or on Base depending on the user's destination chain preference.

---

## How Aegis Uses Gensyn AXL

[Gensyn AXL](https://docs.gensyn.ai/tech/agent-exchange-layer) is the encrypted P2P mesh that connects all agents — no central server, no orderbook.

### Transport Layer

Each user sandbox runs a local AXL node (Go binary, no root/TUN required). The node joins a Yggdrasil-based mesh with automatic NAT traversal and end-to-end encryption.

```typescript
// protocol/axl/bridge.ts
const bridge = new AXLBridge("http://127.0.0.1:9002");
const topology = await bridge.getTopology();
// { publicKey: "...", ipv6: "...", peers: [...] }
```

### Agent Messaging

Agents communicate via fire-and-forget messages. The Fiat Agent broadcasts RFQ requests; LP Crypto Agents respond with signed quotes.

```typescript
// Fiat Agent broadcasts to LP network
await bridge.send(lpPeerId, {
  type: "rfq.get",
  payload: { amount: 100, fromCurrency: "USD", toCurrency: "ETH" }
});

// LP Agent responds with quote
await bridge.send(buyerPeerId, {
  type: "quote.sign",
  payload: { rate: 0.00033, fee: 0.0002, ttl: 30000 }
});
```

### MCP over AXL

Agents expose [MCP](https://modelcontextprotocol.io) tool manifests. Any agent can invoke another agent's tools via the AXL bridge:

```typescript
// JSON-RPC to remote agent's MCP service
const result = await bridge.mcpCall(peerId, "crypto-agent", "getQuote", {
  amount: 100,
  pair: "USD/ETH"
});
```

This enables dynamic tool composition — agents discover and call each other's capabilities at runtime.

---

## How Aegis Uses KeeperHub

[KeeperHub](https://keeperhub.xyz) provides trustless automation — deadline enforcement, payment triggers, and conditional escrow release.

### Deadline Enforcement

A background keeper job polls the escrow contract for locked orders approaching their deadline. If the buyer fails to submit proof in time, the keeper calls `expire()` to refund the LP and slash the buyer's anti-grief bond.

```typescript
// keepers/jobs/pushExpire.ts
const lockedOrders = await escrow.getLockedOrders();
for (const orderId of lockedOrders) {
  const deadline = await escrow.getOrderDeadline(orderId);
  if (timeLeft <= deadlineBufferSeconds) {
    await escrow.expire(orderId);  // Refund LP, slash buyer bond
  }
}
```

### Payment Verification Workflow

When a fiat payment is confirmed, the PSP sends a webhook to KeeperHub. The workflow:

1. Verifies HMAC signature from the payment provider
2. Validates amount/currency/receiver match the locked order
3. Pins the evidence blob to 0G Storage
4. Triggers `Escrow.release(orderId, evidenceHash)` on-chain

```typescript
// agents/payment-verify/webhook.ts
const evidenceHash = await pinEvidence(payload, signature);
await triggerKeeperHubRelease(orderId, evidenceHash, amount, currency);
// KeeperHub workflow executes Escrow.release() with embedded wallet
```

### Why KeeperHub?

- **Non-custodial**: KeeperHub's embedded wallet only has permission to call specific contract functions
- **Reliable**: Workflows run on KeeperHub infrastructure, not user devices
- **Auditable**: Every execution is logged with an `executionId` for on-chain correlation

---

## Transaction Flow

1. **Quote Request**: User agent broadcasts swap request over AXL mesh
2. **LP Response**: LP agents return quotes (amount, fee, reputation score)
3. **Escrow Lock**: Selected LP's crypto locked in escrow contract
4. **Fiat Transfer**: User sends fiat via supported payment rail
5. **Proof Generation**: zkTLS proof extracted from payment provider's TLS session
6. **Verification**: KeeperHub validates proof against escrow conditions
7. **Release**: Escrow releases crypto to user wallet

---

## Security Model

| Concern | Mitigation |
|---------|------------|
| Agent tampering | 0G Compute TEE attests code hash before each session |
| Decision disputes | All agent decisions logged to 0G Storage with cryptographic proofs |
| Fund custody | Agents hold signing keys for broadcast only; escrow withdrawal requires valid proof or timeout |
| Fiat verification | zkTLS extracts proof directly from bank's TLS session, not user-provided data |

---

## Deployed Contracts

| Contract | 0G Galileo | Base Sepolia |
|----------|------------|--------------|
| Escrow | `0x31da867c...` | `0x42A50591...` |
| AgentRegistry | `0x98efa762...` | `0xf03F328b...` |

**Verified Transactions:**

| Description | Hash | Network |
|-------------|------|---------|
| Agent state write | [`0x26734875...`](https://chainscan-galileo.0g.ai/tx/0x267348752296ea6ac570cb13e1612b7aaef6d0c09cded81ee6d791def4bcf8bd) | 0G Galileo |
| Escrow release | [`0x335f7fa8...`](https://sepolia.basescan.org/tx/0x335f7fa891ca6171f506de68ebdf26f2bcafd5a79d967352de390ee7fea79c34) | Base Sepolia |
| Evidence root | `0x9eafd758...` | 0G Galileo |

---

## Local Development

```bash
git clone https://github.com/arko05roy/Aegis.git && cd Aegis
pnpm install
cp .env.example .env  # add PRIVATE_KEY

# Start AXL mesh (2 nodes)
cd services/axl-node
./node -config node-config.json &
./node -config node-config-2.json &

# Start backend
pnpm run agent-server &
pnpm run webhook-receiver &

# Start frontend
pnpm dev

# Open http://localhost:3000/p2p
```

---

## License

MIT
