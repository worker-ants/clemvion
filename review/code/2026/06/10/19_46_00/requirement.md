# 요구사항(Requirement) Review

대상: perf 백로그 01 리팩터링 (백엔드 #1·#2·#4·#5·#6·#7·#10·#14, 프론트 #3·#8). 모두 "행위 의미 불변 + 성능 개선" 을 표방하는 변경. 핵심 점검은 (a) 각 리팩터가 기존 의미론을 정확히 보존하는지, (b) spec 본문과의 정합.

## 발견사항

- **[INFO]** `[SPEC-DRIFT]` KB 삭제 S3 정리: spec 본문이 아직 단건 for 루프 서술 (perf #2)
  - 위치: `spec/data-flow/4-file-storage.md` §3 라이프사이클 표 "KB 삭제" 행 + 직후 인용 블록 (`s3Service.delete(doc.fileUrl)` 를 for 루프로 호출); 코드 `knowledge-base.service.ts` `remove` (diff 파일 8)
  - 상세: 코드는 단건 `delete` 루프를 `deleteMany`(DeleteObjects 1000키/요청 청크) 배치 1회로 교체했고, best-effort/warn 의미론(부분 실패 `Errors[].Key` 일괄 warn, 명령 실패도 warn 후 KB row 삭제 진행)을 명시적으로 보존한다. spec 본문은 여전히 "각 key DELETE … for 루프" 로 서술 — 코드가 옳고 spec 이 낡음. 이미 `plan/in-progress/spec-update-perf-backlog-01.md` §1 에 갱신 draft 가 작성돼 있어 SPEC-DRIFT 가 추적되고 있다.
  - 제안: 코드 유지. `spec/data-flow/4-file-storage.md` §3 표/인용 블록을 draft §1 문구로 갱신 (project-planner 트랙). best-effort/warn 의미론은 코드·spec 양쪽에서 불변이므로 행위 회귀 없음.

- **[INFO]** `[SPEC-DRIFT]` env read-once: §1.6 `MAX_NODE_ITERATIONS` 행에 read-once 문구 부재 (perf #14)
  - 위치: `spec/5-system/4-execution-engine.md` §1.6 (`MAX_NODE_ITERATIONS` 행 :206; `PARALLEL_ENGINE`); 코드 `resolveMaxNodeIterations`/`resolveParallelEngineFlag` (diff 파일 6)
  - 상세: 두 정적 env 를 인스턴스 수명 lazy read-once 캐시로 전환. spec §11/§1168·§1169 의 자매 env(`EXECUTION_RUN_WORKER_CONCURRENCY` 등)는 "모듈 로드 시 1회 읽음 — 변경은 인스턴스 재시작 시 반영" 문구를 명시하나, `MAX_NODE_ITERATIONS`/`PARALLEL_ENGINE` 행에는 아직 없다. 코드 변경은 자매 env 규약과 정렬되는 의도적 개선 — 코드가 옳고 spec 이 낡음. draft §2 에 추적됨.
  - 제안: 코드 유지. §1.6 표의 해당 행에 동일 문구 추가 (draft §2, project-planner 트랙). 의미론 변화 없음(lazy 라 직접 생성 단위 테스트에서도 안전, `??=` 캐시는 첫 호출 시점 1회만 read).

- **[INFO]** perf #1 rehydration 배치 조회 — 기존 per-node findOne 의미론 정확 보존 (검증 완료)
  - 위치: `execution-engine.service.ts` rehydrateContext (diff 파일 6, :1330 부근)
  - 상세: nodeId 당 `findOne(status=COMPLETED, order startedAt DESC)` N+1 직렬 왕복을 단일 `find(nodeId In(...), status=COMPLETED, order startedAt DESC)` + nodeId 별 첫 등장 row 채택으로 교체. logs 는 `id ASC` 정렬이며 `seenNodeIds` 배열이 첫 등장 순서를 보존해 복원 순서 불변. 전역 DESC 정렬에서 nodeId 별 첫 row = 그 노드 최신 COMPLETED — 기존 per-node DESC findOne 과 동일. V034 `(execution_id, node_id, started_at DESC)` 인덱스가 실재(`migrations/V034__node_executions_composite_index.sql`)해 커버 주장 정확. COMPLETED 부재 노드는 `executedNodes` 미포함 — 유지. 회귀 가드 테스트(diff 파일 5)가 (a) find 1회·findOne 미사용, (b) nodeId 당 최신 채택(n1 iter-2), (c) n3 미포함을 모두 고정. **요구사항 충족.**

- **[INFO]** perf #4 dashboard 2쿼리 통합 — spec §3/§7/§9 의미론 정확 보존 (검증 완료)
  - 위치: `dashboard.service.ts` getSummary (diff 파일 4)
  - 상세: 6쿼리→2쿼리(workflow 1 집계 + execution 1 집계). successRate 분모 = `COUNT(*) FILTER (WHERE started_at >= 7d)` (status 무관 7일 전체), 분자 = `FILTER (… status=COMPLETED)` — spec §3:60·§9:159 의 "분모는 status 무관 7일 전체" 와 정확히 일치. prev7d = `FILTER (started_at < 7d)` ⊕ 외부 `WHERE started_at >= 14d` → [14d,7d) 구간으로 spec §7:136 정의 일치. changePercent(prev=0→null), avgExecutionTime(ms 반올림, 데이터 없으면 0), 반올림 로직 모두 기존 그대로. `getRawOne` undefined·null 컬럼은 `Number(x ?? 0)`/`avg7d ?` 가드로 0 fallback. spec 표의 successRate `94.2`(소수 1자리)와 코드의 `Math.round(...*10000)/100`(소수 2자리) 정밀도는 기존 구현과 동일하므로 회귀 아님. 테스트(diff 파일 3)가 2왕복·분모 의미론·경계값·undefined 안전을 고정. **요구사항 충족.**

- **[INFO]** perf #10 importWorkflow 배치 insert — hook/cascade 우회 전제 검증됨
  - 위치: `workflows.service.ts` importWorkflow (diff 파일 12)
  - 상세: 행 단위 `save` 루프 + 2차 `update` remap 루프를 사전 생성 UUID(`randomUUID`) + `manager.insert` 배치 2회로 교체. `manager.insert` 가 `@BeforeInsert`·cascade 를 건너뛰는 점이 코드 주석에 명시돼 있고, Node/Edge 엔티티에 실제로 hook 없음(검증: `node.entity.ts`/`edge.entity.ts` 에 `@BeforeInsert`/cascade 0건). `@PrimaryGeneratedColumn('uuid')` 는 앱 생성 UUID 를 페이로드에 명시 공급해 override, `isDisabled`·`config` 등 default 컬럼은 코드가 항상 명시값 제공(`?? false`, `finalConfig`). 범위 밖 containerIndex/toolOwnerIndex/edge 인덱스는 기존과 동일하게 skip(테스트 `sourceNodeIndex:99` skip 고정). `nodeEntities.length>0`/`edgeEntities.length>0` 가드로 빈 배열 insert 차단. **요구사항 충족.** 주석의 "향후 hook 추가 시 배열 save 로 되돌릴 것" 경고가 미래 회귀를 방지.

- **[INFO]** perf #3/#8 frontend execution-store — 정렬 store-out + index Map + ghost-row fallback
  - 위치: `execution-store.ts`, `use-execution-events.ts`, 소비처 4곳 (diff 파일 15·16·17·19·21)
  - 상세: (a) store 가 `sortByStartedAt` 으로 매 이벤트 재정렬하던 것을 도착순 유지 + 읽기 시 `selectSortedNodeResults`(WeakMap memoize) 파생으로 전환. 정렬 의미 보존: ascending epoch, startedAt 없는 row 는 tail sink, ties 는 arrival index tiebreak(엔진 stability 의존 제거). 정렬 의존 소비처 4곳(`use-expression-context` last-write-wins, `transform/preview` 역순 스캔, `run-results-drawer`, 테스트)을 모두 accessor 경유로 전환 — 정렬 누락 회귀 식별·반영됨. (b) `findNodeResult` 가 4개 `.find()` 사이트의 predicate(exec-id 우선, 없으면 first no-exec-id row)를 O(1) index Map 으로 정확 미러; truthiness 가드로 empty-string id 까지 동일. (c) index Map 은 raw `setState`(테스트 seeding) stale 가능성을 후보 row 재검증(`nodeResults[idx]?.nodeExecutionId === …`)으로 방어 — mismatch 는 miss→append 로 폴백, 크래시/오염 없음. ghost-row in-place 갱신·exec-id 재이벤트 dedup·tie 보존이 테스트(diff 파일 18)로 고정. `startedAtEpoch` 캐시는 display 비사용 명시(AGENTS.md date util 규약 준수). **요구사항 충족.**

- **[INFO]** perf #5/#6/#7 — 순수 자료구조/캐시 최적화, 의미 불변
  - 상세: #5(`assertNoContainerCycle` 가 호출자의 nodeMap/children 재사용 — 검사 의미 동일, nodeMap/children 빌드만 검사 앞으로 이동했고 순수 lookup 생성이라 에러 우선순위 불변), #6(BFS `queue.shift()` O(N)→head 포인터, FIFO 순서 동일), #7(노드 카탈로그 WeakMap 캐시 — `expressionReferenceCache` 와 동일 규율, 프로덕션 defs 불변 전제, 테스트용 reset 헬퍼 제공). 모두 관측 가능한 행위 변화 없음. 테스트가 캐시 hit/reset/다른 배열 분리를 고정. spec 표면 아님.

- **[INFO]** s3.service `deleteMany` 반환 형태 — 자체 형태, 엣지 케이스 처리 양호
  - 위치: `s3.service.ts` (diff 파일 2)
  - 상세: 빈 배열→API 미호출 `{errored:[]}`, 1000키 경계 단일 청크, 1001키 분할, `Errors[].Key` 없는 항목 무시(S3 응답 방어), 비실존 키는 S3 멱등 의미론상 `Deleted` 로 와 errored 미포함 — 모두 주석·테스트로 명시. TypeORM `DeleteResult` 와 무관한 자체 형태임을 주석이 경고. 청크 경계 0/1/1000/1001 + 부분 실패가 테스트(diff 파일 1)로 전수 고정. **엣지 케이스 충실.**

- **[INFO]** plan #11·#12·#15 종결 처리 — 근거 문서화 적절
  - 위치: `plan/in-progress/refactor/01-performance.md` (diff 파일 22)
  - 상세: #11(키 수 상한 구조적으로 작아 wontfix), #15(지배 비용 불변 wontfix), #12(seed 동등성 비동등 판정 → 2회 왕복 유지). 특히 #12 는 메인 쿼리 외부 LIMIT 이 expanded 행에 의해 seed evict 가능 → `traversedEntityCount`(KB-GR-SR-06 spec 표면 수치) 의미가 통합 시 바뀐다는 분석으로 종결 — spec 약속 수치 보호 관점에서 올바른 보수적 결정. 코드 변경 없음.

## 요약

본 변경군은 전부 "성능 개선 + 행위 의미 불변" 을 목표로 하며, 점검 결과 의도한 의미론을 정확히 보존한다. perf #1(rehydration 배치)·#4(dashboard 2쿼리)·#10(import 배치)·#3/#8(frontend 정렬 store-out + index Map) 등 의미론 민감 리팩터 모두 (a) 기존 동작과의 등가성이 코드 주석으로 논증되고 (b) 회귀 가드 단위 테스트가 경계·부분 실패·undefined·ghost-row 까지 고정한다. 엔티티 hook 부재(#10)·V034 인덱스 실재(#1)·successRate 분모 의미론(#4) 등 핵심 전제를 코드베이스에서 직접 확인해 모두 사실로 검증했다. TODO/FIXME·미완성 잔재 없음. spec 정합 측면의 두 불일치(#2 KB 삭제 for 루프 서술, #14 §1.6 read-once 문구 부재)는 모두 **코드가 옳고 spec 이 낡은 SPEC-DRIFT** 로, 이미 `spec-update-perf-backlog-01.md` draft 에 갱신 대상이 명시돼 project-planner 트랙으로 추적되고 있다 — 코드 fix 대상 아님. 요구사항 충족 관점에서 차단 사유 없음.

## 위험도

LOW
