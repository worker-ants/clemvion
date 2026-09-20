# Plan 정합성 검토 — `spec/2-navigation/` (--impl-prep, sched-recalc-unit)

## 검토 대상 요약

이번 작업(`plan/in-progress/sched-recalc-unit.md`)은 `SchedulesService.update()` 의 cron/timezone
재계산 happy-path 에 결정적 단위 테스트 2건을 추가하는 것이 전부다 (`spec_impact: none`, 서비스
로직 변경 없음). `--impl-prep` scope 로 `spec/2-navigation/` 전체가 넘어와 이 folder 의 15개 spec
파일이 번들에 포함됐으나, 실제 변경 대상 코드(`schedules.service.ts`)는 그중 `3-schedule.md`
(`status: implemented`) 가 문다.

## 발견사항

이 plan 이 미해결 결정을 우회하거나, 해소되지 않은 선행 조건을 전제하거나, 후속 항목을
누락시키는 지점은 찾지 못했다.

- 이 plan 이 닫으려는 트래커 항목(`plan/in-progress/spec-draft-nullable-notation-followups.md`
  4933행 「cron 재계산 happy-path 의 결정적 단위 테스트가 없다」)은 이 plan 하나가 정확히 대상으로
  삼는 유일한 열린 항목이며, 같은 트래커의 다른 항목·다른 in-progress plan 어디에도
  `computeNextRuns`/`SchedulesService`/`schedules.service` 를 건드리는 항목이 없다(전수 grep,
  `sched-recalc-unit.md` 자신 제외).
- plan 이 전제하는 선행 사실(e2e 「D. PATCH cron」이 연말 ~2분 창에서 거짓 통과한다)의 근거
  `plan/complete/schedule-cron-flake.md` 는 이미 `plan/complete/` 로 봉인돼 있다 — 선행 조건 미해소
  없음.
- `3-schedule.md` 본문(§2.2 타임존, §4 API, Rationale)은 cron/timezone 변경 시 `nextRunAt` 재계산을
  이미 기정 동작으로 서술하고 있어(`2-trigger-list.md` §2.3.1 `nextRunAt` 행의 "스케줄 생성·수정
  시와 각 실행 완료 직후 재계산" 서술과도 정합), 이 plan 이 테스트만 추가하는 것과 어긋나지 않는다.
  `computeNextRuns` 가 빈 배열이면 `null` 이 되는 방어 분기(§2.9 관련 이력)도 이미 별도 planner 턴에서
  종결됐다(`spec-draft-nullable-notation-followups.md` 상단 "형제 plan 은 이미 종결됐다").
- `--impl-prep` 이 폴더 단위로만 scope 를 받아 `spec/2-navigation/` 전체를 끌어오면서, 이 작업과
  무관한 기존 WARNING/INFO 급 항목(예: 같은 트래커 4998행 — `1-workflow-list.md`/`2-trigger-list.md`
  응답 형태 미기재·완료된 `pending_plans` 참조 잔존)이 번들에 함께 실렸다. 이 항목들은 이미
  `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 트랙으로 등재돼 있고
  `plan/in-progress/harness-review-gate-followups.md` §O 가 "무관한 폴더가 끌려오는 것이 관례가
  됐다"고 이미 문서화한 harness 제약의 재현일 뿐이다 — 이번 developer 작업(테스트 전용, spec 변경
  없음)이 새로 만들거나 우회하는 결정이 아니므로 별도 finding 으로 세우지 않는다.

## 요약

`sched-recalc-unit.md` 는 `SchedulesService.update()` 의 이미 구현된 재계산 동작에 결정적 단위
테스트만 추가하는 범위 좁은 작업이며, `spec/2-navigation/` 의 어떤 미해결 결정과도 충돌하지 않고
전제한 선행 plan(`schedule-cron-flake.md`)도 이미 해소돼 있다. `--impl-prep` 폴더 scope 가 끌어온
무관한 기존 WARNING(응답 형태 미기재·stale pending_plans)은 별도 planner 트랙으로 이미 등재돼 있어
이번 plan 의 착수를 막을 사유가 아니다.

## 위험도

NONE
