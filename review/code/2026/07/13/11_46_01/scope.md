# 변경 범위(Scope) 리뷰 결과

## 대상 (37개 파일)
- 기능 구현: `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx`, `codebase/frontend/src/lib/stores/editor-store.ts`(+test), `codebase/frontend/src/lib/utils/edge-utils.ts`(+test)
- 문서 동기화: `CHANGELOG.md`, `spec/3-workflow-editor/2-edge.md`, `plan/in-progress/spec-sync-edge-gaps.md`, 유저가이드 4개(`canvas-basics.mdx`/`.en.mdx`, `connecting-nodes.mdx`/`.en.mdx`)
- 리뷰 아티팩트: `review/code/2026/07/13/11_04_21/*`(13개), `review/code/2026/07/13/11_28_30/*`(11개)

## 의도된 작업
`plan/in-progress/spec-sync-edge-gaps.md` §1.2 — "출력 포트에서 드래그를 시작해 유효 target 없이 빈 캔버스에 드롭하면 노드 추가 검색 팝업을 열고 자동으로 엣지를 연결한다"의 구현 + 이에 대한 2차례 ai-review(11_04_21 HIGH→해소, 11_28_30 MEDIUM→해소) 라운드의 후속 반영. 이 diff 는 단일 기능 구현과 그 리뷰 사이클 전체를 포괄한다.

## 발견사항

- **[INFO]** `openNodeSearchPopupAt` 추출이 기존 두 경로(`onPaneClick`, `handleCanvasMenuAction`)를 함께 리팩터
  - 위치: `workflow-canvas.tsx` `onPaneClick`(더블클릭), `handleCanvasMenuAction`(우클릭 "add-node")
  - 상세: §1.2 신규 진입점(`onConnectEnd`)이 "팝업 열기" 시퀀스(컨텍스트 메뉴 닫기→상태 세팅→검색어 초기화)의 세 번째 발생지가 되자, 기존 두 경로도 동일 시퀀스를 갖고 있던 것을 공용 헬퍼로 통합했다. 결과적으로 이번 PR 이 직접 요구하지 않은 두 기존 함수의 내부 구현이 바뀌었다(동작은 behavior-preserving으로 확인됨 — 다른 리뷰어들도 동일하게 검증). 신규 진입점 추가가 유발한 중복을 같은 커밋에서 해소한 것으로, "무관한 리팩토링"으로 분류하기보다는 "신규 코드가 만든 중복의 즉시 해소"에 해당해 통상 허용 범위이나, 엄밀히는 plan §1.2 항목의 문언(자동 연결 배선)을 넘어 인접 코드까지 손댄 것은 사실이다.
  - 제안: 현 상태로 문제 삼을 사안은 아님(범위 확장이 아니라 신규 중복 회피). 참고로만 기록.

- **[INFO]** `buildAndAddNode` 반환 타입 변경(`void` → `string | undefined`)
  - 상세: §1.2 자동 연결이 신규 노드 id 를 필요로 하므로 기능 요구에서 직접 파생된 변경. 기존 호출부(`handleAddNodeAtCenter`, `onDrop`)는 반환값을 무시할 뿐 영향 없음. 범위 이탈 아님.

- **[INFO]** `editor-store.ts` `onConnect` 시그니처에 `opts?: { skipUndo?: boolean }` 추가
  - 상세: 자동 연결 시 "노드 생성+연결"을 단일 undo 체크포인트로 묶기 위한 최소 확장(1차 ai-review WARNING 반영). 옵션 파라미터라 하위 호환. 기능 확장(over-engineering)이 아니라 리뷰가 지적한 결함의 직접 수정.

- **[INFO]** 4개 유저 가이드 MDX 파일(ko/en) 갱신
  - 상세: §1.2 신규 동작(빈 영역 드롭 시 자동 팝업+연결)이 2차 ai-review(11_28_30) `user_guide_sync` WARNING 으로 지적된 갭을 메운 것. 신규 기능이 실제로 사용자 가시 동작을 바꾸므로 가이드 갱신은 해당 기능 구현의 자연스러운 일부이며 범위 밖 문서 손질이 아니다.

- **[INFO]** `plan/in-progress/spec-sync-edge-gaps.md` 에 §1.3 이월 항목 4건 신설
  - 상세: §1.2 리뷰 과정에서 나온 architecture/testing INFO·WARNING(God Component 훅 추출, `dragSource` 방향성 재설계, `onReconnect` 상호작용 우려, 컴포넌트 실배선 테스트)을 "지금 구현하지 않고 §1.3 착수 시 재검토"로 명시적으로 defer 한 기록일 뿐, 이번 커밋에서 실제로 그 리팩터·기능을 수행하지는 않았다. 문서 기록만 추가되었으므로 기능 확장이 아니다.

- **[INFO]** 리뷰 세션 산출물(`review/code/2026/07/13/11_04_21/*`, `review/code/2026/07/13/11_28_30/*`) 24개 파일 신규 커밋
  - 상세: 저장소 확립 관례(`review/` 는 gitignore 대상 아님, SUMMARY·RESOLUTION 도 커밋 — 팀 메모 확인)에 부합. 코드 변경(§1.2 기능)과 그에 대한 리뷰·해소 이력이 같은 작업 단위로 묶인 것으로, 전체 37개 파일 중 다수(24개)를 차지하지만 diff 상 구분이 명확하고 실제 코드 변경 파일(9개: CHANGELOG/spec/plan/mdx×4/ts×3/tsx×1)과 섞여 스코프를 흐리지 않는다.

불필요한 리팩토링(관련 없는 코드 정리), 요청하지 않은 기능 확장(over-engineering), 변경 의도와 무관한 파일·코드 영역 수정, 의미 없는 포맷팅·주석·임포트·설정 변경은 발견되지 않았다. 신규 임포트(`OnConnectEnd` 타입, `edge-utils.ts` 신규 헬퍼 5종)는 모두 실사용된다.

## 요약
37개 파일 변경은 plan §1.2(출력 포트 드래그→빈 영역 드롭→노드 추가 팝업+자동 엣지 연결) 구현과, 그 위에서 진행된 2차례 ai-review(HIGH→MEDIUM→해소) 사이클의 반영으로 정확히 설명된다. 코드 변경(workflow-canvas.tsx/editor-store.ts/edge-utils.ts+테스트)은 기능 요구에서 직접 파생됐고, 문서 변경(CHANGELOG/spec/plan/유저가이드 4종)은 동일 기능의 가시성 갱신이며, 리뷰 아티팩트 24개 파일 커밋은 저장소의 확립된 프로세스 관례다. `openNodeSearchPopupAt` 추출이 기존 두 호출부(더블클릭·우클릭 메뉴)를 함께 손댄 점만 엄밀히는 신규 기능 자체보다 넓지만, 신규 진입점이 만든 중복을 같은 커밋에서 해소한 것이라 통상 허용 범위이며 behavior-preserving 임이 확인됐다. 요청 범위를 벗어난 리팩토링·기능 확장·무관한 파일 수정·포맷팅/주석/임포트/설정 잡음은 발견되지 않았다.

## 위험도
NONE
