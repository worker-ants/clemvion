# API 계약(API Contract) 리뷰

## 발견사항

- **[WARNING]** `INTEGRATION_TEST_FAILED` 의 HTTP 상태 코드가 spec(422)과 구현(400)에서 계속 어긋난 채, 이 PR 이 그 경로(rotate 의 DB/HTTP 인증 실패)를 처음 실제로 태우고 e2e 로 "400" 을 사실상 굳힌다
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` (rotate 메서드, `throw new BadRequestException({ code: 'INTEGRATION_TEST_FAILED', ... })` — 함수 `rotate`) / `codebase/backend/test/integration-connection-test.e2e-spec.ts` 테스트 `D. rotate — 새 자격증명이 테스트를 통과하지 못하면 교체하지 않는다`(게이트 152~156, `expect(res.status).toBeGreaterThanOrEqual(400); expect(res.status).toBeLessThan(500);`)
  - 상세: `spec/2-navigation/4-integration.md` §9.4 는 `INTEGRATION_TEST_FAILED (422)` 라고 명시하지만 실제 구현은 `BadRequestException`(HTTP 400)을 던진다. `spec/5-system/11-mcp-client.md` 는 같은 코드를 400 으로 서술하고, `spec/5-system/2-api-convention.md §6` 의 일반 원칙(422=비즈니스 로직 오류, 400=입력 유효성 오류)은 의미상 422 쪽을 지지한다 — spec 3곳이 서로 어긋난 상태다. 이번 PR 이전에는 database·http 서비스가 rotate 의 이 실패 경로를 탄 적이 없었으나(구조 검증만 통과하면 무조건 성공), 이번 구현으로 실제 인증 실패가 처음 이 경로를 타게 됐고, 새 e2e 테스트는 정확한 상태 코드를 단언하지 않는 방식(`400~499` 범위)으로 이 불확실성을 우회했다. 상태 코드가 굳어지기 전에 결정하지 않으면, 이후 spec 을 422 로 정정할 때 이미 그 값에 의존하는 e2e/클라이언트가 있어 회귀 비용이 커진다.
  - 제안: 이 PR 자체의 범위 문제는 아니며 이미 `plan/in-progress/integration-db-http-testers.md` 체크리스트와 `review/consistency/2026/09/19/13_21_00`(cross_spec WARNING #1)에 트래커 항목으로 적혀 있다 — 별도 조치 요구는 아니지만, 병합 전 이 항목이 실제로 이슈 트래커에 반영됐는지 확인 필요. (a) rotate 도 preview-test/`:id/test` 처럼 예외를 던지지 않고 `{success:false, code}` 를 200 으로 돌려주는 방향으로 통일하거나, (b) 422 로 상태 코드를 맞추는 결정을 스코프 확정 전에 내릴 것.

- **[INFO]** `PreviewTestResultDto.code` 신규 optional 필드 추가는 하위 호환적이나, 값의 실제 등장 시점과 문서상 "구조 검증만" 서비스 사이의 경계가 코드 레벨에서는 하나의 유니온 문자열로만 표현된다
  - 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts:257`(`code?: string`)
  - 상세: `code?: string` 는 열린 문자열 타입이라 OpenAPI 스키마상 실제 가능한 값 집합(`MCP_*`·`EMAIL_*`·`DB_*`·`HTTP_*`·`INTEGRATION_INCOMPLETE` 등)을 클라이언트가 스펙만으로 알 수 없다. 기존 컨벤션(`TestConnectionResultDto.code`)도 같은 방식이라 이 PR 만의 새로운 결함은 아니고, 두 DTO 간 필드 정의가 대칭을 이루도록 잘 맞춰졌다(주석에도 "형제 필드" 로 명시). breaking change 는 아니다.
  - 제안: 조치 불필요(기존 패턴 유지). 추후 `code` 값 전체 집합을 문서화할 필요가 있다면 `@ApiProperty({ enum: [...] })` 로 좁히는 별도 개선을 고려할 수 있음.

- **[INFO]** Database/HTTP 통합의 기존 저장된 자격증명 중 실제로는 유효하지 않던 것들이, 이 배포 이후 `:id/test`·rotate 호출 시 처음으로 `success:false` 를 받게 되는 동작 변화(의도된 버그 수정)
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` `transportTesters` 맵(database·http 항목 추가, 게이트 407~411)
  - 상세: 종전에는 database·http 서비스에 transport tester 가 없어 구조 검증만 통과하면 항상 `success:true` 였다. 클라이언트 관점에서는 지금까지 "연결 성공"으로 보이던 기존 통합이 갑자기 실제 실패로 뒤집힐 수 있다 — API 응답 값 자체의 하위 호환성 문제는 아니지만(스키마는 그대로), 클라이언트가 이 값에 의존해 UI 상태를 바꾸는 경우 사용자 체감상 회귀처럼 보일 수 있다. spec Rationale 에 의도된 버그 수정으로 명시돼 있어 결함은 아니다.
  - 제안: 조치 불필요 — 문서화된 의도적 동작 변경. 릴리스 노트/가이드에 이미 반영됨(`integration-management.mdx` Callout).

## 정합성 확인 (문제 없음으로 판단한 항목)

- `IntegrationTestResult { success, code?, message }` 응답 shape 이 mcp·email·database·http 네 테스터 전부에서 동일하게 유지된다 — 새 테스터 두 개도 기존 shape 을 그대로 따르고, `PreviewTestResultDto`/`TestConnectionResultDto` 양쪽에 `code` 가 대칭으로 선언돼 있으며 `assertMatchesContract`(response-contract 헬퍼)로 unit spec 에서 직접 검증한다(`integrations.service.spec.ts` 신규 describe 블록).
- 신규 에러 코드(`DB_AUTH_FAILED`·`DB_CONNECT_FAILED`·`HTTP_AUTH_FAILED`·`HTTP_CONNECT_FAILED`·`HTTP_SERVER_ERROR`)는 `spec/conventions/error-codes.md` §1 의 UPPER_SNAKE_CASE·도메인 prefix 규약을 따르고, 저장소 전수 grep 으로 이름 충돌이 없음이 이미 convention-compliance checker 로 실증됐다(`review/consistency/2026/09/19/13_03_41/convention_compliance.md`).
- SSRF 차단 시 클라이언트 응답 메시지에 차단된 host/IP 를 싣지 않는 원칙이 노드(`HTTP_BLOCKED`/`DB_HOST_BLOCKED`)와 연결 테스트 양쪽에서 일관되게 지켜진다(`SSRF_BLOCKED_CLIENT_MESSAGE`/`DB_HOST_BLOCKED_MESSAGE` 공용 상수화, e2e 테스트 A·B 가 `message` 에 host 문자열이 없음을 직접 단언).
- `credentials as unknown as DbCredentials` 캐스트는 위험해 보이나, `dispatchTest` 호출 전 `validateCredentials`(service-registry) 가 `driver`/`host`/`port`/`ssl` 등 필수 필드의 존재·타입(enum/number/string)을 이미 검증하므로 이 경로에서 실질적 요청 검증 공백은 없다.
- Swagger 문서(`@ApiOperation`·`@ApiOkWrappedResponse` description)가 실제 동작(구조 검증만 vs 실제 접속)에 맞게 갱신되어 API 문서와 구현의 drift 가 오히려 이 PR 로 해소됐다.
- 이 PR 은 새 엔드포인트나 URL 경로를 추가하지 않으며(`preview-test`/`:id/test`/`rotate` 기존 경로 재사용), 인증/인가 가드(`@Roles`, throttle)도 변경하지 않았다 — RESTful 설계·인증/인가 관점에서 회귀 없음.

## 요약

이번 변경은 기존 `preview-test`/`:id/test`/`rotate` 세 경로가 공유하는 `dispatchTest` 에 Database·HTTP transport tester 를 추가해, 구조 검증만으로 항상 성공 처리되던 결함을 고치는 작업이다. 응답 shape(`IntegrationTestResult`/`PreviewTestResultDto`/`TestConnectionResultDto`)은 하위 호환적으로 확장됐고, 신규 에러 코드는 명명 규약과 네임스페이스 분리를 지켰으며, unit spec 이 `assertMatchesContract` 로 계약을 직접 검증한다. 유일하게 실질적인 API 계약 이슈는 `INTEGRATION_TEST_FAILED` 의 HTTP 상태 코드가 spec(422)·구현(400)·다른 spec 문서(400) 사이에서 3중으로 어긋난 상태인데, 이번 PR 이 그 경로를 처음 실제로 태우면서도 상태 코드 자체는 의도적으로 단언하지 않는 방식으로 우회했다는 점이다 — 이미 이 PR 의 plan 체크리스트와 직전 consistency-check(13_21_00, cross_spec WARNING #1)에 같은 내용으로 트래킹돼 있어 이 리뷰가 새로 발견한 결함은 아니지만, 병합 전 트래커 반영 여부를 재확인할 필요가 있다.

## 위험도

LOW
