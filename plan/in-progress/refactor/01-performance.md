# Refactor 백로그 — 성능 (2026-06-10 전수 감사)

> 인덱스: [README.md](./README.md). Critical 3 / Major 8 / Minor 4.
> **중복 참조**: #1 은 [05-database.md](./05-database.md) M-4(동일 근원 — rehydration N+1)와 같은 항목이며 본 파일이 본문 소유.

## Critical

- [ ] **#1 [C] resume rehydration N+1 쿼리** — `backend/src/modules/execution-engine/execution-engine.service.ts:1303-1330`
  `resumeFromCheckpoint` 계열이 이전 실행 노드의 각 nodeId 마다 `nodeExecutionRepository.findOne` 을 루프 내 직렬 `await`. ForEach/Loop 워크플로 재개 지연의 직접 원인.
  → distinct nodeId 목록으로 `In([...ids])` 단일 쿼리 + `Map<nodeId, NodeExecution>` 인덱싱으로 교체.

- [ ] **#2 [C] KB 삭제 시 S3 직렬 삭제 루프** — `backend/src/modules/knowledge-base/knowledge-base.service.ts:678-684`
  문서 N건의 S3 객체를 `for...of await` 직렬 삭제 (100건 × ~100ms ≈ 10초 블로킹).
  → `Promise.allSettled` 병렬화 (대용량은 20건 청크), rejected 항목은 일괄 warn 로그.

- [ ] **#3 [C] `sortByStartedAt` — WS 이벤트마다 전체 재정렬 O(N² log N)** — `frontend/src/lib/stores/execution-store.ts:328-335,482-485`
  `addNodeResult` 마다 전체 `nodeResults` 정렬 + 정렬 내부에서 항목마다 `new Date()` 생성. 대형 실행에서 메인 스레드 블로킹.
  → startedAt 을 epoch 숫자로 캐시, binary-search 삽입 또는 렌더링 selector 에서만 정렬.

## Major

- [ ] **#4 [M] Dashboard `getSummary` 동일 범위 4+ 회 왕복** — `backend/src/modules/dashboard/dashboard.service.ts:58-135`
  → `COUNT(*) FILTER (WHERE ...)` 단일 집계 쿼리/CTE 로 통합.

- [ ] **#5 [M] `assertNoContainerCycle` 전체 선형 순회 + Map 중복 생성** — `execution-engine.service.ts:7869-7884` (`planContainerBody` 의 `nodeMap`:7897 과 이중)
  → `nodeMap` 을 빌드 후 인자로 전달, 사이클 체크는 해당 children 대상으로만.

- [ ] **#6 [M] `planParallelBody` BFS `queue.shift()` O(N²)** — `execution-engine.service.ts:8226-8239`
  → 인덱스 포인터(`let head = 0`) 방식으로 O(1) dequeue.

- [ ] **#7 [M] `buildSystemPrompt` 매 턴 노드 카탈로그 재직렬화** — `backend/src/modules/workflow-assistant/prompts/system-prompt.ts:52-83` (+ `workflow-assistant-stream.service.ts:440-444`)
  `nodeDefs` 는 프로세스 수명 동안 불변인데 매 턴 `.map().join()` 재생성.
  → 기존 `expressionReferenceCache` 패턴과 동일한 모듈 레벨 캐시 추가.

- [ ] **#8 [M] `nodeResults` Array 선형 탐색 — 이벤트마다 O(N)** — `frontend/src/lib/websocket/use-execution-events.ts:763,853,918,963` + `execution-store.ts:441-450`
  → `Map<nodeExecutionId, NodeResult>` 구조로 전환, 렌더링 변환은 `useMemo` selector.

- [ ] **#9 [M] 통계 페이지 useQuery 5개 `staleTime` 미설정** — `frontend/src/app/(main)/statistics/page.tsx:291-362`
  탭 리포커스마다 6개 API 동시 재발화. → `staleTime: 60_000` 이상 + `gcTime` 설정.

- [ ] **#10 [M] 워크플로 임포트 — 트랜잭션 내 개별 save 루프 N+P+M 왕복** — `backend/src/modules/workflows/workflows.service.ts:270-337`
  → `manager.insert(Node, nodesArray)` 배치 삽입 (컨테이너 참조 UUID 는 사전 계산), Edge 도 배치화.

- [ ] **#11 [M] `clearLlmDefaultConfigCache` — 전체 키 선형 스캔** — `execution-engine.service.ts:7449-7456`
  → `Map<executionId, Map<workspaceId, ...>>` 이중 Map 으로 O(1) 삭제.

## Minor

- [ ] **#12 [m] RAG graph-traversal — 동일 재귀 CTE 2회 실행** — `backend/src/modules/knowledge-base/search/rag-search.service.ts:630-656`
  → 메인 CTE 에 `COUNT(DISTINCT entity_id)` 집계 컬럼 포함해 1 왕복.

- [ ] **#13 [m] Undo 스택 — 변경마다 전체 nodes/edges shallow copy** — `frontend/src/lib/stores/editor-store.ts:531-532`
  → immer patches(diff) 저장 방식 검토.

- [ ] **#14 [m] `MAX_NODE_ITERATIONS`/`PARALLEL_ENGINE` 매 실행 configService 조회** — `execution-engine.service.ts:1387,3025,1549,3665`
  → `OnModuleInit` 에서 서비스 필드로 1회 적재.

- [ ] **#15 [m] 대화 메시지 단건 갱신에 전체 `.map()` 재순회** — `execution-store.ts:646,694,708`
  → `messages.with(idx, updated)` (ES2023) 또는 Map 구조 전환.
