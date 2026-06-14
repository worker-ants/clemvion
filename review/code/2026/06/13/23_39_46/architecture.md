# 아키텍처(Architecture) 리뷰

## 발견사항

- **[INFO]** `password.util.ts` — DRY 달성: bcrypt rounds 단일 진실 원칙 확립
  - 위치: `/codebase/backend/src/common/utils/password.util.ts` L8, L14–16
  - 상세: `BCRYPT_ROUNDS = 12` 와 `hashPassword()` 를 공통 유틸로 추출해 `auth.service.ts` 와 `users.service.ts` 에 흩어져 있던 `const BCRYPT_ROUNDS = 12` 중복 선언을 제거했다. 리팩터 목표(B-3)를 정확히 달성한다.
  - 제안: 현 구조 유지.

- **[INFO]** `password.util.ts` — 단일 책임 원칙 준수
  - 위치: `/codebase/backend/src/common/utils/password.util.ts` 전체
  - 상세: 해싱(hashPassword) + 강도 검증(validatePasswordStrength) 두 가지 password 도메인 책임만 보유. NestJS 프레임워크 의존은 `BadRequestException` 하나뿐이며, 이는 도메인 정책 예외 표현에 해당하므로 허용 범위다.
  - 제안: 현 구조 유지.

- **[INFO]** `users.service.ts` — 비밀번호 도메인 로직 서비스 계층 통합
  - 위치: `/codebase/backend/src/modules/users/users.service.ts` L61–93 (`changePassword`)
  - 상세: 이전에 컨트롤러에 있던 bcrypt 비교 / 강도 검증 / 해시 / update 로직이 서비스 계층으로 이동했다. 레이어 책임이 명확히 개선되었다. 세션 회전·감사 기록은 컨트롤러 책임으로 분리된다는 설계 근거가 JSDoc에 명시되어 있어 의도적 분리임을 알 수 있다.
  - 제안: 현 구조 유지.

- **[WARNING]** `users.service.ts` — `bcrypt` 직접 임포트 잔존 (불완전한 캡슐화)
  - 위치: `/codebase/backend/src/modules/users/users.service.ts` L8, L81
  - 상세: `hashPassword` 유틸로 쓰기(hash) 경로는 통일됐지만, 읽기(compare) 경로인 `bcrypt.compare()` 는 여전히 `users.service.ts` 에서 직접 호출된다. 같은 이유로 `auth.service.ts` L570에도 `bcrypt.compare()` 직접 호출이 있다. `password.util.ts` 가 비밀번호 관련 단일 진입점이라면 `comparePassword(plain, hash)` 함수도 해당 모듈에 두는 것이 일관성이 더 높다. 현재 구조는 bcrypt 모듈 의존이 세 곳(password.util, users.service, auth.service)에 분산되어 있다.
  - 제안: `password.util.ts` 에 `export function comparePassword(plain: string, hash: string): Promise<boolean>` 를 추가하고, `users.service.ts` 와 `auth.service.ts` 의 `bcrypt.compare()` 직접 호출을 해당 함수로 교체한다. 이렇게 하면 향후 bcrypt → argon2 등 알고리즘 교체 시 변경 범위가 `password.util.ts` 하나로 줄어든다.

- **[INFO]** `auth.service.ts` — God Service 경향은 변경 범위 외, 현 리팩터 목적 달성
  - 위치: `/codebase/backend/src/modules/auth/auth.service.ts` 전체 (1163줄)
  - 상세: `AuthService` 자체는 로그인·회원가입·2FA·OAuth·refresh·비밀번호 재설정 등 다수 책임을 보유해 단일 책임 원칙 위반 가능성이 있으나, 이번 변경의 목적은 bcrypt rounds 중복 제거이고 해당 목적은 정확히 달성됐다. 기존 구조적 문제의 신규 도입은 없다.
  - 제안: `AuthService` 분리(예: `PasswordResetService`, `RegistrationService`)는 별도 리팩터 이슈로 추적 권장. 이번 리뷰 범위에서는 blocker 아님.

- **[INFO]** 테스트(`password.util.spec.ts`) — 구현 계약 검증 구조 양호
  - 위치: `/codebase/backend/src/common/utils/password.util.spec.ts` L48–60
  - 상세: `hashPassword` 테스트가 (1) 평문과 불일치 확인, (2) bcrypt.compare로 교차 검증, (3) `BCRYPT_ROUNDS` 상수를 해시 문자열 파싱으로 검증하는 3단계를 갖춘다. 특히 3번은 비용 인자가 실제 해시에 반영됐는지 확인하는 화이트박스 계약 테스트로, 상수 노출(`export const BCRYPT_ROUNDS`)이 테스트 가능성을 높이는 좋은 설계 결정이다.
  - 제안: 현 구조 유지.

- **[INFO]** 문서(`.mdx`) — 프레젠테이션 레이어 분리 및 spec 연결 적절
  - 위치: `/codebase/frontend/src/content/docs/07-workspace-and-team/password-and-sessions.mdx` frontmatter
  - 상세: 사용자 가이드 문서가 `spec: ["spec/5-system/1-auth.md"]` 와 `code` 배열을 통해 명세-구현 연결을 유지한다. `ImplAnchor` 컴포넌트를 통한 구현 앵커 방식은 문서와 코드 간 추적성을 확보하는 적절한 패턴이다. 문서 자체는 아키텍처 레이어와 무관하다.
  - 제안: 현 구조 유지.

## 요약

이번 변경은 `password.util.ts` 를 단일 진입점으로 확립해 `auth.service.ts` 와 `users.service.ts` 에 중복 선언되어 있던 `BCRYPT_ROUNDS` 상수와 `bcrypt.hash()` 직접 호출을 제거하는 DRY 리팩터다. SOLID 관점에서 단일 책임 원칙과 의존 역전(공통 유틸로 추상화)이 개선되었고, 레이어 책임(비밀번호 도메인 로직의 서비스 계층 통합) 또한 명확해졌다. 유일하게 주목할 점은 해시 쓰기 경로(`hashPassword`)는 유틸로 통합됐지만 해시 비교 경로(`bcrypt.compare`)는 `users.service.ts` 와 `auth.service.ts` 에 직접 임포트로 잔존해 캡슐화가 절반만 완성된 상태이며, `comparePassword` 유틸 함수를 추가해 이를 완결짓는 것을 권장한다. 전체 아키텍처 방향은 올바르고 구조적 퇴행은 없다.

## 위험도

LOW
