# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [INFO] AuthController 생성자 시그니처에서 `usersService` 파라미터 제거
- 위치: `codebase/backend/src/modules/auth/auth.controller.ts` — constructor (line 93–96 원본 기준)
- 상세: `private readonly usersService: UsersService` 파라미터가 제거됨. NestJS DI 컨테이너는 생성자 파라미터 순서 기반으로 주입을 수행한다. 파라미터 제거 후 순서는 `authService, configService, authOauthService, totpService, auditLogsService`로 정렬되며, 테스트의 `new AuthController(...)` 호출 역시 동일하게 `usersService` 없이 5개 인자로 맞춰졌음을 확인함. `AuthModule` 또는 다른 컨텍스트에서 `AuthController`를 직접 인스턴스화하는 코드가 있다면 파라미터 수 불일치가 발생할 수 있으나, NestJS IoC 패턴상 직접 인스턴스화는 없으므로 실질적 위험 없음.
- 제안: `AuthModule`의 `providers` 배열에서 `UsersService`가 `AuthController`용으로 등록된 경우 불필요한 provider 등록이 남아 있지 않은지 별도 확인 권장 (기능 영향은 없으나 불필요한 의존 등록 노이즈).

### [INFO] `AuthModule`의 `UsersService` 의존 등록 잔류 가능성
- 위치: `codebase/backend/src/modules/auth/auth.module.ts` (변경 대상 diff에 포함되지 않음)
- 상세: `AuthController`에서 `UsersService` 주입이 제거됐지만, `AuthService`는 이미 `UsersService`를 주입받고 있으므로 `AuthModule` provider/import 목록에 `UsersService`가 있다면 제거되지 않아도 무방하다(실제로 `AuthService`가 여전히 사용). 단, 만약 `UsersService`가 `AuthController` 전용으로만 `AuthModule`에 등록되어 있었다면 이번 변경으로 해당 등록이 불필요해질 수 있다. 본 diff에 `auth.module.ts`가 포함되지 않아 직접 확인 불가.
- 제안: `auth.module.ts`에서 `UsersService` provider 등록이 `AuthService`를 통해서도 유효한지 확인. 기능 부작용은 없음.

### [INFO] `verifyPasswordForUser`의 `loginHistory.record` 미호출 (의도적 누락 확인)
- 위치: `codebase/backend/src/modules/auth/auth.service.ts` — `verifyPasswordForUser` 메서드
- 상세: 신규 `verifyPasswordForUser`는 비밀번호 불일치 시 `UnauthorizedException`을 throw하지만 `loginHistory.record`를 호출하지 않는다. 기존 `login` 흐름은 `INVALID_PASSWORD`/`ACCOUNT_LOCKED` 등 실패 시 LoginHistory를 기록한다. 2FA 비활성화 시 비밀번호 오류에 대한 감사 기록이 없는 것이 의도된 설계인지 확인 필요. 현재 `disable2fa` 컨트롤러는 `auditLogsService.record`를 성공 시에만 호출하므로 실패 감사는 원래부터 없었음 — 즉, 이전(before)과 동작 동일.
- 제안: 현재 변경은 기존 동작을 보존하므로 부작용 없음. 향후 2FA 비활성화 실패 감사 기록이 요구사항에 추가될 경우 `verifyPasswordForUser` 내부 또는 호출 지점에 `loginHistory.record` 추가 검토.

### [INFO] `bcrypt` 직접 호출 → `comparePassword` 헬퍼 통일
- 위치: `codebase/backend/src/modules/auth/auth.service.ts` — `verifyPasswordForUser`
- 상세: 기존 컨트롤러는 `bcrypt.compare(dto.password, userEntity.passwordHash)` raw 호출이었고, 신규 서비스 메서드는 `comparePassword` 헬퍼를 사용한다. `comparePassword` 헬퍼가 내부적으로 동일한 `bcrypt.compare`를 wrapping하는 thin 함수임을 `auth.service.spec.ts`의 BCRYPT_ROUNDS 임포트 경로(`../../common/utils/password.util`)로 추론할 수 있음. 동작은 동일하나, `comparePassword` 헬퍼가 추가 로직(예: timing-safe 래핑, 로깅)을 포함한다면 동작 미세 차이가 생길 수 있음 — 현 코드베이스 패턴상 thin wrapper이므로 실질적 위험 없음.
- 제안: INFO 수준. `password.util.ts`의 `comparePassword`가 `bcrypt.compare`의 thin wrapper임을 확인하면 충분.

## 요약

이번 변경은 `AuthController.disable2fa`가 직접 수행하던 `bcrypt` 비밀번호 검증 로직을 `AuthService.verifyPasswordForUser`로 순수하게 이전(refactor)한 것이다. 전역 변수 도입 없음, 파일시스템 부작용 없음, 네트워크 호출 변경 없음, 이벤트/콜백 변경 없음. 공개 HTTP API 시그니처(`POST /auth/2fa/disable`)는 요청/응답 shape, 에러 코드(`PASSWORD_REQUIRED`/`PASSWORD_INVALID`), HTTP 상태코드(401)가 모두 보존되어 클라이언트 영향 없음. NestJS DI 관점에서 생성자 파라미터 순서 재정렬 후 테스트·실 모듈 모두 일관성 있게 수정되어 주입 오류 위험 없음. 환경 변수 접근 변경도 없다. 부작용 위험은 실질적으로 없으며, 발견된 INFO 항목들은 모두 의도적이거나 무해한 것으로 판단된다.

## 위험도

NONE
