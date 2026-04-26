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
  <a href="#transaction-flow">Flow</a> •
  <a href="#security-model">Security</a> •
  <a href="#deployed-contracts">Contracts</a>
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
