import { createLogger } from "@firma/core";
import type { CompanyPnL } from "@firma/core";

const log = createLogger("ProfitAllocator");

interface LedgerEntry {
  agentId: number;
  amount: number;
  type: "revenue" | "expense";
  label: string;
  timestamp: string;
}

interface AgentBalance {
  agentId: number;
  revenue: number;
  expenses: number;
  netProfit: number;
}

export class ProfitAllocator {
  private ledger: LedgerEntry[] = [];
  private jobsCompleted = 0;
  private jobsRejected = 0;

  recordRevenue(agentId: number, amount: number, source: string): void {
    this.ledger.push({
      agentId,
      amount,
      type: "revenue",
      label: source,
      timestamp: new Date().toISOString(),
    });
    this.jobsCompleted += 1;
    log.info(
      `Revenue: +${amount} from agent #${agentId} (${source})`,
    );
  }

  recordExpense(agentId: number, amount: number, purpose: string): void {
    this.ledger.push({
      agentId,
      amount,
      type: "expense",
      label: purpose,
      timestamp: new Date().toISOString(),
    });
    this.jobsRejected += 1;
    log.info(
      `Expense: -${amount} from agent #${agentId} (${purpose})`,
    );
  }

  getCompanyPnL(): CompanyPnL {
    const revenue = this.ledger
      .filter((e) => e.type === "revenue")
      .reduce((sum, e) => sum + e.amount, 0);

    const expenses = this.ledger
      .filter((e) => e.type === "expense")
      .reduce((sum, e) => sum + e.amount, 0);

    const netProfit = revenue - expenses;

    // Estimate runway: if expenses > 0, how many days at current daily rate
    const oldestEntry = this.ledger[0];
    const daysElapsed = oldestEntry
      ? (Date.now() - new Date(oldestEntry.timestamp).getTime()) / 86_400_000
      : 1;
    const dailyExpenses = daysElapsed > 0 ? expenses / daysElapsed : 0;
    const runwayDays =
      dailyExpenses > 0 ? Math.max(0, netProfit / dailyExpenses) : Infinity;

    // Signal accuracy from completed vs rejected
    const totalJobs = this.jobsCompleted + this.jobsRejected;
    const signalAccuracy =
      totalJobs > 0 ? this.jobsCompleted / totalJobs : 0;

    return {
      revenue,
      expenses,
      netProfit,
      runwayDays: Math.round(runwayDays),
      jobsCompleted: this.jobsCompleted,
      jobsRejected: this.jobsRejected,
      signalAccuracy,
    };
  }

  getAgentBalance(agentId: number): AgentBalance {
    const agentEntries = this.ledger.filter((e) => e.agentId === agentId);

    const revenue = agentEntries
      .filter((e) => e.type === "revenue")
      .reduce((sum, e) => sum + e.amount, 0);

    const expenses = agentEntries
      .filter((e) => e.type === "expense")
      .reduce((sum, e) => sum + e.amount, 0);

    return {
      agentId,
      revenue,
      expenses,
      netProfit: revenue - expenses,
    };
  }

  getLedger(): LedgerEntry[] {
    return [...this.ledger];
  }
}
