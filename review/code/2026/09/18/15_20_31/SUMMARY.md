# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 없음. WARNING 2건은 모두 "이미 알려진, 아직 안 닫힌 창"(plan draft `complete/` 미이동으로 인한 6곳 선인용 + 리뷰 시점 TEST WORKFLOW 체크리스트 미완료)이며, 순수 DB 마이그레이션(FK 인덱스 4개 추가) + e2e 확장 + spec 문서 갱신으로 애플리케이션 코드 변경은 없다. forced 8명 전원 결과 확보됨 — 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | documentation / requirement | `plan/complete/spec-draft-graph-fk-indexes.md` 로의 선인용이 6곳(마이그레이션 헤더 4·e2e JSDoc 1·spec Rationale 1)에 있으나 해당 draft 는 아직 `plan/in-progress/`에 있어 현재 시점 기준 깨진 링크다. requirement reviewer 는 리뷰 도중 다른 세션이 관련 트래커(`plan/complete/spec-draft-deletion-cascade-indexes.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md`)를 동시에 갱신 중임을 관측, 같은 인용 문제가 그쪽에도 2곳 늘었다고 보고 | `codebase/backend/migrations/V117~V120__*.sql:5`, `codebase/backend/test/deletion-cascade-indexes.e2e-spec.ts:15`, `spec/1-data-model.md` Rationale 절 말미 | PR 마지막 커밋에서 draft 를 `plan/complete/`로 이동 + `grep -rln "plan/complete/spec-draft-graph-fk-indexes.md" spec codebase`로 전 인용(부록 표·트래커 신규분 포함) 검증 후 머지. 이동 전 별도 머지 금지 |
| 2 | testing | `/ai-review` 시점에 plan 체크리스트의 `lint · unit · build · e2e` 항목이 `[ ]`(미완료) — SKILL 정의 순서(TEST WORKFLOW → REVIEW WORKFLOW)와 어긋나며, 신규 e2e 4건(V117~V120 인덱스 단언)이 실제로 GREEN 인지 이 리뷰 시점 기준 미확인 | `plan/in-progress/spec-draft-graph-fk-indexes.md` `## 체크리스트` | `/ai-review` 완료 후 반드시 실제 e2e 실행 로그(4건 GREEN) 확보하고 체크박스 갱신. TEST WORKFLOW 커밋과 REVIEW WORKFLOW 커밋 구분 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | scope | 리뷰 페이로드(`scope.md`, 30개 파일)가 실제 `git diff origin/main --stat`(32개 파일) 중 트래커 갱신 파일 2개(`plan/complete/spec-draft-deletion-cascade-indexes.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md`)를 누락 — 내용 대조 결과 plan 문서가 스스로 예고한 범위 내 작업이라 스코프 위반은 아님 | scope reviewer 의 `_prompts/scope.md` vs `git diff --stat` | 리뷰 오케스트레이션에 diff 파일 집합 vs payload 나열 집합 sanity check 추가 검토 |
| 2 | performance / database | `relation` 테이블에 이번 PR 로 3개 인덱스 추가(누적 9개), 쓰기비용 행당 +2.05µs(+10.9%); storage 는 800k 규모 기준 `entity` +25%, `relation` 3개 합 +57% — 헤더 주석·spec Rationale 에 정량 근거 기재, LLM 호출 대비 무시 가능하다는 판단도 타당 | `V117~V120__*.sql` 헤더, `spec/1-data-model.md:996` | 조치 불요. 향후 인덱스 추가 시 이번 실측을 기준선으로 누적 비용 추적 |
| 3 | performance / database | `V119`/`V120`(head/tail_entity_id) 은 기존 KB-선두 복합 인덱스가 있음에도 단일 컬럼 인덱스 추가 — PG18 skip scan 이 KB 수에 비례해 비용 증가(`EXPLAIN Index Searches: 101`)함을 실측으로 확인해 중복이 아님을 소명 | `V119__relation_head_entity_id_index.sql:25-26`, `V120__relation_tail_entity_id_index.sql:24-25` | 조치 불요 |
| 4 | maintainability | V117~V120 `.sql`/`.conf` 헤더 주석 상당 부분이 파일 간 바이트 단위로 동일 반복(실측 배경·비트랜잭션 설명) — `migrations/README.md §5`("파일=원자적 롤백 단위")가 명시적으로 요구하는 의도된 중복, V111~V116 선례와 일치 | `V117~V120__*.sql`(헤더), `.conf` 4개 | 조치 불요. 반복 절이 더 늘면 공용 서술을 README 앵커로 옮기는 리팩터 고려 시점 근접 |
| 5 | testing | 성능 개선 주장(129,941ms→48.1ms)에 대한 자동 회귀 테스트 부재(존재/definition 만 검증) — V112~V116 선례부터 이어진 기존 설계 갭, 이 PR 단독 결함 아님 | `deletion-cascade-indexes.e2e-spec.ts` | 조치 불요 |
| 6 | testing | `check-migration-versions.py` 가 "`.sql` 안 CONCURRENTLY 이면 `.conf` 필수"의 역방향을 강제하지 않음 — 기존 하네스 갭, 이번 PR 은 `.conf` 정확히 동봉해 영향 없음 | `scripts/check-migration-versions.py` | 조치 불요(스코프 밖) |
| 7 | requirement | 신규 FK 인덱스 4개에 대응하는 TypeORM `@Index` 데코레이터를 엔티티 파일에 추가하지 않음 — V115/V116 선례도 동일(순수 SQL 마이그레이션 관리 관행과 일치) | `entity.entity.ts`, `relation.entity.ts` | 조치 불요 |
| 8 | database | 배포 후 `pg_stat_user_indexes` 로 `idx_relation_head_entity_id`/`idx_relation_tail_entity_id` 실사용률 확인 권장(참고용) | - | 선택적 후속 관찰 |
| 9 | performance | `CREATE INDEX CONCURRENTLY` 는 800k+ 규모에서 백그라운드 빌드 시간이 상당할 수 있음 — CONCURRENTLY 의 일반적 운영 특성, 신규 결함 아님 | `V117~V120__*.sql` | 조치 불요, 배포 타이밍 고려 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 정적 DDL·파라미터 바인딩 쿼리뿐, 인젝션/시크릿/인가 이슈 없음 |
| performance | NONE | 쓰기비용·storage 증가 실측·정당화됨, CRITICAL/WARNING 없음 |
| requirement | LOW | 기능/spec fidelity 정확 일치, plan `complete/` 미이동 창(WARNING 1) |
| scope | NONE | 32개 파일 전부 단일 작업으로 수렴, payload 누락 2건은 스코프 위반 아님 |
| side_effect | NONE | FK 트리거 탐색경로만 변경, 애플리케이션 부작용 없음 |
| maintainability | NONE | 함수/복잡도 해당 없음(순수 DDL), 주석 반복은 README §5 의도된 패턴 |
| testing | LOW | e2e 4건 패턴 재사용 양호, 리뷰 시점 TEST WORKFLOW 체크 미완료(WARNING 1) |
| documentation | LOW | 수치·앵커 상호 일치, `plan/complete/` 선인용 6곳 깨짐(WARNING 1) |
| database | LOW | nullable/partial 대응 정확, 무중단 배포 컨벤션 준수, storage/쓰기비용 증가는 정당화됨 |
| user_guide_sync | NONE | doc-sync-matrix 20개 trigger 전부 불일치 또는 갭 없음 확인 |

## 발견 없는 에이전트

security, performance, scope, side_effect, maintainability, user_guide_sync — 실질 결함(WARNING 이상) 없음.

## 권장 조치사항

1. PR 마지막 커밋에서 `plan/in-progress/spec-draft-graph-fk-indexes.md` 를 `plan/complete/`로 이동하고, `grep -rln "plan/complete/spec-draft-graph-fk-indexes.md" spec codebase plan review`로 6곳+병행 갱신된 트래커 인용까지 전부 유효 경로를 가리키는지 확인한다.
2. `/ai-review` 이후 실제 `lint · unit · build · e2e`(신규 e2e 4건 GREEN 포함)를 실행하고 plan 체크리스트를 갱신한다.
3. (선택) 배포 후 `pg_stat_user_indexes` 로 신규 인덱스 실사용률을 확인해 두면 향후 유사 판단에 참고할 수 있다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, performance, requirement, scope, side_effect, maintainability, testing, documentation, database, user_guide_sync (10명)
  - **제외**: 아래 표 (4명)
  - **강제 포함(router_safety)**: database, documentation, maintainability, requirement, scope, security, side_effect, testing (전원 결과 확보됨 — 화이트리스트 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | architecture | router 판단상 이번 변경(순수 DB 마이그레이션 4건 + e2e 확장)과 무관 |
  | dependency | 의존성 변경 없음 |
  | concurrency | 애플리케이션 동시성 로직 변경 없음(DDL만) |
  | api_contract | API 계약 변경 없음 |
