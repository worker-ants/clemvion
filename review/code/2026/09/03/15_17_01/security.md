# 보안(Security) 리뷰

## 대상 요약

이번 diff 는 `entity-nullable-column-type-mismatch` 배치 작업이다. 엔티티 컬럼이 `nullable: true`
인데 TS 필드가 non-null 로 선언돼 강제되던 `null as unknown as X` 이중 캐스트 8건(`User` 7 ·
`Schedule` 1)을 제거하고 필드 타입을 `X | null` 로 넓힌 뒤, 이전 리뷰 라운드(14_44_15)에서
CRITICAL 로 지적된 `@Column({ type: ... })` 누락(TypeORM 이 union 타입을 `Object` 로 리플렉션해
`DataSource.initialize()` 가 부팅 즉사)을 4개 컬럼(`passwordHash`·`twoFactorSecret`·
`emailVerifyToken`·`passwordResetToken`)에 `type: 'varchar'` 를 붙여 정정했다. 부가로 회귀 방지
가드(`source-scan.ts::countNullAsUnknownAsCasts`/`hasNullAsUnknownAsCast` +
`repo-guards/__tests__/nullable-type-lie-cast-guard.ts`/`.spec.ts`)가 신설됐고, 이전 라운드에서
지적된 WARNING(W1~W4)도 함께 반영됐다 — 대조군 테스트가 `os.tmpdir()` 합성 fixture 로 바뀌어
더 이상 프로덕션 소스 파일(`users.service.ts`)을 `writeFileSync` 로 변형하지 않으며,
`verifyEmail`/`resetPassword`/`resetLoginAttempts`/schedule 재계산 분기에 "`null` 명시 대입"을
정확히 단언하는 테스트가 추가됐다.

값 수준(런타임) 동작은 캐스트 제거 전후로 동일하다 — `null as unknown as Date` → `null` 은 둘 다
런타임에는 같은 `null` 값을 대입하며 컴파일러가 보는 정적 타입만 달라진다. 오히려 이번에 추가된
테스트들은 실질적인 보안 관련 회귀 클래스 하나를 명시적으로 캐너리로 고정한다: TypeORM
`update()` 는 `undefined` 필드를 SET 절에서 통째로 생략하므로, 향후 리팩터로 `null` 이
`undefined` 로 조용히 바뀌면 "소비된 이메일 인증/비밀번호 재설정 토큰이 DB 에 남아 재사용 가능",
"로그인 잠금이 해제되지 않음" 같은 결과로 이어진다. 이번 diff 는 그 회귀를 `toBeNull()` 단언으로
직접 잡도록 강화했다(코드 로직 자체의 변경은 없음).

## 발견사항

발견된 CRITICAL/WARNING 급 보안 결함 없음.

- **[INFO]** 신규 가드가 스캔하는 정규식(`COLUMN_DECL`)이 `@Column(...)` 블록 안에서 중첩 괄호
  대안(`(?:[^()]|\([^()]*\))*`)을 쓴다
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts` (`COLUMN_DECL` 상수 정의부)
  - 상세: 두 대안(`[^()]` vs `\([^()]*\)`)이 소비하는 첫 글자가 서로 배타적(괄호냐 아니냐)이라
    동일 입력에 대해 백트래킹 분기가 갈리지 않아 catastrophic backtracking(ReDoS) 형태는 아니다.
    또한 이 정규식이 읽는 입력은 저장소 자신의 `src/**/*.ts` 파일(고정된 `SRC_ROOT` 하위)뿐이고
    외부/사용자 입력을 받지 않으므로 공격 표면이 아니다. 참고 삼아 기록.
  - 제안: 조치 불요.

## 관점별 점검 결과

1. **인젝션**: 신규/변경 코드에 사용자 입력을 받는 경로가 없다(엔티티 타입 선언, 순수 정적 텍스트
   스캔 유틸, plan 문서, 리뷰 산출물 마크다운/JSON). `source-scan.ts`/`nullable-type-lie-cast-guard.ts`
   의 정규식은 저장소 자신의 소스 텍스트만 스캔하며(`SRC_ROOT` 고정, 사용자 경로 인자 없음) 외부
   입력을 다루지 않는다. `users.service.ts` 의 `incrementLoginAttempts` raw SQL(파라미터 바인딩
   `$1/$2/$3`)은 이번 diff 범위 밖(컨텍스트만 노출)이며 변경되지 않았다 — 여전히 파라미터화돼
   있다. 해당 없음.
2. **하드코딩된 시크릿**: 없음. 신규 코드에 API 키·비밀번호·토큰 리터럴 없음.
3. **인증/인가**: `auth.service.ts`(`verifyEmail`/`resetPassword`)·`totp.service.ts`(`disable`)·
   `users.service.ts`(`resetLoginAttempts`)의 변경분은 이메일 인증 토큰·비밀번호 재설정 토큰·2FA
   secret·로그인 잠금 시각을 `null` 로 초기화하는 로직의 **타입 표기만** 바꿨다(`null as unknown
   as X` → `null`). 조건 분기·검증 순서·토큰 만료 체크·해시 비교 로직 자체는 변경되지 않았다.
   추가된 테스트(`auth.service.spec.ts`·`users-login-attempts.service.spec.ts`·
   `schedule-runner.service.spec.ts`·`schedules.service.spec.ts`)는 오히려 "소비된 토큰/잠금
   상태가 `undefined` 로 회귀해 DB 에 남는" 클래스의 회귀를 잡는 캐너리를 추가한 것으로, 보안
   후퇴가 아니라 보강이다. 인증 우회·권한 검증 누락 없음.
4. **입력 검증**: 영향 없음. `validatePasswordStrength`, `isValidBcryptHash` 등 기존 검증 로직은
   diff 범위 밖이며 그대로 유지된다.
5. **OWASP Top 10**: 해당 사항 없음. 순수 타입 시스템 정합화 + 테스트 보강 + 문서/리뷰 산출물
   커밋으로, 새로운 데이터 흐름이나 신뢰 경계 변경이 없다.
6. **암호화**: 영향 없음. SHA-256 토큰 해시(`hashToken`)·bcrypt 비밀번호 해시·TOTP secret 처리
   로직은 diff 대상이 아니다.
7. **에러 처리**: 영향 없음. 에러 메시지 노출 관련 코드는 diff 범위 밖이며 변경되지 않았다.
8. **의존성 보안**: 신규 의존성 추가 없음.

이전 라운드(14_44_15) security 리뷰가 INFO 로 지적했던 "가드 spec 이 프로덕션 소스 파일을
`writeFileSync` 로 변형" 문제는 이번 diff 에서 `os.tmpdir()` 기반 `withFixture` 합성 fixture 로
교체되어 **해소**됐음을 확인했다(`nullable-type-lie-cast.spec.ts`).

## 요약

이번 변경은 `null as unknown as X` 강제 이중 캐스트를 제거하고 엔티티 필드 타입을 `X | null` 로
정직하게 넓히는 타입-레벨 리팩터에, 직전 리뷰 라운드의 CRITICAL(부팅 실패용 `type:` 누락 4건
정정)과 WARNING(테스트가 프로덕션 파일을 변형하던 것을 tmp fixture 로 교체, `null` 명시 대입
경로의 테스트 커버리지 보강)이 반영된 상태다. 인증·인가·인젝션·암호화·에러 처리 등 보안에 영향을
주는 로직 자체는 변경되지 않았고, 신설된 회귀 가드와 테스트는 오히려 "민감 토큰/잠금 상태가
`undefined` 회귀로 DB 에 남는" 잠재적 보안 회귀 클래스를 캐너리로 고정하는 방향으로 보강됐다.
CRITICAL/WARNING 급 보안 결함 없음.

## 위험도

NONE
