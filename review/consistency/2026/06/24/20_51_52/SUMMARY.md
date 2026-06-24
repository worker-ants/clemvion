# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 구현 착수 가능.

검토 모드: `--impl-prep`
검토 범위: `06-concurrency C-1 + M-7` (publish fail-fast 통일)
- C-1: `cancelWaitingExecution` async 전환 + `ContinuationPublishResult` 반환으로 4개 continuation 메서드 패턴 통일; REST `stop()` WAITING 분기 `queued=false` 시 503 `CONTINUATION_ENQUEUE_FAILED` 반환
- M-7: `ContinuationBusService.nextSeq` Redis INCR 실패 시 random fallback 제거 → throw 전파 → publish `null`(`queued:false`) 반환 (seq idempotency key 계약 §7.4/§9.2 복원)

---

## 전체 위험도

**MEDIUM** — Critical 없음. WARNING 3건(에러코드 prefix 불일치, 카탈로그 등재 merge-gate 미명시, 호출부 반환 타입 void 가정). 전부 구현 착수 전/중 반영 가능.

> **main 처분 (구현에 반영)**: W-1 → 에러코드를 **`EXECUTION_ENQUEUE_FAILED`** 로 채택(EXECUTION_* 네임스페이스 준수). W-2 → plan/PR 에 카탈로그 등재 merge-gate 명시. W-3 → async 전환에 따른 호출부 `await`+503 동반 수정 + 모든 테스트 mock `mockResolvedValue` 전환. I-4 → 503 근거 주석.

---

## Critical 위배 (BLOCK 사유)

없음.

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 | main 처분 |
|---|---------|------|-------------|-----------|------|------|
| W-1 | convention_compliance | 신규 에러코드 `CONTINUATION_ENQUEUE_FAILED` 의 prefix 가 `EXECUTION_*` 네임스페이스 규칙과 불일치 | 구현 착수 전 단계 | `spec/5-system/4-execution-engine.md §7.5.2` | `EXECUTION_ENQUEUE_FAILED` 로 rename 또는 planner spec 갱신 | **반영** — `EXECUTION_ENQUEUE_FAILED` 채택 |
| W-2 | convention_compliance | 에러코드 카탈로그 등재(`3-error-handling.md §1`) 유예에 merge-gate 미명시 — 영구 드리프트 위험 | `plan/.../06-concurrency.md` C-1 | `spec/conventions/error-codes.md §1` | merge-gate 명시 | **반영** — plan/PR 에 sibling spec-sync merge-gate 명시 |
| W-3 | naming_collision | `cancelWaitingExecution` void→Promise 변경 시 호출부/테스트 mock 이 void 가정 | `executions.service.ts:730`; `websocket.gateway.spec.ts:78`; `execution-engine.service.spec.ts:1143-1144,4173` | C-1 async 서명 | 호출부 await+503, mock mockResolvedValue 전환 | **반영** — 구현 범위 포함 |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I-1 | cross_spec | REST `stop()` WAITING 503 동작이 spec 미기술 (기존 503 사용처는 §11 shutdown 뿐) | `4-execution-engine.md §7.4·§7.5`; `2-api-convention.md §6` | spec-sync 시 1줄 추가 |
| I-2 | cross_spec | `cancelWaitingExecution` async 전환이 §7.5.2 "4종 continuation 핸들러" 목록에 cancel 미포함 | `4-execution-engine.md §7.5.2` | spec-sync 시 cancel 추가 또는 "continuation 핸들러"로 일반화 |
| I-3 | cross_spec | M-7 INCR throw → publish null → `queued:false` 인과가 spec 미기술 (계약 복원은 정합) | `4-execution-engine.md §7.4`; `6-websocket-protocol.md §4.2` | spec-sync 시 1줄 추가 |
| I-4 | convention_compliance | REST `stop()` 503 선택 근거 미명시 | `2-api-convention.md §6` | 코드 주석/PR 에 503 근거 1줄 — **반영** |
| I-5 | convention_compliance | `executions.service.ts:730` await 누락 시 `queued=false` 표면 무력화 주의 | 동 | await+503 (W-3 중복) — **반영** |
| I-6 | plan_coherence | C-1 spec 갱신 의무가 sibling defer 인데 전용 spec-sync plan 미존재 | `06-concurrency.md` C-1 | plan 체크리스트 후속 명시 — **반영** |
| I-7 | plan_coherence | C-2(결정 대기·착수 금지)와 경계 분리 — 충돌 없음 확인 | `06-concurrency.md` C-2 | 현 범위 그대로 진행 |
| I-8 | naming_collision | `ContinuationPublishResult` 기존 인터페이스 재사용 — 충돌 없음 | `execution-engine.service.ts:329` | 변경 없음 |
| I-9 | naming_collision | 신규 에러코드 기존과 미충돌 | `3-error-handling.md` 미등재 | PR 후 planner 카탈로그 등재 |
| I-10 | naming_collision | `ContinuationBusService.nextSeq` 와 `ConversationThread.nextSeq` 동명 — 경로 분리, 실질 충돌 없음 | `continuation-bus.service.ts:153` | 주석 권장 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | spec 직접 모순 없음. 3건 INFO — 모두 scope-defer 범위 |
| rationale_continuity | success | 번복 없음 |
| convention_compliance | MEDIUM | W-1·W-2 + INFO 2건 |
| plan_coherence | LOW | INFO 2건 |
| naming_collision | LOW | W-3 + INFO 3건 |

---

## 권장 조치사항 (main 반영 상태)

1. **(W-1 ✅반영)** 에러코드 `EXECUTION_ENQUEUE_FAILED` 채택 (EXECUTION_* 네임스페이스 준수).
2. **(W-2 ✅반영)** plan/PR 에 spec-sync merge-gate 명시: "에러코드 카탈로그 등재 + §7.4/§7.5 cancel publish 실패 surface — sibling planner PR 동행 머지".
3. **(W-3 ✅반영)** `executions.service.ts` await+503; 테스트 mock 전환.
4. **(I-4 ✅반영)** 503 근거 주석 (api-convention §6 — Redis 의존성 장애 = upstream 불가 → 503).
