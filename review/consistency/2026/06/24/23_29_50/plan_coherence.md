# Plan 정합성 검토 결과

검토 대상: M-2 `ShutdownStateService.registerInFlight` early-return 제거 (Option A)
관련 plan: `plan/in-progress/refactor/06-concurrency.md` § M-2

---

### 발견사항

해당 없음 — NONE.

**근거 요약**:

1. **미해결 결정과의 충돌 없음**: `06-concurrency.md` 에서 "결정 대기" 로 남아 있는 항목은 C-2 (`rehydrateContext` check-then-act 원자 claim)뿐이며, M-2 구현은 `ShutdownStateService.registerInFlight` 만 수정해 C-2 와 코드 표면이 전혀 겹치지 않는다. M-2 자체의 옵션 결정(A vs B)은 plan 이 "착수 시 코드 조사로 Option A 정정"이라고 명시적으로 기록하고 있으며, diff 는 그 정정안을 그대로 따른다.

2. **선행 plan 미해소 없음**: M-2 의 전제 조건은 "spec §11.4 가 이미 약속을 선언했고 구현이 드리프트"(spec 대조 C)이다. spec §11.4 는 이미 확정된 문서이고 별도 선행 plan 의 완료를 기다리지 않는다. plan 이 "spec 변경 불요" 를 명시해 project-planner 선행 작업도 없다.

3. **후속 항목 누락 없음**: plan M-2 는 "optional planner 후속(비차단)" 으로 §11 Rationale 에 WorkerHost shutdown lifecycle 1줄 보충을 명시했다. 이는 비차단이며 이미 plan 에 기록돼 있으므로 새로 추가해야 할 후속 항목이 누락된 것이 아니다. 다른 in-progress plan 중 `ShutdownStateService` 또는 `registerInFlight` 를 직접 참조하는 plan 은 없다.

4. **옵션표 권장안 B→A 정정**: plan 이 "착수 시 코드 조사로 정정" 으로 B→A 정정을 명시적으로 기록했고 diff 는 A(early-return 제거만)를 구현한다. plan 의 옵션 B 설명도 "착수 시 정정 — 미채택" 으로 이미 갱신돼 있다. target(구현)이 plan 의 미해결 결정을 일방적으로 우회한 것이 아니라 plan 이 승인한 결정을 실행한 것이다.

---

### 요약

M-2 구현(Option A — `registerInFlight` early-return 제거)은 `plan/in-progress/refactor/06-concurrency.md` M-2 항목의 결정 내용과 완전히 정합한다. 미해결 결정인 C-2 와는 코드 표면이 분리돼 충돌이 없고, 선행 plan 미해소도 없으며, 추가로 추적해야 할 후속 항목도 이미 plan 에 기록돼 있다. Plan 정합성 관점에서 문제 없음.

### 위험도

NONE
