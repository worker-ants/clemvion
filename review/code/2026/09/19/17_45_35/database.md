# Database 리뷰

## 발견사항

- **[INFO]** 스키마 변경(migration) 없이 엔티티 컬럼 메타데이터만 정정 — 무중단 배포 관점에서 안전
  - 위치: `codebase/backend/src/modules/alerts/entities/alert-rule.entity.ts` (`workspaceId`), `codebase/backend/src/modules/edges/entities/edge.entity.ts` (`type`), `codebase/backend/src/modules/integrations/entities/integration-usage-log.entity.ts` (`nodeExecutionId`, `workflowId`), `codebase/backend/src/modules/llm/entities/llm-usage-log.entity.ts` (`workspaceId`), `codebase/backend/src/modules/model-config/entities/model-config.entity.ts` (`kind`), `codebase/backend/src/modules/nodes/entities/node.entity.ts` (`category`), `codebase/backend/src/modules/workflow-assistant/entities/workflow-assistant-session.entity.ts` (`lastInteractionAt`), `codebase/backend/src/modules/workspaces/entities/workspace-invitation.entity.ts` (`workspaceId`)
  - 상세: 이번 diff 는 `type: 'uuid'` · `enumName` · `default` 를 TypeORM 엔티티 데코레이터에 추가해, 이미 존재하는 실제 DB 컬럼 정의(uuid 타입, enum 타입 이름, DEFAULT 값)와 선언을 맞추는 정정이다. 별도의 Flyway 마이그레이션 파일이 diff 에 없고(`git diff --stat` 확인, migrations 디렉터리 변경 0건), 앱은 `synchronize: false` 로 부팅하므로 이 변경 자체가 프로덕션 DB 에 DDL 을 내지 않는다 — lock·데이터 손실 위험이 없다. 아홉 곳 모두 "선언이 실제 DB 보다 좁게 추론되어 있던" 상태를 고치는 것이라 기존 쿼리 동작(파라미터 바인딩)도 바뀌지 않는다.
  - 제안: 없음 — 안전한 변경으로 판단.

- **[INFO]** `default` 선언 2건이 INSERT 쿼리에 `RETURNING` 절을 추가하는 실행 동작 변화를 유발함 (N+1 은 아님, 단일 라운드트립 유지)
  - 위치: `codebase/backend/src/modules/model-config/entities/model-config.entity.ts:46` (`kind: { default: 'chat' }`), `codebase/backend/src/modules/workflow-assistant/entities/workflow-assistant-session.entity.ts:75-79` (`lastInteractionAt: { default: () => 'now()' }`)
  - 상세: TypeORM 은 `default` 가 선언된 컬럼을 INSERT 후 `RETURNING` 으로 되돌려받아 엔티티 객체를 채운다(`ReturningResultsEntityUpdator`). 값 자체는 DB 기본값 그대로라 의미상 차이는 없고 추가 쿼리(N+1)가 발생하는 것도 아니지만, 생성되는 SQL 문 형태가 바뀐다. `plan/in-progress/entity-column-declaration-drift.md` 에 "런타임 영향" 으로 이미 명시돼 있고 전체 e2e(backend 354) 로 확인했다고 기록돼 있다.
  - 제안: 이미 검증된 사항이므로 추가 조치 불요. 향후 유사 변경 시에도 INSERT 경로의 회귀 스위트로 확인하는 패턴을 유지할 것.

- **[INFO]** 신규 e2e 가드(`entity-schema-declarations.e2e-spec.ts`)의 스키마 비교기 호출이 DDL 을 실행하지 않도록 이중 방어 + 커넥션 정리가 적절함
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` 526~565번째 줄 (`it('컬럼 — TypeORM 스키마 비교기가 컬럼 정의 변경을 내지 않는다 …')`)
  - 상세: TypeORM `createSchemaBuilder().log()` 는 자체 커넥션을 쓰기 때문에 트랜잭션으로 감쌀 수 없는데, 이를 (1) `extra.options: -c default_transaction_read_only=on` 으로 연 별도 읽기 전용 `DataSource` 로 예방하고 (2) 호출 전후 `information_schema.columns`/`pg_type` 해시 비교로 탐지하는 이중 방어를 두었다. 새로 연 `readOnly` DataSource 는 `try/finally` 로 `destroy()` 되어 커넥션이 누수되지 않는다. 기존 `ds`/`db` 도 `afterAll` 에서 정상적으로 해제된다.
  - 제안: 없음 — 테스트 코드지만 커넥션 관리·안전장치 설계가 모범적임.

- **[INFO]** 인덱스·N+1·트랜잭션·SQL 인젝션·대량 데이터 페이지네이션 관점에서 이번 diff 에 해당하는 변경 없음
  - 상세: 8개 엔티티 파일의 변경은 전부 컬럼 타입/enum 이름/기본값 어노테이션 추가뿐이며 새 인덱스·쿼리 로직·트랜잭션·raw SQL 문자열 조립은 포함하지 않는다. 나머지 diff 파일(`plan/**`, `review/consistency/**`)은 문서/리뷰 산출물로 DB 코드가 아니다.

## 요약
이번 변경은 아홉 곳의 TypeORM 엔티티 컬럼 선언이 실제 DB 스키마(uuid 타입·enum 타입 이름·DEFAULT 값)와 어긋나 있던 것을 바로잡는 순수 메타데이터 정정이며, 별도의 마이그레이션 파일이 없고 앱이 `synchronize: false` 로 동작하므로 프로덕션 DB 에 어떤 DDL 도 실행되지 않아 무중단 배포 관점에서 위험이 없다. 두 컬럼(`kind`, `lastInteractionAt`)에 `default` 를 추가해 INSERT 시 `RETURNING` 이 발생하는 실행 동작 변화가 있으나 의미상 동일하고 전체 e2e 로 검증됐다. 함께 추가된 e2e 가드는 TypeORM 스키마 비교기를 읽기 전용 세션 + 전후 카탈로그 해시 비교라는 이중 안전장치로 감싸 실제로 DDL 을 실행하지 않도록 설계했고, 커넥션 해제도 `try/finally`·`afterAll` 로 적절히 처리된다. 인덱스·N+1·트랜잭션·SQL 인젝션·대량 데이터 관점에서 새로 도입된 문제는 없다.

## 위험도
LOW
