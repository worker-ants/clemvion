# 부작용(Side Effect) 리뷰

## 검토 범위

`plan-in-progress-items-b0c80b` worktree 의 변경 16개 파일. 실질적으로 부작용 표면을 가진 것은
DB 스키마를 바꾸는 마이그레이션 2개(`V110__schedule_workspace_next_run_index.{conf,sql}`)와
그 검증용 e2e 테스트 1개뿐이다. 나머지(plan/spec/review 문서류)는 문서 편집으로, 이 관점에서
런타임 부작용을 일으키지 않는다.

뮤테이션은 수행하지 않았다 — 저장소 밖 실행 없이 Postgres `CREATE/DROP INDEX CONCURRENTLY` 의
표준 문서화된 동작(공식 PostgreSQL 문서의 "Building Indexes Concurrently" 절)에 근거해 판단했다.
`git status --short` 로 확인한 결과 이 리뷰 세션은 저장소 파일을 하나도 건드리지 않았다.

## 발견사항

- **[WARNING]** `CREATE INDEX CONCURRENTLY IF NOT EXISTS` 재시도 안전성 주석이 INVALID 인덱스
  잔존 케이스를 커버하지 못한다
  - 위치: `codebase/backend/migrations/V110__schedule_workspace_next_run_index.sql:33` (주석
    "IF NOT EXISTS / IF EXISTS 로 CONCURRENTLY 실패 후 부분 상태에서도 재실행 안전.") 및
    `:35-38` (`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_schedule_workspace_next_run ...` →
    `DROP INDEX CONCURRENTLY IF EXISTS idx_schedule_next_run;`)
  - 상세: PostgreSQL 문서상 `CREATE INDEX CONCURRENTLY` 가 빌드 도중 실패(연결 끊김, 배포
    타임아웃, 세션 kill 등 — 이 마이그레이션은 `executeInTransaction=false`(비-트랜잭션)이므로
    Flyway 프로세스가 스텝 사이에서 중단될 창이 실제로 존재한다)하면 인덱스는 **삭제되지 않고
    `indisvalid=false` 인 채로 남는다.** 이 INVALID 인덱스는 플래너가 무시하지만 이후 모든
    `schedule` 테이블 write 에 계속 유지비용을 부과한다. 이 상태에서 마이그레이션을 재실행하면
    `IF NOT EXISTS` 는 **이름이 이미 존재한다는 이유만으로** 재빌드를 건너뛴다(유효성은 보지
    않음) — 그다음 `DROP INDEX CONCURRENTLY IF EXISTS idx_schedule_next_run` 은 정상 실행되어
    옛 인덱스를 지운다. 최종 상태: Flyway 는 이 마이그레이션을 **성공으로 기록**하지만, 새
    인덱스는 영구히 INVALID(사용 불가)이고 옛 인덱스는 이미 삭제됐다 — 목록 쿼리는 이 PR 이
    없애려 한 seq-scan 기준선으로 돌아가고(측정된 20배 개선을 조용히 잃음), write 경로는
    쓸모없는 인덱스 유지비용을 영구히 진다. 어떤 로그·알림도 이 상태를 알리지 않는다 — 다음
    사람이 우연히 `pg_index.indisvalid` 를 확인하기 전까지는 "재실행 안전"이라는 주석만
    남는다. 이는 이 저장소 Rationale 관례가 이미 경고한 "문서한 보장이 구현보다 넓다" 패턴과
    같은 모양이다 — `IF NOT EXISTS`/`IF EXISTS` 는 **구문 재실행**(중복 이름 에러 방지)만
    보장하지, **의미론적 재실행**(실패한 빌드의 복구)은 보장하지 않는다.
  - 제안: 주석 표현을 "구문상 재실행해도 에러가 나지 않는다"로 좁히거나, 배포 런북에
    "V110 적용 후 `SELECT indisvalid FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid
    WHERE c.relname='idx_schedule_workspace_next_run'` 로 확인하고 `false` 면 수동
    `DROP INDEX CONCURRENTLY idx_schedule_workspace_next_run` 후 재실행" 단계를 추가한다.
    참고로 `schedule-trigger.e2e-spec.ts` 의 신규 테스트가 `indisvalid=true` 를 실제로
    단언하므로, 이 시나리오를 **e2e 실행 시점**에는 잡아낸다 — 다만 그 신호가 프로덕션
    배포 파이프라인까지 전파되는지는 이 PR 범위 밖이라 확인하지 못했다.

- **[INFO]** 인덱스 교체가 부팅 쿼리(Q2)의 향후 선택도 변화에 대한 완충을 제거함 — 문서로
  이미 인지·수용된 트레이드오프
  - 위치: `plan/in-progress/spec-draft-schedule-index.md` "### (a) DROP — 결론은 맞았지만
    근거가 틀렸다" 절, `codebase/backend/migrations/V110__schedule_workspace_next_run_index.sql:7-12`
  - 상세: 종전 부분 인덱스(`WHERE is_active = TRUE`)는 `ScheduleRunner.onModuleInit` 의
    `WHERE is_active = TRUE` 부팅 쿼리 술어를 함의했다 — 지금은 활성 비율 70%라 플래너가
    seq scan 을 택하지만, 활성 비율이 낮아지면 플래너가 그 인덱스로 전환할 수 있었다. V110 은
    이 완충을 제거한다. 이것은 실측되고 문서화된 의도적 트레이드오프(부팅 쿼리는 1회성이라
    영향이 작다는 근거 포함)이므로 결함으로 등급을 매기지 않는다 — 다른 리뷰어가 근거의
    타당성을 재확인할 수 있도록 참고용으로만 남긴다.

- **[INFO]** `review/consistency/2026/09/04/22_34_55/_target/spec-draft-schedule-index.md` 스냅샷이
  최종 커밋된 `plan/in-progress/spec-draft-schedule-index.md` 와 수치·frontmatter 가 다름(예:
  "31배" vs 최종 "20배", `started: 2026-09-05` vs 최종 `2026-09-04`)
  - 위치: `review/consistency/2026/09/04/22_34_55/_target/spec-draft-schedule-index.md:84`,
    `:4` — 대응 최종본은 `plan/in-progress/spec-draft-schedule-index.md:102`, `:4`
  - 상세: 이 저장소의 consistency-checker 관례상 `_target/` 은 검토 **시점**의 불변 스냅샷이라
    이후 편집으로 stale 해지는 것이 설계된 동작이다(append-only 감사 기록). 런타임 부작용은
    아니지만, 다음 사람이 이 스냅샷을 "현재 진실"로 오독할 여지가 있어 관측한 그대로 기록한다.
    side-effect 관점의 결함은 아니다 — 조치 불요.

## 요약

이번 변경 세트에서 실제 부작용 표면은 스케줄 인덱스 마이그레이션(V110) 하나다. `executeInTransaction=false`
스코프는 해당 마이그레이션 파일에만 정확히 국한되고, 데이터 변형(UPDATE/DELETE) 없이 순수 DDL이며,
`IF NOT EXISTS`/`IF EXISTS` 로 구문 수준 재실행 안전성은 갖춘다. 다만 CONCURRENTLY 빌드가 중단된 뒤
재실행되는 특정 실패 경로에서 INVALID 인덱스가 조용히 영구 잔존할 수 있는데, 마이그레이션 주석은 이
경우까지 "안전"하다고 과신하게 서술한다 — 데이터 손실이나 API/시그니처/인터페이스 변경은 없고 영향은
"의도한 성능 개선을 조용히 못 받는" 선에서 그치므로 WARNING 으로 판정한다. 그 외 함수 시그니처·전역
변수·환경 변수·네트워크 호출·이벤트/콜백 축에서는 부작용을 발견하지 못했다.

## 위험도

MEDIUM
