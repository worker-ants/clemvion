# Cross-Spec 일관성 검토 — target: `spec/2-navigation/` (--impl-done)

## 검토 범위와 방법

`git -C <워킹트리> diff origin/main...HEAD --stat` 로 실측한 결과, 이번 변경의 `codebase/**` 델타는
**`codebase/backend/src/modules/schedules/schedules.service.spec.ts` 단 1개 파일 / 128줄**이며
전량 테스트 코드다 — production 코드(`schedules.service.ts`), API 계약, 데이터 모델, RBAC, spec
문서(`spec/2-navigation/**`) 는 이번 diff 에서 전혀 변경되지 않았다(`spec_impact: none`, 1라운드
검토와 동일).

추가된 테스트 3건 + 공유 헬퍼(`scheduleRow`)는 `SchedulesService.update()` 의 기존 재계산 게이트
(`dto.cronExpression || dto.timezone`, `schedules.service.ts:266`)를 그대로 관측하는 것으로,
`git -C <워킹트리> grep` 으로 해당 소스 라인을 직접 확인해 테스트 코드가 대상으로 하는 게이트 조건이
diff 이전부터 존재하던 production 로직과 일치함을 검증했다:

- `computeNextRuns(dto.cronExpression, timezone, 1)` 호출 형태(`schedules.service.ts:267`)가 새
  테스트의 `computeNextRuns` spy 기대값(`toHaveBeenCalledWith(cron, timezone, 1)`)과 부합.
- 세 번째 테스트(cron·timezone 모두 미변경 시 재계산 안 함)는 순수하게 기존 조건문의 "둘 다 거짓"
  분기를 커버할 뿐, 새 분기·새 조건을 도입하지 않는다.

1라운드 보고서(`review/consistency/2026/09/20/14_01_01/cross_spec.md`)가 이미 target 문서
(`1-workflow-list.md`/`2-trigger-list.md`/`3-schedule.md`)와 `1-data-model.md §2.9/§2.9.1`,
`data-flow/10-triggers.md §1.4/§3.2`, `5-system/1-auth.md §3.2`, `5-system/2-api-convention.md
§5.2/§5.4` 간 교차 참조를 대조해 모순 없음을 확인했고, 이번 델타는 그 교차 참조 대상 어디에도
새 식별자·새 계약·새 상태 전이를 추가하지 않으므로 그 결론은 그대로 유효하다.

## 발견사항

없음 — 이번 diff 는 기존 production 게이트를 관측하는 단위 테스트 추가뿐이며, 데이터 모델·API
계약·요구사항 ID·상태 전이·RBAC·계층 책임 중 어느 것도 새로 정의하거나 변경하지 않는다. 따라서
cross-spec 충돌이 발생할 표면 자체가 없다.

## 요약

target 범위(`spec/2-navigation/`)의 spec 델타는 0개 파일이고, 구현 diff 도 `schedules.service.spec.ts`
단일 테스트 파일(프로덕션 코드·API·데이터 모델·RBAC 무변경)에 그친다. 1라운드에서 확인된 target
문서와 데이터 모델·데이터 흐름·인증·API 규약 간 일치는 이번 델타로 영향받지 않으며, 새로 검토할
cross-spec 표면이 없다.

## 위험도

NONE
