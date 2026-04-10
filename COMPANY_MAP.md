# Firma — Company Map

## The Company

Firma is an onchain AI company with four agents, each with a distinct role, wallet, and on-chain identity.

## Agent Roles

### Research Agent (agentId: 1)
- **Role:** Signal Provider
- **Income:** ACPV2 job payments + x402 public endpoint
- **Output:** DEX analysis signals (pool monitoring, LP tracking)
- **Reports to:** Treasury (evaluated per job)

### Executor Agent (agentId: 2)
- **Role:** Trade Executor / Job Client
- **Expenses:** ACPV2 job funding (0.01 USDT per signal)
- **Output:** Uniswap swap execution based on signals
- **Reports to:** Treasury (trade results)

### Treasury Agent (agentId: 3)
- **Role:** CFO / Evaluator / Governor
- **Powers:** GOVERNANCE_ROLE on FirmaCompany contract
- **Responsibilities:**
  - Evaluate jobs (ACPV2 complete/reject)
  - Write reputation (ERC-8004 giveFeedback)
  - Hire/fire decisions (FirmaCompany governance events)
  - Budget management and risk control
- **Reports to:** No one (top of hierarchy)

### Ops Agent (agentId: 4)
- **Role:** Reporter
- **Output:** Daily operations reports, content hash anchored on-chain
- **Reports to:** Treasury

## Money Flow

```
Executor ---(fund job)--> ACPV2 Escrow ---(complete)--> Research
                                        ---(reject)---> Executor (refund)

External ---(x402 payment)--> Research

Treasury ---(profit allocation)--> All agents
```

## Governance Flow

```
Treasury evaluates Research accuracy hourly:
  accuracy > 50%  →  RENEW  →  logDecision on FirmaCompany
  accuracy < 50% × 3 cycles  →  FIRE  →  fireAgent on FirmaCompany
  accuracy recovers > 60%  →  REHIRE  →  rehireAgent on FirmaCompany
```

## On-chain Anchors

| Action | Contract | Event |
|---|---|---|
| Agent registration | FirmaCompany | AgentRegistered |
| Hire | FirmaCompany | AgentHired |
| Fire | FirmaCompany | AgentFired |
| Rehire | FirmaCompany | AgentRehired |
| Budget update | FirmaCompany | BudgetUpdated |
| Decision log | FirmaCompany | DecisionLogged |
| Ops report | FirmaCompany | OpsReportAnchored |
| Identity | ERC-8004 | (registration event) |
| Reputation | ERC-8004 | (feedback event) |
| Job lifecycle | ERC-8183 | (job events) |
