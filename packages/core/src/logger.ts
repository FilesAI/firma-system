const COLORS = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
} as const;

type LogLevel = "info" | "warn" | "error" | "debug" | "tx";

function timestamp(): string {
  return new Date().toISOString();
}

function createLogger(agentName: string) {
  const prefix = `[${agentName}]`;

  return {
    info: (msg: string, data?: unknown) => {
      console.log(
        `${COLORS.gray}${timestamp()}${COLORS.reset} ${COLORS.cyan}${prefix}${COLORS.reset} ${msg}`,
        data !== undefined ? data : "",
      );
    },
    warn: (msg: string, data?: unknown) => {
      console.warn(
        `${COLORS.gray}${timestamp()}${COLORS.reset} ${COLORS.yellow}${prefix} WARN${COLORS.reset} ${msg}`,
        data !== undefined ? data : "",
      );
    },
    error: (msg: string, data?: unknown) => {
      console.error(
        `${COLORS.gray}${timestamp()}${COLORS.reset} ${COLORS.red}${prefix} ERROR${COLORS.reset} ${msg}`,
        data !== undefined ? data : "",
      );
    },
    debug: (msg: string, data?: unknown) => {
      if (process.env.DEBUG) {
        console.log(
          `${COLORS.gray}${timestamp()} ${prefix} DEBUG${COLORS.reset} ${msg}`,
          data !== undefined ? data : "",
        );
      }
    },
    tx: (action: string, txHash: string) => {
      console.log(
        `${COLORS.gray}${timestamp()}${COLORS.reset} ${COLORS.green}${prefix} TX${COLORS.reset} ${action} -> ${txHash}`,
      );
    },
  };
}

export { createLogger, type LogLevel };
