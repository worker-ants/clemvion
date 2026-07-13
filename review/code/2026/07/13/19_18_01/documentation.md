# 문서화(Documentation) Review — edge §4.1 엣지 분할 (3회차)

이 changeset 은 1회차(`review/code/2026/07/13/18_32_28`)·2회차(`18_59_13`) ai-review 와 그 RESOLUTION 적용 결과를 모두 포함한 누적 diff다. 두 이전 documentation 라운드가 지적한 WARNING 2건 + INFO 1건은 실제 코드(`connecting-nodes.{mdx,en.mdx}`, `canvas-basics.{mdx,en.mdx}`, `spec/3-workflow-editor/2-edge.md` §4.1 "§4.2" 참조, CHANGELOG 테스트 개수)를 직접 대조해 모두 해소되었음을 재확인했다(이하 "확인된 양호 사항" 참고). 본 라운드는 그 위에서 독립적으로 새 관점을 점검했다.

## 발견사항

- **[WARNING]** `buildEdgeSplitPlan` 의 "원자성(by construction)" 보장이 의존하는 `detectContainerConflict` 의 거부 분기 목록이, 정작 그 함수 자신의 JSDoc/주석에는 역참조되어 있지 않다
  - 위치: `codebase/frontend/src/lib/stores/editor-store.ts` `detectContainerConflict`(약 240-280행) ↔ `codebase/frontend/src/lib/utils/edge-utils.ts` `buildEdgeSplitPlan` JSDoc("원자성(by construction)" 문단)
  - 상세: `buildEdgeSplitPlan` 의 JSDoc 은 "두 신규 Connection 은 `detectContainerConflict` 의 유일한 거부 분기(source `body`/target `emit`)에 절대 걸리지 않는다"는 **현재 시점의 사실**을 정확히 서술한다. 그런데 이 불변식은 "`detectContainerConflict` 가 body/emit 두 분기 외에 다른 거부 조건을 절대 추가하지 않는다"는 암묵적 전제 위에 서 있다. 실제로 `detectContainerConflict`(`editor-store.ts`) 쪽 JSDoc/인라인 주석에는 이 전제를 알리는 문구가 전혀 없다 — 즉 향후 누군가 fan-in 상한이나 새 컨테이너 정책 같은 거부 분기를 이 함수에 추가하면, `edge-utils.ts` 를 열어보지 않는 한 "`buildEdgeSplitPlan` 의 non-null 반환이 분할 안전성의 게이트"라는 다른 파일의 불변식이 조용히 깨진다는 사실을 알 방법이 없다. 이 "함께 갱신해야 한다"는 지시는 현재 `review/code/2026/07/13/18_59_13/RESOLUTION.md`(리뷰 산출물, `review/**`)에만 기록되어 있는데, 이 경로는 `evaluateConnection`/`detectContainerConflict` 를 수정하려는 미래의 개발자가 통상적으로 열어볼 위치가 아니다(코드·spec Rationale 어디에도 forward-looking 갱신 지시가 없음).
  - 제안: `detectContainerConflict` JSDoc 끝에 한 줄 추가 — 예: "이 함수에 새 거부 분기를 추가하면 `edge-utils.ts` `buildEdgeSplitPlan` 의 원자성 가정(§4.1)이 깨질 수 있으니 함께 검토할 것." 동일 문구를 `spec/3-workflow-editor/2-edge.md` `## Rationale` R-3 말미에도 "향후 변경 시 주의" 형태로 명시하면, 코드·spec 양쪽에서 실제 커플링 지점을 통해 발견 가능해진다.

- **[INFO]** (참고, 비차단) 2회차 documentation 리뷰(`18_59_13/documentation.md`) 자체의 테스트 개수 검산이 CHANGELOG 항목의 실제 합계와 2건 어긋남
  - 위치: `review/code/2026/07/13/18_59_13/documentation.md` "테스트 개수 미표기 — 해소 확인" 항목("2+4+8+4+1=19")
  - 상세: CHANGELOG.md 해당 항목은 `firstOutputHandleId`(2)·`isContainerBoundaryEdge`(4)·`buildEdgeSplitPlan`(8)·`findEdgeIdAtPoint`(4)·`removeEdge` skipUndo(1) 에 더해 "**store 분할 시퀀스 통합 2**"까지 명시하는데, 2회차 리뷰의 검산에서는 이 통합 테스트 2건이 누락돼 19로 계산됐다(실제 `edge-utils.test.ts`+`editor-store.test.ts` diff 의 `it()` 총합은 21). 이 파일은 배포 문서가 아니라 과거 리뷰 산출물이라 실질 영향은 없지만, 향후 이 리뷰 파일을 근거로 개수를 인용하면 오차가 전파될 수 있다.
  - 제안: 조치 불요(리뷰 이력 파일이므로 수정 대상 아님). 참고용으로만 기록.

## 확인된 양호 사항 (독립 재검증)

- `connecting-nodes.mdx`/`.en.mdx` "엣지 위에 노드를 놓아 중간에 끼우기" 절, `canvas-basics.mdx`/`.en.mdx` 교차링크 한 줄 모두 diff 그대로 존재하며 ko/en parity 가 맞다(1·2회차 WARNING 해소가 실제 반영됨을 직접 대조로 재확인).
- `spec/3-workflow-editor/2-edge.md` §4.1 "적용 범위" 불릿의 "§4.2" 참조는 "`0-canvas.md` 의 일반 팔레트 드롭과 동일한 fallback" 으로 문서명이 명시되어 있고, 실제 `0-canvas.md` §4.2 가 그 내용을 담고 있어 정확하다.
- `edge-utils.ts` 신규 함수 4개(`firstOutputHandleId`/`isContainerBoundaryEdge`/`buildEdgeSplitPlan`/`findEdgeIdAtPoint`) JSDoc 은 목적·분할 불가 조건·SoT(§4.1/R-3)를 상세히 기술하고, 실제 구현 분기 순서(경계 엣지 → 컨테이너 새 노드 → 입출력 존재)와 정확히 일치한다.
- `editor-store.ts` `removeEdge` JSDoc 의 `opts.skipUndo` 설명, `workflow-canvas.tsx` `onDrop` 인라인 주석(hit-test → plan → removeEdge/onConnect 시퀀스, plan null 시 폴백)이 실제 코드와 어긋나지 않는다.
- `buildAndAddNode` 는 이미 §1.2 자동연결 작업에서 `string | undefined` 반환 시그니처로 문서화돼 있어, 이번 §4.1 재사용 시점에 별도 시그니처/독스트링 갱신 불요(스테일 없음).
- CHANGELOG "순수 프런트엔드 편집기 변경(백엔드·wire 무변경)" 명시, 새 환경변수/설정 없음(N/A) — API 문서·설정 문서 갱신 불요 판단이 실제 diff(백엔드/DTO 변경 없음)와 일치.
- `plan/complete/spec-sync-edge-gaps.md` §4 체크박스·완료 배너가 CHANGELOG·spec R-3 와 교차 정합하고, spec frontmatter `pending_plans` 에서 자기 자신이 제거돼 dangling 참조가 없다.

## 요약

1·2회차 ai-review 가 지적한 문서화 WARNING(유저가이드 stale, spec 자기참조 오독)과 INFO(테스트 개수)는 실제 코드·문서 diff 를 직접 대조해 모두 해소를 재확인했다. 본 라운드에서 새로 발견한 사항은 하나로, `buildEdgeSplitPlan`(edge-utils.ts)의 "onConnect 항상 성공" 원자성 보장이 `detectContainerConflict`(editor-store.ts)의 거부 분기 목록이 고정돼 있다는 암묵적 전제에 의존하는데, 이 "함께 갱신 필요" 계약이 리뷰 산출물(`review/**`)에만 적혀 있고 정작 미래에 `detectContainerConflict` 를 수정할 개발자가 보게 될 소스 JSDoc·spec Rationale 어디에도 forward-pointer 가 없다는 점이다. 구현을 막을 사유는 아니며, 향후 컨테이너 연결 규칙 확장 시 조용한 회귀를 막기 위한 예방적 WARNING이다.

## 위험도
LOW
