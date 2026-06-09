# Refactor 백로그 — 유지보수성·가독성 (2026-06-10 전수 감사)

> 인덱스: [README.md](./README.md). Critical 4 / Major 7 / Minor 4.
> **중복 참조**: C-1 의 분할 설계는 [02-architecture.md](./02-architecture.md) C-1 소유 — 여기서는 정량 근거만. M-5 (streamMessage) 는 02 의 M-3 참조.

## 정량 지표 (2026-06-10)

| 지표 | 값 |
| --- | --- |
| 소스 파일 수 (TS/TSX, 비테스트) | ~1,170 |
| 2,000줄 초과 / 1,000–1,999줄 파일 | 5 / 18 |
| backend `any` 사용 파일 수 | 44 |
| 최장 단일 메서드 | `processMultiTurnMessageInner` 971줄 |
| execution-engine.service.ts 메서드 / 조건 분기 | 116개 / 323개 |

## Critical

- [ ] **C-1 execution-engine.service.ts — 9,210줄·116메서드·323분기** — 최장 메서드: `executeNode` 412줄, `executeInline` 406줄, `runExecution` 402줄, `handleAiMessageTurn` 347줄, `processButtonResumeTurn` 316줄.
  → 분할 설계·체크리스트는 [02-architecture.md](./02-architecture.md) C-1 에서 추적 (본 항목은 그 완료로 닫힘).

- [ ] **C-2 ai-agent.handler.ts — `processMultiTurnMessageInner` 971줄 단일 메서드** — `backend/src/nodes/ai/ai-agent/ai-agent.handler.ts:2084` (+ `executeSingleTurn` 540줄, `executeMultiTurn` 211줄)
  LLM 호출 루프·툴 실행·메모리/컨텍스트 주입·재시도·에러 분류·체크포인트가 한 메서드에. 분기 단위 단위 테스트 사실상 불가.
  → `buildTurnMessages` / `executeToolBatch`(기존 `executeProviderToolBatch` 활용 확대) / `classifyTurnResult` / `handleTurnCompletion` 단계로 분리. `executeSingleTurn` 도 빌드→호출→파싱→출력 파이프라인화.

- [ ] **C-3 Cafe24/MakeShop API 클라이언트 ~1,600줄 구조 중복** — `backend/src/nodes/integration/cafe24/cafe24-api.client.ts`(1,547줄), `makeshop/makeshop-api.client.ts`(1,060줄)
  `ensureFreshToken`·`refreshViaQueue`·`performAuthRefresh`·`markAuthFailed`·`recordNetworkFailure`·`withIntegrationLock`·`pingConnection`·`call` 등이 거의 동일 구조로 복제. 이미 `insufficient_scope` 처리가 cafe24 에만 있는 비대칭 발생 — 한쪽 버그 수정이 다른 쪽에 누락되는 구조.
  → `BaseIntegrationApiClient<TCredentials>` 추상 클래스로 공통 로직 일원화. credential 필드(mall_id/shop_uid)·에러 코드·OAuth 엔드포인트만 서브클래스 override.

- [ ] **C-4 WebSocket Gateway — 5개 핸들러 인증+소유권 보일러플레이트 복붙** — `backend/src/modules/websocket/websocket.gateway.ts` (844줄)
  `handleSubmitForm`/`handleClickButton`/`handleSubmitMessage`/`handleEndConversation`/`handleRetryLastTurn` 가 `const enriched = client as Socket & {...}` + userId 검사 + `verifyOwnership` try/catch 블록을 반복 (`as Socket` 패턴 7회). 에러 메시지도 핸들러마다 미세 불일치.
  → `WsAuthGuard` 또는 `requireAuth(client)` / `requireOwnership(executionId, workspaceId)` 공통 helper 로 추출.

## Major

- [ ] **M-1 `handleInstall`(201줄) vs `handleMakeshopInstall`(207줄) — 77% 동일 흐름 중복** — `integration-oauth.service.ts:1459,1763` (`handleCallback` 도 유사)
  → 공통 흐름을 제네릭 메서드로 추출, provider 분기는 `IntegrationInstallConfig` 주입 (02-architecture M-2 strategy 화와 연계).

- [ ] **M-2 frontend `API_BASE_URL` 4파일 분산 정의 + 포트 불일치 (3001 vs 3011)** — `lib/api/client.ts:4`, `lib/api/assistant.ts:315`, `components/auth/login-form.tsx:32`, `components/auth/register-form.tsx:32`, `lib/api/auth-providers.ts:18`
  env 미설정 환경에서 login/register 만 다른 포트로 요청.
  → `lib/api/constants.ts` 단일 소스로 통일 (auth-providers 의 서버사이드 `INTERNAL_API_URL` 우선 로직은 유지).

- [ ] **M-3 AI 핸들러들의 LLM retry 루프 독자 구현 3벌** — `information-extractor.handler.ts:480-502,618` vs `ai-agent.handler.ts:1854` vs text-classifier 자체 루프
  `maxRetries=2`·`lastError`·`totalAttempts` 패턴이 동형 복제.
  → `nodes/ai/shared/` 에 `withLlmRetry(fn, maxRetries)` / `LlmTurnRunner` 공유 유틸 추출.

- [ ] **M-4 `integration-configs.tsx` 972줄 — Cafe24Config(238줄)/MakeshopConfig(201줄) 구조 중복** — `frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx:404,716`
  → `IntegrationOperationConfig<TExtras>` 제네릭 컴포넌트로 공통 레이아웃 추출, 카탈로그 조회·필드 렌더링은 props 주입.

- [ ] **M-5 `streamMessage` 882줄 제너레이터** — `workflow-assistant-stream.service.ts:333` → 분리 설계는 [02-architecture.md](./02-architecture.md) M-3 에서 추적.

- [ ] **M-6 dead code — `registerContinuationHandlers`(빈 본체) + deprecated `ContinuationBusService.on()`** — `execution-engine.service.ts:879`, `continuation-bus.service.ts:154`
  Phase 2 완료 후 제거 예정이던 잔류물. → 호출부·본체·deprecated 메서드 일괄 제거 (관련 테스트 훅 정리 포함).

- [ ] **M-7 execution-engine 내 inline 타입 단언 50+ 곳** — 샘플: `execution-engine.service.ts:370,371,519,525,1684,2941,4688,4717-4718`
  `(x as number)` 류가 타입 안전망 우회 — 불일치 시 조용한 런타임 오류.
  → 노드 config/variables 에 명시 인터페이스 + 타입 가드(또는 zod 파싱) 도입.

## Minor

- [ ] **m-1 NestJS 서비스 내 `console.warn` 직접 사용 4곳** — `telegram-message.renderer.ts:416`, `audit-logs.service.ts:85`, `language-hint-defaults.ts:75`, `mcp-test-connection.service.ts:153`
  → `Logger` 주입으로 교체 (scripts/instrumentation 은 예외 유지).

- [ ] **m-2 `@deprecated` 심볼 4건 잔류** — `chat-channel/types.ts:102`(executionFailed), `chat-channel.dispatcher.ts:636`(toEiaEvent), `execution-engine.service.ts:877`, `system-status.constants.ts:117,119`
  → 일괄 제거 PR (M-6 과 묶어도 무방).

- [ ] **m-3 `integrations/new/page.tsx` 1,444줄 — 8개 컴포넌트 단일 파일** — `frontend/src/app/(main)/integrations/new/page.tsx`
  → `components/integrations/steps/` 로 단계별 분리, page 는 상태·단계 전환만.

- [ ] **m-4 catch 변수명 혼재 (`err` 180 / `error` 37 / `e` 10)** — backend 전체
  → ESLint `unicorn/catch-error-name` 류 규칙 + autofix 로 `err` 통일.
