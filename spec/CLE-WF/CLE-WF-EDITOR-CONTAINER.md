---
id: "CLE-WF-EDITOR-CONTAINER"
title: "워크플로우 에디터 — 컨테이너 편집"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-WF-EDITOR"
ancestors: ["CLE-VISION", "CLE-WF", "CLE-WF-EDITOR"]
area: "CLE-WF"
content_hash: "cda53009d71ec3bea9ec0bcff8f8a0d55773fa6135862d822cee881db5b4412c"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "2d93ec5c9ab2356fd35a0ba07c04305c11a9d74dcebffea7edb3a2a0053a16b4"
etag: "sha256-2fb08e288ad887b4662e5098ffa1a663054a712baa602737ff31339dfc1b3e82"
---
## 개요

이 문서는 [워크플로우 에디터와 캔버스](CLE-WF-EDITOR.md) 의 하위 문서로 컨테이너(container, `containerId`)의 캔버스 편집 UX 를 정한다. 시각 표현, 소속 자동 동기화, 제약, 컨테이너 삭제, 중첩, 제거된 도구 영역을 다룬다. 컨테이너 본문의 실행 방식은 [컨테이너 실행](../CLE-EXEC/CLE-EXEC-CONTAINER.md) 이 정한다.

## 컨테이너

컨테이너는 자식 노드를 반복 실행하는 [Loop 노드](../CLE-NODE-LOGIC/CLE-NODE-LOOP.md), [ForEach 노드](../CLE-NODE-LOGIC/CLE-NODE-FOREACH.md), [Map 노드](../CLE-NODE-LOGIC/CLE-NODE-MAP.md) 세 노드다. 세 노드는 body·emit·done 포트 모델과 emit 기반 결과 수집을 함께 쓴다. `body` 는 컨테이너 본문 진입, `emit` 은 반복 결과를 모으는 입력, `done` 은 모은 배열 출력이다.

[Background 노드](../CLE-NODE-LOGIC/CLE-NODE-BACKGROUND.md)는 컨테이너가 아니다. 노드 요구사항 ND-BG-05 의 대안 구현 결정에 따라 컨테이너 박스를 쓰지 않고 출력 포트가 여러 개인 일반 노드로 평면에 그린다. 본문은 `background` 포트 연결선으로 분기가 드러나고 메인 흐름과 같은 캔버스 그래프 안에 놓인다. [Parallel 노드](../CLE-NODE-LOGIC/CLE-NODE-PARALLEL.md)도 `containerId` 소속을 쓰지 않으므로 이 문서의 컨테이너가 아니다.

## 시각 표현

컨테이너는 자식을 감싸는 영역을 그리지 않는다(시각 containment 미사용). 컨테이너는 일반 노드와 같은 크기로 그린다. 자식 노드는 캔버스 어디에나 자유롭게 놓을 수 있고 소속은 데이터 모델의 `containerId` 로만 나타낸다. 자식 노드 헤더 아래에 `in <컨테이너 레이블>` 배지를 달아 어느 컨테이너 소속인지 바로 알 수 있게 한다.

| 요소 | 설명 |
| --- | --- |
| 헤더 바 | 노드 아이콘, 유형명, 사용자 레이블. 카테고리 색 배경 |
| 요약 | 헤더 바의 사용자 레이블 오른쪽에 설정 요약을 표시한다. 예: `🔄 Loop "Process Items"  10x · break`. Background 는 컨테이너 박스가 없으므로 일반 노드 본체의 요약 영역을 쓴다. |
| 입출력 포트 | 왼쪽(입력)과 오른쪽(출력). 일반 노드와 같다. 입력이 `Input`·`Emit` 두 개라 핸들 옆에 라벨을 붙인다. |
| 헤더 드래그 | 컨테이너 노드만 옮긴다. 자식과는 시각적으로 떨어져 있다. |
| 헤더 더블클릭 | 컨테이너 설정 패널을 연다. |
| 실행 중 진행 인덱스 | 이 문서는 정하지 않는다. [Logic 노드 공통](../CLE-NODE-LOGIC/CLE-NODE-LOGIC-COMMON.md) 과 [Loop 노드](../CLE-NODE-LOGIC/CLE-NODE-LOOP.md) 는 실행 중 헤더에 "Iteration 3/10", "Item 2/5" 같은 진행 인덱스를 표시한다고 적는다. 현재 캔버스 구현에는 이 표시가 없다. 캔버스에 정의할지는 [Logic 노드 공통의 미결 사항](../CLE-NODE-LOGIC/CLE-NODE-LOGIC-COMMON.md#미결-사항) 에서 정한다. |

## 소속 자동 동기화

`containerId` 는 현재 연결선만으로 정해지는 순수 함수 값이다. 변경이 있을 때마다 자동으로 다시 계산한다. 설정 패널에는 소속을 직접 고르는 UI 가 없고 모든 소속은 연결선으로 나타낸다.

**전파 규칙**. `onConnect` 때와 워크플로우를 불러올 때 값이 더 바뀌지 않을 때까지 반복한다.

1. **Body 포트(강제)**: `컨테이너.body → X` 연결선을 만들면 X 의 `containerId` 를 그 컨테이너로 **강제로 정한다**. X 가 이미 **다른** 컨테이너에 속해 있으면 연결선을 만들지 않고 토스트로 경고한다. 예: `Cannot connect: "Code" is already a body child of "Loop". Detach it from "Loop" first.`
2. **Emit 포트(강제)**: `Y → 컨테이너.emit` 연결선도 같은 규칙이다. Y 가 다른 컨테이너 소속이면 거부하고 경고한다.
3. **체인 전파**: 컨테이너 자식 A 에서 `A → B` 연결선을 만들 때 B 의 `containerId` 가 비어 있으면 같은 컨테이너로 전파한다. 양 끝이 서로 다른 컨테이너 소속이면 충돌을 피하려고 아무것도 바꾸지 않는다. 이렇게 경계를 넘는 연결선을 허용할지는 정의가 갈린다. [연결선의 미결 사항](CLE-WF-EDGE.md#미결-사항) 과 [실행 엔진 개요와 그래프 순회의 미결 사항](../CLE-EXEC/CLE-EXEC-ENGINE.md#미결-사항) 에서 다룬다.

체인 전파는 Background 의 `background` 포트 연결선에도 적용된다. 그래서 컨테이너 본문 안 Background 의 본문 노드도 그 컨테이너의 `containerId` 를 받는다. 이 값은 위치 속성일 뿐이고 Background 본문의 범위는 `background` 포트 연결선으로 정한다. 워커는 그 컨테이너 단계 그래프로 본문을 실행한다([컨테이너 실행 §컨테이너 본문 안 Background](../CLE-EXEC/CLE-EXEC-CONTAINER.md#컨테이너-본문-안-background)).

**지울 때 자동 해제**

- `컨테이너.body → X` 연결선을 지우면 X 의 `containerId` 가 자동으로 `null` 이 된다. 단 `X → 컨테이너.emit` 연결선이 남아 있거나 X 가 체인 중간이면 그 규칙에 따라 소속을 유지한다.
- 컨테이너 노드 삭제, 자식 노드 삭제, 체인 중간 연결선 삭제 모두 **전체를 다시 계산**하므로 가리킬 곳이 없는 `containerId` 가 남지 않는다.

**불러올 때 자동 복구**: 저장된 데이터에 연결선 없이 `containerId` 만 남아 있어도 불러올 때 다시 계산해 정합성을 맞춘다. 실제로 값이 바뀌면 `isDirty=true` 로 표시해 사용자가 저장으로 고정할 수 있게 한다. 불러올 때 지금 설정에 없는 포트의 연결선을 지우는 연결선 자동 정리는 [연결선](CLE-WF-EDGE.md) 에 있다.

## 제약

| 제약 | 동작 |
| --- | --- |
| 같은 워크플로우의 노드만 | `containerId`·`toolOwnerId` 와 연결선 끝점은 이 워크플로우의 노드만 가리킨다. 캔버스 저장은 이번 페이로드에 없는 노드를 가리키면 400 `VALIDATION_ERROR` 다(`details[].field` 예: `nodes[2].containerId`, [데이터 모델 개요 §참조의 소속](../CLE-PLAT/CLE-PLAT-DATA.md#참조의-소속)). 위 연결선 기반 재계산은 늘 페이로드 안의 노드를 가리키므로 정상 편집에서는 걸리지 않는다. |
| 트리거 노드 자식 금지 | 트리거 카테고리 노드는 컨테이너 자식이 될 수 없다. 연결선 자동 전파가 거부한다. 실행 때도 백엔드가 거부하고 에러 메시지가 `CONTAINER_INVALID_CHILD: ` 로 시작한다. |
| 자기 자신 자식 금지 | 컨테이너는 자기 자신을 `containerId` 로 가질 수 없다. |
| 자손 컨테이너 자식 금지 | A 의 자손 컨테이너 B 를 다시 A 의 부모로 지정하면 순환이다. 실행 때 거부하고 에러 메시지가 `CONTAINER_CYCLE: ` 로 시작한다. |
| emit 필수 | 컨테이너를 실행할 때 `emit` 포트에 자식 노드가 정확히 하나 연결돼 있어야 한다. 어기면 에러 메시지가 `CONTAINER_MISSING_EMIT: ` 나 `CONTAINER_MULTIPLE_EMIT: ` 로 시작한다. emit 연결선은 있지만 출발 노드가 자식이 아니면 에러 메시지에 그 노드 이름과 해결 방법을 넣는다. |
| 본문 안 제약 | 되돌아가는 연결선(순환)과 블로킹 노드(form·buttons·ai_conversation)는 컨테이너 본문 안에서 쓸 수 없다. |

이 제약 가운데 `CONTAINER_*` 검사는 저장 때가 아니라 실행 엔진과 AI 어시스턴트의 Shadow 검증이 한다([워크플로우 데이터와 저장 흐름](CLE-WF-DATA.md)). 저장 때 보는 것은 첫 행의 참조 소속뿐이다.

## 컨테이너 삭제

자식 노드가 있는 컨테이너를 지우려 하면 확인 다이얼로그가 뜬다. 삭제 경로 세 가지가 모두 이 다이얼로그를 거친다. ✕ 버튼과 우클릭 메뉴는 `editor-store.ts` 의 `requestNodeDelete` 로, Delete·Backspace 키는 ReactFlow `onBeforeDelete` 가 컨테이너를 알아채 기본 삭제를 취소하고 다이얼로그를 연다(`workflow-canvas.tsx`). 자식이 없는 컨테이너와 일반 노드는 다이얼로그 없이 바로 지운다. 컨테이너의 삭제 버튼(✕)은 헤더 바 오른쪽 위 바깥에 있다.

| 다이얼로그 요소 | 내용 |
| --- | --- |
| 제목 | "Delete Container" |
| 본문 | `"Process Items" (Loop) contains 3 child nodes.` 처럼 컨테이너 이름·유형과 자식 수 |
| 선택지 | "Delete container and all children"(모두 삭제), "Ungroup: keep children, remove container only"(그룹 해제, 기본 선택) |
| 버튼 | Cancel, Delete |

| 선택지 | 동작 |
| --- | --- |
| 모두 삭제(Delete container and all children) | 컨테이너 노드, `containerId` 가 그 컨테이너를 가리키는 자식 노드 전부, 관련 연결선을 함께 지운다. `confirmContainerDelete("deleteAll")` |
| 그룹 해제(Ungroup, 기본) | 컨테이너 노드만 지운다(기존 `removeNode`). 자식 노드는 소속 재계산으로 최상위로 올라간다(`containerId = null`). 자식 노드 사이 연결선은 남긴다. 컨테이너의 `body` 포트에서 자식으로 가는 연결선만 지운다. `confirmContainerDelete("ungroup")` |
| 취소(Cancel) | 아무것도 지우지 않는다. |

그룹 해제는 [소속 자동 동기화](#소속-자동-동기화) 의 재계산을 그대로 쓰고, 모두 삭제만 새로운 cascade 경로다.

## 중첩

컨테이너는 다른 컨테이너 안에 `containerId` 체인으로 중첩할 수 있고 실행된다. 실행 엔진은 중첩 스코프를 지원한다(바깥 `$loop`·`$item` 을 저장했다가 되돌림). 실행 의미는 [컨테이너 실행 §중첩 컨테이너 스코프](../CLE-EXEC/CLE-EXEC-CONTAINER.md#중첩-컨테이너-스코프) 가 정한다. 표현식에는 안쪽 컨테이너가 바깥 컨텍스트를 가리키는 `$parent` 가 없다. 반복 변수의 표현식 표면은 [표현식 언어 §`$loop` 속성](CLE-WF-EXPR.md#loop-속성) 이 정한다. 소속은 `containerId` 와 `in <컨테이너>` 배지로만 나타내고 컨테이너를 감싸는 영역은 두지 않는다.

| 항목 | 설명 |
| --- | --- |
| 중첩 허용 | 컨테이너 안에 다른 컨테이너를 둘 수 있다(`containerId` 체인). |
| 깊이 제한 | 없다. 순환만 거부한다(에러 메시지 접두 `CONTAINER_CYCLE: `). |
| 레벨별 시각 구분 | 없다. 시각 containment 를 쓰지 않으므로 배경 틴트나 깊이 표시를 두지 않는다. |

깊이 제한(3)과 레벨별 배경 틴트는 도입하지 않기로 확정했다([Rationale](#rationale) R-4).

## 도구 영역(제거됨)

AI 에이전트 노드 옆에 노드를 놓아 도구로 등록하던 도구 영역(Tool Area, `tool_owner_id`)은 제거됐다. 캔버스는 AI 에이전트 노드 오른쪽 점선 영역과 끌어 놓기 인터랙션을 보여 주지 않는다. 제거 사유와 새 도구 연결 설계는 [AI 에이전트 노드](../CLE-NODE-AI/CLE-NODE-AGENT.md) 가 정한다. DB 컬럼 `tool_owner_id` 는 남아 있다([워크플로우 데이터와 저장 흐름](CLE-WF-DATA.md)).

## 구현 위치

- `codebase/frontend/src/components/editor/canvas/custom-node.tsx` (컨테이너 노드의 삭제 버튼)
- `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx` (Delete·Backspace 의 `onBeforeDelete` 가로채기, 확인 다이얼로그)
- `codebase/frontend/src/lib/stores/editor-store.ts` (`requestNodeDelete`, `confirmContainerDelete`)

## Rationale

### R-4. 컨테이너 중첩에는 깊이 제한과 레벨별 배경 틴트를 두지 않는다 (2026-07-08)

컨테이너 중첩에 대해 (a) 최대 깊이 3단계 제한과 초과 토스트, (b) 중첩 레벨별 배경 틴트(L1 5%, L2 10%, L3 15%)를 "미구현(계획)" 으로 두었던 것을 **버리고 앞으로도 구현하지 않기로 확정했다**(사용자 결정, 2026-07-08). 중첩 기능 자체는 유지한다. 버린 것은 미구현으로 남아 있던 캔버스 UX 다듬기뿐이다.

근거는 다음과 같다.

1. **중첩 실행은 이미 있는 기능이다.** Loop·ForEach·Map 을 다른 컨테이너 안에 `containerId` 체인으로 중첩하는 것은 데이터 모델이 허용하는 데서 그치지 않는다. 실행 엔진이 중첩 스코프(바깥 `$loop`·`$item` 저장과 복원)를 지원하고, `loop-executor`·`foreach-executor` 의 컨텍스트 저장·복원과 "nested-container safe" 단위 테스트, `editor-store` 의 3단 중첩 삭제 테스트가 이를 검증한다. 그래서 중첩 절 전체를 버리면 살아 있는 기능의 캔버스 문서가 사라진다. 기능 문서는 남기고 미구현 다듬기만 뺐다.
2. **레벨별 배경 틴트는 시각 containment 미사용 결정과 모순된다.** 컨테이너를 일반 노드 크기로 그리고, 자식은 자유롭게 놓고, 소속은 `containerId` 와 `in <컨테이너>` 배지로만 나타내면 컨테이너가 자식을 감싸는 영역이 없다. 틴트를 칠할 자리가 없다. 틴트를 구현하려면 시각 containment 를 다시 들여와야 하는데 그 방향으로 가지 않기로 했다.
3. **깊이 상한 3은 근거가 없고 실제 동작과도 다르다.** 실행 엔진은 컨테이너 중첩에 깊이 상한을 두지 않고 순환(`CONTAINER_CYCLE`)만 거부한다. "3단계" 라는 숫자에 제품·기술 근거가 없어 임의 상한을 새로 만들지 않고 지금의 무제한(순환만 차단) 동작을 확정했다. Parallel 의 `parallel:nested-depth-exceeded`(깊이 2 이하)는 그래프 구조를 보는 별개 장치로 `containerId` 중첩과 관계없다([그래프 경고 규칙](CLE-WF-WARN.md)). AI 어시스턴트 `shadow-workflow.ts` 의 `MAX_CONTAINER_DEPTH = 64` 는 손상된 `containerId` 체인을 끝없이 따라가지 않도록 막는 순회 상한일 뿐 제품의 중첩 깊이 제한이 아니다.

이 결정에 따라 [그래프 경고 규칙](CLE-WF-WARN.md) 의 향후 확장 항목 "Loop·ForEach 중첩 깊이 정책" 도 미도입으로 확정했다.
