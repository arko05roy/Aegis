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

[0G](https://0g.ai) provides the decentralized infrastructure layer — storage, compute, and settlement.

```
┌─────────────────────────────────────────────────────────────────────┐
│                            0G NETWORK                               │
├─────────────────────┬─────────────────────┬─────────────────────────┤
│                     │                     │                         │
│    0G STORAGE       │    0G COMPUTE       │    0G CHAIN (Galileo)   │
│                     │                     │                         │
│  ┌───────────────┐  │  ┌───────────────┐  │  ┌───────────────────┐  │
│  │ Agent Memory  │  │  │ TEE Attestation│  │  │ Escrow Contracts │  │
│  │ Decision Logs │  │  │ Code Integrity │  │  │ Agent Registry   │  │
│  │ Payment Proofs│  │  │ Verifiable AI  │  │  │ Reputation System│  │
│  └───────────────┘  │  └───────────────┘  │  └───────────────────┘  │
│                     │                     │                         │
└─────────────────────┴─────────────────────┴─────────────────────────┘
```

### 0G Storage

Every agent decision is logged to 0G's distributed storage network with a Merkle root hash. This creates an immutable audit trail — if an agent claims it picked LP-1 for the best rate, anyone can verify by querying the decision log.

Payment proofs work the same way: the zkTLS evidence blob is stored on 0G, and only the compact root hash is written on-chain. This keeps gas costs low while preserving full dispute evidence.

### 0G Compute

Before any agent session starts, its code hash is attested by 0G's TEE (Trusted Execution Environment) network. This proves the running binary matches the open-source release — no tampering, no hidden logic.

LP agents can also run pricing decisions through verifiable inference. The TEE signs the output, so buyers know the quoted spread came from the declared pricing model, not a manipulated one.

### 0G Chain (Galileo)

Escrow contracts, agent registration, and reputation scores live on 0G's EVM-compatible L1. When a user completes a swap, settlement happens here (or on Base, depending on destination chain preference).

---

## How Aegis Uses Gensyn AXL

[Gensyn AXL](https://docs.gensyn.ai/tech/agent-exchange-layer) is the encrypted P2P mesh that connects all agents — no central server, no orderbook.

```
┌─────────────────────────────────────────────────────────────────────┐
│                         AXL MESH NETWORK                            │
│                                                                     │
│     ┌──────────┐          Yggdrasil           ┌──────────┐         │
│     │  User's  │◄─────── encrypted ─────────►│   LP's   │         │
│     │  Fiat    │          P2P mesh            │  Crypto  │         │
│     │  Agent   │                              │  Agent   │         │
│     └────┬─────┘                              └────┬─────┘         │
│          │                                        │                │
│          │  1. "I want to swap $100 → ETH"        │                │
│          ├───────────────────────────────────────►│                │
│          │                                        │                │
│          │  2. "0.033 ETH @ 0.02% fee"            │                │
│          │◄───────────────────────────────────────┤                │
│          │                                        │                │
│     No central server. No orderbook. Just agents talking.          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### How It Works

Each user runs a local AXL node — a lightweight Go binary that joins the Yggdrasil mesh. NAT traversal is automatic, and all messages are end-to-end encrypted by default.

When you type "swap 100 USD → ETH", your Fiat Agent broadcasts a request-for-quote (RFQ) to the mesh. LP agents listening on that topic respond with signed quotes. Your agent scores them by rate, fee, and reputation — then commits to the best one.

### Why P2P Matters

Traditional onramps match orders on a central server. That server sees every trade, controls the orderbook, and can freeze accounts. AXL removes the server entirely — agents negotiate directly, and the only shared state is the escrow contract.

### MCP Integration

Agents expose their capabilities as [MCP](https://modelcontextprotocol.io) tools. Any agent can discover and call another agent's tools over the mesh — get a quote, check reputation, request fiat details. This enables dynamic composition without hardcoded integrations.

---

## How Aegis Uses KeeperHub

[KeeperHub](https://keeperhub.xyz) provides trustless automation — deadline enforcement, payment triggers, and conditional escrow release.

```
┌─────────────────────────────────────────────────────────────────────┐
│                      KEEPERHUB AUTOMATION                           │
│                                                                     │
│   DEADLINE ENFORCEMENT                 PAYMENT RELEASE              │
│   ────────────────────                 ───────────────              │
│                                                                     │
│   ┌─────────┐                          ┌─────────┐                  │
│   │ Escrow  │  order expires           │  Bank   │  payment sent    │
│   │ Contract│  in 30 seconds           │   PSP   │                  │
│   └────┬────┘                          └────┬────┘                  │
│        │                                    │                       │
│        ▼                                    ▼                       │
│   ┌─────────┐                          ┌─────────┐                  │
│   │ Keeper  │  calls expire()          │ Webhook │  HMAC verified   │
│   │   Job   │  refunds LP              │ Handler │                  │
│   └─────────┘  slashes buyer bond      └────┬────┘                  │
│                                             │                       │
│                                             ▼                       │
│                                        ┌─────────┐                  │
│                                        │ Escrow  │  release()       │
│                                        │ Contract│  crypto sent     │
│                                        └─────────┘                  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Deadline Enforcement

A keeper job continuously monitors the escrow contract for locked orders approaching their deadline. If the buyer doesn't submit payment proof in time, the keeper automatically expires the order — refunding the LP's locked crypto and slashing the buyer's anti-grief bond.

This prevents griefing attacks where a buyer locks up LP funds with no intention of paying.

### Payment Release

When the buyer's bank confirms the fiat transfer, the payment provider sends a webhook to KeeperHub. The workflow verifies the HMAC signature, checks that amount/currency/receiver match the locked order, pins the evidence to 0G Storage, and triggers the escrow release.

The crypto moves to the buyer's wallet — no human approval needed.

### Why KeeperHub?

| Property | Benefit |
|----------|---------|
| Non-custodial | KeeperHub's wallet can only call specific contract functions — it cannot steal funds |
| Reliable | Workflows run on KeeperHub infrastructure, not user devices that might go offline |
| Auditable | Every execution is logged with a unique ID, traceable on-chain |

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

## Demo

**Video:** [Watch on YouTube](https://youtube.com/watch?v=XXXXX) *(under 3 mins)*

**Live Demo:** [aegis.example.com](https://aegis.example.com)

---

## SDKs & Protocol Features Used

### 0G
| SDK | Version | Usage |
|-----|---------|-------|
| `@0gfoundation/0g-ts-sdk` | ^1.2.6 | Storage client for agent memory and proof pinning |
| `@0glabs/0g-serving-broker` | ^0.7.5 | Compute client for TEE attestation and verifiable inference |
| 0G Chain (Galileo) | EVM L1 | Escrow contracts, AgentRegistry, reputation |

### Gensyn AXL
| Feature | Usage |
|---------|-------|
| AXL Node (Go binary) | Local P2P mesh node per user sandbox |
| HTTP Bridge API | `/send`, `/recv`, `/topology`, `/mcp/{peer}/{svc}` |
| Yggdrasil Transport | End-to-end encrypted NAT-transparent messaging |

### KeeperHub
| Feature | Usage |
|---------|-------|
| Workflow Execution | Payment release automation via webhook triggers |
| Embedded Wallet | Non-custodial contract calls for `Escrow.release()` |
| Cron Jobs | Deadline enforcement polling |

---

## Cross-Node AXL Demo

The demo runs **two separate AXL nodes** on different ports to prove real P2P communication:

```
┌─────────────────┐                    ┌─────────────────┐
│   AXL Node 1    │                    │   AXL Node 2    │
│   :9002         │◄──── Yggdrasil ───►│   :9012         │
│                 │      mesh          │                 │
│  ┌───────────┐  │                    │  ┌───────────┐  │
│  │Fiat Agent │  │   RFQ broadcast    │  │LP Agent   │  │
│  │(buyer)    │──┼───────────────────►│  │(quoter)   │  │
│  └───────────┘  │                    │  └───────────┘  │
│                 │   quote response   │                 │
│                 │◄───────────────────┼──│              │
└─────────────────┘                    └─────────────────┘
```

**To verify:**
```bash
# Terminal 1: Start node on port 9002
cd services/axl-node && ./node -config node-config.json

# Terminal 2: Start node on port 9012
cd services/axl-node && ./node -config node-config-2.json

# Terminal 3: Run cross-node demo
pnpm run demo:axl-cross-node
```

The script logs show messages traversing the mesh between separate OS processes — not in-memory IPC.

---

## Example Agent: Fiat Agent

A working example agent that broadcasts RFQs and selects quotes:

**Location:** [`/agents/fiat-agent/index.ts`](./agents/fiat-agent/index.ts)

**What it does:**
1. Initializes with AXL bridge, 0G Storage, and 0G Compute clients
2. Broadcasts `rfq.get` messages to LP network over AXL mesh
3. Collects `quote.sign` responses with timeout
4. Scores quotes by `(rate × reputation) / fee`
5. Logs decision to 0G Storage with Merkle root
6. Commits to best quote via `order.commit`

**Run it:**
```bash
pnpm run agent:fiat --amount 100 --from USD --to ETH
```

---

## KeeperHub Feedback

### Documentation Gaps

1. **Webhook payload schema undocumented** — The `send-webhook` action accepts a body, but the exact structure expected by external receivers (headers, signing) isn't specified. We had to reverse-engineer by hitting `/echo` endpoints.

2. **Embedded wallet permissions unclear** — Docs say the wallet is "non-custodial" but don't specify how to restrict which contract functions it can call. We assumed it can call any function on whitelisted addresses.

3. **Workflow debugging** — No way to inspect intermediate state between workflow steps. When a workflow fails silently, there's no stack trace or variable dump.

### Feature Requests

1. **Typed workflow inputs** — Allow defining a JSON schema for workflow inputs so validation happens before execution, not mid-run.

2. **Retry with backoff** — Built-in retry logic for transient RPC failures. Currently we wrap every contract call in manual retry loops.

3. **Webhook signature verification** — Native HMAC verification step would save boilerplate. We wrote our own `verifyWebhookSignature()` helper.

---

## Team

**Arko Roy** — Solo Developer  
Telegram: [@arkoroy](https://t.me/arkoroy) · X: [@arko05roy](https://x.com/arko05roy)

---

## License

MIT
