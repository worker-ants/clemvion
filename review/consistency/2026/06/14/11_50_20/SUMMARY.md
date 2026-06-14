# Consistency Check 통합 보고서 (--impl-done)

**BLOCK: NO** — Critical 발견 없음. 구현 진행 가능.

## 전체 위험도
**MEDIUM** — plan 상태 불일치(spec 갱신 완료인데 "⏳" 미해소) 및 plan 선행조건("spec 결정 확정 → consistency-check --spec → 구현") 이행 여부 확인 권고. spec 내 식별자 충돌·원칙 위반은 없으며 경미한 WARNING 4건이 남는다.

---

## Critical 위배 (BLOCK 사유)

_해당 없음._

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W-1 | Plan Coherence | `plan/in-progress/refactor/04-security.md` M-5 "⏳ spec 갱신" 체크박스가 완료 처리되지 않아 plan 상태와 실제 spec 불일치 | `spec/5-system/1-auth.md §2.3` | `plan/in-progress/refactor/04-security.md` M-5 | M-5 의 "⏳ spec 갱신 (planner)" 항목을 완료 처리(체크)로 갱신 |
| W-2 | Plan Coherence | `execution-engine-typed-errors.md` plan 이 "spec 결정 확정 → consistency-check --spec → 구현" 선행조건을 명시하나, 현재 worktree 가 해당 plan 에 대응하는 구현 worktree임 — spec 미반영 상태에서 구현이 앞서나갔는지 확인 필요 | `spec/5-system/4-execution-engine.md §7.5.1` + `spec/5-system/6-websocket-protocol.md` | `plan/in-progress/execution-engine-typed-errors.md` | spec 갱신이 이미 diff 에 포함됐다면 이 경고는 해소됨 |
| W-3 | Convention Compliance | `spec/5-system/1-auth.md §1.4.3`/`§5` WebAuthn availability 응답 래퍼 표기 혼재 | `spec/5-system/1-auth.md` | `spec/conventions/swagger.md §2-5` | 응답 표기 통일 |
| W-4 | Naming Collision | `EXECUTION_INTERNAL_ERROR`(신규 ErrorCode) vs `INTERNAL_ERROR`(기존 WsErrorCode) scope 혼동 가능성 | `spec/5-system/3-error-handling.md §1.5`, `§7.5.2` | `ws-error-codes.ts` L19, `6-websocket-protocol.md §5` | 현행 방향(§7.1 표 "별개 scope" 주석 추가됨)으로 충분. `ws-error-codes.ts` scope 주석 보강 가능 |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I-1 | Cross-Spec | `EXECUTION_MESSAGE_TOO_LONG` 최대 길이(10000자) 수치가 `6-websocket-protocol.md §4.2` 에만 명시 | `§7.5.2`, `§1.5` | `§7.5.2` 에 수치 추가 또는 링크 |
| I-2 | Rationale Continuity | `ExecutionTimeLimitError` 가 §7.5.2 "선례" 목록에 열거되나 코드는 미상속 — ack 경로 미도달이라 영향 없음 | `§7.5.2 선례 정합` | "아직 미상속, 점진 흡수 예정" 괄호 추기 |
| I-3 | Convention Compliance | `10-graph-rag.md` Rationale 섹션 부재 (pre-existing) | `10-graph-rag.md` | 권장, 강제 아님 |
| I-4 | Convention Compliance | `1-auth.md` Overview 섹션 부재 (pre-existing) | `1-auth.md` | 권장, 강제 아님 |
| I-5 | Plan Coherence | `refactor-04-followup-pwchange-userip.md` B-1 (Rationale 4.1.B) — #582 머지로 해소 (reconcile PR #596) | `1-auth.md §4.1` | (해소됨) |
| I-6 | Plan Coherence | `04-security.md` M-3 spec 갱신 ⏳ (pre-existing) | `spec/5-system/` | planner 트랙 |
| I-7 | Plan Coherence | `1-auth.md §5` reveal 엔드포인트 표 누락 (pre-existing) | `1-auth.md §5` | `auth-config-webhook-followups.md §3` |
| I-8 | Naming Collision | `ExecutionError` vs `CodeExecutionError` 접두어 유사 — 진성 충돌 없음 | `code.handler.ts` L129 | 격리 유지 |

---

## 처리 결정 (main, 2026-06-14)

- **W-2 해소**: 본 worktree 의 diff 에 spec §7.5.2 + WS ack 표 + §1.5 카탈로그 + Rationale 가 **포함**됨 (commit 39ed7d31). 선행조건 충족 — 경고 해소.
- **W-4 / I-2**: spec §7.1 표에 scope 주석 + workflow-errors.ts `ExecutionTimeLimitError` 경계 주석 이미 반영(ai-review I-3·I-6 fix). spec 선례 목록의 "점진 흡수 예정" 표현은 §7.5.2 본문에 이미 "점진적으로 흡수" 로 명시됨 — 추가 조치 불요.
- **W-1 / W-3 / I-3 / I-4 / I-6 / I-7**: 전부 **선존(pre-existing)·본 변경 무관** spec/plan nit (auth·security·graph-rag 영역). 각 planner 트랙 follow-up.
- **I-1**: §7.5.2 에 10000자 수치 추가는 cheap polish — 후속 nit (수치 SoT 는 §4.2 가 유지, code 의 MAX_MESSAGE_LENGTH 가 진실).
- **I-5**: PR #596 reconcile 로 이미 해소.

**결론**: BLOCK: NO. 본 변경 직접 유발 Critical/Warning 없음. 진행.
