# 부작용(Side Effect) 리뷰 — Database · HTTP 연결 테스터

## 발견사항

- **[INFO]** 기존 공개 엔드포인트 3곳(`preview-test` · `:id/test` · `rotate`)이 `database`/`http` 서비스에 한해 이제 실제 아웃바운드 네트워크 호출(DB 접속·`SELECT 1`, HTTP `fetch`, DNS 해석)을 수행한다 — 종전엔 구조 검증만으로 즉시 `{success:true}` 였다.
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:404-411` (`transportTesters` 맵에 `database`·`http` 등록), `codebase/backend/src/modules/integrations/integrations.controller.ts:158` (`preview-test` — throttle 은 기존 `20/60s` 그대로 유지)
  - 상세: `dispatchTest` 가 세 경로(신규 통합 사전검증 · 저장된 통합 수동 테스트 · 자격증명 회전)에서 공유되므로, 기존에 저장돼 있던 database/http 통합에 대해 사용자가 "연결 테스트" 버튼을 누르거나 자격증명을 회전할 때 갑자기 최대 10초(`DB_TEST_TIMEOUT_MS`/`HTTP_TEST_TIMEOUT_MS`, `database-connection-tester.ts:18` · `http-connection-tester.ts:15`)의 지연과 새 실패 코드(`DB_HOST_BLOCKED`·`DB_AUTH_FAILED`·`DB_CONNECT_FAILED`·`HTTP_BLOCKED`·`HTTP_AUTH_FAILED`·`HTTP_SERVER_ERROR`·`HTTP_CONNECT_FAILED`)를 만날 수 있다. `IntegrationsService.testConnection`/`previewTest` 자체는 DB 를 쓰지 않으므로(엔티티 상태 미변경) 부작용은 응답 지연·신규 실패 코드에 국한되고, 이는 이 PR 의 명시적 목적(spec §5.3·§5.4)과 일치한다 — 결함이 아니라 "기존 API 소비자가 알아야 할 동작 변화"로 분류.
  - 제안: 이미 `codebase/frontend/.../integration-management*.mdx` 가이드에 반영됨(파일 17·18). 프런트엔드가 이 endpoint 를 짧은 클라이언트 타임아웃으로 부르는 곳이 없는지는 확인했고(grep 0건) 문제없다 — 추가 조치 불요, 기록 목적의 INFO.

- **[INFO]** 같은 20회/분 throttle 로 이제 4개 서비스(`mcp`·`email`·`database`·`http`)가 최대 10초 블로킹 네트워크 호출을 수행한다.
  - 위치: `codebase/backend/src/modules/integrations/integrations.controller.ts:158` (`@Throttle({ default: { limit: 20, ttl: 60_000 } })`), `codebase/backend/src/modules/integrations/database-connection-tester.ts:18`, `codebase/backend/src/modules/integrations/http-connection-tester.ts:15`
  - 상세: `mcp`(`mcp-test-connection.service.ts` `LIST_TIMEOUT_MS` 10초)·`email`(`SMTP_TEST_TIMEOUT_MS` 10초, `integrations.service.ts:110`)가 이미 같은 패턴(20/분 하에서 최대 10초 블로킹)을 갖고 있었으므로, 이번 변경은 새 리스크 등급을 도입하는 것이 아니라 기존 선례를 2개 서비스로 확장하는 것이다. 다만 누적 동시 연결 수(사용자당 최대 20개 동시 DB/HTTP 소켓)가 늘어났다는 점은 참고용으로 남긴다.
  - 제안: 조치 불요 — 선례와 일관되므로 기록만.

- **[INFO]** `PreviewTestResultDto.code?: string` 신규 선언이 동시 진행 중인 다른 in-progress plan 이 건드리는 같은 DTO 와 겹친다.
  - 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts:253-258`
  - 상세: `plan/in-progress/spec-draft-nullable-notation-followups.md` 가 같은 `PreviewTestResultDto`/`TestConnectionResultDto` 의 MCP 전용 필드 미선언 문제를 다루는 중이다(consistency check `review/consistency/2026/09/19/13_03_41/SUMMARY.md` WARNING #4 로 이미 식별·추적됨). 필드 추가 자체는 optional 이라 하위호환이며 깨지는 부분은 없으나, 두 plan 이 같은 파일을 순차로 건드리면 리뷰/머지 순서에 따라 diff 충돌이 날 수 있다.
  - 제안: 이미 `plan/in-progress/integration-db-http-testers.md` 체크리스트에 교차참조가 계획돼 있으므로 별도 조치 불요 — 중복 flag 방지 차원의 기록.

## 검증한 항목 (부작용 없음 확인)

- **리팩터로 이동한 공유 심볼**(`clampMessage`→`clamp-message.ts`, `DbCredentials`/`buildPgConnection`/`buildMysqlSsl`/`DB_HOST_BLOCKED_MESSAGE`→`database-connection.ts`, `resolveHttpCredentials`→`http-credentials.ts`, `SSRF_BLOCKED_CLIENT_MESSAGE`→`http-safety.ts`)에 대해 `grep -rn` 으로 전체 `src/` 를 훑어 옛 위치를 참조하는 dangling import 가 없음을 확인했다. `database-query.handler.ts`·`http-request.handler.ts` 는 새 모듈에서 정확히 재import 한다.
- `buildHttpCredentials`(핸들러)의 리팩터 — 기존엔 스위치문 안에서 직접 `throw new IntegrationError(...)`, 지금은 `resolveHttpCredentials` 가 `{ok:false, code, message}` 를 값으로 반환하고 얇은 래퍼가 같은 code/message 로 `throw` — 외부에서 관측되는 동작(에러 코드·메시지)은 동일함을 확인.
- **DB 연결 정리**: `probePostgres`/`probeMysql` 모두 `try/finally` 로 성공·실패 무관하게 `client.end().catch(() => {})` 를 호출해 연결이 남지 않는다 — unit spec(`database-connection-tester.spec.ts`)의 "닫기가 실패해도 결과를 바꾸지 않는다" 케이스로도 뮤테이션 검증됨(plan 기록 10/10 RED).
- **테스트 격리**: `http-connection-tester.spec.ts` 는 `jest.spyOn(globalThis, 'fetch')` 를 `afterEach` 에서 `mockRestore()`, `beforeEach` 에서 `jest.clearAllMocks()` — 전역 `fetch` 몽키패치가 다른 테스트 파일로 새지 않는다. `integrations.service.spec.ts` 는 `./database-connection-tester`·`./http-connection-tester` 를 모듈 레벨로 `jest.mock` 해 실제 DB 접속·`fetch` 를 피하고, `beforeEach` 에서 `mockClear()` 한다.
- **`integration-cache-invalidate.e2e-spec.ts` 회귀 방지**: rotate 가 이제 실제 HTTP 호출을 하게 되므로, 이 broadcast 전용 e2e 의 fixture 에서 `base_url` 을 의도적으로 제거해 외부 네트워크 의존을 없앴다(주석으로 근거 명시) — 부작용을 인지하고 올바르게 격리한 사례.
- **env var**: `ALLOW_PRIVATE_HOST_TARGETS` 읽기는 `http-safety.ts` 기존 함수 내부(diff 미포함 라인)에 있던 것으로, 이번 PR 이 새로 추가한 env 읽기/쓰기는 없다.
- **`testConnection`/`previewTest`**: 둘 다 DB 쓰기가 없고(엔티티 상태·`status`·`lastError` 미변경), `rotate` 만 실패 시 조기 `throw` 로 저장을 막는 기존 로직(diff 밖, 변경 없음)을 그대로 탄다 — 신규 테스터가 부적절하게 DB write 를 유발하지 않는다.
- 컨트롤러 JSDoc/Swagger 설명 변경(`integrations.controller.ts`)은 문서 텍스트뿐이며 실제 guard·throttle 값·경로는 변경되지 않았다.

## 요약

이 PR 의 핵심 변화 — `database`/`http` 서비스에 실제 아웃바운드 연결을 붙이는 것 — 은 의도된 기능이며, 그로 인한 "부작용"(기존 저장된 통합의 테스트/회전 endpoint 가 이제 지연·새 실패코드를 낼 수 있음)은 spec·가이드 문서에 이미 반영돼 있고 동일 패턴(20/분 throttle + 10초 타임아웃)이 `mcp`·`email` 에 이미 선례로 존재해 새로운 위험 등급을 만들지 않는다. 코드 이동(리팩터)은 grep 으로 전수 확인한 결과 dangling reference 나 시그니처 파손이 없고, DB 연결은 `finally` 로 항상 정리되며, 테스트의 전역 mock(`fetch` spy, module mock)은 전부 스코프가 닫혀 있어 병렬 테스트 오염 위험이 없다. e2e 회귀(캐시 무효화 테스트)에 대한 영향도 인지하고 fixture 를 능동적으로 격리해 두었다. Critical/Warning 급 부작용은 발견되지 않았다.

## 위험도

LOW
