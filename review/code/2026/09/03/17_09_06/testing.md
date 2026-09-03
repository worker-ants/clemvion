# 테스트(Testing) 리뷰 — entity nullable 배치 2 (재검토, `17_09_06`)

## 스코프 요약

이번 diff(`origin/main...HEAD`)는 (1) 9개 TypeORM 엔티티 파일의 TS 필드 타입을 실제 DB
`nullable: true` 컬럼에 맞춰 `| null` 로 넓히는 30필드(컬럼 24·relation 6) 순수 타입 변경,
(2) 그 파급으로 제네릭 제약을 넓힌 `shared/utils/redact-stored-error.ts`/`.spec.ts`,
(3) 추적 plan 문서, (4) 직전 리뷰 라운드(`16_45_35`)의 산출물(SUMMARY/RESOLUTION 등, 커밋된
리뷰 아티팩트)로 구성된다. 런타임 로직 변경은 없다.

`redact-stored-error.spec.ts`는 직전 라운드 WARNING(주석이 반증된 전제를 그대로 서술 +
불필요해진 이중 캐스트)을 실제로 고쳤다 — 원문을 취소선으로 보존하고 정정 근거(`tsc` 재실측)를
병기했으며, `{ [column]: absent } as unknown as Record<string, unknown>` 캐스트를 제거했다.
직접 재실행해 확인했다: `npx jest redact-stored-error.spec.ts nullable-type-lie-cast.spec.ts`
→ **46/46 PASS**(34+12, RESOLUTION.md 주장과 일치).

## 발견사항

- **[WARNING]** `Schedule.lastRunAt` 을 이번 diff 가 `Date | null` 로 넓혔는데, 같은 필드를 쓰는
  기존 스펙 파일의 이중 캐스트(`null as unknown as Date`)가 정리되지 않고 남아 있다.
  - 위치: `codebase/backend/src/modules/schedules/schedule-runner.service.spec.ts:83`,
    `:211` (둘 다 `const schedule: Schedule = {...}` / `const baseSchedule: Schedule = {...}`
    — `Partial<Schedule>` 이 아니라 완전한 `Schedule` 리터럴). 이 파일은 이번 diff 에 포함되지
    않아 프롬프트에 게이트가 없다 — `Read`/`Grep` 으로 직접 연 실제 소스 라인 번호.
  - 상세: `schedule.entity.ts`(리뷰 대상 파일 6, 이번 diff)가 `lastRunAt: Date` → `Date | null`
    로 넓혔다. 이 스펙 파일은 **같은 fixture 객체 안에서** `nextRunAt` 필드는 이미 캐스트 없이
    `null` 을 직접 대입할 수 있게 돼 있고(211행 바로 위 `nextRunAt: new Date()`), 인접 주석
    (`:224-229`)은 *"2026-09-03 에 그 필드 타입을 `Date | null` 로 넓히며 이 대입에서
    `null as unknown as Date` 캐스트를 걷어냈다"* 고 `nextRunAt` 에 대해서만 명시한다 — 바로
    옆 `lastRunAt` 은 같은 배치가 같은 방식으로 넓혔는데 캐스트가 그대로 남았다. **실측**:
    두 줄을 `lastRunAt: null,` 로 바꾸고(원본은 scratch 로 백업) `npx tsc --noEmit -p
    tsconfig.json` 재실행 — 이 파일 관련 오류 **0건**. 직후 `cp` 로 원복하고
    `git status --short` clean 확인. plan 문서(`entity-nullable-column-type-mismatch.md`)의
    "배치 3 후보 (e)" 항목은 `auth.service.spec.ts:58` 의 `User.lockedUntil`(배치 1 필드)만
    추적하고 있고, 배치 2 가 방금 넓힌 `Schedule.lastRunAt` 은 어디에도 언급되지 않는다 —
    이번 라운드 이전에 발견되지 않은 갭이다.
  - 제안: `lastRunAt: null as unknown as Date,` → `lastRunAt: null,` 로 단순화. `nextRunAt`
    처럼 "명시적 null 대입" 분기 테스트가 필요한지도 확인 — 단, `schedule-runner.service.ts`
    를 보면 `schedule.lastRunAt = now;` 만 있고 `null` 을 명시 대입하는 분기는 없어(항상
    구체 `Date`) `nextRunAt` 급의 회귀 위험(TypeORM `update()` 가 `undefined` 를 SET 절에서
    생략)은 없다 — 캐스트 정리만으로 충분.

- **[WARNING]** `Trigger.lastTriggeredAt` 도 이번 diff 가 `Date | null` 로 넓혔는데, 동일 클래스의
  이중 캐스트가 다른 스펙 파일에 남아 있다.
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.spec.ts:149`
    (`const activeTrigger: Trigger = {...}` — 완전한 `Trigger` 리터럴). 이번 diff 에 포함되지
    않은 파일이라 게이트 없음 — `Read` 로 직접 연 실제 소스 라인 번호.
  - 상세: `trigger.entity.ts`(리뷰 대상 파일 7, 이번 diff)가 `lastTriggeredAt: Date` →
    `Date | null` 로 넓혔다. **실측**: `lastTriggeredAt: null as unknown as Date,` 를
    `lastTriggeredAt: null,` 로 바꾸고(scratch 백업 후) `tsc --noEmit` 재실행 — 이 파일 관련
    오류 **0건**. `cp` 로 즉시 원복, `git status --short` clean 확인. `hooks.service.ts` 의
    실제 대입 지점(`trigger.lastTriggeredAt = new Date();`, 2곳)도 항상 구체 `Date` 만
    대입하므로 "누락 분기 테스트" 위험은 없음 — 캐스트 자체만 불필요.
  - 제안: 캐스트 제거. 위 두 파일(schedule-runner·hooks) 모두 이 diff 의 회귀는 아니지만,
    "타입이 이제 정직해졌는데 그것을 실증하는 자리(테스트 fixture)가 여전히 옛 타입 거짓말을
    캐스트로 우회하고 있다" — 이 PR 시리즈가 반복적으로 잡아 온 바로 그 패턴이며, 프로덕션
    코드를 스캔하는 `nullable-type-lie-cast.spec.ts` 가드는 `.spec.ts` 를 명시적으로 제외해
    (가드 자체 코멘트: "자기 자신은 스캔 대상이 아니다 — spec 은 제외된다") 이 두 자리를
    구조적으로 못 본다 — 회귀 가드의 사각지대다.

## 위 외 관점별 소견

1. **테스트 존재 여부** — 순수 타입 확장(런타임 무변화)이라 신규 유닛 테스트 추가는 불요하다는
   판단은 타당하다. 구조적 가드(`nullable-type-lie-cast.spec.ts`)가 프로덕션 소스의 같은
   결함 클래스(캐스트·`type:` 누락)를 자동 재검증한다.
2. **커버리지 갭** — 위 WARNING 2건이 실질 갭이다. 그 외에 `execution.entity.ts`/
   `node.entity.ts`/`node-execution.entity.ts`/`notification.entity.ts`/`user.entity.ts`/
   `workflow.entity.ts`/`knowledge-base.entity.ts` 가 넓힌 나머지 필드에 대해서는
   `null as unknown as`/`as unknown as` 패턴을 전체 `*.spec.ts` 에 대해 grep 전수 대조했으나
   추가 인스턴스는 없었다(위 두 건 + 이미 추적된 `auth.service.spec.ts:58` 뿐).
3. **엣지 케이스 테스트** — `redact-stored-error.spec.ts` 는 `null`/`undefined` 두 부재 형태를
   `inputData`/`outputData`/`error` 세 컬럼 각각에 대해 `describe.each`×`it.each` 로 교차
   검증해 충실하다(확인 완료, 34/34 PASS).
4. **Mock 적절성** — 가드 테스트는 실제 소스 스캔(대조군)과 `mkdtempSync` 합성 fixture(단위
   동작 검증)를 분리한다. `finally` 에서 `rmSync` 로 정리해 격리도 지킨다. 적절하다.
5. **테스트 격리** — 가드 스펙의 임시 디렉터리 fixture 는 독립 실행 가능. 문제 없음.
6. **테스트 가독성** — 두 스펙 파일(`redact-stored-error.spec.ts`) 은 정정 근거를 취소선+날짜+
   실측으로 명시해 모범적이다. 반면 위 WARNING 두 건의 캐스트는 옆줄(`nextRunAt`)이 이미
   캐스트 없이 쓰이는데 자신만 옛 형태로 남아 있어, 다음 독자가 "이 필드는 아직도 non-null
   이라 우회가 필요하다" 고 오독할 소지가 있다 — 정확히 이전 라운드 W4 와 같은 패턴.
7. **회귀 테스트** — `npx jest redact-stored-error.spec.ts nullable-type-lie-cast.spec.ts` 를
   직접 재실행해 **46/46 PASS** 확인. 기존 테스트는 diff 반영 후에도 유효하다.
8. **테스트 용이성** — 엔티티 타입이 실제 nullable 상태를 반영하게 되면서 캐스트 없이 `null`
   을 직접 대입할 수 있게 됐다(실측: 두 파일 모두 캐스트 제거 후 `tsc` 오류 0). 다만 그 개선을
   실제로 누리도록 기존 fixture 를 갱신하는 작업이 이번 diff 범위에서 누락됐다.

## 뮤테이션 검증 위생

`schedule-runner.service.spec.ts`·`hooks.service.spec.ts` 두 파일을 각각 scratch(`cp`)로
백업한 뒤 캐스트를 제거해 `tsc --noEmit` 으로 재현했고, 확인 직후 `cp` 로 즉시 원복했다.
`git status --short` 로 잔여 변경 없음을 확인했다(저장소 트리에 남은 뮤테이션 없음).

## 요약

배치 2는 런타임 로직을 바꾸지 않는 TS 타입 정합화이며, 직전 라운드 WARNING(낡은 주석 +
불필요 캐스트)은 실제로 정정됐고 재실행으로 확인했다(46/46 PASS). 다만 이번 diff 가 넓힌
`Schedule.lastRunAt`·`Trigger.lastTriggeredAt` 두 필드에 대해, **같은 클래스의 잔존 이중
캐스트**가 각각 `schedule-runner.service.spec.ts`(2곳)·`hooks.service.spec.ts`(1곳)에 남아
있다 — `tsc` 재실측으로 이제 불필요함을 확인했다. 두 자리 모두 `.spec.ts` 라서 이 PR 시리즈의
회귀 가드(`nullable-type-lie-cast.spec.ts`, 프로덕션 소스만 스캔)가 구조적으로 못 보는
사각지대이며, plan 문서가 추적 중인 "배치 3 후보 (e)"(`User.lockedUntil`, 배치 1 필드)와
같은 성격이지만 배치 2 필드에 대해서는 아직 어디에도 기록되지 않았다. 기능 결함은 아니고
(테스트는 여전히 통과), 다음 독자를 오도할 수 있는 테스트 부채다.

## 위험도

LOW
