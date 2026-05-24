# 동시성(Concurrency) 리뷰 결과

## 발견사항

### [INFO] `executionRouting` Map — Node.js 단일 스레드 모델에서 안전, 단 비고 있음
- 위치: `codebase/backend/src/modules/websocket/websocket.service.ts` — `private readonly executionRouting = new Map<string, ExecutionRoutingContext>()`
- 상세: Node.js 는 싱글 이벤트 루프이므로 JavaScript `Map` 에 대한 동시 접근 경쟁 조건은 원칙적으로 발생하지 않는다. `registerExecutionRouting` → `emitExecutionEvent` → `releaseExecutionRouting` 의 호출 순서 자체도 모두 동기 코드이므로 인터리빙이 없다. 현재 구현은 Node.js 환경 기준으로 스레드 안전하다.
- 제안: 유지. Worker Threads 나 외부 멀티프로세스 공유 상태로 변경될 경우 재검토 필요.

### [INFO] `executionRouting` Map — terminal event 자동 release 와 명시 release 중복 호출 안전성
- 위치: `websocket.service.ts` `emitExecutionEvent` + `execution-engine.service.ts` `execute()` catch 블록
- 상세: 정상 흐름에서 terminal event 발송 시 `releaseExecutionRouting` 가 자동 호출되고, 엔진 catch 블록에서도 `releaseExecutionRouting` 를 명시 호출한다. `Map.delete` 는 키가 없는 경우에도 안전하게 `false` 를 반환하므로 이중 호출에 의한 오류는 없다. 다만 정상 종료 흐름(terminal event emit 성공)에서도 catch 블록이 실행되는 경우(fire-and-forget의 `.catch` 가 항상 체이닝)는 구조상 double-release 가 가능하다. 결과는 안전하지만 의도와의 일치 여부를 확인할 필요가 있다.
- 제안: `.catch` 블록의 주석이 "terminal event 를 emit 하지 못한 경로" 로 명확히 한정하고 있어 의도는 분명하다. 실제로 `runExecution` 내부에서 terminal event 를 성공적으로 emit 한 후 다른 이유로 Promise 가 reject 되는 케이스가 있는지 확인 권장. 없다면 현재 설계가 더 안전한 defensive 패턴으로 적절하다.

### [INFO] `inflight` Map — null sentinel 캐싱과 세션 등록 타이밍의 TOCTOU 성격 패턴
- 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-tool-provider.ts` — `materializeServer`
- 상세: `openServer` 가 `null` 을 반환하는 경우, `inflight` 에는 `null` 로 resolve 되는 Promise 가 저장된다. `finally` 블록에서 `inflight.delete(inflightKey)` 를 호출하므로 동일 `inflightKey` 에 대한 후속 호출은 다시 `openServer` 를 실행한다. Node.js 싱글 스레드이므로 경쟁 조건은 없으나, `null` 반환 경로(not_capable)에서 동일 키로 반복 호출 시 매번 `getForExecution` 을 거친다. 트래픽이 많은 시나리오에서는 불필요한 I/O 가 발생할 수 있다.
- 제안: not_capable 결과를 `inflightKey` 기준으로 짧게 캐싱(예: 실행 단위 세션과 동일 lifecycle)하는 방법을 고려할 수 있으나, 현재 사용 빈도(AI Agent 턴당 1회)와 I/O 비용을 감안하면 즉시 수정 필요 수준은 아니다. INFO 수준으로 기록.

### [INFO] fanout envelope 구성 — `attachRoutingContext` 의 shallow spread
- 위치: `websocket.service.ts` `attachRoutingContext` 메서드
- 상세: `wireEnvelope` 와 `additions` 를 `{ ...wireEnvelope, ...additions }` 로 shallow merge 한다. `wireEnvelope` 는 이미 sanitize 된 객체이고, `chatChannel` 도 `sanitizePayloadForWs` 를 거쳐 첨부되므로 deep mutation 위험은 없다. context 가 없을 때 `wireEnvelope` 동일 참조를 반환하는 최적화도 적절하다. 다만 context 가 있을 때는 새 객체를 생성하므로 `wireEnvelope` 원본은 변경되지 않는다 — 안전.
- 제안: 유지.

### [INFO] Subject 기반 fanout — 동기 구독자 처리 보장
- 위치: `websocket.service.ts` `executionEventSubject = new Subject<ExecutionChannelEvent>()`
- 상세: RxJS `Subject.next()` 는 동기적으로 모든 현재 구독자의 handler 를 호출한다. `ChatChannelDispatcher` 나 `NotificationFanout` 이 구독자인 경우, `emitExecutionEvent` 내에서 synchronous 하게 처리가 시작된다. handler 가 내부적으로 async 작업을 fire-and-forget 하는 구조라면 에러 처리·back-pressure 가 없을 수 있다. 이는 기존 아키텍처에서 이미 전제하고 있는 패턴이며 이번 변경에서 새로 도입되지 않았다.
- 제안: 기존 Subject 패턴과 동일하므로 이번 변경에서 문제 없음. 별도 관찰 사항으로 기록.

## 요약

변경 코드의 핵심 동시성 요소는 `WebsocketService.executionRouting` Map 과 `McpToolProvider.inflight` Map 두 개다. 두 구조 모두 Node.js 싱글 이벤트 루프 환경에서 동작하므로 스레드 기반 경쟁 조건은 발생하지 않는다. `executionRouting` 의 lifecycle(register → emit 시 자동 attach → terminal event 후 auto-release + catch 블록 explicit release)은 명확하고, `Map.delete` 이중 호출도 안전하다. `attachRoutingContext` 는 context 미등록 시 동일 참조를 반환하고 context 등록 시 새 객체를 spread 하여 wire envelope 원본을 보호한다. `inflight` Map 의 null sentinel 경로는 기능상 안전하나 반복 호출 시 불필요한 I/O 를 유발할 여지가 INFO 수준으로 존재한다. async/await 누락, 데드락, 이벤트 루프 블로킹 등의 문제는 발견되지 않았다. 전반적으로 동시성 위험도는 낮다.

## 위험도

LOW
