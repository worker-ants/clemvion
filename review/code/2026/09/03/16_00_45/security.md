# 보안(Security) 리뷰

## 대상 요약

`entity-nullable-column-type-mismatch` 배치 1의 3차 리뷰(3R) 대상 diff. `origin/main...HEAD` 기준
실제 코드 변경은 14개 파일(546 insertions / 22 deletions)이며, 본질은 다음 세 축이다.

1. `User`/`Schedule` 엔티티에서 `nullable: true` 컬럼인데 TS 필드가 non-null 이라 강제되던
   `null as unknown as X` 이중 캐스트 8건을 제거하고 필드 타입을 `X | null` 로 넓힘.
2. 그 넓힌 4개 컬럼(`passwordHash`·`twoFactorSecret`·`emailVerifyToken`·`passwordResetToken`)에
   `@Column({ type: 'varchar', ... })` 명시 추가 — 1R 에서 발견된 CRITICAL(`design:type` 리플렉션이
   `Object` 로 방출돼 `DataTypeNotSupportedError` 로 부팅 실패)의 수정.
3. 위 변경으로 회귀할 수 있는 지점(토큰/잠금 필드가 `undefined` 로 새어 DB SET 절에서 생략되는 경우)을
   잡는 단위 테스트 5건 + 재발 방지 정적 가드(`nullable-type-lie-cast-guard.ts`/`.spec.ts`) 신설.

값 수준(런타임) 동작은 캐스트 제거 전후 동일하다 — `null as unknown as Date` → `null` 은 둘 다
런타임에 같은 `null` 값을 대입하며 컴파일러가 보는 정적 타입만 달라진다. 1R·2R 보안 리뷰가 이미
동일 결론(NONE)에 도달했고, 3R 에서 코드가 바뀐 부분은 `auth.service.spec.ts`/`schedules.service.spec.ts`
의 테스트 서술·단언 1줄뿐(`git show --stat e78b6dbad`로 확인)이라 보안 판정에 영향이 없다.

## 발견사항

발견된 CRITICAL/WARNING 급 보안 결함 없음.

- **[INFO]** 신규 정적 가드의 정규식(`COLUMN_DECL`)이 중첩 대안(`(?:[^()]|\([^()]*\))*`)을 쓴다 — ReDoS 형태 여부 재확인
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts` (`COLUMN_DECL` 상수 정의부, 함수 `findUntypedNullableColumns`)
  - 상세: `/(@Column\((?:[^()]|\([^()]*\))*\))\s*\n\s*(\w+)\s*:\s*([^;]+);/g` 는 괄호 안쪽을
    한 단계까지 매칭하는 전형적인 패턴이다. 두 대안(`[^()]`와 `\([^()]*\)`)이 서로 겹치지 않게
    분리돼 있어(전자는 `(`/`)` 를 절대 소비하지 않고, 후자는 반드시 `(` 로 시작) catastrophic
    backtracking 의 전형적 전제조건인 "동일 부분 문자열을 두 가지 이상의 경로로 매칭 가능"이
    성립하지 않는다. 이 판단은 1R·2R 의 security reviewer 가 이미 검증했고(2R RESOLUTION
    INFO#7·#8: "prettier 정규화로 현재 안전하고 ReDoS 형태가 아님을 확인"), 이번에 다시 정적으로
    재확인해도 같은 결론이다. 더 중요한 완화 요인은 **입력이 신뢰 경계 밖 데이터가 아니라는 점**
    이다 — 이 정규식은 공격자가 통제할 수 있는 요청/응답 값이 아니라 저장소 자신의 `src/**.ts`
    소스 텍스트(테스트/CI 실행 시점에만 읽음)에만 적용된다. 실질적 공격 표면이 없다.
  - 제안: 조치 불요. 다만 실제 엔티티에 2단 이상 중첩 괄호가 등장하면(예: 제네릭 타입 인자 안에
    함수 호출이 들어가는 극단적 형태) 이 패턴이 매칭에 실패할 수 있으므로 — 이는 보안이 아니라
    가드의 탐지력(false negative) 문제로, 이미 plan 문서에 후속 항목으로 인지돼 있다.

- **[INFO]** 신규 가드 spec 이 저장소 실제 소스 파일을 변형하던 1R 의 WARNING(W1)이 3R 시점에 확인상 완전히 해소됨
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts` (`withFixture` 헬퍼, `describe('[대조군] 술어가 실제로 무는가', ...)` 블록)
  - 상세: 프롬프트에 전달된 diff 청크가 크기 제한으로 생략되어 있어 `Read`/`git diff` 로 파일
    전체를 직접 열어 확인했다. 1R 에서 지적된 대로 `users.service.ts` 를 `fs.writeFileSync` 로
    직접 변형-복원하던 패턴은 완전히 제거됐고, 지금은 `fs.mkdtempSync(path.join(os.tmpdir(), ...))`
    로 저장소 밖 임시 디렉터리에 합성 fixture 파일(`probe.entity.ts`)을 만들어 검증한 뒤
    `fs.rmSync(dir, { recursive: true, force: true })` 로 정리한다. 프로덕션 소스 파일에 대한
    쓰기가 완전히 사라졌다.
  - 제안: 없음(이미 해결됨). 확인 목적의 기록.

- **[INFO]** 토큰/잠금 필드를 `null` 로 **명시** 대입하는 회귀 방지 테스트가 실제로 보안 속성(토큰 재사용 방지)을 고정한다
  - 위치: `codebase/backend/src/modules/auth/auth.service.ts:233-234`(`emailVerifyToken`/`emailVerifyExpiresAt`), `:752-753`(`passwordResetToken`/`passwordResetExpiresAt`), `codebase/backend/src/modules/auth/totp.service.ts:124`(`twoFactorSecret`), `codebase/backend/src/modules/users/users.service.ts:387`(`lockedUntil`)
  - 상세: TypeORM `update()`/`repository.update()` 는 `undefined` 필드를 SET 절에서 통째로 생략한다.
    `null as unknown as X` → `null` 리터럴로 바뀌는 이번 diff 자체는 런타임 값이 동일해 회귀가
    아니지만, 앞으로 이 필드들의 타입이 `X | null` 로 정직해진 상태에서 실수로 값을 빼먹거나
    조건부 로직을 잘못 짜 `undefined` 를 흘리면 — **소비된 이메일 인증/비밀번호 재설정 토큰이
    DB 에 그대로 남아 재사용(replay)될 수 있다.** 이번 diff 가 추가한 5개 테스트
    (`auth.service.spec.ts:931`·`:1090`, `users-login-attempts.service.spec.ts:129`,
    `schedule-runner.service.spec.ts:230`, `schedules.service.spec.ts:331`)는 전부 `toBeFalsy()`
    대신 `toBeNull()` 로 단언해 이 undefined-회귀를 확실히 잡도록 설계돼 있고, RESOLUTION.md 에
    뮤테이션 검증(RED)까지 기록돼 있다. 방향성은 보안 강화 쪽이다.
  - 제안: 조치 불요 — 긍정적 변경의 기록.

## 관점별 점검 결과

1. **인젝션**: 신규/변경 코드에 외부(사용자) 입력을 받는 경로가 없다. 정적 가드의 정규식은 저장소
   자신의 소스 텍스트만 스캔하며 요청 파라미터·쿼리·쉘 인자를 다루지 않는다. `fs.readFileSync`/
   `fs.readdirSync` 의 경로는 전부 `__dirname` 기준 상대경로로 산출되며 사용자 입력이 개입하지
   않는다 — 경로 탐색(path traversal) 벡터 없음. 변경된 서비스 코드(`auth.service.ts` 등)의
   DB 쓰기는 TypeORM `repository.update(id, {...})` 파라미터 바인딩을 그대로 사용하며 raw SQL
   문자열 조립이 없다. SQL 인젝션 해당 없음.
2. **하드코딩된 시크릿**: 없음. 변경 파일 어디에도 API 키·비밀번호·토큰 리터럴이 없다.
3. **인증/인가**: 변경분은 이메일 인증 토큰·비밀번호 재설정 토큰·2FA secret·로그인 잠금 시각을
   `null` 로 초기화하는 로직의 **타입 표기만** 바꿨다. 조건 분기·검증 순서·해시 비교
   (`comparePassword`/`hashToken`)·트랜잭션 경계 등 인증 로직 자체는 변경되지 않았다. 오히려
   위 발견사항에 적었듯 회귀 방지 테스트가 토큰 재사용 방지라는 보안 속성을 명시적으로 고정한다.
   인증 우회·권한 검증 누락 없음.
4. **입력 검증**: 영향 없음. `validatePasswordStrength`, `isValidBcryptHash` 등 기존 검증 로직은
   diff 범위 밖이며 그대로 유지된다.
5. **OWASP Top 10**: 해당 사항 없음. 순수 타입 시스템 정합화 + 정적 스캔 가드 신설로 새로운
   데이터 흐름이나 신뢰 경계 변경이 없다.
6. **암호화**: 영향 없음. SHA-256 토큰 해시(`hashToken`)·bcrypt 비밀번호 해시 로직·TOTP secret
   저장 방식은 diff 대상이 아니다.
7. **에러 처리**: 영향 없음. 에러 메시지 노출 관련 코드는 변경되지 않았다.
8. **의존성 보안**: 신규 의존성 추가 없음. 전부 Node 내장 `fs`/`path`/`os` 사용.

## 요약

이번 diff(3R)는 `null as unknown as X` 강제 이중 캐스트를 제거하고 엔티티 필드 타입을 `X | null`
로 정직하게 넓히는 순수 타입-레벨 리팩터이며, 1R 에서 발견된 부팅 실패 CRITICAL(컬럼 `type:` 누락)
은 `user.entity.ts` 의 4개 컬럼에 `type: 'varchar'` 명시로 이미 해결돼 있고, 1R 에서 지적된
보안/부작용 WARNING(가드 spec 이 실제 프로덕션 소스 파일을 `writeFileSync` 로 변형)도 `os.tmpdir()`
기반 합성 fixture(`withFixture`)로 완전히 대체돼 해소됐음을 직접 파일을 열어 확인했다. 신규 정적
가드의 정규식은 신뢰 경계 밖 입력을 다루지 않아 ReDoS 를 포함한 인젝션 공격 표면이 실질적으로
없다. 런타임 동작·인증/인가·해시/암호화·에러 처리 로직 자체는 변경되지 않았고, 새로 추가된 5개
회귀 테스트는 오히려 "소비된 토큰이 `undefined` 회귀로 DB 에 남아 재사용되는" 시나리오를 명시적으로
차단하는 방향으로 보안 속성을 강화한다. 3R 에서 실제로 바뀐 코드는 테스트 docstring 문구와 단언
1줄뿐이라(`git show --stat e78b6dbad`) 이 판정에 영향을 주지 않는다.

## 위험도

NONE
