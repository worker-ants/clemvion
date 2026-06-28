/**
 * 공개(인증 없음) webhook e2e 요청용 **고유 클라이언트 IP** 생성기.
 *
 * 배경 (D-12, #770): `PublicWebhookThrottleGuard` 는 IP 미식별 요청 — `X-Forwarded-For`
 * (신뢰 시 `CF-Connecting-IP`) 헤더 부재 — 을 단일 공유 버킷(`UNIDENTIFIED_IP_BUCKET =
 * '__no_client_ip__'`)으로 묶어 per-IP 와 동일한 fixed-window 한도(기본 10/분·20/시간)를
 * 적용한다. supertest e2e 요청에는 XFF 가 없으므로, 공개 webhook 을 때리는 모든 e2e 요청이
 * 이 버킷 하나로 collapse → 누적 호출이 한도를 넘으면 `429 PUBLIC_WEBHOOK_RATE_LIMIT`.
 *
 * 운영에서는 ingress/trust-proxy 가 XFF 를 주입해 **provider IP 별 버킷**이 되므로 collapse 가
 * 없다. e2e 도 요청마다 고유 XFF 를 부여해 동형으로 per-IP 버킷을 분리한다 — 제품 코드·D-12
 * 보안 결정은 건드리지 않고 테스트 환경만 운영과 정합화한다.
 *
 * 사용:
 *   import { nextE2eClientIp } from './helpers/e2e-client-ip';
 *   await request(BASE_URL)
 *     .post(`/api/hooks/${endpointPath}`)
 *     .set('x-forwarded-for', nextE2eClientIp())
 *     .send(body);
 *
 * IP 대역: RFC 5737 TEST-NET-3 (`203.0.113.0/24`) — 문서·테스트 전용으로 예약돼 실제 호스트와
 * 충돌하지 않는다. jest 는 테스트 파일마다 모듈 레지스트리를 새로 구성하므로 카운터는 파일별로
 * 리셋된다(파일당 호출 수 « 254). 방어적으로 254 에서 wraparound 시킨다.
 *
 * 정책 SoT: [spec/7-channel-web-chat/4-security.md §4·R6],
 *   `src/modules/hooks/public-webhook-quota.service.ts` (`UNIDENTIFIED_IP_BUCKET`).
 */
let clientIpSeq = 0;

/** 호출마다 `203.0.113.<n>` (n = 1..254 순환) 고유 IP 를 반환한다. */
export function nextE2eClientIp(): string {
  clientIpSeq = (clientIpSeq % 254) + 1;
  return `203.0.113.${clientIpSeq}`;
}
