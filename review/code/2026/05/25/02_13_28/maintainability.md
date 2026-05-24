# 유지보수성(Maintainability) 리뷰

리뷰 대상: fix-chat-channel-dispatcher-and-cafe24-warn PR (7개 코드 파일 + 1개 plan + 1개 consistency 산출물)

---

## 발견사항

### 파일 1: `execution-event-emitter.service.ts`

- **[INFO]** `registerExecutionRouting` / `releaseExecutionRouting` 가 `WebsocketService` 로 단순 위임하는 pass-through 메서드
  - 위치: L51-65 (신규 추가 메서드 전체)
  - 상세: 두 메서드 모두 파라미터 변환 없이 `this.websocketService.<동일메서드>` 로 그대로 호출한다. 이 수준의 thin wrapper 는 현재 단계에서는 테스트 격리와 향후 채널 다중화를 위한 facade 패턴 의도가 클래스 주석에 명시적으로 서술되어 있어 이해 가능하다. 다만 클래스가 `emitExecution`, `emitNode`, `registerExecutionRouting`, `releaseExecutionRouting` 네 가지 서로 다른 동작 계층(이벤트 발행 vs 라이프사이클 관리)을 단일 클래스에 담고 있으므로, 향후 기능 추가 시 책임 분리를 재검토할 기회가 생길 수 있다.
  - 제안: 현 시점에서는 수용 가능. 클래스 주석에 "라우팅 컨텍스트 관리" 가 facade 범위에 포함됨을 한 문장 추가해 책임 경계를 명확히 표기 권장.

---

### 파일 3: `execution-engine.service.ts`

- **[INFO]** `extractChatChannelFromInput` 함수 — 직렬 타입 단언(type assertion chaining) 가독성
  - 위치: L271-281 (`extractChatChannelFromInput` 함수 본문)
  - 상세: `(input as { chatChannel?: unknown }).chatChannel` → `(raw as { provider?: unknown }).provider` → `(raw as { conversationKey?: unknown }).conversationKey` 식으로 inline assertion 을 3회 중첩한다. TypeScript 의 `unknown` 안전 추출 관용구로 허용 범위이나, `zod` 또는 단순 type guard 함수로 추출하면 코드가 더 선언적으로 읽힌다. 규모가 크지 않아 즉각 리팩터링 대상은 아님.
  - 제안: 현 함수 자체가 모듈-private 이고 단일 호출 지점만 있어 큰 문제 없음. 향후 chatChannel shape 이 확장될 때 타입 guard 분리를 검토.

- **[INFO]** `execute()` 내부 인라인 주석 번호 체계 (`// 2.5.`) 가 기존 주석 체계와 혼재
  - 위치: L756 근방 `// 2.5. Register outbound routing context`
  - 상세: 기존 코드에 `// 1.`, `// 2.`, `// 3.` 등의 단계 번호 주석 체계가 있는 것으로 보이며, 신규 삽입 단계에 `// 2.5.` 를 사용했다. 소수점 번호는 가독성을 떨어뜨리며, 향후 단계 추가 시 `.5`, `.75` 같은 패턴으로 발산할 수 있다.
  - 제안: `// 3.` 이후를 순서 재번호화하거나, 삽입 지점을 설명하는 짧은 설명 주석으로 대체.

- **[WARNING]** `execute()` fire-and-forget `.catch` 블록 내 `releaseExecutionRouting` 호출 — 누수 방지 경로가 숨겨진 곳에 위치
  - 위치: L779 `this.eventEmitter.releaseExecutionRouting(executionId);` (`.catch` 블록 내)
  - 상세: routing context 의 정상 release 경로는 `emitExecutionEvent` 내부 terminal event 감지 → `WebsocketService.releaseExecutionRouting` 이다. 비정상 경로 release 는 `.catch` 블록 안에 단독 위치한다. 이 두 경로는 코드 상 서로 다른 레이어에 위치해 있어 routing context lifecycle 을 추적하려면 (a) `WebsocketService.emitExecutionEvent`, (b) `ExecutionEngineService.execute().catch` 두 곳을 함께 읽어야 한다. 주석이 의도를 설명하고 있어 치명적이지 않지만, 향후 `.catch` 블록이 확장될 때 누락될 위험이 있다.
  - 제안: `.catch` 블록 첫 줄에 `// routing context cleanup (pair: WebsocketService.emitExecutionEvent terminal branch)` 형태로 pair 관계를 명시. 또는 `releaseExecutionRouting` 을 내부적으로 멱등(idempotent) 호출이 두 번 일어나도 무해하게 유지하고(현재도 그렇다), 해당 release 쌍을 단일 헬퍼로 추출하는 것을 중기 리팩터링 후보로 표기.

---

### 파일 5: `websocket.service.ts`

- **[INFO]** `attachRoutingContext` — `Object.keys(additions).length === 0` 조기 반환
  - 위치: L844 `if (Object.keys(additions).length === 0) return wireEnvelope;`
  - 상세: `ctx` 가 존재하지만 `triggerId` 도 `chatChannel` 도 모두 falsy 인 경우를 방어하는 코드다. `ExecutionRoutingContext` 인터페이스의 두 필드가 모두 optional 이므로 빈 객체 등록도 가능하다. 이 케이스가 실제로 발생할 수 있는지(의도된 상태인지, 잘못된 등록인지)가 불분명하다.
  - 제안: `registerExecutionRouting` 에서 `triggerId` 와 `chatChannel` 이 모두 없는 경우 early return 하거나 경고를 남기도록 추가. 또는 인터페이스 레벨에서 적어도 하나 이상의 필드가 set 되도록 타입을 `{ triggerId: string; chatChannel?: ... } | { triggerId?: string; chatChannel: ... }` 형태로 좁히는 것을 고려.

- **[INFO]** `emitExecutionEvent` / `emitNodeEvent` 의 envelope 생성 로직 중복
  - 위치: L323-346 (`emitExecutionEvent`), L379-396 (`emitNodeEvent`)
  - 상세: 두 메서드는 `sanitizePayloadForWs` → `wireEnvelope` 생성 → `broadcastToChannel` → `attachRoutingContext` → `executionEventSubject.next` 순서가 동일하며, 차이는 `nodeId` 필드 포함 여부와 terminal event 후 `releaseSeqCounter` / `releaseExecutionRouting` 호출 여부뿐이다. 이미 기존 코드에서 공유하던 패턴이라 본 PR 이 새로 도입한 중복은 아니지만, `attachRoutingContext` 호출이 두 곳에 동시에 추가됨으로써 이 패턴이 더 강화되었다.
  - 제안: 즉각 리팩터링 요구 수준은 아니나, `emitNodeEvent` 가 terminal event 후 routing context 를 release 하지 않는다는 점(정상 동작이지만)을 주석으로 명시해 두면 미래 독자가 "왜 `releaseExecutionRouting` 이 없는가?"를 의문 없이 읽을 수 있다.

- **[INFO]** `ExecutionRoutingContext.chatChannel` 타입이 `Record<string, unknown>` 로 매우 넓음
  - 위치: L706 `chatChannel?: Record<string, unknown>;` (인터페이스 선언)
  - 상세: `chatChannel` 의 실제 shape 은 `{provider: string, conversationKey: string, channelUserKey?: string}` 으로 알려져 있다 (`extractChatChannelFromInput` 함수가 `provider` 와 `conversationKey` 를 검증함). 인터페이스에서 `Record<string, unknown>` 로 열어 두면 타입 시스템의 보호를 받지 못하고, dispatcher 등 소비 측에서도 매번 동적 필드 접근이 필요하다. 주석에 "sanitize 는 WebsocketService 측에서 적용" 이라는 설명이 있으나 이것이 타입을 열어 두는 이유를 정당화하지는 않는다.
  - 제안: `chatChannel` 에 named interface 또는 type alias (`ChatChannelRoutingInfo`) 를 도입해 `provider`, `conversationKey`, `channelUserKey` 를 known 필드로 선언하고 나머지를 index signature 로 허용하거나, 아니면 타입을 좁혀 dispatcher 측 코드를 type-safe 하게 유지.

---

### 파일 7: `mcp-tool-provider.ts`

- **[WARNING]** `null` sentinel 반환 — 반환 타입 변경이 기존 `openServer` JSDoc "Throws on connection / list-tools failure" 설명과 의미론적 충돌
  - 위치: L999-1000 (`openServer` 반환 타입 `Promise<ServerEntry | null>`), L991 (`if (!entry) return []`)
  - 상세: `openServer` 는 원래 "연결 실패 시 throw, 호출자가 `Promise.allSettled` 로 처리"라는 계약을 가졌다. 이번 변경으로 `not_capable` 케이스만 `null` 을 반환하고, 나머지 실패(connection error 등)는 여전히 throw 한다. 두 가지 에러 처리 방식(throw vs null sentinel)이 동일 함수 안에 공존하게 되었다. `materializeServer` 에서 `null` 을 받아 `[]` 반환하는 흐름은 올바르게 구현되어 있으나, 향후 다른 silent-skip 케이스가 추가될 때 이 패턴을 일관성 없이 확장할 위험이 있다.
  - 제안: `null` sentinel 보다 명시적인 방법으로, `openServer` 내부에서 `not_capable` 분기를 조기에 처리한 뒤 `buildTools` 레벨에서 각 ref 를 처리하기 전에 serviceType 를 체크하도록 상위로 올리거나, `not_capable` 전용 result type (`{ kind: 'not_capable' } | { kind: 'ok'; entry: ServerEntry }`)을 사용해 throw / null 혼용을 제거하는 것을 중기 리팩터링 후보로 표기. 단기적으로는 JSDoc 에 "null 반환 = not_capable skip, 모든 다른 실패는 throw" 를 명시적으로 기술.

- **[INFO]** `inflight` Map 타입 변경 — `Promise<ServerEntry>` → `Promise<ServerEntry | null>` 이 Map 레벨까지 노출
  - 위치: L972 `private readonly inflight = new Map<string, Promise<ServerEntry | null>>();`
  - 상세: inflight 캐시는 "동시에 같은 서버를 두 번 열지 않기 위한" de-dup 용도다. `null` 을 반환하는 promise 가 캐시에 남으면, 두 번째 동시 호출도 `null` 을 받아 동일하게 skip 된다. 이 동작은 의도한 것으로 보이나 명시되어 있지 않다.
  - 제안: `inflight` 의 JSDoc 또는 인라인 주석에 "not_capable(null) 결과도 de-dup 대상 — 같은 ref 를 복수 빌더가 동시에 요청해도 각자 null 받아 skip" 을 추가.

---

### 파일 2, 4, 6: spec 파일 (`.spec.ts`)

- **[INFO]** `mcp-tool-provider.spec.ts` — `warnSpy` 설정·해제 코드가 두 테스트에 동일하게 반복
  - 위치: `mcp-tool-provider.spec.ts` L881-902, L927-948 (두 `it` 블록 각각)
  - 상세: `jest.spyOn((McpToolProvider as unknown as { logger: { warn: jest.Mock } }).logger, 'warn').mockImplementation(...)` + `try/finally warnSpy.mockRestore()` 패턴이 두 테스트에서 완전 동일하게 반복된다. 테스트 코드 중복은 `beforeEach` / `afterEach` 훅 또는 헬퍼 함수로 줄일 수 있다.
  - 제안: `describe` 블록 상단에서 `beforeEach(() => { warnSpy = jest.spyOn(...).mockImplementation(...); })` + `afterEach(() => { warnSpy.mockRestore(); })` 패턴으로 추출. 또는 `suppressWarnSpy()` helper 함수로 패턴을 추상화.

- **[INFO]** `websocket.service.spec.ts` — `nextFanoutEvent` / `collectFanoutEvents` 헬퍼가 `describe` 블록 내부에 위치
  - 위치: L364-373
  - 상세: 두 헬퍼 함수는 현재 `describe` 블록 스코프 안에 정의되어 있다. 향후 다른 `describe` 블록에서도 fanout 이벤트를 검증할 필요가 생기면 복사하거나 상위로 이동해야 한다. 현재 파일 내에서 이 헬퍼를 사용하는 `describe` 가 하나뿐이므로 즉각 문제는 아니다.
  - 제안: 파일 최상단 또는 `describe('WebsocketService', ...)` 블록 바로 안쪽으로 이동해 재사용 가능성을 열어 두는 것을 고려.

---

## 요약

이번 PR 은 두 개의 독립된 회귀(chat-channel routing context 미전달, Cafe24 통합 WARN 노이즈)를 다루며, 각각의 수정 방향이 명확하고 코드 의도가 풍부한 JSDoc 으로 잘 문서화되어 있다. `wireEnvelope` / `fanoutEnvelope` 명칭 분리, `extractChatChannelFromInput` 독립 함수 분리, `attachRoutingContext` private 메서드화 등 가독성 결정은 모두 긍정적이다. 주요 유지보수성 우려는 두 가지다. 첫째, `execute().catch` 블록의 routing context release 가 `emitExecutionEvent` 내 terminal event release 와 페어를 이루지만 코드 상 멀리 떨어져 있어 lifecycle 추적이 어렵다. 둘째, `openServer` 가 throw 와 null sentinel 이라는 두 가지 에러 처리 방식을 혼용해 "null 반환 = skip, throw = 실패"라는 암묵적 계약이 JSDoc 없이는 직관적이지 않다. 이 두 지점을 주석 보강 또는 중기 리팩터링 후보로 명시해 두는 것을 권장한다.

---

## 위험도

LOW
