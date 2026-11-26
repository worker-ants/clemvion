/**
 * 사설망 차단 가드 결과 처리 헬퍼. Database Query · Send Email 노드와 두 연결 테스트(Database · Email)가 연결 전 판정과
 * 연결 시점 판정의 결과를 같은 규칙으로 다루게 한다(NERV Task `CLE-T-NTKWWV`). 스펙: CLE-NODE-INT-COMMON-ERROR
 * 「사설망 차단」.
 *
 * - 차단 판정(`SsrfBlockedError`)의 원문에는 막힌 host · IP 가 들어 있다. 이 헬퍼가 원문을 서버 경고 로그에만 남기고,
 *   호출부는 사용자 · 활동 로그에 사이트별 차단 코드와 고정 문구를 낸다.
 * - 판정이 아닌 오류는 가드의 고장이다. 원문을 경고 로그에만 남기고, 호출부는 사이트별 가드 고장 코드와
 *   `SSRF_GUARD_FAILED_CLIENT_MESSAGE` 를 낸다. 원본 오류는 `cause` 로도 싣지 않는다.
 *
 * 코드 · 문구로 바꾸는 일은 호출부에 남는다. 노드는 `IntegrationError` 를 던지고 연결 테스트는 결과를 돌려주며,
 * 사이트마다 코드가 다르다(`EMAIL_SEND_FAILED` · `EMAIL_CONNECT_FAILED` · `DB_CONNECT_FAILED` · `INTEGRATION_CALL_FAILED`).
 * HTTP Request 노드는 리다이렉트 홉 판정과 얽혀 있어 이 헬퍼를 쓰지 않는다.
 */
import { findCause } from '../guarded-lookup-dispatcher.js';
import { SsrfBlockedError } from './outbound-guard.js';

/** 경고 로그를 남길 곳. Nest `Logger` 를 그대로 넘긴다. */
export interface SsrfGuardLogger {
  warn(message: string): void;
}

/**
 * 연결 전 판정의 결과. `blocked` · `guard_failed` 의 원문은 {@link runSsrfPreflight} 가 이미 경고 로그에 남겼다.
 */
export type SsrfPreflightOutcome = 'pass' | 'blocked' | 'guard_failed';

/**
 * 연결 전 판정을 돌리고 결과를 가른다. `check` 는 두 형태를 받는다.
 *
 * - 막히면 `SsrfBlockedError` 를 던진다(`assertSafeOutboundHostResolved`).
 * - 막히면 `SsrfBlockedError` 를 돌려주고 통과면 `null` 을 돌려준다(`checkSmtpHost`).
 *
 * 그 밖의 오류를 던지면 `guard_failed` 다. 경고 로그는 `SSRF block (<site>): …` · `SSRF guard failed (<site>): …` 형식이다.
 */
export async function runSsrfPreflight(
  check: () => Promise<SsrfBlockedError | null | void>,
  logger: SsrfGuardLogger,
  site: string,
): Promise<SsrfPreflightOutcome> {
  let verdict: SsrfBlockedError | null | void;
  try {
    verdict = await check();
  } catch (err) {
    if (err instanceof SsrfBlockedError) {
      verdict = err;
    } else {
      logger.warn(
        `SSRF guard failed (${site}): ${err instanceof Error ? err.message : String(err)}`,
      );
      return 'guard_failed';
    }
  }
  if (!verdict) return 'pass';
  logger.warn(`SSRF block (${site}): ${verdict.message}`);
  return 'blocked';
}

/**
 * 연결 시점 판정(드라이버 소켓 어댑터의 `lookup`)이 막은 실패인지 본다. 드라이버는 소켓 오류를 그대로 또는 감싸서
 * 올리므로 `cause` 사슬에서 `SsrfBlockedError` 를 찾는다. 찾으면 원문을 `SSRF block at connect time (<site>): …` 로
 * 경고 로그에 남기고 그 오류를 돌려준다. 없으면 `undefined` 이고 로그를 남기지 않는다.
 */
export function findConnectTimeBlock(
  err: unknown,
  logger: SsrfGuardLogger,
  site: string,
): SsrfBlockedError | undefined {
  const blocked = findCause(err, SsrfBlockedError);
  if (blocked) {
    logger.warn(`SSRF block at connect time (${site}): ${blocked.message}`);
  }
  return blocked;
}
