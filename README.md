<p align="center">
  <img src="public/aegis-logo.png?v=2" alt="Aegis" width="200" />
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

> **You want to swap 100 USD for ETH.**

1. **Connect Wallet** — You get two AI agents: a *Fiat Agent* (handles buying) and a *Crypto Agent* (handles selling). These are minted as an iNFT on 0G Chain with memory stored on 0G Storage.

2. **Quote Discovery** — Your Fiat Agent broadcasts the swap intent across the **AXL mesh**. LP Crypto Agents respond with signed quotes. Your agent scores them and picks the best.

3. **Escrow Lock** — The LP's Crypto Agent locks ETH into the Escrow contract on **0G Chain**. At lock time, they commit `keccak256(paymentReceiver)` — this hash is immutable.

4. **Fiat Payment** — You pay the LP via UPI / Venmo / bank transfer. The payment reference includes your order ID.

5. **Webhook Observation** — Bank confirms payment, fires webhook. The **Watcher Agent** validates HMAC signature but *cannot release* — only forwards to the Attestation Agent.

6. **Commitment Verification** — The **Attestation Agent** hashes the observed receiver and checks it against the on-chain commitment. Mismatch = order fails. Match = continue.

7. **Evidence & Release** — Attestation pins proof to **0G Storage**, triggers release via **KeeperHub**. ETH moves to your wallet.

**Four agents. None can act alone. Crypto moves only when the math checks out.**

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

## Settlement Flow

```
1. Buyer           "swap 100 USD → ETH"           Fiat Agent
                                                      │
2. Fiat Agent      RFQ broadcast (AXL)            Crypto Agents
                                                      │
3. Crypto Agents   Signed quotes (AXL)            Fiat Agent
                                                      │
4. Fiat Agent      Accept best quote              Crypto Agent
                                                      │
5. Crypto Agent    Lock tokens + commitment       Escrow Contract
                                                      │
   ══════════════════════════════════════════════════════════
   │  CRYPTO LOCKED  │  RECEIVER COMMITTED ON-CHAIN  │
   ══════════════════════════════════════════════════════════
                                                      │
6. Buyer           Pay fiat                       Bank/PSP
                                                      │
7. Bank/PSP        Webhook                        Watcher Agent
                                                      │
8. Watcher         Validate HMAC, forward         Attestation Agent
                                                      │
9. Attestation     Verify commitment match        (internal)
                                                      │
10. Attestation    Pin evidence                   0G Storage
                                                      │
11. Attestation    Trigger release                KeeperHub
                                                      │
12. KeeperHub      Execute release()              Escrow Contract
                                                      │
13. Escrow         Crypto released                Buyer Wallet
```

---

## Key Security Primitive

**Receiver Commitment Binding**

When an LP locks tokens, they commit `keccak256(paymentReceiver)` on-chain. This hash is immutable.

When the buyer pays and the bank fires a webhook, the Watcher extracts the actual receiver. The Attestation Agent hashes it and checks against the on-chain commitment. Release proceeds only if they match.

This prevents bait-and-switch attacks where LPs show fake payment details and claim the buyer never paid.

---

## Deployed Contracts

| Contract | 0G Galileo | Description |
|----------|------------|-------------|
| Escrow | `0xeAD29cBfAb93ed51808D65954Dd1b3cDDaDA1348` | Holds locked crypto during settlement |
| AgentRegistry | `0x2E124DEaeD3Ba3b063356F9b45617d862e4b9dB5` | Registers agent pubkeys on-chain |
| RailRegistry | `0x0a22b6e2f0ac6cDA83C04B1Ba33aAc8e9Df6aed7` | Payment rail configuration |
| AgentINFT (ERC-7857) | `0xBf173825A08a98a0288923d00919daC13C94C70A` | Tokenizes agents as iNFTs |
| TestERC20 | `0x5F2577675beD125794FDfc44940b62D60BF00F81` | Test token for escrow |

---

## Local Development

```bash
git clone https://github.com/arko05roy/Aegis.git && cd Aegis
pnpm install
cp .env.example .env  # add PRIVATE_KEY, INFT_CONTRACT_ADDRESS

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
