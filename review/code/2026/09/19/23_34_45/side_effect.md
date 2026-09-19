# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `IntegrationTestResult.code` 필드 타입이 `string` → `IntegrationTestResultCode`(닫힌 union)로 좁혀짐 — 시그니처/인터페이스 변경이나 호환성 문제 없음 확인
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` (인터페이스 `IntegrationTestResult`, diff 라인 80-84)
  - 상세: 타입 좁히기는 **컴파일 타임 전용**이며 문자열 값 자체(와이어 값)는 바뀌지 않는다. 외부에 노출되는 DTO(`TestConnectionResultDto.code`, `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts:484`)는 여전히 `code?: string`으로 넓게 선언돼 있어 좁은 타입 → 넓은 타입 대입이라 컴파일도 막히지 않는다. `Cafe24ApiClient.pingConnection`(`codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.ts:378`)·`MakeshopApiClient.pingConnection`(`codebase/backend/src/nodes/integration/makeshop/makeshop-api.client.ts:310`)의 반환 타입도 `code?: string` → `code?: Cafe24PingCode`/`MakeshopPingCode`로 좁혀졌는데, 실제 호출자(`makeshop.module.ts:87`, `cafe24.module.ts:104`)를 전수 확인한 결과 `result.code`를 그대로 전달만 하고 있어 컴파일 영향 없음.
  - 제안: 조치 불필요 — 순수 타입 강화이며 plan 체크리스트의 TEST WORKFLOW(build 포함)가 이미 통과했다고 기록돼 있음.

- **[INFO]** 리터럴 문자열 → `CONNECTION_TEST_CODES.*` 상수 참조로 치환된 5개 생산자 지점의 와이어 값 불변 확인
  - 위치: `codebase/backend/src/modules/integrations/database-connection-tester.ts` (diff 라인 144, 161-163), `codebase/backend/src/modules/integrations/http-connection-tester.ts` (diff 라인 27, 45, 52, 106, 140, 146), `codebase/backend/src/modules/integrations/integrations.service.ts` (diff 라인 1603, 1630)
  - 상세: `CONNECTION_TEST_CODES` 정의(`codebase/backend/src/modules/integrations/connection-test-codes.ts:16-26`)의 각 값이 치환 전 리터럴과 정확히 일치함을 문자열 단위로 대조했다(`DB_HOST_BLOCKED`·`DB_AUTH_FAILED`·`DB_CONNECT_FAILED`·`HTTP_BLOCKED`·`HTTP_AUTH_FAILED`·`HTTP_SERVER_ERROR`·`HTTP_CONNECT_FAILED`·`EMAIL_HOST_BLOCKED`·`EMAIL_CONNECT_FAILED`). 클라이언트(프런트엔드)나 다른 서비스가 이 문자열을 스위치/비교하는 코드가 있다면 영향 없음.
  - 제안: 조치 불필요.

- **[INFO]** `database-driver-sockets.spec.ts`는 unit 테스트 계층에서 실제 TCP 소켓(루프백 포트 9)을 여는 기존 부작용을 그대로 유지 — 이번 diff는 그 정리 로직만 강화
  - 위치: `codebase/backend/src/modules/integrations/database-driver-sockets.spec.ts` (diff 라인 29-44, 함수: `mysql2 promise Connection 은 connection.stream 에 소켓을 둔다` it 블록)
  - 상세: `mysqlCoreConnection({ host: '127.0.0.1', port: 9, ... })` 호출은 diff 이전부터 존재하던 실제 네트워크 side effect이며(주석에도 "**unit 계층에서 예외적으로 실제 소켓을 연다**"로 명시) 이번 변경은 그 자체를 새로 도입한 것이 아니라 `expect` 실패 시에도 `finally`에서 소켓을 반드시 `destroy()`하도록 감싼 것(누수 방지 개선)이다. 순수 loopback 이라 외부 네트워크 호출은 아니지만, loopback 소켓조차 차단된 샌드박스/CI 환경에서는 이 테스트가 hang/에러를 낼 수 있다는 점은 이번 diff 로 인한 신규 리스크가 아니라 기존 리스크의 지속임을 확인.
  - 제안: 조치 불필요(신규 도입 아님). 참고로만 기록.

- **[INFO]** `integrations.service.spec.ts`의 신규 rotate 404 테스트가 `integrationRepo.findOne.mockReset()`을 테스트 중간에 호출하지만 테스트 격리는 유지됨
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.spec.ts` (diff 라인 1312-1331, it 블록: `update 는 1행을 바꿨는데 다시 읽기 전에 지워졌으면 404 — 감사 · broadcast 를 남기지 않는다`)
  - 상세: 최상위 `beforeEach`(파일 105-134번째 줄 부근)가 매 테스트마다 `integrationRepo` 객체 전체(및 각 `jest.fn()`)를 새로 만들기 때문에, 이 테스트 안에서의 `mockReset()`은 다음 테스트로 전파되지 않는다. 실제로 직후 테스트(`broadcasts cache invalidation after a successful rotation`)가 정상 동작함을 코드로 확인. 또한 `service.rotate(...)`가 내부적으로 호출하는 `dispatchTest`(→ `testHttpConnection`)는 파일 상단에서 `jest.mock('./http-connection-tester', ...)`으로 이미 모킹돼 있어(파일 44-48번째 줄) 실제 네트워크 호출은 발생하지 않는다.
  - 제안: 조치 불필요 — 격리 확인됨.

- **[INFO]** `connection-test-codes.ts`(신규 모듈)는 순수 타입/상수 정의만 export — 전역 상태·부작용 없음
  - 위치: `codebase/backend/src/modules/integrations/connection-test-codes.ts` (전체)
  - 상세: 파일 내 부작용을 일으킬 수 있는 import(파일시스템·네트워크·환경변수)는 없으며 전부 `import type`이다(순환 참조 방지 의도와 일치). `as const` 객체 하나와 타입 alias 셋만 export.
  - 제안: 조치 불필요.

- **[INFO]** `plan/`·`review/consistency/` 하위 신규 파일들(`plan/in-progress/connection-test-codes-and-gaps.md`, `review/consistency/2026/09/19/23_02_33/**`)은 프로젝트 컨벤션(`--impl-prep` 산출물 보존)에 따른 의도된 파일시스템 생성이며 애플리케이션 코드 경로 밖
  - 위치: `plan/in-progress/connection-test-codes-and-gaps.md`, `review/consistency/2026/09/19/23_02_33/*`
  - 상세: 코드 실행 중 발생하는 부작용이 아니라 harness/plan 워크플로가 남긴 감사 산출물이며 CLAUDE.md 의 저장 위치 규약과 일치한다.
  - 제안: 조치 불필요.

## 요약

이번 변경은 연결 테스트 결과 코드를 문자열 리터럴 산재 상태에서 `as const` 상수 + literal union 타입으로 통합하는 순수 리팩터로, 검증 결과 런타임 동작·와이어 값·공개 DTO 계약이 전혀 바뀌지 않았다(치환된 모든 리터럴 값을 상수 정의와 1:1 대조 완료, `pingConnection` 반환 타입 좁히기의 실제 호출자 2곳을 전수 확인). 새로 추가된 전역 변수·환경 변수 읽기/쓰기·의도치 않은 네트워크 호출·이벤트/콜백 변경은 발견되지 않았다. 유일하게 주목할 부분은 `database-driver-sockets.spec.ts`가 unit 테스트에서 실제 loopback 소켓을 여는 것인데, 이는 이번 diff 이전부터 존재한 의도된 예외이며 오히려 이번 변경이 `try/finally`로 정리를 강화해 리스크를 줄였다. rotate 404 테스트의 mid-test `mockReset()`도 테스트별 mock 재생성 구조 덕에 격리가 유지됨을 코드로 확인했다.

## 위험도
NONE
