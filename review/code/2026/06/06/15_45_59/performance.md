# 성능(Performance) 리뷰 결과

## 발견사항

### 발견사항 없음 — 이번 변경은 성능 관점에서 순개선이다

이번 PR(exec-park D6 full B3)의 핵심은 **in-memory continuation/barrier 머신 완전 제거 + slow-path 단일 재개 경로 일원화**다. 아래는 각 점검 관점별 평가다.

---

- **[INFO] 메모리 누수 구조적 제거 — `pendingContinuations` Map 폐기**
  - 위치: `execution-engine.service.ts` (구 L722~1205 영역, 삭제된 `pendingContinuations`/`firstSegmentBarriers` 선언부)
  - 상세: 이전 구현에서 `pendingContinuations: Map<string, {nodeId, resolve, reject}>` 는 `waiting_for_input` 상태로 park 한 모든 실행의 resolver 를 in-memory 에 유지했다. 프로세스가 재시작되거나 LB 가 다른 인스턴스로 라우팅하면 이 Map 의 항목이 영구 잔류해 메모리 누수로 이어지는 구조였다. 이번 변경에서 `pendingContinuations`·`firstSegmentBarriers`·`signalParkBarrier`·`resolvePending`·`rejectPending`·`armFirstSegmentBarrier`·`settleFirstSegment` 전체가 제거됨으로써 park 중인 실행의 메모리 점유가 0 이 됐다 (bounded-memory 달성).
  - 제안: 없음 (개선 완료).

- **[INFO] 이벤트 루프 오염 구조(setTimeout 폴링 루프) 완전 제거**
  - 위치: `execution-engine.service.ts` (삭제된 `firePayload`/`FIRE_PAYLOAD_MAX_ATTEMPTS`/`FIRE_PAYLOAD_POLL_INTERVAL_MS` 상수·함수, `NESTED_FIRE_MAX_ATTEMPTS`/`NESTED_FIRE_POLL_MS`)
  - 상세: 이전 구현은 `pendingContinuations` 에 키 등록을 확인하는 polling — `setTimeout(() => firePayload(n-1), 20)` 을 최대 250 회 반복했다. 이 패턴은 재개가 일어날 때마다 이벤트 루프에 최대 5 초(250 × 20ms) 분의 타이머를 발행했으며, 동시 resume 이 많을수록 누적 이벤트 루프 지연이 비례해 악화됐다. 이번 변경에서 폴링 전체가 제거되고 `driveResumeDetached`/`driveCallStackResume` 가 도착 payload 를 직접 처리기(`processFormResumeTurn`/`processButtonResumeTurn`/`processAiResumeTurn`)로 전달하므로, 재개 latency 가 polling 대기 없이 즉각 처리된다.
  - 제안: 없음 (개선 완료).

- **[INFO] 장수 루프(`runAiConversationLoop`) 제거 — AI 멀티턴 BullMQ worker 슬롯 deadlock 해소**
  - 위치: `execution-engine.service.ts` (삭제된 `runAiConversationLoop` 메서드, `waitForAiConversation('await')` 분기)
  - 상세: 이전 구현에서 중첩 AI 대화(`executeInline` 안의 `waitForAiConversation('await')`)는 대화가 끝날 때까지 `while (!conversationEnded)` 루프를 in-memory 에서 유지했다. `CONTINUATION_WORKER_CONCURRENCY=1` 환경에서 이 루프가 worker `process()` 를 점유하면 다음 continuation job 전체가 wait 큐에 적체되는 deadlock 이 실측됐었다. 이번 변경에서 모든 park-site 가 turn-단위 park(`processAiResumeTurn` + re-park)로 전환됨에 따라 worker 슬롯 점유가 한 세그먼트(단발 turn)로 제한된다.
  - 제안: 없음 (개선 완료).

- **[INFO] worker 직접 await 전환 — 불필요한 Promise chain 제거**
  - 위치: `execution-engine.service.ts`, `runExecutionFromQueue` 메서드
  - 상세: 이전 구현은 `armFirstSegmentBarrier` → `runExecution().catch()` detach → `await settled` 3단계 Promise chain 을 사용해 worker 가 배리어를 통해 간접적으로 반환했다. 이번 변경에서는 `try { await this.runExecution(execution, input); } catch { ... }` 한 줄로 대체되어 불필요한 Promise 객체 생성·관리 비용이 사라지고 코드 경로가 단순해졌다.
  - 제안: 없음 (개선 완료).

- **[INFO] `driveResumeDetached`·`driveCallStackResume` — await 전환 후 에러 전파 처리**
  - 위치: `execution-engine.service.ts`, `resumeFromCheckpoint` 내 `driveResumeDetached` 호출
  - 상세: 이전 구현에서는 `.catch()` 로 에러를 삼켰다. 이번 변경에서 `await this.driveResumeDetached(...)` 로 직접 await 하지만 기존 `.catch()` 핸들러는 제거됐다. 코드 주석에 따르면 "drive 는 내부 try/catch/finally 로 단말 상태를 자기 마킹하므로 예외를 worker 로 전파하지 않는다"고 기술돼 있어 설계 의도는 명확하다. `driveResumeDetached` 자체가 자기 완결적 단말 마킹 구조라면 await 는 상위로 throw 되지 않으므로 성능 관점에서 문제 없다.
  - 제안: 없음. (로직 정확성은 correctness 리뷰 영역.)

- **[INFO] `processFormResumeTurn` 내 `nodeExecutionRepository.findOne` 추가 조회**
  - 위치: `execution-engine.service.ts`, `processFormResumeTurn` 메서드 상단
  - 상세: 새 직접 처리기는 `findOne({ where: {executionId, nodeId}, order: {startedAt: 'DESC'} })` 를 호출한다. 이는 이전 `waitForFormSubmission('await')` 경로에서도 동일하게 수행하던 조회 패턴과 동등하므로 추가 쿼리가 아니다. N+1 이나 루프 내 반복 호출도 없다.
  - 제안: 없음.

- **[INFO] e2e 테스트 — DB 직접 쿼리 (성능 관점 무관)**
  - 위치: `test/execution-park-resume.e2e-spec.ts`
  - 상세: `db.query(SELECT ... FROM execution WHERE id = $1)` 등 2~3 건의 직접 DB 조회가 추가됐다. e2e 검증 목적의 단발 포인트 조회(PK 조건)로, 성능 영향 없다.
  - 제안: 없음.

- **[INFO] 테스트 코드 — 반복 `jest.spyOn` + `mockRestore` 패턴**
  - 위치: `execution-engine.service.spec.ts`, `applyContinuation` 관련 테스트들
  - 상세: 여러 `it()` 블록에서 `rehydrateAndResume` 에 대한 `jest.spyOn(...)` 을 독립적으로 반복 생성한다. 테스트 파일이므로 프로덕션 성능에 영향 없다. `beforeEach` 로 공통 spy 를 뽑으면 코드 중복을 줄일 수 있지만, 각 테스트가 독립적 `mockRestore` 를 호출하는 패턴이 의도적이므로 현 구조도 허용 범위다.
  - 제안: 테스트 중복 제거는 선택 사항 — 성능 영향 없음.

---

## 요약

이번 변경(exec-park D6 full B3)은 in-memory continuation 머신(`pendingContinuations` Map, `firstSegmentBarriers` Map, `firePayload` setTimeout polling 루프 최대 250회×20ms, `runAiConversationLoop` 장수 루프)을 완전히 제거하고 park=세그먼트 종료 + §7.5 rehydration 단일 경로로 일원화했다. 이 변경은 (1) park 중인 실행당 in-memory 메모리 점유를 0 으로 낮추고, (2) 이벤트 루프에 발행되던 누적 타이머(재개 당 최대 5초 폴링) 를 제거해 재개 latency 를 polling 대기 없이 즉각 처리되도록 개선하며, (3) AI 멀티턴 대화 중 worker 슬롯 deadlock 위험을 구조적으로 차단한다. 성능 관점에서 우려 사항이 없으며 모든 변경이 긍정적 방향이다.

## 위험도

NONE
