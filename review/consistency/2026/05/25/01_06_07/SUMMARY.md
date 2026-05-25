# Consistency Check 통합 보고서 (spec-fix-graceful-shutdown-phase-scope)

**대상 draft**: `plan/in-progress/spec-fix-graceful-shutdown-phase-scope.md`
**검토 모드**: `--spec`
**검토 일자**: 2026-05-25
**세션**: `review/consistency/2026/05/25/01_06_07`

---

**BLOCK: NO**

> Cross-Spec checker 가 보고한 CRITICAL 3건은 **stale view false-positive**. checker 가 §11 / §7.5 / `SERVER_INTERRUPTED` 어휘가 "현재 spec 에 없다" 고 판정했으나, 현재 worktree 의 `spec/5-system/4-execution-engine.md` line 967 (§11 Graceful Shutdown) / line 786 (§7.5 Resume after Restart) / `spec/1-data-model.md` line 436 (SERVER_INTERRUPTED 등) 에 commit `81631c3b` (Phase 0 spec 갱신) 으로 모두 추가됨. checker base view 가 origin/main 또는 부분 fetched 상태였을 가능성.

## 전체 위험도

**LOW** — CRITICAL 3건 모두 false-positive. 실 WARNING 5건 (모두 본 spec fix 안에서 텍스트 보강으로 해소 가능).

## Critical (false-positive)

| # | Checker | 보고 | 실제 |
|---|---|---|---|
| FP-1 | cross_spec | "§11 참조 대상 섹션이 실재하지 않음" | §11 (line 967) 존재 — commit 81631c3b |
| FP-2 | cross_spec | "§7.5 참조 대상 섹션이 실재하지 않음" | §7.5 (line 786) 존재 |
| FP-3 | cross_spec | "§2.13 error.code 어휘가 현재 spec 에 전혀 미정의" | spec/1-data-model.md line 436 에 SERVER_INTERRUPTED / RESUME_FAILED 등 모두 등재됨 |

## Warning (실제 — 본 draft 내 해소)

| # | Checker | 발견 | 해소 |
|---|---|---|---|
| W-1 | cross_spec | "현황 분석" 의 `POST /api/executions/start` 가 어느 spec 에도 없는 endpoint | `POST /api/workflows/:id/execute` 로 정정 (spec 적용 시 본 SUMMARY 메모로 처리) |
| W-2 | cross_spec | 503 HTTP 상태 코드가 `spec/5-system/2-api-convention.md §6` 테이블에 미정의 | spec §11 의 자체 정의로 충분 (graceful shutdown 한정 특수 케이스) — api-convention §6 cross-link 추가 옵션 |
| W-3 | cross_spec | "WS `execution.start` 가 미구현" 표현 — spec §8.2 에는 정의되어 있음 | "spec §8.2 에 정의되어 있으나 Phase 1 구현 범위에서 gateway handler 제외" 로 정정 |
| W-4 | plan_coherence | `WORKER_HEARTBEAT_TIMEOUT` 추가가 Phase 0 완료 표시와 불일치 (Phase 0 이후 발견된 누락) | spec 적용 시 Phase 0 sub-task 로 별도 표기 |
| W-5 | plan_coherence | `retry-handler-followup.md` WARNING #2 갱신 미실행 | **이미 commit 81631c3b 에 포함됨** (Phase 0 spec PR) — false-positive |

## Checker별 위험도

| Checker | 결과 | 위험도 |
|---|---|---|
| cross_spec | 3 CRITICAL (FP) + 3 WARNING | HIGH (보고) → LOW (실제) |
| rationale_continuity | 4 INFO | LOW |
| convention_compliance | 5 INFO | LOW |
| plan_coherence | 2 WARNING (1 FP) + 3 INFO | LOW |
| naming_collision | 5 INFO | LOW |

## 적용 절차

CRITICAL 가 모두 false-positive 이므로 BLOCK 해제. 본 draft 의 3가지 변경을 직접 spec 에 반영하면 됨:

1. **spec §11 step 1** Phase 1 scope 명시 (HTTP 만, WS Phase 2 예정)
2. **spec §11 step 4** Phase 1 = stop 정책 동등 처리 명시 (continue 분기 Phase 2)
3. **spec/1-data-model.md §2.13** `WORKER_HEARTBEAT_TIMEOUT` 코드 어휘 추가

추가 보정 (위 WARNING):
- draft `## 현황 분석` 의 `POST /api/executions/start` 표기를 정정 (적용 메모만)
- draft `## 현황 분석` 의 "WS `execution.start` 미구현" 표현 정정 (적용 메모만)
