# 아키텍처(Architecture) Review

대상: perf 백로그 01 (성능 리팩터링) — backend 6개·frontend 6개 구현 + 동반 테스트/plan. 모든 변경이 "행위 의미 불변, 비용만 절감" 을 표방하는 성능 리팩터링이라 아키텍처 표면(경계·레이어·인터페이스)은 대부분 보존된다. 아래는 새로 도입된 추상화의 응집도·SRP·확장성 관점 발견사항.

## 발견사항

- **[WARNING]** `execution-store` 의 파생 인덱스 3종이 store 상태로 승격되며 응집/불변식 부담 증가
  - 위치: `codebase/frontend/src/lib/stores/execution-store.ts:213-241`(인터페이스), `:521-635`(addNodeResult)
  - 상세: `nodeResultIndexByExecId`·`lastIndexByNodeId`·`firstNoExecIdIndexByNodeId` 3개의 파생 Map 이 `nodeResults` 와 손으로 동기화되는 상태가 됐다. 이들은 `nodeResults` 의 함수적 파생물(derived)임에도 별도 SoT 처럼 state 에 올라가, "indices 가 `nodeResults` 와 항상 정합" 이라는 불변식을 `addNodeResult`/`startExecution`/`reset` 3개 mutation 이 각자 유지해야 한다. 새 mutation 이 `nodeResults` 를 건드리면서 인덱스 갱신을 빠뜨리면 silent desync 가 난다(SRP/캡슐화 약화 — store 가 "데이터 보관" 과 "인덱스 정합 유지" 두 책임을 떠안음). 현재 구현은 (a) 3개 reset 경로 모두 인덱스를 재초기화하고 (b) `findNodeResult`/`addNodeResult` 양쪽에 stale 검증(`state.nodeResults[idx]?.x === ...`)을 둬 안전하게 막았다 — 검증 결과 현 PR 범위에선 desync 경로 없음. 그러나 이 안전성은 규율(주석)로만 보장된다.
  - 제안: 향후 `nodeResults` 를 변경하는 신규 mutation 추가 시 인덱스 동반 갱신을 강제하려면, 세 Map 갱신을 `appendRow(state, row)`/`updateRow(state, idx, row)` 같은 단일 내부 헬퍼로 캡슐화해 mutation 들이 직접 Map 을 만지지 않게 하는 방향을 권장(차기 리팩터, 본 PR 차단 아님). 현 코드의 stale 가드는 적절한 방어선이다.

- **[INFO]** `selectSortedNodeResults` WeakMap 메모이즈 — 추상화 적절, 책임 이동 일관
  - 위치: `execution-store.ts:376-414`, 소비처 `use-expression-context.ts:115`·`run-results-drawer.tsx:241`·`transform/preview.tsx:29`
  - 상세: 정렬 책임을 store 쓰기(`addNodeResult` 내 매 이벤트 `sortByStartedAt`)에서 read accessor 로 옮긴 것은 결합도/응집도상 개선이다 — store 는 도착순(append-only, 인덱스 안정) 만 책임지고, "시간순" 은 표현(read) 시점 파생물이 된다. WeakMap 키가 배열 reference 라 같은 frame 의 다수 소비처가 1회 정렬을 공유. arrival-index tiebreak·NaN sink 로 옛 `sortByStartedAt` 의미론(안정 정렬, startedAt 부재 후미)을 정확히 보존. 적절한 추상화 수준.

- **[INFO]** `S3Service.deleteMany` 신규 메서드 — 인터페이스 분리·레이어 책임 정합
  - 위치: `s3.service.ts:78-110`, 소비처 `knowledge-base.service.ts:675-699`
  - 상세: S3 청크(1000키 상한)·`DeleteObjectsCommand` 세부는 `S3Service`(데이터/인프라 레이어) 안에 캡슐화되고, KB 서비스(비즈니스 레이어)는 keys 배열만 넘긴다. 반환 `{ errored: string[] }` 는 TypeORM `DeleteResult` 와 무관한 자체 형태임을 주석으로 명시해 누수 추상화를 피했다. best-effort/warn 의미론(부분 실패 + 명령 실패 모두 warn 후 진행)을 호출처가 보존. 레이어 경계 명확.

- **[INFO]** `assertNoContainerCycle` 시그니처 변경 — 호출자가 빌드한 자료구조 주입(DI 방향 정합)
  - 위치: `execution-engine.service.ts:7902-7935`
  - 상세: `(containerNode, allNodes)` → `(containerNode, children, byId)` 로 바꿔 호출자(`planContainerBody`)가 이미 만든 `nodeMap`/`children` 을 재사용(Map 이중 생성·전수 스캔 제거). private 메서드라 외부 계약 영향 없고, 사이클 검출 의미(직접 자식의 containerId 조상 체인)는 동일. 검사 호출이 `nodeMap`/`children` 빌드 *뒤*로 이동했지만 순수 lookup 자료구조 생성이라 에러 우선순위 불변. 적절.

- **[INFO]** 엔진 env read-once 캐시(`resolveMaxNodeIterations`/`resolveParallelEngineFlag`) — 기존 패턴과 정렬
  - 위치: `execution-engine.service.ts:862-887`, 호출 치환 `:1430`·`:1585`·`:3061`·`:3698`
  - 상세: lazy `??=` read-once 는 `resolveExecutionRunWorkerConcurrency` 의 기존 규율과 정렬되고, lifecycle hook 대신 lazy 라 직접 생성 단위 테스트에서도 안전. 인스턴스 수명 캐시이므로 "변경은 재시작 시 반영" 의미는 spec §1.6 문구 갱신(draft 존재)으로 동기화 예정. 4개 호출처를 단일 resolver 로 모아 DRY·확장성 개선.

- **[INFO]** `importWorkflow` 배치 insert 전환 — hook/cascade 우회 전제의 명시적 문서화
  - 위치: `workflows.service.ts:267-353`
  - 상세: 행 단위 `manager.save` 루프 + 2차 update 루프(N+P+M 왕복)를 UUID 사전 생성 + `manager.insert` 2회(~3 왕복)로 통합. `manager.insert` 가 `@BeforeInsert` hook·cascade 를 건너뛴다는 위험 전제를 주석으로 명시하고 "Node/Edge 엔티티에 둘 다 없음(확인)·향후 hook 추가 시 배열 save 로 되돌릴 것" 이라는 회귀 가드를 남긴 점이 적절. `QueryDeepPartialEntity` 단언은 TypeORM 타입 quirk 회피로 국소적. 트랜잭션(`manager`) 경계 안에서 원자성 보존.

- **[INFO]** dashboard `getSummary` 6쿼리→2쿼리 통합 — 의미론 보존 검증됨
  - 위치: `dashboard.service.ts:1046-1132`
  - 상세: `COUNT(*) FILTER`/`AVG FILTER` 로 분모(status 무관 7일 전체)·분자(COMPLETED)·prev7d([14d,7d))·avg 를 SQL 한 번에 표현. WHERE `>= fourteenDaysAgo` + 각 FILTER 의 `>= sevenDaysAgo`/`< sevenDaysAgo` 조합이 옛 개별 쿼리 윈도우와 동치임을 확인(prev7d=[14d,7d), 나머지=[7d,now)). 파생 계산(반올림·changePercent·분모 의미)은 그대로라 spec(§3·§7)·테스트가 의미론 고정. 데이터 레이어 응집 개선.

- **[INFO]** 엔진 rehydration N+1 → 단일 `In()` 배치 — 인덱스 정합 주석 명확
  - 위치: `execution-engine.service.ts:1330-1370`
  - 상세: per-node `findOne(order DESC)` 직렬 왕복을 `find({ nodeId: In(...), status: COMPLETED }, order: startedAt DESC)` 1회 + `Map` 으로 nodeId 별 첫 등장(=최신) 채택으로 교체. V034 복합 인덱스가 커버한다는 근거와 "log 순회 순서 보존" 을 주석화해 의미 불변을 명시. 적절.

## 요약

전 항목이 행위 의미 보존을 표방한 성능 리팩터링이며, 모듈 경계·레이어 책임·인터페이스 계약은 보존되거나 개선됐다(정렬 책임을 store write→read accessor 로 이동, S3 청크 세부 캡슐화, env resolver DRY 통합, dashboard 데이터 레이어 응집). 순환 의존성·LSP 위반·신규 안티패턴은 없다. 유일하게 주의할 점은 frontend `execution-store` 가 3개 파생 인덱스 Map 을 손으로 동기화하는 상태로 승격되며 "인덱스↔nodeResults 정합" 불변식 유지 책임이 추가된 것 — 현 PR 은 모든 reset 경로 재초기화 + read/write 양측 stale 가드로 안전하게 막았으나, 그 안전성이 규율(주석)에 의존하므로 차기 리팩터에서 갱신을 단일 헬퍼로 캡슐화하면 더 견고하다(본 PR 차단 사유 아님).

## 위험도

LOW
