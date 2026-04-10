/**
 * Proxy bootstrap for Node.js fetch().
 * In environments where DNS blocks certain domains (e.g. www.okx.com),
 * Node's native fetch() won't use system HTTP_PROXY automatically.
 * This module configures undici's ProxyAgent as the global dispatcher.
 *
 * Call `initProxy()` once at agent startup before any fetch() calls.
 */
import { createLogger } from "./logger.js";

const log = createLogger("Proxy");

let initialized = false;

export async function initProxy(): Promise<void> {
  if (initialized) return;
  initialized = true;

  const proxyUrl =
    process.env.HTTPS_PROXY ||
    process.env.HTTP_PROXY ||
    process.env.https_proxy ||
    process.env.http_proxy;

  if (!proxyUrl) {
    return;
  }

  try {
    const undici = await import("undici");
    const { ProxyAgent, setGlobalDispatcher } = undici;
    setGlobalDispatcher(new ProxyAgent(proxyUrl));
    log.info(`Global fetch proxy configured: ${proxyUrl}`);
  } catch (err) {
    log.warn(`Could not configure proxy (undici not available): ${err}`);
  }
}
