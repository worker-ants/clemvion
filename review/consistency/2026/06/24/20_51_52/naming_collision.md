# 신규 식별자 충돌 검토 결과

검토 범위: 06-concurrency C-1 + M-7 (publish fail-fast 통일)
검토 모드: --impl-prep (구현 착수 전)

---

## 발견사항

### 1. `ContinuationPublishResult` — 기존 인터페이스와 완전 일치, 충돌 없음

- **[INFO]** 신규 도입이 아닌 기존 식별자 재사용
  - target 신규 식별자: `ContinuationPublishResult` (C-1 이 `cancelWaitingExecution` 에 동일 반환 타입 부여)
  - 기존 사용처: `/Volumes/project/private/clemvion/codebase/backend/src/modules/execution-engine/execution-engine.service.ts:329` — `continueExecution`, `continueButtonClick`, `continueAiConversation`, `endAiConversation`, `publishRetryLastTurn` 5개 메서드가 이미 반환
  - 상세: 인터페이스 정의 자체는 이미 존재(`{ queued: boolean; jobId: string | null }`)하며 C-1 이 이를 `cancelWaitingExecution` 에도 적용하는 패턴 통일이므로 의미·구조 충돌 없음
  - 제안: 변경 없음

### 2. `CONTINUATION_ENQUEUE_FAILED` — 신규 에러 코드이며 기존 코드와 미충돌, 단 카탈로그 등재 필요

- **[INFO]** 기존 카탈로그·codebase 어디에도 이 문자열이 없음 — 순수 신규 도입
  - target 신규 식별자: `CONTINUATION_ENQUEUE_FAILED` (C-1 의 REST `stop()` WAITING 분기에서 503 표면화 시 사용 예정 에러 코드)
  - 기존 사용처: 없음. 유사한 존재: `RESUME_FAILED`(continuation-queue 재시도 소진 시), `INVALID_EXECUTION_STATE`(WS continuation 상태 불일치), `INVALID_STATE`(REST core 상태 불일치) — 의미가 달라 충돌 아님
  - 상세: `queued:false` 표면화를 위해 도입될 신규 코드. 기존 에러 코드는 publish 후 처리 실패(`RESUME_FAILED`)나 상태 불일치(INVALID_STATE 계열)를 다루지만, 이 코드는 publish 자체가 실패(Redis INCR / BullMQ enqueue 오류)를 다루므로 의미 분리가 명확함. `/Volumes/project/private/clemvion/spec/5-system/3-error-handling.md` 에 미등재 상태.
  - 제안: 구현 PR 후 planner 위임으로 에러 카탈로그 등재 (spec §7.4 1줄 + 에러코드 카탈로그). 코드명은 error-codes 명명 규약(`spec/conventions/error-codes.md §1`) 도메인 prefix 원칙에 맞음(`CONTINUATION_<CONDITION>`).

### 3. `cancelWaitingExecution` 서명 변경 — 기존 호출부가 `void` 를 가정

- **[WARNING]** 기존 호출부가 반환값 없음을 전제한 호출 패턴
  - target 신규 식별자: `cancelWaitingExecution` 의 반환 타입을 `void` → `Promise<ContinuationPublishResult>` 로 변경 (C-1)
  - 기존 사용처:
    - `/Volumes/project/private/clemvion/codebase/backend/src/modules/executions/executions.service.ts:730` — `this.executionEngineService.cancelWaitingExecution(id)` (반환값 미사용, void 로 호출)
    - `/Volumes/project/private/clemvion/codebase/backend/src/modules/websocket/websocket.gateway.spec.ts:78` — mock `cancelWaitingExecution: jest.fn()` (동기 void mock)
    - `/Volumes/project/private/clemvion/codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:1143-1144, 4173` — 테스트에서 void 동기 호출로 검증
  - 상세: 서명이 async 로 바뀌면 호출부 `executions.service.ts:730` 이 `await` 없이 호출하면 Promise 가 unhandled float 될 가능성. spec §7.4 queued 계약을 반영하려면 이 호출부도 `await` + `queued=false` 시 503 surface 가 함께 변경돼야 함. 테스트 mock 도 async mock 으로 갱신 필요.
  - 제안: C-1 구현 시 `executions.service.ts:stop()` 의 WAITING 분기를 `await cancelWaitingExecution()` + `queued=false` 시 503 throw 로 함께 수정. 테스트 mock 은 `jest.fn().mockResolvedValue(...)` 로 전환.

### 4. `nextSeq` — 메서드 이름은 그대로, throw 전파 의미론 변경

- **[INFO]** 메서드명 충돌 없음, 단 동작 의미 변경이 `publish` 반환 계약에 영향
  - target 신규 식별자: `ContinuationBusService.nextSeq` 내부 동작 변경 (M-7) — random fallback 제거 → throw 전파
  - 기존 사용처: `/Volumes/project/private/clemvion/codebase/backend/src/modules/execution-engine/continuation/continuation-bus.service.ts:153` — private 메서드. 호출자는 `publish` 하나뿐.
  - 상세: `nextSeq` 가 throw 하면 `publish` catch 블록(`:136`)이 잡아 `null` 을 반환하므로 `publish` 의 외부 시그니처(`Promise<string | null>`)는 변경 없음. `ContinuationPublishResult.queued = (jobId !== null)` 계산도 불변. 기존 `conversation-thread.types.ts` 의 `nextSeq: number` 필드(`spec/conventions/conversation-thread.md`)는 ConversationThread 의 완전히 다른 개념(턴 시퀀스 카운터)이며 이름 동일성이 혼동 가능하나 코드 경로가 완전 분리돼 실질 충돌 없음.
  - 제안: 변경 없음. 다만 코드 주석에 "이 `nextSeq` 는 Redis seq 생성기이며 `ConversationThread.nextSeq` 와 무관" 을 명시하면 독자 혼동 예방.

---

## 요약

C-1 + M-7 이 도입하는 신규 식별자는 (1) `ContinuationPublishResult` 는 기존 인터페이스 재사용이라 이름 충돌이 없고, (2) `CONTINUATION_ENQUEUE_FAILED` 는 기존 에러 코드·codebase 어디에도 존재하지 않아 순수 신규이며 명명 규약과 정합하며, (3) `ContinuationBusService.nextSeq` private 메서드는 이름이 기존이고 외부 시그니처는 불변이라 충돌 없다. 유의할 점은 `cancelWaitingExecution` 의 반환 타입이 `void -> Promise<ContinuationPublishResult>` 로 변경됨에 따라 기존 호출부(`executions.service.ts:730`)와 관련 테스트 mock 이 동기 void 가정으로 작성돼 있어 함께 갱신되지 않으면 unhandled promise 또는 stop 실패 미표면화가 발생할 수 있다. 이 변경은 C-1 구현 범위에 포함된 것이므로 식별자 충돌이 아닌 구현 체크리스트 항목이다.

## 위험도

LOW
