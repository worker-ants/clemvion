# 데이터베이스(Database) 리뷰 — PR3 크래시/재시작 RUNNING 세그먼트 re-drive

대상: `execution-engine.service.ts` (`recoverStuckExecutions` → `reclaimStuckRunningExecution` →
`redriveStuckExecution` → `driveStuckRedrive`), 관련 spec/e2e/타입 변경.

## 발견사항

- **[INFO]** 재구동 fan-out 이 unbounded — 동시 재구동 그래프 실행 수 상한 없음
  - 위치: `execution-engine.service.ts` `recoverStuckExecutions()` (reclaimedIds 순회 for 문, `void this.redriveStuckExecution(executionId).catch(...)`)
  - 상세: `reclaimStuckRunningExecution` 이 반환한 모든 row 에 대해 `redriveStuckExecution` 을 fire-and-forget 으로 동시에 트리거한다. 다수 인스턴스가 장시간 다운됐다가 재기동하는 시나리오(예: 배포 창 지연, 인프라 장애)에서는 stale RUNNING row 가 수백~수천 건 누적될 수 있고, 부팅 시 이 전부가 동시에 `rehydrateContext`(workflow/log/nodeExecution 쿼리) + 그래프 드라이브를 병렬로 시작해 DB 커넥션 풀·CPU 스파이크를 유발할 수 있다. 기존 코드(일괄 FAILED UPDATE)는 단일 SQL 문으로 끝났던 반면, 신규 코드는 재구동 규모에 비례해 즉시 워크로드를 유발한다.
  - 제안: 배치 크기 제한(예: 한 번에 N건만 re-claim, 나머지는 다음 스캔 주기로) 또는 재구동 동시성 제한(`p-limit` 류)을 고려. 최소한 재기동 직후 스파이크에 대한 운영 관찰(로그의 `Re-claimed N stale RUNNING`)로 모니터링 필요성을 문서화할 것을 권장.

- **[INFO]** `reclaimStuckRunningExecution` WHERE 절이 기존과 동일한 인덱스(`idx_execution_status`, status 단일 컬럼)에 의존 — 이번 PR 로 새로 생긴 문제는 아님
  - 위치: `codebase/backend/migrations/V002__indexes.sql:19` (`CREATE INDEX idx_execution_status ON execution (status)`), 신규 쿼리는 `execution-engine.service.ts` `reclaimStuckRunningExecution()`
  - 상세: `WHERE status = :status AND started_at < :threshold` 조건은 `status` 단일 컬럼 인덱스만으로 `status='running'` 행을 추려낸 뒤 `started_at` 은 인덱스 없이 필터한다. `execution` 테이블 규모가 커지고 RUNNING 상태 행 수가 늘어나면(정상적으로는 적어야 하지만) 스캔 비용이 증가할 수 있다. 다만 이 WHERE 절/인덱스 구성은 이번 PR 이전부터 동일했고(기존 recoverStuckExecutions 도 같은 조건으로 UPDATE), 이번 diff 는 SET 절만 `status=FAILED,...` → `startedAt=NOW()` 로 바꿨을 뿐 조건절이나 인덱스는 손대지 않았다. 신규 회귀는 아니나, re-claim 빈도가 이전(1회성 종결)과 달리 case B 도입 후 "재구동 세그먼트가 다시 stale 해지면 재-재클레임" 흐름이 반복될 수 있어 스캔 비용 관련성이 약간 높아졌다.
  - 제안: 현 스케일에서는 문제 없어 보이나, 향후 `execution` 테이블이 매우 커지고 RUNNING 잔존 행이 늘어나는 운영 이슈가 관측되면 `(status, started_at)` 부분 인덱스(`WHERE status = 'running'`) 추가를 검토.

- **[INFO]** re-claim UPDATE 는 원자성·동시성 안전성이 적절히 확보됨 (긍정 확인)
  - 위치: `reclaimStuckRunningExecution()` — `UPDATE execution SET started_at = NOW() WHERE status = 'running' AND started_at < :threshold RETURNING id`
  - 상세: 단일 UPDATE 문으로 소유권 이전(started_at 갱신)과 대상 조회(RETURNING)를 원자적으로 수행한다. 두 인스턴스가 동시에 같은 stale row 를 스캔해도 PostgreSQL 의 row-level lock 에 의해 한쪽만 UPDATE 를 성공시키고(먼저 커밋한 트랜잭션이 `started_at` 을 이미 갱신했으므로 나중 트랜잭션의 `started_at < :threshold` 조건이 재평가 시 거짓이 됨), 결과적으로 affected row 가 인스턴스별로 겹치지 않는다. 이는 별도 애플리케이션 레벨 분산 락(`exec:recover:lock`)과 이중으로 방어되는 defense-in-depth 구조로, 옛 코드의 `SET status=FAILED ... RETURNING id` 패턴과 원자성 측면에서 동등하다. `status` 는 `running → running` 으로 실제로 변경되지 않아(코멘트에 명시) enum 전이표에 영향 없음도 타당하다.
  - 참고용 확인 사항 — 별도 조치 불필요.

- **[INFO]** 트랜잭션 경계 — re-claim(UPDATE)과 이후 재구동(그래프 실행 + 노드별 UPDATE)이 별도 트랜잭션으로 분리된 것은 설계상 의도적이며 타당
  - 위치: `recoverStuckExecutions()` → `redriveStuckExecution()` → `driveStuckRedrive()`
  - 상세: re-claim 트랜잭션이 짧게 끝나고(단일 UPDATE), 실제 그래프 재실행은 그 밖에서 fire-and-forget 으로 진행된다. 이는 장시간 실행될 수 있는 그래프 드라이브를 하나의 긴 트랜잭션으로 묶지 않는 올바른 패턴이다. `driveStuckRedrive` 내부의 `runNodeDispatchLoop` 도 case A(`driveResumeAwaited`)와 동일한 기존 노드 단위 커밋 패턴을 재사용하므로 이번 PR 로 새로운 트랜잭션 패턴이 추가되지 않았다.
  - 참고용 확인 사항 — 별도 조치 불필요.

- **[INFO]** e2e 테스트의 직접 SQL 조작(`UPDATE execution SET status='running', started_at=NOW() - INTERVAL '31 minutes' ...`)은 raw pg client 사용이나 파라미터 바인딩(`$1`)이 적용돼 SQL 인젝션 우려 없음
  - 위치: `codebase/backend/test/execution-crash-redrive.e2e-spec.ts` (DELETE/UPDATE/SELECT 쿼리들)
  - 상세: 모든 쿼리가 `$1`, `$2` 파라미터 바인딩을 사용하며 문자열 interpolation 이 없다. `executionId`/`nodeId` 는 서버가 생성한 UUID 이므로 인젝션 표면도 없다. 테스트 전용 코드이며 프로덕션 표면(`_test/recover-stuck-executions`)도 `NODE_ENV==='test'` 게이팅 + 404 폴백으로 적절히 격리됨.
  - 참고용 확인 사항 — 별도 조치 불필요.

- **[INFO]** `redriveStuckExecution` 은 재-로드(`findOneBy`) 시점의 `status !== RUNNING` 가드로 동시 cancel 레이스를 안전하게 처리
  - 위치: `redriveStuckExecution()` 앞부분 — `if (!savedExecution || savedExecution.status !== ExecutionStatus.RUNNING) { ... return; }`
  - 상세: re-claim UPDATE 와 실제 재구동 사이에 사용자가 execution 을 취소하는 등 동시 상태 변경이 있어도, 재로드 시 RUNNING 이 아니면 스킵하므로 이미 종결된 execution 을 잘못 재구동/덮어쓰는 문제가 없다. 다만 이 사이 간극에서 `activeRunningMs`/`recordRunningSegmentStart` 는 이미 기록됐는데 실제 재구동은 스킵되는 경우, in-memory `segmentStartMs` map 의 엔트리가 정리되지 않고 남을 가능성이 있다(단, 메모리 leak 수준은 미미 — Map 키가 executionId 로 유한). DB 정합성 문제는 아니므로 등급은 정보성으로 유지.

## 요약

이번 변경은 크래시/재시작 시 stale RUNNING Execution 을 "일괄 FAILED 마킹" 하던 기존 로직을, `UPDATE ... SET started_at = NOW() WHERE status='running' AND started_at < threshold RETURNING id` 형태의 원자적 조건부 re-claim + 이후 rehydration 기반 그래프 재구동으로 전환한다. 핵심 reclaim UPDATE 는 단일 SQL 문 원자성과 row-level lock 에 의해 다중 인스턴스 동시 실행에도 안전하며(더불어 분산 락으로 이중 방어), WHERE 절 자체는 기존 코드와 동일한 조건·인덱스(`idx_execution_status`)를 사용해 이번 PR 이 인덱스/스키마 리스크를 새로 만들지 않는다. 마이그레이션 파일 변경이 전혀 없어 무중단 배포 관점의 위험도 없다. rehydration 경로의 N+1 회피(batched `In()` 조회)도 기존 구현을 그대로 재사용한다. 유일한 개선 여지는 재구동 fan-out 이 재클레임된 row 수에 비례해 동시에 트리거된다는 점으로, 대규모 stale 누적 시나리오에서의 부팅 직후 부하 스파이크 가능성이며 이는 CRITICAL/WARNING 급은 아니고 운영 관찰 대상의 정보성 사항이다.

## 위험도
LOW
