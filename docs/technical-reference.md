# Firma — Reference

## Timeline
- Development start: 2026-04-10
- First mainnet tx: 2026-04-10 (contract deployment via CREATE2)
- Dashboard live with on-chain data: 2026-04-11

## Artifacts (all created after 2026-04-10)

### New Contract
| Name | Address | Method | Date |
|---|---|---|---|
| FirmaCompany | `0x16660b4f71cb9e908ad672fdc4da1ac9be7e5722` | CREATE2 via `0x4e59b44847b379578588920cA78FbF26c0B4956C` | 2026-04-10 |

### New Wallets (OKX Agentic Wallet / TEE)
| Agent | Address | Account ID | Created |
|---|---|---|---|
| Admin/Main | `0x59ba3a53944d0678721eed5ebab84c286c508184` | `b3a06b25-5128-47c3-9f4c-228009940f64` | 2026-04-10 |
| Research | `0x9efb80111171782ecda56bb5c571904444052d40` | `654d4e01-fad0-4837-8dbb-865c7bee85e2` | 2026-04-10 |
| Executor | `0xc720748924ee609d9b75b2aef69a251e24bf62a3` | `1dc7580e-3e6d-4ddb-ab27-9614954868fb` | 2026-04-10 |
| Treasury | `0xd4012e171b258ced4be057160dc2adf8dde09560` | `01856c0d-3a5b-4eb8-ab36-d292621f5e78` | 2026-04-10 |
| Ops | `0x481ae0b27669a0d852f2d06ccbdbf3275e50ab62` | `20767edd-e12d-465a-a8ba-8f95bb1a8b73` | 2026-04-10 |

### Key On-Chain Actions (Verifiable)
| Type | Status | Description |
|---|---|---|
| Contract deploy | ✅ Done | FirmaCompany via CREATE2 on X Layer mainnet |
| Agent registration | ✅ Done | 4 agents registered via `registerAgent()` |
| Agent hiring | ✅ Done | 4 agents hired via `hireAgent()` |
| Treasury activation | ✅ Done | `treasuryActive()` returns true |

### New Repos
| Repo | URL | Created |
|---|---|---|
| firma-system | (monorepo — this repository) | 2026-04-10 |

### Packages
| Package | Path | Description |
|---|---|---|
| @firma/core | `packages/core/` | Shared utilities, OnchaiosSigner, config, skills engine |
| @firma/research-agent | `packages/research-agent/` | Signal generation, market analysis |
| @firma/executor-agent | `packages/executor-agent/` | Trade execution, job runner |
| @firma/treasury-agent | `packages/treasury-agent/` | CFO — hire/fire, budget, governance |
| @firma/ops-agent | `packages/ops-agent/` | Reporting, anchoring, monitoring |
| @firma/dashboard | `packages/dashboard/` | React dashboard with live on-chain data |

### Dashboard Components Reading On-Chain Data
| Component | Data Source | Type |
|---|---|---|
| OrgChart | `getAgent()` — real wallets, roles, hire dates | Live on-chain |
| HeartbeatStatus | `getAgent()` — real active/fired status | Live on-chain |
| OnChainFeed | `getAgent()` + `getAgentCount()` — reconstructed events | Reconstructed |
| CompanyTimeline | `getAgent()` — narrative timeline from state | Reconstructed |
| CompanyPnL | `getAgentCount()` + events — real metrics | Live on-chain |
| BeTheTreasury | `getAgent()` — live governance simulation | Live + simulation |
| TreasuryDecisions | `getAgent()` + `treasuryActive()` — real status | Live on-chain |
| OpsReport | `getAgent()` + `reportCount()` — real data | Live on-chain |
| PaymentFlow | USDT `Transfer` events between agent wallets | Live on-chain |
| EconomyPulse | `balanceOf()` — real-time USDT balances | Live on-chain |

### On-Chain Economic Activity
| Category | Count | Examples |
|---|---|---|
| Contract deployment | 1 | FirmaCompany via CREATE2 |
| Agent registration + hiring | 8 | 4 agents registered + 4 hired |
| Governance actions | 10+ | fire/rehire, logDecision, budget updates |
| ACPV2 jobs (ERC-8183) | 4 | Jobs #1947-1950 |
| Agent-to-agent USDT payments | 8+ | Signal fees, budget distribution, report fees |
| Uniswap V3 swaps | 3+ | USDT→WOKB via SwapRouter |
| Ops report anchoring | 9+ | Report hashes on-chain |
| Full economic loop | 7 | Signal→payment→swap→evaluation→fire→rehire→report |
| AI governance decisions | 5 | LLM-powered signal + agent evaluation + ops report |
| **Total on-chain transactions** | **77+** | All verifiable on X Layer explorer |

### New Artifacts
- Dashboard (Vite + React + Tailwind): `packages/dashboard/`
- Demo video: *(coming soon)*
- Technical documentation (5 docs in `docs/`)

## Civilis Infrastructure (Reused)

| Contract | Address | Deployed | Role |
|---|---|---|---|
| ERC-8004 Identity | `0xC9C992C0e2B8E1982DddB8750c15399D01CF907a` | Pre-existing | Agent identity |
| ERC-8004 Reputation | `0xD8499b9A516743153EE65382f3E2C389EE693880` | Pre-existing | Performance feedback |
| ERC-8004 Validation | `0x0CC71B9488AA74A8162790b65592792Ba52119fB` | Pre-existing | Agent validation |
| ERC-8183 ACPV2 | `0xBEf97c569a5b4a82C1e8f53792eC41c988A4316e` | Pre-existing | Job escrow |

These are open, permissionless protocol-layer contracts.
Firma uses them the same way any project would use OpenZeppelin contracts or Uniswap routers.

## Uniswap V3 Integration (Official Deployment on X Layer)
| Component | Address |
|---|---|
| SwapRouter | `0x7078c4537c04c2b2e52ddba06074dbdacf23ca15` |
| Factory | `0x4b2ab38dbf28d31d467aa8993f6c2585981d6804` |
| USDT/WOKB Pool (fee=3000) | `0x63d62734847e55a266fca4219a9ad0a02d5f6e02` |
| USDT | `0x779ded0c9e1022225f8e0630b35a9b54be713736` |
| WOKB | `0xe538905cf8410324e03A5A23C1c177a474D59b2b` |

### Verified Swap Transactions
| Action | Tx Hash |
|---|---|
| USDT Approval to SwapRouter | `0xc46121936e57bae2ce46eb4a88a9a74f0721fa106db7c2c038823e286189059a` |
| Swap USDT→WOKB via exactInputSingle | `0x6f413c4adab64b37f1643cf21cf852ad76b072b88ec141d435e9e911d5993549` |
| Full-loop swap (economic cycle step 3) | `0xcd4a2b4d3ecca2943ad730dda9d1d7eefc1ae52101482f96a027640c3b672288` |

## Key Technical Innovations
1. **OnchaiosSigner** — Custom ethers.js v6 AbstractSigner that delegates all signing to OKX TEE via `onchainos` CLI
2. **Zero private keys for agent ops** — All agent signing through TEE; x402 micropayments use a dedicated payment signer (`toClientEvmSigner` from `@okxweb3/x402-evm`)
3. **CREATE2 deployment** — Contract deployed via deterministic factory (AA wallet can't CREATE directly)
4. **Graceful degradation** — Fired agents enter observation mode instead of crashing
5. **Real Uniswap V3 swaps** — Verified USDT→WOKB swap on X Layer mainnet via official SwapRouter
6. **ACPV2 job marketplace** — 4 real jobs created on ERC-8183 escrow (jobs #1947-1950)
7. **Agent-to-agent payments** — Real USDT transfers between 5 wallets on X Layer
8. **Dashboard** — 8 components reading on-chain data from X Layer contract (live RPC + reconstructed state)
9. **LLM Decision Brain** — AI agents use Claude/GPT for governance decisions with rule-based fallback; reasoning hashed and anchored on-chain
10. **Complete 7-step economic loop** — Signal generation → payment → DEX swap → evaluation → fire → rehire → report, all verified on mainnet in a single execution
