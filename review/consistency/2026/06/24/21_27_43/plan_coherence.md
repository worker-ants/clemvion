### 발견사항

- **[WARNING]** C-1 spec 갱신 미이행 — §7.4 "cancel publish 실패 동기 surface" 1줄 누락
  - target 위치: diff 에 spec 변경 없음 (구현 변경만 포함)
  - 관련 plan: `plan/in-progress/refactor/06-concurrency.md` C-1 항목 — "spec 갱신: §7.4 에 `cancel publish 실패도 caller 에 동기 surface (queued 계약 준용)` 1줄 (planner)"
  - 상세: plan C-1 은 구현(option A 채택)과 함께 planner 가 `spec/5-system/4-execution-engine.md §7.4` 에 1줄을 추가해야 함을 명시한다. 현재 구현 diff 에는 spec 변경이 전혀 없고, `EXECUTION_ENQUEUE_FAILED` 코드도 spec 에러 카탈로그(`spec/5-system/3-error-handling.md`)에 등재되지 않았다. target scope 설명이 "에러코드 카탈로그는 sibling planner spec-sync defer"로 카탈로그 갱신을 명시 defer 했으므로 에러코드 카탈로그 자체는 차단 사유가 아니다. 그러나 §7.4 의 "cancel publish 실패 표면" 1줄 추가는 plan 에서 defer 대상으로 분류되지 않았으며 구현과 동반돼야 할 planner 작업이다.
  - 제안: plan 의 C-1 항목 옆에 "spec 갱신 미착수" 상태를 명시하고, planner 가 `spec/5-system/4-execution-engine.md §7.4` 에 해당 1줄을 추가하는 후속 작업을 생성하거나 동일 PR 에 포함시킨다.

- **[INFO]** C-1 / M-7 plan 체크박스 미갱신 — 06-concurrency.md 항목이 여전히 `[ ] 미착수`
  - target 위치: 구현 diff (코드 변경 완료)
  - 관련 plan: `plan/in-progress/refactor/06-concurrency.md` C-1 항목 첫 줄 (`- [ ] 미착수`) 및 M-7 항목 첫 줄 (`- [ ] 미착수`)
  - 상세: 코드 변경(cancelWaitingExecution async + ContinuationPublishResult, stop() WAITING queued=false 503, nextSeq random fallback 제거)이 완료됐으나 plan 의 C-1 / M-7 체크박스는 여전히 미착수(`[ ]`)로 표기돼 있다.
  - 제안: 구현 완료 후 plan 문서의 C-1 / M-7 체크박스를 완료로 갱신하고, 잔여 spec 갱신 요구사항(§7.4 1줄)을 별도 TODO 로 분리 기록할 것.

- **[INFO]** C-2 결정 대기 항목과 무관 — 충돌 없음
  - target 위치: 전체 diff
  - 관련 plan: `plan/in-progress/refactor/06-concurrency.md` C-2 항목 (`결정 대기 (사용자)`)
  - 상세: C-2(`rehydrateContext` check-then-act 원자 claim 결정)는 여전히 사용자 결정 대기 상태이며, 이번 C-1+M-7 구현 diff 는 해당 경로를 전혀 건드리지 않는다. 충돌 없음.
  - 제안: 없음.

### 요약

C-1(cancelWaitingExecution async 전환) + M-7(nextSeq random fallback 제거) 구현은 plan `06-concurrency.md` 의 권장안 A를 정확히 따르며 미해결 결정(C-2 사용자 결정 대기)을 우회하거나 건드리지 않는다. 단, plan C-1 이 명시한 spec 갱신 의무("§7.4 에 cancel publish 실패 동기 surface 1줄, planner")가 이행되지 않은 채 구현만 앞서간 상태다. 이는 plan 이 planner 후속 작업으로 명시 defer 하지 않은 항목이어서 WARNING 수준이며, 머지 전에 spec §7.4 갱신 또는 plan 에 후속 추적 항목 추가가 필요하다. 에러코드 카탈로그 등재는 scope 설명에서 sibling planner spec-sync로 명시 defer 됐으므로 차단 사유가 아니다.

### 위험도

LOW
