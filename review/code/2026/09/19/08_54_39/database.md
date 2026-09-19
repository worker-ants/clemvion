# 데이터베이스(Database) 리뷰

## 범위 확인

프롬프트에 번들된 36개 파일 중 실제 DB 관점 대상은 다음뿐이다. 나머지(파일 8·10~36)는 i18n spec 표 정정·consistency-check 산출물(`review/consistency/**`)·plan 문서로 DB 코드 변경이 아니다.

- `codebase/backend/src/modules/edges/entities/edge.entity.ts`
- `codebase/backend/src/modules/integrations/entities/integration-expiry-dispatch.entity.ts`
- `codebase/backend/src/modules/node-executions/entities/node-execution.entity.ts`
- `codebase/backend/src/modules/nodes/entities/node.entity.ts`
- `codebase/backend/src/modules/workflow-assistant/entities/workflow-assistant-session.entity.ts`
- `codebase/backend/src/modules/workspaces/entities/workspace.entity.ts`
- `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` (신규 e2e 가드)
- `plan/in-progress/entity-schema-declaration-drift.md` (근거 문서)

이 변경은 `app.module.ts` 의 `synchronize: false` 하에서 TypeORM 엔티티 데코레이터(`@Index`/`@Unique`/`@Check`/`@ManyToOne.onDelete`)의 **선언**을 실제 DB(Flyway V001·V009·V019·V095·V109) 와 맞추는 것이다. 스키마 자체를 바꾸는 마이그레이션은 포함되지 않는다.

## 검증 방법

각 엔티티 파일을 직접 `Read` 하고, 대응 Flyway 마이그레이션(`codebase/backend/migrations/V001__initial_schema.sql`, `V009__*.sql`, `V019__workflow_assistant.sql`, `V095__node_execution_exec_status_active_index.sql`, `V109__workspace_personal_owner_unique.sql`)을 직접 열어 8개 정정 전부를 실측 대조했다.

| 파일 | 정정 내용 | 마이그레이션 대조 결과 |
|---|---|---|
| `edge.entity.ts:21` | `@Check('chk_no_self_loop', 'source_node_id != target_node_id')` | V001 L135 `CONSTRAINT chk_no_self_loop CHECK (source_node_id != target_node_id)` 와 일치. 이전 선언(`` `"source_node_id != target_node_id"` ``)은 식 전체를 큰따옴표로 감싸 SQL 상 컬럼명이 되어 애초에 생성 불가능했다 — 정정이 맞다. |
| `node.entity.ts:24-27` | `@Check('chk_node_placement', 'NOT (container_id IS NOT NULL AND tool_owner_id IS NOT NULL)')` | V001 L113-115 와 일치, 같은 클래스의 결함(따옴표) 정정. |
| `node.entity.ts:32-33` (주석) | `@Index('IDX_node_workflow_label', ...)` 제거 | `node` 테이블 인덱스는 `idx_node_workflow (workflow_id)` 하나뿐 — 라벨 유니크는 앱 레이어 강제(`spec/5-system/5-expression-language.md` §8.3.2). 제거가 맞다. |
| `node-execution.entity.ts:38-40` | `@Index('idx_node_execution_exec_status_active', ['executionId','status'], { where: "status IN ('waiting_for_input', 'running')" })` | V095 의 partial index 정의와 컬럼·조건·이름 모두 일치. |
| `workflow-assistant-session.entity.ts:23-33` | 두 인덱스에 `userId` 추가 + 이름 명시 | V019 L30-33 의 `idx_workflow_assistant_session_wf_user_active (workflow_id, user_id, status, last_interaction_at DESC)` / `idx_workflow_assistant_session_user_recent (workspace_id, user_id, updated_at DESC)` 와 컬럼 순서까지 일치. |
| `workspace.entity.ts:21-24` | `@Index('uq_workspace_personal_owner', ['ownerId'], { unique: true, where: "type = 'personal'" })` | V109 정의와 일치. |
| `integration-expiry-dispatch.entity.ts:17` | `@Unique(['integrationId','threshold','tokenExpiresAt'])` (이름 제거) | V009 L51 `UNIQUE (integration_id, threshold, token_expires_at)` — 이름 없는 제약이 맞고, 참조하는 코드가 없다는 서술도 타당(`ON CONFLICT DO NOTHING` 은 대상 미지정). |
| `workspace.entity.ts:38` | `@ManyToOne(() => User, { onDelete: 'CASCADE' })` | V001 L41 `owner_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE` 와 일치. |

8개 전부 실측과 부합한다 — 별도 이견 없음.

## 발견사항

- **[INFO]** 신규 e2e 가드(`entity-schema-declarations.e2e-spec.ts`)의 SQL 조립 방식
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` 함수 `normalizedPredicate`(128-147행), `normalizedCheck`(150-166행)
  - 상세: `where`/`expression` 값을 파라미터 바인딩 없이 문자열로 직접 SQL 에 이어붙인다(`CREATE INDEX ... WHERE ${where}`, `ALTER TABLE ... CHECK (${expression})`). 값은 사용자 입력이 아니라 `ds.entityMetadatas` 에서 나온 엔티티 데코레이터 리터럴(소스 코드에 하드코딩된 문자열)이라 실질적인 SQL 인젝션 표면은 아니다. 다만 테이블/컬럼 식별자는 `db.escapeIdentifier` 로 이스케이프하면서 조건식·CHECK 식만 예외로 남긴 것은 "파라미터화 원칙"의 일관성 관점에서 눈에 띈다.
  - 제안: 현재 리스크는 낮아 조치 불요. 다만 이 헬퍼를 다른 테스트가 재사용해 외부 입력(예: fixture 파일에서 읽은 문자열)을 넘기게 되면 그때는 검증이 필요하다는 점을 헬퍼 JSDoc 에 한 줄 남겨두면 향후 오용을 막을 수 있다.

- **[INFO]** e2e 가드의 격리·정리(cleanup) 설계는 양호
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` `inRolledBackTx`(70-77행), `attempt`(80-95행)
  - 상세: 인덱스/제약 생성 프로브를 전부 `BEGIN`+`ROLLBACK`(SAVEPOINT 로 개별 실패 격리) 안에서 수행해 임시 테이블·인덱스가 DB 에 남지 않는다. `beforeAll`/`afterAll` 에서 `Client`·`DataSource` 를 각각 열고 닫아 커넥션 누수도 없다. 별도 조치 불요 — 확인 목적의 기록.

- **[INFO]** `onDelete: 'CASCADE'` 선언 정정은 동작 변화가 아니다
  - 위치: `codebase/backend/src/modules/workspaces/entities/workspace.entity.ts:38`
  - 상세: `synchronize: false` 이므로 이 데코레이터 변경은 DB DDL 을 만들지 않고, TypeORM 의 `onDelete` 는 애플리케이션 런타임 cascade(예: `repository.remove()`)에 관여하지 않는 순수 DDL/문서 메타데이터다. 즉 이번 정정으로 "User 삭제 시 Workspace 가 연쇄 삭제된다"는 실제 동작은 이미 V001 이후 그대로였고 코드가 이를 뒤늦게 정확히 반영할 뿐이다. `plan/in-progress/entity-schema-declaration-drift.md` 와 함께 제출된 consistency-checker 산출물(`review/consistency/2026/09/19/08_07_50/rationale_continuity.md`)이 이미 "user 참조 FK 13개 재처분 게이트를 발동시키지 않는다"고 짚었고 이 판단에 동의한다 — 중복 지적 아님, 확인만.

## 요약

이번 변경은 스키마를 바꾸는 마이그레이션이 아니라, `synchronize: false` 하에서 코드가 실제 DB(Flyway V001·V009·V019·V095·V109)와 다르게 주장하던 TypeORM 엔티티의 `@Index`/`@Unique`/`@Check`/FK `onDelete` 선언 8곳을 정합화하는 작업이다. 각 마이그레이션 파일을 직접 열어 8개 항목 전부를 대조했고 모두 실제와 일치한다. 특히 두 건(`edge`/`node` 의 `@Check`)은 이전 선언이 SQL 로 아예 생성 불가능한 결함(식 전체를 따옴표로 감싼 컬럼명)이었음을 확인했다. 신규 e2e 가드는 문자열 비교가 아니라 임시 테이블에 실제로 인덱스/CHECK 를 만들어 Postgres 가 정규화한 정의로 비교하고, 트랜잭션+SAVEPOINT 로 격리·롤백하는 설계가 견고하다. 인덱스 오용·N+1·트랜잭션 누락·무중단 배포 위험·커넥션 누수·SQL 인젝션·대량 데이터 성능 관점에서 실질적 결함은 발견되지 않았다. 유일하게 언급할 만한 점은 e2e 헬퍼가 조건식/CHECK 식을 이스케이프 없이 문자열로 조립한다는 것인데, 값이 소스 코드 리터럴이라 현재는 인젝션 표면이 아니다.

## 위험도
LOW
