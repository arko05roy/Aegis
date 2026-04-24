# Agentic Fiat ↔ Crypto Onramp — Agile Delivery Plan

## 1. Context

Every existing fiat→crypto onramp is a custodian: MoonPay, Ramp, Transak, or a CEX. That centralization drives KYC friction, geo-blocks, and freeze-risk. Human P2P (classic ZKP2P v1, LocalBitcoins) removes custody but introduces human griefing and dispute backlog. Neither model scales to the agentic web, where autonomous agents need to pay and get paid without a human on the hotpath.

This product replaces both: **the user's wallet is an agent swarm delivered as a web app.** Each user runs a **Fiat Agent** (rail credentials, fiat balance view) and a **Crypto Agent** (signer, onchain balance view). Users interact in natural language inside a **ChatGPT-style web app**. Agents negotiate via **MCP** (semantic tool calls) and meter cost via **x402** (HTTP-native crypto payments), all tunneled over **Gensyn AXL** (encrypted P2P mesh). Fiat is verified by **zkTLS** (Reclaim + ZKP2P-style circuits) against the PSP's own TLS session. Escrow + orderbook + reputation live on **0G Chain**; proof verification runs on **0G Compute**; memory + proof blobs persist on **0G Storage**. **KeeperHub** supplies automation (deadlines, slashing, AI tools).

Demo constraint: only the fiat rail and the redeemed crypto may be mocked/testnet for demo day. Every other layer — AXL transport, MCP handlers, x402 invoices, zkTLS proof gen+verify, escrow contracts, keeper jobs — ships as real, production-shaped implementations.

## 2. Product Definition

- **Shell:** Next.js 15 **web app** (single primary surface). ChatGPT-style chat UI.
- **Per-user agents:** Fiat Agent, Crypto Agent. LP-mode flips Crypto Agent into quoter + inventory manager.
- **Key custody:** passkey/WebAuthn; server-side signer is a per-user sandbox that only holds ephemeral session keys derived from the passkey assertion. No custody of fiat funds — user signs each fiat transfer.
- **Core UX:** user types `swap 100 usd → eth`; streaming progress until settled.
- **Supported rails at launch:** UPI, Venmo, Revolut (multi-rail from day 1 via `RailRegistry`).
- **Supported destination chains:** 0G, Base, Solana (one EVM, one SVM path proven).

## 3. North-Star Architecture

```
 ┌───── User browser ─────┐
 │  Next.js chat UI       │
 │  WebAuthn / passkey    │
 └──────────┬─────────────┘
            │  HTTPS + WebSocket
            ▼
 ┌───── Per-user sandbox (server-side) ─────┐
 │  Fiat Agent    Crypto Agent              │
 │  rail adapters multi-chain signer        │
 │  Reclaim WASM  inventory / quoter        │
 │           ─ MCP + x402 over HTTP ─       │
 │           local AXL node (:9002)         │
 └──────────────┬───────────────────────────┘
                │ encrypted mesh (Yggdrasil)
                ▼
 ┌── other users' agents ──┐  ┌─ external LP agents ─┐
 └─────────────────────────┘  └──────────────────────┘
                │
                ▼
 ┌─────────── 0G Chain ───────────┐   ┌── KeeperHub ──┐
 │ Escrow / Orderbook / Rep /     │◀──│ deadline,     │
 │ RailRegistry / AgentRegistry   │   │ slash, AI tools│
 └────────────┬───────────────────┘   └────────────────┘
              │                       storage: proofs, logs
              ▼                       ─────────────────────
        0G Compute ──────────── 0G Storage
```

Each signed-in user gets an isolated sandbox (container or Firecracker microVM) that hosts their Fiat Agent, Crypto Agent, and a local AXL node. The browser never talks to AXL directly; it talks to the sandbox over authenticated WebSocket, and the sandbox brokers everything else.

## 4. Tech Stack (grounded in current docs, April 2026)

| Layer | Choice | Why / source |
|---|---|---|
| Escrow / orderbook chain | **0G Chain** (EVM L1, modular) | "blockchain for AI agents," native AI composability |
| Verifiable compute | **0G Compute** | runs zkTLS verifier + LP risk/pricing models as verifiable inference |
| Durable state | **0G Storage** | proof blobs, agent memory, LP inventory snapshots |
| Agent transport | **Gensyn AXL** | HTTP bridge at `localhost:9002`, built-in MCP (`/mcp/{peer}/{svc}`) + A2A (`/a2a/{peer}`), Yggdrasil e2e encryption, NAT-transparent |
| Agent semantics | **MCP** via AXL | every agent exposes an MCP manifest; tools swap at runtime |
| Agent payments | **x402** (Coinbase / Linux Foundation) | HTTP 402 with `PAYMENT-REQUIRED` header; facilitator handles verify+settle across CAIP-2 networks; x402 Foundation launched 2026-04-02 |
| Fiat proof | **Reclaim zkTLS** + rail-specific circuits | server-side Reclaim prover (Node SDK) invoked inside each sandbox; ZKP2P-style per-rail parsers |
| Automation | **KeeperHub** | event + cron keepers, embedded non-custodial wallet, trigger/condition/action DSL, dashboard |
| Web frontend | Next.js 15 (app router) + React Server Components + WebSocket |  |
| Auth / keys | WebAuthn passkeys + ephemeral session signers in sandbox |  |
| Agent runtime | TypeScript; AI SDK; MCP server/client; per-agent SQLite for memory |  |

## 5. Protocol Specification (v1)

### 5.1 Identity
- `AgentRegistry.register(wallet, axlPubkey, role)` — wallet = identity root; AXL pubkey pinned onchain.
- Reputation is ERC-8004-portable.

### 5.2 Message surface (MCP tools exposed by each agent)
| Tool | Caller | Callee | Purpose |
|---|---|---|---|
| `rfq.get` | Buyer | LPs (broadcast topic) | advertise intent |
| `quote.sign` | LP | Buyer | signed firm quote, TTL |
| `order.commit` | Buyer | LP | commit to quote, include anti-grief bond |
| `fiat.details` | LP | Buyer | e2e-encrypted rail destination |
| `proof.submit` | Buyer | LP + Escrow | zkTLS proof payload |
| `dispute.open` | either | Keeper AI | freeze order, start arb window |

### 5.3 x402 metering points
| Invoice | From → To | Amount (typical) |
|---|---|---|
| LP lock bond | LP → Escrow | 1% of order |
| Buyer anti-grief bond | Buyer → Escrow | 1% of order |
| Keeper fee (deadline push) | LP → Keeper | ~$0.05 flat |
| AI risk-tool query | Agent → KeeperHub tool | per-call micropayment |

### 5.4 State machine (Escrow.sol)
`INIT → LOCKED → PAID → RELEASED` (happy)
`LOCKED → EXPIRED` (deadline; refund LP, slash buyer bond)
`LOCKED → DISPUTED → (RESOLVED_BUYER | RESOLVED_LP)` (arbitration)

### 5.5 End-to-end flow
1. User (browser): `swap 100 USD → ETH on 0G`.
2. Sandbox's Fiat Agent broadcasts `rfq.get` over AXL topic `fiat:USD→0G:ETH`.
3. LP Crypto Agents reply with `quote.sign`.
4. Fiat Agent scores quotes (price × reputation × rail fit) → picks one.
5. `order.commit` → LP calls `Escrow.lock()`. LP's response is HTTP 402 until bond paid via x402.
6. LP sends `fiat.details` (UPI VPA / bank) e2e-encrypted.
7. UI shows "Confirm payment" — user taps passkey; Fiat Agent invokes rail API on the user's behalf (credentials never leave the sandbox).
8. Reclaim zkTLS prover (Node) in the sandbox generates proof from the PSP's TLS session.
9. `proof.submit` → Escrow on 0G; 0G Compute verifies; tokens release to the Crypto Agent's wallet.
10. Keeper watches deadlines; slashes as needed.

### 5.6 Multi-leg
Intent parser splits `swap 100 USD → 0.3 ETH + 40 USDC on Solana` into 2 legs, runs concurrent MCP+x402 sessions with different LPs; UI streams aggregate progress.

## 6. Demo-Mode Boundary

Exactly two layers may be mocked for demo day:
1. **Fiat rail:** no real UPI/Venmo debit. Instead:
   - A local **BankSim** service exposes a deterministic TLS endpoint whose response structure matches the real rail's API.
   - Reclaim prover runs *against BankSim* in demo mode — the proof is real; only the bank is fake.
   - A `DEMO_MODE` flag in `RailRegistry` swaps the verifier contract to one that accepts BankSim's test cert.
2. **Destination crypto:** 0G testnet + Base Sepolia.

**Everything else is production-real:** sandbox isolation, AXL mesh, MCP, x402 invoices + facilitator, escrow state machine, keepers, reputation, 0G Storage persistence, multi-agent flow, web app. No stubs, no fakes.

CI enforces isolation: a boundary script greps release builds for `BankSim`, `demoVerifier`, etc., and fails if present on mainnet deploy targets.

## 7. Repository Layout

```
/contracts                         Foundry; 0G + Base deploy targets
  src/
    Escrow.sol Orderbook.sol Reputation.sol RailRegistry.sol AgentRegistry.sol
    verifiers/{Upi,Venmo,Revolut,BankSim}Verifier.sol
  test/  script/
/circuits                          Noir/Circom zkTLS per rail
  upi/ venmo/ revolut/ banksim/
/protocol
  mcp/   tool schemas, server & client helpers
  x402/  invoice/payment helpers, facilitator client
  axl/   localhost:9002 bridge client
  a2a/   envelope types
/agents
  runtime/     agent core: LLM loop, tool registry, memory, planner
  fiat-agent/  rail adapters + Reclaim prover wiring
  crypto-agent/ multi-chain signer, inventory, quoter
  zktls/       Reclaim Node SDK integration
/keepers
  jobs/        watchOrderLocked, pushExpire, watchProofSubmitted, slashOnDefault
  ai-tools/    pricing, risk, rail-router
/zerog
  compute/     verifier workloads
  storage/     pin + encrypt
/services
  banksim/     demo-only deterministic TLS bank simulator
  sandbox-orchestrator/  provisions per-user sandboxes
/apps
  web/         Next.js 15 app router (chat UI, WebSocket bridge to sandbox)
/docs          protocol spec, rail onboarding, runbooks
```

## 8. Agile Delivery Plan

**Method:** Scrum, 2-week sprints, 6 sprints (12 weeks) to demo-ready + pilot.
**Team (assumed):** 1 Protocol, 1 Contracts, 1 Agents/AI, 1 Frontend, 1 Circuits/zkTLS, 0.5 DevOps.
**DoR:** story has acceptance criteria, external deps identified, test plan stubbed.
**DoD:** merged to `main`, unit + integration tests green, code reviewed, docs updated, dashboard line added where relevant.

### Epics
- **E1 Protocol Contracts** — Escrow, Orderbook, Reputation, RailRegistry, AgentRegistry
- **E2 zkTLS Rails** — Reclaim integration + per-rail circuits + verifier contracts
- **E3 Agent Runtime** — MCP server/client, x402, intent parser, planner
- **E4 AXL Transport** — embed node per sandbox, AgentRegistry lookup, e2e tests
- **E5 Web App** — Next.js shell, chat UI, WebSocket to sandbox, passkeys
- **E6 Sandbox Orchestrator** — per-user container/microVM provisioning, key lifecycle
- **E7 LP + Keepers** — LP quoter, inventory, KeeperHub jobs + AI tools
- **E8 0G Integration** — Compute verifier, Storage persistence
- **E9 BankSim Demo Rail** — deterministic TLS sim + demo verifier + flag
- **E10 Observability + Pilot** — dashboards, red-team, 50-user pilot

### Sprint Plan

**Sprint 1 (wks 1–2) — Foundations**
- E1: `Escrow.sol` state machine + tests; `AgentRegistry`; `RailRegistry` skeleton
- E3: MCP tool schemas (`rfq`, `quote`, `commit`, `fiat-details`, `proof`); local MCP server/client
- E4: AXL node bring-up, localhost bridge client, 2-peer e2e ping
- E5: Next.js app skeleton; passkey signup/login; chat UI shell (no agent wiring)
- E9: BankSim scaffolded (deterministic JSON)
- **Sprint review demo:** two local agents negotiate an RFQ over AXL and commit onchain on 0G testnet.

**Sprint 2 (wks 3–4) — zkTLS real, one rail**
- E2: Reclaim Node SDK integrated; first real circuit against BankSim; `BankSimVerifier.sol` deployed
- E3: x402 client/server; first paid MCP call (LP lock bond); facilitator wired
- E5: WebSocket bridge from chat UI to sandbox; streaming progress events
- E6: sandbox orchestrator v0 (Docker-based, one per session)
- E7: LP agent MVP (static inventory, fixed spreads)
- **Demo:** user types intent in web app → full happy path end-to-end against BankSim + 0G testnet, real zkTLS proof.

**Sprint 3 (wks 5–6) — Production rails + keepers**
- E2: UPI circuit (real PSP response shape) behind feature flag; Venmo circuit stub
- E7: KeeperHub jobs — `pushExpire`, `slashOnDefault`, `watchProofSubmitted`; AI risk-tool (score+return)
- E1: `Reputation.sol` + slashing paths; Orderbook discovery
- E3: intent parser handles multi-leg
- **Demo:** timeout and slash paths exercised; multi-leg trade executes across two LPs.

**Sprint 4 (wks 7–8) — 0G Compute + Storage, Venmo real**
- E8: move zkTLS verification to 0G Compute (verifiable inference); Storage pins proofs + LP inventory
- E2: Venmo circuit real; Revolut circuit stub
- E7: AI pricing + rail-router tools live, metered via x402
- E3: multi-chain signer (EVM + Solana) in Crypto Agent
- **Demo:** cross-chain settlement (100 USD → USDC on Solana) via BankSim.

**Sprint 5 (wks 9–10) — Hardening**
- E6: sandbox orchestrator → Firecracker microVMs; per-user resource limits; key sealing
- E10: adversarial test matrix — LP fake-confirm, wrong-amount proof, keeper offline, AXL MITM, sybil LPs
- E2: Revolut circuit real
- E7: LP reputation decay + dispute arbitration window
- **Demo:** full adversarial drill; no path succeeds.

**Sprint 6 (wks 11–12) — Demo polish + pilot prep**
- E10: telemetry dashboards (order throughput, p50/p99 settle, stuck orders, slashes, inventory depletion)
- E9: demo-mode toggle audited; CI boundary check passes
- E5: UX pass (error states, recovery, receipts persisted on 0G Storage and linked in chat)
- E10: 50-user pilot plan (UPI only, $500 cap, 2 wks)
- **Demo day:** live, on stage, web app driving BankSim + 0G testnet + Base Sepolia; same binary boots into production mode with one env flag.

### Backlog (post-v1)
- PIX, SEPA, PayPal, CashApp circuits
- LP inventory auto-rebalancing via x402 to other LPs
- Multi-sig LP pools
- ERC-4337 paymaster on 0G so buyers pay gas in fiat
- Native mobile shells (React Native) reusing the same sandbox runtime

## 9. Acceptance Criteria (samples)

### US-01 "User swaps 100 USD to ETH"
- Given a signed-in user with Fiat+Crypto agents in a live sandbox
- When the user types `swap 100 usd to eth` and approves with passkey
- Then within 60s the Crypto Agent balance increases by the quoted ETH amount
- And the escrow on 0G shows state `RELEASED`
- And a zkTLS proof blob is pinned on 0G Storage
- And no human intervened after the passkey tap

### US-07 "LP defaults mid-trade"
- Given an order in state `LOCKED` with deadline `T`
- When the LP fails to send `fiat.details` by `T-Δ` or the buyer's proof is never accepted by `T`
- Then the keeper transitions the order to `EXPIRED`
- And slashes LP collateral or refunds buyer bond per the side at fault
- And reputation updates are visible within 2 blocks

### US-12 "Demo mode cannot leak into prod"
- Given a `main` build with `DEMO_MODE=false`
- When CI runs the boundary-check script
- Then no reference to `BankSim`, `DemoRail`, or `demoVerifier` appears in any bundled artifact
- And the `RailRegistry` deployment script excludes the demo verifier on mainnet targets

### US-15 "Sandbox isolation"
- Given two concurrent users A and B
- When A's Fiat Agent attempts to read process memory or filesystem outside its sandbox
- Then the attempt fails at the microVM boundary
- And the attempt is logged and alerted

## 10. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| PSP ToS violation | H | H | agent orchestrates, user signs; per-rail legal review; sandbox outbound IP pinned per user |
| zkTLS proof latency | M | M | optimistic UI; pre-warm Reclaim prover; offload verify to 0G Compute |
| Server-side key custody liability | H | H | passkey-derived ephemeral session keys; microVM isolation; no at-rest private keys; HSM for LP house accounts |
| 0G chain instability | M | M | fallback escrow on Base via `RailRegistry.chainId` |
| Liquidity cold-start | H | M | subsidized house LP at launch; retire as external LPs join |
| x402 facilitator downtime | L | M | self-host a facilitator; SDK supports multiple |
| Demo-mode leak to prod | L | H | CI boundary script (US-12); distinct deployer scripts |
| Sandbox orchestrator abuse | M | H | per-user rate limits, resource caps, anomaly detection |

## 11. Verification Strategy

1. **Unit** — Foundry; 100% branch on Escrow, RailRegistry, Reputation.
2. **Circuit** — per-rail test vectors from anonymized real TLS sessions.
3. **Protocol conformance** — MCP schema validator, x402 replay/idempotency, AXL chaos (drop peers mid-flow).
4. **Integration (0G testnet + Base Sepolia)** — real AXL mesh across two sandboxes on two machines, 100 trades UPI/Venmo/Revolut sandboxes via BankSim.
5. **Adversarial** — LP fake-confirm, wrong-amount proof, keeper offline, MITM on AXL, sybil LPs, rail webhook spoof, sandbox escape.
6. **E2E UI** — Playwright on web app; golden path + every failure mode rendered in chat.
7. **Boundary** — CI script enforces demo-mode isolation (US-12).
8. **Pilot** — 50 users, UPI only, $500 cap, 2 weeks; KPIs = settle time p50 ≤ 45s, stuck orders < 1%, dispute rate < 0.5%.

## 12. Critical Files to Create

- `/contracts/src/Escrow.sol`
- `/contracts/src/RailRegistry.sol`
- `/contracts/src/AgentRegistry.sol`
- `/contracts/src/verifiers/BankSimVerifier.sol`
- `/protocol/mcp/schemas.ts` (rfq/quote/commit/fiat-details/proof)
- `/protocol/x402/client.ts`, `/protocol/x402/facilitator.ts`
- `/protocol/axl/bridge.ts`
- `/agents/runtime/index.ts` (core loop)
- `/agents/fiat-agent/rails/banksim.ts`
- `/agents/fiat-agent/rails/upi.ts`
- `/agents/crypto-agent/signer.ts`
- `/agents/zktls/reclaim.ts`
- `/keepers/jobs/pushExpire.ts`, `/keepers/ai-tools/risk.ts`
- `/services/banksim/server.ts` (demo-only)
- `/services/sandbox-orchestrator/main.ts`
- `/apps/web/app/(chat)/page.tsx`
- `/apps/web/app/api/sandbox/ws/route.ts`

## Sources

- [x402 protocol site](https://www.x402.org/)
- [Coinbase x402 docs](https://docs.cdp.coinbase.com/x402/welcome)
- [coinbase/x402 GitHub](https://github.com/coinbase/x402)
- [ZKP2P docs](https://docs.peer.xyz/guides/introduction/zkp2p)
- [zkp2p-v1-monorepo](https://github.com/zkp2p/zkp2p-v1-monorepo)
- [0G documentation](https://docs.0g.ai/)
- [Gensyn AXL announcement](https://blog.gensyn.ai/introducing-axl/)
- [Gensyn AXL docs](https://docs.gensyn.ai/tech/agent-exchange-layer)
- [A2A protocol](https://a2a-protocol.org/latest/)
- [Reclaim Protocol docs](https://docs.reclaimprotocol.org/)
- [KeeperHub](https://keeperhub.com)
