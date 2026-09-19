# 부작용(Side Effect) 리뷰

## 발견사항

- **[WARNING]** 새로 추가된 읽기 전용 `DataSource` 가 `initialize()` 단계에서 공유 e2e DB 에 대해 `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"` 를 실제로 시도한다 — 의도된 "읽기 전용" 전제와 어긋나는 쓰기 시도
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:544-554` (신규 `it('컬럼 — TypeORM 스키마 비교기가...')` 안, `const readOnly = new DataSource({ ...dataSourceOptions(), extra: { options: '-c default_transaction_read_only=on' } })` ~ `await readOnly.initialize()`)
  - 상세: `readOnly.initialize()` 는 TypeORM Postgres 드라이버의 `afterConnect()` → `checkMetadataForExtensions()` → `enableExtensions()` 경로를 그대로 탄다(테스트 코드가 막을 수 없는 TypeORM 내부 동작). `checkMetadataForExtensions()` 는 `entityMetadatas` 중 `generationStrategy === 'uuid'` 컬럼(=`@PrimaryGeneratedColumn('uuid')`)이 하나라도 있으면 `hasUuidColumns = true` 로 판정하는데, `ROOT_ENTITIES` 는 이 패턴을 광범위하게 쓰므로 항상 참이다. 그 결과 `enableExtensions()` 가 `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"` 를 이 커넥션에 실행한다 — Postgres 는 `default_transaction_read_only=on` 세션에서 이 문(IF NOT EXISTS 여부와 무관하게 DDL 종류 자체로 판정)을 거부한다. 다행히 TypeORM 이 이 특정 호출만 자체 `try/catch` 로 감싸 실패를 삼키고 `logger.log('warn', ...)` 로만 남기므로(`PostgresDriver.js` `enableExtensions()`), 테스트 자체는 깨지지 않는다. 또 `dataSourceOptions()` 가 `logging` 옵션을 지정하지 않아 기본 `AdvancedConsoleLogger` 의 `isLogEnabledFor('warn')` 가 `false` 를 반환하므로 이 경고는 콘솔에도 출력되지 않는다(TypeORM `logger/AbstractLogger.js` 로 확인) — 즉 지금은 사실상 무해하게 삼켜지지만, **"읽기 전용 세션이라 어떤 쓰기 시도도 없다"는 이 테스트의 방어 설계 의도와는 다르게, 매 CI 실행마다 이 커넥션이 실제로 쓰기 문 하나를 시도하고 거부당한다.** 이는 이 diff 가 새로 도입한 두 번째 `DataSource` 로 인해 노출된 부작용이며, `logging` 을 나중에 디버깅 목적으로 켜면 "superuser 권한이 없다"는 오해성 경고가 나와 혼란을 줄 수 있다.
  - 제안: 읽기 전용 `DataSource` 생성 시 `installExtensions: false` 를 명시해(`{ ...dataSourceOptions(), extra: {...}, installExtensions: false }`) 이 쓰기 시도 자체를 원천 차단하고, "읽기 전용·부작용 없음" 의도를 코드로 명시한다.

- **[INFO]** `default` 메타데이터 추가 두 건이 매 INSERT 의 `RETURNING` 절을 넓힌다 — 문서화된 "스키마 비교에만 쓰인다"는 설명보다 실제 영향 범위가 좁게 서술돼 있음
  - 위치: `codebase/backend/src/modules/model-config/entities/model-config.entity.ts:46` (`@Column({ length: 20, default: 'chat' })`), `codebase/backend/src/modules/workflow-assistant/entities/workflow-assistant-session.entity.ts:75-79` (`last_interaction_at` 에 `default: () => 'now()'` 추가)
  - 상세: TypeORM `EntityMetadata.getInsertionReturningColumns()`(0.3.31, `metadata/EntityMetadata.js`)는 `column.default !== undefined` 인 컬럼을 INSERT `RETURNING` 대상에 포함시킨다. 이번 변경 전에는 `kind`/`lastInteractionAt` 에 `default` 가 없어 이 목록에서 빠져 있었고, 변경 후에는 항상 포함된다 — 즉 두 엔티티의 모든 INSERT 문이 이 컬럼들을 추가로 `RETURNING` 받아 엔티티 객체를 다시 채운다. `plan/in-progress/entity-column-declaration-drift.md` 의 "런타임 영향" 절이 이 메커니즘 자체(`ReturningResultsEntityUpdator`)는 언급하지만 "값은 DB 기본값 그대로라 의미는 같다"고만 적어, 두 호출부(`model-config.controller.ts:122`→`service.create(..., dto.kind, ...)`, `workflow-assistant-session.service.ts:94` `lastInteractionAt: now`)가 **항상 명시적으로 값을 채워 넣는지**까지는 실측 근거로 남기지 않았다. 실제로 grep 결과 두 필드 모두 모든 생성 경로에서 명시적으로 설정되므로(따라서 RETURNING 값과 INSERT 값이 항상 같다) 기능적 위험은 없다고 판단하지만, 이 diff 리뷰에서 그 근거를 재확인해 기록해 둔다.
  - 제안: 별도 조치 불요(현재 위험 없음 확인). 다만 두 필드 중 하나라도 향후 "값 미지정으로 DB 기본값에 맡기는" 호출 경로가 생기면 RETURNING 재조회 값이 최초로 눈에 보이는 차이를 만들 수 있다는 점을 plan 문서 각주로 남겨도 좋다.

- **[INFO]** 컬럼 타입/enum 이름 메타데이터 추가(`type: 'uuid'`, `enumName`)는 확인 결과 런타임 쿼리 생성·값 변환에 영향이 없음 — 부작용 없음 확인
  - 위치: `codebase/backend/src/modules/alerts/entities/alert-rule.entity.ts:19`, `codebase/backend/src/modules/edges/entities/edge.entity.ts:53-58`, `codebase/backend/src/modules/integrations/entities/integration-usage-log.entity.ts:30,33`, `codebase/backend/src/modules/llm/entities/llm-usage-log.entity.ts:20`, `codebase/backend/src/modules/nodes/entities/node.entity.ts:48`, `codebase/backend/src/modules/workspaces/entities/workspace-invitation.entity.ts:18`
  - 상세: TypeORM Postgres 드라이버의 `preparePersistentValue()`/insert 값 생성 경로(`PostgresDriver.js`, `InsertQueryBuilder.js`)를 직접 추적한 결과 `type: 'uuid'` 나 `enumName` 은 값 직렬화·바인딩에 아무 분기도 타지 않는다(둘 다 `synchronize`/스키마 비교 SQL 생성에만 쓰인다). `synchronize: false` 이므로 이 메타데이터가 실제 DDL 을 트리거하지도 않는다. plan 문서의 자체 주장과 일치하며, 코드 추적으로 반증되지 않았다.
  - 제안: 조치 불요(확인 완료 기록).

- **[INFO]** `plan/in-progress/*.md`, `review/consistency/2026/09/19/{10_58_34,16_54_09}/**` 신규 파일은 실행 코드가 아닌 워크플로 산출물 — 부작용 아님
  - 위치: 파일 10~27 전체
  - 상세: 프로젝트 컨벤션(`CLAUDE.md` "정보 저장 위치")상 `plan/in-progress/`·`review/consistency/**` 는 정상적인 작업/검토 산출물 보관 위치이며, 실행되는 애플리케이션 코드에 영향을 주지 않는다.
  - 제안: 조치 불요.

## 요약

리뷰 대상 엔티티 8개 파일의 컬럼 메타데이터 변경(`type: 'uuid'`, `enumName`, `default`)은 `synchronize: false` 환경에서 스키마 비교·문서화 목적이 대부분이며, TypeORM 소스 추적 결과 값 직렬화·쿼리 생성에는 영향이 없음을 확인했다. 유일하게 실질적인 런타임 변화는 `model-config`/`workflow-assistant-session` 두 엔티티에 추가된 `default` 가 INSERT 의 `RETURNING` 목록을 넓히는 것인데, 두 호출부 모두 해당 필드를 항상 명시적으로 채우므로 값 차이는 없다(grep 으로 확인). 가장 주목할 부작용은 코드 자체가 아니라 새로 추가된 e2e 테스트에 있다 — 방어용으로 도입한 두 번째 "읽기 전용" `DataSource` 가 `initialize()` 과정에서 TypeORM 내장 동작(`uuid-ossp` extension 자동 설치 시도)으로 인해 공유 e2e DB 에 실제 쓰기 문을 한 번 시도했다가 read-only 세션에 의해 거부당하고, 그 실패가 TypeORM 자체 try/catch 와 기본 로깅 설정(logging 미지정)에 의해 이중으로 조용히 삼켜진다. 데이터 손상이나 테스트 실패로 이어지지는 않지만, "읽기 전용이라 부작용이 없다"는 이 테스트의 설계 의도와 실제 동작 사이에 미묘한 간극이 있어 `installExtensions: false` 로 명시적으로 막아 두는 편이 안전하다.

## 위험도

LOW
