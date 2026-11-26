import { connect, type LookupFunction, type Socket } from 'node:net';
import {
  assertSafeOutboundHostResolved,
  safeOutboundLookup,
  SsrfBlockedError,
} from '../../../common/utils/ssrf/outbound-guard.js';

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
 * nodemailer 의 연결 대기 기본값(ms). `connectionTimeout` 을 주지 않은 transport 는 nodemailer 와 같은 상한으로 TCP 연결을
 * 기다린다(`smtp-connection` 의 `CONNECTION_TIMEOUT`).
 */
export const SMTP_DEFAULT_CONNECTION_TIMEOUT_MS = 2 * 60 * 1000;

/** {@link guardedSmtpGetSocket} 이 읽는 transport 옵션. nodemailer 가 transport 옵션 전체를 넘긴다. */
export interface SmtpSocketTarget {
  host?: string;
  port?: number;
  secure?: boolean;
  connectionTimeout?: number;
}

/** nodemailer `getSocket` 훅. `{ connection }` 을 돌려주면 nodemailer 가 그 소켓으로 SMTP 대화를 한다. */
export type SmtpGetSocket = (
  options: SmtpSocketTarget,
  callback: (err: Error | null, socketOptions?: { connection: Socket }) => void,
) => void;

/**
 * SMTP 연결 시점 판정. nodemailer transport 옵션의 `getSocket` 으로 넘기면 TCP 소켓을 이 함수가 연다. 연결할 때 푼 주소를
 * 공용 대역표로 다시 판정하고(`safeOutboundLookup`), 통과한 주소로만 연결한 뒤 그 소켓을 nodemailer 에 넘긴다. 막히면
 * 콜백이 `SsrfBlockedError` 를 받고, 발송 · `verify()` 가 그 오류로 실패한다.
 *
 * - `ALLOW_PRIVATE_HOST_TARGETS=true` 면 `undefined` 다. nodemailer 가 자기 해석기로 그대로 연결한다.
 * - nodemailer 는 자체 해석(`dns.resolve4` → `resolve6` → `dns.lookup`)을 하고 `lookup` 옵션을 받지 않는다. 그래서
 *   소켓을 직접 연다. 이 경로에서는 nodemailer 의 해석 · 대체 주소 재시도를 거치지 않고, 대체 주소 선택은 Node
 *   `net.connect` 의 기본 동작(autoSelectFamily)을 따른다.
 * - nodemailer 의 `connectionTimeout` 은 넘겨받은 소켓의 TCP 연결을 기다리지 않는다. 그래서 같은 값(없으면
 *   {@link SMTP_DEFAULT_CONNECTION_TIMEOUT_MS})으로 이 함수가 연결 대기에 상한을 둔다. 넘기면 소켓을 닫고
 *   `ETIMEDOUT` 오류를 넘긴다.
 * - 직접 TLS(`secure`)와 STARTTLS 는 nodemailer 가 이 소켓 위에서 맺는다. SNI · 인증서 검증의 이름은 transport 의
 *   `host` 그대로다(nodemailer 가 `options.host` 로 `servername` 을 정한다).
 * - IP 리터럴 host 는 조회를 거치지 않는다. 리터럴은 앞선 {@link checkSmtpHost} 가 판정한다.
 */
export function guardedSmtpGetSocket(): SmtpGetSocket | undefined {
  const lookup = safeOutboundLookup();
  return lookup ? createSmtpGetSocket(lookup) : undefined;
}

/**
 * 주어진 `lookup` 으로 TCP 소켓을 여는 nodemailer `getSocket` 훅. 운영 경로는 {@link guardedSmtpGetSocket} 이 공용 판정
 * lookup 을 넣어 부른다. 연결 대기 상한 · 기본 host/port 는 그 함수의 설명과 같다.
 */
export function createSmtpGetSocket(lookup: LookupFunction): SmtpGetSocket {
  return (options, callback) => {
    // nodemailer `SMTPConnection` 의 기본값과 같다(host 가 없으면 localhost, port 가 없으면 secure 여부로 465/587).
    const host = options.host || 'localhost';
    const port = Number(options.port) || (options.secure ? 465 : 587);
    const timeoutMs =
      options.connectionTimeout || SMTP_DEFAULT_CONNECTION_TIMEOUT_MS;

    const socket = connect({ host, port, lookup });
    let settled = false;
    const finish = (err: Error | null): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.removeListener('error', onError);
      socket.removeListener('connect', onConnect);
      if (err) {
        socket.destroy();
        callback(err);
        return;
      }
      callback(null, { connection: socket });
    };
    const onError = (err: Error): void => finish(err);
    const onConnect = (): void => finish(null);
    const timer = setTimeout(() => {
      const timeoutErr: NodeJS.ErrnoException = new Error('Connection timeout');
      timeoutErr.code = 'ETIMEDOUT';
      finish(timeoutErr);
    }, timeoutMs);
    socket.once('error', onError);
    socket.once('connect', onConnect);
  };
}
