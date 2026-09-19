import { CONNECTION_TEST_CODES } from './connection-test-codes';
import type { IntegrationTestResult } from './integrations.service';

describe('연결 테스트 결과 코드', () => {
  /**
   * 기대값을 **리터럴로** 적는다 — 상수를 상수로 대조하면 상수의 오타가 테스트에도 그대로 들어가, wire 값(spec
   * 2-navigation/4-integration.md §5.3 · §5.4 · §5.5)을 보는 눈이 사라진다.
   */
  it('transport tester 코드의 wire 값', () => {
    expect(CONNECTION_TEST_CODES).toEqual({
      EMAIL_HOST_BLOCKED: 'EMAIL_HOST_BLOCKED',
      EMAIL_CONNECT_FAILED: 'EMAIL_CONNECT_FAILED',
      DB_HOST_BLOCKED: 'DB_HOST_BLOCKED',
      DB_AUTH_FAILED: 'DB_AUTH_FAILED',
      DB_CONNECT_FAILED: 'DB_CONNECT_FAILED',
      HTTP_BLOCKED: 'HTTP_BLOCKED',
      HTTP_AUTH_FAILED: 'HTTP_AUTH_FAILED',
      HTTP_SERVER_ERROR: 'HTTP_SERVER_ERROR',
      HTTP_CONNECT_FAILED: 'HTTP_CONNECT_FAILED',
    });
  });

  /**
   * `IntegrationTestResult.code` 는 연결 테스트 코드의 literal union 이다 — 노드 런타임 `ErrorCode`(이름이 가깝다)나 오타를
   * 넣으면 컴파일이 막힌다.
   *
   * ⚠️ **강제하는 것은 jest 가 아니라 `tsc` 다.** 이 저장소의 jest 는 타입을 지우므로 아래 `it` 은 런타임에 no-op 이다. 실제 가드는
   * 타입 래칫 게이트(`scripts/check-backend-typecheck-ratchet.py`, build 단계) — 타입을 `string` 으로 되돌리면 아래
   * `@ts-expect-error` 셋이 «쓰이지 않음» 오류가 되어 진단이 늘고 게이트가 깨진다.
   */
  it('타입 수준 계약 (런타임 no-op)', () => {
    // union 을 이루는 여섯 무리에서 하나씩 — 한 무리가 union 에서 빠지면 그 줄이 컴파일되지 않는다.
    const accepted: IntegrationTestResult[] = [
      {
        success: false,
        message: '',
        code: 'INTEGRATION_CREDENTIALS_UNREADABLE',
      },
      { success: false, message: '', code: 'DB_AUTH_FAILED' },
      { success: false, message: '', code: 'MCP_TIMEOUT' },
      { success: false, message: '', code: 'CAFE24_INSUFFICIENT_SCOPE' },
      { success: false, message: '', code: 'MAKESHOP_TRANSPORT_FAILED' },
      { success: false, message: '', code: 'INTEGRATION_AUTH_UNSUPPORTED' },
    ];
    const rejected: IntegrationTestResult[] = [
      // @ts-expect-error 노드 런타임 코드(DB 노드) — 연결 테스트는 DB_CONNECT_FAILED 다
      { success: false, message: '', code: 'DB_CONNECTION_ERROR' },
      // @ts-expect-error 노드 런타임 코드(HTTP 노드) — 연결 테스트는 HTTP_CONNECT_FAILED 다
      { success: false, message: '', code: 'HTTP_TRANSPORT_FAILED' },
      // @ts-expect-error 오타 — 어휘에 없는 값
      { success: false, message: '', code: 'DB_AUTH_FAIL' },
    ];
    expect(accepted).toHaveLength(6);
    expect(rejected).toHaveLength(3);
  });
});
