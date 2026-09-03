# 문서화(Documentation) 코드 리뷰

## 검토 범위

`change-password` 실패 코드를 형제 흐름(`AuthService.verifyPasswordForUser`)과 정렬하는 변경
(`INVALID_PASSWORD` → `PASSWORD_REQUIRED`/`PASSWORD_INVALID`). 대상 46개 파일 중 애플리케이션
코드·spec·사용자 가이드 문서 15개(`codebase/backend/**` 7개, `codebase/frontend/**` mdx 2개,
`plan/**` 4개, `spec/**` 4개, `scripts/backend-typecheck-baseline.json`)를 실제로 열어 대조했다.
`review/consistency/2026/09/02/{21_12_35,21_26_05,21_40_49}/**` 는 이번 changeset 자체가 만든
`/consistency-check` 산출물(프로세스 아티팩트)이라 이 리뷰의 "문서화 대상"이 아니며, 그 산출물이
이미 지적한 WARNING(§1.2.1 헤더-표 모순, 감사값 출처 캐비어트, `9-user-profile.md` spec_impact
누락 등)은 현재 `HEAD`(`93146d2f2`) 시점에 전부 해소되어 있음을 직접 대조로 확인했다(예:
`spec/5-system/1-auth.md:337` 재인증 note 가 `changePassword` 를 발행처로 반영, `error-codes.md
§5` 신규 행이 "로그인 실패 감사값" 한정어를 포함). 따라서 중복 보고하지 않는다.

## 발견사항

- **[WARNING]** 이 PR 이 `POST /users/me/change-password` 의 wire 에러 코드를 바꾸는(breaking
  가능성이 있는, `error-codes.md §5` 스스로 "등급 B — 잔여 위험 인수"로 명시한) 변경인데도
  `CHANGELOG.md` 에 항목이 없다.
  - 위치: 저장소 루트 `CHANGELOG.md` (이 diff 에 포함되지 않음 — 대상 파일 목록 46개 어디에도
    없다)
  - 상세: `CHANGELOG.md` 는 `## Unreleased — <한 줄 요약>` 형식으로 이 저장소가 실제로 유지하는
    문서다. 직전 커밋들을 표본으로 보면(`git log --oneline -15 -- codebase/backend/src`) 사용자
    가시적 동작 변경을 동반한 `feat`/`fix` 는 대체로 항목을 추가한다 — 특히 바로 이전 커밋
    `d73eff860`(`feat(ws): 소켓 수명을 토큰 수명에 종속 — auth.token_expired 구현`)이 같은 세션
    안에서 2줄을 추가했다. 이번 커밋(`93146d2f2`)은 그와 대칭적인 성격이다 — API 응답 바디의
    `error.code` 값이 바뀌어(`INVALID_PASSWORD` → `PASSWORD_REQUIRED`/`PASSWORD_INVALID`) 그
    코드로 분기하는 외부 클라이언트가 있다면 깨질 수 있고, `error-codes.md §5` 자신이 "워크스페이스
    JWT 로 호출 가능한 내부 REST 라 저장소 밖 호출자를 원리적으로 배제할 수 없다"고 명시한다.
    이 위험 수준의 변경이 spec(`error-codes.md`)·plan 이력에만 남고 `CHANGELOG.md` 에는 남지
    않으면, spec 을 뒤지지 않는 온콜/통합 담당자가 이 변경을 놓치기 쉽다.
  - 제안: `CHANGELOG.md` 에 `## Unreleased — <요약>` 항목을 추가해, 바뀐 코드 쌍
    (`INVALID_PASSWORD` → `PASSWORD_REQUIRED`/`PASSWORD_INVALID`)과 영향받는 엔드포인트
    (`POST /users/me/change-password`)를 명시할 것을 권장한다.

## 확인한 항목 (문제 없음 — 참고용)

- `codebase/backend/src/common/utils/password.util.ts` 의 `PASSWORD_VERIFY_CODES` 상수 JSDoc —
  두 발행처·drift 원인·헬퍼 미공유 이유(순환 의존)를 정확히 기술하며 실제 구현(`UsersService` 가
  `AuthService` 를 주입하지 않음)과 일치.
- `users.service.ts` `changePassword` 의 `@throws` JSDoc 3종이 실제 분기(`USER_NOT_FOUND` →
  `PASSWORD_REQUIRED` → `PASSWORD_INVALID` → 강도 위반)와 정확히 일치, 인라인 주석도 각 분기의
  "왜"(클라이언트 구분 불가·`hasPassword` 신호 부재)를 정확히 설명.
- `users.service.spec.ts` 의 `oauthOnlyUser()` 캐스트 주석 — `User.entity.ts` 실측
  (`@Column({ nullable: true })` vs TS 타입 `string`)과 일치. `codeOf()` 헬퍼 주석의 "상수 대신
  리터럴로 단언" 도 실제 코드(`'PASSWORD_REQUIRED'`/`'PASSWORD_INVALID'` 리터럴, `PASSWORD_VERIFY_CODES`
  미import)와 일치.
- `password-and-sessions.mdx`(ko)·`.en.mdx` — OAuth-only 계정의 "비밀번호 추가 가능" 안내가
  ko/en 양쪽에 대칭적으로 반영되고, `spec/5-system/1-auth.md §1.1.A`·구현(forgot-password →
  reset-password) 양쪽과 일치.
- `spec/5-system/1-auth.md`·`3-error-handling.md`·`spec/conventions/error-codes.md`·
  `spec/2-navigation/9-user-profile.md` 4개 spec 파일의 상호 앵커 링크(`#11a-...`, `#121-2fa--
  webauthn--재인증비밀번호-재확인-코드-...`, `#5-rename-이력-retired-codes` 등)를 실제 heading
  텍스트와 대조 — 전부 정확히 일치. `error-codes.md §5` 은퇴 이력 행도 표 스키마(구 코드|대체
  코드|HTTP|PR|비고)를 따르되 1:1 매핑이 아닌 최초 사례임을 머리말에 명시적으로 일반화해 둠.
- `scripts/backend-typecheck-baseline.json` 의 `total: 199→198` + `users.service.spec.ts` 행
  제거는 파일 자체가 "손으로 고치지 말고 `--update` 스크립트로 재생성" 이라 지시하므로 문서화
  요구사항이 아님(자동 생성 산출물).
- `codebase/backend/README.md` 에는 비밀번호/에러코드 관련 서술이 없어 README 업데이트 불요.
  Swagger(`@ApiUnauthorizedResponse`)는 코드별이 아니라 401 전체를 묶어 서술하는 이 저장소의
  기존 관례(`swagger.md`)를 따르고 있어 DTO 데코레이터 변경도 불요.

## 요약

핵심 코드(`password.util.ts`, `users.service.ts`)의 JSDoc·인라인 주석과 4개 spec 문서 간 교차
참조는 이례적으로 꼼꼼하며 실제 구현과 전수 대조해도 어긋남이 없었다. 사용자 가이드 mdx 도
ko/en 대칭적으로 정확히 갱신됐다. 유일한 갭은 이 저장소가 실제로 유지하는 `CHANGELOG.md` 에
이번 breaking-가능 API 변경 항목이 빠진 것으로, 문서화 관점에서 WARNING 1건으로 기록한다.

## 위험도

LOW
