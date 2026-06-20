### 발견사항

- **[INFO]** `webauthn.controller.spec.ts` — `authService` 변수 선언 추가 및 `beforeEach` 내 mock 초기화
  - 위치: 라인 391, 399-401
  - 상세: 기존 테스트에서 `authService`를 `{} as unknown as AuthService`로 전달하던 것을 실제 mock 객체로 교체한 변경. 기능 추가 테스트(`webauthnRegenerateRecovery`)를 위한 필수 설정 변경이므로 범위 내 정상 수정.
  - 제안: 해당 없음.

- **[INFO]** `webauthn.controller.spec.ts` — `webauthnService` mock에 `regenerateRecoveryCodes` 추가
  - 위치: 라인 406
  - 상세: 신규 테스트에서 `webauthnService.regenerateRecoveryCodes` 를 mock 해야 하므로 기존 mock 객체에 추가한 것. 범위 내 필수 변경.
  - 제안: 해당 없음.

- **[INFO]** `webauthn.controller.spec.ts` — `UsersService` import 및 생성자 인자 제거
  - 위치: 라인 384(-), 417(-)
  - 상세: `webauthn.controller.ts` 에서 `UsersService` 의존이 제거되었으므로 테스트 코드에서도 일치화한 것. 동반 정리이므로 범위 내.
  - 제안: 해당 없음.

- **[INFO]** `webauthn.controller.ts` — `UnauthorizedException` import가 잔존
  - 위치: 라인 768 (전체 파일 컨텍스트 기준)
  - 상세: `webauthnRegenerateRecovery` 에서 직접 던지던 `UnauthorizedException` 로직을 `authService.verifyPasswordForUser`로 위임한 후, `UnauthorizedException`은 `webauthnRecovery` 메서드(라인 1005)에서 여전히 직접 사용되고 있어 import 잔존은 정당하다. 불필요한 import 잔류 아님.
  - 제안: 해당 없음.

- **[INFO]** `sessions.service.ts` — `bcrypt` → `comparePassword` 교체가 1곳에만 적용됨
  - 위치: 라인 300 (`verifyReauth` private 메서드)
  - 상세: plan 문서 §변경 3에서 명시한 범위(line 246 `bcrypt.compare` → `comparePassword`) 와 일치. `bcrypt` import 전체 제거도 해당 파일에서 `bcrypt`의 유일한 사용처였으므로 적절. 범위 내.
  - 제안: 해당 없음.

### 요약

4개 파일의 변경 모두 plan(`refactor-auth-reverify-unify.md`)에 명시된 3가지 변경 항목과 정확히 대응한다. `webauthn.controller.ts`는 raw bcrypt 블록 13줄을 단일 서비스 위임 1줄로 교체하고 불필요해진 import/생성자 의존을 제거했으며, 테스트 파일은 이 구조 변경에 맞춰 mock을 일치화하고 기존에 커버리지가 없던 `webauthnRegenerateRecovery` 케이스를 신설했다. `sessions.service.ts`는 bcrypt 비교 primitive를 헬퍼 함수로 교체하는 최소 수정만 포함한다. plan 문서 추가(신규 파일)는 worktree 정책 필수 산출물이다. 범위를 벗어난 수정, 불필요한 리팩토링, 포맷팅 변경, 무관한 파일 수정은 발견되지 않는다.

### 위험도

NONE
