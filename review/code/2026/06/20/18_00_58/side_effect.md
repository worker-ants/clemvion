# 부작용(Side Effect) 리뷰

## 발견사항

### 파일 1: sessions.service.ts

- **[INFO]** `import * as bcrypt` 제거 → `comparePassword` 헬퍼 교체
  - 위치: 라인 35-37 (diff)
  - 상세: `comparePassword`는 `/codebase/backend/src/common/utils/password.util.ts`에서 내부적으로 동일한 `bcrypt.compare`를 래핑한다. 동작·해시 알고리즘·반환 타입(`Promise<boolean>`) 모두 동등. 외부 상태 변경 없음.
  - 제안: 없음. 교체는 behavior-preserving.

- **[INFO]** `verifyReauth` 메서드 시그니처 불변
  - 위치: 라인 280-327 (전체 컨텍스트)
  - 상세: `private` 메서드이므로 외부 호출자 영향 없음. 인자 타입·반환 타입·에러 코드·메시지 동일.
  - 제안: 없음.

---

### 파일 2: webauthn.controller.spec.ts

- **[INFO]** 테스트 파일 변경 — 런타임 부작용 없음
  - 위치: 전체 diff
  - 상세: `UsersService` import 제거와 `authService` mock 교체는 테스트 스코프에 한정. `process.env.TRUST_CF_CONNECTING_IP` 삭제는 `beforeEach`에 이미 존재하던 환경 변수 격리 코드로 신규 부작용이 아님.
  - 제안: 없음.

---

### 파일 3: webauthn.controller.ts

- **[INFO]** `UsersService` 생성자 의존성 제거
  - 위치: 라인 721, 66-68 (diff)
  - 상세: `WebAuthnController` 생성자에서 `private readonly usersService: UsersService` 제거. NestJS DI 관점에서 `WebAuthnModule`이 `UsersModule`을 여전히 import하고 있으며(`webauthn.module.ts` 라인 40), `WebAuthnService`가 `UsersService`를 독립적으로 주입받으므로 모듈 레벨 provider 공급에는 변화 없음. 컨트롤러가 `WebAuthnModule`이 아닌 `AuthModule`의 controllers 배열에 등록된 구조이므로 `AuthModule`이 `UsersService`를 제공하는지도 확인 필요하나, `AuthService.verifyPasswordForUser`가 이미 `UsersService`를 내부에서 주입받으므로 컨트롤러 직접 주입 불필요. 런타임 DI 누락 위험 없음.
  - 제안: 없음.

- **[INFO]** `import * as bcrypt` 및 `UnauthorizedException` 내부 사용 변경
  - 위치: 라인 707, 739-742 (diff)
  - 상세: `bcrypt` import 전체 제거. 기존 `webauthnRegenerateRecovery`가 던지던 `PASSWORD_REQUIRED`/`PASSWORD_INVALID` 에러는 이제 `AuthService.verifyPasswordForUser`가 동일 에러 코드·메시지·401 shape으로 재현(`auth.service.ts` 라인 66-77). 에러 응답 계약 보존.
  - 제안: 없음. 단, `UnauthorizedException` import가 파일에 남아 있는지 확인 권장 — 전체 파일 컨텍스트 라인 767에 여전히 import되어 있고 `webauthnRecovery`(라인 1005)에서 사용 중이므로 dead import 없음.

- **[WARNING]** `webauthnRegenerateRecovery` 에러 메시지 미세 차이 가능성
  - 위치: 구 코드 라인 739-742 vs `auth.service.ts` 라인 66-70
  - 상세: 구 컨트롤러 코드는 `'비밀번호 확인이 필요합니다.'`(`PASSWORD_REQUIRED`)와 `'비밀번호가 일치하지 않습니다.'`(`PASSWORD_INVALID`)를 직접 던졌다. `AuthService.verifyPasswordForUser`도 동일 문자열을 사용하므로 현재 구현 기준으로는 동등. 그러나 `AuthService.verifyPasswordForUser`의 메시지가 향후 변경되면 이 엔드포인트도 영향받는 간접 결합이 생겼음. 계획 문서에서 "에러 코드·메시지·401 shape 동일 보존" 을 명시하고 있으므로 허용 범위.
  - 제안: `AuthService.verifyPasswordForUser`에 메시지 변경 시 webauthn regenerate 계약도 영향받음을 주석이나 테스트에 명시하면 좋음. 현재 테스트(`webauthn.controller.spec.ts`)는 에러 타입만 검증하고 메시지를 단언하지 않으므로 메시지 드리프트는 테스트로 잡히지 않음.

---

### 파일 4: plan/in-progress/refactor-auth-reverify-unify.md

- **[INFO]** 계획 문서 신규 생성 — 런타임 부작용 없음
  - 위치: 전체 파일
  - 상세: `plan/` 영역 마크다운. 코드 실행 경로에 영향 없음.

---

## 요약

이번 변경은 `webauthn.controller.ts`의 raw `bcrypt` 직접 호출을 `AuthService.verifyPasswordForUser`로 위임하고, `sessions.service.ts`의 `bcrypt.compare`를 동등 래퍼인 `comparePassword`로 교체하는 behavior-preserving 리팩터다. 전역 변수 신규 도입·파일시스템 부작용·환경 변수 변경·의도치 않은 네트워크 호출·이벤트 변경은 없다. 공개 API(HTTP 엔드포인트·에러 코드·응답 shape)는 유지된다. 유일한 주의점은 `AuthService.verifyPasswordForUser` 메시지가 변경될 경우 `webauthnRegenerateRecovery`의 에러 메시지도 묵시적으로 변경되는 간접 결합인데, 이는 설계 의도(단일진실 원칙)에 따른 허용 결합이며 Critical 수준이 아니다.

## 위험도

LOW
