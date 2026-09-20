# Cross-Spec 일관성 검토 — `spec/2-navigation` (impl-done)

## 검토 범위와 실측

- scope(`spec/2-navigation`) 델타: 0개 파일 (이 브랜치는 spec 을 바꾸지 않았다 — 정상).
- 구현 diff: `codebase/backend/src/modules/schedules/schedules.service.ts`(+52/-14) ·
  `schedules.service.spec.ts` · 신규 `codebase/backend/test/schedule-delete-concurrency.e2e-spec.ts`.
- 변경 내용: `SchedulesService.remove()` 의 동시 DELETE 처리를, 트리거 삭제(`m.delete(Trigger, triggerId)`)의
  `affected === 0` 명시 비교로 판정해 진 쪽을 404(`RESOURCE_NOT_FOUND`, message `'Schedule not found'`)로
  끝내도록 고쳤다. `triggerId` 가 없는 방어 분기는 `scheduleRepository.delete(...)` 의 `affected` 를
  판별자로 쓴다. 워크플로(#1369)·트리거(#1370)와 같은 결함 클래스의 스케줄 축 처리다.
- 대조: `spec/2-navigation/2-trigger-list.md` §3(동시 쓰기 직렬화) · §4.3(cascade 동작) · §4.4(결과·에러),
  `spec/2-navigation/3-schedule.md` §3(Trigger 자동 생성 규칙) · §4(API), `plan/in-progress/spec-draft-nullable-notation-followups.md`
  (해당 항목의 백로그 이력), `CHANGELOG.md` 신규 항목.

## 발견사항

- **[INFO]** `3-schedule.md §4` 에 "동시 삭제 → 두 번째는 404" 계약 서술이 없음 — 이미 추적 중인 기지 갭
  - target 위치: 구현 diff `schedules.service.ts` (`throwScheduleNotFound()` / `affected === 0` 판정), 신규 e2e `schedule-delete-concurrency.e2e-spec.ts`
  - 충돌 대상: `spec/2-navigation/3-schedule.md` §4 (`DELETE /api/schedules/:id` 행 — 에러/동시성 서술 없음). 자매 문서 `2-trigger-list.md` §4.4 는 동일 계약("두 클라이언트가 동시에 같은 트리거를 삭제하면 두 번째는 `404 RESOURCE_NOT_FOUND`")을 이미 명시하고 있어, 스케줄 축만 비대칭으로 미문서 상태다.
  - 상세: 이번 diff 로 스케줄 DELETE 의 동시성 동작이 트리거 축과 **동일한 계약**(락 진 쪽 404)으로 실제 정렬됐지만, `3-schedule.md` 본문에는 그 사실이 아직 반영되지 않았다. 다만 이는 새로 발견된 문제가 아니다 — `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 "`1-workflow-list.md` §2.6 · `data-flow/12-workspace.md` §1.10 · `3-schedule.md` §4 에 «동시 삭제 → 두 번째 404» 서술이 없다" 항목이 이미 이 갭을 planner 소유·낮은 우선순위로 등재했고(`--impl-prep review/consistency/2026/09/20/23_37_12` W2 에서 스케줄 축 추가), 세 라운드 연속 "비차단"으로 처분됐다. 본 diff 는 코드 쪽의 정렬을 한 단계 더 진행시켰을 뿐, 이 문서 갭을 새로 만들거나 악화시키지 않는다.
  - 제안: 별도 조치 불필요 — 기존 plan 항목 처분 방침(planner, 낮음)을 그대로 따른다. 위 plan 항목 처리 시 `3-schedule.md §4` 갱신에 이번 diff 의 코드 근거(스케줄 축 판별자가 트리거 `affected` 인 이유)도 함께 반영할 것.

- **[INFO]** 에러 코드/헬퍼 형태의 자매 일관성 — 이상 없음(참고용 기록)
  - target 위치: `schedules.service.ts` `throwScheduleNotFound()` (`code: 'RESOURCE_NOT_FOUND'`, `message: 'Schedule not found'`)
  - 충돌 대상: `codebase/backend/src/modules/triggers/triggers.service.ts` `throwTriggerNotFound()` (`code: 'RESOURCE_NOT_FOUND'`), `2-trigger-list.md` §4.4
  - 상세: 형태·코드가 자매 구현과 일치해 충돌 없음을 확인했다. CASCADE(`schedule.trigger_id → trigger`, `onDelete: 'CASCADE'`) 관계로 인해 스케줄 축의 판별자를 "스케줄 행" 이 아니라 "트리거 삭제의 `affected`" 로 잡은 것은, `2-trigger-list.md §4.3` 이 이미 문서화한 CASCADE 구조(트리거 삭제 시 schedule 도 2차 삭제)와 정확히 부합한다.
  - 제안: 없음(기록만).

## 요약

이번 diff 는 `spec/2-navigation` 문서 자체를 변경하지 않고, 트리거·워크플로·워크스페이스 삭제 동시성 결함 계열의 네 번째(스케줄) 자리를 코드로 닫았다. 새로 도입한 동작(락 진 쪽 404·감사 1건)은 이미 `2-trigger-list.md §4.3/§4.4` 가 문서화한 트리거 삭제 계약·CASCADE 구조와 정확히 일치하며, 데이터 모델·API 계약·요구사항 ID·RBAC·계층 책임 어느 관점에서도 다른 영역과 직접 모순되는 지점을 찾지 못했다. 유일하게 남는 것은 `3-schedule.md §4` 가 이 동시-삭제 계약을 아직 명시하지 않는 문서 비대칭인데, 이는 이번 diff 가 새로 만든 문제가 아니라 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 소유·낮은 우선순위로 등재되어 여러 라운드 비차단 처분된 기지 갭이다.

## 위험도

NONE
