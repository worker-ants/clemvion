### 발견사항

---

**[WARNING] BullMQ 큐 하위 호환성 — 기존 잡 역직렬화 실패**
- 위치: `execution-engine.service.ts` (background job restore 경로), `background-execution.queue.ts`
- 상세: `BackgroundExecutionJob.conversationThread`가 비옵셔널 필드로 추가되었지만, 이미 Redis 큐에 적재된 기존 잡에는 이 필드가 없다. 프로세서가 잡을 꺼내 `context.conversationThread = job.conversationThread`를 실행하면 `undefined`를 비옵셔널 필드에 대입하게 되어 이후 `conversationThreadService.append*` 호출에서 `context.conversationThread.turns`에 접근 시 런타임 오류가 발생한다.
- 제안: 프로세서에서 `job.conversationThread ?? createEmptyConversationThread()`로 방어하거나, 배포 직전 큐를 비운 후 반영한다.

---

**[WARNING] WebSocket 대기 페이로드에 live mutable reference 전달**
- 위치: `execution-engine.service.ts` (form waiting emit: `conversationThread: context.conversationThread`, buttons waiting emit, ai_conversation waiting emit)
- 상세: 페이로드에 `context.conversationThread` 객체를 직접 참조로 넣는다. WebSocket 서비스가 JSON 직렬화를 즉시 수행하면 무방하지만, 페이로드를 내부 버퍼나 이벤트 큐에 잠깐이라도 참조로 보관할 경우 직렬화 시점과 send 시점 사이에 다른 노드가 turns를 push하면 페이로드 내용이 오염된다. multi-turn 이후 waiting tick 경로(`conversationThread: this.contextService.getContext(executionId)?.conversationThread`)도 동일 위험.
- 제안: 전달 직전 `{ ...context.conversationThread, turns: [...context.conversationThread.turns] }`로 스냅샷 복사. 이는 background job 경로와 동일한 격리 패턴이다.

---

**[WARNING] `ExpressionResolverService.$thread.turns`가 live 배열 참조**
- 위치: `expression-resolver.service.ts` `buildThreadView()` — `turns: thread.turns`
- 상세: 표현식 컨텍스트 객체가 반환된 후 `append*`가 호출되면 `$thread.turns`가 그 push를 그대로 반영한다. 표현식 평가 결과가 turns 길이나 내용에 의존하는 경우(예: `$thread.length > 0` 조건 분기) 평가 직후 turns가 추가되면 재평가 시 다른 결과를 낼 수 있다.
- 제안: `turns: [...thread.turns]` 스냅샷 사본 반환.

---

**[WARNING] `renderThreadAsSystemText` 즉시(eager) 호출 — 모든 `buildExpressionContext` 호출에서 발생**
- 위치: `expression-resolver.service.ts` `buildThreadView()` — `text: renderThreadAsSystemText(thread.turns)`
- 상세: 표현식에서 `$thread.text`를 사용하지 않더라도 `buildExpressionContext`가 호출될 때마다 스레드 전체를 문자열로 렌더링한다. turns가 많을수록(최대 100개 × 4000자 = ~400,000자) 표현식 해석 경로 전체가 느려지는 숨겨진 성능 부작용이다.
- 제안: `Object.defineProperty`로 lazy getter를 사용하거나, 명시적 `getThreadText(context)` helper로 분리하여 호출 측이 필요할 때만 호출하도록 한다.

---

**[INFO] `getThread()`가 `Readonly<ConversationThread>`를 반환하지만 실제 객체는 가변**
- 위치: `conversation-thread.service.ts` `getThread()`
- 상세: TypeScript의 `Readonly<T>`는 얕은(shallow) 컴파일 타임 힌트일 뿐, 런타임에 `turns.push()`는 막히지 않는다. 외부 호출자가 `service.getThread(ctx).turns.push(x)`를 직접 호출해도 TypeScript 오류가 발생하지 않는다(`turns` 자체는 `readonly` 표시가 없음).
- 제안: `ConversationThread.turns`를 `readonly ConversationTurn[]`로 선언하거나, 반환 타입을 `{ id: string; nextSeq: number; turns: readonly ConversationTurn[]; totalChars: number }`로 명시.

---

**[INFO] `DEFAULT_THREAD_ID = 'default'`와 노드 출력 포트 예약어 동일값**
- 위치: `conversation-thread.types.ts`
- 상세: 주석에서 "namespace가 완전히 분리되어 있어 런타임 충돌 없음"이라고 설명하고 있으나, 미래에 graph executor가 노드 출력 포트와 thread id를 동일 맵 키 공간에서 처리하는 코드 변경이 생길 경우 조용히 충돌할 수 있다. 현재는 무해하다.
- 제안: 주석 수준에서 충분히 문서화되어 있으나, thread id를 `'__thread_default__'`처럼 포트명과 절대 겹칠 수 없는 값으로 변경하면 미래 위험을 원천 차단할 수 있다.

---

**[INFO] `ConversationTurn` 객체는 얕은 복사(배경 격리)에서 원본 참조 공유**
- 위치: `execution-engine.service.ts` background snapshot 경로 (`turns: [...context.conversationThread.turns]`)
- 상세: turns 배열은 새로 만들지만 각 `ConversationTurn` 객체는 동일 참조를 공유한다. 스펙 §3.2에서 "ConversationTurn 객체는 push 후 불변"이라고 명시하므로 현재는 안전하다. 단, 미래에 turn 객체에 mutable field(예: `editedAt`)를 추가할 경우 격리가 깨진다.
- 제안: 스펙 §3.2의 불변 계약을 `Object.freeze(turn)`으로 런타임에도 강제하면 미래 사고를 방지할 수 있다.

---

### 요약

이번 변경은 `ConversationThread`를 `ExecutionContext`에 비옵셔널 필드로 통합하고 단일 mutation 진입점(`ConversationThreadService`)을 정확히 구현하는 등 설계 원칙이 잘 지켜졌다. 가장 실질적인 위험은 두 가지다: **BullMQ 큐 하위 호환성** — 배포 직전 큐에 남은 기존 잡이 `conversationThread` 필드 없이 역직렬화될 경우 background processor에서 런타임 오류가 발생할 수 있으며, **WebSocket 대기 페이로드에 live 참조 전달** — 직렬화 지연이 발생하는 경우 페이로드 오염 가능성이 있다. background job 경로에는 이미 turns 배열 복사를 적용한 올바른 격리 패턴이 있으므로, 동일 패턴을 WebSocket 페이로드와 expression `$thread.turns`에도 적용하면 일관성이 확보된다.

### 위험도

**MEDIUM**