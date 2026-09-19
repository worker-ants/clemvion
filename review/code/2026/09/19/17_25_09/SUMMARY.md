# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 없음. WARNING 1건(신규 e2e 컬럼 층 테스트가 TypeORM 비공개 API 호출을 트랜잭션/SAVEPOINT 로 보호하지 않아 사후 탐지만 있고 예방이 없음)을 제외하면 전부 INFO 수준. forced reviewer(documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과가 확보되어 화이트리스트 미이행은 없다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | 신규 컬럼 층 e2e 테스트가 TypeORM 비공개 API `driver.createSchemaBuilder().log()` 를 트랜잭션 밖에서 직접 호출한다. 앞의 인덱스·CHECK·FK 3개 테스트는 `inRolledBackTx` 로 무조건 ROLLBACK 하지만 이 테스트는 그 보호가 없다. `catalog()` 전후 카탈로그 md5 해시 비교(523-535행)는 "log() 가 DB 를 바꾸지 않는다"는 전제가 깨졌을 때 **사후에** 테스트를 실패시킬 뿐, TypeORM 버전업 등으로 그 전제가 실제로 깨지면 이미 공유 e2e Postgres 에 DDL 이 반영된 뒤다. 같은 컨테이너를 공유하는 후속 e2e 스펙 파일이 그 오염을 물려받아 무관한 이유로 실패할 수 있다(side_effect/database 리뷰는 이 self-guard 자체는 "이미 방어됨"으로 평가하지만, testing 은 "탐지"와 "예방"을 구분해 예방 부재를 지적한다 — 두 관점 모두 반영). | `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:520-545` (특히 523-535) | 가능하면 `log()` 호출을 트랜잭션/SAVEPOINT 로 감싸 다른 세 테스트와 동일한 롤백 패턴을 적용. `createSchemaBuilder()` 가 별도 커넥션이라 트랜잭션 경계를 공유 못 하면, 최소한 이 파일을 별도 e2e job/DB 인스턴스로 격리해 오염 전파 범위를 제한 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | database, security, requirement | `enumName` 누락은 `synchronize: true` 가 실수로 켜지는 환경에서 enum 타입을 DROP 후 재생성하는 파괴적 DDL 을 냈을 것 — 실측 표본(`ALTER TYPE ... RENAME TO ..._old`, `CREATE TYPE ..._enum`, `DROP TYPE ..._old`)으로 확인. 이번 수정이 그 잠재 결함을 제거함 | `edge.entity.ts:53-58`, `node.entity.ts:48`, 표본: `entity-schema-declarations.e2e-spec.ts:82-85` | 없음 (이미 정정됨, 정보성 확인) |
| 2 | side_effect, database | 새로 `default` 를 얻은 두 컬럼(`model_config.kind`, `workflow_assistant_session.last_interaction_at`)은 매 INSERT 마다 RETURNING 절에 포함되고, 저장 후 엔티티 필드가 DB 라운드트립 값으로 재대입된다(같은 INSERT 문 내 RETURNING 이라 추가 왕복은 아님). 앱이 이미 같은 값을 명시적으로 채우므로 실질 값 차이는 없으나 diff 이전에는 없던 동작 변화다 | `model-config.entity.ts:46`, `workflow-assistant-session.entity.ts:75-79` | 조치 불요(plan 문서가 예고, 전체 e2e 로 검증됨). `save()` 반환 객체를 참조/얕은 비교로 "변경 없음" 판정하는 코드가 향후 추가되면 유의 |
| 3 | security, side_effect, database | 전 DataSource 가 `synchronize: false` 로 고정돼 있어 이번 컬럼 데코레이터 정정(`type`/`enumName`/`default`)이 자동 DDL 을 유발하지 않는다 | `app.module.ts:112`, `eval-cli.module.ts:49`, `scripts/encrypt-auth-config.ts:53` | 없음 |
| 4 | testing, requirement | 1라운드 WARNING(정규식 5분기 중 2분기가 뮤테이션 검증 밖)은 `COLUMN_LEVEL_SAMPLES` 실측 표본 + 전용 판별력 `it` 블록으로 해소됨. 다만 이 테스트는 DB 를 전혀 쓰지 않는 순수 문자열 매칭인데도 같은 `describe` 의 `beforeAll`(DB 연결)에 묶여 있어 인프라 종속을 벗어나지 못함 | `entity-schema-declarations.e2e-spec.ts:507-518`, `:73-95` | `COLUMN_LEVEL`/`isColumnLevel`/`COLUMN_LEVEL_SAMPLES` 를 별도 모듈로 뽑아 DB 불요 순수 unit 테스트로 이전하면 회귀 방어선이 e2e 인프라 가용성과 무관해짐 |
| 5 | requirement | `^ALTER TABLE "[^"]+" ADD "` 패턴은 스키마 프리픽스(`"public"."table"`) 형태의 컬럼 추가문에는 매치되지 않는다. 현재 실측 표본은 전부 프리픽스 없는 형태라 문제 없으나, TypeORM 향후 버전에서 프리픽스가 붙기 시작하면 이 분기만 조용히 매치를 놓칠 수 있는 가상 시나리오 | `entity-schema-declarations.e2e-spec.ts:61` | 조치 불요(현재 실측과 일치). TypeORM 업그레이드 시 `COLUMN_LEVEL_SAMPLES` 재채집하며 스키마 프리픽스 유무 확인 |
| 6 | requirement | plan 헤더 주석이 아직 존재하지 않는 `plan/complete/entity-column-declaration-drift.md` 경로를 인용(실제로는 `plan/in-progress/`) — 1라운드에서도 지적된 사안, 트래커 마무리 시 자연 해소 | `entity-schema-declarations.e2e-spec.ts:23` | plan `complete/` 이동 시 자동 해소, 별도 조치 불요 |
| 7 | requirement | plan 체크리스트의 "TEST WORKFLOW" 실측 시점이 이번 라운드 커밋(`717382613`)보다 한 커밋 앞(`3c2b39305`) 기준으로 기록됨 | `plan/in-progress/entity-column-declaration-drift.md` 체크리스트 | `--impl-done` 실행 전 최신 커밋 기준으로 체크리스트 문구 갱신 또는 재실행 결과 추가 |
| 8 | maintainability | `UNDECLARED_COLUMNS` 의 두 항목(`document_chunk.embedding`, `agent_memory.embedding`)이 동일한 이유 문자열을 반복 | `entity-schema-declarations.e2e-spec.ts:44-52` | 우선순위 낮음 — 세 번째 vector 컬럼 추가 시 공용 상수로 추출 검토 |
| 9 | maintainability | `COLUMN_LEVEL` 상수명이 값의 타입(정규식 배열)을 이름만으로 드러내지 않음(주석이 즉시 보완해 실질 혼동 낮음) | `entity-schema-declarations.e2e-spec.ts:60` | `COLUMN_LEVEL_PATTERNS` 로 개명 검토(필수 아님) |
| 10 | documentation | plan 이 트래커의 "선언 생략 vs 거짓 선언 기준" 질문에 실질적으로 답하는 불릿은 있으나, 이를 명시하는 문장이 없음 — consistency-check(`--impl-prep` 2회차)가 이미 동일 지적을 냈고 아직 미반영 | `plan/in-progress/entity-column-declaration-drift.md` "가드" 절 | `complete/` 이동 전 해당 불릿 앞에 "이것이 트래커가 요구한 생략 vs 거짓 선언 기준이다" 한 문장 추가(비차단) |
| 11 | documentation | CHANGELOG.md 미갱신 — 직전 자매 커밋(#1354, 같은 성격의 선언-정정 PR)도 항목을 추가하지 않은 선례와 일치, 사용자 대상 동작 변화 없음 | `CHANGELOG.md` | 조치 불요 |
| 12 | security | e2e 테스트 DB 접속 fallback 자격증명(`DB_PASSWORD ?? 'clemvion-e2e'`)이 파일에 존재하나 이번 diff 밖의 기존 코드이며 로컬 e2e 전용 관례적 기본값 | `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` (diff 밖 기존 설정 블록) | 조치 불요(기존 관례, 범위 밖) |
| 13 | database | raw SQL 문자열 결합 헬퍼(`normalizedPredicate`, `normalizedCheck`)는 엔티티 데코레이터의 소스 코드 상수만 입력으로 받는다 — 프로덕션 인젝션 경로 아님. 코드 자체가 외부 입력에 쓰지 말라고 주석으로 명시 | `entity-schema-declarations.e2e-spec.ts:266-308` | 향후 이 헬퍼를 테스트 밖(런타임 코드)으로 재사용하지 말 것 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 새 인젝션 표면·시크릿 없음. e2e fallback 비밀번호는 범위 밖 기존 코드 |
| requirement | LOW | 9곳 컬럼 수정이 Flyway 마이그레이션과 line-level 일치, spec fidelity 충족. plan 경로/시점 표기 INFO 다수 |
| scope | NONE | diff 가 plan 이 예고한 목적(컬럼 9곳 정정 + 컬럼 층 가드)에 정확히 수렴, 숨은 변경 없음 |
| side_effect | LOW | `default` 신규 선언 2곳의 RETURNING 부작용은 계측됨. `synchronize: false` 로 자동 DDL 없음 |
| maintainability | LOW | 이유 문자열 중복, 상수명 모호성 등 사소한 INFO 2건. 전반적으로 모범적 문서화 |
| testing | LOW | 정규식 5분기 판별력 보강 완료(INFO). `log()` 트랜잭션 보호 부재는 WARNING 유지 |
| documentation | NONE | 핵심 코드 변경 문서 부담 낮음. plan 문장 명시 누락 1건은 비차단 |
| database | LOW | 무중단 배포 위험 없음. enumName 누락이 막았을 파괴적 DDL 잠재 위험 확인(정보성) |

## 발견 없는 에이전트

없음 — 8개 reviewer 모두 최소 INFO 이상 발견사항을 기록함.

## 권장 조치사항

1. (WARNING) `entity-schema-declarations.e2e-spec.ts` 의 컬럼 층 테스트에서 `driver.createSchemaBuilder().log()` 호출을 트랜잭션/SAVEPOINT 로 감싸거나, 최소한 이 파일을 별도 e2e 인스턴스로 격리해 공유 DB 오염 전파 가능성을 제거한다.
2. `--impl-done` 실행 전 `plan/in-progress/entity-column-declaration-drift.md` 체크리스트의 TEST WORKFLOW 실측 문구를 최신 커밋(`717382613`) 기준으로 갱신하거나 재실행 결과를 추가한다.
3. plan 헤더 주석의 `plan/complete/...` 경로 인용과 "선언 생략 vs 거짓 선언 기준" 명시 문장 누락은 `complete/` 이동 작업 시 함께 정리한다(비차단).
4. (선택) `COLUMN_LEVEL`/`isColumnLevel`/`COLUMN_LEVEL_SAMPLES` 를 별도 순수 unit 테스트 모듈로 분리해 DB 인프라 없이도 회귀 방어선이 동작하게 한다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation, database (8명)
  - **제외**: 아래 표 (6명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (forced 전원 결과 확보됨 — 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단 — 엔티티 컬럼 메타데이터 정정 + 정적 문자열 e2e 가드로 성능 영향 표면 낮음 |
  | architecture | 라우터 판단 — 아키텍처 구조 변경 없음(데코레이터 옵션 정정) |
  | dependency | 라우터 판단 — 신규/변경 의존성 없음 |
  | concurrency | 라우터 판단 — 동시성 로직 변경 없음 |
  | api_contract | 라우터 판단 — 컨트롤러/DTO/공개 API 변경 없음 |
  | user_guide_sync | 라우터 판단 — 사용자 대상 문서·가이드 영향 없음(내부 선언 정합화) |
