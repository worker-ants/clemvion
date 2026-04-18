/**
 * SSRF guard helpers for the HTTP Request handler.
 *
 * Blocks URLs that resolve to loopback, link-local, private (RFC 1918),
 * CGNAT, or unique-local IPv6 ranges. Intended for Integration-backed
 * requests where a workflow author should not be able to pivot to internal
 * infrastructure by supplying a relative URL that piggybacks on credentials.
 *
 * NOTE: This is a *structural* guard based on the hostname literal. It does
 * NOT perform DNS resolution and cannot defeat attacker-controlled DNS that
 * resolves a public hostname to an internal IP. A future iteration should
 * resolve the hostname and re-check the final address just before `fetch`.
 */

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

/**
 * Throws an `Error('SSRF_BLOCKED: …')` if the URL is deemed unsafe for
 * integration-backed outbound calls. Returns the parsed URL on success.
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
  if (isBlockedHostname(parsed.hostname)) {
    throw new Error(
      `SSRF_BLOCKED: hostname "${parsed.hostname}" resolves to a restricted network range`,
    );
  }
  return parsed;
}
