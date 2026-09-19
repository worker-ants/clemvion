# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재

`.claude/config/doc-sync-matrix.json`(`rows[]`, 22개 행) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 본문을 SoT 로 사용. 변경 파일 42개(backend Database·HTTP 연결 테스터 신규/리팩터 + e2e + docs mdx 2개 + spec 1개 + plan/review 산출물)를 각 trigger 에 매칭했다.

이 changeset 은 직전 라운드(`review/code/2026/09/19/13_58_22/user_guide_sync.md`)가 이미 검토한 것과 **코드 내용이 동일**하다(git diff 로 대조 — `codebase/**` 변경 파일 목록·내용 일치, 유일한 차이는 `plan/in-progress/integration-db-http-testers.md`·`spec-draft-nullable-notation-followups.md` 의 plan 갱신뿐). 아래는 그 결과를 재실측으로 재확인한 것이다.

## 발견사항

- **[INFO]** `codebase/backend/src/nodes/**` 하위 신규/변경 파일이 "새 노드 추가"·"노드 schema 변경" trigger 의 glob 에 문자열로는 걸리지만, 실질은 내부 리팩터라 문서 대상이 아님
  - 변경 파일: `codebase/backend/src/nodes/integration/database-query/database-connection.ts`(신규), `codebase/backend/src/nodes/integration/http-request/http-credentials.ts`(신규), `codebase/backend/src/nodes/integration/http-request/http-redirect.ts`(신규), `codebase/backend/src/nodes/integration/database-query/database-query.handler.ts`, `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts`, `codebase/backend/src/nodes/integration/http-request/http-safety.ts`
  - 매트릭스 항목: `new-node` / `node-schema-change` — targets "`02-nodes/<cat>.mdx` 의 FieldTable · `dict/{ko,en}/<section>.ts` · `backend-labels.ts`"
  - 상세: diff 를 직접 대조했다. `database-query.handler.ts`/`http-request.handler.ts` diff 는 기존 핸들러 내부 함수(`buildPgConnection`/`buildMysqlSsl`/`DbCredentials`/`resolveHttpCredentials`)를 삭제하고 `import` 로 교체하는 것뿐이며, `database-query.schema.js`·`http-request` 의 schema 파일은 이번 diff 목록에 아예 없다(node config 필드·라벨·placeholder·출력 스키마 미변경). 순환 import 회피 목적의 순수 코드 추출 — `02-nodes/4-integration.mdx` FieldTable·`dict/nodes.ts`·`backend-labels.ts` 동반 갱신 불요하며 실제로 이 PR 은 건드리지 않았다.
  - 제안: 조치 불요(정합 확인 목적 기록).

- **[INFO]** 신규 `IntegrationTestResult.code` 값(`DB_AUTH_FAILED`·`DB_CONNECT_FAILED`·`DB_HOST_BLOCKED`·`HTTP_AUTH_FAILED`·`HTTP_CONNECT_FAILED`·`HTTP_SERVER_ERROR`·`HTTP_BLOCKED`)이 `backend-labels.ts` `ERROR_KO` 에 없음 — 단 **기존 email/mcp 테스터와 동일한 선례**이고, 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md`(이번 diff 에 포함)에 낮은 우선순위 후속 항목으로 등재됨
  - 변경 파일: `codebase/backend/src/modules/integrations/database-connection-tester.ts`, `codebase/backend/src/modules/integrations/http-connection-tester.ts`
  - 매트릭스 항목: `new-error-code`("신규 errorCode 발행") — 이 행의 trigger glob 은 `codebase/backend/src/nodes/core/error-codes.ts` 한 파일로 좁게 걸려 있고 이번 diff 에서 그 파일은 변경되지 않았다(`IntegrationTestResult.code` 는 그 `ErrorCode` enum 소속이 아닌 별도 문자열 namespace). PROJECT.md 167/172행: 이 상황은 원래 "후속 가드 미도입" 상태로, 요구사항은 CRITICAL 매핑이 아니라 **"errorCode 추가 시 사용자 가시 ko 노출을 PR 본문에 명시"**다. 커밋 `9e91352d8`/`eebf0286a` 본문에는 이 caveat 이 명시되어 있지 않지만, `error-codes.ts` enum 이 아니므로 그 요구사항의 리터럴 대상도 아니다.
  - 상세: 프런트 소비 경로 재확인 — `codebase/frontend/src/app/(main)/w/[slug]/integrations/new/_components/test-step.tsx` 의 `TestStep` 은 `result.code` 를 전혀 읽지 않고 `test.error.message`(영문 원문)를 그대로 노출한다. `codebase/frontend/src/lib/api/integrations.ts` 의 `previewTest()`/`test()` 반환 타입도 `{ success, message }` 뿐 `code` 를 아예 선언하지 않는다. `grep`으로 `EMAIL_HOST_BLOCKED`·`EMAIL_CONNECT_FAILED` 도 `ERROR_KO` 에 0건 확인 — 이 PR 이 새로 만든 회귀가 아니라 기존 email/mcp 패턴을 database/http 로 일관되게 확장한 것.
  - 제안: 이번 PR 범위에서 추가 조치 불요. `plan/in-progress/spec-draft-nullable-notation-followups.md`(§"연결 테스트 결과 코드가 지역화 사전에 없다")가 이미 mcp·email·database·http 네 계열을 한 번에 정리할 후속 항목으로 추적 중이므로 재-flag 하지 않음.

- **정합 확인(위반 아님)** — `integration-provider-change` trigger 대응 완료
  - 변경 파일: `codebase/frontend/src/content/docs/06-integrations-and-config/integration-management.mdx`, `integration-management.en.mdx`
  - 확인 내용: Database·HTTP 전용 provider mdx 는 없고(디렉터리 실측 — database/http 전용 파일 부재) 공용 `integration-management.mdx` 가 전 서비스 연결 테스트 범위를 설명하는 구조. 이번 changeset 이 ko/en **양쪽**에 "연결 테스트가 서비스마다 무엇을 확인하는지" `<Callout>` 을 추가했고(커밋 `0aec343e4`), frontmatter `code:` 배열에도 신규 테스터 파일 `database-connection-tester.ts`/`http-connection-tester.ts` 를 등재했다. `codebase/frontend/**/*.tsx` 변경이 없어 i18n dict parity 대상도 없음.
  - 결론: 이 trigger 에 대해 동반 갱신 누락 없음.

- **정합 확인(위반 아님)** — `backend-api-change` trigger 대응 완료
  - 변경 파일: `codebase/backend/src/modules/integrations/integrations.controller.ts`, `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts`
  - 확인 내용: `@Post('preview-test')` 의 `@ApiOperation.description`(구조 검증 전용 → "필드 구조를 먼저 검증하고 ... 실제로 접속" 으로 갱신)·`@ApiOkWrappedResponse` description 갱신, `PreviewTestResultDto.code`/`TestConnectionResultDto.code` jsdoc 갱신 모두 이번 diff 안에 포함. 대응하는 user-guide 갱신(위 `integration-provider-change` 항목)도 같은 changeset.
  - 결론: swagger jsdoc + user-guide 동반 갱신 모두 충족.

- **영역 무관** — `new-userguide-section-dir`(신규 섹션 디렉토리 없음) · `new-ui-string`/i18n parity(신규 `*.tsx` 변경 없음) · `auth-session-flow-change`(`codebase/backend/src/modules/auth/**` 미변경) · `expression-language-change`(`codebase/packages/expression-engine/**` 미변경) · `run-debug-flow-change`(`05-run-and-debug/` 무관) · `env-runtime-change`(env/README 미변경) — 전부 매칭 없음.

## 요약

매트릭스 22개 행 중 이 changeset 과 실제 관련 있는 후보는 `integration-provider-change`(매칭·이행 완료) · `backend-api-change`(매칭·이행 완료) · `new-node`/`node-schema-change`(glob 매칭이나 내부 리팩터라 회색지대) · `new-error-code`(의미상 인접하나 glob 불일치, 기존 email/mcp 패턴의 일관된 확장) 4갈래였다. CRITICAL/WARNING 급 동반 갱신 누락은 없음 — docs mdx 는 ko/en 동시 커밋(`0aec343e4`)되었고 frontmatter `code:` 도 갱신됐으며, frontend TSX 변경이 없어 i18n dict parity 이슈도 없다. INFO 2건은 직전 라운드(`13_58_22`)가 이미 식별한 것과 동일하며, 이후 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 낮은 우선순위 후속 항목으로 공식 등재됐음을 확인했다 — 새로 발견된 갭 없음.

## 위험도

NONE
