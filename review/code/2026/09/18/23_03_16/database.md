# 데이터베이스(Database) 리뷰

## 발견사항

### [INFO] 신규 인덱스 10개(V121~V130) — 무중단 마이그레이션 규약 완전 준수
- 위치: `codebase/backend/migrations/V121__edge_target_node_id_index.sql` ~ `V130__model_config_workspace_kind_index.sql` (10쌍의 `.conf`/`.sql`)
- 상세: 각 `.sql` 은 `DROP INDEX CONCURRENTLY IF EXISTS <신규 인덱스명>` (invalid 잔재 정리) → `CREATE INDEX CONCURRENTLY IF NOT EXISTS` 순서 하나만 담고, 동봉 `.conf` 에 `executeInTransaction=false` 를 둬 Flyway 트랜잭션 밖에서 실행되도록 했다. 이는 `migrations/README.md §5` "신규 추가에도 0) 을 둡니다" 규약(V111~V120 선례) 과 문자 그대로 일치하며, transactional statement 와 `CONCURRENTLY` 를 같은 파일에 섞는 실수(Flyway mixed 판정 위반)도 없다. FK `ON DELETE` 동작(예: `edge.target_node_id` CASCADE, `llm_usage_log/workflow/workflow_assistant_session/trigger` 의 `llm_config_id`/`folder_id`/`auth_config_id` SET NULL 등)은 `V001`/`V014`/`V019` 원본 제약과 대조해 전부 주석 서술과 일치함을 확인했다.
- 제안: 없음 (수정 불요, 우수 사례로 기록).

### [INFO] `model_config` 부분 인덱스와의 비중복성 확인
- 위치: `codebase/backend/migrations/V130__model_config_workspace_kind_index.sql:22` (`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_model_config_workspace_kind ON model_config (workspace_id, kind);`)
- 상세: 기존 `V089__model_config_kind_default_unique.sql` 이 만든 `model_config_workspace_kind_default_unique` 는 `(workspace_id, kind) WHERE is_default = true` 부분 유니크 인덱스라, `is_default` 조건이 없는 목록 조회(`workspace_id = ? AND kind = ?`)와 FK 트리거 조회는 이를 쓸 수 없다. V130 이 조건 없는 별도 비-유니크 인덱스를 추가한 것은 중복이 아니라 정당한 보완이다.
- 제안: 없음.

### [INFO] e2e 검증이 `indisvalid`·부분조건까지 대조 — invalid 인덱스 회귀 방지
- 위치: `codebase/backend/test/deletion-cascade-indexes.e2e-spec.ts` (V121~V130 항목 10개 추가, `EXPECTED` 배열)
- 상세: 각 신규 인덱스에 대해 정규식으로 선두 컬럼 순서와 `WHERE` 부분조건까지 정확히 대조하고, 존재 여부뿐 아니라 `indisvalid` 도 검사한다. `CREATE INDEX CONCURRENTLY` 실패 시 이름만 점유한 invalid 인덱스가 남아 조용히 seq scan 으로 회귀하는 실패 모드를 이 테스트가 잡는다.
- 제안: 없음.

### [INFO] 트랜잭션·커넥션 관리·SQL 인젝션·N+1 — 해당 변경 범위에 관련 코드 없음
- 상세: 이번 변경은 정적 DDL(신규 인덱스 생성)과 e2e 단언, spec/plan 문서로만 구성되며 애플리케이션 쿼리 코드(Repository/QueryBuilder), 반복문 내 쿼리, 트랜잭션 경계, 커넥션 풀 사용 코드는 포함하지 않는다. `CREATE/DROP INDEX CONCURRENTLY` 는 원리적으로 트랜잭션 블록 안에서 실행 불가하므로 `executeInTransaction=false` 로 우회한 것은 올바른 처리다.

## 요약

`edge.target_node_id`, `llm_usage_log.llm_config_id`, `workflow.folder_id`, `folder.parent_id`, `workflow_assistant_session.llm_config_id`, `trigger.auth_config_id`, `auth_config.workspace_id`, `knowledge_base.workspace_id`, `workspace_member.user_id`, `model_config.(workspace_id, kind)` 열 개에 대해 `CREATE INDEX CONCURRENTLY` 기반 무중단 인덱스를 추가하는 순수 DB 마이그레이션 PR이다. 각 인덱스는 FK 삭제 연쇄 비용(캔버스 저장 29→0.15ms, 워크플로 삭제 307→1.8ms, 워크스페이스 삭제 3,161→50ms 등) 또는 인덱스 없이 테이블 전체를 훑던 목록 조회 경로(인증 설정·KB 목록, 사용자별 워크스페이스 목록 등)를 실측 기반으로 정당화하며, FK `ON DELETE` 동작과 partial 조건 선택 근거를 모두 원본 스키마와 대조해 확인했다. `.conf`/`.sql` 페어링, DROP-먼저 관례, e2e 의 `indisvalid`+정의 대조까지 기존 V111~V120 선례를 어긋남 없이 그대로 따르고 있어 무중단 배포 안전성·인덱스 적절성 측면에서 결함을 찾지 못했다. `model_config` 신규 인덱스가 기존 부분 유니크 인덱스와 중복되지 않음도 확인했다. 트랜잭션·커넥션 관리·N+1·SQL 인젝션 관점에서는 해당 코드가 이번 diff 범위에 없다.

## 위험도
NONE
