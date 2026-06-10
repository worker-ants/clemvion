# Refactor 백로그 — 아키텍처·확장성 (2026-06-10 전수 감사)

> 인덱스: [README.md](./README.md). Critical 3 / Major 9 / Minor 3 — **spec 대조(2026-06-10) 후 전 항목 유효하나 C-2 의 핵심 처방 1건이 spec 명시 결정과 충돌해 수정됨**.
> **spec 대조 판정 분포**: A 1 (M-5) / B 6 / C 0 / D 8 / E 0.
> **중복 참조**: C-1 정량 지표는 [03-maintainability.md](./03-maintainability.md) C-1 — 분할 설계는 본 파일 소유. M-3 도 본 파일 소유.
> **⚠️ spec 충돌 주의**: 엔진↔WebsocketService 의 forwardRef 는 `spec/5-system/4-execution-engine.md §4.4` 가 **명시적으로 의도한 설계**("`IExecutionEventEmitter` 같은 인터페이스를 도입하지 않는다", "forwardRef 는 회피해야 할 안티패턴이 아님") — 이벤트 포트 교체안은 spec 개정 선행 없이는 금지 (C-2 본문 참조).
> 옵션 비교·권장안 보강 (2026-06-10)

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
  - **옵션 비교**:
    | 옵션 | 장점 | 단점 / 트레이드오프 |
    | --- | --- | --- |
    | A. strangler-fig 단계별 분할 (위 1→5 순서) + 엔진 내부 전용 `EngineDriver` 신설 | PR #507(resume dispatch registry)과 동일하게 "spec 변경 불요" 로 착지한 선례의 연속. 각 단계가 독립 PR·독립 e2e 게이트로 검증돼 회귀 격리 용이. `EngineDriver` 는 엔진 내부 계약이라 §4.4 가 금지하는 외부 이벤트 sink 추상화와 무관하고, `WorkflowExecutor`(engine↔노드 계약) 의미 과적도 회피 | 전체 완료까지 다단계 PR — 과도기 동안 god-class 와 분리 서비스가 혼재. 신규 내부 인터페이스 1개 유지 비용 |
    | B. 한 번에 전부 분할 (빅뱅 단일 PR) | 최종 구조 즉시 도달, 혼재 기간 없음 | 9,210줄 대상 단일 PR — park/resume·retry·rehydration(§7.5) 회귀 위험이 한 점에 집중, e2e 실패 시 원인 격리 곤란. PR #507 선례와 달리 spec 비저촉 입증 단위가 커짐 |
    | C. 분리 서비스가 엔진 public 메서드를 직접 호출 (인터페이스 신설 없이) | 타입 신설 비용 0 — §4.4 의 "불필요한 추상화 도입 금지" 정신과 표면적으로 일치 | 분리 서비스↔엔진의 forwardRef 순환을 재생산해 분할 효과 반감. 엔진 표면이 암묵 계약화돼 이후 단계 분리가 더 어려워짐 |
    | D. 보류 | 비용 0 | Critical 등급 god-class 방치 — 생성자 의존 20개·메서드 ~70개가 계속 증식, [03-maintainability.md](./03-maintainability.md) C-1 정량 지표 악화 지속 |
  - **권장**: A — PR #507 이 같은 strangler-fig 경로로 spec 변경 없이 안전하게 착지한 직접 선례가 있고, 단계별 e2e 게이트(동일 게이트 재사용)로 회귀를 격리할 수 있다. 통신은 `EngineDriver` 신설이 옳다: §4.4 금지 대상은 외부 이벤트 sink 추상화이지 엔진 내부 분할 계약이 아니며, `WorkflowExecutor` 재사용은 spec 상 engine↔노드 계약을 과적시킨다(본문 spec 대조 참조).
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
  - **옵션 비교**:
    | 옵션 | 장점 | 단점 / 트레이드오프 |
    | --- | --- | --- |
    | A. 클러스터별 개별 처리 (엔진↔WS forwardRef 유지 + M-7 역전 + llm/chat-channel 공유 타입 shared 강하 — 위 1~5) | §4.4("별도 추상화를 도입하지 않는다", "forwardRef 는 안티패턴이 아님")·`15-chat-channel.md §R4`·`8-embedding-pipeline.md` 의 명시 결정 전부 준수 — spec 개정 불요. spec 무언급 클러스터(llm, chat-channel)만 단방향화해 실익 확보 | 엔진↔WS forwardRef 의 테스트 격리·DI 초기화 순서 고충은 잔존 (의도된 설계의 수용 비용) |
    | B. 엔진↔WS 도 이벤트 포트로 교체 (spec §4.4 Rationale 개정 발의 선행) | forwardRef 핵심 쌍까지 제거 — 테스트 격리 고충 근본 해소 | §4.4 명시 결정과 정면 충돌 — planner 의 spec 개정 + consistency-check --spec 통과 전 구현 금지. §4.4 단서(다중 sink 가시화 시 재검토)의 전제가 아직 미충족이라 발의 근거 약함 |
    | C. llm-config 를 llm 모듈로 흡수 (shared 강하 대신 모듈 병합) | 순환 자체가 소멸 — shared 레이어 추가 없음 | `data-flow/7-llm-usage.md` 의 participant 구도(별도 모듈)와 어긋나 다이어그램·spec 갱신 유발 — 타입 강하(A)가 spec 무변으로 같은 효과 |
    | D. 전면 보류 | 비용 0 | spec 비저촉으로 해소 가능한 클러스터(2~5번: gateway 역전·KB 단방향화·llm·chat-channel)의 개선분까지 포기 |
  - **권장**: A — 엔진↔WS 는 spec 이 명시적으로 의도한 설계(A 판정)라 유지가 유일한 spec 준수 경로이고, 잔존 고충은 사용자 보고로 가시화한다. spec 무언급 클러스터는 shared 타입 강하로 단방향화하면 `data-flow/7-llm-usage.md` participant 구도를 건드리지 않으면서(C 대비) forwardRef 를 실질 감축할 수 있다.
  - 검증: 부팅 스모크 + WS 구독·KB 임베딩 이벤트 e2e. / 회귀 위험: Nest DI 초기화 순서 변경 부팅 실패(컴파일로 안 잡힘). / spec 갱신: 1번 추진 시에만 §4.4 Rationale 개정 (planner, consistency-check --spec 의무).

- [ ] **C-3 AuthController 에 bcrypt 비밀번호 검증 (레이어 침범)** — `auth.controller.ts:55,328-335`
  - **spec 대조**: D — 행위(2FA 비활성화 시 비밀번호 재확인)는 `1-auth.md §1.2` spec 명시, 계층 배치는 무언급이나 `data-flow/2-auth.md §1.2` 의 시퀀스가 bcrypt.compare 를 일관되게 **Service** 에 배치 — controller 내 bcrypt 는 spec 의 데이터 흐름 모델과 불일치.
  - **개선 방안**: 1. `AuthService.verifyPasswordForUser(userId, plainPassword)` 신설 — `passwordHash` 부재/불일치 시 현 controller 와 동일한 에러 코드·메시지·401 을 서비스에서 throw. 2. `disable2fa` 의 bcrypt 블록 제거, controller 의 `import * as bcrypt`·`UsersService` 직접 의존 제거. 3. 다른 비밀번호 재확인 경로(세션 강제 종료 재인증 등)가 controller 에 있으면 같은 메서드로 통일.
  - **옵션 비교**:
    | 옵션 | 장점 | 단점 / 트레이드오프 |
    | --- | --- | --- |
    | A. `AuthService.verifyPasswordForUser` 로 이동 (개선 방안 1~3) | `data-flow/2-auth.md §1.2` 시퀀스가 bcrypt.compare 를 일관되게 Service 에 배치 — spec 데이터 흐름 모델과 정합. controller 의 bcrypt·`UsersService` 직접 의존 제거, 다른 비밀번호 재확인 경로와 단일 메서드로 통일 가능 | 에러 코드·메시지·401 shape 를 서비스 throw 로 정확히 보존해야 함 — 단 검증 표면이 좁아 위험 낮음 |
    | B. 보류 (controller 잔존) | 비용 0 — 동작 자체는 spec(`1-auth.md §1.2`) 준수 | spec 의 데이터 흐름 모델과 불일치 지속. 비밀번호 검증 로직이 controller 에 산재할 여지 — 추후 재확인 경로 추가 시 중복 재생산 |
  - **권장**: A — 행위는 이미 spec 준수이고 계층 배치만 `data-flow/2-auth.md` 모델과 어긋난 상태라, 에러 shape 보존만 지키면 사실상 무위험 정렬이다. 소규모(메서드 1개 신설 + 호출부 교체)라 단독 PR 부담도 없다.
  - 검증: auth unit + 2FA disable e2e (응답 코드·body 불변). / 회귀 위험: 낮음 — 에러 shape 보존. / spec 갱신: 불요.

## Major

- [ ] **M-1 AiAgentHandler 3,402줄 god-handler** — `nodes/ai/ai-agent/ai-agent.handler.ts`
  - **spec 대조**: D — `<type>.handler.ts` co-location 은 spec 규정이나 크기/보조 클래스 제한 없음. `AgentToolProvider` 분리는 spec(`11-mcp-client.md §1`)이 명시한 의도 패턴 — 같은 방향의 내부 분할은 비저촉. `processMultiTurnMessage` polymorphic 시그니처(information_extractor 와 공유, `4-execution-engine.md §1.3`)는 계약 — 보존 필수.
  - **개선 방안** (위험 낮은 순): 1. `AiConditionEvaluator` 먼저 (입출력 순수 — 추출 위험 최소). 2. `AiMemoryManager` (§12.9~12.14 Rationale 을 동작 보존 체크리스트로). 3. `AiTurnExecutor` (~1,050줄) — `processMultiTurnMessage` 시그니처는 핸들러에 남기고 내부 위임만. 4. 배치는 `nodes/ai/ai-agent/` 하위 (co-location 준수), `ai/shared/` 승격은 실공유 확인 후에만.
  - **옵션 비교**:
    | 옵션 | 장점 | 단점 / 트레이드오프 |
    | --- | --- | --- |
    | A. 위험 낮은 순 단계 추출 (Evaluator→Memory→TurnExecutor), `nodes/ai/ai-agent/` 하위 배치 | co-location 규정(`<type>.handler.ts` 디렉토리) 준수. `processMultiTurnMessage` polymorphic 계약(§1.3)은 핸들러에 잔류시켜 보존. `AgentToolProvider` 분리(spec `11-mcp-client.md §1` 명시 의도 패턴)와 같은 방향 — 단계별 회귀 격리 | 3단계 PR — TurnExecutor(~1,050줄) 도달까지 god-handler 부분 잔존 |
    | B. `ai/shared/` 로 즉시 승격 배치 (information_extractor 공유 선반영) | 공유가 실재한다면 이동 1회로 종결 | 실공유 미확인 상태의 추측성 일반화 — co-location 이탈. 공유 확인 후 승격(A 의 4번)으로 충분히 늦출 수 있음 |
    | C. 보류 | 비용 0 | 3,402줄 god-handler 지속 — [03-maintainability.md](./03-maintainability.md) C-2 메서드 분리도 연쇄 차단 |
  - **권장**: A — spec 이 이미 같은 방향의 내부 분할(`AgentToolProvider`)을 의도 패턴으로 명시했고, co-location 과 §1.3 계약 보존을 모두 만족하는 유일한 경로다. `ai/shared/` 승격은 실공유가 확인되는 시점으로 미루는 것이 안전하다.
  - 검증: handler spec 테스트 + 멀티턴 park/resume e2e + render_* e2e. / 회귀 위험: §7.4~7.9 출력 포트 shape·`_resumeCheckpoint` allow-list. / spec 갱신: 불요. (메서드 분리 상세: [03-maintainability.md](./03-maintainability.md) C-2)

- [ ] **M-2 IntegrationOAuthService 2,579줄 — 다중 OAuth 프로토콜 혼합** — `integrations/integration-oauth.service.ts`
  - **spec 대조**: B — data-flow 시퀀스의 participant 가 `IntegrationOauthService` 단일이지만 spec 이 내부 구조를 구현 재량으로 명시(`4-integration.md` Rationale "provider 별 분리인지 파라메트릭인지는 구현 세부 사항"). facade 명 유지 시 다이어그램 무변.
  - **개선 방안**: 1. `OAuthProviderStrategy`(`begin`/`exchangeCode`/`refreshToken`) + `integrations/oauth-providers/` 에 5개 strategy (google/github/cafe24-public/cafe24-private/makeshop). 2. state·preview 토큰 관리는 facade 잔류. 3. `process.env` 7곳은 M-6 과 같은 PR 로 설정 객체 이전. 4. 이전 순서: makeshop(자기완결) → cafe24 2변형(install_token 흐름 보존) → google/github.
  - **옵션 비교**:
    | 옵션 | 장점 | 단점 / 트레이드오프 |
    | --- | --- | --- |
    | A. provider 별 strategy 5개 분리 + facade 명 유지 | spec Rationale("provider 별 분리인지 파라메트릭인지는 구현 세부 사항")이 명시적으로 허용한 재량 — facade(`IntegrationOauthService`) 유지로 data-flow 다이어그램 무변. provider 별 회귀 격리 (cafe24 install_token·makeshop 흐름이 서로 영향 없음), 신규 provider = strategy 1개 추가 | 인터페이스 1개 + 파일 5개 신설, state·preview 토큰의 facade/strategy 경계 설계 필요 |
    | B. 파라메트릭 단일 서비스 (provider 차이를 설정 테이블로 수렴) | 파일 수 최소 — 표준 OAuth2 부분은 중복 제거 | cafe24 public/private 의 install_token 흐름·redirect URI 형식, makeshop 의 비표준 흐름 등 구조적 차이가 커 테이블로 수렴 불가 — 분기 복잡도가 단일 클래스 내부에 잔존 (현행 2,579줄의 원인 재생산) |
    | C. 보류 | 비용 0 | 다중 프로토콜 혼합 지속 — provider 추가·수정마다 2,579줄 파일에서 shotgun surgery |
  - **권장**: A — spec 이 내부 구조를 구현 재량으로 못박았으므로(B 판정) spec 갱신 없이 진행 가능하고, 제거하려는 복잡도의 본질이 "provider 간 흐름 차이" 라 파라메트릭(B)으로는 해소되지 않는다. facade 명 유지가 data-flow participant 와의 정합 비용을 0 으로 만든다.
  - 검증: provider 별 OAuth e2e(stub) + 만료 스캐너 unit + `status_reason` 매핑 불변. / 회귀 위험: cafe24 private install_token·redirect URI 형식. / spec 갱신: 불요 (facade 유지 시).

- [ ] **M-3 WorkflowAssistantStreamService — `streamMessage` 혼재** — `workflow-assistant-stream.service.ts`
  - **spec 대조**: B — `4-ai-assistant.md` 는 도구 정의(§4)·SSE(§5~6)·가드(§10)의 **행위 계약**만 규정, 내부 분해 무언급. §10 의 미세 의미(progress-aware finish 재발동·review 최대 2회·verify 턴당 1회·plan-only fast-path)가 회귀 포인트.
  - **개선 방안**: 1. `AssistantToolRouter` — 도구명→handler registry + kind(`explore`/`plan`/`edit`) 메타, 신규 도구 = registry 1행 (OCP). 2. `AssistantFinishGuard`/`AssistantReviewGuard` — §10 상태 필드(`reviewRoundCount` 등)를 가드 객체로 캡슐화, 분리 단위를 §10 Phase 경계와 일치. 3. `AssistantTurnPersistenceService` — 세션/메시지 영속 + `autoResumed` 메타. 4. `streamMessage` 는 SSE 조립·중단 처리만.
  - **옵션 비교**:
    | 옵션 | 장점 | 단점 / 트레이드오프 |
    | --- | --- | --- |
    | A. 3분해 전체 (ToolRouter + Guard 객체 + Persistence — 개선 방안 1~4) | 분리 단위가 spec §10 Phase 경계와 일치 — 가드 미세 의미(progress-aware finish 재발동·review 최대 2회·verify 턴당 1회)가 가드 객체 unit 테스트로 직접 커버됨. 신규 도구 = registry 1행 (OCP). spec 은 행위 계약만 규정(B 판정)이라 spec 무변 | 분해 폭이 커서 단일 PR 시 SSE 이벤트 순서 회귀 검증 부담 — 단계 분할(Router 먼저) 가능 |
    | B. `AssistantToolRouter` 만 우선, 가드는 `streamMessage` 잔류 | 최소 비용으로 도구 추가 OCP 확보 | §10 의 회귀 포인트(가드 발동 순서·횟수 한도·fast-path)가 혼재 코드에 잔존 — 본 항목이 지목한 핵심 위험이 미해소 |
    | C. 보류 | 비용 0 | 신규 도구·가드 규칙 추가마다 `streamMessage` 직접 수정 — §10 미세 의미 회귀 위험 누적 |
  - **권장**: A — 본 항목의 위험 중심이 §10 가드 의미이므로 가드 객체 캡슐화 없이는(B) 실익이 절반에 그친다. 분리 경계를 spec §10 Phase 와 일치시키면 spec 표 전체를 가드 unit 시나리오로 옮길 수 있어 검증이 오히려 쉬워진다. 필요 시 Router→Guard→Persistence 순 단계 PR 로 나눠도 무방.
  - 검증: SSE 이벤트 순서·`auto_resume` 분할 버블 e2e + finish 가드 시나리오 unit(§10 표 전부). / 회귀 위험: 가드 발동 순서·fast-path 비활성 조건. / spec 갱신: 불요.

- [ ] **M-4 blocking 인터랙션 문자열 리터럴 분기 잔존 — park-진입 측 dispatch 추출** — `execution-engine.service.ts:1577-1616,3709,3944-3948`
  - **spec 대조**: D — `interaction-type-registry.md` 가 이 분기들을 직접 통치: 문자열 분기 존재 자체는 규약이 인지·가드하는 상태(exhaustive switch 규칙), 단 규약 §4 Rationale 의 목적(shotgun surgery 차단)은 항목과 동일. **resume 측은 이미 registry 추출 완료(PR #507)** — 잔존 지점은 park-진입(waitForX 선택) 측.
  - **개선 방안**: 1. `ResumeTurnDispatch` 와 대칭인 `ParkEntryDispatch`(kind/selects/handle) 를 `resume-turn-dispatch.ts` 옆에 신설 — form/buttons/ai_conversation 3건 (`ai_form_render` 는 핸들러 emit 이라 비대상 — 매트릭스 §1.2 일치 확인). 2. retry-드라이브(1577-1616)·메인 루프(3700대) 두 중복 블록을 단일 `dispatchParkEntry(ctx)` 로 — `PARK_RELEASED` 조기반환 보존. 3. `NodeTypeMetadata` 신필드 불요 — `getMetadata().interaction` 이 이미 metadata 기반, registry 키로 그대로 사용. 4. `satisfies Record<WaitingInteractionType, …>` 로 exhaustive 보장 유지 (규약 규칙 2).
  - **옵션 비교**:
    | 옵션 | 장점 | 단점 / 트레이드오프 |
    | --- | --- | --- |
    | A. `ParkEntryDispatch` registry 추출 (resume 측 PR #507 과 대칭) | retry-드라이브·메인 루프 두 중복 블록이 단일 `dispatchParkEntry` 로 — exhaustive switch 가 못 잡는 "두 블록 간 불일치" 위험 제거. `interaction-type-registry.md §4` Rationale 의 목적(shotgun surgery 차단)과 동일 방향, resume 측과 구조 대칭으로 인지 비용 감소. `satisfies Record<WaitingInteractionType,…>` 로 규약 규칙 2(exhaustive 보장)도 그대로 유지 | spec 갱신 필요 — `interaction-type-registry.md §1.2` emit 위치 열 + `spec-sync-resume-dispatch-registry.md` 에 park-entry 레이어 추가 (planner 선행) |
    | B. exhaustive switch 현행 유지 | 규약이 이미 인지·가드하는 합법 상태 (규칙 2 + AST 가드) — 신규 type 누락은 컴파일·테스트가 차단. spec 갱신 불요, 비용 0 | 가드는 "누락" 만 잡고 "두 중복 블록의 동작 불일치" 는 못 잡음 — 신규 인터랙션 type 마다 retry-드라이브·메인 루프 2곳 동기 수정 의무 잔존 (규약 §4 가 차단하려는 shotgun surgery 그 자체) |
  - **권장**: A — 현행도 규약상 합법이지만(B), 규약 §4 의 목적 자체가 shotgun surgery 차단이고 resume 측이 이미 PR #507 로 같은 registry 패턴에 착지했으므로 park-진입 측만 비대칭으로 남길 이유가 없다. 단 spec 갱신(§1.2 emit 위치 열)이 선행 조건이므로 planner 의 `spec-sync-resume-dispatch-registry.md` 합류 후 착수한다.
  - 검증: park/resume e2e + dispatch unit(우선순위 form→buttons→ai 보존). / 회귀 위험: `withInteractionMeta` 의 interactionType meta 누락 시 frontend snapshot reconcile 파괴. / **spec 갱신: 필요** — `interaction-type-registry.md §1.2` emit 위치 열 + 진행 중 `spec-sync-resume-dispatch-registry.md` 에 park-entry 레이어 추가 (planner).

- [ ] **M-5 `ALL_NODE_COMPONENTS` 정적 배열** ⚠️ **(A — 의도된 설계, 경량안만 단독 진행 가능)** — `nodes/index.ts:39-75`
  - **spec 대조**: **A** — `4-nodes/0-overview.md §1.0` 이 "정적 배열로 부팅 시 부트스트랩, 런타임 플러그인 로딩 경로는 존재하지 않는다" 로 현행을 명시. 동적 발견은 `marketplace-and-plugin-sdk.md` plan 의 미래 축으로 별도 예약. **의도된 설계지만 merge-conflict hotspot 고충은 실재 — 사용자 보고 대상.**
  - **개선 방안**: 1. (spec 무변 경량안) 카테고리별 배열(`AI_COMPONENTS`·`LOGIC_COMPONENTS`…)의 spread 합성으로 재구성 — 부팅 모델 불변, conflict 표면 분산, "정적 배열" 서술과 양립. 2. DI token/multi-provider 전환은 **마켓플레이스 plugin SDK plan 과 한 묶음으로만** (spec §1.0 개정 + consistency-check --spec 선행). 3. m-3 의 bootstrap 위치 이동은 본 항목과 독립 — 먼저 처리 가능.
  - **옵션 비교**:
    | 옵션 | 장점 | 단점 / 트레이드오프 |
    | --- | --- | --- |
    | A. 카테고리별 배열 spread 합성 (경량안) | §1.0 의 "정적 배열로 부팅 시 부트스트랩" 서술과 양립 — spec 무변·단독 진행 가능. 노드 추가 시 conflict 표면이 카테고리 파일로 분산돼 hotspot 고충 완화. 부팅 모델·배열 순서 불변이라 회귀 위험 최소 | 근본 구조는 동일 — 정적 합성일 뿐이라 모듈 경계 분리는 아님 |
    | B. DI token/multi-provider 전환 (모듈별 등록) | conflict 근본 해소 + 마켓플레이스 동적 로딩(`marketplace-and-plugin-sdk.md` plan)의 자연스러운 전 단계 | spec §1.0 "런타임 플러그인 로딩 경로는 존재하지 않는다" 명시(A 판정)와 충돌 — plugin SDK plan 과 한 묶음으로 spec §1.0 개정 + consistency-check --spec 선행 없이는 금지 |
    | C. 현상 유지 | A 판정 — 의도된 설계의 그대로 수용, 비용 0 | merge-conflict hotspot 고충은 실재 (본 항목이 사용자 보고 대상인 이유) — 노드 추가 빈도만큼 누적 |
  - **권장**: A — spec 이 현행을 명시한 A 판정 항목이므로 B 는 마켓플레이스 plan 착수 전까지 선택지가 아니고, C 는 실재하는 conflict 고충을 방치한다. spread 합성은 "정적 배열" 서술과 양립하면서 고충만 덜어내는 유일한 spec 무변 경로다. B 는 plugin SDK plan 합류 시점에 재평가한다.
  - 검증: 부팅 시 25 핸들러 등록 수 단언 + `GET /api/nodes/definitions` 스냅샷. / 회귀 위험: 배열 순서 의존 보존. / spec 갱신: 1안 불요, 2안 필수.

- [ ] **M-6 서비스 계층 `process.env` 직접 접근 32곳** — 대표: `integration-oauth.service.ts`, `mcp-client.service.ts`, `interaction-token.service.ts`, `llm.service.ts:78`
  - **spec 대조**: D — ConfigService 패턴이 spec 에 모델링된 영역 존재(`4-file-storage.md §2.3` "ConfigService 키: s3.*"), 단 **spec 이 직접 접근을 원문 명시한 곳도 있음**(`7-llm-client.md` "`process.env.LLM_STUB_MODE === 'true'`"). 전역 config 규약 문서는 부재.
  - **개선 방안**: 1. `common/config/` 에 `registerAs` namespace (`oauth`/`mcp`/`interactionToken`/`llm`) — 기존 `s3.*`·`jwt.secret` 패턴과 동일. 2. 이전 순서: integration-oauth 7곳(M-2 와 동일 PR) → mcp → interaction-token → llm. 3. Nest 밖 스크립트(BullMQ 운영 스크립트의 REDIS_*)는 면제 명시. 4. (선택) backend config 규약 신설 발의 — planner.
  - **옵션 비교**:
    | 옵션 | 장점 | 단점 / 트레이드오프 |
    | --- | --- | --- |
    | A. `registerAs` namespace 점진 이전 (모듈별 순서, M-2 와 PR 공유) | spec 이 이미 모델링한 패턴(`4-file-storage.md §2.3` "ConfigService 키: s3.*")의 선례 확장 — 전역 규약 신설 없이 진행 가능. 모듈 단위 회귀 격리, `.env.example` 대조 테스트로 키 카탈로그 확보 | `7-llm-client.md` 가 `process.env.LLM_STUB_MODE` 를 원문 명시 — llm 이전 시 spec 동기화(planner) 필요. 완료까지 두 패턴 혼재 |
    | B. 32곳 일괄 이전 (단일 PR) | 혼재 기간 없음 | 워커 분리 프로세스의 ConfigModule 로드 전 읽기 등 초기화 시점 회귀가 한 PR 에 집중 — 부팅 실패는 컴파일로 안 잡혀 격리 곤란. spec 원문 명시 지점(LLM_STUB_MODE)까지 한 번에 건드림 |
    | C. 보류 | 비용 0 | 환경 키 카탈로그 부재 지속 — 테스트 stub·환경별 검증 곤란, 신규 키마다 직접 접근 재생산 |
  - **권장**: A — `s3.*`·`jwt.secret` 선례가 있어 규약 신설 없이도 방향이 확정적이고, 초기화 시점 회귀(워커 프로세스)가 항목별로 달라 모듈 단위 점진이 안전하다. spec 이 직접 접근을 원문 명시한 llm 은 마지막 순서로 두고 planner 동기화와 묶는다.
  - 검증: `.env.example` ↔ namespace 키 전수 대조 테스트 + 부팅 스모크. / 회귀 위험: ConfigModule 로드 전 초기화 시점 읽기(워커 분리 프로세스). / **spec 갱신**: `7-llm-client.md` 의 `process.env.LLM_STUB_MODE` 원문은 이전 시 동기화 (planner).

- [ ] **M-7 WebsocketGateway — 4개 서비스 forwardRef 직접 의존** — `websocket.gateway.ts:89-98`
  - **spec 대조**: D — 구독 시 소유권 검증은 `6-websocket-protocol.md §3` 의 spec 의무, 주입 메커니즘은 무언급. §4.4 단일 sink 정책과 비저촉(역방향 의존 제거일 뿐). gateway 에 이미 `channelAuthorizers` 내부 배열 존재 — 인터페이스화의 절반은 완료 상태.
  - **개선 방안**: 1. `CHANNEL_AUTHORIZER` multi-provider token + `ChannelAuthorizer { matches; authorize }` 인터페이스를 WS 모듈에 정의. 2. executions/background-runs/KB/engine 각 모듈이 자기 authorizer 를 provider 등록 (도메인 모듈 → WS 단방향). 3. gateway 는 token 배열만 주입 — forwardRef 4개 + 모듈 import 제거. 4. C-2 의 forwardRef 감소 효과를 같은 PR 에서 측정·기록.
  - **옵션 비교**:
    | 옵션 | 장점 | 단점 / 트레이드오프 |
    | --- | --- | --- |
    | A. `CHANNEL_AUTHORIZER` multi-provider token 역전 | §4.4 단일 sink 정책과 비저촉 — 금지된 이벤트 발행 추상화가 아니라 역방향(gateway→도메인) 의존 제거. gateway 에 `channelAuthorizers` 내부 배열이 이미 존재해 인터페이스화의 절반은 완료 상태. 신규 채널 = 해당 모듈의 provider 1개 등록 (gateway 무수정, OCP). C-2 의 2·3번 해소 수단 겸용 | authorizer 등록 순서·미매칭 채널 기본 거부 등 인증 동작 보존 검증 필요 — 구독 검증은 `6-websocket-protocol.md §3` 의 spec 의무라 회귀 시 영향 큼 |
    | B. 현행 forwardRef 4개 유지 | 비용 0 — forwardRef 자체는 Nest 표준 패턴 (§4.4 도 안티패턴 아님을 명시) | §4.4 가 옹호하는 것은 엔진→WS 의 sink 방향이지 gateway→도메인 4개 역참조가 아님. 신규 구독 채널마다 gateway 수정 + forwardRef 추가 — C-2 순환의 반대 변이 계속 증식 |
  - **권장**: A — 주입 메커니즘은 spec 무언급(D 판정)이고 단일 sink 정책과도 무관하므로 spec 갱신 없이 진행 가능하다. 내부 배열이 이미 존재해 변경 폭이 작고, C-2 클러스터(gateway 변·KB gateway 의존)의 해소 수단을 겸하므로 투자 대비 효과가 가장 크다. 구독 실패 ack 계약(spec §3 원문) 보존만 e2e 로 고정하면 된다.
  - 검증: 구독 실패 ack 계약 보존(`subscribed` ack 에 `success:false` + 평문 error — spec §3 원문) + WS e2e. / 회귀 위험: authorizer 등록 순서·미매칭 채널 기본 거부. / spec 갱신: 불요.

- [ ] **M-8 `trigger-detail-drawer.tsx` 1,604줄 god-component + API 직접 호출 8곳**
  - **spec 대조**: B — `2-trigger-list.md` 는 행위·필드 권한 매트릭스만 규정. spec §2.3.1 의 카드 단위 매트릭스가 분리의 자연 경계를 이미 제공.
  - **개선 방안**: 1. `lib/api/triggers.ts` 신설 — §3 API 표 + rotate-bot-token 의 typed wrapper (`lib/api/executions.ts` 패턴). 2. §2.3.1 카드 경계대로 분리: `TriggerOverviewCard`/`WebhookConfigCard`/`AuthConfigCard`/`ChatChannelCard`/`EiaNotificationCard`/`ScheduleCard` + 공용 `useCardEditToggle`. 3. fetch/mutation 은 `useTrigger(id)` custom hook. 4. m-2 의 `triggers/page.tsx` 와 같은 PR.
  - **옵션 비교**:
    | 옵션 | 장점 | 단점 / 트레이드오프 |
    | --- | --- | --- |
    | A. API 레이어 + §2.3.1 카드 경계 분리 전체 (개선 방안 1~4) | 분리 경계를 spec §2.3.1 카드 단위 권한 매트릭스가 이미 제공 — 자의적 분할 아님, 카드별 e2e 가 spec 매트릭스와 1:1. `lib/api/triggers.ts` 는 기존 `lib/api/executions.ts` 관례 답습 + m-2 선행 요건 충족 | 6개 카드 + hook 동시 분리 — 카드별 PATCH 단일 경로(R-4)·권한 매트릭스 회귀 검증 폭이 큼 |
    | B. `lib/api/triggers.ts` 만 우선 (컴포넌트 분리는 후속 PR) | 최소 비용으로 API 직접 호출 8곳 제거 + m-2 차단 해제 | 1,604줄 god-component 잔존 — 권한 매트릭스·read-only 배지 회귀 표면 그대로 |
    | C. 보류 | 비용 0 | API 호출 산재로 m-2 의 `triggers/page.tsx` 이전도 차단 — frontend api 계층 정리 전체가 지연 |
  - **권장**: A — spec 이 카드 경계라는 자연 분할선을 이미 규정하고 있어 분리의 설계 비용이 낮고, B 로 쪼개면 PR 2회에 걸쳐 같은 파일을 재방문하게 된다. 검증 부담은 카드 단위 e2e(R-16/R-14/rotate 차단)가 spec 매트릭스와 1:1 대응이라 오히려 체계적이다.
  - 검증: 드로어 e2e (R-16 read-only 배지, R-14 AuthConfig 셀렉터, rotate 차단 400). / 회귀 위험: 카드별 PATCH 단일 경로(R-4)·권한 매트릭스. / spec 갱신: 불요.

- [ ] **M-9 `extractRetryAfterMs` 유틸이 `llm.service.ts` 에 위치** — `llm.service.ts:407`
  - **spec 대조**: B — `node-output.md §3.2.1` 은 `retryAfterSec` 의미·invariant 만 규정, 물리 위치 무언급. **선례 존재**: 같은 사유로 `sanitizeLastErrorMessage` 가 이미 `shared/utils/` 이동 완료.
  - **개선 방안**: 1. `shared/utils/retry-after.ts` 신설 + 해당 unit test describe 분리 이동. 2. import 4곳 교체. 3. llm.service 에 re-export 두지 않음 (재발 차단 목적).
  - **옵션 비교**:
    | 옵션 | 장점 | 단점 / 트레이드오프 |
    | --- | --- | --- |
    | A. `shared/utils/retry-after.ts` 이동 (re-export 없이) | `sanitizeLastErrorMessage` 가 같은 사유로 이미 `shared/utils/` 이동 완료 — 선례와 일관. 물리 위치는 spec 무언급(B 판정)이라 spec 무변. re-export 미제공으로 llm.service 경유 import 재발 차단, 누락은 컴파일 에러로 즉시 검출 | import 4곳 일괄 교체 필요 — 사실상 기계적 작업 |
    | B. 현행 유지 | 비용 0 | retry-after 만 필요한 소비자가 llm 모듈을 import 지속 — `sanitizeLastErrorMessage` 선례와 비일관, 동종 유틸의 위치 규칙이 이원화 |
  - **권장**: A — 동일 사유의 선례(`sanitizeLastErrorMessage`)가 이미 착지해 있어 일관성 측면에서 사실상 결정된 방향이고, 회귀 위험이 "사실상 없음" 수준이라 보류(B)의 비용 절감 효과가 없다.
  - 검증: unit + build. / 회귀 위험: 사실상 없음. / spec 갱신: 불요.

## Minor

- [ ] **m-1 `IntegrationsController.previewTest` — registry 검증을 controller 가 수행** — `integrations.controller.ts:65,175`
  - **spec 대조**: B — preview-test 행위만 spec 규정. **부수 발견**: 에러 코드 `INTEGRATION_INVALID_SERVICE` 가 `error-codes.md` 미등재.
  - **개선 방안**: 1. `IntegrationsService.validateServiceAuthType()` 신설 — 동일 `BadRequestException` 보존. 2. 사용처 교체 + controller 의 `findVariant` import 제거. 3. (부수) `INTEGRATION_INVALID_SERVICE` 의 error-codes.md 등재를 planner 에 확인 요청.
  - **옵션 비교**:
    | 옵션 | 장점 | 단점 / 트레이드오프 |
    | --- | --- | --- |
    | A. `IntegrationsService.validateServiceAuthType()` 로 이전 | C-3 과 동일 방향의 레이어 정렬 — controller 의 도메인 registry(`findVariant`) 직접 의존 제거. 에러 shape(400 코드·메시지) 보존으로 위험 낮음, 소규모라 단독 처리 부담 없음 | 부수 발견(`INTEGRATION_INVALID_SERVICE` error-codes.md 미등재)은 planner 확인이 별도 필요 — 코드 이전과 독립 트랙 |
    | B. 보류 | Minor 등급 — 단독 실익 작음, 비용 0 | controller 의 도메인 검증 침범 패턴 잔존 — C-3 정렬 후에도 같은 패턴이 남아 비일관 |
  - **권장**: A — C-3 과 같은 레이어 침범 패턴이라 함께 정렬해야 코드베이스 규칙이 일관되고, 에러 shape 보존만 지키면 무위험에 가깝다. 에러 코드 등재 확인(planner)은 병행 트랙으로 분리해 코드 이전을 막지 않는다.
  - 검증: preview-test unit(400 코드·메시지 불변). / 회귀 위험: 낮음. / spec 갱신: 에러 코드 등재 검토 (planner).

- [ ] **m-2 frontend 다수 페이지의 apiClient 직접 호출** — statistics/triggers/schedules/dashboard 페이지
  - **spec 대조**: B — frontend api 계층 규약 부재, 기존 `lib/api/*` 는 코드베이스 관례.
  - **개선 방안**: 1. `lib/api/triggers.ts`(M-8 에서 생성) → `triggers/page.tsx` 이전. 2. `lib/api/statistics.ts`/`schedules.ts`/`dashboard.ts` 신설 — 각 spec 의 API 표를 함수 카탈로그 SoT 로. 3. 페이지별 1 PR 점진 이전. 4. (선택) ESLint 로 `app/**/page.tsx` 의 apiClient 직접 import 금지.
  - **옵션 비교**:
    | 옵션 | 장점 | 단점 / 트레이드오프 |
    | --- | --- | --- |
    | A. 페이지별 점진 이전 (M-8 산출물 재사용, ESLint 는 완료 후 후속) | 기존 `lib/api/*` 코드베이스 관례 답습 — 규약 신설 불요. 각 spec 의 API 표를 함수 카탈로그 SoT 로 활용, 페이지별 PR 로 에러 처리·query param 직렬화 미세 차이 회귀 격리 | 이전 완료까지 직접 호출·wrapper 두 패턴 혼재 — 신규 페이지가 구패턴 복제할 여지 |
    | B. A + ESLint 금지 규칙 즉시 도입 | 신규 직접 호출 재발을 기계적으로 차단 | 미이전 페이지 전부에 일괄 예외(disable) 필요 — 이전 완료 전 도입 시 noise 가 신호를 가림 |
    | C. 보류 | 비용 0 | API 호출 형태가 페이지마다 발산 지속 — Minor 지만 M-8 과 같은 god-component 화의 재료 |
  - **권장**: A — frontend api 계층은 spec 규약이 아닌 코드베이스 관례(B 판정)라 점진 이전이 비용·위험 균형상 적절하다. ESLint 강제(B)는 전 페이지 이전이 끝난 시점에 재발 방지 장치로 추가하는 것이 noise 없이 효과적이다.
  - 검증: 페이지별 e2e/스냅샷. / 회귀 위험: 에러 처리·query param 직렬화 미세 차이. / spec 갱신: 불요.

- [ ] **m-3 엔진 내 `ALL_NODE_COMPONENTS` 직접 bootstrap — nodes 레이어 의존 역전** — `execution-engine.service.ts:55,2718-2720`
  - **spec 대조**: D — bootstrap 주체(`NodeComponentRegistry`)는 spec 명시, **호출 위치는 무언급** — 이동은 구현 재량. 난점은 `handlerDeps.build(this)` 가 엔진 자신(WorkflowExecutor 역)을 요구하는 것 — spec 이 이미 정의한 `WorkflowExecutor` 계약을 DI token 화하면 자연 해소 (C-1 의 내부 통신과 달리 **여기는 그 계약의 정확한 용처**).
  - **개선 방안**: 1. `WORKFLOW_EXECUTOR` token — 엔진 모듈이 `useExisting: ExecutionEngineService` 바인딩. 2. nodes 모듈에 `NodeBootstrapService`(`OnModuleInit`) — bootstrap 호출 이관, deps 는 token 주입. 3. 엔진의 import(:55)·`registerHandlers()`(:2718) 제거 → `nodes.module.ts:12` forwardRef 해소 확인. 4. C-1 로드맵 중 **최우선 실행** (M-5 배열 형태 변경과는 분리 — 본 건은 spec 무변).
  - **옵션 비교**:
    | 옵션 | 장점 | 단점 / 트레이드오프 |
    | --- | --- | --- |
    | A. `WORKFLOW_EXECUTOR` token + `NodeBootstrapService` 즉시 단독 진행 | spec 이 이미 정의한 `WorkflowExecutor`(engine↔노드) 계약의 **정확한 용처**에 token 화 — C-1 의 내부 통신 재사용(과적)과 달리 계약 의미 그대로. bootstrap 호출 위치는 spec 무언급(구현 재량)이라 spec 무변. `nodes.module.ts` forwardRef 해소 + C-1 1단계 선행 완료 | OnModuleInit 시점이 dispatch 보다 늦는 race 가능 — 순서 단언 테스트로 고정 필요 |
    | B. C-1 전체 분할 작업에 합류해 일괄 처리 | PR 수 절약 | 독립적·소규모 항목을 Critical 대형 작업에 묶어 착수가 지연됨 — C-1 로드맵 자체가 본 건을 "가장 먼저" 로 명시해 묶을 실익 없음 |
    | C. 보류 | 비용 0 | nodes→engine 의존 역전 미해소 — 엔진이 nodes 레이어를 직접 import 하는 레이어 위반 지속, C-1 착수의 선행 정리도 미뤄짐 |
  - **권장**: A — `WorkflowExecutor` 는 spec 이 engine↔노드 계약으로 정의한 인터페이스라 여기서의 DI token 화는 계약 의미를 정확히 따르는 사용이고(C-1 의 내부 통신 건과 구별), spec 무변·소규모·독립이라 즉시 착수 조건이 모두 충족된다. race 위험은 OnModuleInit 순서 단언 테스트 1개로 봉인 가능하다.
  - 검증: 부팅 시 핸들러 25종 등록 unit + e2e 스모크. / 회귀 위험: bootstrap 시점이 dispatch 보다 늦는 race — OnModuleInit 순서 단언 테스트. / spec 갱신: 불요.
