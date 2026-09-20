# 테스트(Testing) 리뷰 — sched-recalc-unit (2라운드)

## 리뷰 대상 요약

이번 changeset 은 1라운드 리뷰(`review/code/2026/09/20/14_22_46`)의 WARNING 2건에 대한 조치 커밋
(`ae060b266`)까지 포함한 누적 diff다. 핵심 테스트 변경은
`codebase/backend/src/modules/schedules/schedules.service.spec.ts` — `SchedulesService.update()` 의
cron/timezone 재계산 게이트(`if (dto.cronExpression || dto.timezone)`)에 대한 **세 갈래 분기**
(cron 변경 / timezone 변경 / 둘 다 안 바꿈)를 각각 고정하는 단위 테스트. 나머지 파일
(`plan/in-progress/sched-recalc-unit.md`, `review/code/2026/09/20/14_22_46/**`,
`review/consistency/2026/09/20/14_01_01/**`)는 plan 문서·이전 리뷰/consistency 산출물이라 테스트
관점의 코드 리뷰 대상이 아니다.

## 검증 방법

- 실제 파일을 직접 열어 diff 게이트 숫자와 대조(`schedules.service.spec.ts` 384-527행,
  `schedules.service.ts` 226-296행) — 세 테스트의 mock 세팅·단언이 실제 `update()` 구현
  (259-270행)과 일치함을 확인.
- `npx jest src/modules/schedules/schedules.service.spec.ts` 재실행 → **30/30 통과**(1라운드 WARNING
  조치로 신설된 대조군 테스트 1건 포함, 회귀 없음).
- 1라운드 WARNING #1 이 "고쳤다"고 주장한 조치를 **직접 재현·검증**: 저장소 밖 scratch(`mktemp` 하위
  scratchpad)로 `schedules.service.ts` 를 `cp` 백업 → `if (dto.cronExpression || dto.timezone)` 을
  `if (true)` 로 뮤테이션 → 재실행 → 신설 대조군 테스트(`cron · timezone 을 안 바꾸면 재계산하지
  않는다`)가 **RED** 로 정확히 죽는 것을 확인(`Expected number of calls: 0, Received number of
  calls: 1`, 나머지 29건은 GREEN 유지 — 다른 테스트가 이 방향을 우연히 잡는 게 아니라 이 테스트
  하나가 정확히 이 표면을 담당함을 재확인). 이후 `cp` 로 원본 원복, `git status --short`/
  `git diff --stat` 로 잔여물 없음 확인(작업 도중 컴파운드 `cd && ... && git status` 명령이 worktree
  격리 훅에 통째로 막혀 `cp` 원복이 한 차례 누락됐던 것을 뒤이어 `git diff` 로 발견 → 별도 `cp` 로
  재원복. 최종 `git status --short` 는 세션 산출물 디렉터리 외 clean).
- `npx tsc --noEmit -p tsconfig.json` — `schedules.service.spec.ts` 관련 타입 에러 0건(파일 전역
  기존 미관련 에러만 잔존, 이번 diff 밖).

## 발견사항

- **[INFO]** 1라운드 WARNING #1(재계산 게이트를 통째로 무력화하는 뮤턴트가 검출되지 않던 갭)이
  실제로 닫혔음을 독립 재현으로 확인
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.spec.ts` — 신설
    `it('cron · timezone 을 안 바꾸면 재계산하지 않는다 — nextRunAt 이 그대로다', ...)`
    (게이트 502-527, RESOLUTION 이 지목한 커밋 `ae060b266`)
  - 상세: 위 "검증 방법"에 기술한 대로 `if (true)` 뮤턴트를 직접 재현해 RED 확인. RESOLUTION.md 의
    주장("`|| true` 로 재현해 RED 확인")이 사실과 일치한다. 또한 이 대조군 테스트는 `computeNextRuns`
    를 `mockReturnValue` 로 스텁하지 않고 스파이만 걸어(실제 구현 pass-through) "호출되지 않는다"만
    확인하므로, 정상 코드 경로에서는 스파이가 호출될 일이 없어 시간 의존적 flakiness 위험도 없다 —
    설계가 안전하다.
  - 제안: 없음(확인 목적).

- **[INFO]** 1라운드 WARNING #2(`scheduleRow()` 팩토리 미적용 중복)도 조치 확인
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.spec.ts:372-384`(팩토리 정의가
    방어 분기 테스트 **위**로 이동), `:400`(기존 방어 분기 테스트가 `scheduleRow()` 재사용),
    `:435`, `:470`, `:506`(신규 세 테스트 전부 재사용)
  - 상세: 팩토리 정의 하나로 4개 테스트(방어 분기·cron·timezone·no-change)가 공유한다. 리터럴
    중복 없음.
  - 제안: 없음(확인 목적).

- **[INFO]** 커버리지 갭 — cron **과** timezone 을 **동시에** 바꾸는 PATCH 는 여전히 테스트되지 않음
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.spec.ts` — `update` 관련 신규
    테스트 3건(게이트 433, 468, 502) 어디에도 `{ cronExpression, timezone }` 을 함께 담은 케이스가
    없음
  - 상세: `dto.cronExpression || dto.timezone` 의 MC/DC(각 항이 결과를 독립적으로 바꾸는지)는 현재
    세 테스트(참-거짓 / 거짓-참 / 거짓-거짓)로 이미 충족되므로 **커버리지 이론상 필수는 아니다.**
    다만 실사용 시나리오(사용자가 cron 과 timezone 을 같은 PATCH 에 함께 담는 경우)에서
    `computeNextRuns(schedule.cronExpression, schedule.timezone, 1)` 가 **갱신 후 두 값 모두**로
    호출되는지는 아직 어떤 테스트도 직접 보지 않는다. 이론적으로는 개별 두 테스트를 통과하는 어떤
    구현(예: cron 만 갱신 후 값 쓰고 timezone 은 갱신 전 값을 참조하는 순서 버그)도 두 값을 함께
    바꾸는 케이스에서만 드러날 수 있다.
  - 제안: 낮은 우선순위. `{ cronExpression: '...', timezone: '...' }` 를 함께 넣어 두 인자 모두
    갱신 후 값으로 호출됐는지 보는 테스트 1건을 추가하면 이 축이 완전히 닫힌다. 이번 diff 를 막을
    사유는 아님(1라운드가 이미 이 항목의 완료 기준을 "게이트의 세 분기"로 명시적으로 스코프
    했고, `plan/in-progress/sched-recalc-unit.md` 「비대상」 절에도 이 조합 케이스는 언급되지
    않는다 — 의도적 축소 스코프로 보인다).

- **[INFO]** `computeNextRuns` spy 캐스트 타입이 실제 3-인자 시그니처와 불일치(nullary 로 선언)
  — maintainability 리뷰가 이미 지적한 항목과 동일 지점이나, 테스트 신뢰성 관점에서 보강
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.spec.ts:441-444`(신설),
    `:476-479`(신설), `:414-417`(기존 방어 분기, 동일 패턴)
  - 상세: `jest.spyOn(service as unknown as { computeNextRuns: () => string[] }, 'computeNextRuns')`
    형태의 캐스트는 스파이 타입을 인자 없는 함수로 선언한다. `npx tsc --noEmit` 로 직접 확인한 결과
    이 파일에서 타입 에러가 발생하지 않는데, 이는 `unknown` 이중 캐스트가 구조적 타입 검사를 완전히
    우회하기 때문이다(Jest 의 `toHaveBeenCalledWith` 매처가 스파이의 선언된 매개변수 타입과 무관하게
    가변 인자를 허용). 실질적 위험은 낮다 — 실제 인자 개수·값 검증은 런타임 `toHaveBeenCalledWith`
    단언이 수행하고 있어 "무엇으로 불렸는지" 판별력 자체는 훼손되지 않는다. 다만 향후
    `computeNextRuns` 시그니처가 바뀌어도(예: 인자 순서 변경) 이 캐스트가 컴파일 타임에 아무 경고를
    주지 못한다.
  - 제안: 필수 아님. 공용 헬퍼로 추출할 때(maintainability INFO 제안과 동일 지점) 타입을
    `(cron: string, tz: string, count: number) => string[]` 로 맞추면 이 갭도 함께 닫힌다.

## 회귀 테스트 확인

`npx jest src/modules/schedules/schedules.service.spec.ts` — 30/30 통과(1라운드 이후 신설된 대조군
테스트 1건 포함). 뮤테이션 검증을 위해 일시적으로 `schedules.service.ts` 를 고쳤을 때를 제외하면
항상 GREEN.

## 뮤테이션 관련 저장소 상태

검증을 위해 `codebase/backend/src/modules/schedules/schedules.service.ts` 를 일시적으로
`if (true)` 로 고쳤고, 저장소 밖 scratch 백업(`cp`)에서 즉시 원복했다. 원복 과정에서 컴파운드
`cd <path> && cp ... && git status` 명령이 worktree 격리 훅에 의해 **통째로 거부**되어 `cp` 원복이
한 차례 누락된 적이 있었으나, 뒤이은 `git diff`/`git status` 로 뮤테이션이 아직 저장소에 남아있음을
스스로 발견해 별도 `cp` 명령으로 재원복했다. 최종 `git status --short` 는 이 리뷰 세션이 만든
`review/code/2026/09/20/14_42_10/` 외에 아무 변경도 없음을 보여준다(clean).

## 요약

1라운드 WARNING 2건(재계산 게이트 「둘 다 거짓」 분기 미검증, `scheduleRow()` 팩토리 미적용 중복)이
`ae060b266` 에서 실제로 고쳐졌음을 각각 독립 재현(전자는 `|| true` 뮤턴트를 직접 걸어 RED 확인,
후자는 팩토리 재사용 지점을 직접 대조)으로 확인했다. 신설 3테스트(cron 변경·timezone 변경·둘 다
안 바꿈)는 재계산 게이트의 MC/DC 를 충족하고, mock 은 "무엇으로 불렸는지"까지 단언해 갱신 전/후
값을 구분하지 못하는 거짓 통과를 막는다. `beforeEach` 가 매 테스트 새 모듈을 구성해 테스트 간
의존성도 없다. 남은 것은 전부 INFO 수준 — cron+timezone 동시 변경 케이스 미검증(이론상 필수는
아님, 의도적 스코프 축소로 보임)과 spy 타입 캐스트 부정확(런타임 판별력에는 영향 없음, 이미
maintainability 가 지적한 지점과 동일)뿐이다. Critical·Warning 없음, 회귀 없음(30/30).

## 위험도

NONE
