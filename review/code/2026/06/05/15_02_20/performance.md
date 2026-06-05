# 성능(Performance) 리뷰 결과

**대상 커밋**: exec-park-durable-resume (PR-B1)
**검토 파일**: continuation-execution.processor.ts / .spec.ts, execution-engine.service.ts / .spec.ts, execution-park-resume.e2e-spec.ts

---

## 발견사항

### 핵심 구현 파일 (execution-engine.service.ts)

- **[WARNING]** `firePayload` polling 루프 — 최대 250회 × 20ms = 5초 busy-polling
  - 위치: `execution-engine.service.ts` L1801–1825 (`FIRE_PAYLOAD_MAX_ATTEMPTS = 250`, `FIRE_PAYLOAD_POLL_INTERVAL_MS = 20`)
  - 상세: `rehydrateAndResume` slow-path에서 `driveResumeDetached` 가 백그라운드로 detach 된 뒤, `pendingContinuations` 맵에 resolver가 등록되기를 20ms 간격 setTimeout self-reschedule로 기다린다. PR-B1 이후 fresh top-level form/button park는 `pendingContinuations`에 등록하지 않으므로(PARK_RELEASED), `driveResumeDetached` 내부의 `await-mode waitForX` 재진입만이 이 키를 등록한다. 정상 경로에서는 첫 1~2회 poll에 hit하나, 최악 경우(DB I/O 지연) 250 × 20ms timer 객체가 Node.js 이벤트 루프에 체인으로 살아있다. 각 setTimeout 콜백이 가볍긴 하나, 동시 resume 수가 늘어나면 누적 timer 객체 수 증가로 이벤트 루프 지연이 발생할 수 있다.
  - 제안: Phase B2 완료 후 `pendingContinuations` 의존이 제거되면 이 polling 메커니즘 전체가 삭제될 예정이다(B3). 단기적으로는 exponential backoff(초기 0ms → 20ms → 40ms … 상한 200ms)로 timer 객체 생성 빈도를 낮추거나, `Promise` resolver를 직접 전달하는 방식으로 polling을 제거하는 것이 더 깔끔하다. 현 PR-B1 범위에서 수정 필수는 아니나 B2/B3 정리 때 반드시 제거.

- **[WARNING]** `cancelParkedExecution` — `createQueryBuilder` per-call 객체 생성 중첩 (취소 경로)
  - 위치: `execution-engine.service.ts` L1063–1097 (`cancelParkedExecution`)
  - 상세: 단건 UPDATE 임에도 `createQueryBuilder().update().set().where().andWhere().execute()` 체인이 매 호출마다 중간 빌더 객체 5~6개를 생성한다. TypeORM QueryBuilder는 불변 체인으로 동작하지 않아 중간 상태 객체가 GC 대상으로 쌓인다. cancel 트래픽이 낮으면 무시 가능하지만, 동시 취소 요청이 몰릴 때 GC 압력이 생긴다. 또한 같은 파일의 `finalizeRehydrationCleanup` 내 두 곳(L2173, L2246)에서도 동일 `createQueryBuilder` 패턴이 반복된다.
  - 제안: 단건 UPDATE + 조건부(WAITING 가드) 패턴이므로 `executionRepository.update({ id, status: WAITING }, { status: CANCELLED, finishedAt })` 와 같이 `update()` shorthand를 쓰면 빌더 객체 없이 처리 가능하다. 단, TypeORM `update()` shorthand는 `affected` 행 수를 반환하지 않으므로, 멱등 확인이 필요한 현 구조에서는 결과값 처리 방식을 조정해야 한다. `createQueryBuilder` 사용이 불가피하다면 현행 유지.

- **[INFO]** `applyCancellation` — `pendingContinuations.has()` + `cancelParkedExecution()` 두 경로 간 잠재적 TOCTOU 지연
  - 위치: `execution-engine.service.ts` L1045–1050
  - 상세: `has()` 체크 후 `cancelParkedExecution()` 진입 사이에 다른 코루틴이 `pendingContinuations`에 executionId를 등록하면(재개 slow-path가 rehydrate 도중 등록), cancel이 잘못된 경로(DB 직접 마감)로 빠질 수 있다. 현행 Node.js 단일 스레드 + `await` 없는 `has()` 체크라 tick 내에서 atomic하게 동작하나, 이후 `async cancelParkedExecution` 내부의 await 지점에서 다른 microtask가 끼어들 여지가 있다. 성능보다는 correctness 이슈지만 `pendingContinuations.has()` 결과 기준의 분기가 이미 깨질 수 있는 window를 내포한다.
  - 제안: 현행 WAITING_FOR_INPUT andWhere 가드가 DB-레벨에서 멱등을 흡수하므로 실질 영향은 낮다. Phase B2에서 `pendingContinuations` 제거 시 이 분기 자체가 사라짐. 현 PR 범위에서 수정 불필요.

- **[INFO]** `driveResumeDetached` detach 패턴 — `void` 체인으로 인한 에러 경계 성능 overhead 없음, 단 detach 객체 자체가 장수 코루틴
  - 위치: `execution-engine.service.ts` L1845–1861 (driveResumeDetached 호출 및 catch 래퍼)
  - 상세: 멀티턴 AI(`waitForAiConversation`) 경우 detached 코루틴이 대화 수명 내내 메모리(ExecutionContext, nodeOutputCache, llm 캐시)를 점유한다. PR-B1은 form/button에서 PARK_RELEASED를 즉시 반환해 코루틴을 해제하지만, AI 멀티턴 경로에서 호출된 `driveResumeDetached`는 PR-B2까지 여전히 await-mode로 장수한다. `driveResumeDetached` 내부에서 `waitForFormSubmission`/`waitForButtonInteraction`을 `'release'` 모드로 호출하면 PARK_RELEASED를 받아 `{ parked: true }`를 반환하고 스스로 종결하므로(L1794 참조), form/button downstream 에서 detached 코루틴 누수는 PR-B1에서 이미 해소됐다.
  - 제안: 현행 OK. Phase B2 완료 후 AI 멀티턴 detach 코루틴도 해제 예정.

- **[INFO]** `armSlowPathResume` 헬퍼 — 테스트 코드에서 `mockNodeExecutionRepo.save.mock.calls`를 선형 탐색
  - 위치: `execution-engine.service.spec.ts` L264–270 (`armSlowPathResume`)
  - 상세: `saveCalls.find(...)` 는 저장된 모든 `save()` 호출 이력을 순차 탐색한다. 단위 테스트 범위에서는 호출 수가 적어 영향이 없다.
  - 제안: 테스트 코드이므로 실운영 성능과 무관. 현행 유지.

### 테스트 파일 (execution-engine.service.spec.ts)

- **[INFO]** `flushResumeDrive(ms = 40)` — 실제 타이머(real-time) 대기를 테스트에 삽입
  - 위치: `execution-engine.service.spec.ts` L227–228
  - 상세: PR-B1 이후 form/button 재개는 `firePayload`의 `setTimeout(0)` + 20ms 폴링을 통해 `waitForX('await' 모드)`의 resolver를 호출하는 detach 구조다. 이 흐름 전체가 real timer 기반이므로 `jest.useFakeTimers()` 로 제어 불가하여 실제 40ms를 소비하는 `setTimeout`을 삽입한다. 특히 button 경로(`§4.x 회귀 가드` 테스트)에서는 `execution.completed` 이벤트 도달을 최대 50회 × 20ms = 1000ms까지 polling한다. 테스트 스위트 전체 실행 시간이 이 타이머 대기들의 합산으로 증가한다.
  - 제안: 장기적으로 Phase B2/B3에서 `firePayload` scheduler 제거 후 `jest.useFakeTimers()` 기반 instant flush 로 전환 가능하다. 현 PR-B1 범위에서는 real-timer 접근이 불가피.

### e2e 테스트 (execution-park-resume.e2e-spec.ts)

- **[INFO]** `poll()` 구현 — 200ms 간격 `await new Promise(setTimeout)` 루프
  - 위치: `execution-park-resume.e2e-spec.ts` L1087–1108
  - 상세: 최대 15초(기본값) 동안 200ms 마다 REST GET을 반복한다. 이는 e2e 테스트 패턴으로 적절하며, polling 자체가 서버 부하를 과도하게 유발하지 않는다. 다만 `timeoutMs=15_000`으로 설정되어 있어 park 후 rehydration 지연이 길어지면 15초를 소진한다.
  - 제안: 현행 유지. 필요 시 WebSocket 이벤트 수신 기반 e2e로 전환하면 polling 낭비를 제거할 수 있으나 복잡도가 올라간다.

### continuation-execution.processor.ts

- **[INFO]** `applyCancellation` async 전환 — `process()` 내 await 추가로 cancel job의 처리 지연 소폭 증가
  - 위치: `continuation-execution.processor.ts` L196 (`await this.engine.applyCancellation`)
  - 상세: 기존 `void` fire-and-forget에서 `await`로 전환함에 따라 cancel job이 BullMQ worker 슬롯을 DB write 완료 시점까지 점유한다. `cancelParkedExecution`의 UPDATE + emit 은 수 ms 수준이므로 실질 슬롯 점유 시간 증가는 미미하다. job ack 시점에 terminal 마킹을 보장한다는 correctness 이점이 이 overhead를 상쇄한다.
  - 제안: 현행 OK.

---

## 요약

PR-B1의 핵심 성능 개선은 form/button park 시 `pendingContinuations` 미등록으로 in-memory resolver와 코루틴이 즉시 해제되어 bounded memory를 달성한 것이다. 이는 기존 park-wait 모델 대비 메모리 할당 측면에서 명백한 개선이다. 성능 관점에서 주목할 잔여 이슈는 `rehydrateAndResume` 내 `firePayload` 250회 × 20ms setTimeout self-reschedule 폴링으로, 이는 Phase B2/B3에서 `pendingContinuations` Map 전체가 제거되면 함께 소멸할 임시 메커니즘이다. `cancelParkedExecution`의 `createQueryBuilder` 체인은 단건 UPDATE로 빈도가 낮아 실용적 영향이 없다. 전반적으로 Phase B1 변경 자체가 메모리 누수 차단이라는 성능 개선을 이루었으며, 남은 polling overhead는 이미 계획된 B2/B3 정리 대상으로 현 PR 범위에서 별도 조치가 필요한 Critical/High 이슈는 없다.

---

## 위험도

LOW

STATUS: SUCCESS
