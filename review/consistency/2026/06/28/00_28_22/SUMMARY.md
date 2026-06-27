# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 사유 없음.

## 전체 위험도
**LOW** — 전 checker Critical 0건. WARNING 5건(convention completeness 2건 + plan 미이행 2건 + naming 혼동 1건), INFO 8건. 기능적 invariant 위반 없음.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance | §3 신규 행이 같은 모듈의 다른 lowercase 코드(`workspace_not_found` · `user_not_found` · `admin_required`)를 미등재 — 명시적 레지스트리 completeness 불완전 | `error-codes.md §3` historical-artifact 레지스트리 | `error-codes.md §3` preamble("원칙을 따르지 않는 기존 코드를 명시적으로 등록한다") | `workspace_not_found` · `user_not_found` · `admin_required` 를 §3 에 추가 등록 |
| 2 | Convention Compliance | §3 예외 근거를 "클라이언트 분기 없는 모듈 일관성"으로 사실상 확장하는 결정이 `## Rationale` 에 기록되지 않음 | `error-codes.md ## Rationale` | CLAUDE.md "결정의 배경·근거는 Rationale 섹션에" | Rationale 에 "모듈 내 일관성 보존도 §3 예외 근거 허용" 취지 bullet 추가 |
| 3 | Plan Coherence | `exec-park-durable-resume` PR-B1 W3 이월 항목 미이행 — §3 서문에 "`skipReason` 등 운영 진단 enum 은 범위 밖"임을 명기하도록 권고됐으나 target 에 없음 | `error-codes.md §3` 서문 | `plan/in-progress/exec-park-durable-resume.md` L221 (W3: PR-B1 범위 밖 후속) | §3 서문 또는 Overview 에 "본 레지스트리는 `error.code` API surface 한정, 운영·진단 enum(`skipReason` 등)은 각 해당 spec 이 소유한다" 한 줄 추가. exec-park plan L221 체크 완료 처리 |
| 4 | Plan Coherence | `refactor/02-architecture.md` L440 open 항목(`INTEGRATION_INVALID_SERVICE (400)` 등재) 미이행 — 코드베이스 발행 중이나 `error-codes.md` 에 미등재 | `error-codes.md` 전체 (해당 코드 없음) | `plan/in-progress/refactor/02-architecture.md` L440 `[ ]` 체크박스 | `error-codes.md` 및 `spec/2-navigation/4-integration.md §9.4` 에 `INTEGRATION_INVALID_SERVICE (400)` 등재. refactor plan L440 완료 처리 |
| 5 | Naming Collision | `already_a_member`(lowercase, 초대 경로)와 `ALREADY_A_MEMBER`(UPPER, 직접 추가 경로)의 케이스 분리가 target §3 에서 처음 명문화됐으나, `spec/data-flow/12-workspace.md §1.2` 에 인라인 구분 표시 없어 cross-spec 독해 혼동 위험 | `spec/data-flow/12-workspace.md §1.2` (target 외부, 보완 대상) | `12-workspace.md §1.9` UPPER `ALREADY_A_MEMBER` vs §1.2 lowercase | `12-workspace.md §1.2` 의 `already_a_member` 표기에 "(초대 경로 한정 lowercase — §1.9 직접 추가 경로의 `ALREADY_A_MEMBER`(UPPER)와 별개, `error-codes.md §3` 등재)" 인라인 주석 추가 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `WORKSPACE_TYPE_MISMATCH`(UPPER, `workspaces.service.ts` 발행)가 구현 코드에는 존재하나 어떤 spec 에도 미등재 — 추적성 공백 | `error-codes.md §3` / `spec/data-flow/12-workspace.md` | `12-workspace.md §1.9` 또는 `spec/5-system/3-error-handling.md §1.3` 에 UPPER 변형 등재 또는 target §3 에 SoT 링크 보충 |
| 2 | Cross-Spec | `already_a_member`/`ALREADY_A_MEMBER` 이중 정의 — target §3 근거 링크가 `§1.9` 역참조 누락 | `error-codes.md §3` 해당 행 근거 열 | target §3 근거 열에 `12-workspace.md §1.9` 링크 추가 |
| 3 | Cross-Spec | `invitation_already_accepted` 가 resend·revoke 양쪽에서 발행되나 §3 설명이 "발급·재발송 API" 로만 기술 — revoke 경로 누락 | `error-codes.md §3` 해당 행 설명 | "재발송·취소(revoke) API" 로 범위 확장 기술 |
| 4 | Cross-Spec | `§3` `WORKER_HEARTBEAT_TIMEOUT` 행 근거에 `§1383` 비표준 섹션 번호 표기 — 편집 아티팩트로 추정 | `error-codes.md §3` `WORKER_HEARTBEAT_TIMEOUT` 행 | `§1383` 제거 또는 올바른 앵커(`4-execution-engine.md §7.1`)로 교체 |
| 5 | Cross-Spec | `§5` `LLM_CONFIG_NOT_FOUND → MODEL_CONFIG_DEFAULT_MISSING` rename 이력과 `3-error-handling.md §1.3` 설명이 동일 내용 중복 기술 — 모순 없음 | `error-codes.md §5` / `spec/5-system/3-error-handling.md §1.3` | 별도 수정 불필요 |
| 6 | Rationale Continuity | §3 신규 행의 12-workspace.md 링크가 단방향(12-workspace → error-codes)만 — 양방향 교차 참조 보강 여지 | `error-codes.md §3` 근거 열 | target §3 에 역참조 링크 추가 또는 12-workspace.md 에 역참조 추가 (선택적) |
| 7 | Plan Coherence | `WORKER_HEARTBEAT_TIMEOUT` 의미 재정의가 spec 합의 방향대로 문서화됐으나 PR4 구현 전 "절대 30분" 현 구현과 일시적 괴리 | `error-codes.md §3` `WORKER_HEARTBEAT_TIMEOUT` 행 | 행에 "현 구현 상태: 절대 30분 stale — Planned (PR4)" 주석 추가 (선택적) |
| 8 | Naming Collision | §4 내부 분류 코드 `EXECUTION_TIMEOUT` 과 엔진 레벨 동명 코드 — 레이어 주의 블록으로 이미 명시됨, 충돌 없음 | `error-codes.md §4` | 현행 유지 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | `WORKSPACE_TYPE_MISMATCH`(UPPER) spec 미등재 추적성 공백, `§1383` 비표준 참조 — 모두 INFO |
| Rationale Continuity | NONE | 기존 Rationale 합의 원칙 전부 올바르게 계승. INFO 2건(교차 참조 보강 여지) |
| Convention Compliance | LOW | WARNING 2건: §3 미등재 lowercase 코드(completeness), Rationale 확장 근거 누락 |
| Plan Coherence | LOW | WARNING 2건: exec-park W3 후속 미이행, INTEGRATION_INVALID_SERVICE 등재 미이행 |
| Naming Collision | LOW | WARNING 1건: cross-spec 독해 혼동 위험(12-workspace.md 보완 필요). target 자체 충돌 없음 |

## 권장 조치사항

1. **(WARNING 1 해소)** `error-codes.md §3` 에 `workspace_not_found` · `user_not_found` · `admin_required` 추가 등록 — 명시적 레지스트리 completeness 확보.
2. **(WARNING 2 해소)** `error-codes.md ## Rationale` 에 "모듈 내 일관성 보존도 §3 예외 근거 허용" 취지 bullet 추가.
3. **(WARNING 3 해소)** `error-codes.md §3` 서문 또는 Overview 에 "본 레지스트리는 `error.code` API surface 한정, 운영·진단 enum(`skipReason` 등)은 각 해당 spec 이 소유한다" 한 줄 추가. `exec-park-durable-resume.md` L221 체크 완료.
4. **(WARNING 4 해소)** `error-codes.md` 및 `spec/2-navigation/4-integration.md §9.4` 에 `INTEGRATION_INVALID_SERVICE (400)` 등재. `refactor/02-architecture.md` L440 완료 처리.
5. **(WARNING 5 해소, 선택적)** `spec/data-flow/12-workspace.md §1.2` `already_a_member` 표기에 케이스 분리 인라인 주석 추가.
6. **(INFO 1, 선택적)** `WORKSPACE_TYPE_MISMATCH`(UPPER) 를 `12-workspace.md §1.9` 또는 `3-error-handling.md §1.3` 에 등재하거나 `error-codes.md §3` SoT 링크 보충.
7. **(INFO 4, 선택적)** `error-codes.md §3` `WORKER_HEARTBEAT_TIMEOUT` 행의 `§1383` 을 올바른 앵커로 교체.
