# 유지보수성(Maintainability) Review

대상: perf 백로그 01 구현 (backend 6 production 파일 + frontend 3 production 파일 + 테스트/plan). 성능 리팩터링이지만 행위 의미론 보존을 목표로 한 변경으로, 전반적으로 주석·테스트가 충실하고 기존 패턴(read-once 캐시, WeakMap memo)을 일관되게 답습한다. 아래는 유지보수성 관점의 발견 사항.

## 발견사항

### [WARNING] `addNodeResult` 의 인덱스 Map 3종 수동 동기화 복잡도
- 위치: `codebase/frontend/src/lib/stores/execution-store.ts` (addNodeResult, findNodeResult, startExecution/reset)
- 상세: `nodeResultIndexByExecId` / `lastIndexByNodeId` / `firstNoExecIdIndexByNodeId` 3개의 파생 인덱스를 mutation 마다 손으로 일관 유지한다. update 경로의 "migrate out of firstNoExecIdIndex", append 경로의 분기, reset/startExecution 의 3곳 동시 초기화 등 불변식이 코드 여러 지점에 흩어져 있어, 향후 새 mutation 추가 시 한 곳이라도 누락하면 stale 인덱스 버그가 난다. 단일 함수 `addNodeResult` 내부도 update/append 두 갈래 × 인덱스 유지 로직으로 길이·분기가 상당하다(약 80줄, 분기 깊이 3).
- 제안: 인덱스 유지를 `reindex(nodeResults)` 또는 `applyResult(state, result)` 같은 순수 헬퍼로 추출하면 (a) reset/startExecution 의 3중복 초기화를 한 줄로, (b) update/append 의 인덱스 갱신을 한 곳으로 모아 불변식을 한눈에 검증 가능. 최소한 "3 Map 을 함께 비운다"는 초기화는 `EMPTY_RESULT_INDICES()` 팩토리로 묶을 것. 현재도 stale 방어(`state.nodeResults[idx]?.nodeExecutionId === ...`)가 잘 들어가 있어 안전망은 충분하나, 인지 부하가 높다.

### [INFO] `selectSortedNodeResults` 가 새 소비처 4곳으로 확산 — 호출 누락 위험의 암묵 계약
- 위치: `use-expression-context.ts`, `run-results-drawer.tsx`, `transform/preview.tsx`, 그리고 store/이벤트 테스트
- 상세: store 가 더 이상 정렬하지 않고 "도착순 유지 + 읽기 시점 정렬"로 바뀌면서, `nodeResults` 를 시간순으로 읽어야 하는 모든 소비처가 `selectSortedNodeResults(...)` 를 호출해야 한다는 암묵 계약이 생겼다. 누군가 향후 `nodeResults` 를 직접 순회하면 조용히 정렬이 깨진다(타입은 통과). 각 소비처 주석이 이를 잘 설명하지만 컴파일러 강제는 없다.
- 제안: store 의 `nodeResults` 필드 JSDoc 에 이미 "Arrival-ordered (NOT sorted)" 경고가 있어 1차 방어는 됨. 추가로 selector 를 `useSortedNodeResults()` 훅으로 한 번 더 감싸 "정렬된 뷰는 이 훅으로만"이라는 진입점을 좁히는 방안을 고려(필수 아님, INFO).

### [INFO] dashboard `getSummary` — FILTER 집계 SQL 문자열의 매직 파라미터 분산
- 위치: `codebase/backend/src/modules/dashboard/dashboard.service.ts` getSummary
- 상세: 6쿼리→2쿼리 통합은 명확한 개선이고 주석·spec 참조(§3·§7)도 잘 달려 있다. 다만 `10000`(=백분율×100 반올림 스케일)과 `7`(일수)이 여러 파생식에 리터럴로 흩어져 있다(기존 코드 답습이라 회귀는 아님). `Math.round(... * 10000) / 100` 패턴이 changePercent·successRate 두 곳에 중복.
- 제안: 신규 변경 범위 밖이라 차단은 아니나, `roundPercent2dp(numerator, denominator)` 같은 작은 헬퍼로 두 식을 통일하면 의도(소수점 2자리 백분율)가 드러난다. 매직 `7`/`14` 는 이미 `sevenDaysAgo`/`fourteenDaysAgo` 변수명으로 의미가 살아 있어 양호.

### [INFO] s3 `deleteMany` — 청크 루프 가독성 양호, errored 의미 문서화 우수
- 위치: `codebase/backend/src/common/services/s3.service.ts`
- 상세: `DELETE_OBJECTS_MAX_KEYS = 1000` 을 named static 상수로 추출하고 JSDoc 으로 "비실존 키는 멱등 의미상 errored 아님", "TypeORM DeleteResult 와 무관한 자체 형태"까지 명시한 점이 모범적. 함수 길이·중첩(2단) 적정. 매직 넘버 없음. 별도 조치 불요.

### [INFO] workflows `importWorkflow` 배치 insert — 타입 단언과 hook 우회 주석 적절
- 위치: `codebase/backend/src/modules/workflows/workflows.service.ts`
- 상세: `manager.insert` 가 `@BeforeInsert`/cascade 를 건너뛴다는 점, JSONB 컬럼의 `QueryDeepPartialEntity` 인덱스-시그니처 quirk 로 단언이 필요하다는 점을 주석으로 명확히 남겼다 — 향후 hook 추가 시 회귀를 막는 좋은 안내. `flatMap(... return [])` 으로 범위밖 인덱스 skip 을 표현한 것도 기존 `if (sourceId && targetId)` 보다 간결. containerId/toolOwnerId remap 의 `typeof === 'number' && nodeIdMap[idx]` 이중 가드는 두 번 반복되나 가독성 손상은 경미.

### [INFO] execution-engine rehydration 배치 조회 — 변수명/주석 명료
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
- 상세: N+1 findOne → `In()` 배치 전환에서 `seenNodeIds`(순서 보존 배열) + `seenNodeIdSet`(중복 제거) + `latestCompletedByNodeId`(Map) 분리가 의도를 잘 드러낸다. "log 순서 순회 보존" 주석으로 의미 불변을 못박은 점, V034 인덱스가 DESC 정렬을 커버한다는 근거 명시가 우수. `assertNoContainerCycle` 시그니처에 `byId`/`children` 를 받도록 바꿔 호출자 자료구조 재사용한 것도 합리적이며 주석으로 "에러 우선순위 불변"을 설명. `resolveMaxNodeIterations`/`resolveParallelEngineFlag` 의 `??=` lazy 캐시는 기존 `resolveExecutionRunWorkerConcurrency` 패턴과 정렬되어 일관성 양호.

### [INFO] BFS `queue.shift()` → head 포인터 교체 — 미세하나 표준적
- 위치: `execution-engine.service.ts` reachPerBranch 루프
- 상세: O(N) shift 제거를 `let head = 0; while (head < queue.length)` 로 처리. 짧은 perf 주석으로 "순회 순서 동일(FIFO BFS)"을 명시해 의도 명확. 가독성 손실 없음.

### [INFO] system-prompt 카탈로그 캐시 — expressionCache 와 대칭 구현으로 일관성 높음
- 위치: `codebase/backend/src/modules/workflow-assistant/prompts/system-prompt.ts`
- 상세: `nodeCatalogCache` WeakMap + `resetNodeCatalogCacheForTesting` + `renderNodeCatalogCached` 가 기존 `expressionReferenceCache` 의 규율을 그대로 미러링. "프로덕션 코드는 호출하지 말 것" 경고, "배열 reference 키 = 부팅 후 불변" 전제 문서화 양호. 테스트도 캐시 hit/miss/reset 3케이스로 의미를 고정.

## 요약
성능 중심 리팩터링임에도 유지보수성 관점에서 전반적으로 양호하다. 매직 넘버는 named 상수(`DELETE_OBJECTS_MAX_KEYS`)·의미 변수(`sevenDaysAgo`)로 잘 통제되고, 기존 코드베이스 패턴(read-once `??=` 캐시, WeakMap memo, `*ForTesting` reset 헬퍼)을 일관되게 답습하며, 행위 불변을 못박는 주석·회귀 가드 테스트가 충실하다. 가장 주목할 부분은 frontend `execution-store.ts` 의 3종 파생 인덱스 Map 수동 동기화로, 단일 mutation 함수의 분기·길이가 커지고 불변식이 여러 지점에 흩어져 향후 변경 시 누락 위험이 있다 — stale 방어 코드가 안전망으로 들어가 있어 즉시 버그는 아니지만 인덱스 유지/초기화의 헬퍼 추출을 권한다. dashboard 의 `*10000/100` 백분율 중복은 신규 변경이 아니라 기존 답습이라 비차단.

## 위험도
LOW
