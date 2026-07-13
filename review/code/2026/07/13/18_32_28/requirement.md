## 발견사항

이번 변경은 `spec/3-workflow-editor/2-edge.md` §4.1(엣지 중간 노드 삽입)의 신규 구현이며, 사전에 `consistency-check --impl-prep`(`review/consistency/2026/07/13/18_06_53`, BLOCK:NO, WARNING 5건)를 거쳤고 CHANGELOG·spec·plan 이 그 결과를 반영하고 있다. 코드를 직접 실행/검증한 결과는 다음과 같다.

- **[INFO]** 실제 검증 결과 — 기능 정상 동작 확인
  - 위치: `codebase/frontend/src/lib/utils/edge-utils.ts` (`firstOutputHandleId`/`isContainerBoundaryEdge`/`buildEdgeSplitPlan`/`findEdgeIdAtPoint`), `codebase/frontend/src/lib/stores/editor-store.ts` (`removeEdge` skipUndo), `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx` (`onDrop`)
  - 상세: `npx vitest run src/lib/utils/__tests__/edge-utils.test.ts src/lib/stores/__tests__/editor-store.test.ts` → 150/150 통과. `npx tsc --noEmit` clean. 코드 추적으로 확인한 불변식: (1) `buildEdgeSplitPlan` 은 원본 엣지의 `sourceHandle`/`targetHandle` 이 `body`/`done`/`emit` 이 아님(= `isContainerBoundaryEdge` 로 이미 배제)을 보장하므로, 분할로 생성되는 두 신규 Connection(`sourceToNew`/`newToTarget`) 은 `detectContainerConflict` 의 body/emit 분기 조건(`sourceHandle==='body'`/`targetHandle==='emit'`)에 절대 걸리지 않는다 — 즉 분할이 시작되면(plan≠null) `onConnect` 두 번이 실패할 경로가 없어 "노드는 추가됐는데 엣지 하나만 실패해 그래프가 반쪽만 갱신되는" 원자성 문제가 실제로는 발생하지 않는다. (2) `pushUndo` 스냅샷은 `buildAndAddNode` 내부에서 노드 추가 **직전**에 1회만 찍히고 이후 `removeEdge`/`onConnect`×2 는 모두 `{skipUndo:true}`이므로, `undo()` 는 정확히 원본 nodes/edges 스냅샷(신규 노드 없음, 원본 엣지 있음, 신규 엣지 2개 없음)으로 복원한다 — spec 서술("Ctrl+Z 1회에 삽입 전체 취소")과 일치. (3) `edges`/`removeEdge`/`onConnect` 는 모두 `useEditorStore` selector·store 액션이라 `onDrop` 의 `useCallback` 의존성 배열에 정확히 포함돼 stale-closure 위험 없음.
  - 제안: 없음(정상).

- **[INFO]** `onDrop` 통합 배선 자체에 대한 컴포넌트/RTL 수준 테스트 부재
  - 위치: `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx` `onDrop`
  - 상세: `findEdgeIdAtPoint`/`buildEdgeSplitPlan`/`removeEdge` skipUndo 는 순수 함수·스토어 액션 단위로는 전수 테스트되지만, "드롭 → hit-test → plan 조립 → removeEdge+onConnect×2" 전체 흐름을 실제 컴포넌트 레벨에서 검증하는 테스트는 없다(canvas RTL 하네스 부재). 다만 이는 §1.2(`onConnectEnd`→`handleAddNodeFromSearch`) 때도 동일하게 문서화된 기존 repo 관행("컴포넌트 state 결합·canvas RTL 하네스 부재로 여전히 미검증")이라 이번 PR 고유의 새 결함은 아니다.
  - 제안: 신규 결함 아님, 향후 canvas RTL 하네스가 생기면 함께 커버 권장.

- **[INFO]** spec fidelity — line-level 일치 확인
  - 위치: `spec/3-workflow-editor/2-edge.md` §4/§4.1/`## Rationale` R-3 ↔ `codebase/frontend/src/lib/utils/edge-utils.ts`, `workflow-canvas.tsx`, `editor-store.ts`
  - 상세: spec §4.1 4개 불릿(포트 선택/적용 범위/컨테이너 경계 제외/undo)이 코드와 함수 시그니처·핸들명(`firstInputHandleId`/`firstOutputHandleId`/`isContainerBoundaryEdge`/`buildEdgeSplitPlan`/`findEdgeIdAtPoint`)·동작 그대로 대응한다. R-3 Rationale 도 impl-prep WARNING(#2, #3)의 근거·대안(a/b/c)·결정을 정확히 반영. `plan/complete/spec-sync-edge-gaps.md` 의 완료 서술과도 일치. `status: partial` 유지는 `pending_plans: ai-agent-tool-connection-rewrite.md`(§7 Tool Area 별도 재설계, 여전히 in-progress)가 남아있어 `spec-impl-evidence.md` 컨벤션("status: partial 시 pending_plans 의무")과 부합 — 오류 아님.
  - 제안: 없음(정상).

- **[INFO]** TODO/FIXME/HACK/XXX 미검출
  - 위치: 변경된 5개 소스 파일 전체(`grep -ni "TODO\|FIXME\|HACK\|XXX"`)
  - 상세: 미완성 표식 없음.

## 요약
팔레트 노드를 기존 엣지 위에 드롭해 엣지를 분할·삽입하는 §4.1 기능은 의도한 대로 완전히 구현됐다. 핵심 위험 지점(undo 원자성, 컨테이너 경계 상호작용, 다중/제로 포트 노드 처리)은 모두 impl-prep 의 WARNING 5건을 반영해 명시적으로 스코프 한정(R-3)했고, 코드 추적으로 그 불변식(분할이 성립하면 `onConnect` 실패 경로가 없어 그래프 반쪽 갱신 위험이 없음, undo 스냅샷이 삽입 전체를 정확히 되돌림)이 실제로 보장됨을 확인했다. `spec/3-workflow-editor/2-edge.md` §4.1·`## Rationale` R-3 은 구현과 line-level 로 일치하며, 관련 plan(`spec-sync-edge-gaps.md`)도 완료 처리·이동됐다. vitest 150/150 통과, tsc clean 을 직접 재현 확인했고 TODO/FIXME 류 미완성 표식도 없다. CRITICAL/WARNING 급 결함 없음.

## 위험도
NONE