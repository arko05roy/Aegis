<p align="center">
  <img src="public/aegis-logo-v2.png" alt="Aegis" width="200" />
</p>

<h1 align="center">Aegis</h1>

<p align="center">
  <strong>The first fiat-to-crypto onramp with no operator</strong><br/>
  Autonomous agents. No custodians. No central coordinator.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/0G-Storage%20%2B%20Compute%20%2B%20Chain-00D4AA?style=flat-square" alt="0G" />
  <img src="https://img.shields.io/badge/0G-APAC%20Hackathon%202026-00D4AA?style=flat-square" alt="0G APAC" />
  <img src="https://img.shields.io/badge/Track-Agentic%20Economy-7C3AED?style=flat-square" alt="Track" />
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

Aegis is the first fiat-to-crypto onramp operated by no one. A four-agent autonomous swarm — Fiat, Crypto, Watcher, Attestation — coordinates peer-to-peer, negotiates quotes through sealed inference, verifies off-chain payments, and triggers on-chain settlement. Each agent has structurally different powers, so that **no single agent can move funds alone**.

Built end-to-end on **0G's modular AI x Web3 stack** — agents are minted as iNFTs on 0G Chain, persist memory on 0G Storage, run sealed inference on 0G Compute, and settle through a 0G-native escrow with a scoped execution boundary.

- **Identity** — agents minted as iNFTs (ERC-7857) on 0G Chain with verifiable binaries
- **Memory** — KV + Log memory on 0G Storage; encrypted, Merkle-rooted, federated
- **Verification** — TEE-attested sealed inference on 0G Compute for quote ranking
- **Execution** — scoped on-chain release through a 0G escrow contract; no agent can move funds alone

---

## The Problem

Every fiat-to-crypto onramp today is centralized. They custody funds, control liquidity, and can freeze accounts.

> **The gateway to decentralization is still centralized.**

Aegis removes that gateway by replacing operators with verifiable agent coordination and constrained execution.


---

## How It Works

> Scenario: you want to swap **100 USD → ETH**.

1. **Connect Wallet** — you receive two agents (Fiat + Crypto), minted as iNFTs (ERC-7857) on 0G Chain with persistent memory on 0G Storage.
2. **Quote Discovery** — your Fiat Agent broadcasts an RFQ; LP Crypto Agents reply with signed quotes ranked by sealed inference on 0G Compute; the best is selected deterministically.
3. **Escrow Lock** — the LP locks ETH into the 0G escrow contract and commits `keccak256(paymentReceiver)`. The receiver commitment is immutable.
4. **Fiat Payment** — you pay via UPI / bank transfer.
5. **Webhook Observation** — the Watcher Agent validates the HMAC and forwards the observation. It **cannot execute**.
6. **Verification** — the Attestation Agent hashes the observed receiver and compares it to the on-chain commitment.
7. **Evidence + Execution** — proof is pinned to 0G Storage; the scoped executor calls `release()` on the 0G escrow; ETH is sent to the user.

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
    participant EX as Scoped Executor
    participant E as Escrow (0G Chain)

    U->>FA: Intent (100 USD → ETH)
    FA->>CA: RFQ broadcast
    CA-->>FA: Signed quote (ranked via 0G Compute)
    FA->>CA: Accept
    CA->>E: Lock ETH + keccak256(receiver)

    U-->>CA: Fiat payment (UPI / bank)
    WA->>WA: Webhook + HMAC validation
    WA->>AA: Forward observation
    AA->>AA: Hash receiver, compare commitment
    AA->>EX: Submit proof (pinned to 0G Storage)
    EX->>E: release()
    E-->>U: ETH released
```

### System Components

```mermaid
flowchart LR
    subgraph SWARM["Agent Swarm — Coordination"]
        FA[Fiat Agent]
        CA[Crypto Agent]
        WA[Watcher Agent]
        AA[Attestation Agent]
    end

    subgraph ZG["0G Stack — Identity / Memory / Verification / Settlement"]
        CHAIN[(0G Chain<br/>iNFT + Escrow)]
        STORE[(0G Storage<br/>Logs + Proofs)]
        TEE[(0G Compute<br/>Sealed Inference + TEE)]
        EX[Scoped Executor<br/>release / expire]
    end

    FA <--> CA
    WA --> AA
    FA --- CHAIN
    CA --- CHAIN
    AA --- STORE
    FA --- STORE
    AA --> EX
    EX --> CHAIN
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

## 0G Integration

Aegis is built end-to-end on the 0G stack. Every layer of the system — identity, memory, inference, settlement — runs on a 0G primitive.

| 0G Layer | How Aegis Uses It |
|---|---|
| **0G Chain** | Agents minted as iNFTs (ERC-7857) with embedded intelligence; escrow contract enforces `keccak256(receiver)` commitments and deterministic release; all settlement is on-chain and verifiable |
| **0G Storage** | KV memory for real-time agent state + Log memory for full settlement history; decision logs, quote history, LP reputation priors — encrypted and Merkle-rooted for auditability and federated reputation learning |
| **0G Compute** | Sealed inference (TEE-attested LLM calls) for quote ranking and counterparty reputation scoring; agent binary attestation ensures canonical, untampered execution and mitigates front-running on quote selection |
| **Agent ID** | Each agent has a persistent identity bound to its iNFT; reputation, memory, and signing keys travel with the identity across sessions |
| **Privacy / Secure Execution** | Sealed inference + TEE attestation provide execution privacy for proprietary quote ranking and reputation logic |

Agents are self-evolving: every settlement updates the reputation graph through federated learning, and the swarm continuously improves quote selection and counterparty reliability scoring across sessions via 0G Storage-backed memory.

### Bounded Execution

Agents reason; only a scoped executor — strictly limited to `release()` and `expire()` on the 0G escrow — can move funds.

| Trigger | Action |
|---|---|
| **Valid proof** | Webhook → Watcher → Attestation → Executor calls `release()` |
| **Timeout** | Executor calls `expire()` |

> Agents cannot move funds. The executor cannot execute invalid actions. Workflow logic cannot exceed permissions.

---

## 0G APAC Hackathon 2026

Aegis is a submission to the **0G APAC Hackathon** (March–May 2026), targeting **Track 3: Agentic Economy & Autonomous Applications** with crossover relevance to **Track 1 (Agentic Infrastructure)** and **Track 2 (Verifiable Finance)**.

| Hackathon Requirement | Where to Find It |
|---|---|
| 0G mainnet contract address | See [Deployed Contracts](#deployed-contracts) |
| 0G Explorer link / on-chain activity | Escrow `0xeAD29cBfAb93ed51808D65954Dd1b3cDDaDA1348` on 0G Chain |
| 0G core component integration | 0G Chain (iNFT + Escrow), 0G Storage (memory + proofs), 0G Compute (sealed inference) |
| Demo video (≤3 min) | Linked from [Live Demo](https://aegis-ten-hazel.vercel.app) |
| Architecture & docs | This README — see [Architecture](#architecture) |
| Local reproduction steps | See [Local Development](#local-development) |

**Why Aegis fits the 0G thesis:** the project depends on every flagship 0G primitive — chain, storage, compute, agent identity, sealed execution — to make a decentralized fiat-to-crypto onramp possible. Without 0G, there is no verifiable agent coordination, no persistent reputation, and no privacy-preserving quote ranking.

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

# Start agent + webhook services
pnpm run agent-server &
pnpm run webhook-receiver &

# Start frontend
pnpm dev
```

Live demo: **https://aegis-ten-hazel.vercel.app**

---

## Developer Feedback for 0G

Notes from building on the 0G stack — submitted as constructive feedback to the team:

- Indexer / MemData relationship is unclear in current docs
- Merkle retrieval examples would help onboarding
- Compute broker can fail silently; surfacing structured errors would aid debugging

---

## Team

**Arko Roy** — [Telegram](https://t.me/arkoxo) · [X](https://x.com/notarkoroy)

---

## License

MIT
