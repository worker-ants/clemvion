# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL/WARNING 0건. 7개 reviewer 전원(router_safety 강제 포함 whitelist)이 정상 실행·결과 확보됐고(누락 없음), 발견사항은 전부 INFO 수준(기존부터 추적 중인 spec 문서화 갭 1건 포함)이다.

> **참고 (거짓 음성 방지 확인)**: forced whitelist 7명(documentation, maintainability, requirement, scope, security, side_effect, testing) 전원의 전문이 인라인으로 확보되어 "forced 인데 결과 없음" 상황은 없다.

## Critical 발견사항

없음.

## 경고 (WARNING)

없음. (1라운드 WARNING 2건 — MakeShop `pingConnection` 런타임 테스트 부재, 타입 계약 테스트의 `TestGateCode` 누락 — 은 커밋 `287aa2b89` 로 조치 완료되었고, 이번 2라운드 전 reviewer 가 그 조치의 정확성을 실제 코드와 재대조하여 확인함.)

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | documentation / requirement | spec `4-integration.md` §5.3 결과 목록·§14.1 vocabulary 표가 HTTP 연결 테스트의 `INTEGRATION_INCOMPLETE`/`INTEGRATION_AUTH_UNSUPPORTED` 반환 가능성을 여전히 누락 — 코드는 정확하고 spec 서술만 비어 있는 기존 갭. 이번 PR 이 만든 것이 아니라 `--impl-prep` consistency-check 에서 이미 WARNING 으로 등재되어 planner 턴 인계 대기 중 | `spec/2-navigation/4-integration.md` §5.3(451행 부근), §14.1(1092-1122행) | 조치 불필요(developer 권한 밖). `--impl-done` 이후 별도 planner 턴에서 spec 반영 |
| 2 | requirement | MakeShop 403 을 `MAKESHOP_AUTH_FAILED` 하나로 묶고 Cafe24 처럼 `insufficient_scope` 로 세분하지 않는 비대칭 — `5-makeshop.md:181` 에 명시적으로 문서화된 의도된 차이, 불일치 아님 | `spec/4-nodes/4-integration/5-makeshop.md:181`, `makeshop-api.client.ts` | 조치 불필요 |
| 3 | security | SSRF 차단 사유(`reason`/`detail`)는 서버 로그에만 남고 클라이언트 응답은 고정 문구만 반환 — 기존 동작 유지, 회귀 없음 | `http-connection-tester.ts` `blocked()`(23-30행), `database-connection-tester.ts`(136-147행) | 조치 불필요(현행 유지 확인) |
| 4 | security | 에러 메시지가 `clampMessage(err.message)` 로 길이만 제한, 드라이버 원문 예외 메시지 노출 — 기존 설계(자기 자신의 통합 대상에 한정), 이번 PR 범위 밖 | `database-connection-tester.ts`(159-165행), `http-connection-tester.ts`(144-148행), `integrations.service.ts` | 조치 불필요(범위 밖, 회귀 아님) |
| 5 | security / side_effect | `database-driver-sockets.spec.ts` 가 unit 계층에서 루프백(127.0.0.1) 소켓을 실제로 여는 것은 기존부터 있던 동작이며, 이번 PR 이 `try/finally` 로 감싸 단언 실패 시에도 소켓이 정리되도록 개선함(리소스 누수 축소) | `database-driver-sockets.spec.ts`(18-45행) | 조치 불필요(오히려 개선) |
| 6 | security / testing | 타입 수준 계약 테스트(`connection-test-codes.spec.ts` "타입 수준 계약 (런타임 no-op)")는 jest 실행 시 no-op, 실제 강제는 `tsc` 래칫 — 1라운드부터 알려진 사실, 재-flag 아님 | `connection-test-codes.spec.ts` | 조치 불필요(이미 등재) |
| 7 | scope | 2라운드가 추가한 테스트(MakeShop `pingConnection` 3분기, `accepted` 배열의 `INTEGRATION_CREDENTIALS_UNREADABLE`, 복호화 불가 게이트 테스트)는 plan 원문의 "할 것" 목록에는 없던 추가지만, 1라운드 RESOLUTION.md W1·W2 지시와 1:1 대응하는 정상적 리뷰 루프 산출물 | `makeshop-api.client.spec.ts`, `connection-test-codes.spec.ts`, `integrations.service.spec.ts` | 조치 불필요 |
| 8 | scope | 리뷰/consistency 산출물 19개 파일이 diff 에 포함 — CLAUDE.md 지정 정식 저장 위치(`review/code/**`, `review/consistency/**`)에 놓인 표준 워크플로 부산물 | `review/code/2026/09/19/23_34_45/**`, `review/consistency/2026/09/19/23_02_33/**` | 조치 불필요 |
| 9 | side_effect | `IntegrationTestResult.code`(`string`→`IntegrationTestResultCode`), 두 `pingConnection` 반환 타입(`Cafe24PingCode`/`MakeshopPingCode`) 좁히기 — 순수 컴파일타임 계약 강화, 실제 반환 리터럴 값은 기존과 동일함을 대조 확인 | `integrations.service.ts:84`, `cafe24-api.client.ts:380`, `makeshop-api.client.ts:312` | 조치 불필요. 향후 새 생산자 추가 시 union 갱신 누락 주의 |
| 10 | side_effect | `integrations.service.spec.ts` 의 `rotate` 테스트 중간 `integrationRepo.findOne.mockReset()` 호출은 상위/자체 `beforeEach` 로 매 테스트 재설정되어 인접 테스트로 상태가 새지 않음 | `integrations.service.spec.ts:1337` | 조치 불필요 |
| 11 | maintainability | `database-driver-sockets.spec.ts` 두 `it` 블록의 `try/finally` 구조가 거의 동일 — 1라운드에서 이미 "헬퍼로 묶으면 드라이버별 사정 설명이 흐려진다"는 판단으로 조치 없음 처분, 이번 재확인에서도 유효 | `database-driver-sockets.spec.ts` | 조치 불필요(선택: `finally` 절만 지역 함수로 추출하는 절충안 가능) |
| 12 | maintainability | `IntegrationTestResultCode` 가 6개 producer 를 한 파일에 모으는 aggregator 구조라 7번째 producer 추가 시 누락 위험 — JSDoc `{@link}` 명시 + 좁힌 union 이 위반 시 컴파일 에러로 드러나는 구조라 실제 리스크 낮음 | `connection-test-codes.ts` (`IntegrationTestResultCode` 정의부) | 조치 불필요 |
| 13 | testing | `database-connection-tester.spec.ts` 신규 `it.each` 의 `disable` 케이스가 `%j` 포맷 지정자로 `undefined` 를 넘겨 테스트 이름에 `(undefined)` 문자열이 찍힘 — 실행·판정 영향 없는 가독성 이슈 | `database-connection-tester.spec.ts` (`it.each` `disable` 행) | 선택 사항. `%p` 사용 또는 기대값 사전 포맷 |
| 14 | documentation | `TestConnectionResultDto.code` JSDoc 예시 목록(Swagger DTO)이 신설된 `IntegrationTestResultCode`/`CAFE24_*`/`MAKESHOP_*`/`INTEGRATION_AUTH_UNSUPPORTED` 를 인용하지 않음 — diff 스코프 밖 | `integration-response.dto.ts:478-483` | 선택 사항. 여유 있으면 `{@link IntegrationTestResultCode}` 참조 추가 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | SSRF/에러메시지 노출 기존 동작 유지, 신규 인젝션·인가우회·시크릿 노출 없음 |
| requirement | NONE | 1라운드 WARNING 2건 조치 정확성 재검증 통과, spec fidelity line-level 대조 완료(기존 spec 갭 1건 INFO 유지) |
| scope | NONE | 31개 파일 전체가 plan·RESOLUTION 범위 내, 범위 이탈 없음 |
| side_effect | NONE | 타입 좁히기 3곳 모두 컴파일타임 전용, 신규 부작용 없음(오히려 소켓 정리 개선) |
| maintainability | NONE | 1라운드 WARNING 조치가 기존 코드 패턴 준수, 함수 길이·복잡도·네이밍 신규 결함 없음 |
| testing | NONE | 1라운드 WARNING 2건이 판별력 있는 테스트로 정확히 닫힘, vacuous assertion 없음 |
| documentation | LOW | spec §5.3/§14.1 HTTP 게이트 코드 문서화 갭(기존, 추적 중) 재확인 |

## 발견 없는 에이전트

없음 — 실행된 7개 reviewer 전원이 최소 1건 이상의 INFO 를 보고함(대부분 "조치 불필요" 확인 성격).

## 권장 조치사항

1. (선택, developer 권한 밖) `--impl-done` 완료 후 별도 planner 턴에서 `spec/2-navigation/4-integration.md` §5.3 결과 목록과 §14.1 vocabulary 표에 HTTP 연결 테스트의 `INTEGRATION_INCOMPLETE`/`INTEGRATION_AUTH_UNSUPPORTED` 반환 가능성을 반영한다 (plan 체크리스트에 이미 등재됨).
2. (선택) `database-connection-tester.spec.ts` 의 `it.each` `disable` 케이스 포맷 지정자를 `%j` → `%p` 로 바꾸거나 기대값을 사전 포맷해 테스트 이름 가독성을 개선한다.
3. (선택) 여유가 있으면 `integration-response.dto.ts` 의 `TestConnectionResultDto.code` JSDoc 에 `{@link IntegrationTestResultCode}` 참조를 추가해 정본 union 과 연결한다.
4. 이번 라운드에서 CRITICAL/WARNING 급 조치 항목은 없으므로 추가 코드 수정 없이 종결 가능하다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation` (7명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명, 전원 결과 확보됨 — whitelist 미이행 없음)
  - **제외**: 아래 표 (7명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단 — 순수 타입 리팩터로 성능 영향 경로 없음(구체적 사유는 prompt 에 항목별로 제공되지 않음) |
  | architecture | 라우터 판단 — 아키텍처 구조 변경 없음(리터럴→상수 치환) |
  | dependency | 라우터 판단 — 의존성 변경 없음 |
  | database | 라우터 판단 — DB 스키마/쿼리 로직 변경 없음(SSL 매핑 값 대조만 추가) |
  | concurrency | 라우터 판단 — 동시성 로직 변경 없음(rotate 404 테스트는 기존 로직 검증) |
  | api_contract | 라우터 판단 — 외부 API 계약 변경 없음(내부 타입 좁히기만) |
  | user_guide_sync | 라우터 판단 — 사용자 가이드 영향 없는 내부 리팩터 |
