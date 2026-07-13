# 부작용(Side Effect) Review — edge §4.1 엣지 분할(mid-insert)

대상: `workflow-canvas.tsx`(`onDrop`) · `edge-utils.ts`(신규 `firstOutputHandleId`/`isContainerBoundaryEdge`/`buildEdgeSplitPlan`/`findEdgeIdAtPoint`) · `editor-store.ts`(`removeEdge` `{skipUndo}`) · 관련 테스트 · `spec/3-workflow-editor/2-edge.md` §4.1/R-3 · 유저가이드 · CHANGELOG/plan. 본 changeset 에는 직전 ai-review 1회차(`review/code/2026/07/13/18_32_28/**`)의 산출물과 그 RESOLUTION 도 함께 포함되어 있어, 그 라운드가 발견한 CRITICAL 이 현재 코드에서 실제로 해소됐는지 우선 재검증했다.

## 발견사항

- **[INFO]** 직전 ai-review 1회차 CRITICAL("삽입 노드 자체가 컨테이너면 target 이 body 자식으로 재편입") — 현재 diff 에서 해소 확인
  - 위치: `codebase/frontend/src/lib/utils/edge-utils.ts` `buildEdgeSplitPlan` — `if (definition?.isContainer) return null; // 컨테이너 새 노드는 body 재편입 위험 → 제외`
  - 상세: `firstOutputHandleId` 가 컨테이너(Loop/ForEach/Map, `outputs:[body,done]`)의 첫 출력으로 `body` 를 고르는 문제 자체는 여전하지만, `buildEdgeSplitPlan` 진입 시 `definition?.isContainer` 가드가 그 경로 전체를 원천 차단(분할 생략, 노드만 추가)한다. 회귀 테스트(`edge-utils.test.ts` "새 노드 자체가 컨테이너면 null — body 재편입 위험 제외")도 추가돼 있다. 같은 라운드 WARNING(`isContainerBoundaryEdge` 가 `done` 을 컨테이너 경계로 오판해 Parallel Branch 데이터 엣지 분할을 잘못 막던 문제)도 `CONTAINER_SOURCE_HANDLES` 를 `{body,done}` → `{body}` 로 축소해 해소됨을 확인. 두 수정 모두 `spec/3-workflow-editor/2-edge.md` R-3 "후속 보강" 문단과 code 가 line-level 로 일치한다. 조치 불요, 참고 기록.

- **[WARNING]** `onDrop` 이 사전 시각 피드백 없이 "노드 추가" 의미를 "엣지 분할" 로 조용히 전환 — 기존 인터랙션의 암묵적 계약 변경
  - 위치: `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx` L714-737 (`onDrop`)
  - 상세: 변경 전에는 팔레트 드롭이 항상 "그 위치에 노드 추가"였다(단일 의미). 이번 변경으로 동일한 드롭 제스처가 드롭 좌표의 DOM hit-test 결과에 따라 두 가지 상이한 결과(단순 추가 vs 엣지 삭제+노드 삽입+엣지 2개 신설)로 분기한다. `findEdgeIdAtPoint` 는 React Flow `BaseEdge` 의 기본 20px 폭 투명 interaction path 를 그대로 재사용하므로, 사용자가 "엣지 바로 옆 빈 공간"에 노드를 두려는 의도로 드롭해도 판정 폭 안에 들어가면 조용히 엣지가 분할된다. diff 범위 안에는 드래그 중(hover) 대상 엣지를 하이라이트하거나 "분할됨" 을 예고하는 시각적 피드백이 없다 — 드롭이 완료된 뒤에야 결과로 알 수 있다. 단일 Ctrl+Z 로 되돌릴 수 있어 데이터 유실 위험은 아니지만, 밀집된 캔버스(같은 PR 의 §4/§5 hover 미리보기 기능 설명이 스스로 언급하는 "촘촘한 캔버스" 시나리오)에서는 사용자가 의도치 않게 기존 그래프 위상을 반복적으로 바꾸는 마찰을 겪을 수 있다.
  - 제안: 필수 차단 사유는 아님(스펙·유저가이드에 이미 명시돼 문서화된 의도 동작). 다만 드래그 중 커서 아래 엣지를 하이라이트하는 시각적 프리뷰(예: 기존 엣지 하이라이트 스타일 재사용)를 후속 개선으로 고려할 것.

- **[INFO]** `onDrop` 의 3단계(`removeEdge` → `onConnect` → `onConnect`)는 store 원자 액션이 아니라 컴포넌트가 순서대로 호출하는 비트랜잭션 시퀀스 — 현재는 구성적으로 안전, 향후 확장 시 재검토 필요
  - 위치: `workflow-canvas.tsx` L726-737, `buildEdgeSplitPlan` JSDoc "원자성(by construction)"
  - 상세: `removeEdge` 는 무조건 실행되는 파괴적 연산이고 그 뒤 두 `onConnect` 는 `evaluateConnection` 이 실패하면 조용히 toast 만 띄우고 아무 것도 하지 않는 best-effort 연산이다. 현재는 (1) 원본 엣지가 컨테이너 경계(`body`/`emit`)가 아니고 (2) 새 노드가 컨테이너가 아니며 (3) 새 노드라 자기연결·중복이 구조적으로 불가능하다는 세 조건이 `buildEdgeSplitPlan` 게이트에서 모두 보장되므로 두 `onConnect` 가 실패할 경로가 실질적으로 없다 — spec R-3·JSDoc 이 이를 "구성적 해소" 로 명시하고 있고 독립적으로 재확인했다. 다만 이는 `evaluateConnection` 의 **현재** 거부 조건(자기연결/중복/컨테이너 충돌)에 의존하는 논리이며, 향후 그 함수에 새 거부 규칙(예: 포트별 fan-in 상한)이 추가되면 `buildEdgeSplitPlan` 의 게이트가 동반 갱신되지 않는 한 "원본 엣지 삭제 + 편측 연결만 성공" 하는 반쪽 그래프가 재발할 수 있다. 직전 라운드 architecture/side_effect 리뷰가 동일하게 지적했고 이번 diff 는 그 리스크를 없애기보다 "현재 스코프에서 발생 불가함"을 문서로 못박는 방식으로 대응했다.
  - 제안: 지금 당장 조치 불요(스코프·근거가 spec 에 명시적으로 기록됨). `evaluateConnection` 에 신규 거부 규칙을 추가하는 후속 PR 에서는 이 불변식이 여전히 성립하는지 재검토가 필요함을 인지해 둘 것.

- **[INFO]** `removeEdge` 시그니처 변경은 하위 호환
  - 위치: `codebase/frontend/src/lib/stores/editor-store.ts` L91-104(interface), L810-822(impl)
  - 상세: `(edgeId: string)` → `(edgeId: string, opts?: { skipUndo?: boolean })`. `opts` 가 선택적이고 `!opts?.skipUndo` 분기가 옵션 미전달 시 기존과 동일하게 `pushUndo()` 를 실행하므로, 기존 호출부(§1.3 재연결 detach 등)의 동작은 변하지 않는다. 회귀 테스트(`editor-store.test.ts` 기존 케이스 + 신규 skipUndo 케이스)로 확인됨. `onConnect` 의 기존 `skipUndo` 패턴과 대칭이라 코드베이스 관행에도 부합. 문제 없음.

- **[INFO]** `onDrop` `useCallback` 의존성 배열 확장(`[buildAndAddNode]` → `[buildAndAddNode, edges, removeEdge, onConnect]`)으로 `edges` 상태가 바뀔 때마다 콜백 참조가 재생성됨
  - 위치: `workflow-canvas.tsx` L740
  - 상세: hit-test 에 현재 `edges` 스냅샷이 필요해 불가피한 추가이며, 로직상 필수 의존성만 정확히 추가됐다(누락·과잉 없음). React Flow 의 `onDrop` prop 을 받는 하위 트리가 이 참조 안정성에 의존한 메모이제이션을 하고 있다면 미세한 재렌더 증가가 있을 수 있으나, 캔버스 편집이라는 상호작용 특성상 실질적 영향은 낮다. 전역/공유 상태에 대한 부작용은 아니며 참고 수준.

- **[INFO]** `findEdgeIdAtPoint` 는 호출 시점의 전역 `document.elementFromPoint` 결과에 의존
  - 위치: `codebase/frontend/src/lib/utils/edge-utils.ts` `findEdgeIdAtPoint`
  - 상세: 드롭 좌표 위에 다른 오버레이(§4/§5 hover 툴팁·컨텍스트 메뉴 등)가 z-index 상 위에 떠 있으면 실제로는 엣지 위에 드롭했더라도 다른 엘리먼트가 히트돼 조용히 `null` 을 반환할 수 있다(분할 생략, 노드만 추가로 안전하게 폴백). 의도된 "canvas seam"(주입 가능한 `doc` 파라미터로 단위 테스트됨)이며 전역 변수를 **쓰지는** 않고 **읽기만** 하므로 상태 변경 부작용은 아니다. 참고 기록.

- **[INFO]** 신규 모듈 레벨 상수(`CONTAINER_SOURCE_HANDLES`/`CONTAINER_TARGET_HANDLES`)는 불변(`Set`, 재할당 없음)이며 전역 가변 상태가 아님
  - 위치: `codebase/frontend/src/lib/utils/edge-utils.ts`
  - 상세: 모듈 스코프 상수 도입 자체는 새 전역 변수가 아니라 기존 `RESERVED_INPUT_HANDLE_IDS` 등과 동일한 코드베이스 관행. 부작용 없음.

- **[INFO]** 환경변수·네트워크 호출·파일시스템 부작용 없음
  - 위치: 변경된 5개 소스 파일 전체
  - 상세: 이번 changeset 은 순수 프런트엔드 편집기 상태(Zustand store) 조작이며 신규 REST 호출·환경변수 읽기/쓰기·파일 생성/삭제 로직이 없다(CHANGELOG 도 "백엔드·wire 무변경"을 명시). `review/**`·`plan/complete/**` 신규 파일은 프로젝트 규약에 따른 리뷰/plan 프로세스 산출물이지 애플리케이션 코드의 부작용이 아니다.

## 요약

가장 중요한 부작용 리스크였던 "삽입 노드 자체가 컨테이너면 대상 노드가 조용히 새 컨테이너의 body 자식으로 재편입"되는 CRITICAL(직전 ai-review 1회차 side_effect/testing 발견)은 `buildEdgeSplitPlan` 의 `definition?.isContainer` 가드와 회귀 테스트로 현재 diff 에서 실제로 해소되어 있음을 코드·spec R-3·테스트 3곳 모두에서 확인했다. 남은 항목은 차단급이 아니다 — (1) 드롭이 시각적 예고 없이 "노드 추가"에서 "엣지 분할"로 조용히 전환되는 것은 스펙·유저가이드로 문서화된 의도된 동작이지만 UX 마찰 여지가 있어 WARNING 으로 남기고, (2) `removeEdge`→`onConnect`×2 의 비트랜잭션 구조는 현재 스코프에서는 구성적으로 안전함이 코드 레벨로 재확인됐으나 `evaluateConnection` 확장 시 재검토가 필요한 구조적 부채로 남아 있다. `removeEdge` 시그니처 확장은 하위 호환이며, 신규 헬퍼들은 전역 변수·환경변수·네트워크·파일시스템에 손대지 않는 순수 함수/스토어 액션으로 격리되어 있다.

## 위험도
LOW
