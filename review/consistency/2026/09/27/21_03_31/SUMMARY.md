# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원 전문 확보(재시도 필요 없음). Critical 발견 없음. 1·2차 `--impl-prep` 이 지적했던 두 Critical(`1-workflow-list.md` §3.1·Rationale §3, `data-flow/11-workflow.md` §1.2 각주)은 `a8bfd1492`→`18f235a81` 두 planner 턴으로 해소 확인(5개 checker 전원 재판정 일치).

## 전체 위험도
**LOW** — 새 Critical 없음. 신설 invariant(`spec/1-data-model.md §1.1`)의 전파 누락(WARNING 2건)과 Rationale 내부 미표시 모순(WARNING 1건)이 주된 잔여 리스크.

## Critical 위배 (BLOCK 사유)

(없음 — 5개 checker 전원 Critical 미발견. 재판정 대상이던 두 문장은 모두 현재 규칙과 정합.)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, rationale_continuity, plan_coherence (통합) | `spec/1-data-model.md §1.1` 신설 invariant("서버는 저장 전에 거부한다")가 트리거·스케줄·알림규칙 `workflowId`(plan 자신의 §전수 표에서 "다른 워크스페이스에 작용" 최고 심각도로 분류) 및 `5-knowledge-base.md` 의 `extractionLlmConfigId`/`rerankConfigId`/`rerankLlmConfigId`(현재 조용히 강등/실패, 400 거부 아님)까지 명시하는데, 이를 서술하는 형제 spec 문서들이 아직 이 검사를 반영도 추적도 하지 않는다. "documented guarantee wider than built" 유형 — 단 유예 자체는 방치가 아니라 `plan/in-progress/spec-draft-nullable-notation-followups.md`("교차 워크스페이스 참조 후속" 항목, 1491-1494행)가 "구현 착지 후 반영" 으로 명시 유예해 둔 결정이다. 문제는 그 유예가 `cross-workspace-refs.md` 자신의 "이 PR 밖으로 넘기는 것" 절에는 교차 인용되어 있지 않다는 점 | `spec/2-navigation/2-trigger-list.md` §2.5·§3, `3-schedule.md` §4, `9-user-profile.md` §6.3; `spec/2-navigation/5-knowledge-base.md`; `spec/1-data-model.md` §1.1 | `plan/in-progress/cross-workspace-refs.md` `spec_impact`/`pending_plans` (5개 파일만 등재, 위 4개 문서 누락); `plan/in-progress/spec-draft-nullable-notation-followups.md` | `cross-workspace-refs.md` §"이 PR 밖으로 넘기는 것"에 "트리거/스케줄/알림/KB nav 문서 §1.1 미러는 구현 착지 후 별도 턴 — 추적: `spec-draft-nullable-notation-followups.md` '교차 워크스페이스 참조 후속'" 한 줄 추가(developer 가 plan/** 직접 수정 가능, planner 턴 불요). 보조로 `1-data-model.md` §1.1 서두에 "행마다 구현 상태가 다를 수 있다 — 미완료는 위 plan 참조" 한 줄 추가 |
| 2 | rationale_continuity | `spec/2-navigation/1-workflow-list.md` `## Rationale` §3 안에서 2026-07-05 원문 불릿(198행, "세 위반(같은 워크스페이스·순환·깊이) 모두 생성 경로와 동일한 `VALIDATION_ERROR` 를 재사용한다")이 3줄 아래 2026-09-27 정정 문단(201행, "이 결정 뒤에도 생성 경로는 깊이만 봤다")과 정면으로 모순되는데도 취소선·각주 없이 그대로 공존한다. 순서대로 읽거나 이 Rationale 을 근거로 인용하는 다음 PR 이 198행만 보고 "생성 경로도 이미 워크스페이스를 검사해왔다"고 오독할 수 있다 | `spec/2-navigation/1-workflow-list.md` §Rationale §3, 198행 | 같은 섹션 201행 "(2026-09-27 정정)" 문단 | 198행의 "같은 워크스페이스" 부분을 취소선 처리하거나 "(2026-09-27 정정 참고)" 각주를 인접시켜 두 문단이 서로를 가리키게 함 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec, convention_compliance (통합) | `authConfigId` 미스매치 오류 표현이 "400 `VALIDATION_ERROR` 또는 `AUTH_CONFIG_NOT_FOUND`" 로 이중적이고 두 번째 코드의 HTTP status 가 생략됨 — `git log -S` 확인 결과 2026-05-28(`54fcc827a`)부터 있던 기존 문구로 이번 PR diff 밖 | `spec/2-navigation/2-trigger-list.md` §3 (`PATCH /api/triggers/:id`) | 다음에 이 문서를 만질 때 "또는" 제거 + "400 `AUTH_CONFIG_NOT_FOUND`" 로 status 반복 명시해 §1.11 의 "이름은 `_NOT_FOUND` 지만 404 아님" 을 이 문서만 읽어도 드러나게 함 |
| 2 | convention_compliance | `details[]` 필드 단위 어노테이션이 비대칭 — `PATCH /api/folders/:id` 의 세 위반(워크스페이스·순환·깊이) 중 워크스페이스 사유만 `details[].field='parentId'` 표기, 순환/깊이는 미표기. Rationale §3 은 셋을 대칭으로 서술 | `spec/2-navigation/1-workflow-list.md` §3.1 `PATCH /api/folders/:id` 행 | 순환·깊이 사유에도 동일 표기를 추가하거나 차이 사유를 한 줄로 명시 |
| 3 | plan_coherence | `1-workflow-list.md` §3.1 신규 행(생성/PATCH 소속 검사)에 같은 문서 §2.1/§2.7/§3.2 가 이미 쓰는 "미구현 (Planned)" 라벨 관례가 빠져 있어, 표만 보면 이미 동작하는 것처럼 읽힘 | `spec/2-navigation/1-workflow-list.md` §3.1 | pending_plans/Rationale 정정 문단이 실질적으로 같은 신호를 이미 주므로 저우선 — 구현 커밋에서 함께 정리 가능 |
| 4 | naming_collision | "cross-workspace" 어휘가 신규 저장-전 소속 검사(§1.1, 계층: 쓰기 시점)와 기존 실행-시점 sub-workflow 격리 guard(`assertSameWorkspace`/`WORKFLOW_FORBIDDEN_WORKSPACE`, W-6)를 모두 가리켜 개념적으로 인접 — 식별자 자체는 겹치지 않으나 향후 구현자가 같은 이름으로 재명명하거나 두 가드를 혼동할 위험 | `spec/1-data-model.md §1.1` vs `spec/4-nodes/2-flow/1-workflow.md:75,273`, `spec/5-system/3-error-handling.md:149` | 구현 단계에서 신규 저장-전 검사 헬퍼명을 `assertSameWorkspace` 와 구분되는 이름(예: `assertRequestRefBelongsToWorkspace`)으로 명명하도록 impl-prep 인수인계에 남김 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | 재판정 대상 두 Critical 정합 확인. `1-data-model.md` §1.1 이 미구현 4영역까지 현재형으로 단언(WARNING), `authConfigId` 코드 이중표현(INFO, 기존 문구) |
| rationale_continuity | LOW | 재판정 정합, 재발 없음. Rationale §3 내부 모순 미표시(WARNING), 신설 invariant 의 형제 spec 전파 누락(WARNING) |
| convention_compliance | NONE | 이번 PR 실질 diff(`1-workflow-list.md`)가 SoT(`1-data-model.md §1.1`, `2-api-convention.md §5.3`)와 완전 정합. INFO 2건(비대칭 어노테이션, 코드 표현 생략)만 |
| plan_coherence | LOW | 재판정 RESOLVED. `workflowId` 미러 갭은 별도 tracker 로 유예 문서화돼 있으나 자기완결성 부족(WARNING), "(Planned)" 라벨 누락(INFO) |
| naming_collision | LOW | 신규 식별자(§1.1, 신규 e2e 파일) grep 전수 확인 결과 기존과 충돌 없음. "cross-workspace" 어휘 인접만 INFO |

## 권장 조치사항
1. `plan/in-progress/cross-workspace-refs.md` §"이 PR 밖으로 넘기는 것"에 트리거/스케줄/알림규칙/KB `workflowId` 계열 미러가 `spec-draft-nullable-notation-followups.md` 로 유예돼 있다는 한 줄 교차인용 추가 (developer 가 plan/** 직접 수정 가능).
2. `spec/2-navigation/1-workflow-list.md` Rationale §3 198행을 취소선 또는 각주로 201행 정정 문단과 상호참조.
3. (선택) `spec/1-data-model.md` §1.1 서두에 "행마다 구현 상태가 다를 수 있다" 한 줄을 추가해 `status: implemented` 가 표 전체 즉시 강제를 뜻하지 않음을 문서 자체로 방어.
4. 낮은 우선순위(다음 해당 문서 편집 시 함께 정리): `2-trigger-list.md` §3 `authConfigId` 코드 표현 정리, `1-workflow-list.md` §3.1 순환/깊이 `details[].field` 표기 보강, 같은 표 행에 "(Planned)" 라벨 추가, 구현 단계에서 신규 헬퍼 명명 시 `assertSameWorkspace` 와 구분.