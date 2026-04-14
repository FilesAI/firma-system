---
name: firma-governance
description: "Use this skill when the user mentions multi-agent governance, hire agent, fire agent, rehire agent, agent company, AI company, agent lifecycle, on-chain governance, agent performance, agent evaluation, governance decision, agent reputation, agent budget, treasury governance, agent hire-fire, autonomous agents, agent organization, company of agents, AI agent company, deploy agent company, register agents, governance loop, agent accountability, on-chain hire fire, FirmaCompany, firma governance, multi-agent system, agent orchestration. Provides a complete on-chain multi-agent governance system: deploy a FirmaCompany contract, register AI agents with wallets and roles, run autonomous governance loops (evaluate performance → hire/fire/rehire agents → log decisions on-chain), manage agent budgets, anchor audit reports, and integrate with Skills Discovery for DeFi opportunity execution."
license: MIT
metadata:
  author: firma
  version: "1.0.0"
  homepage: "https://github.com/FirmaAI123/firma-system"
---

# Firma Governance Skill

On-chain multi-agent governance: deploy an AI agent company where agents earn, spend, hire, and fire each other autonomously.

## Overview

The `firma-governance` skill provides a complete framework for deploying and managing a **company of AI agents** on any EVM chain. Each agent has its own wallet, budget, role, and on-chain status — governed by AI-powered hire/fire decisions anchored on-chain.

## Core Capabilities

### 1. Deploy Agent Company
Deploy a `FirmaCompany.sol` governance contract with AccessControl roles:

```
onchainos firma deploy-company --chain xlayer --admin <admin-wallet>
```

Returns: deployed contract address.

### 2. Register Agents
Register AI agents with specific roles and wallets:

```
onchainos firma register-agent \
  --contract <company-address> \
  --agent-id 1 \
  --role "Research" \
  --name "Signal Provider" \
  --wallet <agent-wallet-address>
```

Supported roles: Research, Executor, Treasury, Ops (extensible).

### 3. Governance Loop
Run an autonomous governance cycle that evaluates agent performance and makes on-chain decisions:

```
onchainos firma governance-cycle \
  --contract <company-address> \
  --evaluator <treasury-wallet>
```

The governance cycle:
1. Check agent accuracy / performance metrics
2. AI decides: **keep**, **warn**, **fire**, or **rehire**
3. Execute decision on-chain (`fireAgent()`, `rehireAgent()`, `logDecision()`)
4. Record reasoning hash on-chain for audit trail

### 4. Agent Lifecycle Management

| Action | Contract Function | Description |
|---|---|---|
| Hire | `hireAgent(id, reason)` | Activate a registered agent |
| Fire | `fireAgent(id, reason)` | Deactivate underperformer |
| Rehire | `rehireAgent(id, reason)` | Reactivate recovered agent |
| Budget | `updateBudget(id, budget, reason)` | Adjust spending limit |
| Decision | `logDecision(id, type, detail)` | Anchor governance decision |
| Report | `anchorOpsReport(hash)` | Anchor daily audit report |

### 5. Graceful Degradation
When an agent is fired, the system doesn't crash:

| Agent Role | Fired Behavior | Recovery |
|---|---|---|
| Research | Observation mode (monitors but doesn't signal) | Rehire restores signals |
| Executor | Pauses trading, observes market | Rehire resumes execution |
| Treasury | All agents auto-renew, no governance | Rehire resumes authority |
| Ops | Reports paused, economy continues | Rehire resumes reporting |

### 6. Skills Discovery Integration
Treasury agent reviews DeFi opportunities from registered skills:

```
onchainos firma review-opportunities \
  --contract <company-address> \
  --min-confidence 0.6 \
  --max-risk medium
```

Approved opportunities are executed automatically; revenue is recorded per-agent.

## Architecture

```
FirmaCompany.sol (On-chain Registry)
    │
    ├── registerAgent()   → Agent identity + wallet
    ├── hireAgent()       → Activate agent
    ├── fireAgent()       → Deactivate agent
    ├── rehireAgent()     → Reactivate agent
    ├── logDecision()     → Governance reasoning (hash)
    └── anchorOpsReport() → Daily audit trail
    
Agent Loop (per agent):
    setInterval → shouldExecute(agentId)
        → If active: run agent logic
        → If fired: graceful degradation mode
        → If rehired: resume full operation
```

## Integration with Other Skills

The firma-governance skill works with:

- **okx-agentic-wallet**: TEE-secured signing for all agent wallets
- **okx-dex-swap**: Trade execution for Executor agent
- **okx-defi-invest**: Yield scanning for Treasury
- **okx-security**: Token security scans before skill execution
- **uniswap-swap-planner**: AI-optimized swap routing
- **okx-x402-payment**: Agent-to-agent micropayments

## Smart Contract

**FirmaCompany.sol** uses OpenZeppelin AccessControl with roles:
- `DEFAULT_ADMIN_ROLE`: Company deployer
- `GOVERNANCE_ROLE`: Treasury agent (hire/fire authority)

Deployed on X Layer Mainnet: `0x16660b4f71cb9e908ad672fdc4da1ac9be7e5722`

## Example: Full Agent Company Setup

```bash
# 1. Deploy company contract
onchainos firma deploy-company --chain xlayer --admin 0x59ba...

# 2. Register 4 agents
onchainos firma register-agent --contract 0x1666... --agent-id 1 --role Research --wallet 0x9efb...
onchainos firma register-agent --contract 0x1666... --agent-id 2 --role Executor --wallet 0xc720...
onchainos firma register-agent --contract 0x1666... --agent-id 3 --role Treasury --wallet 0xd401...
onchainos firma register-agent --contract 0x1666... --agent-id 4 --role Ops --wallet 0x481a...

# 3. Start governance loop (Treasury evaluates every hour)
onchainos firma governance-cycle --contract 0x1666... --evaluator 0xd401... --interval 3600

# 4. Agents run autonomously, governed by on-chain hire/fire
```

## Why This Matters

Traditional multi-agent systems lack accountability. Firma solves this by:
- **On-chain governance**: Every hire/fire decision is verifiable
- **Economic incentives**: Agents earn via x402 payments, lose access when fired
- **Graceful degradation**: No single point of failure
- **Audit trail**: Daily reports anchored as hashes on-chain
- **Reusable**: Any team can deploy their own AI agent company
