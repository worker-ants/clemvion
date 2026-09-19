# 신규 식별자 충돌 검토 — `spec/2-navigation/4-integration.md` (연결 테스트 Database·HTTP)

## 검토 범위

- spec 델타: `spec/2-navigation/4-integration.md` §3.3 · §5.1~§5.4 · §5.7 · §6 · §9.2 · §9.4 · §10.3 · §10.5 · §14.1 · `## Rationale`
- 구현 diff: 24개 파일(신규 6개 + 수정 다수), `git diff origin/main...HEAD` 로 직접 확인
- 확인 방법: 절대경로 `git`/`grep`/`Read` 로 워킹트리(`integration-testers-5c2d91`) 를 직접 조회 — 저장소 전체(spec/codebase/plan) grep 으로 신규 식별자별 기존 사용처 유무를 실측

## 발견사항

### 1. 신규 `IntegrationTestResult.code` 값 다섯 개 — grep 0건, 충돌 없음 확인

target 이 새로 추가하는 코드: `DB_AUTH_FAILED` · `DB_CONNECT_FAILED` · `HTTP_AUTH_FAILED` · `HTTP_SERVER_ERROR` · `HTTP_CONNECT_FAILED`.

저장소 전체(spec/codebase/plan)를 grep 한 결과 다섯 이름 모두 이번 PR 이전에는 존재하지 않았고, 등장하는 모든 자리가 이번 diff 의 spec 본문(`4-integration.md` §5.3·§5.4·§14.1) · 구현(`database-connection-tester.ts` · `http-connection-tester.ts` · 각 `*.spec.ts`) · plan(`spec-draft-integration-connection-tests.md` · `integration-db-http-testers.md`) 뿐이다. spec draft 자신이 적은 "저장소 전체에서 다섯 이름 모두 grep 0건이다(충돌 없음)" 주장이 실측과 일치한다. 충돌 없음.

### 2. [WARNING] `IntegrationTestResult.code` 신규 값이 노드 런타임 `ErrorCode` 와 이름이 근접 — `code` 필드가 `string`(비literal)이라 타입 경계가 없음

- target 신규 식별자: `DB_CONNECT_FAILED`(연결 테스트 전용), `HTTP_CONNECT_FAILED`(연결 테스트 전용), `HTTP_SERVER_ERROR`(연결 테스트 전용)
- 기존 사용처: `codebase/backend/src/nodes/core/error-codes.ts:32` `DB_CONNECTION_ERROR`, `:16` `HTTP_TRANSPORT_FAILED`(노드 런타임 `ErrorCode` enum, `output.error.code` envelope). `HTTP_{status}` 는 노드가 2xx 아닌 응답에 쓰는 동적 코드(§14.1 기존 행).
- 상세: 두 namespace(`IntegrationTestResult.code` vs 노드 `ErrorCode`)는 spec 이 명시적으로 분리해 §5.3·§5.4·§14.1·Rationale 네 곳에서 "모집합이 다르다"를 반복 설명한다 — 설계 의도는 명확하다. 다만 코드 레벨에서 `IntegrationTestResult.code?: string`(`integrations.service.ts:80`)이 순수 `string` 이라 두 namespace 값을 섞어 비교해도 컴파일러가 잡아주지 않는다. `DB_CONNECT_FAILED`(연결 테스트, 인증 실패 제외) ↔ `DB_CONNECTION_ERROR`(노드, 인증 실패 포함) 처럼 **이름이 비슷한데 원소 집합이 다른** 값이 문자열 비교 코드에서 뒤섞이면 조용히 틀린 분기를 탄다. 이 패턴 자체는 `EMAIL_CONNECT_FAILED`/`EMAIL_HOST_BLOCKED` 선례로 이미 존재했고 이번 PR 은 그 패턴을 다섯 개 더 확장한 것뿐이라 **신규 리스크는 아니지만 표면이 넓어졌다**.
- 제안: spec 차원의 조치는 이미 충분(문서화·대비 문장). 코드 차원에서 `IntegrationTestResult.code` 를 두 namespace 의 literal union 타입(혹은 최소 해당 다섯 개 + 기존 값들의 literal union)으로 좁히면, 이후 다른 개발자가 두 namespace 를 혼동해 비교 코드를 작성해도 컴파일 타임에 잡힌다. spec 변경은 불필요 — 코드 타입 강화만으로 충분하며, 이번 PR 스코프 밖의 후속 harden 항목으로 남겨도 무방.

### 3. 신규 파일 경로 — 기존 파일과 겹치지 않음, 명명 컨벤션 일치

신규 파일: `modules/integrations/{clamp-message,database-connection-tester,http-connection-tester}.ts`, `nodes/integration/database-query/database-connection.ts`, `nodes/integration/http-request/{http-credentials,http-redirect,http-safety}.ts`, `test/integration-connection-test.e2e-spec.ts`. `find codebase -name <각 파일명>` 결과 전부 단일 경로에만 존재 — 기존 파일과의 경로/이름 충돌 없음. 디렉터리 배치(서비스별 tester 는 `modules/integrations/`, 노드-공유 로직은 해당 노드 디렉터리)도 기존 컨벤션(`nodes/integration/cafe24/cafe24-api.client.ts` 등)과 일관.

### 4. 신규 export 식별자(함수·상수) — 전부 단일 정의처에서만 등장, 교차 오염 없음

`DbCredentials` · `buildPgConnection` · `buildMysqlSsl` · `DB_HOST_BLOCKED_MESSAGE` · `resolveHttpCredentials` · `buildHttpCredentials` · `SSRF_BLOCKED_CLIENT_MESSAGE` · `clampMessage` · `CONNECTION_TEST_MAX_CONCURRENCY` 를 각각 grep 한 결과, 모두 plan(`integration-db-http-testers.md`)이 설계한 대로 하나의 SoT 파일에서 export 되고 소비처(노드 핸들러·테스터·서비스)에서만 import 되는 형태다. 기존 코드 어디에도 같은 이름이 다른 의미로 이미 쓰이고 있지 않다. `CONNECTION_TEST_MAX_CONCURRENCY` 는 하드코딩 상수(`= 2`)이지 `process.env` 로 읽는 환경변수가 아니므로 §5 관점(환경변수·설정키 충돌)의 대상도 아니고 이름 충돌도 없다.

### 5. API endpoint — 신규 endpoint 없음

이번 diff 는 기존 `POST /api/integrations/preview-test` · `POST /api/integrations/:id/test` · `POST /api/integrations/:id/rotate` 세 경로의 **동작**만 바꾼다. method+path 신규 추가는 없어 endpoint 충돌 관점은 해당 없음.

### 6. 이벤트/메시지명, 요구사항 ID — 신규 도입 없음

diff 에 webhook·queue·SSE 이벤트명 신규 추가가 없다(§5.7 Webhook 섹션은 테스트 범위 문구만 정정, inbound URL 관리 구조는 불변). `PRD INT-WH-02` 같은 요구사항 ID 참조도 diff 의 unchanged 컨텍스트 라인에만 있고 새 ID 부여는 없다.

### 7. [INFO] `INTEGRATION_TEST_FAILED` 상태 코드(400 vs 422) 불일치 — 이번 PR 신규 아님, 이미 트래커行

`spec/2-navigation/4-integration.md:865` 는 422, `spec/5-system/11-mcp-client.md:539` 는 400 으로 같은 코드의 HTTP 상태를 다르게 적는다. 이름 자체의 충돌(같은 코드, 다른 의미)은 아니고 **같은 코드의 계약 값 불일치**이며, `plan/in-progress/integration-db-http-testers.md` 체크리스트가 이미 "코드는 400 · spec §9.4 는 422 — 트래커에서 정한다"로 명시하고 있어 이번 리뷰가 새로 지적할 항목은 아니다. 신규 식별자 충돌 관점에서는 조치 불요.

## 요약

target 이 새로 도입하는 식별자 — `IntegrationTestResult.code` 신규 값 다섯 개(`DB_AUTH_FAILED` · `DB_CONNECT_FAILED` · `HTTP_AUTH_FAILED` · `HTTP_SERVER_ERROR` · `HTTP_CONNECT_FAILED`), 신규 파일 8개(`clamp-message.ts` · `database-connection-tester.ts` · `http-connection-tester.ts` · `database-connection.ts` · `http-credentials.ts` · `http-redirect.ts` · `http-safety.ts` · e2e spec), 신규 export(`DbCredentials` · `buildPgConnection` · `buildMysqlSsl` · `DB_HOST_BLOCKED_MESSAGE` · `resolveHttpCredentials` · `buildHttpCredentials` · `SSRF_BLOCKED_CLIENT_MESSAGE` · `clampMessage` · `CONNECTION_TEST_MAX_CONCURRENCY`) — 전부 저장소 전체 grep 으로 기존 사용처와의 충돌이 없음을 확인했다. 신규 endpoint·이벤트명·요구사항 ID·환경변수 도입도 없다. 유일한 주의점은 신규 코드 다섯 개가 노드 런타임 `ErrorCode`(`DB_CONNECTION_ERROR` · `HTTP_TRANSPORT_FAILED` · `HTTP_{status}`)와 이름이 근접하면서 `IntegrationTestResult.code` 가 비literal `string` 이라 타입 경계가 없다는 것인데, 이는 기존 `EMAIL_CONNECT_FAILED` 선례의 확장이고 spec 이 이미 문서로 충분히 대비했다 — CRITICAL 은 아니며 코드 타입 강화(literal union)를 후속 harden 으로 제안하는 WARNING 수준이다.

## 위험도

LOW
