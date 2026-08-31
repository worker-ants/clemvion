# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재
`.claude/config/doc-sync-matrix.json` (`rows[]` 21행) + `PROJECT.md` §변경 유형 → 갱신 위치
매핑 본문을 함께 Read 함.

## 변경 파일 컨텍스트
`git diff --name-only 07d322c92 HEAD` (feat `d51954999` + fix `8d06f4944`, 21개 파일) — **frontend
파일은 0건**: `CHANGELOG.md`, `README.md`, `codebase/backend/.env.example`,
`codebase/backend/src/common/config/s3.config.{ts,spec.ts}`,
`codebase/backend/src/common/services/s3.service.{ts,spec.ts}`,
`codebase/backend/src/modules/users/{users.controller.ts,users.module.ts,users.service.ts,
users.controller.spec.ts,users.service.spec.ts,users-avatar.service.spec.ts,
users-avatar-swagger-sync.spec.ts}`, `docker-compose{,.e2e}.yml`, `k8s/README.md`,
`k8s/base/configmap.yaml`, `k8s/overlays/local/configmap-patch.yaml`,
`plan/in-progress/{spec-sync-user-profile-gaps.md,spec-update-avatar-upload-implemented.md}`.

## 매칭된 trigger

- **`backend-api-change`** (semantic, `codebase/backend/src/**/*.controller.ts`) —
  `codebase/backend/src/modules/users/users.controller.ts` 매칭 (`uploadAvatar` 신설).
- **`env-runtime-change`** (semantic) — 신규 `S3_PUBLIC_BASE_URL` env var.
- **`spec-defect-found`** (semantic) — spec `9-user-profile.md` 의 "미구현 (Planned)" 배지가
  실측과 어긋남을 developer 가 스스로 확인.
- 그 외 (`new-node`, `node-schema-change`, `new-ui-string`, `integration-provider-change`,
  `new-userguide-section-dir`, `new-warning-code`, `new-error-code`,
  `auth-session-flow-change`, `expression-language-change`, `run-debug-flow-change`,
  `spec-major-change` 등) — 변경 set 에 매칭 파일 없음 (frontend TSX/dict/docs, `nodes/**`,
  `packages/expression-engine/**`, `modules/auth/**`, `spec/**` 전부 미터치).

## 발견사항

### [INFO] `backend-api-change` target (a) swagger jsdoc — 충족 확인, 이견 없음
- 변경 파일: `codebase/backend/src/modules/users/users.controller.ts` (`uploadAvatar`,
  `@Post('me/avatar')` 부근)
- 매트릭스 항목: `backend-api-change` — targets (a) "controller·DTO 의 swagger jsdoc"
- 상세: `@ApiOperation`(요약+설명, 공개 URL·UUID·정리 정책까지 서술) · `@ApiConsumes` ·
  `@ApiBody`(multipart 스키마) · `@ApiOkWrappedResponse` · `@ApiBadRequestResponse` ·
  `@ApiPayloadTooLargeResponse` · `@ApiUnauthorizedResponse` · `@ApiNotFoundResponse` 전부
  갖춰져 있고, 신규 `users-avatar-swagger-sync.spec.ts` 가 산문 리터럴("최대 NMB", 확장자
  목록)을 `UsersService.AVATAR_MAX_BYTES` / `AVATAR_CONTENT_TYPES` 와 동기 고정한다. Target
  (a) 는 충족 — 누락 아님, 참고로 기재.

### [INFO] `backend-api-change` target (b) user-guide 페이지 — 회색 지대, 현재는 미도달
- 변경 파일: `codebase/backend/src/modules/users/users.controller.ts` (`uploadAvatar`),
  `users.service.ts` (`updateAvatar`, `FILE_REQUIRED`/`INVALID_FILE_TYPE`)
- 매트릭스 항목: `backend-api-change` — targets (b) "API 노출 변경이 사용자 안내에 영향 →
  관련 user-guide 페이지"
- 상세: `POST /api/users/me/avatar` 는 실제 사용자 노출 기능(파일 업로드로 아바타 교체)을
  추가하지만, **frontend 가 이 엔드포인트를 아직 호출하지 않는다** —
  `codebase/frontend/src/app/(main)/w/[slug]/profile/` 트리 전체를 grep 했으나 `me/avatar`·
  `uploadAvatar` 참조 0건, `avatarUrl` 만 (기존 `PATCH /users/me` 경유 URL 붙여넣기 UI).
  즉 이 PR 은 배타적으로 backend 골조이고, 사용자는 지금 이 엔드포인트에 UI 로 도달할 방법이
  없다. `codebase/frontend/src/content/docs/` 전체를 grep 해도 일반 "프로필 설정"(이름·아바타·
  테마) 페이지 자체가 아예 문서화돼 있지 않다(`07-workspace-and-team/` 에는 비밀번호·2FA·
  워크스페이스 문서만 존재) — 이는 이 PR 이전부터 있던 gap 이라 이번 변경이 새로 벌린 것은
  아니다. 신규 `FILE_REQUIRED`/`INVALID_FILE_TYPE` 코드도 frontend 어디에도 소비되지 않는다
  (grep 0건) — workflow 노드 실행 warning/error 체계(`backend-labels.ts` 의 `WARNING_KO`/
  `ERROR_KO`)와는 별개의 일반 REST 400 페이로드이므로 `new-warning-code`/`new-error-code`
  행의 CRITICAL 기준(영문 그대로 사용자 노출)에도 해당하지 않는다 — 애초에 아무 UI 도 그 코드를
  읽지 않는다.
- 판단: 지금 시점에는 "동반 갱신 누락" 이라기보다 **아직 트리거되지 않은 target** — 사용자가
  실제로 쓸 수 없는 기능을 문서화하면 오히려 앞서가는 문서가 된다. 다만 frontend 배선(파일
  선택 UI → `POST /me/avatar` 호출)이 붙는 다음 PR 에서는 (1) `codebase/frontend/src/content/
  docs/07-workspace-and-team/` 아래 프로필 설정 관련 페이지(신규 또는 기존 페이지 보강)에
  "이미지 업로드로 아바타 변경" 절 (2) 그 페이지에 쓰일 TSX 신규 문자열의 `dict/{ko,en}/` parity
  (3) 필요시 `FILE_REQUIRED`/`INVALID_FILE_TYPE` 을 사용자 토스트로 노출한다면 그 매핑까지
  동반 갱신 대상이 된다는 점을 그 작업의 plan 에 명시해 두는 편이 안전하다. 이 PR 자체에는
  차단 사유 없음.
- 제안: 후속 frontend 배선 plan(`plan/in-progress/` 신설 또는 기존 항목)에 위 세 갈래를
  체크리스트로 미리 못 박아 두면, 다음 세션이 "백엔드는 됐으니 UI 만 붙이면 끝" 으로 오판해
  문서·i18n 을 빠뜨리는 것을 막을 수 있다. (본 리뷰의 범위인 이번 diff 에는 조치 불요.)

### 확인 — spec 갱신은 매트릭스가 아니라 발부 경로(project-planner)로 올바르게 위임됨
- `plan/in-progress/spec-update-avatar-upload-implemented.md` 신설 — `9-user-profile.md`
  뿐 아니라 리뷰가 잡은 `0-overview.md §2.7`, `data-flow/4-file-storage.md`,
  `5-system/3-error-handling.md` 까지 위임 대상에 포함. `spec/` 쓰기는 developer 권한 밖이라는
  점을 plan 본문에 명시하고 있어 자기-반증형 소정정 예외 오남용도 아님. 이 경로는 `spec/`
  갱신이라 본 리뷰(유저 가이드=frontend docs/i18n)의 직접 판정 대상은 아니지만, 상호 참조를
  위해 기록.

## i18n / locale / backend-labels 점검 (결과: 해당 없음)
- `codebase/frontend/src/**/*.tsx` 변경 0건 → `new-ui-string` i18n parity 트리거 없음.
- `codebase/frontend/src/content/docs/*/` 신규 디렉토리 0건 → `SECTION_LABELS_BY_LOCALE` 등록
  트리거 없음.
- `codebase/backend/src/nodes/core/error-codes.ts` / warningRules 미변경 → `WARNING_KO`/
  `ERROR_KO` 매핑 트리거 없음 (신규 `FILE_REQUIRED`/`INVALID_FILE_TYPE` 은 위에서 설명한 대로
  별개 REST 에러 체계).

## 요약
매트릭스 21행 중 프론트엔드 코드가 전혀 없는 backend-only 아바타 업로드 PR 에 매칭되는 행은
`backend-api-change`(controller 변경) · `env-runtime-change`(README) · `spec-defect-found`
(spec badge stale, planner-track 로 이미 올바르게 위임) 세 개뿐이다. `backend-api-change`
target (a) swagger jsdoc 은 충족. target (b) user-guide 페이지는 frontend 가 아직 이 엔드포인트를
호출하지 않아(전수 grep 0건) "사용자 안내에 영향"이 현재는 발생하지 않는 회색 지대로 판단해
INFO 로만 기록했다. i18n dict·`backend-labels.ts`·`SECTION_LABELS_BY_LOCALE` 등 CRITICAL 급
trigger 는 매칭되는 변경 파일이 없어 전부 해당 없음. CRITICAL·WARNING 없음.

## 위험도
LOW
