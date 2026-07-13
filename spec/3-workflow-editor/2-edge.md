---
id: edge
status: partial
code:
  - codebase/frontend/src/components/editor/canvas/custom-edge.tsx
  - codebase/frontend/src/components/editor/canvas/use-edge-highlighting.ts
  - codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx
  - codebase/frontend/src/components/editor/canvas/use-edge-reconnect.ts
  - codebase/frontend/src/lib/stores/editor-store.ts
  - codebase/frontend/src/lib/utils/edge-utils.ts
  - codebase/frontend/src/app/(editor)/w/[slug]/workflows/[id]/editor-loader.tsx
  - codebase/backend/src/modules/edges/**
pending_plans:
  - plan/in-progress/ai-agent-tool-connection-rewrite.md
  - plan/in-progress/spec-sync-edge-gaps.md
---

# Spec: 엣지 연결 규칙

> 관련 문서: [PRD 워크플로우 에디터](./_product-overview.md#33-엣지-연결) · [Spec 캔버스](./0-canvas.md) · [Spec 노드 공통](./1-node-common.md) · [데이터 모델 - Edge](../1-data-model.md#27-edge)

---

## 1. 엣지 생성

### 1.1 드래그 앤 드롭 연결

1. 출력 포트에서 마우스 다운 → 드래그 시작
2. 임시 엣지(점선) 렌더링, 커서를 따라 이동
3. 유효한 입력 포트 위에서 마우스 업 → 엣지 생성(실선)
4. 유효하지 않은 곳에서 마우스 업 → 임시 엣지 제거

### 1.2 빈 영역 드롭 시

- 출력 포트에서 드래그 후 빈 영역에 드롭하면 노드 추가 검색 팝업 표시
- 노드 선택 시 해당 노드 생성 + 자동으로 엣지 연결 (연결원의 출력 포트 → 새 노드의 첫 입력 포트)
- 대상 노드에 입력 포트가 없으면(예: 트리거) 노드만 생성하고 자동 연결은 생략

> 현재 구현: `workflow-canvas.tsx` `onConnectEnd` 가 처리한다. React Flow v12 `connectionState` 로 출력 포트(`fromHandle.type === 'source'`) 드래그가 유효 target 없이 빈 영역(`isValid !== true`)에 드롭됐는지 판정해, 드롭 위치에 노드 추가 검색 팝업(더블클릭·우클릭 메뉴와 동일한 팝업)을 열고 `NodeSearchPopupState.dragSource` 에 연결원을 기록한다. 노드 선택 시 `handleAddNodeFromSearch` 가 노드를 생성(`buildAndAddNode` 가 신규 노드 id 반환)한 뒤 `onConnect(연결원 → 새 노드의 첫 입력 포트)` 로 자동 연결한다. `onConnect` 의 `skipUndo` 옵션으로 엣지 추가가 "노드는 있고 엣지는 없는" 중간 상태를 별도 undo 스냅샷으로 남기지 않게 해, Ctrl+Z 1회로 노드와 엣지를 함께 취소한다. 판정·조립 순수 헬퍼는 `edge-utils.ts` `connectionDragSource`/`pointerClientPosition`/`buildAutoConnectConnection`/`firstInputHandleId`. 입력 포트에서 시작한 역방향 드래그는 §1.3 소관이라 배제한다.

### 1.3 역방향 연결 · 기존 엣지 재연결

- 입력 포트에서 드래그 시작하면 역방향으로 엣지 생성 (드롭 대상: 출력 포트)
- 기존 연결이 있는 엣지의 끝점을 드래그하면 그 엣지를 분리하여 재연결(빈 영역에 놓으면 삭제)

> **역방향 연결** — React Flow strict `connectionMode`(기본)의 기본 동작으로 지원된다. 입력 포트(`target` 핸들)에서 드래그를 시작해 출력 포트(`source` 핸들)에 드롭하면 React Flow 가 Connection 을 **핸들 타입 기준으로 정규화**(source=출력 노드, target=입력 노드)한다. 우리 핸들은 `isConnectableStart`/`isConnectableEnd` 제약을 두지 않고 `onConnect`/`isValidConnection` 은 정규화된 Connection 을 방향 무관하게 처리하므로(§2.2 단위 테스트), 드래그 방향과 무관하게 항상 올바른 방향의 엣지가 생성된다 — 별도 커스텀 코드 불필요.
>
> **기존 엣지 재연결** — `workflow-canvas.tsx` 가 `onReconnect`/`onReconnectEnd` 두 콜백을 배선한다(로직은 `use-edge-reconnect.ts` `useEdgeReconnect` 훅). React Flow 가 reconnectable 엣지의 끝점 앵커를 자동 렌더하므로 엣지 끝점을 잡아 다른 포트로 끌면 재연결된다. store `onReconnect`(`editor-store.ts`)이 `reconnectEdge`(`shouldReplaceId:false` 로 엣지 id 보존)로 갱신하고, onConnect 과 동일한 유효성(자기연결/중복/컨테이너 충돌 — 단 중복 검사는 재연결 중인 엣지 자신을 제외; 공용 `evaluateConnection`)을 적용한 뒤 포트색 data·컨테이너 소속을 재도출한다. 끝점을 **빈 캔버스에 놓으면**(detach) `onReconnectEnd` 가 엣지를 삭제한다(store `removeEdge`, undo 가능). detach 는 **드롭 위치**로 판정한다 — `connectionState.toNode` 가 null(아무 노드에도 안 놓임=pane)일 때만 삭제하므로, 무효 핸들 위 드롭(예: 자기연결이라 유효성 거부로 재연결이 일어나지 않은 경우)은 삭제가 아니라 원상 유지된다. 재연결·삭제 각각 단일 undo 체크포인트.

---

## 2. 연결 유효성 규칙

### 2.1 허용되는 연결

| 규칙 | 설명 |
|------|------|
| 출력 → 입력 | 출력 포트에서 입력 포트로의 방향만 허용 |
| 같은 워크플로우 | 같은 워크플로우 내의 노드 간만 연결 가능 |
| 1개의 출력 포트 → N개의 입력 포트 | 하나의 출력에서 여러 노드로 분기 가능 |
| N개의 출력 포트 → 1개의 입력 포트 | 여러 노드의 출력이 하나의 입력으로 합류 가능 |

### 2.2 금지되는 연결

구조적으로 의미가 없는 연결은 **하드 차단**한다 (엣지 자체가 생기지 않는다).

| 규칙 | 시각적 피드백 | 구현 |
|------|--------------|------|
| 자기 자신으로 연결 (`source === target`) | 드래그 중 커서 금지 아이콘(🚫) | 구현됨 (`isValidConnection` — `editor-store.ts`) |
| 출력 → 출력 | 커서 금지 아이콘 | 구현됨 (React Flow 핸들 타입 강제) |
| 입력 → 입력 | 커서 금지 아이콘 | 구현됨 (React Flow 핸들 타입 강제) |
| 동일 연결 중복 (같은 source·sourceHandle·target·targetHandle) | "already connected" 토스트 (영문 SoT, 표시 계층 로컬라이즈) | 구현됨 (`onConnect` — `editor-store.ts`) |

> 구현: `isValidConnection` (`editor-store.ts`, `<ReactFlow>` prop 으로 전달) 이 드래그 중 `source === target` 자기연결을 `false` 로 판정해 커서 🚫 로 차단한다. 출력→입력 방향과 출력↔출력/입력↔입력 금지는 React Flow 핸들 타입(source/target)이 강제한다. `onConnect` 은 드롭 시점에 자기연결(방어적 무시)·동일 연결 중복(토스트 후 무시)·컨테이너 소속 충돌(`detectContainerConflict`)을 순서대로 검사한 뒤에만 `addEdge` 한다. 순수 판정 헬퍼(`isSelfConnection`·`isDuplicateConnection`)는 `edge-utils.ts`.
>
> 자기연결·동일 연결 중복은 **DB 레벨 제약과 동일한 invariant** 를 캔버스가 선제 차단하는 이중 방어다 — [Spec 데이터 모델 §2.7 Edge](../1-data-model.md#27-edge) 의 `source_node_id != target_node_id` 및 `(source_node_id, source_port, target_node_id, target_port)` UNIQUE 가 최종 안전망이다.
>
> **순환은 여기서 차단하지 않는다** — §2.3 참조 (warn-not-block).

### 2.3 순환 참조 — 경고하되 차단하지 않음 (warn-not-block)

캔버스는 사이클 생성을 **막지 않는다**. 실행 엔진이 분기 노드(Switch/If-Else 등)의 포트 라우팅을 통한 back-edge 순환(재시도·폴링 루프)을 **정식 지원**하기 때문이다 (spec/5-system/4-execution-engine.md). 대신 **탈출 불가로 판정되는 위험한 순환만 경고 배지**로 드러낸다.

- 그래프 전체를 DFS로 1회 순회해 back-edge(순환)를 탐지한다.
- back-edge 의 **source 노드가 분기 노드가 아니면**(= 조건/케이스로 출력 포트를 선택하지 못하는 pass-through 노드) 그 순환은 정적으로 탈출 불가로 보고 해당 노드에 **`graph:unescapable-cycle` 경고**(severity `warning`, 노란 배지)를 붙인다. back-edge source 가 분기 노드면 탈출 가능으로 보고 경고하지 않는다.
- **예외 (순환으로 보지 않음)**: 컨테이너 반복 구조 엣지. 컨테이너 → 자식 진입(`sourceHandle === 'body'`)과 **자식 → 조상 컨테이너의 `emit` 포트 수집(`targetHandle === 'emit'`)** 은 노드 내부 반복이지 그래프 사이클이 아니므로 검사에서 제외한다. (loopback 방향의 SoT 는 backend `shadow-workflow.ts` `CONTAINER_LOOPBACK_PORTS = {'emit'}` — 자식이 조상 컨테이너의 `emit` 로 돌아간다.)

> 구현: graph-level 규칙 `evaluateGraphCycleWarnings` (`@workflow/graph-warning-rules` `rules/cycle.ts`) 가 위 판정을 수행한다. frontend canvas 는 `editor-store.ts` `evaluateGraphWarningsLocal` 에서 per-node-type 규칙 결과와 합쳐 배지로 노출하고, backend 는 `GET /workflows/:id/graph-warnings` 응답(`workflows.service.ts` `getGraphWarnings`)에 동일 결과를 포함해 두 surface 가 일치한다. severity 가 `warning` 이라 저장을 차단하지 않는다. 분기 노드 판정은 런타임 `_selectedPort` 의 **정적 근사**(rule 파일의 `BRANCH_NODE_TYPES` 집합)이며, advisory 경고라 근사의 부정확성은 치명적이지 않다.

---

## 3. 엣지 시각적 표현

### 3.1 포트 타입별 엣지 색상

엣지는 출발점 포트의 타입에 따라 색상으로 구분되어 워크플로우 흐름 파악이 용이합니다.

| 포트 타입 | 색상 | 설명 | 예시 |
|----------|------|------|------|
| 데이터 포트 | 초록색 (#22c55e) | 일반 데이터 흐름 | Manual Trigger → out, Transform → out |
| 에러 포트 | 빨간색 (#ef4444) | 오류 핸들링 경로 | HTTP Request → error, AI Agent → error |
| 시스템 포트 | 파란색 (#3b82f6) | 제어 흐름 | AI Agent → out/user_ended/max_turns, Loop → done |
| 컨테이너 포트 | 보라색 (#a855f7) | 컨테이너 본문 진입 | Loop/ForEach/Map → body |

### 3.2 엣지 상태별 스타일

| 상태 | 스타일 | 구현 |
|------|--------|------|
| 기본 | 곡선(Bezier) 실선, 포트 타입별 색상, 1.5px | 구현됨 (`custom-edge.tsx`) |
| 선택됨 | 2.5px, primary 색상 | 구현됨 (`custom-edge.tsx`) |
| 데이터 흐름 (실행 중) | 애니메이션 점선 (데이터 이동 방향으로) | 미구현 (Planned) |
| 실행 완료 | 초록색으로 잠시 변경 후 복귀 | 미구현 (Planned) |
| 비활성 노드 연결 | 반투명 점선 | 미구현 (Planned) |

> `custom-edge.tsx` 는 `selected` / `isHighlighted` 에 따른 strokeWidth(1.5 / 2.5)·색상(포트색 / primary)만 처리한다. 실행 상태(애니메이션 점선·완료 초록·비활성 반투명)는 아직 엣지에 반영되지 않는다. (§3.3 하이라이팅의 흐름 애니메이션은 hover/선택 트리거로, 실행 중 데이터 흐름과는 별개다.)

### 3.3 인터랙티브 하이라이팅

노드가 많은 복잡한 워크플로우에서 특정 연결을 식별하기 위한 기능.

| 트리거 | 동작 |
|--------|------|
| **노드 hover/선택** | 연결된 엣지 강조 (2.5px, 포트 색상 유지) + 나머지 엣지 dim (opacity 12%) + 흐름 방향 애니메이션 |
| **엣지 hover** | 해당 엣지만 강조 + source/target 노드에 glow 효과 + 나머지 dim |
| **focus 해제** | 150ms ease 전환으로 원래 상태 복귀 |

우선순위: 엣지 hover > 노드 hover > 노드 선택

### 3.4 화살표

- 엣지 끝 (target 쪽)에 화살표 머리 표시
- 화살표 색상은 엣지의 포트 타입 색상과 동일
- 데이터 흐름 방향을 명확히 시각화

---

## 4. 엣지 조작

| 인터랙션 | 동작 | 구현 |
|----------|------|------|
| 클릭 | 엣지 선택 | 구현됨 (React Flow 기본) |
| Delete | 선택된 엣지 삭제 | 구현됨 (`deleteKeyCode={["Delete","Backspace"]}`) |
| 호버 | 엣지 하이라이트 + (실행 후) 전달된 데이터 미리보기 툴팁 | 하이라이트만 구현됨 (`onEdgeMouseEnter` → `setHoveredEdge`). 데이터 미리보기 툴팁은 미구현 (Planned, §5 참조) |
| 엣지 중간에 노드 드롭 | 엣지를 분리하고 중간에 노드 삽입 (source→새노드, 새노드→target) | 미구현 (Planned) |

---

## 5. 엣지 데이터 미리보기 (미구현 · Planned)

> 현재 구현: 엣지 hover 는 하이라이팅용 `hoveredEdgeId` 만 설정한다 (`workflow-canvas.tsx` `onEdgeMouseEnter`). 아래 Data Flow Preview 툴팁·축약 표시·전체 데이터 모달은 아직 없다.

실행 완료 후 엣지에 마우스 오버 시:

```
┌────────────────────────────┐
│  Data Flow Preview          │
│  ─────────────────────────  │
│  {                          │
│    "userId": 123,           │
│    "name": "Gehrig",        │
│    "items": [3 items]       │
│  }                          │
│  ─────────────────────────  │
│  Size: 245 bytes            │
└────────────────────────────┘
```

- 큰 데이터는 축약 표시 (배열 길이, 객체 필드 수)
- 클릭 시 전체 데이터 모달 표시

---

## 6. 컨테이너 내부 엣지 규칙

컨테이너 노드(Loop, ForEach, Map) 내부의 자식 노드 간 엣지에 적용되는 규칙. Background 는 컨테이너 박스를 렌더링하지 않고 `background` 포트 엣지로 본문을 식별하는 평면 모델을 채택했다 ([PRD 3 §4.12 ND-BG-05 대안 구현](../4-nodes/_product-overview.md#412-background)) — 본 절의 컨테이너 규칙은 Background 에 적용되지 않는다.

### 6.1 진입점과 출력 수집

| 규칙 | 설명 |
|------|------|
| 진입점 | 컨테이너의 `body` 포트 → 컨테이너 내부의 첫 번째 자식 노드로 연결 |
| 출력 수집 (`emit` 포트) | Loop/ForEach/Map은 body 자식 중 **정확히 1개**가 컨테이너의 `emit` 입력 포트로 연결되어야 함. 매 반복의 emit source 노드 출력이 수집 대상 |
| 검증 | emit 없음 → `CONTAINER_MISSING_EMIT`, 2개 이상 → `CONTAINER_MULTIPLE_EMIT`. 실행 시 엔진이 upfront 검증 |
| Loop / Map / ForEach | emit source 출력을 배열로 수집 → `done` 포트로 전달. ForEach는 `errorPolicy`에 따라 스킵/계속 항목에 `{_skipped, error}` 삽입 |
| Background | 컨테이너 모델 미적용. `background` 포트로 본문 진입점을 가리키고, 본문 노드들은 평면 그래프에 존재 — 메인 흐름과 같은 캔버스에 배치되며 emit 모델을 쓰지 않는다 ([Spec 실행 엔진 §3.3](../5-system/4-execution-engine.md#33-background-실행)) |

### 6.2 경계 규칙

| 규칙 | 설명 |
|------|------|
| 경계 불가침 | 엣지는 컨테이너 경계를 직접 넘을 수 없음. 반드시 컨테이너의 입출력 포트를 통해서만 데이터 전달 |
| 내부 → 외부 | 금지. 내부 노드에서 외부 노드로 직접 엣지 연결 불가 |
| 외부 → 내부 | 금지. 외부 노드에서 내부 노드로 직접 엣지 연결 불가 |
| 사이클 감지 | 컨테이너 내부 그래프는 글로벌 DAG 사이클 검사에서 제외 (반복 구조이므로) |
| 중첩 컨테이너 | 중첩된 컨테이너의 내부 엣지는 각 컨테이너 레벨에서 독립적으로 검증 |

---

## 7. Tool Area 연결 규칙

| 규칙 | 설명 |
|------|------|
| 엣지 없음 | Tool Area에 등록된 노드는 데이터 흐름 엣지로 연결되지 않음 |
| 공간적 연관 | AI Agent 노드 옆의 Tool Area에 시각적으로만 배치 |
| 실행 방식 | AI Agent의 LLM이 도구 호출 시 on-demand로 실행 (그래프 순회에 참여하지 않음) |
| 연결 표시 | Tool Area와 AI Agent 사이에 점선 테두리로 소속 관계만 표시 (엣지 아님) |

---

## 8. 로드 시 엣지 정합성 검증 (stale 엣지 자동 제거)

에디터가 워크플로우를 로드할 때, 저장된 엣지의 핸들(source/target 포트)이 **현재 노드 config 기준 포트 집합에 더 이상 존재하지 않으면** 해당 엣지를 자동으로 제거한다 (`editor-loader.tsx` → `dropStaleEdges`, `edge-utils.ts`).

| 규칙 | 설명 |
|------|------|
| 발생 조건 | 저장 이후 노드의 dynamic-port 구성이 바뀐 경우 — 예: AI Agent `single_turn` → `multi_turn` 전환으로 `out` 포트 소멸, Information Extractor 모드 전환, Switch/Classifier 케이스 삭제 |
| 제거 판정 | source 노드의 유효 출력 포트 집합(`resolveDynamicPorts` 결과)에 `sourceHandle` 이 없거나, target 노드의 유효 입력 포트 집합에 `targetHandle` 이 없으면 제거. 노드 정의를 찾을 수 없는 노드는 검증을 건너뛴다 (permissive) |
| 사용자 알림 | 1개 이상 제거 시 경고 토스트 표시 (`editor.autoCleanedEdgesFull`, 제거 개수 포함) — 암묵적 삭제가 조용히 지나가지 않도록 한다 |
| 영구 반영 시점 | 제거는 로드 시 store 진입 전에 일어나며, **사용자가 저장(`Ctrl+S`·`Save` / 실행 직전 저장)할 때 서버에 확정**된다. 저장하지 않고 닫으면 DB 의 엣지는 유지 |

> 유사 사례: 캔버스 로드 시 `containerId` 재계산 ([Spec 캔버스 §11](./0-canvas.md#11-컨테이너-노드)).

---

## Rationale

### R-1. 로드 시 stale 엣지 자동 제거 + 경고 토스트 (§8) (2026-06-10)

저장 시점 이후 노드 config 변경으로 포트가 사라진 엣지는 React Flow 가 `Couldn't create edge for source handle id` 경고를 찍고 끊어진 stub 으로 렌더된다. 이를 로드 시점에 `dropStaleEdges` 로 일괄 정리하되, 워크플로우가 **암묵적으로 변형**되는 동작이므로 경고 토스트로 반드시 사용자에게 알리고, 영구 반영은 기존 저장 흐름(사용자 저장 시)에 위임한다. 조용한 자동 수정 대신 "정리 + 고지 + 저장 시 확정" 을 채택한 결정이다.

### R-2. 순환 참조 — 편집기는 경고(warn), 어시스턴트 도구는 차단(block) (§2.3) (2026-07-07)

초기 §2.3 는 "엣지 생성 시 DAG 검증 → 사이클이면 차단" 을 계획했으나 미구현 상태였다. 그 사이 실행 엔진이 **분기 노드(Switch/If-Else 등)의 포트 라우팅을 통한 back-edge 순환**(재시도·폴링 루프)을 정식 지원하게 되면서, "모든 사이클 차단" 은 정당한 워크플로를 막게 되어 더 이상 옳지 않다. 그래서 **편집기(사람이 그리는 캔버스)는 warn-not-block** 으로 확정했다: 사이클 생성 자체는 허용하고, **분기 노드로 탈출할 수 없는 순환**(pass-through 노드에 back-edge)만 `graph:unescapable-cycle` 경고 배지로 드러낸다.

반면 backend `shadow-workflow.ts` (workflow-assistant LLM 도구)는 **여전히 사이클을 hard error 로 차단**한다 — 이는 divergence 가 아니라 **surface 별 요구가 다르기 때문**이다: 사람은 분기 노드로 탈출하는 순환을 의도적으로 그릴 수 있어야 하지만(그래서 경고), LLM 이 자동 생성하는 도구 호출 시퀀스는 결정론적 DAG 로 검증·순서화되어야 안전하다(그래서 차단). 두 판정 모두 **컨테이너 반복 loopback(`targetHandle === 'emit'`)은 예외**로 두어 SoT(`CONTAINER_LOOPBACK_PORTS = {'emit'}`)를 공유한다. 편집기의 분기 노드 탈출 판정은 런타임 `_selectedPort` 의 정적 근사라 advisory 경고에 그치며, 저장을 막지 않는다.
