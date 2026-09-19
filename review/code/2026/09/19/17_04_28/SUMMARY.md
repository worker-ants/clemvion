# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 없음, WARNING 2건(모두 신규 e2e 컬럼-층 가드의 검증 커버리지·안전장치 공백에 관한 것). 8개 엔티티 컬럼 데코레이터 정정은 전 reviewer 가 Flyway 마이그레이션과 대조해 정확함을 확인했고 `synchronize: false` 로 런타임 DDL 을 유발하지 않는다. forced(router_safety) whitelist 7명 전원 결과 확보 완료 — 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | 신규 컬럼-층 가드 `COLUMN_LEVEL` 정규식 5개 분기 중 2개(`^ALTER TABLE "[^"]+" ADD "` 신규 컬럼 추가, `RENAME COLUMN`)가 이번 diff·뮤테이션 검증(C1~C9, R1/R2) 어느 것에도 매치된 적이 없어 실행으로 검증되지 않았다(TypeORM 소스 대조로 문법만 1회성 확인). 향후 오탈자·TypeORM 버전업으로 두 패턴이 깨져도 가드는 계속 GREEN이고 "컬럼 추가"·"컬럼 이름 변경" drift 는 조용히 새나간다 | `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:60-66` (`COLUMN_LEVEL`), 관련 근거 `plan/in-progress/entity-column-declaration-drift.md` 뮤턴트 표 | 다섯 패턴 각 1개 + `ADD CONSTRAINT`·`COMMENT ON` near-miss 를 픽스처로 둔 순수 문자열 매칭 unit 테스트를 추가해 라이브 DB 없이 다섯 분기 전체를 결정적으로 커버 |
| 2 | testing | 신규 컬럼-층 테스트만 같은 파일의 기존 3개 테스트(인덱스/유니크/CHECK)와 달리 `inRolledBackTx`(트랜잭션/SAVEPOINT) 보호 없이 TypeORM 비공식 내부 API(`ds.driver.createSchemaBuilder().log()`)를 직접 호출한다 — "읽기 전용"이라는 근거가 소스 대조 기반 주석 하나뿐이라, TypeORM 버전업이 이 계약을 조용히 깨면 공유 e2e DB 스키마가 실제로 바뀔 수 있고 그 사고를 감지할 자체 장치가 없다 | `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:474-476` | `log()` 호출 전후로 대표 테이블의 카탈로그 스냅샷(예: `information_schema.columns` 개수/해시)을 비교해 자체 단언을 추가하거나, 다른 프로브와 동일하게 트랜잭션/SAVEPOINT 로 감싸 방어적으로 만들 것 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement / database | 컬럼 정정 8건 전부 실제 Flyway 마이그레이션(V001·V003·V008·V014·V016·V017·V019·V088)과 line-level 로 일치 확인. `enumName` 미지정 시 TypeORM 이 `${table}_${column}_enum` 로 잘못 추론하던 것을 실제 이름(`node_category`/`edge_type`)으로 정정 | 8개 엔티티 파일 (`alert-rule`·`edge`·`integration-usage-log`·`llm-usage-log`·`model-config`·`node`·`workflow-assistant-session`·`workspace-invitation`) | 조치 불요 |
| 2 | requirement / side_effect / database | `default: 'chat'`(`ModelConfig.kind`) · `default: () => 'now()'`(`WorkflowAssistantSession.lastInteractionAt`) 추가는 INSERT 시 TypeORM 이 `RETURNING` 으로 재조회하는 실제 런타임 부작용을 만들지만, 두 컬럼 모두 서비스 계층이 항상 명시적으로 값을 채워 dead path — e2e(backend 354, Playwright 51)로 검증됨(리뷰 도중 plan 체크리스트 갱신으로 관측) | `model-config.entity.ts:46`, `workflow-assistant-session.entity.ts:75-79`; 호출부 `model-config.service.ts`, `workflow-assistant-session.service.ts:94` | 조치 불요 — 병합 전 plan 체크리스트 갱신이 실커밋에 반영됐는지만 재확인 |
| 3 | security / side_effect / database / testing | 신규 컬럼-층 가드가 TypeORM 비공개 내부 API(`createSchemaBuilder().log()`)에 의존 — 카탈로그만 읽고 DDL 미실행함을 소스 레벨로 확인했으나 공식 계약은 아님 (WARNING #2 와 동일 근거, 안전장치 관점은 WARNING 참고) | `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` 신규 `it` 블록 | TypeORM 업그레이드 시 read-only 전제 재확인 메모를 plan/주석에 남길 것 |
| 4 | database | `type: 'uuid'` 추가로 파라미터 캐스팅이 활성화되어, 잘못된 UUID 문자열을 넘기던 호출 경로가 있었다면 오류 발생 스택 위치(애플리케이션 검증 vs DB 캐스팅)가 미세하게 바뀔 가능성 — DB 컬럼은 이미 uuid 타입이라 실질 회귀 가능성은 낮음 | `alert-rule.entity.ts:19` 등 `type: 'uuid'` 5곳 | e2e 로 이미 커버, 문제 관측 시 해당 엔드포인트 DTO validation 확인 |
| 5 | maintainability | `default: () => 'now()'` 소문자 표기가 코드베이스 다수 관례(`NOW()` 대문자 — `execution.entity.ts`·`node-execution.entity.ts`·`execution-node-log.entity.ts`)와 다름. 기능 영향은 없음(Postgres 함수명 대소문자 무관, 가드 GREEN) | `workflow-assistant-session.entity.ts:78` | 기존 다수 관례(`NOW()`)를 따르거나 정본을 컨벤션 문서에 명시 |
| 6 | maintainability | `UNDECLARED_COLUMNS` 예외 목록 키가 TypeORM 이 내는 원문 DDL 문자열 그대로라 드라이버 출력 포맷에 강하게 결합 — 다만 파일 내 두 번째 assert(예외 목록 신선도 검증)가 있어 조용한 실패는 아님 | `entity-schema-declarations.e2e-spec.ts:44-53` | 당장 조치 불요, TypeORM 업그레이드 시 가장 먼저 깨질 지점으로 인지 |
| 7 | scope | 핵심 diff(8개 엔티티 파일)는 plan 문서 9행 표와 1:1 대응, 각 파일 `@Column` 옵션 한 줄만 최소 수정 — scope 이탈 없음. `entity-schema-declarations.e2e-spec.ts` 확장도 plan 목적에 정확히 부합하는 순수 additive 변경 | 8개 엔티티 파일, e2e-spec.ts | 조치 불요 |
| 8 | scope | `plan/in-progress/spec-draft-nullable-notation-followups.md`(+6줄, 별개 백로그 등재) 와 `review/consistency/2026/09/19/{10_58_34,16_54_09}/**`(--impl-prep 산출물) 는 핵심 diff와 화제가 다르지만 정식 워크플로 부산물이라 scope 이탈 아님 | `plan/in-progress/spec-draft-nullable-notation-followups.md:4860-4864`, `review/consistency/2026/09/19/**` | 조치 불요 |
| 9 | documentation | 신규 헤더 주석이 인용하는 `plan/complete/entity-column-declaration-drift.md` 경로가 아직 존재하지 않음(현재 `plan/in-progress/`) — plan 체크리스트의 마무리 단계(트래커 반영·`complete/` 이동)로 해소될 예정인 일시적 상태 | `entity-schema-declarations.e2e-spec.ts:23`, `plan/in-progress/entity-column-declaration-drift.md` 체크리스트 | 마무리 커밋에서 plan 이동 여부 확인 |
| 10 | documentation | CHANGELOG 미갱신은 이 저장소 관례(사용자 관측 가능한 동작 변화 없음)에 부합, 헤더 JSDoc 은 코드 변경과 정확히 동기화된 모범 사례 | `CHANGELOG.md`(무변경), `entity-schema-declarations.e2e-spec.ts:9-29` | 조치 불요 |
| 11 | documentation | `spec/1-data-model.md` 가 `--impl-prep`/`--impl-done` 스코프에서 빠졌던 문서 갭은 1차 consistency-check 가 이미 포착·plan 에 대응 기록됨(중복 발견 아님) | `plan/in-progress/entity-column-declaration-drift.md:96`, `review/consistency/2026/09/19/10_58_34/SUMMARY.md` | `--impl-done` 실행 시 계획대로 `spec/1-data-model.md` 대조 |
| 12 | requirement | 남은 plan 체크리스트 3개(`/ai-review`, `--impl-done`, 트래커 반영·`complete/` 이동)는 미완료 — 이 리뷰 자체가 그 첫 단계이므로 정상 워크플로 중간 상태 | `plan/in-progress/entity-column-declaration-drift.md` 체크리스트 | 다음 단계 진행 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 정적 데코레이터 메타데이터뿐, 인젝션/시크릿/인증 영향 없음 |
| requirement | NONE | 컬럼 정정 9건 전부 실제 DB·spec 과 일치, spec-코드 새 불일치 없음 |
| scope | NONE | plan 표와 1:1 대응하는 최소 diff, scope 준수 모범 사례 |
| side_effect | LOW | `default` 2건의 RETURNING 부작용(이미 e2e 검증), 내부 API 의존 |
| maintainability | LOW | `NOW()` 대소문자 불일치, 예외목록 키의 원문 SQL 결합 |
| testing | LOW (WARNING 2) | 컬럼-층 가드 5분기 중 2분기 미검증, 트랜잭션 보호 비대칭 |
| documentation | LOW | plan 경로 헤더 주석 일시적 불일치(해소 예정), 그 외 양호 |
| database | LOW | Flyway 대조 완료·무중단, `uuid` 캐스팅 오류 위치 변경 가능성 |

## 발견 없는 에이전트

없음 (실행된 8개 reviewer 모두 최소 INFO 이상 기록).

## 권장 조치사항

1. (WARNING #1) `COLUMN_LEVEL` 의 미검증 2개 분기(`ADD "..."`, `RENAME COLUMN`)를 라이브 DB 없이 검증하는 픽스처 기반 unit 테스트 추가.
2. (WARNING #2) 신규 컬럼-층 e2e 테스트에 카탈로그 스냅샷 비교 또는 트랜잭션/SAVEPOINT 보호를 추가해 다른 3개 테스트와 안전장치 수준을 맞춤.
3. 병합 전, 리뷰 도중 관측된 `plan/in-progress/entity-column-declaration-drift.md` TEST WORKFLOW 체크 갱신이 실제 커밋에 반영됐는지 확인.
4. 마무리 단계에서 plan 을 `plan/complete/` 로 이동하고 헤더 주석 경로 불일치를 자연 해소.
5. `--impl-done` 실행 시 `spec/1-data-model.md` 를 스코프에 포함해 대조.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation, database (8명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — **forced 전원 결과 확보됨, 화이트리스트 미이행 없음**
  - **제외**: 아래 표 (6명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단 — prompt 에 개별 사유 미제공 (엔티티 데코레이터 메타데이터 정정으로 성능 경로 변경 없다고 라우터가 판단한 것으로 추정) |
  | architecture | 라우터 판단 — prompt 에 개별 사유 미제공 |
  | dependency | 라우터 판단 — prompt 에 개별 사유 미제공 (신규/변경 의존성 없음) |
  | concurrency | 라우터 판단 — prompt 에 개별 사유 미제공 |
  | api_contract | 라우터 판단 — prompt 에 개별 사유 미제공 (공개 인터페이스 변경 없음) |
  | user_guide_sync | 라우터 판단 — prompt 에 개별 사유 미제공 (사용자 대면 동작 변화 없음) |
