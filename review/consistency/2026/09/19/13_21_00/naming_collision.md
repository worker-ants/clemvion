# 신규 식별자 충돌 검토 — `spec/2-navigation/4-integration.md` (Database·HTTP 연결 테스터)

검토 대상: 같은 브랜치 planner 커밋 `74087dff6`이 `spec/2-navigation/4-integration.md` §5.3·§5.4·§9.2·§9.4·§14.1·Rationale
에 도입한 신규 식별자(그 근거는 `plan/in-progress/spec-draft-integration-connection-tests.md`), 그리고 그 구현 계획
`plan/in-progress/integration-db-http-testers.md` 가 코드 쪽에서 새로 내보내려는 식별자.

## 발견사항

### INFO — 에러 코드 5종은 저장소 전체에서 grep 0건, 충돌 없음 (확인됨)

- target 신규 식별자: `DB_AUTH_FAILED` · `DB_CONNECT_FAILED` · `HTTP_AUTH_FAILED` · `HTTP_CONNECT_FAILED` · `HTTP_SERVER_ERROR`
  (`spec/2-navigation/4-integration.md` §5.3·§5.4·§14.1, `IntegrationTestResult.code` namespace)
- 기존 사용처: 없음. `codebase/backend/src/nodes/core/error-codes.ts` 의 `ErrorCode`(노드 런타임) enum 에는
  `HTTP_TRANSPORT_FAILED` · `HTTP_4XX` · `HTTP_5XX` · `HTTP_TIMEOUT` · `HTTP_BLOCKED` · `DB_QUERY_FAILED` ·
  `DB_CONNECTION_ERROR` · `DB_CONSTRAINT_VIOLATION` · `DB_PERMISSION_DENIED` · `DB_HOST_BLOCKED` 만 있고 다섯 신규 이름과
  겹치지 않는다. `spec/conventions/error-codes.md` 레지스트리에도 미등재(같은 이유로 `EMAIL_CONNECT_FAILED` 등 기존
  `IntegrationTestResult.code` 전용 코드들도 그 레지스트리엔 없다 — 선례와 일치, 새 결함 아님).
- 상세: target 문서(§14.1 F 항목, Rationale)가 "저장소 전체에서 다섯 이름 모두 grep 0건이다(충돌 없음)" 라고 스스로
  주장한 것을 `grep -rn` 으로 `spec/` `codebase/` `plan/` 전체에 대해 재확인 — target 파일·근거 draft 자신을 제외하면
  실제로 0건이었다.
- 제안: 조치 불요. (검증 완료 기록으로 남김.)

### INFO — `HTTP_{status}` 표기는 실제 코드의 리터럴 `HTTP_4XX`/`HTTP_5XX` 와 문자 그대로는 다르다 (기존 표 항목, target 이 새로 만든 문제 아님)

- target 신규 식별자: `HTTP_AUTH_FAILED`·`HTTP_SERVER_ERROR` 행이 대비 대상으로 인용하는 "노드는 `HTTP_{status}`"
  (`spec/2-navigation/4-integration.md:1120,1121`)
- 기존 사용처: `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts:519`
  — 실제로는 `res.status >= 500 ? 'HTTP_5XX' : 'HTTP_4XX'` 로, `HTTP_{status}`(예: `HTTP_404`) 형태의 상태코드별
  코드가 아니라 4xx/5xx 두 값 중 하나의 **고정 리터럴**이다. `HTTP_{status}` 행 자체(§14.1, 1119행 근방)는 이번
  target 편집 대상이 아닌 기존 행이라 이 문서가 새로 만든 부정확함은 아니다.
- 상세: 이번 diff 가 추가한 두 행이 그 기존 표기를 "노드는 같은 응답을 `HTTP_{status}` 로 낸다" / "노드는 `HTTP_{status}`"
  라고 재인용하면서, 독자가 `HTTP_AUTH_FAILED`(401/403 전용) 를 실제로 존재하지 않는 `HTTP_401`/`HTTP_403` 같은
  코드와 대응한다고 오해할 여지가 생긴다. 신규 식별자 자체(`HTTP_AUTH_FAILED` 등)는 충돌이 없으나, 그 설명이 참조하는
  기존 표기가 실제 코드와 문자 그대로 일치하지 않는다.
- 제안: 이번 PR 범위는 아니지만(§14.1 F 항목이 손대는 것은 다섯 신규 행 + `DB_HOST_BLOCKED`/`HTTP_BLOCKED` 두 행뿐),
  후속으로 `HTTP_{status}` 행을 `HTTP_4XX`/`HTTP_5XX`(실제 리터럴)로 정정하면 새 두 행의 대비 설명도 함께 정확해진다.
  이번 target 범위에서 반드시 고칠 필요는 없음 — INFO 로만 기록.

### INFO — 새 테스터 파일 두 개의 실제 경로/이름이 아직 미확정

- target 신규 식별자: `plan/in-progress/integration-db-http-testers.md` §설계 — "테스터 본체는 `modules/integrations/`
  아래 새 파일 둘(순수 async 함수, `IntegrationTestResult` 반환)"
- 기존 사용처: 해당 없음 — `find codebase/backend/src -iname '*-tester*.ts'` 전수 검색 0건. 기존 `mcp`/`email`
  테스터(`testMcpTransport`/`testEmailTransport`)는 별도 파일이 아니라 `IntegrationsService` 의 바운드 메서드로
  존재해, 새 설계(모듈 함수 + 별도 파일)와 배치 방식이 다르다.
- 상세: 파일명이 정해지지 않아 충돌 여부를 지금 판정할 수 없다. 기존 `modules/integrations/` 디렉토리에는
  `cafe24-install-nonce-cache.service.ts` 류의 `<domain>-<role>.service.ts` 네이밍과 `integrations.constants.ts` ·
  `integration-status-reason.ts` 같은 서비스가 아닌 순수 모듈 파일이 혼재한다 — 어느 쪽 컨벤션을 따를지 developer 턴
  에서 결정해야 하며, 결정된 이름이 기존 파일(`integration-oauth.service.ts` 등)과 겹치지 않는지는 이름이 나온
  다음에 재확인이 필요하다.
- 제안: 구현 착수 시 (예) `database-connection-tester.ts` / `http-connection-tester.ts` 처럼 "connection-tester" 접미
  로 새 네이밍 계열을 명시적으로 열어 기존 어떤 파일과도 접두사가 겹치지 않게 하고, plan 에 파일명을 확정해 적어
  둘 것을 권한다. 이 접미 계열이 새로 생기는 것 자체는 문제 없음(선례 검색 0건).

### INFO — 신규 요구사항 ID·엔드포인트·이벤트명·환경변수는 도입되지 않음 (확인됨)

- target 문서는 새 `service_type`(`database`·`http`)이나 새 API endpoint, 새 SSE/webhook 이벤트명, 새 ENV var 를
  도입하지 않는다. `ALLOW_PRIVATE_HOST_TARGETS` 는 HTTP Request/Database Query 노드가 이미 쓰던 기존 플래그를
  재사용한다고 명시적으로 밝히고 있고(§5.3·§5.4·Rationale), grep 상으로도 새 env var 이름은 등장하지 않는다.
  `:id/test` · `preview-test` 엔드포인트도 기존 엔드포인트이며 새 path 를 추가하지 않는다. ND-*/PR-* 류의 요구사항
  ID 도 이 diff 범위에는 없다.
- 제안: 조치 불요.

## 요약

target 이 새로 붙이는 다섯 에러 코드(`DB_AUTH_FAILED`·`DB_CONNECT_FAILED`·`HTTP_AUTH_FAILED`·`HTTP_CONNECT_FAILED`·
`HTTP_SERVER_ERROR`)는 노드 런타임 `ErrorCode` enum·`spec/conventions/error-codes.md` 레지스트리·저장소 전체 어디와도
철자가 겹치지 않음을 재확인했다(target 의 자체 grep 주장과 일치). 새로 내보내려는 모듈 함수(`buildPgConnection`·
`buildMysqlSsl`·`buildHttpCredentials`)도 각각 원 파일에만 존재하는 단일 정의라 이름 충돌이 없다. 새 requirement ID·
API endpoint·이벤트명·ENV var 도입은 없다. 유일하게 남는 것은 (1) 새 두 테스터 파일의 실제 이름이 plan 단계에서
아직 정해지지 않았다는 점(이름이 나오기 전이라 판정 보류, 선례 없음 자체는 확인)과 (2) 이번 diff 가 재인용하는
기존 `HTTP_{status}` 표기가 실제 코드 리터럴(`HTTP_4XX`/`HTTP_5XX`)과 문자 그대로 다르다는, target 이 만들지 않은
기존 표의 사소한 부정확함뿐이다. 둘 다 CRITICAL/WARNING 수준의 충돌은 아니다.

## 위험도

NONE
