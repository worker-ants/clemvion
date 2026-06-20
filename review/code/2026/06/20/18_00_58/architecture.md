### 발견사항

- **[INFO]** `SessionsService.verifyReauth` — comparePassword 헬퍼화는 적절한 추상화 수준 유지
  - 위치: `sessions.service.ts` 라인 300
  - 상세: `verifyReauth`는 `SessionsService`의 내부 재인증 전용 private 헬퍼로, bcrypt 직접 호출을 `comparePassword`(단일 SoT)로 교체하는 범위를 최소화했다. 이 메서드는 password·TOTP 다중 요소 조합, 오류 코드(`REAUTH_NOT_AVAILABLE`/`REAUTH_REQUIRED`), 메시지 어조("않아요")가 `AuthService.verifyPasswordForUser`와 계약이 다르므로 `verifyPasswordForUser`를 주입하지 않고 primitive 교체만 한 판단은 아키텍처적으로 올바르다. 레이어 침범 없음.
  - 제안: 현행 유지. 향후 TOTP 경로도 공통화가 필요해질 경우 `AuthService.verifyReauth`(재인증 통합 메서드)로 추출 검토 가능하나 현재 범위 밖.

- **[INFO]** `WebAuthnController` — 생성자 의존 제거로 응집도 개선
  - 위치: `webauthn.controller.ts` 생성자
  - 상세: `UsersService` 의존이 `webauthnRegenerateRecovery` 하나에만 필요했고 제거됨으로써 컨트롤러가 직접 사용자 조회·bcrypt 비교를 수행하는 레이어 침범(프레젠테이션 레이어에서 도메인 로직 수행)이 해소됐다. Controller → AuthService(서비스 레이어) 위임은 레이어 책임 분리 원칙에 부합한다.
  - 제안: 현행 유지.

- **[INFO]** `AuthService.verifyPasswordForUser` — 단일 책임 및 재사용성
  - 위치: `auth.service.ts` 라인 59–78
  - 상세: 메서드가 사용자 조회 + 비밀번호 검증을 단일 public 진입점으로 캡슐화하고 있다. `disable2fa`에 이어 `webauthnRegenerateRecovery`까지 같은 진입점을 재사용하는 방향이 일관성 있게 수렴하고 있다. DIP(의존성 역전) 관점에서도 컨트롤러가 `UsersService`, `bcrypt`에 직접 의존하는 대신 `AuthService` 추상에만 의존하도록 역전됐다.
  - 제안: 현행 유지.

- **[INFO]** `password.util.ts` — 해시 알고리즘 교체 범위 단일화
  - 위치: `/codebase/backend/src/common/utils/password.util.ts`
  - 상세: `comparePassword` / `hashPassword` / `BCRYPT_ROUNDS`가 공통 유틸로 모여 있어 해시 알고리즘 교체 시 변경 범위가 단일 모듈로 한정된다. 개방-폐쇄 원칙에 부합하는 구조.
  - 제안: 현행 유지.

- **[INFO]** `webauthn.controller.spec.ts` — 테스트 레이어 경계 명확성
  - 위치: 테스트 파일 전체
  - 상세: `UsersService` mock이 제거되어 컨트롤러 단위 테스트가 실제 컨트롤러 의존 그래프와 정렬됐다. `authService.verifyPasswordForUser` mock을 통한 위임 검증은 레이어 경계 계약을 테스트 레벨에서도 강제한다. 좋은 관행.
  - 제안: 현행 유지.

### 요약

이번 변경은 컨트롤러 레이어에서 도메인 로직(사용자 조회 + bcrypt 비교)을 직접 수행하던 레이어 침범을 `AuthService.verifyPasswordForUser`로 통합해 제거하고, 나머지 서비스 레이어(`SessionsService.verifyReauth`)는 계약 차이를 명확히 판단해 `verifyPasswordForUser` 대신 `comparePassword` 헬퍼 교체에 그치는 분별력 있는 범위 결정을 했다. SOLID 원칙(SRP: 레이어별 책임 분리, DIP: 컨트롤러가 하위 세부 구현에 의존하지 않음), 결합도 감소(컨트롤러에서 UsersService·bcrypt 직접 의존 제거), 레이어 책임 정렬이 모두 개선 방향으로 작동했다. 순환 의존성 없음. 추상화 수준은 적절하며 과도한 추상화 징후 없음. 전체적으로 아키텍처적 결함이 없는 behavior-preserving 리팩토링이다.

### 위험도
NONE
