### 발견사항

- **[WARNING]** spec `§10 shouldSkipReview` 목록(line 958)의 `finishBlockCount > 0` 항목이 in-progress plan 에 추적 없음
  - target 위치: `system-prompt.ts` 변경 commit 86cd2a97 — `PLAN_NOT_COMPLETE already fired this turn` skip 문구 제거 + `does NOT skip review` 명시. 커밋 메시지에서 "spec §10 line 958 stale finishBlockCount 는 sibling PR #685(planner)가 처리"라고 위임.
  - 관련 plan: `plan/in-progress/refactor/02-architecture.md` § M-3 "planner 후속(비차단 SPEC-DRIFT, M-3 god-service 분할 전체 완료 — 일괄 처리)" — `4-ai-assistant.md §10/§7 Rationale` 갱신 항목 열거됨. 그러나 `shouldSkipReview` 목록 자체(line 958)의 `finishBlockCount > 0` 조건 제거는 해당 항목에 명시되어 있지 않다. `plan/in-progress/` 전체에 `#685` 또는 이 spec 수정을 독립 추적하는 문서도 부재.
  - 상세: `spec/3-workflow-editor/4-ai-assistant.md` 에는 두 곳의 skip 조건 설명이 공존한다. line 1072–1088 (`§5 Review guard 항상 발동`)에는 `finishBlockCount > 0` 조건 **제거** 의도와 새 skip 목록이 이미 기술돼 있다. 반면 line 952–961 (`##### review skip 조건`)에는 아직 `state.finishBlockCount > 0 — PLAN_NOT_COMPLETE 가 이미 발동했다면 LLM 은 한 라운드 feedback 을 받았으므로 review 는 중복` 이 그대로 남아 있어 spec 내부 모순이다. target 의 `system-prompt.ts` 변경은 구현(코드·테스트)을 §5 기술에 맞게 동기화했으나, line 958 의 stale 텍스트 제거는 어느 in-progress plan 에도 추적되지 않은 상태다.
  - 제안: M-3 "planner 후속" 체크리스트(`02-architecture.md`)에 "`4-ai-assistant.md §10 shouldSkipReview 목록(line 958) — finishBlockCount > 0 항목 제거 및 §5 와 통합`"을 명시적으로 추가하거나, 별도 spec 업데이트 plan 에 등재한다. spec 내부 모순(line 958 vs line 1084)이 해소되기 전까지 reviewer/checker 가 두 섹션을 다르게 읽을 수 있다.

- **[INFO]** M-3 planner 후속 체크리스트에 `system-prompt.ts` 동기화 완료가 기록되지 않음
  - target 위치: `system-prompt.ts` + `system-prompt.spec.ts` 변경 (commit 86cd2a97)
  - 관련 plan: `plan/in-progress/refactor/02-architecture.md` M-3 "planner 후속" 목록 — `4-ai-assistant.md §10/§7 Rationale 의사코드 갱신` 등이 열거돼 있으나 `system-prompt.ts Self-review 섹션 동기화` 자체는 별도 체크박스가 없다. 구현(developer)이 이미 처리했으므로 planner 후속에서 "완료" 표기 또는 제외 처리가 필요.
  - 상세: 사소한 추적 gap이며 기능 충돌이나 결정 우회는 없다.
  - 제안: M-3 planner 후속 체크리스트에 `system-prompt.ts 동기화 완료 (commit 86cd2a97, developer PR)` 를 note로 추가해 planner 가 중복 작업하지 않도록 명시.

### 요약

target(system-prompt.ts 정합 완료)은 M-3 2단계 plan이 완료로 표기된 범위와 일치하며, 미해결 결정을 일방적으로 우회하거나 선행 plan 미해소 조건에 의존하는 문제는 없다. 다만 `spec/3-workflow-editor/4-ai-assistant.md` line 958 의 `finishBlockCount > 0` skip 조건 — target 이 제거한 내용의 spec 짝 — 이 아직 spec 에 stale 텍스트로 남아 있고, 이 수정을 추적하는 in-progress plan 항목이 부재한다. 커밋 메시지가 "sibling PR #685(planner)가 처리"로 위임을 명시했으나 현재 plan 문서 어디에도 #685 또는 해당 spec 수정이 등재되어 있지 않아 WARNING 등급 누락이다.

### 위험도

LOW
