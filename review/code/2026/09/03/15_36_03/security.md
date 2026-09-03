# 보안(Security) 리뷰

## 대상 요약

이번 diff 는 `entity-nullable-column-type-mismatch` 배치 1 (+ 1R/2R 리뷰 후속 fix 커밋
`40fa58b8f`·`52ca3128a` 포함)이다. `User`/`Schedule` 엔티티 컬럼이 `nullable: true` 인데 TS
필드가 non-null 로 선언돼 강제되던 `null as unknown as X` 이중 캐스트 8건(`User` 7 ·
`Schedule` 1 — `passwordHash`·`twoFactorSecret`·`emailVerifyToken`·`emailVerifyExpiresAt`·
`passwordResetToken`·`passwordResetExpiresAt`·`lockedUntil`·`Schedule.nextRunAt`)을 제거하고
필드 타입을 `X | null` 로 넓힌 뒤, 부팅 실패를 냈던 `@Column({ type: ... })` 누락 4건을
정정했다. 부가로 회귀 방지 가드(`source-scan.ts::countNullAsUnknownAsCasts` +
`repo-guards/__tests__/nullable-type-lie-cast-guard.ts`/`.spec.ts`)가 신설됐고, 소비된
토큰/잠금 상태를 `undefined` 대신 `null` 로 명시 대입하는지 검증하는 테스트 5건이 추가됐다.
이 diff 에는 두 차례 앞선 리뷰 라운드(`14_44_15`, `15_17_01`)의 산출물(SUMMARY/RESOLUTION/
각 리뷰어 리포트)과 그 산출물을 대상으로 한 `review/consistency/2026/09/03/15_17_03/*`
consistency 리포트도 신규 파일로 함께 포함돼 있다.

값 수준(런타임) 동작은 캐스트 제거 전후로 **동일**하다 — `null as unknown as Date` → `null`
은 둘 다 런타임에는 같은 `null` 값을 대입하며 컴파일러가 보는 정적 타입만 달라진다. 소스를
직접 열어 `auth.service.ts::verifyEmail`/`resetPassword`, `totp.service.ts::disable`,
`users.service.ts::resetLoginAttempts` 의 현재 코드를 확인했고, 이메일 인증 토큰·비밀번호
재설정 토큰·2FA secret·로그인 잠금 시각을 소거하는 로직 자체(조건 분기·만료 체크·트랜잭션
경계)는 이 diff 이전과 완전히 동일함을 확인했다. `users.service.ts::incrementLoginAttempts`
의 raw SQL(`UPDATE "user" SET ... WHERE id = $1 RETURNING ...`)도 diff 범위 밖이며 여전히
`$1`/`$2`/`$3` 파라미터 바인딩으로 사용자 입력이 직접 SQL 문자열에 섞이지 않음을 재확인했다.

## 발견사항

CRITICAL/WARNING 급 보안 결함 없음.

- **[INFO]** (해소 확인) 회귀 가드 spec 이 프로덕션 소스 파일을 직접 변형하던 W1 이 실제로
  고쳐져 있다
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts` (함수
    `withFixture`, `describe('[대조군] 술어가 실제로 무는가', ...)` 블록)
  - 상세: 직전 라운드(`14_44_15`) security/side_effect 리뷰가 지적한 "가드 spec 이
    `fs.writeFileSync` 로 실제 `users.service.ts` 를 변형했다가 복원한다"(복원 실패 시
    서비스 소스가 손상된 채 남을 수 있음) 문제를, 이번 diff 에서 소스를 직접 읽어 확인한
    결과 `fs.mkdtempSync(path.join(os.tmpdir(), 'nullable-guard-'))` 기반의
    `withFixture()` 로 전환해 **저장소 파일에 전혀 쓰지 않는** 형태로 바뀌어 있다. 형제
    가드(`masked-reject-callers.spec.ts`)와 동일한 합성 fixture 관례를 따른다. 재발
    우려 없음 — 확인 목적으로 기재.
  - 제안: 조치 불요(이미 해소됨).

- **[INFO]** 신규 가드 정규식(`COLUMN_DECL`)의 중첩 괄호 대안이 catastrophic backtracking
  형태는 아니며, 입력 자체도 공격 표면이 아니다
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts` —
    `const COLUMN_DECL = /(@Column\((?:[^()]|\([^()]*\))*\))\s*\n\s*(\w+)\s*:\s*([^;]+);/g;`
  - 상세: `[^()]` 와 `\([^()]*\)` 두 대안은 시작 문자 집합이 서로 배타적(전자는 `(` 를
    제외, 후자는 반드시 `(` 로 시작)이라 같은 위치에서 두 대안이 동시에 매치를 시도해
    분기가 갈리는 형태가 아니다 — 지수적 백트래킹 조건(모호한 분기의 중첩 반복)을
    충족하지 않는다. 더 중요하게는, 이 정규식이 읽는 입력은 `SRC_ROOT`(`src/`) 하위의
    저장소 자신의 `.ts` 파일뿐이고 외부/사용자 입력을 받는 경로가 전혀 없다 — 설령 이론적
    으로 병리적 입력이 존재하더라도 공격자가 그 입력을 주입할 방법이 없다(CI/로컬
    빌드타임 전용 정적 스캔). ReDoS 위험 없음.
  - 제안: 조치 불요.

## 관점별 점검 결과

1. **인젝션**: 신규/변경 코드 중 사용자 입력을 받는 경로가 없다(엔티티 타입 선언, 순수
   정적 텍스트 스캔 유틸, plan/review 문서). `source-scan.ts`/`nullable-type-lie-cast-guard.ts`
   의 정규식은 `SRC_ROOT` 고정 경로 하위 저장소 소스만 스캔한다. `incrementLoginAttempts`
   raw SQL 은 diff 밖이며 여전히 파라미터 바인딩. 해당 없음.
2. **하드코딩된 시크릿**: 없음. 신규 코드에 API 키·비밀번호·토큰 리터럴 없음.
3. **인증/인가**: `auth.service.ts`(`verifyEmail`/`resetPassword`)·`totp.service.ts`
   (`disable`)·`users.service.ts`(`resetLoginAttempts`)의 변경분은 이메일 인증 토큰·
   비밀번호 재설정 토큰·2FA secret·로그인 잠금 시각을 `null` 로 소거하는 로직의
   **타입 표기만** 바꿨다(`null as unknown as X` → `null`). 조건 분기·토큰 만료 체크·
   해시 비교·트랜잭션 경계 등 인증 관련 로직 자체는 변경되지 않았다. 오히려 신규 테스트
   5건이 "TypeORM `update()` 는 `undefined` 필드를 SET 절에서 통째로 생략하므로 `null` 이
   `undefined` 로 조용히 회귀하면 소비된 토큰/잠금이 DB 에 남는다"는 실질적 보안 회귀
   클래스를 `toBeNull()` 단언으로 캐너리 고정한다 — 후퇴가 아니라 보강이다. 인증 우회·
   권한 검증 누락 없음.
4. **입력 검증**: 영향 없음. `validatePasswordStrength`, `isValidBcryptHash` 등 기존 검증
   로직은 diff 범위 밖이며 그대로 유지.
5. **OWASP Top 10**: 해당 사항 없음. 순수 타입 시스템 정합화 + 테스트 보강 + 문서/리뷰
   산출물 커밋으로, 새로운 데이터 흐름·신뢰 경계 변경이 없다.
6. **암호화**: 영향 없음. SHA-256 토큰 해시(`hashToken`)·bcrypt 비밀번호 해시·TOTP secret
   처리 로직은 diff 대상이 아니다.
7. **에러 처리**: 영향 없음. 에러 메시지 노출 관련 코드는 diff 범위 밖이며 변경되지 않았다.
8. **의존성 보안**: 신규 의존성 추가 없음.

앞선 두 리뷰 라운드(`14_44_15`, `15_17_01`)의 security 리포트도 각각 NONE 위험도로 판정했고,
이번 독립 재검토(소스 직접 `Read` + raw SQL 파라미터 바인딩 재확인 + 가드 정규식 백트래킹
형태 분석)에서도 새로운 CRITICAL/WARNING 급 결함은 발견되지 않았다.

## 요약

이번 변경은 `null as unknown as X` 강제 이중 캐스트를 제거하고 엔티티 필드 타입을
`X | null` 로 정직하게 넓히는 타입-레벨 리팩터이자, 그 과정에서 발견된 부팅 실패(CRITICAL,
이전 라운드에서 이미 지적·수정됨)를 `@Column({ type: ... })` 명시로 정정한 것이다. 인증·
인가·인젝션·암호화·에러 처리 등 보안에 영향을 주는 로직 자체는 변경되지 않았고, 신설된
회귀 가드와 테스트는 오히려 "소비된 이메일 인증/비밀번호 재설정 토큰·2FA secret·로그인
잠금 상태가 `undefined` 회귀로 DB 에 남는" 잠재적 보안 회귀 클래스를 캐너리로 고정하는
방향으로 보강됐다. 직전 라운드가 지적한 "가드 테스트가 프로덕션 소스 파일을 직접 변형"
하던 문제(W1)도 `os.tmpdir()` 합성 fixture 전환으로 해소되어 있음을 소스를 직접 읽어
확인했다. raw SQL(`incrementLoginAttempts`)은 diff 밖이며 여전히 파라미터 바인딩되어
있다. CRITICAL/WARNING 급 보안 결함 없음.

## 위험도

NONE
