# 유지보수성(Maintainability) 리뷰 결과

## 발견사항

- **[INFO]** `verifyPasswordForUser` 메서드명이 목적을 명확히 표현함
  - 위치: `codebase/backend/src/modules/auth/auth.service.ts` — `verifyPasswordForUser`
  - 상세: 메서드명이 "사용자 비밀번호를 재확인한다"는 의도를 동사+대상 형식으로 정확히 전달한다. 파라미터명 `userId`, `plainPassword` 도 각각 식별자와 평문 입력임을 명시해 혼동 여지가 없다. 반환 타입 `Promise<void>`도 "성공이면 조용히, 실패면 throw"라는 NestJS 관행 패턴과 일치한다.
  - 제안: 없음.

- **[INFO]** Controller 코드 가독성 크게 향상
  - 위치: `codebase/backend/src/modules/auth/auth.controller.ts` — `disable2fa` 메서드
  - 상세: 기존 11줄(findById + null 체크 + bcrypt.compare + 두 개의 UnauthorizedException throw)이 `await this.authService.verifyPasswordForUser(user.sub, dto.password)` 1줄로 압축됐다. 컨트롤러 메서드의 의도(요청 검증 → 비즈니스 위임 → 감사 기록)가 코드 흐름에서 직관적으로 읽힌다.
  - 제안: 없음.

- **[INFO]** JSDoc 주석 품질이 우수함
  - 위치: `codebase/backend/src/modules/auth/auth.service.ts` — `verifyPasswordForUser` JSDoc
  - 상세: 주석이 메서드의 목적, 이관 배경(refactor 02 C-3), spec 참조(`data-flow/2-auth.md §1.2`), 에러 코드 보존 의도를 모두 포함한다. 향후 이 코드를 접하는 개발자가 왜 이 메서드가 존재하는지, 어떤 에러를 throw 하는지 즉시 파악 가능하다.
  - 제안: 없음.

- **[INFO]** 인라인 주석 `// !user: 사용자 미존재 / !passwordHash: OAuth-only 계정` 추가
  - 위치: `codebase/backend/src/modules/auth/auth.service.ts` — `verifyPasswordForUser` 조건문
  - 상세: `!user || !user.passwordHash` 조건의 두 분기가 각각 다른 비즈니스 상황(미존재 vs OAuth 전용)임을 인라인 주석으로 명시해 가독성을 높였다. 이전 리뷰(INFO #5)에서 요청된 수정이 반영된 것으로 확인된다.
  - 제안: 없음.

- **[INFO]** 테스트 describe 블록 구조 개선
  - 위치: `codebase/backend/src/modules/auth/auth.service.spec.ts` — `describe('verifyPasswordForUser')`
  - 상세: 이전 리뷰(INFO #4)에서 지적된 `(refactor 02 C-3)` 태그가 제거되고 순수 메서드명으로 describe가 구성됐다. 이관 배경은 describe 블록 첫 줄 주석으로 이동해 테스트 구조와 메타 정보가 분리됐다.
  - 제안: 없음.

- **[INFO]** 테스트 케이스 네이밍이 기대 동작을 명확히 서술함
  - 위치: `codebase/backend/src/modules/auth/auth.service.spec.ts` — 각 `it` 설명
  - 상세: `'사용자 미존재 → PASSWORD_REQUIRED (401)'`, `'비밀번호 불일치 → PASSWORD_INVALID (401)'` 형식으로 입력 조건과 기대 결과를 화살표로 구분해 즉시 의도를 파악할 수 있다. `.rejects.toMatchObject` 패턴도 파일 내 다른 테스트 관례와 일치하도록 수정된 것이 확인된다.
  - 제안: 없음.

- **[INFO]** Controller 테스트 mock 구조 단순화
  - 위치: `codebase/backend/src/modules/auth/auth.controller.spec.ts`
  - 상세: `usersService` mock 객체와 `bcrypt` import가 제거되고 `authService.verifyPasswordForUser` mock으로 대체됐다. 컨트롤러 단위 테스트가 실제로 테스트해야 할 범위(위임 호출 여부, 감사 로그 기록)에만 집중하는 구조로 개선됐다.
  - 제안: 없음.

- **[INFO]** `AuthService` God Object 경향 — 현재 임계치 미달, 모니터링 권장
  - 위치: `codebase/backend/src/modules/auth/auth.service.ts` 전체
  - 상세: `verifyPasswordForUser` 추가로 `AuthService`의 책임이 소폭 확대됐다. 현재는 허용 범위이나, 향후 민감 작업 재인증 패턴(이메일 변경, 2FA 재등록 등)이 추가될 경우 `ReauthService` 분리를 검토할 시점이 올 수 있다. 이 점은 이전 architecture 리뷰에서도 동일하게 지적됐다.
  - 제안: 재인증 패턴이 2건 이상 추가되는 시점에 별도 서비스 분리를 검토한다. 현 단계에서는 조치 불필요.

- **[INFO]** `BCRYPT_ROUNDS` 상수 사용으로 매직 넘버 회피
  - 위치: `codebase/backend/src/modules/auth/auth.service.spec.ts` — `bcrypt.hash('CorrectP@ss1', BCRYPT_ROUNDS)`
  - 상세: 테스트에서 bcrypt cost factor를 직접 숫자로 쓰지 않고 `BCRYPT_ROUNDS` 상수를 참조함으로써 매직 넘버 문제를 회피했다. 이전 controller spec에서 `4`를 직접 사용하던 패턴에서 개선됐다.
  - 제안: 없음.

## 요약

이번 변경(C-3)은 유지보수성 관점에서 명확한 개선이다. `AuthController.disable2fa`에 인라인으로 존재하던 11줄의 bcrypt 검증 블록이 `authService.verifyPasswordForUser` 1줄 위임으로 압축되어 컨트롤러 가독성이 크게 향상됐다. 신설된 `verifyPasswordForUser`는 네이밍, 파라미터 명명, JSDoc 주석, 인라인 설명 모두 프로젝트 컨벤션과 일치하며 의도가 명확하다. 테스트 코드 역시 이전 리뷰에서 지적된 패턴 불일치(`.rejects` 관례, describe 태그 잡음)가 수정되어 파일 내 일관성이 확보됐다. `BCRYPT_ROUNDS` 상수 활용으로 매직 넘버 문제도 해소됐다. `AuthService`의 책임 범위가 소폭 확대됐으나 현 규모에서는 허용 범위이므로 추가 조치가 필요한 Critical/Warning 사항은 없다.

## 위험도

NONE

---

STATUS=success ISSUES=0
