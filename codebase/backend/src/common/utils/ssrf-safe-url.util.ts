/**
 * SSRF (Server-Side Request Forgery) 방지 — outbound HTTP 호출 대상 URL 의 register-time
 * 검증 헬퍼.
 *
 * 검증 정책 ([Spec EIA §3.1 EIA-NX-09 / §8.1 / §R12]):
 * 1. URL 파싱 가능해야 함.
 * 2. protocol 은 `https:` (개발 환경 환경변수 `ALLOW_HTTP_HOOKS=1` 일 때만 `http:` 허용).
 * 3. hostname 이 literal IP 형태인 경우 사설 IP / metadata service IP / loopback 차단:
 *    - IPv4: 10/8, 172.16/12, 192.168/16, 127/8, 169.254/16, 100.64/10 (CGNAT)
 *    - IPv6: ::1, fe80::/10 (link-local), fc00::/7 (ULA), unspecified ::
 *    - cloud metadata: 169.254.169.254 (AWS/Azure/GCP)
 *
 * 본 헬퍼는 **DNS resolution 을 수행하지 않는다** — register-time 에 외부 DNS 호출을 만들면
 * 테스트 환경에서 결정성이 깨지고 DNS rebinding 방어에도 불완전하다. 발송 시점의
 * post-resolve 검증은 NotificationDispatcher (P3) 가 담당한다 (등록 시 IP 와 발송 시 IP 가
 * 다르면 발송 거부 — Spec EIA §8.1).
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
];

const IPV4_REGEX = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;

export function isLiteralIpv4(host: string): boolean {
  return IPV4_REGEX.test(host);
}

export function isPrivateIpv4(host: string): boolean {
  if (!isLiteralIpv4(host)) return false;
  return PRIVATE_IPV4_PATTERNS.some((p) => p.test(host));
}

export function isPrivateIpv6(host: string): boolean {
  // URL.host 에서 IPv6 는 bracketed 로 노출. URL.hostname 은 unbracketed.
  const stripped = host.startsWith('[') ? host.slice(1, -1) : host;
  if (!/^[0-9a-fA-F:]+$/.test(stripped)) return false;
  const lower = stripped.toLowerCase();
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
  return false;
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
  // IPv6 검사 — URL.hostname 은 bracket 없이 반환
  if (hostname.includes(':') && isPrivateIpv6(hostname)) {
    return {
      ok: false,
      reason: 'URL hostname must not be a private IPv6 address',
    };
  }

  return { ok: true };
}

/**
 * Post-resolve SSRF 검증 — URL 호스트의 DNS A/AAAA 레코드를 resolve 한 뒤 그 결과 IP 가 사설/
 * loopback/metadata 대역인지 검사. DNS rebinding 방어용.
 *
 * 환경변수 `NOTIFICATION_ENFORCE_DNS_REBIND_GUARD=1` 일 때만 호출자가 사용. default 는 비활성
 * (DNS 호출 비용 + 발송 latency 증가).
 *
 * [Spec EIA §8.1] — "DNS rebinding 방어: 등록 시 IP 와 실제 발송 시 IP 가 다르면 발송 거부".
 * 본 헬퍼는 "발송 시 IP 가 사설 대역" 까지만 검증 (등록 시 IP 와의 비교는 보관 필요해 비용 큼).
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
  // 도메인 → DNS resolve
  let dns: typeof import('dns/promises');
  try {
    dns = await import('dns/promises');
  } catch {
    // dns 모듈 미가용 (browser bundling 등) — fail-open.
    return { ok: true };
  }
  let addrs: string[] = [];
  try {
    const v4 = await dns.resolve4(hostname).catch(() => [] as string[]);
    const v6 = await dns.resolve6(hostname).catch(() => [] as string[]);
    addrs = [...v4, ...v6];
  } catch {
    // resolve 실패 — fail-open (NotificationDispatcher 의 fetch 가 어차피 ECONNREFUSED 처리).
    return { ok: true };
  }
  for (const ip of addrs) {
    if (isPrivateIpv4(ip)) {
      return {
        ok: false,
        reason: `resolved IPv4 ${ip} falls in a private/loopback/metadata range`,
      };
    }
    if (ip.includes(':') && isPrivateIpv6(ip)) {
      return {
        ok: false,
        reason: `resolved IPv6 ${ip} falls in a private range`,
      };
    }
  }
  return { ok: true };
}
