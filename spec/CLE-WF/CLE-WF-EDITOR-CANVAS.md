---
id: "CLE-WF-EDITOR-CANVAS"
title: "워크플로우 에디터 — 캔버스 조작과 팔레트"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-WF-EDITOR"
ancestors: ["CLE-VISION", "CLE-WF", "CLE-WF-EDITOR"]
area: "CLE-WF"
content_hash: "75ed83dc867353882df9c3ccdea35139b32982538d48ddfcd987b0fe03152090"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "b84d6388e29298e0e860acaa46cd00d8373deceb1215cd87a88317898e55a1d0"
etag: "sha256-faadc60d37894ab1c12dbc7e482964476671386a6a7b82598b6a155a7b97df0b"
---
## 개요

이 문서는 [워크플로우 에디터와 캔버스](CLE-WF-EDITOR.md) 의 하위 문서로 캔버스 인터랙션(뷰포트·선택·노드 조작·컨텍스트 메뉴), 시작 가이드 카드, 노드 팔레트와 노드 검색 팝업, 줌 컨트롤과 Undo/Redo, 미니맵, 에디터 키보드 단축키를 정한다. 노드 자체의 그림은 [노드 시각 표현](CLE-WF-EDITOR-NODE.md), 컨테이너 소속은 [컨테이너 편집](CLE-WF-EDITOR-CONTAINER.md), 저장은 부모 문서의 [저장](CLE-WF-EDITOR.md#저장) 이 정한다.

## 캔버스 인터랙션

### 뷰포트

| 인터랙션 | 동작 |
| --- | --- |
| 빈 영역 마우스 드래그 | 캔버스 패닝 |
| Space + 드래그 | 캔버스 패닝(대안) |
| 마우스 휠 | 줌 인·아웃. 커서 위치를 중심으로 확대한다. |
| Ctrl + 휠 | 줌 인·아웃(대안) |
| 핀치(트랙패드) | 줌 인·아웃 |
| 줌 버튼 | 왼쪽 아래 오버레이의 줌아웃(−)·줌인(+) 버튼, 줌 슬라이더, 현재 퍼센트 |
| Fit 버튼 | 모든 노드가 보이도록 뷰포트를 맞춘다. |
| 줌 범위 | 최소 25%, 최대 200% |
| 빈 영역 더블클릭 | 노드 검색 팝업을 연다. |

### 선택

| 인터랙션 | 동작 |
| --- | --- |
| 노드 클릭 | 그 노드를 선택하고 이전 선택을 푼다. |
| Shift + 클릭 | 기존 선택에 노드를 넣거나 뺀다. |
| Shift + 빈 영역 드래그 | 선택 영역(Lasso)을 그려 안의 노드를 모두 선택한다. |
| Ctrl + A | 노드를 모두 선택한다. 빈 영역 우클릭 메뉴의 "전체 선택" 과 같다. |
| Escape | 노드 선택을 푼다. 실행 결과 드로어에 포커스가 있으면 캔버스로 포커스를 돌리는 동작이 먼저다([에디터 실행과 디버깅](../CLE-EXEC/CLE-EXEC-RUN.md)). 편집 필드에서는 가로채지 않는다. 전역 `handleKeyDown` 이 드로어 분기를 먼저 처리하고 끝낸다. |
| 빈 영역 클릭 | 선택을 풀고 설정 패널을 닫는다. |

빈 영역 드래그는 패닝이고 Shift + 빈 영역 드래그는 영역 선택이다. 현재 구현도 React Flow 기본값(`panOnDrag`, Shift 영역 선택)을 쓴다.

### 노드 조작

| 인터랙션 | 동작 |
| --- | --- |
| 팔레트에서 드래그 | 놓은 위치에 새 노드를 추가한다. |
| 노드 드래그 | 노드를 옮긴다. 그리드 스냅 적용 여부는 [미결 사항](CLE-WF-EDITOR.md#미결-사항) 참조 |
| 여러 노드 선택 뒤 드래그 | 선택한 노드를 모두 함께 옮긴다. |
| Ctrl + C | 선택한 노드와, 양 끝이 모두 선택된 연결선을 복사한다. 복사한 내용은 앱 내부 클립보드(`editorClipboard`)에 담는다. OS 클립보드가 아니다. |
| Ctrl + V | 복사한 노드를 붙여 넣는다. 원본 대비 (+40, +40) 위치에 놓고, 레이블은 겹치지 않게 바꾸고, 연결선은 새 id 로 다시 잇는다. 우클릭 메뉴의 "붙여넣기" 는 누른 위치에 놓는다. |
| Ctrl + D | 선택한 노드를 바로 복제한다. 클립보드는 바꾸지 않는다. 우클릭 메뉴 "복제" 와 효과가 같다. |
| Delete / Backspace | 선택한 노드를 지운다. 연결된 연결선도 함께 지운다. |
| 노드 더블클릭 또는 클릭 | 설정 패널을 연다. |
| 우클릭 | 노드 컨텍스트 메뉴를 연다. |
| 컨테이너 소속 | 연결선으로 정한다. `body`·`emit`·체인 연결선이 소속을 자동으로 정하고 푼다. 노드를 컨테이너 안으로 끌어 넣는 UX 는 없다. 규칙은 [소속 자동 동기화](CLE-WF-EDITOR-CONTAINER.md#소속-자동-동기화) 참조 |

**붙여넣기·복제의 통합 참조 거르기**. 노드를 추가하거나 붙여넣거나 복제하면 클라이언트가 새 UUID 를 노드 id 로 발급한다. 그래서 그 노드의 통합 참조는 저장할 때 새로 넣은 참조로 검사받는다([데이터 모델 개요 §참조의 소속](../CLE-PLAT/CLE-PLAT-DATA.md#참조의-소속) 의 「통합 참조」). 에디터는 붙여 넣는 시점에 같은 조건으로 참조를 거른다. Ctrl+V · Ctrl+D 와 우클릭 메뉴의 붙여넣기 · 복제가 모두 거른다.

- 워크스페이스에 있는 조직 통합은 남긴다. 개인 통합은 [개인 통합 사용 판정](../CLE-INT/CLE-INT-MANAGE.md#개인-통합-사용-판정)의 저장 경로 조건대로 지금 사용자가 그 통합의 소유자이면서 워크플로우 작성자일 때만 남긴다.
- 참조 값이 표현식이면 거르지 않는다. 고르지 않은 자리가 아닌데 문자열도 아닌 값은 저장 검사처럼 없는 통합과 같이 보고 비운다. 어떤 값이 참조인지는 같은 절의 「통합 참조」 가 정한다.
- 그 밖의 참조는 비우고 비운 노드의 레이블을 경고 토스트로 알린다. 비운 필드에는 필드 미선택 경고가 붙는다([통합 노드 공통 §삭제된 통합 표시](../CLE-NODE-INT/CLE-NODE-INT-COMMON.md#삭제된-통합-표시)).
- 거르는 일은 서버에 묻지 않고 에디터가 가진 워크플로우 작성자(`createdBy`)와 통합 목록으로 한다. 이 필터는 사용자 편의이고 권위는 저장 검사다.
- 통합 목록, 지금 사용자, 워크플로우 작성자 가운데 하나라도 확정되지 않았으면 비우지 않는다. 통합 목록은 불러오는 중이거나 페이지네이션 한도로 전체를 받지 못했으면 확정되지 않은 것이다. 그동안은 값 모양과 상관없이 비우지 않는다. 문자열이 아닌 값도 남고 저장 검사가 그 값을 거절한다.
- 남은 참조가 쓸 수 없는 통합이면 저장 검사가 400 으로 막는다.

### 노드 컨텍스트 메뉴

노드를 우클릭하면 나온다.

| 항목 | 단축키 | 설명 |
| --- | --- | --- |
| 설정 열기 | Enter | 설정 패널을 연다. |
| 이 노드 실행 | 없음 | 이 노드만 실행한다(단일 노드 실행). 동작은 [에디터 실행과 디버깅](../CLE-EXEC/CLE-EXEC-RUN.md) 이 정한다. |
| 복제 | Ctrl+D | 노드를 복제한다. |
| 비활성화·활성화 | 없음 | 노드 비활성화(`isDisabled`)를 켜고 끈다. |
| 삭제 | Delete | 노드를 지운다. |

선택 노드부터 실행은 이 메뉴에 없고 헤더 Run 드롭다운에만 있다([에디터 실행과 디버깅](../CLE-EXEC/CLE-EXEC-RUN.md)).

### 캔버스 컨텍스트 메뉴

빈 영역을 우클릭하면 나온다.

| 항목 | 설명 |
| --- | --- |
| 노드 추가 | 노드 검색 팝업을 연다. 고른 노드는 누른 위치에 놓는다. |
| 붙여넣기 | 클립보드의 노드를 누른 위치에 붙여 넣는다. `editorClipboard` 가 비어 있으면 비활성이다. |
| 전체 선택 | 노드를 모두 선택한다. |
| 맞춤 보기 | Fit to View |

### 시작 가이드 카드

새 워크플로우에는 백엔드가 기본 트리거 노드를 하나 자동으로 넣으므로 캔버스가 완전히 빈 경우는 거의 없다. 그래서 트리거 카테고리 노드 말고 다른 노드가 없는 상태를 "빈 워크플로우" 로 본다. 이때 캔버스 오른쪽 위에 시작 가이드 카드(`CanvasEmptyState`)를 띄워 트리거 다음 단계를 알려 준다.

| 요소 | 내용 |
| --- | --- |
| 제목 | "워크플로우를 이어서 완성해봐요" |
| 소제목 | "트리거 다음에 이어 붙일 노드를 추가하면 워크플로우가 완성돼요." |
| 체크리스트 | 3단계: (1) 팔레트에서 다음 노드를 드래그 (2) 트리거 출력 포트에 연결 (3) 실행해서 결과 확인. 항목마다 오른쪽에 "자세히" 링크가 있고 관련 사용자 가이드 절로 이동한다. |
| 버튼 | "시작 가이드 열기" 는 `/docs/01-getting-started/first-workflow` 를 새 탭으로 연다. 노드는 팔레트에서 끌어 놓아 추가하므로 카드 안에 추가 버튼을 두지 않는다. |
| 표시 조건 | 노드가 하나도 없거나 트리거 카테고리 노드만 있을 때 표시한다. 트리거가 아닌 첫 노드가 추가되면 300ms 동안 흐려지며 사라진다. |
| 위치·크기 | `top-right` Panel, 너비 340px. 트리거 노드와 겹치지 않도록 오른쪽에 고정한다. |
| 접근성 | `role="region"` 과 `aria-label="시작하기"`. 숨긴 상태에서는 `aria-hidden="true"` 와 `tabIndex={-1}` 로 포커스에서 뺀다. |
| 링크 동작 | 사용자 가이드 링크는 새 탭으로 열어 작업 맥락을 지킨다. |

사용자 가이드의 구조는 [사용자 가이드](../CLE-UI/CLE-UI-GUIDE.md) 가 정한다.

## 노드 팔레트

### 구성

노드 팔레트는 에디터 왼쪽의 노드 목록이다. 위에서부터 검색창, Recent 섹션, 카테고리 섹션이 있다.

| 섹션 | 들어가는 노드(예시) |
| --- | --- |
| 검색 | 노드 이름 검색창 |
| ⏱ Recent | 최근 사용한 노드 유형 |
| Trigger | Manual Trigger |
| Logic | If/Else, Switch, Loop, Variable Declaration, Variable Modification, Split, Map, Filter, ForEach, Parallel, Merge, Background |
| Flow | Workflow |
| AI | AI Agent, Text Classifier, Information Extractor |
| Integration | HTTP Request, Database Query, Send Email, Cafe24, MakeShop |
| Data | Transform, Code |
| Presentation | Carousel, Table, Chart, Form, Template |
| ▼ Installed | 마켓플레이스에서 설치한 노드(미구현) |

카테고리는 일곱 가지다. 전체 노드 목록·카테고리·카테고리 색은 [노드 시스템 구조와 카탈로그](../CLE-NODE/CLE-NODE-ARCH.md) 가 정한다. 원문 PRD 는 카테고리를 다섯 개(Logic·Flow·AI·Integration·Data)로 적었지만 노드 카탈로그 기준으로 Trigger·Presentation 을 더한다.

**Recent 섹션(구현, ED-PL-04)**: 최근 사용한 노드 유형을 팔레트 위쪽에 표시한다(`node-palette.tsx`). 세션 한정(저장하지 않음), 최대 5개, 최신순, 중복 제거이고 `manual_trigger` 는 뺀다. 검색 중에는 숨긴다. 최근 사용은 `editor-store.addNode` 가 `recent-nodes-store` 에 기록한다. 끌어 놓기·팔레트 클릭·노드 검색 팝업·우클릭 복제·AI 어시스턴트가 모두 이 경로를 지난다. `addNode` 를 거치지 않는 일괄 경로(Ctrl+V 붙여넣기, Ctrl+D 복제)는 `recordRecentNodeTypesFrom` 으로 따로 기록한다.

**Installed 섹션(미구현)**: 마켓플레이스 섹션은 아직 그리지 않는다. 마켓플레이스 모듈을 도입할 때 함께 만든다([Rationale](#rationale) R-1).

### 동작

| 동작 | 설명 |
| --- | --- |
| 검색 | 노드 이름으로 바로 거른다. |
| 카테고리 접기·펼치기 | 섹션 헤더를 누른다. |
| 드래그 | 캔버스로 끌어 노드를 추가한다. |
| 클릭 | 현재 뷰포트 가운데에 노드를 추가한다. 여러 번 누르면 겹치지 않도록 조금씩 비껴 놓는다. 항목에 포커스를 두고 Enter·Space 를 눌러도 같다. 캔버스와는 `palette-canvas-bridge` 로 통한다([Rationale](#rationale) R-2). |
| 패널 접기 | 검색 헤더의 토글 버튼으로 팔레트를 아이콘 레일(펼치기 버튼만 있는 좁은 막대)로 접고 펼친다(ED-PL-03). |

### 노드 검색 팝업

캔버스 빈 영역을 더블클릭하면 노드 검색 팝업(node search popup)이 뜬다. 포트에서 끌어 빈 영역에 놓을 때와 빈 영역 우클릭 메뉴의 "노드 추가" 도 같은 팝업을 쓴다. 입력창 "Add node..." 아래에 "If/Else (Logic)" 처럼 노드 이름과 카테고리가 목록으로 나온다.

- 입력하는 즉시 거른다.
- 항목을 누르면 고른 노드를 더블클릭한 위치에 놓는다.
- 키보드: ↑·↓ 로 강조를 옮기고 끝에서는 반대쪽으로 돌아간다. Enter 로 강조한 항목을 고르고 Escape 로 팝업을 닫는다.
- Escape 우선순위: 팝업이 열려 있으면 팝업 닫기가 먼저다. 팝업 입력의 keydown 이 `stopPropagation` 으로 전역 keydown(선택 해제, 드로어 포커스 복귀)보다 먼저 처리한다.

## 줌 컨트롤과 Undo/Redo

줌 컨트롤(줌아웃 −, 줌 슬라이더, 줌인 +, 현재 퍼센트, Fit)은 캔버스 왼쪽 아래 오버레이(`ZoomControls`, `zoom-controls.tsx`)에 있다. Undo·Redo 는 헤더 툴바(`editor-toolbar.tsx`)에 있다.

| 요소 | 설명 | 상태 |
| --- | --- | --- |
| 줌아웃·줌인 버튼(−/+) | 왼쪽 아래 오버레이 | 구현됨 |
| Fit 버튼 | 전체 맞춤 보기 | 구현됨 |
| 줌 슬라이더 | 25%~200% | 구현됨 |
| 줌 퍼센트 | 현재 줌 표시 | 구현됨 |
| Undo(Ctrl+Z) | 실행 취소. 헤더 툴바에 있다. | 구현됨 |
| Redo(Ctrl+Y) | 다시 실행. 헤더 툴바에 있다. | 구현됨 |
| Undo·Redo 를 왼쪽 아래 오버레이로 합치기 | `[−] 슬라이더 [+] 100% │ [Fit] │ [↩ Undo] [↪ Redo]` 배치 | 미구현(계획) |

## 미니맵

@xyflow `MiniMap` 을 캔버스 오른쪽 아래에 작은 오버레이로 그린다(`canvas-minimap.tsx`, `pannable`·`zoomable`, 구현됨).

- 워크플로우 전체를 내려다보는 조감도이고 현재 뷰포트 영역을 사각형으로 표시한다.
- 미니맵을 누르거나 끌면 뷰포트가 이동한다.
- 토글 버튼으로 켜고 끈다.

## 키보드 단축키

에디터 전역 단축키의 전체 목록은 이 표가 기준이다. 전역 keydown 핸들러(`workflow-editor.tsx`)가 저장·Undo/Redo·AI 어시스턴트 패널 토글·드로어 토글(Ctrl+Shift+R)과 Ctrl+C·V·D·A, Escape 를 처리한다. 키 조합과 동작의 대응은 순수 함수 `resolveEditorShortcut` 이 정한다. 줌(Ctrl++·−·0·1)과 Space 패닝은 ReactFlow 인스턴스가 필요해 캔버스 컴포넌트(`workflow-canvas.tsx`)가 처리한다. 줌은 로컬 keydown 으로, 패닝은 `panActivationKeyCode="Space"` 로 처리한다. Delete·Backspace 는 ReactFlow `deleteKeyCode` 와 `onBeforeDelete`(컨테이너 삭제 확인)가 처리한다. Ctrl+C·V·D·A, Escape, 줌 단축키는 입력 필드에 포커스가 있으면 가로채지 않는다(`isEditableTarget` 가드). Ctrl+S·Z·Y, Ctrl+/, Ctrl+Shift+R 는 입력 필드에서도 동작한다.

| 단축키 | 동작 | 상태 |
| --- | --- | --- |
| Ctrl + S | 저장 | 구현됨 |
| Ctrl + Z | Undo | 구현됨 |
| Ctrl + Y / Ctrl + Shift + Z | Redo | 구현됨 |
| Ctrl + / | AI 어시스턴트 패널 토글([워크플로우 AI 어시스턴트](CLE-WF-ASSIST.md)). 원문 조건은 "다른 단축키와 충돌하지 않을 때만" 이다(ED-AI-03). 현재 구현(`resolveEditorShortcut`)은 조건 없이 늘 토글한다. | 구현됨 |
| Delete / Backspace | 선택 항목 삭제 | 구현됨(ReactFlow `deleteKeyCode`) |
| Ctrl + C | 선택 노드(와 내부 연결선) 복사(앱 내부 클립보드) | 구현됨 |
| Ctrl + V | 붙여넣기(원본 대비 +40 위치, 겹치지 않는 레이블) | 구현됨 |
| Ctrl + D | 선택 노드 바로 복제 | 구현됨 |
| Ctrl + A | 전체 선택 | 구현됨 |
| Escape | 실행 결과 드로어에 포커스가 있으면 캔버스로 포커스를 돌린다. 그 밖에는 노드 선택을 푼다. | 구현됨 |
| Space + 드래그 | 캔버스 패닝(대안) | 구현됨(ReactFlow `panActivationKeyCode`) |
| Ctrl + + / − | 줌 인·아웃 | 구현됨 |
| Ctrl + 0 | 줌 100% | 구현됨 |
| Ctrl + 1 | Fit to View | 구현됨 |
| Ctrl + Shift + R | 실행 결과 드로어 펼침·접힘 토글([에디터 실행과 디버깅](../CLE-EXEC/CLE-EXEC-RUN.md)) | 구현됨 |

전체 실행 단축키(Ctrl+Enter)는 이 표에 없다. 만들지 여부는 [에디터 실행과 디버깅의 미결 사항](../CLE-EXEC/CLE-EXEC-RUN.md#미결-사항) 에서 정하고 이 표는 그 결정을 따른다.

## 구현 위치

- `codebase/frontend/src/components/editor/canvas/**` (캔버스 컴포넌트 `workflow-canvas.tsx`, `custom-node.tsx`, `canvas-minimap.tsx`, `zoom-controls.tsx` 등과 아래 보조 모듈)
- `codebase/frontend/src/components/editor/canvas/quick-add-nav.ts` (노드 검색 팝업 키보드 이동)
- `codebase/frontend/src/components/editor/canvas/integration-list-context.ts` (캔버스 통합 목록 조회와 Context. 배지와 붙여넣기 필터 문맥이 같은 조회를 쓴다)
- `codebase/frontend/src/components/editor/canvas/duplicate-node.ts` (`buildDuplicatedNode`. 노드 컨텍스트 메뉴 복제가 통합 참조를 거른다. 필터 문맥은 필수 인자다)
- `codebase/frontend/src/components/editor/palette/node-palette.tsx`
- `codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx` (Undo·Redo)
- `codebase/frontend/src/components/editor/workflow-editor.tsx` (전역 단축키)
- `codebase/frontend/src/lib/stores/editor-store.ts` (Ctrl+V 붙여넣기 · Ctrl+D 복제의 통합 참조 거르기)
- `codebase/frontend/src/lib/stores/recent-nodes-store.ts`
- `codebase/frontend/src/lib/stores/palette-canvas-bridge.ts`
- `codebase/frontend/src/lib/integrations/node-integration-refs.ts` (붙여넣기 · 복제의 통합 참조 거르기와 판정 `canUseIntegrationInWorkflow`. 참조 자리 목록은 `codebase/backend/src/modules/integrations/node-integration-refs.ts` 와 같고 `codebase/backend/src/modules/integrations/node-integration-refs.spec.ts` 가 두 목록을 대조한다)
- `codebase/frontend/src/lib/integrations/use-integration-pick-blocked.ts` (`useIntegrationPickBlocked()`. 통합 선택기가 같은 판정 `canUseIntegrationInWorkflow` 를 쓴다)
- `codebase/frontend/src/app/(editor)/w/[slug]/workflows/[id]/editor-loader.tsx` (워크플로우를 불러와 작성자를 에디터 상태에 싣는다)

## Rationale

### R-1. 팔레트 Recent 는 구현하고 Installed 는 미룬다 (2026-07-07)

팔레트의 새 섹션 두 개 가운데 Recent 만 구현하고 Installed(마켓플레이스)는 미룬다. Recent 는 기존 노드 정의(카테고리 목록)만으로 만들 수 있는 순수 프론트엔드 기능이라 먼저 필요한 것이 없다. Installed 는 마켓플레이스에서 설치한 노드 목록을 전제한다. 그런데 마켓플레이스와 플러그인 SDK 자체가 아직 백로그라 보여 줄 데이터 출처가 없다([마켓플레이스 (구상)](../CLE-UI/CLE-UI-MARKET.md)). 데이터 없는 빈 섹션을 미리 그리지 않고 마켓플레이스 모듈을 도입할 때 함께 만든다.

Recent 는 세션 한정(저장하지 않음)으로 둔다. 저장하면 상관없는 다른 워크플로우나 세션에서 쓰던 유형이 새 에디터에 처음 들어갈 때 섞여 나오고, 범위(워크스페이스 단위인지 워크플로우 단위인지)를 정하는 결정이 하나 더 생긴다. 최근 사용 기록은 모든 노드 추가 경로가 지나는 `editor-store.addNode` 한 곳에 두었다. 그래서 끌어 놓기·팔레트 클릭·노드 검색 팝업·복제·AI 어시스턴트가 똑같이 반영된다. 복제와 붙여넣기도 "그 유형을 최근에 썼다" 는 뜻이라 함께 센다.

### R-2. 팔레트에서 캔버스로 노드를 추가할 때는 브리지를 거친다 (2026-07-07)

팔레트 클릭으로 노드를 추가하려면 뷰포트 가운데 좌표(ReactFlow 인스턴스), locale, 기본 모델 설정이 필요하다. 이 셋은 모두 `WorkflowCanvas` 에만 있다. 이 로직을 순수 상태인 `editor-store` 로 옮기면 React Query·ReactFlow 인스턴스·i18n 의존이 store 로 새어 들어가 계층이 무너진다. 그래서 캔버스가 노드 추가 핸들러를 `palette-canvas-bridge`(모듈 레지스트리)에 등록하고 팔레트가 그것을 부른다. 두 쪽이 서로 import 하지 않아 순환을 피한다. `assistant-editor-bridge` 와 같은 방식이다.

### R-5. 붙여넣기와 복제는 쓸 수 없는 통합 참조를 비운다 (2026-10-24)

개인 통합은 통합 소유자가 작성한 워크플로우에서만 쓰고 저장할 때 새로 넣은 참조를 검사하기로 정했다(NERV Task `CLE-T-MG0EQZ`, [통합 관리](../CLE-INT/CLE-INT-MANAGE.md) Rationale). 붙여넣기와 복제는 노드 id 를 새로 발급하므로 그 안의 참조는 모두 새 참조다. 그대로 두면 워크플로우 작성자가 아닌 사용자가 워크플로우 작성자의 노드를 복제한 순간 저장이 400 으로 막히고 어느 노드 때문인지는 저장을 누른 뒤에야 안다. 그래서 붙여 넣을 때 미리 비우고 알린다. 선택기와 어시스턴트 후보를 좁힌 결정([통합 관리](../CLE-INT/CLE-INT-MANAGE.md) Rationale 의 «고르는 화면은 저장 검사를 통과할 통합만 고르게 한다»)과 같은 이유다.

비우는 조건은 저장 검사와 같게 둔다. 에디터가 저장 검사보다 많이 비우면 쓸 수 있는 참조를 잃는다. 적게 비우면 남긴 참조 때문에 저장이 막힌다. 통합 목록, 지금 사용자, 워크플로우 작성자 가운데 하나라도 확정되지 않았을 때 비우지 않는 것도 참조를 잃지 않으려는 것이다. 모르는 참조를 비우면 쓸 수 있는 참조까지 잃을 수 있다. 남긴 참조 때문에 저장이 막히면 사용자가 다시 고르면 된다.

2026-10-25 에 더한 세 규칙의 근거는 아래와 같다.

- **문자열이 아닌 값도 비운다**: 고르지 않은 자리가 아닌데 문자열도 아닌 값은 어느 통합도 가리키지 못한다. 저장 검사는 그 값을 없는 통합과 같이 거절하므로 남겨 두면 저장이 막힌다. 그래서 저장 검사와 같은 조건으로 비운다. 어떤 값이 참조인지는 [데이터 모델 개요 §참조의 소속](../CLE-PLAT/CLE-PLAT-DATA.md#참조의-소속) 의 「통합 참조」 가 정한다. 문맥이 확정되지 않은 동안에는 거르기 전체를 건너뛰므로 이 값도 남고 저장 검사(400)가 거절한다. 문맥이 확정되기 전의 짧은 동안에만 생기는 일이라서 값 종류로 나누지 않았다. 문맥을 모를 때는 거르지 않는다는 규칙 하나만 두려는 것이다.
- **지금 사용자나 워크플로우 작성자를 모르면 비우지 않는다**: 개인 통합 판정에는 두 사람이 모두 필요하다. 한쪽을 모르는 채로 판정하면 쓸 수 있는 개인 통합 참조까지 비울 수 있다. 통합 목록이 확정되지 않았을 때와 같은 이유로 비우지 않고 저장 검사에 맡긴다.
- **Ctrl+V · Ctrl+D 와 우클릭 메뉴가 모두 거른다**: 세 경로 모두 노드 id 를 새로 발급하므로 같은 저장 검사를 받는다. 한 경로라도 거르지 않으면 그 경로로 만든 노드만 저장에서 막힌다. 우클릭 메뉴 복제(`buildDuplicatedNode`)는 필터 문맥을 필수 인자로 받아 이 경로만 거르기를 빠뜨리는 일을 컴파일 단계에서 막는다.

기각한 대안은 셋이다.

- **서버에 판정을 묻는 안**: 붙여넣기마다 요청이 생기고 응답을 기다리는 동안 붙여넣기가 늦어진다. 판정에 필요한 워크플로우 작성자와 통합 목록은 에디터에 이미 있다. 판정 규칙은 [통합 관리 「개인 통합 사용 판정」](../CLE-INT/CLE-INT-MANAGE.md#개인-통합-사용-판정) 과 같게 두고 권위는 저장 검사에 둔다.
- **붙여넣기를 거절하는 안**: 통합 참조 하나 때문에 노드 전체를 붙여 넣지 못한다. 사용자는 나머지 설정까지 다시 만들어야 한다. 비우면 그 노드에서 통합만 다시 고르면 된다.
- **저장 400 에 맡기는 안**: 위 첫 문단과 같다. 사용자는 저장을 누른 뒤에야 막힌 것을 알고 어느 노드 때문인지 찾아야 한다.
