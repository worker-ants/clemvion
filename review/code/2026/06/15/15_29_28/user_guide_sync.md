# 유저 가이드 동반 갱신(User Guide Sync) 리뷰 결과

**대상**: execution §1.3 single-node execution
**리뷰 세션**: 2026-06-15 15:29:28 (fresh post-resolution)
**매트릭스 SSOT**: `.claude/config/doc-sync-matrix.json` (rows 18개)

---

## 발견사항

발견된 누락 없음.

---

## 매트릭스 trigger 매칭 결과

### 1. run-debug-flow-change (실행·디버깅 흐름 변경) — PASS

- trigger 파일: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (신규 단일 노드 실행 분기), `codebase/backend/src/modules/workflows/workflows.controller.ts` (POST /api/workflows/:id/nodes/:nodeId/execute 엔드포인트 신설)
- 매트릭스 target: `codebase/frontend/src/content/docs/05-run-and-debug/`
- 확인: `codebase/frontend/src/content/docs/05-run-and-debug/running-a-workflow.mdx` 와 `running-a-workflow.en.mdx` 양쪽 모두 동일 changeset 에 포함돼 있으며, "이 노드 실행 / Run this node" 섹션(한국어·영문 parity 완비)과 `<ImplAnchor kind="component" symbol="handleRunThisNode">` 동반 작성이 확인됨.
- W-17 (원 리뷰 지적) 해소 확인: caller 노트 및 changeset 양쪽 MDX diff 일치.
- 판정: **충족**

### 2. new-ui-string (신규 UI 문자열 TSX) — PASS

- trigger 파일: `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx` (`t("editor.runThisNode")`), `codebase/frontend/src/components/editor/settings-panel/node-settings-panel.tsx` (`t("editor.nodeResultTitle")`, `t("editor.nodeResultOutput")`, `t("editor.nodeResultError")`)
- 매트릭스 target: `dict/{ko,en}/<section>.ts` 양쪽 — 한쪽만 추가 금지 (parity 가드 fail)
- 확인:
  - `codebase/frontend/src/lib/i18n/dict/ko/editor.ts`: `nodeResultTitle`, `nodeResultOutput`, `nodeResultError`, `runThisNode` 4개 키 추가됨.
  - `codebase/frontend/src/lib/i18n/dict/en/editor.ts`: 동일 4개 키 (`nodeResultTitle`, `nodeResultOutput`, `nodeResultError`, `runThisNode`) 추가됨.
  - ko/en 키 집합 완전 일치 (i18n parity 충족).
- 판정: **충족**

### 3. backend-api-change (백엔드 API 추가·변경) — PASS

- trigger 파일: `codebase/backend/src/modules/workflows/workflows.controller.ts`, `codebase/backend/src/modules/workflows/dto/execute-node.dto.ts`
- 매트릭스 target: Swagger jsdoc + 관련 user-guide 페이지
- 확인:
  - `workflows.controller.ts` 의 `executeNode` 메서드에 `@ApiOperation`, `@ApiParam`, `@ApiAcceptedWrappedResponse`, `@ApiBadRequestResponse`, `@ApiUnauthorizedResponse`, `@ApiForbiddenResponse`, `@ApiNotFoundResponse`, `@ApiResponse(503)` 전체 swagger 데코레이터 완비.
  - `ExecuteNodeDto` 에 `@ApiPropertyOptional` 각 필드 설명 완비.
  - 관련 user-guide 페이지: `05-run-and-debug/running-a-workflow.{mdx,en.mdx}` 에서 단일 노드 실행 진입점(우클릭 메뉴) + API 동작(previousExecutionId 주입 방식) 안내 포함.
- 판정: **충족**

### 4. 매칭되지 않은 trigger (영역 무관 판정)

아래 trigger 는 본 changeset 과 무관하다.

| 매트릭스 id | 무관 근거 |
|---|---|
| new-node | `codebase/backend/src/nodes/**` 신규 파일 없음 |
| node-schema-change | 노드 schema 파일 변경 없음 |
| integration-provider-change | 통합·제공자 변경 없음 |
| new-userguide-section-dir | `docs/<NN>-<name>/` 신규 디렉토리 없음 |
| new-warning-code | backend warningRules 변경 없음 |
| new-error-code | `error-codes.ts` (trigger glob) 변경 없음. controller 가 발행하는 `NODE_NOT_IN_WORKFLOW` / `PREVIOUS_EXECUTION_NOT_FOUND` 는 `BadRequestException` 인라인 코드로 `ErrorCode` enum 외부 — 영문 그대로 클라이언트에 전달되는 구조이나 이는 기존 패턴이며 backend-labels.ts 매핑 대상이 아님 |
| new-cross-cutting-enum | InteractionType 등 cross-cutting enum 변경 없음 |
| new-backend-ui-zod-value | backend zod ui.label/hint 변경 없음 |
| new-handler-output-field | handler output 신규 필드 없음 (isCanonicalHandlerOutput 가드 export 는 내부 식별자 추출이며 output shape 변경 아님) |
| auth-session-flow-change | `codebase/backend/src/modules/auth/**` 변경 없음 |
| auth-config-type-enum-change | AuthConfig type enum 변경 없음 |
| expression-language-change | `codebase/packages/expression-engine/**` 변경 없음 |
| env-runtime-change | 환경 변수·런타임 변경 없음 |
| spec-major-change | spec 파일 변경이 있으나 user-guide-sync 영역이 아닌 spec-frontmatter/code-paths 가드 영역 — 본 reviewer 스코프 외 |
| userguide-gui-flow-section | 변경된 MDX 가 `05-run-and-debug/` 소속이며 trigger glob(`02-nodes/**.mdx`, `06-integrations-and-config/**.mdx`)에 미매칭 |
| spec-defect-found | 해당 없음 |

---

## 요약

doc-sync-matrix.json 의 rows 18개 중 본 changeset 에 매칭되는 trigger 는 3개 (run-debug-flow-change, new-ui-string, backend-api-change) 이며, 3개 모두 동반 갱신이 완료돼 있다. i18n parity (ko/en 4개 키 완전 일치), run-and-debug MDX ko/en 양쪽 섹션 추가, ImplAnchor 동반 작성, Swagger 전 데코레이터 완비가 확인됐다. W-17(유저 가이드 갱신 누락) 은 RESOLUTION 적용으로 해소됐으며 누락 0건이다.

---

## 위험도

NONE
