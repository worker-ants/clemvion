# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재

`.claude/config/doc-sync-matrix.json`(`rows[]`, 22개 행) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 본문을 SoT 로 사용. `git diff --name-status 53335867a HEAD` (merge-base 대비 전체 changeset, 43개 파일: backend Database·HTTP 연결 테스터 신규/리팩터 + e2e + docs mdx 2개 + spec 1개 + plan/review 산출물)를 각 trigger 에 매칭했다.

이 changeset 은 직전 두 라운드(`review/code/2026/09/19/13_58_22/user_guide_sync.md`, `review/code/2026/09/19/14_29_33/user_guide_sync.md`)가 이미 검토한 것과 `codebase/**` 범위에서 **동일**하다 — 유일한 차이는 이번 라운드 사이에 추가된 커밋 `edd468476`(DB 연결 테스트 닫기에 `DB_TEST_CLOSE_GRACE_MS` 상한 추가)인데, 이 커밋은 `database-connection-tester.ts` 내부 종료 로직만 바꿨고 신규 에러 코드·docs·i18n 표면에 아무것도 추가하지 않았다(직접 diff 확인 — `closeWithin` 헬퍼·상수 하나 추가, `IntegrationTestResult` 반환 코드 vocabulary 는 `DB_HOST_BLOCKED`/`DB_AUTH_FAILED`/`DB_CONNECT_FAILED` 그대로). 아래는 그 결과를 재실측으로 재확인한 것이다.

## 발견사항

- **[INFO]** `codebase/backend/src/nodes/**` 하위 신규/변경 파일이 "새 노드 추가"·"노드 schema 변경" trigger 의 glob(`codebase/backend/src/nodes/**`)에 문자열로는 걸리지만, 실질은 내부 리팩터라 문서 대상이 아님
  - 변경 파일: `codebase/backend/src/nodes/integration/database-query/database-connection.ts`(신규), `codebase/backend/src/nodes/integration/http-request/http-credentials.ts`(신규), `codebase/backend/src/nodes/integration/http-request/http-redirect.ts`(신규), `codebase/backend/src/nodes/integration/database-query/database-query.handler.ts`, `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts`, `codebase/backend/src/nodes/integration/http-request/http-safety.ts`
  - 매트릭스 항목: `new-node` / `node-schema-change` — targets "`02-nodes/<cat>.mdx` 의 FieldTable · `dict/{ko,en}/<section>.ts` · `backend-labels.ts`"
  - 상세: `database-query.handler.ts`/`http-request.handler.ts` diff 는 기존 핸들러 내부 함수(`buildPgConnection`/`buildMysqlSsl`/`DbCredentials`/`resolveHttpCredentials`)를 삭제하고 새 모듈 `import` 로 교체하는 것뿐이다. `database-query.schema.js`·`http-request` 의 schema 파일은 이번 diff 목록에 아예 없다 — node config 필드·라벨·placeholder·출력 스키마 미변경. 순환 import 회피 목적의 순수 코드 추출(plan `## 설계` 절이 이 이유를 명시)이라 `02-nodes/4-integration.mdx` FieldTable·`dict/nodes.ts`·`backend-labels.ts` 동반 갱신이 불요하며, 실제로 이 PR 은 건드리지 않았다 — 그것이 맞다.
  - 제안: 조치 불요(정합 확인 목적 기록).

- **[INFO]** 신규 `IntegrationTestResult.code` 값(`DB_AUTH_FAILED`·`DB_CONNECT_FAILED`·`DB_HOST_BLOCKED`·`HTTP_AUTH_FAILED`·`HTTP_CONNECT_FAILED`·`HTTP_SERVER_ERROR`·`HTTP_BLOCKED`)이 `codebase/frontend/src/lib/i18n/backend-labels.ts` 의 `ERROR_KO` 에도, `codebase/frontend/src/lib/api/integration-error-codes.ts` 의 `INTEGRATION_ERROR_CODE_TO_I18N` 화이트리스트에도 등록되지 않아 연결 테스트 실패 시 사용자가 한국어 UI 안에서 영문 원문(`result.message`)을 그대로 본다
  - 변경 파일: `codebase/backend/src/modules/integrations/database-connection-tester.ts`, `codebase/backend/src/modules/integrations/http-connection-tester.ts`
  - 매트릭스 항목: `new-error-code`("신규 errorCode 발행") — 원문: "backend-labels.ts 에 ERROR_KO 매핑 테이블이 없어 영문 message 노출됨. errorCode 추가 시 사용자 가시 ko 노출을 PR 본문에 명시(후속 plan 에서 ERROR_KO 신설 검토)". 다만 이 행의 `trigger.globs` 는 `codebase/backend/src/nodes/core/error-codes.ts` 한 파일로 좁게 걸려 있고, `IntegrationTestResult.code` 는 그 `ErrorCode` enum 소속이 아닌 별도 문자열 namespace라 이번 diff 로는 glob 이 문자열 매치되지 않는다 — 의미상 인접해 INFO 로 유지.
  - 상세: 프런트 소비 경로를 직접 재확인했다 — `codebase/frontend/src/app/(main)/w/[slug]/integrations/new/_components/test-step.tsx` 의 `TestStep` 은 `result.code` 를 읽지 않고 `result.message`(영문)를 그대로 `throw new Error(...)` 해 노출한다. `ERROR_KO` 전문을 읽어 `EMAIL_*`/`DB_*`/`HTTP_*` 어떤 항목도 없음을 확인했고(`backend-labels.ts:568-631`), 그 파일 자체 주석("ErrorCode enum 전체가 아니라 사용자 노출 빈도순 점진 확장")이 완전 커버리지를 요구하지 않는 프로젝트 정책임을 명시한다. `EMAIL_HOST_BLOCKED`/`EMAIL_CONNECT_FAILED` 도 동일하게 미등록이라(grep 확인) 이 PR 이 새로 만든 회귀가 아니라 기존 email/mcp 패턴을 database/http 로 일관되게 확장한 것이다.
  - 근거 있는 유예: `plan/in-progress/spec-draft-nullable-notation-followups.md`(이번 diff 에 포함, §"연결 테스트 결과 코드가 지역화 사전에 없다 — `EMAIL_*` 부터 이미")가 mcp·email·database·http 네 계열을 한 번에 정리할 후속 UI 결정 항목으로 이미 추적 중이며, 직전 두 라운드(`13_58_22`, `14_29_33`)의 동일 INFO 를 그 항목 안에서 명시적으로 인용해 재-flag 하지 않기로 한 근거도 적혀 있다. 매트릭스 자체가 이 trigger 에 요구하는 것도 "PR 본문에 명시"이지 즉시 매핑이 아니므로, 이 changeset 은 그 요구를 충족한다.
  - 제안: 이번 PR 범위에서 추가 조치 불요. 후속 plan 착수 시 mcp·email·database·http 네 계열 `ERROR_KO`/`INTEGRATION_ERROR_CODE_TO_I18N` 매핑을 한 번에 신설할 것(이미 followups plan 에 명시돼 있음).

- **정합 확인(위반 아님)** — `integration-provider-change` trigger 대응 완료
  - 변경 파일: `codebase/frontend/src/content/docs/06-integrations-and-config/integration-management.mdx`, `integration-management.en.mdx`
  - 확인 내용: Database·HTTP 전용 provider mdx 는 없고(`06-integrations-and-config/` 디렉터리 실측 — database/http 전용 파일 부재) 공용 `integration-management.mdx` 한 페이지가 전 서비스의 연결 테스트 범위를 설명하는 구조다. 이 changeset 이 ko/en **양쪽**에 "연결 테스트가 서비스마다 무엇을 확인하는지" `<Callout>` 을 추가했고(커밋 `0aec343e4`), rotate 관련 안내("새 값의 테스트가 통과해야 기존 값을 덮어써요")도 이미 양쪽에 반영돼 있다. frontmatter `code:` 배열에도 신규 테스터 파일 `database-connection-tester.ts`/`http-connection-tester.ts` 를 등재했다. `codebase/frontend/**/*.tsx` 변경이 없어 i18n dict parity 대상도 없다.
  - 결론: 이 trigger 에 대해 동반 갱신 누락 없음.

- **정합 확인(위반 아님)** — `backend-api-change` trigger 대응 완료
  - 변경 파일: `codebase/backend/src/modules/integrations/integrations.controller.ts`, `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts`
  - 확인 내용: `@Post('preview-test')`/`rotate` 의 `@ApiOperation.description`("구조 검증 전용" → "필드 구조를 먼저 검증하고 ... 실제로 접속" 으로 갱신)·`@ApiOkWrappedResponse`/`@ApiBadRequestResponse` description 갱신, `PreviewTestResultDto.code`/`TestConnectionResultDto.code` jsdoc(`DB_*`·`HTTP_*` 추가) 모두 이번 diff 안에 포함. 대응하는 user-guide 갱신(위 `integration-provider-change` 항목)도 같은 changeset.
  - 결론: swagger jsdoc + user-guide 동반 갱신 모두 충족.

- **영역 무관** — `new-userguide-section-dir`(신규 섹션 디렉토리 없음) · `new-ui-string`/i18n parity(`codebase/frontend/**/*.tsx` 변경 0건 — `git diff --name-status` 로 확인) · `auth-session-flow-change`(`codebase/backend/src/modules/auth/**` 미변경) · `expression-language-change`(`codebase/packages/expression-engine/**` 미변경) · `run-debug-flow-change`(`05-run-and-debug/` 무관) · `env-runtime-change`(env/README 미변경) — 전부 매칭 없음.

## 요약

매트릭스 22개 행 중 이 changeset 과 실제 관련 있는 후보는 `integration-provider-change`(매칭·이행 완료) · `backend-api-change`(매칭·이행 완료) · `new-node`/`node-schema-change`(glob 매칭이나 내부 리팩터라 회색지대, 조치 불요) · `new-error-code`(의미상 인접하나 glob 불일치, 기존 email/mcp 패턴의 일관된 확장이며 followups plan 에 이미 추적·유예 근거 명시) 4갈래였다. CRITICAL/WARNING 급 동반 갱신 누락은 없음 — docs mdx 는 ko/en 동시 커밋(`0aec343e4`)되고 frontmatter `code:` 도 갱신됐으며, frontend TSX 변경이 없어 i18n dict parity 이슈도 없다. INFO 2건은 직전 두 라운드(`13_58_22`, `14_29_33`)가 이미 식별한 것과 동일하며, 이번 라운드에서 추가된 유일한 커밋(`edd468476`, DB 닫기 grace 상한)도 이 결론에 영향을 주지 않음을 재확인했다. 새로 발견된 갭 없음.

## 위험도

NONE
