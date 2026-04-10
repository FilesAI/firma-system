import { useState, useEffect } from "react";
import { ethers } from "ethers";

const XLAYER_RPC = "https://rpc.xlayer.tech";
const FIRMA_COMPANY_ADDRESS = "0x16660b4f71cb9e908ad672fdc4da1ac9be7e5722";

const FIRMA_ABI = [
  "function getAgent(uint256 _agentId) view returns (tuple(uint256 agentId, uint8 role, string roleName, address wallet, bool registered, bool active, uint256 budget, uint256 registeredAt, uint256 hiredAt))",
  "function getAgentCount() view returns (uint256)",
  "function isAgentActive(uint256 _agentId) view returns (bool)",
  "function treasuryActive() view returns (bool)",
  "function reportCount() view returns (uint256)",
];

function getProvider() {
  return new ethers.JsonRpcProvider(XLAYER_RPC);
}

function getContract() {
  return new ethers.Contract(FIRMA_COMPANY_ADDRESS, FIRMA_ABI, getProvider());
}

export interface AgentOnChain {
  agentId: number;
  role: number;
  roleName: string;
  wallet: string;
  registered: boolean;
  active: boolean;
  budget: bigint;
  registeredAt: number;
  hiredAt: number;
}

export function useAgents() {
  const [agents, setAgents] = useState<AgentOnChain[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetch() {
      try {
        const contract = getContract();
        const count = Number(await contract.getAgentCount());
        const results: AgentOnChain[] = [];

        for (let i = 0; i < count; i++) {
          const id = i + 1;
          const agent = await contract.getAgent(id);
          results.push({
            agentId: Number(agent.agentId),
            role: Number(agent.role),
            roleName: agent.roleName,
            wallet: agent.wallet,
            registered: agent.registered,
            active: agent.active,
            budget: agent.budget,
            registeredAt: Number(agent.registeredAt),
            hiredAt: Number(agent.hiredAt),
          });
        }

        if (!cancelled) {
          setAgents(results);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to fetch agents");
          setLoading(false);
        }
      }
    }

    fetch();
    // Refresh every 30s
    const interval = setInterval(fetch, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return { agents, loading, error };
}

export function useReportCount() {
  const [count, setCount] = useState<number>(0);

  useEffect(() => {
    async function fetch() {
      try {
        const contract = getContract();
        setCount(Number(await contract.reportCount()));
      } catch {
        // ignore
      }
    }
    fetch();
    const interval = setInterval(fetch, 60_000);
    return () => clearInterval(interval);
  }, []);

  return count;
}

export function useTreasuryActive() {
  const [active, setActive] = useState(true);

  useEffect(() => {
    async function fetch() {
      try {
        const contract = getContract();
        setActive(await contract.treasuryActive());
      } catch {
        // ignore
      }
    }
    fetch();
    const interval = setInterval(fetch, 30_000);
    return () => clearInterval(interval);
  }, []);

  return active;
}

export { FIRMA_COMPANY_ADDRESS };
