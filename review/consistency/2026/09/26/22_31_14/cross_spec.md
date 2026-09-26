# Cross-Spec 일관성 검토 — canvas-save-typed (impl-done, scope=spec/2-navigation/)

## 검토 개요

이번 diff(3파일/165줄)는 `spec/2-navigation/` 문서를 변경하지 않는다(델타 0, 정상). 실제 코드
변경은 `POST /workflows/:id/save` · `POST /workflows/:id/versions/:versionId/restore` 응답의
`CanvasSaveResultDto.nodes`/`.edges` 를 `type:'object'` 배열에서 `NodeDto[]`/`EdgeDto[]` 로
좁힌 것이다(`codebase/backend/src/modules/workflows/dto/responses/workflow-response.dto.ts`).
서비스 반환값(`saveCanvas` → `{ workflow, nodes: savedNodes, edges: savedEdges }`)은 바뀌지
않았고, 실제 엔티티(`Node`/`Edge`)를 그대로 돌려주던 기존 동작에 스키마 선언만 맞춘 것이다
(`workflows.service.ts:701`).

이 변경이 실제로 속하는 기능 영역(캔버스 저장·버전 복원)은 `spec/2-navigation/` 이 아니라
`spec/3-workflow-editor/0-canvas.md`(§8 저장) · `spec/3-workflow-editor/5-version-history.md`
(§7.2~7.4)다. 아래 교차 대조는 이 두 문서 + `spec/1-data-model.md` §2.6/§2.7 + `spec/data-flow/
11-workflow.md` §1.1 + `spec/conventions/swagger.md` §1-4 를 기준으로 수행했다.

## 발견사항

### 데이터 모델 대조 — 충돌 없음

- `NodeDto`(`codebase/backend/src/modules/nodes/dto/responses/node-response.dto.ts`) 필드셋
  (`id, workflowId, type, category, label, positionX, positionY, config, isDisabled,
  description?, containerId?, toolOwnerId?, createdAt, updatedAt`)은 `spec/1-data-model.md`
  §2.6 Node 엔티티 컬럼과 camelCase 매핑 기준 1:1 로 일치한다.
- `EdgeDto`(`edges/dto/responses/edge-response.dto.ts`) 필드셋도 §2.7 Edge 엔티티와 1:1 로
  일치한다(`updated_at` 이 Edge 에 없다는 점까지 일치).
- `spec/3-workflow-editor/5-version-history.md` §7.2 `VersionSnapshot` 인라인 타입(노드:
  `id/type/category/label/positionX/positionY/config/isDisabled/description/containerId/
  toolOwnerId`, 엣지: `id/sourceNodeId/sourcePort/targetNodeId/targetPort/type/condition`)은
  이번에 광고된 `NodeDto`/`EdgeDto` 의 **부분집합**이다 — `VersionSnapshot` 은 저장용 JSONB
  스냅샷(§7.2, `GET .../versions/:versionId` 전용)이고 `CanvasSaveResultDto` 는 save/restore
  가 반환하는 살아있는 엔티티 응답(§7.3 "saveCanvas 와 동일")이라 목적이 다르다. `workflowId`·
  `createdAt`/`updatedAt` 이 후자에만 있는 것은 두 스키마가 애초에 별도 문서(§7.2 vs §7.3)에
  선언된 서로 다른 wire 형태이기 때문이며, 필드가 빠지거나 이름이 바뀐 것은 없어 모순이 아니다.

### API 계약 대조 — 충돌 없음

- 응답 envelope `{ workflow, nodes, edges }` 는 `spec/data-flow/11-workflow.md` §1.1 시퀀스
  다이어그램의 `Wf-->>C: 200 { workflow, nodes, edges }` 및 `5-version-history.md` §7.3 "응답:
  `{ workflow, nodes, edges }` (saveCanvas 와 동일)" 과 정확히 일치한다.
- `spec/conventions/swagger.md` §1-4는 "타입을 특정하기 번거롭다"는 이유로 열린
  `additionalProperties` 를 쓰지 말라고 명시한다. 이번 변경은 정확히 그 위반(원소를 `type:
  'object'` 로 방치)을 닫힌 배열 참조(`type: () => [NodeDto]`)로 교정한 것이라 이 convention
  과 충돌이 아니라 정합 강화다.
- 같은 파일의 `ExportWorkflowDto.nodes`/`.edges` (§3.2, 인덱스 기반 참조 `sourceNodeIndex`/
  `containerIndex` 등)는 이번 PR 이 건드리지 않았고 여전히 `type:'object'` 다. 이는 회귀가
  아니라 `spec/2-navigation/1-workflow-list.md` §3.2 가 이미 문서화한 별도 포맷(인덱스 기반)
  이며, `NodeDto`/`EdgeDto` 를 재사용할 수 없는 이유도 같은 문서·`plan/in-progress/
  spec-draft-nullable-notation-followups.md:1313` 트래커에 이미 기록돼 있어 cross-spec 모순이
  아니다.

### 요구사항 ID / 상태 전이 / RBAC — 해당 없음

새 요구사항 ID, 엔티티 상태 머신, 권한 구조 변경이 diff 에 없다(`@Roles('editor')` 게이트 등
기존 그대로).

### [INFO] `code:` 프런트매터 소유권이 실제 기능 경계와 어긋난다

- target 위치: `spec/2-navigation/1-workflow-list.md` frontmatter `code:` —
  `codebase/backend/src/modules/workflows/dto/**`
- 충돌 대상: `spec/3-workflow-editor/0-canvas.md`(§8) · `spec/3-workflow-editor/
  5-version-history.md`(§7.3~7.4) — 이번에 변경된 `workflow-response.dto.ts` 의
  `CanvasSaveResultDto` 를 실제로 서술하는 문서들
- 상세: `1-workflow-list.md` 의 `code:` glob 이 `workflows/dto/**` 전체를 단독 소유해,
  같은 디렉터리 안에 있는 캔버스 저장(`CanvasSaveResultDto`)·버전 복원 관련 DTO 변경까지
  워크플로우 **목록** 화면 spec 으로 라우팅된다. 실제로 이번 `--impl-done` 세션도 이 경로로
  `spec/2-navigation` 을 1차 scope 로 잡았고, 진짜 소유 문서(`3-workflow-editor/0-canvas.md`,
  `5-version-history.md`)는 컨텍스트 예산 초과로 잘려 "관련 spec" 취급만 받았다(orchestrator
  가 "## 추가 Read 블록" 으로 수동 보정해 이번엔 실제 피해가 없었다). `2-trigger-list.md` 는
  같은 상황에서 `code:` 항목마다 "이 glob 을 왜 이 문서가 무는지" 주석을 남기는 선례가 있으나,
  `1-workflow-list.md` 의 `dto/**` 항목에는 그런 설명이 없다.
  범위가 넓은 것 자체(list/canvas/export/execute DTO 가 한 폴더에 공존)는 리팩터링 대상이
  아니지만, 소유 선언이 한 문서로 좁게 닫혀 있어 다음에 `save-canvas.dto.ts`/
  `execute-workflow.dto.ts` 등 workflow-list 와 무관한 DTO 가 바뀌어도 같은 오탐 라우팅이
  재발할 수 있다.
- 제안: (a) `spec/3-workflow-editor/5-version-history.md` 또는 `0-canvas.md` 의 `code:` 에
  `workflow-response.dto.ts`(`CanvasSaveResultDto` 한정 주석 포함)를 추가해 다중 소유로
  명시하거나, (b) `1-workflow-list.md` 의 glob 을 목록 화면이 실제로 쓰는 DTO(예:
  `query-workflow.dto.ts`, `workflow-response.dto.ts` 의 `WorkflowDto`/`ExportWorkflowDto`
  한정)로 좁히고 `2-trigger-list.md` 식의 소유 근거 주석을 남긴다. 기능적 회귀는 아니므로
  급하지 않다.

## 요약

이번 diff 는 `CanvasSaveResultDto.nodes`/`.edges` 의 OpenAPI 선언을 실제 서버 동작(엔티티
그대로 반환)에 맞춰 좁힌 것으로, `spec/1-data-model.md`(Node/Edge 컬럼) · `spec/3-workflow-editor/
5-version-history.md`(§7.2~7.4 응답/스냅샷 형태) · `spec/data-flow/11-workflow.md`(§1.1 응답
envelope) · `spec/conventions/swagger.md`(§1-4 닫힌 union 원칙) 어디와도 모순되지 않으며, 오히려
convention 위반(열린 object 배열)을 교정하는 방향이다. 유일한 지적은 기능적 결함이 아니라 spec
`code:` 프런트매터의 소유권 경계가 실제 기능 분할과 어긋나 향후 동일 디렉터리의 다른 변경이
또 잘못된 spec 영역으로 라우팅될 수 있다는 점(INFO)이다.

## 위험도

NONE
