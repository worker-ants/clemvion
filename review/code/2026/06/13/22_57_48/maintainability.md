# 유지보수성(Maintainability) Review

## 발견사항

- **[INFO]** `authContextFromRequest` 중복 제거 (DRY) — 잘 처리됨
  - 위치: `codebase/backend/src/modules/auth/utils/auth-context.ts` (신규), `auth.controller.ts`/`webauthn/webauthn.controller.ts` (각각 로컬 정의 삭제)
  - 상세: 두 컨트롤러에 복사돼 있던 동일 `authContextFromRequest` 를 단일 유틸로 통합. JSDoc 에 통합 근거(refactor 04 C-1)와 IP 추출 게이트(`extractClientIp`) 의도가 명시됨. 전용 테스트(`auth-context.spec.ts`)도 추가.
  - 제안: 없음. 모범 사례.

- **[INFO]** SRP 분리 — `changePassword` 도메인 로직 controller→service 이전
  - 위치: `users.service.ts` (`changePassword` 신규), `users.controller.ts` (검증·해시 인라인 로직 제거)
  - 상세: 컨트롤러에서 비밀번호 검증/강도/해시/저장이 인라인이던 것을 `UsersService.changePassword` 로 이동. 컨트롤러는 세션 회전·쿠키·감사라는 오케스트레이션 책임만 남김. service JSDoc 에 책임 경계(`@throws` 3종 포함)와 controller 잔류 책임 근거가 명확히 기술됨.
  - 제안: 없음.

- **[INFO]** `BCRYPT_ROUNDS = 12` 매직 넘버 처리 일관성
  - 위치: `users.service.ts:`(상수화), `auth.service.ts` (기존 동일 상수)
  - 상세: 하드코딩이 아닌 명명 상수로 추출됨. 다만 동일한 `const BCRYPT_ROUNDS = 12` 가 `auth.service.ts` 와 `users.service.ts` 양쪽에 중복 정의됨.
  - 제안: 향후 `common/utils/password.util` 같은 공용 위치로 단일화 고려 (이번 변경 범위 밖, 차단 아님).

- **[INFO]** `forwardRef` 순환 의존 — 의도 주석 충실
  - 위치: `auth.module.ts`, `users.module.ts`, `users.controller.ts` 생성자
  - 상세: AuthModule↔UsersModule 순환을 `forwardRef` 로 해소. 세 지점 모두 "왜 순환이 생기는지/무엇을 위임하는지(세션 회전)" 를 주석으로 설명해 향후 독자가 의도를 파악하기 쉬움. `forwardRef` 는 유지보수상 주의 대상이지만 근거가 문서화돼 수용 가능.
  - 제안: 없음.

- **[INFO]** 응답 DTO 의미 변경 (`success` → `accessToken`)
  - 위치: `user-response.dto.ts` `PasswordChangeResultDto`
  - 상세: 불리언 `success` 를 `accessToken` 으로 교체. JSDoc/`@ApiProperty.description` 에 클라이언트 동작(in-memory token 교체)까지 기술. 프론트(`page.tsx`)·테스트도 함께 갱신돼 계약 일관성 유지.
  - 제안: 없음.

- **[INFO]** 매직 IP/문자열은 테스트 한정, 가독성 양호
  - 위치: 각 spec 파일의 `mockReq`/`mock2faReq`(`'5.5.5.5'`,`'7.7.7.7'`,`'9.9.9.9'`), e2e `CLIENT_IP = '203.0.113.9'`
  - 상세: 테스트 픽스처 IP 는 매직 넘버지만 테스트 스코프 한정이고, e2e 는 `CLIENT_IP` 상수화 + `203.0.113.x`(RFC 5737 문서용 대역) 사용으로 의도 명확. mock 객체에 `extractClientIp` 동작(CF-신뢰 off→XFF 첫 IP) 주석이 달려 가독성 좋음.
  - 제안: 없음.

- **[INFO]** 컨트롤러 `changePassword` 함수 길이·중첩
  - 위치: `users.controller.ts` `changePassword`
  - 상세: 도메인 로직 이전으로 길이가 줄고 중첩 if 가 사라져 선형 흐름(위임→쿠키→감사→반환)이 됨. 단계마다 spec 참조 주석이 있어 가독성 향상.
  - 제안: 없음.

## 요약
이번 변경은 리팩터링(refactor 04 후속) 성격으로, 유지보수성을 적극적으로 개선하는 방향이다. (1) 두 컨트롤러에 중복되던 `authContextFromRequest` 를 단일 유틸로 DRY 통합하고, (2) 비밀번호 변경 도메인 로직을 컨트롤러에서 `UsersService` 로 이동해 SRP 를 강화했으며, (3) 매직 넘버(`BCRYPT_ROUNDS`)를 상수화하고 모든 새 메서드에 책임 경계·예외·spec 참조를 담은 JSDoc 을 붙였다. `forwardRef` 순환 의존이 도입됐으나 세 지점 모두 근거가 주석화돼 수용 가능하다. 네이밍·컨벤션·테스트 동반(unit+e2e+frontend)이 기존 코드베이스 패턴과 일관적이다. CRITICAL/WARNING 없음. 미세 개선 여지(`BCRYPT_ROUNDS` 의 auth/users 양쪽 중복)는 범위 밖 INFO 수준.

## 위험도
LOW
