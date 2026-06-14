# Plan 정합성 검토 결과

검토 대상: `spec/5-system/14-external-interaction-api.md` (구현 완료 후 diff — `TerminalRevokeReconcilerService` + `reconcileTerminalRevocations`)
관련 plan: `plan/in-progress/spec-fix-eia-token-error-codes.md`, `plan/in-progress/spec-sync-external-interaction-api-gaps.md`

---

## 발견사항

### 1. [WARNING] 결정 3(terminal revoke 신뢰성) — 미해결 결정을 구현이 선점

- **target 위치**: spec §3.4 EIA-RL-06 / §9.3 Terminal token revoke 절 / §Rationale R15
- **관련 plan**: `plan/in-progress/spec-fix-eia-token-error-codes.md` §결정 3 (체크박스 미완)
- **상세**:
  plan `spec-fix-eia-token-error-codes.md` 결정 3 은 terminal revoke 신뢰성 강화 방향을 아직 확정하지 않은 상태다. 해당 plan 의 권장안은 "옵션 C(doc-only: fail-open 잔여 위험 명시)를 즉시 반영하고 옵션 A(outbox 전환)는 후속 구현 plan 으로 분리 신설" 이었다.

  그러나 target diff 는 `TerminalRevokeReconcilerService`(BullMQ repeatable scheduler, 분 단위)와 `InteractionTokenService.reconcileTerminalRevocations()`를 이미 구현하고, spec §3.4 EIA-RL-06 / §9.3 / R15 를 "execution_token 자체를 outbox 로 활용하는 at-least-once sweep" 모델로 정식 명시했다. 이는 plan 이 "별도 후속 plan 신설" 을 통해 결정하기로 예약했던 항목(옵션 A 변형)을 사전 합의 없이 구현+spec 확정한 것이다.

  방향 자체는 plan 의 최종 지향(옵션 C → 옵션 A)과 어긋나지 않으나, plan 의 체크박스 "결정이 outbox 전환이면 후속 구현 plan 신설"이 여전히 미완인 상태에서 구현이 먼저 완료되었다. plan 이 "결정 필요" 로 남겨둔 사용자 결정 합의 단계(별도 후속 구현 plan 신설 포함)를 건너뛴 형태다.

- **제안**: `plan/in-progress/spec-fix-eia-token-error-codes.md` 결정 3 체크박스를 완료 처리하고, "옵션 A 의 execution_token 기반 변형으로 결정 — `TerminalRevokeReconcilerService` 구현 완료, spec §3.4/§9.3/R15 에 반영됨" 으로 기록한다. 별도 후속 구현 plan 신설 항목은 "불필요 — 현 diff 에서 완료" 로 닫는다. plan 을 `plan/complete/` 로 이동할 수 있는지 나머지 체크박스(결정 1·2)의 상태도 함께 확인 필요.

---

### 2. [INFO] 결정 1·2 (에러 코드 표 갱신) — spec 이 이미 반영된 상태, plan 체크박스 미완

- **target 위치**: spec §5.1 에러 표 (`TOKEN_REVOKED`, `TOKEN_SCOPE_MISMATCH`, `TOKEN_AUDIENCE_MISMATCH` 행, `X-Refresh-Token-Url` 헤더 주석, `§Rationale R14`)
- **관련 plan**: `plan/in-progress/spec-fix-eia-token-error-codes.md` 작업 단위 1·2 (체크박스 미완)
- **상세**:
  target spec 의 §5.1 에러 표에는 `TOKEN_REVOKED`(401) 행, `TOKEN_SCOPE_MISMATCH`(401) 행, `TOKEN_AUDIENCE_MISMATCH`(401) 행, 그리고 "모든 401 토큰 실패에 `X-Refresh-Token-Url` 헤더 동봉" 노트가 이미 존재한다. R14 도 "모두 401 통일" 근거로 정식 추가되어 있다. 즉 plan 결정 1·2 에서 "결정 필요"로 남겼던 두 항목(옵션 A 방향)이 이미 spec 에 반영된 상태다.

  plan 의 체크박스(작업 단위 1·2)는 미완으로 표시되어 있어 추적 불일치 상태다.

- **제안**: `plan/in-progress/spec-fix-eia-token-error-codes.md` 작업 단위 1·2 체크박스를 완료 처리한다. plan 의 수용 기준 3개가 모두 충족되었으므로 plan 전체를 `plan/complete/` 로 이동하는 것이 적합하다.

---

### 3. [INFO] `spec-sync-external-interaction-api-gaps.md` — reconciliation sweep 항목 추적 메모

- **target 위치**: 해당 없음 (target diff 에서 추가 구현된 영역)
- **관련 plan**: `plan/in-progress/spec-sync-external-interaction-api-gaps.md`
- **상세**:
  `spec-sync-external-interaction-api-gaps.md` 는 EIA 미구현 항목을 추적한다. 현재 4개 항목(backoff 배율, 분산 SSE/notification, rate-limit, status 조회 currentNode/context/seq)이 남아 있는데, terminal revoke reconciliation sweep 은 이 plan 에 없는 항목이었고 target diff 에서 완료되었다. plan 에 별도 항목이 없었으므로 누락 항목 추가 후 완료 처리가 필요하지는 않으나, 구현 완료 사실 추적 메모를 plan 에 남겨두면 나중에 audit 할 때 유리하다.

- **제안**: 선택 사항. `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 "terminal revoke reconciliation(EIA-RL-06) — `TerminalRevokeReconcilerService` 구현 완료(별도 추적 항목 아니었음)" 비고를 추가하면 추적 완결성이 높아진다.

---

## 요약

핵심 정합 이슈는 `plan/in-progress/spec-fix-eia-token-error-codes.md` 의 결정 3 이다. 해당 plan 은 terminal revoke 신뢰성 강화 방향을 "옵션 C(doc-only) 즉시 반영 + 옵션 A(outbox 전환)는 후속 plan" 으로 예약했으나, target 구현 diff 는 `TerminalRevokeReconcilerService`(`execution_token` 기반 BullMQ reconciliation)를 이미 완료하고 spec §3.4/§9.3/R15 에 정식 반영했다. 구현 방향은 plan 의 최종 지향과 충돌하지 않지만, plan 이 "별도 후속 구현 plan 신설" 을 통해 합의하기로 예약했던 절차를 건너뛰었다. 추가로 결정 1·2(에러 코드·헤더 표 갱신)도 spec 에 이미 반영되어 있으나 plan 체크박스는 미완 상태라 추적 불일치가 있다. 두 이슈 모두 구현 방향이 잘못된 것은 아니며 plan 을 현실에 맞게 갱신·완료 처리하는 것으로 해소 가능하다.

## 위험도

LOW
