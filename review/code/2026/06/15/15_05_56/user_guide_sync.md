# 유저 가이드 동반 갱신(User Guide Sync) 리뷰 결과

## 매트릭스 적재 요약

`.claude/config/doc-sync-matrix.json` 의 `rows[]` 19개 항목 적재 완료.

## 변경 파일 집합

git diff HEAD~1 HEAD 로 확인된 변경 파일:

- `codebase/backend/migrations/V098__execution_single_node.sql` (신규)
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (변경)
- `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` (변경)
- `codebase/backend/src/modules/executions/entities/execution.entity.ts` (변경)
- `codebase/backend/src/modules/workflows/dto/execute-node.dto.ts` (신규)
- `codebase/backend/src/modules/workflows/workflows.controller.ts` (변경)
- `codebase/backend/src/modules/workflows/workflows.controller.spec.ts` (변경)
- `codebase/backend/src/modules/workflows/workflows.module.ts` (변경)
- `codebase/backend/test/workflow-execution.e2e-spec.ts` (변경)
- `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx` (변경)
- `codebase/frontend/src/components/editor/settings-panel/node-settings-panel.tsx` (변경)
- `codebase/frontend/src/lib/api/workflows.ts` (변경)
- `codebase/frontend/src/lib/i18n/dict/en/editor.ts` (변경)
- `codebase/frontend/src/lib/i18n/dict/ko/editor.ts` (변경)
- `plan/in-progress/exec-single-node.md` (신규)
- `review/consistency/2026/06/15/13_59_42/**` (신규 — 리뷰 산출물)
- `spec/1-data-model.md`, `spec/3-workflow-editor/3-execution.md`, `spec/5-system/13-replay-rerun.md`, `spec/5-system/4-execution-engine.md` (변경)

## 트리거 매칭 결과

### 매칭된 트리거

#### T1: `run-debug-flow-change` (실행·디버깅 흐름 변경, semantic)
- 매칭 근거: `execution-engine.service.ts` 에 단일 노드 실행 분기(`singleNodeId` 분기, `seedSingleNodePredecessorOutputs`, `break` 직후 결과 마감), 신규 엔드포인트(`POST /api/workflows/:id/nodes/:nodeId/execute`), 캔버스 우클릭 컨텍스트 메뉴 "이 노드 실행"(`handleRunThisNode`), InfoTab 단일 노드 결과 표시 등 사용자 가시 실행·디버깅 흐름이 추가됨. 이는 매트릭스 `run-debug-flow-change` 행의 의미 기준("backend 실행 엔진·디버그 로깅 변경")에 해당하는 semantic 매칭.
- 필수 동반 갱신: `codebase/frontend/src/content/docs/05-run-and-debug/` 의 관련 페이지
- 실제 변경 set 내 존재 여부: **없음**

#### T2: `backend-api-change` (백엔드 API 추가·변경, semantic)
- 매칭 근거: `workflows.controller.ts` 에 신규 엔드포인트 `POST :id/nodes/:nodeId/execute` 추가 + `execute-node.dto.ts` 신규 DTO. 매트릭스 glob `codebase/backend/src/**/*.controller.ts` + `codebase/backend/src/**/dto/**` 에 매칭.
- 필수 동반 갱신: "controller·DTO 의 swagger jsdoc" (swagger jsdoc 은 controller diff 에서 `@ApiOperation`, `@ApiParam`, `@ApiBadRequestResponse` 등 완비됨 — **충족**), "API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지" — 이 신규 API 는 사용자 진입점인 캔버스 컨텍스트 메뉴와 직결되나 `05-run-and-debug/` 갱신 없음 (T1 과 중첩 누락).
- swagger jsdoc 은 충족. user-guide 페이지 누락은 T1 에서 포착.

#### T3: `new-ui-string` (신규 UI 문자열, TSX, semantic)
- 매칭 근거: `workflow-canvas.tsx`(`runThisNode`) + `node-settings-panel.tsx`(`nodeResultTitle`, `nodeResultOutput`, `nodeResultError`) 에서 `t("editor.runThisNode")`, `t("editor.nodeResultTitle")` 등 신규 i18n 키 사용.
- 필수 동반 갱신: `codebase/frontend/src/lib/i18n/dict/{ko,en}/<section>.ts` 양쪽 등록
- 실제 변경 set 내 존재 여부: `dict/ko/editor.ts` 와 `dict/en/editor.ts` 양쪽 모두 동일 4개 키(`nodeResultTitle`, `nodeResultOutput`, `nodeResultError`, `runThisNode`) 추가됨 — **parity 충족**

### 매칭되지 않은 트리거

- `new-node`: 변경 파일에 `codebase/backend/src/nodes/<cat>/` 하위 신규 노드 없음. `execution-engine/` 은 노드 구현이 아닌 실행 엔진. 해당 없음.
- `node-schema-change`: 노드 필드 변경 없음. 해당 없음.
- `new-warning-code`/`new-error-code`: diff 내 `warningRules` 또는 `error-codes.ts` 변경 없음. 해당 없음.
- `auth-session-flow-change`: `codebase/backend/src/modules/auth/**` 변경 없음. 해당 없음.
- `expression-language-change`: `codebase/packages/expression-engine/**` 변경 없음. 해당 없음.
- `new-userguide-section-dir`: 신규 docs 섹션 디렉토리 없음. 해당 없음.
- `integration-provider-change`: 통합/제공자 변경 없음. 해당 없음.

---

## 발견사항

### [WARNING] 실행·디버깅 흐름 변경 — `05-run-and-debug/` 유저 가이드 갱신 누락

- **변경 파일:**
  - `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (단일 노드 실행 분기 신설)
  - `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx` (캔버스 우클릭 컨텍스트 메뉴 "이 노드 실행" 추가)
  - `codebase/frontend/src/components/editor/settings-panel/node-settings-panel.tsx` (InfoTab 에 단일 노드 실행 결과 표시 추가)
- **매트릭스 항목:** `run-debug-flow-change` — targets: `"codebase/frontend/src/content/docs/05-run-and-debug/"`
- **누락된 동반 갱신:** `codebase/frontend/src/content/docs/05-run-and-debug/` 하위의 관련 페이지 (예: 단일 노드 실행 방법, 우클릭 메뉴 "이 노드 실행" 안내, InfoTab 결과 읽기 방법 등)
- **상세:** 이번 변경은 워크플로우 에디터에 완전히 새로운 실행 모드("이 노드 실행" / 단일 노드 테스트)를 사용자에게 노출한다. 캔버스 노드 우클릭 시 "Run this node" 메뉴가 나타나고, 설정 패널 Info 탭이 단일 노드 실행 결과를 표시한다. 이는 사용자 가이드 §05-run-and-debug 영역의 새로운 흐름이다. 해당 docs 페이지가 갱신되지 않으면 사용자가 이 기능의 존재 및 사용법(previousExecutionId 를 통한 자동 입력 주입, downstream 미진행 의미, 결과 확인 위치)을 파악하기 어렵다.
- **제안:**
  1. `codebase/frontend/src/content/docs/05-run-and-debug/` 하위에 단일 노드 실행 안내 절(또는 기존 실행 가이드 페이지에 섹션 추가)을 작성한다.
  2. 한국어(`.mdx`) + 영어(`.en.mdx`) 양쪽 동반 작성.
  3. 최소 포함 내용: (a) 캔버스에서 노드 우클릭 → "이 노드 실행" 진입 방법, (b) previousExecutionId 자동 주입 설명(직전 실행이 있으면 상류 출력을 자동 입력으로 사용), (c) downstream 미진행(§1.2 Run-from-Selected 와의 차이), (d) InfoTab 에서 결과 확인 방법.

---

## 요약

매트릭스 19개 트리거 중 이번 변경 set 에 의미적으로 매칭되는 트리거는 `run-debug-flow-change`(실행·디버깅 흐름 변경), `backend-api-change`(백엔드 API 추가), `new-ui-string`(신규 UI 문자열) 3개이다. i18n parity(`new-ui-string`)는 `dict/ko/editor.ts` + `dict/en/editor.ts` 양쪽에 4개 키가 동일하게 등록되어 충족됐고, swagger jsdoc(`backend-api-change`)도 controller diff 에서 완비됐다. 그러나 `run-debug-flow-change` 의 필수 동반 갱신인 `codebase/frontend/src/content/docs/05-run-and-debug/` 유저 가이드 페이지 갱신이 변경 set 에 없다(누락 1건). 단일 노드 실행은 사용자 가시 신규 실행 모드이므로 가이드 stale 이 발생한다.

## 위험도

WARNING
