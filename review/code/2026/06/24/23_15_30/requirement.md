# 요구사항(Requirement) 리뷰 결과

**대상**: M-2 — ShutdownStateService `registerInFlight` early-return 제거 (06-concurrency)
**파일**: `shutdown-state.service.ts`, `shutdown-state.service.spec.ts`
**검토 시각**: 2026-06-24

---

## 발견사항

### [INFO] 기능 완전성 — early-return 제거는 의도한 수정을 정확히 구현
- 위치: `shutdown-state.service.ts` `registerInFlight` 메서드 (라인 502-504)
- 상세: `if (this.shuttingDown) return;` 제거로 shutdown 진입 후에도 in-process while-loop 가 시작하는 세그먼트 내부 노드가 `inFlightNodeExecutions` Map 에 등록된다. 변경은 최소하며 의도(zombie RUNNING 방지)를 정확히 달성한다.
- 제안: 없음.

### [INFO] 엣지 케이스 — 동일 nodeExecutionId 중복 등록 허용(Map.set 덮어쓰기)
- 위치: `shutdown-state.service.ts` 라인 503 (`this.inFlightNodeExecutions.set(...)`)
- 상세: `Map.set` 은 동일 키가 이미 존재하면 value 를 덮어쓴다. 동일 `nodeExecutionId` 가 두 번 등록될 경우 `inFlightCount` 는 증가하지 않고 executionId 만 갱신된다. 이는 early-return 제거 전후 동일한 동작이며, 정상 흐름에서 같은 nodeExecutionId 가 중복 등록될 경우는 없다(한 NodeExecution row 는 한 번만 시작). 위험 없음.
- 제안: 없음.

### [INFO] TODO/FIXME — 없음
- 위치: 변경된 두 파일 전체
- 상세: 미완성 작업을 시사하는 `TODO`, `FIXME`, `HACK`, `XXX` 주석 없음.

### [INFO] 의도와 구현 일치 — JSDoc 과 구현이 정확히 일치
- 위치: `shutdown-state.service.ts` 라인 490-504
- 상세: JSDoc 이 "M-2 (06-concurrency) — shutdown 중에도 등록한다" 와 early-return 제거 이유를 §11.2·§4.2·§11.4 인용하며 상세히 설명하고, 실제 구현(early-return 없이 바로 Map.set)과 정확히 일치한다.

### [INFO] 에러 시나리오 — DB UPDATE 실패 graceful degradation 테스트 존재
- 위치: `shutdown-state.service.spec.ts` 라인 298-321
- 상세: NodeExecution UPDATE 실패 / Execution UPDATE 실패 두 케이스에서 `onApplicationShutdown` 이 외부로 throw 하지 않는 것을 단언한다. `markRemainingAsInterrupted` 의 try/catch 패턴과 정합한다.

### [INFO] 반환값 — 모든 코드 경로에서 `Promise<void>` 정상 resolve 보장
- 위치: `shutdown-state.service.ts` `onApplicationShutdown` 메서드 (라인 511-549)
- 상세: (1) 이미 shuttingDown → 즉시 return, (2) in-flight 0 → 즉시 return, (3) drain 성공 → return, (4) grace 초과 → `markRemainingAsInterrupted` 호출 후 종료. 모든 경로가 `Promise<void>` 를 정상 resolve 한다.

### [INFO] spec fidelity — spec/5-system/4-execution-engine.md §11.4 와 완전 일치
- 위치: `shutdown-state.service.ts` `markRemainingAsInterrupted` (라인 564-623) vs `spec/5-system/4-execution-engine.md §11` 항목 4
- 상세: spec §11.4 는 "미완료 시: 해당 NodeExecution 을 `failed` + `error.code='SERVER_INTERRUPTED'` 로 마킹 후 Execution 도 마킹" 을 명시한다. 코드는 NodeExecution (`NodeExecutionStatus.FAILED` + `error.code='SERVER_INTERRUPTED'`)·Execution (`ExecutionStatus.FAILED` + `error.code='SERVER_INTERRUPTED'`) 모두를 atomic UPDATE 한다. `andWhere('status = :status', { status: NodeExecutionStatus.RUNNING })` 조건으로 RUNNING 인 row 만 건드리며, WAITING_FOR_INPUT 은 대상에 포함되지 않아 §11.3 "WAITING_FOR_INPUT 은 건드리지 않음" 도 준수한다. spec 과 line-level 정합.

### [INFO] spec fidelity — spec/data-flow/3-execution.md §3.3 과 일치
- 위치: `shutdown-state.service.ts` `registerInFlight` vs `spec/data-flow/3-execution.md §3.3`
- 상세: §3.3 표는 "`registerInFlight` 로 **본 인스턴스가 추적 중인** NodeExecution/Execution 만 (`WHERE id IN (...)`)" 을 drain 대상으로 기술한다. early-return 제거 후 shutdown 중 시작된 노드도 Map 에 등록되어 이 서술과 완전히 부합한다. (옛 early-return 은 오히려 이 서술과 모순이었다.)

### [WARNING] 테스트 WHERE 절 검증 — mock 체인 탐색의 undefined 오탐 위험
- 위치: `shutdown-state.service.spec.ts` 라인 249-257 (새 테스트 케이스의 WHERE 절 단언)
- 상세: `neChain.update.mock.results[0].value` → `.set.mock.results[0].value` → `.where.mock.calls[0]` 로 3단 mock 체인을 탐색해 `where` 호출 인자를 검증한다. 이 패턴은 `buildChain` 의 `mockReturnValue` 연쇄에 의존하므로 `markRemainingAsInterrupted` 의 QueryBuilder 호출 순서가 변경되면 `whereArgs` 가 `undefined` 가 되고 `JSON.stringify(undefined)` = `undefined` 가 되어 `toContain` 이 실패하는 대신 오탐(false-pass)을 낼 위험이 있다. 단, 이 동일 패턴은 기존 `'SQL UPDATE WHERE 절은 등록된 nodeExecutionId 만 지정'` 테스트(라인 262-278)와 `'graceMs 초과 시 SERVER_INTERRUPTED 로 마킹'` 테스트(라인 219-232)에서도 이미 사용 중이어서 본 PR 이 신규 도입한 결함이 아니다. 기존 테스트에서 동작이 검증된 패턴을 재사용한 것이므로 회귀 위험은 낮다.
- 제안: 현행 패턴 유지 가능. 향후 QueryBuilder mock 을 factory 함수로 교체해 `.where` spy 를 외부 노출하는 방식으로 개선하면 undefined 오탐 위험을 제거할 수 있다. 이번 PR 범위에서는 필수 아님.

### [INFO] plan 문서 미갱신 (plan B→A 정정) — 코드 버그 아님, consistency 리뷰에서 이미 식별
- 위치: `plan/in-progress/refactor/06-concurrency.md` M-2 (이번 PR 에 포함되지 않음)
- 상세: consistency 리뷰(`review/consistency/2026/06/24/22_32_23/SUMMARY.md`)에서 WARNING 으로 이미 식별된 사항이다. 코드 구현 자체는 정확하며, plan 문서 갱신은 planner 경유 후속 과제다. 코드 버그 아님.

---

## 요약

이번 변경(M-2)은 `ShutdownStateService.registerInFlight` 의 `if (this.shuttingDown) return` early-return 을 제거해, shutdown 진입 후 in-process while-loop 가 이어서 시작하는 세그먼트 내부 노드를 `inFlightNodeExecutions` Map 에 등록하도록 한다. 이는 `spec/5-system/4-execution-engine.md §11.2`("현재 세그먼트를 완료까지 진행")·`§11.4`("미완료 RUNNING → failed + SERVER_INTERRUPTED")·`spec/data-flow/3-execution.md §3.3`(본 인스턴스 추적 대상)과 line-level 로 정합하며, 기능 완전성·에러 처리·반환값 모든 면에서 spec 요구사항을 정확히 충족한다. 테스트는 shutdown 이후 등록된 노드(`ne-early`, `ne-late`) 두 ID 가 grace 만료 시 WHERE 절에 모두 포함됨을 단언해 핵심 요구사항을 커버한다. WHERE 절 단언에 사용된 mock 체인 탐색 패턴에 이론상 undefined 오탐 가능성이 있으나 기존 테스트와 동일한 패턴을 재사용한 것이어서 신규 위험이 아니다.

---

## 위험도

LOW
