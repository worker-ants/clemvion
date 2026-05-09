# AI Review Deferred Items — 후속 PR 백로그

## 배경

ai-review `2026-05-06_17-27-43` 에서 발견된 51건 중 본 PR (Phase 1 quality + 후속 조치) 에서 처리하지 못한 23건의 후속 처리 백로그. 자세한 내용은 `review/2026-05-06_17-27-43/SUMMARY.md` + `RESOLUTION.md`.

## 현재 상태 (2026-05-09 v2 갱신)

PR-B (`execution_node_log` append-only 테이블 + Redis pub/sub continuation bus) 로 WARN #2 + WARN #15 처리 → 21건 잔여.

**2026-05-09 v2 재검증 결과**, plan 문서와 실제 코드 상태가 다수 불일치하여 21건을 다음과 같이 재분류한다:

- **이미 완료/N/A**: 4건 (백로그에서 제거)
- **위치/카운트 stale**: 3건 (라인 갱신)
- **execution-engine 범위 외**: 2건 (백로그에서 제거)
- **사용자 결정 반영**: 4건 (CRIT #3 / WARN #4 / WARN #16 / WARN #17)
- **그대로 유효 (실행 대상)**: 17건

총 **17건** 이 9개 PR 로 분할된다. 본 재분류의 메타 plan 은 `~/.claude/plans/plan-in-progress-ai-review-deferred-ite-lexical-raccoon.md`.

### PR-B (완료) — archive

`execution_node_log` append-only 테이블 + Redis pub/sub continuation bus 로 분산 환경 대응 (commits `954dc9c4`, `ebf934e1`, `cd235002`). PR-B 자체 ai-review (`2026-05-09_00-05-34`) 후속 25/35건은 `e360ca0a` 로 처리. 본 plan 의 23건 백로그와 별개 흐름.

상세 설계 기록은 `spec/5-system/4-execution-engine.md §9` + commit diff 로 대체.

---

## 재분류 결과

### A. 이미 완료/N/A — 백로그에서 제거 (4건)

| 항목 | 상태 | 위치 |
|------|------|------|
| WARN #12 (planContainerBody filter 캐시) | ✅ 이미 적용 — `bodyEntryNodeIds`/`internalEdges`/`outgoingEdgeMap` 전부 `ContainerBodyPlan` 에 미리 캐시. `runContainer` 가 1회만 호출 후 모든 iteration 재사용 | service.ts L3285-3394, L4076 |
| INFO #11 (executeInline finally drain) | ✅ PR-B 로 자연 해소 — `executionPathChain` 자체가 `execution_node_log` 테이블로 이행되어 drain 개념 사라짐 | — |
| INFO #4 (EngineRuntimeContext 분리) | ✅ 현 컨벤션 충분 — `_executedNodes` `_` prefix + JSDoc internal 마커. 별도 인터페이스 분리 불필요 | interface.ts L89 |
| INFO #16 (Partial<Node> factory) | ✅ 현 패턴 충분 — 인라인 `Partial<Node>[]` 가 보일러플레이트 적고 가독성 양호 | spec.ts 다수 |

### B. execution-engine 범위 외 — 백로그에서 제거 (2건)

| 항목 | 위치 | 조치 |
|------|------|-----|
| INFO #6, #7 (Side Effect — `ragThreshold`/`getSources`) | RAG/KB 모듈 (execution-engine 외) | 제거. 필요 시 RAG 백로그로 이동 |
| INFO #2, #3, #4 (Performance — `indexOf`/`[...messages]`/`turnDebugHistory` 스프레드) | service.ts 에서 위치 확인 불가 (다른 파일이거나 중간 commit 에 흡수) | 제거. 후속 review 시 재발견되면 추가 |

### C. 위치/카운트 stale — 본 문서 라인 갱신 (3건)

| 항목 | 이전 진술 | 실제 |
|------|---------|------|
| WARN #25 waitForAiConversation | L1804-2166, ~363줄 | **L1817-2185, 369줄** |
| WARN #24 setTimeout 6곳 | L2996, 3128, 3479, 3831, 3959, 4094 | **L3037, 3169, 3520, 3872, 4000, 4135** (6곳 동일 — drift만) |
| INFO #15 `(service as any)['contextService']` | 3곳 (L295, 1239, 1307) | **2곳 (L1747, L1814)** — 1곳 자연 제거 |

### D. 사용자 결정 (4건)

#### CRIT #3 — Self-registering Node Type Metadata (시나리오 D + B)

원안 (Strategy 패턴) 의 트레이드오프 분석 후 **시나리오 D 채택**: NodeHandler 인터페이스에 `metadata: NodeTypeMetadata` 필수 필드 추가, 각 핸들러가 자체 선언, registry 가 부팅 시 인덱스 구성.

**핵심 설계** (PR-G 에서 구현):
```ts
// backend/src/nodes/core/node-type-metadata.ts (신규)
export type NodeTypeMetadata =
  | { readonly kind: 'standard' }
  | { readonly kind: 'container' }                // foreach, loop, map
  | { readonly kind: 'background' }               // background
  | { readonly kind: 'parallel' }                 // parallel (env-flag 결합)
  | { readonly kind: 'blocking'; readonly interaction: 'form' | 'buttons' | 'ai_conversation' }
  | { readonly kind: 'trigger' };                 // manual_trigger
```

- `NodeHandler.metadata` **필수 필드** — 27 핸들러 모두 명시 (`standard` 도 생략 불가). TS 컴파일이 누락 차단 → drift 위험 0.
- `NodeHandlerRegistry.onApplicationBootstrap()` 에서 metadata 인덱스 + 정합성 검증 (kind 별 executor 주입 / type unique). 위반 시 부팅 단계 throw.
- 외부 npm 패키지 노드도 동일 인터페이스 구현 시 자동 등록 — **플러그인 친화** 비전 호환.
- 엔진 dispatch 21곳 중 14곳 (`container 9` + `background 3` + `blocking-form 2`) 을 metadata flag 분기로 통합. 잔여 7곳 (template/manual_trigger/parallel-nested-reject 등) 은 enum 치환 (WARN #26 흡수).
- 시나리오 A (Full Strategy with `executionRole`) 는 spec 의 distinct-algorithm 입장과 충돌 + 핸들러 레이어 역전으로 **부적합** 판정.

**메모리 주의**: NestJS onModuleInit 순서 의존 금지. registry 초기화는 `onApplicationBootstrap` 사용.

#### WARN #4 — DataSource.transaction() 래핑

`updateExecutionStatus` + 인접 NodeExecution save 를 `dataSource.transaction()` 으로 묶음. 영향 경로 ~10곳 전수 검토 후 PR-A 에서 처리. spec `4-execution-engine.md §1.1` 에 atomicity 보장 한 줄 추가.

상태 전이 진입점:
- `service.ts L4187-4194` (`updateExecutionStatus`)
- RUNNING → WAITING_FOR_INPUT: L1585, L1737, L1843, L2172, L2194, L2248
- WAITING_FOR_INPUT → RUNNING: L1138, L1460, L2496

#### WARN #16 — Drop (forwardRef 정상 패턴)

`forwardRef(() => WebsocketService)` 는 정상 NestJS 패턴. 14 call site 변경 부담 대비 이득 적음. 본 백로그에서 제거. PR-B-doc 에서 `spec/5-system/4-execution-engine.md §6` (또는 신규 Architecture Notes) 에 "WebsocketService 가 canonical event sink — 추가 추상화 도입하지 않음" 한 줄 박스화.

#### WARN #17 — manual_trigger only 명시 (assertion + spec 박스)

`executeInline` 진입 trigger 노드가 `manual_trigger` 가 아니면 명시적 throw. PR-F 에서 코드 + spec `4-nodes/2-flow/1-workflow.md` 에 박스 추가.

---

## 남은 작업 — 17건

### P0 — Security / Correctness

- ~~**CRIT #5 (timeout 경로 테스트)** — `executeSync` 의 timeout 분기 테스트. graph traversal hang 셋업 필요. (PR-A)~~ ✅ 완료
- ~~**WARN #4** — RUNNING ↔ WAITING_FOR_INPUT 상태 전이 트랜잭션. (PR-A, 위 D 결정)~~ ✅ 완료

### P1 — Architecture / Maintainability (큰 리팩토링)

- ~~**CRIT #2** — `runExecution` (L1129-1536) / `executeInline` (L602-977) 그래프 순회 로직 공통 추출. 안전한 추출은 며칠 작업급. (PR-I)~~ ✅ 부분 완료 — 3개 helper 추출: `buildEdgeIndexes` (back/outgoing/incoming map 빌드), `seedInitialReachability` (trigger-first / explicit-entry seed), `handleDisabledNode` (SKIPPED 처리). ~80줄 중복 제거. **잔여 의도된 분기**: trigger pass-through (executeInline only), parallel-v1 dispatch (runExecution only), 외부 try/catch + 상태 머신 전이 (runExecution only) — 의미 차이 보존
- ~~**CRIT #3** — Self-registering NodeTypeMetadata 도입 + dispatch flag 통합. (PR-G, 위 D 결정)~~ ✅ 완료 — `NodeTypeMetadata` discriminated union 신설, 27 핸들러 모두 `executionMetadata: { kind: ... }` 명시 (TS 컴파일 강제), dispatch 14 사이트가 metadata flag 분기로 통합, registry bootstrap `assertConsistency` 검증
- ~~**WARN #25** — `waitForAiConversation` 분해 (`emitAiWaitingForInput` / `handleAiTurn` / `handleAiEnd` / `finalizeAiNode`). **L1817-2185, 369줄**. PR-C 의 endAi 테스트가 회귀 안전망. (PR-H)~~ ✅ 완료 — 369줄 → orchestrator (85줄) + 4 sub-methods (95/164/41/66줄). 322 tests pass (회귀 0)
- ~~**WARN #26** — 매직 스트링 → enum/상수. PR-G 에 흡수 (시나리오 B 분과).~~ ✅ 완료 — `NODE_TYPES` 상수 (template, manual_trigger) + metadata flag 분기로 21 사이트 중 14곳 dispatch 통합 + 7곳 enum 치환

### P2 — Testing / Performance 모더레이트

- ~~**WARN #21** — `endAiConversation` 종료 흐름 전체 테스트 (큰 fixture). service.ts L1935-2100+. (PR-C)~~ ✅ 완료 — e2e endAi 테스트 (waiting → endAiConversation → handler.endMultiTurnConversation → NODE_COMPLETED + EXECUTION_COMPLETED)
- ~~**WARN #22** — `buildConversationConfigFromOutput` 단위 테스트. service.ts L267-304. (PR-C)~~ ✅ 완료 — 7건 (defaults / message+turnCount / system 필터 / maxTurns / partial 3 필드 / undefined / missing partial)
- ~~**WARN #24** — container runtime `setTimeout(r, 200)` → `flushPromises()` 통일. **6곳 잔존** (spec.ts L3037, 3169, 3520, 3872, 4000, 4135). (PR-C)~~ ✅ 완료 — 6곳 모두 `flushPromises()` 로 교체

### P3 — INFO

- **INFO #1, #2** — NodeHandler return 타입 단일화 (`Promise<NodeHandlerOutput>`). (PR-G 흡수) — ⏸ PR-G 에서 deferred. 현재 union 타입 (`Promise<NodeHandlerOutput> | Promise<unknown>`) 은 production 에서 `adaptHandlerReturn` 가 strict 검증 (handler-output.adapter.ts), 테스트는 bare 반환 허용. 단일화 시 spec.ts 의 ~16 fixture 가 영향받아 별도 PR 권장
- ~~**INFO #5** — `adaptHandlerReturn` credential runtime 마스킹. handler-output.adapter.ts L33-67. (PR-E)~~ ✅ 완료 — 기존 `maskSensitiveFields` 유틸 재사용 + 마스킹 단위 테스트 2건
- ~~**INFO #6** — `executeContainerBody` `new Map(allNodes.map(...))` 재생성 매번. service.ts L3166. (PR-D)~~ ✅ 완료 — `ContainerBodyPlan.nodeMap` 캐시
- ~~**INFO #7** — `executeNode` nodeContext 3 spreads. service.ts L2604, 2616, 2625. (PR-D)~~ ✅ 완료 — 단일 spread 병합
- ~~**INFO #8** — `executeInline` debug log O(N) 매 노드 실행. service.ts L689-693. (PR-D)~~ ✅ 완료 — `logger.debug` 로 다운그레이드
- ~~**INFO #9** — parallel branch `nodeOutputCache`/`structuredOutputCache` 공유 참조. parallel-executor.ts L68-75. (PR-E)~~ ✅ 완료 — top-level shallow copy (값 객체는 공유 유지로 메모리 cost 회피, invariant 주석 명시)
- ~~**INFO #10** — `resolveHasDefaultLlmConfigCached` 공유 cache (브랜치별 분리 부재). service.ts L2867-2879. (PR-E)~~ ✅ 완료 — instance Map (executionId:workspaceId 키, single-flight Promise) + runExecution finally cleanup
- ~~**INFO #12** — JSDoc 보강 (`executeNode` L2504, `NodeHandler` interface.ts L146, `ExecutionEngineService`). (PR-F)~~ ✅ 완료
- **INFO #14** — mockHandler legacy shape (`{ processed: true, input }`). spec.ts L131-134. (PR-C) — ⏸ 보류 (16+ usages 의존, 동작은 adapter 가 wrap. 별도 PR 권장 — high blast radius vs zero functional gain)
- ~~**INFO #15** — `(service as any)['contextService']` 패턴. **2곳** (spec.ts L1747, L1814). (PR-C)~~ ✅ 완료 — `as unknown as { contextService: ... }` 형태로 통일
- ~~**INFO #17** — executeInline trigger pass-through (위 D-WARN#17 과 동일 영역). (PR-F)~~ ✅ 완료 — WARN #17 assertion 과 동시 처리 (`INVALID_SUB_WORKFLOW_TRIGGER` throw + 회귀 테스트 2건)
- ~~**INFO #19** — `executeSync()` `findOneBy` 재조회 (savedExecution in-memory 활용). service.ts L1035, L1059. (PR-D)~~ ✅ 완료 — success path SELECT 제거 (catch path 의 TOCTOU 방어 SELECT 는 유지)

---

## PR 분할

| PR | 범위 | 항목 | 규모 | spec |
|----|-----|-----|------|------|
| ~~**PR-A** (P0 Security)~~ ✅ | 상태 전이 트랜잭션 + timeout 테스트 | WARN #4 + CRIT #5 (timeout) | 완료 | spec §1.1 atomicity |
| ~~**PR-B-doc** (Spec 정리)~~ ✅ | WARN #16 / #17 결정 박스화 | spec only | 완료 | spec §4.4 + spec/4-nodes/2-flow/1-workflow.md |
| ~~**PR-C** (Testing 보강)~~ ✅ | endAi/buildConfig 단위 테스트 + setTimeout 일관화 + (service as any) 제거. INFO #14 (mockHandler shape) 는 high blast radius 로 별도 PR 권장 | WARN #21, #22, #24 + INFO #15 (#14 보류) | 완료 | — |
| ~~**PR-D** (Perf small)~~ ✅ | nodeMap 재생성, nodeContext spread, debug log gating, executeSync findOneBy in-memory | INFO #6, #7, #8, #19 | 완료 | — |
| ~~**PR-E** (Concurrency)~~ ✅ | parallel branch cache 격리, LLM config 캐시 분리, adaptHandlerReturn credential mask | INFO #9, #10, #5 | 완료 | — |
| ~~**PR-F** (Docs + assertion)~~ ✅ | executeNode/NodeHandler/ExecutionEngineService JSDoc + WARN #17 manual_trigger assertion | INFO #12, #17 + WARN #17 코드 | 완료 | — |
| ~~**PR-G** (Self-register metadata + enum)~~ ✅ | NodeTypeMetadata discriminated union + 27 핸들러 metadata 명시 + registry bootstrap 인덱스/검증 + 14곳 dispatch flag 통합 + 7곳 enum 치환 (return type 단일화는 deferred) | CRIT #3 + WARN #26 (INFO #1, #2 deferred) | 완료 | — |
| ~~**PR-H** (waitForAiConversation 분해)~~ ✅ | `emitAiWaitingForInput`/`handleAiMessageTurn`/`handleAiEndConversation`/`finalizeAiNode` 추출 | WARN #25 | 완료 | — |
| ~~**PR-I** (Engine 리팩토링)~~ ✅ | 3 helper 추출 (buildEdgeIndexes / seedInitialReachability / handleDisabledNode) — ~80줄 중복 제거. 잔여 분기 (trigger / parallel-v1 / 외부 state machine) 는 의미 차이로 보존 | CRIT #2 (부분) | 완료 (incremental) | — |

총 9개 PR, 약 16일.

### 의존성

- **PR-G → PR-I**: catalog 가 graph 추출보다 먼저 (dispatch metadata 가 정착돼야 추출 안전)
- **PR-C → PR-H**: endAi 테스트가 분해 회귀 안전망
- PR-A / PR-B-doc / PR-D / PR-E / PR-F 는 독립적으로 병행 가능

### 권장 순서

PR-B-doc → PR-A → PR-D → PR-C → PR-E → PR-F → PR-G → PR-H → PR-I

가장 작고 위험 적은 것부터 → 큰 리팩토링은 후반.

---

## 검증

각 PR 별 표준 검증:

- `cd backend && npm run lint && npm run test && npm run build` — green
- 신규 테스트 추가 시 spec 의 새 케이스 1+ 건 (ai-review CRIT/WARN 의 회귀 케이스)
- PR-A: `executions.controller` 통합 테스트로 transaction rollback 시나리오 검증
- PR-B-doc: spec 변경만 → diff review
- PR-C: `npm run test -- execution-engine.service.spec` 의 endAiConversation describe 신규
- PR-G: TS 컴파일이 metadata 필수 필드 누락 차단 (drift 차단 1차 방어선). 부팅 시 정합성 unit test (kind 별 executor 주입 / type unique) 가 2차 방어선
- PR-H/I: 기존 4216줄 service.ts 의 모든 spec.ts 케이스 (167 suite, 2700+ test) 가 그대로 통과
- 매 PR 후 본 plan 의 해당 행 제거 + 모든 항목 처리 시 `git mv` 로 `plan/complete/` 이동

---

## Final Status (2026-05-09 v2 — 9개 PR 일괄 진행)

**모든 PR (B-doc / A / D / C / E / F / G / H / I) 단일 세션에서 완료.**

| 검증 | 결과 |
|------|------|
| Test suites | 15 passed |
| Tests | 322 passed (2026-05-09 시점 기준) |
| Build | green |
| Lint | green |

### 처리 완료 항목 (15건)

- CRIT #2 ✅ (부분 — 3 helper 추출, 의도된 분기 보존)
- CRIT #3 ✅ (시나리오 D — Self-registering NodeTypeMetadata)
- CRIT #5 (timeout) ✅
- WARN #4 ✅ (DataSource.transaction)
- WARN #21 ✅ (endAi e2e)
- WARN #22 ✅ (buildConversationConfigFromOutput 단위 7건)
- WARN #24 ✅ (flushPromises 일관화 6곳)
- WARN #25 ✅ (waitForAi 369줄 → 4 sub-method)
- WARN #26 ✅ (PR-G 에 흡수 — NODE_TYPES 상수 + metadata flag 분기)
- INFO #5 ✅ (credential mask)
- INFO #6, #7, #8 ✅ (perf small)
- INFO #9, #10 ✅ (concurrency cache 격리)
- INFO #12 ✅ (JSDoc)
- INFO #15 ✅ ((service as any) 통일)
- INFO #19 ✅ (executeSync findOneBy)
- WARN #16 박스화 ✅ + WARN #17 spec 박스화 + 코드 assertion ✅

### Deferred (보류 — 별도 PR 권장)

- **INFO #1, #2** (NodeHandler return type 단일화) — high blast radius (spec.ts ~16 fixture 영향). 별도 PR 로 mockHandler 정규 shape 변경과 함께 일괄 처리 권장.
- **INFO #14** (mockHandler legacy shape) — 위 INFO #1,#2 와 함께 묶음 처리 권장.

### 본 plan 의 위치

두 deferred 항목 (INFO #1+#2, INFO #14) 은 `plan/in-progress/handler-return-type-unification.md` 로 이관 완료 (2026-05-09). 본 plan 은 archive 로 `plan/complete/` 이동.
