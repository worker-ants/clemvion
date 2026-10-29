---
id: "CLE-WF-VERSION"
title: "버전 기록"
type: "feature"
version: 6
status: "approved"
requirements: ["REQ-WFVER-001", "REQ-WFVER-002", "REQ-WFVER-003", "REQ-WFVER-004", "REQ-WFVER-005", "REQ-WFVER-006", "REQ-WFVER-007", "REQ-WFVER-008", "REQ-WFVER-009", "REQ-WFVER-010", "REQ-WFVER-011", "REQ-WFVER-012", "REQ-WFVER-013", "REQ-WFVER-014", "REQ-WFVER-015", "REQ-WFVER-016", "REQ-WFVER-017", "REQ-WFVER-018", "REQ-WFVER-019", "REQ-WFVER-020", "REQ-WFVER-021", "REQ-WFVER-022", "REQ-WFVER-023", "REQ-WFVER-024", "REQ-WFVER-025", "REQ-WFVER-026", "REQ-WFVER-027"]
basis_superseded: false
parent: "CLE-WF"
ancestors: ["CLE-VISION", "CLE-WF"]
area: "CLE-WF"
content_hash: "38c7a0ad60288345118d85479d837765c6500795dc5c0a79b5c13e86f6c3e1ef"
read_as: "approved_fallback"
task: "CLE-T-1BQZ10"
source_paths: ["spec/3-workflow-editor/0-canvas.md", "spec/3-workflow-editor/5-version-history.md", "spec/3-workflow-editor/_product-overview.md", "spec/data-flow/11-workflow.md"]
mirror_sha256: "19b5514bc78119d76701d6b246683b6a5dd251600c8c907faa99fe89ddaa28fe"
etag: "sha256-dfae3af5ef1ebbab9d91620bc097f3d6c55a21a7a88ba5d6479d8f1f8fb2ce64"
---
> 구현 상태: 구현됨 · 원문: `spec/3-workflow-editor/5-version-history.md`, `spec/3-workflow-editor/_product-overview.md` (§6 ED-SV-03·04), `spec/3-workflow-editor/0-canvas.md` (§8.1, R-5), `spec/data-flow/11-workflow.md` (§1.1 버전 복원) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

버전 기록(Version History, `WorkflowVersion`)은 에디터 안에서 캔버스의 변경 이력을 버전 단위로 쌓고 되살리는 기능이다.

- **자동 스냅샷**: 사용자가 캔버스를 저장(`POST /workflows/:id/save`)할 때마다 서버가 `workflow_version` 레코드를 자동으로 만든다. 저장과 버전 생성의 트랜잭션 경계는 원문끼리 정의가 갈린다([미결 사항](#미결-사항) 참조).
- **바뀌지 않는 스냅샷**: 버전마다 저장 시점의 이름·설명·노드·연결선 전체를 `jsonb` 버전 스냅샷(version snapshot, `workflow_version.snapshot`)으로 보관한다. 뒤에 캔버스가 바뀌어도 지난 버전은 그대로다. 워크플로우 설정(`settings`)은 스냅샷에 담지 않는다.
- **복원**: 지난 버전을 골라 현재 상태를 덮어쓸 수 있다. 복원 자체도 새 버전으로 기록되고 변경 요약(`change_summary`)에 "Restored from vN" 이 붙는다. 이력을 되감지 않고 앞으로 쌓는다.

이 문서는 버전 기록 패널, 상세·비교·복원 다이얼로그, 버전 API, 변경 요약 규칙을 정한다.

범위 밖:

- `workflow_version` 테이블 컬럼·제약, 저장 요청이 서버에서 처리되는 순서, 스냅샷을 JSONB 로 둔 이유는 [워크플로우 데이터와 저장 흐름](CLE-WF-DATA.md) 이 정한다.
- 어떤 저장 동작이 일어나는지(수동 저장, 실행 직전 저장)는 [워크플로우 에디터와 캔버스](CLE-WF-EDITOR.md) 가 정한다.

## 요구사항

- REQ-WFVER-001 WHEN 사용자가 캔버스를 저장하면 THE SYSTEM SHALL 그 시점의 워크플로우 스냅샷으로 새 버전을 만든다. (원본: ED-SV-03)
- REQ-WFVER-002 WHEN 사용자가 지난 버전을 복원하면 THE SYSTEM SHALL 현재 캔버스를 그 버전의 스냅샷으로 바꾼다. (원본: ED-SV-04)
- REQ-WFVER-003 WHEN 버전을 복원하면 THE SYSTEM SHALL 복원 결과를 변경 요약 `Restored from vN` 이 붙은 새 버전으로 기록한다.
- REQ-WFVER-004 WHILE 버전이 저장돼 있는 동안 THE SYSTEM SHALL 뒤의 캔버스 변경과 관계없이 그 버전의 스냅샷을 바꾸지 않는다.
- REQ-WFVER-005 WHEN 사용자가 에디터 더보기 메뉴에서 Version History 를 고르면 THE SYSTEM SHALL 오른쪽에 버전 기록 패널을 연다.
- REQ-WFVER-006 WHILE 버전 기록 패널이 열려 있는 동안 THE SYSTEM SHALL 버전을 최신이 위로 오게(`version DESC`) 나열한다.
- REQ-WFVER-007 WHILE 버전 항목을 표시하는 동안 THE SYSTEM SHALL 버전 번호·작성자·생성 시각·변경 요약과 상세·복원 버튼을 보여 준다.
- REQ-WFVER-008 IF 버전이 하나도 없으면 THE SYSTEM SHALL "No versions yet. Save the canvas to create the first version." 을 표시한다.
- REQ-WFVER-009 IF 버전 목록을 불러오지 못하면 THE SYSTEM SHALL "Failed to load versions" 를 표시한다.
- REQ-WFVER-010 WHEN 사용자가 Compare 토글을 켜면 THE SYSTEM SHALL 버전 항목에 체크박스를 보여 준다.
- REQ-WFVER-011 WHEN 사용자가 버전 두 개를 고르고 Diff 를 누르면 THE SYSTEM SHALL 버전 비교 다이얼로그를 연다.
- REQ-WFVER-012 WHEN 사용자가 버전 상세를 누르면 THE SYSTEM SHALL 그 버전의 스냅샷을 읽기 전용 다이얼로그로 보여 준다.
- REQ-WFVER-013 WHEN 버전 두 개를 비교하면 THE SYSTEM SHALL 번호가 낮은 쪽을 before, 높은 쪽을 after 로 두고 클라이언트에서 비교한다.
- REQ-WFVER-014 WHEN 버전 두 개를 비교하면 THE SYSTEM SHALL 이름 변경, 추가·삭제된 노드, 수정된 노드의 바뀐 필드, 추가·삭제된 연결선을 보여 준다.
- REQ-WFVER-015 WHEN 사용자가 복원을 누르면 THE SYSTEM SHALL 복원도 새 버전으로 기록된다는 안내가 든 확인 다이얼로그를 띄운다.
- REQ-WFVER-016 WHEN 복원이 성공하면 THE SYSTEM SHALL `workflow-versions` 쿼리 캐시를 무효화하고 페이지를 다시 불러온다.
- REQ-WFVER-017 WHEN 버전 목록을 요청하면 THE SYSTEM SHALL 스냅샷을 빼고 메타데이터와 작성자만 돌려준다.
- REQ-WFVER-018 WHEN 버전 상세를 요청하면 THE SYSTEM SHALL 스냅샷을 포함해 돌려준다.
- REQ-WFVER-019 IF 복원할 스냅샷에 `nodes`·`edges` 배열이 없는 등 형식이 잘못됐으면 THE SYSTEM SHALL 400 `INVALID_VERSION_SNAPSHOT` 으로 거부한다.
- REQ-WFVER-020 WHEN 형식 검사를 통과한 스냅샷을 복원하면 THE SYSTEM SHALL 캔버스 저장과 같은 쓰기 경로(`writeCanvas`)로 저장한다.
- REQ-WFVER-021 WHEN 저장 요청에 `changeSummary` 가 있으면 THE SYSTEM SHALL 그 값을 새 버전의 변경 요약에 그대로 담는다.
- REQ-WFVER-022 WHEN 에디터가 수동 저장이나 실행 직전 저장을 하면 THE SYSTEM SHALL 변경 요약을 보내지 않아 비워 둔다.
- REQ-WFVER-023 IF 같은 워크플로우에 저장이 동시에 들어오면 THE SYSTEM SHALL 버전 생성을 차례로 처리해 버전 번호가 겹치지 않게 한다.
- REQ-WFVER-024 WHEN 워크플로우를 지우면 THE SYSTEM SHALL 그 워크플로우의 버전을 모두 함께 지운다.
- REQ-WFVER-025 WHEN 사용자가 캔버스를 저장하면 THE SYSTEM SHALL 캔버스 저장과 버전 생성이 사용자에게 원자적으로 보이게 한다(트랜잭션 경계는 미결 사항 참조).
- REQ-WFVER-026 WHEN 버전을 복원하면 THE SYSTEM SHALL 스냅샷의 노드 통합 참조 가운데 지금 저장된 노드와 다르고 실행 시점 통합 조회에서 거절될 것을 거부하지 않고 비운 뒤 복원을 끝낸다. 복원한 사람이 통합 소유자인지는 보지 않고 표현식으로 정하는 참조는 판정하지 않는다.
- REQ-WFVER-027 WHEN 복원에서 통합 참조를 비웠으면 THE SYSTEM SHALL 페이지를 다시 불러온 뒤 비운 노드의 레이블을 경고로 표시한다. IF 브라우저 저장소(`sessionStorage`)를 쓸 수 없으면 THE SYSTEM SHALL 경고만 빼고 복원 결과를 그대로 둔다.

## 진입점

에디터 오른쪽 위 더보기(⋯) 드롭다운에서 **Version History** 를 누르면 오른쪽에 사이드 패널이 열린다.

| 영역 | 위치 | 들어가는 요소 | 동작 |
| --- | --- | --- | --- |
| 에디터 툴바 | 맨 위 | Save, Run(▾), 더보기(⋯) | 더보기에서 Version History 를 고른다. |
| 노드 팔레트·캔버스 | 왼쪽·가운데 | 평소 에디터 화면 | 그대로 쓴다. |
| 버전 기록 패널 | 오른쪽 | Compare versions 토글, 버전 목록(`v3 · 2026-04-14 ...` 형태) | [사이드 패널](#사이드-패널) 참조 |

## 사이드 패널

| 영역 | 동작 |
| --- | --- |
| 헤더 | 닫기(X) 버튼 |
| Compare 토글 | 켜면 버전 항목에 체크박스가 나온다. 두 개를 고르고 "Diff" 버튼을 누르면 버전 비교 다이얼로그가 열린다. |
| 버전 항목(목록 모드) | 버전 번호, 작성자, 생성 시각, 변경 요약. `상세(Eye)`·`복원(↺)` 버튼 |
| 빈 상태 | "No versions yet. Save the canvas to create the first version." |
| 에러 상태 | "Failed to load versions" |

목록은 `version DESC`(최신이 위) 순서다.

## 상세 다이얼로그

고른 버전의 스냅샷을 다이얼로그 하나에 읽기 전용으로 보여 준다.

- 워크플로우 메타(이름, 설명)
- 노드 목록(레이블, 유형, 좌표, 비활성 여부)
- 연결선 목록(`source:port → target:port`)

## 버전 비교 다이얼로그

버전 비교(version diff)는 두 버전을 동시에 불러와 클라이언트에서 비교한다. 번호가 낮은 버전이 "before", 높은 버전이 "after" 다.

- **이름 변경**: before 와 after 를 강조해 보여 준다.
- **추가된 노드·삭제된 노드**: 노드 id 로 비교한다.
- **수정된 노드**: id 가 같은 노드에서 `label`, `type`, `category`, `positionX`, `positionY`, `config`, `isDisabled`, `description`, `containerId`, `toolOwnerId` 가운데 달라진 필드 이름을 보여 준다.
- **추가된 연결선·삭제된 연결선**: `source:port → target:port` 키로 비교한다.

## 복원 다이얼로그

"복원" 을 누르면 확인 다이얼로그를 띄운다.

> The current canvas will be replaced with the snapshot from vN. The replacement is itself recorded as a new version, so you can always restore back.

확인하면 `POST /workflows/:id/versions/:versionId/restore` 를 부른다. 성공하면 `workflow-versions` 쿼리 캐시를 무효화하고 **페이지를 다시 불러온다**. 에디터의 메모리 상태와 서버 상태가 통째로 바뀌기 때문이다.

응답 `data.clearedIntegrationRefs` 가 비어 있지 않으면 에디터는 다시 불러온 뒤 경고 토스트를 띄운다. 경고에는 비운 노드의 레이블을 적고 그 노드에서 통합을 다시 고르라고 안내한다. 다시 불러오면 메모리 상태가 사라지므로 경고할 목록은 다시 불러오기 전에 넘겨 둔다. 구현은 같은 탭의 `sessionStorage` 에 워크플로우마다 키 `clemvion.restoreClearedIntegrationRefs:<workflowId>` 로 넣어 두고 다시 불러온 에디터가 꺼내면서 지운다. 저장소를 쓸 수 없으면 경고만 빠지고 복원은 그대로 끝난다. 이 수단을 쓰는 이유와 받아들인 잔여는 [Rationale](#rationale) 의 「복원은 걸린 통합 참조를 비우고 끝낸다」 에 있다.

```mermaid
sequenceDiagram
  participant U as 사용자
  participant FE as 에디터
  participant API as 버전 API
  participant SC as 캔버스 쓰기 경로
  U->>FE: 복원 확인
  FE->>API: POST /workflows/:id/versions/:versionId/restore
  API->>API: 스냅샷 형식 검사
  alt 형식이 잘못됨
    API-->>FE: 400 INVALID_VERSION_SNAPSHOT
  else 통과
    API->>SC: 스냅샷을 저장 요청으로 바꿔 저장과 같은 경로로 쓰기
    SC->>SC: 워크플로우 행을 잠근 뒤 바뀐 통합 참조 검사, 걸리면 비움
    SC->>SC: 노드·연결선 동기화, 새 버전 생성(Restored from vN)
    SC-->>API: 저장 결과
    API-->>FE: workflow, nodes, edges, clearedIntegrationRefs
    FE->>FE: 쿼리 캐시 무효화, 페이지 다시 불러오기
    FE->>U: 비운 참조가 있으면 경고
  end
```

## API

버전을 만드는 전용 API(`POST /api/workflows/:id/versions`)는 없다. `WorkflowVersionsController` 는 조회 GET 두 개만 연다. 버전 스냅샷은 `POST /:id/save` 와 `POST /:id/versions/:versionId/restore` 의 처리 안에서 `createVersion` 으로 기록한다. `createVersion` 은 가장 최신 버전 번호를 `pessimistic_write` 잠금으로 읽어 버전 번호가 겹치지 않게 한다. 같은 워크플로우의 동시 저장은 그 앞의 워크플로우 행 잠금에서 줄을 선다([워크플로우 데이터와 저장 흐름 「생성과 저장 흐름」](CLE-WF-DATA.md#생성과-저장-흐름)). 그래도 새 버전이 `(workflow_id, version)` unique 제약에 걸리면 `createVersion` 은 409 `WORKFLOW_VERSION_CONFLICT`(메시지 `Concurrent save detected — please retry`)로 거부하고 다시 시도하라고 안내한다(`workflow-versions.service.ts`). 저장과 복원 모두 이 응답을 받을 수 있다.

### 버전 목록

`GET /workflows/:wfId/versions`

응답은 `WorkflowVersionListItemDto[]`(`version DESC`)다. 메타데이터와 작성자만 담고 `snapshot` 필드는 일부러 뺀다. 목록에서 필요 없는 데이터를 많이 가져오지 않기 위해서다. `creator` 관계를 포함한다. 버전 목록의 작성자는 그 버전을 저장한 사람(`workflow_version.created_by`)이다. 개인 통합 판정에 쓰는 워크플로우 작성자(`workflow.created_by`)와 다르다.

| 필드 | 목록 | 상세 |
| --- | --- | --- |
| `id`, `workflowId`, `version`, `changeSummary`, `createdBy`, `createdAt`, `creator` | 포함 | 포함 |
| `snapshot` | **제외** | 포함 |

### 버전 상세

`GET /workflows/:wfId/versions/:versionId`

응답은 `WorkflowVersion` 한 건이고 `snapshot` 을 포함한다. 스냅샷 형식은 아래와 같다.

```ts
interface VersionSnapshot {
  name: string;
  description: string | null;
  nodes: Array<{
    id: string;
    type: string;
    category: string;
    label: string;
    positionX: number;
    positionY: number;
    config: Record<string, unknown>;
    isDisabled: boolean;
    description: string | null;
    containerId: string | null;
    toolOwnerId: string | null;
  }>;
  edges: Array<{
    id: string;
    sourceNodeId: string;
    sourcePort: string;
    targetNodeId: string;
    targetPort: string;
    type: string;
    condition: Record<string, unknown> | null;
  }>;
}
```

`toolOwnerId` 는 제거된 도구 영역 기능의 컬럼을 그대로 옮기는 자리다([AI 에이전트 노드](../CLE-NODE-AI/CLE-NODE-AGENT.md)).

### 복원

`POST /workflows/:id/versions/:versionId/restore`

1. 대상 버전 스냅샷의 형식을 먼저 검사한다. `nodes`·`edges` 가 배열이 아니거나 `name` 이 있는데 문자열이 아니면 400 `INVALID_VERSION_SNAPSHOT` 이다.
2. 통과하면 버전 스냅샷을 `SaveCanvasDto` 로 바꿔 **캔버스 저장과 같은 쓰기 경로(`writeCanvas`)를 쓴다**. 캔버스 저장(`saveCanvas`)과 복원은 이 경로를 함께 쓰고 3·4단계만 다르다. 그래서 복원도 변경 요약 `Restored from vN` 이 붙은 **새 버전**을 만든다. 되감기가 아니라 앞으로 기록하는 것이다.
3. 복원 경로는 저장 사전 검사 가운데 수동 트리거 노드 파라미터 스키마 검사(`INVALID_TRIGGER_PARAMETERS`)를 건너뛴다(`skipLegacyDataGates`). 같은 플래그로 예약 변수명 검사(`validateReservedVariableNames`)도 건너뛴다. 노드 레이블 중복 검사와 노드 간 참조 검사는 복원에서도 돈다.
4. 통합 참조 검사는 건너뛰지 않는다. 다만 걸린 참조로 복원을 거절하지 않고 그 참조를 비운다. 검사 대상은 지금 저장된 같은 id 의 노드와 다른 참조다. 검사는 캔버스 저장과 같은 자리에서 한다. 워크플로우 행을 잠근 뒤 지금 저장된 노드를 읽어 비교한다([워크플로우 데이터와 저장 흐름](CLE-WF-DATA.md) 저장 흐름 3단계). 복원은 저장자 조건을 보지 않고 실행하면 실패할 참조만 비운다. 무엇을 비우고 무엇을 두는지는 [데이터 모델 개요 §참조의 소속](../CLE-PLAT/CLE-PLAT-DATA.md#참조의-소속) 의 「통합 참조」 가 정한다. 고르지 않은 자리가 아닌데 문자열도 아닌 값도 그 규칙에 따라 없는 통합과 같이 비운다.

응답 `data` 는 `{ workflow, nodes, edges }` 에 `clearedIntegrationRefs: [{ nodeId, nodeLabel, field }]` 를 더한 것이다. 비운 것이 없으면 빈 배열이다.

복원이 거부되는 응답은 아래와 같다. 통합 참조 때문에는 거부하지 않는다(4단계). 그 밖에 캔버스 저장과 함께 쓰는 사전 검사가 거부하는 경우는 [워크플로우 데이터와 저장 흐름 「생성과 저장 흐름」](CLE-WF-DATA.md#생성과-저장-흐름) 이 정한다.

| 상태 | 코드 | 언제 | 정의 |
| --- | --- | --- | --- |
| 400 | `INVALID_VERSION_SNAPSHOT` | 버전 스냅샷 형식이 잘못됐다(1단계, `workflows.service.ts` 의 `restoreVersion`). | 이 문서 |
| 409 | `DUPLICATE_NODE_LABEL` | 버전 스냅샷 안에서 노드 레이블이 겹친다. 레이블 중복 검사는 복원에서도 건너뛰지 않는다. | [워크플로우 데이터와 저장 흐름 「생성과 저장 흐름」](CLE-WF-DATA.md#생성과-저장-흐름) |
| 409 | `WORKFLOW_VERSION_CONFLICT` | 새 버전 번호가 동시 저장과 겹쳤다. | 이 문서 [API](#api) |

세 코드는 [에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md) 의 §6.4 유효성 검증 표에도 있다.

### 저장 요청의 변경 요약

`POST /workflows/:id/save` 본문은 선택 필드 `changeSummary?: string` 을 받는다. 서버는 이 값을 새 버전의 변경 요약에 그대로 담고 버전 기록 패널에 그대로 표시한다. 에디터의 수동 저장과 실행 직전 저장은 이 필드를 보내지 않으므로 비어 있다. 서버가 스스로 채우는 변경 요약은 복원이 만드는 `Restored from vN` 하나다([Rationale](#rationale)).

## 데이터

`workflow_version` 테이블은 `id`, `workflow_id`(워크플로우 FK, `ON DELETE CASCADE`), `version`(`(workflow_id, version)` UNIQUE), `snapshot`(jsonb, 위 형식), `change_summary`(text, NULL 허용), `created_by`(사용자 FK), `created_at` 으로 이뤄진다. 컬럼 정의의 기준은 [워크플로우 데이터와 저장 흐름](CLE-WF-DATA.md) 이다.

## 동작 보장

- 캔버스 저장과 버전 생성은 사용자가 볼 때 **원자적으로 보여야** 한다. 트랜잭션 경계는 [미결 사항](#미결-사항) 참조.
- 워크플로우를 지우면 `ON DELETE CASCADE` 로 버전이 모두 함께 지워진다.
- 복원으로 생기는 새 버전의 변경 요약은 항상 `Restored from vN` 형식이다.
- 복원은 통합 참조 때문에 실패하지 않는다. 걸린 참조는 비우고 응답으로 알린다.
- 그래서 복원 결과의 노드 내용은 vN 스냅샷과 다를 수 있다. 변경 요약은 그래도 `Restored from vN` 이다. 차이는 응답 `data.clearedIntegrationRefs` 와 경고로 알린다([데이터 모델 개요](../CLE-PLAT/CLE-PLAT-DATA.md) Rationale).
- 버전 기록에 보이는 버전 번호(vN, `workflow_version.version`)와 워크플로우의 `current_version` 은 한 칸 어긋난다. 이 관계는 [워크플로우 데이터와 저장 흐름](CLE-WF-DATA.md) 의 미결 사항에서 다룬다.

## 미결 사항

- **저장과 버전 생성이 한 트랜잭션인가**: 이 문서의 원문은 "저장할 때마다 서버는 동일 트랜잭션 직후 `workflow_version` 레코드를 만든다" 고 적고, 동작 보장에서 "캔버스 트랜잭션을 커밋한 직후 버전을 만들고 버전 생성이 실패하면 캔버스는 이미 저장된 상태라 다음 저장에서 따라잡는다" 고 적는다. 에디터 원문(저장과 버전의 관계)과 [워크플로우 데이터와 저장 흐름](CLE-WF-DATA.md) 의 원문은 같은 트랜잭션 안에서 만든다고 적는다. 현재 구현(`workflows.service.ts` 의 `writeCanvas`)은 같은 트랜잭션에서 `createVersion` 을 불러 둘 다 커밋하거나 둘 다 되돌린다. 복원도 같은 경로를 쓰므로 같다. 버전 생성이 실패하면 저장 전체를 되돌릴지(한 트랜잭션), 캔버스는 남기고 다음 저장에서 따라잡을지 결정이 필요하다.

## 구현 위치

- `codebase/frontend/src/components/editor/version-history/**` (패널과 다이얼로그. `restore-confirm-dialog.tsx` 가 복원 응답의 비운 참조 목록을 넘겨 둔다)
- `codebase/frontend/src/lib/integrations/cleared-integration-refs.ts` (비운 참조 목록을 `sessionStorage` 로 넘기고 꺼내며 경고할 레이블을 모은다)
- `codebase/frontend/src/app/(editor)/w/[slug]/workflows/[id]/editor-loader.tsx` (다시 불러온 에디터가 복원 경고를 띄운다)
- `codebase/backend/src/modules/workflow-versions/**` (`workflow-versions.service.ts` 의 `createVersion` 이 409 `WORKFLOW_VERSION_CONFLICT` 를 낸다)
- `codebase/backend/src/modules/workflows/workflows.service.ts` (`restoreVersion`, 캔버스 저장과 함께 쓰는 `writeCanvas`)
- `codebase/backend/src/modules/integrations/node-integration-ref-check.ts` (복원의 통합 참조 비우기)
- `codebase/backend/test/integration-personal-use.e2e-spec.ts` (통합 소유자가 멤버에서 빠진 뒤의 복원 e2e)

## Rationale

### 변경 요약을 자동으로 만들지 않는다 (2026-09-19)

한때 캔버스 명세는 "버전에는 자동 생성한 `change_summary` 가 들어간다(예: '노드 3개 추가, 연결선 2개 수정')" 고 적었다. **자동 생성은 없다.** 서버가 스스로 채우는 것은 복원의 `Restored from vN` 하나이고, 저장 API 는 요청의 `changeSummary` 를 그대로 담는다. 에디터(수동 저장, 실행 직전 저장)는 그 필드를 보내지 않는다. 명세가 없는 저장 기능을 약속한 경우라 명세를 현재 동작으로 고쳤다. 자동 요약 기능은 만들지 않기로 했다(사용자 결정, 2026-09-19). 사용자 가이드의 "저장 요청에 `changeSummary` 메모를 넣으면" 안내도 같은 때 고쳤다.

### 스냅샷에 워크플로우 설정을 담지 않는다

버저닝과 복원의 대상은 캔버스와 이름·설명이다. 그래서 버전을 복원해도 `settings` 는 되돌아가지 않는다. 스냅샷 구성과 JSONB 로 둔 근거는 [워크플로우 데이터와 저장 흐름](CLE-WF-DATA.md) 의 Rationale 이 정한다.

### 복원은 걸린 통합 참조를 비우고 끝낸다 (2026-10-24)

NERV Task `CLE-T-MG0EQZ` 에서 사용자는 노드의 통합 참조를 저장할 때 검사하고 복제 · 가져오기는 걸린 참조를 비우기로 정했다(2026-10-24). 버전 복원은 그때 같게 하는 쪽을 권했고 이 문서에서 그대로 정했다. 무엇을 비울지는 같은 날 승인한 초안을 다시 리뷰한 뒤 좁혔다(아래 «저장자 조건을 보지 않는 이유»).

- **거절하지 않는 이유**: 복원은 사용자가 고른 옛 상태를 통째로 되돌리는 작업이다. 스냅샷은 복원 전에 고칠 수 없다. 참조 하나 때문에 거절하면 그 버전으로 돌아갈 길이 없다. 비우면 복원은 끝나고 사용자는 그 노드에서 통합만 다시 고른다.
- **검사를 건너뛰지 않는 이유**: 복원은 이미 수동 트리거 파라미터 검사와 예약 변수명 검사를 건너뛴다(`skipLegacyDataGates`). 통합 참조 검사까지 건너뛰면 검사를 두기 전에 만든 버전을 복원해 그때 들어간 남의 개인 통합 참조를 다시 살릴 수 있다. 다만 복원이 보는 것은 실행 시점 조건뿐이고 저장자 조건은 보지 않는다. 그래서 워크플로우 작성자가 통합 소유자인 참조는 누가 넣었든 살아난다. 저장자 조건은 저장 경로에서만 지킨다([통합 관리 「개인 통합 사용 판정」](../CLE-INT/CLE-INT-MANAGE.md#개인-통합-사용-판정)). 통합 참조 검사는 누가 그 통합을 쓸 수 있는지를 지키는 검사다. 그래서 노드 참조의 워크스페이스 검사처럼 복원에서도 돈다.
- **저장자 조건을 보지 않는 이유**: [통합 관리](../CLE-INT/CLE-INT-MANAGE.md) Rationale 의 «버전 복원은 실행 시점 판정으로만 참조를 비운다» 에 있다(finding 01a16e29-19e4-771c-b6ed-0f12972f4318).
- **받아들인 잔여**: 통합 소유자가 워크스페이스를 떠난 뒤 복원하면 그 사람의 개인 통합 참조 가운데 지금 노드와 다른 것은 비워진다. 실행해도 실패할 참조다. 강제 전에 워크플로우 작성자가 아닌 사용자가 워크플로우 작성자의 개인 통합을 넣어 저장한 버전은 복원해도 그 참조가 남는다. 2026-10-24 운영 실측은 이런 참조를 따로 세지 않았다.
- **경고 목록을 다시 불러오기 너머로 넘기는 이유** (2026-10-25 구현): 복원이 성공하면 에디터는 페이지를 다시 불러온다(REQ-WFVER-016). 다시 불러오면 에디터의 메모리 상태가 모두 사라진다. 그래서 응답의 `clearedIntegrationRefs` 를 경고를 띄울 때까지 들고 갈 수단이 따로 있어야 한다. 비운 참조를 알리지 않으면 사용자는 실행해 보고 나서야 노드가 비었다는 것을 안다. 이것은 복제 · 가져오기가 비운 참조를 경고로 알리는 이유와 같다([워크플로우 목록과 폴더](CLE-WF-LIST.md) 의 「가져오기·복제는 쓸 수 없는 통합 참조를 비우고 경고한다」 Rationale).
- **같은 탭 `sessionStorage` 를 쓰는 이유**: 키는 `clemvion.restoreClearedIntegrationRefs:<workflowId>` 다(`cleared-integration-refs.ts`). `sessionStorage` 는 같은 탭에서만 읽히고 탭을 닫으면 사라진다. 그래서 다른 탭이나 다음 방문에 지난 경고가 뜨지 않는다. 키를 워크플로우마다 따로 두므로 다른 워크플로우의 에디터가 그 목록을 꺼내지 않는다. 다시 불러온 에디터가 꺼내면서 바로 지우므로 경고는 한 번만 뜬다. 넘기는 값은 `nodeId` · `nodeLabel` · `field` 뿐이다. 구현할 때 다른 전달 수단(다시 불러오지 않고 상태만 새로 고치는 안, URL 쿼리, 서버에 남기는 안)을 견준 기록은 남아 있지 않다. 다시 불러오기를 없애는 안은 REQ-WFVER-016 의 동작을 바꾸므로 이 문서의 결정을 다시 열어야 한다.
- **경고 전달의 받아들인 잔여**: 사생활 보호 모드처럼 브라우저 저장소를 막은 환경에서는 넣지도 꺼내지도 못해 경고만 빠진다. 다시 불러오기가 끝나기 전에 탭을 닫아도 경고만 빠진다. 다시 불러오기가 끝나기 전에 같은 탭에서 다른 화면으로 옮기면 그 워크플로우 에디터를 다음에 열 때 경고가 뜬다. 어느 경우든 비운 결과는 복원 응답과 저장된 노드 상태에 남는다. 비워진 노드는 통합을 고르지 않은 상태로 보이므로 사용자는 그 노드를 열면 알 수 있다.
