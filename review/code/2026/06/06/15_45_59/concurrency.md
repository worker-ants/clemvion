# 동시성(Concurrency) 리뷰 결과

## 발견사항

변경 코드에 동시성 관련 코드가 다수 포함돼 있다. 분석 결과는 아래와 같다.

---

### [INFO] driveResumeDetached / driveCallStackResume 를 await 로 전환 — 예외 전파 경로 변경
- 위치: `execution-engine.service.ts` — `resumeFromCheckpoint` 내부 (기존 `this.driveResumeDetached(...).catch(...)` → `await this.driveResumeDetached(...)`)
- 상세: 기존 코드는 drive 를 fire-and-forget(detach)하고 `.catch(err => logger.error(...))` 로 unhandledRejection 을 흡수했다. 변경 후 `await` 로 직렬 실행하며 `.catch` 핸들러가 제거됐다. 코드 주석에 "drive 는 내부 try/catch/finally 로 단말 상태를 자기 마킹하므로 예외를 worker 로 전파하지 않는다"고 설명하지만, 극단 케이스(DB save 자체가 실패 등)에서 예외가 누출되면 `rehydrateAndResume` 호출자(BullMQ worker `process()`)로 전파된다. BullMQ 는 이를 job 실패로 처리(attempt 감소 + 재시도)하므로 동일 continuation 이 재시도돼 멱등하지 않은 부작용(이중 실행)이 발생할 수 있다. `driveCallStackResume` 도 동일 구조.
- 제안: drive 함수 본문에 최외부 try/catch 를 유지하거나, `rehydrateAndResume` / `runExecutionFromQueue` 에서 `await drive(...)` 를 try/catch 로 감싸 worker 전파를 차단. 기존 `.catch(err => logger.error)` 패턴이 더 안전했다.

---

### [INFO] applyCancellation 의 RUNNING-중-cancel 의미 변경 — 부분 완료 시 CANCELLED 누락 가능
- 위치: `execution-engine.service.ts` — `applyCancellation` + 테스트 `execution-engine.service.spec.ts` W9
- 상세: 기존 코드는 in-memory 코루틴이 있으면 `rejectPending(executionId, ExecutionCancelledError)` 로 즉각 주입해 RUNNING 중 cancel 이 코루틴 catch 에 도달했다. 변경 후 `cancelParkedExecution` 은 `status = WAITING_FOR_INPUT` WHERE 가드가 있어 RUNNING 중 도달한 cancel 은 `affected: 0` → no-op 된다. 테스트 W9 는 이를 "graceful no-op — replay 는 완결, premature CANCELLED 미발사"로 명시적으로 기대하도록 수정됐다. 이 변경은 의도적 설계 결정이며 코드·테스트·spec 이 모두 일관되게 기술하고 있다. 다만 운영자 관점에서 "cancel 요청을 보냈는데 execution 이 COMPLETED 로 끝난다"는 직관에 어긋날 수 있으므로 INFO 로 기록한다.
- 제안: 운영 알림 또는 audit log 에 "cancel received during RUNNING — no-op, execution completed normally" 패턴을 명시. 현재 코드는 `affected: 0` 을 조용히 처리하므로 가시성 없음.

---

### [INFO] runExecutionFromQueue — await 직렬화 후 failFirstSegmentSetup 의 await 변환
- 위치: `execution-engine.service.ts` — `runExecutionFromQueue`
- 상세: 기존 코드는 `this.runExecution(...).catch(error => { ...; void this.failFirstSegmentSetup(...); })` — `failFirstSegmentSetup` 이 fire-and-forget(void). 변경 후 `await this.failFirstSegmentSetup(executionId, error)` 로 직렬 전환됐다. `failFirstSegmentSetup` 내부에서 DB 실패 시 예외가 `runExecutionFromQueue` 밖으로 전파돼 BullMQ 재시도를 유발할 수 있다. 재시도 시 execution 이 이미 FAILED 상태라면 `runExecutionFromQueue` 의 상태 가드(`execution.status !== PENDING` 등)가 조기 종료해 이중 실행을 막아야 한다 — 그 가드가 확실한지 확인이 필요.
- 제안: `failFirstSegmentSetup` 자체를 try/catch 로 감싸거나, 상태 가드가 FAILED row 를 방어함을 단위 테스트로 명시적으로 커버.

---

### [INFO] 기존 pendingContinuations Map 완전 제거 — 멀티 인스턴스 동시 resume 경쟁 조건 해소
- 위치: `execution-engine.service.ts` 전반
- 상세: 삭제된 `pendingContinuations` Map 은 단일 인스턴스 in-memory 공유 자원이었다. 다중 인스턴스 환경에서 같은 executionId 의 resume 이 서로 다른 인스턴스로 라우팅될 경우 fast-path miss 로 slow-path 로 전환했으나, BullMQ at-least-once 재전달로 같은 인스턴스에 두 번 resume 이 도달했을 때 Map 덮어쓰기 경쟁이 있었다. 이번 변경으로 해당 경쟁 조건이 구조적으로 제거됐다. 양의 변경.
- 제안: 해당 없음.

---

### [INFO] firstSegmentBarriers 및 settleFirstSegment — 배리어 해제 경쟁 조건 해소
- 위치: `execution-engine.service.ts` — 삭제된 `firstSegmentBarriers` Map, `armFirstSegmentBarrier`, `settleFirstSegment`, `signalParkBarrier`
- 상세: 삭제된 배리어 메커니즘은 "park 와 terminal 중 먼저 도달한 쪽이 배리어를 resolve" 하는 단발 경쟁이 있었다(`settled` 플래그로 멱등 처리). 이 경쟁 로직이 제거되고 단순 `await runExecution` 으로 대체됐다. park = 세그먼트 종료이므로 `runExecution` 이 반환하면 worker 가 자연스럽게 반환한다. 양의 변경.
- 제안: 해당 없음.

---

### [INFO] firePayload polling (setTimeout + 재귀 재스케줄) 제거 — 이벤트 루프 부하 해소
- 위치: `execution-engine.service.ts` — 삭제된 `firePayload` 함수 및 `NESTED_FIRE_POLL_MS` / `FIRE_PAYLOAD_MAX_ATTEMPTS` 상수
- 상세: 기존 코드는 `pendingContinuations` 키 등록을 polling(최대 250 × 20ms = 5s)으로 대기하며 이벤트 루프를 반복 점유했다. 동시 resume 증가 시 누적 지연이 우려됐고, 코드 주석도 이를 "임시 메커니즘 W19"로 명시했다. 이번 변경으로 직접 처리기 전달로 대체돼 이벤트 루프 부하가 구조적으로 제거됐다. 양의 변경.
- 제안: 해당 없음.

---

## 요약

이번 변경(exec-park D6 full B3)은 핵심 동시성 위험 요소였던 in-memory `pendingContinuations` Map과 `firstSegmentBarriers` 배리어, `firePayload` 폴링 스케줄러를 완전히 제거하고 §7.5 rehydration 단일 경로로 일원화함으로써 멀티 인스턴스 환경의 공유 자원 경쟁 조건을 구조적으로 해소했다. 동시성 위험도는 전반적으로 감소했다. 다만 두 가지 INFO 수준 사항이 남는다: (1) `await driveResumeDetached` / `await driveCallStackResume` 전환으로 극단 케이스에서 예외가 BullMQ worker 로 전파돼 의도치 않은 job 재시도를 유발할 가능성 — 기존 `.catch` 흡수 패턴이 더 방어적이었다. (2) RUNNING 중 cancel 이 `cancelParkedExecution` WHERE 가드(`status=WAITING_FOR_INPUT`)에 막혀 no-op 되는 의미 변경 — 의도적 설계지만 cancel 요청이 조용히 무시되는 가시성 부재가 운영상 혼란을 줄 수 있다. spec·테스트·코드가 모두 일관되게 기술하고 있으므로 즉각 차단 수준은 아니다.

## 위험도

LOW
