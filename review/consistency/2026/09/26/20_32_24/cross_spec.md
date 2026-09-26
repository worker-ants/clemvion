# Cross-Spec 일관성 검토 — `spec/2-navigation/` (impl-prep, `integration-test-contract`)

## 검토 범위 메모

대상 plan(`plan/in-progress/integration-test-contract.md`)의 `spec_impact: none` 선언대로, 이번 변경은
`POST /api/integrations/:id/test` 응답 DTO(`TestConnectionResultDto`)에 이미 spec 이 문서화한 MCP 필드
3종(`capabilities`/`serverInfo`/`preview`)을 code 에 뒤늦게 선언하는 **spec-vs-code 정합화**이며 신규 spec
서술을 만들지 않는다. 따라서 본 검토는 "target 초안"이 아니라 **개발 착수 직전 시점의
`spec/2-navigation/4-integration.md`(§3.3/§5.6/§9/§14) 가 다른 영역(`spec/5-system/11-mcp-client.md`)과
이미 모순을 안고 있는지**를 확인하는 데 집중했다 — 그 모순이 이번 PR 이 건드리는 바로 그 표면
(`:id/test` 의 응답·에러 계약)과 겹치면 구현자가 잘못된 문서를 SoT 로 오인할 위험이 있기 때문이다.

`capabilities`/`serverInfo`/`preview`(`toolCount`/`resourceSupported`/`promptSupported`) 필드 자체는
`4-integration.md` §5.6 과 `11-mcp-client.md` §9 사이에 이름·shape 이 정확히 일치한다 — 이 축은 충돌 없음.

## 발견사항

- **[WARNING] `INTEGRATION_TEST_FAILED` 의 HTTP 상태 코드가 두 spec 에서 다르게 선언되고, 발생 엔드포인트도 잘못 귀속되어 있다**
  - target 위치: `spec/2-navigation/4-integration.md` §9.4 공통 응답 포맷 (line 896) — `` `INTEGRATION_TEST_FAILED` (422) — 연결 테스트 실패 ``
  - 충돌 대상: `spec/5-system/11-mcp-client.md` §9 연결 테스트 (line 596 부근) — `` 이미 저장된 Integration 의 credential rotate 경로(`POST /api/integrations/:id/test` 후 갱신)는 테스트 실패 시 `INTEGRATION_TEST_FAILED` (`BadRequestException`, HTTP 400) 를 던진다 ``
  - 상세:
    1. **상태 코드 불일치** — 같은 에러 코드 `INTEGRATION_TEST_FAILED` 를 `4-integration.md` §9.4 는 **422**, `11-mcp-client.md` §9 는 **400** 으로 서술한다. 실제 구현(`codebase/backend/src/modules/integrations/integrations.service.ts` `rotate()`)은 `throw new BadRequestException({ code: 'INTEGRATION_TEST_FAILED', ... })` — **400**만 존재하며 422 를 던지는 경로는 코드 전체에 없다(`grep -rn 422 codebase/backend/src/modules/integrations` 무결과). 즉 `4-integration.md` §9.4 의 "422" 표기는 같은 문서 자신의 Rationale("연결 테스트 endpoint 의 `pending_install` 가드 — 응답 형식")이 명시하는 "기존 service 의 다른 throw 들(rotate/scope/INVALID_CREDENTIALS)이 모두 400" 이라는 서술과도 모순된다 — 422 는 그 Rationale 이 **기각한 대안**으로 명시돼 있다(line 1399: `` `422 UnprocessableEntityException` — … 응답 형식 일관성을 우선해 200 + success:false 로 채택 ``). 문서 안에서도 스스로 낡았다.
    2. **엔드포인트 오귀속** — `11-mcp-client.md` §9 는 "credential rotate 경로"라는 올바른 문맥에 이어 괄호로 endpoint 경로를 `` `POST /api/integrations/:id/test` `` 라고 적었다. 그러나 실제로 `INTEGRATION_TEST_FAILED`(400, throw)를 내는 곳은 `POST /api/integrations/:id/rotate` 내부의 `dispatchTest` 실패 분기이며, `POST /api/integrations/:id/test` 자체(`testConnection()`)는 **절대 throw 하지 않고 항상 200 + `IntegrationTestResult`(`{ success:false, code, message }`) 를 반환**한다 — 이는 `4-integration.md` §9.1 표(line 843, `pending_install` 가드가 "인접 가드와 동일한 `IntegrationTestResult` shape" 라고 명시)와 그 Rationale(line 1394, "두 분기 모두 200 + `IntegrationTestResult` shape 으로 반환") 이 반복해서 못박는 내용이며, 실제 `testConnection()` 구현에도 `throw` 문이 없다(코드 확인: `integrations.service.ts:1080-1119`). 즉 `11-mcp-client.md` 가 인용한 경로 표기 자체가 `:id/rotate` 를 `:id/test` 로 잘못 적은 것으로 보인다.
  - 왜 이번 PR 과 관련 있는가: plan(`integration-test-contract.md`)이 새로 만드는 `integrations.controller.wire.spec.ts` 는 정확히 `POST /api/integrations/:id/test` 의 성공·실패 wire 계약을 검증한다(케이스 a/b/c, 특히 (c) "MCP 실패 → `MCP_AUTH_FAILED`"). 구현자가 `11-mcp-client.md` §9 만 참조하고 `4-integration.md` §9.1/Rationale 을 놓치면 `:id/test` 가 실패 시 400 을 던진다고 오해해 와이어 테스트에 잘못된 status-code 단언을 넣을 수 있다 — 실제로는 200 이어야 한다.
  - 제안: `spec/5-system/11-mcp-client.md` §9 의 해당 문장에서 endpoint 표기를 `` `POST /api/integrations/:id/rotate` ``(또는 "credential rotate 경로" 그대로 두고 `:id/test` 참조를 제거)로 정정하고, `spec/2-navigation/4-integration.md` §9.4 의 `INTEGRATION_TEST_FAILED (422)` 를 `(400)` 으로 정정한다. 두 수정 모두 `spec/**` 이므로 `project-planner` 턴이 필요하지만, 실측(코드 grep)이 뒷받침되므로 판단은 빠르게 끝날 수 있다. 이번 developer PR 은 `spec_impact: none` 을 유지해도 되지만, 위 두 정정을 별도 후속 항목으로 트래커(`plan/in-progress/spec-draft-nullable-notation-followups.md` 등)에 남기는 것을 권한다 — 지금 wire 테스트를 작성하는 세션이 바로 이 혼선을 실측으로 확인한 당사자이기 때문이다.

- **[INFO] `IntegrationTestResult`(spec 서술상 이름) ↔ 코드 DTO 이름(`TestConnectionResultDto`/`PreviewTestResultDto`) 이 1:1 대응이 아니라는 점은 spec 에 명시돼 있지 않다**
  - target 위치: `spec/2-navigation/4-integration.md` §9.1(line 843), §9.4(line 896), §14.1(line 1144/1148/1153) — 전부 `IntegrationTestResult` 라는 단일 논리적 이름으로 서술
  - 충돌 대상: 없음 (spec 대 spec 충돌 아님) — 코드에는 `TestConnectionResultDto`(`:id/test` 전용)와 `PreviewTestResultDto`(`preview-test` 전용) 두 개의 물리적 DTO 클래스가 존재하고 이번 plan 이 그 필드 선언 비대칭을 교정 대상으로 삼고 있음
  - 상세: 이건 결함이 아니라 명명 수준 차이다 — spec 은 "논리적 응답 shape"을 `IntegrationTestResult` 로 부르고, 코드는 엔드포인트별로 물리적 클래스를 분리했다. 다만 두 DTO가 지금까지 필드 선언에서 벌어져 있었다는 사실(이번 PR 의 출발점) 자체가, spec 이 "같은 shape" 이라고 서술하는 대상이 실제로는 두 개의 독립 클래스임을 알기 어렵게 만든 한 원인이다.
  - 제안: 필수 조치 아님. 다만 이번 PR 에서 두 DTO 를 동일하게 맞춘 뒤, spec 에 "코드 상 `TestConnectionResultDto`/`PreviewTestResultDto` 두 클래스가 같은 shape 을 공유한다"는 각주를 §9.1 또는 §5.6 에 한 줄 추가하면 다음 사람이 이번과 같은 비대칭을 다시 만들 가능성이 줄어든다 (선택 사항, WARNING 아님).

## 요약

핵심 필드(`capabilities`/`serverInfo`/`preview` 및 그 안쪽 키)는 `spec/2-navigation/4-integration.md` §5.6 과
`spec/5-system/11-mcp-client.md` §9 사이에 정확히 일치하므로 이번 PR 이 다루는 필드 선언 자체에는 cross-spec
충돌이 없다. 다만 같은 엔드포인트 계열(`:id/test` vs `:id/rotate`)의 실패 응답 계약을 두 문서가 서로 다른 HTTP
상태 코드(422 vs 400)로 서술하고, 그중 하나(`11-mcp-client.md`)는 실패가 발생하는 엔드포인트 경로 자체를
`:id/test` 로 잘못 인용하고 있다 — 실측(코드)은 400/`:id/rotate` 이며 `4-integration.md` 자신의 §9.1·Rationale
과도 일치한다. 이번 PR 이 바로 그 `:id/test` 응답 DTO와 wire 계약을 다루므로, 구현 중 어느 문서를 참조하는지에
따라 실패 케이스의 status-code 기대값이 달라질 위험이 있어 사전에 정정이 필요하다. 그 외 데이터 모델·요구사항
ID·상태 전이·RBAC·계층 책임 축에서는 두 영역 간 충돌을 발견하지 못했다.

## 위험도

LOW
