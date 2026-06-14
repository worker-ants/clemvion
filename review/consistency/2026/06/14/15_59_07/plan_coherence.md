# Plan 정합성 검토 결과

검토 대상 spec: `spec/5-system/14-external-interaction-api.md`
관련 in-progress plan 전수 확인 완료.

---

## 발견사항

### [INFO] spec-fix-eia-token-error-codes.md 의 미해결 체크박스가 target 에서 이미 반영됨

- **target 위치**: §5.1 에러 표 (TOKEN_REVOKED·TOKEN_SCOPE_MISMATCH·TOKEN_AUDIENCE_MISMATCH 행), §5.1 X-Refresh-Token-Url 노트, §3.4 EIA-RL-06, §9.3 Terminal token revoke 절, Rationale R14·R15
- **관련 plan**: `plan/in-progress/spec-fix-eia-token-error-codes.md` — 작업 단위 1·2·3 의 체크박스 전부 미완료(`[ ]`) 상태이며 `worktree: (unstarted)`
- **상세**:
  - 작업 단위 1 (`TOKEN_REVOKED` 행 추가, X-Refresh-Token-Url 헤더 일반화): target spec §5.1 에 이미 `401 TOKEN_REVOKED` 행과 "모든 401 토큰 실패 공통 X-Refresh-Token-Url 헤더" 노트가 존재한다.
  - 작업 단위 2 (`403 SCOPE_MISMATCH` → `401 TOKEN_SCOPE_MISMATCH` 통일 결정 필요): target spec §5.1 에 `401 TOKEN_SCOPE_MISMATCH` 행이 확정 반영됐고, Rationale R14 에 결정 근거(401 통일, 정보 노출 최소화)가 문서화됐다.
  - 작업 단위 3 (terminal revoke 신뢰성·fail-open 명시, outbox 전환 여부 결정): target §3.4 EIA-RL-06 에 at-least-once reconciliation sweep(BullMQ repeatable + `execution_token` 이중 경로)이 명시됐고, §9.3 에 fail-open 잔여 위험이 기술됐으며, Rationale R15 에 전용 outbox 미신설 + `execution_token` 기반 reconciliation 채택 근거가 정식 기록됐다.
  - plan 의 권장안(결정 1: 옵션A, 결정 2: 옵션A, 결정 3: 옵션C + 후속 A)과 target spec 의 내용이 일치한다.
- **제안**: `plan/in-progress/spec-fix-eia-token-error-codes.md` 의 작업 단위 1·2·3 체크박스를 `[x]` 로 표시하고 `plan/complete/` 로 이동할 것. 결정 3 권장안의 "후속 구현 plan 신설(outbox 전환)" 은 target spec §9.3 Reconciliation sweep 이 `execution_token` 기반 sweep 으로 확정됐으므로 신규 구현 plan 불필요함을 완료 이동 시 주석에 포함할 것.

---

### [INFO] fix-webchat-sse-field-map.md 의 비차단 followup — target 와 충돌 없음

- **target 위치**: §6.2/§6.5 SSE wire 필드 노트 (target 에 반영 완료)
- **관련 plan**: `plan/in-progress/fix-webchat-sse-field-map.md` 마지막 체크박스 `[ ] plan complete 이동` 미완료
- **상세**: plan 의 완료 항목은 target spec 과 일치한다. 미완료 체크박스는 plan complete 이동 여부뿐이며 target spec 내용과 충돌 없음.
- **제안**: 정합성 관점 조치 불요.

---

### [INFO] spec-sync-external-interaction-api-gaps.md 의 미구현 항목 — target 에 "Planned" 로 이미 명시, 충돌 없음

- **target 위치**: §3.1 EIA-NX-06/EIA-NX-11, §5.1 RATE_LIMITED 에러 표, §5.3 currentNode/context/seq placeholder 노트, §5.2 replay_unavailable 계획·미구현 노트
- **관련 plan**: `plan/in-progress/spec-sync-external-interaction-api-gaps.md`
- **상세**: plan 의 미구현 항목 4건은 target spec 에도 동일하게 "미구현(Planned)" 으로 표기돼 있다. 충돌 없음.
- **제안**: 조치 불요.

---

## 요약

Plan 정합성 관점의 핵심 발견은 `plan/in-progress/spec-fix-eia-token-error-codes.md`(worktree: unstarted)가 "결정 필요"로 남긴 세 작업 단위(TOKEN_REVOKED 에러 표 추가, 403→401 SCOPE_MISMATCH 통일, terminal revoke 신뢰성 명시)가 target spec 에 이미 전부 반영·결정 완료된 상태라는 점이다. 이는 미해결 결정을 우회한 CRITICAL 이 아니라 plan 추적 상태가 실제 spec 진행보다 뒤처진 INFO 수준 불일치다. target spec 은 plan 이 권장한 방향(결정 1·2 옵션A, 결정 3 옵션C+후속A)을 정확히 채택했으며, 다른 in-progress plan 과의 충돌도 없다. plan 문서 자체의 체크박스 갱신 및 complete 이동이 후행하고 있을 뿐이다.

## 위험도

LOW
