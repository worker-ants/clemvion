# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 불필요.

검토 대상: `spec/5-system/4-execution-engine.md` + 구현 diff (PR1 `impl-exec-intake-queue`)
검토 모드: `--impl-done`
검토 일시: 2026-06-04

---

## 전체 위험도
**LOW** — Critical 없음. Warning 4건(spec 텍스트 불일치·등록 누락·plan 미등재)은 모두 기능 동작에 영향 없는 문서/등록 보완 사항.

---

## Critical 위배 (BLOCK 사유)

_해당 없음._

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W1 | Rationale Continuity | `ExecutionRunJob` payload 에 `triggerType` 필드 누락 — spec §4.2 명시 스키마와 불일치. 코드 TODO(PR2) 주석이 있으나 spec Rationale 에 공식 기록 없음 | `execution-run.queue.ts` `ExecutionRunJob` interface; `execution-engine.service.ts` `executionRunQueue.add()` | `spec/5-system/4-execution-engine.md §4.2` job 메시지 스키마 (`triggerType` 필드 명시) | (a) `ExecutionRunJob` 에 `triggerType?: ExecutionRunTriggerType` 추가하고 `execute()` 가 값 전달, 또는 (b) spec §4.2 에 "PR1 은 priority 계산에만 사용, PR2에서 payload 포함 예정" 주석 추가해 intent 공식화 |
| W2 | Rationale Continuity / Convention Compliance | `jobId` 스키마 diverge — spec §4.2 `<executionId>:run:<seq>` vs 구현 `executionId` 단독 사용. §9.2·§9.3 은 갱신됐으나 §4.2 원문 미수정으로 독자 혼동 가능 | `execution-run.queue.ts` `buildExecutionRunJobId()`; `execution-engine.service.ts` `execute()` | `spec/5-system/4-execution-engine.md §4.2` jobId 표기 | spec §4.2 에 "PR1 에서 jobId = executionId 로 구현됨 (1:1 enqueue, seq 불필요 — §9.2 참조)" 주석 추가, 또는 Rationale 에 "PR1 jobId 단순화 결정" 항목 추가 |
| W3 | Naming Collision | `execution-run` 큐가 `MONITORED_QUEUES` 및 e2e `EXPECTED_QUEUE_NAMES` 에 미등록 — 모니터링 공백 및 e2e 테스트 목록 불일치 | `system-status.constants.ts:44` `MONITORED_QUEUES`; `test/system-status.e2e-spec.ts:25` `EXPECTED_QUEUE_NAMES` | 기존 큐 등록 패턴 (`background-execution`, `execution-continuation` 등 12개) | `MONITORED_QUEUES` 에 `execution-run` 행 추가 (`resolveExecutionRunWorkerConcurrency()` 패턴 적용); `EXPECTED_QUEUE_NAMES` 에 `'execution-run'` 추가 |
| W4 | Plan Coherence | `spec/data-flow/3-execution.md` 시퀀스 다이어그램 + `spec/data-flow/0-overview.md §4` + `spec/5-system/16-system-status-api.md §1` 갱신이 어떤 in-progress plan 에도 미등재 | `exec-intake-queue-impl.md` §SPEC-DRIFT 반영 후속 항목 | `spec/data-flow/3-execution.md` (old in-process 흐름 stale); `spec/data-flow/0-overview.md §4` 큐 카탈로그; `16-system-status-api.md §1` | 위 세 파일 갱신을 project-planner 후속 plan 또는 기존 spec-sync plan 체크박스 항목으로 등재 |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I1 | Cross-Spec | spec/5-system/4-execution-engine.md 4곳(§4 배너·§9.2·§9.3·§11) 일관성 갱신 확인됨 — 추가 조치 불필요 | `spec/5-system/4-execution-engine.md` | 이미 처리됨 |
| I2 | Cross-Spec | `spec/0-overview.md` 는 origin/main 에서 이미 `execution-run` 큐 기술 포함 — 본 PR 변경 불필요 | `spec/0-overview.md §2.4` | 이미 처리됨 |
| I3 | Cross-Spec | `ExecutionRunTriggerType = 'manual' \| 'webhook' \| 'schedule'` 이 `spec/1-data-model.md §2.8` Trigger.type enum 과 완전 일치 | `execution-run.queue.ts` | 이미 처리됨 |
| I4 | Cross-Spec | CCH-AD-05 routing context 등록이 `execute()` → `runExecutionFromQueue()` 로 이동 — spec §7.5 Rationale 패턴과 정합 | `execution-engine.service.ts` | 이미 처리됨 |
| I5 | Rationale Continuity | `maxStalledCount: 0` — PR1 비멱등 보호 결정이 Rationale 명시와 일치. PR3/PR4 에서 stalled 재배달 활성화 시 Rationale "Planned" 항목도 함께 갱신 필요 | `execution-run.queue.ts L82` | 주의 사항으로 기록 |
| I6 | Convention Compliance | spec frontmatter `status: partial` 유지 적합 (§7.1·§8·우선순위 3-tier 미구현). `pending_plans:` 에 `exec-intake-queue-impl.md` 미등재 여부 확인 필요 | `spec/5-system/4-execution-engine.md` frontmatter | `pending_plans:` 에 `plan/in-progress/exec-intake-queue-impl.md` 추가 검토 |
| I7 | Convention Compliance | `spec/data-flow/0-overview.md §4` 큐 카탈로그에 `execution-run` 행 누락 (W3/W4 와 중복) | `spec/data-flow/0-overview.md §4` | W4 조치와 함께 처리 |
| I8 | Convention Compliance | 코드 명명·환경변수·에러 코드·Swagger/DTO 규약 모두 준수 확인 | 구현 파일 전체 | 추가 조치 불필요 |
| I9 | Plan Coherence | `spec-sync-execution-engine-gaps.md` §4 항목 (per-node 모델) 닫기 미완 — PR1 이 대체했으므로 "exec-intake-queue-impl.md PR1 으로 대체됨" 마커 추가 필요 | `plan/in-progress/spec-sync-execution-engine-gaps.md` | §4 항목에 "(per-node 모델 폐기 — PR1 으로 대체됨, 2026-06-04)" 마커 추가 |
| I10 | Plan Coherence | `spec-update-exec-intake-queue-pr1.md` draft plan 이 이미 적용 완료된 상태로 보임 — `plan/complete/` 이동 필요 | `plan/in-progress/spec-update-exec-intake-queue-pr1.md` | `plan/complete/` 로 이동 |
| I11 | Plan Coherence | `exec-intake-queue-impl.md` §PR TEST WORKFLOW — `/consistency-check --impl-done` 항목 본 검토 완료 후 체크 필요 | `plan/in-progress/exec-intake-queue-impl.md` | 본 검토 완료 후 해당 항목 닫기 |
| I12 | Plan Coherence | `rag-rerank-impl` worktree — Step 1 ancestor 음성·PR 없음. stale 가능성 높으나 보수 처리(active). `cleanup-worktree-all.sh --yes --force` 실행 후 재확인 권장 | `.claude/worktrees/rag-rerank-impl` | cleanup 후 재확인 |
| I13 | Naming Collision | `EXECUTION_RUN_WORKER_CONCURRENCY` 가 `system-status.constants.ts` concurrency 파생에 미반영 — W3 의 파생 이슈. W3 처리 시 `resolveExecutionRunWorkerConcurrency()` 패턴 함께 적용 | `system-status.constants.ts` | W3 조치와 함께 처리 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | spec 참조 영역(§4/§9/§11, 0-overview, 1-data-model, 15-chat-channel) 전체 일치. 충돌 없음 |
| Rationale Continuity | LOW | §4.2 job payload `triggerType` 누락(W1), `jobId` 형식 §4.2 미수정(W2) — 코드 주석에 intent 존재하나 spec 공식화 필요 |
| Convention Compliance | LOW | §4.2 jobId 표기 혼동 가능성(W2와 동일), `pending_plans:` 등재 확인 필요(I6) — CRITICAL 없음 |
| Plan Coherence | LOW | 후속 spec 갱신 3건 미등재(W4), spec-sync plan §4 닫기 미완(I9). `fix-bg-context-followups` worktree 동일 파일 수정이나 hunk 비겹침 |
| Naming Collision | LOW | `MONITORED_QUEUES` + `EXPECTED_QUEUE_NAMES` 미등록(W3). 의미 충돌 없음, 등록 누락만 |

---

## 권장 조치사항

1. **(W3 — 기능 영향)** `/Volumes/project/private/clemvion/codebase/backend/src/modules/system-status/system-status.constants.ts` `MONITORED_QUEUES` 에 `execution-run` 항목 추가 (`resolveExecutionRunWorkerConcurrency()` 패턴 적용). `/Volumes/project/private/clemvion/codebase/backend/test/system-status.e2e-spec.ts` `EXPECTED_QUEUE_NAMES` 에 `'execution-run'` 추가. 이 조치가 I13 도 해결.
2. **(W1 — spec 정합성)** `/Volumes/project/private/clemvion/spec/5-system/4-execution-engine.md §4.2` 에 "PR1 에서 `triggerType` 은 priority 계산에만 사용하고 payload 에 미포함; PR2(triggerType threading)에서 추가 예정" 주석 추가. 또는 `ExecutionRunJob` 에 `triggerType?: ExecutionRunTriggerType` 추가하고 `execute()` 가 값 전달.
3. **(W2 — spec 정합성)** `/Volumes/project/private/clemvion/spec/5-system/4-execution-engine.md §4.2` jobId 표기를 "PR1 에서 `jobId = executionId` (seq 불필요 — §9.2 참조)" 로 갱신. Rationale 에 "PR1 jobId 단순화 결정" 항목 추가도 권장.
4. **(W4 — plan 등재)** `spec/data-flow/3-execution.md` 시퀀스 다이어그램, `/Volumes/project/private/clemvion/spec/data-flow/0-overview.md §4`, `/Volumes/project/private/clemvion/spec/5-system/16-system-status-api.md §1` 갱신을 project-planner 후속 plan 또는 `spec-sync-execution-engine-gaps.md` 에 등재. I7 도 W4 조치 시 함께 처리.
5. **(I6)** `/Volumes/project/private/clemvion/spec/5-system/4-execution-engine.md` frontmatter `pending_plans:` 에 `plan/in-progress/exec-intake-queue-impl.md` 등재 여부 확인 및 필요 시 추가.
6. **(I9)** `/Volumes/project/private/clemvion/plan/in-progress/spec-sync-execution-engine-gaps.md` §4 항목에 "(per-node 모델 폐기 — exec-intake-queue-impl.md PR1 으로 대체됨, 2026-06-04)" 마커 추가.
7. **(I10)** `/Volumes/project/private/clemvion/plan/in-progress/spec-update-exec-intake-queue-pr1.md` 를 `plan/complete/` 로 이동.
8. **(I11)** `/Volumes/project/private/clemvion/plan/in-progress/exec-intake-queue-impl.md` `--impl-done` 항목 체크.