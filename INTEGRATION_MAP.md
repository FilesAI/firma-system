# Firma — Full Integration Map

## Firma Governance Contract
| Contract | Address | Key Events |
|---|---|---|
| FirmaCompany | `0x16660b4f71cb9e908ad672fdc4da1ac9be7e5722` | AgentRegistered, Hired, Fired, Rehired, BudgetUpdated, TreasuryPaused, OpsReportAnchored |

## Civilis Infrastructure
| Contract | Address | Functions Used |
|---|---|---|
| ERC-8004 Identity | 0xC9C9...07a | register(), getAgent() |
| ERC-8004 Reputation | 0xD849...880 | giveFeedback(), getFeedback() |
| ERC-8183 ACPV2 | 0xBEf9...16e | createJob(), fund(), submit(), complete(), reject() |

## Onchain OS Skills
| # | Skill | File | Usage | Freq |
|---|---|---|---|---|
| 1 | DEX Data API | research/monitor.ts | Pool monitoring | 60s |
| 2 | Wallet API | core/wallet.ts | Balance queries | 60s |
| 3 | x402 Server | research/x402-server.ts | Public signal sales | Per request |
| 4 | x402 Client | executor/x402-client.ts | Quick signal purchase | Per signal |
| 5 | Uniswap Skill (swap) | executor/trader.ts | Trade execution | Per signal |
| 6 | Uniswap Skill (pool) | research/analyzer.ts | LP analysis | 60s |
| 7 | Wallet API | treasury/guard.ts | Risk monitoring | 5min |

## Contract Interactions
| # | Contract | File | Usage | Freq |
|---|---|---|---|---|
| 8 | ACPV2 (Client) | executor/job-client.ts | createJob + fund | Per signal |
| 9 | ACPV2 (Provider) | research/job-provider.ts | submit | Per signal |
| 10 | ACPV2 (Evaluator) | treasury/evaluator.ts | complete/reject | Per signal |
| 11 | ERC-8004 Identity | core/civilis.ts | Agent registration | Once |
| 12 | ERC-8004 Reputation | treasury/reputation.ts | giveFeedback | Per eval |
| 13 | FirmaCompany | treasury/hire-fire.ts | Governance events | Per decision |
| 14 | FirmaCompany | ops/anchor.ts | Report anchoring | Daily |

**Total: 7 Onchain OS + 5 Civilis + 2 FirmaCompany = 14 integration points**
