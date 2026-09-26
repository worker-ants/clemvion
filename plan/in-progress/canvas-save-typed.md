---
title: "캔버스 저장 · 버전 복원 응답의 `nodes`/`edges` 를 `NodeDto`/`EdgeDto` 로 선언하고 와이어 계약을 건다"
status: in-progress
owner: developer
worktree: canvas-save-typed
spec_impact: none
started: 2026-09-26
---

# 캔버스 저장 응답 `nodes`/`edges` 타입 선언

트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 항목 «`CanvasSaveResultDto.nodes`/`.edges` 가 타입 없는 객체
배열» 을 닫는다.

## 실측 (2026-09-26, origin/main `e20756844`)

- 선언: `CanvasSaveResultDto` 의 `nodes` · `edges` 는 `@ApiProperty({ type: 'array', items: { type: 'object' } })` 다. 응답 계약
  검증자는 `type: 'object'` 안으로 내려가지 않는다 → 원소에 무엇이 실려도 통과한다. 같은 DTO 의 `workflow` 는 이미 `WorkflowDto` 다.
- 소비 엔드포인트 둘: `POST /workflows/:id/save`(`saveCanvas`) · `POST /workflows/:id/versions/:versionId/restore`
  (`restoreVersion` → `saveCanvas` 재사용).
- 생산자: `saveCanvas` 는 엔티티를 그대로 돌려준다(`{ workflow: Workflow; nodes: Node[]; edges: Edge[] }`). 전역
  `ClassSerializerInterceptor` 가 없으므로 와이어에는 엔티티의 로드된 컬럼이 실린다.
  - `syncNodes` 는 기존 행을 고치거나 `manager.create(Node, {…})` 로 컬럼만 담아 `manager.save` 한다. 요청 필드를 펼쳐 넣지 않는다.
  - `syncEdges` 도 컬럼만 담는다. 관계(`workflow` · `container` · `toolOwner` · `sourceNode` · `targetNode`)는 싣지 않는다.
  - 세 엔티티 모두 `eager` 관계가 없다. `findById` 도 관계를 싣지 않는다.
- `NodeDto` · `EdgeDto`(각 모듈의 응답 DTO)의 필드가 엔티티 컬럼과 1:1 대응한다(관계 필드 제외). → 선언만 바꾸면 된다.
- spec: `spec/data-flow/11-workflow.md` · `spec/3-workflow-editor/5-version-history.md` §7.3 은 응답을 `{ workflow, nodes, edges }`
  까지만 적는다. 원소 형태는 적지 않으므로 충돌이 없다 → `spec_impact: none`.
- e2e: `workflow-crud.e2e-spec.ts` C(5노드 · 엣지 2 저장)와 H(1노드 저장)가 저장을 부르지만 응답을 계약과 대조하지 않는다.
  복원을 부르는 e2e 는 **없다**.

## 방향

1. **DTO** — `nodes: NodeDto[]`(`@ApiProperty({ type: () => [NodeDto] })`) · `edges: EdgeDto[]`(`type: () => [EdgeDto]`).
2. **e2e 와이어 계약**
   - C: 저장 응답에 `assertMatchesContract(…, CanvasSaveResultDto)` + 원소 수(노드 5 · 엣지 2 — 빈 배열이면 원소 대조가 vacuous).
     C 는 **새 노드 생성 경로**(`manager.create`)를 탄다. `containerId` · `toolOwnerId` 가 실린 노드가 있다.
   - 신규 I: 5노드 그래프 저장 → 버전 목록 → **복원** → 복원 응답을 같은 DTO 와 대조 + 원소 수. 복원은 스냅샷의 같은 노드 id 로
     `saveCanvas` 를 부르므로 **기존 노드 갱신 경로**를 탄다(C 와 다른 가지). 복원 엔드포인트의 첫 e2e 다.
3. **선언 캐너리(unit)** — 검증자는 `type: 'object'` 원소를 보지 않으므로 «타입 없는 배열로 되돌리기» 는 e2e 계약으로 못 잡는다.
   `CanvasSaveResultDto` 스키마의 `nodes.items` · `edges.items` 가 `NodeDto` · `EdgeDto` 참조인지 단언한다.
4. **CHANGELOG** — 항목 1(OpenAPI): 두 엔드포인트의 응답 스키마가 노드 · 엣지 원소 형태를 광고한다.
5. **트래커** — 이 항목을 닫고, 조사 중 발견한 `ExportWorkflowDto.nodes`/`.edges`(같은 타입 없는 배열, 다만 export 포맷은
   인덱스로 정규화된 다른 형태라 새 DTO 가 필요하다)를 새 항목으로 등재한다.

## 뮤턴트 (저장소 파일 제자리 치환 → 실행 → `shutil.copy` 복원. 커밋 `04f603996` 위)

M1 · M2 는 단위(`src/modules/workflows` · `src/repo-guards` 489건), M3 는 e2e 전체(413건) 1회.

| # | 뮤턴트 | 예측 | 실측 · 죽인 케이스 |
|---|---|---|---|
| M1 | `nodes` 를 타입 없는 배열로 되돌림 | 캐너리 RED · e2e GREEN(검증자가 안 본다) | KILLED — 캐너리 `nodes` 한 건만. 다른 단위 테스트는 못 잡는다(예측대로) |
| M2 | `edges` 를 타입 없는 배열로 되돌림 | 캐너리 RED | KILLED — 캐너리 `edges` 한 건만 |
| M3 | `NodeDto.toolOwnerId` 선언 제거 | e2e C · I RED(미선언 키) | KILLED — e2e C · I 두 건만(2 failed / 413). 사유 `nodes[i].toolOwnerId [undeclared]` — 검증자가 `$ref` 배열 원소 안까지 내려간다 |

## `--impl-prep` 처분 (`review/consistency/2026/09/26/21_38_44` BLOCK: NO)

- **WARNING 1** — `GET /api/triggers/:id/history` 행의 형태 · 상한 미표기(`2-trigger-list.md` §3). 이 plan 과 무관하다 — scope 를
  `spec/2-navigation/` 로 잡아 딸려 왔다. 트래커에 **이미 있다**(«`GET /api/triggers/:id/history` 행이 형태 · 상한을 적지 않는다»)
  → 재등재하지 않는다.
- **INFO 1** — `NodeDto` · `EdgeDto` 의 기존 §5.4 금지 조합(optional + nullable: `description` · `containerId` · `toolOwnerId` ·
  `condition`)이 두 엔드포인트 스키마에 처음 드러난다. 기존 drift(`swagger-dto-contract` 가 얼려 둔 목록)이고, 검증자는 그 조합에서
  부재 · `null` 을 모두 받으므로 e2e 대조를 막지 않는다. 확인: 이 변경 뒤 `repo-guards` · `workflows` 단위 489건 통과.
- INFO 2~6 — 조치 불요(ExportWorkflowDto 분리 판단 정합 확인 · 무관 문서 · I 케이스는 `workflow-crud.e2e-spec.ts` 에 둔다).

## 체크리스트

- [x] `--impl-prep` — `review/consistency/2026/09/26/21_38_44` BLOCK: NO(W1 은 무관 · 기존 트래커 항목)
- [x] DTO · e2e · 캐너리 · CHANGELOG · 트래커 등재
- [x] 뮤턴트 표 실측 — 3개 전부 KILLED
- [x] TEST WORKFLOW (lint · unit · build · e2e 413 — 이전 412 + 신규 I)
- [ ] `/ai-review`
      - 1R `review/code/2026/09/26/22_05_52` — Critical 0 · Warning 1(I 가 노드 수를 고정하지 않음) → `2ca8a7767` 로 조치,
        TEST WORKFLOW 재통과(e2e 413). RESOLUTION 작성.
- [ ] `--impl-done`
- [ ] 트래커 항목 닫기
