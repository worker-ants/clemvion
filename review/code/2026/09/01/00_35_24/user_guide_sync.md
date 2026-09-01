# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 적재한 SSOT
- `.claude/config/doc-sync-matrix.json` (`rows[]`, 20개 항목) + `PROJECT.md` §127-206 (변경 유형 → 갱신 위치 매핑 prose, "자주 누락되는 항목" §168-184 포함).

## 변경 파일 컨텍스트
`git diff --name-only origin/main...HEAD` 기준 실제 소스/문서 변경(리뷰 산출물 디렉터리 제외):
`CHANGELOG.md`, `README.md`, `codebase/backend/.env.example`,
`codebase/backend/src/common/config/s3.config.{ts,spec.ts}`,
`codebase/backend/src/common/services/s3.service.{ts,spec.ts}`,
`codebase/backend/src/main.ts`,
`codebase/backend/src/modules/users/{users.controller.ts, users.service.ts, users.module.ts, users-avatar.service.spec.ts, users-avatar-swagger-sync.spec.ts, users.controller.spec.ts, users.service.spec.ts}`,
`codebase/backend/test/users-avatar-upload.e2e-spec.ts`,
`docker-compose.{yml,e2e.yml}`, `k8s/**`,
`plan/in-progress/{spec-sync-user-profile-gaps.md, spec-update-avatar-upload-implemented.md}`.

**`codebase/frontend/**` 변경 파일은 0건** — 이번 diff 는 백엔드(아바타 업로드 API + S3 공개 URL 인프라) 전용이다.

## 트리거 매칭

| 매트릭스 행 | 매칭 여부 | 근거 |
|---|---|---|
| 새 노드 추가 / 노드 schema 변경 | 불일치 | `codebase/backend/src/nodes/**` 변경 없음 |
| 신규 UI 문자열 (TSX) / i18n parity | 불일치 | `codebase/frontend/src/**/*.tsx` 변경 없음 |
| 통합/제공자 변경 | 불일치 | S3 는 워크플로 노드/제공자 커넥터가 아니라 인프라 설정 |
| 유저 가이드 신규 섹션 디렉토리 | 불일치 | `content/docs/<NN>-<name>/` 신규 없음 |
| **백엔드 API 추가·변경** | **매칭** | `codebase/backend/src/modules/users/users.controller.ts` 에 `POST /me/avatar` 신설 (glob: `**/*.controller.ts`) |
| 신규 warningCode / errorCode (ERROR_KO/WARNING_KO 대상) | 불일치 | `FILE_REQUIRED`/`INVALID_FILE_TYPE`/`USER_NOT_FOUND` 는 워크플로 실행 에러(`nodes/core/error-codes.ts`)가 아니라 REST 응답의 `{code,message}` 이며, `USER_NOT_FOUND`(auth/webauthn/workspaces/notifications 기존 발행처와 동일 shape)·`INVALID_FILE_TYPE`(knowledge-base 기존 발행처와 공용) 모두 기존 관용구 재사용. `backend-labels.ts` 의 `ERROR_KO`/`WARNING_KO` 는 워크플로 노드 실행/그래프 검증 코드 전용 카탈로그로 이 REST 에러들과 네임스페이스가 다름 |
| 인증·권한·세션 흐름 변경 | 불일치 | 변경은 `modules/users/**` 이며 `modules/auth/**` 아님 |
| 표현식 언어 변경 / 실행·디버깅 흐름 변경 | 불일치 | 해당 경로 무변경 |
| **환경 변수·기동 방법·런타임 변경** | **매칭** | 신규 `S3_PUBLIC_BASE_URL` env → target: `README.md` |

## 매칭된 트리거의 동반 갱신 확인

### 1. `환경 변수·기동 방법·런타임 변경` → README.md
**충족.** `README.md` diff(파일 2)가 같은 커밋 세트 안에서 `S3_PUBLIC_BASE_URL` 을 S3/MinIO 섹션에 추가했고, `codebase/backend/.env.example` 에도 상세 설명과 함께 반영됐다. 갭 없음.

### 2. `백엔드 API 추가·변경` → (a) swagger jsdoc, (b) 관련 user-guide 페이지

**(a) swagger jsdoc — 충족, 근거 견고.**
`users.controller.ts` 의 `uploadAvatar` 에 `@ApiOperation`·`@ApiConsumes('multipart/form-data')`·`@ApiBody`(스키마 명시)·`@ApiOkWrappedResponse`·`@ApiBadRequestResponse`·`@ApiPayloadTooLargeResponse`·`@ApiUnauthorizedResponse`·`@ApiNotFoundResponse` 가 모두 붙어 있고, 신설된 `codebase/backend/src/modules/users/users-avatar-swagger-sync.spec.ts` 가 산문 안의 "NMB"·확장자 나열을 `UsersService.AVATAR_MAX_BYTES`/`AVATAR_CONTENT_TYPES` 와 전수 대조하는 구조적 가드까지 겸비한다(`spec/conventions/swagger.md` 상회).

**(b) 관련 user-guide 페이지 — INFO (그레이존, 확정적 결함 아님).**
- 위치: `codebase/frontend/src/content/docs/07-workspace-and-team/password-and-sessions.mdx` — frontmatter `code:` 배열이 `codebase/backend/src/modules/users/users.controller.ts` 를 SoT 코드로 명시하는, `content/docs/` 안에서 이 컨트롤러를 참조하는 유일한 페이지다.
- 매트릭스 항목: "백엔드 API 추가·변경" 행의 target (b) `"API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지"` (verify: 수동, guard_test 없음 — 원래 advisory).
- 상세: `POST /api/users/me/avatar` 가 신설됐지만, 이번 diff 에 **`codebase/frontend/**` 변경이 전혀 없다** — 즉 이 엔드포인트를 호출하는 프런트엔드 UI 진입점(버튼·폼)이 아직 없다. 실측: `profile-info-card.tsx`(205줄), `profile/page.tsx` 어디에도 `avatar` 관련 UI 코드가 없고 `avatarUrl` 은 타입 필드로만 존재한다. UI 진입점이 없는 상태에서 "가이드 본문"을 지금 추가하면 클릭할 수 없는 기능을 안내하는 역-오류가 된다 — 따라서 이번 PR 이 해당 문서를 갱신하지 않은 것 자체는 정합적 판단일 수 있다.
- 다만 `plan/in-progress/spec-update-avatar-upload-implemented.md`(spec `9-user-profile.md` §6.1 배지 flip)와 `plan/in-progress/spec-sync-user-profile-gaps.md`(§6.1 체크박스, 이번 PR 로 `[x]`) 어디에도 **"프런트엔드 업로드 UI + `07-workspace-and-team/` 가이드 갱신"** 을 명시한 후속 항목이 없다. `PROJECT.md` §DOCUMENTATION 체크리스트의 "partial-implementation 분리" 조항("본 PR 이 구현하는 spec 섹션의 나머지 surface 가 있다면 … `plan/in-progress/<spec-name>-followup-<surface>.md` 가 신설/갱신됐는가?")과 정확히 들어맞는 상황인데, 이 followup plan 이 아직 없다.
- 제안: 필수 차단 사유는 아니므로 CRITICAL/WARNING 으로 격상하지 않는다. 다만 후속 프런트엔드 PR 이 실제 업로드 UI 를 붙이는 시점에 `07-workspace-and-team/password-and-sessions.mdx` + `.en.mdx`(또는 신규 프로필 정보 편집 페이지)를 **같은 turn** 에 갱신해야 한다는 점을, 지금 이 PR 또는 뒤따르는 planner 턴에 `plan/in-progress/` 항목으로 명시해 두는 것을 권장한다 — 그렇지 않으면 "구현은 있는데 아무도 UI 를 붙이는 걸 기억 못 하는" 영구 미완 상태로 빠질 위험이 있다(§`PROJECT.md` 178줄 "새 노드 추가 — EN 로케일 누락" 류의 반복 패턴과 같은 계열).

## i18n / backend-labels 세부 점검
- **i18n parity**: TSX 변경 0건 → 해당 없음.
- **backend-labels.ts (WARNING_KO/ERROR_KO)**: 위 표에서 확인한 대로, 이번 PR 이 발행하는 `FILE_REQUIRED`/`INVALID_FILE_TYPE`/`USER_NOT_FOUND` 는 `nodes/core/error-codes.ts` 의 `ErrorCode` enum 이 아니라 REST 컨트롤러 예외 응답의 `{code,message}` 필드이고, 세 코드 모두 기존 다른 모듈(`auth`, `webauthn`, `workspaces`, `notifications`, `knowledge-base`)에서 이미 쓰던 코드의 재사용이다. `backend-labels.ts` 의 `ERROR_KO`/`WARNING_KO`/`GRAPH_WARNING_KO` 는 워크플로 노드 실행 결과·그래프 검증 경고 전용 카탈로그(`translateBackendError`/`translateGraphWarning` 소비 지점 확인)이며 REST API 예외 응답과는 별도 네임스페이스다 — 매핑 누락이 아니다.
- **새 섹션 디렉토리 locale 등록**: `content/docs/<NN>-<name>/` 신규 없음 → 해당 없음.

## 요약
매트릭스 20개 행 중 이번 diff 에 매칭된 행은 2개(`환경 변수·기동 방법·런타임 변경`, `백엔드 API 추가·변경`)이며, (a) README.md/.env.example 반영과 (b) swagger jsdoc + 전용 동기화 가드(`users-avatar-swagger-sync.spec.ts`)는 모두 같은 커밋 세트 안에서 충족됐다. 확정적 CRITICAL/WARNING 누락은 없다. 유일한 관찰 사항은 INFO 등급 — 신설 API 에 대응하는 프런트엔드 UI/가이드 갱신이 없는데, 이는 프런트엔드 배선 자체가 이번 PR 범위 밖(0건)이라 "누락"이라기보다 "아직 트리거되지 않음"에 가깝다. 다만 그 후속 작업을 추적하는 `plan/in-progress/` 항목이 현재 없어 향후 유실 위험이 있다는 점만 권고로 남긴다. `ERROR_KO`/`WARNING_KO` 매핑은 네임스페이스가 달라 대상 아님을 확인했다.

## 위험도
LOW
