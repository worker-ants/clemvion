# 유저 가이드 동반 갱신(User Guide Sync) 리뷰 — 아바타 이미지 업로드 (공개 버킷 + 공개 URL)

## 매트릭스 적재

`.claude/config/doc-sync-matrix.json` (rows 21개) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑
(라인 127~197) 을 SSOT 로 적재. 변경 file 목록은 `_prompts/user_guide_sync.md` 40개 파일 —
그중 doc-sync 매트릭스 대상이 될 수 있는 것은 backend 소스·env·docker-compose·k8s manifest·
README·CHANGELOG·plan 문서이고, `codebase/frontend/**` 변경은 이번 changeset 에 **없음**
(meta.json `files[]` 로 재확인 — frontend 파일 0건).

## 발견사항

- **[INFO]** `backend-api-change` 트리거 매칭 — `users.controller.ts` 신규 엔드포인트
  (`POST /api/users/me/avatar`) 의 user-guide 타겟이 이번 changeset 에는 없지만, **이미
  올바르게 추적된 의도적 지연**이다
  - 변경 파일: `codebase/backend/src/modules/users/users.controller.ts` (신규
    `uploadAvatar` 핸들러 — 프롬프트에는 diff 생략, `grep` 으로 직접 확인: swagger
    데코레이터 `@ApiOperation`/`@ApiBody`/`@ApiBadRequestResponse`/
    `@ApiPayloadTooLargeResponse`/`@ApiUnauthorizedResponse`/`@ApiNotFoundResponse` 전부
    존재 — target (a) 는 충족)
  - 매트릭스 항목: "백엔드 API 추가·변경" — "(a) controller·DTO 의 swagger jsdoc<br>(b) API
    노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지" (`PROJECT.md:141`)
  - 누락된 동반 갱신(표면상): `codebase/frontend/src/content/docs/07-workspace-and-team/
    password-and-sessions.mdx` — 이 페이지 frontmatter 가 `code:` 로 `users.controller.ts`
    를 SoT 로 명시하고, 현재 본문은 `PATCH /users/me` 의 URL 입력만 설명한다.
  - 상세: 이번 backend PR 은 엔드포인트를 신설했지만, **소비하는 frontend UI 가 아직 없다**
    (직접 확인: `codebase/frontend/src/app/(main)/w/[slug]/profile/**`, `lib/api/users.ts`,
    `auth-store.ts` 어디에도 파일 업로드 input·`uploadAvatar` 호출이 없음 — `avatarUrl` 필드는
    표시만 됨). `spec/conventions/user-guide-evidence.md` 의 `<ImplAnchor kind="ui-entry">`
    컨벤션은 file/symbol 실존을 요구하므로, 지금 시점에 user-guide 본문을 쓰면 존재하지 않는
    UI 진입점을 가리키게 돼 그 자체가 컨벤션 위반이 된다 — 즉 지금 갱신하는 것이 오히려 틀렸다.
    developer 는 이를 인지하고 `plan/in-progress/spec-sync-user-profile-gaps.md` 에
    체크리스트 항목 "**프런트엔드 아바타 업로드 UI + 유저 가이드 동반 갱신** (리뷰 6라운드
    INFO)" 으로 명시적으로 등재했다 — "이 PR 은 backend 전용이라 '누락' 이 아니라 아직
    미트리거지만, 추적 항목이 없으면 엔드포인트만 떠 있는 채로 잊힌다" 는 이유와 함께, FE UI
    PR 에서 갱신해야 할 정확한 대상 파일(`password-and-sessions.mdx`)까지 미리 지정해 뒀다.
  - 제안: 별도 조치 불필요 — 이미 추적됨. 다만 FE 아바타 업로드 UI 를 붙이는 후속 PR 의
    user-guide-sync reviewer 는 이 plan 항목을 근거로 `password-and-sessions.mdx` 동반
    갱신을 **필수**로 요구해야 한다(체크박스가 그때 완료 처리돼야 함).

- **[INFO]** `env-runtime-change` 트리거 매칭 — 신규 env `S3_PUBLIC_BASE_URL` 의 target
  (README.md) 은 **동일 changeset 안에서 이미 충족**됨 (갭 아님, 확인 기록)
  - 변경 파일: `codebase/backend/.env.example`, `docker-compose.yml`,
    `docker-compose.e2e.yml`, `k8s/base/configmap.yaml`,
    `k8s/overlays/{local,prod,staging}/*.yaml`
  - 매트릭스 항목: "환경 변수·기동 방법·런타임 변경 (제품 최종 상태)" — 필수 갱신 위치
    `README.md` (`PROJECT.md:152`)
  - 확인: 루트 `README.md` (파일 2, `S3_PUBLIC_BASE_URL=http://localhost:9000` 항목 추가)
    가 같은 changeset 에 포함돼 target 이 충족된다. 추가로 `k8s/README.md` (파일 19) 의 env
    var 표에도 등재해 매트릭스 요구보다 더 넓게 커버했다. 조치 불필요.

- **[INFO]** `new-error-code` 트리거는 매칭되지 않음 — `FILE_REQUIRED`/`INVALID_FILE_TYPE`
  는 매트릭스가 지정한 glob(`codebase/backend/src/nodes/core/error-codes.ts`) 밖의 ad-hoc
  `BadRequestException({code:...})` 이라 `backend-labels.ts` 의 `ERROR_KO` 동반 갱신
  의무 대상이 아니다
  - 확인: `ERROR_KO`(`codebase/frontend/src/lib/i18n/backend-labels.ts:568`)를 직접 열어
    대조 — 같은 `UsersController` 의 기존 `USER_NOT_FOUND` 코드도 애초에 `ERROR_KO` 에
    없다(동일 도메인의 기존 패턴). 즉 이 PR 이 새로 만든 매핑 누락이 아니라 기존
    convention(사용자 API 일반 에러는 이 매핑 경유 대상이 아님)과 일치한다. 두 코드
    자체가 spec 에러 카탈로그에 미등재인 것은 이미 `api_contract` 리뷰(같은 세션)가 INFO 로
    잡았고 `spec-update-avatar-upload-implemented.md` 에 등재돼 있어 중복 지적하지 않는다.
  - 제안: 조치 불필요.

- **해당 없음으로 확인한 나머지 trigger** (증거 기록):
  - `new-node`/`node-schema-change` — `codebase/backend/src/nodes/**` 밖. N/A.
  - `new-ui-string` — 이번 changeset 에 `codebase/frontend/**` 변경 0건(meta.json 확인).
    TSX i18n parity 대상 자체가 없음. N/A.
  - `integration-provider-change` — `06-integrations-and-config/` 는 Slack·Discord·
    cafe24 등 외부 서비스 통합 전용(디렉토리 리스팅으로 확인). S3/MinIO 는 인프라 설정이라
    이 트리거의 "제공자" 범주가 아님. N/A.
  - `new-userguide-section-dir` — `codebase/frontend/src/content/docs/*/` 신규 디렉토리
    없음. N/A.
  - `auth-session-flow-change` — `codebase/backend/src/modules/auth/**` 변경 없음
    (`uploadAvatar` 는 기존 `JwtAuthGuard` 를 재사용할 뿐 인증 흐름 자체는 안 바뀜). N/A.
  - `expression-language-change`/`run-debug-flow-change`/`auth-config-type-enum-change`/
    `new-warning-code`/`new-cross-cutting-enum`/`new-backend-ui-zod-value`/
    `new-handler-output-field`/`new-bullmq-queue`/`userguide-gui-flow-section` — 전부
    이번 changeset 의 파일 범위 밖. N/A.
  - `spec-major-change` — `spec/**` 변경 없음. Spec 배지 flip 은 developer 권한 밖이라
    올바르게 planner 트랙(`spec-update-avatar-upload-implemented.md`)으로 분리돼 있음 —
    이 자체는 매트릭스 준수 사례.

## 요약

매트릭스 21개 trigger 중 이번 backend-only changeset(40개 변경 파일, frontend 변경 0건)에
실제로 매칭되는 것은 **2개** — `env-runtime-change`(신규 `S3_PUBLIC_BASE_URL`)와
`backend-api-change`(`POST /api/users/me/avatar` 신설)이다. 전자는 `README.md`(+
`k8s/README.md`)가 같은 changeset 에서 갱신돼 완전히 충족됐다. 후자는 swagger jsdoc target
은 충족됐고, "user-guide 페이지" target 은 이번 changeset 에는 없지만 **FE 소비 UI 자체가
아직 없어 지금 쓰면 오히려 `<ImplAnchor>` 실존 컨벤션을 어기는 상황**이며, developer 가
`plan/in-progress/spec-sync-user-profile-gaps.md` 에 정확한 대상 파일
(`password-and-sessions.mdx`)까지 명시해 의도적으로 지연·추적해 뒀다 — 사후 보정 PR 로
잊히는 패턴이 아니라 선제적으로 백로그화된 상태다. 새 error code(`FILE_REQUIRED`/
`INVALID_FILE_TYPE`)는 매트릭스가 지정한 glob 밖이라 `backend-labels.ts` 동반 갱신 의무
대상이 아니며, 기존 동일 도메인 패턴(`USER_NOT_FOUND` 도 미매핑)과 일치해 이 PR 이 새로
만든 gap 이 아니다. i18n parity·신규 섹션 디렉토리·통합 제공자·인증 흐름·표현식 언어 등
나머지 19개 trigger 는 이번 변경 파일 범위와 무관해 매칭되지 않는다. 종합하면 **실제
누락(WARNING/CRITICAL 급)은 0건**이고, 이미 추적된 지연 항목 1건만 INFO 로 기록한다.

## 위험도

LOW
