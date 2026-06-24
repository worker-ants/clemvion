# Cross-Spec 일관성 검토 결과

검토 모드: impl-done
범위: 06-concurrency M-2 — ShutdownStateService early-return 제거 (Option A)
diff-base: origin/main

---

## 발견사항

### 발견사항 1

- **[INFO]** `data-flow/3-execution.md §3.3` 표의 `registerInFlight` 설명이 구현 의미와 미묘하게 불일치
  - target 위치: `shutdown-state.service.ts` `registerInFlight` JSDoc + `shutdown-state.service.spec.ts` 신규 테스트 케이스
  - 충돌 대상: `/Volumes/project/private/clemvion/spec/data-flow/3-execution.md` §3.3 표 "대상" 셀 및 line 113 — "`registerInFlight` 로 **본 인스턴스가 추적 중인** NodeExecution/Execution 만"
  - 상세: 구현 변경 전에는 shutdown 진입 후 호출된 `registerInFlight` 가 early-return 으로 등록을 거부했기 때문에, data-flow spec 의 "추적 중인" 이라는 표현은 "shutdown 전에 등록된 것만" 을 암묵적으로 가리켰다. M-2 Option A 적용 후에는 shutdown 진입 후에 시작된 세그먼트 내 노드도 등록 대상에 포함되므로, spec 의 "본 인스턴스가 추적 중인" 범위가 실질적으로 확장됐다. 현재 data-flow spec 은 이 확장 사실을 반영하지 않아 old 행동을 연상시킨다.
  - 제안: `spec/data-flow/3-execution.md` §3.3 표 `ShutdownStateService.onApplicationShutdown` 행의 "대상" 셀에 "(shutdown 진입 후 같은 세그먼트 내에서 시작된 노드도 포함 — M-2)" 주석을 추가한다. 또한 line 113 의 "try 첫 줄에서 등록" 설명 뒤에 "shutdown 중에도 등록된다(early-return 없음, M-2)" 를 보강한다.

### 발견사항 2

- **[INFO]** `spec/5-system/4-execution-engine.md §11` 에 Option A(early-return 제거)·Option B(worker pause) 결정 근거가 미기록
  - target 위치: `shutdown-state.service.ts` JSDoc M-2 주석(§4.2 in-process while-loop 경유로 drain 집합 bounded, `queue.pause` 불채택 근거)
  - 충돌 대상: `/Volumes/project/private/clemvion/spec/5-system/4-execution-engine.md` §11 본문 — "신규 job consume 중단" 구현 주체가 BullMQ WorkerHost lifecycle 임을 명시하지 않고 "신규 job consume 중단" 만 기술
  - 상세: plan(`plan/in-progress/refactor/06-concurrency.md` §M-2)이 "권장 B → 채택 A" 정정을 기록했으나, spec §11 Rationale 섹션에는 (a) `queue.pause` 를 채택하지 않은 이유(multi-instance Redis 전역 stall), (b) WorkerHost shutdown lifecycle 이 이미 신규 job consume 을 막아 Option A 만으로 drain 집합이 bounded 됨을 기술하는 항목이 없다. 향후 §11 을 읽는 독자가 "왜 명시적 pause() 없이도 bounded 인가"를 추론해야 한다. 이는 오류를 낳는 불일치는 아니지만, spec Rationale 공백이다.
  - 제안: `spec/5-system/4-execution-engine.md §11` 의 항목 2 설명 또는 Rationale 섹션에 "신규 job consume 중단은 `@nestjs/bullmq` WorkerHost 의 shutdown lifecycle(worker.close)이 담당하므로 `queue.pause()` 는 쓰지 않는다 — `queue.pause()` 는 전역 Redis 플래그라 multi-instance 환경에서 다른 인스턴스를 stall 시킨다(M-2 결정)" 을 추가한다.

---

## 요약

이번 M-2 구현(ShutdownStateService `registerInFlight` early-return 제거)은 spec §11.4 의 `SERVER_INTERRUPTED` 마킹 약속을 보존하는 방향의 수정이다. 주요 spec 계층(`spec/5-system/4-execution-engine.md §11`, `spec/data-flow/3-execution.md §3.3`, `spec/1-data-model.md`)과 직접 모순은 없다. `ShutdownStateService` 가 본 인스턴스에서 시작된 노드를 추적한다는 계약은 유지되며, 상태 전이·API 계약·RBAC·요구사항 ID 영역의 충돌도 없다. 다만 data-flow spec §3.3 의 "추적 중인" 범위 기술과 §11 Rationale 에 `queue.pause` 미채택 근거가 누락되어, spec 이 새 행동을 명시적으로 반영하지 않은 동기화 공백(INFO 2건)이 있다. 두 항목 모두 spec 동기화(planner 위임)로 해소 가능하며 구현 차단 요인은 아니다.

---

## 위험도

LOW
