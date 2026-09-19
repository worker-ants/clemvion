# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 없음. WARNING 2건(둘 다 신규 e2e 가드 테스트 코드 내부, 애플리케이션 로직 무관) 외에는 대부분 INFO 수준. 강제 포함(router_safety) 7명 전원 및 router 자체 선택 database 포함 총 8개 reviewer 전문을 모두 확보했으며 누락 없음(forced 리스트 미이행 없음).

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 부작용 | 신규 읽기 전용 `DataSource` 가 `initialize()` 단계에서 TypeORM 내부 동작(`checkMetadataForExtensions`→`enableExtensions`)으로 `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"` 를 실제 시도했다가 `default_transaction_read_only=on` 세션에 거부당한다. TypeORM 자체 try/catch 로 실패를 삼키고 `logging` 미설정으로 콘솔에도 안 남아 현재는 무해하지만, "읽기 전용이라 어떤 쓰기 시도도 없다"는 이 테스트의 설계 의도와 실제 동작 사이에 간극이 있다 | `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:544-554` | `readOnly` 생성 옵션에 `installExtensions: false` 를 명시해 쓰기 시도 자체를 원천 차단 |
| 2 | 문서화 | `describe()` 타이틀이 "선언이 있으면 DB 에도 그대로 있다"는 단방향 문구만 유지 — 이번 PR 이 그 안에 추가한 컬럼 층 테스트는 DB 에만 있는 컬럼(`DROP COLUMN`)도 잡는 **양방향** 검사인데, 파일 상단 JSDoc 은 이미 방향성 차이를 정확히 구분해 정정했음에도 타이틀만 갱신되지 않았다 | `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:197` | 타이틀을 `'... (인덱스·제약은 선언→DB 단방향, 컬럼 정의는 양방향)'` 등으로 갱신 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 요구사항 | `spec/1-data-model.md` §2.16 ModelConfig 표가 `kind` 컬럼의 DB 기본값(`'chat'`, V088 마이그레이션 유래)을 언급하지 않음 — 코드 fix 는 실제 DB 사실과 정확히 일치하며 DTO 가 `kind` 를 필수로 요구해 실질 영향 없음 | `spec/1-data-model.md:610` | 다음 project-planner 턴에서 §2.16 `kind` 행에 기본값 각주 추가(선택) |
| 2 | 요구사항 | `spec/1-data-model.md` §2.20 AssistantSession 표가 `last_interaction_at` 의 DB 기본값(`now()`)을 언급하지 않음 — 서비스가 생성/갱신 시 항상 명시적으로 채워 실질 영향 없음 | `spec/1-data-model.md:769` | 선택적 정정, 우선순위 낮음 |
| 3 | 요구사항 | 컬럼 층 가드의 `readOnly.initialize()` 실패 시 `try/finally` 가 `log()` 호출만 감싸 `destroy()` 가 호출되지 않을 이론적 가능성(연결 누수) | `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:544-554` | `initialize()` 도 같은 `try/finally` 블록 안으로 이동 |
| 4 | 요구사항 | `COLUMN_LEVEL` 의 `ADD` 정규식이 TypeORM 이 향후 `ADD COLUMN` 키워드 포함 형태로 DDL 을 바꾸면 신규 컬럼 추가를 놓칠 잠재 가능성(현재 0.3.31 실측 기반, 결함 아님) | `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:62-68` | TypeORM 메이저 업그레이드 시 표본 재채집 |
| 5 | 보안 | e2e DB 접속정보 기본값(`clemvion`/`clemvion-e2e`)이 하드코딩 — 신규 노출 아님, 기존 `beforeAll` 리터럴을 `dataSourceOptions()` 함수로 추출(이동)한 것뿐이며 로컬/CI 전용 계정 | `dataSourceOptions()` (게이트 188-190행) | 조치 불요 |
| 6 | 보안 | 테스트 헬퍼(`normalizedPredicate`/`normalizedCheck`)가 엔티티 메타데이터 문자열(CHECK 식·부분 인덱스 `where`)을 이스케이프 없이 SQL 에 직접 이어붙임 — 입력이 사용자 요청이 아니라 엔티티 데코레이터 리터럴(개발자 통제)뿐이고, 주석으로 신뢰 경계가 명시돼 있음 | 게이트 272-314행 | 향후 외부 입력이 섞일 수 있는 경로로 재사용 금지 유지 |
| 7 | 부작용 / 테스팅 / DB | `default` 신규 선언 2건(`ModelConfig.kind`, `WorkflowAssistantSession.lastInteractionAt`)이 INSERT 의 `RETURNING` 절을 넓히는 실행 동작 변화를 유발 — 값 자체는 DB 기본값과 동일하고 두 호출부(`create-model-config.dto.ts`, `workflow-assistant-session.service.ts:94`) 모두 항상 명시적으로 값을 채워 현재 위험은 없으나, 이 구체 동작(RETURNING 재조회)을 타겟하는 전용 테스트는 없음 | `model-config.entity.ts:46`, `workflow-assistant-session.entity.ts:75-79` | 현재는 불요. 향후 값-생략 경로가 생기면 좁은 회귀 테스트 추가 고려 |
| 8 | 유지보수성 | 읽기 전용 `DataSource` 구성에 `as DataSourceOptions` 타입 단언 사용 — `dataSourceOptions()` 반환 타입이 넓어 `extra` 확장 시 캐스팅이 반복되기 쉬움 | `entity-schema-declarations.e2e-spec.ts:544` | `dataSourceOptions()` 반환 타입을 Postgres 전용 좁은 타입(`PostgresConnectionOptions`)으로 변경 |
| 9 | 유지보수성 | `catalog()` 함수 반환 타입이 `unknown` — 실제로는 `{ columns, enums }` 단일 행을 반환해 타입만 봐서는 무엇을 비교하는지 드러나지 않음 | `entity-schema-declarations.e2e-spec.ts:533` | `Promise<{ columns: string \| null; enums: string \| null }>` 명시 |
| 10 | 유지보수성 | 지역 변수명 `log` 가 로깅과 무관(`SqlInMemory` 담음) — 파일 전반의 서술적 네이밍 톤과 약간 어긋남 | `entity-schema-declarations.e2e-spec.ts:549` | `ddl`/`sqlMemory` 등으로 개명 |
| 11 | 유지보수성 / 테스팅 | `COLUMN_LEVEL_SAMPLES`/`UNDECLARED_COLUMNS` 비교가 TypeORM 0.3.31 이 낸 정확 DDL 문자열·정확 일치에 결합 — 향후 TypeORM 버전이 문구를 바꾸면 오탐 RED 가능. 다만 "조용한 통과보다 시끄러운 실패"를 택한 의도적 설계로, 이미 주석으로 근거·버전을 문서화해 둠 | `entity-schema-declarations.e2e-spec.ts:46-55, 62-97, 526-565` | TypeORM 메이저 업그레이드 시 이 표본을 재채집·재검증 |
| 12 | 테스팅 | 컬럼 층 가드의 마지막 테스트가 TypeORM 비공개 내부 API(`driver.createSchemaBuilder().log()`, `SqlInMemory`)에 의존 — 주석 자체가 "공개 계약 아님"을 명시. 이미 이중 방어(읽기 전용 세션+카탈로그 해시)로 "조용히 DB 를 바꾸는" 실패 모드는 막혀 있음 | `entity-schema-declarations.e2e-spec.ts:526` | 조치 불요. TypeORM 업그레이드 시 재확인 체크리스트 항목으로만 기록 |
| 13 | 문서화 | `SqlInMemory` deep import(`typeorm/driver/SqlInMemory`)에 이유 주석 없음 — 이 파일의 다른 모든 비직관적 선택에는 예외 없이 설명 주석이 붙어 있어 관례에서만 벗어남. 루트 export 에 없어 "정리하자"며 고치면 빌드가 깨질 수 있음 | `entity-schema-declarations.e2e-spec.ts:6` | import 옆에 서브패스 import 사유 한 줄 추가 |
| 14 | 스코프 | 트래커(`spec-draft-nullable-notation-followups.md`)에 추가된 항목(`spec/0-overview.md` Prisma/TypeORM 서술 drift)이 이번 핵심 작업과 별개 관심사 — spec 을 직접 고치지 않고 CLAUDE.md 규약대로 planner 백로그로 올바르게 위임됨(스코프 위반 아님) | `plan/in-progress/spec-draft-nullable-notation-followups.md` | 조치 불필요, 다음 project-planner 턴에서 처리 |
| 15 | 스코프 | `dataSourceOptions()` 함수 추출은 리팩토링처럼 보이나, 신규 컬럼 층 테스트가 읽기 전용 세션 구성 시 기존 `DataSource` 옵션을 재사용해야 해서 발생한 최소 추출(임의 리팩토링 아님) | `entity-schema-declarations.e2e-spec.ts` (`dataSourceOptions()` 추출) | 없음 |

### 그 외 검토 확인 (문제 없음, 중복 교차검증)

- 엔티티 8개 파일의 `type: 'uuid'`/`enumName`/`default` 추가는 `synchronize: false` 환경에서 값 직렬화·쿼리 생성·접근 제어·인증/인가에 영향 없음(security·side_effect·database 3개 reviewer 가 TypeORM 드라이버 소스 추적으로 교차 확인).
- 별도 마이그레이션 파일 없이 메타데이터만 정정 — 프로덕션 DB 에 DDL 미실행, 무중단 배포 관점 안전(database).
- 아홉 곳 컬럼 수정 전부가 plan 실측 표·`spec/1-data-model.md` 서술과 1:1 일치(requirement).
- 신규 e2e 가드는 이중 방어(읽기 전용 세션 예방 + 카탈로그 해시 탐지) 및 `try/finally`/`afterAll` 커넥션 정리가 적절(database·requirement).
- 인덱스·N+1·트랜잭션·SQL 인젝션·대량 데이터 페이지네이션 관점에서 이번 diff 에 해당하는 변경 없음(database).
- `codebase/` 변경 범위가 plan 표의 아홉 곳 + e2e 가드 확장에 정확히 국한, 무관한 포맷팅/리팩토링 없음(scope).
- CHANGELOG 미갱신은 선행 자매 PR 전례와 일치, 지적 대상 아님(documentation).

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 하드코딩 DB 기본값·이스케이프 없는 SQL 조립 모두 기존 관례/문서화된 신뢰 경계 내, 실질 위험 없음 |
| requirement | NONE | spec-코드 1:1 일치 확인, spec 서술 관례 공백 2건 + 테스트 엣지케이스 2건은 INFO |
| scope | NONE | 핵심 diff 가 plan 범위에 정확히 국한, 트래커 위임도 규약 준수 |
| side_effect | LOW | readOnly DataSource 의 uuid-ossp 확장 설치 시도(WARNING)가 유일한 실질 발견 |
| maintainability | LOW | 타입 단언·반환타입·변수명 등 사소한 INFO 4건, 구조적 결함 없음 |
| testing | LOW | 회귀 테스트 근거 충분(뮤테이션 검증 다수), RETURNING 전용 테스트 부재는 INFO |
| documentation | LOW | describe() 타이틀 불일치(WARNING) 외 문서화 밀도 이례적으로 높음 |
| database | LOW | 마이그레이션 없는 안전한 메타데이터 정정, RETURNING 동작 변화는 이미 검증됨 |

## 발견 없는 에이전트

해당 없음 — 실행된 8개 reviewer 모두 최소 INFO 이상 발견사항을 보고했다.

## 권장 조치사항

1. [WARNING #1] `entity-schema-declarations.e2e-spec.ts` 의 `readOnly` DataSource 생성 옵션에 `installExtensions: false` 를 추가해 `uuid-ossp` 확장 설치 시도를 원천 차단한다 — "읽기 전용·부작용 없음" 설계 의도를 코드로 실제 보장.
2. [WARNING #2] 같은 파일의 `describe()` 타이틀을 컬럼 층의 양방향 검사를 반영하도록 갱신한다(파일 상단 JSDoc 과 일치시킴).
3. [INFO #13, 선택] `SqlInMemory` deep import 옆에 사유 주석 한 줄 추가.
4. [INFO #8-10, 선택] 유지보수성 INFO(타입 단언 → 좁은 타입, `catalog()` 반환 타입 명시, `log` 변수명 개명)는 우선순위 낮음이나 다음 터치 시 함께 정리 권장.
5. [INFO #1-2, 선택] `spec/1-data-model.md` §2.16/§2.20 에 기본값 각주 추가는 다음 project-planner 턴 백로그로 남긴다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `database` (8명)
  - **제외**: 아래 표 (6명)
  - **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명) — 전원 결과 확보됨, 누락 없음. (`database` 는 강제 목록 외 router 자체 선택)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 이번 diff(엔티티 메타데이터 정정 + e2e 가드)와 무관하다고 router 판단(개별 사유 상세는 prompt 미제공) |
  | architecture | 상동 |
  | dependency | 상동 |
  | concurrency | 상동 |
  | api_contract | 상동 |
  | user_guide_sync | 상동 |
