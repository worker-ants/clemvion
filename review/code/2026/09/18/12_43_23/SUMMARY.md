# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 없음. WARNING 1건(문서화 — 새 마이그레이션 패턴이 canonical 컨벤션 문서에 미반영, 블로킹 아님). 나머지는 전부 INFO(관찰/확인 사항)이며 대부분 이미 plan 체크리스트·이전 consistency-check 로 disclosure 되어 있음. forced 8개 reviewer(database, documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과 확보됨 — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Documentation / Database | 신규 추가 인덱스에 "방어적 DROP-먼저"를 적용하는 V111 패턴(`DROP INDEX CONCURRENTLY IF EXISTS` → `CREATE INDEX CONCURRENTLY IF NOT EXISTS`, 동일 이름)이 canonical 컨벤션 문서 어디에도 반영되지 않음. `migrations/README.md` §5 "인덱스 교체는 DROP-먼저"·`spec/conventions/migrations.md` §5 는 기존 두 형태(V056=진짜 교체, V106=짝 DROP 없는 순수 신규 추가로 invalid 잔재가 영영 유효해지지 않는 리스크를 감수)만 규약화하며, V111 은 그 둘 중 어디에도 속하지 않는 제3의 변형이다. 근거는 V111.sql 헤더 주석과 plan draft 에만 있고 재사용 가능한 가이드 문서에는 없어, 다음 net-new 인덱스 작성자가 이 판단을 재발견하거나 V106 의 영구-invalid 리스크를 다시 반복할 수 있다. | `codebase/backend/migrations/README.md:141,168-173`; `spec/conventions/migrations.md:74-77`; `codebase/backend/migrations/V111__trigger_workflow_id_index.sql:31-33` | README §5 대조표에 V111 형태(신규 추가 + 방어적 DROP, 짝이 되는 옛 인덱스 DROP 없음)를 세 번째 행으로 추가하거나, "신규 추가에도 방어적 DROP 을 두는 편이 V106 보다 안전하다"는 권고 문장을 §5 에 명시. `spec/conventions/migrations.md` §5 의 "인덱스 교체는 별도 패턴이 있다" 문구도 범위를 넓힐 것. (블로킹 아님 — 동작 자체는 안전, 문서 정합성 차원) |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Performance | 신규 인덱스의 조회측 3경로는 20k/80k/320k 행 실측(Seq Scan→Bitmap Index Scan)으로 검증됐으나, INSERT 측 쓰기 비용은 "workflow_id 불변이라 무시 가능"이라는 정성적 주장만 있고 정량 벤치마크 없음 | `codebase/backend/migrations/V111__trigger_workflow_id_index.sql:18` | 필수 아님 — 남기면 "쓰기 비용 무시 가능" 주장이 완전히 실측 기반이 됨 |
| 2 | Performance | 같은 클래스(부모 FK 선두 인덱스 부재)의 나머지 6개(`integration_usage_log.workflow_id`, `alert_rule.workflow_id` 등)는 의도적으로 defer, 이미 트래커에 등재됨 — 새 결함 아님 | `spec/1-data-model.md` Rationale, `plan/in-progress/spec-draft-trigger-workflow-index.md` "트래커 반영" | 조치 불요, 참고 기록 |
| 3 | Requirement / Documentation | SQL 헤더 주석·신규 e2e JSDoc·`spec/1-data-model.md`가 아직 `plan/in-progress/`에 있는 draft 를 `plan/complete/spec-draft-trigger-workflow-index.md`로 인용 — 선례(#1285/V110)와 동일하게 "이 PR 의 마지막 커밋에서 이동"이 명시적으로 처분된 절차이나, 현재 스냅샷 기준으로는 존재하지 않는 경로를 가리킴 | `V111__trigger_workflow_id_index.sql:5`; `trigger-deletion-releases-resources.e2e-spec.ts` 신규 `it` JSDoc; `spec/1-data-model.md:987` | 별도 수정 불요 — push 전 draft 가 실제로 `plan/complete/`로 이동하고 트래커가 갱신됐는지만 확인 |
| 4 | Scope | §3 인덱스 전략 표에 트래커 원 스코프(1·3번째 불릿) 밖의 `notification_health` 부분 인덱스 행이 함께 추가됨(V061 이 이미 만든 기존 인덱스의 문서화 갭 보강) — plan 체크리스트에 disclosure 됨 | `spec/1-data-model.md:925` | 되돌림 불요. 반복되면 별도 트래커 항목으로 분리하는 옵션과 저울질 |
| 5 | Scope | V111 의 DROP-먼저 패턴은 최초 `--spec` 체크 시점 target(V106 형태, CREATE-only)에서 리뷰 반영으로 변경된 것 — 정상적인 반복 리뷰 결과, SQL 주석에 근거 기록됨 | `V111__trigger_workflow_id_index.sql` vs `review/consistency/2026/09/18/12_18_52/_target/...` | 조치 불요 |
| 6 | Maintainability | 마이그레이션 파일 주석/코드 비율이 매우 높음(약 30줄 주석 : 4줄 SQL) — 기존 README §4·§5 관례(V106·V110 선례)와 일치, 일탈 아님 | `V111__trigger_workflow_id_index.sql:1-30` (주석) vs `:31-35` (DDL) | 조치 불요 |
| 7 | Maintainability | 선택 컬럼(`id/type/config`) 근거가 프로덕션 JSDoc 과 테스트 주석 두 곳에 중복 서술 — drift 시 `toHaveBeenCalledWith` 단언이 즉시 깨져 감지되므로 실질 위험 낮음 | `trigger-resource-releaser.service.ts` JSDoc / `.spec.ts` 주석 | 선택 사항 — 테스트 주석에서 JSDoc `{@link}` 참조로 서술 단일화 고려 |
| 8 | Testing | `select` 축소 중 `config` 필드(chat-channel teardown 소비)는 telegram provider mock 부재·비용(~18초/호출)으로 e2e 행동 커버리지가 없고, 방어가 두 개의 분리된 유닛 테스트(select 축소 자체 vs 소비 로직)로 나뉨 — 교차 통합 테스트 부재. 뮤턴트 실측(`config`/`type` 제거 시 각각 RED 1/1)으로 현재는 문제 없음이 확인됨 | `trigger-deletion-releases-resources.e2e-spec.ts` 상단 독스트링; `trigger-resource-releaser.service.ts:72` | 향후 telegram 외 provider e2e mock 이 생기면 chat-channel 트리거를 끼워 e2e 로도 닫는 것을 고려 (우선순위 낮음) |
| 9 | Testing | `releaseExternalForParent`/`releaseExternalMany` 의 "부모 밑 트리거 0개" 엣지 케이스가 직접 테스트되지 않음(가장 가까운 테스트는 트리거 1개 기준) | `trigger-resource-releaser.service.ts:149-165`; `.spec.ts:128-136` | `triggers: []` 로 no-op 을 단언하는 케이스 추가 고려 (선택, 우선순위 낮음) |
| 10 | Database | `releaseExternalMany` 내부 `scheduleRepository.find(...)`(이번 diff 범위 밖, 기존 코드)는 `select` 프로젝션이 없어 `Schedule` 전체 컬럼을 적재 — 이번 PR 의 "필드 좁히기" 원칙을 적용할 여지가 있으나 스코프 밖 | `trigger-resource-releaser.service.ts` (`releaseExternalMany` 내부) | 별도 항목으로만 기록, 이번 PR 조치 불요 |
| 11 | Security | 신규 SQL·e2e 쿼리 전부 정적 리터럴(인덱스명/테이블명/컬럼명 하드코딩)이라 인젝션 표면 없음; `select` 좁히기는 노출 컬럼을 줄이는 방향이라 새 정보 노출 없음 | `V111__trigger_workflow_id_index.sql:31-33`; `trigger-resource-releaser.service.ts:73-76` | 조치 불요 |
| 12 | Side Effect / Database | `select: { id, type, config }` 축소가 실제 다운스트림 소비처(`releaseExternalMany`, `teardownChatChannel`, `channelListenerRegistry.unregister`)와 정확히 일치함을 소스 추적으로 확인 — 의도치 않은 상태 변경 없음 | `trigger-resource-releaser.service.ts:72-77,149-165`; `chat-channel-binder.service.ts:365-371` | 조치 불요 (확인 완료) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 인젝션 표면 없음, select 축소가 노출 감소 방향, 시크릿 없음 |
| performance | NONE | 조회 3경로 실측 기반 대폭 개선, INSERT 비용은 정성적 근거만(INFO) |
| requirement | NONE | select 완전성·spec fidelity 확인, plan/complete 경로 선반영은 절차대로 처리 예정(INFO) |
| scope | LOW | notification_health 행 추가·DROP 패턴 변경 등 스코프 소폭 확장, 모두 disclosure 됨 |
| side_effect | NONE | 시그니처/공개 인터페이스 불변, select 축소·마이그레이션 DDL 모두 의도된 부작용만 |
| maintainability | NONE | 스코프 작고 기존 컨벤션 준수, 주석 중복·비율 관련 INFO만 |
| testing | LOW | 회귀 없음(11/11 GREEN, tsc 클린), config 축소 e2e 커버리지·0-트리거 엣지케이스 갭(INFO) |
| documentation | LOW | 핵심 코드 주석은 정확·상세하나 새 DROP-먼저 패턴이 canonical 문서 미반영(WARNING 1) |
| database | LOW | 인덱스·프로젝션 안전성 확인, DROP-먼저 패턴이 README 미분류 제3형태(WARNING과 중복 관찰) |

## 발견 없는 에이전트

없음 — 9개 reviewer 전원이 최소 1건 이상의 INFO(확인/관찰) 기록을 남김. 다만 CRITICAL 은 전원 0건이며, WARNING 은 documentation/database 가 공통 지적한 1건뿐임.

## 권장 조치사항
1. (선택, 비블로킹) `migrations/README.md` §5 대조표와 `spec/conventions/migrations.md` §5 에 "신규 추가 + 방어적 DROP-먼저"(V111) 형태를 V056/V106 과 나란히 세 번째 패턴으로 명문화한다.
2. push 전, `plan/in-progress/spec-draft-trigger-workflow-index.md` 가 실제로 `plan/complete/`로 이동하고 트래커가 갱신됐는지 확인한다(코드 주석 3곳이 이미 그 경로를 인용 중).
3. (선택) `releaseExternalForParent`/`releaseExternalMany` 에 "트리거 0개" 엣지 케이스 유닛 테스트를 추가한다.
4. (선택, 낮은 우선순위) `config` 필드 select 축소의 e2e 행동 커버리지를 향후 telegram 외 provider mock 이 생기면 보강한다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, performance, requirement, scope, side_effect, maintainability, testing, documentation, database (9명)
  - **강제 포함(router_safety)**: database, documentation, maintainability, requirement, scope, security, side_effect, testing (8명) — 전원 결과 확보됨, 미이행 없음
  - **제외**: 아래 표 (5명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | architecture | router 판단상 이번 diff 범위(인덱스 마이그레이션 + select 좁히기)에 아키텍처 영향 낮음으로 제외 |
  | dependency | 신규/변경 의존성 없어 제외 |
  | concurrency | 트랜잭션/락 구조 변경 없어 제외 |
  | api_contract | 공개 API/DTO 계약 변경 없어 제외 |
  | user_guide_sync | 사용자 대면 UI/가이드 변경 없어 제외 |
