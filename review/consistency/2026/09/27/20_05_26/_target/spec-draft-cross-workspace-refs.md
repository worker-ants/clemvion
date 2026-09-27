---
title: "spec draft — 요청 본문 참조 id 의 소속(워크스페이스 · 워크플로)을 저장 전에 본다"
status: in-progress
owner: project-planner
worktree: cross-workspace-refs
spec_impact:
  - spec/1-data-model.md
  - spec/2-navigation/1-workflow-list.md
  - spec/data-flow/11-workflow.md
  - spec/data-flow/12-workspace.md
  - spec/3-workflow-editor/0-canvas.md
started: 2026-09-27
---

# spec draft — 요청 본문 참조 id 의 소속 검사

`plan/in-progress/cross-workspace-refs.md` 의 `--impl-prep`(`review/consistency/2026/09/27/19_43_46`)이 **BLOCK: YES** 였다:

1. `spec/2-navigation/1-workflow-list.md` §3.1 · `## Rationale` §3 이 폴더 **생성**도 «같은 워크스페이스» 를 검증한다고 적는데 코드는
   깊이만 본다(아래 §실측 — 201).
2. `spec/data-flow/11-workflow.md` §1.2 각주가 «캔버스 저장은 `container_id`/`tool_owner_id` 를 **검증 없이** 그대로 저장한다» 고
   계약한다 — 구현 plan 의 처방(저장 전 소속 검사)이 그 문장을 착지 즉시 거짓으로 만든다.

W1: `spec/1-data-model.md` §2.8 · §2.9 에 Folder §2.5 와 대칭되는 «같은 워크스페이스» 제약이 없다.

이 draft 는 규칙을 한 자리(데이터 모델 §1.1 신설)에 적고, 위 두 문장과 관련 표를 그 규칙에 맞춘다. 결정의 근거는
`spec/data-flow/12-workspace.md` `## Rationale` 새 절에 둔다.

## 실측 — 고치기 전 코드 (`_test_logs/e2e-20260927-195807.log`, 18 failed / 479)

구현 plan 의 새 e2e(`codebase/backend/test/cross-workspace-references.e2e-spec.ts`)를 고치기 **전** 코드로 돌렸다. 두 워크스페이스
A(요청자) · B(상대).

- **프로브 2건 — 둘 다 추정대로 재현됐다.**
  - A 가 B 의 워크플로로 웹훅 트리거를 만들면 **201**, 그 경로를 부르면 **202**, 생긴 `execution` 행의 `workflow_id` 가 **B 의 워크플로**다.
    A 의 `GET /api/triggers` 응답에 B 워크플로 id 가 실린다.
  - A 가 캔버스 저장에 B 의 노드 id 를 새 노드로 실으면 **200**, B 의 노드 행이 **A 의 워크플로로 옮겨지고** 라벨이 덮인다.
- **거부를 기대한 18케이스 — 전부 RED.** 201/200 이 14건(트리거 · 스케줄 · 알림 규칙의 `workflowId`, 워크플로 생성 · 수정의
  `folderId`, 폴더 생성의 `parentId`, 어시스턴트 세션 생성 · 수정의 `llmConfigId`, 노드 생성 · 수정의 `containerId`, 엣지 생성의 두
  끝점, 캔버스 저장의 노드 id 둘). 500 이 4건 — 앞 케이스의 200 이 만든 상태 때문이다: 캔버스 저장이 B 의 노드를 옮긴 뒤 다음
  저장이 그 노드를 지워(페이로드에 없으면 삭제) 이어진 `containerId` · 엣지 끝점 케이스가 FK 위반, 앞 케이스가 `containerId` 를
  넣어 둔 노드에 `toolOwnerId` 를 더해 CHECK `chk_node_placement` 위반.

## 변경안

### A. `spec/1-data-model.md`

**A1. §1 아래에 `### 1.1 참조의 소속` 신설** (엔티티 관계도 바로 뒤):

> 클라이언트가 요청 본문으로 보내 **컬럼에 저장되는 참조 id** 는 요청자의 **워크스페이스** 행만 가리킨다. 워크플로 안의 구조
> 참조 — 노드 `container_id` · `tool_owner_id`, 엣지 끝점, 캔버스 저장이 새 노드로 싣는 노드 `id` — 는 **같은 워크플로** 행만
> 가리킨다. 서버는 이것을 **저장 전에** 거부한다. 실행 · 조회 경로가 워크스페이스로 거르는지에 기대지 않는다 — 실행 엔진은
> 워크플로를 id 로만 읽는다.
>
> | 요청 본문 필드 | 가리키는 행 | 범위 |
> |---|---|---|
> | 트리거 생성 `workflowId` · 스케줄 생성 `workflowId`(연결 트리거의 `workflow_id` 가 된다) · 알림 규칙 생성 `workflowId` | Workflow | 워크스페이스 |
> | 워크플로 생성 · 수정 `folderId` · 폴더 생성 · 수정 `parentId` | Folder | 워크스페이스 |
> | 트리거 생성 · 수정 `authConfigId` | AuthConfig | 워크스페이스 |
> | 어시스턴트 세션 생성 · 수정 `llmConfigId` · 지식 베이스 생성 · 수정 `embeddingModelConfigId` · `extractionLlmConfigId` · `rerankConfigId` · `rerankLlmConfigId` | ModelConfig(각 필드의 `kind`) | 워크스페이스 |
> | 노드 생성 · 수정 `containerId` · `toolOwnerId` · 엣지 생성 `sourceNodeId` · `targetNodeId` | Node | 같은 워크플로 |
> | 캔버스 저장 `nodes[].containerId` · `nodes[].toolOwnerId` · `edges[].sourceNodeId` · `edges[].targetNodeId` | Node | **이번 페이로드의 노드**(저장 뒤 워크플로의 노드가 정확히 그 집합이다) |
> | 캔버스 저장 `nodes[].id` 중 이 워크플로에 없는 것 | — | 어느 행도 쓰지 않는 id(새 노드). 다른 행이 쓰는 id 면 거부 — 그 행을 덮어쓰지 않는다 |
>
> **거부 응답**: 400 `VALIDATION_ERROR` + `details: { field, code: 'INVALID_FIELD' }`(캔버스 저장은 `nodes[i].id` 처럼 파이프와 같은
> 경로 표기). 예외 둘 — 모델 설정 참조는 기존 검증기(`findEntity(id, workspaceId, kind)`)를 그대로 써서 404 `MODEL_CONFIG_NOT_FOUND`,
> 트리거 `authConfigId` 는 400 `AUTH_CONFIG_NOT_FOUND`(`spec/5-system/3-error-handling.md` §1.11). 없는 id 와 남의 id 를 구분하지 않는다.
> 근거: `spec/data-flow/12-workspace.md` `## Rationale` «본문 참조 id 도 저장 전에 소속을 본다».

**A2. §2.4 Workflow `folder_id` 행**: `FK → Folder (SET NULL · 정리용). 같은 워크스페이스의 폴더만(§1.1)`.

**A3. §2.6 Node 제약 조건에 한 줄**: `container_id` · `tool_owner_id` 는 **같은 워크플로**의 노드만 가리킨다 — 저장 시점에 거부한다(§1.1).
아래 type · 순환 · 트리거 자식 검사는 여전히 실행 시점 몫이다. (기존 불릿 순서상 CHECK 제약 줄 바로 뒤.)

**A4. §2.7 Edge 제약 조건 셋째 불릿**: `source_node와 target_node는 같은 workflow_id에 속해야 함 — 저장 시점에 거부(§1.1)`.

**A5. §2.8 Trigger `workflow_id` 행**: `FK → Workflow (CASCADE). 같은 워크스페이스의 워크플로만(§1.1)`.

**A6. §2.9 Schedule 표 아래 한 줄**: 스케줄 생성 요청의 `workflowId` 는 연결 트리거의 `workflow_id` 가 된다 — §2.8 과 같은 제약(§1.1).

### B. `spec/2-navigation/1-workflow-list.md`

**B1. §3 `POST /api/workflows` 행**: `새 워크플로우 생성. folderId 는 같은 워크스페이스의 폴더만 — 아니면 400 VALIDATION_ERROR
(details.field='folderId', 데이터 모델 §1.1)`.
**B2. `PATCH /api/workflows/:id` 행**: `워크플로우 수정 (이름, 상태 등). folderId 는 생성과 같은 검사`.
**B3. §3.1 `POST /api/folders` 행**: 깊이 문장 앞에 `parentId 가 같은 워크스페이스의 폴더가 아니면 400 VALIDATION_ERROR
(details.field='parentId')`.
**B4. `PATCH /api/folders/:id` 행**: «새 부모가 같은 워크스페이스에 없거나» 뒤에 `(details.field='parentId')`.
**B5. `## Rationale` §3 끝에 정정 한 단락**: (2026-09-27 정정) 이 결정 뒤에도 **생성** 경로는 깊이만 봤다 — 다른 워크스페이스의
부모를 `getDepth` 가 «없음» 으로 읽어 깊이 1 로 통과시켰다(고치기 전 e2e 201). `plan/complete/cross-workspace-refs.md` 가 생성에도 소속
검사를 더했다 — 규칙은 데이터 모델 §1.1.

### C. `spec/data-flow/11-workflow.md`

**C1. §1.2 표 아래 각주 교체**:

> 위 표의 `container.type` / `CONTAINER_INVALID_CHILD` / `CONTAINER_CYCLE` 검증은 **편집·저장 시점이 아니다** — (a) 실행 엔진
> 런타임(`execution-engine.service.ts`)과 (b) Assistant 의 `ShadowWorkflow` 가 수행한다. 저장 경로(`saveCanvas` · 노드 API)가 저장
> 시점에 보는 것은 **참조의 소속**뿐이다 — `container_id` · `tool_owner_id` 는 같은 워크플로의 노드(캔버스 저장은 이번 페이로드의
> 노드)여야 하고, 아니면 400 `VALIDATION_ERROR`(데이터 모델 §1.1). DB 단 강제는 CHECK `chk_node_placement`(둘 다 set 금지)뿐이다.

**C2. §2.1 표**:
- `workflow` 생성 행의 제약 칸 앞에: `folder_id 는 같은 워크스페이스 폴더만(저장 전 거부)`.
- `node` 추가 행의 제약 칸에: `container_id / tool_owner_id 는 같은 워크플로 노드만(저장 전 거부). 캔버스 저장이 새 노드로 싣는 id 가
  다른 행의 id 면 거부(그 행을 덮어쓰지 않는다)`.
- `node` 컨테이너 / Tool Area 배치 행의 제약 칸: `같은 워크플로 노드만 — 저장 전 거부(데이터 모델 §1.1). cycle 검사는 런타임·Assistant
  ShadowWorkflow 에서 (CONTAINER_CYCLE, §1.2 각주)`.
- `edge` 추가 행의 제약 칸 앞에: `끝점은 같은 워크플로 노드만(저장 전 거부)`.

### D. `spec/3-workflow-editor/0-canvas.md`

**D1. §11.2.2 제약 표에 행 추가** (첫 행 앞):

> | 같은 워크플로의 노드만 | `containerId` · `toolOwnerId` 와 엣지 끝점은 이 워크플로의 노드만 가리킨다. 캔버스 저장은 이번 페이로드에 없는 노드를 가리키면 400 `VALIDATION_ERROR`(`details.field` 예: `nodes[2].containerId`) — 위 엣지 기반 재계산은 늘 페이로드 안의 노드를 가리키므로 정상 편집에서는 걸리지 않는다 |

**D2. §(저장 API 행)**: «현재 노드/엣지 전체 스냅샷을 저장» 뒤에 `새 노드 id 는 클라이언트가 발급한 UUID 다(붙여넣기 · 복제도 새로 발급) — 다른
워크플로의 노드가 쓰는 id 면 저장이 400 이다`.

### E. `spec/data-flow/12-workspace.md` `## Rationale` 새 절 — «경로 파라미터 워크스페이스도 가드가 본다» 뒤

**### 본문 참조 id 도 저장 전에 소속을 본다 (2026-09-27)**

> 가드(헤더 · 토큰 · 경로 파라미터)는 **요청이 어느 워크스페이스에서 도는지**를 본다. 요청 **본문**이 다른 행을 가리키는 id 는
> 보지 않는다 — 그건 서비스가 저장할 때 볼 몫인데, 2026-09-27 전수(쓰기 요청 본문의 참조 id, 소스 판독)에서 **10개 묶음(요청 ·
> 필드)이 그 id 를 그대로 저장**했다. 대조군은 트리거 `authConfigId` · 폴더 PATCH `parentId` · 지식 베이스 `embeddingModelConfigId` 등 8자리.
>
> 고치기 전 e2e 가 둘을 재현했다: A 가 B 의 워크플로로 웹훅 트리거를 만들면 201, 부르면 202 로 **B 의 워크플로가 실행**됐고(실행
> 엔진은 워크플로를 id 로만 읽는다 — 실행의 워크스페이스 · 자격증명이 그 워크플로 쪽이다), A 의 트리거 목록에 B 워크플로가 실렸다.
> 캔버스 저장에 B 의 노드 id 를 실으면 200 으로 **B 의 노드 행이 A 로 옮겨졌다** — 자기 워크플로에 없는 id 를 «신규» 로 만들어
> `save` 하는데, TypeORM `save` 는 id 로만 행을 찾아 있으면 UPDATE 한다. 나머지는 끊긴 참조로 남았다 — 소스 판독으로는 FK
> `ON DELETE` 로 상대의 삭제가 이쪽 행을 비우고(폴더 `parent_id` 는 CASCADE 라 함께 지운다), 엣지 UNIQUE 에 `workflow_id` 가 없어
> 남의 연결 튜플을 선점할 수 있다(둘 다 재지 않았다).
>
> - **왜 저장 시점인가**: 읽는 쪽이 거르는 자리(모델 설정 `findEntity(id, workspaceId, kind)`)도 있지만 실행 엔진은 거르지 않는다.
>   읽는 자리마다 필터를 기대하는 것은 위 절이 «74번째 라우트» 로 기각한 모양 그대로다 — 저장이 입구 하나다.
> - **에러**: 400 `VALIDATION_ERROR` + `details.field`. 본문의 교차 참조는 «리소스 부재가 아니라 입력값 유효성» 이라는
>   `5-system/3-error-handling.md` §1.11 의 판단을 따른다. 그 절의 `AUTH_CONFIG_NOT_FOUND` 는 top-level 이 도메인 코드인 **예외**이고,
>   `details[].code` 를 실은 다른 자리는 `VALIDATION_ERROR` 가 다수다 — 새 자리는 다수를 따른다. 없는 id 와 남의 id 를 구분하지 않는다.
> - **모델 설정 참조만 404**: 지식 베이스 `embeddingModelConfigId` 가 이미 `findEntity` 로 404 `MODEL_CONFIG_NOT_FOUND` 를 낸다. 같은
>   요청의 `rerankConfigId` 등이 400 이면 한 본문 안에서 필드마다 코드가 갈린다 — 같은 검증기를 재사용한다.
> - **캔버스 저장 노드 id 는 존재 신호를 준다**: 새 id 는 통과하고 쓰이는 id 는 거부하므로 «있다 · 없다» 가 갈린다. 그 UUID 를 이미
>   쥔 사람에게만 의미가 있고(v4 라 추측 불가), 대안이었던 «충돌한 id 를 서버가 조용히 재발급» 은 같은 페이로드의 `containerId` ·
>   엣지가 가리키는 id 와 클라이언트가 쥔 id 를 어긋나게 한다.
> - **실행 시점 격리와는 다른 층이다**: 서브 워크플로 호출의 `WORKFLOW_FORBIDDEN_WORKSPACE`(`4-nodes/2-flow/1-workflow.md` W-6)는
>   **실행 중** 노드 설정이 가리키는 워크플로를 막는다. 이 절은 **저장 시점** 요청 본문이다.
> - **남긴 것**: 트리거 `config` JSONB 안의 비밀 참조(`secret://…`, id 가 아닌 문자열)와, 이미 저장된 교차 행에 대한 실행 시점
>   방어선 · 운영 데이터 점검은 이 결정 밖이다 — `plan/in-progress/spec-draft-nullable-notation-followups.md`.

## Rationale

- **규칙을 데이터 모델 §1.1 한 자리에**: 참조 제약은 이미 데이터 모델이 엔티티별로 적는다(Folder `parent_id` «같은 워크스페이스»,
  Edge «같은 workflow_id»). 요청 필드 → 가리키는 행 → 범위를 한 표로 모아야 다음 참조 필드가 생길 때 넣을 자리가 보인다. API
  문서(`2-trigger-list.md` · `3-schedule.md` · `9-user-profile.md` · `4-ai-assistant.md` · `5-knowledge-base.md`)는 이번에 건드리지 않는다 —
  그 문서들은 이 검사를 부정하지 않고, `--impl-prep` 이 짚은 두 문장(1-workflow-list · 11-workflow)만 규칙과 어긋났다.
- **`_NOT_FOUND` 코드를 새로 만들지 않는다**: `3-error-handling.md` §1.11 이 `AUTH_CONFIG_NOT_FOUND` 의 400 을 «이 저장소에서 유일한
  예외» 로 적고 개명 여부를 따로 추적한다. 새 자리에 `WORKFLOW_NOT_FOUND`(400) 같은 코드를 만들면 그 예외가 늘어난다.
