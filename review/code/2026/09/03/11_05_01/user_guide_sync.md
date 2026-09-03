# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재

`.claude/config/doc-sync-matrix.json` (`rows[]`, 20행) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 본문(§128~186)을 읽었다.

## 변경 개요

`change-password` 실패 코드를 형제 흐름(`AuthService.verifyPasswordForUser`, `SessionsService.verifyReauth`)과 정렬하는 변경. `INVALID_PASSWORD`(단일 코드) → `PASSWORD_REQUIRED`(OAuth-only)/`PASSWORD_INVALID`(불일치) 로 분리, 신규 공유 상수 `PASSWORD_VERIFY_CODES`(`password.util.ts`) 도입. 코드 변경 파일: `password.util.ts`, `auth.service.ts`, `sessions.service.ts`(+`.spec.ts`), `users.service.ts`(+`.spec.ts`), `users.controller.spec.ts`, e2e spec, `CHANGELOG.md`. 나머지는 `plan/**`·`spec/**`·`review/**` 산출물.

## 매칭된 trigger

- **`auth-session-flow-change`** (change_type: "인증·권한·세션 흐름 변경", trigger glob `codebase/backend/src/modules/auth/**`, match: semantic) — `auth.service.ts`·`sessions.service.ts`·`sessions.service.spec.ts` 가 `codebase/backend/src/modules/auth/` 아래에서 직접 매칭된다. `users.service.ts` 의 `changePassword` 는 glob 경로 밖(`modules/users/`)이지만 `PASSWORD_VERIFY_CODES` 를 세 발행처가 공유하는 동일 인증 재확인 흐름이라 semantic 판단으로 같은 trigger 에 포함시켰다.
  - targets (PROJECT.md §149 원문 인용): `codebase/frontend/src/content/docs/07-workspace-and-team/ 의 관련 페이지 + e2e`

## 검증 — 동반 갱신 누락 없음

두 target 모두 **같은 changeset 안에 이미 존재**한다:

1. **docs 페이지** — `codebase/frontend/src/content/docs/07-workspace-and-team/password-and-sessions.mdx` + `.en.mdx` 양쪽이 diff 에 포함되어 있고, "비밀번호를 직접 설정하는 기능은 제공되지 않는다"던 종전 서술을 "비밀번호 추가 가능(forgot-password → reset-password 경로)" 으로 정정했다. ko/en 서술 구조·순서가 대칭이다.
2. **e2e** — `codebase/backend/test/users-change-password.e2e-spec.ts` 에 OAuth-only 분기(`401 PASSWORD_REQUIRED`, 대조군으로 `PASSWORD_INVALID` 아님 단언, 안내 문구 포함, 감사 미기록 확인) 신규 테스트가 추가됐고, 기존 불일치 분기 테스트도 `PASSWORD_INVALID` 로 갱신됐다.

## 나머지 8개 관점 — trigger 미매칭 확인

- **노드 신규 추가 / schema 변경** — `codebase/backend/src/nodes/**` 변경 파일 0건. 해당 없음.
- **신규 UI 문자열(TSX)** — 이번 changeset 에 `*.tsx` 파일 0건(순수 backend + docs mdx + test). 해당 없음.
- **통합/제공자 변경** — 해당 없음.
- **유저 가이드 신규 섹션 디렉토리** — `07-workspace-and-team/` 는 기존 디렉토리이고 신규 디렉토리 생성 없음. `locale.ts` `SECTION_LABELS_BY_LOCALE` 갱신 불요.
- **표현식 언어 변경** — `codebase/packages/expression-engine/**` 변경 없음. 해당 없음.
- **실행·디버깅 흐름 변경** — 해당 없음.
- **신규 warningCode/errorCode 발행** — `codebase/backend/src/nodes/core/error-codes.ts`(new-error-code trigger 의 glob 대상)는 이번 diff 에 포함되지 않았다. `PASSWORD_REQUIRED`/`PASSWORD_INVALID` 는 HTTP 401 인증 재확인 코드로, `codebase/frontend/src/lib/i18n/backend-labels.ts` 의 `ERROR_KO`/`WARNING_KO`(직접 Read 로 확인, `PASSWORD_` 접두 키 0건)가 다루는 노드 실행/워크플로 에러코드 도메인과 다르다. 이전 라운드 `api_contract.md` 리뷰(같은 changeset 에 포함된 산출물)가 change-password 페이지(`profile/change-password/page.tsx`)는 `axiosMessage(err, …)` 로 서버 `message` 를 그대로 노출하고 `error.code` 로 분기하지 않음을 직접 확인해 뒀다 — FE 가 이 코드를 `ERROR_KO` 조회 경로로 소비하지 않으므로 매핑 누락이 사용자에게 영문 노출로 이어지는 경로가 없다. 매핑 불요.

## 발견사항

없음 — 매칭된 유일한 trigger(`auth-session-flow-change`)의 동반 갱신(07-workspace-and-team 페이지 ko/en + e2e)이 같은 changeset 안에서 이미 완료되어 있다.

## 요약

매트릭스 20행 중 이번 changeset 에 매칭되는 trigger 는 `auth-session-flow-change` 1건뿐이며, 그 target(07-workspace-and-team 관련 페이지 ko/en + e2e)이 같은 changeset 안에서 이미 동반 갱신되어 있어 누락이 없다. 나머지 8개 점검 관점(노드/스키마/TSX/통합/신규 섹션/표현식/실행-디버깅/warning·error 코드 매핑)은 대응하는 변경 파일이 이번 changeset 에 존재하지 않아 해당 없음으로 판정했다. `error-codes.ts`(ErrorCode enum) 미변경 + `backend-labels.ts` ERROR_KO/WARNING_KO 도메인 밖(HTTP 인증 코드이며 FE 가 `error.code` 를 소비하지 않음)을 직접 확인해 CRITICAL 후보였던 항목도 배제했다.

## 위험도

NONE
