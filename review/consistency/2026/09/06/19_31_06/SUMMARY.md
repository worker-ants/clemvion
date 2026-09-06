# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원 CRITICAL 0건. 신규 WARNING 2건은 모두 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 developer/planner 항목으로 등재된 추적 중 사안이며, 이번 PR 이 그 결정을 우회·은폐하지 않았다.

## 전체 위험도
**LOW** — 신규 미인지 충돌 없음. `details.code` 표현 이원화(2개 checker 중복 지적)와 `WorkflowVersionDetail` 프런트/백엔드 형태 불일치(naming_collision)만 잔존, 둘 다 이미 tracked.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, rationale_continuity, convention_compliance, naming_collision (4개 중복 지적, 최강 등급 반영) | 409 `RESOURCE_CONFLICT` 세부 코드 표현이 두 관례로 공존 — `TRIGGER_ENDPOINT_PATH_CONFLICT` 를 `details.code`(단일 object) 로 신설했으나, 저장소 선례 7건은 top-level `code` 자체를 특화 코드로 치환하고, `error-codes.md §4.2` 는 `details` 를 array 로 정의 | `spec/2-navigation/2-trigger-list.md` §3 + `codebase/backend/.../triggers.service.ts` `rethrowEndpointPathConflict()` | `spec/5-system/2-api-convention.md §5.3`(details 배열 정의, 413 치환 선례) | 조치 불요 — `plan/in-progress/spec-draft-nullable-notation-followups.md:631` 에 이미 planner 항목(택일 기준 정식화)으로 등재. 후속 라운드에서 완료 여부만 확인 |
| 2 | naming_collision | `WorkflowVersionDetail` 동명 타입이 frontend(`workflows.ts:124`, optional/nullable 넓은 형태)와 backend(`workflow-versions.service.ts`, 3필드 고정 좁은 형태)에 별도 선언되어 계약이 다름 — 공유 타입 미경유 | `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` | `codebase/frontend/src/lib/api/workflows.ts:124` | 조치 불요 — `plan/in-progress/spec-draft-nullable-notation-followups.md:616` 에 개명(`WorkflowVersionDetailProjection` 등)·공유 타입 승격 방안 등재. 향후 이 타입 재편집 시 개명 확정 상기 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `WorkspaceMemberDto.joinedAt` 신규 응답 필드가 `9-user-profile.md` UI 서술에 아직 미반영(doc-sync 지연). `data-model.md` 와는 정합 | `codebase/backend/.../workspace-response.dto.ts` / `spec/2-navigation/9-user-profile.md §4` | 다음 `9-user-profile.md` 편집 시 `joinedAt` 노출 여부·표시 위치 추가 |
| 2 | plan_coherence | `2-trigger-list.md` 의 3건 자기모순(R-2 폐기 설계 잔존, frontmatter status vs 본문 모순, botToken 행 모순)은 새 충돌이 아니라 이미 `spec-draft-nullable-notation-followups.md` 에 이월된 미결 | `spec/2-navigation/2-trigger-list.md` R-2/§3/§2.3.1 | 조치 불요, 참고로만 남김 — 다음 planner 턴이 이어받음 |
| 3 | plan_coherence | `2-trigger-list.md §2.3.1` 이 가리키는 참조 plan `eia-trigger-edit-ui` 가 존재한 적 없는 죽은 포인터 — 실제 기능은 3개월 전 이미 구현됨(`external-interaction-card.tsx`, #674) | `spec/2-navigation/2-trigger-list.md:101` | 다음 planner 턴에서 "별 plan 대기" 문구 제거, 구현 파일 참조로 정정 (이 PR 과 무관한 선재 결함, 차단 사유 아님) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | scope 델타 0. 트리거 409 계약 구현 확인, `details.code` 표현 이원화(tracked), `joinedAt` doc-sync 지연(INFO) |
| rationale_continuity | LOW | 트리거 구현이 §3 기존 문구를 실현한 것으로 과거 결정 번복 아님. `details.code` tension 은 개발자 자신이 투명 등재 |
| convention_compliance | NONE | 신규 CRITICAL/WARNING 없음. 직전 라운드 WARNING(Swagger `@ApiConflictResponse` 누락)은 `e008dd009` 커밋에서 이미 해소 확인 |
| plan_coherence | LOW | 트리거 구현이 미해결 결정 우회 없음. 기존 3건 자기모순은 정상 이월. `eia-trigger-edit-ui` 죽은 plan 포인터는 선재 결함(WARNING) |
| naming_collision | LOW | 트리거/워크스페이스 신규 식별자는 spec과 일치. `WorkflowVersionDetail` 동명이형(WARNING, tracked), `details.code` 관례 미정식화(INFO, tracked) |

## 권장 조치사항
1. (BLOCK 해소 대상 없음 — 진행 가능)
2. `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 두 등재 항목(§5.3 택일 기준 정식화, `WorkflowVersionDetail` 개명)이 다음 라운드에서 실제로 닫히는지 확인.
3. 다음 `spec/2-navigation/` 편집 turn 에서 `9-user-profile.md` 의 `joinedAt` 노출 서술과 `2-trigger-list.md` 의 `eia-trigger-edit-ui` 죽은 포인터를 함께 정정.
