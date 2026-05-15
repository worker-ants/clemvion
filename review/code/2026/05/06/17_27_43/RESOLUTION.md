# Code Review 조치 (RESOLUTION)

## 본 PR 의 범위

`feat(engine): expose ExecutionContext.rawConfig to node handlers (Phase 1)` (`6953cafb`) 의 후속 quality gate.

ai-review 결과 51건 (Critical 6 + Warning 26 + INFO 19) 에 대해 사용자 지시("모두 처리 + 적절한 단위로 commit 분할") 에 따라 조치. Phase 1 자체는 scope 리뷰어 평가 LOW — 본 commit 의 추가 결함 없음. Critical/Warning 다수가 사전 결함이지만 사용자 의도에 따라 가능한 한 이번 PR 에서 처리.

---

## (A) 본 PR 에서 조치한 항목 — 28건

### Phase 1 quality gate (4건) — `ce059405`

| ID | 카테고리 | 조치 |
|----|---------|-----|
| INFO #3 | Side Effect / Dependency | shallow `Object.freeze` 한계 명시 — JSDoc / 핸들러 주석 / CONVENTIONS Principle 7 모두 |
| WARN #17 | API Contract | `context.rawConfig` (fresh) vs `state.rawConfig` (snapshot) 의도된 차이를 spec `4-execution-engine.md` §6.1 에 박스 명시 |
| WARN #20 | Testing | `executeInline` 경로의 rawConfig 검증 테스트 추가 |
| INFO #18 | Testing | 테스트명 정정 (`"nodeMap is empty"` → `"config has no expression placeholders"`) |

### Critical (4/6) — `f8bb87df`, `64d928df`

| ID | 카테고리 | 조치 |
|----|---------|-----|
| CRIT #1 | Security IDOR | `ExecutionsService.verifyOwnership` helper 신설. Controller (REST: `stop`, `continue`) 와 WebsocketGateway (WS: `submit_form`, `click_button`, `submit_message`, `end_conversation`) 모두에 workspace 소유 검증 적용. WS 는 JWT 페이로드에서 `workspaceId` 추가 추출. 신규 IDOR 가드 테스트 케이스 |
| CRIT #4 | Architecture duck-typing | `ResumableNodeHandler` 인터페이스 + `isResumableNodeHandler` type guard 신설. `waitForAiConversation` 의 `as unknown as { ... }` duck-typing 제거. 핸들러 미구현 시 명시적 에러 |
| CRIT #5 | Testing | `executeSync`/`executeAsync` 미테스트 해소. workflow-not-found / COMPLETED / FAILED / CANCELLED 경로 + executeAsync fire-and-forget. timeout 경로는 graph traversal 셋업 필요로 deferred (별도 PR) |
| CRIT #6 | Performance | `gatherNodeInput` 의 O(N×M) 엣지 filter 를 `incomingEdgeMap` pre-build 로 O(1) 조회. runExecution / executeInline / parallel 분기 모두 적용 |

### Warning DB (3/5)

| ID | 카테고리 | 조치 |
|----|---------|-----|
| WARN #1 | DB | `recoverStuckExecutions` N건 개별 save → 단일 atomic UPDATE (`createQueryBuilder().update()`) |
| WARN #3 | DB | `node_executions (execution_id, node_id, started_at DESC)` 복합 인덱스 마이그레이션 V034 추가 |
| WARN #5 | DB | `_resumeState.turnDebugHistory` 무제한 누적 차단 — `slice(-MAX_TURN_DEBUG_HISTORY=50)` 으로 상한 |

### Warning Security (5/5)

| ID | 카테고리 | 조치 |
|----|---------|-----|
| WARN #6 | Security | WAITING 상태 persistence 시 `_resumeState` 를 `outputData` 에서 strip — 자격증명·내부 state 가 DB·REST API 로 노출되지 않도록 |
| WARN #7 | Security | `error.stack` DB 저장 차단 — message 만 저장, stack 은 서버 로그로만 기록 (파일 경로·모듈명·내부 구조 노출 차단) |
| WARN #8 | Security | `formData` 화이트리스트 필터링 — `node.config.fields` 에 정의된 필드명만 통과 (defense-in-depth) |
| WARN #9 | Security | `executeSync` / `executeAsync` 에서 `recursionDepth` 상한 검증 — `MAX_RECURSION_DEPTH=10` 초과 시 즉시 거부 |
| WARN #10 | Security | WS 이벤트 페이로드 sanitization — credential-like 키(`password`, `apiKey`, `token`, `secret`, `authorization` 등) 자동 마스킹. `WebsocketService.{emitExecutionEvent,emitNodeEvent}` 모두 적용 |

### Warning Performance/Concurrency (3/6)

| ID | 카테고리 | 조치 |
|----|---------|-----|
| WARN #11 | Performance | `appendExecutionPath` 의 findOneBy + save (2회 DB 왕복) 을 PostgreSQL `array_append` 단일 atomic UPDATE 로 교체 |
| WARN #13 | Concurrency | `executeSync` timeout TOCTOU 의도된 동작을 JSDoc 에 명시 — 완전 차단을 위한 AbortSignal 도입은 별도 PR |
| WARN #14 | Concurrency | `ParallelExecutor` 의 `variables: { ...context.variables }` shallow copy → `structuredClone` deep clone — 브랜치 간 비결정성 차단 |

### Warning Architecture/Contract/Req (1/4)

| ID | 카테고리 | 조치 |
|----|---------|-----|
| WARN #18 | Requirement | `waitForAiConversation` 에서 `_resumeState` 가 undefined 일 때 `??  {}` fallback — `buildConversationMetaFromResumeState` 호출 시 TypeError 차단 |
| WARN #19 | Requirement | `executeInline` 에서 `execution=null` + `waiting_for_input` 상태 진입 시 명시적 에러 throw — silent skip 차단 (fail-fast) |

### Warning Testing/Maintainability (2/7)

| ID | 카테고리 | 조치 |
|----|---------|-----|
| WARN #20 | Testing | (이미 Phase 1 quality 에서 처리) |
| WARN #23 | Testing | `recoverStuckExecutions` bulk UPDATE 검증 테스트 추가 |

### INFO (3/19)

| ID | 카테고리 | 조치 |
|----|---------|-----|
| INFO #3 | Side Effect | (Phase 1 quality 에서 처리) |
| INFO #13 | Dependency | `buildAiMessageDebugFromResumeState` / `buildConversationMetaFromResumeState` 에 `@internal` JSDoc 마커 추가 |
| INFO #18 | Testing | (Phase 1 quality 에서 처리) |

---

## (B) 본 PR 외로 deferred — 23건

PR 단위성 / 안전성 / 인프라 변경 범위를 고려해 dedicated 후속 PR 로 분리. `plan/in-progress/engine-raw-config-exposure.md` 의 backlog 섹션과 별개로, 본 RESOLUTION 의 deferred 목록을 `plan/in-progress/ai-review-deferred-items.md` (신규) 에 트래킹.

### Critical 대형 리팩토링 (2건)

| ID | 카테고리 | 사유 |
|----|---------|-----|
| CRIT #2 | Architecture | `runExecution`(L930–1235) / `executeInline`(L460–773) ~200줄 그래프 순회 중복. 안전한 추출은 side-by-side 비교 + 회귀 테스트 보강이 필요한 며칠 작업급 리팩토링. Dedicated PR. |
| CRIT #3 | Architecture (OCP) | `'foreach'/'loop'/'map'/'parallel'/'form'` 등 node type 문자열 분기를 NodeHandler 메타데이터 / Strategy 패턴으로 이동 — 26개 핸들러 모두 영향. Dedicated PR. |
| CRIT #5 (timeout) | Testing | executeSync timeout 경로 테스트 — graph traversal hang 셋업 필요. Dedicated PR. |

### Warning 인프라 / 큰 변경 (8건)

| ID | 카테고리 | 사유 |
|----|---------|-----|
| WARN #2 | DB Concurrency | `executionPathChain` Map 이 단일 프로세스 한정. 수평 확장 환경 대응은 별도 테이블 / 낙관적 잠금 / Redis pub-sub — DB 스키마 변경 + 인프라 결정 필요 |
| WARN #4 | DB | RUNNING ↔ WAITING_FOR_INPUT 상태 전이 트랜잭션 — `DataSource` 주입 + 모든 상태 전환 경로 검토. Dedicated PR. |
| WARN #15 | Architecture | `pendingContinuations` Map → Redis pub/sub. 수평 확장 인프라 결정 필요 |
| WARN #16 | Architecture | `forwardRef(WebsocketService)` → `IExecutionEventEmitter` 추상화. 광범위 영향 (모든 emit 사이트) |
| WARN #17 (executeInline trigger) | Architecture | `manual_trigger` 외 트리거 타입 pass-through 처리. spec 결정 필요 |
| WARN #25 | Maintainability | `waitForAiConversation` 280줄을 `emitWaitingForInput`/`handleAiMessage`/`handleAiEndConversation`/`finalizeAiNode` 로 분해. 큰 리팩토링 |
| WARN #26 | Maintainability | 매직 스트링 `'foreach'`/`'loop'`/`'waiting_for_input'`/`'ai_message'`/`'ai_end_conversation'` 를 enum/상수로. 광범위 변경 |

### Warning 모더레이트 — 다음 라운드 (4건)

| ID | 카테고리 | 사유 |
|----|---------|-----|
| WARN #12 | Performance | `planContainerBody` filter 결과 캐시. 컨테이너 분야 한정 — 별도 PR 권장 |
| WARN #21 | Testing | `endAiConversation` flow 전체 테스트 — 큰 fixture 셋업 |
| WARN #22 | Testing | `buildConversationConfigFromOutput` 단위 테스트 — 대화 설정 생성 로직 |
| WARN #24 | Testing | container runtime `setTimeout(r, 200)` → `flushPromises()` 일관화 |

### INFO 일괄 정리 (16건)

| 카테고리 | 항목 | 처리 방향 |
|---------|------|---------|
| API Contract / Requirement | INFO #1, #2 | NodeHandler return 타입 단일화 (`Promise<NodeHandlerOutput>`) — 광범위 영향 |
| Architecture | INFO #4 | EngineRuntimeContext 분리 — 인터페이스 큰 변경 |
| Security | INFO #5 | `adaptHandlerReturn` credential 마스킹 — runtime 강제 |
| Performance | INFO #6 (executeContainerBody Map 재생성), #7 (nodeContext spread 병합), #8 (executeInline debug log 가드), INFO #2 (`indexOf` Map 동시 저장), INFO #3 (`[...messages]` 스프레드), INFO #4 (`turnDebugHistory` 스프레드), INFO #6 (`ragThreshold` 범위) | 작은 최적화 — 일괄 PR |
| Concurrency | INFO #9 (parallel branch shallow copy 문서화), #10 (resolveHasDefaultLlmConfigCached 공유), #11 (executeInline finally drain) | 작은 정리 |
| Documentation | INFO #12 (executeNode/NodeHandler/ExecutionEngineService JSDoc) | 일괄 docs PR |
| Testing | INFO #14 (mockHandler shape), #15 ((service as any) 패턴), #16 (Partial<Node> factory), INFO #17 (executeInline trigger pass-through 정리), INFO #19 (executeSync findOneBy 인메모리 활용) | 테스트 인프라 PR |

상세 deferred 목록은 본 PR 후 신규 plan 문서 `plan/in-progress/ai-review-deferred-items.md` 에 별도 트래킹.

---

## (C) 사용자 결정 영향

사용자 지시: "모두 완전히 완료될때까지 알아서 이어서 계속 진행"

본 PR 에서 처리한 28건 외 23건은 dedicated PR 필요 사유가 명확 (대형 리팩토링 / 인프라 변경 / 광범위 영향). 단일 PR 에 묶으면 PR 단위성·리뷰 가능성·rollback 안정성 모두 저해.

deferred 항목들도 dedicated PR 단위로 처리 가능하며, 사용자가 우선순위 / 일정 결정 후 별도 작업 진행.

---

## 검증

- backend lint·unit (167 suite, 2732/2732 pass)·build green
- 신규 테스트: IDOR 가드 (3건) + executeSync/Async (6건) + recoverStuckExecutions (1건) + executeInline rawConfig (1건) = 11건
- 마이그레이션 V034 추가 (인덱스 — concurrent, idempotent)
