### 발견사항

- **[WARNING]** `pending_plans` 에 완료된 plan 2건이 `in-progress/` 경로로 잘못 등록됨
  - target 위치: `spec/5-system/4-execution-engine.md` frontmatter `pending_plans:` (lines 30–35)
  - 관련 plan:
    - `plan/complete/spec-sync-resume-dispatch-registry.md` — 이미 `plan/complete/` 에 있음 (worktree `spec-sync-s-batch-b85f17`, status 기록 완료)
    - `plan/complete/spec-update-execution-context-options-bag.md` — 이미 `plan/complete/` 에 있음 (`completed: 2026-06-10`)
  - 상세: frontmatter 가 두 파일을 `plan/in-progress/spec-sync-resume-dispatch-registry.md` 와 `plan/in-progress/spec-update-execution-context-options-bag.md` 로 참조하지만 해당 경로에 파일이 존재하지 않는다. `spec-impl-evidence.md §3` 의 `pending_plans` 유효성 가드(`spec-pending-plan-existence` guard) 가 실패하는 stale 참조다.
  - 제안: `pending_plans:` 에서 위 두 항목을 제거한다 (해당 plan 은 완료됐으므로 `partial` 상태 유지를 정당화하지 않는다). `execution-engine-residual-gaps.md` (G1/G2 BLOCKED) · `exec-intake-queue-impl.md` (PR2b/3/4 미완) · `exec-park-durable-resume.md` (umbrella 잔여) · `execution-engine-typed-errors.md` (구현 미착수) 가 `partial` 사유로 충분하다.

- **[INFO]** 새로 추가된 `§7.5.2` 의 결정 내용이 `execution-engine-typed-errors.md` 의 "설계 초안" 과 정합하며, plan 의 "결정 필요" 항목 1~4 가 이번 spec 변경에서 확정됐다
  - target 위치: `spec/5-system/4-execution-engine.md §7.5.2` (신규 섹션, diff +24 lines)
  - 관련 plan: `plan/in-progress/execution-engine-typed-errors.md` — "결정 옵션 (2026-06-14) — planner 설계 초안" 절, 결정 1~4 권고안
  - 상세: plan 의 권고안(결정 1=A, 2=A, 3=A, 4=단일안) 이 spec 의 `§7.5.2` 내용과 일치한다. plan 자체가 "본 절 작성으로 spec 은 아직 바뀌지 않는다 (spec = 확정된 진실)" 라고 명시했으나, 이번 spec 커밋이 그 확정을 이행한다 — 일방적 결정이 아니라 사용자 승인("사용자 결정(2026-06-14): A-1") 후의 반영이므로 미해결 결정 우회가 아니다. plan 의 "선행 의존" 항목("spec 결정을 project-planner 가 먼저 확정해야 구현 착수 가능")이 이번 spec 변경으로 해소됐으므로, plan 의 해당 의존성 항목을 완료 표기로 갱신하면 추적이 명확해진다.
  - 제안: `execution-engine-typed-errors.md` 의 "선행 의존" 항목에 "(spec 반영 완료 2026-06-14)" 추가. "결정 필요" 항목들을 완료 체크(`[x]`)로 전환. spec 반영 완료 이후 `consistency-check --spec` 통과 여부도 명기하면 추적 일관성이 높아진다.

- **[INFO]** `execution-engine-typed-errors.md` 의 `§spec 위치 정정` 표기(`spec/3-execution/**` 아님, `spec/5-system/4-execution-engine.md §7.5.1` + `6-websocket-protocol.md`) 가 이번 spec 변경과 일치함을 확인 — 추가 조치 불요

### 요약

target(`spec/5-system/4-execution-engine.md`)에 추가된 `§7.5.2` typed error 계약은 `plan/in-progress/execution-engine-typed-errors.md` 의 사용자 확정 결정(2026-06-14, 옵션 A×4)을 spec 에 정직하게 반영한 것으로, 미해결 결정 우회나 선행 plan 미해소 충돌은 없다. 단, frontmatter `pending_plans:` 에 이미 `plan/complete/` 로 이동한 두 파일(`spec-sync-resume-dispatch-registry.md`, `spec-update-execution-context-options-bag.md`)이 `in-progress/` 경로로 잘못 참조돼 있어 spec-frontmatter guard 를 실패시키는 stale 참조 문제가 존재한다(WARNING). 이 두 항목을 `pending_plans` 에서 제거하고, `execution-engine-typed-errors.md` 에 spec 확정 완료 사실을 기록하면 plan 정합성이 완전해진다.

### 위험도
LOW
