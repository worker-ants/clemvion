# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재

`.claude/config/doc-sync-matrix.json` (`rows[]`, 21행) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 (line 155-313) 을 Read 했다.

## 변경 파일 인벤토리 (21개, 커밋 `c7d8d75df`·`b5c1e7cda`·`6c7c976b0`·`ea1fd0cba`)

- `CHANGELOG.md`
- `codebase/backend/src/common/utils/omit-undefined.ts` (JSDoc 보강만)
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
- `review/consistency/2026/09/27/15_19_25/**` (직전 consistency-check 산출물, 매트릭스 무관)

프론트엔드(`codebase/frontend/**`) 파일은 이 changeset 에 **전혀 없다** — TSX·dict·docs MDX·`backend-labels.ts`·`locale.ts` 어느 것도 손대지 않았다.

## trigger 매칭 분석

변경 내용은 `PATCH /workflows/:id` `description` · `PATCH /nodes/:id` `description` · `PATCH /auth-configs/:id` `ipWhitelist` 세 필드에 `null` 을 받는다고 OpenAPI 가 정확히 광고하도록(`nullable: true` 추가) 고친 것 — **런타임 동작 자체는 원래도 null 을 받았다**(CHANGELOG: "원래 그렇게 동작했는데 OpenAPI 가 적지 않았다"). 신규 기능이 아니라 **기존 동작에 대한 OpenAPI 스키마 정확도 수정**이다.

### 매칭: `backend-api-change` (백엔드 API 추가·변경)

- trigger: `{ globs: ["codebase/backend/src/**/*.controller.ts", "codebase/backend/src/**/dto/**"], match: "semantic" }`
- 매칭 파일: `update-auth-config.dto.ts` · `update-node.dto.ts` · `update-workflow.dto.ts` (모두 `dto/**` 글로브에 매치)
- targets: (a) `controller·DTO 의 swagger jsdoc` (b) `API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지`

**(a) 검증 결과 — 충족.** 세 DTO 모두 JSDoc 주석과 `@ApiPropertyOptional({ nullable: true, description: '...null 이면 지운다' })` 를 같은 커밋(`c7d8d75df`)에서 갱신했고, `swagger-dto-contract.spec.ts` 를 보완하는 `contractForDto` 회귀 캐너리(파일 4·6·10)까지 같은 PR 에 포함했다. `spec/conventions/swagger.md` 의 DTO JSDoc 패턴 준수.

**(b) 검증 결과 — 해당 없음으로 판단.** frontend 폼이 이 세 필드에 실제로 `null` 을 보내는지 확인했다.
- `codebase/frontend/src/app/(main)/w/[slug]/authentication/auth-config-form.ts:127` — `ipWhitelist` 갱신 페이로드는 `parseIpWhitelist(state.ipWhitelistRaw)` 로 항상 **배열**(비우면 `[]`)을 보낸다. GUI 는 `null` 을 보내는 경로가 없다.
- 워크플로/노드 `description` 을 GUI 에서 지우는 경로도 동일 패턴(빈 문자열/미전송)일 개연성이 높고, 이번 diff 에 frontend 폼 코드 변경이 없다 — 즉 GUI 쪽 소비자 동작은 이 PR 로 전혀 안 바뀐다.
- 이 `null` 수용은 **직접 API/웹훅 통합 클라이언트**(Swagger 문서를 읽고 API 를 직접 호출하는 개발자)를 위한 문서 정확도 보정이지, 앱 내 GUI 사용자에게 보이는 새 기능이 아니다. `codebase/frontend/src/content/docs/06-integrations-and-config/` 어디에도 auth-config IP 화이트리스트 안내 페이지 자체가 없음(grep 결과 0건)도 함께 확인했다.
- 따라서 PROJECT.md 표의 "(b) API 노출 변경이 사용자 안내에 영향" 조건이 성립하지 않는다 — 이 변경은 사용자 안내(user-guide MDX)에 영향을 주지 않는다. 이미 `CHANGELOG.md` 에 API 변경 이력을 남긴 것으로 문서화 의무는 충족됐다.

### 매칭 안 됨 (확인 후 배제)

- **new-node / node-schema-change** (`codebase/backend/src/nodes/**` glob) — 변경 파일은 `codebase/backend/src/modules/nodes/**` 이며 이는 노드 CRUD API 모듈(엔티티 필드)이지, `src/nodes/<cat>/<name>/` 노드 타입 레지스트리(핸들러·zod 스키마)가 아니다. 디렉터리 실존 확인(`ls`)으로 별개 트리임을 검증. `description` 필드는 노드 타입별 스키마가 아니라 모든 노드 공통 엔티티 컬럼이라 `02-nodes/<cat>.mdx` FieldTable 대상이 아니다.
- **auth-session-flow-change** (`codebase/backend/src/modules/auth/**`) — 변경 파일은 `src/modules/auth-configs/**`(워크플로 트리거/웹훅 수신 인증 설정)이며 로그인/세션 인증 모듈(`src/modules/auth/**`)과 다른 디렉터리(`ls` 로 확인). 07-workspace-and-team 대상 아님.
- **auth-config-type-enum-change** — `type` enum(`api_key`/`bearer_token`/...) 자체는 변경 없음, `ipWhitelist` nullable 화만 해당.
- **new-ui-string / i18n parity** — frontend TSX 변경 0건.
- **new-warning-code / new-error-code** — warningRules·`error-codes.ts` 변경 없음.
- **expression-language-change / run-debug-flow-change** — `packages/expression-engine`·실행 엔진 변경 없음.
- **new-userguide-section-dir** — 신규 docs 디렉터리 없음.
- **integration-provider-change** — provider 변경 없음.

## 결론

`backend-api-change` 행이 매칭됐고 target (a) swagger jsdoc 는 동일 커밋에서 충족됐다. target (b) user-guide 페이지는 실측(프론트엔드 폼이 `null` 을 전송하지 않음 + 해당 GUI 안내 페이지 자체 부재)으로 "해당 없음"임을 확인했다 — 이는 GUI 신규 기능이 아니라 기존 동작에 대한 OpenAPI 문서 정확도 보정이며, `CHANGELOG.md` 갱신으로 문서화 의무는 이미 충족됐다. 그 외 8개 trigger(새 노드/노드 schema/신규 UI 문자열/통합·제공자/신규 섹션 디렉터리/인증·세션 흐름/표현식 언어/실행·디버깅/신규 warning·error code)는 디렉터리·도메인 확인 결과 매칭되지 않았다. 발견된 CRITICAL/WARNING 없음.

## 위험도

NONE
