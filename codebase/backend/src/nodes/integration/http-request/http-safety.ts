/**
 * SSRF guard helpers for the integration nodes — HTTP Request (and its redirect
 * hops), DB Query, Send Email (`send-email/smtp-host-guard.ts`) and their
 * connection tests. One implementation so the three share the same ranges
 * (spec 4-integration §5.5 · 3-send-email §4 · 2-database-query §4).
 *
 * Blocks URLs that resolve to loopback, link-local, private (RFC 1918),
 * CGNAT, or unique-local IPv6 ranges — IPv4-mapped IPv6 (`::ffff:a.b.c.d`) is
 * judged by the IPv4 it carries. Intended for Integration-backed requests
 * where a workflow author should not be able to pivot to internal
 * infrastructure by supplying a relative URL that piggybacks on credentials.
 *
 * Two layers:
 * 1. {@link assertSafeOutboundUrl} — synchronous hostname literal check.
 *    Catches IP-as-host attacks but **does NOT** defeat attacker-controlled
 *    DNS that resolves a public hostname to an internal IP (DNS rebinding).
 * 2. {@link assertSafeOutboundHostResolved} — async DNS-aware check.
 *    Resolves the hostname and re-checks the resulting IPs. Use this before
 *    making a network call when DNS rebinding is a concern.
 * 3. {@link safeOutboundDispatcher} — 연결 시점 판정. `fetch` 의 `dispatcher` 로 넘기면 실제 연결이 쓰는 주소
 *    조회에 같은 대역표를 적용한다. 2 와 연결 사이에 DNS 응답이 바뀌어도 판정을 거치지 않은 주소로는 연결하지
 *    않는다(NERV Task `CLE-T-BS1WD1`). 지금은 HTTP Request 노드만 쓴다.
 *
 * **Self-hosted opt-in**: `ALLOW_PRIVATE_HOST_TARGETS=true` disables both
 * layers — required when the deployment legitimately needs to reach private
 * networks (internal DB / on-prem API). Set only when egress is otherwise
 * constrained by an external firewall.
 *
 * 공용인데 `http-request/` 폴더에 있는 이유: HTTP Request 가 먼저 만든 것을 DB · Email 이 가져다 썼고, spec
 * `4-nodes/4-integration/1-http-request.md` frontmatter `code:` 가 이 경로를 가리킨다. 중립 위치로 옮기는 것은 그 spec 경로와
 * 함께 바꿔야 해서 트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 항목으로 둔다.
 */
import { lookup } from 'node:dns/promises';
import type { Dispatcher } from 'undici';
import {
  createGuardedLookupDispatcher,
  createLazyGuardedDispatcher,
} from '../../../common/utils/guarded-lookup-dispatcher.js';

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

/**
 * SSRF 가드의 차단 판정. 메시지는 `SSRF_BLOCKED: …` 그대로다(차단 host/IP 가 들어 있어 서버 로그 전용 — 클라이언트에는
 * {@link SSRF_BLOCKED_CLIENT_MESSAGE}). 판정인지 다른 오류인지는 메시지 접두어가 아니라 이 클래스로 가른다.
 */
export class SsrfBlockedError extends Error {
  constructor(detail: string) {
    super(`SSRF_BLOCKED: ${detail}`);
    this.name = 'SsrfBlockedError';
  }
}

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
 *
 * 알림 웹훅 · MCP 가드(`common/utils/ssrf-safe-url.util.ts` 의 `normalizeIpv6Literal` · `embeddedIpv4FromIpv6`)는 같은
 * 정규화와 IPv4 추출을 따로 갖고, NAT64 망에서 변환되는 `64:ff9b::/96` 까지 /96 넷을 모두 막는다. 정책 차이의 이유는 그쪽
 * `embeddedIpv4FromIpv6` JSDoc 에 있다. 두 구현을 모으는 일은 NERV Task `CLE-T-753725`, 판정 범위를 맞출지는 `CLE-T-63RSH6` 가
 * 정한다. 여기 정책이나 `canonicalIPv6` 를 바꿀 때는 그쪽도 함께 본다.
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
 * Throws an {@link SsrfBlockedError} (`SSRF_BLOCKED: …`) if the URL is deemed unsafe for
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
    throw new SsrfBlockedError('URL is not parseable');
  }
  const protocol = parsed.protocol.toLowerCase();
  if (protocol !== 'http:' && protocol !== 'https:') {
    throw new SsrfBlockedError(`protocol "${protocol}" is not allowed`);
  }
  if (isPrivateHostsAllowed()) {
    return parsed;
  }
  if (isBlockedHostname(parsed.hostname)) {
    throw new SsrfBlockedError(
      `hostname "${parsed.hostname}" resolves to a restricted network range`,
    );
  }
  return parsed;
}

/**
 * Resolves `hostname` via DNS and checks every returned IP against the
 * private/loopback/link-local block list. Defeats DNS rebinding where a
 * public hostname returns an internal address.
 *
 * 이 검사와 뒤따르는 `fetch` 의 연결은 DNS 를 따로 조회한다. 그 사이에 응답이 바뀌는 경우는
 * {@link safeOutboundDispatcher} 가 연결할 때 다시 판정해서 막는다. 이 함수를 `fetch` 없이 쓰는 호출자
 * (DB Query · Send Email 등)에는 그 판정이 없으므로 egress 방화벽을 함께 둔다.
 */
export async function assertSafeOutboundHostResolved(
  hostname: string,
): Promise<void> {
  if (isPrivateHostsAllowed()) return;

  // Literal IP / 'localhost' fast-path — no DNS lookup needed.
  if (isBlockedHostname(hostname)) {
    throw new SsrfBlockedError(
      `hostname "${hostname}" resolves to a restricted network range`,
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
      throw new SsrfBlockedError(
        `hostname "${hostname}" resolves to restricted IP "${address}"`,
      );
    }
  }
}

const connectGuardDispatcher = createLazyGuardedDispatcher(() =>
  createGuardedLookupDispatcher(({ address }, hostname) =>
    isBlockedHostname(address)
      ? new SsrfBlockedError(
          `hostname "${hostname}" resolved to restricted IP "${address}" at connect time`,
        )
      : null,
  ),
);

/**
 * 연결 시점 판정 dispatcher. `fetch(url, { dispatcher })` 로 넘기면 연결할 때 푼 주소를 {@link isBlockedHostname}
 * 대역표로 다시 판정하고, 통과한 주소로만 연결한다. 막히면 `fetch` 가 `TypeError('fetch failed')` 로 끝나고
 * 그 `cause` 에 {@link SsrfBlockedError} 가 있다(`findCause` 로 찾는다).
 *
 * - `ALLOW_PRIVATE_HOST_TARGETS=true` 면 `undefined` 다. 앞의 두 검사와 함께 꺼지고 요청은 전역 dispatcher 를 쓴다.
 * - 프로세스에 하나만 만들어 나눠 쓴다. 연결 풀(keep-alive)을 요청마다 새로 열지 않기 위해서다.
 * - IP 리터럴 호스트는 연결 때 조회하지 않으므로 {@link assertSafeOutboundUrl} 이 맡는다.
 * - 해석 실패는 판정하지 않고 전송 오류로 둔다. {@link assertSafeOutboundHostResolved} 의 fail-open 과 같다.
 */
export function safeOutboundDispatcher(): Dispatcher | undefined {
  if (isPrivateHostsAllowed()) return undefined;
  return connectGuardDispatcher.get();
}

/** 테스트용. 만들어 둔 dispatcher 를 닫고 다음 호출이 새로 만들게 한다. */
export function resetSafeOutboundDispatcherForTesting(): Promise<void> {
  return connectGuardDispatcher.reset();
}
