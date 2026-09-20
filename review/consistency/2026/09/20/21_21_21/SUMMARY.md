# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (5개 checker 전원 전문 확보, WARNING 2 · INFO 6)

## 전체 위험도
**LOW** — `spec/2-navigation` 자체는 변경되지 않았고(델타 0), 트리거 삭제 §4.4 선례를 워크플로/워크스페이스에 확장한 코드 전용 수정. 실질 갭은 인접 문서(`data-flow/12-workspace.md`) 로그 서술 stale 1건과 §4.4 자체의 미검증 단정 서술 1건.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음) — 이번 검토에서 CRITICAL 판정이 없어 인계 대상 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | `parentPresence === 'absent'` 단락 시 로그를 생략하도록 바뀌었으나, 인접 문서가 "재검사 거부 **포함**" 모든 실패를 로그에 남긴다고 무조건 서술 — 부분적으로 stale | `codebase/backend/src/modules/workspaces/workspaces.service.ts` `deleteWorkspace()` `.catch` 블록 (impl-done scope 밖이지만 target 구현이 만든 동작) | `spec/data-flow/12-workspace.md §1.10` DELETE 행 로그 서술 | §1.10 문장에 "동시 삭제로 부모가 이미 사라진 경우(404 `WORKSPACE_NOT_FOUND`)는 예외이며 로그를 남기지 않는다" 를 추가. planner 턴에서 처리. 기존 tracker(`plan/in-progress/spec-draft-nullable-notation-followups.md:4761`, 대칭 서술 누락)에 이 로그-억제 뉘앙스를 보강 |
| 2 | plan_coherence | `spec/2-navigation/2-trigger-list.md §4.4` "동시 삭제 → 두 번째 404" 가 확정 사실로 서술되지만, 그 선례 자체가 실측 미검증임을 같은 plan 문서가 스스로 반증(`TriggersService.remove()` 가 동일 결함 구조 보유 가능성, 실제로는 200+중복 감사로 끝날 수 있음) | `spec/2-navigation/2-trigger-list.md:318` (§4.4 결과·에러) | `plan/in-progress/spec-draft-nullable-notation-followups.md:4753-4759` (미체크, developer 항목, 2026-09-20 등재) | §4.4 에 "구현 검증 대기 — 상세는 `spec-draft-nullable-notation-followups.md` 참고" caveat 추가, 또는 최소한 해당 plan 항목에 "실측 결과에 따라 §4.4 문구 정정 여부도 함께 판단" 을 명시 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `1-workflow-list.md §2.6`(워크플로 삭제)도 §4.4 와 동일한 "동시 삭제 → 두 번째 404" 대칭 서술 없음 | `spec/2-navigation/1-workflow-list.md §2.6` | `plan/in-progress/spec-draft-nullable-notation-followups.md:4761` 항목이 이미 커버 — 별도 조치 불요, 처리 시 함께 반영 |
| 2 | rationale_continuity | 위 §2.6/§1.10 대칭 서술 누락 재확인 — 이미 3라운드 연속 비차단(INFO) 처분됨 | `spec/2-navigation/1-workflow-list.md §2.6`, `spec/data-flow/12-workspace.md §1.10` | 추가 조치 불요, 기록 목적 |
| 3 | rationale_continuity | 워크스페이스 삭제 재검사 순서 예외(동시 삭제 race 는 403 대신 404)가 spec `## Rationale` 이 아니라 코드 주석에만 근거 | `codebase/backend/src/modules/workspaces/workspaces.service.ts` `deleteWorkspace()` (~525-535줄) | `assertWorkspaceDeletable()` 판정 순서 자체를 다음에 건드릴 때 이 예외 조건을 JSDoc 에도 한 줄 반영 |
| 4 | plan_coherence | tracker(`spec-draft-nullable-notation-followups.md:4741-4751`)는 이미 "2026-09-20 해소" 로 `[x]` 처리했지만, `dup-delete-audit.md` 자체 체크리스트(109-111줄) 3항목은 아직 `[ ]`, `plan/complete/dup-delete-audit.md` 도 미존재 | `plan/in-progress/dup-delete-audit.md` 체크리스트 | push 전 마무리 커밋에서 체크 3항목 + `plan/complete/` 이동을 함께 수행 |
| 5 | plan_coherence | `--impl-prep` W2 교차참조가 열린 항목 #1(4501줄, advisory lock 후속)이 아니라 이미 닫힌 "동시 중복 DELETE" 항목의 부기(4751줄)에만 적힘 | `spec-draft-nullable-notation-followups.md:4492-4511`(열린 항목 #1) | 항목 #1 표 행에도 "반환 계약이 `{ parentPresence, triggerIds }` 로 바뀜(`dup-delete-audit.md`, 2026-09-20)" 한 줄 추가해 양방향 참조로 |
| 6 | convention_compliance | 트리거 문서(§4.4)와의 표현 일관성을 원하면 `1-workflow-list.md §3`/워크스페이스 spec 에도 "동시 삭제 → 두 번째 404" 문구를 additive 로 얹는 것을 고려 가능(강제 아님, `api-convention §5.3` 404 기본값으로 이미 커버됨) | `spec/2-navigation/1-workflow-list.md §3` | 위 INFO#1 tracker 처리 시 함께 반영 가능, 별도 필수 아님 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | `data-flow/12-workspace.md §1.10` 로그 서술 stale(WARNING) · `1-workflow-list.md §2.6` 대칭 서술 누락(INFO, 기존 tracker) |
| rationale_continuity | LOW | 기존 §4.3/§4.4 결정과 정합, 번복·기각 대안 재도입 없음. 대칭 서술 누락 재확인 + 재검사 순서 예외 근거 위치(INFO 2건) |
| convention_compliance | NONE | 신규 에러 코드·DTO 없음, 기존 `RESOURCE_NOT_FOUND`/`WORKSPACE_NOT_FOUND` 재사용. 위반 없음 |
| plan_coherence | LOW | §4.4 선례가 실측 미검증 상태로 단정 서술(WARNING) · tracker-체크리스트 동기화 지연 2건(INFO) |
| naming_collision | NONE | 신규 식별자(`LockedParentTriggers`, `parentPresence`, e2e 파일 2개) 전부 grep 상 충돌 없음 |

## 권장 조치사항
1. (WARNING #1) `spec/data-flow/12-workspace.md §1.10` 로그 서술에 `parentPresence==='absent'` 예외 반영 — planner 턴.
2. (WARNING #2) `spec/2-navigation/2-trigger-list.md §4.4` 에 구현 검증 대기 caveat 추가하거나, 관련 plan 항목(`spec-draft-nullable-notation-followups.md:4753-4759`)에 "§4.4 문구 정정 여부도 함께 판단" 명시.
3. (INFO #1/#6) `1-workflow-list.md §2.6`·`§3` 대칭 서술 보강은 기존 tracker 항목 처리 시 함께.
4. (INFO #4) push 전 마무리 커밋에서 `dup-delete-audit.md` 체크리스트 3항목 체크 + `plan/complete/` 이동.
5. (INFO #5) `spec-draft-nullable-notation-followups.md` 열린 항목 #1 표 행에 반환 계약 변경 교차 참조 추가.
