# 부작용(Side Effect) 리뷰

## 검토 방법

리뷰 대상 6개 엔티티 파일 전부 `synchronize: false`(`app.module.ts`) 환경에서 TypeORM 데코레이터 인자만
정정하는 변경이라, DB 스키마 생성 코드 경로(migration)는 건드리지 않는다. 다음을 실측으로 확인했다(저장소
파일은 전혀 수정하지 않았고 `Read`/`grep` 만 사용):

- `codebase/backend/src/modules/**/entities/*.entity.ts` 밖에서 `onDelete` 메타데이터를 런타임에 읽어
  분기하는 코드가 있는지 — `grep -rln "onDelete" codebase/backend/src` 결과 전부 `*.entity.ts` (엔티티
  선언 자신)뿐, 애플리케이션 로직에서 이 메타데이터를 소비하는 곳 없음.
- 제거/이름 변경된 제약·인덱스 이름(`integration_expiry_dispatch_key`, `IDX_node_workflow_label` 등)을
  문자열로 참조하는 에러 핸들링·쿼리 코드가 있는지 — `grep -rn` 결과 없음(테스트 파일 자기 자신 제외).
- `ds.entityMetadatas` / `.indices` / `.uniques` / `.checks` / `.foreignKeys` 를 런타임에 소비하는
  애플리케이션 코드가 있는지 — 신규 e2e 스펙(`entity-schema-declarations.e2e-spec.ts`) 자신 말고는 없음.
- `node.entity.ts` 에서 제거된 `Index` import 가 파일 내 다른 곳에서 여전히 쓰이는지 — 쓰이지 않음(주석
  으로만 남음), 데드 import 아님.
- 신규 e2e 헬퍼가 읽는 `DB_HOST`/`DB_PORT`/`DB_USERNAME`/`DB_PASSWORD`/`DB_DATABASE` 기본값이 기존
  `test/helpers/db.ts` 의 `createDbClient()` 기본값과 정확히 일치하는지 — 일치 확인.

## 발견사항

- **[INFO]** `@Check`/`@Index`/`@Unique` 데코레이터 인자 형태 변경은 순수 메타데이터이며 `synchronize: false`
  라 DDL 을 발생시키지 않는다 — 확인된 부작용 없음
  - 위치: `codebase/backend/src/modules/edges/entities/edge.entity.ts:21`, `codebase/backend/src/modules/nodes/entities/node.entity.ts:24-27`, `codebase/backend/src/modules/node-executions/entities/node-execution.entity.ts:38-40`, `codebase/backend/src/modules/workflow-assistant/entities/workflow-assistant-session.entity.ts:23-33`, `codebase/backend/src/modules/workspaces/entities/workspace.entity.ts:21-24`, `codebase/backend/src/modules/integrations/entities/integration-expiry-dispatch.entity.ts:17`
  - 상세: TypeORM 데코레이터 시그니처(예: `@Check(expr)` → `@Check(name, expr)`)가 바뀌지만 이는 클래스 데코레이터이고 호출자가 없다 — "함수/메서드 시그니처 변경" 관점의 위험이 없다. 위 grep 으로 이 메타데이터(인덱스명·제약명·`onDelete`)를 애플리케이션 로직이 소비하는 곳이 없음을 확인했으므로, 이름·컬럼·부분조건이 바뀌어도 런타임 분기·에러 핸들링에 영향이 없다.
  - 제안: 없음(정보성 확인).

- **[INFO]** `workspace.entity.ts` 의 `@ManyToOne(() => User, { onDelete: 'CASCADE' })` 는 실제 DB(V001)와
  일치하는 방향으로 메타데이터를 정정한 것으로, 이 메타데이터를 소비하는 앱 코드가 없어 동작 변화가 없다
  - 위치: `codebase/backend/src/modules/workspaces/entities/workspace.entity.ts:38`
  - 상세: `synchronize: false` 이므로 이 변경으로 실제 CASCADE 동작이 새로 생기지 않는다(V001 마이그레이션이 이미 CASCADE). `relation.onDelete` 를 읽어 사전 삭제·경고 등을 수행하는 코드가 없음을 확인했다(위 grep). 다만 이 필드가 향후 사람이 읽고 "User 삭제 시 Workspace 가 CASCADE 로 사라진다"는 걸 코드에서도 알 수 있게 됐다는 점은 문서적 정합성 개선이지, 부작용은 아니다.
  - 제안: 없음.

- **[INFO]** 신규 e2e 가드는 새 DB 연결(raw `pg.Client` + 별도 `DataSource`)을 여닫지만 기존 e2e 스펙과 같은
  라이프사이클·환경변수 패턴을 그대로 따른다
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:47-67` (`beforeAll`/`afterAll`)
  - 상세: `beforeAll` 에서 `db.connect()`·`ds.initialize()`, `afterAll` 에서 `ds.destroy()`·`db.end()` 로 정확히 대칭적으로 정리한다. 읽는 환경변수(`DB_HOST`/`DB_PORT`/`DB_USERNAME`/`DB_PASSWORD`/`DB_DATABASE`)는 값을 새로 쓰지 않고, 기본값도 `test/helpers/db.ts` `createDbClient()` 와 동일해 다른 e2e 스펙과 접속 대상이 갈라지지 않는다. `docker-compose.e2e.yml` 네트워크 밖(예: 일반 `jest` unit 실행)에서 이 파일이 잘못 로드되면 `beforeAll` 에서 접속 실패로 죽는데, 이는 기존 e2e 스펙들과 동일한 특성이라 신규 위험이 아니다.
  - 제안: 없음.

- **[INFO]** 모든 DDL 프로브(`CREATE TEMP TABLE`·`CREATE INDEX`·`ALTER TABLE ... ADD CONSTRAINT`)는
  `BEGIN`…`ROLLBACK` 트랜잭션 안에서만 실행되어 공유 e2e DB 에 영구 부작용을 남기지 않는다
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` 함수 `inRolledBackTx`(70-77행) · `probeTable`(102-107행) · `normalizedPredicate`(128-147행) · `normalizedCheck`(150-166행)
  - 상세: `inRolledBackTx` 는 `finally` 블록에서 무조건 `ROLLBACK` 하므로 `fn()` 내부에서 예외가 나도(예: `expect` 실패) 트랜잭션이 커밋되지 않는다. `TEMP TABLE` 은 세션 범위라 트랜잭션이 롤백되거나 프로세스가 비정상 종료돼 연결이 끊겨도 자동 소멸한다. 유일하게 트랜잭션으로 감싸지 않은 테스트는 `'관계 FK …'` 케이스(330행)인데, 이 케이스는 `SELECT` 만 수행하고 어떤 DDL/DML 도 실행하지 않아 트랜잭션이 필요 없다 — 감싸지 않은 것이 결함이 아니라 일관적이다.
  - 제안: 없음.

- **[INFO]** `plan/`·`review/` 하위 신규 파일들(계획서, consistency-check 산출물)은 이 세션이 명시적으로
  수행한 워크플로(§CLAUDE.md `--impl-prep`/`--spec` 산출)의 정규 산출물이며 코드 실행에 영향을 주는 파일시스템
  부작용이 아니다
  - 위치: `plan/complete/spec-draft-assistant-i18n-table-sync.md`, `plan/in-progress/entity-schema-declaration-drift.md`, `review/consistency/2026/09/19/08_07_50/**`, `review/consistency/2026/09/19/08_23_02/**`, `review/consistency/2026/09/19/08_33_13/**`
  - 상세: 전부 신규 추가(diff 가 `/dev/null` 기준)이며 기존 파일을 덮어쓰거나 삭제하지 않는다. 코드 실행 경로(`codebase/**`)와 분리돼 있어 런타임 부작용 표면이 아니다.
  - 제안: 없음.

## 요약

이번 변경은 여섯 개 TypeORM 엔티티의 `@Index`/`@Unique`/`@Check`/`onDelete` 데코레이터 인자를 실제 DB(Flyway 마이그레이션) 상태에 맞춰 정정하는 순수 선언적 변경이며, `synchronize: false` 라 어떤 DDL 도 발생시키지 않는다. grep 으로 이 메타데이터(인덱스·제약 이름, `onDelete`)를 런타임에 소비하는 애플리케이션 코드가 전무함을 확인했으므로 시그니처·인터페이스·전역 상태 관점의 부작용은 없다. 신규 e2e 가드(`entity-schema-declarations.e2e-spec.ts`)는 별도 DB 연결을 열고 `CREATE TEMP TABLE`/`CREATE INDEX`/`ALTER TABLE ADD CONSTRAINT` 로 실제 프로브를 수행하지만, 모두 트랜잭션 내부에서 무조건 롤백되고 세션 종료 시 임시 객체가 자동 소멸해 공유 e2e DB 에 영구 흔적을 남기지 않는다. 환경변수 읽기 패턴·기본값도 기존 `test/helpers/db.ts` 관례와 일치해 새로운 접속 대상 drift 가 없다. `plan/`·`review/` 신규 파일들은 워크플로 규약이 요구하는 정규 산출물로, 코드 실행 경로 밖에 있다. 저장소 파일은 검증을 위해서도 전혀 수정하지 않았다(읽기 전용 조사만 수행).

## 위험도

NONE
