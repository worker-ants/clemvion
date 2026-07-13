# Resolution — edge §1.2 ai-review (2026-07-13 11:04)

원 리뷰 위험도 **HIGH** (CRITICAL 1 + WARNING 6). 아래와 같이 반영했다.

## Critical

| # | 발견 | 조치 |
|---|------|------|
| 1 | SoT spec `spec/3-workflow-editor/2-edge.md` §1.2 가 "미구현 · Planned" 로 stale | **반영** — §1.2 헤더의 "(미구현 · Planned)" 제거, "현재 구현" 각주를 실제 구현(React Flow v12 `connectionState`, `onConnectEnd`, `dragSource`, `buildAndAddNode` 반환값, `skipUndo` undo 단일화, 순수 헬퍼)으로 갱신. `status: partial` 은 §1.3/§3.2/§4/§5 잔여로 유지. 교차 spec grep 결과 edge §1.2 를 planned 로 참조하는 다른 문서 없음(self-contained) → 사실 동기화라 full consistency-check 생략(비례성). |

## Warning

| # | 발견 | 조치 |
|---|------|------|
| 2 | undo 스냅샷 중복 push (Ctrl+Z 시 고아 노드) | **반영** — store `onConnect` 에 `opts?.skipUndo` 추가. 자동 연결 경로는 `buildAndAddNode` 의 단일 pushUndo(노드 생성 전 스냅샷)만 체크포인트가 되도록 `onConnect(conn, {skipUndo:true})` 호출 → Ctrl+Z 1회로 노드+엣지 함께 취소. |
| 3 | §1.2 배선(`onConnectEnd`/`handleAddNodeFromSearch`) 미검증 | **반영** — 배선 판정/조립 로직을 순수 헬퍼(`connectionDragSource`, `pointerClientPosition`, `buildAutoConnectConnection`)로 추출하고 vitest 12케이스 추가(총 57 통과). 소스-핸들 타입 필터·touch/mouse 좌표 추출·targetHandle 부재 시 생략 모두 커버. |
| 4 | CHANGELOG 미갱신 | **반영** — `CHANGELOG.md` 최상단에 §1.2 Unreleased 항목 추가(SoT 명시). |
| 5 | `workflow-canvas.tsx` God Component 팽창 | **이월** — "드래그 종료→팝업 오픈→자동 연결" 오케스트레이션의 전용 훅 추출은 §1.3 착수 시 함께 검토(plan §1.3 이월 항목 (a) 기록). 유사 코드 누적 시점 리팩터가 적절. |
| 6 | "노드 검색 팝업 열기" 로직 3중 중복 | **반영** — `openNodeSearchPopupAt(clientX, clientY, flowPosition, dragSource?)` 공용 헬퍼로 통합, `onPaneClick`·`handleCanvasMenuAction`·`onConnectEnd` 세 경로가 공유. |
| 7 | `firstInputHandleId` 가 컨테이너 첫 입력 포트 순서에 암묵 의존 | **부분 반영** — `buildAutoConnectConnection` JSDoc 에 "컨테이너 충돌은 현재 노드 정의상 첫 입력이 데이터 포트라 발생하지 않음" 명시. 현행 노드 정의상 첫 입력이 예약 포트(`emit` 등)인 케이스 없음(미발생). 예약 포트 방어 로직 강화는 실제 그런 노드 추가 시로 이월. |

## Info (선택 반영)

- #9 `getNodeDefinition` 이중 조회 — `handleAddNodeFromSearch` 는 자동 연결 시 1회만 재조회(경미, Map 조회). 미변경.
- #12 touch/mouse 분기 주석 — `pointerClientPosition` 헬퍼로 추출되며 JSDoc 로 설명 대체.
- #13 `source` 필드명 혼동 — `NodeSearchPopupState.source` → `dragSource` 로 개명(Connection.source 와 구분).
- #10 `dragSource` 방향성 비대칭 → §1.3 이월 (plan (b)).
- #15 `onReconnect` 미배선 상호작용 우려 → §1.3 이월 (plan (c)).
- 기타 INFO(보안 레이어 분리 정상 #8, 성능 O(1) #11 등)는 조치 불요.

## 검증

- tsc `--noEmit`: clean
- vitest `edge-utils.test.ts`: **57 passed** (신규 헬퍼 5종 커버)
- eslint(변경 4파일): 0 errors (기존 `aria-selected` 경고 1건은 본 변경과 무관한 팝업 결과 리스트 JSX)
- e2e(`make e2e-test-full`): backend e2e + Playwright 46 passed (재실행)
- fresh `/ai-review --branch origin/main`: 본 resolution 커밋 후 재검토
