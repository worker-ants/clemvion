# Cross-Spec 일관성 검토 — 연결 테스트 결과 코드 (`connection-test-codes.ts`)

## 검토 범위 및 방법

- 검토 모드: `--impl-done`, scope=`spec/2-navigation/`, diff-base=`origin/main`
- scope(`spec/2-navigation/`) 파일 델타: 0개 — 이 브랜치는 spec 을 바꾸지 않았다. 구현 diff 11개 파일/541줄만 존재.
- 프롬프트 번들의 spec 본문은 예산 초과로 대부분 절단되어 있어, 판정에 필요한 아래 spec 절은 워크트리(`/Volumes/project/private/clemvion/.claude/worktrees/tester-codes-4b9e17`)에서 직접 `Read`/`grep` 로 재확인했다:
  - `spec/2-navigation/4-integration.md` §5.3(HTTP) · §5.4(Database) · §5.5(Email) · §5.8(Cafe24) · §5.9(MakeShop) · §9.1(CRUD/test endpoint) · §14.1(에러 코드 vocabulary)
  - `spec/5-system/11-mcp-client.md` §8.2(에러 코드 vocabulary)
  - `spec/5-system/3-error-handling.md`(공통 `RESOURCE_NOT_FOUND`)
  - `spec/4-nodes/4-integration/1-http-request.md`(`INTEGRATION_AUTH_UNSUPPORTED` 등 공통 에러 코드)
  - `spec/4-nodes/4-integration/2-database-query.md`(SSL 매핑 표)
  - `spec/4-nodes/4-integration/5-makeshop.md`(§9.5 insufficient_scope 미구현 disclaimer)
  - `spec/data-flow/1-audit.md`(`integration.rotated` 이벤트)
  - 코드 측 대조: `codebase/backend/src/nodes/core/error-codes.ts`, `.../modules/mcp/mcp-test-connection.service.ts`, `.../nodes/integration/http-request/http-credentials.ts`, `.../nodes/integration/makeshop/makeshop-api.client.ts`

## 진단 요약

이 PR 은 연결 테스트(transport tester) 실패 코드의 **wire 값을 하나도 바꾸지 않고**, 흩어져 있던 문자열 리터럴을 `CONNECTION_TEST_CODES` 상수 + `IntegrationTestResultCode` union 으로 타입화하는 순수 리팩터다. 타입 도입 과정에서 각 union 멤버(9개 transport 코드, 2개 게이트 코드, `McpFailureCode` 5종, `HttpCredentialsResult` 실패 코드 2종, `Cafe24PingCode` 4종, `MakeshopPingCode` 3종)를 실제 워크트리 spec 문서 및 인접 spec 영역(§14.1 vocabulary 표, §8.2 MCP vocabulary, HTTP 노드 공통 에러 코드)과 하나씩 대조했다. 값·의미·"노드 런타임과 다른 namespace" 구분(예: `DB_CONNECT_FAILED` vs `DB_CONNECTION_ERROR`, `HTTP_CONNECT_FAILED` vs `HTTP_TRANSPORT_FAILED`, 호스트 차단 셋 `HTTP_BLOCKED`/`DB_HOST_BLOCKED`/`EMAIL_HOST_BLOCKED` 는 노드와 공유)가 spec 서술과 정확히 일치했다. 새 SSL 매핑 테스트(`require`/`verify-full`→`rejectUnauthorized:true`, `disable`→`undefined`)도 `2-database-query.md` 의 mysql2 열과 그대로 일치한다. `rotate` 404 레이스 테스트("update 뒤 재조회에서 사라지면 404, 감사·broadcast 없음")는 공통 `RESOURCE_NOT_FOUND` 규약 및 "`integration.rotated` 는 성공 시에만 기록" 이라는 audit 규약과 모순되지 않는다. 신규 요구사항 ID·RBAC 변경·상태 머신 변경·계층 경계 변경은 diff 어디에도 없다(기존 `nodes/integration/...` → `modules/integrations/...` import 방향도 이미 있던 패턴을 그대로 사용).

## 발견사항

- **[INFO]** MakeShop pingConnection 의 403 처리 문구가 §5.8 을 "정책 동일" 로 참조하지만, `MakeshopPingCode` 에는 Cafe24 의 `CAFE24_INSUFFICIENT_SCOPE` 에 대응하는 코드가 없다
  - target 위치: (코드) `codebase/backend/src/nodes/integration/makeshop/makeshop-api.client.ts` 의 `MakeshopPingCode`(`MAKESHOP_AUTH_FAILED` | `MAKESHOP_TRANSPORT_FAILED` | `INTEGRATION_INCOMPLETE`) 및 신규 테스트 `pingConnection (test-connection probe)` › "403 — MAKESHOP_AUTH_FAILED, 갱신 없이 · 상태 격하 없이"
  - 충돌 대상: `spec/2-navigation/4-integration.md` §5.9 "401 자동 회복·403 처리·transport 카운터 제외는 §5.8 정책 동일" (§5.8 은 "403 처리: status 격하하지 않고 `CAFE24_INSUFFICIENT_SCOPE` 메시지만 전달"이라고 명시)
  - 상세: 문구만 보면 MakeShop 의 403 도 Cafe24 처럼 상태 격하 없이 scope-부족 전용 코드/메시지를 내야 하는 것처럼 읽히지만, 실제 구현(및 `spec/4-nodes/4-integration/5-makeshop.md` §9.5 의 "insufficient_scope 세분 전이는 cafe24 한정(INT-AU-07)이며 makeshop 은 미구현" disclaimer)은 401/403 을 모두 `MAKESHOP_AUTH_FAILED` 로 뭉뚱그린다. 다만 **이 간극은 본 PR 이 만든 것이 아니다** — `mapPingError`/`MakeshopAuthFailedError` 는 diff 이전부터 존재했고, 이번 변경은 그 기존 동작에 타입 이름(`MakeshopPingCode`)과 리그레션 테스트를 씌운 것뿐이다. 이미 `5-makeshop.md` 자신이 미구현임을 밝히고 있어 "발견되지 않은 신규 모순"은 아니다.
  - 제안: 차단 사유 아님. 다음에 §5.9 를 만질 기회가 있으면 "§5.8 정책 동일"의 범위를 "401 재시도·counter 제외" 로만 좁히거나, `CAFE24_INSUFFICIENT_SCOPE` 대응 문구를 makeshop 쪽에 별도로 명시해 표현 일치시킬 것(project-planner 소관, 이번 PR 스코프 아님).

## 요약

이번 변경은 연결 테스트 실패 코드의 값을 바꾸지 않는 타입 안전화 리팩터이며, 도입한 union 의 모든 멤버(9개 transport 코드·2개 게이트 코드·MCP 5종·HTTP 자격증명 2종·Cafe24 4종·MakeShop 3종)를 `spec/2-navigation/4-integration.md`(§5.3~§5.5·§5.8·§5.9·§9.1·§14.1)와 `spec/5-system/11-mcp-client.md` §8.2, `spec/4-nodes/4-integration/1-http-request.md`·`2-database-query.md` 대조 결과 전부 일치를 확인했다. 유일한 특이사항은 MakeShop 의 403 처리에 대한 §5.9 서술과 실제(및 5-makeshop.md 가 이미 자인한) 동작 사이의 사전 존재하던 표현 간극으로, 이 PR 이 유발하거나 악화시키지 않았으므로 INFO 로만 기록한다. Cross-spec 관점에서 이 diff 를 그대로 채택해도 다른 spec 영역과의 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 충돌은 없다.

## 위험도

NONE
