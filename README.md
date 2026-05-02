<p align="center">
  <img src="public/aegis-logo-v2.png" alt="Aegis" width="200" />
</p>

<h1 align="center">Aegis</h1>

<p align="center">
  <strong>A Decentralised Peer-to-Peer Fiat-to-Crypto Onramp</strong><br/>
  Autonomous agents. No custodians. No central coordinator.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/0G-Storage%20%2B%20Compute%20%2B%20Chain-00D4AA?style=flat-square" alt="0G" />
  <img src="https://img.shields.io/badge/Gensyn-AXL%20Mesh-7C3AED?style=flat-square" alt="AXL" />
  <img src="https://img.shields.io/badge/KeeperHub-Execution-FF6B35?style=flat-square" alt="KeeperHub" />
  <img src="https://img.shields.io/badge/License-MIT-blue?style=flat-square" alt="MIT" />
</p>

<p align="center">
  <a href="https://aegis-ten-hazel.vercel.app">Live Demo</a> ·
  <a href="#how-it-works">How It Works</a> ·
  <a href="#architecture">Architecture</a> ·
  <a href="#local-development">Run Locally</a>
</p>

---

## Overview

Aegis is a decentralised peer-to-peer fiat-to-crypto onramp powered by a multi-agent system. It coordinates real-world fiat-to-crypto settlement without a central operator. Four autonomous agents discover each other peer-to-peer, negotiate quotes, verify off-chain payments, and trigger on-chain settlement — each constrained so that **no single agent can move funds alone**.

- **AXL** — peer-to-peer communication layer
- **0G** — identity, memory, and verification
- **KeeperHub** — bounded execution boundary

---

## The Problem

Every fiat-to-crypto onramp today is centralized. They custody funds, control liquidity, and can freeze accounts.

> **The gateway to decentralization is still centralized.**

Aegis removes that gateway by replacing operators with verifiable agent coordination and constrained execution.


---

## How It Works

> Scenario: you want to swap **100 USD → ETH**.

1. **Connect Wallet** — you receive two agents (Fiat + Crypto), minted as iNFTs (ERC-7857) on 0G Chain with persistent memory on 0G Storage.
2. **Quote Discovery** — your Fiat Agent broadcasts an RFQ across the AXL mesh; LP Crypto Agents reply with signed quotes; the best is selected deterministically.
3. **Escrow Lock** — the LP locks ETH into escrow and commits `keccak256(paymentReceiver)`. The receiver commitment is immutable.
4. **Fiat Payment** — you pay via UPI / bank transfer.
5. **Webhook Observation** — the Watcher Agent validates the HMAC and forwards the observation. It **cannot execute**.
6. **Verification** — the Attestation Agent hashes the observed receiver and compares it to the on-chain commitment.
7. **Evidence + Execution** — proof is pinned to 0G Storage; KeeperHub executes `release()`; ETH is sent to the user.

**Result:** no custody, no trust — only verifiable coordination.

---

## Architecture

### Settlement Flow

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant FA as Fiat Agent
    participant CA as Crypto Agent
    participant WA as Watcher Agent
    participant AA as Attestation Agent
    participant KH as KeeperHub
    participant E as Escrow (0G)

    U->>FA: Intent (100 USD → ETH)
    FA->>CA: RFQ broadcast (AXL)
    CA-->>FA: Signed quote
    FA->>CA: Accept
    CA->>E: Lock ETH + keccak256(receiver)

    U-->>CA: Fiat payment (UPI / bank)
    WA->>WA: Webhook + HMAC validation
    WA->>AA: Forward observation (AXL)
    AA->>AA: Hash receiver, compare commitment
    AA->>KH: Submit proof
    KH->>E: release()
    E-->>U: ETH released
```

### System Components

```mermaid
flowchart LR
    subgraph AXL["AXL Mesh — Coordination"]
        FA[Fiat Agent]
        CA[Crypto Agent]
        WA[Watcher Agent]
        AA[Attestation Agent]
    end

    subgraph ZG["0G — Identity / Memory / Verification"]
        CHAIN[(0G Chain<br/>iNFT + Escrow)]
        STORE[(0G Storage<br/>Logs + Proofs)]
        TEE[(0G Compute<br/>TEE Attestation)]
    end

    subgraph EXEC["KeeperHub — Execution"]
        KH[Scoped Wallet<br/>release / expire]
    end

    FA <--> CA
    WA --> AA
    FA --- CHAIN
    CA --- CHAIN
    AA --- STORE
    FA --- STORE
    AA --> KH
    KH --> CHAIN
    TEE -.attests.-> FA
    TEE -.attests.-> CA
```

---

## The Four Agents

| Agent | Role | Trust Property |
|---|---|---|
| **Fiat Agent** | Broadcasts intent, selects quotes | No custody |
| **Crypto Agent** | Provides liquidity, locks funds | Funds in escrow |
| **Watcher Agent** | Observes off-chain payments | Cannot execute |
| **Attestation Agent** | Verifies + triggers release | Cannot fabricate |

> Compromising any single agent is insufficient to steal funds.

---

## Sponsor Integrations

### 0G — Agent Execution Environment

| Layer | Use |
|---|---|
| **0G Chain** | Agents minted as iNFTs (ERC-7857); escrow contract enforces receiver commitments and deterministic release |
| **0G Storage** | Decision logs, quote history, LP preferences, payment proofs — pinned via Merkle commitments for auditability |
| **0G Compute** | Agent binaries attested via TEE to ensure canonical, untampered execution |

Agents improve over time by learning which LPs perform reliably and which quotes succeed.

### Gensyn AXL — Coordination Layer

No backend, no broker, no relay. Each agent runs on its own node.

- **Messaging** — peer-to-peer, encrypted, routed over Yggdrasil mesh
- **MCP** — agents expose dynamic capabilities (`get_quote`, `verify_payment`, `check_reputation`); other agents call them without hardcoded integrations
- **Result** — a buyer in Germany and an LP in India discover, negotiate, and settle without shared infrastructure

### KeeperHub — Execution Boundary

Agents reason; KeeperHub executes.

- Embedded wallet scoped strictly to `release()` and `expire()`
- Webhook → Watcher → Attestation → valid proof → KeeperHub executes
- Timeout → KeeperHub executes `expire()`

> Agents cannot move funds. KeeperHub cannot execute invalid actions. Workflow logic cannot exceed permissions.

---

## Key Security Primitive — Receiver Commitment Binding

```text
At lock:         commitment = keccak256(paymentReceiver)
At verification: keccak256(observedReceiver) == commitment ?
```

Only matching values trigger release. This prevents payment spoofing and bait-and-switch attacks.

```text
  LOCK TIME                          VERIFY TIME
  ─────────                          ───────────
  receiver: alice@upi               observed: alice@upi
        │                                 │
        ▼                                 ▼
   keccak256()                       keccak256()
        │                                 │
        ▼                                 ▼
  ┌──────────┐    ==  match  ==>   ┌──────────┐
  │ 0xa3f1.. │ <─────────────────> │ 0xa3f1.. │   ✅ release()
  └──────────┘                     └──────────┘
                  ≠  mismatch              ❌ revert
```

---

## Deployed Contracts

| Contract | Address | Purpose |
|---|---|---|
| Escrow | `0xeAD29cBfAb93ed51808D65954Dd1b3cDDaDA1348` | Settlement |
| AgentRegistry | `0x2E124DEaeD3Ba3b063356F9b45617d862e4b9dB5` | Agent keys |
| RailRegistry | `0x0a22b6e2f0ac6cDA83C04B1Ba33aAc8e9Df6aed7` | Payment config |
| AgentINFT | `0xBf173825A08a98a0288923d00919daC13C94C70A` | Agent identity (ERC-7857) |
| TestERC20 | `0x5F2577675beD125794FDfc44940b62D60BF00F81` | Test token |

---

## Local Development

```bash
git clone https://github.com/arko05roy/Aegis.git && cd Aegis
pnpm install
cp .env.example .env

# Start AXL nodes
cd services/axl-node
./node -config node-config.json &
./node -config node-config-2.json &

# Start agent + webhook services
pnpm run agent-server &
pnpm run webhook-receiver &

# Start frontend
pnpm dev
```

Live demo: **https://aegis-ten-hazel.vercel.app**

---

## Sponsor Feedback

<details>
<summary><strong>0G</strong></summary>

- Unclear Indexer / MemData relationship
- Missing Merkle retrieval examples
- Compute broker silent failures
</details>

<details>
<summary><strong>Gensyn AXL</strong></summary>

- HTTP bridge undocumented
- Unclear message size limits
- MCP routing unspecified
</details>

<details>
<summary><strong>KeeperHub</strong></summary>

- Webhook schema unclear
- Wallet scoping unclear
- Missing iteration tools
- Galileo unsupported (used Base Sepolia mirror)
</details>

---

## Team

**Arko Roy** — [Telegram](https://t.me/arkoroy) · [X](https://x.com/arko05roy)

---

## License

MIT
