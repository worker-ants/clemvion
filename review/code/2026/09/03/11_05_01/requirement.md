# 요구사항(Requirement) 코드 리뷰

## 검토 범위 및 방법

`POST /api/users/me/change-password` 가 두 서로 다른 실패 조건(OAuth-only 비밀번호 미설정 /
현재 비밀번호 불일치)에 동일 코드 `INVALID_PASSWORD` 를 발행하던 것을, 형제 흐름
(`AuthService.verifyPasswordForUser`, `SessionsService.verifyReauth`)이 이미 쓰던
`PASSWORD_REQUIRED`/`PASSWORD_INVALID` 로 정렬한 변경이다. 이 changeset 은 이미 2회의
`/ai-review` 라운드(`review/code/2026/09/02/22_07_21/`, `review/code/2026/09/03/10_45_22/`)를
거쳤고 WARNING 5건이 모두 조치·재검증됐다는 RESOLUTION 기록이 있다. 본 라운드는 그 주장을
그대로 받아들이지 않고, 핵심 코드(`password.util.ts`·`auth.service.ts`·`sessions.service.ts`·
`users.service.ts`와 대응 unit/e2e 테스트)와 관련 spec 4개 문서
(`spec/5-system/1-auth.md`·`spec/5-system/3-error-handling.md`·`spec/conventions/error-codes.md`·
`spec/2-navigation/9-user-profile.md`)를 저장소에서 직접 열어 line-level 로 재대조했다. 추가로
FE(`change-password/page.tsx`) 전수 grep, `UsersModule`의 `forwardRef` 실측, `User` 엔티티의
`passwordHash` null 처리, CHANGELOG·mdx(ko/en) 문구를 독립적으로 확인했다. 저장소 파일을
수정하는 뮤테이션은 수행하지 않았다(정적 대조만으로 결론에 도달) — `git status --short` 로
확인해도 이 세션이 만든 변경은 없다.

## 발견사항

CRITICAL/WARNING 없음. 코드·spec 간 line-level 불일치를 찾지 못했다. 참고용 INFO 만 기록한다
(전부 이미 앞선 두 라운드가 짚었거나 관측한 것과 동형이며, 조치가 필요하지 않음을 재확인한
항목이다).

- **[INFO]** `PASSWORD_VERIFY_CODES` 상수가 `Object.freeze()` 없이 `as const` 로만 export
  - 위치: `codebase/backend/src/common/utils/password.util.ts:30` (`export const PASSWORD_VERIFY_CODES = { ... } as const;`)
  - 상세: 런타임 변조 방지는 없지만 같은 파일의 `BCRYPT_ROUNDS` 도 동일 패턴이라 이 changeset 이 새로 도입한 리스크가 아니다(2R RESOLUTION #6 과 동일 결론, 독립 재확인).
  - 제안: 조치 불요.

- **[INFO]** `users.service.spec.ts` 의 `codeOf()`/`rejectionOf()` 헬퍼 패턴이 `sessions.service.spec.ts` 의 인라인 try/catch 와 여전히 불일치
  - 위치: `codebase/backend/src/modules/auth/sessions.service.spec.ts:197-213` (인라인) vs `codebase/backend/src/modules/users/users.service.spec.ts` `codeOf`/`rejectionOf` 헬퍼
  - 상세: 두 파일 모두 가드 단언(`expect(thrown).toBeInstanceOf(...)`)을 `catch` **밖**에 정확히 두고 있어 기능적으로는 안전하다(직접 코드를 읽고 확인 — `sessions.service.spec.ts:197-209`가 실제로 `catch` 블록 종료 후 `expect`를 실행한다). 순수 스타일 중복이며 3R maintainability 가 이미 지적한 INFO 와 동형.
  - 제안: 조치 불요(현재 1회성).

## 점검 관점별 확인 내역 (요약)

1. **기능 완전성** — `changePassword` 세 분기(사용자 없음→404 `USER_NOT_FOUND`, 비밀번호 미설정→401 `PASSWORD_REQUIRED`, 불일치→401 `PASSWORD_INVALID`, 성공→강도검증→해시→저장) 모두 구현·테스트됨. 세 발행 지점(`auth.service.ts:74`, `sessions.service.ts:270`, `users.service.ts:292/301`) 모두 `PASSWORD_VERIFY_CODES` 공유 상수를 쓴다.
2. **엣지 케이스** — OAuth-only(`passwordHash === null`) 는 `User.validatePasswordHashFormat()`(entity)이 `null`/`undefined` 를 조기 반환으로 허용해 e2e 의 `UPDATE ... SET password_hash = NULL` 시나리오가 엔티티 검증과 충돌하지 않음을 직접 확인. 대조군 테스트(`[대조군] 두 실패 분기가 서로 다른 코드를 낸다`)로 두 분기가 실제로 다른 코드를 내는지 별도 검증.
3. **TODO/FIXME** — 변경된 6개 코드 파일(`password.util.ts`·`auth.service.ts`·`sessions.service.ts`·`users.service.ts`·`sessions.service.spec.ts` 신규분·e2e 신규분) grep 결과 TODO/FIXME/HACK/XXX 0건.
4. **의도와 구현 간 괴리** — `PASSWORD_VERIFY_CODES` JSDoc 의 "헬퍼를 공유하지 않는 이유는 순환 의존이 아니다" 주장을 `UsersModule`/`UsersController` 의 실제 `forwardRef(() => AuthModule)`/`forwardRef(() => AuthService)` 사용으로 직접 재확인 — 주장과 구현 일치(2R `--impl-done` 반증 이후 3곳이 모두 측정된 근거로 정정돼 있음).
5. **에러 시나리오** — `USER_NOT_FOUND`(404)·`PASSWORD_REQUIRED`(401)·`PASSWORD_INVALID`(401)·강도 위반(`BadRequestException`) 4갈래 전부 unit(`users.service.spec.ts`)·e2e(`users-change-password.e2e-spec.ts`) 양쪽에서 커버.
6. **데이터 유효성** — `comparePassword`/`hashPassword`/`validatePasswordStrength` 호출 순서(비밀번호 존재 확인 → 일치 확인 → 강도 확인 → 해시 → 저장)가 변경 전과 동일하게 유지됨(diff 로 순서 자체는 안 바뀜).
7. **비즈니스 로직** — `error-codes.md §5` 등급 B rename 행, `1-auth.md:339/521/750`, `3-error-handling.md:53/65/66/69`, `9-user-profile.md:147` 6개 spec 위치 모두 저장소 원문과 대조해 코드·status·발행처 서술이 구현과 정확히 일치함을 직접 확인(요약 아래 인용).
8. **반환값** — `changePassword(): Promise<void>` — 성공 시 반환값 없음(controller 가 세션 회전 처리), 4개 실패 경로 전부 예외를 던져 정상 흐름과 명확히 분리됨. 누락된 경로 없음.
9. **spec fidelity** — CRITICAL 급 불일치 없음. 아래 상세.

### spec fidelity 상세 대조

- `spec/conventions/error-codes.md:175` — §5 신규 행 "구 `INVALID_PASSWORD` | 대체 **조건별 2종** `PASSWORD_REQUIRED`/`PASSWORD_INVALID` | 401 | 등급 B" 가 실제 구현(두 코드·401·조건 매핑)과 정확히 일치. §5 머리말 "코드베이스에서 완전 제거" 전제가 이 행엔 성립하지 않는다는 caveat(`login_history.failure_reason` 잔존)도 행 비고에 명시돼 있고, `grep INVALID_PASSWORD codebase/backend/src`로 실제 wire 코드 은퇴(`auth.service.ts:348`의 `failureReason: 'INVALID_PASSWORD'` 만 남고 401 응답 코드로는 미사용)를 재확인.
- `spec/5-system/1-auth.md:339` — "비밀번호 변경 실패 코드" note 가 `changePassword`(passwordHash 부재→`PASSWORD_REQUIRED`, 불일치→`PASSWORD_INVALID`)를 정확히 서술하고, `USER_NOT_FOUND`(404) 불변도 명시 — `users.service.ts:281-303` 구현과 1:1 대응.
- `spec/5-system/1-auth.md:337` — 재인증 에러 코드 note 가 `PASSWORD_INVALID` 공유자 목록에 `UsersService.changePassword` 를 포함(1R 이후 cross_spec WARNING 이 지적했던 발행처 열거 누락이 현재 HEAD 에서는 해소돼 있음을 직접 확인).
- `spec/5-system/3-error-handling.md:65-66` — 카탈로그 표 두 행이 `UsersService.changePassword` 를 공용 소비처로 명시.
- `spec/2-navigation/9-user-profile.md:147` — OAuth-only 계정이 `PASSWORD_REQUIRED`(401)로 막히고 forgot-password → reset-password 안내를 받는다는 서술이 `users.service.ts:291-295` 메시지("비밀번호가 설정되지 않은 계정이에요. 비밀번호 재설정으로 먼저 설정해 주세요.")·mdx 안내 문구와 정확히 대응.
- FE 코드(`codebase/frontend/src`) 전수 grep 결과 `PASSWORD_REQUIRED`/`PASSWORD_INVALID`/`INVALID_PASSWORD` 0건, `change-password/page.tsx` 는 `axiosMessage(err, ...)` 로 서버 `message` 만 노출하고 `error.code` 로 분기하지 않음을 직접 확인 — wire 코드 변경이 1st-party 클라이언트에 영향 없다는 spec/plan 의 주장과 일치.

## 요약

`changePassword` 의 두 실패 분기가 형제 흐름과 동일한 `PASSWORD_REQUIRED`/`PASSWORD_INVALID` 로
정확히 갈리고, 세 발행 지점이 `PASSWORD_VERIFY_CODES` 단일 SoT 상수를 공유하도록 리팩터링됐다.
`USER_NOT_FOUND`(404)·강도 위반(`BadRequestException`) 등 나머지 경로는 변경 없이 보존됐고
반환값 누락 없음. 관련 spec 4개 문서(`error-codes.md §5`·`1-auth.md`·`3-error-handling.md`·
`9-user-profile.md`)를 라인 단위로 직접 대조한 결과 함수 시그니처·에러 코드·HTTP status·발행처
열거·검증 규칙 모두 구현과 line-level 로 일치하며, CRITICAL 급 spec-code 불일치는 발견되지
않았다. 이미 두 차례 리뷰 라운드가 지적한 WARNING(테스트 커버리지 비대칭·CHANGELOG 누락·
`--impl-done` 이 반증한 순환 의존 근거·plan 이월 관련 5건)은 코드·문서·spec 3곳 모두에서
실제로 해소돼 있음을 독립적으로 재확인했다. 남은 항목은 스타일 수준 INFO 2건(상수
`Object.freeze()` 미적용, 형제 spec 파일 간 테스트 헬퍼 추출 비대칭)뿐이며 둘 다 기능적 결함이
아니고 이 changeset 이 새로 도입한 리스크도 아니다.

## 위험도

NONE
