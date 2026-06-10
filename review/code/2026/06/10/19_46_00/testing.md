# 테스트(Testing) Review

## 발견사항

### [INFO] S3Service.deleteMany — 청크 경계 테스트는 충실하나 `Errors[].Key` 멱등 의미론 단언이 일부 누락
- 위치: `s3.service.spec.ts:74-148`, `s3.service.ts:308-324`
- 상세: 경계값(0/1/1000/1001) 청크 분할과 `Bucket`/`Delete.Objects` 페이로드 단언이 잘 짜였고, `Key` 없는 `Errors` 항목 무시(방어)까지 커버한다. 다만 (a) `res.Errors` 가 `undefined` 인 정상 응답(테스트는 항상 `Errors: []` 또는 명시 배열을 반환)에서 `?? []` fallback 경로는 직접 검증되지 않는다. (b) 멱등 의미론("비실존 키는 Deleted 로 반환 → errored 미포함")은 JSDoc 으로 약속되나 테스트로 고정되지 않는다 — 회귀 시 침묵.
- 제안: `sendMock.mockResolvedValueOnce({ Deleted: [...] })`(Errors 키 자체 부재) 케이스 1건 추가로 `?? []` 경로 명시 커버. 멱등 약속은 호출자(KB) 레벨에서 이미 best-effort 로 검증되므로 선택적.

### [INFO] DashboardService.getSummary — FILTER 단언이 SQL 문자열 매칭에 의존(브리틀), DB 의미론 미검증
- 위치: `dashboard.service.spec.ts:521-538`
- 상세: `successRate` 분모 의미론 보존을 `selects.toContain('FILTER')` + `toMatch(/status/)` 같은 SQL 문자열 grep 으로 단언한다. 이는 mock QB 가 실제 SQL 실행을 안 하므로 "분모가 total7d 다"라는 핵심 의미론을 실제로 검증하지 못한다 — `getRawOne` 이 반환하는 `total7d/success7d` 숫자로 `successRate=25` 를 계산하는 부분만 진짜 검증이고, FILTER 절 자체의 정합성(예: prev7d 가 `< sevenDaysAgo` 인지, 14일 하한 WHERE 와 조합되는지)은 SQL 문자열 존재 여부로만 간접 확인된다. SQL 식 리팩터 시 grep 이 깨지거나(false fail) 잘못된 FILTER 로도 통과(false pass)할 수 있다.
- 제안: 의미론 회귀(분모/구간 경계)는 integration 테스트(실 DB, fixture 행 삽입)로 고정하는 것이 정석. 단위 레벨에서는 현 숫자 기반 단언으로 충분하니, `toContain('FILTER')` 류 brittle 단언은 보조로만 유지. 별도 추가 없이 INFO.

### [WARNING] DashboardService — 6쿼리→2쿼리 통합 후 prev7d 구간([14d,7d)) 회귀 테스트 부재
- 위치: `dashboard.service.ts:1064-1098`, `dashboard.service.spec.ts:498-571`
- 상세: 기존 구현은 `prev7d` 를 `started_at >= 14d AND started_at < 7d` 두 조건으로 명시했으나, 신구현은 WHERE 의 `>= fourteenDaysAgo` 하한 + FILTER 의 `< sevenDaysAgo` 상한 **조합**으로 구간을 표현한다(주석 1064-1067). 이 조합이 올바른 [14d,7d) 구간을 산출하는지는 mock QB 테스트로는 검증 불가하며(숫자를 직접 주입), 7일 이전/14일 이전 경계의 off-by-one 회귀를 잡지 못한다. `runs7dChangePercent` 계산이 prev7d 에 의존하므로 의미 있는 갭이다.
- 제안: integration 테스트에서 7일/14일 경계 근방 fixture 행(예: 6d/8d/13d/15d 전 startedAt)을 삽입해 total7d/prev7d 분류를 고정. 최소한 plan 의 검증 항목으로 명시.

### [INFO] execution-engine perf #1 — 배치 rehydration 테스트는 핵심 불변식을 잘 고정
- 위치: `execution-engine.service.spec.ts:1224-1314`
- 상세: (a) find 1회/findOne 미사용, (b) `In(['n1','n2','n3'])` where 단언, (c) nodeId 당 startedAt DESC 첫 등장(최신 COMPLETED) 채택, (d) COMPLETED 부재 노드(n3) 미복원 — 세 회귀 불변식을 모두 커버한다. `findOneCallsBefore` 델타 비교로 격리도 양호. 우수.
- 제안: 없음. (보강 여지: 같은 startedAt 동률 시 어느 row 가 선택되는지는 비결정적일 수 있으나, 실제 인덱스 V034 가 보장하므로 단위 레벨 추가 불요.)

### [WARNING] execution-engine perf #5/#6 — assertNoContainerCycle 시그니처 변경·BFS 포인터화에 직접 테스트 없음
- 위치: `execution-engine.service.ts:1476-1503`(cycle), `8266-8523`(BFS head pointer), `7902-7935`
- 상세: `assertNoContainerCycle` 가 `(containerNode, children, byId)` 로 시그니처가 바뀌고 호출 순서(nodeMap/children 빌드를 검사 앞으로 이동)가 변경됐는데, diff 범위 내에서 이 사이클 검출 경로를 직접 단언하는 신규/기존 테스트가 보이지 않는다. 마찬가지로 `queue.shift()`→`head++` BFS 교체는 "순회 순서 동일" 을 주석으로만 보장한다. 두 변경 모두 "의미 불변 리팩터" 주장이나 회귀 가드가 없으면 침묵 회귀 위험.
- 제안: 기존 컨테이너 사이클 에러 테스트·reachability(branch) 테스트가 이 경로를 간접 커버하는지 확인 필요. 미커버 시 사이클 검출(A.containerId=B && B.containerId=A → named error) 1건, branch reachability 순서 1건 추가 권장. (diff 만으로 판단 불가 → WARNING.)

### [INFO] resolveMaxNodeIterations/resolveParallelEngineFlag (perf #14) — read-once 캐시 동작 직접 테스트 없음
- 위치: `execution-engine.service.ts:1353-1368`
- 상세: lazy `??=` read-once 캐시(첫 호출만 configService.get, 이후 캐시)로 바뀌었으나, "configService.get 이 1회만 호출됨" 을 단언하는 테스트가 diff 에 없다. 기존 테스트들이 default 값(100/'v1')에 의존해 통과하면 캐시 동작 자체는 회귀해도 잡히지 않는다(값은 동일하므로). 영향은 낮음(성능 최적화이고 값 정합은 유지).
- 제안: 선택적으로 "두 번째 호출이 configService.get 을 재호출하지 않는다"(spy call count) 1건. 우선순위 낮음.

### [INFO] KnowledgeBaseService.remove — best-effort 분기 커버리지 양호
- 위치: `knowledge-base.service.spec.ts:1563-1638`, `knowledge-base.service.ts:1665-1683`
- 상세: deleteMany 배치 1회 호출, 부분 실패(errored) warn+삭제 진행, 명령 자체 실패(reject) warn+삭제 진행, 문서 0건 시 미호출 — 신구현의 4개 분기를 모두 커버한다. `service as unknown as { logger }` 로 private logger 를 spy 하는 패턴은 다소 침투적이나 NestJS Logger 단언의 관용. 우수.
- 제안: 없음.

### [INFO] system-prompt 노드 카탈로그 캐시 (perf #7) — WeakMap 캐시 3분기 명확히 커버
- 위치: `system-prompt.spec.ts:1713-1761`
- 상세: 캐시 hit(mutate 미반영=재직렬화 안 함), miss(다른 배열 reference), reset 헬퍼 후 재직렬화 — WeakMap 동작 3경로를 관측 가능한 증거로 검증한다. mutate-미반영을 캐시 증거로 쓰는 발상이 영리하고 의도 주석이 명확. `beforeEach(reset)` 로 격리도 확보. 우수.
- 제안: 없음.

### [WARNING] workflows.importWorkflow 배치 insert (perf #10) — hook/cascade 우회 전제가 테스트로 가드되지 않음
- 위치: `workflows.service.ts:1991-2003`(주석), `workflows.service.spec.ts:1838-1961`
- 상세: 테스트는 `manager.insert` 페이로드(사전 생성 UUID, containerId/toolOwnerId remap, 범위 밖 edge skip, update 루프 제거)를 충실히 단언한다. 그러나 코드 주석 "manager.insert 는 @BeforeInsert hook·cascade 를 건너뛴다 — Node/Edge 엔티티에는 둘 다 없음(2026-06-10 확인). 향후 hook 추가 시 배열 save 로 되돌릴 것" 이라는 **핵심 안전 전제**가 테스트로 강제되지 않는다. 누군가 Node/Edge 에 `@BeforeInsert` 를 추가하면 import 가 조용히 깨지는데(컬럼 누락/기본값 미적용) 단위 테스트는 mock insert 라 잡지 못한다.
- 제안: (a) integration/e2e 에서 import 왕복 후 실제 저장된 Node 행의 모든 컬럼(특히 hook 으로 채워질 법한 timestamp/default)을 검증, 또는 (b) Node/Edge 엔티티에 `@BeforeInsert`/cascade 부재를 단언하는 가드 테스트(메타데이터 reflection) 추가. 회귀 비용이 높은 전제이므로 권장.

### [INFO] execution-store perf #3/#8 — 인덱스 Map·정렬 accessor 회귀 가드 충실
- 위치: `execution-store.test.ts:2812-2960`, `execution-store.ts:521-654`
- 상세: ghost-row fallback(no-exec-id 이벤트가 동일 nodeId 최신 row in-place 갱신), 동일 execId 재이벤트 in-place 갱신, findNodeResult 의 exec-id/no-exec-id 분기 독립 해소, accessor memo 동일 reference, startedAt 동률 도착순 보존 — 신규 인덱스 Map(`nodeResultIndexByExecId`/`lastIndexByNodeId`/`firstNoExecIdIndexByNodeId`)과 `selectSortedNodeResults` 의 까다로운 의미론을 광범위하게 커버한다. 우수.
- 제안: 한 가지 미커버 경로 — stale index fallback. 코드(531-545, 646-652)는 "raw setState 로 인덱스가 stale 해지면 후보 row 불일치 시 miss 처리(append fallback, 클로버 방지)"를 명시 주석으로 강조하나, 이를 직접 단언하는 테스트가 없다(initialState 에 빈 Map 을 넣는 seeding 은 있으나 stale 불일치 시나리오는 아님). raw `setState({ nodeResults: [...] })` 후 addNodeResult 가 잘못된 row 를 덮지 않고 append 하는 케이스 1건 추가 권장.

### [INFO] frontend 정렬 accessor 전환 (use-expression-context / preview / run-results-drawer) — 소비처 테스트 갱신 정합
- 위치: `expression-input.test.tsx:2148-2171`, `use-expression-context.test.ts:2471-2482`, `use-execution-events.test.ts` 다수
- 상세: store 가 더 이상 pre-sort 하지 않고 `selectSortedNodeResults` 로 read-time 파생하도록 바뀌면서, mock 들이 `importOriginal` 로 실제 `selectSortedNodeResults` 를 보존하고 단언을 accessor 경유로 갱신했다. 정합적. `transform/preview.tsx`(역순 스캔)·`run-results-drawer.tsx`(filter) 두 소비처는 코드 변경만 있고 신규 단위 테스트가 동반되지 않았으나, accessor 자체가 store 테스트에서 검증되고 소비처 로직은 단순 위임이라 갭은 작다.
- 제안: `transform/preview` 의 "역순 스캔으로 최신 inputData" 의미가 도착순≠시간순일 때 바뀌는 경계이므로(주석이 강조), 정렬 차이를 드러내는 fixture(startedAt 역전) 1건이 있으면 이상적. 우선순위 낮음.

### [INFO] plan/spec-update draft 파일 — 테스트 대상 아님
- 위치: `plan/in-progress/refactor/01-performance.md`, `plan/in-progress/spec-update-perf-backlog-01.md`
- 상세: 문서 변경. 테스트 관점 해당 없음. spec 동기화 2건이 planner 트랙으로 분리된 점은 절차상 적절.

## 요약
전반적으로 테스트 품질이 높다. 각 perf 항목이 회귀 가드 단위 테스트를 동반하며, 특히 S3 청크 경계, KB best-effort 분기, system-prompt WeakMap 캐시, execution-store 인덱스 Map/정렬 accessor 는 까다로운 의미론까지 관측 가능한 증거로 잘 고정했다. 주된 갭은 (1) **단위 테스트가 닿지 못하는 DB 의미론**(dashboard FILTER 분모·prev7d [14d,7d) 구간)과 (2) **mock insert 로 검증 불가한 안전 전제**(import 배치 insert 의 hook/cascade 우회) — 둘 다 integration/e2e 레벨 보강이 정석이다. 또 execution-engine 의 cycle/BFS 리팩터(#5/#6)는 "의미 불변" 주장에 비해 diff 내 직접 가드가 보이지 않아 기존 테스트 간접 커버 여부 확인이 필요하다. 차단 사유는 없다.

## 위험도
LOW
