# Rationale 연속성 검토 — schedule 인덱스 전략 정정

## 검토 대상

- target: `plan/in-progress/spec-draft-schedule-index.md`
- spec_impact 선언: `spec/1-data-model.md` (1건만)
- 관련 Rationale 번들: `spec/1-data-model.md`, `spec/data-flow/10-triggers.md`, `spec/0-overview.md`, `spec/2-navigation/1-workflow-list.md`, `spec/2-navigation/2-trigger-list.md`, `spec/2-navigation/3-schedule.md`, `spec/2-navigation/4-integration.md`

## 사전 확인 (실측)

- target 이 인용한 소스 plan 항목(`plan/in-progress/spec-draft-nullable-notation-followups.md:379-397,434`)의 원문·선택지 (a)/(b) 는 실제로 그렇게 적혀 있음을 확인 — 인용 정확.
- `spec/1-data-model.md` 의 `## Rationale`(4개 항목: alert_rule / WorkflowVersion.snapshot / Execution.execution_path / install_token 형식) 어디에도 이 스케줄 인덱스의 설계를 다룬 기존 결정이 없음 — target 이 기각·번복하는 **기존 spec Rationale 항목은 없다**. 즉 "기각된 대안 재도입" 유형의 위반은 성립하지 않음.
- `V106__schedule_trigger_id_index.sql` 실재 확인(`idx_schedule_trigger_id`) — target §4 의 "표에 행이 없다" 주장은 사실과 일치.
- `V002__indexes.sql:30` `idx_schedule_next_run ON schedule (next_run_at, is_active) WHERE is_active = TRUE` 실재 확인 — target 인용 정확.
- `codebase/backend/migrations/` 에 `V110` 미사용 확인 — 버전 충돌 없음.
- `spec/1-data-model.md:914` (변경 대상 행)과 `spec/data-flow/10-triggers.md:175` 양쪽에서 `(next_run_at, is_active)` 인덱스 표기를 grep 전수 확인 — **정확히 이 두 곳뿐**.

## 발견사항

- **[WARNING] 인덱스 정정이 한쪽 미러에만 반영 — 이 저장소가 이미 겪은 drift 패턴의 재발**
  - target 위치: `plan/in-progress/spec-draft-schedule-index.md` frontmatter `spec_impact: [spec/1-data-model.md]` 및 "## 3. 변경안 (A)"
  - 과거 결정 출처: `spec/1-data-model.md` `## Rationale` → `### WorkflowVersion.snapshot 구성 서술 정정 (2026-07-31)` — "2026-06-10 spec↔code 전수 감사가 `data-flow/11-workflow.md` 를 코드 관찰 근거로 정정하면서 **본 문서 §2.15 만 함께 고치지 않았다**. 그 결과 코드 · data-flow · 버전 히스토리 세 곳이 합의하는데 데이터 모델 문서 한 곳만 어긋난 상태가 남았다."
  - 상세: target 의 변경안 (A)는 `spec/1-data-model.md:914` 의 Schedule 인덱스 행을 `(next_run_at, is_active)` → `(workspace_id, next_run_at)` 로 교체하지만, 동일한 인덱스를 인용하는 `spec/data-flow/10-triggers.md:175` (`| schedule | 발사 후 | UPDATE last_run_at, next_run_at ... | (next_run_at, is_active) |`)는 target 범위(`spec_impact`)에 들어 있지 않아 그대로 남는다. 결과적으로 머지 직후 두 spec 문서가 같은 인덱스에 대해 서로 다른 값을 주장하는 상태가 되며, 이는 위 인용 Rationale 항목이 명시적으로 "재발하면 안 된다"고 기록해 둔 바로 그 실패 유형(한 문서만 고치고 미러 문서를 놓침)의 재현이다. target 자신도 §5 에서 "spec 과 마이그레이션이 갈라진 채 머지되면 그것이 이 저장소가 반복해 싸워 온 drift 그 자체가 된다"고 명시했는데, 그 경계심이 spec-대-spec 미러에는 적용되지 않았다.
  - 제안: `spec/data-flow/10-triggers.md:175` 의 인덱스 열도 `(workspace_id, next_run_at)` 로 함께 갱신하고, target frontmatter `spec_impact` 에 이 파일을 추가한다. (§2.1 표의 `(workspace_id, endpoint_path) UNIQUE` + `(workspace_id, type)` 처럼 인덱스 표기를 두는 인접 행들과 형식은 이미 호환되므로 값 교체만으로 충분.)

## 요약

target 이 다루는 핵심 결정 — 부분 인덱스 `(next_run_at, is_active)` 를 폐기하고 `(workspace_id, next_run_at)` 로 대체 — 은 기존 spec `## Rationale` 어디에서도 명시적으로 채택·고정된 적이 없는 사안이라 "기각된 대안의 재도입"이나 "무근거 번복"에는 해당하지 않으며, 오히려 처음으로 실측 기반 결정을 성문화하고 자체 Rationale(§왜 (d) 아닌 (c)·기각한 대안 명시)을 충실히 남긴 점은 이 저장소의 관행과 정합한다. `V106` 누락 행 보충, 표 서식(파샬 인덱스 WHERE 절 표기·V-번호 접미사) 준수도 기존 관례와 일치. 다만 유일하지만 실질적인 문제로, 같은 인덱스를 인용하는 `spec/data-flow/10-triggers.md` 의 미러 행이 target 의 `spec_impact` 범위 밖에 있어 갱신되지 않는다 — 이는 이 spec 문서 자신의 Rationale 이 과거에 명시적으로 경계했던 "한 문서만 고치고 다른 문서를 놓치는" drift 패턴과 형태가 동일하다.

## 위험도

MEDIUM
