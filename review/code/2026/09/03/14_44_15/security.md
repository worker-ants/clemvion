# 보안(Security) 리뷰

## 대상 요약

이번 diff 는 `entity-nullable-column-type-mismatch` 배치 1 — 엔티티 컬럼이 `nullable: true`
인데 TS 필드가 non-null 로 선언돼 강제되던 `null as unknown as X` 이중 캐스트 8건을 제거하고,
해당 필드 타입을 `X | null` 로 넓힌 순수 타입 정합화 작업이다. 부가로 회귀 방지 가드
(`source-scan.ts::countNullAsUnknownAsCasts` + `repo-guards/__tests__/nullable-type-lie-cast*`)
가 신설됐다. 값 수준(런타임) 동작은 변경 전후 동일하다 — `null as unknown as Date` → `null`
은 둘 다 런타임에는 같은 `null` 값을 대입하며, 컴파일러가 보는 정적 타입만 달라진다. plan
문서에도 "타입 오류 0건 증가" (`strictNullChecks` 켜진 상태) 로 이 사실이 실측돼 있다.

## 발견사항

발견된 CRITICAL/WARNING 급 보안 결함 없음.

- **[INFO]** 테스트가 실제 프로덕션 소스 파일을 런타임에 덮어쓰고 복원한다
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts:84`~`99`
    (함수: `'[대조군] 캐스트를 주입한 파일을 넣으면 offender 로 잡힌다'` 테스트 블록)
  - 상세: 이 테스트는 `fs.writeFileSync` 로 `users.service.ts` (실제 저장소 소스)를 임시로
    변형해 가드가 위반을 잡는지 확인한 뒤 `finally` 로 원복한다. `finally` 블록이 실행되지
    않는 극단적 상황(프로세스 강제 종료·`SIGKILL` 등)에서는 소스 파일이 오염된 채 남을 수
    있다. 이는 애플리케이션의 공격 표면이 아니라 CI/로컬 테스트 실행 환경에 한정된 문제이고,
    주입되는 내용도 정적 문자열(사용자 입력 없음)이라 인젝션 벡터는 아니다. 다만 병렬
    테스트 실행이나 워크트리 공유 환경에서 원복 실패 시 다른 프로세스가 오염된 소스를 빌드/
    배포에 사용할 이론적 가능성은 존재한다.
  - 제안: 심각도가 낮아 필수 수정은 아니나, 원복 실패 시 명시적으로 실패를 알리는 장치(예:
    `afterAll`/`afterEach` 이중 안전망, 또는 `mktemp`로 복제한 임시 파일에 대해 스캔 로직만
    분리 호출)를 고려할 수 있다. `findCastOffenders`가 파일 경로만 받으므로 실제 파일 대신
    임시 디렉터리 사본을 스캔하도록 바꾸면 이 클래스의 리스크 자체가 사라진다.

## 관점별 점검 결과

1. **인젝션**: 신규/변경 코드에 사용자 입력을 받는 경로가 없다(엔티티 타입 선언, 순수 정적
   스캔 유틸, plan 문서). `source-scan.ts` 의 정규식은 저장소 소스 텍스트만 스캔하며 외부
   입력을 다루지 않는다. `users.service.ts` 의 `incrementLoginAttempts` raw SQL(파라미터
   바인딩 `$1/$2/$3`)은 이번 diff 범위 밖(컨텍스트만 노출)이며 변경되지 않았다 — 여전히
   파라미터화돼 있다. 해당 없음.
2. **하드코딩된 시크릿**: 없음. `TotpService.ISSUER = 'Clemvion'` 은 컨텍스트일 뿐 diff 대상이
   아니며 QR 발급자명으로 시크릿이 아니다.
3. **인증/인가**: `auth.service.ts`/`totp.service.ts`/`users.service.ts` 의 변경분은 이메일
   인증 토큰·비밀번호 재설정 토큰·2FA secret·로그인 잠금 시각을 `null` 로 초기화하는 로직의
   **타입 표기만** 바꿨다. 조건 분기·검증 순서·해시 비교(`comparePassword`/`hashToken`) 등
   보안 관련 로직 자체는 변경되지 않았다. 인증 우회·권한 검증 누락 없음.
4. **입력 검증**: 영향 없음. `validatePasswordStrength`, `isValidBcryptHash` 등 기존 검증
   로직은 diff 범위 밖이며 그대로 유지된다.
5. **OWASP Top 10**: 해당 사항 없음. 순수 타입 시스템 정합화로 새로운 데이터 흐름이나 신뢰
   경계 변경이 없다.
6. **암호화**: 영향 없음. SHA-256 토큰 해시(`hashToken`)·bcrypt 비밀번호 해시 로직은 diff
   대상이 아니다.
7. **에러 처리**: 영향 없음. 에러 메시지 노출 관련 코드(`sanitizeErrorMessage`,
   `TotpService.verifyCode` 의 에러 타입명만 로깅하는 처리 등)는 컨텍스트일 뿐 변경되지
   않았다.
8. **의존성 보안**: 신규 의존성 추가 없음.

## 요약

이번 변경은 `null as unknown as X` 강제 이중 캐스트를 제거하고 엔티티 필드 타입을
`X | null` 로 정직하게 넓히는 순수 타입-레벨 리팩터로, 런타임 동작·인증/인가·인젝션·암호화·
에러 처리 등 보안에 영향을 주는 로직 변경이 없다. 신설된 회귀 가드(`nullable-type-lie-cast*`)
도 정적 텍스트 스캔 유틸이라 자체 공격 표면이 없다. 유일하게 언급할 만한 점은 대조군 테스트가
실제 프로덕션 소스 파일을 일시적으로 덮어썼다가 복원하는 방식을 쓴다는 것인데, 이는 보안
취약점이라기보다 테스트 견고성 측면의 낮은 리스크(INFO)다.

## 위험도

NONE
