# 데이터베이스(Database) 리뷰

## 발견사항

- **[INFO]** 신규 e2e 가드가 CHECK 식·부분 인덱스 조건 문자열을 이스케이프 없이 SQL 에 그대로 이어 붙인다
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` — `normalizedPredicate()`, `normalizedCheck()` 함수 (파일 내 주석 "아래 두 함수는 식을 이스케이프 없이 SQL 에 이어 붙인다" 바로 아래)
  - 상세: `where`/`expression` 값은 런타임 사용자 입력이 아니라 TypeORM 이 엔티티 데코레이터에서 뽑은 컴파일타임 문자열 리터럴(예: `"status IN ('waiting_for_input', 'running')"`)이다. 컬럼명·테이블명은 `db.escapeIdentifier()`로 이스케이프하면서 이 두 값만 원문 그대로 SQL에 붙인다. 코드 자체가 "외부 입력을 넘기는 용도로 쓰지 말 것"이라고 명시해 위험을 인지하고 있고, 테스트 전용 코드가 ROLLBACK 트랜잭션 안에서만 실행되므로 실질 위험은 없다. 다만 프로덕션 코드에 유사 패턴(신뢰 안 되는 문자열을 조건절에 직접 삽입)이 재사용되지 않도록 계속 테스트 파일 스코프에 한정할 것.
  - 제안: 조치 불요(문서화된 의도적 트레이드오프). 향후 이 헬퍼를 프로덕션 코드나 다른 테스트로 옮길 때만 재검토.

- **[INFO]** `workspace.entity.ts` `owner` 관계에 `onDelete: 'CASCADE'`가 새로 명시됨 — 선언과 실제 DB(V001 `ON DELETE CASCADE`) 정합화일 뿐 동작 변경 아님
  - 위치: `codebase/backend/src/modules/workspaces/entities/workspace.entity.ts:38` (`@ManyToOne(() => User, { onDelete: 'CASCADE' })`)
  - 상세: `synchronize: false`이므로 이 데코레이터 변경 자체는 DB 스키마나 런타임 동작에 영향이 없다(선언이 실제 FK 정의를 뒤늦게 정확히 반영하는 것뿐). 다만 이 선언은 코드 리더에게 "User 삭제 시 Workspace 가 CASCADE 로 함께 삭제된다"는 것을 이제야 정확히 알리므로, 향후 User 삭제 기능이 추가될 때 이 CASCADE 경로(및 동일한 다른 12개 User FK)가 실제로 검토 대상임을 상기시킨다. plan 문서(`plan/in-progress/entity-schema-declaration-drift.md`)와 consistency 리포트 모두 이 점을 이미 인지하고 게이트 미발동을 명시적으로 밝혀 두었다.
  - 제안: 조치 불요.

## 검증 메모 (읽기 전용, 저장소 변경 없음)

- 마이그레이션(`V001`, `V009`, `V019`, `V095`, `V109`)을 직접 열어 이번 PR의 인덱스/제약 이름·컬럼 순서·조건절이 실제 DDL과 정확히 일치함을 확인함(`idx_workflow_assistant_session_wf_user_active` 컬럼 순서, `chk_no_self_loop`/`chk_node_placement` 식, `idx_node_execution_exec_status_active`의 `WHERE` 절, `uq_workspace_personal_owner`의 부분 유니크, `integration_expiry_dispatch`의 무명 UNIQUE 모두 일치).
- 이번 diff는 `codebase/backend/**/entities/*.entity.ts` 6개 파일(데코레이터 값만 변경, `synchronize: false`)과 신규 e2e 테스트 1개뿐이며, **신규/변경 마이그레이션 파일은 없다** — 즉 DB 스키마·데이터에 대한 실제 변경이나 무중단 배포 리스크는 없음.
- 신규 e2e 가드(`entity-schema-declarations.e2e-spec.ts`)는 `beforeAll`/`afterAll`에서 `pg.Client`와 TypeORM `DataSource`를 각각 열고 정확히 한 번씩 닫아 커넥션 누수가 없다. 인덱스/유니크/CHECK 검증은 트랜잭션 + `ROLLBACK`으로 감싸 임시 테이블·인덱스가 DB에 잔존하지 않도록 했고, 개별 프로브 실패는 `SAVEPOINT`로 격리해 다른 검증에 영향을 주지 않는다 — 테스트 코드로서 트랜잭션·자원 관리가 적절하다.
- N+1 관점: 인덱스/유니크 검증 루프는 엔티티 메타데이터 개수만큼 반복 쿼리를 실행하지만(전수 스캔), 이는 일회성 CI e2e 가드이고 대상 규모(엔티티 41개, 선언 104개)가 작아 실질적 성능 문제가 아니다. 애플리케이션 런타임 코드(서비스·리포지토리)에는 이번 diff에서 변경이 없다.
- 인덱스/스키마 설계 관점에서 8곳 정정(부분 인덱스 `where` 절 명시, 컬럼 누락 정정, 존재하지 않는 인덱스·제약 제거, FK `onDelete` 명시)은 모두 "선언 ↔ 실제 DB" 정합화이며 설계 자체의 변경이 아니다. `workspace`의 `(owner_id) WHERE type='personal'` 부분 유니크, `node_execution`의 `(execution_id, status) WHERE status IN (...)` 부분 복합 인덱스 등은 정상적인 부분 인덱스 활용 패턴이다.

## 요약

이번 변경은 스키마를 바꾸는 마이그레이션이 아니라, TypeORM 엔티티 데코레이터(`@Index`/`@Unique`/`@Check`/`onDelete`)의 선언이 실제 Postgres DB(Flyway V001~V132)와 어긋나 있던 8곳을 정정하고, 향후 재발을 막는 e2e 회귀 가드(`entity-schema-declarations.e2e-spec.ts`)를 추가한 것이다. `synchronize: false`이므로 런타임 동작·쿼리 성능·데이터 정합성에 실질적 영향은 없으며, 신규/변경 마이그레이션이 없어 무중단 배포 리스크도 없다. 각 정정 사항을 마이그레이션 파일과 직접 대조한 결과 이름·컬럼 순서·부분 조건이 모두 실제 DDL과 정확히 일치했다. 신규 e2e 가드는 트랜잭션+ROLLBACK, SAVEPOINT, 커넥션 정리 등 테스트 자원 관리가 견고하고, 신뢰되지 않는 문자열이 아닌 컴파일타임 데코레이터 리터럴만 SQL에 직접 삽입한다는 점을 코드 주석으로 명시해 SQL 인젝션 우려도 실질적으로 낮다. 전반적으로 데이터베이스 관점에서 위험이 낮은, 선언 정확성을 높이는 정정 및 회귀 방지 작업이다.

## 위험도

LOW
