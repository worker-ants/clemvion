# Database 리뷰

## 발견사항

- **[INFO]** 엔티티 컬럼 선언 8건은 전부 "기존 DB 실제 상태에 TypeORM 메타데이터 선언을 맞추는" 정정이며 `synchronize: false`이므로 런타임 DDL을 유발하지 않는다
  - 위치: `codebase/backend/src/modules/alerts/entities/alert-rule.entity.ts:19`, `codebase/backend/src/modules/workspaces/entities/workspace-invitation.entity.ts:18`, `codebase/backend/src/modules/integrations/entities/integration-usage-log.entity.ts:30-31`, `codebase/backend/src/modules/llm/entities/llm-usage-log.entity.ts:20`, `codebase/backend/src/modules/nodes/entities/node.entity.ts:48`, `codebase/backend/src/modules/edges/entities/edge.entity.ts:53-58`, `codebase/backend/src/modules/model-config/entities/model-config.entity.ts:46`, `codebase/backend/src/modules/workflow-assistant/entities/workflow-assistant-session.entity.ts:75-79`
  - 상세: 각 변경을 실제 Flyway 마이그레이션과 직접 대조했다 — `alert_rule`/`workspace_invitation`/`integration_usage_log`/`llm_usage_log`의 `workspace_id`·`node_execution_id`·`workflow_id`는 `V001__initial_schema.sql`에서 이미 `UUID NOT NULL`, `node.category`/`edge.type`의 enum 타입은 `V001`에서 이미 `node_category`/`edge_type`이라는 이름으로 생성됨, `model_config.kind`의 `DEFAULT 'chat'`은 `V088__model_config_rename_kind.sql`에서 이미 존재, `workflow_assistant_session.last_interaction_at`의 `DEFAULT now()`는 `V019__workflow_assistant.sql`에서 이미 존재. 즉 DB 스키마는 변경되지 않고 TypeORM이 갖고 있던 잘못된(추론) 메타데이터만 실제와 일치시켰다 — 무중단 배포 관점에서 lock·데이터 손실 위험이 없다.
  - 제안: 조치 불필요. `default`가 추가된 두 컬럼(`model_config.kind`, `workflow_assistant_session.last_interaction_at`)은 plan 문서에 적힌 대로 TypeORM이 insert 후 `RETURNING`으로 해당 컬럼을 다시 읽어오게 되는 부수효과가 있다 — 값 자체는 DB 기본값과 동일하므로 정합성 문제는 아니고 무시 가능한 수준의 추가 컬럼 반환일 뿐이다.

- **[INFO]** `type: 'uuid'` 선언 추가가 TypeORM의 파라미터 바인딩 캐스팅(예: `WHERE workspace_id = $1::uuid`)을 활성화할 수 있어, 호출 측이 유효하지 않은 UUID 문자열을 넘기던 경로가 있다면 이전엔 통과하던 요청이 이제 Postgres 레벨에서 `invalid input syntax for type uuid` 오류로 바뀔 가능성이 있다
  - 위치: `codebase/backend/src/modules/alerts/entities/alert-rule.entity.ts:19` 등 `type: 'uuid'`가 추가된 5개 컬럼
  - 상세: 실제 DB 컬럼은 이미 `uuid` 타입이므로 잘못된 문자열은 원래도 DB가 거부했다 — 다만 오류가 나는 스택 위치(애플리케이션 검증 vs DB 드라이버 캐스팅)가 미세하게 달라질 수 있다. 실질적 회귀 가능성은 낮음.
  - 제안: TEST WORKFLOW(e2e 포함)로 이미 커버되는 사안이라 별도 조치는 불필요. 문제가 관측되면 해당 엔드포인트의 UUID 형식 검증(DTO validation)을 확인.

- **[INFO]** 신설 e2e 가드(`entity-schema-declarations.e2e-spec.ts`)의 설계가 데이터베이스 안전성 관점에서 견고함을 확인
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` (`inRolledBackTx`, `attempt`/`SAVEPOINT`, `beforeAll`/`afterAll`)
  - 상세: 인덱스·CHECK 비교 테스트는 임시 테이블(`CREATE TEMP TABLE ... LIKE`)과 인덱스·제약을 만들어 검증한 뒤 트랜잭션 전체를 `ROLLBACK`하므로 DB에 흔적을 남기지 않는다. 개별 실패는 `SAVEPOINT`로 격리해 트랜잭션을 계속 쓸 수 있게 한다. `DataSource`(TypeORM)와 `pg.Client` 커넥션 모두 `afterAll`에서 `destroy()`/`end()`로 명시적으로 해제한다. 새로 추가된 컬럼-층 테스트는 `createSchemaBuilder().log()`로 DDL을 실행하지 않고 기록만 하므로(코드 주석과 TypeORM 소스로 확인됨) 이 테스트 자체는 DB를 변경하지 않는다.
  - 제안: 조치 불필요.

- **[INFO]** DDL 문자열을 조합하는 헬퍼(`normalizedPredicate`/`normalizedCheck`/`probeTable`)가 이스케이프 없이 문자열을 이어 붙이지만, 입력이 외부 요청이 아니라 TypeORM 엔티티 데코레이터의 리터럴 메타데이터로 한정되어 있고 코드 주석으로도 그 경계가 명시되어 있어 SQL 인젝션 관점의 실질적 위험은 없음
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:236-275` (`normalizedPredicate`, `normalizedCheck`)
  - 상세: 테이블명·컬럼명은 `db.escapeIdentifier`로 이스케이프하지만 `where`/`expression` 식 자체는 그대로 SQL에 삽입한다. 다만 이 값들은 소스 코드 내 `@Index({ where: ... })`/`@Check(...)` 데코레이터 문자열에서만 오며, 테스트 전용 코드이자 매 호출이 트랜잭션/세이브포인트로 격리된다.
  - 제안: 조치 불필요 (현행 문서화된 경계 유지 권장).

## 요약
이번 변경은 애플리케이션 코드의 엔티티 컬럼 데코레이터 8건을 실제 Postgres DB의 기존 상태(uuid 타입, enum 타입 이름, DEFAULT 값)에 맞춰 정정한 것으로, `synchronize: false` 환경에서 어떤 DDL도 실행하지 않는 순수 메타데이터 정정이다. Flyway 마이그레이션 파일(V001, V019, V088)을 직접 대조해 각 정정이 실제 DB 상태와 일치함을 확인했으며, 마이그레이션 파일 자체는 이번 diff에 포함되지 않아 lock·데이터 손실 위험이 전혀 없다. 함께 추가된 e2e 가드(TypeORM 스키마 비교기 기반 컬럼-층 drift 탐지)는 트랜잭션 롤백·세이브포인트·명시적 커넥션 해제를 갖춘 견고한 설계다. Critical/Warning 수준의 데이터베이스 이슈는 발견되지 않았다.

## 위험도
LOW
