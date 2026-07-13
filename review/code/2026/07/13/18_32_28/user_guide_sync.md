# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

대상: 엣지 mid-insert(§4.1 "엣지 위에 노드 드롭 → 분할·삽입") 구현 changeset (16개 파일: `workflow-canvas.tsx` · `editor-store.ts`(+test) · `edge-utils.ts`(+test) · `spec/3-workflow-editor/2-edge.md` · `plan/complete/spec-sync-edge-gaps.md` · `CHANGELOG.md` · `review/consistency/2026/07/13/18_06_53/**`)

SSOT: `.claude/config/doc-sync-matrix.json`(rows 21개) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 본문을 함께 적재해 분석함.

## 발견사항

- **[WARNING]** 신규 구현된 엣지 mid-insert(§4.1) 유저 가이드 페이지(`03-workflow-editor/`) 동반 갱신 누락
  - 변경 파일: `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx` (`onDrop` — 드롭 지점이 기존 엣지 위면 `findEdgeIdAtPoint`+`buildEdgeSplitPlan` 로 엣지를 분할하고 중간에 노드 삽입), `codebase/frontend/src/lib/utils/edge-utils.ts`(`firstOutputHandleId`/`isContainerBoundaryEdge`/`buildEdgeSplitPlan`/`findEdgeIdAtPoint` 신설), `codebase/frontend/src/lib/stores/editor-store.ts`(`removeEdge` 에 `{skipUndo}` 추가)
  - 매트릭스 항목: SSOT JSON 의 20개 named row 중 정확히 이 상황(캔버스/에디터 GUI 인터랙션 신규·변경)을 겨냥한 glob 행은 없다(`userguide-gui-flow-section` 행은 `02-nodes/**.mdx`/`06-integrations-and-config/**.mdx` 로 스코프가 한정돼 `03-workflow-editor/**` 를 포함하지 않음). 다만 PROJECT.md 본문 "DOCUMENTATION 단계 종료 사전 체크리스트" 의 "사용자 가시면(UI 라벨·에러 메시지·노드 카드·가이드 본문)이 코드 변경의 의미를 정확히 반영하는가? 단순 동기화가 아닌 *의미 갱신*" 원칙 + `spec-major-change` 행의 부속 원칙(spec 본문이 갱신되면 그 spec 을 인용하는 user-guide 페이지도 함께 갱신)에 해당. 결정적으로 `codebase/frontend/src/content/docs/03-workflow-editor/connecting-nodes.mdx` 의 frontmatter 가 `spec: ["spec/3-workflow-editor/2-edge.md", ...]` 와 `code: [..., "workflow-canvas.tsx", "editor-store.ts", "edge-utils.ts", ...]` 로 **본 changeset 이 수정한 파일들을 정확히 코드 앵커로 선언**하고 있어, 이 문서가 §4.1 변경의 지정된 갱신 대상임이 프론트매터 상으로 명시돼 있다. `codebase/frontend/src/content/docs/03-workflow-editor/canvas-basics.mdx` 도 `code: [..., "workflow-canvas.tsx", ...]` 를 선언한다.
  - 누락된 동반 갱신:
    - `codebase/frontend/src/content/docs/03-workflow-editor/connecting-nodes.mdx` + `.en.mdx` — "연결선 편집"/"연결 규칙" 절에 §1.2(빈 영역 드롭)·§1.3(재연결/삭제)는 이미 서술돼 있으나 신규 §4.1(엣지 위에 드롭 → 분할·삽입)은 문서 어디에도 없음
    - `codebase/frontend/src/content/docs/03-workflow-editor/canvas-basics.mdx` + `.en.mdx` — "팔레트에서 캔버스로 드래그해요" 절(line 66)이 "그 자리에 노드가 추가돼요" 로만 서술해 "엣지 위에 드롭하면 분할·삽입된다" 는 예외를 언급하지 않음. 같은 문서가 §1.2(출력 포트 빈 곳 드래그)는 이미 connecting-nodes.mdx 로 상호링크하고 있어(line 81) 대칭적으로 §4.1 도 같은 문서에서 다뤄지거나 상호링크돼야 함
  - 상세: `spec/3-workflow-editor/2-edge.md` §4.1 이 신설한 사용자 가시 기능("팔레트에서 노드를 기존 엣지 위에 드롭하면 그 엣지를 분할하고 중간에 노드를 삽입")은 실제 조작 방법이 바뀐 새 GUI 동작이다. `codebase/frontend/src/content/docs/` 전체를 `grep -rl "엣지 위에\|엣지를 분할\|엣지 중간"` 로 검색한 결과 매치가 0건이라, 사용자가 문서만 보면 이 기능의 존재를 알 수 없다. `03-workflow-editor/**.mdx` 는 `nodes-coverage.test.ts`/`integrations-coverage.test.ts` 같은 build-time reverse-coverage 가드의 스코프 밖이라(가드는 `02-nodes/**`, `06-integrations-and-config/**` 만 강제) 이 누락은 CI 로 잡히지 않고 조용히 stale 상태로 남는다.
  - 제안: 같은 PR 안에서 (a) `connecting-nodes.mdx`/`.en.mdx` 에 spec §4.1 문구를 반영한 절(또는 "연결선 고치기·지우기" 절 옆)을 추가하고, (b) `canvas-basics.mdx`/`.en.mdx` 의 "팔레트에서 캔버스로 드래그해요" 절에 "엣지 위에 놓으면 그 엣지를 나누고 중간에 노드가 끼워진다"는 한 문장 + connecting-nodes.mdx 로의 상호링크를 추가. `_glossary.md`/`i18n-userguide.md` 컨벤션(해요체·GUI 흐름 절 3층 구조) 준수.

## 매칭 확인 — 갱신 누락 없음 (참고)

- **spec-major-change** (`spec/3-*/**` glob) — `spec/3-workflow-editor/2-edge.md` 변경에 대해 frontmatter `pending_plans:` 에서 완료된 `plan/in-progress/spec-sync-edge-gaps.md` 참조를 제거(→ `plan/complete/`로 이동, plan 파일도 함께 커밋됨)하고 `status: partial` + 잔여 `ai-agent-tool-connection-rewrite.md` 만 남긴 상태가 §a/§b 요구와 정합. 위반 없음.
- **new-ui-string** / i18n parity — `workflow-canvas.tsx`/`editor-store.ts`/`edge-utils.ts` diff 를 확인한 결과 신규 한국어 UI 리터럴 없음(순수 로직·주석). dict 갱신 불필요.
- **new-warning-code / new-error-code** — 신규 warningCode/errorCode 발행 없음.
- **new-userguide-section-dir** — 신규 `docs/<NN>-<name>/` 디렉토리 없음.
- 노드 추가/통합 provider 변경/표현식 언어 변경/인증 흐름 변경/BullMQ 큐 신설 — 모두 이 changeset 과 무관.

## 요약

매트릭스 21개 trigger 중 glob 매칭된 것은 `spec-major-change` 1건(정합 확인, 누락 없음)이며, `codebase/backend/src/nodes/**` 등 나머지 glob 은 이 changeset 에 해당 파일이 없어 매칭되지 않았다. 다만 SSOT 에 정확히 대응하는 named row 는 없어도 PROJECT.md 의 일반 원칙(spec 갱신 시 그 spec 을 frontmatter 로 인용하는 user-guide 페이지 동반 갱신)에 따라 `03-workflow-editor/connecting-nodes.mdx`+`canvas-basics.mdx`(+`.en.mdx` 각각)가 신규 §4.1 엣지 분할 기능을 반영하지 못한 WARNING 1건을 발견했다 — 이 경로는 build-time reverse-coverage 가드가 없어 CI 로 검출되지 않는 회색지대다. i18n dict parity·backend label 매핑·신규 섹션 locale 등록 등 CRITICAL 급 항목은 이 changeset 범위에 해당 사항이 없다.

## 위험도
MEDIUM
