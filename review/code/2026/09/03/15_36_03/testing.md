# 테스트(Testing) 리뷰

## 컨텍스트

이 diff(`entity-nullable-column-type-mismatch` 배치 1)는 이미 두 차례 리뷰 라운드
(`14_44_15`, `15_17_01`)를 거쳐 Critical 1건·Warning 5건이 조치된 결과물이다. 이번 라운드는
그 조치가 반영된 최종 상태에 대한 fresh review다. `git diff --stat origin/main...HEAD` 로
스코프가 프롬프트의 11개 소스 파일(+가드 2파일)과 정확히 일치함을 확인했고, 대상 5개 spec
파일을 직접 실행했다 — **120/120 PASS** (`auth.service.spec.ts` · `schedule-runner.service.spec.ts`
· `schedules.service.spec.ts` · `users-login-attempts.service.spec.ts` ·
`nullable-type-lie-cast.spec.ts`).

## 발견사항

- **[INFO]** `schedules.service.spec.ts` 신규 회귀 테스트가, 실제로는 도달 불가능한 전제를
  private 메서드 mock 으로 강제해 분기에 진입시킨다 — 테스트 자체의 회귀 방어력은 유효하지만
  docstring 이 서술하는 시나리오("다음 실행이 없으면")는 현재 구현상 실재할 수 없다
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.spec.ts:326` (테스트
    `'cron 이 바뀌고 다음 실행이 없으면 nextRunAt 을 null 로 명시 대입한다'`, mock 설정은
    `344-347`) / 대상 소스 `codebase/backend/src/modules/schedules/schedules.service.ts:236-241`
    (`update()`), `:340`(`computeNextRuns` 의 `safeCount`)
  - 상세: 테스트는 `jest.spyOn(service as unknown as { computeNextRuns: () => string[] }, 'computeNextRuns').mockReturnValue([])` 로 **private 메서드를 직접 spy** 해 `computeNextRuns` 가
    빈 배열을 반환하는 상황을 인위적으로 만든다. 그런데 실제 `computeNextRuns` 구현
    (`schedules.service.ts:340`)은 `const safeCount = Math.min(Math.max(count, 1), 20);` 로
    카운트를 **항상 1 이상으로 바닥을 고정**하고, `update()` 호출부(`:236-239`)는 `count=1` 로
    호출한다. 루프는 `safeCount` 회 반드시 돌며 매회 `interval.next().toISOString()` 을 push 한다
    — 파싱이 실패하면 (`catch` 에서) `BadRequestException` 을 **던지지, 빈 배열을 반환하지
    않는다.** 즉 "파싱은 성공했는데 다음 실행 시각이 없는" 상태는 현재 코드 경로상 만들어질 수
    없다. 직접 프로브로 확인했다: `cron-parser`(`^5.10.0`)는 구문상 불가능한 값(`0 0 30 2 *`,
    2월 30일)도 **파싱 단계에서 즉시 throw** 한다(`Invalid explicit day of month definition`) —
    "파싱 성공 + next() 없음" 경로가 없다. `Math.max(count, 1)` 이 하한을 고정하므로 `count=0`
    이하를 넘겨도 빈 배열은 안 나온다.

    즉 `schedule.nextRunAt = nextRun ? new Date(nextRun) : null;`(`:241`) 의 `: null` 분기는
    **현재 구현상 실제 호출 경로로는 도달 불가능한 방어 코드**이고, 신규 테스트는 그 방어 코드
    자체를 직접 mock 으로 열어서 검증한 것이다. 회귀 방지 목적(누군가 `null` 을 `undefined` 로
    되돌리면 잡아야 한다)은 여전히 **유효하게 달성된다** — mock 이 그 분기를 강제로 실행시키는
    한, 리터럴이 바뀌면 이 테스트는 그대로 RED 가 난다. 문제는 테스트 이름·docstring 이 "cron 이
    바뀌고 **다음 실행이 없으면**" 이라고 마치 실사용 시나리오처럼 서술하는데, 다음 사람이 이
    문구만 보고 "이 조건이 실제로 발생할 수 있다"고 오해할 여지가 있다는 점이다(형제 테스트인
    `schedule-runner.service.spec.ts:230` 의 "무효 cron" 테스트는 반대로 `cronExpression:
    'not-a-cron'` 이라는 **실제로 재현 가능한** 입력을 쓴다 — 같은 배치 안에서 한쪽은 실제
    입력으로, 다른 쪽은 private mock 으로 같은 클래스의 분기를 검증하는 비대칭이 있다).
  - 제안: 필수 수정은 아니다(회귀 탐지력은 정상). 다만 (a) 테스트 docstring/제목에 "현재
    `computeNextRuns` 구현상 실제로는 도달하지 않는 방어 분기 — private mock 으로 강제 실행"
    이라는 취지를 한 줄 덧붙이거나, (b) 이 분기가 정말 죽은 코드라면 유지보수성 관점에서
    `: null` 대신 타입 시그니처를 좁혀 분기 자체를 없애는 것도 고려할 만하다(이 리뷰의 범위는
    아니므로 후속 판단에 맡긴다).

- **[INFO]** `resetPassword` 성공 경로 신규 테스트가 `usersService.update` 의 **대상 id**
  인자는 단언하지 않는다
  - 위치: `codebase/backend/src/modules/auth/auth.service.spec.ts:940-950`
    (`usersService.update.mock.calls[0][1]` 만 추출 — `[0][0]`(id) 미검증)
  - 상세: 테스트 목적(“`null` 을 **명시** 대입하는지”) 자체는 정확히 검증되지만,
    `usersService.update` 가 올바른 사용자(`user-uuid`)를 대상으로 호출됐는지는 이 테스트에서
    확인하지 않는다. 코드가 엉뚱한 id 로 update 를 호출해도 이 테스트는 여전히 GREEN 이다.
    다른 곳(예: 기존 실패 경로 테스트들)이 id 검증을 이미 커버하고 있을 가능성이 있어 실질
    위험은 낮다.
  - 제안: 우선순위 낮음. 여유가 있으면 `expect(usersService.update.mock.calls[0][0]).toBe('user-uuid')` 한 줄 추가.

- **[INFO]** `resetLoginAttempts` 신규 테스트의 `expect('lockedUntil' in patch).toBe(true)` 가
  바로 위 `expect(patch.lockedUntil).toBeNull()` 대비 추가 정보를 주지 않는다
  - 위치: `codebase/backend/src/modules/users/users-login-attempts.service.spec.ts:139-142`
  - 상세: 객체 리터럴에서 키를 아예 생략하면 `patch.lockedUntil` 은 `undefined` 가 되어 바로 위
    `toBeNull()` 단언에서 이미 실패한다. 즉 `'lockedUntil' in patch` 는 `toBeNull()` 이 이미
    걸러내는 경우(키 생략, 값이 `undefined`)를 다시 확인하는 형태라 실질적으로 새 실패 케이스를
    추가로 잡지는 않는다. 해가 되지는 않으나 테스트 가독성 관점에서 의도가 한 줄 더 필요한
    이유를 설명하지 않으면 다음 사람이 "왜 굳이 이 줄이 따로 있지" 라고 물을 수 있다.
  - 제안: 조치 불요(부작용 없음). 다만 남기려면 이 줄이 잡는 추가 케이스가 무엇인지 인라인
    주석으로 명시하면 좋다.

## 이전 라운드에서 이미 등재·유예된 잔여 항목 (재확인만, 이번 라운드의 신규 발견 아님)

아래는 `14_44_15`/`15_17_01` 라운드 testing 리뷰에서 이미 지적되고 INFO 로 유예된 항목들로,
이번 diff 에도 그대로 남아 있음을 재확인했다. 새로 발견한 것이 아니므로 등급 판단에는 반영하지
않는다.

- `findCastOffenders` 가 offender 2개 이상 파일의 aggregation 을 직접 검증하는 테스트가 없다
  (`nullable-type-lie-cast.spec.ts` — "캐스트가 있는 파일을 offender 로 잡고" 테스트는 파일 1개씩만
  넣는다).
- `countNullAsUnknownAsCasts` 의 정규식이 단일 공백을 가정한다(`source-scan.ts`) — prettier 정규화로
  현재는 안전.
- `findUntypedNullableColumns` 의 `COLUMN_DECL` 정규식이 2단계 이상 중첩 괄호를 놓칠 수 있다
  (`nullable-type-lie-cast-guard.ts`) — 저장소 실측 46건 전수 대조에서는 안 걸림, 회귀 테스트 없음.

## 강점 (긍정 관측)

- 가드 spec(`nullable-type-lie-cast.spec.ts`)이 1R 의 W1(실제 프로덕션 소스 파일을
  `writeFileSync` 로 변형)을 `withFixture` 헬퍼(매 호출 `fs.mkdtempSync` + `finally` 에서
  `fs.rmSync(recursive, force)`)로 정확히 고쳐, 형제 가드(`masked-reject-callers-guard.ts`) 관례와
  일치한다 — 테스트 격리·저장소 안전성 모두 확보.
- W2~W4 로 추가된 5개 신규 테스트 전부 `toBeFalsy()` 대신 `toBeNull()` 을 쓰고, TypeORM
  `update()`/`repository.update()` 가 `undefined` 필드를 SET 절에서 생략한다는 실제 동작에 정확히
  근거해 그 이유를 인라인 주석으로 남긴다 — mock 과 실제 동작의 괴리가 없다.
  `auth.service.spec.ts` 의 무관 mock(`usersService.findByEmail`)은 1R→2R 사이에 실제로
  제거되어 있음을 diff 로 확인했다.
- 각 테스트/신규 함수가 "왜 필요한가"·"어느 리뷰 항목에서 나왔는가"를 docstring 에 남겨 추적성이
  좋다. `plan/in-progress/entity-nullable-column-type-mismatch.md` 도 `(d) Schedule.lastRunAt`,
  `(e) auth.service.spec.ts:58 의 lockedUntil 캐스트` 를 이름으로 등재해, 직전 라운드가 지적한
  "추적된다고 썼는데 추적처가 없다"(W1) 를 실제로 고쳤다.
- 5개 spec 파일 전체 `beforeEach` 가 매 테스트 새 `TestingModule`/mock 을 만들어 테스트 간
  상태 누수가 없다(직접 확인). `schedule-runner.service.spec.ts` 의 신규 테스트는 공유
  `baseSchedule` 객체를 직접 재사용하지 않고 `{ ...baseSchedule, cronExpression: 'not-a-cron' }`
  로 스프레드해, 같은 파일의 다른 (이 diff 밖) 테스트들이 `baseSchedule` 을 스프레드 없이
  공유하며 `process()` 가 그 객체의 `nextRunAt` 을 직접 mutate 하는 기존 패턴과 얽히지 않는다 —
  올바른 선택이다.

## 요약

새 코드 경로(캐스트 8건 제거·엔티티 타입 확장·회귀 가드 2파일)에 대한 테스트는 두 차례 리뷰를
거치며 성공 경로 부재·잠금 해제 인자 미검증·cron 실패 분기 미검증 등 실질적 커버리지 갭이 모두
메워졌고, 이번 라운드에서 5개 spec 파일 120개 테스트를 직접 실행해 전부 PASS 를 확인했다. 이번
라운드에서 새로 발견한 것은 기능적 결함이 아니라 정밀도 문제 하나다 — `schedules.service.spec.ts`
의 신규 회귀 테스트가 실제로는 `computeNextRuns` 구현상 도달 불가능한 전제(빈 배열 반환)를
private 메서드 mock 으로 강제해 검증하는데, 회귀 탐지력 자체는 정상이지만 테스트 이름이 서술하는
시나리오는 현실적으로 발생할 수 없다(직접 프로브로 확인). 나머지는 소소한 단언 완결성/가독성
관련 INFO 2건과, 이전 라운드에서 이미 유예 판단이 내려진 잔여 항목들(정규식 사각지대·다중
offender 미검증)의 재확인이다. 새로운 Critical/Warning 급 결함은 발견하지 못했다.

## 위험도

LOW
