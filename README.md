<p align="center">
  <img src="assets/logo.png" alt="Firma Logo" width="120" />
</p>

<h1 align="center">Firma — Prototype Onchain Company on X Layer</h1>

> 4 AI agents that generate signals, execute trades, govern performance, and anchor reports — all on X Layer mainnet.

**77+ mainnet transactions** | **Agent-to-agent USDT payments** | **Uniswap V3 swaps** | **AI-governed hire/fire decisions**

**[On-Chain Verification](docs/on-chain-activity.md)** | **[Contract on Explorer](https://www.okx.com/web3/explorer/xlayer/address/0x16660b4f71cb9e908ad672fdc4da1ac9be7e5722)**

### What Firma Does

Four AI agents operate a prototype trading company on [X Layer](https://www.okx.com/xlayer) mainnet:

1. **Research** monitors DeFi pools → generates trading signals → sells them via x402 ($0.01 USDT/signal)
2. **Executor** buys signals → executes Uniswap V3 swaps → creates ACPV2 escrow jobs
3. **Treasury** evaluates trade outcomes → fires underperformers → rehires recovered agents → all decisions anchored on-chain with reasoning hashes
4. **Ops** generates audit reports → anchors report hashes on-chain

Agent transaction signing via OKX Agentic Wallet (TEE) — zero private keys in codebase for main agent operations. x402 micropayments use a dedicated payment signer for EIP-3009 (see [Payment Architecture](#x402-payment-protocol) for details).

> **Dashboard**: `pnpm -F @firma/dashboard dev` — reads contract state from X Layer mainnet. Some panels display live on-chain data, others show mainnet snapshots or reconstructed state (see [Data Sources](#dashboard-data-sources) table below).

## Agent Runtime Model

Each agent is a **long-running Node.js process** with `setInterval`-based loops — not a one-shot script:

| Agent | Loop Interval | What Runs Each Cycle |
|---|---|---|
| Research | 60s | Monitor pools → generate signal → enrich with Uniswap AI + onchainos intel → serve via x402 |
| Executor | 60s | Fetch signal via x402 → plan swap with AI → execute on Uniswap V3 / OKX DEX → create ACPV2 job |
| Treasury | 5min | Evaluate agent accuracy → AI governance decision (keep/fire/rehire) → log on-chain → scan yield |
| Ops | Daily | Collect agent metrics → generate report → anchor report hash on-chain |

**Entry points:** `pnpm -F @firma/research-agent start` (etc.) — each agent calls `main()` which sets up its interval loop and runs indefinitely.

**Scripts vs Agents:** The `scripts/` directory contains orchestration scripts (`run-full-loop.ts`, `live-demo.ts`) used to trigger coordinated multi-agent cycles for testing and integration verification. The agent packages themselves are designed for continuous autonomous operation.

**Autonomous run (2026-04-13):** All 4 agents started via `pnpm -F @firma/<agent> start`. Ops Agent produced on-chain report #9 ([tx `0x4194e907...`](https://www.okx.com/web3/explorer/xlayer/tx/0x4194e9077568450485fae48e805edee3cc8fe9ed1c90cbf147b71dbdd2b366ad)) within 20 seconds of startup — no manual trigger. Research Agent runs x402 signal server in production mode. Treasury Agent completed Skills Discovery scan. Total on-chain reports: 9.

## Architecture

```
                        ┌─────────────────────────────────────┐
                        │         FirmaCompany.sol            │
                        │   (On-chain Governance Registry)    │
                        │  hire() fire() rehire() logDecision │
                        └──────────┬──────────────────────────┘
                                   │
          ┌────────────────────────┼───────────────────────────┐
          │                        │                           │
    ┌─────▼──────┐          ┌──────▼───────┐           ┌──────▼──────┐
    │  Research   │  signal  │   Executor   │  evaluate │  Treasury   │
    │   Agent     │─────────▶│    Agent     │──────────▶│   Agent     │
    │  (Agent #1) │  via x402│  (Agent #2)  │  via ACPV2│  (Agent #3) │
    └─────────────┘          └──────────────┘           └──────┬──────┘
          │                        │                           │
          │ monitors               │ trades                    │ governs
          ▼                        ▼                           ▼
    ┌──────────┐           ┌──────────────┐           ┌──────────────┐
    │ Uniswap  │           │ Uniswap V3   │           │ Skills       │
    │ V3 Pools │           │ SwapRouter   │           │ Discovery    │
    │ via DEX  │           │ on X Layer   │           │ Engine       │
    │ Data API │           │              │           │ (5 DeFi      │
    └──────────┘           └──────────────┘           │  Skills)     │
                                                      └──────────────┘
                                   │
                            ┌──────▼──────┐
                            │    Ops      │
                            │   Agent     │
                            │  (Agent #4) │
                            │  Daily P&L  │
                            │  Reports    │
                            └─────────────┘
```

## The Economic Loop

```
Research Agent monitors DEX pools (Onchain OS DEX API)
    → generates trading signals
    → sells signals via x402 payment protocol ($0.01 USDT per signal)

Executor Agent buys signals via x402
    → creates ACPV2 job (ERC-8183 escrow: 0.01 USDT)
    → executes trades on Uniswap V3

Treasury Agent evaluates trade outcomes
    → records evaluation locally → governance decisions anchored on-chain via logDecision()
    → tracks accuracy → fires underperforming agents / rehires recovered ones
    → reviews DeFi opportunities from Skills Discovery Engine

Ops Agent generates daily reports
    → anchors report hash on-chain for verifiable audit trail
```

## Onchain OS Integration

| Integration | SDK/API | Purpose |
|---|---|---|
| **x402 Payment** | `@okxweb3/x402-express`, `@okxweb3/x402-fetch` | Agent-to-agent micropayments for signal access |
| **DEX Data API** | Onchain OS REST API | Real-time pool monitoring, swap history |
| **Uniswap V3** | SwapRouter `0x7078...ca15` on X Layer | Trade execution (USDT/WOKB via real pool) |
| **ERC-8183 ACPV2** | Civilis infrastructure | Job escrow with USDT settlement |
| **ERC-8004** | Identity + Reputation Registry | Agent identity & on-chain reputation scoring |
| **Skills Discovery** | Plugin architecture | Autonomous DeFi opportunity scanning |

### Onchain OS Skill Calls (onchainos CLI)

Every agent makes **real `npx onchainos` CLI calls** via `execSync()` at runtime. The table below distinguishes between skills actively invoked by agent loops and wrapper functions available but not yet called:

| Skill | CLI Command | Agent | Runtime Status |
|---|---|---|---|
| `okx-dex-swap` | `onchainos swap execute` | Executor | **Active** — `swapViaOnchainos()` in trader.ts |
| `okx-dex-signal` | `onchainos signal list` | Research | **Active** — `fetchSmartMoneySignals()` in onchain-intel.ts |
| `okx-dex-token` | `onchainos token holders` | Research | **Active** — `getTokenHolderDistribution()` in onchainos-skills.ts |
| `okx-dex-market` | `onchainos market price`, `onchainos market kline` | Research | **Active** — `fetchMarketData()` + `getTokenKline()` |
| `okx-defi-invest` | `onchainos defi search` | Treasury | **Active** — `findYieldOpportunities()` in index.ts |
| `okx-defi-portfolio` | `onchainos defi positions` | Treasury | **Active** — `getDefiPortfolioPositions()` in onchainos-skills.ts |
| `okx-wallet-portfolio` | `onchainos portfolio all-balances` | Treasury/Ops | **Active** — `getWalletPortfolio()` in index.ts + wallet-intel.ts |
| `okx-onchain-gateway` | `onchainos gateway orders`, `onchainos gateway gas` | Ops | **Active** — `getTransactionStatus()` + `getGasPrice()` |
| `okx-security` | `onchainos security token-scan`, `onchainos security dapp-scan` | Treasury | **Active** — `scanTokenSecurity()` + `scanDappSecurity()` |
| `okx-agentic-wallet` | `onchainos wallet contract-call` | All | **Active** — `OnchaiosSigner` delegates all signing to TEE |
| `okx-x402-payment` | `onchainos payment x402-pay` | Research/Executor | **Active** — `signX402Payment()` in onchainos-skills.ts |
| `okx-onchain-gateway` | `onchainos gateway broadcast` | Core | Wrapper available, not yet invoked at runtime |
| `okx-onchain-gateway` | `onchainos gateway gas-limit` | Core | Wrapper available, not yet invoked at runtime |

**11 of 14 Onchain OS skills are actively called in agent runtime loops.** All wrappers live in `packages/core/src/onchainos-skills.ts` (15 functions with typed interfaces and graceful fallbacks). Additionally, 3 agent packages have their own direct `execSync` wrappers: `onchain-intel.ts` (Research), `security-scanner.ts` (Treasury), `wallet-intel.ts` (Ops). CLI command syntax aligned with official `okx/onchainos-skills` v2.2.8 SKILL.md definitions.

### Uniswap AI Skills Integration

Firma integrates **6 Uniswap AI Skills** that are actively used in the agent runtime:

| Skill | Usage | Agent | Runtime Call |
|---|---|---|---|
| `uniswap-swap-integration` | Execute swaps via Uniswap Trading API | Executor | `executeTrade()` in trader.ts |
| `uniswap-swap-planner` | AI-optimized swap planning (slippage, routing) | Executor | `planSwapWithAI()` in trader.ts |
| `uniswap-liquidity-planner` | Concentrated liquidity depth analysis | Research | `analyzePoolWithUniswapAI()` in analyzer.ts |
| `uniswap-v4-sdk-integration` | Pool analysis via Uniswap V4 SDK | Research | `getPoolAnalysis()` in analyzer.ts |
| `uniswap-viem-integration` | Viem-based on-chain reads | Core | Contract state queries |
| `uniswap-pay-with-any-token` | Gas abstraction (pay fees in any token) | Executor | Fee payment in non-native tokens |

**How it works in practice:**

```
Research Agent:
  analyzePoolWithUniswapAI()
    → getPoolAnalysis(pool)     # uniswap-driver: liquidity depth, fee tier, IL estimate
    → compareRoutes(t0, t1, amt) # uniswap-trading: Uniswap vs OKX DEX route comparison
    → Enriched signal with confidence boost for deep liquidity pools

Executor Agent:
  planSwapWithAI(tokenIn, tokenOut, amount)
    → getPoolAnalysis()          # Compute dynamic slippage from pool depth
    → compareRoutes()            # Pick best execution route (Uniswap vs OKX)
    → Returns: { route, slippage, estimatedOutput, routeSource }
  
  executeTrade()
    → swapViaOnchainos()         # Try OKX DEX aggregator first (okx-dex-swap)
    → executeSwap()              # Fallback to direct Uniswap V3 SwapRouter
```

All Uniswap AI logic lives in `packages/core/src/uniswap-ai.ts` with typed interfaces (`UniswapQuote`, `RouteComparison`, `SwapPlan`, `PoolAnalysis`).

### x402 Payment Protocol

Firma implements the OKX x402 standard for agent-to-agent payments:

```
Executor (buyer)                     Research (seller)              OKX Facilitator
    │                                      │                            │
    │── GET /signal ──────────────────────▶│                            │
    │◀─ HTTP 402 + PaymentRequirements ───│                            │
    │   (scheme:exact, $0.01 USDT,        │                            │
    │    network:eip155:196)              │                            │
    │                                      │                            │
    │── [sign EIP-3009 USDT transfer] ──  │                            │
    │                                      │                            │
    │── GET /signal + X-PAYMENT ─────────▶│                            │
    │                                      │── verify(payload) ───────▶│
    │                                      │◀─ isValid:true ──────────│
    │◀─ 200 + Signal Data ───────────────│                            │
    │                                      │── settle(payload) ───────▶│
    │                                      │◀─ txHash ────────────────│
```

**Packages used:**
- Seller: `@okxweb3/x402-express` (Express middleware)
- Buyer: `@okxweb3/x402-fetch` (automatic 402 handling)
- EVM: `@okxweb3/x402-evm` (EIP-3009 signing on X Layer, `toClientEvmSigner`)
- Core: `@okxweb3/x402-core` (OKXFacilitatorClient)

**Payment architecture:** Main agent operations use TEE-based Agentic Wallet (zero private keys). x402 micropayments use a dedicated payment signer (`X402_PAYMENT_PRIVATE_KEY`) because the onchainos CLI does not yet support EIP-712 typed data signing. The payment signer holds only ~$0.10 USDT for signal purchases.

**Integration status:** The x402 seller (Research Agent) implements the full `@okxweb3/x402-express` middleware with on-chain settlement on X Layer. The buyer (Executor) supports both real x402 payment mode (when `X402_PAYMENT_PRIVATE_KEY` is set) and dev mode (plain fetch fallback). The dashboard's "Try x402" panel requires the Research Agent server running locally.

## Project Structure

```
firma-system/
├── contracts/
│   └── FirmaCompany.sol         # On-chain governance (AccessControl)
├── packages/
│   ├── core/                    # Shared library (23 source files)
│   │   ├── src/
│   │   │   ├── config.ts        # X Layer config, agent wallets, x402 config
│   │   │   ├── wallet.ts        # ethers.js wallet management
│   │   │   ├── onchainos.ts     # DEX API, Uniswap swap, wallet balances
│   │   │   ├── onchainos-skills.ts  # All onchainos CLI skill wrappers (11 skills)
│   │   │   ├── uniswap-ai.ts   # Uniswap AI Skills (Trading API + route optimizer)
│   │   │   ├── civilis.ts       # ERC-8183 ACPV2 jobs, ERC-8004 identity
│   │   │   ├── firma-company.ts # FirmaCompany.sol contract interface
│   │   │   ├── resilience.ts    # Graceful degradation (fire/rehire)
│   │   │   ├── onchainos-signer.ts  # Custom ethers.js AbstractSigner → TEE
│   │   │   ├── llm-brain.ts    # LLM decision engine (Claude/GPT + fallback)
│   │   │   ├── skills/          # DeFi skill plugin system
│   │   │   │   ├── types.ts             # ISkillPlugin interface
│   │   │   │   ├── skill-registry.ts    # Central skill registry
│   │   │   │   ├── discovery-engine.ts  # Autonomous opportunity scanner
│   │   │   │   ├── uniswap-v3-skill.ts  # Uniswap V3 swap skill
│   │   │   │   ├── dex-aggregator-skill.ts  # OKX DEX aggregator
│   │   │   │   ├── lending-skill.ts     # Lending rate discovery (OKX DeFi API)
│   │   │   │   ├── yield-farming-skill.ts   # LP discovery (real pool queries)
│   │   │   │   └── bridge-skill.ts      # Bridge discovery (OKX cross-chain API)
│   │   │   └── marketplace/     # Open agent marketplace
│   │   │       ├── types.ts
│   │   │       └── agent-marketplace.ts
│   │   └── ...
│   ├── research-agent/          # Signal generation + x402 server
│   │   ├── src/
│   │   │   ├── index.ts         # Main loop + graceful degradation
│   │   │   ├── monitor.ts       # Pool monitor (DEX Data API polling)
│   │   │   ├── analyzer.ts      # Signal generation (LP/swap analysis)
│   │   │   ├── x402-server.ts   # x402 payment-protected signal endpoint
│   │   │   └── job-provider.ts  # ACPV2 job deliverable submission
│   │   └── ...
│   ├── executor-agent/          # Trade execution + x402 client
│   │   ├── src/
│   │   │   ├── index.ts         # Main loop + graceful degradation
│   │   │   ├── trader.ts        # Uniswap V3 swap execution
│   │   │   ├── x402-client.ts   # x402 payment-enabled signal fetcher
│   │   │   ├── job-client.ts    # ACPV2 job creation + funding
│   │   │   └── reporter.ts     # Trade accuracy tracking
│   │   └── ...
│   ├── treasury-agent/          # Governance + Skills Discovery
│   │   ├── src/
│   │   │   ├── index.ts         # Governance loop + Skills Discovery Engine
│   │   │   ├── evaluator.ts     # Job evaluation (complete/reject)
│   │   │   ├── hire-fire.ts     # Governance engine (hire/fire/rehire)
│   │   │   ├── reputation.ts   # ERC-8004 reputation management
│   │   │   ├── allocator.ts    # Company P&L tracking
│   │   │   └── guard.ts        # Risk guard (balance monitoring)
│   │   └── ...
│   ├── ops-agent/               # Daily operational reports
│   │   ├── src/
│   │   │   ├── index.ts         # Report generation + anchoring
│   │   │   ├── report-gen.ts    # Report data collection
│   │   │   ├── anchor.ts       # On-chain hash anchoring
│   │   │   └── templates.ts    # Markdown + X post formatting
│   │   └── ...
│   └── dashboard/               # React frontend (Vite + Tailwind)
│       └── src/
│           ├── App.tsx          # Main app with 10 sections
│           └── components/      # UI components
└── ...
```

## Smart Contract

**FirmaCompany.sol** — On-chain governance registry for AI agent lifecycle management.

| Function | Access | Description |
|---|---|---|
| `registerAgent(id, role, name, wallet)` | Admin | One-time agent registration |
| `hireAgent(id, reason)` | Governance | Activate an agent |
| `fireAgent(id, reason)` | Governance | Deactivate underperforming agent |
| `rehireAgent(id, reason)` | Governance | Reactivate recovered agent |
| `updateBudget(id, budget, reason)` | Governance | Adjust agent spending limit |
| `logDecision(id, type, detail)` | Governance | Record governance decision |
| `anchorOpsReport(hash)` | Governance | Anchor daily report hash |
| `pauseTreasury(reason)` | Governance | Emergency pause |
| `resumeTreasury(reason)` | Governance | Resume after pause |
| `isAgentActive(id)` | View | Check agent status |
| `getAgent(id)` / `getAgentCount()` | View | Query agent data |

**Deployed on X Layer Mainnet (Chain ID: 196)**
- Contract: `0x16660b4f71cb9e908ad672fdc4da1ac9be7e5722`
- Network: X Layer Mainnet (`https://rpc.xlayer.tech`)
- Explorer: `https://www.okx.com/web3/explorer/xlayer`

## Graceful Degradation

When an agent is fired on-chain, the system doesn't crash — it degrades gracefully:

| Agent | Fired Behavior | Recovery |
|---|---|---|
| **Research** | Continues pool monitoring (observation mode), x402 serves last known signal | Rehire restores full signal generation |
| **Executor** | Pauses trading, still fetches signals for observation | Rehire resumes trade execution |
| **Treasury** | All agents auto-renew, no governance decisions | Rehire resumes hire/fire authority |
| **Ops** | Daily reports paused, economy continues | Rehire resumes reporting |

## Skills Plugin System

The Skills Discovery Engine autonomously scans DeFi protocols for opportunities:

```
DiscoveryEngine.scan()
    → UniswapV3Skill.discover()      # Pool volume/price analysis
    → DexAggregatorSkill.discover()  # Cross-DEX arbitrage detection
    → LendingSkill.discover()        # Supply/borrow rate monitoring
    → YieldFarmingSkill.discover()   # LP yield optimization
    → BridgeSkill.discover()         # Cross-chain price spreads

    → Filter (risk, confidence, capital)
    → Rank (Sharpe-like score = return / risk * confidence)
    → Queue for Treasury approval
    → Treasury reviews & executes approved opportunities
```

**ISkillPlugin Interface:**
```typescript
interface ISkillPlugin {
  metadata: SkillMetadata;
  initialize(): Promise<void>;
  discover(): Promise<Opportunity[]>;
  evaluate(opportunity: Opportunity): Promise<EvaluationResult>;
  execute(opportunity: Opportunity): Promise<ExecutionResult>;
  monitor(): Promise<ActivePosition[]>;
  healthCheck(): Promise<SkillHealth>;
  shutdown(): Promise<void>;
}
```

## Civilis Infrastructure (ERC-8183 + ERC-8004)

| Standard | Contract | Purpose |
|---|---|---|
| **ERC-8183 ACPV2** | `0xBEf97c569a5b4a82C1e8f53792eC41c988A4316e` | Job escrow: createJob → setProvider → claimRefund |
| **ERC-8004 Identity** | `0xC9C992C0e2B8E1982DddB8750c15399D01CF907a` | Agent identity registration |
| **ERC-8004 Reputation** | `0xD8499b9A516743153EE65382f3E2C389EE693880` | On-chain feedback (+1/-1) |

## AI Decision Engine

Treasury governance decisions are powered by an LLM brain with rule-based fallback:

```
┌─────────────────────────────────────────────────┐
│ LLM Decision Engine (llm-brain.ts)              │
│                                                 │
│ 1. Try Anthropic Claude (claude-haiku-4-5-20251001) │
│ 2. Try OpenAI (gpt-4o-mini)                     │
│ 3. Fallback: Rule-based engine                  │
│                                                 │
│ Output: { decision, reasoning, confidence }     │
│ Hash:   keccak256(reasoning) → on-chain anchor  │
└─────────────────────────────────────────────────┘
```

The dashboard's "Be the Treasury" simulator uses the **same rule engine** as the real agents, so anyone can experience AI governance decisions firsthand.

## Testing

```bash
npm test    # 84 tests across 10 test files
```

| Test Suite | Tests | Coverage |
|---|---|---|
| config | 4 | Environment & contract address validation |
| skills | 6 | Skill registry CRUD, key lookups |
| resilience | 8 | Graceful degradation per role |
| marketplace | 9 | Agent hiring/firing marketplace |
| llm-brain | 8 | LLM decision parsing, fallback logic |
| discovery-engine | 8 | Autonomous opportunity scanning |
| civilis | 6 | ACPV2 + ERC-8004 integration |
| treasury-brain | 12 | AI governance decisions (fire/keep/warn/rehire) |
| onchainos-skills | 16 | All 14 onchainos CLI wrappers (swap, gas, yield, portfolio, signals, x402, security) |
| uniswap-ai | 7 | Uniswap Trading API, route comparison, swap planning, pool analysis |

## Quick Start

### Prerequisites

- Node.js >= 18
- pnpm
- OKX API credentials (`OKX_API_KEY`, `OKX_SECRET_KEY`, `OKX_PASSPHRASE`)
- OKB for gas on X Layer

### Installation

```bash
git clone https://github.com/FirmaAI123/firma-system.git
cd firma-system
pnpm install
```

### Environment Setup

```bash
cp .env.example .env
```

Required environment variables:
```env
# OKX API (for DEX Data API + x402 Facilitator)
OKX_API_KEY=your_api_key
OKX_SECRET_KEY=your_secret_key
OKX_PASSPHRASE=your_passphrase

# Agent Wallets (OKX Agentic Wallet / TEE — no private keys needed)
MAIN_WALLET_ADDRESS=0x...
MAIN_WALLET_ACCOUNT_ID=uuid-from-onchainos
RESEARCH_WALLET_ADDRESS=0x...
RESEARCH_WALLET_ACCOUNT_ID=uuid-from-onchainos
EXECUTOR_WALLET_ADDRESS=0x...
EXECUTOR_WALLET_ACCOUNT_ID=uuid-from-onchainos
TREASURY_WALLET_ADDRESS=0x...
TREASURY_WALLET_ACCOUNT_ID=uuid-from-onchainos
OPS_WALLET_ADDRESS=0x...
OPS_WALLET_ACCOUNT_ID=uuid-from-onchainos

# Contract
FIRMA_COMPANY_ADDRESS=0x16660b4f71cb9e908ad672fdc4da1ac9be7e5722

# X Layer
XLAYER_RPC=https://rpc.xlayer.tech
USDT_ADDRESS=0x1E4a5963aBFD975d8c9021ce480b42188849D41d
```

### Build & Run

```bash
# Build all packages
pnpm -r build

# Run each agent (in separate terminals)
pnpm -F @firma/research-agent start
pnpm -F @firma/executor-agent start
pnpm -F @firma/treasury-agent start
pnpm -F @firma/ops-agent start

# Run dashboard
pnpm -F @firma/dashboard dev
```

## How It's Different

| Aspect | Traditional DAO | Multi-sig Wallet | Single AI Agent | **Firma** |
|---|---|---|---|---|
| Decision making | Token voting | N-of-M signers | One model | 4 specialized agents |
| Economic activity | Proposal-based | Manual | API calls | Autonomous on-chain |
| Accountability | Governance tokens | Signer reputation | None | On-chain hire/fire |
| Revenue model | Treasury allocation | N/A | N/A | Agent-to-agent x402 payments |
| Resilience | Governance freeze | Key loss risk | Single point of failure | Graceful degradation |

**vs. Credit-scoring agents** (e.g. on-chain credit protocols): Those projects focus on *evaluating human borrowers*. Firma focuses on *governing AI agents themselves* — agents that earn, spend, and get hired/fired based on on-chain performance. The accountability layer is the product, not a feature of a lending protocol.

## Tech Stack

| Layer | Technology |
|---|---|
| **Blockchain** | X Layer (Chain ID 196, zkEVM L2) |
| **Smart Contracts** | Solidity 0.8.20, OpenZeppelin AccessControl |
| **Agent Runtime** | TypeScript, Node.js |
| **DeFi Integration** | Uniswap V3 + 6 Uniswap AI Skills, OKX DEX Aggregator, 14 onchainos CLI skill calls |
| **Payment Protocol** | OKX x402 (EIP-3009 on X Layer) |
| **Job Escrow** | ERC-8183 ACPV2 (Civilis) |
| **Identity** | ERC-8004 (Civilis) |
| **Frontend** | React 18, Vite, Tailwind CSS |
| **Wallet** | ethers.js v6 + viem (x402) |

## Business Model

```
Signal Subscription     ─── Research Agent earns $0.01/signal via x402
Trade Execution         ─── Executor pays for signals, earns from trades
Governance Fees         ─── Treasury takes evaluation fees from ACPV2 jobs
Skills Revenue          ─── DeFi opportunities generate automated returns
Ops Reporting           ─── Verifiable audit trail on-chain
```

## Dashboard Data Sources

The React dashboard reads data from multiple sources with different trust levels:

| Component | Source | Type |
|---|---|---|
| OrgChart, HeartbeatStatus | `getAgent()` via X Layer RPC | **Live on-chain** |
| TreasuryDecisions | `getAgent()` + `treasuryActive()` | **Live on-chain** |
| On-Chain Feed | Reconstructed from `getAgent()` state | **Reconstructed** (not raw event logs) |
| Company Timeline | Narrative from contract state | **Reconstructed** |
| Economy Pulse | `eth_getBalance` per agent wallet | **Live on-chain** |
| ACPV2 Jobs | `getJob()` on ACPV2 contract | **Live on-chain** |
| Payment Flow | USDT `Transfer` events between agent wallets | **Live on-chain** |
| Be the Treasury | Rule engine + `getAgent()` | **Live + simulation** |
| Skills, Marketplace | Static data | **Design preview** |
| Try x402 | Local Research Agent endpoint | **Requires local server** |

## Agent Wallets (Agentic Wallet / TEE)

All agent wallets are created via `onchainos wallet create`. Private keys live inside OKX TEE — never exposed in code.

| Agent | Role | agentId | Wallet Address | Status |
|---|---|---|---|---|
| Admin/Main | Company deployer | — | `0x59ba3a53944d0678721eed5ebab84c286c508184` | Deployer |
| Research | Signal Provider | 1 | `0x9efb80111171782ecda56bb5c571904444052d40` | Active |
| Executor | Trade Runner | 2 | `0xc720748924ee609d9b75b2aef69a251e24bf62a3` | Active |
| Treasury | Governor / CFO | 3 | `0xd4012e171b258ced4be057160dc2adf8dde09560` | Active |
| Ops | Audit & Reports | 4 | `0x481ae0b27669a0d852f2d06ccbdbf3275e50ab62` | Active |

All agent status is verifiable on-chain: call `getAgent(agentId)` on FirmaCompany at `0x16660b4f71cb9e908ad672fdc4da1ac9be7e5722`.

## Deployment Addresses

| Contract / Protocol | Address | Network |
|---|---|---|
| **FirmaCompany** (governance) | [`0x16660b4f71cb9e908ad672fdc4da1ac9be7e5722`](https://www.okx.com/web3/explorer/xlayer/address/0x16660b4f71cb9e908ad672fdc4da1ac9be7e5722) | X Layer Mainnet (196) |
| ERC-8183 ACPV2 (job escrow) | `0xBEf97c569a5b4a82C1e8f53792eC41c988A4316e` | X Layer Mainnet |
| ERC-8004 Identity | `0xC9C992C0e2B8E1982DddB8750c15399D01CF907a` | X Layer Mainnet |
| ERC-8004 Reputation | `0xD8499b9A516743153EE65382f3E2C389EE693880` | X Layer Mainnet |
| Uniswap V3 SwapRouter | `0x7078c4537c04c2b2e52ddba06074dbdacf23ca15` | X Layer Mainnet |
| USDT (native, x402+Uniswap) | `0x779ded0c9e1022225f8e0630b35a9b54be713736` | X Layer Mainnet |
| USDT (bridged, agent ops) | `0x1E4a5963aBFD975d8c9021ce480b42188849D41d` | X Layer Mainnet |

## X Layer Ecosystem Positioning

Firma explores what a **prototype AI-managed company** looks like on X Layer:

- **X Layer as the settlement layer**: All governance decisions, job escrows, payments, and audit reports are anchored on X Layer mainnet — 77+ verified transactions.
- **Onchain OS as the AI infrastructure**: Agentic Wallets provide TEE-secured signing for all 5 wallets. The custom `OnchaiosSigner` (ethers.js AbstractSigner) delegates every `signTransaction()` call to `onchainos wallet contract-call`.
- **Uniswap V3 + Uniswap AI Skills as the DeFi engine**: Executor performs real USDT→WOKB swaps on X Layer. 6 Uniswap AI Skills provide route optimization, liquidity analysis, dynamic slippage, and pool intelligence. Research enriches signals with Uniswap pool depth and route comparison data.
- **Civilis (ERC-8183 + ERC-8004) as the job marketplace**: 4 ACPV2 escrow jobs created on-chain; agent identity and reputation registered via ERC-8004.
- **x402 as the payment protocol**: Agent-to-agent micropayments ($0.01/signal) using `@okxweb3/x402-express` and `@okxweb3/x402-fetch` with EIP-3009 signing on X Layer.
- **14 Onchain OS skill calls**: Every agent makes real `npx onchainos` CLI calls — DEX swap, smart money signals, holder analysis, K-line/price data, yield search, DeFi portfolio, wallet portfolio, tx tracking, gas price, token security, DApp security, x402 payment, gateway broadcast, and TEE wallet signing. CLI syntax aligned with official `okx/onchainos-skills` v2.2.8.
- **Skills as reusable modules**: 5 DeFi skills (Uniswap V3, DEX aggregator, lending, yield farming, bridge) plugged into the Discovery Engine, plus 6 Uniswap AI Skills for intelligent execution.

**Use case**: Firma serves as a reference implementation for multi-agent economic systems on X Layer — each agent with its own wallet, budget, and on-chain authority, governed by AI-powered hire/fire decisions.

## Team

| Member | Role |
|---|---|
| NIK | Architecture, smart contracts, agents, dashboard, DevOps |

## License

MIT
