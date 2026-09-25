# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재
`.claude/config/doc-sync-matrix.json` (rows 21개, `new-node`~`spec-defect-found`) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑(§자주 누락되는 항목 포함)을 SoT 로 사용.

## 변경 set 요약 (origin/main...HEAD, `codebase/**` + `CHANGELOG.md` 기준 28개 파일)
- 백엔드 23개: `codebase/backend/src/modules/integrations/**` (controller·service·oauth-service·신규 `integration-visibility.ts`·DTO·각 spec) + `codebase/backend/src/modules/workflow-assistant/tools/**` (candidate-lookup·assistant-tool-router·assistant-finish-guard·explore-tools·stream, 각 spec 포함) + `codebase/backend/src/modules/workspaces/workspaces.service.ts` + 신규 e2e `codebase/backend/test/integration-personal-owner.e2e-spec.ts`
- 프런트 docs MDX 4개: `06-integrations-and-config/integration-management.{mdx,en.mdx}`, `07-workspace-and-team/workspaces-and-members.{mdx,en.mdx}`
- `CHANGELOG.md` 1개
- `codebase/frontend/src/**/*.tsx`, `dict/**`, `backend-labels.ts`, `codebase/backend/src/nodes/**`, `codebase/packages/expression-engine/**` — 이 changeset 에 **없음**

기능 요지: 통합(Integration)에 Personal/Organization scope 소유권 모델을 강제한다 — Personal 은 생성자에게만 보이고(Owner/Admin 도 예외 없음), Organization 통합의 변경(생성·수정·삭제·rotate·reauthorize·request-scopes·scope 전환)은 Admin 이상만 가능하다. 남의 Personal 통합은 "존재하지 않는 통합"과 동일한 404 로 응답한다(`spec/2-navigation/4-integration.md` §8).

## trigger 매칭 및 검증

### 1. `auth-session-flow-change` (인증·권한·세션 흐름 변경, semantic)
literal glob `codebase/backend/src/modules/auth/**` 는 매치하지 않지만, RBAC 판정 로직 신설(`integration-visibility.ts` 의 `isIntegrationVisibleTo`/`assertOrgScopeModifiable`)·`ADMIN_REQUIRED` 승격·OAuth 콜백 커밋 직전 재판정은 PROJECT.md §자주 누락되는 항목의 "인증·권한·세션 흐름 변경 vs 워크스페이스 가이드(`07-workspace-and-team/`) 미갱신" 사례에 정확히 해당해 semantic 매칭.
- target(a) `07-workspace-and-team/` 관련 페이지: **충족**. `workspaces-and-members.mdx`(41번째 줄 근방) + `.en.mdx` 양쪽에 "통합은 이 표에 예외가 있다 — Personal 은 만든 사람에게만, Owner·Admin 도 예외 없음. Viewer 도 자신의 Personal 은 재인증·scope 요청 가능" 문단이 diff 로 확인됨. KO/EN 내용 대응 확인(직접 Read 로 원문 대조).
- target(b) e2e 보강: **충족**. `codebase/backend/test/integration-personal-owner.e2e-spec.ts` 신규 파일(259줄)이 같은 changeset 안에 존재.
- 결론: 누락 없음.

### 2. `integration-provider-change` (통합 신규/제공자 변경, semantic)
신규 provider 는 아니지만 Cafe24/MakeShop 을 포함한 기존 provider 전반에 적용되는 권한 모델이 바뀜 → target `06-integrations-and-config/<provider>.{mdx,en.mdx}`.
- **충족**. `integration-management.mdx` + `.en.mdx` 양쪽에서 Viewer/Editor/Admin·Owner FieldTable 이 scope 별 권한으로 재작성됐고, "Danger zone" 탭 설명에 "Organization 삭제=Admin 이상, 본인 Personal 삭제=Editor 이상인 생성자, 범위 전환=항상 Admin" 이 반영됐으며, "팀 워크스페이스에서 공유 사용" 절에 Personal/Organization 가시성 차이가 명시됨. KO/EN 대응 일치 확인.
- cafe24.mdx/makeshop.mdx 는 이 changeset 에 없음 — 기존 "Scope: Personal/Organization, Organization 은 Admin 만 생성" 문구가 새 규칙과 충돌하지 않아 갱신 불요로 판단(신규 모순 문구 없음, 별도 확인 안 함 — 회색지대지만 diff 밖).
- 결론: 누락 없음.

### 3. `new-ui-string` (TSX 신규 한국어 리터럴, i18n parity)
이 changeset 에 `*.tsx` 변경이 전혀 없음 — 백엔드(swagger jsdoc 한국어 description 다수 변경 포함, 예: `integrations.controller.ts` 의 `FORBIDDEN_MEMBER_OR_ORG_ADMIN` 등)와 docs MDX 뿐. swagger jsdoc 은 dict 대상이 아니라 별도 target(아래 5번)으로 커버. 신규 TSX 없음 → 해당 없음.

### 4. `new-warning-code` / `new-error-code` (backend-labels.ts WARNING_KO/ERROR_KO)
`codebase/backend/src/nodes/core/error-codes.ts` 는 이 changeset 에 없음. 신규로 눈에 띄는 거부 코드 `ADMIN_REQUIRED` 는 `common/constants/workspace-roles.ts` 의 기존 `ROLE_REQUIRED.admin`(코드+한국어 완성 메시지)을 재사용하는 것으로 보이며(해당 파일 자체는 diff 밖), 컨트롤러가 `${phrase} ${ROLE_REQUIRED.admin.message}` 형태로 이미 완성된 한국어 문자열을 그대로 던진다(`integration-visibility.spec.ts` 의 `adminRequiredError` 테스트로 확인). `WARNING_KO`/`ERROR_KO` 는 노드 실행 warningRule/ErrorCode enum → frontend 한국어 매핑용이며, 이 PR 의 HTTP 403/404 예외는 그 표의 대상이 아니다(백엔드가 이미 한국어 완성 메시지를 응답). 매핑 누락 아님.
- 참고(매트릭스 밖, INFO): `integration-visibility.ts` 의 `integrationNotFoundError()` 는 영문 `'Integration not found'` 를 던진다. 이는 `Workflow not found` 등과 동일한 기존 전역 관례(모든 `RESOURCE_NOT_FOUND` 는 영문)를 따른 것이라 이 PR 이 새로 만든 gap 은 아니지만, "남의 personal 통합=존재하지 않는 통합" 규칙 때문에 이 404 발생 빈도가 종전보다 늘어난다. 매트릭스의 어떤 target 도 이 전역 관례를 가리키지 않아 판정 대상 밖.

### 5. `backend-api-change` (백엔드 API 추가·변경)
target(a) controller/DTO swagger jsdoc: **충족** — `integrations.controller.ts` 전 엔드포인트의 `@ApiForbiddenResponse`/`@ApiNotFoundResponse` description 이 새 판정 규칙(Organization Admin 필요·남의 personal=404)을 반영해 갱신됨. `integration-response.dto.ts` 의 `Cafe24PrecheckResultDto` 필드 설명도 마스킹 규칙을 추가 서술.
target(b) user-guide 페이지: 위 1·2 번과 동일 파일로 충족.

### 6. 그 외 무관 trigger
`new-node`/`node-schema-change`(`codebase/backend/src/nodes/**` 없음), `new-userguide-section-dir`(신규 `docs/<NN>-<name>/` 없음, `06-`·`07-` 는 기존 섹션), `expression-language-change`/`run-debug-flow-change`(대상 경로 변경 없음), `auth-config-type-enum-change`(무관), `new-cross-cutting-enum`/`new-backend-ui-zod-value`/`new-handler-output-field`(무관), `new-bullmq-queue`(무관) — 전부 해당 없음.

### 7. 매트릭스 범위 밖이지만 developer workflow 상 확인
`CHANGELOG.md` 가 이 PR 의 관측 가능 변화(404 치환·Admin 승격 등)를 기술하고 있음을 diff stat 으로 확인(29줄 추가). 후속 범위 분리(partial-implementation)는 본 리뷰 스코프 밖.

## 발견사항

없음 — 매칭된 모든 trigger(`auth-session-flow-change`, `integration-provider-change`, `backend-api-change`)에 대해 동반 갱신이 이미 같은 changeset 안에 KO/EN 양쪽 존재함을 diff + 원문 Read 로 직접 확인했다. 직전 라운드(`review/code/2026/09/25/23_58_59/user_guide_sync.md`, NONE) 이후 추가된 커밋(`a8b5c8b13` rotate/역할 재판정 트랜잭션 커넥션 수정)은 내부 구현 변경만 포함하며 새 사용자 가시 문자열·엔드포인트·문서 대상을 만들지 않아 이 결론에 영향 없음.

## 요약
매트릭스 21개 행 중 이번 diff(`codebase/**` 28개 파일)에 유의미하게 매칭된 것은 `auth-session-flow-change`(semantic)·`integration-provider-change`(semantic)·`backend-api-change`(semantic) 3개이며, 세 trigger 의 target(07-workspace-and-team 문서 ko/en, 06-integrations-and-config 문서 ko/en, swagger jsdoc, e2e)이 모두 같은 changeset 안에서 이미 갱신돼 누락 0건이다. TSX/신규 UI 문자열·신규 노드·신규 섹션 디렉토리·표현식 언어·신규 warning/error 코드 trigger 는 이 diff 에 해당 사항이 없다.

## 위험도
NONE
