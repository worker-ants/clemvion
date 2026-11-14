---
id: "CLE-WF-DATA-MODEL"
title: "워크플로우 데이터 — 엔티티와 제약"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-WF-DATA"
ancestors: ["CLE-VISION", "CLE-WF", "CLE-WF-DATA"]
area: "CLE-WF"
content_hash: "d53cfa39d87ce8cc1573e3ee3622e3e51a8ea10b548dd3127a622f6dcf408dda"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "ee23abd5ae55cea014c0fe4115fd750c10c5bd9ef26cfc7c2d47a1c8b1c6a501"
etag: "sha256-2be713671deefa9c45fee17a380e056ea7d9cfa042cf516cdf324839aeef73d4"
---
## 개요

이 문서는 [워크플로우 데이터와 저장 흐름](CLE-WF-DATA.md) 의 하위 문서로 Workflow · Folder · Node · Edge · WorkflowVersion 의 필드 · 제약과 노드 배치 컬럼의 검사 위치를 정한다. 엔티티 관계도는 부모에 있다.

## Workflow

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| id | UUID | PK |
| workspace_id | UUID | FK → Workspace(CASCADE) |
| name | String | 워크플로우 이름 |
| description | String? | 설명 |
| is_active | Boolean | 워크플로우 활성 상태(`workflow.is_active`). 기본 `false`. 뜻은 [상태 전이](CLE-WF-DATA.md#상태-전이) 참조 |
| tags | String[] | 태그 목록 |
| folder_id | UUID? | FK → Folder(SET NULL, 같은 워크스페이스, 정리용). 같은 워크스페이스의 폴더만 가리킨다. 저장 전에 거부하고 DB 의 복합 FK 도 막는다([데이터 모델 개요 §참조의 소속](../CLE-PLAT/CLE-PLAT-DATA.md#참조의-소속)) |
| settings | JSONB | 워크플로우 수준 설정. 알려진 키는 `maxConcurrentExecutions: number?` 하나다. 워크플로우당 동시에 `running` 인 실행의 상한이고, 설정하지 않으면 기본 3이다. 동작은 [큐 워커와 동시 실행 제한](../CLE-EXEC/CLE-EXEC-WORKER.md) 이 정한다. 편집은 워크플로우 편집 권한(`PATCH /api/workflows/:id`, `editor` 이상)으로 한다. 모르는 키는 400 으로 거부한다([워크플로우 목록과 폴더](CLE-WF-LIST.md)). |
| current_version | Integer | 현재 버전 번호. 버전 기록의 번호와의 관계는 [미결 사항](CLE-WF-DATA.md#미결-사항) 참조 |
| created_by | UUID | FK → User(NO ACTION) |
| created_at | Timestamp | 생성 시각 |
| updated_at | Timestamp | 수정 시각 |

`(id, workspace_id)` UNIQUE(V135, `uq_workflow_id_workspace_id`)는 트리거 · 알림 규칙 · 어시스턴트 세션 · 테스트 데이터셋 복합 FK 의 참조 대상이다([데이터 모델 개요 「참조의 소속」](../CLE-PLAT/CLE-PLAT-DATA.md#참조의-소속)).

## Folder

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| id | UUID | PK |
| workspace_id | UUID | FK → Workspace(CASCADE) |
| name | String | 폴더 이름 |
| parent_id | UUID? | FK → Folder(CASCADE, 같은 워크스페이스, 중첩 폴더) |
| sort_order | Integer | 정렬 순서(기본 0) |
| created_at | Timestamp | 생성 시각 |
| updated_at | Timestamp | 수정 시각 |

제약:

- `(workspace_id, parent_id, name)` UNIQUE. 같은 위치에 같은 이름을 둘 수 없다.
- 중첩 깊이는 최대 5단계다. 생성과 부모 변경 모두에 적용한다.
- `parent_id` 는 **같은 워크스페이스**의 폴더만 가리킨다. 생성과 부모 변경 모두 저장 전에 거부하고 DB 의 복합 FK `fk_folder_parent_id` 도 막는다([참조의 소속](../CLE-PLAT/CLE-PLAT-DATA.md#참조의-소속)).
- `(id, workspace_id)` UNIQUE(V137, `uq_folder_id_workspace_id`). 워크플로우 `folder_id` · 폴더 `parent_id` 복합 FK 의 참조 대상이다.
- 계층은 **순환하지 않는다**. 폴더는 자기 자신이나 자손을 부모로 가질 수 없다(부모 변경 때 검사).

제약을 어겼을 때의 에러 코드와 검사 순서는 [워크플로우 목록과 폴더](CLE-WF-LIST.md) 의 폴더 API 가 정한다.

## Node

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| id | UUID | PK |
| workflow_id | UUID | FK → Workflow(CASCADE) |
| type | String(`VARCHAR(50)`) | 노드 유형. DB enum 이 아닌 자유 문자열이라 새 유형을 더할 때 enum 마이그레이션이 필요 없다. 허용 값은 아래 [노드 유형 목록](#노드-유형-목록) |
| category | Enum | `trigger` / `logic` / `flow` / `ai` / `integration` / `data` / `presentation` 7종. `trigger` 는 수동 트리거 노드용으로 V003 에서 더했다. |
| label | String | 노드 레이블. 워크플로우 안에서 유일하고 `#` 을 쓸 수 없다([표현식 언어](CLE-WF-EXPR.md)). |
| position_x | Float | 캔버스 X 좌표 |
| position_y | Float | 캔버스 Y 좌표 |
| config | JSONB | 노드별 설정 값 |
| is_disabled | Boolean | 노드 비활성화 여부 |
| description | String? | 메모·설명. 설정 패널의 노드 메모는 `config.notes` 에 저장한다. 두 필드의 관계는 [노드 포트와 설정 패널](CLE-WF-NODEPANEL.md) 의 미결 사항 참조 |
| container_id | UUID? | FK → Node(SET NULL, 같은 워크플로우). 컨테이너(Loop·ForEach·Map) 안에 속한 경우. 연결선을 잇고 지울 때 자동으로 맞춘다([워크플로우 에디터와 캔버스](CLE-WF-EDITOR.md)). [Background 노드](../CLE-NODE-LOGIC/CLE-NODE-BACKGROUND.md) 는 컨테이너 소속을 쓰지 않고 `background` 포트 연결선으로 본문을 알아본다. |
| tool_owner_id | UUID? | FK → Node(SET NULL, 같은 워크플로우). AI 에이전트 노드의 도구 영역에 등록한 경우. 도구 영역 기능은 제거됐고 컬럼만 남았다([AI 에이전트 노드](../CLE-NODE-AI/CLE-NODE-AGENT.md)). |
| created_at | Timestamp | 생성 시각 |
| updated_at | Timestamp | 수정 시각 |

제약:

- `container_id` 와 `tool_owner_id` 는 동시에 값을 가질 수 없다(CHECK 제약 `chk_node_placement`).
- `container_id`·`tool_owner_id` 는 **같은 워크플로우**의 노드만 가리킨다. 저장할 때 거부하고 DB 의 복합 FK(`fk_node_container_id` · `fk_node_tool_owner_id`)도 막는다([참조의 소속](../CLE-PLAT/CLE-PLAT-DATA.md#참조의-소속)).
- `(id, workflow_id)` UNIQUE(V140, `uq_node_id_workflow_id`). 노드 구조 참조와 연결선 끝점 복합 FK 의 참조 대상이다.
- `container_id` 가 가리키는 노드의 유형은 `loop`, `foreach`, `map` 가운데 하나여야 한다.
- `container_id` 체인은 순환하면 안 된다. 실행 때 거부하고 에러 메시지가 `CONTAINER_CYCLE: ` 로 시작한다.
- 트리거 카테고리 노드(`manual_trigger` 등)는 `container_id` 를 가질 수 없다. 실행 때 거부하고 에러 메시지가 `CONTAINER_INVALID_CHILD: ` 로 시작한다.
- `tool_owner_id` 가 가리키는 노드의 유형은 `ai_agent` 여야 한다.

`chk_node_placement` 와 워크플로우 소속 검사를 빼면 위 제약은 저장 때 검사하지 않는다([컨테이너 소속과 도구 영역 컬럼](#컨테이너-소속과-도구-영역-컬럼)).

### 노드 유형 목록

노드별 동작과 전체 카탈로그는 [노드 시스템 구조와 카탈로그 §전체 노드 카탈로그](../CLE-NODE/CLE-NODE-ARCH.md#전체-노드-카탈로그) 가 정한다. 아래 표는 `node.type` 에 저장되는 값의 목록이다.

| category | type | 설명 |
| --- | --- | --- |
| trigger | `manual_trigger` | 수동 트리거 노드(워크플로우 시작점) |
| logic | `if_else` | 조건 분기 |
| logic | `switch` | 여러 갈래 분기 |
| logic | `loop` | 반복 |
| logic | `variable_declaration` | 변수 선언 |
| logic | `variable_modification` | 변수 수정 |
| logic | `split` | 배열 나누기 |
| logic | `map` | 배열 변환 |
| logic | `filter` | 조건에 따라 배열을 `match`·`unmatched` 두 포트로 나눔([Filter 노드](../CLE-NODE-LOGIC/CLE-NODE-FILTER.md)) |
| logic | `foreach` | 차례로 반복 |
| logic | `parallel` | 병렬 실행 |
| logic | `merge` | 데이터 합치기 |
| logic | `background` | 백그라운드 실행 |
| flow | `workflow` | 서브 워크플로우 호출 |
| ai | `ai_agent` | AI 에이전트 실행 |
| ai | `text_classifier` | 텍스트 분류 |
| ai | `information_extractor` | 정보 추출 |
| integration | `http_request` | 범용 HTTP 요청 |
| integration | `database_query` | 데이터베이스 쿼리 |
| integration | `send_email` | 이메일 발송(SMTP) |
| integration | `cafe24` | Cafe24 Admin API(리소스 × 동작 동적 폼). 같은 통합을 AI 에이전트 노드의 MCP 도구로도 쓴다([Cafe24 노드](../CLE-NODE-INT/CLE-NODE-CAFE24.md)). |
| integration | `makeshop` | MakeShop Shop API(리소스 × 동작 동적 폼, 7개 섹션 REST 161개). cafe24 처럼 AI 에이전트 노드의 MCP 도구로도 쓴다([MakeShop 노드](../CLE-NODE-INT/CLE-NODE-MAKESHOP.md)). makeshop 통합 중복은 통합 테이블의 공통 상점 식별자 partial UNIQUE 인덱스(`idx_integration_workspace_service_mall`, V072)가 `(workspace_id, service_type, mall_id)` 기준으로 막는다([통합 데이터와 흐름](../CLE-INT/CLE-INT-DATA.md)). |
| data | `transform` | 데이터 변환(연산 체인) |
| data | `code` | JavaScript 코드 실행 |
| presentation | `carousel` | 캐러셀(슬라이드) 시각화 |
| presentation | `table` | 테이블 시각화 |
| presentation | `chart` | 차트 시각화 |
| presentation | `form` | 사용자 입력 폼(Human-in-the-loop) |
| presentation | `template` | 템플릿 기반 콘텐츠 생성 |

## Edge

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| id | UUID | PK |
| workflow_id | UUID | FK → Workflow(CASCADE) |
| source_node_id | UUID | FK → Node(CASCADE, 같은 워크플로우, 출력 노드) |
| source_port | String | 출력 포트 ID(예: `true`, `false`, `default`, `out`, `success`). 노드별 포트 ID 는 각 노드 문서가 정한다. |
| target_node_id | UUID | FK → Node(CASCADE, 같은 워크플로우, 입력 노드) |
| target_port | String | 입력 포트 ID(기본 `in`) |
| type | Enum | 연결선 유형: `data`(기본) / `error`(에러 포트 연결선) |
| condition | JSONB? | 연결선 조건(조건부 경로 선택용) |
| created_at | Timestamp | 생성 시각 |

제약:

- `(source_node_id, source_port, target_node_id, target_port)` UNIQUE. 같은 연결을 두 번 만들 수 없다.
- 자기 자신으로 연결할 수 없다(`source_node_id != target_node_id`, `chk_no_self_loop`).
- 출발 노드와 도착 노드는 같은 `workflow_id` 에 속해야 한다. 저장할 때 거부하고 DB 의 복합 FK(`fk_edge_source_node_id` · `fk_edge_target_node_id`)도 막는다([참조의 소속](../CLE-PLAT/CLE-PLAT-DATA.md#참조의-소속)).

에디터는 자기 연결과 중복 연결을 먼저 막고 DB 제약이 마지막 안전망이 된다([연결선](CLE-WF-EDGE.md)).

## WorkflowVersion

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| id | UUID | PK |
| workflow_id | UUID | FK → Workflow(CASCADE) |
| version | Integer | 버전 번호. `(workflow_id, version)` UNIQUE |
| snapshot | JSONB | 워크플로우 캔버스 스냅샷 `{ name, description, nodes, edges }`. **`workflow.settings` 는 담지 않는다.** 버저닝·복원 대상은 캔버스와 이름·설명이다. 소비하는 쪽 타입(`VersionSnapshot`)은 [버전 기록](CLE-WF-VERSION.md) 에 있다. |
| change_summary | String? | 변경 요약. 저장 요청이 보낸 값이나 복원 때의 `Restored from vN` |
| created_by | UUID | FK → User(NO ACTION) |
| created_at | Timestamp | 생성 시각 |

## 컨테이너 소속과 도구 영역 컬럼

| 동작 | 노드 컬럼 변화 | 검사 |
| --- | --- | --- |
| Loop·ForEach·Map 안에 자식 노드 배치 | `child.container_id = container.id` | `container.type ∈ {loop, foreach, map}`. 트리거 카테고리 자식 거부(메시지 접두 `CONTAINER_INVALID_CHILD: `). 순환 거부(메시지 접두 `CONTAINER_CYCLE: `) |
| AI 에이전트 노드의 도구 영역에 배치(제거된 기능) | `tool.tool_owner_id = aiAgent.id` | `aiAgent.type = 'ai_agent'` |
| 둘 다 설정 | 없음 | CHECK 제약 `chk_node_placement`(V001)가 거부 |
| Background 본문 | `container_id` 를 쓰지 않는다. `background` 포트 연결선으로 알아본다([컨테이너 실행](../CLE-EXEC/CLE-EXEC-CONTAINER.md)). | 없음 |

위 표의 유형 · 트리거 자식 · 순환 검사는 편집·저장 때 하지 않고 (a) 실행 엔진의 실행 시점(`execution-engine.service.ts`)과 (b) AI 어시스턴트의 Shadow 검증(`ShadowWorkflow`)이 한다. 저장 경로(`saveCanvas`·노드 API)가 저장 때 보는 것은 **참조의 소속**뿐이다. `container_id`·`tool_owner_id` 는 같은 워크플로우의 노드여야 하고, 캔버스 저장은 이번 페이로드의 노드여야 한다. 아니면 400 `VALIDATION_ERROR` 다([참조의 소속](../CLE-PLAT/CLE-PLAT-DATA.md#참조의-소속)). DB 가 강제하는 것은 CHECK `chk_node_placement`(둘 다 설정 금지)와 같은 워크플로우 소속(복합 FK, V146)이다. 유형 · 순환 · 트리거 자식은 DB 가 보지 않는다.

## Rationale

### 노드 배치 두 축은 함께 설정할 수 없다

`container_id` 와 `tool_owner_id` 는 뜻이 근본적으로 다르다(실행 맥락과 도구 영역 등록). CHECK 제약 `chk_node_placement`(V001)로 둘을 함께 설정하지 못하게 해 잘못된 정의를 DB 에서 막는다. Background 노드는 `container_id` 를 쓰지 않고 `background` 포트 연결선으로 본문을 알아보므로 이 제약과 부딪히지 않는다.

### 버전 스냅샷은 JSONB 한 덩어리다

`workflow_version.snapshot` 은 이름·설명·노드·연결선 스냅샷을 JSONB 하나로 저장한다. `workflow.settings` 는 담지 않는다. 버저닝과 복원의 대상은 캔버스와 이름·설명이다. JSONB 한 덩어리의 장점은 세 가지다. (1) "어느 시점의 캔버스" 를 행 하나로 복원할 수 있다. (2) `node`·`edge` 테이블 스키마가 바뀌어도 지난 버전을 그대로 보존한다. (3) 비교와 차이 계산을 애플리케이션에서 자유롭게 구현할 수 있다. 대신 행이 커질 수 있는데, 버전이 생기는 빈도가 낮아 받아들일 만하다고 판단했다.

`settings` 를 빼는 것은 빠뜨린 것이 아니라 **의도한 설계**다. 구현(`WorkflowsService.buildSnapshot()`)은 `name`·`description`·`nodes`·`edges` 만 돌려주고 `settings` 를 담은 적이 없다. 데이터 모델 문서의 스냅샷 설명이 한때 "nodes, edges, **settings**" 로 어긋나 있던 것을 2026-07-31 에 맞췄다. 그대로 두었다면 "버전을 복원하면 settings 도 되돌아온다" 는 오해를 낳았을 것이다. 실제로는 캔버스와 이름·설명만 복원된다.
