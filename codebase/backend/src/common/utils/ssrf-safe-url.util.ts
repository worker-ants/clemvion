import { lookup } from 'node:dns/promises';

/**
 * SSRF (Server-Side Request Forgery) 방지 — outbound HTTP 호출 대상 URL 의 register-time
 * 검증 헬퍼.
 *
 * 검증 정책 ([Spec EIA §3.1 EIA-NX-09 / §8.1 / §R12]):
 * 1. URL 파싱 가능해야 함.
 * 2. protocol 은 `https:` (개발 환경 환경변수 `ALLOW_HTTP_HOOKS=1` 일 때만 `http:` 허용).
 * 3. hostname 이 literal IP 형태인 경우 사설 IP / metadata service IP / loopback · 특수 용도 대역 차단:
 *    - IPv4: 10/8, 172.16/12, 192.168/16, 127/8, 169.254/16, 100.64/10 (CGNAT), 0/8,
 *      192.0.0/24 (IETF 프로토콜 할당), 198.18/15 (벤치마크), 224/4 (멀티캐스트), 240/4 (예약 · 브로드캐스트)
 *    - IPv6: ::1, fe80::/10 (link-local), fc00::/7 (ULA), unspecified ::, fec0::/10 (옛 site-local),
 *      ff00::/8 (멀티캐스트)
 *    - IPv4 를 품은 IPv6: IPv4-mapped `::ffff:0:0/96` · IPv4-compatible `::/96` · SIIT `::ffff:0:0:0/96` ·
 *      NAT64 `64:ff9b::/96` 는 품은 IPv4 를 위 IPv4 대역으로 판정한다
 *    - cloud metadata: 169.254.169.254 (AWS/Azure/GCP)
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

const PRIVATE_IPV4_PATTERNS: RegExp[] = [
  /^10\./, // 10.0.0.0/8
  /^127\./, // loopback
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12
  /^192\.168\./, // 192.168.0.0/16
  /^169\.254\./, // link-local (includes 169.254.169.254 metadata)
  /^100\.(6[4-9]|[7-9][0-9]|1[0-1][0-9]|12[0-7])\./, // 100.64.0.0/10 CGNAT
  /^0\./, // 0.0.0.0/8
  /^192\.0\.0\./, // 192.0.0.0/24 IETF protocol assignments
  /^198\.1[89]\./, // 198.18.0.0/15 benchmarking
  /^(22[4-9]|23[0-9])\./, // 224.0.0.0/4 multicast
  /^(24[0-9]|25[0-5])\./, // 240.0.0.0/4 reserved (incl. 255.255.255.255)
];

const IPV4_REGEX = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;

export function isLiteralIpv4(host: string): boolean {
  return IPV4_REGEX.test(host);
}

export function isPrivateIpv4(host: string): boolean {
  if (!isLiteralIpv4(host)) return false;
  return PRIVATE_IPV4_PATTERNS.some((p) => p.test(host));
}

/**
 * IPv6 리터럴을 WHATWG URL 파서로 한 모양(소문자 · 0 줄임 · 내장 IPv4 점 표기를 16진으로)으로 맞춘다.
 * `URL.hostname` 의 대괄호와 zone id(`fe80::1%eth0`)는 떼고 본다. IPv6 리터럴이 아니면 null.
 *
 * `URL.hostname` 은 이미 이 모양이지만 `dns.lookup` 결과는 `::ffff:127.0.0.1` 같은 점 표기로 온다.
 */
export function normalizeIpv6Literal(host: string): string | null {
  const unbracketed =
    host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host;
  const withoutZone = unbracketed.split('%')[0];
  // 파서에 넘기기 전에 문자 집합을 묶는다. `]` · `@` · `/` 가 섞이면 다른 URL 로 읽힐 수 있다.
  if (!withoutZone.includes(':') || !/^[0-9a-fA-F:.]+$/.test(withoutZone)) {
    return null;
  }
  try {
    return new URL(`http://[${withoutZone}]/`).hostname.slice(1, -1);
  } catch {
    return null;
  }
}

/**
 * 정규화된 IPv6 문자열을 16비트 그룹 여덟 개로 푼다. 정규화된 모양이 아니면 null.
 * 각 그룹은 소문자 16진 1~4자리여야 한다. 점 표기(`::ffff:127.0.0.1`) · 대문자 · 대괄호 · zone id · `::` 가 둘 이상 ·
 * 그룹 수가 8이 아닌 입력은 `parseInt` 가 앞쪽 16진수만 읽어 틀린 값을 돌려주므로 여기서 거른다.
 */
function ipv6Groups(normalized: string): number[] | null {
  const halves = normalized.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  // `::` 는 0 그룹 하나 이상을 줄인다. 그룹이 이미 8개 이상이면 줄일 자리가 없다(`Array(음수)` 는 RangeError).
  const fill = halves.length === 2 ? 8 - head.length - tail.length : 0;
  if (halves.length === 2 && fill < 1) return null;
  const groups = [...head, ...Array<string>(fill).fill('0'), ...tail];
  if (groups.length !== 8) return null;
  if (!groups.every((g) => /^[0-9a-f]{1,4}$/.test(g))) return null;
  return groups.map((g) => parseInt(g, 16));
}

/**
 * 마지막 32비트에 IPv4 를 품는 IPv6 표기에서 그 IPv4 를 꺼낸다. 아니면 null.
 * - IPv4-mapped `::ffff:0:0/96`
 * - IPv4-compatible `::/96` (RFC 4291 이 폐기했지만 파서는 받는다)
 * - SIIT `::ffff:0:0:0/96` (RFC 2765)
 * - NAT64 well-known prefix `64:ff9b::/96` (RFC 6052)
 *
 * 6to4(`2002::/16`)와 NAT64 local-use prefix(`64:ff9b:1::/48`)는 IPv4 위치가 달라 보지 않는다.
 *
 * 인자는 {@link normalizeIpv6Literal} 이 돌려준 값이다(소문자 · 대괄호 없음 · 점 표기 없음). 그 모양이 아니면 틀린 IPv4 를
 * 돌려주지 않고 null 을 돌려준다. null 은 "품은 IPv4 가 없다" 와 "정규화된 입력이 아니다" 를 함께 뜻하므로, 값을 직접 받아 쓰는
 * 호출자는 먼저 `normalizeIpv6Literal` 을 거친다.
 *
 * **통합 노드 가드(`nodes/integration/http-request/http-safety.ts` 의 `mappedIPv4`)와 판정 범위가 다르다.** 그쪽은 IPv4-mapped
 * 만 품은 IPv4 로 본다. macOS · `node:24-alpine` 에서 127.0.0.1 전용 서버에 닿는 표기가 mapped 뿐이었고, compatible · SIIT ·
 * NAT64 는 `EHOSTUNREACH`/`ENETUNREACH` 로 닿지 않았기 때문이다. 알림 웹훅 · MCP 는 NAT64(RFC 6052 · 6146) 망에서
 * `64:ff9b::a.b.c.d` 가 NAT64 게이트웨이를 거쳐 IPv4 `a.b.c.d` 로 변환되므로 /96 넷을 모두 막는다. 막는 것은 품은 IPv4 가 사설 ·
 * 특수 대역일 때뿐이라 공인 수신 서버에는 영향이 없다. 6to4 · NAT64 local-use prefix 는 IPv4 자리가 마지막 32비트가 아니라 판정하지
 * 않는다. 두 가드의 정규화와 IPv4 대역표가 따로 있는 중복은 NERV Task `CLE-T-753725` 가 모으고, 판정 범위를 맞출지는
 * `CLE-T-63RSH6` 가 정한다. 한쪽 정책을 바꿀 때는 `http-safety.ts` 의 `mappedIPv4` 와 그 테스트를 함께 본다.
 */
export function embeddedIpv4FromIpv6(normalized: string): string | null {
  const groups = ipv6Groups(normalized);
  if (!groups) return null;
  const [a, b, c, d, e, f, hi, lo] = groups;
  const zeroPrefix = a === 0 && b === 0 && c === 0 && d === 0;
  const embeds =
    (zeroPrefix && e === 0 && (f === 0xffff || f === 0)) || // mapped · compatible
    (zeroPrefix && e === 0xffff && f === 0) || // SIIT
    (a === 0x64 && b === 0xff9b && c === 0 && d === 0 && e === 0 && f === 0); // NAT64
  if (!embeds) return null;
  return `${hi >> 8}.${hi & 0xff}.${lo >> 8}.${lo & 0xff}`;
}

/**
 * 첫 그룹의 16비트 값으로 판정하는 특수 용도 IPv6 대역(CLE-T-W95HND).
 * - `fec0::/10` 옛 site-local (RFC 3879 가 폐기했지만 사설망에서 쓰일 수 있다)
 * - `ff00::/8` 멀티캐스트
 *
 * 문자열 접두가 아니라 그룹 값으로 본다. 정규화된 표기는 앞자리 0 을 지우므로 `fec::1`(0x0fec) · `ff::1`(0x00ff) 처럼
 * 접두만 같은 다른 주소가 있다. 인자는 {@link normalizeIpv6Literal} 이 돌려준 값이다.
 */
function isSpecialIpv6Prefix(normalized: string): boolean {
  const groups = ipv6Groups(normalized);
  if (!groups) return false;
  const first = groups[0];
  if ((first & 0xffc0) === 0xfec0) return true; // fec0::/10
  if ((first & 0xff00) === 0xff00) return true; // ff00::/8
  return false;
}

export function isPrivateIpv6(host: string): boolean {
  const lower = normalizeIpv6Literal(host);
  // null 은 IPv6 리터럴이 아니라는 뜻이라 사설로 보지 않는다(fail-open). 호출자 셋이 넘기는 값은 `':'` 가 든 `URL.hostname` 이나
  // `dns.lookup` 의 IPv6 결과뿐이라 URL 파서 · DNS 가 이미 IPv6 로 받은 문자열이다. 이 분기는 호출 경로에서 닿지 않는다.
  if (lower === null) return false;
  if (lower === '::1' || lower === '::') return true;
  if (
    lower.startsWith('fe80:') ||
    lower.startsWith('fe8') ||
    lower.startsWith('fe9') ||
    lower.startsWith('fea') ||
    lower.startsWith('feb')
  ) {
    // fe80::/10 (link-local)
    return true;
  }
  if (lower.startsWith('fc') || lower.startsWith('fd')) {
    // fc00::/7 (ULA)
    return true;
  }
  if (isSpecialIpv6Prefix(lower)) return true;
  const embedded = embeddedIpv4FromIpv6(lower);
  return embedded !== null && isPrivateIpv4(embedded);
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
 * - 검사한 주소를 fetch 에 고정하지 않는다. 검사와 연결 사이에 DNS 응답이 바뀌는 경우는 남는다.
 * - 해석이 `DNS_LOOKUP_TIMEOUT_MS` 안에 끝나지 않으면 해석 실패와 똑같이 통과시킨다(fail-open). 시간을 넘긴
 *   `getaddrinfo` 는 libuv 스레드풀을 계속 점유한다. 그 점유는 여기서 풀지 않고, 주소 고정을 도입하는
 *   후속 작업(CLE-T-GAQCF9)이 발송 쪽 조회와 합칠 때 다룬다.
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
  if (isLiteralIpv4(hostname)) {
    return isPrivateIpv4(hostname)
      ? { ok: false, reason: 'resolved IPv4 is private' }
      : { ok: true };
  }
  if (hostname.includes(':')) {
    return isPrivateIpv6(hostname)
      ? { ok: false, reason: 'resolved IPv6 is private' }
      : { ok: true };
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
    if (address.includes(':')) {
      if (isPrivateIpv6(address)) {
        return {
          ok: false,
          reason: `resolved IPv6 ${address} falls in a private range`,
        };
      }
    } else if (isPrivateIpv4(address)) {
      return {
        ok: false,
        reason: `resolved IPv4 ${address} falls in a private/loopback/metadata range`,
      };
    }
  }
  return { ok: true };
}
