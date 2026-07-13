# Requirement Review — edge §1.2 출력 포트 드래그→빈 영역 드롭 자동 노드 추가+연결 (3회차, 2회 ai-review 반영 후 fresh)

대상 diff 는 `origin/main` 대비 3개 커밋(`19386ef10` feat, `2b775357b` refactor/resolution, `7980c2868` docs/tests)의 누적이며, 직전 두 차례 ai-review(`review/code/2026/07/13/11_04_21` HIGH→해소, `review/code/2026/07/13/11_28_30` MEDIUM→해소)가 지적한 CRITICAL(spec stale)·WARNING(undo 중복·테스트 부재·user_guide stale) 전건에 대한 해소 결과물이 포함돼 있다. 본 라운드는 그 해소가 실제로 코드/spec 실측과 정확히 일치하는지 독립적으로 재검증했다.

## 발견사항

- **[WARNING]** `plan/in-progress/spec-sync-edge-gaps.md` §1.2 완료 서술의 vitest 케이스 수 불일치("27케이스" vs 실측 21개)
  - 위치: `plan/in-progress/spec-sync-edge-gaps.md` §1.2 체크박스 완료 서술 — "순수 헬퍼 `edge-utils.ts` `connectionDragSource`/`pointerClientPosition`/`buildAutoConnectConnection`/`firstInputHandleId`/`isConnectionDroppedOnPane` + vitest 27케이스."
  - 상세: 실제로 `codebase/frontend/src/lib/utils/__tests__/edge-utils.test.ts` 에서 이번 diff 로 추가된 `it(` 블록을 직접 카운트하면 `isConnectionDroppedOnPane`(5) + `firstInputHandleId`(4) + `connectionDragSource`(6) + `pointerClientPosition`(3) + `buildAutoConnectConnection`(3) = **21개**다(`git diff origin/main -- .../edge-utils.test.ts | grep -c '^\+.*it('` = 21 로 확인). 이는 1회차 구현의 9케이스(`isConnectionDroppedOnPane`/`firstInputHandleId`, `review/code/.../11_04_21/testing.md` 서술과 일치) + 1회차 RESOLUTION 의 12케이스(`connectionDragSource`/`pointerClientPosition`/`buildAutoConnectConnection`, `RESOLUTION.md` "vitest 12케이스 추가(총 57 통과)" 서술과 일치)의 합으로도 9+12=21 로 재확인된다. `plan` 최종 완료 서술만 "27" 로 6개 많게 적혀 있어, 두 차례의 개별 라운드 기록(9, 12)은 정확한데 이를 합산해 최종 커밋 메시지/체크박스에 옮기는 과정에서 숫자가 부풀려졌다. 기능적 결함은 아니고 audit-trail 성격의 완료 기록 부정확이다.
  - 제안: `plan/in-progress/spec-sync-edge-gaps.md` §1.2 완료 서술의 "vitest 27케이스" 를 "vitest 21케이스"로 정정. CHANGELOG.md 는 구체적 개수를 명시하지 않아 해당 문제 없음(확인 완료).

- **[INFO]** `handleAddNodeFromSearch` 인라인 주석의 "유일한 체크포인트" 표현이 pre-existing 이중 pushUndo 와 엄밀히는 상충
  - 위치: `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx` `handleAddNodeFromSearch` 내 주석("buildAndAddNode 가 노드 생성 전에 이미 pushUndo 한 스냅샷이 **유일한** 체크포인트가 되도록…")
  - 상세: `buildAndAddNode` 가 `pushUndo()` 를 1회 호출한 뒤 store `addNode` 를 호출하는데, `addNode` 자신도 내부에서 `get().pushUndo()` 를 또 실행한다(`editor-store.ts` L747-748, 이번 PR 이전부터 존재하는 pre-existing 이중 push — 두 차례 리뷰 모두 INFO 로 확인·이월). 두 push 시점 사이에 상태 변화가 없어 스냅샷 내용은 동일하지만, undo 스택엔 물리적으로 2개 항목이 쌓인다. 결과적으로 "Ctrl+Z 1회로 노드+엣지 함께 취소"라는 사용자 체감 목표는 실제로 달성되지만(엣지 쪽 `onConnect` 의 `pushUndo` 는 `skipUndo:true` 로 정확히 스킵됨), 노드 생성 쪽에 남는 여분의 중복 스냅샷 때문에 이 제스처 **다음**에 오는 별개의 Ctrl+Z 1회가 눈에 보이는 변화 없는 no-op 이 된다. 주석의 "유일한 체크포인트" 는 이 잔여 이중 push 를 감안하면 과장이다.
  - 제안: 차단 사유 아님(pre-existing, 스코프 밖으로 이미 두 차례 이월 확인됨). 주석을 "이 제스처가 만드는 새 체크포인트 중 유일하게 유효한 것"처럼 미세 조정하거나, `buildAndAddNode`/`addNode` 의 이중 push 자체를 정리하는 별건 hygiene 이슈(이미 `review/code/.../11_28_30/SUMMARY.md` INFO #3 로 백로그 후보 기록됨)와 함께 처리 고려.

- **[INFO]** spec 본문(`spec/3-workflow-editor/2-edge.md` §1.2)과 구현이 line-level 로 정확히 일치함을 재확인
  - 위치: `spec/3-workflow-editor/2-edge.md` L32-38
  - 상세: 3개 불릿(빈 영역 드롭 시 팝업 표시 / 연결원 출력 포트→새 노드 첫 입력 포트 자동 연결 / 입력 포트 없으면 연결 생략)과 "현재 구현" 각주(`onConnectEnd`, `connectionState.isValid`/`fromNode`/`fromHandle`, `dragSource`, `buildAndAddNode` id 반환, `skipUndo`, 4개 순수 헬퍼, §1.3 배제 근거)가 실제 코드(`workflow-canvas.tsx` `onConnectEnd`/`openNodeSearchPopupAt`/`handleAddNodeFromSearch`/`buildAndAddNode`, `edge-utils.ts` 5개 헬퍼, `editor-store.ts` `onConnect(connection, opts?)`)와 정확히 대응한다. `frontmatter status: partial` 은 §1.3/§3.2/§4/§5 잔여 항목이 실제로 남아 있어 타당하다. 1회차 CRITICAL(spec stale)은 완전히 해소됐다.
  - 제안: 없음(조치 완료 확인).

- **[INFO]** 컨테이너 노드 첫 입력 포트가 예약 포트(`emit`)가 아니라는 `buildAutoConnectConnection`/`detectContainerConflict` 상호작용 가정을 backend schema 로 직접 재검증 — 현재 데이터로 안전
  - 위치: `codebase/backend/src/nodes/logic/{loop,foreach,map}.schema.ts` `inputs: [{id:'in'},{id:'emit'}]`, `codebase/frontend/src/lib/stores/editor-store.ts` `detectContainerConflict`(Rule 2: `isContainerNode(targetNode) && connection.targetHandle === 'emit'`)
  - 상세: 자동 연결의 target 은 항상 방금 생성된 신규 노드이고 `targetHandle = firstInputHandleId(newNodeDef)`. 3개 컨테이너 타입(loop/foreach/map) 모두 `inputs` 배열의 첫 요소가 `'in'`(둘째가 `'emit'`)이므로, 신규 노드가 컨테이너 타입이더라도 자동 연결의 `targetHandle` 은 항상 `'in'` 이 되어 `detectContainerConflict` Rule 2 를 트리거하지 않는다. 이는 `edge-utils.ts` JSDoc 의 "현재 노드 정의상 첫 입력이 데이터 포트라 발생하지 않는다"는 주장과 정확히 일치하며, 1·2회차 리뷰의 WARNING(#7 "컨테이너 포트 순서 암묵 의존")이 실측으로 재확인된다(현재는 미발생, 신규 컨테이너 타입 추가 시에만 잠재 위험).
  - 제안: 없음(이미 plan §1.3 이월 항목으로 추적 중, 이번 스코프 아님).

## 요약

§1.2("출력 포트 드래그 → 빈 영역 드롭 시 노드 추가 팝업 + 자동 엣지 연결")의 실제 구현은 spec 이 요구하는 3가지 행위(팝업 표시, 자동 연결, 입력 포트 없으면 생략)를 정확히 충족하고, `spec/3-workflow-editor/2-edge.md` §1.2 본문·CHANGELOG·유저 가이드 4개 mdx 페이지 모두 실제 코드와 line-level 로 일치함을 독립적으로 재확인했다(1회차 CRITICAL·2회차 WARNING 전건 실측 해소 확인). `onConnect` 의 `skipUndo` 옵션·5종 순수 헬퍼(`isConnectionDroppedOnPane`/`firstInputHandleId`/`connectionDragSource`/`pointerClientPosition`/`buildAutoConnectConnection`)는 null/undefined·빈 배열·터치 이벤트 등 엣지 케이스를 전수 커버하며 TODO/FIXME 류 미완성 표식은 없다. 새로 발견한 것은 두 가지 경미한 잔여 사항뿐이다: (1) `plan` 완료 서술의 vitest 케이스 수가 "27" 로 적혀 있으나 실측은 "21"(9+12 합산 오기재, 기능 결함 아님, audit-trail 정정 필요), (2) `handleAddNodeFromSearch` 주석의 "유일한 체크포인트" 표현이 pre-existing 이중 pushUndo(스코프 밖, 이미 이월 확인됨) 를 감안하면 미세하게 과장돼 있다. 둘 다 차단 사유는 아니다.

## 위험도
LOW
