import { ethers } from "ethers";
import type { OpsReport } from "@firma/core";

export interface ReportData {
  revenue: number;
  expenses: number;
  jobsCompleted: number;
  jobsRejected: number;
  signalAccuracy: number;
  hrDecisions: string[];
}

export type ReportDataProvider = () => ReportData | Promise<ReportData>;

let reportCounter = 0;

export class ReportGenerator {
  private dataProvider: ReportDataProvider;

  constructor(dataProvider: ReportDataProvider) {
    this.dataProvider = dataProvider;
  }

  async generateReport(): Promise<OpsReport> {
    const data = await this.dataProvider();
    const netProfit = data.revenue - data.expenses;
    const generatedAt = new Date().toISOString();
    reportCounter++;

    const reportBody = {
      reportId: reportCounter,
      revenue: data.revenue,
      expenses: data.expenses,
      netProfit,
      jobsCompleted: data.jobsCompleted,
      jobsRejected: data.jobsRejected,
      signalAccuracy: data.signalAccuracy,
      hrDecisions: data.hrDecisions,
      generatedAt,
    };

    const contentHash = ethers.keccak256(
      ethers.toUtf8Bytes(JSON.stringify(reportBody)),
    );

    return { ...reportBody, contentHash };
  }
}
