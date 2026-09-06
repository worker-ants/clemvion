# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 전제 확인

- `.claude/config/doc-sync-matrix.json` (SSOT, rows 22개) 를 Read 했다.
- 변경 파일 목록(orchestrator prompt, `review/`·`plan/` 산출물 제외 실제 코드/spec 파일 26개)을 추출해 각 매트릭스 행의 `trigger.globs`/`semantic` 판단에 전수 대조했다.

## 발견사항

- **[INFO]** DTO 필드 추가가 `backend-api-change` trigger 를 glob 매칭하지만, 실질 갭 없음(이미 disclose 됨)
  - 변경 파일: `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts` (`WorkspaceMemberDto.joinedAt` 필드 추가, `@ApiProperty({ format: 'date-time', nullable: true, type: String })`)
  - 매트릭스 항목: `backend-api-change` — trigger glob `codebase/backend/src/**/dto/**` 매칭. targets 원문: "controller·DTO 의 swagger jsdoc" / "API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지"
  - 상세: (1) swagger jsdoc target 은 diff 자체에 이미 충족(필드 위 JSDoc + `@ApiProperty` 완비, `review/consistency/2026/09/06/11_55_37` W3 지적을 반영해 내부 서사는 `//` 로 분리). (2) "user-guide 페이지" target 실측: `GET /:id/members` 응답의 `joinedAt` 은 이번 PR **이전부터** `WorkspacesService.listMembers`(`workspaces.service.ts:223`, `joinedAt: m.joinedAt`)가 실제로 실어 왔고, frontend API 클라이언트(`codebase/frontend/src/lib/api/workspaces.ts:10`, `joinedAt: string | null`)도 이미 그 타입을 갖고 있었다 — 이번 diff 는 이 필드가 응답에 이미 있음을 e2e(`assertMatchesContract`)로 처음 검증하며 드러난 **선언 누락**을 DTO 에 추가한 것뿐이다. `codebase/frontend/src/content/docs/07-workspace-and-team/workspaces-and-members.mdx` grep 결과 "가입일"·`joinedAt` 관련 UI 서술이 없고, 프런트 컴포넌트(`app/(main)/w/[slug]/workspace/settings/page.tsx`)도 `joinedAt` 을 렌더링하지 않는다 — 즉 사용자에게 보이는 신규 UI 표면이 없으므로 갱신할 유저 가이드 문장 자체가 없다. CHANGELOG·DTO 주석·`plan/in-progress/spec-draft-nullable-notation-followups.md` 세 곳 모두 이 파생 발견을 "곁가지"로 투명하게 기록하고 있어(다른 reviewer 의 scope.md 도 동일 결론), 은폐된 누락이 아니다.
  - 제안: 조치 불요. 다만 향후 `joinedAt` 이 실제 UI(예: 멤버 목록 "가입일" 컬럼)로 노출되는 시점에는 `07-workspace-and-team/workspaces-and-members.mdx` + `.en.mdx` 동반 갱신이 필요하다는 점만 팀 메모로 남겨 둘 것.

- **[INFO]** `spec/conventions/review-citations.md`, `spec/conventions/spec-impl-evidence.md` 변경이 `spec-major-change` trigger 를 glob 매칭하나, 본 reviewer 관할 밖(consistency-checker/spec-frontmatter 가드 영역)
  - 변경 파일: `spec/conventions/review-citations.md`, `spec/conventions/spec-impl-evidence.md`
  - 매트릭스 항목: `spec-major-change` — targets 는 frontmatter `code:`/`status:`/`pending_plans:` 정합(‘spec-frontmatter.test.ts’ 등)이며 유저 가이드(docs MDX)·i18n dict·backend-labels 와 무관
  - 상세: 이 두 파일은 `spec/conventions/**` glob 에 걸리지만, 본 reviewer 의 점검 관점(1~9) 어디에도 해당하지 않는다(노드/스키마/UI 문자열/통합/섹션 디렉토리/인증흐름/표현식/실행-디버깅/warning-error 코드 어느 것도 아님). 해당 정합 검증은 `spec-frontmatter.test.ts` 계열 가드와 consistency-checker 의 소관이다.
  - 제안: 조치 불요(본 리뷰 범위 밖 정보 제공용).

## 매칭되지 않은 trigger (해당 없음 확인)

전체 22개 행 중, 이번 changeset(26개 실 코드/spec 파일 — `.claude/`, `CHANGELOG.md`, backend `common/db`·`triggers`·`workflow-versions`·`workspaces`·`repo-guards`·`shared/testing` 하위, backend e2e 3건, spec/conventions 2건) 은 다음 행에 매칭되지 않는다:

- `new-node`/`node-schema-change` — `codebase/backend/src/nodes/**` 변경 없음
- `new-ui-string`/`new-widget-chrome-string` — `codebase/frontend/**/*.tsx`, `codebase/channel-web-chat/**/*.tsx` 변경 없음(프런트엔드 파일 자체가 changeset 에 전무)
- `integration-provider-change` — provider 관련 backend 변경 없음
- `new-userguide-section-dir` — `codebase/frontend/src/content/docs/*/` 신규 디렉토리 없음
- `new-bullmq-queue` — `system-status.constants.ts` 변경 없음
- `new-warning-code`/`new-error-code` — `codebase/backend/src/nodes/core/error-codes.ts` 변경 없음. `triggers.service.ts` 의 `code: 'RESOURCE_CONFLICT'`/`details.code` 리팩터는 세부 코드 배치를 두 커밋에 걸쳐 정정한 것이지 신규 코드 발행이 아님(이미 `error-codes.md §4.2`·`trigger-parameter.types.ts` 가 쓰던 키로 정렬)
- `new-cross-cutting-enum`/`new-backend-ui-zod-value`/`new-handler-output-field` — 해당 없음
- `auth-session-flow-change` — `codebase/backend/src/modules/auth/**` 변경 없음(workspaces 모듈 변경은 있으나 auth 모듈 자체 변경 아님)
- `auth-config-type-enum-change` — 해당 없음
- `expression-language-change` — `codebase/packages/expression-engine/**` 변경 없음
- `run-debug-flow-change` — 실행/디버그 로깅 흐름 변경 없음
- `env-runtime-change` — 해당 없음
- `userguide-gui-flow-section` — `docs/02-nodes/**.mdx`, `docs/06-integrations-and-config/**.mdx` 변경 없음
- `spec-defect-found` — 해당 없음

## 요약

매트릭스 22개 행 중 glob 로 직접 매칭된 것은 `backend-api-change`(DTO 변경) 1건, `spec-major-change`(spec/conventions 변경) 1건뿐이며, 나머지 20개 행(신규 노드·UI 문자열·통합·섹션 디렉토리·auth 흐름·표현식·실행-디버깅·warning/error 코드 등)은 이번 changeset 에 전혀 매칭되지 않는다 — 이번 PR 은 backend 내부 헬퍼(`pg-error.ts` 리팩터)·보안 가드(`User` 컬럼 노출 검출 2축)·e2e 보강·harness 테스트 위주이고 frontend 파일이 changeset 에 전무하다. 매칭된 2건 중 DTO 변경은 실측상 이미 존재하던 필드의 선언 누락을 메운 것으로 신규 사용자-가시 표면이 없어(프런트 UI 미렌더링 확인) 유저 가이드 갱신 누락이 아니며, spec/conventions 변경은 본 reviewer 관할(user-guide/i18n/backend-labels) 밖이다. 동반 갱신 누락 CRITICAL/WARNING 은 0건.

## 위험도

NONE
