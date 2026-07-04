# 동시성(Concurrency) 리뷰 — admitExecutionOrDefer (PR2b §8 admission gate)

## 발견사항

- **[CRITICAL]** 단일 조건부 UPDATE 는 주장과 달리 TOCTOU-safe 하지 않음 — 실제 DB 재현으로 cap 초과 확인
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2636-2649` (`admitExecutionOrDefer` 의 원자 admission UPDATE)
  - 상세: 주석(2603-2607행)은 "단일 조건부 UPDATE(`WHERE status='pending' AND ws COUNT<cap AND wf COUNT<cap`)로 카운트-체크-전이를 원자화한다 — 다수 consumer 경쟁에서도 cap 초과가 없다"고 명시하지만, 이는 PostgreSQL 의미론상 사실이 아니다. `UPDATE ... WHERE id = $1 AND (SELECT COUNT(*) ...) < cap` 문은 **자신이 갱신하는 대상 row(`id=$1`)에 한해서만** 배타적으로 처리되며, 서브쿼리가 스캔하는 다른 `running` 행들에는 어떤 락도 걸지 않는다. 서로 다른 executionId 를 대상으로 하는 두 개의 pending row 에 대해 이 UPDATE 문이 동시에(서로 다른 커넥션/트랜잭션에서) 실행되면, 두 문 모두 write-write 충돌이 없어 완전히 병렬로 진행되고, 둘 다 커밋 전 시점의 동일한 `COUNT(running)` 스냅샷을 관찰해 **둘 다 조건을 통과**할 수 있다 — 이른바 "count-then-insert" 고전적 race.
  - **실제 검증**: 로컬 postgres(pgvector/pg18, 이 프로젝트의 docker-compose 인스턴스)에서 재현. `running` 2건, cap=3(여유 정확히 1자리)인 상태로 pending row 2개(p1, p2)에 대해 정확히 동일한 UPDATE 문 두 개를 병렬 세션에서 동시 실행 — **5회 반복 모두** 두 UPDATE 모두 성공(`UPDATE 1` × 2)해 최종 `running` count 가 4(cap 3 초과)로 종료됨. 즉 admission gate 가 "다수 consumer 경쟁에서도 cap 초과가 없다"는 계약을 지키지 못한다.
  - 원인: PostgreSQL 은 `SELECT ... FOR UPDATE`/`SELECT ... FOR SHARE` 로 명시하지 않는 한 서브쿼리의 참조 행에 락을 걸지 않는다. row-level 충돌(같은 row 를 갱신하려는 두 문)이 있을 때만 EvalPlanQual 재평가가 발동해 두 번째 문이 최신 커밋 데이터를 다시 보는데, 여기서는 갱신 대상 row 자체가 다르므로(각 트랜잭션이 자신의 row 만 UPDATE) 그 메커니즘이 전혀 개입하지 않는다.
  - 제안: 스펙(§8, spec/5-system/4-execution-engine.md L1090)이 이미 명시한 대안 중 하나를 실제로 적용해야 한다.
    1. **pg advisory lock** — workspace/workflow 스코프 키(`pg_advisory_xact_lock(hashtext(workspaceId))`, `pg_advisory_xact_lock(hashtext(workflowId))`)를 admission UPDATE 이전에 획득해 동일 스코프의 동시 admission 을 직렬화. 트랜잭션 종료 시 자동 해제(`_xact_` variant)라 데드락 위험이 낮음(스코프별 단일 락, 순서 고정 시 상호 데드락 없음).
    2. **`SELECT ... FOR UPDATE` 로 COUNT 대상 행 선잠금** 후 애플리케이션에서 카운트 검증 → UPDATE — 다만 이 경우 명시적 `BEGIN ... COMMIT` 트랜잭션 경계가 필요(현재는 `executionRepository.query` 단발 호출이라 암묵적 단일-statement 트랜잭션).
    3. 대안으로 `SERIALIZABLE` 격리 수준의 명시적 트랜잭션으로 감싸 serialization failure 시 재시도(현재 재큐 로직과 자연스럽게 결합 가능하나 재시도 폭주 관리 필요).
  - cap 은 spec §8 이 정의한 안전장치(워크스페이스/워크플로우 리소스 폭주 방지)이므로, 정확히 "여유 1자리"에 여러 pending 이 몰리는 버스트 상황(대량 webhook 동시 도착 등)에서 실제로 cap 을 유의미하게 초과할 수 있다.

- **[WARNING]** `workspaceId` 가 `undefined` 일 때 workspace cap 이 사실상 무력화
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2635, 2643-2644`
  - 상세: `workflow` 조회가 실패하거나(예: workflow 가 삭제된 edge case) `workflow?.workspaceId` 가 `undefined` 이면, 파라미터 `$2` 는 SQL NULL 로 바인딩된다. `w.workspace_id = NULL` 은 항상 `false` 로 평가되므로 서브쿼리 `COUNT(*)` 는 항상 0 이 되고, `0 < wsCap` 은 항상 참 — workspace cap 검증이 조용히 우회된다. 발생 빈도는 낮지만(workflow 미조회는 이례적) fail-open 방향이라 §8 cap 계약과 어긋난다.
  - 제안: `workspaceId` 가 없으면 admission 을 명시적으로 거부(cancelled 또는 delayed 재큐)하거나, 최소한 로그로 이례 상황을 남겨 운영 가시성을 확보.

- **[INFO]** admission gate 는 PENDING 최초 진입에만 적용 — stalled 재배달/park 재개는 재심사 없음(설계 의도, 문제 아님)
  - 위치: `execution-engine.service.ts:3288-3326` (`runExecutionFromQueue`), spec §8 (spec/5-system/4-execution-engine.md L1085)
  - 상세: RUNNING 분기(stalled 재배달, §7.5 case B)와 park 재개(§7.5 case A)는 이미 `running`/재진입 상태라 cap 재검증 없이 진행된다. 이는 `jobId=executionId` dedup 직렬화 불변식(§4.2)에 의해 "동일 Execution 의 active 세그먼트가 항상 1개"라는 전제 위에 있으며, cap 이중 카운트를 피하기 위한 의도된 설계로 보인다. 다만 위 CRITICAL 항목이 고쳐지지 않으면, cap 초과 상태에서 다수 Execution 이 이미 `running` 으로 잘못 admit 된 뒤에는 이 재검증 부재가 오히려 초과분을 그대로 유지시키는 방향으로 작용(별도 스캐너가 없어 §8 cap 초과 상태를 사후 교정할 경로가 없음)한다.

- **[INFO]** deferred 재큐(jobId 생략)와 원본 job 의 동시 존재는 안전 — double-drive 아님
  - 위치: `execution-engine.service.ts:2659-2670`, `queues/execution-run.queue.ts:48-62`
  - 상세: 최초 enqueue 는 `jobId = executionId`(dedup) 이나, admission 실패(deferred) 시 재큐는 jobId 를 생략해 auto-id 를 받는다. 원본 job 이 아직 `process()` 함수 내부(worker 가 `runExecutionFromQueue` 를 await 중)라 completed 처리 전이지만, 재큐가 별도 jobId 를 쓰므로 BullMQ 의 "동일 jobId 재추가" 충돌은 없다. 재큐된 job 이 나중에 pick up 될 때 `status !== PENDING` 이면(이미 다른 경로로 admitted/cancelled 됨) `runExecutionFromQueue` 의 terminal arm(3298-3305행)이 ack-discard 하므로 중복 실행은 없다. 이 경로 자체는 정상.

## 요약

이번 변경(PR2b)의 핵심 설계 의도는 "단일 조건부 UPDATE 로 count-check-transition 을 원자화해 TOCTOU 를 닫는다"는 것이나, 이 전제는 PostgreSQL 의미론상 성립하지 않는다 — 대상 row 가 다른 두 UPDATE 문은 서로의 서브쿼리 COUNT 평가에 어떠한 상호배제도 제공하지 않으며, 실제로 로컬 DB 에서 "여유 1자리"에 대해 5회 반복 재현한 결과 매번 cap 초과가 발생했다. 이는 스펙 §8 이 이미 경고한 "순진한 read-then-act 는 cap 초과 허용" 케이스가 조건부 UPDATE 형태로도 여전히 재발한 것이며, advisory lock 또는 `SELECT ... FOR UPDATE` 기반 명시적 직렬화 없이는 해소되지 않는다. 그 외 deferred 재큐의 jobId 생략, PENDING-only 재검증 범위, stalled/park 재개와의 상호작용은 설계상 합리적이며 별도 동시성 결함은 발견되지 않았다. workspaceId 미존재 시 workspace cap 이 조용히 무력화되는 부차 결함도 함께 수정 권장.

## 위험도
CRITICAL

STATUS: SUCCESS
