import { lookup } from "node:dns/promises";
import ipaddr from "ipaddr.js";

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
]);

export function isPublicIp(address: string): boolean {
  if (!ipaddr.isValid(address)) return false;
  let parsed = ipaddr.parse(address);
  if (parsed instanceof ipaddr.IPv6 && parsed.isIPv4MappedAddress()) {
    parsed = parsed.toIPv4Address();
  }
  return parsed.range() === "unicast";
}

/** Reject URLs that could reach local services or cloud metadata endpoints. */
export async function validatePublicUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error(`Invalid URL: ${rawUrl}`);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("web_fetch only supports HTTP and HTTPS URLs");
  }
  if (url.username || url.password) {
    throw new Error("URLs containing credentials are not allowed");
  }

  const hostname = url.hostname.replace(/\.$/, "").toLowerCase();
  if (!hostname || BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith(".localhost")) {
    throw new Error(`Blocked hostname: ${url.hostname}`);
  }

  if (ipaddr.isValid(hostname)) {
    if (!isPublicIp(hostname)) throw new Error(`Blocked non-public address: ${hostname}`);
    return url;
  }

  let addresses: Array<{ address: string; family: number }>;
  try {
    addresses = await lookup(hostname, { all: true, verbatim: true }) as Array<{ address: string; family: number }>;
  } catch (error) {
    throw new Error(`Could not resolve ${hostname}: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (addresses.length === 0) throw new Error(`Could not resolve ${hostname}`);
  for (const { address } of addresses) {
    if (!isPublicIp(address)) {
      throw new Error(`Blocked ${hostname}: it resolves to non-public address ${address}`);
    }
  }

  return url;
}
