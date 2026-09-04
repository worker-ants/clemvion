# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — Critical 0건. 이 changeset(V110 `schedule` 인덱스 교체 마이그레이션 + e2e + spec/plan 문서)의 실제 DDL·재실행 안전성·성능 실측 근거는 탄탄하지만, (1) `CREATE INDEX CONCURRENTLY IF NOT EXISTS` 재실행 안전성 주석이 Postgres 의 invalid-index 엣지케이스를 커버하지 못한 채 과장돼 있고(side_effect 는 이를 근거로 MEDIUM 판정), (2) 이미 완료된 V110 적용을 소스 plan 이 여전히 "잔여 작업"으로 서술하는 stale 표기가 남아 있다(documentation MEDIUM). forced whitelist(8개: database, documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과 확보 — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

(없음)

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 데이터베이스/마이그레이션 | `CREATE INDEX CONCURRENTLY IF NOT EXISTS` 의 "재실행 안전" 주석이 실제 Postgres 동작보다 넓게 주장됨 — 빌드가 중간 실패하면 `indisvalid=false` 인 invalid 인덱스가 남는데, `IF NOT EXISTS` 는 이름 존재 여부만 보고 유효성은 검사하지 않아 재실행이 이를 건너뛴 채 "성공"으로 종료될 수 있음(뒤이은 `DROP INDEX ... IF EXISTS idx_schedule_next_run` 은 정상 실행돼 옛 인덱스만 지워짐 → 최종적으로 새 인덱스 invalid + 옛 인덱스 삭제, 즉 이 PR 이 없애려던 seq-scan 기준선으로 조용히 회귀). 동일 패턴이 `V056`/`V106` 선례에서 계승된 것이라 이번 PR 이 새로 만든 결함은 아님(requirement·side_effect·database·testing 4개 에이전트가 공통 지적) | `codebase/backend/migrations/V110__schedule_workspace_next_run_index.sql:33` (주석), `:35-38` (CREATE/DROP 문) | 주석을 "구문 재실행은 안전, 빌드 실패 시 의미론적 복구는 보장 안 됨"으로 좁히거나, 배포 런북에 `SELECT indisvalid FROM pg_index ...` 확인 → invalid 면 수동 `DROP INDEX CONCURRENTLY` 후 재실행 절차 추가. repo-wide 후속(`migrations.md`/`README.md` §5)으로 적합 |
| 2 | 문서화(plan 위생) | plan 종결 상태가 실제 구현 완료를 반영 못함(stale) — "`idx_schedule_next_run` 실측 완료, 답은 (c). **V110 적용만 남았다**"(체크박스 `[ ]`)와 종결조건 표 "잔여는 V110 마이그레이션 적용뿐"이 여전히 남아 있으나, 이 diff 자체가 `V110__*.sql/.conf` 를 생성하고 e2e 검증까지 추가해 그 잔여 작업을 이미 끝냄. 갱신하지 않으면 다음 사람이 "아직 안 끝났다"고 오판해 중복 작업하거나 (a)/(b) 로 직접 재작업할 위험(원문이 이미 이 위험을 지적한 그 시나리오) | `plan/in-progress/spec-draft-nullable-notation-followups.md:379`, `:430`; 동일 사유로 `plan/in-progress/spec-draft-schedule-index.md` frontmatter `status`/§6 서술도 stale | 마무리 커밋에서 체크박스 `[x]`+표 셀 "V110 적용 완료(2026-09-04)"로 갱신, `spec-draft-schedule-index.md` `status` 도 갱신 후 `plan/complete/` 이동 대상 여부 판단 |
| 3 | 문서화(spec Rationale) | `spec/1-data-model.md` 의 `## Rationale` 섹션에 이번 인덱스 교체 결정(4개 후보 — DROP/부분조건 제거/`(workspace_id, next_run_at)`/`(workspace_id)` 단독 — 실측 비교 후 (c) 선택)에 대한 항목이 없음. 같은 파일이 다른 행 변경 시(예: `alert_rule`, `WorkflowVersion.snapshot`) 이미 `## Rationale` 에 근거 항목을 남기는 관행을 갖고 있는데 이번엔 근거가 plan draft 에만 존재 | `spec/1-data-model.md:914`(변경된 Schedule 인덱스 행), `## Rationale` 섹션 | `### Schedule 인덱스 (next_run_at, is_active) → (workspace_id, next_run_at) 교체 (2026-09-04)` 항목 추가(요약+plan draft 링크 패턴) |
| 4 | 테스트 | 이 마이그레이션이 최적화 대상으로 삼은 바로 그 쿼리 — `GET /api/schedules`(Q1, `WHERE workspace_id = ? ORDER BY next_run_at DESC LIMIT 20`) — 를 실행하는 e2e 테스트가 없음. 인덱스의 존재·컬럼 순서·구 인덱스 삭제는 schema 테스트로 검증되지만, "그 인덱스로 서빙되는 API 가 실제로 올바른 결과를 낸다"는 별개 명제이며 미검증(유닛 레벨 쿼리 빌더 테스트만 존재) | `codebase/backend/test/schedule-trigger.e2e-spec.ts` 전체(GET 목록 호출 없음), 대조 `codebase/backend/src/modules/schedules/schedules.controller.ts:52-67` | `GET /api/schedules` workspace 격리+기본 정렬 검증 e2e 추가 권장(기존부터 있던 갭, 이 PR 의 신규 회귀 아님이나 같은 PR 에서 닫는 편이 자연스러움) |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 성능 | 인덱스가 partial→full 전환되며 크기 약 +48%(200,000행 기준 +2.6MB) — 읽기 20배 개선의 트레이드오프인 쓰기 유지보수 비용은 크기 추정치일 뿐 별도 지연시간/처리량 벤치마크 없음 | `codebase/backend/migrations/V110__schedule_workspace_next_run_index.sql:27` | 배포 후 `pg_stat_user_tables`(`n_tup_upd`)·인덱스 쓰기 지연 모니터링 권장 |
| 2 | 성능 | `CREATE INDEX CONCURRENTLY` 빌드 자체의 소요시간(락 보유 기간)이 실측·문서화되지 않음(문서의 실측은 전부 빌드 완료 후 쿼리 성능) | `.conf:3`, `.sql:35-36` | 배포 런북에 "N만 행 기준 예상 소요 Xs" 추정치 기록 권장 |
| 3 | 성능/테스트 | e2e schema 테스트는 인덱스 존재·컬럼 순서·non-partial 여부만 검증하고, 쿼리 플래너가 실제로 그 인덱스를 선택하는지(`EXPLAIN`)는 검증하지 않음 — 통계 미갱신 등으로 향후 플래너가 다시 Seq Scan 을 고르는 회귀는 미감지 | `codebase/backend/test/schedule-trigger.e2e-spec.ts:64-82` | e2e 에 `EXPLAIN` 단언은 flaky 위험 — 강제 불요, 리스크 인지 기록으로 충분 |
| 4 | 범위 | §4(`trigger_id` 인덱스 행 추가, `V106` 문서화 공백을 함께 메움)가 원 티켓("`(next_run_at, is_active)` 부분 인덱스" 단일 이슈) 범위를 살짝 벗어난 드라이브바이 문서 보정 — 근거 명시돼 있고 코드 변경 없이 표 행 1개 추가뿐이라 위험 낮음 | `plan/in-progress/spec-draft-schedule-index.md:128-135`, `spec/1-data-model.md:915` | PR 설명에 "겸사겸사 V106 문서화 공백도 메움" 명시 권장 |
| 5 | 부작용 | 인덱스 교체가 부팅 쿼리(`ScheduleRunner.onModuleInit` 의 `WHERE is_active = TRUE`)의 향후 플래너 선택 완충을 제거함 — 실측·문서화된 의도적 트레이드오프(부팅 쿼리는 1회성이라 영향 작음) | `plan/in-progress/spec-draft-schedule-index.md`("(a) DROP" 절), `.sql:7-12` | 조치 불요, 참고 기록 |
| 6 | 유지보수성 | 마이그레이션 헤더에 실측 벤치마크 표 전문이 plan 문서와 리터럴 중복 — append-only 마이그레이션(수정 금지)과 가변 plan 문서 사이에 수치가 갈릴 여지(실제로 이 PR 내에서도 초안 수치 31배→최종 20배로 한 번 정정된 이력 있음) | `V110__*.sql:14-19` vs `plan/in-progress/spec-draft-schedule-index.md:37-45` | 후속 유사 패턴 시 헤더엔 결론+plan 링크만 남기는 편 권장 |
| 7 | 테스트 | 신규 schema 테스트가 `db` 클라이언트만 쓰는데도 인증/워크스페이스 부트스트랩(`beforeAll`, 60s)에 결속 — `beforeAll` 실패/타임아웃 시 인덱스 검증 자체가 실행 안 됨. 기존 저장소 관례(`notifications-dismiss.e2e-spec.ts`)를 그대로 따른 것이라 이 PR 고유 결함 아님 | `codebase/backend/test/schedule-trigger.e2e-spec.ts:64`(describe 내 `beforeAll`) | 우선순위 낮음 — 마이그레이션 검증을 가벼운 `beforeAll`(단순 `db.connect()`)의 별도 최상위 `describe` 로 분리하면 인증 플레이크와 무관하게 항상 실행되나 관례를 깨는 리팩터라 강제 사안 아님 |
| 8 | 테스트 | 인덱스 DROP 확인 쿼리(`SELECT 1 FROM pg_class WHERE relname = 'idx_schedule_next_run'`)가 `relkind` 를 필터링하지 않음 — 이론상 동명의 다른 카탈로그 객체와 충돌 가능(실질 리스크는 낮음) | `codebase/backend/test/schedule-trigger.e2e-spec.ts:78-80` | 엄밀함 필요 시 `AND relkind = 'i'` 추가(선택 사항) |
| 9 | 문서화 | e2e 스펙 파일 상단 JSDoc "검증 대상" 목록(6개 불릿)이 신규 schema 테스트(스키마/인덱스 drift 방지 축)를 반영하지 못해 파일이 실제로 검증하는 범위의 완전한 요약이 아님(개별 테스트 자체의 JSDoc 은 정확함) | `codebase/backend/test/schedule-trigger.e2e-spec.ts:8-18` | 상단 불릿에 "V110: schedule 인덱스가 (workspace_id, next_run_at) 로 실재하는지(스키마 drift 방지)" 한 줄 추가 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 실질 발견 없음 — 정적 DDL/리터럴만, 인증·인가·시크릿·입력검증 표면 없음 |
| performance | LOW | 인덱스 크기 +48%(쓰기비용 미측정), CONCURRENTLY 빌드 소요시간 미문서화, 플래너 선택 미검증(모두 INFO). 20배 개선 실측 근거는 탄탄 |
| requirement | LOW | plan stale 표기(WARNING 1) + CONCURRENTLY 주석 과대 주장(WARNING 1). spec fidelity·컨벤션 준수는 확인됨 |
| scope | NONE | §4 드라이브바이 문서 보정(INFO) 외 범위 이탈 없음 |
| side_effect | MEDIUM | CONCURRENTLY 실패 후 invalid 인덱스 잔존 + 재실행 안전 과신 주석(WARNING, MEDIUM 판정의 근거) |
| maintainability | NONE | 벤치마크 표 중복(INFO), 주석 스타일 편차(INFO). 컨벤션 준수 확인 |
| testing | LOW | `GET /api/schedules`(Q1) e2e 미검증(WARNING 1), 그 외 재실행-안전 미검증·beforeAll 결속·relkind 미필터(INFO) |
| documentation | MEDIUM | plan stale 표기(WARNING) + spec Rationale 누락(WARNING) — 문서화 밀도 자체는 저장소 평균 상회 |
| database | LOW | invalid 인덱스 재시도 리스크(INFO, requirement/side_effect 의 WARNING 과 동일 근거) 외 순서·설정·실측 근거 전부 정확함 확인 |

## 발견 없는 에이전트

- security — 검토 관점(인젝션/시크릿/인증인가/입력검증/암호화/에러처리/의존성) 전부 점검했으나 이번 changeset(DDL + e2e + 문서)에 해당 표면 자체가 없음

## 권장 조치사항

1. `CREATE INDEX CONCURRENTLY IF NOT EXISTS` 재실행 안전성 주석을 실제 보장 범위로 좁히고, 운영 런북에 `indisvalid` 확인 절차를 추가한다(WARNING #1 — repo-wide 후속으로 `migrations.md`/`README.md` §5 에 반영 권장).
2. 마무리 커밋에서 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 체크박스(`L379`)와 종결조건 표(`L430`)를 "V110 적용 완료"로 갱신하고, `spec-draft-schedule-index.md` frontmatter `status` 도 함께 정정한다(WARNING #2).
3. `spec/1-data-model.md` `## Rationale` 에 이번 인덱스 교체 결정 근거를 짧게 추가한다(WARNING #3).
4. `GET /api/schedules` 목록 엔드포인트에 대한 e2e 테스트(workspace 격리 + 기본 정렬)를 추가한다(WARNING #4 — 기존 갭이나 같은 PR 에서 닫는 것을 권장).
5. (낮은 우선순위) INFO 항목 중 배포 런북 보강(빌드 소요시간, 쓰기비용 모니터링)과 e2e JSDoc 갱신은 여유 있을 때 반영.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, performance, requirement, scope, side_effect, maintainability, testing, documentation, database (9명)
  - **제외**: 아래 표 (5명)
  - **강제 포함(router_safety)**: database, documentation, maintainability, requirement, scope, security, side_effect, testing (8명) — 전원 결과 확보됨, 강제 화이트리스트 미이행 없음

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | architecture | router 판단(이번 changeset 은 마이그레이션+e2e+문서로 아키텍처 변경 없음) |
  | dependency | router 판단(신규 패키지/의존성 변경 없음) |
  | concurrency | router 판단(비-트랜잭션 DDL 외 동시성 로직 변경 없음) |
  | api_contract | router 판단(API 엔드포인트/DTO 계약 변경 없음) |
  | user_guide_sync | router 판단(사용자 가이드 대상 기능 변경 없음) |
