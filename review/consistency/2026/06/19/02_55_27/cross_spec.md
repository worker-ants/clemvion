# Cross-Spec 일관성 검토 결과

**대상**: `spec/5-system/4-execution-engine.md` 영역의 구현 변경 (diff-base=origin/main)
**검토 모드**: --impl-done (구현 완료 후 검토)
**검토 일시**: 2026-06-19

---

## 발견사항

### INFO: 미등록 에러 코드(LLM_API_ERROR, LLM_PROVIDER_QUOTA)의 spec §10 표 미등재 — passthrough 동작은 구현과 일치하나 표에는 미정의

- **target 위치**: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.spec.ts` L408, L413–416, L426–435 (신규 추가 테스트 2건)
- **충돌 대상**: `spec/4-nodes/3-ai/1-ai-agent.md §10` (에러 코드 표 + §10 L1099 분류 규칙 blockquote)
- **상세**:

  신규 테스트는 두 가지 미등록 에러 코드의 동작을 확인한다:

  1. `LLM_API_ERROR` — `code: 'LLM_API_ERROR'`, `details.status: 429` 를 가진 에러가 `LLM_RATE_LIMIT` 으로 승격되지 않고 `LLM_API_ERROR` (retryable=false) 로 passthrough 됨을 검증.
  2. `LLM_PROVIDER_QUOTA` — 미등록 vendor-specific explicit code 가 그대로 passthrough 됨을 검증.

  spec §10 표 (`spec/4-nodes/3-ai/1-ai-agent.md` L1083–1092) 에는 `LLM_CALL_FAILED`, `LLM_RATE_LIMIT`, `LLM_RESPONSE_INVALID`, `TOOL_EXECUTION_FAILED`, `MAX_TOOL_CALLS_EXCEEDED` 5종만 열거되어 있다. 분류 규칙 blockquote (L1099) 는 "명시 code(`LLM_RESPONSE_INVALID` 등)→보존(non-retryable)" 이라 기술해 passthrough 동작이 존재함을 암시하지만, `LLM_RESPONSE_INVALID` 외의 미등록 코드가 passthrough 될 수 있다는 점 — 즉 §10 표 밖의 코드 값이 `output.error.code` 에 실릴 수 있다는 계약 — 은 표 자체에 명시되어 있지 않다.

  구현(`classifyLlmError` L1073–1074)은 spec L1099 blockquote의 "명시 code→보존" 정책을 충실히 따르고 있으며, 테스트 코멘트도 spec §10 L1099를 명시적으로 인용한다. 구현과 테스트 간 모순은 없다.

  충돌 차원: §10 코드 표가 "발생 가능한 전체 코드 집합"처럼 읽혀, 표에 없는 코드는 발행되지 않는다고 오해할 수 있다. 실제로는 passthrough 경로가 열려 있어 미등록 vendor 코드도 발행된다. spec의 "명시 코드 보존" 정책이 표와 blockquote 사이에서 부분적으로만 기술되어 있어 독자 혼동 가능성이 있다.

- **제안**: `spec/4-nodes/3-ai/1-ai-agent.md §10` 표에 passthrough 행을 명시적으로 추가하거나, 표 직후 또는 L1099 blockquote를 확장해 "§10 표는 잘 알려진 코드만 나열하며, 표 밖의 명시 code 가 err.code 로 주어지면 그대로 passthrough되어 retryable=false 로 발행된다"를 명기한다. 이는 spec 변경 사항이므로 `project-planner` 를 통해 `spec/4-nodes/3-ai/1-ai-agent.md` 를 갱신하는 것이 정규 경로다.

---

## 요약

이번 구현 변경(신규 테스트 2건)은 `spec/4-nodes/3-ai/1-ai-agent.md §10` 의 분류 규칙과 직접 충돌하지 않는다. `classifyLlmError` 의 explicit code passthrough 경로(L1073–1074)는 spec L1099 blockquote의 "명시 code→보존" 정책을 구현한 것이며, 테스트는 그 동작을 올바르게 검증한다. 단, §10 코드 표가 등록된 코드만 나열하는 "알려진 코드 카탈로그"인지 "발행 가능한 전체 집합"인지 명확하지 않아, 미등록 코드(`LLM_API_ERROR`, `LLM_PROVIDER_QUOTA`)가 `output.error.code` 에 노출된다는 계약이 spec 표에서는 도출되지 않는 문서 불완전성이 있다. 이는 구현 충돌이 아닌 spec 문서 보완 사항으로, INFO 등급으로 분류한다.

---

## 위험도

LOW
