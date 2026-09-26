# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 검토 절차 요약

`.claude/config/doc-sync-matrix.json` (rows 20개) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 본문을 적재했다.
변경 파일 목록(`git diff --name-only HEAD~5 HEAD`)은 다음과 같다 — 전부 `codebase/backend/**` 와 harness/plan/CHANGELOG 이고,
**`codebase/frontend/**` · `codebase/channel-web-chat/**` 는 0건**:

- `codebase/backend/src/modules/auth-configs/auth-configs.controller.ts`
- `codebase/backend/src/modules/integrations/integrations.controller.ts`
- `codebase/backend/src/modules/knowledge-base/knowledge-base.controller.ts`
- `codebase/backend/src/modules/schedules/schedules.controller.ts`
- `codebase/backend/src/modules/workflow-assistant/workflow-assistant.controller.ts`
- `codebase/backend/src/modules/workflows/workflows.controller.ts`
- `codebase/backend/src/modules/workspaces/workspaces.controller.ts`
- `codebase/backend/src/repo-guards/__tests__/fixtures/http-status-advertised/sample.controller.ts` (신규, 테스트 fixture)
- `codebase/backend/test/*.e2e-spec.ts` (기대값 200/201 조정), `CHANGELOG.md`, `plan/in-progress/post-status-openapi.md`

변경 내용은 POST 액션 14곳(`regenerate`·`preview-test`·`oauth/begin`·`:id/test`·`:id/rotate`·`:id/reauthorize`·
`:id/request-scopes`·`search`·`preview`·`sendMessage`·`:id/save`·`leave`·`transfer-ownership`·`acceptInvitation`)에
`@HttpCode(HttpStatus.OK)`를 추가해 **이미 OpenAPI로 200을 광고 중이던** 것과 런타임(Nest 기본값 201)을 일치시키고,
초대 취소 1곳은 반대로 광고(`@ApiNoContentResponse` 204)를 이미 그렇게 동작하던 런타임(200 + `OkResultDto`)에 맞춰 정정한
것이다. 신규 노드·신규 UI 문자열·신규 provider·신규 섹션·표현식 언어·auth 흐름 로직 변경은 없다.

## trigger 매칭

- **`backend-api-change`** (change_type: "백엔드 API 추가·변경", trigger: `codebase/backend/src/**/*.controller.ts`, match: semantic) — **매칭됨**. targets: (a) "controller·DTO 의 swagger jsdoc" (b) "API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지".
  - (a) 는 이 변경 set 자체가 swagger jsdoc(HttpCode/Api*Response 데코레이터)을 실제 동작과 일치시키는 작업이므로 같은 커밋 안에서 충족됨.
  - (b) 확인을 위해 영향받는 액션(초대 취소/나가기/owner 이양/auth-config 재발급/통합 preview·oauth·rotate·reauthorize·request-scopes/RAG 검색/cron 미리보기/캔버스 저장/assistant 메시지)에 대응하는 user-guide MDX(`07-workspace-and-team/workspaces-and-members.{mdx,en.mdx}`, `06-integrations-and-config/*.mdx`, `02-nodes/triggers.mdx`, `02-nodes/integrations.mdx`)를 grep 했다. 이 문서들은 전부 **행위 수준**으로 서술한다(예: "나가기 — 본인 멤버십만 제거해요", "Owner 이양 — 역할이 동시에 swap"), 응답의 raw HTTP status code(200/201/204)를 인용하지 않는다. 실제로 200/201/204 리터럴이 등장하는 곳은 `triggers.mdx` §응답 코드(웹훅 트리거 계약)와 `integrations.mdx` 의 HTTP 노드 실행 meta 예시뿐이며, 둘 다 이번 diff 의 대상 엔드포인트(대시보드 관리 API)와 무관하다.
  - 이번 변경은 **이미 문서(OpenAPI)에 광고돼 있던 상태를 런타임이 뒤늦게 따라가는** 정정(반대로 초대 취소는 런타임이 먼저였고 문서가 뒤늦게 따라감)이라, 사용자에게 새로 노출되는 행동·화면 변화가 없다. 따라서 (b) 갭 없음으로 판단.
- **그 외 19개 row** — glob/semantic 모두 불일치. 신규 노드 디렉토리(`src/nodes/**`) 없음, `*.tsx` 없음, `channel-web-chat` 없음, provider 신규/변경 없음(기존 모든 provider 에 공통 적용되는 일반 액션 엔드포인트일 뿐), `docs/*/`(신규 섹션) 없음, `system-status.constants.ts` 없음, warningRules/`error-codes.ts` 없음, `modules/auth/**`(권한·세션 흐름) 없음 — 건드린 모듈은 `auth-configs`(별개 모듈)·`workspaces`이고 인가 로직(`@Roles`) 자체는 변경 없음, `packages/expression-engine/**` 없음, 실행·디버깅 엔진 로직 변경 없음(SSE 핸들러는 상태 코드만 조정, 스트리밍 로직 불변), `spec/2-5-*/conventions/**` 없음(swagger.md 규약 갱신은 이 changeset 이전 별도 커밋 `4b88bcf74`에서 이미 반영됨 — plan 체크리스트 확인).
- `codebase/backend/src/repo-guards/__tests__/fixtures/http-status-advertised/sample.controller.ts` 는 테스트 fixture(`@Controller('fixture')`)이며 프로덕션 스캔 루트(`src/modules`) 밖이라 매트릭스 어느 trigger 도 적용되지 않는다.

## 발견사항

없음 — 매칭된 유일한 trigger(`backend-api-change`)의 두 target 모두 같은 changeset 안에서 충족되거나(swagger jsdoc), 사용자 가이드 영향이 없음을 실측(grep)으로 확인했다(문서가 status code 를 인용하지 않음).

## 요약

매트릭스 20개 row 중 `backend-api-change` 1개만 glob 매칭됐고, 이는 "이미 광고된 200 을 런타임이 뒤늦게 따라가는(및 반대로 광고가 런타임을 뒤늦게 따라가는)" 순수 API 계약 정합화 커밋이라 사용자 가이드 MDX·i18n dict·backend-labels 어느 것도 갱신 대상이 아님을 확인했다(해당 엔드포인트를 서술하는 07-workspace-and-team·06-integrations-and-config·02-nodes 문서 전부 행위 수준 서술이며 raw status code 를 인용하지 않음). frontend/channel-web-chat 파일은 이번 changeset 에 0건이라 i18n parity·섹션 locale·provider docs 트리거 자체가 발생하지 않는다. 동반 갱신 누락 0건.

## 위험도

NONE
