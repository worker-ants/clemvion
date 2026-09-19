# API 계약(API Contract) 리뷰

## 발견사항

- **[WARNING]** `POST /api/integrations/:id/test` 가 `POST /api/integrations/preview-test` 와 같은 위험군(실제 outbound DB 접속·HTTP GET, 리다이렉트 5홉 추종)의 프로브를 수행하게 됐는데, route 레벨 throttle 이 없다 — 전역 기본값(100/60s, `ThrottlerModule.forRoot`, `app.module.ts`)만 적용된다. 반면 `preview-test` 는 바로 이 PR 의 JSDoc 이 "그렇지 않으면 반복적인 outbound probe 를 허용하게 된다" 는 이유로 `@Throttle({ limit: 20, ttl: 60_000 })` 을 명시로 유지한다.
  - 위치: `codebase/backend/src/modules/integrations/integrations.controller.ts` — `testConnection()` 핸들러(`@Post(':id/test')`, `@ApiOperation({ summary: '통합 연결 테스트' })` 블록, preview-test 핸들러 바로 아래). 게이트 숫자 없음(unified diff 미포함 구간) — `grep -n "@Post(':id/test')" codebase/backend/src/modules/integrations/integrations.controller.ts` 로 확인.
  - 상세: 이 PR 이전에는 `database`/`http` service_type 이 transport tester 가 없어 `:id/test` 가 구조 검증만 하는 사실상 무해한 호출이었다. 이제 `dispatchTest` 를 통해 실제 소켓 연결·`fetch` 를 수행하므로, `:id/test` 도 `preview-test` 와 동등한 "인증된 사용자가 임의 대상에 반복 접속을 트리거"하는 표면이 됐다 — 다만 대상 host 는 이미 저장된 통합의 credentials 로 제한된다는 점만 다르다(자격증명 자체를 매번 새로 넣지 않아도 되므로 오히려 재호출은 더 쉽다). `CONNECTION_TEST_MAX_CONCURRENCY=2` 프로세스 전역 세마포어는 두 엔드포인트가 공유하지만, 이는 스레드풀 보호 목적이지 요청 빈도 제한이 아니다.
  - 제안: `:id/test` 에도 `preview-test` 와 같거나 상응하는 `@Throttle` 을 명시하거나, 왜 `:id/test` 는 낮은 위험으로 판단했는지 spec Rationale/트래커에 한 줄 남긴다. 이미 트래커(`spec-draft-nullable-notation-followups.md`)에 등재된 "preview-test 오라클" 항목이 `:id/test` 도 같은 성격이 됐다는 사실을 포함하도록 갱신하는 것도 방법이다.

- **[INFO]** `IntegrationTestResult`/`PreviewTestResultDto.code` 가 여전히 열린 `string` 타입이라 이번 PR 이 추가한 다섯 개 코드(`DB_HOST_BLOCKED`·`DB_AUTH_FAILED`·`DB_CONNECT_FAILED`·`HTTP_BLOCKED`·`HTTP_AUTH_FAILED`·`HTTP_SERVER_ERROR`·`HTTP_CONNECT_FAILED`)는 스키마상 breaking change 가 아니다(additive). 다만 HTTP 4xx(401·403 제외) 분기는 `success: true` + 안내 메시지만 주고 `code` 를 비워, 클라이언트가 "성공"과 "확인 못 함"을 구분하려면 `message` 문자열을 파싱해야 한다 — 이는 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 "연결 테스트의 «확인 못 함» 안내가 화면에 닿지 않는다" 항목으로 planner 결정 대기 중이므로 중복 지적하지 않고 참고만 남긴다.
  - 위치: `codebase/backend/src/modules/integrations/http-connection-tester.ts` `classify()` 함수 (게이트 59-82행, 4xx 분기 74-80행).

- **[INFO]** `POST /api/integrations/:id/rotate` 가 연결 테스트 실패 시 `400`(`BadRequestException`)을 던지는데 `spec/2-navigation/4-integration.md §9.4` 는 `422`, `spec/5-system/11-mcp-client.md` 는 `400` 으로 서로 어긋난 상태다(이 PR 이 만든 회귀는 아니고 기존 상태). 이번 PR 로 Database·HTTP 연결 테스트가 실제 실패를 낼 수 있게 되어 이 경로가 "처음으로 흔해진다"(spec Rationale 표현) — 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 4760행 항목과 `--impl-prep review/consistency/2026/09/19/13_21_00` WARNING 1 로 planner 결정 대기 중이며, e2e(`integration-connection-test.e2e-spec.ts` D)도 의도적으로 상태 코드를 단언하지 않는다. 새 이슈는 아니므로 위험도에는 반영하지 않는다.
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` `rotate()` 내 `INTEGRATION_TEST_FAILED` throw (게이트 없음 — diff 밖의 기존 코드, `grep -n "INTEGRATION_TEST_FAILED" codebase/backend/src/modules/integrations/integrations.service.ts` 참고).

- **[INFO]** `PreviewTestResultDto` 의 Swagger `description` 이 "검증 결과 (마스킹된 자격 증명 포함)" → "연결 테스트 결과 — 실패 시 `code` 로 원인을 구분합니다" 로 바뀌었다. 실제로 `PreviewTestResultDto` 에는 애초에 credentials 필드가 없어(확인함) 옛 설명 자체가 사실과 달랐던 pre-existing 오기였다 — 이번 수정은 그 오기를 없애는 방향이라 회귀가 아니라 개선이다.
  - 위치: `codebase/backend/src/modules/integrations/integrations.controller.ts:166`(게이트 숫자 기준, `@ApiOkWrappedResponse(PreviewTestResultDto, ...)` 블록).

- **[INFO]** 응답 스키마·요청 검증 자체는 견고하다: `PreviewTestResultDto.code?: string` 신규 선언(파일 6)이 `assertMatchesContract` 로 preview 실패 두 경로(Database·HTTP)에 배선돼 있음을 `integrations.service.spec.ts:1958,1986` 에서 직접 확인했다 — 선언 누락 회귀는 뮤턴트로 잡힌다. Database/HTTP credentials 는 `dispatchTest` Step 1(`validateCredentials` against `SERVICE_REGISTRY`)에서 항상 먼저 구조 검증되고(port 등 타입도 스키마가 `number` 로 강제) 나서야 테스터가 호출되므로, 테스터 내부의 `credentials as unknown as DbCredentials` 캐스팅이 실제로 검증되지 않은 입력을 받을 여지는 없다.

## 요약

이 PR 은 기존 두 엔드포인트(`preview-test`, `:id/test`, `rotate`가 공유하는 `dispatchTest`)의 **동작을 의도적으로 breaking 하게 바꾼다** — Database·HTTP 서비스가 구조 검증만 통과하면 항상 성공이던 것을 실제 접속 검증으로 교체했고, 이 영향은 CHANGELOG·spec Rationale·사용자 가이드에 정확히 문서화돼 있다. 응답 스키마는 `PreviewTestResultDto.code?: string` 추가를 포함해 전부 additive 이며 `assertMatchesContract` 로 계약 검증까지 배선돼 있어 그 자체로는 안전하다. 새로 발견한 것은 `:id/test` 가 이번 PR 로 `preview-test` 와 동급의 실제 outbound 프로브 표면이 됐는데도 route 레벨 throttle 이 없어 두 엔드포인트 간 rate-limit 정책이 비대칭이라는 점(WARNING) 하나다. 그 밖의 잠재 이슈(rotate 400/422 spec 불일치, HTTP 4xx "확인 못 함" 신호가 `code` 로 노출되지 않는 점, preview-test 자체의 오라클 성격, dns.lookup 스레드풀 잔여 위험)는 이미 이번 PR 의 커밋 이력과 `plan/in-progress/spec-draft-nullable-notation-followups.md` 백로그에 planner/developer 결정 대기 항목으로 정확히 등재돼 있어 중복 지적하지 않았다.

## 위험도
LOW
