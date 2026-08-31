# 유저 가이드 동반 갱신(User Guide Sync) 리뷰 — 아바타 이미지 업로드 (공개 버킷 + 공개 URL)

## 매트릭스 적재

`.claude/config/doc-sync-matrix.json` (rows 21개) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑
본문을 SSOT 로 적재. 프롬프트에 나열된 143개 파일 중 이번 기능 변경에 해당하는 것은
1~26번과 142~143번(총 28개) — CHANGELOG·README·backend 소스/env/테스트·docker-compose·k8s
manifest·plan 문서·`scripts/minio/*` — 이고, 나머지(27~141번)는 이전 리뷰 라운드
(`review/code/2026/08/31/22_12_54` ~ `2026/09/01/00_55_27`)의 산출물이 이번 changeset 에
함께 커밋된 것으로 이번 기능과의 doc-sync 판단 대상이 아니다. **`codebase/frontend/**` 변경은
이번 changeset 에 0건**이다(전체 파일 목록을 `grep -n "^### 파일"` 로 전수 확인).

## 발견사항

- **[INFO]** `backend-api-change` 트리거 매칭 — `users.controller.ts` 신규 엔드포인트
  (`POST /api/users/me/avatar`) 의 user-guide 타겟이 이번 changeset 에는 없지만, **이미
  올바르게 추적된 의도적 지연**이며 이번 라운드에도 상태가 그대로 유지되고 있다
  - 변경 파일: `codebase/backend/src/modules/users/users.controller.ts` (신규
    `uploadAvatar` 핸들러 — swagger 데코레이터 존재는
    `codebase/backend/src/modules/users/users-avatar-swagger-sync.spec.ts` 회귀 테스트로
    고정돼 있어 target (a) "controller·DTO 의 swagger jsdoc" 는 충족)
  - 매트릭스 항목: `backend-api-change` — targets: "controller·DTO 의 swagger jsdoc" /
    "API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지"
    (`.claude/config/doc-sync-matrix.json` id=`backend-api-change`)
  - 표면상 누락된 동반 갱신: `codebase/frontend/src/content/docs/07-workspace-and-team/
    password-and-sessions.mdx` (frontmatter `code:` 가 `users.controller.ts` 를 SoT 로
    명시하며, 본문은 현재 `PATCH /users/me` 의 URL 입력만 설명)
  - 상세: 이번 backend PR 은 엔드포인트를 신설했지만 **소비하는 frontend UI 가 아직 없다** —
    `codebase/frontend/src/app/(main)/w/[slug]/profile/**` 를 직접 확인해도
    파일-업로드 input·`uploadAvatar` 호출이 없고 `avatarUrl` 은 표시 전용 필드로만 쓰인다
    (`profile/page.tsx:31`). `spec/conventions/user-guide-evidence.md` 의
    `<ImplAnchor kind="ui-entry">` 컨벤션은 file/symbol 실존을 요구하므로, 지금 시점에
    user-guide 본문을 먼저 쓰면 존재하지 않는 UI 진입점을 가리켜 그 자체가 컨벤션 위반이
    된다. developer 는 이를 인지하고
    `plan/in-progress/spec-sync-user-profile-gaps.md:149-157` 에 "**프런트엔드 아바타
    업로드 UI + 유저 가이드 동반 갱신**" 체크리스트 항목으로 명시적으로 등재했고, FE UI
    PR 에서 갱신해야 할 정확한 대상 파일(`password-and-sessions.mdx`)까지 미리 지정해
    두었다(현재도 그 항목이 그대로 살아 있음을 직접 grep 으로 재확인).
  - 제안: 별도 조치 불필요 — 이미 추적됨. FE 아바타 업로드 UI 를 붙이는 후속 PR 에서는 이
    plan 항목을 근거로 `password-and-sessions.mdx` 동반 갱신을 **필수**로 요구해야 한다.

- **[INFO]** `env-runtime-change` 트리거 매칭 — 신규 env `S3_PUBLIC_BASE_URL` 의 target
  (README.md) 은 **동일 changeset 안에서 이미 충족**됨 (갭 아님)
  - 변경 파일: `codebase/backend/.env.example`, `docker-compose.yml`,
    `docker-compose.e2e.yml`, `k8s/base/configmap.yaml`,
    `k8s/overlays/{local,prod,staging}/*.yaml`
  - 매트릭스 항목: `env-runtime-change` — targets: `["README.md"]`
  - 확인: 루트 `README.md`(파일 2, `S3_PUBLIC_BASE_URL=http://localhost:9000` 항목 추가)가
    같은 changeset 에 포함돼 target 충족. 추가로 `k8s/README.md`(파일 20)의 env var 표에도
    등재해 매트릭스 요구보다 더 넓게 커버했다. 조치 불필요.

- **[INFO]** `new-error-code` 트리거는 매칭되지 않음 — 신규 코드 `FILE_REQUIRED`/
  `INVALID_FILE_TYPE` 은 매트릭스가 지정한 glob(`codebase/backend/src/nodes/core/
  error-codes.ts`) 밖의 ad-hoc `BadRequestException({code:...})` 이라 `backend-labels.ts`
  의 `ERROR_KO` 동반 갱신 의무 대상이 아니다
  - 확인: `codebase/frontend/src/lib/i18n/backend-labels.ts` 를 `FILE_REQUIRED`/
    `INVALID_FILE_TYPE`/`USER_NOT_FOUND` 로 grep — 셋 다 매핑이 없다. `USER_NOT_FOUND` 는
    이 PR 이전부터 이 컨트롤러가 써 온 기존 코드인데도 애초에 `ERROR_KO` 미등재라, 이 PR 이
    새로 만든 gap 이 아니라 기존 convention(사용자 API 일반 에러는 이 매핑 경유 대상이
    아님)과 일치한다. 두 코드가 spec 에러 카탈로그에 없는 것은 이미
    `plan/in-progress/spec-update-avatar-upload-implemented.md` 의 할 일 목록에
    "`spec/5-system/3-error-handling.md` §1 에러 카탈로그에 FILE_REQUIRED/
    INVALID_FILE_TYPE 등재" 로 별도 추적 중이다.
  - 제안: 조치 불필요.

- **해당 없음으로 확인한 나머지 trigger** (증거 기록):
  - `new-node`/`node-schema-change` — `codebase/backend/src/nodes/**` 밖. N/A.
  - `new-ui-string` — `codebase/frontend/**` 변경 0건. TSX i18n parity 대상 자체가 없음. N/A.
  - `new-widget-chrome-string` — `codebase/channel-web-chat/**` 변경 없음. N/A.
  - `integration-provider-change` — `06-integrations-and-config/` 는 Slack·Discord·cafe24
    등 외부 서비스 통합 전용. S3/MinIO 는 인프라 설정이라 이 트리거의 "제공자" 범주가
    아님. N/A.
  - `new-userguide-section-dir` — `codebase/frontend/src/content/docs/*/` 신규 디렉토리
    없음(기존 8개 섹션 그대로: 01~07, 99). N/A.
  - `auth-session-flow-change` — `codebase/backend/src/modules/auth/**` 변경 없음
    (`uploadAvatar` 는 기존 `JwtAuthGuard` 를 재사용할 뿐 인증 흐름 자체는 안 바뀜). N/A.
  - `expression-language-change`/`run-debug-flow-change`/`auth-config-type-enum-change`/
    `new-warning-code`/`new-cross-cutting-enum`/`new-backend-ui-zod-value`/
    `new-handler-output-field`/`new-bullmq-queue`/`userguide-gui-flow-section` — 전부
    이번 changeset 의 파일 범위 밖. N/A.
  - `spec-major-change` — `spec/**` 변경 없음. Spec 배지 flip(§6.1 미구현→구현)은 developer
    권한 밖이라 올바르게 planner 트랙(`spec-update-avatar-upload-implemented.md`)으로
    분리돼 있고, 그 plan 문서 자체가 `0-overview.md §2.7`·`data-flow/4-file-storage.md`·
    `5-system/3-error-handling.md` 세 SoT 문서를 모두 지목해 매트릭스 취지를 넘어서는
    수준으로 커버한다 — 이 자체는 매트릭스 준수 사례.

## 요약

매트릭스 21개 trigger 중 이번 backend-only changeset(고유 변경 파일 28개, frontend 변경
0건)에 실제로 매칭되는 것은 2개 — `backend-api-change`(`POST /api/users/me/avatar` 신설)와
`env-runtime-change`(신규 `S3_PUBLIC_BASE_URL`) — 이다. 후자는 `README.md`+`k8s/README.md`
가 같은 changeset 에서 갱신돼 완전히 충족됐다. 전자는 swagger jsdoc target 은 충족됐고,
"user-guide 페이지" target 은 이번 changeset 에는 없지만 FE 소비 UI 자체가 아직 없어
지금 쓰면 오히려 `<ImplAnchor>` 실존 컨벤션을 어기는 상황이며, developer 가
`plan/in-progress/spec-sync-user-profile-gaps.md` 에 정확한 대상 파일
(`password-and-sessions.mdx`)까지 명시해 선제적으로 추적해 두었다(직접 재확인 완료). 이
결론은 직전 라운드(`review/code/2026/09/01/00_55_27/user_guide_sync.md`)의 판정과 동일하며,
이번 라운드까지 frontend 변경이 여전히 0건이고 plan 추적 항목도 그대로 살아 있어 상태가
바뀌지 않았음을 재확인했다. 새 error code(`FILE_REQUIRED`/`INVALID_FILE_TYPE`)는 매트릭스가
지정한 glob 밖이라 `backend-labels.ts` 동반 갱신 의무 대상이 아니며 기존 동일 도메인 패턴과
일치한다. i18n parity·신규 섹션 디렉토리·통합 제공자·인증 흐름·표현식 언어 등 나머지 19개
trigger 는 이번 변경 파일 범위와 무관해 매칭되지 않는다. 종합하면 **실제 누락
(WARNING/CRITICAL 급)은 0건**이고, 이미 추적된 지연 항목 1건만 INFO 로 기록한다.

## 위험도

LOW
