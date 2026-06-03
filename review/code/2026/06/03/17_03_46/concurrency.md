# 동시성(Concurrency) 리뷰 결과

## 발견사항

이번 변경은 LLM 호출·tool 실행의 절대 시각(`startedAt`/`finishedAt` ISO8601)을 백엔드 측정 → WS 이벤트 페이로드 → 프론트 스토어 → UI 렌더링까지 전파하는 타임스탬프 관통 기능이다. 동시성 관련 코드가 포함되어 있으므로 분석한다.

### [INFO] `SANITIZE_CACHE` WeakMap 모듈 스코프 공유 — Node.js 단일 이벤트 루프 전제 확인

- 위치: `codebase/backend/src/modules/websocket/websocket.service.ts` — `const SANITIZE_CACHE = new WeakMap<object, unknown>()`
- 상세: `SANITIZE_CACHE` 는 모듈 레벨 싱글턴이다. Node.js 는 단일 이벤트 루프이므로 진정한 동시 쓰기는 발생하지 않는다. 하지만 `emitExecutionEvent` 는 `async` 함수이고 내부에서 `await this.seqAllocator.next(executionId)` 를 호출한 뒤 `sanitizePayloadForWs` 가 호출된다. `await` 지점에서 이벤트 루프가 다른 coroutine 에게 제어권을 넘기지만, `sanitizePayloadForWs` 자체는 동기 함수이고 WeakMap read/write 가 그 동기 블록 내에서 완결된다. 따라서 실질적인 경쟁 조건은 없다. 이번 변경(`startedAt`/`finishedAt` 필드 추가)은 SANITIZE_CACHE 동작에 영향을 주지 않는다.
- 제안: 현 코드 패턴 유지 적절. 단, 향후 멀티스레드(Worker threads) 적용 시 cache 공유 방식 재검토 필요.

### [INFO] `Date.now()` 호출 이후 `new Date().toISOString()` 재호출로 인한 미세 시각 오차

- 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` — `executeTool` 메서드 및 `singleTurn` 루프
- 상세:
  ```
  const startedAt = Date.now();
  const startedAtIso = new Date(startedAt).toISOString();   // startedAt 동일 epoch 재사용 ✅
  ...
  const durationMs = Date.now() - startedAt;
  const finishedAtIso = new Date().toISOString();           // 별도 Date.now() 호출
  ```
  `finishedAtIso` 는 `new Date()` 로 캡처하고, `durationMs` 는 별도의 `Date.now()` 로 계산한다. 두 호출은 나노초 이하 수준의 연산 사이에 발생하므로 실질적 오차는 1ms 미만이다. 그러나 사양은 "`finishedAt = startedAt + durationMs` 관계를 만족한다 (engine 이 둘 다 직접 측정해 ms 단위 미세 차이 가능)" 로 이를 명시 허용했다. LLM 호출의 경우도 동일 패턴이다.
  ```
  durationMs: Date.now() - callStartedAt,
  startedAt: new Date(callStartedAt).toISOString(),
  finishedAt: new Date().toISOString(),
  ```
  `finishedAt - startedAt != durationMs` 가 1ms 수준에서 발생할 수 있으나, spec 이 이를 명시 허용한다. 원자성 위반은 아니며 기능적 문제도 없다.
- 제안: 일관성을 위해 `const finishedAtMs = Date.now(); const durationMs = finishedAtMs - startedAt; const finishedAtIso = new Date(finishedAtMs).toISOString();` 패턴으로 단일 캡처하면 spec 관계식 오차를 0으로 줄일 수 있다. 필수 수정 아님.

### [INFO] `executionRouting` Map 비동기 해제 타이밍 — 동일 executionId 재사용 엣지케이스

- 위치: `codebase/backend/src/modules/websocket/websocket.service.ts` — `emitExecutionEvent` 의 terminal event 처리
- 상세:
  ```typescript
  if (TERMINAL_EXECUTION_EVENTS.has(eventType)) {
    this.seqAllocator.release(executionId);
    this.releaseExecutionRouting(executionId);
  }
  ```
  terminal event emit 후 동기적으로 routing context 를 해제한다. `emitExecutionEvent` 는 `async` 함수이고 `seqAllocator.next(executionId)` await 후 계속 진행된다. 만약 동일 executionId 에 대해 두 `emitExecutionEvent` 호출이 거의 동시에 진입해 (1) 첫 번째가 await 중일 때 (2) 두 번째도 await 를 통과하고 terminal event 를 먼저 완료하면, 첫 번째의 후속 `executionEventSubject.next` 가 이미 해제된 routing context 없이 발행될 수 있다. 그러나 execution 의 terminal event 는 실행 엔진이 단일 경로로 발행하도록 설계되어 있으므로, 실제 two-concurrent-terminal 시나리오는 정상 흐름에서 발생하지 않는다. 이번 변경은 이 경로에 영향을 주지 않는다.
- 제안: 구조적 주의 사항으로 기록. 현재 변경 범위에서 추가 조치 불필요.

## 요약

이번 변경은 LLM 호출과 tool 실행의 시작·종료 절대 시각을 ISO8601 문자열로 측정·전파하는 순수 데이터 부착 작업이다. 백엔드는 Node.js 단일 이벤트 루프 위에서 `Date.now()` 동기 캡처를 사용하고, 프론트엔드는 React 상태 업데이트 + Zustand store 단일 subscriber 모델이다. 락, 공유 변경 가능 상태의 동시 접근, async/await 누락, 이벤트 루프 블로킹 등 실질적인 동시성 결함은 관찰되지 않는다. `finishedAt` 산출 시 `Date.now()` 를 두 번 호출해 1ms 수준의 오차가 있으나 spec 이 명시 허용한다. 모든 발견사항은 구조적 관찰 수준이며 기능적 위험은 없다.

## 위험도

NONE
