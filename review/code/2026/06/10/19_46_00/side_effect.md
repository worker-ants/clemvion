# 부작용(Side Effect) Review

성능 백로그 리팩토링 PR (perf #1/#2/#4/#5/#6/#7/#10/#14 + frontend #3/#8). 점근 비용 절감을 노린 변경으로, 의미론 보존을 명시적으로 의도한다. 부작용 관점에서 주요하게 살펴야 할 지점은 (a) env read-once 캐시 도입, (b) `manager.insert` 의 hook/default 우회, (c) frontend store 의 파생 인덱스 Map 도입과 WeakMap 캐시다.

## 발견사항

### [WARNING] 실행엔진 env read-once 캐시 — 런타임 동적 재읽기 의미 변경
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `resolveMaxNodeIterations`/`resolveParallelEngineFlag` (신규 인스턴스 필드 `maxNodeIterationsOnce`/`parallelEngineFlagOnce`)
- 상세: 기존 `this.configService.get('MAX_NODE_ITERATIONS')`·`'PARALLEL_ENGINE'` 는 호출마다 재읽기였다. 변경 후 인스턴스 수명 동안 첫 읽기값으로 동결된다. 새로운 인스턴스 가변 상태(mutable instance state)가 도입된 것이며, "실행 중 config 변경이 반영되던" 의미가 사라진다. 단, ConfigService 는 부팅 후 사실상 정적이고 spec §1.6/§11 의 자매 env 들이 동일하게 "모듈 로드 시 1회 읽음" 규약이라 의도된 정렬이다. 테스트는 describe 별 fresh 인스턴스 + 인스턴스 내 상수 mock 이라 영향 없음(401/6294/6416/8725 등 확인). 동일 인스턴스에서 호출 간 config mock 값을 바꾸는 테스트가 추가되면 첫 값에 동결돼 깨질 수 있음 — 회귀 가드는 아니나 규약 문서화 필요.
- 제안: 현 구현 유지. spec §1.6 read-once 문구 추가(이미 `spec-update-perf-backlog-01.md` draft #2 에 포함)로 의미 변경을 spec 표면에 반영. 향후 동적 reconfiguration 도입 시 이 캐시를 무효화하는 경로가 없음을 주석에 명시 권장.

### [INFO] `manager.insert` 가 entity hook/default population 을 우회 — Node/Edge 한정 안전
- 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:322-351` (importWorkflow 배치 insert)
- 상세: `manager.save(create(...))` → `manager.insert(plainLiteral)` 전환은 (1) `@BeforeInsert`/cascade, (2) entity-default 채움을 건너뛴다. 검증 결과: Node/Edge 엔티티에 `@BeforeInsert`/`@AfterInsert`/cascade 없음(grep 무결과 확인). entity-default 컬럼(`positionX/positionY default 0`, `config default {}`, `isDisabled default false`)은 insert 페이로드가 모두 명시적으로 설정하므로 누락 없음(`positionX: nodeDto.positionX` 등). `@CreateDateColumn`/`@UpdateDateColumn` 은 TypeORM insert 가 자체 채움. `id` 는 앱 측 `randomUUID()` 사전 생성. 반환값은 `savedWorkflow` 만이라 노드/엣지 엔티티 인스턴스를 소비하는 호출자 영향 없음.
- 제안: 코드 주석에 "향후 hook 추가 시 배열 save 로 되돌릴 것" 이미 명시 — 적절. 다만 `positionX`/`positionY` 가 DTO 에서 nullish 일 때 과거 `create()` 는 entity default 0 을 채웠으나, insert 는 명시값(`undefined` 전달 시)이면 DB default 0 으로 fallback. DTO validation 이 이 둘을 required 로 강제하는지 확인 권장(범위 밖이면 무변화).

### [INFO] frontend execution-store 파생 인덱스 Map 3종 신규 상태 — 구독 비대상이나 reset 경로 일관성 점검
- 위치: `codebase/frontend/src/lib/stores/execution-store.ts` `nodeResultIndexByExecId`/`lastIndexByNodeId`/`firstNoExecIdIndexByNodeId`
- 상세: 새 공유 상태(store state) 3종 도입. `startExecution`·`reset`·초기 state·`addNodeResult` 4 경로 모두에서 클리어/유지가 일관되게 처리됨(diff 의 :493/:914 reset 지점 모두 새 Map 으로 초기화 확인). 인덱스는 React 구독 비대상으로 설계됐고(`nodeStatuses` 패턴 미러), raw `setState({ nodeResults })`(테스트 시딩) 로 stale 해질 수 있는 경우를 `addNodeResult`/`findNodeResult` 가 후보 row 재검증으로 방어(miss → append fallback, never clobber). 부작용 누수 없음.
- 제안: 없음. 방어 로직과 reset 경로 망라 양호.

### [INFO] frontend 정렬 의미 store→accessor 이전 — 소비처 4곳 전부 갱신됨
- 위치: `selectSortedNodeResults` (WeakMap 메모) + 소비처 `use-expression-context.ts:115`, `transform/preview.tsx:29`, `run-results-drawer.tsx`, `use-execution-events.ts`(4 find 사이트)
- 상세: store 가 더이상 `sortByStartedAt` 로 pre-sort 하지 않고 도착순 유지 → 정렬은 read 시 accessor 가 담당. 정렬 순서에 의미 의존하던 소비처(last-write-wins, 역순 스캔)가 빠짐없이 accessor 경유로 전환됐고(파일 15·17·16), 시그니처 변경 없이 export 추가만 발생. 인터페이스 호환 — 기존 import 처는 그대로 동작. `startedAtEpoch` 캐시 필드 추가는 NodeResult 의 옵셔널 내부 필드로 표시 비대상 명시. WeakMap 은 `nodeResults` 가 매 mutation `.slice()` 로 새 reference 라 stale 위험 없음.
- 제안: 없음. accessor 가 export 되어 공개 표면이 되었으므로 향후 소비처는 직접 `nodeResults` 정렬 금지를 컨벤션으로.

### [INFO] S3 `deleteMany` 신규 공개 메서드 — 자체 반환 형태, 기존 best-effort 의미 보존
- 위치: `codebase/backend/src/common/services/s3.service.ts` (신규 `deleteMany`), `knowledge-base.service.ts:675` 호출처
- 상세: 신규 메서드 추가(기존 시그니처 무변경). KB 삭제가 단건 `delete` N회 → `deleteMany` 배치 1회로 전환. 외부 네트워크 호출 패턴이 N왕복 → ceil(N/1000)왕복으로 줄지만 호출 대상(S3)·삭제 범위는 동일. best-effort/warn 의미론 보존: 부분 실패(`Errors[].Key`)는 errored 수집 후 일괄 warn, 명령 실패(네트워크)는 catch-warn 후 KB row 삭제 진행. 비실존 키 멱등 처리도 S3 표준대로. 빈 배열 가드(`docs.length > 0`) 로 불필요 호출 차단.
- 제안: 없음. spec `data-flow/4-file-storage.md` 문구 동기화는 draft #1 에 포함됨.

### [INFO] dashboard 6쿼리 5왕복 → 2쿼리 통합 — 분모/분자 의미론 SQL FILTER 로 보존
- 위치: `codebase/backend/src/modules/dashboard/dashboard.service.ts` `getSummary`
- 상세: `count()`·다중 `getCount()`·`getRawOne(AVG)` 를 `COUNT(*) FILTER`/`AVG FILTER` 집계 2쿼리로 통합. WHERE `started_at >= fourteenDaysAgo` + FILTER 조합으로 `total7d=[7d,now]`, `prev7d=[14d,7d)`, `success7d`(completed 한정), `avg7d`(non-null 한정) 분리. 기존 `getCount` 의미와 일치 검증함. successRate 분모는 status 무관 total7d 유지(spec §3·§7). 읽기 전용 — DB 상태 변경 없음, 왕복만 감소. `getRawOne` undefined 방어(`?? 0`) 추가.
- 제안: 없음.

### [INFO] rehydration N+1 findOne → 단일 In() 배치 — 복원 순서/최신 선택 의미 보존
- 위치: `execution-engine.service.ts` rehydrateContext (perf #1)
- 상세: nodeId 당 `findOne(order DESC)` 직렬 → 단일 `find({ nodeId: In(...), order startedAt DESC })` 후 Map 으로 nodeId 별 첫(=최신 COMPLETED) row 채택. log 순회 순서(distinct ASC) 보존. V034 인덱스가 정렬 커버. DB 쓰기 없음. COMPLETED 부재 노드 미포함 의미 유지. 회귀 가드 테스트가 (a)배치1회/findOne미사용, (b)nodeId당 최신, (c)미완료 노드 제외를 고정.
- 제안: 없음.

### [INFO] `assertNoContainerCycle` 시그니처 변경 — private, 단일 호출자
- 위치: `execution-engine.service.ts` `assertNoContainerCycle(containerNode, children, byId)` (perf #5)
- 상세: private 메서드 시그니처 변경(`allNodes` → `children, byId`). 유일 호출자 `planContainerBody` 가 이미 빌드한 nodeMap/children 재사용. private 이라 외부 호출자 영향 없음. 검사 순서가 nodeMap/children 빌드 뒤로 이동했으나 둘 다 순수 lookup 자료구조 생성이라 cycle 에러 우선순위 불변(주석 명시). BFS reachability 의 `queue.shift()` → 인덱스 포인터(perf #6)도 FIFO 순서 동일.
- 제안: 없음.

### [INFO] system-prompt 노드 카탈로그 WeakMap 캐시 + 테스트 전용 reset export
- 위치: `workflow-assistant/prompts/system-prompt.ts` `nodeCatalogCache`/`resetNodeCatalogCacheForTesting`
- 상세: 모듈 레벨 가변 `WeakMap` 신규 도입(기존 `expressionReferenceCache` 동일 규율). nodeDefs 는 부팅 후 불변 전제 — 배열 reference 키로 1회 직렬화. 테스트 전용 reset export 추가(공개 표면 증가하나 프로덕션 호출 금지 주석). 같은 배열 mutate 시 stale 가능하나 프로덕션 불변 전제로 미발생, 테스트는 reset 으로 대응. 부작용은 모듈 내부 캐시에 국한.
- 제안: 없음. `resetNodeCatalogCacheForTesting` 가 export 되어 번들 표면에 노출되므로 프로덕션 코드 grep 으로 비호출 확인 권장(현 diff 상 테스트만 호출).

## 요약

전 변경이 "점근 비용 절감, 관측 의미론 불변" 을 명시 의도하며, 의도치 않은 전역/공유 상태 변경·파일시스템·예상 외 네트워크 호출은 발견되지 않았다. 새로 도입된 가변 상태(엔진 env read-once 인스턴스 필드, frontend store 인덱스 Map 3종, system-prompt WeakMap)는 모두 reset/재검증 경로가 일관되게 처리되고 React 비구독으로 설계됐다. 시그니처 변경은 private 단일 호출자(`assertNoContainerCycle`)에 국한되고, 공개 표면 변화는 순수 add-only(`deleteMany`, `selectSortedNodeResults`, `findNodeResult`, 테스트 reset)다. 가장 주의할 의미 변화는 엔진 env read-once(런타임 동적 재읽기 상실)이나, spec 자매 env 규약과 정렬되고 spec 문구 동기화 draft 가 동반돼 WARNING 수준에서 수용 가능하다. `manager.insert` 의 hook/default 우회는 Node/Edge 한정으로 검증됐고 default 컬럼이 페이로드에서 모두 명시돼 안전하다.

## 위험도

LOW
