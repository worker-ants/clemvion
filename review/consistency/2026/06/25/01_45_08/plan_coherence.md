# Plan 정합성 검토 결과

검토 대상: 03-maintainability C-2 2차(최종) — `ai-turn-executor.ts` god-method 분해
검토 기준 plan: `plan/in-progress/refactor/03-maintainability.md`

---

## 발견사항

### [INFO] W7 SPEC-DRIFT — planner 위임 항목이 plan 에 백로그로 등재됨

- target 위치: diff 내 `recordMultiTurnNonProviderToolResults` 메서드 (multi-turn condition deferral `toolCallCount++`), 코드 주석 `[SPEC-DRIFT] (03 C-2 review W7)`, scope 설명 "W7: multi-turn condition toolCallCount 합산 vs spec §7.1 [SPEC-DRIFT] pre-existing 보존, planner 위임. spec 변경 불요."
- 관련 plan: `plan/in-progress/refactor/03-maintainability.md` C-2 항목 내 "⚠️ W7 백로그(planner 위임)" — multi-turn condition deferral 의 `toolCallCount++` 가 spec §7.1 `meta.toolCalls` "조건 도구 제외"와 불일치. pre-existing 동작 보존 + `[SPEC-DRIFT]` 주석 표면화 확인, project-planner 위임 명기.
- 관련 plan 2: `plan/in-progress/refactor/02-architecture.md` C-2 1차 슬라이스(PR #697) 완료 기록 W#1 — "condition `toolCallCount++` = pre-existing(`HEAD~1` multi-turn 루프와 byte-identical 검증) → behavior-preserving 보존·별건 spec-aligned 수정 위임"으로 동일 항목이 선행 PR 에서도 이미 deferred 처리됨.
- 상세: target 의 SPEC-DRIFT 처리 방식(pre-existing 보존 + 주석 표면화 + planner 위임)이 plan 에 기록된 방식과 완전히 일치한다. 미해결 결정을 우회하는 일방적 결정이 아니라, plan 이 명시한 "behavior-preserving 보존, 합산/spec 정정 결정은 planner 위임" 을 그대로 따르고 있다. project-planner 위임 항목으로 별도 plan 화는 현재 누락 상태이나, 03-maintainability.md C-2 항목 내 백로그로 등재되어 추적되고 있다.
- 제안: planner 는 spec §7.1 `meta.toolCalls` "조건 도구 제외" vs multi-turn `toolCallCount++` 불일치를 별도 plan item 또는 spec-drift 백로그 plan 에 공식 등재하면 추적성이 높아진다. 현재는 03-maintainability.md 의 C-2 항목 하위 주석으로만 관리되어, spec 수정 결정 시 찾기 어려울 수 있다. 단, 차단 사유는 아님.

---

## 요약

Plan 정합성 관점에서 이번 target(C-2 2차 최종 슬라이스)은 `plan/in-progress/refactor/03-maintainability.md` C-2 항목의 내용과 완전히 정합한다. C-2 항목은 이미 `[x]` 완료(2026-06-25)로 마킹되어 있고, 6개 private 메서드 추출·`TurnOutputAccumulators` 번들·완료 tail 인라인 유지·W7 SPEC-DRIFT planner 위임 등이 plan 기술 내용과 일치한다. target 이 "결정 필요"로 남겨진 미해결 항목을 일방적으로 결정하거나, 선행 plan 의 미해소 선결 조건을 건너뛰거나, 다른 plan 의 후속 항목을 무효화하는 상황이 발견되지 않았다. W7 SPEC-DRIFT 추적 항목이 별도 planner plan 으로 독립하지 않은 점은 INFO 수준의 개선 권장 사항이나 차단 사유가 아니다.

## 위험도

NONE
