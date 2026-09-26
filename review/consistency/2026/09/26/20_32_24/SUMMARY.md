# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

## 전체 위험도
**LOW** — Critical 없음. `INTEGRATION_TEST_FAILED` 의 HTTP 상태 코드(422 vs 400)와 발생 엔드포인트 귀속이 두 spec 문서 사이에서 어긋나는 기존 오기가 있으며, 이번 plan 이 바로 그 엔드포인트 군의 응답 계약·와이어 테스트를 새로 작성하는 시점이라 착수 전 정정을 권고(WARNING, 비차단). 그 외는 전부 INFO 수준.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

해당 없음 — Critical 발견이 없어 인계 대상 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, convention_compliance | `INTEGRATION_TEST_FAILED` 의 HTTP 상태 코드가 두 spec 문서에서 다르게 선언되고(422 vs 400), 발생 엔드포인트도 잘못 귀속되어 있다. 실제 구현(`integrations.service.ts` `rotate()`)은 `BadRequestException`(400)만 던지며 422 경로는 코드에 없다. `11-mcp-client.md` §9 는 이 예외가 `POST /api/integrations/:id/rotate` 내부에서 발생함에도 `:id/test` 로 잘못 인용한다 — `:id/test` 자체(`testConnection()`)는 throw 없이 항상 200 + `IntegrationTestResult` shape 을 반환한다. | `spec/2-navigation/4-integration.md` §9.4 공통 응답 포맷 (line 896, `INTEGRATION_TEST_FAILED (422)`) | `spec/5-system/11-mcp-client.md` §9 연결 테스트 (line ~596, "400" + `:id/test` 오귀속) · 실제 코드(`integrations.service.ts:1251`, `integrations.controller.ts:546-548`, 둘 다 400/`:id/rotate`) · `4-integration.md` 자신의 §9.1(line 843)·Rationale(line 1394-1399, 422 는 명시적으로 기각된 대안) | `4-integration.md` §9.4 의 `(422)` 를 `(400)` 으로 정정하고 rotate 한정임을 명시. `11-mcp-client.md` §9 의 엔드포인트 인용을 `POST /api/integrations/:id/rotate` 로 정정(또는 `:id/test` 참조 제거). 둘 다 `spec/**` 수정이라 project-planner 턴 필요하나 실측(코드 grep)이 뒷받침돼 판단은 빠르게 끝날 수 있음. 이번 developer PR 은 `spec_impact: none` 유지 가능 — 이 wire 테스트 작성 세션이 혼선을 실측으로 확인한 당사자이므로 별도 후속 항목으로 트래커에 남기는 것을 권장. |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `IntegrationTestResult`(spec 서술상 이름)와 코드 DTO 이름(`TestConnectionResultDto`/`PreviewTestResultDto`)이 1:1 대응이 아님이 spec 에 명시되지 않음 | `spec/2-navigation/4-integration.md` §9.1(843)·§9.4(896)·§14.1(1144/1148/1153) | 필수 아님. §9.1 또는 §5.6 에 "코드 상 두 클래스가 같은 shape 을 공유한다" 각주 한 줄 추가 검토 |
| 2 | rationale_continuity | `PreviewTestResultDto.serverInfo` 가 OpenAPI 상 "열린 맵"(`additionalProperties: true`)으로 선언되면서 TS 타입은 `{ name; version }` 닫힌 2필드 — 이번 plan 이 `TestConnectionResultDto` 에 그대로 복제 예정(기존 nit, 신규 아님) | `integration-response.dto.ts:271-277` (형제 DTO), plan §방향-1 이 동일 선언 복제 | 이번 PR 스코프 밖. DTO 만지는 김에 `Record<string, unknown>` 등으로 타입 확장 검토, 아니면 트래커에 한 줄 기록 |
| 3 | convention_compliance | `:id/test` 응답 shape 을 다른 §9 표 행들과 달리 swagger DTO 클래스명이 아니라 서비스 내부 TS 인터페이스명(`IntegrationTestResult`)으로 지칭 — 다음 독자가 swagger 스키마 이름으로 오인할 소지 | `spec/2-navigation/4-integration.md` §9.1, `POST /api/integrations/:id/test` 행 | 이번 plan 이 이 절을 어차피 손대므로 `TestConnectionResultDto`(DTO)와 `IntegrationTestResult`(서비스 타입) 병기 또는 DTO 이름으로 통일 |
| 4 | convention_compliance | `2-trigger-list.md` Rationale 번호가 문서 순서와 어긋남(R-8, R-7 역순, R-9~11 결번) | `spec/2-navigation/2-trigger-list.md` `## Rationale` | 우선순위 낮음, 다음에 이 절 손댈 때 참고 |
| 5 | naming_collision | 신규 테스트 파일명(`integrations.controller.wire.spec.ts`)은 기존 파일과 충돌 없고 로컬 `owner` 접미사 컨벤션과 정합하지만, plan 이 근거로 든 "자매 패턴"의 실물(`llm-model-config.controller.spec.ts:153`)은 별도 파일이 아니라 같은 파일 내 `describe` 블록 추가 방식 | 신규: `integrations.controller.wire.spec.ts` / 실제 선례: `llm-model-config.controller.spec.ts:153` | 구현 시 (a) plan 대로 별도 파일 유지 또는 (b) 기존 컨트롤러 spec 에 describe 블록 추가 중 의식적으로 선택. 식별자 충돌 없어 착수를 막을 사유 아님 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | `INTEGRATION_TEST_FAILED` 상태 코드/엔드포인트 귀속 불일치(WARNING). 핵심 필드(`capabilities`/`serverInfo`/`preview`)는 cross-spec 정합 |
| rationale_continuity | NONE | 기각된 대안 재도입·설계 원칙 우회·근거 없는 번복 없음. `serverInfo` 타입 불일치는 기존 nit 복제(INFO) |
| convention_compliance | LOW | 동일 상태 코드 불일치를 규약 위반 관점에서 재확인(WARNING). frontmatter·문서 구조·에러 코드 명명·부재 표현 규약은 전반적으로 준수 |
| plan_coherence | NONE | 트래커 항목과 정확히 대응, spec_impact:none 검증됨, 다른 in-progress plan 과 충돌 없음. 발견사항 없음 |
| naming_collision | NONE | 신규 식별자는 기존 형제 DTO 미러링과 신규 테스트 파일 1개뿐. 충돌 없음, 자매 패턴 실물과의 형태 차이만 INFO |

## 권장 조치사항

1. (BLOCK 해소 불필요 — Critical 없음) 후속 정정 우선순위:
2. `spec/2-navigation/4-integration.md` §9.4 의 `INTEGRATION_TEST_FAILED (422)` 를 `(400)` 으로 정정 — project-planner 턴, 실측(코드 grep) 근거 첨부하면 판단 신속.
3. `spec/5-system/11-mcp-client.md` §9 의 엔드포인트 인용(`:id/test`)을 실제 발생 경로(`:id/rotate`)로 정정 — 같은 planner 턴에서 함께 처리 권장.
4. 위 두 정정을 별도 후속 항목으로 `plan/in-progress/spec-draft-nullable-notation-followups.md` 등 트래커에 남겨, 이번 `integration-test-contract` developer PR 은 `spec_impact: none` 을 유지한 채 착수 가능.
5. INFO 5건은 비차단 — 이번 PR 또는 후속 세션에서 여유 있을 때 반영(§9.1 이름 병기, `serverInfo` 타입 확장 검토, Rationale 번호 정리, 신규 테스트 파일 배치 방식 택일).