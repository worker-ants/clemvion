# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 검토 방법

`.claude/config/doc-sync-matrix.json` (rows 22개) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 본문을 적재하고, 이번 changeset(`origin/main...HEAD` + 워킹트리 diff, 45개 파일)을 각 trigger 에 매칭했다. 매칭된 항목은 실제로 필요한 guard test 를 직접 실행(`vitest run`)해 통과 여부를 확인했다.

핵심 변경: Database · HTTP 통합의 연결 테스트(`preview-test` · `:id/test` · `rotate`)가 필드 형식 검증만 하던 것에서 **실제로 접속**하도록 바뀜(spec `4-integration.md` §5.3/§5.4/§9.2, planner 커밋 `74087dff6` + developer 커밋 `9e91352d8`~`6bf7c026d`). 신규 파일: `database-connection-tester.ts` · `http-connection-tester.ts` · `clamp-message.ts` · `database-connection.ts` · `http-credentials.ts` · `http-redirect.ts` (+ spec).

## 발견사항

- **[INFO]** 신규 연결 테스트 결과 코드(`DB_AUTH_FAILED` · `DB_CONNECT_FAILED` · `HTTP_AUTH_FAILED` · `HTTP_SERVER_ERROR` · `HTTP_CONNECT_FAILED`)가 `backend-labels.ts` 의 `ERROR_KO` 매핑 없이 도입됨
  - 변경 파일: `codebase/backend/src/modules/integrations/database-connection-tester.ts`, `codebase/backend/src/modules/integrations/http-connection-tester.ts`
  - 매트릭스 항목: 이 코드들은 매트릭스의 "신규 errorCode 발행 (`ErrorCode` enum 추가)" 행의 trigger glob(`codebase/backend/src/nodes/core/error-codes.ts`)에도, "신규 warningCode 발행" 행에도 정확히는 걸리지 않는다 — `IntegrationTestResult.code` 는 별도의 자유 문자열 taxonomy다. 다만 PROJECT.md §자주 누락 "backend warning/error code → ko 매핑 — 백엔드가 새 warning/error 코드를 발행하면 `backend-labels.ts` 의 `WARNING_KO` 매핑을 같은 commit 에. 누락 시 사용자에게 영문 그대로 노출"의 취지와 결이 같다.
  - 확인한 사실: (1) frontend 는 이 실패를 `res.code` 가 아니라 `res.message` 원문으로 직접 렌더한다 — `.../integrations/new/_components/test-step.tsx` 및 `.../integrations/[id]/page.tsx` 의 `t("integrations.connectionFailedMsg", { error: res.message })` (dict 값 `"테스트 실패: {{error}}"`). 즉 한국어 로케일 사용자가 `"테스트 실패: The server rejected the credentials (HTTP 401)."` 같은 한/영 혼합 문장을 본다. (2) 이 패턴은 **이 PR 이전부터** MCP_*/EMAIL_* 코드에도 동일하게 적용되던 기존 설계다 — `code` 필드 자체가 애초에 ko 로 옮겨지지 않는다. (3) `translateBackendError`/`ERROR_KO` 는 실제 production 코드 어디에서도 호출되지 않는다(`grep` 결과 `backend-labels.ts` 정의부 + 자체 테스트 파일만) — 즉 이 로컬라이제이션 인프라 자체가 이 표시 경로에 배선돼 있지 않다. (4) `backend-labels.test.ts` 의 P3-C-2 가드는 `LOCALIZED_ERROR_CODES` 라는 수동 등재 allow-list 기반(점진 확장)이라 이 신규 코드들이 없어도 **실패하지 않는다** — 실행해 확인(49/49 PASS).
  - 상세: 사용자 영향은 실재하지만(영문 노출), (a) 매트릭스 trigger 정의와 정확히 일치하지 않고 (b) 이미 존재하던 미배선 설계의 연장이라 이 diff 가 새로 만든 회귀는 아니다. `IE endMultiTurnConversation` 류의 "의도된 기존 패턴 재-flag" 오탐을 피하려 CRITICAL 이 아닌 INFO 로 내린다.
  - 제안: 후속 plan 에서 (i) `ERROR_KO`/`translateBackendError` 를 실제 connection-test 표시 경로에 배선할지, (ii) `IntegrationTestResult.code` 전용의 별도 ko 매핑 테이블을 만들지 결정. 지금 당장 이 PR 을 막을 필요는 없다.

## 매칭됐고 이미 충족된 항목 (문제 없음 — 참고용)

- **통합 신규/제공자 변경** (`codebase/frontend/src/content/docs/06-integrations-and-config/<provider>.{mdx,en.mdx} + dict 키`): `integration-management.mdx` + `.en.mdx` 양쪽에 동일 취지의 `<Callout type="note">` 가 같은 commit(`0aec343e4`)에 추가됨. frontmatter `code:` 배열에 `database-connection-tester.ts`/`http-connection-tester.ts` 도 등재. 신규 UI 문자열이 없어 dict 키 추가는 불필요.
- **user-guide GUI 흐름 절 신규/변경** (`<ImplAnchor>` 의무): 추가된 Callout 은 heading 에 "GUI" 를 포함하지 않고 bold `**...GUI...**` 도 없어 `findGuiFlowSections()` 판별 대상이 아님 — `integrations-coverage.test.ts` 실행 확인(PASS), ImplAnchor 누락 아님.
- **백엔드 API 추가·변경** (controller/DTO swagger jsdoc): `integrations.controller.ts`(`preview-test`/`rotate` jsdoc), `integration-response.dto.ts`(`code?` 필드 + jsdoc), `integration.dto.ts`(`@ApiProperty` description) 모두 같은 commit 에서 갱신됨.
- **신규 UI 문자열 / i18n parity**: 이번 diff 는 frontend TSX 를 전혀 건드리지 않음 — 대상 없음.
- **노드 schema 변경**: `database-query.handler.ts`/`http-request.handler.ts` 는 내부 헬퍼를 공유 모듈로 추출(`database-connection.ts`, `http-credentials.ts`, `http-redirect.ts`)한 리팩터이지 노드의 필드·라벨·타입(zod schema) 변경이 아님 — `.schema.ts` diff 없음. FieldTable 갱신 불필요.
- **인증·권한·세션 흐름 / 표현식 언어 / 실행·디버깅 흐름 / 신규 섹션 디렉토리**: 해당 경로(`modules/auth/**`, `packages/expression-engine/**`, `05-run-and-debug/`, `content/docs/<NN>-<name>/` 신규 디렉토리) 변경 없음 — 무관.
- Guard test 실측: `backend-labels.test.ts`(49 passed), `integrations-coverage.test.ts`(포함), `i18n.test.ts` + `no-internal-refs.test.ts` + `registry.test.ts`(600 passed) — 전부 GREEN.

## 요약

매트릭스 22개 행 중 이번 changeset 에 실질적으로 매칭된 것은 "통합 신규/제공자 변경"과 "백엔드 API 추가·변경" 두 행이며, 둘 다 동반 갱신(docs MDX ko/en·frontmatter code:·swagger jsdoc)이 같은 commit 에 이미 반영돼 있고 관련 guard test(backend-labels·integrations-coverage·i18n·registry·no-internal-refs, 총 649 tests) 를 직접 실행해 전부 PASS 를 확인했다. 유일한 발견은 새 연결-테스트 실패 코드(DB_AUTH_FAILED 등)가 ko 매핑 없이 영문 노출된다는 점인데, 이는 매트릭스 trigger 정의 밖이고 기존 MCP_*/EMAIL_* 코드에도 이미 있던 미배선 설계의 연장이라 INFO 로 내렸다. 리포지토리에 뮤테이션은 없었다(`git status --short` 리뷰 전후 동일).

## 위험도

LOW
