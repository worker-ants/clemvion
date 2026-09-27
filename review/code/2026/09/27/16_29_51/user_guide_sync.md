# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재

`.claude/config/doc-sync-matrix.json` (`rows[]`, 21행) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑(line 155-234) 을 Read 했다.

## 변경 파일 인벤토리 (prompt 파일 1~14, plan 문서 제외 backend 12개)

- `CHANGELOG.md`
- `codebase/backend/src/common/utils/omit-undefined.{ts,spec.ts}`
- `codebase/backend/src/modules/auth-configs/auth-configs.service.spec.ts`
- `codebase/backend/src/modules/auth-configs/dto/auth-config-ip-whitelist.dto.spec.ts`
- `codebase/backend/src/modules/auth-configs/dto/update-auth-config.dto.ts`
- `codebase/backend/src/modules/nodes/dto/node-dto-validation.spec.ts`
- `codebase/backend/src/modules/nodes/dto/update-node.dto.ts`
- `codebase/backend/src/modules/nodes/nodes.service.spec.ts`
- `codebase/backend/src/modules/workflows/dto/update-workflow.dto.ts`
- `codebase/backend/src/modules/workflows/dto/workflow-dto-validation.spec.ts`
- `codebase/backend/test/patch-partial-body.e2e-spec.ts`
- `plan/in-progress/patch-body-followups.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md`
- `review/code/2026/09/27/{15_46_38,16_07_49}/**`, `review/consistency/2026/09/27/15_19_25/**` — 직전 리뷰 라운드 산출물(본 세션의 선행 라운드 결과물). 매트릭스 trigger 와 무관한 리뷰 메타 문서라 아래 매칭 분석에서 제외.

`git diff --name-only origin/main...HEAD` 로 재확인: `codebase/frontend/**` · `codebase/channel-web-chat/**` 경로 매치 0건. TSX·dict·docs MDX·`backend-labels.ts`·`locale.ts` 어느 것도 이 changeset 에 없다.

## 선행 라운드와의 연속성

이 코드 changeset(backend 12개 + plan 2개)은 직전 라운드(`review/code/2026/09/27/16_07_49/user_guide_sync.md`)가 리뷰한 파일 집합과 **완전히 동일**하다 — 이번 라운드에서 새로 늘어난 것은 그 라운드 자신의 산출물(`review/code/.../16_07_49/**`)과 `review/consistency/.../15_19_25/**` 뿐이며, 둘 다 리뷰 메타 문서로 코드/스키마/API surface 변경이 아니다. 즉 이번 라운드는 새 trigger 후보를 추가하지 않는 **재확인(convergence) 라운드**다. 아래는 그 결론을 독립적으로 재검증한 것이다.

## trigger 매칭 분석

### 매칭: `backend-api-change` (백엔드 API 추가·변경)

- trigger: `{ globs: ["codebase/backend/src/**/*.controller.ts", "codebase/backend/src/**/dto/**"], match: "semantic" }`
- 매칭 파일: `update-auth-config.dto.ts` · `update-node.dto.ts` · `update-workflow.dto.ts` (모두 `dto/**` 글로브 매치)
- targets(PROJECT.md 원문): "(a) controller·DTO 의 swagger jsdoc (b) API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지"

**(a) 충족.** 세 DTO 모두 같은 diff 안에서 `@ApiPropertyOptional({ nullable: true, description: '...null 이면 지운다' })` + JSDoc 코멘트를 갱신했다. 회귀 방지 캐너리(`auth-config-ip-whitelist.dto.spec.ts` · `node-dto-validation.spec.ts` · `workflow-dto-validation.spec.ts` 의 "OpenAPI 가 nullable 로 광고한다")도 동반됐다. `spec/conventions/swagger.md` 패턴 준수.

**(b) 해당 없음 — 실측 재확인.** 직접 파일을 열어 확인했다.
- `codebase/frontend/src/app/(main)/w/[slug]/authentication/auth-config-form.ts` 를 grep 했으나 이 changeset 에 frontend 파일 변경이 전혀 없다 — GUI 가 `ipWhitelist: null` 을 보내는 경로는 이번 PR 로 생기지 않았다(직전 라운드 리뷰가 실측한 그대로: `parseIpWhitelist` 결과는 항상 배열).
- `codebase/frontend/src/content/docs/` 전체에서 `ipWhitelist`/`whitelist` 를 언급하는 페이지는 `02-nodes/triggers.en.mdx` 의 무관한 문맥(`events` whitelist) 한 곳뿐. `06-integrations-and-config/` 에는 인증 설정(AuthConfig) 안내 페이지 자체가 없다(디렉터리 목록 확인: cafe24/discord/slack/telegram/models/mcp-servers/knowledge-base/agent-memory/web-chat* — AuthConfig 전용 페이지 없음).
- 워크플로/노드 `description` 도 이번 diff 에 frontend 폼 변경이 없어 GUI 소비자 동작은 그대로다.
- 이 `nullable` 광고는 **이미 존재하던 런타임 동작**(null 을 보내면 지워짐)을 OpenAPI 선언에 뒤늦게 반영한 것으로, 신규 기능·신규 GUI 흐름이 아니다. `CHANGELOG.md` 항목("Unreleased — OpenAPI: 설명 · IP 화이트리스트를 null 로 지울 수 있다고 광고한다")으로 이미 사용자 공지가 됐다. → user-guide MDX 갱신 대상 아님.

### 매칭 안 됨 (확인 후 배제)

- **new-node / node-schema-change** (`codebase/backend/src/nodes/**` glob) — 매칭 파일은 `codebase/backend/src/modules/nodes/**`(노드 CRUD API 모듈)이며, 노드 타입 레지스트리 `codebase/backend/src/nodes/{ai,core,data,flow,integration,logic,presentation,trigger}/` 와 별개 디렉터리(디렉터리 목록 직접 확인). `description` 은 노드 타입별 스키마 필드가 아니라 모든 노드 공통 컬럼 — `02-nodes/<cat>.mdx` FieldTable 대상 아님.
- **auth-session-flow-change** (`codebase/backend/src/modules/auth/**`) — 매칭 파일은 `codebase/backend/src/modules/auth-configs/**`(웹훅/트리거 수신용 인증 설정, AuthConfig 엔티티)이며 로그인/세션 모듈 `src/modules/auth/**` 와 별개 디렉터리(둘 다 존재 확인, `auth` ≠ `auth-configs`). `07-workspace-and-team/` 대상 아님.
- **auth-config-type-enum-change** — `AuthConfig.type` enum(api_key/bearer_token/basic_auth/hmac) 자체는 변경되지 않았다(`ipWhitelist` 필드 nullable 화만). `spec/1-data-model.md §2.17` · `authentication.ts` dict 대상 아님.
- **new-ui-string / i18n parity** — `codebase/frontend/**` 변경 0건 (git diff 로 재확인).
- **new-warning-code / new-error-code** — `warningRules` · `error-codes.ts` 변경 없음.
- **expression-language-change / run-debug-flow-change** — `packages/expression-engine` · 실행 엔진 변경 없음.
- **new-userguide-section-dir** — 신규 `content/docs/<NN>-<name>/` 디렉터리 없음.
- **integration-provider-change** — provider 변경 없음.
- **new-bullmq-queue / new-cross-cutting-enum / new-backend-ui-zod-value / new-handler-output-field** — 해당 코드 경로(system-status.constants.ts, WaitingInteractionType 등, zod ui.label, output.result.*) 변경 없음.

## 발견사항

없음(CRITICAL/WARNING 0건). `backend-api-change` 1개 trigger 가 매칭됐고, target (a)(swagger jsdoc)는 diff 안에서 충족, target (b)(user-guide 페이지)는 실측(GUI 미전송 경로 + 관련 안내 페이지 부재 + CHANGELOG 로 이미 공지)으로 "해당 없음"을 확인했다. 나머지 20개 trigger 는 디렉터리·도메인 확인 결과 전부 무관.

## 요약

이 changeset(backend DTO 3종의 `nullable` 선언 정정 + 캐너리/e2e 테스트 + CHANGELOG + plan 문서, frontend/channel-web-chat 변경 0건)은 매트릭스 21개 trigger 중 `backend-api-change` 1개만 매칭되며, 그 target (a)(swagger jsdoc)는 이미 동반 갱신됐고 (b)(user-guide 페이지)는 신규 기능이 아닌 기존 런타임 동작의 뒤늦은 OpenAPI 광고라 실측상 해당 없음이다. 직전 라운드(`16_07_49`)와 코드 changeset 이 완전히 동일해 독립 재검증으로 같은 결론에 수렴했다. 누락 0건.

## 위험도

NONE
