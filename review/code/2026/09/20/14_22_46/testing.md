# 테스트(Testing) 리뷰 — sched-recalc-unit

## 리뷰 대상 요약

이번 diff 는 `SchedulesService.update()` 의 cron/timezone 재계산 happy-path 를 고정하는 단위 테스트 2건을
`codebase/backend/src/modules/schedules/schedules.service.spec.ts` 에 추가한 것(테스트 전용 변경, 서비스
로직 변경 0). 나머지 변경 파일(`plan/in-progress/sched-recalc-unit.md`, `review/consistency/2026/09/20/14_01_01/**`)은
plan 문서·consistency-check 산출물로 테스트 관점 리뷰 대상 코드가 아니므로 스코프에서 제외한다.

## 검증 방법

- `codebase/backend/src/modules/schedules/schedules.service.ts` 원문을 직접 읽어 `update()` 의 재계산 분기(`if
  (dto.cronExpression || dto.timezone) { ... }`, 약 266행)를 확인.
- 저장소 밖 scratch 디렉터리(`/private/tmp/.../scratchpad/mutant-backup/`)에 원본을 `cp` 로 백업한 뒤, 저장소 파일의
  해당 조건을 `if (true)` 로 뮤테이션하여 `schedules.service.spec.ts` 전체(29건, 새 테스트 2건 포함)를 재실행 →
  **29/29 GREEN**(회귀 무). 이후 백업본을 `cp` 로 원복, `git diff --stat`/`git status --short` 로 저장소가
  뮤테이션 이전 상태로 정확히 복귀했음을 확인(잔여물 없음).
- 새로 추가된 두 테스트만(`-t "update"`) 별도 실행, `src/modules/schedules/` 전체 스위트(49건) 재실행 — 모두 통과,
  기존 테스트에 대한 회귀 없음.

## 발견사항

- **[WARNING]** 재계산 조건 `dto.cronExpression || dto.timezone` 을 **통째로 무력화(항상 참)** 시키는 방향의
  뮤턴트가 unit·e2e 어느 쪽에서도 검출되지 않는다 (실측: 조건을 `if (true)` 로 바꿔도 스위트 전체 29/29 GREEN)
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.spec.ts` — `update` describe 전체
    (신규 테스트 두 개가 추가된 지점: `it('cron 을 바꾸면 새 cron 으로 다시 계산해 nextRunAt 에 넣는다', ...)`,
    `it('timezone 만 바꿔도 새 timezone 으로 다시 계산한다', ...)`). 프로덕션 코드 쪽 대상은
    `codebase/backend/src/modules/schedules/schedules.service.ts` `update()` 의
    `if (dto.cronExpression || dto.timezone) { ... }` 분기.
  - 상세: 이번에 추가된 plan(`plan/in-progress/sched-recalc-unit.md` §테스트)과 커밋(`75d6b5db3`)은 뮤턴트
    셋으로 판별력을 주장한다 — ① 재계산 블록 삭제(양쪽 RED), ② `dto.cronExpression || dto.timezone` →
    `dto.cronExpression`(timezone 항 제거, timezone 테스트만 RED), ③ 갱신 **전** cron 으로 호출(인자 단언으로
    RED). 이 셋은 "재계산이 **일어나야 할 때 일어나지 않는**" 방향만 커버한다. 그런데 반대 방향 — "재계산이
    **일어나지 않아야 할 때 일어나는**"(가드 자체가 사라져 매 PATCH 마다 무조건 재계산) — 은 어떤 테스트도
    보지 않는다. `computeNextRuns` 를 스파이/모크하는 테스트는 신규 2건과 기존 방어 분기 테스트(`[방어 분기]
    다음 실행 계산이 비면...`) 셋뿐인데, 셋 다 `dto.cronExpression` 또는 `dto.timezone` 을 채운 케이스만
    다룬다. `name` 만 바꾸는 기존 테스트(`감사 로깅 — update 는 schedule.updated 를 남긴다`, 585행 부근)는
    `computeNextRuns` 를 스파이하지 않고 `nextRunAt` 도 단언하지 않으므로, 가드가 사라져 이 경로에서도
    (실제 cron-parser 로) 재계산이 일어나도 감지하지 못한다. 실측으로 확인: `if (true)` 로 조건을 무력화한
    상태에서 스위트 전체 29건이 그대로 GREEN.
    이 갭은 이론적 트집이 아니다 — 가드가 사라지면 `name`/`isActive` 등 cron·timezone 과 무관한 PATCH 에서도
    `nextRunAt` 이 "지금 시각 기준 다음 실행"으로 매번 재설정된다. 이미 BullMQ 에 등록된 실행 예정 시각과
    엔티티의 `nextRunAt` 이 어긋나거나(등록 시점 vs 매 PATCH 마다 새로 계산된 시점), 목록 정렬·프리뷰 등이
    참조하는 값이 조용히 바뀔 수 있는 실사용 회귀 방향이다. e2e(`schedule-trigger.e2e-spec.ts` 「D. PATCH
    cron」)도 cron 을 바꾸는 케이스만 있어 이 방향을 못 닫는다.
  - 제안: `scheduleRow()` 헬퍼를 재사용해 "cron·timezone 을 건드리지 않는 PATCH(e.g. `{ name: 'S2' }` 또는
    `{ isActive: true }`)는 `computeNextRuns` 를 호출하지 않고 `nextRunAt` 도 원래 값을 유지한다"를 단언하는
    대조군 테스트를 하나 추가할 것을 권장. 이 항목의 plan 체크리스트가 "뮤턴트 셋 전부 RED" 라고 완료 처리했으므로,
    이 방향의 뮤턴트도 셋에 포함해 재확인하는 편이 안전하다(현재는 차단 사유 아님 — 방어선 자체는 프로덕션
    코드에 존재하고 현재 정확하지만, 그 사실을 고정하는 회귀 테스트가 비어 있다는 뜻).

## 그 외 관찰 (참고, 낮은 우선순위)

- 신규 두 테스트 모두 `computeNextRuns` 호출을 `toHaveBeenCalledWith(...)` 로만 확인하고 `toHaveBeenCalledTimes(1)`
  은 별도로 두지 않는다. 호출 지점이 `update()` 안에 하나뿐이라 실질적 위험은 낮지만, 미래에 재계산 로직이
  루프 등으로 바뀌어 여러 번 호출돼도 이 단언은 여전히 통과한다.
- `scheduleRow()` 헬퍼(427행)는 두 신규 테스트에만 쓰이고 그 앞의 기존 "[방어 분기]" 테스트(384행)는 여전히
  인라인 리터럴을 쓴다 — 셋이 거의 동일한 필드 집합이라 헬퍼로 통일할 여지가 있으나 스코프 밖(회귀 위험 없음,
  가독성 문제일 뿐).
- 나머지 diff(plan 문서, consistency-check 산출물)는 테스트 코드가 아니므로 이 관점의 검토 대상이 아니다.

## 회귀 테스트 확인

`npx jest src/modules/schedules/` 전체(3개 스위트, 49건) 및 `schedules.service.spec.ts` 단독(29건) 재실행 —
신규 테스트 포함 전부 통과, 기존 테스트에 대한 회귀 없음.

## 뮤테이션 관련 저장소 상태

뮤테이션 검증을 위해 `codebase/backend/src/modules/schedules/schedules.service.ts` 를 일시적으로 수정했으나,
저장소 밖 scratch 백업에서 `cp` 로 즉시 원복했다. 원복 후 `git status --short`/`git diff --stat` 로 저장소가
작업 시작 시점과 동일함을 확인(잔여 diff 없음, 미커밋 뮤턴트 없음).

## 요약

핵심 변경(cron/timezone 재계산 happy-path 단위 테스트 2건)은 mock 사용·격리·가독성 모두 이 리포지토리의 기존
관례(스파이로 "무엇으로 불렸는지" 확인, `beforeEach` 로 매 테스트 독립 모듈 재생성, docstring 으로 의도·과거
결함 이력 명시)를 잘 따르고 있고, plan 이 명시한 3종 뮤턴트(재계산 블록 삭제·조건에서 timezone 항 제거·갱신
전 cron 으로 호출)에 대해 실제로 판별력이 있음을 별도로 재확인했다. 다만 plan/커밋이 주장하는 "판별력"의
반대 방향 — 재계산 가드가 사라져 무관한 PATCH 에서도 항상 재계산되는 경우 — 는 실측(조건을 `if (true)` 로
뮤테이션 → 29/29 GREEN)으로 확인한 실질적 커버리지 갭이다. 대조군 테스트 하나만 추가하면 닫히는 좁은 갭이라
전체 작업의 완성도를 크게 해치지는 않지만, 이 작업 자체가 "e2e 가 못 닫는 구멍을 단위 테스트로 닫는다"는
목적으로 시작됐다는 점에서 같은 축의 반대 방향 구멍을 남긴 채 완료 체크가 된 것은 지적할 가치가 있다.

## 위험도

LOW
