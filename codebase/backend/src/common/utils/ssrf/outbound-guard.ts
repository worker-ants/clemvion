/**
 * SSRF guard helpers for the integration nodes — HTTP Request (and its redirect
 * hops), DB Query, Send Email (`send-email/smtp-host-guard.ts`) and their
 * connection tests. One implementation so the three share the same ranges
 * (spec 4-integration §5.5 · 3-send-email §4 · 2-database-query §4).
 *
 * Blocks URLs that resolve to the ranges in `ip-classifier.ts` (loopback,
 * link-local, private, CGNAT, special-use IPv4 · IPv6, and IPv6 forms that
 * carry such an IPv4). Intended for Integration-backed requests
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
 *    않는다(NERV Task `CLE-T-BS1WD1`). HTTP Request 노드와 HTTP 통합 연결 테스트(`CLE-T-NESSYD`)가 쓴다.
 *
 * **Self-hosted opt-in**: `ALLOW_PRIVATE_HOST_TARGETS=true` disables both
 * layers — required when the deployment legitimately needs to reach private
 * networks (internal DB / on-prem API). Set only when egress is otherwise
 * constrained by an external firewall.
 */
import { lookup } from 'node:dns/promises';
import type { Dispatcher } from 'undici';
import {
  createGuardedLookupDispatcher,
  createLazyGuardedDispatcher,
} from '../guarded-lookup-dispatcher.js';
import { isBlockedIpLiteral } from './ip-classifier.js';

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
 *
 * 알림 웹훅 연결 시점 판정의 `ResolvedHostBlockedError`(`modules/external-interaction/notification-webhook-dispatcher.ts`)와는
 * 계층이 달라 따로 둔다. 이 클래스는 노드 오류 코드(`HTTP_BLOCKED` · `DB_HOST_BLOCKED` · `EMAIL_HOST_BLOCKED`)로 승격된다.
 */
export class SsrfBlockedError extends Error {
  constructor(detail: string) {
    super(`SSRF_BLOCKED: ${detail}`);
    this.name = 'SsrfBlockedError';
  }
}

/**
 * 통합 노드 가드의 호스트 판정. `localhost` 와, 막는 대역의 IP 리터럴이면 `true` 다. 대역표 · IPv4 를 품은 IPv6 판정은 SSRF 가드
 * 네 벌이 함께 쓰는 `ip-classifier.ts` 의 `classifyIpLiteral` 에 있다. 호스트 이름은 `false` 이고, 해석 결과는
 * {@link assertSafeOutboundHostResolved} · {@link safeOutboundDispatcher} 가 이 함수로 다시 본다.
 * `ALLOW_PRIVATE_HOST_TARGETS` 는 이 함수가 아니라 호출하는 쪽(아래 세 함수)이 읽는다.
 */
export function isBlockedHostname(hostname: string): boolean {
  if (hostname.toLowerCase() === 'localhost') return true;
  return isBlockedIpLiteral(hostname);
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
