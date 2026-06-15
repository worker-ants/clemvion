# 데이터베이스(Database) 리뷰 결과

## 발견사항

### [INFO] getLatestPredecessorOutputs: In() + finishedAt DESC 조회에 복합 인덱스 없음
- **위치**: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `getLatestPredecessorOutputs` 메서드 (라인 ~7833)
- **상세**: 쿼리는 `WHERE execution_id = $1 AND node_id = ANY($2) AND status = 'completed' ORDER BY finished_at DESC` 형태로 실행된다. `node_execution` 테이블에 `(execution_id, node_id, status, finished_at)` 또는 최소 `(execution_id, node_id, status)` 복합 인덱스가 없으면 execution 단위 full scan 이 발생할 수 있다. 단일 노드 실행은 직속 predecessor 만 조회(대부분 1~3건)하므로 일반 실행에서는 영향이 제한적이나, 컨테이너 반복이 많은 execution(수천 NodeExecution 행)에서 predecessor seed 시 불필요한 행 스캔이 일어날 수 있다.
- **제안**: 기존 마이그레이션에서 `node_execution` 테이블에 `(execution_id, status, finished_at)` 또는 `(execution_id, node_id)` 인덱스가 존재하는지 확인하고, 없다면 별도 마이그레이션에서 추가를 검토한다. 단, 이 쿼리는 디버그 도구 경로(§1.3 단일 노드 테스트 전용)이며 핫 경로가 아니므로 즉시 차단 사안은 아니다.

### [INFO] V098 마이그레이션: FK 미추가는 의도적이나, previous_execution_id 가 다른 워크플로우 실행을 참조하는 경우 DB 레벨 방어 없음
- **위치**: `codebase/backend/migrations/V098__execution_single_node.sql`
- **상세**: 마이그레이션 주석에 "re_run_of/chain_id 선례를 따라 명시적 FK 제약은 두지 않는다"고 명기돼 있으며, 이는 dangling 허용 디버그 메타데이터로 설계 결정이 문서화돼 있다. 애플리케이션 레이어(controller)에서 `previousExecutionId`의 `workflowId` 일치 검증을 수행하므로 FK 없이도 IDOR는 방어된다. 다만 DB 레벨에서 `workflowId` 스코핑이 강제되지 않으므로, 향후 마이그레이션 스크립트나 다른 경로로 직접 INSERT 되는 경우 타 워크플로우 실행 id 가 저장될 수 있다.
- **제안**: 현재 디버그 전용·설계 의도 범위 내에서는 허용. 향후 이 컬럼이 분석/감사 용도로 확장될 경우 CHECK 제약 또는 워크플로우 스코핑 트리거 추가를 고려한다.

### [INFO] V098 마이그레이션: `execution` 테이블 대용량 시 ADD COLUMN 잠금
- **위치**: `codebase/backend/migrations/V098__execution_single_node.sql` — `ALTER TABLE execution ADD COLUMN`
- **상세**: PostgreSQL 11+ 에서 `NOT NULL DEFAULT` 없는 nullable ADD COLUMN 은 테이블 재작성 없이 카탈로그 변경만으로 완료되어 잠금이 매우 짧다(ACCESS EXCLUSIVE → 즉시 해제). 두 컬럼 모두 `NULL`·`DEFAULT NULL`이므로 무중단 배포에 안전하다. 단일 `ALTER TABLE` 으로 두 컬럼을 동시에 추가하는 것도 올바른 패턴이다.
- **제안**: 현재 마이그레이션은 안전. 추가 조치 불필요.

### [INFO] getLatestPredecessorOutputs: 노드별 최신 행 선택을 애플리케이션에서 처리
- **위치**: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `getLatestPredecessorOutputs` (라인 ~7842–7848)
- **상세**: `find({ where: { executionId, nodeId: In(predecessorIds), status: COMPLETED }, order: { finishedAt: 'DESC' } })`로 전체 조회 후 애플리케이션에서 `result.has(row.nodeId)` 체크로 노드별 첫 행만 취한다. 컨테이너 반복으로 동일 노드의 NodeExecution 이 수백 개 있는 경우 불필요한 행이 메모리에 올라올 수 있다. DB 레벨 `DISTINCT ON (node_id)` 또는 윈도우 함수(ROW_NUMBER OVER PARTITION BY node_id ORDER BY finished_at DESC)를 TypeORM QueryBuilder 로 표현하면 전송 행 수를 최소화할 수 있다.
- **제안**: 현재 사용 규모(predecessor 수는 통상 1~5, 반복 횟수는 드물게 수십)에서는 실질적 문제 없음. 대규모 반복 컨테이너 시나리오로 확장될 경우 QueryBuilder DISTINCT ON 패턴으로 전환 검토.

## 요약

V098 마이그레이션(`ALTER TABLE execution ADD COLUMN ... NULL`)은 nullable 컬럼 추가로 PostgreSQL 의 카탈로그 전용 변경 경로를 타므로 무중단 배포에 완전히 안전하다. FK 미추가는 선례(`re_run_of`, `chain_id`)와 일관되며 마이그레이션 주석에 명확히 문서화돼 있다. `previous_execution_id`의 워크플로우 스코핑은 DB 레벨이 아닌 컨트롤러 레이어에서 수행되나, 설계 결정 범위(디버그 메타데이터) 내에서는 수용 가능하다. `getLatestPredecessorOutputs`의 `In() + finishedAt DESC` 쿼리는 단일 노드 테스트 디버그 경로에서만 실행되며 predecessor 수가 적어 실질 성능 위험은 낮으나, `node_execution(execution_id, node_id, status)` 복합 인덱스 존재 여부 확인이 권장된다. 전체적으로 DB 설계와 마이그레이션은 기존 패턴을 일관되게 따르고 있다.

## 위험도

LOW
