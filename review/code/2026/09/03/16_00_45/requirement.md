# Requirement Review — `entity-nullable-column-type-mismatch` 배치 1 (누적 diff, 4R)

## 배경 및 검증 방법

이 diff 는 `plan/in-progress/entity-nullable-column-type-mismatch.md` 가 선언한 "배치 1"
(엔티티 컬럼 `nullable: true` 인데 TS 필드가 non-null 이라 강제되던 `null as unknown as X`
이중 캐스트 8건 제거 + 필드 타입 `T | null` 확장) 과, 그 배치를 검토한 세 차례 선행 리뷰
라운드(`14_44_15`→CRITICAL 1건, `15_17_01`→WARNING 1건, `15_36_03`→수렴)의 fix 커밋
(`7ce4fa92a`·`40fa58b8f`·`52ca3128a`·`e78b6dbad`)까지 포함한 누적 상태다. 실질 코드/plan 변경은
15개 파일(`git diff --stat origin/main...HEAD` 로 재확인, 672+/27-)이고 나머지는 이전 라운드
리뷰 산출물이다.

독립적으로 재검증했다(저장소 뮤테이션 없음, 전부 읽기 전용):

- `npx jest` 로 관련 5개 spec(`nullable-type-lie-cast.spec.ts`·`auth.service.spec.ts`·
  `users-login-attempts.service.spec.ts`·`schedule-runner.service.spec.ts`·
  `schedules.service.spec.ts`) 직접 실행 — **5 suites / 120 tests 전부 PASS**.
- `grep -rn "null as unknown as" codebase/backend/src --include='*.ts' | grep -v '\.spec\.ts:'`
  — 실제 캐스트 **0건**(주석·정규식 리터럴만 매치), "8건 전부 제거" 주장과 일치.
- `npx tsc --noEmit` 전체 실행 후 에러 파일 집합을 `scripts/backend-typecheck-baseline.json`
  (37개 `*.spec.ts`) 과 집합 비교 — **baseline 밖 신규 에러 0건**. "타입 오류 0건 증가" 주장을
  직접 재현했다(문서를 믿지 않고 다시 쟀다).
- `spec/1-data-model.md` §2.2(User)·§2.9(Schedule) 를 `Read` 로 직접 대조(아래 발견사항 참고).

## 발견사항

- **[SPEC-DRIFT]** `Schedule.nextRunAt` 을 `Date | null` 로 넓힌 코드가 `spec/1-data-model.md §2.9`
  의 필드 타입 표기와 어긋난다 — **코드가 맞고 spec 이 낡았다**
  - 위치: `codebase/backend/src/modules/schedules/entities/schedule.entity.ts:41-42`
    (`@Column({ name: 'next_run_at', type: 'timestamptz', nullable: true }) nextRunAt: Date | null;`)
    vs `spec/1-data-model.md:260` (`| next_run_at | Timestamp | 다음 실행 예정 시각 |`)
  - 상세: DB 컬럼은 `V001__initial_schema.sql:168` 에서 애초부터 `next_run_at TIMESTAMPTZ`
    (제약 없음 = nullable) 이었고, `schedule-runner.service.ts:189-190`(cron 파싱 실패 catch)와
    `schedules.service.ts:241`(재계산 결과가 비면) 양쪽 다 실제로 `null` 을 대입하는 분기가
    이미 있었다. 이번 배치가 그 대입에 걸려 있던 이중 캐스트를 걷어내고 필드 타입을 `Date | null`
    로 정직하게 넓히면서, **DB·런타임 동작과 코드 타입이 이제 일치**했다. 반면 spec 표는 바로
    옆 `last_run_at` 은 `Timestamp?`(nullable 표기)로 정확히 적어 두고도 `next_run_at` 만
    `Timestamp`(non-null)로 남아 있다 — spec 자신의 nullable 표기 관례(`?`)를 이 한 줄만 어기고
    있다. 즉 이 diff 이전부터 있던 spec 오류이며, 이번 코드 변경이 그 간극을 "타입 레벨"에서
    드러냈을 뿐 새로 만든 불일치가 아니다.
  - 이미 위임됨: `plan/in-progress/entity-nullable-column-type-mismatch.md:151-158` 이 이 정확한
    문장(§2.9 `:260`)을 인용하며 "**developer 권한 밖**이다 — 내가 쓴 문장이 아니라 자기-반증형
    소정정 예외에 해당하지 않는다"고 명시적으로 planner 턴에 위임해 뒀다(CLAUDE.md 의
    자기-반증형 소정정 5조건 중 조건 1 미충족 — developer 가 그 spec 문장을 쓴 당사자가 아니다).
    `spec/data-flow/10-triggers.md §3.2` 에 "cron 파싱 실패 시 next_run_at 은 NULL" 한 줄
    보강도 같은 항목에 곁들여 위임돼 있다.
  - 제안: 코드는 그대로 유지(맞다). `spec/1-data-model.md:260` 을 `next_run_at | Timestamp?` 로
    정정하는 것은 `project-planner` 의 다음 spec 턴에서 처리 — 본 reviewer 는 spec 을 직접
    고치지 않는다.

- **[INFO]** `SchedulesService.create()` 의 동형 분기가 `undefined` 를 쓰고, 이번에 고친
  `update()` 는 `null` 을 쓴다 — 같은 배치의 자매 코드인데 표기가 갈린다(단, 이번 diff 가
  건드리지 않은 pre-existing 코드)
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:179-187`
    (`nextRunAt: nextRun ? new Date(nextRun) : undefined,`) vs `:241`
    (`schedule.nextRunAt = nextRun ? new Date(nextRun) : null;`, 이번 diff 가 캐스트를 걷어낸 자리)
  - 상세: `create()` 는 `repository.create()+save()` (INSERT) 경로라 `undefined` 필드는 컬럼을
    생략해 DB `DEFAULT`(이 컬럼은 마이그레이션에 `DEFAULT` 가 없어 결과적으로 `NULL`)를 그대로
    쓰게 되므로, 오늘 기준으로는 `null` 과 결과가 동일해 **버그는 아니다**. 다만 두 메서드가 같은
    "다음 실행 계산이 비면" 상황을 다른 리터럴(`undefined` vs `null`)로 표현하는 것 자체는
    `resetLoginAttempts`/`verifyEmail`/`resetPassword` 등 이번 배치가 도처에서 강조한 "TypeORM
    `update()` 는 `undefined` 를 SET 절에서 생략하므로 `null` 을 **명시**해야 한다"는 규칙과
    표면적으로 어긋나 보인다(실제로는 `create` 경로라 규칙이 적용되는 대상이 아니라서 무해함).
    `computeNextRuns()` 가 `Math.max(count,1)` 로 하한을 고정하고 실패 시 throw 해 두 분기 다
    현재는 도달 불가능한 방어 코드라(3R RESOLUTION 이 이미 이 사실을 실측·확인), 실사용 경로에
    영향은 없다.
  - 제안: 조치 불요(이번 diff 범위 밖, 현재 무해). 다음에 이 파일의 `create()` 를 만질 일이
    생기면 `null` 로 통일해 두 메서드의 "빈 다음 실행" 표현을 맞추는 편이 다음 사람의 혼동을
    줄인다.

- **[INFO]** `Schedule.lastRunAt` 은 `nullable: true` 인데 여전히 `Date`(non-null) 타입 — 같은
  파일의 `nextRunAt` 만 이번 배치에서 넓혀져 비대칭이 남았다
  - 위치: `codebase/backend/src/modules/schedules/entities/schedule.entity.ts:44-45`
  - 상세: `spec/1-data-model.md:261` 은 이 필드를 `Timestamp?`(nullable)로 정확히 표기하고
    있어, 여기서는 **spec 이 맞고 코드가 아직 안 따라간** 반대 방향이다. `plan/in-progress/
    entity-nullable-column-type-mismatch.md:167-168` 이 이 필드를 "배치 2 후보 (d)" 로 이미
    이름을 등재해 뒀고(2R 리뷰가 "추적된다고만 쓰고 실제로 등재 안 했다"를 지적해 3R 에서
    정정된 이력), 이번 배치의 기준("이중 캐스트가 실제로 강제되는 필드만")에는 `lastRunAt` 이
    코드상 `null` 대입 지점이 없어(항상 `new Date()` 만 대입) 해당하지 않으므로, 이번 diff 범위
    밖에 남긴 것 자체는 스코프 이탈이 아니라 선언된 경계다.
  - 제안: 조치 불요(plan 이 이름으로 추적 중). 배치 2 착수 시 처리.

- **[INFO]** TODO/FIXME/HACK/XXX 계열 미완성 마커는 이번 diff 전체에서 **0건** (`git diff`
  전수 grep 확인)
  - 상세: 신규 함수(`countNullAsUnknownAsCasts`/`findUntypedNullableColumns`/
    `collectScanTargets` 등)와 신규 테스트 전부 완결된 구현이며, plan 문서의 미해결 항목은
    체크박스 미완료(`[ ]`)로 명시적으로 추적되지 별도 코드 주석 TODO 로 흩어져 있지 않다.

## 기능 완전성 · 엣지 케이스 · 반환값 재확인

- `countNullAsUnknownAsCasts`/`hasNullAsUnknownAsCast`(source-scan.ts) — 정규식 `\bnull as
  unknown as\b` 가 주석(블록·줄) 은 `stripComments` 로 먼저 제거하고 세므로 "주석 속 언급은
  카운트에서 제외" 라는 docstring 의도와 실제 동작이 일치한다. `[대조군]` 테스트가 4가지
  경계(캐스트 있음/없음, 블록 주석, 인라인 뒤 주석)를 전부 실행해 통과시킨다(직접 재실행 확인).
- `findUntypedNullableColumns` — 관계 컬럼 예외(`@JoinColumn` 컬럼명 일치)가 "허용목록"이
  아니라 "컬럼명 일치" 로 구현돼 있고, `[예외 경계]` 테스트가 **양방향**(일치→면제, 불일치→
  미면제)을 검증한다 — 한쪽만 확인하는 흔한 결함 클래스를 피했다.
- `resetPassword`/`verifyEmail`/`resetLoginAttempts`/schedule 재계산 신규 테스트 5건 —
  전부 `toBeNull()` 을 쓰고 `toBeFalsy()` 를 피한다는 주석이 코드에 명시돼 있으며, 실제로
  `toBeFalsy()` 로 치환하면 `undefined` 회귀를 통과시킨다는 뮤테이션 근거가 RESOLUTION 에
  기록돼 있다(직접 뮤테이션을 재실행하진 않았으나 표현식 자체가 `toBeNull` 이므로 정적으로도
  맞다 — `Read` 로 재확인).
- `user.entity.ts` 7필드 + `schedule.entity.ts` 1필드 = 8필드 전부 실제 diff 와 일치, `type:`
  누락 4건(`passwordHash`·`twoFactorSecret`·`emailVerifyToken`·`passwordResetToken`)도 전부
  `type: 'varchar'` 로 채워져 있음을 `Read` 로 직접 확인 — 1R CRITICAL(부팅 실패)이 실제로
  해소된 상태.

## 요약

`entity-nullable-column-type-mismatch` 배치 1(+ 3라운드 fix)의 최종 상태를 독립적으로
재검증한 결과, 기능 완전성·에러 시나리오·데이터 유효성·반환값 관점에서 새로운 CRITICAL/WARNING
급 결함은 발견하지 못했다. `null as unknown as X` 캐스트는 실제로 0건 남았고, `tsc` 신규 에러도
0건(baseline 과 정확히 일치하는 37개 파일만 에러), 관련 spec 5개 120개 테스트가 전부 통과한다.
spec 대조에서 `User` 필드 7건은 애초부터 `spec/1-data-model.md` 가 nullable(`?`)로 정확히
표기하고 있었으므로 이번 타입 확장이 spec 을 오히려 **더 정확히 따르게** 만들었다. 유일한 실질
발견은 `[SPEC-DRIFT]` 1건 — `Schedule.next_run_at` 이 DB·런타임상 nullable 인데 spec §2.9 표만
non-null(`Timestamp`)로 남아 있는 선재 오류이며, developer 가 쓴 문장이 아니라 자기-반증형
소정정 예외에 해당하지 않아 planner 턴으로 올바르게 위임돼 있다(plan 문서에 이름·위치까지
등재 확인). `Schedule.lastRunAt` 비대칭과 `create()`/`update()` 의 `undefined`/`null` 표기
불일치는 둘 다 이번 diff 가 만든 새 결함이 아니라 이미 문서화됐거나(전자) 현재 무해한(후자)
pre-existing 경계다. 3차례의 선행 리뷰 라운드(CRITICAL 1 → WARNING 1 → 수렴)가 실제로
수렴했다는 결론에 동의한다.

## 위험도

LOW
