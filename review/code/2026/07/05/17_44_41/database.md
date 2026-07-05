# 데이터베이스(Database) 리뷰 — trigger-list-cron-nextrun

## 발견사항

- **[INFO]** `schedule.trigger_id` 에 인덱스 없음 — 배치 IN 쿼리가 seq scan 의존
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` (신규 `scheduleRepository.find({ where: { triggerId: In(scheduleTriggerIds), workspaceId } })`), 스키마: `codebase/backend/migrations/V001__initial_schema.sql:161-172`, `codebase/backend/migrations/V002__indexes.sql:29-30`
  - 상세: `schedule` 테이블은 `trigger_id UUID NOT NULL REFERENCES trigger(id) ON DELETE CASCADE` 로 FK 만 있고, Postgres 는 FK 에 자동으로 인덱스를 만들지 않는다. `V002__indexes.sql` 이 만드는 `schedule` 인덱스는 스케줄러 폴링용 `idx_schedule_next_run (next_run_at, is_active) WHERE is_active` 뿐이며 `trigger_id`·`workspace_id` 커버 인덱스가 전혀 없다. 기존 `findOneDetail`(단건) 의 `scheduleRepository.findOne({ where: { triggerId: id, workspaceId } })` 도 동일하게 인덱스 없이 seq scan 이었던 선재 갭이나, 단건 조회라 영향이 낮았다. 이번 변경으로 이 조회가 **목록 페이지 로드마다(페이지당 최대 100건 IN 리스트)** 실행되게 되어 호출 빈도가 늘었다. `schedule` 테이블이 현재 규모에서는 문제가 되지 않겠지만, 워크스페이스·스케줄 수가 늘어나면 매 목록 요청마다 `schedule` 전체 테이블 seq scan(IN 리스트 대비 필터)이 발생해 스케일 저하 요인이 된다.
  - 제안: `schedule` 테이블에 `CREATE INDEX idx_schedule_trigger_id ON schedule (trigger_id)` (또는 `(workspace_id, trigger_id)` 복합 — 이번 쿼리의 `WHERE trigger_id IN (...) AND workspace_id = ?` 조건과 정확히 매칭) 마이그레이션 추가를 권장. `trigger_id` 는 1:1 관계로 보이므로(트리거당 스케줄 최대 1건) `UNIQUE INDEX` 로 스키마 의도까지 함께 표현 가능. 단, 이번 PR 범위 밖 기존 갭이라 즉시 차단 사유는 아님 — 후속 정리로 남겨도 무방.

- **[INFO]** N+1 회피 확인 — 배치 1회 쿼리로 정확히 구현됨
  - 위치: `triggers.service.ts` `findAll()` 신규 블록
  - 상세: 목록 조회 후 `data.filter(t => t.type === 'schedule').map(t => t.id)` 로 이 페이지의 schedule 트리거 id 만 모아 `scheduleRepository.find({ where: { triggerId: In(ids), workspaceId } })` 단일 호출로 전부 가져온 뒤 `Map`으로 매칭한다. 페이지당 스케줄 행 수와 무관하게 쿼리 1회(스케줄 트리거가 0건이면 조회 자체를 skip). 반복문 내 개별 `findOne` 패턴이 아니므로 N+1 문제 없음. spec 언급 `schedules.findAll`/`workflow-list §2.4` 선례와 동일 패턴.

- **[INFO]** `workspaceId` 이중 스코프 — cross-workspace 유출 방지 적절
  - 위치: 동일
  - 상세: 메인 트리거 쿼리(`WHERE t.workspace_id = :workspaceId`)뿐 아니라 schedule 배치 쿼리도 `where: { triggerId: In(...), workspaceId }` 로 `workspaceId` 를 재차 조건에 건다. `triggerId` 가 이미 해당 워크스페이스 트리거로 필터링된 값 목록이라 사실상 중복 스코프지만, defense-in-depth 로 안전측. 파라미터화된 TypeORM `In()`/조건 객체 사용이라 SQL 인젝션 우려 없음(직접 문자열 결합 없음).

- **[INFO]** 페이지네이션 상호작용 — enrichment 는 현재 페이지 범위로 한정, 문제 없음
  - 위치: 동일
  - 상세: `offset/limit` 적용된 `getMany()` 결과(`data`, 페이지당 최대 100행 — `PaginationQueryDto.limit` `@Max(100)`)에서만 schedule id 를 추출하므로 IN 리스트 크기가 페이지 크기로 자연히 상한(≤100)된다. 전체 테이블을 훑는 방식이 아니라 좋은 패턴.

- **[INFO]** 트랜잭션 미사용 — 읽기 전용 조합 쿼리라 불필요
  - 위치: 동일
  - 상세: `findAll` 은 `getCount` + `getMany` + `scheduleRepository.find` 3개의 읽기 쿼리로 구성되며 쓰기가 없다. 트랜잭션 없이도 데이터 정합성 문제는 없다(약한 스냅샷 불일치 가능성은 있으나 목록 표시 용도로 허용 가능한 수준).

## 요약
신규 배치 쿼리는 반복문 내 개별 조회가 아닌 `IN(...)` 단일 쿼리로 N+1 을 정확히 회피했고, `workspaceId` 스코프도 이중으로 걸려 있으며 페이지네이션과도 잘 상호작용한다(enrichment 범위가 현재 페이지로 자연 제한). TypeORM 파라미터화 조건 객체 사용으로 SQL 인젝션 우려도 없다. 유일한 개선 여지는 `schedule.trigger_id` 컬럼에 인덱스가 전혀 없어(`V002__indexes.sql` 은 `next_run_at` 만 커버) 이 조회가 스케일이 커지면 seq scan 에 의존하게 된다는 점인데, 이는 이번 PR 이 만든 문제가 아니라 기존 `findOneDetail` 단건 조회에도 있던 선재 갭이 호출 빈도만 늘어난 것이며 즉시 차단할 사안은 아니다.

## 위험도
LOW
