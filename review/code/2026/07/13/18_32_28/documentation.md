# 문서화(Documentation) Review — edge-mid-insert (§4.1 엣지 분할)

## 발견사항

- **[WARNING]** 유저 가이드 `connecting-nodes.mdx` 가 신규 §4.1 기능(엣지 위 드롭 → 분할·삽입)을 서술하지 않음
  - 위치: `codebase/frontend/src/content/docs/03-workflow-editor/connecting-nodes.mdx` (및 `.en.mdx`)
  - 상세: 이 유저 가이드의 frontmatter `code:` 목록이 정확히 이번 diff 의 세 핵심 파일(`workflow-canvas.tsx`, `editor-store.ts`, `edge-utils.ts`)을 가리키고 `spec:` 도 `spec/3-workflow-editor/2-edge.md` 를 가리킨다 — 이 문서가 바로 §1.2(빈 영역 드롭 자동 연결, "## 연결선 긋기" 4번 항목)·§1.3(재연결/분리, "## 연결선 고치기·지우기")·§3.2/§5(실행 상태·hover 데이터 미리보기, "## 연결선 읽기" 하단)를 실제로 미러링해온 문서다. 그런데 이번 §4.1(팔레트에서 노드를 **기존 엣지 위**에 드롭하면 엣지가 분할되고 중간에 삽입되는 동작)은 "## 연결선 긋기" 절 어디에도 없다 — 현재 문서 30행은 "빈 캔버스 영역에 놓으면" 케이스만 설명하고 "엣지 위에 놓으면"의 분할 동작은 다루지 않는다. `spec-code-paths`/`registry.test.ts` 류 가드는 파일 실존만 검증해 이 stale 은 자동 검출되지 않는다(`spec/conventions/user-guide-evidence.md` §Principle 7 이 명시하는 "code→guide 방향은 자동 검출 불가, 사람 리뷰 의존" 사각지대에 정확히 해당).
  - 제안: "## 연결선 긋기" 절(또는 별도 소절)에 "팔레트에서 드래그한 노드를 **기존 연결선 위**에 놓으면 그 연결선이 끊기고 중간에 새 노드가 끼워진다(source→새 노드, 새 노드→target)" 문구 + 컨테이너 경계(body/emit)·무입출력 노드는 분할되지 않고 노드만 추가된다는 한계 안내를 추가. 직전 §3.2 구현 시 CHANGELOG 에 "`running-a-workflow` 가이드 동반 갱신" 이 명시적으로 기록된 선례가 있는 만큼, 이번에도 가이드 동반 갱신이 관행에 부합.

- **[WARNING]** spec §4.1 의 "§4.2" 상호참조가 문서명 없이 쓰여 자기 문서 내 존재하지 않는 절을 가리키는 것처럼 오독됨
  - 위치: `spec/3-workflow-editor/2-edge.md` §4.1 "적용 범위" 불릿 — "...엣지가 아닌 빈 영역에 드롭하면 분할 없이 그 위치에 노드만 추가한다(§4.2 일반 팔레트 드롭과 동일 fallback)."
  - 상세: `2-edge.md` 자체의 `## 4. 엣지 조작` 섹션에는 `§4.1` 하나만 있고 `§4.2` 는 존재하지 않는다(§4.1 다음은 바로 `## 5. 엣지 데이터 미리보기`). 실제로 "일반 팔레트 드롭" 동작은 `spec/3-workflow-editor/0-canvas.md` §4.2 "동작"을 가리키는 **타 문서 참조**다. 같은 불릿 안의 바로 다음 항목("컨테이너 경계 제외")은 "`0-canvas.md` containerId 동기화 불변식"처럼 외부 문서명을 명시하는데, 이 "§4.2" 만 문서명이 생략돼 있어 일관성이 깨지고, 독자가 자기 문서 안에서 §4.2 를 찾다가 없는 것을 발견하게 된다(dangling 처럼 보이는 오독 위험).
  - 제안: "(0-canvas.md §4.2 일반 팔레트 드롭과 동일 fallback)"으로 문서명을 명시.

- **[INFO]** 이번 기능의 CHANGELOG/plan 항목이 테스트 **개수**를 명시하지 않아 같은 계열 항목들의 관행과 다름
  - 위치: `CHANGELOG.md` 신규 "Unreleased — 워크플로 편집기 엣지 분할..." 항목, `plan/complete/spec-sync-edge-gaps.md` 해당 체크박스 서술
  - 상세: 같은 spec 영역의 선행 항목들은 "vitest 23케이스(헬퍼 21 + skipUndo 2)"(§1.2), "9 + 5 + 9"(§3.2), "16 + 6 + 10 + 4"(§4/§5)처럼 정확한 개수를 명시하는 관행을 따르는데, 이번 항목은 "테스트: `firstOutputHandleId`/`isContainerBoundaryEdge`/`buildEdgeSplitPlan`(...)/`findEdgeIdAtPoint`(...) + `removeEdge` skipUndo"처럼 함수명만 나열하고 개수를 적지 않았다(실제로는 2+3+6+3+1=15케이스, `edge-utils.test.ts`/`editor-store.test.ts` diff 기준).
  - 제안: 필수는 아니나 일관성을 위해 "(2+3+6+3 = 14 + removeEdge skipUndo 1)"처럼 개수를 붙이면 관행과 맞음. 차단 사유 아님.

## 확인된 양호 사항 (참고)

- `edge-utils.ts` 신규 함수 4개(`firstOutputHandleId`/`isContainerBoundaryEdge`/`buildEdgeSplitPlan`/`findEdgeIdAtPoint`) 모두 JSDoc 에 목적·스코프 제외 사유(§4.1/R-3)·관련 SoT 를 상세히 기술 — 프로젝트 관행(스펙 섹션 앵커 포함 한국어 독스트링)에 정확히 부합.
- `workflow-canvas.tsx` `onDrop` 의 인라인 주석이 왜 `skipUndo` 로 묶는지(§1.2 관행과의 대칭)를 정확히 설명하고, `editor-store.ts` `removeEdge` JSDoc 도 신규 `opts.skipUndo` 의미·호출 시나리오를 정확히 갱신 — 코드와 주석이 어긋나는 곳 없음.
- `spec/3-workflow-editor/2-edge.md` §4 표·§4.1 신설 절·`## Rationale` R-3 3곳이 서로 정합하고, impl-prep 컨센서스 체크(WARNING 5건: 포트 규칙·컨테이너 경계·undo 원자성·seam 배치·detach/split 용어)가 실제로 전부 spec 문구에 반영됨(별도 후속 조치 불필요).
- CHANGELOG 항목이 "순수 프런트엔드 편집기 변경(백엔드·wire 무변경)"을 명시해 API 문서 갱신 불요임을 스스로 근거와 함께 밝힘 — 실제로 REST/DTO/backend 변경 없음과 일치.
- 새 환경변수·설정 옵션 없음 — 해당 관점 N/A.

## 요약

이번 PR 은 코드 자체의 독스트링·인라인 주석·spec 본문(§4.1 신설 + R-3 Rationale)·CHANGELOG 항목이 서로 정합하고 상세해 문서화 수준이 전반적으로 높다. 다만 (1) `connecting-nodes.mdx` 유저 가이드가 정확히 이 코드 경로를 frontmatter 로 선언하고 있으면서도 신규 "엣지 위 드롭→분할" 동작을 서술하지 않은 채 stale 로 남아 있고, (2) spec §4.1 안의 "§4.2" 상호참조가 문서명 누락으로 자기 문서 내 미존재 절처럼 오독될 소지가 있다. 둘 다 구현을 막을 사유는 아니며 문서 완결성 보완 차원의 WARNING 이다.

## 위험도
LOW
