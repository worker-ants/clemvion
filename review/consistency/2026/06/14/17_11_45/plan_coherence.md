# Plan 정합성 검토 결과

## 검토 대상

- **Target**: `spec/5-system/14-external-interaction-api.md` (impl-done scope, diff base `3064c9c6`)
- **구현 diff**: `interaction-token.service.ts` 상수 rename (`TERMINAL_STATUSES` → `RECONCILE_TERMINAL_STATUSES`) + `system-status.constants.ts` 에 `TERMINAL_REVOKE_RECONCILE_QUEUE` 등록 + e2e queue 목록 갱신
- **관련 plan**: `plan/in-progress/spec-fix-eia-token-error-codes.md`, `plan/in-progress/spec-sync-external-interaction-api-gaps.md`

---

## 발견사항

### [WARNING] `spec-fix-eia-token-error-codes.md` 체크박스 미완료 상태이나 spec 은 이미 결정 반영

- **target 위치**: spec §5.1 에러 표 (`TOKEN_REVOKED` / `TOKEN_SCOPE_MISMATCH` / `TOKEN_AUDIENCE_MISMATCH` 행), §3.4 EIA-RL-06, §9.3 terminal revoke, R14, R15, §7.3, §10 파일 목록
- **관련 plan**: `plan/in-progress/spec-fix-eia-token-error-codes.md` 작업 단위 1·2·3 (전 체크박스 미완)
- **상세**: plan 의 결정 1(TOKEN_REVOKED 추가), 결정 2(401 TOKEN_SCOPE_MISMATCH 통일), 결정 3(at-least-once revoke — 옵션 A 방향의 reconciliation sweep)이 모두 plan 권장안대로 target spec 에 이미 반영돼 있다. 그러나 plan 의 작업 단위 1·2·3 체크박스는 여전히 미완(`- [ ]`)으로 남아 있다. 이는 "결정 필요" 로 열린 항목이 사실상 합의·반영됐음에도 plan 상태가 in-progress 로 유지되는 추적 불일치다. 구현 diff 자체는 이 결정들과 충돌하지 않고 오히려 R15(reconciliation sweep)를 코드 수준에서 보강한다.
- **제안**: `plan/in-progress/spec-fix-eia-token-error-codes.md` 의 작업 단위 1·2·3 체크박스를 완료(`- [x]`)로 갱신하고, plan 을 `plan/complete/` 로 이동. 또는 최소한 체크박스를 현재 spec 반영 상태로 업데이트해 "결정 필요" 상태가 오해되지 않도록 한다.

---

### [INFO] 결정 3 권장안(옵션 C → A 분리) 대비 실구현 방향 추적 메모

- **target 위치**: spec §3.4 EIA-RL-06, §7.3, §9.3, R15, §10 `terminal-revoke-reconciler.service.ts`
- **관련 plan**: `plan/in-progress/spec-fix-eia-token-error-codes.md` 결정 3 권장안 ("C(now) → A(follow-up)")
- **상세**: plan 의 결정 3 권장안은 "옵션 C(doc-only, fail-open 명시)를 즉시 반영하고 옵션 A(outbox 전환)는 후속 plan 신설"이었다. 그러나 target spec 은 C가 아니라 사실상 A에 해당하는 `execution_token` 기반 reconciliation sweep(`TerminalRevokeReconcilerService`, BullMQ repeatable scheduler)을 R15로 완전히 채택해 spec 과 코드 모두에 반영했다. "후속 plan 신설" 항목(작업 단위 3 마지막 체크박스 "결정이 outbox 전환이면 후속 구현 plan 신설")에 해당하는 별도 plan 이 존재하지 않으며, 이미 구현이 완료된 것으로 보인다. 결정 방향이 plan 권장안보다 진행됐을 뿐 충돌은 아니므로 INFO 등급. 다만 "후속 plan 신설" 의무가 이행됐는지(또는 동일 worktree 에서 함께 처리됐는지) 추적이 필요하다.
- **제안**: `spec-fix-eia-token-error-codes.md` 결정 3 의 "결정이 outbox 전환이면 후속 구현 plan 신설" 체크박스 이행 여부를 확인하고, 이미 구현 완료라면 plan 체크박스를 갱신해 추적을 마무리한다.

---

### [INFO] `spec-sync-external-interaction-api-gaps.md` 와의 관계 — 코드 변경은 미구현 항목에 영향 없음

- **target 위치**: 구현 diff (interaction-token.service.ts 상수 rename, system-status.constants.ts 등록)
- **관련 plan**: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` (미구현 항목: backoff 배율, 분산 SSE fan-out, rate-limit, currentNode/context/seq 실값, replay_unavailable)
- **상세**: 금번 diff 는 `RECONCILE_TERMINAL_STATUSES` rename(코드 가독성 개선)과 `TERMINAL_REVOKE_RECONCILE_QUEUE` system-status 등재로 한정된다. `spec-sync-external-interaction-api-gaps.md` 의 미구현 항목(backoff 배율, 분산 fan-out, rate-limit, status endpoint 실값, replay_unavailable)과는 직교하며 어느 항목도 무효화하거나 새 후속 항목을 만들지 않는다.
- **제안**: 별도 조치 불필요. 참고 기록용.

---

## 요약

금번 구현 diff (`interaction-token.service.ts` 상수 rename + `system-status.constants.ts` 큐 등록)는 `plan/in-progress/spec-fix-eia-token-error-codes.md` 가 미해결로 남긴 결정들과 충돌하지 않는다. 오히려 target spec 이 plan 의 권장안(결정 1·2·3)을 이미 반영하고 있고 코드 diff 는 그와 정합하는 보강 작업이다. 핵심 문제는 plan 체크박스가 갱신되지 않아 실제로 해소된 결정들이 여전히 "결정 필요" 상태로 보인다는 추적 불일치(WARNING)다. `spec-sync-external-interaction-api-gaps.md` 의 잔여 미구현 항목은 이번 diff 와 무관하게 유지된다.

## 위험도

LOW
