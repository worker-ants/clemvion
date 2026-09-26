# 신규 식별자 충돌 검토 — export-workflow-typed

## 검토 범위

- diff-base `origin/main` 대비 코드 변경: `codebase/backend/src/modules/workflows/dto/responses/workflow-response.dto.ts`(+94/-6), 동 `.spec.ts`(+37/-17), `codebase/backend/test/workflow-crud.e2e-spec.ts`(+7), `CHANGELOG.md`(+7).
- spec `spec/2-navigation/` 델타는 0개 파일 — 이번 PR 은 이미 spec §3.2(`1-workflow-list.md`)가 문서화해 둔 export JSON 계약(`sourceNodeIndex`/`targetNodeIndex`/`containerIndex`/`toolOwnerIndex`)을 응답 DTO 레벨에서 처음으로 타입화하는 코드 전용 변경이다.
- 신규 식별자: `ExportedNodeDto`, `ExportedEdgeDto` (클래스), 그 필드들(`type`/`category`/`label`/`positionX`/`positionY`/`config`/`isDisabled`/`description`/`containerIndex`/`toolOwnerIndex`, `sourceNodeIndex`/`sourcePort`/`targetNodeIndex`/`targetPort`/`type`/`condition`).

## 발견사항

검토 결과 신규 식별자 충돌 없음.

- **엔티티/타입명** — `git grep -n "class Exported"` 전체 저장소 대상 결과 `ExportedNodeDto`(`workflow-response.dto.ts:147`)·`ExportedEdgeDto`(`workflow-response.dto.ts:195`) 각 1건 단일 정의. 동일 이름의 선행 클래스·인터페이스·swagger 컴포넌트 스키마는 존재하지 않는다(0건). 이미 동일 세션 안에서 `review/consistency/2026/09/26/22_52_28/rationale_continuity.md`(직전 커밋 `b39ddd802` 대상 검토)가 같은 grep 결과를 기록해 두었다 — 재확인 결과 이번 diff 에도 신규 동명 정의는 없다.
- **필드명 충돌 없음, 오히려 의도된 대응** — `ExportedNodeDto`/`ExportedEdgeDto` 의 필드는 기존 `NodeDto`(`codebase/backend/src/modules/nodes/dto/responses/node-response.dto.ts:5`)·`EdgeDto`(`codebase/backend/src/modules/edges/dto/responses/edge-response.dto.ts:5`)와 `type`/`category`/`label`/`positionX`/`positionY`/`config`/`isDisabled`/`description`/`sourcePort`/`targetPort`/`condition` 등 다수 필드명을 공유하지만, 의미가 동일(같은 노드·엣지 속성)하고 diff 상단 주석(`workflow-response.dto.ts:139-142`)이 "`NodeDto`/`EdgeDto` 를 재사용하지 않는 이유(export 는 UUID 대신 index 참조)"를 명시적으로 서술한다. `containerIndex`/`toolOwnerIndex`/`sourceNodeIndex`/`targetNodeIndex` 는 `NodeDto.containerId`/`toolOwnerId`, `EdgeDto.sourceNodeId`/`targetNodeId` 의 "UUID→배열 index" 대응 명명으로, spec `spec/2-navigation/1-workflow-list.md` §3.2(`sourceNodeIndex`/`targetNodeIndex`/`containerIndex`/`toolOwnerIndex`)가 이미 이 명명을 정의해 두었고 이번 코드가 그 명명을 그대로 타입화했을 뿐이다. 새로 지어낸 이름이 아니라 기존 spec 명명과의 첫 코드 반영이라 충돌 여지가 없다.
- **enum 재사용, 신규 정의 아님** — `NodeCategory`(`codebase/backend/src/modules/nodes/entities/node.entity.ts:13`)·`EdgeType`(`codebase/backend/src/modules/edges/entities/edge.entity.ts:14`)를 import 해 그대로 참조한다(`enumName: 'NodeCategory'`/`'EdgeType'` 도 `NodeDto`/`EdgeDto` 와 동일 문자열). 신규 enum 선언이 없으므로 swagger 컴포넌트 이름 충돌 표면도 없다.
- **API endpoint** — 신규 endpoint 없음. 기존 `GET /api/workflows/:id/export`(`spec/2-navigation/1-workflow-list.md` §3) 응답 스키마만 구체화했다.
- **요구사항 ID·이벤트·ENV·설정키·파일 경로** — 이번 diff 는 신규 파일을 만들지 않고 기존 3개 파일만 수정했으며, 요구사항 ID·webhook/queue/SSE 이벤트명·ENV var·config key 를 전혀 도입하지 않는다. 해당 없음.
- **테스트 헬퍼** — `assertMatchesContract`/`contractForDto`/`ExportWorkflowDto` 는 같은 파일 안에서 `WorkflowDto`/`CanvasSaveResultDto` 검증에 이미 쓰이던 기존 식별자를 재사용한 것이라 신규 식별자가 아니다.

## 요약

이번 PR 이 도입하는 신규 식별자(`ExportedNodeDto`, `ExportedEdgeDto`와 그 필드)는 저장소 전체에서 사전 사용 이력이 없는 단일 정의이며, 필드 명명은 spec §3.2 가 이미 확정해 둔 export JSON 계약과 기존 `NodeDto`/`EdgeDto`의 UUID→index 대응 규칙을 그대로 따른다. `NodeCategory`/`EdgeType` 은 신규 정의가 아니라 기존 엔티티 enum 의 재사용이다. 신규 endpoint·이벤트·ENV·설정키·spec 파일 경로 도입이 없어 해당 축의 충돌 표면 자체가 없다. 신규 식별자 충돌 관점에서 이번 변경은 문제 없음.

## 위험도

NONE
