import { lookup } from 'node:dns/promises';
import { classifyIpLiteral } from './ssrf/ip-classifier';

/**
 * SSRF (Server-Side Request Forgery) 방지 — outbound HTTP 호출 대상 URL 의 register-time
 * 검증 헬퍼.
 *
 * 검증 정책 ([Spec EIA §3.1 EIA-NX-09 / §8.1 / §R12]):
 * 1. URL 파싱 가능해야 함.
 * 2. protocol 은 `https:` (개발 환경 환경변수 `ALLOW_HTTP_HOOKS=1` 일 때만 `http:` 허용).
 * 3. hostname 이 literal IP 형태인 경우 사설 · loopback · 메타데이터 · 특수 용도 대역을 막는다. 대역표와 IPv4 를 품은
 *    IPv6 판정은 SSRF 가드 네 벌이 함께 쓰는 `ssrf/ip-classifier.ts` 에 있다. `localhost` · `0.0.0.0` 별칭도 막는다.
 *
 * `checkSsrfSafeUrl`(register-time 검증)은 **DNS resolution 을 수행하지 않는다** — register-time 에
 * 외부 DNS 호출을 만들면 테스트 환경에서 결정성이 깨지고 DNS rebinding 방어에도 불완전하다.
 * 해석 결과 검사는 발송 직전에 `checkResolvedHostIp` 로 한다(`notification-webhook.processor.ts`,
 * CLE-EIA-NOTIFY 「SSRF」). `checkResolvedHostIp` 는 `node:dns/promises` 의 `lookup`(getaddrinfo)을 쓴다.
 *
 * @returns 검증 통과 시 `{ ok: true }`, 실패 시 `{ ok: false, reason }` — reason 은 사용자 표시용.
 */
export interface SsrfCheckResult {
  ok: boolean;
  reason?: string;
}

/**
 * 알림 웹훅 가드의 IPv4 판정. 대역표는 SSRF 가드 네 벌이 함께 쓰는 `ssrf/ip-classifier.ts` 에 있다.
 * 점 표기 네 칸 IPv4 리터럴이 아니면 `false` 다.
 */
export function isPrivateIpv4(host: string): boolean {
  const verdict = classifyIpLiteral(host);
  return verdict?.family === 4 && verdict.blocked;
}

/**
 * 알림 웹훅 가드의 IPv6 판정. 대역표 · 품은 IPv4 판정은 `ssrf/ip-classifier.ts` 에 있다. 정규화하지 못한 IPv6 모양 문자열은
 * 막는다(fail-closed). IPv6 리터럴 모양이 아니면 `false` 다.
 */
export function isPrivateIpv6(host: string): boolean {
  const verdict = classifyIpLiteral(host);
  return verdict?.family === 6 && verdict.blocked;
}

export function checkSsrfSafeUrl(
  raw: unknown,
  opts: { allowHttp?: boolean } = {},
): SsrfCheckResult {
  if (typeof raw !== 'string' || raw.length === 0) {
    return { ok: false, reason: 'URL must be a non-empty string' };
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: 'Invalid URL format' };
  }

  // protocol 화이트리스트
  const allowHttp = opts.allowHttp ?? process.env.ALLOW_HTTP_HOOKS === '1';
  if (url.protocol === 'https:') {
    // ok
  } else if (url.protocol === 'http:' && allowHttp) {
    // ok — dev 환경 한정
  } else {
    return {
      ok: false,
      reason: `URL protocol must be https:${allowHttp ? ' (http: allowed via ALLOW_HTTP_HOOKS=1)' : ''}`,
    };
  }

  // hostname 검사
  const hostname = url.hostname;
  if (!hostname) {
    return { ok: false, reason: 'URL hostname is empty' };
  }
  // localhost 별칭 차단
  if (hostname === 'localhost' || hostname === '0.0.0.0') {
    return { ok: false, reason: 'URL hostname must not be a loopback alias' };
  }
  // literal IP 사설 대역 차단
  if (isPrivateIpv4(hostname)) {
    return {
      ok: false,
      reason: 'URL hostname must not be a private IPv4 address',
    };
  }
  // IPv6 검사 — URL.hostname 은 IPv6 를 대괄호로 감싸고 정규화해 돌려준다(`[::ffff:7f00:1]`)
  if (hostname.includes(':') && isPrivateIpv6(hostname)) {
    return {
      ok: false,
      reason: 'URL hostname must not be a private IPv6 address',
    };
  }

  return { ok: true };
}

/**
 * 알림 웹훅 발송 직전 DNS 결과 검사를 켤지 정한다(CLE-T-M1P83C, CLE-EIA-NOTIFY 「SSRF」).
 *
 * - `NODE_ENV=production` 은 기본으로 켠다. `NOTIFICATION_ENFORCE_DNS_REBIND_GUARD` 가 정확히 `'0'` 일 때만 끈다.
 *   오타나 다른 표기(`'false'` · `' 0'`)로 꺼지지 않게 끄는 값을 하나로 둔다.
 * - 그 밖의 환경은 기본으로 끈다. 정확히 `'1'` 일 때만 켠다(e2e 는 러너 사설 주소로 웹훅을 받는다).
 *
 * @param env 읽을 환경 변수 맵 (기본 `process.env`).
 * @returns 검사를 켜면 `true`.
 */
export function isNotificationDnsGuardEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const value = env.NOTIFICATION_ENFORCE_DNS_REBIND_GUARD;
  if (env.NODE_ENV === 'production') return value !== '0';
  return value === '1';
}

/**
 * 운영에서 발송 직전 DNS 결과 검사를 끈 채로 기동하는지(CLE-T-M1P83C). 참이면 `main.ts` 가 기동 때 경고 로그를
 * 한 번 남긴다. 사설 IP 로 풀리는 내부 수신기에 보내는 자체 설치 배포라는 정당한 용도가 있어 기동은 막지
 * 않는다(`ALLOW_PRIVATE_HOST_TARGETS` 와 같은 기준). 판정을 부트스트랩 본문에 두지 않고 여기서 단위 테스트한다.
 *
 * @param env 읽을 환경 변수 맵 (기본 `process.env`).
 * @returns 운영에서 검사가 꺼졌으면 `true`.
 */
export function shouldWarnNotificationDnsGuardOff(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.NODE_ENV === 'production' && !isNotificationDnsGuardEnabled(env);
}

/** 발송 직전 DNS 조회를 기다리는 최대 시간(ms). 넘기면 조회 실패와 같이 통과시킨다. */
export const DNS_LOOKUP_TIMEOUT_MS = 3000;

/**
 * Post-resolve SSRF 검증 — URL 호스트를 OS 해석기(`dns.lookup`, getaddrinfo)로 풀어 나온 주소 중 하나라도
 * 사설 · loopback · metadata 대역이면 거부한다. DNS rebinding 방어용이다.
 *
 * 켤지 말지는 호출자가 `isNotificationDnsGuardEnabled` 로 정한다(운영은 기본으로 켠다).
 *
 * - `lookup` 은 fetch 가 연결할 때 쓰는 해석기와 같아서 `/etc/hosts` · 검색 도메인으로 푸는 주소도 본다.
 *   네트워크 DNS 만 묻는 `resolve4` · `resolve6` 은 그 주소를 놓친다(CLE-EIA-NOTIFY Rationale 의 실측).
 * - 해석에 실패하면 통과시킨다(fail-open). 풀리지 않는 이름은 fetch 도 연결하지 못한다.
 * - 검사와 발송 연결은 DNS 를 각자 조회한다. 그 사이 응답이 바뀌는 경우는
 *   `notificationWebhookDispatcher`(`modules/external-interaction/notification-webhook-dispatcher.ts`)가
 *   연결할 때 같은 대역표로 다시 판정해서 막는다(CLE-T-GAQCF9). 이 검사는 서명 · 발송 전에 막아 재시도 없이
 *   degraded 로 두려고 남긴다.
 * - 해석이 `DNS_LOOKUP_TIMEOUT_MS` 안에 끝나지 않으면 해석 실패와 똑같이 통과시킨다(fail-open). 시간을 넘긴
 *   `getaddrinfo` 는 끝날 때까지 libuv 스레드풀을 점유한다. 발송 연결의 조회는 이 검사와 합치지 않았으므로
 *   그 점유는 바뀌지 않는다. 합치지 않은 이유는 CLE-EIA-NOTIFY-SSRF Rationale 에 있다.
 *
 * @param hostname `new URL(url).hostname` (IPv6 리터럴은 괄호를 포함한다).
 * @returns 통과면 `{ ok: true }`, 거부면 `{ ok: false, reason }`. 조회 시간 초과만 `{ ok: true, reason }` 이다
 *   (호출자가 경고 로그를 남긴다).
 */
export async function checkResolvedHostIp(
  hostname: string,
): Promise<SsrfCheckResult> {
  if (!hostname) return { ok: false, reason: 'hostname is empty' };
  // literal IP 면 register-time 검증과 동일 처리
  const literal = classifyIpLiteral(hostname);
  if (literal) {
    if (!literal.blocked) return { ok: true };
    return {
      ok: false,
      reason: `resolved IPv${literal.family} is private`,
    };
  }
  let addresses: Array<{ address: string; family: number }>;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timedOut = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), DNS_LOOKUP_TIMEOUT_MS);
    });
    const result = await Promise.race([
      lookup(hostname, { all: true }),
      timedOut,
    ]);
    if (result === null) {
      // 시간 초과 — 해석 실패와 같이 fail-open. 늦게 끝난 lookup 의 거부는 Promise.race 가 이미 붙인
      // 처리기가 받으므로 처리되지 않은 거부로 남지 않는다.
      return {
        ok: true,
        reason: `DNS lookup timed out after ${DNS_LOOKUP_TIMEOUT_MS}ms (fail-open)`,
      };
    }
    addresses = result;
  } catch {
    // 해석 실패 — fail-open. 이어지는 fetch 도 같은 이름을 풀지 못해 연결 오류로 끝난다.
    return { ok: true };
  } finally {
    if (timer) clearTimeout(timer);
  }
  for (const { address } of addresses) {
    const reason = resolvedAddressBlockReason(address);
    if (reason) return { ok: false, reason };
  }
  return { ok: true };
}

/**
 * 해석기가 돌려준 주소 하나가 사설 · loopback · metadata 대역이면 거부 사유를, 아니면 `null` 을 돌려준다.
 * {@link checkResolvedHostIp} 와 `notificationWebhookDispatcher`(`modules/external-interaction/notification-webhook-dispatcher.ts`)가
 * 같은 판정과 사유 문구를 쓴다.
 */
export function resolvedAddressBlockReason(address: string): string | null {
  const verdict = classifyIpLiteral(address);
  if (!verdict?.blocked) return null;
  return verdict.family === 6
    ? `resolved IPv6 ${address} falls in a private range`
    : `resolved IPv4 ${address} falls in a private/loopback/metadata range`;
}
