# 신규 식별자 충돌 검토 결과

대상 문서: `spec/conventions/conversation-thread.md`

---

### 발견사항

- **[INFO]** `ConversationTurnSource` 값 `system` — AssistantMessage.role `system` 과 표기 겹침
  - target 신규 식별자: `ConversationTurnSource` 열거값 `system` (§1.1)
  - 기존 사용처: `spec/1-data-model.md §2.21 AssistantMessage.role` Enum 값 `user / assistant / tool / system`, 그리고 `spec/4-nodes/3-ai/1-ai-agent.md` 참조 messages 배열의 `role: 'system'`
  - 상세: target 은 §1.1 에서 "AssistantMessage `role: 'system'` 과 무관 — 워크플로우 레벨의 수동 push 전용" 이라고 주석을 달아 의미 분리를 명시하고 있다. 단, 두 식별자가 같은 문자열 `"system"` 을 사용하며 messages 배열을 통해 LLM 에 전달될 때(§5.1 messages 모드 매핑 표에서 `system` source → `role: 'system'`) 동일 페이로드 키로 수렴하므로 구현자가 혼동할 수 있다. §5.1 에서 Anthropic API 비호환 경고도 이미 인지하고 있다.
  - 제안: 충돌 자체는 spec 주석으로 이미 인지·처리된 상태이나, 코드 레벨에서 `ConversationTurnSource.SYSTEM_NOTE` 같이 `_note` suffix 를 붙이거나, 타입 레벨 문서에 "이 값이 messages 배열로 변환될 때 Anthropic provider 에서는 반드시 `system_text` 모드 강제" 조건을 구현 제약으로 명시하면 혼동 위험이 줄어든다.

- **[INFO]** `source: 'injected'` / `source: 'live'` — WebSocket emit 전용 2값 표식 이름이 기존 `ConversationTurnSource` 5값 enum 과 같은 필드명 `source` 공유
  - target 신규 식별자: `source: 'injected'` / `source: 'live'` (§5.1, §1.5)
  - 기존 사용처: `ConversationTurn.source` 필드(§1.2) — `ConversationTurnSource` 5값 enum 이 이미 해당 필드명을 점유
  - 상세: target 은 §5.1 주석에서 "WebSocket 페이로드 전용 2값 표식이며, 본 §1.1 의 `ConversationTurnSource` (내부 5값 enum) 와는 구별된다 — emit 단계에서 §4.4.6 의 매핑 표에 따라 축약된다" 고 명시한다. 이 구별이 문서 안에서는 충분히 설명되어 있으나, `source` 라는 동일 키가 두 다른 레이어에서 서로 다른 값 집합을 가지므로 WebSocket 페이로드를 직접 파싱하는 클라이언트 개발자가 혼동할 여지가 있다.
  - 제안: WebSocket 이벤트 페이로드 스키마에서 emit 전용 표식 필드의 이름을 `messageSource` 또는 `emitKind` 로 구분하거나, Spec WebSocket Protocol §4.4.6 에 `ConversationTurn.source` 와 `messages[].source` 가 다른 타입임을 명시적으로 구분하는 타입 별칭 정의를 추가한다.

- **[INFO]** `threadTurnsToConversationItems` / `messagesToConversationItems` — 함수 이름이 기존 코드베이스에서 충돌 가능성
  - target 신규 식별자: §9.5 에서 언급되는 `messagesToConversationItems`, `threadTurnsToConversationItems`, `parseHistoryMessages` (frontend 렌더 함수명)
  - 기존 사용처: 코드베이스(`codebase/frontend/`) 에 이미 존재하는 AI Assistant 메시지 렌더 유틸 (`AssistantMessage` → conversation item 변환) 이 유사 이름을 쓸 가능성 (코퍼스에서 직접 확인 불가이나 `AssistantSession/AssistantMessage` spec 과 동일 도메인)
  - 상세: spec 이 구체적인 함수 이름을 §9.5 에서 의무화했다. 이 이름들이 Workflow AI Assistant (`AssistantSession.AssistantMessage`) 렌더 경로와 동일 파일 또는 동일 export 공간에 있을 경우 중복 선언·혼용이 발생한다.
  - 제안: 함수 이름에 `conversationThread` prefix 를 명시하거나 (`threadTurnsToConversationItems` → `conversationThreadTurnsToItems`), 또는 별도 모듈(`conversation-thread/renderers.ts`) 로 격리해 Workflow AI Assistant 렌더 유틸(`assistant-session/renderers.ts`) 과 파일 공간을 분리한다.

- **[INFO]** `DEFAULT_THREAD_ID = 'default'` 상수 — Edge `source_port` 예약어 `'default'` 와 동일 문자열
  - target 신규 식별자: `ConversationThread.id` v1 고정값 `"default"` 및 `DEFAULT_THREAD_ID = 'default'` 코드 상수 (§1.3)
  - 기존 사용처: `spec/1-data-model.md §2.7 Edge.source_port` — 출력 포트 예약어 `"default"` (예: `out_0`, `default` 등). target 스스로 §1.3 주석에서 "port 예약어 `'default'` 와 무관 — namespace 분리" 를 명시
  - 상세: namespace 가 다르므로 런타임 충돌은 없다. 그러나 코드 검색(`grep 'default'`) 시 포트 예약어와 thread ID 상수가 섞여 나와 코드 리뷰·디버깅 시 혼동 가능.
  - 제안: `DEFAULT_THREAD_ID = 'default'` 상수를 도입할 때 상수 이름 자체로 의미가 충분하므로 문제없다. 단, 코드 레벨에서 `'default'` 문자열 리터럴 직접 사용 대신 반드시 이 상수를 거치도록 ESLint rule 또는 코드 컨벤션 주석을 추가하면 혼동을 줄일 수 있다.

- **[INFO]** `$thread` 표현식 변수 — 기존 표현식 언어 변수 공간 내 예약 가능성
  - target 신규 식별자: `$thread` (§6, `spec/5-system/5-expression-language.md §4.4` 에 등록)
  - 기존 사용처: 표현식 언어의 기존 예약 변수들 (`$input`, `$output`, `$loop`, `$now`, `$schedule.*`, `$execution` 등 — `spec/5-system/5-expression-language.md` 에 정의) — 코퍼스 내 직접 전문 미포함이나 참조로부터 존재 확인됨
  - 상세: `$thread` 는 표현식 언어 §4.4 의 신규 최상위 네임스페이스이다. 이미 사용 중인 기존 변수들(`$input`, `$output` 등)과 이름이 겹치지 않으나, 기존 변수 목록에 `$thread` 가 없음을 충돌 검토 관점에서 명시적으로 확인할 필요가 있다.
  - 제안: `spec/5-system/5-expression-language.md §4.4` 가 이미 이 변수를 정의하고 있다면 충돌 없음. 해당 spec 에 기존 변수 전체 목록(reserved words)이 있다면, `$thread` 가 그 목록에 이미 포함되어 있는지 확인하고 누락 시 추가한다.

- **[INFO]** `meta.contextInjection` 키 — 기존 `meta.*` 키 공간과의 충돌 가능성
  - target 신규 식별자: `meta.contextInjection: { appliedScope, appliedMode, injectedTurns, droppedTurns, totalInjectedChars }` (§5.3)
  - 기존 사용처: `spec/conventions/node-output.md` 에서 Principle 2 로 정의된 `meta` 필드(runtime 측정값). AI Agent 노드 output 의 `meta` 키 공간에는 이미 `meta.matchedConditions`, `meta.exitReason`, `meta.backgroundRunId` 등 다수 키가 존재하는 것으로 spec 참조들에서 확인됨
  - 상세: `meta.contextInjection` 은 AI Agent 노드의 output.meta 에 새로 추가되는 nested 객체다. `contextInjection` 이라는 키 이름은 기존에 사용된 키들과 충돌하는 것으로 확인되지 않는다. 단, Principle 2 (meta = 런타임 측정값) 와의 정합 명시(target 이 이미 §5.3 에서 확인)는 되어 있다.
  - 제안: `spec/conventions/node-output.md` 의 AI Agent meta 키 레지스트리(있다면)에 `contextInjection` 을 공식 등록해 향후 키 충돌을 예방한다.

---

### 요약

`spec/conventions/conversation-thread.md` 가 도입하는 신규 식별자들(`ConversationTurnSource`, `ConversationTurn`, `ConversationThread`, `$thread`, `DEFAULT_THREAD_ID`, `source: 'injected'/'live'`, `meta.contextInjection`, 렌더 함수 이름들)은 기존 식별자 공간과 **진성 충돌(같은 네임스페이스에서 다른 의미로 재정의)**을 일으키는 사례는 발견되지 않았다. 다만 `system` source 값과 `AssistantMessage.role = 'system'`, `ConversationTurn.source` 와 WebSocket emit 전용 `source: 'injected'/'live'`, `DEFAULT_THREAD_ID = 'default'` 와 port 예약어 `'default'` 사이에는 동일 문자열 공유로 인한 혼동 가능성이 존재한다. target 문서 자체가 이 중 대부분을 이미 인지하고 주석으로 명시하고 있어 설계 차원의 인식은 충분하다. 코드 구현 시 네임스페이스 격리와 상수 의무화 조치를 병행하면 충분히 관리 가능한 수준이다.

---

### 위험도

LOW
