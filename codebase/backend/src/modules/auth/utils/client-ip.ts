import { Request } from 'express';

/**
 * 04 m-3 — `CF-Connecting-IP` 헤더를 신뢰할지 여부 (`TRUST_CF_CONNECTING_IP` env).
 *
 * **기본 off (fail-safe)**: `CF-Connecting-IP` 는 클라이언트가 임의로 보낼 수 있는
 * 헤더라, Cloudflare 뒤가 아닌 배포에서 무조건 신뢰하면 rate-limit 우회·감사로그/로그인
 * 이력 IP 오염이 가능하다. 따라서 **명시적으로 켠 배포에서만** 1순위로 사용한다.
 * Cloudflare(Tunnel 포함) 뒤 배포는 `TRUST_CF_CONNECTING_IP=true` 로 활성화한다.
 * 정확히 `'true'`/`'1'` 만 ON (`isFlagOn` 규칙과 동일).
 *
 * @param env 검사할 환경변수 맵(기본 `process.env`).
 */
export function shouldTrustCfConnectingIp(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const v = env.TRUST_CF_CONNECTING_IP;
  return v === 'true' || v === '1';
}

/**
 * 클라이언트 IP 추출 우선순위:
 *   1) CF-Connecting-IP   — `TRUST_CF_CONNECTING_IP` 가 켜진 경우에만 (CF 가 채우는 원본 IP)
 *   2) X-Forwarded-For    — 첫 번째 IP (trust proxy 가 신뢰하는 프록시가 채움)
 *   3) req.ip             — Express 가 trust proxy 활성 시 파싱한 값
 *   4) req.socket.remoteAddress
 *
 * IPv6-mapped IPv4 (::ffff:1.2.3.4) 는 IPv4 표기로 정규화한다.
 *
 * SECURITY (04 m-3): CF-Connecting-IP 는 위변조 가능한 헤더이므로 기본적으로 무시하고,
 * `TRUST_CF_CONNECTING_IP=true` 로 명시한 CF-뒤 배포에서만 1순위로 사용한다. origin 단에서
 * CF 외 직접 접근이 차단된다는 전제(CF Tunnel 등)가 활성화의 근거다.
 *
 * @remarks CF 신뢰 판정은 `process.env.TRUST_CF_CONNECTING_IP` 에 암묵 의존한다
 *   (`shouldTrustCfConnectingIp()` 인자 없이 호출) — 테스트는 해당 env 를 직접 주입·복원한다.
 * @remarks 반환형은 `string | null` 로, 헤더 전용 코어 `extractClientIpFromHeaders`(`string | undefined`)와
 *   **의도적으로 다르다** — 본 함수는 req 기반 4단계 폴백(req.ip/socket)을 갖는 세션·감사 IP 경로용이고,
 *   소비처(auth/webauthn controller·sessions·audit)는 `ip:` 필드나 `?? undefined` 로 null 을 그대로 수용한다.
 *   undefined 통일은 헤더 전용 코어(webhook rate-limit·ip_whitelist)에 한정한다.
 */
export function extractClientIp(req: Request): string | null {
  const fromHeaders = extractClientIpFromHeaders(req.headers ?? {});
  if (fromHeaders) return fromHeaders;

  if (typeof req.ip === 'string' && req.ip.trim()) {
    return normalize(req.ip.trim());
  }

  const remote = req.socket?.remoteAddress;
  if (typeof remote === 'string' && remote.trim()) {
    return normalize(remote.trim());
  }

  return null;
}

/**
 * 헤더만으로 클라이언트 IP 를 추출하는 공유 코어 — `CF-Connecting-IP`(신뢰 시) →
 * `X-Forwarded-For` 첫 IP 순. `req` 가 없는 호출부(공개 webhook rate-limit guard,
 * `ip_whitelist` 검증)가 사용한다. `extractClientIp(req)` 도 이 함수를 1차로 쓰고
 * `req.ip`/`socket` 폴백을 덧붙인다 — CF-신뢰 게이트(`shouldTrustCfConnectingIp`)·
 * XFF 파싱 로직을 **한 곳에 단일화**해 사본 간 drift 를 막는다(04 후속).
 *
 * @returns 추출된 IP 또는 `undefined`(헤더에서 식별 불가). optional `sourceIp?`·`ip_whitelist`
 *   소비처가 `string | undefined` 를 그대로 받도록 통일했다(과거 `string | null` + 호출부 `?? undefined` 제거).
 *   `if (!ip)` falsy 분기(guard)와 동작 동일.
 */
export function extractClientIpFromHeaders(
  headers: Record<string, string | string[] | undefined>,
): string | undefined {
  if (shouldTrustCfConnectingIp()) {
    const cf = pickFirst(headers['cf-connecting-ip']);
    if (cf) return normalize(cf);
  }

  const xff = pickFirst(headers['x-forwarded-for']);
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return normalize(first);
  }

  return undefined;
}

function pickFirst(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    const found = value.find((v) => typeof v === 'string' && v.trim() !== '');
    return found ? found.trim() : undefined;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  return undefined;
}

function normalize(ip: string): string {
  // IPv6-mapped IPv4 ("::ffff:1.2.3.4") → "1.2.3.4"
  const match = ip.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i);
  return match ? match[1] : ip;
}
