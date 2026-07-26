# 성능(Performance) 리뷰 — node-cancellation §2.3 dispatch 사전 cancel 체크

## 발견사항

- **[WARNING]** `assertExecutionNotCancelled` 의 SELECT 가 문서화된 "status 단일 컬럼"이 아니라 Execution 전체 컬럼(대형 JSONB 다수 포함)을 조회한다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:7787`(비용 주석) ~ `:7799`(`const row = await this.executionRepository.findOneBy({ id: executionId });`)
  - 상세: 새 헬퍼의 docstring(7787행)은 "노드 경계마다 PK 인덱스 SELECT 1건(status 단일 컬럼)"이라고 비용을 서술하지만, `findOneBy({id})`는 TypeORM `Repository` 기본 동작상 `@Column({select:false})`가 없는 한 매핑된 **모든 컬럼**을 SELECT 한다. `Execution` 엔티티(`codebase/backend/src/modules/executions/entities/execution.entity.ts`)는 `input_data`(74행)·`output_data`(77행)·`error`(80행)·`conversation_thread`(164행)·`user_variables`(176행)·`resume_call_stack`(189행) 총 6개의 JSONB 컬럼을 포함하며 어느 것도 `select:false`가 아니다. AI 멀티턴 대화가 누적된 실행은 `conversation_thread`가 수 KB~수십 KB 에 이를 수 있어, 노드 경계마다(선형 워크플로우면 노드마다, cyclic 워크플로우면 재방문마다) 이 페이로드 전체를 fetch+역직렬화하게 된다.
  - 근거(내부 선례): 같은 파일의 `recordNodeLatencyMetrics`(8014~8020행)는 정확히 이 문제(엔티티 전체 대신 필요한 컬럼만 projection)를 이미 한 번 고친 이력이 있다 — 주석 원문: "QueryBuilder 로 `ne.id / ne.duration_ms / ne.status / n.type` 4컬럼만 SELECT — 전체 엔티티+JOIN 전량 조회 대신 필요한 최소 컬럼만 projection (SUMMARY W-9)". 이번 추가는 그 W-9 원칙을 다시 어긴 것으로 볼 수 있다.
  - 제안: `findOneBy` 대신 `createQueryBuilder('e').select('e.status', 'status').where('e.id = :id', {id: executionId}).getRawOne()` 또는 `findOne({where:{id}, select:['id','status']})`로 프로젝션을 `status` 하나로 좁힌다. 쿼리 횟수(round-trip 수)는 그대로지만 payload 크기가 크게 줄어 네트워크·역직렬화 비용이 감소한다. 코드 주석의 "status 단일 컬럼" 서술을 실제로 맞추는 효과도 있다.

- **[INFO]** 노드 경계마다 추가된 SELECT 1건의 상대 비용 및 누적 영향 — 정량 분석
  - 위치: 콜사이트 3곳 — `execution-engine.service.ts:1638`(`runNodeDispatchLoop`), `:3729`(`executeInline`), `:4261`(`runExecution`)
  - 같은 경계에서 이미 일어나는 I/O: `executeNode`(5449행)가 매 노드마다 `createNodeExecution`(8045~8059행, INSERT 1회) → 핸들러 실행 → 정상 완료 시 `nodeExecutionRepository.save(nodeExecution)`(예: 5658행, UPDATE 1회)를 수행하고, `eventEmitter.emitNode`(NODE_STARTED/NODE_COMPLETED)로 WebSocket emit 2회를 발생시킨다. 즉 기존에 이미 **DB write round-trip 2회 + WS emit 2회**가 노드 경계마다 발생한다. 신규 SELECT 1건은 이 2회 write 대비 DB round-trip 수를 약 50% 늘리지만, PK 인덱스 단건 조회라 write 1건보다 저렴한 것이 통상적이다(단, 위 WARNING 처럼 실제로는 풀 로우라 payload 크기가 write 와 비슷하거나 클 수 있어 이 이점이 상당 부분 상쇄된다).
  - Execution 테이블 레벨 UPDATE(`updateExecutionStatus`)는 매 노드 경계가 아니라 실행 시작/종료/park 등 **상태 전이 시점에만** 발생한다(2160/2259/2336/2426/3341/4156/4480행 호출부 확인). 즉 신규 코드의 docstring이 "NodeExecution INSERT + Execution UPDATE + 이벤트 emit"이 매 경계마다 이미 일어난다고 서술한 것과 달리, 실제로는 "NodeExecution INSERT + NodeExecution UPDATE + WS emit 2회"이고 Execution 테이블 write 는 경계마다 일어나지 않는다. 결론(상대 비용 무시할 만함)에는 영향이 적지만 서술은 부정확하다.
  - 누적 영향(선형 확장): 선형 워크플로우는 노드 수 N 에 비례해 N 회 추가 SELECT. `MAX_NODE_ITERATIONS` 기본값 100(`resolveMaxNodeIterations`, 746~750행)이므로 back-edge 가 있는 cyclic/retry 워크플로우는 노드 1개가 최대 100회 재방문될 수 있고, 3-노드 루프 하나만으로도 단일 실행 생애주기에서 최대 ~300회 추가 SELECT 가 발생할 수 있다. DB RTT 를 같은 AZ 기준 1~3ms 로 가정하면 최악 케이스에서 순수 누적 지연 0.3~1초가 추가되나, 같은 구간에서 이미 발생하는 write round-trip(300 노드 × 2 = 600회) 대비 상대 증가율은 50% 수준이고, 절대 시간은 노드 핸들러 자체의 외부 I/O(HTTP/LLM 호출 — 통상 수백 ms~수 초)에 비하면 작다.
  - 동시성 하 영향: 다수 실행이 동시에 dispatch loop 를 도는 경우(예: 동시 실행 50개 × 각 50 노드) DB 커넥션 풀에 추가로 2,500건 규모의 SELECT 요청이 실행 구간 전체에 걸쳐 분산 발생한다. write 트래픽이 이미 그 2배 규모로 존재하므로 신규 요청이 지배적 병목이 될 가능성은 낮지만, 커넥션 풀 크기·DB CPU 여유와 함께 실측(APM) 확인을 권장한다.
  - 종합: 노드 경계마다 SELECT 1건을 추가하는 설계 자체는 **허용 가능한 비용**으로 판단한다. 다만 cyclic/high-iteration 워크플로우가 실측된 바 없다면 스테이징에서 back-edge 워크플로우 1건으로 APM 프로파일을 확인해 두는 것이 안전하다.

- **[INFO]** 컨테이너(ForEach/Loop/Map) 본문 루프는 이 취소 체크를 상속하지 않는다 — 위 "누적 영향" 분석의 경계 조건
  - 위치: `execution-engine.service.ts:6429`(`executeContainerBody`) — 독립된 `for (const nodeId of sortedNodeIds)` 루프로, `runNodeDispatchLoop`/`executeInline`/`runExecution` 3곳과 별개다. `assertExecutionNotCancelled` 호출이 없다.
  - 상세: ForEach 가 수천 아이템을 반복해도 그 본문 노드들은 이 SELECT 를 트리거하지 않는다. 이는 위 누적 비용 분석의 "worst case" 를 사실상 상한(그래프의 위상정렬 길이 + back-edge 재방문 횟수)으로 캡핑해 주는 완화 요인이지만, 동시에 취소 관측 커버리지의 공백이기도 하다(기능적 정합성 이슈이므로 본 성능 리뷰의 1차 관점은 아니나, "누적 영향이 노드 수에 얼마나 비례하는가"를 정확히 판단하려면 필요한 사실이라 기록한다). correctness 관점 판단은 별도 리뷰어 소관으로 남긴다.

- **[INFO]** 대안 평가 — `createNodeExecution` 을 조건부 INSERT 로 전환해 round-trip 0 추가하는 안
  - 기술적 실현 가능성: PostgreSQL 의 `INSERT INTO t (...) SELECT ... WHERE EXISTS (subquery) RETURNING ...` 패턴으로 "취소 아닐 때만 INSERT" 를 원자적으로 표현하는 것은 가능하다. 이 저장소에는 이미 이런 guarded write 선례가 있다(`updateExecutionStatus`의 raw UPDATE ... RETURNING id, PR2b admission gate 의 조건부 UPDATE).
  - 문제 1 (구현 범위): `createNodeExecution`(8045~8059행)은 `executeNode`(5461행) 외에도 6395/6473/7076행 등 여러 스킵·분기 경로에서 재사용되는 공용 헬퍼이며 TypeORM `repository.create()+.save()` 로 엔티티 하이드레이션을 받는다. 조건부 INSERT 로 바꾸려면 이 헬퍼를 raw SQL 로 재작성하고 반환 row 를 수동으로 `NodeExecution` 셰이프에 매핑해야 한다 — 지금 리뷰 대상인 3곳 diff(각 2줄)보다 훨씬 큰 블라스트 반경의 리팩터가 필요하다.
  - 문제 2 (정확성 트레이드오프, 더 중요): 현재 체크는 `while` 루프 최상단에서 **무조건** 수행되어, `!node`/`!reachable`/`skipExecutedNodes` 로 즉시 `continue` 하는 반복까지 포함해 매 pointer 증가마다 취소를 관측한다. `createNodeExecution` 을 조건부화하는 안은 "실제 INSERT 가 발생하는 반복"에서만 취소를 관측하므로, 취소 시점 이후 남은 노드가 전부 unreachable/이미 실행됨/노드 정의 없음 등 스킵-only 구간이면 루프가 `ExecutionCancelledError` 를 던지지 않고 **정상 종료**할 수 있다. 이 tail 구간 자체는 side effect 가 없어 handler 오실행 위험은 없지만, 상위 완료 처리 로직이 "루프가 예외 없이 끝남" 분기를 타면서 완료 이벤트/알림이 예기치 않게 발사될 위험이 남는다 — `updateExecutionStatus` 의 guarded UPDATE(M-3) 가 최종 status 값 자체는 stomp 하지 않게 막아주지만, 그 사이에 있는 emit/notification 호출까지 전부 감사해야 안전을 완전히 보장할 수 있다. 이는 이번 기능이 원래 고치려던 "cancel 후에도 부수효과가 계속된다"는 결함을 좁은 범위로 재도입할 위험이다.
  - 아키텍처 검증: `POST /executions/:id/stop` (`executions.controller.ts:119`) 은 `ExecutionsService.stop`(`executions.service.ts:732`)에서 단순 조건부 UPDATE(780~792행)로 처리되며, 이 HTTP 요청을 받는 프로세스와 `runNodeDispatchLoop` 를 도는 워커(BullMQ 소비자)가 동일 프로세스라는 보장이 없다(수평 확장 배포 전제). 따라서 in-memory Set/Map 기반의 "프로세스 내 취소 신호" 로 대체하는 안은 이 아키텍처에서 안전하지 않다 — DB 재조회(또는 Redis 같은 별도 브로드캐스트 인프라, 그 자체로 비슷한 비용)가 사실상 유일하게 cross-process 로 신뢰 가능한 관측 수단이라는 헬퍼 docstring 의 주장은 타당하다.
  - 결론: "round-trip 0 추가"는 매력적이나 (a) 구현 범위가 크고 (b) 취소 관측 보장이 "매 경계 무조건"에서 "실제 쓰기 발생 시점"으로 약화되어 이 기능이 고치려던 것과 유사한 회귀를 좁게 재도입할 위험이 있다. 반면 첫 번째 WARNING 의 컬럼 프로젝션 축소는 같은 효과(payload 축소)를 훨씬 낮은 리스크·낮은 구현 비용으로 낸다. **conditional INSERT 전환은 권장하지 않으며, 현재의 "무조건 SELECT" 설계를 유지하되 프로젝션만 좁히는 쪽을 권장한다.**

## 요약

이번 변경은 dispatch loop 노드 경계마다 `Execution.status` 를 재조회하는 SELECT 1건을 추가해, 외부 stop 요청이 진행 중인 순회를 멈추지 못하던 결함(부수효과 계속 발생)을 고친다. 같은 경계에서 이미 발생하는 DB write(NodeExecution INSERT+UPDATE 2회) 및 WS emit(2회) 대비 상대 비용은 작고, cyclic 워크플로우(최대 노드당 100회 재방문)를 고려해도 절대 지연은 노드 핸들러 자체의 외부 I/O 대비 미미하다 — 설계 방향과 "무조건 매 경계 체크"라는 강한 관측 보장은 타당하며, 대체안으로 검토를 요청받은 "createNodeExecution 조건부 INSERT" 전환은 구현 범위가 크고 취소 관측 보장을 약화시키는 트레이드오프가 있어 권장하지 않는다. 다만 실제 구현이 docstring 의 "status 단일 컬럼" 주장과 달리 Execution 엔티티의 6개 JSONB 컬럼(대화 스레드·사용자 변수·resume call stack 등)을 포함한 풀 로우를 매 경계마다 fetch 하고 있어, 이는 같은 파일에서 이미 한 번 고쳐진 바 있는 프로젝션 미최적화(W-9) 패턴의 재발이다. 이 부분만 `select`/`createQueryBuilder` 로 `status` 컬럼 단독 프로젝션으로 좁히면 round-trip 수 변화 없이 payload 크기를 크게 줄일 수 있으므로 우선 수정을 권장한다.

## 위험도

LOW
