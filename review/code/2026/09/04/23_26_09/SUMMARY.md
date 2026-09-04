# Code Review 통합 보고서

## 전체 위험도
**LOW** — Postgres 인덱스 교체 마이그레이션(V110) + e2e 2건. Critical 없음. WARNING 3건 모두 blocking 사유 아님(가독성/절차/저확률 운영 경로). forced whitelist(database, documentation, maintainability, requirement, scope, security, side_effect, testing) 8명 전원 결과 확보 확인 — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | documentation / requirement | `plan/in-progress/spec-draft-schedule-index.md` 가 `status: complete` 이고 §6 산출물 표 4행 전부 "완료"인데도 `plan/complete/` 로 이동되지 않음. 직전 코드리뷰(`23_02_51` documentation W1)와 consistency-check(`22_43_40` INFO#5) 두 차례 "범위 밖"으로 미뤄져 아직 미해소 | `plan/in-progress/spec-draft-schedule-index.md:6`(frontmatter), 경로 자체 | 마무리 커밋에서 `git mv plan/in-progress/spec-draft-schedule-index.md plan/complete/spec-draft-schedule-index.md` + 인입 참조 2곳(`spec/1-data-model.md:978`, `spec-draft-nullable-notation-followups.md:379`) 경로 갱신. 자동 가드가 이 방향(in-progress + 종료 status)을 검사하지 않으므로 이번에 확정 필요 |
| 2 | maintainability / testing | 신규 `it('J. 목록 조회 ...')` 테스트가 파일의 "물리적 순서 = 알파벳 레이블" 관례를 깨고 `H.`와 `I.` 사이에 삽입되어 실제 순서가 `..., H, J, I` 가 됨 | `codebase/backend/test/schedule-trigger.e2e-spec.ts` — `H.` 직후 `I.` 직전에 삽입된 `J.` 블록 | `J.` 블록을 `I.` 뒤(파일 끝)로 이동하거나 `I.`↔`J.` 레이블 맞교환 |
| 3 | side_effect | 이전 라운드 W1(invalid 인덱스 재실행 위험) 수정으로 추가된 `DROP INDEX CONCURRENTLY IF EXISTS idx_schedule_workspace_next_run;`(CREATE 앞)이 "실패 후 재실행"은 안전하게 만들지만, **이미 성공한 마이그레이션을 수동으로 재실행**(`flyway repair` 등 정상 Flyway 흐름 밖 운영 개입)하면 살아 있는 인덱스를 지우고 처음부터 재빌드 — 그 구간 동안 `(workspace_id, next_run_at)` 진입로가 일시적으로 사라짐. 수정 전 버전(단순 CREATE IF NOT EXISTS)은 이 경로에서 완전 no-op 이었음 | `codebase/backend/migrations/V110__schedule_workspace_next_run_index.sql:53`(신규 DROP), `:32-51`(헤더 설명 — 이 트레이드오프 미언급) | 헤더 주석에 "이 DROP-first 는 실패 후 재실행만 대상 — 이미 성공한 마이그레이션을 수동 재실행하면 살아있는 인덱스가 재빌드된다(정상 흐름에서는 미발생)" 한 줄 추가. 이미 등재된 후속 항목(`spec-draft-nullable-notation-followups.md`, CONCURRENTLY 재실행 규약화)에 이 비대칭도 함께 담을 것 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security / side_effect / database | 직전 라운드(`23_02_51`) W1 "CREATE INDEX CONCURRENTLY IF NOT EXISTS 가 invalid 인덱스를 못 알아채 재실행 시 인덱스 0개로 회귀" — DROP(신규명)→CREATE→DROP(구명) 순서로 실제 해소 확인(3개 reviewer 독립 재검증). 단, 이 수정이 새 트레이드오프(WARNING #3)를 도입 | `V110__schedule_workspace_next_run_index.sql:53-58` | 없음(WARNING #3 로 별도 기록) |
| 2 | security / database | SQL 인젝션 표면 없음 — 마이그레이션은 전부 정적 리터럴 DDL, `schedules.service.ts` 는 화이트리스트+TypeORM 파라미터 바인딩 유지(diff 밖, 변경 없음) | `V110__*.sql:53-58`, `schedule-trigger.e2e-spec.ts` 의 `db.query` | 없음 |
| 3 | security | 하드코딩 시크릿 없음 — `plan/in-progress/spec-draft-schedule-index.md` 의 `POSTGRES_PASSWORD=probe` 는 로컬 일회용 더미(실행 코드/설정에는 미포함) | `plan/in-progress/spec-draft-schedule-index.md:191` | 없음 |
| 4 | security / database | 워크스페이스 인가 경계 변경 없음 — 신규 e2e(`J.`)가 오히려 다른 워크스페이스 헤더로 조회 시 자기 스케줄 비노출을 명시적으로 단언 | `schedule-trigger.e2e-spec.ts:320-378` | 없음 |
| 5 | performance | partial→full 인덱스 전환에 따른 쓰기 증폭(+48% 크기 추정)이 실측 벤치마크(처리량/지연) 없이 크기 추정치로만 문서화. 이미 "합성 데이터 기준선 왜곡" 사유로 의도적 유예 처리됨(`23_02_51` RESOLUTION) | `V110__*.sql:27` | 배포 후 `pg_stat_user_tables.n_tup_upd`/쓰기 지연 모니터링 권장(이 PR 범위 밖) |
| 6 | performance | `CREATE INDEX CONCURRENTLY` 자체의 빌드 소요 시간(운영 규모 락 보유 기간)이 미측정 — 200,000행 규모는 저위험이나 더 큰 테이블 재적용 시 참고할 선례가 못 됨 | `V110__*.sql:55-56` | 배포 런북에 "N만 행 기준 예상 소요 Xs" 추정치 후속 고려 |
| 7 | performance | 신규 e2e 는 인덱스 "존재"만 스키마 레벨로 고정하고, 플래너가 실제로 이 인덱스를 선택하는지(`EXPLAIN`)는 미검증 — 통계 미갱신 등으로 인한 조용한 성능 회귀(seq scan 복귀)는 결과값 검증만으론 못 잡음 | `schedule-trigger.e2e-spec.ts:320-378` | e2e 시드 규모가 작아 `EXPLAIN` 단언은 flaky 위험 있음(이전 라운드 판단) — 강제보다 인지 기록으로 충분 |
| 8 | testing | 이 인덱스가 함께 개선한다고 주장하는 **기본 정렬**(`created_at`, `sort` 파라미터 생략) 경로가 `J.` 테스트에서 호출은 되지만 정렬 정확성은 미단언 — 파일 JSDoc "둘 다 확인한다" 서술과 실제 커버리지 사이 괴리 | `schedule-trigger.e2e-spec.ts:371` (호출), `:59-64`(JSDoc) | `:371` 응답에도 `createdAt` 기준 정렬 단언 1줄 추가 |
| 9 | testing | mock 기반 unit 테스트(`schedules.service.spec.ts`)의 `sort/order` 파라미터화 케이스에 이 PR 이 최적화한 정확한 축(`next_run_at`)이 없음 — e2e 로는 닫혀 있으나 빠른 회귀 방어선에서 하필 이 축만 빠짐 | `schedules.service.spec.ts:109-155` | `it('sort=next_run_at&order=desc 를 반영', ...)` 한 줄 추가 고려 |
| 10 | scope | `(trigger_id)` 인덱스 spec 표 행 추가는 이번 티켓과 무관한 V106 문서화 공백을 메우는 드라이브바이 — 직전 라운드에서 이미 INFO 판정·처분 완료, 이번엔 diff 유지만 확인 | `spec/1-data-model.md:915` | 기존 처분 유지로 충분 |
| 11 | scope / database / documentation | "CREATE INDEX CONCURRENTLY IF NOT EXISTS 재실행 위험 — 규약 차원 처리" 신규 후속 항목이 이번 PR 범위 밖 작업(V056/V106 선례 포함 일반화)을 plan 에만 등재 — 코드 확장 없이 track 분리(planner: spec/conventions, developer: 런북) 명확 | `plan/in-progress/spec-draft-nullable-notation-followups.md:395-413` | 조치 불요, 공개 기록만 |
| 12 | maintainability | `J.` 테스트 내 asc/desc 시간 추출 로직(`map→filter→map` 3단 체인)이 거의 동일하게 2회 반복 | `schedule-trigger.e2e-spec.ts` (`ascTimes`/`descTimes`) | 지역 헬퍼로 추출 고려(낮은 우선순위) |
| 13 | maintainability | 마이그레이션 헤더 주석이 저장소 동종 파일(V056 23줄, V106 15줄) 대비 최장(63줄 중 주석 52줄) — 이번 W1 대응으로 격차 더 벌어짐 | `V110__*.sql:1-51` | 반복되는 안전성 설명은 `migrations/README.md`/`spec/conventions/migrations.md` 로 옮기고 링크만 남기는 것을 후속 항목에 포함 고려 |
| 14 | maintainability | 동일 벤치마크 표가 SQL 헤더/plan draft/spec Rationale 세 곳에 중복 — 이미 "plan 은 이동 시 경로 바뀌므로 spec 에 안정 사본" 사유로 의도적 처분됨 | `V110__*.sql:14-19`, `spec/1-data-model.md` Rationale | 없음(기존 처분 유지) |
| 15 | database / documentation / requirement | spec 미러 정합 확인 — `spec/1-data-model.md` §3+Rationale, `spec/data-flow/10-triggers.md` §2.1 모두 마이그레이션 헤더 수치와 line-level 일치, 직전 라운드 W2/W3 해소 확인 | `spec/1-data-model.md:914-978`, `spec/data-flow/10-triggers.md:175` | 없음 |
| 16 | database | `migrations/README.md` §5 "CREATE INDEX CONCURRENTLY 정확히 한 개" 컨벤션 위반 아님 — DROP 개수는 제한 대상 아님, V056 선례와 형태 정합 | `V110__*.sql`, `migrations/README.md:125-139` | 없음 |
| 17 | database | 커넥션 관리 정상 — 신규 e2e 는 파일 공유 `db` 클라이언트 재사용, 별도 누수 없음. 페이지네이션/N+1 문제 없음(`findAll` 단일 쿼리) | `schedule-trigger.e2e-spec.ts`, `schedules.service.ts:96-107` | 없음 |
| 18 | documentation | `CHANGELOG.md` 미추가는 저장소 관례와 정합 — 순수 내부 DB 최적화로 클라이언트 가시 동작 변경 없음 | `CHANGELOG.md`(미변경) | 없음 |
| 19 | 전체 | 인덱스 선택 근거가 `EXPLAIN (ANALYZE, BUFFERS)` 실측(200,000행, 5회 median)으로 뒷받침되고, "정렬 컬럼만 선두"가 오히려 2.2배 느려진다는 반직관적 결과까지 계획 근거로 남김 — 근거 밀도 높음(확인용) | `V110__*.sql:14-27`, `plan/in-progress/spec-draft-schedule-index.md §1` | 없음 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 인젝션/시크릿/인가 이상 없음. 직전 W1 완화 확인 |
| performance | LOW | 20배 개선 실측 확실. 쓰기증폭·빌드시간·planner 선택 검증은 INFO 수준 잔여 |
| requirement | LOW | 직전 WARNING 4건 전부 해소 확인. 유일 잔여는 plan lifecycle 이동 누락 |
| scope | NONE | 단일 목표(V110) 수렴, 드라이브바이 2건 모두 이미 처분된 저위험 INFO |
| side_effect | LOW | W1 해소 확인, 단 DROP-first 가 "성공 후 수동 재실행" 경로에 새 재빌드 트레이드오프 도입(WARNING) |
| maintainability | LOW | 코드 변경 규모 작음. `J.` 레이블 순서 어긋남(WARNING), 나머지는 기존 처분된 INFO |
| testing | LOW | 직전 유일 WARNING(대상 쿼리 e2e 부재) 해소. 기본 정렬 미단언·unit 커버리지 축 공백은 INFO |
| documentation | LOW | 직전 WARNING 2건 해소 확인. plan lifecycle 이동 누락만 잔여(WARNING, requirement 와 동일 항목) |
| database | LOW | DB 관점 결함 없음. W1 해소·spec 미러 정합·인젝션/N+1 없음 확인 |

## 발견 없는 에이전트

없음 — 9개 reviewer 전원이 최소 1건 이상의 INFO/WARNING 을 보고함.

## 권장 조치사항

1. `plan/in-progress/spec-draft-schedule-index.md` 를 `plan/complete/` 로 `git mv`(마무리 커밋) + 인입 참조 2곳(`spec/1-data-model.md:978`, `spec-draft-nullable-notation-followups.md:379`) 경로 갱신 — 두 차례 미뤄진 항목이므로 이번에 확정.
2. `V110__*.sql` 헤더 주석에 "DROP-first 는 실패 후 재실행만 대상 — 성공한 마이그레이션 수동 재실행 시 인덱스가 재빌드됨" 한 줄 추가(비대칭 명시).
3. `schedule-trigger.e2e-spec.ts` 의 `J.` 테스트를 `I.` 뒤로 옮기거나 레이블 맞교환.
4. (낮은 우선순위) 기본 정렬(`created_at`) 응답 정렬 단언 추가, `schedules.service.spec.ts` 에 `next_run_at` 정렬 unit 케이스 추가.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, performance, requirement, scope, side_effect, maintainability, testing, documentation, database` (9명)
  - **강제 포함(router_safety)**: `database, documentation, maintainability, requirement, scope, security, side_effect, testing` (8명, 전원 결과 확보 확인 — 미이행 없음)
  - **제외**: 5명

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | architecture | 라우터 판단(본 diff 는 신규 아키텍처 요소 없음, 사유 상세 미제공) |
  | dependency | 라우터 판단(신규/변경 패키지 의존성 없음, 사유 상세 미제공) |
  | concurrency | 라우터 판단(동시성 로직 변경 없음, 사유 상세 미제공) |
  | api_contract | 라우터 판단(API 요청/응답 계약 변경 없음, 사유 상세 미제공) |
  | user_guide_sync | 라우터 판단(사용자 가이드 대상 변경 없음, 사유 상세 미제공) |
