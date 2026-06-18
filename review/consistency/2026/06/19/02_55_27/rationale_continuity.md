# Rationale 연속성 검토 결과

검토 모드: 구현 완료 후 검토 (--impl-done)
scope: spec/5-system/4-execution-engine.md
대상 diff: codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.spec.ts

---

## 발견사항

### [WARNING] 미등록 explicit code passthrough 테스트가 §10 "단일 LLM taxonomy 유지" 원칙과 부분 긴장

- **target 위치**: `ai-turn-orchestrator.service.spec.ts` 신규 테스트 케이스 (diff +49~+59 행) — `LLM_PROVIDER_QUOTA` 코드가 output.error.code 로 그대로 노출됨을 검증
- **과거 결정 출처**: `spec/4-nodes/3-ai/1-ai-agent.md §10` L1099 — "status·code·network 신호가 모두 없으면 `LLM_CALL_FAILED`(non-retryable) fallback 으로 매핑한다 — **별도 `AI_*` fallback 코드를 쓰지 않는다(§10 단일 LLM taxonomy 유지)**"
- **상세**: §10 Rationale 의 "단일 LLM taxonomy 유지" 원칙은 fallback 시 임의 코드를 신설하지 않도록 강제한다. 그러나 `classifyLlmError` 의 explicitCode passthrough 분기 (`typeof explicitCode === 'string' && explicitCode.length > 0` → `{ code: explicitCode, retryable: false }`)는 spec 표에 없는 코드(`LLM_PROVIDER_QUOTA`, `LLM_API_ERROR` 등)를 `output.error.code` 로 그대로 surface 할 수 있다. 신규 테스트는 이 passthrough 동작을 **의도된 정규 동작으로 명시화**하고 있다.
  - L1099 의 "명시 code → 보존(non-retryable)" 문구가 이 passthrough 를 허용하는 것으로 읽히지만, 그 문장은 `LLM_RESPONSE_INVALID` 등 **spec 등록 코드**를 예시로 들고 있어 미등록 vendor 코드까지 포함하는지가 명확하지 않다.
  - §10 코드 표에는 `LLM_PROVIDER_QUOTA`, `LLM_API_ERROR` 가 없다. 이 코드들이 `output.error.code` 로 노출되면 downstream(chat-channel-adapter §3.1 분류표, EIA 에러 처리 등)에서 미분류 코드로 취급될 수 있다.
  - "단일 LLM taxonomy 유지" 원칙을 미등록 코드 passthrough 에도 적용하려면, 새 Rationale 항목으로 "explicit code passthrough 허용 범위 = 미등록 vendor 코드 포함" 임을 명시해야 한다.
- **제안**:
  1. `spec/4-nodes/3-ai/1-ai-agent.md §10 Rationale`(또는 §10 본문 L1099 주석) 에 "미등록 explicit code 도 passthrough 허용 — 단, retryable=false 강제로 보수적 처리" 결정을 명시한다.
  2. 또는 passthrough 를 허용하지 않을 경우, `classifyLlmError` 가 미등록 코드를 `LLM_CALL_FAILED` 로 재매핑하도록 구현을 수정하고 테스트도 동기화한다.

---

### [INFO] 기존 테스트(`LLM_API_ERROR` + `details.status=429`)에 `expect(result.code).toBe('LLM_API_ERROR')` 추가 — Rationale 정합 보완

- **target 위치**: `ai-turn-orchestrator.service.spec.ts` diff +41 행 (`expect(result.code).toBe('LLM_API_ERROR')`)
- **과거 결정 출처**: `spec/4-nodes/3-ai/1-ai-agent.md §10` L1099 — "429→`LLM_RATE_LIMIT`", `extractHttpStatus` 는 top-level `.status` 를 읽음
- **상세**: 에러 객체에 `code: 'LLM_API_ERROR'` 와 `details: { status: 429 }` 가 있을 때, `extractHttpStatus` 가 top-level `.status` 를 보므로 429 분기에 걸리지 않고 explicitCode passthrough 분기로 떨어져 `LLM_API_ERROR` 가 보존된다. 테스트 주석이 이 동작을 잘 설명하고 있으며, spec L1099 의 "명시 code → 보존" 과 일관하다. 단, `details.status=429` 가 있어도 `LLM_RATE_LIMIT` 으로 승격되지 않는 이유가 spec 본문에 명시되어 있지 않다 — `extractHttpStatus` 가 top-level `.status` 만 읽는다는 구현 계약이 spec 에 기록되어 있지 않아, 독자가 "왜 429가 있는데 LLM_RATE_LIMIT 이 아닌가" 를 코드를 보기 전까지 알 수 없다.
- **제안**: `spec/4-nodes/3-ai/1-ai-agent.md §10` L1099 주석에 "HTTP status 판단은 에러 객체의 top-level `.status` 기준 — `details.status` 는 무시" 를 한 줄 추가해 독자 오해를 예방한다.

---

## 요약

diff 는 `ai-turn-orchestrator.service.spec.ts` 에 두 가지를 추가한다: (1) 기존 `LLM_API_ERROR` 테스트에 `result.code` assertion 추가, (2) 미등록 vendor 코드(`LLM_PROVIDER_QUOTA`) passthrough 를 검증하는 신규 테스트. 두 변경 모두 `classifyLlmError` 의 explicitCode passthrough 분기 동작을 테스트로 고정하는 것으로, `spec/4-nodes/3-ai/1-ai-agent.md §10` L1099 의 "명시 code → 보존(non-retryable)" 문구와 일관성이 있다. 그러나 §10 의 "단일 LLM taxonomy 유지" 원칙이 미등록 코드의 passthrough 까지 허용하는지가 spec 본문에 명시되어 있지 않아, Rationale 에 기각된 대안이 재도입된 것은 아니지만 결정의 범위 확장에 대한 새 Rationale 기록이 누락된 상태다. spec 수정 없이 이 구현을 그대로 두면 downstream 분류표와의 정합 위험이 낮은 수준으로 남는다.

---

## 위험도

LOW
