<p align="center">
  <img src="https://img.shields.io/badge/AEGIS-Decentralized%20Onramp-000000?style=for-the-badge&labelColor=10B981&color=000000" alt="Aegis" />
</p>

<h1 align="center">The First Decentralized Fiat ↔ Crypto Onramp</h1>

<p align="center">
  <strong>Autonomous AI agents + zkTLS proofs + P2P negotiation.</strong><br/>
  No CEX. No custodian. No middleman.
</p>

<p align="center">
  <a href="#the-irony">The Irony</a> •
  <a href="#the-fix">The Fix</a> •
  <a href="#see-it-work">See It Work</a> •
  <a href="#why-trust-an-ai">Trust Model</a> •
  <a href="#proof">Proof</a>
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
MoonPay        →  5% fees, centralized verification, your data sold
LocalBitcoins  →  Meet strangers, hope they don't scam you
```

**$50B+ flows through these centralized onramps every year.** Aegis changes that.

---

## The Moat

**Decentralized AI agents that onramp for you.**

| What | How |
|------|-----|
| **P2P Negotiation** | Agents find LPs over encrypted mesh — no orderbook, no server |
| **zkTLS Verification** | Cryptographic proof of fiat payment from bank's TLS session |
| **Trustless Escrow** | Funds in smart contracts, released only with valid proof |
| **Verifiable Agents** | TEE-attested code — you can prove the agent isn't tampered |

No human in the loop. No company holding your money. Just agents, proofs, and contracts.

---

## The Fix

Two AI agents live in your wallet:

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   FIAT AGENT          YOU           CRYPTO AGENT               │
│   ┌─────────┐      ┌───────┐      ┌─────────┐                  │
│   │ Finds   │      │       │      │ Quotes  │                  │
│   │ best LP │ ───► │ Picks │ ◄─── │ rates   │                  │
│   │ rates   │      │       │      │         │                  │
│   └─────────┘      └───────┘      └─────────┘                  │
│        │                                │                       │
│        └────────────┬───────────────────┘                       │
│                     ▼                                           │
│              ┌─────────────┐                                    │
│              │   ESCROW    │  ← Funds here, not in agents      │
│              │  (on-chain) │                                    │
│              └─────────────┘                                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**One rule: Agents negotiate. They never touch funds.**

---

## See It Work

```
You:     "swap 100 usd → eth"

         ┌──────────────────────────────────────────────────────┐
         │  Your Fiat Agent broadcasts to LP network via AXL   │
         │  (encrypted P2P mesh, no central server)            │
         └──────────────────────────────────────────────────────┘
                                 │
                                 ▼
         ┌──────────────────────────────────────────────────────┐
         │  3 LP agents respond with quotes:                    │
         │                                                      │
         │    LP-1: 0.033 ETH @ 0.02% fee (Rep: 98%)           │
         │    LP-2: 0.032 ETH @ 0.05% fee (Rep: 95%)           │
         │    LP-3: 0.033 ETH @ 0.03% fee (Rep: 97%)           │
         └──────────────────────────────────────────────────────┘
                                 │
                                 ▼
You:     Select LP-1

         ┌──────────────────────────────────────────────────────┐
         │  0.033 ETH locked in escrow smart contract           │
         │  (not LP's wallet, not agent's wallet)              │
         └──────────────────────────────────────────────────────┘
                                 │
                                 ▼
You:     Send $100 via UPI/Venmo/Revolut

         ┌──────────────────────────────────────────────────────┐
         │  zkTLS proof generated from payment provider's TLS   │
         │  Proof pinned to 0G Storage (immutable evidence)     │
         │  KeeperHub verifies → triggers escrow release        │
         └──────────────────────────────────────────────────────┘
                                 │
                                 ▼
Result:  0.033 ETH in your wallet. No human involved.
```

**Total human touchpoints: 2** (pick quote, confirm payment)  
**Everything else: autonomous agents + smart contracts**

---

## Why Trust an AI?

You don't. That's the point.

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  PROBLEM: "What if the agent lies about rates?"                │
│                                                                 │
│  ANSWER:  Every decision logged to 0G Storage.                 │
│           Query: GET /decisions/0xYourWallet                    │
│           See exactly why it picked LP-1 over LP-2.            │
│           Cryptographic proof. Disputable on-chain.            │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  PROBLEM: "What if someone ships a malicious agent?"           │
│                                                                 │
│  ANSWER:  0G Compute TEE attests the running code.             │
│           Code hash verified before every session.              │
│           Tampered binary ≠ attested hash → rejected.          │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  PROBLEM: "What if the agent runs off with my money?"          │
│                                                                 │
│  ANSWER:  It can't. Funds sit in escrow contracts.             │
│           Agent keys can broadcast, verify, log.               │
│           Agent keys CANNOT sign escrow withdrawals.           │
│           Release requires: valid proof OR timeout.            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## The Stack

| Layer | Tech | What It Does |
|-------|------|--------------|
| **Chain** | 0G Galileo + Base | Escrow, reputation, settlement |
| **Agent Memory** | 0G Storage | Persists decisions, preferences, LP rankings |
| **Agent Integrity** | 0G Compute | TEE attestation — prove code = open source |
| **P2P Mesh** | Gensyn AXL | Encrypted agent-to-agent, no central server |
| **Automation** | KeeperHub | Deadline enforcement, payment triggers |
| **Agent Payments** | x402 | HTTP-native micropayments between agents |
| **Fiat Proof** | Reclaim zkTLS | Cryptographic proof of bank transfer |

---

## Proof

Not "it should work." It works.

| What | Tx Hash | Explorer |
|------|---------|----------|
| Agent state saved to 0G | `0x26734875...` | [View](https://chainscan-galileo.0g.ai/tx/0x267348752296ea6ac570cb13e1612b7aaef6d0c09cded81ee6d791def4bcf8bd) |
| Escrow release on Base | `0x335f7fa8...` | [View](https://sepolia.basescan.org/tx/0x335f7fa891ca6171f506de68ebdf26f2bcafd5a79d967352de390ee7fea79c34) |
| Evidence pinned (root) | `0x9eafd758...` | Stored on 0G Galileo |
| KeeperHub execution | `edlm48vm0flt...` | Live workflow |

**Contracts:**

| Contract | 0G Galileo | Base Sepolia |
|----------|------------|--------------|
| Escrow | `0x31da867c...` | `0x42A50591...` |
| AgentRegistry | `0x98efa762...` | `0xf03F328b...` |

---

## Run It

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
# Connect wallet, type "swap 100 USD → ETH"
```

---

<p align="center">
  <br/>
  <strong>Aegis</strong>
  <br/>
  <em>The onramp that doesn't require trust — because it can't break it.</em>
  <br/>
  <br/>
</p>
