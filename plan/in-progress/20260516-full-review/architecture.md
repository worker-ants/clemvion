# Architecture Review — 2026-05-16

## 발견사항

---

### 1. ExecutionEngineService 단일 책임 위반 (SRP Critical)

- **[CRITICAL]** `ExecutionEngineService` 가 4,733줄 God-Object로 성장해 단일 파일 안에 그래프 순회, 노드 dispatch, 상태 머신, WS 이벤트 발행, AI 대화 흐름 관리, 분산 continuation, 백그라운드 스케줄링을 모두 담당한다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:377`
  - 상세: public 메서드만 `execute`, `executeSync`, `executeAsync`, `executeInline`, `continueExecution`, `continueButtonClick`, `continueAiConversation`, `endAiConversation`, `cancelWaitingExecution`, `executeBackgroundSubgraph` 등 10개 이상이며, private 메서드 포함 30개 이상의 async 메서드가 하나의 클래스에 집중되어 있다. AI 대화 처리(`waitForAiConversation`, `handleAiMessageTurn`, `finalizeAiNode`)는 AI 도메인 로직임에도 엔진 내부에 있고, 버튼 인터랙션 대기(`waitForButtonInteraction`)도 Presentation 레이어 관심사다. 코드 자체에 "~4200줄로 크기가 크므로 PR-H/I 에서 점진적으로 책임 분해 예정"이라는 TODO 주석이 남아 있다.
  - 제안: AI 대화 흐름 → `AiConversationOrchestrator`, 버튼/폼 blocking 흐름 → `UserInteractionService`, 그래프 순회 → `GraphTraversalService`, 이벤트 발행 → `ExecutionEventEmitter`로 분리. `ExecutionEngineService`는 조율자 역할만 담당하도록 리팩토링한다.

---

### 2. ExecutionEngineService 생성자 의존성 과부하 (DIP/ISP Warning)

- **[WARNING]** `ExecutionEngineService` 생성자가 16개 의존성을 직접 주입받는다. 이 중 `LlmService`, `RagSearchService`, `KnowledgeBaseService`, `IntegrationsService`, `McpClientService`, `Cafe24ApiClient`는 핵심 실행 흐름이 아닌 `registerHandlers()`에서 `HandlerDependencies`로 묶어 node component에 전달하기 위해 보유한다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:421–457`
  - 상세: 엔진 자체가 직접 사용하는 서비스는 DB 저장소 6개, WS, Config, ContinuationBus, ConversationThread, 컨테이너 executor 3개 수준이다. 도메인 서비스 5개 + `Cafe24ApiClient`는 엔진이 node handler에 delegation하기 위한 pass-through 역할이다. 이는 인터페이스 분리 원칙 위반으로, 새 통합을 추가할 때마다 엔진 생성자·모듈 import가 변경된다.
  - 제안: `HandlerDependencies` 를 DI 토큰으로 묶어 `HandlerDependenciesFactory`로 분리하거나, 도메인 서비스 집합을 `NodeRuntimeContext` 인터페이스로 추상화해 엔진이 인터페이스에만 의존하도록 한다.

---

### 3. ExecutionEngineModule이 Cafe24Module을 직접 import (모듈 경계 위반)

- **[WARNING]** `ExecutionEngineModule`이 `nodes/integration/cafe24/cafe24.module.ts`를 직접 import한다. spec 주석에 "nodes → modules dependency direction 보존"이라고 명시되어 있으나 이 방향이 역전되어 있다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.module.ts:25`
  - 상세: `Cafe24Module`은 `nodes/integration/` 하위이므로 도메인 노드 구현체다. `ExecutionEngineModule`(인프라 레이어)이 특정 integration 노드 모듈을 직접 알고 있으면 새 first-party integration(Shopify, Naver Smartstore)을 추가할 때마다 엔진 모듈이 수정된다. OCP 위반이다. `HandlerDependencies.cafe24ApiClient`가 optional로 선언되어 있는 것이 이 긴장을 노출하고 있다.
  - 제안: `Cafe24ApiClient`를 DI 토큰(`CAFE24_API_CLIENT`)으로 추상화해 `ExecutionEngineModule`은 토큰만 선언하고, 실제 binding은 `AppModule` 수준에서 conditional provider로 등록한다. 또는 `HandlerDependencies`의 `cafe24ApiClient`를 제거하고 `Cafe24McpToolProvider`가 스스로 DI로 `Cafe24ApiClient`를 받도록 변경한다.

---

### 4. ExecutionEngineService가 AI 노드 내부 상수를 직접 import (추상화 수준 위반)

- **[WARNING]** 실행 엔진이 `nodes/ai/llm-provider-rule.ts`의 `AI_LLM_PROVIDER_NODE_TYPES`와 `nodes/presentation/_shared/button.types.ts`의 `ButtonConfig`를 직접 import한다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:75–91`
  - 상세: `AI_LLM_PROVIDER_NODE_TYPES`는 특정 노드 타입 집합을 하드코딩한 것으로 엔진이 AI 노드 구현 세부사항을 알아야 한다는 의미다. `ButtonConfig` 타입은 Presentation 노드가 생산하는 output 형태인데 엔진이 이를 직접 파싱해 `waitForButtonInteraction`을 처리한다. 이는 레이어 경계가 흐릿해지는 것이다.
  - 제안: `AI_LLM_PROVIDER_NODE_TYPES` 대신 `NodeTypeMetadata.needsLlmProvider: boolean` 플래그를 등록 시 채우고 엔진은 이 메타데이터만 읽는다. `ButtonConfig`는 `NodeHandlerOutput.interactionConfig` 인터페이스로 추상화해 엔진이 타입을 직접 알지 않아도 된다.

---

### 5. WebsocketModule ↔ ExecutionEngineModule 양방향 순환 의존성

- **[WARNING]** `ExecutionEngineModule`이 `WebsocketModule`을 `forwardRef`로 import하고, `WebsocketModule`이 `ExecutionEngineModule`을 `forwardRef`로 import한다. 추가로 `WebsocketModule`은 `KnowledgeBaseModule`을, `KnowledgeBaseModule`은 `WebsocketModule`을 상호 `forwardRef`로 import한다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.module.ts:43`, `codebase/backend/src/modules/websocket/websocket.module.ts:22–26`, `codebase/backend/src/modules/knowledge-base/knowledge-base.module.ts:38`
  - 상세: `forwardRef`는 NestJS가 순환 참조를 런타임에 풀어주는 임시방편이나, 초기화 순서가 불명확해지고 미래 리팩토링에서 undefined 참조 버그를 유발할 수 있다. `WebsocketGateway`가 `ExecutionEngineService`, `ExecutionsService`, `BackgroundRunsService`, `KnowledgeBaseService` 모두를 직접 생성자 주입받는 것이 근본 원인이다.
  - 제안: 이벤트 기반 분리를 적용한다. `ExecutionEngineService`·`KnowledgeBaseService` 등은 `EventEmitter2`나 `WebsocketService`의 인터페이스(이벤트 발행 전용 포트)에만 의존하고, `WebsocketGateway`는 subscribe 인가를 위해 ID 소유권 검증 서비스를 별도의 얇은 인터페이스로 분리한다.

---

### 6. sub-workflow 실행 시 workspace 교차 접근 가능성 (Security Warning)

- **[WARNING]** `executeSync`, `executeAsync`, `executeInline` 에서 `workflowId`로 대상 워크플로우를 찾지만 현재 실행의 `workspaceId`와 동일 workspace에 속하는지 검증하지 않는다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:1049–1054`, `1155–1160`, `718–725`
  - 상세: `WorkflowHandler`가 사용자 config에서 읽은 `workflowId`를 엔진에 그대로 전달하므로, 악의적 또는 잘못 구성된 Workflow 노드가 다른 workspace의 workflow를 실행할 수 있다. 진입점(controller)의 workspace 검증은 초기 workflow 실행에만 적용된다. `executeInline`은 workspace 컨텍스트를 완전히 무시한다.
  - 제안: `executeSync`, `executeAsync`, `executeInline` 내부에서 대상 workflow의 `workspaceId`를 parent execution의 `workspaceId`와 비교하는 검증을 추가한다. `ExecutionContext`에 `workspaceId`를 1급 필드로 승격시킨다.

---

### 7. codebase/backend/src/common vs codebase/backend/src/shared 역할 불명확

- **[WARNING]** `common/`은 HTTP 레이어 공통 유틸(데코레이터, 가드, 인터셉터, 파이프, DTO, Swagger 헬퍼, S3Service)을 담당하고, `shared/`는 순수 도메인 타입(conversation-thread)을 담당하지만 이 분류 기준이 명시된 문서가 없다.
  - 위치: `codebase/backend/src/common/`, `codebase/backend/src/shared/`
  - 상세: `S3Service`(`common/services/`)는 인프라 레이어 서비스로 HTTP 레이어 유틸인 `common`에 있는 것이 어색하다. 반면 `shared/conversation-thread/`는 `nodes/`와 `modules/execution-engine/` 모두에서 import하는 순수 타입 모듈이다. 명확한 경계 없이 두 디렉터리가 공존하면 새 공유 코드가 어디에 속하는지 판단 기준이 없어 혼재가 심화된다.
  - 제안: `common/` = HTTP/NestJS 레이어 전용(데코레이터, 가드, 인터셉터, DTO, Swagger). `shared/` = 레이어 독립적 도메인 타입·순수 유틸리티. `S3Service`를 `shared/storage/`로 이동. 이 분류를 CLAUDE.md 또는 별도 ADR로 명문화한다.

---

### 8. Cafe24ApiClient의 다중 책임 (SRP Warning)

- **[WARNING]** `Cafe24ApiClient`(1,271줄)가 HTTP 요청 실행, rate-limit leaky-bucket, OAuth 토큰 갱신 직렬화(BullMQ), Integration 상태 전이(`status: 'error(auth_failed)'`), 재시도 로직, ping 검증을 모두 담당한다.
  - 위치: `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.ts`
  - 상세: 30+ 커밋으로 기능이 누적되며 단일 클래스가 인프라(HTTP), 도메인 정책(rate-limit, 토큰 갱신), 엔티티 상태 관리를 혼합하게 됐다. 테스트가 어려워지고 Shopify 등 유사 integration 추가 시 패턴 재사용이 불가능하다.
  - 제안: `Cafe24HttpTransport`(HTTP 전용), `Cafe24TokenManager`(토큰 갱신, BullMQ 직렬화), `Cafe24RateLimiter`(leaky-bucket)로 분해. `Cafe24ApiClient`는 이 세 컴포넌트를 조율하는 facade로 유지한다.

---

### 9. packages/expression-engine, packages/node-summary 패키지 경계는 건전함

- **[INFO]** `packages/expression-engine`과 `packages/node-summary`는 `codebase/backend/`·`codebase/frontend/` 내부 경로를 import하지 않는다. 파일 의존성 스캔 결과 단방향 경계가 유지되고 있다.
  - 위치: `packages/expression-engine/src/`, `packages/node-summary/src/`
  - 상세: 두 패키지는 순수 로직 라이브러리로 backend·frontend가 npm file 의존성으로 소비한다. 현재 상태는 아키텍처 설계 의도에 부합한다.
  - 제안: 유지. 향후 패키지가 node_modules 경로 등 외부를 import하지 않도록 CI에서 `madge --circular` 또는 `dependency-cruiser` 규칙을 추가한다.

---

### 10. frontend 컴포넌트 레이어에서 직접 API 호출 (레이어 책임 혼재)

- **[INFO]** `components/auth/login-form.tsx`, `components/layout/sidebar.tsx`, `components/editor/toolbar/editor-toolbar.tsx` 등 다수 컴포넌트가 `@/lib/api/*`를 직접 import해 API 호출을 수행한다.
  - 위치: `codebase/frontend/src/components/auth/login-form.tsx:11`, `codebase/frontend/src/components/layout/sidebar.tsx:36–38`, `codebase/frontend/src/components/editor/version-history/*.tsx`
  - 상세: React 관례에서 컴포넌트가 API를 직접 호출하는 것 자체는 흔하지만, 비즈니스 로직(로그인 성공 후 토큰 저장, workspace 전환)이 컴포넌트 내부에 분산되어 있다. `lib/stores/`에 이미 상태 관리 레이어가 있음에도 일부 컴포넌트가 store를 거치지 않고 API를 직접 호출한다. 일관성 없는 데이터 흐름은 버그 추적을 어렵게 한다.
  - 제안: 인증 플로우(login, register)는 `auth-store`의 action으로 캡슐화. 컴포넌트는 store action만 호출하고 API 모듈을 직접 import하지 않는 패턴을 강제한다. editor 내 version-history API 호출은 `useVersionHistory` custom hook으로 추출한다.

---

### 11. nodes/core/node-component.interface.ts가 module 서비스를 직접 import (순환 의존 잠재)

- **[INFO]** `nodes/core/node-component.interface.ts`가 `HandlerDependencies` 타입 정의를 위해 `modules/llm/llm.service`, `modules/knowledge-base/search/rag-search.service`, `modules/integrations/integrations.service`, `modules/mcp/mcp-client.service`, `modules/websocket/websocket.service`, `modules/execution-engine/conversation-thread/conversation-thread.service`를 직접 import한다.
  - 위치: `codebase/backend/src/nodes/core/node-component.interface.ts:11–18`
  - 상세: `nodes/core/`는 모든 노드가 의존하는 기반 계층이어야 하는데 `modules/`의 구체 서비스 타입을 import함으로써 `nodes/*` ↔ `modules/*` 간 의존 방향이 단순하지 않다. 현재는 `import type`이라 런타임 순환은 발생하지 않지만 향후 구체 클래스 import로 확대되기 쉬운 구조다.
  - 제안: `HandlerDependencies`의 각 서비스를 인터페이스(`ILlmService`, `IRagSearchService` 등)로 추상화해 `nodes/core/`가 인터페이스만 알도록 한다. 구체 클래스 바인딩은 `modules/execution-engine/` 수준에서 처리한다.

---

## 요약

백엔드 아키텍처의 전반적인 모듈 분리 의도(modules ↔ nodes 단방향, packages 격리)는 명확하게 설계되어 있으나, 병렬 작업 누적으로 `ExecutionEngineService`가 4,733줄 God-Object로 비대해져 SRP를 심각하게 위반하고 있다. Cafe24 integration 30+ 커밋 누적의 영향이 `Cafe24ApiClient` 다중 책임, `ExecutionEngineModule`의 `Cafe24Module` 직접 의존, `HandlerDependencies`의 optional 필드 노출로 구체화되어 있다. 순환 의존성은 `forwardRef`로 억제되어 있으나 `WebsocketModule`을 중심으로 세 모듈이 상호 의존하는 패턴이 누적되어 있어 리팩토링 비용을 높이고 있다. 보안 측면에서 sub-workflow 실행 시 workspace 격리 검증 누락은 멀티 테넌트 환경에서 데이터 교차 접근을 허용할 수 있으므로 즉시 보완이 필요하다. 프론트엔드는 레이어 책임이 상대적으로 양호하나 API 호출이 컴포넌트와 store 레이어 모두에 분산된 비일관성이 존재한다.

## 위험도

HIGH
