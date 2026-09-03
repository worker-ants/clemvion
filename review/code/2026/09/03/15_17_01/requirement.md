# Requirement Review — entity nullable 배치 1 (fix 커밋 포함)

## 배경

본 diff 는 이전 리뷰(`review/code/2026/09/03/14_44_15/`)에서 CRITICAL 로 지적된 "`User` 4개
컬럼이 `@Column()` 에 `type:` 을 명시하지 않아 `DataSource.initialize()` 가
`DataTypeNotSupportedError` 로 죽는다" 결함의 **fix 커밋**(`40fa58b8f`)까지 포함한 상태다.
실제로 `codebase/backend/src/modules/users/entities/user.entity.ts` 를 직접 열어
`passwordHash`·`twoFactorSecret`·`emailVerifyToken`·`passwordResetToken` 4개 필드 모두
`type: 'varchar'` 가 이미 붙어 있음을 확인했다 — **그 CRITICAL 은 이 diff 시점에 이미
해소돼 있다.**

## 검증한 것

- `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts` 12건 전체
  GREEN (`npx jest` 직접 실행, 0.222s).
- `auth.service.spec.ts`·`users-login-attempts.service.spec.ts`·
  `schedule-runner.service.spec.ts`·`schedules.service.spec.ts` 4파일 108건 GREEN.
- **뮤테이션 스팟체크**: `users.service.ts::resetLoginAttempts` 의 `lockedUntil: null` 을
  `lockedUntil: undefined` 로 되돌려 재실행 → 신규 테스트가 정확히 **RED**
  (`expect(patch.lockedUntil).toBeNull()` 실패, `Received: undefined`). scratch 로 원본
  `cp` 백업 후 mutate → 확인 → `cp` 로 원복, `git status --short` 로 잔여물 없음 확인 완료
  (RESOLUTION.md 의 "7축 RED" 주장 중 1축을 독립 재현).
- `findCastOffenders`/`findUntypedNullableColumns` 가 스캔하는 `src` 전체에서
  `null as unknown as` 잔존을 `grep` 으로 재확인 — 남은 3곳은 전부 주석/정규식 리터럴
  자체(코드 매칭 대상 아님), 실제 캐스트 0건.
- `resetPassword`/`verifyEmail` 신규 테스트가 실제 구현(`findUserByResetToken`/
  `findUserByVerifyToken` → `refreshTokenRepository.manager.getRepository`)과 정확히
  같은 mock 경로를 타는지 소스 대조 완료 — 정합.
- `totp.service.spec.ts::disable` 은 이미 정확한 인자(`toHaveBeenCalledWith`)로 단언하고
  있어 이번 diff 의 `twoFactorSecret: null` 변경에 대한 커버리지 공백 없음.
- `spec/5-system/1-auth.md`(§비밀번호 저장, §change-password) 대조 — `password_hash`
  nullable·OAuth-only 처리 등 이 diff 가 건드리는 **행위**는 변경되지 않았고(순수 TS 타입
  표기 정리), spec 본문과 불일치하는 지점 없음.
- `spec/data-flow/10-triggers.md` §3.2(`next_run_at` 계산)·`spec/1-data-model.md` 대조 —
  cron 파싱 실패 시 `nextRunAt` 이 무엇이 되는지는 spec 이 침묵하는 영역(정보성 컬럼이라고만
  기술)이라 이 diff 의 `null` 명시 대입은 spec 위반이 아니다(회색지대, INFO).

## 발견사항

- **[INFO]** `auth.service.spec.ts` 의 `mockUser` fixture 에 여전히
  `lockedUntil: null as unknown as Date` 캐스트가 남아 있음 — `User.lockedUntil` 이 이번
  배치로 `Date | null` 로 넓혀졌으므로 이제 캐스트 없이 `lockedUntil: null` 만으로 타입체크가
  통과한다(직접 확인: `mockUser: Partial<User>`).
  - 위치: `codebase/backend/src/modules/auth/auth.service.spec.ts:58`
  - 상세: 신규 가드(`nullable-type-lie-cast-guard.ts`)는 `*.spec.ts` 를 스캔 대상에서
    명시적으로 제외하므로 이 잔존 캐스트는 가드에 안 걸리고, 기능 결함도 아니다.
  - 제안: 이미 직전 리뷰(`14_44_15` SUMMARY INFO#11)에서 지적되고 **의도적으로 배치 2 로
    이월**된 항목이다(RESOLUTION.md "정확한 지적이나 spec 캐스트 정리는 이 배치 범위 밖이라
    배치 2 로 넘긴다") — 재조치 불요, 그대로 유지 확인 목적으로만 재기재.

- **[INFO]** `nullable-type-lie-cast-guard.ts`(비-spec 소스, 스캔 대상)와
  `source-scan.ts`(비-spec 소스, 스캔 대상) 자신이 "`null as unknown as`" 문자열을
  코드/주석 형태로 담고 있는데, 자기 자신을 스캔해도 오탐이 없다 — `source-scan.ts:161` 의
  정규식 리터럴 `/\bnull as unknown as\b/g` 은 `\b` 뒤에 오는 `b` 문자가 "null" 앞의 단어
  경계를 차단해 매치되지 않고(직접 트레이스로 확인), `source-scan.ts:136` 의 docstring
  언급은 block comment 라 `stripComments` 로 제거된다.
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts:161`
  - 상세: 이는 **우연**(정규식 형태에 의존)이며 직전 리뷰 SUMMARY INFO#3 이 이미 동일하게
    지적하고 "판단 유지 — spec 캐스트는 정당, 술어 파일은 실측 0건" 으로 미조치 처리한
    항목이다. 재발 위험은 낮지만(정규식을 문자열 방식으로 바꾸면 깨지는 종류) 그 결정을
    재확인만 한다.
  - 제안: 조치 불요(기존 결정 유지). 향후 이 정규식을 리팩터할 사람을 위해 남겨 둔 주석으로
    충분.

- **[INFO]** (spec fidelity, 회색지대) `Schedule.lastRunAt` 은 DB 컬럼이
  `nullable: true` 인데 TS 타입은 여전히 `Date`(non-null) — `nextRunAt` 만 이번 배치로
  `Date | null` 로 넓혀져 같은 엔티티 안에서 비대칭.
  - 위치: `codebase/backend/src/modules/schedules/entities/schedule.entity.ts:44-45`
  - 상세: 이 diff 의 스코프(캐스트를 강제하던 8필드) 밖이고, `lastRunAt` 은
    `null as unknown as X` 캐스트를 강제하지 않아(코드가 항상 `new Date()` 를 대입) 이번
    배치 선정 기준에 애초에 해당하지 않는다. plan(`entity-nullable-column-type-mismatch.md`
    "할 일" 배치 2 후보)이 이미 추적 중이며 spec 본문도 이 필드의 null 여부를 규정하지 않아
    (회색지대) 위반이 아니다.
  - 제안: 조치 불요, plan 이 이미 추적. 다음에 이 엔티티 파일을 만질 때 비대칭 주석 한 줄
    추가를 고려(직전 리뷰 SUMMARY INFO#8 과 동일 제안, 미조치 유지 확인).

## 요약

이 diff 는 `User` 7필드 + `Schedule.nextRunAt` 1필드의 `null as unknown as X` 이중 캐스트를
제거하고 타입을 `T | null` 로 넓히는 순수 리팩터(behavior-preserving)이며, 직전 라운드에서
발견된 CRITICAL(4개 컬럼 `@Column({ type: })` 누락 → 부팅 실패)은 후속 fix 커밋으로 이미
해소됐음을 소스 직접 확인 + jest 실행 + 뮤테이션 스팟체크로 검증했다. 직전 라운드가 지적한
WARNING 4건(`verifyEmail`/`resetPassword`/`resetLoginAttempts`/schedule cron 재계산의
null-vs-undefined 커버리지 공백)도 신규 테스트로 채워졌고, `lockedUntil: null` →
`undefined` 뮤턴트가 정확히 RED 를 내는 것을 독립 재현했다. 신규 회귀 가드
(`nullable-type-lie-cast-guard.ts`/`.spec.ts`)는 대조군 fixture 를 `os.tmpdir()` 합성으로
전환해(W1 반영) 프로덕션 파일을 더 이상 변형하지 않는다. `spec/` 문서(§5-system/1-auth.md,
data-flow/10-triggers.md, 1-data-model.md)와 대조해도 이 diff 가 건드리는 것은 TS 타입
표기뿐이며 어떤 행위·필드 의미·상태 전이도 바뀌지 않아 spec 불일치가 없다. 남은 발견은 전부
INFO 수준이며 그마저도 이미 직전 리뷰에서 식별되어 plan/RESOLUTION 에 의도적으로 이월된
항목의 재확인이다 — 신규 결함은 발견되지 않았다.

## 위험도

NONE
