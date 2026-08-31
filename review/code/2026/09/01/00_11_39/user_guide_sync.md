# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

대상: 아바타 이미지 업로드(`POST /api/users/me/avatar`, 공개 버킷 + 공개 URL 서빙) — 이번 라운드(5회차,
`00_11_39`)까지 누적된 변경 diff 26+개 파일. `.claude/config/doc-sync-matrix.json` `rows[]`(21행) +
`PROJECT.md` §변경 유형 → 갱신 위치 매핑(같은 21행)을 적재해 매칭했다. 이전 4라운드(`22_12_54`,
`22_44_14`, `23_19_39`, `23_46_40`)의 `user_guide_sync`/`documentation` 산출물을 함께 확인해, 과거
라운드가 지적한 gap 이 **이번 diff 에서 실제로 해소됐는지**를 실측(grep)으로 검증했다.

## 매칭된 trigger와 상태

### 1. `env-runtime-change` — "환경 변수·기동 방법·런타임 변경 (제품 최종 상태)" → targets: `README.md`
- 트리거 파일: `codebase/backend/.env.example`(`S3_PUBLIC_BASE_URL` 신설), `codebase/backend/src/common/config/s3.config.ts`(`publicBaseUrl` 필드 신설)
- 라운드 1(`22_12_54`)에서 이 항목을 WARNING(README.md 미반영)으로 지적했었다.
- **이번 라운드에서 해소 확인** — `README.md:213` 에 `S3_PUBLIC_BASE_URL=http://localhost:9000` 이 실제로 존재함을 `grep -n S3_PUBLIC_BASE_URL README.md` 로 실측(1건, 213행). 파일 2 diff 와도 일치. **더 이상 gap 아님.**

### 2. `backend-api-change` — "백엔드 API 추가·변경" → targets: (a) swagger jsdoc (b) 관련 user-guide 페이지
- 트리거 파일: `codebase/backend/src/modules/users/users.controller.ts` (`POST me/avatar` 신설)
- (a) swagger jsdoc: `@ApiOperation`/`@ApiConsumes`/`@ApiBody`/`@ApiOkWrappedResponse`/`@ApiBadRequestResponse`/`@ApiPayloadTooLargeResponse`/`@ApiUnauthorizedResponse`/`@ApiNotFoundResponse` 전부 신설되고, 이를 상수와 동기화하는 전용 회귀 테스트(`users-avatar-swagger-sync.spec.ts`, 66줄, 전수열거 방식)까지 신설됐다 — **충족**.
- (b) user-guide 페이지: `codebase/frontend/src/content/docs/**` 를 `grep -rln "me/avatar\|uploadAvatar\|avatar.*upload" codebase/frontend/src` 로 재확인 — **0건**, 프런트엔드에 이 엔드포인트를 소비하는 코드가 여전히 없다. `07-workspace-and-team/workspaces-and-members.mdx:28` 의 "아바타" 언급은 사이드바 아이콘 클릭 안내일 뿐 업로드 기능과 무관함을 직접 열어 확인. 즉 안내할 실재 GUI 흐름이 아직 없어 지금 MDX 를 갱신하면 존재하지 않는 UI 를 서술하게 된다 — 라운드 1의 INFO(회색지대) 판정이 이번 라운드에도 그대로 유효하다. **확정 gap 아님.**

### 3. `spec-defect-found` — spec 자체 결함(9-user-profile.md 등 4개 문서의 stale "미구현" 서술)
- `plan/in-progress/spec-update-avatar-upload-implemented.md` 로 planner 트랙에 정확히 위임됨(줄 번호까지 인용, `spec/2-navigation/9-user-profile.md:136,334` / `spec/0-overview.md:269,276` / `spec/data-flow/4-file-storage.md:58,71,78` / `spec/5-system/3-error-handling.md` 에러 카탈로그). developer 가 `spec/` 을 직접 고치지 않은 것은 CLAUDE.md 자기-반증형 소정정 예외에 해당하지 않으므로(제품 정의 서술이지 developer 자신이 쓴 예고 아님) 절차상 올바르다. **매트릭스 위반 아님.**

### 4. `new-error-code` / `new-warning-code` — REST 에러 코드 `FILE_REQUIRED`/`INVALID_FILE_TYPE`
- `grep -n "FILE_REQUIRED\|INVALID_FILE_TYPE" codebase/backend/src` 로 실측: `users.service.ts` 의 `BadRequestException({code: 'FILE_REQUIRED'|'INVALID_FILE_TYPE', ...})` 이며, `codebase/backend/src/nodes/core/error-codes.ts` 의 `ErrorCode` enum 도, backend `warningRules` 도 아니다. `codebase/frontend/src/lib/i18n/backend-labels.ts` 에 `FILE_REQUIRED`/`INVALID_FILE_TYPE` 매핑이 없음을 확인했으나, 같은 컨트롤러의 기존 REST 코드(`USER_NOT_FOUND`/`INVALID_PASSWORD`)도 동일하게 `backend-labels.ts` 에 없다 — 이 매핑 테이블은 노드 실행 UI(zod ui.label/warningRules/ErrorCode enum) 스코프이지 REST 컨트롤러 응답 코드 스코프가 아니다. **매트릭스 trigger 글롭(`error-codes.ts`)에 해당하지 않아 gap 아님**(라운드 1 판정과 동일, 재확인).

### 5. CHANGELOG 문서화 — 매트릭스 항목은 아니지만 라운드 4가 지적한 gap
- 라운드 4(`23_46_40`) `documentation.md`/`SUMMARY.md` WARNING #9: CHANGELOG 가 production 부트 가드(`main.ts` `isPrivateHost` 경고)를 언급하지 않는다고 지적.
- **이번 라운드에서 해소 확인** — `CHANGELOG.md:48` 에 "**부팅 가드**: production 에서 이 base 가 사설/loopback 주소로 판정되면 경고 로그를 남긴다…" 문단이 실제로 존재함을 `grep -n "부팅 가드"` 로 실측.

## 확인했으나 gap 아닌 항목 (재확인)
- `codebase/frontend/**/*.tsx` 변경 0건 → `new-ui-string` i18n parity 무관
- `codebase/backend/src/nodes/**` 변경 0건 → `new-node`/`node-schema-change` 무관
- `codebase/backend/src/modules/auth/**` 변경 0건(users 모듈만) → `auth-session-flow-change` 무관
- `codebase/packages/expression-engine/**` 변경 0건 → `expression-language-change` 무관
- `codebase/frontend/src/content/docs/*/` 신규 디렉토리 없음 → `new-userguide-section-dir` 무관
- 노드 실행 엔진/디버그 로깅 변경 없음 → `run-debug-flow-change` 무관
- 신규 provider 통합 없음(S3 는 인프라 설정이지 `06-integrations-and-config/` 의 "제공자" 개념 아님) → `integration-provider-change` 무관

## 요약
매트릭스 21개 trigger 중 이 changeset(backend `users` 모듈 + S3 설정 + infra manifest)에 실제로 매칭된
것은 `env-runtime-change`(README.md)와 `backend-api-change`(controller swagger + user-guide 페이지)
2건, 그리고 매트릭스 밖이지만 인접한 CHANGELOG 문서화 1건. 세 항목 모두 이전 라운드(1·4회차)가 WARNING
으로 지적했고, **이번 라운드 diff 에서 전부 실측으로 해소를 확인**했다(README.md:213 의
`S3_PUBLIC_BASE_URL`, CHANGELOG.md:48 의 부팅 가드 문단). 프런트엔드 user-guide MDX 미갱신은 소비 UI
자체가 아직 없어 회색지대(INFO)로 남지만 확정 gap 은 아니며 라운드 1 판정과 동일하다. spec 4문서의
stale 서술은 planner 트랙(`plan/in-progress/spec-update-avatar-upload-implemented.md`)에 정확히
위임돼 있어 developer 트랙 위반이 아니다. `FILE_REQUIRED`/`INVALID_FILE_TYPE` 은 REST 컨트롤러
응답 코드로 노드 ErrorCode/warningRules 스코프 밖이라 `backend-labels.ts` 매핑 대상이 아니다(기존
동종 코드와 동일 패턴, 재확인). 새로 발견된 CRITICAL/WARNING 은 없다.

## 위험도

NONE
