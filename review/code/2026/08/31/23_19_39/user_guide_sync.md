# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재
- SSOT: `.claude/config/doc-sync-matrix.json` (`rows[]`, 20행) + 보조 `PROJECT.md` §변경 유형 → 갱신 위치 매핑 (127~155행) 를 함께 Read.
- 변경 파일 23개 (아바타 업로드 `POST /api/users/me/avatar` 신설 — backend 전용, `codebase/frontend/**` 변경 0건).

## 발견사항

- **[INFO]** 신규 backend API (`POST /api/users/me/avatar`) 가 매트릭스 `backend-api-change` 행의 target (b) "API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지" 를 아직 충족하지 않음 — 단, 실측상 지금 시점에는 충족 **불필요**로 판단됨(아래 근거).
  - 변경 파일: `codebase/backend/src/modules/users/users.controller.ts` (신규 `@Post('me/avatar') uploadAvatar`)
  - 매트릭스 항목: `backend-api-change` — "(a) controller·DTO 의 swagger jsdoc / (b) API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지" (PROJECT.md:141)
  - (a) 는 충족됨: `@ApiOperation`/`@ApiBody`/`@ApiConsumes`/`@ApiPayloadTooLargeResponse` 등 swagger jsdoc 전량 작성 + 전용 동기화 가드 `codebase/backend/src/modules/users/users-avatar-swagger-sync.spec.ts` (MB 리터럴·확장자 나열을 상수와 전수 대조) 신설.
  - (b) 미충족처럼 보이나 조사 결과: 이 PR 은 **frontend 변경이 0건**이다. `codebase/frontend/src/app/(main)/w/[slug]/profile/page.tsx` 의 `avatarUrl` 은 읽기 전용 타입 필드뿐이고, `uploadAvatar`/`/me/avatar`/파일 업로드 폼에 대한 참조가 frontend 전체에 **0건**이다. 즉 사용자가 이 엔드포인트에 도달할 UI 진입점이 아직 없다. `spec/conventions/user-guide-evidence.md` 의 `<ImplAnchor kind="ui-entry">` 컨벤션은 file/symbol 실존을 요구하므로, FE 진입점이 없는 지금 user-guide MDX 를 쓰면 그 가드부터 통과하지 못한다 — 지금 갱신을 요구하는 것은 시기상조.
  - 다만 추적 공백이 하나 있다: `plan/in-progress/spec-sync-user-profile-gaps.md` 의 아바타 항목은 `[x]` 로 완료 표시되면서 별도 FE 후속 항목이 없다. 같은 문서의 자매 항목들 — 테마 System("**backend + frontend 완료**"), 슬러그 라우팅("**frontend 완료**" + phase 2 plan 링크) — 은 FE 측 완료·후속 여부를 명시하는데, 아바타 항목만 그 표기가 없어 "FE 업로드 UI + user-guide 페이지" 가 언제 뒤따를지 추적되지 않는다.
  - 제안: 이번 PR 에서 문서 갱신을 강제할 필요는 없음(WARNING 아님). 다만 FE 업로드 UI 착수 plan 이 신설될 때 `codebase/frontend/src/content/docs/07-workspace-and-team/`(또는 신규 프로필 섹션) 문서화 + `<ImplAnchor kind="ui-entry">` 동반 작성을 그 plan 의 할 일에 명시할 것을 권고.

## 정합/양호 확인 (참고 — 발견사항 아님)

- **`env-runtime-change`** (`S3_PUBLIC_BASE_URL` 신규 env) — README.md·`codebase/backend/.env.example`·`docker-compose.yml`·`docker-compose.e2e.yml`·`k8s/README.md`·`k8s/base/configmap.yaml`·`k8s/overlays/local/configmap-patch.yaml` **7개 위치 전부** 같은 changeset 안에서 일관 갱신됨(값·경고 문구·MinIO 버킷 정책 배포 선행조건까지 명시). 매트릭스 target(README.md) 충족.
- **`spec-defect-found`** — spec `9-user-profile.md`(및 리뷰가 잡은 `0-overview.md §2.7`·`data-flow/4-file-storage.md`·`5-system/3-error-handling.md`) 의 "미구현 (Planned)" stale 서술을 developer 가 직접 고치지 않고 `plan/in-progress/spec-update-avatar-upload-implemented.md` 를 신설해 planner 트랙으로 정확히 위임함. "자기-반증형 소정정" 예외 미해당 사유("developer 가 쓴 예고 문장이 아니라 제품 정의 서술")도 명시적으로 판단해 기록. 매트릭스 target 충족.
- `error-codes.ts`(`codebase/backend/src/nodes/core/error-codes.ts`, workflow 노드 실행 에러 전용 enum) 및 `warningRules` 는 이번 changeset 에서 변경되지 않음. `updateAvatar` 가 던지는 `FILE_REQUIRED`/`INVALID_FILE_TYPE`/`USER_NOT_FOUND` 는 위 enum 계열이 아니라 기존 `getMe`/`updateMe`/`changePassword` 와 같은 API-레벨 exception body 패턴(선례 `USER_NOT_FOUND` 도 frontend 매핑 없이 이미 쓰이던 코드) — `backend-labels.ts` 의 `ERROR_KO`/`WARNING_KO` 트리거(`new-error-code`/`new-warning-code`) 대상이 아님. i18n dict/backend-labels 매핑 누락 CRITICAL 없음.
- `codebase/frontend/src/**/*.tsx` 변경 0건 — `new-ui-string`(i18n parity) 트리거 미해당.
- `codebase/frontend/src/content/docs/*/`(신규 섹션 디렉토리) 변경 0건 — `new-userguide-section-dir`(`locale.ts` `SECTION_LABELS_BY_LOCALE`) 트리거 미해당.
- `codebase/backend/src/nodes/**` 변경 0건 — `new-node`/`node-schema-change` 트리거 미해당.
- `codebase/backend/src/modules/auth/**` 변경 0건 — `auth-session-flow-change`(`07-workspace-and-team/` + e2e) 트리거 미해당. (`auth-oauth.service.ts` 는 신설 캐너리 테스트가 소스를 읽어 우선순위 표현식을 고정할 뿐, 그 파일 자체는 수정되지 않음.)
- `codebase/packages/expression-engine/**` 변경 0건 — `expression-language-change` 트리거 미해당.

## 요약

매트릭스 20행 중 실질 매칭은 `backend-api-change`(controller 신설) 1건 + `env-runtime-change`(신규 env var) 1건 + `spec-defect-found`(stale spec 발견) 1건. 후자 둘은 동일 changeset 안에서 요구 target 을 전부 충족했다(env var 전파 7위치 일관, spec 정정은 올바르게 planner 트랙 위임). `backend-api-change` 의 (a) swagger jsdoc 은 충족, (b) user-guide 페이지는 FE 진입점이 아직 없어(0건) 지금 시점 요구가 시기상조라 INFO 로 강등 — 다만 이 PR 의 plan 체크박스가 FE 후속 여부를 명시하지 않아 추적이 비는 점을 지적했다. i18n dict/backend-labels/섹션-locale 등 CRITICAL 급 매트릭스 행(신규 노드·TSX 문자열·warning/error KO 매핑·신규 섹션 디렉토리)은 이번 changeset 에 전혀 매칭되지 않는다(frontend 변경 0건).

## 위험도
LOW
