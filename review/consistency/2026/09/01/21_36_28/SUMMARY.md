# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원(cross_spec / rationale_continuity / convention_compliance /
plan_coherence / naming_collision) 결과를 모두 확보했고, Critical 등급 발견은 없다.

## 전체 위험도
**LOW** — target(`plan/in-progress/spec-draft-error-code-two-surfaces.md`, `spec/conventions/error-codes.md`
§Overview 에 `EngineErrorCode` surface 병기)는 실측·인용 정확도가 높은 좁은 범위 편집이며, 지적된
사항은 WARNING 1건(카탈로그 SoT 경계 재선언 위험)과 INFO 4건(plan 위생·교차 인용 보강 제안)뿐이다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | §Overview 변경 제안이 문서 자신이 `3-error-handling.md §1` 에 위임해 둔 "카탈로그·분류(어느 surface 가 어느 필드에 실리는가)" 사실을 목적지 필드까지 구체적으로 재선언한다. 특히 `EngineErrorCode` 는 코드별로 목적지가 다르다(`EXECUTION_QUEUE_WAIT_TIMEOUT` 은 `Execution.error` 에만, `SERVER_INTERRUPTED` 는 양쪽에 실림) — Overview 의 뭉뚱그린 "둘 다에 싣는다" 서술이 향후 카탈로그 SoT 와 조용히 어긋날 위험 | `plan/in-progress/spec-draft-error-code-two-surfaces.md` `## 변경 제안` 불릿 2~3 | `spec/conventions/error-codes.md` §Overview 자신의 책임 경계 선언 + `spec/5-system/3-error-handling.md §1`(카탈로그 SoT) + `codebase/backend/src/nodes/core/error-codes.ts:147-171` (코드별 목적지 상이) | (a) 목적지 필드를 빼고 "노드 핸들러 층 대표 surface" / "엔진 층 대표 surface" 정도로만 병기하거나, (b) 목적지를 유지하려면 `EngineErrorCode` 값마다 다르다는 점을 숨기지 않도록 완화하고 카탈로그 SoT 로 링크 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `spec/5-system/4-execution-engine.md:1143`/`:1800` §Rationale 이 `EngineErrorCode` 신설을 아직 반영하지 않은 선재 drift (target 이 만든 것 아님, 착수 근거 plan 이 이미 인지·유예) | `4-execution-engine.md` (target 편집 범위 밖) | 조치 불필요. 향후 그 문서를 편집할 사람이 참고하도록 기록만 |
| 2 | rationale_continuity | §3 예외 레지스트리의 `WORKER_HEARTBEAT_TIMEOUT` 행이 이미 `EngineErrorCode` 멤버를 다루고 있어 target 주장을 뒷받침하는 추가 증거가 됨 | `spec/conventions/error-codes.md` §3 | §Overview 편집 시 이 선례를 각주로 걸면 "기존 실무의 명문화" 임이 더 분명해짐 (선택) |
| 3 | rationale_continuity | "판단 기준은 이번에 안 쓴다" 결정이 두 plan 문서(target, 착수 근거 plan)에 중복 서술돼 SoT 불명확 | target `## 판단 기준은 이번에 안 쓴다` | 착수 근거 plan 을 SoT 로 정하고 target 은 포인터화 |
| 4 | plan_coherence | 착수 근거 plan `spec-conventions-engine-error-code-surface.md` 의 `worktree:` frontmatter 가 여전히 `(unstarted)` sentinel — 실제로는 `easy-a-harness-hygiene` 에서 수정 중 | `plan/in-progress/spec-conventions-engine-error-code-surface.md` frontmatter | `worktree: easy-a-harness-hygiene` 로 갱신 (낮은 비용) |
| 5 | plan_coherence | spec 반영 시점에 착수 근거 plan 체크리스트 갱신 + 두 plan 의 `complete/` 이동 동기화 절차가 아직 명시돼 있지 않음 | target 전체 (draft 자체에 종결 절차 서술 없음) | spec 반영 커밋에서 두 plan 체크리스트를 갱신하고, 완료 조건 충족 시 함께 `plan/complete/` 로 이동 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | `EngineErrorCode` 신설을 `4-execution-engine.md` §Rationale 이 아직 반영 못한 선재 drift(target 책임 아님) 외 충돌 없음 |
| rationale_continuity | LOW | 인용·근거 정확, 결정 번복·invariant 우회 없음. 경미한 중복 기록 2건만 |
| convention_compliance | LOW | 형식 요건(frontmatter/spec_impact/파일명) 전부 충족. 카탈로그 SoT 경계 재선언 WARNING 1건 |
| plan_coherence | LOW | 착수 근거 plan 과 결정·인용 정확히 일치. plan 위생 INFO 2건만 |
| naming_collision | NONE | `ErrorCode`/`EngineErrorCode` 모두 코드베이스 기존 식별자 재사용/최초 문서화일 뿐 충돌 없음 |

## 권장 조치사항
1. (WARNING 해소) `## 변경 제안` 불릿에서 목적지 필드 서술 수준을 낮추거나, `EngineErrorCode` 값별 목적지 상이함을 반영하고 카탈로그 SoT(`3-error-handling.md §1`)로 링크한다.
2. (plan 위생) 착수 근거 plan `spec-conventions-engine-error-code-surface.md` 의 `worktree:` sentinel 을 `easy-a-harness-hygiene` 로 갱신한다.
3. (plan 위생) spec 반영 커밋에서 착수 근거 plan 체크리스트를 갱신하고, 완료 시 두 plan 을 함께 `plan/complete/` 로 이동한다.
4. (선택) §Overview 편집 시 §3 `WORKER_HEARTBEAT_TIMEOUT` 선례를 각주로 인용해 "기존 실무의 명문화" 임을 명시한다.