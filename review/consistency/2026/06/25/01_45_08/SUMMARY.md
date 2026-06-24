# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 사유 없음.

## 전체 위험도
**LOW** — pre-existing SPEC-DRIFT 가시화(WARNING 2건) 외 신규 계약 위반 없음. behavior-preserving 리팩터로 spec 신규 위반 미도입.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W1 | Cross-Spec | multi-turn condition deferral `toolCallCount++` 가 spec §7.1 `meta.toolCalls` "조건 도구 제외" 정의와 불일치 (pre-existing SPEC-DRIFT 가시화) | `ai-turn-executor.ts` — `recordMultiTurnNonProviderToolResults` 내 `toolCallCount++` on condition deferral | `spec/4-nodes/3-ai/1-ai-agent.md §7.1` `meta.toolCalls` "KB·MCP·일반 도구 호출 횟수 합산 (조건 도구 제외)" | planner 가 spec §7.1/§7.6 을 검토해 (a) multi-turn 도 "조건 도구 제외"로 통일하거나 (b) 단/멀티 비대칭을 명시 note 추가 |
| W2 | Rationale Continuity | multi-turn condition deferral 의 `toolCallCount` 합산이 spec `## Rationale` 에 공식 기록 없이 코드 주석에만 잔존 — spec 단일 진실 원칙과 괴리 | `ai-turn-executor.ts` `recordMultiTurnNonProviderToolResults` JSDoc 및 INVARIANT 블록 `[SPEC-DRIFT]` 주석 | `spec/4-nodes/3-ai/1-ai-agent.md §7.1 ## Rationale` | spec §7.1 의 `meta.toolCalls` 설명 또는 `## Rationale` 에 "multi-turn condition deferral pre-existing 합산 이유 / 해소 방향 백로그" 항 추가, 또는 플래너가 별도 spec-drift plan 항목으로 정식 등록 |

*W1·W2 는 동일 pre-existing SPEC-DRIFT(multi-turn `toolCallCount++`)를 Cross-Spec / Rationale 두 각도에서 지적한 것으로, 가장 강한 등급(WARNING)으로 통합됨. 리팩터 신규 도입이 아니며 코드 내 `[SPEC-DRIFT]` 주석과 plan 백로그로 이미 추적 중.*

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I1 | Cross-Spec | JSDoc 의 `§3.f-g` 참조 표기가 spec 실제 섹션 번호와 불일치 (비공식 축약) | `ai-turn-executor.ts` `recordSingleTurnNonProviderToolResults` / `recordMultiTurnNonProviderToolResults` JSDoc | JSDoc 참조를 `spec §6.1 도구 루프 단계 3.f/3.g` 로 정정 권장 (빌드·동작 영향 없음) |
| I2 | Convention Compliance | `tool_call_budget_exceeded` 상수 값이 `lower_snake_case` — error-codes.md 는 `UPPER_SNAKE_CASE` 요구 (단, LLM-internal tool_result 신호로 외부 API 계약에 미노출) | `ai-turn-executor.ts` line 550 `TOOL_BUDGET_EXCEEDED_ERROR` 상수 값 | 값을 `'TOOL_CALL_BUDGET_EXCEEDED'`(UPPER_SNAKE_CASE)로 변경하거나 JSDoc 에 "LLM-internal signal, not a public error code" 명시 |
| I3 | Naming Collision | `TOOL_BUDGET_EXCEEDED_ERROR` 상수와 `executeProviderToolBatch`(line 962) 내 동일 문자열 인라인 리터럴이 이중 표현 — 의미 충돌 아님, 일관성 보완 | `ai-turn-executor.ts` line 962 인라인 `'tool_call_budget_exceeded'` | line 962 인라인 리터럴도 `TOOL_BUDGET_EXCEEDED_ERROR` 상수 참조로 교체 (별도 PR 또는 동일 PR 정리 커밋) |
| I4 | Rationale Continuity | `TurnOutputAccumulators` 인터페이스 ISP 경계 완화 판단 근거가 코드 JSDoc 에만 존재 | `ai-turn-executor.ts` `TurnOutputAccumulators` JSDoc | 리뷰 RESOLUTION 문서에 "W5 — ISP 완화 승인, TurnOutputAccumulators 채택" 명시로 충분 (spec Rationale 신설 불필요) |
| I5 | Plan Coherence | W7 SPEC-DRIFT 추적 항목이 별도 planner plan 으로 독립하지 않고 03-maintainability.md C-2 항목 하위 주석으로만 관리 | `plan/in-progress/refactor/03-maintainability.md` C-2 항목 | planner 가 spec §7.1 `meta.toolCalls` 불일치를 별도 spec-drift plan item 으로 공식 등재하면 추적성 향상 |
| I6 | Naming Collision | `MultiTurnMemoryMeta` 타입 — 파일-private, 기존 symbol 과 충돌 없음 | `ai-turn-executor.ts` | 변경 불필요 |
| I7 | Naming Collision | `TurnOutputAccumulators` 인터페이스 — 파일-private, 기존 symbol 과 충돌 없음 | `ai-turn-executor.ts` | 변경 불필요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | multi-turn condition deferral `toolCallCount++` pre-existing SPEC-DRIFT 가시화 (WARNING 1건). API 계약·데이터 모델·권한·계층 책임 위반 없음 |
| Rationale Continuity | LOW | 동일 SPEC-DRIFT 가 spec `## Rationale` 미기록 (WARNING 1건). 기각 대안 재도입 없음, spec invariant 위반 없음 |
| Convention Compliance | NONE | `tool_call_budget_exceeded` lower_snake_case 주의점 있으나 LLM-internal 신호로 외부 계약 미노출. 중대 위반 없음 |
| Plan Coherence | NONE | target 이 plan/in-progress/refactor/03-maintainability.md C-2 항목과 완전 정합. 미해결 선결 조건 위반 없음 |
| Naming Collision | LOW | `TOOL_BUDGET_EXCEEDED_ERROR` 상수 vs line 962 인라인 리터럴 이중 표현 (의미 충돌 아님). 신규 식별자 모두 파일-스코프, 기존 symbol 충돌 없음 |

## 권장 조치사항

1. **(WARNING 해소 — planner 위임)** `spec/4-nodes/3-ai/1-ai-agent.md §7.1` `meta.toolCalls` 정의 검토: multi-turn condition deferral 도 "조건 도구 제외"로 통일하거나, spec 에 단/멀티 비대칭을 명시 note 추가. 동시에 `## Rationale` 에 pre-existing 동작 보존 결정과 해소 방향 백로그를 기록.
2. **(WARNING 해소 — planner 위임)** W7 SPEC-DRIFT 를 `03-maintainability.md` C-2 하위 주석에서 별도 spec-drift plan item 으로 독립 등재해 추적성 확보.
3. **(INFO — 선택)** `ai-turn-executor.ts` line 962 `executeProviderToolBatch` 내 인라인 `'tool_call_budget_exceeded'` 리터럴을 `TOOL_BUDGET_EXCEEDED_ERROR` 상수 참조로 교체 (단일 책임 표현, 별도 정리 커밋 가능).
4. **(INFO — 선택)** `tool_call_budget_exceeded` 상수 값을 `'TOOL_CALL_BUDGET_EXCEEDED'`(UPPER_SNAKE_CASE)로 변경하거나 JSDoc 에 LLM-internal signal 명시.
5. **(INFO — 선택)** JSDoc 의 `§3.f-g` 참조를 `spec §6.1 도구 루프 단계 3.f/3.g` 로 정정.