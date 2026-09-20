# 요구사항(Requirement) 리뷰 — sched-recalc-unit (2라운드, 1라운드 RESOLUTION 검증)

## 검토 범위

- `codebase/backend/src/modules/schedules/schedules.service.spec.ts` — cron/timezone 재계산 happy-path 단위 테스트(2건) + 게이트의 "둘 다 거짓" 대조군 테스트(1건, 1라운드 조치) + `scheduleRow()` 팩토리 승격
- `plan/in-progress/sched-recalc-unit.md` — 신규 plan
- `review/code/2026/09/20/14_22_46/*` — 1라운드 SUMMARY/RESOLUTION 및 서브리뷰 산출물 (이번 라운드가 그 RESOLUTION 을 검증)
- `review/consistency/2026/09/20/14_01_01/*` — `--impl-prep` 산출물

`git diff origin/main --stat` 로 실제 스코프를 재확인: 프로덕션 코드 변경 0, `schedules.service.spec.ts` +128/-9, 나머지는 plan/review 산출물. 저장소 뮤테이션 없이 `Read`/`Bash`(git diff, grep)로만 검증했다 — `git status --short` 결과 `review/code/2026/09/20/14_42_10/`(이 세션 산출물) 외 변경 없음.

## 1라운드 WARNING 조치 검증 (RESOLUTION 대조)

- **W1 (게이트 무력화 뮤턴트 생존)**: `ae060b266` 이 세 번째 분기(cron·timezone 둘 다 미변경) 대조군 테스트를 추가했다. `git diff origin/main` 으로 실제 코드를 열어 확인 — `computeNextRuns` 를 `.mockReturnValue` 없이 `jest.spyOn` 만 걸고 `{ name: '이름만 바꾼다' }` PATCH 후 `expect(computeNextRuns).not.toHaveBeenCalled()` + `expect(saved[0].nextRunAt).toEqual(before)` 를 단언한다. `schedules.service.ts:266` 의 `if (dto.cronExpression || dto.timezone)` 게이트를 `if (true)` 로 무력화하면 이 대조군이 반드시 RED 가 된다(스파이가 실제 구현을 호출해 다른 시각을 계산하므로 두 단언 모두 깨짐) — 실측(RESOLUTION 기재: 뮤턴트 재현 RED 확인)과 논리적으로 일치. 해소로 판단.
- **W2 (중복 리터럴)**: 같은 커밋에서 `scheduleRow()` 팩토리를 방어 분기 테스트 위로 올리고, 그 테스트도 `scheduleRepo.findOne.mockResolvedValue(scheduleRow())` 로 교체했다(diff 확인). 정의가 하나로 수렴 — 해소로 판단.

두 조치 모두 코드가 실제로 반영됐고(diff 상 확인), TEST WORKFLOW(lint·unit·build·e2e 366) 재실행 결과가 RESOLUTION.md 에 기록돼 있다.

## Spec fidelity

관련 spec: `spec/data-flow/10-triggers.md` §1.4(Schedule↔Trigger 동기화 표) · §3.2(`schedule.next_run_at` 계산), `spec/2-navigation/3-schedule.md` §4(API).

- §1.4 표 행 "Schedule cron/timezone 변경 | UPDATE schedule + next_run_at 재계산 + `registerJob` 로 job scheduler upsert" — **cron/timezone 변경에 한정**해 재계산을 명시한다. 구현(`schedules.service.ts:266` `if (dto.cronExpression || dto.timezone)`)과 이번에 추가된 세 번째 대조군 테스트(이름만 바꾼 PATCH는 재계산 안 함)가 이 표 행과 line-level 로 일치 — 오히려 이번 대조군 테스트가 이 spec 행이 암시하는 "cron/timezone 외 변경은 재계산 안 함"을 처음으로 코드에 고정했다.
- §3.2 "cron 파싱이 실패하면 `next_run_at` 은 NULL 이다" — 기존 방어 분기 테스트(`[방어 분기] 다음 실행 계산이 비면 nextRunAt 을 null 로 명시 대입한다`)가 그대로 유지되며 이번 diff 로 로직 변경 없음. 일치.
- 신규 cron 변경 테스트: `computeNextRuns('30 7 * * *', 'Asia/Seoul', 1)` — dto 가 timezone 을 안 보내면 `schedule.timezone` 이 기존값(Asia/Seoul) 그대로 유지된 채 넘어간다. 실제 구현(`schedules.service.ts:259-271`, `dto.cronExpression` 만 대입 후 `schedule.cronExpression, schedule.timezone` 으로 호출)과 정확히 일치.
- 신규 timezone 변경 테스트도 대칭으로 일치.

spec 자체의 결함은 발견하지 못했고, 코드·테스트가 spec 표 행을 line-level 로 반영한다.

## 기능 완전성 / 엣지 케이스 / TODO

- TODO/FIXME/HACK/XXX 신규 도입 없음 (grep 결과 없음).
- cron·timezone 둘 다 동시에 바뀌는 PATCH 조합은 별도 단위 테스트가 없다 — 다만 plan 의 "할 것" 이 명시적으로 cron 단독·timezone 단독 두 가지만 범위로 잡았고(비대상 아님, 명시된 스코프 내), 구현 로직이 순차 대입(`if (dto.cronExpression) …; if (dto.timezone) …;`) 후 단일 `computeNextRuns` 호출이라 두 단독 테스트가 각 대입 분기를 이미 개별적으로 검증한다. 조합 케이스 부재는 낮은 위험의 커버리지 갭이나, 이번 라운드의 지적 대상(RESOLUTION 처리된 W1/W2)과 무관하고 새 결함도 아니다 — INFO 로만 기록.
- 반환값: `update()` 은 모든 경로(재계산 여부와 무관)에서 `saved`(Schedule)를 반환하며, 세 테스트 모두 `saved` 배열 캡처로 이를 검증한다. 누락된 반환 경로 없음.

## 기타 (이전 라운드 INFO, 재확인만)

- JSDoc 배치(419-426행이 팩토리 바로 위, 실제로는 그 아래 두 `it` 의 근거 설명)는 문서화/유지보수성 리뷰에서 이미 INFO 로 다뤘고 RESOLUTION 이 "팩토리를 위로 올리며 구조가 정리됐다"로 조치 없음 처리 — requirement 관점에서도 기능적 영향 없어 동의.
- `computeNextRuns` spy 캐스트가 nullary 로 선언돼 실제 3-인자 시그니처와 다르다는 지적(maintainability WARNING 아님, INFO)은 타입 부정확성일 뿐 테스트 동작에는 영향 없음 — requirement 관점에서 결함 아님.

## 발견사항

없음 — 이번 라운드(1라운드 RESOLUTION 반영분)에서 새로운 Critical/Warning 을 발견하지 못했다.

- **[INFO]** cron·timezone 동시 변경 조합의 전용 단위 테스트 부재
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.spec.ts` `update` describe 블록 (신규 두 happy-path 테스트, cron 단독 게이트 442-461행 / timezone 단독 468-495행)
  - 상세: 두 필드가 한 PATCH 에서 동시에 바뀌는 경우를 검증하는 테스트가 없다. 구현은 순차 필드 대입 후 단일 `computeNextRuns` 호출이라 개별 단독 테스트로 논리적 커버리지는 확보되지만, 회귀가 "동시 변경 시에만" 나타나는 형태(예: 두 번째 대입이 첫 번째를 덮어쓰는 실수)는 잡지 못한다.
  - 제안: 필수는 아님(plan 스코프 밖, 위험 낮음). 이 영역을 다시 만질 때 조합 케이스 1건 추가를 고려.

## 요약

1라운드 SUMMARY 의 WARNING 2건(게이트 "둘 다 거짓" 분기 미검증, `scheduleRow()` 미적용 중복)은 커밋 `ae060b266` 이 실제로 해소했음을 diff·RESOLUTION 대조로 확인했다. 세 신규/개편 테스트(cron 단독·timezone 단독·둘 다 아님)가 `dto.cronExpression || dto.timezone` 게이트의 세 분기 전부를 "무엇으로 불렸는지"까지 포함해 결정적으로 고정하며, `spec/data-flow/10-triggers.md` §1.4·§3.2 의 재계산 규칙과 line-level 로 일치한다. TODO/FIXME 없음, 모든 경로에서 반환값 검증됨, 새로운 Critical/Warning 없음. 유일한 잔여 갭(cron+timezone 동시 변경 미검증)은 이번 작업 스코프 밖이며 위험이 낮아 INFO 로만 남긴다.

## 위험도

NONE
