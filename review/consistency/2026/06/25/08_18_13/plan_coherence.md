# Plan 정합성 검토 결과

검토 모드: --impl-done (03-maintainability C-2 후속 W7 SPEC-DRIFT 해소)
검토 기준: plan/in-progress/** 의 미해결 결정·선행 조건·후속 누락 vs. target diff

---

## 발견사항

### [CRITICAL] W7 SPEC-DRIFT 수정 — planner 위임 결정을 일방적으로 집행

- target 위치: diff ai-turn-executor.ts 내 recordMultiTurnNonProviderToolResults — [SPEC-DRIFT] 주석 및 toolCallCount++ 제거, JSDoc 에 "single-turn 과 동일 정책" 으로 통일 기록. 새 테스트 'does not count condition tools toward toolCalls in multi-turn' 추가.
- 관련 plan: plan/in-progress/refactor/03-maintainability.md §C-2 (line 52):
  "W7 백로그(planner 위임): multi-turn condition deferral 의 toolCallCount++ 가 spec §7.1 meta.toolCalls 조건 도구 제외 와 불일치(single-turn 은 미합산=spec 일치). pre-existing 동작으로 본 behavior-preserving 분해가 보존 + [SPEC-DRIFT] 주석 표면화. 합산/spec 정정 결정은 project-planner 위임."
- 상세: plan 은 W7 를 "합산/spec 정정 결정은 project-planner 위임" 으로 명시적으로 미결정 상태로 남겼다. target diff 는 그 미결정 결정(toolCallCount++ 제거 → spec §7.1 정합화)을 planner 합의 없이 developer 가 직접 집행했다. 이는 행위 변경(multi-turn 에서 condition tool 을 budget 에 합산하던 기존 동작 제거)이고, pre-existing 동작을 의도적으로 변경하는 것이다.
- 제안: 두 가지 해소 경로 중 하나를 선택해야 한다.
  1. 사후 승인 경로: project-planner 가 W7 결정(spec §7.1 정합화, toolCallCount++ 제거)을 공식 승인하고, 03-maintainability.md §C-2 의 W7 항목을 "완료(planner 승인 날짜)" 로 갱신한다. 이 경우 target 구현은 유효하다.
  2. 롤백 경로: planner 위임 결정이 아직 내려지지 않은 것으로 판단하면, toolCallCount++ 복원 + [SPEC-DRIFT] 주석 재삽입 후 planner 결정을 기다린다.

---

## 요약

Plan 정합성 관점에서 핵심 문제는 1건이다. plan/in-progress/refactor/03-maintainability.md §C-2 가 W7 SPEC-DRIFT(multi-turn condition deferral toolCallCount++ vs spec §7.1 조건 도구 제외)의 수정 여부를 project-planner 에게 명시적으로 위임한 미결정 사항으로 기록했음에도, target diff 가 그 결정을 일방적으로 집행(toolCallCount++ 제거, 동작 변경)했다. 이는 pre-existing 동작을 실제로 바꾸는 행위 변경이므로 단순 주석 정리가 아니라 결정 집행이다. 다른 plan 항목과의 후속 충돌이나 선행 조건 미해소는 없다.

## 위험도

CRITICAL
