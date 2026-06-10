# Refactor 백로그 — 성능 (2026-06-10 전수 감사)

> 인덱스: [README.md](./README.md). Critical 3 / Major 8 / Minor 4 — **spec 대조(2026-06-10) 후 유효 14건 / 철회 1건(#9)**.
> **spec 대조 판정 분포**: A 0 / B 6 / C 0 / D 8 / E 1. (A=의도된 설계, B=spec 무언급, C=spec 괴리, D=부분 언급—본 쟁점 미커버, E=철회)
> **중복 참조**: #1 은 [05-database.md](./05-database.md) M-4(동일 근원)와 같은 항목이며 본 파일이 본문 소유.

## Critical

- [ ] **#1 [C] resume rehydration N+1 쿼리** — `backend/src/modules/execution-engine/execution-engine.service.ts:1303-1330`
  `resumeFromCheckpoint` 계열이 이전 실행 노드의 각 nodeId 마다 `nodeExecutionRepository.findOne` 을 루프 내 직렬 `await`. ForEach/Loop 워크플로 재개 지연의 직접 원인.
  - **spec 대조**: D — `4-execution-engine.md §7.5` 는 rehydration 의미만 규정, 쿼리 전략 무언급. Rationale "turn 마다 rehydration 비용은 사람-페이스라 수용" 은 rehydration 자체의 trade-off 수용이지 N+1 까지 수용한 게 아니며, §7.4 가 "rehydration setup latency" 를 운영 리스크로 직접 지목 — **개선이 오히려 spec 정합적**.
  - **개선 방안**:
    1. `seenNodeIds` 수집 후 `find({ where: { executionId, nodeId: In([...]), status: COMPLETED }, order: { startedAt: 'DESC' } })` 단일 쿼리 → `Map<nodeId, NodeExecution>` 인덱싱(nodeId 당 최신 1건 = DESC 첫 등장). 또는 `DISTINCT ON (node_id) ... ORDER BY node_id, started_at DESC` raw 쿼리로 DB 측 dedup — V034 `(execution_id, node_id, started_at DESC)` 인덱스가 정확히 커버(추가 인덱스 불요).
    2. log 순서(`id ASC`) 기준 순회는 유지하고 Map lookup 으로 대체. waiting node outputData 복원 분기 무변경.
  - 검증: park→worker kill→무손실 재개 dockerized e2e + 노드 50개 재개 시 쿼리 수 2건 측정(TypeORM logger). / 회귀 위험: "nodeId 당 최신 COMPLETED 1건" 의미론이 어긋나면 loop iteration 출력이 옛 값으로 복원. / spec 갱신: 불요.

- [ ] **#2 [C] KB 삭제 시 S3 직렬 삭제 루프** — `backend/src/modules/knowledge-base/knowledge-base.service.ts:678-684`
  문서 N건의 S3 객체를 `for...of await` 직렬 삭제 (100건 × ~100ms ≈ 10초 블로킹).
  - **spec 대조**: D — `data-flow/4-file-storage.md` 흐름표가 "for 루프로 호출" 을 code-sync 로 기록하나, Rationale 이 정당화하는 것은 **best-effort/warn 정책이지 직렬 실행이 아님**. 병렬화는 best-effort 의미론과 완전 호환.
  - **개선 방안**:
    1. 20건 청크 `Promise.allSettled(chunk.map(d => s3Service.delete(d.fileUrl)))` 로 교체, rejected 는 fileUrl 목록 일괄 warn.
    2. (선택) `s3.service.ts` 에 `deleteMany(keys[])` — AWS `DeleteObjectsCommand`(1000키/요청)로 왕복 1회. MinIO 호환 확인 필요.
    3. `removeDocument` 단건 경로는 무변경.
  - 검증: S3 mock 부분 실패 시 KB row 삭제 진행 + warn 확인, 100건 삭제 소요시간 측정. / 회귀 위험: 병렬화 rate-limit — 청크 상한으로 완화. / **spec 갱신: 필요** — `data-flow/4-file-storage.md` 의 "for 루프" code-sync 문구 갱신 (project-planner).

- [ ] **#3 [C] `sortByStartedAt` — WS 이벤트마다 전체 재정렬 O(N² log N)** — `frontend/src/lib/stores/execution-store.ts:328-335,482-485`
  `addNodeResult` 마다 전체 정렬 + comparator 내 `new Date()` 반복 생성. 대형 실행에서 메인 스레드 블로킹.
  - **spec 대조**: D — `3-workflow-editor/3-execution.md §10.5` 의 "시간순 컴팩트 리스트" 는 spec 약속이나 per-event 전체 재정렬 전략은 무언급. iteration 별 행 요구로 N 이 커질 수 있음을 spec 이 함의.
  - **개선 방안**:
    1. `NodeResult` 에 `startedAtEpoch` 캐시(수신 시 1회 `Date.parse`), comparator 를 숫자 비교로.
    2. append 분기: startedAt 단조 증가 가정 — "마지막보다 크면 push, 아니면 binary-search 삽입" 으로 전체 sort 제거. update 분기는 startedAt 변경 시에만 재삽입.
    3. 대안(더 단순): store 비정렬 유지 + 타임라인 `useMemo` selector 에서 정렬 (렌더 프레임당 1회 amortize). #8 과 한 PR 권장.
  - 검증: 노드 500행 합성 실행 addNodeResult 1000회 프로파일 + 타임라인 순서 e2e 스냅샷 무변화. / 회귀 위험: startedAt 동률 항목의 stable-sort 상대 순서. / spec 갱신: 불요.

## Major

- [ ] **#4 [M] Dashboard `getSummary` 동일 범위 4+ 회 왕복** — `backend/src/modules/dashboard/dashboard.service.ts:58-135` (실측 6쿼리 5왕복)
  - **spec 대조**: B — `2-navigation/0-dashboard.md` Rationale 은 의미론(분모 정의 등)만 기록, 쿼리 전략 무언급.
  - **개선 방안**: 1. workflow count 2건 → `COUNT(*) FILTER (WHERE is_active)` 단일 쿼리. 2. execution 4건 → `COUNT(*) FILTER` + `AVG(...) FILTER` 단일 raw 쿼리(7d/prev7d/success/avg). 3. 파생 계산(반올림·changePercent)은 기존 로직 유지 — unit test 가 의미론 고정.
  - 검증: `dashboard.service.spec.ts` 기대값 무변화 + 왕복 2회 확인. / 회귀 위험: FILTER 조건 누락 시 분모 의미론(status 무관 — Rationale 명시) 훼손. / spec 갱신: 불요.

- [ ] **#5 [M] `assertNoContainerCycle` 전체 선형 순회 + Map 중복 생성** — `execution-engine.service.ts:7869-7884` (`planContainerBody` 의 `nodeMap`:7897 과 이중)
  - **spec 대조**: D — 런타임 사이클 검사(`CONTAINER_CYCLE` 거부)는 `1-data-model.md`·`0-canvas.md` 의 spec 의무, 알고리즘/비용은 무언급.
  - **개선 방안**: 1. `nodeMap` 선빌드 후 인자로 전달 — Map 이중 생성 제거. 2. `allNodes` 전수 스캔을 사전 계산된 children 배열(:7899)로 대체 — children 빌드를 cycle 검사 앞으로 이동. 3. (선택) ancestor-chain walk memoize.
  - 검증: CONTAINER_CYCLE unit(자기/상호/자손 참조) 전부 통과. / 회귀 위험: 검증 순서 변화로 에러 우선순위 달라질 수 있음 — 테스트로 고정. / spec 갱신: 불요.

- [ ] **#6 [M] `planParallelBody` BFS `queue.shift()` O(N²)** — `execution-engine.service.ts:8226-8239`
  - **spec 대조**: B — `10-parallel.md` 는 분기 의미론만 규정, 도달성 계산 알고리즘 무언급. 분기 그래프는 통상 수십 노드라 실효 낮음 — 저비용 정리.
  - **개선 방안**: 1. `let head = 0; while (head < queue.length)` 인덱스 포인터로 교체. 2. 엔진 내 다른 BFS 의 `.shift()` 도 grep 후 일괄 적용 검토.
  - 검증: parallel ownership unit 무변화. / 회귀 위험: 사실상 없음(순회 순서 동일). / spec 갱신: 불요.

- [ ] **#7 [M] `buildSystemPrompt` 매 턴 노드 카탈로그 재직렬화** — `workflow-assistant/prompts/system-prompt.ts:52-83`
  - **spec 대조**: D — `4-ai-assistant.md §5` 가 "정적 콘텐츠 앞 배치로 prefix cache hit 향상" 을 설계 의도로 명시 + expression reference 캐시를 spec 에 기록 — node catalog 캐시는 **spec 이 채택한 동일 패턴의 미적용 잔여**.
  - **개선 방안**: 1. `expressionReferenceCache` 패턴 복제 — 모듈 스코프 캐시 + `resetNodeCatalogCacheForTesting`. 2. 테스트가 다른 defs 를 주입하므로 defs 배열 reference 를 무효화 키로(`WeakMap<NodeDefinitionView[], string>`). 3. (선택) 정적 블록 1~3+카탈로그 전체를 단일 prefix 문자열로 합쳐 캐시.
  - 검증: "5-block structural layout" describe 통과 + 동일 defs 2회 호출 시 render 1회 spy. / 회귀 위험: 테스트 간 캐시 오염 — 리셋 규율로 차단. / spec 갱신: 불요(원하면 §5 에 한 줄 — planner 재량).

- [ ] **#8 [M] `nodeResults` Array 선형 탐색 — 이벤트마다 O(N)** — `use-execution-events.ts:763,853,918,963` + `execution-store.ts:441-450`
  - **spec 대조**: B — WS 이벤트 계약·표시 요건만 spec 규정, store 자료구조 무언급.
  - **개선 방안**: 1. `nodeResultIndex: Map<nodeExecutionId, number>` 파생 인덱스를 state 와 동기 유지 + `latestIndexByNodeId` 보조 인덱스. 2. 4곳 `.find()` 를 lookup selector 로 교체. 3. 전면 Map 전환은 #3 의 selector 정렬 전환과 **한 PR 로** — 단독 전환 시 정렬 로직과 충돌.
  - 검증: iteration dedup·Carousel ghost row 회귀 테스트 포함 통과 + 500노드 스트림 프로파일. / 회귀 위험: "nodeExecutionId 없으면 해당 nodeId 최신 행" fallback 의미론(ghost row fix) 재현 필수. / spec 갱신: 불요.

- [x] ~~**#9 [M] 통계 페이지 useQuery 5개 `staleTime` 미설정**~~ — **철회 (2026-06-10 spec 대조)**
  - **사유**: E — `frontend/src/lib/providers.tsx:14-19` 에 **글로벌 default `staleTime: 60_000` 이 이미 존재** (`workflows/page.tsx:137` 주석으로 교차 확인). "리포커스마다 재발화" 전제가 사실관계 오류. 60초 경과 후 재발화는 default 설계의 의도적 동작.
  - (선택 잔여) 통계는 `staleTime: 5분` + `refetchOnWindowFocus: false` 가 더 적합할 수 있으나 측정된 문제 없음 — 필요 시 별건.

- [ ] **#10 [M] 워크플로 임포트 — 트랜잭션 내 개별 save 루프 N+P+M 왕복** — `workflows.service.ts:270-337`
  - **spec 대조**: B — import 는 spec 에 엔드포인트 한 줄(`1-workflow-list.md:126`)만, 삽입 전략 무언급.
  - **개선 방안**: 1. 노드 UUID 앱 측 사전 생성 → `nodeIdMap` 을 insert 전 확정. 2. containerIndex/toolOwnerIndex 를 사전 매핑해 **insert 한 번에 포함** — 2차 update 루프 제거. 3. `manager.insert(Node, [...])` + `insert(Edge, [...])` 배치. 4. **주의**: `insert` 는 `@BeforeInsert` hook·cascade 건너뜀 — entity hook 부재 확인 후 적용(있으면 배열 `save` 로 대체).
  - 검증: import unit(컨테이너/toolOwner remap, invalid index, default LLM 주입) 통과 + 쿼리 수 N+P+M+1 → ~3 측정. / 회귀 위험: UUID 사전 생성·hook 우회. / spec 갱신: 불요.

- [ ] **#11 [M→m 강등] `clearLlmDefaultConfigCache` — 전체 키 선형 스캔** — `execution-engine.service.ts:7449-7456`
  - **spec 대조**: B — ai-review INFO 산물(코드 주석 명시), spec 표면 아님. **실효 낮음**: 키 수 상한이 "동시 실행 수 × workspace(실질 1)" 라 스캔 비용 무시 가능 — 우선순위 최하/wontfix 후보로 강등.
  - **개선 방안**: 적용한다면 `Map<executionId, Map<workspaceId, Promise<boolean>>>` 이중 Map 으로 O(1) delete + single-flight 의미론 유지. 또는 현 구조 유지 종결.
  - 검증: parallel 브랜치 single-flight unit 통과. / 회귀 위험: 사실상 없음. / spec 갱신: 불요.

## Minor

- [ ] **#12 [m] RAG graph-traversal — 동일 재귀 CTE 2회 실행** — `rag-search.service.ts:630-656` **(조건부 — seed 동등성 검증 선행)**
  - **spec 대조**: D — `traversedEntityCount` 메타데이터는 `10-graph-rag.md` KB-GR-SR-06 의 spec 약속, 2회 왕복 전략은 무언급. 코드 주석의 "LIMIT 후라 부정확" 우려는 절반만 타당 — PG 재귀 CTE 는 항상 materialize 되므로 통합 가능.
  - **개선 방안**: 1. **선행 조건**: 메인 CTE 와 2차 CTE 의 seed 모집합 동등성 검증(2차는 LIMIT 적용 후 seed 기준 — 다르면 현 2회 왕복이 정확한 의미론). 2. 동등 시 메인 쿼리에 `traversal_stats AS (SELECT COUNT(DISTINCT entity_id) FROM expanded)` CTE + CROSS JOIN 으로 1 왕복화.
  - 검증: 동일 fixture before/after `traversedEntityCount` 동일성. / 회귀 위험: 카운트 의미 변경 시 KB-GR-SR-06 표면 수치 변경(UI 영향). / spec 갱신: 의미 변경 시에만 §4.3 (planner).

- [ ] **#13 [m] Undo 스택 — 변경마다 전체 nodes/edges shallow copy** — `editor-store.ts:531-532` **(측정 선행 — wontfix 가능)**
  - **spec 대조**: D — Undo 기능은 `0-canvas.md §6` spec 약속, 저장 방식(스냅샷 vs diff)은 무언급. shallow copy + MAX_UNDO=50 cap 으로 실효 낮음.
  - **개선 방안**: 1. **측정 먼저**: 노드 300/엣지 400 에서 snapshot push 가 16ms 프레임 예산 침범 없으면 wontfix 종결. 2. 침범 시 zundo(temporal) 또는 immer `produceWithPatches`. 3. 중간 대안: 연속 드래그 1 gesture = 1 snapshot 디바운스 확인.
  - 검증: undo/redo unit(컨테이너 소속 복원, manual_trigger 삭제 차단) 무변화. / 회귀 위험: patches 방식은 외부 배열 교체 경로(임포트/버전 복원)와 어긋나면 이력 오염. / spec 갱신: 불요.

- [ ] **#14 [m] `MAX_NODE_ITERATIONS`/`PARALLEL_ENGINE` 매 실행 configService 조회** — `execution-engine.service.ts:1387,3025,1549,3665`
  - **spec 대조**: D — §1.6 은 읽기 시점 무규정이나 §11 의 자매 env 들이 "모듈 로드 시 1회 읽음" 패턴으로 기성 규약 — read-once 전환이 spec 패턴과 정합.
  - **개선 방안**: 1. `onModuleInit` 에서 필드로 1회 적재(`resolveExecutionRunWorkerConcurrency` 의 sanitize 패턴 준용). 2. 4개 호출처 필드 참조로 교체. 3. env 런타임 변경에 의존하는 테스트는 init-시점 주입으로 마이그레이션.
  - 검증: MAX_NODE_ITERATIONS=1 가드·PARALLEL_ENGINE=off rollback 테스트. / 회귀 위험: 테스트 env 주입 방식. / spec 갱신: 적용 시 §1.6 에 read-once 문구 추가가 일관적 (planner).

- [ ] **#15 [m] 대화 메시지 단건 갱신에 전체 `.map()` 재순회** — `execution-store.ts:646,694,708` **(측정 선행 — wontfix 후보)**
  - **spec 대조**: B — 대화 항목 의미론만 spec 규정. **실효 최저**: `.map()` 은 shallow 순회이고 toolCallId 검색은 어차피 O(N) — 이득이 할당 1회 절감뿐.
  - **개선 방안**: 1. 측정 후 병목 아니면 wontfix 종결 권고. 2. 적용 시 idx 확정 경로(:646)만 `messages.with(idx, updated)` (ES2023 — tsconfig lib 확인), toolCallId 기반은 파생 인덱스 동반 시에만.
  - 검증: optimistic reconcile/tool dedup unit 무변화. / 회귀 위험: 사실상 없음. / spec 갱신: 불요.
