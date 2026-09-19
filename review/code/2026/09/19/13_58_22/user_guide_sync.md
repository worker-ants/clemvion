# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재

`.claude/config/doc-sync-matrix.json` (`rows[]`, 22개 행) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 본문을 SoT 로 사용. 변경 파일 38개(backend 통합 연결 테스터 신규/리팩터 + e2e + docs mdx 2개 + plan/review 산출물)를 각 trigger 에 매칭.

## 발견사항

- **[INFO]** `codebase/backend/src/nodes/**` 하위 신규/변경 파일은 "새 노드 추가"·"노드 schema 변경" trigger 의 glob(`codebase/backend/src/nodes/**`)에 문자열로는 매칭되지만, 실제로는 신규 노드도 필드/라벨/스키마 변경도 아니다 — 회색 지대로 판단해 미보고
  - 변경 파일: `codebase/backend/src/nodes/integration/database-query/database-connection.ts`(신규), `codebase/backend/src/nodes/integration/http-request/http-credentials.ts`(신규), `codebase/backend/src/nodes/integration/database-query/database-query.handler.ts`, `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts`, `codebase/backend/src/nodes/integration/http-request/http-safety.ts`
  - 매트릭스 항목: `new-node` / `node-schema-change` — targets "`02-nodes/<cat>.mdx` 의 FieldTable · dict · backend-labels.ts"
  - 상세: diff 대조 결과 이 파일들은 기존 핸들러 내부에 있던 `buildPgConnection`/`buildMysqlSsl`/`DbCredentials`/`resolveHttpCredentials`(구 `buildHttpCredentials`)를 순환 참조 회피 목적으로 별도 모듈로 옮긴 것뿐이며, 노드의 config 필드·라벨·placeholder·출력 스키마는 한 글자도 바뀌지 않았다(핸들러 diff 는 `import` 경로 교체 + 함수 본문 삭제만). 따라서 `02-nodes/4-integration.mdx` FieldTable·`dict/{ko,en}/nodes.ts`·`backend-labels.ts` 동반 갱신 불요 — 실제로 이 PR 은 건드리지 않았고 그것이 맞다.
  - 제안: 조치 불요(정합 확인 목적으로만 기록).

- **[INFO]** 신규 `IntegrationTestResult.code` 값(`DB_AUTH_FAILED`·`DB_CONNECT_FAILED`·`HTTP_AUTH_FAILED`·`HTTP_CONNECT_FAILED`·`HTTP_SERVER_ERROR`)이 `backend-labels.ts` `ERROR_KO` 에도, `codebase/frontend/src/lib/api/integration-error-codes.ts` `INTEGRATION_ERROR_CODE_TO_I18N` 화이트리스트에도 등록되지 않음 — 다만 **기존 email/mcp 테스터와 동일한 기존 패턴**이라 이 PR 이 새로 만든 회귀는 아님
  - 변경 파일: `codebase/backend/src/modules/integrations/database-connection-tester.ts`, `codebase/backend/src/modules/integrations/http-connection-tester.ts`
  - 매트릭스 항목: `new-error-code`/`new-warning-code` (요약 9번, "신규 warningCode/errorCode 발행") — 다만 이 두 행의 glob 은 `codebase/backend/src/nodes/core/error-codes.ts` 한 파일로 좁게 걸려 있고 `IntegrationTestResult.code` 는 그 `ErrorCode` enum 소속이 아니라 이번 diff 로는 문자열 매치가 안 됨. 의미상 인접해 INFO 로 기록.
  - 상세: 프런트엔드 소비 경로를 직접 추적했다 — `.../integrations/new/_components/test-step.tsx` 의 `TestStep` 은 preview-test 실패 시 `result.code` 를 전혀 읽지 않고 `result.message`(영문 원문, 예: `The server rejected the credentials (HTTP 401).`)를 그대로 화면에 띄운다. `.../integrations/[id]/page.tsx` 의 `testMutation` 도 `res.message` 를 그대로 토스트에 보간한다(`t("integrations.connectionFailedMsg", { error: res.message })`). `formatErrorToast`(`INTEGRATION_ERROR_CODE_TO_I18N` 조회)는 `createMutation`/OAuth 시작 실패에만 쓰이고 connection-test 경로에는 배선돼 있지 않다. 기존 `EMAIL_CONNECT_FAILED`/`EMAIL_HOST_BLOCKED`(email 테스터)도 동일하게 `ERROR_KO`/`INTEGRATION_ERROR_CODE_TO_I18N` 어디에도 없어(grep 0건) 같은 미번역 상태였다 — 즉 이 PR 은 기존 설계를 Database·HTTP 로 **일관되게 확장**한 것이지 새로 깨뜨린 게 아니다. 다만 사용자는 한국어 UI 안에서 여전히 영문 실패 사유를 본다는 사실 자체는 변하지 않는다.
  - 제안: 이번 PR 범위에서 조치 불요(기존 패턴과 동일). 다만 connection-test `code` → ko 매핑을 일괄 도입하는 후속 plan 이 있다면 email/mcp/database/http 넷을 한 번에 정리하는 편이 낫다는 점만 기록해 둔다.

- **정합 확인(위반 아님)** — `integration-provider-change` trigger 대응 완료
  - 변경 파일: `codebase/frontend/src/content/docs/06-integrations-and-config/integration-management.mdx`, `integration-management.en.mdx`
  - 확인 내용: Database·HTTP 는 Cafe24/Discord/Slack 류처럼 전용 provider 페이지가 없고(`06-integrations-and-config/` 디렉터리 실측 — database/http/google/github/webhook 전용 mdx 없음), 공용 `integration-management.mdx` 한 페이지가 전 서비스의 연결 테스트 범위를 설명하는 구조다. 이번 PR 은 그 공용 페이지 **ko/en 양쪽**에 "연결 테스트가 서비스마다 무엇을 확인하는지" Callout 을 동일 커밋(`0aec343e4`)에 추가했고, frontmatter `code:` 배열에도 신규 테스터 파일 둘을 등재했다. `codebase/frontend/**/*.tsx` 변경이 없어 i18n dict parity 대상도 없다.
  - 결론: 이 trigger 에 대해 동반 갱신 누락 없음.

## 요약

매트릭스 22개 행 중 이번 diff 와 관련 있는 후보는 `new-node`/`node-schema-change`(glob 매칭이나 회색지대), `integration-provider-change`(매칭·이행 완료), `backend-api-change`(controller/dto swagger jsdoc·user-guide 동반 갱신 모두 완료), `new-error-code`/`new-warning-code`(의미상 인접하나 glob 불일치, 기존 패턴 연장) 4갈래였다. 실제 CRITICAL/WARNING 급 동반 갱신 누락은 없음 — docs mdx 는 ko/en 동시 커밋, frontend TSX 변경이 없어 i18n dict parity 이슈 없음, 신규 섹션 디렉터리·auth/세션·표현식 언어·실행/디버깅 흐름 trigger 는 전혀 매칭되지 않음. INFO 2건은 각각 "내부 리팩터라 문서 대상 아님"과 "connection-test 실패 코드의 ko 미번역은 기존 email/mcp 와 동일한 선례"임을 실측으로 확인한 기록이다.

## 위험도

NONE
