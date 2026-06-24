# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 함

## 전체 위험도
**CRITICAL** — plan/in-progress 에 "project-planner 위임" 으로 명시된 미결정 사항(W7 SPEC-DRIFT 수정)을 developer 가 planner 합의 없이 일방 집행

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Plan Coherence | plan 에 "합산/spec 정정 결정은 project-planner 위임"으로 명시된 미결정 사항을 developer 가 일방적으로 집행 — `toolCallCount++` 제거로 pre-existing 동작을 실제 변경 | `ai-turn-executor.ts` `recordMultiTurnNonProviderToolResults` | `plan/in-progress/refactor/03-maintainability.md §C-2 (W7 항목)` | 사후 승인 경로: project-planner 가 W7 결정(spec §7.1 정합화, toolCallCount++ 제거)을 공식 승인하고 03-maintainability.md §C-2 W7 항목을 "완료(planner 승인 날짜)"로 갱신. 또는 롤백 경로: toolCallCount++ 복원 + [SPEC-DRIFT] 주석 재삽입 후 planner 결정 대기. |

## 경고 (WARNING)

해당 없음.

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | spec §7.1 `meta.toolCalls` 정의와 정합 확인됨 — 이번 변경으로 SPEC-DRIFT 해소 | `ai-turn-executor.ts` `recordMultiTurnNonProviderToolResults` | 해소 완료, 추가 조치 불필요 |
| 2 | Cross-Spec | `maxToolCalls` config 정의(조건 도구 미합산)와 budget 차감 로직 정합 확인됨 | 동일 파일 | 추가 조치 불필요 |
| 3 | Cross-Spec | JSDoc §3.f-g → §6.1.f-g 섹션 번호 갱신 — spec 실제 위치와 정렬 | `recordSingleTurnNonProviderToolResults` JSDoc | 추가 조치 불필요 |
| 4 | Cross-Spec | `TOOL_BUDGET_EXCEEDED_ERROR` 상수화 — 외부 에러코드 enum과 레이어 분리 명확화, 충돌 없음 | `ai-turn-executor.ts` line 554 | 추가 조치 불필요 |
| 5 | Rationale Continuity | W6 리뷰 코드 주석 "INVARIANT — 동기화 금지"는 spec §12 Rationale 에 없는 임시 drift 보존 제약이었음 — W7 변경 방향은 spec §7.1 Rationale 과 정합 | `ai-turn-executor.ts` 제거된 JSDoc 블록 | spec `1-ai-agent.md §12` 에 "W7 SPEC-DRIFT 해소: W6 INVARIANT 주석은 임시 보존이었고 spec §7.1 과 충돌하지 않음" INFO 이력 추가 권장 (의무 아님) |
| 6 | Convention Compliance | `TOOL_BUDGET_EXCEEDED_ERROR` JSDoc 이 `spec/conventions/error-codes.md §4` 를 cross-reference 하지 않음 (규약 위반은 아님) | `ai-turn-executor.ts` 신규 JSDoc | JSDoc 에 `(spec/conventions/error-codes.md §4 — internal 전용, §1 적용 범위 밖)` 참조 추가 권장 (선택적) |
| 7 | Naming Collision | `TOOL_BUDGET_EXCEEDED_ERROR` 상수, `condRouteDurationMs` 지역 변수, 신규 테스트 설명 — 모두 기존 코드베이스·spec·plan 과 충돌 없음 | `ai-turn-executor.ts`, `ai-turn-executor.spec.ts` | 추가 조치 불필요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | spec §7.1 정합화 확인, 6개 관점 모두 충돌 없음 |
| Rationale Continuity | NONE | W7 변경이 spec Rationale 을 위반하지 않고 오히려 복원함. W6 INVARIANT 는 임시 drift 보존이었음 |
| Convention Compliance | NONE | 직접 규약 위반 없음. TOOL_BUDGET_EXCEEDED_ERROR 는 error-codes.md §4 적용 범위 밖 내부 코드 |
| Plan Coherence | CRITICAL | plan 에 "project-planner 위임" 명시된 W7 결정을 developer 가 일방 집행 — pre-existing 동작 변경 |
| Naming Collision | NONE | 신규 식별자 3건 모두 단일 파일 스코프 내, 기존 식별자와 충돌 없음 |

## 권장 조치사항

1. **(BLOCK 해소 필수)** project-planner 가 W7 결정(spec §7.1 정합화, `toolCallCount++` 제거)의 사후 승인을 공식화하고, `plan/in-progress/refactor/03-maintainability.md §C-2` W7 항목을 "완료(2026-06-25 planner 승인)" 로 갱신한다. 이 경로를 택하면 현 구현은 유효하며 BLOCK 이 해소된다.
2. **(대안 — 롤백)** planner 위임을 준수하려면 `recordMultiTurnNonProviderToolResults` 내 `toolCallCount++` 를 복원하고 `[SPEC-DRIFT]` 주석을 재삽입한 후 planner 결정을 기다린다.
3. **(선택적 이력 강화)** `spec/4-nodes/3-ai/1-ai-agent.md §12 Rationale` 에 "W7 SPEC-DRIFT 해소 이력 — W6 INVARIANT 주석의 임시 성격" 을 INFO 항목으로 추가해 향후 리뷰어 혼선 방지.
4. **(선택적 가독성 향상)** `TOOL_BUDGET_EXCEEDED_ERROR` 상수 JSDoc 에 `spec/conventions/error-codes.md §4` cross-reference 추가.