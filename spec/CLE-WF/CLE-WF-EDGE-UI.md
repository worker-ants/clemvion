---
id: "CLE-WF-EDGE-UI"
title: "연결선 — 편집 조작과 시각 표현"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-WF-EDGE"
ancestors: ["CLE-VISION", "CLE-WF", "CLE-WF-EDGE"]
area: "CLE-WF"
content_hash: "a72c0f0fd58b40d20be5fa72ab218de67ccd186bf6aae0e69aeae03e4e1ff234"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: ["spec/3-workflow-editor/2-edge.md", "spec/3-workflow-editor/_product-overview.md"]
mirror_sha256: "9c4fc2121c7493a5ddd9dd822552b37998bff4887a2a2d995f89e0112d67c963"
etag: "sha256-9561b27a4ffe5723464196e504ac0ec93c3c1e5050943a07b3f49048315fe9e6"
---
> 구현 상태: 구현됨 · 원문: `spec/3-workflow-editor/2-edge.md`, `spec/3-workflow-editor/_product-overview.md` (§3.3 ED-EG-01~06) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

이 문서는 [연결선](CLE-WF-EDGE.md) 의 하위 문서로 에디터에서 연결선을 만들고, 다시 잇고, 지우고, 나누는 조작과 연결선의 시각 표현(색 · 상태 스타일 · 강조 · 화살표), 데이터 미리보기(Data Flow Preview)를 정한다.

## 연결선 만들기

### 끌어서 잇기

1. 출력 포트에서 마우스를 누르고 끌기 시작한다.
2. 커서를 따라가는 점선 임시 연결선을 그린다.
3. 유효한 입력 포트 위에서 마우스를 떼면 실선 연결선을 만든다.
4. 유효하지 않은 곳에서 떼면 임시 연결선을 지운다.

### 빈 영역에 놓기

- 출력 포트에서 끌어 빈 영역에 놓으면 노드 검색 팝업을 연다.
- 노드를 고르면 그 노드를 만들고 연결선을 자동으로 잇는다. 출발 쪽 출력 포트에서 새 노드의 첫 입력 포트로 잇는다.
- 새 노드에 입력 포트가 없으면(예: 트리거) 노드만 만들고 자동 연결은 건너뛴다.

현재 구현: `workflow-canvas.tsx` 의 `onConnectEnd` 가 처리한다. React Flow v12 의 `connectionState` 로 출력 포트(`fromHandle.type === 'source'`)를 끌다가 유효한 대상 없이(`isValid !== true`) 빈 영역에 놓았는지 판정한다. 그러면 놓은 자리에 노드 검색 팝업(더블클릭·우클릭 메뉴와 같은 팝업)을 열고 `NodeSearchPopupState.dragSource` 에 출발 포트를 기록한다. 노드를 고르면 `handleAddNodeFromSearch` 가 노드를 만들고(`buildAndAddNode` 가 새 노드 id 를 돌려줌) `onConnect(출발 포트 → 새 노드의 첫 입력 포트)` 로 잇는다. `onConnect` 의 `skipUndo` 옵션으로 "노드는 있고 연결선은 없는" 중간 상태를 따로 undo 스냅샷으로 남기지 않는다. 그래서 Ctrl+Z 한 번에 노드와 연결선을 함께 되돌린다. 판정·조립 순수 헬퍼는 `edge-utils.ts` 의 `connectionDragSource`, `pointerClientPosition`, `buildAutoConnectConnection`, `firstInputHandleId` 다. 입력 포트에서 시작한 역방향 끌기는 [역방향 연결과 다시 잇기](#역방향-연결과-다시-잇기) 가 다룬다.

### 역방향 연결과 다시 잇기

- 입력 포트에서 끌기 시작하면 역방향으로 연결선을 만든다. 놓을 대상은 출력 포트다.
- 이미 이어진 연결선의 끝점을 끌면 그 연결선을 떼어 다른 포트로 다시 잇는다. 빈 영역에 놓으면 지운다. 이 동작을 연결선 분리(detach)라고 한다. 연결선 분할과 다르다.

**역방향 연결**은 React Flow 의 기본 연결 모드(strict `connectionMode`)가 지원한다. 입력 포트(`target` 핸들)에서 끌어 출력 포트(`source` 핸들)에 놓으면 React Flow 가 Connection 을 핸들 종류 기준으로 정규화한다(source 는 출력 노드, target 은 입력 노드). 핸들에 `isConnectableStart`·`isConnectableEnd` 제약을 두지 않고 `onConnect`·`isValidConnection` 이 정규화된 Connection 을 방향과 상관없이 처리한다. 그래서 끈 방향과 관계없이 항상 올바른 방향의 연결선이 생기고 별도 코드는 필요 없다.

**다시 잇기**는 `workflow-canvas.tsx` 가 `onReconnect`·`onReconnectEnd` 두 콜백을 연결해 처리한다(로직은 `use-edge-reconnect.ts` 의 `useEdgeReconnect` 훅). React Flow 가 다시 이을 수 있는 연결선의 끝점 앵커를 자동으로 그리므로 끝점을 잡아 다른 포트로 끌면 다시 이어진다.

- store `onReconnect`(`editor-store.ts`)가 `reconnectEdge`(`shouldReplaceId:false`)로 연결선 id 를 유지한 채 갱신한다.
- `onConnect` 와 같은 유효성 검사(자기 연결, 중복, 컨테이너 충돌)를 공용 `evaluateConnection` 으로 적용한다([연결 유효성](CLE-WF-EDGE.md#연결-유효성)). 중복 검사에서는 다시 잇는 연결선 자신을 뺀다.
- 검사 뒤 포트 색 데이터와 컨테이너 소속을 다시 도출한다.
- 끝점을 **빈 캔버스에 놓으면**(분리) `onReconnectEnd` 가 연결선을 지운다(store `removeEdge`, undo 가능). 분리는 **놓은 위치**로 판정한다. `connectionState.toNode` 가 `null`(어느 노드에도 놓지 않음, pane)일 때만 지운다. 무효한 핸들 위에 놓은 경우(예: 자기 연결이라 유효성 검사가 거부해 다시 잇기가 일어나지 않음)는 지우지 않고 원래대로 둔다.
- 다시 잇기와 지우기는 각각 undo 체크포인트 하나로 처리한다.


## 시각 표현

### 포트 종류별 색

연결선은 출발 포트의 종류에 따라 색을 달리해 흐름을 알아보기 쉽게 한다.

| 포트 종류 | 색 | 뜻 | 예 |
| --- | --- | --- | --- |
| 데이터 포트 | 초록(#22c55e) | 일반 데이터 흐름 | 수동 트리거 노드의 출력, Transform 의 출력 |
| 에러 포트 | 빨강(#ef4444) | 에러 처리 경로 | HTTP Request 의 `error`, AI 에이전트 노드의 `error` |
| 시스템 포트 | 파랑(#3b82f6) | 제어 흐름 | AI 에이전트 노드의 `out`·`user_ended`·`max_turns`, Loop 의 `done` |
| 컨테이너 포트 | 보라(#a855f7) | 컨테이너 본문 진입 | Loop·ForEach·Map 의 `body` |

에러 연결선도 기본 스타일은 실선이다. 점선은 실행 중 흐름 애니메이션과 비활성 노드 연결선에만 쓴다.

### 상태별 스타일

| 상태 | 스타일 | 구현 |
| --- | --- | --- |
| 기본 | 곡선(Bezier) 실선, 포트 종류별 색, 1.5px | 구현됨(`custom-edge.tsx`) |
| 선택됨 | 2.5px, primary 색 | 구현됨(`custom-edge.tsx`) |
| 데이터 흐름(실행 중) | 데이터가 가는 방향으로 움직이는 점선 | 구현됨(`use-edge-execution-state.ts`, globals.css) |
| 실행 완료 | 잠깐 초록으로 바뀐 뒤 원래 색으로 돌아온다. | 구현됨(`use-edge-execution-state.ts`, globals.css) |
| 비활성 노드 연결 | 반투명 점선 | 구현됨(`use-edge-execution-state.ts`, `custom-edge.tsx`) |

`use-edge-execution-state.ts` 의 `useEdgeExecutionState` 훅이 실행 store(`status`, `nodeStatuses`)와 노드의 `isDisabled` 를 읽어 연결선마다 상태 스타일을 입힌다. 판정 순수 함수는 `edge-utils.ts` 의 `resolveEdgeExecutionState` 다. 세 상태는 서로 겹치지 않고 우선순위는 **비활성 > 데이터 흐름·실행 완료** 다.

- **데이터 흐름(flowing)**: 실행 중(`status==='running'`)에 출발 노드가 `completed` 이고 도착 노드가 `running` 이면 `edge.className='edge-flowing'` 을 준다. globals.css 가 출발에서 도착 방향으로 움직이는 점선(`edge-flow` keyframe)을 그린다.
- **실행 완료(completed)**: 출발·도착 노드가 둘 다 `completed` 면 `edge.className='edge-completed'` 를 준다. globals.css 의 한 번짜리 `edge-complete-flash` keyframe 이 잠깐 초록(#22c55e)으로 보였다가 원래 포트 색으로 돌린다.
- **비활성(inactive)**: 출발이나 도착 노드가 `isDisabled` 면 `edge.data.edgeInactive` 를 켠다. `custom-edge.tsx` 가 반투명(opacity 0.4) 점선으로 그린다. 실행과 관계없는 정적 상태다. 비활성 노드는 실행에 참여하지 않으므로 데이터 흐름·실행 완료를 적용하지 않는다.

실행 상태 스타일은 강조 효과(`useEdgeHighlighting`)보다 **먼저** 합쳐지고(`className` Set 병합) 마우스 올림·선택 강조가 그 위에 얹힌다. 강조 효과의 흐름 애니메이션은 마우스 올림·선택으로 켜지는 것이라 실행 중 데이터 흐름과는 별개 경로다.

### 강조 효과

노드가 많은 워크플로우에서 특정 연결을 찾기 쉽게 한다.

| 계기 | 동작 |
| --- | --- |
| 노드 마우스 올림·선택 | 연결된 연결선을 강조한다(2.5px, 포트 색 유지). 나머지 연결선은 흐리게(opacity 12%) 하고 흐름 방향 애니메이션을 보여 준다. |
| 연결선 마우스 올림 | 그 연결선만 강조하고 출발·도착 노드에 glow 효과를 준다. 나머지는 흐리게 한다. |
| 포커스 해제 | 150ms ease 전환으로 원래 상태로 돌아온다. |

우선순위는 연결선 마우스 올림 > 노드 마우스 올림 > 노드 선택이다.

### 화살표

- 연결선 끝(target 쪽)에 화살표 머리를 그린다.
- 화살표 색은 연결선의 포트 종류 색과 같다.
- 데이터 흐름 방향을 분명히 보여 준다.

## 연결선 조작

| 인터랙션 | 동작 | 구현 |
| --- | --- | --- |
| 클릭 | 연결선 선택 | 구현됨(React Flow 기본) |
| Delete | 선택한 연결선 삭제 | 구현됨(`deleteKeyCode={["Delete","Backspace"]}`) |
| 마우스 올림 | 연결선 강조와, 실행 뒤라면 흐른 데이터의 미리보기 툴팁 | 구현됨(`onEdgeMouseEnter` → `setHoveredEdge`, [데이터 미리보기](#데이터-미리보기)) |
| 연결선 위에 노드 놓기 | 연결선을 **나누고** 가운데에 노드를 넣는다(출발→새 노드, 새 노드→도착). | 구현됨([연결선 분할](#연결선-분할)) |

### 연결선 분할

연결선 분할(edge split)은 팔레트에서 노드를 끌어 **기존 연결선 위에 놓으면** 그 연결선을 나누고 가운데에 노드를 넣는 동작이다. 원래 연결선(출발→도착)을 지우고 `출발→새 노드` 와 `새 노드→도착` 두 연결선을 만든다.

현재 구현: `workflow-canvas.tsx` 의 `onDrop` 이 놓은 지점의 연결선을 DOM hit-test 로 찾는다(순수 헬퍼 `findEdgeIdAtPoint`, `.react-flow__edge[data-id]`). 뷰포트와 ReactFlow 에 기대는 동작이라 store 밖 캔버스 쪽에 둔다. 순수 헬퍼 `edge-utils.ts` 의 `buildEdgeSplitPlan` 이 새 Connection 두 개를 조립한다.

- **포트 선택**: 새 노드의 **첫 입력 포트**(`firstInputHandleId`, 예약 포트 `emit` 제외)를 `출발→새 노드` 의 target 으로, 새 노드의 **첫 출력 포트**(`firstOutputHandleId`)를 `새 노드→도착` 의 source 로 쓴다. 원래 연결선의 `sourceHandle`·`targetHandle` 은 새 연결선 두 개에 **그대로 남는다**. 출력이 여럿인 If/Else·Switch 나 입력이 여럿인 노드여도 원래 양 끝 핸들은 바뀌지 않는다. **출력이 여럿인 새 노드**(If/Else·Switch)를 넣으면 첫 출력만 도착 노드에 잇고 나머지 분기 포트는 이어지지 않은 채로 남는다. 사용자가 직접 잇는다.
- **적용 범위**: 새 노드에 입력 포트와 출력 포트가 **모두 있을 때만** 나눈다. 입력이 없는 트리거나 출력이 없는 노드를 놓거나(`buildEdgeSplitPlan` 이 `null`), 연결선이 아닌 빈 영역에 놓으면 나누지 않고 그 자리에 노드만 추가한다. 일반 팔레트 놓기와 같은 대체 동작이다.
- **컨테이너 새 노드 제외**: 놓는 노드 **자체가 컨테이너**(Loop·ForEach·Map, `isContainer`)면 나누지 않는다. 컨테이너의 첫 출력은 `body`(본문 진입)라서 `새 노드→도착` 연결선이 도착 노드를 새 컨테이너의 본문 자식으로 끌어들이기 때문이다([Rationale](#rationale)).
- **컨테이너 경계 연결선 제외**: `sourceHandle` 이 `body`(컨테이너 본문 진입)거나 `targetHandle` 이 `emit`(되돌아오는 입력)인 **컨테이너 경계 연결선**은 나누지 않는다. [컨테이너 연결선 규칙](CLE-WF-EDGE.md#컨테이너-연결선-규칙) 의 emit 단일성·경계 규칙, 그리고 에디터의 `containerId` 동기화 불변식과 어떻게 맞물리는지 아직 정하지 않았기 때문이다. 컨테이너 본문 종료 출력 `done` 연결선은 제외하지 **않는다**. Parallel 도 이름이 같은 `done` 을 일반 데이터 출력으로 쓰고, `done→새 노드` 분할은 본문 끌어들이기를 일으키지 않아 안전하다.
- **연결과 불변식(원자성)**: 분할 한 번은 원래 연결선 삭제 한 번과 `onConnect` **두 번**(출발→새 노드, 새 노드→도착)을 일으킨다. `onConnect` 에 리스너를 붙이는 쪽은 "놓기 한 번에 두 번" 을 전제해야 한다. 새 연결선 두 개도 빈 영역 놓기·다시 잇기와 같이 표준 `onConnect`(→`evaluateConnection`) 경로를 쓰므로 포트 색 도출과 유효성 검사가 그대로 적용된다. 위 제외 규칙(원래 `body`·`emit` 연결선, 컨테이너 새 노드) 덕분에 두 Connection 은 `detectContainerConflict` 의 유일한 거부 분기(source `body`, target `emit`)에 걸리지 않고, 새 노드라 자기 연결과 중복도 있을 수 없다. 그래서 `onConnect` 두 번은 **항상 성공**하고 `removeEdge` 뒤 그래프가 반쪽만 바뀌는 원자성 문제가 구조적으로 생기지 않는다. `buildEdgeSplitPlan` 이 `null` 이 아닌 값을 돌려준다는 것이 분할 안전성의 관문이다. 거부 분기 핸들은 공유 상수로 store 와 묶여 있다([Rationale](#rationale) 「결합 주의」).
- **Undo**: 빈 영역 놓기·다시 잇기와 같이 **undo 체크포인트 하나**로 처리한다. 노드를 추가할 때 `pushUndo` 를 한 번 하고, 이어지는 원래 연결선 삭제와 새 연결선 두 개 연결은 `skipUndo` 로 접는다. Ctrl+Z 한 번에 삽입 전체(노드와 연결선 두 개 삭제, 원래 연결선 복원)를 되돌린다.

## 데이터 미리보기

실행이 끝난 뒤 연결선에 마우스를 올리면 툴팁에 그 연결선으로 흐른 데이터를 보여 준다. 툴팁 제목은 "Data Flow Preview" 이고, 줄인 JSON(예: `"items": "[3 items]"`)과 크기(예: `Size: 245 bytes`)를 보여 준다.

- 큰 데이터는 줄여 보여 준다(배열 길이, 객체 필드 수).
- 툴팁의 **"전체 데이터 보기"** 버튼을 누르면 줄이지 않은 전체 데이터를 모달로 보여 준다. 연결선을 누르는 동작은 연결선 선택이므로 모달은 툴팁 버튼으로만 연다.

현재 구현: `edge-data-preview.tsx` 의 `EdgeDataPreviewTooltip`·`EdgeDataModal` 과 `use-edge-hover-preview.ts` 훅이 맡는다.

- 연결선에 마우스를 올리면 `workflow-canvas.tsx` 의 `onEdgeMouseEnter` 가 `useEdgeHoverPreview.show(edge.id, clientX, clientY)` 로 커서 위치에 툴팁을 예약한다.
- 툴팁은 연결선 **출발 노드의 최근 실행 출력**(`findLatestResultByNodeId` → `unwrapNodeOutput().output`)을 줄여 보여 준다. 실행 데이터가 없으면 그리지 않는다.
- 줄이기와 크기 계산은 순수 함수 `lib/utils/edge-data-preview.ts` 의 `summarizeDataForPreview`·`formatBytes` 다.
- 연결선에 들어오면 90ms 기다린 뒤 보여 준다. 노드가 촘촘한 캔버스에서 커서가 여러 연결선을 스쳐 지날 때 머물지 않은 연결선의 툴팁과 직렬화를 건너뛰기 위해서다.
- 연결선에서 벗어나도 200ms 기다린 뒤 숨긴다. 그동안 커서를 툴팁으로 옮겨 "전체 데이터 보기" 를 누를 수 있다.
- 누르면 `EdgeDataModal`(Dialog)이 줄이지 않은 전체 JSON 을 보여 준다. 모달은 마우스 올림 생명주기와 따로 캔버스의 `dataModalEdgeId` 로 연다.
- 크기 표시: 직렬화 결과가 100KB 이하면 `TextEncoder` 로 정확히 인코딩해 잰다. 넘으면 인코딩 할당을 건너뛰고 글자 수로 구한 하한 근사(`bytesApprox`)를 쓰며 크기 앞에 `~` 를 붙인다. 큰 출력에 마우스를 올릴 때 드는 비용의 상한을 두려는 것이다.

## 구현 위치

- `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx`
- `codebase/frontend/src/components/editor/canvas/custom-edge.tsx`
- `codebase/frontend/src/components/editor/canvas/use-edge-highlighting.ts`
- `codebase/frontend/src/components/editor/canvas/use-edge-reconnect.ts`
- `codebase/frontend/src/components/editor/canvas/use-edge-execution-state.ts`
- `codebase/frontend/src/components/editor/canvas/edge-data-preview.tsx`
- `codebase/frontend/src/components/editor/canvas/use-edge-hover-preview.ts`
- `codebase/frontend/src/lib/stores/editor-store.ts`
- `codebase/frontend/src/lib/utils/edge-utils.ts`
- `codebase/frontend/src/lib/utils/edge-data-preview.ts`

## Rationale

### 연결선 분할은 일반 데이터 연결선과 입출력이 모두 있는 노드로 한정한다 (2026-07-13)

컨테이너 경계(`body`·`done`·`emit`) 연결선 위에서 나누면 emit 단일성·경계 규칙과 에디터의 `containerId` 동기화 불변식이 **어떻게 맞물리는지 정의되지 않았다**. 세 가지 대안을 검토했다.

- (a) 모든 연결선 분할 허용: 컨테이너 경계에서 나누면 새 노드가 컨테이너 안과 밖 어디에 속하는지, emit 정확히 하나 불변식을 어떻게 지키는지 정의가 없어 규칙을 말없이 어길 위험이 있다.
- (b) 분할을 store 원자 동작으로 만들어 컨테이너 재계산까지 포함: 새 불변식 설계가 필요해 이 기능 범위를 크게 넘는다.
- (c) **일반(컨테이너 경계가 아닌) 연결선으로 한정하고 경계 연결선은 일반 노드 추가로 대신**: 채택했다. 컨테이너 구조를 건드리지 않아 기존 불변식이 저절로 지켜진다. 새 연결선 두 개는 표준 `onConnect` 를 다시 써서 소속 동기화와 컨테이너 규칙을 그대로 탄다. 컨테이너 경계 분할이 실제로 필요해지면 그때 명시 규칙과 함께 넓힌다.

같은 이유로 입력이나 출력 포트가 없는 노드(트리거, 출력 없는 노드)는 가운데 삽입이 성립하지 않으므로 나누지 않고 노드만 추가한다. 빈 영역 놓기의 자동 연결이 `firstInputHandleId` 가 `null` 이면 연결을 건너뛰는 선례와 맞춘 것이다.

**컨테이너 새 노드 제외**: 원래 연결선의 경계 핸들만 거르면 "**놓는 새 노드 자체가 컨테이너**" 인 경우가 빠진다. 컨테이너의 첫 출력이 `body` 라서 `firstOutputHandleId` 가 `body` 를 고르고, `새 노드→도착` 연결선이 `propagateContainerOnConnect` 의 1번 규칙을 발동해 도착 노드를 새 컨테이너 본문 자식으로 말없이 끌어들인다(또는 충돌 거부로 그래프가 반쪽만 바뀐다). 그래서 `buildEdgeSplitPlan` 에 `definition.isContainer` 가드를 두어 컨테이너 새 노드는 나누지 않는다(노드만 추가). 이 제외로 새 Connection 두 개가 `detectContainerConflict` 의 `body`·`emit` 거부 분기에 걸릴 경로가 사라져 "`removeEdge` 뒤 `onConnect` 반쪽 실패" 원자성 우려도 **구조적으로 해소**된다(별도 store 원자 동작이 필요 없다). 경계 판정은 `sourceHandle∈{body,done}` 이 아니라 **`body` 만**으로 한다. Parallel 은 컨테이너가 아닌데도 이름이 같은 `done` 을 일반 데이터 출력으로 쓰므로 `done` 을 한데 묶으면 그 데이터 연결선 분할이 잘못 막힌다. 컨테이너 `done` 연결선 분할은 본문 끌어들이기를 일으키지 않아 안전하다.

**결합 주의**: 위 원자성 보장은 `detectContainerConflict`(`editor-store.ts`)의 거부 분기가 source `body` 와 target `emit` 두 가지뿐이라는 데 기댄다. 두 핸들 값은 `edge-utils.ts` 의 공유 상수 `CONTAINER_BODY_HANDLE`·`CONTAINER_EMIT_HANDLE` 로 `buildEdgeSplitPlan`(분할 제외)과 store 의 `detectContainerConflict`·`propagateContainerOnConnect`(거부·전파)가 함께 import 해 컴파일 시점에 묶여 있다. 다만 그 함수에 **다른 핸들의 거부 분기**가 새로 생기면 `buildEdgeSplitPlan` 의 제외 규칙도 함께 고쳐야 반쪽 그래프가 다시 생기지 않는다. 양쪽 JSDoc 에 서로를 가리키는 주석을 둔다.

**undo 체크포인트 하나**: 노드 생성 헬퍼 `buildAndAddNode`(빈 영역 놓기도 쓴다)는 스스로 `pushUndo` 를 부르지 않는다. 그 안의 `addNode`(store)가 부르는 `pushUndo` 하나만 체크포인트다. 둘 다 부르면 삽입 한 번에 같은 스냅샷이 두 개 쌓인다. store 순서(addNode → removeEdge(skipUndo) → onConnect(skipUndo) 두 번 → undo)가 스냅샷 하나를 남기고 undo 한 번으로 완전히 되돌아감을 통합 테스트로 고정한다.
