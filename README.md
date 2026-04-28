<p align="center">
  <img src="public/aegis-logo.png" alt="Aegis" width="200" />
</p>

<h1 align="center">Aegis</h1>

<p align="center">
  <strong>The First Decentralized Fiat-to-Crypto Onramp</strong><br/>
  Four autonomous agents. Zero custodians. Pure P2P settlement.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/0G-Storage%20%2B%20Compute%20%2B%20Chain-00D4AA?style=flat-square" alt="0G" />
  <img src="https://img.shields.io/badge/Gensyn-AXL%20Mesh-7C3AED?style=flat-square" alt="AXL" />
  <img src="https://img.shields.io/badge/KeeperHub-Execution-FF6B35?style=flat-square" alt="KeeperHub" />
</p>

---

## The Problem

Every fiat-to-crypto onramp today is centralized. They custody your funds, control the orderbook, and can freeze accounts at will.

**The gateway to decentralization is centralization.**

Aegis removes the gateway entirely. P2P negotiation, on-chain escrow, no middleman.

---

## How It Works

### Your Wallet, Your Agents

Connect to Aegis and you get two AI agents attached to your wallet:

- **Fiat Agent** — broadcasts swap intent, collects quotes, scores LPs, commits to the best one
- **Crypto Agent** — manages liquidity, responds to quote requests, locks tokens into escrow

### P2P Negotiation

Agents negotiate over **Gensyn AXL**, an encrypted mesh. No central server, no orderbook. An LP in India and a buyer in Germany find each other through mesh routing and settle on-chain.

### Trust-Minimized Settlement

When a buyer pays fiat, two more agents handle release:

- **Watcher Agent** — observes bank webhook, validates signature, but *cannot release* — only forwards
- **Attestation Agent** — verifies payment matches on-chain commitment, pins evidence, triggers release

Neither agent can act alone. Compromise one and you still can't steal funds.

```mermaid
sequenceDiagram
    box rgb(30,40,60) Buyer Side
        participant FA as Fiat Agent
    end
    box rgb(40,50,70) LP Side
        participant CA as Crypto Agent
    end
    box rgb(50,60,80) Settlement Layer
        participant WA as Watcher Agent
        participant AA as Attestation Agent
    end
    participant E as Escrow

    FA->>CA: RFQ broadcast (AXL mesh)
    CA-->>FA: Signed quote
    FA->>CA: Accept quote
    CA->>E: Lock tokens + receiver commitment
    
    Note over FA,E: Buyer pays fiat via bank/UPI/Venmo
    
    WA->>WA: Receive webhook, validate HMAC
    WA->>AA: Forward observation (AXL mesh)
    AA->>AA: Verify receiver matches commitment
    AA->>E: Pin evidence, call release()
    E->>FA: Crypto released to buyer
```

---

## The Four Agents

| Agent | Role | Trust Property |
|-------|------|----------------|
| **Fiat Agent** | Broadcasts buyer intent, selects best quote | No custody, no signing authority |
| **Crypto Agent** | Provides liquidity, locks tokens in escrow | Funds held in contract, not agent |
| **Watcher Agent** | Observes payment webhooks, validates HMAC | Cannot release — only forwards |
| **Attestation Agent** | Verifies observations, pins proofs, triggers release | Cannot release without valid evidence |

**Key insight:** Compromise one agent and you still can't steal funds. The attack surface requires compromising multiple agents plus the LP's bank webhook source.

---

## How Aegis Uses 0G

Each user's agent pair (Fiat + Crypto) is minted as an **iNFT** on 0G Chain. The agent's memory, decision history, and learned LP preferences are stored encrypted on **0G Storage**. Transfer the NFT and the new owner inherits a trained agent with provable track record — not a blank slate.

```mermaid
flowchart LR
    subgraph Storage["0G Storage"]
        M[Agent Memory]
        D[Decision Logs]
        P[Payment Proofs]
    end
    
    subgraph Compute["0G Compute"]
        T[TEE Attestation]
    end
    
    subgraph Chain["0G Chain"]
        E[Escrow Contract]
        A[Agent Registry]
        I[iNFT Contract]
    end
    
    M --> I
    D --> E
    P --> E
    T --> A
```

**Storage** pins every agent decision and payment proof with Merkle roots. Anyone can verify your agent picked the best quote — not a manipulated one.

**Compute** attests agent code via TEE before each session. Users know they're running canonical binaries, not tampered versions skimming fees.

**Chain** hosts the Escrow contract with receiver commitment binding. When an LP locks tokens, they commit a hash of their payment receiver. The Attestation Agent verifies the observed receiver matches before releasing.

---

## How Aegis Uses Gensyn AXL

All four agents communicate exclusively over AXL's encrypted P2P mesh. When a buyer wants to swap, their Fiat Agent broadcasts an RFQ. LP Crypto Agents respond with signed quotes. When payment is confirmed, the Watcher forwards observations to the Attestation Agent — all peer-to-peer, all end-to-end encrypted.

```mermaid
flowchart TB
    subgraph Node1["AXL Node (Buyer)"]
        FA[Fiat Agent]
    end
    
    subgraph Node2["AXL Node (LP)"]
        CA[Crypto Agent]
    end
    
    subgraph Node3["AXL Node (Settlement)"]
        WA[Watcher Agent]
        AA[Attestation Agent]
    end
    
    FA <-->|RFQ / Quotes| CA
    WA -->|Observations| AA
    
    Node1 <-.->|Yggdrasil Mesh| Node2
    Node2 <-.->|Yggdrasil Mesh| Node3
```

Each user runs their own AXL node. Messages traverse the actual mesh between distinct OS processes. There's no central point to censor, surveil, or shut down.

MCP tools are exposed over the mesh — any agent can call another agent's capabilities without hardcoded integrations.

---

## How Aegis Uses KeeperHub

Agents reason, but they hit a wall when they need to move value. KeeperHub is the execution layer — the agents negotiate and validate, KeeperHub executes the on-chain calls.

```mermaid
flowchart LR
    subgraph KH["KeeperHub"]
        W[Webhook Trigger]
        S[Scheduled Job]
        EW[Embedded Wallet]
    end
    
    subgraph Contract["Escrow"]
        R[release]
        X[expire]
    end
    
    B[Bank/PSP] -->|Payment confirmed| W
    W -->|Validation passed| EW
    EW -->|Call| R
    
    S -->|Deadline reached| EW
    EW -->|Call| X
```

The **embedded wallet** is scoped to exactly two functions: `release()` and `expire()`. Even if workflow logic is compromised, the wallet cannot drain funds.

**Payment release**: When a bank webhook confirms payment, KeeperHub forwards to the Watcher, which validates HMAC and passes to the Attestation Agent. After evidence is pinned and commitments verified, KeeperHub executes release.

**Deadline enforcement**: A scheduled workflow monitors for orders past deadline. If buyers ghost, KeeperHub calls expire — refunding the LP and slashing the anti-grief bond.

---

## Complete Settlement Flow

A buyer wants to swap 100 USD for ETH. Here's exactly what happens:

**1. Quote Discovery** — The buyer's Fiat Agent broadcasts a request-for-quote across the AXL mesh. LP Crypto Agents listening on the network respond with signed quotes containing rate, fee, and supported payment rails (UPI, Venmo, bank transfer). The Fiat Agent scores quotes by `(rate × reputation) / fee`, logs the decision to 0G Storage, and commits to the best one.

**2. Escrow Lock** — The winning LP's Crypto Agent locks tokens into the Escrow contract on 0G Galileo. At lock time, the LP commits `keccak256(paymentReceiver)` on-chain — this is the receiver commitment. It's immutable for the life of the order. The LP cannot change payment details after locking.

**3. Fiat Payment** — The buyer sees the LP's payment details (UPI VPA, Venmo handle, bank account) and pays via their banking app. The payment reference includes the order ID for matching.

**4. Webhook Observation** — The LP's bank confirms the payment and fires a webhook to KeeperHub. The Watcher Agent receives this webhook and validates the HMAC signature using timing-safe comparison. But the Watcher cannot release funds — it can only forward the observation to the Attestation Agent over AXL.

**5. Commitment Verification** — The Attestation Agent extracts the payment receiver from the webhook payload and computes its hash. It then reads the receiver commitment from the on-chain escrow and compares. If they don't match, the order fails — preventing bait-and-switch attacks.

**6. Evidence Pinning** — If verification passes, the Attestation Agent pins the full evidence blob (webhook payload, HMAC signature, timestamps) to 0G Storage. This creates an immutable audit trail with a Merkle root for dispute resolution.

**7. Escrow Release** — The Attestation Agent triggers release via KeeperHub. The embedded wallet — scoped to only `release()` and `expire()` — calls the Escrow contract with the evidence hash. Tokens transfer to the buyer's wallet.

**If the buyer never pays:** A scheduled KeeperHub workflow monitors for orders past deadline. After timeout, it calls `expire()` — refunding the LP's tokens and slashing the buyer's anti-grief bond.

---

## Key Security Primitive

**Receiver Commitment Binding**

When an LP locks tokens, they commit `keccak256(paymentReceiver)` on-chain. This hash is immutable.

When the buyer pays and the bank fires a webhook, the Watcher extracts the actual receiver. The Attestation Agent hashes it and checks against the on-chain commitment. Release proceeds only if they match.

This prevents bait-and-switch attacks where LPs show fake payment details and claim the buyer never paid.

---

## Deployed Contracts

| Contract | 0G Galileo |
|----------|------------|
| Escrow | `0x31da867c6c12ecebbb738d97198792901431e228` |
| AgentRegistry | `0x98efa762eda5fb0c3ba02296c583a5a542c66c8b` |
| RailRegistry | `0x8c7ffc95fcd2b9dfb48272a0ceb6f54e7ce77b14` |

---

## Local Development

```bash
git clone https://github.com/arko05roy/Aegis.git && cd Aegis
pnpm install
cp .env.example .env  # add PRIVATE_KEY

# Start AXL nodes
cd services/axl-node
./node -config node-config.json &
./node -config node-config-2.json &

# Start backend
pnpm run agent-server &
pnpm run webhook-receiver &

# Start frontend
pnpm dev
```

---

## Demo

**Live:** [aegis-ten-hazel.vercel.app](https://aegis-ten-hazel.vercel.app)

---

## Sponsor Feedback

### 0G
- `Indexer` and `MemData` relationship unclear from docs — had to read SDK source
- No examples for retrieving data by Merkle root after upload
- Compute broker fails silently on insufficient balance

### Gensyn AXL
- HTTP bridge API (`/send`, `/recv`, `/topology`) undocumented — discovered by reading Go source
- No guidance on message size limits or backpressure
- MCP-over-AXL routing format unspecified

### KeeperHub
- Webhook payload schema undocumented
- Embedded wallet permission scoping unclear
- No `for-each` node in workflow builder — wrote iteration in Code action
- Chain 16602 (0G Galileo) unsupported — deployed mirror on Base Sepolia

---

## Team

**Arko Roy** — Solo Developer  
Telegram: [@arkoroy](https://t.me/arkoroy) · X: [@arko05roy](https://x.com/arko05roy)

---

## License

MIT
