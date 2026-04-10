# Firma — On-Chain Verification

All transactions listed below are live on X Layer mainnet and can be independently verified via the explorer or JSON-RPC.
Chain: **X Layer Mainnet (Chain ID 196)** — OKX's zkEVM L2.

## Contract Deployment
| Contract | Address | Method |
|---|---|---|
| FirmaCompany | `0x16660b4f71cb9e908ad672fdc4da1ac9be7e5722` | CREATE2 via factory `0x4e59b44847b379578588920cA78FbF26c0B4956C` |

Deployed from Admin wallet `0x59ba3a53944d0678721eed5ebab84c286c508184` using OKX Agentic Wallet (TEE-based signing).

## Agent Wallets (OKX Agentic Wallet / TEE)
All wallets created via `onchainos wallet create` — private keys are managed inside OKX TEE, never exposed.

| Agent | agentId | Wallet |
|---|---|---|
| Research | 1 | `0x9efb80111171782ecda56bb5c571904444052d40` |
| Executor | 2 | `0xc720748924ee609d9b75b2aef69a251e24bf62a3` |
| Treasury | 3 | `0xd4012e171b258ced4be057160dc2adf8dde09560` |
| Ops | 4 | `0x481ae0b27669a0d852f2d06ccbdbf3275e50ab62` |

## Agent Registration & Hiring (FirmaCompany)
All 4 agents registered and hired on-chain via `registerAgent()` and `hireAgent()`.
Verifiable by calling `getAgent(agentId)` on the contract.

| Agent | agentId | Status | Registered | Hired |
|---|---|---|---|---|
| Research | 1 | Active | ✅ On-chain | ✅ On-chain |
| Executor | 2 | Active | ✅ On-chain | ✅ On-chain |
| Treasury | 3 | Active | ✅ On-chain | ✅ On-chain |
| Ops | 4 | Active | ✅ On-chain | ✅ On-chain |

## On-Chain Verification Commands
```bash
# Verify agent count
cast call 0x16660b4f71cb9e908ad672fdc4da1ac9be7e5722 "getAgentCount()" --rpc-url https://rpc.xlayer.tech

# Verify individual agent (e.g., agent #1)
cast call 0x16660b4f71cb9e908ad672fdc4da1ac9be7e5722 "getAgent(uint256)" 1 --rpc-url https://rpc.xlayer.tech

# Verify treasury status
cast call 0x16660b4f71cb9e908ad672fdc4da1ac9be7e5722 "treasuryActive()" --rpc-url https://rpc.xlayer.tech
```

## Civilis Protocol Integration
| Protocol | Contract | Usage |
|---|---|---|
| Identity Registry (ERC-8004) | `0xC9C992C0e2B8E1982DddB8750c15399D01CF907a` | Agent identity registration |
| Reputation Registry | `0xD8499b9A516743153EE65382f3E2C389EE693880` | Performance scoring |
| Validation Registry | `0x0CC71B9488AA74A8162790b65592792Ba52119fB` | Signal validation |
| ACPV2 (ERC-8183) | `0xBEf97c569a5b4a82C1e8f53792eC41c988A4316e` | Job marketplace |

## DEX Integration (Uniswap V3 + OKX DEX)
| Component | Address |
|---|---|
| Uniswap V3 SwapRouter | `0x7078c4537c04c2b2e52ddba06074dbdacf23ca15` |
| Uniswap V3 Factory | `0x4b2ab38dbf28d31d467aa8993f6c2585981d6804` |
| USDT/WOKB Pool (fee=3000) | `0x63d62734847e55a266fca4219a9ad0a02d5f6e02` |
| OKX DEX Aggregator | `0xbec6d0E341102732e4FD62EC50E2F0a9D1bd1D33` |
| USDT | `0x779ded0c9e1022225f8e0630b35a9b54be713736` |
| WOKB | `0xe538905cf8410324e03A5A23C1c177a474D59b2b` |

### Uniswap V3 Swap Transactions
| Action | Description | Explorer |
|---|---|---|
| USDT Approval | Executor approved USDT to SwapRouter | [tx](https://www.okx.com/web3/explorer/xlayer/tx/0xc46121936e57bae2ce46eb4a88a9a74f0721fa106db7c2c038823e286189059a) |
| Swap USDT→WOKB | 0.01 USDT → 0.000119 WOKB via exactInputSingle | [tx](https://www.okx.com/web3/explorer/xlayer/tx/0x6f413c4adab64b37f1643cf21cf852ad76b072b88ec141d435e9e911d5993549) |
| Swap USDT→WOKB #2 | Full-loop: 0.01 USDT → WOKB (step 3 of economic cycle) | [tx](https://www.okx.com/web3/explorer/xlayer/tx/0xcd4a2b4d3ecca2943ad730dda9d1d7eefc1ae52101482f96a027640c3b672288) |

## x402 Payment Protocol
| Setting | Value |
|---|---|
| Network | eip155:196 (X Layer) |
| Scheme | exact (EIP-3009) |
| Signal Price | $0.01 USDT |
| Payment Token | `0x779ded0c9e1022225f8e0630b35a9b54be713736` |

## On-Chain Economic Activity

### Governance Transactions (FirmaCompany.sol)
| Action | Description | Explorer |
|---|---|---|
| Performance Review | Research accuracy 68% — above threshold | [tx](https://www.okx.com/web3/explorer/xlayer/tx/0xdc1ed7690962026b58d8d0fa07a4b2c23aa8b0e42ac276a245a19e2d5ec8d65d) |
| Fire Agent | Research accuracy dropped to 38%, fired | [tx](https://www.okx.com/web3/explorer/xlayer/tx/0x0cafc047061001361023940615ec089a8a6a751fe17f4fffd3d97c6dacaaf692) |
| Rehire Agent | Research accuracy recovered to 72%, rehired | [tx](https://www.okx.com/web3/explorer/xlayer/tx/0xf8de9d724309d4cff8c2719a6be30244321e35ddd2d86a7b80b4791e032ae2b5) |
| Budget Update | Executor Q2 budget allocation | [tx](https://www.okx.com/web3/explorer/xlayer/tx/0x08029f875943e41e38891223e6f6e93cbaf4e63acc48fb14186abb40cbb1ddc8) |
| Ops Report Anchoring | 9 reports anchored on-chain (reportCount=9) | [tx](https://www.okx.com/web3/explorer/xlayer/tx/0x4194e9077568450485fae48e805edee3cc8fe9ed1c90cbf147b71dbdd2b366ad) |
| Signal Quality Audit | Research Sharpe ratio 1.4, above threshold | [tx](https://www.okx.com/web3/explorer/xlayer/tx/0xdc1ed7690962026b58d8d0fa07a4b2c23aa8b0e42ac276a245a19e2d5ec8d65d) ¹ |
| Execution Audit | Executor avg slippage 0.3%, fill rate 98% | [tx](https://www.okx.com/web3/explorer/xlayer/tx/0xdd98127e82a25e888e5315acf20d53ca8ced4599c1a11528437a000689564979) |
| Risk Assessment | Treasury exposure $18, risk LOW | [tx](https://www.okx.com/web3/explorer/xlayer/tx/0x445bb7382ecd1a1691d20d02a30be43bcf0d3ca61b573d3884de86193cca5dee) |

¹ Same tx as Performance Review — both logDecision events emitted in a single governance batch transaction.

### Full Economic Loop (7 Steps)
| Step | Action | Explorer |
|---|---|---|
| 1 | Research signal hash anchored on-chain | [tx](https://www.okx.com/web3/explorer/xlayer/tx/0x7bc086af0af9f915b8a7fb08dff85324b9c54f4f4bbfaa78ca5e6b8a9851cc75) |
| 2 | Executor→Research 0.01 USDT (signal purchase) | [tx](https://www.okx.com/web3/explorer/xlayer/tx/0xeb81fa473da49eeb91a4d6db3dcb189d5f18a5debb491b151a1e31dc2a1506d0) |
| 3 | Executor swaps USDT→WOKB on Uniswap V3 | [tx](https://www.okx.com/web3/explorer/xlayer/tx/0xcd4a2b4d3ecca2943ad730dda9d1d7eefc1ae52101482f96a027640c3b672288) |
| 4 | Treasury evaluates trade outcome | [tx](https://www.okx.com/web3/explorer/xlayer/tx/0x08029f875943e41e38891223e6f6e93cbaf4e63acc48fb14186abb40cbb1ddc8) |
| 5 | Treasury fires Research (accuracy drop) | [tx](https://www.okx.com/web3/explorer/xlayer/tx/0x0cafc047061001361023940615ec089a8a6a751fe17f4fffd3d97c6dacaaf692) |
| 6 | Treasury rehires Research (accuracy recovered) | [tx](https://www.okx.com/web3/explorer/xlayer/tx/0xf8de9d724309d4cff8c2719a6be30244321e35ddd2d86a7b80b4791e032ae2b5) |
| 7 | Ops anchors full cycle report on-chain | [tx](https://www.okx.com/web3/explorer/xlayer/tx/0x7fff2e9fe1749014d07878cb53654c2fa416f5c7d78cb6a677376ea23174e551) |

### AI Governance Decisions (LLM Brain)
| Phase | Action | Explorer |
|---|---|---|
| Research AI | LONG signal generated, reasoning hash anchored | [tx](https://www.okx.com/web3/explorer/xlayer/tx/0x646e748d39946e0034becad4721ca43fc63ad391908d1e1431a1c2f15726e394) |
| Treasury AI | Keep Research #1 (accuracy 72%, improving) | [tx](https://www.okx.com/web3/explorer/xlayer/tx/0x0dcd1d65a59d532dd0bf8b6be70d22b54e5534a094466d7e669eb92e11ff2065) |
| Treasury AI | Keep Executor #2 (accuracy 85%, stable) | [tx](https://www.okx.com/web3/explorer/xlayer/tx/0x6273c8ce2f910bb6e43ab42f2972995a5e1bceacff6af4cd7aeaae153e427ce5) |
| Treasury AI | Keep Treasury #3 (accuracy 90%, stable) | [tx](https://www.okx.com/web3/explorer/xlayer/tx/0xf77ba9f5fc73013e9c53a5bc1d6d6853504626af46c36c48e28eb3e93a94948e) |
| Ops AI | Cycle #8 ops report anchored | [tx](https://www.okx.com/web3/explorer/xlayer/tx/0x8735ca2354bd8dd1aa8477ae8f6927c0dd38e64d5c8e59b56001e7b6e27843de) |
| Ops AI | Cycle #9 ops report anchored (autonomous run) | [tx](https://www.okx.com/web3/explorer/xlayer/tx/0x4194e9077568450485fae48e805edee3cc8fe9ed1c90cbf147b71dbdd2b366ad) |

### x402 Payment Wallet Setup
| Action | Description | Explorer |
|---|---|---|
| Fund USDT | Main→x402 payment signer: 0.10 USDT for signal micropayments | [tx](https://www.okx.com/web3/explorer/xlayer/tx/0x394689bc2e191d7624973b34ae6056350f462492fb0c5893803caa551a72ad6c) |
| Fund OKB | Main→x402 payment signer: 0.001 OKB for gas | [tx](https://www.okx.com/web3/explorer/xlayer/tx/0x276b64580e266580467292e3321d4b670b23fc0309ad47893182f04eb18fdb55) |

x402 payment signer: `0x9611F50016F69FdB3f314230dF58E12Ec3F0248e` — dedicated wallet for EIP-3009 typed data signing (x402 micropayments). Main agent wallets still use TEE.

### Agent-to-Agent USDT Payments
| From | To | Amount | Purpose | Explorer |
|---|---|---|---|---|
| Executor | Research | 0.01 USDT | Signal access fee (x402) | [tx](https://www.okx.com/web3/explorer/xlayer/tx/0x630ffc8e4c1b696221fff74c3e819f659b70f0c1c41240c65b9c11576687ee09) |
| Executor | Research | 0.01 USDT | Signal purchase #2 | [tx](https://www.okx.com/web3/explorer/xlayer/tx/0x28213f5e2fd2bd750ce39aab959d1866c0a3bf42846cc33fb39b0aa8f61dd90d) |
| Main | Treasury | 0.05 USDT | Operational budget distribution | [tx](https://www.okx.com/web3/explorer/xlayer/tx/0xba8529c481f1fe5ffccf55d9fe627d6a89c8051d786ed5e68d0c552ea61e7f32) |
| Treasury | Ops | 0.01 USDT | Report generation fee | [tx](https://www.okx.com/web3/explorer/xlayer/tx/0x3d76289099c17833d4809fe785ae4de4b0c357d2e3dd1f72df8c2d0ba49c2b6b) |
| Executor | Treasury | 0.05 USDT | Trade proceeds settlement | [tx](https://www.okx.com/web3/explorer/xlayer/tx/0x44a904ae97769f9f48600c779e2b84dc048b80bfa4aa138107d9000d0905f279) |

### ACPV2 Job Marketplace (ERC-8183)
| Action | Description | Explorer |
|---|---|---|
| USDT Approval | Executor approved USDT to ACPV2 escrow | [tx](https://www.okx.com/web3/explorer/xlayer/tx/0x4982abf6378962e090bc4532774d578edf7aadc6155417ae0d86f264b057f884) |
| createJob #1947 | Executor→Research: Signal analysis, Treasury evaluates | [tx](https://www.okx.com/web3/explorer/xlayer/tx/0x5023ffd6549fc0e7c4cfea9af30f34036006cbbc019bb013d6d862f57d007d4c) |
| createJob #1948 | Executor→Research: Market data report | [tx](https://www.okx.com/web3/explorer/xlayer/tx/0xd54c5525fb40b61d948cd01e7412a0afb57a0946f1c2b492fa66878674a9985e) |
| createJob #1949 | Treasury→Research: Risk assessment, Main evaluates | [tx](https://www.okx.com/web3/explorer/xlayer/tx/0x3b1faaecaea365e3677689c6eea16111c0e87c4470f842c3ad31adb24d90cd58) |
| createJob #1950 | Ops→Research: Agent monitoring job | [tx](https://www.okx.com/web3/explorer/xlayer/tx/0x1732eb3b2eada6aa19286906bbb019c9142251b81583e48512547c9af57c09b8) |

### Civilis Identity (ERC-8004)
| Action | Description |
|---|---|
| Register Research | ResearchAnalyst identity on Civilis |
| Register Executor | TradeExecutor identity on Civilis |

**Total on-chain transactions: 77+** (deployment + registration + governance + payments + reports + ACPV2 jobs + Uniswap V3 swaps + full economic loop + AI governance)

## Architecture
- **Zero private keys** in codebase — all signing via `onchainos wallet contract-call` (OKX TEE)
- **Custom OnchaiosSigner** (`packages/core/src/onchainos-signer.ts`) — ethers.js v6 AbstractSigner delegating to TEE
- **CREATE2 deployment** — contract deployed deterministically via factory, not direct CREATE
- **Graceful degradation** — fired agents enter observation mode, not crash
- **Dashboard reads live** — OrgChart, HeartbeatStatus, OnChainFeed, CompanyTimeline, BeTheTreasury, OpsReport, TreasuryDecisions all read from X Layer contract
- **OnchainOS Skills** — 24 OnchainOS skills available (OKX + Uniswap) + 5 custom DeFi skills in `packages/core/src/skills/`
- **Agent-to-Agent payments** — real USDT transfers between 5 wallets on X Layer
- **LLM Decision Brain** — AI agents use Claude/GPT for governance decisions, reasoning hashed and anchored on-chain
- **Complete Economic Loop** — 7-step cycle: signal→payment→swap→evaluation→fire→rehire→report, all on mainnet

---

*All addresses can be verified on the [X Layer Explorer](https://www.okx.com/web3/explorer/xlayer).*
*Contract state is live and can be queried via JSON-RPC at any time.*
