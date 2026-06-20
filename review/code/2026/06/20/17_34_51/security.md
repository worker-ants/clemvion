# 보안(Security) 리뷰 결과

## 발견사항

### - [WARNING] 2FA 비활성화 엔드포인트에 브루트포스 제한 없음
  - 위치: `codebase/backend/src/modules/auth/auth.service.ts` — `verifyPasswordForUser`, `codebase/backend/src/modules/auth/auth.controller.ts` — `disable2fa`
  - 상세: `POST /auth/2fa/disable` 은 유효한 JWT를 보유한 인증된 공격자가 `dto.password` 필드를 무제한 시도할 수 있다. `verifyPasswordForUser` 는 비밀번호 불일치 시 단순히 `UnauthorizedException` 을 던질 뿐, `incrementLoginAttempts` / `loginHistory` 호출이나 `@Throttle` 데코레이터가 없다. 이는 **C-3 가 도입한 신규 취약점이 아니라 기존 컨트롤러(`bcrypt.compare` 직접 호출 시절)와 동일한 pre-existing 동작**이다. 단, 로직이 서비스로 이관되면서 향후 여러 엔드포인트(webauthn, sessions 등)가 동일 메서드를 재사용할 예정이므로 브루트포스 보호를 추가할 최적의 단일 지점이 명확해졌다.
  - 제안: `verifyPasswordForUser` 내 또는 `disable2fa` 핸들러에 `@Throttle` 을 적용하거나, 비밀번호 실패 시 `incrementLoginAttempts` 를 호출하는 별도 보안 작업으로 처리. 본 C-3 PR 의 behavior-preserving 범위를 벗어나므로 후속 작업으로 등재하되 추적이 필요하다(이미 plan 에 명시됨).

### - [INFO] 타이밍 사이드채널 위험 — 사용자 미존재/passwordHash 없음 분기에서 bcrypt 연산 생략
  - 위치: `codebase/backend/src/modules/auth/auth.service.ts` — `verifyPasswordForUser` (lines 283–295)
  - 상세: 사용자가 미존재하거나 `passwordHash` 가 없으면 즉시 `UnauthorizedException` 을 던지고 `comparePassword` (bcrypt) 를 실행하지 않는다. bcrypt 는 수십~수백 ms 의 연산 비용이 있으므로, 응답 시간 차이를 통해 공격자가 계정 존재 여부를 추론할 수 있는 타이밍 오라클이 형성된다. `disable2fa` 는 인증된 JWT 사용자에게만 노출되므로 미인증 열거 공격의 위험은 낮지만, JWT 탈취 시나리오나 OAuth 계정 정찰에는 해당될 수 있다. 기존 컨트롤러 코드도 동일 패턴이었으므로 회귀가 아니다.
  - 제안: 위험 허용 범위 판단 후, 보호 수준을 높이려면 `!user || !passwordHash` 분기에서도 더미 bcrypt 비교(`comparePassword('dummy', DUMMY_HASH)`)를 실행해 응답 시간을 균일화하는 방어적 패턴 적용을 고려. 현재 인증 필요 엔드포인트 특성상 즉각 조치 불필요.

### - [INFO] `comparePassword` 함수의 파라미터 순서 — 평문·해시 순서 명시 검증
  - 위치: `codebase/backend/src/common/utils/password.util.ts` line 22, `codebase/backend/src/modules/auth/auth.service.ts` line 289
  - 상세: `comparePassword(plainPassword, user.passwordHash)` — 평문이 첫 번째, 해시가 두 번째 파라미터. `bcrypt.compare(plain, hash)` 의 표준 인터페이스와 일치하며, 순서 역전 오용 없음 확인. 이 역전(hash를 plain 위치에 넣는 오류)은 bcrypt 가 silent false를 반환할 수 있어 인증 우회로 이어지므로 명시적으로 검증.
  - 제안: 현재 구현 올바름. 추가 조치 불필요.

### - [INFO] 에러 응답에서 민감 정보 노출 여부 확인
  - 위치: `codebase/backend/src/modules/auth/auth.service.ts` — `verifyPasswordForUser`
  - 상세: 에러 메시지는 `'비밀번호 확인이 필요합니다.'` / `'비밀번호가 일치하지 않습니다.'` 로 사용자 의도에 맞는 일반 메시지다. 스택 트레이스, 내부 쿼리, 해시 값, 사용자 ID 등 민감 데이터가 에러 응답에 포함되지 않는다. NestJS Exception Filter 가 `UnauthorizedException.response` 를 그대로 직렬화하므로 `{ code, message }` 구조만 클라이언트에 전달된다.
  - 제안: 현재 구현 안전. 추가 조치 불필요.

### - [INFO] bcrypt cost factor 적절성
  - 위치: `codebase/backend/src/common/utils/password.util.ts` line 8
  - 상세: `BCRYPT_ROUNDS = 12`. OWASP 권고(최소 10, 권장 12)를 충족한다. 테스트 파일(`auth.service.spec.ts`)에서도 `BCRYPT_ROUNDS` 상수를 임포트해 사용하므로 cost factor 단일 진실 원칙이 유지된다. 이전 컨트롤러 테스트는 rounds=4 를 하드코딩해 상수를 우회했으나, 이번 변경으로 상수 기반으로 통일되었다.
  - 제안: 현재 구현 적절. 추가 조치 불필요.

### - [INFO] 하드코딩된 시크릿 부재 확인
  - 위치: 변경된 전체 파일
  - 상세: 변경 범위 내에서 API 키, 토큰, 비밀번호, 인증서 등 하드코딩된 시크릿 없음. 테스트 파일의 `'OldP@ssw0rd1'` / `'CorrectP@ss1'` / `'WrongP@ss1'` 은 테스트 픽스처 평문으로, 프로덕션 코드에 포함되지 않으며 공개 리포지토리 맥락에서 무해하다.
  - 제안: 해당 없음.

### - [INFO] 인증/인가 레이어 보존 확인
  - 위치: `codebase/backend/src/modules/auth/auth.controller.ts` — `disable2fa` 데코레이터
  - 상세: `disable2fa` 핸들러가 `@JwtAuthGuard` 등 인증 가드를 통해 보호되고 있으며, 변경은 가드 설정을 건드리지 않는다. `user.sub` 는 JWT 페이로드에서 추출된 검증된 식별자이며, `verifyPasswordForUser(user.sub, dto.password)` 로 전달 — 사용자 입력(dto)에서 userId를 가져오는 IDOR 패턴이 아님.
  - 제안: 해당 없음.

## 요약

이번 C-3 변경은 `AuthController.disable2fa` 의 인라인 bcrypt 비교 로직을 `AuthService.verifyPasswordForUser` 로 이관하는 순수 레이어 정렬 리팩터링이다. 보안 관점에서 **신규 취약점은 도입되지 않았으며** 기존 동작이 정확하게 보존되었다. 주목할 사항은 bcrypt cost factor가 `BCRYPT_ROUNDS=12` 상수로 통일되어 이전 테스트의 rounds=4 하드코딩 우회가 해소된 점(개선)과, `comparePassword` 유틸 단일 진입점으로 수렴되어 향후 해시 알고리즘 교체 시 변경 범위가 축소된 점(개선)이다. 잔존 위험은 2FA 비활성화 엔드포인트의 브루트포스 제한 부재(pre-existing, 계획에 후속 작업으로 명시됨)와 타이밍 사이드채널(인증된 사용자 전용 엔드포인트라 위험도 낮음)로, 모두 이번 PR 도입이 아닌 기존 패턴이다.

## 위험도

LOW

---

STATUS=success ISSUES=2
