# 유지보수성(Maintainability) 리뷰

## 리뷰 범위

`PASSWORD_REQUIRED`/`PASSWORD_INVALID` 형제 코드 정렬(구 `INVALID_PASSWORD` 은퇴) 변경 중
실제 코드 파일을 중심으로 검토했다. `plan/**`·`spec/**`·`review/consistency/**` 아래 문서 파일들은
계획·근거 기록이며 "코드" 의 가독성/복잡도/중복 기준이 적용되는 대상이 아니라 이번 리뷰의 핵심
범위에서 제외했다(내용은 훑었고 구조적 결함 없음).

- `codebase/backend/src/common/utils/password.util.ts`
- `codebase/backend/src/modules/auth/auth.service.ts`
- `codebase/backend/src/modules/auth/sessions.service.ts`
- `codebase/backend/src/modules/users/users.service.ts`
- `codebase/backend/src/modules/users/users.service.spec.ts`
- `codebase/backend/src/modules/users/users.controller.spec.ts`
- `codebase/backend/test/users-change-password.e2e-spec.ts`
- `codebase/frontend/src/content/docs/07-workspace-and-team/password-and-sessions.{mdx,en.mdx}`

## 발견사항

- **[INFO]** 테스트 제목이 실제로 단언하지 않는 내용을 약속한다
  - 위치: `codebase/backend/src/modules/users/users.service.spec.ts:159` (`it('OAuth-only 계정(passwordHash 부재)은 PASSWORD_REQUIRED 를 낸다', ...)`)
  - 상세: 이 테스트의 본문은 `UnauthorizedException` 클래스와 `repo.update` 미호출만 확인하며, 실제 `code` 값(`PASSWORD_REQUIRED`)은 단언하지 않는다. 그 값 검증은 바로 다음 테스트(`:167`, `'OAuth-only 실패 코드는 형제 흐름과 같은 PASSWORD_REQUIRED 다'`)가 별도로 수행한다. 제목만 읽으면 이 테스트 하나로 코드 값까지 커버된다고 오인하기 쉽다 — 리팩터링 중 "이 테스트가 있으니 코드 값은 이미 지켜진다" 고 잘못 판단해 옆 테스트를 지울 위험이 있다.
  - 제안: 제목을 본문에 맞춰 `'OAuth-only 계정(passwordHash 부재)은 UnauthorizedException 을 던진다'` 처럼 클래스 단언만 약속하는 문구로 좁히거나, 반대로 이 테스트에 `codeOf` 를 써서 코드값 단언을 합쳐 제목과 본문을 일치시킨다(불일치 쌍 `:176`/`:184` 도 동일 패턴이라 함께 정리하면 일관된다).

- **[INFO]** 동일 `mockResolvedValue(oauthOnlyUser())` / `mockResolvedValue(await userWithHash())` arrange 블록이 인접한 4~5개 테스트에 반복
  - 위치: `codebase/backend/src/modules/users/users.service.spec.ts` — `changePassword` describe 블록 전체 (예: `:160`, `:168`, `:194`, `:201`)
  - 상세: 각 `it` 가 독립적으로 `repo.findOne.mockResolvedValue(...)` 를 반복 호출한다. Jest 테스트에서 흔한 arrange-act-assert 반복이라 심각도는 낮고, PR 자체가 "종전 테스트가 클래스만 보고 drift 를 놓쳤다" 는 교훈에서 의도적으로 세분화한 것이라 근거도 명확하다. 다만 앞으로 실패 분기가 하나 더 늘면 이 반복 폭이 커진다.
  - 제안: 지금은 조치 불요. 세 번째 분기가 추가되는 시점에 `beforeEach` 또는 파라미터화된 `it.each` 로 통합을 고려.

## 긍정적으로 확인된 점 (참고)

- `PASSWORD_VERIFY_CODES` 상수 도입은 기존 컨벤션(`AUTH_OAUTH_PROVIDERS`, `USER_LOCALES`, `USER_THEMES` 등 `as const` export 객체/배열)과 스타일이 일치한다.
- 왜 헬퍼 자체가 아니라 코드 상수만 공유하는지(순환 의존 회피)를 JSDoc 에 명시해 다음 사람이 "왜 `UsersService` 가 `AuthService.verifyPasswordForUser` 를 직접 호출하지 않는가" 를 재질문하지 않도록 막아 둔 점이 좋다.
- 테스트에서 상수가 아니라 리터럴 문자열로 기대값을 단언하는 선택(`codeOf` 헬퍼 주석에 근거 명시) — 소스와 테스트가 같은 상수를 공유해 값이 통째로 바뀌어도 함께 움직여 아무것도 못 잡는 취약점을 피한다. 근거가 검증 가능한 형태로 코드에 남아 있다.
- `changePassword`/`verifyPasswordForUser`/`verifyReauth` 세 호출부 모두 조건문 중첩 1단계, 함수 길이도 적정 수준을 유지한다. 순환 복잡도 상승 없음.
- 메시지 문자열은 호출부마다 다르게 유지(코드만 공유)한다는 설계가 일관되게 지켜졌다 — 세 곳 모두 같은 패턴(`code: PASSWORD_VERIFY_CODES.X, message: '<흐름별 안내>'`).
- mdx 문서 두 언어(en/ko) 변경이 구조적으로 대응되며 서술 순서·논조가 일치한다.

## 뮤테이션 검증

이번 리뷰에서는 저장소 파일을 수정하는 검증이 필요하지 않았다(정적 분석만으로 결론에 도달). 저장소
트리에 쓰기 작업 없음 — `git status --short` 확인 불필요.

## 요약

`INVALID_PASSWORD` 두 조건 병합으로 발생했던 실제 버그(OAuth-only 사용자에게 "비밀번호가 틀렸다" 고 잘못 안내)를 `PASSWORD_VERIFY_CODES` 단일 SoT 상수로 근본 정정한 변경이다. 상수 도입이 기존 코드베이스 컨벤션(`as const` export 패턴)과 일치하고, 헬퍼를 공유하지 않는 이유(순환 의존)·코드만 공유하고 메시지는 호출부가 소유하는 이유가 주석에 명확히 남아 있어 다음 유지보수자가 재질문할 필요가 없다. 함수 길이·중첩 깊이·매직 넘버·복잡도 모두 양호하며, 새로 추가된 테스트들은 "예외 클래스만 같아서 drift 를 놓쳤다" 는 과거 결함을 정확히 겨냥해 코드값·형제 비교·대조군까지 계층적으로 보강했다. 유일한 흠은 테스트 제목이 실제 단언 범위보다 넓게 약속하는 지점 한 곳(INFO)으로, 기능적 결함이 아니라 다음 사람이 커버리지를 오판할 수 있는 문서적 리스크에 그친다.

## 위험도

NONE
