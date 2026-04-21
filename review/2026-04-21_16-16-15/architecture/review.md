### 발견사항

---

**[CRITICAL] `assistant-store.ts` — 플랜 스텝 상태 직접 변이(mutation)**
- 위치: `handleSseEvent` 내 `tool_call` 이벤트 처리, `for (const other of [...s.messages].reverse())` 블록
- 상세: `other.plan.steps = other.plan.steps.map(...)` 가 Zustand 상태 객체를 직접 변이한다. `[...s.messages]` 는 얕은 복사이므로 내부 참조(plan, steps)는 공유된다. 이는 Zustand의 불변성 원칙 위반이며, 선행 메시지의 plan 객체가 silently 변이되어 React rerender가 트리거되지 않거나 stale state를 갖게 될 수 있다.
- 제안: set 콜백 내에서 `s.messages.map(m => m.plan ? { ...m, plan: { ...m.plan, steps: m.plan.steps.map(...) } } : m)` 형태로 불변 갱신해야 한다.

---

**[HIGH] `WorkflowAssistantSessionService.appendMessage` — 비원자적 DB 갱신**
- 위치: `workflow-assistant-session.service.ts`, `appendMessage()` 메서드
- 상세: 메시지 저장 → `sessionRepo.update` → `sessionRepo.increment` 세 개의 DB 연산이 트랜잭션 없이 실행된다. 중간 실패 시 `message_count`/`last_interaction_at`이 메시지와 불일치하는 inconsistent state가 된다. SQL 마이그레이션에서 `message_count`를 denormalized 필드로 설계한 의도가 무색해진다.
- 제안: `@Transaction()` 데코레이터 또는 `DataSource.transaction()` 블록으로 세 연산을 묶거나, `message_count`를 서브쿼리(COUNT)로 실시간 집계하도록 바꾸어 denormalization 자체를 제거한다.

---

**[HIGH] `ExploreToolsService` — 외부 모듈 Repository 직접 주입으로 모듈 경계 침해**
- 위치: `tools/explore-tools.service.ts`, 생성자의 `@InjectRepository(Node)`, `@InjectRepository(Edge)`, `@InjectRepository(Integration)`, `@InjectRepository(KnowledgeBase)`
- 상세: `WorkflowAssistantModule`이 `NodeModule`, `EdgeModule`, `IntegrationModule`, `KnowledgeBaseModule`의 내부 Repository를 직접 소비한다. 각 모듈이 이미 자체 서비스 레이어를 갖고 있음에도 데이터 레이어를 우회한다. 이는 캡슐화 위반이며, 해당 모듈들의 쿼리 로직이 변경될 때 `ExploreToolsService`에 숨겨진 파급 효과가 발생한다.
- 제안: 각 도메인 모듈에 `{ scope: 'read-only' }` 조회 메서드를 추가하고 서비스를 `export`하여, `ExploreToolsService`가 Repository 대신 서비스를 DI받도록 한다.

---

**[HIGH] LLM 클라이언트 — HTTP 상태 코드 대신 오류 메시지 문자열로 에러 코드 판별**
- 위치: `anthropic.client.ts`와 `openai.client.ts`의 `stream()`, `catch` 블록
- 상세: `message.includes('429')` 로 rate limit을 감지한다. Anthropic/OpenAI SDK는 각각 `APIError`, `RateLimitError` 등의 타입화된 예외 클래스를 제공하며, 오류 메시지 포맷이 변경되면 감지 로직이 무음 실패한다. 두 클라이언트가 동일한 패턴을 중복하여 DRY 원칙도 위반된다.
- 제안: `error instanceof Anthropic.RateLimitError` / `error instanceof OpenAI.RateLimitError` 등 SDK 타입 가드를 사용하고, 공통 에러 변환 유틸(`mapProviderError`)을 추출하여 양 클라이언트에서 재사용한다.

---

**[MEDIUM] `assistant-store.ts` ↔ `editor-store.ts` — 순환 의존성 회피를 위한 동적 import**
- 위치: `assistant-store.ts`, `handleSseEvent` 내 `void import("@/lib/stores/editor-store")...`
- 상세: 두 스토어 간 암묵적 순환 참조를 런타임 동적 import로 우회한다. 이는 구조적 결합도 문제를 숨기는 Band-Aid 패턴이다. `applyAssistantOperation`은 `editor-store`에 optional(`?`) 메서드로 선언되어 있어 타입 안전성도 약하다.
- 제안: 편집 연산을 이벤트 버스(EventEmitter 또는 rxjs Subject)나 별도의 `AssistantEditorBridge` 서비스로 분리하여 두 스토어가 단방향 의존성을 갖도록 한다.

---

**[MEDIUM] `applyAssistantOperation` — 도구 이름 기반 분기로 OCP 위반**
- 위치: `editor-store.ts`, `applyAssistantOperation()` 메서드
- 상세: `if (name === "add_node") ... else if (name === "update_node") ...` 형태의 if-else 체인으로 새 도구 추가 시마다 이 함수를 수정해야 한다.
- 제안: `Record<string, (args, result, store) => void>` 형태의 핸들러 맵(Command 패턴)으로 교체하면 새 도구를 맵에 등록하는 것만으로 확장이 가능하다.

---

**[MEDIUM] `findOneForUser` — 애플리케이션 레이어에서 복합 인가 조건 처리**
- 위치: `workflow-assistant-session.service.ts`, `findOneForUser()`
- 상세: `sessionRepo.findOne({ where: { id } })` 로 세션을 로드한 뒤 `workspaceId`, `userId` 조건을 애플리케이션 코드에서 확인한다. 불필요한 DB 로드가 발생하고, 동시성 상황에서 TOCTOU 잠재적 문제가 있다.
- 제안: `findOne({ where: { id, workspaceId } })` 로 DB 쿼리에 포함시키고, userId 소유권 확인만 앱 레이어에서 수행한다.

---

**[MEDIUM] Controller — SSE 인프라 로직(keepalive, 버퍼링 헤더) 직접 관리**
- 위치: `workflow-assistant.controller.ts`, `sendMessage()` 메서드
- 상세: 15초 keepalive ping, `X-Accel-Buffering: no`, `Connection: keep-alive` 설정 등 인프라 관심사가 컨트롤러 메서드에 직접 포함되어 있다. 다른 SSE 엔드포인트가 추가되면 중복된다.
- 제안: `@SseStream()` 커스텀 데코레이터 또는 인터셉터로 SSE 공통 설정을 추출한다.

---

**[LOW] `LLMClient` 인터페이스 — `stream()`을 optional로 선언**
- 위치: `llm-client.interface.ts`
- 상세: `stream?(...): AsyncIterable<ChatStreamEvent>` 는 인터페이스 분리 원칙(ISP) 관점에서 스트리밍 지원 여부를 런타임 존재 확인(`if (client.stream)`)에 의존하게 만든다. 타입 시스템이 스트리밍 지원 여부를 컴파일 타임에 보장하지 못한다.
- 제안: `StreamingLLMClient extends LLMClient` 서브 인터페이스를 분리하고, `LlmService.chatStream`이 `StreamingLLMClient` 타입 가드로 클라이언트를 narrowing 하도록 한다.

---

**[LOW] `AssistantMessageRequestDto` — 워크플로우 스냅샷 크기 미검증**
- 위치: `dto/assistant-message-request.dto.ts`, `currentWorkflow` 필드
- 상세: 노드 수백 개와 전체 config를 담은 스냅샷이 매 메시지 요청마다 전송된다. 페이로드 크기 제한이 없어 대형 워크플로우에서 요청 본문이 수 MB에 달할 수 있다.
- 제안: `@ArrayMaxSize(500)` 등 배열 크기 제한을 DTO에 추가하거나, config 필드를 system prompt 조립 시 백엔드에서 DB로부터 직접 조회하도록 설계를 검토한다.

---

### 요약

전체적으로 `WorkflowAssistant` 기능은 ShadowWorkflow를 통한 클라이언트-서버 양방향 낙관적 업데이트, SSE 기반 스트리밍, 세션 영속화를 잘 분리된 구조로 구현했다. 그러나 세 가지 축에서 리스크가 있다: (1) `assistant-store`의 Zustand 상태 직접 변이는 즉각 수정이 필요한 데이터 정합성 버그이고, (2) `appendMessage`의 비원자적 DB 갱신은 고부하 상황에서 `message_count` 불일치를 유발하며, (3) `ExploreToolsService`가 타 모듈의 Repository를 직접 소비하는 패턴은 모듈 경계를 침해하여 향후 도메인 모듈 리팩터링 시 숨겨진 결합으로 작용할 수 있다. 프론트엔드 스토어 간 순환 의존성은 동적 import로 임시 해결되었으나, 이벤트 기반 브릿지로 구조적으로 해소하는 것이 장기적으로 바람직하다.

### 위험도

**HIGH**