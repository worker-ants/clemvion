# 부작용(Side Effect) 리뷰 결과

**대상**: M-2 — ShutdownStateService.registerInFlight early-return 제거 (06-concurrency)
**파일**: `codebase/backend/src/modules/execution-engine/shutdown/shutdown-state.service.ts`
**검토 시각**: 2026-06-24

---

## 발견사항

### [INFO] 의도된 공유 상태 변경 — shutdown 후에도 inFlightNodeExecutions Map 에 항목 추가

- 위치: `codebase/backend/src/modules/execution-engine/shutdown/shutdown-state.service.ts` `registerInFlight` 메서드
- 상세: `this.shuttingDown === true` 인 상태에서도 `this.inFlightNodeExecutions.set(...)` 이 실행된다. 이는 `onApplicationShutdown` 내부의 `waitForDrain` 폴링 루프가 진행 중인 동안 새 항목이 Map 에 삽입되는 것을 허용한다. 이 공유 상태(`inFlightNodeExecutions`)의 변경은 의도된 수정의 핵심이므로 의도하지 않은 부작용이 아니다. `waitForDrain` 의 deadline 은 `onApplicationShutdown` 진입 시점에서 고정된다 — 늦게 등록된 노드는 남은 grace 시간이 짧을 수 있으나 이는 설계상 허용된 트레이드오프다(drain 집합이 grace 한도 내로 bounded).
- 제안: 없음. 동작이 의도와 일치한다.

### [INFO] onApplicationShutdown 멱등성 보존 확인 — double-marking 위험 없음

- 위치: `onApplicationShutdown` 첫 번째 `if (this.shuttingDown) return` 분기
- 상세: 두 번째 SIGTERM 은 `this.shuttingDown` 가 이미 true 이므로 즉시 return 된다. 첫 번째 호출이 `markRemainingAsInterrupted` 진행 중이더라도 두 번째 호출은 DB UPDATE 를 재호출하지 않으므로 double-marking 없다. 기존 설계와 동일.
- 제안: 없음.

### [INFO] 시그니처 변경 없음 — 호출자 영향 없음

- 위치: `registerInFlight(nodeExecutionId: string, executionId: string): void`
- 상세: 메서드 시그니처가 변경되지 않았다. 반환값 `void` 이고 기존 호출자(`ExecutionEngineService.executeNode` 등 try/finally 블록)는 반환값을 사용하지 않으므로 추가 변경 없이 기존 호출 패턴이 그대로 유효하다.
- 제안: 없음.

### [INFO] 전역 변수 도입 없음

- 위치: 파일 전체
- 상세: 신규 전역 변수·module-level 상태·static 필드가 도입되지 않았다. 모든 관련 필드(`inFlightNodeExecutions`, `shuttingDown`, `graceMs`, `pollMs`)는 기존 인스턴스 범위 private 필드 그대로다.
- 제안: 없음.

### [INFO] 파일시스템 / 환경 변수 / 네트워크 부작용 없음

- 위치: 파일 전체
- 상세: 파일 I/O, 환경 변수 읽기/쓰기, 외부 네트워크 호출이 추가·변경되지 않았다. DB 호출(`createQueryBuilder().update()...execute()`)은 기존과 동일하며, early-return 제거로 인해 호출 빈도가 늘어나지 않는다(grace 만료 시점에 한 번 실행되는 구조 그대로).
- 제안: 없음.

### [INFO] 이벤트/콜백 변경 없음

- 위치: 파일 전체
- 상세: NestJS `OnApplicationShutdown` 인터페이스의 `onApplicationShutdown` 시그니처, `waitForDrain` 내부의 `setTimeout` 폴링, EventEmitter 패턴 등에 변경이 없다.
- 제안: 없음.

---

## 요약

이번 변경은 `ShutdownStateService.registerInFlight` 내부의 `if (this.shuttingDown) return` early-return 가드 1줄(diff 상 4줄)을 제거하는 단일 로직 수정이다. 공개 메서드 시그니처·전역 변수·파일시스템·환경 변수·네트워크 호출·이벤트 패턴에 어떠한 변경도 없다. 유일한 런타임 상태 변화는 `shuttingDown === true` 이후에도 인스턴스-범위 Map(`inFlightNodeExecutions`)에 새 항목이 삽입되도록 허용하는 것으로, 이는 §11.4 zombie RUNNING row 제거를 위해 의도적으로 도입된 것이다. 호출자 측에서는 추가 변경이 필요 없으며, grace deadline 이 고정 시점에서 계산되므로 늦게 등록된 노드의 drain 가능 시간이 짧아질 수 있으나 이는 설계상 허용된 트레이드오프다. 의도하지 않은 부작용은 없다.

---

## 위험도

NONE
