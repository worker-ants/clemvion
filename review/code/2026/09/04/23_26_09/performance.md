# 성능(Performance) 코드 리뷰

## 검토 범위

실질 코드 변경은 `codebase/backend/migrations/V110__schedule_workspace_next_run_index.{conf,sql}`
(신규 Postgres 인덱스 교체 마이그레이션)과 `codebase/backend/test/schedule-trigger.e2e-spec.ts`
(신규 e2e 2건: 인덱스 스키마 검증 + `GET /api/schedules` 목록 쿼리 검증) 이다. 나머지
(`plan/**`, `spec/**`, `review/code/2026/09/04/23_02_51/**`, `review/consistency/**`)는
문서·plan·이전 리뷰 라운드 산출물이라 실행 성능에 영향이 없어 교차검증 용도로만 대조했다.

교차검증을 위해 실제 소스를 열어 대조했다:
- `codebase/backend/src/modules/schedules/schedules.service.ts` — `findAll()` 이 `WHERE
  s.workspace_id = :workspaceId` 로 진입해 `orderBy(resolveOrderBy(sort), ...)`, `getCount()`
  + `offset/limit`.`getMany()` 로 나뉘는 표준 페이지네이션 패턴임을 확인 (N+1 아님, 조인은
  단일 쿼리의 `leftJoinAndSelect`).
- `codebase/backend/src/modules/schedules/schedule-runner.service.ts:192` — 발사 후
  `scheduleRepository.save(schedule)` 로 `last_run_at`/`next_run_at` 을 갱신 (신규 인덱스의
  쓰기 경로).
- `plan/in-progress/spec-draft-schedule-index.md` — `EXPLAIN (ANALYZE, BUFFERS)` 실측 원본
  (200,000행/2,000 워크스페이스, 5회 median)과 4개 후보(DROP/`(next_run_at)`/`(workspace_id,
  next_run_at)`/`(workspace_id)` 단독) 비교표.

## 발견사항

- **[INFO]** partial → full 인덱스 전환에 따른 쓰기 증폭이 크기 추정치로만 문서화되고 실측(처리량/지연시간)은 없음
  - 위치: `codebase/backend/migrations/V110__schedule_workspace_next_run_index.sql:27` (`-- 크기: 5,368 kB(부분) → 7,960 kB(전체 행). 200,000행 기준 +2.6 MB.`)
  - 상세: 종전 `(next_run_at, is_active) WHERE is_active` 는 활성 70%(140,168/200,000행)만 유지보수 대상이었다. 신규 `(workspace_id, next_run_at)` 은 non-partial 이라 비활성 30% 행까지 인덱스 엔트리를 갖는다 — 크기 기준 약 +48%. `schedule-runner.service.ts:192` 의 `scheduleRepository.save(schedule)` (발사마다 `last_run_at`/`next_run_at` 갱신)가 이 인덱스의 갱신 대상이므로, 워크스페이스당 활성 스케줄 수·평균 cron 주기가 커지면 이 증폭이 쓰기 지연/처리량에 누적될 수 있다. 문서(`spec/1-data-model.md` `## Rationale`, plan draft)는 이 트레이드오프를 명시적으로 인지하고 있으나 크기 차이로만 추정하고, INSERT/UPDATE 자체의 벤치마크는 없다.
  - 제안: 읽기 개선폭(20배)이 압도적이라 결정을 뒤집을 사안은 아니다. 프로덕션 배포 후 `pg_stat_user_tables.n_tup_upd`·인덱스 쓰기 지연 모니터링을 권장 — 다만 이미 이전 리뷰 라운드(`23_02_51`)에서 같은 항목이 지적되었고, "합성 데이터로 낸 수치는 잘못된 기준선이 된다"는 사유로 의도적으로 미조치 처리되어 있다(`RESOLUTION.md` INFO #1). 그 판단은 타당하므로 재차 조치를 요구하지 않되, 배포 후 모니터링이 실제로 이뤄지는지는 이 PR 범위 밖에서 추적 필요.

- **[INFO]** `CREATE INDEX CONCURRENTLY` 자체의 빌드 소요 시간(운영 규모에서 락 보유 기간)이 미측정
  - 위치: `codebase/backend/migrations/V110__schedule_workspace_next_run_index.sql:55-56` (`CREATE INDEX CONCURRENTLY IF NOT EXISTS ...`)
  - 상세: 헤더의 모든 실측(`:14-19`)은 인덱스 *생성 완료 후* 쿼리 성능 비교이고, 생성 자체가 얼마나 걸리는지(테이블 스캔 2회 + `SHARE UPDATE EXCLUSIVE` 유지 기간)는 문서화되지 않았다. 200,000행/7,960kB 규모로는 낮은 위험이지만, 그 판단 근거(예상 소요 시간)가 명시돼 있지 않아 훨씬 큰 프로덕션 테이블에 유사 패턴을 재적용할 때 참고할 선례가 못 된다.
  - 제안: 이번 PR 을 막을 사유는 아니다(이전 라운드에서도 동일하게 판단됨). 배포 런북에 "N만 행 기준 예상 소요 Xs" 추정치를 남기는 후속을 고려.

- **[INFO]** 신규 e2e(`J.`)는 인덱스의 존재·컬럼 순서만 스키마 레벨로 고정하고, 플래너가 실제로 그 인덱스를 **선택하는지**(`EXPLAIN`)는 검증하지 않음
  - 위치: `codebase/backend/test/schedule-trigger.e2e-spec.ts:320-378` (`it('J. 목록 조회 — 워크스페이스 격리 + next_run_at 정렬 (V110 대상 쿼리)', ...)`), 대조 `:66-84` (schema 존재 테스트)
  - 상세: 이 마이그레이션의 성능 주장(20배)은 "인덱스가 존재한다"가 아니라 "플래너가 목록 쿼리에 그 인덱스를 쓴다"는 것이다. `J.` 테스트는 워크스페이스 격리 + 정렬(asc/desc) 정합성을 응답 값으로 실제로 검증해 결과 정확성 회귀는 잡지만, 통계 미갱신·시드 데이터 왜곡 등으로 플래너가 다시 Seq Scan 을 고르는 회귀(성능만 재발하고 결과값은 동일)는 감지하지 못한다.
  - 제안: e2e 환경 시드 규모가 통계적으로 작아 `EXPLAIN` 단언은 flaky 위험이 있다는 판단(이전 라운드 `RESOLUTION.md` INFO #3)에 동의한다. 강제하기보다 인지 기록으로 충분.

## 확인 사항 (결함 아님)

- 목록 쿼리(`schedules.service.ts:findAll`)는 `getCount()` + `getMany()` 2쿼리 표준 페이지네이션이며 반복문 내 DB 호출(N+1) 없음. `leftJoinAndSelect` 로 trigger·workflow 를 단일 쿼리에서 조인.
- 신규 `DROP INDEX CONCURRENTLY IF EXISTS idx_schedule_workspace_next_run;` (`:53`, 재실행 안전성 확보용으로 이번 라운드에 추가된 문장)은 정상 최초 실행에서 대상이 없어 카탈로그 조회만 하는 near-no-op — 성능에 미치는 영향 없음.
- 마이그레이션 순서(CREATE 새 인덱스 → DROP 옛 인덱스)는 어느 시점에도 `workspace_id` 진입 경로가 끊기지 않도록 구성되어 가용성·성능 연속성 모두 확보.
- `CONCURRENTLY` + `.conf` 의 `executeInTransaction=false` 조합은 무중단 배포에 필요한 설정을 정확히 충족.
- 부팅 재등록 쿼리(Q2, `schedule-runner.service.ts:114`, `WHERE is_active = TRUE`)는 이 인덱스 유무와 무관하게 Parallel Seq Scan(활성 비율 70%로 선택도 낮음)이며, 이번 변경이 이 경로의 성능을 악화시키지 않음 — plan draft 실측(`plan/in-progress/spec-draft-schedule-index.md` "Q2 부팅" 절)으로 확인.
- 신규 e2e `J.` 테스트의 `for (const cron of [...]) { await request(...).post(...) }` (스펙 파일 322-333행)는 원소 2개짜리 순차 생성으로, 테스트 결정성을 위한 의도된 직렬화이며 런타임 경로가 아니라 성능 관점 지적 대상 아님.

## 요약

핵심 변경은 `schedule` 목록 조회(`WHERE workspace_id = ? ORDER BY next_run_at DESC LIMIT 20`)가 어떤 인덱스도 못 쓰고 매번 Parallel Seq Scan 을 하던 상태를, `EXPLAIN (ANALYZE, BUFFERS)` 실측(200,000행, 5회 median)으로 직접 확인한 뒤 `(workspace_id, next_run_at)` 복합 인덱스로 교체하는 Flyway 마이그레이션(V110)이다. 목표 쿼리 5.99ms→0.30ms(20배), 기본 정렬(`created_at`)도 6.89ms→1.08ms 로 개선되며, "정렬 컬럼만 남기면 될 것"이라는 직관적 대안이 오히려 2.2배 느려진다는 것까지 실측으로 배제한 근거 밀도가 높다. `CREATE/DROP INDEX CONCURRENTLY` + `executeInTransaction=false` + 재실행 안전성(이번 라운드에 CREATE 앞 DROP 을 추가해 invalid-index 잔존 위험까지 닫음)도 정확하다. `schedules.service.ts` 실제 쿼리 코드를 대조한 결과 N+1·블로킹 I/O·불필요한 반복 계산 등 새로 도입된 알고리즘/자원 문제는 없다. 남는 항목은 전부 INFO 수준 — (1) partial→full 전환에 따른 쓰기 증폭이 크기 추정치로만 문서화되고 실측 벤치마크는 없음(운영 실데이터 필요 사유로 이미 의도적 유예), (2) `CREATE INDEX CONCURRENTLY` 빌드 소요 시간 미문서화, (3) e2e 가 플래너의 실제 인덱스 선택(`EXPLAIN`)까지는 단언하지 않음. 셋 다 이번 PR 을 막을 사유가 아니며 이전 리뷰 라운드(`23_02_51`)에서 이미 같은 결론으로 처리된 항목과 일치한다.

## 위험도
LOW
