# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재
`.claude/config/doc-sync-matrix.json` (`rows[]`) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 본문을 SSOT 로 사용했다.

## 변경 set 요약 (origin/main...HEAD, merge-base `53335867a`)
Database · HTTP 통합의 연결 테스트가 실제로 접속하도록 바뀐 feature 브랜치. 매칭되는 매트릭스 행:
- `integration-provider-change` (통합 신규/제공자 변경, semantic) — targets: `06-integrations-and-config/<provider>.{mdx,en.mdx} + dict 키`
- `backend-api-change` (`integrations.controller.ts` · `dto/**`, semantic) — targets: swagger jsdoc + 관련 user-guide 페이지
- `spec-major-change` (`spec/2-navigation/**`, glob) — targets: frontmatter `code:`/`status:` 정합

검토 대상이 아닌 것으로 확인(트리거 매칭 안 됨): `new-node`/`node-schema-change`(노드 스키마·필드 변경 없음, `database-query.handler.ts`·`http-request.handler.ts`는 순수 내부 리팩터 — `DbCredentials`/`buildPgConnection`/`resolveHttpCredentials` 추출뿐 `02-nodes/**.mdx` FieldTable 대상 필드 불변), `new-ui-string`(변경 set 에 `.tsx` 파일 없음 — `git diff --stat origin/main...HEAD`로 확인), `new-error-code`/`new-warning-code`(`error-codes.ts`·warningRules 미변경 — 이 PR 이 던지는 `DB_AUTH_FAILED`/`DB_CONNECT_FAILED`/`HTTP_AUTH_FAILED`/`HTTP_SERVER_ERROR`/`HTTP_CONNECT_FAILED`는 `ErrorCode` enum 이 아니라 `modules/integrations/*-connection-tester.ts` 전용 `IntegrationTestResult.code` 네임스페이스이고, 그 `message`는 기존 MCP_*/EMAIL_* 코드와 동일하게 원문 그대로 클라이언트에 노출하는 기존 설계다 — `backend-labels.ts`의 `WARNING_KO`/`ERROR_KO`는 이 경로를 타지 않는다), `new-userguide-section-dir`/`auth-session-flow-change`/`expression-language-change`/`run-debug-flow-change` — 해당 없음.

## 발견사항

- **[INFO]** 통합 추가 플로우의 "프리뷰 테스트 진행 중" 로딩 카피가 이전 동작("레지스트리 구조 검증만")을 서술한 채 남아 있을 수 있음
  - 변경 파일: 이 PR 은 `codebase/frontend/src/app/(main)/w/[slug]/integrations/new/_components/test-step.tsx` 를 건드리지 않았고, `codebase/frontend/src/lib/i18n/dict/{ko,en}/integrations.ts` 의 `runningProbe` 키도 이 변경 set 밖(수정되지 않음)
  - 매트릭스 항목: `integration-provider-change` — targets "`06-integrations-and-config/<provider>.{mdx,en.mdx} + dict 키`"
  - 관련 카피: `dict/ko/integrations.ts:211` `runningProbe: "서비스 레지스트리에 대한 프리뷰 테스트를 실행하고 있어요."` / `dict/en/integrations.ts:215` `"Running a preview test against the service registry."` — `test-step.tsx` 의 `pending` 상태(즉 `previewTest` 호출 대기 중)에 그대로 노출됨
  - 상세: 이 문구는 `preview-test` 가 `SERVICE_REGISTRY` 구조 검증만 하던 시절 카피다. 이번 변경으로 `mcp`/`email`/`database`/`http` 는 실제로 외부에 접속하고(최대 10초 대기), 그 사실은 `integration-management.mdx`/`.en.mdx` 의 새 Callout 과 컨트롤러 swagger 설명에는 반영됐지만, 신규 통합 등록 마법사(`new/_components/test-step.tsx`)의 로딩 카피는 "레지스트리 대상 프리뷰"라는 옛 서술 그대로다. 사용자가 실제 소요 시간(최대 10초 네트워크 대기)의 이유를 이 카피에서 유추하기 어렵다. ko/en 양쪽이 동일하게 stale 하므로 parity 위반(CRITICAL)은 아니고, 매트릭스가 강제하는 명시적 target 파일도 아니라서 확정적 누락으로 보기는 어려운 회색 지대다.
  - 제안: 다음 라운드에서 `runningProbe` 문구를 "자격 증명을 실제로 확인하는 중이에요(최대 10초 걸릴 수 있어요)" 류로 갱신하는 것을 고려. 급하지 않으면 스킵 가능.

## 이미 반영 확인 (동반 갱신 누락 아님 — 오탐 방지용 기록)
- `codebase/frontend/src/content/docs/06-integrations-and-config/integration-management.mdx` + `.en.mdx` — 연결 테스트가 서비스별로 실제 접속 여부를 다르게 확인한다는 Callout 신설, frontmatter `code:` 에 `database-connection-tester.ts`/`http-connection-tester.ts` 추가 (커밋 `0aec343e4`).
- `spec/2-navigation/4-integration.md` §5.3/§5.4/§9.2 갱신 (커밋 `74087dff6`, `975b1c3e5`) — `code:` frontmatter 는 `codebase/backend/src/modules/integrations/**` 글롭이라 신규 파일(`clamp-message.ts` 등) 별도 등재 불요.
- `integrations.controller.ts`/`integration.dto.ts`/`integration-response.dto.ts` 의 swagger jsdoc·description 전부 실제 동작(실제 접속 vs 구조 검증)에 맞춰 갱신됨.
- `CHANGELOG.md` Unreleased 항목 신설.
- `plan/in-progress/integration-db-http-testers.md` 체크리스트에 "가이드 한 줄... user-guide-writer 위임" 항목이 `[x]`로 명시돼 있어, 이번 도큐 갱신이 실수 누락이 아니라 계획된 단계였음을 확인.

## 요약
매트릭스 트리거 20개 중 이번 변경 set 이 유의미하게 매칭한 것은 `integration-provider-change`·`backend-api-change`·`spec-major-change` 3개이며, 셋 다 동일 PR 안에서 이미 동반 갱신됐다(docs MDX ko/en, swagger, spec frontmatter). i18n dict parity·`backend-labels.ts` WARNING/ERROR_KO·신규 섹션 디렉토리·노드 스키마·표현식 언어·인증 흐름 등 나머지 CRITICAL 후보 트리거는 이 변경 set 에 해당 파일이 없어 매칭되지 않는다. 유일한 관찰 사항은 통합 등록 마법사의 로딩 카피 하나가 옛 "구조 검증만" 동작을 암시하는 자구를 남기고 있다는 INFO 1건뿐이며, 이는 매트릭스가 강제하는 target 이 아니라 회색 지대다.

## 위험도
LOW
