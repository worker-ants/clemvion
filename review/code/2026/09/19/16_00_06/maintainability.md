# 유지보수성(Maintainability) 리뷰

대상: Database·HTTP 통합 연결 테스트 신설 (`spec/2-navigation/4-integration.md` §5.3·§5.4 구현) + 관련 리팩터링.
`codebase/backend/src/modules/integrations/**`, `codebase/backend/src/nodes/integration/**`, 테스트, 문서를 대상으로
검토했다. `review/consistency/**`·`plan/**`·JSON 리트라이 상태 파일 등은 자동 생성 산출물/프로세스 문서라 함수 길이·매직넘버 등
코드 품질 관점의 대상이 아니므로 이번 리뷰에서 제외했다(내용 정합성은 이미 consistency-checker 가 다뤘다).

## 발견사항

- **[WARNING]** 신규 `DB_*`/`HTTP_*` 결과 코드가 중앙 상수 없이 원시 문자열 리터럴로 여러 파일에 흩어져 있다 — 같은
  디렉터리의 기존 관례(`MCP_ERROR_CODES`)와 어긋난다
  - 위치: `codebase/backend/src/modules/integrations/database-connection-tester.ts` (`code: 'DB_HOST_BLOCKED'`,
    `'DB_AUTH_FAILED'`, `'DB_CONNECT_FAILED'` — 함수 `testDatabaseConnection`), `codebase/backend/src/modules/integrations/http-connection-tester.ts`
    (`code: 'HTTP_BLOCKED'`, `'HTTP_AUTH_FAILED'`, `'HTTP_SERVER_ERROR'`, `'HTTP_CONNECT_FAILED'` — 함수 `blocked`·`classify`·`testHttpConnection`)
  - 상세: 같은 모듈 트리의 `modules/mcp/mcp-error-codes.ts` 는 실패 코드 vocabulary 를
    `export const MCP_ERROR_CODES = { ... } as const` 하나로 모아 두고 "Imported by both … so a typo in either place
    is a compile error rather than a silent runtime mismatch" 라고 그 이유까지 문서화해 뒀다. 이번 PR 이 새로 만든 다섯
    개 코드(`DB_AUTH_FAILED`·`DB_CONNECT_FAILED`·`HTTP_AUTH_FAILED`·`HTTP_SERVER_ERROR`·`HTTP_CONNECT_FAILED`)와
    재사용 코드(`DB_HOST_BLOCKED`·`HTTP_BLOCKED`)는 이 패턴을 따르지 않고 프로덕션 코드·`*.spec.ts`·e2e 파일에 각각
    따로 타이핑돼 있다(예: `database-connection-tester.ts` 본체, `database-connection-tester.spec.ts`,
    `integration-connection-test.e2e-spec.ts`, `integrations.service.spec.ts` 모두 `'DB_AUTH_FAILED'`/`'DB_HOST_BLOCKED'`
    문자열을 각자 다시 적는다). 지금은 정합성 검토에서 grep 0건으로 충돌이 없음을 확인했지만, 상수화 없이는 오타가
    나도 타입 체커가 잡아주지 못하고 리터럴이 조용히 갈라진다 — `MCP_ERROR_CODES` 를 만든 바로 그 이유가 여기에도
    똑같이 적용된다.
  - 제안: `DatabaseTestErrorCode`/`HttpTestErrorCode` 같은 `as const` 객체(또는 두 서비스를 아우르는
    `CONNECTION_TEST_ERROR_CODES`)를 만들어 테스터·스펙·e2e 가 그 상수를 참조하게 한다. 이번 PR 필수는 아니나, 다음
    서비스(예: 세 번째 connection tester)가 추가될 때 같은 실수가 반복되기 전에 정리해 두는 편이 싸다.

- **[INFO]** `resolveHttpCredentials` 의 세 `case` 분기가 "필수 필드 없음 → `INTEGRATION_INCOMPLETE`" 보일러플레이트를
  반복한다
  - 위치: `codebase/backend/src/nodes/integration/http-request/http-credentials.ts` 함수 `resolveHttpCredentials`
    (`case 'api_key'`, `case 'bearer_token'`, `case 'basic'` — 각 블록의 `if (!location || !keyName || !value)` /
    `if (!token)` / `if (!username || !password)` 분기)
  - 상세: 세 케이스 모두 "필요한 필드 중 하나라도 없으면 `{ ok:false, code:'INTEGRATION_INCOMPLETE', message: ... }` 를
    반환" 하는 동일한 모양을 반복한다. 필드 이름·개수가 케이스마다 달라 완전한 통합은 어렵지만, 함수 자체가 약
    90줄로 늘어난 원인 중 하나다.
  - 제안: `missingIncomplete(authType: string, missing: string): HttpCredentialsResult` 같은 1줄짜리 헬퍼로
    메시지 조립("HTTP integration (${authType}) is missing ${missing}")만 추출해도 각 케이스가 3~4줄 짧아진다.
    필수 수정 사항은 아니다 — switch 자체의 가독성은 이미 준수한 편이다.

- **[INFO]** `CONNECTION_TEST_MAX_CONCURRENCY` 상수 위 주석이 상수 하나에 비해 매우 밀도 높다(libuv 스레드풀 크기,
  musl `EAI_AGAIN` 실측 5.0초, Database/HTTP 각각의 슬롯 점유 시간 계산까지 한 블록에 담겨 있다)
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` — `export const
    CONNECTION_TEST_MAX_CONCURRENCY = 2;` 바로 위 JSDoc 블록
  - 상세: 코드베이스 전반이 근거를 코드 옆에 촘촘히 남기는 스타일이라 이 자체가 새로운 이탈은 아니지만, 이 블록은
    "왜 2인가"를 넘어 DNS 스레드풀 내부 동작·OS/libc 차이까지 설명해 상수 하나를 훑으려는 독자가 꽤 긴 기술 배경을
    먼저 읽어야 한다.
  - 제안: 필수는 아니나, 핵심 결론("동시 상한은 libuv 스레드풀의 절반") 한두 줄만 남기고 실측 근거(musl EAI_AGAIN
    타이밍 등)는 CHANGELOG/plan 링크로 대체하면 클래스 필드를 훑어보는 속도가 빨라진다.

- **[INFO]** `database-driver-sockets.spec.ts` 가 어떤 구현 파일도 이름으로 짝짓지 않는 "pinning test" 다
  - 위치: `codebase/backend/src/modules/integrations/database-driver-sockets.spec.ts` (파일 전체)
  - 상세: 이 spec 은 `database-connection-tester.ts` 의 `closeWithin` 이 기대는 pg/mysql2 드라이버 내부 구조
    (`connection.stream`)를 실제 드라이버 객체로 고정하는 목적이라고 파일 상단 docstring 에 명확히 설명돼 있다.
    다만 파일명이 `database-connection-tester.*` 계열과 이름 어간을 공유하지 않아, 디렉터리 목록만 봐서는 두 파일의
    관계가 바로 드러나지 않는다.
  - 제안: 필수는 아님 — docstring 이 이미 관계를 설명한다. 여유가 있으면
    `database-connection-tester.driver-assumptions.spec.ts` 류로 이름을 좁혀 관계를 파일명 레벨에서도 드러낼 수 있다.

## 긍정적으로 관측한 점 (참고)

- `clamp-message.ts`(공용 메시지 클램프), `database-connection.ts`(`buildPgConnection`/`buildMysqlSsl` SSL 매핑),
  `http-credentials.ts`(`resolveHttpCredentials`/`appendQueryParams`), `http-redirect.ts`(`followRedirectsSafely`)
  로의 추출은 실질적인 중복 제거다 — 노드 핸들러(`database-query.handler.ts`, `http-request.handler.ts`)와 신규
  connection tester 가 "같은 로직을 두 곳에 유지하다 갈라지는" 위험을 원천적으로 없앴고, 각 모듈이 "왜 의존성이
  없어야 하는지"(순환 import 회피)까지 문서화해 다음 사람이 다시 순환 import 를 만드는 것을 막는다.
- 새 상수(`DB_TEST_TIMEOUT_MS`·`DB_TEST_CLOSE_GRACE_MS`·`HTTP_TEST_TIMEOUT_MS`·`MAX_REDIRECT_HOPS`)는 매직 넘버
  없이 이름 붙여졌고 각각 spec 절 번호를 근거로 남겨, 값의 출처를 추적하기 쉽다.
  `testDatabaseConnection`/`testHttpConnection`/`closeWithin`/`classify`/`describeFailure` 등으로 책임을 잘게
  쪼개 두어 개별 함수의 순환 복잡도가 낮고 중첩도 얕다(2단 이내).
- 테스트(`database-connection-tester.spec.ts`, `http-connection-tester.spec.ts`, `integrations.service.spec.ts`
  신규 블록, `integration-connection-test.e2e-spec.ts`)가 실패 분류(인증 거부 vs 그 밖 실패, SSRF 차단, 닫기 유예
  초과)를 각각 이름 있는 `it`/`it.each` 로 명확히 분리해 놓아 실패 시 원인 추적이 쉽다.

## 요약

전체적으로 함수 길이·중첩 깊이·네이밍 컨벤션은 양호하고, 특히 노드 핸들러와 신규 connection tester 사이의 잠재적
중복을 공용 모듈로 미리 제거해 둔 설계가 유지보수성에 긍정적이다. 유일하게 실질적인 개선 여지는 신규 `DB_*`/`HTTP_*`
결과 코드가 `MCP_ERROR_CODES` 같은 중앙 상수 없이 여러 파일에 원시 문자열로 반복된다는 점(WARNING) — 코드베이스 자신이
이미 세운 관례에서 벗어난 지점이라 다음 서비스 추가 전에 정리할 가치가 있다. 나머지는 스위치문 보일러플레이트,
밀도 높은 주석, 스펙 파일 네이밍 등 사소한 INFO 수준이다.

## 위험도

LOW
