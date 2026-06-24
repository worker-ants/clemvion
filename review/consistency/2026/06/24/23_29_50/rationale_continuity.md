# Rationale 연속성 검토 결과

검토 범위: M-2 ShutdownStateService early-return 제거 (Option A 적용)
diff-base: origin/main

---

## 발견사항

### [WARNING] plan 권장 Option B(queue.pause) 를 Option A 단독으로 대체 — 새 Rationale 필요

- **target 위치**: `shutdown-state.service.ts` JSDoc (diff +104~+124 라인), 검토 컨텍스트 scope 설명 "Option B(worker pause) 미채택(WorkerHost framework 충족·queue.pause 전역 stall)"
- **과거 결정 출처**: `plan/in-progress/refactor/06-concurrency.md` M-2 항목, 라인 136: "**권장**: B — A 만으로는 마킹 약속은 지키지만 shutdown 중 신규 consume 이 drain 집합을 계속 키울 수 있어, §11.2 가 이미 약속한 '신규 job consume 중단' 을 `pause()` 로 명시 구현하는 것이 spec 양쪽 조항의 완결 이행이다."
- **상세**: plan 은 Option B(A + `onApplicationShutdown` 즉시 `queue.pause()`)를 권장으로 명시했다. 구현은 Option A 만 채택하고 Option B 를 기각했는데, 기각 이유로 (a) `@nestjs/bullmq WorkerHost shutdown lifecycle(worker close)` 이 신규 job consume 중단을 이미 처리하므로 A 만으로도 §11.2 를 충족한다는 점과 (b) `queue.pause()` 가 전역 Redis 플래그라 multi-instance 전체를 stall 시킨다는 점을 JSDoc 주석에 서술했다. 그러나 이 기각 근거가 **해당 spec Rationale 에 정식 등재되지 않았다**. plan 의 권장안을 번복하면서 `spec/5-system/4-execution-engine.md §11 Rationale` 또는 `spec/data-flow/3-execution.md Rationale` 에 "(a) WorkerHost lifecycle 이 신규 consume 중단을 담당하므로 `queue.pause()` 중복 불요; (b) `queue.pause()` 가 전역 Redis 플래그라 multi-instance stall 위험" 근거가 추가되지 않으면 이후 검토자가 "왜 plan 권장안과 다른가"를 역추적할 기록이 없다.
- **제안**: `spec/5-system/4-execution-engine.md §11 Rationale` 또는 `spec/data-flow/3-execution.md ## Rationale` 에 M-2 결정 항목 추가: Option B(`queue.pause`) 미채택 사유("WorkerHost shutdown lifecycle 이 신규 job consume 중단을 담당해 `queue.pause()` 가 중복이며, `queue.pause()` 는 전역 Redis 플래그라 동일 Redis 를 공유하는 다른 인스턴스를 함께 stall 시키는 multi-instance 부작용이 있다")를 planner 트랙으로 기록한다.

---

### [INFO] §11.2 "신규 job consume 중단" 이행 수단 spec 미명시 — WorkerHost lifecycle 의존 암묵

- **target 위치**: `shutdown-state.service.ts` JSDoc, "신규 세그먼트 job consume 중단은 @nestjs/bullmq WorkerHost 의 shutdown lifecycle(worker close) 이 담당하므로"
- **과거 결정 출처**: `spec/5-system/4-execution-engine.md §11` 항목 2: "신규 job consume 중단." — 구현 수단 미명시
- **상세**: §11.2 가 "신규 job consume 중단" 을 약속하지만 spec 본문은 그 이행 수단을 기술하지 않는다. 구현은 WorkerHost NestJS lifecycle 에 위임하는 방식으로 충족하는데, 이 암묵적 전제가 spec 에 없어 이후 BullMQ 버전 변경이나 framework 교체 시 동작 기대가 조용히 무너질 수 있다.
- **제안**: `spec/5-system/4-execution-engine.md §11` 항목 2 에 "(BullMQ `@nestjs/bullmq WorkerHost` 의 NestJS shutdown lifecycle 이 SIGTERM 수신 시 자동으로 worker close — 신규 job consume 중단의 구현 의존성)" 한 줄 병기. 별도 Rationale 항목 없이 본문 주석으로도 충분.

---

## 요약

M-2 구현은 `registerInFlight` early-return 제거(Option A)를 통해 §11.4 "미완료 RUNNING → SERVER_INTERRUPTED 마킹" 약속을 올바르게 복원했으며, spec 의 핵심 invariant(zombie RUNNING 제거·drain 대상 포함)를 위반하지 않는다. plan 이 기각 확정했던 Option C(노드 경계 자발적 중단 — §11.2 정책 위반)는 재도입되지 않았으므로 CRITICAL 은 없다. 다만 plan 이 명시 권장했던 Option B(`queue.pause`)를 기각하면서 그 근거("WorkerHost lifecycle 이 신규 consume 중단 담당, `queue.pause` 전역 stall 부작용")가 spec Rationale 에 등재되지 않은 점이 Rationale 연속성 관점의 주요 갭이다. 전체적으로 결정 번복은 의도된 것으로 보이나 Rationale 부재인 WARNING 1건과 spec 본문 서술 보완 INFO 1건이 잔존한다.

## 위험도

LOW
