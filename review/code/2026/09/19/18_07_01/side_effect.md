# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** (검증 완료) 3라운드 WARNING("읽기 전용 `DataSource` 가 `initialize()` 중 `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"` 를 실제로 시도")가 이번 라운드에서 `installExtensions: false` 추가로 해소됐음을 TypeORM 소스로 직접 확인
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` — `it('컬럼 — TypeORM 스키마 비교기가 컬럼 정의 변경을 내지 않는다…')` 안의 `const readOnly = new DataSource({ ...dataSourceOptions(), installExtensions: false, extra: { options: '-c default_transaction_read_only=on' } })`
  - 상세: `node_modules/typeorm/driver/postgres/PostgresDriver.js` `afterConnect()`(line 286~296)를 직접 읽었다. `checkMetadataForExtensions()` 는 항상 호출되지만(메타데이터만 읽는 순수 함수, DB 접근 없음), 실제 쓰기 문(`CREATE EXTENSION …`)을 내는 `enableExtensions()` 호출은 `installExtensions && extensionsMetadata.hasExtensions` 조건문(line 291) 뒤에만 있다. `installExtensions: false` 를 주면 이 분기 자체가 스킵돼 `enableExtensions()` 가 호출되지 않는다 — 3라운드가 지적한 "읽기 전용 세션인데 쓰기 시도가 나간다" 문제의 근본 원인(코드 경로)이 이번 diff 로 실제로 차단됐다. 추가로 `RdbmsSchemaBuilder.log()`(`node_modules/typeorm/schema-builder/RdbmsSchemaBuilder.js` line 101~124)와 `BaseQueryRunner.executeQueries()`(line 430~443)도 확인했다 — `enableSqlMemory()` 로 `sqlMemoryMode=true` 가 되면 `executeQueries()` 는 `upQueries`/`downQueries` 를 배열에 push 만 하고 `this.sqlMemoryMode === true` 분기에서 즉시 return 해 실제 쿼리를 실행하지 않는다(line 438~439). `log()` 는 `build()` 와 달리 `createMetadataTableIfNecessary()` 도 호출하지 않는다. 즉 "`log()` 는 DB 를 바꾸지 않는다"는 테스트 주석의 전제와 "`installExtensions: false` 로 쓰기 시도 자체가 없다"는 이번 수정 모두 소스 추적으로 반증되지 않았다.
  - 제안: 조치 불요 — 검증 완료 기록.

- **[INFO]** 새 테스트가 매 실행마다 공유 e2e Postgres 에 대해 **두 번째 `DataSource`**(커넥션 풀)를 열었다 닫는다 — 리소스 사용량 증가, 기능적 위험은 없음
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` 같은 `it` 블록, `readOnly.initialize()` ~ `finally { if (readOnly.isInitialized) await readOnly.destroy(); }`
  - 상세: 기존 `beforeAll` 의 `ds` 하나에 더해, 이 테스트가 실행될 때마다 별도의 `pg.Pool` 기반 `DataSource` 를 새로 만든다. `try/finally` 로 초기화 성공/실패 어느 경로든 `destroy()` 가 호출되므로 커넥션 누수는 없다 — `readOnly.isInitialized` 가드 덕에 `initialize()` 자체가 던진 경우(destroy 불필요한 상태)도 안전하다. 다만 CI 가 e2e 를 병렬(Jest workers)로 돌리는 경우, 이 테스트가 실행되는 그 짧은 구간 동안 Postgres 커넥션 슬롯을 하나 더 점유한다 — `max_connections` 여유가 매우 빠듯한 환경이 아니면 문제 되지 않는 수준.
  - 제안: 조치 불요 (현재 리소스 여유로 위험 없음). 향후 e2e 병렬도를 크게 올릴 계획이 있으면 참고.

- **[INFO]** (재확인) `default` 메타데이터 추가 2건(`model-config.kind`, `workflow-assistant-session.lastInteractionAt`)이 INSERT 의 `RETURNING` 목록을 넓히지만, 두 호출부 모두 매 생성 경로에서 값을 명시적으로 채우므로 RETURNING 값과 애플리케이션이 준 값이 항상 같다
  - 위치: `codebase/backend/src/modules/model-config/entities/model-config.entity.ts` (`kind` 컬럼) / `codebase/backend/src/modules/workflow-assistant/entities/workflow-assistant-session.entity.ts` (`lastInteractionAt` 컬럼)
  - 상세: `grep` 으로 재확인 — `model-config.service.ts` 의 모든 생성 경로(`kind: ModelConfigKind` 파라미터를 받는 함수들, line 95/157/181/261/358)가 `kind` 를 항상 명시적으로 넘기고, `workflow-assistant-session.service.ts:94` (`lastInteractionAt: now`)·`:170`(`lastInteractionAt: () => 'NOW()'`)도 항상 값을 채운다. 이 관찰은 3라운드 리뷰에서 이미 확인된 것과 일치하며, 이번 diff 는 이 두 서비스 파일을 건드리지 않았으므로 그 결론이 그대로 유효하다.
  - 제안: 조치 불요.

- **[INFO]** 컬럼 타입/enum 이름 메타데이터 추가(`type: 'uuid'`, `enumName`)는 `IN(...)` 배열 조건을 포함해 런타임 쿼리 생성에 영향이 없음을 소스로 재확인
  - 위치: `codebase/backend/src/modules/alerts/entities/alert-rule.entity.ts`(`workspaceId`), `edges/entities/edge.entity.ts`(`type` enum), `integrations/entities/integration-usage-log.entity.ts`(`nodeExecutionId`/`workflowId`), `llm/entities/llm-usage-log.entity.ts`(`workspaceId`), `nodes/entities/node.entity.ts`(`category` enum), `workspaces/entities/workspace-invitation.entity.ts`(`workspaceId`)
  - 상세: `type: 'uuid'` 로 바뀌면 `In([...])` 같은 다중값 조건에서 postgres 드라이버가 배열 파라미터에 컬럼 타입별 명시적 캐스트(`::uuid[]` 등)를 씌워 SQL 이 달라질 가능성을 의심해 `node_modules/typeorm/query-builder/QueryBuilder.js` 의 `= ANY(...)` 생성부(line 764~766)를 직접 봤다 — Postgres 드라이버 분기는 캐스트 없이 `${column} = ANY(${param})` 그대로 생성한다(캐스트 분기는 CockroachDB 전용). 즉 컬럼 타입 메타데이터가 `IN` 절 SQL 문자열 자체를 바꾸지 않는다. `synchronize: false` 라 이 메타데이터가 실제 DDL 을 트리거하지도 않는다. plan 문서·3라운드 리뷰의 결론과 일치.
  - 제안: 조치 불요.

- **[INFO]** 신규 `import type` 두 건이 TypeORM 이 공개(root) export 하지 않는 서브패스를 가져온다 — 런타임 부작용은 0(타입 전용, 컴파일 시 소거)이지만 인터페이스 안정성 참고
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:6-7` — `import type { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions'`, `import type { SqlInMemory } from 'typeorm/driver/SqlInMemory'`
  - 상세: 둘 다 `import type` 이라 트랜스파일 시 완전히 제거되고 런타임 모듈 로딩·부작용이 없다(타입체크 시점에만 존재). 다만 TypeORM 이 이 두 타입을 루트 `index.d.ts` 에서 재-export 하지 않는다는 사실 자체는 "공개 계약 밖" 경로에 의존한다는 뜻이라, TypeORM 마이너 업그레이드에서 해당 서브패스 파일 위치가 바뀌면 타입 컴파일이 깨질 수 있다(런타임 동작에는 영향 없음, 빌드 타임 실패만).
  - 제안: 조치 불요 — 테스트 코드 한정이고 파일 상단에 그 이유("아래 두 타입은 typeorm 루트에서 export 되지 않아 서브패스로 가져온다")를 이미 주석으로 남겨 둬 다음 사람이 원인을 바로 알 수 있다.

- **[INFO]** `plan/in-progress/*.md`, `review/consistency/2026/09/19/{10_58_34,16_54_09}/**` 신규 파일은 실행되는 애플리케이션/테스트 코드가 아닌 워크플로 산출물 — 부작용 아님
  - 위치: 파일 10~27 전체
  - 상세: `CLAUDE.md` "정보 저장 위치" 표에 정의된 정상 보관 위치(`plan/in-progress/`, `review/consistency/**`)이며 런타임에 로드·실행되지 않는다.
  - 제안: 조치 불요.

## 요약

이번 diff(엔티티 8개 컬럼 메타데이터 정정 + e2e 가드를 컬럼 층으로 확장)에서 새로 도입된 부작용은 관찰되지 않았다. 3라운드 side_effect 리뷰가 지적했던 유일한 WARNING(읽기 전용 `DataSource` 초기화 중 `CREATE EXTENSION` 시도)은 이번 라운드에서 `installExtensions: false` 로 해소됐고, `PostgresDriver.afterConnect()` 소스를 직접 읽어 그 분기가 실제로 스킵됨을 확인했다 — 다시 말해 새 커넥션은 초기화부터 `log()` 호출까지 어떤 쓰기 문도 시도하지 않는다(`sqlMemoryMode` 가 켜진 상태에서 `executeQueries()` 가 실제 실행을 건너뛴다는 것도 소스로 확인). `default` 메타데이터 추가로 인한 `RETURNING` 확장은 호출부가 항상 값을 명시적으로 채우므로 값 차이가 없고, `type`/`enumName` 추가는 `synchronize: false` 환경에서 DDL 을 트리거하지 않으며 `IN(...)` 등 쿼리 생성 SQL 도 바꾸지 않는다(QueryBuilder 소스로 확인). 남은 항목은 전부 INFO 수준(추가 커넥션 리소스 사용, 타입 전용 internal-subpath import, 워크플로 산출물 신규 파일)이며 조치가 필요한 발견사항은 없다.

## 위험도

NONE
