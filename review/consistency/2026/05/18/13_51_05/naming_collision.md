# 신규 식별자 충돌 검토

target: `spec/conventions/conversation-thread.md`

---

### 발견사항

- **[INFO]** `ConversationTurnSource.system` 값과 `AssistantMessage.role='system'` 의 혼동 가능성
  - target 신규 식별자: `ConversationTurnSource` enum 값 `'system'`
  - 기존 사용처: `spec/1-data-model.md §2.21 AssistantMessage.role` 의 `system` enum 값 (user / assistant / tool / system)
  - 상세: 두 `system` 값은 의미가 다르다. `ConversationTurnSource.system` 은 워크플로우 레벨에서 수동 push 한 시스템 텍스트 전용이고, `AssistantMessage.role='system'` 은 Workflow AI Assistant 채팅 세션의 역할 구분이다. target 문서 §1.1 에서 "AssistantMessage role: 'system' 과 무관" 이라고 명시하고 있어 설계자는 인지하고 있지만, 동일한 `'system'` 문자열이 두 문맥에서 다른 의미로 사용되어 구현자 혼동 위험이 있다.
  - 제안: target §1.1 의 주의 문구를 더 눈에 띄게 배치하거나, `ConversationTurnSource` enum 값에 `'system_push'` 등 다른 이름을 검토. 현재는 구분 주석이 있으므로 INFO 수준.

- **[INFO]** `contextScope` 설정 키와 표현식 `$thread` 네임스페이스 신규 도입 — 기존 사용처 중복 없음 (확인)
  - target 신규 식별자: `contextScope`, `contextScopeN`, `contextInjectionMode`, `includeToolTurns`, `excludeFromConversationThread` (AI Agent 노드 config 필드)
  - 기존 사용처: `spec/4-nodes/3-ai/1-ai-agent.md §1` 신규 5필드로 명시되며, 코퍼스 내 다른 노드 config 에서 같은 이름으로 다른 의미로 쓰이는 사례는 발견되지 않음
  - 상세: 5개 신규 config 필드는 AI Agent 노드 전용으로, 다른 노드 타입의 config JSONB 에서 동명 필드가 충돌할 가능성은 낮다. 단, `excludeFromConversationThread` 는 target §2.4 에서 "각 노드에 공통 boolean config" 로 정의되어 AI Agent 전용이 아니라 모든 노드에 적용된다고 명시한다. `spec/1-data-model.md §2.6 Node.config JSONB` 는 자유형 JSONB 이라 타 노드 config 에도 동명 키가 우연히 존재할 수 있다.
  - 제안: `excludeFromConversationThread` 가 범 노드 공통 키임을 `spec/4-nodes/0-overview.md` 또는 `spec/3-workflow-editor/1-node-common.md` 등 노드 공통 규약 문서에도 명시해 구현 시 충돌 키 등록 방지.

- **[INFO]** `ConversationThread.id` 고정값 `"default"` 와 Edge.source_port 예약어 `'default'` 의 동일 문자열 — 이미 target 에서 명시적 구분
  - target 신규 식별자: `ConversationThread.id` 의 v1 고정값 `"default"`
  - 기존 사용처: `spec/1-data-model.md §2.7 Edge.source_port` 의 예약어 `"default"` (예시로 기재됨)
  - 상세: target §1.3 에서 "port 예약어 'default' 와 무관 — namespace 분리. 코드에서 `DEFAULT_THREAD_ID = 'default'` 상수 추출 권장" 이라고 명시하여 설계자가 인지하고 상수화를 권고하고 있다. 두 `"default"` 는 서로 다른 namespace(thread id vs edge port)에 있어 런타임 충돌은 없다.
  - 제안: 권고사항인 `DEFAULT_THREAD_ID = 'default'` 상수화를 구현 가이드에 강제 사항으로 명문화하면 혼동 차단에 유리함.

- **[INFO]** `source: 'injected'` / `source: 'live'` (WebSocket emit 2값 마커)와 `ConversationTurnSource` (내부 5값 enum) 의 `source` 필드명 중복
  - target 신규 식별자: `ConversationTurn.source` (타입 `ConversationTurnSource`, 5값)
  - 기존 사용처: `spec/5-system/6-websocket-protocol.md §4.4.6` 의 WebSocket 페이로드 `source` 마커 (`'injected'` / `'live'` 2값)
  - 상세: target §5.1 에서 "이 마커는 WebSocket 페이로드 전용 2값 표식이며, 본 §1.1 의 ConversationTurnSource (내부 5값 enum) 와는 구별된다" 고 명시하여 혼동 가능성을 인지하고 있다. 두 `source` 는 서로 다른 객체(ConversationTurn vs WebSocket 메시지)의 필드로 타입 수준에서는 충돌하지 않는다.
  - 제안: 개발자가 두 `source` 를 혼동하지 않도록 WebSocket emit 페이로드의 마커 필드를 `emitSource` 등 구별되는 이름으로 변경하는 방안 검토 (WebSocket spec 개정이 필요하므로 INFO 수준 유지).

- **[INFO]** `meta.contextInjection` 디버그 echo 객체 신규 도입 — 기존 `meta` 네임스페이스 내 충돌 여부
  - target 신규 식별자: `meta.contextInjection: { appliedScope, appliedMode, injectedTurns, droppedTurns, totalInjectedChars }` (AI Agent 노드 output.meta 필드)
  - 기존 사용처: `spec/4-nodes/3-ai/0-common.md` 및 `spec/conventions/node-output.md` 의 `output.meta` 구조. 코퍼스에서 `meta.contextInjection` 이라는 키가 다른 곳에서 사용된 사례는 확인되지 않음.
  - 상세: `output.meta` 는 JSONB 자유형이라 노드별로 키를 정의한다. `contextInjection` 키는 신규이며 타 노드에서 같은 키를 다른 의미로 쓰는 사례는 발견되지 않음. INFO 수준으로 기록.
  - 제안: 신규 `meta.*` 키 목록을 `spec/conventions/node-output.md §4.5` 또는 AI 공통 규약에 등록해 향후 충돌 예방.

- **[INFO]** `threadTurnsToConversationItems` / `messagesToConversationItems` / `parseHistoryMessages` 함수명 신규 도입 — 기존 코드베이스 충돌 가능성
  - target 신규 식별자: `threadTurnsToConversationItems`, `messagesToConversationItems`, `parseHistoryMessages` (§9.5 에서 진입점으로 명시)
  - 기존 사용처: 코퍼스(spec 문서)에서는 해당 함수명이 등장하지 않아 직접 충돌은 없음. 단, `parseHistoryMessages` 는 AI Agent의 기존 `processMultiTurnMessageInner` 내부에 유사한 역할을 하는 함수가 있을 수 있음 (spec 상 `output.messages` history 재구성 경로와 연관).
  - 상세: 이 함수명들은 frontend 렌더러에 속하며, spec 차원의 식별자 충돌은 없다. 구현 단계에서 기존 함수명과 중복되지 않도록 주의가 필요하다.
  - 제안: 구현 시 기존 history 관련 함수명(`processMultiTurnMessageInner`, `buildLlmMessages` 등)과 충돌하지 않도록 네이밍 일관성 검토.

---

### 요약

target 문서 `spec/conventions/conversation-thread.md` 가 도입하는 신규 식별자(`ConversationTurnSource`, `ConversationTurn`, `ConversationThread`, 5개 AI Agent config 필드, `$thread` 표현식, `meta.contextInjection`)는 기존 코퍼스에서 동일한 이름으로 다른 의미로 사용되는 CRITICAL 또는 WARNING 수준의 충돌이 존재하지 않는다. 다만 `'system'` 문자열이 `ConversationTurnSource` enum 값과 `AssistantMessage.role` enum 값으로 동시에 쓰이고, WebSocket emit 레이어의 `source` 마커와 `ConversationTurn.source` 필드가 동일한 필드명을 다른 타입으로 공유하는 점은 target 문서가 이미 각각 인지하고 구분 주석을 달아 위험을 차단하고 있다. 전반적으로 신규 식별자 설계는 기존 코퍼스와 충돌 없이 명확하게 격리되어 있으며, 발견된 항목은 모두 INFO 수준의 명확화 권고 사항이다.

### 위험도

LOW
