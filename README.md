<p align="center">
  <img src="public/aegis-logo-v2.png" alt="Aegis" width="200" />
</p>

<h1 align="center">Aegis</h1>

<p align="center">
  <strong>A Peer-to-Peer Fiat-to-Crypto Coordination System</strong><br/>
  Autonomous agents. No custodians. No central coordinator.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/0G-Storage%20%2B%20Compute%20%2B%20Chain-00D4AA?style=flat-square" alt="0G" />
  <img src="https://img.shields.io/badge/Gensyn-AXL%20Mesh-7C3AED?style=flat-square" alt="AXL" />
  <img src="https://img.shields.io/badge/KeeperHub-Execution-FF6B35?style=flat-square" alt="KeeperHub" />
</p>

---

## What is Aegis?

Aegis is a multi-agent system where autonomous agents coordinate real-world fiat-to-crypto settlement — without any central operator.

Agents discover each other peer-to-peer, negotiate quotes, verify real-world payments, and trigger on-chain settlement — using:

* **AXL** → communication layer
* **0G** → identity, memory, and verification
* **KeeperHub** → execution boundary

**Four agents. None can act alone. Crypto moves only when the math checks out.**

---

## The Problem

Every fiat-to-crypto onramp today is centralized.

They:

* custody your funds
* control liquidity
* can freeze accounts

**The gateway to decentralization is still centralized.**

Aegis removes that gateway entirely.

---

## Why Aegis Matters

* Onramps are the last major centralized choke point in crypto
* Existing systems require trust in operators
* Autonomous agents can coordinate — but cannot safely execute

**Aegis replaces operators with verifiable agent coordination + constrained execution.**

---

## How It Works

> **You want to swap 100 USD → ETH**

1. **Connect Wallet**
   You get two agents:

   * Fiat Agent (buyer)
   * Crypto Agent (seller)

   These are minted as iNFTs on 0G Chain with persistent memory on 0G Storage.

2. **Quote Discovery (AXL Mesh)**
   Your Fiat Agent broadcasts an RFQ across the AXL network.
   LP Crypto Agents respond with signed quotes.

   Your agent selects the best quote deterministically.

3. **Escrow Lock (0G Chain)**
   The LP locks ETH into escrow and commits:

   ```
   keccak256(paymentReceiver)
   ```

   This receiver commitment is immutable.

4. **Fiat Payment (Real World)**
   You pay via UPI / bank transfer / etc.

5. **Webhook Observation (Watcher Agent)**
   Bank confirms payment → webhook fires.
   Watcher Agent:

   * validates HMAC
   * **cannot execute**
   * only forwards observation

6. **Verification (Attestation Agent)**
   Attestation Agent:

   * hashes observed receiver
   * compares with on-chain commitment

   If mismatch → fail
   If match → continue

7. **Evidence + Execution**

   * Proof pinned to 0G Storage
   * KeeperHub executes `release()`
   * ETH sent to user

**Result:**
No custody. No trust. Only verifiable coordination.

---

## The Four Agents

| Agent                 | Role                              | Trust Property   |
| --------------------- | --------------------------------- | ---------------- |
| **Fiat Agent**        | Broadcasts intent, selects quotes | No custody       |
| **Crypto Agent**      | Provides liquidity, locks funds   | Funds in escrow  |
| **Watcher Agent**     | Observes payments                 | Cannot execute   |
| **Attestation Agent** | Verifies + triggers release       | Cannot fabricate |

**Key Insight:**
Compromising one agent is not enough to steal funds.

---

## How Aegis Uses 0G

Aegis treats 0G as the **agent execution environment**.

### Identity (0G Chain)

* Agents are minted as **iNFTs (ERC-7857)**
* Transferable, persistent identities

### Memory (0G Storage)

Agents store:

* decision logs
* quote history
* LP preferences
* payment proofs

All data is pinned via **Merkle commitments**, making behavior auditable.

👉 Agents improve over time by learning which LPs perform reliably and which quotes succeed.

### Verification (0G Compute)

* Agent binaries are attested via **TEE**
* Ensures canonical execution
* Prevents tampered agent logic

### Settlement (0G Chain)

* Escrow contract enforces:

  * receiver commitments
  * deterministic release

---

## How Aegis Uses Gensyn AXL

AXL is the **coordination layer** of Aegis.

* No backend
* No message broker
* No relay server

Each agent runs on its own node.

### Communication Flow

* Fiat Agent → RFQ broadcast
* Crypto Agents → signed quotes
* Watcher → forwards payment observations
* Attestation → verifies

All messages:

* peer-to-peer
* encrypted
* routed over Yggdrasil mesh

### MCP Integration

Agents expose capabilities:

* get quote
* verify payment
* check reputation

Other agents can call these dynamically via AXL.

👉 No hardcoded integrations required.

### Real-World Scenario

A buyer in Germany and an LP in India:

* discover each other
* negotiate
* settle

**Without any shared infrastructure.**

---

## How Aegis Uses KeeperHub

Agents can reason — but they cannot safely execute.

KeeperHub is the **execution boundary**.

### Key Design

* Agents decide
* KeeperHub executes

### Execution Flow

* Webhook → Watcher → Attestation
* Valid proof → KeeperHub executes `release()`
* Timeout → KeeperHub executes `expire()`

### Security Model

Embedded wallet is scoped to:

* `release()`
* `expire()`

Nothing else.

### Guarantees

* Agents cannot move funds
* KeeperHub cannot execute invalid actions
* Workflow logic cannot exceed permissions

👉 This ensures **reliable, bounded execution**.

---

## Settlement Flow

````mermaid
sequenceDiagram
    participant FA as Fiat Agent
    participant CA as Crypto Agent
    participant WA as Watcher Agent
    participant AA as Attestation Agent
    participant E as Escrow

    FA->>CA: RFQ broadcast (AXL mesh)
    CA-->>FA: Signed quote
    FA->>CA: Accept quote
    CA->>E: Lock tokens + receiver commitment

    Note over FA,E: Buyer pays fiat via bank/UPI

    WA->>WA: Receive webhook, validate HMAC
    WA->>AA: Forward observation (AXL mesh)
    AA->>AA: Verify receiver matches commitment
    AA->>E: Pin evidence, call release()
    E->>FA: Crypto released to buyer
```text
1. Fiat Agent → RFQ (AXL)
2. Crypto Agents → Quotes
3. Fiat Agent → Selects best
4. Crypto Agent → Locks funds (0G)
5. User → Pays fiat
6. Watcher → Observes webhook
7. Attestation → Verifies
8. KeeperHub → Executes release
9. Escrow → Sends crypto
````

---

## Key Security Primitive

### Receiver Commitment Binding

At lock:

```text
keccak256(paymentReceiver)
```

At verification:

* observed receiver is hashed
* compared to commitment

Only matching values trigger release.

👉 Prevents payment spoofing or bait-and-switch attacks.

---

## Deployed Contracts

| Contract      | Address                                      | Description    |
| ------------- | -------------------------------------------- | -------------- |
| Escrow        | `0xeAD29cBfAb93ed51808D65954Dd1b3cDDaDA1348` | Settlement     |
| AgentRegistry | `0x2E124DEaeD3Ba3b063356F9b45617d862e4b9dB5` | Agent keys     |
| RailRegistry  | `0x0a22b6e2f0ac6cDA83C04B1Ba33aAc8e9Df6aed7` | Payment config |
| AgentINFT     | `0xBf173825A08a98a0288923d00919daC13C94C70A` | Agent identity |
| TestERC20     | `0x5F2577675beD125794FDfc44940b62D60BF00F81` | Test token     |

---

## Local Development

```bash
git clone https://github.com/arko05roy/Aegis.git && cd Aegis
pnpm install
cp .env.example .env

cd services/axl-node
./node -config node-config.json &
./node -config node-config-2.json &

pnpm run agent-server &
pnpm run webhook-receiver &

pnpm dev
```

---

## Demo

**Live:** [https://aegis-ten-hazel.vercel.app](https://aegis-ten-hazel.vercel.app)

---

## Sponsor Feedback

### 0G

* unclear Indexer/MemData relationship
* missing Merkle retrieval examples
* Compute broker silent failures

### Gensyn AXL

* HTTP bridge undocumented
* unclear message limits
* MCP routing unspecified

### KeeperHub

* webhook schema unclear
* wallet scoping unclear
* missing iteration tools
* Galileo unsupported (used Base Sepolia mirror)

---

## Team

**Arko Roy**
Telegram: [https://t.me/arkoroy](https://t.me/arkoroy)
X: [https://x.com/arko05roy](https://x.com/arko05roy)

---

## License

MIT
