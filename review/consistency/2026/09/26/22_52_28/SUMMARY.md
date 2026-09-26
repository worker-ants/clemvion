# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (`export-workflow-typed`, `--impl-prep`, scope=`spec/2-navigation/`)

## 전체 위험도
**LOW** — Critical/Blocking 요소 없음. 5개 checker 모두 대상 plan(§3.2 `ExportedNodeDto`/`ExportedEdgeDto` 신설)과의 직접 충돌은 발견하지 못했으나, `convention_compliance` 가 스코프 내 다른 문서(`4-integration.md`)에서 SoT 와 어긋나는 국소적 문서 drift 를 WARNING 으로 발견했다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | `4-integration.md` §9.4 "공통 응답 포맷" 이 실패 응답을 `{ code, message, details? }` (top-level, `error` 래퍼·`requestId` 없음)로 서술 — SoT·실제 구현과 불일치 | `spec/2-navigation/4-integration.md` §9.4 (라인 889-892) | `spec/5-system/2-api-convention.md` §5.3 (에러 봉투는 `{ error: { code, message, requestId, details? } }`) + 실제 구현 `codebase/backend/src/common/filters/http-exception.filter.ts` (GlobalExceptionFilter) | `- 실패: { error: { code, message, requestId, details? } }` 로 정정하거나 `spec/5-system/2-api-convention.md#53-에러-응답` 링크로 대체. `status: partial`(실사용 중)이라 misleading 위험 있음 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec, plan_coherence | 프런트엔드 `ExportedNode.description?: string` 이 신규 백엔드 `ExportedNodeDto.description`(`string \| null`, 상시 존재)의 nullable 을 반영하지 않음. 동작 결함은 아님(소비처가 falsy 로만 처리)이나 plan 이 스스로 관찰만 하고 트래커에 미등재 | `codebase/frontend/src/lib/api/workflows.ts` (`ExportedNode.description`) / `plan/in-progress/export-workflow-typed.md` §"관찰 (이 PR 밖)" | `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 신규 항목으로 등재(마무리 커밋 단계, `canvas-save-typed` 선례와 동일 패턴). 차단 사유 아님 |
| 2 | cross_spec | 같은 원본 컬럼(`Node.description`, `Edge.condition`)이 응답 표면마다 다른 OpenAPI 계약 형태로 광고됨 — 기존 `NodeDto`/`EdgeDto` 는 `@ApiPropertyOptional({ nullable: true })`(§5.4 기준 양쪽 다 틀린 혼합형)를 쓰는데, 이번 plan 의 신규 `ExportedNodeDto`/`ExportedEdgeDto` 는 §5.4 를 정확히 따르는 순수 required+nullable 형태를 씀 | `codebase/backend/src/modules/nodes/dto/responses/node-response.dto.ts` (`NodeDto.description`) / `edge-response.dto.ts` (`EdgeDto.condition`) — 이번 plan 이 만든 결함 아님, 기존 코드의 §5.4 비준수 | 이번 PR 스코프 밖. `NodeDto`/`EdgeDto` 의 §5.4 비준수 정정은 별도 백로그 항목으로 남기는 정도면 충분 |
| 3 | rationale_continuity | `ExportedNodeDto`/`ExportedEdgeDto` 가 (엔티티 1:1 재사용인 `CanvasSaveResultDto` 와 달리) index-기반·UUID 미포함 계약이라는 설계 의도가 코드에 명시돼 있지 않음 — 향후 "일관성" 명목으로 `NodeDto`/`EdgeDto` 로 되돌리는 실수 표면 존재 | `codebase/backend/src/modules/workflows/dto/responses/workflow-response.dto.ts` (`ExportWorkflowDto` 신설 자리) | 선언 위에 "이 DTO 는 `NodeDto`/`EdgeDto` 와 달리 UUID 를 싣지 않는다 — §3.2 index-기반 참조 계약을 유지하기 위함" 한 줄 주석 추가 권장 |
| 4 | rationale_continuity | `formatVersion` 필드가 `ExportWorkflowDto` 에 required 로 선언돼 있으나 실제 응답에는 emit 되지 않는 기존 갭 — 이번 plan 은 이 갭을 만들지도 건드리지도 않음, 스코프 경계를 스스로 명시 | `spec/2-navigation/1-workflow-list.md` §3.2 (⚠️ 표기 기존 존재) | 조치 불필요. 별도 트래커(`spec-draft-nullable-notation-followups.md`)가 이미 추적 중 — 중복 항목 생성 금지 |
| 5 | convention_compliance | `8-marketplace.md` §3 API 표의 `DELETE .../uninstall` 이 나머지 문서군의 "동작-suffix 는 POST" 관례와 스타일 불일치 | `spec/2-navigation/8-marketplace.md` §3 (`DELETE /api/marketplace/items/:id/uninstall`) | `status: backlog` 단계라 구속력 낮음. 실제 구현 착수 시 `POST .../uninstall` 형태로 정리 권장(지금 수정 불요) |
| 6 | plan_coherence | `2-trigger-list.md` §3 API 표의 `GET /api/triggers/:id/history` 형태·상한 미표기 — 이번 plan 과 무관, `--impl-prep` 번들 스코프(`spec/2-navigation/` 전체)가 딸려온 기존 갭 | `spec/2-navigation/2-trigger-list.md` §3 | 이미 `spec-draft-nullable-notation-followups.md` 에 등재됨 — 재등재하지 말 것 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | plan 은 `spec/1-data-model.md`·`data-flow/11-workflow.md`§1.5·`api-convention.md`§5.4·`swagger.md` 어느 쪽과도 직접 모순 없음. 기존 `NodeDto`/`EdgeDto` 의 §5.4 비준수를 부각시키나 이번 plan 의 결함은 아님 |
| rationale_continuity | NONE | §3.2 index-기반 참조 설계를 정확히 보존. `CanvasSaveResultDto` 와 별도 DTO 신설은 원칙 위반이 아니라 §3.2 Rationale 을 지키는 필연적 선택. 코드 주석 보강 제안(INFO)만 있음 |
| convention_compliance | LOW | `4-integration.md`§9.4 실패 응답 포맷이 `api-convention.md`§5.3 SoT·실제 구현과 불일치(WARNING, 국소적 문서 drift). `export-workflow-typed` 대상 범위(§3.2) 자체엔 규약 위반 없음 |
| plan_coherence | NONE | 트래커(`spec-draft-nullable-notation-followups.md`)가 요구한 절차(요청 DTO 재사용 vs 응답 전용 DTO 신설)를 실측으로 정확히 이행. FE 타입 갭 트래커 미등재만 절차적 INFO |
| naming_collision | NONE | `ExportedNodeDto`/`ExportedEdgeDto` 저장소 전역 grep 0건, 기존 DTO 명명 패턴과 정합. `dto-class-name-collision-guard.ts` 가 impl-done 단계에서 재검증 |

## 권장 조치사항
1. (구현 착수 자체를 막지 않음) `spec/2-navigation/4-integration.md` §9.4 실패 응답 포맷을 `{ error: { code, message, requestId, details? } }` 로 정정 — `export-workflow-typed` PR 과 별개 spec 정정 커밋(또는 후속 planner 턴)으로 처리 권장.
2. `export-workflow-typed` 구현 시 `ExportedNodeDto`/`ExportedEdgeDto` 선언부에 "UUID 미포함·index-기반 계약" 의도를 명시하는 코드 주석 추가.
3. 마무리 커밋 단계에서 FE `ExportedNode.description?: string` nullable 미반영 사실을 `spec-draft-nullable-notation-followups.md` 에 신규 항목으로 등재.
4. `8-marketplace.md` `DELETE .../uninstall` 스타일 불일치, `2-trigger-list.md` history 갭은 조치 불요/재등재 불요 — 현행 유지.