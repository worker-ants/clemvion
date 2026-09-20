# Rationale 연속성 검토 — `sched-recalc-unit` (impl-prep, scope=spec/2-navigation/)

## 검토 범위와 방법

target 은 `spec/2-navigation/` 번들(주로 `1-workflow-list.md` · `2-trigger-list.md` · `3-schedule.md` 전문 + 나머지
15개 파일은 예산 초과로 절단)과 `spec/0-overview.md` · `spec/1-data-model.md` · `spec/3-workflow-editor/{0-canvas,2-edge}.md`
의 Rationale 발췌다. 이 impl-prep 이 보호하려는 실제 작업은 `plan/in-progress/sched-recalc-unit.md`(`SchedulesService.update()`
의 cron/timezone 재계산 happy-path 를 결정적 단위 테스트로 고정 — **서비스 로직 변경 없음, `spec_impact: none`**)이므로,
번들 전체에 대한 일반 스캔보다 이 작업이 건드리는 좁은 표면(스케줄 `nextRunAt` 재계산 의미론)에 초점을 맞췄다. 실제 코드
(`codebase/backend/src/modules/schedules/schedules.service.ts`, `schedules.service.spec.ts`)와 관련 spec
(`spec/data-flow/10-triggers.md §3.2`)도 함께 열어 대조했다.

## 발견사항

이 작업 범위(스케줄 재계산 단위 테스트 추가)에서 기각된 대안의 재도입, 합의 원칙 위반, 무근거 번복, invariant 우회에
해당하는 항목을 찾지 못했다. 오히려 다음 세 지점에서 **연속성이 강하게 확인된다** (문제가 아니라 근거로 기록):

- **`nextRunAt` 재계산 의미론과 일치** — `spec/2-navigation/3-schedule.md §2.3.1`(트리거 목록 표에 있는 것은 오기재 아님,
  실제로는 `2-trigger-list.md §2.3.1`)와 `spec/data-flow/10-triggers.md §3.2`는 "schedule 생성/수정 시(`computeNextRuns`)와
  process() 완료 직후 재계산, cron 파싱 실패 시 NULL" 이라고 명시한다. 실제 `schedules.service.ts:266-273`의
  `if (dto.cronExpression || dto.timezone) { computeNextRuns(schedule.cronExpression, schedule.timezone, 1) }` 은 이미
  이 서술과 정확히 일치하고, plan 이 검증하려는 것도 정확히 이 블록이다 — 새 설계를 들여오는 것이 아니라 기존 spec 문구를
  단위 테스트로 고정하는 작업이다.
- **직전 완료 작업(`plan/complete/schedule-cron-flake.md`)의 기각 이력과 정합** — 그 작업은 "PATCH 전후 `nextRunAt` **값이
  다른가**" 라는 비교 방식을 두 라운드에 걸쳐 명시적으로 폐기했다(연 1회 cron 이 겹치는 창, 그다음 생성-cron-값-창-밖 단언마저
  반증됨). 남은 잔여(연말 ~2분 거짓 통과 창)를 닫는 것이 바로 이번 `sched-recalc-unit` 작업이다. plan 의 접근(“무엇으로
  호출됐는지” + “그 결과가 대입됐는지”를 spy 로 본다, 실시각 비교를 하지 않는다)은 기각된 “값 비교” 패턴을 되풀이하지 않고
  그 반증을 정확히 반영한 설계다 — 번복이 아니라 그 기각을 완결하는 후속.
- **private 메서드 spy 패턴이 같은 파일에 선례** — `schedules.service.spec.ts:400-403`이 이미
  `jest.spyOn(service as unknown as {...}, 'computeNextRuns')` 로 같은 private 메서드를 스파이한다(“계산이 비면 null”
  방어 분기 테스트). plan 이 추가하려는 happy-path 두 케이스도 같은 스파이 기법을 재사용하므로 새 테스트 관행을 도입하는
  것이 아니다.

검토한 범위에서 이 작업과 직접 충돌하는 Rationale 항목, 또는 새 Rationale 없이 뒤집히는 과거 결정은 없었다.

참고(내 mandate 밖, 재-flag 방지용 기록): `plan/complete/schedule-cron-flake.md` 체크리스트는 그 작업 자신의
`--impl-prep spec/2-navigation/` 실행에서 나온 WARNING 1건(`NAV-WF-02` 요구사항 카탈로그 상태와 상세 spec의 "미구현"
서술 불일치)을 "이 작업과 무관한 기존 불일치"로 이미 트래커에 planner 항목으로 등재했다고 적고 있다. 이는 카탈로그-구현
상태 정합 이슈이지 Rationale 연속성 이슈가 아니며, 이미 별도 트랙으로 등재돼 있으므로 본 리포트에서 재기동하지 않는다.

## 요약

`sched-recalc-unit` 작업은 spec 변경이 없는(spec_impact: none) 순수 단위 테스트 추가이며, 검증 대상 로직·검증 방식
모두 기존 spec 서술(`2-navigation/3-schedule.md`, `data-flow/10-triggers.md §3.2`)과 직전 완료 작업이 남긴 기각 이력
(`schedule-cron-flake.md`)에 정확히 부합한다. Rationale 연속성 관점에서 차단 사유를 찾지 못했다.

## 위험도

NONE
