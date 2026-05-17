/**
 * SSRF guard helpers for the HTTP Request handler / DB Query node.
 *
 * Blocks URLs that resolve to loopback, link-local, private (RFC 1918),
 * CGNAT, or unique-local IPv6 ranges. Intended for Integration-backed
 * requests where a workflow author should not be able to pivot to internal
 * infrastructure by supplying a relative URL that piggybacks on credentials.
 *
 * Two layers:
 * 1. {@link assertSafeOutboundUrl} — synchronous hostname literal check.
 *    Catches IP-as-host attacks but **does NOT** defeat attacker-controlled
 *    DNS that resolves a public hostname to an internal IP (DNS rebinding).
 * 2. {@link assertSafeOutboundHostResolved} — async DNS-aware check.
 *    Resolves the hostname and re-checks the resulting IPs. Use this before
 *    making a network call when DNS rebinding is a concern.
 *
 * **Self-hosted opt-in**: `ALLOW_PRIVATE_HOST_TARGETS=true` disables both
 * layers — required when the deployment legitimately needs to reach private
 * networks (internal DB / on-prem API). Set only when egress is otherwise
 * constrained by an external firewall.
 */
import { lookup } from 'node:dns/promises';

const PRIVATE_V4_RANGES: Array<[number, number]> = [
  // 10.0.0.0/8
  [ipToInt(10, 0, 0, 0), ipToInt(10, 255, 255, 255)],
  // 172.16.0.0/12
  [ipToInt(172, 16, 0, 0), ipToInt(172, 31, 255, 255)],
  // 192.168.0.0/16
  [ipToInt(192, 168, 0, 0), ipToInt(192, 168, 255, 255)],
  // 127.0.0.0/8 (loopback)
  [ipToInt(127, 0, 0, 0), ipToInt(127, 255, 255, 255)],
  // 169.254.0.0/16 (link-local, covers 169.254.169.254 cloud metadata)
  [ipToInt(169, 254, 0, 0), ipToInt(169, 254, 255, 255)],
  // 100.64.0.0/10 (CGNAT)
  [ipToInt(100, 64, 0, 0), ipToInt(100, 127, 255, 255)],
  // 0.0.0.0/8 ("this" network)
  [ipToInt(0, 0, 0, 0), ipToInt(0, 255, 255, 255)],
];

function ipToInt(a: number, b: number, c: number, d: number): number {
  return ((a << 24) >>> 0) + (b << 16) + (c << 8) + d;
}

function parseIPv4(hostname: string): number | null {
  const match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return null;
  const parts = match.slice(1, 5).map((n) => Number(n));
  if (parts.some((n) => n < 0 || n > 255)) return null;
  return ipToInt(parts[0], parts[1], parts[2], parts[3]);
}

function isBlockedIPv4(hostname: string): boolean {
  const ip = parseIPv4(hostname);
  if (ip === null) return false;
  return PRIVATE_V4_RANGES.some(([lo, hi]) => ip >= lo && ip <= hi);
}

function isBlockedIPv6(hostname: string): boolean {
  // Strip optional brackets from `[::1]`-style hostnames.
  const stripped = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!stripped.includes(':')) return false;
  // ::1 loopback, 0:: unspecified
  if (stripped === '::1' || stripped === '::') return true;
  // fe80::/10 link-local
  if (/^fe[89ab][0-9a-f]:/.test(stripped)) return true;
  // fc00::/7 unique local
  if (/^f[cd][0-9a-f]{2}:/.test(stripped)) return true;
  return false;
}

export function isBlockedHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  if (normalized === 'localhost') return true;
  if (isBlockedIPv4(normalized)) return true;
  if (isBlockedIPv6(normalized)) return true;
  return false;
}

function isPrivateHostsAllowed(): boolean {
  return process.env.ALLOW_PRIVATE_HOST_TARGETS === 'true';
}

/**
 * Throws an `Error('SSRF_BLOCKED: …')` if the URL is deemed unsafe for
 * integration-backed outbound calls. Returns the parsed URL on success.
 *
 * This is a synchronous literal check — it does not resolve DNS. Pair it
 * with {@link assertSafeOutboundHostResolved} for full DNS-rebinding defense.
 */
export function assertSafeOutboundUrl(url: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('SSRF_BLOCKED: URL is not parseable');
  }
  const protocol = parsed.protocol.toLowerCase();
  if (protocol !== 'http:' && protocol !== 'https:') {
    throw new Error(`SSRF_BLOCKED: protocol "${protocol}" is not allowed`);
  }
  if (isPrivateHostsAllowed()) {
    return parsed;
  }
  if (isBlockedHostname(parsed.hostname)) {
    throw new Error(
      `SSRF_BLOCKED: hostname "${parsed.hostname}" resolves to a restricted network range`,
    );
  }
  return parsed;
}

/**
 * Resolves `hostname` via DNS and checks every returned IP against the
 * private/loopback/link-local block list. Defeats DNS rebinding where a
 * public hostname returns an internal address.
 *
 * **Race window**: a sufficiently fast attacker can flip DNS between this
 * check and the subsequent `fetch`/`connect`. For defense in depth, pair
 * with an egress firewall.
 */
export async function assertSafeOutboundHostResolved(
  hostname: string,
): Promise<void> {
  if (isPrivateHostsAllowed()) return;

  // Literal IP / 'localhost' fast-path — no DNS lookup needed.
  if (isBlockedHostname(hostname)) {
    throw new Error(
      `SSRF_BLOCKED: hostname "${hostname}" resolves to a restricted network range`,
    );
  }

  let addresses: Array<{ address: string; family: number }>;
  try {
    addresses = await lookup(hostname, { all: true });
  } catch {
    // DNS 가 resolve 되지 않으면 어차피 어떤 호스트에도 도달할 수 없으므로
    // SSRF 위협이 성립하지 않는다. 호출자가 ECONNREFUSED / ENOTFOUND 로 처리하게
    // pass-through 한다 (fail-open on DNS failure).
    return;
  }

  for (const { address } of addresses) {
    if (isBlockedHostname(address)) {
      throw new Error(
        `SSRF_BLOCKED: hostname "${hostname}" resolves to restricted IP "${address}"`,
      );
    }
  }
}
