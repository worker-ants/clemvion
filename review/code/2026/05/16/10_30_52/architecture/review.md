# 아키텍처(Architecture) 코드 리뷰

## 발견사항

- **[INFO]** `source` 필드가 `ChatMessage` 인터페이스에 추가됨 — 레이어 책임 관점에서 적절한 설계
  - 위치: `backend/src/modules/llm/interfaces/llm-client.interface.ts`
  - 상세: `ChatMessage` 는 LLM 클라이언트 계층의 핵심 도메인 인터페이스다. 여기에 `source?: 'live' | 'injected'` 를 선택적 필드로 추가한 것은 하위 호환성을 유지하면서 WebSocket 전송 계층 메타데이터를 도메인 타입에 부착한 것이다. JSDoc 에 "strictly transport-layer metadata" 라고 명시하고 있어 설계 의도는 명확하다. 다만 LLM 도메인 인터페이스에 전송 계층 관심사가 혼재하는 구조다.
  - 제안: 현재 설계는 수용 가능하나, 장기적으로 `source` 를 별도 래퍼 타입(`TaggedChatMessage`) 으로 분리하면 LLM 클라이언트 인터페이스에서 전송 메타데이터를 완전히 격리할 수 있다. 현재는 `LlmService` 가 스트립 처리를 담당해 단기적으로는 충분하다.

- **[WARNING]** `withSourceMarker` 함수가 `execution-engine.service.ts` 에 module-private 로 위치하지만 두 개의 독립적인 호출 지점에서 사용됨 — 응집도 관점에서 잠재적 분산 위험
  - 위치: `backend/src/modules/execution-engine/execution-engine.service.ts` (L89–L103, L120, L129–L131)
  - 상세: `withSourceMarker` 는 `buildConversationConfigFromOutput` 과 `condMessages` 처리 두 곳에서 호출된다. 현재는 동일 파일 내에 있어 응집도가 유지되지만, 동일한 `source` 백필 로직이 향후 다른 서비스나 핸들러에서도 필요해질 경우 중복이 발생할 수 있다. 특히 `ai-agent.handler.ts` 의 `mapTurnsToChatMessages` 는 `'injected'` 를 직접 설정하는 반면 `execution-engine` 은 `'live'` 를 백필하는 두 가지 책임이 서로 다른 레이어에 분산되어 있다.
  - 제안: `source` 마킹 로직을 `ChatMessage` 와 가까운 공유 유틸리티(예: `backend/src/shared/conversation/message-source.util.ts`)로 추출하거나, `llm-client.interface.ts` 에 type guard와 함께 위치시켜 단일 진실 원칙을 강화하는 것을 검토한다.

- **[WARNING]** `mapTurnsToChatMessages` 에서 `system` role 메시지에도 `source: 'injected'` 를 붙이나, `buildConversationConfigFromOutput` 은 system 메시지를 필터링 후 `withSourceMarker` 를 적용함 — 처리 순서 불일치
  - 위치: `backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` (L294–L311), `backend/src/modules/execution-engine/execution-engine.service.ts` (L119–L120)
  - 상세: `mapTurnsToChatMessages` 는 `source: 'injected'` 를 system 역할 메시지에도 부여한다. 그러나 `buildConversationConfigFromOutput` 에서는 `messagesAll.filter((m) => m.role !== 'system')` 이 먼저 실행된 뒤 `withSourceMarker` 가 적용되므로, system 메시지의 `source` 값은 결코 emit 되지 않는다. 이는 현재 동작상 문제는 없지만, system 메시지에 `source` 를 붙이는 로직이 불필요하게 작성되어 있어 독자가 혼란을 겪을 수 있다.
  - 제안: `mapTurnsToChatMessages` 에서 `system` case 분기는 `source: 'injected'` 를 생략하고 `{ role: 'system', content: t.text }` 만 반환하도록 수정하거나, 또는 JSDoc 에 "system 메시지의 source 는 emit 경로에서 사용되지 않음" 을 명시한다.

- **[INFO]** `source` 스트립 처리가 `LlmService.chat()` 진입 시점에서 수행됨 — 단일 책임 및 개방-폐쇄 원칙 관점에서 양호
  - 위치: `backend/src/modules/llm/llm.service.ts` (L222–L228)
  - 상세: LLM 제공자 클라이언트에 전달하기 전 `source` 를 제거하는 책임을 `LlmService` 가 단독으로 맡는 구조다. 이는 각 LLM 클라이언트 구현체가 `source` 를 알 필요 없게 하므로 인터페이스 분리 원칙과 부합한다. `void source` 로 eslint unused 경고를 억제하는 패턴은 의도를 명시적으로 드러내지만 다소 비관용적이다.
  - 제안: `void source` 대신 비구조화에서 `_source` 로 이름을 바꾸거나(`const { source: _source, ...rest } => rest`), ts-ignore 보다 명시적인 방식으로 처리한다. 현재 패턴은 허용 가능한 수준이다.

- **[INFO]** `isInjected` 필드가 `ConversationItem` 스토어 인터페이스에 선택적으로 추가됨 — 프레젠테이션/상태 레이어 확장
  - 위치: `frontend/src/lib/stores/execution-store.ts` (L82–L660)
  - 상세: `isInjected?: boolean` 을 스토어 인터페이스에 선택적으로 추가해 하위 호환성을 유지한다. `messagesToConversationItems` 가 이 값을 채우고 UI 레이어가 소비하는 단방향 데이터 흐름이 명확하다. JSDoc 에 spec 참조가 포함되어 설계 근거가 문서화되어 있다.
  - 제안: 현재 구조는 적절하다. `isInjected` 가 UI 렌더링 전용이라면 향후 `ConversationItem` 을 뷰 모델과 상태 모델로 분리할 때 이 필드의 소속을 재고한다.

- **[INFO]** `use-execution-events.ts` 에서 `source` 타입이 인라인 타입 리터럴로 두 군데 중복 정의됨 — 모듈 경계 명확성 부족
  - 위치: `frontend/src/lib/websocket/use-execution-events.ts` (L683–L684, L692–L693)
  - 상세: `source?: "live" | "injected"` 가 `use-execution-events.ts` 의 인라인 익명 타입 두 곳에서 반복 정의된다. `conversation-utils.ts` 의 `RawMessage` 인터페이스와 중복이다. 이는 타입 단일 진실 원칙을 위반하며, 나중에 `source` 의 허용 값이 변경될 경우 누락 지점이 생길 수 있다.
  - 제안: `RawMessage` 인터페이스 또는 별도 `types.ts` 에서 `type MessageSource = 'live' | 'injected'` 를 export 하고 `use-execution-events.ts` 에서 import 하여 단일 정의를 유지한다.

- **[INFO]** `conversation-utils.ts` 의 `messagesToConversationItems` 에서 `turnIndex: currentTurn || 1` 패턴 사용
  - 위치: `frontend/src/lib/conversation/conversation-utils.ts` (L584)
  - 상세: `currentTurn` 이 0일 때 기본값 1을 반환하는 `|| 1` 패턴은 injected-only 메시지가 맨 앞에 오는 경우를 처리한다. 이 로직은 함수 내부의 상태 조작 방식에 의존하고 있어 새로운 역할 유형이 추가될 때 조건 분기가 확산될 수 있다.
  - 제안: `currentTurn` 초기값을 0 → 1로 변경하거나, turn 카운터 로직을 별도 헬퍼로 추출해 역할별 분기를 명시적으로 관리하면 가독성과 확장성이 개선된다.

## 요약

이번 변경은 WebSocket 전송 계층에서 AI Agent 메시지의 출처(`'live'` / `'injected'`)를 추적하기 위한 `source` 마커를 전체 스택(backend 도메인 인터페이스 → 실행 엔진 → 프론트엔드 상태 스토어 → 대화 유틸리티)에 걸쳐 일관되게 도입한 작업이다. 전반적으로 레이어 책임 분리와 하위 호환성 유지가 잘 되어 있으며, `LlmService` 에서 `source` 를 스트립해 LLM 제공자에는 노출하지 않는 설계는 인터페이스 분리 원칙에 부합한다. 주요 아키텍처 우려 사항은 두 가지다: (1) `source` 타입 정의가 `use-execution-events.ts` 에 인라인으로 중복 선언되어 단일 진실 원칙이 깨졌으며, (2) system 메시지에 `source: 'injected'` 를 부여하지만 emit 경로에서는 system 메시지가 필터링되므로 이 레이블이 도달하지 않는 불필요한 처리 불일치가 존재한다. 두 가지 모두 중대한 결함은 아니지만 장기 유지보수 관점에서 개선이 필요하다.

## 위험도

LOW
