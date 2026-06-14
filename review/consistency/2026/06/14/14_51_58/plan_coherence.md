# Plan 정합성 검토 — spec/5-system/14-external-interaction-api.md

## 발견사항

### 1. [WARNING] `spec-fix-eia-token-error-codes.md` 의 미결 결정 — SCOPE_MISMATCH status/code 가 target 에 부정합 상태로 잔존

- **target 위치**: §5.1 에러 표 `TOKEN_SCOPE_MISMATCH` 행 (403 Forbidden)
- **관련 plan**: `plan/in-progress/spec-fix-eia-token-error-codes.md` §2 "결정 2 — SCOPE_MISMATCH HTTP status/code 통일 (spec 403 vs 구현 401)"
- **상세**: plan 결정 2 체크박스가 미완료 상태이며, plan 은 "권장안: 옵션 A (401 `TOKEN_SCOPE_MISMATCH` 로 통일)" 을 제시한다. 그런데 target §5.1 에러 표에는 현재 `403 Forbidden | TOKEN_SCOPE_MISMATCH` (line 337) 로 표기되어 있다. plan 에 따르면 구현(`InteractionGuard`)은 이미 401 로 내보내고 있으므로, target 이 403 을 유지하는 것은 구현과 불일치한 상태다. plan 이 이 결정을 "결정 필요" 로 열어 두고 있는데 target 이 그 상태(403)를 그대로 유지하여, plan 완료 시 target 을 수정해야 하는 후속 항목이 이미 명확히 존재한다.
- **제안**: plan `spec-fix-eia-token-error-codes.md` 결정 2 를 확정(권장: 옵션 A)한 뒤 target §5.1 의 403 행을 401 `TOKEN_SCOPE_MISMATCH` 로 갱신하고 체크박스를 완료 처리한다.

### 2. [WARNING] `spec-fix-eia-token-error-codes.md` 의 미결 항목 — `TOKEN_REVOKED` 행이 target §5.1 에 누락

- **target 위치**: §5.1 에러 표 (line 331–342)
- **관련 plan**: `plan/in-progress/spec-fix-eia-token-error-codes.md` §1 "결정 1 — §5.1 에러 표에 TOKEN_REVOKED 행 추가"
- **상세**: plan 결정 1 체크박스가 미완료이다. 구현 `InteractionGuard.mapReason()` 는 이미 `TOKEN_REVOKED` 를 내보내고 있으나, target §5.1 에러 표에 해당 행이 없다. plan 권장안(옵션 A: TOKEN_REVOKED 행 추가 + 헤더 노트 일반화)을 따르면 target 갱신이 필요하다.
- **제안**: plan 결정 1(권장: 옵션 A)을 확정한 뒤 target §5.1 에 `401 Unauthorized | TOKEN_REVOKED | execution 종료(또는 refresh)로 토큰이 즉시 무효화됨` 행과 X-Refresh-Token-Url 헤더 노트 일반화를 반영하고 체크박스를 완료 처리한다.

### 3. [WARNING] `spec-fix-eia-token-error-codes.md` §3 terminal revoke 신뢰성 — target §3.4/§9.3 에 fail-open 정책 미명시

- **target 위치**: §3.4 신뢰성·일관성 표, §9.3 발송 순서
- **관련 plan**: `plan/in-progress/spec-fix-eia-token-error-codes.md` §3 "결정 3 — terminal revoke 신뢰성 (EIA-AU-04) + fail-open 정책 명시"
- **상세**: plan 결정 3 체크박스가 미완료이다. plan 권장안(옵션 C: fail-open·잔여 위험을 의도적 트레이드오프로 spec 에 명시)에 따르면 target §3.4 에 신규 `EIA-RL-06` 류 신뢰성 행 추가와 §9.3 에 revoke 채널 fail-open 근거 문단 추가가 필요하다. 현재 target 에는 이 내용이 없어 plan 의 후속 작업이 누락된 상태다.
- **제안**: plan 결정 3 을 확정한 뒤(권장: 옵션 C) target §3.4 + §9.3 에 fail-open·잔여 위험 명시를 반영하고 체크박스를 완료 처리한다. 이후 outbox 전환 후속 plan(옵션 A)을 별도 신설한다.

### 4. [INFO] `fix-webchat-sse-field-map.md` — plan complete 이동 보류 상태로 target pending_plans 참조 중

- **target 위치**: frontmatter `pending_plans: plan/in-progress/fix-webchat-sse-field-map.md`
- **관련 plan**: `plan/in-progress/fix-webchat-sse-field-map.md` §"비차단 followup" W-1/I-1, 체크박스 `- [ ] plan complete 이동`
- **상세**: `fix-webchat-sse-field-map.md` 의 주요 구현(SSE wire 필드 수정)은 완료됐으나 "비차단 followup" 잔여로 plan complete 이동이 보류되어 있다. target 이 이 plan 을 `pending_plans` 에 계속 참조하는 것은 현 상태상 적절하다. 충돌이나 CRITICAL 문제는 없다.
- **제안**: `fix-webchat-sse-field-map.md` 의 비차단 followup 을 처리하거나 보류 결정으로 명시하면 target 의 `pending_plans` 에서 이 plan 을 제거할 수 있다.

### 5. [INFO] `ai-agent-tool-connection-rewrite.md` §3 cross-ref — EIA SSE tool_call payload 동기화 필요 (미결 결정 전제)

- **target 위치**: §5.2 SSE 이벤트 종류 — `execution.tool_call_started` / `execution.tool_call_completed`
- **관련 plan**: `plan/in-progress/ai-agent-tool-connection-rewrite.md` §3 "(EIA cross-ref)" — "도구 이름 규칙 결정 후 SSE payload spec 동기화"
- **상세**: `ai-agent-tool-connection-rewrite.md` 는 도구 등록 모델 등 핵심 결정이 전부 TBD 상태(§1 결정 기록 미결)이다. target §5.2 는 `tool_call_*` 이벤트를 나열하지만 payload 필드 상세(특히 `name` 필드의 namespace)를 규정하지 않아, 이 plan 의 결정이 완료되면 target §5.2 를 동기화해야 한다. target 이 현재 일방적으로 `name` namespace 를 확정한 것은 아니므로 충돌은 없다.
- **제안**: `ai-agent-tool-connection-rewrite.md` §1 결정(도구 이름 규칙)이 확정될 때 EIA §5.2 `tool_call_*` payload `name` 필드 동기화를 plan 의 §3 cross-ref 항목으로 추적한다.

---

## 요약

Target `spec/5-system/14-external-interaction-api.md` 는 `plan/in-progress/spec-fix-eia-token-error-codes.md` 가 "결정 필요" 로 열어 둔 3건(TOKEN_REVOKED 행 누락, SCOPE_MISMATCH status/code 불일치, terminal revoke fail-open 미명시)을 그대로 방치하고 있다. 이는 target 이 plan 과 충돌하는 결정을 일방적으로 내린 것이 아니라, plan 의 후속 작업이 target 에 아직 반영되지 않은 선행 plan 미해소 상황이다. CRITICAL 항목은 없으나 WARNING 3건이 모두 같은 plan(`spec-fix-eia-token-error-codes.md`)의 체크박스 미완료에서 비롯된다. 해당 plan 을 완료 처리하면 target 갱신이 후속으로 필요하다.

## 위험도

LOW
