# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(cross_spec, rationale_continuity, convention_compliance, plan_coherence, naming_collision) 전원 정상 응답, Critical 발견 없음.

## 전체 위험도
**LOW** — CRITICAL 0건. WARNING 2건(내용상 1개 이슈를 두 checker가 다른 각도로 지적 + 1개 독립 이슈)이 최고 등급이며, 둘 다 실행/계약 위반이 아니라 plan 메타데이터·리뷰 인용 형식 문제.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | plan_coherence, cross_spec (통합) | `plan/in-progress/spec-followups-batch-b.md` frontmatter `spec_impact: [spec/2-navigation/2-trigger-list.md]` 가 실제 diff(spec 델타 0, 그 spec 의 `code:` glob 미접촉)와 무관 — 상위 문서 `spec-draft-nullable-notation-followups.md` 의 값을 그대로 옮겨 붙인 것으로 보임 | `plan/in-progress/spec-followups-batch-b.md` frontmatter | `spec/2-navigation/2-trigger-list.md` §3 (아직 미해결인 sort/order whitelist 항목의 진짜 SoT) | `spec_impact` 를 `none` 으로 정정. `complete/` 이동 전에 고치지 않으면 "batch-b 가 이미 이 spec 영향을 다뤘다"는 잘못된 기록이 남아 sort/order 미해결 항목의 `pending_plans` 포인터가 후속 세션에서 조기 해소 처리될 위험 |
| 2 | convention_compliance | `spec/conventions/review-citations.md` §2 위반 — bare `hh_mm_ss` 인용(`16_29_00` W5) 신규 추가 (§4 소급 유예는 기존 인용에만 적용, 신규 추가는 면제 아님) | `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` 상단 JSDoc, diff 추가 줄 `review/consistency/2026/09/06/13_39_25` W3 · `16_29_00` W5 | `spec/conventions/review-citations.md` §2 (허용 형태: 전체 경로 또는 "날짜+시각") | `16_29_00` → `2026-09-06 16_29_00` 로 수정하거나, 이 축약이 팀 관행으로 굳어진 것이라면 §2 에 그 형태를 명시적으로 추가 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity | "쿼리 범위 DB-레벨 `select` 투영" 패턴(엔티티 전역 `select:false` 와 구분됨)이 `WorkflowVersionsService.findOne`에 이어 `WorkspacesService.listMembers` 로 두 번째 적용됐으나 `spec/1-data-model.md` Rationale 결정 표에 정식 등재되지 않음 — 코드 주석 이력을 못 본 미래 검토자가 기각된 대안(①컬럼 `select:false`)의 재도입으로 오판할 위험 | `codebase/backend/src/modules/workspaces/workspaces.service.ts` L213-231 | `spec/1-data-model.md` Rationale 항목에 "쿼리 범위 select 투영(엔티티 전역과 구분)"을 4번째 옵션/③ 하위 각주로 명시, 두 사례 인용 |
| 2 | naming_collision | `WorkflowVersionDetail`(backend) → `WorkflowVersionDetailProjection` 개명은 이전 라운드(W3·W5)가 지적한 backend/frontend 동명이형 충돌을 실제로 **해소**한 변경 | `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` | 없음 — 반영 확인만 |
| 3 | naming_collision | `TRIGGER_ENDPOINT_PATH_CONFLICT`/`rethrowEndpointPathConflict` 는 신규 식별자가 아니라 기존 spec(§1.10, `2-trigger-list.md`, `2-api-convention.md`) 정의를 구현·e2e 가 그대로 재사용한 것 | `triggers.service.ts:1607,1627`, `webhook-trigger.e2e-spec.ts` B4 | 없음 |
| 4 | naming_collision | 신규 `repo-guards/__tests__/endpoint-path-conflict-wrap-*` 3파일 및 `tsconfig.build.json` exclude 추가는 기존 guard/exclude 컨벤션을 그대로 재현 | `codebase/backend/src/repo-guards/__tests__/**`, `tsconfig.build.json` | 없음 |
| 5 | cross_spec | `spec_impact` 표기가 실제 diff(spec 델타 0)와 어긋남 — 상단 WARNING #1 로 통합 처리됨 | `plan/in-progress/spec-followups-batch-b.md` | (WARNING #1 참고) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | 6개 관점(데이터모델·API계약·요구사항ID·상태전이·RBAC·계층책임) 전부 정합. spec 델타 0 확인, `1-data-model.md §2.1.1`·`3-error-handling.md §1.10` 대조 완료 |
| rationale_continuity | LOW | 기각된 대안 무단 재도입·합의 원칙 위반 없음. query-scoped select 투영 패턴의 Rationale 표 미등재만 INFO |
| convention_compliance | LOW | bare `hh_mm_ss` 리뷰 인용 재도입 1건(WARNING) 외 에러코드·DTO·명명 규약 전부 준수 |
| plan_coherence | LOW | B-1~B-8 과 상위 planner 문서 대응 정확, 병렬 세션 충돌 없음. `spec_impact` frontmatter 오기재만 WARNING |
| naming_collision | NONE | 신규 식별자 전수 유일성 확인, 기존 동명 충돌(`WorkflowVersionDetail`)은 오히려 이번 diff 가 해소 |

## 권장 조치사항
1. `plan/in-progress/spec-followups-batch-b.md` frontmatter `spec_impact` 를 `none` 으로 정정 (`complete/` 이동 전 필수 — 후속 세션이 `2-trigger-list.md` sort/order 미해결 항목을 오판하지 않도록).
2. `workflow-versions.service.ts` JSDoc 의 `16_29_00` bare 시각 인용을 `2026-09-06 16_29_00` 형태로 수정하거나, 팀 관행이면 `review-citations.md` §2 에 그 축약 형태를 추가.
3. (선택) `spec/1-data-model.md` Rationale 표에 "쿼리 범위 select 투영" 패턴을 정식 등재해 향후 오판 방지.
