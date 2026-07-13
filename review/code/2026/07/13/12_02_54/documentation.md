# 문서화(Documentation) 리뷰 결과

대상: `CHANGELOG.md`, `spec/3-workflow-editor/2-edge.md`, `plan/in-progress/spec-sync-edge-gaps.md`, `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx`, `codebase/frontend/src/lib/stores/editor-store.ts`(+test), `codebase/frontend/src/lib/utils/edge-utils.ts`(+test), 4개 유저 가이드 mdx(`canvas-basics`/`connecting-nodes` × ko/en), `review/code/2026/07/13/{11_04_21,11_28_30,11_46_01}/*`(직전 3회 ai-review 산출물 커밋).

본 changeset 은 §1.2(출력 포트 드래그→빈 영역 드롭→노드 추가 팝업+자동 엣지 연결) 최초 구현 커밋 1개 + 그에 대한 ai-review 3라운드(11_04_21 HIGH, 11_28_30 MEDIUM, 11_46_01 MEDIUM) 반영 커밋 3개, 총 4커밋의 누적 diff다. 세 라운드 모두가 지적한 documentation 관련 항목(SoT spec stale, CHANGELOG 미갱신, 유저 가이드 2페이지 stale, skipUndo 테스트 부재, `popup.source` stale 주석, plan 케이스 수 오기재)이 현재 코드베이스에 실제로 반영됐는지 직접 실측 대조했다. 새로운 독립 이슈는 발견하지 못했다.

## 발견사항

- **[INFO]** 직전 3라운드 documentation 지적 전건 — 실측 결과 모두 해소 확인
  - 위치: `spec/3-workflow-editor/2-edge.md` §1.2, `CHANGELOG.md`, 4개 mdx, `workflow-canvas.tsx:334-338`
  - 상세: (1) spec §1.2 "(미구현 · Planned)" 라벨 제거 + "현재 구현" 각주가 `onConnectEnd`/`connectionDragSource`/`buildAutoConnectConnection`/`skipUndo` 등 실제 구현과 line-level 로 일치. (2) CHANGELOG 최상단에 자매 항목(§2.2/§2.3)과 동일 톤·상세도의 Unreleased 항목 등재, 서술이 diff 와 일치. (3) `canvas-basics.{mdx,en.mdx}` "세 가지"→"네 가지" 방법 갱신 + 신규 4번째 방법 서술, `connecting-nodes.{mdx,en.mdx}` 4번 항목 추가 및 "빈 캔버스" 문구를 무효 target 목록에서 분리 — ko/en 두 언어 쌍 모두 대칭적으로 갱신되고 상호 크로스링크(`[노드 연결하기]`)도 정합. (4) `editor-store.test.ts` 신규 `describe("onConnect — skipUndo (§1.2)")` 2케이스가 주석상의 계약(opts 미지정 시 push, `{skipUndo:true}` 시 미push)을 정확히 검증. (5) `onConnectEnd` 블록 주석의 폐기된 필드명 `popup.source` → `` `NodeSearchPopupState.dragSource` `` 로 정정 확인(현재 코드에 `popup` 이라는 이름 자체가 없음, `nodeSearchPopup.dragSource` 가 유일한 참조). (6) plan 파일의 테스트 케이스 수 서술이 "vitest 27케이스"에서 실측과 일치하는 "vitest 23케이스(edge-utils 헬퍼 21 + `onConnect` skipUndo 2)"로 정정됨 — `edge-utils.test.ts` 신규 5개 describe 블록(`isConnectionDroppedOnPane`/`firstInputHandleId`/`connectionDragSource`/`pointerClientPosition`/`buildAutoConnectConnection`)의 `it()` 총계를 직접 세어 21건, `editor-store.test.ts` skipUndo 블록 2건으로 23건 일치 확인.
  - 제안: 없음(조치 완료 확인).

- **[INFO]** `handleAddNodeFromSearch` 의 undo 주석 — "유일한 체크포인트" 과장 표현이 정확한 behavior 서술로 교정됨
  - 위치: `workflow-canvas.tsx:604-608`
  - 상세: 3라운드 전 주석은 "buildAndAddNode 가 ... 이미 pushUndo 한 스냅샷이 유일한 체크포인트가 되도록" 이라는, `pushUndo` 구현(스택 push 방식이라 "유일"이라는 표현이 오해를 부를 수 있음)과 미묘하게 어긋나는 표현이었으나, 현재는 "`skipUndo` 없이는 `onConnect` 가 노드-only 상태를 스냅샷해 Ctrl+Z 가 엣지만 되돌리고 고아 노드를 남긴다" 는 정확한 반사실적(counterfactual) 설명으로 교정되어 있다. CHANGELOG·spec 의 동일 대목도 같은 표현으로 동기화됨.
  - 제안: 없음.

- **[INFO]** `plan/in-progress/spec-sync-edge-gaps.md` §1.3 이월 항목 (d) — 컴포넌트 통합 테스트 부재가 "의도적 최종 이월"로 명시적 확정
  - 위치: `plan/in-progress/spec-sync-edge-gaps.md` §1.3 하위 이월 목록 (d)
  - 상세: 동일 지적(`workflow-canvas.tsx` 실배선의 RTL/`@xyflow/react` mock 통합 테스트 부재)이 3라운드 연속 재부상했으나, 이번 diff 에서 "**[의도적 최종 이월 — 결정 확정]**" 표기와 함께 근거(순수 로직은 vitest 23케이스로 전수 커버, 남는 부분은 얇은 glue, canvas 컴포넌트 테스트 하네스 부재로 §1.3 오케스트레이션 훅 추출과 동반 작성이 합리적)를 문서화했다. 코드 자체의 문서화 문제는 아니나 plan 문서가 "왜 이 갭을 지금 안 메우는가"를 명확히 근거 남긴 점은 향후 재작업 추적에 유리하다.
  - 제안: 없음(§1.3 착수 시 plan에 기록된 대로 재검토).

- **[INFO]** `connecting-nodes.{mdx,en.mdx}` frontmatter `code:` 목록에 `edge-utils.ts` 미포함 — pre-existing, 이번 diff 로 신규 도입된 갭 아님
  - 위치: `codebase/frontend/src/content/docs/03-workflow-editor/connecting-nodes.mdx`/`.en.mdx` frontmatter `code:`(`custom-edge.tsx`/`use-edge-highlighting.ts`/`workflow-canvas.tsx`/`editor-store.ts` 만 등재)
  - 상세: §1.2 구현의 판정·조립 순수 헬퍼 5종(`connectionDragSource`/`buildAutoConnectConnection`/`firstInputHandleId`/`pointerClientPosition`/`isConnectionDroppedOnPane`) 모두 `edge-utils.ts` 에 있고, 이 문서가 "연결 유효성 규칙"을 다루는 바로 그 페이지임에도 `code:` 레지스트리에 `edge-utils.ts` 가 없다. `git show origin/main:...` 대조 결과 이 갭은 이번 PR 이전(§2.2/§2.3 의 `isSelfConnection`/`isDuplicateConnection` 도 이미 같은 파일 소속인데 누락)부터 존재했고, 직전 라운드(11_46_01)에서 이미 동일하게 "pre-existing, 회귀 아님"으로 분류됐다. 재확인 결과 그 판정이 여전히 유효하다.
  - 제안: 차단 사유 아님. 다음에 이 문서를 만질 기회에 `code:` 목록에 `edge-utils.ts` 추가를 고려.

- **[INFO]** spec `## Rationale` 섹션에 §1.2 엣지 케이스(입력 포트 없으면 자동 연결 생략) 설계 근거 미등재 — 3라운드 내내 "선택 사항"으로 일관 분류, 여전히 미반영
  - 위치: `spec/3-workflow-editor/2-edge.md` `## Rationale`(R-1, R-2 만 존재)
  - 상세: 매 라운드 동일하게 지적되고 매번 "필수 아님"으로 분류된 항목이며 이번 라운드에도 변화 없음. 기능적 영향 없음.
  - 제안: 선택 사항 — 필수 아님.

## 요약

이번 changeset 은 §1.2 구현 1건과, 그에 대한 3라운드 ai-review 가 낸 documentation 관련 지적 전건(SoT spec stale, CHANGELOG 미갱신, 유저 가이드 2페이지 stale, skipUndo 테스트 부재, `popup.source` stale 주석, undo 주석 과장 표현, plan 테스트 케이스 수 오기재)을 순차 반영한 결과물이며, 직접 실측 대조 결과 모든 지적이 정확히 해소된 것으로 확인된다. spec·CHANGELOG·4개 유저 가이드 mdx(ko/en)·인라인 주석·plan 문서가 서로 어긋남 없이 현재 구현(`onConnectEnd`, `NodeSearchPopupState.dragSource`, `buildAndAddNode` id 반환, `onConnect` `skipUndo`, 순수 헬퍼 5종, vitest 23케이스)과 일치한다. 신규로 발견한 차단급 이슈는 없으며, 잔존 관찰 사항(spec Rationale 미보강, `connecting-nodes.mdx` frontmatter 의 pre-existing `edge-utils.ts` 미등재)은 이전 라운드부터 선택 사항/무관 갭으로 이미 판정되어 있어 조치 불요하다.

## 위험도
NONE
