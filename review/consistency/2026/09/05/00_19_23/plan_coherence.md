# Plan 정합성 검토 — spec/1-data-model.md · spec/data-flow/10-triggers.md (--impl-done)

## 검토 범위

- target diff (`origin/main...HEAD`): `spec/1-data-model.md` (+37/-2), `spec/data-flow/10-triggers.md` (+1/-1) — 합 68줄.
- 변경 내용: Schedule 인덱스 `(next_run_at, is_active)` → `(workspace_id, next_run_at)` 교체 + 누락돼 있던 `Schedule (trigger_id)` 행 신설(§3), 관련 Rationale 절 추가, `data-flow/10-triggers.md` 의 인덱스 각주 갱신.
- `plan/in-progress/**` 전체 91개 문서 중 `1-data-model.md`/`10-triggers.md` 를 참조하는 9개 문서, 그리고 `next_run_at`/`schedule 인덱스` 를 언급하는 문서를 전수 grep 해 대조했다.

## 발견사항

없음.

### 대조 근거 (참고용 — 발견사항 아님)

- 이 diff 의 출처는 `plan/in-progress/spec-draft-nullable-notation-followups.md` §후속의
  `idx_schedule_next_run → (workspace_id, next_run_at)` 항목이며, 그 항목은 이미
  `[x]` 로 닫혀 있고 상세는 `plan/complete/spec-draft-schedule-index.md`(status: complete)
  로 옮겨져 있다. 그 문서 §4 "변경안 (B) — 빠져 있던 `(trigger_id)` 행 추가" 가 이번 diff 의
  두 번째 행(V106 `idx_schedule_trigger_id`)과 정확히 일치한다 — diff 는 정본 plan 이 이미
  결정·완료 처리한 내용을 그대로 반영한 것이다.
- 마이그레이션 `V110__schedule_workspace_next_run_index.sql` 의 DROP-first 3단계 순서·근거
  주석도 plan 서술과 일치한다(직접 확인).
- 같은 in-progress plan 문서에 이 diff 와 **겹치지 않는** 미해결 항목이 남아 있다:
  - `CREATE INDEX CONCURRENTLY IF NOT EXISTS` 재실행 위험의 규약 차원 처리 — 대상은
    `spec/conventions/migrations.md`/`migrations/README.md` 이고 이번 diff 는 그 파일을
    건드리지 않는다. 후속으로 정확히 분리 등재돼 있고(마이그레이션 주석 44행에도 동일하게
    "규약 차원의 처리는 후속으로 등재" 라고 명시), 이번 diff 로 그 결정을 우회하지 않는다.
  - `spec/1-data-model.md:873` `threshold` 의 `Float` 라벨링 오기(§2.25 근처, planner 트랙) —
    이번 diff 가 건드리는 §3 Schedule 인덱스 행·Rationale 절과 다른 위치이며 충돌 없음.
  - `swagger.md` numeric 불변식·JSDoc 분리 가이드 — 대상 파일이 이번 diff 범위 밖.
- `1-data-model.md`/`10-triggers.md` 를 참조하는 나머지 8개 in-progress 문서
  (`spec-update-node-cancellation-shutdown-classification.md`, `eia-terminal-payload.md`,
  `spec-sync-auth-gaps.md`, `node-cancellation-residual-signal-propagation.md`,
  `rag-quality-improvement.md`, `spec-sync-external-interaction-api-gaps.md`,
  `spec-draft-eia-62-waiting-payload.md`, `spec-conventions-engine-error-code-surface.md`)
  는 모두 `§2.14 Execution.error` · `§2.25 AlertRule` · line 230/474/546 등 **다른 절**을
  가리키며, 이번 diff 가 편집한 §3 Schedule 인덱스 표·말미 Rationale 절과 라인·섹션이
  겹치지 않는다.

## 요약

target diff(schedule 인덱스 교체 + 누락 인덱스 행 보강)는 `plan/in-progress/spec-draft-nullable-notation-followups.md` 가 이미 결정·완료 처리한 항목을 문서에 반영한 것이며, 근거 plan(`plan/complete/spec-draft-schedule-index.md`)과 구현(V110 마이그레이션)이 모두 일치한다. 같은 스케줄 인덱스 작업이 남긴 미해결 후속(`CREATE INDEX CONCURRENTLY` 재실행 위험의 규약화)은 이번 diff 의 파일 범위 밖으로 정확히 분리돼 있어 우회·무시가 아니다. `1-data-model.md`/`10-triggers.md` 를 참조하는 다른 in-progress 문서들도 겹치지 않는 절을 가리켜 후속 항목 무효화·선행 조건 미해소 문제가 없다. Plan 정합성 관점에서 이 diff 는 깨끗하다.

## 위험도

NONE
