import { useState, useEffect, useRef, useCallback, Fragment } from "react";
import { JsonRpcProvider, Contract } from "ethers";

type JobStatus = "Open" | "Funded" | "Submitted" | "Completed" | "Rejected";

interface Job {
  id: string;
  rawId: number;
  status: JobStatus;
  amount: string;
  provider: string;
  evaluator: string;
}

const ACPV2_ADDRESS = "0xBEf97c569a5b4a82C1e8f53792eC41c988A4316e";
const XLAYER_RPC = "https://rpc.xlayer.tech";
const XLAYER_EXPLORER = "https://www.oklink.com/xlayer/address/" + ACPV2_ADDRESS;
const POLL_INTERVAL = 60_000;

const ACPV2_ABI = [
  "function getJob(uint256 _jobId) view returns (tuple(uint256 id, address client, address provider, address evaluator, uint256 amount, uint8 status, bytes32 deliverableHash))",
  "function getJobCount() view returns (uint256)",
];

const STATUS_MAP: Record<number, JobStatus> = {
  0: "Open",
  1: "Funded",
  2: "Submitted",
  3: "Completed",
  4: "Rejected",
};

function truncateAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

const STATUS_STEPS: JobStatus[] = ["Open", "Funded", "Submitted", "Completed"];

const STATUS_STYLES: Record<JobStatus, string> = {
  Open: "bg-firma-muted/15 text-firma-muted",
  Funded: "bg-firma-yellow/12 text-firma-yellow",
  Submitted: "bg-firma-accent/12 text-firma-accent",
  Completed: "bg-firma-green/12 text-firma-green",
  Rejected: "bg-firma-red/12 text-firma-red",
};

function StepProgress({ status }: { status: JobStatus }) {
  if (status === "Rejected") {
    return (
      <div className="flex items-center gap-1.5">
        {STATUS_STEPS.map((step, i) => {
          const isRejectPoint = i <= STATUS_STEPS.indexOf("Submitted");
          return (
            <Fragment key={step}>
              {i > 0 && (
                <div
                  className={`h-px w-5 ${
                    isRejectPoint && i <= STATUS_STEPS.indexOf("Submitted")
                      ? "bg-firma-red/30"
                      : "bg-firma-border"
                  }`}
                />
              )}
              <div
                className={`w-2 h-2 rounded-full ${
                  isRejectPoint ? "bg-firma-red/50" : "bg-firma-border"
                }`}
              />
            </Fragment>
          );
        })}
        <div className="h-px w-5 bg-firma-red/30" />
        <div className="w-2 h-2 rounded-full bg-firma-red" title="Rejected" />
      </div>
    );
  }

  const currentIndex = STATUS_STEPS.indexOf(status);

  return (
    <div className="flex items-center gap-1.5">
      {STATUS_STEPS.map((step, i) => (
        <Fragment key={step}>
          {i > 0 && (
            <div
              className={`h-px w-5 ${
                i <= currentIndex ? "bg-firma-accent" : "bg-firma-border"
              }`}
            />
          )}
          <div
            className={`w-2 h-2 rounded-full ${
              i <= currentIndex ? "bg-firma-accent" : "bg-firma-border"
            }`}
            title={step}
          />
        </Fragment>
      ))}
    </div>
  );
}

export default function ActiveJobs() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchJobs = useCallback(async () => {
    try {
      const provider = new JsonRpcProvider(XLAYER_RPC);
      const contract = new Contract(ACPV2_ADDRESS, ACPV2_ABI, provider);

      const count = await contract.getJobCount();
      const total = Number(count);

      if (total === 0) {
        setJobs([]);
        setIsLive(true);
        setError(null);
        setLoading(false);
        return;
      }

      const start = Math.max(0, total - 10);
      const fetches: Promise<Job | null>[] = [];

      for (let i = total - 1; i >= start; i--) {
        fetches.push(
          contract.getJob(i).then((raw: Record<string, unknown>) => {
            const statusNum = Number(raw.status);
            return {
              id: `JOB-${raw.id}`,
              rawId: Number(raw.id),
              status: STATUS_MAP[statusNum] ?? ("Open" as JobStatus),
              amount: `${(Number(raw.amount) / 1e6).toFixed(2)} USDT`,
              provider: truncateAddress(String(raw.provider ?? "")),
              evaluator: truncateAddress(String(raw.evaluator ?? "")),
            } as Job;
          }).catch(() => null)
        );
      }

      const results = (await Promise.all(fetches)).filter(Boolean) as Job[];
      setJobs(results);
      setIsLive(true);
      setError(null);
    } catch (err: unknown) {
      console.error("ActiveJobs fetch error:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch jobs from X Layer");
      setIsLive(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
    intervalRef.current = setInterval(fetchJobs, POLL_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchJobs]);

  return (
    <div className="bg-firma-card border border-firma-border rounded-2xl p-6 h-full">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-firma-text text-base font-semibold">
          Active Jobs
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-firma-muted-dark text-xs font-mono">ERC-8183</span>
          {isLive ? (
            <span className="inline-flex items-center gap-1.5 text-firma-green text-[9px] font-semibold uppercase tracking-wider bg-firma-green/10 border border-firma-green/20 rounded px-1.5 py-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-firma-green animate-pulse" />
              Live
            </span>
          ) : (
            <span className="text-firma-muted-dark text-[9px] font-semibold uppercase tracking-wider bg-firma-bg border border-firma-border rounded px-1.5 py-0.5">
              Mainnet Snapshot
            </span>
          )}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12 text-firma-muted text-sm">
          <svg className="animate-spin h-4 w-4 mr-2 text-firma-accent" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Fetching jobs from X Layer...
        </div>
      )}

      {error && !loading && (
        <div className="flex flex-col items-center justify-center py-12 gap-2">
          <span className="text-firma-red text-sm">Failed to load jobs</span>
          <span className="text-firma-muted text-xs max-w-xs text-center">{error}</span>
          <button
            onClick={() => { setLoading(true); fetchJobs(); }}
            className="mt-2 text-xs text-firma-accent hover:underline"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Header */}
          <div className="hidden sm:grid grid-cols-[80px_90px_1fr_80px_110px_110px] gap-3 px-4 pb-3 border-b border-firma-border/60">
            <span className="text-firma-muted-dark text-[10px] uppercase tracking-wider font-medium">
              Job ID
            </span>
            <span className="text-firma-muted-dark text-[10px] uppercase tracking-wider font-medium">
              Status
            </span>
            <span className="text-firma-muted-dark text-[10px] uppercase tracking-wider font-medium">
              Progress
            </span>
            <span className="text-firma-muted-dark text-[10px] uppercase tracking-wider font-medium">
              Amount
            </span>
            <span className="text-firma-muted-dark text-[10px] uppercase tracking-wider font-medium">
              Provider
            </span>
            <span className="text-firma-muted-dark text-[10px] uppercase tracking-wider font-medium">
              Evaluator
            </span>
          </div>

          {/* Rows */}
          <div className="flex flex-col gap-1 mt-1">
            {jobs.length === 0 && (
              <div className="text-firma-muted text-sm text-center py-8">No jobs found on-chain</div>
            )}
            {jobs.map((job) => (
              <div
                key={job.id}
                className="grid grid-cols-1 sm:grid-cols-[80px_90px_1fr_80px_110px_110px] gap-3 items-center rounded-xl px-4 py-3 transition-colors hover:bg-firma-bg-soft"
              >
                <a
                  href={`${XLAYER_EXPLORER}#events`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-firma-accent text-sm font-mono font-medium hover:underline"
                >
                  {job.id}
                </a>

                <span
                  className={`inline-flex items-center justify-center text-[10px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full w-fit ${STATUS_STYLES[job.status]}`}
                >
                  {job.status}
                </span>

                <StepProgress status={job.status} />

                <span className="text-firma-text text-sm">{job.amount}</span>
                <code className="text-firma-muted text-[10px] font-mono">
                  {job.provider}
                </code>
                <code className="text-firma-muted text-[10px] font-mono">
                  {job.evaluator}
                </code>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
