import {
  assertSafeOutboundHostResolved,
  safeOutboundLookup,
  SsrfBlockedError,
} from '../../../common/utils/ssrf/outbound-guard.js';
import {
  createSmtpGetSocket,
  SMTP_DEFAULT_CONNECTION_TIMEOUT_MS,
  type SmtpGetSocket,
  type SmtpSocketTarget,
} from '../../../common/utils/ssrf/socket-adapters.js';

// SMTP `getSocket` 어댑터는 `common/utils/ssrf/socket-adapters.ts` 로 옮겼다(NERV Task `CLE-T-AM1H7X`). 이 모듈의 경로를
// 가리키는 스펙 · 호출부가 그대로 쓰도록 여기서도 내보낸다. 사설망 허용 플래그를 보고 어댑터를 실을지는 {@link guardedSmtpGetSocket} 이 정한다.
export {
  createSmtpGetSocket,
  SMTP_DEFAULT_CONNECTION_TIMEOUT_MS,
  type SmtpGetSocket,
  type SmtpSocketTarget,
};

/**
 * SMTP host 가 막혔을 때의 클라이언트 문구. 차단된 host/IP 는 싣지 않는다(정찰 면 축소, 원본 상세는 서버 로그에만).
 * 노드(`EMAIL_HOST_BLOCKED` 노드 에러)와 연결 테스트(`EMAIL_HOST_BLOCKED` 결과 코드)가 같은 문구를 쓴다.
 */
export const EMAIL_HOST_BLOCKED_MESSAGE =
  'SMTP host points to a private/loopback address blocked by policy.';

/**
 * SMTP SSRF 가드 — HTTP Request · DB Query 노드와 **같은 구현**(`common/utils/ssrf/outbound-guard.ts`)을 쓴다. 막는 대역은
 * 공용 판정(`common/utils/ssrf/ip-classifier.ts`)이 정하고, self-host 환경은 `ALLOW_PRIVATE_HOST_TARGETS=true` 로
 * opt-out 한다(내부 SMTP relay 사용 사례 보존). 스펙: CLE-NODE-INT-COMMON-ERROR 「사설망 차단」, CLE-NODE-EMAIL.
 *
 * 종전에는 LLM 프로바이더용 `common/utils/ssrf.util` 을 썼다 — spec 은 «HTTP Request 가드와 동일 메커니즘» 이라 적었지만 실제로는
 * 다른 구현이었고, CGNAT(`100.64.0.0/10`)와 `::` 를 통과시켰다.
 *
 * connection test (`IntegrationsService.testEmailTransport`) 와 실제 발송 (`SendEmailHandler`) 양쪽에서 호출해, 테스트만 막고
 * 발송은 뚫리는 비대칭을 방지한다.
 *
 * 빈 host 와 DNS 해석 실패는 막지 않는다 — 빈 host 는 앞선 필수 필드 검증이 걸러내고, 해석되지 않는 host 에는 어차피 닿지
 * 못한다(`assertSafeOutboundHostResolved` 와 같다). 이 검사와 연결 사이에 DNS 응답이 바뀌는 경우(DNS rebinding)는
 * {@link guardedSmtpGetSocket} 이 연결할 때 다시 판정해서 막는다.
 *
 * 막히면 판정 오류(`SsrfBlockedError`)를 돌려주고 통과면 `null` 이다. 판정 오류의 메시지에는 차단된 host · IP 원문이 들어 있다.
 * 호출부는 이 원문을 서버 경고 로그에만 남기고 사용자에게는 {@link EMAIL_HOST_BLOCKED_MESSAGE} 를 낸다(CLE-T-FWSAJ4).
 */
export async function checkSmtpHost(
  host: string,
): Promise<SsrfBlockedError | null> {
  const trimmed = host?.trim();
  if (!trimmed) return null;
  try {
    await assertSafeOutboundHostResolved(trimmed);
    return null;
  } catch (err) {
    // 판정은 `SsrfBlockedError` 하나뿐이다. 다른 오류가 여기로 오면 판정이 아니므로 삼키지 않는다.
    if (err instanceof SsrfBlockedError) return err;
    throw err;
  }
}

/**
 * SMTP 연결 시점 판정. nodemailer transport 옵션의 `getSocket` 으로 넘기면 TCP 소켓을 공용 어댑터
 * ({@link createSmtpGetSocket})가 연다. 연결할 때 푼 주소를 공용 대역표로 다시 판정하고(`safeOutboundLookup`), 통과한
 * 주소로만 연결한다. 막히면 발송 · `verify()` 가 `SsrfBlockedError` 로 실패한다. 연결 대기 상한 · TLS · 기본 host/port 는
 * 어댑터의 설명과 같다.
 *
 * - `ALLOW_PRIVATE_HOST_TARGETS=true` 면 `undefined` 다. nodemailer 가 자기 해석기로 그대로 연결한다.
 * - IP 리터럴 host 는 조회를 거치지 않는다. 리터럴은 앞선 {@link checkSmtpHost} 가 판정한다.
 */
export function guardedSmtpGetSocket(): SmtpGetSocket | undefined {
  const lookup = safeOutboundLookup();
  return lookup ? createSmtpGetSocket(lookup) : undefined;
}
