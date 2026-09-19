/**
 * SSRF guard helpers for the integration nodes — HTTP Request (and its redirect
 * hops), DB Query, Send Email (`send-email/smtp-host-guard.ts`) and their
 * connection tests. One implementation so the three share the same ranges
 * (spec 4-integration §5.5 · 3-send-email §4 · 2-database-query §4).
 *
 * Blocks URLs that resolve to loopback, link-local, private (RFC 1918),
 * CGNAT, or unique-local IPv6 ranges — IPv4-mapped IPv6 (`::ffff:a.b.c.d`) is
 * judged by the IPv4 it carries. Intended for Integration-backed
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

/**
 * SSRF 가드가 요청을 막았을 때의 클라이언트 문구 — 차단된 host/IP 를 싣지 않는다(정찰 면 축소, CWE-209). 원본 상세
 * (hostname/IP)는 `logger.warn`(서버 로그 전용)에만 남긴다. usage 로그(`IntegrationUsageLog`)는 Activity API
 * (`GET /integrations/:id/activity`)로 workspace 사용자에게 그대로 돌려주므로 거기에도 이 문구를 기록한다.
 * DB(`DB_HOST_BLOCKED`) · Email(`EMAIL_HOST_BLOCKED`) 메시지 일반화와 대칭이다. 노드 UI 는 `output.error.code`
 * (`HTTP_BLOCKED`)로 지역화 문구를 렌더하므로 이 message 는 wire 안전 목적이다.
 *
 * HTTP Request 노드(`HTTP_BLOCKED` 노드 에러)와 HTTP 통합 연결 테스트(`HTTP_BLOCKED` 결과 코드)가 같은 문구를 쓴다.
 */
export const SSRF_BLOCKED_CLIENT_MESSAGE = 'Request blocked by SSRF policy.';

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

/**
 * IPv6 리터럴을 한 모양으로 — WHATWG URL 파서가 줄임(`0:0:…:1` → `::1`) · 소문자 · IPv4-mapped 점 형(`::ffff:127.0.0.1` →
 * `::ffff:7f00:1`)을 정규화한다. 괄호 없는 host(DB host 필드 · `dns.lookup` 결과)는 URL 을 거치지 않아 여기서 맞춘다.
 * 파서가 거부하는 입력(zone id `fe80::1%eth0` 등)은 원문 그대로 둔다 — 아래 접두 검사는 원문에도 맞는다.
 */
function canonicalIPv6(stripped: string): string {
  try {
    return new URL(`http://[${stripped}]/`).hostname.slice(1, -1);
  } catch {
    return stripped;
  }
}

/**
 * IPv4-mapped IPv6(`::ffff:a.b.c.d`)가 품은 IPv4, 아니면 null. 이 표기는 IPv4 대상에 **그대로 닿는다** — 127.0.0.1 에만 바인드한
 * 서버에 `http://[::ffff:127.0.0.1]/` 이 200(macOS · `node:24-alpine` 실측). 그래서 품은 IPv4 를 같은 대역표로 판정한다.
 * IPv4 를 품는 다른 표기(IPv4-compatible `::a.b.c.d` · SIIT `::ffff:0:…` · NAT64 `64:ff9b::/96` · 6to4 `2002::/16`)는 같은
 * 실측에서 닿지 않았다(`EHOSTUNREACH`/`ENETUNREACH`).
 */
function mappedIPv4(canonical: string): string | null {
  const m = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(canonical);
  if (!m) return null;
  const hi = parseInt(m[1], 16);
  const lo = parseInt(m[2], 16);
  return `${hi >> 8}.${hi & 0xff}.${lo >> 8}.${lo & 0xff}`;
}

function isBlockedIPv6(hostname: string): boolean {
  // Strip optional brackets from `[::1]`-style hostnames.
  const stripped = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!stripped.includes(':')) return false;
  const canonical = canonicalIPv6(stripped);
  // ::1 loopback, 0:: unspecified
  if (canonical === '::1' || canonical === '::') return true;
  // fe80::/10 link-local
  if (/^fe[89ab][0-9a-f]:/.test(canonical)) return true;
  // fc00::/7 unique local
  if (/^f[cd][0-9a-f]{2}:/.test(canonical)) return true;
  const v4 = mappedIPv4(canonical);
  return v4 !== null && isBlockedIPv4(v4);
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
