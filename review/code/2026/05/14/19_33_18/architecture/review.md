### 발견사항

---

**[WARNING] 순환 모듈 의존성 — `nodes/core` ↔ `execution-engine`**
- 위치: `node-handler.interface.ts:127`, `execution-engine/context/execution-context.service.ts`
- 상세: `nodes/core/node-handler.interface.ts`가 동적 import 구문(`import('../../modules/execution-engine/conversation-thread/conversation-thread.types').ConversationThread`)으로 `execution-engine` 모듈 내 타입을 참조한다. 동시에 `execution-engine`은 `nodes/core/node-handler.interface` 의 `ExecutionContext`를 import한다. TypeScript는 타입-전용 dynamic import이므로 런타임 순환은 발생하지 않지만, 논리적 레이어 순환(노드 코어 → 엔진 → 노드 코어)이 성립한다.
- 제안: `ConversationThread` 관련 타입을 `backend/src/shared/types/` 또는 `nodes/core/` 하위로 이동해 양방향 의존을 단방향(`execution-engine` → `shared` ← `nodes/core`)으로 정리한다.

---

**[WARNING] WebSocket 대기 페이로드에 mutable 참조 전달**
- 위치: `execution-engine.service.ts` — `emitFormWaitingForInput`, `emitAiWaitingForInput`, `emitButtonsWaitingForInput` 호출부
- 상세: `conversationThread: context.conversationThread`로 live 객체 참조를 payload에 넣는다. 이 payload가 직렬화되기 전에 동일 실행 흐름에서 `append*`가 호출되면 이미 emit된 이벤트 객체가 변형될 수 있다. 특히 `turns` 배열은 shallow copy 없이 공유된다.
- 제안: emit 직전에 `{ ...context.conversationThread, turns: [...context.conversationThread.turns] }` shallow snapshot을 취한다. `BackgroundExecutionJob` enqueue 시 동일 패턴이 이미 적용된 것(line ~3749)을 일관되게 확장하면 된다.

---

**[WARNING] multi-turn 후속 tick의 conversationThread가 undefined 가능**
- 위치: `execution-engine.service.ts:2120-2125`
- 상세: `this.contextService.getContext(executionId)?.conversationThread`는 context가 이미 삭제된 경우 `undefined`를 반환한다. 페이로드 타입이 `ConversationThread | undefined`를 허용하지 않는다면 다운스트림에서 타입 불일치가 발생한다.
- 제안: `conversationThread` 필드를 optional(`conversationThread?: ConversationThread`)로 선언하거나, context가 없으면 이 코드 경로 자체를 타지 않는다는 불변식을 주석으로 명시하고 non-null assertion(`!`)을 사용해 의도를 명시적으로 표현한다.

---

**[INFO] `buildThreadView`의 eager text 렌더링**
- 위치: `expression-resolver.service.ts:113`
- 상세: `buildExpressionContext` 호출마다 `renderThreadAsSystemText(thread.turns)`를 즉시 평가한다. cap 최대값(100턴 × 4,000자 = 400K chars)에서 이 함수가 매 노드 실행마다 불필요하게 호출될 수 있다. `$thread.text`를 실제 사용하지 않는 노드도 비용을 부담한다.
- 제안: ES2015 getter(`get text() { ... }`)로 lazy 계산하거나, 호출 빈도가 높지 않다면 현 상태에서도 실용상 무해하므로 주석으로 "pre-computed by design" 의도를 명시한다.

---

**[INFO] `ConversationTurn` 불변성이 타입이 아닌 관례에 의존**
- 위치: `conversation-thread.types.ts:31-60`, `execution-engine.service.ts:3746`
- 상세: 백그라운드 격리 보장(`turns` 배열만 복제하면 충분하다는 §3.2 원칙)은 `ConversationTurn` 객체가 push 이후 변형되지 않는다는 불변식에 의존한다. 그러나 타입은 `Readonly<ConversationTurn>`이 아닌 일반 `ConversationTurn`이다.
- 제안: `ConversationTurn`을 `Readonly<ConversationTurn>`으로 변경하거나, `ConversationThread.turns`를 `ReadonlyArray<Readonly<ConversationTurn>>`으로 선언해 컴파일러가 post-push 변형을 차단하게 한다.

---

**[INFO] `AiAgentHandler` 생성자의 optional service — 프로덕션 경로에서 silent no-op**
- 위치: `ai-agent.handler.ts:293`, `ai-agent.component.ts:43`
- 상세: `conversationThreadService?`를 optional로 선언해 기존 테스트 픽스처와의 하위 호환을 유지하는 설계는 타당하다. 그러나 `injectThreadContext`와 `pushAiThreadTurn`이 서비스 없을 때 silent no-op하기 때문에 엔진 wiring에서 주입이 빠지더라도 컴파일러가 감지하지 못한다.
- 제안: 허용 가능한 트레이드오프이나, `ai-agent.component.ts`에 `if (!deps.conversationThreadService) throw`를 추가하거나, 팩토리 레벨에서 required로 처리해 런타임에서 조기에 실패하게 한다.

---

**[INFO] 테스트 픽스처 불일치 — `makeExecutionContext` 헬퍼 미활용**
- 위치: 다수 `*.spec.ts` 파일
- 상세: `__test__/make-execution-context.ts`에 공유 픽스처 헬퍼가 존재하지만, 이번 변경에서 추가된 ~30개 spec 파일 대부분이 여전히 `ExecutionContext`를 인라인으로 수동 구성한다. `conversationThread` 필드 기본값이 다시 변경될 때 또 같은 규모의 패치가 필요해진다.
- 제안: 핸들러 테스트들이 공통 헬퍼를 사용하도록 점진적으로 마이그레이션한다.

---

### 요약

ConversationThread 설계 자체는 단일 변형 진입점(`ConversationThreadService`), `ThreadHolder` 구조적 타입을 통한 느슨한 결합, 백그라운드 격리를 위한 명시적 shallow clone 등 견고한 아키텍처 원칙을 잘 따른다. 가장 주목할 문제는 `ConversationThread` 타입이 `execution-engine` 모듈 내에 정의되면서 `nodes/core` 계층이 이를 역방향으로 참조해 발생하는 논리적 순환 의존성이다. 이를 shared 타입 레이어로 분리하면 레이어 경계가 명확해지고, WebSocket 페이로드의 mutable 참조 문제 및 multi-turn 경로의 nullable 위험도 함께 정리할 수 있다.

### 위험도
**MEDIUM**