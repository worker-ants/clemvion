# Dependency Review — C-3 AuthController bcrypt → AuthService 이전

## 발견사항

- **[INFO]** 새 외부 패키지 추가 없음
  - 위치: `codebase/backend/package.json`
  - 상세: 이번 변경은 외부 의존성을 추가하지 않는다. `bcrypt` (`^6.0.0`)·`@types/bcrypt` (`^6.0.0`)는 기존부터 존재하며, 제거된 것도 없다. 패키지 파일 자체에 변경이 없다.
  - 제안: 해당 없음.

- **[INFO]** `import * as bcrypt from 'bcrypt'` 제거 — Controller 레이어 의존 정리
  - 위치: `auth.controller.ts` (diff -2줄), `auth.controller.spec.ts` (diff -1줄)
  - 상세: `bcrypt`의 직접 사용이 `AuthController`에서 제거되고 `AuthService.verifyPasswordForUser`로 위임되었다. `bcrypt`는 여전히 `password.util.ts`를 통해 `AuthService` 레이어에서만 사용되므로, 의존 그래프가 정리된다 (Controller → bcrypt 직접 결합 제거).
  - 제안: 해당 없음 — 올바른 방향.

- **[INFO]** `UsersService` import 제거 — Controller의 불필요한 횡단 의존 해소
  - 위치: `auth.controller.ts` (diff -2줄), `auth.controller.spec.ts` (diff -1줄)
  - 상세: `AuthController`가 `UsersService`를 직접 주입받을 이유가 없어졌다. `disable2fa` 내의 `usersService.findById` 호출이 `AuthService` 위임으로 대체되면서 내부 모듈 간 의존 관계가 개선되었다. `UsersService`는 이미 `AuthService`가 보유하고 있으며, 이중 참조가 해소된다.
  - 제안: 해당 없음 — 레이어 정렬 개선.

- **[INFO]** 내부 의존성 변경: AuthController → AuthService 단방향 위임 강화
  - 위치: `auth.controller.ts` constructor, `auth.service.ts` `verifyPasswordForUser`
  - 상세: `AuthController`가 `AuthService`·`AuthOauthService`·`TotpService`·`AuditLogsService`·`ConfigService`만을 주입받는 구조로 단순화되었다. `password.util.ts`의 `comparePassword`/`hashPassword`/`BCRYPT_ROUNDS`는 `AuthService` 및 테스트(auth.service.spec.ts의 `BCRYPT_ROUNDS` 직접 import)에서만 사용하며, 단일 진입점 설계가 유지된다.
  - 제안: 해당 없음.

- **[INFO]** `bcrypt` 버전 `^6.0.0` — caret 범위 고정
  - 위치: `codebase/backend/package.json` line 58
  - 상세: `^6.0.0` caret 표기는 minor/patch 자동 업그레이드를 허용한다. 이번 변경과 직접 관련은 없으나, 암호화 라이브러리의 특성상 major 변경만 차단된다. pnpm workspace 환경에서 lockfile이 실제 버전을 고정하므로 재현성은 확보되어 있다.
  - 제안: 현 정책 유지 가능. 보안 패치 자동 적용을 위해 caret 범위가 의도적이라면 lockfile 갱신 주기를 관리하면 충분하다.

## 요약

이번 변경(C-3 refactor)은 외부 의존성을 추가·제거하지 않는다. `bcrypt` 및 `UsersService`를 `AuthController`에서 직접 참조하던 레이어 침범이 해소되고, bcrypt 비교 로직이 `password.util.ts`의 `comparePassword` 헬퍼를 경유하는 `AuthService.verifyPasswordForUser`로 단일화되었다. 내부 모듈 간 의존 관계가 명확해지고, 컨트롤러가 서비스 레이어를 통해서만 암호화 연산에 접근하도록 그래프가 정리되었다. 새로운 보안 취약점, 라이선스 문제, 버전 충돌은 발견되지 않았다.

## 위험도

NONE
