# Refactor 백로그 — 아키텍처·확장성 (2026-06-10 전수 감사)

> 인덱스: [README.md](./README.md). Critical 3 / Major 9 / Minor 3 — **spec 대조(2026-06-10) 후 전 항목 유효하나 C-2 의 핵심 처방 1건이 spec 명시 결정과 충돌해 수정됨**.
> **spec 대조 판정 분포**: A 1 (M-5) / B 6 / C 0 / D 8 / E 0.
> **중복 참조**: C-1 정량 지표는 [03-maintainability.md](./03-maintainability.md) C-1 — 분할 설계는 본 파일 소유. M-3 도 본 파일 소유.
> **⚠️ spec 충돌 주의**: 엔진↔WebsocketService 의 forwardRef 는 `spec/5-system/4-execution-engine.md §4.4` 가 **명시적으로 의도한 설계**("`IExecutionEventEmitter` 같은 인터페이스를 도입하지 않는다", "forwardRef 는 회피해야 할 안티패턴이 아님") — 이벤트 포트 교체안은 spec 개정 선행 없이는 금지 (C-2 본문 참조).
> 옵션 비교·권장안 보강 (2026-06-10)

## Critical

### C-1 [Critical] ExecutionEngineService — 9,210줄 god-class (SRP 전면 위반)

- [x] 코드 분할 5단계 완료 (PR #622·#625·#626·#627, **9,670→7,035줄**) — `backend/src/modules/execution-engine/execution-engine.service.ts`. **stacked PR 로드맵·진행 상황: [c1-engine-split.md](./c1-engine-split.md)** (review-파생 후속 백로그는 거기 `## 후속 고려`). 4 PR 전체 머지(origin/main `0c275dd7`) + 체인 종료 spec-sync(planner, [spec-update-engine-split.md](../../complete/spec-update-engine-split.md), `/consistency-check --spec` BLOCK:NO) 완료.

단일 클래스가 8개 이상 책임: 그래프 순회, 노드 dispatch(`executeNode` 412줄), AI 멀티턴 생명주기, form/button 인터랙션, retry-last-turn, 상태 머신, 핸들러 등록 bootstrap. 생성자 의존성 20개, 메서드 ~70개.

**spec 대조**: D — `4-nodes/0-overview.md §1.0` 은 모듈 책임("오케스트레이션만")을 규정할 뿐 클래스 분할은 무언급. 같은 방향의 선행 분리(`resume-turn-dispatch.ts` registry, PR #507)가 "spec 변경 불요" 로 이미 착지 — strangler-fig 연속이 정당. 단 **원안의 "분리 서비스는 `WorkflowExecutor` 인터페이스 경유" 는 재고**: 그 인터페이스는 spec 상 engine↔**노드** 계약이라 엔진 내부 통신에 재사용하면 계약 의미가 과적됨.

**개선 방안** (분리 순서·통신 방식 확정):

- [x] 1. `NodeBootstrapService` — m-3 과 함께 **가장 먼저** (독립적·소규모, 아래 m-3 참조). ✅ PR1 완료 (`claude/engine-split-s1-nodebootstrap`).
- [x] 2. `AiTurnOrchestrator` (waitForAiConversation / processAiResumeTurn / handleAiMessageTurn / finalizeAiNode 등 ~1,250줄) — 기존 `ResumeTurnDispatch` registry 의 `handleAiResumeTurn` 진입점을 신규 서비스로 위임. ✅ PR2 #625 (+ `EngineDriver` 신설, = step5 통신 계약 선반영).
- [x] 3. `FormInteractionService` / `ButtonInteractionService` — `waitForX`/`processXResumeTurn` 쌍 이동, registry 등록부만 엔진 잔류. ✅ PR3 #626 (EngineDriver 재사용, 신규멤버 0).
- [x] 4. `RetryTurnService` (applyRetryLastTurn / resumeGraphAfterRetry / completeRetryExecution / failRetryExecution) — `_retryState`/`_resumeCheckpoint` spec §1.3 allow-list 불변. ✅ PR4 (`buildRetryReentryState` 는 EngineDriver 멤버라 엔진 잔류; EngineDriver +5 그래프 멤버 확장).
- [x] 5. 통신 인터페이스는 `WorkflowExecutor` 재사용 대신 **엔진 내부 전용 `EngineDriver`**(또는 `ResumeTurnContext` 확장) 신설. 분리 서비스의 이벤트 발행은 **`WebsocketService`/`ExecutionEventEmitter` 직접 주입 유지** (spec §4.4 — `IExecutionEventEmitter` 도입 금지). ✅ PR2 #625 에서 `EngineDriver`(token `ENGINE_DRIVER`, useExisting) 신설, PR3·4 재사용.

**옵션 비교**:

| 옵션 | 장점 | 단점 / 트레이드오프 |
| --- | --- | --- |
| A. strangler-fig 단계별 분할 (위 1→5 순서) + 엔진 내부 전용 `EngineDriver` 신설 | PR #507(resume dispatch registry)과 동일하게 "spec 변경 불요" 로 착지한 선례의 연속. 각 단계가 독립 PR·독립 e2e 게이트로 검증돼 회귀 격리 용이. `EngineDriver` 는 엔진 내부 계약이라 §4.4 가 금지하는 외부 이벤트 sink 추상화와 무관하고, `WorkflowExecutor`(engine↔노드 계약) 의미 과적도 회피 | 전체 완료까지 다단계 PR — 과도기 동안 god-class 와 분리 서비스가 혼재. 신규 내부 인터페이스 1개 유지 비용 |
| B. 한 번에 전부 분할 (빅뱅 단일 PR) | 최종 구조 즉시 도달, 혼재 기간 없음 | 9,210줄 대상 단일 PR — park/resume·retry·rehydration(§7.5) 회귀 위험이 한 점에 집중, e2e 실패 시 원인 격리 곤란. PR #507 선례와 달리 spec 비저촉 입증 단위가 커짐 |
| C. 분리 서비스가 엔진 public 메서드를 직접 호출 (인터페이스 신설 없이) | 타입 신설 비용 0 — §4.4 의 "불필요한 추상화 도입 금지" 정신과 표면적으로 일치 | 분리 서비스↔엔진의 forwardRef 순환을 재생산해 분할 효과 반감. 엔진 표면이 암묵 계약화돼 이후 단계 분리가 더 어려워짐 |
| D. 보류 | 비용 0 | Critical 등급 god-class 방치 — 생성자 의존 20개·메서드 ~70개가 계속 증식, [03-maintainability.md](./03-maintainability.md) C-1 정량 지표 악화 지속 |

**권장**: A — PR #507 이 같은 strangler-fig 경로로 spec 변경 없이 안전하게 착지한 직접 선례가 있고, 단계별 e2e 게이트(동일 게이트 재사용)로 회귀를 격리할 수 있다. 통신은 `EngineDriver` 신설이 옳다: §4.4 금지 대상은 외부 이벤트 sink 추상화이지 엔진 내부 분할 계약이 아니며, `WorkflowExecutor` 재사용은 spec 상 engine↔노드 계약을 과적시킨다(본문 spec 대조 참조).

- **검증**: `execution-park-resume.e2e-spec.ts` 포함 e2e 전체 + unit 전량 (PR #507 과 동일 게이트).
- **회귀 위험**: park=세그먼트 종료 의미(`PARK_RELEASED`), §7.5 rehydration 단일 경로, `RESUME_*` 코드 보존.
- **spec 갱신**: `interaction-type-registry.md §1.1` 이 `WaitingInteractionType` 단일 진실 위치를 본 파일로 못박음 — 타입 이동 시 표+frontmatter `code:` 갱신 (planner, 기존 `spec-sync-resume-dispatch-registry.md` 에 합류 가능).

### C-2 [Critical] forwardRef 양방향 순환 의존 클러스터 — 클러스터별 개별 처리로 재정의 ⚠️

- [~] 진행 중 — 클러스터 5(chat-channel↔triggers) **완료**; 1 무조치(spec 준수 유지)·2·3 M-7(#663) 해소 확인; **4(llm↔model-config) 완료 — Option a′(엔드포인트 재배치 + 옵저버 역전), 구현·테스트(e2e 214)·리뷰·spec-sync 전부 완료, PR 대기 (branch `claude/refactor-02-c2-llm-modelconfig-93cae7`)**.

**spec 대조**: D — 단 **핵심 쌍(엔진↔WS)은 A**: `4-execution-engine.md §4.4` "sink 는 `WebsocketService` 가 canonical … 별도 추상화를 도입하지 않는다", "forwardRef … 회피해야 할 안티패턴이 아님", EIA·chat-channel 추가 후에도 재확인(`15-chat-channel.md §R4` "EventEmitter 교체는 본 결정 범위 밖"). KB→WS 직접 의존도 spec 명시(`8-embedding-pipeline.md` "`WebsocketService.emitKbEvent` 가 권위 정의"). 반면 `llm↔llm-config`, `chat-channel↔triggers` 는 spec 무언급.

**판단**: 원안의 "`ExecutionEventEmitter` 류 이벤트 포트로 교체" 는 **엔진↔WS 쌍에 한해 spec Rationale 과 정면 충돌 — 폐기**. 나머지는 개별 타당. **의도된 설계지만 여전히 고충(테스트 격리·초기화 순서)이 있는 항목 — 사용자 보고 대상.**

**개선 방안** (클러스터별):

- [x] 1. **엔진↔WS**: 현행 forwardRef 유지가 spec 준수(무조치). 다중 sink 가 실제 가시화될 때 §4.4 단서로 planner 에 spec 개정 발의 — 그 전 구현 금지.
- [x] 2. **WS gateway → 4개 서비스**: **M-7(#663) authorizer 역전으로 해소 확인** — gateway 잔존 forwardRef 는 inbound command(continueX/retry/snapshot, spec 의도)뿐. 무조치.
- [x] 3. **KB cluster**: emit(KB→WS) spec 준수 유지 + gateway→KB 는 M-7 해소 확인. 무조치.
- [x] 4. **llm ↔ model-config** — **완료 (Option a′: 엔드포인트 재배치, 사용자 결정 2026-06-26; PR #714 `000d8963` 머지 완료)**. plan 원안의 "공유 타입 shared 강하" 전제는 부족했고(실제 순환은 서비스/컨트롤러 레벨), 대안 2개(3 엔드포인트 이전 vs 인터페이스 역전) 중 **엔드포인트 재배치**로 확정. 코드 실측: back-edge(model-config→llm)는 plan 이 적은 3곳이 아니라 **5곳** — ① `preview-models`(`LlmPreviewService`)·② `:id/test`·③ `:id/models`(`LlmService`) 3 엔드포인트 + ④ `update`·⑤ `remove` 의 `llmService.clearClientCache(id)` 캐시 무효화. **인터페이스 역전(M-7 식)은 부적합**: 여기 forwardRef 는 모듈-레벨(생성자-레벨 아님)이라 토큰만으로는 모듈 순환이 안 끊긴다(소비 모듈이 제공 모듈을 여전히 import). **처방**: (1) 3 엔드포인트를 llm 모듈 신규 `LlmModelConfigController`(`@Controller('model-configs')` 라우트 프리픽스 유지 → 공개 API 무변)로 verbatim 이전, (2) clearClientCache back-edge 는 **observer 등록**으로 역전 — `ModelConfigService` 가 generic `onConfigInvalidated` 리스너 훅을 노출(`update`/`remove` 내부에서 notify), `LlmService.onModuleInit` 가 `clearClientCache` 를 등록(EventEmitter2 가 코드베이스 미사용이라 신규 프레임워크 도입 회피). 결과: model-config→llm 의존 0 → 양 모듈 forwardRef 제거, 단방향(llm→model-config)화. behavior-preserving(라우트·응답·캐시 무효화 시점 불변). **planner spec-sync ✅ 완료 (2026-06-27, 본 PR 동행, impl-done `review/consistency/2026/06/26/10_36_49/` BLOCK:NO 가 처방한 W1/W2/W3 반영)**: ① `2-navigation/6-config.md` frontmatter `code:` 에 신규 `llm-model-config.controller.ts` 등재, ② `data-flow/7-llm-usage.md` L50 컨트롤러 파일명(부속 엔드포인트=`llm-model-config.controller.ts`, CRUD=`model-config.controller.ts` 잔류) + L54 캐시 무효화 서술(`ModelConfigService.notifyInvalidated` 옵저버 → `LlmService.clearClientCache`) 현행화, ③ `5-system/7-llm-client.md` §8 Rationale(L443·L476) forwardRef 백로그(`unified-model-management §7 W4`)를 "C-2 cluster 4 해소(엔드포인트 재배치 + observer 역전, 양측 forwardRef 제거)"로 갱신 + `plan/complete/unified-model-management.md` W3/W4 백로그 해소 마킹. (그 외 impl-prep INFO 3~5 는 본 변경 무관 기존 드리프트 — 별건.) **검증**: lint ✅ · unit ✅(backend 377 suites·7423 pass — observer/onModuleInit/throw-isolation 신규 spec 포함) · build ✅(docker 포함) · **e2e ✅ 214 pass**(2026-06-27 재실행 — docker 레지스트리 회복; DI 부팅 스모크 포함 = forwardRef 제거 후 Nest DI 정상 부팅 확인. 직전 3회 실패는 docker.io registry flyway base metadata DeadlineExceeded 환경 이슈, 코드 무관 확정). **리뷰**: ai-review `review/code/2026/06/26/10_05_19/`(Critical 0/Warning 10 → 코드 fix W5·W7·W9·W10·I16 + swagger W3·W4, 나머지 SPEC-DRIFT planner/pre-existing[W4 test·list @Roles=verbatim 인가동작]·deliberate[W6 split-controller] defer, RESOLUTION). impl-done `review/consistency/2026/06/26/10_36_49/` **BLOCK:NO**(잔여 WARNING 3 = spec 문서 stale, 전부 planner 후속 트랙). 커밋: `2bee0da5`(구현)·`272a6764`(review-fix)·`c92f4e35`(swagger). **최종 재리뷰**(full range, push 가드 재무장 해소): ai-review `review/code/2026/06/27/10_28_11/` Risk LOW·Critical 0·**Warning 1**(`testConnection` `@Roles` 누락=pre-existing verbatim, RESOLUTION 보류). **잔여**: ① PR(구현·테스트·리뷰·spec-sync 전부 완료, 본 브랜치 동행) ② **별도 authz follow-up — ✅ 해소 (2026-06-27, PR #716 `3e102ed3` 머지 완료 — `claude/mc-test-authz-7b3bbc`)**: product sign-off(사용자 결정, AskUserQuestion)로 `testConnection` Editor+ 확정. planner: `6-config.md §3` 표에 action-POST(`:id/test`·`preview-models`)=Editor+ / GET(`:id/models`)=Viewer+ 명문화 + **R-7** Rationale 신설 + `7-llm-client.md §8.3` 권한 줄(§5.5 `preview-models` 대칭). developer: `LlmModelConfigController.testConnection` 에 `@Roles('editor')`+`@ApiForbiddenResponse`(`previewModels` 패턴 동형), `listModels` Viewer+ 유지. 테스트: 컨트롤러 spec `@Roles` 메타데이터 단언(test=editor / listModels=none) + `workspace-rbac.e2e` 케이스 H(viewer→403 / editor→404 가드통과 / listModels viewer→404). 인가 behavior change = Viewer 직접호출 403화(UI 도달 경로 없음, 직접 API 갭 차단).
- [x] 5. **chat-channel ↔ triggers** — **완료**. plan 의 "type 강하" 전제도 부족(서비스 양방향)이었으나 끊김: chat-channel→triggers 의존 2곳[ⓐ `ChatChannelController.rotateBotToken`→TriggersService, ⓑ `ChatChannelTokenRotatorService`→`TriggersService.cleanupRotatedChatChannelTokens`]을 **triggers 로 이전**(ⓐ 엔드포인트→`TriggersController`, route `POST /api/triggers/:id/chat-channel/rotate-bot-token` 무변; ⓑ 워커+큐 등록+상수→`triggers/`, cleanup 로직과 co-location). chat-channel→triggers 잔존은 `Trigger` 엔티티만(순환 무관) → 양 모듈 forwardRef 제거, 단방향(triggers→chat-channel) 화. **검증**: lint·build(docker)·unit·**e2e 214(부팅/DI 정상 — 회귀 위험인 DI 초기화 실패 없음 확인)** PASS. spec-impl 앵커 동기화(`15-chat-channel.md` 컨트롤러 링크·file-tree, `user-guide-evidence.md` ImplAnchor, `data-flow/{0-overview,14-chat-channel}.md` 로테이터 위치 — 기계적 경로 sync). PR: branch `claude/refactor-c2-circular-deps`.

**옵션 비교**:

| 옵션 | 장점 | 단점 / 트레이드오프 |
| --- | --- | --- |
| A. 클러스터별 개별 처리 (엔진↔WS forwardRef 유지 + M-7 역전 + llm/chat-channel 공유 타입 shared 강하 — 위 1~5) | §4.4("별도 추상화를 도입하지 않는다", "forwardRef 는 안티패턴이 아님")·`15-chat-channel.md §R4`·`8-embedding-pipeline.md` 의 명시 결정 전부 준수 — spec 개정 불요. spec 무언급 클러스터(llm, chat-channel)만 단방향화해 실익 확보 | 엔진↔WS forwardRef 의 테스트 격리·DI 초기화 순서 고충은 잔존 (의도된 설계의 수용 비용) |
| B. 엔진↔WS 도 이벤트 포트로 교체 (spec §4.4 Rationale 개정 발의 선행) | forwardRef 핵심 쌍까지 제거 — 테스트 격리 고충 근본 해소 | §4.4 명시 결정과 정면 충돌 — planner 의 spec 개정 + consistency-check --spec 통과 전 구현 금지. §4.4 단서(다중 sink 가시화 시 재검토)의 전제가 아직 미충족이라 발의 근거 약함 |
| C. llm-config 를 llm 모듈로 흡수 (shared 강하 대신 모듈 병합) | 순환 자체가 소멸 — shared 레이어 추가 없음 | `data-flow/7-llm-usage.md` 의 participant 구도(별도 모듈)와 어긋나 다이어그램·spec 갱신 유발 — 타입 강하(A)가 spec 무변으로 같은 효과 |
| D. 전면 보류 | 비용 0 | spec 비저촉으로 해소 가능한 클러스터(2~5번: gateway 역전·KB 단방향화·llm·chat-channel)의 개선분까지 포기 |

**권장**: A — 엔진↔WS 는 spec 이 명시적으로 의도한 설계(A 판정)라 유지가 유일한 spec 준수 경로이고, 잔존 고충은 사용자 보고로 가시화한다. spec 무언급 클러스터는 shared 타입 강하로 단방향화하면 `data-flow/7-llm-usage.md` participant 구도를 건드리지 않으면서(C 대비) forwardRef 를 실질 감축할 수 있다.

- **검증**: 부팅 스모크 + WS 구독·KB 임베딩 이벤트 e2e.
- **회귀 위험**: Nest DI 초기화 순서 변경 부팅 실패(컴파일로 안 잡힘).
- **spec 갱신**: 1번 추진 시에만 §4.4 Rationale 개정 (planner, consistency-check --spec 의무).

**부록 — Option B(엔진↔WS 이벤트 포트 교체) 심층 트레이드오프 (2026-06-20, 코드·spec 전수 대조)**

> "#1 엔진↔WS 를 위 옵션 B 로 바꾸면?" 질의에 답해 코드 표면과 spec 결정을 전수 확인한 결과. **결론: 비용/편익 비대칭 — 현 조건에서 A 유지가 타당. B 재추진 조건은 "facade 로 못 푸는 새 sink 요구의 실제 출현"(= §4.4/§R10 이 못박은 재검토 트리거) 충족 시점.**

**(1) 재검토 트리거가 이미 발동·소진됨**: §4.4 단서 "외부 sink 가 실제 추가될 때 재검토"는 발동됐고(EIA Outbound Webhook·SSE·ChatChannel), 그 결론이 **EIA §R10 "엔진 단일 sink 유지 + 외부 facade 분리"** 였다 — port 가 아니라. 세 형제 listener(`external-interaction/notification-fanout.service.ts`·`sse-adapter.service.ts`·`chat-channel/chat-channel.dispatcher.ts`)가 단일 sink `WebsocketService.executionEvents$`(RxJS Subject)에 `onModuleInit` 직접 구독 중. 즉 "엔진을 다수 consumer 에서 분리"라는 port 의 본래 목적은 **이미 달성**됨. `15-chat-channel.md §R4`(line 575)는 `"WebsocketService.executionEvents$ 를 EventEmitter 기반으로 교체"`를 **본 결정 범위 밖**으로 정확히 명시 배제.

**(2) port 편익의 대부분이 기존 코드에 이미 존재** → B 의 순수 추가 편익은 "타입화 interface + forwardRef 봉인→제거"로 협소:

| port 가 보통 주는 가치 | 현재 이미 제공 중 |
| --- | --- |
| emit call-site 일원화 | `execution-engine/events/execution-event-emitter.service.ts`(95줄 "동형 thin 래퍼" — §4.4 가 "금지 대상 추상화 인터페이스 아님"으로 명시 구분) |
| 다수 consumer ↔ 생산자 분리 | `executionEvents$` RxJS Subject + 3 형제 listener facade (EIA §R10) |
| 테스트 시 sink 고립 | 하위 서비스가 `jest.fn()` partial(`Pick<>`)로 이미 고립(`form-interaction.service.spec.ts`); §4.4 도 `Partial<WebsocketService>` 충분 명시 |
| 인스턴스 간 분산 fan-out | **직교** — Continuation Bus(BullMQ `execution-continuation`)가 담당. 옛 Redis pub/sub 폐기(§4.4·Rationale "Durable Continuation") |

**(3) 비용·회귀 표면 (코드 정량)**: emit call-site **~40곳 / 6 클래스** — `ExecutionEngineService`(22)·`AiTurnOrchestrator`(8)·`FormInteractionService`(3)·`ButtonInteractionService`(3)·`RetryTurnService`(4)·`AiAgentHandler`(2, optional). emitter 우회 **직접 주입 4곳**(`background-execution.processor`·`embedding.service`·`graph-extraction.service` → `emitKbEvent`/`emitBackgroundRunEvent`). **이벤트 29종**(Execution 11 + Node 5 + BgRun 2 + Kb 11, `websocket.service.ts:66–311`) wire 호환 유지 대상.
보존해야 할 런타임 계약: **seq monotonic**(`ExecutionSeqAllocator`, Redis `INCR exec:seq:<id>`, **SSE `id:`·Outbound Notification `seq` 와 동일 값 공유** — EIA §R7), **이벤트 순서**(`NODE_FAILED → EXECUTION_FAILED`, §1.1), **TX commit 후 emit**(EIA-RL-04). `EventEmitter2`(비동기·재정렬 가능)로 가면 위 전부 회귀 위험 + Subject 교체 시 **3 형제 listener(EIA + chat-channel + KB) 재배선**으로 blast radius 가 엔진 밖으로 확산. DI: #638 이 입증한 `ws.service↔gateway↔retry↔event-emitter` ES-module 순환의 민감성 — 부팅 실패는 컴파일로 미검출(위 "회귀 위험" 항 그대로).

**(4) 스코프 한계 (중요)**: 엔진↔WS 결합은 **두 방향**이다. ⓐ outbound(emit): 엔진 → emitter → WS = **B 가 다루는 변**. ⓑ inbound(command): `websocket.gateway.ts` → `ExecutionEngineService`(:99)·`RetryTurnService`(:104) = **M-7 인접 영역, B 무관**. 따라서 **B 단독으로는 WS↔engine 순환의 절반(emit 변)만 포트화** — "forwardRef 근본 제거"는 M-7(gateway→서비스 역전)과 동반할 때만 성립.

**(5) 추진 시 최소비용 변형**: `EventEmitter2` 로 Subject 를 교체하지 말고, 현 `ExecutionEventEmitter` 를 `ExecutionEventPort` **interface 구현체로 승격 + `WebsocketService` 는 sink 그대로 유지**(executionEvents$·seq·3 listener 무변). call-site ~40곳은 이미 emitter 주입 중이라 거의 무변, 엔진은 token 의존으로 forwardRef 제거. **단 이 변형조차** §4.4 "별도 추상화 인터페이스 도입 금지"에 막혀 **spec 개정(§4.4 + EIA §R10 + `15-chat-channel.md §R4` 동반) + consistency-check --spec(`rationale-continuity-checker` 의 "기각된 대안 재도입" Critical 해소) 선행이 필수**. → A 유지 권장 결론 불변.

### C-3 [Critical] AuthController 에 bcrypt 비밀번호 검증 (레이어 침범)

- [x] **완료** — controller 레이어 침범(raw bcrypt) 전부 해소(behavior-preserving). ① disable2fa(`auth.controller.ts`) → `AuthService.verifyPasswordForUser` 이관 (#658, 2026-06-20). ② **후속 통일 완료 (#659, 2026-06-20)**: `webauthn.controller.webauthnRegenerateRecovery` raw bcrypt → `verifyPasswordForUser` 위임(controller 의 bcrypt·`UsersService` 의존 제거), `sessions.service.verifyReauth` raw `bcrypt.compare` → `comparePassword` 헬퍼(login/C-3 통일, service 레이어 적합). 에러코드(`PASSWORD_REQUIRED`/`PASSWORD_INVALID`)·메시지·401 shape 불변. plan: [refactor-c3-auth-bcrypt-service.md](../refactor-c3-auth-bcrypt-service.md). 검증(2026-06-24): 두 파일에 raw `bcrypt.compare`/`import bcrypt` 0건 확인. **잔여(별건 보안, 본 항목 범위 외)**: 2FA disable brute-force 보호 — planner spec 선행 필요.

**spec 대조**: D — 행위(2FA 비활성화 시 비밀번호 재확인)는 `1-auth.md §1.2` spec 명시, 계층 배치는 무언급이나 `data-flow/2-auth.md §1.2` 의 시퀀스가 bcrypt.compare 를 일관되게 **Service** 에 배치 — controller 내 bcrypt 는 spec 의 데이터 흐름 모델과 불일치.

**개선 방안**:

1. `AuthService.verifyPasswordForUser(userId, plainPassword)` 신설 — `passwordHash` 부재/불일치 시 현 controller 와 동일한 에러 코드·메시지·401 을 서비스에서 throw.
2. `disable2fa` 의 bcrypt 블록 제거, controller 의 `import * as bcrypt`·`UsersService` 직접 의존 제거.
3. 다른 비밀번호 재확인 경로(세션 강제 종료 재인증 등)가 controller 에 있으면 같은 메서드로 통일.

**옵션 비교**:

| 옵션 | 장점 | 단점 / 트레이드오프 |
| --- | --- | --- |
| A. `AuthService.verifyPasswordForUser` 로 이동 (개선 방안 1~3) | `data-flow/2-auth.md §1.2` 시퀀스가 bcrypt.compare 를 일관되게 Service 에 배치 — spec 데이터 흐름 모델과 정합. controller 의 bcrypt·`UsersService` 직접 의존 제거, 다른 비밀번호 재확인 경로와 단일 메서드로 통일 가능 | 에러 코드·메시지·401 shape 를 서비스 throw 로 정확히 보존해야 함 — 단 검증 표면이 좁아 위험 낮음 |
| B. 보류 (controller 잔존) | 비용 0 — 동작 자체는 spec(`1-auth.md §1.2`) 준수 | spec 의 데이터 흐름 모델과 불일치 지속. 비밀번호 검증 로직이 controller 에 산재할 여지 — 추후 재확인 경로 추가 시 중복 재생산 |

**권장**: A — 행위는 이미 spec 준수이고 계층 배치만 `data-flow/2-auth.md` 모델과 어긋난 상태라, 에러 shape 보존만 지키면 사실상 무위험 정렬이다. 소규모(메서드 1개 신설 + 호출부 교체)라 단독 PR 부담도 없다.

- **검증**: auth unit + 2FA disable e2e (응답 코드·body 불변).
- **회귀 위험**: 낮음 — 에러 shape 보존.
- **spec 갱신**: 불요.

## Major

### M-1 [Major] AiAgentHandler 3,402줄 god-handler

- [x] **완료 (Option A, 단계별 PR — god-handler 분할 3단계 전부 추출)** — `nodes/ai/ai-agent/ai-agent.handler.ts`. 핸들러 3,402→219줄 facade. 1단계 `AiConditionEvaluator`(#665)·2단계 `AiMemoryManager`(#668)·3단계 `AiTurnExecutor`(본 단계) 무상태 collaborator 추출, 핸들러는 NodeHandler 표면+polymorphic 계약+엔진 진입점만 보유하는 composition-root facade.
  - [x] **1단계 — `AiConditionEvaluator` 추출 완료** (commit `24ca3340`, branch `claude/refactor-m1-condition-evaluator`). 조건 평가 로직(`classifyToolCalls`/`extractConditionReason`/`buildConditionSystemPromptSuffix`/`buildConditionTools`/`condToolName`/`sanitizeId` + `ConditionDef`/`ConditionClassification` 타입)을 핸들러 상태 무의존 무상태 collaborator 로 분리 (`ai-condition-evaluator.ts` 신설). `classifyToolCalls` 의 `toolProviders` 만 인자 주입으로 외부화. 핸들러 -128/+22줄. `processMultiTurnMessage` 시그니처·`out` 포트 라우팅·`buildConditionOutput` 핸들러 잔류(behavior-preserving). spec §5.1 정합 `required: []` 명시(JSON Schema 동치). 신규 단위 테스트 `ai-condition-evaluator.spec.ts`.
    - 검증: lint·build PASS · backend unit 7207+ PASS(ai-agent 439) · e2e 205 PASS. ai-review `review/code/2026/06/21/18_50_15/`(Critical/Warning 0 수렴) · 선행 리뷰 `18_28_08`·`18_38_11`(RESOLUTION). impl-done(최종 코드 `24ca3340` 커버) `review/consistency/2026/06/21/18_57_55/` **BLOCK:NO** (선행 `18_38_47` 은 fix 이전 기준).
  - [x] **2단계 — `AiMemoryManager` 추출 완료** (commit `3369fcef`, branch `claude/refactor-m1-memory-manager`). 자동 메모리 전략(`summary_buffer`/`persistent`) 관리 로직(`resolveMemoryStrategy`·`injectMemoryContext`·`scheduleMemoryExtraction`)을 핸들러 상태 무의존 무상태 collaborator 로 분리 (`ai-memory-manager.ts` 신설). 외부 의존(llm/thread/agent-memory 서비스)은 생성자 주입(#665 동형). §12.9~12.14 Rationale 불변식 전부 보존: manual 경로 완전 무변경(§12.9)·language-aware 토큰 추정 무의존(§12.10)·안정 프리픽스 캐시 보호(§12.11)·summary/extractionModelConfigId provider 디커플 폴백(§12.12)·요약 유실 graceful degrade(§12.13)·user 경계 물리 압축(§12.14). `processMultiTurnMessage` polymorphic 시그니처(§1.3, IE 공유)·`meta.memory` echo(§7)·watermark `_resumeState` 영속·thread 주입(`injectThreadContext`/`pushAiThreadTurn`, memory 와 비얽힘) 핸들러 잔류. shared 헬퍼(`agent-memory-injection.ts`) 미이동(IE handler import 무영향). 핸들러 3329→2999줄(-330). 신규 manager 398줄. 신규 단위 테스트 `ai-memory-manager.spec.ts`(17 케이스).
    - 검증: lint 0 errors·build PASS · backend unit 369 suites/7259 PASS(신규 spec 17/17, ai-memory-manager graceful-degrade 경유 확인) · spec build-guard(`spec-status-lifecycle`/`spec-pending-plan-existence`) 223 PASS · e2e 205 PASS(멀티턴 park/resume). impl-prep `review/consistency/2026/06/21/21_00_17/`(Critical 1건은 behavior-preserving refactor 와 직교한 pre-existing IE status 사안 — developer 판정 비차단, build-guard PASS 로 경험적 입증, SUMMARY §Developer 판정). ai-review 3회 수렴 `review/code/2026/06/21/{21_26_26(W6),21_43_55(W4),21_55_05(W1)}/`(RESOLUTION — 최종 잔존 1건은 planner-only spec frontmatter SPEC-DRIFT). impl-done(최종 코드 `960968b4` 커버) `review/consistency/2026/06/21/22_00_44/` **BLOCK:NO**(WARNING 2건 = frontmatter `code:` 미등재, planner backlog). origin/main #666(이메일 변경, AI 노드 직교) 머지 후 **rebase 재검증**(규약 #6): 충돌 0(코드 diff = 3파일 그대로) · build·unit 369 suites/7292 PASS · post-rebase ai-review `review/code/2026/06/21/22_11_53/`(Critical/Warning **0/0** clean) · impl-done `review/consistency/2026/06/21/22_16_17/` **BLOCK:NO**(Rationale Continuity 가 §12.9~12.14 불변식 전체 보존 확인).
  - [x] **3단계 — `AiTurnExecutor` 추출 완료** (commit `6faefe48` 구현 + `c82b4a03` ai-review 테스트 보강, branch `claude/m1-step3-ai-turn-executor`). turn 실행 표면 전체 — single/multi 루프(`executeSingleTurn`/`executeMultiTurn`/`processMultiTurnMessage` inner)·tool 실행(`executeProviderToolBatch`/`runProviderTool`)·turn 종결 출력 조립(`buildMultiTurnFinalOutput`/`buildConditionOutput`/`endMultiTurnConversation`/`buildRetryState`/`multiTurnPortForEndReason`/`buildMultiTurnConfigEcho`)·ConversationThread push 헬퍼·`buildTools`·`RagAccumulator`/utils — 을 핸들러 상태 무의존 무상태 collaborator 로 분리 (`ai-turn-executor.ts` 신설, 2,911줄). 외부 의존(llm/toolProviders/eventEmitter/thread service)+선행 collaborator(conditionEvaluator #665·memoryManager #668) 생성자 주입, 이동 메서드 verbatim(logger 만 `AiTurnExecutor` 교체). 핸들러는 NodeHandler 표면(`execute`/`validate`)·polymorphic 계약(`processMultiTurnMessage` §1.3, IE 공유)·엔진 진입점(`endMultiTurnConversation`/`buildMultiTurnFinalOutput`)만 보유하는 **219줄 facade** 로 **단방향 위임**(executor→handler 역참조 0, composition root). 핸들러 2999→219줄(-2780). **경계 결정**: `executeSingleTurn` 과 multi-turn 루프가 thread push·buildTools·executeProviderToolBatch·buildConditionOutput 헬퍼 셋을 공유 → 부분 추출(루프만)은 executor↔handler 양방향 결합 강제, turn 표면 전체 이전으로 단방향+verbatim 달성(`~1,050줄` 추정은 루프 단독 — 공유 헬퍼 포함 시 실측 2,911). park/resume(`_resumeState`/`_resumeCheckpoint`)·출력 포트 shape(§7.4~7.9)·retry 재진입(`_retryState` no-credential allow-list)·form bypass/fallback(`pendingFormToolCall`)·tool_use↔tool_result 페어링·`meta` echo·미주입 fixture graceful degrade 전부 보존. 신규 단위 테스트 `ai-turn-executor.spec.ts`(17 케이스 — capFormDataBytes UTF-8 경계·form_submitted resume 포함).
    - 검증: lint·build PASS · backend unit 370 suites/7310 PASS(IE handler·execution-engine `endMultiTurnConversation` 호출 정합 포함) · spec build-guard(`spec-status-lifecycle`/`spec-pending-plan-existence`) 223 PASS · e2e 214 PASS(멀티턴 park/resume·render_*·retry). impl-prep `review/consistency/2026/06/21/23_03_12/` **BLOCK:NO**. ai-review 수렴 `review/code/2026/06/21/{23_06_04(Critical 0/W9→RESOLUTION),23_21_03(Critical/Warning **0/0** clean)}/` — 잔존 WARNING 전부 deliberate-defer(RESOLUTION 근거): W#1 condition `toolCallCount++` = **pre-existing**(`HEAD~1` multi-turn 루프와 byte-identical 검증)→behavior-preserving 보존·별건 spec-aligned 수정 위임, W#2 DI/process.env = #665·#668 무상태 collaborator 패턴 동형, W#3·#4 메서드 분리/중복 = C-2(03-maintainability) 후속, I#1 frontmatter `code:` = planner-only. impl-done(최종 코드 `c82b4a03` 커버) `review/consistency/2026/06/21/23_30_04/` **BLOCK:NO**(WARNING 3 = spec 포인터 drift 2 planner + `AiTurnExecutor`/`AiTurnOrchestrator` 명명 가독성 1 비차단).
  - **planner 후속(비차단 SPEC-DRIFT, M-1 god-handler 분할) — ✅ 완료 (PR #685 + PR-D 2026-06-24)**: ① **#685**: `1-ai-agent.md` frontmatter `code:` 3종 등재 + §6.1 `classifyToolCalls` → `AiConditionEvaluator` 참조. ② **PR-D(잔여 spec-sync, branch `claude/spec-sync-m1-ai-agent-residual`)**: `1-ai-agent.md` §6 서두 레이어 주석(handler facade → `AiTurnExecutor`/`AiConditionEvaluator`/`AiMemoryManager` 위임 / 엔진 `AiTurnOrchestrator`) + §6.1 단계 2 `AiTurnExecutor.executeSingleTurn` + §6.2 `executeMultiTurn`/`processMultiTurnMessage` 진입점 + §6.1 단계 1.3/1.5/2.7 `AiMemoryManager.injectMemoryContext`/`scheduleMemoryExtraction` 위임 참조 + §7.1 `ToolCallTrace` shape `startedAt?`/`finishedAt?` + 구현 위치(`ai-turn-executor.ts`, WS §4.4 정합) + `data-flow/13-agent-memory.md` ai-agent 메모리 call-site `AiMemoryManager` 위임 동기화(consistency W-1). **`interaction-type-registry.md` frontmatter/§12.6 = 변경 불요 확인** — 이 파일은 `FORM_SUBMITTED_*` 를 참조하지 않고(전제 false), `1-ai-agent.md §12.6` 도 상수를 이름만 써 갱신할 경로 표기 부재. **defer(별 doc-sync)**: `0-common.md`(presentation)·`conversation-thread.md` 의 `processMultiTurnMessage` 위치 비대칭(I-1) + `§12.15` M-1 god-handler 분할 Rationale 신설(I-5, pre-existing 공백). 근거: `review/consistency/2026/06/24/14_49_13/`·`2026/06/21/23_30_04/`.

**spec 대조**: D — `<type>.handler.ts` co-location 은 spec 규정이나 크기/보조 클래스 제한 없음. `AgentToolProvider` 분리는 spec(`11-mcp-client.md §1`)이 명시한 의도 패턴 — 같은 방향의 내부 분할은 비저촉. `processMultiTurnMessage` polymorphic 시그니처(information_extractor 와 공유, `4-execution-engine.md §1.3`)는 계약 — 보존 필수.

**개선 방안** (위험 낮은 순):

1. `AiConditionEvaluator` 먼저 (입출력 순수 — 추출 위험 최소).
2. `AiMemoryManager` (§12.9~12.14 Rationale 을 동작 보존 체크리스트로).
3. `AiTurnExecutor` (~1,050줄) — `processMultiTurnMessage` 시그니처는 핸들러에 남기고 내부 위임만.
4. 배치는 `nodes/ai/ai-agent/` 하위 (co-location 준수), `ai/shared/` 승격은 실공유 확인 후에만.

**옵션 비교**:

| 옵션 | 장점 | 단점 / 트레이드오프 |
| --- | --- | --- |
| A. 위험 낮은 순 단계 추출 (Evaluator→Memory→TurnExecutor), `nodes/ai/ai-agent/` 하위 배치 | co-location 규정(`<type>.handler.ts` 디렉토리) 준수. `processMultiTurnMessage` polymorphic 계약(§1.3)은 핸들러에 잔류시켜 보존. `AgentToolProvider` 분리(spec `11-mcp-client.md §1` 명시 의도 패턴)와 같은 방향 — 단계별 회귀 격리 | 3단계 PR — TurnExecutor(~1,050줄) 도달까지 god-handler 부분 잔존 |
| B. `ai/shared/` 로 즉시 승격 배치 (information_extractor 공유 선반영) | 공유가 실재한다면 이동 1회로 종결 | 실공유 미확인 상태의 추측성 일반화 — co-location 이탈. 공유 확인 후 승격(A 의 4번)으로 충분히 늦출 수 있음 |
| C. 보류 | 비용 0 | 3,402줄 god-handler 지속 — [03-maintainability.md](./03-maintainability.md) C-2 메서드 분리도 연쇄 차단 |

**권장**: A — spec 이 이미 같은 방향의 내부 분할(`AgentToolProvider`)을 의도 패턴으로 명시했고, co-location 과 §1.3 계약 보존을 모두 만족하는 유일한 경로다. `ai/shared/` 승격은 실공유가 확인되는 시점으로 미루는 것이 안전하다.

- **검증**: handler spec 테스트 + 멀티턴 park/resume e2e + render_* e2e.
- **회귀 위험**: §7.4~7.9 출력 포트 shape·`_resumeCheckpoint` allow-list.
- **spec 갱신**: 불요. (메서드 분리 상세: [03-maintainability.md](./03-maintainability.md) C-2)

### M-2 [Major] IntegrationOAuthService 2,579줄 — 다중 OAuth 프로토콜 혼합

- [x] **완료 (Option A)** — branch `claude/m-2-oauth-strategy`. `OAuthProviderStrategy` 인터페이스 + `integrations/oauth-providers/` 5개 strategy(google/github/cafe24-public/cafe24-private/makeshop, + 표준/cafe24 base·hub·registry) 신설. 프로토콜 혼합(begin authorize URL·exchangeCodeForToken cred/URL/form·normalizeTokenResponse meta·parseTokenExpiresAt expiry·stub)을 strategy 로 전량 이전, facade(`IntegrationOAuthService`) 명·외부 API·`status_reason` 매핑·install 보안(HMAC/nonce/recovery)·state/preview lifecycle 잔류. facade 2,612→2,307줄. `refreshToken` 은 본 서비스에 없음(`*-api.client.ts`·expiry-scanner 담당) → 인터페이스에서 제외. process.env 무수정(M-6 #660 에서 oauth.config.ts 이전 완료).
  - 검증: lint/build PASS · unit PASS(integrations 477[기존 446 + 신규 전략 31] + 전체) · e2e PASS(205, cafe24-install·makeshop-install·begin·precheck 포함). `_test_logs/` 참조.
  - consistency impl-prep: `review/consistency/2026/06/21/17_02_20/SUMMARY.md` (BLOCK: NO — 발견 전부 spec 영역 기존 사안, M-2 무관).
  - ai-review: `review/code/2026/06/21/17_32_11/SUMMARY.md` (Critical 0 / WARNING 7 → 전략 단위 테스트 31건 + 주석으로 전건 해소, RESOLUTION.md) → fresh `review/code/2026/06/21/17_44_52/SUMMARY.md` (Critical 0 / WARNING 0 — clean pass).
  - consistency impl-done: `review/consistency/2026/06/21/17_49_11/SUMMARY.md` (BLOCK: NO — WARNING 4건 전부 spec 영역 기존 사안[overview port 수·send_email port·output.rowCount·INTEGRATION_SERVICE_UNAVAILABLE surface]으로 M-2 무관·planner 별건. I-6/I-7 이 M-2 정합·refreshToken 제외 정합 명시).

**spec 대조**: B — data-flow 시퀀스의 participant 가 `IntegrationOauthService` 단일이지만 spec 이 내부 구조를 구현 재량으로 명시(`4-integration.md` Rationale "provider 별 분리인지 파라메트릭인지는 구현 세부 사항"). facade 명 유지 시 다이어그램 무변.

**개선 방안**:

1. `OAuthProviderStrategy`(`begin`/`exchangeCode`/`refreshToken`) + `integrations/oauth-providers/` 에 5개 strategy (google/github/cafe24-public/cafe24-private/makeshop).
2. state·preview 토큰 관리는 facade 잔류.
3. `process.env` 7곳은 M-6 과 같은 PR 로 설정 객체 이전.
4. 이전 순서: makeshop(자기완결) → cafe24 2변형(install_token 흐름 보존) → google/github.

**옵션 비교**:

| 옵션 | 장점 | 단점 / 트레이드오프 |
| --- | --- | --- |
| A. provider 별 strategy 5개 분리 + facade 명 유지 | spec Rationale("provider 별 분리인지 파라메트릭인지는 구현 세부 사항")이 명시적으로 허용한 재량 — facade(`IntegrationOauthService`) 유지로 data-flow 다이어그램 무변. provider 별 회귀 격리 (cafe24 install_token·makeshop 흐름이 서로 영향 없음), 신규 provider = strategy 1개 추가 | 인터페이스 1개 + 파일 5개 신설, state·preview 토큰의 facade/strategy 경계 설계 필요 |
| B. 파라메트릭 단일 서비스 (provider 차이를 설정 테이블로 수렴) | 파일 수 최소 — 표준 OAuth2 부분은 중복 제거 | cafe24 public/private 의 install_token 흐름·redirect URI 형식, makeshop 의 비표준 흐름 등 구조적 차이가 커 테이블로 수렴 불가 — 분기 복잡도가 단일 클래스 내부에 잔존 (현행 2,579줄의 원인 재생산) |
| C. 보류 | 비용 0 | 다중 프로토콜 혼합 지속 — provider 추가·수정마다 2,579줄 파일에서 shotgun surgery |

**권장**: A — spec 이 내부 구조를 구현 재량으로 못박았으므로(B 판정) spec 갱신 없이 진행 가능하고, 제거하려는 복잡도의 본질이 "provider 간 흐름 차이" 라 파라메트릭(B)으로는 해소되지 않는다. facade 명 유지가 data-flow participant 와의 정합 비용을 0 으로 만든다.

- **검증**: provider 별 OAuth e2e(stub) + 만료 스캐너 unit + `status_reason` 매핑 불변.
- **회귀 위험**: cafe24 private install_token·redirect URI 형식.
- **spec 갱신**: 불요 (facade 유지 시).

### M-3 [Major] WorkflowAssistantStreamService — `streamMessage` 혼재

- [x] **완료** (권장안 A 의 Router→Guard→Persistence 3단계 전부 추출 — `streamMessage` 혼재 해소) — `workflow-assistant-stream.service.ts`. 1단계 `AssistantToolRouter`(#670)·2단계 `AssistantFinishGuard`(#680)·3단계 `AssistantTurnPersistenceService`(본 PR) 무상태 collaborator 추출, `streamMessage` 는 SSE 조립·tool-loop·turn-scoped 상태 소유만 잔류.
  - [x] **1단계 — `AssistantToolRouter`** (explore dispatch registry + kind 메타). `tools/assistant-tool-router.service.ts` 신설: `classifyKind`(도구명→kind, `TOOL_KIND_BY_NAME` 단일 소비점) + `dispatchExplore`(explore 9도구 registry — `get_current_workflow`/`verify_workflow` shadow 선처리, `get_node_schema` turn-scoped 캐시·하드스톱, 그 외 `ExploreToolsService` 위임) + `handleExploreCall`·`buildCurrentWorkflowResult`·`buildVerifyWorkflowResult` **verbatim 이동**. 공유 `asString`→`tools/coerce.ts`, `SCHEMA_LOOKUP_HARD_STOP` 이동. `streamMessage` 는 kind 룩업·explore 분기를 router 에 위임(나머지 SSE 조립·plan/edit/finish dispatch·§10 가드 잔류). 동작 보존: `verify_workflow` ok:true → `reviewCompleted` 신호 반환으로 호출부가 guardState 갱신. 검증: 신규 `assistant-tool-router.service.spec.ts`(classifyKind + dispatchExplore 캐시/위임 격리 테스트) + 기존 `workflow-assistant-stream.service.spec.ts` 통합 테스트 green(unit 375 PASS, e2e 214 PASS). 산출: `review/consistency/2026/06/23/00_33_41/`(impl-prep BLOCK:NO). PR: branch `worktree-refactor-m3-assistant-tool-router`.
  - [x] **2단계 — `AssistantFinishGuard`** (§10 2단계 finish/review 가드 캡슐화). `tools/assistant-finish-guard.service.ts` 신설(@Injectable): `evaluateFinishGuard`/`evaluateReviewGuard`/`shouldSkipReview` + `FinishGuardState`/`FinishGuardError` + 가드 상수(`MAX_REVIEW_ROUNDS`·`MIN_NONTRIGGER_NODES_FOR_VERIFY`·`REVIEW_ORIGINAL_REQUEST_MAX_LEN`)·`truncateReviewOriginalRequest` **verbatim 이동**. `nodeRegistry`/`candidateLookup` 생성자 주입, 턴 횡단 카운터(`FinishGuardState`)는 호출부가 소유·변이하고 가드는 판정만. 공유 헬퍼 추출: `collect-pending-user-config.ts`(edit 경로+review 가드 공유, `NodeComponentRegistry` type-only import 로 런타임 순환 0)·`isPlanPendingApproval`→`active-plan-context.ts`. detached 였던 `evaluateFinishGuard` JSDoc 을 메서드와 재결합. `streamMessage` 는 가드 발동 분기(상태 변이·SSE·persist)만 보유. 검증: 신규 `assistant-finish-guard.service.spec.ts`(12 — evaluateFinishGuard 전 분기 + shouldSkipReview 판정) + 기존 통합 381 무변 green. lint·build(docker)·unit(전체)·**e2e 214** PASS. impl-prep `review/consistency/2026/06/24/07_58_47/`(BLOCK:NO). ai-review `review/code/2026/06/24/08_34_32/`(10 리뷰어 평문 fan-out, Risk LOW, Critical 0, Warning 1 = `evaluateReviewGuard` 9-param 시그니처 pre-existing verbatim → RESOLUTION defer). impl-done `review/consistency/2026/06/24/08_44_15/`. PR: branch `claude/refactor-m3-finish-guard`.
  - [x] **3단계 — `AssistantTurnPersistenceService` 추출 완료** (구현 `813a4829` + ai-review fix `8426d829`, branch `claude/refactor-m3-persistence`). 세션/메시지 영속 책임 전부 — `persistAssistantTurn`(assistant row append: text/toolCalls/plan/usage/finishReason + stall 복구 resumeMeta) + user 메시지 append(`persistUserTurn`: appendMessage + setTitleIfEmpty idempotent) + `makeResumeMeta`(공유 leaf 헬퍼) — 을 무상태 collaborator `tools/assistant-turn-persistence.service.ts` 로 **verbatim 이동** + 생성자(`sessionService`) 주입. `streamMessage` 는 user append 1줄·4개 persist 호출부를 `turnPersistence` 로 위임하고, turn-scoped 상태(`assistantText`/`pendingToolCalls`/`totalStallCount`)·`planPersisted ? null : planForTurn` 평가·SSE 순서(persist→`auto_resume`)는 잔류(무상태 collaborator 원칙 — impl-prep consistency 가 명시한 "caller derive, collaborator write"). `makeResumeMeta` 는 streamMessage 가 소유한 `totalStallCount` 로부터 메타를 derive 해 넘기므로 공유 import(스펙된 "공유 헬퍼 leaf 추출"). 핸들러 1304→1237줄(-67), 신규 서비스 120줄. ai-review fix: `UsageSnapshot`/`ResumeMeta` 인터페이스 export 추출 + `persistAssistantTurn` JSDoc(finishReason 의도 주석) + 테스트 보강. 신규 단위 spec `assistant-turn-persistence.service.spec.ts`(makeResumeMeta 경계·persistUserTurn title derive/skip·persistAssistantTurn shape/resumeMeta/length finishReason·thinkingTokens). 통합 spec(`workflow-assistant-stream.service.spec.ts`)·모듈 provider 에 신규 의존성 주입.
    - 검증: lint·build PASS · 타깃 unit 87 PASS(통합 72 + 신규 15) · **e2e 214 PASS**(신규 provider DI 부팅 정상). impl-prep `review/consistency/2026/06/24/09_39_46/` **BLOCK:NO**(Critical 0). ai-review 2라운드 수렴 `review/code/2026/06/24/{09_51_30(Critical 0/Warning 1=finishReason→INFO 수용),10_03_52(Critical 0/Warning 1=makeResumeMeta 공유 import→deliberate defer)}/`(RESOLUTION — Warning 은 스펙된 "공유 헬퍼 leaf" 설계라 defer, finishReason 은 provider 원본+합성 마커 수용 필요해 strict union 불가·JSDoc 근거). impl-done `review/consistency/2026/06/24/10_12_59/` **BLOCK:NO**(Critical 0, WARNING 1=본 체크박스 미갱신[해소], INFO 2=spec §7 의사코드·data-flow 행위자 표기 drift → planner 위임).
  - **planner 후속 — ✅ 완료 (PR-A spec-sync, 2026-06-24)**: `4-ai-assistant.md` §10 의사코드 `this.persistAssistantTurn(...)` → `this.turnPersistence.persistAssistantTurn(...)` 위임 + 중간 row `makeResumeMeta(0)` + 최종 row `makeResumeMeta(totalStallCount)`(= `autoResumed: totalStallCount > 0`, `consecutiveStallRounds` 역할 분리 명시) + **§10 review skip 리스트에서 `finishBlockCount > 0` 제거**(M-3 2단계 drift — §10.5 결정과 body 모순 해소) + **`MIN_EDITS_FOR_VERIFY` → `MIN_NONTRIGGER_NODES_FOR_VERIFY`**(verify 게이트는 non-trigger 노드 ≥3 기준) + Rationale `### streamMessage god-service 분할 (M-3)` 신설(3 collaborator 표) + `data-flow/7-llm-usage.md` 행위자 위임 표기. frontmatter `code:` glob(`workflow-assistant/**/*.ts`)가 신규 파일 자동 커버 확인. **짝 developer PR ✅ 완료**: `prompts/system-prompt.ts:382` Self-review skip 안내가 `finishBlockCount` 제거 전 동작(stale)이던 것을 **PR #686**(branch `claude/fix-assistant-prompt-review-skip`)에서 정합 — 옛 clause 제거 + "독립 계층, plan 가드 이후에도 review 발동" 능동 정정 + 회귀 단언 2건. spec §10(본 PR-A) + prompt(#686)가 유지보수 불변식(§992/§1349)의 두 절반이므로 **#685·#686 동행 머지 권장**. impl-prep `review/consistency/2026/06/24/12_54_38/` **BLOCK:NO**. 근거: 같은 디렉터리 + `review/consistency/2026/06/24/10_12_59/`.

**spec 대조**: B — `4-ai-assistant.md` 는 도구 정의(§4)·SSE(§5~6)·가드(§10)의 **행위 계약**만 규정, 내부 분해 무언급. §10 의 미세 의미(progress-aware finish 재발동·review 최대 2회·verify 턴당 1회·plan-only fast-path)가 회귀 포인트.

**개선 방안**:

1. `AssistantToolRouter` — 도구명→handler registry + kind(`explore`/`plan`/`edit`) 메타, 신규 도구 = registry 1행 (OCP).
2. `AssistantFinishGuard`/`AssistantReviewGuard` — §10 상태 필드(`reviewRoundCount` 등)를 가드 객체로 캡슐화, 분리 단위를 §10 Phase 경계와 일치.
3. `AssistantTurnPersistenceService` — 세션/메시지 영속 + `autoResumed` 메타.
4. `streamMessage` 는 SSE 조립·중단 처리만.

**옵션 비교**:

| 옵션 | 장점 | 단점 / 트레이드오프 |
| --- | --- | --- |
| A. 3분해 전체 (ToolRouter + Guard 객체 + Persistence — 개선 방안 1~4) | 분리 단위가 spec §10 Phase 경계와 일치 — 가드 미세 의미(progress-aware finish 재발동·review 최대 2회·verify 턴당 1회)가 가드 객체 unit 테스트로 직접 커버됨. 신규 도구 = registry 1행 (OCP). spec 은 행위 계약만 규정(B 판정)이라 spec 무변 | 분해 폭이 커서 단일 PR 시 SSE 이벤트 순서 회귀 검증 부담 — 단계 분할(Router 먼저) 가능 |
| B. `AssistantToolRouter` 만 우선, 가드는 `streamMessage` 잔류 | 최소 비용으로 도구 추가 OCP 확보 | §10 의 회귀 포인트(가드 발동 순서·횟수 한도·fast-path)가 혼재 코드에 잔존 — 본 항목이 지목한 핵심 위험이 미해소 |
| C. 보류 | 비용 0 | 신규 도구·가드 규칙 추가마다 `streamMessage` 직접 수정 — §10 미세 의미 회귀 위험 누적 |

**권장**: A — 본 항목의 위험 중심이 §10 가드 의미이므로 가드 객체 캡슐화 없이는(B) 실익이 절반에 그친다. 분리 경계를 spec §10 Phase 와 일치시키면 spec 표 전체를 가드 unit 시나리오로 옮길 수 있어 검증이 오히려 쉬워진다. 필요 시 Router→Guard→Persistence 순 단계 PR 로 나눠도 무방.

- **검증**: SSE 이벤트 순서·`auto_resume` 분할 버블 e2e + finish 가드 시나리오 unit(§10 표 전부).
- **회귀 위험**: 가드 발동 순서·fast-path 비활성 조건.
- **spec 갱신**: 불요.

### M-4 [Major] blocking 인터랙션 문자열 리터럴 분기 잔존 — park-진입 측 dispatch 추출

- [x] **구현 완료 (Option A, 2026-06-24, 커밋 `ecd70dd1`)** — branch `claude/refactor-m4-park-entry-dispatch`. park-진입 측 form/buttons/ai `waitForX` 선택 분기를 `ParkEntryDispatch` registry(`park-entry-dispatch.ts` — 인터페이스 + 순수 factory `buildParkEntryRegistry`)·`dispatchParkEntry` 로 일원화. resume 측 `dispatchResumeTurn`(#507)과 대칭. **3개 사이트**(plan 원안 "두 블록"에서 확대 — `runNodeDispatchLoop` 드라이브·`executeInline` 중첩·`runExecution` 메인 루프)의 if/else 를 단일 dispatch 호출로 치환. **PARK_RELEASED escape 는 사이트별 보존**(bare `return`/`ParkReleaseSignal` throw/`{parked:true}`) — registry 는 `ProcessTurnResult` 만 반환, escape 는 호출측 유지. `ai_form_render` 는 `ai_conversation` 항목 공유 매칭. behavior-preserving. 검증: lint·build·unit(신규 `park-entry-dispatch.spec.ts` 7)·**e2e 214 PASS**. impl-prep `review/consistency/2026/06/24/15_38_48/` BLOCK:NO · ai-review `review/code/2026/06/24/15_44_39/`(Risk LOW, Critical 0, Warning 2=SPEC-DRIFT defer, RESOLUTION) · impl-done `review/consistency/2026/06/24/15_52_12/` BLOCK:NO.
  - **후속 planner spec-sync ✅ 완료 (PR-spec, 2026-06-24, #688 머지 후)**: `interaction-type-registry.md` frontmatter `code:` 에 `park-entry-dispatch.ts` 등재 + §1.2 끝에 park-entry 라우팅 대칭 노트(`dispatchParkEntry`/`parkEntryRegistry`, first-match-wins form→buttons→ai, `ai_form_render` 는 `ai_conversation` 공유, PARK_RELEASED escape 사이트별) + `spec/5-system/4-execution-engine.md §Rationale` 에 "park-entry dispatch registry 추출 (M-4)" 항(resume #507 대칭) 추가. impl-prep `review/consistency/2026/06/24/16_13_47/` **BLOCK:NO**. (impl-first 채택 사유: spec frontmatter `code:` 는 파일 origin/main 존재 후 등재 가능 — doc-guard. behavior-preserving 이라 impl 이 spec 계약 미위반.)

**spec 대조**: D — `interaction-type-registry.md` 가 이 분기들을 직접 통치: 문자열 분기 존재 자체는 규약이 인지·가드하는 상태(exhaustive switch 규칙), 단 규약 §4 Rationale 의 목적(shotgun surgery 차단)은 항목과 동일. **resume 측은 이미 registry 추출 완료(PR #507)** — 잔존 지점은 park-진입(waitForX 선택) 측.

**개선 방안**:

1. `ResumeTurnDispatch` 와 대칭인 `ParkEntryDispatch`(kind/selects/handle) 를 `resume-turn-dispatch.ts` 옆에 신설 — form/buttons/ai_conversation 3건 (`ai_form_render` 는 핸들러 emit 이라 비대상 — 매트릭스 §1.2 일치 확인).
2. retry-드라이브(1577-1616)·메인 루프(3700대) 두 중복 블록을 단일 `dispatchParkEntry(ctx)` 로 — `PARK_RELEASED` 조기반환 보존.
3. `NodeTypeMetadata` 신필드 불요 — `getMetadata().interaction` 이 이미 metadata 기반, registry 키로 그대로 사용.
4. `satisfies Record<WaitingInteractionType, …>` 로 exhaustive 보장 유지 (규약 규칙 2).

**옵션 비교**:

| 옵션 | 장점 | 단점 / 트레이드오프 |
| --- | --- | --- |
| A. `ParkEntryDispatch` registry 추출 (resume 측 PR #507 과 대칭) | retry-드라이브·메인 루프 두 중복 블록이 단일 `dispatchParkEntry` 로 — exhaustive switch 가 못 잡는 "두 블록 간 불일치" 위험 제거. `interaction-type-registry.md §4` Rationale 의 목적(shotgun surgery 차단)과 동일 방향, resume 측과 구조 대칭으로 인지 비용 감소. `satisfies Record<WaitingInteractionType,…>` 로 규약 규칙 2(exhaustive 보장)도 그대로 유지 | spec 갱신 필요 — `interaction-type-registry.md §1.2` emit 위치 열 + `spec-sync-resume-dispatch-registry.md` 에 park-entry 레이어 추가 (planner 선행) |
| B. exhaustive switch 현행 유지 | 규약이 이미 인지·가드하는 합법 상태 (규칙 2 + AST 가드) — 신규 type 누락은 컴파일·테스트가 차단. spec 갱신 불요, 비용 0 | 가드는 "누락" 만 잡고 "두 중복 블록의 동작 불일치" 는 못 잡음 — 신규 인터랙션 type 마다 retry-드라이브·메인 루프 2곳 동기 수정 의무 잔존 (규약 §4 가 차단하려는 shotgun surgery 그 자체) |

**권장**: A — 현행도 규약상 합법이지만(B), 규약 §4 의 목적 자체가 shotgun surgery 차단이고 resume 측이 이미 PR #507 로 같은 registry 패턴에 착지했으므로 park-진입 측만 비대칭으로 남길 이유가 없다. 단 spec 갱신(§1.2 emit 위치 열)이 선행 조건이므로 planner 의 `spec-sync-resume-dispatch-registry.md` 합류 후 착수한다.

- **검증**: park/resume e2e + dispatch unit(우선순위 form→buttons→ai 보존).
- **회귀 위험**: `withInteractionMeta` 의 interactionType meta 누락 시 frontend snapshot reconcile 파괴.
- **spec 갱신**: **필요** — `interaction-type-registry.md §1.2` emit 위치 열 + 진행 중 `spec-sync-resume-dispatch-registry.md` 에 park-entry 레이어 추가 (planner).

### M-5 [Major] `ALL_NODE_COMPONENTS` 정적 배열 ⚠️ (방향 확정 2026-06-20: Option B — DI multi-provider 3-레이어)

- [~] **레이어1 완료 (#652, 2026-06-20)** · 레이어2/3 미착수. **방향 확정: Option B(아래 §방향 확정). 경량안 A(spread)는 폐기 — B 레이어1 로 대체.**
  - [x] **레이어1 — 정적 배열 → DI 등록 (#652)**: `NODE_COMPONENT` 토큰(`core/node-component.interface.ts`) + `NodeComponentsModule`(`{provide: NODE_COMPONENT, useValue: ALL_NODE_COMPONENTS}` — `nodes/<category>/index.ts` 카테고리 배열을 `NODE_CATEGORIES` 순서로 spread) 신설. `NodeBootstrapService` 가 정적 `import { ALL_NODE_COMPONENTS }` 대신 `@Inject(NODE_COMPONENT)` 로 주입받아 부팅 등록(테스트 override seam) + 정렬 결정성. **핫스팟 해소**: 노드 추가 = 자기 `nodes/<category>/index.ts` 배열만 수정(중앙 파일은 카테고리 추가 시에만). 검증: lint·build·unit(`node-components.module.spec`·`node-bootstrap.service.spec`)·e2e 205 PASS. spec §1.0/§4 등록 메커니즘 sync(`7283a216` — "정적 배열 순회"→"DI 부팅 등록"; §4 "런타임 플러그인 로딩 미구현" invariant 유지). ai-review CLEAN(Critical 0/Warning 0). plan: [refactor-m5-node-di-layer1.md](../refactor-m5-node-di-layer1.md)(라이프사이클상 `plan/complete/` 이동 잔여 — 별 plan-lifecycle 정리).
  - [ ] **레이어2 (per-workspace entitlement)** · **레이어3 (marketplace Phase D 커스텀 노드)** — 별도 후속(큰 신규 설계: entitlement 저장소·노출/실행 게이트·서명·샌드박스). planner spec + 사용자 결정 선행.

**spec 대조**: A(기술적 판정) — `4-nodes/0-overview.md §1.0`/§4 가 "정적 배열로 부팅 시 부트스트랩, 런타임 플러그인 로딩 경로는 존재하지 않는다" 로 **현행을 기술**. 단 같은 §4 가 그 정적 배열을 "**미구현/Planned**" 플러그인 인터페이스(§4.1~4.3 — `manifest.json` 초안 + "빌트인·향후 플러그인 노드가 공유"하는 핸들러 계약)의 **전 단계로 명시 예약**한다 — 즉 정적 배열은 v1 단순화이지 플러그인 모델의 영구 기각이 아니다. 북극성(per-workspace 노드셋)은 `marketplace-and-plugin-sdk.md` Phase D(line 83 "워크스페이스에 설치된 커스텀 노드를 `NodeComponentRegistry` 에 동적 등록")에 예약. **merge-conflict hotspot 고충은 실재.**

**방향 확정 (2026-06-20, 사용자 결정) — Option B: DI multi-provider 3-레이어**

> **결정 근거 (n8n·flowise 1차 소스 리서치)**: n8n(`LoadNodesAndCredentials`)·flowise(`NodesPool`) 모두 **부팅 시 글로벌 노드 registry 구성(static discovery) + 인스턴스/테넌트 단위 필터링**(`NODES_EXCLUDE`/`NODES_INCLUDE`·`DISABLED_NODES`) 패턴이며 **런타임 동적 코드 로딩은 미채택**(n8n community nodes 도 install+restart, Cloud 는 verified+provenance 게이팅). per-tenant 차등 노드 = "superset 필터" 또는 "테넌트당 별도 인스턴스" 두 가지뿐. ⇒ "유저마다 다른 노드 목록"에 런타임 코드 로딩은 **불필요**하며, **부팅 registry + 필터 뷰(= Option B)** 가 업계 정합 설계. §1.0 제한이 막는 것은 신뢰불가 3rd-party 코드의 런타임 로딩(레이어3)이지 필터 뷰(레이어2)가 아니다.

**추가 지정 (사용자, 2026-06-20)**:

- **노드 격리 단위 = flowise 스타일** — 모노레포 카테고리 디렉토리(`codebase/backend/src/nodes/<category>/<type>/`). **현행이 이미 이 스타일**이라 1st-party 노드는 n8n 식 노드별 npm 패키지 경계로 분리하지 않는다 — 외부 npm 패키지는 3rd-party 커스텀 노드(레이어3)에 한정.
- **샌드박스 = n8n 스타일** — 레이어3 커스텀 노드 실행은 n8n 모델(**out-of-process task-runner/사이드카 격리** + builtin/external 모듈 allowlist[`NODE_FUNCTION_ALLOW_*` 등가] + **credential 을 샌드박스 밖 host 에서 주입**)을 따른다. flowise 의 in-process vm2(`@flowiseai/nodevm` — SSRF/escape/RCE CVE 다발)는 채택 안 함. 기존 `code` 노드 isolated-vm 은 유지하되, 신뢰불가 커스텀 노드엔 프로세스 격리를 상위 적용(별도 격리 정책·리소스 한도 설계 — marketplace Phase D).

**레이어**:

1. **레이어1 — 정적 배열 → DI multi-provider (모듈 격리 + 핫스팟 제거; spec §1.0 메커니즘 sync 만)**. 결합점은 `node-bootstrap.service.ts:2` 의 `import { ALL_NODE_COMPONENTS }` **단 한 줄**. `NODE_COMPONENT` multi-provider 토큰 신설 → 각 카테고리/노드 모듈이 `{ provide: NODE_COMPONENT, useValue: <comp>, multi: true }` 등록(컴포넌트는 평범한 객체라 `useValue` 적합) → `NodeBootstrapService` 가 `@Inject(NODE_COMPONENT) components: NodeComponent[]` 주입(현 `import` 제거). `NodeComponentRegistry.bootstrap(components[], deps)` 와 내부 `Map<type, _>` 은 무변. **노드 추가 = 자기 모듈 provider 1줄, 중앙 배열 편집 0 → 핫스팟 소멸**(경량안 A 의 spread 보다 근본적). **정렬키 명시 필수**: multi-provider 주입 순서(=모듈 import 순서) 의존을 제거하기 위해 `bootstrap`/`listDefinitions` 가 `categories.ts` 의 category `order` + 노드 `order`/`type` 로 정렬 — 기존 "배열 순서 의존"을 암묵→명시로 전환(개선). `ALL_NODE_TYPES`·정의 스냅샷 테스트도 정렬 파생으로 이동.
2. **레이어2 — per-workspace 필터 뷰 (유저마다 다른 노드 목록; 런타임 로딩 불필요)**. chokepoint **2곳 모두 게이트**(n8n 도 팔레트+실행 양쪽 차단): ⓐ **노출** — `GET /api/nodes/definitions`/`listDefinitions()` 는 현재 무필터·workspace 미수신 → `@WorkspaceId()`(동일 컨트롤러 타 엔드포인트가 이미 주입 중) 추가 후 entitled 집합으로 필터. ⓑ **실행/검증** — registry Map 은 full superset 보유라 손편집 JSON 우회 차단 위해 workflow save/validate + 엔진 dispatch 에서도 비-entitled 노드 거부(필수). entitlement 소스는 **신규**(코드에 plan-tier/entitlement 개념 부재 확인) — `NodeEntitlementService(workspaceId) → Set<type>`(MVP: tier→types 정적 맵 + `workspace_enabled_nodes` 테이블). superset 전부 1st-party 신뢰 코드라 코드 격리 불요 — read-time 필터 뷰로 충분.
3. **레이어3 — 진짜 3rd-party 커스텀 노드 (marketplace Phase D; §1.0 제한이 실제로 무는 지점)**. 레이어1 registry 가 seam(`registerDynamic(comp, { workspaceId })` → 같은 Map 에 테넌트 태그, 레이어2 필터가 스코프). 여기부터 Phase D 필요: **n8n 스타일 샌드박스(위 추가 지정)** + Ed25519 서명·검증 + `manifest.json` + **`NodeCategory` DB enum 마이그레이션**(`custom` 미포함 — `node.entity.ts:45`) + 공급망 하드닝(verified/provenance — 2026-01 n8n 공급망 공격[인기 노드 사칭 악성 npm → OAuth 토큰 탈취] 교훈). **install 시 등록(영속)→제어된 reload**, per-execution eval 아님(부팅 registry 불변식 유지).

**옵션 비교** (방향 확정 후):

| 옵션 | 장점 | 단점 / 트레이드오프 | 판정 |
| --- | --- | --- | --- |
| **B. DI multi-provider + per-workspace 필터 (3-레이어)** | 모듈 격리·핫스팟 근본 해소 + 마켓플레이스 per-workspace 노드셋의 정합 seam. n8n/flowise 가 실증한 부팅-registry+필터 표준과 합치. 레이어1 은 spec Rationale 번복 아닌 메커니즘 sync 만 | 레이어2 entitlement 저장소 신규, 실행+노출 양쪽 게이트 필요. 레이어3 은 샌드박스/서명(Phase D)으로 분리 | **채택** |
| A. 카테고리별 배열 spread 합성 (경량안) | spec 무변·단독, 부팅 모델 불변 | 정적 합성일 뿐 모듈 경계 분리·마켓 seam 아님 — 핫스팟만 분산 | 폐기 (B 레이어1 이 상위호환) |
| C. 현상 유지 | 비용 0 | 핫스팟 누적, 마켓 북극성 미진전 | 기각 |

**C-2 Option B 와의 차이 (spec 비용 경량)**: C-2 Option B 는 §4.4 가 명시 *기각*한 대안(`EventEmitter2`/인터페이스)의 재도입이라 `rationale-continuity-checker` Critical. 반면 본 레이어1 은 §1.0 이 정적 배열을 *provisional*(미구현/Planned 미래 명시 예약)로 기술할 뿐 DI 등록을 기각한 바 없어, 필요한 spec 작업은 **등록 메커니즘 기술 갱신**("정적 배열"→"DI 부팅 등록"; "런타임 로딩 경로 없음" 제한은 레이어3 까지 유지)이지 Rationale 번복이 아니다 — consistency-check --spec 통과가 자연스럽다.

- **검증**: (레이어1) 부팅 시 컴포넌트 등록 수(현행 29개) 단언 + `GET /api/nodes/definitions` 스냅샷 + 정렬키 결정성 단언. (레이어2) workspace 별 definitions 필터 + 비-entitled 노드 실행 거부 e2e. (레이어3) Phase D `security-review` 필수.
- **회귀 위험**: (레이어1) 정렬키 누락 시 팔레트/스냅샷 순서 변동 — 명시 정렬로 봉인. (레이어2) 실행 게이트 누락 시 entitlement 우회. (레이어3) 샌드박스 escape·credential 신뢰 경계.
- **spec 갱신**: 레이어1 = §1.0/§4 등록 메커니즘 기술 갱신(planner, consistency-check --spec — Rationale 번복 아님). 레이어2 = 노드 entitlement/필터 신규 절(planner). 레이어3 = §1.0 런타임 로딩 제한 개정 + §5 샌드박스(n8n 모델 명문화) — `marketplace-and-plugin-sdk.md` Phase D 와 한 묶음.

### M-6 [Major] 서비스 계층 `process.env` 직접 접근 32곳

- [x] **완료** (**Option B — 32곳 일괄 단일 PR #660**, 2026-06-21 머지) — 대표: `integration-oauth.service.ts`, `mcp-client.service.ts`, `interaction-token.service.ts`, `llm.service.ts:78`. worktree `m6-service-config-127027`. (상세·잔여 INFO 는 아래 §범위 결정·커밋 참조.)

**범위 결정 (2026-06-21, 코드 전수 대조)**: 2026-06-10 감사의 "32곳"은 미열거이고 트리가 drift 했다. Option B 의 의도("서비스 계층 env 접근을 한 PR 로 ConfigService 중앙화")를 충실히 이행하되 **동작 보존**을 우선해, `registerAs` 4 namespace 로 **클래스/생성자 인스턴스 reads** 를 이전한다. 일부 사이트는 의도적 직접 read 라 **문서화 면제**(플랜 §개선방안3 의 REDIS_* 면제 패턴 확장):

- **이전 대상** (4 namespace):
  - `oauth` ← `integration-oauth.service.ts`: CAFE24_CLIENT_ID/SECRET, 동적 `{GOOGLE,GITHUB}_CLIENT_ID/SECRET`, OAUTH_STUB_MODE 방어 로그, FRONTEND_URL/APP_URL redirect base
  - `interaction` ← `interaction-token.service.ts`: INTERACTION_JWT_SECRET (이미 `interaction.jwtSecret` 참조 중 — namespace 부재로 fallback 만 작동). raw fallback 제거, `?? jwt.secret` 체인 보존 (interaction.jwtSecret 은 기본값 없이 — `?? ''` 금지)
  - `mcp` ← `mcp-client.service.ts`: MCP_MAX_CONCURRENT_CONNECTIONS·MCP_CONNECT_TIMEOUT_MS(생성자) + **MCP_ALLOW_INSECURE_URL** — 사용자 결정(literal Option B)으로 보안 플래그도 이전. 옛 `isInsecureUrlAllowed()` free 함수 → `McpClientService.allowInsecureUrl` getter **단일 source**, `McpToolProvider` 가 주입 mcpClient 경유 공유(call-time→boot-snapshot, deploy 플래그라 무영향, production-guards 부팅 가드 유지)
  - `llm` (확장) ← `llm.service.ts:78`: LLM_STUB_MODE — 사용자 결정(literal Option B)으로 이전. spec `7-llm-client.md §7.1` 리터럴 → ConfigService 표현 동기화(완료), 런타임 flip 단위 테스트 3개 ConfigService mock 재작성
- **문서화 면제** (동작 회귀 방지):
  - `OAUTH_STUB_MODE` honored 판정 헬퍼 `isOAuthStubModeAllowed()`(`common/utils/`) — NODE_ENV-gated cross-module(auth+integration) 단일-source 추상화. **직접 read(integration-oauth 방어 로그)는 이전**, 헬퍼 자체는 유지(M-6 "서비스 계층 직접 read" 범위 밖)
  - 모듈 로드 `const`(`mcp-tool-provider.ts`·`mcp-test-connection.service.ts` 의 MCP_MAX_RESPONSE_BYTES 등 timeout) — import-시 1회 read 의미 변경 위험·노드/probe 레이어
  - `production-guards.ts` (부팅 fail-closed, 플랜이 bootstrap 면제로 분류)
  - 이미 단일-source 추상화된 헬퍼(`getAppBaseUrl`)
  - `NODE_ENV`/`TZ` framework 체크, DIP 주입형(`env: NodeJS.ProcessEnv = process.env`) 기본 파라미터(review W-9)

**하위 체크리스트**:

- [x] `common/config/` 에 `oauth`/`mcp`/`interaction` namespace 신설 + `llm` 확장(stubMode) + barrel·app.module load 등록 (PR commit `b8119f7e`)
- [x] 4 서비스 call-site 이전 (동작 보존) — oauth(integration-oauth) / interaction(interaction-token) / mcp(mcp-client + McpToolProvider insecure-URL 단일 source) / llm(LLM_STUB_MODE). 동적 키·fallback 체인·파싱 규칙 보존
- [x] `.env.example ↔ namespace 키` 대조 테스트(`config-env-coverage.spec.ts`) + 런타임 env-flip 단위 테스트 ConfigService mock 재작성
- [x] TEST WORKFLOW (lint·unit·build·e2e 전부 PASS — 2026-06-21)
- [x] spec-sync: `7-llm-client.md §7.1`(LLM_STUB_MODE)·`14-external-interaction-api.md §8.3`(interaction secret 체인)·`11-mcp-client.md §4.3`(mcp.* namespace) ConfigService 표현 동기화
- [x] `/ai-review` Critical/Warning 0 — 4 사이클 수렴(8W→3W→3W→0W). resolution: `review/code/2026/06/21/{11_04_06,11_34_45,11_59_04}/RESOLUTION.md`, 최종 clean `12_16_46`
- [x] `/consistency-check --impl-done spec/5-system/` **BLOCK:NO** (`review/consistency/2026/06/21/12_17_54/`)

**커밋**: `b8119f7e`(구현)·`4ed3328a`(rev#1)·`cada33a7`(rev#2)·`3e20293b`(rev#3). 잔여 INFO(문서화 nit·FRONTEND_URL app namespace 통일·OAUTH_STUB_MODE 헬퍼 이전·4-integration §5.8 env 표기)는 비차단 후속 후보. **M-6 완료 — 02-architecture 잔여(C-2·M-1~M-5·M-7~M-9·m-1·m-2)는 별도 작업.**

**spec 대조**: D — ConfigService 패턴이 spec 에 모델링된 영역 존재(`4-file-storage.md §2.3` "ConfigService 키: s3.*"), 단 **spec 이 직접 접근을 원문 명시한 곳도 있음**(`7-llm-client.md` "`process.env.LLM_STUB_MODE === 'true'`"). 전역 config 규약 문서는 부재.

**개선 방안**:

1. `common/config/` 에 `registerAs` namespace (`oauth`/`mcp`/`interactionToken`/`llm`) — 기존 `s3.*`·`jwt.secret` 패턴과 동일.
2. 이전 순서: integration-oauth 7곳(M-2 와 동일 PR) → mcp → interaction-token → llm.
3. Nest 밖 스크립트(BullMQ 운영 스크립트의 REDIS_*)는 면제 명시.
4. (선택) backend config 규약 신설 발의 — planner.

**옵션 비교**:

| 옵션 | 장점 | 단점 / 트레이드오프 |
| --- | --- | --- |
| A. `registerAs` namespace 점진 이전 (모듈별 순서, M-2 와 PR 공유) | spec 이 이미 모델링한 패턴(`4-file-storage.md §2.3` "ConfigService 키: s3.*")의 선례 확장 — 전역 규약 신설 없이 진행 가능. 모듈 단위 회귀 격리, `.env.example` 대조 테스트로 키 카탈로그 확보 | `7-llm-client.md` 가 `process.env.LLM_STUB_MODE` 를 원문 명시 — llm 이전 시 spec 동기화(planner) 필요. 완료까지 두 패턴 혼재 |
| B. 32곳 일괄 이전 (단일 PR) | 혼재 기간 없음 | 워커 분리 프로세스의 ConfigModule 로드 전 읽기 등 초기화 시점 회귀가 한 PR 에 집중 — 부팅 실패는 컴파일로 안 잡혀 격리 곤란. spec 원문 명시 지점(LLM_STUB_MODE)까지 한 번에 건드림 |
| C. 보류 | 비용 0 | 환경 키 카탈로그 부재 지속 — 테스트 stub·환경별 검증 곤란, 신규 키마다 직접 접근 재생산 |

**권장**: A — `s3.*`·`jwt.secret` 선례가 있어 규약 신설 없이도 방향이 확정적이고, 초기화 시점 회귀(워커 프로세스)가 항목별로 달라 모듈 단위 점진이 안전하다. spec 이 직접 접근을 원문 명시한 llm 은 마지막 순서로 두고 planner 동기화와 묶는다.

- **검증**: `.env.example` ↔ namespace 키 전수 대조 테스트 + 부팅 스모크.
- **회귀 위험**: ConfigModule 로드 전 초기화 시점 읽기(워커 분리 프로세스).
- **spec 갱신**: `7-llm-client.md` 의 `process.env.LLM_STUB_MODE` 원문은 이전 시 동기화 (planner).

### M-7 [Major] WebsocketGateway — authorizer 도메인 서비스 forwardRef 역참조 (재정의 2026-06-21)

- [x] 완료 (Option A, 2026-06-21) — `websocket.gateway.ts`. **planner 재정의 완료(2026-06-21)**: 원안 "forwardRef 4개 제거" → 코드 실측 반영해 **gateway 서비스-레벨 forwardRef 3개 제거(workflows/kb/background-runs) + authorizer 4개 도메인 모듈 이동(OCP)**; `executionsService`(inbound 8회)·engine·retry forwardRef 와 모듈-레벨 forwardRef(§4.4 순환)는 유지. 상세 아래 **코드 실측·개선 방안(재정의)** + **구현 결과**. worktree `m7-channel-authorizer-inversion`.

**spec 대조**: D — 구독 시 소유권 검증은 `6-websocket-protocol.md §3` 의 spec 의무, 주입 메커니즘은 무언급. §4.4 단일 sink 정책과 비저촉(역방향 의존 제거일 뿐). gateway 에 이미 `channelAuthorizers` 내부 배열 존재 — 인터페이스화의 절반은 완료 상태.

**코드 실측 (2026-06-21, 재정의 — 원안 전제 일부 정정)**: gateway 의 6개 forwardRef 서비스 중 authorizer 에만 쓰이는 건 **3개**(`workflowsService`·`knowledgeBaseService`·`backgroundRunsService`, 각 1회)다. **`executionsService` 는 inbound command 핸들러에서 7회 더 사용**(handleSubscribe snapshot·continueExecution/continueButtonClick/continueAiConversation/endAiConversation·retryLastTurn 의 `verifyOwnership`/`findById`) + authorizer 1회 = **총 8회 → 제거 불가**. `executionEngineService`·`retryTurnService` 도 inbound command(continueX·publishRetryLastTurn 등) 전용이라 유지. 따라서 원안의 "forwardRef 4개 제거"는 **3개 제거(workflows/kb/background-runs)** 로 정정. 또 multi-provider 수집은 WS module 이 도메인 모듈을 import 해야 성립하고 도메인 모듈은 §4.4 emit 때문에 WS 를 import 하므로 **모듈-레벨 forwardRef(순환)는 잔존** — M-7 이 없애는 것은 **gateway 생성자의 서비스-레벨 forwardRef** 와 OCP(신규 채널 = provider 1개) 확보다.

**개선 방안 (재정의)**:

1. `CHANNEL_AUTHORIZER` multi-provider token + `ChannelAuthorizer { matches; authorize }` 인터페이스를 WS 모듈(순환 무관한 token 파일)에 정의.
2. authorizer **4개**(`execution:`·`workflow:`·`kb:`·`background:run:`)를 각 도메인 모듈(executions/workflows/kb/background-runs)의 `{ provide: CHANNEL_AUTHORIZER, useClass, multi: true }` provider 로 이동 — 각 authorizer 는 자기 모듈 서비스를 직접 주입(같은 모듈, forwardRef 불요). `notifications:`(무서비스, userId 비교)는 WS-local provider.
3. gateway 생성자: `@Inject(CHANNEL_AUTHORIZER) channelAuthorizers: ChannelAuthorizer[]` 주입 + 인라인 배열 제거. **서비스-레벨 forwardRef 3개 제거**(workflows·kb·background-runs). `executionsService`(inbound 8회)·`executionEngineService`·`retryTurnService`(inbound)는 유지.
4. WS module: authorizer 수집을 위해 executions/kb/workflows(기존 forwardRef import) + background-runs(forwardRef 추가) import 유지. **모듈-레벨 forwardRef(순환)는 §4.4 단일 sink(도메인→WS emit) 때문에 잔존** — 제거 대상 아님. C-2 클러스터의 gateway 변(역방향 서비스 의존) 감소 효과를 같은 PR 에서 기록.

**옵션 비교**:

| 옵션 | 장점 | 단점 / 트레이드오프 |
| --- | --- | --- |
| A. `CHANNEL_AUTHORIZER` multi-provider token 역전 | §4.4 단일 sink 정책과 비저촉 — 금지된 이벤트 발행 추상화가 아니라 역방향(gateway→도메인) 의존 제거. gateway 에 `channelAuthorizers` 내부 배열이 이미 존재해 인터페이스화의 절반은 완료 상태. 신규 채널 = 해당 모듈의 provider 1개 등록 (gateway 무수정, OCP). C-2 의 2·3번 해소 수단 겸용 | authorizer 등록 순서·미매칭 채널 기본 거부 등 인증 동작 보존 검증 필요 — 구독 검증은 `6-websocket-protocol.md §3` 의 spec 의무라 회귀 시 영향 큼 |
| B. 현행 forwardRef 4개 유지 | 비용 0 — forwardRef 자체는 Nest 표준 패턴 (§4.4 도 안티패턴 아님을 명시) | §4.4 가 옹호하는 것은 엔진→WS 의 sink 방향이지 gateway→도메인 4개 역참조가 아님. 신규 구독 채널마다 gateway 수정 + forwardRef 추가 — C-2 순환의 반대 변이 계속 증식 |

**권장**: A — 주입 메커니즘은 spec 무언급(D 판정)이고 단일 sink 정책과도 무관하므로 spec 갱신 없이 진행 가능하다. 내부 배열이 이미 존재해 변경 폭이 작고, C-2 클러스터(gateway 변·KB gateway 의존)의 해소 수단을 겸하므로 투자 대비 효과가 가장 크다. 구독 실패 ack 계약(spec §3 원문) 보존만 e2e 로 고정하면 된다.

- **검증**: 구독 실패 ack 계약 보존(`subscribed` ack 에 `success:false` + 평문 error — spec §3 원문) + WS e2e. inbound command 경로(continueX·retryLastTurn 의 `executionsService.verifyOwnership`)가 유지됨도 함께 확인.
- **회귀 위험**: authorizer 등록 순서·미매칭 채널 기본 거부 + **Nest DI 초기화 순서(부팅 실패는 컴파일 미검출 — e2e 부팅 스모크로 봉인)**. 채널 prefix 매칭은 상호 배타라 집계 순서 무관(단 동일 prefix 중복 금지).
- **spec 갱신**: 불요(주입 메커니즘 spec 무언급). executions/engine/retry inbound forwardRef 유지는 §4.4 와 정합.

**구현 결과 (2026-06-21)**:

- **신설**: `common/utils/uuid.ts`(`isValidUuid` — gateway 로컬 함수 승격, authorizer 공유), `websocket/channel-authorizer.ts`(`ChannelAuthorizer` 인터페이스 + `ChannelAuthorizerContext` + `CHANNEL_AUTHORIZER` 토큰 — 모듈 의존 없는 순수 token 파일로 순환 무유발). authorizer 5개: `executions/execution-channel-authorizer.ts`·`executions/background-runs/background-run-channel-authorizer.ts`·`workflows/workflow-channel-authorizer.ts`·`knowledge-base/kb-channel-authorizer.ts`(도메인 모듈 소유) + `websocket/notifications-channel-authorizer.ts`(WS-local).
- **gateway**: 인라인 `channelAuthorizers` 배열 + `isValidUuid`/`UUID_PATTERN` 로컬 + 서비스 forwardRef 3개(workflows/kb/background-runs) + 해당 import 제거. `@Inject(CHANNEL_AUTHORIZER) channelAuthorizers: ChannelAuthorizer[]` 주입으로 대체. `handleSubscribe` 의 `find((a) => a.matches(channel))` 로직·ack 계약 무변.
- **집계 방식 (multi-provider → useFactory)**: 원안의 `{ provide: CHANNEL_AUTHORIZER, useClass/useExisting, multi: true }` 는 **본 환경 NestJS 11 에서 배열로 집계되지 않고 last-write-wins(useClass/useValue/useExisting 3종 모두 재현)** — probe 로 확인. 따라서 WS 모듈에서 **`useFactory` 명시 집계**(`(...authorizers) => authorizers` + `inject:` 5개)로 전환. 각 authorizer 는 자기 도메인 모듈이 provider 로 소유·**클래스 export**, WS 모듈 factory 가 inject. 도메인 소유·gateway 역참조 제거·OCP(gateway·handleSubscribe 무수정) 는 동일 달성. 신규 채널 추가 시 편집 지점은 "도메인 모듈 authorizer+export" + "WS factory inject 한 줄"(원안 multi 의 도메인-only 1지점 대비 1지점 추가 — multi 미지원의 수용 비용).
- **테스트**: 기존 `websocket.gateway.spec.ts`(49) 를 실 authorizer 클래스 + useFactory wiring 으로 갱신(DI 역전 + 인가 동작 동시 검증, 서비스 mock 위). authorizer 5종 도메인-로컬 단위 spec 신설(matches/authorize 경계 — UUID 가드·소유 검증 throw·notifications userId 비교 fail-closed). TEST WORKFLOW: lint·build·unit(40 suites)·**e2e 205 PASS(DI 부팅 스모크 — useFactory 집계가 WS↔도메인 forwardRef 순환 넘어 정상 부팅 확인)**.

**리뷰·정합 (2026-06-21)**:

- `/ai-review`(2 사이클, `--commit HEAD` — stale 로컬 main 오염 회피): ① `15_56_59` LOW/Critical 0/Warning 6 → resolution: W-1(Kb UUID 선차단 가드, 동작 보존)·W-5(fail-closed 기본 거부)·W-6(authorizer 개수 assertion) **FIXED**, W-2/W-3/W-4 근거와 함께 **DEFER**(pre-existing 또는 maintainability nit). ② resolution 후 fresh `16_16_49` LOW/Critical 0/Warning 3 — 전부 prior-DEFER 계승 또는 plan 명시 의도(모듈-레벨 순환). RESOLUTION.md 양 세션 기록.
- `/consistency-check --impl-done spec/5-system/6-websocket-protocol.md` (`16_29_03`): **BLOCK: NO**. WARNING 2건(내 주석 태그)은 즉시 수정 — `W-6` 태그(코드베이스 전역 "sub-workflow 격리" 의미와 충돌)를 서술형으로, `refactor M-7` → `refactor 02 M-7`(완료된 `04 M-7` MCP 와 구분) 일괄.
- **project-planner 후속(비차단 SPEC-DRIFT)**: ① spec §3.3 `kb:` 행에 "(비-UUID 선차단)" 추가(sibling 채널 패턴 확장), ② §3.3 fail-closed(매칭 authorizer 없는 valid 채널 = 기본 거부) 정책 명시, ③ §3.2 표에 `background:run:{id}` 행 추가(기존 drift, M-7 이전), ④ frontmatter `code:` 에 신규 파일 등록, ⑤ Rationale 에 M-7 DI 역전 결정(M-6 "배열 추가 확장" → 역전) 기록. impl ⊇ spec 라 비차단.

### M-8 [Major] `trigger-detail-drawer.tsx` 1,604줄 god-component + API 직접 호출 8곳

- [x] 완료 (단계 분할 — API 레이어 → god-component 파일분리)
  - [x] **1단계 — `lib/api/triggers.ts` API 레이어** (직접 호출 제거 + m-2 차단 해제). `lib/api/executions.ts` 관례로 §3 API 표 **전체** typed 카탈로그 신설: `list`/`getById`/`getHistory`/`create`/`update`(단일 PATCH R-4)/`delete`/`rotateNotificationSecret`/`revokeInteractionToken`/`rotateBotToken`(R-CC-10) + 타입(`TriggerDetail`·`ChatChannelConfigView`·`TriggerListItem`·`TriggerUpdateBody`·`CreateTriggerBody`). 트리거 `apiClient` 직접 호출 **13곳 전부** 이전: `trigger-detail-drawer.tsx`(8) + `triggers/page.tsx`(m-2 triggers: list·toggle·create) + `trigger-delete-dialog.tsx`(delete) + `trigger-history-dialog.tsx`(getHistory). 컴포넌트 구조·렌더·권한 게이트 무변(behavior-preserving) — public surface(`TriggerDetailDrawer`/dialogs + apiClient) 보존으로 기존 테스트 무수정 통과 + 신규 `lib/api/__tests__/triggers.test.ts`(16 tests: URL/verb/params·getById 4-way·rotate/revoke 이중 언래핑·getHistory 정규화). 검증: lint·build·unit·e2e(214) PASS, `/consistency-check --impl-prep` BLOCK:NO(`review/consistency/2026/06/23/07_55_57/`). 잔여 cross-domain(비대상): `page.tsx` `/workflows`(m-2 workflows 트랙) + `auth-config-select.tsx` `/auth-configs`(auth 트랙). PR: branch `claude/refactor-m8-trigger-drawer`.
  - [x] **2단계 — god-component 파일 분리 + hooks**. `trigger-detail-drawer.tsx` **1,537→65줄**(thin wrapper: SlideDrawer + 조건부 카드 조립만). `cards/` 5파일 분리: `overview-card.tsx`(`OverviewCard`+`TYPE_BADGE_STYLES`)·`schedule-config-card.tsx`·`webhook-config-card.tsx`·`external-interaction-card.tsx`·`chat-channel-card.tsx`(+`ChatChannelEditForm`·`RotateBotTokenModal`·헬퍼·`DEFAULT_RATE_LIMIT_PER_MINUTE` private). `hooks/` 2파일: `use-trigger.ts`(useQuery+invalidate 데이터층)·`use-card-edit-toggle.ts`(편집 토글 4 카드 공유, onReset 콜백으로 버퍼 원복 보존). **동작 보존**: JSX·i18n 키·className·`useHasRole` 게이트·`triggersApi`·mutation/toast/SecretRevealBox verbatim — public surface 보존으로 기존 테스트 무수정 통과(5 suites·54 tests). 검증: lint·**패키지 빌드(next/nest)**·unit PASS / `--impl-prep` BLOCK:NO(`review/consistency/2026/06/23/09_47_27/`). **e2e·docker-image-build 는 환경 블록**(docker 레지스트리 base 이미지 메타데이터 fetch DeadlineExceeded — 세션 후반 daemon degradation, frontend 파일이동과 직교; CI/회복 후 재실행). PR: branch `claude/refactor-m8-2-trigger-cards`.
    - **유의(유지)**: 현행 **5카드**(auth 가 WebhookConfigCard 병합) behavior-preserving 유지 — plan 의 6카드(`AuthConfigCard` 분리)는 UI 구조 변경이라 별도 결정(planner/UX, impl-prep W-1). `hmacSecret` rotate UI 추가 금지(R-2 폐기, R-14 단일경로).
    - **후속(별건, M-8 외)**: 페이지 god-component(`triggers/page.tsx` 폼 상태) `useCreateTriggerForm`+Create Dialog 추출 / 뷰모델 매핑 `lib/mappers` / `TriggerDetail`→`TriggerDetailView` 개칭 / envelope `unwrap` 헬퍼 통일 / delete-dialog `onDeleted?` 콜백.

**spec 대조**: B — `2-trigger-list.md` 는 행위·필드 권한 매트릭스만 규정. spec §2.3.1 의 카드 단위 매트릭스가 분리의 자연 경계를 이미 제공.

**개선 방안**:

1. `lib/api/triggers.ts` 신설 — §3 API 표 + rotate-bot-token 의 typed wrapper (`lib/api/executions.ts` 패턴).
2. §2.3.1 카드 경계대로 분리: `TriggerOverviewCard`/`WebhookConfigCard`/`AuthConfigCard`/`ChatChannelCard`/`EiaNotificationCard`/`ScheduleCard` + 공용 `useCardEditToggle`.
3. fetch/mutation 은 `useTrigger(id)` custom hook.
4. m-2 의 `triggers/page.tsx` 와 같은 PR.

**옵션 비교**:

| 옵션 | 장점 | 단점 / 트레이드오프 |
| --- | --- | --- |
| A. API 레이어 + §2.3.1 카드 경계 분리 전체 (개선 방안 1~4) | 분리 경계를 spec §2.3.1 카드 단위 권한 매트릭스가 이미 제공 — 자의적 분할 아님, 카드별 e2e 가 spec 매트릭스와 1:1. `lib/api/triggers.ts` 는 기존 `lib/api/executions.ts` 관례 답습 + m-2 선행 요건 충족 | 6개 카드 + hook 동시 분리 — 카드별 PATCH 단일 경로(R-4)·권한 매트릭스 회귀 검증 폭이 큼 |
| B. `lib/api/triggers.ts` 만 우선 (컴포넌트 분리는 후속 PR) | 최소 비용으로 API 직접 호출 8곳 제거 + m-2 차단 해제 | 1,604줄 god-component 잔존 — 권한 매트릭스·read-only 배지 회귀 표면 그대로 |
| C. 보류 | 비용 0 | API 호출 산재로 m-2 의 `triggers/page.tsx` 이전도 차단 — frontend api 계층 정리 전체가 지연 |

**권장**: A — spec 이 카드 경계라는 자연 분할선을 이미 규정하고 있어 분리의 설계 비용이 낮고, B 로 쪼개면 PR 2회에 걸쳐 같은 파일을 재방문하게 된다. 검증 부담은 카드 단위 e2e(R-16/R-14/rotate 차단)가 spec 매트릭스와 1:1 대응이라 오히려 체계적이다.

- **검증**: 드로어 e2e (R-16 read-only 배지, R-14 AuthConfig 셀렉터, rotate 차단 400).
- **회귀 위험**: 카드별 PATCH 단일 경로(R-4)·권한 매트릭스.
- **spec 갱신**: 불요.

### M-9 [Major] `extractRetryAfterMs` 유틸이 `llm.service.ts` 에 위치

- [x] 완료 (Option A) — `shared/utils/retry-after.ts` 이동(+ 테스트 describe 이동), re-export 없음. import 4곳 교체(llm.service 내부·ai-turn-orchestrator·information-extractor·text-classifier). TEST WORKFLOW(lint·unit·build·e2e 205) PASS · `/ai-review` Critical 0(Warning 1 = 범위 밖 기존 god-method, RESOLUTION 문서화) · `/consistency-check --impl-done` **BLOCK:NO**. 후속 후보: `isLlmRateLimit` 동종 이동(INFO). worktree `m9-retry-after-util`.

**spec 대조**: B — `node-output.md §3.2.1` 은 `retryAfterSec` 의미·invariant 만 규정, 물리 위치 무언급. **선례 존재**: 같은 사유로 `sanitizeLastErrorMessage` 가 이미 `shared/utils/` 이동 완료.

**개선 방안**:

1. `shared/utils/retry-after.ts` 신설 + 해당 unit test describe 분리 이동.
2. import 4곳 교체.
3. llm.service 에 re-export 두지 않음 (재발 차단 목적).

**옵션 비교**:

| 옵션 | 장점 | 단점 / 트레이드오프 |
| --- | --- | --- |
| A. `shared/utils/retry-after.ts` 이동 (re-export 없이) | `sanitizeLastErrorMessage` 가 같은 사유로 이미 `shared/utils/` 이동 완료 — 선례와 일관. 물리 위치는 spec 무언급(B 판정)이라 spec 무변. re-export 미제공으로 llm.service 경유 import 재발 차단, 누락은 컴파일 에러로 즉시 검출 | import 4곳 일괄 교체 필요 — 사실상 기계적 작업 |
| B. 현행 유지 | 비용 0 | retry-after 만 필요한 소비자가 llm 모듈을 import 지속 — `sanitizeLastErrorMessage` 선례와 비일관, 동종 유틸의 위치 규칙이 이원화 |

**권장**: A — 동일 사유의 선례(`sanitizeLastErrorMessage`)가 이미 착지해 있어 일관성 측면에서 사실상 결정된 방향이고, 회귀 위험이 "사실상 없음" 수준이라 보류(B)의 비용 절감 효과가 없다.

- **검증**: unit + build.
- **회귀 위험**: 사실상 없음.
- **spec 갱신**: 불요.

## Minor

### m-1 [Minor] `IntegrationsController.previewTest` — registry 검증을 controller 가 수행

- [x] 완료 (Option A) — `IntegrationsService.validateServiceAuthType()`(private guard) 로 일원화(기존 `validateServiceAndAuth` 중복 통합 — `create()`/`previewTest()` 공유), `previewTest` 가 dispatch 전 호출. controller 의 인라인 `findVariant` 검증 + `findVariant`·`BadRequestException` import 제거(레이어 정렬). 미지원 조합 `INTEGRATION_INVALID_SERVICE` 400 불변 + service 단위 테스트(create/previewTest 경계 케이스). TEST WORKFLOW(lint·unit·build·e2e 205) PASS · `/ai-review` 3사이클 수렴 Critical/**Warning 0** · `/consistency-check --impl-done` **BLOCK:NO**. worktree `m1-integrations-validate-authtype`.

  **planner 후속 (spec drift, 이전부터 존재 — m-1 이 신설한 것 아님)**:
  - [ ] `INTEGRATION_INVALID_SERVICE (400)` 를 `spec/2-navigation/4-integration.md §9.4` + `spec/conventions/error-codes.md` 에 등재
  - [ ] `spec/2-navigation/4-integration.md §9.2` preview-test 요청 바디 `service` → `serviceType` (DTO 정합)

**spec 대조**: B — preview-test 행위만 spec 규정. **부수 발견**: 에러 코드 `INTEGRATION_INVALID_SERVICE` 가 `error-codes.md` 미등재.

**개선 방안**:

1. `IntegrationsService.validateServiceAuthType()` 신설 — 동일 `BadRequestException` 보존.
2. 사용처 교체 + controller 의 `findVariant` import 제거.
3. (부수) `INTEGRATION_INVALID_SERVICE` 의 error-codes.md 등재를 planner 에 확인 요청.

**옵션 비교**:

| 옵션 | 장점 | 단점 / 트레이드오프 |
| --- | --- | --- |
| A. `IntegrationsService.validateServiceAuthType()` 로 이전 | C-3 과 동일 방향의 레이어 정렬 — controller 의 도메인 registry(`findVariant`) 직접 의존 제거. 에러 shape(400 코드·메시지) 보존으로 위험 낮음, 소규모라 단독 처리 부담 없음 | 부수 발견(`INTEGRATION_INVALID_SERVICE` error-codes.md 미등재)은 planner 확인이 별도 필요 — 코드 이전과 독립 트랙 |
| B. 보류 | Minor 등급 — 단독 실익 작음, 비용 0 | controller 의 도메인 검증 침범 패턴 잔존 — C-3 정렬 후에도 같은 패턴이 남아 비일관 |

**권장**: A — C-3 과 같은 레이어 침범 패턴이라 함께 정렬해야 코드베이스 규칙이 일관되고, 에러 shape 보존만 지키면 무위험에 가깝다. 에러 코드 등재 확인(planner)은 병행 트랙으로 분리해 코드 이전을 막지 않는다.

- **검증**: preview-test unit(400 코드·메시지 불변).
- **회귀 위험**: 낮음.
- **spec 갱신**: 에러 코드 등재 검토 (planner).

### m-2 [Minor] frontend 다수 페이지의 apiClient 직접 호출

- [x] 완료 — statistics/triggers/schedules/dashboard 페이지 도메인 호출 전부 `lib/api/*` 이전
  - [x] **triggers** — `triggers/page.tsx` 의 trigger 호출(list·toggle·create)을 `lib/api/triggers.ts`(M-8 1단계 산출)로 이전.
  - [x] **statistics / schedules / dashboard** — `lib/api/{statistics,schedules,dashboard}.ts` 신설(`executions.ts` 관례, 타입 카탈로그 SoT) + 페이지 이전. 사용자 결정으로 **3페이지 1 PR**(plan 의 페이지별 PR 권장과 다름 — Minor·기계적·각 페이지 테스트 회귀 격리). dashboard 3 GET / statistics 7(+export blob, `unwrap`=`extractData` 동치) / schedules paginated+CRUD+run-now. 신규 wrapper 유닛 테스트(dashboard 4·statistics 5·schedules 8). behavior-preserving — 기존 페이지 테스트(statistics 4·schedules 9) 무수정 통과. 검증: lint·패키지빌드(next/nest)·unit·vitest 30 PASS, `--impl-prep` BLOCK:NO. **e2e·docker-image-build 환경블록**(docker 레지스트리 base 이미지 메타데이터 fetch DeadlineExceeded — frontend 변경과 직교; CI/회복 후 재실행). PR: branch `claude/refactor-m2-page-api`.
  - **잔여(비대상, cross-domain)**: statistics·schedules·triggers 페이지의 `/workflows` 직접 호출은 workflows 도메인 → 별도 **workflows 트랙**(`lib/api/workflows.ts` 활용). ESLint `app/**/page.tsx` apiClient 금지 규칙(plan §4)은 전 페이지 이전 완료 후 후속.

**spec 대조**: B — frontend api 계층 규약 부재, 기존 `lib/api/*` 는 코드베이스 관례.

**개선 방안**:

1. `lib/api/triggers.ts`(M-8 에서 생성) → `triggers/page.tsx` 이전.
2. `lib/api/statistics.ts`/`schedules.ts`/`dashboard.ts` 신설 — 각 spec 의 API 표를 함수 카탈로그 SoT 로.
3. 페이지별 1 PR 점진 이전.
4. (선택) ESLint 로 `app/**/page.tsx` 의 apiClient 직접 import 금지.

**옵션 비교**:

| 옵션 | 장점 | 단점 / 트레이드오프 |
| --- | --- | --- |
| A. 페이지별 점진 이전 (M-8 산출물 재사용, ESLint 는 완료 후 후속) | 기존 `lib/api/*` 코드베이스 관례 답습 — 규약 신설 불요. 각 spec 의 API 표를 함수 카탈로그 SoT 로 활용, 페이지별 PR 로 에러 처리·query param 직렬화 미세 차이 회귀 격리 | 이전 완료까지 직접 호출·wrapper 두 패턴 혼재 — 신규 페이지가 구패턴 복제할 여지 |
| B. A + ESLint 금지 규칙 즉시 도입 | 신규 직접 호출 재발을 기계적으로 차단 | 미이전 페이지 전부에 일괄 예외(disable) 필요 — 이전 완료 전 도입 시 noise 가 신호를 가림 |
| C. 보류 | 비용 0 | API 호출 형태가 페이지마다 발산 지속 — Minor 지만 M-8 과 같은 god-component 화의 재료 |

**권장**: A — frontend api 계층은 spec 규약이 아닌 코드베이스 관례(B 판정)라 점진 이전이 비용·위험 균형상 적절하다. ESLint 강제(B)는 전 페이지 이전이 끝난 시점에 재발 방지 장치로 추가하는 것이 noise 없이 효과적이다.

- **검증**: 페이지별 e2e/스냅샷.
- **회귀 위험**: 에러 처리·query param 직렬화 미세 차이.
- **spec 갱신**: 불요.

### m-3 [Minor] 엔진 내 `ALL_NODE_COMPONENTS` 직접 bootstrap — nodes 레이어 의존 역전

- [x] 완료 (PR1 `claude/engine-split-s1-nodebootstrap`, = C-1 step1) — bootstrap 분리 + `WORKFLOW_EXECUTOR` 토큰화. 상세: [c1-engine-split.md](./c1-engine-split.md).

**spec 대조**: D — bootstrap 주체(`NodeComponentRegistry`)는 spec 명시, **호출 위치는 무언급** — 이동은 구현 재량. 난점은 `handlerDeps.build(this)` 가 엔진 자신(WorkflowExecutor 역)을 요구하는 것 — spec 이 이미 정의한 `WorkflowExecutor` 계약을 DI token 화하면 자연 해소 (C-1 의 내부 통신과 달리 **여기는 그 계약의 정확한 용처**).

**개선 방안**:

1. `WORKFLOW_EXECUTOR` token — 엔진 모듈이 `useExisting: ExecutionEngineService` 바인딩.
2. **execution-engine 모듈**에 `NodeBootstrapService`(`OnModuleInit`) — bootstrap 호출 이관, deps 는 token 주입. (배치 정정: bootstrap 은 nodes 카탈로그 + 엔진 deps[`NodeHandlerDependenciesProvider` 가 `ExecutionEventEmitter`·`ConversationThreadService` 집약] 를 잇는 브리지 — nodes/core 거주 시 nodes→engine 순환 발생 → 엔진 모듈이 유일 무순환 경로. 레이어 위반은 god-class **서비스**에서 카탈로그 import 제거로 달성, 모듈 배치는 차선. PR2 EngineDriver 도입 시 재평가.)
3. 엔진의 import(:55)·`registerHandlers()`(:2718) 제거 → `nodes.module.ts:12` forwardRef 해소 확인.
4. C-1 로드맵 중 **최우선 실행** (M-5 배열 형태 변경과는 분리 — 본 건은 spec 무변).

**옵션 비교**:

| 옵션 | 장점 | 단점 / 트레이드오프 |
| --- | --- | --- |
| A. `WORKFLOW_EXECUTOR` token + `NodeBootstrapService` 즉시 단독 진행 | spec 이 이미 정의한 `WorkflowExecutor`(engine↔노드) 계약의 **정확한 용처**에 token 화 — C-1 의 내부 통신 재사용(과적)과 달리 계약 의미 그대로. bootstrap 호출 위치는 spec 무언급(구현 재량)이라 spec 무변. `nodes.module.ts` forwardRef 해소 + C-1 1단계 선행 완료 | OnModuleInit 시점이 dispatch 보다 늦는 race 가능 — 순서 단언 테스트로 고정 필요 |
| B. C-1 전체 분할 작업에 합류해 일괄 처리 | PR 수 절약 | 독립적·소규모 항목을 Critical 대형 작업에 묶어 착수가 지연됨 — C-1 로드맵 자체가 본 건을 "가장 먼저" 로 명시해 묶을 실익 없음 |
| C. 보류 | 비용 0 | nodes→engine 의존 역전 미해소 — 엔진이 nodes 레이어를 직접 import 하는 레이어 위반 지속, C-1 착수의 선행 정리도 미뤄짐 |

**권장**: A — `WorkflowExecutor` 는 spec 이 engine↔노드 계약으로 정의한 인터페이스라 여기서의 DI token 화는 계약 의미를 정확히 따르는 사용이고(C-1 의 내부 통신 건과 구별), spec 무변·소규모·독립이라 즉시 착수 조건이 모두 충족된다. race 위험은 OnModuleInit 순서 단언 테스트 1개로 봉인 가능하다.

- **검증**: 부팅 시 핸들러 25종 등록 unit + e2e 스모크.
- **회귀 위험**: bootstrap 시점이 dispatch 보다 늦는 race — OnModuleInit 순서 단언 테스트.
- **spec 갱신**: 불요.
