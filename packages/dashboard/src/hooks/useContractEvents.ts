/**
 * useContractEvents — Reconstructs on-chain activity from FirmaCompany state.
 *
 * X Layer's public RPC limits eth_getLogs to 100-block ranges, making event
 * scanning impractical. Instead, we reconstruct the activity feed from the
 * contract's stored state (agent records, report count, treasury status).
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { ethers } from "ethers";

const XLAYER_RPC = "https://rpc.xlayer.tech";
const FIRMA_COMPANY_ADDRESS = "0x16660b4f71cb9e908ad672fdc4da1ac9be7e5722";
const POLL_INTERVAL_MS = 30_000;

const CONTRACT_ABI = [
  "function getAgent(uint256 _agentId) view returns (tuple(uint256 agentId, uint8 role, string roleName, address wallet, bool registered, bool active, uint256 budget, uint256 registeredAt, uint256 hiredAt))",
  "function getAgentCount() view returns (uint256)",
  "function treasuryActive() view returns (bool)",
  "function reportCount() view returns (uint256)",
];

export interface OnChainEvent {
  id: string;
  type: string;
  agentId?: number;
  detail: string;
  txHash: string;
  blockNumber: number;
  timestamp?: number;
}

function truncAddr(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function useContractEvents() {
  const [events, setEvents] = useState<OnChainEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchEvents = useCallback(async () => {
    try {
      const provider = new ethers.JsonRpcProvider(XLAYER_RPC);
      const contract = new ethers.Contract(
        FIRMA_COMPANY_ADDRESS,
        CONTRACT_ABI,
        provider,
      );

      const count = Number(await contract.getAgentCount());
      const treasuryActive = await contract.treasuryActive();
      const reportCount = Number(await contract.reportCount());

      const reconstructed: OnChainEvent[] = [];

      // Company founding event (contract deployment)
      reconstructed.push({
        id: "genesis-0",
        type: "Genesis",
        detail: `Firma company contract deployed on X Layer mainnet at ${truncAddr(FIRMA_COMPANY_ADDRESS)}`,
        txHash: FIRMA_COMPANY_ADDRESS, // contract address as reference
        blockNumber: 0,
        timestamp: undefined,
      });

      // Read each agent's state and reconstruct events
      for (let i = 1; i <= count; i++) {
        const agent = await contract.getAgent(i);
        const roleName = agent.roleName as string;
        const wallet = agent.wallet as string;
        const registeredAt = Number(agent.registeredAt);
        const hiredAt = Number(agent.hiredAt);
        const active = agent.active as boolean;
        const agentId = Number(agent.agentId);

        // Registration event
        if (registeredAt > 0) {
          reconstructed.push({
            id: `registered-${agentId}`,
            type: "AgentRegistered",
            agentId,
            detail: `${roleName} Agent (#${agentId}) registered with wallet ${truncAddr(wallet)}`,
            txHash: wallet, // wallet as reference
            blockNumber: registeredAt,
            timestamp: registeredAt,
          });
        }

        // Hire event
        if (hiredAt > 0) {
          reconstructed.push({
            id: `hired-${agentId}`,
            type: "AgentHired",
            agentId,
            detail: `${roleName} Agent (#${agentId}) hired — now active with on-chain authority`,
            txHash: wallet,
            blockNumber: hiredAt,
            timestamp: hiredAt,
          });
        }

        // If fired (registered but not active)
        if (!active && registeredAt > 0) {
          reconstructed.push({
            id: `fired-${agentId}`,
            type: "AgentFired",
            agentId,
            detail: `${roleName} Agent (#${agentId}) has been fired — operating in observation mode`,
            txHash: wallet,
            blockNumber: hiredAt + 1,
            timestamp: hiredAt > 0 ? hiredAt + 1 : undefined,
          });
        }
      }

      // Treasury status
      reconstructed.push({
        id: "treasury-status",
        type: treasuryActive ? "TreasuryResumed" : "TreasuryPaused",
        detail: treasuryActive
          ? "Treasury is active — autonomous operations enabled"
          : "Treasury is paused — all agent operations suspended",
        txHash: FIRMA_COMPANY_ADDRESS,
        blockNumber: 1,
        timestamp: undefined,
      });

      // Report count
      if (reportCount > 0) {
        reconstructed.push({
          id: "reports-summary",
          type: "OpsReportAnchored",
          detail: `${reportCount} ops report${reportCount > 1 ? "s" : ""} anchored on-chain for verifiable audit`,
          txHash: FIRMA_COMPANY_ADDRESS,
          blockNumber: 2,
          timestamp: undefined,
        });
      }

      // Sort by timestamp descending (most recent first)
      reconstructed.sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));

      if (mountedRef.current) {
        setEvents(reconstructed);
        setError(null);
        setLoading(false);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(
          err instanceof Error ? err.message : "Failed to fetch contract state",
        );
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchEvents();
    const interval = setInterval(fetchEvents, POLL_INTERVAL_MS);
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [fetchEvents]);

  return { events, loading, error, refetch: fetchEvents };
}
