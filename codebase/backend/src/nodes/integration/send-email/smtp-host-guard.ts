import { assertSafeOutboundHostResolved } from '../http-request/http-safety.js';

/**
 * SMTP SSRF 가드 — HTTP Request · DB Query 노드와 **같은 구현**(`http-request/http-safety.ts`)을 쓴다: 사설(RFC1918) · loopback ·
 * link-local · CGNAT · IPv6 사설 대역(IPv4-mapped 표기 포함) host 를 기본 차단하고, self-host 환경은
 * `ALLOW_PRIVATE_HOST_TARGETS=true` 로 opt-out 한다(내부 SMTP relay 사용 사례 보존). spec 4-integration §5.5 · 3-send-email §4.
 *
 * 종전에는 LLM 프로바이더용 `common/utils/ssrf.util` 을 썼다 — spec 은 «HTTP Request 가드와 동일 메커니즘» 이라 적었지만 실제로는
 * 다른 구현이었고, CGNAT(`100.64.0.0/10`)와 `::` 를 통과시켰다.
 *
 * connection test (`IntegrationsService.testEmailTransport`) 와 실제 발송 (`SendEmailHandler`) 양쪽에서 호출해, 테스트만 막고
 * 발송은 뚫리는 비대칭을 방지한다.
 *
 * DNS 해석 실패는 막지 않는다(`assertSafeOutboundHostResolved` 와 같다 — 해석되지 않는 host 에는 어차피 닿지 못한다). DNS rebinding
 * 2차 공격(연결 시점 재해석)은 막지 못하며 egress 방화벽으로 보완한다.
 */
export async function isSmtpHostBlocked(host: string): Promise<boolean> {
  const trimmed = host?.trim();
  if (!trimmed) return false;
  try {
    await assertSafeOutboundHostResolved(trimmed);
    return false;
  } catch (err) {
    // 가드가 던지는 것은 `SSRF_BLOCKED:` 하나뿐이다. 다른 오류가 여기로 오면 판정이 아니므로 삼키지 않는다.
    if (err instanceof Error && err.message.startsWith('SSRF_BLOCKED')) {
      return true;
    }
    throw err;
  }
}
