# Cross-Spec 일관성 검토 — `spec/3-workflow-editor/` (--impl-prep)

## 검토 범위

target: `spec/3-workflow-editor/` 전체 7개 문서(`5-version-history.md` · `0-canvas.md` ·
`2-edge.md` · `3-execution.md` · `4-ai-assistant.md` · `_product-overview.md` ·
`1-node-common.md`). 번들에서 `related_specs`(`spec/1-data-model.md` 등)가 예산 초과로
절단되어 있어, 아래 항목은 번들이 아니라 **워크트리의 실제 파일**을 직접 읽어 대조했다:
`spec/1-data-model.md`, `spec/data-flow/11-workflow.md`, `spec/5-system/1-auth.md`,
`spec/5-system/2-api-convention.md`, `spec/5-system/4-execution-engine.md`,
`spec/2-navigation/1-workflow-list.md`, `spec/conventions/*`.

## 발견사항

- **[INFO]** `5-version-history.md` §7.1 의 `m-3` 참조가 링크 없이 bare 토큰
  - target 위치: `spec/3-workflow-editor/5-version-history.md` §7.1 — "`snapshot` 필드는 응답에서 의도적으로 제외된다(목록 over-fetch 방지, m-3)."
  - 충돌 대상: `plan/complete/refactor/05-database.md` `### m-3 [Minor] workflow_version.snapshot JSONB over-fetch — select 제한은 유효, 스토리지 이전은 보류`
  - 상세: `m-3` 는 실재하는 근거(refactor 트래커 항목)를 가리키지만, 본문에 링크나 파일 경로가 없어 독자가 무엇을 가리키는지 추적할 수 없다. 같은 저장소의 다른 `m-3` 인용들(`spec/5-system/1-auth.md` Rationale 2.3.B, `spec/7-channel-web-chat/4-security.md` 등)은 전부 `[1-auth Rationale 2.3.B m-3](...)` 형태로 출처를 명시하는데, 이 자리만 관례를 벗어난다. 데이터 충돌은 아니며(실제로 select 제한 결정과 일치), 출처 추적성 문제다.
  - 제안: `plan/complete/refactor/05-database.md#m-3-minor-workflow_versionsnapshot-jsonb-over-fetch--select-제한은-유효-스토리지-이전은-보류` 앵커로 역참조 링크 추가.

## 데이터 모델 / API 계약 / 상태 전이 / RBAC / 계층 책임 — 교차 대조 결과 (문제 없음)

- **`workflow_version` 테이블**: `5-version-history.md §8` 의 컬럼 정의(`id`/`workflow_id`/`version` UNIQUE/`snapshot`/`change_summary`/`created_by`/`created_at`)가 `spec/1-data-model.md §2.15 WorkflowVersion` 과 완전히 일치. `Workflow.current_version` (`§2.4`) ↔ 버전 생성 트랜잭션(`current_version = current_version + 1`)도 `spec/data-flow/11-workflow.md` 와 일치.
- **`VersionSnapshot` 스키마 (§7.2)**: nodes/edges 필드 목록이 `spec/1-data-model.md §2.6 Node` · `§2.7 Edge` 컬럼과 정확히 대응(스냅샷이라 `workflow_id`/timestamp 는 제외 — 의도된 축소). `settings` 미포함 결정도 `data-flow/11-workflow.md` Rationale 및 `1-data-model.md` "`WorkflowVersion.snapshot` 구성 서술 정정" 항목과 일치.
- **API 계약**: `POST /workflows/:id/save`(`changeSummary?`) · `POST /workflows/:id/versions/:versionId/restore` → `{ workflow, nodes, edges }` 가 `spec/data-flow/11-workflow.md` 시퀀스(`200 { workflow, nodes, edges }`)와 동일. `restoreVersion` 이 `saveCanvas(skipLegacyDataGates=true)` 를 경유해 저장 게이트를 우회하는 서술도 `spec/4-nodes/7-trigger/1-manual-trigger.md` · `spec/4-nodes/1-logic/4-variable-declaration.md`·`5-variable-modification.md` · `spec/conventions/execution-context.md` 전 지점에서 동일하게 재확인됨.
- **§5.4 (null vs 키 생략) 관점**: `5-version-history.md §7.1` 의 "목록은 `snapshot` 키를 통째로 생략"은 `spec/5-system/2-api-convention.md §5.4` 의 "present-when-available" 기준 (b) — 목록 over-fetch 방지 — 에 해당해 규칙과 충돌 없음. `VersionSnapshot.description: string | null` 등 nullable 필드도 §5.4 "상시 존재 → null" 원칙과 부합.
- **RBAC**: `spec/5-system/1-auth.md §3.2` 권한 매트릭스는 `Workflow: CRUD/CRUD/CRUD/R` (Owner/Admin/Editor/Viewer) 로 버전 저장·복원(Workflow 업데이트에 해당)을 Editor+ 로 규정한다. `5-version-history.md`/`0-canvas.md` 는 이 매트릭스를 재서술하지 않는데, 이는 저장소 전역 관례(RBAC SoT 는 `1-auth.md` 하나, 기능별 UI 문서는 재기술하지 않음)와 일치하며 이 target 문서만의 이탈이 아니다 — 새 충돌 아님.
- **요구사항 ID**: `ED-PL-03`/`ED-PL-04`/`ED-SP-05`(`_product-overview.md`) · `ND-BG-05`(`spec/4-nodes/_product-overview.md`) 재사용처 전부 동일 의미로 참조되어 ID 충돌 없음.
- **계층 책임**: 팔레트→캔버스 노드 추가가 `palette-canvas-bridge` 를 경유하는 근거(R-2)가 `assistant-editor-bridge` 와 "동일한 확립된 seam" 이라고 명시해 기존 아키텍처 결정과 정합. 컨테이너 중첩 깊이 무제한 확정(R-4)도 실행 엔진(`5-system/4-execution-engine.md §3.4`)·`cross-node-warning-rules.md §9` 양쪽에서 동일하게 갱신되어 드리프트 없음.

## 요약

`spec/3-workflow-editor/` 는 버전 이력·캔버스·엣지 기능 전반에서 `spec/1-data-model.md`, `spec/data-flow/11-workflow.md`, `spec/5-system/1-auth.md`, `spec/5-system/2-api-convention.md`, `spec/4-nodes/**`, `spec/conventions/**` 와 데이터 모델·API 계약·상태 전이(저장 게이트 우회 등)·RBAC·계층 책임 전 축에서 정합했다. 다수의 과거 drift(§8 저장 모델, `WorkflowVersion.snapshot` 구성, 컨테이너 중첩 깊이)가 이미 Rationale 절로 명시 정정되어 있어 문서 간 재확인이 용이했다. 유일한 흠은 `m-3` bare 참조 하나로, 정정해도 의미상 오류는 아니고 추적성만 개선하는 수준이다. impl-prep 을 막을 사유는 없다.

## 위험도

LOW
