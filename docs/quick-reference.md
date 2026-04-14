# Firma — Quick Reference

> Quick-reference for key transactions and integrations. Full details in [on-chain-activity.md](on-chain-activity.md).

## At a Glance

| | |
|---|---|
| **What** | 4 AI agents running an autonomous company on X Layer mainnet |
| **Chain** | X Layer (Chain ID 196) — OKX zkEVM L2 |
| **Contract** | [`0x1666...5722`](https://www.okx.com/web3/explorer/xlayer/address/0x16660b4f71cb9e908ad672fdc4da1ac9be7e5722) |
| **Transactions** | 77+ verified on mainnet |
| **Repo** | [github.com/FirmaAI123/firma-system](https://github.com/FirmaAI123/firma-system) |
| **Dashboard** | Run locally: `pnpm install && pnpm -r build && pnpm --filter dashboard dev` |

## 5 Key Transactions

| # | What | Explorer Link |
|---|---|---|
| 1 | **Uniswap V3 Swap** — Executor swaps USDT→WOKB | [tx](https://www.okx.com/web3/explorer/xlayer/tx/0xcd4a2b4d3ecca2943ad730dda9d1d7eefc1ae52101482f96a027640c3b672288) |
| 2 | **Agent Fired** — Treasury fires Research (accuracy 38%) | [tx](https://www.okx.com/web3/explorer/xlayer/tx/0x0cafc047061001361023940615ec089a8a6a751fe17f4fffd3d97c6dacaaf692) |
| 3 | **Agent Rehired** — Research recovered (accuracy 72%) | [tx](https://www.okx.com/web3/explorer/xlayer/tx/0xf8de9d724309d4cff8c2719a6be30244321e35ddd2d86a7b80b4791e032ae2b5) |
| 4 | **ACPV2 Job** — createJob #1947 on ERC-8183 | [tx](https://www.okx.com/web3/explorer/xlayer/tx/0x5023ffd6549fc0e7c4cfea9af30f34036006cbbc019bb013d6d862f57d007d4c) |
| 5 | **Agent Payment** — Executor→Research 0.01 USDT | [tx](https://www.okx.com/web3/explorer/xlayer/tx/0x630ffc8e4c1b696221fff74c3e819f659b70f0c1c41240c65b9c11576687ee09) |

## Agent Addresses

| Agent | Wallet | Role |
|---|---|---|
| Research | `0x9efb...2d40` | Generates trading signals |
| Executor | `0xc720...62A3` | Executes Uniswap V3 swaps |
| Treasury | `0xd401...9560` | Governs — hires/fires agents |
| Ops | `0x481a...ab62` | Anchors audit reports |

All wallets created via `onchainos wallet create` (OKX TEE — private keys never exposed).

## Verify Live Contract State

```bash
# Agent count (returns 4)
cast call 0x16660b4f71cb9e908ad672fdc4da1ac9be7e5722 "getAgentCount()" --rpc-url https://rpc.xlayer.tech

# Agent #1 details
cast call 0x16660b4f71cb9e908ad672fdc4da1ac9be7e5722 "getAgent(uint256)" 1 --rpc-url https://rpc.xlayer.tech
```

## Integration Summary

- **Onchain OS**: 14 `npx onchainos` CLI skill wrappers — 11 actively invoked at runtime (swap, signals, holder distribution, price/K-line, yield, DeFi portfolio, wallet portfolio, tx tracking, gas price, token/DApp security, x402 payment, TEE wallet)
- **Uniswap AI Skills**: 6 skills actively used — swap execution, swap planning, liquidity analysis, pool analysis, viem reads, gas abstraction
- **Civilis Protocol**: ERC-8004 identity + ERC-8183 job marketplace (4 jobs created)
- **x402 Protocol**: Micropayment for signal access ($0.01 USDT per signal)
- **LLM Brain**: Claude/GPT for governance reasoning, hashed and anchored on-chain

## Dashboard Data Sources

The dashboard clearly labels each panel's data source:
- **[Live on-chain]** — Real-time RPC queries (agent status, balances, payments, jobs)
- **[Reconstructed]** — Narrative derived from on-chain state queries
- **[Live simulation]** — Same rule engine as the real Treasury Agent
- **[Verified]** — Direct explorer links to mainnet transactions
