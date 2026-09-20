# Rationale 연속성 검토 — `spec/2-navigation/` (impl-done, diff-base=origin/main)

## 검토 범위 확인

- `spec/2-navigation/` 델타: 0개 파일 (이번 브랜치는 spec 을 변경하지 않았다).
- 구현 diff: `codebase/backend/src/modules/schedules/schedules.service.spec.ts` 1개 파일, 119 삽입/9 삭제. **테스트 파일만 변경되었고 프로덕션 코드(`schedules.service.ts` 등)는 diff 에 없다** (`git diff --stat origin/main...HEAD -- codebase/` 로 재확인).
- 변경 내용: `SchedulesService.update()` 의 cron/timezone 재계산 분기에 대한 단위 테스트 3건 추가(happy-path 2건 + "둘 다 안 바꾸면 재계산 안 함" 대조군 1건) + 공유 fixture 헬퍼 `scheduleRow()`. 로직 변경은 없다 (`plan/in-progress/sched-recalc-unit.md` 의 `spec_impact: none` 및 "비대상 — 서비스 로직 변경 없다" 명시와 일치).

## 관련 Rationale/본문 대조

- `spec/2-navigation/2-trigger-list.md` §2.3.1 필드 권한 매트릭스: `nextRunAt` — "스케줄 생성·수정 시와 각 실행 완료 직후 재계산" 으로 이미 명문화되어 있다. 추가된 테스트(cron 변경 시 재계산, timezone 변경 시 재계산, 둘 다 무변경이면 재계산 안 함)는 이 문장이 서술하는 "수정 시 재계산" 거동을 그대로 검증하는 것이며, 새 정책을 도입하지도 기존 정책을 뒤집지도 않는다.
- `spec/2-navigation/3-schedule.md` `## Rationale` 항목 3개(sort/order 미구현 표기 해제, Schedule 트리거 생성 경로 제한, 딥링크 소비 방향별 비대칭) 중 이번 diff 와 접점이 있는 항목은 없다. cron/timezone 재계산 조건(`dto.cronExpression || dto.timezone`) 자체에 대한 별도 Rationale 항목은 이 문서에 없으며, 테스트는 기존 코드 동작을 고정할 뿐 그 조건식을 바꾸지 않는다.
- 기각된 대안 재도입 여부: 해당 없음 — 테스트 추가는 설계 대안 선택이 아니다.
- 합의된 원칙 위반 여부: 해당 없음 — `plan/in-progress/sched-recalc-unit.md` 의 "비대상" 절이 서비스 로직 변경을 명시적으로 배제했고 diff 도 이를 지킨다.
- 무근거 결정 번복 여부: 없음 — 오히려 1라운드 리뷰(`review/code/2026/09/20/14_22_46` W1)가 지적한 "게이트 무력화(`|| true`) 뮤턴트 생존" 갭을 대조군 테스트로 메운 것으로, plan 체크리스트에 근거가 함께 기록되어 있다.
- 암묵적 가정 충돌 여부: 없음 — `computeNextRuns` 호출 인자(새 cron/기존 timezone, 또는 기존 cron/새 timezone)를 스파이로 검증하는 방식은 스펙이 명시한 "수정 시 재계산" invariant 를 우회하지 않고 오히려 더 정밀하게 고정한다.

## 발견사항

없음.

## 요약

이번 diff 는 `spec/2-navigation/` 을 전혀 변경하지 않았고, 유일한 코드 변경도 `schedules.service.spec.ts` 테스트 추가뿐으로 프로덕션 로직은 그대로다. 추가된 테스트는 `2-trigger-list.md` §2.3.1 이 이미 명문화한 "스케줄 수정 시 `nextRunAt` 재계산" 거동을 결정적으로 고정하는 것이며, `3-schedule.md` 의 기존 `## Rationale` 세 항목 중 어느 것과도 접점·충돌이 없다. 기각된 대안의 재도입, 합의 원칙 위반, 무근거 번복, invariant 우회 중 해당하는 사례를 찾지 못했다.

## 위험도

NONE
