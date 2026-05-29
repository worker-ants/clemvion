# Consistency Check SUMMARY — workflow-resumable Phase 3 (변경 2.3 + Phase 3.1)

- 모드: `--impl-done spec/5-system/` (code diff vs origin/main), worktree `workflow-resumable-phase3-a4ea4a`
- 세션: `review/consistency/2026/05/29/09_23_46`
- checker 5/5 success — cross_spec=LOW, rationale_continuity=PASS, convention_compliance=MEDIUM, plan_coherence=LOW, naming_collision=2 findings(비차단)

## BLOCK: NO

실제 Critical 0건. 코드 동작의 cross-spec 충돌 없음. 모든 발견은 **spec 문서 정합화 / 라이프사이클 정리**이며 code-review SUMMARY 와 상당수 중복.

## Warning
| checker | 발견 | 후속 |
|---------|------|------|
| convention | WS ack 신설 `errorCode` 가 spec §4.2 ack 스키마 미등재 (+`retry_last_turn` 의 nested `error.code` 와 구조 불일치) | spec 반영 (project-planner) = code-review W-4/W-11/C-1 |
| convention | `spec/5-system/4-execution-engine.md` frontmatter `status: spec-only`/`code: []` 가 구현 후 미전이 (spec-impl-evidence §3 위반) | `status: partial` + `code:` 채우기 |

## Info (통합)
- cross_spec: §7.5 에 `removeOnFail: false` 미언급(§9.3 과 정합 보강 권장) / REST `POST :id/continue` 422 가 `3-workflow-editor/3-execution.md §8` API 목록 미등재 / EIA `STATE_MISMATCH` ←→ §7.5.1 역링크 부재(`14-external-interaction-api.md §5.1`)
- convention: plan frontmatter `worktree` stale (→ `workflow-resumable-phase3-a4ea4a`) / §9.3 DLQ 결정이 `## Rationale` 미기록
- plan_coherence: 두 plan 작업완료인데 `git mv plan/complete/` 미수행 / `0-unimplemented-overview.md` L81 Phase 3 "대기" stale / `retry-handler-followup.md` WARNING#2 BullMQ 노트 미반영 / `fix-mail-send-status-59d3b3`(PR #350 OPEN)가 같은 `execution-engine.service.ts` 편집(hunk 위치 달라 충돌 위험 낮음)
- naming_collision: 신규 식별자(`InvalidExecutionStateError`/`ContinuationDlqMonitorService`/`CONTINUATION_DLQ_*`) 충돌 없음. 동일 의미 3코드(`INVALID_EXECUTION_STATE`/`INVALID_STATE`/`STATE_MISMATCH`)는 의도적 분리(§7.5.1)

## rationale_continuity: PASS
sentinel 우회 제거·다중 row throw·DLQ 로그 기반·3코드 분리 모두 기존 Rationale("Durable Continuation 2026-05-24", §7.5.1 "의도적 분리")과 일치. 기각 대안 재도입/무근거 번복 없음.

## 결론
차단 사유 없음. spec 문서 후속(WS errorCode §4.2, 카탈로그 등재, frontmatter status 전이, removeOnFail/Rationale 보강, EIA 링크)은 code-review 발견과 중복 — 단일 spec-update plan 으로 project-planner 일괄 처리 권장. plan git mv / overview 갱신은 본 PR 내 처리 가능.
