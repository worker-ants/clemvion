# Cross-Spec 일관성 검토 — schedule 인덱스 전략 정정

대상: `plan/in-progress/spec-draft-schedule-index.md` (spec draft, `spec_impact: spec/1-data-model.md`)

## 발견사항

- **[WARNING]** `spec/data-flow/10-triggers.md` 의 Schema 매핑 표가 교체 대상 인덱스를 그대로 참조 — `spec_impact` 누락
  - target 위치: `## 3. 변경안 (A)` — `spec/1-data-model.md` §3 Schedule 행을 `(next_run_at, is_active) WHERE is_active` → `(workspace_id, next_run_at)` 로 교체
  - 충돌 대상: `spec/data-flow/10-triggers.md:175` (§2.1 Schema 매핑 — Postgres)
    ```
    | `schedule` | 발사 후 | UPDATE `last_run_at, next_run_at` (process() 정보성 재계산; 발사 트리거 아님) | `(next_run_at, is_active)` |
    ```
  - 상세: 두 문서가 같은 물리 인덱스(V002 `idx_schedule_next_run`)를 각자 서술한다. target 이 `spec/1-data-model.md` §3 만 고치면, 변경 반영 직후 `data-flow/10-triggers.md` 는 **이미 DROP 된 인덱스**를 여전히 "인덱스/제약" 칸에 나열하는 상태로 남는다 — 같은 테이블·같은 물리 개체에 대해 두 spec 문서가 서로 다른 인덱스를 진실로 주장하게 된다. 이 저장소가 이미 한 번 겪은 패턴이다 — `spec/1-data-model.md` 자체의 Rationale("`alert_rule` 을 §2.25 로 등재")이 "다른 문서가 이미 이 위치를 SoT 로 가리키고 있었는데 정작 갱신은 한쪽만 됐다"는 동일 클래스의 drift 를 기록해 두었다. target 의 §5 도 "spec 과 마이그레이션이 갈라진 채 머지되면 그것이 이 저장소가 반복해 싸워 온 drift" 라고 스스로 지적하는데, 그 경계를 `spec/1-data-model.md` ↔ 마이그레이션 사이에는 그었지만 `spec/1-data-model.md` ↔ `spec/data-flow/10-triggers.md` 사이에는 긋지 않았다.
  - 제안: `spec/data-flow/10-triggers.md:175` 의 "인덱스/제약" 칸을 `(workspace_id, next_run_at)` 로 함께 갱신 — 같은 PR/같은 planner 턴에서. target frontmatter `spec_impact` 에 `spec/data-flow/10-triggers.md` 를 추가.

- **[INFO]** 변경안 (B) 신규 행의 표 전체 정합은 확인됨 — 참고용 교차검증 기록
  - target 위치: `## 4. 변경안 (B)` — Schedule `(trigger_id)` 행 추가
  - 충돌 대상: `codebase/backend/migrations/V106__schedule_trigger_id_index.sql`, `spec/1-data-model.md` §3 (현재 Schedule 행에 `(trigger_id)` 없음 — 직접 확인: `grep -n "Schedule | (trigger_id)" spec/1-data-model.md` 결과 없음)
  - 상세: V106 마이그레이션 코멘트("`TriggersService.findAll` 이 목록 페이지마다 `WHERE trigger_id IN (...) AND workspace_id = ?` 로 배치 조회")와 target 의 변경안 (B) 설명이 정확히 일치한다. 실제로 표에 빠져 있던 행이 맞다 — 충돌 아님, 갭 보정으로 타당.
  - 제안: 없음 (문제 없음, 검증 기록용).

## 요약

target 은 스스로 실측(EXPLAIN, 두 규모)으로 등재된 두 선택지를 반증하고 제3의 안 `(workspace_id, next_run_at)` 을 제시하며, 인용된 코드(`schedules.service.ts` Q1/Q2, `schedule-runner.service.ts` 부팅 쿼리, V106 마이그레이션)와 대조한 결과 모든 인용이 정확했다. RBAC·API 계약·요구사항 ID·상태 전이·계층 책임 축에서는 이 draft 가 건드리는 표면이 없어 충돌이 없다. 유일한 실질 발견은 데이터 모델 축이다 — 교체 대상 인덱스 `(next_run_at, is_active)` 가 `spec/1-data-model.md` 뿐 아니라 `spec/data-flow/10-triggers.md` 의 Schema 매핑 표에도 미러링되어 있는데, target 의 `spec_impact` 가 후자를 누락했다. 이대로 채택하면 두 spec 문서가 같은 물리 인덱스에 대해 서로 다른 사실을 주장하는 상태로 머지된다 — 정확히 이 저장소가 반복해 겪어 온 "SoT 한쪽만 갱신" drift 패턴이다.

## 위험도

MEDIUM
