# consistency-check --impl-done SUMMARY — priority 3-tier triggerType threading

- 모드: `--impl-done` scope=`spec/5-system/` · diff-base=`origin/main`
- 세션: `review/consistency/2026/07/04/19_17_50`
- checker 5/5 완료

## BLOCK: NO

| checker | 결과 | 비고 |
| --- | --- | --- |
| cross_spec | BLOCK: NO | 0 Critical/Warning. 배너 §4.3/§8/§9.3 + data-flow 정합 확인. runNow 의도적 제외 매칭. |
| rationale_continuity | BLOCK: NO | PR2b Rationale 가 명시한 "priority 3-tier 별도 후속" 의 이행 — 번복 아님. runNow=manual·executedBy 우선 불변식 확인. 기각 대안 재도입 없음. |
| convention_compliance | BLOCK: NO | `ExecutionRunTriggerType`/`triggerType` 가 `Trigger.type`(§2.8) 어휘 정확 재사용. INFO: frontmatter `pending_plans` stale → 조치. |
| plan_coherence | BLOCK: NO | WARNING: `data-flow/3-execution.md` 표(라인 208) stale 2-tier 잔존 → 조치. |
| naming_collision | BLOCK: NO | `ExecutionRunTriggerType` vs `Execution.triggerSource`/`__triggerSource` 구별 문서화. INFO-only. |

## 조치 (본 검토 후속)

- **plan_coherence WARNING** — `spec/data-flow/3-execution.md:208` 큐 카탈로그 표의 `priority manual > 트리거` → `priority 3-tier manual(1) > webhook(2) > schedule(3)` 로 갱신 (라인 68 fix 와 정합).
- **convention_compliance INFO** — `spec/5-system/4-execution-engine.md` frontmatter `pending_plans` 의 이동 완료된 `exec-intake-queue-impl.md`(→complete/) 를 live `exec-intake-followups.md` 로 교체.

## 미조치(기록) INFO

- 두 landed spec-draft plan(`spec-draft-concurrency-cap-pr2b.md` #800, `spec-update-execution-engine-pr4.md` #798)이 `plan/in-progress/` 잔존 — 각 PR 스코프 기준 "3-tier still Planned" 서술은 역사적으로 정확, 본 변경과 무관. plan 라이프사이클 정리(complete/ 이동)는 별도.
- fallback 계층 명료성(`execute()` `?? 'webhook'` vs `resolveExecutionRunPriority` 내부 `undefined→schedule`) — dead path, 무해. (ai-review 와 동일 관찰.)
