# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

대상: `feat(users): 아바타 이미지 업로드 — 공개 버킷 + 공개 URL` (커밋 `d51954999`, 11개 변경 파일 — CHANGELOG.md, `.env.example`, `s3.config.ts`, `s3.service.ts`, `users-avatar.service.spec.ts`, `users.controller.ts`, `users.module.ts`, `users.service.spec.ts`, `users.service.ts`, 그리고 plan 2건).

## 발견사항

- **[WARNING]** 신규 env var `S3_PUBLIC_BASE_URL` 이 README.md 의 "환경 변수" 섹션에 반영되지 않음
  - 변경 파일: `codebase/backend/.env.example` (147~157행 부근, `S3_PUBLIC_BASE_URL=http://localhost:9000` 신설 + 배포 선행조건 경고 주석), `codebase/backend/src/common/config/s3.config.ts` (`publicBaseUrl` 필드 신설)
  - 매트릭스 항목: `env-runtime-change` — "환경 변수·기동 방법·런타임 변경 (제품 최종 상태)" → targets: `README.md`
  - 누락된 동반 갱신: `README.md` "## 환경 변수" → "**Backend**" 코드 블록의 "S3 / MinIO" 항목 (`S3_ENDPOINT`/`S3_ACCESS_KEY`/`S3_SECRET_KEY`/`S3_BUCKET`/`S3_REGION` 나열 뒤 신규 var 미추가). 실측: `grep -n S3_PUBLIC_BASE_URL README.md` → 0건.
  - 상세: `.env.example` 자체 주석과 CHANGELOG 는 이 var 를 "배포 선행 조건(코드 밖)" 으로 명시한다 — 미설정 시 `S3_ENDPOINT`(백엔드 내부 SDK 주소)로 폴백하는데, 그 폴백은 "단일 호스트 개발 환경에서만" 맞는 가정이고 실제 배포(멀티 호스트/컨테이너) 환경에서는 아바타 업로드는 성공하지만 **이미지 표시만 403** 이 되는 조용한 실패로 이어진다. README 의 S3 섹션은 개별 var 를 나열하는 형식(`S3_*` 와일드카드가 아님 — 과거 `HEALTH_CHECK_LOG` 추가 시에도 개별 var 를 그 형식의 목록에 추가한 선례가 있다)이라, 신규 var 가 그 목록에 없으면 로컬 셋업만 참고하는 개발자·self-hosting 배포자가 이 var 의 존재 자체를 놓치기 쉽다.
  - 제안: README.md 208~212행 S3 블록에 `S3_PUBLIC_BASE_URL` 한 줄 추가 (+ 배포 시 브라우저 도달 가능한 공개 도메인/CDN 을 써야 한다는 한 줄 caveat).

- **[INFO]** 신규 REST 엔드포인트 `POST /api/users/me/avatar` 가 `codebase/frontend/src/content/docs/` 유저 가이드 MDX 에 반영되지 않음 (그러나 확정적 gap 은 아님)
  - 변경 파일: `codebase/backend/src/modules/users/users.controller.ts` (`uploadAvatar`, `@Post('me/avatar')`)
  - 매트릭스 항목: `backend-api-change` — trigger `codebase/backend/src/**/*.controller.ts` → targets: "(a) controller·DTO 의 swagger jsdoc (b) API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지"
  - (a) 는 완전히 충족됨 — `@ApiOperation`/`@ApiConsumes`/`@ApiBody`/`@ApiOkWrappedResponse`/`@ApiBadRequestResponse`/`@ApiPayloadTooLargeResponse`/`@ApiUnauthorizedResponse`/`@ApiNotFoundResponse` 전부 신설됐고 공개 오브젝트라는 사실까지 description 에 명시했다. gap 없음.
  - (b) 가 회색지대: 이 changeset 에 **frontend 파일이 전혀 포함되지 않았다** — 실측: `codebase/frontend/src/app/(main)/w/[slug]/profile/components/profile-info-card.tsx` 를 열어보면 아바타는 여전히 이니셜 원형 아바타(`getInitials`)만 렌더하고, 업로드 버튼·파일 input·이미지 표시 전부 없다. 즉 이 엔드포인트를 호출하는 UI 자체가 아직 없다 — 사용자가 실제로 쓸 수 있는 "안내할 GUI 흐름"이 존재하지 않으므로 지금 시점에 `content/docs/07-workspace-and-team/` MDX 를 갱신하면 실재하지 않는 UI 를 서술하게 된다(PROJECT.md 가 명시적으로 금지하는 "향후 진행 예정 사항 언급" 과 대칭되는 문제 — 반대로 "아직 없는 것을 있다고" 적는 오류).
  - `spec/2-navigation/9-user-profile.md` 의 "미구현 (Planned)" 배지 flip 은 `plan/in-progress/spec-update-avatar-upload-implemented.md` 로 planner 트랙에 올바르게 위임됐다(developer 는 `spec/` 쓰기 권한 밖 — CLAUDE.md 자기-반증형 소정정 예외에도 미해당, 그 문장이 developer 가 쓴 예고가 아니라 제품 정의 서술이기 때문). 다만 그 plan 파일은 `spec/2-navigation/9-user-profile.md` 만 스코프로 잡고 있고 `codebase/frontend/src/content/docs/` (실제 렌더링되는 유저 가이드) 갱신은 언급이 없다 — frontend UI 가 붙는 후속 PR에서 그 시점에 함께 처리될 사안으로 보이나 명시적으로 트래킹되지는 않는다.
  - 제안: 확정 조치 불요(현재는 무의미한 문서화가 될 것). 다만 후속 아바타 업로드 UI PR 착수 시 `codebase/frontend/src/content/docs/07-workspace-and-team/` 에 "프로필 이미지 업로드" 절 신설(+ `<ImplAnchor kind="ui-entry">`)을 그 PR 의 동반 갱신 체크리스트에 명시적으로 남겨 두면 사후 `docs(user-guide):` 보정 패턴을 예방할 수 있다.

- 확인했으나 gap 아님 (참고):
  - 신규 REST 에러 코드 `INVALID_FILE_TYPE` (`users.service.ts`, `BadRequestException({code: 'INVALID_FILE_TYPE'})`) — `backend-labels.ts` 의 `ERROR_KO`/`WARNING_KO` 는 노드 실행(zod ui label·warningRules·`nodes/core/error-codes.ts` `ErrorCode` enum) 스코프이고, 이 REST 레벨 코드는 같은 컨트롤러의 기존 `USER_NOT_FOUND`/`INVALID_PASSWORD` 와 동일 패턴(그 어느 쪽도 `backend-labels.ts` 에 없음) — 매트릭스 `new-error-code`/`new-warning-code` 트리거(글롭이 `error-codes.ts` 로 좁혀져 있음)와 무관.
  - `codebase/frontend/**/*.tsx` 변경 없음 → `new-ui-string` i18n parity 무관.
  - `codebase/backend/src/nodes/**` 변경 없음 → `new-node`/`node-schema-change` 무관.
  - `codebase/backend/src/modules/auth/**` 변경 없음 (users 모듈만) → `auth-session-flow-change` 무관.
  - `codebase/packages/expression-engine/**`, 노드 실행 엔진/디버그 로깅 변경 없음 → `expression-language-change`/`run-debug-flow-change` 무관.
  - `codebase/frontend/src/content/docs/*/` 신규 디렉토리 없음 → `new-userguide-section-dir` 무관.
  - swagger jsdoc: 위에서 확인한 대로 완전 충족.

## 요약

매트릭스 21개 trigger 중 이 changeset(backend-only, users 모듈 + S3 설정)에 매칭된 것은 `backend-api-change`(controller glob, 완전 충족)와 `env-runtime-change`(semantic, README.md 누락)의 2건. `backend-api-change`의 swagger jsdoc 요건은 완전히 충족했고, README.md 의 신규 `S3_PUBLIC_BASE_URL` 누락은 WARNING 1건으로 확정. 유저 가이드 MDX(`content/docs/`) 미갱신은 이 PR 에 상응 frontend UI 가 전혀 없어(엔드포인트만 신설, 소비 UI 부재) 지금 시점 문서화가 오히려 오서술이 될 수 있는 회색지대라 INFO 로 낮췄다 — spec(`spec/2-navigation/9-user-profile.md`) 배지 flip 은 planner 트랙 위임이 프로세스대로 올바르게 처리됨(`plan/in-progress/spec-update-avatar-upload-implemented.md`). i18n dict/backend-labels(CRITICAL 대상)·노드 매트릭스·auth 흐름·표현식 언어·신규 섹션 디렉토리 관련 gap 은 전무.

## 위험도

LOW
