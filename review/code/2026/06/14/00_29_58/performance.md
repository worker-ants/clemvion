### 발견사항

- **[INFO]** V095 partial 복합 인덱스 — 핫 경로 I/O 감소 (긍정적 변경)
  - 위치: `spec/data-flow/3-execution.md` §2.1 Schema 매핑 테이블, `migrations/V095__node_execution_exec_status_active_index.sql`
  - 상세: `node_execution` 테이블에 `(execution_id, status) WHERE status IN ('waiting_for_input', 'running')` partial 복합 인덱스를 추가했다. 기존 `(execution_id)` 단일 인덱스에서는 `resolveWaitingNodeExecutionId`가 실행 per-execution 전체 행을 full scan 후 status 필터를 post-processing으로 적용했다. partial 인덱스는 활성 상태 행만 포함하므로 completed/failed/cancelled/skipped(대다수) 행을 인덱스에서 배제한다 — 인덱스 크기와 write amplification이 모두 최소화된다.
  - 제안: 현재 구현이 최적. `resolveWaitingNodeExecutionId`는 `executionId + status='waiting_for_input'` 조회로 partial 인덱스의 술어와 정확히 일치하여 index scan이 적용된다. 추가 조치 불필요.

- **[INFO]** `resolveWaitingNodeExecutionId` 의 `select` 절에 `nodeId` / `startedAt` 포함 — index-only scan 불가
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-05-database-721c98/codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 라인 5230-5237
  - 상세: `find({ select: { id: true, nodeId: true, startedAt: true } })`로 `id`, `nodeId`, `startedAt` 세 컬럼을 가져온다. V095 인덱스는 `(execution_id, status)`만 포함하므로 `nodeId`와 `startedAt` 컬럼은 heap fetch가 필요하다 (index-only scan 불가). 그러나 partial 인덱스 덕분에 활성 행만 좁혀진 후 heap fetch가 발생하므로 실제 I/O 증가폭은 최소다. 활성 NodeExecution이 한 execution당 통상 1건이므로 heap fetch 횟수 자체가 1회 내외다.
  - 제안: 현재 성능 문제 없음. 만약 index-only scan을 원한다면 인덱스에 `INCLUDE (id, node_id, started_at)`를 추가할 수 있으나, 활성 행이 1건인 상황에서 covering index의 효익은 미미하여 불필요하다.

- **[INFO]** `CREATE INDEX CONCURRENTLY` + `executeInTransaction=false` — 운영 무중단 처리
  - 위치: `migrations/V095__node_execution_exec_status_active_index.sql` / `.conf`
  - 상세: `CONCURRENTLY` 옵션으로 인덱스 빌드 중 DML 블로킹 없이 운영 테이블 쓰기가 가능하다. Flyway `.conf`에 `executeInTransaction=false` 를 명시해 트랜잭션 외부에서 실행되도록 했다 — `CONCURRENTLY`는 트랜잭션 안에서 사용 불가하므로 필수 조치다. 빌드 실패 시 INVALID 인덱스 잔존 가능성이 SQL 주석에 명시되어 있고 `DOWN` 절도 제공된다.
  - 제안: 현재 처리 방식이 올바름. 운영 배포 시 마이그레이션 직후 `pg_indexes` 또는 `pg_stat_progress_create_index`로 INVALID 인덱스 잔존 여부를 확인하는 운영 체크리스트를 추가하는 것을 권고한다 (spec 또는 운영 가이드 레벨 — 코드 변경 불필요).

- **[INFO]** spec 변경만으로 N+1 패턴 노출 없음 — 구현 측 기존 N+1 확인
  - 위치: `execution-engine.service.ts` 전반 토폴로지 루프 (§1.2 `runExecution`)
  - 상세: 이번 diff는 spec 문서 1행 수정 + 마이그레이션 추가로, 새로운 N+1 쿼리를 도입하지 않는다. 기존 토폴로지 루프에서 노드별 INSERT `node_execution` → INSERT `execution_node_log` 는 구조적으로 반복되나, 이는 이번 변경 범위 밖이고 실행 엔진의 설계 의도된 per-node I/O 패턴이다.
  - 제안: 이번 변경 범위에 해당하는 신규 N+1 문제 없음.

### 요약

이번 변경은 `node_execution` 테이블에 `(execution_id, status) WHERE status IN ('waiting_for_input','running')` partial 복합 인덱스(V095)를 추가하고, 해당 사실을 spec `data-flow/3-execution.md` §2.1 Schema 매핑 테이블에 반영한 1행 문서 변경이다. 변경 자체는 성능에 긍정적인 영향만 미친다 — `resolveWaitingNodeExecutionId`가 호출되는 continuation 재개 핫 경로에서 기존 `(execution_id)` 단일 인덱스 + post-filter 방식 대비 활성 행만 좁혀 I/O를 최소화한다. `CONCURRENTLY` + `executeInTransaction=false` 조합으로 운영 무중단 배포도 보장된다. 새로운 알고리즘 복잡도 증가, N+1 쿼리, 메모리 할당 이슈는 없다.

### 위험도

NONE
