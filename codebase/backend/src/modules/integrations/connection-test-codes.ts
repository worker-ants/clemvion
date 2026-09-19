import type { McpFailureCode } from '../mcp/mcp-test-connection.service';
import type { HttpCredentialsResult } from '../../nodes/integration/http-request/http-credentials';
import type { Cafe24PingCode } from '../../nodes/integration/cafe24/cafe24-api.client';
import type { MakeshopPingCode } from '../../nodes/integration/makeshop/makeshop-api.client';

/**
 * 연결 테스트의 transport tester 가 스스로 내는 결과 코드 — spec `2-navigation/4-integration.md` §5.3(HTTP) · §5.4(Database) ·
 * §5.5(Email) · §14.1. 생산자(`http-connection-tester.ts` · `database-connection-tester.ts` · `IntegrationsService.testEmailTransport`)가
 * 이 상수를 쓴다.
 *
 * 노드 런타임 `ErrorCode`(`nodes/core/error-codes.ts`)와 **다른 namespace** 다(§14.1). 두 무리로 갈린다:
 * - **이름 · 뜻이 노드와 같다** — 호스트 차단 셋(`HTTP_BLOCKED` · `DB_HOST_BLOCKED` · `EMAIL_HOST_BLOCKED`). 같은 SSRF 가드의 판정이다.
 * - **이름만 가깝다** — 나머지. 노드는 `DB_CONNECTION_ERROR` · `HTTP_TRANSPORT_FAILED` 인데 연결 테스트는 `DB_CONNECT_FAILED` ·
 *   `HTTP_CONNECT_FAILED` 다. 그래서 `IntegrationTestResult.code` 를 아래 union 으로 좁혀, 섞어 쓰면 컴파일이 막히게 한다.
 */
export const CONNECTION_TEST_CODES = {
  EMAIL_HOST_BLOCKED: 'EMAIL_HOST_BLOCKED',
  EMAIL_CONNECT_FAILED: 'EMAIL_CONNECT_FAILED',
  DB_HOST_BLOCKED: 'DB_HOST_BLOCKED',
  DB_AUTH_FAILED: 'DB_AUTH_FAILED',
  DB_CONNECT_FAILED: 'DB_CONNECT_FAILED',
  HTTP_BLOCKED: 'HTTP_BLOCKED',
  HTTP_AUTH_FAILED: 'HTTP_AUTH_FAILED',
  HTTP_SERVER_ERROR: 'HTTP_SERVER_ERROR',
  HTTP_CONNECT_FAILED: 'HTTP_CONNECT_FAILED',
} as const;

export type TransportTestCode =
  (typeof CONNECTION_TEST_CODES)[keyof typeof CONNECTION_TEST_CODES];

/**
 * `IntegrationsService.testConnection` 이 테스터를 부르기 **전에** 스스로 돌려주는 코드 — 자격증명을 복호화하지 못함 ·
 * `pending_install`(spec §9.1). 상수로 빼지 않는다 — 쓰는 곳이 한 함수뿐이고, 둘 다 통합 전반의 코드라 테스터 어휘가 아니다.
 * 오타는 이 union 이 막는다.
 */
type TestGateCode =
  'INTEGRATION_CREDENTIALS_UNREADABLE' | 'INTEGRATION_INCOMPLETE';

/**
 * `IntegrationTestResult.code` 가 가질 수 있는 값 전부 — 생산자마다 자기 어휘를 내보내고 여기서 모은다(타입만 가져온다 — 런타임
 * import 가 아니라 순환이 생기지 않는다):
 * - 테스터 앞의 게이트 — {@link TestGateCode}
 * - transport tester 셋 — {@link CONNECTION_TEST_CODES}
 * - MCP — `McpFailureCode`(spec `5-system/11-mcp-client.md` §8.2)
 * - HTTP 자격증명을 붙이기 전 실패 — `resolveHttpCredentials`(노드와 공유)
 * - Cafe24 · MakeShop entity tester — 각 클라이언트의 `pingConnection`
 */
export type IntegrationTestResultCode =
  | TestGateCode
  | TransportTestCode
  | McpFailureCode
  | Extract<HttpCredentialsResult, { ok: false }>['code']
  | Cafe24PingCode
  | MakeshopPingCode;
