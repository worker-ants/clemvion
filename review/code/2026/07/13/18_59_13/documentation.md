# 문서화(Documentation) Review — edge-mid-insert (§4.1 엣지 분할, 2회차)

이 changeset 은 1회차 리뷰(`review/code/2026/07/13/18_32_28`)와 그 RESOLUTION 적용 결과를 포함한 상태다. 1회차 documentation 리뷰가 지적한 WARNING 2건과 INFO 1건을 실제 diff 기준으로 재검증했다.

## 발견사항

- **[INFO]** 1회차 WARNING "connecting-nodes.mdx §4.1 미서술" — 해소 확인
  - 위치: `codebase/frontend/src/content/docs/03-workflow-editor/connecting-nodes.mdx` / `.en.mdx`
  - 상세: "## 엣지 위에 노드를 놓아 중간에 끼우기" / "## Dropping a node onto an edge to insert it" 절이 신설되어 분할 규칙(A→B 제거, A→새노드/새노드→B 생성, 단일 undo)과 예외(무입출력 노드, 컨테이너 새 노드, 컨테이너 경계 `body`/`emit`, 다중 출력은 첫 출력만)를 `<Callout>` 으로 정확히 기술한다. `canvas-basics.mdx`/`.en.mdx` 팔레트 드래그 문장에도 교차링크 한 줄이 추가됐다. frontmatter `code:` 목록도 이미 `edge-utils.ts`/`workflow-canvas.tsx` 를 포함해 정합. 조치 불필요.

- **[INFO]** 1회차 WARNING "spec §4.1 의 '§4.2' 상호참조가 문서명 없이 자기 문서 내 미존재 절처럼 보임" — 해소 확인
  - 위치: `spec/3-workflow-editor/2-edge.md` §4.1 "적용 범위" 불릿
  - 상세: 현재 문구는 "...분할 없이 그 위치에 노드만 추가한다(`0-canvas.md` 의 일반 팔레트 드롭과 동일한 fallback)."로 문서명이 명시돼 있고, 실제로 `spec/3-workflow-editor/0-canvas.md` §4.2 "동작"이 그 내용을 담고 있어 참조가 정확하다. 조치 불필요.

- **[INFO]** 1회차 INFO "테스트 개수 미표기" — 해소 확인
  - 위치: `CHANGELOG.md` 신규 항목, `plan/complete/spec-sync-edge-gaps.md` §4 체크박스
  - 상세: CHANGELOG 는 이제 `firstOutputHandleId(2)`·`isContainerBoundaryEdge(4)`·`buildEdgeSplitPlan(8)`·`findEdgeIdAtPoint(4)` + `removeEdge` skipUndo(1) 로 함수별 개수를 명시했고, `edge-utils.test.ts`/`editor-store.test.ts` diff 의 실제 `it()` 블록 수와 정확히 일치한다(2+4+8+4+1=19). plan 파일 §4 체크박스는 함수명만 나열해 CHANGELOG 대비 개수가 없지만, 동일 계열의 다른 완료 항목(§1.2/§1.3)도 plan 본문에서는 개수를 생략하는 관행이라 불일치 아님.

- **[INFO]** CRITICAL 수정(컨테이너 새 노드 제외 가드) 관련 문서 3중 동기화 확인
  - 위치: `codebase/frontend/src/lib/utils/edge-utils.ts` (`buildEdgeSplitPlan` JSDoc) / `spec/3-workflow-editor/2-edge.md` §4.1 + `## Rationale` R-3 후속 보강 문단 / `review/code/2026/07/13/18_32_28/RESOLUTION.md`
  - 상세: 1회차 ai-review CRITICAL(컨테이너 새 노드가 `body` 를 첫 출력으로 골라 target 을 본문 자식으로 재편입)에 대한 수정(`if (definition?.isContainer) return null`)이 코드 JSDoc·spec 본문·spec Rationale·RESOLUTION·CHANGELOG·회귀 테스트(`edge-utils.test.ts` "새 노드 자체가 컨테이너면 null") 전부에서 서로 어긋남 없이 일관되게 반영돼 있다. `isContainerBoundaryEdge` 의 판정 축소(`{body,done}` → `{body}`, `done` 은 Parallel Branch 데이터 출력과 동명이라 제외)도 코드 주석·spec·테스트 3곳 모두 동일하게 서술된다.

## 확인된 양호 사항

- `edge-utils.ts` 신규/변경 함수(`firstOutputHandleId`/`isContainerBoundaryEdge`/`buildEdgeSplitPlan`/`findEdgeIdAtPoint`) JSDoc 이 실제 구현 순서·분기 조건과 정확히 일치(예: `buildEdgeSplitPlan` 의 "원자성(by construction)" 주장이 실제 가드 순서 — 경계 엣지 제외 → 컨테이너 새 노드 제외 → 입출력 존재 확인 — 로 뒷받침됨을 소스 대조로 확인).
- `editor-store.ts` `removeEdge` JSDoc 이 `opts.skipUndo` 의미·호출 시나리오(§4.1 인용)를 정확히 갱신했고 구현(`if (!opts?.skipUndo) get().pushUndo()`)과 어긋나지 않는다.
- `workflow-canvas.tsx` `onDrop` 인라인 주석이 `findEdgeIdAtPoint`/`buildEdgeSplitPlan`/`removeEdge`+`onConnect` 시퀀스와 "plan이 null 이면 노드만 추가 유지"라는 실제 분기를 정확히 설명.
- CHANGELOG 항목이 "순수 프런트엔드 편집기 변경(백엔드·wire 무변경)"을 명시 — 실제 diff 에 backend/DTO 변경 없음과 일치, API 문서 갱신 불요 판단이 근거와 함께 자체 기록됨.
- 새 환경변수·설정 옵션 없음(N/A).
- `plan/complete/spec-sync-edge-gaps.md` 승격(§4 체크박스 완료 + 상단 완료 배너 "5개 surface 전부 구현")이 CHANGELOG·spec R-3 서술과 교차 정합하고, spec frontmatter `pending_plans` 에서 자기 자신(`spec-sync-edge-gaps.md`) 항목이 제거돼 dangling 참조가 남지 않음을 확인.

## 요약

1회차 ai-review 가 지적한 문서화 WARNING 2건(유저가이드 stale, spec 자기참조 오독)과 INFO 1건(테스트 개수 미표기)이 모두 실제 diff 상에서 해소되어 있고, 그 사이 반영된 CRITICAL 코드 수정(컨테이너 새 노드 가드)에 대한 JSDoc·spec 본문·Rationale·CHANGELOG·회귀 테스트 간 서술도 상호 정합하다. 잔여 문서화 결함은 발견되지 않았다.

## 위험도
NONE
