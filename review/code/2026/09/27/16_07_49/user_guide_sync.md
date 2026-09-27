# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재

`.claude/config/doc-sync-matrix.json` (`rows[]`, 21행) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑(line 155-234) 을 Read 했다.

## 변경 파일 인벤토리 (`git diff --name-only origin/main...HEAD`, 34개)

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
- `review/code/2026/09/27/15_46_38/**`, `review/consistency/2026/09/27/15_19_25/**` (직전 리뷰 라운드 산출물, 매트릭스 무관)

`codebase/frontend/**` · `codebase/channel-web-chat/**` 파일은 이 changeset 에 **전혀 없다** — TSX·dict·docs MDX·`backend-labels.ts`·`locale.ts` 어느 것도 손대지 않았다.

## 선행 리뷰와의 연속성

이 changeset 은 동일 브랜치(`patch-body-followups`)의 `/ai-review` 1R(`review/code/2026/09/27/15_46_38`)이 이미 한 번 훑은 코드에, 그 1R 의 W1·W2 처방(헬퍼 null 인자 캐너리, e2e E 를 리소스별 E1/E2/E3 로 분리)을 반영한 커밋(`3cc0d092f`, `fb3b764c4`, `5f614f9d6`)을 더한 것이다. 그 1R 세션의 `user_guide_sync.md` 가 이미 `backend-api-change` trigger 매칭 + target (a)(b) 검증을 수행해 NONE 위험도로 결론지었다(파일 28, review/code/2026/09/27/15_46_38/user_guide_sync.md). 이번 라운드에 추가된 파일은 전부 **테스트 전용**(`*.spec.ts` 신규 `it`/`describe`, e2e 케이스 분리)과 **plan/review 문서**이며, 새 backend API surface·필드·enum·warning/error code 를 추가하지 않는다 — 즉 매트릭스 관점에서 새 trigger 를 만들지 않는다. 아래는 그 결론을 독립적으로 재확인한 것이다.

## trigger 매칭 분석

### 매칭: `backend-api-change` (백엔드 API 추가·변경)

- trigger: `{ globs: ["codebase/backend/src/**/*.controller.ts", "codebase/backend/src/**/dto/**"], match: "semantic" }`
- 매칭 파일: `update-auth-config.dto.ts` · `update-node.dto.ts` · `update-workflow.dto.ts` (모두 `dto/**` 글로브 매치)
- targets: (a) `controller·DTO 의 swagger jsdoc` (b) `API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지`

**(a) 충족.** 세 DTO 모두 JSDoc 코멘트와 `@ApiPropertyOptional({ nullable: true, description: '...null 이면 지운다' })` 를 같은 시리즈(`c7d8d75df`)에서 갱신했고, `swagger-dto-contract.spec.ts` 를 보완하는 `contractForDto` 회귀 캐너리(파일 5·7·11 — `auth-config-ip-whitelist.dto.spec.ts` · `node-dto-validation.spec.ts` · `workflow-dto-validation.spec.ts`)가 이번 diff 에도 포함돼 있다. `spec/conventions/swagger.md` 패턴 준수.

**(b) 해당 없음 — 실측 확인.** `codebase/frontend/src/app/(main)/w/[slug]/authentication/auth-config-form.ts:122-127` 을 재확인했다 — 갱신 페이로드는 `parseIpWhitelist(state.ipWhitelistRaw)` 결과(항상 배열, 비우면 `[]`)만 담고, `null` 을 보내는 GUI 경로가 없다. `codebase/frontend/src/content/docs/` 전체에서 `ipWhitelist`/`화이트리스트` 를 언급하는 페이지도 `02-nodes/triggers.mdx` 하나뿐이며 인증 설정 `ipWhitelist` PATCH null 동작과 무관한 문맥이다(`06-integrations-and-config/` 에는 관련 안내 페이지 자체가 없음). 워크플로/노드 `description` 도 이번 diff 에 frontend 폼 변경이 없어 GUI 소비자 동작은 그대로다. 이 `null` 수용 광고는 **직접 API 호출 클라이언트**를 위한 OpenAPI 정확도 보정이며, `CHANGELOG.md` 항목("OpenAPI: 설명 · IP 화이트리스트를 null 로 지울 수 있다고 광고한다")으로 이미 문서화됐다 — 사용자 가이드 MDX 갱신 대상이 아니다.

### 매칭 안 됨 (확인 후 배제)

- **new-node / node-schema-change** — 매칭 파일은 `src/modules/nodes/**`(노드 CRUD API 모듈, 엔티티 공통 컬럼)이며 `src/nodes/<cat>/<name>/`(노드 타입 레지스트리) 트리와 무관. `description` 은 노드 타입별 스키마 필드가 아니라 모든 노드 공통 컬럼 — `02-nodes/<cat>.mdx` FieldTable 대상 아님.
- **auth-session-flow-change** — 매칭 파일은 `src/modules/auth-configs/**`(워크플로 트리거/웹훅 수신용 인증 설정)이며 로그인/세션 모듈(`src/modules/auth/**`)과 별개 디렉터리. `07-workspace-and-team/` 대상 아님.
- **new-ui-string / i18n parity** — `codebase/frontend/**` 변경 0건.
- **new-warning-code / new-error-code** — `warningRules`·`error-codes.ts` 변경 없음.
- **expression-language-change / run-debug-flow-change** — `packages/expression-engine`·실행 엔진 변경 없음.
- **new-userguide-section-dir** — 신규 `content/docs/<NN>-<name>/` 디렉터리 없음.
- **integration-provider-change / auth-config-type-enum-change** — provider·`type` enum 변경 없음.

## 결론

`backend-api-change` 1개 trigger 가 매칭됐다. target (a)(swagger jsdoc)는 동일 시리즈 커밋에서 충족, target (b)(user-guide 페이지)는 실측(GUI 미전송 + 관련 안내 페이지 부재)으로 해당 없음을 재확인했다. 이번 라운드에서 추가된 파일(테스트 전용 5개 + plan/review 문서)은 새 매트릭스 trigger 를 만들지 않는다. 나머지 20개 trigger 는 디렉터리·도메인 확인 결과 전부 무관. CRITICAL/WARNING 발견 없음.

## 위험도

NONE
