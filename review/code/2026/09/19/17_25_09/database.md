# 데이터베이스(Database) 코드 리뷰

## 발견사항

- **[INFO]** 컬럼 타입 · enum 이름 · 기본값 선언 정정은 `synchronize: false` 하에서 런타임 DDL 을 유발하지 않는다 — 메타데이터만 실제 DB 와 맞춘다
  - 위치: `codebase/backend/src/modules/alerts/entities/alert-rule.entity.ts:19`, `codebase/backend/src/modules/integrations/entities/integration-usage-log.entity.ts:30-31`, `codebase/backend/src/modules/llm/entities/llm-usage-log.entity.ts:20`, `codebase/backend/src/modules/workspaces/entities/workspace-invitation.entity.ts:18` (모두 `type: 'uuid'` 추가), `codebase/backend/src/modules/edges/entities/edge.entity.ts:53-58`, `codebase/backend/src/modules/nodes/entities/node.entity.ts:48` (`enumName` 추가), `codebase/backend/src/modules/model-config/entities/model-config.entity.ts:46`, `codebase/backend/src/modules/workflow-assistant/entities/workflow-assistant-session.entity.ts:75-79` (`default` 추가)
  - 상세: 아홉 곳 모두 Flyway 마이그레이션 없이 TypeORM 데코레이터만 고친다. `plan/in-progress/entity-column-declaration-drift.md` 의 실측(비교기 `log()` 로 358문 → 326문)에 따르면 남는 문은 이름 차이로 인한 FK·인덱스 재생성(선언과 무관)과 의도적으로 생략한 `embedding`(vector) 컬럼 `DROP COLUMN` 뿐이다. `default: () => 'now()'` 선언 하나만 실제 동작에 영향을 준다 — INSERT 후 TypeORM 이 `RETURNING` 으로 그 컬럼을 엔티티에 채운다(같은 INSERT 문 안의 RETURNING 절이라 추가 라운드트립은 아님). 무중단 배포 관점에서 이 diff 자체는 위험이 없다.
  - 제안: 없음 (이미 안전).

- **[INFO]** `enumName` 누락은 `synchronize: true` 가 실수로 켜지는 환경(로컬/테스트)에서 enum 타입을 지웠다 다시 만드는 위험한 DDL 을 낼 뻔했다 — 이번 수정이 그 잠재 결함을 막는다
  - 위치: `codebase/backend/src/modules/edges/entities/edge.entity.ts:53-58`(`type` 컬럼), `codebase/backend/src/modules/nodes/entities/node.entity.ts:48`(`category` 컬럼)
  - 상세: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:82-85` 에 채집된 표본(`ALTER TYPE ... RENAME TO ..._old`, `CREATE TYPE ..._enum AS ENUM(...)`, `ALTER TABLE ... ALTER COLUMN ... TYPE ..._enum USING ...`, `DROP TYPE ..._old`)이 `enumName` 을 안 적었을 때 비교기가 실제로 냈던 DDL 이다. 운영 DB 는 `synchronize: false` 라 직접 위험은 없지만, 이 표본 자체가 "선언 누락이 곧 잠재적 파괴적 마이그레이션"이라는 근거이므로 이번 수정은 정당한 결함 제거다.
  - 제안: 없음 (정보성 확인).

- **[INFO]** 신규 e2e 가드(`entity-schema-declarations.e2e-spec.ts`)의 트랜잭션·커넥션 관리는 적절
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` `beforeAll`/`afterAll`(연결 초기화·해제), `inRolledBackTx`/`attempt`(SAVEPOINT), 컬럼 층 테스트(507-545행)
  - 상세: `pg.Client` 와 TypeORM `DataSource` 를 `beforeAll` 에서 열고 `afterAll` 에서 `ds?.destroy()` / `db?.end()` 로 반드시 해제한다. 인덱스·CHECK 검증은 트랜잭션을 열고 임시 테이블(`CREATE TEMP TABLE ... LIKE`)로 실제 제약을 만들어본 뒤 무조건 `ROLLBACK` 해 DB 에 잔여물을 남기지 않는다. 마지막 컬럼-레벨 테스트는 `createSchemaBuilder().log()` — 이 메서드가 카탈로그를 읽기만 하고 DDL 을 기록만 한다는 전제를 "공개 계약이 아니다"라고 스스로 밝히고, 호출 전후 `information_schema.columns`/`pg_type` 해시를 직접 비교해 그 전제를 검증한다(520-535행). 리뷰 대상 코드가 스스로 자기 전제를 실측 검증하는 드문 형태로, 커넥션·트랜잭션 위생 면에서 문제 없음.
  - 제안: 없음.

- **[INFO]** 테스트 헬퍼의 raw SQL 문자열 결합은 신뢰된 소스(엔티티 데코레이터 메타데이터)에서만 온다 — 프로덕션 SQL 인젝션 경로 아님
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:266-308`(`normalizedPredicate`, `normalizedCheck`)
  - 상세: `where`/`expression` 인자는 사용자 입력이 아니라 엔티티 `@Index({ where })`/`@Check(expression)` 데코레이터의 문자열 리터럴(소스 코드 상수)이며, 코드 자체가 "외부 입력을 넘기는 용도로 쓰지 말 것"이라 주석으로 명시한다(266-267행). 테이블/컬럼 이름은 `db.escapeIdentifier` 로 이스케이프된다. 다만 재사용 범위가 넓어지면(예: 동적 입력을 받는 유틸로 전용되면) 위험해질 수 있는 패턴이라 향후 재사용 시 이 경계를 넘지 않도록 유의할 필요는 있다.
  - 제안: 향후 이 헬퍼를 테스트 밖(런타임 코드)으로 재사용하지 말 것.

- **[INFO]** 마이그레이션 안전성 — 이번 diff 는 Flyway 마이그레이션 파일을 추가하지 않는다
  - 위치: 변경된 8개 엔티티 파일 전체
  - 상세: 스키마의 SoT 는 Flyway 이고 TypeORM 은 `synchronize: false` 라, 이 아홉 곳 정정은 배포 시 lock 이나 데이터 손실 위험이 있는 DDL 을 전혀 유발하지 않는다. 실제 DB 스키마는 이미 정정된 값(uuid, enum 타입 이름, DEFAULT)을 갖고 있고 엔티티 선언이 그 사실을 뒤늦게 따라잡는 구조다.
  - 제안: 없음.

## 요약
변경분은 여덟 개 TypeORM 엔티티의 컬럼 선언(타입 · enum 이름 · 기본값)이 실제 PostgreSQL 스키마와 어긋나 있던 것을 정정하고, 그 회귀를 막을 컬럼-층 e2e 가드(스키마 비교기 `log()` 를 이용한 DDL-없는 검증)를 추가한 것이다. `synchronize: false` 환경이라 이번 diff 자체는 실제 DDL 을 발생시키지 않아 무중단 배포 위험이 없고, 오히려 `enumName` 누락처럼 `synchronize: true` 가 실수로 켜졌을 때 enum 타입을 파괴적으로 재생성했을 잠재 결함을 제거한다. 신규 테스트는 트랜잭션(ROLLBACK)·SAVEPOINT·커넥션 해제를 적절히 쓰고, 자신이 의존하는 TypeORM 비공개 동작 전제(“log()가 DB를 바꾸지 않는다”)를 카탈로그 해시 비교로 직접 실측 검증하는 등 방어적으로 작성됐다. 인덱스·N+1·트랜잭션·대량 데이터 페이지네이션·SQL 인젝션(프로덕션 코드 경로) 관점에서 새로 도입된 위험은 없다.

## 위험도
LOW
