# Architecture Review — C-3 AuthController bcrypt → AuthService 이전

## 발견사항

- **[INFO]** 레이어 책임 정렬 성공 (이번 변경의 핵심 목적)
  - 위치: `auth.controller.ts` `disable2fa` 메서드 (구 342–355라인)
  - 상세: `AuthController` 가 직접 보유하던 `usersService.findById` + `bcrypt.compare` 조합이 `AuthService.verifyPasswordForUser` 1줄 위임으로 교체됐다. 프레젠테이션 레이어(Controller)가 인프라 의존성(`bcrypt`, `UsersService`)을 직접 갖는 안티패턴이 해소됐고, 비즈니스 레이어(Service)가 인증 판단의 단일 책임을 독점하게 됐다.
  - 제안: 없음. 이 방향이 올바른 레이어 정렬이다.

- **[INFO]** SRP(단일 책임) 개선 확인
  - 위치: `auth.controller.ts` 생성자 / `auth.service.ts` `verifyPasswordForUser`
  - 상세: `AuthController` 생성자 의존성에서 `UsersService` 가 제거됐다. 컨트롤러의 의존성 그래프가 `AuthService`, `AuthOauthService`, `TotpService`, `AuditLogsService`, `ConfigService` 5종으로 줄어들었으며, 각 의존성이 HTTP 계층의 직접 책임(OAuth 흐름, TOTP 흐름, 감사 기록, 쿠키/도메인 설정)에 해당한다.
  - 제안: 없음.

- **[INFO]** DRY / 중복 제거
  - 위치: `auth.service.ts` `verifyPasswordForUser` / `login`
  - 상세: 신설된 `verifyPasswordForUser` 는 `comparePassword` 헬퍼(`common/utils/password.util.ts`)를 사용해 `login` 과 동일한 단일 진입점으로 수렴했다. 이전에는 `disable2fa` 에서 `bcrypt.compare` 를 직접 호출해 password util 의 단일 진입점 의도(`comparePassword` 주석 참고)를 우회하고 있었다.
  - 제안: 없음.

- **[INFO]** 의존성 역전 — `AuthService` 의 `UsersService` 의존성 중복 없음
  - 위치: `auth.service.ts` 생성자
  - 상세: `AuthService` 는 이미 `UsersService` 를 주입받아 `login`, `loginWithTotp`, `consumeChallengeToken` 등 다수 메서드에서 사용 중이다. 새 `verifyPasswordForUser` 는 기존 의존성을 재활용할 뿐 새 의존성을 추가하지 않는다.
  - 제안: 없음.

- **[INFO]** `AuthService` 의 책임 범위 — God Object 경계 주의 (현재 임계치 미달, 모니터링)
  - 위치: `auth.service.ts` 전체 (~340라인, 메서드 10+ 종)
  - 상세: `AuthService` 는 등록, 이메일 인증, 로그인(일반/TOTP/WebAuthn), 토큰 회전, 비밀번호 재설정, 이메일 재발송, 세션 회전, OAuth 토큰 발급 등을 포함한다. `verifyPasswordForUser` 추가 자체는 미미하나, 향후 민감 작업의 재인증 패턴이 늘어날 경우(예: 이메일 변경, 2FA 재등록) 동일 서비스가 과부하될 여지가 있다. 현재 규모에서는 허용 범위다.
  - 제안: 민감 작업 재인증 패턴이 2건 이상 추가되는 시점에 `SensitiveActionGuard` 또는 `ReauthService` 분리를 검토한다. 현재 단계에서는 조기 추상화가 오히려 복잡도를 높인다.

- **[INFO]** `verifyPasswordForUser` 의 반환 타입 `Promise<void>` — 설계 적절
  - 위치: `auth.service.ts` `verifyPasswordForUser`
  - 상세: 검증 성공/실패를 throw 패턴으로 통보하는 방식은 NestJS 관행과 일치하며, 컨트롤러가 불리언 반환값을 직접 판단하던 이전 안티패턴보다 명확하다. 실패 경로는 `UnauthorizedException` 으로 표면화되고 NestJS Exception Filter 가 처리한다.
  - 제안: 없음.

- **[INFO]** 테스트 레이어 경계 정렬 확인
  - 위치: `auth.controller.spec.ts` / `auth.service.spec.ts`
  - 상세: 컨트롤러 스펙은 `authService.verifyPasswordForUser` 를 mock 으로 처리해 컨트롤러 단위 격리가 유지됐다. 서비스 스펙은 실제 `bcrypt.hash` + `findById` mock 조합으로 경계 계약(에러 코드·상태코드)을 직접 검증한다. 각 레이어가 자신의 책임만 테스트하는 구조다.
  - 제안: 없음.

- **[INFO]** `findUserByVerifyToken` / `findUserByResetToken` — `refreshTokenRepository.manager` 경유로 `User` repo 접근
  - 위치: `auth.service.ts` 3346–3355라인
  - 상세: 이번 변경과 직접 관련 없으나, `verifyPasswordForUser` 가 `usersService.findById` 를 사용하는 것과 달리 두 private 메서드는 `refreshTokenRepository.manager.getRepository(User)` 로 직접 ORM 접근한다. 일관성 관점에서 약간의 계층 혼용이 있으나, 트랜잭션 컨텍스트 공유 목적이 있어 의도된 설계로 보인다. `verifyPasswordForUser` 는 이 패턴을 따르지 않고 `UsersService` 를 사용했으므로 추상화 레벨이 서비스 내에서 혼재한다.
  - 제안: 현재 변경의 범위 밖이므로 이번 PR 에서는 수용한다. 추후 `AuthService` 내 User 접근을 `UsersService` 로 단일화하는 별도 리팩터링 항목으로 등록 고려.

## 요약

이번 변경(C-3)은 `AuthController.disable2fa` 가 직접 수행하던 `bcrypt.compare` + `UsersService.findById` 조합을 `AuthService.verifyPasswordForUser` 로 이관한 명확한 레이어 정렬 리팩터링이다. Controller 가 인프라 의존성(`bcrypt`, 데이터 접근)을 직접 보유하는 레이어 침범이 해소됐고, 비밀번호 비교 경로가 `common/utils/password.util.ts`의 `comparePassword` 단일 진입점으로 통일됐다. SOLID 관점에서 SRP(컨트롤러의 책임 축소) 및 의존성 역전 원칙(컨트롤러가 추상화된 Service 인터페이스만 의존)이 강화됐다. `AuthService` 의 God Object 경향은 현 규모에서는 임계치 미만이며, 행위 동등성(에러 코드·메시지·401 shape 보존)이 테스트로 보증된다.

## 위험도

NONE
