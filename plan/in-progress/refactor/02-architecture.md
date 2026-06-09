# Refactor 백로그 — 아키텍처·확장성 (2026-06-10 전수 감사)

> 인덱스: [README.md](./README.md). Critical 3 / Major 9 / Minor 3.
> **중복 참조**: C-1 의 정량 지표(116 메서드, 323 분기)와 메서드 길이 상세는 [03-maintainability.md](./03-maintainability.md) C-1 — 분할 설계는 본 파일이 소유. M-3 (streamMessage) 도 본 파일 소유, 03 의 M-5 가 참조.
> **기존 plan 관계**: [`../execution-engine-residual-gaps.md`](../execution-engine-residual-gaps.md) 는 spec 미구현 surface(G1/G2) 추적으로 본 건(구조 분할)과 별개 축.

## Critical

- [ ] **C-1 ExecutionEngineService — 9,210줄 god-class (SRP 전면 위반)** — `backend/src/modules/execution-engine/execution-engine.service.ts`
  단일 클래스가 8개 이상 책임: 그래프 순회(`runNodeDispatchLoop`), 노드 dispatch(`executeNode` 412줄), AI 멀티턴 생명주기(`handleAiMessageTurn` ~350줄, `finalizeAiNode` ~170줄), form/button 인터랙션, retry-last-turn(`applyRetryLastTurn` ~160줄), 상태 머신 전환, 핸들러 등록 bootstrap. 생성자 의존성 20개, 메서드 ~70개(공개 12), 12개 파일이 import (다수 forwardRef).
  → strangler-fig 단계 분리 (우선순위 순):
  - [ ] `AiTurnOrchestrator` (waitForAiConversation / processAiResumeTurn / handleAiMessageTurn / finalizeAiNode, ~600줄)
  - [ ] `FormInteractionService` (waitForFormSubmission / processFormResumeTurn)
  - [ ] `ButtonInteractionService` (waitForButtonInteraction / processButtonResumeTurn)
  - [ ] `RetryTurnService` (applyRetryLastTurn / buildRetryReentryState / resumeGraphAfterRetry)
  - [ ] `NodeBootstrapService` (registerHandlers 이동 — M-5·m-3 연계)
  - [ ] 분리 서비스는 `WorkflowExecutor` 인터페이스 경유로 엔진과 통신

- [ ] **C-2 forwardRef 양방향 순환 의존 클러스터 6곳**
  `execution-engine.module.ts:59` ↔ `websocket.module.ts:23-27`, `websocket.gateway.ts:91-97`(4개), `nodes.module.ts:12`, `knowledge-base.module.ts:42`, `embedding.service.ts:50`·`graph-extraction.service.ts:92`, `llm.module.ts:12` ↔ `llm-config.module.ts:9`, `chat-channel.module.ts:46` ↔ `triggers.module.ts:24`.
  forwardRef 는 초기화 순서를 불명확하게 하고 테스트 격리를 방해 — 모듈 경계가 실질 부재라는 신호.
  → `WebsocketService` 의존을 `ExecutionEventEmitter` 류 단방향 이벤트 포트로 교체. KB/Embedding 은 포트 인터페이스 의존. `LlmConfig` 는 `LlmModule` 흡수 또는 공유 인터페이스 분리.

- [ ] **C-3 AuthController 에 bcrypt 비밀번호 검증 (레이어 침범)** — `backend/src/modules/auth/auth.controller.ts:55,328-335`
  `disable2fa` 가 controller 에서 `bcrypt.compare` 직접 수행. controller 파일에 `import * as bcrypt` 존재 자체가 물증.
  → `AuthService.verifyPasswordForUser(userId, plainPassword)` 추가, controller 의 bcrypt import 제거. (소규모 — 즉시 처리 가능)

## Major

- [ ] **M-1 AiAgentHandler 3,402줄 god-handler** — `backend/src/nodes/ai/ai-agent/ai-agent.handler.ts`
  단일/멀티 턴 실행, 메시지 처리(~1,050줄), 메모리 전략, 툴 빌드(~200줄), 조건 평가 혼재. `AgentToolProvider` 분리는 이미 완료 — 같은 방향 지속.
  → `AiTurnExecutor` / `AiConditionEvaluator` / `AiMemoryManager` 분리, 핸들러는 조율자로 축소. (메서드 분리 상세: [03-maintainability.md](./03-maintainability.md) C-2)

- [ ] **M-2 IntegrationOAuthService 2,579줄 — 다중 OAuth 프로토콜 혼합** — `backend/src/modules/integrations/integration-oauth.service.ts`
  Google/GitHub, Cafe24 public/private, MakeShop OAuth2.1+PKCE, state/preview 토큰 관리 단일 파일 + `process.env` 직접 접근 7곳.
  → `OAuthProviderStrategy` 인터페이스 (`begin`/`exchangeCode`/`refreshToken`) + provider 별 strategy 분리, facade 화. env 는 ConfigService 일원화. (중복 제거 관점: [03-maintainability.md](./03-maintainability.md) M-1)

- [ ] **M-3 WorkflowAssistantStreamService — `streamMessage` 단일 제너레이터에 스트리밍·tool 라우팅·가드·영속화 혼재** — `backend/src/modules/workflow-assistant/workflow-assistant-stream.service.ts`
  새 assistant tool 추가 시마다 거대 제너레이터 내부 수정 필요 (shotgun surgery).
  → `AssistantToolRouter` registry 패턴(OCP), `AssistantFinishGuard`/`AssistantReviewGuard`/`AssistantTurnPersistenceService` 분리.

- [ ] **M-4 blocking 인터랙션 문자열 리터럴 분기 잔존** — `execution-engine.service.ts:1577-1616,3709,3944-3948`
  `dispatchKind` 는 metadata 기반으로 전환됐으나 `blocking.interaction === 'form'|'buttons'|'ai_conversation'` 비교가 잔존 — 신규 인터랙션 타입 추가 시 shotgun surgery.
  → `NodeTypeMetadata.blockingInteraction` 에 전략 키를 두고 registry lookup 으로 교체.

- [ ] **M-5 `ALL_NODE_COMPONENTS` 정적 배열 — 노드 등록 확장성 한계** — `backend/src/nodes/index.ts:39-75`
  25개 컴포넌트 하드코딩 배열이 merge conflict hotspot.
  → `NODE_COMPONENT` DI token + multi provider 또는 노드별 모듈 자동 발견 패턴으로 전환.

- [ ] **M-6 서비스 계층 `process.env` 직접 접근 32곳** — 대표: `integration-oauth.service.ts:470,1090,1146`, `mcp-client.service.ts:25,250,254`, `interaction-token.service.ts:89,91`, `llm.service.ts:78`
  → ConfigService / provider 별 설정 객체(`common/config/`)로 일원화.

- [ ] **M-7 WebsocketGateway — 4개 서비스 forwardRef 직접 의존 (C-2 의 직접 원인)** — `websocket.gateway.ts:89-98`
  → `ChannelAuthorizationPort` 인터페이스 정의, 각 서비스가 구현 — gateway 는 인터페이스에만 의존.

- [ ] **M-8 `trigger-detail-drawer.tsx` 1,604줄 god-component + API 직접 호출 8곳** — `frontend/src/components/triggers/trigger-detail-drawer.tsx`
  → `lib/api/triggers.ts` 추상화 생성, 트리거 타입별 편집 컴포넌트 분리, 로직은 custom hook 으로.

- [ ] **M-9 `extractRetryAfterMs` 유틸이 `llm.service.ts` 에 위치** — `backend/src/modules/llm/llm.service.ts:407` (engine·핸들러들이 유틸 목적으로 llm.service import)
  → `shared/utils/retry-after.ts` 로 이동.

## Minor

- [ ] **m-1 `IntegrationsController.previewTest` — service registry 검증을 controller 가 수행** — `integrations.controller.ts:65,175`
  → `IntegrationsService.validateServiceAuthType()` 으로 이동.

- [ ] **m-2 frontend 다수 페이지의 apiClient 직접 호출** — `statistics/page.tsx`, `triggers/page.tsx`, `schedules/page.tsx`, `dashboard/page.tsx` 등
  → `lib/api/triggers.ts`, `lib/api/statistics.ts` 등 누락 API 모듈 생성 (M-8 연계).

- [ ] **m-3 엔진 내 `ALL_NODE_COMPONENTS` 직접 bootstrap — nodes 레이어 의존 역전** — `execution-engine.service.ts:55,2718-2720` (`nodes.module.ts` forwardRef 의 원인 중 하나)
  → C-1 의 `NodeBootstrapService` + M-5 DI token 주입으로 함께 해소.
