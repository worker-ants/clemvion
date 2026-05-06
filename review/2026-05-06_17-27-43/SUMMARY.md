파일 쓰기 권한을 요청합니다. 허용해 주시면 `review/2026-05-06_17-27-43/SUMMARY.md`에 저장하겠습니다. 먼저 보고서 내용을 출력합니다.

---

# Code Review 통합 보고서

> 대상 커밋: `6953cafb` feat(engine): expose ExecutionContext.rawConfig to node handlers (Phase 1)
> 리뷰 일시: 2026-05-06

## 전체 위험도

**HIGH** — 보안(IDOR), 아키텍처(God Object·OCP 위반), 성능(O(N×M) 엣지 스캔), 테스트(주요 public API 미검증) 영역에서 복수의 HIGH/CRITICAL 발견사항이 존재한다. `rawConfig` Phase 1 변경 자체는 LOW 위험이지만, 서비스 전반의 구조적 부채가 누적되어 있다.

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | `continueExecution` / `continueButtonClick` / `continueAiConversation` / `cancelWaitingExecution`에 소유권 검증이 없어 다른 사용자의 실행을 재개·취소·조작하는 IDOR가 가능하다 | `service.ts` L1504, 1516, 1528, 1542 | 서비스 레이어에서 `executionId → workspaceId/userId` 매핑 검증을 수행하거나, NestJS Guard에서 소유권 확인을 강제 |
| 2 | Architecture / Maintainability | `runExecution`(L930–1235)과 `executeInline`(L460–773)이 그래프 순회 로직(backEdgeMap·outgoingEdgeMap·while 루프·컨테이너 디스패치·blocking 분기) 약 200줄을 거의 동일하게 중복 구현한다. 한쪽에만 버그 수정이 적용되는 구조적 위험이 매우 높다 | `service.ts` L460–1235 | 공통 순회 로직을 `executeGraph()` private 메서드로 추출하고, 두 메서드는 DB 세팅만 담당하도록 분리 |
| 3 | Architecture | `'foreach'` / `'loop'` / `'map'` / `'parallel'` / `'form'` 등 노드 타입 문자열 분기가 `runExecution`과 `executeInline` 양쪽에 중복 존재한다(OCP 위반). 새 특수 노드 추가 시 엔진 코드를 반드시 수정해야 한다 | `service.ts` L1102–1137, L614–684 | `NodeHandler` 인터페이스에 `executionRole?` 메타데이터를 추가하거나 Strategy 패턴을 도입해 타입 문자열 분기를 제거 |
| 4 | Architecture | `waitForAiConversation`이 `NodeHandler` 인터페이스에 없는 `endMultiTurnConversation`을 `as unknown as` duck-typing으로 호출한다. 핸들러가 해당 메서드를 구현하지 않으면 런타임 에러 | `service.ts` L1678–1688 | `ResumableNodeHandler extends NodeHandler` 서브인터페이스에 해당 메서드를 추가하고 `'endMultiTurnConversation' in handler` 가드로 narrowing 후 호출 |
| 5 | Testing | `executeSync()`와 `executeAsync()`가 완전히 미테스트 상태다. Sub-Workflow 핸들러가 직접 호출하는 public API로 timeout 경쟁·상태 전파·에러 처리 등 고유 로직을 포함한다 | `service.ts` L779–909 | workflow-not-found·FAILED/CANCELLED 상태 전파·timeout 경로 테스트 추가 |
| 6 | Performance | `gatherNodeInput`이 매 노드 실행마다 전체 엣지 배열을 `filter(targetNodeId === nodeId)`로 선형 탐색한다. 노드 N개·엣지 M개일 때 O(N×M). `outgoingEdgeMap`은 사전 구축하면서 `incomingEdgeMap`은 없다 | `service.ts` L2645 | `runExecution`·`executeInline` 시작 시 `incomingEdgeMap`을 한 번 구축하고 `gatherNodeInput`에 주입 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Database | `recoverStuckExecutions()`가 `for...of` 루프에서 `save(execution)`을 개별 호출한다. N건이면 트랜잭션 없이 N회 UPDATE가 실행되어 루프 도중 서버 재기동 시 부분 복구로 DB 정합성이 깨진다 | `service.ts` L339–360 | `DataSource.transaction()`으로 묶거나 단일 벌크 UPDATE 쿼리로 교체 |
| 2 | Database | `appendExecutionPath()`의 `executionPathChain` Map이 단일 프로세스 내에서만 직렬화를 보장한다. 수평 확장 환경에서 서로 다른 서버가 동일 `executionId`에 동시 read-modify-write 시 데이터 손실 | `service.ts` L1317–1340 | 별도 테이블로 분리하여 `INSERT`로 원자적 추가, 또는 낙관적 잠금 + 재시도 적용 |
| 3 | Database | `findOne({ where: { executionId, nodeId }, order: { startedAt: 'DESC' } })` 패턴이 3곳에서 사용되나 `(execution_id, node_id, started_at DESC)` 복합 인덱스가 없다 | `service.ts` L1391, 1608, 1950 | 마이그레이션에 해당 복합 인덱스 추가 |
| 4 | Database | RUNNING ↔ WAITING_FOR_INPUT 상태 전이가 트랜잭션 없이 순차 저장된다. 중간 서버 종료 시 `Execution`과 `NodeExecution` 상태 불일치 | `service.ts` L1374–2213 | 상태 전이 묶음을 `DataSource.transaction()`으로 래핑 |
| 5 | Database | AI 대화 노드의 `_resumeState.turnDebugHistory`가 매 turn마다 `LlmCallRecord[]`를 누적한다. 전체 LLM 요청·응답 포함 시 `outputData` 컬럼이 수십 MB까지 증가 | `service.ts` L1720–1737 | DB 저장 시 최대 N개로 슬라이스하거나 오브젝트 스토리지로 오프로드 |
| 6 | Security | `waitForAiConversation`이 WAITING 상태에서 `resumeState`(rawConfig 포함)를 `nodeExec.outputData`에 저장한다. 노드 config에 하드코딩 자격증명이 있으면 DB·REST API를 통해 노출된다 | `service.ts` L1591, 1618–1621 | 저장 전 `_resumeState`를 제거하거나 credential-like 필드를 strip 처리 |
| 7 | Security | 실행 실패 시 `stack` 필드를 DB에 저장한다. REST API 조회 시 파일 경로·모듈명·버전 정보가 클라이언트에 노출될 수 있다 | `service.ts` L1282–1285 | DB에는 스택을 저장하지 않고 서버 전용 로그에만 기록 |
| 8 | Security | `continueExecution(executionId, formData)`가 `formData`에 유효성 검사 없이 파이프라인으로 흘려보낸다 | `service.ts` L1504–1511, 1428–1434 | `waitForFormSubmission`에서 `node.config.fields` 스키마로 `formData`를 검증 |
| 9 | Security | `executeSync()`·`executeAsync()` 진입점에서 `options.recursionDepth` 상한을 검증하지 않는다 | `service.ts` L779, L877 | `MAX_RECURSION_DEPTH`와 비교하여 초과 시 즉시 거부 |
| 10 | Security | `NODE_STARTED`/`NODE_COMPLETED` WebSocket 이벤트에 노드 전체 입출력 데이터가 포함된다. 출력에 자격증명이 담길 경우 WS 구독자 전원에게 노출 | `service.ts` L2248–2251, L2390 | WS 이벤트에 credential-like 키(apiKey, token, password, secret) 자동 마스킹 sanitizer 적용 |
| 11 | Performance | `appendExecutionPath()`가 노드 실행 완료마다 `findOneBy` + `save` 2회 DB 왕복을 발생시킨다. 10노드 워크플로에서 20회 | `service.ts` L1317–1339 | PostgreSQL `array_append` 네이티브 쿼리로 단일 UPDATE 교체, 또는 실행 종료 시 1회만 flush |
| 12 | Performance | `planContainerBody`에서 `allEdges.filter(...)` 호출이 최소 3회이며 ForEach/Loop/Map 노드 실행마다 반복된다 | `service.ts` L2974–3083 | `planContainerBody` 결과를 `runContainer` 시작에서 1회 계산하고 모든 반복에서 재사용 |
| 13 | Concurrency | `executeSync`의 타임아웃 분기 후 `runExecution`이 백그라운드에서 계속 실행된다. FAILED 마킹 후 `runExecution`이 COMPLETED를 기록하면 DB 상태가 불일치한다 | `service.ts` L800–870 | `runExecution`에 취소 토큰(AbortSignal)을 주입하거나 TOCTOU 허용 여부를 문서화 |
| 14 | Concurrency | `ParallelExecutor` 브랜치 컨텍스트에서 `variables: { ...context.variables }` shallow copy만 수행한다. 중첩 객체를 두 브랜치가 `await` 경계를 넘나들며 쓰면 비결정적 last-write-wins 결과가 된다 | `parallel-executor.ts` L68–73 | `structuredClone(context.variables)` 사용 |
| 15 | Architecture | `pendingContinuations`가 인스턴스 메모리에 저장되어 수평 확장 환경에서 재개 요청이 다른 인스턴스로 라우팅될 경우 No-op이 된다 | `service.ts` L278–285 | Redis pub/sub 또는 BullMQ event reply 패턴으로 교체. 단일 인스턴스 전제를 아키텍처 문서에 명시 |
| 16 | Architecture | `@Inject(forwardRef(() => WebsocketService))`는 순환 의존성 신호다 | `service.ts` L314 | 이벤트 발행을 `IExecutionEventEmitter` 인터페이스로 추상화하거나 NestJS `EventEmitter2`를 사용 |
| 17 | API Contract | 멀티턴 재개 시 `context.rawConfig`는 최신 DB config를 읽지만 `state.rawConfig`는 첫 `waiting_for_input` 진입 시점 스냅샷이다. 워크플로 편집 시 두 값이 달라진다 | `service.ts` L1590–1591, 2327 | 의도된 설계라면 spec에 명시. 아니라면 재개 시 `context.rawConfig`를 `state.rawConfig`에서 복원 |
| 18 | Requirement | `waitForAiConversation`에서 `_resumeState`가 `undefined`일 때 L1646의 `buildConversationMetaFromResumeState(resumeState)` 호출이 `TypeError`를 발생시킨다 | `service.ts` L1583, L1646 | `resumeState ?? {}` 기본값 적용, 또는 파라미터를 `undefined` 허용 타입으로 변경 |
| 19 | Requirement | `executeInline`에서 `executionRepository.findOneBy`가 null을 반환하면 Form/Button/AI 블로킹 노드가 경고 없이 통과된다 | `service.ts` L705 | null이면 명시적 에러를 throw 하거나 블로킹 노드 감지 시 별도 guard 추가 |
| 20 | Testing | `rawConfig`가 `executeInline` 경로에서도 올바르게 주입되는지 검증하는 테스트가 없다 | `spec.ts` ENG-RC-* 블록 | `executeInline` describe 블록에 `captureSpy` 패턴을 재사용한 `rawConfig` 검증 케이스 추가 |
| 21 | Testing | `endAiConversation()` 호출 후 `endMultiTurnConversation()` → `ended` port 종료 전체 흐름이 미테스트 상태다 | `service.ts` L1559–1566 | 대화 종료 시나리오 및 `EXECUTION_COMPLETED` emit 테스트 추가 |
| 22 | Testing | `buildConversationConfigFromOutput`이 완전 미테스트 상태다. system 메시지 필터링·`partial` 필드 선택적 전파 등 비자명한 로직을 포함한다 | `service.ts` L217–254 | 단위 테스트 추가 |
| 23 | Testing | `recoverStuckExecutions()`가 미테스트 상태다 | `service.ts` L337–359 | WAITING_FOR_INPUT → FAILED 전환을 검증하는 테스트 추가 |
| 24 | Testing | Container runtime 테스트 2곳이 `setTimeout(r, 200)` 타이밍에 의존하며 나머지 테스트의 `flushPromises()` 패턴과 일관성이 없다 | `spec.ts` L2529, L2661 | `flushPromises()`로 교체 |
| 25 | Maintainability | `waitForAiConversation`이 ~280줄 단일 메서드로 상태 전이·DB 저장·WS 이벤트·multi-turn 루프·terminal/waiting 분기·구조화 출력 캐시를 모두 처리한다 | `service.ts` L1573–1901 | `emitWaitingForInput`, `handleAiMessage`, `handleAiEndConversation`, `finalizeAiNode` 등으로 분해 |
| 26 | Maintainability | `'foreach'`, `'loop'`, `'waiting_for_input'`, `'ai_message'`, `'ai_end_conversation'` 등 매직 스트링이 두 실행 경로에 걸쳐 반복된다 | `service.ts` 전반 | `NODE_TYPES`, `INTERACTION_TYPES` 상수 객체 또는 `enum`으로 관리 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | API Contract | `ExecutionContext.rawConfig`가 `?` optional이지만 런타임에는 엔진이 항상 주입한다. `structuredOutputCache`(L26)에도 동일 패턴이 반복되어 핸들러 작성자에게 혼란을 준다 | `interface.ts` L26, L48 | `EngineInjectedContext`와 `HandlerVisibleContext`를 구분하거나 테스트 헬퍼 factory를 제공 |
| 2 | API Contract / Requirement | `NodeHandler.execute` 반환 타입이 `Promise<NodeHandlerOutput> \| Promise<unknown>`으로 사실상 `Promise<unknown>`과 동치다. 신규 핸들러가 잘못된 shape를 반환해도 컴파일 에러가 없다 | `interface.ts` L119–123 | `Promise<NodeHandlerOutput>` 단일 타입으로 변경하고 레거시 핸들러는 `LegacyNodeHandler`로 분리 |
| 3 | Side Effect / Dependency | `Object.freeze({ ...(node.config ?? {}) })`가 shallow freeze만 적용하여 중첩 객체는 핸들러에서 변이 가능하다 | `service.ts` L2327, L1591 | JSDoc 및 CONVENTIONS에 "shallow freeze — 중첩 객체는 불변이 아님" 명시. 완전한 불변이 필요하다면 `structuredClone` 사용 |
| 4 | Architecture | `ExecutionContext._executedNodes`·`structuredOutputCache` 등 엔진 내부 런타임 상태가 핸들러 인터페이스에 혼재한다 | `interface.ts` L26, L60 | `EngineRuntimeContext extends ExecutionContext` 도입으로 내부 필드 분리 |
| 5 | Security | `NodeHandlerOutput.config` JSDoc에 "Credential material MUST be stripped"가 명시되어 있으나 런타임 강제 메커니즘이 없다 | `interface.ts` L72 | `adaptHandlerReturn` 처리 시점에 sensitive 키 자동 마스킹 로직 추가 |
| 6 | Performance | `executeContainerBody`가 매 호출마다 `new Map(allNodes.map(...))` 재생성. ForEach 1,000 아이템이면 1,000회 Map 생성 | `service.ts` L2856 | `planContainerBody` 반환값에 `nodeMap` 포함 또는 호출부에서 1회 생성 후 전달 |
| 7 | Performance | `executeNode`에서 `nodeContext` spread가 3회 연속으로 분리 적용되어 중간 객체 2개를 생성한다 | `service.ts` L2315, 2325, 2334 | 단일 스프레드로 병합 |
| 8 | Performance | `executeInline` 내 디버그 로그가 매 노드 실행마다 O(N) 레이블 연산을 프로덕션에서도 수행한다 | `service.ts` L687–692 | `debug` 레벨로 낮추거나 프로덕션 가드 추가 |
| 9 | Concurrency | 병렬 브랜치에서 `nodeOutputCache`·`structuredOutputCache`가 공유 참조로 전달된다. 현재 브랜치 노드 집합이 배타적이라 안전하지만 미래 설계 변경 시 race window가 열릴 수 있다 | `parallel-executor.ts` L68–73 | shallow copy를 추가하거나 배타성 불변식을 주석으로 문서화 |
| 10 | Concurrency | `resolveHasDefaultLlmConfigCached` 캐시가 브랜치 컨텍스트별로 분리되어 병렬 브랜치에서 공유되지 않는다 | `service.ts` L2562–2574 | per-execution `Map<string, Promise<boolean>>` 캐시로 교체 |
| 11 | Concurrency | `executeInline`의 finally 블록이 `executionPathChain`을 drain하지 않아 부모 `runExecution`에 암묵적으로 의존한다 | `service.ts` L766–770 | finally에 chain drain 추가 또는 의존 관계 문서화 |
| 12 | Documentation | 엔진의 핵심 메서드인 `executeNode`(L2215), 공개 인터페이스인 `NodeHandler`(L117), 서비스 클래스 `ExecutionEngineService`(L270)에 JSDoc이 전혀 없다 | `service.ts` L270, L2215; `interface.ts` L117 | 각각 역할·파라미터·부수 효과를 짧은 JSDoc으로 명시 |
| 13 | Dependency | `buildAiMessageDebugFromResumeState`·`buildConversationMetaFromResumeState`가 `export`로 공개되어 있으나 테스트 보조 목적이다 | `service.ts` L135, L191 | `/** @internal */` 주석 추가 |
| 14 | Testing | `mockHandler.execute`가 `{ processed: true, input }` 레거시 flat shape를 반환한다. `adaptHandlerReturn` 동작 변경 시 다수의 테스트가 예상치 못하게 실패할 수 있다 | `spec.ts` L125 | 기본 mock handler를 `{ config: {}, output: { processed: true } }` 규격 shape로 교체 |
| 15 | Testing / Maintainability | `(service as any)['contextService']` 패턴으로 private 멤버에 직접 접근하는 코드가 3곳이다. 리팩토링 시 타입 에러 없이 테스트가 깨진다 | `spec.ts` L295, 1239, 1307 | provider 교체 방식으로 주입하거나 테스트 전용 factory 제공 |
| 16 | Maintainability | `Partial<Node>` 픽스처 정의가 각 `describe` 블록마다 반복된다 | `spec.ts` 다수 | `makeNode(overrides)` 팩토리 함수를 파일 상단에 정의하고 일관 적용 |
| 17 | Requirement | `executeInline`이 `manual_trigger`만 pass-through 처리하여 서브 워크플로우에 다른 트리거 타입 포함 시 의도치 않은 부수 효과가 발생할 수 있다 | `service.ts` L614 | `NodeCategory.TRIGGER` 기준으로 모든 트리거를 pass-through 처리하거나 spec에 지원 타입 명시 |
| 18 | Testing | 테스트명 `"still populates rawConfig when nodeMap is empty"`가 실제 검증 내용과 다르다 | `spec.ts` L1467 | `"still populates rawConfig when config has no expression placeholders"`로 변경 |
| 19 | Database | `executeSync()`의 에러 핸들러와 완료 확인에서 `findOneBy`를 각각 재조회한다 | `service.ts` L828, L852 | 인메모리 `savedExecution` 객체를 직접 업데이트하는 방식으로 SELECT 제거 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Security | **HIGH** | IDOR(소유권 검증 없는 실행 제어), `_resumeState` DB 노출, 에러 스택 저장, formData 미검증 |
| Performance | **HIGH** | `gatherNodeInput` O(N×M) 엣지 스캔, `appendExecutionPath` 노드당 2회 DB 왕복 |
| Architecture | **HIGH** | God Object(~2500줄·18 의존성), `runExecution`/`executeInline` 로직 중복, OCP 위반, 인터페이스 우회 |
| Maintainability | **HIGH** | 실행 루프 ~200줄 중복, `waitForAiConversation` 단일 메서드 과다 책임, 매직 스트링 분산 |
| Testing | **HIGH** | `executeSync()`·`executeAsync()` 완전 미테스트, AI 종료 경로 누락, shallow freeze 한계 미검증 |
| Database | **MEDIUM** | 트랜잭션 없는 상태 전이, 복합 인덱스 누락, 무제한 JSON 컬럼 증가 |
| Concurrency | **MEDIUM** | `executeSync` 타임아웃 TOCTOU, `ParallelExecutor` shallow copy 경쟁 조건 |
| Requirement | **MEDIUM** | shallow freeze가 CONVENTIONS Principle 7 미충족, `_resumeState` 없는 경우 런타임 크래시 가능 |
| API Contract | **LOW** | `rawConfig` 타입-런타임 불일치, 멀티턴 rawConfig 스냅샷 타이밍 |
| Side Effect | **LOW** | shallow freeze 범위 제한, `resumeState` 캐시 직접 변이 |
| Dependency | **LOW** | 외부 패키지 변경 없음, shallow freeze 문서화 필요 |
| Documentation | **LOW** | `executeNode`·`NodeHandler`·`ExecutionEngineService` JSDoc 부재 |
| Scope | **NONE** | Phase 1 스코프 범위 내 정확히 수렴. 불필요한 변경 없음 |

---

## 발견 없는 에이전트

- **Scope** — Phase 1(`ENG-RC-*`) 스코프 범위에 정확히 수렴. 관련 없는 변경 없음.

---

## 권장 조치사항

1. **[즉시] IDOR 차단** — `continueExecution` / `continueButtonClick` / `continueAiConversation` / `cancelWaitingExecution`에 소유권 검증을 서비스 레이어에 추가하거나 Guard에서 강제한다.
2. **[즉시] `executeSync`·`executeAsync` 테스트 작성** — Sub-Workflow 핸들러가 직접 호출하는 public API가 완전 미테스트 상태다. timeout·FAILED 전파·workflow-not-found 경로 최소 커버리지를 확보한다.
3. **[단기] `gatherNodeInput` incomingEdgeMap 도입** — `outgoingEdgeMap`과 동일 패턴으로 `incomingEdgeMap`을 사전 구축하여 핵심 실행 루프의 O(N×M) 복잡도를 제거한다.
4. **[단기] `_resumeState` DB 저장 시 제거** — WAITING 상태에서 rawConfig를 포함한 `_resumeState`가 `outputData`에 영구 저장되지 않도록 저장 직전 strip 처리한다.
5. **[단기] `waitForAiConversation` null 방어** — `resumeState`가 `undefined`일 때 `buildConversationMetaFromResumeState` 호출로 발생하는 런타임 크래시를 `?? {}` 기본값 또는 파라미터 타입 확장으로 차단한다.
6. **[단기] DB 트랜잭션 추가** — `recoverStuckExecutions`와 RUNNING ↔ WAITING_FOR_INPUT 상태 전이를 `DataSource.transaction()`으로 래핑하여 서버 재기동 시 부분 복구를 방지한다.
7. **[중기] 실행 루프 중복 추출** — `runExecution`과 `executeInline`의 공통 그래프 순회 로직을 `executeGraph()` private 메서드로 추출하여 버그 수정이 두 경로에 동시 적용되도록 한다.
8. **[중기] 누락 테스트 추가** — `endAiConversation()` 종료 흐름, `buildConversationConfigFromOutput`, `recoverStuckExecutions`, `executeInline` 경로의 `rawConfig` 검증 테스트를 추가한다.
9. **[중기] `NodeExecution` 복합 인덱스 추가** — `(execution_id, node_id, started_at DESC)` 인덱스를 마이그레이션에 추가하여 blocking 노드 재개 조회 성능을 확보한다.
10. **[장기] God Object 분리** — `ExecutionLifecycleService`(상태 전환·DB), `WorkflowTraversalEngine`(그래프 순회), `InteractionWaitManager`(블로킹 Promise 관리)로 책임을 분리하고 순환 의존성(`forwardRef(WebsocketService)`)을 이벤트 버스 패턴으로 해소한다.