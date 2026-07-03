### 발견사항

없음.

M-4(`executeAsync` fire-and-forget setup 2차 실패 시 RUNNING 잔류) 는 `plan/in-progress/refactor/06-concurrency.md` 의 명시적 옵션 비교·권장(Option B: 단기 fallback 복제)를 그대로 구현한 것으로 확인된다. 확인한 정합 근거:

- **plan 상 결정과 diff 의 일치** — `06-concurrency.md` M-4 항목이 "권장: B 를 즉시 적용하고 A(큐 통일)는 PR2b admission 대상 한정 결정과 묶어 후속" 이라고 명시했고, 실제 diff 는 정확히 그 내용(`failFirstSegmentSetupBestEffort` 헬퍼로 큐 경로(W7)와 동일한 best-effort 마감을 `executeAsync` catch 에 복제)이다. plan 항목은 이미 `[x] 구현 완료 (Option B, 2026-07-03, 커밋 a18a8d5a0+review-fix)` 로 체크돼 있고 커밋 해시(`a18a8d5a0`)가 diff 와 일치.
- **spec 갱신 불요 판정과 실제 diff 의 일치** — plan 은 "spec 갱신: 큐 통일 채택 시 §4 에 executeAsync 경로 명시 (planner)" 라고 하여 Option B 채택 시엔 spec 변경이 불요함을 명시했다. `git diff origin/main...HEAD -- spec/5-system/4-execution-engine.md` 결과가 비어 있어 실제로도 spec 미변경 — 정합.
- **후속(Option A) 추적 유지** — `06-concurrency.md` 및 `README.md`(L25) 양쪽 모두 "M-4 Option A(큐 통일)는 PR2b admission 결정과 묶어 후속" 을 명시적으로 남겨둠. `exec-intake-queue-impl.md` PR2b 는 여전히 미완료(`[ ]`)이며 M-4 Option B 구현이 그 미해결 결정(admission 대상 한정)을 우회하거나 선점하지 않는다 — Option B 는 PR2b 와 독립적인 임시 조치로 plan 이 이미 그렇게 설계함.
- **README 인덱스 동기화** — `plan/in-progress/refactor/README.md` L25 가 이번 커밋 해시(`a18a8d5a0`)까지 반영해 이미 갱신돼 있음 — plan 문서와 인덱스 간 드리프트 없음.
- **동일 파일 인접 작업(C-2)과의 충돌 없음** — 같은 날(2026-07-03) 완료된 C-2(`rehydrateContext` DB 원자 claim)는 다른 코드 경로(재개 진입 claim)를 다루며, 본 브랜치(`refactor-06-m4-e97346`)는 C-2 가 이미 반영된 main 위에서 분기해 순서 충돌 없음.

### 요약

Target spec 문서(`spec/5-system/4-execution-engine.md`) 자체는 이번 구현에서 변경되지 않았으며, 이는 관련 plan(`plan/in-progress/refactor/06-concurrency.md` M-4)이 Option B 채택 시 명시적으로 "spec 갱신 불요"라고 판정한 것과 정확히 일치한다. plan 이 옵션 비교·권장·후속 추적(Option A → PR2b 후속)까지 상세히 기록했고, 실제 diff·커밋 해시·README 인덱스가 모두 그 결정을 충실히 반영한다. 미해결 결정 우회, 선행 plan 미해소, 후속 항목 누락 중 어느 것도 발견되지 않았다.

### 위험도
NONE
