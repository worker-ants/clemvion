# Refactor 백로그 — 아키텍처·확장성 (2026-06-10 전수 감사)

> 인덱스: [README.md](./README.md). Critical 3 / Major 9 / Minor 3 — **spec 대조(2026-06-10) 후 전 항목 유효하나 C-2 의 핵심 처방 1건이 spec 명시 결정과 충돌해 수정됨**.
> **spec 대조 판정 분포**: A 1 (M-5) / B 6 / C 0 / D 8 / E 0.
> **중복 참조**: C-1 정량 지표는 [03-maintainability.md](./03-maintainability.md) C-1 — 분할 설계는 본 파일 소유. M-3 도 본 파일 소유.
> **⚠️ spec 충돌 주의**: 엔진↔WebsocketService 의 forwardRef 는 `spec/5-system/4-execution-engine.md §4.4` 가 **명시적으로 의도한 설계**("`IExecutionEventEmitter` 같은 인터페이스를 도입하지 않는다", "forwardRef 는 회피해야 할 안티패턴이 아님") — 이벤트 포트 교체안은 spec 개정 선행 없이는 금지 (C-2 본문 참조).

## Critical

- [ ] **C-1 ExecutionEngineService — 9,210줄 god-class (SRP 전면 위반)** — `backend/src/modules/execution-engine/execution-engine.service.ts`
  단일 클래스가 8개 이상 책임: 그래프 순회, 노드 dispatch(`executeNode` 412줄), AI 멀티턴 생명주기, form/button 인터랙션, retry-last-turn, 상태 머신, 핸들러 등록 bootstrap. 생성자 의존성 20개, 메서드 ~70개.
  - **spec 대조**: D — `4-nodes/0-overview.md §1.0` 은 모듈 책임("오케스트레이션만")을 규정할 뿐 클래스 분할은 무언급. 같은 방향의 선행 분리(`resume-turn-dispatch.ts` registry, PR #507)가 "spec 변경 불요" 로 이미 착지 — strangler-fig 연속이 정당. 단 **원안의 "분리 서비스는 `WorkflowExecutor` 인터페이스 경유" 는 재고**: 그 인터페이스는 spec 상 engine↔**노드** 계약이라 엔진 내부 통신에 재사용하면 계약 의미가 과적됨.
  - **개선 방안** (분리 순서·통신 방식 확정):
    - [ ] 1. `NodeBootstrapService` — m-3 과 함께 **가장 먼저** (독립적·소규모, 아래 m-3 참조).
    - [ ] 2. `AiTurnOrchestrator` (waitForAiConversation / processAiResumeTurn / handleAiMessageTurn / finalizeAiNode ~600줄) — 기존 `ResumeTurnDispatch` registry 의 `handleAiResumeTurn` 진입점을 신규 서비스로 위임.
    - [ ] 3. `FormInteractionService` / `ButtonInteractionService` — `waitForX`/`processXResumeTurn` 쌍 이동, registry 등록부만 엔진 잔류.
    - [ ] 4. `RetryTurnService` (applyRetryLastTurn / buildRetryReentryState / resumeGraphAfterRetry) — `_retryState`/`_resumeCheckpoint` 는 spec §1.3 공유 계약, allow-list 불변 유지.
    - [ ] 5. 통신 인터페이스는 `WorkflowExecutor` 재사용 대신 **엔진 내부 전용 `EngineDriver`**(또는 `ResumeTurnContext` 확장) 신설. 분리 서비스의 이벤트 발행은 **`WebsocketService` 직접 주입 유지** (spec §4.4 — `IExecutionEventEmitter` 도입 금지).
  - 검증: `execution-park-resume.e2e-spec.ts` 포함 e2e 전체 + unit 전량 (PR #507 과 동일 게이트). / 회귀 위험: park=세그먼트 종료 의미(`PARK_RELEASED`), §7.5 rehydration 단일 경로, `RESUME_*` 코드 보존. / spec 갱신: `interaction-type-registry.md §1.1` 이 `WaitingInteractionType` 단일 진실 위치를 본 파일로 못박음 — 타입 이동 시 표+frontmatter `code:` 갱신 (planner, 기존 `spec-sync-resume-dispatch-registry.md` 에 합류 가능).

- [ ] **C-2 forwardRef 양방향 순환 의존 클러스터 — 클러스터별 개별 처리로 재정의** ⚠️
  - **spec 대조**: D — 단 **핵심 쌍(엔진↔WS)은 A**: `4-execution-engine.md §4.4` "sink 는 `WebsocketService` 가 canonical … 별도 추상화를 도입하지 않는다", "forwardRef … 회피해야 할 안티패턴이 아님", EIA·chat-channel 추가 후에도 재확인(`15-chat-channel.md §R4` "EventEmitter 교체는 본 결정 범위 밖"). KB→WS 직접 의존도 spec 명시(`8-embedding-pipeline.md` "`WebsocketService.emitKbEvent` 가 권위 정의"). 반면 `llm↔llm-config`, `chat-channel↔triggers` 는 spec 무언급.
  - **판단**: 원안의 "`ExecutionEventEmitter` 류 이벤트 포트로 교체" 는 **엔진↔WS 쌍에 한해 spec Rationale 과 정면 충돌 — 폐기**. 나머지는 개별 타당. **의도된 설계지만 여전히 고충(테스트 격리·초기화 순서)이 있는 항목 — 사용자 보고 대상.**
  - **개선 방안** (클러스터별):
    - [ ] 1. **엔진↔WS**: 현행 forwardRef 유지가 spec 준수. 다중 sink 가 실제 가시화될 때 §4.4 의 단서("그때 재검토")로 planner 에 spec 개정 발의 — 그 전 구현 금지.
    - [ ] 2. **WS gateway → 4개 서비스** (순환의 반대 변): M-7 authorizer 역전으로 해소 — sink 정책 비저촉.
    - [ ] 3. **KB cluster**: emit 방향(KB→WS)은 spec 명시라 유지. gateway→KB(`verifyDocumentOwnership`) 를 M-7 로 끊으면 단방향 import 로 단순화.
    - [ ] 4. **llm ↔ llm-config**: 공유 타입을 `shared/` 로 내려 단방향화 (모듈 흡수보다 `data-flow/7-llm-usage.md` participant 유지가 자연스러움).
    - [ ] 5. **chat-channel ↔ triggers**: trigger 의 chatChannel config 타입·registry 참조를 `chat-channel/types.ts` 또는 shared 로 내려 단방향화.
  - 검증: 부팅 스모크 + WS 구독·KB 임베딩 이벤트 e2e. / 회귀 위험: Nest DI 초기화 순서 변경 부팅 실패(컴파일로 안 잡힘). / spec 갱신: 1번 추진 시에만 §4.4 Rationale 개정 (planner, consistency-check --spec 의무).

- [ ] **C-3 AuthController 에 bcrypt 비밀번호 검증 (레이어 침범)** — `auth.controller.ts:55,328-335`
  - **spec 대조**: D — 행위(2FA 비활성화 시 비밀번호 재확인)는 `1-auth.md §1.2` spec 명시, 계층 배치는 무언급이나 `data-flow/2-auth.md §1.2` 의 시퀀스가 bcrypt.compare 를 일관되게 **Service** 에 배치 — controller 내 bcrypt 는 spec 의 데이터 흐름 모델과 불일치.
  - **개선 방안**: 1. `AuthService.verifyPasswordForUser(userId, plainPassword)` 신설 — `passwordHash` 부재/불일치 시 현 controller 와 동일한 에러 코드·메시지·401 을 서비스에서 throw. 2. `disable2fa` 의 bcrypt 블록 제거, controller 의 `import * as bcrypt`·`UsersService` 직접 의존 제거. 3. 다른 비밀번호 재확인 경로(세션 강제 종료 재인증 등)가 controller 에 있으면 같은 메서드로 통일.
  - 검증: auth unit + 2FA disable e2e (응답 코드·body 불변). / 회귀 위험: 낮음 — 에러 shape 보존. / spec 갱신: 불요.

## Major

- [ ] **M-1 AiAgentHandler 3,402줄 god-handler** — `nodes/ai/ai-agent/ai-agent.handler.ts`
  - **spec 대조**: D — `<type>.handler.ts` co-location 은 spec 규정이나 크기/보조 클래스 제한 없음. `AgentToolProvider` 분리는 spec(`11-mcp-client.md §1`)이 명시한 의도 패턴 — 같은 방향의 내부 분할은 비저촉. `processMultiTurnMessage` polymorphic 시그니처(information_extractor 와 공유, `4-execution-engine.md §1.3`)는 계약 — 보존 필수.
  - **개선 방안** (위험 낮은 순): 1. `AiConditionEvaluator` 먼저 (입출력 순수 — 추출 위험 최소). 2. `AiMemoryManager` (§12.9~12.14 Rationale 을 동작 보존 체크리스트로). 3. `AiTurnExecutor` (~1,050줄) — `processMultiTurnMessage` 시그니처는 핸들러에 남기고 내부 위임만. 4. 배치는 `nodes/ai/ai-agent/` 하위 (co-location 준수), `ai/shared/` 승격은 실공유 확인 후에만.
  - 검증: handler spec 테스트 + 멀티턴 park/resume e2e + render_* e2e. / 회귀 위험: §7.4~7.9 출력 포트 shape·`_resumeCheckpoint` allow-list. / spec 갱신: 불요. (메서드 분리 상세: [03-maintainability.md](./03-maintainability.md) C-2)

- [ ] **M-2 IntegrationOAuthService 2,579줄 — 다중 OAuth 프로토콜 혼합** — `integrations/integration-oauth.service.ts`
  - **spec 대조**: B — data-flow 시퀀스의 participant 가 `IntegrationOauthService` 단일이지만 spec 이 내부 구조를 구현 재량으로 명시(`4-integration.md` Rationale "provider 별 분리인지 파라메트릭인지는 구현 세부 사항"). facade 명 유지 시 다이어그램 무변.
  - **개선 방안**: 1. `OAuthProviderStrategy`(`begin`/`exchangeCode`/`refreshToken`) + `integrations/oauth-providers/` 에 5개 strategy (google/github/cafe24-public/cafe24-private/makeshop). 2. state·preview 토큰 관리는 facade 잔류. 3. `process.env` 7곳은 M-6 과 같은 PR 로 설정 객체 이전. 4. 이전 순서: makeshop(자기완결) → cafe24 2변형(install_token 흐름 보존) → google/github.
  - 검증: provider 별 OAuth e2e(stub) + 만료 스캐너 unit + `status_reason` 매핑 불변. / 회귀 위험: cafe24 private install_token·redirect URI 형식. / spec 갱신: 불요 (facade 유지 시).

- [ ] **M-3 WorkflowAssistantStreamService — `streamMessage` 혼재** — `workflow-assistant-stream.service.ts`
  - **spec 대조**: B — `4-ai-assistant.md` 는 도구 정의(§4)·SSE(§5~6)·가드(§10)의 **행위 계약**만 규정, 내부 분해 무언급. §10 의 미세 의미(progress-aware finish 재발동·review 최대 2회·verify 턴당 1회·plan-only fast-path)가 회귀 포인트.
  - **개선 방안**: 1. `AssistantToolRouter` — 도구명→handler registry + kind(`explore`/`plan`/`edit`) 메타, 신규 도구 = registry 1행 (OCP). 2. `AssistantFinishGuard`/`AssistantReviewGuard` — §10 상태 필드(`reviewRoundCount` 등)를 가드 객체로 캡슐화, 분리 단위를 §10 Phase 경계와 일치. 3. `AssistantTurnPersistenceService` — 세션/메시지 영속 + `autoResumed` 메타. 4. `streamMessage` 는 SSE 조립·중단 처리만.
  - 검증: SSE 이벤트 순서·`auto_resume` 분할 버블 e2e + finish 가드 시나리오 unit(§10 표 전부). / 회귀 위험: 가드 발동 순서·fast-path 비활성 조건. / spec 갱신: 불요.

- [ ] **M-4 blocking 인터랙션 문자열 리터럴 분기 잔존 — park-진입 측 dispatch 추출** — `execution-engine.service.ts:1577-1616,3709,3944-3948`
  - **spec 대조**: D — `interaction-type-registry.md` 가 이 분기들을 직접 통치: 문자열 분기 존재 자체는 규약이 인지·가드하는 상태(exhaustive switch 규칙), 단 규약 §4 Rationale 의 목적(shotgun surgery 차단)은 항목과 동일. **resume 측은 이미 registry 추출 완료(PR #507)** — 잔존 지점은 park-진입(waitForX 선택) 측.
  - **개선 방안**: 1. `ResumeTurnDispatch` 와 대칭인 `ParkEntryDispatch`(kind/selects/handle) 를 `resume-turn-dispatch.ts` 옆에 신설 — form/buttons/ai_conversation 3건 (`ai_form_render` 는 핸들러 emit 이라 비대상 — 매트릭스 §1.2 일치 확인). 2. retry-드라이브(1577-1616)·메인 루프(3700대) 두 중복 블록을 단일 `dispatchParkEntry(ctx)` 로 — `PARK_RELEASED` 조기반환 보존. 3. `NodeTypeMetadata` 신필드 불요 — `getMetadata().interaction` 이 이미 metadata 기반, registry 키로 그대로 사용. 4. `satisfies Record<WaitingInteractionType, …>` 로 exhaustive 보장 유지 (규약 규칙 2).
  - 검증: park/resume e2e + dispatch unit(우선순위 form→buttons→ai 보존). / 회귀 위험: `withInteractionMeta` 의 interactionType meta 누락 시 frontend snapshot reconcile 파괴. / **spec 갱신: 필요** — `interaction-type-registry.md §1.2` emit 위치 열 + 진행 중 `spec-sync-resume-dispatch-registry.md` 에 park-entry 레이어 추가 (planner).

- [ ] **M-5 `ALL_NODE_COMPONENTS` 정적 배열** ⚠️ **(A — 의도된 설계, 경량안만 단독 진행 가능)** — `nodes/index.ts:39-75`
  - **spec 대조**: **A** — `4-nodes/0-overview.md §1.0` 이 "정적 배열로 부팅 시 부트스트랩, 런타임 플러그인 로딩 경로는 존재하지 않는다" 로 현행을 명시. 동적 발견은 `marketplace-and-plugin-sdk.md` plan 의 미래 축으로 별도 예약. **의도된 설계지만 merge-conflict hotspot 고충은 실재 — 사용자 보고 대상.**
  - **개선 방안**: 1. (spec 무변 경량안) 카테고리별 배열(`AI_COMPONENTS`·`LOGIC_COMPONENTS`…)의 spread 합성으로 재구성 — 부팅 모델 불변, conflict 표면 분산, "정적 배열" 서술과 양립. 2. DI token/multi-provider 전환은 **마켓플레이스 plugin SDK plan 과 한 묶음으로만** (spec §1.0 개정 + consistency-check --spec 선행). 3. m-3 의 bootstrap 위치 이동은 본 항목과 독립 — 먼저 처리 가능.
  - 검증: 부팅 시 25 핸들러 등록 수 단언 + `GET /api/nodes/definitions` 스냅샷. / 회귀 위험: 배열 순서 의존 보존. / spec 갱신: 1안 불요, 2안 필수.

- [ ] **M-6 서비스 계층 `process.env` 직접 접근 32곳** — 대표: `integration-oauth.service.ts`, `mcp-client.service.ts`, `interaction-token.service.ts`, `llm.service.ts:78`
  - **spec 대조**: D — ConfigService 패턴이 spec 에 모델링된 영역 존재(`4-file-storage.md §2.3` "ConfigService 키: s3.*"), 단 **spec 이 직접 접근을 원문 명시한 곳도 있음**(`7-llm-client.md` "`process.env.LLM_STUB_MODE === 'true'`"). 전역 config 규약 문서는 부재.
  - **개선 방안**: 1. `common/config/` 에 `registerAs` namespace (`oauth`/`mcp`/`interactionToken`/`llm`) — 기존 `s3.*`·`jwt.secret` 패턴과 동일. 2. 이전 순서: integration-oauth 7곳(M-2 와 동일 PR) → mcp → interaction-token → llm. 3. Nest 밖 스크립트(BullMQ 운영 스크립트의 REDIS_*)는 면제 명시. 4. (선택) backend config 규약 신설 발의 — planner.
  - 검증: `.env.example` ↔ namespace 키 전수 대조 테스트 + 부팅 스모크. / 회귀 위험: ConfigModule 로드 전 초기화 시점 읽기(워커 분리 프로세스). / **spec 갱신**: `7-llm-client.md` 의 `process.env.LLM_STUB_MODE` 원문은 이전 시 동기화 (planner).

- [ ] **M-7 WebsocketGateway — 4개 서비스 forwardRef 직접 의존** — `websocket.gateway.ts:89-98`
  - **spec 대조**: D — 구독 시 소유권 검증은 `6-websocket-protocol.md §3` 의 spec 의무, 주입 메커니즘은 무언급. §4.4 단일 sink 정책과 비저촉(역방향 의존 제거일 뿐). gateway 에 이미 `channelAuthorizers` 내부 배열 존재 — 인터페이스화의 절반은 완료 상태.
  - **개선 방안**: 1. `CHANNEL_AUTHORIZER` multi-provider token + `ChannelAuthorizer { matches; authorize }` 인터페이스를 WS 모듈에 정의. 2. executions/background-runs/KB/engine 각 모듈이 자기 authorizer 를 provider 등록 (도메인 모듈 → WS 단방향). 3. gateway 는 token 배열만 주입 — forwardRef 4개 + 모듈 import 제거. 4. C-2 의 forwardRef 감소 효과를 같은 PR 에서 측정·기록.
  - 검증: 구독 실패 ack 계약 보존(`subscribed` ack 에 `success:false` + 평문 error — spec §3 원문) + WS e2e. / 회귀 위험: authorizer 등록 순서·미매칭 채널 기본 거부. / spec 갱신: 불요.

- [ ] **M-8 `trigger-detail-drawer.tsx` 1,604줄 god-component + API 직접 호출 8곳**
  - **spec 대조**: B — `2-trigger-list.md` 는 행위·필드 권한 매트릭스만 규정. spec §2.3.1 의 카드 단위 매트릭스가 분리의 자연 경계를 이미 제공.
  - **개선 방안**: 1. `lib/api/triggers.ts` 신설 — §3 API 표 + rotate-bot-token 의 typed wrapper (`lib/api/executions.ts` 패턴). 2. §2.3.1 카드 경계대로 분리: `TriggerOverviewCard`/`WebhookConfigCard`/`AuthConfigCard`/`ChatChannelCard`/`EiaNotificationCard`/`ScheduleCard` + 공용 `useCardEditToggle`. 3. fetch/mutation 은 `useTrigger(id)` custom hook. 4. m-2 의 `triggers/page.tsx` 와 같은 PR.
  - 검증: 드로어 e2e (R-16 read-only 배지, R-14 AuthConfig 셀렉터, rotate 차단 400). / 회귀 위험: 카드별 PATCH 단일 경로(R-4)·권한 매트릭스. / spec 갱신: 불요.

- [ ] **M-9 `extractRetryAfterMs` 유틸이 `llm.service.ts` 에 위치** — `llm.service.ts:407`
  - **spec 대조**: B — `node-output.md §3.2.1` 은 `retryAfterSec` 의미·invariant 만 규정, 물리 위치 무언급. **선례 존재**: 같은 사유로 `sanitizeLastErrorMessage` 가 이미 `shared/utils/` 이동 완료.
  - **개선 방안**: 1. `shared/utils/retry-after.ts` 신설 + 해당 unit test describe 분리 이동. 2. import 4곳 교체. 3. llm.service 에 re-export 두지 않음 (재발 차단 목적).
  - 검증: unit + build. / 회귀 위험: 사실상 없음. / spec 갱신: 불요.

## Minor

- [ ] **m-1 `IntegrationsController.previewTest` — registry 검증을 controller 가 수행** — `integrations.controller.ts:65,175`
  - **spec 대조**: B — preview-test 행위만 spec 규정. **부수 발견**: 에러 코드 `INTEGRATION_INVALID_SERVICE` 가 `error-codes.md` 미등재.
  - **개선 방안**: 1. `IntegrationsService.validateServiceAuthType()` 신설 — 동일 `BadRequestException` 보존. 2. 사용처 교체 + controller 의 `findVariant` import 제거. 3. (부수) `INTEGRATION_INVALID_SERVICE` 의 error-codes.md 등재를 planner 에 확인 요청.
  - 검증: preview-test unit(400 코드·메시지 불변). / 회귀 위험: 낮음. / spec 갱신: 에러 코드 등재 검토 (planner).

- [ ] **m-2 frontend 다수 페이지의 apiClient 직접 호출** — statistics/triggers/schedules/dashboard 페이지
  - **spec 대조**: B — frontend api 계층 규약 부재, 기존 `lib/api/*` 는 코드베이스 관례.
  - **개선 방안**: 1. `lib/api/triggers.ts`(M-8 에서 생성) → `triggers/page.tsx` 이전. 2. `lib/api/statistics.ts`/`schedules.ts`/`dashboard.ts` 신설 — 각 spec 의 API 표를 함수 카탈로그 SoT 로. 3. 페이지별 1 PR 점진 이전. 4. (선택) ESLint 로 `app/**/page.tsx` 의 apiClient 직접 import 금지.
  - 검증: 페이지별 e2e/스냅샷. / 회귀 위험: 에러 처리·query param 직렬화 미세 차이. / spec 갱신: 불요.

- [ ] **m-3 엔진 내 `ALL_NODE_COMPONENTS` 직접 bootstrap — nodes 레이어 의존 역전** — `execution-engine.service.ts:55,2718-2720`
  - **spec 대조**: D — bootstrap 주체(`NodeComponentRegistry`)는 spec 명시, **호출 위치는 무언급** — 이동은 구현 재량. 난점은 `handlerDeps.build(this)` 가 엔진 자신(WorkflowExecutor 역)을 요구하는 것 — spec 이 이미 정의한 `WorkflowExecutor` 계약을 DI token 화하면 자연 해소 (C-1 의 내부 통신과 달리 **여기는 그 계약의 정확한 용처**).
  - **개선 방안**: 1. `WORKFLOW_EXECUTOR` token — 엔진 모듈이 `useExisting: ExecutionEngineService` 바인딩. 2. nodes 모듈에 `NodeBootstrapService`(`OnModuleInit`) — bootstrap 호출 이관, deps 는 token 주입. 3. 엔진의 import(:55)·`registerHandlers()`(:2718) 제거 → `nodes.module.ts:12` forwardRef 해소 확인. 4. C-1 로드맵 중 **최우선 실행** (M-5 배열 형태 변경과는 분리 — 본 건은 spec 무변).
  - 검증: 부팅 시 핸들러 25종 등록 unit + e2e 스모크. / 회귀 위험: bootstrap 시점이 dispatch 보다 늦는 race — OnModuleInit 순서 단언 테스트. / spec 갱신: 불요.
