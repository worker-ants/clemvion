## 발견사항

### [HIGH] 프롬프트 인젝션 — 사용자 입력이 LLM 프롬프트에 무필터링 삽입
- **위치**: `thread-renderer.ts:33-41` (`renderInteractionText`), `ai-agent.handler.ts` (`injectThreadContext`)
- **상세**: `form_submitted` 처리 시 `Object.entries(data)`의 **키(k)와 값(v)**이 `${k}=${stringifyValue(v)}` 형식으로 직렬화되어 그대로 LLM system prompt / messages 배열에 삽입된다. 악의적 사용자가 `ignore previous instructions`를 필드명으로, `reveal system prompt`를 값으로 제출하면 해당 문자열이 AI 컨텍스트에 주입된다. `button_click`의 `buttonLabel`, `button_continue`의 `url`도 동일한 경로로 노출된다.

  ```typescript
  // thread-renderer.ts — k 는 사용자 제출 form 필드명, 무검증 삽입
  parts.push(`${k}=${stringifyValue(v)}`);
  ```

  ```typescript
  // ai-agent.handler.ts — presentation_user 턴의 text 가 그대로 messages 에 삽입
  content: `[from ${t.nodeLabel}] ${t.text}`,
  ```
- **제안**: LLM에 주입되는 텍스트에 대해 Markdown/특수 지시어 이스케이프 또는 고정 템플릿 래핑(`<<<user_input>>>...<</user_input>>>`)을 적용해 instruction과 data 영역을 분리한다. 최소한 `[INST]`, `<|system|>` 등 provider별 제어 토큰 패턴을 strip해야 한다.

---

### [WARNING] WebSocket 페이로드에 전체 ConversationThread 노출
- **위치**: `execution-engine.service.ts` — form wait / AI wait / button wait emit 세 곳
- **상세**: `conversationThread: context.conversationThread` 가 전송되면 **모든 과거 턴**(AI tool call arguments, 내부 KB 쿼리 결과, 폼 PII 데이터)이 WebSocket 구독자에게 그대로 전달된다. 기존에는 해당 필드가 없었으나 이번 변경으로 전송 데이터 범위가 대폭 확대된다. 다중 사용자가 동일 WebSocket 채널을 구독하는 구조라면 다른 사용자의 대화 이력이 노출될 수 있다.

  ```typescript
  // execution-engine.service.ts (multi-turn waiting emit)
  conversationThread:
    this.contextService.getContext(executionId)?.conversationThread,
  ```
- **제안**: WebSocket 전송 전 `turns` 에서 `source === 'ai_tool'` 및 `toolCalls` 필드를 제거하거나, 전송 대상을 `{ totalTurns, lastTurnTimestamp }` 같은 요약 형식으로 제한한다. 또는 프론트엔드가 필요한 경우에만 별도 REST 엔드포인트로 thread를 조회하도록 설계를 재검토한다.

---

### [WARNING] 배경 스레드 스냅샷의 shallow clone — `data` 필드 뮤테이션 격리 미보장
- **위치**: `execution-engine.service.ts:3746-3752`
- **상세**: `turns: [...context.conversationThread.turns]` 로 배열 참조만 분리하며, 개별 `ConversationTurn` 객체(특히 `data?: Record<string, unknown>`)는 동일 참조를 공유한다. 코드 주석은 "턴 객체는 push 후 불변"이라고 명시하지만, 이는 타입 시스템이 아닌 **관례에만** 의존하는 불변성이다. 향후 핸들러 코드에서 `turn.data.x = ...` 같은 직접 mutation이 발생하면 main/background 격리가 조용히 깨진다.
- **제안**: 핵심 격리 경계이므로 `ConversationTurn` 을 `Object.freeze()` 하거나 `readonly` deep type을 강제하는 런타임 검사를 추가한다. 또는 `turns: context.conversationThread.turns.map(t => ({ ...t, data: t.data ? { ...t.data } : undefined }))` 으로 data를 1depth 복사한다.

---

### [WARNING] 스레드 append 시 크기 미검증 — 메모리 DoS 잠재 위험
- **위치**: `conversation-thread.service.ts:154-169` (`appendInternal`)
- **상세**: `appendInternal` 은 `thread.turns.push(turn)` 전 턴 수·문자 수 상한을 검사하지 않는다. cap은 `applyCap()` (렌더링 시점)에만 적용된다. 공격자가 자동화 도구로 반복 form submit하면 저장된 turns 배열이 메모리 내에서 무한 증가할 수 있다. `MAX_INJECTED_TURNS = 100`, `MAX_INJECTED_CHARS = 200,000` 은 LLM 주입 용도의 상수일 뿐, 저장소 상한이 아니다.
- **제안**: `appendInternal` 진입 시 `thread.turns.length >= STORAGE_MAX_TURNS` (예: 500) 또는 `thread.totalChars >= STORAGE_MAX_CHARS` 조건 검사 후 가장 오래된 턴을 evict하거나 append를 skip한다.

---

### [INFO] `DEFAULT_THREAD_ID = 'default'` — 예약어 충돌 위험 문서화 의존
- **위치**: `conversation-thread.types.ts:16`
- **상세**: 코드 주석에서 노드 출력 포트 예약어 `'default'` 와 동일 문자열임을 명시하며 "namespace 분리로 충돌 없음"이라고 설명한다. 런타임 격리는 현재 올바르지만, 향후 직렬화(JSON → DB 저장 → 복원) 과정에서 두 영역의 `'default'` 키가 혼용될 경우 디버깅이 어려운 버그가 발생할 수 있다.
- **제안**: `DEFAULT_THREAD_ID = 'thread:default'` 처럼 네임스페이스 prefix를 포함한 값으로 변경해 타입 수준에서 구분한다.

---

### [INFO] `contextScope` 값의 타입 캐스트
- **위치**: `ai-agent.handler.ts` (`injectThreadContext` 내부)
- **상세**: `args.config.contextScope as 'none' | 'thread' | 'lastN' | undefined` 는 런타임 값 검증 없이 TypeScript 타입만 단언한다. Zod 스키마 파싱이 호출 경로마다 보장된다면 문제없지만, 테스트 fixture나 직접 생성 경로에서 임의 문자열이 들어오면 `switch` 분기가 예상치 않게 동작할 수 있다.
- **제안**: 캐스트 직후 `if (!['none','thread','lastN'].includes(scope ?? '')) return noopResult;` 방어 코드를 추가한다.

---

## 요약

이번 변경은 ConversationThread 기능을 구현하는 전반적으로 잘 설계된 코드이지만, **프롬프트 인젝션**이 핵심 보안 위협이다. 사용자가 제출한 폼 필드명·값, 버튼 레이블이 어떠한 이스케이프 없이 LLM system prompt와 messages 배열에 직접 삽입되어, 공격자가 AI 에이전트의 행동을 조작할 수 있다. 추가로, 전체 ConversationThread(AI tool call arguments, PII 포함 가능)가 WebSocket 페이로드에 포함되어 정보 노출 범위가 확대되며, 배경 실행 격리가 관례 기반 불변성에 의존한다는 점도 개선이 필요하다.

## 위험도

**HIGH**