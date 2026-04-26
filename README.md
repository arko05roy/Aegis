# Aegis

**Zero-human-touchpoint fiat ↔ crypto onramp powered by wallet-embedded AI agents.**

Crypto preaches decentralization, yet the way we go from fiat to crypto is through CEXs and centralized onramps. Aegis fixes that.

## The Problem

Every fiat onramp today requires trusting a centralized party:
- **CEXs** — custody risk, KYC friction, account freezes
- **MoonPay/Ramp** — centralized verification, high fees
- **Manual P2P** — slow, requires human coordination, scam risk

## The Solution

Aegis embeds two AI agents directly in your wallet:
- **Fiat Agent** — handles buying crypto (fiat → crypto)
- **Crypto Agent** — handles selling crypto (crypto → fiat)

These agents negotiate, verify payments, and settle trades **without human intervention**. Humans only provide liquidity — the agents handle everything else.

```
User: "swap 100 usd → eth"
  ↓
Fiat Agent broadcasts RFQ over encrypted P2P mesh
  ↓
LP agents respond with signed quotes
  ↓
User confirms fiat payment via passkey
  ↓
zkTLS proof verifies payment
  ↓
Crypto released from escrow — zero human touchpoints
```

## Why Trust an AI Agent?

1. **Verifiable Reasoning** — Every agent decision runs through 0G Compute TEE. You can cryptographically prove WHY the agent chose a specific LP or rate.

2. **Agent Attestation** — 0G Compute attests that the running agent matches the open-source code. No tampered binaries.

3. **Persistent Consciousness** — Agent memory (preferences, LP rankings, transaction history) persists on 0G Storage. Your agent survives your phone dying.

4. **No Greed** — AI agents don't have profit motives unless coded in. The code is open source and auditable.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      YOUR WALLET                            │
│  ┌─────────────┐              ┌─────────────┐              │
│  │ Fiat Agent  │              │Crypto Agent │              │
│  │ (buy crypto)│              │(sell crypto)│              │
│  └──────┬──────┘              └──────┬──────┘              │
└─────────┼────────────────────────────┼──────────────────────┘
          │                            │
          │   GENSYN AXL (encrypted P2P mesh)
          │                            │
┌─────────▼────────────────────────────▼──────────────────────┐
│                    LP AGENT NETWORK                         │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐                 │
│  │LP Agent │    │LP Agent │    │LP Agent │                 │
│  │  (UPI)  │    │ (Venmo) │    │(Revolut)│                 │
│  └─────────┘    └─────────┘    └─────────┘                 │
└─────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Chain** | 0G Chain | Escrow, orderbook, reputation |
| **Compute** | 0G Compute | TEE attestation, verifiable agent decisions |
| **Storage** | 0G Storage | Agent consciousness, decision logs, proofs |
| **Transport** | Gensyn AXL | Encrypted P2P agent mesh (no central server) |
| **Payments** | x402 + KeeperHub | Payment triggers, escrow automation |
| **Verification** | Reclaim zkTLS | Fiat payment proofs |
| **Frontend** | Next.js 15 | Chat UI with WebAuthn passkeys |

## Key Features

### Agent Attestation (0G Compute)
```typescript
// On agent startup, get TEE attestation
const attestation = await compute.attestAgent(codeHash, agentName, version);
// Returns TEE-signed proof that running code = open source version
```

### Decision Playback (0G Storage)
```bash
# Query why your agent made a decision
curl http://localhost:4002/decisions/0xYourWallet

# Returns full decision trail with 0G proof hashes
{
  "fiat": {
    "attestation": { "codeHash": "abc123...", "verified": true },
    "decisions": [
      { "action": "quote.selected", "data": { "lp": "0x...", "rate": 0.00033, "reason": "best rate" } }
    ]
  }
}
```

### P2P Agent Mesh (Gensyn AXL)
- No central orderbook or matching engine
- Agents discover each other via AXL mesh
- End-to-end encrypted communication
- Works even if you're behind NAT

### Payment Automation (KeeperHub)
- Escrow timeouts enforced automatically
- Payment verification triggers escrow release
- No manual intervention needed

## Supported Rails

**Fiat:** UPI, Venmo, Revolut, BankSim (demo)

**Crypto:** 0G Chain, Base, Solana

## Quick Start

```bash
# Install
pnpm install

# Configure
cp .env.example .env
# Add your PRIVATE_KEY and other secrets

# Start AXL nodes (2 terminals)
cd services/axl-node && ./node -config node-config.json
cd services/axl-node && ./node -config node-config-2.json

# Start agent server
pnpm run agent-server

# Start web UI
pnpm dev
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/agents` | POST | Create agent pair for wallet |
| `/rfq` | POST | Broadcast RFQ to LP network |
| `/quotes/:rfqId` | GET | Get quotes for RFQ |
| `/commit` | POST | Commit to a quote |
| `/decisions/:wallet` | GET | Get agent decision history |
| `/health` | GET | Server status |

## Repository Structure

```
/agents             Fiat Agent, Crypto Agent, runtime
/contracts          Escrow, Orderbook, Reputation (Solidity)
/protocol           MCP schemas, x402, AXL bridge
/zerog              0G Compute + Storage integrations
/keepers            KeeperHub workflows and jobs
/services           AXL node, agent server, webhook receiver
/apps/web           Next.js chat UI
/scripts            E2E tests, demos, verification
```

## Demo

```bash
# Run cross-node AXL demo
npx ts-node scripts/demo-axl-cross-node.ts

# Run full E2E flow
npx ts-node scripts/e2e-full-flow.ts

# Test 0G Storage
npx ts-node scripts/irl-0g-storage.ts
```

## Contract Deployments

| Contract | 0G Galileo | Base Sepolia |
|----------|------------|--------------|
| Escrow | `0x31da867c...` | `0x42A50591...` |
| RailRegistry | `0x8c7ffc95...` | `0x8E55f999...` |
| AgentRegistry | `0x98efa762...` | `0xf03F328b...` |

## One-Liner

> Aegis is the first fiat ↔ crypto onramp with zero human touchpoints. Wallet-embedded AI agents negotiate, verify, and settle — with every decision cryptographically provable on 0G.

## License

MIT
