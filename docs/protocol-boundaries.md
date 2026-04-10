# Firma — Protocol Boundaries

Honest description of what is on-chain, what is mixed, and what is not claimed.

## Reused Civilis Protocol Layer
| Component | Status |
|---|---|
| ERC-8004 Identity Registry | Permissionless, used for agent registration |
| ERC-8004 Reputation Registry | Permissionless, used for feedback (no self-rating) |
| ERC-8183 ACPV2 | Permissionless, used for funded job escrow (USDT) |

Assumes deployed implementations match public source and remain unpaused / permissionless.

## New Firma Governance Layer
| Component | Status |
|---|---|
| FirmaCompany contract | Custom deployment, GOVERNANCE_ROLE held by Treasury Agent |
| Governance events | AgentHired/Fired/Rehired emitted on-chain |
| Ops report anchoring | Content hash committed on-chain |

## What Is Fully On-Chain
- Agent identity registration
- Job creation, funding, submission, completion/rejection
- Reputation feedback
- FirmaCompany governance events
- Ops report content hash

## What Is Mixed (on-chain + off-chain)
| Capability | On-chain | Off-chain |
|---|---|---|
| Signal analysis | Result hash in ACPV2 | Analysis logic in Node.js |
| Hire/fire decision | Event in FirmaCompany | Decision logic in Node.js |
| Ops report | Content hash on-chain | Report text generated off-chain |
| Trade execution | Swap via Uniswap Skill | Signal interpretation off-chain |

## Explicit Non-Claims

- Firma does NOT claim to fully implement ERC-8004 or ERC-8183
  - It builds on existing deployments of these standards
- Firma does NOT claim all governance is on-chain
  - Decision logic runs off-chain; decision events are anchored on-chain
- Firma does NOT claim zero-gas contract deployment
  - Agent operations on X Layer are near-zero gas
- Firma does NOT claim to be a new protocol or standard
  - It is an application built on existing protocols
- Firma does NOT reuse any Civilis transactions as its own
  - All listed transactions were created by Firma's agent wallets
