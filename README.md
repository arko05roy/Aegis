# Agentic Fiat ↔ Crypto Onramp

A decentralized P2P fiat-to-crypto onramp powered by AI agents, zkTLS proofs, and the 0G ecosystem. No custody, no KYC friction, no human bottlenecks.

## Overview

This platform replaces centralized onramps (MoonPay, Ramp, CEXs) and manual P2P markets with an **agent swarm delivered as a web app**. Users interact via natural language in a ChatGPT-style interface while autonomous agents handle negotiation, payment verification, and settlement.

```
User: "swap 100 usd → eth"
→ Agents negotiate with LPs over encrypted mesh
→ User taps passkey to confirm fiat payment
→ zkTLS proof verifies payment against PSP's TLS session
→ Crypto released from escrow — no human intervention
```

## Architecture

| Layer | Technology |
|-------|------------|
| Chain | 0G Chain (escrow, orderbook, reputation) |
| Compute | 0G Compute (zkTLS verification) |
| Storage | 0G Storage (proofs, agent memory) |
| Transport | Gensyn AXL (encrypted P2P mesh) |
| Agent Protocol | MCP (semantic tool calls) |
| Payments | x402 (HTTP-native crypto payments) |
| Fiat Verification | Reclaim zkTLS |
| Automation | KeeperHub (deadlines, slashing) |
| Frontend | Next.js 15 + WebAuthn passkeys |

## Supported Rails & Chains

**Fiat Rails:** UPI, Venmo, Revolut

**Destination Chains:** 0G, Base, Solana

## Repository Structure

```
/contracts          Solidity (Escrow, Orderbook, Reputation, RailRegistry)
/circuits           zkTLS circuits per rail (Noir/Circom)
/protocol           MCP schemas, x402, AXL bridge
/agents             Fiat Agent, Crypto Agent, runtime
/keepers            KeeperHub jobs and AI tools
/zerog              0G Compute/Storage integrations
/services           BankSim (demo), sandbox orchestrator
/apps/web           Next.js chat UI
```

## Quick Start

```bash
# Install dependencies
pnpm install

# Start local development (demo mode)
pnpm dev

# Run tests
pnpm test

# Deploy contracts to testnet
pnpm deploy:testnet
```

## Demo Mode

For development and demos, set `DEMO_MODE=true` to use:
- **BankSim** — deterministic TLS bank simulator (real zkTLS proofs, fake bank)
- **0G Testnet + Base Sepolia** — testnet crypto

Everything else runs production-real: AXL mesh, MCP, x402, escrow, keepers.

## Core Flow

1. User types swap intent in web app
2. Fiat Agent broadcasts RFQ over AXL mesh
3. LP agents respond with signed quotes
4. Best quote selected; escrow locked on 0G
5. User confirms fiat payment via passkey
6. zkTLS proof generated from PSP's TLS session
7. Proof verified on 0G Compute; crypto released
8. Keepers enforce deadlines and slash defaults

## Documentation

- [Protocol Specification](./docs/protocol.md)
- [Rail Onboarding Guide](./docs/rails.md)
- [Deployment Runbook](./docs/deploy.md)

## License

MIT
