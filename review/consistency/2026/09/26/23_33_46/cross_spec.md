# Cross-Spec 일관성 검토 — export-workflow-typed (target: `spec/2-navigation/`)

## 검토 범위 확인

- `spec/2-navigation/` 델타: 0개 파일(이번 PR 은 spec 을 바꾸지 않는다 — 코드 전용 변경이므로 정상).
- 구현 diff(HEAD vs `origin/main`, 코드 3파일): `codebase/backend/src/modules/workflows/dto/responses/workflow-response.dto.ts` / `.spec.ts`, `codebase/backend/test/workflow-crud.e2e-spec.ts`.
- 변경 내용: `GET /workflows/:id/export` 응답의 `ExportWorkflowDto.nodes`/`.edges` 원소를 `type: 'object'`(타입 없는 배열)에서 응답 전용 DTO `ExportedNodeDto`(10필드)·`ExportedEdgeDto`(6필드) 참조로 광고. **서버가 실제로 반환하는 값 자체는 바뀌지 않는다** — OpenAPI 선언만 실측에 맞춘 것(swagger-only 변경).
- 대조한 SoT: `spec/2-navigation/1-workflow-list.md` §3.2(Export/Import JSON 포맷), `spec/data-flow/11-workflow.md` §1.5(복제·내보내기·가져오기), `spec/1-data-model.md`(Node/Edge 엔티티 필드), `plan/in-progress/export-workflow-typed.md`(이 PR 의 실측·결정 기록), `plan/in-progress/spec-draft-nullable-notation-followups.md`(선행 `--impl-prep` 처분).

## 발견사항

- **[INFO]** 프런트엔드 export 타입의 `null` 미반영 — 이미 추적 중, 재등재 불요
  - target 위치: `spec/2-navigation/1-workflow-list.md` §3.2 (`ExportedNodeDto.description`, `ExportWorkflowDto` 관련 서술)
  - 충돌 대상: `codebase/frontend/src/lib/api/workflows.ts` 의 `ExportedNode.description?: string` / `ExportedWorkflow.description?: string` (optional 로 선언, 서버는 키를 항상 싣고 값이 `null` 일 수 있음)
  - 상세: 이번 PR 로 백엔드 `ExportedNodeDto.description`/`ExportWorkflowDto` 관련 필드가 `nullable: true` 로 명시 광고되면서, 프런트엔드 쪽 대응 타입과의 불일치가 더 선명해졌다. 다만 이는 신규 결함이 아니라 `plan/in-progress/export-workflow-typed.md` §"관찰 (이 PR 밖)" 및 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 2026-09-26 자로 이미 등재된 항목이고(`--impl-prep` `review/consistency/2026/09/26/22_52_28` INFO 1), 소비처 2곳이 응답 전체를 `JSON.stringify` 하여 파일로 내려받을 뿐 필드를 읽지 않아 **현재는 동작 결함이 아님**이 grep 으로 확인돼 있다.
  - 제안: 조치 불요 — 이미 트래커에 있으므로 이번 라운드에서 새로 만들지 말 것. 필드를 실제로 읽는 소비처가 생기는 시점에 `string | null` 로 맞추면 된다.

target 문서(`spec/2-navigation/*`)가 새로 정의하는 엔티티·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 중 이번 diff 와 관련해 다른 spec 영역과 직접 모순되는 지점은 발견되지 않았다:

- **데이터 모델**: `ExportedNodeDto`/`ExportedEdgeDto` 의 필드(`type`/`category`/`label`/`positionX`/`positionY`/`config`/`isDisabled`/`description`/`containerIndex`/`toolOwnerIndex`, `sourceNodeIndex`/`sourcePort`/`targetNodeIndex`/`targetPort`/`type`/`condition`)는 `spec/1-data-model.md` 의 Node/Edge 엔티티 필드(`category` enum, `position_x/y`→`positionX/Y`, `is_disabled`→`isDisabled` 등 API 컨벤션에 따른 camelCase 변환)와 어긋나지 않는다. `NodeCategory`/`EdgeType` enum 도 새로 정의한 것이 아니라 기존 엔티티 enum 을 재사용한다.
- **API 계약**: index 기반 참조(`containerIndex`/`toolOwnerIndex`/`sourceNodeIndex`/`targetNodeIndex`)는 `1-workflow-list.md` §3.2 및 `data-flow/11-workflow.md` §1.5 가 서술하는 "UUID 대신 `nodes[]` 배열 인덱스" 규약과 일치한다. `formatVersion` 미emit 갭도 이번 diff 로 변경되지 않았고 spec 의 "미구현 (Planned)" 표기가 여전히 유효하다.
- **요구사항 ID / 상태 전이 / RBAC / 계층 책임**: 이번 diff 는 응답 DTO 의 Swagger 선언만 좁힌 것으로 새 요구사항 ID·상태 머신·권한 구조·계층 분할을 도입하지 않는다. `ExportWorkflowDto`/`ExportedNodeDto`/`ExportedEdgeDto` 를 참조하는 spec 문서는 `spec/2-navigation/1-workflow-list.md` 뿐이다(grep 확인, 다른 영역에서 동일 식별자를 다른 의미로 쓰지 않음).
- `plan/in-progress/export-workflow-typed.md` 자체가 `spec_impact: none` 을 선언하며 그 근거(§3.2 는 원소 키를 나열할 뿐 원소 타입까지는 규정하지 않으므로 충돌 없음)를 실측과 함께 적어 두었고, 본 검토도 같은 결론에 도달한다.

## 요약

이번 PR 은 `spec/2-navigation/` 을 전혀 수정하지 않는 코드 전용(Swagger 타입 선언) 변경이며, 서버가 실제로 반환하던 값은 그대로 두고 OpenAPI 계약만 실측에 맞춘 것이다. 변경된 필드 이름·참조 방식(index 기반 `containerIndex`/`toolOwnerIndex`/`sourceNodeIndex`/`targetNodeIndex`)은 `1-workflow-list.md` §3.2, `data-flow/11-workflow.md` §1.5, `1-data-model.md` 의 기존 서술과 정확히 일치하며, 새로 도입되는 엔티티·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임이 없어 다른 spec 영역과의 직접 충돌은 발견되지 않았다. 유일하게 언급할 만한 항목(프런트엔드 export 타입의 `null` 미반영)은 이미 이전 라운드에서 INFO 로 식별·트래커 등재된 사안이라 재기 불요다.

## 위험도

NONE
