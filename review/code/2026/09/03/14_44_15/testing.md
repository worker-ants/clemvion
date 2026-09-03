# 테스트(Testing) 리뷰 — nullable 타입 정렬 배치 1 (`entity-nullable-column-type-mismatch`)

## 발견사항

- **[CRITICAL]** `user.entity.ts` 의 `string` nullable 컬럼 4개가 `type:` 미지정 상태로 `| null` 로 넓혀져 — TypeORM `design:type` 리플렉션이 `Object` 로 방출돼 Postgres 부팅이 깨질 수 있다. 이 diff 자체가 그 결함을 실제로 냈다는 증거가 같은 워크트리에 있다.
  - 위치: `codebase/backend/src/modules/users/entities/user.entity.ts:21-22`(`passwordHash`), `:39-40`(`twoFactorSecret`), `:70-71`(`emailVerifyToken`), `:80-81`(`passwordResetToken`)
  - 상세: `emitDecoratorMetadata: true`(`codebase/backend/tsconfig.json:10`)인 상태에서 TS 유니언 타입은 `design:type` 메타데이터로 표현할 수 없어 `Object` 로 방출된다. `@Column()` 이 `type:` 을 명시하지 않으면 TypeORM 이 이 리플렉션 타입으로 컬럼 SQL 타입을 추론하는데, `Object` 는 어떤 드라이버에도 매핑되지 않아 앱 부팅 시 `DataTypeNotSupportedError` 로 죽는다. 같은 파일에서 이미 `type: 'timestamptz'` 를 명시해 온 `Date` 컬럼들(`emailVerifyExpiresAt`·`passwordResetExpiresAt`·`lockedUntil`)과 `schedule.entity.ts` 의 `nextRunAt`(`type: 'timestamptz'` 기존 명시)은 안전하지만, 이번에 새로 넓힌 `string` 컬럼 4개는 `type:` 이 없다.
    실제로 이 결함이 발생했다는 것을 **리뷰 대상 diff 밖, 같은 워크트리의 미커밋 변경**(`git diff HEAD` — `user.entity.ts`/`nullable-type-lie-cast-guard.ts`/`nullable-type-lie-cast.spec.ts`, 리뷰 페이로드 파일 목록엔 없음)에서 직접 확인했다. 그 미커밋 코드의 새 주석이 이렇게 적고 있다: *"2026-09-03 에 실제로 그렇게 깨뜨렸다. **lint·unit·build·`tsc` 가 전부 통과했고 오직 e2e 만 잡았다**."* 즉 리뷰 대상 커밋(`7ce4fa92a`) 시점에는 이 결함이 실재했고, 이 리뷰가 보는 unit 테스트(`auth.service.spec.ts`·`totp.service.spec.ts`·`users.service.spec.ts` 등)는 전부 리포지토리를 mock 하므로 구조적으로 이 클래스의 결함을 볼 수 없다 — e2e 만 유일한 방어선이었고, 실제로 한 번 뚫렸다.
    본 diff 가 같이 추가한 회귀 가드(`nullable-type-lie-cast.spec.ts`, 파일 10)와 그 근거 문서(`plan/in-progress/entity-nullable-column-type-mismatch.md:80` "## 회귀 가드 — 이 클래스는 이제 스스로 닫힌다")는 **`null as unknown as X` 캐스트 잔존만** 검사한다 — `type:` 누락으로 인한 이 부팅 실패 클래스는 전혀 검사하지 않는다. "이제 스스로 닫힌다" 는 진술이 실제 구현보다 넓다(이 저장소가 이미 여러 번 겪은 "문서한 보장이 구현보다 넓다" 패턴).
  - 제안: 미커밋 상태에 이미 존재하는 `findUntypedNullableColumns` 가드(+ `@Column({ type: 'varchar', ... })` 명시)가 정확히 이 결함을 잡는 올바른 방향으로 보인다. 이 fix 를 이번 배치(`7ce4fa92a`)에 흡수하거나, 최소한 별도 커밋으로 **같은 PR 사이클 안에서** 커밋해 리뷰·CI 를 통과시켜야 한다. "회귀 가드가 이 클래스를 닫는다" 는 plan 문서 서술은 그 가드가 실제로 두 실패 모드(캐스트 잔존 + 타입 미지정)를 모두 덮은 뒤에만 성립한다.

- **[WARNING]** 신규 가드 spec 의 "캐스트 주입" 대조군 테스트가 **실제 프로덕션 소스 파일**을 직접 `fs.writeFileSync` 로 변조한다 — 같은 폴더의 자매 가드는 임시 디렉터리를 쓴다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts:84-98` (`[대조군] 캐스트를 주입한 파일을 넣으면 offender 로 잡힌다`)
  - 상세: `users.service.ts` 원본을 읽어 캐스트 문자열을 append 한 뒤 `finally` 에서 되돌린다. try/finally 로 즉시 원복하고 마지막에 재확인 단언까지 두었지만, jest worker kill·타임아웃·OOM 등으로 프로세스가 `finally` 실행 전에 죽으면 git-tracked 프로덕션 파일이 변조된 채 워킹트리에 남는다 — 이 리뷰 프롬프트 자신이 리뷰어에게 경고하는 바로 그 위험 클래스다. 같은 디렉터리의 `masked-reject-callers.spec.ts:61-84`(`[캐너리] 허용목록 밖 위반을 실제로 탐지한다`)는 정확히 같은 목적(가드가 실제 위반을 탐지하는지 확인)을 `fs.mkdtempSync(path.join(os.tmpdir(), 'masked-guard-'))` 로 만든 임시 디렉터리 fixture 로 달성한다 — 이 저장소에 이미 안전한 관례가 있는데 이번 가드만 따르지 않았다.
  - 제안: `users.service.ts` 를 직접 변조하는 대신 `masked-reject-callers.spec.ts` 와 동일하게 `os.tmpdir()` 에 합성 fixture 파일을 만들어 `findCastOffenders([tmpFile])` 을 호출하도록 바꾼다. Jest 는 기본적으로 스펙 파일 단위로 워커를 병렬 실행하므로, 다른 repo-guard spec 이 같은 시각에 `src/` 를 스캔하다 변조된 `users.service.ts` 를 관측할 여지도 함께 사라진다.

- **[WARNING]** `auth.service.ts` 의 이번 diff 두 지점(`verifyEmail`·`resetPassword`) 모두, 실제로 `null` 이 전달됐는지를 검증하는 단위 테스트가 없다 — 한쪽은 아예 성공 경로 테스트가 없고, 다른 한쪽은 인자를 단언하지 않는다.
  - 위치: `codebase/backend/src/modules/auth/auth.service.spec.ts:1028-1047`(`describe('verifyEmail', …)` 의 `'should verify email and create workspace in transaction'`), `codebase/backend/src/modules/auth/auth.service.spec.ts:902-921`(`describe('resetPassword (token hashing)', …)`)
  - 상세: `verifyEmail` 테스트는 `mockDataSource.transaction` 이 호출됐는지와 반환 토큰만 확인할 뿐, `manager.getRepository(User).update(...)` 에 실제로 `{ emailVerifyToken: null, emailVerifyExpiresAt: null }` 이 들어갔는지는 단언하지 않는다. `resetPassword` 는 **성공 경로 테스트 자체가 없다** — 있는 유일한 테스트는 유효하지 않은 토큰으로 실패하는 경로(해시 조회 검증)뿐이라, 성공 시 `usersService.update(user.id, { passwordHash, passwordResetToken: null, passwordResetExpiresAt: null })` 호출은 아무 테스트도 거치지 않는다. TypeORM 의 `update()` 는 `undefined` 필드를 SET 절에서 통째로 생략하므로(`null` 과 의미가 다르다), 이 diff 가 없앤 캐스트 자리에 향후 누군가 `null` 대신 `undefined` 를 넣어도(예: 옵셔널 체이닝 리팩터 실수) 이 두 테스트는 그 회귀를 못 잡는다.
    반대로 같은 diff 의 `totp.service.ts:disable()` 은 `totp.service.spec.ts:114-122` 가 `expect(usersService.update).toHaveBeenCalledWith('user-1', { twoFactorEnabled: false, twoFactorSecret: null, totpRecoveryCodes: null })` 로 정확한 인자를 단언한다 — 이쪽이 올바른 패턴이고, `auth.service.spec.ts` 두 곳이 그 수준에 못 미친다.
  - 제안: `verifyEmail` 성공 테스트에 `manager.getRepository(User).update` 호출 인자 단언을 추가하고, `resetPassword` 에 성공 경로 테스트(현재는 실패 경로만 존재)를 신설해 `usersService.update` 호출 인자를 `totp.service.spec.ts` 와 동일한 수준으로 검증한다.

- **[WARNING]** 이번 diff 가 건드린 `UsersService.resetLoginAttempts`(`lockedUntil: null` 로 바뀐 그 줄)는 백엔드 스펙 전체에서 직접 테스트되는 곳이 없다.
  - 위치: `codebase/backend/src/modules/users/users.service.ts:384-389`(`resetLoginAttempts`) — 테스트 부재. `users.service.spec.ts`(전체)·`users-login-attempts.service.spec.ts`(전체, `incrementLoginAttempts` 만 커버)를 확인.
  - 상세: `resetLoginAttempts` 는 `isLocked()`(`users.service.ts:406-413`)의 잠금 자동 해제 분기에서도 호출되는 보안 관련 경로인데, 두 스펙 파일 어디에도 `resetLoginAttempts`·`isLocked` 를 직접 부르는 테스트가 없다(`grep -rn "resetLoginAttempts" src --include="*.spec.ts"` 결과는 `AuthService.login` 이 `resetLoginAttempts` 를 호출했는지 여부만 확인하는 spy 하나뿐). `lockedUntil` 이 `null` 대신 `undefined` 로 회귀해도(TypeORM 이 그 필드를 SET 절에서 생략) 어떤 테스트도 못 잡는다.
  - 제안: `users-login-attempts.service.spec.ts` 에 `resetLoginAttempts`(및 `isLocked` 만료 분기)의 정확한 update 인자를 단언하는 테스트를 추가한다.

- **[WARNING]** `nextRunAt` 을 `null` 로 되돌리는 두 분기 — 이번 diff 가 정확히 건드린 자리 — 가 각각의 spec 에서 실행되지 않는다.
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:241`(`schedule.nextRunAt = nextRun ? new Date(nextRun) : null;`), `codebase/backend/src/modules/schedules/schedule-runner.service.ts:190`(`catch { schedule.nextRunAt = null; }`)
  - 상세: `schedules.service.spec.ts` 의 `update()` 테스트들(319-343, 345-376행)은 전부 `{ name: … }` 만 바꿔 `if (dto.cronExpression || dto.timezone)` 분기(241행 포함)에 진입하지 않는다 — `computeNextRuns` 를 거치는 update 호출이 스펙에 하나도 없다. `schedule-runner.service.spec.ts` 는 `CronExpressionParser.parse` 가 던지도록 만드는 테스트가 없어 `process()` 의 catch 분기(190행, `nextRunAt = null`)도 실행되지 않는다(정상 경로 209-254행 근처 테스트만 존재, `nextRunAt: expect.any(Date)` 로 성공 분기만 확인).
  - 제안: `schedules.service.spec.ts` 에 `dto.cronExpression`(또는 `dto.timezone`) 변경 시 `nextRunAt` 재계산 테스트를, `schedule-runner.service.spec.ts` 에 `CronExpressionParser.parse` 가 throw 하는 케이스(예: DB 에 남아 있는 구버전 무효 cron)에서 `nextRunAt` 이 `null` 로 떨어지는 테스트를 추가한다.

- **[INFO]** `countNullAsUnknownAsCasts`/`hasNullAsUnknownAsCast` 는 형제 함수 `countRawUpdateReturning` 만큼의 "이 축이 안 보는 것" 서술·테스트가 없다.
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts:158-163`(`countNullAsUnknownAsCasts`)
  - 상세: `\bnull as unknown as\b` 는 단어 사이 정확히 한 칸 공백을 요구한다 — prettier 개행으로 이 짧은 구절이 줄바꿈될 가능성은 낮지만(실측 없음), 주석이 아닌 문자열 리터럴(로그 메시지 등) 안에 이 구절이 우연히 등장하면 오탐이 날 수 있다는 점도 문서화돼 있지 않다. `countRawUpdateReturning` 은 이런 blind spot 을 "## 이 축이 안 보는 것" 섹션으로 명시하는 관례가 있는데, 이번 함수는 근거(`## 왜 이 형태를 세나`)만 있고 한계 섹션이 없다.
  - 제안: 우선순위는 낮음(오탐 방향이므로 안전 쪽으로 실패한다). 여유가 있으면 한 줄로 blind spot 을 명시.

- **[INFO]** `findCastOffenders` 는 단일 offender 파일만으로 테스트됐다 — 여러 파일이 동시에 위반하는 경우(배열 aggregation)는 미검증.
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts:84-98`
  - 상세: 실사용에서는 흔치 않은 시나리오이므로 리스크는 낮다.

## 요약

이번 diff 는 표면적으로 "타입 캐스트 제거"라는 런타임 무해 리팩터로 보이지만, 그 전제(엔티티 필드를 `| null` 로 넓히는 것 자체가 안전하다)가 실제로는 깨졌다 — `type:` 미지정 `string` nullable 컬럼 4개가 TypeORM 부팅을 깨뜨리는 결함을 냈고, 그 결함은 unit 테스트가 구조적으로 볼 수 없는 자리(리포지토리 mock)였으며 오직 e2e 만 잡았다는 증거가 같은 워크트리의 미커밋 변경에 남아 있다. 이번에 신설된 회귀 가드(`nullable-type-lie-cast.spec.ts`)는 잘 설계됐지만 "캐스트 잔존"만 덮어, plan 문서의 "이제 스스로 닫힌다"는 진술이 실제로는 이 결함 클래스를 덮지 못한다. 그 외에 이번 diff 가 직접 건드린 여러 지점(`verifyEmail`/`resetPassword`/`resetLoginAttempts`/`nextRunAt` null 분기)이 정확한 호출 인자·양쪽 분기를 검증하는 테스트 없이 넘어갔고, 신규 가드 spec 의 대조군 테스트 하나는 자매 가드가 이미 확립한 임시 디렉터리 fixture 관례 대신 실제 프로덕션 소스 파일을 직접 변조한다.

## 위험도

CRITICAL
