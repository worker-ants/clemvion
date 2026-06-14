# Plan 정합성 검토 결과

**대상 문서**: `spec/5-system/14-external-interaction-api.md`
**검토 모드**: spec draft (--spec)
**관련 plan**: `plan/in-progress/spec-fix-eia-token-error-codes.md`, `plan/in-progress/spec-sync-external-interaction-api-gaps.md`, `plan/in-progress/fix-webchat-sse-field-map.md`

---

## 발견사항

### [WARNING] `spec-fix-eia-token-error-codes.md` 체크박스가 미갱신 상태로 잔존

- **target 위치**: 해당 없음 (target 은 올바르게 반영됨)
- **관련 plan**: `plan/in-progress/spec-fix-eia-token-error-codes.md` — 작업 단위 1, 2, 3 의 모든 체크박스가 `[ ]` 미완으로 잔존. `worktree: (unstarted)` 표기도 그대로.
- **상세**: target 문서(커밋 `5d5dfe18`)는 사용자 결정(D1=A, D2=A, D3=A)을 이미 적용했다. §5.1 에 `TOKEN_REVOKED`·`TOKEN_AUDIENCE_MISMATCH` 행 추가, `SCOPE_MISMATCH→401 TOKEN_SCOPE_MISMATCH` 수정, `X-Refresh-Token-Url` 노트 일반화(D1/D2), §3.4 `EIA-RL-06` + §9.3 reconciliation sweep + §R14/R15 신설(D3)이 모두 반영됐다. 그러나 plan 파일은 작업이 완료됐음을 전혀 반영하지 않아 추적 정합이 깨진다.
- **제안**: plan `spec-fix-eia-token-error-codes.md` 의 작업 단위 1·2·3 체크박스를 `[x]` 로 체크하고, 이 plan 을 `plan/complete/` 로 이동. worktree 표기도 실제 작업이 수행된 `eia-token-codes-revoke-outbox-2639e5` 로 갱신 필요.

### [WARNING] D3=A(reconciliation sweep) 선택에 따른 후속 구현 plan 미신설

- **target 위치**: `spec/5-system/14-external-interaction-api.md` §3.4 `EIA-RL-06`, §7.3 `execution_token`, §9.3 Terminal token revoke, §R15
- **관련 plan**: `plan/in-progress/spec-fix-eia-token-error-codes.md` 결정 3 / 작업 단위 3 마지막 체크박스 ("결정이 outbox 전환이면 후속 구현 plan 신설")
- **상세**: target spec 은 §9.3·§R15 에서 (1) live fast-path + (2) BullMQ repeatable scheduler 기반 `execution_token` reconciliation sweep 을 필수(EIA-RL-06) 로 명시했다. 이 sweep 은 현재 미구현 신규 구현체다. plan 의 "결정이 outbox 전환이면 후속 구현 plan 신설" 트리거가 발동됐으나(D3=A 결정), `plan/in-progress/` 에 EIA terminal revoke 구현 plan 이 존재하지 않는다. `spec-sync-external-interaction-api-gaps.md` 의 기존 미구현 항목 목록에도 이 항목이 없다.
- **제안**: `plan/in-progress/` 에 EIA terminal revoke reconciliation 구현 plan 을 신설하고, BullMQ repeatable scheduler + `execution_token` sweep 구현(§9.3·§R15)을 항목으로 등록. 아울러 `spec-sync-external-interaction-api-gaps.md` 에 이 항목을 미구현 행으로 추가해 두 plan 이 정합되도록 한다.

### [INFO] `spec-sync-external-interaction-api-gaps.md` 미구현 항목 목록에 신규 EIA-RL-06 항목 미등재

- **target 위치**: `spec/5-system/14-external-interaction-api.md` §3.4 `EIA-RL-06`
- **관련 plan**: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` (미구현 항목 4건)
- **상세**: target 변경이 `EIA-RL-06` terminal revoke at-least-once(reconciliation sweep)를 필수 요구사항으로 추가했으나, `spec-sync-external-interaction-api-gaps.md` 의 미구현 목록에 해당 항목이 없어 추적 누락.
- **제안**: WARNING 2 의 구현 plan 신설 시 cross-link 로 연결하거나, `spec-sync-external-interaction-api-gaps.md` 에 직접 행으로 등재.

---

## 요약

target 문서는 `spec-fix-eia-token-error-codes.md` 의 세 결정(TOKEN_REVOKED 행 추가 / 401 통일 / terminal revoke at-least-once)을 정상적으로 반영했으며, 미해결 결정을 우회하거나 선행 plan 을 미해소한 CRITICAL 사항은 없다. 그러나 plan 파일 자체가 완료로 갱신되지 않았고(체크박스 전원 미완·worktree 미기재), 사용자가 권장안(C)을 초과해 선택한 D3=A(outbox/reconciliation)에 따라 발동된 "후속 구현 plan 신설" 트리거가 이행되지 않아 두 건의 WARNING 이 발생한다. 두 WARNING 모두 target spec 변경 자체의 정합 문제가 아니라 plan 추적 문서의 갱신 누락이다.

---

## 위험도

LOW
