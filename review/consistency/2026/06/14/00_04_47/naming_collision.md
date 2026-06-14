# 신규 식별자 충돌 검토 결과

검토 모드: --impl-done (scope=spec/, diff-base=HEAD~12)

대상 변경 파일:
- `spec/1-data-model.md` — NodeExecution 인덱스 표 행 5개 추가
- `spec/3-workflow-editor/5-version-history.md` — §7.1 응답 타입을 `WorkflowVersionListItemDto[]` 로 명시
- `spec/5-system/13-replay-rerun.md` — `computeChainDepth` 구현 설명 갱신
- `spec/data-flow/3-execution.md` — `node_execution` 행에 V095 인덱스 참조 추가

---

## 발견사항

### [INFO] `WorkflowVersionListItemDto` — spec 최초 도입, 코드와 정합

- target 신규 식별자: `WorkflowVersionListItemDto` (`spec/3-workflow-editor/5-version-history.md` §7.1)
- 기존 사용처: `codebase/backend/src/modules/workflow-versions/dto/responses/workflow-version-response.dto.ts` 에 이미 동일 클래스명 정의. 코드 리뷰(RESOLUTION #10)에서 spec-drift 해소 목적으로 이 변경이 도입됨.
- 상세: spec 이 기존 코드의 `WorkflowVersionListItemDto` 와 `WorkflowVersionDto` 를 받아 들여 §7.1(목록)/§7.2(상세) 를 분리 기술한 것이다. 두 이름 사이에 의미 충돌 없음. 프론트엔드에서는 해당 DTO 명을 직접 참조하지 않는다.
- 제안: 없음. 정합 확인.

### [INFO] `idx_node_execution_exec_status_active` — V095 신규 인덱스, 충돌 없음

- target 신규 식별자: `idx_node_execution_exec_status_active` (V095, `spec/1-data-model.md` §3 인덱스 표)
- 기존 사용처: `codebase/backend/migrations/` 에 존재하는 node_execution 관련 인덱스 명:
  - `idx_node_execution_execution` (V002)
  - `idx_node_execution_parent` (V012)
  - `idx_node_execution_exec_node_started_desc` (V034)
  - `idx_node_execution_background_run_id` (V047)
  - `idx_node_execution_parent_started_id` (V048)
- 상세: 신규 이름 `idx_node_execution_exec_status_active` 는 기존 어떤 인덱스명과도 충돌하지 않는다. V095 마이그레이션 파일도 이미 워크트리에 존재하여 실제 SQL 이 `IF NOT EXISTS` 가드와 함께 정의됨.
- 제안: 없음.

### [INFO] `spec/1-data-model.md` 인덱스 표 — V034/V047/V048 행 추가는 기존 마이그레이션의 사후 문서화

- target 신규 식별자: `NodeExecution | (execution_id, node_id, started_at DESC)` V034, `NodeExecution | (parent_node_execution_id)` V012, `NodeExecution | (parent_node_execution_id, started_at, id)` V048, `NodeExecution | ((output_data #>> '{meta,backgroundRunId}'))` V047 — 모두 spec §3 인덱스 표에 처음 명기됨
- 기존 사용처: 해당 마이그레이션 파일(`V012`, `V034`, `V047`, `V048`)은 워크트리에 이미 존재하는 기존 마이그레이션이다. 이번 diff 는 코드가 아닌 spec 표에 그 내용을 문서화한 것.
- 상세: 새 식별자를 도입하는 것이 아니라 기존 구현을 spec 에 기술하는 변경이므로 충돌 위험 없음.
- 제안: 없음.

### [INFO] `computeChainDepth` 설명 갱신 — 식별자 변경 없음

- target 신규 식별자: 없음 — `computeChainDepth` 이름 자체는 변경 없이 구현 설명("재귀 CTE 단일 쿼리, 사이클 방어 walk 상한 포함")만 추가됨.
- 기존 사용처: `codebase/backend/src/modules/executions/executions.service.ts` 및 `executions-rerun.service.spec.ts` 에서 이미 같은 이름으로 사용 중.
- 상세: 충돌 없음.
- 제안: 없음.

---

## 요약

이번 target 변경(HEAD~12 diff, scope=spec/)이 도입하는 신규 식별자는 다음과 같다: (1) `WorkflowVersionListItemDto` — spec §7.1 에 최초 등장하지만 구현 코드에서 먼저 정의된 이름을 spec 으로 수렴한 것이므로 의미 충돌 없음. (2) `idx_node_execution_exec_status_active` / V095 — 기존 node_execution 인덱스 명명 패턴(`idx_node_execution_*`)을 따르며 기존 이름과 겹치지 않음. (3) V034/V047/V048/V012 인덱스 표 항목 — 기존 마이그레이션의 사후 문서화로 실질적 신규 식별자 아님. 충돌하거나 다른 의미로 재사용되는 식별자는 발견되지 않았다.

---

## 위험도

NONE
