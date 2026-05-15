## 발견사항

### [HIGH] 백그라운드 실행 스레드 격리 미검증
- **위치**: `execution-engine.service.ts` L3746-3796, `background-execution.queue.ts`
- **상세**: `turns: [...context.conversationThread.turns]` 클론을 통해 백그라운드 서브그래프와 메인 흐름 간 thread 격리를 구현했으나, 이 격리 속성을 직접 검증하는 테스트가 없음. 백그라운드 노드가 push한 turn이 메인 thread에 누수되지 않는다는 보장을 테스트로 확인하지 않음.
- **제안**: `execution-engine.service.spec.ts`에 "background execution does not pollute parent thread" 통합 테스트 추가. 메인 context의 `conversationThread`에 기존 turn 1개를 seeding한 뒤 background 실행 후 메인 thread turn 수가 유지됨을 assert.

---

### [MEDIUM] 버튼 resume 시 thread push 미검증
- **위치**: `execution-engine.service.ts` L2586+, `execution-engine.service.spec.ts` L1553+
- **상세**: form resume(`form_submitted`)에 대한 `appendPresentationInteraction` 호출은 spy로 검증했으나, 버튼 resume(`button_click`, `button_continue`) 경로에 대한 동등한 테스트가 없음. 두 경로 모두 spec §2.1의 단일 진입점 계약을 이행해야 함.
- **제안**: form resume 테스트 패턴을 복제하여 `continueExecution` with `button_click` payload로 spy 호출을 assert하는 테스트 추가.

---

### [MEDIUM] 불변성 테스트가 실제 보호를 검증하지 않음
- **위치**: `conversation-thread.service.spec.ts` L261-278 (`immutability` describe block)
- **상세**: `getThread()` 가 반환하는 `Readonly<ConversationThread>`에서 `turns`는 `ConversationTurn[]`이므로 외부에서 `(snapshot.turns as ConversationTurn[]).push(turn)`으로 직접 mutation이 가능함. 현재 테스트는 "서비스가 두 번째 append를 여전히 처리하는지"만 확인하며 실제 배열 돌파 가능성을 검증하지 않음.
- **제안**: 테스트를 강화하거나, 서비스가 `getThread()`에서 `{ ...thread, turns: [...thread.turns] }`로 방어적 복사를 반환하도록 구현 변경 후 테스트에서 그 보장을 assert.

---

### [WARNING] `execution-context.service.spec.ts`에서 magic string 사용
- **위치**: `execution-context.service.spec.ts` L13-20
- **상세**: `id: 'default'`를 하드코딩. `DEFAULT_THREAD_ID` 상수가 이미 `conversation-thread.types.ts`에 export되어 있음. 상수가 변경되면 테스트가 오탐을 낼 수 있음.
- **제안**: `expect(ctx.conversationThread).toEqual(createEmptyConversationThread())` 또는 `id: DEFAULT_THREAD_ID`로 교체.

---

### [WARNING] `button_continue` interaction type이 서비스 테스트에 없음
- **위치**: `conversation-thread.service.spec.ts` `appendPresentationInteraction` describe
- **상세**: `form_submitted`과 `button_click`은 service 레벨에서 테스트되지만, `button_continue` 타입은 renderer spec에만 있고 service spec에는 없음. service가 `button_continue`를 통해 올바른 text로 turn을 push하는지 미검증.
- **제안**: `button_continue` interaction으로 `appendPresentationInteraction`을 호출하는 테스트 추가 (url 있음/없음 두 케이스).

---

### [WARNING] `ai-agent.thread.spec.ts` - includeToolTurns 테스트가 빈 provider에 의존
- **위치**: `ai-agent.thread.spec.ts` L388-436 (`includeToolTurns=true` 테스트)
- **상세**: handler가 `providers = []`로 초기화된 상태에서 `tool_foo` 호출 시 어떤 결과가 push되는지 (error content vs 실제 result) 테스트 의도가 불명확. `turns[2].toolCallId === 'tc-1'`은 assert하지만 `turns[2].text`의 구체적인 내용은 assert하지 않아 tool error 처리 경로가 실제로 통과하는지 알 수 없음.
- **제안**: tool result turn의 `text` 내용도 assert하거나, 최소한 빈 provider에서 에러가 tool result로 변환되는 경로임을 주석으로 명시.

---

### [WARNING] `contextScopeN = 0` 엣지 케이스 미검증
- **위치**: `ai-agent.handler.ts` `injectThreadContext` 메서드, `ai-agent.thread.spec.ts`
- **상세**: `Math.max(1, (args.config.contextScopeN as number) ?? 20)` 코드에서 `contextScopeN = 0`이면 `Math.max(1, 0) = 1`로 최소 1개 turn이 주입됨. `contextScopeN`이 0이거나 음수일 때의 동작이 spec의 의도와 일치하는지 테스트로 문서화 필요.
- **제안**: `contextScope='lastN', contextScopeN: 0`으로 호출 시 1개 turn이 주입됨을 명시하는 경계값 테스트 추가.

---

### [INFO] `$thread` 표현식 평가 end-to-end 테스트 없음
- **위치**: `expression-resolver.service.spec.ts` L390-464, `expression-resolver.service.ts`
- **상세**: `buildExpressionContext`에서 `$thread` 뷰 생성은 테스트됐으나, `resolveExpression("{{$thread.length}}")` 같은 실제 표현식 평가에서 `$thread` 접근이 동작하는지는 미검증.
- **제안**: `resolveExpression` or `resolveFieldValue`로 `{{$thread.length}}`, `{{$thread.turns[0].text}}` 표현식을 실제로 평가하는 테스트 1-2개 추가.

---

### [INFO] `makeExecutionContext` 헬퍼 중복 제거 기회
- **위치**: `make-execution-context.ts` (File 1), `conversation-thread.service.spec.ts` 내 `makeContext`, `ai-agent.thread.spec.ts` 내 `makeContext`
- **상세**: 각 spec마다 거의 동일한 `makeContext` 팩토리를 별도 정의. `make-execution-context.ts` 공용 헬퍼가 있음에도 일부 파일이 독립 정의를 사용하여 유지보수 부담 증가.
- **제안**: Critical 수준은 아니나, spec 파일들을 공용 `makeExecutionContext` 헬퍼로 통일.

---

## 요약

Conversation Thread 핵심 기능(타입, 서비스, 렌더러)에 대한 테스트는 주요 happy path와 opt-out, seq 단조증가, char cap 등 중요 경계 조건을 잘 커버한다. AI Agent 스레드 push/inject 동작도 `ai-agent.thread.spec.ts`에서 체계적으로 검증된다. 그러나 아키텍처적으로 중요한 **백그라운드 실행 thread 격리** 보장이 테스트로 증명되지 않은 점이 가장 큰 공백이며, **버튼 resume thread push**와 **불변성 실제 보호** 두 가지 MEDIUM 이슈가 추가로 해소되어야 전체 Phase 3-4 구현의 안전성이 확보된다.

## 위험도

**MEDIUM**