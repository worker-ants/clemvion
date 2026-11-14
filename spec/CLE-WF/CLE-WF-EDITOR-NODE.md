---
id: "CLE-WF-EDITOR-NODE"
title: "워크플로우 에디터 — 노드 시각 표현"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-WF-EDITOR"
ancestors: ["CLE-VISION", "CLE-WF", "CLE-WF-EDITOR"]
area: "CLE-WF"
content_hash: "7cd74ec6a64fb3999d219a5199cec3f03ace2a2e4cf0e8210d958931ffdd53cb"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "2d51c1006da2b72c52886b0cf4f6dc9d627f810f5c0c06f072af8937a532a195"
etag: "sha256-0feeb7c49d037f4dd08bc3c3579664a5b1bc05332390053707c38762b532d4d4"
---
## 개요

이 문서는 [워크플로우 에디터와 캔버스](CLE-WF-EDITOR.md) 의 하위 문서로 캔버스 위 노드의 시각 표현(외형·상태 표시·설정 요약·미설정 경고·`⚠ Missing` 배지·삭제 버튼)과 수동 트리거 노드의 편집 제약을 정한다. 컨테이너 노드의 그림과 소속 배지는 [컨테이너 편집](CLE-WF-EDITOR-CONTAINER.md) 이 정한다.

## 노드 시각 표현

### 외형

노드 본체 왼쪽에 입력 포트가, 오른쪽에 출력 포트가 있다. 본체 첫 줄은 아이콘과 노드 유형명, 둘째 줄은 사용자 레이블, 셋째 줄은 설정 요약이다.

| 요소 | 설명 |
| --- | --- |
| 입력 포트(●) | 왼쪽. 회색. 연결할 수 있으면 강조한다. |
| 출력 포트(●) | 오른쪽. 유형에 따라 여러 개이고 라벨을 붙인다. 포트 종류별 색(데이터 초록, 시스템 파랑, 에러 빨강)은 [노드 포트와 설정 패널](CLE-WF-NODEPANEL.md) 이 정한다. |
| 카테고리 색 | 위쪽 바 또는 왼쪽 바. 예: Logic 파랑, Flow 보라, AI 초록. 전체 색은 [노드 시스템 구조와 카탈로그](../CLE-NODE/CLE-NODE-ARCH.md) 가 정한다. |
| 아이콘 | 노드 유형별 아이콘 |
| 이름 | 첫 줄: 노드 유형명 |
| 레이블 | 둘째 줄: 사용자가 붙인 노드 레이블(있을 때) |

### 상태 표시

| 상태 | 시각 효과 |
| --- | --- |
| 기본 | 일반 표시 |
| 선택됨 | 두꺼운 테두리와 그림자 |
| 비활성(Disabled) | 반투명과 사선 패턴 오버레이 |
| 실행 대기 | 변화 없음 |
| 실행 중 | 파란 테두리 펄스 애니메이션 |
| 성공 | 아래쪽 초록 체크 아이콘. 잠시 뒤 흐려진다. |
| 실패 | 빨간 테두리와 에러 아이콘. 누르면 에러 상세를 본다. |
| 건너뜀 | 회색 처리 |
| Presentation 완료 | 노드 오른쪽 아래 👁 배지. 누르면 실행 결과 드로어를 열고 해당 탭을 고른다. |

실행 중 상태 바, 연결선 흐름 애니메이션, 입력 대기 표시 같은 실행 진행 표시는 [에디터 실행과 디버깅](../CLE-EXEC/CLE-EXEC-RUN.md) 이 정한다.

### 설정 요약

설정 요약(configuration summary, `summaryTemplate`)은 노드 본체의 셋째 줄에 보이는 짧은 문구다. 설정 패널을 열지 않고도 노드의 핵심 설정을 캔버스에서 알 수 있다. 예를 들어 HTTP Request 노드는 `GET https://api.example.c...` 처럼 보인다.

| 항목 | 설명 |
| --- | --- |
| 위치 | 노드 본체 셋째 줄(아이콘·유형명 줄과 레이블 줄 아래) |
| 글꼴 | 기본 텍스트보다 작고 흐린(muted) 색 |
| 최대 길이 | 40자. 넘으면 `text-overflow: ellipsis` 로 자른다. 잘림 규칙의 기준은 [노드 시스템 구조와 카탈로그](../CLE-NODE/CLE-NODE-ARCH.md) 에 있다. |
| 툴팁 | 요약이 잘렸으면 마우스를 올릴 때 전체 문구를 보여 준다. |
| 줌 | 줌 50% 미만에서는 요약 줄을 숨기고 아이콘·유형명·레이블만 보인다. |
| 인터랙션 | 표시 전용이다. 누르면 기존처럼 설정 패널이 열린다. |
| 갱신 | 노드 설정이 에디터 상태에 반영되면(설정 패널 `변경 저장`·`JSON 적용`, AI 어시스턴트 편집 등) 바로 갱신한다. |

**노드별 요약 형식**: 각 노드 유형의 요약 형식은 노드 스키마의 `summaryTemplate` 이 정하고 해당 노드 문서의 "설정 요약" 절에 적는다. 이 문서는 노드별 형식 표를 따로 두지 않는다. 스키마에 `summaryTemplate` 이 없는 노드는 요약 줄을 표시하지 않는다. 예를 들어 [AI 에이전트 노드](../CLE-NODE-AI/CLE-NODE-AGENT.md) 와 [정보 추출기 노드](../CLE-NODE-AI/CLE-NODE-EXTRACTOR.md) 는 요약이 아직 없다(미구현). 목표 형식은 [AI 노드 공통](../CLE-NODE-AI/CLE-NODE-AI-COMMON.md) 에 있다. 수동 트리거 노드도 `summaryTemplate` 이 없어 지금은 요약을 표시하지 않는다. 설정(`config.parameters`)은 있고 요약이 미구현일 뿐이다([수동 트리거 노드 §설정 요약](../CLE-NODE-TRIG/CLE-NODE-MANUAL.md#설정-요약)). 카테고리별 공통 형식은 [Logic 노드 공통](../CLE-NODE-LOGIC/CLE-NODE-LOGIC-COMMON.md), [통합 노드 공통](../CLE-NODE-INT/CLE-NODE-INT-COMMON.md), [Data 노드 공통](../CLE-NODE-DATA/CLE-NODE-DATA-COMMON.md), [Presentation 노드 공통](../CLE-NODE-PRES/CLE-NODE-PRES-COMMON.md) 을 따른다.

**특수한 경우**

| 경우 | 동작 |
| --- | --- |
| 표현식 사용 | 표현식 원문을 그대로 표시한다. 예: `{{ $input.role }}`. 잘림 규칙을 적용한다. |
| 지워진 통합 참조 | `⚠ Missing integration`(앰버색) |
| 지워진 워크플로우 참조 | `⚠ Missing workflow`(앰버색) |
| 커스텀·마켓플레이스 노드 | `configSchema` 의 처음 두 필드를 `key: value` 형태로 표시한다. |
| 사용자 레이블 없음 | 둘째 줄(레이블)이 없으면 요약이 둘째 줄로 올라간다. |

두 `⚠ Missing` 배지는 판정 경로가 다르다.

- `⚠ Missing integration` 은 렌더러가 직접 판정한다. 노드 경고 규칙(`warningRules`, `warnWhen` DSL)은 노드 자신의 설정만 보므로 통합이 지워졌는지 알 수 없다. 그래서 캔버스(`workflow-canvas.tsx`)가 워크스페이스 통합 목록을 한 번 조회해 Context(`integration-list-context.ts`)로 내리고, 렌더러(`custom-node.tsx`)가 `config.integrationId` 가 그 목록에 있는지 대조한다. 목록이 확정되지 않았으면(불러오는 중이거나 페이지네이션 한도로 전체를 받지 못함) 배지를 붙이지 않는다. 그 목록에는 다른 사용자의 개인 통합이 없어서 지워지지 않은 통합에도 배지가 붙는 경우가 있다([통합 노드 공통 §삭제된 통합 표시](../CLE-NODE-INT/CLE-NODE-INT-COMMON.md#삭제된-통합-표시)). 이 배지는 그래프 경고 배지(`AlertTriangle`)와 다른 연결 끊김 아이콘(`Unplug`)을 쓴다([통합 노드 공통](../CLE-NODE-INT/CLE-NODE-INT-COMMON.md)).
- `⚠ Missing workflow` 는 저장 시점에 남긴 `workflowName` 을 쓰는 설정 전용 `warnWhen`(`workflowId && !workflowName`, `workflow.schema.ts`)이라 표준 스키마 DSL 경로다.

### 미설정 경고와 경고 배지

미설정 경고(not-configured badge)는 필수 설정이 비었을 때 노드에 붙는 경고다. 심각도가 `advisory` 인 노드 경고 규칙은 같은 헤더 아이콘으로 따로 보인다(아래 표의 advisory 행). 두 심각도의 뜻은 [그래프 경고 규칙 §노드 경고 규칙의 심각도](CLE-WF-WARN.md#노드-경고-규칙의-심각도) 가 정한다.

| 항목 | 설명 |
| --- | --- |
| 표시 | 노드 헤더 오른쪽의 `AlertTriangle` 아이콘(`text-white/70`, 마우스를 올리면 `text-white`). 마우스를 올리면 툴팁에 **구체적인 누락 항목**을 보여 준다. 일반 노드와 컨테이너 노드 모두 같은 헤더 아이콘을 쓴다. 접근성을 위해 아이콘에 `aria-label="warning"` 을 단다. |
| 조건 | 노드의 필수 설정 필드가 하나라도 비었을 때 |
| 예외 | 수동 트리거 노드는 미설정 경고를 표시하지 않는다. |
| 선택 필드만 있는 노드 | 모든 필드가 선택 항목이면 정상 요약을 표시한다(일반 노드는 본체, 컨테이너는 헤더 텍스트). |
| advisory 노드 경고 | 심각도가 `advisory` 인 노드 경고 규칙이 발화하면 설정 요약 줄은 그대로 두고 노드 헤더에 같은 `AlertTriangle` 아이콘(`text-white/70`, `aria-label="advisory warning"`)을 띄운다. 툴팁에는 발화한 advisory 문구를 줄마다 `⚠ ` 를 붙여 모두 보여 준다. 실행과 저장을 막지 않는다. |
| blocking 우선 | 미설정 경고(`blocking`)가 함께 있으면 미설정 경고 아이콘만 보이고 advisory 아이콘은 숨긴다. |
| 줌 | 줌 50% 미만이면 설정 요약처럼 두 아이콘 모두 숨긴다. |

툴팁에 나오는 노드별 누락 메시지는 각 노드 스키마의 노드 경고 규칙(`warningRules`)이 정한다. 이 문서는 노드별 문구 표를 따로 두지 않는다. 문구의 영문 원문은 각 노드 문서가 인용한다. 대개 그 문서의 "에러 코드" 절에 있다(예: [Table 노드 §에러 코드](../CLE-NODE-PRES/CLE-NODE-TABLE.md#에러-코드) 의 `warningRules.table:no-columns`). 노드 사이 관계를 보는 그래프 경고 규칙의 배지(심각도 `error` 는 빨강이고 저장 버튼을 막는다, `warning` 은 노랑)는 [그래프 경고 규칙](CLE-WF-WARN.md) 이 정한다. advisory 표시를 이렇게 정한 근거는 [Merge 노드 Rationale](../CLE-NODE-LOGIC/CLE-NODE-MERGE.md#first-와-append-를-지금-의미로-정하고-advisory-경고로-알린다-2026-11-12) 의 「캔버스 표시」 문단에 있다.

### 삭제 버튼

노드 오른쪽 위 바깥에 지름 20px 원형 ✕ 버튼을 둔다(`custom-node.tsx`, 구현됨). 기본 배경은 중립 회색이고 마우스를 올리면 빨간색이 된다. 우클릭 메뉴 "삭제" 와 Delete·Backspace 키(ReactFlow `deleteKeyCode`)에 더한 삭제 수단이다. 누르면 `requestNodeDelete` 로 연결된 연결선까지 함께 지운다. 자식이 있는 컨테이너는 바로 지우지 않고 [컨테이너 삭제](CLE-WF-EDITOR-CONTAINER.md#컨테이너-삭제) 의 확인 다이얼로그를 거친다.

| 조건 | 삭제 버튼 |
| --- | --- |
| 마우스를 올림 | 200ms 동안 나타난다. |
| 마우스를 뗌 | 200ms 동안 사라진다. 노드가 선택돼 있으면 남는다. |
| 노드 선택 상태 | 마우스를 올리지 않아도 항상 보인다. |
| 수동 트리거 노드 | 표시하지 않는다(삭제 불가). |
| 워크플로우 실행 중 | 숨긴다(실행 중 편집 차단). |
| 비활성 노드 | 표시한다(삭제 허용). |
| 여러 노드 선택 | 노드마다 따로 보인다. 누르면 그 노드만 지운다. 선택 전체를 지우려면 Delete 키를 쓴다. |
| 터치 기기 | 탭(선택)하면 보이고, 다른 노드나 캔버스를 탭하면 숨긴다. |

| 동작 | 설명 |
| --- | --- |
| 클릭 | 노드를 바로 지운다. Delete 키와 같이 연결된 연결선도 지운다. 자식 있는 컨테이너는 확인 다이얼로그를 거친다. |
| Undo | Ctrl+Z 로 되돌린다(기존 Undo 와 같다). |
| 우클릭 메뉴 | 기존 "삭제" 항목은 그대로 둔다. |

## 수동 트리거 노드

[수동 트리거 노드](../CLE-NODE-TRIG/CLE-NODE-MANUAL.md)(`manual_trigger`)는 워크플로우의 시작점이다. 실행할 때의 역할(입력 파라미터 스키마로 입력을 해석·검증)은 그 노드 문서가 정한다. 에디터는 아래 편집 제약만 둔다.

| 항목 | 설명 |
| --- | --- |
| 생성 시점 | 새 워크플로우를 만들 때 서버가 자동으로 만든다. |
| 기본 위치 | `positionX: 250`, `positionY: 300` |
| 노드 유형 | `manual_trigger`(카테고리 `trigger`) |
| 포트 | 입력 포트 없음, 출력 포트 하나. 포트 ID 는 노드 문서가 정한다. |
| 삭제 불가 | 사용자가 지울 수 없다. 삭제 버튼도 표시하지 않는다. |
| 중복 불가 | 워크플로우마다 하나만 있다. 팔레트에서 하나 더 끌어 놓으면 무시한다. 저장 요청도 정확히 하나를 요구한다([워크플로우 데이터와 저장 흐름](CLE-WF-DATA.md)). |

## 구현 위치

- `codebase/frontend/src/components/editor/canvas/custom-node.tsx` (노드 렌더러: 외형, 상태 표시, 설정 요약, 경고 배지, 삭제 버튼)
- `codebase/frontend/src/components/editor/canvas/integration-list-context.ts` (`⚠ Missing integration` 판정에 쓰는 통합 목록 Context)
- `codebase/frontend/src/lib/stores/editor-store.ts` (`requestNodeDelete`)
