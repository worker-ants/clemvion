---
title: "요청 본문의 참조 id 가 다른 워크스페이스(또는 다른 워크플로)를 가리켜도 저장된다 — 저장 전 소속 검사"
status: in-progress
owner: developer
worktree: cross-workspace-refs
spec_impact:
  - spec/1-data-model.md
  - spec/2-navigation/1-workflow-list.md
  - spec/data-flow/11-workflow.md
  - spec/data-flow/12-workspace.md
  - spec/3-workflow-editor/0-canvas.md
started: 2026-09-27
---

# 교차 워크스페이스 참조 — 저장 전 소속 검사

트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` «PATCH null 후속» 의 네 번째 칸 «교차 워크스페이스 참조(미검증 ·
보안 성격)» 를 닫는다. 그 칸은 `workflows.folderId` · `nodes.containerId`·`toolOwnerId` · assistant `llmConfigId` 네 필드를 곁눈으로 봤을
뿐이라, 착수하면서 **쓰기 요청 본문의 참조 id 전부**로 넓혀 다시 셌다(열거 축 = «요청이 무엇을 하는가»: 클라이언트가 보낸 id 를 컬럼에
그대로 저장하는 쓰기).

## 전수 (2026-09-27, `origin/main` `67303d179` — 읽기 전용 조사 에이전트 둘, 소스 판독)

- 범위: `codebase/backend/src/modules/**/dto` DTO 104개, 쓰기 라우트 112개 + folders · workflows · nodes · edges.
- 공통 계층(가드 · 파이프 · 인터셉터 · subscriber · 복합 FK · DB 트리거)에 이 검사를 대신하는 장치는 **없다**.

### 저장 전 검사가 **있는** 자리 (대조군)

트리거 `authConfigId`(create · update, `assertAuthConfigInWorkspace`) · 폴더 PATCH `parentId`(`validateParentChange`) · 어시스턴트 세션
`workflowId`(`ensureWorkflowBelongsToWorkspace`) · 지식 베이스 `embeddingModelConfigId`(create · update, `findEntity(id, workspaceId, 'embedding')`) ·
워크스페이스 이양 `newOwnerMemberId` · 통합 `previewToken` · OAuth begin `integrationId`(reauthorize · request_scopes) · 노드 단건 실행
`previousExecutionId`(같은 워크플로).

### 저장 전 검사가 **없는** 자리

읽는 쪽이 워크스페이스로 거르는지에 따라 둘로 가른다 — 앞쪽은 교차 참조가 **다른 워크스페이스에 실제로 작용**하고, 뒤쪽은 끊긴 참조로
남아 실패하거나 조용히 강등될 뿐이다(소스 판독 — 아래 §실측 이 앞쪽을 잰다).

**(X) 다른 워크스페이스에 작용한다**

| 요청 | 필드 | 읽는 쪽 | 추정 결과 |
|---|---|---|---|
| `POST /api/triggers` | `workflowId` | 웹훅 `hooks.service` → `execution-engine.service.ts` `execute()` 의 `findOneBy({ id })` · 목록/상세의 `t.workflow` 조인 | 남의 워크플로가 **그 워크스페이스의 실행으로** 돈다(자격증명 · LLM 설정도 그쪽 것). 목록 응답에 남의 워크플로 `{ id, name }` |
| `POST /api/schedules` | `workflowId` | cron tick · 지금 실행 → `execute(workflowId)` · `t.workflow` 조인 | 위와 같음 |
| `POST /api/workflows/:id/save`(캔버스 저장) | `nodes[].id` | `syncNodes` 가 자기 워크플로에 없는 id 를 «신규» 로 `manager.create(Node, { id, workflowId, … })` → `manager.save` | TypeORM `save` 는 id 로만 조회해 행이 있으면 UPDATE — **다른 워크플로(다른 워크스페이스 포함)의 노드 행을 이쪽으로 옮기고 덮어쓴다** |

**(D) 끊긴 참조로 남는다 — 읽는 쪽이 거른다**

| 요청 | 필드 | 읽는 쪽이 거르는 방법 | 부수 영향 |
|---|---|---|---|
| `POST /api/alerts` | `workflowId` | 평가 SQL 이 `w.workspace_id = rule.workspaceId` | 결과 0건 |
| `POST · PATCH /api/workflows` | `folderId` | 목록이 `w.workspace_id` | FK `ON DELETE SET NULL` — 상대가 폴더를 지우면 이쪽 워크플로의 폴더가 비워진다. `duplicate` 가 그대로 복사 |
| `POST /api/folders` | `parentId` | 목록 · 서브트리가 `workspaceId` | FK `ON DELETE CASCADE` — 상대가 폴더를 지우면 **이쪽 폴더 서브트리가 함께 삭제**된다. PATCH 는 이미 검사한다(spec `1-workflow-list.md` §3.x 는 생성도 같은 검증이라 적는다) |
| `POST /api/workflows/:workflowId/nodes` · `PATCH /api/nodes/:id` · 캔버스 저장 | `containerId` · `toolOwnerId` | 엔진 · graph-builder 가 워크플로 단위로 읽은 노드 안에서만 매칭 | 다른 곳을 가리키면 그 노드는 조용히 실행되지 않는다. FK `SET NULL` |
| `POST /api/workflows/:workflowId/edges` · 캔버스 저장 | `sourceNodeId` · `targetNodeId` | 엔진이 자기 워크플로 노드만 남긴다 | FK `ON DELETE CASCADE` · UNIQUE `(source_node_id, source_port, target_node_id, target_port)` 에 `workflow_id` 가 없어 **남의 연결 튜플을 선점**하면 상대의 캔버스 저장이 409. 없는 id 는 23503 → 500 |
| `POST · PATCH /api/workflow-assistant/sessions` | `llmConfigId` | `resolveConfig` → `findEntity(id, workspaceId, 'chat')` | 실패 |
| `POST · PATCH /api/knowledge-bases` | `extractionLlmConfigId` · `rerankConfigId` · `rerankLlmConfigId` | `resolveConfig(id, workspaceId, kind)` | 그래프 추출 실패 · rerank 는 warn 만 남기고 cosine 순서로 조용히 강등 |

같은 워크스페이스라도 **다른 워크플로**를 가리키는 `containerId` · `toolOwnerId` · 엣지 끝점 · 캔버스 노드 id 는 의미상 틀렸다(같은 워크플로여야
한다) — 검사 범위를 워크플로로 잡는다.

### 이 PR 밖으로 넘기는 것

- **트리거 `config` 안의 비밀 참조**(`chatChannel.botTokenRef` · `inboundSigningRef` · `notification.signing.secretRef`) — 타입 필드
  `chatChannel` 의 금지 검사가 원시 `config` 에는 걸리지 않고, `secret-resolver.service.ts` `resolve` 는 `ref` 만 본다(소스 판독). 참조가 id 가
  아니라 JSONB 안의 문자열이고 chat-channel 의 비밀 정책(R-CC-21 · §5.4.1)이 얽혀 있어 따로 잰다 → 트래커 새 항목.
- **API 문서 셋의 `spec/1-data-model.md` §1.1 미러**(`2-trigger-list.md` · `3-schedule.md` · `9-user-profile.md`, 그리고 KB 설정 참조의
  `5-knowledge-base.md`) — 구현이 착지한 뒤 planner 턴으로. 추적: 트래커 «교차 워크스페이스 참조 후속» 의 planner 불릿(`--impl-prep`
  `21_03_31` W1).
- **OAuth begin `mode=new` 에 실린 `integrationId`** — state 에 저장되지만 new 콜백은 그 값을 쓰기 전에 끝난다(소스 판독, 콜백 일부만 읽음).
- **실행 경로의 방어선** — `execute()` 가 `findOneBy({ id })` 로 워크플로를 읽는다. 저장 전 검사로 새 교차 행은 막히지만, 이미 저장된
  행이 있다면 계속 돈다. 운영 데이터 점검 쿼리와 실행 시점 방어선을 둘지는 트래커로.

## 처방

- **(X) · (D) 전부 저장 전에 거부한다** — 규칙 · 에러는 `spec/1-data-model.md` §1.1(같은 PR 의 planner 턴이 신설): 400
  `VALIDATION_ERROR` + `details: [{ field, message, code: 'INVALID_FIELD' }]`(**배열** — 캔버스 저장 · 엣지 생성은 틀린 필드를 전부 싣는다).
  모델 설정 참조(어시스턴트 `llmConfigId` · KB 셋)는 기존 검증기 `findEntity(id, workspaceId, kind)` 를 재사용해 404
  `MODEL_CONFIG_NOT_FOUND` — 같은 KB 요청의 `embeddingModelConfigId` 가 이미 그렇다. 없는 id 와 남의 id 를 구분하지 않는다.
  폴더 PATCH `parentId` 의 기존 거부도 같은 배열 `details` 를 싣는다(종전 `details` 없음).
- 폴더 `parentId` 는 **생성 경로에 소속 검사를 더한다** — PATCH 의 `validateParentChange` 와 같은 조회.
- 캔버스 저장:
  - `nodes[].id` 가 이 워크플로에 없으면 **어디에도 없는 id** 여야 한다(새 노드). 다른 행이 이미 쓰는 id 면 `nodes[i].id` 로 400. 프런트는
    새 노드 · 붙여넣기 · 복제 때 `crypto.randomUUID()` 로 id 를 새로 발급하므로(`editor-store.ts` `idRemap`) 정상 흐름은 걸리지 않는다.
  - `containerId` · `toolOwnerId` · 엣지 끝점은 **이번 페이로드의 노드 id 집합** 안이어야 한다(저장 뒤 워크플로의 노드가 정확히 그
    집합이다 — 페이로드에 없는 노드는 지워진다).

## 실측 — 고치기 전 코드 (`_test_logs/e2e-20260927-195807.log`, 18 failed / 479)

새 e2e `test/cross-workspace-references.e2e-spec.ts` 를 고치기 **전** 코드로 돌렸다(A = 요청자, B = 상대).

- **임시 프로브 2건 — 둘 다 추정대로 재현(통과)** — 실측 뒤 파일에서 지웠다.
  - A 가 B 의 워크플로로 웹훅 트리거를 만들면 201, 그 경로를 부르면 202, 생긴 `execution.workflow_id` 가 B 의 워크플로. A 의
    `GET /api/triggers` 응답에 B 워크플로 id.
  - A 가 캔버스 저장에 B 의 노드 id 를 새 노드로 실으면 200, B 의 노드 행이 A 의 워크플로로 옮겨지고 라벨이 덮인다.
- **거부를 기대한 18케이스 — 전부 RED.** 201/200 14건. 500 4건은 앞 케이스의 200 이 만든 상태 때문이다 — 캔버스 저장이 B 의 노드를
  옮긴 뒤 다음 저장이 그 노드를 지워(페이로드에 없으면 삭제) 이어진 `containerId` · `toolOwnerId` · 엣지 끝점 캔버스 케이스가 FK 위반,
  앞 케이스가 `containerId` 를 넣어 둔 노드에 `toolOwnerId` 를 더한 노드 PATCH 가 CHECK `chk_node_placement` 위반.

## `--impl-prep` · planner 턴 처분

- `--impl-prep` `review/consistency/2026/09/27/19_43_46` **BLOCK: YES** — Critical 2(폴더 생성 «같은 워크스페이스» 서술이 코드에 없음 ·
  캔버스 저장 «검증 없이 저장» 계약을 처방이 깸). 둘 다 spec 쓰기라 **같은 PR 의 planner 턴**으로 해소했다: draft
  `plan/complete/spec-draft-cross-workspace-refs.md` → `--spec` `20_05_26` BLOCK: NO → `a8bfd1492`(`1-data-model.md` §1.1 신설 외 4파일).
  W1(Trigger · Schedule 제약 문구) → §2.8 · §2.9 에 반영. W2(«이 PR 밖» 두 항목 트래커 미등재) → 트래커 새 항목 «교차 워크스페이스
  참조 후속».
- `--spec` W1(`details` 단일 객체 → 배열) · W2(AlertRule §2.25) · INFO 1 · 5 → draft 에 반영하고 적용. W3 → 위 트래커 항목.
- `--impl-prep` 재실행 `20_21_21` **BLOCK: YES** — Critical 1: planner 턴의 `1-workflow-list.md` 서술이 구현보다 먼저 착지했는데
  `pending_plans` 가 없고 Rationale 이 아직 없는 `plan/complete/…` 를 완료형으로 인용. → planner 턴 2: draft
  `plan/complete/spec-draft-cross-workspace-refs-2.md` → `--spec` 세 번(`20_35_40` BLOCK: YES — `0-canvas.md` 에도 같은 결함 ·
  `20_45_35` BLOCK: YES — 제가 쓴 «`1-data-model.md` 승격은 가드가 강제» 가 거짓(그 파일은 `EXCLUDE_BASENAMES`) · `20_56_04`
  BLOCK: NO) → `18f235a81`(`1-workflow-list` · `0-canvas` `pending_plans` 에 이 plan, Rationale 현재형 · in-progress 경로).
  W2(PATCH `parentId` `details` 형태) → 아래 구현이 맞춘다. W3 · INFO 1(API 문서 셋의 §1.1 미러) · W4(트래커 «닫음» 경로) → 트래커.

## 뮤턴트 — 예측 / 실측 (`c2c97de24`, 단위 단계 · `shutil.copy` 원복)

| # | 뮤턴트 | 예측 | 실측 · 죽인 테스트 |
|---|---|---|---|
| M1 | 헬퍼 `assertReferenceInScope` 가 조회도 거부도 안 함 | 헬퍼 2 + 그 헬퍼를 쓰는 서비스들의 거부 케이스 | KILLED 8 — 헬퍼 2 · 워크플로 `folderId` 생성 · 수정 2 · 트리거 1 · 스케줄 1 · 폴더 생성 · 수정 2 |
| M2 | 트리거 `where` 에서 `workspaceId` 제거(= 존재 확인으로 줄어듦) | 트리거 where 단언 1 | KILLED 1 |
| M3 | 캔버스 새 노드 id 충돌 조회 제거 | 충돌 거부 · 기존 id 제외 2 | KILLED 2 |
| M4 | 캔버스 엣지 끝점 검사 제거 | 페이로드 참조 목록 1 | KILLED 1 |
| M5 | 노드 `where` 에서 `workflowId` 제거 | 생성 `containerId` · 수정 `toolOwnerId` 2 | KILLED 2 |

M2~M5 는 서로 다른 테스트를 죽이도록 골라 한 번에 돌렸다(6건 — 예측 합과 같다).

## 테스트 설계

- e2e `test/cross-workspace-references.e2e-spec.ts` — 필드마다 A 의 요청에 B 의 id → 400 + `details[].field`. 같은 워크스페이스 다른 워크플로도
  (워크플로 범위 필드). 캔버스 저장은 거부 뒤 **B 의 노드가 그대로인지**까지.
- 단위 — 서비스별 검사 헬퍼(조회 조건에 `workspaceId` · `workflowId` 가 실리는지, 없으면 400 형태).
- 뮤턴트 — 검사 한 줄씩 빼서 그 행만 RED.

## 체크리스트

- [x] 전수 — 읽기 전용 조사 둘, (X) 3 · (D) 7 요청 · 대조군 8
- [x] `--impl-prep` — 19_43_46 · 20_21_21 BLOCK: YES → planner 턴 두 번(`a8bfd1492` · `18f235a81`) → `21_03_31` **BLOCK: NO**(W1 → 위 «이 PR 밖», W2 → 트래커 planner 불릿)
- [x] 실측(고치기 전 e2e) — 18 RED · 프로브 2 재현
- [x] 구현 · 단위 · CHANGELOG · 트래커 — `c2c97de24`
- [x] 뮤턴트 — M1~M5 전부 KILLED
- [x] TEST WORKFLOW — lint · unit · build · e2e 전부 PASS, e2e 477(`_test_logs/e2e-20260927-213723.log` — 새 18케이스 · 캔버스 왕복 `workflow-crud` 포함). 첫 lint 는 새 테스트의 catch 매개변수 이름 13건 → 고치고 lint 부터 재실행
- [ ] `/ai-review`
- [ ] `--impl-done`
