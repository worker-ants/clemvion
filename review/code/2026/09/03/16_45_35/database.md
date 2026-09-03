# 데이터베이스(Database) 리뷰

## 검토 범위 확인

이번 변경(`entity-nullable-column-type-mismatch` 배치 2)은 9개 TypeORM 엔티티 파일의 필드
타입을 `nullable: true` 인 기존 DB 컬럼에 맞춰 `T | null` 로 넓히고, 일부 `@Column` 에
`type:` (예: `'varchar'`, `'int'`)을 명시적으로 추가하는 **타입 선언 정합화**다.
`shared/utils/redact-stored-error.ts` 는 그 여파로 시그니처가 넓어진 소비자 측 정정이고,
`plan/in-progress/entity-nullable-column-type-mismatch.md` 는 작업 기록 문서다.

DB 관점에서 실제로 확인이 필요한 것은 다음 두 가지였다.

1. 이 변경이 **새 스키마 마이그레이션**을 동반하는가 — `git diff --stat origin/main...HEAD -- codebase/backend/src` 로 확인한 결과 `migrations/` 하위 `.sql` 파일은 diff 에 없음. 즉 **DB 스키마 변경 없음**.
2. `synchronize` 옵션이 켜져 있어 엔티티 변경이 배포 시 자동 DDL 을 유발할 수 있는가 — `codebase/backend/src/app.module.ts:112` 등 전 TypeORM 모듈 등록에서 `synchronize: false` 확인. 운영 스키마는 Flyway(`migrations/*.sql`)가 단일 진실이며 엔티티는 매핑 메타데이터만 제공한다. **자동 DDL 위험 없음**.

추가로 새로 추가된 `type:` 지정이 실제 컬럼 타입과 일치하는지 `migrations/V001__initial_schema.sql` 등을 grep 대조했다.

| 필드 | 엔티티 선언 (`type:`) | 실제 DB (migrations) | 일치 |
|---|---|---|---|
| `Execution/NodeExecution.durationMs` | `'int'` | `duration_ms INTEGER` (V001 §223,242) | ✅ |
| `Notification.resourceType` | `'varchar'`, length 50 | `resource_type VARCHAR(50)` (V001 §342) | ✅ |
| `Trigger.endpointPath` | `'varchar'`, length 255 | `endpoint_path VARCHAR(255)` (V001 §151) | ✅ |
| `User.avatarUrl` | `'varchar'`, length 500 | `avatar_url VARCHAR(500)` (V001 §16) | ✅ |
| `User.oauthProvider`/`oauthProviderId` | `'varchar'`, length 50/255 | `oauth_provider VARCHAR(50)` / `oauth_provider_id VARCHAR(255)` (V001 §28-29) | ✅ |

배치 1 에서 `type:` 누락으로 인해 TypeORM 이 `string | null` 을 `design:type` 리플렉션으로
`Object` 로 오인해 부팅 시 `DataTypeNotSupportedError` 를 낸 전례(plan 문서에 기록됨)가 있었는데,
이번 배치는 그 재발을 막기 위해 넓히는 필드마다 `type:` 동반 여부를 점검했고 위 표와 같이
실제 DB 타입과 일치한다.

## 점검 관점별 결과

1. **인덱스** — 해당 없음. 인덱스 정의(`@Index`) 변경 없음. `node-execution.entity.ts` 의
   기존 `@Index(['executionId', 'status'])` 주석·`node.entity.ts` 의 `IDX_node_workflow_label`
   모두 이번 diff 범위 밖(문맥으로만 표시).
2. **N+1 쿼리** — 해당 없음. 쿼리 로직 변경 없음(엔티티 필드 타입 선언만 변경).
3. **트랜잭션** — 해당 없음. 서비스/리포지토리 레이어 변경 없음.
4. **마이그레이션 안전성** — 해당 없음(신규 `.sql` 마이그레이션 없음). `synchronize: false`
   확인으로 엔티티 변경이 운영 DB DDL 을 트리거하지 않음을 검증.
5. **스키마 설계** — 실질적 스키마 변경 없음. TS 타입이 기존 nullable 컬럼의 실제 nullability 를
   뒤늦게 반영하는 것뿐이라 스키마 설계 자체에는 영향 없음.
6. **커넥션 관리** — 해당 없음.
7. **SQL 인젝션** — 해당 없음. 원본 쿼리 코드(파라미터 바인딩) 변경 없음.
8. **대량 데이터** — 해당 없음. `redact-stored-error.ts` 의 `redactNodeExecutionRowForResponse`
   는 copy-on-change 최적화(무변화 시 같은 참조 반환)를 유지한 채 시그니처만 `| null` 로
   넓혔다 — 대량 `nodeExecutions[]` 순회 시 불필요한 shallow-copy 를 만들지 않는 기존 최적화가
   그대로 보존됨(`redact-stored-error.ts:167-190`, docstring 에도 명시).

## 발견사항

없음. 이번 변경은 DB 스키마·쿼리·트랜잭션·커넥션 동작에 영향을 주지 않는 TypeScript 타입
정합화이며, `type:` 추가분은 실제 컬럼 타입과 대조 검증했다.

## 요약

이번 diff 는 9개 TypeORM 엔티티의 필드 타입을 이미 `nullable: true` 로 선언돼 있던 DB 컬럼에
맞춰 `T | null` 로 넓히고, 일부 `@Column` 에 실제 컬럼 타입(`varchar`/`int`)을 명시한
타입-전용 변경이다. 신규 마이그레이션이 없고 `synchronize: false` 로 엔티티 변경이 운영 DDL 을
유발하지 않으며, 추가된 `type:` 지정은 `migrations/*.sql` 의 실제 컬럼 타입과 전수 대조해
일치함을 확인했다. 쿼리·트랜잭션·인덱스·커넥션·SQL 인젝션·페이지네이션 등 데이터베이스
동작에 영향을 주는 코드 변경은 없다.

## 위험도

NONE
