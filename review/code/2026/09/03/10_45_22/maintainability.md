# 유지보수성(Maintainability) 리뷰

## 리뷰 범위

`change-password` 실패 코드를 형제 흐름(`AuthService.verifyPasswordForUser`)과 정렬하는 변경
(`INVALID_PASSWORD` → `PASSWORD_REQUIRED`/`PASSWORD_INVALID`, 공유 상수 `PASSWORD_VERIFY_CODES`
도입)의 실제 코드/테스트/문서 파일을 검토했다. 이 라운드는 직전 라운드
(`review/code/2026/09/02/22_07_21/`)의 RESOLUTION 이 WARNING 4건·INFO 다수를 반영한 이후 상태이며,
직전 라운드가 지적했던 "테스트 제목이 실제 단언 범위보다 넓다"(INFO)는 이번 diff 에서
`users.service.spec.ts` 의 테스트 제목이 클래스 단언 전용 문구로 좁혀져 해소됨을 확인했다.

검토 대상(애플리케이션 코드·테스트·사용자 문서만 — `plan/**`·`review/**`·`spec/**` 는 이 관점의
"코드"가 아니라 범위에서 제외, 내용은 훑었고 구조적 결함 없음):

- `codebase/backend/src/common/utils/password.util.ts`
- `codebase/backend/src/modules/auth/auth.service.ts`
- `codebase/backend/src/modules/auth/sessions.service.ts` / `sessions.service.spec.ts`
- `codebase/backend/src/modules/users/users.service.ts` / `users.service.spec.ts`
- `codebase/backend/src/modules/users/users.controller.spec.ts`
- `codebase/backend/test/users-change-password.e2e-spec.ts`
- `codebase/frontend/src/content/docs/07-workspace-and-team/password-and-sessions.{mdx,en.mdx}`
- `CHANGELOG.md`

## 발견사항

- **[INFO]** 동일 목적의 "에러 코드값 추출" 테스트 패턴이 형제 파일 사이에서 다르게 구현됨(DRY/일관성)
  - 위치: `codebase/backend/src/modules/auth/sessions.service.spec.ts:203` (신규 `it('비밀번호 불일치 실패 코드는 PASSWORD_INVALID 다', ...)` 내부 인라인 `try { … } catch (err) { const body = (err as UnauthorizedException).getResponse() as { code: string }; expect(body.code).toBe(...) }`) vs `codebase/backend/src/modules/users/users.service.spec.ts:149-157` (같은 목적을 `async function codeOf(promise) {...}` 헬퍼로 추출)
  - 상세: 이 PR 은 "예외 클래스만 단언하면 코드값 drift 를 놓친다" 는 동일한 결함 패턴을 두 형제 파일(`sessions.service.spec.ts`, `users.service.spec.ts`)에 각각 새 테스트로 보강했다. `users.service.spec.ts` 쪽은 반복되는 try/catch-getResponse-cast 로직을 `codeOf()` 헬퍼로 뽑아 이후 4개 테스트가 재사용하지만(`:167`, `:184`, `:194-201` 등), `sessions.service.spec.ts` 쪽은 같은 로직을 인라인으로 한 번 더 썼다. 같은 커밋이 같은 문제의식으로 같은 시점에 작성한 코드인데 한쪽만 리팩터링 원칙(주석에 "단언은 상수가 아니라 리터럴로" 라고 명시한 바로 그 설계 의도)을 헬퍼로 결정화했다. 지금은 `sessions.service.spec.ts` 쪽에 이 패턴이 1곳뿐이라 즉시 문제는 아니지만, 다음 사람이 이 파일에 같은 종류의 테스트를 추가할 때 참고할 만한 재사용 지점이 없어 또 인라인으로 복붙할 가능성이 있다.
  - 제안: 조치 불요(현재 1회성). 이 파일에 코드값 단언 테스트가 하나 더 늘면 `users.service.spec.ts` 의 `codeOf` 와 같은 이름/시그니처의 로컬 헬퍼로 추출하거나, 두 파일이 공유하는 test-utils 로 승격을 고려.

## 긍정적으로 확인된 점 (참고)

- `PASSWORD_VERIFY_CODES` (`password.util.ts`) 는 기존 컨벤션(`BCRYPT_ROUNDS` 등 `as const` export 상수)과 스타일이 일치하고, JSDoc 이 "왜 헬퍼가 아니라 코드값만 공유하는지"(역방향 의존 회피)까지 명시해 다음 사람의 재질문을 막는다.
- `UsersService.changePassword`/`AuthService.verifyPasswordForUser`/`SessionsService.verifyReauth` 세 소비 지점 모두 조건문 중첩 1단계, 함수 길이 적정 — 순환 복잡도 상승 없음. 매직 넘버/문자열도 신규 도입 없음(코드값은 전부 `PASSWORD_VERIFY_CODES` 상수 경유, 안내 메시지는 흐름별로 의도적으로 분리 소유).
- 신규 테스트(`users.service.spec.ts`, `sessions.service.spec.ts`, e2e)가 상수 참조 대신 리터럴 문자열로 기대값을 단언하는 설계 근거(값이 통째로 바뀌어도 소스·테스트가 함께 움직여 못 잡는 취약점 회피)가 주석에 명시돼 있고, 실제로 3개 소비처 전부 이 원칙을 지킨다(직전 라운드 RESOLUTION W1 로 `sessions.service.spec.ts` 까지 확장 완료).
- `users.service.spec.ts` 의 테스트 제목들이 이번 라운드에서 실제 단언 범위와 정확히 일치하도록 정리됨(예: "OAuth-only 계정(passwordHash 부재)은 401 로 막고 저장하지 않는다" — 클래스 단언만 약속, 코드값 단언은 인접 테스트가 별도로 담당) — 직전 라운드 maintainability INFO 가 해소됨.
- mdx 문서(en/ko) 변경이 구조적으로 대응되고 서술 순서·논조가 일치한다.

## 뮤테이션 검증

이번 리뷰는 정적 분석·소스 대조만으로 결론에 도달했고 저장소 파일을 수정하지 않았다.
`git status --short` 로 확인 — 이 세션이 만든 변경은 없다(기존 미커밋 `review/code/2026/09/03/**`,
`review/consistency/2026/09/03/**` 산출물 디렉터리만 untracked로 존재, 이 세션이 만든 것 아님).

## 요약

`INVALID_PASSWORD` 두 조건 병합 버그를 `PASSWORD_VERIFY_CODES` 단일 SoT 상수로 정정한 변경으로,
가독성·네이밍·함수 길이·중첩 깊이·매직 넘버·복잡도·일관성 모든 축에서 양호하다. 직전 라운드가
지적한 유일한 유지보수성 결함(테스트 제목이 단언 범위보다 넓게 약속)은 이번 diff 에서 정확히
해소되었음을 직접 대조로 확인했다. 남은 것은 같은 목적의 테스트 헬퍼가 형제 spec 파일 사이에서
한쪽만 추출되고 한쪽은 인라인으로 남은 사소한 일관성 편차(INFO 1건)뿐이며, 기능적 위험이나 향후
유지보수 비용 증가로 이어질 가능성은 낮다.

## 위험도

NONE
