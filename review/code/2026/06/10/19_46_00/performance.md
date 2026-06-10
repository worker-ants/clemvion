# 성능(Performance) Review

본 PR 은 perf 백로그(01-performance.md)의 다발 적용으로, 전반적으로 명백한 성능 개선(N+1 제거·왕복 통합·O(N)→O(1)·O(N²)→O(N))이며 회귀 위험은 대부분 잘 통제되어 있다. 아래는 잔여 관찰 사항이다.

### 발견사항

- **[INFO]** S3 `deleteMany` — N+1 단건 DELETE 루프를 1000키/요청 청크 배치로 교체 (perf #2)
  - 위치: `codebase/backend/src/common/services/s3.service.ts:423-439`, `knowledge-base.service.ts:665-682`
  - 상세: 문서 N건 직렬 `s3Service.delete` 루프(왕복 N)를 `DeleteObjectsCommand` 청크(`ceil(N/1000)`)로 통합. 빈 배열 early-return, 청크 경계(0/1/1000/1001) 테스트로 고정. best-effort/warn 의미론(부분 실패 `Errors[].Key` 수집 + 명령 실패 catch)도 보존.
  - 제안: 개선 타당. 추가 조치 불요. (참고: 청크 간 `await` 직렬 — S3 throttle 회피 측면에서 합리적 기본값. 향후 대량 KB 삭제가 병목이면 `Promise.all` 병렬 청크 검토 여지만 기록.)

- **[INFO]** Dashboard `getSummary` — 6쿼리 5왕복 → 집계 2쿼리 (perf #4)
  - 위치: `codebase/backend/src/modules/dashboard/dashboard.service.ts:1046-1132`
  - 상세: `count×2` + `getCount×2` + `success getCount` + `AVG getRawOne` 를 `COUNT(*) FILTER`/`AVG FILTER` 집계 2쿼리(workflow 1 + execution 1)로 통합. 분모/분자 의미론(successRate 분모 = status 무관 7일 전체)을 SQL FILTER 로 명시하고 spec 으로 고정. 파생 계산(반올림·changePercent)은 불변.
  - 제안: 개선 타당. `COUNT(*) FILTER` 는 PostgreSQL 전용 구문 — 이 코드베이스가 PG 고정인 점과 정합. 추가 조치 불요.

- **[INFO]** Rehydration N+1 — per-node `findOne` 직렬 → 단일 `In()` 배치 (perf #1)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:1382-1423`
  - 상세: nodeId 당 `findOne(order DESC)` 직렬 왕복(N회)을 distinct nodeId 집합 1회 `find({ nodeId: In(...) , status: COMPLETED }, order: startedAt DESC)` 로 교체. 전역 DESC 정렬에서 nodeId 첫 등장 = 최신 COMPLETED 라는 의미론을 V034 `(execution_id, node_id, started_at DESC)` 인덱스가 커버. 복원 순서(log distinct 순)도 보존. 회귀 가드 테스트로 (a)배치 1회·findOne 미사용 (b)nodeId당 최신 채택 (c)COMPLETED 부재 노드 제외를 검증.
  - 제안: 개선 타당. 정렬 의미론·인덱스 커버리지 모두 정확. 추가 조치 불요.

- **[INFO]** `assertNoContainerCycle` — Map 이중 생성 + 전수 스캔 제거 (perf #5)
  - 위치: `execution-engine.service.ts:7476-7503`
  - 상세: 호출자가 이미 빌드한 `nodeMap`/`children` 을 인자로 재사용해 `byId` Map 중복 생성과 `allNodes` 전수 스캔(컨테이너 자식 필터)을 제거. 순수 lookup 자료구조 빌드를 검사 앞으로 이동했고 에러 우선순위는 불변.
  - 제안: 개선 타당. 추가 조치 불요.

- **[INFO]** BFS reachability — `queue.shift()` O(N) → 인덱스 포인터 (perf #6)
  - 위치: `execution-engine.service.ts:8266-8280` 부근
  - 상세: branch 별 BFS 의 `Array.shift()`(앞당김 O(N), 누적 O(N²))를 `head` 포인터 순회로 교체. FIFO 순서 동일. 노드 수가 큰 DAG 에서 점근 개선.
  - 제안: 개선 타당. 추가 조치 불요.

- **[INFO]** Env read-once 캐시 — `MAX_NODE_ITERATIONS`/`PARALLEL_ENGINE` (perf #14)
  - 위치: `execution-engine.service.ts:1353-1368` + 3개 호출처
  - 상세: 실행 경로마다 반복되던 `configService.get` 을 lazy `??=` read-once 인스턴스 캐시로. 정적 env 라 의미 불변, 단위 테스트 호환(lifecycle hook 회피).
  - 제안: 미세 개선이나 일관성 있음. spec §1.6 read-once 문구 동기화가 draft 로 분리됨(spec-update-perf-backlog-01.md) — 적절.

- **[INFO]** 노드 카탈로그 캐시 — `renderNodeCatalog` WeakMap 메모이즈 (perf #7)
  - 위치: `codebase/backend/src/modules/workflow-assistant/prompts/system-prompt.ts:1793-1809`
  - 상세: 부팅 후 불변인 `nodeDefs` 배열 reference 를 키로 1회만 문자열화. `expressionReferenceCache` 와 동일 규율. WeakMap 키라 테스트가 다른 defs 배열 주입 시 자연 분리. 프롬프트 빌드마다 카탈로그 재직렬화를 제거.
  - 제안: 개선 타당. 추가 조치 불요.

- **[INFO]** Import workflow — 행 단위 save + 2차 update 루프 → 배치 insert (perf #10)
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:267-318`
  - 상세: 노드 N건 `save` + container/toolOwner remap `update` P건 + edge M건 `save` (왕복 N+P+M)를 UUID 사전 생성으로 노드 1회·엣지 1회 `manager.insert` (~3 왕복)로 통합. `manager.insert` 가 `@BeforeInsert` hook·cascade 를 건너뛰는 점을 주석으로 명시하고 "Node/Edge 엔티티에 둘 다 없음" 을 2026-06-10 확인으로 기록.
  - 제안: 개선 타당. **주의(향후)**: `manager.insert` 의 hook 우회 전제는 엔티티에 hook 이 추가되면 즉시 깨진다 — 주석에 명시했으나 코드 레벨 가드는 없다. 회귀 방지를 원하면 Node/Edge 에 `@BeforeInsert` 가 없음을 검증하는 단위 테스트 추가를 고려(선택). 트랜잭션 내부라 원자성은 유지.

- **[INFO]** Frontend 타임라인 정렬 — store 즉시정렬 제거 + WeakMap 메모 accessor (perf #3/#8)
  - 위치: `codebase/frontend/src/lib/stores/execution-store.ts:394-413` (`selectSortedNodeResults`), `addNodeResult` 인덱스 Map 유지
  - 상세: (1) `addNodeResult` 가 매 이벤트마다 `sortByStartedAt`(전체 재정렬 O(N log N)) 하던 것을 도착순 append 로 바꾸고 정렬을 read-time `selectSortedNodeResults` 로 이동 — WeakMap 메모로 같은 배열 reference 는 1회만 정렬. (2) `findIndex`/역순 스캔(O(N))을 `nodeResultIndexByExecId`/`lastIndexByNodeId`/`firstNoExecIdIndexByNodeId` 3개 인덱스 Map(O(1))으로 교체. (3) `startedAtEpoch` 캐시로 정렬 비교 시 ISO 재파싱 제거. stale 인덱스 방어(raw setState 시 후보 row 검증 후 miss 시 append fallback)도 포함.
  - 제안: 개선 타당하며 의미론(시간순, no-startedAt 말미 sink, 동률 도착순)을 테스트로 고정. **관찰**: `addNodeResult` 가 매 이벤트마다 3개 인덱스 Map 을 `new Map(...)` 으로 전체 복제(O(N))한다 — Zustand reference-equality 를 위한 필수 비용이고, 제거한 정렬(O(N log N))보다 저렴하므로 순개선. 추가 조치 불요.

- **[INFO]** 정렬 accessor 소비처 전환 — `use-expression-context`/`run-results-drawer`/`transform/preview`
  - 위치: `use-expression-context.ts:115`, `run-results-drawer.tsx:241`, `transform/preview.tsx:29`
  - 상세: store 가 더 이상 사전 정렬하지 않으므로 "정렬 의존" 소비처(last-write-wins, 역순 최신 스캔, timeline 필터)를 `selectSortedNodeResults` 경유로 전환. WeakMap 메모라 동일 배열 reference 면 여러 소비처가 1회 정렬을 공유. `useMemo` 의존성도 `nodeResults` reference 로 유지돼 불필요 재정렬 없음.
  - 제안: 정확. 정렬을 사용처로 분산했지만 메모로 중복 정렬을 방지 — 회귀 없음.

### 요약
명백한 성능 개선의 일관된 묶음이다. 백엔드는 N+1·다중 왕복을 배치/집계 쿼리로(deleteMany·dashboard 2쿼리·rehydration In()·import 배치 insert), 알고리즘 비효율을 점근 개선(BFS shift O(N²)→O(N)·findOne 인덱스화)했고, 프론트엔드는 매-이벤트 전체 재정렬과 O(N) 선형 검색을 read-time WeakMap 메모 + O(1) 인덱스 Map 으로 옮겼다. 의미론 보존이 핵심 위험인데(정렬 순서·successRate 분모·best-effort warn·rehydration 최신 채택) 각 항목마다 회귀 가드 테스트로 고정되어 있어 통제 수준이 높다. 유일한 잠재 부채는 `manager.insert` 의 hook/cascade 우회 전제로, 현재는 주석으로만 보호되며 엔티티에 hook 이 추가되면 조용히 깨질 수 있다(코드 가드 부재). spec 동기화 2건은 draft 로 planner 트랙에 분리되어 있다.

### 위험도
LOW
