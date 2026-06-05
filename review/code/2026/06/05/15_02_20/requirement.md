# 요구사항(Requirement) 리뷰

## 발견사항

### **[WARNING]** `cancelParkedExecution` — WAITING 상태의 `NodeExecution` 마킹 누락
- 위치: `/codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `cancelParkedExecution` 메서드 (변경 diff ~L1060–1090)
- 상세: `cancelParkedExecution`은 park-release 후 in-memory 코루틴이 없는 WAITING execution을 직접 `CANCELLED`로 마감한다. 그러나 동반 `NodeExecution` 행은 여전히 `waiting_for_input` 상태로 DB에 잔류한다. 코드 주석에 "NodeExecution 은 옛 catch 경로와 동일하게 별도 마킹하지 않는다"고 명시돼 있으나, 이 전제가 spec §1.1 상태 전이표의 "원자성 보장" 절과 충돌할 수 있다.
  - spec §1.1: `running ↔ waiting_for_input` 전이는 `NodeExecution` 상태 변경과 "단일 DB 트랜잭션"으로 묶인다고 정의. 그러나 사용자 취소(cancel) 경로의 `waiting_for_input → cancelled` 전이에 대해 spec은 `NodeExecution`의 동반 마킹을 명시하지 않는다.
  - 옛 in-memory coroutine 경로에서는 `ExecutionCancelledError`가 `runExecution`의 `catch`로 전파돼 `Execution`과 `NodeExecution` 모두를 처리했는지 여부가 불명확하다. `cancelParkedExecution`이 `Execution`만 CANCELLED로 마감하고 `NodeExecution`을 `waiting_for_input`으로 방치하면, 해당 row가 `resolveWaitingNodeExecutionId`(find: `status='waiting_for_input'`) 조건에 매칭돼 취소 후 다른 continuation job이 그 row를 재개 대상으로 잡을 위험이 있다.
  - 단, `Execution.status`가 `CANCELLED`이므로 `rehydrateAndResume`의 `Execution.status === 'waiting_for_input'` 검증에서 즉시 차단된다. 따라서 현재 코드에서 실제 이중 실행 위험은 없으나, DB 데이터 정합성(NodeExecution이 terminal 미달) 및 UI 표시 이슈(노드가 영구 WAITING으로 보임) 우려가 있다.
- 제안: spec §1.1이 사용자 취소 경로의 `NodeExecution` terminal 마킹을 명시하지 않아 "설계 침묵" 영역이므로, `cancelParkedExecution`에서 WAITING `NodeExecution` row를 `CANCELLED`(또는 `failed`)로 마킹하는 것을 검토한다. 최소한 spec에서 취소 시 `NodeExecution` 단말 처리 정책을 명문화해야 한다.

---

### **[WARNING]** [SPEC-DRIFT] `applyCancellation` async 전환 — spec §7.4 Worker 동작 표에 미반영
- 위치: `continuation-execution.processor.ts` 변경 diff + `execution-engine.service.ts` `applyCancellation` (L1046–1048)
- 상세: PR-B1에서 `applyCancellation`이 `void`(fire-and-forget) → `async/await`로 전환됐다. spec §7.4의 Worker 동작 표 및 diagram은 `cancel` job의 await 동작을 명시하지 않는다(표 내 `continue`/`cancel` 처리 서술은 fire-and-forget 전제를 암묵적으로 유지). 코드 변경은 합리적이고 의도적이며(job ack 시점에 terminal 마킹 보장, 동시성 안전), 되돌리는 것이 오답이다.
- 제안: 코드 유지 + spec 반영. `spec/5-system/4-execution-engine.md §7.4` Worker 동작 표 내 `cancel` 타입 처리에 "park-release 후 코루틴 없으면 `cancelParkedExecution` await(DB 직접 CANCELLED 마감) — job ack 시 terminal 보장" 행위를 명시. §Rationale "park 즉시 해제 + slow-path 일원화"에도 cancel 경로 갱신 이유 추가.

---

### **[WARNING]** [SPEC-DRIFT] `runNodeDispatchLoop` 반환형 `Promise<void>` → `Promise<{ parked: boolean }>` 변경 — spec에 시그니처 미반영
- 위치: `execution-engine.service.ts` L1764–1767 (변경 diff)
- 상세: `runNodeDispatchLoop`의 반환 타입이 `Promise<void>`에서 `Promise<{ parked: boolean }>`로 변경됐다. spec §7.4/§7.5에서 `runNodeDispatchLoop`의 시그니처나 반환 계약을 직접 정의하는 조항이 없어 spec 침묵 영역이지만, Phase B 코어 설계 변경의 결과물로 spec §4.x banner 및 §Rationale에서 서술하는 "park = 세그먼트 종료"의 구현 메커니즘이다.
- 제안: 코드 유지 + spec 반영. `spec/5-system/4-execution-engine.md §4.x` 구현 메모 banner에 `runNodeDispatchLoop` 반환 `{ parked: boolean }` 계약을 간략히 명시, 또는 §Rationale에 구현 세부 추가.

---

### **[INFO]** `armSlowPathResume` — `waitingSave`가 `undefined`일 때 silent fallback
- 위치: `execution-engine.service.spec.ts` L587–595 (`armSlowPathResume` 헬퍼)
- 상세: `waitingSave`가 `undefined`일 경우(즉, `mockNodeExecutionRepo.save`에 WAITING_FOR_INPUT 상태로 저장된 call이 없는 경우) `rawPersisted`가 빈 객체 `{}`로 fallback되고 `outputData: {}` 상태로 NodeExecution mock이 세팅된다. 이는 `waitForFormSubmission`의 체크포인트 데이터가 없는 경우를 묵시적으로 허용하며, 테스트가 `waitingSave`를 기대하고도 silently undefined인 경우를 감지하지 못한다. `flushResumeDrive(40ms)` 기반 타이머 폴링으로 assertion하는 테스트에서 빈 outputData로 slow-path가 의도치 않게 `RESUME_CHECKPOINT_MISSING`으로 fallthrough될 경우 타이머 만료 후 assertion이 조용히 실패할 수 있다.
- 제안: 헬퍼 내부에서 `waitingSave`가 undefined일 때 단언(`expect(waitingSave).toBeDefined()`) 또는 경고 로그를 추가해 테스트 격리를 강화한다. 현재 통과하는 테스트에서는 실제 save call이 존재하므로 기능 동작에는 영향 없음.

---

### **[INFO]** `flushResumeDrive(ms=40)` — 실제 타이머 의존 + 결정론 결여
- 위치: `execution-engine.service.spec.ts` L82 (`flushResumeDrive` 헬퍼)
- 상세: `firePayload`의 polling 간격(20ms) + setTimeout(0) 스케줄을 커버하기 위해 40ms 실제 타이머를 사용한다. Jest 기본 환경에서 `jest.useFakeTimers()`가 활성화돼 있지 않으면 시스템 부하에 따라 40ms가 부족할 수 있다. `execution.completed` event를 최대 50회 × 20ms 폴링하는 button 테스트(L3807–3513)는 실제 느린 CI 환경에서도 안정적이나, 단일 40ms 타이머를 사용하는 다른 테스트는 CI 부하 시 sporadic failure 위험이 있다.
- 제안: `jest.useFakeTimers()` + `jest.advanceTimersByTimeAsync()` 전환 또는 실제 타이머 timeout을 넉넉히 확보 (예: 100ms). 단기적으로는 현 구현 유지해도 운영 문제 없음.

---

### **[INFO]** e2e 테스트 — `node_execution` cancel 시나리오 누락
- 위치: `codebase/backend/test/execution-park-resume.e2e-spec.ts`
- 상세: e2e 테스트는 (1) park WAITING 영속, (2) cold rehydration resume → completed, (3) output 무손실의 세 불변식을 검증한다. 그러나 `cancelWaitingExecution` 경로(park 후 cancel → `cancelParkedExecution` → CANCELLED DB 마감)의 e2e 시나리오가 없다. `cancelParkedExecution`의 `NodeExecution` 단말 처리 미정(위 WARNING 참조)에 대한 회귀 가드가 없다.
- 제안: `cancelParkedExecution` NodeExecution 정책이 확정되면 e2e에 "park → cancel → execution CANCELLED + nodeExecution terminal 검증" 케이스 추가를 고려한다.

---

### **[INFO]** `driveResumeDetached` 내 `waitForFormSubmission`/`waitForButtonInteraction` — `parkMode` 기본값 `'await'` 의존
- 위치: `execution-engine.service.ts` L1924–1936 (`driveResumeDetached`)
- 상세: `driveResumeDetached`에서 `waitForFormSubmission`/`waitForButtonInteraction`을 호출할 때 `parkMode` 인자를 생략(기본값 `'await'`)한다. 이는 의도된 설계(rehydration drive의 첫 waiting node는 await 모드로 재진입, 이후 downstream 블로킹은 `runNodeDispatchLoop`가 `'release'`로 처리)이나, 명시적으로 `'await'`를 전달하면 가독성이 향상되고 미래 기본값 변경 시 의도치 않은 동작 변화를 방지한다.
- 제안: 가독성 향상 목적으로 명시적 `'await'` 전달을 고려. 기능 결함 없음.

---

## 요약

PR-B1의 핵심 기능 구현(form/button park-release + slow-path 일원화 + applyCancellation async 전환)은 spec §4.x Phase B 모델 및 §7.5 rehydration 경로와 전반적으로 일치한다. `PARK_RELEASED` sentinel, `ParkMode` 타입, `runNodeDispatchLoop` 반환형 변경, `cancelParkedExecution` DB-레벨 마감의 설계는 spec Rationale에 명시된 "park = 세그먼트 종료, bounded 메모리, slow-path 일원화" 원칙을 올바르게 구현한다. 가장 주요한 요구사항 미충족 위험은 `cancelParkedExecution`에서 동반 `NodeExecution`의 terminal 마킹 누락이다 — Execution.status가 CANCELLED여서 이중 실행은 차단되지만 NodeExecution이 영구 `waiting_for_input`으로 잔류해 DB 정합성 및 UI 이슈가 발생한다. 이 정책이 의도적인지(옛 catch 경로 동형 주장) 확인이 필요하다. spec 문서에서 `applyCancellation`의 async 전환과 `runNodeDispatchLoop` 반환형 변경이 미반영돼 있어 SPEC-DRIFT가 2건 존재하나 코드 동작 자체는 옳다.

## 위험도

MEDIUM
