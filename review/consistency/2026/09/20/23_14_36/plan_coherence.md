# Plan 정합성 검토 — spec/2-navigation (--impl-done)

## 발견사항

- **[INFO]** 직전 --impl-prep 라운드(`21_43_47`)가 지적한 caveat 문제가 제안대로 정확히 처분됨
  - target 위치: `spec/2-navigation/2-trigger-list.md:318` — "동시 삭제: 두 클라이언트가 동시에 같은 트리거를 삭제하면 두 번째는 `404 RESOURCE_NOT_FOUND`"
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:4785-4796` (planner 항목 (a)(b) 묶음) · `plan/in-progress/trigger-dup-delete.md` (금번 대상)
  - 상세: `21_43_47` 라운드는 "§4.4 가 caveat 없이 단정하는데 코드가 아직 그렇지 않다" 를 INFO(LOW)로 지적하며, 종결 시 (b)를 "실측 완료 — caveat 불필요" 로 명시 처분하고 (a)는 별개로 남기라고 권고했다. 이번 diff(`triggers.service.ts` 락 안 재조회 + `NotFoundException` 분리, `trigger-delete-concurrency.e2e-spec.ts` 로 `[204,404]`·감사 1건 고정)로 §4.4 서술이 코드에서도 참이 됐고, 트래커 `4792-4796`은 정확히 권고된 형태로 (b)만 취소선 처리해 "2026-09-20 처분: caveat 불요"로 닫고 (a)는 "그대로 열려 있다"로 명시 분리했다. 두 plan·target 사이에 잔여 충돌이나 후속 누락이 없다.
  - 제안: 조치 불필요. 마무리 커밋에서 `trigger-dup-delete.md` 체크리스트 잔여 3항목(`/ai-review` 수렴 확인·`--impl-done` 통과·`plan/complete/` 이동)만 갱신하면 된다(코드 리뷰 `23_04_17` SUMMARY #10과 동일 지적).

- **[INFO]** 네 번째 삭제 경로(`SchedulesService.remove()`) 잔여 결함이 target 에 영향 없이 별도 항목으로 정확히 분리됨
  - target 위치: `spec/2-navigation/2-trigger-list.md` §4.3/§4.4 (schedule cascade 삭제 서술) · `spec/2-navigation/3-schedule.md` (스케줄 자체 삭제 서술 없음)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:4773-4783` (신규 developer 항목, `[ ]` 미해소)
  - 상세: `trigger-dup-delete.md` 는 원래 "네 자리 완결"로 과장했던 제목을 스스로 정정(`> 정정 (22_07_23 WARNING 2)`)하고, `SchedulesService.remove()` 자신의 스케줄 행 삭제(`schedules.service.ts:345`)가 락·재조회 밖에서 일어나 같은 형태의 감사 중복이 남을 수 있음을 트래커에 별도 미해소 항목으로 등재했다. target 문서(§4.3/§4.4)는 이 잔여를 사실로 서술하고 있지 않으므로(트리거 delete 경로만 서술) target-plan 불일치는 없다 — 이 PR 스코프(트리거·워크플로·워크스페이스 세 자리) 밖의 정직한 잔여 인정이다.
  - 제안: 조치 불필요. 후속 developer 세션에서 스케줄 축 advisory lock 필요 여부부터 실측하도록 이미 명시돼 있다.

## 요약

`plan/in-progress/trigger-dup-delete.md` 는 `TriggersService.remove()` 동시 DELETE 감사 중복을 고치는 developer plan 으로 `spec_impact: none` 을 유지하며 target(`spec/2-navigation`) 을 직접 건드리지 않는다. 직전 --impl-prep 라운드가 유일하게 지적했던 "§4.4 caveat 미비" 는 이번 diff 로 코드가 spec 서술(§4.4 "두 번째는 404")을 실제로 충족하게 되면서 해소됐고, 트래커(`spec-draft-nullable-notation-followups.md`)는 그 라운드가 권고한 그대로 (b)만 명시적으로 처분·취소선 처리하고 (a)(`1-workflow-list.md`/`data-flow/12-workspace.md` 서술 누락)는 별개 미해소로 정확히 분리해 두었다. 스코프 밖으로 남긴 네 번째 삭제 경로(`SchedulesService.remove()`)도 target 문서가 그 사실을 잘못 단정하지 않는 상태로 별도 미해소 항목에 정직하게 등재돼 있어, 미해결 결정과의 충돌·선행 plan 미해소·후속 항목 누락 어느 관점에서도 문제가 발견되지 않았다.

## 위험도
NONE
